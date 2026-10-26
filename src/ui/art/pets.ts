/**
 * Original pet face rigs (Pawtopia artwork, drawn for this project; no third-party assets).
 *
 * Every pet is one 64×64 SVG with fixed layers:
 *   head-static  ears, head, markings, muzzle, nose, whiskers   — NEVER transformed or animated
 *   cheeks       blush (opacity only)
 *   eyes         open eyes (pupils glance inside the eye) + closed "smiling" arcs (crossfade)
 *   lids         fur-colored eyelids that lower from the top (blink, squint, sleepy)
 *   brows        small brow marks (lift / tilt a pixel or two)
 *   mouth        discrete mouth shapes (crossfade)
 *
 * Expressions are applied by setting a few data attributes and CSS custom properties on the <svg>.
 * styles/pets.css maps them to transforms on facial layers only, so the head never moves and the tile's
 * size and hit area never change. See test/unit/faces.test.ts for the guarantees.
 */

import { CAT, type Species } from '../../engine/types';
import { FOUNDING, PET_BY_ID, type PetDefinition, type PetId } from '../../meta/catalogs/pets';
import { clampLook, type FaceMood, type FaceView, type Look } from '../animation/faceMachine';

export type EyeState = 'open' | 'closed' | 'wink';
export type MouthShape = 'idle' | 'smile' | 'grin' | 'o' | 'flat';

export interface Pose {
  eyes: EyeState;
  /** Eyelid coverage 0 (none) … 1.05 (closed). */
  lid: number;
  /** Pupil glance offset in rig units, always within ±1.6. */
  px: number;
  py: number;
  /** Brow lift (negative = up) and tilt in degrees, left and right. */
  bly: number;
  blr: number;
  bry: number;
  brr: number;
  mouth: MouthShape;
  /** Blush opacity. */
  cheek: number;
}

const OUTLINE = 'rgba(40,52,52,0.34)';
const TONGUE = '#EC8790';

// ------------------------------------------------------------------ poses

const BASE: Record<Exclude<FaceMood, 'blink'>, Pose> = {
  idle: { eyes: 'open', lid: 0, px: 0, py: 0, bly: 0, blr: 0, bry: 0, brr: 0, mouth: 'idle', cheek: 0.28 },
  curious: { eyes: 'open', lid: 0, px: 0, py: 0, bly: -1.5, blr: 0, bry: -1.5, brr: 0, mouth: 'idle', cheek: 0.32 },
  happy: { eyes: 'open', lid: 0, px: 0, py: 0, bly: -1.2, blr: 0, bry: -1.2, brr: 0, mouth: 'smile', cheek: 0.85 },
  confused: { eyes: 'open', lid: 0, px: 0.9, py: -0.5, bly: 0.7, blr: 12, bry: -1.8, brr: -6, mouth: 'o', cheek: 0.24 },
  proud: { eyes: 'closed', lid: 0, px: 0, py: 0, bly: -1, blr: 0, bry: -1, brr: 0, mouth: 'smile', cheek: 0.9 },
  focused: { eyes: 'open', lid: 0.3, px: 0, py: 0.3, bly: 0.7, blr: 7, bry: 0.7, brr: -7, mouth: 'flat', cheek: 0.2 },
  sleepy: { eyes: 'open', lid: 0.64, px: 0, py: 0.4, bly: 0.6, blr: -4, bry: 0.6, brr: 4, mouth: 'idle', cheek: 0.34 },
  celebrate: { eyes: 'closed', lid: 0, px: 0, py: 0, bly: -1.4, blr: 0, bry: -1.4, brr: 0, mouth: 'grin', cheek: 0.95 },
};

