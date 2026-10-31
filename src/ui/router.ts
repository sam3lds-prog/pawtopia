/**
 * Screen lifecycle. Each mounted screen gets a Scope that owns its timers, listeners, sheets and async
 * work. Navigating away disposes the scope, so nothing from an old screen can fire into a new one
 * (the v1 stale-callback bug class). Async code checks `scope.alive` after every await.
 */

import type { AnimalId } from '../meta/animals';
import type { RegionId, SanctuaryId } from '../meta/catalogs/sanctuaries';

export class Scope {
  private disposers: Array<() => void> = [];
  private controller = new AbortController();
  private children = new Set<Scope>();
  private _alive = true;
  private readonly parent: Scope | null;

  constructor(parent: Scope | null = null) {
    this.parent = parent;
  }

  get alive(): boolean {
    return this._alive;
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  timeout(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      if (this._alive) fn();
    }, ms);
    this.onDispose(() => clearTimeout(id));
    return id;
  }

  interval(fn: () => void, ms: number): number {
    const id = window.setInterval(() => {
      if (this._alive) fn();
    }, ms);
    this.onDispose(() => clearInterval(id));
    return id;
  }

  frame(fn: () => void): void {
    const id = requestAnimationFrame(() => {
      if (this._alive) fn();
    });
    this.onDispose(() => cancelAnimationFrame(id));
  }

  on<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): void;
  on(target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void;
  on(target: EventTarget, type: string, fn: (e: Event) => void, opts: AddEventListenerOptions = {}): void {
    target.addEventListener(type, fn, { ...opts, signal: this.controller.signal });
  }

  onDispose(fn: () => void): void {
    if (!this._alive) {
      fn();
      return;
    }
    this.disposers.push(fn);
  }

  /** A nested scope (e.g. a sheet) that dies with its parent or on its own. */
  child(): Scope {
    const c = new Scope(this);
    this.children.add(c);
    if (!this._alive) c.dispose();
    return c;
  }

  /** Resolves after `ms` only while alive; never resolves after disposal. */
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.timeout(resolve, ms));
  }

  dispose(): void {
    if (!this._alive) return;
    this._alive = false;
    for (const c of [...this.children]) c.dispose();
    this.children.clear();
    this.controller.abort();
    const ds = this.disposers.splice(0).reverse();
    for (const d of ds) {
      try {
        d();
      } catch (err) {
        console.error(err);
      }
    }
    this.parent?.children.delete(this);
  }
}

/** The four bottom tabs (D36): Journey is the play hub, World the result, Challenges the Paw Cup and leaderboard. */
export type TabId = 'journey' | 'world' | 'challenges' | 'shop';

export type Route =
  /** The play hub; `view: 'path'` is the chapter path (every unlocked level), `chapter` picks a chapter there. */
  | { screen: 'journey'; view?: 'path'; chapter?: number }
  | { screen: 'pets' }
  | { screen: 'challenges'; tab?: 'leaderboard' | 'week' | 'daily' }
  | { screen: 'shop'; sanctuary?: SanctuaryId; tab?: 'decor' | 'tricks' | 'food' | 'gems' }
  | { screen: 'sanctuary'; welcome?: AnimalId[] }
  | { screen: 'world' }
  | { screen: 'region'; id: RegionId; fresh?: number; welcome?: AnimalId[] }
  | { screen: 'game' }
  | { screen: 'gallery' }
  | { screen: 'welcome' }
  | { screen: 'profile' }
  // Older names, kept so saved links, tests and old call sites still land somewhere sensible (see `canonical`).
  | { screen: 'home' }
  | { screen: 'play'; chapter?: number }
  | { screen: 'league'; tab?: 'leaderboard' | 'week' | 'daily' };

/** The screens that are really pages. */
export type CanonicalRoute = Exclude<Route, { screen: 'home' } | { screen: 'play' } | { screen: 'league' }>;

