/**
 * The regional sanctuaries of the world map (original art, drawn in code), in the same 360×300 storybook frame as
 * Harmony. Each scene is: sky (and any sky decoration) → land → the stage features the sanctuary has grown into →
 * owned decorations and the region's animals, painted back to front by their ground line.
 *
 * Stage features are grouped as `.sp-stage[data-stage]` so the screen can pop in the one just reached. Lively parts use
 * the same ambient class names as Harmony (`.sp-water`, `.sp-glow`, `.sp-fireflies`) plus `.sp-blades`, `.sp-aurora`,
 * `.sp-birds`, `.sp-sway`, played only by `AmbientDirector` (D24); nothing here loops on its own.
 */

import type { CompanionId } from '../../meta/catalogs/companions';
import { COMPANIONS } from '../../meta/catalogs/companions';
import { DECOR_BY_ID, decorHome, type DecorId } from '../../meta/catalogs/decor';
import { SANCTUARY_BY_ID, type RegionId } from '../../meta/catalogs/sanctuaries';
import { companionFigure, figureTop, type CompanionMood } from './companions';
import { OUT, SHADOW, dusk, heartAbove, type DecorArt } from './sceneKit';

export type RegionDecorId = Extract<
  DecorId,
  'campfire' | 'windmill' | 'hammock' | 'opalrock' | 'baobab' | 'weaver' | 'flamingos' | 'pavilion' | 'igloo' | 'snowman' | 'icelanterns' | 'aurora' | 'ropebridge' | 'orchids' | 'fireflyjars' | 'waterfall'
>;

const paw = (x: number, y: number, c: string) =>
  `<g fill="${c}"><ellipse cx="${x}" cy="${y + 0.7}" rx="2.4" ry="1.7"/><circle cx="${x - 2.3}" cy="${y - 1.3}" r="0.85"/><circle cx="${x}" cy="${y - 2.1}" r="0.85"/><circle cx="${x + 2.3}" cy="${y - 1.3}" r="0.85"/></g>`;

const sparkle = (x: number, y: number, r = 3, c = '#fff') =>
  `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="${c}"/>`;

/** The sanctuary's welcome sign (wild land too: it marks where the sanctuary will grow). */
function sign(x: number, y: number, accent: string): string {
  return `<g data-sign="1"><ellipse cx="${x}" cy="${y + 0.5}" rx="7" ry="1.8" fill="${SHADOW}"/><path d="M${x} ${y} v-18" stroke="#8a6a4f" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="${x - 12}" y="${y - 27}" width="24" height="13" rx="3" fill="#f6e8cc" stroke="${OUT}" stroke-width="1"/>${paw(x, y - 20, accent)}</g>`;
}

// ------------------------------------------------------------------ regional decorations

