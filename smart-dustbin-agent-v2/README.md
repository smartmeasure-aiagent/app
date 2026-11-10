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
uvicorn app.main:app --reload --port 8032
```
Demo mode uses the included sample data. API docs: http://37.27.53.14:8032/docs

### Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://37.27.53.14:5173

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

## 3b. Voice API upstream (SSE stream)
The deployed voice API exposes a live SSE feed, which this backend consumes instead of polling:
```env
UPSTREAM_API_BASE_URL=http://HOST:8031
UPSTREAM_API_KEY=your-secret-token      # sent as the x-api-key header
UPSTREAM_STATUS_PATH=/api/voice/status
UPSTREAM_STREAM_ENABLED=true
UPSTREAM_STREAM_PATH=/api/voice/stream
UPSTREAM_STREAM_INTERVAL=2
PERSIST_HEARTBEAT_SECONDS=300
```
- Authentication: `UPSTREAM_API_KEY` becomes `x-api-key`; `UPSTREAM_API_TOKEN` becomes `Authorization: Bearer`. The voice API uses the former and returns `401` without it.
- `backend/app/services/stream.py` consumes `status`, `alert` and `device` events, normalizes each through `normalize_upstream_payload()`, and feeds the same threshold engine as polling. It reconnects with capped exponential backoff.
- When the stream is enabled and a base URL is set, the APScheduler poller does not start, so readings are not recorded twice. Disable the stream to fall back to polling.
- The feed repeats the current reading every `UPSTREAM_STREAM_INTERVAL` seconds. Only *changed* readings are stored, plus one heartbeat row per `PERSIST_HEARTBEAT_SECONDS`; otherwise a 2-second feed would write ~43k rows per bin per day.
- Because duplicates are dropped, the "2 consecutive readings >= 80%" rule counts two consecutive *distinct* readings.
- `GET /api/stream/state` reports whether the consumer is connected and which bins it has seen.

## 3d. Fleet feed and synthetic data generators
The upstream runs two independent synthetic generators. The **fleet** one models 16 bins across 5 Godavari ghats and is far richer than the single-bin voice stream — it carries coordinates, battery, zone, crew and density — so it is the preferred source.
```env
FLEET_ENABLED=true
FLEET_PATH=/api/fleet
FLEET_POLL_SECONDS=10
FLEET_ONLINE_TOLERANCE_SECONDS=300
```
- `services/fleet.py` polls `GET /api/fleet`, maps each record onto a `BinReading`, and feeds the same threshold engine. Unchanged bins are not rewritten.
- `BinReading` carries the extra fleet fields (`zone`, `ghat_code`, `density`, `team`, `battery`, `rssi`, `temp`, `lat`, `lng`, …). They are null for voice-stream readings, which do not report them.
- Fleet endpoints need **no API key**; the voice endpoints do. `auth_headers()` is sent either way and is harmless.
- Both feeds can run together: the fleet covers the 16 synthetic bins, the voice stream covers `BIN-SIM-01`.

### Reading and controlling the generators through this backend
The dashboard talks to one origin, and the upstream key never reaches the browser:
```bash
curl 37.27.53.14:8032/api/fleet/state              # is our poller running?
curl 37.27.53.14:8032/api/fleet/stats              # passthrough: totals from upstream
curl 37.27.53.14:8032/api/fleet/crew               # also: bins, alerts, events, collections, ghats, history
curl 37.27.53.14:8032/api/sim/fleet/status         # generator config and run stats
curl -X POST 37.27.53.14:8032/api/sim/fleet/start -H 'Content-Type: application/json' \
     -d '{"interval":1,"surge":3}'               # target: 'fleet' or 'single'
