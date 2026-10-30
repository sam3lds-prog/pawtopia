import { describe, expect, it } from 'vitest';
import { growActive, setPantry, skipToLevel } from '../../src/app/qaTools';
import { itemBalance } from '../../src/meta/items';
import { reconcileRewards } from '../../src/meta/rewards';
import { defaultSave } from '../../src/services/storage';

describe('tester shortcuts', () => {
  it('skipping ahead marks earlier levels solved and the normal catch-up pays the chapter gifts once', () => {
    const s = defaultSave();
    skipToLevel(s, 46);
    expect(s.journey.nextLevel).toBe(46);
    expect(Object.keys(s.journey.clears)).toHaveLength(45);
    expect(s.onboarding.pairLessonDone).toBe(true);
    const g = reconcileRewards(s);
    expect(g.decor).toEqual(['fountain', 'tree']);
    expect(reconcileRewards(s).decor).toEqual([]);
    // Skipping to 21 leaves the two-animal lesson to play.
    const t = defaultSave();
    skipToLevel(t, 21);
    expect(t.onboarding.pairLessonDone).toBe(false);
  });

  it('growing the sanctuary you build brings its animals home, as real solves would', () => {
    const s = defaultSave();
    expect(growActive(s, 5)).toEqual(['cotton', 'truffle']);
    expect(s.world.growth.farm).toBe(5);
  });

  it('never rewinds progress or overwrites real clears', () => {
    const s = defaultSave();
    s.journey.clears.L3 = { firstClearAt: 'real', bestSeconds: 42, bestMistakes: 1, clean: false, hintFree: true, stars: 2 };
    s.journey.nextLevel = 90;
    skipToLevel(s, 31);
    expect(s.journey.nextLevel).toBe(90);
    expect(s.journey.clears.L3.firstClearAt).toBe('real');
  });

  it('sets the pantry to an exact amount through the ledger', () => {
    const s = defaultSave();
    setPantry(s, 'life', 10);
    setPantry(s, 'hint', 0);
    expect(itemBalance(s, 'life')).toBe(10);
    setPantry(s, 'life', 0);
    expect(itemBalance(s, 'life')).toBe(0);
  });
});