export const REGION_DECOR_ART: Record<RegionDecorId, DecorArt> = {
  // Outback
  campfire: {
    base: 248,
    box: [146, 214, 42, 38],
    draw: () => `
      <ellipse cx="166" cy="248" rx="19" ry="4" fill="${SHADOW}"/>
      <circle class="sp-glow" cx="166" cy="232" r="16" fill="#ffd27a" opacity="0.32"/>
      <g fill="#b9a79a" stroke="${OUT}" stroke-width="0.8"><ellipse cx="150" cy="245" rx="4" ry="2.6"/><ellipse cx="158" cy="248" rx="4" ry="2.6"/><ellipse cx="167" cy="249" rx="4.2" ry="2.6"/><ellipse cx="176" cy="247.5" rx="4" ry="2.6"/><ellipse cx="182" cy="244" rx="3.6" ry="2.4"/></g>
      <path d="M154 242 L178 236 M154 236 L178 242" stroke="#8a5a3a" stroke-width="4" stroke-linecap="round"/>
      <path d="M166 216 C172 224 174 230 170 237 C168 239 164 239 162 237 C158 230 160 224 166 216 Z" fill="#f59a3c"/>
      <path d="M166 225 C169 229 170 232 168 235 C167 236 165 236 164 235 C162 232 163 229 166 225 Z" fill="#ffd36e"/>`,
  },
  windmill: {
    base: 166,
    box: [308, 58, 52, 110],
    draw: () => `
      <ellipse cx="332" cy="166" rx="16" ry="3" fill="${SHADOW}"/>
      <g stroke="#8b8f94" stroke-width="2" stroke-linecap="round"><path d="M321 166 L329 92 M343 166 L335 92"/></g>
      <g stroke="#a3a8ad" stroke-width="1"><path d="M322 156 L341 144 M342 156 L323 144 M324 136 L339 124 M340 136 L325 124 M326 116 L337 104 M338 116 L327 104"/></g>
      <path d="M334 88 L356 84 L356 94 L334 92 Z" fill="#d9dde0" stroke="${OUT}" stroke-width="0.9"/>
      <g class="sp-blades">${Array.from({ length: 8 }, (_, k) => `<rect x="330" y="68" width="4.4" height="19" rx="1.4" fill="#eef0f2" stroke="${OUT}" stroke-width="0.8" transform="rotate(${k * 45} 332 88)"/>`).join('')}<circle cx="332" cy="88" r="3.2" fill="#8b8f94"/></g>`,
  },
  hammock: {
    base: 206,
    box: [86, 160, 70, 50],
    draw: () => `
      <ellipse cx="121" cy="206" rx="32" ry="3.4" fill="${SHADOW}"/>
      <path d="M92 206 V166 M150 206 V166" stroke="#8a6a4f" stroke-width="3.6" stroke-linecap="round"/>
      <g class="sp-sway">
        <path d="M92 170 L101 182 M150 170 L141 182" stroke="#8a6a4f" stroke-width="1"/>
        <path d="M101 182 C111 197 131 197 141 182 C131 190 111 190 101 182 Z" fill="#f2b2c2" stroke="${OUT}" stroke-width="1"/>
        <path d="M106 187 C114 194 128 194 136 187" stroke="#9fd3c7" stroke-width="2" fill="none"/>
        <path d="M103 184 C112 191 130 191 139 184" stroke="#f6d27a" stroke-width="1.3" fill="none"/>
      </g>`,
  },
  opalrock: {
    base: 282,
    box: [278, 248, 56, 38],
    draw: () => `
      <ellipse cx="305" cy="282" rx="26" ry="4" fill="${SHADOW}"/>
      <path d="M282 282 C280 266 292 255 306 256 C320 256 331 266 329 282 Z" fill="#b48a6e" stroke="${OUT}" stroke-width="1"/>
      <path d="M288 270 C296 262 312 262 322 270 C312 275 298 276 288 270 Z" fill="#9fe0e6"/>
      <path d="M294 268 C300 265 306 265 310 268 C305 271 298 271 294 268 Z" fill="#f4a6d0"/>
      <path d="M308 268 C312 266 316 266 319 269 C315 271 311 271 308 268 Z" fill="#b8f0b0"/>
      <g class="sp-glow" opacity="0.9">${sparkle(300, 262, 3)}${sparkle(318, 266, 2.4)}${sparkle(292, 274, 2)}</g>`,
  },
  // Savanna
  baobab: {
    base: 160,
    box: [124, 70, 64, 94],
    draw: () => `
      <ellipse cx="156" cy="160" rx="24" ry="4.4" fill="${SHADOW}"/>
      <path d="M142 160 C138 140 140 122 146 104 L166 104 C172 122 174 140 170 160 Z" fill="#b69477" stroke="${OUT}" stroke-width="1"/>
      <path d="M150 156 C148 140 150 124 153 110 M162 156 C164 140 162 124 160 110" stroke="#9e7d62" stroke-width="1" fill="none"/>
      <g stroke="#a3846a" stroke-width="3.4" stroke-linecap="round" fill="none"><path d="M148 104 C144 96 136 90 130 88"/><path d="M155 104 V82"/><path d="M162 104 C168 96 176 92 182 90"/><path d="M151 98 C150 90 146 84 142 80"/></g>
      <g fill="#9cb76f"><circle cx="130" cy="86" r="6"/><circle cx="142" cy="78" r="5.4"/><circle cx="155" cy="78" r="6.4"/><circle cx="170" cy="82" r="5"/><circle cx="183" cy="88" r="5.6"/></g>`,
  },
  weaver: {
    base: 176,
    box: [82, 122, 54, 58],
    draw: () => `
      <ellipse cx="108" cy="176" rx="14" ry="2.8" fill="${SHADOW}"/>
      <path d="M108 176 C108 160 107 148 108 138" stroke="#8a6a4f" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M108 146 C102 140 96 138 92 136 M108 142 C114 137 120 135 126 134" stroke="#8a6a4f" stroke-width="1.8" stroke-linecap="round"/>
      <ellipse cx="108" cy="132" rx="24" ry="7" fill="#9cb76f"/><ellipse cx="104" cy="129" rx="16" ry="4.6" fill="#b0c984"/>
      <g stroke="#8a6a4f" stroke-width="0.8"><path d="M94 137 v5"/><path d="M110 138 v7"/><path d="M122 137 v4"/></g>
      <g fill="#d9b76a" stroke="#b8944a" stroke-width="0.8"><ellipse cx="94" cy="146" rx="4" ry="5"/><ellipse cx="110" cy="149" rx="4.4" ry="5.4"/><ellipse cx="122" cy="145" rx="3.6" ry="4.4"/></g>
      <g fill="#7a5a36"><circle cx="94" cy="149" r="1.1"/><circle cx="110" cy="152.5" r="1.2"/><circle cx="122" cy="147.5" r="1"/></g>`,
  },
  flamingos: {
    base: 282,
    box: [8, 212, 74, 76],
    draw: () => {
      const bird = (x: number, flip: number) => `
        <path d="M${x} 278 V256" stroke="#e98a9a" stroke-width="1.4"/><path d="M${x + 3 * flip} 262 l${-4 * flip} 6 l${4 * flip} 3" stroke="#e98a9a" stroke-width="1.3" fill="none"/>
        <ellipse cx="${x + 2 * flip}" cy="250" rx="10" ry="6.6" fill="#f4a3b4" stroke="${OUT}" stroke-width="0.9"/>
        <path d="M${x - 4 * flip} 247 C${x - 6 * flip} 238 ${x + 4 * flip} 236 ${x + 2 * flip} 228 C${x} 222 ${x - 6 * flip} 222 ${x - 6 * flip} 226" stroke="#f4a3b4" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <circle cx="${x - 5 * flip}" cy="225" r="3" fill="#f4a3b4"/><path d="M${x - 8 * flip} 225 l${-4 * flip} 2.4 l${2 * flip} 1.6 z" fill="#2f2a27"/><circle cx="${x - 5 * flip}" cy="224" r="0.8" fill="#2f2a27"/>`;
      return `
        <ellipse cx="44" cy="278" rx="35" ry="8" fill="#a7d3cf" stroke="#c9a46e" stroke-width="1.6"/>
        <g class="sp-water" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.8"><path d="M22 278 q5 1.4 9 0"/><path d="M52 282 q5 1.4 9 0"/></g>
        <g class="sp-flam-a">${bird(32, 1)}</g><g class="sp-flam-b">${bird(56, -1)}</g>`;
    },
  },
  pavilion: {
    base: 214,
    box: [184, 144, 72, 74],
    draw: () => `
      <ellipse cx="220" cy="214" rx="34" ry="4.6" fill="${SHADOW}"/>
      <ellipse cx="220" cy="210" rx="26" ry="5" fill="#e58a7d" opacity="0.8"/><ellipse cx="220" cy="210" rx="18" ry="3.2" fill="#f6dcae"/>
      <path d="M194 212 V172 M246 212 V172" stroke="#8a6a4f" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M188 174 L220 148 L252 174 Z" fill="#f6ead2" stroke="${OUT}" stroke-width="1"/>
      <path d="M220 148 L210 174 M220 148 L230 174" stroke="#e7c9a0" stroke-width="1.4"/>
      <path d="M188 174 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0" fill="#e58a7d" stroke="${OUT}" stroke-width="0.6"/>
      <path d="M220 174 V182" stroke="#5b4a3a" stroke-width="0.8"/>
      <circle class="sp-glow" cx="220" cy="188" r="10" fill="#ffe1a0" opacity="0.4"/>
      <rect x="216" y="182" width="8" height="11" rx="3" fill="#ffd27a" stroke="#c9963c" stroke-width="0.8"/>`,
  },
  // Arctic
  igloo: {
    base: 180,
    box: [130, 140, 76, 44],
    draw: () => `
      <ellipse cx="168" cy="180" rx="38" ry="4.6" fill="${SHADOW}"/>
      <path d="M134 180 C134 146 202 146 202 180 Z" fill="#f7fbfe" stroke="#b9cde0" stroke-width="1.2"/>
      <g stroke="#cfdcea" stroke-width="1" fill="none"><path d="M136 170 H200"/><path d="M140 160 H196"/><path d="M150 152 H186"/><path d="M152 170 V180 M168 170 V180 M184 170 V180 M146 160 V170 M160 160 V170 M176 160 V170 M190 160 V170 M158 152 V160 M178 152 V160"/></g>
      <path d="M156 180 C156 165 180 165 180 180 Z" fill="#eaf2f9" stroke="#b9cde0" stroke-width="1"/>
      <path d="M161 180 C161 171 175 171 175 180 Z" fill="#5f7f9c"/>`,
  },
  snowman: {
    base: 272,
    box: [312, 206, 46, 70],
    draw: () => `
      <ellipse cx="335" cy="272" rx="16" ry="3.4" fill="${SHADOW}"/>
      <circle cx="335" cy="258" r="14" fill="#fbfdff" stroke="#c3d4e4" stroke-width="1"/>
      <path d="M326 236 L314 228 M344 236 L356 228" stroke="#8a6a4f" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="335" cy="238" r="10" fill="#fbfdff" stroke="#c3d4e4" stroke-width="1"/>
      <circle cx="335" cy="221" r="8" fill="#fbfdff" stroke="#c3d4e4" stroke-width="1"/>
      <path d="M327 229 C331 232 339 232 343 229 L343 233 C339 236 331 236 327 233 Z" fill="#e8707a"/><path d="M339 232 l2 9 l4 -1 l-2 -8z" fill="#e8707a"/>
      <circle cx="332" cy="219.5" r="1.1" fill="#2f2a27"/><circle cx="338" cy="219.5" r="1.1" fill="#2f2a27"/>
      <path d="M335 222 l6 1.4 l-6 1.2 z" fill="#f19a3e"/>
      <g fill="#2f2a27"><circle cx="335" cy="240" r="1"/><circle cx="335" cy="245" r="1"/></g>`,
  },
  icelanterns: {
    base: 296,
    box: [222, 270, 88, 28],
    draw: () =>
      [238, 266, 294]
        .map(
          (x, i) => `
        <ellipse cx="${x}" cy="${295 - (i % 2) * 2}" rx="9" ry="2" fill="${SHADOW}"/>
        <circle class="sp-glow" cx="${x}" cy="${284 - (i % 2) * 2}" r="11" fill="#ffd78a" opacity="0.3"/>
        <rect x="${x - 7}" y="${274 - (i % 2) * 2}" width="14" height="20" rx="3" fill="#e2f2fb" stroke="#b3cfe2" stroke-width="1" opacity="0.95"/>
        <ellipse cx="${x}" cy="${287 - (i % 2) * 2}" rx="3" ry="4" fill="#ffd27a"/><rect x="${x - 1.4}" y="${287 - (i % 2) * 2}" width="2.8" height="5" fill="#fff4dc"/>`,
        )
        .join(''),
  },
  aurora: {
    base: -10,
    box: [100, 4, 120, 70],
    draw: () => `
      <defs><linearGradient id="aurora-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be3c0" stop-opacity="0"/><stop offset="0.5" stop-color="#8fe0b6" stop-opacity="0.7"/><stop offset="1" stop-color="#b8a6f0" stop-opacity="0.1"/></linearGradient></defs>
      <g class="sp-aurora" opacity="0.75">
        <path d="M0 30 C50 12 90 40 140 24 C190 8 230 34 280 18 C320 6 345 20 360 14 V58 C330 66 300 50 262 62 C220 74 190 52 140 64 C96 74 52 56 0 70 Z" fill="url(#aurora-g)"/>
        <path d="M20 44 C70 32 110 52 160 40 C200 30 240 48 290 36 C320 30 340 36 360 32" stroke="#c9f2dc" stroke-width="1.4" fill="none" opacity="0.7"/>
      </g>`,
  },
  // Amazon
  ropebridge: {
    base: 146,
    box: [8, 86, 156, 64],
    draw: () => `
      <path d="M20 146 C22 120 20 100 24 86 L32 86 C30 100 32 120 32 146 Z" fill="#8a6648" stroke="${OUT}" stroke-width="0.9"/>
      <path d="M146 146 C148 120 146 100 150 86 L158 86 C156 100 158 120 158 146 Z" fill="#8a6648" stroke="${OUT}" stroke-width="0.9"/>
      <g fill="#6faa66"><circle cx="28" cy="84" r="12"/><circle cx="154" cy="84" r="12"/><circle cx="16" cy="92" r="8"/><circle cx="166" cy="92" r="8"/></g>
      <path d="M30 104 C70 122 108 122 150 104" stroke="#c99a68" stroke-width="5" fill="none"/>
      <g stroke="#a87b4f" stroke-width="1">${Array.from({ length: 11 }, (_, i) => {
        const t = (i + 1) / 12;
        const x = 30 + 120 * t;
        const y = 104 + Math.sin(Math.PI * t) * 13.5;
        return `<path d="M${x.toFixed(1)} ${(y - 2.4).toFixed(1)} v4.8"/>`;
      }).join('')}</g>
      <path d="M30 94 C70 110 108 110 150 94" stroke="#b58a5a" stroke-width="1.2" fill="none"/>
      <g stroke="#b58a5a" stroke-width="0.8">${Array.from({ length: 6 }, (_, i) => {
        const t = (i + 1) / 7;
        const x = 30 + 120 * t;
        return `<path d="M${x.toFixed(1)} ${(94 + Math.sin(Math.PI * t) * 12).toFixed(1)} L${x.toFixed(1)} ${(104 + Math.sin(Math.PI * t) * 13.5).toFixed(1)}"/>`;
      }).join('')}</g>`,
  },
  orchids: {
    base: 1,
    box: [0, 6, 96, 74],
    draw: () => `
      <path d="M0 18 C30 14 60 20 92 26" stroke="#7d5a42" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M0 16 C30 12 60 18 92 24" stroke="#93c08e" stroke-width="2" fill="none" opacity="0.8"/>
      <g stroke="#6fa874" stroke-width="1.1" fill="none"><path d="M22 18 C20 34 24 48 20 62"/><path d="M50 20 C52 34 48 46 52 58"/><path d="M76 24 C74 36 78 50 74 70"/></g>
      ${[
        [20, 34, '#f4a6d0'],
        [22, 48, '#fbe3f0'],
        [20, 62, '#f4a6d0'],
        [52, 34, '#fbe3f0'],
        [50, 47, '#f4a6d0'],
        [52, 58, '#fbe3f0'],
        [74, 38, '#f4a6d0'],
        [77, 52, '#fbe3f0'],
        [74, 68, '#f4a6d0'],
      ]
        .map(
          ([x, y, c]) =>
            `<g><ellipse cx="${(x as number) - 3}" cy="${y}" rx="3.4" ry="2" fill="${c}"/><ellipse cx="${(x as number) + 3}" cy="${y}" rx="3.4" ry="2" fill="${c}"/><ellipse cx="${x}" cy="${(y as number) - 2.6}" rx="2" ry="3" fill="${c}"/><circle cx="${x}" cy="${(y as number) + 0.6}" r="1.3" fill="#f6d27a"/></g>`,
        )
        .join('')}`,
  },
  fireflyjars: {
    base: 296,
    box: [30, 264, 56, 34],
    draw: () =>
      [
        [40, 0],
        [56, 4],
        [74, 1],
      ]
        .map(
          ([x, d]) => `
        <ellipse cx="${x}" cy="${295 - d / 2}" rx="8" ry="1.8" fill="${SHADOW}"/>
        <circle class="sp-glow" cx="${x}" cy="${284 - d}" r="10" fill="#fff3b0" opacity="0.32"/>
        <path d="M${x - 6} ${276 - d} H${x + 6} V${292 - d} C${x + 6} ${294 - d} ${x - 6} ${294 - d} ${x - 6} ${292 - d} Z" fill="#e6f4ee" stroke="#a9c9b8" stroke-width="0.9" opacity="0.9"/>
        <rect x="${x - 6.6}" y="${273 - d}" width="13.2" height="3.4" rx="1" fill="#c99a68"/>
        <g fill="#fff3a0"><circle cx="${x - 2}" cy="${283 - d}" r="1.3"/><circle cx="${x + 2.4}" cy="${287 - d}" r="1.1"/><circle cx="${x + 0.6}" cy="${280 - d}" r="0.9"/></g>`,
        )
        .join(''),
  },
  waterfall: {
    base: 152,
    box: [292, 128, 68, 104],
    draw: () => `
      <path d="M298 228 C292 200 296 170 304 150 C314 132 340 128 360 132 V228 Z" fill="#8f9a8c" stroke="${OUT}" stroke-width="1"/>
      <path d="M306 160 C316 146 336 142 352 146" stroke="#a7b2a2" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g fill="#6faa66"><circle cx="304" cy="152" r="7"/><circle cx="350" cy="134" r="8"/><circle cx="300" cy="196" r="6"/></g>
      <path d="M318 148 C320 170 318 200 322 228 L340 228 C338 200 338 170 334 146 Z" fill="#cfeaf0"/>
      <g class="sp-water" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.9"><path d="M322 156 C323 174 322 196 325 220"/><path d="M330 152 C331 172 330 196 333 224"/></g>
      <ellipse cx="331" cy="230" rx="16" ry="4" fill="#fff" opacity="0.7"/>`,
  },
};

