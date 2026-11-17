import type { CharacterId } from "@arena/shared";
import type { Facing } from "../animation/controller";
import type { CreaturePart } from "../creature-design";
import type { SkinArt } from "./skin-art";
import type { FxContext } from "./skin-fx";
import { EPIC_SIGNATURES, type EpicSignature } from "./epic-signatures";
import {
  CLASSIC_GLYPHS,
  HERO_GLYPHS,
  CARNIVAL_GLYPHS,
  type FxGlyph,
  type FxPoint,
} from "./epic-glyphs";

export interface EpicFxPrimitive {
  kind: "path" | "dot" | "ring";
  plane: "ground" | "rig";
  part: CreaturePart;
  anchor: FxPoint;
  points: FxPoint[];
  closed: boolean;
  radius: number;
  color: number;
  alpha: number;
  width: number;
  essential: boolean;
}
export interface EpicFxState {
  now: number;
  facing: Facing;
  moving: boolean;
  dashing: boolean;
  ambient: boolean;
  angle?: number;
}
const TAU = Math.PI * 2;
const NEAR_WRIST = { down: 129, left: 109.46, right: 90.54, up: 124 } as const;
const bright = (c: number, t = 0.12) =>
  [16, 8, 0].reduce(
    (out, shift) =>
      out | (Math.round(((c >> shift) & 255) * (1 - t) + 255 * t) << shift),
    0,
  );
const RGB_SHADOW = 0x15243c;
const polygon = (points: readonly FxPoint[], closed = false): FxGlyph => ({
  kind: "path",
  points,
  closed,
});
const ring = (radius: number): FxGlyph => ({
  kind: "ring",
  points: [[0, 0]],
  radius,
});
const circ = (x: number, y: number, radius: number): FxGlyph => ({
  kind: "dot",
  points: [[x, y]],
  radius,
});
function glyphs(spec: EpicSignature) {
  return spec.family === "signature"
    ? CLASSIC_GLYPHS[spec.champion]
    : spec.family === "carnival"
      ? CARNIVAL_GLYPHS[spec.champion]
      : HERO_GLYPHS[spec.champion];
}
/** Shared, deterministic frame plan: rendered by battle Graphics, Plaza's
 * existing Canvas and the review. Nothing allocates a scene object or emits
 * idle particles. Low retains the recognisable primary emblem. */
