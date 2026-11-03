import os
from dotenv import load_dotenv

load_dotenv()

def csv_env(name: str):
    return [x.strip() for x in os.getenv(name, "").split(",") if x.strip()]

class Settings:
    app_env = os.getenv("APP_ENV", "development")
    database_url = os.getenv("DATABASE_URL", "sqlite:///./smart_dustbin.db")
    poll_interval_seconds = int(os.getenv("POLL_INTERVAL_SECONDS", "60"))
    upstream_api_base_url = os.getenv("UPSTREAM_API_BASE_URL", "").rstrip("/")
    upstream_status_path = os.getenv("UPSTREAM_STATUS_PATH", "/api/status")
    upstream_device_path = os.getenv("UPSTREAM_DEVICE_PATH", "/api/device")
    upstream_history_path = os.getenv("UPSTREAM_HISTORY_PATH", "/api/history")
    upstream_api_token = os.getenv("UPSTREAM_API_TOKEN", "")
    upstream_timeout_seconds = float(os.getenv("UPSTREAM_TIMEOUT_SECONDS", "15"))
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    groq_chat_model = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
    groq_stt_model = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    alert_from_email = os.getenv("ALERT_FROM_EMAIL", "")
    admin_emails = csv_env("ADMIN_EMAILS")
    cleaning_emails = csv_env("CLEANING_EMAILS")
    twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_from_number = os.getenv("TWILIO_FROM_NUMBER", "")
    admin_phones = csv_env("ADMIN_PHONE_NUMBERS")
    cleaning_phones = csv_env("CLEANING_PHONE_NUMBERS")

settings = Settings()
