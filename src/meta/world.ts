/**
 * The world map's progress (D35). The Farm and the Pet Garden are open from the start; the exotic regions open at
 * Journey levels. The sanctuary you're building grows by one for every puzzle you solve (Journey, Daily or Zen; the
 * Paw Cup is competition, so it doesn't count). Its animals arrive one by one at set growth counts, the Farm and the
 * regions also grow through drawn stages, and finishing a sanctuary (everyone home, last stage reached) gives a coin
 * gift. All of it is idempotent: stages and arrivals are derived from the growth count, so re-running it (startup
 * reconcile, a double tap) never grants twice.
 */

import type { ModeRef } from '../game/modes';
import type { SaveV2 } from '../services/storage';
import {
  REGIONS,
  SANCTUARIES,
  SANCTUARY_BY_ID,
  isSanctuaryId,
  type AnimalId,
  type Arrival,
  type RegionId,
  type SanctuaryDef,
  type SanctuaryId,
  type StageDef,
} from './catalogs/sanctuaries';
import { animalInfo, homeAnimals, homeSince, isHome, nextArrivalIn, welcomeAnimal } from './animals';
import { grant } from './ledger';

type WorldSave = Pick<SaveV2, 'journey' | 'world' | 'inventory'>;

/** Journey levels cleared so far. */
const cleared = (save: Pick<SaveV2, 'journey'>) => save.journey.nextLevel - 1;

export function growthOf(save: Pick<SaveV2, 'world'>, id: SanctuaryId): number {
  return save.world.growth[id] ?? 0;
}

/** Open once its Journey level is cleared; one you already started building stays open whatever the level. */
export function isOpen(save: Pick<SaveV2, 'journey' | 'world'>, id: SanctuaryId): boolean {
  return cleared(save) >= SANCTUARY_BY_ID[id].opensAfterLevel || growthOf(save, id) > 0;
}

/** Stage index reached at a growth count (0 = empty land; always 0 for the Pet Garden, which has no stages). */
export function stageAt(def: SanctuaryDef, growth: number): number {
  let s = 0;
  for (let i = 0; i < def.stages.length; i++) if (growth >= def.stages[i].at) s = i;
  return s;
}

export function stageOf(save: Pick<SaveV2, 'world'>, id: SanctuaryId): number {
  return stageAt(SANCTUARY_BY_ID[id], growthOf(save, id));
}

const lastStage = (def: SanctuaryDef) => Math.max(0, def.stages.length - 1);

/** Everyone has arrived and the last stage (if any) is reached. */
export function isComplete(save: Pick<SaveV2, 'world' | 'inventory'>, id: SanctuaryId): boolean {
  const def = SANCTUARY_BY_ID[id];
  return stageOf(save, id) >= lastStage(def) && def.arrivals.every((a) => isHome(save, a.id));
}

/** Progress toward the next stage, for bars and labels. Null when there are no more stages. */
export function nextStage(save: Pick<SaveV2, 'world'>, id: SanctuaryId): { stage: StageDef; index: number; have: number; need: number; from: number } | null {
  const def = SANCTUARY_BY_ID[id];
  const s = stageOf(save, id);
  if (s >= def.stages.length - 1) return null;
  const g = growthOf(save, id);
  return { stage: def.stages[s + 1], index: s + 1, have: g, need: def.stages[s + 1].at, from: def.stages[s].at };
}

/**
 * The animal being brought home next and how far along it is: `have` of `need` puzzles, counted from `from` (the
 * previous arrival). Null when everyone has arrived.
 */
export function arrivalProgress(
  save: Pick<SaveV2, 'world' | 'inventory'>,
  id: SanctuaryId,
): { next: Arrival; have: number; need: number; from: number; left: number } | null {
  const next = nextArrivalIn(save, id);
  if (!next) return null;
  const def = SANCTUARY_BY_ID[id];
  const i = def.arrivals.indexOf(next);
  const from = i > 0 ? def.arrivals[i - 1].at : 0;
  const have = growthOf(save, id);
  return { next, have, need: next.at, from: Math.min(from, have), left: Math.max(1, next.at - have) };
}

