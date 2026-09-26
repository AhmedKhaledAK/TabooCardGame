/**
 * The word packs.
 *
 * One JSON file per pack, each a list of `{word, forbidden[5]}`. The host picks
 * which packs are in play from the lobby; the deck is then dealt from those
 * packs only.
 *
 * The cards of every pack are flattened into one `CARDS` array at load, and a
 * card is referred to everywhere else by its index in it. That keeps the
 * stored state small and the deck a plain list of numbers. Adding or removing
 * cards shifts those indexes, which is why STATE_VERSION in game.js has to be
 * bumped when a pack's contents change: a room part-way through a match would
 * otherwise deal a different word than the one it drew.
 *
 * `CATALOG` is the only thing the client is told: pack names and sizes, never
 * the words.
 */
import enGeneral from './en-general.json' with { type: 'json' };
import enScreen from './en-screen.json' with { type: 'json' };
import enFood from './en-food.json' with { type: 'json' };
import enSports from './en-sports.json' with { type: 'json' };
import enTech from './en-tech.json' with { type: 'json' };
import arGeneral from './ar-general.json' with { type: 'json' };
import arFood from './ar-food.json' with { type: 'json' };
import arMasr from './ar-masr.json' with { type: 'json' };
import arScreen from './ar-screen.json' with { type: 'json' };

/**
 * In the order the lobby lists them. `lang` sets the text direction of the
 * card and is what the matcher normalises against, so a pack's words must all
 * be in that language. `group` is the lobby heading.
 */
const PACKS_IN = [
  {
    id: 'en-general',
    lang: 'en',
    group: 'English',
    name: 'General',
    blurb: 'A bit of everything. The one to start with.',
    cards: enGeneral,
  },
  {
    id: 'en-screen',
    lang: 'en',
    group: 'English',
    name: 'Screen',
    blurb: 'Films, series and everything around them.',
    cards: enScreen,
  },
  {
    id: 'en-food',
    lang: 'en',
    group: 'English',
    name: 'Food & Drink',
    blurb: 'Kitchen, table and takeaway.',
    cards: enFood,
  },
  {
    id: 'en-sports',
    lang: 'en',
    group: 'English',
    name: 'Sports',
    blurb: 'Pitches, gyms and whistles.',
    cards: enSports,
  },
  {
    id: 'en-tech',
    lang: 'en',
    group: 'English',
    name: 'Tech & Internet',
    blurb: 'Phones, apps and the things that go wrong.',
    cards: enTech,
  },
  {
    id: 'ar-general',
    lang: 'ar',
    group: 'عربي',
    name: 'عام',
    blurb: 'كلمات من كل يوم.',
    cards: arGeneral,
  },
  {
    id: 'ar-food',
    lang: 'ar',
    group: 'عربي',
    name: 'أكل وشرب',
    blurb: 'من الكشري للكنافة.',
    cards: arFood,
  },
  {
    id: 'ar-masr',
    lang: 'ar',
    group: 'عربي',
    name: 'مصر وحياتنا',
    blurb: 'شوارع وعادات وأسامي نعرفها.',
    cards: arMasr,
  },
  {
    id: 'ar-screen',
    lang: 'ar',
    group: 'عربي',
    name: 'أفلام ومسلسلات',
    blurb: 'سينما وتليفزيون وأغاني.',
    cards: arScreen,
  },
];

/** What a fresh room plays with. */
export const DEFAULT_PACKS = ['en-general'];

/** Every card of every pack, flattened. A card is its index in here. */
export const CARDS = [];
/** Pack metadata, plus where that pack's cards sit in CARDS. */
export const PACKS = PACKS_IN.map((p) => {
  const from = CARDS.length;
  for (const c of p.cards) CARDS.push({ word: c.word, forbidden: c.forbidden, lang: p.lang });
  return { id: p.id, lang: p.lang, group: p.group, name: p.name, blurb: p.blurb, from, count: p.cards.length };
});

const BY_ID = new Map(PACKS.map((p) => [p.id, p]));

/** Pack names and sizes for the lobby. No words: the deck stays on the server. */
export const CATALOG = PACKS.map(({ id, lang, group, name, blurb, count }) => ({ id, lang, group, name, blurb, count }));

/**
 * A claimed list of pack ids, cleaned up: known ids only, no duplicates, in
 * catalog order. Null when nothing is left, so the caller can refuse rather
 * than end up with an empty deck.
 */
export function cleanPacks(ids) {
  if (!Array.isArray(ids)) return null;
  const want = new Set(ids.filter((x) => typeof x === 'string'));
  const kept = PACKS.filter((p) => want.has(p.id)).map((p) => p.id);
  return kept.length ? kept : null;
}

/** The card indexes of the given packs, in pack order. */
export function cardIndexes(ids) {
  const out = [];
  for (const id of ids) {
    const p = BY_ID.get(id);
    if (!p) continue;
    for (let i = 0; i < p.count; i++) out.push(p.from + i);
  }
  return out;
}
