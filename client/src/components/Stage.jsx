import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { secondsLeft } from '../lib/clock.js';
import { TEAM } from '../lib/teams.js';
import { Avatar, StoryIcon, TeamIcon, WhistleIcon } from './ui.jsx';

const GUESS_MAX = 40;
const CLUE_MAX = 80;

const nameOf = (s, id) => s.players.find((p) => p.id === id)?.name ?? 'Someone';

/** What this player does right now. */
function roleOf(s) {
  const t = s.turn;
  if (!t) return 'watch';
  if (t.describer === s.you) return 'teller';
  if (t.watcher === s.you) return 'ref';
  const me = s.players.find((p) => p.id === s.you);
  return me?.team === t.team ? 'guesser' : 'watch';
}

export function Stage({ s, send, now }) {
  const role = roleOf(s);
  switch (s.phase) {
    case 'ready':
      return <Ready s={s} send={send} now={now} role={role} />;
    case 'countdown':
      return <Countdown s={s} now={now} role={role} />;
    case 'playing':
      return <Playing s={s} send={send} role={role} />;
    case 'round_over':
      return <RoundOver s={s} send={send} now={now} />;
    case 'over':
      return <Over s={s} send={send} />;
    default:
      return null;
  }
}

// ------------------------------------------------------------------ before the clock

const BRIEF = {
  teller: () => ({
    title: 'You’re the Hakawati!',
    body: 'Describe the word on your card without saying it or any red word. Talk, or type clues if you’re not on voice.',
  }),
  ref: (s) => ({
    title: 'You’re the Hakam',
    body: `You’ll see the card too. If ${nameOf(s, s.turn.describer)} says a red word out loud, blow the whistle.`,
  }),
  guesser: (s) => ({
    title: 'Get ready to guess',
    body: `${nameOf(s, s.turn.describer)} tells the story. Type every guess and press Enter: the right word scores on its own.`,
  }),
  watch: (s) => ({
    title: `${TEAM[s.turn.team].name} is playing`,
    body: 'Sit back and watch the guesses roll in.',
  }),
};

function Ready({ s, send, now, role }) {
  const t = s.turn;
  const host = s.hostId === s.you;
  const auto = secondsLeft(t.readyEndsAt, now, s.offset);
  const T = TEAM[t.team];

  if (!t.describer) {
    return (
      <Panel>
        <h2 className="font-display text-3xl">Nobody from {T.name} is here</h2>
        <p className="text-ink-soft">The turn waits until someone from {T.name} comes back.</p>
        {host ? (
          <button className="btn mt-2 bg-gold" onClick={() => send({ t: 'pass' })}>
            Skip {T.name}’s turn
          </button>
        ) : (
          <p className="text-sm text-ink-soft">The host can skip this turn.</p>
        )}
      </Panel>
    );
  }

  const brief = BRIEF[role](s);
  const teller = s.players.find((p) => p.id === t.describer);
  const ref = s.players.find((p) => p.id === t.watcher);
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Seat player={teller} label="Hakawati" icon={<StoryIcon className="size-4" />} tint={T.bg} />
        {ref && <Seat player={ref} label="Hakam" icon={<WhistleIcon className="size-4" />} tint="bg-mamnou3" />}
      </div>
      <h2 className="font-display text-4xl">{brief.title}</h2>
      <p className="max-w-md text-ink-soft">{brief.body}</p>
      {role === 'teller' ? (
        <button className={`btn mt-1 px-8 py-3 font-display text-3xl text-white ${T.bg}`} onClick={() => send({ t: 'go' })} autoFocus>
          Yalla!
        </button>
      ) : null}
      {auto != null && (
        <p className="text-sm font-semibold text-ink-soft">
          {role === 'teller' ? `Starts by itself in ${auto}s` : `Starting in ${auto}s, or when ${teller?.name} is ready`}
        </p>
      )}
    </Panel>
  );
}

