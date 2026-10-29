/**
 * Wildlife friends, drawn in code in the same storybook style as the residents. Each head is a 64×64 rig; each figure
 * is built from named groups so the sanctuary's ambient life can move a tail or blink an eye:
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
  gumnut: { fur: '#A6ADB4', light: '#EEF0F2', dark: '#3D3A3C', accent: '#D7DBDF' },
  skipper: { fur: '#C98B5A', light: '#F3DCC3', dark: '#3A2E28', accent: '#E9B8A0' },
  dozer: { fur: '#8C7461', light: '#BBA690', dark: '#4A3B32', accent: '#A68D77' },
  zuri: { fur: '#F2C766', light: '#F8E2AE', dark: '#8A5A2B', accent: '#D99A45' },
  sunny: { fur: '#D8B98C', light: '#F3E4CA', dark: '#6B5440', accent: '#C49E6D' },
  tembo: { fur: '#A9B6C6', light: '#C9D3DE', dark: '#59677A', accent: '#E9C1C6' },
  luna: { fur: '#F7F8FA', light: '#FFFFFF', dark: '#3B3F45', accent: '#9AA4AE' },
  frost: { fur: '#F4F1E8', light: '#FBF9F3', dark: '#2F2A27', accent: '#E0D8C7' },
  pebble: { fur: '#D3D9DF', light: '#EEF1F4', dark: '#3B3F45', accent: '#B5BFC9' },
  rio: { fur: '#2B2B30', light: '#FCE7A0', dark: '#1A1A1E', accent: '#F6A23A' },
  mango: { fur: '#B59B7C', light: '#EADCC4', dark: '#5A4636', accent: '#C9B194' },
  pudding: { fur: '#B58A62', light: '#C99D74', dark: '#3A2E28', accent: '#9E7452' },
};

interface FaceOpts {
  eyes?: [number, number, number, number];
  eyeR?: [number, number];
  nose?: string;
  /** Mouth baseline; null for no mouth (trunk, beak). */
  mouthY?: number | null;
  blushY?: number;
  /** Owl: big yellow eyes. Toucan: one eye with a blue ring. */
  kind?: 'normal' | 'owl' | 'side';
  eyeFill?: string;
}

