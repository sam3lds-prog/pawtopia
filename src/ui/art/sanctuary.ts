/**
 * The Harmony Sanctuary illustration (original art, drawn in code). A 360×300 garden: sky, hills, the cottage, a brook,
 * then every owned decoration in its fixed spot, the welcomed residents sitting on or beside them, and any wildlife
 * companions in their habitats. Drawables are painted back to front by their ground line.
 *
 * The markup is static; the sanctuary screen brings it to life with `AmbientDirector` (D24) by toggling classes on the
 * named groups here: `.sanctuary__pet` figures (and their `.sp-tail`), and decor parts `.sp-water`, `.sp-glow`,
 * `.sp-petals`, `.sp-fireflies`. On the puzzle board pets still animate their faces only (D11).
 */

import { DECOR, type DecorId } from '../../meta/catalogs/decor';
import { PET_BY_ID, PETS, type PetId } from '../../meta/catalogs/pets';
import type { FaceMood } from '../animation/faceMachine';
import { petRigMarkup } from './pets';
import { COMPANION_BY_ID, COMPANIONS, type CompanionId } from '../../meta/catalogs/companions';
import { companionFigure, woodlandNook } from './companions';
import { REGION_DECOR_ART, type RegionDecorId } from './regions';
import { OUT, SHADOW, dusk, heartAbove, iconFrom, type DecorArt } from './sceneKit';

// ------------------------------------------------------------------ backdrop

function backdrop(id: string): string {
  return `
  <defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cbe7ec"/><stop offset="0.8" stop-color="#eef2e4"/><stop offset="1" stop-color="#f5f2e6"/>
    </linearGradient>
    <linearGradient id="${id}-lawn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a6cf9f"/><stop offset="1" stop-color="#8dbd8c"/>
    </linearGradient>
  </defs>
  <rect width="360" height="300" fill="url(#${id}-sky)"/>
  <circle cx="306" cy="42" r="30" fill="#fbe9c4" opacity="0.35"/>
  <circle cx="306" cy="42" r="19" fill="#fbe7bd"/>
  <g fill="#fff" opacity="0.88">
    <ellipse cx="66" cy="34" rx="25" ry="7.5"/><ellipse cx="82" cy="29" rx="15" ry="7.5"/>
    <ellipse cx="196" cy="24" rx="19" ry="5.5"/><ellipse cx="208" cy="20" rx="11" ry="5.5"/>
  </g>
  <path d="M0 112 C52 92 104 96 160 106 C222 117 286 88 360 98 V160 H0Z" fill="#cfe2c5"/>
  <g fill="#b8d6b2">
    <circle cx="128" cy="104" r="9"/><circle cx="140" cy="100" r="11"/><circle cx="152" cy="105" r="8"/>
    <circle cx="344" cy="96" r="8"/><circle cx="354" cy="100" r="7"/>
  </g>
  <path d="M0 132 C70 116 132 122 200 128 C262 133 310 120 360 124 V300 H0Z" fill="url(#${id}-lawn)"/>
  <g stroke="#9fca9c" stroke-width="10" opacity="0.35" fill="none">
    <path d="M0 176 C90 166 200 172 360 166"/><path d="M0 226 C110 214 240 222 360 214"/><path d="M0 280 C120 268 250 276 360 268"/>
  </g>
  ${cottage()}
  ${brook()}
  <g fill="#7cb07f">
    <path d="M118 296 l3 -9 l3 9z"/><path d="M296 300 l3 -8 l3 8z"/><path d="M28 196 l3 -8 l3 8z"/><path d="M342 208 l3 -9 l3 9z"/><path d="M186 160 l2.5 -7 l2.5 7z"/>
  </g>
  <g><circle cx="20" cy="172" r="2.6" fill="#f6c9d1"/><circle cx="27" cy="176" r="2.2" fill="#f6c9d1"/><circle cx="350" cy="182" r="2.6" fill="#f7e2a0"/><circle cx="343" cy="187" r="2.2" fill="#f7e2a0"/><circle cx="112" cy="282" r="2.4" fill="#d9ccf3"/><circle cx="120" cy="286" r="2" fill="#d9ccf3"/></g>`;
}

