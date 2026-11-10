// Inline SVG icon set. `I` holds raw path markup strings; <Icon> renders one.
export const I = {
  dashboard: '<path d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z"/>',
  bins: '<rect x="3" y="7" width="7" height="7" rx="1"/><rect x="14" y="7" width="7" height="7" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/>',
  bin: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  truck: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
  team: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-1a5 5 0 0 1 10 0v1"/><path d="M16 11a3 3 0 1 0 0-6"/><path d="M21 21v-1a5 5 0 0 0-4-4.9"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l3-4 3 2 4-6"/>',
  health: '<path d="M22 12h-4l-3 9-6-18-3 9H2"/>',
  sensor: '<circle cx="12" cy="12" r="2"/><path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V5z"/>',
  api: '<path d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 .3 2.8h.1a2 2 0 1 1 0 4z"/>',
  battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/>',
  signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 20V4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
  cloud: '<path d="M17 18a4 4 0 0 0 0-8 6 6 0 0 0-11.7 2A3.5 3.5 0 0 0 6 18z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>',
  recycle: '<path d="M7 19H4a2 2 0 0 1-1.7-3l2-3.4M7 19l-2-3.4M7 19l3.5-1M12 4l1.7 3 3-1.7M12 4 9 5.7M12 4l2 3.5M17 19l1.7-3a2 2 0 0 0-.7-2.8l-3-1.8M17 19h-3.5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  temp: '<path d="M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z"/>',
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  wave: '<path d="M2 12h3l2-7 4 18 3-14 2 5h6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
}

export function Icon({ name, size = 18, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: I[name] || '' }}
    />
  )
}
