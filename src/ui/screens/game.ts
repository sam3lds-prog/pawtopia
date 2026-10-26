/** The play screen: top bar, the board (hero), one coach line, tools and actions. */

import { app } from '../../app/app';
import { restartGame, startGame } from '../../app/gameFlow';
import { CAT, DOG, type Species } from '../../engine/types';
import { fmtClock } from '../../game/dates';
import { nextAfterWin, rulesFor, type ModeRef } from '../../game/modes';
import { modeShortTitle, modeTitle } from '../../game/puzzles';
import { MARK, type HintInfo, type MoveResult, type Session, type Tool, type UnitRef } from '../../game/session';
import { recordLoss, recordWin, type WinRecord } from '../../meta/progression';
import { ads, shouldShowInterstitial } from '../../services/ads';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { tilePet, toolPetSvg } from '../art/petTiles';
import { Board } from '../components/board';
import { openSheet, type SheetHandle } from '../components/sheet';
import { actionOf, capitalize, esc, h, plural, qs } from '../dom';
import { ICON } from '../icons';
import type { Scope, ScreenDef } from '../router';
import { showRules } from './rules';
import { showSettings } from './settings';

const SPECIES_WORD: Record<number, string> = { [CAT]: 'cat', [DOG]: 'dog' };
const MISS_MS = 700;

/** In-memory ad cadence (resets each launch, which only makes ads rarer). */
const cadence = { boardsSinceLast: 0, lastShownAt: null as number | null, shownToday: 0, day: '' };

export const gameScreen: ScreenDef = {
  tab: null,
  title: 'Play',
  mount(root, scope) {
    const active = app.active;
    if (!active) {
      app.router.go({ screen: 'home' });
      return;
    }
    mountGame(root, scope, active.mode, active.session);
  },
};