/** Personality: how each pet's face departs from the shared poses. */
const PERSONALITY: Record<PetId, Partial<Record<Exclude<FaceMood, 'blink'>, Partial<Pose>>>> = {
  mochi: {
    happy: { eyes: 'closed', lid: 0 }, // serene: eyes close when content
    curious: { bly: -2, bry: -2 },
    sleepy: { lid: 0.72 },
  },
  pip: {
    idle: { cheek: 0.36 },
    happy: { lid: 0, mouth: 'grin', cheek: 0.95 }, // wide-eyed delight
    curious: { bly: -2, bry: -2 },
  },
  clover: {
    idle: { lid: 0.14 }, // a cool, unimpressed look
    curious: { bly: 0, blr: 0, bry: -2.4, brr: -9, lid: 0.1 }, // one skeptical brow
    happy: { lid: 0.1, mouth: 'smile', cheek: 0.6 }, // a shy smile
    celebrate: { eyes: 'wink', mouth: 'smile' },
  },
  biscuit: {
    happy: { mouth: 'grin' },
    proud: { mouth: 'grin' },
  },
  nori: {
    idle: { lid: 0.16 },
    focused: { lid: 0.46 }, // the signature squint
    happy: { eyes: 'closed', lid: 0, mouth: 'smile' }, // content
  },
  peanut: {
    idle: { cheek: 0.5 },
    curious: { cheek: 0.55 },
    happy: { cheek: 1 },
    proud: { eyes: 'wink', cheek: 1 },
    celebrate: { eyes: 'wink', cheek: 1 },
  },
};

export function poseFor(petId: PetId, mood: FaceMood, blinking = false, look: Look = [0, 0]): Pose {
  const m = mood === 'blink' ? 'idle' : mood;
  const p: Pose = { ...BASE[m], ...(PERSONALITY[petId][m] ?? {}) };
  if (m === 'curious' || m === 'confused') {
    const [lx, ly] = clampLook(look);
    if (lx !== 0 || ly !== 0) {
      p.px = lx;
      p.py = ly;
    } else if (m === 'curious' && petId === 'clover') p.px = 1.4; // the side-eye
  }
  if ((blinking || mood === 'blink') && p.eyes === 'open') p.lid = 1.05;
  return p;
}

/** Applies a face view to a mounted rig. Only attributes and custom properties change; no layout. */
export function applyFace(svg: SVGElement, petId: PetId, view: FaceView): void {
  const p = poseFor(petId, view.mood, view.blinking, view.look);
  svg.dataset.mood = view.mood;
  svg.dataset.eyes = p.eyes;
  svg.dataset.mouth = p.mouth;
  svg.setAttribute('style', poseStyle(p));
}

export function poseStyle(p: Pose): string {
  const f = (n: number) => String(Math.round(n * 100) / 100);
  return `--lid:${f(p.lid)};--px:${f(p.px)};--py:${f(p.py)};--bly:${f(p.bly)};--blr:${f(p.blr)};--bry:${f(p.bry)};--brr:${f(p.brr)};--cheek:${f(p.cheek)}`;
}

// ------------------------------------------------------------------ geometry

