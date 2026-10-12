const shapes = {
  bolt: '<path d="m28 5-17 22h11l-3 16 18-25H25z"/>',
  orb: '<circle cx="24" cy="24" r="12"/><path d="M7 30q17 9 34-13M16 9l3-5m17 32 4 4"/>',
  field:
    '<ellipse cx="24" cy="32" rx="18" ry="9"/><path d="m25 7-8 14h7l-2 10 10-16h-7z"/>',
  storm:
    '<path d="M10 21a8 8 0 0 1 3-15 11 11 0 0 1 20 2 7 7 0 0 1 5 13H10m9 6-5 9h7l-3 9m13-18-4 8h6l-3 8"/>',
  flame:
    '<path d="M24 4q3 12-6 19-4-4-4-9-18 24 4 29 27 6 19-19-2 6-7 6 6-13-6-26Z"/><path d="M23 28q-10 11 1 14 11-3-1-14Z"/>',
  spin: '<path d="M9 25A16 16 0 0 1 35 11l4 6m0-10v10H29M39 26A16 16 0 0 1 13 39l-4-6m0 10V33h10"/><path d="m24 15-5 11h7l-2 8 8-13h-8z"/>',
  rush: '<path d="m20 8 19 16-19 16 4-16zM5 15h12M3 24h13M5 33h12"/>',
  shuriken:
    '<path d="m24 3 6 14 15 7-15 6-6 15-7-15-14-6 14-7z"/><circle cx="24" cy="24" r="4"/>',
  shadow: '<path d="m11 6 14 17-6 8 18 11-12-19 6-9zM4 13h8M3 23h11M5 33h9"/>',
  clone:
    '<path d="M18 7a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM5 41v-6q13-17 26 0v6M34 8a7 7 0 0 1 0 14m2 7q8 4 8 12"/>',
  barrage:
    '<path d="m13 6 3 9 9 3-9 3-3 9-3-9-9-3 9-3zm23 18 3 8 8 3-8 3-3 8-3-8-8-3 8-3zM29 5l-5 9m18-3-8 9M14 35l-5 8"/>',
  bone: '<path d="M9 14a5 5 0 1 1 7-7l20 20a5 5 0 1 1 7 7 5 5 0 1 1-7 7L16 21a5 5 0 1 1-7-7Z"/>',
  shield:
    '<path d="m24 4 17 7-3 18q-4 10-14 15-10-5-14-15L7 11zM16 24l6 6 12-13"/>',
  blast:
    '<path d="m24 3 5 12 13-7-7 14 11 6-14 3 3 14-12-9-10 9 2-14-13-5 13-6-5-12 13 6z"/>',
  attack: '<path d="m11 38 7-13 20-20 5 5-20 20-12 8zM9 22l17 17M6 42l10-10"/>',
  jump: '<path d="M8 39h32M24 34V7m-11 12L24 7l11 12"/>',
};
export function abilityIcon(name: string) {
  const n = name.toLowerCase();
  const key: keyof typeof shapes = /attack|jab|punch/.test(n)
    ? "attack"
    : /jump/.test(n)
      ? "jump"
      : /dash|rush/.test(n)
        ? "rush"
        : /storm/.test(n)
          ? "storm"
          : /field/.test(n)
            ? "field"
            : /spin/.test(n)
              ? "spin"
              : /inferno|flame|cinder/.test(n)
                ? "flame"
                : /shuriken/.test(n)
                  ? "shuriken"
                  : /shadow/.test(n)
                    ? "shadow"
                    : /clone/.test(n)
                      ? "clone"
                      : /barrage/.test(n)
                        ? "barrage"
                        : /bone/.test(n)
                          ? "bone"
                          : /counter|shield/.test(n)
                            ? "shield"
                            : /blast|ultimate/.test(n)
                              ? "blast"
                              : /orb|sphere|droplet/.test(n)
                                ? "orb"
                                : "bolt";
  return `<svg class="skill-icon icon-${key}" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round">${shapes[key]}</svg>`;
}
