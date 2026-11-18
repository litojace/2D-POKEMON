/*
 * The Plaza: what each fighter wears, shown off. The Plaza is where players
 * meet, so the wardrobe's effects show here as in a match, the Lobby and the
 * Shop, drawn by the same code (collection-fx.ts, colors-fx.ts) through the
 * plain-canvas stand-in for Phaser's Graphics (fx-canvas.ts):
 *
 * - the Aura slot: its ring on the fighter's shadow, its items circling
 *   behind the fighter on the far half and in front on the near half;
 * - Colors (the Skin slot's palettes, unless a champion skin is worn): their
 *   motif drifting up round the fighter, and their tier's extras.
 *
 * Sized as everywhere, from the game's one aura size (aura-size.ts),
 * against the fighter's art as the Plaza draws it. On Low graphics an aura keeps its ring and
 * items but not its rarity flourish, and Colors draw no particles; with
 * reduced motion everything holds still.
 */
import type Phaser from "phaser";
import {
  drawCollectionAura,
  drawCollectionAuraBase,
} from "../skins/collection-fx";
import { drawColorsFx, isColors } from "../skins/colors-fx";
import { canvasGraphics } from "../skins/fx-canvas";
import { FX_GRAVITY, drawAnyParticle, type FxParticle } from "../skins/skin-fx";
import { auraScale } from "../aura-size";
import { CREATURE_VIEWBOX } from "../creature-design";

type G = Phaser.GameObjects.Graphics;
type Ctx = CanvasRenderingContext2D;

/** The Plaza draws a fighter's art (its 200-unit-wide frame) 84 px wide. */
export const PLAZA_SPRITE_PX = 84;
const ART_W = Number(CREATURE_VIEWBOX.split(" ")[2]);
/** Plaza px per art unit. */
export const PLAZA_PX_PER_ART = PLAZA_SPRITE_PX / ART_W;
/** Plaza px per aura unit: the game's one aura size (aura-size.ts). */
/**
 * The Plaza shows fighters small (a crowd on a phone), so its auras are
 * drawn this much bigger than the game's one size, to be seen (the owner
 * chose 1.35 over 1.7, 18 Nov 2026: clear, and still tidy in a crowd).
 */
export const PLAZA_AURA_BOOST = 1.35;
export const PLAZA_AURA_SCALE = auraScale(PLAZA_PX_PER_ART) * PLAZA_AURA_BOOST;
/** The shadow's flatness (24 × 9 radii): the aura lies on the same plane. */
export const PLAZA_AURA_FLAT = 18 / 48;
/** Colors' scale (Plaza px per rig unit; a rig unit is two art units). */
export const PLAZA_COLORS_SCALE = PLAZA_PX_PER_ART * 2;
/** At most this many Colors particles per fighter. */
export const PLAZA_FX_CAP = 24;

/** Graphics that draw nothing: the half of an effect drawn at the other time. */
const NONE = new Proxy({}, { get: () => () => NONE }) as unknown as G;
const graphics = new WeakMap<Ctx, G>();
const gfx = (g: Ctx) => {
  let out = graphics.get(g);
  if (!out) {
    out = canvasGraphics(g) as unknown as G;
    graphics.set(g, out);
  }
  return out;
};

/** A fighter on the Plaza, as far as its worn effects go. */
export interface Wearer {
  x: number;
  y: number;
  z: number;
  /** Walking speed (px/s). */
  sp?: number;
  /** A champion skin (wins over Colors). */
  skin?: { skin: string } | null;
  /** The Skin slot's palette (Colors). */
  colour?: string | null;
  /** The Aura slot. */
  aura?: string | null;
  /** Colors particles in flight (world px, around the fighter's feet). */
  fx?: (FxParticle & { age: number })[];
  fxAt?: number;
}
export interface WornOptions {
  /** ms */
  now: number;
  reduced: boolean;
  low: boolean;
}
const colorsOn = (b: Wearer) => !b.skin?.skin && isColors(b.colour);
/** Does this fighter wear anything that shows on the Plaza? */
export const wearsFx = (b: Wearer) => !!b.aura || colorsOn(b);

function aura(g: Ctx, b: Wearer, o: WornOptions, front: boolean) {
  if (!b.aura) return;
  g.save();
  g.translate(b.x, b.y);
  g.scale(PLAZA_AURA_SCALE, PLAZA_AURA_SCALE);
  const G = gfx(g);
  const draw = o.low ? drawCollectionAuraBase : drawCollectionAura;
  // Behind: the ring and the far items; in front: the near items only.
  draw(
    front ? NONE : G,
    b.aura,
    0,
    0,
    o.now,
    o.reduced,
    front ? G : NONE,
    PLAZA_AURA_FLAT,
  );
  g.restore();
}
function colors(g: Ctx, b: Wearer, o: WornOptions, front: boolean) {
  if (!colorsOn(b)) return;
  const G = gfx(g);
  const particles = (b.fx ??= []);
  if (!front) {
    // Move the particles on once a frame (here, before the fighter).
    const dt = Math.min(0.05, Math.max(0, (o.now - (b.fxAt ?? o.now)) / 1000));
    b.fxAt = o.now;
    if (!o.reduced)
      for (const p of particles) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (FX_GRAVITY[p.shape] ?? 0) * dt;
      }
    for (let i = particles.length - 1; i >= 0; i--)
      if (particles[i].age >= particles[i].life) particles.splice(i, 1);
    drawColorsFx(
      {
        g: NONE,
        under: G,
        emit: (p) => {
          if (!o.low && particles.length < PLAZA_FX_CAP)
            particles.push({ ...p, age: 0 });
        },
        chance: (rate, d) => !o.reduced && Math.random() < rate * d,
        x: b.x,
        y: b.y - b.z,
        sc: PLAZA_COLORS_SCALE,
        now: o.reduced ? 0 : o.now,
        dt,
        moving: (b.sp ?? 0) > 10,
      },
      b.colour!,
    );
  } else
    drawColorsFx(
      {
        g: G,
        under: NONE,
        emit: () => {},
        chance: () => false,
        x: b.x,
        y: b.y - b.z,
        sc: PLAZA_COLORS_SCALE,
        now: o.reduced ? 0 : o.now,
        dt: 0,
        moving: (b.sp ?? 0) > 10,
      },
      b.colour!,
    );
  for (const p of particles)
    if (!!p.behind !== front) drawAnyParticle(G, p, 1 - p.age / p.life);
}
/** What goes behind the fighter: call before drawing its sprite. */
export function drawWornBehind(g: Ctx, b: Wearer, o: WornOptions) {
  aura(g, b, o, false);
  colors(g, b, o, false);
}
/** What comes round in front of the fighter: call after its sprite. */
export function drawWornFront(g: Ctx, b: Wearer, o: WornOptions) {
  aura(g, b, o, true);
  colors(g, b, o, true);
}
