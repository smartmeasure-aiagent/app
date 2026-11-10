import { useEffect, useRef, useState, useCallback } from 'react'
import { Icon } from './icons.jsx'
import { Badge } from './ui.jsx'
import { fetchActiveCalls, answerCall, sayToCall, endCall } from '../data/api.js'

// Browsers block speech synthesis until a user gesture, which is why the agent
// only starts talking after Answer is pressed.
function speak(text, onDone) {
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-IN'; u.rate = 1.02
    u.onend = onDone; u.onerror = onDone
    window.speechSynthesis.speak(u)
  } catch { onDone?.() }
}

function listen(onText, onErr) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { onErr?.('Speech recognition needs Chrome or Edge. Type instead.'); return }
  const rec = new SR()
  rec.lang = 'en-IN'; rec.interimResults = false; rec.maxAlternatives = 1
  rec.onresult = (e) => onText(e.results[0][0].transcript)
  rec.onerror = (e) => onErr?.(e.error === 'not-allowed'
    ? 'Microphone permission denied.' : `Could not hear you (${e.error}).`)
  rec.start()
}

const POLL_MS = 4000

/**
 * Automated collection call, delivered in the browser.
 *
 * When a bin crosses the alert threshold the agent backend places a call. With
 * no Twilio credentials it rings here instead of on the phone network: the page
 * speaks the opening line and relays replies through the grounded assistant.
 *
 * Renders nothing unless a call is live, so it is safe to mount globally.
 */
export default function CallOverlay() {
  const [call, setCall] = useState(null)
  const [note, setNote] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [hearing, setHearing] = useState(false)
  const dismissed = useRef(new Set())   // ids declined in this session
  const bodyRef = useRef(null)

  // Poll for ringing calls. A connected call is kept as-is so the transcript is
  // not clobbered mid-conversation; it only clears when the backend drops it
  // (for example the bin was emptied, which hangs up automatically).
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const { calls } = await fetchActiveCalls()
        if (cancelled) return
        setCall((prev) => {
          if (prev && prev.state === 'active') {
            if (!calls.some((c) => c.id === prev.id)) {
              setNote('The bin no longer needs collection. Call ended.')
              return null
            }
            return prev
          }
          return calls.find((c) => c.state === 'active')
              || calls.find((c) => c.state === 'ringing' && !dismissed.current.has(c.id))
              || null
        })
      } catch { /* agent backend not running: nothing to ring */ }
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [call?.transcript?.length, note])

  const onAnswer = async () => {
    setBusy(true); setNote('Connecting…')
    try {
      const d = await answerCall(call.id)
      setCall(d); setNote('Agent speaking…')
      speak(d.opening_line, () => setNote('Your turn — tap the mic or type a reply.'))
    } catch (e) { setNote(e.message || 'Could not answer') } finally { setBusy(false) }
  }

  const onDecline = async () => {
    const id = call.id
    dismissed.current.add(id); setCall(null); window.speechSynthesis?.cancel()
    endCall(id, 'declined').catch(() => {})
  }

  const onHangUp = async () => {
    const id = call.id
    setCall(null); setNote(''); window.speechSynthesis?.cancel()
    endCall(id, 'ended').catch(() => {})
  }

  const say = useCallback(async (text) => {
    if (!text.trim() || !call) return
    setReply(''); setBusy(true); setNote('Agent thinking…')
    try {
      const d = await sayToCall(call.id, text)
      setCall(d.call); setNote('Agent speaking…')
      speak(d.reply, () => setNote('Your turn — tap the mic or type a reply.'))
    } catch (e) { setNote(e.message || 'Call turn failed') } finally { setBusy(false) }
  }, [call])

  const onMic = () => {
    setHearing(true); setNote('Listening…')
    listen((t) => { setHearing(false); say(t) }, (m) => { setHearing(false); setNote(m) })
  }

  if (!call) return null
  const sevCls = call.severity === 'critical' || call.severity === 'high' ? 'crit' : 'warn'

  return (
    <div className="callwrap" role="dialog" aria-label="Automated collection call">
      <div className="dialler">
        {call.state === 'ringing' ? (
          <div className="dl-ring">
            <span className="dl-pulse"><Icon name="phone" size={26} /></span>
            <div className="dl-eyebrow">INCOMING AUTOMATED CALL</div>
            <h3>{call.bin_id} needs collection</h3>
            <p className="dl-sub">
              {call.location || 'Location not reported'} · {Math.round(call.fill)}% full{' '}
              <Badge cls={sevCls}>{call.severity}</Badge>
            </p>
            <p className="dl-hint">The agent reads the alert aloud, then answers your questions.</p>
            <div className="dl-btns">
              <button className="tbtn btn-pri" disabled={busy} onClick={onAnswer}>
                <Icon name="phone" size={15} />Answer
              </button>
              <button className="tbtn dl-decline" onClick={onDecline}>Decline</button>
            </div>
          </div>
        ) : (
          <>
            <div className="dl-head">
              <div>
                <div className="dl-eyebrow">ON CALL · {call.bin_id}</div>
                <h3>{Math.round(call.fill)}% full</h3>
                <p className="dl-sub">{call.location || 'Location not reported'}</p>
              </div>
              <button className="tbtn dl-decline btn-sm" onClick={onHangUp}>End call</button>
            </div>
            <div className="dl-body" ref={bodyRef}>
              {call.transcript.map((t, i) => (
                <div key={i} className={`bubble ${t.role === 'agent' ? 'a' : 'u'}`}>{t.text}</div>
              ))}
            </div>
            <div className="dl-note"><Icon name="wave" size={13} /> {note || 'Connected.'}</div>
            <form className="dl-form" onSubmit={(e) => { e.preventDefault(); say(reply) }}>
              <input className="inp" placeholder="Type a reply, or use the mic"
                value={reply} onChange={(e) => setReply(e.target.value)} disabled={busy} />
              <button type="button" className={`tbtn ${hearing ? 'btn-pri' : ''}`}
                onClick={onMic} disabled={busy} title="Speak"><Icon name="mic" size={16} /></button>
              <button className="tbtn btn-pri" disabled={busy || !reply.trim()}>Send</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
