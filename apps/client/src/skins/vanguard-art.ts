import type { CharacterId } from "@arena/shared";
import type { SkinArt, Palette } from "./skin-art";

export interface HeroPreview {
  name: string;
  role: string;
  color: string;
  suit: string;
  panel: string;
  trim: string;
  palette: Palette;
}
const mix = (a: string, b: string, t: number) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.round(
        parseInt(a.slice(i, i + 2), 16) * (1 - t) +
          parseInt(b.slice(i, i + 2), 16) * t,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const hero = (
  name: string,
  role: string,
  body: string,
  suit: string,
  glow: string,
): HeroPreview => ({
  name,
  role,
  color: suit,
  suit,
  panel: mix(suit, "#172439", 0.36),
  trim: "#edcf94",
  palette: {
    light: mix(body, "#fff5e4", 0.68),
    mid: body,
    dark: mix(body, "#172439", 0.79),
    glow,
    accent: suit,
  },
});

/** Original hero collection: coordinated costume and body palettes for every champion. */
export const VANGUARD_DESIGNS = {
  voltkit: hero(
    "Pulse Courier",
    "Xung điện · giáp dẫn năng lượng",
    "#e8bc66",
    "#388a9b",
    "#a1ecdf",
  ),
  cindrake: hero(
    "Solar Forger",
    "Lò mặt trời · găng tay rèn",
    "#ed955f",
    "#446e83",
    "#ffcf7a",
  ),
  tidefin: hero(
    "Riptide Ranger",
    "Sóng triều · cánh lướt nước",
    "#e7a090",
    "#347c88",
    "#a8e8df",
  ),
  auralynx: hero(
    "Prism Sentinel",
    "Khiên pha lê · vòng tay phân quang",
    "#a2a3df",
    "#507e9e",
    "#b3f2e7",
  ),
  lumoth: hero(
    "Lumen Warden",
    "Đèn dẫn đường · giáp cánh nhẹ",
    "#a6b9df",
    "#7a6ba6",
    "#fff0af",
  ),
  mystowl: hero(
    "Night Cartographer",
    "Bản đồ sao · áo bay gấp nếp",
    "#bc9ed9",
    "#366b7e",
    "#aedfef",
  ),
  terradon: hero(
    "Bulwark Grove",
    "Mai lục giác · giáp hạt mầm",
    "#aac081",
    "#ad7b40",
    "#d2e7a0",
  ),
  duskveil: hero(
    "Echo Beacon",
    "Sóng âm · lồng đèn tín hiệu",
    "#989abd",
    "#526d86",
    "#f4d99a",
  ),
  coilemur: hero(
    "Flux Runner",
    "Từ trường · cuộn dây tăng tốc",
    "#dbbc9f",
    "#467fa9",
    "#a9e7e1",
  ),
  pyranda: hero(
    "Cinder Medic",
    "Cứu hộ · hộp mầm hồi phục",
    "#df966d",
    "#468e86",
    "#d7f2ce",
  ),
  glacelle: hero(
    "Frost Weaver",
    "Dệt băng · lưới khiên mềm",
    "#c4deeb",
    "#ad7198",
    "#d6f6ff",
  ),
  halcyra: hero(
    "Gale Captain",
    "Luồng gió · vây định hướng",
    "#dda57e",
    "#367f98",
    "#b9edf0",
  ),
  sunbara: hero(
    "Dawn Defender",
    "Nắng sớm · mái chắn năng lượng",
    "#b8a1cb",
    "#c4924f",
    "#ffe5a6",
  ),
  astrabun: hero(
    "Comet Strider",
    "Lướt sao · gậy chổi sao chổi",
    "#b6d5e8",
    "#467e99",
    "#ffdfa4",
  ),
  wombolder: hero(
    "Quake Marshal",
    "Địa chấn · găng tay nén đá",
    "#c39b7f",
    "#9c7549",
    "#e8d6a6",
  ),
  shadopus: hero(
    "Deepwatch Oracle",
    "Tiên tri biển · cảm biến ngọc",
    "#9ebeb7",
    "#665e92",
    "#debeed",
  ),
  pangrove: hero(
    "Briar Bastion",
    "Tường gai · giáp vảy lá",
    "#a6bc83",
    "#487d65",
    "#d9e9a3",
  ),
  mossloth: hero(
    "Cloud Keeper",
    "Mây ngủ · khăn choàng đệm gió",
    "#b7abc9",
    "#719b96",
    "#e9f2d2",
  ),
} satisfies Record<CharacterId, HeroPreview>;

export const VANGUARD_KEEP_CREST: readonly CharacterId[] = [
  "cindrake",
  "lumoth",
  "halcyra",
  "glacelle",
  "pangrove",
];
export const VANGUARD_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(VANGUARD_DESIGNS) as CharacterId[]).map((id) => {
    const design = VANGUARD_DESIGNS[id];
    const replaces: import("../creature-design").CreaturePart[] = ["scarf"];
    if (!VANGUARD_KEEP_CREST.includes(id)) replaces.push("flame");
    if (["tidefin", "astrabun", "pyranda"].includes(id)) replaces.push("armR");
    return [
      `${id}-nova-vanguard`,
      {
        palette: {
          ...design.palette,
          ...(id === "duskveil" ? { accent: "#151b30" } : {}),
        },
        accessories: ["vanguard"],
        replaces,
        trail: {
          kind:
            id === "tidefin" || id === "shadopus"
              ? "bubble"
              : id === "pangrove" || id === "mossloth"
                ? "leaf"
                : id === "cindrake" || id === "pyranda"
                  ? "ember"
                  : "star",
          colors: [
            parseInt(design.palette.glow.slice(1), 16),
            parseInt(design.suit.slice(1), 16),
          ],
        },
        skill: parseInt(design.palette.glow.slice(1), 16),
        detail: "glint",
        vanguard: id,
      } satisfies SkinArt,
    ];
  }),
);
