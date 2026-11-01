import type Phaser from "phaser";
import {
  cosmeticTier,
  tierRank,
  type CosmeticTier,
} from "../../../../packages/shared/src/cosmetic-tier";
import { JOURNEY_ITEM_BY_ID } from "../../../../packages/shared/src/journey";
import type { FxParticle } from "./skin-fx";
import { sparkle } from "./skin-fx";

/**
 * Rarity flourishes layered on top of each aura, entrance and victory, so a
 * pricier or harder-won piece looks grander at a glance (the idea behind
 * prestige effects in League of Legends or Fortnite's rarity tiers):
 *
 *   Rare       a soft glow on the ground in the item's colour
 *   Epic       + a pulsing inner ring and rising motes / a shockwave
 *   Legendary  + sweeping light arcs and twinkles / a pillar of light,
 *              light rays behind a victory
 *   Mythic     + prismatic rings that shift colour, an orbiting comet /
 *              double shockwaves in two colours, a crown of light
 *
 * Shapes are plain Graphics calls (no filters), cheap enough for every
 * fighter on screen; the Shop thumbnails draw the same code.
 */
type G = Phaser.GameObjects.Graphics;
type Emit = (p: FxParticle) => void;
const TAU = Math.PI * 2;

/** Each piece's main and accent colours, taken from its own effect. */
const PALETTE: Record<string, [number, number]> = {
  "candy-aura": [0xff6fa8, 0x6fd6ff],
  "galaxy-aura": [0xc86bff, 0x9fd8ff],
  "retro-aura": [0xff3a5a, 0x2ff3ff],
  "festival-aura": [0xff4f4f, 0xffd65b],
  "garden-aura": [0xffb3cf, 0x8fe06a],
  "winter-aura": [0xbfe8ff, 0xffffff],
  "spark-aura": [0x8edfff, 0xffe18b],
  "ember-aura": [0xff8765, 0xffd28b],
  "halo-aura": [0xffe5a0, 0xa5adff],
  "mountain-aura": [0xffd28c, 0xb88a52],
  "tidal-aura": [0x7fe9ff, 0xffffff],
  nightmote: [0xffd27a, 0x8f7bd8],
  "lullaby-aura": [0xc9a3ff, 0xffdf8d],
  "candy-entrance": [0xff6fa8, 0x6fd6ff],
  "galaxy-entrance": [0xc86bff, 0x9fd8ff],
  "retro-entrance": [0x2ff3ff, 0xff4fd8],
  "festival-entrance": [0xff4f4f, 0xffd65b],
  "garden-entrance": [0xff6fa0, 0x8fe06a],
  "winter-entrance": [0xbfe8ff, 0xffffff],
  "lightning-strike": [0x8edfff, 0xffe18b],
  firefall: [0xff8765, 0xffd28b],
  sunburst: [0xffd778, 0xffffff],
  dreamdrift: [0xc9a3ff, 0x92efdb],
  riptide: [0x7fe9ff, 0xe6fbff],
  shadowstep: [0x8f7bd8, 0xffd65b],
  mountainborn: [0xffd28c, 0x9b8466],
  "candy-victory": [0xff6fa8, 0xffd65b],
  "galaxy-victory": [0xc86bff, 0x9fd8ff],
  "retro-victory": [0x2ff3ff, 0xffd65b],
  "festival-victory": [0xff4f4f, 0xffd65b],
  "garden-victory": [0xff6fa0, 0xfff0f5],
  "winter-victory": [0xbfe8ff, 0xffffff],
  splashdown: [0x7fe9ff, 0xe6fbff],
  "twin-spark": [0xffe18b, 0x8edfff],
  "feather-fall": [0xffd28b, 0xe77f5c],
  "rainbow-fan": [0xffd778, 0x80e1ff],
  "sweet-dreams": [0xc9a3ff, 0xffdf8d],
  "crescent-bow": [0xffd65b, 0xfff1c2],
  "rockslide-flex": [0xffd28c, 0x9b8466],
};
const PRISM = [0xff7d9c, 0xffd36b, 0x8ff0b5, 0x7fd8ff, 0xb59bff];

