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
import { activityClip, ambientClip } from './clips';
import { Effects } from './effects';
import { addLights } from './lights';
import { toySpec } from './species';
import { Toy, ToyKit } from './toy';

export interface StageOptions {
  reducedMotion: () => boolean;
}

/** The camera distance, in scene units (the drawn frame is 360 × 300 in a sanctuary, smaller in a trick card). */
const D = 900;
/** How much the toys lean toward you, so you see a little of their tops. */
const TILT = 0.16;

interface Ride {
  decor: string;
  /** The drawn rider, invisible: its box is where the toy goes. */
  el: SVGGraphicsElement;
  h0: number;
  gh: number;
  lastX: number | null;
  /** Parts of the decoration that sit in front of the rider (the balloon's basket). */
  cuts: Array<{ el: Element; mesh: THREE.Mesh }>;
}

interface Entry {
  actor: Actor;
  fig: SVGGElement;
  seen: { classes: Set<string>; trick: string | null };
  home: { gx: number; gy: number; gh: number };
  ride: Ride | null;
}

/** Decoration parts drawn in front of a rider. */
const CUTS: Record<string, string[]> = { balloon: ['.sp-basket'] };
/** Activities where the rider travels, and turns to face where it goes. */
const TRAVELS: ReadonlySet<string> = new Set(['kite', 'icelanterns', 'waterfall']);

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
  private vw = 360;
  private vh = 300;
  private cutMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  /** The scene's evening wash (a tinted rect over the drawing), laid over the toys too, where they are. */
  private dusk = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color('#3b3f6b') }, amount: { value: 0.16 } },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform vec3 tint; uniform float amount; void main(){ gl_FragColor = vec4(tint * amount, amount); }',
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      // Only where something is drawn (its alpha), and leave that alpha alone.
      blendSrc: THREE.DstAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    }),
  );
  private cutGeo = new THREE.PlaneGeometry(1, 1);
  private seedBase = Math.floor(Math.random() * 1e6);
  /** Dev only: a frozen clock for stepping through a clip frame by frame. */
  private frozen: number | null = null;
  /** The WebGL context is gone (the OS took it back); the drawn animals show until it returns. */
  private lost = false;
  readonly canvas: HTMLCanvasElement;

  constructor(private readonly o: StageOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', premultipliedAlpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'scene3d';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.camera = new THREE.PerspectiveCamera((2 * Math.atan(300 / 2 / D) * 180) / Math.PI, 360 / 300, 10, 4000);
    this.camera.position.set(0, 0, D);
    addLights(this.scene);
    this.dusk.frustumCulled = false;
    this.dusk.renderOrder = 1000;
    this.dusk.visible = false;
    this.scene.add(this.dusk);
    this.effects = new Effects(this.scene, this.kit);
    this.observer = new MutationObserver((records) => this.onMutations(records));
    this.resize = new ResizeObserver(() => this.fit());
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.figure?.classList.remove('has-3d');
      this.stop();
    });
    // three.js rebuilds its GPU state when the context comes back; then the toys can show again.
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      if (!this.figure || !this.svg || this.disposed) return;
      this.renderNow();
      this.figure.classList.add('has-3d');
      this.kick();
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
    const vb = svg.viewBox?.baseVal;
    if (vb?.width && vb.height && (vb.width !== this.vw || vb.height !== this.vh)) {
      this.vw = vb.width;
      this.vh = vb.height;
      this.camera.fov = (2 * Math.atan(this.vh / 2 / D) * 180) / Math.PI;
      this.camera.aspect = this.vw / this.vh;
      this.camera.updateProjectionMatrix();
    }
    this.observer.disconnect();
    this.observer.observe(svg, { attributes: true, childList: true, subtree: true, attributeFilter: ['class', 'data-trick'] });
    this.syncFigures();
    const wash = svg.querySelector('.sp-dusk');
    this.dusk.visible = !!wash;
    if (wash) {
      const m = this.dusk.material as THREE.ShaderMaterial;
      m.uniforms.tint.value.set(wash.getAttribute('fill') ?? '#3b3f6b');
      m.uniforms.amount.value = Number(wash.getAttribute('opacity') ?? 0.16);
    }
    this.fit();
    this.renderNow();
    if (!this.lost) figure.classList.add('has-3d');
    this.kick();
  }

  setLive(on: boolean): void {
    this.live = on;
    this.kick();
  }

  /** Who is riding a decoration now, and which (tests). */
  riders(): Array<{ key: string; decor: string }> {
    return [...this.entries].filter(([, e]) => e.ride).map(([key, e]) => ({ key, decor: e.ride!.decor }));
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
      const home = { gx: Number(el.dataset.gx), gy: Number(el.dataset.gy), gh: Number(el.dataset.gh) };
      let late: string | null = null;
      if (!e) {
        const toy = new Toy(spec, this.kit, el.dataset.mood);
        const actor = new Actor(toy, this.seedBase + hash(key));
        this.scene.add(toy.root);
        e = { actor, fig: el, seen: { classes: new Set(), trick: null }, home, ride: null };
        this.entries.set(key, e);
        // The 3D code arrived while this animal was already doing a trick (drawn): take it over.
        late = el.dataset.trick ?? null;
      }
      e.fig = el;
      e.home = home;
      e.seen = { classes: new Set(el.classList), trick: el.dataset.trick ?? null };
      this.endRide(e, this.now());
      e.actor.away = el.classList.contains('is-away');
      this.place(e, home.gx, home.gy, home.gh);
      if (late) {
        for (const n of svg.querySelectorAll('.sp-trick')) n.remove();
        const moving = el.classList.contains(`is-trick-${late}`);
        const ms = e.actor.perform(late, this.now(), !moving);
        if (ms) this.effects.perform(late, e.actor, this.now(), ms, !moving);
      }
    }
    // A decoration ride that started before the 3D code arrived: the toy takes over the ride.
    for (const act of svg.querySelectorAll('.sp-act')) {
      const key = this.riderKey(act);
      const e = key ? this.entries.get(key) : null;
      if (e && !e.ride) this.startRide(e, act, this.now());
    }
    let gone = false;
    for (const [key, e] of this.entries)
      if (!keep.has(key)) {
        this.effects.clearFor(e.actor);
        e.actor.toy.dispose();
        this.entries.delete(key);
        gone = true;
      }
    void gone;
  }

  /** Stands a toy on a scene point so that it projects exactly onto the drawn figure's spot, nearer ones in front. */
  private place(e: Entry, gx: number, gy: number, gh: number, lift = 0): void {
    const z = (gy - this.vh / 2) * 0.35 + lift;
    const k = (D - z) / D;
    const root = e.actor.toy.root;
    root.position.set((gx - this.vw / 2) * k, (this.vh / 2 - gy) * k, z);
    root.scale.setScalar(gh * k);
    root.rotation.x = TILT;
    e.actor.dir = gx > this.vw / 2 ? -1 : 1;
  }

  /** A scene rectangle (the svg's own units) for an element's current box, wherever CSS has moved it. */
  private sceneBox(el: Element): { x: number; y: number; w: number; h: number } | null {
    const fr = this.svg!.getBoundingClientRect();
    if (!fr.width) return null;
    const r = el.getBoundingClientRect();
    const kx = this.vw / fr.width;
    const ky = this.vh / fr.height;
    return { x: (r.left - fr.left) * kx, y: (r.top - fr.top) * ky, w: r.width * kx, h: r.height * ky };
  }

  // ---------------------------------------------------------------- decoration rides (D32): the toy goes along

  private startRide(e: Entry, act: Element, now: number): void {
    const el = act.querySelector<SVGGraphicsElement>('.sp-rider-fig');
    const decor = (act as HTMLElement).dataset.activity ?? '';
    if (!el || !activityClip(decor)) return;
    const box = this.sceneBox(el);
    const still = act.classList.contains('is-act-still');
    const host = act.closest('[data-decor]') ?? this.svg!.querySelector(`[data-decor="${decor}"]`);
    const cuts = (CUTS[decor] ?? []).flatMap((sel) => [...(host?.querySelectorAll(sel) ?? [])]).map((c) => {
      const mesh = new THREE.Mesh(this.cutGeo, this.cutMat);
      mesh.renderOrder = -10;
      this.scene.add(mesh);
      return { el: c, mesh };
    });
    e.ride = { decor, el, h0: box?.h || 1, gh: Number(el.closest('[data-rh]')?.getAttribute('data-rh') ?? (el as unknown as HTMLElement).dataset?.rh ?? e.home.gh), lastX: null, cuts };
    e.actor.ride(decor, now, still);
    e.actor.away = false;
  }

  private endRide(e: Entry, now: number): void {
    if (!e.ride) return;
    for (const c of e.ride.cuts) c.mesh.removeFromParent();
    e.ride = null;
    e.actor.endRide(now);
    this.place(e, e.home.gx, e.home.gy, e.home.gh);
  }

  /** Carries a riding toy to where the drawn rider is now. */
  private follow(e: Entry): void {
    const r = e.ride!;
    const b = this.sceneBox(r.el);
    if (!b || !b.h) return;
    const gx = b.x + b.w / 2;
    const gy = b.y + b.h;
    // In front of the decoration it uses.
    this.place(e, gx, gy, r.gh * (b.h / r.h0), 40);
    // Faces the way the decoration takes it, smoothly.
    if (r.lastX !== null && TRAVELS.has(r.decor)) {
      const vx = gx - r.lastX;
      const want = Math.abs(vx) > 0.15 ? Math.sign(vx) * 1.1 : 0;
      e.actor.extraYaw += (want - e.actor.extraYaw) * 0.12;
    }
    r.lastX = gx;
    const z = e.actor.toy.root.position.z + 60;
    const k = (D - z) / D;
    for (const c of r.cuts) {
      const cb = this.sceneBox(c.el);
      if (!cb) continue;
      c.mesh.position.set((cb.x + cb.w / 2 - this.vw / 2) * k, (this.vh / 2 - (cb.y + cb.h / 2)) * k, z);
      c.mesh.scale.set(cb.w * k, cb.h * k, 1);
    }
  }

  // ---------------------------------------------------------------- state from the drawn figures

  private now(): number {
    return this.frozen ?? performance.now();
  }

  /** Dev only: freezes time at `ms` (null to let it run) and draws that moment. */
  freezeAt(ms: number | null): void {
    this.frozen = ms;
    this.renderNow();
    this.kick();
  }

  private onMutations(records: MutationRecord[]): void {
    const now = this.now();
    const touched = new Set<Element>();
    for (const r of records) {
      if (r.type === 'attributes') touched.add(r.target as Element);
      else {
        for (const n of r.removedNodes) if (n instanceof Element && n.matches('.sp-act')) this.rideEnded(n, now);
        for (const n of r.addedNodes) if (n instanceof Element && n.matches('.sp-act')) this.rideStarted(n, now);
      }
    }
    for (const el of touched) {
      const key = (el as SVGGElement).dataset?.pet ?? ((el as SVGGElement).dataset?.friend ? `friend:${(el as SVGGElement).dataset.friend}` : null);
      const e = key ? this.entries.get(key) : null;
      if (!e || e.fig !== el) continue;
      this.react(e, now);
    }
    this.kick();
  }

  private riderKey(act: Element): string | null {
    const id = act.querySelector<SVGGElement>('.sp-rider-fig')?.dataset.rider;
    if (!id) return null;
    return this.entries.has(id) ? id : this.entries.has(`friend:${id}`) ? `friend:${id}` : null;
  }

  private rideStarted(act: Element, now: number): void {
    const key = this.riderKey(act);
    const e = key ? this.entries.get(key) : null;
    if (e) this.startRide(e, act, now);
  }

  private rideEnded(act: Element, now: number): void {
    const key = this.riderKey(act);
    const e = key ? this.entries.get(key) : null;
    if (e?.ride) {
      this.endRide(e, now);
      e.actor.away = e.fig.classList.contains('is-away');
    }
  }

  private react(e: Entry, now: number): void {
    const el = e.fig;
    const reduced = this.o.reducedMotion();
    const classes = new Set(el.classList);
    for (const c of classes) {
      if (e.seen.classes.has(c)) continue;
      const m = TRACKED.exec(c);
      if (m && e.actor.ambient(m[1], now, reduced)) this.effects.ambient(m[1], e.actor, now, ambientClip(m[1])?.ms ?? 1000, reduced);
    }
    // Away on a decoration: shown riding it instead (D32).
    e.actor.away = classes.has('is-away') && !e.ride;
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
    if (!this.figure || this.lost || (ev as MouseEvent & { __toy?: boolean }).__toy) return;
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
    const run = this.live && this.onScreen && !document.hidden && !!this.figure && !this.lost;
    if (run && !this.raf) this.raf = requestAnimationFrame(this.tick);
    else if (!run) this.stop();
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (raf: number): void => {
    this.raf = 0;
    if (this.disposed || this.frozen !== null) return;
    const now = raf;
    const reduced = this.o.reducedMotion();
    const busy = [...this.entries.values()].some((e) => e.actor.busy(now) || !!e.ride) || this.effects.active;
    // Smooth while something is happening; a calmer frame rate for breathing; a few frames a second when nothing
    // moves (reduced motion: faces change, nothing travels).
    const minGap = reduced ? 120 : busy ? 0 : 30;
    if (now - this.lastFrame >= minGap) {
      this.lastFrame = now;
      this.frame(now, reduced);
    }
    this.kick();
  };

  private frame(now: number, reduced: boolean): void {
    for (const e of this.entries.values()) {
      if (e.ride) this.follow(e);
      e.actor.update(now, !reduced);
    }
    this.effects.update(now);
    this.renderer.render(this.scene, this.camera);
  }

  private renderNow(): void {
    if (this.disposed || this.lost) return;
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
    for (const e of this.entries.values()) {
      for (const c of e.ride?.cuts ?? []) c.mesh.removeFromParent();
      e.actor.toy.dispose();
    }
    this.entries.clear();
    this.effects.dispose();
    this.cutGeo.dispose();
    this.cutMat.dispose();
    this.dusk.geometry.dispose();
    (this.dusk.material as THREE.Material).dispose();
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
