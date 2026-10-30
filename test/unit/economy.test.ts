import { describe, expect, it } from 'vitest';
import { defaultSave, migrateV1 } from '../../src/services/storage';
import { balance, grant, spend } from '../../src/meta/ledger';
import { reconcileRewards, rewardsForWin, unlockedPets } from '../../src/meta/rewards';
import { recordWin, type BoardResult } from '../../src/meta/progression';
import { buyDecor, chooseStarter, isShown, setShown } from '../../src/meta/sanctuary';
import { DECOR, STARTER_DECOR, decorHome, decorTier } from '../../src/meta/catalogs/decor';
import { ECONOMY } from '../../src/config/economy';

const clean: BoardResult = { size: 5, seconds: 60, mistakes: 0, hintsUsed: 0, revives: 0, hearts: true };
const NOW = new Date('2026-10-25T12:00:00Z');

function win(s = defaultSave(NOW), level: number, r: BoardResult = clean) {
  const rec = recordWin(s, { kind: 'level', level }, r, NOW);
  return { s, rec, rewards: rewardsForWin(s, { kind: 'level', level }, rec, NOW) };
}

describe('ledger', () => {
  it('applies each id at most once', () => {
    const s = defaultSave();
    expect(grant(s, 'x', 50, 'gift')).toBe(true);
    expect(grant(s, 'x', 50, 'gift')).toBe(false);
    expect(balance(s)).toBe(50);
  });
  it('never goes negative and never charges twice', () => {
    const s = defaultSave();
    grant(s, 'seed', 100, 'gift');
    expect(spend(s, 'buy:a', 150, 'shop')).toBe('insufficient');
    expect(spend(s, 'buy:a', 60, 'shop')).toBe('ok');
    expect(spend(s, 'buy:a', 60, 'shop')).toBe('already');
    expect(balance(s)).toBe(40);
  });
  it('rejects nonsense amounts', () => {
    const s = defaultSave();
    expect(grant(s, 'nan', Number.NaN, 'gift')).toBe(false);
    expect(grant(s, 'neg', -5, 'gift')).toBe(false);
    expect(balance(s)).toBe(0);
  });
});

describe('win rewards', () => {
  it('first clear pays coins + clean bonus; replays pay nothing (regression: no farming)', () => {
    const { s, rewards } = win(undefined, 3);
    expect(rewards.coins).toBe(ECONOMY.journeyFirstClear + ECONOMY.journeyCleanBonus);
    const again = win(s, 3).rewards;
    expect(again.coins).toBe(0);
    expect(balance(s)).toBe(ECONOMY.journeyFirstClear + ECONOMY.journeyCleanBonus);
  });

  it('a first clean solve on a replay earns only the clean bonus', () => {
    const { s } = win(undefined, 4, { ...clean, mistakes: 2 });
    expect(balance(s)).toBe(ECONOMY.journeyFirstClear);
    expect(win(s, 4).rewards.coins).toBe(ECONOMY.journeyCleanBonus);
    expect(win(s, 4).rewards.coins).toBe(0);
  });

  it('Journey levels never bring animals: they come home as the sanctuary you build grows (D35)', () => {
    const { s } = win(undefined, 1);
    win(s, 5);
    win(s, 30);
    expect(s.inventory.pets).toEqual({});
    expect(s.inventory.companions).toEqual({});
  });

  it('chapter completion pays once and gifts its decoration', () => {
    const { s, rewards } = win(undefined, 20);
    expect(rewards.chapter?.index).toBe(0);
    expect(rewards.decor).toEqual(['fountain']);
    expect(rewards.lines.map((l) => l.id)).toContain('chapter:1');
    expect(win(s, 20).rewards.decor).toEqual([]);
  });

  it('dailies pay on the first clear of that date only; Zen never pays', () => {
    const s = defaultSave(NOW);
    const d = { kind: 'daily' as const, dateKey: '2026-10-25' };
    const rec = recordWin(s, d, clean, NOW);
    expect(rewardsForWin(s, d, rec, NOW).coins).toBe(ECONOMY.dailyFirstClear + ECONOMY.dailyCleanBonus);
    const rec2 = recordWin(s, d, clean, NOW);
    expect(rewardsForWin(s, d, rec2, NOW).coins).toBe(0);
    const z = { kind: 'zen' as const, size: 6, seed: 1 };
    expect(rewardsForWin(s, z, recordWin(s, z, clean, NOW), NOW).coins).toBe(0);
  });
});

