// Unit tests for shared/game.js. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../shared/game.js';
import { isAnswer, mentions } from '../shared/match.js';

const T0 = 1_000_000;

/** A lobby with the given players, all online, on the given teams. */
function room(teams = { A: ['a1'], B: ['b1'] }, settings = {}) {
  const s = G.createState('TEST');
  for (const t of ['A', 'B']) {
    for (const id of teams[t]) {
      G.join(s, { id, name: id }, T0);
      G.joinTeam(s, id, t, T0);
    }
  }
  const host = s.players[0].id;
  G.updateSettings(s, host, { rounds: 1, seconds: 10, ...settings });
  return { s, host };
}

/** The word on the current card. */
const answerOf = (s) => G.CARDS[s.turn.card].word;

/** Starts the current turn and returns the time it goes live. */
function goLive(s, now = T0) {
  assert.ok(G.goLive(s, s.turn.describer, now));
  const live = now + G.COUNTDOWN_MS;
  assert.ok(G.tick(s, live));
  assert.equal(s.phase, 'playing');
  return live;
}

test('only the host controls the room', () => {
  const { s } = room();
  assert.equal(G.hostId(s), 'a1');
  assert.equal(G.startGame(s, 'b1', T0), false);
  assert.equal(G.updateSettings(s, 'b1', { rounds: 5 }), false);
  assert.equal(G.shuffleTeams(s, 'b1'), false);
  assert.ok(G.startGame(s, 'a1', T0));
  assert.equal(G.reset(s, 'b1', T0), false);
  assert.equal(s.phase, 'ready');
});

test('start needs someone online on both teams', () => {
  const s = G.createState('X');
  G.join(s, { id: 'a', name: 'A' }, T0);
  G.joinTeam(s, 'a', 'A', T0);
  assert.equal(G.startGame(s, 'a', T0), false);
  G.join(s, { id: 'b', name: 'B' }, T0);
  G.joinTeam(s, 'b', 'B', T0);
  assert.ok(G.startGame(s, 'a', T0));
});

test('settings are clamped', () => {
  const { s, host } = room();
  G.updateSettings(s, host, { rounds: 99, seconds: 1 });
  assert.deepEqual(s.settings, { rounds: 10, seconds: 10 });
  G.updateSettings(s, host, { seconds: 'abc' });
  assert.equal(s.settings.seconds, 60);
});

test('the card is only sent to the storyteller and referee, only while live', () => {
  const { s, host } = room({ A: ['a1', 'a2'], B: ['b1', 'b2'] });
  G.startGame(s, host, T0);
  const { describer, watcher } = s.turn;
  assert.equal(describer, 'a1');
  assert.equal(watcher, 'b1');
  // Not before the clock starts, not even to the storyteller.
  assert.equal(G.viewFor(s, describer, T0).turn.card, null);
  const live = goLive(s);
  assert.ok(G.viewFor(s, 'a1', live).turn.card.word);
  assert.ok(G.viewFor(s, 'b1', live).turn.card.word);
  assert.equal(G.viewFor(s, 'a2', live).turn.card, null);
  assert.equal(G.viewFor(s, 'b2', live).turn.card, null);
  assert.equal(G.viewFor(s, 'nobody', live).turn.card, null);
  // The deck order never leaves the server.
  assert.equal(G.viewFor(s, 'a1', live).deck, undefined);
});

test('scoring: a typed answer +1, first skip free then -1, whistle -1; wrong seats ignored', () => {
  const { s, host } = room({ A: ['a1', 'a2'], B: ['b1'] });
  G.startGame(s, host, T0);
  const live = goLive(s);
  const card0 = s.turn.card;
  assert.equal(G.guess(s, 'a2', answerOf(s), live).kind, 'hit');
  assert.notEqual(s.turn.card, card0, 'next card straight away');
  assert.deepEqual(G.act(s, 'a1', 'skip', live)?.kind, 'skip');
  assert.deepEqual(G.act(s, 'a1', 'skip', live)?.kind, 'skip');
  assert.deepEqual(G.act(s, 'b1', 'buzz', live)?.kind, 'buzz');
  assert.deepEqual(s.scores, { A: -1, B: 0 });
  // Seat checks: the referee can't guess or skip, the storyteller can't
  // guess or whistle, and there is no score button any more.
  assert.equal(G.guess(s, 'b1', answerOf(s), live + 1000), null);
  assert.equal(G.guess(s, 'a1', answerOf(s), live + 1000), null);
  assert.equal(G.act(s, 'b1', 'skip', live), null);
  assert.equal(G.act(s, 'a1', 'buzz', live), null);
  assert.equal(G.act(s, 'a1', 'hit', live), null);
  assert.deepEqual(s.scores, { A: -1, B: 0 });
});

