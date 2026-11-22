/**
 * Fishing at the Plaza's pond, in the browser: a fishing mode with its own
 * buttons, the cast, the line and bobber, and the catch. The game server
 * decides when a fish bites and which one (apps/server/src/plaza.ts: cast,
 * reel, stop); this only shows it. Kept apart from plaza-scene.ts, which
 * wires it in: the spot (PLAZA_SPOTS "fish") enters the mode, the scene
 * zooms the camera in on the line while it lasts, and draws the water
 * (after the pond), the rod (over the bodies) and the catch (over all).
 *
 * As in the big games' fishing: the camera comes in close (Genshin Impact's
 * fishing mode, with its own buttons and a way out), the bobber nibbles
 * before the real bite so a nervous tap loses the fish (Animal Crossing), a
 * "!" pops over the angler when it bites and the fish leaps out of the
 * water on a catch (Stardew Valley).
 *
 * Drawing is a handful of strokes and fills a frame, no gradients or glow;
 * Low graphics keeps the bobber, the line, the "!" and the fish's leap, and
 * drops the ripples, the splash rings and the sparkles.
 */
import {
  PLAZA_DOCK,
  PLAZA_FISH,
  PLAZA_FISH_BY_ID,
  PLAZA_FISH_RARITY,
  PLAZA_FISHING,
  PLAZA_POND,
  PLAZA_SPOTS,
  type PlazaFish,
  type PlazaFishNote,
} from "../../../../packages/shared/src/plaza";
import {
  PLAZA_FIGHT,
  plazaFightStart,
  plazaFightStep,
  type PlazaFight,
  type PlazaFightRarity,
} from "../../../../packages/shared/src/plaza-fight";
import { fishArt } from "./plaza-fish-art";

export const FISH_SPOT = PLAZA_SPOTS.find((s) => s.id === "fish")!;
/**
 * The rod as held (world px, from the angler's feet): the paw a little
 * forward and low, the rod 84 long out over the water at rest, its grip
 * reaching back past the paw.
 */
export const ROD = {
  hand: { x: 20, y: 24 },
  length: 84,
  butt: 12,
  rest: -0.62,
} as const;
/** The cast: the rod swings back, then the bobber flies (s). */
const WIND_SECONDS = 0.28;
const FLY_SECONDS = 0.42;
/** A caught fish leaps from the water to the angler (s). */
const LEAP_SECONDS = 0.9;
/** A lost fish: the line comes in slack (LINE_IN_SECONDS), the fish's
 * shadow darts off across the water and "Missed!" floats up (s). */
const MISS_SECONDS = 1.1;
const LINE_IN_SECONDS = 0.45;
/** The fight's close-up comes in over this long (s). */
export const FIGHT_IN_SECONDS = 0.35;
/**
 * Fishing mode's camera: the angler and the whole pond, centred and as big
 * as fit between the HUD's edges (fishing's buttons stand at the sides).
 */
export function fishingFrame(w: number, h: number) {
  const P = PLAZA_POND,
    x0 = FISH_SPOT.x - 70,
    x1 = P.x + P.rx + 30,
    y0 = Math.min(FISH_SPOT.y - 150, P.y - P.ry - 20),
    y1 = P.y + P.ry + 30,
    // Centred on the screen, a touch right of the middle (the angler's
    // side is lighter than the water's); as big as fits with room for
    // fishing's right-hand column of buttons on both sides.
    side = Math.min(150, w * 0.2),
    top = Math.min(70, h * 0.16),
    bottom = Math.min(80, h * 0.2),
    nudge = Math.min(14, w * 0.015),
    z = Math.min((w - side * 2) / (x1 - x0), (h - top - bottom) / (y1 - y0));
  return {
    x: (x0 + x1) / 2 - nudge / z,
    y: (y0 + y1) / 2 - (top - bottom) / 2 / z,
    z,
  };
}

