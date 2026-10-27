/**
 * Tester shortcuts, so a tester on a phone can reach later content without playing every level first.
 * Only in development builds and in the tester preview (`npm run artifact -- --qa`); never in a release build
 * (`featureFlags.qaTools`). Everything here edits the local save the same way real play would; rewards for the skipped
 * levels then arrive through the normal startup catch-up (residents, companions, chapter gifts, Paw Points), once.
 */

import type { SaveV2 } from '../services/storage';
import { itemBalance, type PantryItem } from '../meta/items';

/** Marks levels 1..(next-1) solved (clean, three stars, one minute each) and makes `next` the next level. */
export function skipToLevel(save: SaveV2, next: number, now = new Date()): void {
  const at = now.toISOString();
  for (let L = 1; L < next; L++) {
    const key = `L${L}`;
    if (save.journey.clears[key]) continue;
    save.journey.clears[key] = { firstClearAt: at, bestSeconds: 60, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    save.journey.bestTimes[key] ??= 60;
  }
  save.journey.nextLevel = Math.max(save.journey.nextLevel, next);
  Object.assign(save.onboarding, { seenRules: true, tutorialDone: true, starterDecorChosen: true });
}

/** Sets a pantry item to exactly `n` (recorded as a tester entry, so the ledger stays the source of truth). */
export function setPantry(save: SaveV2, item: PantryItem, n: number, now = new Date()): void {
  const delta = n - itemBalance(save, item);
  if (!delta) return;
  save.inventory.items.push({ id: `qa:${item}:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`, item, delta, at: now.toISOString(), source: 'gift', note: 'Tester shortcut' });
}
