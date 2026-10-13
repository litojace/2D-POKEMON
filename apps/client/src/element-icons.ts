// Small inline SVG symbols for element badges (HTML side; the Phaser side uses drawElementGlyph).
const paths: Record<string, string> = {
  earth:
    '<path d="M3 19 8 8l4 5 3-6 6 12Z" fill="currentColor"/><path d="m8 8 2 6m5-7 1 6" stroke="#0b1628" stroke-width="1.2" fill="none"/>',
  electric: '<path d="M13 1 4 13h6l-2 10 10-13h-6l3-9Z" fill="currentColor"/>',
  fire: '<path d="M12 1c1 5 6 7 6 13a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 3 4-1-4 0-7 0-10Z" fill="currentColor"/>',
  water:
    '<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z" fill="currentColor"/>',
  aura: '<path d="M6 10V7a2 2 0 0 1 4 0V6a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v8a6 6 0 0 1-6 6H9a5 5 0 0 1-5-5v-3a2 2 0 0 1 2-2Z" fill="currentColor"/>',
  light:
    '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="currentColor"/>',
  psychic:
    '<path d="M12 4a8 8 0 1 0 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M12 8a4 4 0 1 0 4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  shadow:
    '<path d="M5 22V11a7 7 0 0 1 14 0v11l-3-2-2 2-2-2-2 2-2-2Z" fill="currentColor"/><circle cx="9.5" cy="11" r="1.5" fill="#0b1628"/><circle cx="14.5" cy="11" r="1.5" fill="#0b1628"/>',
};
export function elementIcon(element: string) {
  const art = paths[element.toLowerCase()] ?? paths.light;
  return `<svg class="element-icon" viewBox="0 0 24 24" aria-hidden="true">${art}</svg>`;
}
