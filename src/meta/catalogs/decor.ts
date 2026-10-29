/**
 * Sanctuary decorations. Each belongs to one sanctuary and has a fixed home in its scene (no freeform placement, so
 * items can't overlap or end up in invalid combinations). Everyday items are bought with Paw Coins (earned by solving),
 * special ones with video tokens (earned only by watching reward videos), premium ones with gems (App Store); a few are
 * the starter gift or chapter gifts. A regional sanctuary's decorations can be bought once that sanctuary is open.
 * Cosmetic only.
 */

import type { SanctuaryId } from './sanctuaries';

export type DecorId =
  | 'kite'
  | 'eavelights'
  | 'balloon'
  | 'goldfountain'
  | 'cushion'
  | 'lamp'
  | 'bowls'
  | 'blanket'
  | 'fern'
  | 'basket'
  | 'rug'
  | 'toys'
  | 'perch'
  | 'windowbox'
  | 'path'
  | 'fence'
  | 'fountain'
  | 'tree'
  | 'bridge'
  // Outback
  | 'campfire'
  | 'windmill'
  | 'hammock'
  | 'opalrock'
  // Savanna
  | 'baobab'
  | 'weaver'
  | 'flamingos'
  | 'pavilion'
  // Arctic
  | 'igloo'
  | 'snowman'
  | 'icelanterns'
  | 'aurora'
  // Amazon
  | 'ropebridge'
  | 'orchids'
  | 'fireflyjars'
  | 'waterfall';

export type DecorUnlock = { kind: 'shop' } | { kind: 'chapter'; chapter: number };

/** How a decoration is paid for: Paw Coins (earned), video tokens (only from reward videos), gems (App Store). */
export type DecorTier = 'coins' | 'video' | 'premium' | 'gift';

export interface DecorDefinition {
  id: DecorId;
  /** Which sanctuary it stands in (Harmony unless set). */
  sanctuary?: SanctuaryId;
  name: string;
  blurb: string;
  /** Paw Coins in the shop. Chapter gifts, video-token and gem items have no coin price. */
  cost: number | null;
  /** Video tokens (special decorations). */
  tokens?: number;
  /** Gems (premium decorations). */
  gems?: number;
  /** Items sharing a slot stand in the same spot, so only one of them is out at a time (the Golden Fountain replaces the Stone Fountain). */
  slot?: string;
  unlock: DecorUnlock;
  /** One of the two starter gifts offered after the first board. */
  starter?: boolean;
  /** Draw order in the scene (back to front). */
  layer: number;
  season: 'any' | 'spring' | 'autumn';
}