export function palette(id: string): [number, number] {
  const known = PALETTE[id];
  if (known) return known;
  const journey = JOURNEY_ITEM_BY_ID[id];
  if (journey)
    return [parseInt(journey.color.slice(1), 16), parseInt(journey.accent.slice(1), 16)];
  return [0xffffff, 0xffd65b];
}
const at = (t: CosmeticTier, min: CosmeticTier) => tierRank(t) >= tierRank(min);

/**
 * Under and over the aura (call after the item's own aura). `now` in ms;
 * `flat` is the ground ellipse's height/width. `front` (optional) is the
 * layer in front of the fighter.
 */
export function auraFlourish(
  g: G,
  id: string,
  x: number,
  y: number,
  now: number,
  reduced: boolean,
  flat: number,
  front?: G,
) {
  const tier = cosmeticTier(id);
  if (!at(tier, "rare")) return;
  const t = reduced ? 0 : now / 1000;
  const [main, accent] = palette(id);
  const over = front ?? g;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  // Rare: a soft glow pooled on the ground.
  g.fillStyle(main, 0.08 + 0.05 * pulse).fillEllipse(x, y, 118, 118 * flat);
  if (!at(tier, "epic")) return;
  // Epic: a pulsing inner ring and motes drifting up.
  g.lineStyle(1.6, accent, 0.35 + 0.35 * pulse).strokeEllipse(x, y, 70 + 8 * pulse, (70 + 8 * pulse) * flat);
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.45 + i / 4) % 1;
    const a = i * 2.1 + Math.floor(t * 0.45 + i / 4) * 1.7;
    over.fillStyle(i % 2 ? main : accent, 0.85 * (1 - k) * Math.min(1, k * 5)).fillCircle(
      x + Math.cos(a) * 34,
      y - 4 - k * 46,
      1.6 + (1 - k) * 0.8,
    );
  }
  if (!at(tier, "legendary")) return;
  // Legendary: two bright arcs sweep round the ring, and twinkles pop.
  for (let s = 0; s < 2; s++) {
    const base = t * 1.6 + s * Math.PI;
    for (let i = 0; i < 9; i++) {
      const a0 = base + i * 0.09,
        a1 = a0 + 0.09;
      const fade = (1 - i / 9) * 0.9;
      (Math.sin(a0) > 0 ? over : g)
        .lineStyle(3.2 - i * 0.25, i < 2 ? 0xffffff : main, fade)
        .lineBetween(
          x + Math.cos(a0) * 57,
          y + Math.sin(a0) * 57 * flat,
          x + Math.cos(a1) * 57,
          y + Math.sin(a1) * 57 * flat,
        );
    }
  }
  for (let i = 0; i < 5; i++) {
    const phase = (t * 0.8 + i * 0.37) % 1;
    const a = i * 1.9 + Math.floor(t * 0.8 + i * 0.37) * 2.3;
    const life = Math.sin(phase * Math.PI);
    sparkle(over, x + Math.cos(a) * 48, y - 18 - Math.sin(a * 1.3) * 22, 2.6 * life + 0.4, i % 2 ? 0xffffff : accent, 0.95 * life);
  }
  if (!at(tier, "mythic")) return;
  // Mythic: prismatic rings that shift colour, and a comet orbiting with a tail.
  for (let r = 0; r < 2; r++) {
    const c = PRISM[Math.floor(t * 2 + r * 2) % PRISM.length];
    const w = 104 + r * 16 + Math.sin(t * 3 + r) * 3;
    g.lineStyle(2 - r * 0.6, c, 0.75 - r * 0.25).strokeEllipse(x, y, w, w * flat);
  }
  const ca = t * 2.6;
  for (let i = 0; i < 10; i++) {
    const a = ca - i * 0.12;
    const near = Math.sin(a) > 0;
    (near ? over : g)
      .fillStyle(i === 0 ? 0xffffff : PRISM[i % PRISM.length], (1 - i / 10) * 0.9)
      .fillCircle(x + Math.cos(a) * 62, y - 10 + Math.sin(a) * 62 * flat, 3.2 - i * 0.26);
  }
}

