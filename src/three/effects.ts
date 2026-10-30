/**
 * Props and particles that go with a clip (D34): the emote bubble beside the head, and each trick's or emote's own
 * things: a shower of stars, a glassy bubble, a rainbow that paints itself, juggled stars, hearts, notes, Zs, confetti,
 * a party hat. All 3D (or camera-facing sprites), all following the animal, all gone when the clip ends. Under reduced
 * motion only the emote bubble shows, still.
 */

import * as THREE from 'three';
import { TRICK_BY_ID, isTrickId, type EmoteGlyph } from '../meta/catalogs/tricks';
import { glyph } from '../ui/art/tricks';
import type { Actor } from './actor';
import { easeOutBack } from './clips';
import { bump, clamp01, easeInOut, hold, seg } from './pose';
import type { ToyKit } from './toy';

export interface Effect {
  /** Returns false when finished. */
  update(now: number): boolean;
  dispose(): void;
}

export interface FxCtx {
  fx: Effects;
  actor: Actor;
  start: number;
  ms: number;
  /** Scene units per toy unit. */
  u: number;
  /** Reduced motion: shown in place, nothing travels. */
  still: boolean;
}

export type EffectFactory = (c: FxCtx) => Effect | null;

const registry = new Map<string, EffectFactory>();

/** Registers the effect for an ambient action (`ambient:love`) or a trick or emote (`perform:backflip`). */
export function defineEffect(id: string, f: EffectFactory): void {
  registry.set(id, f);
}

/** Whether a clip has props of its own (tests). */
export function hasEffect(id: string): boolean {
  return registry.has(id);
}

interface Live {
  e: Effect;
  actor: Actor;
  kind: 'ambient' | 'perform';
}

export class Effects {
  private live: Live[] = [];
  private geo = new Map<string, THREE.BufferGeometry>();
  private tex = new Map<string, THREE.Texture>();

  constructor(
    readonly scene: THREE.Scene,
    readonly kit: ToyKit,
  ) {}

  /** An ambient action's little extra (a heart for a pat); in place under reduced motion. */
  ambient(action: string, actor: Actor, now: number, ms: number, still = false): void {
    this.run(`ambient:${action}`, 'ambient', actor, now, ms, still);
  }

  /** A trick or emote: the emote bubble, and its props unless `still`. It replaces the actor's previous one. */
  perform(id: string, actor: Actor, now: number, ms: number, still: boolean): void {
    this.clearFor(actor, 'perform');
    if (isTrickId(id)) this.live.push({ e: emoteBubble({ fx: this, actor, start: now, ms, u: unit(actor), still }, TRICK_BY_ID[id].emote, still), actor, kind: 'perform' });
    if (!still) this.run(`perform:${id}`, 'perform', actor, now, ms, still);
  }

  private run(key: string, kind: Live['kind'], actor: Actor, now: number, ms: number, still: boolean): void {
    const e = registry.get(key)?.({ fx: this, actor, start: now, ms, u: unit(actor), still });
    if (e) this.live.push({ e, actor, kind });
  }

  /** Ends an actor's effects (all, or one kind): it left, or something new replaces them. */
  clearFor(actor: Actor, kind?: Live['kind']): void {
    this.live = this.live.filter((l) => {
      if (l.actor !== actor || (kind && l.kind !== kind)) return true;
      l.e.dispose();
      return false;
    });
  }

  get active(): boolean {
    return this.live.length > 0;
  }

  update(now: number): void {
    this.live = this.live.filter((l) => {
      const alive = l.e.update(now);
      if (!alive) l.e.dispose();
      return alive;
    });
  }

  /** Ends every effect. */
  clear(): void {
    for (const l of this.live) l.e.dispose();
    this.live = [];
  }

  /** A shared geometry, built once. */
  shape(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.geo.get(key);
    if (!g) {
      g = build();
      this.geo.set(key, g);
    }
    return g;
  }

