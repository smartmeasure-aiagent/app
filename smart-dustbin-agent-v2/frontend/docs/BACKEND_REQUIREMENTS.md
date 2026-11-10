# BinPulse — Backend Requirements

_Last updated: 2026-11-09_

> **Project:** BinPulse Smart Waste Console — RTIH Innovation Challenge **PS07** (Waste Collection & Environmental Cleanliness), **Godavari Pushkaralu 2027**, Rajamahendravaram.
> **Scope of this doc:** the server-side platform that drives the console from real ESP32 bins and live operations data. The React frontend fixes the data contract; this spec says what the backend must deliver — and tracks what the existing **`smart-dustbin`** backend already provides versus what is still to build.

**Status legend:** ✅ built (in `smart-dustbin`) · 🟡 partial · ⬜ to build.

---

## 1. Purpose & scope

The BinPulse frontend runs today on simulated data generated in the browser (`src/data/model.js`, `src/state/FleetContext.jsx`). A companion backend, **`smart-dustbin`** (FastAPI + SQLite), already exists and can drive the dashboard from either a real ESP32 bin or its own **synthetic data generators** — see §3. Going fully live means the backend must:

1. **Ingest** telemetry from the physical ESP32 smart bins deployed along the Godavari ghats. 🟡 _(HTTP ingest today; MQTT/TLS to build)_
2. **Generate** realistic telemetry on demand for demos, UI dev and load testing. ✅
3. **Persist** bin state, sensor history, alerts, collections, crew and admin data. ✅ _(SQLite)_
4. **Serve** the frontend a live fleet snapshot, event/alert stream, history and analytics. ✅ _(polling; realtime push ⬜)_
5. **Accept commands** — acknowledge alert, dispatch crew, mark bin collected (reset), change settings. 🟡
6. **Answer natural-language queries** for the voice/chat assistant from live data. ⬜
7. **Enforce** authentication, role-based access and API-key access for integrations. ⬜

The target deployment is a **mass-gathering event** (millions of pilgrims over the Pushkaralu days), so the backend must stay correct and responsive under crowd-driven fill surges, patchy field connectivity and bursty device traffic.

---

## 2. System context & architecture

```
ESP32 bin / simulator ──(HTTP POST today · MQTT/TLS target)──▶  FastAPI ingest
                                                                    │
Synthetic generators (single-bin + fleet) ─────────────────────────┤
                                                                    ▼
                                                        SQLite (WAL)  ── scale path ──▶  Postgres + time-series
                                                                    │
   React console ◀──(REST polling today · SSE/WebSocket target)──  Application API
   Next.js dashboard / crew mobile / IVR / WhatsApp ◀──────────────┘
                                                                    ▼
                                        Notifications (push / SMS / WhatsApp / webhook) ⬜
```

**Logical components**

| Component | Responsibility | Status |
|---|---|---|
| **Ingestion** | Accept device telemetry (HTTP now; MQTT broker + TLS target), authenticate devices, validate & store. | 🟡 |
| **Synthetic generators** | Produce realistic single-bin and fleet telemetry on a scheduler; feed the same live endpoints. | ✅ |
| **Rules processor** | Derive status, detect threshold crossings (full / low-battery / fault / offline), emit events & alerts. | ✅ |
| **Application API** | REST endpoints the console and partner apps consume. | ✅ (REST) / ⬜ (realtime) |
| **Datastores** | SQLite (WAL) today; Postgres + time-series store at event scale. | 🟡 |
| **Assistant service** | Natural-language query answering over live fleet state. | ⬜ |
| **Notification service** | Fan-out to push / SMS / WhatsApp / webhook per user preferences. | ⬜ |
| **Auth & RBAC** | User login, sessions/JWT, role permissions, API-key issuance. | ⬜ |

---

## 3. Synthetic data generation (existing backend)

The `smart-dustbin` backend can generate its own telemetry and store it in **SQLite**, so the console (and partner apps) run with realistic data without a physical device. Two independent generators, each with a start/stop scheduler, **off by default**:

