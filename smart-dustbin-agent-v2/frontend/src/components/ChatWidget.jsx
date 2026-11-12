import { useState, useRef, useEffect } from 'react'
import { useFleet } from '../state/FleetContext.jsx'
import { Icon } from './icons.jsx'
import { answerQuery } from '../data/model.js'
import { voiceQuery } from '../data/api.js'

const SUGGEST = ['Which bins are full?', 'Fleet health summary', 'Fullest bin right now']

// Floating assistant: a bottom-right launcher that opens a compact chat on any page.
// Answers from live fleet data via answerQuery; `go` deep-links to the full assistant.
export default function ChatWidget({ go }) {
  const { fleet, stats } = useFleet()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [msgs, setMsgs] = useState([
    ['a', `Hi! I'm the BinPulse assistant. Ask me anything about the ${stats.total}-bin network.`],
  ])
  const outRef = useRef()
  const typeTimer = useRef()

  useEffect(() => { if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight }, [msgs, thinking, open])
  useEffect(() => () => clearInterval(typeTimer.current), [])

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
  const run = (q) => {
    if (!q.trim()) return
    setMsgs((m) => [...m, ['u', q]])
    setInput('')
    setThinking(true)
    voiceQuery(q, (() => { try { return localStorage.getItem('sb-call-lang') || 'en' } catch { return 'en' } })())
      .then((d) => { setThinking(false); typeOut(d.answer || answerQuery(q, fleet)) })
      .catch(() => { setThinking(false); typeOut(answerQuery(q, fleet)) })
  }

  return (
    <div className="cw">
      {open && (
        <div className="cw-panel" role="dialog" aria-label="BinPulse assistant">
          <div className="cw-head">
            <div className="cw-id">
              <span className="cw-dot" />
              <b>BinPulse Assistant</b>
            </div>
            <div className="cw-head-act">
              {go && (
                <button className="cw-icon" title="Open full assistant" onClick={() => { setOpen(false); go('voice') }}>
                  <Icon name="arrow" size={15} />
                </button>
              )}
              <button className="cw-icon" title="Close" onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>
          <div className="cw-body" ref={outRef}>
            {msgs.map((m, i) => <div key={i} className={`bubble ${m[0]}`}>{m[1]}</div>)}
            {thinking && <div className="bubble a" style={{ opacity: 0.6 }}>…</div>}
          </div>
          <div className="cw-sugg">
            {SUGGEST.map((q) => <button key={q} className="chip" onClick={() => run(q)}>{q}</button>)}
          </div>
          <div className="cw-input">
            <input
              className="inp"
              placeholder="Ask about bins, battery, health…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') run(input) }}
            />
            <button className="cw-send" onClick={() => run(input)} title="Send"><Icon name="arrow" size={16} /></button>
          </div>
        </div>
      )}
      <button
        className={`cw-fab ${open ? 'on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        <Icon name={open ? 'arrow' : 'chat'} size={22} />
      </button>
    </div>
  )
}
