/**
 * Trick art (D33): the emote bubble over an animal's head and each trick's props (music notes, a shower of stars, a
 * floating bubble, juggled stars, a rainbow). Drawn in scene units around the animal's bounding box; the motion lives
 * in styles/sanctuary-play.css (`.is-trick-<id>` on the figure, `.sp-trick--<id>` on these props).
 */

import type { EmoteGlyph, TrickId } from '../../meta/catalogs/tricks';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const f = (n: number) => n.toFixed(1);

const starPath = (x: number, y: number, r: number) =>
  `M${f(x)} ${f(y - r)} L${f(x + r * 0.3)} ${f(y - r * 0.3)} L${f(x + r)} ${f(y)} L${f(x + r * 0.3)} ${f(y + r * 0.3)} L${f(x)} ${f(y + r)} L${f(x - r * 0.3)} ${f(y + r * 0.3)} L${f(x - r)} ${f(y)} L${f(x - r * 0.3)} ${f(y - r * 0.3)} Z`;

/** A small glyph centered on (x, y), about `s` across. */
export function glyph(g: EmoteGlyph, x: number, y: number, s: number): string {
  const k = s / 10;
  switch (g) {
    case 'paw':
      return `<g fill="#c96f4a"><ellipse cx="${f(x)}" cy="${f(y + 1.6 * k)}" rx="${f(2.6 * k)}" ry="${f(2.1 * k)}"/><circle cx="${f(x - 2.8 * k)}" cy="${f(y - 1.2 * k)}" r="${f(1.1 * k)}"/><circle cx="${f(x)}" cy="${f(y - 2.6 * k)}" r="${f(1.1 * k)}"/><circle cx="${f(x + 2.8 * k)}" cy="${f(y - 1.2 * k)}" r="${f(1.1 * k)}"/></g>`;
    case 'bang':
      return `<g fill="#e8707a"><rect x="${f(x - 1.1 * k)}" y="${f(y - 4.4 * k)}" width="${f(2.2 * k)}" height="${f(6 * k)}" rx="${f(1.1 * k)}"/><circle cx="${f(x)}" cy="${f(y + 3.6 * k)}" r="${f(1.2 * k)}"/></g>`;
    case 'swirl':
      return `<path d="M${f(x)} ${f(y)} m${f(-0.5 * k)} 0 a${f(0.9 * k)} ${f(0.9 * k)} 0 1 1 ${f(1.8 * k)} 0 a${f(2 * k)} ${f(2 * k)} 0 1 1 ${f(-4 * k)} 0 a${f(3.2 * k)} ${f(3.2 * k)} 0 1 1 ${f(6.4 * k)} 0" stroke="#5b9bc4" stroke-width="${f(1.3 * k)}" fill="none" stroke-linecap="round"/>`;
    case 'sparkle':
      return `<path d="${starPath(x, y, 4.4 * k)}" fill="#d5a04b"/><path d="${starPath(x + 3.6 * k, y - 3.4 * k, 1.6 * k)}" fill="#f2cf72"/>`;
    case 'note':
      return `<g fill="#287b70"><ellipse cx="${f(x - 1.4 * k)}" cy="${f(y + 2.6 * k)}" rx="${f(2 * k)}" ry="${f(1.5 * k)}" transform="rotate(-20 ${f(x - 1.4 * k)} ${f(y + 2.6 * k)})"/><rect x="${f(x + 0.3 * k)}" y="${f(y - 4.2 * k)}" width="${f(0.9 * k)}" height="${f(7 * k)}"/><path d="M${f(x + 1.2 * k)} ${f(y - 4.2 * k)} q${f(3 * k)} ${f(1 * k)} ${f(3 * k)} ${f(4 * k)}" stroke="#287b70" stroke-width="${f(0.9 * k)}" fill="none"/></g>`;
    case 'star':
      return `<path d="${starPath(x, y, 4.6 * k)}" fill="#f2c230" stroke="#d59a1c" stroke-width="${f(0.5 * k)}"/>`;
    case 'bubble':
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(3.8 * k)}" fill="#cfeaf7" stroke="#7fb8d8" stroke-width="${f(0.7 * k)}"/><path d="M${f(x - 2 * k)} ${f(y - 1.2 * k)} a${f(2.4 * k)} ${f(2.4 * k)} 0 0 1 ${f(1.8 * k)} ${f(-1.8 * k)}" stroke="#fff" stroke-width="${f(0.8 * k)}" fill="none" stroke-linecap="round"/>`;
    case 'rainbow':
      return ['#e8707a', '#f2c230', '#6fb07c', '#5b9bc4']
        .map((c, i) => `<path d="M${f(x - (4.6 - i) * k)} ${f(y + 2.4 * k)} a${f((4.6 - i) * k)} ${f((4.6 - i) * k)} 0 0 1 ${f(2 * (4.6 - i) * k)} 0" stroke="${c}" stroke-width="${f(0.9 * k)}" fill="none"/>`)
        .join('');
  }
}

/**
 * The emote bubble beside an animal's head (the box), on its right unless that would leave the scene (`width`). Beside
 * rather than above, so a jumping, flipping or floating animal never passes through it.
 */
