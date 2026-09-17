/**
 * Laff w Dawaran Worker: one origin for everything.
 *
 *   /api/token                  OAuth2 code -> access token (needs the client secret)
 *   /api/room/discord/<id>      WebSocket, one room per Discord Activity instance
 *   /api/room/web/<CODE>        WebSocket, one room per web join code
 *   /api/health                 uptime check
 *   anything else               static files from ./dist
 *
 * Inside Discord every request goes through <app-id>.discordsays.com, which
 * proxies to this Worker via the "/" URL mapping. Keeping the socket and the
 * API on the same origin as the page means that one mapping is all it takes.
 */
export { Room } from './room.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') return json({ ok: true });

    if (url.pathname === '/api/token') return handleToken(request, env);

    // idFromName: the same key always resolves to the same object, so
    // everyone in the same Activity launch shares a room with no registry and
    // no race over who creates it. Kinds are separate namespaces, so a web
    // code can never land in a Discord room.
    const room = url.pathname.match(/^\/api\/room\/(discord\/[\w-]{1,128}|web\/[A-Z0-9]{5})$/);
    if (room) {
      return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(request);
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);

    // No client-side routes: any path that isn't a file gets the app shell,
    // which is what Discord and ?room= invite links load.
    return env.ASSETS.fetch(new Request(new URL('/', url), request));
  },
};

/**
 * Swaps the short-lived code from the SDK's authorize() for an access token.
 * Server-side because the client secret must never reach the browser.
 */
async function handleToken(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return json({ error: 'server_missing_discord_config' }, 500);
  }
  const { code } = await request.json().catch(() => ({}));
  if (typeof code !== 'string' || !code) return json({ error: 'missing_code' }, 400);

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  });
  if (!res.ok) return json({ error: 'token_exchange_failed', detail: await res.text() }, 502);

  const { access_token } = await res.json();
  // Only the access token goes back, never the refresh token.
  return json({ access_token });
}
