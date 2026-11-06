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
  | "void"
  | "cyber"
  | "candy"
  | "galaxy"
  | "retro";
export const COLLECTION_NAMES: Record<Collection, string> = {
  winter: "Winter",
  festival: "Festival",
  garden: "Garden",
  arcade: "Arcade",
  void: "Void Knight",
  cyber: "Cyber Mecha",
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

/** 8 per champion: 3 Common, 2 Rare, 2 Epic (one Cyber Mecha), 1 Mythical. */
export const CHAMPION_SKINS: ChampionSkin[] = [
  skin("voltkit", "midnight", "Midnight", "common", "Navy fur, cyan cheeks"),
  skin("voltkit", "peach-fizz", "Peach Fizz", "common", "Peach and pink"),
  skin("voltkit", "mint-static", "Mint Static", "common", "Mint and white"),
  skin(
    "voltkit",
    "snowcap",
    "Snowcap",
    "rare",
    "Frosty fur and earmuffs; dashing leaves snowflakes",
    "winter",
  ),
  skin(
    "voltkit",
    "kite-runner",
    "Kite Runner",
    "rare",
    "Paper-kite stripes and a trailing ribbon; dashing leaves confetti",
    "festival",
  ),
  skin(
    "voltkit",
    "neon-arcade",
    "Neon Arcade",
    "epic",
    "Synthwave grid fur, magenta skills, pixel hit sparks",
    "arcade",
  ),
  skin(
    "voltkit",
    "arc-unit",
    "Arc Unit",
    "epic",
    "Gold paint over chrome, a V-fin headset, an arc-core collar and a jetpack",
    "cyber",
  ),
  skin(
    "voltkit",
    "stormcrown",
    "Storm Revenant",
    "mythical",
    "Black steel crackling with violet lightning: a crown of bolts and a gorget for its goggles and kerchief",
    "void",
  ),

  skin("cindrake", "ashen", "Ashen", "common", "Charcoal body, ember crest"),
  skin("cindrake", "coral", "Coral", "common", "Coral pink and cream"),
  skin("cindrake", "lime-flame", "Lime Flame", "common", "A green flame crest"),
  skin(
    "cindrake",
    "chili-pepper",
    "Chili Pepper",
    "rare",
    "Glossy red with a green stem cap; dashing puffs spice",
    "garden",
  ),
  skin(
    "cindrake",
    "blue-flame",
    "Blue Flame",
    "rare",
    "A cool blue crest and white-hot skills",
    "winter",
  ),
  skin(
    "cindrake",
    "volcano-forge",
    "Volcano Forge",
    "epic",
    "Smith's goggles and molten metal; anvil-spark hits",
    "festival",
  ),
  skin(
    "cindrake",
    "reactor",
    "Reactor",
    "epic",
    "Red plating, a chrome crest fin for its flame and a reactor core",
    "cyber",
  ),
  skin(
    "cindrake",
    "sunforged",
    "Hellforge",
    "mythical",
    "Black-iron horns and a crest of black hellfire",
    "void",
  ),

  skin(
    "tidefin",
    "bubblegum",
    "Bubblegum",
    "common",
    "Classic pink with magenta gills",
  ),
  skin("tidefin", "abyss", "Abyss", "common", "Deep navy with teal gills"),
  skin("tidefin", "sandbar", "Sandbar", "common", "Sand and sea-green"),
  skin(
    "tidefin",
    "koi-pond",
    "Koi Pond",
    "rare",
    "Koi spots; dashing leaves lily pads",
    "garden",
  ),
  skin(
    "tidefin",
    "corsair",
    "Corsair",
    "rare",
    "A tricorn hat; splashes of gold coins",
    "festival",
  ),
  skin(
    "tidefin",
    "glacier",
    "Glacier",
    "epic",
    "A crystal-ice body; skills turn to ice and snow",
    "winter",
  ),
  skin(
    "tidefin",
    "hydro-frame",
    "Hydro Frame",
    "epic",
    "Teal hull plating, a crest fin headset and magenta thrusters",
    "cyber",
  ),
  skin(
    "tidefin",
    "moontide",
    "Abyssal Reaver",
    "mythical",
    "Deep-sea armour with a steel dorsal fin and tide-green runes",
    "void",
  ),

  skin(
    "auralynx",
    "snowshoe",
    "Snowshoe",
    "common",
    "White fur, ice-blue fists",
  ),
  skin("auralynx", "desert", "Desert", "common", "Tan fur, amber fists"),
  skin("auralynx", "twilight", "Twilight", "common", "Purple fur, rose fists"),
  skin(
    "auralynx",
    "cherry-blossom",
    "Cherry Blossom",
    "rare",
    "A blossom-pink robe; petals drift as it dashes",
    "garden",
  ),
  skin(
    "auralynx",
    "jade-temple",
    "Jade Temple",
    "rare",
    "Jade fists and red tassels",
    "festival",
  ),
  skin(
    "auralynx",
    "stained-glass",
    "Stained Glass",
    "epic",
    "Fists and robe of stained-glass panels; glass-shard hits",
    "arcade",
  ),
  skin(
    "auralynx",
    "prism-mech",
    "Prism Mech",
    "epic",
    "Periwinkle armour, a V-fin headset and a cyan prism core",
    "cyber",
  ),
  skin(
    "auralynx",
    "celestial-sage",
    "Spectral Warden",
    "mythical",
    "Night-blue plate and a crown of spectral blades over its gem",
    "void",
  ),

  skin("lumoth", "lunar", "Lunar", "common", "Silver-white fluff"),
  skin("lumoth", "peachy", "Peachy", "common", "Peach and cream"),
  skin("lumoth", "dusk", "Dusk", "common", "Lilac and navy"),
  skin(
    "lumoth",
    "rosy-maple",
    "Rosy Maple",
    "rare",
    "Pink and buttery yellow; soft dust puffs",
    "garden",
  ),
  skin(
    "lumoth",
    "paper-lantern",
    "Paper Lantern",
    "rare",
    "Wings like warm paper lanterns",
    "festival",
  ),
  skin(
    "lumoth",
    "aurora",
    "Aurora",
    "epic",
    "Wings that ripple through northern-lights colors",
    "winter",
  ),
  skin(
    "lumoth",
    "photon",
    "Photon",
    "epic",
    "Mint plating, twin antennae with yellow lights and a jetpack",
    "cyber",
  ),
  skin(
    "lumoth",
    "starweaver",
    "Fallen Lightbringer",
    "mythical",
    "Tarnished armour, a crown of blades between its antennae and a gold rune glow",
    "void",
  ),

  skin("mystowl", "snowy", "Snowy", "common", "White feathers, gold eyes"),
  skin("mystowl", "barn", "Barn", "common", "Tan with a heart-shaped face"),
  skin("mystowl", "midnight", "Midnight", "common", "Dark blue, silver eyes"),
  skin(
    "mystowl",
    "scholar",
    "Scholar",
    "rare",
    "A tiny graduation cap; pages flutter as it dashes",
    "festival",
  ),
  skin(
    "mystowl",
    "witchs-familiar",
    "Witch's Familiar",
    "rare",
    "A pointed hat and potion bubbles",
    "garden",
  ),
  skin(
    "mystowl",
    "clockwork",
    "Clockwork",
    "epic",
    "Brass gears and a golden clock-hand Third-Eye Ray",
    "arcade",
  ),
  skin(
    "mystowl",
    "psi-core",
    "Psi Core",
    "epic",
    "Pink plating, sensor antennae and a cyan psi core",
    "cyber",
  ),
  skin(
    "mystowl",
    "oracle",
    "Void Inquisitor",
    "mythical",
    "Dark plate, a crown of blades and a third eye that never closes",
    "void",
  ),

  skin("terradon", "mossy", "Mossy", "common", "Moss on the shell"),
  skin(
    "terradon",
    "sandstone",
    "Sandstone",
    "common",
    "Red-orange layered stone",
  ),
  skin("terradon", "granite", "Granite", "common", "Speckled grey"),
  skin(
    "terradon",
    "bonsai",
    "Bonsai",
    "rare",
    "A tiny bonsai tree on its head; leaves drop as it dashes",
    "garden",
  ),
  skin(
    "terradon",
    "snowball",
    "Snowball",
    "rare",
    "A snowy shell and a knitted scarf",
    "winter",
  ),
  skin(
    "terradon",
    "geode",
    "Geode",
    "epic",
    "Cracks of glowing amethyst; crystal Tremor",
    "arcade",
  ),
  skin(
    "terradon",
    "tank-mk2",
    "Tank Mk II",
    "epic",
    "Olive armour plate, a radar dish for its sprout and orange lights",
    "cyber",
  ),
  skin(
    "terradon",
    "world-shell",
    "Obsidian Bulwark",
    "mythical",
    "Ram horns, obsidian crystals for a sprout and a spiked shell",
    "void",
  ),

  skin("duskveil", "ember", "Ember", "common", "Orange flame, charcoal hood"),
  skin(
    "duskveil",
    "ghost-white",
    "Ghost White",
    "common",
    "A pale hood and blue flame",
  ),
  skin(
    "duskveil",
    "teal-spirit",
    "Teal Spirit",
    "common",
    "Teal flame, navy hood",
  ),
  skin(
    "duskveil",
    "pumpkin-lantern",
    "Pumpkin Lantern",
    "rare",
    "A carved-pumpkin glow; autumn leaves on dash",
    "festival",
  ),
  skin(
    "duskveil",
    "paper-lantern",
    "Paper Lantern",
    "rare",
    "A red paper-lantern glow and tassels",
    "festival",
  ),
  skin(
    "duskveil",
    "candlelight",
    "Candlelight",
    "epic",
    "A melting-candle hood; candle-flame Ghostfire",
    "garden",
  ),
  skin(
    "duskveil",
    "phantom-os",
    "Phantom OS",
    "epic",
    "Violet plating, antennae on the hood and a green core",
    "cyber",
  ),
  skin(
    "duskveil",
    "eclipse",
    "Crimson Sovereign",
    "mythical",
    "A horned black hood, crimson eyes and a rune gorget",
    "void",
  ),

  // The eight newest champions.
  skin(
    "coilemur",
    "sifaka",
    "Sifaka",
    "common",
    "Snow-white fur, chocolate mask",
  ),
  skin(
    "coilemur",
    "copper-wire",
    "Copper Wire",
    "common",
    "Copper fur, teal sparks",
  ),
  skin(
    "coilemur",
    "blackout",
    "Blackout",
    "common",
    "Charcoal fur, lime sparks",
  ),
  skin(
    "coilemur",
    "firecracker",
    "Firecracker",
    "rare",
    "Lucky red with a gold-banded tail; dashing pops confetti",
    "festival",
  ),
  skin(
    "coilemur",
    "frost-fuse",
    "Frost Fuse",
    "rare",
    "Icy fur and a bobble hat; dashing leaves snowflakes",
    "winter",
  ),
  skin(
    "coilemur",
    "tesla-coil",
    "Tesla Coil",
    "epic",
    "Gunmetal fur with glowing circuits, teal skills and a crackling pulse",
    "arcade",
  ),
  skin(
    "coilemur",
    "tesla-frame",
    "Tesla Frame",
    "epic",
    "Brushed steel, coil antennae and yellow tesla lights",
    "cyber",
  ),
  skin(
    "coilemur",
    "cometcaller",
    "Volt Executioner",
    "mythical",
    "Gunmetal plate, cyan-striped limbs and a crown of bolts",
    "void",
  ),

  skin("pyranda", "snowy", "Snowy", "common", "White fur, smoky markings"),
  skin("pyranda", "cinnamon", "Cinnamon", "common", "Cinnamon brown and cream"),
  skin("pyranda", "plum", "Plum", "common", "Plum fur, peach face"),
  skin(
    "pyranda",
    "chestnut-grove",
    "Chestnut Grove",
    "rare",
    "Chestnut brown with an acorn cap; dashing drops leaves",
    "garden",
  ),
  skin(
    "pyranda",
    "street-vendor",
    "Street Vendor",
    "rare",
    "A folded paper hat and a striped coat; dashing puffs spice",
    "festival",
  ),
  skin(
    "pyranda",
    "fireside-knit",
    "Fireside Knit",
    "epic",
    "A cable-knit sweater, cocoa-gold skills and a flickering ember",
    "winter",
  ),
  skin(
    "pyranda",
    "afterburner",
    "Afterburner",
    "epic",
    "Rust-orange plating, a V-fin and cyan afterburners",
    "cyber",
  ),
  skin(
    "pyranda",
    "harvest-moon",
    "Ashen Warlord",
    "mythical",
    "Ash-grey markings, ember runes and a crown of black flame",
    "void",
  ),

  skin("glacelle", "deep-sea", "Deep Sea", "common", "Navy body, cyan glow"),
  skin("glacelle", "lilac-tide", "Lilac Tide", "common", "Lilac and pink"),
  skin("glacelle", "seafoam", "Seafoam", "common", "Mint and white"),
  skin(
    "glacelle",
    "water-lily",
    "Water Lily",
    "rare",
    "Petal pink with a lotus bloom; dashing scatters petals",
    "garden",
  ),
  skin(
    "glacelle",
    "snow-globe",
    "Snow Globe",
    "rare",
    "Snow drifting inside a glassy body; dashing leaves snowflakes",
    "winter",
  ),
  skin(
    "glacelle",
    "deep-glow",
    "Deep Glow",
    "epic",
    "An abyssal body with neon spots and magenta skills",
    "arcade",
  ),
  skin(
    "glacelle",
    "cryo-unit",
    "Cryo Unit",
    "epic",
    "Ice-white plating, a V-fin and pink cryo lights",
    "cyber",
  ),
  skin(
    "glacelle",
    "polaris",
    "Rimebane",
    "mythical",
    "A crown of black ice and frost-bright runes",
    "void",
  ),

  skin(
    "halcyra",
    "teal-wing",
    "Teal Wing",
    "common",
    "Teal feathers, buff chest",
  ),
  skin("halcyra", "pied", "Pied", "common", "Black and white feathers"),
  skin("halcyra", "sunset", "Sunset", "common", "Coral and gold"),
  skin(
    "halcyra",
    "fletcher",
    "Fletcher",
    "rare",
    "A feathered archer's cap and striped wings; dashing leaves gold dust",
    "festival",
  ),
  skin(
    "halcyra",
    "winter-plume",
    "Winter Plume",
    "rare",
    "Frost-white feathers and earmuffs; dashing leaves snowflakes",
    "winter",
  ),
  skin(
    "halcyra",
    "paper-crane",
    "Paper Crane",
    "epic",
    "Folded-paper feathers, crimson skills and a glinting crest",
    "festival",
  ),
  skin(
    "halcyra",
    "sniper-drone",
    "Sniper Drone",
    "epic",
    "Cobalt plating, a radar dish and orange thrusters",
    "cyber",
  ),
  skin(
    "halcyra",
    "starfletch",
    "Nightfeather",
    "mythical",
    "Midnight plumage, a crown of blades and a rune-lit monocle",
    "void",
  ),

  skin("sunbara", "cocoa", "Cocoa", "common", "Dark cocoa fur"),
  skin("sunbara", "milk-tea", "Milk Tea", "common", "Milky beige and caramel"),
  skin("sunbara", "rose-quartz", "Rose Quartz", "common", "Soft rose pink"),
  skin(
    "sunbara",
    "bathhouse",
    "Bathhouse",
    "rare",
    "A folded towel and steamy stripes; dashing blows bubbles",
    "festival",
  ),
  skin(
    "sunbara",
    "snow-day",
    "Snow Day",
    "rare",
    "Snow-dusted fur and a knitted scarf; dashing leaves snowflakes",
    "winter",
  ),
  skin(
    "sunbara",
    "sunflower",
    "Sunflower",
    "epic",
    "A sunflower bloom, golden skills and a glint",
    "garden",
  ),
  skin(
    "sunbara",
    "solar-mech",
    "Solar Mech",
    "epic",
    "Tan plating, a radar dish for its yuzu and a teal solar core",
    "cyber",
  ),
  skin(
    "sunbara",
    "daybreak",
    "Eclipse Templar",
    "mythical",
    "A black sun with a blade corona where the yuzu sat",
    "void",
  ),

  skin(
    "astrabun",
    "nightfall",
    "Nightfall",
    "common",
    "Navy fur, pale gold glow",
  ),
  skin(
    "astrabun",
    "sakura-mochi",
    "Sakura Mochi",
    "common",
    "Cherry pink and white",
  ),
  skin("astrabun", "matcha", "Matcha", "common", "Matcha green and cream"),
  skin(
    "astrabun",
    "mochi-maker",
    "Mochi Maker",
    "rare",
    "A twisted headband for pounding mochi; dashing throws confetti",
    "festival",
  ),
  skin(
    "astrabun",
    "clover",
    "Clover",
    "rare",
    "Clover-green spots and a flower crown; dashing drops leaves",
    "garden",
  ),
  skin(
    "astrabun",
    "space-cadet",
    "Space Cadet",
    "epic",
    "A starry suit with an antenna, cyan skills and a glint",
    "arcade",
  ),
  skin(
    "astrabun",
    "warp-unit",
    "Warp Unit",
    "epic",
    "Lilac plating, a V-fin between its ears and pink warp jets",
    "cyber",
  ),
  skin(
    "astrabun",
    "full-moon",
    "Rift Duelist",
    "mythical",
    "Violet runes, a rift gem and a crown of blades between its ears",
    "void",
  ),

  skin("wombolder", "sandy", "Sandy", "common", "Pale sand fur"),
  skin("wombolder", "coal", "Coal", "common", "Coal-grey fur, green glow"),
  skin("wombolder", "ochre", "Ochre", "common", "Ochre and rust"),
  skin(
    "wombolder",
    "mushroom-hollow",
    "Mushroom Hollow",
    "rare",
    "A spotted toadstool cap; dashing drops leaves",
    "garden",
  ),
  skin(
    "wombolder",
    "snowplough",
    "Snowplough",
    "rare",
    "Frosted fur and a bobble hat; dashing kicks up snow",
    "winter",
  ),
  skin(
    "wombolder",
    "gold-rush",
    "Gold Rush",
    "epic",
    "A miner's lamp helmet, gold-veined fur and gold skills",
    "arcade",
  ),
  skin(
    "wombolder",
    "bulldozer",
    "Bulldozer",
    "epic",
    "Brown work plating, a crest fin for its stone and lime lights",
    "cyber",
  ),
  skin(
    "wombolder",
    "saturnine",
    "Iron Juggernaut",
    "mythical",
    "A riveted iron helm with horns and acid-green runes",
    "void",
  ),

  skin(
    "shadopus",
    "coral-reef",
    "Coral Reef",
    "common",
    "Coral orange and cream",
  ),
  skin("shadopus", "deep-blue", "Deep Blue", "common", "Deep blue and teal"),
  skin("shadopus", "mimic", "Mimic", "common", "Sand and brown"),
  skin(
    "shadopus",
    "masquerade",
    "Masquerade",
    "rare",
    "A jewelled masquerade mask; dashing throws confetti",
    "festival",
  ),
  skin(
    "shadopus",
    "tide-pool",
    "Tide Pool",
    "rare",
    "Rock-pool speckles and a starfish clip; dashing blows bubbles",
    "garden",
  ),
  skin(
    "shadopus",
    "anglerlight",
    "Anglerlight",
    "epic",
    "A glowing lure on a stalk, abyss-teal skills and a flicker",
    "garden",
  ),
  skin(
    "shadopus",
    "stealth-mk",
    "Stealth Mk",
    "epic",
    "Indigo stealth plating, antennae and red sensor lights",
    "cyber",
  ),
  skin(
    "shadopus",
    "nebula",
    "Abyss Stalker",
    "mythical",
    "Black chitin, a crown of blades and magenta runes",
    "void",
  ),

  skin("pangrove", "autumn", "Autumn", "common", "Russet and gold leaf scales"),
  skin(
    "pangrove",
    "frostleaf",
    "Frostleaf",
    "common",
    "Frosted silver-blue leaves",
  ),
  skin("pangrove", "jade", "Jade", "common", "Deep jade with a gold glow"),
  skin(
    "pangrove",
    "blossom",
    "Blossom",
    "rare",
    "Cherry-blossom scales and a flower crown; dashing scatters petals",
    "garden",
  ),
  skin(
    "pangrove",
    "lantern-night",
    "Lantern Night",
    "rare",
    "Festival-red scales and lantern tassels; dashing throws confetti",
    "festival",
  ),
  skin(
    "pangrove",
    "golden-sap",
    "Golden Sap",
    "epic",
    "Amber scales veined with sap, a golden stem, golden skills and a glint",
    "garden",
  ),
  skin(
    "pangrove",
    "scaleroller",
    "Scale Roller",
    "epic",
    "Plated green scales, a V-fin headset and lime thrusters",
    "cyber",
  ),
  skin(
    "pangrove",
    "evergrove",
    "Thorn Warden",
    "mythical",
    "Black thorn-plate, a crown of blades and lime runes",
    "void",
  ),

  skin("mossloth", "cinnamon", "Cinnamon", "common", "Warm cinnamon fur"),
  skin("mossloth", "snowy", "Snowy", "common", "Snow-white fur, pale moss"),
  skin("mossloth", "dusk", "Dusk", "common", "Lilac-grey fur, violet moss"),
  skin(
    "mossloth",
    "acorn-nap",
    "Acorn Nap",
    "rare",
    "An acorn cap for napping; dashing drops leaves",
    "garden",
  ),
  skin(
    "mossloth",
    "cozy-knit",
    "Cozy Knit",
    "rare",
    "A knitted scarf over frosty fur; dashing leaves snowflakes",
    "winter",
  ),
  skin(
    "mossloth",
    "bonsai-keeper",
    "Bonsai Keeper",
    "epic",
    "A little bonsai on its head, blossom skills and a shimmer",
    "garden",
  ),
  skin(
    "mossloth",
    "treehugger",
    "Treehugger Mk",
    "epic",
    "Khaki armour, a headset with ear pods and a mint core",
    "cyber",
  ),
  skin(
    "mossloth",
    "moonbloom",
    "Blight Sentinel",
    "mythical",
    "Rotwood armour, ram horns, crystal crest and mint runes",
    "void",
  ),
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
  [
    "candy",
    [
      ["Candy colors", "Pastel swirls"],
      ["Sprinkle aura", "A ring of rainbow sprinkles"],
      ["Gift-box entrance", "Pop out of a gift box"],
      ["Cookie frame", "A frosted-cookie border"],
      ["Cake victory", "A confetti cake bursts behind you"],
    ],
  ],
  [
    "galaxy",
    [
      ["Galaxy colors", "A deep-space tint"],
      ["Nebula aura", "A slow, glowing nebula ring"],
      ["Star-tunnel entrance", "Warp in through a tunnel of stars"],
      ["Planet-ring frame", "A border with a ringed planet"],
      ["Supernova victory", "A supernova blooms behind you"],
    ],
  ],
  [
    "retro",
    [
      ["Retro colors", "An 8-bit palette"],
      ["Pixel-heart aura", "A ring of pixel hearts"],
      ["Player One entrance", "A blocky pixel spawn"],
      ["Cartridge frame", "A game-cartridge border"],
      ["Level Up victory", "LEVEL UP! in big pixels"],
    ],
  ],
  [
    "festival",
    [
      ["Festival colors", "Lantern red and gold"],
      ["Lantern aura", "Floating paper lanterns"],
      ["Firecracker entrance", "Arrive with a firecracker pop"],
      ["Tassel frame", "A knot-and-tassel border"],
      ["Fireworks victory", "A fireworks finale"],
    ],
  ],
  [
    "garden",
    [
      ["Spring colors", "Fresh spring greens"],
      ["Petal aura", "A ring of drifting petals"],
      ["Bloom entrance", "Bloom out of a flower"],
      ["Vine frame", "A leafy vine border"],
      ["Flower-shower victory", "Flowers rain down around you"],
    ],
  ],
  [
    "winter",
    [
      ["Frost colors", "A frosty tint"],
      ["Snowflake aura", "A ring of snowflakes"],
      ["Flurry entrance", "Arrive in a snow flurry"],
      ["Icicle frame", "An icicle border"],
      ["Snow-globe victory", "A snow globe shakes around you"],
    ],
  ],
];
/**
 * Collection tiers (migration 031): Candy, Garden and Retro are the standard
 * sets; Winter and Festival are premium (Epic pieces, about 1.6× the price);
 * Galaxy is the showcase set (Mythical pieces, 2.5×). Colours stay one step
 * below the set's other pieces. Pricier, rarer pieces get grander effects.
 */
export const COLLECTION_TIER: Record<Collection, 0 | 1 | 2> = {
  candy: 0,
  garden: 0,
  retro: 0,
  arcade: 0,
  void: 0,
  cyber: 0,
  winter: 1,
  festival: 1,
  galaxy: 2,
};
const TIER_PRICE = [1, 1.6, 2.5] as const;
const lookRarity = (base: Rarity, slug: string, tier: 0 | 1 | 2): Rarity => {
  if (tier === 0) return base;
  if (tier === 1) return slug === "colours" ? "rare" : "epic";
  return slug === "colours" ? "epic" : "mythical";
};
export const LOOK_ITEMS: LookItem[] = LOOK_SETS.flatMap(([collection, items]) =>
  items.map(([name, description], i) => {
    const [slot, slug, rarity, price] = LOOK_SLOTS[i];
    const tier = COLLECTION_TIER[collection] ?? 0;
    return {
      id: `${collection}-${slug}`,
      slot,
      name,
      rarity: lookRarity(rarity, slug, tier),
      collection,
      description,
      price: Math.round((price * TIER_PRICE[tier]) / 10) * 10,
    };
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

/** Daily slots: two missions per tier; the database owns assignment and rewards. */
export const DAILY_MISSION_COUNT = 6;

/** Coins (all granted by the game server, never the browser). */
export const COINS = {
  /** Raid clear by Peril (index = Peril; raids are always Peril 3 now). */
  raidClear: [0, 30, 45, 60],
  dailyFirstClear: 50,
  pvpWin: 15,
  pvpLoss: 6,
  raidClearsPaidPerDay: 5,
  pvpMatchesPaidPerDay: 10,
  /** Shorter matches (mostly idle) pay nothing. */
  minActiveSeconds: 20,
  allMissionsBonus: 50,
  /** Every 7 days in a row with all six missions done. */
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
export const MISSION_COINS: Record<MissionTier, number> = {
  easy: 40,
  medium: 70,
  hard: 120,
};
const mission = (
  id: string,
  tier: MissionTier,
  text: string,
  metric: MissionMetric,
  target: number,
  champions?: CharacterId[],
): Mission => ({
  id,
  tier,
  text,
  metric,
  target,
  coins: MISSION_COINS[tier],
  solo: true,
  ...(champions ? { champions } : {}),
});
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
  together(
    mission(
      "pvp-wins-2",
      "medium",
      "Win 2 matches against players",
      "pvp-wins",
      2,
    ),
  ),
  mission(
    "daily-1",
    "medium",
    "Clear a raid as Voltkit or Auralynx",
    "raid-clear",
    1,
    ["voltkit", "auralynx"],
  ),
  together(
    mission(
      "revives-3",
      "medium",
      "Help revive 3 allies in raids",
      "revives",
      3,
    ),
  ),
  mission(
    "earth-water",
    "medium",
    "Win a match as Terradon or Tidefin",
    "wins-with",
    1,
    ["terradon", "tidefin"],
  ),
  mission(
    "fire-light",
    "medium",
    "Win a match as Cindrake or Lumoth",
    "wins-with",
    1,
    ["cindrake", "lumoth"],
  ),
  mission(
    "electric-aura",
    "medium",
    "Win a match as Voltkit or Auralynx",
    "wins-with",
    1,
    ["voltkit", "auralynx"],
  ),
  mission(
    "psychic-shadow",
    "medium",
    "Win a match as Mystowl or Duskveil",
    "wins-with",
    1,
    ["mystowl", "duskveil"],
  ),
  mission("hard-bot", "medium", "Beat a Hard bot", "hard-bot-win", 1),
  mission("bot-wins-3", "medium", "Win 3 matches against bots", "bot-wins", 3),
  mission("raids-2", "medium", "Clear 2 raids", "raid-clear", 2),
  mission("raid-solo-1", "medium", "Clear a raid on your own", "raid-solo", 1),
  mission("ults-8", "medium", "Use your ultimate 8 times", "ults", 8),
  together(
    mission(
      "raid-party",
      "medium",
      "Clear a raid with a friend",
      "raid-party",
      1,
    ),
  ),
  // Hard
  // Migration 030 retargets these two: raids have one difficulty now.
  mission("raid-p3", "hard", "Clear 2 raids on your own", "raid-solo", 2),
  mission(
    "raid-flawless",
    "hard",
    "Clear a raid with no downs",
    "raid-flawless",
    1,
  ),
  together(
    mission(
      "teams-unharmed",
      "hard",
      "Win a 2v2 without being knocked out",
      "teams-unharmed",
      1,
    ),
  ),
  mission("feat-1", "hard", "Complete a boss feat", "feat", 1),
  together(
    mission(
      "pvp-wins-5",
      "hard",
      "Win 5 matches against players",
      "pvp-wins",
      5,
    ),
  ),
  mission("hard-bots-3", "hard", "Beat 3 Hard bots", "hard-bot-win", 3),
  mission("raids-3", "hard", "Clear 3 raids", "raid-clear", 3),
  mission(
    "raid-solo-p2",
    "hard",
    "Clear 2 raids with no downs",
    "raid-flawless",
    2,
  ),
  mission("minutes-30", "hard", "Play for 30 minutes", "minutes", 30),
  together(mission("ffa-win", "hard", "Win a free-for-all", "ffa-wins", 1)),
];
export const MISSION_BY_ID: Record<string, Mission> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
);

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
  participated?: boolean;
  abandoned?: boolean;
  arcade?: string;
  expedition?: { completed: number };
  /** Equipped champion skin (for Awakening). */
  skin?: string | null;
  raid?: {
    cleared: boolean;
    daily: boolean;
    peril: number;
    flawless: boolean;
    feat: boolean;
    revives: number;
    phaseReached?: number;
  };
}
export interface ActivityReceipt {
  id: string;
  kind: "match" | "raid" | "expedition";
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
  journey?: import("./journey.js").Journey;
  balance: number;
  /** Database-verified administrator: purchases do not spend coins. */
  unlimitedCoins?: boolean;
  /** Database-verified admin access to Mythic Trials and all Awakening stages. */
  mythicTesting?: boolean;
  owned: string[];
  /**
   * Shop Colors bought for single champions (migration 072): item id → the
   * champions it was bought for. Colors in `owned` (from a collection set)
   * are for every champion.
   */
  colourUnlocks?: Record<string, CharacterId[]>;
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
  /** Legacy flag retained for older clients. */
  rerolled: boolean;
  /** Daily change count and allowance, supplied by migration 023. */
  rerollsUsed?: number;
  rerollLimit?: number;
  streak: number;
  /** Coins earned today, by source (for the caps). */
  today: { raidClears: number; pvpMatches: number };
  /** Gold Leaves (migration 036): balance and today's trade for coins. */
  leaves?: {
    balance: number;
    tradedToday: number;
    tradeCap: number;
    tradeLeaves: number;
    tradeCoins: number;
  };
}

/**
 * What an item costs this player (mirrors arena_item_price in migration 010):
 * null once owned; a set costs 80% of the pieces not yet owned; today's deal
 * is 20% off. Prices round to the nearest 10.
 */
export function shopPrice(
  id: string,
  owned: readonly string[],
  deal: string | null,
) {
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const bundle = SHOP_BUNDLES.find((b) => b.id === id);
  if (bundle) {
    const left = bundle.items.filter((i) => !owned.includes(i));
    if (!left.length) return null;
    return round10(
      left.reduce((sum, i) => sum + LOOK_ITEM_BY_ID[i].price, 0) *
        (1 - bundle.discount),
    );
  }
  if (owned.includes(id)) return null;
  const base = CHAMPION_SKIN_BY_ID[id]
    ? skinPrice(CHAMPION_SKIN_BY_ID[id])
    : LOOK_ITEM_BY_ID[id]?.price;
  if (base === undefined) return null;
  return id === deal ? round10(base * (1 - COINS.pickDiscount)) : base;
}
/**
 * Shop Colors are bought for one champion (the one you're dressing), not for
 * every fighter; a collection set still gives its Colors to every fighter.
 * Journey and raid Colors are never sold, so they stay all-fighter.
 */
export const isChampionColours = (id: string) =>
  LOOK_ITEM_BY_ID[id]?.slot === "skin";
/** What this champion can wear: everything owned, plus Colors bought for it. */
export function ownedOn(
  e: Pick<Economy, "owned" | "colourUnlocks">,
  champion: CharacterId,
): string[] {
  const extra = Object.entries(e.colourUnlocks ?? {})
    .filter(
      ([id, champions]) =>
        champions.includes(champion) && !e.owned.includes(id),
    )
    .map(([id]) => id);
  return extra.length ? [...e.owned, ...extra] : e.owned;
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
