/**
 * Leaderboard nicknames: the only thing a player types that other players see. Short, plain, kind. Checked on the
 * device for quick feedback and again on the server, which has the final say. Players can also take a suggested
 * name made from friendly words, which is the default.
 */

export const NICK_MIN = 3;
export const NICK_MAX = 20;

export type NickProblem = 'length' | 'characters' | 'words';
export type NickResult = { ok: true; name: string } | { ok: false; problem: NickProblem };

/**
 * What a nickname may not contain, checked after lowercasing and undoing common letter swaps (0→o, 1→i, 3→e, 4→a,
 * 5→s, 7→t, @→a, $→s, !→i). Kept short and generic on purpose; the report button handles the rest.
 *
 *  - ANYWHERE: unambiguous strings, blocked even inside a longer word or with the spaces removed.
 *  - WORDS: short words that are also parts of ordinary names (Hancock, Dickens, Sussex, Skillful, Grape), so they are
 *    blocked only as a whole word (or its plural).
 */
const ANYWHERE = ['fuck', 'fuk', 'shit', 'cunt', 'nigg', 'whore', 'slut', 'porn', 'hitler', 'bitch', 'pussy', 'penis', 'vagina', 'asshole', 'wank', 'retard', 'suicide', 'rapist', 'pawtopia', 'anthropic'];
const WORDS = ['dick', 'cock', 'sex', 'sexy', 'kill', 'killer', 'rape', 'tit', 'tits', 'boob', 'fag', 'nazi', 'ass', 'bastard', 'admin', 'moderator', 'mod', 'official', 'support', 'staff'];

const SWAPS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

const unswap = (s: string) => s.toLowerCase().replace(/[013457@$!]/g, (ch) => SWAPS[ch] ?? ch);

function blocked(name: string): boolean {
  const plain = unswap(name);
  const flat = plain.replace(/[^\p{L}]/gu, '');
  if (ANYWHERE.some((w) => flat.includes(w))) return true;
  const words = plain.split(/[^\p{L}]+/u).filter(Boolean);
  return words.some((w) => WORDS.includes(w) || (w.endsWith('s') && WORDS.includes(w.slice(0, -1))));
}

export function cleanNickname(raw: unknown): NickResult {
  if (typeof raw !== 'string') return { ok: false, problem: 'length' };
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  const len = [...name].length;
  if (len < NICK_MIN || len > NICK_MAX) return { ok: false, problem: 'length' };
  // Letters (any language), digits, spaces and a little punctuation. No links, no @handles, no emoji.
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(name)) return { ok: false, problem: 'characters' };
  if (/^\d+$/.test(name.replace(/[ ._-]/g, ''))) return { ok: false, problem: 'characters' };
  if (/(https?|www|\.com|\.net|\.org)/i.test(name)) return { ok: false, problem: 'characters' };
  if (blocked(name)) return { ok: false, problem: 'words' };
  return { ok: true, name };
}

export function nickProblemText(p: NickProblem): string {
  if (p === 'length') return `Use ${NICK_MIN} to ${NICK_MAX} characters.`;
  if (p === 'characters') return 'Use letters and numbers (spaces, dots, dashes and underscores are fine).';
  return 'Please pick a different name.';
}

const ADJECTIVES = ['Cozy', 'Sunny', 'Brave', 'Gentle', 'Happy', 'Clever', 'Sleepy', 'Lucky', 'Quiet', 'Merry', 'Bright', 'Kind', 'Swift', 'Calm', 'Jolly', 'Snug'];
const ANIMALS = ['Otter', 'Koala', 'Kitten', 'Puppy', 'Fox', 'Panda', 'Owl', 'Seal', 'Wombat', 'Meerkat', 'Sloth', 'Toucan', 'Giraffe', 'Capybara', 'Bunny', 'Badger'];

/** A friendly name like "Cozy Otter 42", from a random source in [0, 1). Always passes `cleanNickname`. */
export function suggestNickname(rand: () => number = Math.random): string {
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length) % xs.length];
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${10 + Math.floor(rand() * 90)}`;
}

/** What a reported name is replaced with: neutral, and stable for the account. */
export function neutralName(uid: string): string {
  let h = 0;
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `Player ${1000 + (h % 9000)}`;
}
