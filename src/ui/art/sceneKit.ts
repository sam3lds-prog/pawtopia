/** Shared pieces for the sanctuary scenes (Harmony and the regional sanctuaries): outline and shadow tones, the decor art shape, hearts and evening fireflies. */

export const OUT = 'rgba(40,52,52,0.28)';
export const SHADOW = 'rgba(40,52,52,0.13)';

export interface DecorArt {
  /** Ground line used for back-to-front ordering. Negative: a sky item, drawn behind the land. */
  base: number;
  /** Crop box for a standalone icon [x, y, w, h]. */
  box: [number, number, number, number];
  draw(): string;
}

/** A small heart that floats over a figure when the player pats it (hidden until `.is-love`). */
export function heartAbove(x: number, y: number): string {
  return `<path class="sp-heart" d="M${x} ${y + 3.2} c-3.6 -2.4 -5.4 -4.2 -5.4 -6.2 c0 -1.6 1.2 -2.8 2.7 -2.8 c1.2 0 2.1 0.7 2.7 1.6 c0.6 -0.9 1.5 -1.6 2.7 -1.6 c1.5 0 2.7 1.2 2.7 2.8 c0 2 -1.8 3.8 -5.4 6.2 z" fill="#E8707A" opacity="0"/>`;
}

export function fireflies(dots: Array<[number, number]>, color = '#fff3b0'): string {
  return `<g class="sp-fireflies">${dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${color}" opacity="0.25"/><circle cx="${x}" cy="${y}" r="1.4" fill="#fff8d6"/>`).join('')}</g>`;
}

/** Evening: a dusk wash and fireflies (or stars). */
export function dusk(dots: Array<[number, number]>, color?: string): string {
  return `<rect class="sp-dusk" width="360" height="300" fill="#3b3f6b" opacity="0.16" pointer-events="none"/>${fireflies(dots, color)}`;
}

/** Standalone icon of a decoration drawn at scene coordinates. */
export function iconFrom(a: DecorArt, label?: string): string {
  const [x, y, w, h] = a.box;
  const pad = 4;
  const size = Math.max(w, h) + pad * 2;
  const vx = x + w / 2 - size / 2;
  const vy = y + h / 2 - size / 2;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="decor-icon" viewBox="${vx} ${vy} ${size} ${size}" xmlns="http://www.w3.org/2000/svg" ${a11y}>${a.draw()}</svg>`;
}
