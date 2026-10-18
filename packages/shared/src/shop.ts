/**
 * The Shop's catalog, coin rules and daily missions (see
 * docs/raid-roster-design.md §10). The database (migration 010) is seeded
 * from these lists by scripts/shop-seed.mjs and is what actually sells,
 * pays and checks; a unit test keeps the two identical.
 */
import type { CharacterId } from "./index.js";
import type { RaidSlot } from "./raid.js";

export type Rarity = "common" | "rare" | "epic" | "mythical";
export const RARITIES: Rarity[] = ["common", "rare", "epic", "mythical"];
export const RARITY_NAMES: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  mythical: "Mythical",
};
/** Champion skin prices by rarity. */
export const SKIN_PRICES: Record<Rarity, number> = {
  common: 500,
  rare: 1500,
  epic: 3500,
  mythical: 8000,
};
/** Mythicals: wins with the champion before you can buy, and to awaken. */
export const MYTHIC_TRIAL_WINS = 30;
export const AWAKENING = { stage2Wins: 25, stage3Wins: 75 } as const;

export type Collection =
  | "winter"
  | "festival"
  | "garden"
  | "arcade"
  | "celestial"
  | "candy"
  | "galaxy"
  | "retro";
export const COLLECTION_NAMES: Record<Collection, string> = {
  winter: "Winter",
  festival: "Festival",
  garden: "Garden",
  arcade: "Arcade",
  celestial: "Celestial",
  candy: "Candy",
  galaxy: "Galaxy",
  retro: "Retro Pixel",
};

export interface ChampionSkin {
  id: string;
  champion: CharacterId;
  name: string;
  rarity: Rarity;
  collection?: Collection;
  description: string;
}
const skin = (
  champion: CharacterId,
  slug: string,
  name: string,
  rarity: Rarity,
  description: string,
  collection?: Collection,
): ChampionSkin => ({
  id: `${champion}-${slug}`,
  champion,
  name,
  rarity,
  description,
  ...(collection ? { collection } : {}),
});

