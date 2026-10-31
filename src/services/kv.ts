/**
 * Key/value storage adapter. Every call is guarded: WebView/browser storage can be missing,
 * full, or throw (private mode, previews, disabled cookies). When the platform store is
 * unusable we fall back to memory so the game keeps working for the session.
 *
 * On a device (D38) the store is `@capacitor/preferences` — the app's own UserDefaults on iOS, which rides along in
 * device backups and is never evicted the way a WebView's localStorage can be — behind the same synchronous `KV`
 * interface (`NativeKV`), hydrated once before the save is read (`hydratePlatformKV`).
 */

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): void;
  keys(): string[];
}

export class MemoryKV implements KV {
  private map = new Map<string, string>();
  constructor(seed?: Record<string, string>) {
    if (seed) for (const [k, v] of Object.entries(seed)) this.map.set(k, v);
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): boolean {
    this.map.set(key, value);
    return true;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

class BrowserKV implements KV {
  private fallback = new MemoryKV();
  private usable: boolean;

  constructor() {
    this.usable = false;
    try {
      const ls = globalThis.localStorage;
      if (ls) {
        const probe = '__pawtopia_probe__';
        ls.setItem(probe, '1');
        ls.removeItem(probe);
        this.usable = true;
      }
    } catch {
      this.usable = false;
    }
  }

  getItem(key: string): string | null {
    if (!this.usable) return this.fallback.getItem(key);
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return this.fallback.getItem(key);
    }
  }

  setItem(key: string, value: string): boolean {
    if (!this.usable) return this.fallback.setItem(key, value);
    try {
      globalThis.localStorage.setItem(key, value);
      return true;
    } catch {
      // Quota exceeded or blocked: keep the value for this session.
      this.fallback.setItem(key, value);
      return false;
    }
  }

  removeItem(key: string): void {
    this.fallback.removeItem(key);
    if (!this.usable) return;
    try {
      globalThis.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  keys(): string[] {
    const out = new Set(this.fallback.keys());
    if (this.usable) {
      try {
        const ls = globalThis.localStorage;
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k !== null) out.add(k);
        }
      } catch {
        /* ignore */
      }
    }
    return [...out];
  }
}

/**
 * The async key/value store behind the native adapter: `@capacitor/preferences` on a device (the app's own
 * UserDefaults on iOS, which rides along in device backups), or a fake in tests.
 */
export interface AsyncStore {
  keys(): Promise<{ keys: string[] }>;
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
}

/**
 * Native store (D38): synchronous reads and writes, like the rest of the game expects, backed by an async store.
 *  - `hydrate()` reads every key once, before the save is loaded, so reads never wait.
 *  - Writes go to memory first, then to the store one after another (a write-behind queue keeps order), and to the
 *    WebView's localStorage too, so a build from before this one still finds the save after a rollback.
 *  - The first time it runs on a device, whatever the WebView's localStorage holds that the store doesn't (the save
 *    of every player before this build) is copied over. Only the game's own keys are touched.
 */
export class NativeKV implements KV {
  private map = new Map<string, string>();
  private queue: Promise<unknown> = Promise.resolve();
  private failures = 0;

  constructor(
    private readonly store: AsyncStore,
    private readonly mirror: KV = new BrowserKV(),
    private readonly ownPrefixes: readonly string[] = ['pawtopia.', 'cvd.'],
  ) {}

  /** Loads the store into memory and copies the WebView's own keys over, once. Resolves even if the store fails. */
  async hydrate(): Promise<void> {
    try {
      const { keys } = await this.store.keys();
      for (const k of keys) {
        const { value } = await this.store.get({ key: k });
        if (value !== null) this.map.set(k, value);
      }
      for (const k of this.mirror.keys()) {
        if (!this.ownPrefixes.some((p) => k.startsWith(p)) || this.map.has(k)) continue;
        const v = this.mirror.getItem(k);
        if (v === null) continue;
        this.map.set(k, v);
        this.enqueue(() => this.store.set({ key: k, value: v }));
      }
    } catch {
      // The store is unusable: fall back to whatever the WebView holds, so the game still plays.
      for (const k of this.mirror.keys()) {
        const v = this.mirror.getItem(k);
        if (v !== null && !this.map.has(k)) this.map.set(k, v);
      }
    }
  }

  /** Writes still on their way to the store (tests await this; the app never needs to). */
  flush(): Promise<void> {
    return this.queue.then(() => undefined);
  }

  /** How many store writes failed (surfaced for diagnostics; the memory and mirror copies still hold the value). */
  get storeFailures(): number {
    return this.failures;
  }

  private enqueue(fn: () => Promise<void>): void {
    this.queue = this.queue.then(fn).catch(() => {
      this.failures++;
    });
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): boolean {
    this.map.set(key, value);
    this.mirror.setItem(key, value);
    this.enqueue(() => this.store.set({ key, value }));
    return true;
  }

  removeItem(key: string): void {
    this.map.delete(key);
    this.mirror.removeItem(key);
    this.enqueue(() => this.store.remove({ key }));
  }

  keys(): string[] {
    return [...this.map.keys()];
  }
}

let defaultKV: KV | null = null;

/** The platform store, created lazily so tests and SSR never touch `localStorage`. */
export function platformKV(): KV {
  if (!defaultKV) defaultKV = new BrowserKV();
  return defaultKV;
}

/**
 * On a device, makes the platform store the native one and loads it, before anything reads a save. In a browser it
 * does nothing. Called once, by the bootstrap, ahead of the app's modules; a failure leaves the browser store in place.
 */
export async function hydratePlatformKV(): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Preferences } = await import('@capacitor/preferences');
    const kv = new NativeKV(Preferences);
    await kv.hydrate();
    defaultKV = kv;
  } catch {
    /* no native store here: localStorage it is */
  }
}

/** Parses JSON without throwing. */
export function safeParse<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
