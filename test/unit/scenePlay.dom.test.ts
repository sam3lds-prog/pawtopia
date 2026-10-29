// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityRunner, AUTO_FIRST_MS, STILL_MS, startSceneActivities } from '../../src/ui/components/activities';
import { ACTIVITIES } from '../../src/ui/art/activities';
import { performTrick } from '../../src/ui/components/trickPlay';
import { TRICK_BY_ID } from '../../src/meta/catalogs/tricks';
import { selectorFor } from '../../src/ui/components/sheet';

const NS = 'http://www.w3.org/2000/svg';

function scene(): { svg: SVGSVGElement; chat: HTMLElement } {
  document.body.innerHTML = `
    <figure class="sanctuary__scene is-live">
      <svg xmlns="${NS}" viewBox="0 0 360 300">
        <g data-decor="balloon"><g class="sp-balloon"><g class="sp-seat"></g></g></g>
        <g class="sanctuary__pet" data-pet="mochi"><path class="sp-heart" d="M0 0"/></g>
        <g class="sanctuary__pet sanctuary__friend" data-friend="gumnut"></g>
      </svg>
    </figure>
    <p class="sanctuary__chat" data-chat><span>Mochi is still exploring the garden.</span></p>`;
  return { svg: document.querySelector('svg') as unknown as SVGSVGElement, chat: document.querySelector('[data-chat]') as HTMLElement };
}

const fig = (sel: string) => document.querySelector(sel) as unknown as SVGGElement;

