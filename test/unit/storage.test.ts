import { describe, expect, it } from 'vitest';
import { MemoryKV, platformKV } from '../../src/services/kv';
import {
  V1_BACKUP_KEY,
  V1_KEY,
  V1_RULES_KEY,
  V2_KEY,
  defaultSave,
  loadSave,
  normalizeSave,
  resetProgress,
  saveSave,
  type ProgressV1,
} from '../../src/services/storage';

const NOW = new Date('2026-10-25T15:00:00Z');

const v1Fixture: ProgressV1 = {
  level: 14,
  bestTimes: { L1: 31, L2: 44, L13: 120, 'D2026-10-23': 300, 'D2026-10-24': 250 },
  dailyDone: { '2026-10-23': true, '2026-10-24': true },
  streak: 2,
  lastDailyDate: '2026-10-24',
  installDate: '2026-10-01T10:00:00.000Z',
  removeAds: true,
  settings: { autoMark: false, haptics: false, sound: true },
};

describe('v1 → v2 migration', () => {
  it('keeps levels, best times, dailies, streak, settings and the ad entitlement', () => {
    const kv = new MemoryKV({ [V1_KEY]: JSON.stringify(v1Fixture), [V1_RULES_KEY]: '1' });
    const { save, source } = loadSave(kv, NOW);
    expect(source).toBe('migrated-v1');
    // v1's two-animal levels moved up by 20 for D35 (level 14 is now 34, on the very same board).
    expect(save.journey.nextLevel).toBe(34);
    expect(save.journey.bestTimes).toEqual({ L21: 31, L22: 44, L33: 120 });
    expect(save.daily.bestTimes).toEqual({ 'D2026-10-23': 300, 'D2026-10-24': 250 });
    expect(Object.keys(save.daily.done).sort()).toEqual(['2026-10-23', '2026-10-24']);
    expect(save.daily.streak).toBe(2);
    expect(save.daily.lastDate).toBe('2026-10-24');
    expect(save.installDate).toBe('2026-10-01T10:00:00.000Z');
    expect(save.settings.autoMark).toBe(false);
    expect(save.settings.haptics).toBe(false);
    expect(save.purchases.removeAds).toEqual({ active: true, source: 'legacy-v1', verifiedAt: null });
    expect(save.onboarding.seenRules).toBe(true);
    expect(save.onboarding.tutorialDone).toBe(true);
    expect(save.migratedFrom).toBe('v1');
  });

  it('records every previously cleared level so replays cannot mint first-clear rewards again', () => {
    const kv = new MemoryKV({ [V1_KEY]: JSON.stringify(v1Fixture) });
    const { save } = loadSave(kv, NOW);
    for (let L = 21; L < 34; L++) expect(save.journey.clears[`L${L}`]).toBeDefined();
    expect(save.journey.clears.L34).toBeUndefined();
    // The new one-animal levels are not marked solved.
    for (let L = 1; L <= 20; L++) expect(save.journey.clears[`L${L}`]).toBeUndefined();
  });

  it('backs up v1, never deletes it, and is idempotent on the next launch', () => {
    const raw = JSON.stringify(v1Fixture);
    const kv = new MemoryKV({ [V1_KEY]: raw });
    const first = loadSave(kv, NOW);
    expect(kv.getItem(V1_KEY)).toBe(raw);
    expect(kv.getItem(V1_BACKUP_KEY)).toBe(raw);
    expect(kv.getItem(V2_KEY)).not.toBeNull();
    const second = loadSave(kv, NOW);
    expect(second.source).toBe('v2');
    expect(second.save).toEqual(first.save);
  });

  it('a crash after the backup but before v2 was written simply migrates again', () => {
    const raw = JSON.stringify(v1Fixture);
    const kv = new MemoryKV({ [V1_KEY]: raw, [V1_BACKUP_KEY]: raw });
    const { save, source } = loadSave(kv, NOW);
    expect(source).toBe('migrated-v1');
    expect(save.journey.nextLevel).toBe(34);
  });

  it('survives a corrupted v1 save', () => {
    const kv = new MemoryKV({ [V1_KEY]: '{not json' });
    const { save } = loadSave(kv, NOW);
    expect(save.journey.nextLevel).toBe(1);
    expect(save.migratedFrom).toBe('v1');
  });

  it('survives a v1 save with wrong types', () => {
    const kv = new MemoryKV({
      [V1_KEY]: JSON.stringify({ level: 'seven', bestTimes: { L1: 'fast', L2: -5, L3: 40 }, dailyDone: 7, streak: null, settings: 'x' }),
    });
    const { save } = loadSave(kv, NOW);
    expect(save.journey.nextLevel).toBe(1);
    expect(save.journey.bestTimes).toEqual({ L3: 40 });
    expect(save.daily.streak).toBe(0);
    expect(save.settings).toEqual(defaultSave(NOW).settings);
  });

  it('a corrupted v2 save falls back to migrating v1 and keeps a copy of the bad data', () => {
    const kv = new MemoryKV({ [V2_KEY]: '{{{', [V1_KEY]: JSON.stringify(v1Fixture) });
    const { save, source } = loadSave(kv, NOW);
    expect(source).toBe('migrated-v1');
    expect(save.journey.nextLevel).toBe(34);
    expect(kv.getItem('pawtopia.corrupt.v2')).toBe('{{{');
  });

  it('first run with empty storage gives a fresh save', () => {
    const { save, source } = loadSave(new MemoryKV(), NOW);
    expect(source).toBe('fresh');
    expect(save).toEqual(defaultSave(NOW));
  });
});

