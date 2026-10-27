import type Phaser from "phaser";
export interface BossWarp {
  whole?: "wings" | "tendrils" | "body";
  fadeEdges?: boolean;
  axis: "x" | "y";
  bend: number;
  flutter: number;
  phase: number;
}
/** A continuous skin, pinned around the anatomical joint. Adjacent cells share
 * vertices and UV edges; bending never moves independently clipped image bands. */
export function bossSkinPoint(
  u: number,
  v: number,
  ox: number,
  oy: number,
  w: number,
  h: number,
  warp: BossWarp,
) {
  if (warp.whole) {
    const side = Math.abs(u - ox);
    const wingWeight = Math.pow(
      Math.max(0, Math.min(1, (side - 0.14) / 0.35)),
      2,
    );
    const lower = Math.max(0, Math.min(1, (v - 0.35) / 0.5));
    const pin = Math.min(1, Math.abs(v - oy) * 5);
    const weight =
      warp.whole === "wings"
        ? wingWeight
        : warp.whole === "tendrils"
          ? lower
          : pin;
    return {
      x:
        (u - ox) * w +
        w *
          (warp.whole === "tendrils" ? 0.025 : 0.009) *
          weight *
          Math.sin(warp.phase - v * 3.3),
      y:
        (v - oy) * h +
        h *
          (warp.whole === "wings" ? 0.045 : 0.015) *
          weight *
          Math.sin(warp.phase - side * 4 - v * 2),
    };
  }
  const axis = warp.axis === "x" ? u : v,
    root = warp.axis === "x" ? ox : oy;
  const distance = Math.abs(axis - root) / Math.max(root, 1 - root, 0.01);
  const t = Math.max(0, Math.min(1, (distance - 0.12) / 0.88));
  const weight = t * t * (3 - 2 * t);
  return {
    x:
      (u - ox) * w +
      w * warp.bend * weight * Math.sin(warp.phase - distance * 3.2),
    y:
      (v - oy) * h +
      h *
        warp.flutter *
        weight *
        Math.sin(warp.phase - distance * 4.1 + u * 0.7),
  };
}
const fadeTint = (tint: number, u: number, v: number) => {
  const fade = Math.min(1, Math.max(0, Math.min(u, v, 1 - u, 1 - v) / 0.14));
  return ((Math.round((tint >>> 24) * fade) << 24) | (tint & 0xffffff)) >>> 0;
};
type Matrix = Phaser.GameObjects.Components.TransformMatrix;
type Render = (
  renderer: Phaser.Renderer.WebGL.WebGLRenderer,
  src: Phaser.GameObjects.Image,
  camera: Phaser.Cameras.Scene2D.Camera,
  parent?: Matrix,
) => void;
type SkinImage = Phaser.GameObjects.Image & { renderWebGL: Render };
interface Skin {
  warp?: BossWarp;
  native: Render;
  vertices: Float32Array;
}
const skins = new WeakMap<Phaser.GameObjects.Image, Skin>();
export function bossSkinAudit(image: Phaser.GameObjects.Image) {
  const skin = skins.get(image);
  return skin
    ? { warp: skin.warp, vertices: Array.from(skin.vertices) }
    : undefined;
}

export function setBossSkin(
  image: Phaser.GameObjects.Image,
  warp: BossWarp | undefined,
) {
  let skin = skins.get(image);
  if (!skin) {
    const source = image as SkinImage;
    skin = {
      native: source.renderWebGL,
      vertices: new Float32Array(7 * 7 * 2),
    };
    skins.set(image, skin);
    const own = skin;
    const cam = image.getLocalTransformMatrix(),
      sprite = image.getLocalTransformMatrix(),
      calc = image.getLocalTransformMatrix();
    source.renderWebGL = (renderer, src, camera, parent) => {
      if (!own.warp || (!own.warp.bend && !own.warp.flutter))
        return own.native.call(src, renderer, src, camera, parent);
      camera.addToRenderList(src);
      const pipeline = renderer.pipelines.set(
        src.pipeline,
        src,
      ) as Phaser.Renderer.WebGL.Pipelines.MultiPipeline;
      sprite.applyITRS(src.x, src.y, src.rotation, src.scaleX, src.scaleY);
      cam.copyFrom((camera as unknown as { matrix: Matrix }).matrix);
      if (parent)
        cam.multiplyWithOffset(
          parent,
          -camera.scrollX * src.scrollFactorX,
          -camera.scrollY * src.scrollFactorY,
        );
      else {
        sprite.e -= camera.scrollX * src.scrollFactorX;
        sprite.f -= camera.scrollY * src.scrollFactorY;
      }
      cam.multiply(sprite, calc);
      const f = src.frame,
        w = f.cutWidth,
        h = f.cutHeight,
        N = 6,
        verts = own.vertices;
      for (let iy = 0; iy <= N; iy++)
        for (let ix = 0; ix <= N; ix++) {
          const p = bossSkinPoint(
              ix / N,
              iy / N,
              src.originX,
              src.originY,
              w,
              h,
              own.warp,
            ),
            offset = (iy * (N + 1) + ix) * 2;
          verts[offset] = calc.getX(p.x, p.y);
          verts[offset + 1] = calc.getY(p.x, p.y);
        }
      const alpha = Math.max(0, Math.min(1, camera.alpha * src.alpha));
      const tint =
        (((Math.round(alpha * 255) & 255) << 24) | src.tintTopLeft) >>> 0;
      renderer.pipelines.preBatch(src);
      let unit = pipeline.setGameObject(src, f);
      for (let iy = 0; iy < N; iy++)
        for (let ix = 0; ix < N; ix++) {
          const tl = (iy * (N + 1) + ix) * 2,
            bl = tl + (N + 1) * 2,
            br = bl + 2,
            tr = tl + 2;
          const u0 = f.u0 + (f.u1 - f.u0) * (src.flipX ? 1 - ix / N : ix / N),
            u1 =
              f.u0 +
              (f.u1 - f.u0) * (src.flipX ? 1 - (ix + 1) / N : (ix + 1) / N);
          const v0 = f.v0 + ((f.v1 - f.v0) * iy) / N,
            v1 = f.v0 + ((f.v1 - f.v0) * (iy + 1)) / N;
          const flushed = pipeline.batchQuad(
            src,
            verts[tl],
            verts[tl + 1],
            verts[bl],
            verts[bl + 1],
            verts[br],
            verts[br + 1],
            verts[tr],
            verts[tr + 1],
            u0,
            v0,
            u1,
            v1,
            own.warp.fadeEdges ? fadeTint(tint, ix / N, iy / N) : tint,
            own.warp.fadeEdges ? fadeTint(tint, (ix + 1) / N, iy / N) : tint,
            own.warp.fadeEdges ? fadeTint(tint, ix / N, (iy + 1) / N) : tint,
            own.warp.fadeEdges
              ? fadeTint(tint, (ix + 1) / N, (iy + 1) / N)
              : tint,
            src.tintFill,
            f.glTexture,
            unit,
          );
          if (flushed) unit = pipeline.setGameObject(src, f);
        }
      renderer.pipelines.postBatch(src);
    };
  }
  skin.warp = warp;
}
