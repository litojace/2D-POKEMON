import type { CharacterId } from "@arena/shared";
import type { Second } from "./fashion-art";

/**
 * The second colour of every Legendary's two-tone body (see `legendPalette`
 * in fashion-art.ts): the hue its light markings take, chosen for the
 * figure against its body colour (collection-colours.ts, PIRATE_TINTS,
 * VANGUARD_TINTS). Lightness never changes, so only the colour story does.
 */
const S = (hue: number, sat: number): Second => ({ hue, sat });
/** Champions whose face or muzzle is drawn in the light colour: theirs stays
 * pale, with half the colour, so a face never looks unwell. */
const FACE_LIGHT: CharacterId[] = ["voltkit", "coilemur", "mossloth", "pangrove", "wombolder"];

const TABLE: Record<
  "nova-vanguard" | "sky-pirates" | "hon-viet" | "stars-stripes" | "sun-dynasty",
  Record<CharacterId, Second>
> = {
  // Nova Vanguard: markings in a colour of the hero's power.
  "nova-vanguard": {
    voltkit: S(180, 0.6), // charged gold, pulse cyan
    cindrake: S(215, 0.25), // forge orange, anvil steel
    tidefin: S(12, 0.55), // riptide aqua, reef coral
    auralynx: S(160, 0.5), // prism periwinkle, prism mint
    lumoth: S(175, 0.4), // lamplight ivory, lamp teal
    mystowl: S(45, 0.6), // night violet, star gold
    terradon: S(30, 0.5), // moss green, bark amber
    duskveil: S(180, 0.55), // signal magenta, echo cyan
    coilemur: S(270, 0.5), // flux cyan, flux violet
    pyranda: S(150, 0.35), // ember red, medic mint
    glacelle: S(280, 0.4), // frost blue, aurora lilac
    halcyra: S(42, 0.6), // open sky, sunlit gold
    sunbara: S(345, 0.5), // dawn gold, dawn rose
    astrabun: S(48, 0.6), // comet ice, comet gold
    wombolder: S(210, 0.3), // rust amber, slate
    shadopus: S(275, 0.45), // deep-sea teal, oracle violet
    pangrove: S(340, 0.45), // briar jade, briar rose
    mossloth: S(25, 0.45), // sky pastel, cloud peach
  },
  // Sky Pirates: brass, sea and treasure against the coat colour.
  "sky-pirates": {
    voltkit: S(45, 0.55), // storm slate, brass
    cindrake: S(40, 0.65), // ember crimson, doubloon gold
    tidefin: S(10, 0.5), // sea foam, coral
    auralynx: S(180, 0.45), // twilight indigo, lagoon teal
    lumoth: S(210, 0.45), // lantern gold, ocean blue
    mystowl: S(225, 0.35), // parchment, map ink
    terradon: S(20, 0.5), // gunmetal, copper rivets
    duskveil: S(270, 0.4), // ghost green, spectral violet
    coilemur: S(200, 0.4), // sailcloth, open sea
    pyranda: S(45, 0.7), // cinnamon, saffron
    glacelle: S(250, 0.3), // hoarfrost, steel lilac
    halcyra: S(40, 0.5), // crow black, brass
    sunbara: S(175, 0.5), // sunset coral, turquoise sea
    astrabun: S(215, 0.35), // moonlit orchid, moon silver
    wombolder: S(40, 0.4), // sea moss, barnacle sand
    shadopus: S(285, 0.5), // deep-sea teal, bioluminescent violet
    pangrove: S(5, 0.55), // jungle lime, parrot red
    mossloth: S(170, 0.35), // sleepy rose, canvas teal
  },
  // Hồn Việt: lacquer red, gold, jade, indigo and lotus.
  "hon-viet": {
    voltkit: S(355, 0.6), // lantern amber, lantern red
    cindrake: S(100, 0.4), // iron bronze, bamboo green
    tidefin: S(120, 0.4), // lotus pink, lotus leaf
    auralynx: S(215, 0.45), // unbleached cotton, Vovinam blue
    lumoth: S(210, 0.4), // Hội An amber, Hội An blue doors
    mystowl: S(45, 0.5), // jade, gold
    terradon: S(150, 0.45), // Kim Quy gold, jade
    duskveil: S(30, 0.6), // night indigo, lantern orange
    coilemur: S(190, 0.2), // lacquered wood, mother-of-pearl
    pyranda: S(10, 0.55), // roast chestnut, ember red
    glacelle: S(235, 0.45), // mountain mist, H'Mông indigo
    halcyra: S(165, 0.4), // drum bronze, verdigris
    sunbara: S(48, 0.65), // peach blossom, hoa mai gold
    astrabun: S(48, 0.45), // pale jade, moon gold
    wombolder: S(100, 0.45), // ripe rice, paddy green
    shadopus: S(355, 0.55), // painted ivory, hát bội red
    pangrove: S(335, 0.5), // pond teal, lotus pink
    mossloth: S(355, 0.4), // ink-wash grey, giấy điều red
  },
  // Stars & Stripes: the figure's own Americana, red, white and blue.
  "stars-stripes": {
    voltkit: S(25, 0.6), // spacesuit periwinkle, mission orange
    cindrake: S(40, 0.7), // candy red, hot-rod flame gold
    tidefin: S(185, 0.55), // sunset coral, surf aqua
    auralynx: S(45, 0.55), // smoky orchid, brass
    lumoth: S(340, 0.55), // diner mint, diner pink
    mystowl: S(45, 0.6), // copper patina, torch gold
    terradon: S(215, 0.35), // red rock, denim
    duskveil: S(0, 0.02), // film noir stays black and white
    coilemur: S(215, 0.4), // palomino, denim
    pyranda: S(355, 0.6), // team blue, stitch red
    glacelle: S(140, 0.5), // icy violet, aurora green
    halcyra: S(45, 0.35), // burgundy, aviator khaki
    sunbara: S(355, 0.65), // flag navy, flag red
    astrabun: S(45, 0.5), // velvet rose, stage gold
    wombolder: S(210, 0.15), // team red, helmet silver
    shadopus: S(185, 0.65), // neon magenta, neon cyan
    pangrove: S(130, 0.4), // ranger khaki, forest green
    mossloth: S(30, 0.6), // tie-dye violet, tie-dye orange
  },
  // Sun Dynasty: gold on the blue and red bodies, lapis on the golden ones,
  // turquoise on the earth.
  "sun-dynasty": {
    voltkit: S(45, 0.6), // faience turquoise, chariot gold
    cindrake: S(12, 0.6), // phoenix gold, flame red
    tidefin: S(45, 0.55), // river lapis, gold
    auralynx: S(220, 0.45), // temple sand, lapis
    lumoth: S(40, 0.6), // dusk blue, lamplight
    mystowl: S(48, 0.6), // night indigo, star gold
    terradon: S(175, 0.4), // sun-baked brick, turquoise
    duskveil: S(210, 0.3), // moonlit lavender, moon silver
    coilemur: S(175, 0.45), // dune copper, turquoise
    pyranda: S(220, 0.45), // saffron, lapis
    glacelle: S(45, 0.5), // mirage orchid, gold
    halcyra: S(40, 0.55), // falcon sky, gold
    sunbara: S(48, 0.65), // royal carnelian, gold
    astrabun: S(330, 0.45), // blue lotus, lotus pink
    wombolder: S(45, 0.4), // red granite, gold
    shadopus: S(215, 0.45), // papyrus, ink lapis
    pangrove: S(40, 0.55), // palm green, date gold
    mossloth: S(175, 0.4), // desert rose, turquoise
  },
};

export const LEGEND_SECOND = Object.fromEntries(
  Object.entries(TABLE).map(([c, row]) => [
    c,
    Object.fromEntries(Object.entries(row).map(([id, s]) => [id, FACE_LIGHT.includes(id as CharacterId) ? { ...s, soft: true } : s])),
  ]),
) as typeof TABLE;
