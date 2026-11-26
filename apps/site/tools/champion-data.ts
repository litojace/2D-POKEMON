// What the website shows about each champion, read from the game's shared
// rules (packages/shared). Used by gen-data.ts to write data/champions.json,
// and by tests/unit/site.test.ts to check that file is current.
import {
  CHARACTERS,
  ULT_SLOT,
  type Ability,
} from "../../../packages/shared/src/index";
import {
  CHAMPION_SKINS,
  type ChampionSkin,
} from "../../../packages/shared/src/shop";

/** Roster order on the site: two per element, in the game's element order. */
export const SITE_ORDER = [
  "voltkit",
  "coilemur",
  "cindrake",
  "pyranda",
  "tidefin",
  "glacelle",
  "auralynx",
  "halcyra",
  "lumoth",
  "sunbara",
  "mystowl",
  "astrabun",
  "terradon",
  "wombolder",
  "duskveil",
  "shadopus",
  "pangrove",
  "mossloth",
] as const;

/** How many skins each champion's panel shows (the rarest first). */
export const FEATURED_SKINS = 4;
const RARITY_RANK = { mythical: 0, legendary: 1, epic: 2, rare: 3, common: 4 };

const PASSIVES = {
  plates: "Armour plates",
  moss: "Moss garden",
} as const;

const move = (a: Ability) => ({
  name: a.name,
  description: a.description,
  kind: a.kind,
  damage: a.damage,
  ...(a.cooldown ? { cooldown: a.cooldown } : {}),
  ...(a.interval ? { interval: a.interval } : {}),
  ...(a.status ? { status: a.status } : {}),
});

const featured = (id: string) =>
  CHAMPION_SKINS.filter((s: ChampionSkin) => s.champion === id)
    .map((s, i) => ({ s, i }))
    .sort(
      (a, b) => RARITY_RANK[a.s.rarity] - RARITY_RANK[b.s.rarity] || a.i - b.i,
    )
    .slice(0, FEATURED_SKINS)
    .map(({ s }) => ({ id: s.id, name: s.name, rarity: s.rarity }));

export function siteChampions() {
  return SITE_ORDER.map((id) => {
    const c = CHARACTERS[id];
    return {
      id: c.id,
      name: c.name,
      element: c.element,
      role: c.role,
      description: c.description,
      color: `#${c.color.toString(16).padStart(6, "0")}`,
      health: c.health,
      speed: c.speed,
      /** The basic attack's reach, in game units (the court is 1600 wide). */
      reach: c.basic.range,
      ...(c.passive ? { passive: PASSIVES[c.passive] } : {}),
      basic: move(c.basic),
      skills: c.skills.slice(0, ULT_SLOT).map(move),
      ultimate: move(c.skills[ULT_SLOT]),
      skins: featured(c.id),
      skinCount: CHAMPION_SKINS.filter((s) => s.champion === c.id).length,
    };
  });
}
export type SiteChampion = ReturnType<typeof siteChampions>[number];
