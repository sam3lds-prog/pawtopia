import { describe, expect, it } from 'vitest';
import { CAT, DOG, EMPTY, type Species } from '../../src/engine/types';
import { rulesFor, type ModeRef } from '../../src/game/modes';
import { currentSpec, puzzleFor } from '../../src/game/puzzles';
import { Session, type SessionEvent } from '../../src/game/session';
import { profileOf } from '../../src/game/grading';
import { POINTS } from '../../src/meta/points';
import { checkSolve, possibleAwards, type BoardRef } from '../../src/leaderboard/check';
import { cleanNickname, neutralName, suggestNickname } from '../../src/leaderboard/nickname';
import { LIMITS, LbError, MemoryStore, deleteAccount, reportName, setProfile, submitSolves } from '../../src/leaderboard/server';

const NOW = new Date(Date.UTC(2026, 9, 29, 15, 0, 0));

/**
 * Plays a board the way a person does, at `msPerMove` per action: optionally one wrong pet first, a hint that places a
 * pet, an extra life, then every remaining pet. Returns the session's own event log.
 */
function play(mode: BoardRef, o: { wrong?: number; hint?: boolean; life?: boolean; msPerMove?: number; stopEarly?: boolean } = {}): { events: SessionEvent[]; session: Session } {
  const m = mode as ModeRef;
  const p = puzzleFor(m, currentSpec(m));
  let t = 0;
  const rules = rulesFor(m);
  const s = new Session(p, { hearts: rules.hearts, maxHearts: rules.maxHearts, now: () => t });
  const step = () => (t += o.msPerMove ?? 1500);
  const empties: Array<[number, number]> = [];
  for (let r = 0; r < p.size; r++) for (let c = 0; c < p.size; c++) if (s.cells[r][c] === EMPTY && p.solution[r][c] !== EMPTY) empties.push([r, c]);
  for (let i = 0; i < (o.wrong ?? 0); i++) {
    const [r, c] = empties[i];
    step();
    s.place(r, c, (p.solution[r][c] === CAT ? DOG : CAT) as Species);
  }
  if (o.life) {
    step();
    s.addHeart();
  }
  if (o.hint) {
    step();
    s.hint();
  }
  let n = 0;
  for (const [r, c] of empties) {
    if (s.cells[r][c] === p.solution[r][c]) continue;
    if (o.stopEarly && ++n > 2) break;
    step();
    s.place(r, c, p.solution[r][c] as Species);
  }
  return { events: s.events.map((e) => ({ ...e })), session: s };
}

const L5: BoardRef = { kind: 'level', level: 5 };
const spec = (b: BoardRef) => currentSpec(b as ModeRef);

