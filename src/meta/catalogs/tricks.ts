/**
 * Tricks (emotes) for residents and wildlife friends (D33). Tap an animal in a sanctuary and ask it to do one: it
 * performs it with an emote bubble over its head. Two are free; everyday tricks cost video tokens (earned only by
 * choosing to watch a reward video); the most animated ones cost gems and can only be bought. Cosmetic only: a trick
 * changes nothing in any puzzle, ranking or reward.
 */

export type TrickId = 'wave' | 'hop' | 'spin' | 'bow' | 'rollover' | 'dance' | 'backflip' | 'bubble' | 'juggle' | 'rainbow';
export type TrickTier = 'free' | 'video' | 'premium';
export type EmoteGlyph = 'paw' | 'bang' | 'swirl' | 'sparkle' | 'note' | 'star' | 'bubble' | 'rainbow';

export interface TrickDefinition {
  id: TrickId;
  name: string;
  blurb: string;
  tier: TrickTier;
  /** Video tokens (video tier) or gems (premium tier). */
  price: number;
  /** How long it plays, in ms (≤ 3.6 s; see styles/sanctuary-play.css). */
  ms: number;
  emote: EmoteGlyph;
}

export const TRICKS: readonly TrickDefinition[] = [
  { id: 'wave', name: 'Wave', blurb: 'A friendly wave hello.', tier: 'free', price: 0, ms: 1600, emote: 'paw' },
  { id: 'hop', name: 'Hop', blurb: 'Two happy hops.', tier: 'free', price: 0, ms: 1300, emote: 'bang' },
  { id: 'spin', name: 'Spin', blurb: 'A twirl on the spot, and another one.', tier: 'video', price: 2, ms: 1700, emote: 'swirl' },
  { id: 'bow', name: 'Take a bow', blurb: 'A deep, very proud bow.', tier: 'video', price: 2, ms: 1900, emote: 'sparkle' },
  { id: 'rollover', name: 'Roll over', blurb: 'A full roll across the grass.', tier: 'video', price: 3, ms: 1900, emote: 'note' },
  { id: 'dance', name: 'Happy dance', blurb: 'A wiggly little dance with music notes.', tier: 'video', price: 3, ms: 2400, emote: 'note' },
  { id: 'backflip', name: 'Backflip', blurb: 'A big leap, a full flip and a shower of stars.', tier: 'premium', price: 40, ms: 2200, emote: 'star' },
  { id: 'bubble', name: 'Bubble float', blurb: 'Floats up inside a shimmering bubble, then pop!', tier: 'premium', price: 55, ms: 3400, emote: 'bubble' },
  { id: 'juggle', name: 'Star juggling', blurb: 'Juggles three little stars, and catches every one.', tier: 'premium', price: 70, ms: 3200, emote: 'star' },
  { id: 'rainbow', name: 'Rainbow leap', blurb: 'Leaps over a rainbow that paints itself across the sky.', tier: 'premium', price: 90, ms: 3400, emote: 'rainbow' },
] as const;

export const TRICK_BY_ID: Record<TrickId, TrickDefinition> = Object.fromEntries(TRICKS.map((t) => [t.id, t])) as Record<TrickId, TrickDefinition>;

export function isTrickId(x: unknown): x is TrickId {
  return typeof x === 'string' && x in TRICK_BY_ID;
}

export function trickCurrency(t: TrickDefinition): 'vtoken' | 'gem' | null {
  return t.tier === 'video' ? 'vtoken' : t.tier === 'premium' ? 'gem' : null;
}
