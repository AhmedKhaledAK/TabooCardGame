/**
 * Laff w Dawaran game rules, as pure functions over a plain state object.
 *
 * No I/O and no timers live here: the Durable Object (worker/room.js) loads the
 * state, calls one of these with an explicit `now`, persists the result and
 * schedules an alarm for `nextDeadline(state)`. Keeping the clock injected is
 * what lets scripts/game.test.mjs run a whole match in milliseconds.
 *
 * Every mutating function returns something truthy when it changed
 * something, so the room only saves and broadcasts real changes, and silently
 * ignores the rest (a stale click, a non-host pressing a host button, a
 * double tap).
 *
 * Roles in a turn: the storyteller (`describer`) describes the card, their
 * teammates type guesses, and the referee (`watcher`, from the other team)
 * blows the whistle when a forbidden word is said out loud.
 */
import CARDS from './cards.json' with { type: 'json' };
import { answerParts, isAnswer, mentions } from './match.js';

export { CARDS };

export const TEAMS = ['A', 'B'];
export const COUNTDOWN_MS = 3000;
export const LIMITS = {
  rounds: { min: 1, max: 10, def: 3 },
  seconds: { min: 10, max: 180, def: 60 },
};
const LOG_MAX = 60;
const FEED_MAX = 40;
const NAME_MAX = 24;
export const GUESS_MAX = 40;
export const CLUE_MAX = 80;
/** Per-player gap between typed guesses, so nobody can machine-gun words. */
export const GUESS_GAP_MS = 350;

/** Bump when the stored shape changes; the room discards older state. */
export const STATE_VERSION = 2;

const other = (team) => (team === 'A' ? 'B' : 'A');
const clamp = (n, { min, max, def }) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
};
const clean = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function createState(code, rand = Math.random) {
  return {
    v: STATE_VERSION,
    code,
    phase: 'lobby', // lobby | ready | countdown | playing | round_over | over
    players: [], // join order; also host order
    teams: { A: [], B: [] },
    settings: { rounds: LIMITS.rounds.def, seconds: LIMITS.seconds.def },
    scores: { A: 0, B: 0 },
    round: 0,
    roundLen: 0,
    roundTurns: { A: 0, B: 0 },
    // Rotation cursors survive rounds so everybody gets a go, in order.
    cursor: { describe: { A: 0, B: 0 }, watch: { A: 0, B: 0 } },
    turn: null,
    deck: shuffle(CARDS.map((_, i) => i), rand),
    deckPos: 0,
    log: [],
    logSeq: 0,
  };
}