describe('checking a solve', () => {
  it('a clean, hint-free Journey level earns the same Paw Points the app gives', () => {
    const { events, session } = play(L5);
    expect(session.outcome).toBe('won');
    const r = checkSolve({ mode: L5, spec: spec(L5), events }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const tier = profileOf(puzzleFor(L5 as ModeRef)).tier;
    expect(r.awards).toEqual([
      { id: 'L5', points: POINTS.journeyBase + POINTS.difficulty[tier] },
      { id: 'clean:L5', points: POINTS.clean },
      { id: 'nohint:L5', points: POINTS.hintFree },
    ]);
  });

  it('replays mistakes, hints and extra lives exactly as the game counted them', () => {
    const { events, session } = play({ kind: 'level', level: 12 }, { wrong: 2, life: true, hint: true });
    expect(session.outcome).toBe('won');
    const r = checkSolve({ mode: { kind: 'level', level: 12 }, spec: spec({ kind: 'level', level: 12 }), events }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mistakes).toBe(session.mistakes);
    expect(r.hintsUsed).toBe(session.hintsUsed);
    expect(r.awards.map((a) => a.id)).toEqual(['L12']);
  });

  it('a Daily pays once, with its bonuses folded in, within a week of its date', () => {
    const daily: BoardRef = { kind: 'daily', dateKey: '2026-10-29' };
    const { events } = play(daily);
    const r = checkSolve({ mode: daily, spec: spec(daily), events }, NOW);
    expect(r.ok && r.awards.length === 1 && r.awards[0].id === 'D2026-10-29').toBe(true);
    const old: BoardRef = { kind: 'daily', dateKey: '2026-10-01' };
    expect(checkSolve({ mode: old, spec: spec(old), events: play(old).events }, NOW)).toMatchObject({ ok: false, reason: 'out-of-window' });
  });

  it('rejects unfinished boards, forged logs, impossible speed and made-up boards', () => {
    const half = play(L5, { stopEarly: true });
    expect(checkSolve({ mode: L5, spec: spec(L5), events: half.events }, NOW)).toMatchObject({ ok: false, reason: 'not-solved' });
    const fast = play(L5, { msPerMove: 40 });
    expect(checkSolve({ mode: L5, spec: spec(L5), events: fast.events }, NOW)).toMatchObject({ ok: false, reason: 'too-fast' });
    const { events } = play(L5);
    const forged = events.map((e) => (e.type === 'place' ? { ...e, r: 99 } : e));
    expect(checkSolve({ mode: L5, spec: spec(L5), events: forged }, NOW)).toMatchObject({ ok: false, reason: 'invalid-log' });
    // A log for one level doesn't solve another.
    expect(checkSolve({ mode: { kind: 'level', level: 6 }, spec: spec(L5), events }, NOW)).toMatchObject({ ok: false });
    expect(checkSolve({ mode: { kind: 'level', level: 0 }, spec: 1, events }, NOW)).toMatchObject({ ok: false, reason: 'bad-board' });
  });

  it('knows which awards a solve could still add', () => {
    expect(possibleAwards(L5, 0, 0)).toEqual(['L5', 'clean:L5', 'nohint:L5']);
    expect(possibleAwards(L5, 1, 2)).toEqual(['L5']);
    expect(possibleAwards({ kind: 'daily', dateKey: '2026-10-29' }, 0, 0)).toEqual(['D2026-10-29']);
  });
});

describe('nicknames', () => {
  it('accepts short plain names and refuses the rest', () => {
    expect(cleanNickname('  Cozy   Otter 7 ')).toEqual({ ok: true, name: 'Cozy Otter 7' });
    expect(cleanNickname('Zoë_the-cat')).toMatchObject({ ok: true });
    expect(cleanNickname('ab')).toMatchObject({ ok: false, problem: 'length' });
    expect(cleanNickname('x'.repeat(21))).toMatchObject({ ok: false, problem: 'length' });
    expect(cleanNickname('me@mail.com')).toMatchObject({ ok: false, problem: 'characters' });
    expect(cleanNickname('www.site.com')).toMatchObject({ ok: false });
    expect(cleanNickname('12345')).toMatchObject({ ok: false, problem: 'characters' });
    expect(cleanNickname('Pawtopia Team')).toMatchObject({ ok: false, problem: 'words' });
    expect(cleanNickname('Sh1t Head')).toMatchObject({ ok: false, problem: 'words' });
    expect(cleanNickname(42)).toMatchObject({ ok: false });
  });

  it('suggestions always pass, and hidden names are neutral and stable', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 300; i++) expect(cleanNickname(suggestNickname(rand)).ok).toBe(true);
    expect(neutralName('abc')).toBe(neutralName('abc'));
    expect(neutralName('abc')).toMatch(/^Player \d{4}$/);
  });
});

