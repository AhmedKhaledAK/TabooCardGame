# AGENTS.md: Laff w Dawaran

Read `README.md` for what the game is and how to run it. This file covers the rules
that are easy to break.

## Machine and tooling

- **Node 22+.** `wrangler` fails on Node 20.
- **Don't bump `wrangler` (pinned 4.86.0) or the `workerd` override (1.20260426.1)**
  without checking that `npm run dev:api` still starts. On the owner's Windows machine,
  Application Control blocks newer `workerd.exe` builds, and the symptom is
  `spawn UNKNOWN`.
- Stopping a backgrounded `wrangler dev` can leave `workerd.exe` running and still
  holding port 8788. A later `dev:test` then silently shares the port with the old,
  non-test server, and `test:room` fails with 4001. Check with
  `Get-NetTCPConnection -LocalPort 8788` before assuming the code is broken.

## Checks before handing work back

```bash
npm test          # rules (node:test)
npm run lint
npm run build
npm run dev:test & npm run test:room   # when worker/ or shared/ changed
```

## Architecture rules

- **Rules live in `shared/game.js` only**, as pure functions `(state, …, now, rand)`.
  No I/O, no `Date.now()`, no timers. The Durable Object (`worker/room.js`) loads the
  state, calls one rule, saves, broadcasts, and sets the alarm to `nextDeadline(state)`.
  Every timed phase (ready → countdown → playing, round_over → next round) must go
  through `tick()` and `nextDeadline()`.
- Mutating rules return something falsy when nothing changed. The room only saves and
  broadcasts on a truthy result, and ignores stale or out-of-seat actions silently.
  Never throw on bad input: a thrown error used to take down every table on the old
  Node server.
- **Secrecy is enforced in `viewFor()`**:
  - Only the describer (Hakawati) and watcher (Hakam) get `turn.card` and
    `turn.unlocked`, and only in `playing`.
  - Everyone else sees `unlock` feed results downgraded to `miss`, because knowing a
    guess was forbidden is a hint.
  - A clue that slipped is stored with `text: null`.
  - The deck never leaves the server.
  - Any new field that could reveal the word must go through the same filter.
- Bump `STATE_VERSION` whenever the stored state shape changes. Rooms drop state from an
  older version rather than half-reading it.
- Identity: in Discord rooms the server verifies the access token with Discord
  (`/users/@me`). Claimed ids are accepted only in web rooms, or when
  `ALLOW_UNVERIFIED=true` (the `dev:test` script). Never make claimed ids work in
  Discord rooms in production.
- Web rooms exist only after a `?create=1` connection. Refusals (4001 unauthorized,
  4004 no such room, 4009 code taken) are sent at `hello` as an error message followed
  by a close, never before the WebSocket upgrade, because the close code gets lost there.
- The client sends exactly `{"t":"ping"}` as its keep-alive, and the runtime
  auto-answers it without waking the room. Don't change one string without the other.

## Matching (`shared/match.js`)

- Guesses are forgiving. Clue checks are strict (`typos: false`), because a typo must
  never cost a point.
- In words under 8 letters, a changed letter is never forgiven: house/mouse and
  grandma/grandpa are different words. A missing letter, an extra letter, or two
  swapped letters are fine.
- A guess must be the whole answer, apart from articles and spacing. Lists don't count.
- The unit tests guard the deck: no duplicate words, and no forbidden word that would
  count as its card's answer.

## Client

- Discord mode is chosen by the `frame_id` query param. The SDK is a module-level
  singleton, loaded lazily (StrictMode double effects must not create two).
- **No external requests of any kind.** The Activity CSP blocks them. Fonts are bundled
  (`@fontsource`), avatars go through the `/cdn` URL mapping, sounds are synthesised.
- `hello` passed to `useRoom` must be memoised. A new object means a new connection.
- Timers use `state.offset` (server clock minus client clock), not the client's raw clock.
- Theme tokens are in `client/src/index.css` (`@theme`) and the team styling is in
  `client/src/lib/teams.js`. Green means right or allowed, red means mamnou3; don't reuse
  either for anything else.

## Human gates

Deploying (`npm run deploy`), `wrangler secret put`, and changes to the Discord developer
portal need the owner's explicit OK. Secrets live only in `.dev.vars` (gitignored) and in
Cloudflare secrets.
