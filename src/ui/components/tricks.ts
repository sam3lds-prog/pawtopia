/**
 * Tricks in a sanctuary (D33): tapping an animal (or the scene's Tricks button) opens a small tray under the scene —
 * "Ask Mochi to…" — with every trick and everyone who can do one; owned tricks play right away, the others open their
 * card (watch a video for tokens, or buy with gems). A trick plays on the scene figure itself with an emote bubble
 * beside its head (`trickPlay.ts`). Under reduced motion only the bubble shows.
 */

import { app } from '../../app/app';
import { canOfferVideo, watchVideoFor } from '../../app/rewarded';
import { TRICK_BY_ID, TRICKS, trickCurrency, type TrickId, type TrickKind } from '../../meta/catalogs/tricks';
import { itemBalance } from '../../meta/items';
import { buyTrick, ownsTrick } from '../../meta/tricks';
import { ads } from '../../services/ads';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { iap } from '../../services/iap';
import { trickBadge } from '../art/tricks';
import { performTrick } from './trickPlay';
import { residentFigure } from '../art/sanctuary';
import { companionFigure } from '../art/companions';
import { isCompanionId } from '../../meta/catalogs/companions';
import { isPetId } from '../../meta/catalogs/pets';
import { esc, plural } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { openSheet, toast } from './sheet';
import { createScene3D } from './scene3d';
import { animalName } from './activities';
import { avatarPortrait } from '../screens/leaderboardTab';

const CURRENCY = { vtoken: { icon: () => ICON.videoToken, name: 'video tokens' }, gem: { icon: () => ICON.gem, name: 'gems' } } as const;

export { performTrick };

function priceTag(id: TrickId): string {
  const t = TRICK_BY_ID[id];
  const cur = trickCurrency(t);
  if (!cur) return '<span class="trick-chip__price">Free</span>';
  const short = itemBalance(app.save, cur) < t.price;
  return `<span class="trick-chip__price price price--${cur} ${short ? 'is-short' : ''}">${CURRENCY[cur].icon()}<span class="num">${t.price}</span></span>`;
}

function chipLabel(id: TrickId): string {
  const t = TRICK_BY_ID[id];
  return ownsTrick(app.save, id) ? t.name : `${t.name}, ${t.price} ${CURRENCY[trickCurrency(t)!].name}`;
}

function chipInner(id: TrickId): string {
  const t = TRICK_BY_ID[id];
  const owned = ownsTrick(app.save, id);
  return `${trickBadge(t.emote)}<span class="trick-chip__name">${esc(t.name)}</span>${owned ? '' : priceTag(id)}`;
}

function chipClass(id: TrickId): string {
  const t = TRICK_BY_ID[id];
  return `trick-chip ${ownsTrick(app.save, id) ? '' : 'is-locked'} trick-chip--${t.tier}`;
}

/** The trick (or emote) buttons, in catalog order: free, then video, then premium. */
export function trickChips(kind: TrickKind = 'trick'): string {
  return TRICKS.filter((t) => t.kind === kind).map((t) => `<li><button class="${chipClass(t.id)}" data-trick="${t.id}" aria-label="${esc(chipLabel(t.id))}">${chipInner(t.id)}</button></li>`).join('');
}

/** Updates the chips in place (after a purchase), so focus and scroll stay where they are. */
function updateChips(root: ParentNode): void {
  for (const b of root.querySelectorAll<HTMLElement>('.trick-chip[data-trick]')) {
    const id = b.dataset.trick as TrickId;
    b.className = chipClass(id);
    b.setAttribute('aria-label', chipLabel(id));
    b.innerHTML = chipInner(id);
  }
}

type Who = { kind: 'pet' | 'friend'; id: string };
const whoKey = (w: Who) => `${w.kind}:${w.id}`;

export interface TrickTray {
  /** Opens the tray for an animal in the scene (by its figure). */
  open(fig: SVGGElement): void;
  /** Opens the tray for an animal by id (or the first one in the scene); `focus` moves focus into it. */
  openFor(id?: string, focus?: boolean): void;
  close(): void;
  refresh(): void;
  readonly isOpen: boolean;
}

export interface TrickTrayOptions {
  /** Where focus goes when the tray closes from inside (its close button). */
  returnFocus?: () => HTMLElement | null;
  /** Told when the tray opens or closes (to keep a toggle button's aria-expanded right). */
  onToggle?: (open: boolean) => void;
}

/**
 * Mounts the tray into `host` (a slot under the scene). `svg` returns the live scene. Anyone in the scene can be
 * picked from the tray itself, so it works without tapping the scene (keyboard, screen readers).
 */
