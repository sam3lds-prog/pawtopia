/**
 * One-time notices on the hub, each gated by an onboarding flag so it is shown until dismissed and never again.
 * D36: the default controls changed under existing players (one tap now places); they are told once, with the way
 * back one tap away.
 */

import { app } from '../../app/app';
import { track } from '../../services/analytics';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { showSettings } from '../screens/settings';

/** The "controls changed" card, or nothing when there is nothing to say. */
export function controlsNoticeMarkup(): string {
  if (!app.save.onboarding.controlsNotice) return '';
  return `<section class="card notice-card" data-controls-notice aria-labelledby="controls-notice-title">
    <h2 id="controls-notice-title">${ICON.paw}New: one tap places the animal</h2>
    <p class="muted">Tap a tile and the animal goes there. The <b>✕</b> tool below the board marks tiles empty (drag across a few), and <b>Erase</b> takes a tile back. Nothing else changed.</p>
    <p class="muted">Prefer the old way, tap ✕ and double-tap to place? It's still there.</p>
    <div class="notice-card__actions">
      <button class="btn btn--secondary" data-act="controls-ok">Got it</button>
      <button class="btn btn--quiet" data-act="controls-settings">Choose controls</button>
    </div>
  </section>`;
}

/**
 * Handles the card's buttons from a screen's click handler. Returns true when the click was the card's. Dismissing it
 * is remembered; opening Settings dismisses it too (the choice is right there) and re-renders on close.
 */
export function handleControlsNotice(act: string | undefined, el: HTMLElement, scope: Scope): boolean {
  if (act !== 'controls-ok' && act !== 'controls-settings') return false;
  app.save.onboarding.controlsNotice = false;
  app.persist();
  track('onboarding_step', { step: act === 'controls-ok' ? 'controls_notice_ok' : 'controls_notice_settings' });
  el.querySelector('[data-controls-notice]')?.remove();
  if (act === 'controls-settings') showSettings(scope, { onClose: () => app.router.refresh() });
  return true;
}
