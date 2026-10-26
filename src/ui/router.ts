/**
 * Screen lifecycle. Each mounted screen gets a Scope that owns its timers, listeners, sheets and async
 * work. Navigating away disposes the scope, so nothing from an old screen can fire into a new one
 * (the v1 stale-callback bug class). Async code checks `scope.alive` after every await.
 */

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

export type TabId = 'play' | 'home' | 'pets' | 'league' | 'shop';

export type Route =
  | { screen: 'home' }
  | { screen: 'play'; chapter?: number }
  | { screen: 'pets' }
  | { screen: 'league' }
  | { screen: 'shop' }
  | { screen: 'sanctuary' }
  | { screen: 'game' }
  | { screen: 'gallery' };

export interface ScreenDef {
  /** Which bottom-nav tab is highlighted; null hides the nav (focused play). */
  tab: TabId | null;
  title: string;
  mount(root: HTMLElement, scope: Scope, route: Route): void;
}

type Registry = Record<Route['screen'], ScreenDef>;

export class Router {
  private scope: Scope | null = null;
  private current: Route | null = null;
  private registry: Registry | null = null;
  private readonly listeners = new Set<(r: Route, def: ScreenDef) => void>();

  constructor(private readonly root: HTMLElement) {}

  register(reg: Registry): void {
    this.registry = reg;
  }

  get route(): Route | null {
    return this.current;
  }

  onChange(fn: (r: Route, def: ScreenDef) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  go(route: Route): void {
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
    if (scope.alive) {
      // Move focus to the new screen's heading for screen-reader users, without scrolling.
      const heading = this.root.querySelector<HTMLElement>('[data-autofocus], h1');
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
      window.scrollTo({ top: 0 });
    }
  }

  /** Re-mounts the current screen (e.g. after a settings change). */
  refresh(): void {
    if (this.current) this.go(this.current);
  }
}