// ------------------------------------------------------------------ the animals' spots

interface Spot {
  x: number;
  y: number;
  H: number;
  mood: CompanionMood;
  /** Draw order (when the animal sits on something whose ground line is lower than its own). */
  base?: number;
}

type RegionalCompanion = Exclude<CompanionId, 'ember' | 'maple'>;

const SPOTS: Record<RegionalCompanion, Spot> = {
  gumnut: { x: 86, y: 118, H: 28, mood: 'sleepy', base: 176 },
  skipper: { x: 232, y: 240, H: 42, mood: 'happy' },
  dozer: { x: 60, y: 250, H: 34, mood: 'idle' },
  zuri: { x: 300, y: 238, H: 44, mood: 'happy' },
  sunny: { x: 64, y: 161, H: 28, mood: 'idle', base: 201 },
  tembo: { x: 262, y: 278, H: 40, mood: 'happy' },
  luna: { x: 82, y: 194, H: 28, mood: 'idle', base: 217 },
  frost: { x: 258, y: 250, H: 40, mood: 'happy' },
  pebble: { x: 212, y: 278, H: 34, mood: 'sleepy' },
  rio: { x: 318, y: 128, H: 24, mood: 'happy', base: 135 },
  mango: { x: 252, y: 166, H: 28, mood: 'sleepy', base: 215 },
  pudding: { x: 110, y: 246, H: 32, mood: 'idle', base: 247 },
};

