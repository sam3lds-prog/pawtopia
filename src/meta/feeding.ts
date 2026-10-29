/**
 * Buying food and feeding residents and wildlife friends. Cosmetic only: feeding adds affection (a friendship level on
 * the animal's card) and makes the animal happy in the garden. Nothing here touches puzzles, rewards or rankings.
 *
 * Food is kept in the item ledger (`food` entries with a `ref`), bought with Paw Coins or video tokens, and every buy
 * and every meal has its own id, so a double tap can't charge or feed twice by accident.
 */

import type { SaveV2 } from '../services/storage';
import { localDateKey } from '../game/dates';
import { FOOD_BY_ID, isFavorite, type AnimalKind, type FoodId } from './catalogs/foods';
import { PET_BY_ID, isPetId } from './catalogs/pets';
import { COMPANION_BY_ID, isCompanionId } from './catalogs/companions';
import { balance, spend } from './ledger';
import { grantItem, itemBalance, refBalance, spendItem } from './items';

/** At most this many of one food in the pantry. */
export const FOOD_CAP_EACH = 30;
/** Affection an animal can gain from food per day (pats are separate, one a day). */
export const FOOD_AFFECTION_PER_DAY = 6;

let seq = 0;
const uid = (now: Date) => `${now.getTime().toString(36)}${(seq++).toString(36)}`;

export function foodCount(save: Pick<SaveV2, 'inventory'>, food: FoodId): number {
  return refBalance(save, 'food', food);
}

export type BuyFoodResult = 'ok' | 'insufficient' | 'full';

/** Buys one portion of a food with its currency. */
export function buyFood(save: SaveV2, food: FoodId, now = new Date()): BuyFoodResult {
  const f = FOOD_BY_ID[food];
  if (foodCount(save, food) >= FOOD_CAP_EACH) return 'full';
  const id = `buy:food:${food}:${uid(now)}`;
  if (f.coins) {
    if (balance(save) < f.coins) return 'insufficient';
    if (spend(save, id, f.coins, 'shop', now, f.name) !== 'ok') return 'insufficient';
  } else if (f.tokens) {
    if (itemBalance(save, 'vtoken') < f.tokens) return 'insufficient';
    if (spendItem(save, id, 'vtoken', f.tokens, now, f.name) !== 'ok') return 'insufficient';
  } else return 'insufficient';
  grantItem(save, `${id}:got`, 'food', 1, 'shop', now, f.name, food);
  return 'ok';
}

/** The kind of animal a resident or companion is, for food favorites. */
export function animalKindOf(id: string): AnimalKind | null {
  if (isPetId(id)) return PET_BY_ID[id].species;
  if (isCompanionId(id)) return COMPANION_BY_ID[id].animal;
  return null;
}

export type FeedResult = { ok: true; gained: number; favorite: boolean } | { ok: false; reason: 'no-food' | 'full' | 'unknown' };

/** Affection gained from food today by one animal. */
export function fedToday(save: Pick<SaveV2, 'sanctuary'>, animal: string, now = new Date()): number {
  const f = save.sanctuary.fed[animal];
  return f && f.day === localDateKey(now) ? f.n : 0;
}

/**
 * Gives one portion to an animal. A favorite counts double; special treats are everyone's favorite. Once an animal has
 * had its fill for the day it politely declines and the food stays in the pantry.
 */
export function feedAnimal(save: SaveV2, animal: string, food: FoodId, now = new Date()): FeedResult {
  const kind = animalKindOf(animal);
  if (!kind) return { ok: false, reason: 'unknown' };
  const f = FOOD_BY_ID[food];
  const left = FOOD_AFFECTION_PER_DAY - fedToday(save, animal, now);
  if (left <= 0) return { ok: false, reason: 'full' };
  if (foodCount(save, food) < 1) return { ok: false, reason: 'no-food' };
  if (spendItem(save, `feed:${animal}:${uid(now)}`, 'food', 1, now, f.name, food) !== 'ok') return { ok: false, reason: 'no-food' };
  const favorite = isFavorite(f, kind);
  const gained = Math.min(left, f.favorites === 'all' ? f.affection : f.affection * (favorite ? 2 : 1));
  const day = localDateKey(now);
  const prev = save.sanctuary.fed[animal];
  save.sanctuary.fed[animal] = { day, n: (prev && prev.day === day ? prev.n : 0) + gained };
  save.sanctuary.affection[animal] = (save.sanctuary.affection[animal] ?? 0) + gained;
  return { ok: true, gained, favorite };
}

export interface Friendship {
  level: number;
  name: string;
  /** Affection where the next level starts (null at the top). */
  next: number | null;
  from: number;
}

const LEVELS: Array<[string, number]> = [
  ['New friend', 0],
  ['Friend', 5],
  ['Good friend', 15],
  ['Best friend', 35],
  ['Family', 70],
];

export function friendship(affection: number): Friendship {
  let i = 0;
  while (i + 1 < LEVELS.length && affection >= LEVELS[i + 1][1]) i++;
  return { level: i, name: LEVELS[i][0], from: LEVELS[i][1], next: i + 1 < LEVELS.length ? LEVELS[i + 1][1] : null };
}
