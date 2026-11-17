import type { CharacterId } from "@arena/shared";
import type { Facing } from "../animation/controller";
import { proportioned, type CreaturePart } from "../creature-design";
import { VANGUARD_DESIGNS } from "./vanguard-art";
import type { FxContext } from "./skin-fx";

export interface VanguardMark {
  part: CreaturePart;
  kind: "line" | "dot" | "ring" | "diamond";
  x: number;
  y: number;
  x2: number;
  y2: number;
  radius: number;
  alpha: number;
  color: number;
}
/** Small deterministic ornaments: no emitters, scene objects, large glows or
 * full-screen layers. The same local geometry supplies the review and rig. */
export function vanguardMarks(
  id: CharacterId,
  dir: Facing,
  now: number,
): VanguardMark[] {
  const side = dir === "left" ? -1 : dir === "right" ? 1 : 0,
    back = dir === "up",
    cx = 100 + side * 6;
  const far = ["auralynx", "duskveil", "coilemur", "wombolder"].includes(id)
    ? 76
    : 85;
  const left = side
    ? proportioned("armL", side === 1 ? 200 - far : far, 148)[0]
    : back
      ? 76
      : 71;
  const right = side
    ? proportioned("armR", side === 1 ? 89 : 111, 148)[0]
    : back
      ? 124
      : 129;
  const phase =
    (now / 2800 + (Object.keys(VANGUARD_DESIGNS).indexOf(id) % 7) * 0.13) % 1;
  const pulse = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)),
    color = parseInt(VANGUARD_DESIGNS[id].palette.glow.slice(1), 16);
  const out: VanguardMark[] = [];
  const add = (
    part: CreaturePart,
    kind: VanguardMark["kind"],
    x: number,
    y: number,
    x2 = x,
    y2 = y,
    radius = 2,
    alpha = pulse,
  ) => out.push({ part, kind, x, y, x2, y2, radius, alpha, color });
  const line = (
    part: CreaturePart,
    x: number,
    y: number,
    x2: number,
    y2: number,
    alpha = pulse,
  ) => add(part, "line", x, y, x2, y2, 1, alpha);
  const dot = (
    part: CreaturePart,
    x: number,
    y: number,
    r = 2,
    alpha = pulse,
  ) => add(part, "dot", x, y, x, y, r, alpha);
  const ring = (
    part: CreaturePart,
    x: number,
    y: number,
    r = 5,
    alpha = pulse * 0.6,
  ) => add(part, "ring", x, y, x, y, r, alpha);
  switch (id) {
    case "voltkit":
      for (let i = 0; i < 3; i++) {
        const yy = 134 + i * 6;
        line("body", cx - 7, yy, cx, yy + 4, pulse * (0.5 + i * 0.2));
        line("body", cx, yy + 4, cx + 7, yy, pulse * (0.5 + i * 0.2));
      }
      break;
    case "cindrake":
      for (let i = -1; i <= 1; i++) {
        const rise = ((phase + i * 0.2 + 1) % 1) * 4;
        line(
          "armR",
          right + i * 4,
          141 - rise,
          right + i * 4 + 1,
          137 - rise,
          0.18 + 0.4 * (1 - rise / 4),
        );
      }
      if (back) line("body", cx - 5, 138, cx + 5, 138);
      break;
    case "tidefin":
      ring("armR", right, 150, 3 + phase * 3, 0.32 * (1 - phase));
      ring("armR", right, 150, 5 + phase * 2, 0.2 * (1 - phase));
      line("armR", right + (side || 1) * 8, 137, right + (side || 1) * 12, 126);
      break;
    case "auralynx":
      for (const [part, x] of [
        ["armL", left],
        ["armR", right],
      ] as const) {
        add(part, "diamond", x, 143, x, 143, 7, pulse * 0.6);
        dot(
          part,
          x + Math.cos(phase * Math.PI * 2) * 5,
          143 + Math.sin(phase * Math.PI * 2) * 7,
          1.4,
          0.65,
        );
      }
      break;
    case "lumoth":
      for (const x of side ? [100 - side * 28] : [66, 134])
        dot("wings", x, 128, 3.2, pulse * 0.7);
      dot("body", cx, 140, 2.3, pulse);
      break;
    case "mystowl":
      if (back) {
        for (const [x, y, i] of [
          [76, 143, 0],
          [95, 135, 1],
          [120, 148, 2],
        ])
          add(
            "wings",
            "diamond",
            x,
            y,
            x,
            y,
            2.5,
            0.15 +
              0.55 * Math.max(0, Math.sin((phase - i * 0.18) * Math.PI * 2)),
          );
      } else {
        dot("armR", right, 141, 1.8);
        line("armR", right - 3, 145, right + 3, 145);
      }
      break;
    case "terradon":
      if (back || side) {
        const x = back ? 100 : 100 - side * 24;
        for (let i = -1; i <= 1; i++)
          line(
            back ? "wings" : "body",
            x + i * (back ? 9 : 4),
            137,
            x + i * (back ? 9 : 4),
            142,
            pulse * 0.6,
          );
      } else {
        line("armL", left - 4, 140, left + 4, 140);
        line("armR", right - 4, 140, right + 4, 140);
      }
      break;
    case "duskveil": {
      const [x, y] = proportioned(
        "tail",
        dir === "right" ? 19 : dir === "down" ? 180 : 181,
        dir === "down" ? 118 : 121,
      );
      ring("tail", x, y, 6.5, pulse * 0.35);
      dot("tail", x, y, 2, pulse);
      line("body", cx - 6, 140, cx - 8, 143);
      line("body", cx + 6, 140, cx + 8, 143);
      break;
    }
    case "coilemur":
      if (back) {
        ring("body", cx - 11, 137, 6, pulse * 0.6);
        ring("body", cx + 11, 137, 6, pulse * 0.6);
      } else {
        for (let i = -1; i <= 1; i++)
          line(
            "armR",
            right - 4,
            138 + i * 3,
            right + 4,
            138 + i * 3,
            0.15 + 0.4 * Math.max(0, Math.sin((phase - i * 0.2) * Math.PI * 2)),
          );
      }
      break;
    case "pyranda":
      add("armR", "diamond", right, 141, right, 141, 4, pulse * 0.65);
      dot("armR", right - 5, 135 - phase * 5, 1.3, 0.45 * (1 - phase));
      dot("armR", right + 5, 136 - phase * 4, 1.2, 0.35 * (1 - phase));
      break;
    case "glacelle":
      for (const [part, x] of [
        ["armL", side === 1 ? 120 : side === -1 ? 80 : 56],
        ["armR", side === 1 ? 71 : side === -1 ? 129 : 144],
      ] as const)
        add(part, "diamond", x, 133, x, 133, 3.5, pulse);
      if (!back) line("body", cx - 4, 140, cx + 4, 148, pulse * 0.5);
      break;
    case "halcyra":
      for (const [part, x] of [
        ["armL", left],
        ["armR", right],
      ] as const) {
        const dx = (side || 1) * (phase * 3);
        line(part, x - 3 + dx, 139, x + 3 + dx, 136, 0.32 * (1 - phase));
        line(part, x - 2 + dx, 144, x + 4 + dx, 141, 0.22 * (1 - phase));
      }
      break;
    case "sunbara":
      line("body", cx - 7, 145, cx + 7, 145, pulse * 0.6);
      for (const x of [-6, 0, 6])
        dot(
          "body",
          cx + x,
          131 - Math.sin(phase * Math.PI) * 2,
          1.4,
          pulse * 0.45,
        );
      break;
    case "astrabun": {
      const x = right + (side || 1) * 8;
      add("armR", "diamond", x, 153, x, 153, 3, pulse);
      dot("armR", x - 4, 154 + phase * 3, 1.2, 0.5 * (1 - phase));
      line(
        "legR",
        side === 1 ? 86 : side === -1 ? 106 : 111,
        165,
        side === 1 ? 94 : side === -1 ? 114 : 119,
        165,
        pulse * 0.7,
      );
      break;
    }
    case "wombolder":
      for (const [part, x] of [
        ["armL", side ? left : 64],
        ["armR", side ? right : 136],
      ] as const) {
        line(part, x - 4, 141, x - 4, 146, pulse * 0.6);
        line(part, x + 4, 141, x + 4, 146, pulse * 0.6);
      }
      break;
    case "shadopus":
      for (const [part, x] of [
        ["armL", side === 1 ? 133 : side === -1 ? 67 : 59],
        ["armR", side === 1 ? 67 : side === -1 ? 133 : 141],
      ] as const) {
        dot(part, x, 144, 2.2, pulse * 0.7);
        ring(part, x, 144, 4, pulse * 0.3);
      }
      break;
    case "pangrove":
      if (back) {
        for (const x of [85, 100, 115])
          line("wings", x, 132, x, 143, pulse * 0.6);
      } else {
        for (const [part, x] of [
          ["armL", side ? left : 66],
          ["armR", side ? right : 134],
        ] as const)
          line(part, x, 138, x, 151, pulse * 0.6);
      }
      break;
    case "mossloth":
      if (back) {
        line("wings", 87, 145, 95, 147, pulse * 0.4);
        line("wings", 105, 147, 113, 145, pulse * 0.4);
      } else {
        dot(
          "armL",
          left,
          149 - Math.sin(phase * Math.PI) * 2,
          1.8,
          pulse * 0.5,
        );
        dot(
          "armR",
          right,
          149 - Math.sin(phase * Math.PI) * 2,
          1.8,
          pulse * 0.5,
        );
      }
      break;
  }
  return out;
}
/** Draw through the rig's existing shared Graphics object. Reduced motion
 * is gated by the rig; Low/ambient-off additionally suppresses these details. */
