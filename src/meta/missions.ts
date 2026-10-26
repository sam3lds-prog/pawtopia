/**
 * Small optional missions: three a day (one is always "solve any board"), one a week. Deterministic by date, so
 * everyone sees the same set. Missing a day costs nothing; missions never ask for an ad. Rewards go through the
 * idempotent ledger, so a mission can only be claimed once.
 */

import { hashString, mulberry32, shuffle } from '../engine/rng';
import type { ModeRef } from '../game/modes';
import { localDateKey, localWeekStart } from '../game/dates';
import type { SaveV2 } from '../services/storage';
import { grant } from './ledger';

export type MissionEvent =
  | { kind: 'solved'; mode: ModeRef['kind']; size: number; mistakes: number; hints: number }
  | { kind: 'sanctuary' }
  | { kind: 'decor' };

export interface MissionDef {
  id: string;
  title: string;
  target: number;
  coins: number;
  /** How much an event advances it. */
  step(e: MissionEvent): number;
}

const solved = (e: MissionEvent) => (e.kind === 'solved' ? 1 : 0);

export const DAILY_POOL: readonly MissionDef[] = [
  { id: 'solve1', title: 'Solve any board', target: 1, coins: 20, step: solved },
  { id: 'clean1', title: 'Solve a board with no mistakes', target: 1, coins: 25, step: (e) => (e.kind === 'solved' && e.mistakes === 0 ? 1 : 0) },
  { id: 'daily', title: "Finish today's Daily Cozy Puzzle", target: 1, coins: 25, step: (e) => (e.kind === 'solved' && e.mode === 'daily' ? 1 : 0) },
  { id: 'nohint7', title: 'Solve a 7×7 or larger without hints', target: 1, coins: 30, step: (e) => (e.kind === 'solved' && e.size >= 7 && e.hints === 0 ? 1 : 0) },
  { id: 'zen1', title: 'Solve a board in the Zen Garden', target: 1, coins: 20, step: (e) => (e.kind === 'solved' && e.mode === 'zen' ? 1 : 0) },
  { id: 'visit', title: 'Visit the sanctuary', target: 1, coins: 15, step: (e) => (e.kind === 'sanctuary' ? 1 : 0) },
  { id: 'solve3', title: 'Solve three boards', target: 3, coins: 30, step: solved },
];

export const WEEKLY: MissionDef = {
  id: 'sizes3',
  title: 'Solve boards of three different sizes',
  target: 3,
  coins: 60,
  step: () => 0, // computed from stats.sizesThisWeek
};

export interface MissionState {
  def: MissionDef;
  key: string;
  progress: number;
  done: boolean;
  claimed: boolean;
  weekly: boolean;
}

/** Today's three: "Solve any board" plus two more chosen by the date. */
export function dailyMissions(dayKey: string): MissionDef[] {
  const rest = DAILY_POOL.filter((m) => m.id !== 'solve1');
  const pick = shuffle(mulberry32(hashString(`missions-${dayKey}`)), rest).slice(0, 2);
  return [DAILY_POOL[0], ...pick];
}

/** Rolls the mission window forward to today / this week. Old progress is simply dropped. */
export function rollMissions(save: SaveV2, now = new Date()): void {
  const day = localDateKey(now);
  const week = localWeekStart(day);
  const m = save.missions;
  if (m.dayKey !== day || m.weekKey !== week) {
    const keep = (k: string) => k.startsWith(`d:${day}:`) || k.startsWith(`w:${week}:`);
    for (const k of Object.keys(m.progress)) if (!keep(k)) delete m.progress[k];
    for (const k of Object.keys(m.claimed)) if (!keep(k)) delete m.claimed[k];
    m.dayKey = day;
    m.weekKey = week;
  }
}

function weeklySizes(save: SaveV2, week: string): number {
  return Object.keys(save.stats.sizesThisWeek).filter((k) => k.startsWith(`${week}:`)).length;
}

export function missionStates(save: SaveV2, now = new Date()): MissionState[] {
  rollMissions(save, now);
  const day = save.missions.dayKey!;
  const week = save.missions.weekKey!;
  const out: MissionState[] = dailyMissions(day).map((def) => {
    const key = `d:${day}:${def.id}`;
    const progress = Math.min(def.target, save.missions.progress[key] ?? 0);
    return { def, key, progress, done: progress >= def.target, claimed: !!save.missions.claimed[key], weekly: false };
  });
  const wkey = `w:${week}:${WEEKLY.id}`;
  const wp = Math.min(WEEKLY.target, weeklySizes(save, week));
  out.push({ def: WEEKLY, key: wkey, progress: wp, done: wp >= WEEKLY.target, claimed: !!save.missions.claimed[wkey], weekly: true });
  return out;
}

/** Advances today's missions for an event. Returns missions that just became complete. */
export function recordMissionEvent(save: SaveV2, e: MissionEvent, now = new Date()): MissionDef[] {
  rollMissions(save, now);
  const done: MissionDef[] = [];
  for (const def of dailyMissions(save.missions.dayKey!)) {
    const key = `d:${save.missions.dayKey}:${def.id}`;
    const before = save.missions.progress[key] ?? 0;
    if (before >= def.target) continue;
    const inc = def.step(e);
    if (!inc) continue;
    const after = Math.min(def.target, before + inc);
    save.missions.progress[key] = after;
    if (after >= def.target) done.push(def);
  }
  return done;
}

/** Claims a finished mission's coins, once. */
export function claimMission(save: SaveV2, key: string, now = new Date()): number {
  const st = missionStates(save, now).find((m) => m.key === key);
  if (!st || !st.done || st.claimed) return 0;
  save.missions.claimed[key] = true;
  return grant(save, `mission:${key}`, st.def.coins, 'mission', now, st.def.title) ? st.def.coins : 0;
}

export function unclaimedCount(save: SaveV2, now = new Date()): number {
  return missionStates(save, now).filter((m) => m.done && !m.claimed).length;
}
