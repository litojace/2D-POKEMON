import { RAID_BOSSES, type RaidBossId } from "./raid-roster.js";

/**
 * Elemental Plaza: the shared town. Layout, collision and movement live here
 * so the server (authoritative) and the client (instant local movement)
 * compute exactly the same step.
 *
 * Five districts around a fountain plaza: Arena Gate (east), Raid Hall
 * (north), Training Grounds (west), Market (south-west) and the Notice Board
 * (south), with houses, a pond and a windmill around them.
 */
export const TOWN = {
  width: 3200,
  height: 2000,
  /** Players per town copy; more open "Town 2", "Town 3"… */
  capacity: 50,
  /** Walking speed, the same for every fighter (px/s). */
  speed: 240,
  /** Server simulation and update rates (per second). */
  tick: 20,
  send: 10,
  /** A player sees others within this box around them (world px). */
  view: { w: 1400, h: 900 },
  /** How long an emote shows above a head (ms). */
  emoteMs: 2600,
  /** A hop in town: how long it lasts and how often you may (ms). */
  jumpMs: 650,
  jumpEveryMs: 800,
  /** Fighters collide with obstacles as a circle of this radius. */
  radius: 18,
  spawn: { x: 1600, y: 1330 },
  plaza: { x: 1600, y: 1080, r: 340 },
} as const;

export const TOWN_EMOTES = ["wave", "heart", "laugh", "gg", "fire"] as const;
export type TownEmote = (typeof TOWN_EMOTES)[number];

/** Round obstacles (ellipses, the floor is seen at a slant) or boxes. */
export type TownObstacle =
  | { shape: "round"; x: number; y: number; rx: number; ry: number; kind: "fountain" | "tree" | "pillar" | "stone" | "statue" | "lamp" | "dummy" | "pond" | "mirror" | "obelisk" | "well" | "bush" | "rock" | "signpost" | "building" }
  | { shape: "box"; x: number; y: number; w: number; h: number; kind: "building" | "stall" | "board" | "crates" };

/** Things a building is: what the art draws for each footprint. */
export type TownBuilding = {
  id: string;
  kind: "coliseum" | "temple" | "tower" | "house" | "windmill";
  /** Centre of the footprint's front edge (where it meets the ground). */
  x: number;
  y: number;
  w: number;
  /** Depth of the footprint (how far back the walls go). */
  d: number;
  variant?: number;
};

export type TownSpotId =
  | "arena"
  | "raids"
  | "boss-rush"
  | "shop"
  | "wardrobe"
  | "missions"
  | "training"
  | "leaderboard";
/** A place you walk up to: press E (or tap) to open what it offers. */
export interface TownSpot {
  id: TownSpotId;
  x: number;
  y: number;
  label: string;
  sub: string;
  color: string;
  /**
   * How close you must stand (world px). The glowing pad on the ground
   * covers the inner part of this, so standing anywhere on it works.
   */
  reach: number;
  /** Raid Hall statues open the Raid Hub at their boss. */
  boss?: RaidBossId;
  /** Shop stalls open the Shop at a tab. */
  tab?: "today" | "champions" | "mythic" | "collections";
}

export interface TownDistrict {
  id: "arena" | "raid" | "training" | "market" | "board";
  x: number;
  y: number;
  label: string;
  sub: string;
  color: string;
}
export const TOWN_DISTRICTS: readonly TownDistrict[] = [
  { id: "arena", x: 2700, y: 1080, label: "Arena Gate", sub: "Duels · Teams · Free-for-all", color: "#ffd65b" },
  { id: "raid", x: 1600, y: 560, label: "Raid Hall", sub: "Seven bosses · Raid of the Day", color: "#b59bff" },
  { id: "training", x: 620, y: 900, label: "Training Grounds", sub: "Bots · Solo test · Boss Rush", color: "#ff7a4f" },
  { id: "market", x: 720, y: 1580, label: "Market", sub: "Shop · Wardrobe", color: "#7fe7ff" },
  { id: "board", x: 1600, y: 1740, label: "Notice Board", sub: "Daily missions · Top players", color: "#9be07a" },
];

