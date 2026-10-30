/**
 * The resident catalog: three cats and three dogs who live in the Pet Garden. Personality shapes how a pet's face reacts
 * (see ui/art/pets.ts) and its bio. It never changes puzzle rules or gives any competitive advantage. They arrive as the
 * Pet Garden grows (its `arrivals` list, D35), never at random and never for sale.
 */

import type { FaceMood } from '../../ui/animation/faceMachine';

export type PetSpecies = 'cat' | 'dog';
export type PetId = 'mochi' | 'pip' | 'clover' | 'biscuit' | 'nori' | 'peanut';

export interface PetPalette {
  fur: string;
  shade: string;
  ear: string;
  innerEar: string;
  muzzle: string;
  nose: string;
  eye: string;
  /** Iris color when the pet has light eyes (pupil drawn on top). */
  iris?: string;
  brow: string;
  cheek: string;
  whisker: string;
}

export interface PetDefinition {
  id: PetId;
  species: PetSpecies;
  name: string;
  /** One-line personality, shown on the pet card. */
  trait: string;
  /** Short bio for the sanctuary. */
  bio: string;
  /** The little thing this pet does that the others don't. */
  signature: string;
  palette: PetPalette;
  /** Purely aesthetic label. Never purchasable, never affects play. */
  rarity: 'founding' | 'neighbor' | 'rare';
  /** Moods this pet's rig expresses (all pets support the full set; listed for the gallery and docs). */
  expressions: FaceMood[];
  /** Ear / face template variant. */
  ears: 'pointed' | 'tufted' | 'round' | 'floppy' | 'folded' | 'button';
  markings: 'none' | 'tabby' | 'mask' | 'blaze' | 'patch' | 'socks';
}

const ALL_MOODS: FaceMood[] = ['idle', 'curious', 'happy', 'confused', 'proud', 'focused', 'sleepy', 'celebrate'];

export const PETS: readonly PetDefinition[] = [
  {
    id: 'mochi',
    species: 'cat',
    name: 'Mochi',
    trait: 'Serene and endlessly curious',
    bio: 'A cream-colored cat who greets every new neighbor with a slow, trusting blink.',
    signature: 'Slow, sleepy-eyed blinks',
    palette: {
      fur: '#F5E6CB',
      shade: '#E6CDA4',
      ear: '#EBD3AC',
      innerEar: '#F3B9B0',
      muzzle: '#FFF8EC',
      nose: '#E28F86',
      eye: '#2F2A27',
      brow: '#B8976C',
      cheek: '#F09C98',
      whisker: '#9E8667',
    },
    rarity: 'founding',
    expressions: ALL_MOODS,
    ears: 'round',
    markings: 'none',
  },
  {
    id: 'pip',
    species: 'cat',
    name: 'Pip',
    trait: 'Bright-eyed and easily delighted',
    bio: 'An apricot tabby who sparkles at every finished row and tells everyone about it.',
    signature: 'Sparkly eyes and the widest smile',
    palette: {
      fur: '#F3A762',
      shade: '#D9843F',
      ear: '#EE9C52',
      innerEar: '#F9CDA6',
      muzzle: '#FFF2E2',
      nose: '#D86E5E',
      eye: '#2F2622',
      brow: '#B9662B',
      cheek: '#EF8572',
      whisker: '#8F5A33',
    },
    rarity: 'neighbor',
    expressions: ALL_MOODS,
    ears: 'pointed',
    markings: 'tabby',
  },
  {
    id: 'clover',
    species: 'cat',
    name: 'Clover',
    trait: 'Skeptical, secretly sweet',
    bio: 'A charcoal cat with green-gold eyes who raises one brow at everything, then smiles when nobody is looking.',
    signature: 'One raised brow and a sideways glance',
    palette: {
      fur: '#50555F',
      shade: '#3D414A',
      ear: '#474B55',
      innerEar: '#C997A0',
      muzzle: '#EEEAE4',
      nose: '#E59FA6',
      eye: '#1E2320',
      iris: '#BFD65F',
      brow: '#A5ABB5',
      cheek: '#E68F9B',
      whisker: '#D9D5CF',
    },
    rarity: 'rare',
    expressions: ALL_MOODS,
    ears: 'tufted',
    markings: 'mask',
  },
  {
    id: 'biscuit',
    species: 'dog',
    name: 'Biscuit',
    trait: 'Goofy, loyal, always grinning',
    bio: 'A caramel pup with ears that flop when he laughs, which is often.',
    signature: 'A big tongue-out grin',
    palette: {
      fur: '#D99D60',
      shade: '#C2834A',
      ear: '#9A6038',
      innerEar: '#B37A4F',
      muzzle: '#F7E5CA',
      nose: '#3A2A24',
      eye: '#2E2420',
      brow: '#F7E5CA',
      cheek: '#EE8C79',
      whisker: '#9A6038',
    },
    rarity: 'founding',
    expressions: ALL_MOODS,
    ears: 'floppy',
    markings: 'none',
  },
  {
    id: 'nori',
    species: 'dog',
    name: 'Nori',
    trait: 'Focused, calm, quietly proud',
    bio: 'A slate-blue dog who studies every board with a thoughtful squint before a content little smile.',
    signature: 'A focused squint',
    palette: {
      fur: '#8495AC',
      shade: '#6B7C94',
      ear: '#5D6C82',
      innerEar: '#7A8AA1',
      muzzle: '#E6EBF1',
      nose: '#2A2F38',
      eye: '#232830',
      brow: '#3D4859',
      cheek: '#E895A3',
      whisker: '#5D6C82',
    },
    rarity: 'neighbor',
    expressions: ALL_MOODS,
    ears: 'folded',
    markings: 'patch',
  },
  {
    id: 'peanut',
    species: 'dog',
    name: 'Peanut',
    trait: 'Bashful, warm, a gentle winker',
    bio: 'A small tan pup with button ears who blushes at compliments and winks when a plan comes together.',
    signature: 'Rosy cheeks and a little wink',
    palette: {
      fur: '#E6BE88',
      shade: '#CF9F62',
      ear: '#C99359',
      innerEar: '#DDAE76',
      muzzle: '#FFF6E8',
      nose: '#4A3428',
      eye: '#2E2420',
      brow: '#B9844C',
      cheek: '#EF8580',
      whisker: '#B9844C',
    },
    rarity: 'neighbor',
    expressions: ALL_MOODS,
    ears: 'button',
    markings: 'blaze',
  },
] as const;

export const PET_BY_ID: Record<PetId, PetDefinition> = Object.fromEntries(PETS.map((p) => [p.id, p])) as Record<PetId, PetDefinition>;

/** The pets shown where a generic cat or dog is meant (the Paw Cup's boards, the rules sheet). */
export const FOUNDING: Record<PetSpecies, PetId> = { cat: 'mochi', dog: 'biscuit' };

export function isPetId(x: unknown): x is PetId {
  return typeof x === 'string' && x in PET_BY_ID;
}
