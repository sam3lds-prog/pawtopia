/**
 * Original UI icon set (24×24, 2px round strokes, currentColor). Drawn for Pawtopia; no third-party icons.
 * Decorative by default (aria-hidden); controls carry their own accessible labels.
 */

const wrap = (body: string, extra = '') =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;

export const ICON = {
  home: wrap('<path d="M4 11.2 12 4.5l8 6.7"/><path d="M6 9.8V19a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V9.8"/>'),
  play: wrap('<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M4 12h16M12 4v16"/><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.1" fill="currentColor" stroke="none"/>'),
  paw: wrap(
    '<ellipse cx="12" cy="15.8" rx="4.4" ry="3.6" fill="currentColor" stroke="none"/><ellipse cx="6.4" cy="11" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/><ellipse cx="9.6" cy="7.3" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/><ellipse cx="14.4" cy="7.3" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/><ellipse cx="17.6" cy="11" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/>',
  ),
  trophy: wrap('<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6"/><path d="M12 13v3.5M8.5 20h7M9.5 20l.6-3.5h3.8l.6 3.5"/>'),
  bag: wrap('<path d="M5.5 8h13l-1 11.2a1 1 0 0 1-1 .8h-9a1 1 0 0 1-1-.8L5.5 8Z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>'),
  gear: wrap(
    '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.4a7.7 7.7 0 0 0 0-2.8l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.4-1.4L14.2 2.7h-4.4l-.4 2.5A7.5 7.5 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 2.8l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.4 1.4l.4 2.5h4.4l.4-2.5a7.5 7.5 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6Z"/>',
  ),
  back: wrap('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  chevron: wrap('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
  close: wrap('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  undo: wrap('<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H12"/>'),
  redo: wrap('<path d="m15 7 4.5 4.5L15 16"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H12"/>'),
  hint: wrap('<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.4.4.6.9.6 1.4v.8h6v-.8c0-.5.2-1 .6-1.4A6 6 0 0 0 12 3.5Z"/>'),
  pause: wrap('<rect x="7" y="5.5" width="3.2" height="13" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.8" y="5.5" width="3.2" height="13" rx="1.2" fill="currentColor" stroke="none"/>'),
  resume: wrap('<path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor"/>'),
  heart: wrap('<path d="M12 20s-7.2-4.4-9.1-8.7C1.4 7.9 3.5 4.5 6.9 4.5c2 0 3.4 1.1 4.2 2.4h1.8c.8-1.3 2.2-2.4 4.2-2.4 3.4 0 5.5 3.4 4 6.8C19.2 15.6 12 20 12 20Z" fill="currentColor" stroke="none"/>'),
  heartOff: wrap('<path d="M12 19.6s-7-4.3-8.8-8.4C1.8 8 3.8 4.9 6.9 4.9c1.9 0 3.3 1.1 4.1 2.4h2c.8-1.3 2.2-2.4 4.1-2.4 3.1 0 5.1 3.1 3.7 6.3C19 15.3 12 19.6 12 19.6Z" stroke-width="1.8"/>'),
  coin: `<svg class="ico ico--coin" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="#E9B95B"/><circle cx="12" cy="12" r="10" fill="none" stroke="#B9822C" stroke-width="1.4"/><circle cx="12" cy="12" r="7.3" fill="none" stroke="#F6DCA2" stroke-width="1.1"/><g fill="#9C6A1F"><ellipse cx="12" cy="14.1" rx="2.7" ry="2.2"/><ellipse cx="8.7" cy="11.3" rx="1.05" ry="1.35"/><ellipse cx="10.6" cy="9.1" rx="1.05" ry="1.4"/><ellipse cx="13.4" cy="9.1" rx="1.05" ry="1.4"/><ellipse cx="15.3" cy="11.3" rx="1.05" ry="1.35"/></g></svg>`,
  lock: wrap('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  check: wrap('<path d="m5 12.5 4.3 4.3L19 7.2"/>'),
  star: wrap('<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 3.8Z" fill="currentColor"/>'),
  starOff: wrap('<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 3.8Z"/>'),
  calendar: wrap('<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5"/><circle cx="12" cy="14.8" r="1.6" fill="currentColor" stroke="none"/>'),
  flame: wrap('<path d="M12 20.5c3.6 0 6-2.4 6-5.8 0-3.9-3.3-6-3.9-10.2-2.3 1.7-3.4 3.8-3.4 6.1-1.1-.7-1.8-1.8-2-3-1.7 1.6-2.7 3.9-2.7 6.9 0 3.6 2.4 6 6 6Z"/>'),
  leaf: wrap('<path d="M5 19c0-8 5-13.5 14-14-.3 9-5.6 14-13 14H5Z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>'),
  share: wrap('<path d="M12 15V4M8 7.5 12 3.5l4 4"/><path d="M6 11v7.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V11"/>'),
  help: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.4"/><circle cx="12" cy="16.9" r="1" fill="currentColor" stroke="none"/>'),
  mark: wrap('<path d="M7 7l10 10M17 7 7 17"/>'),
  erase: wrap('<path d="M8.6 19.5 4.4 15.3a1.5 1.5 0 0 1 0-2.1l8.3-8.3a1.5 1.5 0 0 1 2.1 0l4.9 4.9a1.5 1.5 0 0 1 0 2.1l-7.6 7.6H8.6Z"/><path d="m9.2 9.2 6.6 6.6M12 19.5h8"/>'),
  sparkle: wrap('<path d="M12 3.5c.6 4.3 2.7 6.4 7 7-4.3.6-6.4 2.7-7 7-.6-4.3-2.7-6.4-7-7 4.3-.6 6.4-2.7 7-7Z" fill="currentColor"/>'),
  gift: wrap('<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3.5 9h17v3.5h-17zM12 9v11"/><path d="M12 9c-1.5-3.5-5.5-4-5.5-1.6C6.5 9 12 9 12 9Zm0 0c1.5-3.5 5.5-4 5.5-1.6C17.5 9 12 9 12 9Z"/>'),
  sound: wrap('<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  restart: wrap('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  users: wrap('<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.7-3 2.9-4.6 5.5-4.6s4.8 1.6 5.5 4.6"/><circle cx="16.5" cy="9.8" r="2.6"/><path d="M15.8 14.6c2.1 0 3.9 1.3 4.6 3.9"/>'),
  shield: wrap('<path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.7 7 9 4.1-1.3 7-4.7 7-9V6l-7-2.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
  clock: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  target: wrap('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  eye: wrap('<path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  info: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/>'),
  /**
   * Colored game icons (like the coin): a glossy heart for lives, a pale empty heart for a lost one, an extra life
   * (heart with a plus), a golden hint bulb, a video token and a gem. Drawn in layers, no gradients, so they render the
   * same wherever they're cloned. Decorative; their buttons and counters carry the labels.
   */
  life: `<svg class="ico ico--life" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21c-.3 0-.6-.1-.8-.3C7.6 17.6 2.5 13.5 2.5 8.9 2.5 6 4.7 3.8 7.4 3.8c1.9 0 3.4 1 4.6 2.6 1.2-1.6 2.7-2.6 4.6-2.6 2.7 0 4.9 2.2 4.9 5.1 0 4.6-5.1 8.7-8.7 11.8-.2.2-.5.3-.8.3Z" fill="#E95468" stroke="#C23A50" stroke-width=".9"/><path d="M12 21c-.3 0-.6-.1-.8-.3C7.6 17.6 2.5 13.5 2.5 8.9 2.5 6 4.7 3.8 7.4 3.8c1.9 0 3.4 1 4.6 2.6 1.2-1.6 2.7-2.6 4.6-2.6 2.7 0 4.9 2.2 4.9 5.1 0 4.6-5.1 8.7-8.7 11.8-.2.2-.5.3-.8.3Z" fill="#FF7E8C" transform="translate(1.1 .2) scale(.86)"/><ellipse cx="7.7" cy="8.1" rx="2.5" ry="1.45" transform="rotate(-38 7.7 8.1)" fill="#fff" opacity=".78"/><circle cx="10.4" cy="6.6" r=".75" fill="#fff" opacity=".7"/></svg>`,
  lifeOff: `<svg class="ico ico--life-off" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21c-.3 0-.6-.1-.8-.3C7.6 17.6 2.5 13.5 2.5 8.9 2.5 6 4.7 3.8 7.4 3.8c1.9 0 3.4 1 4.6 2.6 1.2-1.6 2.7-2.6 4.6-2.6 2.7 0 4.9 2.2 4.9 5.1 0 4.6-5.1 8.7-8.7 11.8-.2.2-.5.3-.8.3Z" fill="#F7E1E3" stroke="#E2A3AC" stroke-width="1.3" stroke-dasharray="2.4 1.6"/></svg>`,
  lifePlus: `<svg class="ico ico--life-plus" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21c-.3 0-.6-.1-.8-.3C7.6 17.6 2.5 13.5 2.5 8.9 2.5 6 4.7 3.8 7.4 3.8c1.9 0 3.4 1 4.6 2.6 1.2-1.6 2.7-2.6 4.6-2.6 2.7 0 4.9 2.2 4.9 5.1 0 4.6-5.1 8.7-8.7 11.8-.2.2-.5.3-.8.3Z" fill="#E95468" stroke="#C23A50" stroke-width=".9"/><path d="M12 21c-.3 0-.6-.1-.8-.3C7.6 17.6 2.5 13.5 2.5 8.9 2.5 6 4.7 3.8 7.4 3.8c1.9 0 3.4 1 4.6 2.6 1.2-1.6 2.7-2.6 4.6-2.6 2.7 0 4.9 2.2 4.9 5.1 0 4.6-5.1 8.7-8.7 11.8-.2.2-.5.3-.8.3Z" fill="#FF7E8C" transform="translate(1.1 .2) scale(.86)"/><ellipse cx="7.7" cy="8.1" rx="2.5" ry="1.45" transform="rotate(-38 7.7 8.1)" fill="#fff" opacity=".78"/><circle cx="18.2" cy="17.6" r="4.6" fill="#2F8F83" stroke="#fff" stroke-width="1.4"/><path d="M18.2 15.4v4.4M16 17.6h4.4" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  bulb: `<svg class="ico ico--bulb" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="9.6" r="9.2" fill="#FFE59A" opacity=".45"/><path d="M12 2.9a6.4 6.4 0 0 0-4 11.4c.6.5 1 1.2 1 2v.6h6v-.6c0-.8.4-1.5 1-2a6.4 6.4 0 0 0-4-11.4Z" fill="#FFD054" stroke="#D49317" stroke-width="1"/><path d="M8.3 7.4a4.4 4.4 0 0 1 3.2-2.6" stroke="#FFF6D6" stroke-width="1.5" stroke-linecap="round" fill="none"/><g fill="#C9821A"><ellipse cx="12" cy="11.4" rx="1.6" ry="1.25"/><circle cx="10.1" cy="9.6" r=".62"/><circle cx="11.3" cy="8.6" r=".62"/><circle cx="12.7" cy="8.6" r=".62"/><circle cx="13.9" cy="9.6" r=".62"/></g><rect x="9" y="17.1" width="6" height="1.7" rx=".85" fill="#A7B3AF"/><rect x="9.5" y="19.2" width="5" height="1.6" rx=".8" fill="#86948F"/><path d="M11 21.2h2" stroke="#6E7C77" stroke-width="1.4" stroke-linecap="round"/><path d="M3 4.2l1.4.9M21 4.2l-1.4.9M1.8 10h1.6M20.6 10h1.6" stroke="#F2B63A" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  videoToken: `<svg class="ico ico--video" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="#8F7BF0" stroke="#6650D2" stroke-width="1.3"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#C3B8FB" stroke-width="1.1"/><path d="M10.2 8.4v7.2l5.6-3.6Z" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/><ellipse cx="8" cy="6.6" rx="2.2" ry="1.1" transform="rotate(-30 8 6.6)" fill="#fff" opacity=".45"/></svg>`,
  gem: `<svg class="ico ico--gem" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.4 3.8h11.2L22 9.2 12 21 2 9.2Z" fill="#5CCAE0" stroke="#2A8FA8" stroke-width="1.1" stroke-linejoin="round"/><path d="M2 9.2h20M6.4 3.8 8.6 9.2 12 21M17.6 3.8l-2.2 5.4L12 21M8.6 9.2 12 3.8l3.4 5.4" fill="none" stroke="#C9F2FA" stroke-width=".9" stroke-linejoin="round"/><path d="M6.4 3.8 2 9.2h6.6Z" fill="#9BE3F1"/><path d="M12 3.8 8.6 9.2h6.8Z" fill="#B7EEF7"/></svg>`,
  /** Animal food bowl (sanctuary treats and food). */
  bowl: `<svg class="ico ico--bowl" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="#C9874E"><circle cx="8.6" cy="11" r="1.7"/><circle cx="11.7" cy="10.2" r="1.8"/><circle cx="14.9" cy="10.9" r="1.7"/><circle cx="10.2" cy="12.2" r="1.5"/><circle cx="13.4" cy="12.1" r="1.5"/></g><path d="M3.2 12.6h17.6c0 4-3.6 7.2-8.8 7.2s-8.8-3.2-8.8-7.2Z" fill="#E96F67" stroke="#BF4C46" stroke-width="1"/><path d="M5.6 15.4c1.6 1.6 3.8 2.4 6.4 2.4" stroke="#F7A39C" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>`,
  /** A bone-shaped biscuit: one treat = one heart back on a casual board. Colored, like the coin. */
  treat: `<svg class="ico ico--treat" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.2 8.6a2.6 2.6 0 1 1 3.1-3.3l5.4 5.4a2.6 2.6 0 1 1 3.3 3.1 2.6 2.6 0 1 1-3.1 3.3l-5.4-5.4a2.6 2.6 0 1 1-3.3-3.1Z" fill="#E7B98A" stroke="#A9733F" stroke-width="1.4" stroke-linejoin="round"/><path d="M10.4 9.3l4.3 4.3" stroke="#F4D8B8" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  /** A hint ticket. */
  globe: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5Z"/>'),
  pin: wrap('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>'),
  sprout: wrap('<path d="M12 20v-7"/><path d="M12 13c0-3.5-2.6-6-6.5-6 0 3.6 2.6 6 6.5 6Z"/><path d="M12 11c0-3.2 2.3-5.5 6-5.5 0 3.3-2.3 5.5-6 5.5Z"/>'),
  ticket: `<svg class="ico ico--ticket" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 8a1.5 1.5 0 0 1 1.5-1.5h14A1.5 1.5 0 0 1 20.5 8v2a2 2 0 0 0 0 4v2a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 16v-2a2 2 0 0 0 0-4V8Z" fill="#9FD3C7" stroke="#287B70" stroke-width="1.4" stroke-linejoin="round"/><path d="M15 7v10" stroke="#287B70" stroke-width="1.2" stroke-dasharray="1.6 1.6"/><path d="M9.2 9.6a1.9 1.9 0 0 1 3.4 1.1c0 .9-.9 1.2-1.3 1.6-.2.2-.3.4-.3.8" stroke="#1D5C54" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="11" cy="14.6" r=".8" fill="#1D5C54"/></svg>`,
} as const;

export type IconName = keyof typeof ICON;
