/**
 * The Spire's court in the battle scene (spire-court-art.ts paints it).
 * Everything is drawn into textures before it shows: the zone's floor (a
 * court floor, baked by main.ts's floorTexture), and per floor its sky and
 * an atlas of its blocks, their shadows, the stairs and the carved number.
 * The scene's start paints the floor it starts on (prewarmSpireCourt); a
 * cleared floor paints the next one's while the stairs are open, so a new
 * floor never paints mid-fight. Each frame only places images and sets a
 * few alphas:
 *  - the sky: four images round the court (none behind it);
 *  - per block its shadow and its stone (sorted with the fighters by its
 *    front edge, like the duel courts' blocks), the stairs the same way;
 *  - the number on the floor;
 *  - a few twinkling stars on higher floors (fixed on Low and with reduced
 *    motion), and once the floor is cleared the lit stairs and one glow
 *    through the effects engine.
 * Floor 10 keeps its raid's court; only the sky (the darkest) shows round it.
 */
import type Phaser from "phaser";
import {
  SPIRE_FLOORS,
  spireZoneOf,
  type SpireFloorKind,
} from "../../../packages/shared/src/spire";
import { spireCourtLayout } from "../../../packages/shared/src/spire-court";
import { addCanvasTexture } from "./canvas-texture";
import {
  SPIRE_SKY,
  SPIRE_SKY_K,
  packSpirePieces,
  paintSpireAtlas,
  paintSpireFloor,
  paintLagoonSummitGrade,
  paintSpireSky,
  paintSpireSummitGrade,
  spireFloorPieces,
  spireStairsGlow,
  spireStarSpots,
  spireZoneTheme,
} from "./spire-court-art";
import type { Fx } from "./fx-engine";

/** Atlas pixels per world px (as the Cragmuff pillars: sharp at 2×, small). */
export const SPIRE_ATLAS_K = 1.4;
export interface SpireCourtView {
  zone: number;
  floor: number;
  kind: SpireFloorKind;
}
const atlasKey = (v: SpireCourtView) => `spire-court-${v.zone}-${v.floor}`;
const skyKey = (v: SpireCourtView) => `spire-sky-${v.zone}-${v.floor}`;
type Img = Phaser.GameObjects.Image;
const ADD = 1;

/** Paint a floor's sky and atlas now (cheap if they exist already). */
export function prepareSpireCourt(scene: Phaser.Scene, v: SpireCourtView) {
  const sky = skyKey(v);
  if (!scene.textures.exists(sky)) {
    const S = SPIRE_SKY,
      k = SPIRE_SKY_K;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(S.w * k);
    canvas.height = Math.ceil(S.h * k);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(k, 0, 0, k, -S.x * k, -S.y * k);
      paintSpireSky(ctx, spireZoneTheme(v.zone), v.floor);
    }
    const texture = addCanvasTexture(scene.textures, sky, canvas);
    // Four bands round the court (each reaches 4 px under it: no seams).
    const px = (x: number) => Math.round((x - S.x) * k),
      py = (y: number) => Math.round((y - S.y) * k);
    const band = (
      name: string,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
    ) =>
      texture?.add(name, 0, px(x0), py(y0), px(x1) - px(x0), py(y1) - py(y0));
    band("top", S.x, S.y, S.x + S.w, 4);
    band("bottom", S.x, 896, S.x + S.w, S.y + S.h);
    band("left", S.x, 4, 4, 896);
    band("right", 1596, 4, S.x + S.w, 896);
  }
  const key = atlasKey(v);
  if (!scene.textures.exists(key)) {
    const k = SPIRE_ATLAS_K;
    const pieces = spireFloorPieces(v.zone, v.floor, v.kind, k);
    const packed = packSpirePieces(pieces, k);
    const canvas = document.createElement("canvas");
    canvas.width = packed.width;
    canvas.height = packed.height;
    const ctx = canvas.getContext("2d");
    if (ctx) paintSpireAtlas(ctx, packed.spots, k);
    // A plain image source (canvas-texture.ts): no pixel read-back.
    const texture = addCanvasTexture(scene.textures, key, canvas);
    for (const s of packed.spots)
      texture?.add(s.piece.name, 0, s.x + 1, s.y + 1, s.pw - 2, s.ph - 2);
  }
}
/** The scene is starting on a Spire floor: paint it now, not on its first frame. */
export function prewarmSpireCourt(
  scene: Phaser.Scene,
  v: SpireCourtView | undefined,
) {
  if (v) prepareSpireCourt(scene, v);
}
function pieceFrame(v: SpireCourtView, name: string) {
  // (World frames are recomputed from the art module: stable per floor.)
  return spireFloorPieces(v.zone, v.floor, v.kind, SPIRE_ATLAS_K).find(
    (p) => p.name === name,
  );
}