test('guesses: typos and articles count, wrong words just go to the feed', () => {
  const { s, host } = room({ A: ['a1', 'a2', 'a3'], B: ['b1'] });
  G.startGame(s, host, T0);
  let now = goLive(s);
  const cardAt = (word) => {
    s.turn.card = G.CARDS.findIndex((c) => c.word === word);
    s.turn.unlocked = [];
  };
  cardAt('Penguin');
  assert.equal(G.guess(s, 'a2', 'seal', now).kind, 'miss');
  assert.equal(s.scores.A, 0);
  assert.equal(G.guess(s, 'a2', 'Pengun', (now += 1000)).kind, 'hit');
  cardAt('Penguin');
  assert.equal(G.guess(s, 'a3', '  a PENGUINS! ', now).kind, 'hit');
  assert.equal(s.scores.A, 2);
  assert.equal(s.turn.hits, 2);
  const feed = s.turn.feed;
  assert.deepEqual(feed.map((e) => [e.by, e.result]), [['a2', 'miss'], ['a2', 'hit'], ['a3', 'hit']]);
  assert.equal(feed[0].card, 1);
  assert.equal(s.turn.cardNo, 3);
});

test('guesses are rate limited per player, and ignored when empty', () => {
  const { s, host } = room({ A: ['a1', 'a2', 'a3'], B: ['b1'] });
  G.startGame(s, host, T0);
  const now = goLive(s);
  assert.equal(G.guess(s, 'a2', 'one', now).kind, 'miss');
  assert.equal(G.guess(s, 'a2', 'two', now + 100), null);
  assert.equal(G.guess(s, 'a3', 'two', now + 100).kind, 'miss', 'others are not held back');
  assert.equal(G.guess(s, 'a2', 'two', now + G.GUESS_GAP_MS).kind, 'miss');
  assert.equal(G.guess(s, 'a3', '   ', now + 5000), null);
  assert.equal(G.guess(s, 'a3', 'x'.repeat(500), now + 6000).kind, 'miss');
  assert.equal(s.turn.feed.at(-1).text.length, G.GUESS_MAX);
});

test('a guessed forbidden word unlocks, and only the card holders are told', () => {
  const { s, host } = room({ A: ['a1', 'a2'], B: ['b1', 'b2'] });
  G.startGame(s, host, T0);
  const now = goLive(s);
  s.turn.card = G.CARDS.findIndex((c) => c.word === 'Penguin');
  const forbidden = G.CARDS[s.turn.card].forbidden;
  const tux = forbidden.findIndex((w) => w === 'Tuxedo');
  assert.ok(tux >= 0, 'test card has Tuxedo');
  assert.equal(G.guess(s, 'a2', 'a black tuxedo', now).kind, 'unlock');
  assert.deepEqual(s.turn.unlocked, [tux]);
  // Saying it again doesn't unlock twice.
  assert.equal(G.guess(s, 'a2', 'tuxedos', now + 1000).kind, 'miss');
  assert.deepEqual(G.viewFor(s, 'a1', now).turn.unlocked, [tux]);
  assert.deepEqual(G.viewFor(s, 'b1', now).turn.unlocked, [tux]);
  // The guessers themselves just see a wrong guess: "that was a forbidden
  // word" would be a clue.
  const theirs = G.viewFor(s, 'a2', now).turn;
  assert.deepEqual(theirs.unlocked, []);
  assert.equal(theirs.feed[0].result, 'miss');
  assert.equal(G.viewFor(s, 'b2', now).turn.feed[0].result, 'miss');
  // A new card starts with everything forbidden again.
  G.act(s, 'a1', 'skip', now);
  assert.deepEqual(s.turn.unlocked, []);
});

