/**
 * Gift boxes in the Plaza (PLAZA_GIFT; owner, 23 Nov 2026), in place of the
 * treats' burst of dots: a box tumbles through the air in an arc, lands
 * with a bounce, and bursts open: its lid flies off, confetti and ribbons
 * spray, a shockwave rings out, and its orbs hop out for everyone else
 * nearby to catch. A golden box (PLAZA_GIFT.goldenChance) shines, sprays
 * gold and spills twice the orbs.
 *
 * The server decides everything (where it lands, its orbs, who caught
 * which); this file only plays it, on the server's clock. Low graphics and
 * reduced motion spray a fraction of the confetti and no glow.
 */
import {
  ORB_SHOWER,
  PLAZA_GIFT,
  type PlazaGift,
  type PlazaGiftGone,
} from "../../../../packages/shared/src/plaza";

/** Box and ribbon colours, picked by the box's id (the same for everyone). */
const BOXES: [string, string, string][] = [
  ["#ff6f9a", "#ffe28a", "#c9466f"],
  ["#5fb3ff", "#fff4d6", "#3a7fc4"],
  ["#7cc95a", "#ff7fb0", "#4f9a38"],
  ["#b88cff", "#ffd65b", "#7f5bcc"],
  ["#ff9b4a", "#bfe8ff", "#c96a24"],
];
const GOLD: [string, string, string] = ["#ffcf3d", "#ff4f6a", "#c99417"];
const CONFETTI = [
  "#ff6f9a",
  "#ffd65b",
  "#5fb3ff",
  "#7cc95a",
  "#c9a3ff",
  "#ffffff",
  "#ff9b4a",
];
const GOLD_CONFETTI = ["#ffcf3d", "#fff3b0", "#ffb020", "#ffffff", "#ff4f6a"];
const ORB_COLORS = ["#ffd65b", "#8fd7ff", "#ff9bd2", "#a8f07a", "#c9a3ff"];
/** The box's flight: how high its arc peaks (px). */
const ARC = 150;
/** The box's size: half again its drawn size (it read small on a phone). */
const BOX_SCALE = 1.5;
/** How long its orbs take to hop out to where they lie (ms). */
const HOP_MS = 350;
/** The open box stays this long, then fades over FADE_MS (ms after opening). */
const OPEN_KEEP_MS = 1400,
  FADE_MS = 900;

interface Orb {
  x: number;
  y: number;
  c: string;
  landed: boolean;
}
interface Gift {
  g: PlazaGift;
  orbs: Map<number, Orb>;
  colors: [string, string, string];
  landed: boolean;
  opened: boolean;
  /** Where it is now, its height and turn (set by update). */
  x: number;
  y: number;
  z: number;
  spin: number;
  age: number;
}
/** A drawable for the scene's depth sort: a ground point, a height, a draw. */
export interface GiftDrawable {
  x: number;
  y: number;
  z: number;
  name: string;
  draw: (g: CanvasRenderingContext2D, time: number) => void;
}
export interface GiftHost {
  /** The scene's effect list (rings, glyph bursts, texts, confetti). */
  fx: any[];
  /** Your profile id, the server's clock (ms), and the graphics settings. */
  me: () => number | null;
  now: () => number;
  low: () => boolean;
  reduced: () => boolean;
  /** You caught an orb from a box (the scene shows the +1). */
  caught: (x: number, y: number) => void;
}

const pick = <T>(list: T[], n: number) => list[Math.abs(n) % list.length];
const ease = (t: number) => 1 - (1 - t) * (1 - t);

export class PlazaGifts {
  private gifts = new Map<number, Gift>();
  constructor(private host: GiftHost) {}