export const TOWN_BUILDINGS: readonly TownBuilding[] = [
  { id: "coliseum", kind: "coliseum", x: 2700, y: 1010, w: 520, d: 210 },
  { id: "raid-hall", kind: "temple", x: 1600, y: 450, w: 620, d: 170 },
  { id: "boss-rush", kind: "tower", x: 360, y: 700, w: 150, d: 90 },
  { id: "windmill", kind: "windmill", x: 2860, y: 420, w: 150, d: 90 },
  // Houses around the edge of town.
  { id: "house-1", kind: "house", x: 2230, y: 380, w: 210, d: 110, variant: 0 },
  { id: "house-2", kind: "house", x: 960, y: 360, w: 200, d: 110, variant: 1 },
  { id: "house-3", kind: "house", x: 2260, y: 1700, w: 220, d: 110, variant: 2 },
  { id: "house-4", kind: "house", x: 2560, y: 1880, w: 200, d: 100, variant: 0 },
  { id: "house-5", kind: "house", x: 250, y: 1300, w: 200, d: 110, variant: 1 },
  { id: "house-6", kind: "house", x: 1100, y: 1880, w: 210, d: 100, variant: 2 },
  { id: "house-7", kind: "house", x: 3020, y: 1450, w: 200, d: 110, variant: 1 },
];

/** Raid Hall statues stand in an arc in front of the hall. */
const STATUE_ORDER: RaidBossId[] = ["grumblecrag", "tidewyrm", "gloomshade", "somnara", "prismatail", "emberwing", "storm-twins"];
// Four on the left, three on the right (a pedestal waits for the next boss),
// with a wide aisle up the middle to the hall doors.
const STATUE_X = [1145, 1250, 1355, 1460, 1740, 1845, 1950, 2055];
const statueAt = (x: number) => ({ x, y: Math.round(650 - ((x - 1600) / 460) ** 2 * 60) });
export const TOWN_STATUES = STATUE_ORDER.map((boss, i) => ({ boss, ...statueAt(STATUE_X[i]) }));
/** The empty pedestal at the end of the right-hand row. */
export const TOWN_NEXT_STATUE = statueAt(STATUE_X[7]);

/** Market stalls: their footprint centres. */
export const TOWN_STALLS = [
  { x: 520, y: 1520, tab: "champions" as const, label: "Champion skins", color: "#ff7a9b" },
  { x: 720, y: 1490, tab: "today" as const, label: "Today's picks", color: "#7fe7ff" },
  { x: 920, y: 1520, tab: "collections" as const, label: "Collections", color: "#ffd65b" },
];
export const TOWN_POND = { x: 2620, y: 1520, rx: 190, ry: 110 };
export const TOWN_DUMMIES = [
  { x: 560, y: 900 },
  { x: 660, y: 950 },
  { x: 760, y: 900 },
];

export const TOWN_SPOTS: readonly TownSpot[] = [
  { id: "arena", x: 2700, y: 1060, label: "Arena Gate", sub: "Start or join a match", color: "#ffd65b", reach: 120 },
  { id: "raids", x: 1600, y: 500, label: "Raid Hall", sub: "Open the Raid Hub", color: "#b59bff", reach: 110 },
  ...TOWN_STATUES.map((s) => ({
    id: "raids" as const,
    x: s.x,
    y: s.y + 34,
    label: RAID_BOSSES[s.boss].name,
    sub: RAID_BOSSES[s.boss].epithet,
    color: RAID_BOSSES[s.boss].color,
    reach: 52,
    boss: s.boss,
  })),
  { id: "boss-rush", x: 360, y: 750, label: "Boss Rush", sub: "This week's run", color: "#ff7a4f", reach: 95 },
  { id: "training", x: 660, y: 1010, label: "Training Grounds", sub: "Battle a bot or test skills", color: "#ff9b6a", reach: 110 },
  ...TOWN_STALLS.map((s) => ({ id: "shop" as const, x: s.x, y: s.y + 62, label: s.label, sub: "Shop", color: s.color, reach: 80, tab: s.tab })),
  { id: "wardrobe", x: 1110, y: 1630, label: "Wardrobe", sub: "Change your look", color: "#bfefff", reach: 80 },
  { id: "missions", x: 1600, y: 1740, label: "Notice Board", sub: "Daily missions", color: "#9be07a", reach: 110 },
  { id: "leaderboard", x: 2240, y: 1300, label: "Champions' Obelisk", sub: "Top players this month", color: "#ffe58f", reach: 90 },
];

