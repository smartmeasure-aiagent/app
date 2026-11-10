import { useState, useEffect, useCallback } from 'react'
import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Toggle } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { simStatus, simStart, simStop, simStep, API_BASE } from '../data/api.js'

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

/** Live control for the backend's two synthetic data generators.
 *  'fleet' drives the 16-bin network; 'single' drives the BIN-A1 reference unit. */
function Generator({ target, title, note, showToast }) {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [interval_, setInterval_] = useState('3')
  const [surge, setSurge] = useState('2')

  const load = useCallback(() => {
    simStatus(target).then((d) => { setState(d); setErr('') })
                     .catch((e) => setErr(e.message || 'unreachable'))
  }, [target])

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id) }, [load])

  const act = async (fn, label) => {
    setBusy(true)
    try { setState(await fn()); showToast(`${title}: ${label}`); setErr('') }
    catch (e) { setErr(e.message || 'command failed') }
    finally { setBusy(false) }
  }

  const running = !!state?.running
  const cfg = state?.config || {}
  const startBody = target === 'fleet'
    ? { interval: Number(interval_) || 3, surge: Number(surge) || 1 }
    : { interval: Number(interval_) || 3, speed: 0, fault_chance: 0.04, bin_height: 60,
        device_id: 'BIN-A1', fw: '1.4.2', auto_collect: true }

  return (
    <Panel title={title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="livepill" style={running ? undefined : { color: 'var(--muted)', background: 'var(--surface-2)' }}>
          <span className="livedot" style={running ? undefined : { background: 'var(--muted)', animation: 'none' }} />
          {running ? 'GENERATING' : 'STOPPED'}
        </span>
        <span className="hint">{note}</span>
      </div>
      {err && <div style={{ fontSize: 12, color: 'var(--crit)', marginBottom: 8 }}>Backend unreachable: {err}</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>Tick interval (s)</div>
          <input className="inp" style={{ width: '100%' }} value={interval_} onChange={(e) => setInterval_(e.target.value)} />
        </div>
        {target === 'fleet' && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>Crowd surge ×</div>
            <input className="inp" style={{ width: '100%' }} value={surge} onChange={(e) => setSurge(e.target.value)} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="tbtn btn-pri btn-sm" disabled={busy} onClick={() => act(() => simStart(target, startBody), running ? 'reconfigured' : 'started')}>
          <Icon name="play" size={14} />{running ? 'Apply' : 'Start'}
        </button>
        <button className="tbtn btn-sm" disabled={busy || !running} onClick={() => act(() => simStop(target), 'stopped')}>Stop</button>
        <button className="tbtn btn-sm" disabled={busy} onClick={() => act(() => simStep(target), 'stepped one tick')}>
          <Icon name="plus" size={14} />Step once
        </button>
      </div>
      {state && (
        <div className="hint" style={{ marginTop: 10, lineHeight: 1.6 }}>
          interval {cfg.interval}s{cfg.surge !== undefined && ` · surge ${cfg.surge}×`}
          {cfg.fault_chance !== undefined && ` · fault ${(cfg.fault_chance * 100).toFixed(1)}%`}
          {state.fleet && <><br />{state.fleet.bins} bins · {state.fleet.ghats} ghats</>}
          {state.stats_run && <><br />{state.stats_run.ticks} ticks · {state.stats_run.collections} collections · {state.stats_run.alerts_raised} alerts</>}
          {state.stats && <><br />{state.stats.readings} readings · {state.stats.faults} faults · fill {state.stats.current_fill}%</>}
          {state.storage && <><br />stored: {state.storage.fleet_readings ?? 0} readings, {state.storage.fleet_events ?? 0} events</>}
        </div>
      )}
    </Panel>
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
          <Generator target="fleet" title="Synthetic Data · Fleet"
            note="16 bins across 5 ghats" showToast={showToast} />
          <Generator target="single" title="Synthetic Data · Reference Bin"
            note="drives BIN-A1 and the voice endpoints" showToast={showToast} />
          <Panel title="Backend & Data">
            <Field lab="API base URL" value={API_BASE} />
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