export const DECOR: readonly DecorDefinition[] = [
  { id: 'kite', name: 'Rainbow Kite', blurb: 'A special decoration: a striped kite that dances over the blossom tree.', cost: null, tokens: 3, unlock: { kind: 'shop' }, layer: 0, season: 'any' },
  { id: 'eavelights', name: 'Cottage String Lights', blurb: 'A special decoration: warm bulbs along the cottage roof.', cost: null, tokens: 4, unlock: { kind: 'shop' }, layer: 3, season: 'any' },
  { id: 'balloon', name: 'Hot-Air Balloon', blurb: 'A premium decoration: a patchwork balloon drifting over the sanctuary.', cost: null, gems: 60, unlock: { kind: 'shop' }, layer: 0, season: 'any' },
  { id: 'goldfountain', name: 'Golden Fountain', blurb: 'A premium decoration: a gilded fountain that takes the stone fountain’s spot.', cost: null, gems: 90, slot: 'fountain', unlock: { kind: 'shop' }, layer: 3, season: 'any' },
  { id: 'path', name: 'Paw-Print Path', blurb: 'Stepping stones from the cottage door, each with a little paw.', cost: 180, unlock: { kind: 'shop' }, layer: 1, season: 'any' },
  { id: 'fence', name: 'Flower Fence', blurb: 'A low picket fence with climbing sweet peas.', cost: 160, unlock: { kind: 'shop' }, layer: 2, season: 'spring' },
  { id: 'tree', name: 'Blossom Tree', blurb: 'A cherry tree for shade and petals. A gift for finishing Willow Lane.', cost: null, unlock: { kind: 'chapter', chapter: 2 }, layer: 2, season: 'spring' },
  { id: 'windowbox', name: 'Window Box', blurb: 'Bright geraniums under the cottage window.', cost: 150, unlock: { kind: 'shop' }, layer: 3, season: 'any' },
  { id: 'lamp', name: 'Paper Lamp', blurb: 'A warm paper lantern on a post, for cozy evenings.', cost: 60, unlock: { kind: 'shop' }, starter: true, layer: 3, season: 'any' },
  { id: 'fountain', name: 'Stone Fountain', blurb: 'A gentle fountain for thirsty neighbors. A gift for finishing Meadow Gate.', cost: null, slot: 'fountain', unlock: { kind: 'chapter', chapter: 1 }, layer: 3, season: 'any' },
  { id: 'perch', name: 'Cat Perch', blurb: 'A tall scratching tower with a lookout at the top.', cost: 220, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'fern', name: 'Potted Fern', blurb: 'A leafy fern in a terracotta pot by the door.', cost: 80, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'rug', name: 'Woven Rug', blurb: 'A striped outdoor rug, warm from the sun.', cost: 110, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'bridge', name: 'Little Bridge', blurb: 'A curved wooden bridge over the brook. A gift for finishing Lantern Hill.', cost: null, unlock: { kind: 'chapter', chapter: 3 }, layer: 5, season: 'any' },
  { id: 'blanket', name: 'Picnic Blanket', blurb: 'A checked blanket for long lazy afternoons.', cost: 90, unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  { id: 'cushion', name: 'Plump Cushion', blurb: 'The softest seat in the garden.', cost: 60, unlock: { kind: 'shop' }, starter: true, layer: 6, season: 'any' },
  { id: 'bowls', name: 'Twin Bowls', blurb: 'One bowl for a cat, one for a dog. Everyone gets their own.', cost: 60, unlock: { kind: 'shop' }, layer: 6, season: 'any' },
  { id: 'basket', name: 'Napping Basket', blurb: 'A deep wicker basket with a fleece lining.', cost: 120, unlock: { kind: 'shop' }, layer: 6, season: 'any' },
  { id: 'toys', name: 'Toy Basket', blurb: 'Balls, a rope and one very loved squeaky carrot.', cost: 140, unlock: { kind: 'shop' }, layer: 6, season: 'any' },
  // Outback Sanctuary
  { id: 'campfire', sanctuary: 'outback', name: 'Campfire Ring', blurb: 'River stones and a crackling fire for cool outback nights.', cost: 120, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'windmill', sanctuary: 'outback', name: 'Outback Windmill', blurb: 'A tall windpump that keeps the water flowing.', cost: 170, unlock: { kind: 'shop' }, layer: 2, season: 'any' },
  { id: 'hammock', sanctuary: 'outback', name: 'Shady Hammock', blurb: 'A special decoration: a striped hammock for long, lazy afternoons.', cost: null, tokens: 3, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'opalrock', sanctuary: 'outback', name: 'Opal Rock', blurb: 'A premium decoration: a boulder with a seam of shimmering opal.', cost: null, gems: 60, unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  // Savanna Sanctuary
  { id: 'baobab', sanctuary: 'savanna', name: 'Baobab Tree', blurb: 'An ancient bottle-trunk tree with a crown of little branches.', cost: 180, unlock: { kind: 'shop' }, layer: 2, season: 'any' },
  { id: 'weaver', sanctuary: 'savanna', name: 'Weaver Nest Tree', blurb: 'A thorn tree hung with round woven nests.', cost: 110, unlock: { kind: 'shop' }, layer: 2, season: 'any' },
  { id: 'flamingos', sanctuary: 'savanna', name: 'Flamingo Pool', blurb: 'A special decoration: two pink flamingos wading in a shallow pool.', cost: null, tokens: 4, unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  { id: 'pavilion', sanctuary: 'savanna', name: 'Sunset Pavilion', blurb: 'A premium decoration: a canvas pavilion with a warm lantern.', cost: null, gems: 70, unlock: { kind: 'shop' }, layer: 3, season: 'any' },
  // Arctic Sanctuary
  { id: 'igloo', sanctuary: 'arctic', name: 'Snow Igloo', blurb: 'A cozy dome of snow blocks with a little doorway.', cost: 160, unlock: { kind: 'shop' }, layer: 2, season: 'any' },
  { id: 'snowman', sanctuary: 'arctic', name: 'Snow Friend', blurb: 'A round snowman with a woolly scarf.', cost: 90, unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  { id: 'icelanterns', sanctuary: 'arctic', name: 'Ice Lanterns', blurb: 'A special decoration: three ice lanterns with candles glowing inside.', cost: null, tokens: 3, unlock: { kind: 'shop' }, layer: 6, season: 'any' },
  { id: 'aurora', sanctuary: 'arctic', name: 'Aurora Curtain', blurb: 'A premium decoration: green and violet lights rippling across the sky.', cost: null, gems: 80, unlock: { kind: 'shop' }, layer: 0, season: 'any' },
  // Amazon Sanctuary
  { id: 'ropebridge', sanctuary: 'amazon', name: 'Canopy Rope Bridge', blurb: 'A swaying bridge between two forest giants.', cost: 170, unlock: { kind: 'shop' }, layer: 2, season: 'any' },
  { id: 'orchids', sanctuary: 'amazon', name: 'Orchid Cascade', blurb: 'Pink and white orchids trailing from a mossy branch.', cost: 110, unlock: { kind: 'shop' }, layer: 1, season: 'any' },
  { id: 'fireflyjars', sanctuary: 'amazon', name: 'Firefly Jars', blurb: 'A special decoration: glass jars of glow on the riverbank (the fireflies come and go as they please).', cost: null, tokens: 3, unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  { id: 'waterfall', sanctuary: 'amazon', name: 'Jungle Waterfall', blurb: 'A premium decoration: a ribbon of water tumbling into the river.', cost: null, gems: 90, unlock: { kind: 'shop' }, layer: 2, season: 'any' },
] as const;

export const DECOR_BY_ID: Record<DecorId, DecorDefinition> = Object.fromEntries(DECOR.map((d) => [d.id, d])) as Record<DecorId, DecorDefinition>;

export const STARTER_DECOR: DecorId[] = DECOR.filter((d) => d.starter).map((d) => d.id);

export function decorTier(d: DecorDefinition): DecorTier {
  if (d.gems) return 'premium';
  if (d.tokens) return 'video';
  if (d.unlock.kind === 'chapter') return 'gift';
  return 'coins';
}

/** Which sanctuary a decoration stands in. */
export function decorHome(d: Pick<DecorDefinition, 'sanctuary'>): SanctuaryId {
  return d.sanctuary ?? 'harmony';
}

export function decorOf(sanctuary: SanctuaryId): DecorDefinition[] {
  return DECOR.filter((d) => decorHome(d) === sanctuary);
}

export function isDecorId(x: unknown): x is DecorId {
  return typeof x === 'string' && x in DECOR_BY_ID;
}

/** The decoration gifted for finishing chapter `chapter` (1-based), if any. */
export function chapterGift(chapter: number): DecorDefinition | null {
  return DECOR.find((d) => d.unlock.kind === 'chapter' && d.unlock.chapter === chapter) ?? null;
}