// ------------------------------------------------------------------ the four regions

interface Feature {
  base: number;
  svg: string;
}

interface RegionArt {
  sky(id: string): string;
  land(id: string): string;
  /** Features by stage (index 1–4). */
  stages: Record<1 | 2 | 3 | 4, Feature[]>;
  sign: [number, number];
  evening: Array<[number, number]>;
}

const tuft = (x: number, y: number, c: string) =>
  `<g stroke="${c}" stroke-width="1.5" stroke-linecap="round"><path d="M${x} ${y} l-6 -7 M${x} ${y} l-2 -9 M${x} ${y} l2.5 -9 M${x} ${y} l6.5 -6"/></g>`;

const pea = (x: number, y: number) =>
  `<g><path d="M${x} ${y} C${x - 1} ${y - 4} ${x - 1} ${y - 6} ${x - 2} ${y - 8}" stroke="#6f8a4e" stroke-width="1.4" fill="none"/>
   <path d="M${x - 2} ${y - 8} c-6 -1 -9 2 -9 5 c4 0 7 -2 9 -5z" fill="#d8342c"/><path d="M${x - 2} ${y - 8} c6 -1 9 2 9 5 c-4 0 -7 -2 -9 -5z" fill="#d8342c"/>
   <path d="M${x - 2} ${y - 8} c-1 -4 0 -7 2 -9 c1 3 0 6 -2 9z" fill="#e2483e"/><circle cx="${x - 2}" cy="${y - 8}" r="1.8" fill="#1e1a18"/></g>`;

const wildflower = (x: number, y: number, c: string) =>
  `<g><path d="M${x} ${y} v-7" stroke="#8aa25a" stroke-width="1.1"/><circle cx="${x}" cy="${y - 8}" r="2.4" fill="${c}"/><circle cx="${x}" cy="${y - 8}" r="0.8" fill="#fff6d8"/></g>`;

const cotton = (x: number, y: number) =>
  `<g><path d="M${x} ${y} C${x - 1} ${y - 6} ${x + 1} ${y - 10} ${x} ${y - 14}" stroke="#8aa57a" stroke-width="1" fill="none"/><circle cx="${x}" cy="${y - 15}" r="3.2" fill="#fff"/><circle cx="${x + 1}" cy="${y - 16}" r="1.6" fill="#f4f8fb"/></g>`;

const heliconia = (x: number, y: number) =>
  `<g><path d="M${x} ${y} V${y - 30}" stroke="#4f8a4a" stroke-width="1.8"/>
   ${[0, 1, 2, 3].map((i) => `<path d="M${x} ${y - 28 + i * 7} l${i % 2 ? 9 : -9} -3 l${i % 2 ? -3 : 3} 6 z" fill="${i % 2 ? '#f4c430' : '#e2483e'}" stroke="#b8341f" stroke-width="0.5"/>`).join('')}
   <path d="M${x} ${y - 4} C${x - 12} ${y - 10} ${x - 16} ${y - 20} ${x - 14} ${y - 26} C${x - 8} ${y - 18} ${x - 4} ${y - 12} ${x} ${y - 6}Z" fill="#5fa05a"/></g>`;

