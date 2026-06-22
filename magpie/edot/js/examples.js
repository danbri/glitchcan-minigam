// examples.js — ready-to-open sample documents shown under File ▸ Examples.
//
// `src` is loaded same-origin when `local`, otherwise through the
// open-from-URL path (which smart-rewrites git hosting URLs). Add entries here
// to grow the menu — nothing else needs to change.

export const EXAMPLES = [
  {
    title: 'Searching for Logic — Adam Morton',
    src: 'examples/searching-for-logic.docx',
    local: true,
    note: 'A complete logic textbook (100k+ words, 100+ tables, figures). Big — give it a moment to load.',
    credit: '© Adam Morton, freely distributed for educational use · fernieroad.ca',
  },
  {
    title: 'edot README (from GitHub raw)',
    src: 'https://raw.githubusercontent.com/danbri/glitchcan-minigam/master/magpie/edot/README.md',
    local: false,
    note: 'Demonstrates Open-from-URL against a CORS-friendly raw.githubusercontent.com link.',
  },
];