  /** A box tossed (or already lying here when you arrived). */
  add(g: PlazaGift) {
    if (!g || typeof g.id !== "number" || this.gifts.has(g.id)) return;
    const orbs = new Map<number, Orb>();
    for (const [id, x, y] of g.orbs)
      orbs.set(id, {
        x,
        y,
        c: pick(ORB_COLORS, g.id * 7 + id),
        landed: false,
      });
    const age = this.host.now() - g.at;
    const late = age > PLAZA_GIFT.flightMs + PLAZA_GIFT.openMs;
    this.gifts.set(g.id, {
      g,
      orbs,
      colors: g.golden ? GOLD : pick(BOXES, g.id),
      // Arrived after it opened: no burst again, the orbs already out.
      landed: late,
      opened: late,
      x: g.x0,
      y: g.y0,
      z: 0,
      spin: 0,
      age,
    });
  }

  /** Orbs gone: caught (a sparkle, and your +1) or faded. */
  gone(list: PlazaGiftGone) {
    if (!Array.isArray(list)) return;
    for (const [giftId, orbId, who] of list) {
      const gift = this.gifts.get(giftId),
        orb = gift?.orbs.get(orbId);
      if (!gift || !orb) continue;
      gift.orbs.delete(orbId);
      if (!who) continue;
      this.sparkle(orb.x, orb.y, orb.c, 8);
      if (who === this.host.me()) this.host.caught(orb.x, orb.y);
    }
  }

  /** How many boxes are in the air or open (tests). */
  get size() {
    return this.gifts.size;
  }
  /** The boxes as they are now (tests). */
  list() {
    return [...this.gifts.values()].map((b) => ({
      id: b.g.id,
      golden: b.g.golden,
      landed: b.landed,
      opened: b.opened,
      orbs: [...b.orbs].map(([id, o]) => [id, o.x, o.y]),
      x: b.x,
      y: b.y,
      z: b.z,
    }));
  }

  /** One frame: move the boxes and orbs on, and play landings and openings. */
  update() {
    const now = this.host.now();
    for (const [id, b] of this.gifts) {
      const g = b.g,
        age = (b.age = now - g.at);
      const openAt = PLAZA_GIFT.flightMs + PLAZA_GIFT.openMs;
      if (age > Math.max(PLAZA_GIFT.lastsMs, openAt + OPEN_KEEP_MS + FADE_MS)) {
        this.gifts.delete(id);
        continue;
      }
      if (age < PLAZA_GIFT.flightMs) {
        // In the air: along the line from the thrower, in a high arc,
        // tumbling.
        const t = Math.max(0, age / PLAZA_GIFT.flightMs),
          k = ease(t);
        b.x = g.x0 + (g.x - g.x0) * k;
        b.y = g.y0 + (g.y - g.y0) * k;
        b.z = 4 * ARC * t * (1 - t) + 30 * (1 - t);
        b.spin = (age / 1000) * 9 * (g.x >= g.x0 ? 1 : -1);
        continue;
      }
      b.x = g.x;
      b.y = g.y;
      if (!b.landed) {
        b.landed = true;
        this.land(b);
      }
      if (age < openAt) {
        // A bounce, settling, and a wiggle before it pops.
        const k = (age - PLAZA_GIFT.flightMs) / PLAZA_GIFT.openMs;
        b.z = 22 * Math.abs(Math.sin(k * Math.PI)) * (1 - k);
        b.spin = Math.sin(k * Math.PI * 6) * 0.12 * k;
        continue;
      }
      b.z = 0;
      b.spin = 0;
      if (!b.opened) {
        b.opened = true;
        this.open(b);
      }
      // The orbs, hopping out and then lying there.
      const hop = (age - openAt) / HOP_MS;
      if (hop >= 1)
        for (const o of b.orbs.values())
          if (!o.landed) {
            o.landed = true;
            this.host.fx.push({
              ring: 1,
              x: o.x,
              y: o.y,
              t: 0,
              life: 0.4,
              c: o.c,
            });
          }
    }
  }

  private land(b: Gift) {
    this.host.fx.push(
      { dust: 1, x: b.x, y: b.y, t: 0, life: 0.45 },
      { ring: 1, x: b.x, y: b.y, t: 0, life: 0.35, c: "#ffffff" },
    );
  }

