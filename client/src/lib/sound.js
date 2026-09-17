import { useSyncExternalStore } from 'react';

/**
 * Tiny synthesised sound effects: no audio files to bundle or fetch. The
 * mute switch is remembered per browser.
 */
const KEY = 'ldw:muted';
let muted = read();
const listeners = new Set();
let ctx = null;

function read() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(v) {
  muted = v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    // not remembered; still applies for this visit
  }
  listeners.forEach((l) => l());
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
  );
}

function audio() {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, at, dur, { type = 'sine', gain = 0.12, to = null, vibrato = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const amp = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (vibrato) {
    const lfo = a.createOscillator();
    const depth = a.createGain();
    lfo.frequency.value = 28;
    depth.gain.value = vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur);
  }
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  hit() {
    tone(660, 0, 0.12, { type: 'triangle' });
    tone(880, 0.09, 0.12, { type: 'triangle' });
    tone(1320, 0.18, 0.22, { type: 'triangle' });
  },
  whistle() {
    tone(2300, 0, 0.45, { gain: 0.08, vibrato: 90 });
  },
  skip() {
    tone(420, 0, 0.18, { type: 'square', gain: 0.05, to: 260 });
  },
  count() {
    tone(520, 0, 0.12, { type: 'triangle' });
  },
  go() {
    tone(784, 0, 0.3, { type: 'triangle', gain: 0.15 });
  },
  tick() {
    tone(1200, 0, 0.04, { type: 'square', gain: 0.03 });
  },
  timeUp() {
    tone(330, 0, 0.5, { type: 'sawtooth', gain: 0.06, to: 180 });
  },
  pop() {
    tone(980, 0, 0.06, { type: 'sine', gain: 0.05 });
  },
};
