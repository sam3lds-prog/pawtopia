/** Sanctuary inventory: the free starter gift, buying decor with Paw Coins, and showing / hiding owned items. */

import type { SaveV2 } from '../services/storage';
import { DECOR_BY_ID, STARTER_DECOR, type DecorId } from './catalogs/decor';
import { balance, spend } from './ledger';
import { PETS } from './catalogs/pets';
import { COMPANIONS } from './catalogs/companions';
import { daysBetween, localDateKey } from '../game/dates';
import { hashString } from '../engine/rng';
import { liveStreak } from './progression';

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

// ------------------------------------------------------------------ affection and small talk (cosmetic only)

/** A once-a-day pat for a resident or companion. Adds one heart of affection; changes nothing else. */
export function patFriend(save: SaveV2, id: string, now = new Date()): boolean {
  const day = localDateKey(now);
  if (save.sanctuary.patted[id] === day) return false;
  save.sanctuary.patted[id] = day;
  save.sanctuary.affection[id] = (save.sanctuary.affection[id] ?? 0) + 1;
  return true;
}

export function pattedToday(save: Pick<SaveV2, 'sanctuary'>, id: string, now = new Date()): boolean {
  return save.sanctuary.patted[id] === localDateKey(now);
}

const TIER_WORD = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' } as const;

/**
 * One line from a resident, chosen by the date and tied to something that really happened (never invented): a recent
 * Hard or Expert solve, the daily streak, a newcomer, or a solve today. Null when nobody lives here yet.
 */
export function sanctuaryChat(save: SaveV2, now = new Date()): string | null {
  const residents = PETS.filter((p) => save.inventory.pets[p.id]).map((p) => ({ name: p.name, at: save.inventory.pets[p.id].unlockedAt }));
  const friends = COMPANIONS.filter((c) => save.inventory.companions[c.id]).map((c) => ({ name: c.name, at: save.inventory.companions[c.id].unlockedAt }));
  const all = [...residents, ...friends];
  if (!all.length) return null;
  const day = localDateKey(now);
  const who = all[hashString(`chat-${day}`) % all.length].name;
  const lw = save.stats.lastWin;
  const ago = lw && lw.at && !Number.isNaN(Date.parse(lw.at)) ? daysBetween(localDateKey(new Date(lw.at)), day) : Infinity;
  if (lw && ago <= 2 && (lw.tier === 'hard' || lw.tier === 'expert')) return `${who} thinks your last ${TIER_WORD[lw.tier]} ${lw.size}×${lw.size} was impressive!`;
  const streak = liveStreak(save, day);
  if (streak >= 2) return `${who} has been counting your ${streak}-day streak.`;
  const newest = [...all].filter((a) => a.at && !Number.isNaN(Date.parse(a.at))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  if (newest && daysBetween(localDateKey(new Date(newest.at)), day) <= 2) return `${newest.name} is still exploring the garden.`;
  if (lw && ago <= 1) return `${who} saw you solve a ${lw.size}×${lw.size} ${ago === 0 ? 'today' : 'yesterday'}.`;
  return `${who} is glad you stopped by.`;
}
