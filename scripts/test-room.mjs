// End-to-end room test over real WebSockets.
//
//   npm run dev:test        (terminal 1: wrangler dev with ALLOW_UNVERIFIED)
//   npm run test:room       (terminal 2)
//
// Drives the Durable Object the way browsers do: players join, pick teams,
// play a turn with typed guesses and clues until the server's clock runs out,
// and try the things that used to break the old Node server.
import WebSocket from 'ws';

const BASE = process.env.BASE ?? 'ws://127.0.0.1:8788';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
let checks = 0;
function check(ok, label) {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
}

class Client {
  constructor(path, id, name) {
    this.id = id;
    this.name = name;
    this.state = null;
    this.fx = [];
    this.closed = null;
    this.ws = new WebSocket(BASE + path);
    this.ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.t === 'state') this.state = m.s;
      if (m.t === 'fx') this.fx.push(m.kind);
    });
    this.ws.on('close', (code) => (this.closed = code));
    this.open = new Promise((res, rej) => {
      this.ws.once('open', res);
      this.ws.once('error', rej);
    });
  }
  async hello() {
    await this.open;
    this.send({ t: 'hello', id: this.id, name: this.name });
  }
  send(m) {
    this.ws.send(JSON.stringify(m));
  }
  close() {
    this.ws.close();
  }
}

async function until(fn, label, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(25);
  }
  check(false, `timed out: ${label}`);
  return false;
}

const room = `/api/room/discord/test-${Date.now()}`;

// --- joining and host rules
const alice = new Client(room, 'alice-1', 'Alice');
await alice.hello();
await until(() => alice.state, 'alice state');
check(alice.state.hostId === 'alice-1', 'first player is host');

const bob = new Client(room, 'bob-12', 'Bob');
const cara = new Client(room, 'cara-1', 'Cara');
const dave = new Client(room, 'dave-1', 'Dave');
await Promise.all([bob.hello(), cara.hello(), dave.hello()]);
await until(() => alice.state.players.length === 4, 'four players');

bob.send({ t: 'settings', rounds: 7 });
alice.send({ t: 'team', team: 'A' });
await until(() => alice.state.teams.A.length === 1, 'alice on shams');
dave.send({ t: 'team', team: 'A' });
// Separate sockets have no ordering between them; seat order matters below.
bob.send({ t: 'team', team: 'B' });
await until(() => alice.state.teams.B.length === 1, 'bob on bravo');
cara.send({ t: 'team', team: 'B' });
alice.send({ t: 'settings', rounds: 1, seconds: 10 });
await until(() => alice.state.settings.seconds === 10 && alice.state.teams.B.length === 2 && alice.state.teams.A.length === 2, 'teams + settings');
check(alice.state.settings.rounds === 1, 'non-host settings ignored, host settings applied');

bob.send({ t: 'start' });
await sleep(300);
check(alice.state.phase === 'lobby', 'non-host cannot start');

// --- regression: a game action with no card used to crash the whole server
bob.send({ t: 'guess', text: 'pizza' });
alice.send({ t: 'clue', text: 'food' });
alice.send({ t: 'act', action: 'buzz' });
await sleep(200);
check(alice.closed === null && bob.closed === null, 'stray actions do not kill the server');

alice.send({ t: 'start' });
await until(() => alice.state.phase === 'ready', 'ready');
check(alice.state.turn.describer === 'alice-1', 'alice tells the first story');
check(alice.state.turn.watcher === 'bob-12', 'bob referees first');

// --- regression: reset during countdown used to resurrect the game
alice.send({ t: 'go' });
await until(() => alice.state.phase === 'countdown', 'countdown');
bob.send({ t: 'reset' });
await sleep(200);
check(alice.state.phase === 'countdown', 'non-host cannot reset');
alice.send({ t: 'reset' });
await until(() => alice.state.phase === 'lobby', 'reset to lobby');
await sleep(3500);
check(alice.state.phase === 'lobby' && bob.state.phase === 'lobby', 'reset survives the countdown alarm');

// --- a real turn, ended by the server's alarm
alice.send({ t: 'start' });
await until(() => alice.state.phase === 'ready', 'ready again');
check(alice.state.turn.card === null, 'no card before going live');
alice.send({ t: 'go' });
await until(() => alice.state.phase === 'playing', 'playing', 6000);
check(!!alice.state.turn.card?.word, 'storyteller sees the card');
check(!!bob.state.turn.card?.word, 'referee sees the card');
check(cara.state.turn.card === null && dave.state.turn.card === null, 'guessers and the other team do not see the card');
check(bob.state.turn.card.word === alice.state.turn.card.word, 'same card for both seats');
check(!('deck' in alice.state), 'deck never leaves the server');

