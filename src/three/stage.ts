/**
 * The 3D layer of a sanctuary scene (D34). A transparent WebGL canvas lies over the drawn scene; every animal drawn in
 * the SVG gets a soft-toy twin standing exactly where it stands (the figure's `data-gx/gy/gh`). The drawn figures stay
 * in place, invisible, as the source of truth: their classes (`is-hop`, `is-trick-backflip`, `is-away`…) are what the
 * ambient director, the tricks and the decoration activities already set, and the stage watches them and plays the
 * same thing in 3D. Taps keep landing on the drawn figures; a toy that has wandered off is picked by a ray.
 *
 * Without WebGL, or if the context is lost, the drawn animals simply stay visible.
 */

import * as THREE from 'three';
import { Actor } from './actor';
import { ambientClip } from './clips';
import { Effects } from './effects';
import { addLights } from './lights';
import { toySpec } from './species';
import { Toy, ToyKit } from './toy';

export interface StageOptions {
  reducedMotion: () => boolean;
}

/** Scene units of the drawn frame (360 × 300) and the camera distance. */
const VW = 360;
const VH = 300;
const D = 900;
/** How much the toys lean toward you, so you see a little of their tops. */
const TILT = 0.16;

interface Entry {
  actor: Actor;
  fig: SVGGElement;
  seen: { classes: Set<string>; trick: string | null };
}

const TRACKED = /^is-(blink|look|yawn|wag|stretch|hop|love|greet|stroll|flutter)$/;

