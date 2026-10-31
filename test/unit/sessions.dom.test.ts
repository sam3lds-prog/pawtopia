// @vitest-environment happy-dom
/**
 * Saved boards survive other play (D38, PR A). One board per mode: a Journey board is still there, exactly as it was,
 * after a Daily or a Zen board was started and saved in between — and the other way round — including after a reload.
 * Within a mode, the only place a saved board can be replaced is `playMode`, which asks first, whichever screen the
 * tap came from (the Journey hub, the level path, the World, a sanctuary).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { journeyScreen } from '../../src/ui/screens/journey';
import { worldScreen } from '../../src/ui/screens/world';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { gameScreen } from '../../src/ui/screens/game';
import { mountNav } from '../../src/ui/components/nav';
import { heldBoardFor, nextZenMode, playMode, savedFor, startGame } from '../../src/app/gameFlow';
import { localDateKey, prevDateKey } from '../../src/game/dates';
import { dailyFor, modeKey, type ModeRef } from '../../src/game/modes';
import { CAT, DOG, EMPTY, type Species } from '../../src/engine/types';
import { V2_KEY, defaultSave, normalizeSave, type SavedSession } from '../../src/services/storage';
import { resumeSession } from '../../src/game/sessionPersistence';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
let router: Router;

function mountAll(): void {
  document.body.innerHTML = '<div id="app"></div>';
  router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['pets', 'shop', 'gallery', 'profile', 'challenges', 'welcome'] as const) reg[k] = blank;
  router.register({ ...reg, journey: journeyScreen, world: worldScreen, region: regionScreen, sanctuary: sanctuaryScreen, game: gameScreen });
  app.router = router;
  mountNav(router);
}

const text = (sel: string) => document.querySelector(sel)?.textContent ?? '';
/** The board on screen, read through a call so a test's own `app.active = null` doesn't narrow the type for good. */
const current = () => app.active;
const el = (sel: string) => document.querySelector<HTMLElement>(sel);

/** Plays a few real moves on the board on screen: one right placement, one wrong (a heart and a mistake mark), a hint. */
function playSome(wrong = true): void {
  const s = app.active!.session;
  const p = s.puzzle;
  let placed = false;
  let missed = !wrong;
  for (let r = 0; r < p.size && !(placed && missed); r++)
    for (let c = 0; c < p.size && !(placed && missed); c++) {
      if (s.givenMask[r][c] || s.cells[r][c] !== EMPTY) continue;
      const sol = p.solution[r][c];
      if (!placed && sol !== EMPTY) {
        s.place(r, c, sol as Species);
        placed = true;
      } else if (!missed && sol === EMPTY) {
        s.place(r, c, CAT);
        missed = true;
      }
    }
  const h = s.peekHint();
  if (h) {
    s.noteHint(h);
    s.commitHint(h, 1, false);
  }
  app.saveActive();
}

/** What a resumed board must bring back, from a saved one. */
function fingerprint(sv: SavedSession | null) {
  if (!sv) return null;
  const r = resumeSession(sv)!;
  return {
    mode: sv.mode,
    boardId: sv.boardId,
    cast: sv.cast,
    cells: r.session.cells,
    mistakes: r.session.mistakes,
    hintsUsed: r.session.hintsUsed,
    hearts: r.session.hearts,
    errors: sv.snap.errors,
    elapsedMs: sv.snap.elapsedMs,
  };
}

/** Back to the Journey hub, the way the Leave button does it (the screen's disposal saves the board). */
function leave(): void {
  el('[data-act="leave"]')!.click();
}

/** The app as it comes back after being closed: the save is read again from storage. */
function reload(): void {
  const raw = localStorage.getItem(V2_KEY)!;
  app.active = null;
  app.replaceSave(normalizeSave(JSON.parse(raw), new Date(2026, 9, 31, 12)));
  mountAll();
}

const today = localDateKey();
const dailyToday = (): ModeRef => dailyFor(today, app.save.journey.nextLevel);

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, pairRulesSeen: true, starterDecorChosen: true, seenPantryIntro: true, worldTipSeen: true });
  app.save.journey.nextLevel = 8;
  app.save.world.growth.farm = 2;
  app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
  app.active = null;
  window.scrollTo = () => {};
  mountAll();
  router.reset({ screen: 'journey' });
});
afterEach(() => {
  app.active = null;
});

