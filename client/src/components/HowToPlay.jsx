import { StoryIcon, WhistleIcon } from './ui.jsx';

const STEPS = [
  {
    icon: <StoryIcon className="size-6" />,
    tint: 'bg-shams-soft',
    title: 'The Hakawati talks',
    body: 'One player gets a card and describes the word, out loud or typed, without saying the word or any of its mamnou3 (forbidden) words.',
  },
  {
    icon: <span className="font-display text-2xl leading-none">?!</span>,
    tint: 'bg-nil-soft',
    title: 'The team types',
    body: 'Teammates type guesses. The right word scores +1 and the next card appears straight away. Typos are fine.',
  },
  {
    icon: <span className="font-display text-xl leading-none text-ok">✓</span>,
    tint: 'bg-ok-soft',
    title: 'Words go green',
    body: 'When a guesser types one of the mamnou3 words, it turns green on the card: the Hakawati may use it from then on.',
  },
  {
    icon: <WhistleIcon className="size-6" />,
    tint: 'bg-mamnou3-soft',
    title: 'The Hakam whistles',
    body: 'A referee from the other team sees the card too and whistles a spoken slip: −1. Typed clues are checked automatically.',
  },
];

export function HowToPlay({ compact = false }) {
  return (
    <section className="w-full">
      {!compact && <h2 className="mb-3 text-center font-display text-3xl">How to play</h2>}
      <ol className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {STEPS.map((s) => (
          <li key={s.title} className="panel flex gap-3 p-3 text-left">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink ${s.tint}`}>{s.icon}</span>
            <div>
              <h3 className="font-bold">{s.title}</h3>
              <p className="text-sm text-ink-soft">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center text-sm text-ink-soft">
        Skipping a card is free once per turn, then −1. Teams take turns until every player has told a story.
      </p>
    </section>
  );
}