export function emoteBubble(g: EmoteGlyph, b: Box, width = Infinity): string {
  const w = 17;
  const h = 14;
  const right = b.x + b.w + w + 2 <= width;
  const x = right ? b.x + b.w * 0.72 : b.x + b.w * 0.28 - w;
  const y = Math.max(1, b.y - h + 2);
  const tx = right ? x + 3.5 : x + w - 3.5;
  const dir = right ? -1 : 1;
  return `<g class="sp-trick-emote">
    <rect x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" rx="6" fill="#fff" stroke="rgba(40,52,52,0.25)" stroke-width="0.8"/>
    <path d="M${f(tx - 2.2)} ${f(y + h - 0.4)} L${f(tx + dir * 2.6)} ${f(y + h + 3.6)} L${f(tx + 2.2)} ${f(y + h - 0.4)} Z" fill="#fff"/>
    ${glyph(g, x + w / 2, y + h / 2, 10)}
  </g>`;
}

/**
 * Props and particles for a trick, around an animal's box. `dir` is which way a travelling trick goes (1 = right,
 * -1 = left): toward the middle of the scene, so the rainbow leap never runs off its edge.
 */
export function trickProps(id: TrickId, b: Box, dir: 1 | -1 = 1): string {
  const cx = b.x + b.w / 2;
  const top = b.y;
  const bottom = b.y + b.h;
  const r = Math.max(b.w, b.h) * 0.62;
  switch (id) {
    case 'dance':
      return `<g class="sp-trick-notes">${glyph('note', cx - b.w * 0.62, top + 8, 11)}${glyph('note', cx + b.w * 0.62, top + 3, 12)}</g>`;
    case 'backflip':
      return `<g class="sp-trick-burst">${[-1, -0.5, 0, 0.5, 1].map((t, i) => `<path d="${starPath(cx + t * b.w * 0.85, bottom - 5 - (i % 2) * 7, 3.6)}" fill="${i % 2 ? '#f2c230' : '#fff3b0'}" stroke="#ffffff" stroke-width="0.6"/>`).join('')}</g>`;
    case 'bubble':
      return `<g class="sp-trick-orb"><circle cx="${f(cx)}" cy="${f(b.y + b.h / 2)}" r="${f(r)}" fill="#cfeaf7" fill-opacity="0.32" stroke="#ffffff" stroke-width="1.4"/>
        <path d="M${f(cx - r * 0.55)} ${f(b.y + b.h / 2 - r * 0.45)} a${f(r * 0.7)} ${f(r * 0.7)} 0 0 1 ${f(r * 0.5)} ${f(-r * 0.3)}" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <circle cx="${f(cx + r * 0.5)}" cy="${f(b.y + b.h / 2 - r * 0.5)}" r="1.4" fill="#fff"/></g>
        <g class="sp-trick-pop">${[0, 60, 120, 180, 240, 300].map((a) => {
          const x = cx + Math.cos((a * Math.PI) / 180) * r;
          const y = b.y + b.h / 2 - 26 + Math.sin((a * Math.PI) / 180) * r;
          return `<circle cx="${f(x)}" cy="${f(y)}" r="1.6" fill="#cfeaf7" stroke="#fff" stroke-width="0.6"/>`;
        }).join('')}</g>`;
    case 'juggle':
      return `<g class="sp-trick-balls">${[0, 1, 2].map((i) => `<g class="sp-trick-ball sp-trick-ball--${i}">${glyph('star', cx + (i - 1) * 6, top - 4, 7)}</g>`).join('')}</g>`;
    case 'rainbow': {
      const span = 44;
      const ry = 26;
      // Painted from the animal's side to where it lands, so it always draws in the direction of the leap.
      const from = cx - dir * 2;
      return `<g class="sp-trick-rainbow">${['#e8707a', '#f6a23a', '#f2c230', '#6fb07c', '#5b9bc4', '#9b7fd0']
        .map((c, i) => `<path d="M${f(from + dir * i * 1.6)} ${f(bottom)} A${f(span / 2 - i * 1.6)} ${f(ry - i * 1.6)} 0 0 ${dir === 1 ? 1 : 0} ${f(from + dir * (span - i * 1.6))} ${f(bottom)}" stroke="${c}" stroke-width="1.8" fill="none" pathLength="100"/>`)
        .join('')}</g>
        <g class="sp-trick-burst">${[0, 1, 2].map((i) => `<path d="${starPath(cx + dir * (span - 6 + i * 6), bottom - 6 - (i % 2) * 6, 3)}" fill="#fff3b0" stroke="#f2c230" stroke-width="0.5"/>`).join('')}</g>`;
    }
    default:
      return '';
  }
}

/** Which way a travelling trick goes from this box: toward the middle of a scene `width` wide. */
export function trickDir(b: Box, width: number): 1 | -1 {
  return Number.isFinite(width) && b.x + b.w / 2 > width / 2 ? -1 : 1;
}

export function trickOverlay(id: TrickId, glyphId: EmoteGlyph, b: Box, width = Infinity): string {
  return `<g class="sp-trick sp-trick--${id}" aria-hidden="true">${trickProps(id, b, trickDir(b, width))}${emoteBubble(glyphId, b, width)}</g>`;
}

/** A trick's badge for cards and the tray. */
export function trickBadge(g: EmoteGlyph, label?: string): string {
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="trick-badge" viewBox="0 0 24 24" ${a11y}>${glyph(g, 12, 12, 18)}</svg>`;
}
