import { useId, useEffect, useState } from 'react'
import { fillColor, statusOf } from '../data/model.js'

/* Catmull-Rom → cubic Bézier: turns points into a smooth, natural curve */
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : ''
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}
/* rounded top corners only, square base */
function topRound(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h))
  return `M${x.toFixed(1)} ${(y + h).toFixed(1)} L${x.toFixed(1)} ${(y + r).toFixed(1)} Q${x.toFixed(1)} ${y.toFixed(1)} ${(x + r).toFixed(1)} ${y.toFixed(1)} L${(x + w - r).toFixed(1)} ${y.toFixed(1)} Q${(x + w).toFixed(1)} ${y.toFixed(1)} ${(x + w).toFixed(1)} ${(y + r).toFixed(1)} L${(x + w).toFixed(1)} ${(y + h).toFixed(1)} Z`
}

export function Gauge({ pct, size = 150 }) {
  const r = size / 2 - 13, c = 2 * Math.PI * r
  // start empty, then ease to the value: draws in on mount, follows live changes after
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])
  const off = c * (1 - shown / 100)
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
        {pct >= 80 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--crit)" strokeWidth="2">
            <animate attributeName="r" values={`${r};${r + 22}`} dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values=".55;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
        )}
        <circle className={pct >= 80 ? 'gauge-glow' : ''} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fillColor(pct)} strokeWidth="11"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.2,.7,.2,1), stroke .5s ease' }} />
      </svg>
      <div className="lbl"><b>{pct}%</b><span>{statusOf(pct)}</span></div>
    </div>
  )
}

export function Spark({ data, w = 120, h = 34, color = 'var(--accent)' }) {
  const gid = useId().replace(/:/g, '')
  const mn = Math.min(...data), mx = Math.max(...data), rg = mx - mn || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - mn) / rg) * (h - 6) - 3])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = `M0 ${h} ` + pts.map((p) => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ` L${w} ${h} Z`
  const last = pts[pts.length - 1]
  return (
    <svg className="sparkwrap" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height: h }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.6" fill={color} />
    </svg>
  )
}

export function AreaChart({ data, dataKey, w = 620, h = 220, color = 'var(--accent)' }) {
  const gid = useId().replace(/:/g, '')
  const mn = 0, mx = 100, rg = mx - mn
  const pL = 34, pB = 24, pT = 14, pR = 14, iw = w - pL - pR, ih = h - pB - pT
  const X = (i) => pL + (i / (data.length - 1)) * iw
  const Y = (v) => pT + (1 - (v - mn) / rg) * ih
  const pts = data.map((d, i) => [X(i), Y(d[dataKey])])
  const line = smoothPath(pts)
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)} ${(pT + ih).toFixed(1)} L${pts[0][0].toFixed(1)} ${(pT + ih).toFixed(1)} Z`
  const lastV = Math.round(data[data.length - 1][dataKey])
  const end = pts[pts.length - 1]
  const chipW = 46, chipX = Math.min(Math.max(end[0] - chipW / 2, pL), w - pR - chipW), chipY = Math.max(pT + 2, end[1] - 30)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".38" />
          <stop offset=".55" stopColor={color} stopOpacity=".12" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${gid}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${gid}-clip`}><path d={area} /></clipPath>
      </defs>
      {/* danger zone ≥80% */}
      <rect x={pL} y={Y(100)} width={iw} height={Y(80) - Y(100)} fill="var(--crit)" opacity=".06" />
      <line x1={pL} y1={Y(80)} x2={w - pR} y2={Y(80)} stroke="var(--crit)" strokeWidth="1" strokeDasharray="4 4" opacity=".5" />
      <text x={w - pR} y={Y(80) - 3} textAnchor="end" fontSize="8" fontWeight="700" fill="var(--crit)" opacity=".7">DANGER ≥80</text>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pL} y1={Y(g)} x2={w - pR} y2={Y(g)} stroke="var(--border)" strokeWidth="1" opacity=".7" />
          <text x={pL - 6} y={Y(g) + 3.5} textAnchor="end" fontSize="9" fill="var(--muted)">{g}</text>
        </g>
      ))}
      <path className="fv-area-in" d={area} fill={`url(#${gid})`} />
      {/* sweeping sheen, clipped to the area */}
      <g clipPath={`url(#${gid}-clip)`}>
        <rect className="chart-sheen" x={pL - 100} y={pT} width="80" height={ih} fill={`url(#${gid}-sheen)`} />
      </g>
      <path id={`${gid}-l`} className="fv-draw-line" d={line} fill="none" stroke={color} strokeWidth="2.6"
        strokeLinejoin="round" strokeLinecap="round" pathLength="1" strokeDasharray="1"
        style={{ filter: `drop-shadow(0 2px 5px color-mix(in srgb, ${color} 45%, transparent))` }} />
      <circle className="pulse-dot" r="3.5" fill={color}>
        <animateMotion dur="3.2s" repeatCount="indefinite" rotate="auto"><mpath href={`#${gid}-l`} /></animateMotion>
        <animate attributeName="opacity" values="0;1;1;0" dur="3.2s" repeatCount="indefinite" />
      </circle>
      {/* live "now" marker */}
      <g>
        <circle cx={end[0]} cy={end[1]} r="4" fill="none" stroke={color} strokeWidth="1.6">
          <animate attributeName="r" values="4;11" dur="1.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".65;0" dur="1.9s" repeatCount="indefinite" />
        </circle>
        <circle cx={end[0]} cy={end[1]} r="3.6" fill={color} stroke="var(--surface)" strokeWidth="1.6" />
        <rect x={chipX} y={chipY} width={chipW} height="19" rx="6" fill="var(--surface)" stroke={color} strokeWidth="1" />
        <text x={chipX + chipW / 2} y={chipY + 13} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="var(--font-d)" fill="var(--fg)">{lastV}%</text>
      </g>
      {[0, 6, 12, 18, 23].map((i) => (
        <text key={i} x={X(i)} y={h - 7} textAnchor="middle" fontSize="9" fill="var(--muted)">
          {String(i).padStart(2, '0')}:00
        </text>
      ))}
    </svg>
  )
}

