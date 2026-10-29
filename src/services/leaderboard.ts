/**
 * The online leaderboard, from the app's side. Three implementations behind one interface:
 *
 *  - **online**: Firebase (anonymous sign-in, callable Cloud Functions for every change, Firestore reads for the
 *    tables). The Firebase SDK is loaded only when the player opens or uses the leaderboard.
 *  - **device**: development builds and the tester preview without Firebase settings. The same server logic
 *    (src/leaderboard/server.ts) runs against a store kept on this device, so the whole flow can be tried. Its table
 *    only ever contains the player: no made-up players, ever.
 *  - **off**: a release build without Firebase settings. The League says the leaderboard is coming.
 *
 * Nothing here sends points: the server computes them by replaying each solved board.
 */

import { FIREBASE, TEST_BUILD, firebaseConfigured } from '../config/services';
import { utcWeekKey } from '../game/dates';
import type { SubmitResult } from '../leaderboard/server';
import type { PendingSolve } from './storage';

export type LbBoard = 'week' | 'all';
export type LbMode = 'online' | 'device' | 'off';

export interface LbProfile {
  nickname: string;
  avatar: string;
}

export interface LbEntry {
  uid: string;
  nickname: string;
  avatar: string;
  points: number;
  rank: number;
  you: boolean;
}

export interface LbTable {
  entries: LbEntry[];
  /** You, when you're not in `entries` (or null before you've scored on this board). */
  you: LbEntry | null;
  players: number;
}

export type LbErrorKind = 'offline' | 'invalid' | 'not-joined' | 'unavailable' | 'failed';

export class LbClientError extends Error {
  constructor(
    readonly kind: LbErrorKind,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

export interface LeaderboardService {
  readonly mode: LbMode;
  /** Joins (signing in anonymously if needed) or updates the name and picture. */
  join(p: LbProfile): Promise<{ total: number; week: number; weekKey: string }>;
  submit(solves: PendingSolve[]): Promise<SubmitResult>;
  table(board: LbBoard, n?: number): Promise<LbTable>;
  report(uid: string): Promise<void>;
  /** Leaves the leaderboard: deletes everything stored for this player, and the sign-in. */
  leave(): Promise<void>;
}

const TOP_N = 50;

/** Competition ranking: equal points share a rank. */
export function rankEntries<T extends { points: number }>(rows: T[]): Array<T & { rank: number }> {
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  return sorted.map((r) => ({ ...r, rank: 1 + sorted.filter((o) => o.points > r.points).length }));
}

const strip = (solves: PendingSolve[]) => solves.map(({ mode, spec, events }) => ({ mode, spec, events }));

// ------------------------------------------------------------------ off

class OffLeaderboard implements LeaderboardService {
  readonly mode = 'off' as const;
  private no(): never {
    throw new LbClientError('unavailable', 'The leaderboard is not open yet.');
  }
  join = async () => this.no();
  submit = async () => this.no();
  table = async () => this.no();
  report = async () => this.no();
  leave = async () => this.no();
}

// ------------------------------------------------------------------ device (tests and the tester preview)

const DEVICE_KEY = 'pawtopia.lb.device';
const DEVICE_UID = 'you-on-this-device';

class DeviceLeaderboard implements LeaderboardService {
  readonly mode = 'device' as const;

  private async store() {
    const { MemoryStore } = await import('../leaderboard/server');
    let docs = new Map<string, Record<string, unknown>>();
    try {
      const raw = localStorage.getItem(DEVICE_KEY);
      if (raw) docs = new Map(JSON.parse(raw) as Array<[string, Record<string, unknown>]>);
    } catch {
      /* start empty */
    }
    const s = new MemoryStore(docs);
    const save = () => {
      try {
        localStorage.setItem(DEVICE_KEY, JSON.stringify([...s.docs]));
      } catch {
        /* storage full or blocked: the device board is only for trying things out */
      }
    };
    return { s, save };
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      const { LbError } = await import('../leaderboard/server');
      if (e instanceof LbError) throw new LbClientError(e.code === 'failed-precondition' ? 'not-joined' : 'invalid', e.message, e.message);
      throw new LbClientError('failed', 'Something went wrong.');
    }
  }

  join(p: LbProfile) {
    return this.wrap(async () => {
      const { setProfile } = await import('../leaderboard/server');
      const { s, save } = await this.store();
      const r = await setProfile(s, DEVICE_UID, p);
      save();
      return r;
    });
  }

  submit(solves: PendingSolve[]) {
    return this.wrap(async () => {
      const { submitSolves } = await import('../leaderboard/server');
      const { s, save } = await this.store();
      const r = await submitSolves(s, DEVICE_UID, strip(solves));
      save();
      return r;
    });
  }

  async table(board: LbBoard): Promise<LbTable> {
    const { s } = await this.store();
    const wk = utcWeekKey();
    const rows = s
      .scores()
      .filter((x) => board === 'all' || x.weekKey === wk)
      .map((x) => ({ uid: x.uid, nickname: x.nickname, avatar: x.avatar, points: board === 'all' ? x.total : x.week, you: x.uid === DEVICE_UID }));
    const entries = rankEntries(rows);
    return { entries, you: null, players: entries.length };
  }

  async report(): Promise<void> {
    throw new LbClientError('invalid', 'There is nobody else on this test leaderboard.');
  }

  leave() {
    return this.wrap(async () => {
      const { deleteAccount } = await import('../leaderboard/server');
      const { s, save } = await this.store();
      await deleteAccount(s, DEVICE_UID);
      save();
    });
  }
}

// ------------------------------------------------------------------ online (Firebase)

type FirebaseKit = {
  auth: import('firebase/auth').Auth;
  authMod: typeof import('firebase/auth');
  db: import('firebase/firestore').Firestore;
  fs: typeof import('firebase/firestore');
  functions: import('firebase/functions').Functions;
  fns: typeof import('firebase/functions');
};

class FirebaseLeaderboard implements LeaderboardService {
  readonly mode = 'online' as const;
  private kit: Promise<FirebaseKit> | null = null;

