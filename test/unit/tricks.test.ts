import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRICKS, TRICK_BY_ID, isTrickId, trickCurrency } from '../../src/meta/catalogs/tricks';
import { buyTrick, canAffordTrick, ownedTricks, ownsTrick } from '../../src/meta/tricks';
import { grantItem, itemBalance } from '../../src/meta/items';
import { grant } from '../../src/meta/ledger';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { emoteBubble, trickDir, trickOverlay, trickProps } from '../../src/ui/art/tricks';

const NOW = new Date('2026-10-20T10:00:00Z');

describe('trick catalog (D33)', () => {
  it('two free tricks, then video-token tricks, then premium gem tricks', () => {
    const free = TRICKS.filter((t) => t.tier === 'free');
    const video = TRICKS.filter((t) => t.tier === 'video');
    const premium = TRICKS.filter((t) => t.tier === 'premium');
    expect(free.map((t) => t.id)).toEqual(['wave', 'hop']);
    expect(free.every((t) => t.price === 0 && trickCurrency(t) === null)).toBe(true);
    expect(video.length).toBeGreaterThanOrEqual(3);
    expect(video.every((t) => trickCurrency(t) === 'vtoken' && t.price > 0 && t.price <= 5)).toBe(true);
    expect(premium.length).toBeGreaterThanOrEqual(3);
    expect(premium.every((t) => trickCurrency(t) === 'gem' && t.price >= 20)).toBe(true);
    // The premium ones are the most animated: longer and with their own props.
    const longestVideo = Math.max(...video.map((t) => t.ms));
    for (const t of premium) {
      expect(t.ms, t.id).toBeGreaterThanOrEqual(longestVideo - 300);
      expect(trickProps(t.id, { x: 100, y: 100, w: 30, h: 30 }), t.id).not.toBe('');
    }
  });

  it('ids, names and timings are sane', () => {
    expect(new Set(TRICKS.map((t) => t.id)).size).toBe(TRICKS.length);
    for (const t of TRICKS) {
      expect(isTrickId(t.id)).toBe(true);
      expect(TRICK_BY_ID[t.id]).toBe(t);
      expect(t.ms).toBeGreaterThan(800);
      expect(t.ms).toBeLessThanOrEqual(3600);
      expect(t.blurb.length).toBeGreaterThan(5);
    }
    expect(isTrickId('moonwalk')).toBe(false);
  });
});

describe('learning tricks', () => {
  it('free tricks are always known; nothing else until bought', () => {
    const s = defaultSave(NOW);
    expect(ownedTricks(s)).toEqual(['wave', 'hop']);
    expect(buyTrick(s, 'wave', NOW)).toBe('free');
    expect(ownsTrick(s, 'spin')).toBe(false);
  });

  it('video-token tricks cost tokens only, once', () => {
    const s = defaultSave(NOW);
    grant(s, 'g', 999, 'gift', NOW); // coins can't buy it
    expect(canAffordTrick(s, 'spin')).toBe(false);
    expect(buyTrick(s, 'spin', NOW)).toBe('insufficient');
    grantItem(s, 'ad1', 'vtoken', 3, 'ad', NOW);
    expect(buyTrick(s, 'spin', NOW)).toBe('ok');
    expect(itemBalance(s, 'vtoken')).toBe(1);
    expect(buyTrick(s, 'spin', NOW)).toBe('owned');
    expect(itemBalance(s, 'vtoken')).toBe(1);
    expect(ownsTrick(s, 'spin')).toBe(true);
  });

  it('premium tricks cost gems, never video tokens', () => {
    const s = defaultSave(NOW);
    grantItem(s, 'ad1', 'vtoken', 10, 'ad', NOW);
    expect(buyTrick(s, 'backflip', NOW)).toBe('insufficient');
    grantItem(s, 'iap:t1', 'gem', 60, 'store', NOW);
    expect(buyTrick(s, 'backflip', NOW)).toBe('ok');
    expect(itemBalance(s, 'gem')).toBe(20);
    expect(itemBalance(s, 'vtoken')).toBe(10);
    expect(buyTrick(s, 'bubble', NOW)).toBe('insufficient');
  });

  it('a charge that was recorded but not the trick (a crash between writes) is never charged twice', () => {
    const s = defaultSave(NOW);
    grantItem(s, 'ad1', 'vtoken', 4, 'ad', NOW);
    expect(buyTrick(s, 'dance', NOW)).toBe('ok');
    delete s.inventory.tricks.dance;
    expect(buyTrick(s, 'dance', NOW)).toBe('ok');
    expect(itemBalance(s, 'vtoken')).toBe(1);
  });

  it('learned tricks survive a save round trip; junk is dropped', () => {
    const s = defaultSave(NOW);
    s.inventory.tricks.juggle = { ownedAt: NOW.toISOString() };
    const back = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(ownsTrick(back, 'juggle')).toBe(true);
    const junk = JSON.parse(JSON.stringify(s));
    junk.inventory.tricks = 'lots';
    expect(normalizeSave(junk, NOW).inventory.tricks).toEqual({});
  });
});

