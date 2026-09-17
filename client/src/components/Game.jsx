import { useEffect, useRef, useState } from 'react';
import { secondsLeft, useNow } from '../lib/clock.js';
import { sfx } from '../lib/sound.js';
import { TEAM } from '../lib/teams.js';
import { Stage } from './Stage.jsx';
import { Avatar, CrownIcon, StoryIcon, TeamIcon, WhistleIcon } from './ui.jsx';

/** Everything after the lobby: the scoreboard around the current turn. */
export function Game({ s, send }) {
  const now = useNow(200);
  useCues(s, now);
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-3 p-3 md:grid-cols-[minmax(170px,1fr)_minmax(0,2.4fr)_minmax(170px,1fr)] md:items-start">
      <ScoreStrip s={s} />
      <TeamPanel team="A" s={s} />
      <div className="grid min-w-0 gap-3">
        <TurnHeader s={s} now={now} />
        <Stage s={s} send={send} now={now} />
        <Log log={s.log} />
      </div>
      <TeamPanel team="B" s={s} />
    </main>
  );
}

/** Beeps for the countdown, the last seconds, and time running out. */
function useCues(s, now) {
  const t = s.turn;
  const count = s.phase === 'countdown' ? secondsLeft(t.countdownEndsAt, now, s.offset) : null;
  const left = s.phase === 'playing' ? secondsLeft(t.endsAt, now, s.offset) : null;
  useEffect(() => {
    if (count > 0) sfx.count();
  }, [count]);
  useEffect(() => {
    if (left > 0 && left <= 5) sfx.tick();
  }, [left]);
  const phase = useRef(s.phase);
  useEffect(() => {
    if (phase.current === 'countdown' && s.phase === 'playing') sfx.go();
    if (phase.current === 'playing' && s.phase !== 'playing' && s.phase !== 'lobby') sfx.timeUp();
    phase.current = s.phase;
  }, [s.phase]);
  // Wrong guesses and clues arriving.
  const feed = useRef(0);
  const size = t?.feed.length ?? 0;
  useEffect(() => {
    if (size > feed.current && t?.feed.at(-1)?.result !== 'hit' && t?.feed.at(-1)?.result !== 'buzz') sfx.pop();
    feed.current = size;
  }, [size, t]);
}

function TurnHeader({ s, now }) {
  const t = s.turn;
  if (!t) return null;
  const T = TEAM[t.team];
  const total = s.settings.seconds * 1000;
  const playing = s.phase === 'playing';
  const msLeft = playing ? Math.max(0, t.endsAt - (now + s.offset)) : s.phase === 'countdown' || s.phase === 'ready' ? total : 0;
  const secs = Math.ceil(msLeft / 1000);
  const urgent = playing && secs <= 10;
  const turnNo = Math.min(s.roundTurns[t.team] + 1, s.roundLen);
  const between = s.phase === 'round_over' || s.phase === 'over';

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink text-white ${between ? 'bg-ink' : T.bg}`}>
          {between ? <span className="font-display text-xl">{s.round}</span> : <TeamIcon team={t.team} className="size-6" />}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="label">
            Round {s.round} of {s.settings.rounds}
          </div>
          <div className="truncate font-display text-2xl">
            {between ? (s.phase === 'over' ? 'Final whistle' : 'Round over') : `${T.name}’s turn`}
            {!between && s.roundLen > 1 && (
              <span className="ml-2 font-sans text-sm font-semibold text-ink-soft">
                {turnNo}/{s.roundLen}
              </span>
            )}
          </div>
        </div>
        {!between && (
          <div
            className={`ml-auto flex min-w-16 items-center justify-center rounded-xl border-2 border-ink px-2 font-display text-4xl tabular-nums ${
              urgent ? 'animate-pulse bg-mamnou3 text-white' : 'bg-white'
            }`}
            role="timer"
            aria-label={`${secs} seconds left`}
          >
            {secs}
          </div>
        )}
      </div>
      {!between && (
        <div className="h-3 border-t-2 border-ink bg-paper-3">
          <div
            className={`h-full transition-[width] duration-200 ease-linear ${urgent ? 'bg-mamnou3' : T.bg}`}
            style={{ width: `${(msLeft / total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Both scores in one row, for screens too narrow for the side panels. */
function ScoreStrip({ s }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:hidden">
      {['A', 'B'].map((team) => {
        const T = TEAM[team];
        const active = s.turn?.team === team && !['round_over', 'over'].includes(s.phase);
        return (
          <div key={team} className={`panel flex items-center gap-2 px-3 py-1.5 ${T.soft} ${active ? 'ring-4 ring-gold' : ''}`}>
            <span className={T.text}>
              <TeamIcon team={team} className="size-6" />
            </span>
            <span className="font-display text-2xl">{T.name}</span>
            <span className="ml-auto font-display text-3xl tabular-nums">{s.scores[team]}</span>
          </div>
        );
      })}
    </div>
  );
}

function TeamPanel({ team, s }) {
  const T = TEAM[team];
  const t = s.turn;
  const active = t?.team === team && !['round_over', 'over'].includes(s.phase);
  const members = s.teams[team].map((id) => s.players.find((p) => p.id === id)).filter(Boolean);
  return (
    <section className={`panel hidden overflow-hidden md:block ${active ? 'ring-4 ring-gold' : ''}`}>
      <header className={`flex items-center gap-2 border-b-2 border-ink px-3 py-2 text-white ${T.bg}`}>
        <TeamIcon team={team} className="size-6" />
        <h2 className="font-display text-2xl leading-none">{T.name}</h2>
        <span className="ml-auto font-display text-4xl leading-none tabular-nums">{s.scores[team]}</span>
      </header>
      <ul className={`grid gap-1 p-2 ${T.soft}`}>
        {members.map((p) => {
          const teller = t?.describer === p.id;
          const ref = t?.watcher === p.id;
          return (
            <li key={p.id} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${p.online ? 'bg-white/70' : 'opacity-45'}`}>
              <Avatar player={p} size={26} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {p.name}
                {p.id === s.you && <span className="font-normal text-ink-soft"> (you)</span>}
              </span>
              {p.id === s.hostId && (
                <span className="text-gold" title="Host">
                  <CrownIcon className="size-3.5" />
                </span>
              )}
              {teller && (
                <span className={`rounded-md border border-ink px-1 text-white ${T.bg}`} title="Hakawati: telling the story">
                  <StoryIcon className="size-4" />
                </span>
              )}
              {ref && (
                <span className="rounded-md border border-ink bg-mamnou3 px-1 text-white" title="Hakam: the referee">
                  <WhistleIcon className="size-4" />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const LOG_TINT = {
  good: 'text-ok',
  bad: 'text-mamnou3',
  warn: 'text-shams-deep',
  muted: 'text-ink-soft',
  info: 'text-ink',
};

function Log({ log }) {
  const [open, setOpen] = useState(false);
  const shown = open ? log.slice().reverse() : log.slice(-1);
  return (
    <section className="panel bg-paper-2 px-3 py-2">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="label">Table talk</span>
        <span className="text-sm font-semibold text-ink-soft">{open ? 'Hide' : 'Show all'}</span>
      </button>
      <ul className={`scroll-thin mt-1 grid gap-0.5 text-sm ${open ? 'max-h-56 overflow-y-auto' : ''}`}>
        {shown.map((l) => (
          <li key={l.id} className={`${LOG_TINT[l.kind] ?? ''} ${open ? '' : 'truncate'}`}>
            {l.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
