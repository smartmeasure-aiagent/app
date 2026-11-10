import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import {
  makeFleet, makeHistory, seedEvents, driftFleet, makeEvent, fleetStats, alertsList,
  normalizeEvents, normalizeAlerts, normalizeHistory, normalizeCrew, normalizeCollections, CREW,
} from '../data/model.js'
import {
  fetchFleet, fetchFleetEvents, fetchFleetHistory, fetchFleetAlerts, fetchCrew,
  fetchCollections, collectBin, dispatchTeam, ackAlert, ackAllAlerts,
} from '../data/api.js'

const FleetContext = createContext(null)
export const useFleet = () => useContext(FleetContext)

const POLL_MS = 3000       // fleet bins: the fast loop that drives every screen
const SLOW_EVERY = 5       // crew/collections change rarely — every 5th tick

export function FleetProvider({ children }) {
  const [fleet, setFleet] = useState(makeFleet)
  const [events, setEvents] = useState(() => seedEvents(fleet))
  const [history, setHistory] = useState(makeHistory)
  const [apiAlerts, setApiAlerts] = useState(null)   // null until the backend answers
  const [crew, setCrew] = useState(CREW)
  const [collections, setCollections] = useState([])
  const [acked, setAcked] = useState(() => new Set())
  const [dispatched, setDispatched] = useState(() => new Set())
  const [agentOnline, setAgentOnline] = useState(true)
  const [live, setLive] = useState(false) // true when the real backend is driving the fleet
  const [notif, setNotif] = useState({
    push: true, email: true, sms: false, whatsapp: true, webhook: false,
    full: true, fault: true, battery: true, offline: false, quiet: false,
  })
  const [toast, setToastState] = useState(null)
  const toastTimer = useRef(null)
  const tickCount = useRef(0)
  const fleetRef = useRef(fleet)
  fleetRef.current = fleet

  // Live loop: poll the backend's fleet, events, alerts and history together. If
  // the backend is unreachable (offline, or an HTTPS page blocking the HTTP
  // backend) fall back to the local simulation so the demo keeps running.
  useEffect(() => {
    let cancelled = false

    const simulate = () => {
      setLive(false)
      setFleet((prev) => {
        const next = driftFleet(prev)
        setHistory((h) => [...h.slice(1), { h: (h[h.length - 1].h + 1) % 24, avg: fleetStats(next).avg }])
        if (Math.random() > 0.4) setEvents((e) => [makeEvent(next), ...e].slice(0, 60))
        return next
      })
      setApiAlerts(null)   // fall back to alerts derived from the simulated fleet
    }

    const tick = async () => {
      const slow = tickCount.current++ % SLOW_EVERY === 0
      let bins
      try {
        bins = await fetchFleet()
        if (cancelled || !Array.isArray(bins) || bins.length === 0) throw new Error('empty fleet')
      } catch {
        if (!cancelled) simulate()
        return
      }
      setLive(true)
      setFleet(bins)

      // Secondary feeds are independent: one failing must not blank the others,
      // and must never drop us into simulation while the fleet itself is live.
      const settle = (p, apply) => p.then((d) => { if (!cancelled) apply(d) }).catch(() => {})
      settle(fetchFleetEvents(60), (d) => {
        const rows = normalizeEvents(d)
        if (rows.length) setEvents(rows)
      })
      settle(fetchFleetAlerts(), (d) => setApiAlerts(normalizeAlerts(d, bins)))
      settle(fetchFleetHistory('24h'), (d) => setHistory(normalizeHistory(d)))
      if (slow) {
        settle(fetchCrew(), (d) => setCrew(normalizeCrew(d)))
        settle(fetchCollections(50), (d) => setCollections(normalizeCollections(d, bins)))
      }
    }

    tick() // fetch immediately on mount, don't wait a full interval
    const id = setInterval(tick, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const showToast = useCallback((msg) => {
    setToastState(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastState(null), 2200)
  }, [])

  // Commands are optimistic: update locally at once, tell the backend, and let
  // the next poll confirm. Failures are swallowed because the poll is the truth.
  const ack = useCallback((id) => {
    setAcked((s) => new Set(s).add(id))
    if (live) ackAlert(id).catch(() => {})
  }, [live])

  const ackAll = useCallback(() => {
    const list = apiAlerts ?? alertsList(fleetRef.current)
    setAcked(() => new Set(list.map((a) => a.id)))
    if (live) ackAllAlerts().catch(() => {})
  }, [apiAlerts, live])

  const dispatch = useCallback((id, team) => {
    setDispatched((s) => new Set(s).add(id))
    if (live) {
      const bin = fleetRef.current.find((b) => b.id === id)
      dispatchTeam(id, `Team ${team || bin?.team || 'Alpha'}`).catch(() => {})
    }
  }, [live])

  const resetBin = useCallback((id) => {
    setFleet((prev) => {
      const target = (id && prev.find((b) => b.id === id)) || prev.find((b) => b.isReal) || prev[0]
      if (live && target) collectBin(target.id).catch(() => {}) // polling reflects the real reset
      return prev.map((b) => (b === target ? { ...b, fill: 0, spark: [...b.spark.slice(-15), 0] } : b))
    })
  }, [live])

  const toggleNotif = useCallback((k) => setNotif((n) => ({ ...n, [k]: !n[k] })), [])

  // Prefer the backend's own alerts; derive them from the fleet only as fallback.
  const alerts = apiAlerts ?? alertsList(fleet)

  const value = {
    fleet, events, history, crew, collections, acked, dispatched, agentOnline, notif, toast, live,
    setAgentOnline, ack, ackAll, dispatch, resetBin, toggleNotif, showToast,
    stats: fleetStats(fleet),
    alerts,
    alertsFromApi: apiAlerts !== null,
    activeAlerts: alerts.filter((a) => !acked.has(a.id) && !a.acknowledged),
  }
  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
}
