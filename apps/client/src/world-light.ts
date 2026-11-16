/**
 * Light for the hub's 2D worlds (Plaza, Farm): shadows that fall away from
 * the sun and lengthen through the day, and a night light map that keeps
 * the true colours under lamps instead of washing them out.
 *
 * Both draw into one offscreen canvas at half the screen's resolution and
 * land on the scene in a single drawImage, so a shadow over a shadow never
 * darkens twice and the cost does not grow with the screen. Nothing here
 * runs at Low graphics: the scenes keep their round ground shadows and
 * plain night tint there.
 */

/** Where shadows fall: offset per pixel of height, and how dark they are. */
export interface SunLight {
  /** Ground offset (screen x, y) of a point one pixel above the ground. */
  dx: number;
  dy: number;
  /** Opacity of the shadow layer (0 hides it). */
  alpha: number;
}

/**
 * The sun at a time of day (0..1 of the device's day) and night level (0..1).
 * The sun rises in the east (screen right) around 06:00 and sets in the west
 * around 18:00, so morning shadows reach left and evening ones right; they
 * are short at noon and long near sunset, and fade out as night comes.
 * A shadow always leans a little down the screen, so it shows below what
 * casts it instead of hiding behind it.
 */
export function sunLight(tod: number, night: number): SunLight {
  const p = Math.max(-1, Math.min(1, (tod - 0.5) / 0.26));
  const len = 0.32 + 1.05 * p * p;
  const day = 1 - Math.min(1, Math.max(0, night));
  return {
    dx: p * len,
    dy: 0.2 + 0.16 * len,
    alpha: 0.3 * Math.pow(day, 0.7),
  };
}

/** A sprite as the hub art bakes it: a canvas drawn at (−ax, −ay) w×h. */
export interface BakedSprite {
  c: CanvasImageSource;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

const SCALE = 0.5;

function layerFor(
  canvas: HTMLCanvasElement | null,
  target: CanvasRenderingContext2D,
) {
  const c = canvas ?? document.createElement("canvas");
  const w = Math.max(1, Math.ceil(target.canvas.width * SCALE)),
    h = Math.max(1, Math.ceil(target.canvas.height * SCALE));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

/**
 * Cast shadows. Call begin() with the scene's world transform already set on
 * the target, add every caster, then end() before drawing the casters
 * themselves (shadows lie on the ground, under everything standing).
 */
export class ShadowLayer {
  private c: HTMLCanvasElement | null = null;
  private g: CanvasRenderingContext2D | null = null;
  private sun: SunLight = { dx: 0, dy: 0, alpha: 0 };
  active = false;

  begin(target: CanvasRenderingContext2D, sun: SunLight): boolean {
    this.active = false;
    if (sun.alpha < 0.02) return false;
    this.c = layerFor(this.c, target);
    this.g ||= this.c.getContext("2d");
    const g = this.g;
    if (!g) return false;
    this.sun = sun;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, this.c.width, this.c.height);
    const m = target.getTransform();
    g.setTransform(
      m.a * SCALE,
      m.b * SCALE,
      m.c * SCALE,
      m.d * SCALE,
      m.e * SCALE,
      m.f * SCALE,
    );
    this.active = true;
    return true;
  }

  /**
   * Any image standing at (x, y) on the ground, drawn at (ox, oy) w×h from
   * that point (as drawImage would), with its picture `lift` pixels above
   * the ground (a tree's canopy on its trunk).
   */
  image(
    img: CanvasImageSource,
    x: number,
    y: number,
    ox: number,
    oy: number,
    w: number,
    h: number,
    lift = 0,
    flip = false,
  ) {
    const g = this.g;
    if (!this.active || !g) return;
    const { dx, dy } = this.sun;
    g.save();
    // A point `v` px above the ground lands `v·(dx, dy)` away from its foot.
    g.transform(1, 0, -dx, -dy, x + dx * lift, y + dy * lift);
    if (flip) g.scale(-1, 1);
    g.drawImage(img, ox, oy, w, h);
    g.restore();
  }

  /** A baked hub sprite blitted at (x, y) (GFX.blit's arguments). */
  sprite(s: BakedSprite, x: number, y: number, lift = 0, k = 1) {
    this.image(s.c, x, y, -s.ax * k, -s.ay * k, s.w * k, s.h * k, lift);
  }

  /** A plain box standing on the ground (a pole, a post). */
  pole(x: number, y: number, w: number, h: number) {
    const g = this.g;
    if (!this.active || !g) return;
    const { dx, dy } = this.sun;
    g.save();
    g.transform(1, 0, -dx, -dy, x, y);
    g.fillStyle = "#000";
    g.fillRect(-w / 2, -h, w, h);
    g.restore();
  }

  /** Lay the shadows on the scene. */
  end(target: CanvasRenderingContext2D) {
    const g = this.g,
      c = this.c;
    if (!this.active || !g || !c) return;
    this.active = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Every caster becomes one flat, cool shadow colour.
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "rgb(18,32,44)";
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-over";
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.globalCompositeOperation = "source-over";
    target.globalAlpha = this.sun.alpha;
    target.imageSmoothingEnabled = true;
    target.drawImage(c, 0, 0, target.canvas.width, target.canvas.height);
    target.restore();
  }
}

/**
 * The night as a light map: the darkness is painted on a layer, each lamp
 * cuts a soft hole in it, and the layer multiplies the scene. Under a lamp
 * the grass stays green and the stone stays warm, instead of a coloured
 * glow over a dark blue picture.
 */
export class NightLight {
  private c: HTMLCanvasElement | null = null;
  private g: CanvasRenderingContext2D | null = null;
  active = false;

