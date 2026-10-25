import Phaser from "phaser";
import { type RigAsset, type Part, rigKey, wholeKey } from "./assets";
import type { CharacterId } from "@arena/shared";
import type { Facing } from "./controller";

interface BoneWeight {
  part: Part;
  weight: number;
}
interface Point {
  x: number;
  y: number;
  weights: BoneWeight[];
}
interface Surface {
  points: Point[];
  indices: number[];
  vertices: number[];
  uvs: number[];
}
const cache = new WeakMap<Phaser.Scene, Map<string, Surface>>();
const gains: Partial<Record<Part, number>> = {
  armL: 0.32,
  armR: 0.32,
  legL: 0.55,
  legR: 0.55,
  tail: 0.6,
  wings: 0.65,
  ears: 0.65,
  flame: 0.65,
  scarf: 0.65,
};

function alphaMap(scene: Phaser.Scene, asset: RigAsset) {
  const source = scene.textures.get(asset.key).getSourceImage() as
    HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const x = asset.x * 2 + 100 - asset.originX * asset.width;
  const y = asset.y * 2 + 130 - asset.originY * asset.height;
  return { asset, x, y, w: canvas.width, h: canvas.height, rgba };
}

/** Shared, softly weighted topology: adjacent triangles always share positions. */
function surface(
  scene: Phaser.Scene,
  id: CharacterId,
  dir: Facing,
  assets: RigAsset[],
  suffix: string,
) {
  let shared = cache.get(scene);
  if (!shared) cache.set(scene, (shared = new Map()));
  const key = wholeKey(id, dir, "normal", suffix);
  const previous = shared.get(key);
  if (previous) return previous;
  const whole = { ...assets.find((a) => a.key === wholeKey(id, dir))!, key };
  const bx = 100 - whole.originX * whole.width,
    by = 130 - whole.originY * whole.height;
  const cols = Math.ceil(whole.width / 9),
    rows = Math.ceil(whole.height / 9);
  const maps = (
    [
      "tail",
      "wings",
      "legL",
      "legR",
      "body",
      "armL",
      "armR",
      "head",
      "ears",
      "scarf",
      "flame",
    ] as Part[]
  )
    .filter((p) => !(id === "auralynx" && p === "wings"))
    .map((part) => ({
      part,
      ...alphaMap(scene, {
        ...assets.find((a) => a.key === rigKey(id, dir, part))!,
        key: rigKey(id, dir, part, suffix),
      }),
    }));
  // Include eye pixels in the head's weights. Blinks swap the complete image,
  // keeping the face attached instead of collapsing a cut-out iris rectangle.
  maps.push({
    part: "head",
    ...alphaMap(scene, {
      ...assets.find((a) => a.key === rigKey(id, dir, "eyes"))!,
      key: rigKey(id, dir, "eyes", suffix),
    }),
  });
  const full = alphaMap(scene, whole);
  const points: Point[] = [],
    vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col <= cols; col++) {
      const ax = bx + (whole.width * col) / cols,
        ay = by + (whole.height * row) / rows;
      const byPart = new Map<Part, number>();
      for (const m of maps) {
        let weight = 0;
        for (const ox of [-4, 0, 4])
          for (const oy of [-4, 0, 4]) {
            const x = Math.round(((ax + ox - m.x) / m.asset.width) * (m.w - 1)),
              y = Math.round(((ay + oy - m.y) / m.asset.height) * (m.h - 1));
            if (x >= 0 && x < m.w && y >= 0 && y < m.h)
              weight += m.rgba[(y * m.w + x) * 4 + 3];
          }
        if (weight) byPart.set(m.part, (byPart.get(m.part) ?? 0) + weight);
      }
      const picked = [...byPart].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const total = picked.reduce((n, p) => n + p[1], 0);
      const weights = total
        ? picked.map(([part, w]) => ({ part, weight: w / total }))
        : [{ part: "body" as Part, weight: 1 }];
      const x = (ax - 100) * 0.5,
        y = (ay - 130) * 0.5;
      points.push({ x, y, weights });
      vertices.push(x, -y);
      uvs.push(col / cols, row / rows);
    }
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      // Empty transparent cells cost no draw calls or vertex transforms.
      const l = Math.max(0, Math.floor((col / cols) * full.w) - 1),
        r = Math.min(full.w - 1, Math.ceil(((col + 1) / cols) * full.w) + 1);
      const t = Math.max(0, Math.floor((row / rows) * full.h) - 1),
        b = Math.min(full.h - 1, Math.ceil(((row + 1) / rows) * full.h) + 1);
      let painted = false;
      for (let y = t; y <= b && !painted; y++)
        for (let x = l; x <= r; x++)
          if (full.rgba[(y * full.w + x) * 4 + 3]) {
            painted = true;
            break;
          }
      if (!painted) continue;
      const a = row * (cols + 1) + col,
        c = a + cols + 1;
      indices.push(a, c, a + 1, a + 1, c, c + 1);
    }
  const result = { points, vertices, uvs, indices };
  shared.set(key, result);
  return result;
}

