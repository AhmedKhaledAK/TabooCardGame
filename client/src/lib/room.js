import { useCallback, useEffect, useRef, useState } from 'react';

/** Close codes the room uses to turn a player away. Retrying won't help. */
const REFUSALS = { 4001: 'denied', 4004: 'missing', 4009: 'taken' };
/** Failed attempts before the UI should admit it's struggling. */
const STRUGGLING_AFTER = 3;
/**
 * Keeps the socket from looking idle to proxies (Discord's included). The
 * room answers this exact string without waking up, so it costs nothing.
 */
const PING = '{"t":"ping"}';
const PING_MS = 25_000;

/**
 * One WebSocket to one room, reconnecting with backoff: a Discord Activity
 * lives through laptop sleep, network switches and backgrounded iframes. The
 * server sends the full state after every hello, so nothing needs merging.
 */
export class RoomConnection {
  constructor({ path, create, hello, onMessage, onStatus }) {
    Object.assign(this, { path, create, hello, onMessage, onStatus });
    this.ws = null;
    this.closed = false;
    this.joined = false;
    this.attempt = 0;
    this.timer = null;
    this.pinger = setInterval(() => this.ws?.readyState === WebSocket.OPEN && this.ws.send(PING), PING_MS);
    this.connect();
  }

  connect() {
    if (this.closed) return;
    this.onStatus('connecting', this.attempt >= STRUGGLING_AFTER);
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Only the very first connection may create a web room. After that the
    // room exists, and asking again would be refused as a code clash.
    const query = this.create && !this.joined ? '?create=1' : '';
    const ws = new WebSocket(`${proto}//${location.host}/api/room/${this.path}${query}`);
    this.ws = ws;
    let refusal = null;

    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', ...this.hello }));

    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.t === 'error') refusal = msg.code;
      if (msg.t === 'state' && !this.joined) {
        this.joined = true;
        this.attempt = 0;
      }
      if (msg.t === 'state') this.onStatus('open', false);
      this.onMessage(msg);
    };

    ws.onclose = (e) => {
      if (this.ws === ws) this.ws = null;
      if (this.closed) return;
      // Some proxies drop the close code; the error message carries it too.
      const refused = REFUSALS[e.code] ?? REFUSALS[refusal];
      if (refused) {
        this.close();
        this.onStatus(refused, true);
        return;
      }
      this.onStatus('connecting', ++this.attempt >= STRUGGLING_AFTER);
      // Growing so a dead server isn't hammered by every client at once;
      // capped so a long outage doesn't turn into a dead room.
      const delay = Math.min(400 * 2 ** this.attempt, 8_000);
      this.timer = setTimeout(() => this.connect(), delay);
    };

    ws.onerror = () => ws.close();
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.pinger);
    this.ws?.close();
  }
}

/**
 * The room as React state. `hello` must be stable (memoised by the caller):
 * a new object means a new connection.
 *
 * The state carries `offset`, the server clock minus ours, so countdowns
 * agree across players whose computer clocks don't.
 */
export function useRoom({ path, create, hello, onFx }) {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState({ kind: 'connecting', struggling: false });
  const conn = useRef(null);
  const fx = useRef(onFx);
  useEffect(() => {
    fx.current = onFx;
  });

  useEffect(() => {
    const c = new RoomConnection({
      path,
      create,
      hello,
      onMessage: (m) => {
        if (m.t === 'state') setState({ ...m.s, offset: m.s.now - Date.now() });
        else if (m.t === 'fx') fx.current?.(m);
      },
      onStatus: (kind, struggling) => setStatus({ kind, struggling }),
    });
    conn.current = c;
    return () => c.close();
  }, [path, create, hello]);

  const send = useCallback((msg) => conn.current?.send(msg), []);
  return { state, status, send };
}
