/**
 * The leaderboard's server logic, written against a tiny document-store interface so it runs unchanged in the Cloud
 * Functions (Firestore, `functions/src/index.ts`), in unit tests (an in-memory store) and in the tester preview's
 * on-device leaderboard. Everything a player can change goes through here; the security rules let clients read the
 * public scores and their own player document, and write nothing.
 *
 * Documents:
 *   players/{uid}               nickname, avatar, createdAt, updatedAt, rate (solves this hour / day)   [owner reads]
 *   players/{uid}/awards/{id}   points, key, at — one per Paw Points award, so nothing pays twice           [owner reads]
 *   scores/{uid}                nickname, avatar, total, week, weekKey, solves, updatedAt                    [signed-in read]
 *   reports/{uid}               who reported this player's name                                               [server only]
 */

import { utcWeekKey } from '../game/dates';
import { COMPANIONS } from '../meta/catalogs/companions';
import { PETS } from '../meta/catalogs/pets';
import { checkSolve, parseSubmission, type CheckResult, type RejectReason } from './check';
import { cleanNickname, neutralName } from './nickname';

export type Doc = Record<string, unknown>;

export interface Tx {
  get(path: string): Promise<Doc | null>;
  set(path: string, data: Doc): void;
  delete(path: string): void;
}

export interface Store {
  /** Runs `fn` atomically. All reads must come before any write (as in Firestore). */
  tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Deletes a document and everything under it. */
  deleteTree(path: string): Promise<void>;
  /** Players whose name this player has reported (so leaving can remove those reports too). */
  reportedBy(uid: string): Promise<string[]>;
  /** Players with no leaderboard activity since `beforeIso` (oldest first, at most `limit`). */
  inactiveSince(beforeIso: string, limit: number): Promise<string[]>;
}

export type LbErrorCode = 'invalid-argument' | 'failed-precondition' | 'not-found' | 'permission-denied' | 'resource-exhausted';

