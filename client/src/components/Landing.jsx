import { useState } from 'react';
import { cleanCode } from '../lib/identity.js';
import { HowToPlay } from './HowToPlay.jsx';
import { Bunting, Logo } from './ui.jsx';

export function Landing({ name, setName, initialCode, notice, onCreate, onJoin }) {
  const [code, setCode] = useState(initialCode);
  const named = name.trim().length > 0;
  const joinable = named && code.length === 5;

  return (
    <div className="flex min-h-full flex-col">
      <Bunting />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-8 px-4 py-8">
        <div className="text-center">
          <Logo />
          <p className="mx-auto mt-4 max-w-md text-lg text-ink-soft">
            Talk your way around the word. Your team types guesses, and the other team watches for the <b className="text-mamnou3">mamnou3</b> words.
          </p>
        </div>

        {notice && (
          <p role="alert" className="panel border-mamnou3 bg-mamnou3-soft px-4 py-2 font-semibold">
            {notice}
          </p>
        )}

        <div className="panel grid w-full max-w-xl gap-5 p-5 sm:p-6">
          <label className="grid gap-1.5 text-left">
            <span className="label">Your name</span>
            <input
              className="field text-lg"
              value={name}
              maxLength={24}
              autoComplete="nickname"
              placeholder="e.g. Hoda"
              onChange={(e) => setName(e.target.value)}
              autoFocus={!name}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <button className="btn bg-shams py-3 text-lg text-white" disabled={!named} onClick={onCreate}>
              Open a new table
            </button>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (joinable) onJoin(code);
              }}
            >
              <input
                className="field min-w-0 text-center font-mono text-lg tracking-[0.3em] uppercase"
                value={code}
                placeholder="CODE"
                aria-label="Table code"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setCode(cleanCode(e.target.value))}
              />
              <button className="btn bg-nil text-white" disabled={!joinable}>
                Join
              </button>
            </form>
          </div>
          {!named && <p className="-mt-2 text-sm text-ink-soft">Pick a name first.</p>}
        </div>

        <HowToPlay />
      </main>
    </div>
  );
}
