import type { EpicFxPrimitive } from "./epic-skin-fx";
export interface EpicCanvasPose {
  x: number;
  y: number;
  z: number;
  bob: number;
  rotation: number;
  squash: number;
  face: number;
  size: number;
  full: boolean;
}
/** Plaza reuses its existing 2D canvas and baked costume sprite. No animated
 * SVG re-bakes, new canvases, pixel reads, DOM reads or particle objects. */
export function drawEpicCanvasFx(
  g: CanvasRenderingContext2D,
  marks: readonly EpicFxPrimitive[],
  pose: EpicCanvasPose,
  plane: "ground" | "rig",
) {
  const scale = pose.size / 100,
    artScale = pose.size / 200;
  g.save();
  for (const m of marks) {
    if (m.plane !== plane) continue;
    const project = ([x, y]: readonly [number, number]) => {
      if (plane === "ground")
        return [
          pose.x + x * scale,
          pose.y + 4 * scale + y * scale * 0.55,
        ] as const;
      let px =
        (m.anchor[0] + x * 2 - 100) *
        artScale *
        (pose.face > 0 ? -1 : 1) *
        (1 + pose.squash);
      let py =
        (-pose.size * 0.9 + (m.anchor[1] + y * 2 + 12) * artScale) *
        (1 - pose.squash);
      const co = Math.cos(pose.rotation),
        si = Math.sin(pose.rotation);
      return [
        pose.x + px * co - py * si,
        pose.y - pose.z - pose.bob + px * si + py * co,
      ] as const;
    };
    const points = m.points.map(project),
      r = m.radius * scale;
    const color = "#" + m.color.toString(16).padStart(6, "0");
    const trace = () => {
      g.beginPath();
      if (m.kind === "path") {
        g.moveTo(...points[0]);
        for (const p of points.slice(1)) g.lineTo(...p);
        if (m.closed) g.closePath();
      } else if (m.kind === "dot") g.arc(...points[0], r, 0, Math.PI * 2);
      else
        g.ellipse(
          ...points[0],
          r,
          plane === "ground" ? r * 0.55 : r,
          0,
          0,
          Math.PI * 2,
        );
    };
    if (pose.full && m.kind === "path" && m.closed && m.plane === "rig") {
      g.globalAlpha = m.alpha * 0.2;
      g.fillStyle = color;
      trace();
      g.fill();
    }
    if (m.kind !== "dot" && pose.full) {
      g.globalAlpha = m.alpha * 0.3;
      g.strokeStyle = "#15243c";
      g.lineWidth = 3.4 * scale;
      trace();
      g.stroke();
    }
    g.globalAlpha = m.alpha;
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = Math.max(0.8, m.width * scale);
    g.lineJoin = "round";
    g.lineCap = "round";
    trace();
    if (m.kind === "dot") g.fill();
    else g.stroke();
  }
  g.restore();
}
