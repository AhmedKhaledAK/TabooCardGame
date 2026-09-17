/**
 * Who you are in a web room: a random id and the name you typed. Web rooms
 * are open by design, so there's nothing to verify.
 *
 * The id lives in sessionStorage: a reload keeps your seat, and a second tab
 * is a second player, which is also how to try the game alone.
 */
const ID_KEY = 'ldw:id';
const NAME_KEY = 'ldw:name';
/** Room codes skip look-alikes (0/O, 1/I) so they survive being read aloud. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function storage(kind) {
  try {
    return window[kind];
  } catch {
    return null; // blocked (sandboxed iframes, strict privacy modes)
  }
}

function random(chars, n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

let id = null;
export function playerId() {
  if (id) return id;
  const s = storage('sessionStorage');
  id = s?.getItem(ID_KEY) || `w-${random('abcdefghijklmnopqrstuvwxyz0123456789', 12)}`;
  s?.setItem(ID_KEY, id);
  return id;
}

export const savedName = () => storage('localStorage')?.getItem(NAME_KEY) ?? '';
export const saveName = (name) => storage('localStorage')?.setItem(NAME_KEY, name);

export const newCode = () => random(CODE_CHARS, 5);
export const cleanCode = (text) => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
