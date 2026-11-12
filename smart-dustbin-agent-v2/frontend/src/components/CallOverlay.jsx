import { useEffect, useRef, useState, useCallback } from 'react'
import { Icon } from './icons.jsx'
import { Badge, Toggle } from './ui.jsx'
import { fetchActiveCalls, answerCall, sayToCall, endCall } from '../data/api.js'
import { startRing, primeAudio, isAudioReady } from '../lib/ringtone.js'
import { speak, listen, canSpeak, LANGS } from '../lib/speech.js'


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
  const [handsFree, setHandsFree] = useState(true)
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('sb-call-lang') || 'en' } catch { return 'en' }
  })
  const [voiceMissing, setVoiceMissing] = useState(false)
  const [audioReady, setAudioReady] = useState(isAudioReady)
  const dismissed = useRef(new Set())   // ids declined in this session
  const bodyRef = useRef(null)
  // Read inside speech callbacks, which capture state at the time they were made.
  const handsFreeRef = useRef(handsFree)
  handsFreeRef.current = handsFree
  const langRef = useRef(lang)
  langRef.current = lang
  const micRef = useRef(null)
  const recRef = useRef(null)

  // The audio context cannot start until the user has interacted with the page,
  // so prime it on the first gesture anywhere and remember that sound now works.
  useEffect(() => {
    if (audioReady) return
    const unlock = () => {
      primeAudio()
      // resume() is async; check on the next tick before trusting it.
      setTimeout(() => { if (isAudioReady()) setAudioReady(true) }, 60)
    }
    const opts = { passive: true }
    window.addEventListener('pointerdown', unlock, opts)
    window.addEventListener('keydown', unlock, opts)
    return () => {
      window.removeEventListener('pointerdown', unlock, opts)
      window.removeEventListener('keydown', unlock, opts)
    }
  }, [audioReady])

  // Remember the choice, and find out whether a voice exists for it.
  useEffect(() => {
    try { localStorage.setItem('sb-call-lang', lang) } catch { /* private mode */ }
    canSpeak(lang).then((ok) => setVoiceMissing(!ok))
  }, [lang])

  // Ring for as long as the call is unanswered.
  useEffect(() => {
    if (call?.state !== 'ringing' || !audioReady) return
    return startRing()
  }, [call?.state, call?.id, audioReady])

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

  // Never leave speech or the mic running if this unmounts mid-call.
  useEffect(() => () => {
    window.speechSynthesis?.cancel()
    try { recRef.current?.abort?.() } catch { /* not listening */ }
  }, [])

  // Once the agent stops talking, open the mic automatically so the call flows
  // like a real one. Falls back to the prompt when hands-free is off.
  const afterSpeaking = () => {
    if (handsFreeRef.current) micRef.current?.()
    else setNote('Your turn — tap the mic or type a reply.')
  }

  const onAnswer = async () => {
    primeAudio()   // this click is the gesture that lets audio play
    setBusy(true); setNote('Connecting…')
    try {
      const d = await answerCall(call.id, langRef.current)
      setCall(d); setNote('Agent speaking…')
      speak(d.opening_line, langRef.current, afterSpeaking)
    } catch (e) { setNote(e.message || 'Could not answer') } finally { setBusy(false) }
  }

  const stopAudio = () => {
    window.speechSynthesis?.cancel()
    try { recRef.current?.abort?.() } catch { /* not listening */ }
    recRef.current = null
  }

  const onDecline = () => {
    const id = call.id
    dismissed.current.add(id); setCall(null); stopAudio()
    endCall(id, 'declined').catch(() => {})
  }

  const onHangUp = () => {
    const id = call.id
    setCall(null); setNote(''); stopAudio()
    endCall(id, 'ended').catch(() => {})
  }

  const say = useCallback(async (text) => {
    if (!text.trim() || !call) return
    setReply(''); setBusy(true); setNote('Agent thinking…')
    try {
      const d = await sayToCall(call.id, text, langRef.current)
      setCall(d.call); setNote('Agent speaking…')
      speak(d.reply, langRef.current, afterSpeaking)
    } catch (e) { setNote(e.message || 'Call turn failed') } finally { setBusy(false) }
  }, [call])

  const onMic = useCallback(() => {
    setHearing(true); setNote('Listening… speak now.')
    recRef.current = listen(
      langRef.current,
      (t) => { setHearing(false); say(t) },
      (m) => { setHearing(false); setNote(m) },
    )
  }, [say])
  micRef.current = onMic

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
            <p className="dl-hint">
              {audioReady
                ? 'The agent reads the alert aloud, then answers your questions.'
                : 'Ringtone is muted until you interact with the page — answering turns sound on.'}
            </p>
            <div className="dl-langs" role="group" aria-label="Call language">
              {Object.entries(LANGS).map(([k, v]) => (
                <button key={k} type="button"
                  className={`dl-lang ${lang === k ? 'on' : ''}`}
                  onClick={() => setLang(k)}>{v.label}</button>
              ))}
            </div>
            {voiceMissing && (
              <p className="dl-warn">
                No {LANGS[lang].label} voice is installed, so the agent will show the
                text but may read it with another voice.
              </p>
            )}
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
            <div className="dl-foot">
              <div className="dl-note">
                <Icon name={hearing ? 'mic' : 'wave'} size={13} /> {note || 'Connected.'}
              </div>
              <div className="dl-langs sm">
                {Object.entries(LANGS).map(([k, v]) => (
                  <button key={k} type="button"
                    className={`dl-lang ${lang === k ? 'on' : ''}`}
                    onClick={() => setLang(k)}>{v.short}</button>
                ))}
              </div>
              <label className="dl-hf" title="Open the mic automatically after the agent speaks">
                <span>Hands-free</span>
                <Toggle on={handsFree} onChange={() => setHandsFree((h) => !h)} />
              </label>
            </div>
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
