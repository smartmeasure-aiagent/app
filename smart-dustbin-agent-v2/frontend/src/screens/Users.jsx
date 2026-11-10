import { useState } from 'react'
import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Badge } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { USERS, colorFor, initials } from '../data/model.js'

const roleCls = (r) => (r === 'Admin' ? 'acc' : r === 'Dispatcher' ? 'info' : r === 'Analyst' ? 'warn' : 'mut')

export default function Users() {
  const { showToast } = useFleet()
  const [q, setQ] = useState('')
  const list = USERS.filter((u) => (u[0] + u[1] + u[2]).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHeader
        title="User Management"
        sub="Team members, roles and access status"
        actions={<button className="tbtn btn-pri" onClick={() => showToast('Invite link copied to clipboard')}><Icon name="plus" size={16} />Invite user</button>}
      />
      <div className="filterbar">
        <label className="searchbox" style={{ maxWidth: 280, margin: 0 }}>
          <Icon name="search" />
          <input placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <Panel>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Active</th><th className="r">Actions</th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u[0]}>
                  <td><div className="who"><div className="avatar" style={{ background: colorFor(u[0]) }}>{initials(u[0])}</div><span><span className="nm">{u[0]}</span><span className="sc">{u[1]}@binpulse.io</span></span></div></td>
                  <td><Badge cls={roleCls(u[2])}>{u[2]}</Badge></td>
                  <td>{u[3] === 'Active' ? <Badge cls="ok">Active</Badge> : u[3] === 'Idle' ? <Badge cls="warn">Idle</Badge> : <Badge cls="mut">Offline</Badge>}</td>
                  <td style={{ color: 'var(--muted)' }}>{u[4]}</td>
                  <td className="r"><button className="tbtn btn-sm" onClick={() => showToast('Editing ' + u[0])}><Icon name="edit" size={14} />Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