export function shuffle(arr, rand = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------- helpers

export const findPlayer = (s, id) => s.players.find((p) => p.id === id);
const online = (s, id) => !!findPlayer(s, id)?.online;

/** The earliest-joined player who is still here. Recomputed, never stored, so
 *  hosting passes on when the host leaves and comes back when they return. */
export function hostId(s) {
  return s.players.find((p) => p.online)?.id ?? null;
}
const isHost = (s, id) => id != null && hostId(s) === id;

function log(s, now, kind, text) {
  s.log.push({ id: ++s.logSeq, at: now, kind, text });
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

const nameOf = (s, id) => findPlayer(s, id)?.name ?? 'Someone';
export const teamName = (t) => (t === 'A' ? 'Shams' : 'Nil');

function drawCard(s, rand) {
  if (s.deckPos >= s.deck.length) {
    s.deck = shuffle(CARDS.map((_, i) => i), rand);
    s.deckPos = 0;
  }
  return s.deck[s.deckPos++];
}

/** Next online member of `team`, starting at the given cursor; advances it. */
function pick(s, kind, team) {
  const list = s.teams[team];
  const start = s.cursor[kind][team];
  for (let k = 0; k < list.length; k++) {
    const i = (start + k) % list.length;
    if (online(s, list[i])) {
      s.cursor[kind][team] = i + 1;
      return list[i];
    }
  }
  return null;
}

const onlineCount = (s, team) => s.teams[team].filter((id) => online(s, id)).length;

export function sanitizeName(name) {
  return clean(name, NAME_MAX) || 'Player';
}

// ---------------------------------------------------------------- presence

/** A player connected (or reconnected). */
export function join(s, { id, name, avatar = null }, now) {
  const p = findPlayer(s, id);
  if (p) {
    const changed = !p.online || p.name !== sanitizeName(name) || p.avatar !== avatar;
    p.online = true;
    p.name = sanitizeName(name);
    p.avatar = avatar;
    if (changed) repair(s, now);
    return changed;
  }
  s.players.push({ id, name: sanitizeName(name), avatar, team: null, online: true });
  log(s, now, 'info', `${sanitizeName(name)} pulled up a chair.`);
  return true;
}

/** A player's last socket closed. */
export function leave(s, id, now) {
  const p = findPlayer(s, id);
  if (!p || !p.online) return false;
  p.online = false;
  log(s, now, 'muted', `${p.name} left the ahwa.`);
  // Nothing to preserve in the lobby: forget them outright so ghost players
  // never get handed a turn.
  if (s.phase === 'lobby') removePlayer(s, id);
  repair(s, now);
  return true;
}

function removePlayer(s, id) {
  s.players = s.players.filter((p) => p.id !== id);
  for (const t of TEAMS) s.teams[t] = s.teams[t].filter((x) => x !== id);
}

/**
 * Re-seat roles after someone leaves or returns: a missing storyteller who
 * hasn't started yet is replaced, and a missing referee is replaced at any
 * time. A storyteller who drops mid-turn keeps the turn; the clock runs out.
 */
function repair(s, now) {
  const t = s.turn;
  if (t && ['ready', 'countdown', 'playing'].includes(s.phase)) {
    if (s.phase === 'ready' && !online(s, t.describer)) {
      const next = pick(s, 'describe', t.team);
      if (next) {
        t.describer = next;
        log(s, now, 'info', `${nameOf(s, next)} takes over the story for ${teamName(t.team)}.`);
      } else {
        t.describer = null;
      }
    }
    if (!t.watcher || !online(s, t.watcher)) {
      t.watcher = pick(s, 'watch', other(t.team));
    }
  }
  // Nobody left on either side: park the match in the lobby rather than
  // leaving a turn that nobody can ever start.
  if (s.phase !== 'lobby' && !s.players.some((p) => p.online)) toLobby(s, now);
}

// ---------------------------------------------------------------- lobby

export function joinTeam(s, id, team, now) {
  const p = findPlayer(s, id);
  if (!p || (team !== null && !TEAMS.includes(team)) || p.team === team) return false;
  if (p.team) s.teams[p.team] = s.teams[p.team].filter((x) => x !== id);
  p.team = team;
  if (team) s.teams[team].push(id);
  if (s.phase !== 'lobby') {
    log(s, now, 'info', team ? `${p.name} joined ${teamName(team)}.` : `${p.name} is now watching.`);
    repair(s, now);
  }
  return true;
}

export function shuffleTeams(s, id, rand = Math.random) {
  if (s.phase !== 'lobby' || !isHost(s, id)) return false;
  const here = shuffle(s.players.filter((p) => p.online), rand);
  const mid = Math.ceil(here.length / 2);
  s.teams = { A: [], B: [] };
  here.forEach((p, i) => {
    p.team = i < mid ? 'A' : 'B';
    s.teams[p.team].push(p.id);
  });
  return true;
}

export function updateSettings(s, id, patch) {
  if (s.phase !== 'lobby' || !isHost(s, id)) return false;
  const next = {
    rounds: patch.rounds === undefined ? s.settings.rounds : clamp(patch.rounds, LIMITS.rounds),
    seconds: patch.seconds === undefined ? s.settings.seconds : clamp(patch.seconds, LIMITS.seconds),
  };
  if (next.rounds === s.settings.rounds && next.seconds === s.settings.seconds) return false;
  s.settings = next;
  return true;
}

export const canStart = (s) => onlineCount(s, 'A') > 0 && onlineCount(s, 'B') > 0;

export function startGame(s, id, now, rand = Math.random) {
  if (s.phase !== 'lobby' || !isHost(s, id) || !canStart(s)) return false;
  s.scores = { A: 0, B: 0 };
  s.round = 0;
  s.cursor = { describe: { A: 0, B: 0 }, watch: { A: 0, B: 0 } };
  s.log = [];
  log(s, now, 'info', `Yalla! ${s.settings.rounds} round${s.settings.rounds > 1 ? 's' : ''}, ${s.settings.seconds}s per turn.`);
  beginRound(s, now, rand);
  return true;
}

// ---------------------------------------------------------------- turns

function beginRound(s, now, rand) {
  s.round += 1;
  // Recomputed each round so players who joined mid-match get their turn.
  s.roundLen = Math.max(onlineCount(s, 'A'), onlineCount(s, 'B'), 1);
  s.roundTurns = { A: 0, B: 0 };
  log(s, now, 'info', `Round ${s.round} of ${s.settings.rounds}.`);
  // Alternate who opens, so neither team always has the last word.
  beginTurn(s, s.round % 2 === 1 ? 'A' : 'B', now, rand);
}

function beginTurn(s, team, now, rand) {
  s.turn = {
    team,
    describer: pick(s, 'describe', team),
    watcher: pick(s, 'watch', other(team)),
    card: drawCard(s, rand),
    cardNo: 1,
    // Forbidden words a guesser has already typed: fair game from then on.
    unlocked: [],
    skips: 0,
    hits: 0,
    countdownEndsAt: null,
    endsAt: null,
    feed: [], // typed guesses and clues this turn, oldest first
    feedSeq: 0,
    lastGuess: {}, // player id -> time of their last guess
  };
  s.phase = 'ready';
  if (s.turn.describer) {
    log(s, now, 'info', `${teamName(team)} is up. ${nameOf(s, s.turn.describer)} tells the story.`);
  }
}

/** The storyteller says go. */
export function goLive(s, id, now) {
  if (s.phase !== 'ready' || s.turn.describer !== id) return false;
  s.phase = 'countdown';
  s.turn.countdownEndsAt = now + COUNTDOWN_MS;
  return true;
}

/** When the room must next call `tick`, or null if nothing is pending. */
export function nextDeadline(s) {
  if (s.phase === 'countdown') return s.turn.countdownEndsAt;
  if (s.phase === 'playing') return s.turn.endsAt;
  return null;
}

/** Advance any timed phase whose deadline has passed. Safe to call anytime. */
export function tick(s, now, rand = Math.random) {
  let changed = false;
  if (s.phase === 'countdown' && now >= s.turn.countdownEndsAt) {
    s.phase = 'playing';
    // Measured from the countdown's end, not from when the alarm happened to fire.
    s.turn.endsAt = s.turn.countdownEndsAt + s.settings.seconds * 1000;
    changed = true;
  }
  if (s.phase === 'playing' && now >= s.turn.endsAt) {
    endTurn(s, now, rand);
    changed = true;
  }
  return changed;
}

function endTurn(s, now, rand, passed = false) {
  const t = s.turn;
  if (!passed) log(s, now, 'muted', `Time! The last word was "${CARDS[t.card].word}". ${teamName(t.team)} got ${t.hits}.`);
  s.roundTurns[t.team] += 1;

  if (s.roundTurns.A >= s.roundLen && s.roundTurns.B >= s.roundLen) {
    s.turn = { ...t, card: null, unlocked: [], describer: null, watcher: null };
    if (s.round >= s.settings.rounds) {
      s.phase = 'over';
      const { A, B } = s.scores;
      log(s, now, 'info', A === B ? `It's a draw at ${A}.` : `${teamName(A > B ? 'A' : 'B')} wins ${Math.max(A, B)} to ${Math.min(A, B)}!`);
    } else {
      s.phase = 'round_over';
    }
    return;
  }

  let team = other(t.team);
  if (s.roundTurns[team] >= s.roundLen) team = t.team;
  beginTurn(s, team, now, rand);
}

export function nextRound(s, id, now, rand = Math.random) {
  if (s.phase !== 'round_over' || !isHost(s, id)) return false;
  beginRound(s, now, rand);
  return true;
}

/**
 * The host passes a turn nobody can take: the storyteller's whole team is
 * away. Counts as played so the match can still finish.
 */
export function skipTurn(s, id, now, rand = Math.random) {
  if (s.phase !== 'ready' || !isHost(s, id) || s.turn.describer) return false;
  log(s, now, 'muted', `${teamName(s.turn.team)} had nobody to tell the story. Turn passed.`);
  endTurn(s, now, rand, true);
  return true;
}

// ---------------------------------------------------------------- in play

const live = (s, now) => s.phase === 'playing' && now < s.turn.endsAt;

function nextCard(s, rand) {
  const t = s.turn;
  t.card = drawCard(s, rand);
  t.cardNo += 1;
  t.unlocked = [];
}

function post(t, entry) {
  t.feed.push({ id: ++t.feedSeq, card: t.cardNo, ...entry });
  if (t.feed.length > FEED_MAX) t.feed.splice(0, t.feed.length - FEED_MAX);
}

/** A guesser: on the playing team, and not the one telling the story. */
function isGuesser(s, id) {
  const p = findPlayer(s, id);
  return !!p?.online && p.team === s.turn.team && s.turn.describer !== id;
}

/**
 * Button actions. Only while the clock runs, and only from the right seat:
 * the storyteller skips the card, the referee blows the whistle on a
 * forbidden word said out loud. Returns `{ kind, word, by }` or null.
 */
export function act(s, id, action, now, rand = Math.random) {
  if (!live(s, now)) return null;
  const t = s.turn;
  const word = CARDS[t.card].word;
  if (action === 'skip' && t.describer === id) {
    const free = t.skips === 0;
    if (!free) s.scores[t.team] -= 1;
    t.skips += 1;
    log(s, now, 'warn', `Skipped "${word}". ${free ? 'Free' : '-1'}`);
  } else if (action === 'buzz' && t.watcher === id) {
    s.scores[t.team] -= 1;
    log(s, now, 'bad', `${nameOf(s, id)} blew the whistle on "${word}"! -1`);
  } else {
    return null;
  }
  nextCard(s, rand);
  return { kind: action, word, by: id };
}

/**
 * A typed guess. The right answer scores and deals the next card on the
 * spot. A forbidden word turns green for the storyteller, since the team has
 * said it now anyway. Returns `{ kind: 'hit' | 'unlock' | 'miss', ... }`, or
 * null when the guess doesn't count at all.
 */
export function guess(s, id, text, now, rand = Math.random) {
  if (!live(s, now) || !isGuesser(s, id)) return null;
  const t = s.turn;
  const said = clean(text, GUESS_MAX);
  if (!said || now - (t.lastGuess[id] ?? -Infinity) < GUESS_GAP_MS) return null;
  t.lastGuess[id] = now;
  const card = CARDS[t.card];

  if (isAnswer(said, card.word)) {
    s.scores[t.team] += 1;
    t.hits += 1;
    post(t, { by: id, kind: 'guess', text: said, result: 'hit' });
    log(s, now, 'good', `${nameOf(s, id)} got "${card.word}". +1`);
    nextCard(s, rand);
    return { kind: 'hit', word: card.word, by: id };
  }

  const opened = [];
  card.forbidden.forEach((w, i) => {
    if (!t.unlocked.includes(i) && mentions(said, w)) opened.push(i);
  });
  t.unlocked.push(...opened);
  const result = opened.length ? 'unlock' : 'miss';
  post(t, { by: id, kind: 'guess', text: said, result });
  return { kind: result, by: id };
}

/**
 * A typed clue from the storyteller, for rooms playing without voice. It is
 * checked before anyone sees it: naming the answer, part of it, or a
 * forbidden word nobody has guessed yet is an automatic whistle.
 */
export function clue(s, id, text, now, rand = Math.random) {
  if (!live(s, now) || s.turn.describer !== id) return null;
  const t = s.turn;
  const said = clean(text, CLUE_MAX);
  if (!said) return null;
  const card = CARDS[t.card];
  const banned = [...answerParts(card.word), ...card.forbidden.filter((_, i) => !t.unlocked.includes(i))];
  const slip = banned.find((w) => mentions(said, w, { typos: false }));
  if (slip) {
    s.scores[t.team] -= 1;
    // The clue itself would give the word away, so it is never shown.
    post(t, { by: id, kind: 'clue', text: null, result: 'buzz' });
    log(s, now, 'bad', `Whistle! ${nameOf(s, id)} typed "${slip}" on "${card.word}". -1`);
    nextCard(s, rand);
    return { kind: 'buzz', word: card.word, by: id, auto: true };
  }
  post(t, { by: id, kind: 'clue', text: said, result: 'clue' });
  return { kind: 'clue', by: id };
}

// ---------------------------------------------------------------- reset

function toLobby(s, now) {
  s.phase = 'lobby';
  s.turn = null;
  s.round = 0;
  s.scores = { A: 0, B: 0 };
  for (const p of s.players.filter((x) => !x.online)) removePlayer(s, p.id);
  log(s, now, 'info', 'Back in the lobby.');
}

export function reset(s, id, now) {
  if (s.phase === 'lobby' || !isHost(s, id)) return false;
  toLobby(s, now);
  return true;
}

// ---------------------------------------------------------------- views

/**
 * What one player is allowed to see. The card goes only to the storyteller
 * and the referee, and only while the clock runs; everyone else gets null, so
 * the word can't be read off the wire. For the same reason nobody else is
 * told which guesses hit a forbidden word: that would hint at the answer.
 */
export function viewFor(s, viewerId, now) {
  const t = s.turn;
  const seesCard = s.phase === 'playing' && t && (t.describer === viewerId || t.watcher === viewerId);
  return {
    code: s.code,
    phase: s.phase,
    players: s.players,
    teams: s.teams,
    hostId: hostId(s),
    settings: s.settings,
    scores: s.scores,
    round: s.round,
    roundLen: s.roundLen,
    roundTurns: s.roundTurns,
    canStart: canStart(s),
    turn: t && {
      team: t.team,
      describer: t.describer,
      watcher: t.watcher,
      skips: t.skips,
      hits: t.hits,
      countdownEndsAt: t.countdownEndsAt,
      endsAt: t.endsAt,
      cardNo: t.cardNo,
      card: seesCard ? CARDS[t.card] : null,
      unlocked: seesCard ? t.unlocked : [],
      feed: seesCard ? t.feed : t.feed.map((e) => (e.result === 'unlock' ? { ...e, result: 'miss' } : e)),
    },
    log: s.log,
    you: viewerId,
    now,
  };
}
