"""Server-sent-events consumer for the upstream voice API's live feed.

The upstream emits `status`, `alert` and `device` events on
`GET {BASE_URL}/api/voice/stream?interval=N`. Each carries the same payload shape
as `/api/voice/status`, so it is normalized through the same code path as polling
and fed to the threshold engine.
"""
import asyncio, json, logging
import httpx
from ..config import settings
from ..db import SessionLocal
from .upstream import auth_headers, normalize_upstream_payload
from .monitoring import process_reading

log = logging.getLogger(__name__)

_task: asyncio.Task | None = None
# bin_id -> (signature, monotonic timestamp) of the last row written to the database.
_last_persisted: dict[str, tuple[tuple, float]] = {}

def stream_url():
    return (f"{settings.upstream_api_base_url}{settings.upstream_stream_path}"
            f"?interval={settings.upstream_stream_interval}")

def _signature(row):
    return (row["fill"], row["status"], row["online"], row["sensor_ok"])

def _should_persist(row, now):
    """Skip rows identical to the last stored one, apart from a periodic heartbeat."""
    previous = _last_persisted.get(row["bin_id"])
    if previous is None:
        return True
    signature, written_at = previous
    if signature != _signature(row):
        return True
    return now - written_at >= settings.persist_heartbeat_seconds

def _persist(rows):
    db = SessionLocal()
    try:
        for row in rows:
            process_reading(db, row)
    finally:
        db.close()

async def handle_event(event, payload):
    """Normalize one SSE payload and store it if the reading actually changed."""
    rows = normalize_upstream_payload(payload)
    now = asyncio.get_running_loop().time()
    fresh = [r for r in rows if _should_persist(r, now)]
    if not fresh:
        return 0
    # process_reading is blocking (database + notifications), so keep it off the loop.
    await asyncio.to_thread(_persist, fresh)
    for row in fresh:
        _last_persisted[row["bin_id"]] = (_signature(row), now)
    log.info("Stream %s event stored %d reading(s)", event, len(fresh))
    return len(fresh)

async def _consume():
    """Read the feed forever, reconnecting with capped exponential backoff."""
    backoff = 1
    while True:
        try:
            # No read timeout: an idle SSE connection is healthy, not stalled.
            timeout = httpx.Timeout(settings.upstream_timeout_seconds, read=None)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("GET", stream_url(), headers=auth_headers()) as response:
                    response.raise_for_status()
                    log.info("Connected to upstream stream %s", stream_url())
                    backoff = 1
                    event = "message"
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        if line.startswith(":"):
                            continue
                        if line.startswith("event:"):
                            event = line[6:].strip()
                        elif line.startswith("data:"):
                            try:
                                payload = json.loads(line[5:])
                            except json.JSONDecodeError:
                                log.warning("Skipping malformed stream data: %s", line[:120])
                                continue
                            try:
                                await handle_event(event, payload)
                            except Exception:
                                log.exception("Failed to process stream event %s", event)
                            event = "message"
        except asyncio.CancelledError:
            raise
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 401:
                log.error("Upstream stream rejected the API key (401). Check UPSTREAM_API_KEY.")
            else:
                log.warning("Upstream stream returned %s", exc.response.status_code)
        except Exception:
            log.warning("Upstream stream disconnected; retrying in %ss", backoff, exc_info=True)
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 60)

def start_stream():
    global _task
    if not (settings.upstream_stream_enabled and settings.upstream_api_base_url):
        return False
    if _task is None or _task.done():
        _task = asyncio.create_task(_consume(), name="upstream_stream")
    return True

async def stop_stream():
    global _task
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
    _task = None
    _last_persisted.clear()

def stream_state():
    return {
        "enabled": settings.upstream_stream_enabled,
        "configured": bool(settings.upstream_api_base_url),
        "running": bool(_task and not _task.done()),
        "url": stream_url() if settings.upstream_api_base_url else None,
        "tracked_bins": sorted(_last_persisted),
    }