describe('v2 normalization', () => {
  it('fills missing sections with defaults', () => {
    const s = normalizeSave({ progressVersion: 2, journey: { nextLevel: 9 } }, NOW);
    expect(s.journey.nextLevel).toBe(9);
    expect(s.inventory.ledger).toEqual([]);
    expect(s.settings.controls).toBe('place');
  });

  describe('controls move to "one tap places" (D36)', () => {
    const played = { tutorialDone: true, sessions: 12 };
    it('a player on D35\'s default moves with the default and is told once', () => {
      const s = normalizeSave({ progressVersion: 2, journey: { nextLevel: 9 }, settings: { controls: 'tap' }, onboarding: played }, NOW);
      expect(s.settings.controls).toBe('place');
      expect(s.settings.controlsVersion).toBe(2);
      expect(s.onboarding.controlsNotice).toBe(true);
      // Once saved, the same save loads as it is: no second move, and the notice flag is theirs to clear.
      const again = normalizeSave(JSON.parse(JSON.stringify({ ...s, onboarding: { ...s.onboarding, controlsNotice: false } })), NOW);
      expect(again.settings.controls).toBe('place');
      expect(again.onboarding.controlsNotice).toBe(false);
    });
    it('a player who chose the tap cycle keeps it, with no notice', () => {
      const s = normalizeSave({ progressVersion: 2, settings: { controls: 'classic' }, onboarding: played }, NOW);
      expect(s.settings.controls).toBe('classic');
      expect(s.onboarding.controlsNotice).toBe(false);
    });
    it('tap and double-tap chosen under the new options stays chosen', () => {
      const s = normalizeSave({ progressVersion: 2, settings: { controls: 'tap', controlsVersion: 2 }, onboarding: played }, NOW);
      expect(s.settings.controls).toBe('tap');
      expect(s.onboarding.controlsNotice).toBe(false);
    });
    it('a save that never played, and a fresh install, get the new default without a notice', () => {
      expect(normalizeSave({ progressVersion: 2, settings: { controls: 'tap' } }, NOW).onboarding.controlsNotice).toBe(false);
      expect(defaultSave(NOW).settings.controls).toBe('place');
      expect(defaultSave(NOW).onboarding.controlsNotice).toBe(false);
    });
    it('the retired "tools" spelling is the place scheme', () => {
      expect(normalizeSave({ progressVersion: 2, settings: { controls: 'tools' }, onboarding: played }, NOW).settings.controls).toBe('place');
    });
  });

  it('drops duplicate or malformed ledger entries', () => {
    const s = normalizeSave(
      {
        progressVersion: 2,
        inventory: {
          ledger: [
            { id: 'clear:L1', delta: 35, at: 'x', source: 'journey' },
            { id: 'clear:L1', delta: 35, at: 'y', source: 'journey' },
            { id: 'bad', delta: 'lots' },
            { delta: 5 },
          ],
        },
      },
      NOW,
    );
    expect(s.inventory.ledger).toHaveLength(1);
    expect(s.inventory.ledger[0].id).toBe('clear:L1');
  });

  it('round-trips through save/load unchanged', () => {
    const kv = new MemoryKV();
    const s = defaultSave(NOW);
    s.journey.nextLevel = 33;
    s.inventory.ledger.push({ id: 'clear:L1', delta: 35, at: NOW.toISOString(), source: 'journey' });
    s.settings.leftHanded = true;
    saveSave(s, kv);
    expect(loadSave(kv, NOW).save).toEqual(s);
  });
});