const birdFlock = (pts: Array<[number, number]>, c = '#5b4a3a') =>
  `<g class="sp-birds">${pts.map(([x, y]) => `<path d="M${x - 5} ${y} q2.5 -3 5 0 q2.5 -3 5 0" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`).join('')}</g>`;

const butterflies = (pts: Array<[number, number]>) =>
  `<g class="sp-birds">${pts
    .map(([x, y]) => `<g><ellipse cx="${x - 2.6}" cy="${y}" rx="3" ry="4" fill="#4fa3e0" transform="rotate(-20 ${x - 2.6} ${y})"/><ellipse cx="${x + 2.6}" cy="${y}" rx="3" ry="4" fill="#4fa3e0" transform="rotate(20 ${x + 2.6} ${y})"/><path d="M${x} ${y - 3} v6" stroke="#2f2a27" stroke-width="1"/></g>`)
    .join('')}</g>`;

const ARCTIC_STARS: Array<[number, number, number]> = [
  [30, 22, 2.4],
  [92, 14, 1.8],
  [150, 30, 2.2],
  [212, 12, 1.6],
  [250, 36, 2],
  [330, 20, 2.4],
  [120, 52, 1.4],
];

const REGION_ART: Record<RegionId, RegionArt> = {
  outback: {
    sky: (id) => `
      <defs>
        <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cfa8"/><stop offset="0.7" stop-color="#fbe5cd"/><stop offset="1" stop-color="#fcefdf"/></linearGradient>
        <linearGradient id="${id}-earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaa97a"/><stop offset="1" stop-color="#d98b5c"/></linearGradient>
      </defs>
      <rect width="360" height="300" fill="url(#${id}-sky)"/>
      <circle cx="292" cy="44" r="30" fill="#ffe7b5" opacity="0.45"/><circle cx="292" cy="44" r="19" fill="#ffe1a1"/>
      <g fill="#fff" opacity="0.7"><ellipse cx="70" cy="36" rx="26" ry="5"/><ellipse cx="180" cy="24" rx="18" ry="4"/></g>`,
    land: (id) => `
      <path d="M0 118 L22 118 L30 100 C34 95 70 93 76 97 L84 118 L150 116 L156 106 C160 102 186 102 190 106 L196 116 L360 114 V140 H0Z" fill="#d99a76" opacity="0.62"/>
      <path d="M0 126 C80 118 180 124 260 120 C300 118 330 122 360 120 V300 H0Z" fill="url(#${id}-earth)"/>
      <g stroke="#f0b98a" stroke-width="9" opacity="0.35" fill="none"><path d="M0 172 C100 162 220 170 360 162"/><path d="M0 232 C120 222 250 230 360 222"/><path d="M0 286 C120 276 250 284 360 276"/></g>
      ${[
        [110, 150],
        [200, 140],
        [300, 190],
        [24, 270],
        [196, 290],
        [340, 248],
        [140, 214],
      ]
        .map(([x, y]) => tuft(x, y, '#b9b46a'))
        .join('')}
      <g fill="#c47a50" opacity="0.7"><ellipse cx="226" cy="150" rx="3" ry="1.6"/><ellipse cx="120" cy="296" rx="3.4" ry="1.8"/><ellipse cx="270" cy="296" rx="2.6" ry="1.4"/></g>`,
    stages: {
      1: [
        {
          base: 176,
          svg: `
          <ellipse cx="58" cy="176" rx="24" ry="4.5" fill="${SHADOW}"/>
          <path d="M60 124 C70 118 86 116 100 118" stroke="#e6dccb" stroke-width="6" stroke-linecap="round" fill="none"/>
          <path d="M58 98 C48 90 40 86 30 84" stroke="#e6dccb" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M50 176 C54 142 52 112 57 70 L65 70 C62 112 64 142 66 176 Z" fill="#efe6d8" stroke="${OUT}" stroke-width="1"/>
          <path d="M56 162 C57 142 56 122 60 96" stroke="#c9bfae" stroke-width="1.2" fill="none"/>
          <g fill="#9fb79a"><circle cx="40" cy="62" r="18"/><circle cx="62" cy="46" r="22"/><circle cx="86" cy="62" r="17"/><circle cx="26" cy="80" r="12"/><circle cx="100" cy="98" r="11"/></g>
          <g fill="#b4c8a8"><circle cx="54" cy="40" r="10"/><circle cx="80" cy="54" r="8"/><circle cx="34" cy="58" r="8"/></g>
          <g fill="#c8b7a6"><circle cx="46" cy="72" r="1.6"/><circle cx="74" cy="66" r="1.4"/></g>`,
        },
        {
          base: 154,
          svg: `
          <ellipse cx="128" cy="154" rx="14" ry="3" fill="${SHADOW}"/>
          <path d="M124 154 C126 132 125 114 128 98 L133 98 C132 114 132 132 134 154 Z" fill="#efe6d8" stroke="${OUT}" stroke-width="0.9"/>
          <g fill="#9fb79a"><circle cx="118" cy="90" r="12"/><circle cx="136" cy="82" r="14"/><circle cx="148" cy="94" r="9"/></g><g fill="#b4c8a8"><circle cx="132" cy="78" r="6"/></g>`,
        },
      ],
      2: [
        {
          base: 216,
          svg: `
          <ellipse cx="244" cy="216" rx="44" ry="5" fill="${SHADOW}"/>
          <path d="M214 170 V214 M276 164 V212" stroke="#9b7a5c" stroke-width="3.4" stroke-linecap="round"/>
          <ellipse cx="244" cy="212" rx="26" ry="5" fill="#f1d58e"/><path d="M224 211 l6 -3 M236 213 l5 -4 M250 212 l6 -3 M260 213 l4 -3" stroke="#d9b45e" stroke-width="1"/>
          <path d="M208 172 L284 162 L286 170 L210 180 Z" fill="#c9d1d6" stroke="${OUT}" stroke-width="1"/>
          <g stroke="#aeb7bd" stroke-width="1">${Array.from({ length: 9 }, (_, i) => `<path d="M${214 + i * 8.4} ${179.2 - i * 1.1} L${212.4 + i * 8.4} ${171.4 - i * 1.1}"/>`).join('')}</g>
          <path d="M210 172 V214 M282 164 V212" stroke="#8a6a4f" stroke-width="3.4" stroke-linecap="round"/>`,
        },
      ],
      3: [
        {
          base: 255,
          svg: `
          <ellipse cx="150" cy="270" rx="78" ry="17" fill="#c98a5e" opacity="0.5"/>
          <ellipse cx="150" cy="268" rx="72" ry="14" fill="#9fd0d4"/>
          <g class="sp-water" stroke="#fff" stroke-width="1.4" opacity="0.75" fill="none" stroke-linecap="round"><path d="M110 266 q8 2 14 0"/><path d="M164 272 q8 2 14 0"/><path d="M190 262 q5 1.4 9 0"/></g>
          ${[86, 92, 210, 216]
            .map((x, i) => `<path d="M${x} ${266 - (i % 2) * 2} V${248 - (i % 2) * 4}" stroke="#7d9a5a" stroke-width="1.4"/><rect x="${x - 1.6}" y="${246 - (i % 2) * 4}" width="3.2" height="8" rx="1.6" fill="#8a5a3a"/>`)
            .join('')}`,
        },
        {
          base: 240,
          svg: `<path d="M6 242 C12 222 58 220 68 242 Z" fill="#c47d52" stroke="${OUT}" stroke-width="0.9"/><path d="M24 242 C26 231 42 231 44 242 Z" fill="#5a3a2a"/><g fill="#d99566"><circle cx="12" cy="242" r="2"/><circle cx="62" cy="243" r="2.4"/></g>`,
        },
      ],
      4: [
        {
          base: 300,
          svg: `${[
            [196, 178],
            [318, 196],
            [118, 216],
            [300, 290],
            [20, 286],
            [206, 292],
            [152, 182],
          ]
            .map(([x, y]) => pea(x, y))
            .join('')}${birdFlock(
            [
              [150, 56],
              [166, 48],
              [182, 60],
            ],
            '#5e9a4a',
          )}`,
        },
      ],
    },
    sign: [18, 190],
    evening: [
      [60, 30],
      [130, 18],
      [210, 40],
      [250, 20],
      [340, 70],
      [20, 60],
    ],
  },
  savanna: {
    sky: (id) => `
      <defs>
        <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d096"/><stop offset="0.7" stop-color="#fbe5c0"/><stop offset="1" stop-color="#fdf1dc"/></linearGradient>
        <linearGradient id="${id}-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eed592"/><stop offset="1" stop-color="#dab76b"/></linearGradient>
      </defs>
      <rect width="360" height="300" fill="url(#${id}-sky)"/>
      <circle cx="96" cy="92" r="46" fill="#ffd98a" opacity="0.32"/><circle cx="96" cy="92" r="27" fill="#ffcf73"/>
      <g fill="#fff" opacity="0.6"><ellipse cx="220" cy="34" rx="28" ry="4.4"/><ellipse cx="300" cy="52" rx="18" ry="3.4"/></g>`,
    land: (id) => `
      <path d="M0 118 C60 108 120 112 180 116 C240 120 300 106 360 112 V140 H0Z" fill="#e7c98f"/>
      <g fill="#b99a62" opacity="0.55">${[
        [212, 116],
        [244, 113],
        [36, 116],
      ]
        .map(([x, y]) => `<path d="M${x} ${y} v-9" stroke="#b99a62" stroke-width="1.6"/><ellipse cx="${x}" cy="${y - 10}" rx="13" ry="3.2"/>`)
        .join('')}</g>
      <path d="M0 126 C80 118 180 124 260 120 C300 118 330 122 360 120 V300 H0Z" fill="url(#${id}-grass)"/>
      <g stroke="#e3c27a" stroke-width="9" opacity="0.4" fill="none"><path d="M0 176 C100 166 220 172 360 166"/><path d="M0 236 C120 226 250 232 360 224"/></g>
      ${[
        [24, 150],
        [190, 146],
        [330, 150],
        [140, 296],
        [306, 296],
        [228, 236],
        [12, 230],
      ]
        .map(([x, y]) => tuft(x, y, '#c9a24f'))
        .join('')}`,
    stages: {
      1: [
        {
          base: 172,
          svg: `
          <ellipse cx="286" cy="172" rx="30" ry="4.6" fill="${SHADOW}"/>
          <g stroke="#8a6a4f" stroke-linecap="round" fill="none"><path d="M282 172 C284 150 280 130 272 108" stroke-width="6"/><path d="M282 140 C292 124 304 112 318 104" stroke-width="4.4"/><path d="M278 124 C268 116 258 110 246 106" stroke-width="3.6"/></g>
          <ellipse cx="294" cy="100" rx="60" ry="10" fill="#7f9e5c"/><ellipse cx="290" cy="93" rx="48" ry="9" fill="#a3bf78"/><ellipse cx="302" cy="89" rx="26" ry="5" fill="#b6cf8a"/>`,
        },
      ],
      2: [
        {
          base: 202,
          svg: `
          <ellipse cx="62" cy="202" rx="40" ry="5" fill="${SHADOW}"/>
          <ellipse cx="60" cy="194" rx="36" ry="13" fill="#c9a882" stroke="${OUT}" stroke-width="1"/>
          <ellipse cx="42" cy="182" rx="20" ry="12" fill="#d6b892" stroke="${OUT}" stroke-width="1"/>
          <ellipse cx="78" cy="178" rx="18" ry="13" fill="#bf9c74" stroke="${OUT}" stroke-width="1"/>
          <ellipse cx="64" cy="166" rx="16" ry="8.6" fill="#dcc09c" stroke="${OUT}" stroke-width="1"/>
          <path d="M34 186 q6 -3 12 0 M70 180 q5 -3 10 0" stroke="#a88a64" stroke-width="1" fill="none"/>`,
        },
      ],
      3: [
        {
          base: 256,
          svg: `
          <ellipse cx="170" cy="272" rx="84" ry="18" fill="#c9a46e" opacity="0.6"/>
          <ellipse cx="170" cy="270" rx="76" ry="14" fill="#a7d3cf"/>
          <g class="sp-water" stroke="#fff" stroke-width="1.4" opacity="0.75" fill="none" stroke-linecap="round"><path d="M126 268 q8 2 14 0"/><path d="M182 274 q8 2 14 0"/><path d="M210 264 q5 1.4 9 0"/></g>
          <g fill="#b99a72" stroke="${OUT}" stroke-width="0.8"><ellipse cx="102" cy="276" rx="6" ry="3"/><ellipse cx="236" cy="264" rx="5" ry="2.6"/></g>`,
        },
      ],
      4: [
        {
          base: 300,
          svg: `${[
            [130, 190, '#f6d27a'],
            [196, 200, '#c9b4f0'],
            [330, 200, '#f6d27a'],
            [24, 262, '#c9b4f0'],
            [322, 292, '#f2a6bd'],
            [110, 298, '#f6d27a'],
            [240, 296, '#c9b4f0'],
            [262, 214, '#f2a6bd'],
          ]
            .map(([x, y, c]) => wildflower(x as number, y as number, c as string))
            .join('')}${birdFlock([
            [160, 58],
            [176, 50],
            [190, 62],
          ])}`,
        },
      ],
    },
    sign: [346, 288],
    evening: [
      [40, 40],
      [150, 30],
      [230, 60],
      [330, 34],
      [210, 140],
      [110, 150],
    ],
  },
  arctic: {
    sky: (id) => `
      <defs>
        <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd3ea"/><stop offset="0.7" stop-color="#dfe8f3"/><stop offset="1" stop-color="#eef3f8"/></linearGradient>
        <linearGradient id="${id}-snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fbfd"/><stop offset="1" stop-color="#e3ecf4"/></linearGradient>
      </defs>
      <rect width="360" height="300" fill="url(#${id}-sky)"/>
      <circle cx="284" cy="64" r="26" fill="#fff6dc" opacity="0.45"/><circle cx="284" cy="64" r="15" fill="#fff3d6"/>`,
    land: (id) => `
      <path d="M0 122 L40 86 L66 106 L96 72 L134 112 L160 98 L190 120 L228 82 L262 114 L300 90 L336 116 L360 102 V132 H0Z" fill="#e4edf6"/>
      <path d="M96 72 L134 112 L114 112 Z M228 82 L262 114 L240 114 Z M300 90 L336 116 L316 116 Z M40 86 L66 106 L52 106 Z" fill="#c9d9e9"/>
      <rect x="0" y="118" width="360" height="14" fill="#9fc2dc"/>
      <g fill="#fff" opacity="0.85"><ellipse cx="60" cy="125" rx="12" ry="2"/><ellipse cx="190" cy="127" rx="9" ry="1.6"/><ellipse cx="300" cy="124" rx="14" ry="2"/></g>
      <path d="M0 132 C80 126 180 130 260 126 C300 124 330 128 360 126 V300 H0Z" fill="url(#${id}-snow)"/>
      <g stroke="#d3e1ee" stroke-width="8" opacity="0.6" fill="none"><path d="M0 178 C100 168 220 176 360 168"/><path d="M0 238 C120 228 250 236 360 228"/></g>`,
    stages: {
      1: [
        {
          base: 218,
          svg: `
          <path d="M8 196 C20 176 56 176 68 196 Z" fill="#fbfdff" stroke="#d3e1ee" stroke-width="1"/>
          <path d="M130 178 C140 164 170 164 182 178 Z" fill="#fbfdff" stroke="#d3e1ee" stroke-width="1"/>
          <ellipse cx="82" cy="218" rx="20" ry="3.4" fill="${SHADOW}"/>
          <path d="M64 218 C62 202 72 194 84 194 C96 194 102 204 100 218 Z" fill="#9aa6b0" stroke="${OUT}" stroke-width="1"/>
          <path d="M66 204 C70 196 78 194 84 194 C92 194 98 198 99 206 C92 202 74 202 66 204 Z" fill="#fff"/>`,
        },
      ],
      2: [
        {
          base: 218,
          svg: `
          <ellipse cx="292" cy="218" rx="48" ry="5" fill="${SHADOW}"/>
          <path d="M246 218 C246 180 338 180 338 218 Z" fill="#f4f8fb" stroke="#c3d4e4" stroke-width="1.2"/>
          <path d="M310 190 C326 196 334 206 336 216" stroke="#d3e1ee" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="M278 218 C278 200 304 200 304 218 Z" fill="#5f7f9c"/>
          <path d="M282 218 C282 206 300 206 300 218 Z" fill="#4c6a86"/>`,
        },
      ],
      3: [
        {
          base: 254,
          svg: `
          <path d="M44 274 C50 258 120 252 168 258 C200 262 204 282 174 288 C122 296 56 292 44 274 Z" fill="#86b3d3" stroke="#fff" stroke-width="3"/>
          <g class="sp-water" stroke="#d6ecf7" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.9"><path d="M80 274 q8 2 14 0"/><path d="M130 280 q8 2 14 0"/><path d="M150 266 q5 1.4 9 0"/></g>
          <path d="M100 268 C104 262 120 262 124 268 C118 271 106 271 100 268 Z" fill="#fff" stroke="#c3d4e4" stroke-width="0.8"/>`,
        },
      ],
      4: [
        {
          base: 300,
          svg: `${[
            [24, 234],
            [34, 238],
            [120, 214],
            [200, 200],
            [212, 206],
            [330, 246],
            [16, 292],
            [184, 296],
          ]
            .map(([x, y]) => cotton(x, y))
            .join('')}`,
        },
        {
          base: -5,
          svg: `<g class="sp-stars" opacity="0.9">${ARCTIC_STARS.map(([x, y, r]) => sparkle(x, y, r, '#fffbe8')).join('')}</g>`,
        },
      ],
    },
    sign: [22, 162],
    evening: [
      [40, 50],
      [120, 30],
      [200, 50],
      [260, 30],
      [330, 50],
      [170, 90],
    ],
  },
  amazon: {
    sky: (id) => `
      <defs>
        <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6d3"/><stop offset="0.7" stop-color="#e3f0dc"/><stop offset="1" stop-color="#eef4e3"/></linearGradient>
        <linearGradient id="${id}-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc486"/><stop offset="1" stop-color="#6fae6c"/></linearGradient>
      </defs>
      <rect width="360" height="300" fill="url(#${id}-sky)"/>
      <g fill="#fff" opacity="0.45"><ellipse cx="90" cy="44" rx="60" ry="6"/><ellipse cx="270" cy="30" rx="50" ry="5"/></g>`,
    land: (id) => `
      <g fill="#a8cfa2">${Array.from({ length: 18 }, (_, i) => `<circle cx="${i * 22}" cy="${104 + ((i * 7) % 3) * 4}" r="${16 + ((i * 5) % 4) * 2}"/>`).join('')}</g>
      <g fill="#8fc08c">${Array.from({ length: 16 }, (_, i) => `<circle cx="${10 + i * 24}" cy="${120 + ((i * 3) % 4) * 3}" r="${14 + ((i * 7) % 3) * 3}"/>`).join('')}</g>
      <path d="M0 132 C80 126 180 130 260 126 C300 124 330 128 360 126 V300 H0Z" fill="url(#${id}-floor)"/>
      <path d="M0 222 C80 212 160 228 240 224 C290 222 330 230 360 226 V262 C320 266 280 258 240 262 C160 270 80 252 0 262 Z" fill="#c2a374"/>
      <g class="sp-water" stroke="#dcc79e" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.9"><path d="M30 238 q12 3 22 0"/><path d="M180 246 q12 3 22 0"/><path d="M290 240 q10 2.4 18 0"/></g>
      ${[
        [190, 150],
        [40, 160],
        [300, 290],
        [150, 290],
        [96, 200],
      ]
        .map(([x, y]) => tuft(x, y, '#5f9a58'))
        .join('')}`,
    stages: {
      1: [
        {
          base: 236,
          svg: `
          <path d="M0 214 C30 172 82 170 98 202 C72 208 40 216 0 238 Z" fill="#4f9a5a" stroke="${OUT}" stroke-width="0.9"/>
          <path d="M2 228 C30 206 60 196 92 200" stroke="#7cc07c" stroke-width="1.4" fill="none"/>
          <path d="M30 200 l8 10 M52 192 l6 10 M72 190 l2 10" stroke="#7cc07c" stroke-width="1" fill="none"/>`,
        },
        {
          base: 300,
          svg: `<path d="M360 300 C330 292 300 272 294 250 C320 250 350 262 360 272 Z" fill="#4f9a5a" stroke="${OUT}" stroke-width="0.9"/><path d="M358 292 C336 280 314 266 300 254" stroke="#7cc07c" stroke-width="1.4" fill="none"/>`,
        },
        {
          base: 134,
          svg: `<path d="M360 124 C330 124 304 128 282 134" stroke="#7d5a42" stroke-width="6" stroke-linecap="round" fill="none"/><g fill="#5fa05a"><ellipse cx="290" cy="128" rx="8" ry="3.4" transform="rotate(-24 290 128)"/><ellipse cx="346" cy="118" rx="9" ry="3.6" transform="rotate(18 346 118)"/></g>`,
        },
      ],
      2: [
        {
          base: 216,
          svg: `
          <ellipse cx="231" cy="216" rx="22" ry="4" fill="${SHADOW}"/>
          <path d="M220 216 C222 172 220 120 225 56 L239 56 C242 120 240 172 242 216 Z" fill="#8a6648" stroke="${OUT}" stroke-width="1"/>
          <path d="M228 200 C229 170 228 130 231 80" stroke="#a7825f" stroke-width="1.2" fill="none"/>
          <g fill="#6faa66"><circle cx="214" cy="54" r="18"/><circle cx="240" cy="44" r="20"/><circle cx="262" cy="58" r="15"/></g>
          <path d="M224 186 L202 170 M240 186 L264 170" stroke="#a87b4f" stroke-width="2.4" stroke-linecap="round"/>
          <rect x="194" y="166" width="78" height="6" rx="2" fill="#c99a68" stroke="${OUT}" stroke-width="0.9"/>
          <path d="M198 166 V152 M218 166 V152 M248 166 V152 M268 166 V152" stroke="#a87b4f" stroke-width="1.6"/>
          <path d="M198 154 H268" stroke="#b58a5a" stroke-width="1.6"/>`,
        },
      ],
      3: [
        {
          base: 238,
          svg: `
          <ellipse cx="110" cy="248" rx="26" ry="6.4" fill="#5e9a52"/><ellipse cx="110" cy="246.6" rx="23" ry="5.2" fill="#8cc47a"/>
          <path d="M110 246.6 L132 246 M110 246.6 L120 242 M110 246.6 L100 242" stroke="#6faa66" stroke-width="0.8"/>
          <ellipse cx="172" cy="240" rx="14" ry="3.8" fill="#8cc47a" stroke="#5e9a52" stroke-width="1.2"/>
          <ellipse cx="56" cy="252" rx="12" ry="3.2" fill="#8cc47a" stroke="#5e9a52" stroke-width="1.2"/>
          <g><ellipse cx="170" cy="237" rx="3" ry="2" fill="#fbe3f0"/><ellipse cx="174" cy="237" rx="3" ry="2" fill="#f4a6d0"/><circle cx="172" cy="236" r="1" fill="#f6d27a"/></g>`,
        },
      ],
      4: [
        {
          base: 300,
          svg: `${[
            [20, 212],
            [276, 296],
            [150, 296],
            [324, 206],
          ]
            .map(([x, y]) => heliconia(x, y))
            .join('')}${butterflies([
            [150, 170],
            [190, 146],
            [92, 150],
          ])}`,
        },
      ],
    },
    sign: [200, 292],
    evening: [
      [60, 150],
      [130, 180],
      [180, 140],
      [290, 180],
      [330, 230],
      [30, 280],
    ],
  },
};

