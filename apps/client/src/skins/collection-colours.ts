import type { CharacterId } from "@arena/shared";
import type { Tint } from "./fashion-art";

/**
 * Body colours for the themed collections (Hồn Việt, Stars & Stripes, Hero
 * Squad, Neon Campus, Starlight Idol), chosen per champion for the figure it plays (a gold
 * Kim Quy, a candy-red hot-rod racer, a magnet-red Magnetail, a velvet-red
 * drama lead...). Each moves the champion's
 * own colours toward a hue while keeping their lightness, so faces, eyes and
 * markings read the same (see `tintPalette` in fashion-art.ts).
 */
const T = (hue: number, sat: number, lift = 0, mix = 0.85): Tint => ({
  hue,
  mix,
  sat,
  lift: [0.02 + lift, -0.04 + lift, -0.06 + lift],
});

export const VIET_TINTS: Record<CharacterId, Tint> = {
  voltkit: T(32, 0.7), // Đèn Ông Sao: lantern-glow amber
  cindrake: T(35, 0.35, -0.06), // Thánh Gióng: iron-bronze
  tidefin: T(338, 0.55, 0.04), // Hoa Đăng: lotus pink
  auralynx: T(40, 0.22, 0.1), // Vovinam: unbleached cotton
  lumoth: T(20, 0.65), // Hội An lantern: warm amber
  mystowl: T(140, 0.35), // Quan họ: jade
  terradon: T(45, 0.7), // Kim Quy: gold
  duskveil: T(232, 0.42, -0.04), // Đèn kéo quân: night indigo
  coilemur: T(25, 0.35, -0.12), // Đàn bầu: lacquered wood
  pyranda: T(40, 0.5, -0.06), // Hạt dẻ: roast chestnut
  glacelle: T(165, 0.35, -0.12), // Sa Pa: mountain mist
  halcyra: T(25, 0.5, -0.12), // Chim Lạc: drum bronze
  sunbara: T(350, 0.5, 0.06), // Tết: peach blossom (hoa đào)
  astrabun: T(145, 0.35, 0.06), // Thỏ Ngọc: pale jade
  wombolder: T(45, 0.65, 0.06), // Lúa chín: ripe rice gold
  shadopus: T(40, 0.2, 0.1), // Hát bội: painted-face ivory
  pangrove: T(185, 0.42), // Đầm sen: deep pond teal
  mossloth: T(230, 0.2), // Ông đồ: ink-wash grey
};

export const STARS_TINTS: Record<CharacterId, Tint> = {
  voltkit: T(225, 0.35, 0.06), // Space Ranger: spacesuit periwinkle
  cindrake: T(350, 0.65), // Hot-Rod Racer: candy red
  tidefin: T(5, 0.65, 0.06), // Malibu Surfer: sunset coral
  auralynx: T(290, 0.5, -0.06), // Jazz Cat: smoky orchid
  lumoth: T(165, 0.35, 0.06), // Neon Diner: diner mint
  mystowl: T(160, 0.95), // Lady Liberty: copper patina
  terradon: T(10, 0.5), // Sheriff: red-rock canyon
  duskveil: T(0, 0.02, 0, 0.92), // Film Noir: black and white
  coilemur: T(40, 0.8), // Rodeo Rider: palomino gold
  pyranda: T(215, 0.6, 0.02), // Ace Pitcher: team blue
  glacelle: T(245, 0.5, -0.18), // Aurora Alaska: icy violet
  halcyra: T(345, 0.55, -0.12), // Barnstormer: bomber-jacket burgundy
  sunbara: T(222, 0.55), // Fourth of July: flag navy
  astrabun: T(0, 0.2, -0.12, 0.92), // Stage Magician: velvet-rope rose
  wombolder: T(0, 0.55), // Linebacker: team red
  shadopus: T(310, 0.6), // Times Square DJ: neon magenta
  pangrove: T(40, 0.35, 0.06), // Park Ranger: ranger khaki
  mossloth: T(285, 0.45), // Woodstock Folk: tie-dye violet
};

/**
 * Sun Dynasty (Legendary): the court of a desert kingdom, each figure in a
 * colour of its own trade (faience turquoise, saffron, papyrus, red
 * granite...), every one at least 26 ΔE from the champion's other bodies.
 */
