/**
 * Faces for the 3D toys (D34), painted onto two small canvases: the eyes (with brows, blush and markings) on a shell
 * over the front of the head, and the mouth (with whiskers) on a shell over the muzzle. Expressions swap the painted
 * texture; nothing about the face is a separate 3D part except the nose. Plain canvas 2D: no three.js here.
 *
 * Positions are angles on the head: `phi` across (0 = the middle of the face, + = the viewer's right) and `theta` down
 * from the top of the head (π/2 = the head's equator).
 */

import type { ToySpec } from './species';

export type Expr = 'idle' | 'happy' | 'blink' | 'sleepy' | 'lookL' | 'lookR' | 'surprised' | 'love' | 'stars' | 'laugh' | 'shy' | 'proud' | 'yawn' | 'focused';

export const EXPRESSIONS: readonly Expr[] = [
  'idle',
  'happy',
  'blink',
  'sleepy',
  'lookL',
  'lookR',
  'surprised',
  'love',
  'stars',
  'laugh',
  'shy',
  'proud',
  'yawn',
  'focused',
];

/** The part of the head the eye shell covers. */
export const HEAD_SHELL = { phiLen: 2.1, thetaStart: 0.32, thetaLen: 1.9 } as const;
/** The part of the muzzle the mouth shell covers. */
export const MUZZLE_SHELL = { phiLen: 2.6, thetaStart: 0.55, thetaLen: 2.1 } as const;

const EYE_PX = 256;
const MOUTH_PX = 128;
const INK = '#2F2A27';

/** The resting expression for a 2D mood (residents' `data-mood`, friends' idle/happy/sleepy). */
export function exprForMood(mood: string | undefined): Expr {
  switch (mood) {
    case 'happy':
    case 'celebrate':
      return 'happy';
    case 'sleepy':
      return 'sleepy';
    case 'proud':
      return 'proud';
    case 'curious':
      return 'lookR';
    case 'focused':
    case 'confused':
      return 'focused';
    default:
      return 'idle';
  }
}

interface Mapper {
  x(phi: number): number;
  y(theta: number): number;
  /** Pixels per radian across and down. */
  kx: number;
  ky: number;
}

function mapper(shell: { phiLen: number; thetaStart: number; thetaLen: number }, px: number, aspect: number): Mapper {
  // A wide head stretches the painting sideways; paint narrower to keep circles round.
  const kx = px / shell.phiLen / aspect;
  const ky = px / shell.thetaLen;
  return { x: (phi) => px / 2 + phi * (px / shell.phiLen), y: (theta) => (theta - shell.thetaStart) * ky, kx, ky };
}

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

function stroke(c: CanvasRenderingContext2D, color: string, w: number, draw: () => void): void {
  c.beginPath();
  draw();
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string): void {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y, x - s * 0.9, y - s * 1.1, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.9, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
  c.fillStyle = fill;
  c.fill();
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, edge: string): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = r * 0.14;
  c.lineJoin = 'round';
  c.stroke();
}

