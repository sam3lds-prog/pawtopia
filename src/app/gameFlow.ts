/**
 * Starting, resuming and restarting boards. Screens call these; the router shows the game screen.
 *
 * Saved boards (D38): every mode but the Paw Cup keeps one board in progress, in its own slot (`save.sessions`), so a
 * Journey board survives a Daily or a Zen played in between. Within a mode there is still one slot, and the only place a
 * board can be replaced is here, in `playMode`: before a different board of the same mode would take the slot from one
 * with real progress, the player is asked — resume the saved board, start the new one, or neither. No screen can throw a
 * board away without that question, whichever button it came from.
 */

import { app } from './app';
import { modeKey, playsSolo, rulesFor, type ModeRef } from '../game/modes';
import { currentSpec, modeTitle, puzzleFor, sizeFor } from '../game/puzzles';
import { displayDifficulty } from '../game/grading';
import { Session } from '../game/session';
import { hasMeaningfulProgress, resumeSession } from '../game/sessionPersistence';
import { track } from '../services/analytics';
import { isTutorial } from '../meta/onboarding';
import { startAttempt } from '../competitions/localCup';
import { SESSION_SLOTS, savedSession, slotOf, type SavedSession } from '../services/storage';
import { castFor, parseCast } from '../meta/cast';
import { SANCTUARY_BY_ID, type SanctuaryId } from '../meta/catalogs/sanctuaries';
import { openSheet } from '../ui/components/sheet';
import { actionOf, esc, plural } from '../ui/dom';

