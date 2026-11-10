import { useId, useMemo } from 'react'
import { fillColor, statusOf } from '../data/model.js'

/* ---- tiny deterministic PRNG so each bin generates a stable, unique scene ---- */
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* type-specific trash kinds + palettes */
const KINDS = {
  Recycling: ['bottle', 'can', 'paper'],
  Organic: ['banana', 'apple', 'leaf'],
  General: ['bag', 'box', 'paper'],
}
const PALETTE = {
  Recycling: ['#5ec8d8', '#7fd1a8', '#9fb7cc', '#c9d6e2'],
  Organic: ['#e0bd57', '#bb8a36', '#7cc256', '#c66a3a'],
  General: ['#9aa3ad', '#b9a07a', '#8a93a1', '#c2b48f'],
}

/* each trash item is a small centered glyph drawn around (0,0), scaled by the caller */
function Item({ kind, color }) {
  switch (kind) {
    case 'bottle':
      return (<g><rect x="-3" y="-7" width="6" height="14" rx="3" fill={color} />
        <rect x="-1.4" y="-10" width="2.8" height="4" rx="1" fill={color} />
        <rect x="-3" y="-2" width="6" height="2" fill="#fff" opacity=".35" /></g>)
    case 'can':
      return (<g><rect x="-4" y="-6" width="8" height="12" rx="2" fill={color} />
        <ellipse cx="0" cy="-6" rx="4" ry="1.5" fill="#fff" opacity=".4" />
        <rect x="-4" y="-1" width="8" height="2.2" fill="#fff" opacity=".3" /></g>)
    case 'paper':
      return (<path fill={color} d="M-6 -3 L-2 -6 L3 -5 L6 -1 L4 4 L-1 6 L-5 3 L-6 0 Z" />)
    case 'banana':
      return (<path fill={color} stroke="#8a5a1a" strokeWidth=".4"
        d="M-6 -4 q 2 9 11 8 q -2 -3 -3 -6 q -4 1 -8 -2 Z" />)
    case 'apple':
      return (<g><path fill={color} d="M-5 2 q-1 -6 5 -6 q6 0 5 6 q-1 5 -5 5 q-4 0 -5 -5 Z" />
        <rect x="-0.6" y="-7" width="1.2" height="3" fill="#6b4a22" />
        <path d="M0 -5 q3 -1 4 1" stroke="#7cc256" strokeWidth="1" fill="none" /></g>)
    case 'leaf':
      return (<g><path fill={color} d="M-6 0 q6 -8 12 0 q-6 8 -12 0 Z" />
        <path d="M-5 0 H5" stroke="#4f8a37" strokeWidth=".5" /></g>)
    case 'bag':
      return (<path fill={color} d="M-6 -2 q0 -5 6 -5 q6 0 6 5 q0 7 -6 8 q-6 -1 -6 -8 Z" opacity=".95" />)
    case 'box':
      return (<g><path fill={color} d="M-6 2 L-6 -3 L0 -6 L6 -3 L6 2 L0 5 Z" />
        <path d="M-6 -3 L0 0 L6 -3 M0 0 L0 5" stroke="#000" strokeOpacity=".18" strokeWidth=".6" fill="none" /></g>)
    default:
      return <circle r="4" fill={color} />
  }
}

/**
 * Procedurally-generated, animated bin illustration.
 * A seed from the bin id deterministically scatters type-appropriate trash that
 * floats and tumbles; more items stack in as fill rises and poke over the rim when full.
 */
export function BinScene({ id = 'BIN', fill = 0, type = 'General', online = true, size = 150 }) {
  const uid = useId().replace(/:/g, '')
  const col = fillColor(fill)
  const pct = Math.max(0, Math.min(100, fill))
  const full = fill >= 80
  const interiorTop = 34, interiorBot = 108
  const levelY = interiorTop + (1 - pct / 100) * (interiorBot - interiorTop)
  const lidColor =
    type === 'Recycling' ? 'var(--accent)' : type === 'Organic' ? 'var(--ok)' : 'var(--surface)'

  // generate the scene once per (id, type, fill-bucket) — stable across live ticks of a few %
  const bucket = Math.round(pct / 8)
  const items = useMemo(() => {
    const rng = mulberry32(hashStr(id + type + bucket))
    const kinds = KINDS[type] || KINDS.General
    const pal = PALETTE[type] || PALETTE.General
    const n = Math.round(2 + (pct / 100) * 8) // 2..10 pieces
    const top = Math.max(interiorTop, levelY - 4)
    return Array.from({ length: n }, (_, i) => ({
      key: i,
      kind: kinds[Math.floor(rng() * kinds.length)],
      color: pal[Math.floor(rng() * pal.length)],
      x: 32 + rng() * 36,
      y: top + rng() * (interiorBot - 4 - top),
      rot: rng() * 44 - 22,
      scale: 0.72 + rng() * 0.55,
      dur: (3 + rng() * 3).toFixed(2),
      delay: (rng() * -5).toFixed(2),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type, bucket])

  return (
    <svg
      className={`binglyph binscene${full ? ' is-full' : ''}${online ? '' : ' is-off'}`}
      viewBox="0 0 100 120" width={size} height={size * 1.2}
      role="img" aria-label={`Bin ${id} — ${fill}% full, ${statusOf(fill)}`}
    >
      <defs>
        <clipPath id={`${uid}-c`}><path d="M26 34 H74 L71 108 H29 Z" /></clipPath>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity="0.22" />
          <stop offset="1" stopColor={col} stopOpacity="0.08" />
        </linearGradient>
      </defs>

      <path d="M26 34 H74 L71 108 H29 Z" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1.6" />

      <g clipPath={`url(#${uid}-c)`}>
        {/* faint fill tint rising to the live level */}
        <rect className="bin-fill" x="24" y="34" width="52" height="80" fill={`url(#${uid}-g)`}
          style={{ transform: `translateY(${levelY - interiorTop}px)` }} />
        {/* generated, floating trash */}
        {items.map((it) => (
          <g key={it.key} transform={`translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${it.rot.toFixed(1)}) scale(${it.scale.toFixed(2)})`}>
            <g className="trash" style={{ animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s` }}>
              <Item kind={it.kind} color={it.color} />
            </g>
          </g>
        ))}
      </g>

      <path d="M26 34 H74 L71 108 H29 Z" fill="none" stroke="var(--border)" strokeWidth="1.6" />
      <line x1="42" y1="38" x2="41" y2="105" stroke="var(--border)" strokeWidth="1" opacity="0.4" />
      <line x1="58" y1="38" x2="59" y2="105" stroke="var(--border)" strokeWidth="1" opacity="0.4" />

      <g className="bin-lid">
        <rect x="22" y="24" width="56" height="8" rx="3" fill={lidColor} stroke="var(--border)" strokeWidth="1.6" />
        <rect x="43" y="18" width="14" height="7" rx="3" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.6" />
      </g>
    </svg>
  )
}
