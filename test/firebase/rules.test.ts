/**
 * Firestore security rules, against the emulator:
 *   npm run fb:test      (firebase emulators:exec --only firestore …)
 * Clients can read public scores when signed in and their own player data; nobody can write anything directly.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pawtopia',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'scores/alice'), { nickname: 'Alice A', avatar: 'mochi', total: 300, week: 120, weekKey: '2026-W44', solves: 2, updatedAt: 'x' });
    await setDoc(doc(db, 'scores/bob'), { nickname: 'Bob B', avatar: 'pip', total: 100, week: 100, weekKey: '2026-W44', solves: 1, updatedAt: 'x' });
    await setDoc(doc(db, 'players/alice'), { nickname: 'Alice A', avatar: 'mochi', createdAt: 'x' });
    await setDoc(doc(db, 'players/alice/awards/L1'), { points: 100, key: 'L1', at: 'x' });
    await setDoc(doc(db, 'reports/bob'), { by: ['alice'] });
  });
});

describe('scores', () => {
  it('signed-in players can read the leaderboard; signed-out visitors cannot', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDocs(query(collection(alice, 'scores'), orderBy('total', 'desc'), limit(50))));
    await assertSucceeds(getDocs(query(collection(alice, 'scores'), where('weekKey', '==', '2026-W44'), orderBy('week', 'desc'), limit(50))));
    await assertSucceeds(getDoc(doc(alice, 'scores/bob')));
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(anon, 'scores')));
  });

  it('nobody can write a score, not even their own', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, 'scores/alice'), { total: 999999 }));
    await assertFails(setDoc(doc(alice, 'scores/carol'), { total: 5 }));
    await assertFails(deleteDoc(doc(alice, 'scores/bob')));
  });
});

describe('players and awards', () => {
  it('only the owner can read their player document and awards', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(alice, 'players/alice')));
    await assertSucceeds(getDocs(collection(alice, 'players/alice/awards')));
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'players/alice')));
    await assertFails(getDocs(collection(bob, 'players/alice/awards')));
    await assertFails(getDocs(collection(bob, 'players')));
  });

  it('nobody can write player data or awards directly', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'players/alice'), { nickname: 'Changed' }, { merge: true }));
    await assertFails(setDoc(doc(alice, 'players/alice/awards/L2'), { points: 100 }));
  });

  it('reports are server-only', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(alice, 'reports/bob')));
    await assertFails(setDoc(doc(alice, 'reports/bob'), { by: ['x', 'y', 'z'] }));
  });
});