  /** The big moment: the lid flies, confetti and ribbons, a shockwave. */
  private open(b: Gift) {
    const fx = this.host.fx,
      golden = b.g.golden,
      cut = this.host.reduced() ? 4 : this.host.low() ? 2 : 1,
      colors = golden ? GOLD_CONFETTI : CONFETTI;
    const x = b.x,
      y = b.y;
    fx.push({ ring: 1, x, y, t: 0, life: 0.6, c: b.colors[0] });
    if (!this.host.low())
      fx.push({
        flash: 1,
        x,
        y,
        r: golden ? 170 : 120,
        c: golden ? "255,214,90" : "255,250,230",
        t: 0,
        life: 0.5,
      });
    if (golden) {
      fx.push(
        { ring: 1, x, y, t: -0.12, life: 0.75, c: "#ffcf3d" },
        { ring: 1, x, y, t: -0.24, life: 0.9, c: "#fff3b0" },
      );
      fx.push({
        text: "Golden gift!",
        x,
        y: y - 96,
        t: 0,
        life: 1.6,
        small: 1,
      });
    }
    // The lid, flung up and away, tumbling.
    fx.push({
      cf: 1,
      lid: 1,
      x,
      y,
      z: 34,
      vx: (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 60),
      vy: -20 - Math.random() * 30,
      vz: 360,
      rot: 0,
      vr: (Math.random() < 0.5 ? -1 : 1) * 9,
      c: b.colors[0],
      c2: b.colors[1],
      w: 38 * BOX_SCALE,
      h: 10 * BOX_SCALE,
      t: 0,
      life: 1.3,
    });
    // Confetti: small tumbling cards, and long ribbons that flutter.
    const n = Math.ceil((golden ? 80 : 48) / cut);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        sp = 70 + Math.random() * 170,
        ribbon = i % 5 === 0;
      fx.push({
        cf: 1,
        x,
        y,
        z: 30,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.55,
        vz: 260 + Math.random() * 260,
        rot: Math.random() * 6.3,
        vr: (Math.random() - 0.5) * 18,
        c: colors[i % colors.length],
        w: ribbon ? 4 : 8 + Math.random() * 5,
        h: ribbon ? 22 + Math.random() * 12 : 5 + Math.random() * 3,
        t: 0,
        life: 1.4 + Math.random() * 0.6,
      });
    }
    this.sparkle(x, y, golden ? "#ffe27a" : "#ffffff", golden ? 18 : 10);
  }

  private sparkle(x: number, y: number, c: string, n: number) {
    if (this.host.reduced()) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      this.host.fx.push({
        g: "✦",
        x,
        y,
        z: 26,
        vx: Math.cos(a) * (90 + Math.random() * 80),
        vy: Math.sin(a) * (55 + Math.random() * 50),
        vz: 160 + Math.random() * 120,
        t: 0,
        life: 0.9,
        c,
      });
    }
  }

  /** Ground shadows under boxes in the air and orbs (before the depth pass). */
  shadows(g: CanvasRenderingContext2D) {
    for (const b of this.gifts.values()) {
      const alpha = this.fade(b);
      if (alpha <= 0) continue;
      const s = Math.max(0.35, 1 - b.z / 260);
      g.fillStyle = `rgba(0,0,0,${0.28 * s * alpha})`;
      g.beginPath();
      g.ellipse(b.x, b.y, 22 * s, 8 * s, 0, 0, 7);
      g.fill();
      if (!b.opened) continue;
      for (const o of b.orbs.values()) {
        const p = this.orbAt(b, o);
        g.fillStyle = `rgba(0,0,0,${0.22 * alpha})`;
        g.beginPath();
        g.ellipse(p.x, p.y, 10 * (1 - p.z / 200), 4, 0, 0, 7);
        g.fill();
      }
    }
  }

  /** Night: golden boxes and gift orbs glow (the scene's glow disc). */
  glows(
    glow: (x: number, y: number, r: number, c: string, a: number) => void,
    n: number,
  ) {
    for (const b of this.gifts.values()) {
      const alpha = this.fade(b);
      if (b.g.golden && !b.opened)
        glow(b.x, b.y - 18 - b.z, 60, "255,214,90", 0.7 * n * alpha);
      if (b.opened)
        for (const o of b.orbs.values()) {
          const p = this.orbAt(b, o);
          glow(p.x, p.y - 18 - p.z, 36, "220,190,255", 0.45 * n * alpha);
        }
    }
  }

  /** What to put in the scene's depth sort. */
  drawables(): GiftDrawable[] {
    const out: GiftDrawable[] = [];
    for (const b of this.gifts.values()) {
      const alpha = this.fade(b);
      if (alpha <= 0) continue;
      // The box: in the air, bouncing, or open (empty, fading).
      if (
        !b.opened ||
        b.age < PLAZA_GIFT.flightMs + PLAZA_GIFT.openMs + OPEN_KEEP_MS + FADE_MS
      )
        out.push({
          x: b.x,
          y: b.y,
          z: b.z,
          name: "gift",
          draw: (g, time) => this.drawBox(g, b, time, this.boxAlpha(b)),
        });
      if (!b.opened) continue;
      for (const o of b.orbs.values()) {
        const p = this.orbAt(b, o);
        out.push({
          x: p.x,
          y: p.y,
          z: p.z,
          name: "gift-orb",
          draw: (g, time) => drawOrb(g, p.x, p.y, p.z, o.c, time, alpha),
        });
      }
    }
    return out;
  }

  /** Where an orb is now: hopping out of the box, then lying on its spot. */
  private orbAt(b: Gift, o: Orb) {
    const t = Math.min(
      1,
      Math.max(0, (b.age - PLAZA_GIFT.flightMs - PLAZA_GIFT.openMs) / HOP_MS),
    );
    return {
      x: b.x + (o.x - b.x) * t,
      y: b.y + (o.y - b.y) * t,
      z: 70 * 4 * t * (1 - t) + 14 * (1 - t),
    };
  }
  /** Orbs fade over their last 1.5 s. */
  private fade(b: Gift) {
    return Math.max(0, Math.min(1, (PLAZA_GIFT.lastsMs - b.age) / 1500));
  }
  /** The open box fades after OPEN_KEEP_MS. */
  private boxAlpha(b: Gift) {
    if (!b.opened) return 1;
    const since = b.age - PLAZA_GIFT.flightMs - PLAZA_GIFT.openMs;
    return Math.max(0, Math.min(1, 1 - (since - OPEN_KEEP_MS) / FADE_MS));
  }

  private drawBox(
    g: CanvasRenderingContext2D,
    b: Gift,
    time: number,
    alpha: number,
  ) {
    if (alpha <= 0) return;
    const [body, ribbon, dark] = b.colors;
    g.save();
    g.globalAlpha = alpha;
    g.translate(b.x, b.y - b.z - 13 * BOX_SCALE);
    g.rotate(b.spin);
    g.scale(BOX_SCALE, BOX_SCALE);
    if (b.g.golden && !this.host.low()) {
      // A soft shine round a golden box.
      const pulse = 0.55 + 0.25 * Math.sin(time * 6);
      const gr = g.createRadialGradient(0, -2, 4, 0, -2, 40);
      gr.addColorStop(0, `rgba(255,236,150,${pulse})`);
      gr.addColorStop(1, "rgba(255,236,150,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, -2, 40, 0, 7);
      g.fill();
    }
    // The box: its front, a darker side band, a shine.
    g.fillStyle = body;
    roundRect(g, -16, -11, 32, 24, 4);
    g.fill();
    g.fillStyle = dark;
    roundRect(g, -16, 6, 32, 7, 3);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.28)";
    roundRect(g, -13, -9, 7, 15, 3);
    g.fill();
    // The ribbon down the front.
    g.fillStyle = ribbon;
    g.fillRect(-3.5, -11, 7, 24);
    if (!b.opened) {
      // The lid, its ribbon, and the bow.
      g.fillStyle = body;
      roundRect(g, -18.5, -18, 37, 9, 3);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.3)";
      g.fillRect(-16, -17, 30, 2);
      g.fillStyle = ribbon;
      g.fillRect(-3.5, -18, 7, 9);
      g.beginPath();
      g.ellipse(-7, -21, 7, 4.5, -0.5, 0, 7);
      g.ellipse(7, -21, 7, 4.5, 0.5, 0, 7);
      g.fill();
      g.strokeStyle = dark;
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = ribbon;
      g.beginPath();
      g.arc(0, -20, 3.2, 0, 7);
      g.fill();
    } else {
      // Open: light pouring out of it, fading.
      const since = b.age - PLAZA_GIFT.flightMs - PLAZA_GIFT.openMs,
        k = Math.max(0, 1 - since / 900);
      if (k > 0 && !this.host.low()) {
        const gr = g.createLinearGradient(0, -12, 0, -70);
        gr.addColorStop(0, `rgba(255,246,190,${0.75 * k})`);
        gr.addColorStop(1, "rgba(255,246,190,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(-15, -11);
        g.lineTo(15, -11);
        g.lineTo(26, -70);
        g.lineTo(-26, -70);
        g.closePath();
        g.fill();
      }
      g.fillStyle = "rgba(0,0,0,.35)";
      g.beginPath();
      g.ellipse(0, -11, 15, 3.5, 0, 0, 7);
      g.fill();
    }
    g.restore();
  }
}

