import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Stat } from '../components/ui.jsx'
import { AreaChart, BarChart, Gauge } from '../components/charts.jsx'
import { BinScene } from '../components/BinScene.jsx'
import { BinGlyph } from '../components/BinGlyph.jsx'
import { TruckRun } from '../components/TruckRun.jsx'
import EventRow from '../components/EventRow.jsx'
import { ZONES, GHATS, ago, fillColor, statusClass } from '../data/model.js'

export default function Dashboard({ openBin }) {
  const { fleet, events, history, stats: s } = useFleet()
  const a1 = fleet[0]
  const zoneFull = ZONES.map((z) => ({ l: GHATS[z].code, v: fleet.filter((b) => b.zone === z && b.fill >= 80).length }))
  return (
    <>
      <PageHeader title="Fleet Dashboard" sub="Real-time overview of all collection points · BIN-A1 streaming live from ESP32" />
      <div className="grid g-kpi mb16">
        <Stat lab="Total Bins" val={s.total} icon="bins" delta="full fleet" />
        <Stat lab="Needs Collection" val={s.full} icon="alert" delta="≥80% fill" deltaType="down" />
        <Stat lab="Avg Fill" val={s.avg} unit="%" icon="chart" delta="+3% vs 1h" deltaType="up" />
        <Stat lab="Collections Today" val={38} icon="truck" delta="+6 vs yest." deltaType="up" />
        <Stat lab="Sensor Faults" val={s.faults} icon="sensor" delta={s.faults ? 'attention' : 'all clear'} deltaType={s.faults ? 'down' : 'up'} />
        <Stat lab="Uptime" val={s.uptime} unit="%" icon="wifi" delta={`${s.online}/${s.total} online`} deltaType="up" decimals={1} />
      </div>

      <Panel title="Fleet at a Glance" hint={`all ${s.total} bins · live`} className="mb16">
        <TruckRun />
        <div className="fleetstrip">
          {fleet.map((b) => (
            <button key={b.id} className={`fleetbin ${statusClass(b.fill)}`} onClick={() => openBin?.(b.id)} title={`${b.name} — ${b.fill}%`}>
              <BinGlyph fill={b.fill} type={b.type} online={b.online} size={46} />
              <span className="nm">{b.id}</span>
              <span className="pc" style={{ color: fillColor(b.fill) }}>{b.fill}%</span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="cols-main mb16">
        <Panel title="Average Fill — last 24 hours" hint="City-wide %">
          <AreaChart data={history} dataKey="avg" />
        </Panel>
        <div className="panel">
          <div className="panel-h"><h3>Live Sensor — BIN-A1</h3><span className="liveflag"><span className="d" />LIVE</span></div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
              <BinScene id={a1.id} fill={a1.fill} type={a1.type} online={a1.online} size={124} />
              <Gauge pct={a1.fill} size={160} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
              {[['DISTANCE', a1.echo.toFixed(0) + ' cm'], ['SIGNAL', a1.rssi + ' dBm'], ['BATTERY', a1.battery + '%'], ['UPDATED', a1.lastUpdateS + 's']].map((m) => (
                <div key={m[0]} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m[0]}</div>
                  <b className="mono" style={{ fontSize: 16 }}>{m[1]}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="cols-side">
        <Panel title="Full Bins by Ghat" hint="count ≥80%">
          <BarChart data={zoneFull} h={200} fmtColor={(d) => (d.v >= 2 ? 'var(--crit)' : d.v === 1 ? 'var(--warn)' : 'var(--accent)')} />
        </Panel>
        <Panel title="Live Event Stream" hint="auto">
          <div className="feed">{events.slice(0, 7).map((e) => <EventRow key={e.id} ev={e} />)}</div>
        </Panel>
      </div>
    </>
  )
}