  /** Start the night with this multiply colour, in screen space. */
  begin(target: CanvasRenderingContext2D, rgb: [number, number, number]) {
    this.active = false;
    this.c = layerFor(this.c, target);
    this.g ||= this.c.getContext("2d");
    const g = this.g;
    if (!g) return false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, this.c.width, this.c.height);
    g.fillStyle = `rgb(${rgb.map((v) => Math.round(v)).join(",")})`;
    g.fillRect(0, 0, this.c.width, this.c.height);
    g.globalCompositeOperation = "destination-out";
    this.active = true;
    return true;
  }

  /**
   * Where lights are placed: the transform from world to the target's
   * pixels (the same six numbers as setTransform on the target).
   */
  at(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.g?.setTransform(
      a * SCALE,
      b * SCALE,
      c * SCALE,
      d * SCALE,
      e * SCALE,
      f * SCALE,
    );
  }

  /** Use the target's current transform for the lights that follow. */
  follow(target: CanvasRenderingContext2D) {
    const m = target.getTransform();
    this.at(m.a, m.b, m.c, m.d, m.e, m.f);
  }

  /**
   * A light at (x, y) of radius r. `k` 0..1 is how much of the night it
   * lifts at its centre; `flat` squashes it into a pool on the ground.
   */
  light(x: number, y: number, r: number, k: number, flat = 1) {
    const g = this.g;
    if (!this.active || !g || k <= 0.005) return;
    g.save();
    g.translate(x, y);
    if (flat !== 1) g.scale(1, flat);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, `rgba(0,0,0,${Math.min(1, k)})`);
    gr.addColorStop(0.45, `rgba(0,0,0,${Math.min(1, k) * 0.6})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }

  /** Multiply the night onto the scene. */
  end(target: CanvasRenderingContext2D) {
    const c = this.c;
    if (!this.active || !c) return;
    this.active = false;
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.globalCompositeOperation = "multiply";
    target.globalAlpha = 1;
    target.imageSmoothingEnabled = true;
    target.drawImage(c, 0, 0, target.canvas.width, target.canvas.height);
    target.restore();
  }
}