export class SpireCourtRig {
  private sky: Img[] = [];
  private blocks: { stone: Img; shadow: Img; front: number }[] = [];
  private stairs?: Img;
  private stairsShadow?: Img;
  private number?: Img;
  private stars: { img: Img; phase: number; base: number }[] = [];
  private view?: SpireCourtView;
  private key = "";
  private lit = false;
  private painted = new Map<string, SpireCourtView>();
  /** Front edges of what stands on the court (for the effects' occlusion). */
  fronts: number[] = [];
  constructor(
    private scene: Phaser.Scene,
    private depth: (groundY: number) => number,
  ) {}
  /** Show a floor's court (undefined: hide it all). */
  show(v: SpireCourtView | undefined) {
    const key = v ? `${atlasKey(v)}:${v.kind}` : "";
    if (key === this.key) return;
    this.key = key;
    this.view = v;
    this.clear();
    // Floors painted earlier (the last one, one prepared for a climb that
    // ended) give their memory back.
    for (const [k, old] of this.painted)
      if (!v || k !== atlasKey(v)) {
        this.release(old);
        this.painted.delete(k);
      }
    if (!v) return;
    this.prepare(v);
    const add = this.scene.add;
    const sky = skyKey(v);
    const S = SPIRE_SKY;
    for (const [name, x, y, w, h] of [
      ["top", S.x, S.y, S.w, -S.y + 4],
      ["bottom", S.x, 896, S.w, S.y + S.h - 896],
      ["left", S.x, 4, -S.x + 4, 892],
      ["right", 1596, 4, S.x + S.w - 1596, 892],
    ] as const)
      this.sky.push(
        add
          .image(x, y, sky, name)
          .setOrigin(0)
          .setDisplaySize(w, h)
          .setDepth(-13)
          .setName(`spire-sky-${name}`),
      );
    const atlas = atlasKey(v);
    const place = (name: string, depth: number) => {
      const p = pieceFrame(v, name)!;
      return add
        .image(p.x, p.y, atlas, name)
        .setOrigin(0)
        .setScale(1 / SPIRE_ATLAS_K)
        .setDepth(depth)
        .setName(`spire-${name}`);
    };
    for (const [i, spot] of spireStarSpots(v.floor).entries()) {
      const img = place("star", -12.5)
        .setPosition(spot.x, spot.y)
        .setOrigin(0.5)
        .setScale(spot.size)
        .setBlendMode(ADD);
      this.stars.push({
        img,
        phase: spot.phase + i,
        base: 0.55 + spot.size * 0.25,
      });
    }
    const layout = spireCourtLayout(v.floor, v.kind);
    if (!layout) return;
    // (The height's dusk is in the pieces' stone, painted; main.ts tints the
    // floor. Crystals and the number keep their own light: no tint here.)
    this.number = place("number", -9.8);
    layout.blocks.forEach((o, i) => {
      const front = o.y + o.h;
      this.blocks.push({
        shadow: place(`shadow${i}`, -9.5),
        stone: place(`block${i}`, this.depth(front)),
        front,
      });
    });
    this.stairsShadow = place("stairs-shadow", -9.5);
    const sf = 372 + 156;
    this.stairs = place("stairs", this.depth(sf));
    this.lit = false;
    this.fronts = [...this.blocks.map((b) => b.front), sf];
  }
  /** Paint the next floor ahead of time (the stairs are open: no fight on). */
  prepare(v: SpireCourtView) {
    prepareSpireCourt(this.scene, v);
    this.painted.set(atlasKey(v), v);
  }
  /**
   * Each frame: the stairs light once the floor is cleared (and one glow in
   * the arch, through the effects engine); the stars twinkle.
   */
  update(
    now: number,
    cleared: boolean,
    reduced: boolean,
    low: boolean,
    fx: Fx,
  ) {
    if (!this.view) return;
    if (this.stairs && cleared !== this.lit) {
      this.lit = cleared;
      this.stairs.setFrame(cleared ? "stairs-lit" : "stairs");
    }
    if (this.stairs && cleared) {
      const g = spireStairsGlow();
      const pulse = reduced ? 1 : 0.8 + 0.2 * Math.sin(now / 260);
      fx.at(372 + 156);
      fx.glow(g.x, g.y, 46, spireZoneTheme(this.view.zone).glow, 0.55 * pulse);
      fx.at(null);
    }
    for (const s of this.stars)
      s.img.setAlpha(
        reduced || low
          ? s.base
          : s.base * (0.55 + 0.45 * Math.sin(now / 520 + s.phase)),
      );
  }
  private clear() {
    for (const img of [
      ...this.sky,
      ...this.blocks.flatMap((b) => [b.stone, b.shadow]),
      ...this.stars.map((s) => s.img),
      this.stairs,
      this.stairsShadow,
      this.number,
    ])
      img?.destroy();
    this.sky = [];
    this.blocks = [];
    this.stars = [];
    this.stairs = this.stairsShadow = this.number = undefined;
    this.fronts = [];
  }
  /** Drop a floor's textures nothing shows any more (canvas memory back now). */
  private release(v: SpireCourtView) {
    for (const key of [atlasKey(v), skyKey(v)]) {
      if (!this.scene.textures.exists(key)) continue;
      const source = this.scene.textures.get(key).getSourceImage();
      this.scene.textures.remove(key);
      if (source instanceof HTMLCanvasElement) source.width = source.height = 0;
    }
  }
  destroy() {
    this.clear();
  }
}