function face(mood: CompanionMood, o: FaceOpts = {}): string {
  const closed = mood === 'sleepy';
  const happy = mood === 'happy';
  const [lx, ly, rx, ry] = o.eyes ?? [24, 33, 40, 33];
  const [er, eh] = o.eyeR ?? [2.7, 3.3];
  const fill = o.eyeFill ?? INK;
  let open: string;
  let shut: string;
  if (o.kind === 'owl') {
    open = `<g class="sp-eyes-open" style="opacity:${closed ? 0 : 1}">${[lx, rx]
      .map((x, i) => `<circle cx="${x}" cy="${i ? ry : ly}" r="6" fill="#F2C230" stroke="${o.nose ? '#3B3F45' : INK}" stroke-width=".8"/><circle cx="${x}" cy="${i ? ry : ly}" r="3.1" fill="${INK}"/><circle cx="${x + 1.2}" cy="${(i ? ry : ly) - 1.3}" r="1" fill="#fff"/>`)
      .join('')}</g>`;
    shut = `<g class="sp-eyes-closed" style="opacity:${closed ? 1 : 0}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"><path d="M${lx - 4} ${ly} q4 3 8 0"/><path d="M${rx - 4} ${ry} q4 3 8 0"/></g>`;
  } else if (o.kind === 'side') {
    open = `<g class="sp-eyes-open" style="opacity:${closed ? 0 : 1}"><circle cx="${lx}" cy="${ly}" r="5.4" fill="#6CC3E8"/><circle cx="${lx}" cy="${ly}" r="2.7" fill="${INK}"/><circle cx="${lx + 1}" cy="${ly - 1}" r=".9" fill="#fff"/></g>`;
    shut = `<g class="sp-eyes-closed" style="opacity:${closed ? 1 : 0}"><circle cx="${lx}" cy="${ly}" r="5.4" fill="#6CC3E8"/><path d="M${lx - 3} ${ly} q3 2.4 6 0" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round"/></g>`;
  } else {
    open = `<g class="sp-eyes-open" style="opacity:${closed ? 0 : 1}">
      <ellipse cx="${lx}" cy="${ly}" rx="${er}" ry="${eh}" fill="${fill}"/><ellipse cx="${rx}" cy="${ry}" rx="${er}" ry="${eh}" fill="${fill}"/>
      <circle cx="${lx + 1}" cy="${ly - 1.2}" r="0.95" fill="#fff"/><circle cx="${rx + 1}" cy="${ry - 1.2}" r="0.95" fill="#fff"/></g>`;
    shut = `<g class="sp-eyes-closed" style="opacity:${closed ? 1 : 0}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round">
      <path d="M${lx - 2.8} ${ly + 0.4} q2.8 2.4 5.6 0"/><path d="M${rx - 2.8} ${ry + 0.4} q2.8 2.4 5.6 0"/></g>`;
  }
  const my = o.mouthY === undefined ? 45.4 : o.mouthY;
  const mouth =
    my === null
      ? ''
      : `<g fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round">
      <path class="sp-mouth--idle" style="opacity:${happy ? 0 : 1}" d="M30 ${my} q2 1.2 4 0"/>
      <path class="sp-mouth--happy" style="opacity:${happy ? 1 : 0}" d="M28.6 ${my - 0.4} q3.4 3.2 6.8 0"/></g>`;
  const by = o.blushY ?? 39;
  const blush = o.kind === 'side' ? '' : `<ellipse cx="${lx - 4.5}" cy="${by}" rx="3" ry="1.8" fill="#F09C98" opacity="${happy ? 0.55 : 0.3}"/><ellipse cx="${rx + 4.5}" cy="${by}" rx="3" ry="1.8" fill="#F09C98" opacity="${happy ? 0.55 : 0.3}"/>`;
  return `${blush}${open}${shut}${o.nose ?? ''}${mouth}`;
}

