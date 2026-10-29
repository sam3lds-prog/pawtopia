/**
 * Tricks in a sanctuary (D33): tapping an animal opens a small tray under the scene — "Ask Mochi to…" — with every
 * trick; owned ones play right away, the others open their card (watch a video for tokens, or buy with gems). A trick
 * plays on the scene figure itself with an emote bubble over its head. Under reduced motion only the bubble shows.
 */

import { app } from '../../app/app';
import { canOfferVideo, watchVideoFor } from '../../app/rewarded';
import { TRICK_BY_ID, TRICKS, trickCurrency, type TrickId } from '../../meta/catalogs/tricks';
import { itemBalance } from '../../meta/items';
import { buyTrick, ownsTrick } from '../../meta/tricks';
import { ads } from '../../services/ads';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { iap } from '../../services/iap';
import { trickBadge, trickDir, trickOverlay } from '../art/tricks';
import { residentFigure } from '../art/sanctuary';
import { companionFigure } from '../art/companions';
import { isCompanionId } from '../../meta/catalogs/companions';
import { isPetId } from '../../meta/catalogs/pets';
import { esc, plural } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { openSheet, toast } from './sheet';
import { animalName } from './activities';
import { avatarPortrait } from '../screens/leaderboardTab';

const CURRENCY = { vtoken: { icon: () => ICON.videoToken, name: 'video tokens' }, gem: { icon: () => ICON.gem, name: 'gems' } } as const;

/** Plays a trick on a scene figure. Returns false if that figure is already busy with one. */
export function performTrick(svg: SVGSVGElement, fig: SVGGElement, id: TrickId, reducedMotion: boolean): boolean {
  if (fig.dataset.trick || fig.classList.contains('is-away')) return false;
  const t = TRICK_BY_ID[id];
  let box = { x: 0, y: 0, w: 30, h: 30 };
  // The animal's own outline: the hidden heart above its head would lift the emote bubble too high.
  const hearts = [...fig.querySelectorAll<SVGElement>('.sp-heart')];
  hearts.forEach((h) => (h.style.display = 'none'));
  try {
    const b = fig.getBBox();
    box = { x: b.x, y: b.y, w: b.width, h: b.height };
  } catch {
    /* not rendered (tests) */
  }
  hearts.forEach((h) => (h.style.display = ''));
  const width = svg.viewBox?.baseVal?.width || Infinity;
  svg.insertAdjacentHTML('beforeend', trickOverlay(id, t.emote, box, width));
  const overlay = svg.lastElementChild;
  fig.dataset.trick = id;
  fig.style.setProperty('--trick-dir', String(trickDir(box, width)));
  if (!reducedMotion) fig.classList.add(`is-trick-${id}`);
  window.setTimeout(() => {
    overlay?.remove();
    fig.classList.remove(`is-trick-${id}`);
    fig.style.removeProperty('--trick-dir');
    delete fig.dataset.trick;
  }, reducedMotion ? Math.max(1800, t.ms) : t.ms);
  return true;
}

function priceTag(id: TrickId): string {
  const t = TRICK_BY_ID[id];
  const cur = trickCurrency(t);
  if (!cur) return '<span class="trick-chip__price">Free</span>';
  const short = itemBalance(app.save, cur) < t.price;
  return `<span class="trick-chip__price price price--${cur} ${short ? 'is-short' : ''}">${CURRENCY[cur].icon()}<span class="num">${t.price}</span></span>`;
}

/** The trick buttons: owned first, then video, then premium. */
export function trickChips(): string {
  return TRICKS.map((t) => {
    const owned = ownsTrick(app.save, t.id);
    const label = owned ? t.name : `${t.name}, ${t.price} ${CURRENCY[trickCurrency(t)!].name}`;
    return `<li><button class="trick-chip ${owned ? '' : 'is-locked'} trick-chip--${t.tier}" data-trick="${t.id}" aria-label="${esc(label)}">
      ${trickBadge(t.emote)}<span class="trick-chip__name">${esc(t.name)}</span>${owned ? '' : priceTag(t.id)}
    </button></li>`;
  }).join('');
}

