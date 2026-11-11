# Smart Dustbin Voice Agent — Application Guide

A complete, feature-by-feature reference for the Smart Dustbin fleet-monitoring
and voice-calling platform ("BinPulse"). This document explains **what each part
does, how it works, and how the pieces fit together** — the backend agent, the
React dashboard, the data feeds, the threshold engine, the AI voice assistant,
and the automated collection calls.

---

## 1. What the application is

The platform monitors a fleet of IoT smart dustbins (ESP32 + ultrasonic
fill sensors) deployed across public areas (modelled on 16 bins across five
Godavari river *ghats*). It:

- **Ingests live fill-level telemetry** from an upstream device API (via REST
  polling or a Server-Sent-Events stream).
- **Detects full bins** with a hysteresis threshold engine and raises severity-
  graded alerts.
- **Places an automated "collection call"** when a bin needs emptying — either
  on the real phone network (Twilio) or, by default, **ringing inside the
  dashboard** with speech in and out.
- **Answers natural-language questions** about the fleet through a grounded AI
  voice assistant (never invents numbers).
- **Presents everything** in a 17-screen React dashboard: live map, analytics,
  alerts, crew dispatch, device health, and administration.

---

## 2. High-level architecture

The system is deliberately split across **three origins**:

| Origin | Default address | Role | Needs API key |
|---|---|---|---|
| **Device / Fleet API** (`API_BASE`) | `http://37.27.53.14:8031` | Upstream IoT backend. Serves the 16-bin synthetic fleet + two data generators. | No (fleet); Yes (voice) |
| **Agent backend** (`AGENT_BASE`) | `http://37.27.53.14:8032` | *This project's* FastAPI service: threshold engine, alerts, AI assistant, collection calls. | — |
| **Dashboard** (frontend) | `http://37.27.53.14:5173` (dev) / `:3031` (preview) | React/Vite SPA. | — |

**Why two backends?** The dashboard reads raw fleet data **directly** from the
device API (`API_BASE`) so it keeps working even when the agent is down. Anything
only the agent can do — grounded answers, the hysteresis engine, alert history,
and calls — goes to `AGENT_BASE`, degrading gracefully to a local in-browser
simulation on failure.

```
 Upstream Device/Fleet API (:8031)
   ├── /api/fleet            (16-bin fleet snapshot)
   ├── /api/voice/stream     (SSE, single ESP32 bin, x-api-key)
   └── /api/sim , /api/fleet/sim  (synthetic data generators)
          │                                   ▲
          │ ingest (poll / SSE)               │ proxy (key hidden)
          ▼                                   │
 Agent backend — FastAPI (:8032)              │
   ├── ingestion: fleet.py / stream.py / poller.py
   ├── monitoring.py  → threshold + hysteresis engine
   ├── notifications.py → email / SMS / call dispatch
   ├── calls.py       → browser/Twilio voice calls
   ├── agents/        → LangGraph conversation + monitoring graphs (Groq LLM)
   └── SQLite / PostgreSQL (readings, alerts, events, voice_calls, threshold_states)
          ▲                                   ▲
          │ /api/calls, /api/voice, /api/alerts │ /api/fleet/* passthrough
          ▼                                   │
 React Dashboard (:5173) ──────────── reads fleet directly from :8031
   ├── FleetContext (3s poll, sim fallback)
   ├── 17 screens
   ├── CallOverlay (rings, speaks, listens)
   └── ChatWidget (grounded Q&A)
```

---

## 3. Backend features (FastAPI agent)

Source: `backend/app/`. Entry point: `app/main.py` (uvicorn, port 8032).

### 3.1 Startup lifecycle (`main.py` → `lifespan`)
On boot the agent:
1. Configures logging (ingest activity is logged at INFO).
2. Creates tables (`Base.metadata.create_all`) and runs `add_missing_columns()`
   — a lightweight auto-migration that adds any new nullable model columns to an
   existing database (not a substitute for Alembic).
