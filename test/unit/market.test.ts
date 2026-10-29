import { afterEach, describe, expect, it } from 'vitest';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { grant, balance } from '../../src/meta/ledger';
import { grantItem, itemBalance, setTestEntriesCount } from '../../src/meta/items';
import { buyDecor, canAfford, decorPrice, isShown, setShown, shownDecorIds } from '../../src/meta/sanctuary';
import { DECOR, decorTier } from '../../src/meta/catalogs/decor';
import { FOODS } from '../../src/meta/catalogs/foods';
import { buyFood, feedAnimal, foodCount, FOOD_AFFECTION_PER_DAY, FOOD_CAP_EACH, friendship } from '../../src/meta/feeding';
import { grantGemPurchase, reconcileGemPurchases } from '../../src/meta/gems';
import { recordVideoReward, REWARDED_DAILY_CAP, videosLeftToday } from '../../src/app/rewarded';
import { createAdService, AdMobAdService, TestVideoAdService, UnavailableAdService, INTERSTITIALS_ENABLED } from '../../src/services/ads';
import { createIapService, RevenueCatIapService, TestStoreIapService, UnavailableIapService, GEM_PACKS } from '../../src/services/iap';

const NOW = new Date(2026, 9, 29, 15, 0, 0);
afterEach(() => setTestEntriesCount(true));

describe('decor in three currencies', () => {
  it('every shop item has exactly one price; special items cost video tokens, premium items cost gems', () => {
    for (const d of DECOR) {
      const p = decorPrice(d.id);
      if (d.unlock.kind === 'chapter') expect(p).toBeNull();
      else expect(p, d.id).not.toBeNull();
      if (decorTier(d) === 'video') expect(p?.currency).toBe('vtoken');
      if (decorTier(d) === 'premium') expect(p?.currency).toBe('gem');
    }
    expect(DECOR.some((d) => decorTier(d) === 'video')).toBe(true);
    expect(DECOR.some((d) => decorTier(d) === 'premium')).toBe(true);
  });

  it('video-token decor is bought with tokens only, once, and comes straight out', () => {
    const s = defaultSave(NOW);
    grant(s, 'g', 999, 'gift', NOW); // coins can't buy it
    expect(buyDecor(s, 'kite', NOW)).toBe('insufficient');
    grantItem(s, 'ad1', 'vtoken', 3, 'ad', NOW);
    expect(canAfford(s, 'kite')).toBe(true);
    expect(buyDecor(s, 'kite', NOW)).toBe('ok');
    expect(buyDecor(s, 'kite', NOW)).toBe('owned');
    expect(itemBalance(s, 'vtoken')).toBe(0);
    expect(balance(s)).toBe(999);
    expect(isShown(s, 'kite')).toBe(true);
  });

  it('a premium item replaces the item in its spot; bringing the old one back tucks the premium away', () => {
    const s = defaultSave(NOW);
    s.inventory.decor.fountain = { ownedAt: 'x' };
    grantItem(s, 'iap:t1', 'gem', 160, 'store', NOW);
    expect(buyDecor(s, 'goldfountain', NOW)).toBe('ok');
    expect(itemBalance(s, 'gem')).toBe(70);
    expect(shownDecorIds(s)).toContain('goldfountain');
    expect(shownDecorIds(s)).not.toContain('fountain');
    setShown(s, 'fountain', true);
    expect(shownDecorIds(s)).toContain('fountain');
    expect(shownDecorIds(s)).not.toContain('goldfountain');
  });

  it('if an old save has both out, the scene still shows one per spot (the premium one)', () => {
    const s = defaultSave(NOW);
    s.inventory.decor.fountain = { ownedAt: 'x' };
    s.inventory.decor.goldfountain = { ownedAt: 'x' };
    expect(shownDecorIds(s).filter((d) => d === 'fountain' || d === 'goldfountain')).toEqual(['goldfountain']);
  });
});

