/**
 * What a solved board earns. Every grant goes through the idempotent ledger with a stable id, and decor gifts are keyed
 * by id, so the same rules can run at win time AND on startup (to reconcile players migrated from v1) without ever
 * granting twice. Replays earn no coins. Animals no longer arrive at Journey levels: they come home as the sanctuary
 * you build grows (meta/world.ts, D35).
 */

import { ECONOMY } from '../config/economy';
import type { ModeRef } from '../game/modes';
import type { LevelClear, SaveV2 } from '../services/storage';
import { chapterGift, type DecorId } from './catalogs/decor';
import { PETS, type PetId } from './catalogs/pets';
import { chapterAt, LEVELS_PER_CHAPTER, type Chapter } from './chapters';
import { grant, type LedgerSource } from './ledger';
import type { WinRecord } from './progression';
import type { Difficulty } from '../engine/types';
import { COMPANIONS, type CompanionId } from './catalogs/companions';
import { CLEAR_LIVES, HINT_EVERY, POINTS, grantItem, hasItemEntry, type ItemSource } from './items';
import { dailyPointsTier, levelRewardKey } from '../game/specs';

export interface RewardLine {
  id: string;
  label: string;
  coins: number;
}

export interface RewardSummary {
  coins: number;
  lines: RewardLine[];
  decor: DecorId[];
  chapter: Chapter | null;
  /** Extra lives and hints that went into the pantry. */
  lives: number;
  hints: number;
  /** Paw Points earned (progress only). */
  points: number;
}

function empty(): RewardSummary {
  return { coins: 0, lines: [], decor: [], chapter: null, lives: 0, hints: 0, points: 0 };
}

function addPoints(sum: RewardSummary, save: SaveV2, id: string, n: number, source: ItemSource, now: Date, note: string): void {
  const g = grantItem(save, id, 'points', n, source, now, note);
  if (g) sum.points += g.granted;
}

/** Puts an extra life or hint in the pantry once per id; anything over the cap arrives as coins. */
function addItem(sum: RewardSummary, save: SaveV2, id: string, kind: 'life' | 'hint', n: number, source: ItemSource, now: Date, note: string): void {
  const g = grantItem(save, id, kind, n, source, now, note);
  if (!g) return;
  if (kind === 'life') sum.lives += g.granted;
  else sum.hints += g.granted;
  if (g.overflowCoins) {
    sum.coins += g.overflowCoins;
    sum.lines.push({ id: `${id}:full`, label: kind === 'life' ? 'Extra lives full' : 'Hints full', coins: g.overflowCoins });
  }
}

function add(sum: RewardSummary, save: SaveV2, id: string, coins: number, label: string, source: LedgerSource, now: Date): void {
  if (grant(save, id, coins, source, now, label)) {
    sum.coins += coins;
    sum.lines.push({ id, label, coins });
  }
}

/**
 * Journey rewards for a cleared level. Safe to call any number of times. `tier` is the measured difficulty of the board
 * that was cleared (unknown → no difficulty bonus); Paw Points are back-dated for old clears, extra lives and hints are not.
 */
