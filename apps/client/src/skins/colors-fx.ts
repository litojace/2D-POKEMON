import type Phaser from "phaser";
import {
  cosmeticTier,
  tierRank,
  type CosmeticTier,
} from "../../../../packages/shared/src/cosmetic-tier";
import { TONES } from "../animation/cosmetics";
import type { FxParticle, FxShape } from "./skin-fx";
import { sparkle } from "./skin-fx";

/**
 * Colors (all-fighter palettes) come alive, the way chromas and "reactive"
 * styles do in big games: each set has its own motif drawn around the
 * fighter, and higher tiers add more.
 *
 *   Common     the palette, plus its motif drifting off now and then
 *   Rare       + glints twinkling on the body
 *   Epic       + its motif drifting steadily, and a trail while running
 *   Legendary  + a soft glow pooled under the feet and rising motes
 *   Mythic     + a prismatic shimmer that travels up the body
 *
 * Plain Graphics calls only (cheap for every fighter on screen). The Shop
 * and Wardrobe thumbnails run this same code.
 */
type G = Phaser.GameObjects.Graphics;
type Emit = (p: FxParticle) => void;

/** Each set's motif: which particle, how it moves. */
const MOTIF: Record<string, { shape: FxShape; rise: number; spread: number }> =
  {
    "candy-colours": { shape: "confetti", rise: -20, spread: 26 },
    "galaxy-colours": { shape: "star", rise: -14, spread: 30 },
    "retro-colours": { shape: "pixel", rise: -28, spread: 24 },
    "festival-colours": { shape: "coin", rise: -60, spread: 22 },
    "garden-colours": { shape: "leaf", rise: -24, spread: 28 },
    "winter-colours": { shape: "flake", rise: -10, spread: 30 },
    seafoam: { shape: "bubble", rise: -34, spread: 22 },
    pearlscale: { shape: "bubble", rise: -30, spread: 22 },
    "dusk-colors": { shape: "star", rise: -16, spread: 26 },
    "twilight-colors": { shape: "star", rise: -16, spread: 26 },
    "moonlit-skin": { shape: "star", rise: -12, spread: 26 },
    "starlit-skin": { shape: "star", rise: -12, spread: 28 },
    "starlit-colors": { shape: "star", rise: -12, spread: 30 },
    "dawn-colors": { shape: "star", rise: -22, spread: 24 },
    "prismatic-skin": { shape: "star", rise: -18, spread: 28 },
    "ember-colors": { shape: "dot", rise: -46, spread: 20 },
    cinderplume: { shape: "puff", rise: -26, spread: 20 },
    "static-colors": { shape: "spark", rise: -8, spread: 24 },
    thundercell: { shape: "spark", rise: -8, spread: 26 },
    cragbound: { shape: "pebble", rise: -70, spread: 20 },
    cragstone: { shape: "pebble", rise: -70, spread: 22 },
  };
const PRISM = [0xff7d9c, 0xffd36b, 0x8ff0b5, 0x7fd8ff, 0xb59bff];

/** The set's three tones (shadow, mid, light), from its palette. */
export function colorsTones(id: string): [number, number, number] {
  const tones = TONES[id as keyof typeof TONES]?.tones;
  if (tones) return tones;
  if (id === "retro-colours") return [0x2b2d6e, 0xff4fd8, 0x2ff3ff];
  if (id === "cragbound" || id === "cragstone")
    return [0x5e4b36, 0xb88a52, 0xffd28c];
  return [0x334466, 0x8fb8ff, 0xffffff];
}
export function isColors(id: string | null | undefined) {
  if (!id) return false;
  return id in MOTIF || !!TONES[id as keyof typeof TONES];
}
const at = (t: CosmeticTier, min: CosmeticTier) => tierRank(t) >= tierRank(min);

export interface ColorsFxContext {
  g: G;
  under: G;
  emit: Emit;
  chance: (rate: number, dt: number) => boolean;
  /** Feet. */
  x: number;
  y: number;
  sc: number;
  /** ms */
  now: number;
  dt: number;
  moving: boolean;
  /** A head-and-shoulders thumbnail: glow behind the bust, not underfoot. */
  portrait?: boolean;
}

