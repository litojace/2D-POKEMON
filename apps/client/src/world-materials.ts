/** Hand-painted surface detail, baked into town textures once, never per frame. */
export type TownMaterial = "stone" | "wood" | "leaves" | "cloth" | "tile";
export type MaterialFamily =
  "architecture" | "foliage" | "timber" | "market" | "ground";
type Ctx = CanvasRenderingContext2D;
type Box = { x: number; y: number; w: number; h: number };
const noise = (n: number) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Transparent washes and already painted images keep their original lighting. */
export function surfaceMaterial(
  css: string,
  family: MaterialFamily,
): TownMaterial | null {
  const match = css.match(/^#([\da-f]{6})$/i);
  if (!match) return null;
  const n = parseInt(match[1], 16),
    r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  if (Math.max(r, g, b) < 42) return null;
  if (family === "foliage" && g > r * 0.88 && g > b * 1.12) return "leaves";
  if (family === "ground" && g > r * 1.06) return null;
  if (family === "timber") return "wood";
  if (r > g * 1.25 && g > b * 1.25 && b < 125) return "wood";
  if (
    family === "market" &&
    (Math.max(r, g, b) - Math.min(r, g, b) > 65 || Math.min(r, g, b) > 195)
  )
    return "cloth";
  if (g > r * 1.12 || b > r * 1.12) return family === "ground" ? null : "tile";
  return "stone";
}

// Small repeat tiles keep GPU texture size and first-town paint time bounded.
// Patterns have no opaque background: the authored material colour remains visible.
const tiles = new Map<TownMaterial, HTMLCanvasElement>();
function texture(material: TownMaterial) {
  const cached = tiles.get(material);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext("2d")!;
  const line = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    light: boolean,
    alpha: number,
  ) => {
    c.strokeStyle = light
      ? `rgba(255,243,211,${alpha})`
      : `rgba(23,30,24,${alpha})`;
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + dx, y + dy);
    c.stroke();
  };
  if (material === "wood") {
    for (let k = 0; k < 45; k++) {
      const x = k * 3 + noise(k) * 2;
      c.strokeStyle = k % 3 ? "rgba(37,22,12,.2)" : "rgba(255,223,166,.17)";
      c.lineWidth = k % 4 ? 0.65 : 1.2;
      c.beginPath();
      c.moveTo(x, -4);
      c.bezierCurveTo(x + 5, 30, x - 5, 88, x, 132);
      c.stroke();
    }
    for (let k = 0; k < 3; k++) {
      const x = 20 + noise(k + 31) * 88,
        y = 18 + noise(k + 52) * 92;
      for (let ring = 1; ring <= 3; ring++) {
        c.strokeStyle = `rgba(43,25,13,${0.22 / ring})`;
        c.beginPath();
        c.ellipse(x, y, ring * 1.7, ring * 4.5, -0.1, 0, Math.PI * 2);
        c.stroke();
      }
    }
  } else if (material === "leaves") {
    for (let k = 0; k < 760; k++) {
      const x = noise(k * 3 + 17) * 128,
        y = noise(k * 7 + 5) * 128;
      const r = 1 + noise(k + 8) * 2.4;
      c.fillStyle = k % 3 ? "rgba(10,39,23,.18)" : "rgba(233,243,172,.3)";
      c.beginPath();
      c.ellipse(x, y, r, r * 0.45, noise(k) * 3, 0, Math.PI * 2);
      c.fill();
      if (k % 5 === 0) line(x - r * 0.5, y, r, -0.5, true, 0.22);
    }
  } else if (material === "cloth") {
    for (let k = 0; k < 128; k += 2) {
      line(k, 0, 0, 128, k % 4 === 0, 0.065);
      line(0, k, 128, 0, k % 4 !== 0, 0.075);
    }
  } else {
    for (let k = 0; k < 1000; k++) {
      const x = noise(k * 3 + 43) * 128,
        y = noise(k * 7 + 71) * 128;
      c.fillStyle = k % 3 ? "rgba(35,40,38,.12)" : "rgba(255,249,222,.22)";
      c.fillRect(x, y, 0.4 + noise(k) * 1.3, 0.4 + noise(k + 5));
    }
    if (material === "stone") {
      for (let k = 0; k < 12; k++) {
        const x = noise(k * 5) * 128,
          y = noise(k * 9) * 128;
        line(x, y, 2 + noise(k) * 6, 1.5, false, 0.16);
        line(x, y - 0.6, 2 + noise(k) * 6, 1.5, true, 0.16);
      }
    }
  }
  tiles.set(material, canvas);
  return canvas;
}

const pavers = new Map<string, HTMLCanvasElement>();
/** Thousands of road stones reuse small bevelled paintings, with no per-stone clip. */
export function stonePaver(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  colour: string,
) {
  const width = Math.round(w),
    height = Math.round(h);
  const key = `${colour}:${width}:${height}:${radius}`;
  let tile = pavers.get(key);
  if (!tile) {
    tile = document.createElement("canvas");
    tile.width = width * 2;
    tile.height = height * 2;
    const c = tile.getContext("2d")!;
    c.scale(2, 2);
    c.beginPath();
    c.roundRect(0.2, 0.2, width - 0.4, height - 0.4, radius);
    c.fillStyle = colour;
    c.fill();
    c.clip();
    const light = c.createLinearGradient(0, 0, width * 0.5, height);
    light.addColorStop(0, "rgba(255,246,216,.22)");
    light.addColorStop(0.35, "rgba(255,246,216,0)");
    light.addColorStop(1, "rgba(26,33,36,.22)");
    c.fillStyle = light;
    c.fillRect(0, 0, width, height);
    c.fillStyle = c.createPattern(texture("stone"), "repeat")!;
    c.fillRect(0, 0, width, height);
    c.strokeStyle = "rgba(255,246,216,.23)";
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(radius, 1);
    c.lineTo(width - radius, 1);
    c.stroke();
    pavers.set(key, tile);
  }
  ctx.drawImage(tile, x, y, w, h);
}

