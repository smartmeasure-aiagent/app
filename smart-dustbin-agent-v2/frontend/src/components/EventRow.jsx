import { Icon } from './icons.jsx'
import { timeOf } from '../data/model.js'

// an event carries an icon-name string (ic) and severity key (k)
export default function EventRow({ ev }) {
  return (
    <div className="ev">
      <div className={`dot b-${ev.k}`}><Icon name={ev.ic} size={15} /></div>
      <div className="tx"><b>{ev.t}</b><p>{ev.bin} · {ev.detail}</p></div>
      <div className="tm">{timeOf(ev.ts)}</div>
    </div>
  )
}