// ------------------------------------------------------------------ scene

export interface RegionSceneState {
  stage: number;
  companions: CompanionId[];
  decor: DecorId[];
  evening?: boolean;
}

export function regionScene(region: RegionId, st: RegionSceneState, id = 'region'): string {
  const art = REGION_ART[region];
  const sky: string[] = [];
  const items: Feature[] = [];
  for (const s of [1, 2, 3, 4] as const) {
    if (st.stage < s) continue;
    for (const f of art.stages[s]) {
      const g = `<g class="sp-stage" data-stage="${s}">${f.svg}</g>`;
      if (f.base < 0) sky.push(g);
      else items.push({ base: f.base, svg: g });
    }
  }
  for (const d of st.decor) {
    const a = (REGION_DECOR_ART as Record<string, DecorArt | undefined>)[d];
    if (!a || !DECOR_BY_ID[d] || decorHome(DECOR_BY_ID[d]) !== region) continue;
    const g = `<g data-decor="${d}">${a.draw()}</g>`;
    if (a.base < 0) sky.push(g);
    else items.push({ base: a.base, svg: g });
  }
  const accent = SANCTUARY_BY_ID[region].accent;
  items.push({ base: art.sign[1], svg: sign(art.sign[0], art.sign[1], accent) });
  for (const c of COMPANIONS) {
    if (c.sanctuary !== region || !st.companions.includes(c.id)) continue;
    const spot = SPOTS[c.id as RegionalCompanion];
    const top = figureTop(c.id, spot.y, spot.H);
    const fig = companionFigure(c.id, spot.x, spot.y, spot.H, spot.mood).replace(/<\/g>$/, `${heartAbove(spot.x, top - 2)}</g>`);
    items.push({ base: (spot.base ?? spot.y) + 0.6, svg: fig });
  }
  items.sort((a, b) => a.base - b.base);
  const evening = st.evening ? dusk(art.evening) : '';
  return art.sky(id) + sky.join('') + art.land(id) + items.map((i) => i.svg).join('') + evening;
}

/** The scene for a sanctuary's world-map card: its land at the stage reached, with no figures. */
export function regionThumb(region: RegionId, stage: number, id: string): string {
  return regionScene(region, { stage, companions: [], decor: [] }, id);
}
