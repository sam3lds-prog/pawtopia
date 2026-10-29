import { describe, expect, it } from 'vitest';
import { setPantry, skipToLevel } from '../../src/app/qaTools';
import { itemBalance } from '../../src/meta/items';
import { reconcileRewards } from '../../src/meta/rewards';
import { defaultSave } from '../../src/services/storage';

describe('tester shortcuts', () => {
  it('skipping ahead marks earlier levels solved and the normal catch-up welcomes everyone once', () => {
    const s = defaultSave();
    skipToLevel(s, 46);
    expect(s.journey.nextLevel).toBe(46);
    expect(Object.keys(s.journey.clears)).toHaveLength(45);
    const g = reconcileRewards(s);
    expect(g.pets).toHaveLength(6);
    expect(g.companions).toEqual(['ember', 'maple']);
    expect(reconcileRewards(s).companions).toEqual([]);
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
