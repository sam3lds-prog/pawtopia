/**
 * Shop, in four tabs:
 *  - **Decor**: everyday decorations for Paw Coins (earned by solving), special ones for video tokens (earned only by
 *    choosing to watch a reward video), premium ones for gems (bought on the App Store).
 *  - **Food**: food for Paw Coins, special treats for video tokens. Fed to animals from their cards.
 *  - **Tricks**: two free, everyday ones for video tokens, the most animated ones for gems (D33).
 *  - **Gems**: gem packs with store prices, honestly "coming soon" until a store is connected.
 * Nothing here changes puzzles or rankings; there are no countdowns, fake discounts or random packs.
 */

import { app } from '../../app/app';
import { DECOR, DECOR_BY_ID, decorHome, decorTier, type DecorId, type DecorTier } from '../../meta/catalogs/decor';
import { FOODS, FOOD_BY_ID, foodsOf, type FoodId } from '../../meta/catalogs/foods';
import { chapterAt } from '../../meta/chapters';
import { buyDecor, decorPrice, decorUnlocked, owns, walletBalance } from '../../meta/sanctuary';
import { SANCTUARIES, SANCTUARY_BY_ID, isRegionId, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { activeSanctuary, isOpen } from '../../meta/world';
import { buyFood, foodCount, FOOD_CAP_EACH } from '../../meta/feeding';
import { grantGemPurchase, isGemPack } from '../../meta/gems';
import { track } from '../../services/analytics';
import { afterDecorChange } from '../../app/events';
import { canOfferVideo, videosLeftToday, watchVideoFor } from '../../app/rewarded';
import { sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { GEM_PACKS, iap, PRODUCT_CATALOG, type ProductId, type ProductInfo } from '../../services/iap';
import { ads } from '../../services/ads';
import { decorIcon } from '../art/sanctuary';
import { activityFor } from '../art/activities';
import { foodIcon } from '../art/foods';
import { trickBadge } from '../art/tricks';
import { TRICKS, trickCurrency, type TrickId, type TrickKind, type TrickTier } from '../../meta/catalogs/tricks';
import { ownsTrick } from '../../meta/tricks';
import { showTrickSheet } from '../components/tricks';
import { openSheet, toast } from '../components/sheet';
import { walletPills } from '../components/wallet';
import { actionOf, esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { Scope, ScreenDef } from '../router';

type Tab = 'decor' | 'food' | 'tricks' | 'gems';
const TAB_LABEL: Record<Tab, string> = { decor: 'Decor', food: 'Food', tricks: 'Tricks', gems: 'Gems' };
/** The tab and sanctuary the player last looked at, for this app session. */
let lastTab: Tab = 'decor';
let lastPlace: SanctuaryId | null = null;

const placeShort = (id: SanctuaryId) => SANCTUARY_BY_ID[id].short;
/** Where a decoration's sanctuary is shown: the Pet Garden's screen, or the Farm's or a region's. */
function goSee(id: DecorId): void {
  const home = decorHome(DECOR_BY_ID[id]);
  if (isRegionId(home)) app.router.go({ screen: 'region', id: home });
  else app.router.go({ screen: 'sanctuary' });
}
function whereText(id: DecorId): string {
  const home = decorHome(DECOR_BY_ID[id]);
  return home === 'harmony' ? 'the Pet Garden' : `the ${SANCTUARY_BY_ID[home].name}`;
}

const CURRENCY_ICON = { coins: ICON.coin, vtoken: ICON.videoToken, gem: ICON.gem } as const;
const CURRENCY_NAME = { coins: 'Paw Coins', vtoken: 'video tokens', gem: 'gems' } as const;

export const shopScreen: ScreenDef = {
  tab: 'shop',
  title: 'Shop',
  mount(root, scope, route) {
    const el = h(`<div class="shop"></div>`);
    root.appendChild(el);
    let tab: Tab = lastTab;
    if (route.screen === 'shop' && route.sanctuary) {
      tab = lastTab = 'decor';
      lastPlace = route.sanctuary;
    }
    if (route.screen === 'shop' && route.tab) tab = lastTab = route.tab;
    // The sanctuary you're building comes first, until you pick another.
    let place: SanctuaryId = lastPlace ?? activeSanctuary(app.save) ?? 'farm';
    let products: ProductInfo[] = PRODUCT_CATALOG.map((p) => ({ ...p, price: null }));
    void iap.products().then((ps) => {
      if (!scope.alive) return;
      products = ps;
      if (tab === 'gems') render();
    });

    function priceTag(currency: 'coins' | 'vtoken' | 'gem', amount: number): string {
      const short = walletBalance(app.save, currency) < amount;
      return `<span class="price price--${currency} ${short ? 'is-short' : ''}">${CURRENCY_ICON[currency]}<span class="num">${amount}</span></span>`;
    }

    function decorCard(id: DecorId): string {
      const d = DECOR_BY_ID[id];
      const have = owns(app.save, id);
      const price = decorPrice(id);
      let action: string;
      const locked = !have && !decorUnlocked(app.save, id);
      if (have) action = `<span class="shop-card__state">${ICON.check}Owned</span>`;
      else if (locked) action = `<span class="shop-card__state">${ICON.lock}Level ${SANCTUARY_BY_ID[decorHome(d)].opensAfterLevel}</span>`;
      else if (d.unlock.kind === 'chapter')
        action = `<span class="shop-card__state shop-card__state--gift">${ICON.gift}Finish ${esc(chapterAt(d.unlock.chapter - 1).name)}</span>`;
      else action = price ? priceTag(price.currency, price.amount) : '';
      const label = have
        ? `${d.name}, owned`
        : locked
          ? `${d.name}, opens with the ${SANCTUARY_BY_ID[decorHome(d)].name}`
          : d.unlock.kind === 'chapter'
            ? `${d.name}, chapter gift`
            : price
              ? `${d.name}, ${price.amount} ${CURRENCY_NAME[price.currency]}`
              : d.name;
      return `<li><button class="shop-card card card--tap ${have ? 'is-owned' : ''} ${locked ? 'is-locked' : ''} shop-card--${decorTier(d)}" data-decor="${id}" aria-label="${esc(label)}">
        <span class="shop-card__art">${decorIcon(id)}</span>
        <span class="shop-card__name">${esc(d.name)}</span>
        ${action}
      </button></li>`;
    }

    function decorSection(tier: DecorTier | 'everyday', title: string, note: string, extra = ''): string {
      const items = DECOR.filter(
        (d) => decorHome(d) === place && (tier === 'everyday' ? decorTier(d) === 'coins' || decorTier(d) === 'gift' : decorTier(d) === tier),
      );
      if (!items.length) return '';
      const owned = items.filter((d) => owns(app.save, d.id)).length;
      return `<section class="shop-section shop-section--${tier}">
        <div class="section-head"><h2>${esc(title)}</h2><span class="muted num">${owned} of ${items.length} owned</span></div>
        <p class="muted shop__note">${note}</p>
        ${extra}
        <ul class="shop-grid">${items.map((d) => decorCard(d.id)).join('')}</ul>
      </section>`;
    }

    function videoTokenCard(): string {
      if (!ads.available) return `<p class="notice">${ICON.info}Video tokens come from short reward videos, which this version doesn't show yet.</p>`;
      const left = videosLeftToday(app.save);
      return `<div class="earn-card card">
        <span class="earn-card__icon">${ICON.videoToken}</span>
        <span class="earn-card__body"><b>Earn a video token</b><small>${left ? `Watch a short video when you like. ${plural(left, 'video')} left today.` : 'That’s all the videos for today. More tomorrow.'}</small></span>
        <button class="btn btn--small" data-act="watch-token" ${left && canOfferVideo() ? '' : 'disabled'}>Watch</button>
      </div>`;
    }

    function placeChips(): string {
      return `<div class="place-chips" role="tablist" aria-label="Which sanctuary">${SANCTUARIES.map((sd) => {
        const open = isOpen(app.save, sd.id);
        return `<button role="tab" class="place-chip ${open ? '' : 'is-locked'}" data-place="${sd.id}" aria-selected="${sd.id === place}" style="--accent:${sd.accent}">${open ? '' : ICON.lock}${esc(placeShort(sd.id))}</button>`;
      }).join('')}</div>`;
    }

    function decorTab(): string {
      const regionLocked = !isOpen(app.save, place);
      return `
        ${placeChips()}
        ${regionLocked ? `<p class="notice">${ICON.lock}The ${esc(SANCTUARY_BY_ID[place].name)} opens after level ${SANCTUARY_BY_ID[place].opensAfterLevel}. Its decorations can be bought once it opens.</p>` : ''}
        ${decorSection('everyday', `${placeShort(place)} decor`, 'Paid for with Paw Coins, which you earn by solving puzzles.')}
        ${decorSection('video', 'Special decor', 'Only for video tokens.', videoTokenCard())}
        ${decorSection('premium', 'Premium decor', `For gems. ${iap.available ? '' : 'Gem packs are coming soon.'}`)}`;
    }

    function foodCard(id: FoodId): string {
      const f = FOOD_BY_ID[id];
      const have = foodCount(app.save, id);
      const currency = f.coins ? 'coins' : 'vtoken';
      const amount = (f.coins ?? f.tokens)!;
      return `<li><button class="shop-card card card--tap food-card" data-food="${id}" aria-label="${esc(`${f.name}, ${amount} ${CURRENCY_NAME[currency]}, ${have} in your pantry`)}">
        <span class="shop-card__art food-card__art">${foodIcon(id)}${have ? `<span class="food-card__have num">×${have}</span>` : ''}</span>
        <span class="shop-card__name">${esc(f.name)}</span>
        ${priceTag(currency, amount)}
      </button></li>`;
    }

    function foodTab(): string {
      // Each sanctuary has its own treats (D35); the special ones are loved everywhere.
      const everyday = foodsOf(place).filter((f) => f.coins);
      const special = FOODS.filter((f) => f.tokens);
      return `
        ${placeChips()}
        <section class="shop-section">
          <div class="section-head"><h2>${esc(placeShort(place))} treats</h2></div>
          <p class="muted shop__note">Feed animals from their cards. Favorites count double.</p>
          ${everyday.length ? `<ul class="shop-grid">${everyday.map((f) => foodCard(f.id)).join('')}</ul>` : `<p class="empty">The animals here love the special treats below.</p>`}
        </section>
        <section class="shop-section shop-section--video">
          <div class="section-head"><h2>Special treats</h2></div>
          <p class="muted shop__note">Only for video tokens. Every animal loves them.</p>
          ${videoTokenCard()}
          <ul class="shop-grid">${special.map((f) => foodCard(f.id)).join('')}</ul>
        </section>`;
    }

    function trickCard(id: TrickId): string {
      const t = TRICKS.find((x) => x.id === id)!;
      const have = ownsTrick(app.save, id);
      const cur = trickCurrency(t);
      const state = have ? `<span class="shop-card__state">${ICON.check}${t.tier === 'free' ? 'Free' : 'Yours'}</span>` : cur ? priceTag(cur, t.price) : '';
      const label = have ? `${t.name}, yours` : `${t.name}, ${t.price} ${cur ? CURRENCY_NAME[cur] : ''}`;
      return `<li><button class="shop-card card card--tap trick-card ${have ? 'is-owned' : ''} shop-card--${t.tier === 'premium' ? 'premium' : t.tier === 'video' ? 'video' : 'coins'}" data-trick-card="${id}" aria-label="${esc(label)}">
        <span class="shop-card__art trick-card__art">${trickBadge(t.emote)}</span>
        <span class="shop-card__name">${esc(t.name)}</span>
        ${state}
      </button></li>`;
    }

    function trickSection(kind: TrickKind, tier: TrickTier, title: string, note: string, extra = ''): string {
      const items = TRICKS.filter((t) => t.kind === kind && t.tier === tier);
      const owned = items.filter((t) => ownsTrick(app.save, t.id)).length;
      return `<section class="shop-section shop-section--${tier === 'free' ? 'everyday' : tier}">
        <div class="section-head"><h2>${esc(title)}</h2>${tier === 'free' ? '' : `<span class="muted num">${owned} of ${items.length} learned</span>`}</div>
        <p class="muted shop__note">${note}</p>
        ${extra}
        <ul class="shop-grid">${items.map((t) => trickCard(t.id)).join('')}</ul>
      </section>`;
    }

    function tricksTab(): string {
      return `
        <p class="muted shop__note">In a sanctuary, tap an animal (or the Tricks button) and ask for a trick or an emote. They are just for fun: they change nothing in your puzzles.</p>
        ${videoTokenCard()}
        <h2 class="shop__group">Tricks</h2>
        ${trickSection('trick', 'free', 'Everyone knows', 'Every resident and wildlife friend can do these.')}
        ${trickSection('trick', 'video', 'Video-token tricks', 'Only for video tokens.')}
        ${trickSection('trick', 'premium', 'Premium tricks', `The most animated tricks, for gems. ${iap.available ? '' : 'Gem packs are coming soon.'}`)}
        <h2 class="shop__group">Emotes</h2>
        ${trickSection('emote', 'free', 'Everyone feels', 'Heart eyes and giggles, free for everyone.')}
        ${trickSection('emote', 'video', 'Video-token emotes', 'Only for video tokens.')}
        ${trickSection('emote', 'premium', 'Premium emotes', `The most fun ones, with props, for gems. ${iap.available ? '' : 'Gem packs are coming soon.'}`)}`;
    }

    function gemsTab(): string {
      const packs = products.filter((p) => isGemPack(p.id));
      const removeAds = products.find((p) => p.id === 'remove_ads');
      const status = iap.available
        ? iap.isStub
          ? `<p class="notice notice--dev">${ICON.info}Test store: nothing is charged, and test gems never carry into a release build.</p>`
          : ''
        : `<p class="notice">${ICON.info}Gem packs are coming soon. Everything else in Pawtopia is earned by playing.</p>`;
      return `
        <section class="shop-section">
          <div class="section-head"><h2>Gems</h2><span class="muted num">${ICON.gem}${walletBalance(app.save, 'gem')}</span></div>
          <p class="muted shop__note">Gems buy premium decorations and tricks. They never buy hearts, hints or anything that helps win.</p>
          ${status}
          <ul class="gem-packs">
            ${packs
              .map(
                (p) => `<li class="gem-pack card">
                  <span class="gem-pack__art" aria-hidden="true">${ICON.gem.repeat(p.id === 'gems_60' ? 1 : p.id === 'gems_160' ? 2 : 3)}</span>
                  <span class="gem-pack__body"><b>${esc(p.title)}</b><small>${GEM_PACKS[p.id as keyof typeof GEM_PACKS]} gems</small></span>
                  ${iap.available && p.price ? `<button class="btn btn--small" data-buy="${p.id}">${esc(p.price)}</button>` : `<span class="chip chip--preview">Coming soon</span>`}
                </li>`,
              )
              .join('')}
          </ul>
        </section>
        ${
          iap.available
            ? `<section class="shop-section">
                <ul class="rows">
                  ${removeAds && app.save.purchases.owned.remove_ads ? `<li class="row"><span class="row__label">${esc(removeAds.title)}<small>Owned. Thank you!</small></span></li>` : ''}
                </ul>
                <button class="btn btn--quiet" data-act="restore">Restore purchases</button>
              </section>`
            : ''
        }`;
    }

    function render(): void {
      el.innerHTML = `
        <header class="screen-head">
          <h1 data-autofocus>Shop</h1>
          <div class="screen-head__end">${walletPills()}</div>
        </header>
        <div class="seg" role="tablist" aria-label="Shop sections">
          ${(['decor', 'food', 'tricks', 'gems'] as Tab[])
            .map(
              (t) => `<button role="tab" class="seg__btn" data-tab="${t}" aria-selected="${t === tab}">${t === 'gems' ? ICON.gem : ''}${TAB_LABEL[t]}</button>`,
            )
            .join('')}
        </div>
        <div class="shop__body">${tab === 'decor' ? decorTab() : tab === 'food' ? foodTab() : tab === 'tricks' ? tricksTab() : gemsTab()}</div>`;
    }
    render();

    scope.on(el, 'click', async (e) => {
      const t = e.target as HTMLElement;
      const pc = t.closest('[data-place]') as HTMLElement | null;
      if (pc) {
        place = lastPlace = pc.dataset.place as SanctuaryId;
        render();
        (el.querySelector(`[data-place="${place}"]`) as HTMLElement | null)?.focus();
        return;
      }
      const tb = t.closest('[data-tab]') as HTMLElement | null;
      if (tb && tb.closest('.seg')) {
        tab = lastTab = tb.dataset.tab as Tab;
        render();
        return;
      }
      const card = t.closest('[data-decor]') as HTMLElement | null;
      if (card) {
        decorSheet(scope, card.dataset.decor as DecorId, render);
        return;
      }
      const fc = t.closest('[data-food]') as HTMLElement | null;
      if (fc) {
        foodSheet(scope, fc.dataset.food as FoodId, render);
        return;
      }
      const tc = t.closest('[data-trick-card]') as HTMLElement | null;
      if (tc) {
        showTrickSheet(scope, tc.dataset.trickCard as TrickId, { onBought: render });
        return;
      }
      const buy = t.closest('[data-buy]') as HTMLButtonElement | null;
      if (buy && !buy.disabled) {
        const id = buy.dataset.buy as ProductId;
        track('iap_started', { product: id });
        buy.disabled = true;
        const r = await iap.purchase(id);
        if (r.ok) {
          // Granted by transaction id, once, even if the player already left the shop.
          const gems = grantGemPurchase(app.save, r.id, r.transactionId, r.source === 'store' ? 'store' : 'test');
          if (r.id === 'remove_ads') {
            app.save.purchases.owned.remove_ads = { source: r.source, at: new Date().toISOString() };
            app.save.purchases.removeAds = { active: true, source: r.source, verifiedAt: new Date().toISOString() };
          }
          app.persist();
          track('iap_success', { product: id });
          toast(gems ? `+${gems} gems. Thank you for supporting Pawtopia!` : 'Thank you for supporting Pawtopia!', ICON.gem);
        } else {
          track('iap_failed', { product: id, reason: r.reason });
          if (r.reason !== 'cancelled') toast('The purchase did not go through. You were not charged.');
        }
        if (scope.alive) render();
        return;
      }
      const a = actionOf(e);
      if (a?.act === 'watch-token') {
        const b = t.closest('button') as HTMLButtonElement;
        b.disabled = true;
        const r = await watchVideoFor('vtoken');
        if (r === 'granted') toast('+1 video token', ICON.videoToken);
        else toast(r === 'cap' ? "That's all the videos for today. More tomorrow." : 'No video is available right now. Try again in a little while.');
        if (scope.alive) render();
      } else if (a?.act === 'restore') {
        const r = await iap.restore();
        if (!scope.alive) return;
        if (r.ok && r.source) {
          for (const id of r.owned) app.save.purchases.owned[id] = { source: r.source, at: new Date().toISOString() };
          if (r.owned.includes('remove_ads')) app.save.purchases.removeAds = { active: true, source: r.source, verifiedAt: new Date().toISOString() };
          const gems = await app.reconcilePurchases();
          app.persist();
          toast(r.owned.length || gems ? 'Purchases restored.' : 'No purchases to restore.');
          render();
        } else toast('The store is not available right now.');
      }
    });
  },
};

function decorSheet(scope: Scope, id: DecorId, rerender: () => void): void {
  const d = DECOR_BY_ID[id];
  const have = owns(app.save, id);
  const price = decorPrice(id);
  const tier = decorTier(d);
  let actions: string;
  if (have) actions = `<button class="btn btn--block" data-act="visit">See it in ${esc(whereText(id))}</button>`;
  else if (!decorUnlocked(app.save, id)) {
    const sd = SANCTUARY_BY_ID[decorHome(d)];
    actions = `<p class="muted">For the ${esc(sd.name)}, which opens after level ${sd.opensAfterLevel}. You can buy it once it opens.</p>`;
  } else if (d.unlock.kind === 'chapter')
    actions = `<p class="muted">A gift for finishing ${esc(chapterAt(d.unlock.chapter - 1).name)} (level ${d.unlock.chapter * 20}).</p>`;
  else if (price) {
    const short = price.amount - walletBalance(app.save, price.currency);
    const how =
      price.currency === 'coins'
        ? 'Solving a new level earns 35.'
        : price.currency === 'vtoken'
          ? 'Video tokens come from short reward videos, one per video, in the Shop.'
          : iap.available
            ? 'Gem packs are in the Gems tab.'
            : 'Gem packs are coming soon.';
    actions =
      short > 0
        ? `<button class="btn btn--block" disabled>${CURRENCY_ICON[price.currency]}<span class="num">${price.amount}</span></button><p class="muted">You need ${short} more ${CURRENCY_NAME[price.currency]}. ${how}</p>`
        : `<button class="btn btn--block" data-act="buy" data-autofocus>Buy for ${CURRENCY_ICON[price.currency]}<span class="num">${price.amount}</span></button>`;
  } else actions = '';
  const sh = openSheet(scope, {
    title: d.name,
    className: 'decor-sheet',
    body: `
      ${tier === 'video' || tier === 'premium' ? `<span class="chip ${tier === 'premium' ? 'chip--gem' : 'chip--video'}">${tier === 'premium' ? `${ICON.gem}Premium` : `${ICON.videoToken}Special`}</span>` : ''}
      <div class="decor-sheet__art">${decorIcon(id, d.name)}</div>
      <p class="sheet__lead">${esc(d.blurb)}</p>
      ${activityFor(id) ? `<p class="decor-sheet__play">${ICON.sparkle}<span><b>${esc(activityFor(id)!.name)}.</b> Your animals take turns with it, and you can tap it in the sanctuary to start one.</span></p>` : ''}
      <div class="sheet__actions">${actions}<button class="btn btn--quiet" data-act="close">Not now</button></div>`,
  });
  let busy = false;
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a || busy) return;
    if (a.act === 'close') sh.close();
    else if (a.act === 'visit') {
      sh.close();
      goSee(id);
    } else if (a.act === 'buy') {
      busy = true;
      const r = buyDecor(app.save, id);
      if (r === 'ok') {
        const news = afterDecorChange();
        app.persist();
        sfx('coin');
        haptic('success');
        track('decor_bought', { item: id, tier, amount: price?.amount ?? 0 });
        sh.close();
        rerender();
        toast(
          news.achievements.length ? `${d.name} is in ${whereText(id)}. Badge unlocked: ${news.achievements[0].name}!` : `${d.name} is in ${whereText(id)}.`,
        );
      } else {
        busy = false;
        toast(
          r === 'insufficient'
            ? `Not enough ${price ? CURRENCY_NAME[price.currency] : 'coins'} yet.`
            : r === 'owned'
              ? 'Already yours.'
              : r === 'locked'
                ? 'That sanctuary has not opened yet.'
                : 'This one is a chapter gift.',
        );
      }
    }
  });
}

