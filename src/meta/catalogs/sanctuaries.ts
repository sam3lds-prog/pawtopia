/**
 * The sanctuaries of the world map (D35). Two beginner sanctuaries are open from the start: the Farm (a sheep first,
 * then a piglet, a calf, a goat kid, a chick and a pony) and the Pet Garden on Harmony Isle (a bunny, the cats and
 * dogs, and two woodland visitors). The exotic regions open at Journey levels.
 *
 * Whichever sanctuary you choose to build **grows with every puzzle you solve**, and its animals arrive one by one at
 * set growth counts (`arrivals`). Puzzle boards show the animal you're bringing home next (and, on two-animal boards,
 * one who already lives there), so where you build decides who is on your boards. The Farm and the regions also grow
 * through drawn stages; a sanctuary is complete when everyone has arrived and its last stage is reached.
 *
 * Opening a sanctuary costs nothing and is never sold. What grows a sanctuary is solving puzzles.
 */

import type { CompanionId } from './companions';
import type { PetId } from './pets';

export type SanctuaryId = 'farm' | 'harmony' | 'outback' | 'savanna' | 'arctic' | 'amazon';
/** Sanctuaries with a drawn region scene and growth stages (the Farm and the exotic regions). */
export type RegionId = Exclude<SanctuaryId, 'harmony'>;
/** Every animal in the game: the cat and dog residents and every other friend. */
export type AnimalId = PetId | CompanionId;

export interface Arrival {
  id: AnimalId;
  /** Puzzles solved while building the sanctuary when this animal arrives. */
  at: number;
}

export interface StageDef {
  /** Puzzles solved while building this sanctuary, needed to reach the stage. */
  at: number;
  name: string;
  /** What appears, in one line for the progress card. */
  change: string;
}

export interface SanctuaryDef {
  id: SanctuaryId;
  name: string;
  /** Short name for chips and buttons ("Farm"). */
  short: string;
  /** Where it is, as players would say it. */
  place: string;
  blurb: string;
  /** Map pin. */
  lon: number;
  lat: number;
  /** Journey level that must be cleared before it opens (0: from the start). */
  opensAfterLevel: number;
  /** A beginner sanctuary (open from the start, domestic animals). */
  beginner: boolean;
  /** Growth stages (the Farm and the regions). Stage 0 is the empty land. Empty for the Pet Garden. */
  stages: StageDef[];
  /** Who lives here, in the order they arrive. */
  arrivals: Arrival[];
  /** Paw Coins given once when the last stage is reached. */
  completeCoins: number;
  /** Accent for its card and pin. */
  accent: string;
}

/** Stages shared by every region, with region-flavored words. */
function stages(words: [string, string, string, string]): StageDef[] {
  return [
    { at: 0, name: 'Wild land', change: 'Untouched and quiet' },
    { at: 3, name: 'First friend', change: words[0] },
    { at: 8, name: 'Shelter', change: words[1] },
    { at: 15, name: 'Water and shade', change: words[2] },
    { at: 25, name: 'Thriving', change: words[3] },
  ];
}

/** A region's three animals arrive with its first three stages. */
const regional = (a: AnimalId, b: AnimalId, c: AnimalId): Arrival[] => [
  { id: a, at: 3 },
  { id: b, at: 8 },
  { id: c, at: 15 },
];