3. Seeds demo data from `sample-data/` **only if the DB is empty**.
4. **Chooses one ingestion source, in priority order:**
   - **Fleet poller** (`fleet.start_fleet_poller`) — preferred, richest data.
   - **SSE stream** (`start_stream`) — the single real ESP32 voice unit.
   - **Generic poller** (`start_poller`) — fallback REST polling.
   The fleet poller and stream can run together; the generic poller only starts
   if neither did.

> **Key operational fact:** every ingestion path requires
> `UPSTREAM_API_BASE_URL` to be set. With no upstream URL the agent ingests
> **nothing** — no readings, no alerts, no calls. (This is exactly why a deployed
> agent with a missing env var returns an empty `/api/calls/active`.)

### 3.2 Data ingestion — three interchangeable sources

All three normalize their input into a common `BinReading` shape and feed the
**same** `process_reading()` threshold engine.

- **`services/fleet.py`** — polls `GET /api/fleet` every `FLEET_POLL_SECONDS`
  (default 15s). Maps 16 rich fleet records (zone, battery, rssi, temp, lat/lng,
  crew, density…) onto `BinReading` rows. Skips bins whose reading signature is
  unchanged. Derives online status from each bin's own `lastUpdateS` (the
  upstream `online` flag is unreliable — it flips false for most bins between
  generator ticks). Also acts as a **read-through proxy** and **generator
  controller** so the upstream API key never reaches the browser.

- **`services/stream.py`** — a resilient SSE consumer of
  `GET /api/voice/stream?interval=N`. Reconnects with capped exponential backoff,
  handles `status`/`alert`/`device` events, and **persists only changed
  readings** plus a periodic heartbeat (`PERSIST_HEARTBEAT_SECONDS`, default
  300s) — otherwise a 2-second feed would write ~43k rows/bin/day. Because
  duplicates are dropped, the "2 consecutive readings ≥80%" rule counts two
  distinct readings.

- **`services/poller.py`** — generic APScheduler REST poller
  (`POLL_INTERVAL_SECONDS`, default 60s), the fallback when neither richer source
  is active.

- **`services/upstream.py`** — shared helpers: `auth_headers()` (voice API uses
  `x-api-key`; others use `Authorization: Bearer`) and
  `normalize_upstream_payload()` (accepts a list of bins, or an object containing
  `bins`/`data`/`results`; tolerant of field-name variants like `fill`,
  `fill_percentage`, `fill_level`).

### 3.3 Threshold engine + hysteresis (`services/monitoring.py`)

The heart of the system — `process_reading(db, row)`:

1. Stores the reading.
2. Tracks per-bin `ThresholdState` (consecutive-high counter, last severity,
   whether an alert is open).
3. **Severity ladder** by fill %:
   | Fill | Severity |
   |---|---|
   | ≥ 100 % | `critical` |
   | ≥ 90 % | `high` |
   | ≥ 80 % | `medium` |
   | < 80 % | `normal` |
4. **Hysteresis / debounce:** an alert fires only after **2 consecutive readings
   ≥ 80 %** (`consecutive_high >= 2`) — this suppresses single-reading noise.
5. **Escalation:** re-alerts when severity changes (e.g. 80 % → 90 %) even if an
   alert is already open.
6. On a new escalation it builds a message via the **monitoring LangGraph**,
   writes an `Alert` + `THRESHOLD_ALERT` event, and calls `notify_alert(...)`.
7. **Recovery:** when fill drops below **75 %** it closes the alert, logs
   `ALERT_RECOVERED`, and **auto-hangs-up** any live call for that bin.
8. `mark_stale_bins()` flags bins with no reading in 60s as offline.

### 3.4 Alert dispatch (`services/notifications.py`)

`notify_alert()` fans an alert out across channels. **Telephony is best-effort
and isolated** — a failing email, SMS, or Twilio call must never stop the
dashboard call from ringing:

- `send_email()` — SMTP, or logs an `EMAIL DEMO` line if unconfigured.
- `send_twilio_sms()` — Twilio SMS, or logs `SMS DEMO`.
- `send_twilio_call()` — Twilio voice call with TwiML `<Say>`, or logs
  `PHONE CALL DEMO`.
- Finally, **always** calls `place_call(...)` to create a call record. If Twilio
  succeeded the channel is `twilio`; otherwise it rings in the browser.

Every channel is wrapped in try/except so one provider's failure (e.g. a Twilio
**trial** account rejecting a custom message) can't abort the alert. All
outbound notifications are disabled unless credentials + recipients are set —
demo mode just logs the attempts.

### 3.5 Automated collection calls (`services/calls.py`)

A bin crossing the alert threshold **places a call**. The `VoiceCall` record
drives a full two-way conversation. Key behaviours:

- **One live call per bin** — a bin that keeps reporting high won't ring
  repeatedly (`place_call` no-ops if a `ringing`/`active` call already exists).
- **Opening line** is generated from the bin's data, e.g. *"Hello, this is the
  automated smart dustbin agent. Bin BIN A1 at North gate is 84 percent full.
  Please arrange collection…"*
- **Lifecycle states:** `ringing` → `active` → `ended` / `missed`.
  - `answer_call()` connects and returns the opening turn.
  - `speak_turn()` records the caller's words, answers them **with the call's bin
    as context** through the grounded assistant, and stores the reply.
  - `end_call()` hangs up (`reason=declined` on a ringing call marks it
    `missed`).
  - `expire_stale()` auto-marks calls `missed` after `RING_TIMEOUT_SECONDS`
    (180s), so old alerts stop ringing.
  - `hang_up_for_bin()` ends a live call automatically when the bin is emptied.
- **Transcript** is stored as JSON turns (`role`, `text`, `at`) on the call.

### 3.6 AI voice assistant (`agents/conversation_graph.py`)

A **grounded** Q&A engine — the model can *never* invent fill levels:

1. `verified_answer()` computes the answer **deterministically from DB rows**
   (offline/sensor health, bins ≥80 %, collection confirmation, etc.). This is
   the source of truth.
2. If `GROQ_API_KEY` is set, `phrase_with_llm()` asks Groq's
   `openai/gpt-oss-120b` (a *reasoning* model) to **reword** the verified answer
   into natural spoken English — using only the supplied data.
3. On **any** failure (auth error, empty content, timeout, token exhaustion) it
   returns the verified answer verbatim — the assistant never goes silent and
   never fabricates.
4. `speakable()` strips markdown and exotic Unicode so text-to-speech reads
   cleanly.

Wrapped in a 2-node **LangGraph** (`retrieve` → `respond`). The monitoring graph
(`agents/monitoring_graph.py`) is a 1-node graph that composes alert text.

> **Reasoning-model caveat:** `gpt-oss` emits reasoning tokens before content.
> `GROQ_MAX_TOKENS` must stay well above the reasoning cost (default 512,
> `reasoning_effort=low`) or `content` comes back empty.

### 3.7 Speech-to-text (`/api/voice/transcribe`)
Accepts an uploaded audio clip and transcribes it with Groq Whisper
(`whisper-large-v3-turbo`). Requires `GROQ_API_KEY`.

### 3.8 Data model (`models.py`)

| Table | Purpose |
|---|---|
| `bin_readings` | Every stored reading. Core fields (fill, status, online) + rich fleet telemetry (zone, ghat_code, battery, rssi, temp, lat, lng, firmware…). |
| `alerts` | Severity-graded alert records (open/acknowledged). |
| `events` | Audit log: `THRESHOLD_ALERT`, `ALERT_RECOVERED`, `CALL_PLACED/ANSWERED/ENDED/MISSED`, `RESET`. |
| `voice_calls` | Call records: channel, state, opening line, JSON transcript, timestamps. |
| `threshold_states` | Per-bin hysteresis state (consecutive-high counter, last severity, alert-open flag). |