export const SUN_TINTS: Record<CharacterId, Tint> = {
  voltkit: T(175, 0.7, -0.06), // Storm Charioteer: faience turquoise
  cindrake: T(40, 0.85), // Phoenix Prince: phoenix gold
  tidefin: T(225, 0.8, -0.06), // River Pilot: river lapis
  auralynx: T(48, 0.45, 0.02), // Temple Cat: temple sand
  lumoth: T(210, 0.65, -0.06), // Lamp Keeper: dusk blue
  mystowl: T(245, 0.7, -0.18), // Royal Astronomer: night indigo
  terradon: T(24, 0.3, -0.12), // Obelisk Builder: sun-baked brick
  duskveil: T(265, 0.45, 0.12), // Moon Vizier: moonlit lavender
  coilemur: T(22, 0.7, -0.12), // Dune Caravaneer: dune copper
  pyranda: T(45, 0.85), // Spice Healer: saffron
  glacelle: T(332, 0.6, -0.08), // Mirage Dancer: mirage orchid
  halcyra: T(195, 0.35, -0.06), // Falcon Herald: falcon sky
  sunbara: T(359, 0.75, -0.12), // Sun Sovereign: royal carnelian
  astrabun: T(170, 0.6, -0.16), // Lotus Sceptre: blue lotus
  wombolder: T(0, 0.3, -0.06), // Sphinx Guardian: red granite
  shadopus: T(45, 0.7, 0.06), // Royal Scribe: papyrus
  pangrove: T(110, 0.7, -0.04), // Oasis Keeper: palm green
  mossloth: T(350, 0.55), // Shade Bearer: desert rose
};

export const HERO_TINTS: Record<CharacterId, Tint> = {
  voltkit: T(275, 0.6, 0.04), // Volt Streak: electric violet
  cindrake: T(12, 0.25, -0.14), // Blaze Breaker: charcoal ember
  tidefin: T(225, 0.55, -0.04), // Tide Guardian: deep-sea blue
  auralynx: T(320, 0.45, 0.06), // Prism Fist: prism pink
  lumoth: T(50, 0.95, -0.06), // Lumina: radiant yellow
  mystowl: T(175, 0.55), // Third Eye: psychic teal
  terradon: T(200, 0.5, -0.06), // Iron Bulwark: gunmetal
  duskveil: T(345, 0.45, -0.12), // Duskwatch: dusk wine
  coilemur: T(0, 0.7), // Magnetail: magnet red
  pyranda: T(205, 0.45, 0.04), // Chestnut Comet: comet ice blue
  glacelle: T(220, 0.5, -0.06, 0.95), // Frost Sentinel: frost silver
  halcyra: T(38, 0.6), // Skysight: eagle gold
  sunbara: T(15, 0.95), // Solar Flare: flare orange-red
  astrabun: T(205, 0.35, -0.25), // Moon Blink: moonlight blue
  wombolder: T(70, 0.4, -0.06), // Bulldozer: army olive
  shadopus: T(235, 0.3, -0.22), // Inkshade: ink black
  pangrove: T(65, 0.5, 0.06), // Leaf Ranger: spring lime
  mossloth: T(28, 0.5, -0.06), // Chrono Keeper: clockwork bronze
};

export const CAMPUS_TINTS: Record<CharacterId, Tint> = {
  voltkit: T(315, 0.6, 0.04), // Game Club Ace: neon pink
  cindrake: T(170, 0.5), // Lab Prodigy: chemical teal
  tidefin: T(10, 0.6, 0.04), // Swim Team Star: sunscreen coral
  auralynx: T(220, 0.5, -0.25), // Council President: blazer navy
  lumoth: T(15, 0.2, 0.06), // Photo Club Snap: flash white
  mystowl: T(285, 0.2, -0.06), // Library Prefect: late-night plum
  terradon: T(25, 0.75), // Team Captain: basketball orange
  duskveil: T(145, 0.5, -0.18), // Drama Club Lead: emerald stage velvet
  coilemur: T(205, 0.35, -0.18), // Robotics Whiz: steel blue
  pyranda: T(345, 0.5, 0.08), // Bake Club Chef: strawberry frosting
  glacelle: T(265, 0.35, -0.12), // Choir Soloist: hymn lavender
  halcyra: T(110, 0.45, -0.02), // Archery Ace: archer green
  sunbara: T(55, 0.75, 0.06), // Art Club Painter: paint yellow
  astrabun: T(248, 0.65, -0.16), // Stargazer: night-sky indigo
  wombolder: T(75, 0.65), // Garden Club Keeper: garden moss
  shadopus: T(220, 0.08), // Mystery Club Sleuth: detective grey
  pangrove: T(40, 0.7, -0.02), // Band Drummer: brass gold
  mossloth: T(150, 0.45, 0.1), // Nap Club Captain: pastel mint
};

