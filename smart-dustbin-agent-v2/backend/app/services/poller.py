import asyncio, logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from ..db import SessionLocal
from .upstream import fetch_status
from .monitoring import process_reading, mark_stale_bins

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

async def poll_once():
    try:
        rows = await fetch_status()
        if rows is None:
            return {"mode": "demo", "fetched": 0}
        db = SessionLocal()
        try:
            for row in rows:
                process_reading(db, row)
            mark_stale_bins(db)
        finally:
            db.close()
        return {"mode": "upstream", "fetched": len(rows)}
    except Exception:
        log.exception("Upstream polling failed")
        return {"mode": "error", "fetched": 0}

def start_poller(interval_seconds):
    if not scheduler.running:
        scheduler.add_job(poll_once, "interval", seconds=interval_seconds, id="dustbin_poll", replace_existing=True)
        scheduler.start()

def stop_poller():
    if scheduler.running:
        scheduler.shutdown(wait=False)