function Seat({ player, label, icon, tint }) {
  if (!player) return null;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <Avatar player={player} size={56} />
        <span className={`absolute -right-1 -bottom-1 rounded-md border-2 border-ink p-0.5 text-white ${tint}`}>{icon}</span>
      </div>
      <span className="label">{label}</span>
      <span className="max-w-32 truncate font-bold">{player.name}</span>
    </div>
  );
}

function Countdown({ s, now, role }) {
  const n = secondsLeft(s.turn.countdownEndsAt, now, s.offset);
  return (
    <Panel>
      <p className="label">{role === 'teller' ? 'Your card is coming' : role === 'guesser' ? 'Fingers on the keyboard' : 'Here we go'}</p>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={n}
          initial={{ scale: 1.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          className={`font-display text-9xl leading-none ${TEAM[s.turn.team].text}`}
        >
          {n || 'Yalla!'}
        </motion.span>
      </AnimatePresence>
    </Panel>
  );
}

// ------------------------------------------------------------------ the clock is running

function Playing({ s, send, role }) {
  const t = s.turn;
  if (role === 'teller' || role === 'ref') {
    return (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          {t.card && <WordCard card={t.card} unlocked={t.unlocked} cardNo={t.cardNo} team={t.team} />}
          {role === 'teller' ? (
            <button className="btn bg-paper" onClick={() => send({ t: 'act', action: 'skip' })}>
              Skip card {t.skips === 0 ? '(free)' : '(−1)'}
            </button>
          ) : (
            <button
              className="btn bg-mamnou3 py-4 font-display text-3xl text-white"
              onClick={() => send({ t: 'act', action: 'buzz' })}
              title="A red word was said out loud"
            >
              <WhistleIcon className="size-8" /> Whistle!
            </button>
          )}
        </div>
        <div className="grid content-start gap-3">
          {role === 'teller' && (
            <TextBox
              key="clue"
              kind="clue"
              max={CLUE_MAX}
              placeholder="Type a clue (optional)"
              hint="Not on voice? Type clues here. A red word gets whistled automatically."
              button="Send"
              tint="bg-gold"
              onSend={(text) => send({ t: 'clue', text })}
            />
          )}
          <Feed s={s} seesCard />
        </div>
      </div>
    );
  }

  const teller = nameOf(s, t.describer);
  return (
    <div className="grid gap-3">
      {role === 'guesser' ? (
        <div className="panel grid gap-2 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-3xl">Guess!</h2>
            <span className="text-sm font-semibold text-ink-soft">
              {teller} is describing · {t.hits} right so far
            </span>
          </div>
          <TextBox
            key="guess"
            kind="guess"
            max={GUESS_MAX}
            placeholder="Type your guess"
            button="Guess"
            tint="bg-ok text-white"
            big
            onSend={(text) => send({ t: 'guess', text })}
          />
        </div>
      ) : (
        <CardBack s={s} teller={teller} />
      )}
      <Feed s={s} />
    </div>
  );
}

/**
 * The card, for the two players allowed to see it. Red words are mamnou3;
 * once a guesser has typed one it turns green and may be used.
 */
function WordCard({ card, unlocked, cardNo, team }) {
  const T = TEAM[team];
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={cardNo}
        initial={{ rotateY: -90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        exit={{ rotateY: 90, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="panel overflow-hidden"
      >
        <div className={`border-b-2 border-ink px-4 pt-2 pb-3 text-center text-white ${T.bg}`}>
          <div className="text-xs font-bold tracking-widest uppercase opacity-80">Card {cardNo}</div>
          <div className="font-display text-5xl leading-tight break-words">{card.word}</div>
        </div>
        <ul className="grid gap-1.5 bg-white p-3">
          {card.forbidden.map((w, i) => {
            const free = unlocked.includes(i);
            return (
              <motion.li
                key={w}
                layout
                animate={free ? { scale: [1, 1.06, 1] } : {}}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1 text-lg font-bold ${
                  free ? 'border-ok bg-ok-soft text-ok' : 'border-mamnou3/40 bg-mamnou3-soft text-mamnou3'
                }`}
              >
                <span aria-hidden="true" className="w-5 text-center">
                  {free ? '✓' : '⊘'}
                </span>
                <span>{w}</span>
                <span className="ml-auto text-xs font-semibold tracking-wide uppercase opacity-80">{free ? 'allowed now' : 'mamnou3'}</span>
              </motion.li>
            );
          })}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
}

function CardBack({ s, teller }) {
  const t = s.turn;
  const T = TEAM[t.team];
  return (
    <div className={`panel flex items-center gap-4 p-4 ${T.soft}`}>
      <div
        className={`flex h-20 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-ink text-white ${T.bg}`}
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.15) 0 6px, transparent 6px 12px)' }}
      >
        <TeamIcon team={t.team} className="size-8" />
      </div>
      <div className="min-w-0">
        <h2 className="font-display text-3xl leading-tight">{T.name} is guessing</h2>
        <p className="text-ink-soft">
          {teller} is describing card {t.cardNo}. {t.hits} right so far.
        </p>
      </div>
    </div>
  );
}

/** A one-line input that stays focused, so the next guess is one keystroke away. */
function TextBox({ kind, max, placeholder, hint, button, tint, big = false, onSend }) {
  const [text, setText] = useState('');
  const input = useRef(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <form
      className="grid gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSend(text.trim());
        setText('');
        input.current?.focus();
      }}
    >
      <div className="flex gap-2">
        <input
          ref={input}
          className={`field min-w-0 ${big ? 'py-3 text-2xl' : ''}`}
          value={text}
          maxLength={max}
          placeholder={placeholder}
          aria-label={kind === 'guess' ? 'Your guess' : 'Your clue'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
        />
        <button className={`btn ${tint}`} disabled={!text.trim()}>
          {button}
        </button>
      </div>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </form>
  );
}

/**
 * Guesses and clues for this turn, newest at the bottom. Entries from earlier
 * cards fade back so the current card's guesses stand out.
 */
function Feed({ s, seesCard = false }) {
  const t = s.turn;
  const list = useRef(null);
  const last = t.feed.at(-1)?.id;
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);

  return (
    <section className="panel flex min-h-40 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b-2 border-ink bg-paper-2 px-3 py-1">
        <span className="label">Guesses</span>
        {seesCard && <span className="text-xs text-ink-soft">Green = a red word a guesser typed</span>}
      </header>
      <ol ref={list} className="scroll-thin grid max-h-72 min-h-32 content-start gap-1 overflow-y-auto p-2" aria-live="polite">
        {t.feed.length === 0 && <li className="m-auto py-6 text-sm text-ink-soft">Guesses will pop up here.</li>}
        {t.feed.map((e, i) => (
          <FeedItem key={e.id} e={e} s={s} old={e.card < t.cardNo && e.result !== 'hit' && e.result !== 'buzz'} divider={i > 0 && t.feed[i - 1].card !== e.card} />
        ))}
      </ol>
    </section>
  );
}

function FeedItem({ e, s, old, divider }) {
  const who = nameOf(s, e.by);
  const T = TEAM[s.turn.team];
  let body;
  if (e.kind === 'clue') {
    body =
      e.result === 'buzz' ? (
        <span className="rounded-lg bg-mamnou3-soft px-2 py-0.5 font-semibold text-mamnou3">Clue hidden: it had a red word. −1</span>
      ) : (
        <span className={`rounded-lg rounded-tl-none border-2 border-ink px-2 py-0.5 font-semibold text-white ${T.bg}`}>
          <StoryIcon className="mr-1 inline size-4 align-[-2px]" />
          {e.text}
        </span>
      );
  } else if (e.result === 'hit') {
    body = (
      <span className="rounded-lg border-2 border-ok bg-ok-soft px-2 py-0.5 font-bold text-ok">
        {e.text} ✓ <span className="font-display">+1</span>
      </span>
    );
  } else if (e.result === 'unlock') {
    body = (
      <span className="rounded-lg border-2 border-dashed border-ok px-2 py-0.5 font-semibold text-ok">
        {e.text} <span className="text-xs uppercase">· now allowed</span>
      </span>
    );
  } else {
    body = <span className="rounded-lg bg-paper-2 px-2 py-0.5">{e.text}</span>;
  }
  return (
    <>
      {divider && <li className="my-1 border-t-2 border-dashed border-paper-3" aria-hidden="true" />}
      <motion.li
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: old ? 0.45 : 1, x: 0 }}
        className="flex items-baseline gap-2 text-sm"
      >
        <span className="w-20 shrink-0 truncate text-right text-xs font-bold text-ink-soft">{who}</span>
        <span className="min-w-0 break-words">{body}</span>
      </motion.li>
    </>
  );
}

// ------------------------------------------------------------------ between rounds

function Scores({ s }) {
  const { A, B } = s.scores;
  return (
    <div className="flex items-stretch justify-center gap-3">
      {['A', 'B'].map((team) => {
        const T = TEAM[team];
        const lead = s.scores[team] > s.scores[team === 'A' ? 'B' : 'A'];
        return (
          <div key={team} className={`panel flex min-w-32 flex-col items-center px-5 py-2 ${T.soft} ${lead ? 'ring-4 ring-gold' : ''}`}>
            <span className={`flex items-center gap-1 font-display text-2xl ${T.text}`}>
              <TeamIcon team={team} /> {T.name}
            </span>
            <span className="font-display text-6xl leading-none tabular-nums">{team === 'A' ? A : B}</span>
          </div>
        );
      })}
    </div>
  );
}

function RoundOver({ s, send, now }) {
  const host = s.hostId === s.you;
  const auto = secondsLeft(s.breakEndsAt, now, s.offset);
  return (
    <Panel>
      <h2 className="font-display text-4xl">
        Round {s.round} of {s.settings.rounds} done
      </h2>
      <Scores s={s} />
      <p className="text-sm font-semibold text-ink-soft">
        {auto != null ? `Next round in ${auto}s` : 'Next round soon'}
        {!host && ` (or when ${nameOf(s, s.hostId)} starts it)`}
      </p>
      {host && (
        <button className="btn bg-ok px-6 text-lg text-white" onClick={() => send({ t: 'next' })}>
          Next round now
        </button>
      )}
    </Panel>
  );
}

function Over({ s, send }) {
  const host = s.hostId === s.you;
  const { A, B } = s.scores;
  const winner = A === B ? null : A > B ? 'A' : 'B';
  return (
    <Panel>
      <motion.div initial={{ scale: 0.6, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }}>
        {winner ? (
          <>
            <p className="label">The winner is</p>
            <h2 className={`flex items-center justify-center gap-2 font-display text-7xl ${TEAM[winner].text}`}>
              <TeamIcon team={winner} className="size-14" />
              {TEAM[winner].name}!
            </h2>
            <p dir="rtl" className="font-display text-3xl text-rose">
              مبروك
            </p>
          </>
        ) : (
          <h2 className="font-display text-6xl">It’s a draw!</h2>
        )}
      </motion.div>
      <Scores s={s} />
      {host ? (
        <button className="btn bg-gold px-6 text-lg" onClick={() => send({ t: 'reset' })}>
          Back to the lobby
        </button>
      ) : (
        <p className="text-sm font-semibold text-ink-soft">Waiting for {nameOf(s, s.hostId)} to set up the next game.</p>
      )}
    </Panel>
  );
}

function Panel({ children }) {
  return <section className="panel flex min-h-72 flex-col items-center justify-center gap-3 p-5 text-center">{children}</section>;
}
