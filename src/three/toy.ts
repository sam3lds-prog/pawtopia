/**
 * Builds a soft-toy 3D model of one animal from its `ToySpec` (D34): rounded parts with a plush finish, a painted face,
 * and a small rig the clips move (`setPose`). One unit is the figure scale H; the ground is y = 0 and the toy faces +z.
 *
 *   root ─ mover (px, py, pz, yaw) ─ spinner (pitch, roll, about the body's middle) ─ body (lean, tilt, squash)
 *        │                                                                          ├ head pivot → head (yaw, pitch, tilt)
 *        │                                                                          ├ arms, legs (at shoulders and hips)
 *        └ shadow                                                                   └ tail (a chain that bends)
 */

import * as THREE from 'three';
import { exprForMood, HEAD_SHELL, MUZZLE_SHELL, paintEyes, paintMouth, type Expr } from './face';
import type { Pose } from './pose';
import type { BodyKind, ToySpec } from './species';

/** Shared materials and geometry for every toy in one stage. */
export class ToyKit {
  private mats = new Map<string, THREE.Material>();
  readonly sphere = new THREE.SphereGeometry(1, 28, 20);
  readonly lowSphere = new THREE.SphereGeometry(1, 16, 12);
  private lathes = new Map<string, THREE.LatheGeometry>();
  private textures: THREE.Texture[] = [];
  private geos: THREE.BufferGeometry[] = [];