interface EyeGeo {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

function eyesOf(def: PetDefinition): [EyeGeo, EyeGeo] {
  return def.species === 'cat'
    ? [
        { cx: 23, cy: 35.6, rx: 3.6, ry: 4.3 },
        { cx: 41, cy: 35.6, rx: 3.6, ry: 4.3 },
      ]
    : [
        { cx: 23.5, cy: 33.4, rx: 3.5, ry: 4.1 },
        { cx: 40.5, cy: 33.4, rx: 3.5, ry: 4.1 },
      ];
}

/** Mirrors a path across x = 32. Paths passed here use only absolute M/L/C/Q/Z with "x y" pairs (no H/V/A). */
const mirrorX = (d: string) =>
  d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${Math.round((64 - Number(x)) * 100) / 100} ${y}`);

function pair(d: string, attrs: string): string {
  return `<path d="${d}" ${attrs}/><path d="${mirrorX(d)}" ${attrs}/>`;
}

function catEars(def: PetDefinition): string {
  const P = def.palette;
  const stroke = `stroke="${OUTLINE}" stroke-width="1.4" stroke-linejoin="round"`;
  if (def.ears === 'round') {
    return (
      pair('M11.6 29 C10.4 19 12.2 11.6 16.6 10.6 C20.6 9.8 25.6 13.8 29.4 19.6 Z', `fill="${P.ear}" ${stroke}`) +
      pair('M14.8 25 C14.4 18.6 15.4 14.6 17.8 14 C20.4 13.6 23.4 16.4 25.8 19.8 Z', `fill="${P.innerEar}"`)
    );
  }
  const ear = pair('M11.8 29.6 L13.2 9.4 C13.4 7.6 15 7 16.2 8.1 L29.6 19.4 Z', `fill="${P.ear}" ${stroke}`);
  const inner = pair('M15.2 25.4 L16 12.6 L25.4 19.8 Z', `fill="${P.innerEar}"`);
  const tufts = def.ears === 'tufted' ? pair('M14.6 9.6 L13.2 5.6 M16.4 9.8 L16.6 5.4', `stroke="${P.shade}" stroke-width="1.3" stroke-linecap="round" fill="none"`) : '';
  return ear + inner + tufts;
}

function catHead(def: PetDefinition): string {
  const P = def.palette;
  const head = `<path d="M32 18.6 C44.6 18.6 53.8 26.4 54.6 37 C55.4 46.8 46 55.4 32 55.4 C18 55.4 8.6 46.8 9.4 37 C10.2 26.4 19.4 18.6 32 18.6 Z" fill="${P.fur}" stroke="${OUTLINE}" stroke-width="1.4"/>`;
  // Soft cheek fluff on the jaw line.
  const fluff = pair('M10.4 41.6 C9.4 45.2 11.4 48.6 14.6 50.2 C13 47.4 12.4 44.6 13.4 41.8 Z', `fill="${P.shade}" opacity="0.45"`);
  let marks = '';
  if (def.markings === 'tabby') {
    marks =
      `<g stroke="${P.shade}" stroke-width="2.1" stroke-linecap="round" fill="none">
        <path d="M32 20.8 V25.6"/><path d="M27.2 21.6 Q28 24 28.8 25.2"/><path d="M36.8 21.6 Q36 24 35.2 25.2"/>
      </g>` + pair('M10.8 37.4 L15.4 37.4 M11 41 L14.8 41', `stroke="${P.shade}" stroke-width="1.8" stroke-linecap="round" fill="none"`);
  }
  let muzzle: string;
  if (def.markings === 'mask') {
    muzzle = `<path d="M32 36.6 C36.6 36.6 41.4 40.2 41.4 45.4 C41.4 50.6 37 53.2 32 53.2 C27 53.2 22.6 50.6 22.6 45.4 C22.6 40.2 27.4 36.6 32 36.6 Z" fill="${P.muzzle}"/>`;
  } else {
    muzzle = `<ellipse cx="32" cy="46.2" rx="9.4" ry="6.6" fill="${P.muzzle}"/>`;
  }
  const nose = `<path d="M29.5 41.6 Q32 40.4 34.5 41.6 Q33.7 43.7 32 44.2 Q30.3 43.7 29.5 41.6 Z" fill="${P.nose}"/>`;
  const whiskers = pair('M8.4 42.6 L17 43.8 M8.9 47.2 L17.2 46.3', `stroke="${P.whisker}" stroke-width="1.1" stroke-linecap="round" opacity="0.75" fill="none"`);
  return head + fluff + marks + muzzle + nose + whiskers;
}

function dogEarsBehind(def: PetDefinition): string {
  const P = def.palette;
  const stroke = `stroke="${OUTLINE}" stroke-width="1.4" stroke-linejoin="round"`;
  if (def.ears === 'folded') {
    return (
      pair('M14.6 27.4 C12.6 19.4 13.6 11.6 17.4 9.2 C20.8 7.2 25 11.8 28 18.8 Z', `fill="${P.ear}" ${stroke}`) +
      pair('M17.4 9.4 C21.2 8.2 25.4 12.4 27.4 18.4 C23.8 15.4 19.8 14.4 15.8 15 C15.8 12.6 16.4 10.6 17.4 9.4 Z', `fill="${P.shade}"`)
    );
  }
  return '';
}

function dogEarsFront(def: PetDefinition): string {
  const P = def.palette;
  const stroke = `stroke="${OUTLINE}" stroke-width="1.4" stroke-linejoin="round"`;
  if (def.ears === 'floppy') {
    return (
      pair('M18 20.6 C10.6 20 5.6 26.8 6 36.6 C6.4 44.2 9.6 50 13.8 49 C17.4 48 17.8 41 18.8 34 C19.6 28.4 21.6 22.6 18 20.6 Z', `fill="${P.ear}" ${stroke}`) +
      pair('M15.6 25.6 C11.6 27.6 10.2 33.4 10.8 39.6 C11.2 43 12.4 45.2 13.6 45 C15 41.6 15.8 36.8 16.6 31.6 Z', `fill="${P.innerEar}" opacity="0.7"`)
    );
  }
  if (def.ears === 'button') {
    return pair('M14.2 21 C16.8 15.4 23.2 14.8 26 19.4 C22.2 20.6 19.2 23.8 17.6 28 C15.4 26.4 13.6 23.8 14.2 21 Z', `fill="${P.ear}" ${stroke}`);
  }
  return '';
}

function dogHead(def: PetDefinition): string {
  const P = def.palette;
  const head = `<path d="M32 16.8 C44.2 16.8 52.2 25 52.8 35.6 C53.4 45.4 46.2 54.8 32 54.8 C17.8 54.8 10.6 45.4 11.2 35.6 C11.8 25 19.8 16.8 32 16.8 Z" fill="${P.fur}" stroke="${OUTLINE}" stroke-width="1.4"/>`;
  let marks = '';
  if (def.markings === 'patch') marks = `<ellipse cx="23.5" cy="32.4" rx="6.8" ry="6.4" fill="${P.ear}"/>`;
  if (def.markings === 'blaze')
    marks = `<path d="M32 17.2 C33.8 17.2 34.4 22 34.5 26.4 C34.6 30.8 36.2 34.6 38.2 37.6 L25.8 37.6 C27.8 34.6 29.4 30.8 29.5 26.4 C29.6 22 30.2 17.2 32 17.2 Z" fill="${P.muzzle}"/>`;
  const muzzle = `<ellipse cx="32" cy="44.2" rx="11.6" ry="8.8" fill="${P.muzzle}"/>`;
  const nose = `<path d="M27.4 39.4 C27.4 37.4 36.6 37.4 36.6 39.4 C36.6 41.6 33.9 43.1 32 43.1 C30.1 43.1 27.4 41.6 27.4 39.4 Z" fill="${P.nose}"/><ellipse cx="30.4" cy="38.8" rx="1.3" ry="0.62" fill="#fff" opacity="0.45"/>`;
  const pores = `<g fill="${P.whisker}" opacity="0.55"><circle cx="26.2" cy="44.6" r="0.6"/><circle cx="24.9" cy="46.8" r="0.6"/><circle cx="37.8" cy="44.6" r="0.6"/><circle cx="39.1" cy="46.8" r="0.6"/></g>`;
  return head + marks + muzzle + nose + pores;
}

function eyeOpen(def: PetDefinition, e: EyeGeo, sparkle: boolean): string {
  const P = def.palette;
  const iris = P.iris
    ? `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${P.iris}"/><ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx * 0.42}" ry="${e.ry * 0.78}" fill="${P.eye}"/>`
    : `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${P.eye}"/>`;
  const hx = e.cx + e.rx * 0.32;
  const hy = e.cy - e.ry * 0.36;
  const shine = sparkle
    ? `<path d="M${hx} ${hy - 1.9} Q${hx + 0.35} ${hy - 0.35} ${hx + 1.9} ${hy} Q${hx + 0.35} ${hy + 0.35} ${hx} ${hy + 1.9} Q${hx - 0.35} ${hy + 0.35} ${hx - 1.9} ${hy} Q${hx - 0.35} ${hy - 0.35} ${hx} ${hy - 1.9} Z" fill="#fff"/>`
    : `<circle cx="${hx}" cy="${hy}" r="1.3" fill="#fff"/>`;
  const low = `<circle cx="${e.cx - e.rx * 0.34}" cy="${e.cy + e.ry * 0.42}" r="0.62" fill="#fff" opacity="0.8"/>`;
  return `<g class="pf-eye-open"><g class="pf-look">${iris}${shine}${low}</g></g>`;
}

