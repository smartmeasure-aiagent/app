import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Toggle } from '../components/ui.jsx'

export default function Notifications() {
  const { notif, toggleNotif } = useFleet()
  const Row = ({ id, t, d }) => (
    <div className="tgrow"><div><div className="t">{t}</div><div className="d">{d}</div></div><Toggle on={notif[id]} onChange={() => toggleNotif(id)} /></div>
  )
  return (
    <>
      <PageHeader title="Notification Settings" sub="Choose how and when BinPulse reaches you" />
      <div className="cols-main">
        <div className="col">
          <Panel title="Delivery Channels">
            <Row id="push" t="Push notifications" d="Browser & mobile app" />
            <Row id="email" t="Email" d="ops@binpulse.io" />
            <Row id="sms" t="SMS" d="Critical alerts only" />
            <Row id="whatsapp" t="WhatsApp" d="Field crew updates" />
            <Row id="webhook" t="Webhook" d="POST to your endpoint" />
          </Panel>
          <Panel title="Alert Rules">
            <Row id="full" t="Bin full" d="Fill reaches 80%" />
            <Row id="fault" t="Sensor fault" d="Read failures detected" />
            <Row id="battery" t="Low battery" d="Below 30%" />
            <Row id="offline" t="Bin offline" d="No report for 30 min" />
          </Panel>
        </div>
        <Panel title="Quiet Hours">
          <div className="tgrow"><div><div className="t">Enable quiet hours</div><div className="d">Mute non-critical alerts</div></div><Toggle on={notif.quiet} onChange={() => toggleNotif('quiet')} /></div>
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>From</div><input className="inp" type="time" defaultValue="22:00" style={{ width: '100%' }} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>To</div><input className="inp" type="time" defaultValue="06:00" style={{ width: '100%' }} /></div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>Critical bin-full and sensor-fault alerts always bypass quiet hours.</p>
        </Panel>
      </div>
    </>
  )
}
