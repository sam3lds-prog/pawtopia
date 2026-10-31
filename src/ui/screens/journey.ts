/**
 * Journey (D36): the one place to play. First what the next puzzle is for (the sanctuary being built and the animal on
 * its way), then the next level with one big button, then the Daily and Zen, errands and notices. The chapter path
 * (every unlocked level, stars, chapter gifts) is the Journey's second view, one tap away and one tap back.
 *
 * One rule for the big button: it continues the Journey, the next unfinished level or the Journey board already on the
 * table. A saved Daily or Zen board is offered on its own line, never as the Journey's Continue.
 */

import { app } from '../../app/app';
import { playMode, resumableMode, resumeGame, savedFor, startGame } from '../../app/gameFlow';
import { hasMeaningfulProgress } from '../../game/sessionPersistence';
import { addDaysKey, localDateKey, localWeekStart } from '../../game/dates';
import { modeTitle, puzzleFor, sizeFor } from '../../game/puzzles';
import { displayDifficulty } from '../../game/grading';
import { chapterAt, chapterOf, visibleChapters, type Chapter } from '../../meta/chapters';
import { liveStreak } from '../../meta/progression';
import { openSheet, toast } from '../components/sheet';
import { DECOR_BY_ID } from '../../meta/catalogs/decor';
import { claimMissionDetailed, missionStates, type MissionDef } from '../../meta/missions';
import { CASUAL_HEARTS, FIRST_PAIR_LEVEL, dailyFor, playsSolo, type ModeRef } from '../../game/modes';
import { MAX_NEW_BOARD_SIZE } from '../../game/specs';
import { itemBalance } from '../../meta/items';
import { sfx } from '../../services/audio';
import { track } from '../../services/analytics';
import { miniBoard } from '../components/board';
import { coinPill } from '../components/wallet';
import { controlsNoticeMarkup, handleControlsNotice } from '../components/notices';
import { actionOf, capitalize, esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { CanonicalRoute, Scope, ScreenDef } from '../router';
import { showSettings } from './settings';
import { SANCTUARY_BY_ID, isRegionId, type RegionId, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { activeSanctuary, arrivalProgress, nextStage, nextToOpen, stageOf, unseenIn } from '../../meta/world';
import { animalInfo, homeAnimals } from '../../meta/animals';
import { animalPortrait } from '../art/animals';
import type { CompanionId } from '../../meta/catalogs/companions';
import { regionScene } from '../art/regions';
import { shownDecorIds } from '../../meta/sanctuary';
import { isEvening, sceneMarkup } from './sanctuary';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Zen offers every size up to the 8×8 cap. */
const ZEN_SIZES = Array.from({ length: MAX_NEW_BOARD_SIZE - 4 }, (_, i) => i + 5);
/** Node x positions along the path (percent of width): a gentle S-curve. */
const XS = [50, 70, 78, 66, 46, 28, 22, 34];
const ROW = 84;

/** Levels that mark something on the path: chapter gifts, and the level where boards get a second animal (D35). */
export function milestoneOf(level: number): 'pet' | 'chapter' | null {
  if (level % 20 === 0) return 'chapter';
  if (level === FIRST_PAIR_LEVEL) return 'pet';
  return null;
}

/** The picture of a sanctuary as it is now (the Pet Garden's garden, or the Farm's or a region's land). */
export function sanctuaryPicture(id: SanctuaryId, svgId: string): string {
  if (!isRegionId(id)) return sceneMarkup(svgId);
  const save = app.save;
  return regionScene(
    id,
    { stage: stageOf(save, id), companions: homeAnimals(save, id) as CompanionId[], decor: shownDecorIds(save, id), evening: isEvening() },
    svgId,
  );
}

/** Monday–Sunday strip of this week's dailies. Missing a day never removes anything you've earned. */
function weekStrip(): string {
  const today = localDateKey();
  const start = localWeekStart(today);
  const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cozy = Object.values(app.save.daily.cozyDays);
  const days = names.map((n, i) => {
    const k = addDaysKey(start, i);
    const done = !!app.save.daily.done[k];
    const saved = cozy.includes(k);
    const cls = done ? 'is-done' : saved ? 'is-cozy' : k === today ? 'is-today' : k > today ? 'is-future' : '';
    const label = `${new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}: ${done ? 'daily solved' : saved ? 'kept by a Cozy Day' : k > today ? 'upcoming' : k === today ? 'today' : 'missed'}`;
    return `<li class="${cls}" aria-label="${label}"><span aria-hidden="true">${n}</span></li>`;
  });
  return `<ol class="week-strip" aria-label="This week's daily puzzles">${days.join('')}</ol>`;
}

/**
 * The goal card: the sanctuary being built, who is on the way and how close, with a picture of the place and a way to
 * visit it. The same card sits above the Journey and above the World map, so the goal never leaves the player's sight.
 */
export function goalCardMarkup(opts: { playLevel?: number } = {}): string {
  const save = app.save;
  const id = activeSanctuary(save);
  if (id) {
    const def = SANCTUARY_BY_ID[id];
    const coming = arrivalProgress(save, id);
    const next = nextStage(save, id);
    let line = '';
    let art = '';
    let bar = '';
    if (coming) {
      const a = animalInfo(coming.next.id);
      const span = Math.max(1, coming.need - coming.from);
      const pct = Math.round(((coming.have - coming.from) / span) * 100);
      line = `<b>${esc(a.name)} the ${esc(a.noun)}</b> joins in ${plural(coming.left, 'puzzle')}`;
      art = `<span class="goal-card__friend portrait is-shy" aria-hidden="true">${animalPortrait(coming.next.id, 'idle')}</span>`;
      bar = `<span class="progress goal-card__bar" role="progressbar" aria-label="${esc(a.name)} coming home" aria-valuemin="${coming.from}" aria-valuemax="${coming.need}" aria-valuenow="${coming.have}"><span style="width:${pct}%"></span></span><small class="muted num">${coming.have - coming.from} of ${span} toward arrival</small>`;
    } else if (next) {
      const pct = Math.round(((next.have - next.from) / Math.max(1, next.need - next.from)) * 100);
      line = `<b>${esc(next.stage.name)}</b> in ${plural(next.need - next.have, 'puzzle')}`;
      bar = `<span class="progress goal-card__bar" role="progressbar" aria-label="Progress to ${esc(next.stage.name)}" aria-valuemin="${next.from}" aria-valuemax="${next.need}" aria-valuenow="${next.have}"><span style="width:${pct}%"></span></span>`;
    }
    return `<section class="card goal-card" style="--accent:${def.accent}" aria-labelledby="goal-title" data-goal="${id}">
      <button class="goal-card__scene" data-act="visit" data-region="${id}" aria-label="Visit the ${esc(def.name)}">
        <svg viewBox="0 52 360 216" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${sanctuaryPicture(id, 'goal')}</svg>
      </button>
      <div class="goal-card__body">
        <p class="goal-card__eyebrow">${ICON.sprout}Building now${unseenIn(save, id) ? `<span class="chip chip--coral chip--news">${ICON.sparkle}New</span>` : ''}</p>
        <h2 id="goal-title">${esc(def.name)}</h2>
        <p class="goal-card__next">${art}<span>${line}</span></p>
        ${bar}
      </div>
      <div class="goal-card__actions">
        <button class="btn btn--small btn--secondary" data-act="visit" data-region="${id}">Visit</button>
        ${opts.playLevel ? `<button class="btn btn--small" data-act="play-next">Play level ${opts.playLevel}</button>` : ''}
      </div>
    </section>`;
  }
  const up = nextToOpen(save);
  if (!up) return '';
  return `<section class="card goal-card" style="--accent:${up.def.accent}" aria-labelledby="goal-title">
    <div class="goal-card__body">
      <p class="goal-card__eyebrow">${ICON.globe}World map</p>
      <h2 id="goal-title">${esc(up.def.name)} opens after level ${up.def.opensAfterLevel}</h2>
      <p class="muted">${plural(up.left, 'level')} to go. Every sanctuary you can build is finished, so Journey levels are what opens the next.</p>
    </div>
    <div class="goal-card__actions"><button class="btn btn--small btn--secondary" data-act="world">World</button></div>
  </section>`;
}

/** Opens the sanctuary a goal card points at: the Pet Garden's own screen, or the Farm's or a region's. */
export function visitSanctuary(id: string | undefined): void {
  if (id && isRegionId(id)) app.router.go({ screen: 'region', id: id as RegionId });
  else app.router.go({ screen: 'sanctuary' });
}

function pathMarkup(ch: Chapter): string {
  const save = app.save;
  const next = save.journey.nextLevel;
  const count = ch.last - ch.first + 1;
  const pts = Array.from({ length: count }, (_, i) => ({ x: XS[i % XS.length], y: i * ROW + ROW / 2 }));
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const my = (a.y + b.y) / 2;
    d += ` C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
  }
  const nodes = pts
    .map((p, i) => {
      const L = ch.first + i;
      const clear = save.journey.clears[`L${L}`];
      // 'open': behind the next level but never played (the one-animal levels for a save that moved up in D35).
      const state = clear ? 'done' : L === next ? 'current' : L < next ? 'open' : 'locked';
      const stars = clear?.stars ?? 0;
      // A board already in progress keeps the spec it was issued under (an old 9×9 save resumes as that 9×9).
      const saved = state === 'current' ? savedFor({ kind: 'level', level: L }) : null;
      const spec = saved && hasMeaningfulProgress(saved) ? (saved.specVersion ?? 1) : undefined;
      const size = sizeFor({ kind: 'level', level: L }, spec);
      // The level you play next shows its measured difficulty (one board to grade; the rest only need a size).
      let tier = '';
      if (state === 'current') {
        try {
          tier = capitalize(displayDifficulty(puzzleFor({ kind: 'level', level: L }, spec)));
        } catch {
          tier = '';
        }
      }
      const ms = milestoneOf(L);
      const label =
        state === 'locked'
          ? `Level ${L}, locked`
          : state === 'current'
            ? `Level ${L}, ${size} by ${size}${tier ? `, ${tier}` : ''}, play next`
            : state === 'open'
              ? `Level ${L}, not played yet`
              : `Level ${L}, solved, ${stars} of 3 stars`;
      return `
        <li class="node node--${state}" style="left:${p.x}%;top:${p.y}px">
          <button class="node__btn" data-level="${L}" ${state === 'locked' ? 'disabled' : ''} aria-label="${label}">
            ${state === 'locked' ? ICON.lock : `<span class="node__num">${L}</span>`}
          </button>
          ${state === 'done' ? `<span class="node__stars" aria-hidden="true">${[1, 2, 3].map((s) => (s <= stars ? ICON.star : ICON.starOff)).join('')}</span>` : ''}
          ${state === 'current' ? `<span class="node__tag">${size}×${size}${tier ? ` · ${tier}` : ''}</span>` : ''}
          ${ms ? `<span class="node__ms node__ms--${ms}" title="${ms === 'pet' ? 'A second animal joins the boards' : 'Chapter reward'}" aria-hidden="true">${ms === 'pet' ? ICON.paw : ICON.gift}</span>` : ''}
        </li>`;
    })
    .join('');
  return `
    <div class="journey-path" style="height:${count * ROW}px">
      <svg class="journey-path__line" viewBox="0 0 100 ${count * ROW}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${d}" vector-effect="non-scaling-stroke"/>
      </svg>
      <ol class="journey-path__nodes" aria-label="Chapter ${ch.index + 1} levels">${nodes}</ol>
    </div>`;
}

/** "Truffle is on this board: 3 more puzzles to bring her home." */
function comingLine(id: Parameters<typeof animalInfo>[0], left: number): string {
  const a = animalInfo(id);
  return left === 1 ? `Solve this one to bring ${a.name} the ${a.noun} home` : `${a.name} the ${a.noun} is on your boards: ${left} more puzzles to come home`;
}

export const journeyScreen: ScreenDef = {
  tab: 'journey',
  title: 'Pawtopia',
  mount(root, scope, route: CanonicalRoute) {
    if (route.screen === 'journey' && route.view === 'path') mountPath(root, scope, route.chapter);
    else mountHub(root, scope);
  },
};

// ---------------------------------------------------------------------------------------------------- the hub

function mountHub(root: HTMLElement, scope: Scope): void {
  const save = app.save;
  const level = save.journey.nextLevel;
  const chapter = chapterOf(level);
  const saved = resumableMode();
  // Continue is the Journey's: the saved Journey board, else the next level. A saved Daily or Zen gets its own line.
  const resumeLevel: ModeRef | null = saved && saved.kind === 'level' ? saved : null;
  const otherSaved: ModeRef | null = saved && saved.kind !== 'level' && saved.kind !== 'cup' ? saved : null;
  const todayKey = localDateKey();
  const dailyMode = dailyFor(todayKey, level);
  const daily = { dateKey: todayKey, size: sizeFor(dailyMode), solo: dailyMode.kind === 'daily' && dailyMode.rule === 'solo' };
  const dailyDone = !!save.daily.done[daily.dateKey];
  const streak = liveStreak(save, localDateKey());
  const weekday = WEEKDAY[new Date().getDay()];
  const building = activeSanctuary(save);
  const coming = building ? arrivalProgress(save, building) : null;

  const curMode: ModeRef = resumeLevel ?? { kind: 'level', level };
  const curLevel = curMode.kind === 'level' ? curMode.level : level;
  const continueTitle = resumeLevel ? `Resume level ${curLevel}` : `Play level ${level}`;
  // A resumable board keeps the spec it was issued under (an old 9×9 save still shows as 9×9).
  const thumbSpec = resumeLevel ? (save.lastSession?.specVersion ?? 1) : undefined;
  const thumbSize = sizeFor(curMode, thumbSpec);
  const rule = playsSolo(curLevel) ? 'One animal' : 'Two animals';

  const el = h(`
    <div class="journey">
      <header class="home-head">
        <h1 class="wordmark" data-autofocus>Pawtopia</h1>
        <div class="screen-head__end">
          ${coinPill()}
          <button class="icon-btn" data-act="journal" aria-label="Journal: stats and badges">${ICON.star}</button>
          <button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button>
        </div>
      </header>

      ${goalCardMarkup()}

      <section class="continue card" aria-labelledby="continue-title">
        <div class="continue__info">
          <p class="continue__eyebrow">${resumeLevel ? 'Journey · board in progress' : esc(`Journey · Chapter ${chapter.index + 1}: ${chapter.name}`)}</p>
          <h2 id="continue-title">Level ${curLevel}</h2>
          <p class="muted" data-board-desc>${thumbSize}×${thumbSize} · ${rule}${resumeLevel ? ' · saved where you left it' : ''}</p>
          ${coming && !resumeLevel ? `<p class="continue__next">${ICON.paw}${esc(comingLine(coming.next.id, coming.left))}</p>` : ''}
        </div>
        <div class="continue__thumb" data-thumb style="--n:${thumbSize}"></div>
        <button class="btn btn--block continue__go" data-act="continue">${esc(continueTitle)}</button>
        ${resumeLevel && curLevel !== level ? `<button class="btn btn--quiet" data-act="journey">Play level ${level} instead</button>` : ''}
        <div class="continue__links">
          <button class="btn btn--quiet" data-act="path">${ICON.pin}Level path</button>
          <button class="btn btn--quiet" data-act="world">${ICON.globe}World map</button>
        </div>
      </section>

      ${
        otherSaved
          ? `<button class="card card--tap resume-other" data-act="resume-other">
          <span class="card__icon">${ICON.resume}</span>
          <span class="card__body"><span class="card__title">${esc(modeTitle(otherSaved))} in progress</span><span class="card__sub">Saved where you left it. Resume it any time.</span></span>
          ${ICON.chevron}
        </button>`
          : ''
      }

      <div class="daily-block">
        <button class="card card--tap daily-card ${dailyDone ? 'is-done' : ''}" data-act="daily">
          <span class="card__icon card__icon--coral">${dailyDone ? ICON.check : ICON.calendar}</span>
          <span class="card__body">
            <span class="card__title">Daily Cozy Puzzle</span>
            <span class="card__sub">${dailyDone ? `Done for today. Back tomorrow for a new board.` : daily.solo ? `${weekday}'s one-animal ${daily.size}×${daily.size}, the same for everyone on one animal` : `${weekday}'s ${daily.size}×${daily.size}, the same board for everyone`}</span>
          </span>
          ${streak > 0 ? `<span class="daily-card__streak" aria-label="${plural(streak, 'day')} streak">${ICON.flame}<b class="num">${streak}</b></span>` : ''}
        </button>
        ${weekStrip()}
      </div>

      <div class="card mini-card zen-card zen-card--wide">
        <span class="card__icon">${ICON.leaf}</span>
        <span class="card__title">Zen Garden</span>
        <span class="card__sub">No clock, no hearts. Pick a size.</span>
        <div class="zen-sizes" role="group" aria-label="Zen board size">
          ${ZEN_SIZES.map((sz) => `<button class="zen-size" data-zen="${sz}" aria-label="Zen ${sz} by ${sz}">${sz}</button>`).join('')}
        </div>
      </div>

      ${controlsNoticeMarkup()}
      ${
        !save.onboarding.seenPantryIntro && save.onboarding.tutorialDone
          ? `<section class="card pantry-intro" data-pantry-intro aria-labelledby="pantry-title">
        <h2 id="pantry-title">New: extra lives and hints</h2>
        <p class="muted">Journey and Daily boards now give you ${CASUAL_HEARTS} hearts. They start fresh on every board.</p>
        <div class="pantry-row">
          <span class="pantry-chip">${ICON.lifePlus}<b class="num">${itemBalance(save, 'life')}</b><small>extra lives: one heart back each</small></span>
          <span class="pantry-chip">${ICON.bulb}<b class="num">${itemBalance(save, 'hint')}</b><small>hints: one hint each</small></span>
        </div>
        <p class="muted">Each board's first hint is free. Earn more by clearing new levels and finishing errands. Zen hints are always free.</p>
        <button class="btn btn--secondary btn--block" data-act="pantry-ok">Got it</button>
      </section>`
          : ''
      }
      <section class="missions card" aria-labelledby="missions-title" data-missions></section>
    </div>`);
  root.appendChild(el);

  // The thumbnail needs the board's regions; build it after first paint so the screen appears instantly.
  scope.timeout(() => {
    try {
      const p = puzzleFor(curMode, thumbSpec);
      const slot = el.querySelector('[data-thumb]');
      if (slot) slot.innerHTML = miniBoard(p.regions);
      const desc = el.querySelector('[data-board-desc]');
      const tier = displayDifficulty(p);
      if (desc) desc.textContent = `${thumbSize}×${thumbSize} · ${capitalize(tier)} · ${rule}${resumeLevel ? ' · saved where you left it' : ''}`;
    } catch {
      /* thumbnail is decorative */
    }
  }, 30);

  const missionsEl = el.querySelector('[data-missions]') as HTMLElement;
  function renderMissions(): void {
    const ms = missionStates(app.save);
    const left = ms.filter((m) => !m.weekly && !m.claimed).length;
    missionsEl.innerHTML = `
      <div class="missions__head"><h2 id="missions-title">Today's errands</h2><span class="muted">${left ? `${left} to go` : 'All done for today'}</span></div>
      <ul class="missions__list">
        ${ms
          .map(
            (m) => `<li class="mission ${m.claimed ? 'is-claimed' : m.done ? 'is-done' : ''}">
              <span class="mission__check" aria-hidden="true">${m.claimed || m.done ? ICON.check : ''}</span>
              <span class="mission__body"><span class="mission__title">${esc(m.def.title)}${m.weekly ? ' <span class="chip">This week</span>' : ''}</span>
              ${m.def.target > 1 && !m.done ? `<span class="muted num">${m.progress} of ${m.def.target}</span>` : ''}</span>
              ${
                m.claimed
                  ? `<span class="mission__reward is-claimed">${ICON.coin}<span class="num">${m.def.coins}</span>${extras(m.def)}</span>`
                  : m.done
                    ? `<button class="btn btn--small" data-claim="${esc(m.key)}">Claim ${ICON.coin}<span class="num">${m.def.coins}</span>${extras(m.def)}</button>`
                    : `<span class="mission__reward">${ICON.coin}<span class="num">${m.def.coins}</span>${extras(m.def)}</span>`
              }
            </li>`,
          )
          .join('')}
      </ul>`;
  }
  renderMissions();

  /** An extra life or hint that comes with an errand's coins. */
  function extras(d: MissionDef): string {
    return `${d.items?.life ? ICON.lifePlus : ''}${d.items?.hint ? ICON.bulb : ''}`;
  }

  // D35 moved an earlier save's levels up by 20: say so once, in plain words.
  const movedTo = app.save.onboarding.ladderNotice ? app.save.journey.nextLevel : 0;
  const movedLine = movedTo
    ? `Pawtopia now opens with twenty one-animal puzzles, so your Journey moved up to make room: you're on level ${movedTo}, with every clear, star and best time. Levels 1 to 20 are new and open whenever you'd like them.`
    : '';
  const caught = app.ladderGift;
  app.ladderGift = null;
  const caughtLine =
    movedTo && caught && (caught.coins || caught.decor.length)
      ? `Your finished chapters were counted under their new numbers: ${[caught.coins ? `+${caught.coins} Paw Coins` : '', ...caught.decor.map((d) => DECOR_BY_ID[d].name)].filter(Boolean).join(', ')}.`
      : '';
  if (movedTo) {
    app.save.onboarding.ladderNotice = false;
    app.persist();
  }

  // Players coming from v1: say what their earlier progress turned into, once.
  const gift = app.upgradeGift;
  if (gift) {
    app.upgradeGift = null;
    const gs = openSheet(scope, {
      title: 'Welcome to Pawtopia',
      center: true,
      body: `<p class="sheet__lead">Cats vs Dogs has grown into Pawtopia. Every level you solved is still solved, and it earned you a head start:</p>
        ${movedLine ? `<p>${esc(movedLine)}</p>` : ''}
        <div class="win-rewards">
          ${gift.coins ? `<div class="reward-coins"><span class="reward-coins__amt">${ICON.coin}<b class="num">+${gift.coins}</b></span><span class="muted">Paw Coins for ${plural(Object.keys(app.save.journey.clears).length, 'solved level')}</span></div>` : ''}
          ${gift.decor.length ? `<p>Chapter gifts: ${esc(gift.decor.map((d) => DECOR_BY_ID[d].name).join(', '))}.</p>` : ''}
        </div>
        <div class="sheet__actions"><button class="btn btn--block" data-act="see">See the sanctuary</button><button class="btn btn--quiet" data-act="later">Later</button></div>`,
    });
    gs.scope.on(gs.el, 'click', (e) => {
      const a = actionOf(e);
      if (!a) return;
      gs.close();
      if (a.act === 'see') app.router.go({ screen: 'sanctuary' });
    });
  } else if (movedLine) {
    const ls = openSheet(scope, {
      title: 'Twenty new levels',
      center: true,
      body: `<p class="sheet__lead">${esc(movedLine)}</p>
        ${caughtLine ? `<p>${esc(caughtLine)}</p>` : ''}
        <div class="sheet__actions"><button class="btn btn--block" data-act="ok">Got it</button></div>`,
    });
    ls.scope.on(ls.el, 'click', (e) => {
      if (actionOf(e)?.act === 'ok') ls.close();
    });
  }

  scope.on(el, 'click', (e) => {
    const t = e.target as HTMLElement;
    const claim = t.closest('[data-claim]') as HTMLElement | null;
    if (claim) {
      const got = claimMissionDetailed(app.save, claim.dataset.claim!);
      const coins = got.coins + got.overflowCoins;
      if (got.coins) {
        app.persist();
        sfx('coin');
        track('mission_claimed', { coins });
        renderMissions();
        const pill = el.querySelector('[data-coins]');
        if (pill) pill.outerHTML = coinPill();
        // Say exactly what arrived (when the pantry is full, the item arrives as coins).
        const more = [got.lives ? `+${plural(got.lives, 'extra life', 'extra lives')}` : '', got.hints ? `+${plural(got.hints, 'hint')}` : ''].filter(Boolean);
        toast([`+${coins} Paw Coins`, ...more].join(' · '));
      }
      return;
    }
    const z = t.closest('[data-zen]') as HTMLElement | null;
    if (z) {
      const size = Number(z.dataset.zen);
      const seed = save.zen.nextSeed;
      save.zen.nextSeed = seed + 1;
      app.persist();
      // Zen follows the Journey: one-animal boards until the second animal has been introduced (D35).
      startGame({ kind: 'zen', size, seed: 7_000_000 + seed * 97 + size, ...(playsSolo(level) ? { rule: 'solo' as const } : {}) });
      return;
    }
    const a = actionOf(e);
    if (!a) return;
    if (handleControlsNotice(a.act, el, scope)) return;
    switch (a.act) {
      case 'pantry-ok':
        app.save.onboarding.seenPantryIntro = true;
        app.persist();
        el.querySelector('[data-pantry-intro]')?.remove();
        break;
      case 'continue':
        if (resumeLevel) {
          if (!resumeGame()) {
            toast("That saved board couldn't be restored, so it starts fresh.");
            startGame(resumeLevel);
          }
        } else playMode({ kind: 'level', level });
        break;
      case 'journey':
      case 'play-next':
        // The one saved board slot would be overwritten: never throw away a board with progress without asking.
        if (resumeLevel && curLevel !== level) confirmDropSaved(scope, curLevel, level, () => playMode({ kind: 'level', level }));
        else playMode({ kind: 'level', level });
        break;
      case 'resume-other':
        if (otherSaved && !resumeGame()) {
          toast("That saved board couldn't be restored.");
          app.router.refresh();
        }
        break;
      case 'daily':
        if (dailyDone) toast(`Today's board is done. A new one arrives tomorrow.`);
        else playMode(dailyMode);
        break;
      case 'path':
        app.router.go({ screen: 'journey', view: 'path' });
        break;
      case 'visit':
        visitSanctuary((t.closest('[data-region]') as HTMLElement | null)?.dataset.region);
        break;
      case 'world':
        app.router.go({ screen: 'world' });
        break;
      case 'settings':
        showSettings(scope, { onClose: () => app.router.refresh() });
        break;
      case 'journal':
        app.router.go({ screen: 'profile' });
        break;
    }
  });
}