function eyeClosed(def: PetDefinition, e: EyeGeo): string {
  const y = e.cy + 0.9;
  return `<path class="pf-eye-closed" d="M${e.cx - e.rx - 0.4} ${y} Q${e.cx} ${y - e.ry - 0.6} ${e.cx + e.rx + 0.4} ${y}" stroke="${def.palette.eye}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
}

function lid(def: PetDefinition, e: EyeGeo, color: string): string {
  const rx = e.rx + 1.5;
  const ry = e.ry + 1.2;
  return `<g class="pf-lid"><ellipse cx="${e.cx}" cy="${e.cy}" rx="${rx}" ry="${ry}" fill="${color}"/><path d="M${e.cx - rx + 0.3} ${e.cy + 0.4} A${rx - 0.3} ${ry} 0 0 0 ${e.cx + rx - 0.3} ${e.cy + 0.4}" stroke="${def.palette.eye}" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>`;
}

function brows(def: PetDefinition, [l, r]: [EyeGeo, EyeGeo]): string {
  const y = l.cy - l.ry - 3.4;
  const w = def.species === 'dog' ? 2.6 : 2;
  const a = `stroke="${def.palette.brow}" stroke-width="${w}" stroke-linecap="round" fill="none"`;
  const curve = (e: EyeGeo, side: -1 | 1) =>
    `M${e.cx - 3.1} ${y + (side < 0 ? 0.5 : 0.1)} Q${e.cx} ${y - 1.9} ${e.cx + 3.1} ${y + (side < 0 ? 0.1 : 0.5)}`;
  return `<path class="pf-brow pf-brow--l" d="${curve(l, -1)}" ${a}/><path class="pf-brow pf-brow--r" d="${curve(r, 1)}" ${a}/>`;
}

function mouths(def: PetDefinition): string {
  const ink = def.palette.eye;
  const line = `stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  if (def.species === 'cat') {
    const stem = 'M32 44.2 V45.8';
    return [
      `<path class="pf-m pf-m--idle" d="${stem} M27.8 45.6 Q29.9 48.4 32 45.8 Q34.1 48.4 36.2 45.6" ${line}/>`,
      `<path class="pf-m pf-m--smile" d="${stem} M26.6 45 Q29.3 50.2 32 46 Q34.7 50.2 37.4 45" ${line}/>`,
      `<g class="pf-m pf-m--grin"><path d="M26.8 45.6 Q32 53.6 37.2 45.6 Q32 48 26.8 45.6 Z" fill="${ink}"/><path d="M29.4 49.4 Q32 52.4 34.6 49.4 Q32 48.4 29.4 49.4 Z" fill="${TONGUE}"/><path d="${stem}" ${line}/></g>`,
      `<g class="pf-m pf-m--o"><path d="${stem}" ${line}/><ellipse cx="32" cy="48" rx="1.8" ry="2.2" fill="${ink}"/></g>`,
      `<path class="pf-m pf-m--flat" d="${stem} M29.2 46.8 H34.8" ${line}/>`,
    ].join('');
  }
  const stem = 'M32 43 V45.2';
  return [
    `<path class="pf-m pf-m--idle" d="${stem} M27.2 45.4 Q29.6 48 32 45.2 Q34.4 48 36.8 45.4" ${line}/>`,
    `<path class="pf-m pf-m--smile" d="${stem} M25.6 44.6 Q28.8 50 32 45.4 Q35.2 50 38.4 44.6" ${line}/>`,
    `<g class="pf-m pf-m--grin"><path d="M25.6 45 Q32 55.4 38.4 45 Q32 47.8 25.6 45 Z" fill="${ink}"/><path d="M29 49.6 Q32 57 35 49.6 Q32 48.2 29 49.6 Z" fill="${TONGUE}"/><path d="M32 50.2 V53.4" stroke="#C9616B" stroke-width="0.9" stroke-linecap="round"/><path d="${stem}" ${line}/></g>`,
    `<g class="pf-m pf-m--o"><path d="${stem}" ${line}/><ellipse cx="32" cy="47.6" rx="2" ry="2.4" fill="${ink}"/></g>`,
    `<path class="pf-m pf-m--flat" d="${stem} M28.6 46.6 Q32 47.6 35.4 46.6" ${line}/>`,
  ].join('');
}