  private load(): Promise<FirebaseKit> {
    this.kit ??= (async () => {
      const [appMod, authMod, fs, fns] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore'), import('firebase/functions')]);
      const app = appMod.initializeApp({ apiKey: FIREBASE.apiKey, authDomain: FIREBASE.authDomain || undefined, projectId: FIREBASE.projectId, appId: FIREBASE.appId });
      // No popup/redirect resolver: anonymous sign-in only, which also keeps Auth working inside the iOS web view.
      const auth = authMod.initializeAuth(app, { persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence] });
      const db = fs.getFirestore(app);
      const functions = fns.getFunctions(app, FIREBASE.functionsRegion);
      if (FIREBASE.useEmulators) {
        authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
        fns.connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      }
      return { auth, authMod, db, fs, functions, fns };
    })().catch((e) => {
      this.kit = null;
      throw e;
    });
    return this.kit;
  }

  private async user(create: boolean) {
    const k = await this.load();
    await k.auth.authStateReady();
    if (k.auth.currentUser) return k.auth.currentUser;
    if (!create) throw new LbClientError('not-joined', 'Join the leaderboard first.');
    return (await k.authMod.signInAnonymously(k.auth)).user;
  }

  private async call<T>(name: string, data: unknown): Promise<T> {
    const k = await this.load();
    const fn = k.fns.httpsCallable<unknown, T>(k.functions, name, { timeout: 30_000 });
    return (await fn(data)).data;
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof LbClientError) throw e;
      const code = String((e as { code?: string }).code ?? '');
      const msg = String((e as { message?: string }).message ?? '');
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new LbClientError('offline', 'You seem to be offline.');
      if (code.endsWith('unavailable') || code.endsWith('network-request-failed') || code.endsWith('deadline-exceeded')) throw new LbClientError('offline', 'The leaderboard could not be reached.');
      if (code.endsWith('invalid-argument') || code.endsWith('permission-denied')) throw new LbClientError('invalid', msg, msg);
      // Only the server's own "join first" means the player isn't on the leaderboard. Anything else (an auth or App
      // Check problem, a server error) must never make the app forget that the player joined.
      if (code.endsWith('failed-precondition')) throw new LbClientError('not-joined', 'Join the leaderboard first.');
      throw new LbClientError('failed', 'Something went wrong.');
    }
  }

  join(p: LbProfile) {
    return this.guard(async () => {
      await this.user(true);
      return this.call<{ total: number; week: number; weekKey: string }>('lbProfile', p);
    });
  }

  submit(solves: PendingSolve[]) {
    return this.guard(async () => {
      await this.user(false);
      return this.call<SubmitResult>('lbSubmit', { solves: strip(solves) });
    });
  }

  table(board: LbBoard, n = TOP_N): Promise<LbTable> {
    return this.guard(async () => {
      const me = await this.user(false);
      const { db, fs } = await this.load();
      const col = fs.collection(db, 'scores');
      const wk = utcWeekKey();
      const field = board === 'all' ? 'total' : 'week';
      const scope = board === 'all' ? [] : [fs.where('weekKey', '==', wk)];
      const snap = await fs.getDocs(fs.query(col, ...scope, fs.orderBy(field, 'desc'), fs.limit(n)));
      const rows = snap.docs
        .map((d) => {
          const x = d.data() as { nickname?: string; avatar?: string; total?: number; week?: number };
          return { uid: d.id, nickname: x.nickname ?? 'Player', avatar: x.avatar ?? 'mochi', points: (board === 'all' ? x.total : x.week) ?? 0, you: d.id === me.uid };
        })
        .filter((r) => r.points > 0 || r.you);
      const entries = rankEntries(rows);
      const players = (await fs.getCountFromServer(fs.query(col, ...scope))).data().count;
      let you: LbEntry | null = null;
      if (!entries.some((e) => e.you)) {
        const mine = await fs.getDoc(fs.doc(db, 'scores', me.uid));
        if (mine.exists()) {
          const x = mine.data() as { nickname?: string; avatar?: string; total?: number; week?: number; weekKey?: string };
          const points = board === 'all' ? (x.total ?? 0) : x.weekKey === wk ? (x.week ?? 0) : 0;
          const above = (await fs.getCountFromServer(fs.query(col, ...scope, fs.where(field, '>', points)))).data().count;
          you = { uid: me.uid, nickname: x.nickname ?? '', avatar: x.avatar ?? 'mochi', points, rank: above + 1, you: true };
        }
      }
      return { entries, you, players };
    });
  }

  report(uid: string) {
    return this.guard(async () => {
      await this.user(false);
      await this.call('lbReport', { uid });
    });
  }

  leave() {
    return this.guard(async () => {
      await this.user(false);
      // The function deletes the documents and the anonymous account; signing out forgets it on this device.
      await this.call('lbDelete', {});
      const k = await this.load();
      await k.auth.signOut().catch(() => undefined);
    });
  }
}

export function createLeaderboard(): LeaderboardService {
  if (firebaseConfigured()) return new FirebaseLeaderboard();
  if (TEST_BUILD) return new DeviceLeaderboard();
  return new OffLeaderboard();
}

export const leaderboard: LeaderboardService = createLeaderboard();