/** Lamps on the grass just outside the plaza ring, clear of the roads (degrees: 0 = east, 90 = south). */
const RING = 405;
const onRing = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.round(TOWN.plaza.x + Math.cos(a) * RING), y: Math.round(TOWN.plaza.y + Math.sin(a) * RING * 0.78) };
};
export const TOWN_PLAZA_LAMPS = [26, 70, 214, 242, 298, 334].map(onRing);
function buildObstacles(): TownObstacle[] {
  const { x, y } = TOWN.plaza;
  const list: TownObstacle[] = [{ shape: "round", x, y, rx: 100, ry: 76, kind: "fountain" }];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    list.push({ shape: "round", x: x + Math.cos(a) * 175, y: y + Math.sin(a) * 175 * 0.78, rx: 16, ry: 12, kind: "stone" });
  }
  for (const b of TOWN_BUILDINGS)
    list.push(
      b.kind === "coliseum"
        ? // A round building on a round podium (centre of its foot, plus the steps).
          { shape: "round", x: b.x, y: b.y - 96, rx: b.w / 2 + 34, ry: 92, kind: "building" }
        : { shape: "box", x: b.x, y: b.y - b.d / 2, w: b.w, h: b.d, kind: "building" },
    );
  for (const s of [...TOWN_STATUES, TOWN_NEXT_STATUE]) list.push({ shape: "round", x: s.x, y: s.y, rx: 30, ry: 16, kind: "statue" });
  for (const s of TOWN_STALLS) list.push({ shape: "box", x: s.x, y: s.y, w: 160, h: 50, kind: "stall" });
  for (const d of TOWN_DUMMIES) list.push({ shape: "round", x: d.x, y: d.y, rx: 14, ry: 10, kind: "dummy" });
  list.push({ shape: "round", x: TOWN_POND.x, y: TOWN_POND.y, rx: TOWN_POND.rx, ry: TOWN_POND.ry, kind: "pond" });
  list.push({ shape: "round", x: 1110, y: 1590, rx: 22, ry: 12, kind: "mirror" });
  list.push({ shape: "round", x: 2240, y: 1260, rx: 30, ry: 18, kind: "obelisk" });
  list.push({ shape: "box", x: 1600, y: 1690, w: 280, h: 30, kind: "board" });
  // Lamps around the plaza and along the main roads.
  const lamps = [
    ...TOWN_PLAZA_LAMPS.map((l) => [l.x, l.y]), [2150, 1010], [2150, 1160], [1500, 760], [1050, 1010], [1300, 1560], [1900, 1560],
  ];
  for (const [lx, ly] of lamps) list.push({ shape: "round", x: lx, y: ly, rx: 8, ry: 6, kind: "lamp" });
  for (const [cx, cy] of [[400, 1600], [1030, 1450], [2520, 1260]]) list.push({ shape: "box", x: cx, y: cy, w: 60, h: 30, kind: "crates" });
  list.push({ shape: "round", x: 2440, y: 600, rx: 30, ry: 20, kind: "well" });
  // Trees: a forest border plus groves, kept off roads, districts and buildings.
  for (const t of TOWN_TREES) list.push({ shape: "round", x: t.x, y: t.y, rx: 26, ry: 18, kind: "tree" });
  for (const p of TOWN_SIGNPOSTS) list.push({ shape: "round", x: p.x, y: p.y, rx: 8, ry: 6, kind: "signpost" });
  return list;
}

/** Roads the trees keep clear of: plaza → each district, and an outer loop. */
export const TOWN_ROADS: readonly [number, number, number, number][] = [
  [1600, 1080, 2700, 1080],
  [1600, 1080, 1600, 520],
  [1600, 1080, 640, 960],
  [1600, 1080, 760, 1600],
  [1600, 1080, 1600, 1760],
  [640, 960, 360, 760],
  [2700, 1080, 2620, 1360],
  [1600, 520, 2230, 420],
  [1600, 520, 960, 400],
  [2700, 1080, 2860, 460],
  [760, 1600, 1100, 1880],
  [1600, 1760, 2260, 1720],
  [640, 960, 250, 1320],
];
const nearRoad = (x: number, y: number, pad: number) =>
  TOWN_ROADS.some(([x1, y1, x2, y2]) => {
    const dx = x2 - x1,
      dy = y2 - y1,
      t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t)) < pad;
  });
