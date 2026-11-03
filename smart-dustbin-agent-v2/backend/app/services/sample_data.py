import json, os
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import select
from ..models import BinReading, Event

ROOT = Path(__file__).resolve().parents[3]
SAMPLE_DIR = ROOT / "sample-data"

def load_sample(db):
    if db.execute(select(BinReading).limit(1)).first():
        return
    path = SAMPLE_DIR / "fleet_status.json"
    if not path.exists():
        return
    rows = json.loads(path.read_text(encoding="utf-8"))
    for row in rows:
        device = row.get("device", {})
        db.add(BinReading(
            bin_id=device.get("device_id", row.get("device_id", "")),
            location=row.get("location", ""),
            fill=float(row.get("fill", 0)),
            distance_cm=row.get("distance"),
            status=row.get("status", "UNKNOWN"),
            online=bool(device.get("online", row.get("online", True))),
            sensor_ok=bool(device.get("sensor_ok", row.get("sensor_ok", True))),
            updated_at=datetime.now(timezone.utc)
        ))
    events_path = SAMPLE_DIR / "events.json"
    if events_path.exists():
        for ev in json.loads(events_path.read_text(encoding="utf-8")):
            db.add(Event(bin_id=ev.get("device_id"), event=ev.get("event"), detail=ev.get("detail", "")))
    db.commit()
