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
 * Words (and impersonation of staff) that a nickname may not contain, matched after lowercasing, removing spaces and
 * punctuation and undoing common letter swaps (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s). Kept short and generic on
 * purpose; the report button handles the rest.
 */
const BLOCKED = [
  'fuck',
  'fuk',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'penis',
  'vagina',
  'boob',
  'tits',
  'slut',
  'whore',
  'porn',
  'sex',
  'rape',
  'nazi',
  'hitler',
  'nigg',
  'fag',
  'retard',
  'kill',
  'suicide',
  'bastard',
  'asshole',
  'wank',
  'admin',
  'moderator',
  'pawtopia',
  'official',
  'support',
  'anthropic',
];

const SWAPS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

function squash(s: string): string {
  return s
    .toLowerCase()
    .replace(/[013457@$!]/g, (ch) => SWAPS[ch] ?? ch)
    .replace(/[^\p{L}]/gu, '');
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
  const flat = squash(name);
  if (BLOCKED.some((w) => flat.includes(w))) return { ok: false, problem: 'words' };
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
