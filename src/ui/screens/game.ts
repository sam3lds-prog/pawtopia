/**
 * The play screen: top bar, the board (hero), one coach line, and the controls. Three schemes (Settings → Controls):
 *  - 'place' (default, D36): a tool bar below the board, one tool pressed at a time: the board's animal(s), ✕ (mark
 *    empty, finger-drag marks a run of tiles) and Erase. One tap on a tile applies the tool; a wrong animal costs a
 *    heart and leaves the tile as it was. Tapping a placed animal does nothing but say so (Erase takes it back).
 *  - 'tap' (D35): tap marks ✕, double-tap places the picked animal; Erase is a toggle.
 *  - 'classic': each tap cycles empty → ✕ → animal → empty; no timing at all.
 * The board shows the animal you're bringing home to the sanctuary the board is for (meta/cast.ts).
 */

import { app } from '../../app/app';
import { restartGame, startGame } from '../../app/gameFlow';
import { CAT, DOG, type Species } from '../../engine/types';
import { fmtClock } from '../../game/dates';
import { CUP_HEARTS, modeKey, nextAfterWin, rulesFor, type ModeRef } from '../../game/modes';
import { ITEM_CAP, itemBalance, pawPoints, rankFor, useItem } from '../../meta/items';
import { modeShortTitle, modeTitle, type SpecVersion } from '../../game/puzzles';
import { difficultyReason, profileOf } from '../../game/grading';
import { MARK, type HintInfo, type MoveResult, type Session, type Tool, type UnitRef } from '../../game/session';
import { recordLoss, recordWin, type WinRecord } from '../../meta/progression';
import { rewardsForWin, type RewardSummary } from '../../meta/rewards';
import { finishAttempt } from '../../competitions/localCup';
import type { ScoreBreakdown } from '../../competitions/scoring';
import { afterSolve, type MetaNews } from '../../app/events';
import { DECOR_BY_ID } from '../../meta/catalogs/decor';
import { SANCTUARY_BY_ID, isRegionId, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { activeSanctuary, arrivalProgress, countsForGrowth, creditSolve, isMilestone, nextStage, openRegions, stageOf, type GrowthNews } from '../../meta/world';
import { regionThumb } from '../art/regions';
import { animalInfo, withArticle, type AnimalId } from '../../meta/animals';
import { castFor, castWord, type Cast } from '../../meta/cast';
import { queueSolve, syncLeaderboard } from '../../app/leaderboardSync';
import { decorIcon } from '../art/sanctuary';
import { ads, INTERSTITIALS_ENABLED, shouldShowInterstitial } from '../../services/ads';
import { canOfferVideo, watchVideoFor, type WatchResult } from '../../app/rewarded';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { speciesKey } from '../art/pets';
import { animalElement, animalPortrait, animalSvg, applyAnimalFace } from '../art/animals';
import { FaceDirector, lookToward, type Clock } from '../animation/faceDirector';
import type { ReactionMood } from '../animation/faceMachine';
import { isPairLesson, isTutorial, levelTip, TUTORIAL_STEPS } from '../../meta/onboarding';
import { EMPTY } from '../../engine/types';
import { Board } from '../components/board';
import { openSheet, toast, type SheetHandle } from '../components/sheet';
import { actionOf, capitalize, esc, h, plural, qs } from '../dom';
import { ICON } from '../icons';
import type { Scope, ScreenDef } from '../router';
import { showRules } from './rules';
import { showSettings } from './settings';

const MISS_MS = 700;
/** Two taps on the same tile within this long are a double tap (place the animal). */
export const DOUBLE_TAP_MS = 380;

/** In-memory ad cadence (resets each launch, which only makes ads rarer). */
const cadence = { boardsSinceLast: 0, lastShownAt: null as number | null, shownToday: 0, day: '' };

export const gameScreen: ScreenDef = {
  tab: null,
  title: 'Play',
  mount(root, scope) {
    const active = app.active;
    if (!active) {
      app.router.back({ screen: 'journey' });
      return;
    }
    mountGame(root, scope, active.mode, active.session, active.spec, active.cast ?? castFor(app.save, active.session.rule, active.session.puzzle.seed), active.boardId);
  },
};

function mountGame(root: HTMLElement, scope: Scope, mode: ModeRef, s: Session, spec: SpecVersion = 1, cast: Cast, boardId?: string): void {
  const tutorial = isTutorial(mode, app.save);
  // The first two-animal board (level 21) is guided too, but keeps its hearts.
  const pairLesson = !tutorial && isPairLesson(mode, app.save);
  const guided = tutorial || pairLesson;
  // Hearts follow the session (the guided first board has none to lose).
  const rules = { ...rulesFor(mode), hearts: s.heartsEnabled };
  const n = s.size;
  const total = s.total;
  const solo = s.rule === 'solo';
  /** The animal a board species shows, and the word coaching uses for it ("sheep", or a name when both are one kind). */
  const animalOf = (sp: Species): AnimalId => (sp === DOG && cast.b ? cast.b : cast.a);
  const wordOf = (sp: Species) => castWord(cast, sp === DOG ? 'b' : 'a');
  const aWord = (sp: Species) => withArticle(wordOf(sp));
  // The label comes from measuring this exact board, never from what the level or day asked for.
  const profile = profileOf(s.puzzle);
  const tierName = capitalize(profile.tier);
  const settings = app.settings;
  const scheme = settings.controls;
  const classic = scheme === 'classic';
  /** One tap applies the pressed tool (D36). The other schemes mark with a tap and place with a double tap or a cycle. */
  const placeScheme = scheme === 'place';
  // Which animal a tap (or a double tap) places: always the one animal on a one-animal board; on two-animal boards the
  // one the player picked last. In the place scheme the ✕ and Erase tools live here too, one tool pressed at a time.
  let tool: Tool = solo ? 'cat' : settings.lastSpecies;
  /** Erase is a mode: while it's on, taps take things back. In the place scheme it is simply the Erase tool. */
  let erasing = false;
  let lastTap: { r: number; c: number; t: number; marked: boolean } | null = null;
  let hint: { info: HintInfo; tier: 1 | 2 } | null = null;
  let finished = false;
  let sheet: SheetHandle | null = null;
  let lastPlaced: AnimalId | null = null;
  /** Tutorial: the placement the coach is pointing at. */
  let guide: { step: number; r: number; c: number; species: Species; unit: UnitRef | null; text: string } | null = null;
  let winPet: AnimalId | null = null;
  // Zen and the guided first board never charge for hints. Extra lives work on casual boards with hearts (not Paw Cup).
  const freeHints = mode.kind === 'zen' || guided;
  const pantryOn = rules.revive && rules.hearts && !tutorial;
  const tickets = () => itemBalance(app.save, 'hint');
  const lives = () => itemBalance(app.save, 'life');

  const el = h(`
    <div class="game${guided ? ' is-guided' : ''}" data-mode="${mode.kind}">
      <header class="game-top">
        <button class="icon-btn" data-act="leave" aria-label="Leave board">${ICON.back}</button>
        <div class="game-title">
          <h1 data-autofocus aria-label="${esc(modeTitle(mode))}">${esc(modeShortTitle(mode))}</h1>
          <div class="game-sub"><span class="chip chip--board" title="${esc(`${tierName}: ${difficultyReason(profile)}`)}" aria-label="${esc(`${n} by ${n}, ${tierName}. ${difficultyReason(profile)}`)}">${n}×${n} · ${tierName}</span></div>
        </div>
        <div class="game-top__end">
          ${rules.hearts ? (pantryOn ? '<button class="hearts hearts--btn" data-hearts data-act="hearts"></button>' : '<div class="hearts" data-hearts role="img"></div>') : tutorial ? '<span class="chip chip--guide">Practice</span>' : `<span class="zen-mark" aria-label="No hearts in Zen">${ICON.leaf}</span>`}
          <button class="icon-btn" data-act="pause" aria-label="Pause">${ICON.pause}</button>
        </div>
      </header>
      <div class="board-zone" data-zone>
        <div class="board-stage" data-stage></div>
        <div class="board-foot" data-foot>
          <p class="coach" data-coach aria-live="polite"></p>
          <div class="game-status">
            <span class="status-left"><span data-progress class="num"></span><span class="status-board" aria-hidden="true">${n}×${n} · ${tierName}</span>${
              mode.kind === 'cup'
                ? ''
                : `<span class="status-for" data-for="${cast.sanctuary}" style="--accent:${SANCTUARY_BY_ID[cast.sanctuary].accent}" title="${esc(`This board helps the ${SANCTUARY_BY_ID[cast.sanctuary].name}, whatever you build next.`)}" aria-label="${esc(`This board helps the ${SANCTUARY_BY_ID[cast.sanctuary].short}`)}">${ICON.sprout}${esc(SANCTUARY_BY_ID[cast.sanctuary].short)}</span>`
            }</span>
            ${rules.timer && settings.showTimer ? `<span class="game-timer num" data-timer aria-label="Time">${ICON.clock}<span>0:00</span></span>` : ''}
          </div>
        </div>
      </div>
      <div class="controls controls--${solo ? 'solo' : 'pair'} controls--${scheme}">
        ${
          placeScheme
            ? `<div class="tools tools--place" role="radiogroup" aria-label="Tool: what a tap does">${animalButton(CAT)}${solo ? '' : animalButton(DOG)}<button class="tool tool--mark" role="radio" data-tool="mark" aria-label="Mark empty: a tap marks a tile ✕, a drag marks a run of tiles"><span class="tool__art tool__art--icon">${ICON.mark}</span><span class="tool__label">Mark</span></button><button class="tool tool--erase" role="radio" data-tool="erase" aria-label="Erase: a tap takes an animal or a ✕ back"><span class="tool__art tool__art--icon">${ICON.erase}</span><span class="tool__label">Erase</span></button></div>`
            : `${solo ? '' : `<div class="tools" role="radiogroup" aria-label="Animal a double tap places">${animalButton(CAT)}${animalButton(DOG)}</div>`}
        <button class="act act--erase" data-act="erase" aria-pressed="false">${ICON.erase}<span>Erase</span></button>`
        }
        <button class="act" data-act="hint" ${rules.hints ? '' : 'disabled aria-describedby="no-hints"'}>${rules.hints ? ICON.bulb : ICON.hint}<span data-hint-label>Hint</span>${rules.hints && !freeHints ? '<span class="act__badge" data-hint-badge></span>' : ''}</button>
      </div>
      ${rules.hints ? '' : '<p id="no-hints" class="sr-only">Hints are off in Paw Cup so every player has the same rules.</p>'}
    </div>`);
  root.appendChild(el);

  function animalButton(sp: Species): string {
    const word = wordOf(sp);
    const does = placeScheme ? `a tap places ${withArticle(word)}` : `double tap places ${withArticle(word)}`;
    return `<button class="tool" role="radio" data-tool="${sp === CAT ? 'cat' : 'dog'}" aria-label="${esc(capitalize(word))}: ${esc(does)}"><span class="tool__art">${animalSvg(animalOf(sp))}</span><span class="tool__label">${esc(capitalize(word))}</span></button>`;
  }

  const stage = qs(el, '[data-stage]');
  const coachEl = qs(el, '[data-coach]');
  const progressEl = qs(el, '[data-progress]');
  const timerEl = el.querySelector('[data-timer] span') as HTMLElement | null;
  const heartsEl = el.querySelector('[data-hearts]') as HTMLElement | null;

  // ---------------------------------------------------------------- faces (facial-only animation)
  const tilePets = new Map<string, AnimalId>();
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
        const id = animalOf(sp);
        const { el, svg } = animalElement(id);
        tilePets.set(keyOf(r, c), id);
        faces.add(keyOf(r, c), speciesKey(sp), { apply: (v) => applyAnimalFace(svg, id, v) });
        return el;
      },
      onPetRemoved: (r, c) => {
        faces.remove(keyOf(r, c));
        tilePets.delete(keyOf(r, c));
      },
      petName: (r, c) => {
        const id = tilePets.get(keyOf(r, c));
        return id ? animalInfo(id).name : null;
      },
      speciesName: (sp) => wordOf(sp),
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
    progressEl.innerHTML = `${s.placedCount()} of ${total} <span class="status-word">${total === 1 ? 'animal' : 'animals'}</span> placed`;
    if (heartsEl) {
      heartsEl.dataset.max = String(s.maxHearts);
      heartsEl.innerHTML = Array.from({ length: s.maxHearts }, (_, i) => (i < s.hearts ? ICON.life : ICON.lifeOff)).join('');
      heartsEl.setAttribute(
        'aria-label',
        pantryOn ? `${plural(s.hearts, 'heart')} left. Extra lives: ${lives()}. Tap to use one.` : `${plural(s.hearts, 'heart')} left`,
      );
    }
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
      b.setAttribute('aria-checked', String(placeScheme ? b.dataset.tool === tool : b.dataset.tool === tool && !erasing));
      if (placeScheme) b.disabled = finished;
    }
    const eb = el.querySelector('[data-act="erase"]') as HTMLButtonElement | null;
    if (eb) {
      eb.setAttribute('aria-pressed', String(erasing));
      eb.disabled = finished;
    }
    el.classList.toggle('is-erasing', erasing);
    el.classList.toggle('is-marking', placeScheme && tool === 'mark');
    const hintLabel = el.querySelector('[data-hint-label]');
    if (hintLabel) hintLabel.textContent = !hint ? 'Hint' : hint.tier === 1 ? 'Closer' : 'Show me';
    const badge = el.querySelector('[data-hint-badge]') as HTMLElement | null;
    if (badge) {
      // What the next tap costs: the board's first look is free; otherwise one ticket per hint target.
      // With no hint open, ask what the next look would cost for the cell it would point at (it may already be paid
      // for, or be the free look's cell).
      let nextIsFree: boolean;
      if (hint) nextIsFree = s.hintCost(hint.info, (hint.tier + 1) as 2 | 3, freeHints) === 0;
      else if (s.freeNudgeAvailable) nextIsFree = true;
      else {
        const next = finished ? null : s.peekHint();
        nextIsFree = !!next && s.hintCost(next, 1, freeHints) === 0;
      }
      badge.innerHTML = nextIsFree ? 'Free' : `<span class="num">${tickets()}</span>`;
      badge.classList.toggle('is-free', nextIsFree);
      const hb = badge.closest('button')!;
      hb.setAttribute(
        'aria-label',
        nextIsFree
          ? `${hintLabel?.textContent ?? 'Hint'}, free`
          : `${hintLabel?.textContent ?? 'Hint'}, uses one of your hints. ${plural(tickets(), 'hint')} left`,
      );
    }
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
    const word = wordOf(info.species);
    const name = animalInfo(animalOf(info.species)).name;
    // How the player places an animal under their controls.
    const tapIt = placeScheme ? 'tap it' : classic ? 'tap it twice (once marks ✕, again places)' : 'double-tap it';
    const tapGlow = placeScheme ? 'Tap the glowing tile.' : classic ? 'Tap the glowing tile twice.' : 'Double-tap the glowing tile.';
    let text: string;
    if (solo)
      text =
        step === 1
          ? `One ${word} in every row, column and color, never touching, not even at corners. This color has a single tile, so ${name} goes there: ${tapIt}.`
          : `${friendlyReason(info.reason)} ${tapGlow}`;
    else
      text =
        step === 1
          ? `Now two animals: one ${wordOf(CAT)} and one ${wordOf(DOG)} in every row, column and color, never side by side. ${friendlyReason(info.reason)} ${tapGlow}`
          : `${friendlyReason(info.reason)} The ${word} button is picked for you: ${tapGlow.charAt(0).toLowerCase()}${tapGlow.slice(1)}`;
    guide = { step, r: info.r, c: info.c, species: info.species, unit: info.unit, text };
    tool = info.species === CAT ? 'cat' : 'dog';
    erasing = false;
    coachGuide(text);
    track('onboarding_step', { step: `${tutorial ? 'tutorial' : 'pair_lesson'}_${step}` });
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
    if (mode.kind === 'cup') return `Paw Cup rules: no hints, ${numberWord(CUP_HEARTS).toLowerCase()} hearts, your time counts.`;
    const tip = mode.kind === 'level' ? levelTip(mode.level, wordOf(CAT), wordOf(DOG)) : null;
    if (tip) return tip;
    if (mode.kind === 'zen') return 'No clock, no hearts. Take all the time you like.';
    if (classic) return solo ? `Tap once to mark a tile ✕, again to place ${aWord(CAT)}.` : `Tap once to mark a tile ✕, again to place the animal you picked.`;
    if (placeScheme) {
      if (solo) return `One ${wordOf(CAT)} in every row, column and color, never touching. Tap a tile to place ${aWord(CAT)}; the ✕ tool marks empty tiles.`;
      return `One ${wordOf(CAT)} and one ${wordOf(DOG)} in every row, column and color. Pick an animal below, then tap a tile.`;
    }
    if (solo) return `One ${wordOf(CAT)} in every row, column and color, never touching. Tap to mark ✕, double-tap to place.`;
    return `One ${wordOf(CAT)} and one ${wordOf(DOG)} in every row, column and color. Double-tap places the one you picked.`;
  }

  // ---------------------------------------------------------------- input

  const species = (): Species => (tool === 'dog' ? DOG : CAT);

  function onPress(r: number, c: number): 'mark' | 'unmark' | null {
    if (finished || s.paused) return null;
    faces.activity();
    if (erasing) {
      lastTap = null;
      handle(s.apply(r, c, 'erase'), r, c);
      return null;
    }
    if (placeScheme) {
      if (tool === 'mark') {
        // The ✕ tool: a tap toggles ✕; the finger can keep going to mark (or clear) a run of tiles.
        const res = s.toggleMark(r, c);
        handle(res, r, c);
        if (res.marked) return 'mark';
        if (res.unmarked) return 'unmark';
        return null;
      }
      const v = s.cells[r][c];
      // A placed animal is never taken away by an accidental tap: the coach says how (Erase).
      if (v === CAT || v === DOG) handle({ ignored: true }, r, c);
      else placeAt(r, c);
      return null;
    }
    if (classic) {
      handle(s.tap(r, c, species()), r, c);
      return null;
    }
    const now = performance.now();
    const v = s.cells[r][c];
    // A second tap on the same tile, quickly: place the animal. The first tap's ✕ is taken back with a logged undo,
    // so one Undo afterwards empties the tile (and the server's replay sees exactly the same moves).
    if (lastTap && lastTap.r === r && lastTap.c === c && now - lastTap.t < DOUBLE_TAP_MS && v !== CAT && v !== DOG) {
      const ownMark = lastTap.marked;
      lastTap = null;
      const last = s.lastChange();
      if (ownMark && v === MARK && last && last.r === r && last.c === c && last.before === EMPTY && last.after === MARK) s.undo();
      placeAt(r, c);
      return null;
    }
    if (v === CAT || v === DOG) {
      lastTap = null;
      handle({ ignored: true }, r, c);
      return null;
    }
    const res = s.toggleMark(r, c);
    lastTap = s.givenMask[r][c] ? null : { r, c, t: now, marked: !!res.marked };
    handle(res, r, c);
    if (guide && guide.r === r && guide.c === c && res.marked) coach(`Now tap it again, quickly, to place ${aWord(guide.species)}.`);
    if (res.marked) return 'mark';
    if (res.unmarked) return 'unmark';
    return null;
  }

  /**
   * Places the picked animal. A wrong guess costs a heart and nothing else: the tile keeps whatever it held (empty, or
   * the player's own ✕). It is never marked for them: on a two-animal board the tile may hold the other animal, and a
   * ✕ the player didn't make would mislead them (or give the answer away).
   */
  function placeAt(r: number, c: number): void {
    handle(s.place(r, c, species()), r, c);
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
    // Enter applies the pressed tool (the picked animal; in the place scheme also ✕ or Erase); Space (or X) marks ✕;
    // 1 and 2 place the first or second animal directly.
    if (k === 'enter') return keyApply(r, c, placeScheme && (tool === 'mark' || tool === 'erase') ? tool : species() === DOG ? 'dog' : 'cat');
    if (k === '1' || k === 'a') return keyApply(r, c, 'cat');
    if (!solo && (k === '2' || k === 'b')) return keyApply(r, c, 'dog');
    if (k === ' ' || k === 'x' || k === '.') {
      if (finished || s.paused) return true;
      faces.activity();
      handle(s.toggleMark(r, c), r, c);
      return true;
    }
    if (k === 'backspace' || k === 'delete' || k === '0' || k === 'e') return keyApply(r, c, 'erase');
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
    if (t === 'cat' || t === 'dog') {
      const v = s.cells[r][c];
      if (v === CAT || v === DOG) handle({ ignored: true }, r, c);
      else handle(s.place(r, c, t === 'dog' ? DOG : CAT), r, c); // a wrong guess leaves the tile as it was (see placeAt)
      return true;
    }
    if (t === 'mark') {
      handle(s.toggleMark(r, c), r, c);
      return true;
    }
    handle(s.apply(r, c, t), r, c);
    return true;
  }

  function handle(res: MoveResult, r: number, c: number): void {
    if (res.ignored) {
      const v = s.cells[r][c];
      if (s.givenMask[r][c]) coach(`This ${wordOf(v === DOG ? DOG : CAT)} is already home. Its spot is locked.`);
      else if (v === CAT || v === DOG) coach(`That ${wordOf(v)} is settled. Pick Erase to take it back.`);
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
    // The attempted animal appears faintly, puzzled, and fades. It is the only face that reacts to a mistake.
    board.ghost(r, c, animalElement(animalOf(sp), 'confused').el, MISS_MS);
    const word = wordOf(sp);
    if (guide) {
      coach(`Not quite. That tile can't hold ${withArticle(word)}.`);
      const g = guide;
      scope.timeout(() => guide === g && coachGuide(g.text), 1800);
    } else if (!rules.hearts) coach(`Not ${withArticle(word)} spot. No rush: try another row, column or color.`);
    else if (s.hearts > 0) coach(`Not ${withArticle(word)} spot. Try another row, column or color. ${plural(s.hearts, 'heart')} left.`);
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

  /**
   * Pays for a hint tier if it costs anything: one ticket per hint target, the board's first look free. The ticket and
   * the session's record of it are saved in one write, so a crash can't charge without the hint or the reverse.
   */
  function payFor(info: HintInfo, tier: 1 | 2 | 3): boolean {
    if (s.hintCost(info, tier, freeHints) === 0) {
      s.commitHint(info, tier, false);
      return true;
    }
    const r = useItem(app.save, `use:hint:${modeKey(mode)}:${info.r},${info.c}:${Date.now()}`, 'hint', new Date(), 'Hint');
    if (r !== 'ok') {
      showNoTickets();
      return false;
    }
    s.commitHint(info, tier, true);
    app.saveActive();
    toast(`Hint used · ${tickets()} left`, ICON.bulb);
    return true;
  }

  function showNoTickets(): void {
    if (sheet) return;
    pauseBoard();
    const canWatch = canOfferVideo();
    const ns = openSheet(scope, {
      title: 'No hints left',
      body: `
        <p class="sheet__lead">This board's free look is used. You earn a hint for every second new Journey level and from some of the day's errands. Zen Garden hints are always free.</p>
        <div class="sheet__actions">
          ${canWatch ? `<button class="btn btn--block" data-act="watch">${ICON.videoToken}Watch a short video: +1 hint</button>` : ''}
          <button class="btn ${canWatch ? 'btn--quiet' : 'btn--block'}" data-act="close" data-autofocus>Keep thinking</button>
        </div>`,
      onClose: () => {
        sheet = null;
        resumeIfOnScreen();
      },
    });
    sheet = ns;
    let busy = false;
    ns.scope.on(ns.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || busy) return;
      if (a.act === 'watch') {
        busy = true;
        const r = await watchVideoFor('hint');
        busy = false;
        if (r === 'granted') toast('+1 hint', ICON.bulb);
        else toast(videoMessage(r));
        if (!scope.alive || !ns.scope.alive) return;
        ns.close();
        paint();
      } else ns.close();
    });
  }

  /** Hearts sheet: how many are left on this board, the pantry, and using one extra life for one heart. */
  function openHearts(): void {
    if (finished || sheet || !pantryOn) return;
    pauseBoard();
    const have = lives();
    const full = s.hearts >= s.maxHearts;
    const watch = !full && have < 1 && canOfferVideo();
    const hs = openSheet(scope, {
      title: 'Hearts and extra lives',
      body: `
        <p class="sheet__lead">${plural(s.hearts, 'heart')} of ${s.maxHearts} left on this board. Hearts start fresh on every board; extra lives keep between boards.</p>
        <div class="pantry-row"><span class="pantry-chip">${ICON.lifePlus}<b class="num">${have}</b><small>of ${ITEM_CAP.life} extra lives</small></span><span class="pantry-chip">${ICON.bulb}<b class="num">${tickets()}</b><small>hints</small></span></div>
        <div class="sheet__actions">
          ${
            watch
              ? `<button class="btn btn--block" data-act="watch">${ICON.videoToken}Watch a short video: +1 heart</button>`
              : `<button class="btn btn--block" data-act="life" ${have < 1 || full ? 'disabled' : ''}>${ICON.lifePlus}${full ? 'Hearts are full' : have < 1 ? 'No extra lives yet' : 'Use an extra life: +1 heart'}</button>`
          }
          <button class="btn btn--quiet" data-act="close" data-autofocus>Back to the board</button>
        </div>
        <p class="muted">Extra lives come from clearing new Journey levels and some errands.</p>`,
      onClose: () => {
        sheet = null;
        resumeIfOnScreen();
      },
    });
    sheet = hs;
    let busy = false;
    hs.scope.on(hs.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || busy) return;
      if (a.act === 'life') {
        if (useLife()) coach(`An extra life! ${plural(s.hearts, 'heart')} left.`);
      } else if (a.act === 'watch') {
        busy = true;
        const r = await watchVideoFor('life');
        busy = false;
        // The extra life is the player's either way; it's used right away if they're still on this board.
        if (r === 'granted' && scope.alive && useLife()) coach(`Thanks for watching! ${plural(s.hearts, 'heart')} left.`);
        else if (r !== 'granted') toast(videoMessage(r));
        if (!hs.scope.alive) return;
      }
      hs.close();
    });
  }

  /** Spends one extra life for one heart. The pantry and the board are saved together. */
  function useLife(): boolean {
    // Checked first, so an extra life is only ever spent when it will really give a heart back.
    if (!pantryOn || !s.canAddHeart() || lives() < 1) return false;
    if (useItem(app.save, `use:life:${modeKey(mode)}:${Date.now()}`, 'life', new Date(), 'Heart') !== 'ok') return false;
    s.addHeart();
    track('extra_life_used', { mode: mode.kind });
    haptic('success');
    paint();
    app.saveActive();
    return true;
  }

  function doHint(): void {
    if (finished || !rules.hints || s.paused) return;
    if (!hint) {
      const info = s.peekHint();
      if (!info) return;
      if (!payFor(info, 1)) return;
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
      if (!payFor(hint.info, 2)) return;
      hint.tier = 2;
      track('hint_used', { mode: mode.kind, tier: 2 });
      board.setHint(hint.info.unit ? s.unitCells(hint.info.unit) : [], [hint.info.r, hint.info.c]);
      if (hint.info.unit) focusFaces(s.unitCells(hint.info.unit));
      coach(friendlyReason(hint.info.reason));
    } else {
      if (!payFor(hint.info, 3)) return;
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

  /**
   * Engine reasons say "region 3" and "cat" / "dog" (or "animal" on one-animal boards); players see colors and the
   * board's own animals.
   */
  function friendlyReason(reason: string): string {
    const name = (w: string) => (w === 'dog' ? wordOf(DOG) : wordOf(CAT));
    return reason
      .replace(
        /regions (\d+(?:, \d+)*) and (\d+)/g,
        (_m, list: string, last: string) =>
          `the ${[...list.split(', '), last]
            .map((d) => board.regionName(Number(d) - 1))
            .join(', ')
            .replace(/, ([^,]*)$/, ' and $1')} regions`,
      )
      .replace(/region (\d+)/g, (_m, d) => `the ${board.regionName(Number(d) - 1)} region`)
      .replace(/\b(a|an) (cat|dog|animal)\b/g, (_m, _a, w: string) => withArticle(name(w)))
      .replace(/\b(cat|dog|animal)\b/g, (_m, w: string) => name(w))
      .replace(/^Only one spot left/, 'Only one spot is left');
  }

  scope.on(el, 'click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-tool]') as HTMLElement | null;
    if (t) {
      if (finished) return;
      const picked = t.dataset.tool as Tool;
      // In the place scheme, pressing the ✕ or Erase tool again goes back to the animal.
      if (placeScheme && (picked === 'mark' || picked === 'erase') && tool === picked) selectTool(solo ? 'cat' : settings.lastSpecies);
      else selectTool(picked);
      haptic('select');
      faces.activity();
      if (tool === 'cat' || tool === 'dog') faces.curiousOne(tool, [0, 1.3]);
      coach(toolCoach());
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
      case 'erase':
        if (finished) break;
        erasing = !erasing;
        lastTap = null;
        haptic('select');
        coach(erasing ? 'Erase is on: tap a ✕ or an animal to take it back. Tap Erase again when you are done.' : defaultCoach());
        paint();
        break;
      case 'hint':
        doHint();
        break;
      case 'hearts':
        openHearts();
        break;
    }
  });

  // Tool shortcuts when focus isn't on a cell.
  scope.on(document, 'keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (sheet || document.querySelector('.overlay')) return;
    if ((ke.target as HTMLElement)?.closest?.('.cell')) return;
    if (ke.repeat) return; // a held key acts once (a held H must not run through hint tiers and tickets)
    const k = ke.key.toLowerCase();
    if (!solo && (k === '1' || k === 'a' || k === '2' || k === 'b')) {
      selectTool(k === '1' || k === 'a' ? 'cat' : 'dog');
      paint();
    } else if (k === 'e') {
      if (placeScheme) selectTool(tool === 'erase' ? (solo ? 'cat' : settings.lastSpecies) : 'erase');
      else erasing = !erasing;
      coach(toolCoach());
      paint();
    } else if (placeScheme && k === 'x') {
      selectTool(tool === 'mark' ? (solo ? 'cat' : settings.lastSpecies) : 'mark');
      coach(toolCoach());
      paint();
    } else if (k === 'z') doUndo();
    else if (k === 'y') doRedo();
    else if (k === 'h') doHint();
    else if (k === 'p' || k === 'escape') openPause();
  });

  /** Picks the tool a tap applies (an animal, or in the place scheme ✕ or Erase). The animal is remembered for the next two-animal board. */
  function selectTool(t: Tool): void {
    tool = t;
    erasing = placeScheme ? t === 'erase' : false;
    lastTap = null;
    if ((t === 'cat' || t === 'dog') && !solo) settings.lastSpecies = t;
  }

  /** What the pressed tool does, in one line (the place scheme). */
  function toolCoach(): string {
    if (!placeScheme) return erasing ? 'Erase is on: tap a ✕ or an animal to take it back. Tap Erase again when you are done.' : defaultCoach();
    if (tool === 'mark') return 'Mark is on: tap a tile to mark it ✕, or drag across a few. Tap Mark again to go back to placing.';
    if (tool === 'erase') return 'Erase is on: tap a ✕ or an animal to take it back. Tap Erase again when you are done.';
    return solo ? defaultCoach() : `Tap a tile to place ${aWord(species())}.`;
  }

  function resumeIfOnScreen(): void {
    if (!scope.alive || finished || sheet) return;
    unveil();
    s.resume();
    faces.setAmbient(!document.hidden);
    faces.activity();
  }

  /** Back to wherever the board was opened from (Journey, the World, a sanctuary, Challenges). */
  function leave(): void {
    app.saveActive();
    app.router.back({ screen: mode.kind === 'cup' ? 'challenges' : 'journey' });
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
          <div class="pause-row">
            <button class="btn btn--quiet" data-act="undo" ${s.canUndo() ? '' : 'disabled'}>${ICON.undo}Undo</button>
            <button class="btn btn--quiet" data-act="redo" ${s.canRedo() ? '' : 'disabled'}>${ICON.redo}Redo</button>
          </div>
          <button class="btn btn--quiet" data-act="rules">${ICON.help}How to play</button>
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
      else if (a.act === 'undo' || a.act === 'redo') {
        ps.close();
        if (a.act === 'undo') doUndo();
        else doRedo();
      } else if (a.act === 'rules') {
        ps.close();
        pauseBoard();
        showRules(scope, () => resumeIfOnScreen(), { rule: s.rule, cast });
      } else if (a.act === 'restart') {
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
    // Every animal smiles or winks in a short staggered wave (≤1.5s total), faces only.
    const order: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) order.push(keyOf(r, c));
    faces.celebrate(order);
    winPet = lastPlaced ?? tilePets.values().next().value ?? null;
    const result = {
      size: n,
      seconds: s.elapsedSeconds(),
      mistakes: s.mistakes,
      hintsUsed: s.hintsUsed,
      revives: s.revives,
      hearts: rules.hearts,
      spec,
      tier: profile.tier,
    };
    const openedBefore = openRegions(app.save);
    const rec = recordWin(app.save, mode, result);
    const rewards = rewardsForWin(app.save, mode, rec, new Date(), profile.tier);
    // Every solved puzzle (not Paw Cup) grows the sanctuary this board was started for, whatever is being built now; the
    // guided first board brings the first animal home. Credited once per board (its id is the receipt).
    const growth = countsForGrowth(mode, tutorial) ? creditSolve(app.save, { boardSanctuary: cast.sanctuary, openedBefore, receipt: boardId }) : null;
    // On the leaderboard: queue the board (with its move log) for the server to check, then send in the background.
    const queued = !tutorial && queueSolve(app.save, mode, spec, s.events, result.mistakes, result.hintsUsed);
    const cupScore = mode.kind === 'cup' ? finishAttempt(app.save, mode, s.events, s.elapsedMs()) : null;
    const news = afterSolve(mode, n, result.mistakes, result.hintsUsed);
    app.clearSaved(mode);
    app.active = null;
    app.persist();
    cadence.boardsSinceLast++;
    track('puzzle_complete', { mode: mode.kind, size: n, seconds: result.seconds, mistakes: result.mistakes, hints: result.hintsUsed });
    if (mode.kind === 'daily' && rec.newDaily) track('daily_complete', { streak: rec.streak ?? 0 });
    if (growth?.stageUp) track('region_stage', { region: growth.sanctuary, stage: stageOf(app.save, growth.sanctuary) });
    for (const c of growth?.arrived ?? []) track('animal_arrived', { animal: c, sanctuary: growth!.sanctuary });
    sfx('win');
    haptic('success');
    coach('Harmony restored.');
    // The board locks and glows for a beat (faces smile in a wave), then the results rise in stages. Nothing waits on
    // the animation: the sheet's buttons work the moment it opens, and a tap reveals everything at once.
    if (queued) void syncLeaderboard();
    scope.timeout(() => showWin(rec, result.seconds, rewards, news, cupScore, growth), app.reducedMotion ? 150 : 500);
  }

  function rewardsMarkup(r: RewardSummary): string {
    if (!r.coins && !r.decor.length && !r.lives && !r.hints) return '';
    const pantry = [
      r.lives
        ? `<div class="reward-item"><span class="reward-item__art reward-item__art--pantry">${ICON.lifePlus}</span><span><b>+${plural(r.lives, 'extra life', 'extra lives')}</b><small>One heart back on any Journey or Daily board</small></span></div>`
        : '',
      r.hints
        ? `<div class="reward-item"><span class="reward-item__art reward-item__art--pantry">${ICON.bulb}</span><span><b>+${plural(r.hints, 'hint')}</b><small>Pays for one hint, whichever step you need</small></span></div>`
        : '',
    ].join('');
    const coins = r.coins
      ? `<div class="reward-coins"><span class="reward-coins__amt">${ICON.coin}<b class="num">+${r.coins}</b></span><span class="muted">${esc(r.lines.map((l) => l.label).join(' · '))}</span></div>`
      : '';
    const decor = r.decor
      .map(
        (id) =>
          `<div class="reward-item"><span class="reward-item__art">${decorIcon(id)}</span><span><b>${esc(DECOR_BY_ID[id].name)}</b><small>${r.chapter ? `Gift for finishing ${esc(r.chapter.name)}` : 'New decoration'}</small></span></div>`,
      )
      .join('');
    return `<div class="win-rewards">${coins}${decor}${pantry}</div>`;
  }

  /** The one event a milestone win is about, biggest first: a sanctuary opened, an animal came home, a sanctuary finished, a stage reached. */
  type Hero = { kind: 'opened'; region: SanctuaryId } | { kind: 'arrived'; animal: AnimalId } | { kind: 'completed' } | { kind: 'stage' } | null;
  function heroOf(g: GrowthNews | null): Hero {
    if (!g) return null;
    if (g.opened.length) return { kind: 'opened', region: g.opened[0] };
    if (g.growth > 0 && g.arrived.length) return { kind: 'arrived', animal: g.arrived[0] };
    if (g.growth > 0 && g.completed) return { kind: 'completed' };
    if (g.growth > 0 && g.stageUp) return { kind: 'stage' };
    return null;
  }

  /** The milestone, as the centerpiece of the win sheet (in place of the small appreciative face). */
  function heroMarkup(g: GrowthNews, hero: NonNullable<Hero>): string {
    const def = SANCTUARY_BY_ID[g.sanctuary];
    switch (hero.kind) {
      case 'opened': {
        const r = SANCTUARY_BY_ID[hero.region];
        const art = isRegionId(hero.region) ? `<svg viewBox="0 40 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${regionThumb(hero.region, 0, 'win-hero')}</svg>` : '';
        return `<div class="win-hero win-hero--opened" style="--accent:${r.accent}" data-hero="opened">
          <div class="win-hero__scene">${art}<span class="win-hero__badge">${ICON.globe}New</span></div>
          <h3 class="win-hero__title">The ${esc(r.name)} is open!</h3>
          <p class="win-hero__sub">${esc(r.blurb)}</p>
        </div>`;
      }
      case 'arrived': {
        const a = animalInfo(hero.animal);
        return `<div class="win-hero win-hero--arrived" style="--accent:${def.accent}" data-hero="arrived">
          <div class="win-hero__portrait portrait" style="--tint:${def.accent}">${animalPortrait(hero.animal, 'happy')}<span class="win-hero__badge">${ICON.heart}Home</span></div>
          <h3 class="win-hero__title">${esc(a.name)} the ${esc(a.noun)} came home!</h3>
          <p class="win-hero__sub">${esc(/[.!?]$/.test(a.trait) ? a.trait : `${a.trait}.`)} Now living at the ${esc(def.short)}.</p>
        </div>`;
      }
      case 'completed':
        return `<div class="win-hero win-hero--stage" style="--accent:${def.accent}" data-hero="completed">
          <div class="win-hero__icon">${ICON.sparkle}</div>
          <h3 class="win-hero__title">The ${esc(def.name)} is complete!</h3>
          <p class="win-hero__sub">Every friend has a home.${g.coins ? ` <b class="num">+${g.coins}</b> Paw Coins.` : ''}</p>
        </div>`;
      case 'stage':
        return `<div class="win-hero win-hero--stage" style="--accent:${def.accent}" data-hero="stage">
          <div class="win-hero__icon">${ICON.sprout}</div>
          <h3 class="win-hero__title">${esc(def.short)}: ${esc(g.stageUp!.name)}!</h3>
          <p class="win-hero__sub">${esc(g.stageUp!.change)}.</p>
        </div>`;
    }
  }

  /**
   * What this solve did for the world, below the stats: anything the hero didn't already show (a second region, more
   * arrivals, a stage reached on the same solve as an arrival), then how far the next animal is.
   */
  function growthMarkup(g: GrowthNews | null, hero: Hero): string {
    if (!g) return '';
    const parts: string[] = [];
    for (const r of g.opened) {
      if (hero?.kind === 'opened' && hero.region === r) continue;
      const def = SANCTUARY_BY_ID[r];
      parts.push(
        `<div class="reward-item"><span class="reward-item__art reward-item__art--pantry" style="color:${def.accent}">${ICON.globe}</span><span><b>The ${esc(def.name)} is open!</b><small>${esc(def.blurb)}</small></span></div>`,
      );
    }
    if (g.growth > 0) {
      const def = SANCTUARY_BY_ID[g.sanctuary];
      if (g.redirectedFrom) {
        const from = SANCTUARY_BY_ID[g.redirectedFrom];
        parts.push(`<p class="win-note muted">${ICON.info}The ${esc(from.name)} is finished, so this board helped the ${esc(def.short)} instead.</p>`);
      }
      for (const id of g.arrived) {
        if (hero?.kind === 'arrived' && hero.animal === id) continue;
        const a = animalInfo(id);
        parts.push(
          `<div class="reward-item reward-item--arrival"><span class="reward-item__art">${animalPortrait(id, 'happy')}</span><span><b>${esc(a.name)} the ${esc(a.noun)} came home to the ${esc(def.short)}!</b><small>${esc(a.trait)}</small></span></div>`,
        );
      }
      if (g.completed && hero?.kind !== 'completed')
        parts.push(
          `<div class="win-growth is-up" style="--accent:${def.accent}">${ICON.sparkle}<span><b>The ${esc(def.name)} is complete!</b>${g.coins ? ` <span class="num">+${g.coins}</span> Paw Coins` : ''}</span></div>`,
        );
      else if (g.stageUp && hero?.kind !== 'stage' && hero?.kind !== 'completed')
        parts.push(
          `<div class="win-growth is-up" style="--accent:${def.accent}">${ICON.sprout}<span><b>${esc(def.short)}: ${esc(g.stageUp.name)}!</b> ${esc(g.stageUp.change)}.</span></div>`,
        );
      parts.push(nextFriendMarkup(g.sanctuary, true));
    }
    return parts.length ? `<div class="win-world">${parts.join('')}</div>` : '';
  }

  /** The animal on its way to a sanctuary and how many puzzles until it arrives; `grew` says this solve counted for it. */
  function nextFriendMarkup(where: SanctuaryId | null, grew = false): string {
    if (!where || mode.kind === 'cup') return '';
    const p = arrivalProgress(app.save, where);
    const def = SANCTUARY_BY_ID[where];
    const plus = grew ? `<b>${esc(def.short)} +1</b> · ` : '';
    if (!p) {
      const st = nextStage(app.save, where);
      if (!st) return '';
      const left = st.need - st.have;
      return `<div class="win-growth" style="--accent:${def.accent}">${ICON.sprout}<span>${plus}${left === 1 ? 'one more puzzle' : `${left} more puzzles`} to ${esc(st.stage.name.toLowerCase())}</span></div>`;
    }
    const a = animalInfo(p.next.id);
    const span = Math.max(1, p.need - p.from);
    const pct = Math.round(((p.have - p.from) / span) * 100);
    return `<div class="win-next-friend" style="--accent:${def.accent}"><span class="win-next-friend__art is-shy">${animalPortrait(p.next.id, 'idle')}</span><span class="win-growth__body"><span>${plus}<b>${esc(a.name)} the ${esc(a.noun)}</b> is on the way: ${p.left === 1 ? 'one more puzzle' : `${p.left} more puzzles`}</span><span class="progress world-progress" role="progressbar" aria-label="${esc(a.name)} coming home" aria-valuemin="${p.from}" aria-valuemax="${p.need}" aria-valuenow="${p.have}"><span style="width:${pct}%"></span></span></span></div>`;
  }

  function newsMarkup(nw: MetaNews): string {
    if (!nw.achievements.length && !nw.missions.length) return '';
    const badges = nw.achievements
      .map(
        (a) =>
          `<div class="reward-item"><span class="reward-item__art reward-item__art--badge">${ICON[a.icon]}</span><span><b>Badge: ${esc(a.name)}</b><small>${esc(a.description)} +${a.coins} coins</small></span></div>`,
      )
      .join('');
    const missions = nw.missions.length
      ? `<p class="win-missions">${ICON.check}${nw.missions.length === 1 ? `Mission done: ${esc(nw.missions[0].title)}` : `${nw.missions.length} missions done`}. Claim on Journey.</p>`
      : '';
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

  /** Paw Points earned and how far the player is along their Paw Rank (progress only, never a ranking). */
  function pointsMarkup(r: RewardSummary): string {
    if (!r.points) return '';
    const total = pawPoints(app.save);
    const rank = rankFor(total);
    const rankUp = rank.index > rankFor(total - r.points).index;
    const nextName = rank.next !== null ? rankFor(rank.next).name : null;
    const pct = rank.next !== null ? Math.round(((total - rank.from) / (rank.next - rank.from)) * 100) : 100;
    const line = rankUp
      ? `New Paw Rank: <b>${esc(rank.name)}</b>!`
      : nextName
        ? `${esc(rank.name)} · ${rank.next! - total} to ${esc(nextName)}`
        : esc(rank.name);
    return `<div class="win-points">
      <span class="win-points__amt">${ICON.sparkle}<b class="num">+<span data-count="${r.points}">${r.points}</span></b> Paw Points</span>
      <span class="rank-bar" role="progressbar" aria-label="Paw Rank progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></span>
      <small class="win-points__rank ${rankUp ? 'is-up' : ''}">${line}</small>
    </div>`;
  }

  /** On a replay: what's still there to improve, instead of rewards that were already paid. */
  function replayMarkup(rec: WinRecord, seconds: number): string {
    if (mode.kind !== 'level' || rec.firstClear) return '';
    const clear = app.save.journey.clears[`L${mode.level}`];
    const missing: string[] = [];
    if (clear && !clear.clean) missing.push('with no mistakes');
    if (clear && !clear.hintFree) missing.push('without hints');
    const text =
      rec.isBest && rec.prevBest !== null
        ? `${fmtClock(rec.prevBest - seconds)} faster than your best.`
        : missing.length
          ? `${missing.length === 2 ? 'Two stars' : 'One star'} still to earn: solve it ${missing.join(' and ')}.`
          : `All three stars here. Best time ${fmtClock(app.save.journey.bestTimes[`L${mode.level}`] ?? 0)}.`;
    return `<p class="win-replay">${ICON.target}${esc(text)}</p>`;
  }
  function showWin(rec: WinRecord, seconds: number, rewards: RewardSummary, news: MetaNews, cupScore: ScoreBreakdown | null, growth: GrowthNews | null): void {
    // A visit worth making: a newly opened sanctuary first (that is the news), else a new stage or a new friend.
    const worldVisit: SanctuaryId | null = growth ? (growth.opened[0] ?? (growth.stageUp || growth.arrived.length || growth.completed ? growth.sanctuary : null)) : null;
    const next = nextAfterWin(mode);
    const arrived = growth?.growth ? growth.arrived : [];
    const meet = arrived.length > 0;
    const hero = heroOf(growth);
    // A milestone win puts the event first and the visit as its main action; the next puzzle stays one tap away as a
    // full-size second button. An ordinary win is quick: the next puzzle is the main action, the visit a quiet one.
    const milestone = isMilestone(growth) && mode.kind !== 'cup';
    const nextLabel = typeof next === 'object' && next.kind === 'level' ? `Play level ${next.level}` : next === 'cup' ? 'Back to Paw Cup' : 'Back to Journey';
    const visitAct = hero?.kind === 'opened' ? 'region' : meet ? 'meet' : 'region';
    const visitLabel =
      hero?.kind === 'opened'
        ? `Explore the ${SANCTUARY_BY_ID[hero.region].short}`
        : meet
          ? `Meet ${animalInfo(arrived[0]).name}`
          : worldVisit
            ? `Visit the ${SANCTUARY_BY_ID[worldVisit].short}`
            : 'Visit sanctuary';
    const primaryLabel = milestone ? visitLabel : nextLabel;
    const badges: string[] = [];
    if (rec.clean) badges.push(`<span class="chip chip--brand">${ICON.check}Clean solve</span>`);
    if (rec.isBest && rec.prevBest !== null) badges.push(`<span class="chip chip--gold">${ICON.sparkle}New best</span>`);
    if (mode.kind === 'daily' && rec.streak) badges.push(`<span class="chip chip--coral">${ICON.flame}${plural(rec.streak, 'day')} streak</span>`);
    if (rec.usedCozyDay) badges.push(`<span class="chip">Cozy Day kept your streak</span>`);
    const stars =
      mode.kind === 'level'
        ? `<div class="win-stars" role="img" aria-label="${rec.stars} of 3 stars">${[1, 2, 3].map((i) => (i <= rec.stars ? ICON.star : ICON.starOff)).join('')}</div>`
        : '';
    sheet = openSheet(scope, {
      title: 'Harmony restored!',
      center: true,
      dismissible: false,
      className: `win-sheet${milestone ? ' win-sheet--milestone' : ''}`,
      body: `
        ${milestone && hero && growth ? heroMarkup(growth, hero) : winPet ? `<div class="win-pet">${animalSvg(winPet, { mood: 'proud' })}</div>` : ''}
        <div class="win-stage win-stage-1">
          ${stars}
          <div class="stats">
            <div class="stat"><div class="stat__v">${fmtClock(seconds)}</div><div class="stat__k">${rules.timer ? 'time' : 'time (untimed)'}</div></div>
            <div class="stat"><div class="stat__v">${s.mistakes}</div><div class="stat__k">${s.mistakes === 1 ? 'mistake' : 'mistakes'}</div></div>
            <div class="stat"><div class="stat__v">${s.hintsUsed}</div><div class="stat__k">${s.hintsUsed === 1 ? 'hint' : 'hints'}</div></div>
          </div>
        </div>
        <div class="win-stage win-stage-2">
          ${badges.length ? `<div class="win-badges">${badges.join('')}</div>` : ''}
          ${cupMarkup(cupScore)}
          ${pointsMarkup(rewards)}
          ${replayMarkup(rec, seconds)}
        </div>
        <div class="win-stage win-stage-3">
          ${rewardsMarkup(rewards)}
          ${growthMarkup(growth, hero)}
          ${newsMarkup(news)}
          ${growth ? '' : nextFriendMarkup(activeSanctuary(app.save))}
        </div>
        <div class="sheet__actions">
          ${
            milestone
              ? `<button class="btn btn--block" data-act="${visitAct}" data-autofocus>${esc(primaryLabel)}</button>
          <button class="btn btn--secondary btn--block" data-act="next">${esc(nextLabel)}</button>
          <div class="win-secondary"><button class="btn btn--quiet" data-act="share" aria-label="Share result">${ICON.share}Share</button></div>`
              : `<button class="btn btn--block" data-act="next" data-autofocus>${esc(primaryLabel)}</button>
          <div class="win-secondary">
            ${mode.kind === 'cup' ? '' : worldVisit ? `<button class="btn btn--quiet" data-act="region">${ICON.globe}Visit the ${esc(SANCTUARY_BY_ID[worldVisit].short)}</button>` : growth?.growth ? `<button class="btn btn--quiet" data-act="region">${ICON.home}Visit the ${esc(SANCTUARY_BY_ID[growth.sanctuary].short)}</button>` : `<button class="btn btn--quiet" data-act="sanctuary">${ICON.home}Visit sanctuary</button>`}
            <button class="btn btn--quiet" data-act="share" aria-label="Share result">${ICON.share}Share</button>
          </div>`
          }
        </div>`,
    });
    const ws = sheet;
    let leaving = false;
    // Paw Points count up while the results rise (skipped with reduced motion or a tap).
    const counter = ws.el.querySelector('[data-count]') as HTMLElement | null;
    const reveal = () => {
      ws.el.classList.add('is-revealed');
      if (counter) counter.textContent = counter.dataset.count ?? counter.textContent;
    };
    if (counter && !app.reducedMotion) {
      const target = Number(counter.dataset.count);
      const t0 = performance.now() + 300;
      counter.textContent = '0';
      const step = () => {
        // A tap may have revealed the final number between frames; never overwrite it.
        if (!ws.scope.alive || ws.el.classList.contains('is-revealed')) return;
        const k = Math.min(1, Math.max(0, (performance.now() - t0) / 600));
        counter.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
        if (k < 1 && !ws.el.classList.contains('is-revealed')) ws.scope.frame(step);
      };
      ws.scope.frame(step);
    }
    ws.scope.on(ws.el, 'pointerdown', reveal);
    // Reduced motion: everything at once, no staged delays.
    if (app.reducedMotion) reveal();
    ws.scope.on(ws.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || leaving) return;
      if (a.act === 'share') {
        void shareResult(seconds);
        return;
      }
      leaving = true;
      ws.close();
      if (a.act === 'meet' || a.act === 'sanctuary' || a.act === 'region') {
        // The sanctuary the news is about: a newcomer's home, the region that opened (or the one that grew), or the one being built.
        const where: SanctuaryId =
          a.act === 'meet' ? (growth?.sanctuary ?? 'harmony') : a.act === 'region' ? (worldVisit ?? growth?.sanctuary ?? 'harmony') : (activeSanctuary(app.save) ?? 'harmony');
        const welcome = a.act === 'meet' ? arrived : [];
        if (isRegionId(where))
          app.router.go({ screen: 'region', id: where, fresh: growth?.stageUp && growth.sanctuary === where ? stageOf(app.save, where) : 0, welcome });
        else app.router.go({ screen: 'sanctuary', welcome });
        return;
      }
      // Celebration first, always. An interstitial (if any network is live) can only follow the player's tap.
      await maybeInterstitial();
      if (typeof next === 'object') startGame(next);
      else app.router.back({ screen: next === 'cup' ? 'challenges' : 'journey' });
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
      INTERSTITIALS_ENABLED &&
      ads.available &&
      shouldShowInterstitial(
        {
          removeAds: app.removeAds,
          levelsCompleted: app.save.journey.nextLevel - 1,
          boardsSinceLast: cadence.boardsSinceLast,
          lastShownAt: cadence.lastShownAt,
          shownToday: cadence.shownToday,
        },
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
    const canLife = pantryOn && lives() > 0;
    const canRevive = pantryOn && !canLife && canOfferVideo();
    const wrongs = `${numberWord(s.maxHearts)} wrong placements`;
    sheet = openSheet(scope, {
      title: mode.kind === 'cup' ? 'Attempt ended' : 'Out of hearts',
      center: true,
      dismissible: false,
      body: `
        <p class="sheet__lead">${mode.kind === 'cup' ? `${wrongs} end a Paw Cup attempt.` : canLife || canRevive ? `${wrongs}. Keep this board with a heart back, or start fresh.` : `${wrongs}. Start this board again with a fresh line of logic.`}</p>
        <div class="sheet__actions">
          ${canLife ? `<button class="btn btn--block" data-act="life">${ICON.lifePlus}Use an extra life: +1 heart<span class="btn__price">${lives()} left</span></button>` : ''}
          ${canRevive ? `<button class="btn btn--block" data-act="revive">${ICON.videoToken}Watch a short video: +1 heart</button>` : ''}
          ${mode.kind === 'cup' ? '' : `<button class="btn ${canRevive || canLife ? 'btn--secondary' : ''} btn--block" data-act="restart">${ICON.restart}Try again</button>`}
          <button class="btn btn--quiet" data-act="leave">${mode.kind === 'cup' ? 'Back to Paw Cup' : 'Back to Journey'}</button>
        </div>`,
    });
    const ls = sheet;
    let busy = false;
    ls.scope.on(ls.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || busy) return;
      if (a.act === 'life') {
        busy = true;
        const ok = useLife();
        busy = false;
        if (!ok) return;
        ls.close();
        sheet = null;
        coach('An extra life! One heart back, and your board is just as you left it.');
        resumeIfOnScreen();
        return;
      }
      if (a.act === 'revive') {
        busy = true;
        const r = await watchVideoFor('life');
        busy = false;
        if (r !== 'granted') {
          toast(videoMessage(r));
          return;
        }
        // The extra life is kept in the pantry if the player left meanwhile; otherwise it brings this board back.
        if (!scope.alive || !ls.scope.alive || !useLife()) return;
        ls.close();
        sheet = null;
        coach('Thanks for watching! One heart back, and your board is just as you left it.');
        resumeIfOnScreen();
      } else if (a.act === 'restart') {
        ls.close();
        restartGame();
      } else {
        ls.close();
        app.clearSaved(mode);
        app.active = null;
        app.persist();
        app.router.back({ screen: mode.kind === 'cup' ? 'challenges' : 'journey' });
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
  const ob = app.save.onboarding;
  if (pairLesson && !ob.pairRulesSeen) {
    // Level 21's bridge: one short sheet with the two-animal rules drawn with this board's animals, then the guided
    // lesson places the first two. Shown once.
    ob.seenRules = true;
    ob.pairRulesSeen = true;
    app.persist();
    pauseBoard();
    track('onboarding_step', { step: 'pair_bridge' });
    showRules(
      scope,
      () => {
        resumeIfOnScreen();
        startGuide(1);
        paint();
      },
      { rule: s.rule, cast, bridge: true },
    );
  } else if (guided) {
    // The guided boards teach their rule as they go.
    ob.seenRules = true;
    if (solo) ob.soloRulesSeen = true;
    else ob.pairRulesSeen = true;
    app.persist();
    startGuide(1);
    paint();
  } else if (solo ? !ob.soloRulesSeen : !ob.pairRulesSeen) {
    // The first board under a rule the player hasn't been shown (a returning player's first one-animal board, a Daily
    // before the lesson): the short how-to sheet first.
    pauseBoard();
    showRules(
      scope,
      () => {
        ob.seenRules = true;
        if (solo) ob.soloRulesSeen = true;
        else ob.pairRulesSeen = true;
        app.persist();
        resumeIfOnScreen();
      },
      { rule: s.rule, cast },
    );
  }
}

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function videoMessage(r: WatchResult): string {
  if (r === 'cap') return "That's all the videos for today. More tomorrow.";
  if (r === 'unavailable') return 'Videos are not available in this version.';
  return 'No video is available right now. Nothing was used; try again in a little while.';
}