export interface TrickTray {
  /** Opens the tray for an animal in the scene (by its figure). */
  open(fig: SVGGElement): void;
  close(): void;
  refresh(): void;
}

/** Mounts the tray into `host` (a slot under the scene). `svg` returns the live scene. */
export function mountTrickTray(scope: Scope, host: HTMLElement, svg: () => SVGSVGElement | null): TrickTray {
  let target: { kind: 'pet' | 'friend'; id: string } | null = null;

  const figure = (): SVGGElement | null => {
    const s = svg();
    if (!s || !target) return null;
    return s.querySelector<SVGGElement>(target.kind === 'pet' ? `.sanctuary__pet[data-pet="${target.id}"]` : `.sanctuary__friend[data-friend="${target.id}"]`);
  };

  function render(): void {
    if (!target) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    const name = animalName(target.id);
    host.hidden = false;
    host.innerHTML = `<div class="trick-tray card" role="group" aria-label="${esc(`Tricks for ${name}`)}">
      <div class="trick-tray__head">
        <span class="trick-tray__pic">${avatarPortrait(target.id)}</span>
        <b>Ask ${esc(name)} to…</b>
        <button class="icon-btn icon-btn--small" data-act="tray-close" aria-label="Close tricks">${ICON.close}</button>
      </div>
      <ul class="trick-tray__list">${trickChips()}</ul>
    </div>`;
  }

  scope.on(host, 'click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-act="tray-close"]')) {
      target = null;
      render();
      return;
    }
    const chip = t.closest('[data-trick]') as HTMLElement | null;
    if (!chip) return;
    const id = chip.dataset.trick as TrickId;
    if (!ownsTrick(app.save, id)) {
      showTrickSheet(scope, id, { who: target?.id, onBought: render });
      return;
    }
    const s = svg();
    const fig = figure();
    if (s && fig && performTrick(s, fig, id, app.reducedMotion)) {
      sfx('place');
      haptic('tap');
      track('trick_played', { trick: id });
    } else if (fig?.classList.contains('is-away')) toast(`${animalName(target!.id)} is busy right now. Ask again in a moment.`);
  });

  return {
    open(fig) {
      const pet = fig.dataset.pet;
      const friend = fig.dataset.friend;
      target = pet ? { kind: 'pet', id: pet } : friend ? { kind: 'friend', id: friend } : null;
      render();
      if (target) host.scrollIntoView?.({ block: 'nearest', behavior: app.reducedMotion ? 'auto' : 'smooth' });
    },
    close() {
      target = null;
      render();
    },
    refresh: render,
  };
}

