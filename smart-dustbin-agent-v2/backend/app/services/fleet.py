"""Ingest for the upstream fleet feed, and a proxy for its data generators.

The upstream exposes two independent synthetic generators (see
`synthetic-data-generation.md`): a single-bin one under `/api/sim/*` that drives
the voice endpoints, and a 16-bin fleet under `/api/fleet/*`. The fleet feed is
far richer than the voice stream — coordinates, battery, zone and crew — so it
is polled here and fed through the same threshold engine as every other source.

Fleet endpoints need no API key; the voice endpoints do.
"""
import logging
from datetime import datetime, timezone
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from ..config import settings
from ..db import SessionLocal
from .monitoring import process_reading, mark_stale_bins
from .upstream import auth_headers

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

def _url(path):
    return f"{settings.upstream_api_base_url}{path}"

async def _request(method, path, json=None, params=None):
    if not settings.upstream_api_base_url:
        raise RuntimeError("UPSTREAM_API_BASE_URL is not set")
    async with httpx.AsyncClient(timeout=settings.upstream_timeout_seconds) as client:
        response = await client.request(method, _url(path), json=json, params=params,
                                        headers=auth_headers())
        response.raise_for_status()
        return response.json()

async def fetch(path, params=None):
    """Read-through to an upstream fleet resource (bins, crew, ghats, …)."""
    return await _request("GET", path, params=params)

async def command(path, body=None):
    """Forward a generator control call (start, stop, step, collect, ack…)."""
    return await _request("POST", path, json=body or {})

def is_online(bin_row):
    """Judge reachability from the bin's own reported freshness.

    The upstream `online` boolean flips false for most bins between their turns
    in the generator's rotation, which would mark a healthy fleet offline. Its
    `lastUpdateS` is the honest signal, so trust that when present.
    """
    age = bin_row.get("lastUpdateS")
    if age is None:
        return bool(bin_row.get("online", True))
    return float(age) <= settings.fleet_online_tolerance_seconds

def status_for(bin_row):
    """Derive our status vocabulary from the fleet record's own numbers."""
    if not is_online(bin_row):
        return "NO RECENT DATA"
    fill = float(bin_row.get("fill", 0))
    if fill >= 80:
        return "FULL - COLLECT NOW"
    if fill >= 60:
        return "ALMOST FULL"
    return "AVAILABLE"

def normalize_fleet(payload):
    """Map `GET /api/fleet` records onto BinReading rows."""
    rows = payload if isinstance(payload, list) else payload.get("bins", [])
    now = datetime.now(timezone.utc)
    normalized = []
    for b in rows:
        if not isinstance(b, dict):
            continue
        bin_id, fill = b.get("id"), b.get("fill")
        if bin_id is None or fill is None:
            continue
        fill = float(fill)
        if not 0 <= fill <= 100:
            continue
        normalized.append({
            "bin_id": str(bin_id),
            # `zone` is the human place name; the fleet feed has no `location` field.
            "location": b.get("zone") or b.get("name") or "",
            "fill": fill,
            "distance_cm": b.get("distance"),
            "status": status_for(b),
            "online": is_online(b),
            "sensor_ok": bool(b.get("sensorOk", True)),
            "updated_at": now,
            "name": b.get("name") or "",
            "zone": b.get("zone") or "",
            "ghat_code": b.get("ghatCode") or "",
            "sector": b.get("sector") or "",
            "density": b.get("density") or "",
            "team": b.get("team") or "",
            "capacity": b.get("capacity"),
            "battery": b.get("battery"),
            "rssi": b.get("rssi"),
            "temp": b.get("temp"),
            "fill_rate": b.get("fillRate"),
            "failed_reads": b.get("failedReads"),
            "firmware": b.get("firmware") or "",
            "lat": b.get("lat"),
            "lng": b.get("lng"),
        })
    return normalized

# bin_id -> signature of the last stored row, so unchanged bins are not rewritten.
_last = {}

def _signature(row):
    return (row["fill"], row["status"], row["online"], row["sensor_ok"], row["battery"])

def _persist(rows):
    db = SessionLocal()
    try:
        stored = 0
        for row in rows:
            if _last.get(row["bin_id"]) == _signature(row):
                continue
            process_reading(db, row)
            _last[row["bin_id"]] = _signature(row)
            stored += 1
        mark_stale_bins(db)
        return stored
    finally:
        db.close()

async def poll_fleet_once():
    """Pull the whole fleet and store the bins whose readings changed."""
    if not (settings.fleet_enabled and settings.upstream_api_base_url):
        return {"mode": "disabled", "bins": 0, "stored": 0}
    import asyncio
    try:
        payload = await fetch(settings.fleet_path)
        rows = normalize_fleet(payload)
        stored = await asyncio.to_thread(_persist, rows)
        if stored:
            log.info("Fleet poll: %d bins, %d changed reading(s) stored", len(rows), stored)
        return {"mode": "fleet", "bins": len(rows), "stored": stored}
    except asyncio.CancelledError:
        # Normal during shutdown; apscheduler would otherwise log a traceback.
        return {"mode": "cancelled", "bins": 0, "stored": 0}
    except Exception:
        log.exception("Fleet polling failed")
        return {"mode": "error", "bins": 0, "stored": 0}

def start_fleet_poller():
    if not (settings.fleet_enabled and settings.upstream_api_base_url):
        return False
    if not scheduler.running:
        # coalesce so a slow poll collapses its backlog instead of queueing runs.
        scheduler.add_job(poll_fleet_once, "interval", seconds=settings.fleet_poll_seconds,
                          id="fleet_poll", replace_existing=True, max_instances=1,
                          coalesce=True, misfire_grace_time=30)
        scheduler.start()
        log.info("Fleet poller started: every %ss from %s",
                 settings.fleet_poll_seconds, _url(settings.fleet_path))
    return True

def stop_fleet_poller():
    if scheduler.running:
        scheduler.shutdown(wait=False)

def fleet_state():
    return {
        "enabled": settings.fleet_enabled,
        "configured": bool(settings.upstream_api_base_url),
        "running": scheduler.running,
        "url": _url(settings.fleet_path) if settings.upstream_api_base_url else None,
        "poll_seconds": settings.fleet_poll_seconds,
        "tracked_bins": sorted(_last),
    }
