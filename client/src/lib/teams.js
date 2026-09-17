/** How each team looks. A is Shams (sun), B is Nil (the Nile). */
export const TEAM = {
  A: {
    name: 'Shams',
    ar: 'شمس',
    text: 'text-shams-deep',
    bg: 'bg-shams',
    soft: 'bg-shams-soft',
    border: 'border-shams',
    hex: '#e8731c',
  },
  B: {
    name: 'Nil',
    ar: 'نيل',
    text: 'text-nil-deep',
    bg: 'bg-nil',
    soft: 'bg-nil-soft',
    border: 'border-nil',
    hex: '#1b6fb5',
  },
};

export const other = (team) => (team === 'A' ? 'B' : 'A');
