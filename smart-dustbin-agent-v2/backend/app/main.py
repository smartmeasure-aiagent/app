from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from pydantic import BaseModel
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import tempfile, os, logging
from .db import Base, engine, get_db, SessionLocal
from .models import BinReading, Alert, Event
from .services.sample_data import load_sample
from .services.poller import start_poller, stop_poller, poll_once
from .services.stream import start_stream, stop_stream, stream_state
from .services.monitoring import process_reading
from .services import calls
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
    for noisy in ("httpx", "httpcore", "apscheduler.executors.default"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        load_sample(db)
    finally:
        db.close()
    # The stream is the primary feed; polling is the fallback when it is disabled.
    streaming = start_stream()
    if not streaming:
        start_poller(settings.poll_interval_seconds)
    yield
    await stop_stream()
    stop_poller()

app = FastAPI(title="Smart Dustbin Voice Agent API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class QueryRequest(BaseModel):
    text: str

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
    result = conversation_graph.invoke({"question": req.text, "bins": latest_bins(db)})
    return {"question": req.text, "answer": result.get("answer", "Sorry, I could not answer that.")}

@app.post("/api/voice/transcribe")
async def transcribe(audio: UploadFile = File(...)):
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
            result = client.audio.transcriptions.create(file=(os.path.basename(path), f.read()), model=settings.groq_stt_model)
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

@app.get("/api/calls/active")
def calls_active(db: Session = Depends(get_db)):
    """Calls currently ringing or connected. The dashboard polls this to pop the dialler."""
    return {"calls": calls.active_calls(db)}

@app.get("/api/calls")
def calls_recent(db: Session = Depends(get_db)):
    return {"calls": calls.recent_calls(db)}

@app.post("/api/calls/{call_id}/answer")
def call_answer(call_id: int, db: Session = Depends(get_db)):
    call = calls.get_call(db, call_id)
    if not call:
        raise HTTPException(404, "Call not found")
    return calls.answer_call(db, call)

@app.post("/api/calls/{call_id}/say")
def call_say(call_id: int, req: QueryRequest, db: Session = Depends(get_db)):
    call = calls.get_call(db, call_id)
    if not call:
        raise HTTPException(404, "Call not found")
    try:
        return calls.speak_turn(db, call, req.text, latest_bins(db))
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
