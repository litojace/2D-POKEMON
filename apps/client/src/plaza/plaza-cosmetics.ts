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
 * - a champion skin's own effects, as the match rig draws them
 *   (skin-fx.ts): Rare trails, Epic details and signatures, the Vanguard's
 *   marks, the Mythicals' Awakening;
 * - the Entrance slot when someone arrives (and the skin's own landing),
 *   the Victory slot when they score, finish a lap or dance (and the
 *   skin's own celebration).
 *
 * Sized as everywhere, from the game's one aura size (aura-size.ts),
 * against the fighter's art as the Plaza draws it. On Low graphics an aura keeps its ring and
 * items but not its rarity flourish, and Colors draw no particles; with
 * reduced motion everything holds still, and a skin's effects, entrances
 * and victories (which only move) don't draw at all, as in a match.
 *
 * A crowd costs a phone's GPU: only you and the few nearest to you
 * (WornOptions.full) get a skin's ambient particles and play victory
 * finales; everyone keeps its ornaments (signatures, details), entrances
 * and the skin's own moments.
 */
import type Phaser from "phaser";
import {
  drawCollectionAura,
  drawCollectionAuraBase,
} from "../skins/collection-fx";
import { drawColorsFx, isColors } from "../skins/colors-fx";
import { canvasGraphics } from "../skins/fx-canvas";
import {
  FX_GRAVITY,
  drawAnyParticle,
  drawSkinFx,
  stepParticle,
  type FxParticle,
} from "../skins/skin-fx";
import {
  drawCollectionEntrance,
  drawCollectionVictory,
  playCollectionEntrance,
} from "../skins/collection-fx";
import { rigEntrance, rigVictory } from "../skins/rig-piece-fx";
import { wornArt } from "../skins/skin-art";
import { auraScale } from "../aura-size";
import { footprintScale, groundDrop } from "../ground";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { CREATURE_VIEWBOX, type CreaturePart } from "../creature-design";
import { WORLD_ART } from "../../../../packages/shared/src/world-art";

type G = Phaser.GameObjects.Graphics;
type Ctx = CanvasRenderingContext2D;

/** The Plaza draws a fighter's art (its 200-unit-wide frame) 84 px wide. */
export const PLAZA_SPRITE_PX = 84;
/** Where the art's frame sits on the feet: its top this many sprite widths
 *  above them, its height this many sprite widths (plaza-scene's drawSprite). */
export const PLAZA_SPRITE_TOP = 0.9;
export const PLAZA_SPRITE_TALL = 1.01;
const ART_W = Number(CREATURE_VIEWBOX.split(" ")[2]);
const ART_H = Number(CREATURE_VIEWBOX.split(" ")[3]);
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
/**
 * A champion's ground on the Plaza (ground.ts): how far below the feet its
 * shadow and aura sit (Plaza px), and how much wider they are than the
 * standard footprint. The Plaza's own shadow uses it too (plaza-scene.ts).
 */
export const plazaGround = (id?: string | null) => {
  const known = id && id in CHARACTERS ? (id as CharacterId) : undefined;
  return {
    drop: known ? groundDrop(known) * PLAZA_PX_PER_ART : 0,
    wide: known ? footprintScale(known) : 1,
  };
};
/** Colors' scale (Plaza px per rig unit; a rig unit is two art units). */
export const PLAZA_COLORS_SCALE = PLAZA_PX_PER_ART * 2;
/** At most this many Colors particles per fighter. */
export const PLAZA_FX_CAP = 24;
/** At most this many skin, entrance and victory particles per fighter. */
export const PLAZA_SKIN_FX_CAP = 60;
/** A victory finale plays this long (as the thumbnails loop it). */
export const PLAZA_VICTORY_S = 3.6;
/** The rig's origin in the art (rig units are two art units, centred on
 *  x 100, y 130: animation/rig.ts `mount`). */
const RIG_ART = { x: 100, y: 130 };

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
  /** Velocity (px/s), facing (> 0 right), dashing, stunned. */
  vx?: number;
  vy?: number;
  face?: number;
  dash?: number;
  stun?: number;
  /** How far the walk lifts the picture this frame (px). */
  bob?: number;
  /** The champion, whose skins are its own. */
  character?: string;
  /** A champion skin (wins over Colors). */
  skin?: { skin: string; stage?: number } | null;
  /** The Entrance and Victory slots. */
  entrance?: string | null;
  victory?: string | null;
  /** A skin's effects in play (skinFx). */
  sfx?: SkinFxState;
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
  /** Within the crowd's budget for a skin's ambient particles (you and the
   *  nearest few). */
  full?: boolean;
}
const colorsOn = (b: Wearer) => !b.skin?.skin && isColors(b.colour);
/** Does this fighter wear anything that shows on the Plaza? */
export const wearsFx = (b: Wearer) =>
  !!b.aura ||
  colorsOn(b) ||
  !!b.entrance ||
  !!b.victory ||
  !!(b.character && wornArt(b.character, b.skin));

function aura(g: Ctx, b: Wearer, o: WornOptions, front: boolean) {
  if (!b.aura) return;
  g.save();
  // The champion's ground point and footprint, as everywhere (ground.ts).
  const ground = plazaGround(b.character);
  g.translate(b.x, b.y + ground.drop);
  g.scale(PLAZA_AURA_SCALE * ground.wide, PLAZA_AURA_SCALE * ground.wide);
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
/* ---------- a champion skin's effects, entrances and victories ---------- */

type Op = [string, unknown[]];
const OPS = Symbol("ops");
/**
 * Graphics that keep their calls to draw later. The rig draws a skin's
 * effects once a frame on two layers at the same time (behind and in front
 * of the fighter); the Plaza paints in order on one canvas, so the front
 * layer's calls wait here until the sprite is down. One per fighter, for
 * good: the effects keep their moments (a landing, a celebration) keyed by
 * their front layer.
 */
function recorder(): G {
  const ops: Op[] = [];
  const rec: G = new Proxy({} as G, {
    get: (_t, k) =>
      k === OPS
        ? ops
        : (...args: unknown[]) => {
            // Point lists are copied: an effect may reuse its array.
            ops.push([
              k as string,
              args.map((a) =>
                Array.isArray(a)
                  ? a.map((q) => (q && typeof q === "object" ? { ...q } : q))
                  : a,
              ),
            ]);
            return rec;
          },
  });
  return rec;
}
function replay(rec: G, to: G) {
  const ops = (rec as unknown as Record<symbol, Op[]>)[OPS];
  for (const [k, args] of ops)
    (to as unknown as Record<string, (...a: unknown[]) => unknown>)[k](...args);
  ops.length = 0;
}
export interface SkinFxState {
  /** The front layer (a recorder) and the back one (drawn at once). */
  front: G;
  back: G;
  backOn: Ctx;
  particles: (FxParticle & { age: number })[];
  at: number;
  /** An entrance to play on the next frame. */
  greet: boolean;
  /** When an entrance that draws (Rainbow's arch) started (ms). */
  greetAt: number | null;
  /** When the victory started (ms), and whether its first frame is next. */
  cheerAt: number | null;
  cheerFirst: boolean;
}
const state = (g: Ctx, b: Wearer, now: number) => {
  let s = b.sfx;
  if (!s)
    s = b.sfx = {
      front: recorder(),
      back: canvasGraphics(g) as unknown as G,
      backOn: g,
      particles: [],
      at: now,
      greet: false,
      greetAt: null,
      cheerAt: null,
      cheerFirst: false,
    };
  if (s.backOn !== g) {
    s.back = canvasGraphics(g) as unknown as G;
    s.backOn = g;
  }
  return s;
};
/** The state before the first frame draws it (state() fills in the rest). */
const pending = (b: Wearer) =>
  (b.sfx ??= {
    front: recorder(),
    back: undefined as unknown as G,
    backOn: undefined as unknown as Ctx,
    particles: [],
    at: 0,
    greet: false,
    greetAt: null,
    cheerAt: null,
    cheerFirst: false,
  });
/** Play this fighter's entrance (the Entrance slot, the skin's landing). */
export function greetWearer(b: Wearer) {
  if (b.entrance || b.skin?.skin) pending(b).greet = true;
}
/** Play this fighter's victory (the Victory slot, the skin's celebration). */
export function cheerWearer(b: Wearer, now: number) {
  if (!b.victory && !b.skin?.skin) return;
  const s = pending(b);
  s.cheerAt = now;
  s.cheerFirst = true;
}
/** Where the Plaza draws an art point of this fighter (its picture is the
 *  front art, mirrored to face right). */
function artPoint(b: Wearer, ax: number, ay: number) {
  const feet = b.y - b.z - (b.bob ?? 0);
  const k = PLAZA_SPRITE_PX / ART_W,
    ky = (PLAZA_SPRITE_PX * PLAZA_SPRITE_TALL) / ART_H;
  return {
    x: b.x + (ax - ART_W / 2) * k * ((b.face ?? -1) > 0 ? -1 : 1),
    y: feet - PLAZA_SPRITE_PX * PLAZA_SPRITE_TOP + ay * ky,
  };
}
/** Runs a skin's effects, entrance and victory for this frame: draws the
 *  back layer, keeps the front layer's calls for skinFxFront. */
function skinFx(g: Ctx, b: Wearer, o: WornOptions) {
  const art = b.character ? wornArt(b.character, b.skin) : undefined;
  if (!art && !b.entrance && !b.victory) {
    if (b.sfx) b.sfx.particles.length = 0;
    return;
  }
  const s = state(g, b, o.now);
  if (o.reduced) {
    s.particles.length = 0;
    s.greet = false;
    s.greetAt = null;
    s.cheerAt = null;
    s.at = o.now;
    return;
  }
  const dt = Math.min(0.05, Math.max(0, (o.now - s.at) / 1000));
  s.at = o.now;
  const sc = PLAZA_COLORS_SCALE;
  const origin = artPoint(b, RIG_ART.x, RIG_ART.y),
    head = artPoint(b, 100, 55),
    x = origin.x,
    y = origin.y,
    ground = y + WORLD_ART.fighterFeet * sc;
  const emit = (p: FxParticle) => {
    if (s.particles.length < PLAZA_SKIN_FX_CAP)
      s.particles.push({ ...p, age: 0 });
  };
  const chance = (rate: number, d: number) => Math.random() < rate * d;
  const moving = (b.sp ?? 0) > 10;
  const greeting = s.greet;
  s.greet = false;
  let t = 0,
    celebrating = false;
  if (s.cheerAt != null) {
    t = (o.now - s.cheerAt) / 1000;
    celebrating = s.cheerFirst;
    s.cheerFirst = false;
    if (t > PLAZA_VICTORY_S) s.cheerAt = null;
  }
  if (art)
    drawSkinFx(
      {
        g: s.front,
        under: s.back,
        emit,
        chance,
        x,
        y,
        headX: head.x,
        headY: head.y,
        sc,
        now: o.now,
        dt,
        angle:
          moving && (b.vx || b.vy)
            ? Math.atan2(b.vy ?? 0, b.vx ?? 0)
            : (b.face ?? -1) > 0
              ? 0
              : Math.PI,
        moving,
        dashing: !!b.dash,
        hurt: !!b.stun,
        defeated: false,
        greeting,
        celebrating,
        knockedOut: false,
        ultimate: false,
        ambient: !!o.full && !o.low,
        mount: (_part: CreaturePart, ax: number, ay: number) =>
          artPoint(b, ax, ay),
        facing: "down",
        flat: PLAZA_AURA_FLAT,
      },
      art,
      b.skin?.stage ?? 1,
    );
  if (greeting && b.entrance) {
    const rig = rigEntrance(emit, b.entrance, x, ground, sc);
    playCollectionEntrance(emit, b.entrance, x, y, sc, rig);
    s.greetAt = o.now;
  }
  // An entrance that draws (Rainbow's arch), behind the fighter: like a
  // finale, only for you and the nearest few.
  if (
    s.greetAt != null &&
    !(
      b.entrance &&
      o.full &&
      drawCollectionEntrance(
        s.back,
        b.entrance,
        x,
        y,
        sc,
        (o.now - s.greetAt) / 1000,
      )
    )
  )
    s.greetAt = null;
  // A finale is the heaviest effect: twenty dancing at once halved the
  // Plaza's frame rate (a CPU-drawn canvas, 20 Nov 2026), so only you and
  // the nearest few play it; the rest keep their skin's celebration.
  if (s.cheerAt != null && b.victory && o.full)
    drawCollectionVictory(
      s.front,
      s.back,
      emit,
      chance,
      b.victory,
      x,
      y,
      sc,
      t,
      dt,
      celebrating,
    ) || rigVictory(s.back, b.victory, x, ground, sc, t);
  for (const p of s.particles) stepParticle(p, dt);
  for (let i = s.particles.length - 1; i >= 0; i--)
    if (s.particles[i].age >= s.particles[i].life) s.particles.splice(i, 1);
  for (const p of s.particles)
    if (p.behind) drawAnyParticle(s.back, p, 1 - p.age / p.life);
}
function skinFxFront(g: Ctx, b: Wearer, o: WornOptions) {
  const s = b.sfx;
  if (!s || o.reduced) return;
  const G = gfx(g);
  replay(s.front, G);
  for (const p of s.particles)
    if (!p.behind) drawAnyParticle(G, p, 1 - p.age / p.life);
}

/** What goes behind the fighter: call before drawing its sprite. */
export function drawWornBehind(g: Ctx, b: Wearer, o: WornOptions) {
  aura(g, b, o, false);
  colors(g, b, o, false);
  skinFx(g, b, o);
}
/** What comes round in front of the fighter: call after its sprite. */
export function drawWornFront(g: Ctx, b: Wearer, o: WornOptions) {
  aura(g, b, o, true);
  colors(g, b, o, true);
  skinFxFront(g, b, o);
}
