/**
 * Elemental Plaza: the shared town. Layout, collision and movement live here
 * so the server (authoritative) and the client (instant local movement)
 * compute exactly the same step.
 */
export const TOWN = {
  width: 1600,
  height: 900,
  /** Players per town copy; more open "Town 2", "Town 3"… */
  capacity: 50,
  /** Walking speed, the same for every fighter (px/s). */
  speed: 230,
  /** Server simulation and update rates (per second). */
  tick: 20,
  send: 10,
  /** A player sees others within this box around them (world px). */
  view: { w: 1400, h: 900 },
  /** How long an emote shows above a head (ms). */
  emoteMs: 2600,
  /** Fighters collide with obstacles as a circle of this radius. */
  radius: 18,
  spawn: { x: 800, y: 640 },
  plaza: { x: 800, y: 470, r: 330 },
} as const;

export const TOWN_EMOTES = ["wave", "heart", "laugh", "gg", "fire"] as const;
export type TownEmote = (typeof TOWN_EMOTES)[number];

/** Round obstacles: the fountain, trees around the plaza, portal pillars. */
export interface TownObstacle {
  x: number;
  y: number;
  /** Horizontal and vertical radius (the floor is seen at a slant). */
  rx: number;
  ry: number;
  kind: "fountain" | "tree" | "pillar" | "stone";
}
export interface TownPortal {
  id: "raids" | "arena" | "boss-rush" | "shop" | "missions";
  x: number;
  y: number;
  label: string;
  sub: string;
  color: string;
}
export const TOWN_PORTALS: readonly TownPortal[] = [
  { id: "raids", x: 800, y: 105, label: "Raid Hub", sub: "Bosses · Peril 1–3", color: "#b59bff" },
  { id: "arena", x: 1430, y: 470, label: "Arena", sub: "Duels · Teams · Arcade", color: "#ffd65b" },
  { id: "boss-rush", x: 170, y: 470, label: "Boss Rush", sub: "Weekly run", color: "#ff7a4f" },
  { id: "shop", x: 300, y: 800, label: "Shop", sub: "Today's picks", color: "#7fe7ff" },
  { id: "missions", x: 1300, y: 800, label: "Missions", sub: "Daily goals", color: "#9be07a" },
];

function buildObstacles(): TownObstacle[] {
  const { x, y, r } = TOWN.plaza;
  const list: TownObstacle[] = [{ x, y, rx: 96, ry: 72, kind: "fountain" }];
  // Eight element stones around the fountain.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    list.push({ x: x + Math.cos(a) * 150, y: y + Math.sin(a) * 150 * 0.78, rx: 16, ry: 12, kind: "stone" });
  }
  // A ring of trees, leaving the five paths open.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2,
      tx = x + Math.cos(a) * (r + 70),
      ty = y + Math.sin(a) * (r + 70) * 0.78;
    if (TOWN_PORTALS.some((p) => Math.hypot(p.x - tx, p.y - ty) < 190)) continue;
    list.push({ x: tx, y: ty, rx: 30, ry: 22, kind: "tree" });
  }
  // Each portal arch has two pillars; the gap between them is open.
  for (const p of TOWN_PORTALS) {
    list.push({ x: p.x - 49, y: p.y, rx: 12, ry: 10, kind: "pillar" });
    list.push({ x: p.x + 49, y: p.y, rx: 12, ry: 10, kind: "pillar" });
  }
  return list;
}
export const TOWN_OBSTACLES: readonly TownObstacle[] = buildObstacles();

/** Keep a point out of every obstacle and inside the map. */
export function townCollide(x: number, y: number) {
  const r = TOWN.radius;
  for (const o of TOWN_OBSTACLES) {
    // Work in a space where the ellipse is a circle.
    const ax = o.rx + r,
      ay = o.ry + r * 0.78,
      dx = (x - o.x) / ax,
      dy = (y - o.y) / ay,
      d = Math.hypot(dx, dy);
    if (d < 1) {
      const k = d > 1e-6 ? 1 / d : 1;
      x = o.x + dx * k * ax + (d > 1e-6 ? 0 : ax);
      y = o.y + dy * k * ay;
    }
  }
  return {
    x: Math.min(TOWN.width - r, Math.max(r, x)),
    y: Math.min(TOWN.height - r, Math.max(r + 40, y)),
  };
}

/** One movement step for a walker; `dx`/`dy` is the stick, clamped to length 1. */
export function townStep(p: { x: number; y: number }, dx: number, dy: number, dt: number) {
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 0.05) return { ...p, moving: false };
  const k = Math.min(1, len) / len,
    step = Math.min(dt, 0.1) * TOWN.speed;
  const next = townCollide(p.x + dx * k * step, p.y + dy * k * step);
  return { ...next, moving: Math.hypot(next.x - p.x, next.y - p.y) > 0.01 };
}

/** Within the box a player can see (with a margin so walkers fade in, not pop). */
export function townCanSee(me: { x: number; y: number }, other: { x: number; y: number }) {
  return Math.abs(other.x - me.x) < TOWN.view.w / 2 + 80 && Math.abs(other.y - me.y) < TOWN.view.h / 2 + 80;
}

/** The server's compact per-player update: [id, x, y, angle, moving, emote]. */
export type TownWalker = [number, number, number, number, 0 | 1, number];
/** Who someone is: sent once when they appear, not every update. */
export interface TownProfile {
  id: number;
  name: string;
  title: string | null;
  titleColor: string | null;
  level: number | null;
  character: string;
  skin: { skin: string; stage?: number } | null;
}
export interface TownState {
  town: number;
  population: number;
  me: number;
  walkers: TownWalker[];
}