describe('leaderboard server', () => {
  async function joined(uid = 'u1', nickname = 'Cozy Otter 1') {
    const store = new MemoryStore();
    await setProfile(store, uid, { nickname, avatar: 'mochi' }, NOW);
    return store;
  }

  it('needs a profile first, validates it, and starts at zero', async () => {
    const store = new MemoryStore();
    await expect(submitSolves(store, 'u1', [{ mode: L5, spec: spec(L5), events: play(L5).events }], NOW)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(setProfile(store, 'u1', { nickname: 'no', avatar: 'mochi' }, NOW)).rejects.toBeInstanceOf(LbError);
    await expect(setProfile(store, 'u1', { nickname: 'Fine Name', avatar: 'dragon' }, NOW)).rejects.toMatchObject({ code: 'invalid-argument' });
    const p = await setProfile(store, 'u1', { nickname: 'Fine Name', avatar: 'gumnut' }, NOW);
    expect(p).toMatchObject({ nickname: 'Fine Name', avatar: 'gumnut', total: 0, week: 0 });
    expect(store.scores()).toHaveLength(1);
  });

  it('pays each award once, keeps weekly and all-time totals, and never trusts sent points', async () => {
    const store = await joined();
    const sub = { mode: L5, spec: spec(L5), events: play(L5).events, points: 999999 };
    const first = await submitSolves(store, 'u1', [sub], NOW);
    const expected = first.results[0].points;
    expect(first.results[0].status).toBe('ok');
    expect(expected).toBeGreaterThan(100);
    expect(expected).toBeLessThan(300);
    const again = await submitSolves(store, 'u1', [sub, sub], NOW);
    expect(again.results.map((r) => r.status)).toEqual(['already', 'already']);
    expect(again.total).toBe(expected);
    // A clean replay of a level first solved with mistakes adds only the clean bonus.
    const messy = { mode: { kind: 'level', level: 12 }, spec: spec({ kind: 'level', level: 12 }), events: play({ kind: 'level', level: 12 }, { wrong: 1 }).events };
    const m1 = await submitSolves(store, 'u1', [messy], NOW);
    expect(m1.results[0].awarded).toEqual(['L12', 'nohint:L12']);
    const clean = { ...messy, events: play({ kind: 'level', level: 12 }).events };
    const m2 = await submitSolves(store, 'u1', [clean], NOW);
    expect(m2.results[0]).toMatchObject({ status: 'ok', points: POINTS.clean, awarded: ['clean:L12'] });
    // Next week: the weekly total starts again, the all-time total keeps going.
    const nextWeek = new Date(NOW.getTime() + 7 * 86_400_000);
    const d = { kind: 'daily' as const, dateKey: nextWeek.toISOString().slice(0, 10) };
    const w = await submitSolves(store, 'u1', [{ mode: d, spec: spec(d), events: play(d).events }], nextWeek);
    expect(w.week).toBe(w.results[0].points);
    expect(w.total).toBe(m2.total + w.results[0].points);
  });

  it('reports bad entries and rejected solves without stopping the rest', async () => {
    const store = await joined();
    const r = await submitSolves(store, 'u1', ['junk', { mode: L5, spec: spec(L5), events: play(L5, { msPerMove: 10 }).events }, { mode: L5, spec: spec(L5), events: play(L5).events }], NOW);
    expect(r.results.map((x) => x.status)).toEqual(['bad-request', 'too-fast', 'ok']);
    await expect(submitSolves(store, 'u1', new Array(LIMITS.perCall + 1).fill('x'), NOW)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('limits how many solves count per hour', async () => {
    const store = await joined();
    const doc = store.docs.get('players/u1')!;
    store.docs.set('players/u1', { ...doc, rate: { hour: NOW.toISOString().slice(0, 13), nHour: LIMITS.perHour, day: NOW.toISOString().slice(0, 10), nDay: LIMITS.perHour } });
    const r = await submitSolves(store, 'u1', [{ mode: L5, spec: spec(L5), events: play(L5).events }], NOW);
    expect(r.results[0].status).toBe('rate-limited');
    const later = new Date(NOW.getTime() + 3_600_000);
    const r2 = await submitSolves(store, 'u1', [{ mode: L5, spec: spec(L5), events: play(L5).events }], later);
    expect(r2.results[0].status).toBe('ok');
  });

  it('three different reports replace a name with a neutral one', async () => {
    const store = await joined('target', 'Rude Name');
    for (const u of ['a', 'b', 'c']) await setProfile(store, u, { nickname: `Reporter ${u}x`, avatar: 'pip' }, NOW);
    expect(await reportName(store, 'a', 'target', NOW)).toEqual({ hidden: false });
    expect(await reportName(store, 'a', 'target', NOW)).toEqual({ hidden: false }); // same reporter twice counts once
    expect(await reportName(store, 'b', 'target', NOW)).toEqual({ hidden: false });
    expect(await reportName(store, 'c', 'target', NOW)).toEqual({ hidden: true });
    expect(store.docs.get('scores/target')!.nickname).toBe(neutralName('target'));
    await expect(reportName(store, 'a', 'a', NOW)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(reportName(store, 'a', 'nobody', NOW)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('leaving deletes every document of the account', async () => {
    const store = await joined();
    await submitSolves(store, 'u1', [{ mode: L5, spec: spec(L5), events: play(L5).events }], NOW);
    await setProfile(store, 'u2', { nickname: 'Other One', avatar: 'pip' }, NOW);
    await deleteAccount(store, 'u1');
    expect([...store.docs.keys()].filter((k) => k.includes('u1'))).toEqual([]);
    expect(store.docs.has('scores/u2')).toBe(true);
  });

  it('the in-memory store enforces reads before writes, like Firestore', async () => {
    const store = new MemoryStore();
    await expect(
      store.tx(async (tx) => {
        tx.set('a/b', { x: 1 });
        await tx.get('a/b');
      }),
    ).rejects.toThrow(/reads must come before writes/);
  });
});

describe('on the device', () => {
  it('queues only solves that could still earn something, and caps the queue', async () => {
    const { enqueueSolve } = await import('../../src/leaderboard/queue');
    const { defaultLeaderboard, LB_PENDING_MAX, normalizeSave, defaultSave } = await import('../../src/services/storage');
    const lb = defaultLeaderboard();
    const lvl = { kind: 'level' as const, level: 5 };
    expect(enqueueSolve(lb, lvl, 1, [], 0, 0)).toBe(false); // not joined
    lb.joined = true;
    expect(enqueueSolve(lb, { kind: 'zen', size: 6, seed: 1 }, 1, [], 0, 0)).toBe(false);
    expect(enqueueSolve(lb, lvl, 1, [], 0, 0)).toBe(true);
    lb.awarded = { L5: true, 'clean:L5': true, 'nohint:L5': true };
    expect(enqueueSolve(lb, lvl, 1, [], 0, 0)).toBe(false); // nothing left to earn
    lb.awarded = { L5: true };
    expect(enqueueSolve(lb, lvl, 1, [], 1, 1)).toBe(false); // a messy replay can't add the bonuses
    expect(enqueueSolve(lb, lvl, 1, [], 0, 1)).toBe(true); // a clean one can
    for (let i = 0; i < LB_PENDING_MAX + 5; i++) enqueueSolve(lb, { kind: 'level', level: 100 + i }, 2, [], 0, 0);
    expect(lb.pending).toHaveLength(LB_PENDING_MAX);
    expect(lb.pending[lb.pending.length - 1].key).toBe(`L${100 + LB_PENDING_MAX + 4}`);
    // Survives a save round trip; junk is dropped.
    const s = defaultSave();
    s.leaderboard = lb;
    const back = normalizeSave({ ...JSON.parse(JSON.stringify(s)), leaderboard: { ...JSON.parse(JSON.stringify(lb)), pending: [...lb.pending, { key: 'x', mode: { kind: 'zen' }, spec: 1, events: [] }] } });
    expect(back.leaderboard.pending).toHaveLength(LB_PENDING_MAX);
    expect(back.leaderboard.joined).toBe(true);
  });

  it('ranks ties together', async () => {
    const { rankEntries } = await import('../../src/services/leaderboard');
    expect(rankEntries([{ points: 5 }, { points: 9 }, { points: 5 }, { points: 1 }]).map((r) => [r.points, r.rank])).toEqual([
      [9, 1],
      [5, 2],
      [5, 2],
      [1, 4],
    ]);
  });
});