describe('scoped reset', () => {
  it('removes only app-owned keys and keeps purchases and settings', () => {
    const kv = new MemoryKV({
      [V1_KEY]: JSON.stringify(v1Fixture),
      [V1_RULES_KEY]: '1',
      'pawtopia.something': 'x',
      'other-app.token': 'keep-me',
      theme: 'dark',
    });
    const { save } = loadSave(kv, NOW);
    save.settings.highContrast = true;
    const fresh = resetProgress(save, kv, NOW);
    expect(kv.getItem('other-app.token')).toBe('keep-me');
    expect(kv.getItem('theme')).toBe('dark');
    expect(kv.getItem(V1_KEY)).toBeNull();
    expect(kv.getItem('pawtopia.something')).toBeNull();
    expect(fresh.journey.nextLevel).toBe(1);
    expect(fresh.purchases.removeAds.active).toBe(true);
    expect(fresh.settings.highContrast).toBe(true);
    // And the reset save is what loads next time (no resurrection of v1).
    expect(loadSave(kv, NOW).save.journey.nextLevel).toBe(1);
  });
});

describe('platform storage guard', () => {
  it('keeps working when localStorage throws on every call', () => {
    const g = globalThis as unknown as { localStorage?: unknown };
    const saved = g.localStorage;
    g.localStorage = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('SecurityError');
      },
      removeItem() {
        throw new Error('SecurityError');
      },
      key() {
        throw new Error('SecurityError');
      },
      length: 0,
    };
    try {
      const kv = platformKV();
      expect(() => loadSave(kv, NOW)).not.toThrow();
      expect(kv.setItem('pawtopia.x', '1')).toBeTypeOf('boolean');
      expect(kv.getItem('pawtopia.x')).toBe('1'); // memory fallback for the session
    } finally {
      g.localStorage = saved;
    }
  });
});

describe('regressions from review', () => {
  it('erasing progress keeps Paw Cup attempt records (no fresh attempts)', () => {
    const kv = new MemoryKV();
    const s = defaultSave();
    s.cup.attempts['C2026-W44-0'] = [
      { at: 'x', completed: true, seconds: 90, mistakes: 0, score: 850 },
      { at: 'y', completed: false, seconds: 0, mistakes: 0, score: 0 },
    ];
    const fresh = resetProgress(s, kv);
    expect(fresh.cup.attempts['C2026-W44-0']).toHaveLength(2);
    expect(fresh.journey.nextLevel).toBe(1);
  });

  it('open Paw Cup attempts round-trip in their own slots; junk is dropped', () => {
    const s = defaultSave();
    const good = { mode: { kind: 'cup', weekKey: '2026-W44', index: 2 }, digest: 'abc', generatorVersion: 1, savedAt: 'x', snap: { v: 1, cells: [] } };
    const back = normalizeSave(JSON.parse(JSON.stringify({ ...s, cup: { attempts: {}, open: { 'C2026-W44-2': good, bad: { nope: 1 } } } })));
    expect(Object.keys(back.cup.open)).toEqual(['C2026-W44-2']);
    expect(normalizeSave({ progressVersion: 2 }).cup.open).toEqual({});
  });
});