type Ack = (err: unknown, r?: any) => void;
export interface FishingSocket {
  timeout(ms: number): {
    emit(event: string, data: unknown, ack: Ack): void;
  };
  emit(event: string, data: unknown): void;
}
export interface FishingDeps {
  socket: FishingSocket;
  toast(message: string): void;
  /** A fish came in (after its leap): show the catch card. `first`: new to
   * the book when it was reeled in. */
  caught(fish: PlazaFish, first: boolean): void;
  /** Not in the Fish book yet (asked as it is reeled in, before the
   * server's progress counts it). */
  isNew(fish: PlazaFish): boolean;
  /** The mode began or ended, or its phase changed: refresh the HUD. */
  changed(): void;
  /** Low graphics now. */
  low(): boolean;
}
/**
 * The line: none ("idle"), the cast flying, waiting (with nibbles), a bite,
 * a fish leaping in, or a fish that got away.
 */
export type FishingPhase =
  "idle" | "cast" | "wait" | "bite" | "fight" | "leap" | "miss";
/** The fight as drawn (plaza-fight-view.ts) and shown on the HUD. */
export interface FightView {
  rarity: PlazaFightRarity;
  tension: number;
  progress: number;
  thrash: boolean;
  strain: number;
  lo: number;
  hi: number;
  holding: boolean;
  result: PlazaFight["result"];
  /** Seconds since it was hooked. */
  t: number;
}

