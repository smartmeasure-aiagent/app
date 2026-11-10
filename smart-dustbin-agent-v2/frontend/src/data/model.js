// ============================= BinPulse data model =============================
// Shared model: 14 bins across 5 zones / 5 teams. BIN-A1 overlays the "real" ESP32 bin.
// In this demo the data is simulated client-side (driftFleet). Swap driftFleet's body
// for fetch('/api/status') etc. to drive the UI from a live backend.

// Zones = Godavari Pushkaralu 2027 riverfront ghats (PS07 reference), Rajamahendravaram.
export const ZONES = ['Durgamma Ghat', 'Godavari River Ghat', 'Godavari Nitya Aarti', 'Pushkar Ghat', 'Padmavathi Ghat']
export const TEAMS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']
export const TYPES = ['General', 'Recycling', 'Organic']

// Ghat metadata — grid code + real Godavari bund coordinates (Rajamahendravaram, left bank).
// Pushkar Ghat and Saraswathi/Nitya-Aarti are authoritative (OpenStreetMap); the other three
// are placed along the same bund between the known anchors. Verify with GIS survey (PS07).
// Street View headings face west (~270°) toward the river.
export const GHATS = {
  'Durgamma Ghat':        { code: 'G1', short: 'Durgamma',    lat: 17.0205, lng: 81.7686, heading: 275 }, // north bund (approx)
  'Godavari River Ghat':  { code: 'G3', short: 'River Ghat',  lat: 17.0150, lng: 81.7673, heading: 275 }, // Kotilingala Revu stretch (approx)
  'Pushkar Ghat':         { code: 'G5', short: 'Pushkar',     lat: 17.0084, lng: 81.7669, heading: 270 }, // OSM: Pushkar Ghat
  'Godavari Nitya Aarti': { code: 'G4', short: 'Nitya Aarti', lat: 16.9948, lng: 81.7709, heading: 265 }, // OSM: Saraswathi Ghat (aarti)
  'Padmavathi Ghat':      { code: 'G6', short: 'Padmavathi',  lat: 16.9908, lng: 81.7726, heading: 265 }, // south bund (approx)
}

// Density zones from the PS07 Grid Allocation Framework.
export const DENSITY = {
  Red:    { label: 'Red',    name: 'Hyper-crowded',  env: 'Bathing ghats, temple lanes',    spacing: '25 m',  interval: '10 min', color: '#e0524b' },
  Yellow: { label: 'Yellow', name: 'High-traffic',   env: 'Food zones, vendor sidewalks',   spacing: '50 m',  interval: '20 min', color: '#d79020' },
  Green:  { label: 'Green',  name: 'Medium-traffic', env: 'Transit drops, parking, stalls', spacing: '100 m', interval: '45 min', color: '#3f9d58' },
}

// Keyless Google Street View / map embeds for a ghat's riverfront point.
export const streetViewUrl = (lat, lng, heading = 210) =>
  `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,${heading},0,0,0&output=svembed`
export const mapEmbedUrl = (lat, lng, z = 16, type = 'm') =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=${z}&t=${type}&hl=en&output=embed`
// no-marker overview (empty q = no pin, ll centres, t=k satellite) for the "all ghats" view
export const mapOverviewUrl = (lat, lng, z = 14) =>
  `https://maps.google.com/maps?q=&ll=${lat},${lng}&z=${z}&t=k&hl=en&output=embed`