export class LbError extends Error {
  constructor(
    readonly code: LbErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const LIMITS = {
  /** Solves per request. */
  perCall: 10,
  /**
   * Solves checked per hour and per UTC day. Generous for a person (a long evening of the Journey is well under it),
   * and it bounds what a script could add: logs can be replayed honestly by a bot, so pacing is the real limit.
   */
  perHour: 30,
  perDay: 80,
  /** Distinct reports that replace a name with a neutral one. */
  reportsToHide: 3,
  /** Accounts with no leaderboard activity for this long are removed by the daily clean-up. */
  inactiveDays: 365,
} as const;

export const AVATARS: readonly string[] = [...PETS.map((p) => p.id), ...COMPANIONS.map((c) => c.id)];

interface Rate {
  hour: string;
  nHour: number;
  day: string;
  nDay: number;
}

export interface PublicScore {
  nickname: string;
  avatar: string;
  total: number;
  week: number;
  weekKey: string;
  solves: number;
  updatedAt: string;
}

export type SolveStatus = 'ok' | 'already' | 'rate-limited' | 'bad-request' | RejectReason;

export interface SubmitResult {
  results: Array<{ key: string; status: SolveStatus; points: number; awarded: string[] }>;
  total: number;
  week: number;
  weekKey: string;
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d);

function readRate(x: unknown, now: Date): Rate {
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  const r = (x && typeof x === 'object' ? x : {}) as Partial<Rate>;
  return { hour, day, nHour: r.hour === hour ? num(r.nHour) : 0, nDay: r.day === day ? num(r.nDay) : 0 };
}

/** Week points roll over at the UTC week boundary. */
function weekOf(score: Doc | null, now: Date): { weekKey: string; week: number } {
  const weekKey = utcWeekKey(now);
  return { weekKey, week: score && score.weekKey === weekKey ? num(score.week) : 0 };
}

function safeCheck(x: unknown, now: Date): CheckResult | null {
  const sub = parseSubmission(x);
  if (!sub) return null;
  try {
    return checkSolve(sub, now);
  } catch {
    return { ok: false, key: '?', reason: 'invalid-log' };
  }
}

/** Records verified solves. Unknown or malformed entries are reported back, never trusted. */
export async function submitSolves(store: Store, uid: string, raw: unknown, now = new Date()): Promise<SubmitResult> {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIMITS.perCall) throw new LbError('invalid-argument', `Send 1 to ${LIMITS.perCall} solves at a time.`);
  // Cheap gate first: only a joined player within their hourly / daily allowance gets any boards rebuilt and replayed.
  const before = await store.tx(async (tx) => tx.get(`players/${uid}`));
  if (!before) throw new LbError('failed-precondition', 'Join the leaderboard first.');
  const r0 = readRate(before.rate, now);
  const budget = Math.max(0, Math.min(LIMITS.perHour - r0.nHour, LIMITS.perDay - r0.nDay));
  // The expensive part (rebuilding and replaying each board) happens outside the transaction, within the budget.
  const checks: Array<CheckResult | null | 'over'> = raw.map((x, i) => (i < budget ? safeCheck(x, now) : 'over'));
  return store.tx(async (tx) => {
    const player = await tx.get(`players/${uid}`);
    if (!player) throw new LbError('failed-precondition', 'Join the leaderboard first.');
    const score = await tx.get(`scores/${uid}`);
    const ids = [...new Set(checks.flatMap((c) => (c && c !== 'over' && c.ok ? c.awards.map((a) => a.id) : [])))];
    const have = new Set<string>();
    for (const id of ids) if (await tx.get(`players/${uid}/awards/${id}`)) have.add(id);

    const rate = readRate(player.rate, now);
    const { weekKey } = weekOf(score, now);
    let { week } = weekOf(score, now);
    let total = num(score?.total);
    let solves = num(score?.solves);
    const at = now.toISOString();
    const results: SubmitResult['results'] = [];
    for (const c of checks) {
      if (c === 'over' || rate.nHour >= LIMITS.perHour || rate.nDay >= LIMITS.perDay) {
        results.push({ key: c && c !== 'over' ? c.key : '?', status: 'rate-limited', points: 0, awarded: [] });
        continue;
      }
      if (!c) {
        results.push({ key: '?', status: 'bad-request', points: 0, awarded: [] });
        continue;
      }
      rate.nHour++;
      rate.nDay++;
      if (!c.ok) {
        results.push({ key: c.key, status: c.reason, points: 0, awarded: [] });
        continue;
      }
      const fresh = c.awards.filter((a) => !have.has(a.id));
      for (const a of fresh) {
        have.add(a.id);
        tx.set(`players/${uid}/awards/${a.id}`, { points: a.points, key: c.key, at });
      }
      const points = fresh.reduce((n, a) => n + a.points, 0);
      total += points;
      week += points;
      if (points) solves++;
      results.push({ key: c.key, status: points ? 'ok' : 'already', points, awarded: fresh.map((a) => a.id) });
    }
    tx.set(`players/${uid}`, { ...player, rate });
    const pub: PublicScore = {
      nickname: str(player.nickname, neutralName(uid)),
      avatar: str(player.avatar, 'mochi'),
      total,
      week,
      weekKey,
      solves,
      updatedAt: at,
    };
    tx.set(`scores/${uid}`, pub as unknown as Doc);
    return { results, total, week, weekKey };
  });
}

/** Joins the leaderboard, or changes the name or picture. */
export async function setProfile(store: Store, uid: string, raw: unknown, now = new Date()): Promise<{ nickname: string; avatar: string; total: number; week: number; weekKey: string }> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const nick = cleanNickname(o.nickname);
  if (!nick.ok) throw new LbError('invalid-argument', nick.problem);
  const avatar = typeof o.avatar === 'string' && AVATARS.includes(o.avatar) ? o.avatar : null;
  if (!avatar) throw new LbError('invalid-argument', 'avatar');
  return store.tx(async (tx) => {
    const player = await tx.get(`players/${uid}`);
    const score = await tx.get(`scores/${uid}`);
    const at = now.toISOString();
    tx.set(`players/${uid}`, { ...(player ?? {}), nickname: nick.name, avatar, createdAt: str(player?.createdAt, at), updatedAt: at });
    const { weekKey, week } = weekOf(score, now);
    const pub: PublicScore = { nickname: nick.name, avatar, total: num(score?.total), week, weekKey, solves: num(score?.solves), updatedAt: at };
    tx.set(`scores/${uid}`, pub as unknown as Doc);
    return { nickname: nick.name, avatar, total: pub.total, week, weekKey };
  });
}

/**
 * Leaving deletes everything stored for the account: its player data and awards, its public score, reports about its
 * name, and its id in reports it made about others. (The sign-in itself is deleted by the caller.)
 */
export async function deleteAccount(store: Store, uid: string): Promise<void> {
  for (const target of await store.reportedBy(uid)) {
    await store.tx(async (tx) => {
      const rep = await tx.get(`reports/${target}`);
      if (!rep || !Array.isArray(rep.by)) return;
      tx.set(`reports/${target}`, { ...rep, by: (rep.by as unknown[]).filter((x) => x !== uid) });
    });
  }
  await store.deleteTree(`players/${uid}`);
  await store.tx(async (tx) => {
    tx.delete(`scores/${uid}`);
    tx.delete(`reports/${uid}`);
  });
}