function cheeks(def: PetDefinition): string {
  const y = def.species === 'cat' ? 43.4 : 41.8;
  const x = def.species === 'cat' ? 16.4 : 18.2;
  return `<g data-layer="cheeks"><ellipse class="pf-cheek" cx="${x}" cy="${y}" rx="3.7" ry="2.3" fill="${def.palette.cheek}"/><ellipse class="pf-cheek" cx="${64 - x}" cy="${y}" rx="3.7" ry="2.3" fill="${def.palette.cheek}"/></g>`;
}

const bodyCache = new Map<PetId, string>();

/** The rig's inner markup (cached per pet). */
function rigBody(id: PetId): string {
  const hit = bodyCache.get(id);
  if (hit) return hit;
  const def = PET_BY_ID[id];
  const eyes = eyesOf(def);
  const sparkle = id === 'pip';
  const head =
    def.species === 'cat' ? catEars(def) + catHead(def) : dogEarsBehind(def) + dogHead(def) + dogEarsFront(def);
  const lidLeft = def.markings === 'patch' ? def.palette.ear : def.palette.fur;
  const body =
    `<g data-layer="head-static">${head}</g>` +
    cheeks(def) +
    `<g data-layer="eyes"><g class="pf-eye pf-eye--l" data-eye="left">${eyeOpen(def, eyes[0], sparkle)}${eyeClosed(def, eyes[0])}</g><g class="pf-eye pf-eye--r" data-eye="right">${eyeOpen(def, eyes[1], sparkle)}${eyeClosed(def, eyes[1])}</g></g>` +
    `<g data-layer="lids">${lid(def, eyes[0], lidLeft)}${lid(def, eyes[1], def.palette.fur)}</g>` +
    `<g data-layer="brows">${brows(def, eyes)}</g>` +
    `<g data-layer="mouth">${mouths(def)}</g>`;
  bodyCache.set(id, body);
  return body;
}

