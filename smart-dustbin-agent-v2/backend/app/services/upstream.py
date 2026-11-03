import httpx
from datetime import datetime, timezone
from ..config import settings

def normalize_upstream_payload(payload):
    if isinstance(payload, dict):
        rows = payload.get("bins") or payload.get("data") or payload.get("results") or payload.get("status")
        if rows is None:
            rows = [payload]
    elif isinstance(payload, list):
        rows = payload
    else:
        raise ValueError("Upstream response must be a JSON list or object containing bins/data/results")
    normalized = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        device = row.get("device") if isinstance(row.get("device"), dict) else {}
        bin_id = row.get("device_id") or row.get("bin_id") or device.get("device_id")
        fill = row.get("fill", row.get("fill_percentage", row.get("fill_level")))
        if bin_id is None or fill is None:
            continue
        fill = float(fill)
        if not 0 <= fill <= 100:
            continue
        normalized.append({
            "bin_id": str(bin_id),
            "location": row.get("location", ""),
            "fill": fill,
            "distance_cm": row.get("distance", row.get("distance_cm")),
            "status": row.get("status", "UNKNOWN"),
            "online": bool(row.get("online", device.get("online", True))),
            "sensor_ok": bool(row.get("sensor_ok", device.get("sensor_ok", True))),
            "updated_at": datetime.now(timezone.utc)
        })
    return normalized

async def fetch_status():
    if not settings.upstream_api_base_url:
        return None
    headers = {}
    if settings.upstream_api_token:
        headers["Authorization"] = f"Bearer {settings.upstream_api_token}"
    url = settings.upstream_api_base_url + settings.upstream_status_path
    async with httpx.AsyncClient(timeout=settings.upstream_timeout_seconds) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return normalize_upstream_payload(response.json())