const HEADS: Record<CompanionId, (m: CompanionMood) => string> = {
  ember: (m) => {
    const p = PAL.ember;
    return `
    <path d="M13 27 L17 5 L29 17 Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M51 27 L47 5 L35 17 Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M17 9 L19 5 L22 11 Z" fill="${p.dark}"/><path d="M47 9 L45 5 L42 11 Z" fill="${p.dark}"/>
    <path d="M17.5 22 L19 11 L25 17.5 Z" fill="${p.accent}"/><path d="M46.5 22 L45 11 L39 17.5 Z" fill="${p.accent}"/>
    <path d="M9 30 C9 18 21 14 32 14 C43 14 55 18 55 30 C55 41 45 50 32 54 C19 50 9 41 9 30 Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <path d="M9.5 32 C14 44 24 50 32 54 C40 50 50 44 54.5 32 C48 39 40 41 32 41 C24 41 16 39 9.5 32 Z" fill="${p.light}"/>
    <ellipse cx="32" cy="44" rx="6.8" ry="5" fill="${p.light}"/>
    ${face(m, { nose: `<ellipse cx="32" cy="41.6" rx="2.6" ry="1.8" fill="${INK}"/>`, mouthY: 45.4 })}`;
  },
  maple: (m) => {
    const p = PAL.maple;
    return `
    <circle cx="15" cy="17" r="7.5" fill="${p.fur}" stroke="${p.light}" stroke-width="2.2"/><circle cx="15" cy="17" r="3.4" fill="${p.dark}"/>
    <circle cx="49" cy="17" r="7.5" fill="${p.fur}" stroke="${p.light}" stroke-width="2.2"/><circle cx="49" cy="17" r="3.4" fill="${p.dark}"/>
    <ellipse cx="32" cy="34" rx="22" ry="19" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="23.5" cy="25.5" rx="3.4" ry="2.2" fill="${p.light}"/><ellipse cx="40.5" cy="25.5" rx="3.4" ry="2.2" fill="${p.light}"/>
    <path d="M17 36 C17 46 24 51 32 51 C40 51 47 46 47 36 C42 41 37 40 32 40 C27 40 22 41 17 36 Z" fill="${p.light}"/>
    <path d="M24 36 C23.5 40 25.5 44 28 46" stroke="${p.fur}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M40 36 C40.5 40 38.5 44 36 46" stroke="${p.fur}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    ${face(m, { nose: `<ellipse cx="32" cy="40.2" rx="2.9" ry="2" fill="${INK}"/>`, mouthY: 44.2 })}`;
  },
  gumnut: (m) => {
    const p = PAL.gumnut;
    return `
    <circle cx="13" cy="22" r="11" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><circle cx="13.5" cy="22.5" r="6.5" fill="${p.light}"/>
    <circle cx="51" cy="22" r="11" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><circle cx="50.5" cy="22.5" r="6.5" fill="${p.light}"/>
    <ellipse cx="32" cy="36" rx="20" ry="18" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="32" cy="46" rx="11" ry="6.5" fill="${p.light}" opacity=".55"/>
    ${face(m, {
      eyes: [23.5, 33, 40.5, 33],
      eyeR: [2.4, 2.9],
      nose: `<ellipse cx="32" cy="40" rx="4.8" ry="6.2" fill="${p.dark}"/><ellipse cx="30.6" cy="37.6" rx="1.3" ry="1.8" fill="#fff" opacity=".35"/>`,
      mouthY: 49.5,
      blushY: 41,
    })}`;
  },
  skipper: (m) => {
    const p = PAL.skipper;
    return `
    <ellipse cx="21" cy="13" rx="5.6" ry="12" transform="rotate(-14 21 13)" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><ellipse cx="21" cy="14" rx="2.6" ry="8" transform="rotate(-14 21 14)" fill="${p.accent}"/>
    <ellipse cx="43" cy="13" rx="5.6" ry="12" transform="rotate(14 43 13)" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><ellipse cx="43" cy="14" rx="2.6" ry="8" transform="rotate(14 43 14)" fill="${p.accent}"/>
    <ellipse cx="32" cy="35" rx="18" ry="17" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="32" cy="45" rx="10.5" ry="8" fill="${p.light}"/>
    ${face(m, { eyes: [25, 32, 39, 32], nose: `<path d="M29.4 40.6h5.2l-2.6 3.1z" fill="${p.dark}"/>`, mouthY: 48.6, blushY: 39.5 })}`;
  },
  dozer: (m) => {
    const p = PAL.dozer;
    return `
    <circle cx="16" cy="19" r="5.6" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><circle cx="16" cy="19" r="2.6" fill="${p.dark}"/>
    <circle cx="48" cy="19" r="5.6" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><circle cx="48" cy="19" r="2.6" fill="${p.dark}"/>
    <ellipse cx="32" cy="36" rx="22" ry="18" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="32" cy="45" rx="12.5" ry="8" fill="${p.light}"/>
    ${face(m, {
      eyes: [22.5, 31, 41.5, 31],
      eyeR: [2.3, 2.7],
      nose: `<rect x="26" y="36.5" width="12" height="8" rx="4" fill="${p.dark}"/><circle cx="29.5" cy="40.5" r="1" fill="#2a211c"/><circle cx="34.5" cy="40.5" r="1" fill="#2a211c"/>`,
      mouthY: 49.5,
      blushY: 40,
    })}`;
  },
  zuri: (m) => {
    const p = PAL.zuri;
    return `
    <path d="M25 17 L23.5 6" stroke="#B07B3E" stroke-width="3" stroke-linecap="round"/><circle cx="23.3" cy="5.6" r="2.7" fill="${p.dark}"/>
    <path d="M39 17 L40.5 6" stroke="#B07B3E" stroke-width="3" stroke-linecap="round"/><circle cx="40.7" cy="5.6" r="2.7" fill="${p.dark}"/>
    <ellipse cx="13" cy="22" rx="7.5" ry="3.8" transform="rotate(-22 13 22)" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="51" cy="22" rx="7.5" ry="3.8" transform="rotate(22 51 22)" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="32" cy="31" rx="16" ry="17" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <g fill="${p.accent}" opacity=".85"><path d="M22 19 l4 -2 3 3 -2 4 -4 0z"/><path d="M39 18 l4 1 1 4 -3 2 -3 -2z"/><path d="M31 14 l3 0 1 3 -3 1 -2 -2z"/></g>
    <ellipse cx="32" cy="43" rx="12" ry="9" fill="${p.light}" stroke="${OUT}" stroke-width=".6"/>
    ${face(m, { eyes: [25, 30, 39, 30], nose: `<circle cx="28.5" cy="42" r="1.1" fill="${p.dark}"/><circle cx="35.5" cy="42" r="1.1" fill="${p.dark}"/>`, mouthY: 47.5, blushY: 37 })}`;
  },
  sunny: (m) => {
    const p = PAL.sunny;
    return `
    <ellipse cx="15.5" cy="30" rx="3.6" ry="4.6" fill="${p.dark}"/><ellipse cx="48.5" cy="30" rx="3.6" ry="4.6" fill="${p.dark}"/>
    <path d="M32 12 C20 12 15 22 16 32 C17 42 25 52 32 56 C39 52 47 42 48 32 C49 22 44 12 32 12Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="32" cy="43" rx="8.5" ry="9.5" fill="${p.light}"/>
    <ellipse cx="24" cy="32" rx="5.6" ry="4.6" transform="rotate(18 24 32)" fill="${p.dark}"/><ellipse cx="40" cy="32" rx="5.6" ry="4.6" transform="rotate(-18 40 32)" fill="${p.dark}"/>
    ${face(m, { eyes: [24, 32, 40, 32], eyeR: [2.2, 2.6], eyeFill: '#1b1410', nose: `<ellipse cx="32" cy="49.5" rx="3" ry="2.2" fill="${INK}"/>`, mouthY: 53, blushY: 40 })}`;
  },
  tembo: (m) => {
    const p = PAL.tembo;
    return `
    <ellipse cx="13" cy="32" rx="11" ry="14.5" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><ellipse cx="14.2" cy="32" rx="7" ry="10" fill="${p.accent}"/>
    <ellipse cx="51" cy="32" rx="11" ry="14.5" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><ellipse cx="49.8" cy="32" rx="7" ry="10" fill="${p.accent}"/>
    <ellipse cx="32" cy="30" rx="18" ry="17" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <path d="M27.5 37 C27 45 28 52 31 56 C33 58.6 37.2 57.6 36.6 55 C35.2 51 35.6 45 36.6 37 Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <path d="M28.4 44h7M28.8 48h6.6M29.8 52h5.4" stroke="${p.dark}" stroke-width=".7" opacity=".45"/>
    <path d="M29.5 13.5 q2.5 -4.5 5 0" stroke="${p.dark}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".6"/>
    ${face(m, { eyes: [24.5, 29, 39.5, 29], mouthY: null, blushY: 36 })}`;
  },
  luna: (m) => {
    const p = PAL.luna;
    return `
    <path d="M15.5 15 L19.5 5.5 L24 13 Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M48.5 15 L44.5 5.5 L40 13 Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="22" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <g stroke="${p.accent}" stroke-width="1.3" stroke-linecap="round"><path d="M18 19h3M44 19h3M14 36h3M47 36h3M20 47h2.5M42 47h2.5"/></g>
    <circle cx="23" cy="31" r="9" fill="${p.light}"/><circle cx="41" cy="31" r="9" fill="${p.light}"/>
    ${face(m, { kind: 'owl', eyes: [23, 31, 41, 31], nose: `<path d="M29.4 37 L34.6 37 L32 43 Z" fill="${p.dark}"/>`, mouthY: null, blushY: 41 })}`;
  },
  frost: (m) => {
    const p = PAL.frost;
    return `
    <circle cx="15" cy="16" r="6.5" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><circle cx="15" cy="16" r="3.4" fill="${p.accent}"/>
    <circle cx="49" cy="16" r="6.5" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><circle cx="49" cy="16" r="3.4" fill="${p.accent}"/>
    <ellipse cx="32" cy="34" rx="21" ry="19" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="32" cy="44" rx="10.5" ry="7.5" fill="${p.light}" stroke="${OUT}" stroke-width=".5"/>
    ${face(m, { eyes: [24, 32, 40, 32], nose: `<ellipse cx="32" cy="40.6" rx="3.8" ry="2.8" fill="${p.dark}"/>`, mouthY: 47.5 })}`;
  },
  pebble: (m) => {
    const p = PAL.pebble;
    return `
    <ellipse cx="32" cy="34" rx="21" ry="19" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <g fill="${p.accent}" opacity=".7"><ellipse cx="20" cy="22" rx="2" ry="1.4"/><ellipse cx="45" cy="24" rx="2.2" ry="1.5"/><ellipse cx="41" cy="18" rx="1.4" ry="1"/></g>
    <ellipse cx="27" cy="43.5" rx="6.2" ry="5" fill="${p.light}"/><ellipse cx="37" cy="43.5" rx="6.2" ry="5" fill="${p.light}"/>
    <g fill="${p.accent}"><circle cx="24.5" cy="43" r=".7"/><circle cx="27" cy="45.2" r=".7"/><circle cx="39.5" cy="43" r=".7"/><circle cx="37" cy="45.2" r=".7"/></g>
    ${face(m, { eyes: [23, 31, 41, 31], eyeR: [3.8, 4.4], nose: `<path d="M29.8 38.6h4.4l-2.2 2.6z" fill="${p.dark}"/>`, mouthY: 48.6, blushY: 38 })}`;
  },
  rio: (m) => {
    const p = PAL.rio;
    return `
    <circle cx="26" cy="32" r="18" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <path d="M12 38 C14 50 25 55 34 50 C30 46 28.5 42 28.5 37 Z" fill="${p.light}"/>
    <path d="M33 25.5 C44 21 58 25 61.5 33.5 C58 40.5 46 44 33 41 C35 36 35 30.5 33 25.5Z" fill="${p.accent}" stroke="#C8721F" stroke-width="1"/>
    <path d="M34.5 27 C44 23.5 55.5 26.5 60 31.5" stroke="#F6D24A" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M56 29.6 C59.5 30.8 61.6 33 61.5 33.5 C59.6 37 57.4 38.2 55 38.4Z" fill="${p.fur}"/>
    <path d="M34 34.5 C42 35.5 50 35 58 33.5" stroke="#C8721F" stroke-width=".9" fill="none"/>
    ${face(m, { kind: 'side', eyes: [22, 28.5, 0, 0], mouthY: null })}`;
  },
  mango: (m) => {
    const p = PAL.mango;
    return `
    <ellipse cx="32" cy="34" rx="20" ry="19" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <path d="M24 16 q3 -5 6 -1 q2 -4 5 0 q3 -3 5 1" stroke="${p.fur}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="32" cy="37" rx="15.5" ry="13.5" fill="${p.light}"/>
    <path d="M16.5 30.5 C20 27.5 26 28.5 28.5 32.5 C26.5 37 21 38.2 17.6 36 Z" fill="${p.dark}"/>
    <path d="M47.5 30.5 C44 27.5 38 28.5 35.5 32.5 C37.5 37 43 38.2 46.4 36 Z" fill="${p.dark}"/>
    ${face(m, { eyes: [23.5, 33, 40.5, 33], eyeR: [2.2, 2.6], eyeFill: '#130e0b', nose: `<ellipse cx="32" cy="41" rx="3.3" ry="2.5" fill="${p.dark}"/>`, mouthY: 45.6, blushY: 41 })}`;
  },
  pudding: (m) => {
    const p = PAL.pudding;
    return `
    <ellipse cx="18" cy="15.5" rx="4.2" ry="3.6" fill="${p.accent}" stroke="${OUT}" stroke-width=".8"/><ellipse cx="46" cy="15.5" rx="4.2" ry="3.6" fill="${p.accent}" stroke="${OUT}" stroke-width=".8"/>
    <rect x="12" y="13" width="40" height="42" rx="17" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    <rect x="19" y="33.5" width="26" height="19" rx="9.5" fill="${p.accent}"/>
    ${face(m, {
      eyes: [24, 27, 40, 27],
      eyeR: [2.2, 2.5],
      nose: `<ellipse cx="28" cy="39.5" rx="1.7" ry="1.3" fill="${p.dark}"/><ellipse cx="36" cy="39.5" rx="1.7" ry="1.3" fill="${p.dark}"/>`,
      mouthY: 46.5,
      blushY: 33,
    })}`;
  },
};