export interface PetSvgOptions {
  mood?: FaceMood;
  /** Accessible name. Omit for decorative art (aria-hidden). */
  label?: string;
  className?: string;
}

/** Full SVG markup for a pet in a given (static) mood. */
export function petSvg(id: PetId, o: PetSvgOptions = {}): string {
  const def = PET_BY_ID[id];
  const mood = o.mood ?? 'idle';
  const p = poseFor(id, mood);
  const a11y = o.label ? `role="img" aria-label="${o.label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="pet pet--${def.species}${o.className ? ` ${o.className}` : ''}" data-pet="${id}" data-mood="${mood}" data-eyes="${p.eyes}" data-mouth="${p.mouth}" style="${poseStyle(p)}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" ${a11y}>${rigBody(id)}</svg>`;
}

/** Builds a live rig element (for board tiles that animate). */
export function petElement(id: PetId, mood: FaceMood = 'idle'): { el: HTMLElement; svg: SVGSVGElement } {
  const span = document.createElement('span');
  span.innerHTML = petSvg(id, { mood });
  return { el: span, svg: span.firstElementChild as SVGSVGElement };
}

export function speciesKey(s: Species): 'cat' | 'dog' {
  return s === CAT ? 'cat' : 'dog';
}

/** The founding pet's art, used where a generic cat or dog is shown (tool buttons, rules diagrams). */
export function foundingSvg(s: Species, mood: FaceMood = 'idle'): string {
  return petSvg(FOUNDING[speciesKey(s)], { mood });
}
