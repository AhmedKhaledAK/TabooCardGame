/* global WebSocketPair, WebSocketRequestResponsePair */
import { DurableObject } from 'cloudflare:workers';
import * as G from '../shared/game.js';

/**
 * One Laff w Dawaran room. A Discord Activity launch (keyed by instanceId) or a
 * web room (keyed by its join code) maps to exactly one of these.
 *
 * The rules live in shared/game.js. This class only does the plumbing around
 * them: who is on which socket, persisting the state, and the alarm that
 * drives the countdown and turn clock. The server owns the clock, so a turn
 * ends on time even if the storyteller's tab is closed.
 *
 * Sockets are hibernatable: an idle room is evicted from memory without
 * dropping anyone, and the state is reloaded from storage on wake. That is
 * why nothing important lives only in a field of this class.
 */

/** Idle rooms are wiped this long after their last change. */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const UNAUTHORIZED = 4001;
const NOT_FOUND = 4004;
const TAKEN = 4009;

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /** Access token -> verified Discord user, so a reconnect doesn't re-ask Discord. */
    this.verified = new Map();
    // Keep-alive pings are answered by the runtime without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    ctx.blockConcurrencyWhile(async () => {
      const s = await ctx.storage.get('state');
      // A state from an older build is dropped rather than half-read.
      this.state = s?.v === G.STATE_VERSION ? s : null;
      this.kind = (await ctx.storage.get('kind')) ?? null;
    });
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const url = new URL(request.url);
    const [, , , kind, key] = url.pathname.split('/');
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    // Whether the room may be created is decided at hello, not here: closing a
    // socket before the 101 goes out loses the close code, and the client
    // needs it to tell "no such room" from a network blip.
    pair[1].serializeAttachment({ kind, key, create: url.searchParams.get('create') === '1' });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /**
   * Opens the room on its first hello. Discord rooms spring into being with
   * the Activity. Web rooms exist only once someone creates one, so a mistyped
   * code is an error rather than an empty room nobody else will ever find.
   * Returns a close code when this socket may not enter.
   */
  async open({ kind, key, create }) {
    if (!this.state) {
      if (kind === 'web' && !create) return NOT_FOUND;
      this.kind = kind;
      this.state = G.createState(kind === 'web' ? key : '');
      await this.ctx.storage.put('kind', kind);
      return null;
    }
    // A new room's random code collided with a live one; the client picks another.
    if (kind === 'web' && create && this.state.players.some((p) => p.online)) return TAKEN;
    return null;
  }

  // ------------------------------------------------------------ sockets

  async webSocketMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'hello') return this.hello(ws, msg);

    const me = ws.deserializeAttachment()?.id;
    if (!me || !this.state) return; // nothing before hello
    const s = this.state;
    const now = Date.now();
    let changed = false;

    switch (msg.t) {
      case 'team':
        changed = G.joinTeam(s, me, msg.team ?? null, now);
        break;
      case 'shuffle':
        changed = G.shuffleTeams(s, me);
        break;
      case 'settings':
        changed = G.updateSettings(s, me, { rounds: msg.rounds, seconds: msg.seconds });
        break;
      case 'start':
        changed = G.startGame(s, me, now);
        break;
      case 'go':
        changed = G.goLive(s, me, now);
        break;
      case 'act':
      case 'guess':
      case 'clue': {
        // Catch up first: the alarm may be a few ms late, and a guess after
        // time is up must not score.
        const ticked = G.tick(s, now);
        const team = s.turn?.team;
        const done =
          msg.t === 'act' ? G.act(s, me, msg.action, now)
          : msg.t === 'guess' ? G.guess(s, me, msg.text, now)
          : G.clue(s, me, msg.text, now);
        // Card changes get a moment of celebration (or shame) on every
        // screen. A plain miss or clue is just a new line in the feed.
        if (done && ['hit', 'skip', 'buzz'].includes(done.kind)) {
          this.broadcastRaw({ t: 'fx', ...done, team });
        }
        changed = ticked || !!done;
        break;
      }
      case 'next':
        changed = G.nextRound(s, me, now);
        break;
      case 'pass':
        changed = G.skipTurn(s, me, now);
        break;
      case 'reset':
        changed = G.reset(s, me, now);
        break;
    }
    if (changed) await this.commit();
  }

  async hello(ws, msg) {
    const att = ws.deserializeAttachment();
    if (!att || att.id) return; // already identified
    const refused = await this.open(att);
    if (refused) return this.refuse(ws, refused);
    let user;
    try {
      user = await this.identify(msg);
    } catch {
      // Discord couldn't be asked. Not the player's fault; the client retries.
      return this.refuse(ws, 1011);
    }
    if (!user) return this.refuse(ws, UNAUTHORIZED);
    ws.serializeAttachment(user);
    G.join(this.state, user, Date.now());
    await this.commit();
  }

  /**
   * Who is on this socket. In a Discord room identity is verified, never
   * claimed: the access token is checked against Discord and the id, name and
   * avatar come from Discord's reply. Otherwise a player could take the
   * storyteller's id and be sent the card. Web rooms are open by design --
   * anyone with the code can join under any name -- so their ids are taken as
   * given. ALLOW_UNVERIFIED is for `wrangler dev --var` in tests only.
   */
  async identify(msg) {
    const claimed = () => {
      const id = String(msg.id ?? '');
      if (!/^[\w-]{6,64}$/.test(id)) return null;
      return { id, name: G.sanitizeName(msg.name), avatar: null };
    };
    if (this.kind !== 'discord' || this.env.ALLOW_UNVERIFIED === 'true') return claimed();

    const token = msg.token;
    if (typeof token !== 'string' || !token) return null;
    const cached = this.verified.get(token);
    if (cached) return cached;
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`discord /users/@me ${res.status}`);
    const u = await res.json();
    const user = {
      id: u.id,
      name: G.sanitizeName(u.global_name || u.username),
      avatar: u.avatar ?? null,
    };
    this.verified.set(token, user);
    return user;
  }

  refuse(ws, code) {
    this.send(ws, { t: 'error', code });
    ws.close(code, 'refused');
  }

  async webSocketClose(ws) {
    await this.gone(ws);
  }

  async webSocketError(ws) {
    await this.gone(ws);
  }

  async gone(ws) {
    const id = ws.deserializeAttachment()?.id;
    if (!id || !this.state) return;
    // Two tabs, one player: they're only gone when the last socket closes.
    // The closing socket may still be listed while this runs.
    const still = this.ctx.getWebSockets().some((w) => w !== ws && w.deserializeAttachment()?.id === id);
    if (still) return;
    if (G.leave(this.state, id, Date.now())) await this.commit(ws);
  }

  // ------------------------------------------------------------ state

  async alarm() {
    if (!this.state) return;
    const now = Date.now();
    if (G.tick(this.state, now)) return this.commit();
    if (G.nextDeadline(this.state) == null && this.ctx.getWebSockets().length === 0) {
      // Idle and empty: wipe it. A room is per launch, and holds display names.
      await this.ctx.storage.deleteAll();
      this.state = null;
      this.kind = null;
      return;
    }
    await this.schedule();
  }

  async save() {
    await this.ctx.storage.put('state', this.state);
    await this.schedule();
  }

  /** One alarm serves both the game clock and the idle expiry. */
  async schedule() {
    const deadline = this.state && G.nextDeadline(this.state);
    await this.ctx.storage.setAlarm(deadline ?? Date.now() + ROOM_TTL_MS);
  }

  async commit(skip) {
    await this.save();
    this.broadcastState(skip);
  }

  broadcastState(skip) {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === skip) continue;
      const id = ws.deserializeAttachment()?.id;
      if (!id) continue;
      // Per-socket view: the card only reaches the two seats allowed to see it.
      this.send(ws, { t: 'state', s: G.viewFor(this.state, id, now) });
    }
  }

  broadcastRaw(msg) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.deserializeAttachment()?.id) this.send(ws, msg);
    }
  }

  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket died between getWebSockets() and send(); its close handler cleans up.
    }
  }
}