test('typed clues: clean ones are shown, a forbidden or answer word is an automatic whistle', () => {
  const { s, host } = room({ A: ['a1', 'a2'], B: ['b1'] });
  G.startGame(s, host, T0);
  const now = goLive(s);
  const pin = (word) => (s.turn.card = G.CARDS.findIndex((c) => c.word === word));
  pin('Penguin');
  assert.equal(G.clue(s, 'a2', 'black and white', now), null, 'only the storyteller types clues');
  assert.equal(G.clue(s, 'a1', 'black and white, lives somewhere cold', now).kind, 'clue');
  assert.equal(s.turn.feed.at(-1).text, 'black and white, lives somewhere cold');
  assert.equal(s.scores.A, 0);
  // Typos never cost a point: "tuxdo" is not "tuxedo".
  assert.equal(G.clue(s, 'a1', 'wears a tuxdo', now).kind, 'clue');

  const whistle = G.clue(s, 'a1', 'wears TUXEDOS', now);
  assert.equal(whistle.kind, 'buzz');
  assert.equal(whistle.word, 'Penguin');
  assert.equal(s.scores.A, -1);
  const hidden = s.turn.feed.at(-1);
  assert.equal(hidden.text, null, 'a slipped clue is never shown');
  assert.equal(hidden.result, 'buzz');
  assert.notEqual(G.CARDS[s.turn.card].word, 'Penguin');

  // Once a guesser has said a forbidden word, the storyteller may use it.
  pin('Penguin');
  G.guess(s, 'a2', 'tuxedo', now);
  assert.equal(G.clue(s, 'a1', 'wears a tuxedo', now).kind, 'clue');
  // Saying the answer is always a whistle.
  assert.equal(G.clue(s, 'a1', 'baby penguins', now).kind, 'buzz');
  pin('Hot Dog');
  assert.equal(G.clue(s, 'a1', 'a dog you eat', now).kind, 'buzz', 'part of the answer');
  assert.equal(s.scores.A, -3);
});

test('regression: actions with no live card are ignored, never thrown', () => {
  const { s, host } = room({ A: ['a1', 'a2'], B: ['b1'] });
  const tryAll = (now) => [
    G.act(s, 'a1', 'skip', now),
    G.act(s, 'b1', 'buzz', now),
    G.guess(s, 'a2', 'anything', now),
    G.clue(s, 'a1', 'anything', now),
  ];
  const none = [null, null, null, null];
  assert.deepEqual(tryAll(T0), none); // lobby
  G.startGame(s, host, T0);
  assert.deepEqual(tryAll(T0), none); // ready
  G.goLive(s, 'a1', T0);
  assert.deepEqual(tryAll(T0 + 1), none); // countdown
  G.tick(s, T0 + G.COUNTDOWN_MS);
  assert.equal(s.phase, 'playing');
  const end = s.turn.endsAt;
  // The exact answer, one moment too late: time is up even if the alarm
  // hasn't fired yet.
  assert.equal(G.guess(s, 'a2', answerOf(s), end), null);
  assert.deepEqual(tryAll(end), none);
  G.tick(s, end); // turn over
  assert.deepEqual(tryAll(end), none);
  assert.deepEqual(s.scores, { A: 0, B: 0 });
});

test('regression: reset during the countdown stays reset', () => {
  const { s, host } = room();
  G.startGame(s, host, T0);
  G.goLive(s, 'a1', T0);
  assert.equal(s.phase, 'countdown');
  assert.ok(G.reset(s, host, T0 + 1000));
  assert.equal(G.tick(s, T0 + 60_000), false);
  assert.equal(s.phase, 'lobby');
  assert.equal(G.nextDeadline(s), null);
});

test('only the storyteller can go live, once', () => {
  const { s, host } = room();
  G.startGame(s, host, T0);
  assert.equal(G.goLive(s, 'b1', T0), false);
  assert.ok(G.goLive(s, 'a1', T0));
  assert.equal(G.goLive(s, 'a1', T0), false);
});

test('turns and rounds start by themselves if nobody presses go', () => {
  const { s, host } = room({ A: ['a1'], B: ['b1'] }, { rounds: 2 });
  G.startGame(s, host, T0);
  assert.equal(G.nextDeadline(s), T0 + G.READY_MS);
  assert.equal(G.tick(s, T0 + G.READY_MS - 1), false);
  assert.ok(G.tick(s, T0 + G.READY_MS));
  assert.equal(s.phase, 'countdown');
  // The countdown runs from the deadline, not from a late alarm.
  G.tick(s, T0 + G.READY_MS + 500);
  assert.equal(s.turn.countdownEndsAt, T0 + G.READY_MS + G.COUNTDOWN_MS);
  G.tick(s, s.turn.countdownEndsAt);
  assert.equal(s.phase, 'playing');
  // Both turns of round 1 run out.
  G.tick(s, s.turn.endsAt);
  G.tick(s, s.turn.readyEndsAt);
  G.tick(s, s.turn.countdownEndsAt);
  const end = s.turn.endsAt;
  G.tick(s, end);
  assert.equal(s.phase, 'round_over');
  assert.equal(G.nextDeadline(s), end + G.BREAK_MS);
  G.tick(s, end + G.BREAK_MS);
  assert.equal(s.phase, 'ready');
  assert.equal(s.round, 2);
  assert.equal(s.breakEndsAt, null);
});