| Generator | Models | Control prefix | Feeds |
|---|---|---|---|
| **Single-bin** | the one real ESP32 bin (`BIN-A1`) | `/api/sim/*` | `/api/status`, `/api/history`, `/api/stats`, `/api/events` |
| **Fleet (BinPulse)** | 16 bins across 5 Godavari ghats | `/api/fleet/sim/*` | `/api/fleet`, `/api/fleet/stats`, `/api/fleet/history`, `/api/fleet/events`, `/api/fleet/alerts`, … |

**Running it**

```bash
cd smart-dustbin
pip install -r requirements.txt     # stdlib sqlite3 — no extra deps
python app.py                       # serves on http://0.0.0.0:5000
```

Optional auto-start on boot: `SYNTH_AUTOSTART=1` (single-bin), `FLEET_AUTOSTART=1` (fleet). Storage lives in `smart-dustbin/dustbin.db` (created automatically; delete to reset).

**Single-bin generator** mimics the firmware — a natural fill-up → **FULL** → collect cycle with occasional sensor faults and heartbeats — and feeds the same live state the dashboard reads. Start body (all optional): `interval` (3.0s), `speed` (%/tick, 0 = random 2–6%), `fault_chance` (0.04), `bin_height` (60cm), `device_id`, `fw`, `auto_collect` (true), `cycles` (0 = ∞), `duration_s` (0 = ∞). Extra controls: `POST /api/sim/step` (one reading on demand), `GET /api/sim/data`, `POST /api/sim/clear`.

**Fleet generator** produces the multi-bin PS07 fleet with density-driven fill rates, alerts, events, collections and crew. Start body (all optional): `interval` (3.0s), `fault_chance` (0.015), `auto_collect` (true), `surge` (crowd-surge fill multiplier, e.g. `4` = peak bathing window). `POST /api/fleet/sim/step` advances the whole fleet one tick.

```bash
# fast demo then stop (single bin)
curl -X POST 37.27.53.14:5000/api/sim/start -H 'Content-Type: application/json' \
  -d '{"interval":1,"speed":8,"fault_chance":0.02}'
curl 37.27.53.14:5000/api/status
curl -X POST 37.27.53.14:5000/api/sim/stop

# busy fleet, dispatch, collect
curl -X POST 37.27.53.14:5000/api/fleet/sim/start -H 'Content-Type: application/json' -d '{"interval":2,"surge":3}'
curl 37.27.53.14:5000/api/fleet/stats
curl -X POST 37.27.53.14:5000/api/fleet/dispatch -H 'Content-Type: application/json' -d '{"bin":"BIN-A1","team":"Team Alpha"}'
curl -X POST 37.27.53.14:5000/api/fleet/bins/BIN-A1/collect
```

---

## 4. Device layer — ESP32 ingestion requirements

Each bin (`BIN-A1` is the real reference unit) reports an **ultrasonic fill sensor** plus health metrics.

- **Protocol:** real device + `simulator.py` post telemetry over **HTTP** today ✅; add **MQTT (TLS, preferred)** for the field deployment with a small, battery-friendly payload and configurable report interval. ⬜
- **Authenticate every device** — per-device credential/token or client certificate; reject unknown device IDs. ⬜
- **Ingest payload fields** (→ bin model in §5): `fill %`, `battery %`, `rssi (dBm)`, `temp (°C)`, `echo` (ultrasonic distance), `firmware`, `failedReads`, timestamp. ✅
- **Derive & store** `online` (seen within a staleness window), `lastUpdateS`, `sensorOk` (false after N failed ultrasonic reads). ✅
- **Idempotency & ordering, buffered backfill:** de-dupe retries, tolerate out-of-order and queued-while-offline batches. ⬜
- **Device management:** provisioning/registration, remote config (interval, thresholds), **OTA firmware** rollout with version tracking. ⬜
- **Time-series retention:** keep per-bin history to back the 24-hour trend and analytics (§8). ✅ _(SQLite)_

---

## 5. Core data model (entities)

