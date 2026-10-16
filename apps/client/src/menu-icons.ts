const paths = {
  swipe: '<path d="M4 12h16M7 8l-4 4 4 4m10-8 4 4-4 4"/><path d="M9 4h6M9 20h6" opacity=".5"/>',
  help: '<path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/>',
  settings:
    '<path d="m9 3-.5 3-2 1-3-.5-2 3 2 2v2l-2 2 2 3 3-.5 2 1 .5 3h4l.5-3 2-1 3 .5 2-3-2-2v-2l2-2-2-3-3 .5-2-1L13 3Z"/><circle cx="11" cy="12" r="3"/>',
  friends:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>',
  leaderboard:
    '<path d="M8 3h8v5a4 4 0 0 1-8 0ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 12v6m-5 3h10m-7-3h4v3"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  report: '<path d="M5 21V3m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
  // An open book with a star: the boss bestiary and its rewards.
  bestiary:
    '<path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5C17 4 14 4.5 12 6Z"/><path d="M12 6v14.5"/><path d="m16 8.2.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2Z"/>',
} as const;
export function menuIcon(name: keyof typeof paths) {
  return `<svg class="menu-option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