/** Paints the eye shell for an expression. Returns false when there is no 2D canvas (tests). */
export function paintEyes(canvas: HTMLCanvasElement, s: ToySpec, e: Expr): boolean {
  canvas.width = canvas.height = EYE_PX;
  const c = canvas.getContext('2d');
  if (!c) return false;
  c.clearRect(0, 0, EYE_PX, EYE_PX);
  const m = mapper(HEAD_SHELL, EYE_PX, s.head[0] / s.head[1]);
  const spread = s.eyes.spacing * (s.eyes.style === 'side' ? 2.6 : 1.42);
  const theta = Math.PI / 2 + 0.06 - s.eyes.y * 2.2;
  const big = s.eyes.style === 'owl' ? 1.35 : s.eyes.style === 'side' ? 1.1 : 1;
  const rx = 0.118 * s.eyes.size * big * m.kx;
  const ry = 0.138 * s.eyes.size * big * m.ky;
  const ey = m.y(theta);
  const eyesX = [m.x(-spread), m.x(spread)];
  const lw = Math.max(3, rx * 0.42);

  // Markings first, under the eyes.
  markings(c, s, m, eyesX, ey, rx, ry);

  // Blush.
  const blushA = e === 'shy' ? 0.85 : e === 'love' || e === 'happy' || e === 'laugh' || e === 'stars' ? 0.6 : 0.35;
  if (s.eyes.style !== 'side' && s.cheek) {
    c.globalAlpha = blushA;
    for (const [i, x] of eyesX.entries()) ellipse(c, x + (i ? 1 : -1) * rx * 1.05, ey + ry * 1.6, rx * 1.15, ry * 0.55, s.cheek);
    c.globalAlpha = 1;
  }

  // Brows (only where they say something).
  if (e === 'surprised' || e === 'focused' || e === 'proud' || e === 'shy') {
    const col = s.brow ?? s.dark;
    for (const [i, x] of eyesX.entries()) {
      const side = i ? 1 : -1;
      const by = ey - ry * (e === 'surprised' ? 2.3 : 1.75);
      stroke(c, col, lw * 0.7, () => {
        if (e === 'focused') {
          c.moveTo(x - side * rx * 0.9, by + ry * 0.1);
          c.lineTo(x + side * rx * 0.8, by + ry * 0.45);
        } else if (e === 'shy') {
          c.moveTo(x - rx * 0.8, by + ry * 0.35);
          c.quadraticCurveTo(x, by + ry * (side > 0 ? -0.05 : 0.05), x + rx * 0.8, by + ry * 0.2);
        } else {
          c.moveTo(x - rx * 0.8, by + ry * 0.2);
          c.quadraticCurveTo(x, by - ry * 0.45, x + rx * 0.8, by + ry * 0.2);
        }
      });
    }
  }

  for (const [i, x] of eyesX.entries()) {
    const side = i ? 1 : -1;
    switch (e) {
      case 'happy':
      case 'proud':
        stroke(c, INK, lw, () => {
          c.moveTo(x - rx * 1.05, ey + ry * 0.35);
          c.quadraticCurveTo(x, ey - ry * 1.1, x + rx * 1.05, ey + ry * 0.35);
        });
        break;
      case 'blink':
        stroke(c, INK, lw * 0.9, () => {
          c.moveTo(x - rx, ey + ry * 0.1);
          c.quadraticCurveTo(x, ey + ry * 0.45, x + rx, ey + ry * 0.1);
        });
        break;
      case 'sleepy':
        stroke(c, INK, lw * 0.9, () => {
          c.moveTo(x - rx * 1.05, ey);
          c.quadraticCurveTo(x, ey + ry * 0.95, x + rx * 1.05, ey);
        });
        break;
      case 'laugh':
      case 'yawn':
        stroke(c, INK, lw, () => {
          c.moveTo(x - side * rx * 0.9, ey - ry * 0.75);
          c.lineTo(x + side * rx * 0.75, ey);
          c.lineTo(x - side * rx * 0.9, ey + ry * 0.75);
        });
        break;
      case 'love':
        heart(c, x, ey, rx * 1.25, '#E8556A');
        ellipse(c, x - rx * 0.45, ey - ry * 0.4, rx * 0.28, ry * 0.2, 'rgba(255,255,255,0.8)');
        break;
      case 'stars':
        star(c, x, ey, Math.max(rx, ry) * 1.35, '#F7C534', '#D9902A');
        break;
      default: {
        const wide = e === 'surprised' ? 1.25 : 1;
        const dx = e === 'lookL' ? -rx * 0.35 : e === 'lookR' ? rx * 0.35 : e === 'shy' ? -rx * 0.35 : 0;
        const dy = e === 'shy' ? ry * 0.3 : 0;
        openEye(c, s, x, ey, rx * wide, ry * wide, dx, dy);
        if (e === 'focused') {
          // A flat upper lid: the top of the eye hidden behind a line.
          c.save();
          c.globalCompositeOperation = 'destination-out';
          c.fillRect(x - rx * 1.6, ey - ry * 1.6, rx * 3.2, ry * 1.15);
          c.restore();
          stroke(c, INK, lw * 0.8, () => {
            c.moveTo(x - rx * 1.1, ey - ry * 0.42);
            c.lineTo(x + rx * 1.1, ey - ry * 0.42);
          });
        }
      }
    }
  }
  return true;
}

