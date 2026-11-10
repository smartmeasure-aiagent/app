import { useMemo } from 'react'
import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Stat, Badge } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { BarChart, Donut } from '../components/charts.jsx'
import { ZONES, GHATS, ri } from '../data/model.js'

const REPORTS = [
  ['Weekly Collection Summary', 'Nov 3 – Nov 9', '2.1 MB', 'PDF'],
  ['Zone Performance Report', 'October 2025', '1.4 MB', 'PDF'],
  ['Sensor Uptime Export', 'Q3 2025', '860 KB', 'CSV'],
  ['CO₂ Impact Statement', 'October 2025', '540 KB', 'PDF'],
]

export default function Analytics() {
  const { fleet, showToast } = useFleet()
  // these summary figures are generated once per visit so they read as a stable report
  const { weekly, byHour, zonePerf } = useMemo(() => ({
    weekly: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => ({ l: d, v: ri(28, 52) })),
    byHour: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => ({ l: h, v: ri(1, 9) })),
    zonePerf: ZONES.map((z) => ({ l: `${GHATS[z].code} · ${GHATS[z].short}`, v: ri(70, 98) })),
  }), [])
  const dist = [
    { l: 'Available', v: fleet.filter((b) => b.fill < 50).length, c: 'var(--ok)' },
    { l: 'Almost full', v: fleet.filter((b) => b.fill >= 50 && b.fill < 80).length, c: 'var(--warn)' },
    { l: 'Full', v: fleet.filter((b) => b.fill >= 80).length, c: 'var(--crit)' },
  ]
  return (
    <>
      <PageHeader title="Analytics & Reports" sub="Operational trends, environmental impact and downloadable reports" />
      <div className="grid g-kpi mb16">
        <Stat lab="Collections (7d)" val={276} icon="truck" delta="+9%" deltaType="up" />
        <Stat lab="Avg Fill at Pickup" val={84} unit="%" icon="chart" delta="+2%" deltaType="up" />
        <Stat lab="Diversion Rate" val={42} unit="%" icon="recycle" delta="+2.3pt" deltaType="up" />
        <Stat lab="Distance Saved" val={318} unit="km" icon="map" delta="route opt." deltaType="up" />
        <Stat lab="CO₂ Avoided" val={1.9} unit="t" icon="bolt" delta="this week" deltaType="up" decimals={1} />
      </div>
      <div className="cols-main mb16">
        <Panel title="Weekly Collections" hint="last 7 days"><BarChart data={weekly} h={210} /></Panel>
        <Panel title="Fill Distribution"><Donut segs={dist} size={150} /></Panel>
      </div>
      <div className="cols-main mb16">
        <Panel title="Collections by Hour" hint="today"><BarChart data={byHour} h={200} color="var(--info)" unit=" coll." /></Panel>
        <Panel title="Ghat Performance" hint="service score">
          {zonePerf.map((z) => (
            <div className="hbar" key={z.l}><span className="nm">{z.l}</span>
              <div className="meter"><i style={{ width: z.v + '%', background: z.v >= 90 ? 'var(--ok)' : z.v >= 80 ? 'var(--warn)' : 'var(--crit)' }} /></div>
              <span className="vl">{z.v}%</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Generated Reports">
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Report</th><th>Period</th><th>Size</th><th>Format</th><th className="r">Download</th></tr></thead>
            <tbody>
              {REPORTS.map((r) => (
                <tr key={r[0]}>
                  <td><b>{r[0]}</b></td><td>{r[1]}</td><td className="mono">{r[2]}</td><td><Badge cls="mut">{r[3]}</Badge></td>
                  <td className="r"><button className="tbtn btn-sm" onClick={() => showToast('Preparing "' + r[0] + '"…')}><Icon name="download" size={14} />Download</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