/** A gift orb: as the Orb Shower's (a soft glow round a bright core). */
function drawOrb(
  g: CanvasRenderingContext2D,
  x: number,
  y0: number,
  z: number,
  c: string,
  time: number,
  alpha: number,
) {
  const y = y0 - 22 - z + Math.sin(time * 5 + x) * 3,
    gr = g.createRadialGradient(x, y, 2, x, y, 24);
  gr.addColorStop(0, "#fff");
  gr.addColorStop(0.3, c);
  gr.addColorStop(1, c + "00");
  g.globalAlpha = alpha;
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, 24, 0, 7);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(x, y, 6, 0, 7);
  g.fill();
  g.globalAlpha = 1;
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Move a confetti card (or the lid) on: it falls, flutters, lands. */
export function stepConfetti(f: any, dt: number) {
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  // Ribbons and cards flutter down slowly; the lid falls like a lid.
  const drag = f.lid ? 0.6 : 2.6;
  f.vx -= f.vx * drag * dt;
  f.vy -= f.vy * drag * dt;
  f.vz -= (f.lid ? 900 : 520) * dt;
  if (!f.lid) f.vz = Math.max(f.vz, -110);
  f.z = Math.max(0, f.z + f.vz * dt);
  if (f.z === 0) {
    f.vx *= 0.5;
    f.vy *= 0.5;
    f.vr *= 0.5;
  }
  f.rot += f.vr * dt;
}

