/**
 * The sanctuaries of the world map. Harmony Sanctuary is home (cats, dogs and two woodland friends, arriving at
 * Journey milestones). Each regional sanctuary opens at a Journey level, then **grows with every puzzle you solve while
 * it is the one you're building**: through four stages, with a new animal at each of the first three and a gift when
 * it's complete. Regional animals live only in their sanctuary; the puzzle board is always cats and dogs.
 *
 * Opening a region costs nothing and is never sold. What grows a sanctuary is solving puzzles.
 */

export type SanctuaryId = 'harmony' | 'outback' | 'savanna' | 'arctic' | 'amazon';
export type RegionId = Exclude<SanctuaryId, 'harmony'>;

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
  /** Where it is, as players would say it. */
  place: string;
  blurb: string;
  /** Map pin. */
  lon: number;
  lat: number;
  /** Journey level that must be cleared before it opens (0: from the start). */
  opensAfterLevel: number;
  /** Growth stages (regional sanctuaries). Stage 0 is the empty land. */
  stages: StageDef[];
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

export const SANCTUARIES: readonly SanctuaryDef[] = [
  {
    id: 'harmony',
    name: 'Harmony Sanctuary',
    place: 'Harmony Isle · home',
    blurb: 'Your cottage garden, where the cats and dogs of the puzzles live. New residents arrive as you go along the Journey.',
    lon: -132,
    lat: -18,
    opensAfterLevel: 0,
    stages: [],
    completeCoins: 0,
    accent: '#287B70',
  },
  {
    id: 'outback',
    name: 'Outback Sanctuary',
    place: 'Central Australia',
    blurb: 'Red earth, gum trees and big skies. A koala, a kangaroo and a wombat are waiting for a place to call home.',
    lon: 133,
    lat: -24,
    opensAfterLevel: 6,
    stages: stages(['Gum trees take root, and a koala climbs in', 'A shade shelter goes up for a kangaroo', 'The billabong fills, and a wombat digs a burrow', 'Desert peas bloom across the red sand']),
    completeCoins: 150,
    accent: '#D9824A',
  },
  {
    id: 'savanna',
    name: 'Savanna Sanctuary',
    place: 'East Africa',
    blurb: 'Golden grass under a huge sun. An elephant calf, a giraffe and a meerkat need room to roam.',
    lon: 35,
    lat: -2.5,
    opensAfterLevel: 20,
    stages: stages(['An acacia grows tall for a giraffe', 'A rocky lookout for a meerkat', 'The waterhole fills for an elephant calf', 'Wildflowers and weaver birds everywhere']),
    completeCoins: 150,
    accent: '#C99A2E',
  },
  {
    id: 'arctic',
    name: 'Arctic Sanctuary',
    place: 'High Arctic',
    blurb: 'Snow, sea ice and the midnight sun. A polar bear cub, a seal pup and a snowy owl need a safe shore.',
    lon: -95,
    lat: 72,
    opensAfterLevel: 40,
    stages: stages(['Snowdrifts settle, and a snowy owl lands', 'A snow den for a polar bear cub', 'Open water by the ice for a seal pup', 'Cotton grass and starry nights']),
    completeCoins: 150,
    accent: '#5B9BC4',
  },
  {
    id: 'amazon',
    name: 'Amazon Sanctuary',
    place: 'Amazon Rainforest',
    blurb: 'A green world of giant leaves and a slow brown river. A sloth, a capybara and a toucan need a quiet corner.',
    lon: -62,
    lat: -4,
    opensAfterLevel: 60,
    stages: stages(['Giant leaves unfurl, and a toucan flies in', 'A tree platform for a sleepy sloth', 'Giant lily pads on the river for a capybara', 'Heliconia flowers and butterflies']),
    completeCoins: 150,
    accent: '#3E9A62',
  },
] as const;

export const SANCTUARY_BY_ID: Record<SanctuaryId, SanctuaryDef> = Object.fromEntries(SANCTUARIES.map((s) => [s.id, s])) as Record<SanctuaryId, SanctuaryDef>;
export const REGIONS = SANCTUARIES.filter((s) => s.id !== 'harmony') as readonly SanctuaryDef[];

export function isSanctuaryId(x: unknown): x is SanctuaryId {
  return typeof x === 'string' && x in SANCTUARY_BY_ID;
}
export function isRegionId(x: unknown): x is RegionId {
  return isSanctuaryId(x) && x !== 'harmony';
}