export function BarChart({ data, w = 620, h = 220, color = 'var(--accent)', unit = '', fmtColor }) {
  const gid = useId().replace(/:/g, '')
  const mx = Math.max(...data.map((d) => d.v)) * 1.15 || 1
  const pL = 30, pB = 30, pT = 16, pR = 8, iw = w - pL - pR, ih = h - pB - pT
  const bw = (iw / data.length) * 0.56, gap = iw / data.length
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        {data.map((d, i) => {
          const col = fmtColor ? fmtColor(d) : color
          return (
            <linearGradient key={i} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={col} stopOpacity="1" />
              <stop offset="1" stopColor={col} stopOpacity="0.55" />
            </linearGradient>
          )
        })}
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((g) => {
        const y = pT + (1 - g) * ih
        return (
          <g key={g}>
            <line x1={pL} y1={y} x2={w - pR} y2={y} stroke="var(--border)" strokeWidth="1" opacity=".7" />
            <text x={pL - 6} y={y + 3.5} textAnchor="end" fontSize="9" fill="var(--muted)">{Math.round(mx * g)}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const bh = Math.max(0, (d.v / mx) * ih)
        const x = pL + i * gap + (gap - bw) / 2
        const y = pT + ih - bh
        const col = fmtColor ? fmtColor(d) : color
        const cx = x + bw / 2
        return (
          <g key={i}>
            {/* background rail so every column has presence */}
            <path d={topRound(x, pT, bw, ih, 6)} fill="var(--surface-2)" opacity=".7" />
            {/* the bar grows from its base */}
            <g className="fv-grow" style={{ animationDelay: `${i * 0.07}s` }}>
              <path d={topRound(x, y, bw, bh, 6)} fill={`url(#${gid}-${i})`}>
                <title>{d.l}: {d.v}{unit}</title>
              </path>
              {/* glossy top highlight */}
              {bh > 8 && <path d={topRound(x + 2, y + 2, bw - 4, Math.min(10, bh - 4), 4)} fill="#fff" opacity=".2" />}
            </g>
            {/* value pill */}
            <g className="fv-pop-late" style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
              <rect x={cx - 11} y={y - 19} width="22" height="15" rx="7" fill="var(--surface)" stroke={col} strokeWidth="1" />
              <text x={cx} y={y - 8.5} textAnchor="middle" fontSize="9.5" fontWeight="800" fontFamily="var(--font-d)" fill={col}>{d.v}</text>
            </g>
            <text x={cx} y={h - 10} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--muted)">{d.l}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function Donut({ segs, size = 150, thick = 22 }) {
  const total = segs.reduce((a, s) => a + s.v, 0) || 1
  const r = size / 2 - thick / 2, c = 2 * Math.PI * r
  let off = 0
  const circles = segs.map((s, i) => {
    const len = (s.v / total) * c
    const el = (
      <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.c} strokeWidth={thick}
        strokeDasharray={`${len.toFixed(2)} ${(c - len).toFixed(2)}`} strokeDashoffset={(-off).toFixed(2)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <title>{s.l}: {s.v}</title>
      </circle>
    )
    off += len
    return el
  })
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flex: 'none' }}>
        {circles}
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="20" fontWeight="700" fontFamily="var(--font-d)" fill="var(--fg)">{total}</text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="9" fill="var(--muted)">TOTAL</text>
      </svg>
      <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.c, flex: 'none' }} />
            <span style={{ color: 'var(--muted)' }}>{s.l}</span>
            <b style={{ marginLeft: 'auto' }}>{s.v}</b>
          </div>
        ))}
      </div>
    </div>
  )
}
