/**
 * Runs decoration activities in a live sanctuary scene (D32). One at a time: tapping a decoration that has one starts
 * it with an animal from the scene, and while the screen is open an activity also starts by itself now and then (the
 * first a few seconds after arriving, then every 35–60 s). The animal's own figure steps away while its copy plays and
 * comes back after. Under reduced motion nothing starts by itself, and a tap shows the animal in place, still.
 */

import { activityFor, activityMarkup, type ActivityDef } from '../art/activities';
import { COMPANION_BY_ID, type CompanionId } from '../../meta/catalogs/companions';
import { PET_BY_ID, type PetId } from '../../meta/catalogs/pets';

export interface ActivityRunnerOptions {
  reducedMotion: boolean;
  /** Animals in the scene who can take part (resident or companion ids). */
  cast: () => string[];
  nameOf: (id: string) => string;
  /** Caption while an activity plays (null to clear). */
  caption: (text: string | null) => void;
  /** Deterministic choice in tests; Math.random otherwise. */
  random?: () => number;
}

export const AUTO_FIRST_MS: readonly [number, number] = [5000, 9000];
export const AUTO_GAP_MS: readonly [number, number] = [35000, 60000];
/** How long a still activity shows under reduced motion. */
export const STILL_MS = 3500;

export class ActivityRunner {
  private running: { decor: string; cleanup: () => void; timer: number } | null = null;
  private auto: number | null = null;
  private disposed = false;
  private live = true;
  private readonly rand: () => number;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly o: ActivityRunnerOptions,
  ) {
    this.rand = o.random ?? Math.random;
    for (const g of svg.querySelectorAll<SVGGElement>('[data-decor]')) if (activityFor(g.dataset.decor ?? '')) g.classList.add('has-act');
  }

  /** Decorations in this scene with an activity. */
  decors(): string[] {
    return [...this.svg.querySelectorAll<SVGGElement>('[data-decor].has-act')].map((g) => g.dataset.decor!);
  }

  get busy(): boolean {
    return !!this.running;
  }

  /** Starts the activity of a decoration with someone from the scene (or `who`). Returns who took part, or null. */
  play(decor: string, who?: string): string | null {
    if (this.disposed || this.running) return null;
    const def = activityFor(decor);
    const host = this.svg.querySelector<SVGGElement>(`[data-decor="${decor}"]`);
    const cast = this.o.cast();
    if (!def || !host || !cast.length) return null;
    const rider = who && cast.includes(who) ? who : cast[Math.floor(this.rand() * cast.length) % cast.length];
    this.running = { decor, ...this.mount(def, host, rider) };
    this.o.caption(def.line(this.o.nameOf(rider)));
    return rider;
  }

  private mount(def: ActivityDef, host: SVGGElement, rider: string): { cleanup: () => void; timer: number } {
    const seat = def.seat ? host.querySelector(def.seat) : null;
    (seat ?? this.svg).insertAdjacentHTML('beforeend', activityMarkup(def, rider));
    const node = (seat ?? this.svg).querySelector(`.sp-act[data-activity="${def.decor}"]`);
    const own = this.svg.querySelector(`.sanctuary__pet[data-pet="${rider}"], .sanctuary__friend[data-friend="${rider}"]`);
    own?.classList.add('is-away');
    const cls = this.o.reducedMotion ? 'is-act-still' : `is-act-${def.decor}`;
    host.classList.add(cls);
    node?.classList.add(cls);
    const cleanup = () => {
      node?.remove();
      host.classList.remove(cls);
      own?.classList.remove('is-away');
      this.o.caption(null);
    };
    const timer = window.setTimeout(() => this.finish(), this.o.reducedMotion ? STILL_MS : def.ms);
    return { cleanup, timer };
  }

  private finish(): void {
    const r = this.running;
    this.running = null;
    r?.cleanup();
    this.scheduleAuto(AUTO_GAP_MS);
  }

  /** Ends whatever is playing now. */
  stop(): void {
    const r = this.running;
    if (!r) return;
    clearTimeout(r.timer);
    this.running = null;
    r.cleanup();
  }

  /** Starts (or pauses, when hidden) the occasional activity that happens by itself. */
  setLive(on: boolean): void {
    if (this.disposed) return;
    this.live = on && !this.o.reducedMotion;
    if (this.auto !== null) clearTimeout(this.auto);
    this.auto = null;
    if (!on) this.stop();
    else this.scheduleAuto(AUTO_FIRST_MS);
  }

  private scheduleAuto([lo, hi]: readonly [number, number]): void {
    if (this.auto !== null) clearTimeout(this.auto);
    this.auto = null;
    if (!this.live || this.disposed || !this.decors().length) return;
    this.auto = window.setTimeout(() => {
      this.auto = null;
      const ds = this.decors();
      if (ds.length && !this.running) this.play(ds[Math.floor(this.rand() * ds.length) % ds.length]);
      if (!this.running) this.scheduleAuto(AUTO_GAP_MS);
    }, lo + Math.floor(this.rand() * (hi - lo)));
  }

  dispose(): void {
    this.disposed = true;
    if (this.auto !== null) clearTimeout(this.auto);
    this.auto = null;
    this.stop();
  }
}

/**
 * Wires a runner to a live scene: the cast is every animal drawn in it, names come from the catalogs, and the
 * caption borrows the line under the scene (`[data-chat]`), putting the small talk back afterwards.
 */
export function startSceneActivities(svg: SVGSVGElement, chat: HTMLElement | null, reducedMotion: boolean, nameOf: (id: string) => string): ActivityRunner {
  const span = chat?.querySelector('span') ?? null;
  const base = span?.textContent ?? '';
  const runner = new ActivityRunner(svg, {
    reducedMotion,
    cast: () => [
      // Not someone in the middle of a trick (D33).
      ...[...svg.querySelectorAll<SVGGElement>('.sanctuary__pet[data-pet]:not([data-trick])')].map((g) => g.dataset.pet!),
      ...[...svg.querySelectorAll<SVGGElement>('.sanctuary__friend[data-friend]:not([data-trick])')].map((g) => g.dataset.friend!),
    ],
    nameOf,
    caption: (text) => {
      if (!chat || !span) return;
      span.textContent = text ?? base;
      chat.hidden = !(text ?? base);
      chat.classList.toggle('is-activity', !!text);
    },
  });
  runner.setLive(!document.hidden);
  return runner;
}

/** An animal's name, resident or wildlife friend. */
export function animalName(id: string): string {
  return PET_BY_ID[id as PetId]?.name ?? COMPANION_BY_ID[id as CompanionId]?.name ?? 'Someone';
}
