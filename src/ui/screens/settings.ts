/** Settings sheet: play, comfort & accessibility, purchases, data. */

import { app } from '../../app/app';
import { resetProgress, type Settings } from '../../services/storage';
import { ITEM_CAP, grantStarterItems } from '../../meta/items';
import { setPantry, skipToLevel } from '../../app/qaTools';
import { iap } from '../../services/iap';
import { ads } from '../../services/ads';
import { track } from '../../services/analytics';
import { leaderboard } from '../../services/leaderboard';
import { openSheet, toast } from '../components/sheet';
import { actionOf, esc } from '../dom';
import type { Scope } from '../router';
import { featureFlags } from '../../config/featureFlags';
import { showRules } from './rules';
import { ICON } from '../icons';

type BoolKey = 'autoMark' | 'showTimer' | 'largeBoard' | 'sound' | 'haptics' | 'highContrast' | 'regionPatterns' | 'leftHanded';

function sw(key: BoolKey, label: string, help = ''): string {
  const on = app.settings[key];
  return `<button class="row" role="switch" aria-checked="${on}" data-switch="${key}">
      <span class="row__label">${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}</span>
      <span class="switch" aria-checked="${on}" aria-hidden="true"></span>
    </button>`;
}

function choice<K extends keyof Settings>(key: K, label: string, opts: Array<[Settings[K], string]>, help = ''): string {
  return `<div class="row row--choice">
      <span class="row__label" id="lbl-${String(key)}">${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}</span>
      <span class="choice" role="group" aria-labelledby="lbl-${String(key)}">
        ${opts.map(([v, l]) => `<button data-choice="${String(key)}" data-value="${String(v)}" aria-pressed="${app.settings[key] === v}">${esc(l)}</button>`).join('')}
      </span>
    </div>`;
}

/** A short picture of what one tap does under each control scheme. */
function controlsPreview(c: Settings['controls']): string {
  const step = (icon: string, label: string) => `<span class="cp-step">${icon}<small>${esc(label)}</small></span>`;
  const arrow = `<span class="cp-arrow" aria-hidden="true">→</span>`;
  if (c === 'classic')
    return `<span class="cp-steps" aria-label="Tap cycle: each tap goes empty, then cross, then your pet, then empty">${step(ICON.mark, '1st tap: ✕')}${arrow}${step(ICON.paw, '2nd: pet')}${arrow}${step(ICON.erase, '3rd: clear')}</span>`;
  return `<span class="cp-steps" aria-label="Quick place: pick Cat, Dog or Empty, then one tap places it">${step(ICON.paw, 'Pick Cat or Dog')}${arrow}${step(ICON.check, 'One tap places')}${arrow}${step(ICON.mark, 'Empty marks ✕')}</span>`;
}

export interface SettingsOptions {
  inGame?: boolean;
  onClose?: () => void;
}

