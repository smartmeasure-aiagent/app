import { useState } from 'react'
import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Stat, Badge } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { alertsList } from '../data/model.js'

const sevIcon = { crit: 'alert', warn: 'battery', info: 'wifi' }
const sevLabel = { crit: 'Critical', warn: 'Warning', info: 'Info' }

export default function Alerts() {
  const { fleet, acked, ack, ackAll, showToast } = useFleet()
  const [sev, setSev] = useState('all')
  const all = alertsList(fleet)
  const active = all.filter((a) => !acked.has(a.id))
  const list = sev === 'all' ? all : all.filter((a) => a.sev === sev)
  const count = (k) => active.filter((a) => a.sev === k).length

  return (
    <>
      <PageHeader
        title="Alerts & Notifications"
        sub={`${active.length} active alerts across the fleet`}
        actions={<button className="tbtn btn-pri" onClick={() => { ackAll(); showToast('All alerts acknowledged') }}><Icon name="check" size={16} />Acknowledge all</button>}
      />
      <div className="grid g-3 mb16">
        <Stat lab="Critical" val={count('crit')} icon="alert" />
        <Stat lab="Warnings" val={count('warn')} icon="battery" />
        <Stat lab="Info" val={count('info')} icon="wifi" />
      </div>
      <div className="filterbar">
        {['all', 'crit', 'warn', 'info'].map((s) => (
          <button key={s} className={`chip ${sev === s ? 'on' : ''}`} onClick={() => setSev(s)}>
            {s === 'all' ? 'All' : sevLabel[s]}
          </button>
        ))}
      </div>
      <div className="panel"><div className="panel-b" style={{ padding: 0 }}>
        <div className="feed" style={{ padding: '0 18px' }}>
          {list.length === 0 && <p style={{ color: 'var(--muted)', padding: 20 }}>No alerts for this filter.</p>}
          {list.map((a) => {
            const isAcked = acked.has(a.id)
            return (
              <div className="ev" key={a.id} style={{ opacity: isAcked ? 0.5 : 1 }}>
                <div className={`dot b-${a.sev}`}><Icon name={sevIcon[a.sev]} size={15} /></div>
                <div className="tx">
                  <b>{a.t} <Badge cls={a.sev}>{sevLabel[a.sev]}</Badge></b>
                  <p>{a.d} · <span className="mono">{a.bin.id}</span></p>
                </div>
                <button className="tbtn btn-sm" disabled={isAcked} onClick={() => { ack(a.id); showToast('Alert acknowledged') }}>
                  {isAcked ? 'Acknowledged' : 'Acknowledge'}
                </button>
              </div>
            )
          })}
        </div>
      </div></div>
    </>
  )
}
