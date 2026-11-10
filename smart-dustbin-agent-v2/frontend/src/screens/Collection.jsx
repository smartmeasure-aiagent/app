import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Stat, Badge, Meter } from '../components/ui.jsx'
import { TEAMS, fillColor } from '../data/model.js'

export default function Collection() {
  const { fleet, dispatched, dispatch, showToast } = useFleet()
  const queue = fleet.filter((b) => b.fill >= 55).sort((a, b) => b.fill - a.fill)
  const pending = queue.filter((b) => !dispatched.has(b.id))
  const teamLoad = TEAMS.map((t) => ({ name: t, v: fleet.filter((b) => b.team === t && b.fill >= 55).length }))
  const maxLoad = Math.max(1, ...teamLoad.map((t) => t.v))
  return (
    <>
      <PageHeader title="Collection Management" sub="Dispatch queue ordered by fill level · fullest bins first" />
      <div className="grid g-kpi mb16">
        <Stat lab="Pending" val={pending.length} icon="alert" delta="awaiting dispatch" deltaType="down" />
        <Stat lab="Dispatched" val={dispatched.size + 4} icon="truck" delta="in progress" />
        <Stat lab="Completed Today" val={38} icon="check" delta="+6 vs yest." deltaType="up" />
        <Stat lab="Avg Response" val={24} unit="min" icon="clock" delta="-3 min" deltaType="up" />
      </div>
      <div className="cols-main">
        <div className="panel">
          <div className="panel-h"><h3>Dispatch Queue</h3><span className="hint">{pending.length} pending</span></div>
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th>Bin</th><th>Zone</th><th>Fill</th><th>Distance</th><th>Team</th><th className="r">Action</th></tr></thead>
              <tbody>
                {queue.map((b) => {
                  const disp = dispatched.has(b.id)
                  return (
                    <tr key={b.id}>
                      <td><b>{b.name}</b><div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{b.id}</div></td>
                      <td>{b.zone}</td>
                      <td><span style={{ color: fillColor(b.fill), fontWeight: 700 }}>{b.fill}%</span></td>
                      <td className="mono">{b.distance} km</td>
                      <td>Team {b.team}</td>
                      <td className="r">{disp ? <Badge cls="ok">Dispatched</Badge> : <button className="tbtn btn-sm btn-pri" onClick={() => { dispatch(b.id); showToast('Crew dispatched to ' + b.id) }}>Dispatch</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <Panel title="Routes by Team" hint="active stops">
          {teamLoad.map((t) => <div className="hbar" key={t.name}><span className="nm">Team {t.name}</span><Meter pct={(t.v / maxLoad) * 100} /><span className="vl">{t.v}</span></div>)}
        </Panel>
      </div>
    </>
  )
}
