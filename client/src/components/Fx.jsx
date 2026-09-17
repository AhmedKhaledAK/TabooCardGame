import { AnimatePresence, motion } from 'framer-motion';
import { TEAM } from '../lib/teams.js';
import { WhistleIcon } from './ui.jsx';

const nameOf = (players, id) => players.find((p) => p.id === id)?.name ?? 'Someone';

/**
 * The moment a card changes: a correct guess, a whistle or a skip, shown on
 * every screen. It never blocks input, so guessers can keep typing.
 */
export function Fx({ fx, players }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {fx && (
          <motion.div
            key={fx.key}
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className={`panel flex items-center gap-3 px-5 py-3 ${
              fx.kind === 'hit' ? 'bg-ok-soft' : fx.kind === 'buzz' ? 'bg-mamnou3-soft' : 'bg-paper-2'
            }`}
          >
            <Badge fx={fx} />
            <div className="text-left">
              <div className="font-display text-3xl leading-tight">{fx.word}</div>
              <div className="text-sm font-semibold text-ink-soft">{caption(fx, players)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Badge({ fx }) {
  if (fx.kind === 'hit') {
    return (
      <motion.span
        initial={{ rotate: -20, scale: 0.5 }}
        animate={{ rotate: 0, scale: 1 }}
        className={`flex size-14 items-center justify-center rounded-full border-2 border-ink font-display text-3xl text-white ${TEAM[fx.team]?.bg ?? 'bg-ok'}`}
      >
        +1
      </motion.span>
    );
  }
  if (fx.kind === 'buzz') {
    return (
      <span className="flex size-14 animate-wiggle items-center justify-center rounded-full border-2 border-ink bg-mamnou3 text-white">
        <WhistleIcon className="size-8" />
      </span>
    );
  }
  return <span className="flex size-14 items-center justify-center rounded-full border-2 border-ink bg-paper font-display text-2xl">⤼</span>;
}

function caption(fx, players) {
  const who = nameOf(players, fx.by);
  if (fx.kind === 'hit') return `${who} got it!`;
  if (fx.kind === 'buzz') return fx.auto ? `Mamnou3 word in the clue! −1` : `${who} blew the whistle! −1`;
  return 'Skipped';
}
