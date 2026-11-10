import { useEffect, useState, useCallback, useRef } from 'react'
import { FleetProvider, useFleet } from './state/FleetContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import ChatWidget from './components/ChatWidget.jsx'
import CallOverlay from './components/CallOverlay.jsx'
import { Icon } from './components/icons.jsx'

import Dashboard from './screens/Dashboard.jsx'
import BinMonitoring from './screens/BinMonitoring.jsx'
import BinDetails from './screens/BinDetails.jsx'
import LiveMap from './screens/LiveMap.jsx'
import Alerts from './screens/Alerts.jsx'
import Collection from './screens/Collection.jsx'
import Crew from './screens/Crew.jsx'
import Voice from './screens/Voice.jsx'
import Chat from './screens/Chat.jsx'
import Analytics from './screens/Analytics.jsx'
import Devices from './screens/Devices.jsx'
import Diagnostics from './screens/Diagnostics.jsx'
import Users from './screens/Users.jsx'
import Roles from './screens/Roles.jsx'
import ApiIntegration from './screens/ApiIntegration.jsx'
import Notifications from './screens/Notifications.jsx'
import Settings from './screens/Settings.jsx'

const SCREENS = {
  dashboard: Dashboard, bins: BinMonitoring, 'bin-details': BinDetails, map: LiveMap,
  alerts: Alerts, collection: Collection, crew: Crew, voice: Voice, chat: Chat,
  analytics: Analytics, devices: Devices, diag: Diagnostics,
  users: Users, roles: Roles, apiint: ApiIntegration, notif: Notifications, settings: Settings,
}

function getInitialTheme() {
  try {
    const st = localStorage.getItem('fv-theme')
    if (st) return st
  } catch (e) { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'
}

function Shell() {
  const { toast } = useFleet()
  const [screen, setScreen] = useState(() => {
    const h = location.hash.replace('#', '')
    return SCREENS[h] ? h : 'dashboard'
  })
  const [selectedBin, setSelectedBin] = useState('BIN-A1')
  const [binSearch, setBinSearch] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('fv-theme', theme) } catch (e) { /* ignore */ }
  }, [theme])

  // cursor-tracking spotlight glow + 3D tilt for .fx-glow / .fx-tilt elements (rAF-throttled)
  useEffect(() => {
    let frame = null, pending = null
    const apply = () => {
      frame = null
      const e = pending
      const el = e.target.closest?.('.fx-glow, .fx-tilt')
      if (!el) return
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      el.style.setProperty('--mx', px * 100 + '%')
      el.style.setProperty('--my', py * 100 + '%')
      if (el.classList.contains('fx-tilt')) {
        el.style.setProperty('--rx', (py - 0.5) * -7 + 'deg')
        el.style.setProperty('--ry', (px - 0.5) * 7 + 'deg')
      }
    }
    const onMove = (e) => { pending = e; if (!frame) frame = requestAnimationFrame(apply) }
    const onOut = (e) => {
      const el = e.target.closest?.('.fx-tilt')
      if (el) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg') }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerout', onOut, true)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerout', onOut, true); if (frame) cancelAnimationFrame(frame) }
  }, [])

  useEffect(() => { location.hash = screen }, [screen])
  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#', '')
      if (SCREENS[h]) setScreen(h)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((s, opts = {}) => {
    if (!SCREENS[s]) s = 'dashboard'
    if (opts.bin) setSelectedBin(opts.bin)
    if (opts.search != null) setBinSearch(opts.search)
    setScreen(s)
    setNavOpen(false)
  }, [])
  const openBin = useCallback((id) => go('bin-details', { bin: id }), [go])

  const Current = SCREENS[screen] || Dashboard
  const props = { go, openBin, selectedBin, setSelectedBin, binSearch, setBinSearch }

  return (
    <div className="app">
      <Sidebar screen={screen} go={go} open={navOpen} />
      <div className={`scrim ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />
      <div className="main">
        <Topbar go={go} onMenu={() => setNavOpen((o) => !o)} theme={theme}
          toggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
        <main className="content">
          <div className="page" key={screen}>
            <Current {...props} />
          </div>
        </main>
      </div>
      <CallOverlay />
      <ChatWidget go={go} />
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}

function BootSplash() {
  const [phase, setPhase] = useState('show') // show -> gone -> removed
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('gone'), 1100)
    const t2 = setTimeout(() => setPhase('removed'), 1650)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  if (phase === 'removed') return null
  return (
    <div className={`boot ${phase === 'gone' ? 'gone' : ''}`}>
      <div className="inner">
        <div className="logo"><Icon name="bin" size={34} /></div>
        <b>BinPulse</b>
        <div className="track"><i /></div>
        <div className="cap">Connecting to ESP32 sensor network…</div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <FleetProvider>
      <BootSplash />
      <Shell />
    </FleetProvider>
  )
}
