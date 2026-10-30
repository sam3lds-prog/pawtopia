/** Play: Daily and Zen up top, then the Journey path for the selected chapter. */

import { app } from '../../app/app';
import { playMode, savedFor, startGame } from '../../app/gameFlow';
import { hasMeaningfulProgress } from '../../game/sessionPersistence';
import { localDateKey } from '../../engine/levels';
import { displayDifficulty } from '../../game/grading';
import { puzzleFor, sizeFor } from '../../game/puzzles';
import { FIRST_PAIR_LEVEL, dailyFor, playsSolo } from '../../game/modes';
import { MAX_NEW_BOARD_SIZE } from '../../game/specs';
import { chapterAt, chapterOf, visibleChapters, type Chapter } from '../../meta/chapters';
import { toast } from '../components/sheet';
import { actionOf, capitalize, esc, h } from '../dom';
import { ICON } from '../icons';
import type { Route, ScreenDef } from '../router';
import { coinPill } from './home';

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

export const playScreen: ScreenDef = {
  tab: 'play',
  title: 'Play',
  mount(root, scope, route: Route) {
    const save = app.save;
    const next = save.journey.nextLevel;
    const chapters = visibleChapters(next);
    let current = route.screen === 'play' && route.chapter !== undefined ? route.chapter : chapterOf(next).index;
    const dailyKey = localDateKey();
    const dailyMode = dailyFor(dailyKey, next);
    const daily = { dateKey: dailyKey, size: sizeFor(dailyMode), solo: dailyMode.kind === 'daily' && dailyMode.rule === 'solo' };
    const dailyDone = !!save.daily.done[daily.dateKey];
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
          <h1 data-autofocus>Play</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <div class="duo">
          <button class="card card--tap mini-card ${dailyDone ? 'is-done' : ''}" data-act="daily">
            <span class="card__icon card__icon--coral">${dailyDone ? ICON.check : ICON.calendar}</span>
            <span class="card__title">Daily</span>
            <span class="card__sub">${dailyDone ? 'Done today' : daily.solo ? `One animal · ${daily.size}×${daily.size}` : `${daily.size}×${daily.size} for everyone`}</span>
          </button>
          <div class="card mini-card zen-card">
            <span class="card__icon">${ICON.leaf}</span>
            <span class="card__title">Zen Garden</span>
            <div class="zen-sizes" role="group" aria-label="Zen board size">
              ${ZEN_SIZES.map((sz) => `<button class="zen-size" data-zen="${sz}" aria-label="Zen ${sz} by ${sz}">${sz}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="section-head"><h2>Journey</h2><span class="muted num">${next - 1} solved</span></div>
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
      const z = t.closest('[data-zen]') as HTMLElement | null;
      if (z) {
        const size = Number(z.dataset.zen);
        const seed = save.zen.nextSeed;
        save.zen.nextSeed = seed + 1;
        app.persist();
        // Zen follows the Journey: one-animal boards until the second animal has been introduced (D35).
        startGame({ kind: 'zen', size, seed: 7_000_000 + seed * 97 + size, ...(playsSolo(next) ? { rule: 'solo' as const } : {}) });
        return;
      }
      const a = actionOf(e);
      if (a?.act === 'go') {
        playMode(curMode);
        return;
      }
      if (a?.act === 'daily') {
        if (dailyDone) toast(`Today's board is done. A new one arrives tomorrow.`);
        else playMode(dailyMode);
      }
    });
  },
};
