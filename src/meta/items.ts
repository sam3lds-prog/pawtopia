/**
 * Treats, hint tickets and Paw Points.
 *
 * Three things that are easy to mix up are kept apart on purpose:
 *  - **Hearts** belong to one board (five on Journey and Daily) and never carry over. They live in the Session.
 *  - **Treats** and **hint tickets** are a small pantry that persists between boards. A treat gives one heart back on a
 *    casual board; a ticket pays for one hint target. Neither can be used in Paw Cup.
 *  - **Paw Points** only ever go up. They measure progress (Paw Rank) and buy nothing.
 * Paw Coins stay cosmetic-only (src/meta/ledger.ts).
 *
 * Everything goes through an append-only, idempotent item ledger with stable ids, exactly like coins: a grant or a use
 * with an id that already exists does nothing, so replays, double taps and re-runs can't mint or charge twice.
 */

import type { Difficulty } from '../engine/types';
import type { ItemEntry, SaveV2 } from '../services/storage';
import { grant } from './ledger';

export type PantryItem = 'treat' | 'hint';
export type ItemKind = ItemEntry['item'];
export type ItemSource = ItemEntry['source'];

/** Soft caps keep the pantry easy to read. Anything earned past a cap becomes coins instead of vanishing. */
export const ITEM_CAP: Record<PantryItem, number> = { treat: 10, hint: 10 };
/** Coins per item that didn't fit. */
export const OVERFLOW_COINS = 10;

/** Once for every player, new or returning (instead of back-dating rewards for old clears). */
export const STARTER_ITEMS = { id: 'starter:pantry', treat: 3, hint: 5 } as const;

/** Milestone grants for a *first* clear of a Journey level. Replays earn nothing. */
export const CLEAR_TREATS = 1;
/** One hint ticket for every second new level (even level numbers). */
export const HINT_EVERY = 2;

type Items = Pick<SaveV2, 'inventory'>;

export function itemBalance(save: Items, kind: ItemKind): number {
  let sum = 0;
  for (const e of save.inventory.items) if (e.item === kind) sum += e.delta;
  return Math.max(0, sum);
}

export function hasItemEntry(save: Items, id: string): boolean {
  return save.inventory.items.some((e) => e.id === id);
}

export interface ItemGrant {
  kind: ItemKind;
  /** How many went into the pantry. */
  granted: number;
  /** Coins given for the part that didn't fit under the cap. */
  overflowCoins: number;
}

/**
 * Grants `n` of an item once per id. Treats and tickets stop at their cap; the rest is converted to coins (also once).
 * Returns null if this id was already applied.
 */
export function grantItem(save: Items, id: string, kind: ItemKind, n: number, source: ItemSource, now = new Date(), note?: string): ItemGrant | null {
  if (!Number.isFinite(n) || n <= 0 || hasItemEntry(save, id)) return null;
  const want = Math.round(n);
  const room = kind === 'points' ? want : Math.max(0, ITEM_CAP[kind] - itemBalance(save, kind));
  const granted = Math.min(want, room);
  // The entry is written even when nothing fit, so the id is spent and can't be granted later.
  save.inventory.items.push({ id, item: kind, delta: granted, at: now.toISOString(), source, ...(note ? { note } : {}) });
  let overflowCoins = 0;
  if (granted < want) {
    const coins = (want - granted) * OVERFLOW_COINS;
    if (grant(save, `${id}:full`, coins, 'gift', now, `${kind === 'treat' ? 'Treat jar' : 'Ticket box'} full`)) overflowCoins = coins;
  }
  return { kind, granted, overflowCoins };
}

export type UseResult = 'ok' | 'already' | 'none';

/** Uses one treat or ticket, once per id. Never goes below zero. */
export function useItem(save: Items, id: string, kind: PantryItem, now = new Date(), note?: string): UseResult {
  if (hasItemEntry(save, id)) return 'already';
  if (itemBalance(save, kind) < 1) return 'none';
  save.inventory.items.push({ id, item: kind, delta: -1, at: now.toISOString(), source: 'use', ...(note ? { note } : {}) });
  return 'ok';
}

/** The one-time starter pantry. Safe to call on every launch. Returns true the one time it grants. */
export function grantStarterItems(save: Items, now = new Date()): boolean {
  if (hasItemEntry(save, `${STARTER_ITEMS.id}:treat`)) return false;
  grantItem(save, `${STARTER_ITEMS.id}:treat`, 'treat', STARTER_ITEMS.treat, 'gift', now, 'Starter pantry');
  grantItem(save, `${STARTER_ITEMS.id}:hint`, 'hint', STARTER_ITEMS.hint, 'gift', now, 'Starter pantry');
  return true;
}

// ------------------------------------------------------------------ Paw Points & Paw Rank

export const POINTS = {
  journeyBase: 100,
  dailyBase: 60,
  difficulty: { easy: 0, medium: 25, hard: 50, expert: 100 } as Record<Difficulty, number>,
  clean: 25,
  hintFree: 25,
} as const;

export interface Rank {
  index: number;
  name: string;
  /** Points where this rank starts. */
  from: number;
  /** Points where the next rank starts (null at the top). */
  next: number | null;
}

const RANKS: Array<[string, number]> = [
  ['Sprout', 0],
  ['Seedling', 1000],
  ['Sapling', 3000],
  ['Blossom', 6000],
  ['Grove', 10000],
  ['Orchard', 16000],
  ['Meadow', 25000],
  ['Sanctuary Keeper', 40000],
];

export function pawPoints(save: Items): number {
  return itemBalance(save, 'points');
}

/** Paw Rank: personal progress only. It is never shown as a competitive score and has nothing to do with Paw Cup. */
export function rankFor(points: number): Rank {
  let i = 0;
  while (i + 1 < RANKS.length && points >= RANKS[i + 1][1]) i++;
  return { index: i, name: RANKS[i][0], from: RANKS[i][1], next: i + 1 < RANKS.length ? RANKS[i + 1][1] : null };
}
