import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { makeFleet, makeHistory, seedEvents, driftFleet, makeEvent, fleetStats, alertsList } from '../data/model.js'
import { fetchFleet, collectBin } from '../data/api.js'

const FleetContext = createContext(null)
export const useFleet = () => useContext(FleetContext)

const POLL_MS = 3000 // polls the live backend; falls back to the local simulation on failure

export function FleetProvider({ children }) {
  const [fleet, setFleet] = useState(makeFleet)
  const [events, setEvents] = useState(() => seedEvents(fleet))
  const [history, setHistory] = useState(makeHistory)
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

  // Live loop (3s): poll the backend's /api/fleet; if unreachable (offline, or an
  // HTTPS page blocking the HTTP backend) fall back to the local simulation so the
  // demo keeps running. Events/history/alerts are derived from whichever fleet is live.
  useEffect(() => {
    let cancelled = false
    const sideEffects = (next) => {
      setHistory((h) => [...h.slice(1), { h: (h[h.length - 1].h + 1) % 24, avg: fleetStats(next).avg }])
      if (Math.random() > 0.4) setEvents((e) => [makeEvent(next), ...e].slice(0, 60))
    }
    const tick = async () => {
      try {
        const bins = await fetchFleet()
        if (cancelled || !Array.isArray(bins) || bins.length === 0) throw new Error('empty fleet')
        setLive(true)
        setFleet(bins)
        sideEffects(bins)
      } catch {
        if (cancelled) return
        setLive(false)
        setFleet((prev) => { const next = driftFleet(prev); sideEffects(next); return next })
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

  const ack = useCallback((id) => setAcked((s) => new Set(s).add(id)), [])
  const ackAll = useCallback(() => setAcked(() => new Set(alertsList(fleet).map((a) => a.id))), [fleet])
  const dispatch = useCallback((id) => setDispatched((s) => new Set(s).add(id)), [])
  const resetBin = useCallback(() => {
    setFleet((prev) => {
      const target = prev.find((b) => b.isReal) || prev[0]
      if (live && target) collectBin(target.id).catch(() => {}) // best-effort; polling reflects the real reset
      return prev.map((b) => (b === target ? { ...b, fill: 0, spark: [...b.spark.slice(-15), 0] } : b))
    })
  }, [live])
  const toggleNotif = useCallback((k) => setNotif((n) => ({ ...n, [k]: !n[k] })), [])

  const value = {
    fleet, events, history, acked, dispatched, agentOnline, notif, toast, live,
    setAgentOnline, ack, ackAll, dispatch, resetBin, toggleNotif, showToast,
    stats: fleetStats(fleet),
    activeAlerts: alertsList(fleet).filter((a) => !acked.has(a.id)),
  }
  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
}
