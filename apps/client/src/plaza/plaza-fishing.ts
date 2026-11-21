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
  PLAZA_FISH,
  PLAZA_FISH_BY_ID,
  PLAZA_FISH_RARITY,
  PLAZA_FISHING,
  PLAZA_SPOTS,
  type PlazaFish,
  type PlazaFishNote,
} from "../../../../packages/shared/src/plaza";
import { fishArt } from "./plaza-fish-art";

export const FISH_SPOT = PLAZA_SPOTS.find((s) => s.id === "fish")!;
/** The cast: the rod swings back, then the bobber flies (s). */
const WIND_SECONDS = 0.28;
const FLY_SECONDS = 0.42;
/** A caught fish leaps from the water to the angler (s). */
const LEAP_SECONDS = 0.9;
/** A lost fish: the bobber pops up and the line comes in (s). */
const MISS_SECONDS = 0.45;
/** How much closer the camera comes in fishing mode. */
export const FISHING_ZOOM = 1.45;

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
export type FishingPhase = "idle" | "cast" | "wait" | "bite" | "leap" | "miss";

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
    note = "";
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
      const fish = r?.ok ? PLAZA_FISH_BY_ID[r.fish] : undefined;
      if (!fish)
        return lose(
          r?.why === "early"
            ? "Too soon! It swam off"
            : r?.why === "late"
              ? "Too late! It got away"
              : "It got away",
        );
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
    button(): { label: string; kind: "cast" | "reel" | "bite" | "busy" } {
      if (phase === "bite") return { label: "Reel!", kind: "bite" };
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
      if (phase === "cast" || phase === "wait" || phase === "bite")
        deps.socket.emit("plaza-fish", { act: "stop" });
      active = false;
      phase = "idle";
      leapFish = null;
      busy = false;
      deps.changed();
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
      } else if (n.state === "gone" && phase !== "leap") {
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
    /** Where the camera looks in fishing mode: between angler and bobber. */
    focus(me: { x: number; y: number }) {
      return { x: me.x + (B.x - me.x) * 0.5, y: (me.y - 40 + B.y) / 2 };
    },
    /** Leaving the Plaza. */
    reset() {
      active = false;
      phase = "idle";
      busy = false;
      leapFish = null;
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
              : pop
                ? -Math.sin((t / MISS_SECONDS) * Math.PI) * 8
                : Math.sin(time * 3) * 1.5);
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
      const d = B.x >= me.x ? 1 : -1,
        hx = me.x + d * 12,
        hy = me.y - 30 - me.z;
      // The rod's angle (0 = level toward the water, up is negative): held
      // up, swung back on the cast, then whipped forward; bent on a bite.
      let ang = -1.0;
      if (phase === "cast") {
        const k = t / WIND_SECONDS;
        ang = k < 1 ? -1.0 - k * 0.9 : -1.9 + Math.min(1, (k - 1) * 2.4) * 1.25;
      } else if (phase === "bite") ang = -0.55 + Math.sin(t * 30) * 0.06;
      else if (phase === "leap")
        ang = -1.35 - Math.sin((t / LEAP_SECONDS) * Math.PI) * 0.4;
      const L = 58,
        tx = hx + Math.cos(ang) * L * d,
        ty = hy + Math.sin(ang) * L;
      g.strokeStyle = "#6a4426";
      g.lineWidth = 3;
      g.lineCap = "round";
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
      g.fillStyle = "#3a2a1a";
      g.beginPath();
      g.arc(hx + d * 6, hy - 4, 3, 0, 7);
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
        const k = t / MISS_SECONDS;
        bx = B.x + (tx - B.x) * k;
        by = B.y + (ty - B.y) * k;
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
      if (phase === "miss") drawBobber(g, bx, by, false);
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

/** A little plank dock on the bank by the fishing spot: where to stand. */
function drawDock(g: CanvasRenderingContext2D) {
  const x = FISH_SPOT.x + 6,
    y = FISH_SPOT.y - 12,
    w = 58,
    h = 26;
  g.fillStyle = "#5a3a20";
  g.fillRect(x + 4, y + h - 2, 5, 9);
  g.fillRect(x + w - 9, y + h - 2, 5, 9);
  g.fillStyle = "#b07a48";
  g.fillRect(x, y, w, h);
  g.strokeStyle = "#7a5030";
  g.lineWidth = 1.5;
  g.beginPath();
  for (let i = 1; i < 4; i++) {
    g.moveTo(x + (w * i) / 4, y);
    g.lineTo(x + (w * i) / 4, y + h);
  }
  g.rect(x, y, w, h);
  g.stroke();
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
