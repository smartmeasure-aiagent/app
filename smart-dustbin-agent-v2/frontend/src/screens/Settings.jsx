import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Toggle } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'

function Field({ lab, value, options }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>{lab}</div>
      {options
        ? <select className="sel" style={{ width: '100%' }} defaultValue={value}>{options.map((o) => <option key={o}>{o}</option>)}</select>
        : <input className="inp" style={{ width: '100%' }} defaultValue={value} />}
    </div>
  )
}

export default function Settings() {
  const { resetBin, showToast } = useFleet()
  return (
    <>
      <PageHeader title="System Settings" sub="Organization, thresholds, data sources and maintenance" />
      <div className="cols-main">
        <div className="col">
          <Panel title="General">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field lab="Organization" value="QuantumDataLeap Waste" />
              <Field lab="Timezone" value="UTC−8 Pacific" options={['UTC−8 Pacific', 'UTC−5 Eastern', 'UTC+0 London', 'UTC+5 Karachi']} />
              <Field lab="Units" value="Metric (L, km, °C)" options={['Metric (L, km, °C)', 'Imperial (gal, mi, °F)']} />
              <Field lab="Theme" value="System" options={['System', 'Light', 'Dark']} />
            </div>
          </Panel>
          <Panel title="Fill Thresholds">
            <div className="col">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span className="t" style={{ fontWeight: 600 }}>Almost full</span><b className="mono" style={{ color: 'var(--warn)' }}>50%</b></div>
                <input type="range" min="30" max="70" defaultValue="50" style={{ width: '100%', accentColor: 'var(--warn)' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span className="t" style={{ fontWeight: 600 }}>Full (needs collection)</span><b className="mono" style={{ color: 'var(--crit)' }}>80%</b></div>
                <input type="range" min="70" max="95" defaultValue="80" style={{ width: '100%', accentColor: 'var(--crit)' }} />
              </div>
            </div>
          </Panel>
        </div>
        <div className="col">
          <Panel title="Backend & Data">
            <Field lab="API base URL" value="https://api.binpulse.io" />
            <div style={{ height: 12 }} />
            <Field lab="Poll interval" value="3 seconds" options={['1 second', '3 seconds', '10 seconds', '30 seconds']} />
            <div style={{ height: 12 }} />
            <div className="tgrow" style={{ paddingTop: 12 }}><div><div className="t">Live ESP32 overlay</div><div className="d">Stream BIN-A1 from hardware</div></div><Toggle on onChange={() => {}} /></div>
          </Panel>
          <div className="panel danger">
            <div className="panel-h" style={{ borderColor: 'color-mix(in srgb,var(--crit) 30%,var(--border))' }}><h3 style={{ color: 'var(--crit)' }}>Danger Zone</h3></div>
            <div className="panel-b col">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div><b>Reset live bin</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>Clears BIN-A1 fill reading (POST /api/reset)</div></div>
                <button className="tbtn btn-sm" style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }} onClick={() => { resetBin(); showToast('BIN-A1 reset via /api/reset') }}><Icon name="reset" size={14} />Reset</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div><b>Export all data</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>Download full fleet snapshot (CSV)</div></div>
                <button className="tbtn btn-sm" onClick={() => showToast('Exporting fleet snapshot (CSV)…')}><Icon name="download" size={14} />Export</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
