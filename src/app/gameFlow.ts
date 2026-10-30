/** Starting, resuming and restarting boards. Screens call these; the router shows the game screen. */

import { app } from './app';
import { modeKey, type ModeRef } from '../game/modes';
import { rulesFor } from '../game/modes';
import { currentSpec, puzzleFor } from '../game/puzzles';
import { displayDifficulty } from '../game/grading';
import { Session } from '../game/session';
import { hasMeaningfulProgress, resumeSession } from '../game/sessionPersistence';
import { track } from '../services/analytics';
import { isTutorial } from '../meta/onboarding';
import { startAttempt } from '../competitions/localCup';
import type { SavedSession } from '../services/storage';
import { castFor, parseCast } from '../meta/cast';

/** Starts a fresh board. Paw Cup boards open a new attempt; returns false when none are left. */
export function startGame(mode: ModeRef): boolean {
  if (mode.kind === 'cup') {
    if (!startAttempt(app.save, mode)) return false;
    app.persist();
  }
  const spec = currentSpec(mode);
  const puzzle = puzzleFor(mode, spec);
  // The guided first board is forgiving: mistakes are explained, never punished.
  const rules = rulesFor(mode);
  const session = new Session(puzzle, { hearts: rules.hearts && !isTutorial(mode, app.save), maxHearts: rules.maxHearts });
  // Which animals this board shows is decided once, when it starts, and kept with it (D35).
  app.active = { mode, session, spec, cast: castFor(app.save, session.rule, puzzle.seed) };
  track('puzzle_start', { mode: mode.kind, size: puzzle.size, difficulty: displayDifficulty(puzzle) });
  app.router.go({ screen: 'game' });
  return true;
}

/** The saved board for this exact mode, if there is one. */
export function savedFor(mode: ModeRef): SavedSession | null {
  if (mode.kind === 'cup') return app.save.cup.open[modeKey(mode)] ?? null;
  const s = app.save.lastSession;
  return s && modeKey(s.mode) === modeKey(mode) ? s : null;
}

/**
 * Resumes a saved board (by default the main in-progress board). Returns false, and drops the save, if it can't be
 * restored safely. A Paw Cup attempt that can't be restored stays used: it is never silently replaced.
 */
export function resumeGame(saved: SavedSession | null = app.save.lastSession): boolean {
  const r = resumeSession(saved);
  if (!r) {
    if (saved) app.clearSaved(saved.mode);
    app.persist();
    return false;
  }
  app.active = { ...r, cast: parseCast(r.cast, r.session.rule) ?? castFor(app.save, r.session.rule, r.session.puzzle.seed) };
  app.router.go({ screen: 'game' });
  return true;
}

/**
 * Opens a mode the player picked: continues the saved board of that same mode if it has progress, otherwise starts
 * fresh. Every "play this" entry point uses it, so no tap can quietly throw away a board in progress.
 */
export function playMode(mode: ModeRef): boolean {
  const saved = savedFor(mode);
  if (saved && (mode.kind === 'cup' || hasMeaningfulProgress(saved)) && resumeGame(saved)) return true;
  if (mode.kind === 'cup' && saved) return false; // unrestorable attempt: it was used
  return startGame(mode);
}

/** Restarts the current board. Paw Cup attempts can't be restarted (each attempt is final). */
export function restartGame(): void {
  if (!app.active || app.active.mode.kind === 'cup') return;
  const { mode } = app.active;
  app.clearSaved(mode);
  app.persist();
  startGame(mode);
}

/** The saved board's mode, if it is resumable. */
export function resumableMode(): ModeRef | null {
  const s = app.save.lastSession;
  if (!s || s.mode.kind === 'cup') return null;
  return hasMeaningfulProgress(s) ? s.mode : null;
}
