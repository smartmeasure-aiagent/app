import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Badge } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { TEAMS, ZONES, colorFor, initials } from '../data/model.js'

export default function Crew() {
  // The live roster comes from the backend's /api/fleet/crew; the context falls
  // back to the bundled CREW list when the backend is unreachable.
  const { showToast, crew } = useFleet()
  const teams = TEAMS.filter((t) => crew.some((c) => c[1] === t))
  const teamSummary = (teams.length ? teams : TEAMS).map((t) => {
    const m = crew.filter((c) => c[1] === t)
    return { t, count: m.length, onr: m.filter((c) => c[5] === 'On route').length, col: m.reduce((a, c) => a + c[4], 0) }
  })
  const statusBadge = (s) => (s === 'On route' ? <Badge cls="acc">On route</Badge> : s === 'Available' ? <Badge cls="ok">Available</Badge> : <Badge cls="mut">Off shift</Badge>)
  return (
    <>
      <PageHeader title="Cleaning Team" sub="Crew rosters, shifts and live field status" />
      <div className="grid g-kpi mb16">
        {teamSummary.map((s) => (
          <div className="stat" key={s.t}>
            <div className="top"><span className="lab">Team {s.t}</span><span className="ico"><Icon name="team" size={16} /></span></div>
            <div className="val">{s.col}<span className="u">collected</span></div>
            <div className="delta flat">{s.onr}/{s.count} on route · {ZONES[TEAMS.indexOf(s.t)]}</div>
          </div>
        ))}
      </div>
      <Panel title="Crew Roster">
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Member</th><th>Team</th><th>Zone</th><th>Shift</th><th className="r">Collected</th><th>Status</th><th className="r">Contact</th></tr></thead>
            <tbody>
              {crew.map((c) => (
                <tr key={c[0]}>
                  <td><div className="who"><div className="avatar" style={{ background: colorFor(c[0]) }}>{initials(c[0])}</div><span className="nm">{c[0]}</span></div></td>
                  <td>Team {c[1]}</td><td>{c[2]}</td><td>{c[3]}</td>
                  <td className="r mono">{c[4]}</td>
                  <td>{statusBadge(c[5])}</td>
                  <td className="r"><button className="tbtn btn-sm" onClick={() => showToast('Calling ' + c[0] + '…')}><Icon name="phone" size={14} />Call</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
