/**
 * The world map's progress. Regional sanctuaries open at Journey levels; the one you're building grows by one for
 * every puzzle you solve (Journey, Daily or Zen; Paw Cup is competition and the guided first board is practice, so
 * neither counts). Growth reaches stages; each of the first three welcomes that region's next animal and the last one
 * completes the sanctuary with a coin gift. All of it is idempotent: stages and arrivals are derived from the growth
 * count, so re-running it (startup reconcile, a double tap) never grants twice.
 */

import type { ModeRef } from '../game/modes';
import type { SaveV2 } from '../services/storage';
import { COMPANIONS, type CompanionId } from './catalogs/companions';
import { REGIONS, SANCTUARY_BY_ID, isRegionId, type RegionId, type SanctuaryDef, type StageDef } from './catalogs/sanctuaries';
import { grant } from './ledger';

type WorldSave = Pick<SaveV2, 'journey' | 'world' | 'inventory'>;

/** Journey levels cleared so far. */
const cleared = (save: Pick<SaveV2, 'journey'>) => save.journey.nextLevel - 1;

export function isOpen(save: Pick<SaveV2, 'journey'>, id: RegionId): boolean {
  return cleared(save) >= SANCTUARY_BY_ID[id].opensAfterLevel;
}

export function growthOf(save: Pick<SaveV2, 'world'>, id: RegionId): number {
  return save.world.growth[id] ?? 0;
}

/** Stage index reached at a growth count (0 = wild land). */
export function stageAt(def: SanctuaryDef, growth: number): number {
  let s = 0;
  for (let i = 0; i < def.stages.length; i++) if (growth >= def.stages[i].at) s = i;
  return s;
}

export function stageOf(save: Pick<SaveV2, 'world'>, id: RegionId): number {
  return stageAt(SANCTUARY_BY_ID[id], growthOf(save, id));
}

export function isComplete(save: Pick<SaveV2, 'world'>, id: RegionId): boolean {
  const def = SANCTUARY_BY_ID[id];
  return stageOf(save, id) === def.stages.length - 1;
}

/** Progress toward the next stage, for bars and labels. Null when complete. */
export function nextStage(save: Pick<SaveV2, 'world'>, id: RegionId): { stage: StageDef; index: number; have: number; need: number; from: number } | null {
  const def = SANCTUARY_BY_ID[id];
  const s = stageOf(save, id);
  if (s >= def.stages.length - 1) return null;
  const g = growthOf(save, id);
  return { stage: def.stages[s + 1], index: s + 1, have: g, need: def.stages[s + 1].at, from: def.stages[s].at };
}

/** Overall completion, 0–1 (for the map pin ring). */
export function progressOf(save: Pick<SaveV2, 'world'>, id: RegionId): number {
  const def = SANCTUARY_BY_ID[id];
  const last = def.stages[def.stages.length - 1].at;
  return Math.min(1, growthOf(save, id) / last);
}

/** The sanctuary you're building: the chosen one if it's open and unfinished, else the first such region, else null. */
export function activeRegion(save: WorldSave): RegionId | null {
  const a = save.world.active;
  if (isRegionId(a) && isOpen(save, a) && !isComplete(save, a)) return a;
  return REGIONS.map((r) => r.id as RegionId).find((id) => isOpen(save, id) && !isComplete(save, id)) ?? null;
}

/** Chooses which open, unfinished sanctuary to build. */
export function setActive(save: WorldSave, id: RegionId): boolean {
  if (!isOpen(save, id) || isComplete(save, id)) return false;
  save.world.active = id;
  return true;
}

/** Regional friends welcomed by the stage this sanctuary has reached (and not yet recorded). Idempotent. */
function welcomeArrivals(save: WorldSave, id: RegionId, now: Date): CompanionId[] {
  const s = stageOf(save, id);
  const out: CompanionId[] = [];
  for (const c of COMPANIONS) {
    if (c.sanctuary !== id || c.stage === undefined || c.stage > s || save.inventory.companions[c.id]) continue;
    save.inventory.companions[c.id] = { unlockedAt: now.toISOString() };
    out.push(c.id);
  }
  return out;
}

