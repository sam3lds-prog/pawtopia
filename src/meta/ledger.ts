/**
 * Paw Coin ledger: append-only and idempotent. Every grant or spend carries a stable id (e.g. `clear:L12`,
 * `buy:decor:lamp`); an id is applied at most once, so double taps, re-renders, replays and re-running a
 * migration can never mint or charge twice. The balance is always the sum of the ledger.
 */

import type { LedgerEntry, SaveV2 } from '../services/storage';

export type LedgerSource = LedgerEntry['source'];

export function balance(save: Pick<SaveV2, 'inventory'>): number {
  let sum = 0;
  for (const e of save.inventory.ledger) sum += e.delta;
  return sum;
}

export function hasEntry(save: Pick<SaveV2, 'inventory'>, id: string): boolean {
  return save.inventory.ledger.some((e) => e.id === id);
}

/** Adds coins once per id. Returns true if this call granted them. */
export function grant(save: Pick<SaveV2, 'inventory'>, id: string, amount: number, source: LedgerSource, now = new Date(), note?: string): boolean {
  if (!Number.isFinite(amount) || amount <= 0 || hasEntry(save, id)) return false;
  save.inventory.ledger.push({ id, delta: Math.round(amount), at: now.toISOString(), source, ...(note ? { note } : {}) });
  return true;
}

export type SpendResult = 'ok' | 'already' | 'insufficient';

/** Spends coins once per id. Never lets the balance go negative. */
export function spend(save: Pick<SaveV2, 'inventory'>, id: string, cost: number, source: LedgerSource, now = new Date(), note?: string): SpendResult {
  if (hasEntry(save, id)) return 'already';
  const c = Math.round(cost);
  if (!Number.isFinite(c) || c < 0) return 'insufficient';
  if (balance(save) < c) return 'insufficient';
  save.inventory.ledger.push({ id, delta: -c, at: now.toISOString(), source, ...(note ? { note } : {}) });
  return 'ok';
}
