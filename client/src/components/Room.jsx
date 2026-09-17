import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRoom } from '../lib/room.js';
import { sfx } from '../lib/sound.js';
import { Fx } from './Fx.jsx';
import { Game } from './Game.jsx';
import { HowToPlay } from './HowToPlay.jsx';
import { Lobby } from './Lobby.jsx';
import { TopBar } from './TopBar.jsx';
import { Bunting, Logo, Screen, Spinner } from './ui.jsx';

const FX_MS = 1700;

/**
 * One table, from connecting to the final score. Web tables pass `code`,
 * `onLeave` and `onRefused`; Discord ones pass `onInvite`.
 */
export function Room({ path, create = false, hello, code, onLeave, onRefused, onInvite }) {
  const [fx, setFx] = useState(null);
  const [help, setHelp] = useState(false);

  const onFx = useCallback((m) => {
    if (m.kind === 'hit') sfx.hit();
    else if (m.kind === 'buzz') sfx.whistle();
    else sfx.skip();
    setFx({ ...m, key: `${Date.now()}-${Math.random()}` });
  }, []);
  const { state: s, status, send } = useRoom({ path, create, hello, onFx });

  useEffect(() => {
    if (!fx) return;
    const id = setTimeout(() => setFx(null), FX_MS);
    return () => clearTimeout(id);
  }, [fx]);

  const refused = ['missing', 'taken', 'denied'].includes(status.kind) ? status.kind : null;
  useEffect(() => {
    if (refused && onRefused) onRefused(refused);
  }, [refused, onRefused]);

  if (refused === 'denied' && !onRefused) {
    return (
      <Screen>
        <Logo size="sm" />
        <div className="panel max-w-md p-6">
          <h1 className="font-display text-3xl">Discord didn’t let you in</h1>
          <p className="mt-2 text-ink-soft">Close the Activity and launch it again.</p>
        </div>
      </Screen>
    );
  }

  if (!s) {
    return (
      <Screen>
        <Logo />
        <Spinner label={status.struggling ? 'Still trying to reach the table…' : 'Pulling up a chair…'} />
        {onLeave && (
          <button className="btn btn-sm bg-paper" onClick={onLeave}>
            Back
          </button>
        )}
      </Screen>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <Bunting />
      <TopBar s={s} send={send} code={code} onLeave={onLeave} onInvite={onInvite} onHelp={() => setHelp(true)} />
      {status.kind !== 'open' && (
        <p role="status" className="bg-gold px-3 py-1 text-center text-sm font-bold">
          Connection lost. Reconnecting…
        </p>
      )}
      {s.phase === 'lobby' ? <Lobby s={s} send={send} code={code} /> : <Game s={s} send={send} />}
      <Fx fx={fx} players={s.players} />
      <AnimatePresence>
        {help && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHelp(false)}
          >
            <motion.div
              role="dialog"
              aria-label="How to play"
              className="panel max-h-full w-full max-w-lg overflow-y-auto bg-paper p-4"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-3xl">How to play</h2>
                <button className="btn btn-sm bg-paper" onClick={() => setHelp(false)}>
                  Close
                </button>
              </div>
              <HowToPlay compact />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