test('a stalled turn waits, and a new storyteller gets a fresh grace period', () => {
  const { s, host } = room({ A: ['a1', 'a2'], B: ['b1'] });
  G.startGame(s, host, T0);
  G.leave(s, 'a1', T0 + 10_000);
  assert.equal(s.turn.describer, 'a2');
  assert.equal(s.turn.readyEndsAt, T0 + 10_000 + G.READY_MS);
  G.leave(s, 'a2', T0 + 11_000);
  assert.equal(s.turn.readyEndsAt, null);
  assert.equal(G.nextDeadline(s), null);
  assert.equal(G.tick(s, T0 + 999_999), false);
  assert.equal(s.phase, 'ready');
});

test('turn clock is measured from the end of the countdown', () => {
  const { s, host } = room({ A: ['a1'], B: ['b1'] }, { seconds: 30 });
  G.startGame(s, host, T0);
  G.goLive(s, 'a1', T0);
  assert.equal(G.nextDeadline(s), T0 + G.COUNTDOWN_MS);
  // A late alarm must not steal time from the turn.
  G.tick(s, T0 + G.COUNTDOWN_MS + 700);
  assert.equal(s.turn.endsAt, T0 + G.COUNTDOWN_MS + 30_000);
});

test('a full match: turns alternate, roles rotate, rounds end, game ends', () => {
  const { s, host } = room({ A: ['a1', 'a2'], B: ['b1'] }, { rounds: 2 });
  G.startGame(s, host, T0);
  let now = T0;
  const seen = [];
  const rounds = [];
  while (s.phase !== 'over') {
    if (s.phase === 'round_over') {
      rounds.push(s.round);
      assert.equal(G.nextRound(s, 'b1', now), false, 'non-host cannot advance');
      assert.ok(G.nextRound(s, host, now));
      continue;
    }
    seen.push(`${s.round}:${s.turn.team}:${s.turn.describer}/${s.turn.watcher}`);
    now = goLive(s, now);
    G.act(s, s.turn.describer, 'skip', now); // first skip is free
    now = s.turn.endsAt;
    G.tick(s, now);
    assert.ok(seen.length < 20, 'match must terminate');
  }
  // Two turns per team per round (the bigger team has two players); round 2
  // is opened by Bravo.
  assert.deepEqual(seen, [
    '1:A:a1/b1', '1:B:b1/a1', '1:A:a2/b1', '1:B:b1/a2',
    '2:B:b1/a1', '2:A:a1/b1', '2:B:b1/a2', '2:A:a2/b1',
  ]);
  assert.deepEqual(rounds, [1]);
  assert.deepEqual(s.scores, { A: 0, B: 0 });
  assert.equal(s.turn.card, null);
  assert.equal(G.viewFor(s, 'a1', now).turn.card, null);
  assert.match(s.log.at(-1).text, /draw/);
});

test('a storyteller who leaves before going live is replaced', () => {
  const { s, host } = room({ A: ['a1', 'a2'], B: ['b1'] });
  G.startGame(s, host, T0);
  assert.equal(s.turn.describer, 'a1');
  G.leave(s, 'a1', T0);
  assert.equal(s.turn.describer, 'a2');
  // Hosting passed on too.
  assert.equal(G.hostId(s), 'a2');
  // And comes back to the original host on return.
  G.join(s, { id: 'a1', name: 'a1' }, T0);
  assert.equal(G.hostId(s), 'a1');
});

test('offline players are skipped in the rotation', () => {
  const { s, host } = room({ A: ['a1', 'a2', 'a3'], B: ['b1'] });
  G.leave(s, 'a2', T0); // lobby: removed outright
  assert.equal(G.findPlayer(s, 'a2'), undefined);
  assert.deepEqual(s.teams.A, ['a1', 'a3']);
  G.join(s, { id: 'a2', name: 'a2' }, T0);
  G.joinTeam(s, 'a2', 'A', T0);
  G.startGame(s, host, T0);
  goLive(s);
  const end1 = s.turn.endsAt;
  G.tick(s, end1); // a1 done, b1's turn
  G.leave(s, 'a3', end1); // in game: kept, but skipped
  assert.ok(G.findPlayer(s, 'a3'));
  goLive(s, end1);
  G.tick(s, s.turn.endsAt);
  assert.equal(s.turn.describer, 'a2');
});