curl -X POST 37.27.53.14:8032/api/sim/single/stop
```

### Upstream data-quality traits worth knowing
- **`online` is unreliable.** The fleet generator refreshes only a bin or two per tick, so its `online` flag reads false for most bins at any instant even while they report normally — `lastUpdateS` reaches 200s+. We therefore derive reachability from `lastUpdateS` against `FLEET_ONLINE_TOLERANCE_SECONDS` rather than trusting the flag, which would otherwise mark a healthy fleet offline.
- **`battery` is 0 for all 16 bins.** That is genuine simulated decay after ~20 hours of generator uptime; no recharge is modelled. Treat battery and `lowBattery` as unusable until the upstream resets its snapshot.
- Posting Swagger's placeholder values to `/api/sim/start` (`device_id: "string"`, `fault_chance: 1.0`, `bin_height: 1.0`) wedges the single-bin generator: it produces faults forever and zero readings, and ingests a bin literally named `string`. Restart it with real values if `/api/sim/single/status` looks like that.

## 3c. Watching the data arrive
The backend logs every stored reading at `INFO`, so the console is the fastest way to confirm ingest:
```
13:15:16 INFO  app.services.stream: status BIN-SIM-01  99.0% FULL - COLLECT NOW  OFFLINE/FAULT
13:15:18 INFO  app.services.notifications: EMAIL DEMO: [CRITICAL] Smart Dustbin Alert | ...
13:15:28 INFO  app.services.stream: status BIN-SIM-01   0.0% WAITING             online
```
Only *changed* readings are logged, because only those are stored. Set `LOG_LEVEL=DEBUG` to also see the suppressed duplicates, or `LOG_LEVEL=WARNING` for a quiet console.

Other views, in increasing order of detail:
```bash
curl http://37.27.53.14:8032/api/stream/state   # is the consumer connected?
curl http://37.27.53.14:8032/api/status         # current reading per bin
curl http://37.27.53.14:8032/api/alerts         # alert records
curl http://37.27.53.14:8032/api/events         # THRESHOLD_ALERT / ALERT_RECOVERED / RESET
```
The dashboard at http://37.27.53.14:5173 refreshes every 5 seconds. To watch the upstream feed raw, bypassing this backend entirely:
```bash
curl -N "$UPSTREAM_API_BASE_URL/api/voice/stream?interval=2" -H "x-api-key: $UPSTREAM_API_KEY"
```
If nothing changes, the device is idle — run `simulator.py` on the upstream host to generate fill cycles.

## 4. Configure Groq
Set `GROQ_API_KEY` in `.env`. The default chat model is `openai/gpt-oss-120b`; speech transcription uses `whisper-large-v3-turbo`. Set `GROQ_CHAT_MODEL` to use a different model.
```env
GROQ_API_KEY=gsk_...
GROQ_CHAT_MODEL=openai/gpt-oss-120b
GROQ_REASONING_EFFORT=low
GROQ_MAX_TOKENS=512
```
- `gpt-oss` is a **reasoning** model: it emits reasoning tokens before any content. If `GROQ_MAX_TOKENS` is too low, the reply finishes with `length` and `content` comes back empty, so keep the budget well above the reasoning cost. `reasoning_effort=low` answers these queries in roughly 40 reasoning tokens; `medium` roughly doubles that for no gain here.
- `reasoning_effort` requires `langchain-groq >= 1.0`. The pinned `1.1.2` supports it.
- The model only **rephrases** an answer already computed from database rows. On any failure — auth error, empty content, timeout — `phrase_with_llm()` returns the deterministic answer verbatim, so the assistant never goes silent and never invents readings.
- Replies pass through `speakable()`, which strips markdown and exotic Unicode punctuation that text-to-speech reads badly.

> `config.py` calls `load_dotenv(override=True)`, so `backend/.env` takes precedence over shell and machine-level variables. This prevents a stale `GROQ_API_KEY` or `DATABASE_URL` in the OS environment from silently winning, but it also means you must edit `.env` to change a value — exporting a variable in the shell will not override the file.

## 5. Notifications
- Dashboard: available through `/api/alerts`.
- Email: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_FROM_EMAIL`, `ADMIN_EMAILS`, `CLEANING_EMAILS`.
- SMS and phone calls: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ADMIN_PHONE_NUMBERS`, `CLEANING_PHONE_NUMBERS`.
- Phone calls use Twilio's built-in TwiML voice message. Groq TTS audio is not automatically inserted into phone calls in this starter.
- All outbound notifications are disabled unless credentials/recipients are configured. Demo mode logs notification attempts instead of sending them.

## 5b. Automatic collection calls
When a bin opens an alert (two consecutive readings at or above 80%), the backend **places a call**. Previously calls went out only at 90% and above; now every alert calls, because every alert starts at 80%.

Delivery depends on configuration:
- **Twilio configured** — the call is dialled on the phone network as before.
- **Twilio not configured** — the call rings in the dashboard instead, so the conversation still happens. This is the default.

The in-browser call:
1. A `ringing` call appears within ~5s (the dashboard polls `/api/calls/active`).
2. The operator presses **Answer**. The browser speaks the opening line — *"Bin BIN A1 at North gate is 84 percent full. Please arrange collection."*
3. The operator replies by microphone or keyboard. Each turn goes to `POST /api/calls/{id}/say`, is answered by the grounded assistant **with the call's bin as context**, and is read aloud.
4. **End call** hangs up. The full transcript is stored on the call record.

Behavior worth knowing:
- Only one live call per bin — a bin that keeps reporting high does not ring repeatedly.
- Emptying a bin (fill below 75%) ends its live call automatically and logs `CALL_ENDED`.
- A call left ringing for 3 minutes (`RING_TIMEOUT_SECONDS`) becomes `missed`, so old alerts stop ringing.
- Declining marks the call missed and suppresses it for that browser session.
- Speech uses the browser's Web Speech API. Synthesis needs a user gesture, which is why the agent only speaks after **Answer** is pressed. Recognition needs Chrome or Edge; the text box is the fallback everywhere else.

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
- `GET /api/stream/state` upstream SSE consumer status
- `GET /api/calls/active` calls ringing or connected now
- `GET /api/calls` recent call records with transcripts
- `POST /api/calls/{id}/answer` connect, returns the agent's opening turn
- `POST /api/calls/{id}/say` JSON `{ "text": "where is this bin?" }`
- `POST /api/calls/{id}/end?reason=ended` hang up (`reason=declined` marks it missed)
- `WS /ws/updates`

## 7. Safety / production notes
- Sample readings are synthetic.
- Add authentication and role-based authorization before deployment.
- Protect reset/collection actions with authenticated confirmation.
- Configure TLS, secrets management, retries, monitoring, database backups, and notification delivery records.
- The poller is started inside the FastAPI process for local development. In production, run it as a dedicated worker to avoid duplicate pollers when scaling API replicas.
- The SQLite database is the zero-configuration default. Set `DATABASE_URL` to a PostgreSQL SQLAlchemy URL to use PostgreSQL.

## 8. PostgreSQL / Neon
Set `DATABASE_URL` in `backend/.env` to the connection string, keeping `sslmode=require`:
```env
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```
- `psycopg2-binary` is in `requirements.txt` and is the driver SQLAlchemy selects for a `postgresql://` URL.
- Use the `-pooler` host for the API process; use the direct (non-pooler) host for migrations.
- The engine sets `pool_pre_ping` and a 300s `pool_recycle` because Neon closes idle connections and scales compute to zero.
- Tables are created on startup by `Base.metadata.create_all`. Adopt Alembic before changing the schema on a database holding real data.
- Keep real credentials in `backend/.env`, which is gitignored. `backend/.env.example` is tracked — only placeholders belong there.