describe('a saved board survives other modes (the P0)', () => {
  it('a half-played Journey board is still exactly there after a Daily is started, saved and finished', () => {
    startGame({ kind: 'level', level: 8 });
    playSome();
    leave();
    const before = fingerprint(savedFor({ kind: 'level', level: 8 }));
    expect(before?.mistakes).toBe(1);
    expect(before?.hintsUsed).toBe(1);
    expect(before?.hearts).toBe(4);

    // The Daily: started, played, saved — then finished, which clears its own slot and nothing else.
    const daily = dailyToday();
    playMode(daily);
    expect(app.active?.mode).toEqual(daily);
    playSome(false);
    expect(savedFor(daily)).not.toBeNull();
    expect(fingerprint(savedFor({ kind: 'level', level: 8 }))).toEqual(before);
    app.clearSaved(daily);
    app.active = null;
    app.persist();
    expect(savedFor(daily)).toBeNull();
    expect(fingerprint(savedFor({ kind: 'level', level: 8 }))).toEqual(before);

    // Back on the hub, Continue resumes that very board.
    router.reset({ screen: 'journey' });
    expect(text('.continue__go')).toBe('Resume level 8');
    el('.continue__go')!.click();
    expect(router.route?.screen).toBe('game');
    const active = current(); // TS narrowed `app.active` to null above; the click reassigned it
    expect(active?.mode).toEqual({ kind: 'level', level: 8 });
    expect(active?.boardId).toBe(before?.boardId);
    expect(active?.session.cells).toEqual(before?.cells);
    expect(active?.session.mistakes).toBe(1);
    expect(active?.session.hintsUsed).toBe(1);
    expect(active?.session.hearts).toBe(4);
  });

  it('the other way round: a half-played Daily survives a Journey level and a Zen board', () => {
    const daily = dailyToday();
    playMode(daily);
    playSome();
    leave();
    const before = fingerprint(savedFor(daily));
    expect(before).not.toBeNull();

    playMode({ kind: 'level', level: 8 });
    playSome();
    leave();
    playMode(nextZenMode(5));
    playSome(false);
    leave();

    expect(fingerprint(savedFor(daily))).toEqual(before);
    expect(savedFor({ kind: 'level', level: 8 })).not.toBeNull();
    expect(app.save.sessions.zen).not.toBeNull();
    // The hub offers every one of them: the Journey board as Continue, the other two on their own lines.
    router.reset({ screen: 'journey' });
    expect(text('.continue__go')).toBe('Resume level 8');
    const others = [...document.querySelectorAll('.resume-other')].map((e) => e.textContent ?? '');
    expect(others).toHaveLength(2);
    expect(others[0]).toMatch(/Daily/);
    expect(others[1]).toMatch(/Zen/);
    // And each line resumes its own board.
    (document.querySelectorAll<HTMLElement>('.resume-other')[0]).click();
    expect(app.active?.mode).toEqual(daily);
    expect(app.active?.boardId).toBe(before?.boardId);
  });

  it('all three come back after the app is closed and opened again', () => {
    startGame({ kind: 'level', level: 8 });
    playSome();
    leave();
    playMode(dailyToday());
    playSome();
    leave();
    playMode(nextZenMode(6));
    playSome(false);
    leave();
    const prints = (['level', 'daily', 'zen'] as const).map((k) => fingerprint(app.save.sessions[k]));
    prints.forEach((p) => expect(p).not.toBeNull());

    reload();
    expect((['level', 'daily', 'zen'] as const).map((k) => fingerprint(app.save.sessions[k]))).toEqual(prints);
    router.reset({ screen: 'journey' });
    expect(text('.continue__go')).toBe('Resume level 8');
    expect(document.querySelectorAll('.resume-other')).toHaveLength(2);
  });

  it('a Zen board in progress is kept while Journey and Daily are played; a new Zen asks first', () => {
    const zen = nextZenMode(5);
    playMode(zen);
    playSome(false);
    leave();
    const before = fingerprint(savedFor(zen));
    expect(app.save.zen.nextSeed).toBe(2);

    playMode({ kind: 'level', level: 8 });
    playSome(false);
    leave();
    expect(fingerprint(savedFor(zen))).toEqual(before);

    // Tapping a size on the hub does not replace the saved Zen board without asking.
    router.reset({ screen: 'journey' });
    el('[data-zen="7"]')!.click();
    expect(router.route?.screen).toBe('journey');
    expect(text('.sheet')).toMatch(/Start a new 7×7 Zen board\?/);
    expect(text('.sheet')).toMatch(/5×5 Zen board \(1 move so far\) will be cleared/);
    expect(fingerprint(savedFor(zen))).toEqual(before);
    expect(app.save.zen.nextSeed).toBe(2);
    // Resume keeps it; the seed is not spent.
    el('.sheet [data-act="resume"]')!.click();
    expect(app.active?.mode).toEqual(zen);
    expect(app.save.zen.nextSeed).toBe(2);
  });
});

