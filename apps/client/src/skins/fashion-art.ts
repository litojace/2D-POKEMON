import {
  FASHION_COLLECTION_IDS,
  FASHION_ROSTER,
  type FashionCollection,
} from "../../../../packages/shared/src/shop";
import type { CharacterId } from "@arena/shared";
import type { SkinArt, Palette } from "./skin-art";
import {
  CARNIVAL_CREATURES,
  CARNIVAL_TEXTILES,
  EPIC_REPLACED_PROPS,
} from "./epic-materials";

const blend = (a: string, b: string, t: number) =>
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
const color = (hex: string) => parseInt(hex.slice(1), 16);
const artFor = (
  champion: CharacterId,
  collection: FashionCollection,
): SkinArt => {
  const accent = FASHION_ROSTER[champion][5];
  if (collection === "abyssal-expedition" || collection === "dream-carnival") {
    const deep = collection === "abyssal-expedition";
    const festival = CARNIVAL_TEXTILES[champion][0];
    const mid = deep
      ? blend(accent, "#2b4855", 0.58)
      : CARNIVAL_CREATURES[champion][0];
    return {
      palette: {
        light: blend(mid, "#f0f9ef", deep ? 0.7 : 0.57),
        mid,
        dark: deep ? "#142b40" : blend(mid, "#241d45", 0.68),
        glow: deep ? "#93d4cb" : CARNIVAL_CREATURES[champion][1],
        accent:
          champion === "duskveil" ? "#1b2139" : deep ? "#bd9c72" : festival,
      },
      accessories: [`fashion-${collection}`],
      replaces: EPIC_REPLACED_PROPS.includes(champion)
        ? ["flame", "scarf"]
        : ["scarf"],
      pattern: {
        kind: deep ? "bands" : "stars",
        color: deep ? "#82bfbc" : "#ddc8a1",
        opacity: deep ? 0.12 : 0.1,
        parts: ["tail", "wings"],
      },
      trail: {
        kind: deep ? "bubble" : "confetti",
        colors: deep
          ? [0x72f2de, 0xf3ac59]
          : [parseInt(festival.slice(1), 16), 0xffe6a0],
      },
      skill: deep ? 0x72dfd3 : parseInt(festival.slice(1), 16),
      detail: "glint",
      weapon: deep
        ? { handle: "#284454", head: "#79bfc5" }
        : { handle: blend(festival, "#221833", 0.55), head: festival },
    };
  }

  const palette: Palette = {
    light: blend(accent, "#fff5e9", 0.7),
    mid: blend(
      accent,
      collection === "astral-court" ? "#36395f" : "#d9d8c5",
      0.28,
    ),
    dark: blend(accent, "#171b2e", 0.8),
    glow: collection === "astral-court" ? "#bfe8ff" : accent,
    accent,
  };
  const common = {
    palette,
    accessories: [`fashion-${collection}`] as SkinArt["accessories"],
  };
  switch (collection) {
    case "wayfarer":
      return {
        ...common,
        trail: { kind: "leaf", colors: [color(accent), 0xa9bf94] },
      };
    case "moonlit-tea":
      return {
        ...common,
        pattern: {
          kind: "petals",
          color: "#fff2df",
          opacity: 0.22,
          parts: ["tail", "wings"],
        },
        trail: { kind: "petal", colors: [color(accent), 0xffeedc] },
      };
    case "astral-court":
      return {
        ...common,
        pattern: {
          kind: "stars",
          color: "#d6e8ff",
          opacity: 0.5,
          parts: ["tail", "wings", "ears"],
        },
        trail: { kind: "star", colors: [0xbfe8ff, color(accent)] },
      };
  }
};

/** All 90 looks use the production creature layers and effect budget. */
export const FASHION_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(FASHION_ROSTER) as CharacterId[]).flatMap((id) =>
    FASHION_COLLECTION_IDS.map((collection) => [
      `${id}-${collection}`,
      artFor(id, collection),
    ]),
  ),
);
