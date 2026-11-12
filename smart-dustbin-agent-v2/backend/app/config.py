import os
from dotenv import load_dotenv

# override=True so backend/.env is authoritative. Without it, a stale shell or
# machine-level variable (GROQ_API_KEY, DATABASE_URL) silently wins over the file.
load_dotenv(override=True)

def csv_env(name: str):
    return [x.strip() for x in os.getenv(name, "").split(",") if x.strip()]

class Settings:
    app_env = os.getenv("APP_ENV", "development")
    log_level = os.getenv("LOG_LEVEL", "INFO")
    # 5173 is `vite dev`, 3031 is `vite preview` (npm start). Both must be allowed
    # or the dashboard's calls to this agent fail CORS and fall back silently.
    #
    # CORS compares the Origin header as an exact string, so "localhost",
    # "127.0.0.1" and a public IP are three different origins even when they
    # reach the same server. Every host the dashboard is actually opened from
    # has to be listed. Set PUBLIC_HOST to add a deployment's address, or
    # CORS_ORIGINS to replace this list outright.
    public_host = os.getenv("PUBLIC_HOST", "37.27.53.14")
    # The dashboard is served over HTTPS from its Cloudflare subdomain, so that
    # exact origin must be allowed or every call to this agent fails CORS. Add
    # more deployment origins with CORS_ORIGINS (which replaces this list).
    cors_origins = csv_env("CORS_ORIGINS") or [
        "https://smartgcfe.coarchitive.com",
    ] + [
        f"http://{host}:{port}"
        for host in ("localhost", "127.0.0.1", public_host)
        for port in (5173, 3031)
    ]
    database_url = os.getenv("DATABASE_URL", "sqlite:///./smart_dustbin.db")
    poll_interval_seconds = int(os.getenv("POLL_INTERVAL_SECONDS", "60"))
    upstream_api_base_url = os.getenv("UPSTREAM_API_BASE_URL", "").rstrip("/")
    upstream_status_path = os.getenv("UPSTREAM_STATUS_PATH", "/api/status")
    upstream_device_path = os.getenv("UPSTREAM_DEVICE_PATH", "/api/device")
    upstream_history_path = os.getenv("UPSTREAM_HISTORY_PATH", "/api/history")
    upstream_api_token = os.getenv("UPSTREAM_API_TOKEN", "")
    upstream_api_key = os.getenv("UPSTREAM_API_KEY", "")
    upstream_timeout_seconds = float(os.getenv("UPSTREAM_TIMEOUT_SECONDS", "15"))
    # Fleet feed: 16 synthetic bins with coordinates, battery and crew. Richer than
    # the single-bin voice stream, so it is the preferred source when available.
    fleet_enabled = os.getenv("FLEET_ENABLED", "true").lower() == "true"
    fleet_path = os.getenv("FLEET_PATH", "/api/fleet")
    fleet_poll_seconds = int(os.getenv("FLEET_POLL_SECONDS", "15"))
    # The upstream fleet generator refreshes only a bin or two per tick, so its
    # own `online` flag reads false for most bins at any instant even while they
    # report normally. Judge freshness from the bin's own lastUpdateS instead.
    fleet_online_tolerance_seconds = int(os.getenv("FLEET_ONLINE_TOLERANCE_SECONDS", "300"))
    upstream_stream_enabled = os.getenv("UPSTREAM_STREAM_ENABLED", "true").lower() == "true"
    upstream_stream_path = os.getenv("UPSTREAM_STREAM_PATH", "/api/voice/stream")
    upstream_stream_interval = int(os.getenv("UPSTREAM_STREAM_INTERVAL", "2"))
    # The stream repeats the same reading every interval. Persist only changed
    # readings, plus a heartbeat row this often, to bound database growth.
    persist_heartbeat_seconds = int(os.getenv("PERSIST_HEARTBEAT_SECONDS", "300"))
    # Sarvam AI TTS — Indian-language neural voices, used in preference to the
    # keyless engines when a key is present. `bulbul:v2` is deprecated upstream.
    # An operator can only take one call at a time. Without a cap, a fleet where
    # several bins cross 80% at once queues a call per bin and they ring back to
    # back. The Alert records still exist, so capping loses no information.
    max_concurrent_calls = int(os.getenv("MAX_CONCURRENT_CALLS", "1"))
    sarvam_api_key = os.getenv("SARVAM_API_KEY", "")
    sarvam_model = os.getenv("SARVAM_TTS_MODEL", "bulbul:v3")
    sarvam_speaker = os.getenv("SARVAM_TTS_SPEAKER", "ritu")
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    groq_chat_model = os.getenv("GROQ_CHAT_MODEL", "openai/gpt-oss-120b")
    groq_stt_model = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")
    groq_reasoning_effort = os.getenv("GROQ_REASONING_EFFORT", "low")
    groq_max_tokens = int(os.getenv("GROQ_MAX_TOKENS", "512"))
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
