/**
 * Decoration activities (D32): every special (video-token) and premium (gem) decoration has something an animal can
 * do with it — ride the hot-air balloon, fly the kite, splash in the golden fountain, nap in the hammock. An activity
 * puts a copy of one animal from the scene into (or onto) the decoration, plays one short scene (≤ 6.5 s, never a loop)
 * and puts the animal back. The motion itself lives in styles/sanctuary-play.css.
 *
 * Coordinates are scene units (the 360×300 sanctuary frame). A rider either sits inside a part of the decoration that
 * moves (`seat`: the balloon's basket, the hammock) or is drawn on top of the scene (`spot`).
 */

import type { DecorId } from '../../meta/catalogs/decor';
import { isCompanionId } from '../../meta/catalogs/companions';
import { isPetId } from '../../meta/catalogs/pets';
import { companionFigure, type CompanionMood } from './companions';
import { residentFigure } from './sanctuary';

export interface ActivityDef {
  decor: DecorId;
  /** What it's called on the decoration's card ("Balloon rides"). */
  name: string;
  /** The caption while it plays. */
  line: (who: string) => string;
  ms: number;
  /** Rider: ground contact and size. */
  x: number;
  y: number;
  H: number;
  mood: CompanionMood;
  /** Put the rider inside this part of the decoration (it moves with it); otherwise on top of the scene. */
  seat?: string;
  /** Props and particles drawn with the rider. */
  extras?: string;
}

const star = (x: number, y: number, r: number, c = '#fff7c2') =>
  `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="${c}"/>`;

const note = (x: number, y: number, c = '#8a6a4f') =>
  `<g fill="${c}"><ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.6" transform="rotate(-20 ${x} ${y})"/><rect x="${x + 1.6}" y="${y - 8}" width="0.9" height="8"/><path d="M${x + 2.5} ${y - 8} q3 1 3 4" stroke="${c}" stroke-width="0.9" fill="none"/></g>`;

