import { useState } from 'react';

/** The two-line wordmark: Arabic on top, the English spelling under it. */
export function Logo({ size = 'lg' }) {
  const big = size === 'lg';
  return (
    <div className="flex flex-col items-center leading-none select-none" aria-label="Laff w Dawaran">
      <span
        dir="rtl"
        className={`font-display text-ink ${big ? 'text-7xl sm:text-8xl' : 'text-3xl'}`}
        style={{ textShadow: `${big ? 4 : 2}px ${big ? 4 : 2}px 0 var(--color-gold)` }}
      >
        لف ودوران
      </span>
      <span className={`font-display tracking-wide text-rose ${big ? 'mt-1 text-2xl sm:text-3xl' : 'text-sm'}`}>
        Laff w Dawaran
      </span>
    </div>
  );
}

/**
 * A string of triangular flags, like the bunting strung over a Cairo street
 * for Ramadan or a wedding. Purely decorative.
 */
export function Bunting({ className = '' }) {
  const colors = ['#e8731c', '#1b6fb5', '#f2b705', '#c2185b', '#15803d'];
  const flags = Array.from({ length: 40 }, (_, i) => i);
  return (
    <svg className={`block h-5 w-full ${className}`} viewBox="0 0 800 20" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <path d="M0 2 Q400 8 800 2" stroke="#1f1a17" strokeWidth="1.5" fill="none" />
      {flags.map((i) => {
        const x = i * 20;
        const y = 2 + 6 * Math.sin((Math.PI * (x + 10)) / 800) * 0.95;
        return <path key={i} d={`M${x + 2} ${y} L${x + 18} ${y} L${x + 10} ${y + 14} Z`} fill={colors[i % colors.length]} stroke="#1f1a17" strokeWidth="1" />;
      })}
    </svg>
  );
}

export function SunIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M12 1.5v3.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  );
}

export function WavesIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 8c2.5-2.5 5-2.5 7 0s4.5 2.5 7 0 4.5-2.5 6 0" />
      <path d="M2 13c2.5-2.5 5-2.5 7 0s4.5 2.5 7 0 4.5-2.5 6 0" />
      <path d="M2 18c2.5-2.5 5-2.5 7 0s4.5 2.5 7 0 4.5-2.5 6 0" />
    </svg>
  );
}

export function TeamIcon({ team, className }) {
  return team === 'A' ? <SunIcon className={className} /> : <WavesIcon className={className} />;
}

export function WhistleIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 7h12v4.5h-4.2A6.5 6.5 0 1 1 9 7Zm-.5 3.2a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" />
      <rect x="11" y="4" width="4" height="3" rx="1" />
    </svg>
  );
}

export function StoryIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </svg>
  );
}

export function CrownIcon({ className = 'size-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" />
    </svg>
  );
}

const isSnowflake = (id) => /^\d{15,21}$/.test(id);

function hue(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/**
 * Discord avatars come through the Activity's /cdn URL mapping (the CSP blocks
 * cdn.discordapp.com itself). Web players, or a missing mapping, get coloured
 * initials instead, the same colour for the same person on every screen.
 */
export function Avatar({ player, size = 32, className = '' }) {
  const [broken, setBroken] = useState(false);
  const { id, name, avatar } = player;
  const style = { width: size, height: size };
  if (!isSnowflake(id) || broken) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-bold text-white ${className}`}
        style={{ ...style, background: `hsl(${hue(id)} 55% 38%)`, fontSize: size * 0.4 }}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
    );
  }
  const src = avatar
    ? `/cdn/avatars/${id}/${avatar}.png?size=${size > 32 ? 128 : 64}`
    : `/cdn/embed/avatars/${Number((BigInt(id) >> 22n) % 6n)}.png`;
  return (
    <img
      className={`shrink-0 rounded-full border-2 border-ink bg-paper-2 ${className}`}
      style={style}
      src={src}
      alt=""
      onError={() => setBroken(true)}
    />
  );
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : String(name).slice(0, 2);
  return s.toUpperCase();
}

export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center gap-3 text-ink-soft" role="status">
      <span className="size-10 animate-spin rounded-full border-4 border-paper-3 border-t-shams" />
      {label && <span className="font-semibold">{label}</span>}
    </div>
  );
}

export function Screen({ children }) {
  return (
    <div className="flex min-h-full flex-col">
      <Bunting />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">{children}</div>
    </div>
  );
}

export function SoundIcon({ on, className = 'size-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
    </svg>
  );
}