export function applyLevelRewards(
  save: SaveV2,
  level: number,
  clear: LevelClear | undefined,
  now = new Date(),
  source: LedgerSource = 'journey',
  tier?: Difficulty,
): RewardSummary {
  const sum = empty();
  if (!clear) return sum;
  const ps: ItemSource = source === 'migration' ? 'migration' : 'journey';
  // Ids follow the board (D35), so a board cleared before the one-animal levels arrived never pays twice.
  const k = levelRewardKey(level);
  addPoints(sum, save, `pts:${k}`, POINTS.journeyBase + (tier ? POINTS.difficulty[tier] : 0), ps, now, `Level ${level}`);
  if (clear.clean) addPoints(sum, save, `pts:clean:${k}`, POINTS.clean, ps, now, 'Clean solve');
  if (clear.hintFree) addPoints(sum, save, `pts:nohint:${k}`, POINTS.hintFree, ps, now, 'No hints');
  add(sum, save, `clear:${k}`, ECONOMY.journeyFirstClear, 'First clear', source, now);
  if (clear.clean) add(sum, save, `clean:${k}`, ECONOMY.journeyCleanBonus, 'Clean solve', source, now);
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

/**
 * Rewards for a just-recorded win. `tier` is the measured difficulty of the solved board. Extra lives and hints come
 * only from a *first* clear (replays earn nothing), so they are granted here rather than in `applyLevelRewards`, which
 * also runs over old clears on startup.
 */
export function rewardsForWin(save: SaveV2, mode: ModeRef, rec: WinRecord, now = new Date(), tier?: Difficulty): RewardSummary {
  if (mode.kind === 'level') {
    const sum = applyLevelRewards(save, mode.level, save.journey.clears[`L${mode.level}`], now, 'journey', tier);
    if (rec.firstClear) {
      // The `treat:` id prefix predates the Extra life name (D26) and stays, so a level never grants twice.
      const k = levelRewardKey(mode.level);
      addItem(sum, save, `treat:${k}`, 'life', CLEAR_LIVES, 'journey', now, `Level ${mode.level}`);
      if (mode.level % HINT_EVERY === 0) addItem(sum, save, `hint:${k}`, 'hint', 1, 'journey', now, `Level ${mode.level}`);
    }
    return sum;
  }
  const sum = empty();
  if (mode.kind === 'daily' && rec.newDaily) {
    add(sum, save, `daily:${mode.dateKey}`, ECONOMY.dailyFirstClear, 'Daily Cozy Puzzle', 'daily', now);
    if (rec.clean) add(sum, save, `dailyclean:${mode.dateKey}`, ECONOMY.dailyCleanBonus, 'Clean solve', 'daily', now);
    // Both Dailies of a date pay the same (D35), whichever board was played.
    const t = dailyPointsTier(mode.dateKey, tier);
    const pts = POINTS.dailyBase + (t ? POINTS.difficulty[t] : 0) + (rec.clean ? POINTS.clean : 0) + (rec.hintFree ? POINTS.hintFree : 0);
    addPoints(sum, save, `pts:D${mode.dateKey}`, pts, 'daily', now, 'Daily Cozy Puzzle');
  }
  return sum;
}

/**
 * Brings the inventory in line with journey progress: grants anything earned but not yet recorded (players migrated
 * from v1 whose levels were cleared before coins existed). Idempotent; returns what it granted.
 */
export function reconcileRewards(
  save: SaveV2,
  now = new Date(),
  tierOf: (level: number, clear: LevelClear) => Difficulty | undefined = () => undefined,
): RewardSummary {
  const total = empty();
  const levels = Object.keys(save.journey.clears)
    .map((k) => Number(k.slice(1)))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  for (const L of levels) {
    const clear = save.journey.clears[`L${L}`];
    // Measuring a board costs a few ms, so only levels whose points haven't been recorded yet are measured.
    const tier = clear && !hasItemEntry(save, `pts:${levelRewardKey(L)}`) ? tierOf(L, clear) : undefined;
    const s = applyLevelRewards(save, L, clear, now, 'migration', tier);
    total.coins += s.coins;
    total.points += s.points;
    total.lines.push(...s.lines);
    total.decor.push(...s.decor);
    if (s.chapter) total.chapter = s.chapter;
  }
  return total;
}

/** Pets the player has welcomed, in catalog order. */
export function unlockedPets(save: Pick<SaveV2, 'inventory'>): PetId[] {
  return PETS.filter((p) => save.inventory.pets[p.id]).map((p) => p.id);
}

/** Companions the player has welcomed, in catalog order. */
export function unlockedCompanions(save: Pick<SaveV2, 'inventory'>): CompanionId[] {
  return COMPANIONS.filter((c) => save.inventory.companions[c.id]).map((c) => c.id);
}
