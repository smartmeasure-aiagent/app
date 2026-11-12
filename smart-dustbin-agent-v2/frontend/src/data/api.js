// Backend clients for SMART BIN.
//
// Two origins, deliberately separate:
//   API_BASE   — the device/fleet backend. Serves the 16-bin synthetic fleet and
//                its two data generators. Needs no API key.
//   AGENT_BASE — our FastAPI agent. Adds the grounded AI assistant, the hysteresis
//                threshold engine, alert history and automated collection calls.
//
// Fleet reads go straight to API_BASE so the dashboard still works when the agent
// is not running. Anything only the agent can answer uses AGENT_BASE and degrades
// to the local simulation on failure.
export const API_BASE = (import.meta.env.VITE_API_BASE || 'http://37.27.53.14:8031').replace(/\/$/, '')
export const AGENT_BASE = (import.meta.env.VITE_AGENT_BASE || 'http://37.27.53.14:8032').replace(/\/$/, '')

const withTimeout = (ms, promise) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

async function getJSON(path, { base = API_BASE, ms = 8000 } = {}) {
  const res = await withTimeout(ms, fetch(`${base}${path}`, { cache: 'no-store' }))
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

async function postJSON(path, body, { base = API_BASE, ms = 30000 } = {}) {
  const res = await withTimeout(ms, fetch(`${base}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `${path} → ${res.status}`)
  return data
}

/* ---------------------------------------------------------------- fleet reads */

export const fetchFleet = () => getJSON('/api/fleet')
export const fetchFleetStats = () => getJSON('/api/fleet/stats')
export const fetchFleetAlerts = () => getJSON('/api/fleet/alerts')
export const fetchFleetEvents = (limit = 50) => getJSON(`/api/fleet/events?limit=${limit}`)
export const fetchFleetHistory = (window = '24h') => getJSON(`/api/fleet/history?window=${window}`)
export const fetchCollections = (limit = 50) => getJSON(`/api/fleet/collections?limit=${limit}`)
export const fetchCrew = () => getJSON('/api/fleet/crew')
export const fetchGhats = () => getJSON('/api/fleet/ghats')
export const fetchBin = (id) => getJSON(`/api/fleet/bins/${encodeURIComponent(id)}`)

/* ------------------------------------------------------------ fleet commands */

export const collectBin = (id) => postJSON(`/api/fleet/bins/${encodeURIComponent(id)}/collect`)
export const dispatchTeam = (bin, team) => postJSON('/api/fleet/dispatch', { bin, team })
export const ackAlert = (id) => postJSON(`/api/fleet/alerts/${encodeURIComponent(id)}/ack`)
export const ackAllAlerts = () => postJSON('/api/fleet/alerts/ack-all')

/* ------------------------------------------- synthetic data generator control */
// target: 'fleet' (16 bins) or 'single' (the one ESP32 reference unit, BIN-A1).

const simPrefix = (target) => (target === 'single' ? '/api/sim' : '/api/fleet/sim')

export const simStatus = (target = 'fleet') => getJSON(`${simPrefix(target)}/status`)
export const simStart = (target = 'fleet', config = {}) => postJSON(`${simPrefix(target)}/start`, config)
export const simStop = (target = 'fleet') => postJSON(`${simPrefix(target)}/stop`)
export const simStep = (target = 'fleet') => postJSON(`${simPrefix(target)}/step`)

/* ------------------------------------------------------------- agent backend */

/** Grounded AI answer. The agent computes it from stored readings, so it cannot
 *  invent fill levels; the model only rewords the verified result. */
export const voiceQuery = (text, lang = 'en') =>
  postJSON('/api/voice/query', { text, lang }, { base: AGENT_BASE })

export const fetchAgentHealth = () => getJSON('/api/health', { base: AGENT_BASE, ms: 4000 })
export const fetchAgentAlerts = () => getJSON('/api/alerts', { base: AGENT_BASE })
export const fetchAgentEvents = () => getJSON('/api/events', { base: AGENT_BASE })
export const fetchAgentStatus = () => getJSON('/api/status', { base: AGENT_BASE })
export const fetchFleetIngestState = () => getJSON('/api/fleet/state', { base: AGENT_BASE, ms: 4000 })
export const fetchStreamState = () => getJSON('/api/stream/state', { base: AGENT_BASE, ms: 4000 })

/* ------------------------------------- automated collection calls (agent only) */

export const fetchActiveCalls = () => getJSON('/api/calls/active', { base: AGENT_BASE, ms: 5000 })
export const answerCall = (id, lang = 'en') =>
  postJSON(`/api/calls/${id}/answer?lang=${lang}`, undefined, { base: AGENT_BASE })
export const sayToCall = (id, text, lang = 'en') =>
  postJSON(`/api/calls/${id}/say`, { text, lang }, { base: AGENT_BASE })
export const endCall = (id, reason = 'ended') =>
  postJSON(`/api/calls/${id}/end?reason=${reason}`, undefined, { base: AGENT_BASE })
