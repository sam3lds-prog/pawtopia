/**
 * Props and particles that go with a clip (D34): a heart for a little love, and (Sprint O) a trick's stars, bubble or
 * rainbow and the emote bubble. Each effect follows its actor and is gone when its clip ends.
 */

import * as THREE from 'three';
import type { Actor } from './actor';
import type { ToyKit } from './toy';

export interface Effect {
  /** Returns false when finished. */
  update(now: number): boolean;
  dispose(): void;
}

export type EffectFactory = (fx: Effects, actor: Actor, now: number, still: boolean) => Effect | null;

const registry = new Map<string, EffectFactory>();

/** Registers the effect for a clip id (an ambient action, a trick or an emote). */
export function defineEffect(id: string, f: EffectFactory): void {
  registry.set(id, f);
}

export class Effects {
  private live: Effect[] = [];
  private geo = new Map<string, THREE.BufferGeometry>();

  constructor(
    readonly scene: THREE.Scene,
    readonly kit: ToyKit,
  ) {}

  start(id: string, actor: Actor, now: number, still = false): void {
    const f = registry.get(id);
    const e = f?.(this, actor, now, still);
    if (e) this.live.push(e);
  }

  get active(): boolean {
    return this.live.length > 0;
  }

  update(now: number): void {
    this.live = this.live.filter((e) => {
      const alive = e.update(now);
      if (!alive) e.dispose();
      return alive;
    });
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

  /** A glossy material of the effect's own (props are shiny; the toys are plush). The effect disposes it. */
  shiny(color: string, emissive = 0.15): THREE.MeshStandardMaterial {
    const c = new THREE.Color(color);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.05, emissive: c, emissiveIntensity: emissive, transparent: true });
  }

  dispose(): void {
    for (const e of this.live) e.dispose();
    this.live = [];
    for (const g of this.geo.values()) g.dispose();
    this.geo.clear();
  }
}

// ------------------------------------------------------------------ shapes

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
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3 });
  g.center();
  return g;
}

/** Scene units per toy unit for an actor (its scale on stage). */
export function unit(a: Actor): number {
  return a.toy.root.scale.x;
}

const tmp = new THREE.Vector3();

// A heart floats up from the head (a tap or a pat).
defineEffect('love', (fx, a, start) => {
  const mesh = new THREE.Mesh(fx.shape('heart', heartGeometry), fx.shiny('#E8556A', 0.25));
  fx.scene.add(mesh);
  const u = unit(a);
  const ms = 1300;
  return {
    update(now) {
      const t = (now - start) / ms;
      if (t >= 1) return false;
      a.toy.headTop(tmp);
      const pop = t < 0.2 ? t / 0.2 : 1;
      mesh.position.set(tmp.x + u * 0.12, tmp.y + u * (0.12 + t * 0.35), tmp.z + u * 0.2);
      mesh.scale.setScalar(u * 0.085 * (0.5 + 0.5 * pop));
      mesh.rotation.y = Math.sin(t * Math.PI * 2) * 0.6;
      mesh.material.opacity = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      return true;
    },
    dispose() {
      mesh.removeFromParent();
      mesh.material.dispose();
    },
  };
});