function openEye(c: CanvasRenderingContext2D, s: ToySpec, x: number, y: number, rx: number, ry: number, dx: number, dy: number): void {
  if (s.eyes.style === 'owl' || s.eyes.style === 'side' || s.eyes.style === 'iris') {
    const ring = s.eyes.style === 'owl' ? INK : s.eyes.style === 'side' ? (s.eyes.iris ?? '#6CC3E8') : INK;
    const iris = s.eyes.iris ?? '#F2C230';
    const r = Math.min(rx, ry);
    ellipse(c, x, y, r * 1.12, r * 1.12, ring);
    ellipse(c, x, y, r, r, s.eyes.style === 'side' ? INK : iris);
    if (s.eyes.style !== 'side')
      ellipse(c, x + dx * 0.6, y + dy * 0.6, r * (s.eyes.style === 'iris' ? 0.32 : 0.5), r * (s.eyes.style === 'iris' ? 0.78 : 0.5), INK);
    ellipse(c, x + r * 0.32 + dx * 0.4, y - r * 0.38, r * 0.24, r * 0.24, '#fff');
    return;
  }
  ellipse(c, x + dx, y + dy, rx, ry, s.eyes.color);
  ellipse(c, x + dx + rx * 0.32, y + dy - ry * 0.36, rx * 0.34, ry * 0.3, '#fff');
  ellipse(c, x + dx - rx * 0.3, y + dy + ry * 0.4, rx * 0.15, ry * 0.13, 'rgba(255,255,255,0.85)');
}

function markings(c: CanvasRenderingContext2D, s: ToySpec, m: Mapper, eyesX: number[], ey: number, rx: number, ry: number): void {
  const col = s.markColor ?? s.shade;
  const top = m.y(0.55);
  switch (s.marking) {
    case 'tabby':
      for (const dx of [-0.16, 0, 0.16])
        stroke(c, col, rx * 0.5, () => {
          c.moveTo(m.x(dx), top);
          c.lineTo(m.x(dx * 0.7), top + (dx ? ry * 1.4 : ry * 1.9));
        });
      for (const [i, x] of eyesX.entries()) {
        const side = i ? 1 : -1;
        stroke(c, col, rx * 0.4, () => {
          c.moveTo(x + side * rx * 1.6, ey + ry * 0.2);
          c.lineTo(x + side * rx * 2.8, ey - ry * 0.1);
        });
      }
      break;
    case 'mask':
      c.globalAlpha = 0.55;
      for (const x of eyesX) ellipse(c, x, ey + ry * 0.05, rx * 2.1, ry * 1.6, col);
      c.globalAlpha = 1;
      break;
    case 'patch':
      ellipse(c, eyesX[0], ey, rx * 2.1, ry * 1.9, col);
      break;
    case 'redpanda':
      for (const [i, x] of eyesX.entries()) {
        ellipse(c, x + (i ? 0.4 : -0.4) * rx, ey - ry * 1.9, rx * 0.95, ry * 0.55, col);
        ellipse(c, x + (i ? 1.6 : -1.6) * rx, ey + ry * 1.25, rx * 1.1, ry * 0.9, col);
      }
      break;
    case 'meerkat':
      for (const [i, x] of eyesX.entries()) {
        c.save();
        c.translate(x, ey + ry * 0.2);
        c.rotate((i ? -1 : 1) * 0.35);
        ellipse(c, 0, 0, rx * 1.65, ry * 1.55, col);
        c.restore();
      }
      break;
    case 'sloth': {
      ellipse(c, m.x(0), ey + ry * 0.6, Math.abs(eyesX[1] - eyesX[0]) * 1.05, ry * 3.3, s.light);
      for (const [i, x] of eyesX.entries()) {
        c.save();
        c.translate(x + (i ? 1 : -1) * rx * 0.6, ey + ry * 0.35);
        c.rotate((i ? 1 : -1) * 0.45);
        ellipse(c, 0, 0, rx * 2.1, ry * 0.95, col);
        c.restore();
      }
      break;
    }
    case 'blaze': {
      // A white stripe from the forelock down to the muzzle (pony), a little wider at the bottom.
      const x = m.x(0);
      const y0 = top + ry * 0.6;
      const y1 = ey + ry * 2.4;
      c.beginPath();
      c.moveTo(x - rx * 0.45, y0);
      c.quadraticCurveTo(x, y0 - ry * 0.5, x + rx * 0.45, y0);
      c.lineTo(x + rx * 0.75, y1);
      c.quadraticCurveTo(x, y1 + ry * 0.6, x - rx * 0.75, y1);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      break;
    }
    case 'cowpatch':
      // A calf's patch over the top of the head on its right side.
      c.globalAlpha = 0.95;
      ellipse(c, eyesX[1] + rx * 1.6, top + ry * 0.4, rx * 3, ry * 2.1, col);
      c.globalAlpha = 1;
      break;
    case 'owl':
      c.globalAlpha = 0.7;
      for (const [x, y] of [
        [-0.25, 0.75],
        [0.05, 0.62],
        [0.3, 0.8],
        [-0.05, 0.9],
      ])
        ellipse(c, m.x(x), m.y(y), rx * 0.32, ry * 0.18, col);
      c.globalAlpha = 1;
      break;
    default:
  }
}

