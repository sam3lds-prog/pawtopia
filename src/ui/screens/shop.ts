/**
 * Shop. Cosmetics first: sanctuary decor bought with free Paw Coins (earned only by playing). Below it, optional
 * real-money items, which are shown honestly as unavailable until a verified store is connected. No countdowns,
 * no fake discounts, no random packs, and nothing here affects puzzles or rankings.
 */

import { app } from '../../app/app';
import { DECOR, DECOR_BY_ID, type DecorId } from '../../meta/catalogs/decor';
import { chapterAt } from '../../meta/chapters';
import { balance } from '../../meta/ledger';
import { buyDecor, owns } from '../../meta/sanctuary';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { iap, PRODUCT_CATALOG, type ProductId, type ProductInfo } from '../../services/iap';
import { decorIcon } from '../art/sanctuary';
import { openSheet, toast } from '../components/sheet';
import { actionOf, esc, h } from '../dom';
import { ICON } from '../icons';
import type { Scope, ScreenDef } from '../router';
import { coinPill } from './home';

export const shopScreen: ScreenDef = {
  tab: 'shop',
  title: 'Shop',
  mount(root, scope) {
    const el = h(`<div class="shop"></div>`);
    root.appendChild(el);
    let products: ProductInfo[] = PRODUCT_CATALOG.map((p) => ({ ...p, price: null }));
    void iap.products().then((ps) => {
      if (!scope.alive) return;
      products = ps;
      render();
    });

    function decorCard(id: DecorId): string {
      const d = DECOR_BY_ID[id];
      const have = owns(app.save, id);
      const coins = balance(app.save);
      let action: string;
      if (have) action = `<span class="shop-card__state">${ICON.check}Owned</span>`;
      else if (d.unlock.kind === 'chapter') action = `<span class="shop-card__state shop-card__state--gift">${ICON.gift}Finish ${esc(chapterAt(d.unlock.chapter - 1).name)}</span>`;
      else if (d.cost !== null && coins >= d.cost) action = `<span class="price">${ICON.coin}<span class="num">${d.cost}</span></span>`;
      else action = `<span class="price is-short">${ICON.coin}<span class="num">${d.cost}</span></span>`;
      const label = have ? `${d.name}, owned` : d.unlock.kind === 'chapter' ? `${d.name}, chapter gift` : `${d.name}, ${d.cost} Paw Coins`;
      return `<li><button class="shop-card card card--tap ${have ? 'is-owned' : ''}" data-decor="${id}" aria-label="${esc(label)}">
        <span class="shop-card__art">${decorIcon(id)}</span>
        <span class="shop-card__name">${esc(d.name)}</span>
        ${action}
      </button></li>`;
    }

    function render(): void {
      const owned = DECOR.filter((d) => owns(app.save, d.id)).length;
      el.innerHTML = `
        <header class="screen-head">
          <h1 data-autofocus>Shop</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <section aria-labelledby="decor-h">
          <div class="section-head"><h2 id="decor-h">Sanctuary decor</h2><span class="muted num">${owned} of ${DECOR.length} owned</span></div>
          <p class="muted shop__note">Paid for with Paw Coins, which you earn by solving puzzles. Never sold for money.</p>
          <ul class="shop-grid">${DECOR.map((d) => decorCard(d.id)).join('')}</ul>
        </section>
        <section aria-labelledby="support-h" class="shop__support">
          <div class="section-head"><h2 id="support-h">Support Pawtopia</h2></div>
          ${
            iap.available
              ? iap.isStub
                ? `<p class="notice notice--dev">${ICON.info}Development test store. Nothing is charged and test items don't carry into release builds.</p>`
                : ''
              : `<p class="notice">${ICON.info}Purchases aren't connected in this version, so nothing can be bought yet. The game is complete without them.</p>`
          }
          <ul class="rows">
            ${products
              .map(
                (p) => `<li class="row product">
                  <span class="row__label">${esc(p.title)}<small>${esc(p.description)}</small></span>
                  ${
                    iap.available && p.price
                      ? `<button class="btn btn--secondary product__buy" data-buy="${p.id}" ${app.save.purchases.owned[p.id] ? 'disabled' : ''}>${app.save.purchases.owned[p.id] ? 'Owned' : esc(p.price)}</button>`
                      : `<span class="chip chip--preview">Not available</span>`
                  }
                </li>`,
              )
              .join('')}
          </ul>
          ${iap.available ? `<button class="btn btn--quiet" data-act="restore">Restore purchases</button>` : ''}
        </section>`;
    }
    render();

    scope.on(el, 'click', async (e) => {
      const t = e.target as HTMLElement;
      const card = t.closest('[data-decor]') as HTMLElement | null;
      if (card) {
        decorSheet(scope, card.dataset.decor as DecorId, render);
        return;
      }
      const buy = t.closest('[data-buy]') as HTMLButtonElement | null;
      if (buy && !buy.disabled) {
        const id = buy.dataset.buy as ProductId;
        track('iap_started', { product: id });
        buy.disabled = true;
        const r = await iap.purchase(id);
        if (!scope.alive) return;
        if (r.ok) {
          app.save.purchases.owned[id] = { source: r.source, at: new Date().toISOString() };
          if (id === 'remove_ads') app.save.purchases.removeAds = { active: true, source: r.source, verifiedAt: new Date().toISOString() };
          app.persist();
          track('iap_success', { product: id });
          toast('Thank you for supporting Pawtopia!');
        } else {
          track('iap_failed', { product: id, reason: r.reason });
          if (r.reason !== 'cancelled') toast('The purchase did not go through. You were not charged.');
        }
        render();
        return;
      }
      const a = actionOf(e);
      if (a?.act === 'restore') {
        const r = await iap.restore();
        if (!scope.alive) return;
        if (r.ok && r.source) {
          for (const id of r.owned) app.save.purchases.owned[id] = { source: r.source, at: new Date().toISOString() };
          if (r.owned.includes('remove_ads')) app.save.purchases.removeAds = { active: true, source: r.source, verifiedAt: new Date().toISOString() };
          app.persist();
          toast(r.owned.length ? 'Purchases restored.' : 'No purchases to restore.');
          render();
        } else toast('The store is not available right now.');
      }
    });
  },
};

function decorSheet(scope: Scope, id: DecorId, rerender: () => void): void {
  const d = DECOR_BY_ID[id];
  const have = owns(app.save, id);
  const coins = balance(app.save);
  const short = d.cost !== null ? d.cost - coins : 0;
  let actions: string;
  if (have) actions = `<button class="btn btn--block" data-act="visit">See it in the sanctuary</button>`;
  else if (d.unlock.kind === 'chapter') actions = `<p class="muted">A gift for finishing ${esc(chapterAt(d.unlock.chapter - 1).name)} (level ${d.unlock.chapter * 20}).</p>`;
  else if (short > 0) actions = `<button class="btn btn--block" disabled>${ICON.coin}<span class="num">${d.cost}</span></button><p class="muted">You need ${short} more Paw Coins. Solving a new level earns 35.</p>`;
  else actions = `<button class="btn btn--block" data-act="buy" data-autofocus>Buy for ${ICON.coin}<span class="num">${d.cost}</span></button>`;
  const sh = openSheet(scope, {
    title: d.name,
    className: 'decor-sheet',
    body: `
      <div class="decor-sheet__art">${decorIcon(id, d.name)}</div>
      <p class="sheet__lead">${esc(d.blurb)}</p>
      <div class="sheet__actions">${actions}<button class="btn btn--quiet" data-act="close">Not now</button></div>`,
  });
  let busy = false;
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a || busy) return;
    if (a.act === 'close') sh.close();
    else if (a.act === 'visit') {
      sh.close();
      app.router.go({ screen: 'sanctuary' });
    } else if (a.act === 'buy') {
      busy = true;
      const r = buyDecor(app.save, id);
      if (r === 'ok') {
        app.persist();
        sfx('coin');
        haptic('success');
        track('decor_bought', { item: id, cost: d.cost ?? 0 });
        sh.close();
        rerender();
        toast(`${d.name} is in the garden.`);
      } else {
        busy = false;
        toast(r === 'insufficient' ? 'Not enough Paw Coins yet.' : r === 'owned' ? 'Already yours.' : 'This one is a chapter gift.');
      }
    }
  });
}
