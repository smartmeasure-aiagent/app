import { useMemo } from 'react'
import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Stat, Badge } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { Donut } from '../components/charts.jsx'
import { ri } from '../data/model.js'

export default function Devices() {
  const { fleet, stats: s } = useFleet()
  const fwSeg = useMemo(() => {
    const fw = {}
    fleet.forEach((b) => { fw[b.firmware] = (fw[b.firmware] || 0) + 1 })
    const cols = ['var(--accent)', 'var(--info)', 'var(--warn)', 'var(--crit)']
    return Object.entries(fw).map(([k, v], i) => ({ l: k, v, c: cols[i % 4] }))
  }, [fleet])
  // deterministic per-bin uptime so numbers don't jitter every tick
  const uptime = useMemo(() => Object.fromEntries(fleet.map((b) => [b.id, `${ri(92, 99)}.${ri(0, 9)}%`])), []) // eslint-disable-line
  const maint = fleet.filter((b) => !b.sensorOk || b.battery < 30 || !b.online)
  const batColor = (b) => (b < 30 ? 'var(--crit)' : b < 55 ? 'var(--warn)' : 'var(--ok)')
  return (
    <>
      <PageHeader title="Device Health" sub="Power, connectivity and firmware across all ESP32 sensor nodes" />
      <div className="grid g-kpi mb16">
        <Stat lab="Devices Online" val={s.online} icon="wifi" delta={s.uptime + '% uptime'} deltaType="up" />
        <Stat lab="Avg Battery" val={s.avgBat} unit="%" icon="battery" delta="-1% / day" deltaType="down" />
        <Stat lab="Low Battery" val={s.lowBat} icon="bolt" delta="<30%" deltaType="down" />
        <Stat lab="Maintenance Due" val={maint.length} icon="settings" delta="queued" />
      </div>
      <div className="cols-main">
        <div className="panel">
          <div className="panel-h"><h3>Device Roster</h3><span className="hint">{fleet.length} nodes</span></div>
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th>Device</th><th>Battery</th><th>Signal</th><th>Firmware</th><th>Uptime</th><th>Status</th></tr></thead>
              <tbody>
                {fleet.map((b) => (
                  <tr key={b.id}>
                    <td><b>{b.id}</b><div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.name}</div></td>
                    <td style={{ minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="meter" style={{ width: 60 }}><i style={{ width: b.battery + '%', background: batColor(b.battery) }} /></div>
                        <span className="mono" style={{ fontSize: 11 }}>{b.battery}%</span>
                      </div>
                    </td>
                    <td className="mono">{b.rssi} dBm</td>
                    <td className="mono">{b.firmware}</td>
                    <td className="mono">{uptime[b.id]}</td>
                    <td>{!b.online ? <Badge cls="crit">Offline</Badge> : !b.sensorOk ? <Badge cls="warn">Fault</Badge> : <Badge cls="ok">Healthy</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="col">
          <Panel title="Firmware Versions"><Donut segs={fwSeg} size={140} /></Panel>
          <Panel title="Maintenance Queue">
            {maint.length === 0 && <p style={{ color: 'var(--muted)' }}>No maintenance needed.</p>}
            {maint.map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="b-warn" style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center' }}><Icon name="settings" size={14} /></span>
                <div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>{b.id}</b><div style={{ fontSize: 11, color: 'var(--muted)' }}>{!b.online ? 'Offline' : !b.sensorOk ? 'Sensor fault' : 'Low battery'}</div></div>
                <button className="tbtn btn-sm">Assign</button>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  )
}