export const mapsLink = (lat, lng) => `https://www.google.com/maps/@${lat},${lng},18z`
// opens the ghat directly in Google Maps Street View (works even where the inline embed has no imagery)
export const streetViewLink = (lat, lng, heading = 270) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=${heading}`
// Riverfront centre point for the "all ghats" overview (real Godavari bund, Rajamahendravaram).
export const GHAT_CENTER = { lat: 17.0050, lng: 81.7690 }

export const rnd = (a, b) => a + Math.random() * (b - a)
export const ri = (a, b) => Math.floor(rnd(a, b + 1))
export const pick = (a) => a[ri(0, a.length - 1)]

// id, name, sector (grid cell), zone (ghat), x, y, startFill, isReal, density
// x splits into PS07 density bands: Red ghat steps (~24-28), Yellow food/vendor (~50-53), Green parking (~80-82).
const BINSEED = [
  ['A1', 'Pushkar Main Ghat',         'G5-A1', 'Pushkar Ghat',         27, 60, 78, true,  'Red'],
  ['A3', 'Pushkar Changing Rooms',    'G5-B1', 'Pushkar Ghat',         24, 66, 91, false, 'Red'],
  ['E1', 'Pushkar Food Distribution', 'G5-B2', 'Pushkar Ghat',         52, 62, 67, false, 'Yellow'],
  ['C1', 'River Ghat Bathing Steps',  'G3-A1', 'Godavari River Ghat',  28, 26, 88, false, 'Red'],
  ['A2', 'River Ghat Aarti Platform', 'G3-B2', 'Godavari River Ghat',  24, 33, 92, false, 'Red'],
  ['B1', 'River Ghat Food Court',     'G3-C2', 'Godavari River Ghat',  53, 29, 45, false, 'Yellow'],
  ['B2', 'Durgamma Ghat Steps',       'G1-A1', 'Durgamma Ghat',        27, 10, 83, false, 'Red'],
  ['B3', 'Durgamma Vendor Row',       'G1-B2', 'Durgamma Ghat',        50,  8, 37, false, 'Yellow'],
  ['C2', 'Durgamma Parking',          'G1-C1', 'Durgamma Ghat',        82, 13, 54, false, 'Green'],
  ['E2', 'Nitya Aarti Platform',      'G4-A1', 'Godavari Nitya Aarti', 26, 46, 73, false, 'Red'],
  ['C3', 'Nitya Aarti Shoe Depot',    'G4-B2', 'Godavari Nitya Aarti', 51, 49, 29, false, 'Yellow'],
  ['D1', 'Padmavathi Bathing Ghat',   'G6-A1', 'Padmavathi Ghat',      28, 78, 95, false, 'Red'],
  ['D2', 'Padmavathi Vendor Walk',    'G6-B2', 'Padmavathi Ghat',      50, 74, 41, false, 'Yellow'],
  ['E3', 'Padmavathi Transit Park',   'G6-C3', 'Padmavathi Ghat',      82, 82, 19, false, 'Green'],
]

export function makeFleet() {
  return BINSEED.map((b, i) => ({
    id: 'BIN-' + b[0], name: b[1], sector: b[2], zone: b[3], x: b[4], y: b[5], fill: b[6],
    distance: +rnd(0.4, 7.2).toFixed(1), capacity: pick([120, 240, 360, 660]),
    battery: ri(28, 100), rssi: -ri(42, 88), temp: +rnd(14, 34).toFixed(1),
    fillRate: +rnd(0.8, 5.4).toFixed(1), team: TEAMS[i % 5], type: TYPES[i % 3],
    online: Math.random() > 0.08, sensorOk: Math.random() > 0.1, lastUpdateS: ri(2, 220),
    isReal: b[7], density: b[8], firmware: pick(['v2.4.1', 'v2.4.1', 'v2.3.8', 'v2.5.0-rc']),
    failedReads: ri(0, 6), echo: ri(2, 48),
    spark: Array.from({ length: 16 }, () => ri(Math.max(0, b[6] - 30), Math.min(100, b[6] + 8))),
  }))
}

export const statusOf = (f) => (f >= 80 ? 'Full' : f >= 50 ? 'Almost full' : 'Available')
export const statusClass = (f) => (f >= 80 ? 'crit' : f >= 50 ? 'warn' : 'ok')
export const fillColor = (f) => (f >= 80 ? 'var(--crit)' : f >= 50 ? 'var(--warn)' : 'var(--ok)')

export function fleetStats(fleet) {
  const total = fleet.length
  const full = fleet.filter((b) => b.fill >= 80).length
  const avg = Math.round(fleet.reduce((a, b) => a + b.fill, 0) / total)
  const faults = fleet.filter((b) => !b.sensorOk).length
  const offline = fleet.filter((b) => !b.online).length
  const lowBat = fleet.filter((b) => b.battery < 30).length
  const online = total - offline
  const uptime = ((online / total) * 100).toFixed(1)
  const avgBat = Math.round(fleet.reduce((a, b) => a + b.battery, 0) / total)
  return { total, full, avg, faults, offline, lowBat, online, uptime, avgBat }
}

export function alertsList(fleet) {
  const out = []
  fleet.forEach((b) => {
    if (b.fill >= 80) out.push({ id: b.id + '-full', bin: b, sev: 'crit', t: 'Bin full', d: `${b.name} reached ${b.fill}% capacity` })
    if (!b.sensorOk) out.push({ id: b.id + '-fault', bin: b, sev: 'warn', t: 'Sensor fault', d: `${b.name} ultrasonic read failure` })
    if (b.battery < 30) out.push({ id: b.id + '-bat', bin: b, sev: 'warn', t: 'Low battery', d: `${b.name} battery at ${b.battery}%` })
    if (!b.online) out.push({ id: b.id + '-off', bin: b, sev: 'info', t: 'Bin offline', d: `${b.name} not reporting` })
  })
  const rank = { crit: 0, warn: 1, info: 2 }
  return out.sort((a, b) => rank[a.sev] - rank[b.sev] || b.bin.fill - a.bin.fill)
}

// --- live event stream (ic = icon name) ---
const EVTYPES = [
  { t: 'Bin full', k: 'crit', ic: 'alert' },
  { t: 'Collection completed', k: 'ok', ic: 'truck' },
  { t: 'Sensor reading', k: 'info', ic: 'sensor' },
  { t: 'Low battery', k: 'warn', ic: 'battery' },
  { t: 'Bin offline', k: 'mut', ic: 'wifi' },
  { t: 'Team dispatched', k: 'acc', ic: 'truck' },
]
export function makeEvent(fleet) {
  const bin = pick(fleet)
  const type = pick(EVTYPES)
  return {
    id: Math.random().toString(36).slice(2), t: type.t, k: type.k, ic: type.ic, bin: bin.id, ts: Date.now(),
    detail:
      type.t === 'Sensor reading' ? `${bin.fill}% fill · ${bin.rssi} dBm`
      : type.t === 'Bin full' ? `Reached ${bin.fill}% capacity`
      : type.t === 'Low battery' ? `Battery at ${bin.battery}%`
      : `${bin.name} · Team ${bin.team}`,
  }
}
export function seedEvents(fleet) {
  const evs = []
  for (let i = 0; i < 10; i++) { const e = makeEvent(fleet); e.ts = Date.now() - i * 45000; evs.push(e) }
  return evs
}

export function makeHistory() {
  return Array.from({ length: 24 }, (_, i) => ({ h: i, avg: +rnd(30, 72).toFixed(0) }))
}

// One simulation step — returns new fleet + maybe a new event. Replace with real polling.
export function driftFleet(fleet) {
  return fleet.map((b) => {
    const n = { ...b }
    if (!n.online) { if (Math.random() > 0.7) n.online = true; return n }
    let d = rnd(-1.5, n.fillRate * 0.9)
    if (Math.random() > 0.97) d = -n.fill * rnd(0.5, 0.9) // collection resets the bin
    n.fill = Math.max(0, Math.min(100, Math.round(n.fill + d)))
    n.lastUpdateS = ri(1, 6)
    n.rssi = Math.max(-92, Math.min(-40, n.rssi + ri(-2, 2)))
    n.echo = Math.max(2, Math.round((100 - n.fill) * rnd(0.4, 0.6) + 2))
    if (Math.random() > 0.995) n.battery = Math.max(5, n.battery - 1)
    if (Math.random() > 0.993) n.sensorOk = !n.sensorOk
    if (Math.random() > 0.994) n.online = false
    n.spark = [...n.spark.slice(-15), n.fill]
    return n
  })
}

// ============================= Mock entities =============================
export const CREW = [
  ['Yusuf Khan', 'Alpha', 'Durgamma Ghat', 'Morning', 12, 'On route'],
  ['Mei Lin', 'Alpha', 'Durgamma Ghat', 'Morning', 9, 'On route'],
  ['Carlos Diaz', 'Bravo', 'Godavari River Ghat', 'Morning', 7, 'Available'],
  ['Aisha Noor', 'Bravo', 'Godavari River Ghat', 'Evening', 0, 'Off shift'],
  ['Tom Becker', 'Charlie', 'Godavari Nitya Aarti', 'Morning', 14, 'On route'],
  ['Priya Rao', 'Charlie', 'Godavari Nitya Aarti', 'Evening', 3, 'Available'],
  ['Jon Weaver', 'Delta', 'Pushkar Ghat', 'Morning', 11, 'On route'],
  ['Lena Vogt', 'Delta', 'Pushkar Ghat', 'Evening', 0, 'Off shift'],
  ['Sam Okoye', 'Echo', 'Padmavathi Ghat', 'Morning', 8, 'Available'],
  ['Nadia Haddad', 'Echo', 'Padmavathi Ghat', 'Morning', 6, 'On route'],
]
export const USERS = [
  ['Rao Maaz', 'quantumdataleap.ai', 'Admin', 'Active', '2m ago'],
  ['Elena Ruiz', 'e.ruiz', 'Dispatcher', 'Active', '14m ago'],
  ['David Park', 'd.park', 'Operator', 'Active', '1h ago'],
  ['Sara Lund', 's.lund', 'Operator', 'Idle', '3h ago'],
  ['Omar Farouk', 'o.farouk', 'Analyst', 'Active', '22m ago'],
  ['Grace Chen', 'g.chen', 'Viewer', 'Offline', '2d ago'],
  ['Mark Ellis', 'm.ellis', 'Dispatcher', 'Active', '40m ago'],
]
export const PERM_KEYS = ['View fleet', 'Dispatch crews', 'Acknowledge alerts', 'Manage users', 'Edit settings', 'API access', 'Export data']
export const ROLES = [
  { name: 'Admin', desc: 'Full system access', color: '#0d9488', perms: [1, 1, 1, 1, 1, 1, 1] },
  { name: 'Dispatcher', desc: 'Operations & routing', color: '#2563eb', perms: [1, 1, 1, 0, 0, 0, 1] },
  { name: 'Operator', desc: 'Field collection crew', color: '#16a34a', perms: [1, 1, 1, 0, 0, 0, 0] },
  { name: 'Analyst', desc: 'Reporting & insights', color: '#d97706', perms: [1, 0, 0, 0, 0, 1, 1] },
  { name: 'Viewer', desc: 'Read-only dashboards', color: '#64748b', perms: [1, 0, 0, 0, 0, 0, 0] },
]
export const API_KEYS = [
  ['Production Dashboard', 'pk_live_', '9f3a21c8', 'Active', '120/min', 'Jan 2026'],
  ['Mobile Crew App', 'pk_live_', '7b1e55df', 'Active', '60/min', 'Dec 2025'],
  ['Analytics Pipeline', 'pk_live_', '2c84aa90', 'Active', '300/min', 'Nov 2025'],
  ['Legacy Export (deprecated)', 'pk_live_', '44de0071', 'Revoked', '30/min', 'Aug 2025'],
]
export const ENDPOINTS = [
  ['GET', '/api/voice/status', 'Agent availability & session count'],
  ['GET', '/api/voice/full', 'List of bins at/over threshold'],
  ['GET', '/api/voice/health', 'Fleet power & connectivity summary'],
  ['POST', '/api/voice/query', 'Answer a natural-language fleet query'],
  ['GET', '/api/voice/stream', 'Server-sent live event stream'],
]
export const CHAT_SESSIONS = [
  { caller: 'Dispatch (Elena)', ch: 'Voice', intent: 'Fullest bins', outcome: 'Resolved', time: '09:42', dur: '1m 12s',
    msgs: [['u', 'Which bins need collection first this morning?'], ['a', 'Three bins are over 80% right now: BIN-D1 Padmavathi Bathing Ghat at 95%, BIN-A3 Pushkar Changing Rooms at 91%, and BIN-B2 Durgamma Ghat Steps at 83%. Shall I dispatch the nearest crews?'], ['u', 'Yes, dispatch Alpha and Delta.'], ['a', 'Done. Team Alpha routed to BIN-A3 and Team Delta to BIN-D1. Estimated arrival 18 minutes.']] },
  { caller: '+91 94900 ••• 2290', ch: 'Phone', intent: 'Report overflow', outcome: 'Ticket created', time: '09:15', dur: '0m 48s',
    msgs: [['u', 'The bin at the Godavari River Ghat bathing steps is overflowing.'], ['a', 'Thanks — that is BIN-C1, currently reading 88%. I have created a priority collection ticket and notified Team Bravo.']] },
  { caller: 'Field crew (Yusuf)', ch: 'WhatsApp', intent: 'Route status', outcome: 'Resolved', time: '08:58', dur: '0m 33s',
    msgs: [['u', 'How many stops left on my route?'], ['a', 'You have 4 stops remaining on the Godavari riverfront route, next is BIN-A2 River Ghat Aarti Platform, 0.6 km away.']] },
  { caller: 'Analytics bot', ch: 'API', intent: 'Diversion rate', outcome: 'Resolved', time: '08:30', dur: '0m 09s',
    msgs: [['u', 'What was yesterday’s recycling diversion rate?'], ['a', 'Yesterday’s diversion rate was 41.6%, up 2.3 points from the prior day.']] },
  { caller: 'Dispatch (Mark)', ch: 'Voice', intent: 'Battery alert', outcome: 'Escalated', time: '08:02', dur: '1m 40s',
    msgs: [['u', 'Any sensors about to die?'], ['a', 'Two sensors are below 30% battery: BIN-E3 Padmavathi Transit Park at 24% and BIN-C3 Nitya Aarti Shoe Depot at 28%. I have flagged both for the maintenance queue.']] },
]
export const VOICE_INTENTS = [
  ['Fullest bins', 34], ['Route status', 22], ['Report overflow', 16], ['Collection ETA', 11], ['Battery / health', 9], ['Reports & stats', 8],
]

// voice assistant answer engine (reads live fleet)
export function answerQuery(q, fleet) {
  const s = fleetStats(fleet)
  q = q.toLowerCase()
  const full = fleet.filter((b) => b.fill >= 80).sort((a, b) => b.fill - a.fill)
  if (q.includes('full') && (q.includes('which') || q.includes('list')))
    return full.length ? `${full.length} bins are at or over 80%: ${full.slice(0, 3).map((b) => `${b.id} ${b.name} (${b.fill}%)`).join(', ')}${full.length > 3 ? '…' : ''}.` : 'Good news — no bins are currently full.'
  if (q.includes('fullest')) return `The fullest bin right now is ${full[0]?.name} (${full[0]?.id}) at ${full[0]?.fill}% in the ${full[0]?.zone} zone.`
  if (q.includes('health') || q.includes('summary')) return `Fleet health: ${s.online}/${s.total} bins online (${s.uptime}% uptime), average battery ${s.avgBat}%, ${s.faults} sensor fault${s.faults === 1 ? '' : 's'}, and ${s.full} bins needing collection.`
  if (q.includes('how many') || q.includes('need')) return `${s.full} bins currently need collection (≥80% full), with an average fill of ${s.avg}% across the fleet.`
  if (q.includes('battery')) return `Average battery across the fleet is ${s.avgBat}%. ${s.lowBat} bin${s.lowBat === 1 ? '' : 's'} below 30%.`
  return `Across the ${s.total}-bin network, average fill is ${s.avg}% and ${s.full} bins need collection. Try asking about full bins, battery, or fleet health.`
}

// ---------- small shared helpers ----------
export const ago = (s) => (s < 60 ? s + 's ago' : s < 3600 ? Math.floor(s / 60) + 'm ago' : Math.floor(s / 3600) + 'h ago')
export const timeOf = (ts) => ago(Math.floor((Date.now() - ts) / 1000))
export const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
export function colorFor(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360} 42% 45%)`
}

