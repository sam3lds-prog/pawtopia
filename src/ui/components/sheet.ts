/**
 * Modal sheets. A sheet lives in a child scope of the current screen: closing the sheet or leaving the
 * screen removes it, its listeners and any pending timers. Focus moves into the sheet, Tab stays inside,
 * Escape closes dismissible sheets, and focus returns to where it was.
 */

import { h, qsa } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';

export interface SheetOptions {
  /** Accessible name; shown as the heading unless `heading: false`. */
  title: string;
  body: string;
  /** Tap outside / Escape / close button dismisses. Default true. */
  dismissible?: boolean;
  center?: boolean;
  heading?: boolean;
  onClose?: () => void;
  className?: string;
}

export interface SheetHandle {
  el: HTMLElement;
  scope: Scope;
  close(): void;
}

export function openSheet(parent: Scope, o: SheetOptions): SheetHandle {
  const scope = parent.child();
  const dismissible = o.dismissible ?? true;
  const prevFocus = document.activeElement as HTMLElement | null;
  const titleId = `sheet-${Math.random().toString(36).slice(2, 8)}`;
  const overlay = h(`
    <div class="overlay${o.center ? ' overlay--center' : ''}">
      <section class="sheet ${o.className ?? ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        ${o.center ? '' : '<div class="sheet__grab" aria-hidden="true"></div>'}
        ${
          o.heading === false
            ? `<h2 id="${titleId}" class="sr-only">${o.title}</h2>`
            : `<div class="sheet__head"><h2 id="${titleId}">${o.title}</h2>${dismissible ? `<button class="icon-btn icon-btn--bare" data-sheet-close aria-label="Close">${ICON.close}</button>` : ''}</div>`
        }
        ${o.body}
      </section>
    </div>`);
  const sheet = overlay.querySelector('.sheet') as HTMLElement;
  document.body.appendChild(overlay);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scope.dispose();
  };
  scope.onDispose(() => {
    closed = true;
    overlay.remove();
    o.onClose?.();
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
  });
  if (dismissible) {
    scope.on(overlay, 'click', (e) => {
      if (e.target === overlay || (e.target as HTMLElement).closest('[data-sheet-close]')) close();
    });
  }
  scope.on(document, 'keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Escape' && dismissible) {
      ke.preventDefault();
      close();
    } else if (ke.key === 'Tab') {
      const items = qsa<HTMLElement>(sheet, 'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])');
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (ke.shiftKey && document.activeElement === first) {
        ke.preventDefault();
        last.focus();
      } else if (!ke.shiftKey && document.activeElement === last) {
        ke.preventDefault();
        first.focus();
      }
    }
  });
  // Focus the first primary action, or the sheet itself.
  const firstAction = sheet.querySelector<HTMLElement>('[data-autofocus], .btn:not(:disabled)');
  if (firstAction) firstAction.focus({ preventScroll: true });
  else {
    sheet.tabIndex = -1;
    sheet.focus({ preventScroll: true });
  }
  return { el: sheet, scope, close };
}

let toastTimer: number | null = null;

/** Brief, non-blocking status message (announced to screen readers). */
export function toast(message: string, icon = ''): void {
  let host = document.querySelector('.toast-host') as HTMLElement | null;
  if (!host) {
    host = h('<div class="toast-host" role="status" aria-live="polite"></div>');
    document.body.appendChild(host);
  }
  host.replaceChildren(h(`<div class="toast">${icon}<span></span></div>`));
  (host.querySelector('.toast span') as HTMLElement).textContent = message;
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    host?.replaceChildren();
    toastTimer = null;
  }, 2600);
}