/**
 * Decorate each opaque painted surface within its OWN path. No screen overlay,
 * geometry changes or framebuffer reads. Native paths, clips and transforms stay
 * intact; only fillRect is used during the clipped detail pass.
 */
export function materialContext(ctx: Ctx, family: MaterialFamily): Ctx {
  let box: Box | null = null;
  const gradients = new WeakMap<CanvasGradient, string>();
  const patterns = new Map<TownMaterial, CanvasPattern>();
  const include = (x: number, y: number) => {
    if (!box) box = { x, y, w: 0, h: 0 };
    else {
      const right = Math.max(box.x + box.w, x),
        bottom = Math.max(box.y + box.h, y);
      box.x = Math.min(box.x, x);
      box.y = Math.min(box.y, y);
      box.w = right - box.x;
      box.h = bottom - box.y;
    }
  };
  const decorate = (bounds: Box, clip: () => void) => {
    const { x, y, w, h } = bounds;
    if (
      w < 4 ||
      h < 3 ||
      w * h < 42 ||
      ctx.globalAlpha < 0.8 ||
      ctx.globalCompositeOperation !== "source-over"
    )
      return;
    const fill = ctx.fillStyle;
    const colour =
      typeof fill === "string" ? fill : gradients.get(fill as CanvasGradient);
    const material = colour && surfaceMaterial(colour, family);
    if (!material) return;
    ctx.save();
    clip();
    // The same upper-left sun as the fountain; each surface rolls into shade.
    const light = ctx.createLinearGradient(x, y, x + w * 0.65, y + h);
    const strength = typeof fill === "string" ? 1 : 0.48;
    light.addColorStop(0, `rgba(255,242,202,${0.24 * strength})`);
    light.addColorStop(0.32, "rgba(255,245,220,0)");
    light.addColorStop(
      1,
      `rgba(15,29,36,${(material === "leaves" ? 0.36 : 0.24) * strength})`,
    );
    ctx.fillStyle = light;
    ctx.fillRect(x, y, w, h);
    let pattern = patterns.get(material);
    if (!pattern) {
      pattern = ctx.createPattern(texture(material), "repeat")!;
      patterns.set(material, pattern);
    }
    ctx.fillStyle = pattern;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  };
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === "beginPath")
        return () => {
          box = null;
          target.beginPath();
        };
      if (prop === "fill")
        return (...args: unknown[]) => {
          // Explicit Path2D callers own their path; do not guess its bounds.
          (target.fill as Function).apply(target, args);
          if (box && (args.length === 0 || typeof args[0] === "string")) {
            decorate(box, () =>
              target.clip((args[0] ?? "nonzero") as CanvasFillRule),
            );
          }
        };
      if (prop === "fillRect")
        return (x: number, y: number, w: number, h: number) => {
          target.fillRect(x, y, w, h);
          decorate({ x, y, w, h }, () => {
            const p = new Path2D();
            p.rect(x, y, w, h);
            target.clip(p);
          });
        };
      if (prop === "createLinearGradient" || prop === "createRadialGradient")
        return (...args: number[]) => {
          const gradient = (target[prop] as Function).apply(
            target,
            args,
          ) as CanvasGradient;
          const add = gradient.addColorStop.bind(gradient);
          gradient.addColorStop = (offset, colour) => {
            add(offset, colour);
            if (!gradients.has(gradient) || (offset > 0.2 && offset < 0.7))
              gradients.set(gradient, colour);
          };
          return gradient;
        };
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      return (...args: number[]) => {
        if (prop === "ellipse" || prop === "arc") {
          const [x, y, rx, a] = args,
            ry = prop === "arc" ? rx : a,
            rotation = prop === "arc" ? 0 : args[4],
            ex = Math.hypot(rx * Math.cos(rotation), ry * Math.sin(rotation)),
            ey = Math.hypot(rx * Math.sin(rotation), ry * Math.cos(rotation));
          include(x - ex, y - ey);
          include(x + ex, y + ey);
        } else if (prop === "rect" || prop === "roundRect") {
          include(args[0], args[1]);
          include(args[0] + args[2], args[1] + args[3]);
        } else if (
          ["moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo"].includes(
            prop as string,
          )
        ) {
          for (let k = 0; k < args.length; k += 2)
            include(args[k], args[k + 1]);
        }
        return value.apply(target, args);
      };
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target);
    },
  });
}

export function townMaterialFamily(key: string): MaterialFamily | null {
  if (
    /town-painted-|fountain-painted|statue-image|puff|ember|cloud|butterfly|dog-|hen-|duck-|gull-/.test(
      key,
    )
  )
    return null;
  if (/canopy|bush/.test(key)) return "foliage";
  if (/trunk|crates|signpost|dummy/.test(key)) return "timber";
  if (/stall|sails/.test(key)) return "market";
  return "architecture";
}
