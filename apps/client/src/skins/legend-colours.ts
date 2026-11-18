import type { CharacterId } from "@arena/shared";
import type { Tint } from "./fashion-art";

/**
 * Body colours for the Legendary collections, chosen per champion for the
 * figure it plays (a gold Kim Quy, a lotus-pink Hoa Đăng, a candy-red
 * hot-rod racer, a copper-green Lady Liberty...). Each moves the champion's
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
  cindrake: T(22, 0.38, -0.08), // Thánh Gióng: iron-bronze
  tidefin: T(338, 0.55, 0.04), // Hoa Đăng: lotus pink
  auralynx: T(40, 0.22, 0.1), // Vovinam: unbleached cotton
  lumoth: T(28, 0.72), // Hội An lantern: warm amber
  mystowl: T(150, 0.35), // Quan họ: jade
  terradon: T(45, 0.7), // Kim Quy: gold
  duskveil: T(232, 0.42, -0.04), // Đèn kéo quân: night indigo
  coilemur: T(24, 0.45, -0.1), // Đàn bầu: lacquered wood
  pyranda: T(20, 0.55, -0.06), // Hạt dẻ: roast chestnut
  glacelle: T(172, 0.25, 0.08), // Sa Pa: mountain mist
  halcyra: T(32, 0.5, -0.04), // Chim Lạc: drum bronze
  sunbara: T(350, 0.5, 0.06), // Tết: peach blossom (hoa đào)
  astrabun: T(150, 0.3, 0.1), // Thỏ Ngọc: pale jade
  wombolder: T(48, 0.55, 0.04), // Lúa chín: ripe rice gold
  shadopus: T(40, 0.2, 0.1), // Hát bội: painted-face ivory
  pangrove: T(185, 0.42), // Đầm sen: deep pond teal
  mossloth: T(210, 0.08), // Ông đồ: ink-wash grey
};

export const STARS_TINTS: Record<CharacterId, Tint> = {
  voltkit: T(210, 0.12, 0.1), // Space Ranger: silver-white
  cindrake: T(355, 0.72), // Hot-Rod Racer: candy red
  tidefin: T(15, 0.6, 0.05), // Malibu Surfer: sunset coral
  auralynx: T(270, 0.45, -0.06), // Jazz Cat: midnight purple
  lumoth: T(165, 0.45, 0.06), // Neon Diner: diner mint
  mystowl: T(158, 0.28), // Lady Liberty: copper patina
  terradon: T(12, 0.52), // Sheriff: red-rock canyon
  duskveil: T(0, 0.02, 0, 0.92), // Film Noir: black and white
  coilemur: T(40, 0.62, 0.04), // Rodeo Rider: palomino gold
  pyranda: T(215, 0.6, 0.02), // Ace Pitcher: team blue
  glacelle: T(245, 0.35, 0.06), // Aurora Alaska: icy violet
  halcyra: T(25, 0.4), // Barnstormer: eagle brown
  sunbara: T(222, 0.55), // Fourth of July: flag navy
  astrabun: T(0, 0, 0.1, 0.92), // Stage Magician: snow white
  wombolder: T(0, 0.55), // Linebacker: team red
  shadopus: T(310, 0.6), // Times Square DJ: neon magenta
  pangrove: T(38, 0.42, 0.06), // Park Ranger: ranger khaki
  mossloth: T(285, 0.45), // Woodstock Folk: tie-dye violet
};