### 3.9 Database layer (`db.py`)
- **SQLite by default** (`smart_dustbin.db`), zero-config.
- Set `DATABASE_URL` to a `postgresql://` string for PostgreSQL/Neon — the layer
  auto-selects psycopg2 or psycopg3 (whichever is installed), and enables
  `pool_pre_ping` + 300s `pool_recycle` for Neon's idle-connection behaviour.
- `add_missing_columns()` adds new nullable model columns on startup.

### 3.10 Generator proxy & control (`main.py`, `fleet.py`)
The agent proxies the upstream's two synthetic generators so the dashboard uses
one origin and the key stays server-side:
- `GET /api/fleet/{resource}` — bins, stats, alerts, events, collections, crew,
  ghats, history.
- `GET/POST /api/sim/{single|fleet}/{status|start|stop|step}` — read and drive
  the generators.

---

## 4. Frontend features (React dashboard — "BinPulse")

Source: `frontend/src/`. Stack: React 18 + Vite 5 (no router — hash-based screen
switching; no CSS framework — custom `index.css`).

### 4.1 App shell (`App.jsx`)
- **Boot splash** ("Connecting to ESP32 sensor network…").
- **Sidebar + Topbar** navigation across 17 screens via `location.hash`.
- **Light/dark theme** toggle, persisted to `localStorage`.
- Cursor-tracking spotlight glow + 3D tilt micro-interactions.
- Mounts the global **CallOverlay** and **ChatWidget** on every screen.

### 4.2 Live data & simulation fallback (`state/FleetContext.jsx`)
A single provider polls the fleet every **3 seconds** and fans the data to every
screen. It fetches bins, events, alerts, history (and, every 5th tick, crew +
collections). **If the backend is unreachable** (offline, or an HTTPS page
blocking the HTTP backend) it transparently **falls back to a local client-side
simulation** (`data/model.js`) so the demo never goes blank. Commands (ack,
dispatch, collect, reset) are **optimistic** — applied locally at once, sent to
the backend, confirmed by the next poll.

### 4.3 The 17 screens

| Screen | What it shows |
|---|---|
| **Fleet Dashboard** | Headline KPIs, fleet overview, hotspots, live status. |
| **Bin Monitoring** | Searchable/filterable grid of all bins with fill glyphs. |
| **Bin Details** | Single-bin fill trend (last 16 reads), telemetry, actions. |
| **Live Map** | Geospatial map of bins by lat/lng, colour-coded by fill. |
| **Alerts & Notifications** | Active alert feed; acknowledge / ack-all. |
| **Collection Management** | Collection tasks and history. |
| **Cleaning Team (Crew)** | Crew roster and dispatch. |
| **AI Voice Assistant** | Ask the fleet questions by voice/text (grounded answers). |
| **Chat History** | Transcript of assistant conversations. |
| **Analytics & Reports** | Charts: fill trends, throughput, performance. |
| **Device Health** | Battery, RSSI, firmware, sensor status per device. |
| **Sensor Diagnostics** | Deeper sensor/fault inspection. |
| **User Management** | Users (admin). |
| **Roles & Permissions** | RBAC configuration (UI). |
| **API Integration** | Integration/config surface. |
| **Notification Settings** | Per-channel toggles (push/email/SMS/WhatsApp/webhook; full/fault/battery/offline; quiet hours). |
| **System Settings** | General app settings. |

### 4.4 In-browser collection call (`components/CallOverlay.jsx` + `lib/ringtone.js`)
The dashboard-delivered call experience, mounted globally:
- Polls `/api/calls/active` every 4s; when a `ringing` call appears it **rings**.
- **Ringtone** is synthesised with the Web Audio API (the classic 440 Hz + 480 Hz
  two-frequency telephone pair, 0.4s rings with a 2s pause) — no audio asset
  shipped. It also vibrates on supported devices. Because browsers suspend audio
  until a user gesture, the tone is primed on the first click/keypress and the UI
  tells the user when sound is still muted.
