/** Starting, resuming and restarting boards. Screens call these; the router shows the game screen. */

import { app } from './app';
import type { ModeRef } from '../game/modes';
import { rulesFor } from '../game/modes';
import { puzzleFor } from '../game/puzzles';
import { Session } from '../game/session';
import { resumeSession } from '../game/sessionPersistence';
import { track } from '../services/analytics';
import { isTutorial } from '../meta/onboarding';
import { startAttempt } from '../competitions/localCup';

/** Starts a fresh board. Paw Cup boards open a new attempt; returns false when none are left. */
export function startGame(mode: ModeRef): boolean {
  if (mode.kind === 'cup') {
    if (!startAttempt(app.save, mode)) return false;
    app.persist();
  }
  const puzzle = puzzleFor(mode);
  // The guided first board is forgiving: mistakes are explained, never punished.
  const session = new Session(puzzle, { hearts: rulesFor(mode).hearts && !isTutorial(mode, app.save) });
  app.active = { mode, session };
  track('puzzle_start', { mode: mode.kind, size: puzzle.size, difficulty: puzzle.difficulty });
  app.router.go({ screen: 'game' });
  return true;
}

/** Resumes the saved board. Returns false (and drops the save) if it can't be restored safely. */
export function resumeGame(): boolean {
  const r = resumeSession(app.save.lastSession);
  if (!r) {
    app.save.lastSession = null;
    app.persist();
    return false;
  }
  app.active = r;
  app.router.go({ screen: 'game' });
  return true;
}

/** Restarts the current board. Paw Cup attempts can't be restarted (each attempt is final). */
export function restartGame(): void {
  if (!app.active || app.active.mode.kind === 'cup') return;
  const { mode } = app.active;
  app.save.lastSession = null;
  app.persist();
  startGame(mode);
}

/** The saved board's mode, if it is resumable. */
export function resumableMode(): ModeRef | null {
  const s = app.save.lastSession;
  if (!s) return null;
  const hasProgress = (s.snap?.history?.length ?? 0) > 0 || (s.snap?.elapsedMs ?? 0) > 15_000;
  return hasProgress ? s.mode : null;
}
