/** Journal: personal stats, best times and badges. Everything here is the player's own, kept on this device. */

import { app } from '../../app/app';
import { ACHIEVEMENTS } from '../../meta/achievements';
import { fmtClock } from '../../game/dates';
import { liveStreak } from '../../meta/progression';
import { ITEM_CAP, itemBalance, pawPoints, rankFor } from '../../meta/items';
import { esc, h } from '../dom';
import { ICON } from '../icons';
import type { ScreenDef } from '../router';

export const profileScreen: ScreenDef = {
  tab: 'home',
  title: 'Journal',
  mount(root, scope) {
    const s = app.save;
    const unlocked = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
    const sizes = [5, 6, 7, 8, 9];
    const pts = pawPoints(s);
    const rank = rankFor(pts);
    const nextName = rank.next !== null ? rankFor(rank.next).name : null;
    const pct = rank.next !== null ? Math.round(((pts - rank.from) / (rank.next - rank.from)) * 100) : 100;
    const el = h(`
      <div class="journal">
        <header class="screen-head">
          <button class="icon-btn" data-act="back" aria-label="Back to Home">${ICON.back}</button>
          <h1 data-autofocus>Journal</h1>
        </header>
        <section class="card rank-card" aria-labelledby="rank-h">
          <div class="rank-card__head">
            <h3 id="rank-h">Paw Rank</h3>
            <span class="muted num">${pts.toLocaleString()} Paw Points</span>
          </div>
          <span class="rank-card__name">${esc(rank.name)}</span>
          <span class="rank-bar" role="progressbar" aria-label="Progress to the next Paw Rank" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></span>
          <p class="muted">${nextName ? `${(rank.next! - pts).toLocaleString()} points to ${esc(nextName)}. ` : ''}Points come from first clears (more for harder boards) and clean or hint-free solves. They only measure your own progress.</p>
          <div class="pantry-row">
            <span class="pantry-chip">${ICON.treat}<b class="num">${itemBalance(s, 'treat')}</b><small>of ${ITEM_CAP.treat} treats<br>+1 heart each</small></span>
            <span class="pantry-chip">${ICON.ticket}<b class="num">${itemBalance(s, 'hint')}</b><small>of ${ITEM_CAP.hint} hint tickets</small></span>
          </div>
        </section>
        <section class="card">
          <h3>Your puzzles</h3>
          <div class="stats stats--grid">
            <div class="stat"><div class="stat__v num">${s.stats.solved}</div><div class="stat__k">boards solved</div></div>
            <div class="stat"><div class="stat__v num">${s.stats.clean}</div><div class="stat__k">clean solves</div></div>
            <div class="stat"><div class="stat__v num">${s.stats.hintFree}</div><div class="stat__k">without hints</div></div>
            <div class="stat"><div class="stat__v num">${s.journey.nextLevel - 1}</div><div class="stat__k">Journey levels</div></div>
            <div class="stat"><div class="stat__v num">${liveStreak(s)}</div><div class="stat__k">day streak</div></div>
            <div class="stat"><div class="stat__v num">${s.daily.bestStreak}</div><div class="stat__k">best streak</div></div>
          </div>
        </section>
        <section class="card">
          <h3>Best times</h3>
          <ul class="best-times">
            ${sizes
              .map((n) => {
                const t = s.stats.bestBySize[String(n)];
                return `<li><span class="best-times__size">${n}×${n}</span><span class="num">${t !== undefined ? fmtClock(t) : '—'}</span></li>`;
              })
              .join('')}
          </ul>
        </section>
        <section aria-labelledby="badges-h">
          <div class="section-head"><h2 id="badges-h">Badges</h2><span class="muted num">${unlocked} of ${ACHIEVEMENTS.length}</span></div>
          <ul class="badge-grid">
            ${ACHIEVEMENTS.map((a) => {
              const got = !!s.achievements[a.id];
              const [cur, target] = a.progress(s);
              return `<li class="badge ${got ? 'is-got' : ''}">
                <span class="badge__icon" aria-hidden="true">${ICON[a.icon]}</span>
                <span class="badge__body">
                  <b>${esc(a.name)}</b>
                  <small>${esc(a.description)}</small>
                  ${got ? `<small class="badge__done">${ICON.check}Earned</small>` : `<span class="progress" role="progressbar" aria-label="${esc(a.name)} progress" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${cur}"><span style="width:${(cur / target) * 100}%"></span></span>`}
                </span>
              </li>`;
            }).join('')}
          </ul>
        </section>
      </div>`);
    root.appendChild(el);
    scope.on(el, 'click', (e) => {
      if ((e.target as HTMLElement).closest('[data-act="back"]')) app.router.go({ screen: 'home' });
    });
  },
};
