// Each combat icon is drawn for its exact ability, rather than guessed from keywords.
const electric = "#ffe17b",
  fire = "#ffa16b",
  water = "#85e5f4",
  aura = "#cfb1ff";
export const abilityArtwork: Record<string, { color: string; art: string }> = {
  Thunderbolt: {
    color: electric,
    art: '<path fill="currentColor" d="m29 4-19 22h12l-4 18 21-26H26z"/><path d="M5 12h8M5 18h5m26 15h7m-9 6h6"/>',
  },
  "Electro Orb": {
    color: electric,
    art: '<circle cx="24" cy="24" r="12" fill="currentColor" fill-opacity=".23"/><circle cx="24" cy="24" r="8"/><path d="m26 15-8 10h6l-2 8 9-12h-6M9 10l-4-4m34 4 4-4M9 38l-4 4m34-4 4 4M4 24h5m30 0h5"/>',
  },
  "Static Field": {
    color: electric,
    art: '<ellipse cx="24" cy="33" rx="19" ry="9" fill="currentColor" fill-opacity=".15"/><ellipse cx="24" cy="33" rx="11" ry="4"/><path d="m25 5-9 15h8l-3 11 12-17h-8zM6 24l-2-7m38 7 2-7"/>',
  },
  Thunderstorm: {
    color: electric,
    art: '<path fill="currentColor" fill-opacity=".18" d="M10 19a7 7 0 0 1 3-13 11 11 0 0 1 19 1 7 7 0 0 1 6 12Z"/><path d="m13 24-4 8h6l-3 9m12-17-4 8h6l-3 11m12-19-4 8h6l-3 9"/><ellipse cx="24" cy="42" rx="18" ry="3" opacity=".6"/>',
  },
  "Flame Burst": {
    color: fire,
    art: '<path fill="currentColor" fill-opacity=".2" d="M35 7q-1 9 5 17 5 17-11 19-17 0-16-15 7-7 5-14 7 5 9 14 5-8 8-21Z"/><path d="M28 28q-8 10 2 12 9-4-2-12ZM4 16h10M3 23h7m-5 7h6"/>',
  },
  "Fire Spin": {
    color: fire,
    art: '<ellipse cx="24" cy="33" rx="19" ry="9"/><path fill="currentColor" fill-opacity=".22" d="M24 9q2 8 8 12 12 14-8 17-19-4-7-19 0 7 5 7 5-9 2-17Z"/><path d="M7 20Q7 5 24 5q14 0 18 14m-1-9 1 9-9-2"/>',
  },
  "Dragon Rush": {
    color: fire,
    art: '<path fill="currentColor" fill-opacity=".25" d="m17 15 7-10 1 10 10-5-2 11 11 6-15 12-11-5 8-8-12-4Z"/><path d="m33 26 5 1M3 14h10M2 23h8M5 32h10m-1 10 6-5"/>',
  },
  Inferno: {
    color: fire,
    art: '<ellipse cx="24" cy="39" rx="20" ry="6"/><path fill="currentColor" fill-opacity=".3" d="M24 4q4 11 9 14 2-5 4-7 12 25-12 28-26-1-17-24 2 8 7 9 8-9 9-20Z"/><path d="M24 24q-10 11 0 14 11-4 0-14Z"/>',
  },
  "Water Shuriken": {
    color: water,
    art: '<path fill="currentColor" fill-opacity=".22" d="m24 4 6 14 14 6-14 6-6 14-6-14-14-6 14-6Z"/><circle cx="24" cy="24" r="4"/><path d="M5 13h8m-9 22h8m23-31v8m8 23h-8"/>',
  },
  "Shadow Step": {
    color: water,
    art: '<path opacity=".4" d="M5 17h11M3 24h12M6 31h10"/><path fill="currentColor" fill-opacity=".15" d="m23 8 8 5-5 12 11 13-8 3-12-15Z"/><path d="m32 6 10 10-10 10m10-10H29"/><ellipse cx="25" cy="42" rx="14" ry="3"/>',
  },
  "Water Clone": {
    color: water,
    art: '<g opacity=".45"><circle cx="13" cy="14" r="6"/><path d="M3 37v-5q10-13 20 0v5Z"/></g><path fill="currentColor" fill-opacity=".18" d="M30 5q-13 15-7 22 10 8 16-2 3-7-9-20Z"/><path d="M20 41v-7q12-12 23 0v7Z"/><path d="m4 44 7-4m-3 0 3 0-1 3"/>',
  },
  "Shuriken Barrage": {
    color: water,
    art: '<path fill="currentColor" fill-opacity=".2" d="m34 5 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm-10 16 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm-12-8 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/><path d="M3 42 14 31m-2 12 7-7M22 14l4-5M38 30l5-5"/>',
  },
  "Aura Sphere": {
    color: aura,
    art: '<circle cx="25" cy="24" r="12" fill="currentColor" fill-opacity=".22"/><path d="M18 26q-2-12 10-9m4 7q2 10-10 9M9 12q-7 14 1 25m29-25q8 13 0 25"/><path d="m25 4-2 4m3 32-2 4M3 24h4m35 0h3"/>',
  },
  "Bone Rush": {
    color: aura,
    art: '<path fill="currentColor" fill-opacity=".25" d="M10 12a4 4 0 1 1 6-6l22 22a4 4 0 1 1 6 6 4 4 0 1 1-6 6L16 18a4 4 0 1 1-6-6Z"/><path d="M5 24q3 14 17 18M5 33l-1-9 9 1m21-15 5-5m0 12h6"/>',
  },
  "Counter Stance": {
    color: aura,
    art: '<path fill="currentColor" fill-opacity=".18" d="m24 4 16 7-3 17q-3 10-13 16-10-6-13-16L8 11Z"/><path d="M16 27h14q8-5 0-10H18m5-5-5 5 5 5"/>',
  },
  "Mega Aura Blast": {
    color: aura,
    art: '<circle cx="17" cy="24" r="10" fill="currentColor" fill-opacity=".35"/><circle cx="17" cy="24" r="5"/><path d="m27 16 17-5-11 13 11 13-17-5M3 8l6 7M3 40l6-7m3-30 3 9m-3 33 3-9"/>',
  },
};
const universal: Record<string, string> = {
  Attack: '<path d="m11 38 7-13 20-20 5 5-20 20-12 8zM9 22l17 17M6 42l10-10"/>',
  Dash: '<path d="m20 8 19 16-19 16 4-16zM5 15h12M3 24h13M5 33h12"/>',
  Jump: '<path d="M8 39h32M24 34V7m-11 12L24 7l11 12"/>',
  Spark: '<path d="m28 5-17 22h11l-3 16 18-25H25z"/>',
  Cinder:
    '<path d="M24 5q4 12 11 18 9 17-11 20-20-3-11-20 3 7 7 6 7-11 4-24Z"/>',
  Droplet:
    '<path d="M24 4Q3 27 13 39q11 12 22 0Q45 27 24 4Z"/><path d="M17 27q-3 8 5 10"/>',
  "Aura Jab":
    '<path d="M10 30V18l6-3 5 2 5-3 7 3 4 10-10 14H15Z"/><path d="M4 10h8m26 0 5-4m-2 15h5"/>',
};
export function abilityIcon(name: string) {
  const design = abilityArtwork[name];
  const color =
    design?.color ??
    (name === "Cinder"
      ? fire
      : name === "Droplet"
        ? water
        : name === "Aura Jab"
          ? aura
          : electric);
  const art = design?.art ?? universal[name] ?? universal.Attack;
  return `<svg class="skill-icon" style="color:${color}" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round">${art}</svg>`;
}