/** Overall completion, 0–1 (for the map pin ring): growth toward the last stage or the last arrival, whichever is later. */
export function progressOf(save: Pick<SaveV2, 'world'>, id: SanctuaryId): number {
  const def = SANCTUARY_BY_ID[id];
  const last = Math.max(def.stages[def.stages.length - 1]?.at ?? 0, def.arrivals[def.arrivals.length - 1]?.at ?? 0, 1);
  return Math.min(1, growthOf(save, id) / last);
}

/** Sanctuaries in building order: the Farm, the Pet Garden, then the regions as they open. */
const ORDER: SanctuaryId[] = SANCTUARIES.map((s) => s.id);

/** The sanctuary you're building: the chosen one if it's open and unfinished, else the first such one, else null. */
export function activeSanctuary(save: WorldSave): SanctuaryId | null {
  const a = save.world.active;
  if (isSanctuaryId(a) && isOpen(save, a) && !isComplete(save, a)) return a;
  return ORDER.find((id) => isOpen(save, id) && !isComplete(save, id)) ?? null;
}

/** Chooses which open, unfinished sanctuary to build. */
export function setActive(save: WorldSave, id: SanctuaryId): boolean {
  if (!isOpen(save, id) || isComplete(save, id)) return false;
  save.world.active = id;
  return true;
}

/** Animals whose arrival count this sanctuary has reached (and not yet recorded). Idempotent. */
function welcomeArrivals(save: WorldSave, id: SanctuaryId, now: Date): AnimalId[] {
  const g = growthOf(save, id);
  const out: AnimalId[] = [];
  for (const a of SANCTUARY_BY_ID[id].arrivals) if (a.at <= g && welcomeAnimal(save, a.id, now)) out.push(a.id);
  return out;
}

export interface GrowthNews {
  sanctuary: SanctuaryId;
  growth: number;
  /** The stage just reached, if this solve reached one. */
  stageUp: StageDef | null;
  arrived: AnimalId[];
  completed: boolean;
  coins: number;
  /** Sanctuaries that opened with this solve (a Journey milestone). */
  opened: RegionId[];
  /**
   * The sanctuary the board was for when its credit went elsewhere: it was finished (or no longer open) by the time the
   * board was solved, so the solve helped the one being built now instead. Null when the board's own sanctuary grew.
   */
  redirectedFrom: SanctuaryId | null;
}

/** Whether a solved board counts toward sanctuary growth (everything but the Paw Cup; the guided first board brings the first animal home). */
export function countsForGrowth(mode: ModeRef, _tutorial = false): boolean {
  return mode.kind !== 'cup';
}

/** Can a sanctuary still take growth: open and not yet complete. */
export function canGrow(save: WorldSave, id: SanctuaryId): boolean {
  return isOpen(save, id) && !isComplete(save, id);
}

/**
 * Which sanctuary a solved board helps. A board helps the sanctuary it was cast for when it started (`cast.sanctuary`),
 * whatever the player chose to build since: switching sanctuaries changes the *next* board, never one already on the
 * table. Only when that sanctuary can't grow any more (it was finished while the board sat saved) does the credit go
 * to the one being built now; with nothing to build, nothing grows.
 */
export function beneficiaryOf(save: WorldSave, boardSanctuary: SanctuaryId | null | undefined): { id: SanctuaryId | null; redirectedFrom: SanctuaryId | null } {
  if (boardSanctuary && canGrow(save, boardSanctuary)) return { id: boardSanctuary, redirectedFrom: null };
  const fallback = activeSanctuary(save);
  return { id: fallback, redirectedFrom: boardSanctuary && fallback ? boardSanctuary : null };
}