export function createFishing(deps: FishingDeps) {
  let active = false,
    phase: FishingPhase = "idle",
    /** Seconds in the current phase. */
    t = 0,
    busy = false,
    /** Seconds since the mode began (ripples, bobbing). */
    clock = 0,
    /** Waiting: the next nibble, and how far into the current one (s). */
    nibbleIn = 0,
    nibbleT = -1,
    /** The fish leaping in. */
    leapFish: PlazaFish | null = null,
    leapNew = false,
    /** A short word on the HUD after a miss ("Too soon!"…). */
    note = "",
    /** The fight to land a hooked fish: its steps, the presses and
     * let-goes (as steps, for the server), holding now, time not yet
     * stepped (ms), and whether its end went to the server. */
    fight: PlazaFight | null = null,
    moves: number[] = [],
    holding = false,
    owed = 0,
    landing = false,
    /** How the fight is going, for the hint: in the band, too slack, or
     * straining (the HUD changes only when this does). */
    fightMood: "ok" | "slack" | "strain" = "ok";
  const B = PLAZA_FISHING.bobber;

  const set = (p: FishingPhase) => {
    phase = p;
    t = 0;
    if (p === "wait") {
      nibbleIn = 1 + Math.random() * 1.6;
      nibbleT = -1;
    }
    deps.changed();
  };
  const lose = (word: string) => {
    note = word;
    set("miss");
    if (typeof navigator !== "undefined") navigator.vibrate?.([12, 50, 12]);
  };

  function cast() {
    busy = true;
    note = "";
    deps.socket
      .timeout(5000)
      .emit(
        "plaza-fish",
        { act: "cast", tz: new Date().getTimezoneOffset() },
        (err, r) => {
          busy = false;
          if (!active) return;
          if (err) return deps.toast("The line didn't go out. Try again.");
          if (!r?.ok) return deps.toast(r?.error ?? "You can't fish here.");
          set("cast");
        },
      );
  }
  function reel() {
    busy = true;
    deps.socket.timeout(5000).emit("plaza-fish", { act: "reel" }, (err, r) => {
      busy = false;
      if (!active) return;
      if (err) return lose("The reel slipped");
      if (!r?.ok || !r.hooked || !(r.rarity in PLAZA_FIGHT.fish))
        return lose(
          r?.why === "early"
            ? "Too soon! It swam off"
            : r?.why === "late"
              ? "Too late! It got away"
              : "It got away",
        );
      // Hooked: the fight to land it (the server's seed, the fish's rarity).
      fight = plazaFightStart(r.seed, r.rarity);
      moves = [];
      holding = false;
      owed = 0;
      landing = false;
      fightMood = "ok";
      if (typeof navigator !== "undefined") navigator.vibrate?.([30, 40, 30]);
      set("fight");
    });
  }
  /** The fight is over here: the server runs it again and says. */
  function land() {
    landing = true;
    deps.socket
      .timeout(5000)
      .emit("plaza-fish", { act: "land", moves }, (err, r) => {
        fight = null;
        landing = false;
        if (!active) return;
        if (err) return lose("The line slipped");
        const fish = r?.ok ? PLAZA_FISH_BY_ID[r.fish] : undefined;
        if (!fish)
          return lose(r?.why === "snap" ? "The line snapped!" : "It got away");
        leapFish = fish;
        leapNew = deps.isNew(fish);
        if (typeof navigator !== "undefined") navigator.vibrate?.(30);
        set("leap");
      });
  }

  return {
    /** In fishing mode. */
    get active() {
      return active;
    },
    get phase(): FishingPhase {
      return phase;
    },
    /** The line's state for tests: null with none out. */
    get state(): "cast" | "wait" | "bite" | null {
      return phase === "cast" || phase === "wait" || phase === "bite"
        ? phase
        : null;
    },
    /** The HUD's action button: its word and look. */
    button(): {
      label: string;
      kind: "cast" | "reel" | "bite" | "fight" | "busy";
    } {
      if (phase === "bite") return { label: "Reel!", kind: "bite" };
      if (phase === "fight") return { label: "Hold", kind: "fight" };
      if (phase === "cast" || phase === "wait")
        return { label: "Reel", kind: "reel" };
      if (phase === "leap" || phase === "miss")
        return { label: "…", kind: "busy" };
      return { label: "Cast", kind: "cast" };
    },
    /** The HUD's hint line. */
    hint() {
      switch (phase) {
        case "cast":
          return "Casting…";
        case "wait":
          return "Wait for the bite. A nibble is not a bite!";
        case "bite":
          return "It's biting! Reel it in!";
        case "fight": {
          const name = fight ? PLAZA_FISH_RARITY[fight.rarity].name : "";
          return fightMood === "strain"
            ? "Ease off! The line is straining"
            : fightMood === "slack"
              ? "Reel in! It's swimming off"
              : `${name} fish on! Hold to reel, keep it in the green`;
        }
        case "leap":
          return "Got it!";
        case "miss":
          return note || "It got away";
        default:
          return note ? `${note}. Cast again!` : "Tap Cast to throw your line";
      }
    },
    /** Into fishing mode (at the spot). */
    enter() {
      if (active) return;
      active = true;
      clock = 0;
      note = "";
      phase = "idle";
      t = 0;
      deps.changed();
    },
    /** Out of fishing mode: a line still out comes in, quietly. */
    exit() {
      if (!active) return;
      if (
        phase === "cast" ||
        phase === "wait" ||
        phase === "bite" ||
        (phase === "fight" && !landing)
      )
        deps.socket.emit("plaza-fish", { act: "stop" });
      active = false;
      phase = "idle";
      leapFish = null;
      fight = null;
      landing = false;
      busy = false;
      deps.changed();
    },
    /** Holding the action button (or its key) down, in a fight: reels. */
    hold(on: boolean) {
      if (phase !== "fight" || !fight || fight.result !== "going") return;
      if (on === holding) return;
      holding = on;
      moves.push(fight.tick);
    },
    /** The fight, for its close-up and the HUD (null with none). */
    fightView(): FightView | null {
      if (phase !== "fight" || !fight) return null;
      const k = PLAZA_FIGHT.fish[fight.rarity];
      return {
        rarity: fight.rarity,
        tension: fight.tension,
        progress: fight.progress,
        thrash: fight.thrash,
        strain: fight.strain,
        lo: k.lo,
        hi: k.hi,
        holding,
        result: fight.result,
        t,
      };
    },
    /** The action button: cast, or reel in. */
    act() {
      if (!active || busy) return;
      if (phase === "idle") cast();
      else if (phase === "cast" || phase === "wait" || phase === "bite") reel();
    },
    /** The server's word (socket "plaza-fish"): a bite, or the line is in. */
    onNote(n: PlazaFishNote) {
      if (!active || !n) return;
      if (n.state === "bite" && (phase === "wait" || phase === "cast")) {
        if (typeof navigator !== "undefined") navigator.vibrate?.(60);
        set("bite");
      } else if (n.state === "gone" && phase !== "leap" && !landing) {
        if (n.why === "moved") {
          deps.toast("You walked away from the pond. Line reeled in.");
          this.exit();
        } else lose("Too slow! It got away");
      }
    },
    update(dt: number) {
      if (!active) return;
      clock += dt;
      t += dt;
      if (phase === "fight" && fight) {
        // Steps at the server's pace; the last one's end goes to the server.
        owed += dt * 1000;
        while (owed >= PLAZA_FIGHT.tickMs && fight.result === "going") {
          owed -= PLAZA_FIGHT.tickMs;
          const was = fight.thrash;
          plazaFightStep(fight, holding);
          if (fight.thrash && !was && typeof navigator !== "undefined")
            navigator.vibrate?.(18);
        }
        const k = PLAZA_FIGHT.fish[fight.rarity],
          mood =
            fight.tension >= 0.93
              ? "strain"
              : fight.tension < k.lo && fight.tick > 20
                ? "slack"
                : "ok";
        if (mood !== fightMood) {
          fightMood = mood;
          deps.changed();
        }
        if (fight.result !== "going" && !landing) land();
        return;
      }
      if (phase === "cast" && t >= WIND_SECONDS + FLY_SECONDS) set("wait");
      else if (phase === "wait") {
        if (nibbleT >= 0) {
          nibbleT += dt;
          if (nibbleT > 0.32) {
            nibbleT = -1;
            nibbleIn = 0.9 + Math.random() * 2.2;
          }
        } else if ((nibbleIn -= dt) <= 0) nibbleT = 0;
      } else if (phase === "leap" && t >= LEAP_SECONDS) {
        const fish = leapFish!;
        leapFish = null;
        set("idle");
        deps.caught(fish, leapNew);
      } else if (phase === "miss" && t >= MISS_SECONDS) set("idle");
    },

    /** Leaving the Plaza. */
    reset() {
      active = false;
      phase = "idle";
      busy = false;
      leapFish = null;
      fight = null;
    },
    /** On the water, right after the pond: the dock, the bobber and its ripples. */
    drawWater(g: CanvasRenderingContext2D, time: number) {
      drawDock(g);
      if (
        !active ||
        !(phase === "wait" || phase === "bite" || phase === "miss")
      )
        return;
      const low = deps.low(),
        bite = phase === "bite",
        dip = bite && t < PLAZA_FISHING.windowMs / 1000,
        nib = phase === "wait" && nibbleT >= 0,
        pop = phase === "miss",
        y =
          B.y +
          (dip
            ? 4 + Math.sin(t * 40)
            : nib
              ? Math.sin((nibbleT / 0.32) * Math.PI) * 3
              : Math.sin(time * 3) * 1.5);
      if (pop) {
        // The one that got away: its shadow darts off, away from the dock,
        // and a ring spreads where the bobber was.
        const k = Math.min(1, t / MISS_SECONDS),
          e = 1 - (1 - k) * (1 - k),
          sx = B.x + e * 90,
          sy = B.y + 8 + Math.sin(k * 14) * 2;
        g.fillStyle = `rgba(10,40,70,${0.42 * (1 - k)})`;
        g.beginPath();
        g.ellipse(sx, sy, 13, 4.5, 0, 0, 7);
        g.moveTo(sx - 11, sy);
        g.lineTo(sx - 21, sy - 5 + Math.sin(k * 40) * 2);
        g.lineTo(sx - 21, sy + 5 + Math.sin(k * 40) * 2);
        g.closePath();
        g.fill();
        if (!low) {
          g.strokeStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(B.x, B.y + 2, 8 + e * 34, 3 + e * 12, 0, 0, 7);
          g.stroke();
        }
        return;
      }
      if (!low) {
        g.lineWidth = 1.5;
        // Calm rings while waiting; a small one on a nibble; a splash on the bite.
        for (let i = 0; i < 2; i++) {
          const k = (((clock / 1.6 + i / 2) % 1) + 1) % 1;
          g.strokeStyle = `rgba(255,255,255,${0.4 * (1 - k)})`;
          g.beginPath();
          g.ellipse(B.x, B.y + 2, 6 + k * 22, 2.5 + k * 8, 0, 0, 7);
          g.stroke();
        }
        if (nib) {
          const k = nibbleT / 0.32;
          g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
          g.beginPath();
          g.ellipse(B.x, B.y + 2, 8 + k * 14, 3 + k * 5, 0, 0, 7);
          g.stroke();
        }
        if (dip) {
          const k = Math.min(1, t / 0.5);
          g.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
          g.lineWidth = 3;
          g.beginPath();
          g.ellipse(B.x, B.y + 2, 10 + k * 40, 4 + k * 14, 0, 0, 7);
          g.stroke();
          // Droplets thrown up by the bite.
          g.fillStyle = `rgba(220,245,255,${1 - k})`;
          for (let i = 0; i < 6; i++) {
            const a = Math.PI * (0.15 + (i / 5) * 0.7);
            g.beginPath();
            g.arc(
              B.x - Math.cos(a) * k * 26,
              B.y - Math.sin(a) * k * 30 + k * k * 22,
              2,
              0,
              7,
            );
            g.fill();
          }
        }
      }
      drawBobber(g, B.x, y, dip);
    },
    /** Over the bodies: the rod in the angler's hands, the line, and "!" over the head. */
    drawRod(
      g: CanvasRenderingContext2D,
      me: { x: number; y: number; z: number },
    ) {
      if (!active) return;
      // Held in the front paw, low at the body's side, so the rod leans out
      // over the water and clear of the face (it used to start at the chest
      // and run up across the cheek).
      const d = B.x >= me.x ? 1 : -1,
        hx = me.x + d * ROD.hand.x,
        hy = me.y - ROD.hand.y - me.z;
      // The rod's angle (0 = level toward the water, up is negative): held
      // out, swung back on the cast, then whipped forward; bent on a bite.
      let ang: number = ROD.rest;
      if (phase === "cast") {
        const k = t / WIND_SECONDS;
        ang =
          k < 1
            ? ROD.rest - k * 0.75
            : ROD.rest - 0.75 + Math.min(1, (k - 1) * 2.4) * 1.0;
      } else if (phase === "bite") ang = -0.3 + Math.sin(t * 30) * 0.06;
      else if (phase === "miss")
        ang = -0.35 - Math.min(1, t / MISS_SECONDS) * 0.3;
      else if (phase === "leap")
        ang = -1.05 - Math.sin((t / LEAP_SECONDS) * Math.PI) * 0.35;
      const L = ROD.length,
        cx = Math.cos(ang) * d,
        cy = Math.sin(ang),
        tx = hx + cx * L,
        ty = hy + cy * L,
        // The butt end, a little behind the paw: a grip to hold.
        bx0 = hx - cx * ROD.butt,
        by0 = hy - cy * ROD.butt;
      g.lineCap = "round";
      g.strokeStyle = "#6a4426";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(hx, hy);
      // A bent rod on a bite or a leap: a curve, not a line.
      if (phase === "bite" || phase === "leap")
        g.quadraticCurveTo(
          hx + Math.cos(ang - 0.4) * L * 0.6 * d,
          hy + Math.sin(ang - 0.4) * L * 0.6,
          tx,
          ty,
        );
      else g.lineTo(tx, ty);
      g.stroke();
      // The grip (cork) from the butt to the paw, then the reel under it.
      g.strokeStyle = "#c98a4e";
      g.lineWidth = 4.5;
      g.beginPath();
      g.moveTo(bx0, by0);
      g.lineTo(hx + cx * 3, hy + cy * 3);
      g.stroke();
      g.fillStyle = "#3a2a1a";
      g.beginPath();
      g.arc(hx + cx * 6 - cy * d * 4, hy + cy * 6 + Math.abs(cx) * 4, 3, 0, 7);
      g.fill();
      // The line: to the bobber in flight, on the water, or to the leaping fish.
      let bx = B.x,
        by = B.y,
        line = phase !== "idle";
      if (phase === "cast") {
        const k = Math.max(0, (t - WIND_SECONDS) / FLY_SECONDS);
        bx = tx + (B.x - tx) * k;
        by = ty + (B.y - ty) * k - Math.sin(k * Math.PI) * 70;
        if (k <= 0) line = false;
      } else if (phase === "leap") {
        const p = leapPoint(t / LEAP_SECONDS, me);
        bx = p.x;
        by = p.y;
      } else if (phase === "miss") {
        const k = Math.min(1, t / LINE_IN_SECONDS);
        bx = B.x + (tx - B.x) * k;
        by = B.y + (ty - B.y) * k;
        if (k >= 1) line = false;
      }
      if (line) {
        g.strokeStyle = "rgba(255,255,255,.8)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(tx, ty);
        if (phase === "bite" || phase === "leap") g.lineTo(bx, by);
        else g.quadraticCurveTo((tx + bx) / 2, Math.max(ty, by) + 12, bx, by);
        g.stroke();
      }
      if (phase === "cast" && t > WIND_SECONDS) drawBobber(g, bx, by, false);
      if (phase === "miss" && line) drawBobber(g, bx, by, false);
      // "Missed!" floating up over the angler's head.
      if (phase === "miss") {
        const k = Math.min(1, t / MISS_SECONDS);
        g.save();
        g.globalAlpha = 1 - k * k;
        g.font = "800 22px 'Barlow Condensed', sans-serif";
        g.textAlign = "center";
        g.lineWidth = 4;
        g.strokeStyle = "#0b1020";
        g.fillStyle = "#ff6b6b";
        const y = me.y - me.z - 118 - k * 18;
        g.strokeText("Missed!", me.x, y);
        g.fillText("Missed!", me.x, y);
        g.restore();
      }
      // "!" over the angler's head while the bite lasts.
      if (phase === "bite" && t < PLAZA_FISHING.windowMs / 1000) {
        const s = 1 + Math.max(0, 0.35 - t) * 1.5,
          x = me.x,
          y = me.y - me.z - 132;
        g.save();
        g.translate(x, y);
        g.scale(s, s);
        g.fillStyle = "#fff";
        g.strokeStyle = "#0b1020";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(0, 0, 15, 17, 0, 0, 7);
        g.moveTo(-4, 14);
        g.lineTo(0, 24);
        g.lineTo(4, 14);
        g.fill();
        g.stroke();
        g.fillStyle = "#ef4f61";
        g.font = "900 26px 'Barlow Condensed', sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("!", 0, 1);
        g.restore();
      }
    },
    /** Over everything: the fish leaping out of the water on a catch. */
    drawCatch(
      g: CanvasRenderingContext2D,
      me: { x: number; y: number; z: number },
    ) {
      if (!active || phase !== "leap" || !leapFish) return;
      const k = Math.min(1, t / LEAP_SECONDS),
        p = leapPoint(k, me),
        img = fishImage(leapFish),
        w = 54,
        h = 34;
      if (!deps.low()) {
        // A splash where it left the water, sparkles round it.
        const s = Math.min(1, t / 0.4);
        if (s < 1) {
          g.strokeStyle = `rgba(255,255,255,${0.85 * (1 - s)})`;
          g.lineWidth = 3;
          g.beginPath();
          g.ellipse(B.x, B.y + 2, 10 + s * 36, 4 + s * 12, 0, 0, 7);
          g.stroke();
        }
        g.fillStyle = PLAZA_FISH_RARITY[leapFish.rarity].color;
        for (let i = 0; i < 5; i++) {
          const a = clock * 6 + (i * Math.PI * 2) / 5,
            r = 30 + Math.sin(clock * 9 + i) * 4;
          g.globalAlpha = 0.8;
          g.beginPath();
          g.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.7, 2.5, 0, 7);
          g.fill();
        }
        g.globalAlpha = 1;
      }
      if (img.complete && img.naturalWidth) {
        g.save();
        g.translate(p.x, p.y);
        // Head first along its arc, flipping to face the angler.
        const d = me.x >= B.x ? 1 : -1;
        g.rotate((k - 0.5) * 1.2 * d);
        g.scale(d, 1);
        g.drawImage(img, -w / 2, -h / 2, w, h);
        g.restore();
      }
    },
  };

  /** The leaping fish's place, from the bobber up and over to the angler. */
  function leapPoint(k: number, me: { x: number; y: number; z: number }) {
    const e = 1 - (1 - k) * (1 - k),
      x = B.x + (me.x - B.x) * e * 0.8,
      y = B.y + (me.y - me.z - 70 - B.y) * e - Math.sin(k * Math.PI) * 50;
    return { x, y };
  }
}
export type Fishing = ReturnType<typeof createFishing>;

