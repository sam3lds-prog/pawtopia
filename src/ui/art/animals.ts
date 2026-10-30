/**
 * Art for any animal (D35): residents use their personality rigs (pets.ts), every other friend uses its storybook head
 * with the same animated face layers (companions.ts). Board tiles, tool buttons and cards go through here, so a board
 * can show a sheep, a piglet or a cat with the same facial animation rules (D11: faces only, the head never moves).
 */

import { isPetId, type PetId } from '../../meta/catalogs/pets';
import { COMPANION_BY_ID, type CompanionId } from '../../meta/catalogs/companions';
import type { AnimalId } from '../../meta/animals';
import type { FaceMood, FaceView } from '../animation/faceMachine';
import { companionSvg, friendRigBody } from './companions';
import { applyFace, petSvg, poseFor, poseStyle } from './pets';

export interface AnimalSvgOptions {
  mood?: FaceMood;
  /** Accessible name. Omit for decorative art (aria-hidden). */
  label?: string;
  className?: string;
}

/** A live-able face rig for any animal (static in the given mood until a face view is applied). */
export function animalSvg(id: AnimalId, o: AnimalSvgOptions = {}): string {
  if (isPetId(id)) return petSvg(id, o);
  const mood = o.mood ?? 'idle';
  const p = poseFor(id, mood);
  const a11y = o.label ? `role="img" aria-label="${o.label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="pet pet--friend${o.className ? ` ${o.className}` : ''}" data-pet="${id}" data-mood="${mood}" data-eyes="${p.eyes}" data-mouth="${p.mouth}" style="${poseStyle(p)}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" ${a11y}>${friendRigBody(id as CompanionId)}</svg>`;
}

/** A mounted rig for a board tile that animates. */
export function animalElement(id: AnimalId, mood: FaceMood = 'idle'): { el: HTMLElement; svg: SVGSVGElement } {
  const span = document.createElement('span');
  span.innerHTML = animalSvg(id, { mood });
  return { el: span, svg: span.firstElementChild as SVGSVGElement };
}

/** Applies a face view (mood, blink, glance) to a mounted rig. */
export function applyAnimalFace(svg: SVGElement, id: AnimalId, view: FaceView): void {
  applyFace(svg, id, view);
}

/** A card portrait: residents' rigs, friends' storybook heads (with the gentle portrait moods). */
export function animalPortrait(id: AnimalId, mood: 'idle' | 'happy' | 'sleepy' = 'happy', label?: string): string {
  if (isPetId(id)) return petSvg(id as PetId, { mood: mood === 'sleepy' ? 'sleepy' : mood, label });
  return companionSvg(id as CompanionId, mood, label);
}

/** Portrait tint behind a friend's head (residents use the default card tint). */
export function animalTint(id: AnimalId): string | null {
  return isPetId(id) ? null : COMPANION_BY_ID[id as CompanionId].tint;
}