export function epicSignatureFrame(
  skin: string,
  state: EpicFxState,
  art: SkinArt,
): EpicFxPrimitive[] {
  const spec = EPIC_SIGNATURES[skin];
  if (!spec) return [];
  const { family, champion, ordinal } = spec,
    phase = (state.now / 3600 + ordinal * 0.071) % 1;
  const wave = Math.sin(phase * TAU),
    glow = bright(
      art.skill ?? parseInt((art.palette.glow ?? "#d8efff").slice(1), 16),
    ),
    warm = bright(glow, 0.3);
  const out: EpicFxPrimitive[] = [];
  const add = (
    glyph: FxGlyph,
    plane: EpicFxPrimitive["plane"],
    anchor: FxPoint,
    part: CreaturePart,
    size: number,
    rotation: number,
    alpha: number,
    essential: boolean,
    color = glow,
    dx = 0,
    dy = 0,
  ) => {
    const co = Math.cos(rotation),
      si = Math.sin(rotation);
    out.push({
      kind: glyph.kind,
      plane,
      anchor,
      part,
      points: glyph.points.map(([x, y]) => [
        dx + (x * co - y * si) * size,
        dy + (x * si + y * co) * size,
      ]),
      closed: !!glyph.closed,
      radius: (glyph.radius ?? 0) * size,
      color,
      alpha,
      width: essential ? 1.35 : 1.2,
      essential,
    });
  };
  const ground = (
    glyph: FxGlyph,
    size = 1,
    rotation = 0,
    alpha = 0.72,
    essential = true,
    color = glow,
    dx = 0,
    dy = 0,
  ) =>
    add(
      glyph,
      "ground",
      [0, 0],
      "body",
      size,
      rotation,
      alpha,
      essential,
      color,
      dx,
      dy,
    );
  const scale =
    family === "cyber"
      ? 0.85
      : family === "abyssal"
        ? 0.8
        : family === "carnival"
          ? 0.83
          : 0.95;
  // Constant contrast: never a fleeting <1px glint as the only identity.
  for (const glyph of glyphs(spec)) ground(glyph, scale, 0, 0.78 + 0.16 * wave);
  if (family === "cyber") {
    ground(
      polygon([
        [-11, -4],
        [-11, -10],
        [-4, -10],
      ]),
      1,
      0,
      0.76,
    );
    ground(
      polygon([
        [11, 4],
        [11, 10],
        [4, 10],
      ]),
      1,
      0,
      0.76,
    );
  } else if (family === "abyssal") ground(ring(11), 1, 0, 0.56);
  else if (family === "carnival")
    ground(
      polygon([
        [-12, 3],
        [-11, 10],
        [-5, 7],
        [0, 12],
        [5, 7],
        [11, 10],
        [12, 3],
      ]),
      1,
      0,
      0.6,
    );
  else if (family === "vanguard")
    ground(
      polygon([
        [-11, -7],
        [-11, 3],
        [0, 13],
        [11, 3],
        [11, -7],
      ]),
      1,
      0,
      0.64,
    );
  if (!state.ambient) return out;
  // A second, larger personal effect lives beside the near wrist, below the
  // face. It is an actual emblem/prop, not another generic ground ring.
  const side = state.facing === "right" ? -1 : 1;
  const wrist = NEAR_WRIST[state.facing];
  const anchor: FxPoint = [
    wrist + side * 20,
    150 + Math.sin(phase * TAU) * 2.5,
  ];
  const baseRotation =
    family === "cyber"
      ? 0
      : family === "carnival"
        ? Math.sin(phase * TAU) * 0.32
        : family === "abyssal"
          ? Math.sin(phase * TAU) * 0.12
          : Math.sin(phase * TAU) * 0.1;
  const floating = (
    g: FxGlyph,
    size = 1,
    rotation = baseRotation,
    alpha = 0.83,
    color = glow,
    dx = 0,
    dy = 0,
  ) =>
    add(g, "rig", anchor, "armR", size, rotation, alpha, false, color, dx, dy);
  // A small translucent backing makes the shape readable on bright water,
  // stone and grass without using a blur texture or a full fighter glow.
  floating(circ(0, 0, 10), 1, 0, 0.1, glow);
  for (const g of glyphs(spec)) floating(g, 1, baseRotation, 0.85, warm);
  if (family === "cyber") {
    floating(
      polygon([
        [-10, -4],
        [-10, -10],
        [-4, -10],
      ]),
      1,
      0,
      0.8,
      glow,
    );
    floating(
      polygon([
        [10, 4],
        [10, 10],
        [4, 10],
      ]),
      1,
      0,
      0.8,
      glow,
    );
    floating(
      polygon([
        [-8, -8 + phase * 16],
        [8, -8 + phase * 16],
      ]),
      1,
      0,
      0.5,
      glow,
    );
  } else if (family === "abyssal") {
    floating(ring(11), 1, 0, 0.62, glow);
    for (let i = 0; i < 2; i++) {
      const k = (phase + i * 0.5) % 1;
      floating(
        ring(1.4 + i * 0.4),
        1,
        0,
        0.65 * (1 - k),
        warm,
        side * (8 + i * 3),
        5 - k * 16,
      );
    }
  } else if (family === "carnival") {
    floating(
      polygon([
        [-11, 0],
        [-9, 7],
        [-4, 9],
        [0, 7],
        [5, 9],
        [9, 7],
        [11, 0],
      ]),
      1,
      baseRotation,
      0.7,
      glow,
    );
    const a = phase * TAU;
    floating(
      polygon(
        [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ],
        true,
      ),
      1.8,
      a,
      0.9,
      warm,
      Math.cos(a) * 12,
      Math.sin(a) * 7,
    );
  } else if (family === "vanguard") {
    floating(
      polygon([
        [-10, -8],
        [-10, 4],
        [0, 12],
        [10, 4],
        [10, -8],
      ]),
      1,
      0,
      0.7,
      glow,
    );
    floating(circ(-10 + phase * 20, 7, 1.5), 1, 0, 0.85, warm);
  } else {
    // The original Epic's motif dictates its motion: rising forge sparks,
    // flowing aurora, ticking cogs, drifting paper, growing sap and seedlings.
    const rises = ["cindrake", "duskveil", "pyranda", "pangrove"].includes(
      champion,
    );
    const spins = ["mystowl", "coilemur", "sunbara"].includes(champion);
    const ax = spins
      ? Math.cos(phase * TAU) * 11
      : side * (8 + Math.sin(phase * TAU) * 2);
    const ay = rises ? 7 - phase * 18 : Math.sin(phase * TAU) * 7;
    floating(
      ring(rises ? 1.8 : 2.3),
      1,
      0,
      rises ? 0.7 * (1 - phase) : 0.62,
      glow,
      ax,
      ay,
    );
    if (champion === "mystowl")
      floating(
        polygon([
          [0, 0],
          [Math.sin(phase * TAU) * 5, -Math.cos(phase * TAU) * 5],
        ]),
        1,
        0,
        0.9,
        warm,
      );
  }
  // The themed wake consists of at most two short vector marks, rather than
  // a new emitter. It has no cost while idle and uses the same quality cap.
  if (state.moving || state.dashing) {
    const stride = state.dashing ? 1.4 : 1;
    for (let i = 0; i < 2; i++) {
      const k = (phase + i * 0.5) % 1,
        dist = (8 + k * 16) * stride;
      const themedStamp =
        family === "abyssal"
          ? ring(2.3)
          : family === "cyber"
            ? polygon([
                [-3, 0],
                [3, 0],
                [3, 3],
              ])
            : family === "carnival"
              ? polygon(
                  [
                    [-2, -1],
                    [2, -1],
                    [1, 2],
                    [-2, 2],
                  ],
                  true,
                )
              : family === "vanguard"
                ? polygon([
                    [-3, -2],
                    [0, 1],
                    [3, -2],
                  ])
                : glyphs(spec)[0];
      const personal = i === 0;
      const stamp = personal ? glyphs(spec)[0] : themedStamp;
      // Stamp positions follow movement, independently of attack facing.
      ground(
        stamp,
        personal || family === "signature" ? 0.48 : 0.85,
        0,
        0.58 * (1 - k),
        false,
        glow,
        -dist,
        (i ? 1 : -1) * 3,
      );
    }
  }
  if (state.moving || state.dashing) {
    const angle =
      state.angle ??
      (state.facing === "down"
        ? Math.PI / 2
        : state.facing === "up"
          ? -Math.PI / 2
          : state.facing === "left"
            ? Math.PI
            : 0);
    const co = Math.cos(angle),
      si = Math.sin(angle);
    for (const mark of out.slice(-2))
      mark.points = mark.points.map(([x, y]) => [
        x * co - y * si,
        x * si + y * co,
      ]);
  }
  return out;
}
function traceGraphics(
  g: FxContext["g"],
  mark: EpicFxPrimitive,
  points: { x: number; y: number }[],
  radius: number,
  alpha: number,
  width: number,
  color: number,
) {
  if (mark.kind === "dot")
    g.fillStyle(color, alpha).fillCircle(points[0].x, points[0].y, radius);
  else if (mark.kind === "ring") {
    const ry = mark.plane === "ground" ? radius * 0.55 : radius;
    g.lineStyle(width, color, alpha).strokeEllipse(
      points[0].x,
      points[0].y,
      radius * 2,
      ry * 2,
    );
  } else g.lineStyle(width, color, alpha).strokePoints(points, mark.closed);
}
export function drawEpicSkinFx(ctx: FxContext, skin: string, art: SkinArt) {
  if (ctx.defeated) return;
  const marks = epicSignatureFrame(
    skin,
    {
      now: ctx.now,
      facing: ctx.facing ?? "down",
      moving: ctx.moving,
      dashing: ctx.dashing,
      ambient: ctx.ambient,
      angle: ctx.travelAngle ?? ctx.angle,
    },
    art,
  );
  const sc = ctx.sc,
    flat = ctx.flat ?? 0.55;
  for (const mark of marks) {
    const g = mark.plane === "ground" ? ctx.under : ctx.g;
    const points = mark.points.map(([x, y]) =>
      mark.plane === "ground"
        ? { x: ctx.x + x * sc, y: ctx.y + 4 * sc + y * sc * flat }
        : (ctx.mount?.(
            mark.part,
            mark.anchor[0] + x * 2,
            mark.anchor[1] + y * 2,
          ) ?? {
            x: ctx.x + (mark.anchor[0] - 100) * sc * 0.5 + x * sc,
            y: ctx.y + (mark.anchor[1] - 172) * sc * 0.5 + y * sc,
          }),
    );
    if (
      ctx.ambient &&
      mark.plane === "rig" &&
      mark.kind === "path" &&
      mark.closed
    )
      g.fillStyle(mark.color, mark.alpha * 0.2).fillPoints(points, true);
    if (ctx.ambient && mark.kind !== "dot")
      traceGraphics(
        g,
        mark,
        points,
        mark.radius * sc,
        mark.alpha * 0.3,
        3.4 * sc,
        RGB_SHADOW,
      );
    traceGraphics(
      g,
      mark,
      points,
      mark.radius * sc,
      mark.alpha,
      Math.max(0.8, mark.width * sc),
      mark.color,
    );
  }
}
/** Review-only SVG: game textures stay static and the real rig draws the
 * effects through Graphics. This represents the exact same frame geometry. */