Field names are the exact contract the frontend expects (`makeFleet()` / `fleetStats()`), already served by the fleet generator.

### Bin (live fleet record) — `GET /api/fleet`
```
id, name, sector, zone, ghatCode, density, type, team, capacity, fill, distance,
battery, rssi, temp, fillRate, echo, failedReads, firmware, online, sensorOk,
lastUpdateS, isReal, lat, lng, heading, x, y, spark
```
- **density** — `Red` (hyper-crowded, fills fastest, 10-min SLA) · `Yellow` (20-min) · `Green` (45-min).
- **zone / ghatCode** — Durgamma (G1), Godavari River (G3), Nitya Aarti (G4), Pushkar (G5), Padmavathi (G6). Grid cells 100 m × 100 m.
- **lat / lng / heading** — real Godavari-bund coordinates + Street-View heading.
- **spark** — recent fill samples for the mini-trend. **isReal** — `true` for `BIN-A1`.

### Ghat / zone reference — `GET /api/fleet/ghats`
Code (G1–G6), `lat`, `lng`, `heading` per ghat.

### Density band (PS07 Grid Allocation Framework)
`Red` 25 m spacing / 10-min check · `Yellow` 50 m / 20 min · `Green` 100 m / 45 min. Drives bin placement density and SLA intervals.

### Reading (time-series)
Per-bin timestamped `fill`, `battery`, `rssi`, `temp`, `echo` — source of truth for trend/history/analytics.

### Alert (derived) — evaluated every tick, de-duplicated per bin+type
| Condition | Severity | Type |
|---|---|---|
| `fill ≥ 80` | crit | Bin full |
| `!sensorOk` | warn | Sensor fault |
| `battery < 30` | warn | Low battery |
| `!online` | info | Bin offline |

### Event (live feed)
`id`, `type`, `severity`, `icon`, `bin`, `ts`, `detail` — sensor reading, bin full, collection completed, team dispatched, low battery, offline.

### Collection / dispatch
Ticket: bin, assigned team, status (queued/en route/completed), timestamps, ETA. A completed collection **resets the bin fill to 0**.

### Crew
name, team (Alpha–Echo), ghat/zone, shift (Morning/Evening), stops count, status (On route/Available/Off shift).

### User / Role / Permission ⬜
Users: name, email, role, status, last-seen. Roles: **Admin, Dispatcher, Operator, Analyst, Viewer** over permissions: _View fleet, Dispatch crews, Acknowledge alerts, Manage users, Edit settings, API access, Export data_.

### API key ⬜
label, prefix, token (hashed at rest), status (active/revoked), rate limit, created.

### Chat session / voice intent ⬜
Transcript records (caller, channel Voice/Phone/WhatsApp/API, intent, outcome, time, duration, messages) and aggregate intent stats.

---

## 6. API surface

### Implemented (`smart-dustbin`) ✅

**Single-bin / real device**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | Live single-bin state |
| GET | `/api/stats` · `/api/history` · `/api/events` | KPIs, trend, event feed for the single bin |
| POST | `/api/sim/start` · `/stop` · `/step` · `/clear` · GET `/api/sim/status` · `/data` | Single-bin generator control |

