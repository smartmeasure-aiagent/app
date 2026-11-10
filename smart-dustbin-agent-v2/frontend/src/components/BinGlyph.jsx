import { useId } from 'react'
import { fillColor, statusOf } from '../data/model.js'

/**
 * Animated waste-bin glyph.
 * The contents fill to the live level with a wobbling surface + rising bubbles;
 * the lid bobs, and when the bin is full (>=80%) the lid flips open and trash spills out.
 * Pure SVG + CSS — scales with `size`, dims when the sensor is offline.
 */
export function BinGlyph({ fill = 0, type = 'General', online = true, size = 120 }) {
  const uid = useId().replace(/:/g, '')
  const col = fillColor(fill)
  const full = fill >= 80
  const pct = Math.max(0, Math.min(100, fill))
  // fill group is drawn as if the bin were full; translateY pushes the surface down to the live level
  const interiorTop = 34, interiorBot = 108
  const offset = (1 - pct / 100) * (interiorBot - interiorTop)
  const lidColor =
    type === 'Recycling' ? 'var(--accent)' : type === 'Organic' ? 'var(--ok)' : 'var(--surface)'

  return (
    <svg
      className={`binglyph${full ? ' is-full' : ''}${online ? '' : ' is-off'}`}
      viewBox="0 0 100 120"
      width={size}
      height={size * 1.2}
      role="img"
      aria-label={`Bin ${fill}% full — ${statusOf(fill)}`}
    >
      <defs>
        <clipPath id={`${uid}-c`}>
          <path d="M26 34 H74 L71 108 H29 Z" />
        </clipPath>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity="0.95" />
          <stop offset="1" stopColor={col} stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* hollow body (back) */}
      <path d="M26 34 H74 L71 108 H29 Z" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1.6" />

      {/* contents, clipped to the body */}
      <g clipPath={`url(#${uid}-c)`}>
        <g className="bin-fill" style={{ transform: `translateY(${offset}px)` }}>
          <rect x="18" y="34" width="64" height="92" fill={`url(#${uid}-g)`} />
          {/* two offset wave crests give a liquid-like wobble */}
          <path className="bin-wave" fill={col} fillOpacity="0.9"
            d="M-20 34 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V60 H-20 Z" />
          <path className="bin-wave bin-wave2" fill={col} fillOpacity="0.5"
            d="M-20 35 q10 4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V60 H-20 Z" />
        </g>
        {/* rising bubbles, only when there is enough in the bin to see them */}
        {pct > 22 && (
          <g className="bin-bubbles">
            <circle className="bin-bub b1" cx="41" cy="104" r="2" fill="#fff" />
            <circle className="bin-bub b2" cx="56" cy="104" r="1.5" fill="#fff" />
            <circle className="bin-bub b3" cx="48" cy="104" r="1.1" fill="#fff" />
          </g>
        )}
      </g>

      {/* body outline + ribs on top of the fill */}
      <path d="M26 34 H74 L71 108 H29 Z" fill="none" stroke="var(--border)" strokeWidth="1.6" />
      <line x1="42" y1="38" x2="41" y2="105" stroke="var(--border)" strokeWidth="1" opacity="0.45" />
      <line x1="58" y1="38" x2="59" y2="105" stroke="var(--border)" strokeWidth="1" opacity="0.45" />

      {/* overflow trash — jumps out while the bin is full */}
      {full && (
        <g className="bin-spill">
          <rect className="sp s1" x="39" y="28" width="5" height="5" rx="1" fill={col} />
          <rect className="sp s2" x="52" y="28" width="4" height="4" rx="1" fill={col} />
          <circle className="sp s3" cx="47" cy="29" r="2.2" fill={col} />
        </g>
      )}

      {/* lid (bobs when calm, flips open when full) */}
      <g className="bin-lid">
        <rect x="22" y="24" width="56" height="8" rx="3" fill={lidColor} stroke="var(--border)" strokeWidth="1.6" />
        <rect x="43" y="18" width="14" height="7" rx="3" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.6" />
      </g>
    </svg>
  )
}