/** Everything a win needs to credit the world exactly once, for the right sanctuary. */
export interface SolveContext {
  /** The sanctuary the board was cast for when it started (its saved `cast.sanctuary`); null for a board that had none. */
  boardSanctuary: SanctuaryId | null;
  /** Regions open before the win was recorded, so a region that just opened can be announced. */
  openedBefore: RegionId[];
  /**
   * The board's id (`app.active.boardId`). A completed board is credited at most once under it, however many times the
   * outcome is handled (a re-entered win, a replayed event log); omitted in unit tests that build boards by hand.
   */
  receipt?: string;
}

/** Credit receipts kept (the newest); older ones can't come back as a live board. */
const RECEIPTS_KEPT = 60;

/** Has this board's solve already grown the world? */
export function alreadyCredited(save: WorldSave, receipt: string | undefined): boolean {
  return !!receipt && !!save.world.credits && receipt in save.world.credits;
}

function recordReceipt(save: WorldSave, receipt: string | undefined, id: SanctuaryId | null): void {
  if (!receipt) return;
  const credits = (save.world.credits ??= {});
  credits[receipt] = id ?? 'none';
  const keys = Object.keys(credits);
  for (const k of keys.slice(0, Math.max(0, keys.length - RECEIPTS_KEPT))) delete credits[k];
}

/**
 * Records one solved puzzle for the sanctuary the board was for (see `beneficiaryOf`), welcomes any animal whose count
 * was reached, pays a finished sanctuary's gift, and reports what happened. Never moves `world.active`: the player's
 * choice of what to build next is theirs. Returns null when nothing grew and nothing opened. Idempotent per receipt.
 */
export function creditSolve(save: WorldSave, ctx: SolveContext, now = new Date()): GrowthNews | null {
  const opened = openRegions(save).filter((id) => !ctx.openedBefore.includes(id));
  if (alreadyCredited(save, ctx.receipt)) return null;
  const { id, redirectedFrom } = beneficiaryOf(save, ctx.boardSanctuary);
  recordReceipt(save, ctx.receipt, id);
  if (!id) return opened.length ? { sanctuary: opened[0], growth: 0, stageUp: null, arrived: [], completed: false, coins: 0, opened, redirectedFrom } : null;
  const def = SANCTUARY_BY_ID[id];
  const before = stageOf(save, id);
  save.world.growth[id] = growthOf(save, id) + 1;
  const after = stageOf(save, id);
  const arrived = welcomeArrivals(save, id, now);
  const completed = isComplete(save, id);
  let coins = 0;
  if (completed && grant(save, `world:complete:${id}`, def.completeCoins, 'gift', now, `${def.name} complete`)) coins = def.completeCoins;
  return {
    sanctuary: id,
    growth: save.world.growth[id]!,
    stageUp: after > before ? def.stages[after] : null,
    arrived,
    completed: completed && coins > 0,
    coins,
    opened,
    redirectedFrom,
  };
}

/**
 * Records one solved puzzle for the sanctuary being built right now. For boards that know which sanctuary they were
 * started for, use `creditSolve`; this is the shorthand for tools and tests that only have a save.
 */
export function growOnSolve(save: WorldSave, openedBefore: RegionId[], now = new Date()): GrowthNews | null {
  return creditSolve(save, { boardSanctuary: activeSanctuary(save), openedBefore }, now);
}

/** Regions (the Farm and the exotic ones) that are open. */
export function openRegions(save: Pick<SaveV2, 'journey' | 'world'>): RegionId[] {
  return REGIONS.map((r) => r.id as RegionId).filter((id) => isOpen(save, id));
}

/**
 * Startup safety net. Saves from before D35 never grew the Pet Garden (its residents arrived at Journey levels), so its
 * growth starts at the arrival count of the latest resident already home: everyone before them in the new order moves
 * in too, and the next one is a fair number of puzzles away. Then any arrival that was reached but not recorded is
 * welcomed, and a sanctuary that is already finished pays its completion gift (once, by ledger id). Idempotent.
 */
