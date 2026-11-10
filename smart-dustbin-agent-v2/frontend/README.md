# BinPulse Console — React + Vite

A smart-waste **fleet operations console**: 17 screens across 6 navigation groups,
with client-side simulated live sensor data (BIN-A1 represents the real ESP32 bin).

### 🌐 Live demo: **https://roshanneela.github.io/binpulse/**

---

## Features

- **17 screens / 6 groups** — Monitor, Operations, Assistant, Insights, Devices, Administration.
- **Live simulated telemetry** — the 14-bin fleet drifts every 3 seconds; BIN-A1 is overlaid as the "real" ESP32 bin.
- **Animated bin graphics** — bins fill to their live level with a wobbling surface, bobbing lid, and overflow when full; a procedurally-generated bin scene fills with type-appropriate trash (recycling / organic / general).
- **Live Map** — the Godavari riverfront at Rajamahendravaram (PS07 / Pushkaralu 2027) on a **real Google Map**, with the ghats as zones, a ghat picker, a PS07 Red/Yellow/Green density legend, and a **Street View** mode showing live Google Street View of each ghat. Bins are listed in the fill-priority panel alongside.
- **Pure-SVG charts** — gauges, sparklines, a glowing 24h area chart with a danger zone, and gradient bar charts; no chart library.
- **AI Voice Assistant** — answers fleet queries from live data with a typewriter effect.
- **Light + dark themes** — token-based design system, respects `prefers-reduced-motion`.

## Run it locally

```bash
npm install     # first time only
npm run dev     # start dev server → http://37.27.53.14:5173
npm run build   # production build into dist/
npm run preview # preview the production build
```

Requires Node.js 18+ (tested on Node 24).

## Tech stack

- **React 18** + **Vite 5** (ES modules, JSX)
- React Context for shared live-fleet state; custom hash-based routing (no router dependency)
- Pure SVG + CSS animations (no animation library); Google Fonts (Sora, Manrope, JetBrains Mono)

## Deployment

The site is hosted on **GitHub Pages** and deployed automatically by GitHub Actions.

- `.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/`.
- `vite.config.js` uses `base: './'` so the build works under the Pages subpath.
- To redeploy: just push to `main` — `git push` triggers a new build + deploy.

```bash
git add -A
git commit -m "your change"
git push
```

## Project structure

```
src/
  main.jsx                 # React entry
  App.jsx                  # shell, hash routing, theme, screen registry
  index.css                # full design system (light + dark tokens)
  state/
    FleetContext.jsx       # live-data provider: 3s simulation loop, actions, toasts
  data/
    model.js               # fleet model, mock entities, derived stats, drift logic
  components/
    icons.jsx              # inline SVG icon set + <Icon>
    ui.jsx                 # Panel, PageHeader, Stat, Badge, Meter, Toggle, Avatar, AnimatedNumber
    charts.jsx             # Gauge, Spark, AreaChart, BarChart, Donut (pure SVG)
    BinGlyph.jsx           # animated waste-bin glyph (fill level + wobble + lid)
    BinScene.jsx           # procedurally-generated animated bin illustration
    TruckRun.jsx           # driving collection-truck animation
    Sidebar.jsx, Topbar.jsx, EventRow.jsx
  screens/                 # one file per screen (17 total)
    Dashboard, BinMonitoring, BinDetails, LiveMap,
    Alerts, Collection, Crew, Voice, Chat, Analytics,
    Devices, Diagnostics, Users, Roles, ApiIntegration,
    Notifications, Settings
```

## Shared data model

- **Bin:** id, name, sector (grid cell e.g. `G5-A1`), zone (Godavari ghat), density
  (PS07 Red/Yellow/Green), x/y map coords, fill %, distance, capacity L, battery %, rssi,
  temp, fillRate %/h, team, type (General/Recycling/Organic), online, sensorOk, lastUpdateS, isReal.
- **Ghats (zones):** Durgamma · Godavari River · Godavari Nitya Aarti · Pushkar · Padmavathi — each with a grid code and riverfront coordinates (`GHATS` in `model.js`) used for Street View.
- **Density zones (PS07):** Red (ghats, 25 m / 10 min) · Yellow (food/vendors, 50 m / 20 min) · Green (parking/stalls, 100 m / 45 min) — `DENSITY` in `model.js`.
- **Status thresholds:** ≥80 Full · ≥50 Almost full · else Available.
- **Fleet:** 14 bins · 5 ghats · 5 teams (Alpha–Echo); drifts every 3s; BIN-A1 is the live bin.
- **Mock entities:** CREW, USERS, ROLES/PERM_KEYS, API_KEYS, CHAT_SESSIONS, VOICE_INTENTS.

## Going live (replace the simulation)

The demo generates data client-side. To drive the UI from a real backend:

1. Open `src/state/FleetContext.jsx`. In the `setInterval` loop, replace the
   `driftFleet(prev)` call with a `fetch('/api/status')` that returns the bins.
2. Point the event stream at `/api/events` (or `/api/voice/stream` via `EventSource`).
3. In `src/data/model.js`, `answerQuery()` can POST to `/api/voice/query` instead of
   computing answers locally.
4. The danger-zone reset in `Settings` already maps to `POST /api/reset`.

`POLL_MS` in `FleetContext.jsx` controls the refresh interval.