export const ACTIVITIES: Record<string, ActivityDef> = {
  // Meadow Farm
  tireswing: {
    decor: 'tireswing',
    name: 'Tire swinging',
    line: (who) => `${who} is swinging on the tire swing!`,
    ms: 5600,
    x: 68,
    y: 182,
    H: 16,
    mood: 'happy',
    seat: '.sp-swing',
  },
  tractor: {
    decor: 'tractor',
    name: 'Tractor rides',
    line: (who) => `${who} is driving the little red tractor!`,
    ms: 6200,
    x: 224,
    y: 252,
    H: 16,
    mood: 'happy',
    seat: '.sp-tractor',
    extras: `<g class="sp-act-puffs" fill="#e8e4dc" opacity="0">${[0, 1, 2].map((i) => `<circle cx="${252 + i * 3}" cy="${244 - i * 6}" r="${2.4 + i}"/>`).join('')}</g>`,
  },
  balloon: {
    decor: 'balloon',
    name: 'Balloon rides',
    line: (who) => `${who} is riding the hot-air balloon!`,
    ms: 6200,
    x: 151,
    y: 80,
    H: 15,
    mood: 'happy',
    seat: '.sp-balloon .sp-seat',
  },
  kite: {
    decor: 'kite',
    name: 'Kite flying',
    line: (who) => `${who} is flying the rainbow kite.`,
    ms: 5600,
    x: 112,
    y: 198,
    H: 30,
    mood: 'happy',
    extras: `<path class="sp-act-string" d="M118 186 C106 140 76 92 50 42" stroke="#8a6a4f" stroke-width="0.8" fill="none" stroke-dasharray="2 1.5"/>`,
  },
  goldfountain: {
    decor: 'goldfountain',
    name: 'Splashing',
    line: (who) => `${who} is splashing in the golden fountain!`,
    ms: 4800,
    x: 149,
    y: 170,
    H: 24,
    mood: 'happy',
    extras: `<g class="sp-act-drops" fill="#bfe3ea">${[
      [136, 152],
      [162, 150],
      [130, 160],
      [168, 158],
      [142, 146],
      [156, 144],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8"/>`)
      .join('')}</g>`,
  },
  eavelights: {
    decor: 'eavelights',
    name: 'Rooftop dances',
    line: (who) => `${who} is dancing under the string lights.`,
    ms: 5200,
    x: 250,
    y: 66,
    H: 18,
    mood: 'happy',
    extras: `<g class="sp-act-notes">${note(236, 52)}${note(264, 46, '#c96f8a')}${note(256, 58, '#287b70')}</g>`,
  },
  hammock: {
    decor: 'hammock',
    name: 'Hammock naps',
    line: (who) => `${who} is napping in the hammock.`,
    ms: 6000,
    x: 121,
    y: 191,
    H: 18,
    mood: 'sleepy',
    seat: '.sp-sway',
    extras: `<g class="sp-act-z" fill="#5b6b8a" font-family="var(--font-display), sans-serif" font-weight="700"><text x="130" y="168" font-size="7">z</text><text x="135" y="161" font-size="9">z</text><text x="141" y="152" font-size="11">Z</text></g>`,
  },
  opalrock: {
    decor: 'opalrock',
    name: 'Treasure hunts',
    line: (who) => `${who} found the opal shining!`,
    ms: 4600,
    x: 305,
    y: 258,
    H: 22,
    mood: 'happy',
    extras: `<g class="sp-act-sparkles">${star(288, 240, 4)}${star(322, 236, 5, '#f4a6d0')}${star(330, 252, 3.4, '#9fe0e6')}${star(282, 256, 3, '#b8f0b0')}</g>`,
  },
  flamingos: {
    decor: 'flamingos',
    name: 'Flamingo dances',
    line: (who) => `${who} is dancing with the flamingos!`,
    ms: 5400,
    x: 44,
    y: 281,
    H: 22,
    mood: 'happy',
    extras: `<g class="sp-act-ripples" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.9"><ellipse cx="44" cy="282" rx="10" ry="2.6"/><ellipse cx="44" cy="282" rx="18" ry="4.4"/></g>`,
  },
  pavilion: {
    decor: 'pavilion',
    name: 'Tea time',
    line: (who) => `${who} is having tea under the pavilion.`,
    ms: 5600,
    x: 210,
    y: 211,
    H: 22,
    mood: 'happy',
    extras: `<g class="sp-act-tea"><path d="M226 205 h9 v4 a4.5 4.5 0 0 1 -9 0 z" fill="#fbf6ec" stroke="#c9a46e" stroke-width="0.8"/><path d="M235 206 a2 2 0 0 1 0 4" stroke="#c9a46e" stroke-width="0.8" fill="none"/><ellipse cx="230.5" cy="214" rx="7" ry="1.6" fill="#e9d6b4"/>
      <g class="sp-act-steam" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.85"><path d="M228 202 q-2 -3 0 -6"/><path d="M232 202 q2 -3 0 -6"/></g></g>`,
  },
  icelanterns: {
    decor: 'icelanterns',
    name: 'Lantern parades',
    line: (who) => `${who} is leading a lantern parade.`,
    ms: 6000,
    x: 226,
    y: 292,
    H: 22,
    mood: 'happy',
    extras: '',
  },
  aurora: {
    decor: 'aurora',
    name: 'Aurora watching',
    line: (who) => `${who} is watching the northern lights.`,
    ms: 6000,
    x: 214,
    y: 212,
    H: 26,
    mood: 'happy',
    extras: `<g class="sp-act-stars">${star(60, 30, 3)}${star(130, 18, 2.4)}${star(200, 34, 3.2)}${star(280, 16, 2.6)}${star(330, 40, 3)}</g>`,
  },
  fireflyjars: {
    decor: 'fireflyjars',
    name: 'Firefly lights',
    line: (who) => `${who} let the fireflies out to play.`,
    ms: 5600,
    x: 98,
    y: 292,
    H: 22,
    mood: 'happy',
    extras: `<g class="sp-act-flies">${[0, 1, 2, 3, 4, 5].map((i) => `<g class="sp-act-fly sp-act-fly--${i}"><circle cx="${58 + i * 6}" cy="${276 - (i % 3) * 5}" r="3.4" fill="#fff3b0" opacity="0.35"/><circle cx="${58 + i * 6}" cy="${276 - (i % 3) * 5}" r="1.4" fill="#fff8d6"/></g>`).join('')}</g>`,
  },
  waterfall: {
    decor: 'waterfall',
    name: 'Waterfall slides',
    line: (who) => `${who} is sliding down the waterfall!`,
    ms: 4800,
    x: 326,
    y: 154,
    H: 18,
    mood: 'happy',
    extras: `<g class="sp-act-splash" fill="none" stroke="#fff" stroke-width="1.4" opacity="0"><ellipse cx="331" cy="230" rx="10" ry="2.6"/><ellipse cx="331" cy="230" rx="17" ry="4.2"/></g>`,
  },
};

export function activityFor(decor: string): ActivityDef | null {
  return ACTIVITIES[decor] ?? null;
}

/**
 * A copy of an animal for an activity: the same drawing as in the scene, but not a scene figure (no taps, no ambient
 * life, no duplicate ids for the screen's queries).
 */
export function riderFigure(id: string, x: number, y: number, H: number, mood: CompanionMood): string {
  let svg = '';
  if (isPetId(id)) svg = residentFigure(id, x, y, H, mood === 'sleepy' ? 'sleepy' : 'happy');
  else if (isCompanionId(id)) svg = companionFigure(id, x, y, H, mood);
  return svg
    .replace(/class="sanctuary__pet( sanctuary__friend)?"/, 'class="sp-rider-fig"')
    .replace(/ data-(pet|friend)="/g, ' data-rider="')
    .replace(/ data-g([xyh])="/g, ' data-r$1="')
    .replace(/<path class="sp-heart"[^>]*\/>/g, '');
}

/** The rider and its props, ready to insert. */
export function activityMarkup(def: ActivityDef, riderId: string): string {
  return `<g class="sp-act" data-activity="${def.decor}" aria-hidden="true"><g class="sp-act-rider">${riderFigure(riderId, def.x, def.y, def.H, def.mood)}</g>${def.extras ?? ''}</g>`;
}