describe('gems', () => {
  it('a store purchase grants its pack once by transaction id', () => {
    const s = defaultSave(NOW);
    expect(grantGemPurchase(s, 'gems_160', 'T-1', 'store', NOW)).toBe(GEM_PACKS.gems_160);
    expect(grantGemPurchase(s, 'gems_160', 'T-1', 'store', NOW)).toBe(0);
    expect(grantGemPurchase(s, 'remove_ads', 'T-2', 'store', NOW)).toBe(0);
    expect(itemBalance(s, 'gem')).toBe(160);
  });

  it('reconcile grants purchases the app never recorded (a crash after paying), and only those', () => {
    const s = defaultSave(NOW);
    grantGemPurchase(s, 'gems_60', 'A', 'store', NOW);
    const got = reconcileGemPurchases(s, [
      { transactionId: 'A', productId: 'gems_60' },
      { transactionId: 'B', productId: 'gems_420' },
    ]);
    expect(got).toBe(420);
    expect(itemBalance(s, 'gem')).toBe(480);
    expect(reconcileGemPurchases(s, [{ transactionId: 'B', productId: 'gems_420' }])).toBe(0);
  });

  it('test-store gems never count in a release build', () => {
    const s = defaultSave(NOW);
    grantGemPurchase(s, 'gems_420', 'test-1', 'test', NOW);
    expect(itemBalance(s, 'gem')).toBe(420);
    setTestEntriesCount(false);
    expect(itemBalance(s, 'gem')).toBe(0);
    expect(buyDecor(s, 'balloon', NOW)).toBe('insufficient');
  });

  it('gems and tokens survive a save round trip', () => {
    const s = defaultSave(NOW);
    grantGemPurchase(s, 'gems_60', 'Z', 'store', NOW);
    grantItem(s, 'ad', 'vtoken', 2, 'ad', NOW);
    const back = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(itemBalance(back, 'gem')).toBe(60);
    expect(itemBalance(back, 'vtoken')).toBe(2);
  });
});

describe('food and feeding', () => {
  it('food costs coins, special treats cost video tokens, and the pantry holds a fair amount of each', () => {
    const s = defaultSave(NOW);
    grant(s, 'g', 100, 'gift', NOW);
    expect(buyFood(s, 'kibble', NOW)).toBe('ok');
    expect(balance(s)).toBe(88);
    expect(buyFood(s, 'honeycake', NOW)).toBe('insufficient');
    grantItem(s, 'ad', 'vtoken', 2, 'ad', NOW);
    expect(buyFood(s, 'honeycake', NOW)).toBe('ok');
    expect(itemBalance(s, 'vtoken')).toBe(0);
    expect(foodCount(s, 'kibble')).toBe(1);
    expect(foodCount(s, 'honeycake')).toBe(1);
    grant(s, 'g2', 10_000, 'gift', NOW);
    while (foodCount(s, 'fishbites') < FOOD_CAP_EACH) expect(buyFood(s, 'fishbites', NOW)).toBe('ok');
    expect(buyFood(s, 'fishbites', NOW)).toBe('full');
    for (const f of FOODS) expect(Number(!!f.coins) + Number(!!f.tokens), f.id).toBe(1);
  });

  it('a favorite counts double, special treats are everyone’s favorite, and an animal has a daily fill', () => {
    const s = defaultSave(NOW);
    s.inventory.pets.mochi = { unlockedAt: 'x' };
    grant(s, 'g', 10_000, 'gift', NOW);
    for (let i = 0; i < 3; i++) buyFood(s, 'fishbites', NOW);
    buyFood(s, 'kibble', NOW);
    const fav = feedAnimal(s, 'mochi', 'fishbites', NOW);
    expect(fav).toEqual({ ok: true, gained: 2, favorite: true });
    const plain = feedAnimal(s, 'mochi', 'kibble', NOW);
    expect(plain).toEqual({ ok: true, gained: 1, favorite: false });
    feedAnimal(s, 'mochi', 'fishbites', NOW); // 5
    const capped = feedAnimal(s, 'mochi', 'fishbites', NOW); // 1 left today
    expect(capped.ok && capped.gained).toBe(FOOD_AFFECTION_PER_DAY - 5);
    expect(feedAnimal(s, 'mochi', 'kibble', NOW)).toEqual({ ok: false, reason: 'full' });
    expect(s.sanctuary.affection.mochi).toBe(FOOD_AFFECTION_PER_DAY);
    // Tomorrow Mochi is hungry again; with an empty pantry nothing happens.
    const tomorrow = new Date(2026, 9, 30, 9, 0, 0);
    expect(feedAnimal(s, 'mochi', 'kibble', tomorrow)).toEqual({ ok: false, reason: 'no-food' });
  });

  it('a declined meal keeps the food in the pantry', () => {
    const s = defaultSave(NOW);
    grant(s, 'g', 10_000, 'gift', NOW);
    for (let i = 0; i < 6; i++) buyFood(s, 'berries', NOW);
    while (feedAnimal(s, 'ember', 'berries', NOW).ok);
    const left = foodCount(s, 'berries');
    expect(feedAnimal(s, 'ember', 'berries', NOW)).toEqual({ ok: false, reason: 'full' });
    expect(foodCount(s, 'berries')).toBe(left);
  });

  it('friendship levels climb with affection', () => {
    expect(friendship(0).name).toBe('New friend');
    expect(friendship(5).name).toBe('Friend');
    expect(friendship(70)).toMatchObject({ name: 'Family', next: null });
  });
});

