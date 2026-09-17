/**
 * Loose text matching for typed guesses and clues.
 *
 * Players type fast and badly, so "Elephent", "elephants", "an elephant" and
 * "ELEPHANT!" all have to count as "Elephant". The looseness is scaled to the
 * word length: short words must be exact (plural aside), since "cat" is one
 * letter away from "car".
 */
const ARTICLES = new Set(['a', 'an', 'the']);

/** Lowercase words with accents and punctuation stripped. */
export function tokens(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const bare = (toks) => toks.filter((t) => !ARTICLES.has(t));

/**
 * Edit distance counting a swap of neighbours as one edit ("lihgt"). `sub`
 * is the price of changing a letter: 2 makes it no cheaper than a delete
 * plus an insert, which is how short words avoid matching a different real
 * word ("mouse" / "house", "grandma" / "grandpa").
 */
function distance(a, b, sub) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : sub));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Two space-free strings are "the same word" to a hurried typist. `typos`
 * is off when a match costs a point: "house" must never whistle "horse".
 */
function close(a, b, typos = true) {
  if (!a || !b) return false;
  if (a === b || a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`) return true;
  const n = Math.min(a.length, b.length);
  if (!typos || n < 5 || Math.abs(a.length - b.length) > 2) return false;
  if (n < 8) return distance(a, b, 2) <= 1;
  return distance(a, b, 1) <= (n >= 10 ? 2 : 1);
}

/**
 * Whether a guess names the answer. The whole guess must be the answer
 * (articles and spacing aside), so a guess can't hedge with a list of words.
 */
export function isAnswer(guess, answer) {
  return close(bare(tokens(guess)).join(''), bare(tokens(answer)).join(''));
}

/**
 * Whether `text` says `target` anywhere in it: as a run of words, run
 * together ("icecream"), or as the start of a longer word ("trunks").
 */
export function mentions(text, target, { typos = true } = {}) {
  const words = tokens(text);
  const want = bare(tokens(target));
  if (!want.length) return false;
  const joined = want.join('');
  for (let i = 0; i < words.length; i++) {
    if (close(words[i], joined, typos)) return true;
    if (joined.length >= 4 && words[i].startsWith(joined)) return true;
    const run = words.slice(i, i + want.length).join('');
    if (want.length > 1 && close(run, joined, typos)) return true;
  }
  return false;
}

/**
 * The words of the answer a clue may not use: the answer itself and each of
 * its longer words ("Hot Dog" forbids "hot" and "dog").
 */
export function answerParts(answer) {
  const parts = bare(tokens(answer)).filter((w) => w.length >= 3);
  return parts.length > 1 ? [answer, ...parts] : [answer];
}
