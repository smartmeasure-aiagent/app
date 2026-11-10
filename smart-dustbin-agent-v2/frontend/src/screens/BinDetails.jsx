import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, StatusBadge } from '../components/ui.jsx'
import { Gauge, Spark } from '../components/charts.jsx'
import { BinScene } from '../components/BinScene.jsx'
import { Icon } from '../components/icons.jsx'
import { fillColor, ago, GHATS, DENSITY } from '../data/model.js'

function MiniStat({ icon, lab, val, cls }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 11 }}>
        <span className={`b-${cls}`} style={{ width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center' }}><Icon name={icon} size={13} /></span>
        {lab}
      </div>
      <b className="mono" style={{ display: 'block', marginTop: 5, fontSize: 15 }}>{val}</b>
    </div>
  )
}
const batClass = (b) => (b < 30 ? 'crit' : b < 55 ? 'warn' : 'ok')

export default function BinDetails({ selectedBin, setSelectedBin, openBin, go }) {
  const { fleet } = useFleet()
  const b = fleet.find((x) => x.id === selectedBin) || fleet[0]
  const g = GHATS[b.zone] || {}
  const den = DENSITY[b.density] || {}
  const coords = g.lat
    ? `${(g.lat + (46 - b.y) / 9000).toFixed(5)}, ${(g.lng + (b.x - 40) / 9000).toFixed(5)}`
    : '—'
  const specs = [
    ['Bin ID', b.id], ['Type', b.type], ['Capacity', b.capacity + ' L'],
    ['Ghat / Grid cell', b.zone + ' · ' + b.sector], ['Assigned Team', 'Team ' + b.team],
    ['Density zone', `${den.label} — ${den.spacing} spacing · check ${den.interval}`],
    ['Coordinates', coords],
    ['Distance (RMC)', b.distance + ' km'], ['Temperature', b.temp + ' °C'],
    ['Fill Rate', b.fillRate + ' %/h'], ['Firmware', b.firmware],
  ]
  const others = fleet.filter((x) => x.id !== b.id)
  return (
    <>
      <PageHeader
        title={b.name}
        sub={`${b.id} · ${b.sector} · ${b.zone}`}
        actions={
          <>
            <select className="sel" value={b.id} onChange={(e) => setSelectedBin(e.target.value)}>
              {fleet.map((x) => <option key={x.id} value={x.id}>{x.id} — {x.name}</option>)}
            </select>
            <button className="tbtn" onClick={() => go('map')}><Icon name="map" size={16} />View on map</button>
          </>
        }
      />
      <div className="cols-side mb16">
        <div className="panel">
          <div className="panel-h"><h3>Current Fill</h3>{b.isReal ? <span className="liveflag"><span className="d" />LIVE ESP32</span> : <StatusBadge fill={b.fill} />}</div>
          <div className="panel-b" style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 20, alignItems: 'center' }}>
            <BinScene id={b.id} fill={b.fill} type={b.type} online={b.online} size={128} />
            <Gauge pct={b.fill} size={170} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <MiniStat icon="battery" lab="Battery" val={b.battery + '%'} cls={batClass(b.battery)} />
              <MiniStat icon="signal" lab="Signal" val={b.rssi + ' dBm'} cls={b.rssi > -70 ? 'ok' : 'warn'} />
              <MiniStat icon="clock" lab="Last seen" val={ago(b.lastUpdateS)} cls="info" />
              <MiniStat icon="sensor" lab="Sensor" val={b.sensorOk ? 'Healthy' : 'Fault'} cls={b.sensorOk ? 'ok' : 'crit'} />
              <MiniStat icon="temp" lab="Temp" val={b.temp + '°C'} cls="info" />
              <MiniStat icon="bolt" lab="Fill rate" val={b.fillRate + ' %/h'} cls="warn" />
            </div>
          </div>
        </div>
        <Panel title="Fill Trend — 16 reads">
          <div style={{ height: 90 }}><Spark data={b.spark} w={600} h={90} color={fillColor(b.fill)} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}><span>-8h</span><span>now</span></div>
        </Panel>
      </div>
      <div className="cols-main">
        <Panel title="Specifications">
          <div className="spec">{specs.map((s) => <div key={s[0]} style={{ display: 'contents' }}><div className="k">{s[0]}</div><div className="v">{s[1]}</div></div>)}</div>
        </Panel>
        <Panel title="Nearby Bins">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {others.slice(0, 6).map((o) => (
              <button key={o.id} className="navitem" style={{ color: 'var(--fg)' }} onClick={() => openBin(o.id)}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{o.id}</span>
                <span>{o.name}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: fillColor(o.fill) }}>{o.fill}%</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}
