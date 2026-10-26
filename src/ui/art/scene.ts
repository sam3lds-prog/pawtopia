/**
 * The Harmony Sanctuary landscape (original illustration). Used as the home header and as the backdrop of
 * the sanctuary screen, where decor and residents are layered into fixed slots.
 */

export function sceneBackdrop(opts: { id: string; height?: number } = { id: 'scene' }): string {
  const id = opts.id;
  return `
  <defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfe9ec"/>
      <stop offset="0.75" stop-color="#f2f3e6"/>
      <stop offset="1" stop-color="#fbf8f1"/>
    </linearGradient>
    <linearGradient id="${id}-hill1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9dfc2"/>
      <stop offset="1" stop-color="#bcd6b6"/>
    </linearGradient>
    <linearGradient id="${id}-hill2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a9cfae"/>
      <stop offset="1" stop-color="#94c19c"/>
    </linearGradient>
    <linearGradient id="${id}-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9cc8a0"/>
      <stop offset="1" stop-color="#86b78c"/>
    </linearGradient>
  </defs>
  <rect width="360" height="200" fill="url(#${id}-sky)"/>
  <circle cx="292" cy="46" r="20" fill="#fbe9c4"/>
  <circle cx="292" cy="46" r="28" fill="#fbe9c4" opacity="0.35"/>
  <g fill="#ffffff" opacity="0.85">
    <ellipse cx="72" cy="40" rx="26" ry="8"/><ellipse cx="88" cy="35" rx="16" ry="8"/>
    <ellipse cx="214" cy="28" rx="20" ry="6"/><ellipse cx="226" cy="24" rx="12" ry="6"/>
  </g>
  <path d="M0 118 C60 92 110 96 170 110 C230 124 290 92 360 100 V200 H0Z" fill="url(#${id}-hill1)"/>
  <path d="M0 140 C70 120 120 126 190 136 C250 145 300 126 360 130 V200 H0Z" fill="url(#${id}-hill2)"/>
  <!-- cottage -->
  <g transform="translate(206 92)">
    <rect x="6" y="20" width="44" height="30" rx="3" fill="#fbf3e4"/>
    <path d="M0 22 L28 0 L56 22 Z" fill="#287b70"/>
    <path d="M0 22 L28 0 L56 22" fill="none" stroke="#185c55" stroke-width="2" stroke-linejoin="round"/>
    <rect x="22" y="32" width="12" height="18" rx="6" fill="#d99a6c"/>
    <rect x="10" y="27" width="9" height="8" rx="2" fill="#f6d79b"/>
    <rect x="38" y="27" width="9" height="8" rx="2" fill="#f6d79b"/>
    <rect x="40" y="4" width="6" height="12" fill="#c98466"/>
  </g>
  <!-- trees -->
  <g>
    <rect x="58" y="112" width="5" height="20" rx="2" fill="#8a6a4f"/>
    <circle cx="60" cy="104" r="16" fill="#7fb486"/>
    <circle cx="52" cy="110" r="10" fill="#8cc093"/>
    <rect x="318" y="108" width="4" height="18" rx="2" fill="#8a6a4f"/>
    <circle cx="320" cy="101" r="12" fill="#86ba8d"/>
  </g>
  <path d="M0 162 C80 150 150 156 220 160 C280 163 320 156 360 158 V200 H0Z" fill="url(#${id}-ground)"/>
  <path d="M236 142 C226 160 190 166 172 200 H206 C214 178 244 166 250 144 Z" fill="#efe4cf" opacity="0.9"/>
  <g fill="#f4c7cf"><circle cx="112" cy="168" r="3"/><circle cx="120" cy="173" r="2.5"/><circle cx="104" cy="175" r="2.5"/></g>
  <g fill="#f6e3a3"><circle cx="290" cy="172" r="3"/><circle cx="298" cy="167" r="2.4"/><circle cx="282" cy="178" r="2.4"/></g>
  `;
}
