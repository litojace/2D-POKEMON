/**
 * Fishing at the Plaza's pond, in the browser: the line, the bobber and the
 * Fish book. The game server decides when a fish bites and which one
 * (apps/server/src/plaza.ts: cast, reel); this only shows it. Kept apart from
 * plaza-scene.ts, which wires it in: the spot (PLAZA_SPOTS "fish"), a draw
 * on the water after the pond and one over the bodies (the rod and line).
 *
 * Drawing is a handful of strokes and fills a frame, no gradients or glow;
 * Low graphics draws the bobber and line only (no ripples or splash).
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
/** The bobber's flight from the rod to the water (s). */
const CAST_SECONDS = 0.4;

type Ack = (err: unknown, r?: any) => void;
export interface FishingSocket {
  timeout(ms: number): {
    emit(event: string, data: unknown, ack: Ack): void;
  };
}
export interface FishingDeps {
  socket: FishingSocket;
  toast(message: string): void;
  /** A fish came in: where to celebrate. */
  caught(fish: PlazaFish): void;
  /** Low graphics now. */
  low(): boolean;
}
export type LineState = "cast" | "wait" | "bite";

export function createFishing(deps: FishingDeps) {
  let line: { state: LineState; t: number } | null = null,
    busy = false,
    /** Seconds the bobber's ripples have run (drawn from this). */
    clock = 0;
  const B = PLAZA_FISHING.bobber;

  function cast() {
    busy = true;
    deps.socket
      .timeout(5000)
      .emit(
        "plaza-fish",
        { act: "cast", tz: new Date().getTimezoneOffset() },
        (err, r) => {
          busy = false;
          if (err) return deps.toast("The line didn't go out. Try again.");
          if (!r?.ok) return deps.toast(r?.error ?? "You can't fish here.");
          line = { state: "cast", t: 0 };
        },
      );
  }
  function reel() {
    busy = true;
    deps.socket.timeout(5000).emit("plaza-fish", { act: "reel" }, (err, r) => {
      busy = false;
      line = null;
      if (err) return deps.toast("The reel slipped. Cast again.");
      const fish = r?.ok ? PLAZA_FISH_BY_ID[r.fish] : undefined;
      if (!fish) return deps.toast(r?.error ?? "The fish got away.");
      // The catch card says it (the fish, its name and rarity): no toast.
      deps.caught(fish);
    });
  }
  return {
    /** The line's state, or null with none out. */
    get state(): LineState | null {
      return line?.state ?? null;
    },
    /** The interact button's word. */
    label() {
      return !line
        ? FISH_SPOT.label
        : line.state === "bite"
          ? "Reel!"
          : "Reel in";
    },
    /** The spot's action: cast, or reel in what's on the line. */
    act() {
      if (busy) return;
      if (line) reel();
      else cast();
    },
    /** The server's word (socket "plaza-fish"): a bite, or the line is in. */
    onNote(note: PlazaFishNote) {
      if (!line || !note) return;
      if (note.state === "bite") line = { state: "bite", t: 0 };
      else if (note.state === "gone") {
        line = null;
        deps.toast(
          note.why === "moved"
            ? "You walked away from the pond. Line reeled in."
            : "The fish got away.",
        );
      }
    },
    update(dt: number) {
      clock += dt;
      if (!line) return;
      line.t += dt;
      if (line.state === "cast" && line.t >= CAST_SECONDS)
        line = { state: "wait", t: 0 };
    },
    /** Leaving the Plaza, or the server's copy is gone. */
    reset() {
      line = null;
      busy = false;
    },
    /** On the water, right after the pond: the dock, the bobber and its ripples. */
    drawWater(g: CanvasRenderingContext2D, time: number) {
      drawDock(g);
      if (!line || line.state === "cast") return;
      const low = deps.low();
      const bite = line.state === "bite",
        // Under the window, the bobber is pulled down and shakes.
        dip = bite && line.t < PLAZA_FISHING.windowMs / 1000,
        y = B.y + (dip ? 4 + Math.sin(line.t * 40) : Math.sin(time * 3) * 1.5);
      if (!low) {
        g.lineWidth = 1.5;
        // Two calm rings while waiting; a splash ring on the bite.
        for (let i = 0; i < 2; i++) {
          const k = (((clock / 1.6 + i / 2) % 1) + 1) % 1;
          g.strokeStyle = `rgba(255,255,255,${0.45 * (1 - k)})`;
          g.beginPath();
          g.ellipse(B.x, B.y + 2, 6 + k * 22, 2.5 + k * 8, 0, 0, 7);
          g.stroke();
        }
        if (dip) {
          const k = Math.min(1, line.t / 0.5);
          g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
          g.lineWidth = 2.5;
          g.beginPath();
          g.ellipse(B.x, B.y + 2, 10 + k * 34, 4 + k * 12, 0, 0, 7);
          g.stroke();
        }
      }
      // The bobber: red over white; under water only its red cap shows.
      g.fillStyle = "#fbf7ee";
      if (!dip) {
        g.beginPath();
        g.arc(B.x, y, 6, 0, Math.PI);
        g.fill();
      }
      g.fillStyle = "#ef4f61";
      g.beginPath();
      g.arc(B.x, y, dip ? 4 : 6, Math.PI, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#7a1f2a";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(B.x, y, dip ? 4 : 6, 0, Math.PI * 2);
      g.stroke();
    },
    /** Over the bodies: the rod in the angler's hands, the line, and "!" on a bite. */
    drawRod(
      g: CanvasRenderingContext2D,
      me: { x: number; y: number; z: number },
    ) {
      if (!line) return;
      const d = B.x >= me.x ? 1 : -1,
        hx = me.x + d * 12,
        hy = me.y - 30 - me.z,
        tx = me.x + d * 44,
        ty = me.y - 84 - me.z;
      g.strokeStyle = "#6a4426";
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(tx, ty);
      g.stroke();
      // The bobber flies out on a cast, then rests on the water.
      let bx = B.x,
        by = B.y;
      if (line.state === "cast") {
        const k = Math.min(1, line.t / CAST_SECONDS);
        bx = tx + (B.x - tx) * k;
        by = ty + (B.y - ty) * k - Math.sin(k * Math.PI) * 60;
      }
      g.strokeStyle = "rgba(255,255,255,.75)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(tx, ty);
      g.quadraticCurveTo((tx + bx) / 2, Math.max(ty, by) + 10, bx, by);
      g.stroke();
      if (line.state === "cast") {
        g.fillStyle = "#ef4f61";
        g.beginPath();
        g.arc(bx, by, 5, 0, 7);
        g.fill();
      }
      if (line.state === "bite" && line.t < PLAZA_FISHING.windowMs / 1000) {
        g.font = "800 34px 'Barlow Condensed', sans-serif";
        g.textAlign = "center";
        g.lineWidth = 5;
        g.strokeStyle = "#0b1020";
        g.fillStyle = "#ffd65b";
        g.strokeText("!", B.x, B.y - 22);
        g.fillText("!", B.x, B.y - 22);
      }
    },
  };
}
export type Fishing = ReturnType<typeof createFishing>;

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
    return `<li class="pz-fish${known ? "" : " unknown"}" data-fish="${f.id}" style="--rar:${r.color}">${fishArt(f, known)}<b>${known ? esc(f.name) : "???"}</b><small><span class="rar">${r.name}</span>${known ? ` · ${esc(f.element)}` : ""}</small><small>${!known ? when || "Not caught yet" : book![f.id] ? `Caught ×${book![f.id]}` : "Caught"}</small></li>`;
  }).join("");
  return { caught, total: PLAZA_FISH.length, html: cards };
}
/** The card that pops up with a catch: the fish, its name and rarity. */
export function catchCard(f: PlazaFish) {
  const r = PLAZA_FISH_RARITY[f.rarity];
  return `<div class="pz-catch-card" style="--rar:${r.color}">${fishArt(f, true)}<div><small>You caught</small><b>${esc(f.name)}</b><span><i>${r.name}</i> · ${esc(f.element)}</span></div></div>`;
}
