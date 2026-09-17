import { TEAM } from '../lib/teams.js';
import { HowToPlay } from './HowToPlay.jsx';
import { Avatar, CrownIcon, TeamIcon } from './ui.jsx';

const ROUNDS = { min: 1, max: 10 };
const SECONDS = [30, 45, 60, 90, 120];

export function Lobby({ s, send, code }) {
  const me = s.players.find((p) => p.id === s.you);
  const host = s.hostId === s.you;
  const online = (team) => s.teams[team].filter((id) => s.players.find((p) => p.id === id)?.online);
  const small = ['A', 'B'].filter((t) => online(t).length === 1);
  const door = s.players.filter((p) => !p.team && p.online);

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 p-3 sm:p-4">
      <div className="text-center">
        <h1 className="font-display text-4xl">Pick a side</h1>
        <p className="text-ink-soft">
          {code ? (
            <>
              Friends join with the code <b className="font-mono tracking-widest text-ink">{code}</b> or your link.
            </>
          ) : (
            'Everyone in this Activity lands here. Pick a team to play.'
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {['A', 'B'].map((team) => (
          <TeamColumn key={team} team={team} s={s} me={me} send={send} />
        ))}
      </div>

      {(door.length > 0 || me?.team) && (
        <div className="panel flex flex-wrap items-center gap-2 p-3">
          <span className="label mr-1">Watching</span>
          {door.length === 0 && <span className="text-sm text-ink-soft">Nobody</span>}
          {door.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-white py-0.5 pr-2.5 pl-0.5 text-sm font-semibold">
              <Avatar player={p} size={22} />
              {p.name}
              {p.id === s.you && <span className="text-ink-soft">(you)</span>}
            </span>
          ))}
          {me?.team && (
            <button className="btn btn-sm ml-auto bg-paper" onClick={() => send({ t: 'team', team: null })}>
              Just watch
            </button>
          )}
        </div>
      )}

      <div className="panel grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex flex-wrap gap-6">
          <Setting label="Rounds">
            {host ? (
              <Stepper
                value={s.settings.rounds}
                min={ROUNDS.min}
                max={ROUNDS.max}
                onChange={(rounds) => send({ t: 'settings', rounds })}
              />
            ) : (
              <b className="text-2xl">{s.settings.rounds}</b>
            )}
          </Setting>
          <Setting label="Seconds per turn">
            {host ? (
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Seconds per turn">
                {SECONDS.map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={s.settings.seconds === n}
                    className={`btn btn-sm ${s.settings.seconds === n ? 'bg-gold' : 'bg-paper'}`}
                    onClick={() => send({ t: 'settings', seconds: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <b className="text-2xl">{s.settings.seconds}s</b>
            )}
          </Setting>
        </div>

        <div className="grid gap-2 sm:justify-items-end">
          {host ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn bg-paper" onClick={() => send({ t: 'shuffle' })} disabled={s.players.filter((p) => p.online).length < 2}>
                Shuffle teams
              </button>
              <button className="btn bg-ok px-6 text-lg text-white" disabled={!s.canStart} onClick={() => send({ t: 'start' })}>
                Yalla, start!
              </button>
            </div>
          ) : (
            <p className="font-semibold text-ink-soft">
              Waiting for <b className="text-ink">{s.players.find((p) => p.id === s.hostId)?.name}</b> to start.
            </p>
          )}
        </div>
        <div className="text-sm text-ink-soft sm:col-span-2">
          {!s.canStart
            ? 'Each team needs at least one player.'
            : small.length > 0
              ? `Tip: ${small.map((t) => TEAM[t].name).join(' and ')} ${small.length > 1 ? 'have' : 'has'} one player, so nobody can guess on their turn. Two or more per team is best.`
              : 'Ready when you are.'}
        </div>
      </div>

      <HowToPlay />
    </main>
  );
}

function TeamColumn({ team, s, me, send }) {
  const T = TEAM[team];
  const members = s.teams[team].map((id) => s.players.find((p) => p.id === id)).filter(Boolean);
  const mine = me?.team === team;
  return (
    <section className={`panel flex flex-col overflow-hidden ${mine ? 'ring-4 ring-gold' : ''}`}>
      <header className={`flex items-center gap-2 border-b-2 border-ink px-4 py-2 text-white ${T.bg}`}>
        <TeamIcon team={team} className="size-7" />
        <h2 className="font-display text-3xl leading-none">{T.name}</h2>
        <span dir="rtl" className="font-display text-2xl leading-none opacity-80">
          {T.ar}
        </span>
        <span className="ml-auto font-bold">{members.length}</span>
      </header>
      <ul className={`flex min-h-28 flex-1 flex-col gap-1.5 p-3 ${T.soft}`}>
        {members.length === 0 && <li className="m-auto text-sm text-ink-soft">No one yet</li>}
        {members.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl bg-white/70 px-2 py-1">
            <Avatar player={p} size={28} />
            <span className="truncate font-semibold">{p.name}</span>
            {p.id === s.you && <span className="text-sm text-ink-soft">(you)</span>}
            {p.id === s.hostId && (
              <span className="ml-auto text-gold" title="Host">
                <CrownIcon />
              </span>
            )}
          </li>
        ))}
      </ul>
      {!mine && (
        <button className={`btn m-3 mt-0 text-white ${T.bg}`} onClick={() => send({ t: 'team', team })}>
          Join {T.name}
        </button>
      )}
    </section>
  );
}

function Setting({ label, children }) {
  return (
    <div className="grid gap-1">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

function Stepper({ value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button className="btn btn-sm size-9 bg-paper p-0 text-xl" aria-label="Fewer" disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <b className="w-8 text-center text-2xl">{value}</b>
      <button className="btn btn-sm size-9 bg-paper p-0 text-xl" aria-label="More" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
