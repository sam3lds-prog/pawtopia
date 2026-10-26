/** Tiny DOM helpers. All dynamic text goes through `esc` before it reaches innerHTML. */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);
}

/** Builds one element from trusted template markup. Interpolate user/remote strings only via `esc`. */
export function h<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export function qs<T extends Element = HTMLElement>(root: ParentNode, sel: string): T {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el as T;
}

export function qsa<T extends Element = HTMLElement>(root: ParentNode, sel: string): T[] {
  return Array.from(root.querySelectorAll(sel)) as T[];
}

/** Finds the closest `[data-act]` from an event target and returns its action name. */
export function actionOf(e: Event): { act: string; el: HTMLElement } | null {
  const el = (e.target as HTMLElement | null)?.closest?.('[data-act]') as HTMLElement | null;
  if (!el || (el as HTMLButtonElement).disabled) return null;
  return { act: el.dataset.act ?? '', el };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