/* ------------------------------------------------------------------------- */
/* Normalizers: upstream payloads -> the shapes these screens already expect. */
/* Keeping the mapping here means no screen has to know the wire format.      */

// Event/alert titles map to an icon name and a severity key used by EventRow.
const EV_STYLE = {
  'Bin full': { k: 'crit', ic: 'alert' },
  'Collection completed': { k: 'ok', ic: 'truck' },
  'Collection dispatched': { k: 'acc', ic: 'truck' },
  'Team dispatched': { k: 'acc', ic: 'truck' },
  'Sensor reading': { k: 'info', ic: 'sensor' },
  'Sensor fault': { k: 'warn', ic: 'sensor' },
  'Low battery': { k: 'warn', ic: 'battery' },
  'Bin offline': { k: 'mut', ic: 'wifi' },
}
const SEV_STYLE = {
  crit: { k: 'crit', ic: 'alert' }, warn: { k: 'warn', ic: 'alert' },
  info: { k: 'info', ic: 'sensor' }, ok: { k: 'ok', ic: 'check' },
}
const styleFor = (type, sev) =>
  EV_STYLE[type] || SEV_STYLE[sev] || { k: 'info', ic: 'sensor' }

// Upstream timestamps are unix seconds (float); the UI works in milliseconds.
const toMs = (ts) => (typeof ts === 'number' ? Math.round(ts * 1000) : Date.now())