- **Answer** connects the call; the browser **speaks** the opening line
  (`speechSynthesis`, `en-IN`).
- The operator replies by **microphone** (`SpeechRecognition`, Chrome/Edge) or
  the **text box** (fallback everywhere). Each turn hits `/api/calls/{id}/say`,
  is answered by the grounded assistant, and read aloud.
- **Hands-free mode** auto-opens the mic after the agent finishes speaking.
- **Decline** suppresses that call for the session; **End call** hangs up. If the
  bin is emptied server-side, the overlay detects the call vanishing and closes
  itself.

### 4.5 Chat widget (`components/ChatWidget.jsx`)
A floating assistant available on every screen — the same grounded Q&A as the
Voice screen, via `POST /api/voice/query`.

---

## 5. API reference (agent backend, `:8032`)

**Monitoring & data**
- `GET /api/health` — liveness.
- `GET /api/status` / `GET /api/status?bin_id=BIN-A1` — latest reading per bin.
- `GET /api/device` — devices (same shape).
- `GET /api/alerts` — alert records.
- `GET /api/events` — audit events.
- `GET /api/history?bin_id=BIN-A1` — fill history for a bin.
- `GET /api/stream/state` — SSE consumer status (`configured`, `running`, `url`,
  `tracked_bins`).
- `GET /api/fleet/state` — fleet poller status.
- `POST /api/poll/run` / `POST /api/fleet/poll` — trigger a poll now.

**Voice assistant**
- `POST /api/voice/query` — `{ "text": "Which bins are above 80%?" }` → grounded
  answer.
- `POST /api/voice/transcribe` — multipart audio → text (Groq Whisper).

**Collection calls**
- `GET /api/calls/active` — calls ringing/connected now (dashboard polls this).
- `GET /api/calls` — recent calls with transcripts.
- `POST /api/calls/{id}/answer` — connect, returns opening turn.
- `POST /api/calls/{id}/say` — `{ "text": "where is this bin?" }` → agent reply.
- `POST /api/calls/{id}/end?reason=ended` — hang up (`reason=declined` = missed).

**Actions & proxy**
- `POST /api/reset` — `{ "bin_id": "BIN-A1", "confirmed": true }` — mark collected
  (reset to 0 %); requires `confirmed=true`.
- `GET /api/fleet/{resource}` — proxy (bins/stats/alerts/events/collections/crew/
  ghats/history).
- `GET/POST /api/sim/{single|fleet}/{status|start|stop|step}` — generator control.
- `WS /ws/updates` — refresh ping every 5s.

Interactive docs: `http://<agent-host>:8032/docs`.

---

## 6. Configuration (`backend/.env`)

All behaviour is env-driven (`app/config.py`). `load_dotenv(override=True)` makes
`backend/.env` authoritative over shell/machine variables. Key groups:

**Upstream ingestion** (required for *any* data to flow)
```env
UPSTREAM_API_BASE_URL=http://37.27.53.14:8031   # ← without this, nothing ingests
UPSTREAM_API_KEY=SmartD-secret-token            # sent as x-api-key (voice API)
UPSTREAM_STREAM_ENABLED=true
UPSTREAM_STREAM_PATH=/api/voice/stream
UPSTREAM_STREAM_INTERVAL=2
PERSIST_HEARTBEAT_SECONDS=300
FLEET_ENABLED=true
FLEET_PATH=/api/fleet
FLEET_POLL_SECONDS=15
FLEET_ONLINE_TOLERANCE_SECONDS=300
POLL_INTERVAL_SECONDS=60
```