/**
 * The court a snapshot's climb is on (undefined: not a Spire room). Its
 * zone (its look: spireZoneTheme) is the snapshot's when it carries one,
 * else the floor's (floors 11-20: zone 2).
 */
export function spireCourtView(
  raid:
    | { spire?: { floor: number; kind: SpireFloorKind; zone?: number } }
    | undefined,
): SpireCourtView | undefined {
  const s = raid?.spire;
  if (!s) return undefined;
  return { zone: s.zone ?? spireZoneOf(s.floor), floor: s.floor, kind: s.kind };
}
/**
 * The floor after `v` (painted while the stairs are open). A floor not in
 * SPIRE_FLOORS takes its place in its zone (10th: boss, 5th: elite, else
 * waves); the caller only asks for floors the party may climb to.
 */
export function nextSpireCourtView(
  v: SpireCourtView,
): SpireCourtView | undefined {
  const floor = v.floor + 1,
    next = SPIRE_FLOORS[floor];
  if (next) return { zone: next.zone, floor, kind: next.kind };
  const place = ((floor - 1) % 10) + 1;
  return {
    zone: spireZoneOf(floor),
    floor,
    kind: place === 10 ? "boss" : place === 5 ? "elite" : "wave",
  };
}
/** A boss floor's court texture by its raid's arena (the lagoon: floor 20's). */
export const spireSummitFloorOf = (arena: string) =>
  arena === "lagoon" ? SPIRE_LAGOON_SUMMIT_FLOOR : SPIRE_SUMMIT_FLOOR;
/** A Spire floor texture id ("spire-z1": the zone's platform floor). */
export const spireFloorId = (v: SpireCourtView) => `spire-z${v.zone}`;
export const isSpireFloorId = (id: string) => /^spire-z\d+$/.test(id);
/** Paint a Spire floor texture (1600 × 900 world px, context pre-scaled). */
export function paintSpireFloorId(ctx: CanvasRenderingContext2D, id: string) {
  paintSpireFloor(ctx, spireZoneTheme(Number(id.slice(7)) || 1));
}
/** The boss floor's court: its raid's picture, with the summit grade. */
export const SPIRE_SUMMIT_FLOOR = "spire-summit";
/** Floor 20's: Tidelotl's lagoon, with its own (night-sea) summit grade. */
export const SPIRE_LAGOON_SUMMIT_FLOOR = "spire-summit-lagoon";
/** A boss floor's court texture id, by its zone (unknown zones: zone 1's). */
export const spireSummitFloorId = (zone: number) =>
  zone === 2 ? SPIRE_LAGOON_SUMMIT_FLOOR : SPIRE_SUMMIT_FLOOR;
export const isSpireSummitFloorId = (id: string) =>
  id === SPIRE_SUMMIT_FLOOR || id === SPIRE_LAGOON_SUMMIT_FLOOR;
/** The raid picture under a summit floor, and its grade. */
export function spireSummitArt(id: string) {
  return id === SPIRE_LAGOON_SUMMIT_FLOOR
    ? { picture: "lagoon" as const, grade: paintLagoonSummitGrade }
    : { picture: "raid-coliseum" as const, grade: paintSpireSummitGrade };
}