test('a team with nobody online can have its turn passed by the host', () => {
  const { s, host } = room({ A: ['a1'], B: ['b1', 'b2'] });
  G.startGame(s, host, T0);
  goLive(s);
  const now = s.turn.endsAt;
  G.tick(s, now);
  assert.equal(s.turn.team, 'B');
  // Nil's storyteller leaves, and b2 steps in; then b2 leaves too.
  G.leave(s, 'b1', now);
  assert.equal(s.turn.describer, 'b2');
  G.leave(s, 'b2', now);
  assert.equal(s.turn.describer, null);
  assert.equal(G.skipTurn(s, 'b2', now), false);
  assert.ok(G.skipTurn(s, host, now));
  assert.equal(s.turn.team, 'A');
});

test('the referee who leaves mid-turn is replaced', () => {
  const { s, host } = room({ A: ['a1'], B: ['b1', 'b2'] });
  G.startGame(s, host, T0);
  const live = goLive(s);
  assert.equal(s.turn.watcher, 'b1');
  G.leave(s, 'b1', live);
  assert.equal(s.turn.watcher, 'b2');
  assert.equal(G.act(s, 'b2', 'buzz', live)?.kind, 'buzz');
});

test('everyone leaving parks the room in the lobby', () => {
  const { s, host } = room();
  G.startGame(s, host, T0);
  G.leave(s, 'a1', T0);
  G.leave(s, 'b1', T0);
  assert.equal(s.phase, 'lobby');
  assert.equal(s.players.length, 0);
});

test('reconnecting keeps your seat and team', () => {
  const { s, host } = room();
  G.startGame(s, host, T0);
  G.leave(s, 'b1', T0);
  G.join(s, { id: 'b1', name: 'b1 renamed' }, T0);
  const p = G.findPlayer(s, 'b1');
  assert.equal(p.team, 'B');
  assert.equal(p.online, true);
  assert.equal(p.name, 'b1 renamed');
});

test('deck deals every card before repeating', () => {
  const { s, host } = room();
  G.startGame(s, host, T0);
  const live = goLive(s);
  const dealt = new Set([s.turn.card]);
  for (let i = 1; i < G.CARDS.length; i++) {
    G.act(s, 'a1', 'skip', live);
    dealt.add(s.turn.card);
  }
  assert.equal(dealt.size, G.CARDS.length);
  G.act(s, 'a1', 'skip', live); // reshuffles without throwing
  assert.ok(G.CARDS[s.turn.card]);
});

test('names are trimmed and bounded', () => {
  assert.equal(G.sanitizeName('   '), 'Player');
  assert.equal(G.sanitizeName('  a   b '), 'a b');
  assert.equal(G.sanitizeName('x'.repeat(100)).length, 24);
});

test('deck data is well formed', () => {
  assert.ok(G.CARDS.length >= 100);
  const words = new Set();
  for (const c of G.CARDS) {
    assert.equal(typeof c.word, 'string');
    assert.equal(c.forbidden.length, 5, c.word);
    // A forbidden word that counted as the answer would score by accident.
    for (const f of c.forbidden) assert.ok(!isAnswer(f, c.word), `${c.word} / ${f}`);
    assert.ok(!words.has(c.word.toLowerCase()), `duplicate ${c.word}`);
    words.add(c.word.toLowerCase());
  }
});

test('matching: forgiving for guesses, strict where a point is at stake', () => {
  assert.ok(isAnswer('the  Traffic-light!', 'Traffic Light'));
  assert.ok(isAnswer('trafficlight', 'Traffic Light'));
  assert.ok(isAnswer('traffic lihgt', 'Traffic Light'));
  assert.ok(isAnswer('Cats', 'Cat'));
  assert.ok(isAnswer('café', 'Cafe'));
  assert.ok(isAnswer('Pengiun', 'Penguin'), 'swapped letters');
  assert.ok(isAnswer('Microwve', 'Microwave'), 'missing letter');
  assert.ok(isAnswer('Microwsve', 'Microwave'), 'long words forgive a wrong letter');
  assert.ok(!isAnswer('car', 'Cat'), 'short words must be exact');
  assert.ok(!isAnswer('house', 'Mouse'), 'a changed letter is a different word');
  assert.ok(!isAnswer('Grandpa', 'Grandma'));
  assert.ok(!isAnswer('cat dog', 'Dog'), 'no hedging with lists');
  assert.ok(!isAnswer('', 'Dog'));
  assert.ok(mentions('pot of gold at the end', 'Pot of Gold'));
  assert.ok(mentions('it flies', 'Fly') === false, 'three letters are never matched as a prefix');
  assert.ok(mentions('smoky flames', 'Flame'));
  assert.ok(mentions('a black tuxdo', 'Tuxedo'), 'typos unlock (harmless)');
  assert.ok(!mentions('a black tuxdo', 'Tuxedo', { typos: false }), 'typos never whistle');
  assert.ok(mentions('X-rays', 'X-Ray', { typos: false }));
});
