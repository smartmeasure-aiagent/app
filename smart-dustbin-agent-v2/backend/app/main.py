from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from pydantic import BaseModel
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import tempfile, os, logging
from .db import Base, engine, get_db, SessionLocal, add_missing_columns
from .models import BinReading, Alert, Event
from .services.sample_data import load_sample
from .services.poller import start_poller, stop_poller, poll_once
from .services.stream import start_stream, stop_stream, stream_state
from .services.monitoring import process_reading
from .services import calls, fleet
from .agents.conversation_graph import conversation_graph
from .config import settings

def configure_logging():
    """Make ingest activity visible on the console. Without this, the stream
    consumer's INFO messages are swallowed and the server looks idle."""
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    # httpx logs a line per request, which is pure noise against a 2s feed.
    # twilio.http_client dumps full request/response headers per call; silence it
    # so the console stays readable (Twilio is disabled in notify_alert anyway).
    for noisy in ("httpx", "httpcore", "apscheduler.executors.default",
                  "twilio.http_client", "twilio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    Base.metadata.create_all(bind=engine)
    add_missing_columns()
    db = SessionLocal()
    try:
        load_sample(db)
    finally:
        db.close()
    # Fleet is the richest source; the single-bin voice stream covers the real
    # ESP32 unit; the generic poller is the fallback when neither is enabled.
    fleet_on = fleet.start_fleet_poller()
    streaming = start_stream()
    if not (fleet_on or streaming):
        start_poller(settings.poll_interval_seconds)
    yield
    await stop_stream()
    fleet.stop_fleet_poller()
    stop_poller()

app = FastAPI(title="Smart Dustbin Voice Agent API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class QueryRequest(BaseModel):
    text: str
    # "en" or "te". The verified answer is always computed from database rows;
    # the language only changes how it is worded back to the user.
    lang: str = "en"

class ResetRequest(BaseModel):
    bin_id: str
    confirmed: bool = False

def latest_bins(db):
    rows = db.execute(select(BinReading).order_by(desc(BinReading.updated_at), desc(BinReading.id))).scalars().all()
    result = {}
    for r in rows:
        if r.bin_id not in result:
            result[r.bin_id] = {
                "bin_id": r.bin_id, "location": r.location, "fill": r.fill,
                "distance_cm": r.distance_cm, "status": r.status,
                "online": r.online, "sensor_ok": r.sensor_ok,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None
            }
    return list(result.values())

@app.get("/api/health")
def health():
    return {"ok": True, "service": "smart-dustbin-agent"}

@app.get("/api/status")
def status(bin_id: str | None = None, db: Session = Depends(get_db)):
    bins = latest_bins(db)
    if bin_id:
        bins = [b for b in bins if b["bin_id"].lower() == bin_id.lower()]
    return {"bins": bins, "count": len(bins)}

@app.get("/api/device")
def devices(db: Session = Depends(get_db)):
    return {"devices": latest_bins(db)}

@app.get("/api/alerts")
def alerts(db: Session = Depends(get_db)):
    rows = db.execute(select(Alert).order_by(desc(Alert.created_at)).limit(100)).scalars().all()
    return {"alerts": [{
        "id": a.id, "bin_id": a.bin_id, "location": a.location, "fill": a.fill,
        "severity": a.severity, "message": a.message, "state": a.state,
        "created_at": a.created_at.isoformat() if a.created_at else None
    } for a in rows]}

@app.get("/api/events")
def events(db: Session = Depends(get_db)):
    rows = db.execute(select(Event).order_by(desc(Event.created_at)).limit(100)).scalars().all()
    return {"events": [{"id": e.id, "bin_id": e.bin_id, "event": e.event, "detail": e.detail,
                        "created_at": e.created_at.isoformat() if e.created_at else None} for e in rows]}

@app.get("/api/history")
def history(bin_id: str = "BIN-A1", db: Session = Depends(get_db)):
    rows = db.execute(select(BinReading).where(BinReading.bin_id == bin_id).order_by(BinReading.updated_at)).scalars().all()
    return {"bin_id": bin_id, "history": [{"fill": r.fill, "distance_cm": r.distance_cm, "timestamp": r.updated_at.isoformat() if r.updated_at else None} for r in rows]}

@app.post("/api/voice/query")
def voice_query(req: QueryRequest, db: Session = Depends(get_db)):
    result = conversation_graph.invoke({
        "question": req.text, "bins": latest_bins(db), "lang": req.lang,
    })
    return {"question": req.text, "lang": req.lang,
            "answer": result.get("answer", "Sorry, I could not answer that.")}

@app.post("/api/voice/transcribe")
async def transcribe(audio: UploadFile = File(...), lang: str = "en"):
    if not settings.groq_api_key:
        raise HTTPException(400, "Set GROQ_API_KEY to enable transcription.")
    from groq import Groq
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        path = tmp.name
    try:
        client = Groq(api_key=settings.groq_api_key)
        with open(path, "rb") as f:
            # Naming the language markedly improves Whisper accuracy for Telugu.
            result = client.audio.transcriptions.create(
                file=(os.path.basename(path), f.read()),
                model=settings.groq_stt_model,
                language=lang if lang in ("en", "te") else "en",
            )
        return {"text": result.text}
    finally:
        os.unlink(path)

@app.post("/api/reset")
def reset(req: ResetRequest, db: Session = Depends(get_db)):
    if not req.confirmed:
        raise HTTPException(400, "Set confirmed=true after an authorized user confirms collection.")
    bins = [b for b in latest_bins(db) if b["bin_id"] == req.bin_id]
    if not bins:
        raise HTTPException(404, "Bin not found")
    row = bins[0]
    process_reading(db, {"bin_id": req.bin_id, "location": row["location"], "fill": 0.0,
                         "distance_cm": 60.0, "status": "AVAILABLE", "online": True,
                         "sensor_ok": True, "updated_at": datetime.now(timezone.utc)})
    db.add(Event(bin_id=req.bin_id, event="RESET", detail="Marked collected and reset to 0%."))
    db.commit()
    return {"ok": True, "bin_id": req.bin_id, "fill": 0, "status": "AVAILABLE"}

@app.post("/api/poll/run")
async def run_poll():
    return await poll_once()

@app.get("/api/stream/state")
def stream_status():
    return stream_state()

# --- Fleet feed and synthetic data generators -------------------------------
# Read-through to the upstream so the dashboard needs only one origin, and the
# upstream API key never reaches the browser.

@app.get("/api/fleet/state")
def fleet_status():
    return fleet.fleet_state()

@app.post("/api/fleet/poll")
async def fleet_poll():
    return await fleet.poll_fleet_once()

FLEET_READS = {
    "bins": "/api/fleet", "stats": "/api/fleet/stats", "alerts": "/api/fleet/alerts",
    "events": "/api/fleet/events", "collections": "/api/fleet/collections",
    "crew": "/api/fleet/crew", "ghats": "/api/fleet/ghats", "history": "/api/fleet/history",
}

@app.get("/api/fleet/{resource}")
async def fleet_resource(resource: str, window: str | None = None, limit: int | None = None):
    path = FLEET_READS.get(resource)
    if not path:
        raise HTTPException(404, f"Unknown fleet resource. Try: {', '.join(sorted(FLEET_READS))}")
    params = {k: v for k, v in (("window", window), ("limit", limit)) if v is not None}
    try:
        return {"resource": resource, "data": await fleet.fetch(path, params=params or None)}
    except Exception as exc:
        raise HTTPException(502, f"Upstream fleet request failed: {exc}")

class SimConfig(BaseModel):
    """Generator settings. Only the fields you set are forwarded upstream."""
    interval: float | None = None
    speed: float | None = None
    fault_chance: float | None = None
    bin_height: float | None = None
    device_id: str | None = None
    fw: str | None = None
    auto_collect: bool | None = None
    cycles: int | None = None
    duration_s: float | None = None
    surge: float | None = None

SIM_TARGETS = {"single": "/api/sim", "fleet": "/api/fleet/sim"}

@app.get("/api/sim/{target}/status")
async def sim_status(target: str):
    prefix = SIM_TARGETS.get(target)
    if not prefix:
        raise HTTPException(404, "target must be 'single' or 'fleet'")
    try:
        return await fleet.fetch(f"{prefix}/status")
    except Exception as exc:
        raise HTTPException(502, f"Upstream generator request failed: {exc}")

@app.post("/api/sim/{target}/{action}")
async def sim_control(target: str, action: str, cfg: SimConfig | None = None):
    prefix = SIM_TARGETS.get(target)
    if not prefix:
        raise HTTPException(404, "target must be 'single' or 'fleet'")
    if action not in ("start", "stop", "step"):
        raise HTTPException(404, "action must be 'start', 'stop' or 'step'")
    body = cfg.model_dump(exclude_none=True) if cfg else {}
    try:
        result = await fleet.command(f"{prefix}/{action}", body)
    except Exception as exc:
        raise HTTPException(502, f"Upstream generator command failed: {exc}")
    # Pull the new data in immediately so the dashboard reflects the change.
    if target == "fleet" and action in ("start", "step"):
        await fleet.poll_fleet_once()
    return result

@app.get("/api/calls/active")
def calls_active(db: Session = Depends(get_db)):
    """Calls currently ringing or connected. The dashboard polls this to pop the dialler."""
    return {"calls": calls.active_calls(db)}

@app.get("/api/calls")
def calls_recent(db: Session = Depends(get_db)):
    return {"calls": calls.recent_calls(db)}

@app.post("/api/calls/{call_id}/answer")
def call_answer(call_id: int, lang: str = "en", db: Session = Depends(get_db)):
    call = calls.get_call(db, call_id)
    if not call:
        raise HTTPException(404, "Call not found")
    return calls.answer_call(db, call, lang=lang)

@app.post("/api/calls/{call_id}/say")
def call_say(call_id: int, req: QueryRequest, db: Session = Depends(get_db)):
    call = calls.get_call(db, call_id)
    if not call:
        raise HTTPException(404, "Call not found")
    try:
        return calls.speak_turn(db, call, req.text, latest_bins(db), lang=req.lang)
    except ValueError as exc:
        raise HTTPException(409, str(exc))

@app.post("/api/calls/{call_id}/end")
def call_end(call_id: int, reason: str = "ended", db: Session = Depends(get_db)):
    call = calls.get_call(db, call_id)
    if not call:
        raise HTTPException(404, "Call not found")
    return calls.end_call(db, call, reason)

@app.websocket("/ws/updates")
async def websocket_updates(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            await ws.send_json({"type": "refresh", "at": datetime.now(timezone.utc).isoformat()})
            import asyncio
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
