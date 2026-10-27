/**
 * Sanctuary companions, drawn in code in the same storybook style as the residents: Ember the fox and Maple the red
 * panda. Each figure is built from named groups so the sanctuary's ambient life can move a tail or blink an eye:
 *   .sp-tail          the tail (wags around its base)
 *   .sp-eyes-open / .sp-eyes-closed   crossfaded for blinks and naps
 *   .sp-mouth--idle / .sp-mouth--happy  crossfaded
 * They never appear on a puzzle board.
 */

import { COMPANION_BY_ID, type CompanionId } from '../../meta/catalogs/companions';

const OUT = 'rgba(40,52,52,0.32)';
const SHADOW = 'rgba(40,52,52,0.13)';
const INK = '#2F2A27';

export type CompanionMood = 'idle' | 'happy' | 'sleepy';

interface Pal {
  fur: string;
  light: string;
  dark: string;
  accent: string;
}

const PAL: Record<CompanionId, Pal> = {
  ember: { fur: '#E8884A', light: '#FFF3E2', dark: '#5B3A2E', accent: '#F4B07C' },
  maple: { fur: '#C65A31', light: '#FFF6EA', dark: '#4A2A22', accent: '#EBA96E' },
};

/** Face parts shared by both (64×64 head box). Eyes at (24, 33) and (40, 33). */
function face(id: CompanionId, mood: CompanionMood): string {
  const closed = mood === 'sleepy';
  const happy = mood === 'happy';
  const open = `<g class="sp-eyes-open" style="opacity:${closed ? 0 : 1}">
      <ellipse cx="24" cy="33" rx="2.7" ry="3.3" fill="${INK}"/><ellipse cx="40" cy="33" rx="2.7" ry="3.3" fill="${INK}"/>
      <circle cx="25" cy="31.8" r="0.95" fill="#fff"/><circle cx="41" cy="31.8" r="0.95" fill="#fff"/>
    </g>`;
  const shut = `<g class="sp-eyes-closed" style="opacity:${closed ? 1 : 0}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round">
      <path d="M21.2 33.4 q2.8 2.4 5.6 0"/><path d="M37.2 33.4 q2.8 2.4 5.6 0"/>
    </g>`;
  const nose = id === 'ember' ? `<ellipse cx="32" cy="41.6" rx="2.6" ry="1.8" fill="${INK}"/>` : `<ellipse cx="32" cy="40.2" rx="2.9" ry="2" fill="${INK}"/>`;
  const my = id === 'ember' ? 45.4 : 44.2;
  const mouth = `<g fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round">
      <path class="sp-mouth--idle" style="opacity:${happy ? 0 : 1}" d="M30 ${my} q2 1.2 4 0"/>
      <path class="sp-mouth--happy" style="opacity:${happy ? 1 : 0}" d="M28.6 ${my - 0.4} q3.4 3.2 6.8 0"/>
    </g>`;
  const blush = `<ellipse cx="19.5" cy="39" rx="3" ry="1.8" fill="#F09C98" opacity="${happy ? 0.55 : 0.3}"/><ellipse cx="44.5" cy="39" rx="3" ry="1.8" fill="#F09C98" opacity="${happy ? 0.55 : 0.3}"/>`;
  return `${blush}${open}${shut}${nose}${mouth}`;
}

function foxHead(mood: CompanionMood): string {
  const p = PAL.ember;
  return `
    <path d="M13 27 L17 5 L29 17 Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M51 27 L47 5 L35 17 Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M17 9 L19 5 L22 11 Z" fill="${p.dark}"/><path d="M47 9 L45 5 L42 11 Z" fill="${p.dark}"/>
    <path d="M17.5 22 L19 11 L25 17.5 Z" fill="${p.accent}"/><path d="M46.5 22 L45 11 L39 17.5 Z" fill="${p.accent}"/>
    <path d="M9 30 C9 18 21 14 32 14 C43 14 55 18 55 30 C55 41 45 50 32 54 C19 50 9 41 9 30 Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <path d="M9.5 32 C14 44 24 50 32 54 C40 50 50 44 54.5 32 C48 39 40 41 32 41 C24 41 16 39 9.5 32 Z" fill="${p.light}"/>
    <ellipse cx="32" cy="44" rx="6.8" ry="5" fill="${p.light}"/>
    ${face('ember', mood)}`;
}

function pandaHead(mood: CompanionMood): string {
  const p = PAL.maple;
  return `
    <circle cx="15" cy="17" r="7.5" fill="${p.fur}" stroke="${p.light}" stroke-width="2.2"/><circle cx="15" cy="17" r="3.4" fill="${p.dark}"/>
    <circle cx="49" cy="17" r="7.5" fill="${p.fur}" stroke="${p.light}" stroke-width="2.2"/><circle cx="49" cy="17" r="3.4" fill="${p.dark}"/>
    <ellipse cx="32" cy="34" rx="22" ry="19" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="23.5" cy="25.5" rx="3.4" ry="2.2" fill="${p.light}"/><ellipse cx="40.5" cy="25.5" rx="3.4" ry="2.2" fill="${p.light}"/>
    <path d="M17 36 C17 46 24 51 32 51 C40 51 47 46 47 36 C42 41 37 40 32 40 C27 40 22 41 17 36 Z" fill="${p.light}"/>
    <path d="M24 36 C23.5 40 25.5 44 28 46" stroke="${p.fur}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M40 36 C40.5 40 38.5 44 36 46" stroke="${p.fur}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    ${face('maple', mood)}`;
}

