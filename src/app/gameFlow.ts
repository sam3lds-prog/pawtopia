/** Starting, resuming and restarting boards. Screens call these; the router shows the game screen. */

import { app } from './app';
import type { ModeRef } from '../game/modes';
import { rulesFor } from '../game/modes';
import { puzzleFor } from '../game/puzzles';
import { Session } from '../game/session';
import { resumeSession } from '../game/sessionPersistence';
import { track } from '../services/analytics';

export function startGame(mode: ModeRef): void {
  const puzzle = puzzleFor(mode);
  const session = new Session(puzzle, { hearts: rulesFor(mode).hearts });
  app.active = { mode, session };
  track('puzzle_start', { mode: mode.kind, size: puzzle.size, difficulty: puzzle.difficulty });
  app.router.go({ screen: 'game' });
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

export function restartGame(): void {
  if (!app.active) return;
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
