/**
 * Playing a trick on a scene figure (D33), kept free of app state so it can be tested on its own. The trick's motion
 * is CSS (`.is-trick-<id>` in styles/sanctuary-play.css); this adds the emote and props, then clears everything after
 * the trick's own length. Under reduced motion only the emote shows, still.
 */

import { TRICK_BY_ID, type TrickId } from '../../meta/catalogs/tricks';
import { trickDir, trickOverlay } from '../art/tricks';

/** Ambient and greeting classes a trick takes over from (sceneLife's `is-<action>`). */
const KEEP = /^is-(away|live|trick-)/;

/** Plays a trick on a scene figure. Returns false if that figure is busy (mid-trick, or away on a decoration). */
export function performTrick(svg: SVGSVGElement, fig: SVGGElement, id: TrickId, reducedMotion: boolean): boolean {
  if (fig.dataset.trick || fig.classList.contains('is-away')) return false;
  const t = TRICK_BY_ID[id];
  // The trick replaces whatever small ambient motion the animal was in the middle of (a greeting, a stroll).
  for (const c of [...fig.classList]) if (c.startsWith('is-') && !KEEP.test(c)) fig.classList.remove(c);
  let box = { x: 0, y: 0, w: 30, h: 30 };
  // The animal's own outline: the hidden heart above its head would lift the emote bubble too high.
  const hearts = [...fig.querySelectorAll<SVGElement>('.sp-heart')];
  hearts.forEach((h) => (h.style.display = 'none'));
  try {
    const b = fig.getBBox();
    box = { x: b.x, y: b.y, w: b.width, h: b.height };
  } catch {
    /* not rendered */
  }
  hearts.forEach((h) => (h.style.display = ''));
  const width = svg.viewBox?.baseVal?.width || Infinity;
  svg.insertAdjacentHTML('beforeend', trickOverlay(id, t.emote, box, width, !reducedMotion));
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
