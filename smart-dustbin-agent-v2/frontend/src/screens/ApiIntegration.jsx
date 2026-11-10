import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Stat, Badge } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { API_KEYS, ENDPOINTS } from '../data/model.js'

export default function ApiIntegration() {
  const { showToast } = useFleet()
  const copy = (suffix) => {
    try { navigator.clipboard?.writeText('pk_live_' + suffix) } catch (e) { /* ignore */ }
    showToast('API key copied')
  }
  return (
    <>
      <PageHeader
        title="API Integration"
        sub="Keys, endpoints and rate limits for the BinPulse API"
        actions={<button className="tbtn btn-pri" onClick={() => showToast('New API key generated')}><Icon name="plus" size={16} />Generate key</button>}
      />
      <div className="grid g-3 mb16">
        <Stat lab="Active Keys" val={API_KEYS.filter((k) => k[3] === 'Active').length} icon="api" />
        <Stat lab="Requests (24h)" val={48291} icon="cloud" delta="+5%" deltaType="up" />
        <Stat lab="Rate Limit" val={300} unit="/min" icon="bolt" delta="peak tier" />
      </div>
      <Panel title="API Keys">
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Key</th><th>Rate Limit</th><th>Created</th><th>Status</th><th className="r">Action</th></tr></thead>
            <tbody>
              {API_KEYS.map((k) => (
                <tr key={k[2]}>
                  <td><b>{k[0]}</b></td>
                  <td className="mono">{k[1]}••••••••{k[2]}</td>
                  <td className="mono">{k[4]}</td>
                  <td style={{ color: 'var(--muted)' }}>{k[5]}</td>
                  <td>{k[3] === 'Active' ? <Badge cls="ok">Active</Badge> : <Badge cls="crit">Revoked</Badge>}</td>
                  <td className="r"><button className="tbtn btn-sm" onClick={() => copy(k[2])}>Copy</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div style={{ height: 16 }} />
      <Panel title="Endpoint Reference" hint="live /api/voice/*">
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e[1]}>
                  <td><Badge cls={e[0] === 'GET' ? 'info' : 'warn'}>{e[0]}</Badge></td>
                  <td className="mono"><b>{e[1]}</b></td>
                  <td style={{ color: 'var(--muted)' }}>{e[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
