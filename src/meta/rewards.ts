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
import type { Difficulty } from '../engine/types';
import { COMPANIONS, type CompanionId } from './catalogs/companions';
import { CLEAR_LIVES, HINT_EVERY, POINTS, grantItem, hasItemEntry, type ItemSource } from './items';

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
  /** Extra lives and hints that went into the pantry. */
  lives: number;
  hints: number;
  /** Paw Points earned (progress only). */
  points: number;
  /** Sanctuary companions who moved in. */
  companions: CompanionId[];
}

function empty(): RewardSummary {
  return { coins: 0, lines: [], pets: [], decor: [], chapter: null, lives: 0, hints: 0, points: 0, companions: [] };
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

/** Pets whose milestone is this level, welcomed if new. */
function unlockPets(save: SaveV2, level: number, now: Date, sum: RewardSummary): void {
  for (const p of PETS) {
    if (p.unlockLevel === level && !save.inventory.pets[p.id]) {
      save.inventory.pets[p.id] = { unlockedAt: now.toISOString() };
      sum.pets.push(p.id);
    }
  }
}

/**
 * Journey rewards for a cleared level. Safe to call any number of times. `tier` is the measured difficulty of the board
 * that was cleared (unknown → no difficulty bonus); Paw Points are back-dated for old clears, extra lives and hints are not.
 */
export function applyLevelRewards(save: SaveV2, level: number, clear: LevelClear | undefined, now = new Date(), source: LedgerSource = 'journey', tier?: Difficulty): RewardSummary {
  const sum = empty();
  if (!clear) return sum;
  const ps: ItemSource = source === 'migration' ? 'migration' : 'journey';
  addPoints(sum, save, `pts:L${level}`, POINTS.journeyBase + (tier ? POINTS.difficulty[tier] : 0), ps, now, `Level ${level}`);
  if (clear.clean) addPoints(sum, save, `pts:clean:L${level}`, POINTS.clean, ps, now, 'Clean solve');
  if (clear.hintFree) addPoints(sum, save, `pts:nohint:L${level}`, POINTS.hintFree, ps, now, 'No hints');
  add(sum, save, `clear:L${level}`, ECONOMY.journeyFirstClear, 'First clear', source, now);
  if (clear.clean) add(sum, save, `clean:L${level}`, ECONOMY.journeyCleanBonus, 'Clean solve', source, now);
  unlockPets(save, level, now, sum);
  for (const c of COMPANIONS) {
    if (c.unlockLevel === level && !save.inventory.companions[c.id]) {
      save.inventory.companions[c.id] = { unlockedAt: now.toISOString() };
      sum.companions.push(c.id);
    }
  }
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
      addItem(sum, save, `treat:L${mode.level}`, 'life', CLEAR_LIVES, 'journey', now, `Level ${mode.level}`);
      if (mode.level % HINT_EVERY === 0) addItem(sum, save, `hint:L${mode.level}`, 'hint', 1, 'journey', now, `Level ${mode.level}`);
    }
    return sum;
  }
  const sum = empty();
  if (mode.kind === 'daily' && rec.newDaily) {
    add(sum, save, `daily:${mode.dateKey}`, ECONOMY.dailyFirstClear, 'Daily Cozy Puzzle', 'daily', now);
    if (rec.clean) add(sum, save, `dailyclean:${mode.dateKey}`, ECONOMY.dailyCleanBonus, 'Clean solve', 'daily', now);
    const pts = POINTS.dailyBase + (tier ? POINTS.difficulty[tier] : 0) + (rec.clean ? POINTS.clean : 0) + (rec.hintFree ? POINTS.hintFree : 0);
    addPoints(sum, save, `pts:D${mode.dateKey}`, pts, 'daily', now, 'Daily Cozy Puzzle');
  }
  return sum;
}

/**
 * Brings the inventory in line with journey progress: grants anything earned but not yet recorded (players migrated
 * from v1 whose levels were cleared before coins existed). Idempotent; returns what it granted.
 */
export function reconcileRewards(save: SaveV2, now = new Date(), tierOf: (level: number, clear: LevelClear) => Difficulty | undefined = () => undefined): RewardSummary {
  const total = empty();
  const levels = Object.keys(save.journey.clears)
    .map((k) => Number(k.slice(1)))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  for (const L of levels) {
    const clear = save.journey.clears[`L${L}`];
    // Measuring a board costs a few ms, so only levels whose points haven't been recorded yet are measured.
    const tier = clear && !hasItemEntry(save, `pts:L${L}`) ? tierOf(L, clear) : undefined;
    const s = applyLevelRewards(save, L, clear, now, 'migration', tier);
    total.coins += s.coins;
    total.points += s.points;
    total.companions.push(...s.companions);
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

/** Companions the player has welcomed, in unlock order. */
export function unlockedCompanions(save: Pick<SaveV2, 'inventory'>): CompanionId[] {
  return COMPANIONS.filter((c) => save.inventory.companions[c.id]).map((c) => c.id);
}

/** The next newcomer (resident or companion) after `solved` cleared levels, and when it arrives. */
export function nextArrival(save: Pick<SaveV2, 'inventory'>, solved: number): { name: string; level: number } | null {
  const all = [
    ...PETS.filter((p) => !save.inventory.pets[p.id]).map((p) => ({ name: p.name, level: p.unlockLevel })),
    ...COMPANIONS.filter((c) => !save.inventory.companions[c.id]).map((c) => ({ name: c.name, level: c.unlockLevel })),
  ].filter((x) => x.level > solved);
  all.sort((a, b) => a.level - b.level);
  return all[0] ?? null;
}

/** Journey levels whose first clear welcomes someone new (residents and companions). */
export function arrivalLevels(): Set<number> {
  return new Set([...PETS.map((p) => p.unlockLevel), ...COMPANIONS.map((c) => c.unlockLevel)]);
}

/** The next pet still to arrive, and at which level. */
export function nextPetMilestone(save: Pick<SaveV2, 'inventory'>): { id: PetId; level: number } | null {
  const next = PETS.filter((p) => !save.inventory.pets[p.id]).sort((a, b) => a.unlockLevel - b.unlockLevel)[0];
  return next ? { id: next.id, level: PET_BY_ID[next.id].unlockLevel } : null;
}