export function mountTrickTray(scope: Scope, host: HTMLElement, svg: () => SVGSVGElement | null, opts: TrickTrayOptions = {}): TrickTray {
  let target: Who | null = null;
  let tab: TrickKind = 'trick';
  host.id ||= `trick-tray-${Math.random().toString(36).slice(2, 8)}`;

  const cast = (): Who[] => {
    const s = svg();
    if (!s) return [];
    return [
      ...[...s.querySelectorAll<SVGGElement>('.sanctuary__pet[data-pet]')].map((g) => ({ kind: 'pet' as const, id: g.dataset.pet! })),
      ...[...s.querySelectorAll<SVGGElement>('.sanctuary__friend[data-friend]')].map((g) => ({ kind: 'friend' as const, id: g.dataset.friend! })),
    ];
  };

  const figure = (): SVGGElement | null => {
    const s = svg();
    if (!s || !target) return null;
    return s.querySelector<SVGGElement>(target.kind === 'pet' ? `.sanctuary__pet[data-pet="${target.id}"]` : `.sanctuary__friend[data-friend="${target.id}"]`);
  };

  function setTarget(w: Who | null): void {
    const was = !!target;
    target = w;
    render();
    if (was !== !!target) opts.onToggle?.(!!target);
  }

  function render(): void {
    const everyone = cast();
    // Whoever the tray was for may have left the scene (a re-render): fall back to someone who's there.
    if (target && !everyone.some((w) => whoKey(w) === whoKey(target!))) target = everyone[0] ?? null;
    if (!target) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    const name = animalName(target.id);
    host.hidden = false;
    host.innerHTML = `<div class="trick-tray card" role="group" aria-label="${esc(`Tricks for ${name}`)}">
      <div class="trick-tray__head">
        ${everyone.length > 1 ? '' : `<span class="trick-tray__pic">${avatarPortrait(target.id)}</span>`}
        <b>Ask ${esc(name)} to…</b>
        <button class="icon-btn icon-btn--small" data-act="tray-close" aria-label="Close tricks">${ICON.close}</button>
      </div>
      <div class="seg seg--small trick-tray__tabs" role="tablist" aria-label="Tricks or emotes">
        ${(['trick', 'emote'] as const).map((k) => `<button role="tab" class="seg__btn" data-tray-tab="${k}" aria-selected="${k === tab}">${k === 'trick' ? 'Tricks' : 'Emotes'}</button>`).join('')}
      </div>
      ${
        everyone.length > 1
          ? `<div class="trick-tray__who" role="group" aria-label="Who does the trick">${everyone
              .map((w) => `<button class="trick-who" data-who="${whoKey(w)}" aria-pressed="${whoKey(w) === whoKey(target!)}" aria-label="${esc(animalName(w.id))}">${avatarPortrait(w.id)}</button>`)
              .join('')}</div>`
          : ''
      }
      <ul class="trick-tray__list" role="tabpanel" aria-label="${tab === 'trick' ? 'Tricks' : 'Emotes'}">${trickChips(tab)}</ul>
      <p class="sr-only" aria-live="polite" data-tray-status></p>
    </div>`;
  }

  scope.on(host, 'click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-act="tray-close"]')) {
      setTarget(null);
      opts.returnFocus?.()?.focus({ preventScroll: true });
      return;
    }
    const tb = t.closest('[data-tray-tab]') as HTMLElement | null;
    if (tb) {
      tab = tb.dataset.trayTab as TrickKind;
      render();
      host.querySelector<HTMLElement>(`[data-tray-tab="${tab}"]`)?.focus({ preventScroll: true });
      return;
    }
    const who = t.closest('[data-who]') as HTMLElement | null;
    if (who) {
      const [kind, id] = who.dataset.who!.split(':') as ['pet' | 'friend', string];
      setTarget({ kind, id });
      host.querySelector<HTMLElement>(`[data-who="${kind}:${id}"]`)?.focus({ preventScroll: true });
      return;
    }
    const chip = t.closest('[data-trick]') as HTMLElement | null;
    if (!chip || !target) return;
    const id = chip.dataset.trick as TrickId;
    if (!ownsTrick(app.save, id)) {
      showTrickSheet(scope, id, { who: target.id, onBought: () => updateChips(host) });
      return;
    }
    const s = svg();
    const fig = figure();
    const status = host.querySelector('[data-tray-status]');
    const name = animalName(target.id);
    if (s && fig && performTrick(s, fig, id, app.reducedMotion)) {
      sfx('place');
      haptic('tap');
      track('trick_played', { trick: id });
      if (status) status.textContent = `${name}: ${TRICK_BY_ID[id].name}!`;
    } else if (fig) {
      const msg = fig.classList.contains('is-away') ? `${name} is busy right now. Ask again in a moment.` : `${name} is still finishing a trick.`;
      if (fig.classList.contains('is-away')) toast(msg);
      if (status) status.textContent = msg;
    }
  });

  return {
    open(fig) {
      const pet = fig.dataset.pet;
      const friend = fig.dataset.friend;
      setTarget(pet ? { kind: 'pet', id: pet } : friend ? { kind: 'friend', id: friend } : null);
      if (target) host.scrollIntoView?.({ block: 'nearest', behavior: app.reducedMotion ? 'auto' : 'smooth' });
    },
    openFor(id, focus = false) {
      const everyone = cast();
      setTarget(everyone.find((w) => w.id === id) ?? everyone[0] ?? null);
      if (!target) return;
      host.scrollIntoView?.({ block: 'nearest', behavior: app.reducedMotion ? 'auto' : 'smooth' });
      if (focus) host.querySelector<HTMLElement>('.trick-chip')?.focus({ preventScroll: true });
    },
    close() {
      setTarget(null);
    },
    refresh: render,
    get isOpen() {
      return !!target;
    },
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
    if (owned || ownsTrick(app.save, id)) actions = `<p class="trick-sheet__owned">${ICON.check}Yours. In a sanctuary, tap an animal or Tricks and ask for it.</p>`;
    else if (cur === 'vtoken')
      actions = short
        ? `<button class="btn btn--block" disabled aria-label="${esc(`Costs ${t.price} video tokens`)}">${ICON.videoToken}<span class="num">${t.price}</span></button>
           <p class="muted">You have ${plural(have, 'video token')}. Video tokens come only from short reward videos you choose to watch.</p>
           ${ads.available && canOfferVideo() ? `<button class="btn btn--secondary btn--block" data-act="watch">${ICON.videoToken}Watch a video: +1 token</button>` : ''}`
        : `<button class="btn btn--block" data-act="buy" data-autofocus>Get it for ${ICON.videoToken}<span class="num">${t.price}</span></button>`;
    else if (cur === 'gem')
      actions = short
        ? `<button class="btn btn--block" disabled aria-label="${esc(`Costs ${t.price} gems`)}">${ICON.gem}<span class="num">${t.price}</span></button>
           <p class="muted">You have ${plural(have, 'gem')}. ${iap.available ? 'Gem packs are in the Shop.' : 'Gem packs are coming soon.'}</p>
           ${iap.available ? `<button class="btn btn--secondary btn--block" data-act="gems">${ICON.gem}See gem packs</button>` : ''}`
        : `<button class="btn btn--block" data-act="buy" data-autofocus>Buy for ${ICON.gem}<span class="num">${t.price}</span></button>`;
    return `
      ${t.tier !== 'free' ? `<span class="chip ${t.tier === 'premium' ? 'chip--gem' : 'chip--video'}">${t.tier === 'premium' ? `${ICON.gem}Premium ${t.kind}` : `${ICON.videoToken}Video-token ${t.kind}`}</span>` : ''}
      <figure class="trick-sheet__stage sanctuary__scene is-live" aria-label="${esc(`${whoName} showing ${t.name}`)}">
        <svg viewBox="0 0 120 104" role="img"><rect width="120" height="104" rx="14" fill="#e6f2df"/><path d="M0 84 Q60 74 120 84 V90 A14 14 0 0 1 106 104 H14 A14 14 0 0 1 0 90 Z" fill="#cfe3c4"/>${stageFigure(who)}</svg>
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
  // The preview animal is a 3D toy too (D34), when the sanctuary's are.
  const s3d = createScene3D();
  sh.scope.onDispose(() => s3d.dispose());
  s3d.attach(sh.el.querySelector<HTMLElement>('.trick-sheet__stage'), sh.el.querySelector<SVGSVGElement>('.trick-sheet__stage svg'));
  let first = false;
  const firstPreview = () => {
    if (first || !sh.scope.alive) return;
    first = true;
    preview();
  };
  void s3d.ready.then(() => sh.scope.timeout(firstPreview, 250));
  sh.scope.timeout(firstPreview, 1500);

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
          toast(`${t.name} learned! Ask for it in any sanctuary.`);
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
  if (isPetId(id)) return residentFigure(id, 60, 90, 34, 'happy');
  if (isCompanionId(id)) return companionFigure(id, 60, 90, 32, 'happy');
  return residentFigure('mochi', 60, 90, 34, 'happy');
}