**Fleet (BinPulse)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/fleet` | Full live fleet snapshot (array of bin records) |
| GET | `/api/fleet/stats` | `total, online, offline, full, avgFill, faults, lowBattery, avgBattery, activeAlerts, collectionsToday, uptime_s` |
| GET | `/api/fleet/history?window=24h` | Hourly average-fill series (`12h`, `7d`, …) |
| GET | `/api/fleet/events?limit=50` | Live event feed, newest first |
| GET | `/api/fleet/alerts` | Active alerts |
| GET | `/api/fleet/bins/{id}` | One bin + its recent events |
| GET | `/api/fleet/collections?limit=50` | Collection / dispatch tickets |
| GET | `/api/fleet/crew` | Crew roster & live status |
| GET | `/api/fleet/ghats` | Ghat / zone reference |
| POST | `/api/fleet/alerts/{id}/ack` · `/api/fleet/alerts/ack-all` | Acknowledge alert(s) |
| POST | `/api/fleet/bins/{id}/collect` | Mark collected (resets fill) |
| POST | `/api/fleet/dispatch` | Create a crew ticket — `{ "bin": "BIN-A1", "team": "Team Alpha" }` |
| POST/GET | `/api/fleet/sim/start` · `/stop` · `/step` · `/status` | Fleet generator control |

### To build ⬜

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/fleet/events/stream` | SSE/WebSocket push to replace polling during surges |
| GET/PUT | `/api/settings/notifications` | Notification preferences |
| POST | `/api/voice/query` | Answer a natural-language fleet query (§7) |
| GET | `/api/voice/status` · `/full` · `/health` · `/stream` | Assistant helper + stream endpoints |
| — | `POST /api/auth/login`, `/api/users`, `/api/roles`, `/api/keys` | Auth, RBAC admin, API-key issue/revoke |

**Conventions:** JSON, ISO-8601 timestamps, consistent error envelope, pagination on list endpoints, ETag/`updatedAt` so the poller can short-circuit unchanged snapshots. Prefer a realtime push channel over pure polling for the event feed to cut load during surges.

---

## 7. Functional requirements by domain

- **Fleet monitoring:** serve every bin's state; status bands (≥80 Full, ≥50 Almost full, else Available) and KPIs computed server-side. ✅
- **Alerts & events:** evaluate rules on every reading/tick; persist alerts with ack state; append-only event stream; de-duplicate repeat alerts per bin+type. ✅
- **Collection & dispatch:** create/track tickets, assign teams, reset fill on completion; prioritise by density-band SLA (Red 10 / Yellow 20 / Green 45 min) and nearest-first along the bund. ✅ basic / 🟡 routing.
- **Crew management:** roster, shift and live status; stops remaining; availability. ✅
- **AI assistant:** `/api/voice/query` must answer the same intents the UI handles today — _which/fullest bins, fleet health summary, how many need collection, battery status_ — grounded in live data, returning a short natural-language string; log sessions and intent stats. Current frontend logic is keyword-based (`answerQuery`); backend may upgrade to an LLM/NLU service but must preserve the response shape. ⬜
- **Analytics:** aggregates over readings/collections — diversion rate, fill trends, ghat/zone performance, collection throughput. 🟡
- **Notifications:** per-user channels (push, email, SMS, WhatsApp, webhook) and per-condition toggles (full, fault, battery, offline, quiet hours); deliver on alert creation. ⬜
- **Admin:** CRUD for users, roles/permissions, API keys and settings. ⬜

---

## 8. Non-functional requirements

- **Scale (event-grade):** sized for the full Pushkaralu deployment — hundreds–thousands of bins on short intervals, many concurrent clients, sharp fill surges at peak bathing windows. Horizontal scalability on ingest and read paths. _(SQLite is fine for dev/demo; move hot readings to a time-series store for the event.)_
- **Performance:** fleet snapshot & KPI reads P95 < 300 ms; alert latency (reading → visible) < 5 s; realtime event delivery near-instant.
- **Reliability & availability:** high uptime across the event; no single point of failure on ingest; graceful degradation (serve last-known state if a bin goes quiet).
- **Connectivity resilience:** tolerate intermittent field networks — device-side buffering + backfill, at-least-once delivery with idempotent writes.
- **Data retention:** raw readings for the event plus a post-event analysis window (e.g. 90 days hot, then downsampled/archived); alerts and collections retained for audit.
- **Observability:** structured logs, metrics (ingest rate, queue depth, alert latency, device online %), health endpoints.
- **Data residency/compliance:** host in-region per municipal requirements; audit trail of operational actions (dispatch, ack, settings changes).

---

## 9. Security & access control ⬜