/** Draw a set's effects for this frame. Returns false for unknown ids. */
export function drawColorsFx(ctx: ColorsFxContext, id: string) {
  if (!isColors(id)) return false;
  const { g, under, emit, chance, x, y, sc, now, dt, moving, portrait } = ctx;
  const tier = cosmeticTier(id);
  const [, mid, light] = colorsTones(id);
  const motif = MOTIF[id] ?? {
    shape: "star" as FxShape,
    rise: -16,
    spread: 26,
  };
  const t = now / 1000;
  const bodyY = y - 30 * sc;
  const drift = (rate: number) => {
    if (!chance(rate, dt)) return;
    emit({
      x: x + (Math.random() - 0.5) * motif.spread * 2 * sc,
      y: bodyY + (Math.random() - 0.4) * 34 * sc,
      vx: (Math.random() - 0.5) * 14,
      vy: motif.rise * (0.7 + Math.random() * 0.6),
      life: 1 + Math.random() * 0.6,
      size: (motif.shape === "pixel" ? 2.4 : 2.2 + Math.random()) * sc,
      color: Math.random() < 0.5 ? mid : light,
      shape: motif.shape,
      spin: (Math.random() - 0.5) * 4,
    });
  };
  // Common: the motif drifts off now and then.
  drift(at(tier, "epic") ? 3.2 : 0.9);
  if (!at(tier, "rare")) return true;
  // Rare: glints twinkle on the body.
  for (let i = 0; i < 3; i++) {
    const phase = (t * 0.7 + i * 0.37) % 1;
    const life = Math.sin(phase * Math.PI) ** 3;
    if (life < 0.05) continue;
    const a = i * 2.4 + Math.floor(t * 0.7 + i * 0.37) * 1.9;
    sparkle(
      g,
      x + Math.cos(a) * 13 * sc,
      bodyY + Math.sin(a * 1.7) * 14 * sc,
      (1.2 + 2.2 * life) * sc,
      i ? light : 0xffffff,
      0.95 * life,
    );
  }
  if (!at(tier, "epic")) return true;
  // Epic: a trail of the motif while running.
  if (moving && chance(10, dt))
    emit({
      x: x + (Math.random() - 0.5) * 16 * sc,
      y: y - Math.random() * 8 * sc,
      vx: (Math.random() - 0.5) * 10,
      vy: -8 - Math.random() * 10,
      life: 0.6,
      size: 2 * sc,
      color: Math.random() < 0.5 ? mid : light,
      shape:
        motif.shape === "coin" || motif.shape === "pebble"
          ? "dot"
          : motif.shape,
    });
  if (!at(tier, "legendary")) return true;
  // Legendary: a soft glow under the feet, and motes rising.
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  if (portrait) {
    under.fillStyle(mid, 0.16 + 0.1 * pulse).fillCircle(x, bodyY, 34 * sc);
    under.fillStyle(light, 0.1 + 0.08 * pulse).fillCircle(x, bodyY, 20 * sc);
  } else {
    under
      .fillStyle(mid, 0.12 + 0.08 * pulse)
      .fillEllipse(x, y, 60 * sc, 20 * sc);
    under
      .fillStyle(light, 0.1 + 0.06 * pulse)
      .fillEllipse(x, y, 34 * sc, 11 * sc);
  }
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.5 + i / 4) % 1;
    const a = i * 1.7 + Math.floor(t * 0.5 + i / 4) * 2.1;
    g.fillStyle(
      i % 2 ? light : mid,
      0.85 * (1 - k) * Math.min(1, k * 6),
    ).fillCircle(
      x + Math.cos(a) * 18 * sc,
      y - 4 * sc - k * 60 * sc,
      (1.3 + (1 - k)) * sc,
    );
  }
  if (!at(tier, "mythic")) return true;
  // Mythic: a prismatic shimmer travelling up the body.
  const band = (t * 0.6) % 1;
  const by = y - band * 64 * sc;
  for (let i = 0; i < 5; i++) {
    const c = PRISM[(i + Math.floor(t * 3)) % PRISM.length];
    g.fillStyle(c, 0.5 * Math.sin(band * Math.PI)).fillCircle(
      x + (i - 2) * 6 * sc,
      by + Math.sin(t * 5 + i) * 2 * sc,
      1.8 * sc,
    );
  }
  return true;
}