describe('v1 players', () => {
  it('migration reconciles earned coins, pets and chapter gifts exactly once', () => {
    const s = migrateV1(
      { level: 22, bestTimes: {}, dailyDone: {}, streak: 0, lastDailyDate: null, installDate: '2026-01-01T00:00:00Z', removeAds: false },
      true,
      NOW,
    );
    const first = reconcileRewards(s, NOW);
    expect(first.coins).toBe(21 * ECONOMY.journeyFirstClear + ECONOMY.chapterComplete);
    // Animals come with sanctuary growth now, never from cleared levels.
    expect(unlockedPets(s)).toEqual([]);
    expect(s.inventory.decor.fountain).toBeDefined();
    expect(s.inventory.ledger.every((e) => e.source === 'migration')).toBe(true);
    const second = reconcileRewards(s, NOW);
    expect(second.coins).toBe(0);
    expect(balance(s)).toBe(first.coins);
  });

  it('a fresh player has nothing to reconcile', () => {
    expect(reconcileRewards(defaultSave()).coins).toBe(0);
  });
});

describe('sanctuary decor', () => {
  it('prices each item in exactly one currency, coin prices stay sensible, and there are three chapter gifts', () => {
    // Harmony: 15 original coin / gift items, plus special (video-token) and premium (gem) items from D27.
    expect(DECOR.filter((d) => decorHome(d) === 'harmony' && !d.tokens && !d.gems)).toHaveLength(15);
    // Each region: two coin items, one video-token item, one gem item (D28); the Farm has three coin items (D35).
    for (const r of ['outback', 'savanna', 'arctic', 'amazon'] as const) {
      const here = DECOR.filter((d) => decorHome(d) === r);
      expect(here.map(decorTier).sort(), r).toEqual(['coins', 'coins', 'premium', 'video']);
    }
    expect(
      DECOR.filter((d) => decorHome(d) === 'farm')
        .map(decorTier)
        .sort(),
    ).toEqual(['coins', 'coins', 'coins', 'premium', 'video']);
    for (const d of DECOR) {
      const currencies = [d.cost !== null, !!d.tokens, !!d.gems].filter(Boolean).length;
      if (d.unlock.kind === 'shop') {
        expect(currencies, d.id).toBe(1);
        if (d.cost !== null) {
          expect(d.cost).toBeGreaterThanOrEqual(60);
          expect(d.cost).toBeLessThanOrEqual(400);
        }
      } else expect(currencies, d.id).toBe(0);
    }
    expect(DECOR.filter((d) => d.unlock.kind === 'chapter')).toHaveLength(3);
    // Two starter gifts in each beginner sanctuary.
    expect(STARTER_DECOR.filter((id) => decorHome(DECOR.find((d) => d.id === id)!) === 'harmony')).toHaveLength(2);
    expect(STARTER_DECOR.filter((id) => decorHome(DECOR.find((d) => d.id === id)!) === 'farm')).toHaveLength(2);
  });

  it('the starter gift is one of two, once', () => {
    const s = defaultSave();
    expect(chooseStarter(s, 'fountain')).toBe(false);
    expect(chooseStarter(s, 'lamp')).toBe(true);
    expect(chooseStarter(s, 'cushion')).toBe(false);
    expect(s.inventory.decor.lamp).toBeDefined();
    expect(s.inventory.decor.cushion).toBeUndefined();
  });

  it('buying deducts exactly once; reload keeps the item', () => {
    const s = defaultSave();
    grant(s, 'seed', 200, 'gift');
    expect(buyDecor(s, 'rug')).toBe('ok');
    expect(buyDecor(s, 'rug')).toBe('owned');
    expect(balance(s)).toBe(200 - 110);
    const reloaded = JSON.parse(JSON.stringify(s));
    expect(reloaded.inventory.decor.rug).toBeDefined();
    expect(buyDecor(s, 'perch')).toBe('insufficient');
    expect(balance(s)).toBe(90);
  });

  it('chapter gifts cannot be bought', () => {
    const s = defaultSave();
    grant(s, 'seed', 5000, 'gift');
    expect(buyDecor(s, 'fountain')).toBe('not-for-sale');
    expect(balance(s)).toBe(5000);
  });

  it('owned items can be hidden and shown again', () => {
    const s = defaultSave();
    chooseStarter(s, 'cushion');
    expect(isShown(s, 'cushion')).toBe(true);
    setShown(s, 'cushion', false);
    expect(isShown(s, 'cushion')).toBe(false);
    setShown(s, 'cushion', true);
    expect(isShown(s, 'cushion')).toBe(true);
    setShown(s, 'rug', true); // not owned: no effect
    expect(isShown(s, 'rug')).toBe(false);
  });
});

import { decorIcon, sanctuaryScene } from '../../src/ui/art/sanctuary';

describe('sanctuary scene', () => {
  it('draws only shown decor and welcomed residents', () => {
    const svg = sanctuaryScene({ decor: ['rug', 'cushion'], pets: ['mochi'] });
    expect(svg).toContain('data-decor="rug"');
    expect(svg).toContain('data-decor="cushion"');
    expect(svg).not.toContain('data-decor="fountain"');
    expect(svg).toContain('data-pet="mochi"');
    expect(svg).not.toContain('data-pet="pip"');
  });
  it('every decoration has standalone art', () => {
    for (const d of DECOR) expect(decorIcon(d.id)).toMatch(/^<svg class="decor-icon" viewBox="[-\d. ]+"/);
  });
});
