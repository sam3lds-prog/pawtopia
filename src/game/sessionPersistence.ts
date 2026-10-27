/** Saves and resumes the in-progress board so backgrounding or closing the app never loses a game. */

import type { SavedSession } from '../services/storage';
import type { ModeRef } from './modes';
import { rulesFor } from './modes';
import { GENERATOR_VERSION, puzzleDigest, puzzleFor } from './puzzles';
import { Session } from './session';

export function captureSession(mode: ModeRef, session: Session, now = new Date()): SavedSession | null {
  // Only boards still in play are resumable. A won board is done; a lost one ended with its loss sheet
  // (restoring it would bring back a board that ignores every tap).
  if (session.outcome !== 'playing') return null;
  return {
    mode,
    digest: puzzleDigest(session.puzzle),
    generatorVersion: GENERATOR_VERSION,
    savedAt: now.toISOString(),
    // Paw Cup keeps its full input log so the attempt is scored by replaying every move, across resumes.
    snap: session.snapshot(mode.kind === 'cup'),
  };
}

/**
 * Rebuilds a saved board. Returns null (and the caller should drop the save) when the generator
 * version changed, the regenerated layout differs, or the snapshot doesn't fit the board.
 */
export function resumeSession(saved: SavedSession | null): { mode: ModeRef; session: Session } | null {
  if (!saved) return null;
  if (saved.generatorVersion !== GENERATOR_VERSION) return null;
  let puzzle;
  try {
    puzzle = puzzleFor(saved.mode);
  } catch {
    return null;
  }
  if (puzzleDigest(puzzle) !== saved.digest) return null;
  const rules = rulesFor(saved.mode);
  const session = Session.restore(puzzle, saved.snap, { hearts: rules.hearts, maxHearts: rules.maxHearts });
  if (!session || session.outcome !== 'playing') return null;
  return { mode: saved.mode, session };
}

/** True when the saved board has real progress worth offering to resume. */
export function hasMeaningfulProgress(saved: SavedSession | null): boolean {
  if (!saved?.snap?.cells) return false;
  const placed = saved.snap.history?.length ?? 0;
  return placed > 0 || (saved.snap.elapsedMs ?? 0) > 15_000;
}