function drawBobber(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  dip: boolean,
) {
  // Red over white; under water only its red cap shows.
  g.fillStyle = "#fbf7ee";
  if (!dip) {
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI);
    g.fill();
  }
  g.fillStyle = "#ef4f61";
  g.beginPath();
  g.arc(x, y, dip ? 4 : 6, Math.PI, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#7a1f2a";
  g.lineWidth = 1;
  g.beginPath();
  g.arc(x, y, dip ? 4 : 6, 0, Math.PI * 2);
  g.stroke();
}

/** The fish's picture for the canvas (its Fish book art), made once. */
const images = new Map<string, HTMLImageElement>();
function fishImage(f: PlazaFish) {
  let img = images.get(f.id);
  if (!img) {
    img = new Image();
    img.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        fishArt(f, true).replace(
          "<svg ",
          '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="80" ',
        ),
      );
    images.set(f.id, img);
  }
  return img;
}

/**
 * The fishing dock (PLAZA_DOCK): planks across its length from the bank's
 * stones out over the water, a darker edge facing the viewer and posts
 * into the water under it. Fish walks you out to its end.
 */
function drawDock(g: CanvasRenderingContext2D) {
  const { x0, x1, y0, y1 } = PLAZA_DOCK,
    w = x1 - x0,
    h = y1 - y0,
    edge = 6;
  // Its shadow on the water and the posts under the near edge.
  g.fillStyle = "rgba(10,40,70,.28)";
  g.fillRect(x0 + 4, y1 + edge - 1, w - 2, 6);
  g.fillStyle = "#4a2e18";
  for (const px of [x0 + 26, x0 + w * 0.62, x1 - 8])
    g.fillRect(px - 3, y1, 6, edge + 9);
  // The near edge, then the deck.
  g.fillStyle = "#7a5030";
  g.fillRect(x0, y1, w, edge);
  g.fillStyle = "#b07a48";
  g.fillRect(x0, y0, w, h);
  // Planks across it, lighter and darker by turns.
  const n = 7,
    pw = w / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? "#a46f40" : "#bb8552";
    g.fillRect(x0 + i * pw + 1, y0 + 1, pw - 2, h - 2);
  }
  g.strokeStyle = "#6e4628";
  g.lineWidth = 1.5;
  g.beginPath();
  for (let i = 1; i < n; i++) {
    g.moveTo(x0 + i * pw, y0);
    g.lineTo(x0 + i * pw, y1);
  }
  g.rect(x0, y0, w, h + edge);
  g.stroke();
  // Nail heads where the planks cross the joists.
  g.fillStyle = "#5a3a20";
  for (let i = 0; i < n; i++)
    for (const ny of [y0 + 6, y1 - 6])
      g.fillRect(x0 + i * pw + pw / 2 - 1, ny - 1, 2, 2);
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** The Fish book's cards and its "caught / all" count, from the progress. */
export function fishBook(book: Record<string, number> | undefined) {
  const seen = (f: PlazaFish) => book?.[f.id] !== undefined;
  const caught = PLAZA_FISH.filter(seen).length;
  const cards = PLAZA_FISH.map((f) => {
    const known = seen(f),
      r = PLAZA_FISH_RARITY[f.rarity],
      when =
        f.time === "night" ? "Night only" : f.time === "day" ? "Day only" : "";
    return `<li class="pz-fish${known ? "" : " unknown"}" data-fish="${f.id}" style="--rar:${r.color}">${fishArt(f, known)}<b>${known ? esc(f.name) : "???"}</b><small><span class="rar">${r.name}</span>${known ? ` · ${esc(f.element)}` : ""}</small><small>${!known ? when || "Not caught yet" : book![f.id] ? `Caught ×${book![f.id]}` : "Caught"}</small>${known ? "" : `<small class="first">1st catch +${r.firstCoins} coins</small>`}</li>`;
  }).join("");
  return { caught, total: PLAZA_FISH.length, html: cards };
}
/** The card that pops up with a catch: the fish, its name and rarity, and
 * its first-catch coins when it is new to the book. */
export function catchCard(f: PlazaFish, first = false) {
  const r = PLAZA_FISH_RARITY[f.rarity];
  return `<div class="pz-catch-card${first ? " new" : ""}" style="--rar:${r.color}"><span class="rays" aria-hidden="true"></span>${first ? '<span class="badge">NEW</span>' : ""}${fishArt(f, true)}<small>${first ? "First catch!" : "You caught"}</small><b>${esc(f.name)}</b><span class="meta"><i>${r.name}</i> · ${esc(f.element)}</span>${first ? `<em>+${r.firstCoins} coins</em>` : ""}</div>`;
}