export const SANCTUARIES: readonly SanctuaryDef[] = [
  {
    id: 'farm',
    name: 'Meadow Farm',
    short: 'Farm',
    place: 'Green hills · beginner',
    blurb: 'Rolling fields, a red barn and a duck pond. A sheep is waiting at the gate, and five more farm friends after her.',
    lon: -2,
    lat: 53,
    opensAfterLevel: 0,
    beginner: true,
    stages: [
      { at: 0, name: 'Empty meadow', change: 'Long grass and a quiet gate' },
      { at: 1, name: 'First friend', change: 'A fenced pasture, and a sheep wanders in' },
      { at: 8, name: 'Barn raising', change: 'A red barn goes up beside the pasture' },
      { at: 19, name: 'Duck pond', change: 'The pond fills and a hen house appears' },
      { at: 26, name: 'Thriving', change: 'Sunflowers and an orchard all along the hill' },
    ],
    arrivals: [
      { id: 'cotton', at: 1 },
      { id: 'truffle', at: 4 },
      { id: 'buttercup', at: 8 },
      { id: 'pepper', at: 13 },
      { id: 'marigold', at: 19 },
      { id: 'hazel', at: 26 },
    ],
    completeCoins: 150,
    accent: '#C0583F',
  },
  {
    id: 'harmony',
    name: 'Pet Garden',
    short: 'Pet Garden',
    place: 'Harmony Isle · beginner',
    blurb: 'A cottage garden for a bunny, three cats and three dogs, with two woodland visitors who come later.',
    lon: -132,
    lat: -18,
    opensAfterLevel: 0,
    beginner: true,
    stages: [],
    arrivals: [
      { id: 'juniper', at: 1 },
      { id: 'biscuit', at: 4 },
      { id: 'mochi', at: 8 },
      { id: 'pip', at: 13 },
      { id: 'nori', at: 19 },
      { id: 'clover', at: 26 },
      { id: 'peanut', at: 34 },
      { id: 'ember', at: 43 },
      { id: 'maple', at: 53 },
    ],
    completeCoins: 200,
    accent: '#287B70',
  },
  {
    id: 'outback',
    name: 'Outback Sanctuary',
    short: 'Outback',
    place: 'Central Australia',
    blurb: 'Red earth, gum trees and big skies. A koala, a kangaroo and a wombat are waiting for a place to call home.',
    lon: 133,
    lat: -24,
    opensAfterLevel: 10,
    beginner: false,
    stages: stages([
      'Gum trees take root, and a koala climbs in',
      'A shade shelter goes up for a kangaroo',
      'The billabong fills, and a wombat digs a burrow',
      'Desert peas bloom across the red sand',
    ]),
    arrivals: regional('gumnut', 'skipper', 'dozer'),
    completeCoins: 150,
    accent: '#D9824A',
  },
  {
    id: 'savanna',
    name: 'Savanna Sanctuary',
    short: 'Savanna',
    place: 'East Africa',
    blurb: 'Golden grass under a huge sun. An elephant calf, a giraffe and a meerkat need room to roam.',
    lon: 35,
    lat: -2.5,
    opensAfterLevel: 25,
    beginner: false,
    stages: stages([
      'An acacia grows tall for a giraffe',
      'A rocky lookout for a meerkat',
      'The waterhole fills for an elephant calf',
      'Wildflowers and weaver birds everywhere',
    ]),
    arrivals: regional('zuri', 'sunny', 'tembo'),
    completeCoins: 150,
    accent: '#C99A2E',
  },
  {
    id: 'arctic',
    name: 'Arctic Sanctuary',
    short: 'Arctic',
    place: 'High Arctic',
    blurb: 'Snow, sea ice and the midnight sun. A polar bear cub, a seal pup and a snowy owl need a safe shore.',
    lon: -95,
    lat: 72,
    opensAfterLevel: 40,
    beginner: false,
    stages: stages([
      'Snowdrifts settle, and a snowy owl lands',
      'A snow den for a polar bear cub',
      'Open water by the ice for a seal pup',
      'Cotton grass and starry nights',
    ]),
    arrivals: regional('luna', 'frost', 'pebble'),
    completeCoins: 150,
    accent: '#5B9BC4',
  },
  {
    id: 'amazon',
    name: 'Amazon Sanctuary',
    short: 'Amazon',
    place: 'Amazon Rainforest',
    blurb: 'A green world of giant leaves and a slow brown river. A sloth, a capybara and a toucan need a quiet corner.',
    lon: -62,
    lat: -4,
    opensAfterLevel: 60,
    beginner: false,
    stages: stages([
      'Giant leaves unfurl, and a toucan flies in',
      'A tree platform for a sleepy sloth',
      'Giant lily pads on the river for a capybara',
      'Heliconia flowers and butterflies',
    ]),
    arrivals: regional('rio', 'mango', 'pudding'),
    completeCoins: 150,
    accent: '#3E9A62',
  },
] as const;

export const SANCTUARY_BY_ID: Record<SanctuaryId, SanctuaryDef> = Object.fromEntries(SANCTUARIES.map((s) => [s.id, s])) as Record<SanctuaryId, SanctuaryDef>;
/** Sanctuaries with a region scene and stages: the Farm, then the exotic regions in opening order. */
export const REGIONS = SANCTUARIES.filter((s) => s.id !== 'harmony') as readonly SanctuaryDef[];
/** The exotic regions only (open at Journey levels). */
export const EXOTIC = SANCTUARIES.filter((s) => !s.beginner) as readonly SanctuaryDef[];

/** The sanctuary an animal lives in. */
export function homeOf(id: AnimalId): SanctuaryId {
  return SANCTUARIES.find((s) => s.arrivals.some((a) => a.id === id))?.id ?? 'harmony';
}

/** When an animal arrives (growth count of its sanctuary), and its place in the line. */
export function arrivalOf(id: AnimalId): (Arrival & { sanctuary: SanctuaryId; index: number }) | null {
  for (const s of SANCTUARIES) {
    const index = s.arrivals.findIndex((a) => a.id === id);
    if (index >= 0) return { ...s.arrivals[index], sanctuary: s.id, index };
  }
  return null;
}

export function isSanctuaryId(x: unknown): x is SanctuaryId {
  return typeof x === 'string' && x in SANCTUARY_BY_ID;
}
export function isRegionId(x: unknown): x is RegionId {
  return isSanctuaryId(x) && x !== 'harmony';
}
