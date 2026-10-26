/**
 * What a solved board earns. Every grant goes through the idempotent ledger with a stable id, and pet / decor unlocks
 * are keyed by id, so the same rules can run at win time AND on startup (to reconcile players migrated from v1)
 * without ever granting twice. Replays earn no coins.
 */

import { ECONOMY } from '../config/economy';
import type { ModeRef } from '../game/modes';
import type { LevelClear, SaveV2 } from '../services/storage';
import { chapterGift, type DecorId } from './catalogs/decor';
import { PETS, PET_BY_ID, type PetId } from './catalogs/pets';
import { chapterAt, LEVELS_PER_CHAPTER, type Chapter } from './chapters';
import { grant, type LedgerSource } from './ledger';
import type { WinRecord } from './progression';

export interface RewardLine {
  id: string;
  label: string;
  coins: number;
}

export interface RewardSummary {
  coins: number;
  lines: RewardLine[];
  pets: PetId[];
  decor: DecorId[];
  chapter: Chapter | null;
}

function empty(): RewardSummary {
  return { coins: 0, lines: [], pets: [], decor: [], chapter: null };
}

function add(sum: RewardSummary, save: SaveV2, id: string, coins: number, label: string, source: LedgerSource, now: Date): void {
  if (grant(save, id, coins, source, now, label)) {
    sum.coins += coins;
    sum.lines.push({ id, label, coins });
  }
}

/** Pets whose milestone is this level, welcomed if new. */
function unlockPets(save: SaveV2, level: number, now: Date, sum: RewardSummary): void {
  for (const p of PETS) {
    if (p.unlockLevel === level && !save.inventory.pets[p.id]) {
      save.inventory.pets[p.id] = { unlockedAt: now.toISOString() };
      sum.pets.push(p.id);
    }
  }
}

/** Journey rewards for a cleared level. Safe to call any number of times. */
export function applyLevelRewards(save: SaveV2, level: number, clear: LevelClear | undefined, now = new Date(), source: LedgerSource = 'journey'): RewardSummary {
  const sum = empty();
  if (!clear) return sum;
  add(sum, save, `clear:L${level}`, ECONOMY.journeyFirstClear, 'First clear', source, now);
  if (clear.clean) add(sum, save, `clean:L${level}`, ECONOMY.journeyCleanBonus, 'Clean solve', source, now);
  unlockPets(save, level, now, sum);
  if (level % LEVELS_PER_CHAPTER === 0) {
    const ch = chapterAt(level / LEVELS_PER_CHAPTER - 1);
    const before = sum.coins;
    add(sum, save, `chapter:${ch.index + 1}`, ECONOMY.chapterComplete, `${ch.name} complete`, source === 'migration' ? 'migration' : 'chapter', now);
    const gift = chapterGift(ch.index + 1);
    if (gift && !save.inventory.decor[gift.id]) {
      save.inventory.decor[gift.id] = { ownedAt: now.toISOString() };
      sum.decor.push(gift.id);
    }
    if (sum.coins > before || sum.decor.length) sum.chapter = ch;
  }
  return sum;
}

/** Rewards for a just-recorded win. */
export function rewardsForWin(save: SaveV2, mode: ModeRef, rec: WinRecord, now = new Date()): RewardSummary {
  if (mode.kind === 'level') return applyLevelRewards(save, mode.level, save.journey.clears[`L${mode.level}`], now);
  const sum = empty();
  if (mode.kind === 'daily' && rec.newDaily) {
    add(sum, save, `daily:${mode.dateKey}`, ECONOMY.dailyFirstClear, 'Daily Cozy Puzzle', 'daily', now);
    if (rec.clean) add(sum, save, `dailyclean:${mode.dateKey}`, ECONOMY.dailyCleanBonus, 'Clean solve', 'daily', now);
  }
  return sum;
}

/**
 * Brings the inventory in line with journey progress: grants anything earned but not yet recorded (players migrated
 * from v1 whose levels were cleared before coins existed). Idempotent; returns what it granted.
 */
export function reconcileRewards(save: SaveV2, now = new Date()): RewardSummary {
  const total = empty();
  const levels = Object.keys(save.journey.clears)
    .map((k) => Number(k.slice(1)))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  for (const L of levels) {
    const s = applyLevelRewards(save, L, save.journey.clears[`L${L}`], now, 'migration');
    total.coins += s.coins;
    total.lines.push(...s.lines);
    total.pets.push(...s.pets);
    total.decor.push(...s.decor);
    if (s.chapter) total.chapter = s.chapter;
  }
  return total;
}

/** Pets the player has welcomed, in unlock order. */
export function unlockedPets(save: Pick<SaveV2, 'inventory'>): PetId[] {
  return PETS.filter((p) => save.inventory.pets[p.id]).map((p) => p.id);
}

/** The next pet still to arrive, and at which level. */
export function nextPetMilestone(save: Pick<SaveV2, 'inventory'>): { id: PetId; level: number } | null {
  const next = PETS.filter((p) => !save.inventory.pets[p.id]).sort((a, b) => a.unlockLevel - b.unlockLevel)[0];
  return next ? { id: next.id, level: PET_BY_ID[next.id].unlockLevel } : null;
}