export class SceneStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private kit = new ToyKit();
  private effects: Effects;
  private entries = new Map<string, Entry>();
  private figure: HTMLElement | null = null;
  private svg: SVGSVGElement | null = null;
  private observer: MutationObserver;
  private resize: ResizeObserver;
  private visible: IntersectionObserver | null = null;
  private raf = 0;
  private live = true;
  private onScreen = true;
  private lastFrame = 0;
  private disposed = false;
  private ray = new THREE.Raycaster();
  private seedBase = Math.floor(Math.random() * 1e6);
  /** Dev only: a frozen clock for stepping through a clip frame by frame. */
  private frozen: number | null = null;
  readonly canvas: HTMLCanvasElement;

  constructor(private readonly o: StageOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', premultipliedAlpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'scene3d';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.camera = new THREE.PerspectiveCamera((2 * Math.atan(VH / 2 / D) * 180) / Math.PI, VW / VH, 10, 4000);
    this.camera.position.set(0, 0, D);
    addLights(this.scene);
    this.effects = new Effects(this.scene, this.kit);
    this.observer = new MutationObserver((records) => this.onMutations(records));
    this.resize = new ResizeObserver(() => this.fit());
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.figure?.classList.remove('has-3d');
      this.stop();
    });
    if (typeof IntersectionObserver !== 'undefined')
      this.visible = new IntersectionObserver((es) => {
        this.onScreen = es.some((e) => e.isIntersecting);
        this.kick();
      });
  }

  /** Binds the stage to a (re-)rendered scene: the same toys are reused for the animals still in it. */
  attach(figure: HTMLElement, svg: SVGSVGElement): void {
    if (this.disposed) return;
    if (this.figure !== figure) {
      this.figure?.removeEventListener('click', this.onClick, true);
      if (this.figure) {
        this.resize.unobserve(this.figure);
        this.visible?.unobserve(this.figure);
      }
      this.figure = figure;
      figure.appendChild(this.canvas);
      figure.addEventListener('click', this.onClick, true);
      this.resize.observe(figure);
      this.visible?.observe(figure);
    }
    this.svg = svg;
    this.observer.disconnect();
    this.observer.observe(svg, { attributes: true, subtree: true, attributeFilter: ['class', 'data-trick'] });
    this.syncFigures();
    this.fit();
    this.renderNow();
    figure.classList.add('has-3d');
    this.kick();
  }

  setLive(on: boolean): void {
    this.live = on;
    this.kick();
  }

  /** Every actor, by the figure's key (`mochi`, `friend:gumnut`). For effects and tests. */
  actor(key: string): Actor | null {
    return this.entries.get(key)?.actor ?? null;
  }

  // ---------------------------------------------------------------- figures → toys

  private syncFigures(): void {
    const svg = this.svg!;
    const keep = new Set<string>();
    for (const el of svg.querySelectorAll<SVGGElement>('.sanctuary__pet[data-gx]')) {
      const key = el.dataset.pet ?? `friend:${el.dataset.friend}`;
      const id = el.dataset.pet ?? el.dataset.friend!;
      const spec = toySpec(id);
      if (!spec) continue;
      keep.add(key);
      let e = this.entries.get(key);
      if (!e) {
        const toy = new Toy(spec, this.kit, el.dataset.mood);
        const actor = new Actor(toy, this.seedBase + hash(key));
        this.scene.add(toy.root);
        e = { actor, fig: el, seen: { classes: new Set(), trick: null } };
        this.entries.set(key, e);
      }
      e.fig = el;
      e.seen = { classes: new Set(el.classList), trick: el.dataset.trick ?? null };
      e.actor.away = el.classList.contains('is-away');
      this.place(e, Number(el.dataset.gx), Number(el.dataset.gy), Number(el.dataset.gh));
    }
    let gone = false;
    for (const [key, e] of this.entries)
      if (!keep.has(key)) {
        e.actor.toy.dispose();
        this.entries.delete(key);
        gone = true;
      }
    // Props may hang on a toy that left (a party hat): start clean.
    if (gone) this.effects.clear();
  }

  /** Stands a toy on a scene point so that it projects exactly onto the drawn figure's spot, nearer ones in front. */
  private place(e: Entry, gx: number, gy: number, gh: number): void {
    const z = (gy - VH / 2) * 0.35;
    const k = (D - z) / D;
    const root = e.actor.toy.root;
    root.position.set((gx - VW / 2) * k, (VH / 2 - gy) * k, z);
    root.scale.setScalar(gh * k);
    root.rotation.x = TILT;
    e.actor.dir = gx > VW / 2 ? -1 : 1;
  }

  // ---------------------------------------------------------------- state from the drawn figures

  private now(): number {
    return this.frozen ?? performance.now();
  }

  /** Dev only: freezes time at `ms` (null to let it run) and draws that moment. */
  freezeAt(ms: number | null): void {
    this.frozen = ms;
    this.renderNow();
  }

  private onMutations(records: MutationRecord[]): void {
    const now = this.now();
    const touched = new Set<Element>();
    for (const r of records) if (r.type === 'attributes') touched.add(r.target as Element);
    for (const el of touched) {
      const key = (el as SVGGElement).dataset?.pet ?? ((el as SVGGElement).dataset?.friend ? `friend:${(el as SVGGElement).dataset.friend}` : null);
      const e = key ? this.entries.get(key) : null;
      if (!e || e.fig !== el) continue;
      this.react(e, now);
    }
    this.kick();
  }

  private react(e: Entry, now: number): void {
    const el = e.fig;
    const reduced = this.o.reducedMotion();
    const classes = new Set(el.classList);
    for (const c of classes) {
      if (e.seen.classes.has(c)) continue;
      const m = TRACKED.exec(c);
      if (m && e.actor.ambient(m[1], now, reduced)) this.effects.ambient(m[1], e.actor, now, ambientClip(m[1])?.ms ?? 1000);
    }
    e.actor.away = classes.has('is-away');
    const trick = el.dataset.trick ?? null;
    if (trick && trick !== e.seen.trick) {
      // Under reduced motion the trick class isn't set: the face and the emote show, still.
      const moving = classes.has(`is-trick-${trick}`);
      const ms = e.actor.perform(trick, now, !moving);
      if (ms) this.effects.perform(trick, e.actor, now, ms, !moving);
    }
    e.seen = { classes, trick };
  }

  // ---------------------------------------------------------------- taps

  private onClick = (ev: MouseEvent): void => {
    if (!this.figure || (ev as MouseEvent & { __toy?: boolean }).__toy) return;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    let best: { e: Entry; d: number } | null = null;
    for (const e of this.entries.values()) {
      if (e.actor.away) continue;
      const hit = this.ray.intersectObjects(e.actor.toy.hits, false)[0];
      if (hit && (!best || hit.distance < best.d)) best = { e, d: hit.distance };
    }
    if (!best || best.e.fig.contains(ev.target as Node)) return;
    // The toy is somewhere its drawn figure isn't (mid-stroll, mid-leap): hand the tap to its figure.
    ev.stopPropagation();
    const synthetic = new MouseEvent('click', { bubbles: true, cancelable: true }) as MouseEvent & { __toy?: boolean };
    synthetic.__toy = true;
    best.e.fig.dispatchEvent(synthetic);
  };

  // ---------------------------------------------------------------- frames

  private fit(): void {
    if (!this.figure) return;
    const w = this.figure.clientWidth;
    const h = this.figure.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.renderNow();
  }

  private kick(): void {
    if (this.disposed) return;
    const run = this.live && this.onScreen && !document.hidden && !!this.figure;
    if (run && !this.raf) this.raf = requestAnimationFrame(this.tick);
    else if (!run) this.stop();
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (raf: number): void => {
    this.raf = 0;
    if (this.disposed) return;
    const now = this.frozen ?? raf;
    const reduced = this.o.reducedMotion();
    const busy = [...this.entries.values()].some((e) => e.actor.busy(now)) || this.effects.active;
    // Smooth while something is happening; a calmer frame rate for breathing; a few frames a second when still.
    const minGap = busy ? 0 : reduced ? 250 : 30;
    if (now - this.lastFrame >= minGap) {
      this.lastFrame = now;
      this.frame(now, reduced);
    }
    this.kick();
  };

  private frame(now: number, reduced: boolean): void {
    for (const e of this.entries.values()) e.actor.update(now, !reduced);
    this.effects.update(now);
    this.renderer.render(this.scene, this.camera);
  }

  private renderNow(): void {
    if (this.disposed) return;
    this.frame(this.now(), this.o.reducedMotion());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.observer.disconnect();
    this.resize.disconnect();
    this.visible?.disconnect();
    this.figure?.removeEventListener('click', this.onClick, true);
    this.figure?.classList.remove('has-3d');
    for (const e of this.entries.values()) e.actor.toy.dispose();
    this.entries.clear();
    this.effects.dispose();
    this.kit.dispose();
    this.canvas.remove();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}
