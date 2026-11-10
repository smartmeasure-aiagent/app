import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Badge, StatusBadge, Meter } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { BinGlyph } from '../components/BinGlyph.jsx'
import { ZONES, statusOf, fillColor, ago } from '../data/model.js'

export default function BinMonitoring({ openBin, binSearch, setBinSearch }) {
  const { fleet } = useFleet()
  // filters kept on the shared binSearch + two local-ish selects via URL-free state
  return <Inner fleet={fleet} openBin={openBin} search={binSearch} setSearch={setBinSearch} />
}

import { useState } from 'react'
function Inner({ fleet, openBin, search, setSearch }) {
  const [zone, setZone] = useState('all')
  const [status, setStatus] = useState('all')
  const list = fleet.filter((b) => {
    if (zone !== 'all' && b.zone !== zone) return false
    if (status !== 'all' && statusOf(b.fill) !== status) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(b.id + b.name + b.zone + b.sector).toLowerCase().includes(q)) return false
    }
    return true
  })
  return (
    <>
      <PageHeader title="Bin Monitoring" sub={`${list.length} of ${fleet.length} collection points · click a card for full detail`} />
      <div className="filterbar">
        <label className="searchbox" style={{ maxWidth: 280, margin: 0 }}>
          <Icon name="search" />
          <input placeholder="Search bins…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select className="sel" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="all">All zones</option>
          {ZONES.map((z) => <option key={z}>{z}</option>)}
        </select>
        <select className="sel" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All status</option>
          {['Full', 'Almost full', 'Available'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))' }}>
        {list.length === 0 && <p style={{ color: 'var(--muted)' }}>No bins match the current filters.</p>}
        {list.map((b) => (
          <button key={b.id} className="bincard fx-glow fx-tilt" onClick={() => openBin(b.id)}>
            <div className="h">
              <div><div className="id">{b.id} · {b.sector}</div><div className="nm">{b.name}</div></div>
              {b.isReal ? <span className="liveflag"><span className="d" />LIVE</span> : <StatusBadge fill={b.fill} />}
            </div>
            <div className="fillrow">
              <BinGlyph fill={b.fill} type={b.type} online={b.online} size={42} />
              <span className="pct" style={{ color: fillColor(b.fill) }}>{b.fill}%</span>
              <div style={{ flex: 1 }}><Meter pct={b.fill} color={fillColor(b.fill)} /></div>
            </div>
            <div className="foot">
              <span><Icon name="battery" size={13} />{b.battery}%</span>
              <span><Icon name="signal" size={13} />{b.rssi}dBm</span>
              <span><Icon name="clock" size={13} />{ago(b.lastUpdateS)}</span>
              <span style={{ marginLeft: 'auto' }}>{b.online ? <Badge cls="ok">Online</Badge> : <Badge cls="mut">Offline</Badge>}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