export const IDOL_TINTS: Record<CharacterId, Tint> = {
  voltkit: T(355, 0.7), // Thunder Riff: stage-light crimson
  cindrake: T(275, 0.55), // Pyro Headliner: royal purple
  tidefin: T(285, 0.6), // Pearl Popstar: orchid
  auralynx: T(180, 0.55, 0.06), // Prism Soloist: hologram aqua
  lumoth: T(270, 0.55), // Disco Flutter: disco violet
  mystowl: T(235, 0.55, -0.12), // Midnight Enchantress: midnight blue
  terradon: T(175, 0.6), // Street Beat: spray-can turquoise
  duskveil: T(42, 0.5, 0.04), // Phantom Crooner: champagne gold
  coilemur: T(310, 0.65), // Synth Looper: synthwave magenta
  pyranda: T(272, 0.5, -0.04), // Chestnut MC: grape
  glacelle: T(335, 0.5, 0.04), // Crystal Soprano: rose quartz
  halcyra: T(178, 0.65, -0.06), // Plume Showstar: peacock teal
  sunbara: T(100, 0.5, 0.06), // Sunflower Sweetheart: leaf green
  astrabun: T(340, 0.8, -0.18), // Mochi Starlet: strawberry mochi
  wombolder: T(215, 0.45, -0.06), // Bedrock Drummer: denim blue
  shadopus: T(25, 0.8), // Neon Octave: neon coral
  pangrove: T(8, 0.65, 0.04), // Island Serenader: hibiscus coral
  mossloth: T(50, 0.8), // Lo-fi Lullaby: honey yellow
};

/**
 * Abyssal Expedition: one dive team, a sea of its own for every diver. The
 * body takes a deep-water hue (lantern-fish blue, kelp green, vent coral,
 * abyssal violet...) instead of one teal for all eighteen, and the suit's
 * stripes, tank bands and gauge pips take the diver's team colour, so the
 * divers tell apart at battle size. The suit cloth and brass stay shared.
 */
export const ABYSSAL_TEAM: Record<CharacterId, { hue: number; team: string }> =
  {
    voltkit: { hue: 198, team: "#ffd23f" }, // Arc Diver: lantern-fish blue, signal yellow
    cindrake: { hue: 8, team: "#ffb347" }, // vent crab red, magma orange
    tidefin: { hue: 182, team: "#ff7a59" }, // reef teal, coral
    auralynx: { hue: 246, team: "#8ff5e6" }, // anglerfish indigo, lure aqua
    lumoth: { hue: 166, team: "#fff17a" }, // glow-plankton green, pale light
    mystowl: { hue: 220, team: "#ffb02e" }, // Sonar Owl: cobalt, sonar amber
    terradon: { hue: 150, team: "#ff7a59" }, // Reef Bastion: kelp green, coral
    duskveil: { hue: 268, team: "#7dffb0" }, // abyssal violet, ghost-light green
    coilemur: { hue: 204, team: "#ffd23f" }, // steel blue, warning yellow
    pyranda: { hue: 18, team: "#fff3c4" }, // Coral Rescuer: rescue coral, cream
    glacelle: { hue: 190, team: "#ff6fae" }, // ice-water teal, jelly pink
    halcyra: { hue: 212, team: "#ff9a2e" }, // open-sea blue, flare orange
    sunbara: { hue: 30, team: "#e8443a" }, // Buoy Captain: buoy amber, buoy red
    astrabun: { hue: 234, team: "#ffd23f" }, // midnight-zone indigo, star yellow
    wombolder: { hue: 158, team: "#ff9a2e" }, // sea-grass green, hazard orange
    shadopus: { hue: 176, team: "#ffb02e" }, // Nautilus Captain: deep teal, brass light
    pangrove: { hue: 136, team: "#ffd23f" }, // kelp-forest green, sun yellow
    mossloth: { hue: 350, team: "#8ff5e6" }, // Coral Keeper: coral pink, aqua
  };