function cottage(): string {
  return `
  <g>
    <ellipse cx="250" cy="142" rx="46" ry="5" fill="${SHADOW}"/>
    <rect x="212" y="94" width="76" height="48" rx="4" fill="#fbf3e4" stroke="${OUT}" stroke-width="1.2"/>
    <rect x="270" y="64" width="9" height="20" fill="#c98466" stroke="${OUT}" stroke-width="1"/>
    <path d="M204 98 L250 60 L296 98 Z" fill="#287b70"/>
    <path d="M204 98 L250 60 L296 98" fill="none" stroke="#185c55" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M220 90 L250 66 L280 90" fill="none" stroke="#3a9184" stroke-width="1.4" opacity="0.7"/>
    <rect x="240" y="112" width="20" height="30" rx="10" fill="#d99a6c" stroke="${OUT}" stroke-width="1"/>
    <circle cx="255" cy="128" r="1.4" fill="#8c5a3a"/>
    <rect x="219" y="104" width="15" height="13" rx="2.5" fill="#f6d79b" stroke="${OUT}" stroke-width="1"/>
    <path d="M226.5 104 V117 M219 110.5 H234" stroke="#e9c27c" stroke-width="1"/>
    <rect x="266" y="104" width="15" height="13" rx="2.5" fill="#f6d79b" stroke="${OUT}" stroke-width="1"/>
    <path d="M273.5 104 V117 M266 110.5 H281" stroke="#e9c27c" stroke-width="1"/>
    <path d="M244 82 a6 6 0 0 1 12 0 v4 h-12z" fill="#f6d79b" stroke="${OUT}" stroke-width="1"/>
  </g>`;
}

function brook(): string {
  return `
  <path d="M0 230 C26 232 50 248 66 266 C78 280 90 292 98 300 L62 300 C54 290 42 278 30 266 C20 256 10 251 0 250 Z" fill="#bfe2e8"/>
  <path d="M0 230 C26 232 50 248 66 266 C78 280 90 292 98 300" fill="none" stroke="#a4d2da" stroke-width="2"/>
  <g stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.75" fill="none"><path d="M12 240 q6 1 10 4"/><path d="M44 266 q5 3 8 7"/><path d="M70 288 q3 3 5 6"/></g>`;
}

// ------------------------------------------------------------------ decor

const paw = (x: number, y: number, c = '#c8ae84') =>
  `<g fill="${c}"><ellipse cx="${x}" cy="${y + 0.7}" rx="2.4" ry="1.7"/><circle cx="${x - 2.3}" cy="${y - 1.3}" r="0.85"/><circle cx="${x}" cy="${y - 2.1}" r="0.85"/><circle cx="${x + 2.3}" cy="${y - 1.3}" r="0.85"/></g>`;

type HarmonyDecorId = Exclude<DecorId, RegionDecorId>;

