/**
 * Friends: every animal who isn't one of the six cat and dog residents (`PetId`). The Farm's animals, the Pet Garden's
 * bunny and woodland visitors, and each region's wildlife. Since D35 they appear on puzzle boards too (the animal you're
 * bringing home is the board's animal); which animal a board shows is cosmetic and never touches the solver, which only
 * knows "first animal" and "second animal". Nothing here is random or for sale.
 *
 * When each one arrives is set by its sanctuary's `arrivals` list (src/meta/catalogs/sanctuaries.ts): solving puzzles
 * while building that sanctuary brings them home one by one.
 */

import type { AnimalKind } from './foods';
import { SANCTUARY_BY_ID, type SanctuaryId } from './sanctuaries';

export type CompanionId =
  // Farm
  | 'cotton'
  | 'truffle'
  | 'buttercup'
  | 'pepper'
  | 'marigold'
  | 'hazel'
  // Pet Garden
  | 'juniper'
  | 'ember'
  | 'maple'
  | 'gumnut'
  | 'skipper'
  | 'dozer'
  | 'zuri'
  | 'sunny'
  | 'tembo'
  | 'luna'
  | 'frost'
  | 'pebble'
  | 'rio'
  | 'mango'
  | 'pudding';
export type Habitat = 'woodland' | 'treetop' | 'ground' | 'water' | 'sky';

export interface CompanionDefinition {
  id: CompanionId;
  name: string;
  /** What kind of animal, for the card ("Fox"). */
  kind: string;
  /** Kind for food favorites. */
  animal: AnimalKind;
  trait: string;
  bio: string;
  habitat: Habitat;
  sanctuary: SanctuaryId;
  /** Portrait tint. */
  tint: string;
}

