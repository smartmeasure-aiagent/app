// Backend client for the BinPulse fleet API (smart-dustbin).
// Base URL is configurable; defaults to the running demo backend. Note: the backend
// is HTTP-only, so an HTTPS-hosted frontend (e.g. GitHub Pages) will be blocked by
// mixed-content rules — the app falls back to the local simulation in that case.
export const API_BASE = (import.meta.env.VITE_API_BASE || 'http://37.27.53.14:8031').replace(/\/$/, '')

const withTimeout = (ms, promise) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

async function getJSON(path, ms = 8000) {
  const res = await withTimeout(ms, fetch(`${API_BASE}${path}`, { cache: 'no-store' }))
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

export const fetchFleet = () => getJSON('/api/fleet')
export const fetchFleetEvents = (limit = 50) => getJSON(`/api/fleet/events?limit=${limit}`)
export const fetchFleetHistory = (window = '24h') => getJSON(`/api/fleet/history?window=${window}`)

const post = (path, body) =>
  withTimeout(8000, fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }))

export const collectBin = (id) => post(`/api/fleet/bins/${encodeURIComponent(id)}/collect`)
export const dispatchTeam = (bin, team) => post('/api/fleet/dispatch', { bin, team })
export const ackAlert = (id) => post(`/api/fleet/alerts/${encodeURIComponent(id)}/ack`)
export const ackAllAlerts = () => post('/api/fleet/alerts/ack-all')