const DECOR_ART: Record<HarmonyDecorId, DecorArt> = {
  kite: {
    base: -20,
    box: [16, 4, 72, 72],
    draw: () => `
      <path class="sp-kite-line" d="M50 40 C44 56 52 62 46 74" stroke="#8a6a4f" stroke-width="0.8" fill="none" opacity="0.7"/>
      <g class="sp-kite">
        <path d="M50 8 L64 24 L50 42 L36 24 Z" fill="#f2b2c2" stroke="${OUT}" stroke-width="1"/>
        <path d="M50 8 L64 24 L50 24 Z" fill="#f6d27a"/><path d="M36 24 L50 42 L50 24 Z" fill="#9fd3c7"/><path d="M50 24 L64 24 L50 42 Z" fill="#b8a6f0"/>
        <path d="M50 8 V42 M36 24 H64" stroke="#fff" stroke-width="0.8" opacity="0.8"/>
        <path d="M50 42 C46 48 54 52 48 58" stroke="#e58a7d" stroke-width="1.1" fill="none"/>
        <g fill="#f6d27a"><path d="M47 47 l3 1 -3 1z"/><path d="M51 52 l-3 1 3 1z"/></g>
      </g>`,
  },
  balloon: {
    base: -19,
    box: [128, 10, 46, 76],
    draw: () => `
      <g class="sp-balloon">
        <path d="M151 64 L144 76 M151 64 L158 76" stroke="#8a6a4f" stroke-width="0.9"/>
        <path d="M151 14 C137 14 130 26 130 36 C130 48 142 58 147 64 H155 C160 58 172 48 172 36 C172 26 165 14 151 14 Z" fill="#f08a7d" stroke="${OUT}" stroke-width="1"/>
        <path d="M151 14 C145 20 142 30 143 40 C144 50 147 58 149 64 H153 C155 58 158 50 159 40 C160 30 157 20 151 14 Z" fill="#f6d27a"/>
        <path d="M137 22 C134 30 134 42 140 52" stroke="#fff" stroke-width="1.6" fill="none" opacity="0.55" stroke-linecap="round"/>
        <path d="M130 36 H172" stroke="#f9c0b5" stroke-width="1"/>
        <g class="sp-seat"></g>
        <rect class="sp-basket" x="143" y="75" width="16" height="8" rx="2" fill="#c99a68" stroke="${OUT}" stroke-width="0.9"/>
        <path d="M143 79 H159" stroke="#a87b4f" stroke-width="0.8"/>
      </g>`,
  },
  eavelights: {
    base: 119,
    box: [200, 56, 100, 52],
    draw: () => {
      const bulbs: string[] = [];
      const colors = ['#f6d27a', '#f2a6bd', '#9fd3c7', '#c9b4f0'];
      const edge = (x0: number, y0: number, x1: number, y1: number, n: number, k0: number) => {
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const x = x0 + (x1 - x0) * t;
          const y = y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * 3 + 2.5;
          bulbs.push(
            `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${colors[(i + k0) % 4]}" opacity="0.35"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.7" fill="${colors[(i + k0) % 4]}"/>`,
          );
        }
      };
      edge(206, 97, 250, 62, 7, 0);
      edge(250, 62, 294, 97, 7, 2);
      return `<path d="M206 99 Q228 84 250 64 Q272 84 294 99" stroke="#5b4a3a" stroke-width="0.7" fill="none" opacity="0.6"/><g class="sp-glow-bulbs">${bulbs.join('')}</g>`;
    },
  },
  goldfountain: {
    base: 182,
    box: [116, 126, 66, 60],
    draw: () => `
      <ellipse cx="149" cy="181" rx="30" ry="5.5" fill="${SHADOW}"/>
      <path d="M121 166 C121 180 177 180 177 166 V170 C177 184 121 184 121 170 Z" fill="#d9a83c"/>
      <ellipse cx="149" cy="166" rx="28" ry="8" fill="#f2cf72" stroke="#b8862a" stroke-width="1.1"/>
      <ellipse cx="149" cy="166" rx="23" ry="5.6" fill="#bfe3ea"/>
      <rect x="145" y="148" width="8" height="18" rx="2" fill="#f0c55e" stroke="#b8862a" stroke-width="0.9"/>
      <ellipse cx="149" cy="148" rx="12" ry="3.6" fill="#f7dc8c" stroke="#b8862a" stroke-width="1"/>
      <path d="M143 144 l6 -9 6 9z" fill="#f2cf72" stroke="#b8862a" stroke-width="0.8"/>
      <path d="M149 134 C149 130 149 129 149 127" stroke="#bfe3ea" stroke-width="2.4" stroke-linecap="round"/>
      <g class="sp-water" fill="none" stroke="#a9d8e1" stroke-width="1.6" stroke-linecap="round"><path d="M149 128 C140 131 136 140 134 152"/><path d="M149 128 C158 131 162 140 164 152"/><path d="M139 149 C134 152 131 158 130 163"/><path d="M159 149 C164 152 167 158 168 163"/></g>
      <g fill="#fff8d6"><path d="M128 158 l1 -3 1 3 3 1 -3 1 -1 3 -1 -3 -3 -1z"/><path d="M170 160 l.8 -2.4 .8 2.4 2.4 .8 -2.4 .8 -.8 2.4 -.8 -2.4 -2.4 -.8z"/></g>`,
  },
  path: {
    base: 144,
    box: [186, 140, 76, 158],
    draw: () => {
      const stones: Array<[number, number]> = [
        [249, 152],
        [243, 169],
        [235, 187],
        [225, 206],
        [215, 226],
        [208, 247],
        [203, 269],
        [200, 292],
      ];
      return stones
        .map(
          ([x, y], i) =>
            `<ellipse cx="${x}" cy="${y}" rx="${11 + i * 0.4}" ry="${4.8 + i * 0.2}" fill="#f0e5ce" stroke="#d4c1a0" stroke-width="1"/>${i % 2 ? paw(x, y) : ''}`,
        )
        .join('');
    },
  },
  fence: {
    base: 160,
    box: [298, 126, 62, 40],
    draw: () => {
      let s = `<rect x="300" y="142" width="58" height="3.2" rx="1.2" fill="#f3ead9" stroke="${OUT}" stroke-width="0.8"/><rect x="300" y="152" width="58" height="3.2" rx="1.2" fill="#f3ead9" stroke="${OUT}" stroke-width="0.8"/>`;
      for (let x = 302; x <= 352; x += 8)
        s += `<path d="M${x} 160 V134 L${x + 2.6} 130.5 L${x + 5.2} 134 V160 Z" fill="#fbf6ec" stroke="${OUT}" stroke-width="0.9"/>`;
      const fl: Array<[number, number, string]> = [
        [305, 138, '#f2a6bd'],
        [313, 147, '#c9b4f0'],
        [322, 136, '#f2a6bd'],
        [331, 149, '#f6c27a'],
        [339, 139, '#c9b4f0'],
        [348, 146, '#f2a6bd'],
        [355, 137, '#f6c27a'],
      ];
      s += `<g stroke="#6fa874" stroke-width="1.3" fill="none" stroke-linecap="round"><path d="M303 160 C306 150 302 144 306 138"/><path d="M321 160 C318 150 324 142 322 136"/><path d="M338 160 C341 150 337 145 339 139"/><path d="M354 160 C352 152 356 144 355 137"/></g>`;
      s += fl.map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2.8" fill="${c}"/><circle cx="${x}" cy="${y}" r="1" fill="#fff6d8"/>`).join('');
      return s;
    },
  },
  tree: {
    base: 154,
    box: [6, 40, 84, 118],
    draw: () => `
      <ellipse cx="47" cy="154" rx="24" ry="5" fill="${SHADOW}"/>
      <path d="M43 154 C45 132 44 118 40 104 M45 128 C52 118 58 112 64 108 M44 118 C38 110 30 106 24 104" stroke="#8a6a4f" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M43 154 C45 132 44 118 40 104" stroke="#8a6a4f" stroke-width="8" stroke-linecap="round" fill="none"/>
      <g>
        <circle cx="46" cy="80" r="26" fill="#f2b2c2"/><circle cx="24" cy="94" r="17" fill="#f6c3cf"/><circle cx="68" cy="92" r="18" fill="#efa6b8"/>
        <circle cx="34" cy="66" r="15" fill="#f8cfd8"/><circle cx="60" cy="66" r="14" fill="#f6c3cf"/><circle cx="48" cy="100" r="15" fill="#f6c3cf"/>
      </g>
      <g fill="#fbe1e7"><circle cx="38" cy="74" r="2.2"/><circle cx="56" cy="84" r="2"/><circle cx="28" cy="92" r="1.8"/><circle cx="64" cy="98" r="2"/><circle cx="48" cy="62" r="1.8"/></g>
      <g class="sp-petals" fill="#f2b2c2"><ellipse cx="74" cy="132" rx="2" ry="1.2" transform="rotate(30 74 132)"/><ellipse cx="20" cy="140" rx="2" ry="1.2" transform="rotate(-20 20 140)"/><ellipse cx="62" cy="148" rx="1.8" ry="1.1"/></g>`,
  },
  windowbox: {
    base: 120,
    box: [214, 100, 26, 24],
    draw: () => `
      <rect x="216" y="116" width="21" height="6" rx="1.5" fill="#c98466" stroke="${OUT}" stroke-width="0.9"/>
      <g fill="#79b07d"><ellipse cx="219" cy="115" rx="3" ry="2"/><ellipse cx="234" cy="115" rx="3" ry="2"/><ellipse cx="226.5" cy="114.5" rx="3" ry="2"/></g>
      <g><circle cx="220" cy="112.5" r="2.6" fill="#eb8978"/><circle cx="226.5" cy="111.5" r="2.8" fill="#f2a6bd"/><circle cx="233" cy="112.5" r="2.6" fill="#eb8978"/></g>
      <g fill="#fff3d6"><circle cx="220" cy="112.5" r="0.9"/><circle cx="226.5" cy="111.5" r="0.9"/><circle cx="233" cy="112.5" r="0.9"/></g>`,
  },
  lamp: {
    base: 198,
    box: [312, 112, 34, 90],
    draw: () => `
      <ellipse cx="331" cy="198" rx="8" ry="2.4" fill="${SHADOW}"/>
      <circle class="sp-glow" cx="321" cy="140" r="15" fill="#fbe3b0" opacity="0.38"/>
      <rect x="329" y="122" width="4" height="76" rx="1.6" fill="#7d5a42"/>
      <path d="M331 124 H318" stroke="#7d5a42" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M319 124 V129" stroke="#5b4030" stroke-width="1"/>
      <rect x="313" y="129" width="12" height="20" rx="5.5" fill="#fbe0a6" stroke="#d8a95a" stroke-width="1"/>
      <path d="M313.6 135 H324.4 M313.6 141 H324.4" stroke="#e6b768" stroke-width="0.9"/>
      <rect x="315.5" y="127.5" width="7" height="2.2" rx="0.8" fill="#b9472f"/><rect x="315.5" y="148.3" width="7" height="2.2" rx="0.8" fill="#b9472f"/>`,
  },
  fountain: {
    base: 182,
    box: [116, 132, 66, 54],
    draw: () => `
      <ellipse cx="149" cy="181" rx="30" ry="5.5" fill="${SHADOW}"/>
      <path d="M121 166 C121 180 177 180 177 166 V170 C177 184 121 184 121 170 Z" fill="#c9cfd3"/>
      <ellipse cx="149" cy="166" rx="28" ry="8" fill="#dfe4e7" stroke="${OUT}" stroke-width="1.1"/>
      <ellipse cx="149" cy="166" rx="23" ry="5.6" fill="#bfe3ea"/>
      <rect x="145" y="148" width="8" height="18" rx="2" fill="#d4dadd" stroke="${OUT}" stroke-width="0.9"/>
      <ellipse cx="149" cy="148" rx="12" ry="3.6" fill="#e6eaec" stroke="${OUT}" stroke-width="1"/>
      <path d="M149 146 C149 138 149 136 149 134" stroke="#bfe3ea" stroke-width="2.4" stroke-linecap="round"/>
      <g class="sp-water" fill="none" stroke="#a9d8e1" stroke-width="1.6" stroke-linecap="round"><path d="M149 136 C141 138 137 144 135 152"/><path d="M149 136 C157 138 161 144 163 152"/><path d="M139 149 C134 152 131 158 130 163"/><path d="M159 149 C164 152 167 158 168 163"/></g>
      <g fill="#fff" opacity="0.8"><circle cx="141" cy="166" r="1"/><circle cx="157" cy="167" r="1.2"/></g>`,
  },
  perch: {
    base: 214,
    box: [76, 128, 42, 90],
    draw: () => `
      <ellipse cx="96" cy="214" rx="18" ry="3.6" fill="${SHADOW}"/>
      <rect x="80" y="204" width="32" height="10" rx="3" fill="#cfa877" stroke="${OUT}" stroke-width="1"/>
      <rect x="91" y="152" width="10" height="53" rx="2" fill="#e8d4aa" stroke="${OUT}" stroke-width="1"/>
      <path d="M91 160 h10 M91 166 h10 M91 172 h10 M91 178 h10 M91 184 h10 M91 190 h10 M91 196 h10" stroke="#cdb383" stroke-width="1"/>
      <rect x="83" y="176" width="20" height="5" rx="2" fill="#cfa877" stroke="${OUT}" stroke-width="0.9"/>
      <rect x="80" y="147" width="32" height="7" rx="3" fill="#cfa877" stroke="${OUT}" stroke-width="1"/>
      <path d="M108 154 V166" stroke="#a88a62" stroke-width="1"/><circle cx="108" cy="168" r="3" fill="#eb8978"/>`,
  },
  fern: {
    base: 152,
    box: [286, 126, 26, 30],
    draw: () => `
      <ellipse cx="299" cy="152" rx="8" ry="2" fill="${SHADOW}"/>
      <g fill="#6fa874"><path d="M299 140 C292 134 287 132 285 128 C291 129 296 132 299 138Z"/><path d="M299 140 C306 133 311 131 314 127 C308 128 302 132 299 138Z"/><path d="M299 139 C298 132 299 128 301 124 C302 130 301 134 300 139Z"/><path d="M299 141 C293 139 289 140 285 140 C290 137 295 137 299 139Z"/><path d="M299 141 C305 139 309 140 313 140 C308 137 303 137 299 139Z"/></g>
      <path d="M292 140 H306 L304 152 H294 Z" fill="#d9875e" stroke="${OUT}" stroke-width="0.9"/>
      <rect x="291" y="139" width="16" height="3" rx="1" fill="#e49a73"/>`,
  },
  rug: {
    base: 222,
    box: [236, 206, 74, 32],
    draw: () => `
      <ellipse cx="273" cy="222" rx="35" ry="12.5" fill="#e9b07f" stroke="${OUT}" stroke-width="1"/>
      <ellipse cx="273" cy="222" rx="28" ry="9.6" fill="#f6dcae"/>
      <ellipse cx="273" cy="222" rx="20" ry="6.8" fill="#8fc1b0"/>
      <ellipse cx="273" cy="222" rx="12" ry="4" fill="#f6dcae"/>
      <g stroke="#d1956a" stroke-width="1" stroke-linecap="round"><path d="M238 222 h-3"/><path d="M308 222 h3"/><path d="M240 216 l-3 -1"/><path d="M306 216 l3 -1"/><path d="M240 228 l-3 1"/><path d="M306 228 l3 1"/></g>`,
  },
  bridge: {
    base: 270,
    box: [14, 236, 60, 44],
    draw: () => `
      <path d="M18 268 C30 250 52 250 68 262 L70 270 C54 260 32 260 20 276 Z" fill="#c99a68" stroke="${OUT}" stroke-width="1"/>
      <path d="M26 264 l3 5 M33 259 l2 6 M41 256 l1 6 M49 256 l0 6 M57 258 l-1 6 M63 261 l-2 6" stroke="#a87b4f" stroke-width="1"/>
      <path d="M20 262 C32 244 54 244 68 256" stroke="#8a6340" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M22 260 V268 M34 250 V259 M46 247 V256 M58 249 V258 M67 255 V262" stroke="#8a6340" stroke-width="2" stroke-linecap="round"/>`,
  },
  blanket: {
    base: 234,
    box: [100, 214, 82, 38],
    draw: () => {
      const pts = '104,233 140,218 180,231 144,248';
      let lines = '';
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const ax = 104 + (140 - 104) * t;
        const ay = 233 + (218 - 233) * t;
        const bx = 144 + (180 - 144) * t;
        const by = 248 + (231 - 248) * t;
        lines += `<path d="M${ax} ${ay} L${bx} ${by}" />`;
        const cx = 104 + (144 - 104) * t;
        const cy = 233 + (248 - 233) * t;
        const dx = 140 + (180 - 140) * t;
        const dy = 218 + (231 - 218) * t;
        lines += `<path d="M${cx} ${cy} L${dx} ${dy}" />`;
      }
      return `<polygon points="${pts}" fill="#fbf6ee" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
        <g stroke="#e58a7d" stroke-width="3.2" opacity="0.55">${lines}</g>
        <polygon points="${pts}" fill="none" stroke="#e58a7d" stroke-width="1.2" stroke-linejoin="round" opacity="0.8"/>`;
    },
  },
  cushion: {
    base: 244,
    box: [298, 222, 42, 28],
    draw: () => `
      <ellipse cx="319" cy="243" rx="20" ry="4" fill="${SHADOW}"/>
      <path d="M300 238 C300 226 338 226 338 238 C338 247 300 247 300 238 Z" fill="#b6d6cd" stroke="${OUT}" stroke-width="1"/>
      <path d="M303 234 C312 230 326 230 335 234" stroke="#d6ebe5" stroke-width="2" fill="none" stroke-linecap="round"/>
      <g fill="#8ab8ab"><circle cx="312" cy="237" r="1.3"/><circle cx="326" cy="237" r="1.3"/><circle cx="319" cy="241" r="1.3"/></g>`,
  },
  bowls: {
    base: 274,
    box: [148, 258, 40, 20],
    draw: () => `
      <ellipse cx="167" cy="274" rx="19" ry="3.4" fill="${SHADOW}"/>
      <path d="M150 266 h15 l-2 7 h-11 z" fill="#287b70" stroke="${OUT}" stroke-width="0.9"/>
      <ellipse cx="157.5" cy="266" rx="7.5" ry="2.2" fill="#3e9286"/><ellipse cx="157.5" cy="266" rx="5.6" ry="1.5" fill="#c99560"/>
      <path d="M169 266 h15 l-2 7 h-11 z" fill="#eb8978" stroke="${OUT}" stroke-width="0.9"/>
      <ellipse cx="176.5" cy="266" rx="7.5" ry="2.2" fill="#f2a294"/><ellipse cx="176.5" cy="266" rx="5.6" ry="1.5" fill="#a4734a"/>`,
  },
  basket: {
    base: 274,
    box: [238, 250, 48, 28],
    draw: () => `
      <ellipse cx="262" cy="274" rx="23" ry="4" fill="${SHADOW}"/>
      <path d="M241 260 C241 278 283 278 283 260 Z" fill="#d4a463" stroke="${OUT}" stroke-width="1"/>
      <g stroke="#b9864a" stroke-width="1" fill="none"><path d="M243 265 C255 270 269 270 281 265"/><path d="M246 270 C257 274 267 274 278 270"/><path d="M251 261 v12 M258 261 v14 M266 261 v14 M273 261 v12"/></g>
      <ellipse cx="262" cy="260" rx="21.5" ry="5" fill="#fff4e2" stroke="#d4a463" stroke-width="2"/>`,
  },
  toys: {
    base: 288,
    box: [312, 262, 36, 30],
    draw: () => `
      <ellipse cx="330" cy="288" rx="16" ry="3" fill="${SHADOW}"/>
      <path d="M338 272 l7 -8" stroke="#f19a3e" stroke-width="4.5" stroke-linecap="round"/><path d="M345 264 l3 -4 M345 264 l4 -1" stroke="#6fa874" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="324" cy="271" r="5.5" fill="#eb8978"/><path d="M319.5 270 C322 268 326 268 328.5 270" stroke="#fff" stroke-width="1" fill="none"/>
      <path d="M330 272 C332 266 336 266 334 262" stroke="#7fb3d5" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M316 274 h28 l-3 13 h-22 z" fill="#d9b277" stroke="${OUT}" stroke-width="1"/>
      <path d="M317 279 h26 M318 283.5 h24" stroke="#bf955a" stroke-width="0.9"/>`,
  },
};