  /** Plush: matte, with a soft velvet sheen at the edges. */
  fur(color: string): THREE.Material {
    const key = `fur:${color}`;
    let m = this.mats.get(key);
    if (!m) {
      const c = new THREE.Color(color);
      m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.92, metalness: 0, sheen: 0.55, sheenRoughness: 0.6, sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.55) });
      this.mats.set(key, m);
    }
    return m;
  }

  /** Noses, beaks and eyes-on-stalks: a little shine. */
  gloss(color: string): THREE.Material {
    const key = `gloss:${color}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0 });
      this.mats.set(key, m);
    }
    return m;
  }

  /** A rounded cone (ears), radius 1 at the base, height 1. */
  cone(round: number): THREE.LatheGeometry {
    const key = round.toFixed(2);
    let g = this.lathes.get(key);
    if (!g) {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 12; i++) {
        const y = i / 12;
        pts.push(new THREE.Vector2(Math.max(0.0001, (1 - y ** (1 + round)) ** (0.6 + round * 0.4)), y));
      }
      g = new THREE.LatheGeometry(pts, 20);
      this.lathes.set(key, g);
    }
    return g;
  }

  track<T extends THREE.Texture>(t: T): T {
    this.textures.push(t);
    return t;
  }

  trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  dispose(): void {
    for (const m of this.mats.values()) m.dispose();
    for (const g of this.lathes.values()) g.dispose();
    for (const t of this.textures) t.dispose();
    for (const g of this.geos) g.dispose();
    this.sphere.dispose();
    this.lowSphere.dispose();
    this.mats.clear();
    this.lathes.clear();
    this.textures = [];
    this.geos = [];
  }
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

interface Layout {
  /** Body's middle, for flips. */
  center: number;
  headAt: THREE.Vector3;
  shoulder: [THREE.Vector3, THREE.Vector3];
  paw: number;
  armR: number;
  hip: [THREE.Vector3, THREE.Vector3];
  tailAt: THREE.Vector3;
  shadowW: number;
}

export class Toy {
  readonly root = new THREE.Group();
  readonly spec: ToySpec;
  readonly baseExpr: Expr;
  private readonly kit: ToyKit;
  private mover = new THREE.Group();
  private spinner = new THREE.Group();
  private inner = new THREE.Group();
  private body = new THREE.Group();
  private headPivot = new THREE.Group();
  private head = new THREE.Group();
  private arms: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private legs: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private ears: THREE.Group[] = [];
  private tail: THREE.Group[] = [];
  private trunk: THREE.Group[] = [];
  private shadow: THREE.Mesh;
  private eyeMat: THREE.MeshStandardMaterial;
  private mouthMat: THREE.MeshStandardMaterial | null = null;
  private faces = new Map<Expr, [THREE.Texture | null, THREE.Texture | null]>();
  private face: Expr | null = null;
  private layout: Layout;
  private kind: BodyKind;
  /** Meshes a tap can hit. */
  readonly hits: THREE.Object3D[] = [];

  constructor(spec: ToySpec, kit: ToyKit, mood?: string) {
    this.spec = spec;
    this.kit = kit;
    this.kind = spec.body;
    this.baseExpr = exprForMood(mood);
    this.layout = layoutFor(spec);
    this.root.add(this.mover);
    this.mover.add(this.spinner);
    this.spinner.add(this.inner);
    this.inner.add(this.body);
    this.spinner.position.y = this.layout.center;
    this.inner.position.y = -this.layout.center;
    this.root.rotation.y = spec.turn ?? 0;

    this.eyeMat = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.buildBody();
    this.buildHead();
    this.buildTail();
    this.shadow = this.buildShadow();
    this.setFace(this.baseExpr);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o !== this.shadow) this.hits.push(o);
    });
  }

  // ---------------------------------------------------------------- building

  private part(geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3, scale: THREE.Vector3, parent: THREE.Object3D = this.body, rot?: THREE.Euler): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    m.scale.copy(scale);
    if (rot) m.rotation.copy(rot);
    parent.add(m);
    return m;
  }

  private ball(color: string, pos: THREE.Vector3, r: THREE.Vector3, parent: THREE.Object3D = this.body, low = false): THREE.Mesh {
    return this.part(low ? this.kit.lowSphere : this.kit.sphere, this.kit.fur(color), pos, r, parent);
  }

  /** A limb from a pivot straight down to a paw, as a capsule plus a rounded paw. */
  private limb(pivot: THREE.Group, at: THREE.Vector3, len: number, r: number, color: string, paw: string, pawScale = 1): void {
    pivot.position.copy(at);
    this.body.add(pivot);
    const cap = this.kit.trackGeo(new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 6, 14));
    this.part(cap, this.kit.fur(color), v3(0, -len / 2, 0), v3(1, 1, 1), pivot);
    this.ball(paw, v3(0, -len + r * 0.25, r * 0.45), v3(r * 1.2 * pawScale, r * 0.85 * pawScale, r * 1.35 * pawScale), pivot);
  }

  private buildBody(): void {
    const s = this.spec;
    const L = this.layout;
    const paws = s.paws ?? s.fur;
    switch (this.kind) {
      case 'bird': {
        this.ball(s.fur, v3(0, 0.33, 0), v3(0.27, 0.33, 0.25));
        this.ball(s.id === 'rio' ? s.light : s.light, v3(0, 0.32, 0.12), v3(0.18, 0.24, 0.15));
        for (const [i, side] of [-1, 1].entries()) {
          const w = this.arms[i];
          w.position.copy(L.shoulder[i]);
          this.body.add(w);
          this.ball(s.shade, v3(side * 0.03, -0.17, -0.02), v3(0.075, 0.2, 0.17), w);
          this.ball('#E5A23C', v3(side * 0.08, 0.02, 0.1), v3(0.05, 0.025, 0.075));
        }
        break;
      }
      case 'seal': {
        this.ball(s.fur, v3(0.12, 0.17, 0), v3(0.44, 0.17, 0.21));
        this.ball(s.light, v3(0.02, 0.13, 0.1), v3(0.3, 0.1, 0.12));
        // Front flippers (the "arms") and tail flippers.
        for (const [i, x] of [-0.24, 0.04].entries()) {
          const f = this.arms[i];
          f.position.set(x, 0.12, 0.14);
          this.body.add(f);
          this.ball(s.shade, v3(0, -0.04, 0.04), v3(0.11, 0.035, 0.07), f);
        }
        for (const z of [-0.06, 0.06]) this.ball(s.shade, v3(0.58, 0.06, z), v3(0.1, 0.03, 0.06));
        break;
      }
      default: {
        const big = this.kind === 'big';
        const up = this.kind === 'upright';
        const torso = big ? v3(0.34, 0.29, 0.29) : up ? v3(0.21, 0.33, 0.2) : v3(0.27, 0.27, 0.24);
        const tc = big ? 0.29 : up ? 0.34 : 0.27;
        this.ball(s.fur, v3(0, tc, 0), torso);
        const belly = s.id === 'maple' ? s.dark : s.light;
        const bk = s.id === 'maple' ? 0.78 : 1;
        this.ball(belly, v3(0, tc - 0.04, torso.z * 0.55), v3(torso.x * 0.62 * bk, torso.y * 0.74 * bk, torso.z * 0.55));
        if (s.extras?.includes('chestfluff')) this.ball(s.light, v3(0, tc + torso.y * 0.45, torso.z * 0.5), v3(0.15, 0.12, 0.12));
        if (this.kind === 'tall') {
          const neck = this.kit.trackGeo(new THREE.CapsuleGeometry(0.075, 0.5, 6, 14));
          this.part(neck, this.kit.fur(s.fur), v3(0, 0.68, 0.06), v3(1, 1, 1), this.body, new THREE.Euler(0.08, 0, 0));
        }
        // Front legs.
        const legLen = L.shoulder[0].y - 0.02;
        for (let i = 0; i < 2; i++) this.limb(this.arms[i], L.shoulder[i], legLen, L.armR, s.fur, paws, big ? 1.1 : 1);
        // Hind legs: a haunch with a foot that sticks out in front.
        for (const [i, side] of [-1, 1].entries()) {
          const g = this.legs[i];
          g.position.copy(L.hip[i]);
          this.body.add(g);
          const hx = big ? 0.14 : 0.11;
          this.ball(s.fur, v3(side * 0.02, -0.02, -0.02), v3(hx, hx, hx * 1.25), g);
          const foot = s.id === 'skipper' ? v3(0.07, 0.035, 0.17) : v3(0.07, 0.042, 0.1);
          this.ball(paws, v3(side * 0.01, -L.hip[i].y + foot.y, 0.12 + (s.id === 'skipper' ? 0.04 : 0)), foot, g);
        }
        if (s.extras?.includes('spots'))
          for (const [x, y, z] of [
            [-0.17, 0.33, 0.14],
            [0.19, 0.24, 0.15],
            [0.05, 0.42, 0.2],
            [-0.1, 0.18, 0.2],
            [0.0, 0.62, 0.12],
            [0.02, 0.84, 0.13],
          ])
            this.ball(s.markColor ?? s.shade, v3(x, y, z), v3(0.045, 0.038, 0.03), this.body, true);
      }
    }
  }

  private buildHead(): void {
    const s = this.spec;
    const L = this.layout;
    const [hw, hh, hd] = s.head;
    const hx = hw / 2;
    const hy = hh / 2;
    const hz = hd / 2;
    // The head turns and nods about its neck.
    this.headPivot.position.set(L.headAt.x, L.headAt.y - hy * 0.75, L.headAt.z);
    this.body.add(this.headPivot);
    this.head.position.set(0, hy * 0.75, 0);
    this.headPivot.add(this.head);

    const skull = new THREE.Group();
    skull.scale.set(hx, hy, hz);
    this.head.add(skull);
    this.part(this.kit.sphere, this.kit.fur(s.fur), v3(0, 0, 0), v3(1, 1, 1), skull);
    const shellGeo = this.kit.trackGeo(
      new THREE.SphereGeometry(1.004, 40, 30, Math.PI / 2 - HEAD_SHELL.phiLen / 2, HEAD_SHELL.phiLen, HEAD_SHELL.thetaStart, HEAD_SHELL.thetaLen),
    );
    // Sphere geometry's phi runs from −x round to +x through +z, so the shell faces the viewer.
    const shell = new THREE.Mesh(shellGeo, this.eyeMat);
    shell.renderOrder = 2;
    skull.add(shell);
    if (s.eyes.style === 'side') this.ball(s.light, v3(0, -0.42 * hy, hz * 0.5), v3(hx * 0.62, hy * 0.42, hz * 0.55), this.head);

    this.buildMuzzle(hx, hy, hz);
    this.buildEars(hx, hy, hz);

    if (s.extras?.includes('ossicones'))
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * hx * 0.38, hy * 0.82, -hz * 0.1);
        g.rotation.z = -side * 0.18;
        this.head.add(g);
        const stalk = this.kit.trackGeo(new THREE.CylinderGeometry(0.022, 0.028, 0.11, 10));
        this.part(stalk, this.kit.fur(s.fur), v3(0, 0.05, 0), v3(1, 1, 1), g);
        this.ball(s.dark, v3(0, 0.115, 0), v3(0.035, 0.03, 0.035), g);
      }
  }

  private buildMuzzle(hx: number, hy: number, hz: number): void {
    const s = this.spec;
    const k = s.snout.size;
    const mouthGeo = () =>
      this.kit.trackGeo(new THREE.SphereGeometry(1.006, 28, 22, Math.PI / 2 - MUZZLE_SHELL.phiLen / 2, MUZZLE_SHELL.phiLen, MUZZLE_SHELL.thetaStart, MUZZLE_SHELL.thetaLen));
    const muzzle = (c: THREE.Vector3, r: THREE.Vector3, color: string, nose: THREE.Vector3 | null, noseR: THREE.Vector3) => {
      const g = new THREE.Group();
      g.position.copy(c);
      g.scale.copy(r);
      this.head.add(g);
      this.part(this.kit.sphere, this.kit.fur(color), v3(0, 0, 0), v3(1, 1, 1), g);
      if (s.mouth !== 'none') {
        this.mouthMat = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        const shell = new THREE.Mesh(mouthGeo(), this.mouthMat);
        shell.renderOrder = 2;
        g.add(shell);
      }
      if (nose) this.part(this.kit.sphere, this.kit.gloss(s.snout.nose), nose, noseR, this.head);
    };
    switch (s.snout.kind) {
      case 'cat':
        muzzle(v3(0, -hy * 0.34, hz * 0.8), v3(hx * 0.4 * k, hy * 0.27 * k, hz * 0.26 * k), s.snout.color, v3(0, -hy * 0.2, hz * 1.04), v3(0.04, 0.03, 0.03));
        break;
      case 'dog':
        muzzle(v3(0, -hy * 0.34, hz * 0.82), v3(hx * 0.42 * k, hy * 0.3 * k, hz * 0.38 * k), s.snout.color, v3(0, -hy * 0.16, hz * 1.17), v3(0.065, 0.045, 0.045));
        break;
      case 'fox':
        muzzle(v3(0, -hy * 0.36, hz * 0.86), v3(hx * 0.3 * k, hy * 0.24 * k, hz * 0.48 * k), s.snout.color, v3(0, -hy * 0.28, hz * 1.32), v3(0.045, 0.035, 0.04));
        break;
      case 'round':
      case 'flat':
        muzzle(
          v3(0, -hy * 0.32, hz * 0.84),
          v3(hx * (s.snout.kind === 'flat' ? 0.5 : 0.4) * k, hy * 0.3 * k, hz * (s.snout.kind === 'flat' ? 0.3 : 0.32) * k),
          s.snout.color,
          v3(0, -hy * 0.15, hz * (s.snout.kind === 'flat' ? 1.12 : 1.14)),
          v3(0.055, 0.04, 0.04),
        );
        break;
      case 'koala':
        muzzle(v3(0, -hy * 0.5, hz * 0.84), v3(hx * 0.3, hy * 0.2, hz * 0.2), s.fur, null, v3(0, 0, 0));
        this.part(this.kit.sphere, this.kit.gloss(s.snout.nose), v3(0, -hy * 0.14, hz * 0.95), v3(hx * 0.2, hy * 0.33, hz * 0.17), this.head);
        break;
      case 'beak': {
        const geo = this.kit.cone(0.4);
        this.part(geo, this.kit.gloss(s.snout.color), v3(0, -hy * 0.12, hz * 0.95), v3(0.04, 0.09, 0.035), this.head, new THREE.Euler(Math.PI * 0.62, 0, 0));
        break;
      }
      case 'bigbeak': {
        const g = new THREE.Group();
        g.position.set(0, -hy * 0.05, hz * 0.82);
        g.rotation.x = 0.12;
        this.head.add(g);
        this.ball(s.snout.color, v3(0, 0, hz * 0.85), v3(hx * 0.36, hy * 0.36, hz * 1.05), g);
        this.ball(s.snout.nose, v3(0, -hy * 0.04, hz * 1.75), v3(hx * 0.22, hy * 0.24, hz * 0.32), g);
        this.ball('#2B2B30', v3(0, hy * 0.3, hz * 0.3), v3(hx * 0.12, hy * 0.06, hz * 0.4), g, true);
        break;
      }
      case 'trunk': {
        let parent: THREE.Object3D = this.head;
        let at = v3(0, -hy * 0.18, hz * 0.88);
        for (let i = 0; i < 6; i++) {
          const g = new THREE.Group();
          g.position.copy(at);
          parent.add(g);
          const r = 0.075 - i * 0.008;
          this.ball(i === 5 ? s.snout.nose : s.fur, v3(0, -0.04, 0.012), v3(r, 0.055, r), g);
          this.trunk.push(g);
          parent = g;
          at = v3(0, -0.07, 0.012);
        }
        break;
      }
      default:
    }
  }

  private buildEars(hx: number, hy: number, hz: number): void {
    const s = this.spec;
    const e = s.ears;
    const color = e.color ?? s.fur;
    const k = e.size;
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      this.head.add(g);
      this.ears.push(g);
      const inner = (pos: THREE.Vector3, r: THREE.Vector3, c = s.inner) => this.ball(c, pos, r, g, true);
      switch (e.kind) {
        case 'pointed':
        case 'tufted':
        case 'round':
        case 'folded': {
          const round = e.kind === 'round' ? 0.45 : 0.15;
          const r = (e.kind === 'round' ? 0.135 : 0.13) * k;
          const h = (e.kind === 'round' ? 0.17 : e.kind === 'folded' ? 0.15 : 0.22) * k;
          g.position.set(side * hx * 0.56, hy * 0.62, -hz * 0.05);
          g.rotation.set(e.kind === 'folded' ? 1.1 : -0.08, 0, -side * (e.kind === 'folded' ? 0.25 : 0.32));
          this.part(this.kit.cone(round), this.kit.fur(color), v3(0, 0, 0), v3(r, h, r * 0.5), g);
          this.part(this.kit.cone(round), this.kit.fur(s.inner), v3(0, h * 0.06, r * 0.18), v3(r * 0.62, h * 0.78, r * 0.32), g);
          if (e.tip) this.part(this.kit.cone(0.3), this.kit.fur(e.tip), v3(0, h * 0.62, 0), v3(r * 0.42, h * 0.4, r * 0.24), g);
          if (e.kind === 'tufted') this.part(this.kit.cone(0.1), this.kit.fur(s.markColor ?? s.dark), v3(0, h * 0.92, 0), v3(r * 0.2, h * 0.38, r * 0.12), g);
          break;
        }
        case 'floppy':
          g.position.set(side * hx * 0.86, hy * 0.42, -hz * 0.05);
          g.rotation.z = side * 0.18;
          this.ball(color, v3(side * 0.03, -0.17, 0), v3(0.1, 0.22, 0.06), g);
          break;
        case 'button':
          g.position.set(side * hx * 0.66, hy * 0.7, hz * 0.05);
          g.rotation.set(0.9, 0, -side * 0.5);
          this.ball(color, v3(0, 0.06, 0), v3(0.1, 0.09, 0.04), g);
          break;
        case 'disc':
          g.position.set(side * hx * 0.7, hy * 0.7, -hz * 0.1);
          g.rotation.z = -side * 0.4;
          this.ball(e.tip ?? color, v3(0, 0.05, 0), v3(0.15 * k, 0.14 * k, 0.06), g);
          inner(v3(0, 0.045, 0.035), v3(0.1 * k, 0.09 * k, 0.04), s.id === 'maple' ? s.dark : color);
          break;
        case 'fluffy':
          g.position.set(side * hx * 0.92, hy * 0.5, -hz * 0.15);
          g.rotation.z = -side * 0.3;
          this.ball(color, v3(side * 0.06, 0.04, 0), v3(0.24 * k, 0.22 * k, 0.09), g);
          inner(v3(side * 0.06, 0.03, 0.05), v3(0.16 * k, 0.15 * k, 0.06), e.tip ?? s.light);
          break;
        case 'tall':
          g.position.set(side * hx * 0.42, hy * 0.78, -hz * 0.05);
          g.rotation.z = -side * 0.22;
          this.ball(color, v3(0, 0.17 * k, 0), v3(0.075 * k, 0.21 * k, 0.05), g);
          inner(v3(0, 0.16 * k, 0.025), v3(0.042 * k, 0.15 * k, 0.03));
          break;
        case 'small':
          g.position.set(side * hx * 0.72, hy * 0.66, -hz * 0.1);
          g.rotation.z = -side * 0.5;
          this.ball(color, v3(0, 0.03, 0), v3(0.075 * k, 0.065 * k, 0.04), g);
          inner(v3(0, 0.025, 0.02), v3(0.045 * k, 0.04 * k, 0.03));
          break;
        case 'giant':
          g.position.set(side * hx * 0.92, hy * 0.05, -hz * 0.25);
          g.rotation.y = side * 0.35;
          this.ball(color, v3(side * 0.2, 0, 0), v3(0.27, 0.32, 0.05), g);
          inner(v3(side * 0.2, -0.01, 0.03), v3(0.18, 0.22, 0.03), e.tip ?? s.inner);
          break;
        default:
      }
    }
  }

  private buildTail(): void {
    const s = this.spec;
    const t = s.tail;
    const L = this.layout;
    const chain = (n: number, len: number, radius: (i: number) => number, bend: number, color: (i: number) => string, start: THREE.Euler) => {
      let parent: THREE.Object3D = this.body;
      let at = L.tailAt.clone();
      for (let i = 0; i < n; i++) {
        const g = new THREE.Group();
        g.position.copy(at);
        if (i === 0) g.rotation.copy(start);
        else g.rotation.z = bend;
        parent.add(g);
        const r = radius(i);
        this.ball(color(i), v3(0, len / 2, 0), v3(r, len * 0.62 + r * 0.4, r), g);
        this.tail.push(g);
        parent = g;
        at = v3(0, len, 0);
      }
    };
    switch (t.kind) {
      case 'cat':
        chain(7, 0.072, (i) => 0.046 - i * 0.003, 0.2, () => t.color, new THREE.Euler(-0.4, 0.3, -1.25));
        break;
      case 'dog':
        chain(4, 0.07, (i) => 0.042 - i * 0.004, 0.32, () => t.color, new THREE.Euler(-0.5, 0.2, -0.85));
        break;
      case 'fox':
        chain(5, 0.085, (i) => [0.07, 0.095, 0.1, 0.09, 0.07][i], 0.24, (i) => (i === 4 ? t.tip ?? s.light : t.color), new THREE.Euler(-0.2, 0.3, -1.45));
        break;
      case 'panda':
        chain(6, 0.075, (i) => [0.065, 0.075, 0.078, 0.075, 0.068, 0.058][i], 0.2, (i) => (i % 2 ? t.ring ?? s.light : t.color), new THREE.Euler(-0.3, 0.3, -1.35));
        break;
      case 'kangaroo':
        chain(5, 0.085, (i) => 0.075 - i * 0.012, -0.1, (i) => (i === 4 && t.tip ? t.tip : t.color), new THREE.Euler(-0.3, 0.6, -1.85));
        break;
      case 'stub':
        chain(1, 0.05, () => 0.055, 0, () => t.color, new THREE.Euler(-1.2, 0, -0.6));
        if (t.tip) this.ball(t.tip, v3(0, 0.07, 0), v3(0.03, 0.04, 0.03), this.tail[0], true);
        break;
      case 'bird':
        for (const a of [-0.35, 0, 0.35]) {
          const g = new THREE.Group();
          g.position.set(0, 0.12, -0.18);
          g.rotation.set(-2.2, a, 0);
          this.body.add(g);
          this.ball(t.color, v3(0, 0.08, 0), v3(0.05, 0.1, 0.02), g);
          this.tail.push(g);
        }
        break;
      default:
    }
  }

  private buildShadow(): THREE.Mesh {
    const tex = this.kit.track(shadowTexture());
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55 });
    const geo = this.kit.trackGeo(new THREE.PlaneGeometry(1, 1));
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -1;
    m.position.set(0, 0.0, -0.32);
    m.scale.set(this.layout.shadowW, this.layout.shadowW * 0.22, 1);
    this.root.add(m);
    return m;
  }

  // ---------------------------------------------------------------- driving

  /** Applies a pose (rest + offsets). */
  setPose(p: Pose): void {
    this.mover.position.set(p.px, p.py, p.pz);
    this.mover.rotation.y = p.yaw;
    this.spinner.rotation.set(p.pitch, 0, -p.roll);
    this.body.rotation.set(p.lean, 0, -p.tilt);
    const sq = Math.max(-0.4, Math.min(0.4, p.squash));
    this.body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    this.head.rotation.set(p.headPitch, p.headYaw, -p.headTilt, 'YXZ');
    for (const [i, e] of this.ears.entries()) {
      const side = i ? 1 : -1;
      e.userData.rest ??= { x: e.rotation.x, z: e.rotation.z };
      e.rotation.x = e.userData.rest.x - p.ears * 0.35;
      e.rotation.z = e.userData.rest.z - side * p.ears * 0.25;
    }
    const bird = this.kind === 'bird' || this.kind === 'seal';
    for (const [i, a] of this.arms.entries()) {
      const side = i ? 1 : -1;
      const raise = i ? p.armR : p.armL;
      const out = i ? p.armROut : p.armLOut;
      if (bird) a.rotation.set(0, 0, side * (raise * 0.8 + out));
      else a.rotation.set(-raise, 0, side * out);
    }
    for (const [i, l] of this.legs.entries()) l.rotation.x = -(i ? p.legR : p.legL);
    for (const [i, g] of this.tail.entries()) {
      if (this.spec.tail.kind === 'bird') {
        g.rotation.y = (i - 1) * 0.35 + p.tail * 0.3;
        continue;
      }
      g.userData.rest ??= { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z };
      const w = i === 0 ? 1 : 0.35;
      g.rotation.x = g.userData.rest.x - p.tailUp * 0.4 * w;
      g.rotation.y = g.userData.rest.y + p.tail * 0.5 * w;
      g.rotation.z = g.userData.rest.z - p.tailUp * 0.15 * w;
    }
    for (const [i, g] of this.trunk.entries()) g.rotation.x = -(0.08 + p.trunk * 0.35) * (i / 3 + 0.4);
    // The shadow stays on the ground under the toy and fades as it leaves it.
    const lift = Math.max(0, p.py);
    this.shadow.position.set(p.px, 0, p.pz - 0.32);
    const k = 1 / (1 + lift * 1.6);
    this.shadow.scale.set(this.layout.shadowW * k, this.layout.shadowW * 0.22 * k, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.55 * k;
  }

  setFace(e: Expr): void {
    if (this.face === e) return;
    this.face = e;
    let t = this.faces.get(e);
    if (!t) {
      t = [paint((c) => paintEyes(c, this.spec, e), this.kit), this.mouthMat ? paint((c) => paintMouth(c, this.spec, e), this.kit) : null];
      this.faces.set(e, t);
    }
    this.eyeMat.map = t[0];
    this.eyeMat.visible = !!t[0];
    this.eyeMat.needsUpdate = true;
    if (this.mouthMat) {
      this.mouthMat.map = t[1];
      this.mouthMat.visible = !!t[1];
      this.mouthMat.needsUpdate = true;
    }
  }

  get expression(): Expr | null {
    return this.face;
  }

  /** The top of the head in world space (for emote bubbles and hearts). */
  headTop(out = new THREE.Vector3()): THREE.Vector3 {
    this.head.updateWorldMatrix(true, false);
    return out.set(0, this.spec.head[1] * 0.55, 0).applyMatrix4(this.head.matrixWorld);
  }

  /** Where the paws are (world space), for props held between them. */
  pawsAt(out = new THREE.Vector3()): THREE.Vector3 {
    this.body.updateWorldMatrix(true, false);
    return out.set(0, this.layout.shoulder[0].y + 0.2, 0.25).applyMatrix4(this.body.matrixWorld);
  }

  /** The head group, for props that ride on it (a party hat). */
  get headGroup(): THREE.Group {
    return this.head;
  }

  /** Height of the toy's head top above the ground at rest, in toy units. */
  get height(): number {
    return this.layout.headAt.y + this.spec.head[1] * 0.5;
  }

  dispose(): void {
    this.eyeMat.dispose();
    this.mouthMat?.dispose();
    for (const [a, b] of this.faces.values()) {
      a?.dispose();
      b?.dispose();
    }
    this.faces.clear();
    this.root.removeFromParent();
  }
}

function paint(draw: (c: HTMLCanvasElement) => boolean, kit: ToyKit): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  if (!draw(canvas)) return null;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  void kit;
  return t;
}

let shadowCanvas: HTMLCanvasElement | null = null;
function shadowTexture(): THREE.Texture {
  if (!shadowCanvas && typeof document !== 'undefined') {
    shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 64;
    const c = shadowCanvas.getContext('2d');
    if (c) {
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, 'rgba(40,52,52,0.55)');
      g.addColorStop(0.6, 'rgba(40,52,52,0.25)');
      g.addColorStop(1, 'rgba(40,52,52,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }
  }
  const t = shadowCanvas ? new THREE.CanvasTexture(shadowCanvas) : new THREE.Texture();
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function layoutFor(s: ToySpec): Layout {
  const hy = s.head[1] / 2;
  switch (s.body) {
    case 'bird':
      return { center: 0.42, headAt: v3(0, 0.6 + hy * 0.62, 0.02), shoulder: [v3(-0.22, 0.48, 0), v3(0.22, 0.48, 0)], paw: 0, armR: 0, hip: [v3(-0.1, 0.1, 0), v3(0.1, 0.1, 0)], tailAt: v3(0, 0.12, -0.18), shadowW: 0.7 };
    case 'seal':
      return { center: 0.22, headAt: v3(-0.24, 0.42, 0.06), shoulder: [v3(-0.24, 0.12, 0.14), v3(0.04, 0.12, 0.14)], paw: 0, armR: 0, hip: [v3(0.4, 0.1, 0), v3(0.4, 0.1, 0)], tailAt: v3(0.5, 0.1, 0), shadowW: 1.15 };
    case 'big':
      return { center: 0.36, headAt: v3(0, 0.5 + hy, 0.08), shoulder: [v3(-0.16, 0.3, 0.15), v3(0.16, 0.3, 0.15)], paw: 0.06, armR: 0.085, hip: [v3(-0.24, 0.15, 0), v3(0.24, 0.15, 0)], tailAt: v3(0.12, 0.18, -0.24), shadowW: 0.95 };
    case 'upright':
      return { center: 0.42, headAt: v3(0, 0.62 + hy, 0.02), shoulder: [v3(-0.13, 0.46, 0.12), v3(0.13, 0.46, 0.12)], paw: 0.3, armR: 0.042, hip: [v3(-0.16, 0.15, 0), v3(0.16, 0.15, 0)], tailAt: v3(0.06, 0.14, -0.16), shadowW: 0.75 };
    case 'tall':
      return { center: 0.5, headAt: v3(0, 0.96 + hy * 0.7, 0.1), shoulder: [v3(-0.1, 0.33, 0.13), v3(0.1, 0.33, 0.13)], paw: 0.05, armR: 0.058, hip: [v3(-0.19, 0.13, 0), v3(0.19, 0.13, 0)], tailAt: v3(0.1, 0.22, -0.2), shadowW: 0.8 };
    default:
      return { center: 0.4, headAt: v3(0, 0.47 + hy, 0.04), shoulder: [v3(-0.1, 0.33, 0.13), v3(0.1, 0.33, 0.13)], paw: 0.05, armR: 0.058, hip: [v3(-0.19, 0.13, 0), v3(0.19, 0.13, 0)], tailAt: v3(0.12, 0.1, -0.16), shadowW: 0.85 };
  }
}
