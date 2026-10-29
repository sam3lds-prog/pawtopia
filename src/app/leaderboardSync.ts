/**
 * Keeps the leaderboard in step with play. A solved Journey level or Daily is queued (with its move log) while the
 * player is on the leaderboard, then sent in small batches: after a win, when the app starts, when the League opens and
 * when the device comes back online. The server checks each board and says which Paw Points it awarded; anything it
 * can't count is dropped (it would never count), a rate-limited board waits for the next try. Playing never waits on
 * the network.
 */

import { app } from './app';
import type { ModeRef } from '../game/modes';
import type { SessionEvent } from '../game/session';
import type { SpecVersion } from '../game/specs';
import { enqueueSolve } from '../leaderboard/queue';
import { LIMITS } from '../leaderboard/server';
import { leaderboard, LbClientError } from '../services/leaderboard';
import type { SaveV2 } from '../services/storage';

/** Queues a solved board if it could still earn something on the leaderboard. Returns whether it was queued. */
export function queueSolve(save: SaveV2, mode: ModeRef, spec: SpecVersion, events: SessionEvent[], mistakes: number, hintsUsed: number, now = new Date()): boolean {
  return leaderboard.mode !== 'off' && enqueueSolve(save.leaderboard, mode, spec, events, mistakes, hintsUsed, now);
}

export interface SyncNews {
  sent: number;
  points: number;
}

let inFlight: Promise<SyncNews | null> | null = null;

/** Sends what's waiting (one batch). Safe to call often; concurrent calls share one request. */
export function syncLeaderboard(): Promise<SyncNews | null> {
  inFlight ??= run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<SyncNews | null> {
  const lb = app.save.leaderboard;
  if (!lb.joined || leaderboard.mode === 'off' || !lb.pending.length) return null;
  const batch = lb.pending.slice(0, LIMITS.perCall);
  try {
    const res = await leaderboard.submit(batch);
    const keep = new Set<(typeof batch)[number]>();
    let points = 0;
    res.results.forEach((r, i) => {
      for (const id of r.awarded) app.save.leaderboard.awarded[id] = true;
      points += r.points;
      if (r.status === 'rate-limited') keep.add(batch[i]);
    });
    const live = app.save.leaderboard;
    live.pending = live.pending.filter((p) => !batch.includes(p) || keep.has(p));
    live.last = { total: res.total, week: res.week, weekKey: res.weekKey, at: new Date().toISOString() };
    app.persist();
    return { sent: batch.length, points };
  } catch (e) {
    // Signed out or removed on the server: stop sending until the player joins again (the queue is kept).
    if (e instanceof LbClientError && e.kind === 'not-joined') {
      app.save.leaderboard.joined = false;
      app.persist();
    }
    return null;
  }
}

/** Sends after the app starts and whenever the device comes back online. */
export function startLeaderboardSync(): void {
  if (leaderboard.mode === 'off') return;
  window.setTimeout(() => void syncLeaderboard(), 4000);
  window.addEventListener('online', () => void syncLeaderboard());
}
