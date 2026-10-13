import { CHARACTERS } from "@arena/shared";
// Each combat icon is drawn for its exact ability, rather than guessed from keywords.
const electric = "#ffe17b",
  fire = "#ffa16b",
  water = "#85e5f4",
  aura = "#cfb1ff";
export const abilityArtwork: Record<string, { color: string; art: string }> = {
  "Arc Pulse": {
    color: electric,
    art: '<path fill="currentColor" d="m29 4-19 22h12l-4 18 21-26H26z"/><path d="M5 12h8M5 18h5m26 15h7m-9 6h6"/>',
  },
  "Charge Orb": {
    color: electric,
    art: '<circle cx="24" cy="24" r="12" fill="currentColor" fill-opacity=".23"/><circle cx="24" cy="24" r="8"/><path d="m26 15-8 10h6l-2 8 9-12h-6M9 10l-4-4m34 4 4-4M9 38l-4 4m34-4 4 4M4 24h5m30 0h5"/>',
  },
  "Livewire Field": {
    color: electric,
    art: '<ellipse cx="24" cy="33" rx="19" ry="9" fill="currentColor" fill-opacity=".15"/><ellipse cx="24" cy="33" rx="11" ry="4"/><path d="m25 5-9 15h8l-3 11 12-17h-8zM6 24l-2-7m38 7 2-7"/>',
  },
  Overcharge: {
    color: electric,
    art: '<path fill="currentColor" fill-opacity=".18" d="M10 19a7 7 0 0 1 3-13 11 11 0 0 1 19 1 7 7 0 0 1 6 12Z"/><path d="m13 24-4 8h6l-3 9m12-17-4 8h6l-3 11m12-19-4 8h6l-3 9"/><ellipse cx="24" cy="42" rx="18" ry="3" opacity=".6"/>',
  },
  "Crest Flare": {
    color: fire,
    art: '<path fill="currentColor" fill-opacity=".2" d="M35 7q-1 9 5 17 5 17-11 19-17 0-16-15 7-7 5-14 7 5 9 14 5-8 8-21Z"/><path d="M28 28q-8 10 2 12 9-4-2-12ZM4 16h10M3 23h7m-5 7h6"/>',
  },
  "Ember Ring": {
    color: fire,
    art: '<ellipse cx="24" cy="33" rx="19" ry="9"/><path fill="currentColor" fill-opacity=".22" d="M24 9q2 8 8 12 12 14-8 17-19-4-7-19 0 7 5 7 5-9 2-17Z"/><path d="M7 20Q7 5 24 5q14 0 18 14m-1-9 1 9-9-2"/>',
  },
  "Ember Rush": {
    color: fire,
    art: '<path fill="currentColor" fill-opacity=".25" d="m17 15 7-10 1 10 10-5-2 11 11 6-15 12-11-5 8-8-12-4Z"/><path d="m33 26 5 1M3 14h10M2 23h8M5 32h10m-1 10 6-5"/>',
  },
  "Solar Bloom": {
    color: fire,
    art: '<ellipse cx="24" cy="39" rx="20" ry="6"/><path fill="currentColor" fill-opacity=".3" d="M24 4q4 11 9 14 2-5 4-7 12 25-12 28-26-1-17-24 2 8 7 9 8-9 9-20Z"/><path d="M24 24q-10 11 0 14 11-4 0-14Z"/>',
  },
  "Tidal Blade": {
    color: water,
    art: '<path fill="currentColor" fill-opacity=".22" d="m24 4 6 14 14 6-14 6-6 14-6-14-14-6 14-6Z"/><circle cx="24" cy="24" r="4"/><path d="M5 13h8m-9 22h8m23-31v8m8 23h-8"/>',
  },
  Slipstream: {
    color: water,
    art: '<path opacity=".4" d="M5 17h11M3 24h12M6 31h10"/><path fill="currentColor" fill-opacity=".15" d="m23 8 8 5-5 12 11 13-8 3-12-15Z"/><path d="m32 6 10 10-10 10m10-10H29"/><ellipse cx="25" cy="42" rx="14" ry="3"/>',
  },
  "Mirror Current": {
    color: water,
    art: '<g opacity=".45"><circle cx="13" cy="14" r="6"/><path d="M3 37v-5q10-13 20 0v5Z"/></g><path fill="currentColor" fill-opacity=".18" d="M30 5q-13 15-7 22 10 8 16-2 3-7-9-20Z"/><path d="M20 41v-7q12-12 23 0v7Z"/><path d="m4 44 7-4m-3 0 3 0-1 3"/>',
  },
  "Riptide Volley": {
    color: water,
    art: '<path fill="currentColor" fill-opacity=".2" d="m34 5 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm-10 16 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm-12-8 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/><path d="M3 42 14 31m-2 12 7-7M22 14l4-5M38 30l5-5"/>',
  },
  "Prism Shot": {
    color: aura,
    art: '<circle cx="25" cy="24" r="12" fill="currentColor" fill-opacity=".22"/><path d="M18 26q-2-12 10-9m4 7q2 10-10 9M9 12q-7 14 1 25m29-25q8 13 0 25"/><path d="m25 4-2 4m3 32-2 4M3 24h4m35 0h3"/>',
  },
  "Shard Combination": {
    color: aura,
    art: '<path fill="currentColor" fill-opacity=".25" d="M10 12a4 4 0 1 1 6-6l22 22a4 4 0 1 1 6 6 4 4 0 1 1-6 6L16 18a4 4 0 1 1-6-6Z"/><path d="M5 24q3 14 17 18M5 33l-1-9 9 1m21-15 5-5m0 12h6"/>',
  },
  "Prism Guard": {
    color: aura,
    art: '<path fill="currentColor" fill-opacity=".18" d="m24 4 16 7-3 17q-3 10-13 16-10-6-13-16L8 11Z"/><path d="M16 27h14q8-5 0-10H18m5-5-5 5 5 5"/>',
  },
  "Nova Ray": {
    color: aura,
    art: '<circle cx="17" cy="24" r="10" fill="currentColor" fill-opacity=".35"/><circle cx="17" cy="24" r="5"/><path d="m27 16 17-5-11 13 11 13-17-5M3 8l6 7M3 40l6-7m3-30 3 9m-3 33 3-9"/>',
  },
  "Bramble Seed": {
    color: "#a6d98f",
    art: '<path d="M24 5q20 18 7 31-17 13-21-5Q7 14 24 5Z"/><path d="M18 35 29 15m-9 16-7-5m11-4 9 2"/>',
  },
  "Verdant Guard": {
    color: "#a6d98f",
    art: '<path d="m24 5 16 8-4 19-12 11-12-11-4-19Z"/><path d="M24 34V15m0 8q-15-1-10-10 13 1 10 10m0 4q15-1 10-10-13 1-10 10"/>',
  },
  "Root Garden": {
    color: "#a6d98f",
    art: '<path d="M7 40q7-24 17-6 10-18 17 6M24 34V10m0 9Q8 18 12 7q14 0 12 12m0 8q16-1 12-12-14 0-12 12"/>',
  },
  "Wild Bloom": {
    color: "#a6d98f",
    art: '<circle cx="24" cy="21" r="6"/><path d="M24 15q-12-23-14-4-19 2 1 14-7 20 13 8 20 12 13-8 20-12 1-14-2-19-14 4ZM24 33v11"/>',
  },
  "Ice Lance": {
    color: "#c0efff",
    art: '<path d="m10 39 12-27 9-8 7 14-24 25Zm12-27 9 6-21 21M5 13l7 2m25 20 7 3"/>',
  },
  "Snow Drift": {
    color: "#c0efff",
    art: '<path d="M5 36q12-20 24-8 8 8 14-10M6 43q12-16 25-5m0-24 7-9 5 9-6 9Z"/>',
  },
  "Cold Front": {
    color: "#c0efff",
    art: '<path d="M8 34h32M24 6v23M14 11l20 13M34 11 14 24M10 39l-4 4m14-4-2 6m12-6 2 6m6-6 4 4"/><ellipse cx="24" cy="34" rx="18" ry="5"/>',
  },
  "Crystal Blizzard": {
    color: "#c0efff",
    art: '<path d="m24 3 7 10-7 13-7-13Zm-15 16 5 8-5 11-5-11Zm30 0 5 8-5 11-5-11ZM19 34l5 11 5-11M3 13h6m30 0h6"/>',
  },
  "Cloak Rend": {
    color: "#bd9be7",
    art: '<path d="M5 39 17 12l7-6-11 28m10 7 11-26 9-8-11 27M3 45q21-13 42 0"/>',
  },
  "Shadow Veil": {
    color: "#bd9be7",
    art: '<path d="M8 29q0-23 16-24 16 1 16 24l-8 12-8-5-8 5Zm5-8 7 3m15-3-7 3M4 12l5 3m30 0 5-3"/>',
  },
  "Hollow Echo": {
    color: "#bd9be7",
    art: '<path d="M6 35q2-22 12-24 10 2 12 24l-6 7-6-4-6 4Zm19-25q14-6 17 15l-3 8-5-3M10 25h5m7 0h4"/>',
  },
  Eclipse: {
    color: "#bd9be7",
    art: '<circle cx="24" cy="22" r="13"/><path d="M28 10q-16 13-2 24M6 42q18-13 36 0M24 2v4M3 22h5m32 0h5"/>',
  },
  Faultline: {
    color: "#e2b68c",
    art: '<path d="m7 7 15 8-6 9 13 6-3 11m-2-30 8 8-6 5 14 7M3 43h10m20 0h12"/>',
  },
  "Mineral Guard": {
    color: "#e2b68c",
    art: '<path d="m24 3 17 11-4 19-13 12-13-12-4-19Zm0 9 8 12-8 11-8-11Z"/>',
  },
  "Boulder Charge": {
    color: "#e2b68c",
    art: '<path d="m22 10 14 4 7 12-9 13-15-2-7-13Zm0 0-2 13 14 16M2 12h10M2 24h6M2 36h10"/>',
  },
  "Seismic Crown": {
    color: "#e2b68c",
    art: '<path d="m9 28-3-14 11 6 7-15 7 15 11-6-3 14ZM4 38l9-5 5 5 6-6 6 6 5-5 9 5M12 44h24"/>',
  },
  "Bough Bash": {
    color: "#a6d98f",
    art: '<path d="M8 33q3-23 22-23l10 17-8 14H15Zm3-4h24M24 14v19"/>',
  },
  "Frost Flake": {
    color: "#c0efff",
    art: '<path d="M24 4v40M7 14l34 20M7 34l34-20M18 8l6 6 6-6m-12 32 6-6 6 6"/>',
  },
  "Night Wisp": {
    color: "#bd9be7",
    art: '<path d="M30 5q-22 9-20 28 6 15 20 7 11-8-1-17 5 14-6 9-9-5 7-27Z"/>',
  },
  "Stone Knuckle": {
    color: "#e2b68c",
    art: '<path d="m8 18 8-8 8 3 6-4 10 8-2 17-15 10-13-9Zm8-8 3 16 19 8m-19-8-9 9"/>',
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
  "Crystal Jab":
    '<path d="M10 30V18l6-3 5 2 5-3 7 3 4 10-10 14H15Z"/><path d="M4 10h8m26 0 5-4m-2 15h5"/>',
};
// Roster move names reuse the hand-drawn generic icons above; colour follows the move's element.
const pokemonIconSources: Record<string, string> = {
  "Thunder Jolt": "Spark",
  "Thunder Shock": "Arc Pulse",
  "Electro Orb": "Charge Orb",
  "Thunder Field": "Livewire Field",
  "Volt Overload": "Overcharge",
  "Flame Puff": "Cinder",
  "Fire Breath": "Crest Flare",
  "Flame Burst": "Ember Rush",
  "Inferno Spin": "Ember Ring",
  "Solar Blaze": "Solar Bloom",
  "Water Kunai": "Droplet",
  "Aqua Ring": "Snow Drift",
  "Shadow Clone": "Mirror Current",
  "Tidal Surge": "Cold Front",
  "Aura Jab": "Crystal Jab",
  "Aura Sphere": "Prism Shot",
  "Force Palm": "Shard Combination",
  "Counter Stance": "Prism Guard",
  "Aura Burst": "Nova Ray",
  "Swift Star": "Frost Flake",
  "Star Volley": "Riptide Volley",
  Bite: "Stone Knuckle",
  "Last Resort": "Crystal Blizzard",
  "Psy Bolt": "Bramble Seed",
  Psybeam: "Ice Lance",
  "Psychic Wave": "Seismic Crown",
  Barrier: "Verdant Guard",
  Psystrike: "Wild Bloom",
  "Heavy Swipe": "Bough Bash",
  "Body Slam": "Boulder Charge",
  Yawn: "Root Garden",
  "Heavy Impact": "Faultline",
  "Shadow Orb": "Night Wisp",
  "Shadow Sneak": "Cloak Rend",
  "Will-O-Wisp": "Hollow Echo",
  Hex: "Shadow Veil",
  "Shadow Ball": "Eclipse",
};
const elementColors: Record<string, string> = {
  Electric: electric,
  Fire: fire,
  Water: water,
  Fighting: "#8fd3ff",
  Normal: "#ffd8a0",
  Psychic: "#e3a6ff",
  Ghost: "#b88cff",
};
const moveElements = new Map(
  Object.values(CHARACTERS).flatMap((c) =>
    [c.basic, ...c.skills].map((a) => [a.name, c.element] as const),
  ),
);
for (const [name, source] of Object.entries(pokemonIconSources)) {
  const prior = abilityArtwork[source];
  abilityArtwork[name] = {
    color: elementColors[moveElements.get(name) ?? ""] ?? prior?.color ?? aura,
    art: prior?.art ?? universal[source] ?? universal.Attack,
  };
}
abilityArtwork["Helping Hand"] = {
  color: elementColors.Normal,
  art: '<path d="M14 42V22q0-4 4-4t4 4v-9q0-4 4-4t4 4v4q0-4 4-4t4 4v14q0 10-10 11Z"/><path d="M8 6v8M4 10h8m28-6v6m-3-3h6"/>',
};
abilityArtwork["Rest"] = {
  color: elementColors.Normal,
  art: '<path d="M8 10h11L8 24h11M24 20h8l-8 10h8M34 32h6l-6 8h6"/>',
};
abilityArtwork["Water Shuriken"] = {
  color: "#85e5f4",
  art: '<path d="m24 4 6 13 15 7-15 6-6 15-6-15-15-6 15-7Z"/><circle cx="24" cy="24" r="5"/>',
};
export function abilityIcon(name: string) {
  const design = abilityArtwork[name];
  const color =
    design?.color ??
    (name === "Cinder"
      ? fire
      : name === "Droplet"
        ? water
        : name === "Crystal Jab"
          ? aura
          : electric);
  const art = design?.art ?? universal[name] ?? universal.Attack;
  return `<svg class="skill-icon" style="color:${color}" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round">${art}</svg>`;
}
