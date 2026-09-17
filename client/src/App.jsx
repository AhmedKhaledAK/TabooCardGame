import { useCallback, useEffect, useMemo, useState } from 'react';
import { connect, isEmbedded, login, openInvite } from './lib/discord.js';
import { cleanCode, newCode, playerId, saveName, savedName } from './lib/identity.js';
import { Landing } from './components/Landing.jsx';
import { Room } from './components/Room.jsx';
import { Screen, Spinner, Logo } from './components/ui.jsx';

export default function App() {
  return isEmbedded ? <DiscordApp /> : <WebApp />;
}

// ------------------------------------------------------------------ Discord

const BOOT_TEXT = {
  config: ['This build isn’t set up for Discord yet.', 'The app is missing its Discord client id.'],
  handshake: ['Couldn’t reach Discord.', 'Close the Activity and launch it again.'],
  auth: ['Couldn’t sign you in.', 'Launch the Activity again and allow access when Discord asks.'],
};

function DiscordApp() {
  const [boot, setBoot] = useState({ step: 'connecting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { instanceId } = await connect();
        if (live) setBoot({ step: 'signing-in' });
        const me = await login();
        if (live) setBoot({ step: 'ready', instanceId, hello: { token: me.token } });
      } catch (e) {
        if (live) setBoot({ step: 'error', error: e });
      }
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

  if (boot.step === 'ready') {
    return <Room path={`discord/${boot.instanceId}`} hello={boot.hello} onInvite={openInvite} />;
  }
  if (boot.step === 'error') {
    const [title, hint] = BOOT_TEXT[boot.error?.kind] ?? ['Something went wrong.', 'Try launching the Activity again.'];
    return (
      <Screen>
        <Logo size="sm" />
        <div className="panel max-w-md p-6">
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="mt-2 text-ink-soft">{hint}</p>
          {import.meta.env.DEV && <pre className="mt-4 text-left text-xs whitespace-pre-wrap text-mamnou3">{String(boot.error?.message)}</pre>}
          <button className="btn mt-5 bg-gold" onClick={() => (setBoot({ step: 'connecting' }), setAttempt((n) => n + 1))}>
            Try again
          </button>
        </div>
      </Screen>
    );
  }
  return (
    <Screen>
      <Logo />
      <Spinner label={boot.step === 'connecting' ? 'Opening the ahwa…' : 'Signing you in…'} />
    </Screen>
  );
}

// ------------------------------------------------------------------ web

/** Keeps ?room=CODE in the address bar, so the URL is the invite link. */
function setRoomParam(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState(null, '', url);
}

function WebApp() {
  const [name, setName] = useState(savedName);
  // { code, create } once the player has picked a room.
  const [table, setTable] = useState(null);
  const [notice, setNotice] = useState(null);
  const linkCode = useMemo(() => cleanCode(new URLSearchParams(location.search).get('room')), []);

  const hello = useMemo(() => ({ id: playerId(), name }), [name]);

  const enter = (code, create) => {
    saveName(name.trim());
    setNotice(null);
    setRoomParam(code);
    setTable({ code, create });
  };

  const leave = useCallback((why) => {
    setRoomParam(null);
    setTable(null);
    setNotice(why ?? null);
  }, []);

  const onRefused = useCallback(
    (kind) => {
      if (kind === 'taken') {
        // A fresh random code clashed with a live table. Just roll again.
        const code = newCode();
        setRoomParam(code);
        setTable({ code, create: true });
      } else if (kind === 'missing') {
        leave('There’s no table with that code. Check it, or open a new one.');
      } else {
        leave('That table turned you away.');
      }
    },
    [leave],
  );

  if (table) {
    return (
      <Room
        key={table.code}
        path={`web/${table.code}`}
        create={table.create}
        hello={hello}
        code={table.code}
        onLeave={() => leave()}
        onRefused={onRefused}
      />
    );
  }
  return (
    <Landing
      name={name}
      setName={setName}
      initialCode={linkCode}
      notice={notice}
      onCreate={() => enter(newCode(), true)}
      onJoin={(code) => enter(code, false)}
    />
  );
}