export function showSettings(scope: Scope, opts: SettingsOptions = {}): void {
  let changed = false;
  const ra = app.save.purchases.removeAds;
  const purchaseState = app.removeAds
    ? `<p class="muted">Ad-free is active${ra.source === 'legacy-v1' ? ' (carried over from the previous version; it will be confirmed with the App Store once purchases are connected)' : ra.source === 'dev' ? ' (development test purchase)' : ''}.</p>`
    : '';
  const sh = openSheet(scope, {
    title: 'Settings',
    onClose: () => {
      if (changed) opts.onClose?.();
      else opts.onClose?.();
    },
    body: `
      <div class="rows-title">Play</div>
      <div class="rows">
        <button class="row" data-act="rules"><span class="row__label">How to play<small>The two rules, with pictures</small></span>${ICON.chevron}</button>
        ${choice('controls', 'Controls', [
          ['tools', 'Quick place'],
          ['classic', 'Tap cycle'],
        ])}
        <p class="controls-preview" data-controls-preview aria-live="polite">${controlsPreview(app.settings.controls)}</p>
        ${sw('autoMark', 'Dot impossible tiles', 'A small dot shows where no pet can go')}
        ${sw('showTimer', 'Show the clock')}
        ${sw('largeBoard', 'Large board', 'Bigger tiles you can scroll around on small phones')}
      </div>
      <div class="rows-title">Comfort</div>
      <div class="rows">
        ${sw('sound', 'Sound effects')}
        ${sw('haptics', 'Haptics')}
        ${choice('reducedMotion', 'Motion', [
          ['system', 'Device'],
          ['reduce', 'Reduced'],
          ['full', 'Full'],
        ])}
        ${sw('highContrast', 'High contrast')}
        ${sw('regionPatterns', 'Region patterns', 'Adds a texture to each color region')}
        ${sw('leftHanded', 'Left-handed layout')}
      </div>
      <div class="rows-title">Purchases</div>
      <div class="rows">
        <div class="row"><span class="row__label">Gem packs<small>${iap.available ? (iap.isStub ? 'Test store: nothing is charged, and test gems never carry into a release build.' : 'App Store connected. Gems only buy premium decorations.') : 'Coming soon. Nothing can be bought in this version.'}</small></span></div>
        ${iap.available ? `<button class="row" data-act="restore"><span class="row__label">Restore purchases</span></button>` : ''}
      </div>
      ${purchaseState}
      <div class="rows-title">Your data</div>
      <div class="rows">
        <div class="row"><span class="row__label">Saved on this device<small>Pawtopia plays fully offline. ${app.save.leaderboard.joined ? 'Only the leaderboard uses the internet.' : 'No account, no sign-in.'}</small></span></div>
        <button class="row" data-act="leaderboard"><span class="row__label">Leaderboard<small>${
          leaderboard.mode === 'off'
            ? 'Not open yet. When it is, joining is your choice.'
            : app.save.leaderboard.joined
              ? `On, as ${esc(app.save.leaderboard.nickname)}. Our server keeps a random player id, that name, a picture and your leaderboard points. Leave in League to delete it all.`
              : 'Off. If you join (in League), our server keeps a random player id, a nickname, a picture and your leaderboard points. Nothing else.'
        }</small></span>${ICON.chevron}</button>
        <div class="row"><span class="row__label">Analytics<small>None are sent in this version. Gameplay events stay in memory on your device and are never linked to you.</small></span></div>
        <div class="row"><span class="row__label">Reward videos<small>${ads.available ? (ads.isStub ? 'Test videos only, clearly labeled.' : 'Only when you choose one, for an extra life, a hint or a video token. Never between boards, never in Paw Cup.') : 'This version shows no videos and no ads.'}</small></span></div>
        ${ads.available && !ads.isStub ? `<button class="row" data-act="ad-privacy"><span class="row__label">Ad privacy choices<small>Change what the video network may use</small></span>${ICON.chevron}</button>` : ''}
        <button class="row" data-act="reset"><span class="row__label" style="color:var(--error)">Erase progress<small>Purchases and settings are kept</small></span></button>
      </div>
      ${
        featureFlags.qaTools
          ? `<div class="rows-title">Tester shortcuts</div>
      <div class="rows">
        <button class="row" data-qa="skip:31"><span class="row__label">Skip to level 31<small>Marks 1–30 solved: all six residents and Ember the fox</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="skip:46"><span class="row__label">Skip to level 46<small>Adds Maple the red panda (in the Blossom Tree)</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="skip:76"><span class="row__label">Skip to level 76<small>The new 5×5–8×8 ladder starts at 71</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="empty"><span class="row__label">Empty extra lives and hints<small>See "no hints left" and the loss sheet without extra lives</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="fill"><span class="row__label">Fill extra lives and hints to 10<small>Earning more turns into coins</small></span>${ICON.chevron}</button>
      </div>`
          : ''
      }
      ${featureFlags.devGallery ? `<div class="rows-title">Developer</div><div class="rows"><button class="row" data-act="gallery"><span class="row__label">Expression gallery<small>Development builds only</small></span></button></div>` : ''}
      <p class="muted settings-foot">Pawtopia ${esc(__APP_VERSION__)} · original art and sounds · fonts: Fredoka and Nunito Sans (SIL Open Font License)</p>`,
  });

  sh.scope.on(sh.el, 'click', async (e) => {
    const t = e.target as HTMLElement;
    const qa = t.closest('[data-qa]') as HTMLElement | null;
    if (qa && featureFlags.qaTools) {
      const [what, arg] = (qa.dataset.qa ?? '').split(':');
      if (what === 'skip') {
        skipToLevel(app.save, Number(arg));
        app.save.lastSession = null;
        app.persist();
        // Reload so the normal startup catch-up hands out the skipped levels' residents, gifts and points, once.
        location.reload();
      } else {
        setPantry(app.save, 'life', what === 'fill' ? ITEM_CAP.life : 0);
        setPantry(app.save, 'hint', what === 'fill' ? ITEM_CAP.hint : 0);
        app.persist();
        toast(what === 'fill' ? 'Extra lives and hints: 10 each.' : 'Extra lives and hints: 0.');
      }
      return;
    }
    const swEl = t.closest('[data-switch]') as HTMLElement | null;
    if (swEl) {
      const key = swEl.dataset.switch as BoolKey;
      const v = !app.settings[key];
      app.settings[key] = v;
      swEl.setAttribute('aria-checked', String(v));
      swEl.querySelector('.switch')?.setAttribute('aria-checked', String(v));
      changed = true;
      app.applySettings();
      app.persist();
      return;
    }
    const ch = t.closest('[data-choice]') as HTMLElement | null;
    if (ch) {
      const key = ch.dataset.choice as keyof Settings;
      (app.settings as unknown as Record<string, unknown>)[key] = ch.dataset.value;
      for (const b of sh.el.querySelectorAll<HTMLElement>(`[data-choice="${key}"]`)) b.setAttribute('aria-pressed', String(b === ch));
      changed = true;
      app.applySettings();
      app.persist();
      if (key === 'reducedMotion' && app.reducedMotion) track('animation_reduced_mode', { source: 'setting' });
      if (key === 'controls') {
        const pv = sh.el.querySelector('[data-controls-preview]');
        if (pv) pv.innerHTML = controlsPreview(app.settings.controls);
      }
      return;
    }
    const a = actionOf(e);
    if (!a) return;
    if (a.act === 'leaderboard') {
      sh.close();
      app.router.go({ screen: 'league', tab: 'leaderboard' });
      return;
    }
    if (a.act === 'ad-privacy') {
      try {
        const { AdMob } = await import('@capacitor-community/admob');
        await AdMob.showPrivacyOptionsForm();
      } catch {
        toast('Privacy choices open after your first video.');
      }
      return;
    }
    if (a.act === 'restore') {
      const res = await iap.restore();
      if (!sh.scope.alive) return;
      if (res.ok && res.owned.includes('remove_ads') && res.source) {
        app.save.purchases.removeAds = { active: true, source: res.source, verifiedAt: new Date().toISOString() };
        app.persist();
        toast('Purchases restored.');
      } else toast(res.ok ? 'No purchases to restore.' : 'The store is not available right now.');
    } else if (a.act === 'rules') {
      showRules(sh.scope);
    } else if (a.act === 'gallery') {
      sh.close();
      app.router.go({ screen: 'gallery' });
    } else if (a.act === 'reset') {
      confirmErase(sh.scope, () => sh.close());
    }
  });
}

function confirmErase(scope: Scope, done: () => void): void {
  const cs = openSheet(scope, {
    title: 'Erase all progress?',
    body: `<p class="sheet__lead">Levels, pets, decorations, coins and streaks on this device will be erased. Purchases and settings stay. This can't be undone.</p>
      <div class="sheet__actions">
        <button class="btn btn--quiet" data-act="cancel" data-autofocus>Keep my progress</button>
        <button class="btn btn--danger btn--block" data-act="erase">Erase progress</button>
      </div>`,
  });
  cs.scope.on(cs.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a) return;
    if (a.act === 'erase') {
      const fresh = resetProgress(app.save);
      // A fresh start gets the starter pantry again, like a new install.
      grantStarterItems(fresh);
      app.active = null;
      app.replaceSave(fresh);
      cs.close();
      done();
      app.router.go({ screen: 'home' });
      toast('Progress erased.');
    } else cs.close();
  });
}
