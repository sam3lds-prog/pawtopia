/**
 * Developer expression gallery: every pet in every mood, plus live tiles at real board sizes where reactions,
 * blinks and dozing can be triggered. Gated by featureFlags.devGallery (development builds only).
 */

import { app } from '../../app/app';
import { featureFlags } from '../../config/featureFlags';
import { PETS } from '../../meta/catalogs/pets';
import { applyFace, petElement, petSvg } from '../art/pets';
import { FaceDirector, type Clock } from '../animation/faceDirector';
import type { FaceMood, ReactionMood } from '../animation/faceMachine';
import { esc, h } from '../dom';
import { ICON } from '../icons';
import type { ScreenDef } from '../router';

const MOODS: FaceMood[] = ['idle', 'blink', 'curious', 'happy', 'confused', 'proud', 'focused', 'sleepy', 'celebrate'];
const REACTIONS: ReactionMood[] = ['curious', 'happy', 'confused', 'proud', 'focused', 'celebrate'];

export const galleryScreen: ScreenDef = {
  tab: null,
  title: 'Expression gallery',
  mount(root, scope) {
    if (!featureFlags.devGallery) {
      app.router.reset({ screen: 'journey' });
      return;
    }
    const el = h(`
      <div class="gallery">
        <header class="screen-head">
          <button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button>
          <h1 data-autofocus>Expressions</h1>
          <span class="chip">dev</span>
        </header>
        <p class="muted">Faces only: the head layer never moves. Live tiles below blink on their own; tap a mood to react.</p>
        <div class="gallery__live card">
          <div class="gallery__tiles" data-tiles></div>
          <div class="gallery__btns">${REACTIONS.map((m) => `<button class="chip" data-react="${m}">${m}</button>`).join('')}
            <button class="chip" data-react="celebrate-all">win wave</button>
            <button class="chip" data-react="calm">calm</button></div>
        </div>
        <div class="gallery__grid">
          ${PETS.map(
            (p) => `
            <section class="card gallery__pet">
              <h3>${esc(p.name)} <small class="muted">${esc(p.signature)}</small></h3>
              <div class="gallery__row">
                ${MOODS.map((m) => `<figure><div class="gallery__face">${petSvg(p.id, { mood: m })}</div><figcaption>${m}</figcaption></figure>`).join('')}
              </div>
              <div class="gallery__sizes" aria-label="At board sizes">
                ${[32, 40, 55].map((px) => `<div style="width:${px}px;height:${px}px;background:var(--r${px % 9})" class="gallery__size">${petSvg(p.id)}</div>`).join('')}
              </div>
            </section>`,
          ).join('')}
        </div>
      </div>`);
    root.appendChild(el);

    const clock: Clock = { now: () => performance.now(), set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => clearTimeout(id) };
    const faces = new FaceDirector({ clock, seed: 7, reducedMotion: app.reducedMotion, slowBlink: (k) => k === 'mochi' });
    scope.onDispose(() => faces.dispose());
    const tiles = el.querySelector('[data-tiles]') as HTMLElement;
    PETS.forEach((p, i) => {
      const cell = h(`<div class="gallery__tile" style="background:var(--r${i})"></div>`);
      const { el: pet, svg } = petElement(p.id);
      cell.appendChild(pet);
      tiles.appendChild(cell);
      faces.add(p.id, p.species, { apply: (v) => applyFace(svg, p.id, v) });
    });

    let i = 0;
    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-act="back"]')) {
        app.router.back({ screen: 'journey' });
        return;
      }
      const b = t.closest('[data-react]') as HTMLElement | null;
      if (!b) return;
      const m = b.dataset.react!;
      faces.activity();
      if (m === 'celebrate-all') faces.celebrate(PETS.map((p) => p.id));
      else if (m === 'calm') faces.calmAll();
      else faces.react(PETS[i++ % PETS.length].id, m as ReactionMood, m === 'curious' ? [1.4, 0] : undefined);
    });
  },
};
