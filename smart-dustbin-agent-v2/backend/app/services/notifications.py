import smtplib, logging
from email.message import EmailMessage
from ..config import settings

log = logging.getLogger(__name__)

def recipients():
    emails = settings.admin_emails + settings.cleaning_emails
    phones = settings.admin_phones + settings.cleaning_phones
    return list(dict.fromkeys(emails)), list(dict.fromkeys(phones))

def send_email(subject, body):
    if not (settings.smtp_host and settings.alert_from_email and recipients()[0]):
        log.info("EMAIL DEMO: %s | %s", subject, body)
        return
    msg = EmailMessage()
    msg["Subject"], msg["From"] = subject, settings.alert_from_email
    msg["To"] = ", ".join(recipients()[0])
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)

def send_twilio_sms(body):
    emails, phones = recipients()
    if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number and phones):
        log.info("SMS DEMO to %s: %s", phones, body)
        return
    from twilio.rest import Client
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    for phone in phones:
        client.messages.create(to=phone, from_=settings.twilio_from_number, body=body)

def send_twilio_call(body):
    emails, phones = recipients()
    if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number and phones):
        log.info("PHONE CALL DEMO to %s: %s", phones, body)
        return
    from twilio.rest import Client
    from twilio.twiml.voice_response import VoiceResponse
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    response = VoiceResponse()
    response.say(body, voice="alice", language="en-US")
    for phone in phones:
        client.calls.create(to=phone, from_=settings.twilio_from_number, twiml=str(response))

def twilio_ready():
    return bool(settings.twilio_account_sid and settings.twilio_auth_token
                and settings.twilio_from_number and recipients()[1])

def notify_alert(db, message, severity, bin_id=None, fill=None, location=""):
    """Dispatch an alert. Every alert starts at 80%, so every alert places a call."""
    send_email(f"[{severity.upper()}] Smart Dustbin Alert", message)
    send_twilio_sms(message)
    if twilio_ready():
        send_twilio_call(message)
        channel = "twilio"
    else:
        # No telephony: ring the dashboard so the conversation still happens.
        channel = "browser"
    if bin_id is not None and fill is not None:
        from .calls import place_call
        place_call(db, bin_id, location, float(fill), severity, channel=channel)