/** A fresh id for a board that just started: its world credit is recorded once under it (world.creditSolve). */
export function newBoardId(mode: ModeRef, now = Date.now()): string {
  return `${modeKey(mode)}:${now.toString(36)}:${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

/** The seed of the Zen board number `n` of a size (the Journey hub hands these out in order). */
export function zenSeed(n: number, size: number): number {
  return 7_000_000 + n * 97 + size;
}

/** The next Zen board of a size for this player: one animal until the two-animal lesson is done (D35). */
export function nextZenMode(size: number): ModeRef {
  const save = app.save;
  return { kind: 'zen', size, seed: zenSeed(save.zen.nextSeed, size), ...(playsSolo(save.journey.nextLevel) ? { rule: 'solo' as const } : {}) };
}

/** Starts a fresh board. Paw Cup boards open a new attempt; returns false when none are left. */
export function startGame(mode: ModeRef): boolean {
  if (mode.kind === 'cup') {
    if (!startAttempt(app.save, mode)) return false;
    app.persist();
  }
  // Handing out the Zen board number consumes it, so the next tap on a size gets a new board.
  if (mode.kind === 'zen' && mode.seed === zenSeed(app.save.zen.nextSeed, mode.size)) {
    app.save.zen.nextSeed++;
    app.persist();
  }
  const spec = currentSpec(mode);
  const puzzle = puzzleFor(mode, spec);
  // The guided first board is forgiving: mistakes are explained, never punished.
  const rules = rulesFor(mode);
  const session = new Session(puzzle, { hearts: rules.hearts && !isTutorial(mode, app.save), maxHearts: rules.maxHearts });
  // Which animals this board shows is decided once, when it starts, and kept with it (D35).
  app.active = { mode, session, spec, cast: castFor(app.save, session.rule, puzzle.seed), boardId: newBoardId(mode) };
  track('puzzle_start', { mode: mode.kind, size: puzzle.size, difficulty: displayDifficulty(puzzle) });
  app.router.go({ screen: 'game' });
  return true;
}

/** The saved board for this exact mode, if there is one. */
export function savedFor(mode: ModeRef): SavedSession | null {
  return savedSession(app.save, mode);
}

/**
 * The saved board that starting `mode` would replace: a board of the same mode with real progress that isn't this
 * board (another level, another day, another Zen seed). Null when the slot is free, holds this very board, or holds
 * nothing worth keeping. Paw Cup attempts have a slot each, so they never collide.
 */
export function heldBoardFor(mode: ModeRef): SavedSession | null {
  const slot = slotOf(mode);
  if (!slot) return null;
  const s = app.save.sessions[slot];
  if (!s || modeKey(s.mode) === modeKey(mode)) return null;
  return hasMeaningfulProgress(s) ? s : null;
}

/**
 * Resumes a saved board. Returns false, and drops the save, if it can't be restored safely. A Paw Cup attempt that
 * can't be restored stays used: it is never silently replaced.
 */
export function resumeGame(saved: SavedSession | null): boolean {
  const r = resumeSession(saved);
  if (!r) {
    if (saved) app.clearSaved(saved.mode);
    app.persist();
    return false;
  }
  // A board saved before boards had ids gets one now; it is kept with the board from here on.
  app.active = { ...r, cast: parseCast(r.cast, r.session.rule) ?? castFor(app.save, r.session.rule, r.session.puzzle.seed), boardId: r.boardId ?? newBoardId(r.mode) };
  app.router.go({ screen: 'game' });
  return true;
}

/**
 * Opens a mode the player picked: continues the saved board of that same mode if it has progress, otherwise starts
 * fresh. Every "play this" entry point uses it, so no tap can quietly throw away a board in progress: when a different
 * board of the same mode is saved with real progress, the player is asked first (`askAboutHeldBoard`). Returns false
 * only for a Paw Cup board whose attempt can't be opened.
 */
export function playMode(mode: ModeRef): boolean {
  const saved = savedFor(mode);
  if (saved && (mode.kind === 'cup' || hasMeaningfulProgress(saved)) && resumeGame(saved)) return true;
  if (mode.kind === 'cup' && saved) return false; // unrestorable attempt: it was used
  const held = heldBoardFor(mode);
  if (held) {
    askAboutHeldBoard(held, mode);
    return true;
  }
  return startGame(mode);
}

/** One line naming a saved board for the question: "level 3", "Saturday's Daily", "6×6 Zen". */
function boardName(s: SavedSession): string {
  const m = s.mode;
  if (m.kind === 'level') return `level ${m.level}`;
  if (m.kind === 'daily') return `the Daily from ${new Date(`${m.dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}`;
  if (m.kind === 'zen') return `${m.size}×${m.size} Zen`;
  return modeTitle(m);
}

/** What the player is about to start, in the same words. */
function newBoardName(mode: ModeRef): string {
  if (mode.kind === 'level') return `level ${mode.level}`;
  if (mode.kind === 'daily') return "today's Daily";
  if (mode.kind === 'zen') return `a new ${mode.size}×${mode.size} Zen board`;
  return modeTitle(mode);
}

/**
 * The one question before a saved board would be replaced (D38): resume it, start the new one (and let the saved one
 * go), or do neither. Shown over whichever screen asked; the sheet lives in that screen's scope.
 */
export function askAboutHeldBoard(held: SavedSession, mode: ModeRef): void {
  const scope = app.router.scope;
  if (!scope) return;
  const placed = held.snap.history?.length ?? 0;
  const heldName = boardName(held);
  const kindWord = mode.kind === 'level' ? 'Journey' : mode.kind === 'daily' ? 'Daily' : 'Zen';
  const sh = openSheet(scope, {
    title: `Start ${newBoardName(mode)}?`,
    center: true,
    className: 'held-board',
    body: `<p class="sheet__lead">Your ${esc(heldName)} board${placed ? ` (${plural(placed, 'move')} so far)` : ''} will be cleared. One ${kindWord} board is kept at a time.</p>
      <div class="sheet__actions">
        <button class="btn btn--block" data-act="resume" data-autofocus>Resume ${esc(heldName)}</button>
        <button class="btn btn--secondary btn--block" data-act="go">Start ${esc(newBoardName(mode))}</button>
        <button class="btn btn--quiet" data-act="keep">Not now</button>
      </div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a) return;
    sh.close();
    if (a.act === 'resume') {
      if (!resumeGame(held)) startGame(mode);
    } else if (a.act === 'go') {
      app.clearSaved(held.mode);
      startGame(mode);
    }
  });
}

/** Restarts the current board. Paw Cup attempts can't be restarted (each attempt is final). */
export function restartGame(): void {
  if (!app.active || app.active.mode.kind === 'cup') return;
  const { mode } = app.active;
  app.clearSaved(mode);
  app.persist();
  startGame(mode);
}

/** Every saved board with real progress outside the Paw Cup, Journey first (one per mode). */
export function resumableSessions(): SavedSession[] {
  const out: SavedSession[] = [];
  for (const k of SESSION_SLOTS) {
    const s = app.save.sessions[k];
    if (s && hasMeaningfulProgress(s)) out.push(s);
  }
  return out;
}

/** The saved board's mode for one slot, if it is resumable. */
export function resumableMode(kind: 'level' | 'daily' | 'zen' = 'level'): ModeRef | null {
  const s = app.save.sessions[kind];
  return s && hasMeaningfulProgress(s) ? s.mode : null;
}

/** The board a saved Zen or Daily would open, in a few words, for the hub's resume lines. */
export function savedBoardLine(s: SavedSession): string {
  const size = sizeFor(s.mode, s.specVersion ?? 1);
  return `${size}×${size} · saved where you left it`;
}

/**
 * The sanctuaries the saved boards (Journey, Daily or Zen, with real progress) will help when they are finished.
 * A board helps the sanctuary it started for even if the player builds elsewhere meanwhile (world.beneficiaryOf).
 */
export function savedBoardSanctuaries(): SanctuaryId[] {
  const out: SanctuaryId[] = [];
  for (const s of resumableSessions()) {
    const id = s.cast?.sanctuary;
    if (id && id in SANCTUARY_BY_ID && !out.includes(id as SanctuaryId)) out.push(id as SanctuaryId);
  }
  return out;
}

/** The one-line toast for choosing where to build, honest about boards already on the table. */
export function buildHereMessage(id: SanctuaryId): string {
  const def = SANCTUARY_BY_ID[id];
  const held = savedBoardSanctuaries().filter((h) => h !== id);
  if (held.length === 1)
    return `Now building the ${def.name}. Your saved ${SANCTUARY_BY_ID[held[0]].short} board still helps the ${SANCTUARY_BY_ID[held[0]].short}; every new board helps the ${def.short}.`;
  if (held.length > 1) return `Now building the ${def.name}. Your saved boards still help the sanctuaries they started for; every new board helps the ${def.short}.`;
  return `Now building the ${def.name}. Every puzzle you solve helps it grow.`;
}