/** "Play level N instead" while a Journey board is saved: say what it costs, and let the player keep it. */
function confirmDropSaved(scope: Scope, savedLevel: number, level: number, go: () => void): void {
  const placed = app.save.lastSession?.snap.history?.length ?? 0;
  const sh = openSheet(scope, {
    title: `Start level ${level}?`,
    center: true,
    body: `<p class="sheet__lead">Your level ${savedLevel} board${placed ? ` (${plural(placed, 'move')} so far)` : ''} will be cleared. Only one board is kept at a time.</p>
      <div class="sheet__actions">
        <button class="btn btn--quiet" data-act="keep" data-autofocus>Keep level ${savedLevel}</button>
        <button class="btn btn--block" data-act="go">Start level ${level}</button>
      </div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a) return;
    sh.close();
    if (a.act === 'go') go();
  });
}

// ---------------------------------------------------------------------------------------------------- the level path

function mountPath(root: HTMLElement, scope: Scope, chapterIndex: number | undefined): void {
  const save = app.save;
  const next = save.journey.nextLevel;
  const chapters = visibleChapters(next);
  let current = chapterIndex ?? chapterOf(next).index;
  // The level you're on, with the board it will really open (a saved board keeps its own spec).
  const curMode = { kind: 'level' as const, level: next };
  const curSaved = savedFor(curMode);
  const resumable = !!curSaved && hasMeaningfulProgress(curSaved);
  const curSpec = resumable ? (curSaved!.specVersion ?? 1) : undefined;
  const curSize = sizeFor(curMode, curSpec);
  let goSub = `${curSize}×${curSize}`;
  try {
    goSub += ` · ${capitalize(displayDifficulty(puzzleFor(curMode, curSpec)))}`;
  } catch {
    /* label is decorative */
  }

  const el = h(`
    <div class="play">
      <header class="screen-head">
        <button class="icon-btn" data-act="back" aria-label="Back to Journey">${ICON.back}</button>
        <h1 data-autofocus>Level path</h1>
        <div class="screen-head__end"><span class="muted num">${Object.keys(save.journey.clears).length} solved</span>${coinPill()}</div>
      </header>
      <div class="chapter-tabs" role="tablist" aria-label="Chapters">
        ${chapters.map((c) => `<button role="tab" class="chapter-tab" data-chapter="${c.index}" aria-selected="${c.index === current}">${c.index + 1}</button>`).join('')}
      </div>
      <div data-chapter-body></div>
      <div class="play-go">
        <button class="btn btn--block play-go__btn" data-act="go" aria-describedby="play-go-sub">
          <span class="play-go__label">${resumable ? 'Resume' : 'Play'} level ${next}</span>
          <span class="play-go__sub" id="play-go-sub">${esc(goSub)}</span>
        </button>
      </div>
    </div>`);
  root.appendChild(el);

  const body = el.querySelector('[data-chapter-body]') as HTMLElement;
  function renderChapter(): void {
    const ch = chapterAt(current);
    let solved = 0;
    let stars = 0;
    for (let L = ch.first; L <= ch.last; L++) {
      const c = save.journey.clears[`L${L}`];
      if (c) solved++;
      stars += c?.stars ?? 0;
    }
    const locked = ch.first > next;
    body.innerHTML = `
      <section class="chapter card">
        <div class="chapter__head">
          <div>
            <h3>${esc(ch.name)}</h3>
            <p class="muted">${esc(ch.blurb)}</p>
          </div>
          <span class="chip chip--gold">${ICON.star}<span class="num">${stars}/60</span></span>
        </div>
        <div class="progress" role="progressbar" aria-label="Chapter progress" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${solved}"><span style="width:${(solved / 20) * 100}%"></span></div>
        <p class="chapter__count muted num">${solved} of 20 solved${locked ? `. Opens after level ${ch.first - 1}.` : ''}</p>
      </section>
      ${pathMarkup(ch)}`;
    for (const t of el.querySelectorAll<HTMLElement>('[data-chapter]')) t.setAttribute('aria-selected', String(Number(t.dataset.chapter) === current));
    // Open on the level you're on: centered on screen, above the Play button.
    const cur = body.querySelector('.node--current');
    if (cur) scope.frame(() => cur.scrollIntoView({ block: 'center', behavior: 'auto' }));
  }
  renderChapter();

  scope.on(el, 'click', (e) => {
    const t = e.target as HTMLElement;
    const lv = t.closest('[data-level]') as HTMLButtonElement | null;
    if (lv && !lv.disabled) {
      playMode({ kind: 'level', level: Number(lv.dataset.level) });
      return;
    }
    const ch = t.closest('[data-chapter]') as HTMLElement | null;
    if (ch) {
      current = Number(ch.dataset.chapter);
      renderChapter();
      return;
    }
    const a = actionOf(e);
    if (a?.act === 'go') playMode(curMode);
    else if (a?.act === 'back') app.router.back({ screen: 'journey' });
  });
}
