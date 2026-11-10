import { useState } from 'react'
import { Icon } from './icons.jsx'
import { useFleet } from '../state/FleetContext.jsx'

export default function Topbar({ go, onMenu, theme, toggleTheme }) {
  const { activeAlerts, live } = useFleet()
  const [q, setQ] = useState('')
  const al = activeAlerts.length
  return (
    <header className="topbar">
      <button className="hamb" aria-label="Menu" onClick={onMenu}><Icon name="menu" /></button>
      <label className="searchbox">
        <Icon name="search" />
        <input
          placeholder="Search bins, zones, teams…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go('bins', { search: q }) }}
        />
      </label>
      <span className="livepill"><span className="livedot" />LIVE · ESP32</span>
      <span className={live ? 'livepill' : 'demochip'} title={live ? 'Live data from the BinPulse backend' : 'Backend unreachable — local simulation'}>
        {live ? 'BACKEND' : 'DEMO DATA'}
      </span>
      <button className="tbtn" title="Toggle theme" aria-label="Toggle theme" onClick={toggleTheme}>
        <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
      </button>
      <button className="tbtn" title="Alerts" style={{ position: 'relative' }} onClick={() => go('alerts')}>
        <Icon name="bell" />
        {al > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--crit)', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 20, padding: '1px 5px' }}>{al}</span>
        )}
      </button>
    </header>
  )
}