function mountGame(root: HTMLElement, scope: Scope, mode: ModeRef, s: Session): void {
  const rules = rulesFor(mode);
  const n = s.size;
  const total = 2 * n;
  const settings = app.settings;
  const classic = settings.controls === 'classic';
  let tool: Tool = 'cat';
  let hint: { info: HintInfo; tier: 1 | 2 } | null = null;
  let finished = false;
  let sheet: SheetHandle | null = null;

  const el = h(`
    <div class="game" data-mode="${mode.kind}">
      <header class="game-top">
        <button class="icon-btn" data-act="leave" aria-label="Leave board">${ICON.back}</button>
        <div class="game-title">
          <h1 data-autofocus aria-label="${esc(modeTitle(mode))}">${esc(modeShortTitle(mode))}</h1>
          <div class="game-sub"><span class="chip">${n}×${n}</span><span class="chip">${capitalize(s.puzzle.difficulty)}</span></div>
        </div>
        <div class="game-top__end">
          ${rules.hearts ? '<div class="hearts" data-hearts role="img"></div>' : `<span class="zen-mark" aria-label="No hearts in Zen">${ICON.leaf}</span>`}
          <button class="icon-btn" data-act="pause" aria-label="Pause">${ICON.pause}</button>
        </div>
      </header>
      <div class="board-zone" data-zone>
        <div class="board-stage" data-stage></div>
        <div class="board-foot" data-foot>
          <p class="coach" data-coach aria-live="polite"></p>
          <div class="game-status">
            <span data-progress class="num"></span>
            ${rules.timer && settings.showTimer ? `<span class="game-timer num" data-timer aria-label="Time">${ICON.clock}<span>0:00</span></span>` : ''}
          </div>
        </div>
      </div>
      <div class="tools" role="radiogroup" aria-label="${classic ? 'Pet to place' : 'Tool'}">
        <button class="tool" role="radio" data-tool="cat"><span class="tool__art">${toolPetSvg(CAT)}</span><span class="tool__label">Cat</span></button>
        <button class="tool" role="radio" data-tool="dog"><span class="tool__art">${toolPetSvg(DOG)}</span><span class="tool__label">Dog</span></button>
        ${classic ? '' : `<button class="tool" role="radio" data-tool="mark"><span class="tool__art tool__art--icon">${ICON.mark}</span><span class="tool__label">Empty</span></button>`}
        ${classic ? '' : `<button class="tool" role="radio" data-tool="erase"><span class="tool__art tool__art--icon">${ICON.erase}</span><span class="tool__label">Erase</span></button>`}
      </div>
      <div class="actions">
        <button class="act" data-act="undo">${ICON.undo}<span>Undo</span></button>
        <button class="act" data-act="redo">${ICON.redo}<span>Redo</span></button>
        <button class="act" data-act="hint" ${rules.hints ? '' : 'disabled aria-describedby="no-hints"'}>${ICON.hint}<span data-hint-label>Hint</span></button>
        <button class="act" data-act="rules">${ICON.help}<span>Rules</span></button>
      </div>
      ${rules.hints ? '' : '<p id="no-hints" class="sr-only">Hints are off in Paw Cup so every player has the same rules.</p>'}
    </div>`);
  root.appendChild(el);

  const stage = qs(el, '[data-stage]');
  const coachEl = qs(el, '[data-coach]');
  const progressEl = qs(el, '[data-progress]');
  const timerEl = el.querySelector('[data-timer] span') as HTMLElement | null;
  const heartsEl = el.querySelector('[data-hearts]') as HTMLElement | null;

  const board = new Board(s.puzzle, scope, { onPress, onDrag, onKey }, { pannable: settings.largeBoard, pet: (_r, _c, sp) => tilePet(sp) });
  stage.appendChild(board.el);

  const zone = qs(el, '[data-zone]');
  const foot = qs(el, '[data-foot]');
  // The zone takes the spare height; the board takes what's left after its coach line, so the two stay together.
  const refit = () => board.fitBox(stage, zone.clientWidth, zone.clientHeight - foot.offsetHeight - 10);
  scope.frame(refit);
  const ro = new ResizeObserver(() => refit());
  ro.observe(zone);
  scope.onDispose(() => ro.disconnect());

  // ---------------------------------------------------------------- rendering

  function paint(): void {
    board.render({ cells: s.cells, givenMask: s.givenMask, dead: settings.autoMark ? s.deadCells() : null });
    progressEl.textContent = `${s.placedCount()} of ${total} pets placed`;
    if (heartsEl) {
      heartsEl.innerHTML = Array.from({ length: s.maxHearts }, (_, i) => (i < s.hearts ? ICON.heart : ICON.heartOff)).join('');
      heartsEl.setAttribute('aria-label', `${plural(s.hearts, 'heart')} left`);
    }
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-tool]')) b.setAttribute('aria-checked', String(b.dataset.tool === tool));
    (qs(el, '[data-act="undo"]') as HTMLButtonElement).disabled = !s.canUndo() || finished;
    (qs(el, '[data-act="redo"]') as HTMLButtonElement).disabled = !s.canRedo() || finished;
    const hintLabel = el.querySelector('[data-hint-label]');
    if (hintLabel) hintLabel.textContent = !hint ? 'Hint' : hint.tier === 1 ? 'Closer' : 'Show me';
    tick();
  }

  function tick(): void {
    if (timerEl) timerEl.textContent = fmtClock(s.elapsedSeconds());
  }

  function coach(text: string): void {
    coachEl.textContent = text;
  }

  function defaultCoach(): string {
    if (mode.kind === 'cup') return 'Paw Cup rules: no hints, three hearts, your time counts.';
    if (mode.kind === 'zen') return 'No clock, no hearts. Take all the time you like.';
    if (classic) return 'Tap once to mark a tile empty, again to place your pet.';
    return 'One cat and one dog in every row, column and color.';
  }

  // ---------------------------------------------------------------- input

  function onPress(r: number, c: number): 'mark' | 'unmark' | null {
    if (finished || s.paused) return null;
    if (classic) {
      handle(s.tap(r, c, tool === 'dog' ? DOG : CAT), r, c);
      return null;
    }
    const before = s.cells[r][c];
    const res = s.apply(r, c, tool);
    handle(res, r, c);
    if (tool === 'mark' && !s.givenMask[r][c]) {
      if (res.marked) return 'mark';
      if (res.unmarked && before === MARK) return 'unmark';
    }
    return null;
  }

  function onDrag(r: number, c: number, m: 'mark' | 'unmark'): void {
    if (finished) return;
    const changed = m === 'mark' ? s.markIfEmpty(r, c) : s.unmarkIfMarked(r, c);
    if (changed) {
      haptic('select');
      afterChange();
    }
  }

  function onKey(r: number, c: number, key: string): boolean {
    const k = key.toLowerCase();
    if (k === 'c' || k === '1') return keyApply(r, c, 'cat');
    if (k === 'd' || k === '2') return keyApply(r, c, 'dog');
    if (k === 'x' || k === '3' || k === '.') return keyApply(r, c, 'mark');
    if (k === 'backspace' || k === 'delete' || k === '0') return keyApply(r, c, 'erase');
    if (k === 'z') {
      doUndo();
      return true;
    }
    if (k === 'y') {
      doRedo();
      return true;
    }
    if (k === 'h' && rules.hints) {
      doHint();
      return true;
    }
    return false;
  }

  function keyApply(r: number, c: number, t: Tool): boolean {
    if (finished || s.paused) return true;
    handle(s.apply(r, c, t), r, c);
    return true;
  }

  function handle(res: MoveResult, r: number, c: number): void {
    if (res.ignored) {
      const v = s.cells[r][c];
      if ((v === CAT || v === DOG) && !s.givenMask[r][c] && (tool === 'cat' || tool === 'dog'))
        coach(`That tile has a ${SPECIES_WORD[v]}. Pick Erase to clear it.`);
      else if (s.givenMask[r][c]) coach('This pet is already home. Its spot is locked.');
      return;
    }
    if (res.wrong && res.placed) {
      onMistake(r, c, res.placed);
    } else if (res.placed) {
      sfx('place');
      haptic('place');
      board.flash([[r, c]], 'is-fresh', 720);
      if (res.completed?.length) onUnits(res.completed);
      else coach(encouragement());
    } else if (res.marked) {
      sfx('mark');
      haptic('tap');
    }
    afterChange();
  }

  function onMistake(r: number, c: number, sp: Species): void {
    sfx('oops');
    haptic('error');
    board.flash([[r, c]], 'is-miss', MISS_MS);
    board.ghost(r, c, tilePet(sp), MISS_MS);
    const word = SPECIES_WORD[sp];
    if (!rules.hearts) coach(`Not a ${word} spot. No rush, try another line of thought.`);
    else if (s.hearts > 0) coach(`Not a ${word} spot. ${plural(s.hearts, 'heart')} left.`);
  }

  function onUnits(units: UnitRef[]): void {
    sfx('unit');
    const cells: Array<[number, number]> = [];
    for (const u of units) cells.push(...s.unitCells(u));
    board.flash(cells, 'is-glow', 950);
    const u = units[0];
    const name = u.kind === 'region' ? `The ${board.regionName(u.index)} region` : `${capitalize(u.kind)} ${u.index + 1}`;
    coach(units.length > 1 ? `${name} and ${units.length - 1} more are complete.` : `${name} is complete.`);
  }

  let encourageIdx = 0;
  function encouragement(): string {
    const lines = ['Nicely reasoned.', 'Settled in.', 'That one belongs.', 'Good spot.'];
    return lines[encourageIdx++ % lines.length];
  }

  function afterChange(): void {
    if (hint) {
      hint = null;
      board.clearHint();
    }
    paint();
    app.saveActive();
    checkOutcome();
  }

  // ---------------------------------------------------------------- actions

  function doUndo(): void {
    if (finished) return;
    if (s.undo()) {
      haptic('tap');
      afterChange();
    }
  }

  function doRedo(): void {
    if (finished) return;
    if (s.redo()) {
      haptic('tap');
      afterChange();
    }
  }

  function doHint(): void {
    if (finished || !rules.hints || s.paused) return;
    if (!hint) {
      const info = s.peekHint();
      if (!info) return;
      s.noteHint(info);
      track('hint_used', { mode: mode.kind, tier: 1 });
      hint = { info, tier: 1 };
      if (info.unit) {
        board.setHint(s.unitCells(info.unit), null);
        coach(`Look at ${unitPhrase(info.unit)}. One spot there is already decided.`);
      } else {
        board.setHint([], [info.r, info.c]);
        coach('Look at the highlighted tile.');
      }
    } else if (hint.tier === 1) {
      hint.tier = 2;
      track('hint_used', { mode: mode.kind, tier: 2 });
      board.setHint(hint.info.unit ? s.unitCells(hint.info.unit) : [], [hint.info.r, hint.info.c]);
      coach(friendlyReason(hint.info.reason));
    } else {
      track('hint_used', { mode: mode.kind, tier: 3 });
      const info = s.hint();
      hint = null;
      board.clearHint();
      if (info) {
        sfx('place');
        board.flash([[info.r, info.c]], 'is-fresh', 720);
        const units = s.completedUnitsAt(info.r, info.c);
        coach(friendlyReason(info.reason));
        if (units.length) onUnits(units);
      }
      paint();
      app.saveActive();
      checkOutcome();
      return;
    }
    paint();
  }

  function unitPhrase(u: UnitRef): string {
    if (u.kind === 'region') return `the ${board.regionName(u.index)} region`;
    return `${u.kind} ${u.index + 1}`;
  }

  /** Engine reasons say "region 3"; players see colors. */
  function friendlyReason(reason: string): string {
    return reason.replace(/region (\d+)/g, (_m, d) => `the ${board.regionName(Number(d) - 1)} region`).replace(/^Only one spot left/, 'Only one spot is left');
  }

  scope.on(el, 'click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-tool]') as HTMLElement | null;
    if (t) {
      tool = t.dataset.tool as Tool;
      haptic('select');
      paint();
      return;
    }
    const a = actionOf(e);
    if (!a) return;
    switch (a.act) {
      case 'leave':
        leave();
        break;
      case 'pause':
        openPause();
        break;
      case 'undo':
        doUndo();
        break;
      case 'redo':
        doRedo();
        break;
      case 'hint':
        doHint();
        break;
      case 'rules':
        s.pause();
        showRules(scope, () => resumeIfOnScreen());
        break;
    }
  });

  // Tool shortcuts when focus isn't on a cell.
  scope.on(document, 'keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (sheet || document.querySelector('.overlay')) return;
    if ((ke.target as HTMLElement)?.closest?.('.cell')) return;
    const k = ke.key.toLowerCase();
    const map: Record<string, Tool> = { c: 'cat', d: 'dog', x: 'mark', e: 'erase' };
    if (map[k] && !(classic && (k === 'x' || k === 'e'))) {
      tool = map[k];
      paint();
    } else if (k === 'z') doUndo();
    else if (k === 'y') doRedo();
    else if (k === 'h') doHint();
    else if (k === 'p' || k === 'escape') openPause();
  });

  function resumeIfOnScreen(): void {
    if (!scope.alive || finished || sheet) return;
    s.resume();
  }

  function leave(): void {
    app.saveActive();
    app.router.go({ screen: mode.kind === 'level' ? 'play' : mode.kind === 'cup' ? 'league' : 'home' });
  }

  function openPause(): void {
    if (finished || sheet) return;
    s.pause();
    el.classList.add('is-paused');
    const veil = h(`<div class="board-veil">${mode.kind === 'cup' ? 'Board hidden while paused' : ''}</div>`);
    if (mode.kind === 'cup') board.el.appendChild(veil);
    sheet = openSheet(scope, {
      title: 'Paused',
      body: `
        <p class="sheet__lead">${rules.timer ? `Clock stopped at ${fmtClock(s.elapsedSeconds())}.` : 'Your board is saved.'}</p>
        <div class="sheet__actions">
          <button class="btn btn--block" data-act="resume">${ICON.resume}Resume</button>
          <button class="btn btn--secondary btn--block" data-act="restart">${ICON.restart}Restart board</button>
          <button class="btn btn--quiet" data-act="settings">Settings</button>
          <button class="btn btn--quiet" data-act="leave">Leave and keep progress</button>
        </div>`,
      onClose: () => {
        sheet = null;
        veil.remove();
        el.classList.remove('is-paused');
        resumeIfOnScreen();
      },
    });
    const ps = sheet;
    ps.scope.on(ps.el, 'click', (e) => {
      const a = actionOf(e);
      if (!a) return;
      if (a.act === 'resume') ps.close();
      else if (a.act === 'restart') {
        ps.close();
        confirmRestart();
      } else if (a.act === 'settings') {
        ps.close();
        s.pause();
        showSettings(scope, { inGame: true, onClose: () => app.router.refresh() });
      } else if (a.act === 'leave') {
        ps.close();
        leave();
      }
    });
  }

  function confirmRestart(): void {
    s.pause();
    const cs = openSheet(scope, {
      title: 'Restart this board?',
      body: `<p class="sheet__lead">Your placements and marks on this board will be cleared.</p>
        <div class="sheet__actions">
          <button class="btn btn--block" data-act="yes">Restart board</button>
          <button class="btn btn--quiet" data-act="no">Keep playing</button>
        </div>`,
      onClose: () => resumeIfOnScreen(),
    });
    cs.scope.on(cs.el, 'click', (e) => {
      const a = actionOf(e);
      if (!a) return;
      if (a.act === 'yes') {
        cs.close();
        restartGame();
      } else cs.close();
    });
  }

  // ---------------------------------------------------------------- outcome

  function checkOutcome(): void {
    const o = s.claimOutcome();
    if (o === 'won') onWin();
    else if (o === 'lost') onLose();
  }

  function onWin(): void {
    finished = true;
    s.pause();
    paint();
    const result = { size: n, seconds: s.elapsedSeconds(), mistakes: s.mistakes, hintsUsed: s.hintsUsed, revives: s.revives, hearts: rules.hearts };
    const rec = recordWin(app.save, mode, result);
    app.save.lastSession = null;
    app.active = null;
    app.persist();
    cadence.boardsSinceLast++;
    track('puzzle_complete', { mode: mode.kind, size: n, seconds: result.seconds, mistakes: result.mistakes, hints: result.hintsUsed });
    if (mode.kind === 'daily' && rec.newDaily) track('daily_complete', { streak: rec.streak ?? 0 });
    sfx('win');
    haptic('success');
    coach('Harmony restored.');
    scope.timeout(() => showWin(rec, result.seconds), app.reducedMotion ? 150 : 900);
  }

  function showWin(rec: WinRecord, seconds: number): void {
    const next = nextAfterWin(mode);
    const primaryLabel = typeof next === 'object' && next.kind === 'level' ? `Play level ${next.level}` : next === 'cup' ? 'Back to Paw Cup' : 'Back home';
    const badges: string[] = [];
    if (rec.clean) badges.push(`<span class="chip chip--brand">${ICON.check}Clean solve</span>`);
    if (rec.isBest && rec.prevBest !== null) badges.push(`<span class="chip chip--gold">${ICON.sparkle}New best</span>`);
    if (mode.kind === 'daily' && rec.streak) badges.push(`<span class="chip chip--coral">${ICON.flame}${plural(rec.streak, 'day')} streak</span>`);
    if (rec.usedCozyDay) badges.push(`<span class="chip">Cozy Day kept your streak</span>`);
    const stars = mode.kind === 'level' ? `<div class="win-stars" role="img" aria-label="${rec.stars} of 3 stars">${[1, 2, 3].map((i) => (i <= rec.stars ? ICON.star : ICON.starOff)).join('')}</div>` : '';
    sheet = openSheet(scope, {
      title: 'Harmony restored!',
      center: true,
      dismissible: false,
      className: 'win-sheet',
      body: `
        ${stars}
        <div class="stats">
          <div class="stat"><div class="stat__v">${fmtClock(seconds)}</div><div class="stat__k">${rules.timer ? 'time' : 'time (untimed)'}</div></div>
          <div class="stat"><div class="stat__v">${s.mistakes}</div><div class="stat__k">${s.mistakes === 1 ? 'mistake' : 'mistakes'}</div></div>
          <div class="stat"><div class="stat__v">${s.hintsUsed}</div><div class="stat__k">${s.hintsUsed === 1 ? 'hint' : 'hints'}</div></div>
        </div>
        ${badges.length ? `<div class="win-badges">${badges.join('')}</div>` : ''}
        <div class="sheet__actions">
          <button class="btn btn--block" data-act="next" data-autofocus>${esc(primaryLabel)}</button>
          <button class="btn btn--quiet" data-act="share">${ICON.share}Share result</button>
        </div>`,
    });
    const ws = sheet;
    let leaving = false;
    ws.scope.on(ws.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || leaving) return;
      if (a.act === 'share') {
        void shareResult(seconds);
        return;
      }
      leaving = true;
      ws.close();
      await maybeInterstitial();
      if (typeof next === 'object') startGame(next);
      else app.router.go({ screen: next === 'cup' ? 'league' : 'home' });
    });
  }

  async function shareResult(seconds: number): Promise<void> {
    const what = mode.kind === 'daily' ? `Daily ${mode.dateKey}` : modeTitle(mode);
    const text = `Pawtopia ${what}: solved in ${fmtClock(seconds)}${s.mistakes === 0 ? ' with no mistakes' : ''}.`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        coach('Result copied.');
      }
    } catch {
      /* cancelled */
    }
  }

  async function maybeInterstitial(): Promise<void> {
    const today = new Date().toDateString();
    if (cadence.day !== today) {
      cadence.day = today;
      cadence.shownToday = 0;
    }
    const ok =
      ads.available &&
      shouldShowInterstitial(
        { removeAds: app.removeAds, levelsCompleted: app.save.journey.nextLevel - 1, boardsSinceLast: cadence.boardsSinceLast, lastShownAt: cadence.lastShownAt, shownToday: cadence.shownToday },
        { mode: mode.kind, outcome: 'won', now: Date.now() },
      );
    if (!ok) return;
    if (await ads.showInterstitial()) {
      cadence.boardsSinceLast = 0;
      cadence.lastShownAt = Date.now();
      cadence.shownToday++;
    }
  }

  function onLose(): void {
    s.pause();
    recordLoss(app.save);
    app.saveActive();
    track('puzzle_fail', { mode: mode.kind, size: n });
    haptic('error');
    const canRevive = rules.revive && (app.removeAds || ads.available);
    sheet = openSheet(scope, {
      title: mode.kind === 'cup' ? 'Attempt ended' : 'Out of hearts',
      center: true,
      dismissible: false,
      body: `
        <p class="sheet__lead">${mode.kind === 'cup' ? 'Three wrong placements end a Paw Cup attempt.' : canRevive ? 'Three wrong placements. Refill your hearts and keep this board, or start fresh.' : 'Three wrong placements. Start this board again with a fresh line of logic.'}</p>
        <div class="sheet__actions">
          ${canRevive ? `<button class="btn btn--block" data-act="revive">Refill hearts${app.removeAds ? '' : '<span class="btn__price">Watch ad</span>'}</button>` : ''}
          ${mode.kind === 'cup' ? '' : `<button class="btn ${canRevive ? 'btn--secondary' : ''} btn--block" data-act="restart">${ICON.restart}Try again</button>`}
          <button class="btn btn--quiet" data-act="leave">${mode.kind === 'cup' ? 'Back to Paw Cup' : 'Back home'}</button>
        </div>`,
    });
    const ls = sheet;
    let busy = false;
    ls.scope.on(ls.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || busy) return;
      if (a.act === 'revive') {
        busy = true;
        track('rewarded_ad_offer', { placement: 'revive' });
        const ok = app.removeAds ? true : await ads.showRewarded('revive');
        busy = false;
        if (!scope.alive || !ls.scope.alive) return; // left while the ad ran
        if (!ok) return;
        if (!app.removeAds) track('rewarded_ad_complete', { placement: 'revive' });
        s.revive();
        ls.close();
        sheet = null;
        coach('Hearts refilled. Your board is just as you left it.');
        paint();
        s.resume();
        app.saveActive();
      } else if (a.act === 'restart') {
        ls.close();
        restartGame();
      } else {
        ls.close();
        app.save.lastSession = null;
        app.active = null;
        app.persist();
        app.router.go({ screen: mode.kind === 'cup' ? 'league' : 'home' });
      }
    });
  }

  // ---------------------------------------------------------------- start

  coach(defaultCoach());
  paint();
  if (rules.timer) scope.interval(tick, 500);
  scope.onDispose(() => {
    if (!finished) {
      s.pause();
      app.saveActive();
    }
  });
  s.resume();
  if (!app.save.onboarding.seenRules) {
    s.pause();
    showRules(scope, () => {
      app.save.onboarding.seenRules = true;
      app.persist();
      resumeIfOnScreen();
    });
  }
}