describe('every entry point asks before replacing a saved board of the same mode', () => {
  function saveLevel3(): SavedSession {
    startGame({ kind: 'level', level: 3 });
    playSome();
    leave();
    return savedFor({ kind: 'level', level: 3 })!;
  }

  it('the World\'s Play button', () => {
    const saved = saveLevel3();
    router.reset({ screen: 'world' });
    el('.world-focus [data-act="play"]')!.click();
    expect(router.route?.screen).toBe('world');
    expect(text('.sheet')).toMatch(/Start level 8\?/);
    expect(text('.sheet')).toMatch(/level 3 board/);
    expect(heldBoardFor({ kind: 'level', level: 8 })).toEqual(saved);
    // Choosing to start is the player's call; then the slot holds level 8 and level 3 is gone.
    el('.sheet [data-act="go"]')!.click();
    expect(router.route?.screen).toBe('game');
    expect(app.active?.mode).toEqual({ kind: 'level', level: 8 });
    expect(savedFor({ kind: 'level', level: 3 })).toBeNull();
    app.saveActive();
    expect(app.save.sessions.level?.mode).toEqual({ kind: 'level', level: 8 });
  });

  it('a sanctuary\'s Play button, and Resume brings the saved board back untouched', () => {
    const saved = saveLevel3();
    router.reset({ screen: 'region', id: 'farm' });
    const play = el('.region [data-act="play"]');
    expect(play).not.toBeNull();
    play!.click();
    expect(text('.sheet')).toMatch(/Start level 8\?/);
    el('.sheet [data-act="resume"]')!.click();
    expect(app.active?.mode).toEqual({ kind: 'level', level: 3 });
    expect(app.active?.boardId).toBe(saved.boardId);
    expect(app.active?.session.mistakes).toBe(1);
  });

  it('the level path: a replay of another level asks; the saved level itself just resumes', () => {
    const saved = saveLevel3();
    router.reset({ screen: 'journey', view: 'path' });
    el('.node [data-level="2"]')!.click();
    expect(router.route).toEqual({ screen: 'journey', view: 'path' });
    expect(text('.sheet')).toMatch(/Start level 2\?/);
    el('.sheet [data-act="keep"]')!.click();
    expect(document.querySelector('.sheet')).toBeNull();
    expect(savedFor({ kind: 'level', level: 3 })).toEqual(saved);
    el('.node [data-level="3"]')!.click();
    expect(app.active?.mode).toEqual({ kind: 'level', level: 3 });
    expect(app.active?.boardId).toBe(saved.boardId);
  });

  it('yesterday\'s unfinished Daily is not thrown away by today\'s', () => {
    const yesterday: ModeRef = dailyFor(prevDateKey(today), app.save.journey.nextLevel);
    playMode(yesterday);
    playSome();
    leave();
    const before = fingerprint(savedFor(yesterday));
    router.reset({ screen: 'journey' });
    el('.daily-card')!.click();
    expect(text('.sheet')).toMatch(/Start today's Daily\?/);
    expect(fingerprint(savedFor(yesterday))).toEqual(before);
    el('.sheet [data-act="resume"]')!.click();
    expect(app.active?.mode).toEqual(yesterday);
  });

  it('a board without real progress is simply replaced (nothing to ask about)', () => {
    startGame({ kind: 'level', level: 3 });
    app.saveActive(); // no move, no mistake, no hint, no time
    leave();
    expect(app.save.sessions.level?.mode).toEqual({ kind: 'level', level: 3 });
    expect(heldBoardFor({ kind: 'level', level: 8 })).toBeNull();
    playMode({ kind: 'level', level: 8 });
    expect(document.querySelector('.sheet')).toBeNull();
    expect(app.active?.mode).toEqual({ kind: 'level', level: 8 });
  });

  it('Paw Cup attempts keep their own slots and never collide with the others', () => {
    startGame({ kind: 'level', level: 8 });
    playSome();
    leave();
    const cup: ModeRef = { kind: 'cup', weekKey: '2026-W44', index: 0 };
    expect(heldBoardFor(cup)).toBeNull();
    expect(startGame(cup)).toBe(true);
    app.saveActive();
    expect(app.save.cup.open[modeKey(cup)]).toBeDefined();
    expect(app.save.sessions.level?.mode).toEqual({ kind: 'level', level: 8 });
    expect([CAT, DOG]).toContain(CAT); // keeps the species import honest for the helpers above
  });
});
