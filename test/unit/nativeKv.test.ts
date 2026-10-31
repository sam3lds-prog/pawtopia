/**
 * The native store (D38 PR F): `@capacitor/preferences` behind the synchronous KV interface. Reads come from memory after
 * one hydration; writes are kept in memory, mirrored to the WebView's storage and queued to the store in order; the
 * first run copies the WebView's own keys over; a broken store never loses the game.
 */
import { describe, expect, it } from 'vitest';
import { MemoryKV, NativeKV, type AsyncStore } from '../../src/services/kv';
import { V2_KEY, defaultSave, loadSave, saveSave } from '../../src/services/storage';

/** A fake Preferences plugin: every call is really async, and can be made to fail. */
class FakeStore implements AsyncStore {
  data = new Map<string, string>();
  calls: string[] = [];
  fail = false;
  private tick = () => new Promise<void>((r) => setTimeout(r, 0));
  async keys() {
    await this.tick();
    if (this.fail) throw new Error('store down');
    return { keys: [...this.data.keys()] };
  }
  async get(o: { key: string }) {
    await this.tick();
    if (this.fail) throw new Error('store down');
    return { value: this.data.get(o.key) ?? null };
  }
  async set(o: { key: string; value: string }) {
    await this.tick();
    this.calls.push(`set ${o.key}=${o.value}`);
    if (this.fail) throw new Error('store down');
    this.data.set(o.key, o.value);
  }
  async remove(o: { key: string }) {
    await this.tick();
    this.calls.push(`remove ${o.key}`);
    if (this.fail) throw new Error('store down');
    this.data.delete(o.key);
  }
}

describe('the native store', () => {
  it('reads what the store holds, synchronously, after one hydration', async () => {
    const store = new FakeStore();
    store.data.set('pawtopia.save.v2', '{"a":1}');
    store.data.set('other.app', 'x');
    const kv = new NativeKV(store, new MemoryKV());
    expect(kv.getItem('pawtopia.save.v2')).toBeNull(); // nothing before hydration
    await kv.hydrate();
    expect(kv.getItem('pawtopia.save.v2')).toBe('{"a":1}');
    expect(kv.keys().sort()).toEqual(['other.app', 'pawtopia.save.v2']);
  });

  it('writes land in memory at once, in the mirror, and in the store in order; removes too', async () => {
    const store = new FakeStore();
    const mirror = new MemoryKV();
    const kv = new NativeKV(store, mirror);
    await kv.hydrate();
    expect(kv.setItem('pawtopia.a', '1')).toBe(true);
    kv.setItem('pawtopia.a', '2');
    kv.setItem('pawtopia.b', 'x');
    kv.removeItem('pawtopia.b');
    expect(kv.getItem('pawtopia.a')).toBe('2');
    expect(kv.getItem('pawtopia.b')).toBeNull();
    expect(mirror.getItem('pawtopia.a')).toBe('2');
    expect(mirror.getItem('pawtopia.b')).toBeNull();
    await kv.flush();
    expect(store.calls).toEqual(['set pawtopia.a=1', 'set pawtopia.a=2', 'set pawtopia.b=x', 'remove pawtopia.b']);
    expect(store.data.get('pawtopia.a')).toBe('2');
    expect(store.data.has('pawtopia.b')).toBe(false);
  });

  it('the first run on a device copies the game\'s own keys from the WebView into the store, and nothing else', async () => {
    const store = new FakeStore();
    const webview = new MemoryKV({ 'pawtopia.save.v2': '{"progressVersion":2}', 'cvd.progress.v1': '{"level":3}', 'somebody.else': 'no' });
    const kv = new NativeKV(store, webview);
    await kv.hydrate();
    expect(kv.getItem('pawtopia.save.v2')).toBe('{"progressVersion":2}');
    expect(kv.getItem('cvd.progress.v1')).toBe('{"level":3}');
    expect(kv.getItem('somebody.else')).toBeNull();
    await kv.flush();
    expect([...store.data.keys()].sort()).toEqual(['cvd.progress.v1', 'pawtopia.save.v2']);
    // The store's copy wins over a stale WebView copy on later runs.
    store.data.set('pawtopia.save.v2', '{"progressVersion":2,"newer":true}');
    const again = new NativeKV(store, webview);
    await again.hydrate();
    expect(again.getItem('pawtopia.save.v2')).toBe('{"progressVersion":2,"newer":true}');
  });

  it('a store that is down never loses the game: the WebView copy is used, and writes keep flowing there', async () => {
    const store = new FakeStore();
    store.fail = true;
    const webview = new MemoryKV({ 'pawtopia.save.v2': '{"progressVersion":2}' });
    const kv = new NativeKV(store, webview);
    await kv.hydrate();
    expect(kv.getItem('pawtopia.save.v2')).toBe('{"progressVersion":2}');
    kv.setItem('pawtopia.save.v2', '{"progressVersion":2,"x":1}');
    await kv.flush();
    expect(kv.getItem('pawtopia.save.v2')).toBe('{"progressVersion":2,"x":1}');
    expect(webview.getItem('pawtopia.save.v2')).toBe('{"progressVersion":2,"x":1}');
    expect(kv.storeFailures).toBe(1);
  });

  it('the real save round-trips through it exactly as through the browser store', async () => {
    const store = new FakeStore();
    const kv = new NativeKV(store, new MemoryKV());
    await kv.hydrate();
    const s = defaultSave(new Date('2026-10-31T12:00:00Z'));
    s.journey.nextLevel = 12;
    saveSave(s, kv);
    expect(loadSave(kv).save.journey.nextLevel).toBe(12);
    await kv.flush();
    expect(JSON.parse(store.data.get(V2_KEY)!).journey.nextLevel).toBe(12);
    // A fresh adapter over the same store (the next launch) reads it back.
    const next = new NativeKV(store, new MemoryKV());
    await next.hydrate();
    expect(loadSave(next).save.journey.nextLevel).toBe(12);
  });
});