function head(id: CompanionId, mood: CompanionMood): string {
  return HEADS[id](mood);
}

/** Portrait for cards, the win sheet and the companion rows. */
export function companionSvg(id: CompanionId, mood: CompanionMood = 'idle', label?: string): string {
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="friend" data-friend="${id}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" ${a11y}>${head(id, mood)}</svg>`;
}

type BodyKind = 'seated' | 'tall' | 'bird' | 'seal' | 'big';
const BODY: Partial<Record<CompanionId, BodyKind>> = { zuri: 'tall', luna: 'bird', rio: 'bird', pebble: 'seal', tembo: 'big', frost: 'big' };
type TailKind = 'fox' | 'panda' | 'kangaroo' | 'stub' | 'none';
const TAIL: Partial<Record<CompanionId, TailKind>> = { ember: 'fox', maple: 'panda', skipper: 'kangaroo', zuri: 'stub', tembo: 'stub', sunny: 'stub', pudding: 'none', gumnut: 'none', dozer: 'none', mango: 'none', frost: 'stub' };

/**
 * A companion whose ground contact is (x, y); H is the figure scale (residents use 46). The outer group carries the
 * ambient classes; the tail is its own group so it can wag around its base.
 */
export function companionFigure(id: CompanionId, x: number, y: number, H: number, mood: CompanionMood): string {
  const p = PAL[id];
  const P = (dx: number, dy: number) => `${(x + dx * H).toFixed(1)} ${(y + dy * H).toFixed(1)}`;
  const kind = BODY[id] ?? 'seated';
  const big = kind === 'big';
  const bw = H * (big ? 0.33 : 0.27);
  const bh = H * (big ? 0.27 : 0.24);
  const by = y - bh;
  const tailKind = TAIL[id] ?? 'stub';
  let tail = '';
  if (tailKind === 'fox')
    tail = `<path d="M${P(0.16, -0.06)} C${P(0.6, -0.02)} ${P(0.7, -0.4)} ${P(0.46, -0.58)} C${P(0.42, -0.4)} ${P(0.36, -0.22)} ${P(0.14, -0.2)} Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
         <path d="M${P(0.4, -0.5)} C${P(0.44, -0.55)} ${P(0.47, -0.58)} ${P(0.46, -0.58)} C${P(0.56, -0.5)} ${P(0.54, -0.42)} ${P(0.5, -0.4)} Z" fill="${p.light}"/>`;
  else if (tailKind === 'panda')
    tail = `<path d="M${P(0.16, -0.1)} C${P(0.5, -0.06)} ${P(0.62, -0.32)} ${P(0.5, -0.56)}" stroke="${p.fur}" stroke-width="${(H * 0.14).toFixed(1)}" stroke-linecap="round" fill="none"/>
         <path d="M${P(0.16, -0.1)} C${P(0.5, -0.06)} ${P(0.62, -0.32)} ${P(0.5, -0.56)}" stroke="${p.accent}" stroke-width="${(H * 0.14).toFixed(1)}" stroke-dasharray="${(H * 0.07).toFixed(1)} ${(H * 0.08).toFixed(1)}" fill="none"/>`;
  else if (tailKind === 'kangaroo')
    tail = `<path d="M${P(0.14, -0.06)} C${P(0.4, -0.02)} ${P(0.56, 0.0)} ${P(0.66, -0.03)}" stroke="${p.fur}" stroke-width="${(H * 0.11).toFixed(1)}" stroke-linecap="round" fill="none"/>`;
  else if (tailKind === 'stub') tail = `<ellipse cx="${(x + bw * 0.95).toFixed(1)}" cy="${(y - H * 0.08).toFixed(1)}" rx="${(H * 0.06).toFixed(1)}" ry="${(H * 0.04).toFixed(1)}" fill="${p.fur}" stroke="${OUT}" stroke-width=".8"/>`;

  const k = H / 64;
  let bodySvg: string;
  let headTop = y - bh * 1.55 - H * 0.82;
  let headX = x - H / 2;
  if (kind === 'bird') {
    const egg = `<ellipse cx="${x}" cy="${(y - H * 0.3).toFixed(1)}" rx="${(H * 0.26).toFixed(1)}" ry="${(H * 0.32).toFixed(1)}" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>`;
    const chest = id === 'rio' ? `<ellipse cx="${x}" cy="${(y - H * 0.38).toFixed(1)}" rx="${(H * 0.14).toFixed(1)}" ry="${(H * 0.16).toFixed(1)}" fill="${p.light}"/>` : `<path d="M${P(-0.2, -0.32)} q${(H * 0.2).toFixed(1)} ${(H * 0.12).toFixed(1)} ${(H * 0.4).toFixed(1)} 0" stroke="${p.accent}" stroke-width="1.2" fill="none"/>`;
    const wings = `<path d="M${P(-0.24, -0.42)} C${P(-0.34, -0.26)} ${P(-0.3, -0.1)} ${P(-0.18, -0.06)}" stroke="${p.accent}" stroke-width="1.4" fill="none"/><path d="M${P(0.24, -0.42)} C${P(0.34, -0.26)} ${P(0.3, -0.1)} ${P(0.18, -0.06)}" stroke="${p.accent}" stroke-width="1.4" fill="none"/>`;
    const feet = `<path d="M${P(-0.08, 0)} v${(-H * 0.04).toFixed(1)} M${P(0.08, 0)} v${(-H * 0.04).toFixed(1)}" stroke="#E5A23C" stroke-width="2" stroke-linecap="round"/>`;
    bodySvg = `<ellipse cx="${x}" cy="${y + 0.5}" rx="${(H * 0.24).toFixed(1)}" ry="${(H * 0.05).toFixed(1)}" fill="${SHADOW}"/>${egg}${chest}${wings}${feet}`;
    headTop = y - H * 0.5 - H * 0.82;
  } else if (kind === 'seal') {
    bodySvg = `<ellipse cx="${(x + H * 0.1).toFixed(1)}" cy="${y + 0.5}" rx="${(H * 0.46).toFixed(1)}" ry="${(H * 0.06).toFixed(1)}" fill="${SHADOW}"/>
      <path d="M${P(-0.28, -0.02)} C${P(-0.3, -0.3)} ${P(0.2, -0.32)} ${P(0.44, -0.1)} C${P(0.56, -0.02)} ${P(0.6, 0.0)} ${P(0.52, 0.0)} Z" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
      <path d="M${P(0.5, -0.04)} l${(H * 0.12).toFixed(1)} ${(-H * 0.08).toFixed(1)} l${(-H * 0.02).toFixed(1)} ${(H * 0.1).toFixed(1)} z" fill="${p.accent}"/>
      <ellipse cx="${(x - H * 0.06).toFixed(1)}" cy="${(y - H * 0.05).toFixed(1)}" rx="${(H * 0.1).toFixed(1)}" ry="${(H * 0.04).toFixed(1)}" fill="${p.accent}" transform="rotate(-20 ${(x - H * 0.06).toFixed(1)} ${(y - H * 0.05).toFixed(1)})"/>`;
    headTop = y - H * 0.88;
    headX = x - H * 0.62;
  } else {
    const neck =
      kind === 'tall'
        ? `<rect x="${(x - H * 0.09).toFixed(1)}" y="${(by - H * 0.56).toFixed(1)}" width="${(H * 0.18).toFixed(1)}" height="${(H * 0.64).toFixed(1)}" rx="${(H * 0.07).toFixed(1)}" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/><g fill="${p.accent}" opacity=".85"><rect x="${(x - H * 0.06).toFixed(1)}" y="${(by - H * 0.3).toFixed(1)}" width="${(H * 0.08).toFixed(1)}" height="${(H * 0.07).toFixed(1)}" rx="1.5"/><rect x="${(x + H * 0.01).toFixed(1)}" y="${(by - H * 0.14).toFixed(1)}" width="${(H * 0.06).toFixed(1)}" height="${(H * 0.06).toFixed(1)}" rx="1.5"/></g>`
        : '';
    const spots = kind === 'tall' ? `<g fill="${p.accent}" opacity=".85"><ellipse cx="${(x - bw * 0.4).toFixed(1)}" cy="${(by - bh * 0.2).toFixed(1)}" rx="${(H * 0.05).toFixed(1)}" ry="${(H * 0.04).toFixed(1)}"/><ellipse cx="${(x + bw * 0.45).toFixed(1)}" cy="${(by + bh * 0.1).toFixed(1)}" rx="${(H * 0.05).toFixed(1)}" ry="${(H * 0.04).toFixed(1)}"/></g>` : '';
    bodySvg = `
    <ellipse cx="${x}" cy="${y + 0.5}" rx="${(bw * 1.3).toFixed(1)}" ry="${(H * 0.06).toFixed(1)}" fill="${SHADOW}"/>
    ${neck}
    <ellipse cx="${x}" cy="${by.toFixed(1)}" rx="${bw.toFixed(1)}" ry="${bh.toFixed(1)}" fill="${p.fur}" stroke="${OUT}" stroke-width="1"/>
    ${spots}
    <ellipse cx="${x}" cy="${(by + bh * 0.12).toFixed(1)}" rx="${(bw * 0.5).toFixed(1)}" ry="${(bh * 0.72).toFixed(1)}" fill="${id === 'maple' ? p.dark : p.light}" opacity="0.95"/>
    <ellipse cx="${(x - bw * 0.45).toFixed(1)}" cy="${(y - H * 0.03).toFixed(1)}" rx="${(H * (id === 'skipper' ? 0.1 : 0.07)).toFixed(1)}" ry="${(H * 0.05).toFixed(1)}" fill="${id === 'ember' || id === 'maple' ? p.dark : p.fur}" stroke="${OUT}" stroke-width=".8"/>
    <ellipse cx="${(x + bw * 0.45).toFixed(1)}" cy="${(y - H * 0.03).toFixed(1)}" rx="${(H * (id === 'skipper' ? 0.1 : 0.07)).toFixed(1)}" ry="${(H * 0.05).toFixed(1)}" fill="${id === 'ember' || id === 'maple' ? p.dark : p.fur}" stroke="${OUT}" stroke-width=".8"/>`;
    if (kind === 'tall') headTop -= H * 0.4;
  }
  const name = COMPANION_BY_ID[id].name;
  return `<g class="sanctuary__pet sanctuary__friend" data-friend="${id}" data-name="${name}">${bodySvg}<g class="sp-tail">${tail}</g><g transform="translate(${headX.toFixed(1)} ${headTop.toFixed(1)}) scale(${k.toFixed(3)})">${head(id, mood)}</g></g>`;
}

/** The figure's head-top y, for placing a floating heart above it. */
export function figureTop(id: CompanionId, y: number, H: number): number {
  const kind = BODY[id] ?? 'seated';
  const big = kind === 'big';
  const bh = H * (big ? 0.27 : 0.24);
  if (kind === 'bird') return y - H * 0.5 - H * 0.82;
  if (kind === 'seal') return y - H * 0.88;
  return y - bh * 1.55 - H * 0.82 - (kind === 'tall' ? H * 0.4 : 0);
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
