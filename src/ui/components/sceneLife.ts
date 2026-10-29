/**
 * Brings a sanctuary scene to life (D24): every resident, wildlife friend and lively decoration in the SVG gets a small
 * repertoire, and `AmbientDirector` plays one short action at a time. Shared by Harmony and the regional sanctuaries.
 * Pets on the puzzle board are never touched (D11).
 */

import { app } from '../../app/app';
import { hashString } from '../../engine/rng';
import { localDateKey } from '../../game/dates';
import { PET_BY_ID, type PetId } from '../../meta/catalogs/pets';
import { AmbientDirector, type AmbientAction } from '../animation/ambientDirector';
import type { Clock } from '../animation/faceDirector';
import type { FaceMood } from '../animation/faceMachine';
import { applyFace } from '../art/pets';

/** What each wildlife friend likes to do (the sleepy ones mostly blink and stretch). */
const FRIEND_ACTIONS: Record<string, AmbientAction[]> = {
  ember: ['blink', 'wag', 'hop', 'stretch', 'stroll'],
  maple: ['blink', 'wag', 'stretch'],
  gumnut: ['blink', 'stretch'],
  skipper: ['blink', 'hop', 'wag', 'hop', 'stroll'],
  dozer: ['blink', 'stretch', 'wag', 'stroll'],
  zuri: ['blink', 'look', 'stretch', 'stroll'],
  sunny: ['blink', 'look', 'hop'],
  tembo: ['blink', 'wag', 'hop', 'stroll'],
  luna: ['blink', 'look', 'stretch'],
  frost: ['blink', 'hop', 'stretch', 'stroll'],
  pebble: ['blink', 'stretch', 'wag'],
  rio: ['blink', 'hop', 'look'],
  mango: ['blink', 'stretch'],
  pudding: ['blink', 'stretch', 'stroll'],
};

/** Lively scene parts and the one action each plays. */
const PART_ACTIONS: Array<[string, AmbientAction]> = [
  ['.sp-water', 'sparkle'],
  ['.sp-glow', 'glow'],
  ['.sp-glow-bulbs', 'glow'],
  ['.sp-petals', 'drift'],
  ['.sp-blades', 'spin'],
  ['.sp-aurora', 'shimmer'],
  ['.sp-sway', 'sway'],
  ['.sp-birds', 'flutter'],
  ['.sp-kite', 'sway'],
  ['.sp-balloon', 'sway'],
];

export interface SceneLife {
  /** A player's tap on a figure: a happy hop and a heart (a heart and a smile only, under reduced motion). */
  tap(fig: HTMLElement): void;
  /** Plays one action on a figure or part right away (arrival greetings, a reaction to food). Under reduced motion only a face changes. */
  play(id: string, action: AmbientAction): boolean;
  /** Ids of every figure in the scene, residents first. */
  figures(): string[];
  /** Screen shown / hidden. */
  setLive(on: boolean): void;
  dispose(): void;
}

const clock: Clock = { now: () => performance.now(), set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => clearTimeout(id) };

export function figureId(fig: HTMLElement): string {
  return fig.dataset.pet ?? `friend:${fig.dataset.friend}`;
}

/** Everyone in the scene says hello, one after another (a bigger hello when `big`). Nothing under reduced motion. */
export function greetAll(life: SceneLife, schedule: (fn: () => void, ms: number) => void, big: boolean): void {
  if (app.reducedMotion) return;
  life.figures().forEach((f, i) => schedule(() => life.play(f, big ? 'greet' : i % 2 ? 'wag' : 'hop'), 450 + i * 480));
}

export function startSceneLife(svg: Element, seedKey: string): SceneLife {
  const actors = new Map<string, Element>();
  const baseMood = new Map<string, FaceMood>();
  const figs: string[] = [];
  const play = (id: string, action: AmbientAction) => {
    const node = actors.get(id);
    if (!node) return;
    const rig = node.querySelector('g.pet') as SVGElement | null;
    const petId = (node as HTMLElement).dataset?.pet as PetId | undefined;
    if (rig && petId && (action === 'blink' || action === 'look' || action === 'yawn' || action === 'love' || action === 'greet')) {
      const base = baseMood.get(id) ?? 'idle';
      const mood: FaceMood = action === 'yawn' ? 'sleepy' : action === 'look' ? 'curious' : action === 'love' || action === 'greet' ? 'happy' : base;
      applyFace(rig, petId, { mood, blinking: action === 'blink', look: action === 'look' ? [hashString(id) % 2 ? 1.2 : -1.2, 0] : [0, 0] });
    }
    node.classList.add(`is-${action}`);
  };
  const end = (id: string, action: AmbientAction) => {
    const node = actors.get(id);
    if (!node) return;
    node.classList.remove(`is-${action}`);
    const rig = node.querySelector('g.pet') as SVGElement | null;
    const petId = (node as HTMLElement).dataset?.pet as PetId | undefined;
    if (rig && petId) applyFace(rig, petId, { mood: baseMood.get(id) ?? 'idle', blinking: false, look: [0, 0] });
  };
  const ambient = new AmbientDirector({ clock, seed: hashString(`${seedKey}-${localDateKey()}`), reducedMotion: app.reducedMotion, play, end });

  for (const g of svg.querySelectorAll('.sanctuary__pet[data-pet]')) {
    const id = (g as HTMLElement).dataset.pet as PetId;
    actors.set(id, g);
    figs.push(id);
    baseMood.set(id, ((g.querySelector('g.pet') as HTMLElement | null)?.dataset.mood as FaceMood) ?? 'idle');
    const dog = PET_BY_ID[id].species === 'dog';
    ambient.add({ id, actions: dog ? ['blink', 'look', 'wag', 'hop', 'stretch', 'stroll'] : ['blink', 'look', 'yawn', 'wag', 'stretch', 'stroll'] });
  }
  for (const g of svg.querySelectorAll('.sanctuary__friend[data-friend]')) {
    const f = (g as HTMLElement).dataset.friend!;
    const id = `friend:${f}`;
    actors.set(id, g);
    figs.push(id);
    ambient.add({ id, actions: FRIEND_ACTIONS[f] ?? ['blink', 'stretch'] });
  }
  // Decorations and stage features: each lively group is one actor (its own part is what moves).
  let n = 0;
  for (const g of svg.querySelectorAll('[data-decor], .sp-stage')) {
    const actions = PART_ACTIONS.filter(([sel]) => g.querySelector(sel)).map(([, a]) => a);
    if (!actions.length) continue;
    const id = (g as HTMLElement).dataset.decor ? `decor:${(g as HTMLElement).dataset.decor}` : `stage:${n++}`;
    actors.set(id, g);
    ambient.add({ id, actions });
  }
  for (const [i, g] of [...svg.querySelectorAll('.sp-fireflies, .sp-stars')].entries()) {
    actors.set(`sky:${i}`, g);
    ambient.add({ id: `sky:${i}`, actions: ['twinkle'] });
  }
  ambient.setLive(!document.hidden);

  return {
    tap: (fig) => {
      if (!ambient.trigger(figureId(fig), 'greet')) ambient.trigger(figureId(fig), 'love');
    },
    play: (id, action) => ambient.trigger(id, action) || (action === 'greet' && ambient.trigger(id, 'love')),
    figures: () => [...figs],
    setLive: (on) => ambient.setLive(on),
    dispose: () => ambient.dispose(),
  };
}
