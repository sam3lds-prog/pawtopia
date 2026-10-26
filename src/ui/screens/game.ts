/** The play screen: top bar, the board (hero), one coach line, tools and actions. */

import { app } from '../../app/app';
import { restartGame, startGame } from '../../app/gameFlow';
import { CAT, DOG, type Species } from '../../engine/types';
import { fmtClock } from '../../game/dates';
import { nextAfterWin, rulesFor, type ModeRef } from '../../game/modes';
import { modeShortTitle, modeTitle } from '../../game/puzzles';
import { MARK, type HintInfo, type MoveResult, type Session, type Tool, type UnitRef } from '../../game/session';
import { recordLoss, recordWin, type WinRecord } from '../../meta/progression';
import { rewardsForWin, type RewardSummary } from '../../meta/rewards';
import { finishAttempt } from '../../competitions/localCup';
import type { ScoreBreakdown } from '../../competitions/scoring';
import { afterSolve, type MetaNews } from '../../app/events';
import { DECOR_BY_ID } from '../../meta/catalogs/decor';
import { PET_BY_ID } from '../../meta/catalogs/pets';
import { decorIcon } from '../art/sanctuary';
import { ads, shouldShowInterstitial } from '../../services/ads';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { rosterFor, tilePetId, toolPetSvg } from '../art/petTiles';
import { applyFace, petElement, petSvg, speciesKey } from '../art/pets';
import { FaceDirector, lookToward, type Clock } from '../animation/faceDirector';
import type { ReactionMood } from '../animation/faceMachine';
import type { PetId } from '../../meta/catalogs/pets';
import { isTutorial, levelTip, TUTORIAL_STEPS } from '../../meta/onboarding';
import { EMPTY } from '../../engine/types';
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
  const tutorial = isTutorial(mode, app.save);
  // Hearts follow the session (the guided first board has none to lose).
  const rules = { ...rulesFor(mode), hearts: s.heartsEnabled };
  const n = s.size;
  const total = 2 * n;
  const settings = app.settings;
  const classic = settings.controls === 'classic';
  let tool: Tool = 'cat';
  let hint: { info: HintInfo; tier: 1 | 2 } | null = null;
  let finished = false;
  let sheet: SheetHandle | null = null;
  let lastPlaced: PetId | null = null;
  /** Tutorial: the placement the coach is pointing at. */
  let guide: { step: number; r: number; c: number; species: Species; unit: UnitRef | null; text: string } | null = null;
  let winPet: PetId | null = null;

  const el = h(`
    <div class="game" data-mode="${mode.kind}">
      <header class="game-top">
        <button class="icon-btn" data-act="leave" aria-label="Leave board">${ICON.back}</button>
        <div class="game-title">
          <h1 data-autofocus aria-label="${esc(modeTitle(mode))}">${esc(modeShortTitle(mode))}</h1>
          <div class="game-sub"><span class="chip">${n}×${n}</span><span class="chip">${capitalize(s.puzzle.difficulty)}</span></div>
        </div>
        <div class="game-top__end">
          ${rules.hearts ? '<div class="hearts" data-hearts role="img"></div>' : tutorial ? '<span class="chip chip--guide">Practice</span>' : `<span class="zen-mark" aria-label="No hearts in Zen">${ICON.leaf}</span>`}
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

  // ---------------------------------------------------------------- faces (facial-only animation)
  const roster = rosterFor(app.save);
  const tilePets = new Map<string, PetId>();
  const clock: Clock = { now: () => performance.now(), set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => clearTimeout(id) };
  const faces = new FaceDirector({ clock, seed: s.puzzle.seed, reducedMotion: app.reducedMotion, slowBlink: (k) => tilePets.get(k) === 'mochi' });
  scope.onDispose(() => faces.dispose());
  const keyOf = (r: number, c: number) => `${r},${c}`;

  const board = new Board(
    s.puzzle,
    scope,
    { onPress, onDrag, onKey },
    {
      pannable: settings.largeBoard,
      pet: (r, c, sp) => {
        const id = tilePetId(s.puzzle, r, c, sp, roster);
        const { el, svg } = petElement(id);
        tilePets.set(keyOf(r, c), id);
        faces.add(keyOf(r, c), speciesKey(sp), { apply: (v) => applyFace(svg, id, v) });
        return el;
      },
      onPetRemoved: (r, c) => {
        faces.remove(keyOf(r, c));
        tilePets.delete(keyOf(r, c));
      },
      petName: (r, c) => {
        const id = tilePets.get(keyOf(r, c));
        return id ? PET_BY_ID[id].name : null;
      },
    },
  );
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
    syncGuide();
  }

  // ---------------------------------------------------------------- tutorial

  function startGuide(step: number): void {
    const info = step <= TUTORIAL_STEPS && !finished ? s.peekHint() : null;
    if (!info) {
      guide = null;
      board.setGuide(null);
      board.clearHint();
      coachGuide("That's the idea! Finish the board on your own. Hint is there if you need it.");
      track('onboarding_step', { step: 'tutorial_free_play' });
      return;
    }
    const word = SPECIES_WORD[info.species];
    const text =
      step === 1
        ? `Every row, column and color needs one cat and one dog. Tap the glowing tile to place a ${word}.`
        : `${friendlyReason(info.reason)} Tap the glowing tile.`;
    guide = { step, r: info.r, c: info.c, species: info.species, unit: info.unit, text };
    tool = info.species === CAT ? 'cat' : 'dog';
    coachGuide(text);
    track('onboarding_step', { step: `tutorial_${step}` });
  }

  function syncGuide(): void {
    if (!guide) return;
    if (s.cells[guide.r][guide.c] === guide.species) {
      const next = guide.step + 1;
      guide = null;
      board.setGuide(null);
      startGuide(next);
      if (guide) paint();
      return;
    }
    board.setGuide(s.cells[guide.r][guide.c] === EMPTY || s.cells[guide.r][guide.c] === MARK ? [guide.r, guide.c] : null);
    // The line whose logic forces the placement is softly lit, so the player sees why.
    if (!hint) board.setHint(guide.unit ? s.unitCells(guide.unit) : [], null);
  }

  function coachGuide(text: string): void {
    coach(text);
    coachEl.classList.add('is-guide');
  }

  function tick(): void {
    if (timerEl) timerEl.textContent = fmtClock(s.elapsedSeconds());
  }

  /** Pauses the clock and the pets' ambient life (blinks, dozing). */
  /**
   * Pauses the clock and the pets' ambient life (blinks, dozing). In Paw Cup the board is also hidden whenever the
   * clock is stopped (pause, rules, settings), so paused time can't be used to think.
   */
  function pauseBoard(): void {
    s.pause();
    faces.setAmbient(false);
    if (mode.kind === 'cup' && !finished && !board.el.querySelector('.board-veil')) {
      board.el.appendChild(h('<div class="board-veil">Board hidden while paused</div>'));
      el.classList.add('is-paused');
    }
  }

  function unveil(): void {
    board.el.querySelector('.board-veil')?.remove();
    el.classList.remove('is-paused');
  }

  /** Placed pets of a unit (at most `max`), for proud / focused reactions. */
  function petsIn(cells: Array<[number, number]>, max: number, first?: string): string[] {
    const out: string[] = first && faces.has(first) ? [first] : [];
    for (const [r, c] of cells) {
      if (out.length >= max) break;
      const k = keyOf(r, c);
      if (!out.includes(k) && faces.has(k)) out.push(k);
    }
    return out;
  }

  function coach(text: string): void {
    coachEl.textContent = text;
    coachEl.classList.remove('is-guide');
  }

  function defaultCoach(): string {
    if (mode.kind === 'cup') return 'Paw Cup rules: no hints, three hearts, your time counts.';
    const tip = mode.kind === 'level' ? levelTip(mode.level) : null;
    if (tip) return tip;
    if (mode.kind === 'zen') return 'No clock, no hearts. Take all the time you like.';
    if (classic) return 'Tap once to mark a tile empty, again to place your pet.';
    return 'One cat and one dog in every row, column and color.';
  }

  // ---------------------------------------------------------------- input

  function onPress(r: number, c: number): 'mark' | 'unmark' | null {
    if (finished || s.paused) return null;
    faces.activity();
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
    faces.activity();
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
    let react: (() => void) | undefined;
    if (res.wrong && res.placed) {
      onMistake(r, c, res.placed);
    } else if (res.placed) {
      sfx('place');
      haptic('place');
      board.flash([[r, c]], 'is-fresh', 720);
      const key = keyOf(r, c);
      if (res.completed?.length) {
        const units = res.completed;
        onUnits(units);
        // The new pet and its partner in the completed line beam with pride (two faces at most).
        react = () => petsIn(s.unitCells(units[0]), 2, key).forEach((k) => faces.react(k, 'proud'));
      } else {
        coach(encouragement());
        react = () => faces.react(key, 'happy');
      }
    } else if (res.marked) {
      sfx('mark');
      haptic('tap');
      react = () => glanceFromNeighbor(r, c);
    }
    afterChange(react);
  }

  /** A pet beside a tile the player just marked glances toward it (position only, never the answer). */
  function glanceFromNeighbor(r: number, c: number): void {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const k = keyOf(r + dr, c + dc);
        if (faces.has(k)) {
          faces.react(k, 'curious', lookToward({ r: r + dr, c: c + dc }, { r, c }));
          return;
        }
      }
  }

  function onMistake(r: number, c: number, sp: Species): void {
    sfx('oops');
    haptic('error');
    board.flash([[r, c]], 'is-miss', MISS_MS);
    // The attempted pet appears faintly, puzzled, and fades. It is the only face that reacts to a mistake.
    board.ghost(r, c, petElement(tilePetId(s.puzzle, r, c, sp, roster), 'confused').el, MISS_MS);
    const word = SPECIES_WORD[sp];
    if (guide) {
      coach(`Not quite. That tile can't hold a ${word}.`);
      const g = guide;
      scope.timeout(() => guide === g && coachGuide(g.text), 1800);
    } else if (!rules.hearts) coach(`Not a ${word} spot. No rush, try another line of thought.`);
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

  function afterChange(react?: () => void): void {
    if (hint) {
      hint = null;
      board.clearHint();
    }
    paint();
    react?.();
    const newest = [...tilePets.keys()].pop();
    if (newest) lastPlaced = tilePets.get(newest) ?? lastPlaced;
    app.saveActive();
    checkOutcome();
  }

  // ---------------------------------------------------------------- actions

  function doUndo(): void {
    if (finished) return;
    if (s.undo()) {
      haptic('tap');
      faces.activity();
      faces.calmAll();
      afterChange();
    }
  }

  function doRedo(): void {
    if (finished) return;
    if (s.redo()) {
      haptic('tap');
      faces.activity();
      faces.calmAll();
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
      faces.activity();
      if (info.unit) {
        board.setHint(s.unitCells(info.unit), null);
        focusFaces(s.unitCells(info.unit));
        coach(`Look at ${unitPhrase(info.unit)}. One spot there is already decided.`);
      } else {
        board.setHint([], [info.r, info.c]);
        coach('Look at the highlighted tile.');
      }
    } else if (hint.tier === 1) {
      hint.tier = 2;
      track('hint_used', { mode: mode.kind, tier: 2 });
      board.setHint(hint.info.unit ? s.unitCells(hint.info.unit) : [], [hint.info.r, hint.info.c]);
      if (hint.info.unit) focusFaces(s.unitCells(hint.info.unit));
      coach(friendlyReason(hint.info.reason));
    } else {
      track('hint_used', { mode: mode.kind, tier: 3 });
      const info = s.hint();
      hint = null;
      board.clearHint();
      let reactTo: { key: string; mood: ReactionMood } | null = null;
      if (info) {
        sfx('place');
        board.flash([[info.r, info.c]], 'is-fresh', 720);
        const units = s.completedUnitsAt(info.r, info.c);
        coach(friendlyReason(info.reason));
        if (units.length) onUnits(units);
        reactTo = { key: keyOf(info.r, info.c), mood: 'happy' };
      }
      paint();
      if (reactTo) faces.react(reactTo.key, reactTo.mood);
      app.saveActive();
      checkOutcome();
      return;
    }
    paint();
  }

  /** Pets already in the hinted line look attentive. They are where the player is already looking. */
  function focusFaces(cells: Array<[number, number]>): void {
    for (const k of petsIn(cells, 2)) faces.react(k, 'focused');
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
      faces.activity();
      if (tool === 'cat' || tool === 'dog') faces.curiousOne(tool, [0, 1.3]);
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
        pauseBoard();
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
    unveil();
    s.resume();
    faces.setAmbient(!document.hidden);
    faces.activity();
  }

  function leave(): void {
    app.saveActive();
    app.router.go({ screen: mode.kind === 'level' ? 'play' : mode.kind === 'cup' ? 'league' : 'home' });
  }

  function openPause(): void {
    if (finished || sheet) return;
    pauseBoard();
    el.classList.add('is-paused');
    sheet = openSheet(scope, {
      title: 'Paused',
      body: `
        <p class="sheet__lead">${rules.timer ? `Clock stopped at ${fmtClock(s.elapsedSeconds())}.` : 'Your board is saved.'}</p>
        <div class="sheet__actions">
          <button class="btn btn--block" data-act="resume">${ICON.resume}Resume</button>
          ${mode.kind === 'cup' ? '' : `<button class="btn btn--secondary btn--block" data-act="restart">${ICON.restart}Restart board</button>`}
          <button class="btn btn--quiet" data-act="settings">Settings</button>
          <button class="btn btn--quiet" data-act="leave">${mode.kind === 'cup' ? 'Leave (this attempt stays open)' : 'Leave and keep progress'}</button>
        </div>`,
      onClose: () => {
        sheet = null;
        if (mode.kind !== 'cup') el.classList.remove('is-paused');
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
        pauseBoard();
        showSettings(scope, { inGame: true, onClose: () => app.router.refresh() });
      } else if (a.act === 'leave') {
        ps.close();
        leave();
      }
    });
  }

  function confirmRestart(): void {
    pauseBoard();
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
    // Every pet smiles or winks in a short staggered wave (≤1.5s total), faces only.
    const order: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) order.push(keyOf(r, c));
    faces.celebrate(order);
    winPet = lastPlaced ?? tilePets.values().next().value ?? null;
    const result = { size: n, seconds: s.elapsedSeconds(), mistakes: s.mistakes, hintsUsed: s.hintsUsed, revives: s.revives, hearts: rules.hearts };
    const rec = recordWin(app.save, mode, result);
    const rewards = rewardsForWin(app.save, mode, rec);
    const cupScore = mode.kind === 'cup' ? finishAttempt(app.save, mode, s.events, s.elapsedMs()) : null;
    const news = afterSolve(mode, n, result.mistakes, result.hintsUsed);
    app.clearSaved(mode);
    app.active = null;
    app.persist();
    cadence.boardsSinceLast++;
    track('puzzle_complete', { mode: mode.kind, size: n, seconds: result.seconds, mistakes: result.mistakes, hints: result.hintsUsed });
    if (mode.kind === 'daily' && rec.newDaily) track('daily_complete', { streak: rec.streak ?? 0 });
    for (const p of rewards.pets) track('pet_unlocked', { pet: p });
    sfx('win');
    haptic('success');
    coach('Harmony restored.');
    scope.timeout(() => showWin(rec, result.seconds, rewards, news, cupScore), app.reducedMotion ? 150 : 1000);
  }

  function rewardsMarkup(r: RewardSummary): string {
    if (!r.coins && !r.pets.length && !r.decor.length) return '';
    const coins = r.coins
      ? `<div class="reward-coins"><span class="reward-coins__amt">${ICON.coin}<b class="num">+${r.coins}</b></span><span class="muted">${esc(r.lines.map((l) => l.label).join(' · '))}</span></div>`
      : '';
    const pets = r.pets
      .map((id) => `<div class="reward-item"><span class="reward-item__art">${petSvg(id, { mood: 'happy' })}</span><span><b>${esc(PET_BY_ID[id].name)} moved in!</b><small>${esc(PET_BY_ID[id].trait)}</small></span></div>`)
      .join('');
    const decor = r.decor
      .map((id) => `<div class="reward-item"><span class="reward-item__art">${decorIcon(id)}</span><span><b>${esc(DECOR_BY_ID[id].name)}</b><small>${r.chapter ? `Gift for finishing ${esc(r.chapter.name)}` : 'New decoration'}</small></span></div>`)
      .join('');
    return `<div class="win-rewards">${coins}${pets}${decor}</div>`;
  }

  function newsMarkup(nw: MetaNews): string {
    if (!nw.achievements.length && !nw.missions.length) return '';
    const badges = nw.achievements
      .map((a) => `<div class="reward-item"><span class="reward-item__art reward-item__art--badge">${ICON[a.icon]}</span><span><b>Badge: ${esc(a.name)}</b><small>${esc(a.description)} +${a.coins} coins</small></span></div>`)
      .join('');
    const missions = nw.missions.length ? `<p class="win-missions">${ICON.check}${nw.missions.length === 1 ? `Mission done: ${esc(nw.missions[0].title)}` : `${nw.missions.length} missions done`}. Claim on Home.</p>` : '';
    return `<div class="win-news">${badges}${missions}</div>`;
  }

  function cupMarkup(sc: ScoreBreakdown | null): string {
    if (!sc) return '';
    return `<div class="score-card">
      <div class="score-card__total"><span class="num">${sc.total}</span><small>points</small></div>
      <dl class="score-card__rows">
        <div><dt>Finished</dt><dd class="num">${sc.base}</dd></div>
        <div><dt>Speed</dt><dd class="num">+${sc.time}</dd></div>
        <div><dt>Accuracy</dt><dd class="num">+${sc.accuracy}</dd></div>
      </dl>
      <p class="score-card__note">${ICON.info}Practice score, kept on this device. Not ranked against anyone.</p>
    </div>`;
  }

  function showWin(rec: WinRecord, seconds: number, rewards: RewardSummary, news: MetaNews, cupScore: ScoreBreakdown | null): void {
    const next = nextAfterWin(mode);
    const meet = rewards.pets.length > 0;
    const firstBoard = mode.kind === 'level' && mode.level === 1 && rec.firstClear;
    const primaryLabel = firstBoard
      ? 'Meet your residents'
      : typeof next === 'object' && next.kind === 'level'
        ? `Play level ${next.level}`
        : next === 'cup'
          ? 'Back to Paw Cup'
          : 'Back home';
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
        ${winPet ? `<div class="win-pet">${petSvg(winPet, { mood: 'proud' })}</div>` : ''}
        ${stars}
        <div class="stats">
          <div class="stat"><div class="stat__v">${fmtClock(seconds)}</div><div class="stat__k">${rules.timer ? 'time' : 'time (untimed)'}</div></div>
          <div class="stat"><div class="stat__v">${s.mistakes}</div><div class="stat__k">${s.mistakes === 1 ? 'mistake' : 'mistakes'}</div></div>
          <div class="stat"><div class="stat__v">${s.hintsUsed}</div><div class="stat__k">${s.hintsUsed === 1 ? 'hint' : 'hints'}</div></div>
        </div>
        ${badges.length ? `<div class="win-badges">${badges.join('')}</div>` : ''}
        ${cupMarkup(cupScore)}
        ${rewardsMarkup(rewards)}
        ${newsMarkup(news)}
        <div class="sheet__actions">
          <button class="btn btn--block" data-act="${firstBoard ? 'meet' : 'next'}" data-autofocus>${esc(primaryLabel)}</button>
          <div class="win-secondary">
            ${firstBoard ? '' : `<button class="btn btn--quiet" data-act="${meet ? 'meet' : 'sanctuary'}">${ICON.home}${meet ? `Meet ${esc(PET_BY_ID[rewards.pets[0]].name)}` : 'Visit sanctuary'}</button>`}
            <button class="btn btn--quiet" data-act="share" aria-label="Share result">${ICON.share}${firstBoard ? 'Share result' : 'Share'}</button>
          </div>
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
      if (a.act === 'meet' || a.act === 'sanctuary') {
        app.router.go({ screen: 'sanctuary', welcome: a.act === 'meet' ? rewards.pets : [] });
        return;
      }
      // Celebration first, always. An interstitial (if any network is live) can only follow the player's tap.
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
    pauseBoard();
    recordLoss(app.save);
    if (mode.kind === 'cup') {
      finishAttempt(app.save, mode, s.events, s.elapsedMs());
      app.clearSaved(mode);
      app.active = null;
      app.persist();
    }
    // A lost board isn't resumable (only a refill brings it back), so this clears its save slot.
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
        resumeIfOnScreen();
        app.saveActive();
      } else if (a.act === 'restart') {
        ls.close();
        restartGame();
      } else {
        ls.close();
        app.clearSaved(mode);
        app.active = null;
        app.persist();
        app.router.go({ screen: mode.kind === 'cup' ? 'league' : 'home' });
      }
    });
  }

  // ---------------------------------------------------------------- start

  scope.on(document, 'visibilitychange', () => faces.setAmbient(!document.hidden && !s.paused && !finished));

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
  if (tutorial) {
    app.save.onboarding.seenRules = true;
    app.persist();
    startGuide(1);
    paint();
  } else if (!app.save.onboarding.seenRules) {
    pauseBoard();
    showRules(scope, () => {
      app.save.onboarding.seenRules = true;
      app.persist();
      resumeIfOnScreen();
    });
  }
}