/** The daily clean-up: removes accounts with no leaderboard activity for `LIMITS.inactiveDays`. Returns their ids. */
export async function cleanupInactive(store: Store, now = new Date(), limit = 200): Promise<string[]> {
  const cutoff = new Date(now.getTime() - LIMITS.inactiveDays * 86_400_000).toISOString();
  const uids = await store.inactiveSince(cutoff, limit);
  for (const uid of uids) await deleteAccount(store, uid);
  return uids;
}

/** Reports another player's name. Enough distinct reports replace it with a neutral one. */
export async function reportName(store: Store, reporter: string, rawTarget: unknown, now = new Date()): Promise<{ hidden: boolean }> {
  const target = typeof rawTarget === 'string' && /^[\w-]{1,128}$/.test(rawTarget) ? rawTarget : null;
  if (!target) throw new LbError('invalid-argument', 'target');
  if (target === reporter) throw new LbError('invalid-argument', 'self');
  return store.tx(async (tx) => {
    const reporterJoined = await tx.get(`players/${reporter}`);
    if (!reporterJoined) throw new LbError('failed-precondition', 'Join the leaderboard first.');
    // Only players who have actually played (a counted solve) can report, so throwaway accounts can't rename people.
    const reporterScore = await tx.get(`scores/${reporter}`);
    if (num(reporterScore?.solves) < 1) throw new LbError('permission-denied', 'Solve a board on the leaderboard first.');
    const rep = await tx.get(`reports/${target}`);
    const score = await tx.get(`scores/${target}`);
    const player = await tx.get(`players/${target}`);
    if (!score || !player) throw new LbError('not-found', 'No such player.');
    const by = Array.isArray(rep?.by) ? (rep!.by as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    if (by.includes(reporter)) return { hidden: false };
    by.push(reporter);
    const at = now.toISOString();
    if (by.length >= LIMITS.reportsToHide) {
      const name = neutralName(target);
      tx.set(`players/${target}`, { ...player, nickname: name, renamedAt: at });
      tx.set(`scores/${target}`, { ...score, nickname: name });
      tx.set(`reports/${target}`, { by: [], hidden: num(rep?.hidden) + 1, at });
      return { hidden: true };
    }
    tx.set(`reports/${target}`, { by, hidden: num(rep?.hidden), at });
    return { hidden: false };
  });
}

// ------------------------------------------------------------------ an in-memory store (tests, the tester preview)

/** A Store kept in memory (optionally persisted by the caller). Enforces reads-before-writes like Firestore. */
export class MemoryStore implements Store {
  constructor(readonly docs: Map<string, Doc> = new Map()) {}

  async tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const writes: Array<[string, Doc | null]> = [];
    const tx: Tx = {
      get: async (path) => {
        if (writes.length) throw new Error('reads must come before writes in a transaction');
        const d = this.docs.get(path);
        return d ? structuredClone(d) : null;
      },
      set: (path, data) => void writes.push([path, structuredClone(data)]),
      delete: (path) => void writes.push([path, null]),
    };
    const out = await fn(tx);
    for (const [p, d] of writes) {
      if (d) this.docs.set(p, d);
      else this.docs.delete(p);
    }
    return out;
  }

  async deleteTree(path: string): Promise<void> {
    for (const k of [...this.docs.keys()]) if (k === path || k.startsWith(`${path}/`)) this.docs.delete(k);
  }

  async reportedBy(uid: string): Promise<string[]> {
    const out: string[] = [];
    for (const [k, v] of this.docs) {
      const m = /^reports\/([^/]+)$/.exec(k);
      if (m && Array.isArray(v.by) && v.by.includes(uid)) out.push(m[1]);
    }
    return out;
  }

  async inactiveSince(beforeIso: string, limit: number): Promise<string[]> {
    return this.scores()
      .filter((x) => typeof x.updatedAt === 'string' && x.updatedAt < beforeIso)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1))
      .slice(0, limit)
      .map((x) => x.uid);
  }

  /** Public scores (for the in-memory leaderboard). */
  scores(): Array<PublicScore & { uid: string }> {
    const out: Array<PublicScore & { uid: string }> = [];
    for (const [k, v] of this.docs) {
      const m = /^scores\/([^/]+)$/.exec(k);
      if (m) out.push({ uid: m[1], ...(v as unknown as PublicScore) });
    }
    return out;
  }
}