export function drawVanguardFx(ctx: FxContext, id: CharacterId) {
  if (ctx.defeated || !ctx.ambient) return;
  const scale = ctx.sc * 0.5;
  for (const mark of vanguardMarks(id, ctx.facing ?? "down", ctx.now)) {
    const point = (x: number, y: number) =>
      ctx.mount?.(mark.part, x, y) ?? {
        x: ctx.x + (x - 100) * scale,
        y: ctx.y + (y - 172) * scale,
      };
    const a = point(mark.x, mark.y),
      g =
        ((ctx.facing === "left" || ctx.facing === "right") &&
          mark.part === "armL") ||
        (ctx.facing === "up" && (mark.part === "armL" || mark.part === "armR"))
          ? ctx.under
          : ctx.g;
    if (mark.kind === "dot")
      g.fillStyle(mark.color, mark.alpha).fillCircle(
        a.x,
        a.y,
        mark.radius * scale,
      );
    else if (mark.kind === "line") {
      const b = point(mark.x2, mark.y2);
      g.lineStyle(Math.max(0.6, scale), mark.color, mark.alpha).lineBetween(
        a.x,
        a.y,
        b.x,
        b.y,
      );
    } else if (mark.kind === "ring")
      g.lineStyle(Math.max(0.6, scale), mark.color, mark.alpha).strokeCircle(
        a.x,
        a.y,
        mark.radius * scale,
      );
    else {
      const r = mark.radius;
      const n = point(mark.x, mark.y - r),
        e = point(mark.x + r * 0.7, mark.y),
        s = point(mark.x, mark.y + r),
        w = point(mark.x - r * 0.7, mark.y);
      g.lineStyle(Math.max(0.6, scale), mark.color, mark.alpha)
        .beginPath()
        .moveTo(n.x, n.y)
        .lineTo(e.x, e.y)
        .lineTo(s.x, s.y)
        .lineTo(w.x, w.y)
        .closePath()
        .strokePath();
    }
  }
}
/** Native SVG animation in the downloadable review; equipment textures never
 * include it. The game uses the per-frame Graphics function above. */
