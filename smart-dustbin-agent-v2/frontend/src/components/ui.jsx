import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons.jsx'
import { statusOf, statusClass } from '../data/model.js'

export function PageHeader({ title, sub, actions }) {
  return (
    <div className="pagehead">
      <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Panel({ title, hint, actions, children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      {title && (
        <div className="panel-h">
          <h3>{title}</h3>
          {hint ? <span className="hint">{hint}</span> : actions}
        </div>
      )}
      <div className="panel-b">{children}</div>
    </div>
  )
}

export function AnimatedNumber({ value, decimals = 0 }) {
  const [n, setN] = useState(0)
  const [fx, setFx] = useState('') // 'up' | 'down'
  const ref = useRef()
  const fxTimer = useRef()
  useEffect(() => {
    const from = ref.current ?? 0
    const to = Number(value) || 0
    if (ref.current != null && to !== from) {
      const dir = to > from ? 'up' : 'down'
      setFx(dir)
      clearTimeout(fxTimer.current)
      fxTimer.current = setTimeout(() => setFx(''), 650)
    }
    const t0 = performance.now(), dur = 600
    let raf
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setN(from + (to - from) * e)
      if (p < 1) raf = requestAnimationFrame(step)
      else ref.current = to
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return (
    <span className={`num-wrap ${fx ? 'bump ' + fx : ''}`}>
      {n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
    </span>
  )
}

export function Stat({ lab, val, unit = '', icon, delta, deltaType = 'flat', decimals = 0 }) {
  return (
    <div className="stat fx-glow fx-tilt">
      <div className="top">
        <span className="lab">{lab}</span>
        <span className="ico"><Icon name={icon} size={16} /></span>
      </div>
      <div className="val"><AnimatedNumber value={val} decimals={decimals} />{unit && <span className="u">{unit}</span>}</div>
      {delta != null && (
        <span className={`delta ${deltaType}`}>
          {deltaType === 'up' ? '▲' : deltaType === 'down' ? '▼' : '●'} {delta}
        </span>
      )}
    </div>
  )
}

export function Badge({ children, cls = 'mut' }) {
  return <span className={`badge b-${cls}`}><span className="d" />{children}</span>
}
export function StatusBadge({ fill }) {
  return <Badge cls={statusClass(fill)}>{statusOf(fill)}</Badge>
}

export function Meter({ pct, color = 'var(--accent)', width, flow }) {
  const showFlow = flow ?? pct >= 50 // fuller bins get animated flow stripes to draw the eye
  return (
    <div className="meter" style={width ? { width } : undefined}>
      <i className={showFlow ? 'flow' : ''} style={{ width: Math.min(100, pct) + '%', background: color }} />
    </div>
  )
}

export function HBar({ name, pct, value, color = 'var(--accent)' }) {
  return (
    <div className="hbar">
      <span className="nm">{name}</span>
      <Meter pct={pct} color={color} />
      <span className="vl">{value}</span>
    </div>
  )
}

export function Toggle({ on, onChange }) {
  return (
    <div
      className={`tg ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange() } }}
    />
  )
}

export function Avatar({ name, bg, children, size }) {
  const style = { background: bg }
  if (size) { style.width = size; style.height = size }
  return <div className="avatar" style={style}>{children}</div>
}
