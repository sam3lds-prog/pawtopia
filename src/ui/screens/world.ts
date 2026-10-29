/**
 * World: a map of every sanctuary. Harmony is home; each regional sanctuary opens at a Journey level and grows with the
 * puzzles you solve while you build it. The map shows where each one is and how far along it is; the cards below say
 * what's next. Nothing here is for sale: puzzles are what grow a sanctuary.
 */

import { app } from '../../app/app';
import { playMode } from '../../app/gameFlow';
import { COMPANIONS } from '../../meta/catalogs/companions';
import { REGIONS, SANCTUARIES, SANCTUARY_BY_ID, type RegionId, type SanctuaryDef } from '../../meta/catalogs/sanctuaries';
import { activeRegion, isComplete, isOpen, nextStage, nextToOpen, openRegions, progressOf, stageOf } from '../../meta/world';
import { companionSvg } from '../art/companions';
import { regionThumb } from '../art/regions';
import { pinPercent, worldMapSvg } from '../art/worldMap';
import { esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { ScreenDef } from '../router';
import { walletPills } from '../components/wallet';
import { sceneMarkup } from './sanctuary';

const short = (d: SanctuaryDef) => d.name.replace(/ Sanctuary$/, '');

type Status = 'home' | 'building' | 'open' | 'complete' | 'locked';

function statusOf(id: SanctuaryDef['id']): Status {
  if (id === 'harmony') return 'home';
  const r = id as RegionId;
  if (!isOpen(app.save, r)) return 'locked';
  if (isComplete(app.save, r)) return 'complete';
  return activeRegion(app.save) === r ? 'building' : 'open';
}

function statusLine(def: SanctuaryDef): string {
  const st = statusOf(def.id);
  const cleared = app.save.journey.nextLevel - 1;
  if (st === 'home') return 'Your home garden';
  if (st === 'locked') return `Opens after level ${def.opensAfterLevel} · ${plural(def.opensAfterLevel - cleared, 'level')} to go`;
  const r = def.id as RegionId;
  if (st === 'complete') return 'Complete · every friend has a home';
  const next = nextStage(app.save, r)!;
  return `${st === 'building' ? '' : 'Paused · '}${plural(next.need - next.have, 'puzzle')} to ${next.stage.name.toLowerCase()}`;
}

/** The friend who stands for a sanctuary on its map pin: the first one welcomed there, if any. */
function pinFace(def: SanctuaryDef): string {
  if (def.id === 'harmony') return ICON.home;
  if (statusOf(def.id) === 'locked') return ICON.lock;
  const c = COMPANIONS.find((x) => x.sanctuary === def.id && app.save.inventory.companions[x.id]);
  return c ? companionSvg(c.id, 'happy') : ICON.sprout;
}

function pinLabel(def: SanctuaryDef): string {
  const st = statusOf(def.id);
  const pct = def.id === 'harmony' ? '' : `, ${Math.round(progressOf(app.save, def.id as RegionId) * 100)}% grown`;
  return `${def.name}, ${def.place}. ${statusLine(def)}${st === 'locked' ? '' : pct}`;
}

export const worldScreen: ScreenDef = {
  tab: 'world',
  title: 'World',
  mount(root, scope) {
    const save = app.save;
    const building = activeRegion(save);
    const upcoming = nextToOpen(save);
    const open = openRegions(save);
    const level = save.journey.nextLevel;

    const pins = SANCTUARIES.map((d) => {
      const p = pinPercent(d.lon, d.lat);
      const st = statusOf(d.id);
      const prog = d.id === 'harmony' ? 1 : progressOf(save, d.id as RegionId);
      return `<button class="world-pin is-${st}" data-go="${d.id}" style="left:${p.left.toFixed(2)}%;top:${p.top.toFixed(2)}%;--accent:${d.accent};--p:${prog.toFixed(3)}" aria-label="${esc(pinLabel(d))}">
        <span class="world-pin__ring" aria-hidden="true"><span class="world-pin__face">${pinFace(d)}</span></span>
        <span class="world-pin__label" aria-hidden="true">${esc(short(d))}</span>
      </button>`;
    }).join('');

    let focus = '';
    if (building) {
      const def = SANCTUARY_BY_ID[building];
      const next = nextStage(save, building)!;
      const pct = Math.round(((next.have - next.from) / (next.need - next.from)) * 100);
      focus = `<section class="card world-focus" style="--accent:${def.accent}" aria-labelledby="focus-title">
        <p class="world-focus__eyebrow">${ICON.sprout}Building now</p>
        <h2 id="focus-title">${esc(def.name)}</h2>
        <p class="muted">Stage ${stageOf(save, building)} of 4 · next: <b>${esc(next.stage.name)}</b>. ${esc(next.stage.change)}.</p>
        <div class="progress world-progress" role="progressbar" aria-label="Progress to ${esc(next.stage.name)}" aria-valuemin="${next.from}" aria-valuemax="${next.need}" aria-valuenow="${next.have}"><span style="width:${pct}%"></span></div>
        <p class="world-focus__count"><span class="num">${next.have - next.from}</span> of <span class="num">${next.need - next.from}</span> puzzles · every puzzle you solve helps (Paw Cup aside)</p>
        <div class="world-focus__actions">
          <button class="btn" data-act="play">Play level ${level}</button>
          <button class="btn btn--secondary" data-go="${building}">Visit</button>
        </div>
      </section>`;
    } else if (!open.length && upcoming) {
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
      const stage = d.id === 'harmony' ? 0 : stageOf(save, d.id as RegionId);
      const art = d.id === 'harmony' ? sceneMarkup(`wt-${d.id}`) : regionThumb(d.id as RegionId, stage, `wt-${d.id}`);
      const prog = d.id === 'harmony' ? null : st === 'locked' ? (level - 1) / d.opensAfterLevel : progressOf(save, d.id as RegionId);
      const friends = COMPANIONS.filter((c) => c.sanctuary === d.id);
      const have = friends.filter((c) => save.inventory.companions[c.id]).length;
      return `<li><button class="world-card card card--tap is-${st}" data-go="${d.id}" style="--accent:${d.accent}" aria-label="${esc(pinLabel(d))}">
        <span class="world-card__thumb"><svg viewBox="0 40 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art}</svg>${st === 'locked' ? `<span class="world-card__lock"><span>${ICON.lock}</span></span>` : ''}</span>
        <span class="world-card__body">
          <span class="world-card__name">${esc(d.name)}</span>
          <span class="world-card__place">${esc(d.place)}</span>
          <span class="world-card__status">${st === 'building' ? `<span class="chip chip--brand">${ICON.sprout}Building</span>` : ''}${esc(statusLine(d))}</span>
          ${prog === null ? `<span class="world-card__friends">${plural(have, 'wildlife friend')} · and your cats and dogs</span>` : `<span class="progress world-card__bar"><span style="width:${Math.round(Math.min(1, prog) * 100)}%"></span></span>`}
          ${d.id !== 'harmony' && st !== 'locked' ? `<span class="world-card__friends">${have} of ${friends.length} animals welcomed</span>` : ''}
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
          <div class="section-head"><h2 id="sanct-title">Sanctuaries</h2><span class="muted num">${open.length + 1} of ${REGIONS.length + 1} open</span></div>
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
        if (id === 'harmony') app.router.go({ screen: 'sanctuary' });
        else app.router.go({ screen: 'region', id: id as RegionId });
        return;
      }
      const a = t.closest('[data-act]') as HTMLElement | null;
      if (!a) return;
      if (a.dataset.act === 'play') playMode({ kind: 'level', level: app.save.journey.nextLevel });
      else if (a.dataset.act === 'album') app.router.go({ screen: 'pets' });
    });
  },
};