function head(id: CompanionId, mood: CompanionMood): string {
  return id === 'ember' ? foxHead(mood) : pandaHead(mood);
}

/** Portrait for cards, the win sheet and the companion row. */
export function companionSvg(id: CompanionId, mood: CompanionMood = 'idle', label?: string): string {
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="friend" data-friend="${id}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" ${a11y}>${head(id, mood)}</svg>`;
}

/**
 * A seated companion whose ground contact is (x, y); H is the figure height scale (residents use 46).
 * The outer group carries the ambient classes; the tail is its own group so it can wag around its base.
 */
export function companionFigure(id: CompanionId, x: number, y: number, H: number, mood: CompanionMood): string {
  const p = PAL[id];
  const P = (dx: number, dy: number) => `${(x + dx * H).toFixed(1)} ${(y + dy * H).toFixed(1)}`;
  const bw = H * 0.27;
  const bh = H * 0.24;
  const by = y - bh;
  const tail =
    id === 'ember'
      ? `<path d="M${P(0.16, -0.06)} C${P(0.6, -0.02)} ${P(0.7, -0.4)} ${P(0.46, -0.58)} C${P(0.42, -0.4)} ${P(0.36, -0.22)} ${P(0.14, -0.2)} Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
         <path d="M${P(0.4, -0.5)} C${P(0.44, -0.55)} ${P(0.47, -0.58)} ${P(0.46, -0.58)} C${P(0.56, -0.5)} ${P(0.54, -0.42)} ${P(0.5, -0.4)} Z" fill="${p.light}"/>`
      : `<path d="M${P(0.16, -0.1)} C${P(0.5, -0.06)} ${P(0.62, -0.32)} ${P(0.5, -0.56)}" stroke="${p.fur}" stroke-width="${(H * 0.14).toFixed(1)}" stroke-linecap="round" fill="none"/>
         <path d="M${P(0.16, -0.1)} C${P(0.5, -0.06)} ${P(0.62, -0.32)} ${P(0.5, -0.56)}" stroke="${p.accent}" stroke-width="${(H * 0.14).toFixed(1)}" stroke-dasharray="${(H * 0.07).toFixed(1)} ${(H * 0.08).toFixed(1)}" fill="none"/>`;
  const belly = id === 'ember' ? p.light : p.dark;
  const body = `
    <ellipse cx="${x}" cy="${y + 0.5}" rx="${(bw * 1.3).toFixed(1)}" ry="${(H * 0.06).toFixed(1)}" fill="${SHADOW}"/>
    <g class="sp-tail">${tail}</g>
    <ellipse cx="${x}" cy="${by.toFixed(1)}" rx="${bw.toFixed(1)}" ry="${bh.toFixed(1)}" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="${x}" cy="${(by + bh * 0.12).toFixed(1)}" rx="${(bw * 0.5).toFixed(1)}" ry="${(bh * 0.72).toFixed(1)}" fill="${belly}" opacity="0.95"/>
    <ellipse cx="${(x - bw * 0.45).toFixed(1)}" cy="${(y - H * 0.03).toFixed(1)}" rx="${(H * 0.07).toFixed(1)}" ry="${(H * 0.05).toFixed(1)}" fill="${p.dark}"/>
    <ellipse cx="${(x + bw * 0.45).toFixed(1)}" cy="${(y - H * 0.03).toFixed(1)}" rx="${(H * 0.07).toFixed(1)}" ry="${(H * 0.05).toFixed(1)}" fill="${p.dark}"/>`;
  const k = H / 64;
  const headTop = y - bh * 1.55 - H * 0.82;
  const name = COMPANION_BY_ID[id].name;
  return `<g class="sanctuary__pet sanctuary__friend" data-friend="${id}" data-name="${name}">${body}<g transform="translate(${(x - H / 2).toFixed(1)} ${headTop.toFixed(1)}) scale(${k.toFixed(3)})">${head(id, mood)}</g></g>`;
}

/** A small woodland nook (a mossy log and a bush) that appears when a woodland companion lives in the garden. */
export function woodlandNook(): string {
  return `
    <g data-habitat="woodland">
      <ellipse cx="44" cy="221" rx="30" ry="4" fill="${SHADOW}"/>
      <g fill="#7fb07c"><circle cx="20" cy="206" r="10"/><circle cx="31" cy="201" r="11"/><circle cx="12" cy="212" r="7"/></g>
      <g fill="#93c08e"><circle cx="24" cy="203" r="5"/><circle cx="33" cy="198" r="4"/></g>
      <rect x="26" y="208" width="44" height="12" rx="6" fill="#a8774f" stroke="${OUT}" stroke-width="1"/>
      <ellipse cx="68" cy="214" rx="4.2" ry="6" fill="#d9b07f" stroke="${OUT}" stroke-width="0.9"/>
      <ellipse cx="68" cy="214" rx="2" ry="3.2" fill="none" stroke="#b98a5a" stroke-width="0.9"/>
      <path d="M32 208 q6 -3 12 0" stroke="#79a86f" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <g fill="#f6c9d1"><circle cx="16" cy="200" r="1.6"/><circle cx="35" cy="196" r="1.4"/></g>
    </g>`;
}