/** Extra bursts when an entrance plays (call after the item's own). */
export function entranceFlourish(emit: Emit, id: string, x: number, y: number, sc: number) {
  const tier = cosmeticTier(id);
  if (!at(tier, "epic")) return;
  const [main, accent] = palette(id);
  emit({ x, y, vx: 0, vy: 0, life: 0.55, size: 7 * sc, color: accent, shape: "shock" });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    emit({ x: x + Math.cos(a) * 20 * sc, y: y - 30 * sc, vx: Math.cos(a) * 70, vy: Math.sin(a) * 50 - 40, life: 0.8, size: 2.6 * sc, color: i % 2 ? main : 0xffffff, shape: "star" });
  }
  if (!at(tier, "legendary")) return;
  emit({ x, y, vx: 0, vy: 0, life: 0.9, size: 9 * sc, color: main, shape: "beam" });
  for (let i = 0; i < 10; i++)
    emit({ x: x + (Math.random() - 0.5) * 30 * sc, y: y - Math.random() * 20 * sc, vx: (Math.random() - 0.5) * 20, vy: -120 - Math.random() * 80, life: 0.9, size: 2.4 * sc, color: i % 2 ? 0xffffff : accent, shape: "star" });
  if (!at(tier, "mythic")) return;
  emit({ x, y, vx: 0, vy: 0, life: 0.75, size: 5 * sc, color: PRISM[1], shape: "shock" });
  emit({ x, y, vx: 0, vy: 0, life: 1.0, size: 10 * sc, color: PRISM[3], shape: "shock" });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    emit({ x, y: y - 40 * sc, vx: Math.cos(a) * 160, vy: Math.sin(a) * 120, life: 0.8, size: 3 * sc, color: PRISM[i % PRISM.length], shape: "spark" });
  }
}

/** Behind and around a victory (t seconds in; call each frame). */
export function victoryFlourish(
  g: G,
  under: G,
  emit: Emit,
  chance: (rate: number, dt: number) => boolean,
  id: string,
  x: number,
  y: number,
  sc: number,
  t: number,
  dt: number,
) {
  if (t > 3) return;
  const tier = cosmeticTier(id);
  if (!at(tier, "epic")) return;
  const [main, accent] = palette(id);
  const fade = t > 2.4 ? Math.max(0, 1 - (t - 2.4) / 0.6) : Math.min(1, t / 0.25);
  if (chance(12, dt))
    emit({ x: x + (Math.random() - 0.5) * 140 * sc, y: y - (40 + Math.random() * 90) * sc, vx: 0, vy: 20, life: 0.9, size: 2.6 * sc, color: Math.random() < 0.5 ? main : 0xffffff, shape: "star" });
  if (!at(tier, "legendary")) return;
  // Rays of light turn slowly behind the fighter.
  const cy = y - 40 * sc;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + t * 0.5;
    const w = 0.09;
    under.fillStyle(i % 2 ? main : accent, 0.16 * fade).fillTriangle(
      x,
      cy,
      x + Math.cos(a - w) * 120 * sc,
      cy + Math.sin(a - w) * 120 * sc,
      x + Math.cos(a + w) * 120 * sc,
      cy + Math.sin(a + w) * 120 * sc,
    );
  }
  under.fillStyle(0xffffff, 0.12 * fade).fillCircle(x, cy, 30 * sc);
  if (!at(tier, "mythic")) return;
  // A crown of prismatic light above the head.
  const hy = y - 112 * sc;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.42;
    const px = x + Math.cos(a) * 26 * sc,
      py = hy + 18 * sc + Math.sin(a) * 18 * sc;
    sparkle(g, px, py, (3.6 + Math.sin(t * 6 + i) * 0.8) * sc, PRISM[i], fade);
  }
  g.lineStyle(2 * sc, PRISM[Math.floor(t * 4) % PRISM.length], 0.8 * fade).strokeEllipse(x, hy + 22 * sc, 56 * sc, 14 * sc);
}