/** Old route names map onto the four-tab layout: Home and Play are Journey (Play is its level path), League is Challenges. */
export function canonical(route: Route): CanonicalRoute {
  switch (route.screen) {
    case 'home':
      return { screen: 'journey' };
    case 'play':
      return route.chapter === undefined ? { screen: 'journey', view: 'path' } : { screen: 'journey', view: 'path', chapter: route.chapter };
    case 'league':
      return route.tab === undefined ? { screen: 'challenges' } : { screen: 'challenges', tab: route.tab };
    default:
      return route;
  }
}

export interface ScreenDef {
  /** Which bottom-nav tab is highlighted; null hides the nav (focused play). */
  tab: TabId | null;
  title: string;
  mount(root: HTMLElement, scope: Scope, route: CanonicalRoute): void;
}

type Registry = Record<CanonicalRoute['screen'], ScreenDef>;

/** Where the player was, and how far down they had read, so Back lands them exactly there. */
interface HistoryEntry {
  route: CanonicalRoute;
  scroll: number;
}

/** Most places Back can retrace; older ones fall off. */
const HISTORY_MAX = 24;

export class Router {
  private scope: Scope | null = null;
  private current: CanonicalRoute | null = null;
  private registry: Registry | null = null;
  private readonly listeners = new Set<(r: CanonicalRoute, def: ScreenDef) => void>();
  /** Screens behind the current one, oldest first. A board (`game`) is never kept: there is nothing to come back to. */
  private history: HistoryEntry[] = [];

  constructor(private readonly root: HTMLElement) {}

  register(reg: Registry): void {
    this.registry = reg;
  }

  get route(): CanonicalRoute | null {
    return this.current;
  }

  /** The screen Back would return to, if any. */
  get previous(): CanonicalRoute | null {
    return this.history[this.history.length - 1]?.route ?? null;
  }

  onChange(fn: (r: CanonicalRoute, def: ScreenDef) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Opens a screen, remembering the one being left (and its scroll position) so `back()` can return to it. */
  go(route: Route): void {
    if (this.current && this.current.screen !== 'game') {
      this.history.push({ route: this.current, scroll: window.scrollY });
      if (this.history.length > HISTORY_MAX) this.history.splice(0, this.history.length - HISTORY_MAX);
    }
    this.mount(canonical(route), 0);
  }

  /** Opens a tab's own screen and forgets the trail that led here: a tab is a fresh start. */
  reset(route: Route): void {
    this.history = [];
    this.mount(canonical(route), 0);
  }

  /**
   * Returns to the previous screen, where the player left off (same scroll position). With no screen behind this one
   * (a deep link, the start of the app), `fallback` opens instead. A finished board is never returned to.
   */
  back(fallback: Route): void {
    const entry = this.history.pop();
    if (entry) this.mount(entry.route, entry.scroll);
    else this.mount(canonical(fallback), 0);
  }

  /** Re-mounts the current screen (e.g. after a settings change), keeping the reader's place. */
  refresh(): void {
    if (this.current) this.mount(this.current, window.scrollY);
  }

  private mount(route: CanonicalRoute, scroll: number): void {
    if (!this.registry) throw new Error('router not registered');
    const def = this.registry[route.screen];
    this.scope?.dispose();
    this.root.replaceChildren();
    const scope = new Scope();
    this.scope = scope;
    this.current = route;
    this.root.dataset.screen = route.screen;
    for (const fn of this.listeners) fn(route, def);
    def.mount(this.root, scope, route);
    if (scope.alive && this.current === route) {
      // Move focus to the new screen's heading for screen-reader users, without scrolling.
      const heading = this.root.querySelector<HTMLElement>('[data-autofocus], h1');
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
      window.scrollTo({ top: scroll });
      // Content that arrives a beat later (thumbnails, lists) can grow the page: settle on the remembered place once more.
      if (scroll > 0) scope.frame(() => window.scrollTo({ top: scroll }));
    }
  }
}