export function normalizeEvents(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((e) => {
    const s = styleFor(e.type, e.severity)
    // The upstream `icon` field is an emoji; EventRow needs an icon name, so it
    // is derived from the event type instead of passed through.
    return { id: e.id, t: e.type || 'Event', k: s.k, ic: s.ic, bin: e.bin || '—', ts: toMs(e.ts), detail: e.detail || '' }
  })
}

export function normalizeAlerts(rows, fleet) {
  if (!Array.isArray(rows)) return []
  const byId = new Map((fleet || []).map((b) => [b.id, b]))
  const rank = { crit: 0, warn: 1, info: 2 }
  return rows
    .map((a) => ({
      id: a.id,
      // Screens read alert.bin as a full bin record, so resolve the id.
      bin: byId.get(a.bin) || { id: a.bin, name: a.bin, fill: 0, zone: '', team: '' },
      sev: a.sev || 'info',
      t: a.type || 'Alert',
      d: a.detail || '',
      acknowledged: !!a.acknowledged,
      ts: toMs(a.ts),
    }))
    .sort((a, b) => (rank[a.sev] ?? 3) - (rank[b.sev] ?? 3) || b.bin.fill - a.bin.fill)
}

export function normalizeHistory(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return makeHistory()
  return rows.map((r) => ({ h: new Date(toMs(r.ts)).getHours(), avg: Math.round(r.fill || 0) }))
}

// Returned as tuples so it drops into the same rendering as the CREW constant.
export function normalizeCrew(rows) {
  if (!Array.isArray(rows)) return CREW
  return rows.map((c) => [
    c.name, String(c.team || '').replace(/^Team\s+/, ''), c.zone, c.shift, c.stops ?? 0, c.status || 'Available',
  ])
}

export function normalizeCollections(rows, fleet) {
  if (!Array.isArray(rows)) return []
  const byId = new Map((fleet || []).map((b) => [b.id, b]))
  return rows.map((c) => ({
    id: c.id,
    binId: c.bin,
    bin: byId.get(c.bin) || { id: c.bin, name: c.bin, zone: '', fill: 0 },
    team: String(c.team || '').replace(/^Team\s+/, ''),
    status: c.status || 'pending',
    reason: c.reason || '',
    eta: c.eta ?? 0,
    created: toMs(c.created),
    completed: c.completed ? toMs(c.completed) : null,
  }))
}