// ------------------------------------------------------------------ residents

interface PetSpot {
  x: number;
  y: number;
  mood: FaceMood;
  /** Where the pet sits when its favorite decoration is out. */
  on?: { decor: DecorId; x: number; y: number };
}

const PET_SPOTS: Record<PetId, PetSpot> = {
  mochi: { x: 319, y: 246, mood: 'sleepy', on: { decor: 'cushion', x: 319, y: 236 } },
  biscuit: { x: 262, y: 272, mood: 'happy', on: { decor: 'basket', x: 262, y: 268 } },
  pip: { x: 98, y: 222, mood: 'happy', on: { decor: 'perch', x: 96, y: 148 } },
  clover: { x: 134, y: 236, mood: 'idle', on: { decor: 'blanket', x: 136, y: 234 } },
  nori: { x: 276, y: 222, mood: 'happy', on: { decor: 'rug', x: 275, y: 222 } },
  peanut: { x: 196, y: 286, mood: 'proud' },
};

/** A static seated resident whose ground contact is (x, y). H = rig box size. */
export function residentFigure(id: PetId, x: number, y: number, H: number, mood: FaceMood): string {
  const P = PET_BY_ID[id];
  const pal = P.palette;
  const cat = P.species === 'cat';
  const bw = H * (cat ? 0.27 : 0.3);
  const bh = H * 0.25;
  const by = y - bh;
  const tail = cat
    ? `<path d="M${x + bw * 0.7} ${y - H * 0.08} C${x + H * 0.44} ${y - H * 0.08} ${x + H * 0.46} ${y - H * 0.42} ${x + H * 0.33} ${y - H * 0.5}" stroke="${pal.fur}" stroke-width="${H * 0.075}" stroke-linecap="round" fill="none"/><path d="M${x + bw * 0.7} ${y - H * 0.08} C${x + H * 0.44} ${y - H * 0.08} ${x + H * 0.46} ${y - H * 0.42} ${x + H * 0.33} ${y - H * 0.5}" stroke="${OUT}" stroke-width="0.8" fill="none" opacity="0.6"/>`
    : `<path d="M${x + bw * 0.8} ${y - H * 0.16} C${x + H * 0.4} ${y - H * 0.2} ${x + H * 0.42} ${y - H * 0.34} ${x + H * 0.38} ${y - H * 0.38}" stroke="${pal.shade}" stroke-width="${H * 0.085}" stroke-linecap="round" fill="none"/>`;
  const body = `
    <ellipse cx="${x}" cy="${y + 0.5}" rx="${bw * 1.25}" ry="${H * 0.06}" fill="${SHADOW}"/>
    <g class="sp-tail">${tail}</g>
    <ellipse cx="${x}" cy="${by}" rx="${bw}" ry="${bh}" fill="${pal.fur}" stroke="${OUT}" stroke-width="1"/>
    <ellipse cx="${x}" cy="${by + bh * 0.15}" rx="${bw * 0.55}" ry="${bh * 0.7}" fill="${pal.muzzle}" opacity="0.9"/>
    <ellipse cx="${x - bw * 0.42}" cy="${y - H * 0.03}" rx="${H * 0.075}" ry="${H * 0.05}" fill="${pal.fur}" stroke="${OUT}" stroke-width="0.9"/>
    <ellipse cx="${x + bw * 0.42}" cy="${y - H * 0.03}" rx="${H * 0.075}" ry="${H * 0.05}" fill="${pal.fur}" stroke="${OUT}" stroke-width="0.9"/>`;
  const k = H / 64;
  const headTop = y - bh * 1.55 - H * 0.82;
  const head = petRigMarkup(id, mood, `translate(${x - H / 2} ${headTop}) scale(${k})`);
  return `<g class="sanctuary__pet" data-pet="${id}" data-name="${P.name}" data-gx="${x}" data-gy="${y}" data-gh="${H}" data-mood="${mood}">${body}${head}${heartAbove(x, headTop - 2)}</g>`;
}

