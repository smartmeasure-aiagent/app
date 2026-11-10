import { useState } from 'react'
import { PageHeader, Stat, Badge } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { CHAT_SESSIONS, colorFor } from '../data/model.js'

const chIcon = { Phone: 'phone', API: 'api', WhatsApp: 'chat', Voice: 'mic' }

export default function Chat() {
  const [ch, setCh] = useState('all')
  const [open, setOpen] = useState({})
  const sessions = ch === 'all' ? CHAT_SESSIONS : CHAT_SESSIONS.filter((s) => s.ch === ch)
  const outcomeBadge = (o) => (o === 'Resolved' ? <Badge cls="ok">Resolved</Badge> : o === 'Escalated' ? <Badge cls="crit">Escalated</Badge> : <Badge cls="warn">{o}</Badge>)
  return (
    <>
      <PageHeader title="Chat History" sub="Full transcripts across voice, phone, WhatsApp and API channels" />
      <div className="grid g-kpi mb16">
        <Stat lab="Sessions Today" val={CHAT_SESSIONS.length + 19} icon="chat" delta="+8" deltaType="up" />
        <Stat lab="Resolved" val={87} unit="%" icon="check" delta="+3%" deltaType="up" />
        <Stat lab="Avg Handle Time" val={52} unit="s" icon="clock" delta="-5s" deltaType="up" />
        <Stat lab="Escalations" val={3} icon="alert" delta="2.4%" />
      </div>
      <div className="filterbar">
        {['all', 'Voice', 'Phone', 'WhatsApp', 'API'].map((c) => (
          <button key={c} className={`chip ${ch === c ? 'on' : ''}`} onClick={() => setCh(c)}>{c === 'all' ? 'All channels' : c}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions.map((s, i) => (
          <div className="panel" key={i}>
            <button className="panel-h" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--border)', textAlign: 'left' }}
              onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="avatar" style={{ background: colorFor(s.caller), width: 34, height: 34 }}><Icon name={chIcon[s.ch]} size={16} /></div>
                <div><div className="nm" style={{ fontWeight: 700 }}>{s.caller}</div><div className="sc" style={{ fontSize: 12, color: 'var(--muted)' }}>{s.intent} · {s.time} · {s.dur}</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Badge cls="info">{s.ch}</Badge>{outcomeBadge(s.outcome)}<span style={{ color: 'var(--muted)' }}>{open[i] ? '▴' : '▾'}</span></div>
            </button>
            {open[i] && (
              <div className="panel-b">
                <div className="transcript">{s.msgs.map((m, j) => <div key={j} className={`bubble ${m[0]}`}>{m[1]}</div>)}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