export const COMPANIONS: readonly CompanionDefinition[] = [
  // Farm
  {
    id: 'cotton',
    name: 'Cotton',
    kind: 'Sheep',
    animal: 'sheep',
    trait: 'Fluffy, gentle and a little bit sleepy',
    bio: 'Cotton was the first to wander in through the meadow gate, and has napped in the same sunny patch ever since. She says the grass is softer there.',
    habitat: 'ground',
    sanctuary: 'farm',
    tint: '#F4EFE6',
  },
  {
    id: 'truffle',
    name: 'Truffle',
    kind: 'Piglet',
    animal: 'pig',
    trait: 'Merry, muddy and nose-first into everything',
    bio: 'Truffle can find a dropped apple from the far side of the farm, and has never once been embarrassed about it.',
    habitat: 'ground',
    sanctuary: 'farm',
    tint: '#F8DCDC',
  },
  {
    id: 'buttercup',
    name: 'Buttercup',
    kind: 'Calf',
    animal: 'cow',
    trait: 'Big eyes and an even bigger heart',
    bio: 'Buttercup follows whoever is carrying the hay bucket, which is usually you, and moos softly when you leave.',
    habitat: 'ground',
    sanctuary: 'farm',
    tint: '#F2E9DE',
  },
  {
    id: 'pepper',
    name: 'Pepper',
    kind: 'Goat kid',
    animal: 'goat',
    trait: 'Climbs anything, apologizes for nothing',
    bio: 'Pepper has stood on every fence post, the barn roof and, very briefly, the pony. The view is always worth it.',
    habitat: 'ground',
    sanctuary: 'farm',
    tint: '#ECE6DE',
  },
  {
    id: 'marigold',
    name: 'Marigold',
    kind: 'Chick',
    animal: 'chicken',
    trait: 'Small, loud and very brave',
    bio: 'Marigold patrols the farmyard every morning and reports back to everyone in a long line of cheeps.',
    habitat: 'ground',
    sanctuary: 'farm',
    tint: '#FFF1BF',
  },
  {
    id: 'hazel',
    name: 'Hazel',
    kind: 'Pony',
    animal: 'horse',
    trait: 'Calm, kind and fond of long walks',
    bio: 'Hazel gives the little ones rides around the paddock and pretends not to mind when they braid her mane.',
    habitat: 'ground',
    sanctuary: 'farm',
    tint: '#EBD9C8',
  },
  // Pet Garden
  {
    id: 'juniper',
    name: 'Juniper',
    kind: 'Bunny',
    animal: 'rabbit',
    trait: 'Quick, curious and soft as a cloud',
    bio: 'Juniper dug a burrow under the garden hedge and pops out the moment anyone opens the carrot tin.',
    habitat: 'ground',
    sanctuary: 'harmony',
    tint: '#EFE6EA',
  },
  {
    id: 'ember',
    name: 'Ember',
    kind: 'Fox',
    animal: 'fox',
    trait: 'Shy at first, then your shadow',
    bio: 'A little fox who watched the garden from the hedge for weeks before trotting in. Ember curls up by the woodland log and keeps one ear on every puzzle you solve.',
    habitat: 'woodland',
    sanctuary: 'harmony',
    tint: 'var(--r3)',
  },
  {
    id: 'maple',
    name: 'Maple',
    kind: 'Red panda',
    animal: 'redpanda',
    trait: 'Sleepy, sunny and a little bit nosy',
    bio: 'Maple climbed into the blossom tree for a nap and decided to stay. From up there Maple can see every board you play, and approves of most of them.',
    habitat: 'treetop',
    sanctuary: 'harmony',
    tint: 'var(--r1)',
  },
  // Outback
  {
    id: 'gumnut',
    name: 'Gumnut',
    kind: 'Koala',
    animal: 'koala',
    trait: 'Sleeps twenty hours, dreams of leaves',
    bio: 'Gumnut chose the tallest gum tree and has barely moved since. Wakes up for eucalyptus, and for you.',
    habitat: 'treetop',
    sanctuary: 'outback',
    tint: '#E9E2D8',
  },
  {
    id: 'skipper',
    name: 'Skipper',
    kind: 'Kangaroo',
    animal: 'kangaroo',
    trait: 'Bouncy, nosy, always first to say hello',
    bio: 'Skipper hops a lap of the sanctuary every morning to check that everything is where it was yesterday.',
    habitat: 'ground',
    sanctuary: 'outback',
    tint: '#F3D9C4',
  },
  {
    id: 'dozer',
    name: 'Dozer',
    kind: 'Wombat',
    animal: 'wombat',
    trait: 'Stubborn, round and secretly very soft',
    bio: 'Dozer dug a burrow under the billabong bank in one afternoon and has been redecorating it ever since.',
    habitat: 'ground',
    sanctuary: 'outback',
    tint: '#E6DCCB',
  },
  // Savanna
  {
    id: 'zuri',
    name: 'Zuri',
    kind: 'Giraffe',
    animal: 'giraffe',
    trait: 'Graceful, curious, sees everything first',
    bio: 'Zuri can see the whole sanctuary from up there, and likes to tell everyone when you are on your way.',
    habitat: 'ground',
    sanctuary: 'savanna',
    tint: '#F6E3B8',
  },
  {
    id: 'sunny',
    name: 'Sunny',
    kind: 'Meerkat',
    animal: 'meerkat',
    trait: 'On guard duty, all day, every day',
    bio: 'Sunny stands on the lookout rock and keeps watch. Mostly for snacks.',
    habitat: 'ground',
    sanctuary: 'savanna',
    tint: '#F1DFC2',
  },
  {
    id: 'tembo',
    name: 'Tembo',
    kind: 'Elephant calf',
    animal: 'elephant',
    trait: 'Gentle, clumsy and full of joy',
    bio: 'Tembo spends the afternoons spraying water at the waterhole and the evenings pretending that was someone else.',
    habitat: 'water',
    sanctuary: 'savanna',
    tint: '#DDE3EA',
  },
  // Arctic
  {
    id: 'luna',
    name: 'Luna',
    kind: 'Snowy owl',
    animal: 'owl',
    trait: 'Quiet, wise, a little dramatic',
    bio: 'Luna arrived on the first snowdrift and watches the sky for the aurora, which she claims to have invented.',
    habitat: 'sky',
    sanctuary: 'arctic',
    tint: '#E8EEF4',
  },
  {
    id: 'frost',
    name: 'Frost',
    kind: 'Polar bear cub',
    animal: 'polarbear',
    trait: 'Big paws, bigger heart',
    bio: 'Frost tumbles down the snow den slope a hundred times a day and is never once tired of it.',
    habitat: 'ground',
    sanctuary: 'arctic',
    tint: '#EEF3F7',
  },
  {
    id: 'pebble',
    name: 'Pebble',
    kind: 'Seal pup',
    animal: 'seal',
    trait: 'Sleepy, smiley, a champion napper',
    bio: 'Pebble naps on the ice edge and wakes only for fish bites and belly rubs.',
    habitat: 'water',
    sanctuary: 'arctic',
    tint: '#DCE6EE',
  },
  // Amazon
  {
    id: 'rio',
    name: 'Rio',
    kind: 'Toucan',
    animal: 'toucan',
    trait: 'Loud, bright and very proud of that beak',
    bio: 'Rio announces every sunrise, every sunset, and every puzzle you solve, at full volume.',
    habitat: 'sky',
    sanctuary: 'amazon',
    tint: '#FFF0C9',
  },
  {
    id: 'mango',
    name: 'Mango',
    kind: 'Sloth',
    animal: 'sloth',
    trait: 'Takes it slow, and that is the point',
    bio: 'Mango hangs from the platform rail and moves about a tile a day. Says hello in about an hour.',
    habitat: 'treetop',
    sanctuary: 'amazon',
    tint: '#E8E0CC',
  },
  {
    id: 'pudding',
    name: 'Pudding',
    kind: 'Capybara',
    animal: 'capybara',
    trait: 'Everyone’s calmest friend',
    bio: 'Pudding sits on a lily pad at the river’s edge, and somehow everyone nearby feels calmer.',
    habitat: 'water',
    sanctuary: 'amazon',
    tint: '#EFDCC4',
  },
] as const;

export const COMPANION_BY_ID: Record<CompanionId, CompanionDefinition> = Object.fromEntries(COMPANIONS.map((c) => [c.id, c])) as Record<
  CompanionId,
  CompanionDefinition
>;

export function isCompanionId(x: unknown): x is CompanionId {
  return typeof x === 'string' && x in COMPANION_BY_ID;
}

/** A sanctuary's friends (not the cat and dog residents), in the order they arrive. */
export function companionsOf(sanctuary: SanctuaryId): CompanionDefinition[] {
  const order = SANCTUARY_BY_ID[sanctuary].arrivals.map((a) => a.id as string);
  return COMPANIONS.filter((c) => c.sanctuary === sanctuary).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
