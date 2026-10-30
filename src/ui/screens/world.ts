/**
 * World: a map of every sanctuary (D35). The Farm and the Pet Garden are open from the start; each exotic region opens
 * at a Journey level. Whichever one you build grows with the puzzles you solve, and its animals come home one by one
 * (the one on its way is the animal on your boards). The map shows where each one is and how far along it is; the
 * cards below say what's next. Nothing here is for sale: puzzles are what grow a sanctuary.
 */

import { app } from '../../app/app';
import { playMode } from '../../app/gameFlow';
import { SANCTUARIES, SANCTUARY_BY_ID, isRegionId, type RegionId, type SanctuaryDef } from '../../meta/catalogs/sanctuaries';
import { activeSanctuary, arrivalProgress, isComplete, isOpen, nextStage, nextToOpen, progressOf, stageOf } from '../../meta/world';
import { animalInfo, homeAnimals } from '../../meta/animals';
import { animalPortrait } from '../art/animals';
import { regionThumb } from '../art/regions';
import { pinPercent, worldMapSvg } from '../art/worldMap';
import { esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { ScreenDef } from '../router';
import { walletPills } from '../components/wallet';
import { sceneMarkup } from './sanctuary';

const short = (d: SanctuaryDef) => d.short;

type Status = 'building' | 'open' | 'complete' | 'locked';

function statusOf(id: SanctuaryDef['id']): Status {
  if (!isOpen(app.save, id)) return 'locked';
  if (isComplete(app.save, id)) return 'complete';
  return activeSanctuary(app.save) === id ? 'building' : 'open';
}

function statusLine(def: SanctuaryDef): string {
  const st = statusOf(def.id);
  const cleared = app.save.journey.nextLevel - 1;
  if (st === 'locked') return `Opens after level ${def.opensAfterLevel} · ${plural(def.opensAfterLevel - cleared, 'level')} to go`;
  if (st === 'complete') return 'Complete · every friend has a home';
  const coming = arrivalProgress(app.save, def.id);
  const paused = st === 'building' ? '' : 'Paused · ';
  if (coming) return `${paused}${animalInfo(coming.next.id).name} comes home in ${plural(coming.left, 'puzzle')}`;
  const next = nextStage(app.save, def.id);
  return next ? `${paused}${plural(next.need - next.have, 'puzzle')} to ${next.stage.name.toLowerCase()}` : `${paused}Almost complete`;
}

/** The friend who stands for a sanctuary on its map pin: the first one home there, if any. */
function pinFace(def: SanctuaryDef): string {
  if (statusOf(def.id) === 'locked') return ICON.lock;
  const first = homeAnimals(app.save, def.id)[0];
  return first ? animalPortrait(first, 'happy') : def.beginner ? ICON.home : ICON.sprout;
}

function pinLabel(def: SanctuaryDef): string {
  const st = statusOf(def.id);
  const pct = `, ${Math.round(progressOf(app.save, def.id) * 100)}% grown`;
  return `${def.name}, ${def.place}. ${statusLine(def)}${st === 'locked' ? '' : pct}`;
}

export const worldScreen: ScreenDef = {
  tab: 'world',
  title: 'World',
  mount(root, scope) {
    const save = app.save;
    const building = activeSanctuary(save);
    const upcoming = nextToOpen(save);
    const openCount = SANCTUARIES.filter((d) => isOpen(save, d.id)).length;
    const level = save.journey.nextLevel;

    const pins = SANCTUARIES.map((d) => {
      const p = pinPercent(d.lon, d.lat);
      const st = statusOf(d.id);
      const prog = progressOf(save, d.id);
      return `<button class="world-pin is-${st}" data-go="${d.id}" style="left:${p.left.toFixed(2)}%;top:${p.top.toFixed(2)}%;--accent:${d.accent};--p:${prog.toFixed(3)}" aria-label="${esc(pinLabel(d))}">
        <span class="world-pin__ring" aria-hidden="true"><span class="world-pin__face">${pinFace(d)}</span></span>
        <span class="world-pin__label" aria-hidden="true">${esc(short(d))}</span>
      </button>`;
    }).join('');

    let focus = '';
    if (building) {
      const def = SANCTUARY_BY_ID[building];
      const coming = arrivalProgress(save, building);
      const next = nextStage(save, building);
      const bar = (have: number, from: number, need: number, label: string) =>
        `<div class="progress world-progress" role="progressbar" aria-label="${esc(label)}" aria-valuemin="${from}" aria-valuemax="${need}" aria-valuenow="${have}"><span style="width:${Math.round(((have - from) / Math.max(1, need - from)) * 100)}%"></span></div>`;
      const body = coming
        ? (() => {
            const a = animalInfo(coming.next.id);
            return `<div class="coming-home"><span class="coming-home__art portrait is-shy">${animalPortrait(coming.next.id, 'idle')}</span><span class="coming-home__body"><span><b>${esc(a.name)} the ${esc(a.noun)}</b> is on your boards: ${plural(coming.left, 'more puzzle')} to come home.</span>${bar(coming.have, coming.from, coming.need, `${a.name} coming home`)}</span></div>`;
          })()
        : next
          ? `<p class="muted">Next: <b>${esc(next.stage.name)}</b>. ${esc(next.stage.change)}.</p>${bar(next.have, next.from, next.need, `Progress to ${next.stage.name}`)}`
          : '';
      focus = `<section class="card world-focus" style="--accent:${def.accent}" aria-labelledby="focus-title">
        <p class="world-focus__eyebrow">${ICON.sprout}Building now</p>
        <h2 id="focus-title">${esc(def.name)}</h2>
        ${def.stages.length ? `<p class="muted">Stage ${stageOf(save, building)} of ${def.stages.length - 1}</p>` : ''}
        ${body}
        <p class="world-focus__count">Every puzzle you solve helps (Paw Cup aside)</p>
        <div class="world-focus__actions">
          <button class="btn" data-act="play">Play level ${level}</button>
          <button class="btn btn--secondary" data-go="${building}">Visit</button>
        </div>
      </section>`;
    } else if (!openCount && upcoming) {
      const pct = Math.round(((level - 1) / upcoming.def.opensAfterLevel) * 100);
      focus = `<section class="card world-focus" style="--accent:${upcoming.def.accent}" aria-labelledby="focus-title">
        <p class="world-focus__eyebrow">${ICON.pin}Your first journey</p>
        <h2 id="focus-title">${esc(upcoming.def.name)}</h2>
        <p class="muted">${esc(upcoming.def.blurb)}</p>
        <div class="progress world-progress" role="progressbar" aria-label="Levels until it opens" aria-valuemin="0" aria-valuemax="${upcoming.def.opensAfterLevel}" aria-valuenow="${level - 1}"><span style="width:${pct}%"></span></div>
        <p class="world-focus__count">Opens after level ${upcoming.def.opensAfterLevel} · ${plural(upcoming.left, 'level')} to go</p>
        <div class="world-focus__actions"><button class="btn" data-act="play">Play level ${level}</button></div>
      </section>`;
    } else if (upcoming) {
      focus = `<section class="card world-focus" style="--accent:${upcoming.def.accent}" aria-labelledby="focus-title">
        <p class="world-focus__eyebrow">${ICON.pin}Next on the map</p>
        <h2 id="focus-title">${esc(upcoming.def.name)}</h2>
        <p class="muted">Every open sanctuary is complete. The ${esc(short(upcoming.def))} opens after level ${upcoming.def.opensAfterLevel} (${plural(upcoming.left, 'level')} to go).</p>
        <div class="world-focus__actions"><button class="btn" data-act="play">Play level ${level}</button></div>
      </section>`;
    } else {
      focus = `<section class="card world-focus" aria-labelledby="focus-title"><p class="world-focus__eyebrow">${ICON.sparkle}All done</p><h2 id="focus-title">Every sanctuary is thriving</h2><p class="muted">Thank you for building homes all around the world.</p></section>`;
    }

    const cards = SANCTUARIES.map((d) => {
      const st = statusOf(d.id);
      const art = isRegionId(d.id) ? regionThumb(d.id, stageOf(save, d.id), `wt-${d.id}`) : sceneMarkup(`wt-${d.id}`);
      const prog = st === 'locked' ? (level - 1) / Math.max(1, d.opensAfterLevel) : progressOf(save, d.id);
      const have = homeAnimals(save, d.id).length;
      return `<li><button class="world-card card card--tap is-${st}" data-go="${d.id}" style="--accent:${d.accent}" aria-label="${esc(pinLabel(d))}">
        <span class="world-card__thumb"><svg viewBox="0 40 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art}</svg>${st === 'locked' ? `<span class="world-card__lock"><span>${ICON.lock}</span></span>` : ''}</span>
        <span class="world-card__body">
          <span class="world-card__name">${esc(d.name)}</span>
          <span class="world-card__place">${esc(d.place)}</span>
          <span class="world-card__status">${st === 'building' ? `<span class="chip chip--brand">${ICON.sprout}Building</span>` : ''}${esc(statusLine(d))}</span>
          <span class="progress world-card__bar"><span style="width:${Math.round(Math.min(1, prog) * 100)}%"></span></span>
          ${st !== 'locked' ? `<span class="world-card__friends">${have} of ${d.arrivals.length} animals home</span>` : ''}
        </span>
        ${ICON.chevron}
      </button></li>`;
    }).join('');

    const el = h(`
      <div class="world">
        <header class="screen-head">
          <h1 data-autofocus>World</h1>
          <div class="screen-head__end">${walletPills()}</div>
        </header>
        <p class="muted world__lead">Solve puzzles to build sanctuaries for animals around the world.</p>
        <div class="world-map card">
          ${worldMapSvg(SANCTUARY_BY_ID.harmony)}
          ${pins}
        </div>
        ${focus}
        <section aria-labelledby="sanct-title">
          <div class="section-head"><h2 id="sanct-title">Sanctuaries</h2><span class="muted num">${openCount} of ${SANCTUARIES.length} open</span></div>
          <ul class="world-list">${cards}</ul>
        </section>
        <button class="btn btn--secondary btn--block" data-act="album">${ICON.paw}Animal album</button>
      </div>`);
    root.appendChild(el);

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      const go = t.closest('[data-go]') as HTMLElement | null;
      if (go) {
        const id = go.dataset.go!;
        if (isRegionId(id)) app.router.go({ screen: 'region', id: id as RegionId });
        else app.router.go({ screen: 'sanctuary' });
        return;
      }
      const a = t.closest('[data-act]') as HTMLElement | null;
      if (!a) return;
      if (a.dataset.act === 'play') playMode({ kind: 'level', level: app.save.journey.nextLevel });
      else if (a.dataset.act === 'album') app.router.go({ screen: 'pets' });
    });
  },
};
