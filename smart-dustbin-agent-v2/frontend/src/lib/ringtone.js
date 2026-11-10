/**
 * Ringtone for incoming collection calls.
 *
 * Synthesised with the Web Audio API rather than an audio file, so there is no
 * asset to ship and the tone is the classic two-frequency telephone ring.
 *
 * Browsers suspend every AudioContext until the user interacts with the page, so
 * nothing can be heard before `primeAudio()` has run inside a real gesture. The
 * overlay primes on the first click or keypress anywhere and reports when sound
 * is still blocked.
 */

let ctx = null

function getCtx() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try { ctx = new AC() } catch { return null }
  return ctx
}

/** Resume the audio context. Must be called from inside a user gesture. */
export function primeAudio() {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
  return !!c
}

export const isAudioReady = () => !!ctx && ctx.state === 'running'

/** One ring burst: 440 Hz + 480 Hz together, the North-American ring pair. */
function burst(c, at, gain) {
  for (const freq of [440, 480]) {
    const osc = c.createOscillator()
    const amp = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    // Ramp the edges; a hard start or stop on a sine clicks audibly.
    amp.gain.setValueAtTime(0, at)
    amp.gain.linearRampToValueAtTime(gain, at + 0.02)
    amp.gain.setValueAtTime(gain, at + 0.36)
    amp.gain.linearRampToValueAtTime(0, at + 0.4)
    osc.connect(amp).connect(c.destination)
    osc.start(at)
    osc.stop(at + 0.42)
  }
}

/**
 * Start ringing until the returned stop function is called.
 * Pattern: two 0.4s rings 0.2s apart, then a 2s pause — repeating.
 */
export function startRing({ volume = 0.12, vibrate = true } = {}) {
  const c = getCtx()
  if (!c || c.state !== 'running') return () => {}

  let stopped = false
  let timer = null

  const cycle = () => {
    if (stopped) return
    const now = c.currentTime
    burst(c, now, volume)
    burst(c, now + 0.6, volume)
    if (vibrate && navigator.vibrate) {
      try { navigator.vibrate([400, 200, 400]) } catch { /* unsupported */ }
    }
    timer = setTimeout(cycle, 3000)
  }
  cycle()

  return () => {
    stopped = true
    clearTimeout(timer)
    if (navigator.vibrate) { try { navigator.vibrate(0) } catch { /* unsupported */ } }
  }
}