/** One continuous illustration, deformed by the existing rig's bone poses. */
type ActiveMesh = Phaser.GameObjects.Mesh & { commit(): void };
function makeMesh(scene: Phaser.Scene, texture: string): ActiveMesh {
  class AnimatedMesh extends Phaser.GameObjects.Mesh {
    commit() {
      super.preUpdate(0, 0);
    }
  }
  return scene.add
    .existing(new AnimatedMesh(scene, 0, 0, texture))
    .setSize(1, 1)
    .setActive(false);
}

export class ContinuousArt {
  private mesh?: ActiveMesh;
  private flat?: Phaser.GameObjects.Image;
  private geometry?: Surface;
  private facing?: Facing;
  private appearance = "";
  private positions = new Float32Array();
  private bones = new Map<
    Part,
    {
      x: number;
      y: number;
      cos: number;
      sin: number;
      sx: number;
      sy: number;
      px: number;
      py: number;
      gain: number;
    }
  >();
  constructor(
    private scene: Phaser.Scene,
    private id: CharacterId,
    private assets: RigAsset[],
    private root: Phaser.GameObjects.Container,
  ) {}
  hide() {
    this.mesh?.setVisible(false);
    this.flat?.setVisible(false);
  }
  render(
    dir: Facing,
    texture: string,
    images: Map<Part, Phaser.GameObjects.Image>,
    reduced: boolean,
    now: number,
    suffix: string,
  ) {
    if (!this.scene.textures.exists(texture)) {
      this.hide();
      return false;
    }
    if (this.scene.game.renderer.type !== Phaser.WEBGL) {
      const asset = this.assets.find((a) => a.key === wholeKey(this.id, dir))!;
      if (!this.flat) {
        this.flat = this.scene.add.image(0, 0, texture);
        this.root.add(this.flat);
      }
      this.flat
        .setVisible(true)
        .setTexture(texture)
        .setOrigin(asset.originX, asset.originY)
        .setScale(0.5, reduced ? 0.5 : 0.5 + Math.sin(now / 550) * 0.004)
        .setTint(images.get("head")!.tintTopLeft);
      return true;
    }
    if (!this.mesh) {
      this.mesh = makeMesh(this.scene, texture);
      this.mesh.setOrtho(1, 1);
      this.mesh.hideCCW = false;
      this.mesh.ignoreDirtyCache = true;
      this.root.add(this.mesh);
    }
    if (dir !== this.facing || suffix !== this.appearance) {
      this.geometry = surface(this.scene, this.id, dir, this.assets, suffix);
      this.facing = dir;
      this.appearance = suffix;
      this.positions = new Float32Array(this.geometry.points.length * 2);
      this.mesh.clear();
      this.mesh.addVertices(
        this.geometry.vertices,
        this.geometry.uvs,
        this.geometry.indices,
      );
    }
    this.mesh.setVisible(true).setTexture(texture).setSize(1, 1);
    for (const [part, image] of images) {
      const asset = this.assets.find(
        (a) => a.key === rigKey(this.id, dir, part),
      )!;
      const gain = gains[part] ?? 1;
      let bone = this.bones.get(part);
      if (!bone)
        this.bones.set(
          part,
          (bone = {
            x: 0,
            y: 0,
            cos: 1,
            sin: 0,
            sx: 1,
            sy: 1,
            px: 0,
            py: 0,
            gain,
          }),
        );
      bone.x = image.x;
      bone.y = image.y;
      bone.cos = Math.cos(image.rotation * gain);
      bone.sin = Math.sin(image.rotation * gain);
      bone.sx = 1 + (image.scaleX * 2 - 1) * gain;
      bone.sy = 1 + (image.scaleY * 2 - 1) * gain;
      bone.px = asset.x;
      bone.py = asset.y;
    }
    const geo = this.geometry!;
    for (let i = 0; i < geo.points.length; i++) {
      const p = geo.points[i];
      let x = 0,
        y = 0;
      for (const w of p.weights) {
        const b = this.bones.get(w.part)!;
        const dx = (p.x - b.px) * b.sx,
          dy = (p.y - b.py) * b.sy;
        x +=
          (b.px + (b.x - b.px) * b.gain + b.cos * dx - b.sin * dy) * w.weight;
        y +=
          (b.py + (b.y - b.py) * b.gain + b.sin * dx + b.cos * dy) * w.weight;
      }
      this.positions[i * 2] = x;
      this.positions[i * 2 + 1] = y;
    }
    const tint = images.get("head")!.tintTopLeft;
    for (let i = 0; i < geo.indices.length; i++) {
      const p = geo.indices[i] * 2,
        v = this.mesh.vertices[i];
      v.x = this.positions[p];
      v.y = -this.positions[p + 1];
      v.color = tint;
    }
    this.mesh.commit();
    return true;
  }
}