**Groq AI** (optional — assistant degrades to deterministic answers without it)
```env
GROQ_API_KEY=gsk_...
GROQ_CHAT_MODEL=openai/gpt-oss-120b
GROQ_STT_MODEL=whisper-large-v3-turbo
GROQ_REASONING_EFFORT=low
GROQ_MAX_TOKENS=512
```

**Notifications** (optional — demo-logged if unset)
```env
SMTP_HOST= / SMTP_PORT= / SMTP_USER= / SMTP_PASSWORD= / ALERT_FROM_EMAIL=
ADMIN_EMAILS= / CLEANING_EMAILS=
TWILIO_ACCOUNT_SID= / TWILIO_AUTH_TOKEN= / TWILIO_FROM_NUMBER=
ADMIN_PHONE_NUMBERS= / CLEANING_PHONE_NUMBERS=
```

**Platform**
```env
DATABASE_URL=sqlite:///./smart_dustbin.db   # or postgresql://... (Neon)
PUBLIC_HOST=37.27.53.14                      # adds a deployment origin to CORS
CORS_ORIGINS=                                # set to replace the CORS list outright
LOG_LEVEL=INFO
```

> Keep real credentials in `backend/.env` (gitignored). `backend/.env.example`
> is tracked — placeholders only.

---

## 7. Running the application

### Local (demo mode)
```bash
# Backend
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8032

# Frontend (second terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Docker Compose
```bash
docker compose up --build
# backend :8032, frontend :5173, reads backend/.env
```

### Verifying ingestion
```bash
curl http://<host>:8032/api/stream/state   # expect configured:true, running:true
curl http://<host>:8032/api/fleet/state    # expect configured:true, running:true
curl http://<host>:8032/api/status         # expect bins with fill levels
curl http://<host>:8032/api/calls/active   # populates once a bin holds ≥80% for 2 reads
```

---

## 8. End-to-end flow: from full bin to answered call

1. A bin fills; the upstream reports ≥80 %.
2. The agent ingests the reading (fleet poll / SSE).
3. `process_reading` increments the consecutive-high counter. On the **2nd**
   consecutive reading ≥80 % it opens an alert (severity by fill level).
4. `notify_alert` sends email/SMS/Twilio **best-effort**, then **always** places
   a `VoiceCall`.
5. Within ~5s the dashboard's `CallOverlay` sees the ringing call and **rings**.
6. The operator presses **Answer** → the browser speaks the opening line.
7. The operator asks questions (mic/text) → each turn is answered by the grounded
   assistant **scoped to that bin** → read aloud.
8. The crew empties the bin; fill drops below 75 % → the alert recovers and the
   call **auto-ends** → `ALERT_RECOVERED` + `CALL_ENDED` logged.

---

## 9. Operational gotchas (learned in practice)

- **Empty `/api/calls/active` on a deployment almost always means
  `UPSTREAM_API_BASE_URL` is unset in that environment.** No upstream → no
  readings → no threshold crossings → no calls. Confirm with
  `/api/stream/state` and `/api/fleet/state`: `configured:false` / `url:null`
  pinpoints the missing variable. (The dashboard can still show bins because the
  frontend reads the device API directly, bypassing the agent.)
- **Twilio trial accounts** reject custom messages; the best-effort dispatch
  means the browser call still rings regardless.
- **Upstream `online` is unreliable** and **`battery` reads 0** for all bins
  after long generator uptime — both are known synthetic-data traits, handled in
  `fleet.py`.
- **Speech needs a user gesture** — the agent only speaks after **Answer** is
  pressed; recognition needs Chrome/Edge (text box is the universal fallback).

---

## 10. Production checklist

- Add authentication + RBAC (the Users/Roles screens are UI scaffolding only).
- Protect reset/collection actions behind authenticated confirmation.
- Run the ingestion poller as a dedicated worker (not inside an API replica) to
  avoid duplicate pollers when scaling.
- Move off SQLite to PostgreSQL; adopt Alembic before schema changes on real
  data.
- Configure TLS, secrets management, retries, monitoring, and backups.
