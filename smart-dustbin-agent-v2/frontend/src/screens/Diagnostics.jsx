import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Stat, Badge } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { fillColor } from '../data/model.js'

export default function Diagnostics() {
  const { fleet, showToast } = useFleet()
  const sensorsOk = fleet.filter((b) => b.sensorOk).length
  const failed = fleet.reduce((a, b) => a + b.failedReads, 0)
  const avgEcho = Math.round(fleet.reduce((a, b) => a + b.echo, 0) / fleet.length)
  const a1 = fleet[0]
  const pipeline = [
    ['sensor', 'Ultrasonic', 'HC-SR04'],
    ['cpu', 'ESP32', 'firmware ' + a1.firmware],
    ['wifi', 'Wi-Fi', a1.rssi + ' dBm'],
    ['api', 'API', '/api/status'],
    ['dashboard', 'Dashboard', 'live'],
  ]
  return (
    <>
      <PageHeader
        title="Sensor Diagnostics"
        sub="Ultrasonic sensor telemetry and data-pipeline integrity"
        actions={<button className="tbtn btn-pri" onClick={() => showToast('Running sensor self-test across ' + fleet.length + ' nodes…')}><Icon name="play" size={16} />Run self-test</button>}
      />
      <div className="grid g-kpi mb16">
        <Stat lab="Sensors OK" val={sensorsOk} icon="sensor" delta={'of ' + fleet.length} deltaType="up" />
        <Stat lab="Failed Reads (1h)" val={failed} icon="alert" delta="across fleet" deltaType="down" />
        <Stat lab="Avg Echo" val={avgEcho} unit="cm" icon="wave" delta="distance" />
        <Stat lab="Pipeline" val={100} unit="%" icon="cloud" delta="healthy" deltaType="up" />
      </div>
      <Panel title="Live Data Pipeline" hint="end to end">
        <div className="pipe">
          {pipeline.map((n, i) => (
            <span key={n[1]} style={{ display: 'contents' }}>
              <div className="node ok">
                <div className="ic"><Icon name={n[0]} size={16} /></div>
                <b>{n[1]}</b><span>{n[2]}</span>
              </div>
              {i < pipeline.length - 1 && <span className="arr"><Icon name="arrow" size={18} /></span>}
            </span>
          ))}
        </div>
      </Panel>
      <div style={{ height: 16 }} />
      <Panel title="Per-Bin Sensor Readout">
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Bin</th><th className="r">Echo (cm)</th><th className="r">Fill %</th><th className="r">Failed Reads</th><th className="r">Distance</th><th>Sensor</th></tr></thead>
            <tbody>
              {fleet.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.id}</b> <span style={{ color: 'var(--muted)', fontSize: 12 }}>{b.name}</span></td>
                  <td className="r mono">{b.echo}</td>
                  <td className="r mono" style={{ color: fillColor(b.fill) }}>{b.fill}%</td>
                  <td className="r mono" style={b.failedReads > 3 ? { color: 'var(--crit)' } : undefined}>{b.failedReads}</td>
                  <td className="r mono">{b.distance} km</td>
                  <td>{b.sensorOk ? <Badge cls="ok">OK</Badge> : <Badge cls="crit">Fault</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