export interface GrowthNews {
  sanctuary: RegionId;
  growth: number;
  /** The stage just reached, if this solve reached one. */
  stageUp: StageDef | null;
  arrived: CompanionId[];
  completed: boolean;
  coins: number;
  /** Sanctuaries that opened with this solve (a Journey milestone). */
  opened: RegionId[];
}

/** Whether a solved board counts toward sanctuary growth. */
export function countsForGrowth(mode: ModeRef, tutorial: boolean): boolean {
  return mode.kind !== 'cup' && !tutorial;
}

/**
 * Records one solved puzzle for the sanctuary being built. `openedBefore` is the list of open regions before the win was
 * recorded (so a sanctuary that just opened can be announced). Returns null when nothing is being built.
 */
export function growOnSolve(save: WorldSave, openedBefore: RegionId[], now = new Date()): GrowthNews | null {
  const opened = REGIONS.map((r) => r.id as RegionId).filter((id) => isOpen(save, id) && !openedBefore.includes(id));
  const id = activeRegion(save);
  if (!id) return opened.length ? { sanctuary: opened[0], growth: 0, stageUp: null, arrived: [], completed: false, coins: 0, opened } : null;
  save.world.active = id;
  const def = SANCTUARY_BY_ID[id];
  const before = stageOf(save, id);
  save.world.growth[id] = growthOf(save, id) + 1;
  const after = stageOf(save, id);
  const arrived = welcomeArrivals(save, id, now);
  const completed = after === def.stages.length - 1 && before !== after;
  let coins = 0;
  if (completed && grant(save, `world:complete:${id}`, def.completeCoins, 'gift', now, `${def.name} complete`)) coins = def.completeCoins;
  return { sanctuary: id, growth: save.world.growth[id], stageUp: after > before ? def.stages[after] : null, arrived, completed, coins, opened };
}

export function openRegions(save: Pick<SaveV2, 'journey'>): RegionId[] {
  return REGIONS.map((r) => r.id as RegionId).filter((id) => isOpen(save, id));
}

/** Startup safety net: welcomes any regional friend whose stage was reached but not recorded. */
export function reconcileWorld(save: WorldSave, now = new Date()): CompanionId[] {
  const out: CompanionId[] = [];
  for (const r of REGIONS) out.push(...welcomeArrivals(save, r.id as RegionId, now));
  return out;
}

/** The next sanctuary still to open, and how many Journey levels until it does. */
export function nextToOpen(save: Pick<SaveV2, 'journey'>): { id: RegionId; def: SanctuaryDef; left: number } | null {
  for (const r of REGIONS) {
    const id = r.id as RegionId;
    if (!isOpen(save, id)) return { id, def: r, left: r.opensAfterLevel - cleared(save) };
  }
  return null;
}

/** Puzzles still to solve (while building it) before a sanctuary's next stage. */
export function puzzlesToNext(save: Pick<SaveV2, 'world'>, id: RegionId): number {
  const n = nextStage(save, id);
  return n ? n.need - n.have : 0;
}

/**
 * One line from a regional animal, tied to what really happened (never invented): a newcomer, the land growing, or the
 * sanctuary finished. Null while nobody lives there yet.
 */
export function regionChat(save: Pick<SaveV2, 'journey' | 'world' | 'inventory'>, id: RegionId, now = new Date()): string | null {
  const here = COMPANIONS.filter((c) => c.sanctuary === id && save.inventory.companions[c.id]);
  if (!here.length) return null;
  const day = now.toISOString().slice(0, 10);
  let h = 0;
  for (const ch of `${id}-${day}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const who = here[h % here.length].name;
  const newest = [...here].sort((a, b) => Date.parse(save.inventory.companions[b.id].unlockedAt) - Date.parse(save.inventory.companions[a.id].unlockedAt))[0];
  const at = Date.parse(save.inventory.companions[newest.id].unlockedAt);
  if (!Number.isNaN(at) && now.getTime() - at < 2 * 86_400_000) return `${newest.name} is still exploring the new home.`;
  if (isComplete(save, id)) return `${who} thinks this is the best home in the world.`;
  const next = nextStage(save, id);
  if (next && activeRegion(save) === id) {
    const left = next.need - next.have;
    return `${who} is watching the land grow: ${left === 1 ? 'one more puzzle' : `${left} more puzzles`} until ${next.stage.name.toLowerCase()}.`;
  }
  return `${who} hopes you'll build here again soon.`;
}
