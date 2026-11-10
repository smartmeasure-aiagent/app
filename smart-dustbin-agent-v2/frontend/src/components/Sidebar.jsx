import { Icon } from './icons.jsx'
import { useFleet } from '../state/FleetContext.jsx'

export const NAV = [
  { group: 'Monitor', items: [['dashboard', 'Dashboard', 'dashboard'], ['bins', 'Bin Monitoring', 'bins'], ['bin-details', 'Bin Details', 'bin'], ['map', 'Live Map', 'map']] },
  { group: 'Operations', items: [['alerts', 'Alerts & Notifications', 'alert'], ['collection', 'Collection Management', 'truck'], ['crew', 'Cleaning Team', 'team']] },
  { group: 'Assistant', items: [['voice', 'AI Voice Assistant', 'mic'], ['chat', 'Chat History', 'chat']] },
  { group: 'Insights', items: [['analytics', 'Analytics & Reports', 'chart']] },
  { group: 'Devices', items: [['devices', 'Device Health', 'health'], ['diag', 'Sensor Diagnostics', 'sensor']] },
  { group: 'Administration', items: [['users', 'User Management', 'users'], ['roles', 'Roles & Permissions', 'shield'], ['apiint', 'API Integration', 'api'], ['notif', 'Notification Settings', 'alert'], ['settings', 'System Settings', 'settings']] },
]

export default function Sidebar({ screen, go, open }) {
  const { activeAlerts } = useFleet()
  const al = activeAlerts.length
  return (
    <aside className={`nav ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="logo"><Icon name="bin" size={20} /></div>
        <div><b>BinPulse</b><span>Smart Waste Ops</span></div>
      </div>
      <div className="navscroll">
        {NAV.map((g) => (
          <div className="navgroup" key={g.group}>
            <div className="gl">{g.group}</div>
            {g.items.map(([id, label, icon]) => (
              <button key={id} className={`navitem ${screen === id ? 'active' : ''}`} onClick={() => go(id)}>
                <Icon name={icon} size={17} />
                <span>{label}</span>
                {id === 'alerts' && al > 0 && <span className="nb">{al}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="navfoot">
        <div className="avatar" style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)' }}>RM</div>
        <div style={{ minWidth: 0 }}>
          <div className="who"><span className="nm" style={{ fontSize: 13 }}>Rao Maaz</span></div>
          <div className="sc" style={{ fontSize: 11 }}>Fleet Operator</div>
        </div>
      </div>
    </aside>
  )
}