describe('trick art', () => {
  const box = { x: 300, y: 200, w: 30, h: 40 };

  it('travelling tricks go toward the middle of the scene', () => {
    expect(trickDir({ x: 20, y: 0, w: 30, h: 30 }, 360)).toBe(1);
    expect(trickDir(box, 360)).toBe(-1);
    expect(trickProps('rainbow', box, -1)).toMatch(/A[\d.]+ [\d.]+ 0 0 0 /);
    expect(trickProps('rainbow', { ...box, x: 20 }, 1)).toMatch(/A[\d.]+ [\d.]+ 0 0 1 /);
  });

  it('the emote bubble stays inside the scene, beside the head', () => {
    for (const x of [0, 100, 200, 320, 340]) {
      const svg = emoteBubble('paw', { x, y: 200, w: 24, h: 30 }, 360);
      const [, bx] = /<rect x="([\d.-]+)"/.exec(svg)!;
      expect(Number(bx), String(x)).toBeGreaterThanOrEqual(-1);
      expect(Number(bx) + 17, String(x)).toBeLessThanOrEqual(361);
    }
  });

  it('an overlay is decoration only (hidden from screen readers, no taps)', () => {
    for (const t of TRICKS) {
      const svg = trickOverlay(t.id, t.emote, box, 360);
      expect(svg).toMatch(new RegExp(`^<g class="sp-trick sp-trick--${t.id}" aria-hidden="true">`));
      expect(svg).toMatch(/sp-trick-emote/);
      // Under reduced motion: the emote alone.
      const still = trickOverlay(t.id, t.emote, box, 360, false);
      expect(still).not.toMatch(/sp-trick-(notes|burst|orb|pop|balls|rainbow)/);
    }
  });
});

describe('trick motion', () => {
  const css = readFileSync('src/ui/styles/sanctuary-play.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('every trick moves the animal and shows its emote for exactly as long as it plays', () => {
    for (const t of TRICKS) {
      expect(css, t.id).toMatch(new RegExp(`\\.sanctuary__pet\\.is-trick-${t.id}\\s*\\{[^}]*animation:[^;]*${t.ms}ms`));
      expect(css, t.id).toMatch(new RegExp(`\\.sp-trick--${t.id} \\.sp-trick-emote\\s*\\{[^}]*animation: sp-emote ${t.ms}ms`));
    }
  });

  it('props finish before the trick is cleared away', () => {
    for (const t of TRICKS) {
      for (const [, decl] of css.matchAll(new RegExp(`\\.sp-trick--${t.id} [^{]*\\{([^}]*)\\}`, 'g'))) {
        const anim = /animation:\s*[\w-]+ (\d+)ms[^;]*?(?:\s(\d+)(?:\s+\w+)?)?;/.exec(decl);
        if (!anim) continue;
        const repeat = Number(anim[2] ?? 1);
        expect(Number(anim[1]) * repeat, `${t.id}: ${anim[0]}`).toBeLessThanOrEqual(t.ms);
      }
    }
    // Staggered juggling: the last star lands as the trick ends.
    const delay = Math.max(...[...css.matchAll(/sp-trick-ball--\d\s*\{\s*animation-delay: (\d+)ms/g)].map((m) => Number(m[1])));
    const [, ball] = /sp-trick-ball (\d+)ms ease-in-out 3/.exec(css)!;
    expect(delay + Number(ball) * 3).toBeLessThanOrEqual(TRICK_BY_ID.juggle.ms + 50);
  });

  it('under reduced motion, a trick is the emote alone, still', () => {
    expect(css).toMatch(/:root\[data-motion='reduce'\] \.sanctuary__scene \.sp-trick \*[\s\S]*animation: none !important/);
  });
});
