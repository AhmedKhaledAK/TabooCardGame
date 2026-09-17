# Laff w Dawaran · لف ودوران

A team party game about talking your way around a word, playable as a **Discord Activity**
or on the **web** with a table code.

- The **Hakawati** (storyteller) sees a card and describes the word without saying it
  or any of its five **mamnou3** (forbidden) words. They can talk, or type clues.
- Their teammates **type guesses**. The right word scores +1 and the next card appears
  at once, with no button to press. Typos are forgiven.
- If a guesser types one of the mamnou3 words, it turns **green** on the card, and the
  Hakawati may use it from then on.
- The **Hakam** (referee) from the other team sees the card too and blows the whistle on
  a forbidden word said out loud (−1). Typed clues are checked automatically: a clue
  containing a red word or the answer is whistled on the spot, and nobody sees it.
- Skipping a card is free once per turn, then −1. Turns start by themselves after 15s,
  and the next round after 20s, unless someone presses the button first.

Teams are **Shams** (the sun) and **Nil** (the Nile).

## How it's built

| Path | What |
|---|---|
| `client/` | React 19 + Vite + Tailwind 4. `src/lib/discord.js` is the Discord SDK handshake and sign-in, `src/lib/room.js` is the room socket. |
| `shared/game.js` | The rules as pure functions with an injected clock. Used by the server and the tests. |
| `shared/match.js` | Matching typed guesses and clues: typos, plurals, articles. |
| `shared/cards.json` | 150 cards: `{ word, forbidden: [5 words] }`. |
| `worker/` | Cloudflare Worker: `/api/token` (OAuth), and one Durable Object per table (`/api/room/discord/<instanceId>` or `/api/room/web/<CODE>`). It serves `dist/` for everything else. |
| `scripts/` | `game.test.mjs` (unit tests) and `test-room.mjs` (end-to-end over real sockets). |

The server owns the clock and the deck. Only the Hakawati and the Hakam are sent the card,
and only while the clock runs. In Discord rooms, players are verified with their Discord
token, so nobody can pose as the Hakawati to read the card.

Requires **Node 22+**.

```bash
npm install
npm test              # rules
npm run lint
```

## Play on the web (no Discord needed)

```bash
npm run dev:api   # terminal 1: the Worker on :8788
npm run dev       # terminal 2: the app on http://localhost:5173
```

Open a table, then open the copied link in another tab or browser. Each tab is its own
player, so one person can try every seat.

End-to-end room test:

```bash
npm run dev:test    # terminal 1: the Worker, with test-only identities allowed
npm run test:room   # terminal 2
```

## Discord setup (one time)

### 1. Create the application

1. <https://discord.com/developers/applications> → **New Application** → name it
   `Laff w Dawaran`.
2. **Installation** → Installation Contexts: tick **User Install** and **Guild Install**.
3. **OAuth2** → Redirects: add `https://127.0.0.1`. It's a placeholder: the Activity
   flow never redirects, but the portal wants one.
4. **OAuth2**: copy the **Client ID**. Then **Reset Secret** and copy the
   **Client Secret**, which is shown only once.

### 2. Local config

```bash
cp .env.example .env            # VITE_DISCORD_CLIENT_ID (public, built into the app)
cp .dev.vars.example .dev.vars  # DISCORD_CLIENT_ID + DISCORD_CLIENT_SECRET (server only)
```

Put the client ID in **both** files. If only `.dev.vars` has it, the Discord
handshake never finishes. Both files are gitignored. Restart `npm run dev` after
editing `.env`.

### 3. Start a tunnel (you need its hostname for step 4)

```bash
npm run dev:api      # terminal 1
npm run dev:tunnel   # terminal 2: Vite with HMR routed through the tunnel
npm run tunnel       # terminal 3: prints https://<random-words>.trycloudflare.com
```

### 4. URL mappings, then enable Activities (in this order)

**Activities → URL Mappings**, two rows:

| Prefix | Target |
|---|---|
| `/` | the tunnel hostname, without `https://` |
| `/cdn` | `cdn.discordapp.com` (for avatars; without it, players get coloured initials) |

Then **Activities → Settings → Enable Activities**. The portal refuses to do this
before a URL mapping exists.

### 5. Launch

Install the app to a server you own: **Installation → Install Link → Discord Provided
Link**. In a voice channel, open the **App Launcher** (rocket icon) and start
**Laff w Dawaran**. Use **Invite** in the top bar to bring friends in.

The trycloudflare hostname changes every time the tunnel restarts, so paste the new one
into the `/` mapping each session.

| Symptom | Cause |
|---|---|
| "Couldn't reach Discord" after 10s | `.env` still has the placeholder client ID, or Vite wasn't restarted, or the `/` mapping points at a dead tunnel |
| "Couldn't sign you in" | `.dev.vars` is missing or wrong, or `npm run dev:api` isn't running |
| Blank iframe, `blocked:csp` in the console | A URL mapping is missing, or something requested an unmapped domain |
| "Discord didn't let you in" | The room couldn't verify the token. Relaunch the Activity. |

## Deploying (Cloudflare, free plan)

1. Set the public `DISCORD_CLIENT_ID` under `[vars]` in `wrangler.toml`, and put the same
   ID in `.env` so the build picks it up.
2. Run:

   ```bash
   npx wrangler login
   npx wrangler secret put DISCORD_CLIENT_SECRET
   npm run deploy        # builds, then deploys; the first run creates the Durable Object class
   ```

3. Point the portal's `/` URL mapping at the deployed hostname, without `https://`.
   Keep the `/cdn` row.

To use a custom domain, uncomment `routes` in `wrangler.toml` (the planned one is
`laff.twograins.app`). Durable Objects on the SQLite backend run on the free plan.
To check that the Worker bundles without deploying: `npx wrangler deploy --dry-run`.

## Adding cards

Edit `shared/cards.json`. Each card needs exactly five forbidden words. `npm test` fails
if a word is duplicated, or if a forbidden word is close enough to the answer that
typing it would score (like *Grandpa* on *Grandma*).