/** Paints the mouth shell (mouth and whiskers) for an expression. */
export function paintMouth(canvas: HTMLCanvasElement, s: ToySpec, e: Expr): boolean {
  canvas.width = canvas.height = MOUTH_PX;
  const c = canvas.getContext('2d');
  if (!c) return false;
  c.clearRect(0, 0, MOUTH_PX, MOUTH_PX);
  if (s.mouth === 'none') return true;
  const m = mapper(MUZZLE_SHELL, MOUTH_PX, 1.25);
  const cx = m.x(0);
  const y0 = m.y(Math.PI / 2 + 0.22);
  const w = MOUTH_PX * 0.13;
  const lw = Math.max(2.5, MOUTH_PX * 0.028);

  if (s.extras?.includes('whiskers')) {
    c.globalAlpha = 0.6;
    for (const side of [-1, 1]) for (const k of [0, 1, 2]) ellipse(c, cx + side * w * (0.95 + k * 0.32), y0 - w * 0.55 + k * w * 0.2, 1.6, 1.6, s.dark);
    c.globalAlpha = 1;
  }

  const open = e === 'laugh' || e === 'yawn' || e === 'surprised' || e === 'stars';
  if (open) {
    const ow = e === 'surprised' ? w * 0.45 : e === 'yawn' ? w * 0.75 : w * 0.85;
    const oh = e === 'surprised' ? w * 0.55 : e === 'yawn' ? w * 1.15 : w * 0.8;
    c.beginPath();
    if (e === 'surprised') c.ellipse(cx, y0 + oh * 0.4, ow, oh, 0, 0, Math.PI * 2);
    else {
      c.moveTo(cx - ow, y0 - oh * 0.1);
      c.quadraticCurveTo(cx, y0 - oh * 0.35, cx + ow, y0 - oh * 0.1);
      c.quadraticCurveTo(cx + ow * 0.95, y0 + oh * 1.25, cx, y0 + oh * 1.3);
      c.quadraticCurveTo(cx - ow * 0.95, y0 + oh * 1.25, cx - ow, y0 - oh * 0.1);
    }
    c.fillStyle = '#7A3B3B';
    c.fill();
    if (e !== 'surprised') ellipse(c, cx, y0 + oh * 0.95, ow * 0.62, oh * 0.32, '#F08A8E');
    return true;
  }

  const happy = e === 'happy' || e === 'love' || e === 'proud' || e === 'shy';
  if (s.mouth === 'cat') {
    stroke(c, INK, lw, () => {
      c.moveTo(cx, y0 - w * 0.45);
      c.lineTo(cx, y0 - w * 0.1);
      c.moveTo(cx - w * (happy ? 0.75 : 0.6), y0 - w * (happy ? 0.25 : 0.1));
      c.quadraticCurveTo(cx - w * 0.3, y0 + w * (happy ? 0.45 : 0.3), cx, y0 - w * 0.1);
      c.quadraticCurveTo(cx + w * 0.3, y0 + w * (happy ? 0.45 : 0.3), cx + w * (happy ? 0.75 : 0.6), y0 - w * (happy ? 0.25 : 0.1));
    });
    return true;
  }
  if (s.mouth === 'dog') {
    if (happy) {
      ellipse(c, cx, y0 + w * 0.42, w * 0.32, w * 0.42, '#F08A8E');
      stroke(c, '#D9707A', lw * 0.6, () => {
        c.moveTo(cx, y0 + w * 0.12);
        c.lineTo(cx, y0 + w * 0.55);
      });
    }
    stroke(c, INK, lw, () => {
      c.moveTo(cx, y0 - w * 0.5);
      c.lineTo(cx, y0 - w * 0.05);
      c.moveTo(cx - w * (happy ? 0.85 : 0.65), y0 - w * (happy ? 0.3 : 0.12));
      c.quadraticCurveTo(cx, y0 + w * (happy ? 0.55 : 0.32), cx + w * (happy ? 0.85 : 0.65), y0 - w * (happy ? 0.3 : 0.12));
    });
    return true;
  }
  stroke(c, INK, lw, () => {
    const hw = w * (happy ? 0.62 : 0.4);
    c.moveTo(cx - hw, y0 - w * 0.05);
    c.quadraticCurveTo(cx, y0 + w * (happy ? 0.55 : 0.25), cx + hw, y0 - w * 0.05);
  });
  return true;
}