export function reconcileWorld(save: WorldSave, now = new Date()): AnimalId[] {
  if (save.world.growth.harmony === undefined) {
    const garden = SANCTUARY_BY_ID.harmony.arrivals;
    const reached = garden.filter((a) => isHome(save, a.id)).reduce((m, a) => Math.max(m, a.at), 0);
    if (reached > 0) save.world.growth.harmony = reached;
  }
  const out: AnimalId[] = [];
  for (const s of SANCTUARIES) {
    out.push(...welcomeArrivals(save, s.id, now));
    // A sanctuary that is already finished (an earlier save whose garden filled up above) still pays its gift, once.
    if (isComplete(save, s.id)) grant(save, `world:complete:${s.id}`, s.completeCoins, 'gift', now, `${s.name} complete`);
  }
  return out;
}

/** The next exotic region still to open, and how many Journey levels until it does. */
export function nextToOpen(save: Pick<SaveV2, 'journey' | 'world'>): { id: RegionId; def: SanctuaryDef; left: number } | null {
  for (const r of REGIONS) {
    const id = r.id as RegionId;
    if (!isOpen(save, id)) return { id, def: r, left: r.opensAfterLevel - cleared(save) };
  }
  return null;
}

/** Puzzles still to solve (while building it) before a sanctuary's next stage. */
export function puzzlesToNext(save: Pick<SaveV2, 'world'>, id: SanctuaryId): number {
  const n = nextStage(save, id);
  return n ? n.need - n.have : 0;
}

/**
 * One line from a sanctuary's animal, tied to what really happened (never invented): a newcomer, the next friend on
 * the way, or the sanctuary finished. Null while nobody lives there yet.
 */
export function regionChat(save: Pick<SaveV2, 'journey' | 'world' | 'inventory'>, id: SanctuaryId, now = new Date()): string | null {
  const here = homeAnimals(save, id);
  if (!here.length) return null;
  const day = now.toISOString().slice(0, 10);
  let h = 0;
  for (const ch of `${id}-${day}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const who = animalInfo(here[h % here.length]).name;
  const newest = [...here].sort((a, b) => Date.parse(homeSince(save, b) ?? '') - Date.parse(homeSince(save, a) ?? ''))[0];
  const at = Date.parse(homeSince(save, newest) ?? '');
  if (!Number.isNaN(at) && now.getTime() - at < 2 * 86_400_000) return `${animalInfo(newest).name} is still exploring the new home.`;
  if (isComplete(save, id)) return `${who} thinks this is the best home in the world.`;
  const next = arrivalProgress(save, id);
  if (next && activeSanctuary(save as WorldSave) === id) {
    const nm = animalInfo(next.next.id);
    return `${who} is getting ready for ${nm.name} the ${nm.noun}: ${next.left === 1 ? 'one more puzzle' : `${next.left} more puzzles`}.`;
  }
  return `${who} hopes you'll build here again soon.`;
}

/** When an animal who hasn't come home yet will arrive, in one sentence for its card. */
export function arrivalLine(save: Pick<SaveV2, 'journey' | 'world' | 'inventory'>, id: AnimalId): string {
  const def = SANCTUARIES.find((sd) => sd.arrivals.some((a) => a.id === id));
  if (!def) return 'Arriving soon.';
  if (!isOpen(save, def.id)) return `Lives at the ${def.short}, which opens after level ${def.opensAfterLevel}.`;
  const p = arrivalProgress(save, def.id);
  if (p?.next.id === id)
    return `Coming home next: ${p.left === 1 ? 'one more puzzle' : `${p.left} more puzzles`} while you build the ${def.short}. Until then, this is the animal on your boards there.`;
  return `Arrives later, after the animals before it at the ${def.short}. Solve puzzles while you build there.`;
}
