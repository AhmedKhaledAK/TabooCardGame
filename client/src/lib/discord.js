/**
 * Discord launches an Activity with ?frame_id=... on the iframe URL. Without
 * it we're in a plain browser tab, where the SDK's postMessage handshake has
 * no parent to talk to and ready() would hang forever. So that is the switch
 * between Discord mode and web mode.
 */
export const isEmbedded = new URLSearchParams(window.location.search).has('frame_id');

/**
 * What went wrong, as a category the UI can phrase for a player. The error
 * messages below are written for whoever is debugging and are only shown in
 * dev builds.
 *
 *   config    -- the build is misconfigured; the player can't fix it
 *   handshake -- Discord never answered; usually the URL mapping or tunnel
 *   auth      -- Discord answered but we could not sign the player in
 */
export class BootError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'BootError';
    this.kind = kind;
  }
}

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
const READY_TIMEOUT_MS = 10_000;

/**
 * Module-level singleton, deliberately not created inside a component.
 * StrictMode double-invokes effects in dev, and two SDK instances racing the
 * same handshake leave the loser hanging with no error. Creating it once and
 * memoising the promises makes repeat calls harmless.
 */
let sdk = null;
let pending = null;
let session = null;

export function connect() {
  pending ??= handshake();
  return pending;
}

async function handshake() {
  if (!clientId) {
    throw new BootError('config', 'VITE_DISCORD_CLIENT_ID is not set. Copy .env.example to .env and restart `npm run dev`.');
  }
  // Loaded on demand: web players never download the SDK.
  const { DiscordSDK } = await import('@discord/embedded-app-sdk');
  sdk ??= new DiscordSDK(clientId);

  // ready() has no timeout of its own; a stuck handshake would spin forever.
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new BootError(
            'handshake',
            `No READY from Discord after ${READY_TIMEOUT_MS / 1000}s. Check that VITE_DISCORD_CLIENT_ID (${clientId}) ` +
              'is this app, that the "/" URL mapping points at a host serving this build, and that the tunnel is alive.',
          ),
        ),
      READY_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([sdk.ready(), timeout]);
  } catch (e) {
    pending = null; // allow a retry without a reload
    throw e;
  } finally {
    clearTimeout(timer);
  }
  // Unique per Activity launch: everyone in the same launch shares one room.
  return { instanceId: sdk.instanceId, platform: sdk.platform };
}

/**
 * OAuth: authorize() gives a short-lived code, the Worker swaps it for an
 * access token (it holds the client secret), and authenticate() hands the
 * token back to Discord. The room server verifies players with that token.
 */
export function login() {
  session ??= doLogin();
  return session;
}

async function doLogin() {
  const fail = (message) => {
    session = null;
    return new BootError('auth', message);
  };

  const { code } = await sdk.commands
    .authorize({ client_id: clientId, response_type: 'code', state: '', prompt: 'none', scope: ['identify'] })
    .catch((e) => {
      throw fail(`authorize() rejected: ${describe(e)}`);
    });

  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const raw = await res.text();
  if (!res.ok || raw.trimStart().startsWith('<')) {
    throw fail(`Token exchange failed (${res.status}). If this is HTML, /api never reached the Worker.\n\n${raw.slice(0, 300)}`);
  }
  const { access_token } = JSON.parse(raw);

  const auth = await sdk.commands.authenticate({ access_token }).catch((e) => {
    throw fail(`authenticate() rejected: ${describe(e)}`);
  });
  return {
    id: auth.user.id,
    name: auth.user.global_name || auth.user.username,
    token: auth.access_token,
  };
}

/** Discord's own "invite friends to this Activity" dialog. */
export function openInvite() {
  return sdk?.commands.openInviteDialog().catch(() => {});
}

function describe(e) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
