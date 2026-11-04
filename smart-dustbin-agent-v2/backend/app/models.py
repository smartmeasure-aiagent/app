from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, UniqueConstraint
from datetime import datetime, timezone
from .db import Base

def utcnow():
    return datetime.now(timezone.utc)

class BinReading(Base):
    __tablename__ = "bin_readings"
    id = Column(Integer, primary_key=True)
    bin_id = Column(String(64), index=True, nullable=False)
    location = Column(String(255), default="")
    fill = Column(Float, nullable=False)
    distance_cm = Column(Float, nullable=True)
    status = Column(String(64), default="AVAILABLE")
    online = Column(Boolean, default=True)
    sensor_ok = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, index=True)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    bin_id = Column(String(64), index=True, nullable=False)
    location = Column(String(255), default="")
    fill = Column(Float, nullable=False)
    severity = Column(String(32), default="medium")
    message = Column(Text, default="")
    state = Column(String(32), default="open")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True)
    bin_id = Column(String(64), index=True)
    event = Column(String(64))
    detail = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)

class VoiceCall(Base):
    """A call placed to staff about a full bin.

    When Twilio is not configured the call is delivered to the dashboard instead
    of the telephone network, and the browser handles speech in and out.
    """
    __tablename__ = "voice_calls"
    id = Column(Integer, primary_key=True)
    bin_id = Column(String(64), index=True, nullable=False)
    location = Column(String(255), default="")
    fill = Column(Float, nullable=False)
    severity = Column(String(32), default="medium")
    opening_line = Column(Text, default="")
    channel = Column(String(16), default="browser")   # browser | twilio
    state = Column(String(16), default="ringing", index=True)  # ringing | active | ended | missed
    transcript = Column(Text, default="[]")           # JSON list of {role, text, at}
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)
    answered_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)

class ThresholdState(Base):
    __tablename__ = "threshold_states"
    id = Column(Integer, primary_key=True)
    bin_id = Column(String(64), unique=True, nullable=False)
    consecutive_high = Column(Integer, default=0)
    last_severity = Column(String(32), default="normal")
    alert_open = Column(Boolean, default=False)