/** Draw a confetti card, a ribbon, or the lid. */
export function drawConfetti(g: CanvasRenderingContext2D, f: any) {
  const k = f.t / f.life;
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2.2));
  g.translate(f.x, f.y - f.z);
  g.rotate(f.rot);
  // A card seen edge-on as it turns: its width swings.
  const sx = f.lid ? 1 : Math.max(0.15, Math.abs(Math.cos(f.rot * 1.7)));
  g.scale(sx, 1);
  g.fillStyle = f.c;
  g.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
  if (f.lid) {
    g.fillStyle = f.c2;
    g.fillRect(-3.5, -f.h / 2, 7, f.h);
  }
  g.restore();
}

/** An orb from a box counts like a shower orb (PLAZA ORB_SHOWER caps). */
export const GIFT_ORB_DAY_CAP = ORB_SHOWER.perDay;

/** The flash as a box bursts open: a soft disc of light, swelling and fading. */
export function drawFlash(g: CanvasRenderingContext2D, f: any) {
  const k = f.t / f.life,
    r = f.r * (0.45 + 0.7 * k),
    y = f.y - 26;
  const gr = g.createRadialGradient(f.x, y, 0, f.x, y, r);
  gr.addColorStop(0, `rgba(${f.c},${0.85 * (1 - k)})`);
  gr.addColorStop(0.5, `rgba(${f.c},${0.35 * (1 - k)})`);
  gr.addColorStop(1, `rgba(${f.c},0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(f.x, y, r, 0, 7);
  g.fill();
}