  /** A shared canvas texture, drawn once (may finish drawing later, for images). */
  texture(key: string, draw: (c: HTMLCanvasElement, done: () => void) => void, size = 128): THREE.Texture {
    let t = this.tex.get(key);
    if (!t) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ct = new THREE.CanvasTexture(canvas);
      ct.colorSpace = THREE.SRGBColorSpace;
      draw(canvas, () => (ct.needsUpdate = true));
      t = ct;
      this.tex.set(key, t);
    }
    return t;
  }

  /** A glossy material of the effect's own (props are shiny; the toys are plush). The effect disposes it. */
  shiny(color: string, emissive = 0.15): THREE.MeshStandardMaterial {
    const c = new THREE.Color(color);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.05, emissive: c, emissiveIntensity: emissive, transparent: true });
  }

  /** A camera-facing picture (notes, Zs, "ha!"). */
  sprite(tex: THREE.Texture): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.scene.add(s);
    return s;
  }

  dispose(): void {
    this.clear();
    for (const g of this.geo.values()) g.dispose();
    for (const t of this.tex.values()) t.dispose();
    this.geo.clear();
    this.tex.clear();
  }
}

// ------------------------------------------------------------------ shapes and pictures

export function heartGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9);
  s.bezierCurveTo(-1.4, 0, -0.9, 1.1, 0, 0.35);
  s.bezierCurveTo(0.9, 1.1, 1.4, 0, 0, -0.9);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.16, bevelSegments: 4, curveSegments: 16 });
  g.center();
  return g;
}

export function starGeometry(points = 5, inner = 0.45): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? inner : 1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 3 });
  g.center();
  return g;
}

const images = new Map<string, Promise<HTMLImageElement>>();
/** An emote badge as an image (the same art as the 2D badges), loaded once. */
function glyphImage(g: EmoteGlyph): Promise<HTMLImageElement> {
  let p = images.get(g);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">${glyph(g, 12, 12, 18)}</svg>`)}`;
    });
    images.set(g, p);
  }
  return p;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function bubbleTexture(fx: Effects, g: EmoteGlyph, left: boolean): THREE.Texture {
  return fx.texture(`bubble:${g}:${left}`, (canvas, done) => {
    const c = canvas.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 128, 128);
    c.fillStyle = '#ffffff';
    c.strokeStyle = 'rgba(40,52,52,0.22)';
    c.lineWidth = 3;
    roundRect(c, 10, 8, 108, 92, 34);
    c.fill();
    c.stroke();
    // The little tail points at the head.
    c.beginPath();
    const tx = left ? 92 : 36;
    c.moveTo(tx - 12, 96);
    c.lineTo(tx + (left ? 18 : -18), 122);
    c.lineTo(tx + 12, 96);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(tx - 12, 97);
    c.lineTo(tx + (left ? 18 : -18), 122);
    c.lineTo(tx + 12, 97);
    c.stroke();
    c.fillRect(tx - 14, 90, 28, 8);
    void glyphImage(g)
      .then((img) => {
        c.drawImage(img, 22, 12, 84, 84);
        done();
      })
      .catch(() => done());
    done();
  });
}