/** 7 per champion: 3 Common, 2 Rare, 1 Epic, 1 Mythical. */
export const CHAMPION_SKINS: ChampionSkin[] = [
  skin("voltkit", "midnight", "Midnight", "common", "Navy fur, cyan cheeks"),
  skin("voltkit", "peach-fizz", "Peach Fizz", "common", "Peach and pink"),
  skin("voltkit", "mint-static", "Mint Static", "common", "Mint and white"),
  skin("voltkit", "snowcap", "Snowcap", "rare", "Frosty fur and earmuffs; dashing leaves snowflakes", "winter"),
  skin("voltkit", "kite-runner", "Kite Runner", "rare", "Paper-kite stripes and a trailing ribbon; dashing leaves confetti", "festival"),
  skin("voltkit", "neon-arcade", "Neon Arcade", "epic", "Synthwave grid fur, magenta skills, pixel hit sparks", "arcade"),
  skin("voltkit", "stormcrown", "Stormcrown", "mythical", "Storm-grey fur with gold lightning, a rain cloud and a crown of bolts", "celestial"),

  skin("cindrake", "ashen", "Ashen", "common", "Charcoal body, ember crest"),
  skin("cindrake", "coral", "Coral", "common", "Coral pink and cream"),
  skin("cindrake", "lime-flame", "Lime Flame", "common", "A green flame crest"),
  skin("cindrake", "chili-pepper", "Chili Pepper", "rare", "Glossy red with a green stem cap; dashing puffs spice", "garden"),
  skin("cindrake", "blue-flame", "Blue Flame", "rare", "A cool blue crest and white-hot skills", "winter"),
  skin("cindrake", "volcano-forge", "Volcano Forge", "epic", "Smith's goggles and molten metal; anvil-spark hits", "festival"),
  skin("cindrake", "sunforged", "Sunforged", "mythical", "Obsidian with sun-gold cracks and a crest that becomes a sun", "celestial"),

  skin("tidefin", "bubblegum", "Bubblegum", "common", "Classic pink with magenta gills"),
  skin("tidefin", "abyss", "Abyss", "common", "Deep navy with teal gills"),
  skin("tidefin", "sandbar", "Sandbar", "common", "Sand and sea-green"),
  skin("tidefin", "koi-pond", "Koi Pond", "rare", "Koi spots; dashing leaves lily pads", "garden"),
  skin("tidefin", "corsair", "Corsair", "rare", "A tricorn hat; splashes of gold coins", "festival"),
  skin("tidefin", "glacier", "Glacier", "epic", "A crystal-ice body; skills turn to ice and snow", "winter"),
  skin("tidefin", "moontide", "Moontide", "mythical", "A glowing deep-sea body, moonlit skills and jellyfish clones", "celestial"),

  skin("auralynx", "snowshoe", "Snowshoe", "common", "White fur, ice-blue fists"),
  skin("auralynx", "desert", "Desert", "common", "Tan fur, amber fists"),
  skin("auralynx", "twilight", "Twilight", "common", "Purple fur, rose fists"),
  skin("auralynx", "cherry-blossom", "Cherry Blossom", "rare", "A blossom-pink robe; petals drift as it dashes", "garden"),
  skin("auralynx", "jade-temple", "Jade Temple", "rare", "Jade fists and red tassels", "festival"),
  skin("auralynx", "stained-glass", "Stained Glass", "epic", "Fists and robe of stained-glass panels; glass-shard hits", "arcade"),
  skin("auralynx", "celestial-sage", "Celestial Sage", "mythical", "Star-filled fur, orbiting stones and a mandala guard", "celestial"),

  skin("lumoth", "lunar", "Lunar", "common", "Silver-white fluff"),
  skin("lumoth", "peachy", "Peachy", "common", "Peach and cream"),
  skin("lumoth", "dusk", "Dusk", "common", "Lilac and navy"),
  skin("lumoth", "rosy-maple", "Rosy Maple", "rare", "Pink and buttery yellow; soft dust puffs", "garden"),
  skin("lumoth", "paper-lantern", "Paper Lantern", "rare", "Wings like warm paper lanterns", "festival"),
  skin("lumoth", "aurora", "Aurora", "epic", "Wings that ripple through northern-lights colours", "winter"),
  skin("lumoth", "starweaver", "Starweaver", "mythical", "Wings woven from starlight and shooting-star sparks", "celestial"),

  skin("mystowl", "snowy", "Snowy", "common", "White feathers, gold eyes"),
  skin("mystowl", "barn", "Barn", "common", "Tan with a heart-shaped face"),
  skin("mystowl", "midnight", "Midnight", "common", "Dark blue, silver eyes"),
  skin("mystowl", "scholar", "Scholar", "rare", "A tiny graduation cap; pages flutter as it dashes", "festival"),
  skin("mystowl", "witchs-familiar", "Witch's Familiar", "rare", "A pointed hat and potion bubbles", "garden"),
  skin("mystowl", "clockwork", "Clockwork", "epic", "Brass gears and a golden clock-hand Focus Ray", "arcade"),
  skin("mystowl", "oracle", "Oracle", "mythical", "A third eye that opens onto a galaxy, with orbiting rune cards", "celestial"),

  skin("terradon", "mossy", "Mossy", "common", "Moss on the shell"),
  skin("terradon", "sandstone", "Sandstone", "common", "Red-orange layered stone"),
  skin("terradon", "granite", "Granite", "common", "Speckled grey"),
  skin("terradon", "bonsai", "Bonsai", "rare", "A tiny bonsai tree on its head; leaves drop as it dashes", "garden"),
  skin("terradon", "snowball", "Snowball", "rare", "A snowy shell and a knitted scarf", "winter"),
  skin("terradon", "geode", "Geode", "epic", "Cracks of glowing amethyst; crystal Tremor", "arcade"),
  skin("terradon", "world-shell", "World-Shell", "mythical", "A tiny living island on its back, with birds and a waterfall", "celestial"),

  skin("duskveil", "ember", "Ember", "common", "Orange flame, charcoal hood"),
  skin("duskveil", "ghost-white", "Ghost White", "common", "A pale hood and blue flame"),
  skin("duskveil", "teal-spirit", "Teal Spirit", "common", "Teal flame, navy hood"),
  skin("duskveil", "pumpkin-lantern", "Pumpkin Lantern", "rare", "A carved-pumpkin glow; autumn leaves on dash", "festival"),
  skin("duskveil", "paper-lantern", "Paper Lantern", "rare", "A red paper-lantern glow and tassels", "festival"),
  skin("duskveil", "candlelight", "Candlelight", "epic", "A melting-candle hood; candle-flame Ghostfire", "garden"),
  skin("duskveil", "eclipse", "Eclipse", "mythical", "A hood that becomes a total eclipse; a tiny black-sun Void Orb", "celestial"),
];