function foodSheet(scope: Scope, id: FoodId, rerender: () => void): void {
  const f = FOOD_BY_ID[id];
  const currency = f.coins ? 'coins' : 'vtoken';
  const amount = (f.coins ?? f.tokens)!;
  const favs = f.favorites === 'all' ? 'Everyone' : f.favorites.map((k) => KIND_NAME[k] ?? k).join(', ');
  const sh = openSheet(scope, {
    title: f.name,
    className: 'decor-sheet',
    body: `
      <div class="decor-sheet__art food-sheet__art">${foodIcon(id)}</div>
      <p class="sheet__lead">${esc(f.blurb)}</p>
      <dl class="pet-sheet__facts">
        <div><dt>Favorite of</dt><dd>${esc(favs)}</dd></div>
        <div><dt>In your pantry</dt><dd class="num" data-have>${foodCount(app.save, id)} of ${FOOD_CAP_EACH}</dd></div>
      </dl>
      <div class="sheet__actions">
        <button class="btn btn--block" data-act="buy" data-autofocus>Buy one for ${CURRENCY_ICON[currency]}<span class="num">${amount}</span></button>
        <button class="btn btn--quiet" data-act="close">Done</button>
      </div>`,
    onClose: rerender,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a) return;
    if (a.act === 'close') sh.close();
    else if (a.act === 'buy') {
      const r = buyFood(app.save, id);
      if (r === 'ok') {
        app.persist();
        sfx('coin');
        haptic('tap');
        track('food_bought', { food: id });
        const have = sh.el.querySelector('[data-have]');
        if (have) have.textContent = `${foodCount(app.save, id)} of ${FOOD_CAP_EACH}`;
        toast(`${f.name} added to your pantry.`);
      } else toast(r === 'full' ? 'Your pantry is full of these.' : `Not enough ${CURRENCY_NAME[currency]} yet.`);
    }
  });
}

/** Display names for animal kinds on food cards. */
const KIND_NAME: Record<string, string> = {
  cat: 'cats',
  dog: 'dogs',
  fox: 'foxes',
  redpanda: 'red pandas',
  koala: 'koalas',
  kangaroo: 'kangaroos',
  wombat: 'wombats',
  elephant: 'elephants',
  giraffe: 'giraffes',
  meerkat: 'meerkats',
  polarbear: 'polar bears',
  seal: 'seals',
  owl: 'owls',
  sloth: 'sloths',
  capybara: 'capybaras',
  toucan: 'toucans',
};
