/**
 * Light for the hub's 2D worlds (Plaza, Farm): a night light map that keeps
 * the true colours under lamps instead of washing them out.
 *
 * It draws into an offscreen canvas at half the screen's resolution (the
 * night is soft, so nothing sharp is lost) and lands on the scene in a
 * single drawImage, so the cost does not grow with the screen. It doesn't
 * run at Low graphics: the scenes keep their plain night tint there.
 *
 * Shadows are the round ones the scenes draw under each thing. Shadows
 * cast from the sun were tried here, drawn at the same half resolution:
 * their soft edges lay beside every fighter's sharp ones and made the
 * fighters look blurred, so they were taken out.
 */

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
