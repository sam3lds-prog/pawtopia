/**
 * Pawtopia leaderboard Cloud Functions (2nd gen, callable). Thin adapters: every decision is made by the shared,
 * unit-tested logic in src/leaderboard (bundled in by `npm run fb:build`). Clients can't write Firestore directly
 * (firestore.rules); these functions are the only way in, and they ignore anything a client claims about points.
 *
 * App Check: set ENFORCE_APP_CHECK=true in functions/.env once App Attest is set up for the iOS app (docs/native-setup.md).
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { LbError, deleteAccount, reportName, setProfile, submitSolves, type Doc, type Store } from '../../src/leaderboard/server';

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: process.env.FUNCTIONS_REGION || 'us-central1', maxInstances: 10, memory: '512MiB', timeoutSeconds: 30 });

const store: Store = {
  tx: (fn) =>
    db.runTransaction((t) =>
      fn({
        get: async (path) => {
          const snap = await t.get(db.doc(path));
          return snap.exists ? (snap.data() as Doc) : null;
        },
        set: (path, data) => void t.set(db.doc(path), data),
        delete: (path) => void t.delete(db.doc(path)),
      }),
    ),
  deleteTree: async (path) => {
    await db.recursiveDelete(db.doc(path));
  },
};

const enforceAppCheck = process.env.ENFORCE_APP_CHECK === 'true';

function uidOf(req: CallableRequest): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof LbError) throw new HttpsError(e.code, e.message);
    console.error(e);
    throw new HttpsError('internal', 'Something went wrong.');
  }
}

/** Joins the leaderboard or changes the name / picture: { nickname, avatar }. */
export const lbProfile = onCall({ enforceAppCheck }, (req) => run(() => setProfile(store, uidOf(req), req.data)));

/** Sends solved boards (mode, spec, move log); the server replays them and awards Paw Points once each. */
export const lbSubmit = onCall({ enforceAppCheck }, (req) => run(() => submitSolves(store, uidOf(req), (req.data as { solves?: unknown } | null)?.solves)));

/** Reports another player's name: { uid }. */
export const lbReport = onCall({ enforceAppCheck }, (req) => run(() => reportName(store, uidOf(req), (req.data as { uid?: unknown } | null)?.uid)));

/** Leaves the leaderboard: deletes every document of the account, then the anonymous sign-in itself. */
export const lbDelete = onCall({ enforceAppCheck }, (req) =>
  run(async () => {
    const uid = uidOf(req);
    await deleteAccount(store, uid);
    await getAuth()
      .deleteUser(uid)
      .catch(() => undefined);
    return { ok: true };
  }),
);
