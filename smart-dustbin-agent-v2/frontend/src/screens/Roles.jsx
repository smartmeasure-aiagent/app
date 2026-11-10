import { PageHeader, Panel } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { ROLES, PERM_KEYS, USERS } from '../data/model.js'

export default function Roles() {
  return (
    <>
      <PageHeader title="Roles & Permissions" sub="Access control across the BinPulse platform" />
      <div className="grid g-3 mb16">
        {ROLES.map((r) => (
          <div className="panel pad" key={r.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: r.color + '22', color: r.color, display: 'grid', placeItems: 'center' }}><Icon name="shield" size={18} /></span>
              <div><b style={{ fontFamily: 'var(--font-d)' }}>{r.name}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.desc}</div></div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {r.perms.reduce((a, b) => a + b, 0)} of {PERM_KEYS.length} permissions · {USERS.filter((u) => u[2] === r.name).length} user(s)
            </div>
          </div>
        ))}
      </div>
      <Panel title="Permission Matrix">
        <div className="permgrid">
          <table>
            <thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r.name}>{r.name}</th>)}</tr></thead>
            <tbody>
              {PERM_KEYS.map((p, pi) => (
                <tr key={p}>
                  <td>{p}</td>
                  {ROLES.map((r) => (
                    <td key={r.name}>{r.perms[pi] ? <span className="tick"><Icon name="check" size={16} /></span> : <span className="cross">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
