# Smart Dustbin — Sample Data (voice-agent integration)

Machine-readable companion to `Smart_Dustbin_Sample_Data_Voice_Agent.pdf`. Same numbers,
in JSON + CSV so the voice agent (and tests/mocks) can consume them directly.

All fields mirror the backend (`smart-dustbin/app.py`) and dashboard model
(`dashboard/src/lib/types.ts`). Reference snapshot time: **2026-11-03 ~14:10 IST**.

## Files

| File | Mirrors | Contents |
|------|---------|----------|
| `fleet_status.json` / `.csv` | `GET /api/status` (per bin) | 6-bin fleet: fill %, distance, status, alert, online, nested `device` |
| `history_BIN-A1.json` / `.csv` | `GET /api/history` | `{ts, distance, fill}` series — BIN-A1 filling 18%→92% over 30 min |
| `devices.json` / `.csv` | `GET /api/device`, `POST /api/heartbeat` | per-device health: rssi, uptime, fw, sensor_ok, failures, online |
| `events.json` / `.csv` | alert/event log | full alerts, sensor fault, reset, crosstalk reject |
| `voice_intents.json` | — | NLU model: entities (bin_id, location→bin map, status_value) + 8 intents with utterances |
| `dialogs.json` | — | grounded User→Agent turns (golden responses) with the data each is derived from |

## The 6 bins

| Bin | Location | Fill | Status | Note |
|-----|----------|------|--------|------|
| BIN-A1 | Cafeteria Entrance | 92% | FULL | alert active |
| BIN-B2 | Library Lobby | 64% | ALMOST FULL | |
| BIN-C3 | Hostel Block C | 38% | AVAILABLE | |
| BIN-D4 | Admin Gate | 85% | FULL | alert active |
| BIN-E5 | Sports Complex | 12% | AVAILABLE | |
| BIN-F6 | Parking Lot | — | NO RECENT DATA | offline, sensor fault |

## Rules the data obeys (from `app.py`)

- Status: `AVAILABLE` < 50% ≤ `ALMOST FULL` < 80% ≤ `FULL - COLLECT NOW`
- Alert fires only after **2 consecutive** ≥80% readings (`FULL_CONFIRMATIONS`)
- Reading older than **60 s** → status `NO RECENT DATA`, alert cleared
- Device offline after **25 s** without a heartbeat (`DEVICE_TIMEOUT_S`)
- Distance below **2.0 cm** is rejected as crosstalk (`MIN_VALID_DISTANCE_CM`)
- `distance_cm` assumes a 60 cm bin depth: `distance = 60 × (1 − fill/100)`

## Note on the fleet

The shipped backend tracks a **single** device in memory. To serve this multi-bin data,
key the `latest`/`history` stores by `device_id` and add an optional `?bin_id=` filter to
`/api/status`. The agent maps spoken locations → bin IDs via `voice_intents.json → entities.location`.

> Synthetic sample data for development only.