/** All-fighter collection pieces for the five appearance slots. */
export interface LookItem {
  id: string;
  slot: RaidSlot;
  name: string;
  rarity: Rarity;
  collection: Collection;
  description: string;
  price: number;
}
const LOOK_SLOTS: [RaidSlot, string, Rarity, number][] = [
  ["skin", "colours", "common", 300],
  ["aura", "aura", "rare", 900],
  ["entrance", "entrance", "rare", 1000],
  ["frame", "frame", "rare", 800],
  ["victory", "victory", "epic", 1800],
];
const LOOK_SETS: [Collection, [string, string][]][] = [
  ["candy", [["Candy colours", "Pastel swirls"], ["Sprinkle aura", "A ring of rainbow sprinkles"], ["Gift-box entrance", "Pop out of a gift box"], ["Cookie frame", "A frosted-cookie border"], ["Cake victory", "A confetti cake bursts behind you"]]],
  ["galaxy", [["Galaxy colours", "A deep-space tint"], ["Nebula aura", "A slow, glowing nebula ring"], ["Star-tunnel entrance", "Warp in through a tunnel of stars"], ["Planet-ring frame", "A border with a ringed planet"], ["Supernova victory", "A supernova blooms behind you"]]],
  ["retro", [["Retro colours", "An 8-bit palette"], ["Pixel-heart aura", "A ring of pixel hearts"], ["Player One entrance", "A blocky pixel spawn"], ["Cartridge frame", "A game-cartridge border"], ["Level Up victory", "LEVEL UP! in big pixels"]]],
  ["festival", [["Festival colours", "Lantern red and gold"], ["Lantern aura", "Floating paper lanterns"], ["Firecracker entrance", "Arrive with a firecracker pop"], ["Tassel frame", "A knot-and-tassel border"], ["Fireworks victory", "A fireworks finale"]]],
  ["garden", [["Spring colours", "Fresh spring greens"], ["Petal aura", "A ring of drifting petals"], ["Bloom entrance", "Bloom out of a flower"], ["Vine frame", "A leafy vine border"], ["Flower-shower victory", "Flowers rain down around you"]]],
  ["winter", [["Frost colours", "A frosty tint"], ["Snowflake aura", "A ring of snowflakes"], ["Flurry entrance", "Arrive in a snow flurry"], ["Icicle frame", "An icicle border"], ["Snow-globe victory", "A snow globe shakes around you"]]],
];
export const LOOK_ITEMS: LookItem[] = LOOK_SETS.flatMap(([collection, items]) =>
  items.map(([name, description], i) => {
    const [slot, slug, rarity, price] = LOOK_SLOTS[i];
    return { id: `${collection}-${slug}`, slot, name, rarity, collection, description, price };
  }),
);
export interface ShopBundle {
  id: string;
  collection: Collection;
  name: string;
  items: string[];
  /** 20% off the full set (owned pieces are taken off the price). */
  discount: number;
}
export const SHOP_BUNDLES: ShopBundle[] = LOOK_SETS.map(([collection]) => ({
  id: `${collection}-set`,
  collection,
  name: `${COLLECTION_NAMES[collection]} set`,
  items: LOOK_ITEMS.filter((i) => i.collection === collection).map((i) => i.id),
  discount: 0.2,
}));

export const skinPrice = (s: ChampionSkin) => SKIN_PRICES[s.rarity];
export const CHAMPION_SKIN_BY_ID = Object.fromEntries(
  CHAMPION_SKINS.map((s) => [s.id, s]),
) as Record<string, ChampionSkin>;
export const LOOK_ITEM_BY_ID = Object.fromEntries(
  LOOK_ITEMS.map((i) => [i.id, i]),
) as Record<string, LookItem>;