/** The Raid Hall's marble terrace (and a margin): no trees or bushes on it. */
const onTerrace = (x: number, y: number) => x > 1020 && x < 2180 && y > 360 && y < 790;
const rnd = (i: number) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function buildTrees() {
  const trees: { x: number; y: number; variant: number }[] = [];
  const clear = (x: number, y: number) =>
    !nearRoad(x, y, 120) &&
    !onTerrace(x, y) &&
    // Keep every station (and the thing it belongs to) in view.
    !TOWN_SPOTS.some((sp) => Math.abs(sp.x - x) < 130 && y > sp.y - 220 && y < sp.y + 120) &&
    Math.hypot((x - TOWN.plaza.x) / 1.25, y - TOWN.plaza.y) > TOWN.plaza.r + 90 &&
    !TOWN_DISTRICTS.some((d) => Math.hypot((d.x - x) / 1.4, d.y - y) < 260) &&
    !TOWN_BUILDINGS.some((b) => x > b.x - b.w / 2 - 70 && x < b.x + b.w / 2 + 70 && y > b.y - b.d - 160 && y < b.y + 90) &&
    Math.hypot((x - TOWN_POND.x) / TOWN_POND.rx, (y - TOWN_POND.y) / TOWN_POND.ry) > 1.5 &&
    trees.every((t) => Math.hypot(t.x - x, (t.y - y) * 1.3) > 85);
  // A ring of forest just inside the map edge.
  for (let i = 0; i < 260 && trees.length < 90; i++) {
    const side = i % 4,
      along = rnd(i) * (side % 2 ? TOWN.height : TOWN.width),
      inset = 60 + rnd(i + 0.3) * 120;
    const x = side === 0 ? along : side === 1 ? TOWN.width - inset : side === 2 ? along : inset,
      y = side === 0 ? inset + 40 : side === 1 ? along : side === 2 ? TOWN.height - inset : along;
    if (clear(x, y)) trees.push({ x: Math.round(x), y: Math.round(y), variant: i % 5 });
  }
  // Groves between districts.
  for (let i = 0; i < 400 && trees.length < 150; i++) {
    const x = 200 + rnd(i * 3 + 11) * (TOWN.width - 400),
      y = 220 + rnd(i * 7 + 5) * (TOWN.height - 400);
    if (clear(x, y)) trees.push({ x: Math.round(x), y: Math.round(y), variant: (i + 1) % 5 });
  }
  return trees;
}
export const TOWN_TREES = buildTrees();

/**
 * Signposts where the five main roads leave the plaza, on the grass to the
 * right of each road, pointing the way to its district.
 */
const ROAD_TO: TownDistrict["id"][] = ["arena", "raid", "training", "market", "board"];
export const TOWN_SIGNPOSTS = TOWN_ROADS.slice(0, 5).map(([x1, y1, x2, y2], i) => {
  const len = Math.hypot(x2 - x1, y2 - y1),
    ux = (x2 - x1) / len,
    uy = (y2 - y1) / len,
    d = TOWN_DISTRICTS.find((dd) => dd.id === ROAD_TO[i])!;
  // Just past the plaza's edge along the road, then off to its right side.
  const along = Math.hypot(TOWN.plaza.r * ux, TOWN.plaza.r * 0.78 * uy) + 50;
  return {
    x: Math.round(x1 + ux * along - uy * 92),
    y: Math.round(y1 + uy * along + ux * 92 * 0.78),
    label: d.label,
    color: d.color,
    /**
     * Which way the board points: toward the district for side roads, and
     * away from the road for roads running up or down the screen, so the
     * board never hangs over the path people walk on.
     */
    left: Math.abs(ux) > 0.2 ? ux < 0 : -uy < 0,
  };
});

