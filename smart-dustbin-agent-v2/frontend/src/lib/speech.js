/**
 * Bilingual speech helpers (English + Telugu).
 *
 * Telugu support depends entirely on what the operating system provides:
 * Chrome and Edge recognise `te-IN` speech, but a Telugu *synthesis* voice is
 * often absent on desktop Windows and Linux. Rather than fail silently, these
 * helpers report what is available so the UI can say so.
 */

import { speechUrl } from '../data/api.js'

export const LANGS = {
  en: { code: 'en-IN', label: 'English', short: 'EN' },
  te: { code: 'te-IN', label: 'తెలుగు', short: 'TE' },
}

export const langCode = (lang) => (LANGS[lang] || LANGS.en).code

/** Voices load asynchronously; resolve once the list is populated. */
export function voicesReady() {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) return resolve([])
    const got = synth.getVoices()
    if (got.length) return resolve(got)
    const onChange = () => {
      synth.removeEventListener('voiceschanged', onChange)
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', onChange)
    // Safari never fires the event if the list is already warm.
    setTimeout(() => resolve(synth.getVoices()), 1200)
  })
}

/** The best installed voice for a language, or null if none matches. */
export function pickVoice(voices, lang) {
  const code = langCode(lang)
  const base = code.split('-')[0]
  return voices.find((v) => v.lang?.replace('_', '-') === code)
      || voices.find((v) => v.lang?.replace('_', '-').startsWith(base + '-'))
      || voices.find((v) => v.lang?.startsWith(base))
      || null
}

export async function canSpeak(lang) {
  return !!pickVoice(await voicesReady(), lang)
}

/**
 * Speak `text` in `lang`. Calls onDone when finished (or immediately on failure).
 * Returns the voice actually used, so callers can warn when it is a substitute.
 */
let current = null   // <audio> element playing server-rendered speech

/** Stop whatever is speaking, from either source. */
export function stopSpeaking() {
  try { window.speechSynthesis?.cancel() } catch { /* unsupported */ }
  if (current) {
    current.pause()
    URL.revokeObjectURL(current.src)
    current = null
  }
}

/**
 * Speak `text` in `lang`, preferring the agent's neural voices.
 *
 * Server audio is tried first: it sounds identical on every machine and is the
 * only way Telugu is reliably spoken at all. Falls back to the browser voice if
 * the agent is unreachable or autoplay is blocked.
 */
export async function speak(text, lang, onDone) {
  const url = await speechUrl(text, lang)
  if (url) {
    stopSpeaking()
    const audio = new Audio(url)
    current = audio
    const finish = () => {
      if (current === audio) { URL.revokeObjectURL(url); current = null }
      onDone?.()
    }
    audio.onended = finish
    audio.onerror = finish
    try {
      await audio.play()
      return { source: 'server', lang }
    } catch {
      finish()   // autoplay blocked: fall through to the browser voice
    }
  }
  return speakWithBrowser(text, lang, onDone)
}

async function speakWithBrowser(text, lang, onDone) {
  try {
    const synth = window.speechSynthesis
    if (!synth) { onDone?.(); return null }
    synth.cancel()
    const voices = await voicesReady()
    const voice = pickVoice(voices, lang)
    const u = new SpeechSynthesisUtterance(text)
    u.lang = langCode(lang)
    if (voice) u.voice = voice
    // Telugu voices tend to run fast; slow them slightly for clarity.
    u.rate = lang === 'te' ? 0.95 : 1.02
    u.onend = () => onDone?.()
    u.onerror = () => onDone?.()
    synth.speak(u)
    return voice
  } catch { onDone?.(); return null }
}

export function listen(lang, onText, onErr) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { onErr?.('Speech recognition needs Chrome or Edge. Type instead.'); return null }
  const rec = new SR()
  rec.lang = langCode(lang)
  rec.interimResults = false
  rec.maxAlternatives = 1
  rec.onresult = (e) => onText(e.results[0][0].transcript)
  rec.onerror = (e) => {
    // `aborted` is us hanging up and `no-speech` is silence: neither is a fault.
    if (e.error === 'aborted') return
    onErr?.(e.error === 'not-allowed' ? 'Microphone permission denied.'
      : e.error === 'no-speech' ? 'Did not catch that — tap the mic to try again.'
      : e.error === 'language-not-supported'
        ? `${(LANGS[lang] || LANGS.en).label} speech input is not supported by this browser.`
        : `Could not hear you (${e.error}).`)
  }
  try { rec.start() } catch { return null }
  return rec
}
