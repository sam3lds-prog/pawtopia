/**
 * Gems: bought with real money (gem packs on the App Store), spent only on premium decorations. Every purchase is
 * granted once by its store transaction id (`iap:<transactionId>`), so a double callback, a restore or a crash between
 * the purchase and the save can't grant twice, and `reconcileGemPurchases` hands out any purchase that the app didn't
 * get to record (the store keeps the list of consumable transactions).
 */

import type { SaveV2 } from '../services/storage';
import { GEM_PACKS, type GemPackId, type ProductId, type StoreTransaction } from '../services/iap';
import { grantItem } from './items';

export function isGemPack(id: ProductId): id is GemPackId {
  return id in GEM_PACKS;
}

/** Grants the gems for one purchase, once. Returns the number granted (0 if this transaction was already counted). */
export function grantGemPurchase(save: Pick<SaveV2, 'inventory'>, productId: ProductId, transactionId: string, source: 'store' | 'test', now = new Date()): number {
  if (!isGemPack(productId) || !transactionId) return 0;
  const g = grantItem(save, `iap:${transactionId}`, 'gem', GEM_PACKS[productId], source, now, productId);
  return g ? g.granted : 0;
}

/** Grants any recorded store purchase that isn't in the ledger yet. Returns the gems granted. */
export function reconcileGemPurchases(save: Pick<SaveV2, 'inventory'>, txs: StoreTransaction[], now = new Date()): number {
  let total = 0;
  for (const t of txs) total += grantGemPurchase(save, t.productId, t.transactionId, 'store', now);
  return total;
}
