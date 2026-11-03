# Smart Dustbin Voice Agent

A runnable starter project built around the supplied `sample-data.zip`.

## Features
- React dashboard with live fleet status and alert feed.
- FastAPI backend with demo data loaded from `sample-data/`.
- Polling worker that fetches an upstream REST API every 60 seconds when configured.
- Threshold engine: requires 2 consecutive readings >= 80% before creating a full alert; escalates at 90% and 100%; stale readings are marked offline.
- LangGraph conversation workflow (with a safe deterministic fallback if no Groq key is configured).
- Groq Whisper STT and Groq-hosted Llama response generation when configured.
- Email/SMS/automated phone-call integration hooks (SMTP and Twilio).
- Dashboard updates through polling API endpoints (WebSocket endpoint also provided).

## 1. Requirements
- Python 3.10+
- Node.js 18+
- Optional: PostgreSQL, Groq API key, Twilio account, SMTP account.
- Docker and Docker Compose are optional.

## 2. Quick start (demo mode)
### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
Demo mode uses the included sample data. API docs: http://localhost:8000/docs

### Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## 3. Configure upstream API polling
Edit `backend/.env`:
```env
UPSTREAM_API_BASE_URL=https://your-dustbin-server.example
UPSTREAM_STATUS_PATH=/api/status
UPSTREAM_DEVICE_PATH=/api/device
UPSTREAM_HISTORY_PATH=/api/history
UPSTREAM_API_TOKEN=replace_me
POLL_INTERVAL_SECONDS=60
```
The poller calls `GET {BASE_URL}{STATUS_PATH}`. It accepts either a list of bin objects or an object containing `bins`, `data`, or `results`.
Expected fields per bin: `device_id` or `bin_id`, `fill` or `fill_percentage`, and optionally `location`, `status`, `alert`, `online`, `updated`, `ts`, `device`.
If your real API uses a different schema, adapt `backend/app/services/upstream.py` in `normalize_upstream_payload()`.

## 4. Configure Groq
Set `GROQ_API_KEY` in `.env`. The starter uses `llama-3.3-70b-versatile` as a configurable default; verify the model is enabled for your Groq account before use. Speech transcription uses `whisper-large-v3-turbo`.
Set `GROQ_CHAT_MODEL` if you use a different currently supported model.

## 5. Notifications
- Dashboard: available through `/api/alerts`.
- Email: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_FROM_EMAIL`, `ADMIN_EMAILS`, `CLEANING_EMAILS`.
- SMS and phone calls: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ADMIN_PHONE_NUMBERS`, `CLEANING_PHONE_NUMBERS`.
- Phone calls use Twilio's built-in TwiML voice message. Groq TTS audio is not automatically inserted into phone calls in this starter.
- All outbound notifications are disabled unless credentials/recipients are configured. Demo mode logs notification attempts instead of sending them.

## 6. API endpoints
- `GET /api/health`
- `GET /api/status`
- `GET /api/status?bin_id=BIN-A1`
- `GET /api/device`
- `GET /api/alerts`
- `GET /api/events`
- `GET /api/history?bin_id=BIN-A1`
- `POST /api/voice/query` JSON `{ "text": "Which bins are above 80%?" }`
- `POST /api/voice/transcribe` multipart audio file
- `POST /api/reset` JSON `{ "bin_id": "BIN-A1", "confirmed": true }`
- `POST /api/poll/run` manually trigger upstream poll
- `WS /ws/updates`

## 7. Safety / production notes
- Sample readings are synthetic.
- Add authentication and role-based authorization before deployment.
- Protect reset/collection actions with authenticated confirmation.
- Configure TLS, secrets management, retries, monitoring, database backups, and notification delivery records.
- The poller is started inside the FastAPI process for local development. In production, run it as a dedicated worker to avoid duplicate pollers when scaling API replicas.
- The SQLite database is the zero-configuration default. Set `DATABASE_URL` to a PostgreSQL SQLAlchemy URL to use PostgreSQL.
