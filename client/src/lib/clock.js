import { useEffect, useState } from 'react';

/** Re-renders every `ms` and returns the current time. */
export function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Whole seconds left until a server timestamp, never negative. */
export function secondsLeft(at, now, offset) {
  if (at == null) return null;
  return Math.max(0, Math.ceil((at - (now + offset)) / 1000));
}
