import { useState } from 'react';
import { setMuted, useMuted } from '../lib/sound.js';
import { Logo, SoundIcon } from './ui.jsx';

export function TopBar({ s, send, code, onLeave, onInvite, onHelp }) {
  const muted = useMuted();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const host = s.hostId === s.you;
  const inGame = s.phase !== 'lobby';

  const copy = async () => {
    const link = `${location.origin}/?room=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this link:', link);
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-paper-2 px-3 py-1.5">
      <Logo size="sm" />
      {code && (
        <div className="ml-1 flex items-center gap-1.5">
          <span className="label hidden sm:inline">Table</span>
          <span className="rounded-lg border-2 border-ink bg-white px-2 font-mono font-bold tracking-widest">{code}</span>
          <button className="btn btn-sm bg-paper" onClick={copy}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        {onInvite && (
          <button className="btn btn-sm bg-nil text-white" onClick={onInvite}>
            Invite
          </button>
        )}
        {inGame && host &&
          (confirming ? (
            <span className="flex items-center gap-1">
              <span className="text-sm font-semibold">End the game?</span>
              <button
                className="btn btn-sm bg-mamnou3 text-white"
                onClick={() => {
                  send({ t: 'reset' });
                  setConfirming(false);
                }}
              >
                Yes
              </button>
              <button className="btn btn-sm bg-paper" onClick={() => setConfirming(false)}>
                No
              </button>
            </span>
          ) : (
            <button className="btn btn-sm bg-paper" onClick={() => setConfirming(true)}>
              End game
            </button>
          ))}
        <button
          className="btn btn-sm bg-paper"
          onClick={() => setMuted(!muted)}
          aria-pressed={!muted}
          aria-label={muted ? 'Sound off' : 'Sound on'}
          title={muted ? 'Sound off' : 'Sound on'}
        >
          <SoundIcon on={!muted} />
        </button>
        <button className="btn btn-sm bg-paper" onClick={onHelp} aria-label="How to play" title="How to play">
          ?
        </button>
        {onLeave && (
          <button className="btn btn-sm bg-paper" onClick={onLeave}>
            Leave
          </button>
        )}
      </div>
    </header>
  );
}