/** Coins (all granted by the game server, never the browser). */
export const COINS = {
  /** Raid clear by Peril (index = Peril). */
  raidClear: [0, 30, 45, 60],
  dailyFirstClear: 50,
  pvpWin: 15,
  pvpLoss: 6,
  raidClearsPaidPerDay: 5,
  pvpMatchesPaidPerDay: 10,
  /** Shorter matches (mostly idle) pay nothing. */
  minActiveSeconds: 20,
  allMissionsBonus: 50,
  /** Every 7 days in a row with all three missions done. */
  streakBonus: 300,
  /** Today's Picks: one non-Mythical pick is this much off. */
  pickDiscount: 0.2,
} as const;

export type MissionTier = "easy" | "medium" | "hard";
export type MissionMetric =
  | "play"
  | "pvp-wins"
  | "skill-uses"
  | "ults"
  | "raid-clear"
  | "daily-clear"
  | "revives"
  | "raid-peril3"
  | "raid-flawless"
  | "feat"
  | "hard-bot-win"
  | "wins-with"
  | "teams-unharmed"
  // Added with migration 014.
  | "wins"
  | "bot-wins"
  | "minutes"
  | "raid-play"
  | "raid-solo"
  | "raid-solo-p2"
  | "raid-party"
  | "ffa-wins";
export interface Mission {
  id: string;
  tier: MissionTier;
  text: string;
  metric: MissionMetric;
  target: number;
  coins: number;
  /** wins-with: the champions that count. */
  champions?: CharacterId[];
  /**
   * Can be done alone (against bots or in a solo raid). Players who haven't
   * played anyone else this week are only given these.
   */
  solo: boolean;
}
export const MISSION_COINS: Record<MissionTier, number> = { easy: 40, medium: 70, hard: 120 };
const mission = (
  id: string,
  tier: MissionTier,
  text: string,
  metric: MissionMetric,
  target: number,
  champions?: CharacterId[],
): Mission => ({ id, tier, text, metric, target, coins: MISSION_COINS[tier], solo: true, ...(champions ? { champions } : {}) });
/** A mission that needs other people (a real match, a 2v2, a party raid). */
const together = (m: Mission): Mission => ({ ...m, solo: false });
export const MISSIONS: Mission[] = [
  // Easy
  mission("play-2", "easy", "Play 2 matches", "play", 2),
  mission("raid-1", "easy", "Clear any raid", "raid-clear", 1),
  mission("skills-30", "easy", "Use 30 skills", "skill-uses", 30),
  mission("ults-3", "easy", "Use your ultimate 3 times", "ults", 3),
  mission("win-1", "easy", "Win a match", "wins", 1),
  mission("raid-play-1", "easy", "Finish a raid, win or lose", "raid-play", 1),
  mission("minutes-10", "easy", "Play for 10 minutes", "minutes", 10),
  // Medium
  together(mission("pvp-wins-2", "medium", "Win 2 matches against players", "pvp-wins", 2)),
  mission("daily-1", "medium", "Clear today's Raid of the Day", "daily-clear", 1),
  together(mission("revives-3", "medium", "Help revive 3 allies in raids", "revives", 3)),
  mission("earth-water", "medium", "Win a match as Terradon or Tidefin", "wins-with", 1, ["terradon", "tidefin"]),
  mission("fire-light", "medium", "Win a match as Cindrake or Lumoth", "wins-with", 1, ["cindrake", "lumoth"]),
  mission("electric-aura", "medium", "Win a match as Voltkit or Auralynx", "wins-with", 1, ["voltkit", "auralynx"]),
  mission("psychic-shadow", "medium", "Win a match as Mystowl or Duskveil", "wins-with", 1, ["mystowl", "duskveil"]),
  mission("hard-bot", "medium", "Beat a Hard bot", "hard-bot-win", 1),
  mission("bot-wins-3", "medium", "Win 3 matches against bots", "bot-wins", 3),
  mission("raids-2", "medium", "Clear 2 raids", "raid-clear", 2),
  mission("raid-solo-1", "medium", "Clear a raid on your own", "raid-solo", 1),
  mission("ults-8", "medium", "Use your ultimate 8 times", "ults", 8),
  together(mission("raid-party", "medium", "Clear a raid with a friend", "raid-party", 1)),
  // Hard
  mission("raid-p3", "hard", "Clear any raid on Peril 3", "raid-peril3", 1),
  mission("raid-flawless", "hard", "Clear a raid with no downs", "raid-flawless", 1),
  together(mission("teams-unharmed", "hard", "Win a 2v2 without being knocked out", "teams-unharmed", 1)),
  mission("feat-1", "hard", "Complete a boss feat", "feat", 1),
  together(mission("pvp-wins-5", "hard", "Win 5 matches against players", "pvp-wins", 5)),
  mission("hard-bots-3", "hard", "Beat 3 Hard bots", "hard-bot-win", 3),
  mission("raids-3", "hard", "Clear 3 raids", "raid-clear", 3),
  mission("raid-solo-p2", "hard", "Clear a raid on your own on Peril 2 or higher", "raid-solo-p2", 1),
  mission("minutes-30", "hard", "Play for 30 minutes", "minutes", 30),
  together(mission("ffa-win", "hard", "Win a free-for-all", "ffa-wins", 1)),
];
export const MISSION_BY_ID: Record<string, Mission> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