describe('reward videos', () => {
  it('grant exactly the reward asked for, up to a gentle daily cap that resets tomorrow', () => {
    const s = defaultSave(NOW);
    expect(videosLeftToday(s, NOW)).toBe(REWARDED_DAILY_CAP);
    expect(recordVideoReward(s, 'vtoken', NOW)).toBe(true);
    expect(recordVideoReward(s, 'hint', new Date(NOW.getTime() + 1))).toBe(true);
    expect(itemBalance(s, 'vtoken')).toBe(1);
    for (let i = 2; i < REWARDED_DAILY_CAP; i++) recordVideoReward(s, 'life', new Date(NOW.getTime() + i + 1));
    expect(videosLeftToday(s, NOW)).toBe(0);
    expect(recordVideoReward(s, 'vtoken', new Date(NOW.getTime() + 999))).toBe(false);
    expect(itemBalance(s, 'vtoken')).toBe(1);
    expect(videosLeftToday(s, new Date(2026, 9, 30, 8, 0, 0))).toBe(REWARDED_DAILY_CAP);
  });

  it('pick the right ad service: AdMob only on the iOS app once set up, test videos in test builds, none otherwise', () => {
    const base = { native: false, testBuild: false, admobEnabled: false, adId: '', testAdId: 'test' };
    expect(createAdService(base)).toBeInstanceOf(UnavailableAdService);
    expect(createAdService({ ...base, testBuild: true })).toBeInstanceOf(TestVideoAdService);
    expect(createAdService({ ...base, native: true })).toBeInstanceOf(UnavailableAdService); // Info.plist not set up yet
    expect(createAdService({ ...base, native: true, admobEnabled: true })).toBeInstanceOf(AdMobAdService);
    expect(INTERSTITIALS_ENABLED).toBe(false);
  });

  it('pick the right store: RevenueCat only on the iOS app with a key, the test store in test builds, none otherwise', () => {
    expect(createIapService(false)).toBeInstanceOf(UnavailableIapService);
    expect(createIapService(true)).toBeInstanceOf(TestStoreIapService);
    expect(createIapService(false, { native: true })).toBeInstanceOf(UnavailableIapService);
    expect(createIapService(false, { native: true, revenueCatKey: 'appl_x' })).toBeInstanceOf(RevenueCatIapService);
  });
});
