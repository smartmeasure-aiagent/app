/**
 * A collection truck that drives across a scrolling road, wheels spinning,
 * with a little bounce and exhaust puffs. Pure SVG + CSS, loops forever.
 */
export function TruckRun() {
  return (
    <svg className="truckrun" viewBox="0 0 120 30" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Collection truck on route">
      {/* road */}
      <line x1="0" y1="26" x2="120" y2="26" stroke="var(--border)" strokeWidth="2" />
      <line className="road-dash" x1="0" y1="26" x2="120" y2="26" stroke="var(--muted)" strokeWidth="1" strokeDasharray="6 6" opacity=".5" />

      <g className="truck-drive">
        <g className="truck-bounce">
          {/* exhaust puffs */}
          <circle className="puff p1" cx="1" cy="10" r="1.6" fill="var(--muted)" />
          <circle className="puff p2" cx="1" cy="10" r="1.2" fill="var(--muted)" />
          {/* body */}
          <rect x="6" y="7" width="20" height="13" rx="2" fill="var(--accent)" />
          <rect x="26" y="11" width="9" height="9" rx="1.5" fill="var(--accent-2, var(--accent))" />
          <rect x="27.5" y="12.5" width="5" height="4" rx="1" fill="#fff" opacity=".65" />
          {/* recycling arrows hint on the box */}
          <path d="M11 11 l3 0 l-1.5 -2 Z M11 16 l3 0 l-1.5 2 Z M19 11 l-3 0 l1.5 -2 Z" fill="#fff" opacity=".6" />
          {/* wheels */}
          <g className="wheel" style={{ transformOrigin: '13px 21px' }}>
            <circle cx="13" cy="21" r="3.1" fill="#2a2f37" stroke="#000" strokeWidth=".4" />
            <circle cx="13" cy="21" r="1.1" fill="#8a93a1" />
            <line x1="13" y1="18.2" x2="13" y2="23.8" stroke="#8a93a1" strokeWidth=".5" />
            <line x1="10.2" y1="21" x2="15.8" y2="21" stroke="#8a93a1" strokeWidth=".5" />
          </g>
          <g className="wheel" style={{ transformOrigin: '30px 21px' }}>
            <circle cx="30" cy="21" r="3.1" fill="#2a2f37" stroke="#000" strokeWidth=".4" />
            <circle cx="30" cy="21" r="1.1" fill="#8a93a1" />
            <line x1="30" y1="18.2" x2="30" y2="23.8" stroke="#8a93a1" strokeWidth=".5" />
            <line x1="27.2" y1="21" x2="32.8" y2="21" stroke="#8a93a1" strokeWidth=".5" />
          </g>
        </g>
      </g>
    </svg>
  )
}