/**
 * What the game server reports after a real match or raid (never the
 * browser). The database turns it into coins, mission progress, Mythic Trial
 * wins and Awakening progress, once per id.
 */
export interface ActivityPlayer {
  accountId: string;
  character: CharacterId;
  won: boolean;
  /** At least one other human, and no bots. */
  vsPeople: boolean;
  botLevel: string | null;
  mode: string;
  knockedOut: boolean;
  skillUses: number;
  ults: number;
  activeSeconds: number;
  /** Equipped champion skin (for Awakening). */
  skin?: string | null;
  raid?: {
    cleared: boolean;
    daily: boolean;
    peril: number;
    flawless: boolean;
    feat: boolean;
    revives: number;
  };
}
export interface ActivityReceipt {
  id: string;
  kind: "match" | "raid";
  /** Pacific calendar day (YYYY-MM-DD). */
  day: string;
  players: ActivityPlayer[];
}

/** A champion's look as the server sends it to everyone in the room. */
export interface ChampionLook {
  skin: string;
  /** Awakening stage shown (1–3; Mythicals only, otherwise 1). */
  stage: number;
}

/** The player's shop state (migration 010's arena_economy()). */
export interface Economy {
  balance: number;
  owned: string[];
  /** Today's Picks: item ids; `deal` is the one at a discount. */
  picks: { day: string; items: string[]; deal: string | null };
  /** Wins per champion that count for Mythic Trials. */
  trialWins: Partial<Record<CharacterId, number>>;
  /** Awakening progress per owned Mythical. */
  awakening: Record<string, { wins: number; peril3: boolean; stage: number }>;
  /** Equipped champion skins. */
  looks: Partial<Record<CharacterId, ChampionLook>>;
  missions: {
    day: string;
    slot: number;
    id: string;
    text: string;
    tier: MissionTier;
    progress: number;
    target: number;
    coins: number;
    done: boolean;
  }[];
  rerolled: boolean;
  streak: number;
  /** Coins earned today, by source (for the caps). */
  today: { raidClears: number; pvpMatches: number };
}

/**
 * What an item costs this player (mirrors arena_item_price in migration 010):
 * null once owned; a set costs 80% of the pieces not yet owned; today's deal
 * is 20% off. Prices round to the nearest 10.
 */
export function shopPrice(id: string, owned: readonly string[], deal: string | null) {
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const bundle = SHOP_BUNDLES.find((b) => b.id === id);
  if (bundle) {
    const left = bundle.items.filter((i) => !owned.includes(i));
    if (!left.length) return null;
    return round10(left.reduce((sum, i) => sum + LOOK_ITEM_BY_ID[i].price, 0) * (1 - bundle.discount));
  }
  if (owned.includes(id)) return null;
  const base = CHAMPION_SKIN_BY_ID[id] ? skinPrice(CHAMPION_SKIN_BY_ID[id]) : LOOK_ITEM_BY_ID[id]?.price;
  if (base === undefined) return null;
  return id === deal ? round10(base * (1 - COINS.pickDiscount)) : base;
}
/** The rarity of any shop item (sets have none). */
export function shopRarity(id: string): Rarity | null {
  return CHAMPION_SKIN_BY_ID[id]?.rarity ?? LOOK_ITEM_BY_ID[id]?.rarity ?? null;
}

/** A Mythical's Awakening stage from its progress. */
export function awakeningStage(wins: number, peril3: boolean) {
  if (wins >= AWAKENING.stage3Wins && peril3) return 3;
  return wins >= AWAKENING.stage2Wins ? 2 : 1;
}
