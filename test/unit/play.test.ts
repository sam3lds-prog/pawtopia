import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DECOR, decorTier } from '../../src/meta/catalogs/decor';
import { ACTIVITIES, activityFor, activityMarkup, riderFigure } from '../../src/ui/art/activities';
import { regionScene } from '../../src/ui/art/regions';
import { sanctuaryScene } from '../../src/ui/art/sanctuary';
import { decorHome } from '../../src/meta/catalogs/decor';

describe('decoration activities', () => {
  it('every special and premium decoration has one, and only those', () => {
    for (const d of DECOR) {
      const special = decorTier(d) === 'video' || decorTier(d) === 'premium';
      expect(!!activityFor(d.id), d.id).toBe(special);
    }
    for (const a of Object.values(ACTIVITIES)) {
      expect(a.ms).toBeLessThanOrEqual(6500);
      expect(a.line('Mochi')).toMatch(/^Mochi /);
    }
  });

  it('a rider is a copy, never a scene figure (no taps, no ambient life, no duplicate ids)', () => {
    for (const id of ['mochi', 'biscuit', 'ember', 'gumnut', 'pebble']) {
      const svg = riderFigure(id, 100, 100, 20, 'happy');
      expect(svg).toMatch(/class="sp-rider-fig"/);
      expect(svg).not.toMatch(/sanctuary__pet|sanctuary__friend|data-pet=|data-friend=|sp-heart/);
      expect(svg).toMatch(/data-rider=/);
    }
    expect(activityMarkup(ACTIVITIES.balloon, 'mochi')).toMatch(/data-activity="balloon"/);
  });

  it('seated activities have their seat in the decoration’s own art', () => {
    const harmony = sanctuaryScene({ decor: ['balloon'], pets: [] });
    expect(harmony).toMatch(/class="sp-balloon"[\s\S]*class="sp-seat"/);
    for (const a of Object.values(ACTIVITIES).filter((x) => x.seat)) {
      const home = decorHome(DECOR.find((d) => d.id === a.decor)!);
      const svg = home === 'harmony' ? sanctuaryScene({ decor: [a.decor], pets: [] }) : regionScene(home as never, { stage: 4, companions: [], decor: [a.decor] });
      for (const cls of a.seat!.split(' ').map((c) => c.slice(1))) expect(svg, a.decor).toContain(`class="${cls}"`);
    }
  });
});

describe('sanctuary play motion stays in the sanctuary and ends', () => {
  const css = readFileSync('src/ui/styles/sanctuary-play.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('every rule is scoped to the sanctuary scene, never the board', () => {
    for (const [, sel] of css.matchAll(/([^{}@]+)\{[^{}]*\}/g)) {
      for (const one of sel.split(',').map((s) => s.trim())) {
        if (!one || /^(\d+(\.\d+)?%|from|to)$/.test(one)) continue;
        expect(one, one).toMatch(/\.sanctuary__scene/);
        expect(one).not.toMatch(/\.cell|\.board/);
      }
    }
  });

  it('nothing loops forever, and each animation (with its repeats and delay) is over within 6.5 s', () => {
    expect(css).not.toMatch(/infinite/);
    for (const [, decl] of css.matchAll(/animation:\s*([^;]+);/g)) {
      if (decl.trim() === 'none !important') continue;
      const times = [...decl.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
      const repeat = Number(/\s(\d+)(?:\s+\w+)?\s*$/.exec(decl.replace(/\d+ms/g, ''))?.[1] ?? 1);
      const [dur, delay = 0] = times;
      expect(dur * repeat + delay, decl).toBeLessThanOrEqual(6500);
    }
  });

  it('under reduced motion, play shows still', () => {
    expect(css).toMatch(/:root\[data-motion='reduce'\] \.sanctuary__scene \.sp-act \*[\s\S]*animation: none !important/);
  });
});
