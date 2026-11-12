"""Automated collection calls, delivered to the dashboard when Twilio is absent.

A bin crossing the alert threshold places a call. Without Twilio credentials the
call rings in the browser instead of on a phone: the dashboard speaks the opening
line aloud and relays the operator's replies back through the grounded assistant,
so the same conversation works with or without telephony.
"""
import json, logging
from datetime import datetime, timezone
from sqlalchemy import select, desc
from ..models import VoiceCall, Event
from ..agents.conversation_graph import answer_question

log = logging.getLogger(__name__)

# A call left unanswered this long is abandoned, so stale alerts stop ringing.
RING_TIMEOUT_SECONDS = 180

def _now():
    return datetime.now(timezone.utc)

def _turns(call):
    try:
        return json.loads(call.transcript or "[]")
    except json.JSONDecodeError:
        return []

def _append(call, role, text):
    turns = _turns(call)
    turns.append({"role": role, "text": text, "at": _now().isoformat()})
    call.transcript = json.dumps(turns)
    return turns

def serialize(call):
    return {
        "id": call.id,
        "bin_id": call.bin_id,
        "location": call.location,
        "fill": call.fill,
        "severity": call.severity,
        "opening_line": call.opening_line,
        "channel": call.channel,
        "state": call.state,
        "transcript": _turns(call),
        "created_at": call.created_at.isoformat() if call.created_at else None,
    }

def opening_line(bin_id, location, fill, severity, lang="en"):
    """The sentence the agent speaks the moment the call connects.

    Written out per language rather than translated by the model: this is the
    one line that must be right even when Groq is unreachable, because it is
    what tells the crew which bin needs emptying.
    """
    spoken_id = bin_id.replace("-", " ")
    urgent = severity in ("high", "critical")
    if lang == "te":
        where = f"{location} లోని " if location else ""
        urgency = ("దీన్ని వెంటనే ఖాళీ చేయాలి." if urgent
                   else "దయచేసి సేకరణ ఏర్పాటు చేయండి.")
        return (f"నమస్కారం, ఇది ఆటోమేటిక్ స్మార్ట్ డస్ట్‌బిన్ ఏజెంట్. "
                f"{where}{spoken_id} చెత్త డబ్బా {round(fill)} శాతం నిండింది. {urgency} "
                "ఈ డబ్బా గురించి మీరు నన్ను అడగవచ్చు, "
                "లేదా ఖాళీ చేసిన తర్వాత 'సేకరించాం' అని చెప్పండి.")
    where = f" at {location}" if location else ""
    urgency = "It needs immediate collection." if urgent else "Please arrange collection."
    return (f"Hello, this is the automated smart dustbin agent. Bin {spoken_id}{where} "
            f"is {round(fill)} percent full. {urgency} "
            "You can ask me about the bin, or say collected when it has been emptied.")

def place_call(db, bin_id, location, fill, severity, channel="browser"):
    """Ring a new call unless one is already live for this bin."""
    existing = db.execute(
        select(VoiceCall).where(VoiceCall.bin_id == bin_id,
                                VoiceCall.state.in_(("ringing", "active")))
    ).scalars().first()
    if existing:
        log.info("Call %s already live for %s; not placing another.", existing.id, bin_id)
        return existing
    call = VoiceCall(bin_id=bin_id, location=location or "", fill=fill, severity=severity,
                     opening_line=opening_line(bin_id, location, fill, severity),
                     channel=channel, state="ringing", transcript="[]")
    db.add(call)
    db.add(Event(bin_id=bin_id, event="CALL_PLACED",
                 detail=f"{severity} call placed on the {channel} channel at {fill}% full."))
    db.flush()
    log.info("Placed %s call %s for %s at %.0f%%", channel, call.id, bin_id, fill)
    return call

def expire_stale(db):
    """Mark calls that rang unanswered as missed."""
    cutoff = _now().timestamp() - RING_TIMEOUT_SECONDS
    rows = db.execute(select(VoiceCall).where(VoiceCall.state == "ringing")).scalars().all()
    changed = 0
    for call in rows:
        created = call.created_at
        if created is None:
            continue
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if created.timestamp() < cutoff:
            call.state = "missed"
            call.ended_at = _now()
            db.add(Event(bin_id=call.bin_id, event="CALL_MISSED",
                         detail=f"Call {call.id} rang unanswered."))
            changed += 1
    if changed:
        db.commit()
    return changed

def active_calls(db):
    expire_stale(db)
    rows = db.execute(
        select(VoiceCall).where(VoiceCall.state.in_(("ringing", "active")))
        .order_by(desc(VoiceCall.created_at))
    ).scalars().all()
    return [serialize(c) for c in rows]

def recent_calls(db, limit=20):
    rows = db.execute(select(VoiceCall).order_by(desc(VoiceCall.created_at)).limit(limit)).scalars().all()
    return [serialize(c) for c in rows]

def get_call(db, call_id):
    return db.get(VoiceCall, call_id)

def answer_call(db, call, lang="en"):
    """Connect the call and return the agent's opening turn in `lang`."""
    if call.state == "ringing":
        call.state = "active"
        call.answered_at = _now()
        # The stored line is English; re-render it if the operator chose Telugu.
        line = call.opening_line if lang == "en" else opening_line(
            call.bin_id, call.location, call.fill, call.severity, lang=lang)
        call.opening_line = line
        _append(call, "agent", line)
        db.add(Event(bin_id=call.bin_id, event="CALL_ANSWERED", detail=f"Call {call.id} answered."))
        db.commit()
    return serialize(call)

def end_call(db, call, reason="ended"):
    if call.state in ("ringing", "active"):
        call.state = "missed" if (call.state == "ringing" and reason == "declined") else "ended"
        call.ended_at = _now()
        db.add(Event(bin_id=call.bin_id, event="CALL_ENDED",
                     detail=f"Call {call.id} {reason}."))
        db.commit()
    return serialize(call)

def hang_up_for_bin(db, bin_id):
    """End any live call for a bin once it no longer needs collecting."""
    rows = db.execute(
        select(VoiceCall).where(VoiceCall.bin_id == bin_id,
                                VoiceCall.state.in_(("ringing", "active")))
    ).scalars().all()
    for call in rows:
        call.state = "ended"
        call.ended_at = _now()
        db.add(Event(bin_id=bin_id, event="CALL_ENDED",
                     detail=f"Call {call.id} closed automatically: bin no longer needs collection."))
    return len(rows)

def speak_turn(db, call, text, bins, lang="en"):
    """Record the caller's words and answer them in the context of this call."""
    if call.state != "active":
        raise ValueError("Call is not active")
    _append(call, "caller", text)
    context = (f"This call is about bin {call.bin_id}"
               f"{' at ' + call.location if call.location else ''}, "
               f"which was {round(call.fill)} percent full when the call was placed.")
    reply = answer_question(text, bins, context=context, lang=lang)
    _append(call, "agent", reply)
    db.commit()
    return {"reply": reply, "call": serialize(call)}