/** Steps the clock a second at a time; true if an activity was ever on screen. */
function sawActivity(svg: SVGSVGElement, ms: number, also: () => boolean = () => true): boolean {
  let saw = false;
  for (let t = 0; t < ms; t += 1000) {
    vi.advanceTimersByTime(1000);
    if (svg.querySelector('.sp-act') && also()) saw = true;
  }
  return saw;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('decoration activities in a scene (D32)', () => {
  it('one at a time: the rider steps away and comes back, the caption returns', () => {
    const { svg } = scene();
    const caps: [string | null, boolean][] = [];
    const r = new ActivityRunner(svg, { reducedMotion: false, cast: () => ['mochi'], nameOf: () => 'Mochi', caption: (t, a) => caps.push([t, a]) });
    expect(r.decors()).toEqual(['balloon']);
    expect(r.play('balloon')).toBe('mochi');
    expect(r.busy).toBe(true);
    expect(r.play('balloon')).toBeNull();
    expect(fig('[data-pet="mochi"]').classList.contains('is-away')).toBe(true);
    expect(svg.querySelector('.sp-seat .sp-act[data-activity="balloon"]')).not.toBeNull();
    expect(caps[0]).toEqual(['Mochi is riding the hot-air balloon!', true]);
    vi.advanceTimersByTime(ACTIVITIES.balloon.ms);
    expect(r.busy).toBe(false);
    expect(svg.querySelector('.sp-act')).toBeNull();
    expect(svg.querySelector('.is-away')).toBeNull();
    expect(caps[caps.length - 1]).toEqual([null, false]);
    r.dispose();
  });

  it('dispose and hide end what is playing and leave nothing behind', () => {
    const { svg } = scene();
    const r = new ActivityRunner(svg, { reducedMotion: false, cast: () => ['mochi'], nameOf: () => 'Mochi', caption: () => {} });
    r.play('balloon');
    r.setLive(false);
    expect(svg.querySelector('.sp-act, .is-away, [class*="is-act-"]')).toBeNull();
    r.play('balloon');
    r.dispose();
    expect(svg.querySelector('.sp-act, .is-away, [class*="is-act-"]')).toBeNull();
    expect(r.play('balloon')).toBeNull();
  });

  it('nobody mid-trick is picked, and with everyone busy nothing starts', () => {
    const { svg, chat } = scene();
    fig('[data-pet="mochi"]').dataset.trick = 'wave';
    const r = startSceneActivities(svg, chat, false, (id) => id);
    expect(r.play('balloon')).toBe('gumnut');
    vi.advanceTimersByTime(ACTIVITIES.balloon.ms);
    fig('[data-friend="gumnut"]').dataset.trick = 'hop';
    expect(r.play('balloon')).toBeNull();
    r.dispose();
  });

  it('only what the player starts is announced to screen readers', () => {
    const { svg, chat } = scene();
    const r = startSceneActivities(svg, chat, false, () => 'Mochi');
    r.play('balloon');
    expect(chat.getAttribute('aria-live')).toBe('polite');
    vi.advanceTimersByTime(ACTIVITIES.balloon.ms);
    expect(chat.hasAttribute('aria-live')).toBe(false);
    expect(chat.textContent).toBe('Mochi is still exploring the garden.');
    // One that starts by itself is shown but not announced.
    r.setLive(true); // the test page counts as hidden
    expect(sawActivity(svg, AUTO_FIRST_MS[1] + 1000, () => chat.classList.contains('is-activity') && !chat.hasAttribute('aria-live'))).toBe(true);
    r.dispose();
  });

  it('nothing starts by itself under reduced motion, and the setting is read live', () => {
    const { svg, chat } = scene();
    let reduced = true;
    const r = startSceneActivities(svg, chat, () => reduced, () => 'Mochi');
    r.setLive(true); // the test page counts as hidden
    expect(sawActivity(svg, AUTO_FIRST_MS[1] + 61_000)).toBe(false);
    // A tap still shows it, still.
    r.play('balloon');
    expect(svg.querySelector('[data-decor="balloon"]')!.classList.contains('is-act-still')).toBe(true);
    vi.advanceTimersByTime(STILL_MS);
    reduced = false;
    expect(sawActivity(svg, 61_000)).toBe(true);
    r.dispose();
  });
});

describe('performing a trick (D33)', () => {
  it('plays on the figure with its emote, refuses while busy, and clears itself', () => {
    const { svg } = scene();
    const m = fig('[data-pet="mochi"]');
    m.classList.add('is-greet', 'is-stroll');
    expect(performTrick(svg, m, 'rainbow', false)).toBe(true);
    expect(m.dataset.trick).toBe('rainbow');
    expect(m.classList.contains('is-trick-rainbow')).toBe(true);
    expect(m.classList.contains('is-greet') || m.classList.contains('is-stroll')).toBe(false);
    expect(m.style.getPropertyValue('--trick-dir')).toMatch(/^-?1$/);
    expect(svg.querySelector('.sp-trick--rainbow .sp-trick-emote')).not.toBeNull();
    expect(svg.querySelector('.sp-trick--rainbow .sp-trick-rainbow')).not.toBeNull();
    expect((m.querySelector('.sp-heart') as unknown as SVGElement).style.display).toBe('');
    expect(performTrick(svg, m, 'wave', false)).toBe(false);
    vi.advanceTimersByTime(TRICK_BY_ID.rainbow.ms);
    expect(svg.querySelector('.sp-trick')).toBeNull();
    expect(m.dataset.trick).toBeUndefined();
    expect(m.getAttribute('class')).toBe('sanctuary__pet');
    expect(m.style.getPropertyValue('--trick-dir')).toBe('');
  });

  it('an animal away on a decoration finishes that first', () => {
    const { svg } = scene();
    const m = fig('[data-pet="mochi"]');
    m.classList.add('is-away');
    expect(performTrick(svg, m, 'wave', false)).toBe(false);
    expect(svg.querySelector('.sp-trick')).toBeNull();
  });

  it('under reduced motion it is the emote alone, still, for long enough to see', () => {
    const { svg } = scene();
    const m = fig('[data-pet="mochi"]');
    expect(performTrick(svg, m, 'backflip', true)).toBe(true);
    expect(m.classList.contains('is-trick-backflip')).toBe(false);
    expect(svg.querySelector('.sp-trick-emote')).not.toBeNull();
    expect(svg.querySelector('.sp-trick-burst')).toBeNull();
    vi.advanceTimersByTime(TRICK_BY_ID.backflip.ms);
    expect(svg.querySelector('.sp-trick')).toBeNull();
    // A quick trick's emote stays a little longer than the trick, so it can be read.
    expect(TRICK_BY_ID.hop.ms).toBeLessThan(1800);
    expect(performTrick(svg, m, 'hop', true)).toBe(true);
    vi.advanceTimersByTime(TRICK_BY_ID.hop.ms);
    expect(svg.querySelector('.sp-trick')).not.toBeNull();
    vi.advanceTimersByTime(1800 - TRICK_BY_ID.hop.ms);
    expect(svg.querySelector('.sp-trick')).toBeNull();
  });
});

describe('sheets give focus back to a re-rendered opener', () => {
  it('finds the new copy by its identifying attribute', () => {
    document.body.innerHTML = `<button class="trick-chip" data-trick="spin" aria-label="Spin">Spin</button><button>plain</button>`;
    expect(selectorFor(document.querySelector('.trick-chip'))).toBe('button[data-trick="spin"]');
    expect(selectorFor(document.querySelectorAll('button')[1])).toBeNull();
    expect(selectorFor(document.body)).toBeNull();
  });
});