/** A trick's card: a preview, its price, and how to get it. */
export function showTrickSheet(scope: Scope, id: TrickId, opts: { who?: string; onBought?: () => void } = {}): void {
  const t = TRICK_BY_ID[id];
  const cur = trickCurrency(t);
  const who = opts.who ?? 'mochi';
  const whoName = animalName(who);
  const owned = ownsTrick(app.save, id);

  const body = () => {
    const have = cur ? itemBalance(app.save, cur) : 0;
    const short = cur ? Math.max(0, t.price - have) : 0;
    let actions = '';
    if (owned || ownsTrick(app.save, id)) actions = `<p class="trick-sheet__owned">${ICON.check}Yours. Tap an animal in a sanctuary and ask for it.</p>`;
    else if (cur === 'vtoken')
      actions = short
        ? `<button class="btn btn--block" disabled>${ICON.videoToken}<span class="num">${t.price}</span></button>
           <p class="muted">You have ${plural(have, 'video token')}. Video tokens come only from short reward videos you choose to watch.</p>
           ${ads.available && canOfferVideo() ? `<button class="btn btn--secondary btn--block" data-act="watch">${ICON.videoToken}Watch a video: +1 token</button>` : ''}`
        : `<button class="btn btn--block" data-act="buy" data-autofocus>Get it for ${ICON.videoToken}<span class="num">${t.price}</span></button>`;
    else if (cur === 'gem')
      actions = short
        ? `<button class="btn btn--block" disabled>${ICON.gem}<span class="num">${t.price}</span></button>
           <p class="muted">You have ${plural(have, 'gem')}. ${iap.available ? 'Gem packs are in the Shop.' : 'Gem packs are coming soon.'}</p>
           ${iap.available ? `<button class="btn btn--secondary btn--block" data-act="gems">${ICON.gem}See gem packs</button>` : ''}`
        : `<button class="btn btn--block" data-act="buy" data-autofocus>Buy for ${ICON.gem}<span class="num">${t.price}</span></button>`;
    return `
      ${t.tier !== 'free' ? `<span class="chip ${t.tier === 'premium' ? 'chip--gem' : 'chip--video'}">${t.tier === 'premium' ? `${ICON.gem}Premium trick` : `${ICON.videoToken}Video-token trick`}</span>` : ''}
      <figure class="trick-sheet__stage sanctuary__scene is-live" aria-label="${esc(`${whoName} showing ${t.name}`)}">
        <svg viewBox="0 0 120 90" role="img"><rect width="120" height="90" rx="14" fill="#e6f2df"/><path d="M0 70 Q60 60 120 70 V76 A14 14 0 0 1 106 90 H14 A14 14 0 0 1 0 76 Z" fill="#cfe3c4"/>${stageFigure(who)}</svg>
      </figure>
      <button class="btn btn--quiet btn--small trick-sheet__again" data-act="preview">${ICON.restart}Show me again</button>
      <p class="sheet__lead">${esc(t.blurb)}</p>
      <div class="sheet__actions">${actions}<button class="btn btn--quiet" data-act="close">Close</button></div>
      <p class="muted trick-sheet__note">Tricks are just for fun. They change nothing in your puzzles.</p>`;
  };

  const sh = openSheet(scope, { title: t.name, className: 'trick-sheet', body: body() });
  const preview = () => {
    const s = sh.el.querySelector<SVGSVGElement>('.trick-sheet__stage svg');
    const fig = s?.querySelector<SVGGElement>('.sanctuary__pet');
    if (s && fig) performTrick(s, fig, id, app.reducedMotion);
  };
  sh.scope.timeout(preview, 350);

  let busy = false;
  sh.scope.on(sh.el, 'click', async (e) => {
    const a = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a || busy) return;
    switch (a.dataset.act) {
      case 'close':
        sh.close();
        break;
      case 'preview':
        preview();
        break;
      case 'gems':
        sh.close();
        app.router.go({ screen: 'shop', tab: 'gems' });
        break;
      case 'watch': {
        busy = true;
        const r = await watchVideoFor('vtoken');
        busy = false;
        if (!sh.scope.alive) return;
        if (r === 'granted') toast('+1 video token', ICON.videoToken);
        else toast(r === 'cap' ? "That's all the videos for today. More tomorrow." : 'No video is available right now. Try again in a little while.');
        rerender();
        break;
      }
      case 'buy': {
        busy = true;
        const r = buyTrick(app.save, id);
        busy = false;
        if (r === 'ok') {
          app.persist();
          sfx('coin');
          haptic('success');
          track('trick_bought', { trick: id, tier: t.tier, amount: t.price });
          toast(`${t.name} learned! Tap an animal in a sanctuary to ask for it.`);
          opts.onBought?.();
          rerender();
          preview();
        } else toast(r === 'insufficient' ? `Not enough ${cur ? CURRENCY[cur].name : 'tokens'} yet.` : 'Already yours.');
        break;
      }
    }
  });

  /** Re-renders the actions only (after a video or a purchase), keeping the preview stage in place. */
  function rerender(): void {
    const tmp = document.createElement('div');
    tmp.innerHTML = body();
    const next = tmp.querySelector('.sheet__actions');
    const now = sh.el.querySelector('.sheet__actions');
    if (next && now) now.replaceWith(next);
  }
}

/** A preview figure on the little stage in the trick card (a scene figure, so the trick plays on it). */
function stageFigure(id: string): string {
  if (isPetId(id)) return residentFigure(id, 60, 74, 38, 'happy');
  if (isCompanionId(id)) return companionFigure(id, 60, 74, 36, 'happy');
  return residentFigure('mochi', 60, 74, 38, 'happy');
}