export function epicFxSvg(
  skin: string,
  state: EpicFxState,
  art: SkinArt,
  animated = false,
) {
  let under = "",
    over = "";
  for (const [i, m] of epicSignatureFrame(skin, state, art).entries()) {
    const convert = ([x, y]: FxPoint): FxPoint =>
      m.plane === "ground"
        ? [100 + x * 2, 180 + y * 1.1]
        : [m.anchor[0] + x * 2, m.anchor[1] + y * 2];
    const pts = m.points.map(convert),
      c = "#" + m.color.toString(16).padStart(6, "0"),
      sw = m.width * 2;
    const shadow = `stroke="#15243c" stroke-width="${sw + 3}" opacity="${m.alpha * 0.3}"`;
    const path =
      m.kind === "path"
        ? `<path d="${pts.map(([x, y], j) => `${j ? "L" : "M"}${x} ${y}`).join("")}${m.closed ? "Z" : ""}" fill="${m.closed && m.plane === "rig" ? c : "none"}" fill-opacity=".2" stroke="${c}" stroke-width="${sw}"/>`
        : m.kind === "ring"
          ? `<ellipse cx="${pts[0][0]}" cy="${pts[0][1]}" rx="${m.radius * 2}" ry="${m.radius * (m.plane === "ground" ? 1.1 : 2)}" fill="none" stroke="${c}" stroke-width="${sw}"/>`
          : `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="${m.radius * 2}" fill="${c}" stroke="none"/>`;
    const outline =
      m.kind !== "dot"
        ? path
            .replace(/stroke="#[0-9a-f]+" stroke-width="[^"]+"/, shadow)
            .replace(/fill="#[0-9a-f]+"/, 'fill="none"')
        : "";
    const svg = `<g class="epic-skin-fx vanguard-fx" data-effect="${EPIC_SIGNATURES[skin].title}" opacity="${m.alpha}">${outline}${path}${animated ? `<animate attributeName="opacity" values="${m.alpha * 0.55};${m.alpha};${m.alpha * 0.55}" dur="${2.2 + i * 0.11}s" repeatCount="indefinite"/>` : ""}</g>`;
    if (m.plane === "ground") under += svg;
    else over += svg;
  }
  return { under, over };
}