// A wrong guess lands in everyone's feed and changes nothing else.
dave.send({ t: 'guess', text: 'definitely not it' });
await until(() => cara.state.turn.feed.length === 1, 'guess in the feed');
check(cara.state.turn.feed[0].text === 'definitely not it' && alice.state.scores.A === 0, 'wrong guess shown, not scored');

// A clean clue is shown to everyone.
alice.send({ t: 'clue', text: 'zzq qqz' });
await until(() => dave.state.turn.feed.some((e) => e.kind === 'clue'), 'clue in the feed');

// Typing a forbidden word turns it green for the card holders only.
const card1 = alice.state.turn.card;
await sleep(400); // guess rate limit
dave.send({ t: 'guess', text: card1.forbidden[0] });
await until(() => alice.state.turn.unlocked.length === 1, 'forbidden word unlocked');
check(bob.state.turn.unlocked.length === 1, 'referee sees the unlock');
check(dave.state.turn.unlocked.length === 0 && dave.state.turn.feed.at(-1).result === 'miss', 'guesser is not told it was forbidden');

// The right answer scores and deals a new card without anyone pressing anything.
await sleep(400);
dave.send({ t: 'guess', text: card1.word.toLowerCase() });
await until(() => alice.state.scores.A === 1, 'typed answer scored');
check(alice.state.turn.card.word !== card1.word, 'new card straight after the answer');
check(alice.state.turn.unlocked.length === 0, 'new card starts fully forbidden');
await until(() => cara.fx.includes('hit'), 'fx reaches everyone');
check(alice.fx.includes('hit') && dave.fx.includes('hit'), 'fx broadcast');

// Wrong seats are ignored; the referee's whistle and a slipped clue cost a point each.
bob.send({ t: 'guess', text: alice.state.turn.card.word });
cara.send({ t: 'act', action: 'buzz' });
dave.send({ t: 'clue', text: 'hello' });
bob.send({ t: 'act', action: 'buzz' });
await until(() => alice.state.scores.A === 0, 'whistle scored');
const card2 = alice.state.turn.card;
alice.send({ t: 'clue', text: `it is like ${card2.word}` });
await until(() => alice.state.scores.A === -1, 'slipped clue whistled');
check(alice.state.turn.feed.at(-1).text === null, 'slipped clue is never shown');
check(alice.state.scores.B === 0, 'wrong seats ignored');

// Bob drops and comes back mid-turn: same seat, card again.
bob.close();
await until(() => alice.state.players.find((p) => p.id === 'bob-12')?.online === false, 'bob offline');
check(alice.state.turn.watcher === 'cara-1', 'referee seat passes to cara');
const bob2 = new Client(room, 'bob-12', 'Bob');
await bob2.hello();
await until(() => bob2.state && alice.state.players.find((p) => p.id === 'bob-12')?.online, 'bob back');
check(bob2.state.players.find((p) => p.id === 'bob-12').team === 'B', 'bob kept his team');
check(bob2.state.turn.card === null && !!cara.state.turn.card, 'card follows the referee seat');

const endsAt = alice.state.turn.endsAt;
await until(() => alice.state.turn.team === 'B', 'server ends the turn', endsAt - Date.now() + 3000);
check(alice.state.phase === 'ready', 'next turn waits for its storyteller');
check(alice.state.turn.card === null && bob2.state.turn.card === null, 'card hidden between turns');
check(alice.state.log.some((l) => l.text.includes('Time!')), 'turn end logged');

// Nil's storyteller leaves before going live: the seat passes on.
const bravoMic = alice.state.turn.describer;
const [leaver, stayer] = bravoMic === 'bob-12' ? [bob2, cara] : [cara, bob2];
leaver.close();
await until(() => alice.state.turn.describer === stayer.id, 'story passes to the teammate');

// --- web rooms
const ghost = new Client('/api/room/web/ZZZZZ', 'ghost-1', 'Ghost');
await ghost.hello();
await until(() => ghost.closed !== null, 'unknown web room closes');
check(ghost.closed === 4004, 'unknown web code is rejected (4004)');

const code = Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'X').padEnd(5, 'X');
const host = new Client(`/api/room/web/${code}?create=1`, 'webhost-1', 'Host');
await host.hello();
await until(() => host.state, 'web room created');
check(host.state.code === code, 'web room carries its code');
const guest = new Client(`/api/room/web/${code}`, 'webguest-1', 'Guest');
await guest.hello();
await until(() => host.state.players.length === 2, 'guest joined by code');
const dupe = new Client(`/api/room/web/${code}?create=1`, 'dupe-1', 'Dupe');
await dupe.hello();
await until(() => dupe.closed !== null, 'duplicate create closes');
check(dupe.closed === 4009, 'creating over a live code is refused (4009)');

// Leaving in the lobby removes you entirely.
guest.close();
await until(() => host.state.players.length === 1, 'lobby leaver removed');

for (const c of [alice, dave, stayer, host]) c.close();
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