const BASE_OBSTACLES = buildObstacles();
/** Inside an obstacle (grown by `pad`)? */
function blocked(x: number, y: number, pad: number) {
  return BASE_OBSTACLES.some((o) =>
    o.shape === "round"
      ? Math.hypot((x - o.x) / (o.rx + pad), (y - o.y) / (o.ry + pad * 0.78)) < 1
      : Math.abs(x - o.x) < o.w / 2 + pad && Math.abs(y - o.y) < o.h / 2 + pad * 0.78,
  );
}
/**
 * Bushes and boulders: beside houses, along the grass between districts and
 * around the pond, kept off roads, stations, floors and each other.
 */
function buildShrubs() {
  const out: { x: number; y: number; kind: "bush" | "rock"; variant: number }[] = [];
  const ok = (x: number, y: number, pad = 34) =>
    x > 80 &&
    x < TOWN.width - 80 &&
    y > 120 &&
    y < TOWN.height - 60 &&
    !nearRoad(x, y, 92) &&
    !onTerrace(x, y) &&
    !blocked(x, y, pad) &&
    Math.hypot((x - TOWN.plaza.x) / 1.25, y - TOWN.plaza.y) > TOWN.plaza.r + 70 &&
    !TOWN_DISTRICTS.some((d) => Math.hypot((d.x - x) / 1.4, d.y - y) < 240) &&
    !TOWN_SPOTS.some((s) => Math.hypot(s.x - x, s.y - y) < 120) &&
    out.every((b) => Math.hypot(b.x - x, (b.y - y) * 1.3) > 56);
  // Beside each house's front corners.
  for (const b of TOWN_BUILDINGS.filter((bb) => bb.kind === "house"))
    for (const side of [-1, 1]) {
      const x = b.x + side * (b.w / 2 + 34),
        y = b.y - 8;
      if (ok(x, y, 20)) out.push({ x, y, kind: "bush", variant: out.length % 3 });
    }
  // Rocks on the pond's shore.
  for (let k = 0; k < 8; k++) {
    const a = Math.PI * (0.15 + k * 0.23),
      x = Math.round(TOWN_POND.x + Math.cos(a) * (TOWN_POND.rx + 34)),
      y = Math.round(TOWN_POND.y + Math.sin(a) * (TOWN_POND.ry + 26));
    if (ok(x, y, 14)) out.push({ x, y, kind: k % 3 ? "rock" : "bush", variant: k % 3 });
  }
  // Scattered over the grass, in little clumps.
  for (let i = 0; i < 900 && out.length < 120; i++) {
    const x = Math.round(140 + rnd(i * 5 + 41) * (TOWN.width - 280)),
      y = Math.round(180 + rnd(i * 9 + 13) * (TOWN.height - 300));
    if (ok(x, y)) out.push({ x, y, kind: i % 5 === 0 ? "rock" : "bush", variant: i % 3 });
  }
  return out;
}
export const TOWN_SHRUBS = buildShrubs();
export const TOWN_OBSTACLES: readonly TownObstacle[] = [
  ...BASE_OBSTACLES,
  ...TOWN_SHRUBS.map((b): TownObstacle => ({ shape: "round", x: b.x, y: b.y, rx: b.kind === "rock" ? 16 : 20, ry: b.kind === "rock" ? 10 : 12, kind: b.kind })),
];

/** Keep a point out of every obstacle and inside the map. */
export function townCollide(x: number, y: number) {
  const r = TOWN.radius;
  for (const o of TOWN_OBSTACLES) {
    if (o.shape === "round") {
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
    } else {
      // A box, grown by the walker's radius: leave by the nearest side.
      const hw = o.w / 2 + r,
        hh = o.h / 2 + r * 0.78;
      const dx = x - o.x,
        dy = y - o.y;
      if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
        const px = hw - Math.abs(dx),
          py = hh - Math.abs(dy);
        if (px < py) x = o.x + Math.sign(dx || 1) * hw;
        else y = o.y + Math.sign(dy || 1) * hh;
      }
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

/** The server's compact per-player update: [id, x, y, angle, moving, emote, jumping]. */
export type TownWalker = [number, number, number, number, 0 | 1, number, 0 | 1];
/** Height of a town hop at `ms` into it (world px; 0 when not jumping). */
export function townHop(ms: number) {
  return ms >= 0 && ms < TOWN.jumpMs ? Math.sin((Math.PI * ms) / TOWN.jumpMs) * 42 : 0;
}
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