- **User auth:** login with sessions or JWT; secure password storage; optional municipal SSO.
- **RBAC:** enforce the five roles against the seven permissions on every mutating endpoint (not just the UI).
- **API keys:** issue/rotate/revoke with per-key rate limits; store hashed; scope by permission.
- **Device security:** per-device identity, TLS transport, deny-list compromised devices, signed OTA updates.
- **Transport & data:** HTTPS everywhere, input validation on ingest, rate limiting, least-privilege DB access.

---

## 10. External integrations

- **Maps / geocoding:** Google Maps Platform (Maps JavaScript API + Street View) for the Live Map — referrer-restricted API key; geocoding to validate ghat/bin coordinates (GIS survey). 🟡 _(keyless embeds today)_
- **Messaging:** SMS and **WhatsApp Business API** for citizen overflow reports and crew notifications; push for console/mobile; outbound webhook for partners. ⬜
- **IVR / voice:** optional telephony gateway for the phone/voice channels. ⬜
- **Identity:** optional municipal SSO / directory integration. ⬜

---

## 11. Current stack & storage

**Stack (as built):** **FastAPI** (Python, stdlib only) + **SQLite (WAL)**. Scale-up path: PostgreSQL (relational) + TimescaleDB/InfluxDB (readings) + Redis (live snapshot cache & pub/sub) + an MQTT broker (EMQX/Mosquitto) for device ingest and a Kafka/NATS buffer under event load.

**SQLite tables**

| Table | Written by | Holds |
|---|---|---|
| `readings` | real device + single-bin generator | per-reading `ts, distance, fill, device_id, rssi, source` |
| `events` | lifecycle transitions | `ts, kind, fill, detail` |
| `fleet_readings` | fleet generator | per-bin `ts, bin_id, fill, battery, rssi, temp, echo` |
| `fleet_events` | fleet feed | `ts, type, severity, icon, bin_id, detail` |
| `fleet_kv` | fleet snapshot | JSON of bins / alerts / collections / crew (survives restart) |

On startup the server restores in-memory series from SQLite if the JSON snapshot is empty; the fleet restores its last snapshot from `fleet_kv`.

**Backend module map**

| File | Responsibility |
|---|---|
| `smart-dustbin/app.py` | FastAPI app, all endpoints, wires the generators |
| `smart-dustbin/synthetic.py` | `SyntheticGenerator` — single-bin generator + scheduler |
| `smart-dustbin/fleet_sim.py` | `FleetSimulator` — fleet model, alerts/events/collections + scheduler |
| `smart-dustbin/db.py` | SQLite storage for both |
| `smart-dustbin/simulator.py` | standalone external simulator (posts over HTTP) |

**Frontend wiring (this console):** replace `driftFleet` in `src/state/FleetContext.jsx` with `fetch('/api/fleet')` on `POLL_MS`, point the event feed at `/api/fleet/events` (later `/stream`), map actions to `/api/fleet/alerts/*/ack`, `/api/fleet/bins/:id/collect`, `/api/fleet/dispatch`, and route `answerQuery` to `POST /api/voice/query` once built. The field contract already matches `GET /api/fleet`.

---

## 12. Suggested delivery phases

1. **Data foundation** — FastAPI + SQLite, single-bin & fleet generators, `/api/fleet*` read/command endpoints, alert rules. **✅ done in `smart-dustbin`.**
2. **Live wiring & realtime** — point this console at `/api/fleet*`, add SSE/WebSocket event stream, history/analytics polish, real HTTP/MQTT device ingest for the pilot ghats. 🟡
3. **Operations** — dispatch/collection routing, crew status depth, notifications (WhatsApp/SMS/push). ⬜
4. **Platform hardening** — auth + RBAC, API keys, OTA/device management, observability, scale testing + move readings to a time-series store for event load. ⬜
5. **Assistant upgrade** — implement `/api/voice/query` (keyword first, then LLM/NLU), add IVR/WhatsApp assistant channels. ⬜

---

_Integrates the `smart-dustbin` synthetic-data/generator backend with the BinPulse frontend contract (`src/data/model.js`, `src/state/FleetContext.jsx`). Coordinates and placements are illustrative pending the PS07 GIS survey._
