from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from ..models import BinReading, Alert, Event, ThresholdState
from ..agents.monitoring_graph import monitoring_graph
from .notifications import notify_alert

def process_reading(db, row):
    db.add(BinReading(**row))
    state = db.execute(select(ThresholdState).where(ThresholdState.bin_id == row["bin_id"])).scalar_one_or_none()
    if state is None:
        state = ThresholdState(bin_id=row["bin_id"], consecutive_high=0, last_severity="normal", alert_open=False)
        db.add(state)
    fill = float(row["fill"])
    if fill >= 80:
        state.consecutive_high += 1
    else:
        state.consecutive_high = 0
    severity = "critical" if fill >= 100 else "high" if fill >= 90 else "medium" if fill >= 80 else "normal"
    should_alert = fill >= 80 and state.consecutive_high >= 2
    new_escalation = should_alert and (not state.alert_open or severity != state.last_severity)
    if new_escalation:
        result = monitoring_graph.invoke({
            "bin_id": row["bin_id"], "location": row.get("location", ""),
            "fill": fill, "severity": severity
        })
        message = result.get("message", f"{row['bin_id']} is {fill}% full.")
        alert = Alert(bin_id=row["bin_id"], location=row.get("location", ""), fill=fill,
                      severity=severity, message=message, state="open")
        db.add(alert)
        db.add(Event(bin_id=row["bin_id"], event="THRESHOLD_ALERT", detail=message))
        state.alert_open = True
        state.last_severity = severity
        db.flush()
        notify_alert(message, severity)
    elif fill < 75 and state.alert_open:
        state.alert_open = False
        state.last_severity = "normal"
        state.consecutive_high = 0
        db.add(Event(bin_id=row["bin_id"], event="ALERT_RECOVERED", detail="Fill level dropped below 75%."))
    db.commit()

def mark_stale_bins(db):
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
    rows = db.execute(select(BinReading).order_by(BinReading.updated_at.desc())).scalars().all()
    latest = {}
    for row in rows:
        latest.setdefault(row.bin_id, row)
    for row in latest.values():
        if row.updated_at and row.updated_at.replace(tzinfo=timezone.utc) < cutoff:
            row.online = False
    db.commit()
