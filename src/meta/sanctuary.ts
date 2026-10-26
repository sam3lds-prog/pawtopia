/** Sanctuary inventory: the free starter gift, buying decor with Paw Coins, and showing / hiding owned items. */

import type { SaveV2 } from '../services/storage';
import { DECOR_BY_ID, STARTER_DECOR, type DecorId } from './catalogs/decor';
import { balance, spend } from './ledger';

export function owns(save: Pick<SaveV2, 'inventory'>, id: DecorId): boolean {
  return !!save.inventory.decor[id];
}

/** The first-board gift: one of the two starter items, once. */
export function chooseStarter(save: SaveV2, id: DecorId, now = new Date()): boolean {
  if (save.onboarding.starterDecorChosen || !STARTER_DECOR.includes(id)) return false;
  save.onboarding.starterDecorChosen = true;
  if (!owns(save, id)) save.inventory.decor[id] = { ownedAt: now.toISOString() };
  return true;
}

export type BuyResult = 'ok' | 'owned' | 'not-for-sale' | 'insufficient';

/** Buys a decoration with Paw Coins. Charges exactly once; a second tap returns 'owned'. */
export function buyDecor(save: SaveV2, id: DecorId, now = new Date()): BuyResult {
  const d = DECOR_BY_ID[id];
  if (!d) return 'not-for-sale';
  if (owns(save, id)) return 'owned';
  if (d.unlock.kind !== 'shop' || d.cost === null) return 'not-for-sale';
  const r = spend(save, `buy:decor:${id}`, d.cost, 'shop', now, d.name);
  if (r === 'insufficient') return 'insufficient';
  // 'already' means a previous purchase was charged but not recorded as owned (e.g. a crash between writes): own it.
  save.inventory.decor[id] = { ownedAt: now.toISOString() };
  return 'ok';
}

export function canAfford(save: Pick<SaveV2, 'inventory'>, id: DecorId): boolean {
  const c = DECOR_BY_ID[id]?.cost;
  return c !== null && c !== undefined && balance(save) >= c;
}

export function isShown(save: Pick<SaveV2, 'inventory' | 'sanctuary'>, id: DecorId): boolean {
  return owns(save, id) && !save.sanctuary.hidden[id];
}

export function setShown(save: SaveV2, id: DecorId, shown: boolean): void {
  if (!owns(save, id)) return;
  if (shown) delete save.sanctuary.hidden[id];
  else save.sanctuary.hidden[id] = true;
}