function textTexture(fx: Effects, text: string, color: string): THREE.Texture {
  return fx.texture(
    `text:${text}:${color}`,
    (canvas, done) => {
      const c = canvas.getContext('2d');
      if (!c) return;
      c.clearRect(0, 0, 128, 128);
      c.font = `700 ${text.length > 2 ? 54 : 84}px Fredoka, "Nunito Sans", ui-rounded, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 10;
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.strokeText(text, 64, 68);
      c.fillStyle = color;
      c.fillText(text, 64, 68);
      done();
    },
    128,
  );
}

/** Scene units per toy unit for an actor (its scale on stage). */
export function unit(a: Actor): number {
  return a.toy.root.scale.x;
}

const V = () => new THREE.Vector3();
const tmp = V();
const tmp2 = V();

function fadeOut(t: number, from = 0.85): number {
  return t < from ? 1 : 1 - clamp01((t - from) / (1 - from));
}

/** Several meshes or sprites that share a lifetime. */
function group(items: Array<THREE.Object3D & { material: THREE.Material | THREE.Material[] }>, step: (t: number) => void, c: FxCtx, ownMaterials = true): Effect {
  return {
    update(now) {
      const t = (now - c.start) / c.ms;
      if (t >= 1) return false;
      step(t);
      return true;
    },
    dispose() {
      for (const it of items) {
        it.removeFromParent();
        if (ownMaterials) (Array.isArray(it.material) ? it.material : [it.material]).forEach((m) => m.dispose());
      }
    },
  };
}

// ------------------------------------------------------------------ the emote bubble

function emoteBubble(c: FxCtx, g: EmoteGlyph, still: boolean): Effect {
  // On the side of the head facing the middle of the scene, so it stays in the frame.
  const left = c.actor.dir < 0;
  const s = c.fx.sprite(bubbleTexture(c.fx, g, left));
  s.renderOrder = 10;
  s.material.depthTest = false;
  const ms = Math.max(c.ms, still ? 1800 : 0);
  return {
    update(now) {
      const t = (now - c.start) / ms;
      if (t >= 1) return false;
      c.actor.toy.headTop(tmp);
      const pop = still ? 1 : easeOutBack(clamp01(t / 0.1));
      const size = c.u * 0.44 * pop;
      s.scale.set(size, size, 1);
      s.position.set(tmp.x + (left ? -1 : 1) * c.u * 0.38, tmp.y + c.u * 0.16, tmp.z + c.u * 0.3);
      s.material.opacity = fadeOut(t, 0.86);
      return true;
    },
    dispose() {
      s.removeFromParent();
      s.material.dispose();
    },
  };
}

// ------------------------------------------------------------------ ambient extras

defineEffect('ambient:love', (c) => {
  const mesh = new THREE.Mesh(c.fx.shape('heart', heartGeometry), c.fx.shiny('#E8556A', 0.25));
  c.fx.scene.add(mesh);
  return group(
    [mesh],
    (t) => {
      c.actor.toy.headTop(tmp);
      if (c.still) {
        // Reduced motion: the heart shows in place, still (like the drawn one).
        mesh.position.set(tmp.x + c.u * 0.12, tmp.y + c.u * 0.18, tmp.z + c.u * 0.2);
        mesh.scale.setScalar(c.u * 0.085);
        return;
      }
      mesh.position.set(tmp.x + c.u * 0.12, tmp.y + c.u * (0.12 + t * 0.35), tmp.z + c.u * 0.2);
      mesh.scale.setScalar(c.u * 0.085 * (0.5 + 0.5 * easeOutBack(clamp01(t / 0.2))));
      mesh.rotation.y = Math.sin(t * Math.PI * 2) * 0.6;
      mesh.material.opacity = fadeOut(t, 0.75);
    },
    c,
  );
});

// ------------------------------------------------------------------ trick props

/** Little dust puffs on the ground (landings, a roll). */
function dust(c: FxCtx, at: number[]): Effect {
  const puffs: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  for (let i = 0; i < at.length * 4; i++) {
    const m = new THREE.Mesh(c.fx.kit.lowSphere, new THREE.MeshStandardMaterial({ color: '#F4EFE4', roughness: 1, transparent: true, depthWrite: false }));
    c.fx.scene.add(m);
    puffs.push(m);
  }
  return group(puffs, (t) => {
    c.actor.toy.groundAt(tmp);
    puffs.forEach((p, i) => {
      const k = Math.floor(i / 4);
      const life = (t - at[k]) / 0.22;
      p.visible = life > 0 && life < 1;
      if (!p.visible) return;
      const side = i % 2 ? 1 : -1;
      const far = 0.15 + ((i % 4) >> 1) * 0.12;
      p.position.set(tmp.x + side * c.u * (far + life * 0.18), tmp.y + c.u * (0.03 + life * 0.06), tmp.z + c.u * (0.15 - (i % 3) * 0.08));
      p.scale.setScalar(c.u * (0.035 + life * 0.05));
      p.material.opacity = 0.85 * (1 - life);
    });
  }, c);
}

defineEffect('perform:hop', (c) => dust(c, [0.4, 0.86]));
defineEffect('perform:rollover', (c) => dust(c, [0.14, 0.62]));

/** Twinkling stars that pop and fade around a point. */
function sparkles(c: FxCtx, from: number, to: number, where: (out: THREE.Vector3) => THREE.Vector3, n = 4, colors = ['#F7C534', '#FFF3B0', '#F4A6D0']): Effect {
  const stars = Array.from({ length: n }, (_, i) => {
    const m = new THREE.Mesh(c.fx.shape('star', () => starGeometry()), c.fx.shiny(colors[i % colors.length], 0.45));
    c.fx.scene.add(m);
    return m;
  });
  return group(stars, (t) => {
    where(tmp);
    stars.forEach((s, i) => {
      const a = (i / n) * Math.PI * 2 + 0.6;
      const w = bump(t, from + i * 0.03, from + i * 0.03 + (to - from) * 0.35, to);
      s.visible = w > 0.01;
      s.position.set(tmp.x + Math.cos(a) * c.u * 0.3, tmp.y + Math.sin(a) * c.u * 0.22 + c.u * 0.05, tmp.z + c.u * 0.25);
      s.scale.setScalar(c.u * 0.05 * w);
      s.rotation.z = t * 6 + i;
    });
  }, c);
}

defineEffect('perform:bow', (c) => sparkles(c, 0.74, 1, (o) => c.actor.toy.headTop(o), 3));

defineEffect('perform:dance', (c) => {
  const colors = ['#287b70', '#c96f8a', '#5b6b8a', '#c98a2a'];
  const notes = colors.map((col, i) => c.fx.sprite(textTexture(c.fx, i % 2 ? '♫' : '♪', col)));
  return group(notes, (t) => {
    c.actor.toy.headTop(tmp);
    notes.forEach((n, i) => {
      const life = (t - (0.04 + i * 0.2)) / 0.42;
      n.visible = life > 0 && life < 1;
      if (!n.visible) return;
      const side = i % 2 ? 1 : -1;
      n.position.set(tmp.x + side * c.u * (0.32 + Math.sin(life * 6) * 0.05), tmp.y + c.u * (-0.05 + life * 0.45), tmp.z + c.u * 0.2);
      n.scale.setScalar(c.u * 0.2 * easeOutBack(clamp01(life / 0.25)));
      n.material.opacity = fadeOut(life, 0.7);
    });
  }, c);
});

defineEffect('perform:backflip', (c) => {
  const colors = ['#F7C534', '#FFF3B0', '#F7C534', '#F4A6D0', '#9FE0E6', '#F7C534', '#FFF3B0'];
  const stars = colors.map((col) => {
    const m = new THREE.Mesh(c.fx.shape('star', () => starGeometry()), c.fx.shiny(col, 0.45));
    c.fx.scene.add(m);
    return m;
  });
  return group(stars, (t) => {
    c.actor.toy.groundAt(tmp);
    const life = (t - 0.64) / 0.36;
    stars.forEach((s, i) => {
      s.visible = life > 0;
      if (!s.visible) return;
      const a = Math.PI * (0.04 + (i / (stars.length - 1)) * 0.92);
      const r = c.u * (0.35 + easeInOut(life) * 0.55);
      s.position.set(tmp.x + Math.cos(a) * r, tmp.y + Math.sin(a) * r * 0.75 + c.u * 0.04, tmp.z + c.u * ((i % 2) * 0.2 - 0.05));
      s.scale.setScalar(c.u * 0.085 * (life < 0.2 ? easeOutBack(life / 0.2) : 1 - ((life - 0.2) / 0.8) * 0.7));
      s.rotation.set(life * 4, life * 6 + i, life * 3);
      s.material.opacity = fadeOut(life, 0.6);
    });
  }, c);
});

const BUBBLE_VERT = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const BUBBLE_FRAG = `uniform float opacity; uniform float time; varying vec3 vN; varying vec3 vV;
void main(){
  float f = pow(1.0 - abs(dot(vN, vV)), 2.0);
  vec3 a = vec3(0.72, 0.9, 1.0); vec3 b = vec3(1.0, 0.82, 0.95); vec3 d = vec3(0.85, 1.0, 0.82);
  float k = 0.5 + 0.5 * sin(time * 2.0 + vN.y * 5.0 + vN.x * 3.0);
  vec3 col = mix(mix(a, b, k), d, 0.5 + 0.5 * sin(time * 1.3 + vN.x * 4.0) * f);
  float spec = pow(max(dot(normalize(vN), normalize(vec3(-0.4, 0.6, 0.7))), 0.0), 40.0);
  gl_FragColor = vec4(col + spec, (0.06 + f * 0.8 + spec) * opacity);
}`;

defineEffect('perform:bubble', (c) => {
  const mat = new THREE.ShaderMaterial({ vertexShader: BUBBLE_VERT, fragmentShader: BUBBLE_FRAG, uniforms: { opacity: { value: 0 }, time: { value: 0 } }, transparent: true, depthWrite: false });
  const ball = new THREE.Mesh(c.fx.kit.sphere, mat);
  ball.renderOrder = 5;
  c.fx.scene.add(ball);
  const drops = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(c.fx.kit.lowSphere, new THREE.MeshStandardMaterial({ color: '#CFEAF7', roughness: 0.2, transparent: true }));
    c.fx.scene.add(m);
    return m;
  });
  let popAt: THREE.Vector3 | null = null;
  return group([ball, ...drops], (t) => {
    c.actor.toy.centerAt(tmp);
    const r = c.u * 0.62;
    const grow = easeOutBack(seg(t, 0.04, 0.16));
    const pop = seg(t, 0.86, 0.94);
    ball.visible = t < 0.94;
    ball.position.copy(tmp);
    const wob = 1 + Math.sin(t * 40) * 0.015;
    ball.scale.set(r * grow * wob * (1 + pop * 0.35), r * grow * (2 - wob) * (1 + pop * 0.35), r * grow * (1 + pop * 0.35));
    mat.uniforms.opacity.value = grow * (1 - pop);
    mat.uniforms.time.value = t * 8;
    if (t >= 0.86 && !popAt) popAt = tmp.clone();
    drops.forEach((d, i) => {
      const life = seg(t, 0.86, 1);
      d.visible = !!popAt && life > 0 && life < 1;
      if (!d.visible || !popAt) return;
      const a = (i / drops.length) * Math.PI * 2;
      d.position.set(popAt.x + Math.cos(a) * r * (0.9 + life * 0.6), popAt.y + Math.sin(a) * r * (0.9 + life * 0.6) - life * life * c.u * 0.3, popAt.z + Math.sin(a * 3) * r * 0.3);
      d.scale.setScalar(c.u * 0.03 * (1 - life * 0.6));
      d.material.opacity = 1 - life;
    });
  }, c);
});

defineEffect('perform:juggle', (c) => {
  const cols = ['#F7C534', '#F4A6D0', '#9FE0E6'];
  const stars = cols.map((col) => {
    const m = new THREE.Mesh(c.fx.shape('star', () => starGeometry()), c.fx.shiny(col, 0.4));
    c.fx.scene.add(m);
    return m;
  });
  return group(stars, (t) => {
    c.actor.toy.headTop(tmp);
    const w = hold(t, 0.06, 0.94, 0.08);
    stars.forEach((s, i) => {
      const cyc = (seg(t, 0.08, 0.92) * 3 + i / 3) % 1;
      const pass = Math.floor(seg(t, 0.08, 0.92) * 3 + i / 3) % 2;
      const x = (pass ? 1 : -1) * (cyc * 2 - 1) * c.u * 0.36;
      s.position.set(tmp.x + x, tmp.y - c.u * 0.12 + Math.sin(cyc * Math.PI) * c.u * 0.5, tmp.z + c.u * 0.3);
      s.scale.setScalar(c.u * 0.09 * w);
      s.rotation.set(0, t * 8, t * 10 + i);
      s.visible = w > 0.02;
    });
  }, c);
});

defineEffect('perform:rainbow', (c) => {
  const colors = ['#E8707A', '#F6A23A', '#F2C230', '#6FB07C', '#5B9BC4', '#9B7FD0'];
  c.actor.toy.groundAt(tmp);
  const from = tmp.clone();
  const span = c.u * 0.95 * c.actor.dir;
  const bands = colors.map((col, i) => {
    const rx = Math.abs(span) / 2 + c.u * (0.06 - i * 0.045);
    const ry = c.u * (0.78 - i * 0.045);
    const cx = from.x + span / 2;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 40; k++) {
      // From the animal's side to where it lands.
      const a = c.actor.dir > 0 ? Math.PI - (k / 40) * Math.PI : (k / 40) * Math.PI;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * rx, from.y + Math.sin(a) * ry, from.z - c.u * 0.28));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, c.u * 0.026, 8, false);
    const m = new THREE.Mesh(geo, c.fx.shiny(col, 0.35));
    m.userData.indexCount = geo.index!.count;
    c.fx.scene.add(m);
    return m;
  });
  const burst = sparkles(c, 0.58, 0.9, (o) => o.set(from.x + span, from.y + c.u * 0.12, from.z));
  const e = group(bands, (t) => {
    const reveal = easeInOut(seg(t, 0.02, 0.42));
    for (const b of bands) {
      b.geometry.setDrawRange(0, Math.floor((b.userData.indexCount / 6) * reveal) * 6);
      b.material.opacity = fadeOut(t, 0.82);
    }
  }, c);
  return {
    update: (now) => burst.update(now) && e.update(now),
    dispose() {
      burst.dispose();
      e.dispose();
      for (const b of bands) b.geometry.dispose();
    },
  };
});

// ------------------------------------------------------------------ emote props

function floaters(c: FxCtx, make: (i: number) => THREE.Object3D & { material: THREE.Material }, n: number, opts: { from: number; every: number; life: number; spread: number; rise: number; size: number; sway?: number; spin?: boolean }): Effect {
  const items = Array.from({ length: n }, (_, i) => make(i));
  return group(items, (t) => {
    c.actor.toy.headTop(tmp);
    items.forEach((it, i) => {
      const life = (t - (opts.from + i * opts.every)) / opts.life;
      it.visible = life > 0 && life < 1;
      if (!it.visible) return;
      const side = i % 2 ? 1 : -1;
      it.position.set(tmp.x + side * c.u * (opts.spread + Math.sin(life * 5 + i) * (opts.sway ?? 0.04)), tmp.y + c.u * (life * opts.rise), tmp.z + c.u * 0.25);
      it.scale.setScalar(c.u * opts.size * easeOutBack(clamp01(life / 0.22)));
      if (opts.spin) it.rotation.y = Math.sin(life * 6 + i) * 0.7;
      (it.material as THREE.Material & { opacity: number }).opacity = fadeOut(life, 0.65);
    });
  }, c);
}

defineEffect('perform:love', (c) =>
  floaters(
    c,
    (i) => {
      const m = new THREE.Mesh(c.fx.shape('heart', heartGeometry), c.fx.shiny(i % 2 ? '#F28BA0' : '#E8556A', 0.3));
      c.fx.scene.add(m);
      return m;
    },
    5,
    { from: 0.04, every: 0.13, life: 0.42, spread: 0.3, rise: 0.5, size: 0.085, spin: true },
  ),
);

defineEffect('perform:laugh', (c) =>
  floaters(c, (i) => c.fx.sprite(textTexture(c.fx, i % 2 ? 'hee' : 'ha!', '#C98A2A')), 4, { from: 0.06, every: 0.2, life: 0.34, spread: 0.42, rise: 0.3, size: 0.34, sway: 0.03 }),
);

defineEffect('perform:sleepy', (c) =>
  floaters(c, (i) => c.fx.sprite(textTexture(c.fx, i % 2 ? 'Z' : 'z', '#5b6b8a')), 4, { from: 0.32, every: 0.14, life: 0.4, spread: 0.3, rise: 0.45, size: 0.28, sway: 0.07 }),
);

defineEffect('perform:shy', (c) =>
  floaters(
    c,
    () => {
      const m = new THREE.Mesh(c.fx.shape('heart', heartGeometry), c.fx.shiny('#F6A6B8', 0.3));
      c.fx.scene.add(m);
      return m;
    },
    2,
    { from: 0.25, every: 0.22, life: 0.4, spread: 0.34, rise: 0.28, size: 0.055, spin: true },
  ),
);

defineEffect('perform:surprised', (c) => {
  // A quick ring that bursts out behind the head.
  const ring = new THREE.Mesh(c.fx.shape('ring', () => new THREE.TorusGeometry(1, 0.06, 8, 40)), c.fx.shiny('#FFFFFF', 0.6));
  c.fx.scene.add(ring);
  return group([ring], (t) => {
    c.actor.toy.headTop(tmp);
    const life = seg(t, 0.04, 0.36);
    ring.visible = life > 0 && life < 1;
    ring.position.set(tmp.x, tmp.y - c.u * 0.2, tmp.z - c.u * 0.15);
    ring.scale.setScalar(c.u * (0.3 + life * 0.5));
    ring.material.opacity = 0.9 * (1 - life);
  }, c);
});

/** Confetti: little paper squares that burst up, tumble and fall. */
function confetti(c: FxCtx, bursts: number[], where: (out: THREE.Vector3) => THREE.Vector3, n = 22): Effect {
  const cols = ['#E8707A', '#F2C230', '#6FB07C', '#5B9BC4', '#9B7FD0', '#F6A23A'];
  const geo = c.fx.shape('confetti', () => new THREE.PlaneGeometry(1, 0.6));
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, transparent: true });
  const mesh = new THREE.InstancedMesh(geo, mat, n * bursts.length);
  const color = new THREE.Color();
  const pieces = Array.from({ length: n * bursts.length }, (_, i) => {
    mesh.setColorAt(i, color.set(cols[i % cols.length]));
    const a = Math.random() * Math.PI * 2;
    return { burst: Math.floor(i / n), vx: Math.cos(a) * (0.4 + Math.random() * 0.6), vy: 1.2 + Math.random() * 0.9, vz: Math.sin(a) * 0.5, spin: (Math.random() - 0.5) * 18, tilt: Math.random() * 6 };
  });
  c.fx.scene.add(mesh);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const origins = bursts.map(() => null as THREE.Vector3 | null);
  return {
    update(now) {
      const t = (now - c.start) / c.ms;
      if (t >= 1) return false;
      pieces.forEach((p, i) => {
        const bt = bursts[p.burst];
        const life = (t - bt) * (c.ms / 1000);
        if (life < 0) {
          m4.makeScale(0, 0, 0);
          mesh.setMatrixAt(i, m4);
          return;
        }
        origins[p.burst] ??= where(V()).clone();
        const o = origins[p.burst]!;
        const x = o.x + p.vx * life * c.u;
        const y = o.y + (p.vy * life - 2.2 * life * life) * c.u;
        const z = o.z + p.vz * life * c.u + c.u * 0.3;
        q.setFromEuler(e.set(p.tilt + life * p.spin, life * p.spin * 0.7, life * p.spin * 0.4));
        const s = c.u * 0.045 * (life > 1.2 ? Math.max(0, 1 - (life - 1.2) / 0.4) : 1);
        m4.compose(tmp2.set(x, y, z), q, new THREE.Vector3(s, s, s));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mat.opacity = fadeOut(t, 0.88);
      return true;
    },
    dispose() {
      mesh.removeFromParent();
      mesh.dispose();
      mat.dispose();
    },
  };
}

defineEffect('perform:cheer', (c) => confetti(c, [0.3, 0.66], (o) => c.actor.toy.headTop(o), 14));

defineEffect('perform:starstruck', (c) => {
  const cols = ['#F7C534', '#F4A6D0', '#9FE0E6', '#F7C534', '#B8F0B0', '#FFF3B0'];
  const stars = cols.map((col) => {
    const m = new THREE.Mesh(c.fx.shape('star', () => starGeometry()), c.fx.shiny(col, 0.5));
    c.fx.scene.add(m);
    return m;
  });
  // A tilted ring of stars that passes in front of the animal and behind it.
  return group(stars, (t) => {
    c.actor.toy.centerAt(tmp);
    const w = hold(t, 0.03, 0.97, 0.1);
    stars.forEach((s, i) => {
      const a = (i / stars.length) * Math.PI * 2 + t * Math.PI * 3;
      s.position.set(tmp.x + Math.cos(a) * c.u * 0.62, tmp.y + c.u * 0.1 + Math.sin(a) * c.u * 0.12, tmp.z + Math.sin(a) * c.u * 0.55);
      s.scale.setScalar(c.u * 0.06 * w * (1 + Math.sin(t * 20 + i) * 0.15));
      s.rotation.set(0, a, t * 8);
    });
  }, c);
});

defineEffect('perform:party', (c) => {
  const hat = new THREE.Group();
  const stripes = c.fx.texture('partyhat', (canvas, done) => {
    const x = canvas.getContext('2d');
    if (!x) return;
    x.fillStyle = '#9B7FD0';
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#F2C230';
    for (let i = -128; i < 128; i += 32) {
      x.beginPath();
      x.moveTo(i, 128);
      x.lineTo(i + 14, 128);
      x.lineTo(i + 142, 0);
      x.lineTo(i + 128, 0);
      x.closePath();
      x.fill();
    }
    done();
  });
  const coneMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.55 });
  const cone = new THREE.Mesh(c.fx.shape('hatcone', () => new THREE.ConeGeometry(1, 2.2, 24, 1, true)), coneMat);
  cone.position.y = 1.1;
  const pom = new THREE.Mesh(c.fx.kit.sphere, new THREE.MeshStandardMaterial({ color: '#F2C230', roughness: 0.9 }));
  pom.position.y = 2.25;
  pom.scale.setScalar(0.38);
  hat.add(cone, pom);
  const head = c.actor.toy.headGroup;
  const spec = c.actor.toy.spec;
  hat.position.set(spec.head[0] * 0.1, spec.head[1] * 0.38, 0.02);
  hat.rotation.z = -0.28;
  head.add(hat);
  const pops = confetti(c, [0.14, 0.56], (o) => c.actor.toy.headTop(o), 18);
  const hatFx: Effect = {
    update(now) {
      const t = (now - c.start) / c.ms;
      if (t >= 1) return false;
      const on = easeOutBack(seg(t, 0.06, 0.16)) * (1 - easeInOut(seg(t, 0.9, 0.98)));
      const s = 0.13 * on;
      hat.scale.setScalar(Math.max(0.0001, s));
      hat.visible = on > 0.01;
      return true;
    },
    dispose() {
      hat.removeFromParent();
      coneMat.dispose();
      (pom.material as THREE.Material).dispose();
    },
  };
  return {
    update: (now) => {
      const a = pops.update(now);
      const b = hatFx.update(now);
      return a || b;
    },
    dispose() {
      pops.dispose();
      hatFx.dispose();
    },
  };
});
