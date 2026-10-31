/**
 * Play modes and how each one identifies its puzzle. A ModeRef is all we need to rebuild the exact
 * same board later (resume after the app was closed, share, verify), because the generator is
 * deterministic for (size, seed).
 */

export type ModeRef =
  | { kind: 'level'; level: number }
  /** `rule: 'solo'`: the one-animal Daily, for players who haven't reached two animals yet (D35). */
  | { kind: 'daily'; dateKey: string; rule?: 'solo' }
  | { kind: 'zen'; size: number; seed: number; rule?: 'solo' }
  | { kind: 'cup'; weekKey: string; index: number };

/** Journey levels from which boards hold two animals (D35). Kept here so screens can ask without the generator. */
export const FIRST_PAIR_LEVEL = 21;

/** Whether a player still plays one-animal boards outside the Journey (Daily, Zen): until the two-animal lesson is done. */
export function playsSolo(nextLevel: number): boolean {
  return nextLevel <= FIRST_PAIR_LEVEL;
}

/** Today's Daily for a player at `nextLevel`. */
export function dailyFor(dateKey: string, nextLevel: number): ModeRef {
  return playsSolo(nextLevel) ? { kind: 'daily', dateKey, rule: 'solo' } : { kind: 'daily', dateKey };
}

export type ModeKind = ModeRef['kind'];

/** Mistakes allowed on a casual board (Journey, Daily) before it ends. Hearts never carry over between boards. */
export const CASUAL_HEARTS = 5;
/** Paw Cup keeps its published competitive rule: three wrong placements end an attempt. */
export const CUP_HEARTS = 3;

export interface ModeRules {
  /** Hearts and the mistake allowance. Off in Zen. */
  hearts: boolean;
  /** How many hearts a board of this mode starts with (only meaningful when `hearts` is on). */
  maxHearts: number;
  /** Show the running clock. */
  timer: boolean;
  /** Hints available. Never in Paw Cup (competitive rules). */
  hints: boolean;
  /** Revive after losing. Never in Paw Cup. */
  revive: boolean;
  /** Earns Paw Coins on first clear. */
  rewards: boolean;
}

export function rulesFor(mode: ModeRef): ModeRules {
  switch (mode.kind) {
    case 'level':
      return { hearts: true, maxHearts: CASUAL_HEARTS, timer: true, hints: true, revive: true, rewards: true };
    case 'daily':
      return { hearts: true, maxHearts: CASUAL_HEARTS, timer: true, hints: true, revive: true, rewards: true };
    case 'zen':
      return { hearts: false, maxHearts: CASUAL_HEARTS, timer: false, hints: true, revive: false, rewards: false };
    case 'cup':
      return { hearts: true, maxHearts: CUP_HEARTS, timer: true, hints: false, revive: false, rewards: false };
  }
}

/** Stable string id for a mode's board, e.g. `L12`, `D2026-10-25`, `D2026-10-25s` (one-animal), `Z7-123`, `C2026-W43-2`. */
export function modeKey(mode: ModeRef): string {
  switch (mode.kind) {
    case 'level':
      return `L${mode.level}`;
    case 'daily':
      return `D${mode.dateKey}${mode.rule === 'solo' ? 's' : ''}`;
    case 'zen':
      return `Z${mode.size}-${mode.seed}${mode.rule === 'solo' ? 's' : ''}`;
    case 'cup':
      return `C${mode.weekKey}-${mode.index}`;
  }
}

/**
 * What the win sheet's primary button should open. Journey advances to the level after the one
 * just solved (the v1 bug replayed the same level); other modes go back to where they came from.
 */
export function nextAfterWin(mode: ModeRef): ModeRef | 'journey' | 'cup' {
  if (mode.kind === 'level') return { kind: 'level', level: mode.level + 1 };
  if (mode.kind === 'cup') return 'cup';
  return 'journey';
}

export function isValidModeRef(x: unknown): x is ModeRef {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  switch (m.kind) {
    case 'level':
      return Number.isInteger(m.level) && (m.level as number) >= 1;
    case 'daily':
      return typeof m.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.dateKey) && (m.rule === undefined || m.rule === 'solo');
    case 'zen':
      return (
        Number.isInteger(m.size) &&
        (m.size as number) >= 5 &&
        (m.size as number) <= 9 &&
        Number.isInteger(m.seed) &&
        (m.rule === undefined || m.rule === 'solo')
      );
    case 'cup':
      return typeof m.weekKey === 'string' && Number.isInteger(m.index);
    default:
      return false;
  }
}