export function vanguardPreviewFx(
  id: CharacterId,
  dir: Facing,
): Partial<Record<CreaturePart, string>> {
  const result: Partial<Record<CreaturePart, string>> = {};
  vanguardMarks(id, dir, 360).forEach((m, i) => {
    const c = "#" + m.color.toString(16).padStart(6, "0");
    const shape =
      m.kind === "line"
        ? `<path d="M${m.x} ${m.y}L${m.x2} ${m.y2}" fill="none"/>`
        : m.kind === "dot"
          ? `<circle cx="${m.x}" cy="${m.y}" r="${m.radius}" fill="${c}" stroke="none"/>`
          : m.kind === "ring"
            ? `<circle cx="${m.x}" cy="${m.y}" r="${m.radius}" fill="none"/>`
            : `<path d="M${m.x} ${m.y - m.radius}L${m.x + m.radius * 0.7} ${m.y}L${m.x} ${m.y + m.radius}L${m.x - m.radius * 0.7} ${m.y}Z" fill="none"/>`;
    result[m.part] =
      (result[m.part] ?? "") +
      `<g class="vanguard-fx" stroke="${c}" stroke-width="1.1" opacity=".5">${shape}<animate attributeName="opacity" values=".12;.65;.12" dur="${2.6 + i * 0.17}s" begin="-${i * 0.3}s" repeatCount="indefinite"/></g>`;
  });
  return result;
}