// ------------------------------------------------------------------ scene

export interface SceneState {
  decor: DecorId[];
  pets: PetId[];
  companions?: CompanionId[];
  /** Local evening: a dusk wash and fireflies. */
  evening?: boolean;
}

interface FriendSpot {
  x: number;
  y: number;
  H: number;
  mood: 'idle' | 'happy' | 'sleepy';
  /** Where the companion sits when a decoration is out (Maple naps in the blossom tree). */
  on?: { decor: DecorId; x: number; y: number; H: number };
}

const FRIEND_SPOTS: Partial<Record<CompanionId, FriendSpot>> = {
  juniper: { x: 74, y: 278, H: 34, mood: 'happy' },
  ember: { x: 46, y: 224, H: 40, mood: 'happy' },
  maple: { x: 196, y: 160, H: 32, mood: 'sleepy', on: { decor: 'tree', x: 58, y: 117, H: 32 } },
};

const HARMONY_FIREFLIES: Array<[number, number]> = [
  [70, 150],
  [180, 128],
  [208, 176],
  [300, 170],
  [120, 196],
  [338, 118],
];

export function sanctuaryScene(state: SceneState, id = 'sanct'): string {
  const shown = new Set(state.decor);
  const items: Array<{ base: number; svg: string }> = [];
  for (const d of DECOR) {
    const a = (DECOR_ART as Partial<Record<DecorId, DecorArt>>)[d.id];
    if (a && shown.has(d.id)) items.push({ base: a.base, svg: `<g data-decor="${d.id}">${a.draw()}</g>` });
  }
  for (const p of PETS) {
    if (!state.pets.includes(p.id)) continue;
    const spot = PET_SPOTS[p.id];
    const on = spot.on && shown.has(spot.on.decor) ? spot.on : null;
    const x = on ? on.x : spot.x;
    const y = on ? on.y : spot.y;
    // Pets sit just in front of the thing they sit on.
    items.push({ base: (on ? DECOR_ART[on.decor as HarmonyDecorId].base : y) + 0.5, svg: residentFigure(p.id, x, y, 46, spot.mood) });
  }
  const friends = (state.companions ?? []).filter((c) => c in COMPANION_BY_ID && COMPANION_BY_ID[c].sanctuary === 'harmony');
  if (friends.some((c) => COMPANION_BY_ID[c].habitat === 'woodland')) items.push({ base: 220, svg: woodlandNook() });
  for (const c of COMPANIONS) {
    if (!friends.includes(c.id)) continue;
    const spot = FRIEND_SPOTS[c.id];
    if (!spot) continue;
    const on = spot.on && shown.has(spot.on.decor) ? spot.on : null;
    const fx = on ? on.x : spot.x;
    const fy = on ? on.y : spot.y;
    const H = on ? on.H : spot.H;
    const fig = companionFigure(c.id, fx, fy, H, spot.mood).replace(/<\/g>$/, `${heartAbove(fx, fy - H * 1.25)}</g>`);
    items.push({ base: (on ? DECOR_ART[on.decor as HarmonyDecorId].base : fy) + 0.6, svg: fig });
  }
  items.sort((a, b) => a.base - b.base);
  const evening = state.evening ? dusk(HARMONY_FIREFLIES) : '';
  return backdrop(id) + items.map((i) => i.svg).join('') + evening;
}

/** Standalone icon of one decoration (shop cards, reward sheets). */
export function decorIcon(id: DecorId, label?: string): string {
  const a = (DECOR_ART as Partial<Record<DecorId, DecorArt>>)[id] ?? (REGION_DECOR_ART as Partial<Record<DecorId, DecorArt>>)[id];
  return a ? iconFrom(a, label) : '';
}

/** Every decoration has art (checked by tests). */
export function hasDecorArt(id: DecorId): boolean {
  return id in DECOR_ART || id in REGION_DECOR_ART;
}

export const SCENE_VIEWBOX = '0 0 360 300';
