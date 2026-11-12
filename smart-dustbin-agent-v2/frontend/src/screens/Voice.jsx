import { useState, useRef, useEffect } from 'react'
import { useFleet } from '../state/FleetContext.jsx'
import { PageHeader, Panel, Stat, Toggle } from '../components/ui.jsx'
import { Icon } from '../components/icons.jsx'
import { VOICE_INTENTS, answerQuery } from '../data/model.js'
import { voiceQuery } from '../data/api.js'
import { speak, listen, LANGS } from '../lib/speech.js'

const SUGGEST = ['Which bins are full?', 'Fleet health summary', 'Fullest bin right now', 'How many need collection?']

export default function Voice() {
  const { fleet, stats, agentOnline, setAgentOnline } = useFleet()
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState([['a', `Hi, I'm the BinPulse voice agent. Ask me anything about the ${stats.total}-bin network — try a suggestion above.`]])
  const [thinking, setThinking] = useState(false)
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('sb-call-lang') || 'en' } catch { return 'en' }
  })
  const [hearing, setHearing] = useState(false)
  const [vr, setVr] = useState(true), [at, setAt] = useState(true), [esc, setEsc] = useState(true)
  const langRef = useRef(lang); langRef.current = lang
  useEffect(() => { try { localStorage.setItem('sb-call-lang', lang) } catch { /* ignore */ } }, [lang])
  const outRef = useRef()
  const maxIntent = Math.max(...VOICE_INTENTS.map((i) => i[1]))

  useEffect(() => { if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight }, [msgs, thinking])

  const typeTimer = useRef()
  const typeOut = (text) => {
    clearInterval(typeTimer.current)
    let i = 0
    setMsgs((m) => [...m, ['a', '']])
    typeTimer.current = setInterval(() => {
      i += 2
      const slice = text.slice(0, i)
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = ['a', i < text.length ? slice + '▋' : text]; return c })
      if (i >= text.length) clearInterval(typeTimer.current)
    }, 16)
  }
  // Ask the agent backend, which grounds its answer in stored readings before a
  // model rewords it. If the agent is not running, answer locally instead.
  const run = (q) => {
    if (!q.trim()) return
    setMsgs((m) => [...m, ['u', q]])
    setInput('')
    setThinking(true)
    const show = (text) => { setThinking(false); typeOut(text); if (vr) speak(text, langRef.current) }
    voiceQuery(q, langRef.current)
      .then((d) => show(d.answer || answerQuery(q, fleet)))
      .catch(() => show(answerQuery(q, fleet)))
  }
  useEffect(() => () => clearInterval(typeTimer.current), [])

  const Setting = ({ t, d, on, onChange }) => (
    <div className="tgrow"><div><div className="t">{t}</div><div className="d">{d}</div></div><Toggle on={on} onChange={onChange} /></div>
  )

  return (
    <>
      <PageHeader
        title="AI Voice Assistant"
        sub="Conversational agent answering fleet queries over voice, phone & chat"
        actions={
          <span className="livepill" style={agentOnline ? undefined : { color: 'var(--muted)', background: 'var(--surface-2)' }}>
            <span className="livedot" style={agentOnline ? undefined : { background: 'var(--muted)', animation: 'none' }} />
            {agentOnline ? 'AGENT ONLINE' : 'AGENT OFFLINE'}
          </span>
        }
      />
      <div className="grid g-kpi mb16">
        <Stat lab="Calls Today" val={72} icon="mic" delta="+12 vs yest." deltaType="up" />
        <Stat lab="Avg Duration" val={58} unit="s" icon="clock" delta="-6s" deltaType="up" />
        <Stat lab="Resolution Rate" val={91} unit="%" icon="check" delta="+4%" deltaType="up" />
      </div>
      <div className="cols-main">
        <div className="panel">
          <div className="panel-h"><h3>Try a Query</h3><span className="hint">answered from live fleet data</span></div>
          <div className="panel-b">
            <div className="dl-langs" style={{ margin: '0 0 12px' }} role="group" aria-label="Assistant language">
              {Object.entries(LANGS).map(([k, v]) => (
                <button key={k} type="button" className={`dl-lang ${lang === k ? 'on' : ''}`}
                  onClick={() => setLang(k)}>{v.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {SUGGEST.map((q) => <button key={q} className="chip" onClick={() => run(q)}>{q}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="inp" style={{ flex: 1 }} placeholder="Ask about bins, fill levels, battery…"
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run(input) }} />
              <button type="button" className={`tbtn ${hearing ? 'btn-pri' : ''}`} title="Speak your question"
                onClick={() => { setHearing(true); listen(langRef.current, (x) => { setHearing(false); run(x) }, () => setHearing(false)) }}>
                <Icon name="mic" size={16} />
              </button>
              <button className="tbtn btn-pri" onClick={() => run(input)}>Ask</button>
            </div>
            <div className="transcript" ref={outRef}>
              {msgs.map((m, i) => <div key={i} className={`bubble ${m[0]}`}>{m[1]}</div>)}
              {thinking && <div className="bubble a" style={{ opacity: 0.6 }}>…</div>}
            </div>
          </div>
        </div>
        <div className="col">
          <Panel title="Top Intents">
            {VOICE_INTENTS.map((i) => (
              <div className="hbar" key={i[0]}><span className="nm">{i[0]}</span>
                <div className="meter"><i style={{ width: (i[1] / maxIntent) * 100 + '%', background: 'var(--accent)' }} /></div>
                <span className="vl">{i[1]}%</span>
              </div>
            ))}
          </Panel>
          <Panel title="Agent Settings">
            <Setting t="Agent online" d="Accept new calls" on={agentOnline} onChange={() => setAgentOnline((o) => !o)} />
            <Setting t="Voice responses" d="Speak answers aloud" on={vr} onChange={() => setVr((o) => !o)} />
            <Setting t="Auto-create tickets" d="On overflow reports" on={at} onChange={() => setAt((o) => !o)} />
            <Setting t="Escalate to human" d="When unresolved" on={esc} onChange={() => setEsc((o) => !o)} />
          </Panel>
        </div>
      </div>
    </>
  )
}
