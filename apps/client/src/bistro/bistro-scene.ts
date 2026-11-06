/*
 * Element Bistro (demo): the scene. An isometric restaurant on a canvas with
 * a DOM HUD on top. The chef (your Lobby fighter) cooks what you pick on the
 * stoves; tap a pot in its golden moment for a perfect dish, tap it when it
 * is done to put it on the counter. Creatures from the roster come in, sit
 * at a chair next to a table, order from the counter; the waiter brings it,
 * they eat and leave coins on the table for you to tap. The state lives on
 * this device (see bistro-model.ts for the rules).
 */
import { CHARACTERS, type CharacterId } from "../../../../packages/shared/src";
import type { Facing } from "../animation/controller";
import { creatureSvg, type Mood } from "../creature-design";
import { deviceTimeOfDay, goldenLevel, nightLevel } from "../farm/farm-feel";
import { farmIcon as I } from "../farm/farm-icons";
import type { FarmCue } from "../farm/farm-sound";
import { fadeIn } from "../ui/motion";
import {
  BOUNDS,
  R,
  WINDOWS,
  setRoomSize,
  dishIconUrl,
  drawChair,
  drawCounterTile,
  drawDish,
  drawDoorAndBoard,
  drawFestoon,
  drawFixture,
  drawGroundShadow,
  drawItem,
  drawLeftovers,
  drawPot,
  drawShell,
  drawSparkle,
  drawWindows,
  festoonPoints,
  iso,
  itemGlow,
  itemIconUrl,
  softShadow,
  tableSpot,
  type Light,
} from "./bistro-art";
import {
  COMBO_MAX,
  COMBO_SECONDS,
  COUNTER_ROW,
  COUNTER_SLOTS,
  COUNTER_X1,
  DISHES,
  DISH_BY_ID,
  DOOR,
  FLOORS,
  ITEMS,
  ITEM_BY_KIND,
  MAX_STOVES,
  PERFECT_BONUS,
  PERFECT_FROM,
  PERFECT_TO,
  STOVE_TILES,
  WAITER_HOME,
  HIRE_STEPS,
  BISTRO_TRADE,
  DINE,
  isDish,
  RUSH_PERIOD,
  RUSH_SECONDS,
  inRush,
  KITCHEN_PRICES,
  SHIFT_HOURS,
  SHIFT_PRICES,
  STAFF_MAX_LEVEL,
  autoKitchen,
  buyKitchen,
  buyShift,
  candidates,
  cookStove,
  hire,
  nextHire,
  setCookDish,
  simulateAway,
  staffOf,
  staffSpeed,
  staffUpgradePrice,
  stoveMs,
  unlockedDishes,
  upgradeStaff,
  type AwayReport,
  type Staff,
  WALLS,
  addXp,
  approach,
  arrivalSeconds,
  blockedGrid,
  buyItem,
  buyStove,
  buyStyle,
  sizeOf,
  EXPAND_STEPS,
  charm,
  cookProgress,
  findPath,
  heartsFor,
  inPerfectWindow,
  nextStovePrice,
  patienceSeconds,
  payment,
  pickOrder,
  pickupTile,
  plate,
  putAway,
  rate,
  sanitize,
  seats,
  servingsLeft,
  startCooking,
  stir,
  takeServing,
  todaySpecial,
  tryPlace,
  xpToNext,
  type BistroState,
  type DishId,
  type Item,
  type ItemKind,
  type Seat,
  DIRTY_SECONDS,
  distField,
  layoutStats,
  popTier,
  popularity,
  queueMax,
  queuePatience,
  seatHeat,
  vipShare,
  type LayoutStats,
  type PopInput,
  type SeatWalk,
  FEED_COOLDOWN_MS,
  LITTER_RATE,
  energyMax,
  energyNow,
  fullestSlot,
  moodName,
  workSpeed,
  type Role,
} from "./bistro-model";
import {
  carGlows,
  drawFrontLamps,
  drawRoofSign,
  drawSceneryLive,
  drawSceneryStatic,
  roofSignGlow,
  sceneryGlows,
  updateCars,
  type Car,
} from "./bistro-scenery";
import * as Rules from "./bistro-model";
import {
  BistroSync,
  applyLocal,
  readServer,
  friendNames,
  type BistroAction,
  type BistroApi,
  type BistroExtras,
  type SyncSnapshot,
} from "./bistro-sync";
import "./bistro.css";

export interface BistroFriend {
  id: string;
  name: string;
  fighter: string;
  level: number;
  rating: number;
  likes: number;
  served: number;
  servings: number;
  dined: boolean;
  liked: boolean;
  /** 0..50 (migration 070; older servers leave it out). */
  popularity?: number;
}
export interface BistroOptions {
  /** Whose bistro (the account id): keeps it ready this session. */
  owner?: string;
  /** The server (migration 068): your bistro, its actions, friends' bistros. */
  api: BistroApi & {
    friends(): Promise<BistroFriend[]>;
    visit(id: string): Promise<unknown>;
    visitAct(friend: string, kind: "dine" | "like"): Promise<unknown>;
  };
  /** The Gold Leaf balance changed (a trade): the top bar's pill. */
  onLeaves?(balance: number): void;
  playerName(): string;
  /** The Lobby fighter: the head chef. */
  character(): string;
  toast(message: string): void;
  sound?(cue: FarmCue, step?: number): void;
  reduced: boolean;
  low?: boolean;
}
export interface BistroHandle {
  hide(): void;
  show(): void;
  close(): void;
}

const ROSTER = Object.keys(CHARACTERS) as CharacterId[];
const asChar = (c: string): CharacterId =>
  (ROSTER as string[]).includes(c) ? (c as CharacterId) : "voltkit";
/** A staff member's name: a friend's, or their creature's. */
const staffName = (st: Staff) =>
  st.friend?.name ?? CHARACTERS[asChar(st.char)].name;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmtTime = (s: number) => {
  s = Math.max(0, Math.ceil(s));
  return s >= 60
    ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
    : `${s}s`;
};
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/* ───────────── creature sprites ───────────── */

interface Sprite {
  cv: HTMLCanvasElement;
  ready: boolean;
  /** Feet and top of the drawing, in canvas pixels. */
  ax: number;
  ay: number;
  top: number;
  w: number;
}
const RES = 168;
/** World units per sprite pixel: a creature stands about 80 tall. */
const SPR = 0.62;
const sprites = new Map<string, Sprite>();
function sprite(id: CharacterId, dir: Facing, mood: Mood = "normal"): Sprite {
  const key = `${id}:${dir}:${mood}`;
  let s = sprites.get(key);
  if (s) return s;
  const cv = document.createElement("canvas");
  cv.width = RES;
  cv.height = Math.round((RES * 202) / 200);
  s = {
    cv,
    ready: false,
    ax: RES / 2,
    ay: cv.height * 0.95,
    top: cv.height * 0.1,
    w: RES * 0.6,
  };
  sprites.set(key, s);
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    const g = cv.getContext("2d", { willReadFrequently: true });
    if (!g) return;
    g.drawImage(img, 0, 0, cv.width, cv.height);
    try {
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let x0 = cv.width,
        x1 = 0,
        y0 = cv.height,
        y1 = 0;
      for (let y = 0; y < cv.height; y++)
        for (let x = 0; x < cv.width; x++)
          if (d[(y * cv.width + x) * 4 + 3] > 40) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 > x0 && y1 > y0) {
        s!.ax = (x0 + x1) / 2;
        s!.ay = y1;
        s!.top = y0;
        s!.w = x1 - x0;
      }
    } catch {
      /* A tainted canvas keeps the default anchor. */
    }
    s!.ready = true;
  };
  img.src =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(creatureSvg(id, dir, undefined, undefined, mood));
  return s;
}

/*
 * Each account's bistro, kept in this browser: the last state the server
 * sent (and what the scene did on top of it), the guests on the floor and
 * the coins on the tables, and what was still waiting to be sent. Opening
 * the bistro draws it at once, then the server has the last word; a page
 * closed mid-send sends the same batch again (the server applies it once).
 * Kept until you log out or clear the browser's data.
 */
interface FloorSnap {
  customers: Record<string, unknown>[];
  piles: Record<string, unknown>[];
  combo: number;
  lastServeAgo: number;
  nextId: number;
}
interface Kept {
  state: BistroState;
  extras: BistroExtras;
  sync?: SyncSnapshot;
  floor?: FloorSnap;
  at: number;
}
const KEPT = "arena-bistro:";
const lastKnown = new Map<string, Kept>();
function keptFor(owner: string): Kept | null {
  const mem = lastKnown.get(owner);
  if (mem) return mem;
  try {
    const k = JSON.parse(localStorage.getItem(KEPT + owner) ?? "null");
    if (k?.v !== 1 || !k.state || !k.extras) return null;
    // Checked like the server's answer (an old or edited save can't break it).
    const got = readServer({ ...k.state, ...k.extras, now: Date.now() });
    const kept: Kept = {
      state: got.state,
      extras: got.extras,
      sync: k.sync,
      floor: k.floor,
      at: Number(k.at) || 0,
    };
    lastKnown.set(owner, kept);
    return kept;
  } catch {
    return null;
  }
}
function keepBistro(owner: string, k: Kept) {
  lastKnown.set(owner, k);
  try {
    localStorage.setItem(KEPT + owner, JSON.stringify({ v: 1, ...k }));
  } catch {
    /* No storage, or it is full: memory still works this session. */
  }
}
/** Forget the kept bistros (sign-out). */
export function forgetBistros() {
  lastKnown.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEPT)) localStorage.removeItem(key);
    }
  } catch {
    /* No storage. */
  }
}
/** A creature's front view as an image URL (staff cards). */
const portraits = new Map<string, string>();
function portrait(id: string): string {
  let url = portraits.get(id);
  if (!url) {
    url =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(creatureSvg(asChar(id), "down"));
    portraits.set(id, url);
  }
  return url;
}

/* ───────────── the scene's people ───────────── */

interface Pt {
  x: number;
  y: number;
}
interface Walker {
  char: CharacterId;
  gx: number;
  gy: number;
  path: Pt[];
  /** Tiles a second. */
  speed: number;
  face: Facing;
  moving: boolean;
  walkT: number;
  /** Happy hop, 0..1, decays. */
  hop: number;
}
/** "queue": waiting by the door for a seat (no seat yet). */
type CustState = "queue" | "enter" | "seated" | "eating" | "leave";
interface Customer extends Walker {
  id: number;
  state: CustState;
  seat: Seat;
  vip: boolean;
  dish: DishId | null;
  slot: number;
  /** Scene time they sat down. */
  sat: number;
  patience: number;
  claimed: boolean;
  served: boolean;
  eatEnd: number;
  combo: number;
  hearts: number;
  alpha: number;
  angry: boolean;
  orderedAt: number;
}
/** A queued guest's seat until they get one. */
const NO_ITEM: Item = { id: -1, kind: "chair", x: -9, y: -9, rot: 0 };
const NO_SEAT: Seat = {
  chair: NO_ITEM,
  table: { ...NO_ITEM, kind: "table" },
  dir: 0,
};
interface Waiter extends Walker {
  staff: Staff;
  task:
    | { kind: "serve"; c: Customer }
    | { kind: "clear"; p: Pile }
    | { kind: "sweep"; t: Litter }
    | null;
  phase: "idle" | "toCounter" | "pick" | "toTable" | "drop" | "toPile" | "home";
  carry: DishId | null;
  timer: number;
}
/** Litter on the floor: from guests here, or left while you were away (the server's). */
interface Litter {
  id: number;
  x: number;
  y: number;
  server: boolean;
  claimed: boolean;
  look: number;
}
const ROLE_NAMES: Record<Role, string> = {
  cook: "Cook",
  waiter: "Waiter",
  janitor: "Janitor",
};
const roleName = (r: Role) => ROLE_NAMES[r];
/** Where janitors wait. */
const JANITOR_HOME = { x: 1, y: 8 } as const;
interface Pile {
  id: number;
  chairId: number;
  tableId: number;
  spot: Pt;
  coins: number;
  base: number;
  t0: number;
  claimed: boolean;
  /** The guest who left it, and their sale (sent when the coins are collected). */
  guest: number;
  sale: { dish: DishId; vip: boolean; combo: number; hearts: number };
}
interface VisitInfo {
  id: string;
  name: string;
  fighter: string;
  dined: boolean;
  liked: boolean;
  likes: number;
  myDines: number;
  extras: BistroExtras;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "spark" | "heart" | "steam" | "note" | "confetti" | "puff";
  col: string;
  size: number;
  rot?: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  col: string;
  life: number;
  big?: boolean;
}
interface Flyer {
  /** Screen pixels (CSS). */
  x0: number;
  y0: number;
  t: number;
  dur: number;
  coins: number;
  last: boolean;
}
interface DishFlight {
  dish: DishId;
  from: Pt;
  to: Pt;
  t: number;
  dur: number;
}

const HTML = `<canvas class="bs-cv" aria-label="Your bistro"></canvas>
<div class="bs-hud">
  <div class="bs-badge glass" id="bs-badge"></div>
  <button type="button" class="bs-wallet" id="bs-wallet" aria-label="Bistro coins: open the Bank" title="Bistro coins (the Shop's Bank trades them for Gold Leaves)"><span class="ico-wrap">${I("coin")}</span><b id="bs-coins">0</b></button>
  <div class="bs-chips" id="bs-chips"></div>
  <div class="bs-corner">
    <nav class="bs-rail glass" aria-label="Bistro menu">
      <button type="button" data-sheet="menu" title="Recipes">${I("book")}<span>Recipes</span></button>
      <button type="button" data-sheet="friends" title="Friends' bistros">${I("smile")}<span>Friends</span></button>
      <button type="button" data-sheet="staff" title="Staff and upgrades">${I("friends")}<span>Staff</span><b class="dot" id="bs-staff-dot" hidden></b></button>
      <button type="button" data-sheet="shop" title="Shop">${I("shop")}<span>Shop</span></button>
      <button type="button" data-act="decor" title="Decorate">${I("decor")}<span>Decor</span></button>
    </nav>
    <div class="bs-zoom glass" role="group" aria-label="Zoom"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-z="fit" aria-label="Show the whole bistro">⤢</button></div>
  </div>
  <div class="bs-bar glass" id="bs-bar"></div>
  <div class="bs-edit glass" id="bs-edit" hidden></div>
  <div class="bs-tip glass" id="bs-tip" hidden></div>
  <section class="bs-sheet glass" id="bs-sheet" hidden></section>
  <div class="bs-banner" id="bs-banner" hidden></div>
  <div class="bs-visit glass" id="bs-visit" hidden></div>
  <div class="bs-modal" id="bs-modal" hidden></div>
  <div class="bs-loading" id="bs-loading" hidden></div>
  <div class="bs-hint" id="bs-hint">Tap a stove to cook · customers come when the counter has food</div>
</div>`;

export function openBistro(o: BistroOptions): BistroHandle {
  const layer = document.createElement("div");
  layer.className = "bistro-layer";
  layer.tabIndex = -1;
  layer.innerHTML = HTML;
  if (o.low) layer.dataset.graphics = "low";
  document.body.append(layer);
  fadeIn([layer], 260);
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
    layer.querySelector(sel) as T;
  const cv = $<HTMLCanvasElement>(".bs-cv");
  const ctx = cv.getContext("2d")!;
  const low = !!o.low;
  const reduced = o.reduced;
  const sound = (cue: FarmCue, step?: number) => {
    try {
      o.sound?.(cue, step);
    } catch {
      /* Sound is optional. */
    }
  };
  const syncPhone = () => {
    layer.classList.toggle("phone", matchMedia("(max-height: 500px)").matches);
  };
  syncPhone();

  /* ───────────── state: the server's bistro (bistro-sync.ts) ───────────── */
  const kept = o.owner ? keptFor(o.owner) : null;
  const cached = kept
    ? { state: structuredClone(kept.state), extras: { ...kept.extras } }
    : undefined;
  const sync = new BistroSync(
    o.api,
    {
      onAdopt: (info) => adopted(info),
      onFail: () => {
        if (!sync.ready) showLoading("Can't reach the bistro. Retrying…");
      },
    },
    cached,
  );
  // What a closed page was still waiting to send goes first.
  sync.restore(kept?.sync);
  /** The bistro on screen: yours, or a friend's while you visit. */
  let S: BistroState = sync.S;
  const nowS = () => sync.now();
  const changed = () => {
    hudDirty = true;
  };
  // Keep "last seen" fresh while open (time away starts from it).
  const pingTimer = setInterval(() => {
    if (!document.hidden && !paused) sync.ping();
  }, 10000);
  /** Behind another hub tab: drawn as it was, nothing moves. */
  let paused = false;

  /* ───────────── people ───────────── */
  const chefChar = () => asChar(o.character());
  const mkWalker = (
    char: CharacterId,
    gx: number,
    gy: number,
    speed: number,
  ): Walker => ({
    char,
    gx,
    gy,
    path: [],
    speed,
    face: "down",
    moving: false,
    walkT: Math.random() * 10,
    hop: 0,
  });
  const chef = mkWalker(chefChar(), 2.5, 1, 2.2);
  // The hired team: waiters on the floor, cooks at their stoves.
  let waiters: Waiter[] = [];
  let cooks: (Walker & { staff: Staff })[] = [];
  const syncStaff = () => {
    const ws = S.staff.filter(
      (x) => x.role === "waiter" || x.role === "janitor",
    );
    waiters = ws.map((st, i) => {
      const old = waiters.find(
        (w) => w.staff.id === st.id && w.char === st.char,
      );
      if (old) {
        old.staff = st;
        old.speed = 2.8 * staffSpeed(st.level);
        return old;
      }
      return {
        ...mkWalker(
          asChar(st.char),
          WAITER_HOME.x + (i ? 0.6 : 0),
          WAITER_HOME.y + (i ? 0.6 : 0),
          2.8 * staffSpeed(st.level),
        ),
        staff: st,
        task: null,
        phase: "idle" as const,
        carry: null,
        timer: 0,
      };
    });
    cooks = staffOf(S, "cook").map((st, i) => {
      const old = cooks.find((c) => c.staff.id === st.id && c.char === st.char);
      if (old) {
        old.staff = st;
        return old;
      }
      const idx = cookStove(S, i);
      return {
        ...mkWalker(asChar(st.char), idx >= 0 ? STOVE_TILES[idx].x : 4.6, 1, 2),
        staff: st,
      };
    });
    for (const w of [...waiters, ...cooks])
      for (const d of ["down", "left", "right", "up"] as Facing[])
        sprite(w.char, d);
  };
  syncStaff();
  // Warm the sprite cache: the staff first, then the whole roster bit by bit.
  for (const d of ["down", "left", "right", "up"] as Facing[])
    sprite(chef.char, d);
  let warmI = 0;
  const warm = setInterval(() => {
    const id = ROSTER[warmI % ROSTER.length];
    const d = (["down", "left", "right", "up"] as Facing[])[
      Math.floor(warmI / ROSTER.length)
    ];
    if (d) sprite(id, d);
    else clearInterval(warm);
    warmI++;
  }, 120);

  let customers: Customer[] = [];
  let piles: Pile[] = [];
  let litter: Litter[] = [];
  let particles: Particle[] = [];
  let floaters: Floater[] = [];
  let flyers: Flyer[] = [];
  let flights: DishFlight[] = [];
  let nextId = 1;
  let T = 0; // scene seconds
  let spawnT = 3;
  let combo = 0;
  let lastServe = -99;
  let wasRush = false;
  let doorOpen = 0;
  let shownCoins = S.coins;
  const special = (): DishId =>
    visiting ? visiting.extras.special : sync.extras.special;
  /** A friend's bistro you are visiting (their state is S meanwhile). */
  let visiting: VisitInfo | null = null;
  /** Furniture shows once the server has answered (or from this session's last look). */
  const roomShown = () => sync.ready || !!cached || !!visiting;
  const rushing = () => inRush(nowS() + rushShift);
  /** What sets the popularity now, besides the bistro itself. */
  const popInput = (): PopInput => {
    const ex = visiting ? visiting.extras : sync.extras;
    return {
      likesWeek: ex.likesWeek,
      dinedToday: ex.friendGuests.length,
      dirty: piles.filter((p) => T - p.t0 > DIRTY_SECONDS).length,
      trash: visiting ? 0 : litter.length,
    };
  };
  const popNow = () => popularity(S, popInput());
  // Development: start a rush hour now (shifts the rush clock only).
  let rushShift = 0;
  let blocked = blockedGrid(S.items, -1, sizeOf(S.sizeLv));
  let seatList = seats(S.items);
  let charmPts = charm(S.items);
  /** The plan's walks (which seats are handy) and where a queue stands. */
  let layout: LayoutStats = layoutStats(S.items, sizeOf(S.sizeLv));
  let walkOf = new Map<number, SeatWalk>();
  let queueTiles: Pt[] = [];
  const measure = () => {
    layout = layoutStats(S.items, sizeOf(S.sizeLv));
    walkOf = new Map(layout.seats.map((w) => [w.chair, w]));
    // The free tiles nearest the door, clear of the pickup spots.
    const d = distField(blocked, [DOOR]);
    const tiles: { p: Pt; d: number }[] = [];
    for (let x = 0; x < d.length; x++)
      for (let y = 0; y < d[x].length; y++) {
        if (d[x][y] <= 0) continue;
        if (y === 3 && x >= 1 && x <= 4) continue;
        if (x === WAITER_HOME.x && y === WAITER_HOME.y) continue;
        tiles.push({ p: { x, y }, d: d[x][y] });
      }
    tiles.sort((a, b) => a.d - b.d || b.p.y - a.p.y || a.p.x - b.p.x);
    queueTiles = tiles.slice(0, 6).map((t) => t.p);
  };
  measure();
  const relayout = () => {
    // A bigger (or a friend's) room: the camera fits it again.
    if (setRoomSize(sizeOf(S.sizeLv))) resize();
    blocked = blockedGrid(S.items, -1, sizeOf(S.sizeLv));
    seatList = seats(S.items);
    charmPts = charm(S.items);
    measure();
    requeue();
    // Anyone whose next steps cross a new obstacle finds a new way.
    for (const w of [...customers, ...waiters]) {
      if (!w.path.length) continue;
      const goal = w.path[w.path.length - 1];
      if (
        w.path.some(
          (p, i) => i < w.path.length - 1 && inside(p) && blocked[p.x][p.y],
        )
      ) {
        const from = { x: Math.round(w.gx), y: Math.round(w.gy) };
        w.path = inside(from)
          ? (findPath(blocked, from, goal) ?? []).slice(1)
          : w.path;
      }
    }
  };
  const inside = (p: Pt) =>
    p.x >= 0 && p.y >= 0 && p.x < R.cols && p.y < R.rows;

  /* ───────────── camera ───────────── */
  let W = 0,
    H = 0,
    DPR = 1;
  const view = { s: 1, x: 0, y: 0 };
  let fitS = 1;
  let zoom = 1;
  const pan = { x: 0, y: 0 };
  const insets = () => {
    const phone = layer.classList.contains("phone");
    return {
      top: phone ? 52 : 112,
      bottom: phone ? 30 : 104,
      left: phone ? 8 : 40,
      right: phone ? 74 : 130,
    };
  };
  const resize = () => {
    syncPhone();
    DPR = Math.min(2, window.devicePixelRatio || 1) * (low ? 0.75 : 1);
    W = layer.clientWidth;
    H = layer.clientHeight;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    const ins = insets();
    const bw = BOUNDS.x1 - BOUNDS.x0,
      bh = BOUNDS.y1 - BOUNDS.y0;
    fitS = Math.min(
      (W - ins.left - ins.right) / bw,
      (H - ins.top - ins.bottom) / bh,
    );
    shellKey = "";
    hudDirty = true;
  };
  const applyView = () => {
    const ins = insets();
    view.s = fitS * zoom;
    const bw = BOUNDS.x1 - BOUNDS.x0,
      bh = BOUNDS.y1 - BOUNDS.y0;
    const cx = ins.left + (W - ins.left - ins.right) / 2,
      cy = ins.top + (H - ins.top - ins.bottom) / 2;
    // Keep some of the room on screen whatever the pan.
    const lim = (v: number, span: number) => clamp(v, -span, span);
    pan.x = lim(pan.x, (bw * view.s) / 2);
    pan.y = lim(pan.y, (bh * view.s) / 2);
    view.x = cx - (BOUNDS.x0 + bw / 2) * view.s + pan.x;
    view.y = cy - (BOUNDS.y0 + bh / 2) * view.s + pan.y;
  };
  const toScreen = (p: Pt) => ({
    x: p.x * view.s + view.x,
    y: p.y * view.s + view.y,
  });
  const toWorld = (sx: number, sy: number) => ({
    x: (sx - view.x) / view.s,
    y: (sy - view.y) / view.s,
  });
  const toGrid = (w: Pt) => {
    const a = w.x / 48,
      b = w.y / 24;
    return { x: (a + b) / 2, y: (b - a) / 2 };
  };
  const ro = new ResizeObserver(() => resize());

  /* ───────────── the cached shell ───────────── */
  let shell: HTMLCanvasElement | null = null;
  let shellKey = "";
  let shellScale = 1;
  const PAD = 30;
  const shellCanvas = () => {
    const sc = clamp(Math.ceil(view.s * DPR * 2) / 2, 0.5, 3);
    const key = `${S.floor}:${S.wall}:${sc}:${R.cols}x${R.rows}`;
    if (shell && key === shellKey) return shell;
    shellKey = key;
    shellScale = sc;
    const c = shell ?? document.createElement("canvas");
    c.width = Math.ceil((BOUNDS.x1 - BOUNDS.x0 + PAD * 2) * sc);
    c.height = Math.ceil((BOUNDS.y1 - BOUNDS.y0 + PAD * 2) * sc);
    const g = c.getContext("2d")!;
    g.setTransform(
      sc,
      0,
      0,
      sc,
      (-BOUNDS.x0 + PAD) * sc,
      (-BOUNDS.y0 + PAD) * sc,
    );
    g.clearRect(BOUNDS.x0 - PAD, BOUNDS.y0 - PAD, c.width, c.height);
    drawShell(g, S.floor, S.wall);
    shell = c;
    return c;
  };

  /* ───────────── walking ───────────── */
  const faceFor = (dx: number, dy: number): Facing =>
    dx > 0
      ? "right"
      : dx < 0
        ? "left"
        : dy > 0
          ? "left"
          : dy < 0
            ? "right"
            : "down";
  const step = (w: Walker, dt: number) => {
    w.hop = Math.max(0, w.hop - dt * 2.2);
    if (!w.path.length) {
      w.moving = false;
      return true;
    }
    w.moving = true;
    w.walkT += dt;
    let left = w.speed * dt * (rushing() ? 1.25 : 1);
    while (left > 0 && w.path.length) {
      const p = w.path[0];
      const dx = p.x - w.gx,
        dy = p.y - w.gy;
      const d = Math.hypot(dx, dy);
      if (d < 1e-4) {
        w.path.shift();
        continue;
      }
      // Up-left and up-right walks show the back.
      w.face =
        dx < -0.01 || dy < -0.01
          ? Math.abs(dx) > Math.abs(dy)
            ? "up"
            : "up"
          : faceFor(dx, dy);
      if (d <= left) {
        w.gx = p.x;
        w.gy = p.y;
        w.path.shift();
        left -= d;
      } else {
        w.gx += (dx / d) * left;
        w.gy += (dy / d) * left;
        left = 0;
      }
    }
    if (!w.path.length) w.moving = false;
    return !w.path.length;
  };
  const tileOf = (w: Walker) => ({
    x: clamp(Math.round(w.gx), 0, R.cols - 1),
    y: clamp(Math.round(w.gy), 0, R.rows - 1),
  });
  const pathTo = (w: Walker, to: Pt) => {
    const p = findPath(blocked, tileOf(w), to);
    w.path = p ? p.slice(1) : [];
    return !!p;
  };
  const pathNear = (w: Walker, targets: Pt[]) => {
    const p = approach(blocked, tileOf(w), targets);
    w.path = p ? p.slice(1) : [];
    return !!p;
  };

  /* ───────────── effects ───────────── */
  const burst = (
    x: number,
    y: number,
    kind: Particle["kind"],
    n: number,
    col = "#ffd65b",
    spread = 1,
  ) => {
    if (low && kind !== "heart") n = Math.ceil(n / 3);
    if (reduced) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (20 + Math.random() * 60) * spread;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy:
          Math.sin(a) * sp * 0.6 -
          (kind === "heart" || kind === "note" ? 40 : 30),
        life: 0,
        max:
          kind === "confetti"
            ? 2.2
            : kind === "puff"
              ? 0.9
              : 1.1 + Math.random() * 0.5,
        kind,
        col,
        size:
          kind === "confetti" ? 4 + Math.random() * 3 : 3 + Math.random() * 3,
        rot: Math.random() * 6,
      });
    }
  };
  const floatText = (p: Pt, text: string, col = "#ffe27a", big = false) =>
    floaters.push({ x: p.x, y: p.y, text, col, life: 0, big });
  /** Coins fly from a world point to the badge's coin count. */
  const flyCoins = (p: Pt, coins: number) => {
    const s = toScreen(p);
    const n = Math.min(low ? 3 : 7, 2 + Math.floor(coins / 8));
    for (let i = 0; i < n; i++)
      flyers.push({
        x0: s.x + (Math.random() - 0.5) * 20,
        y0: s.y + (Math.random() - 0.5) * 10,
        t: -i * 0.06,
        dur: 0.7 + Math.random() * 0.15,
        coins: i === n - 1 ? coins : 0,
        last: i === n - 1,
      });
  };
  const coinTarget = () => {
    const el = layer.querySelector("#bs-wallet .ico-wrap");
    const r = el?.getBoundingClientRect();
    const b = layer.getBoundingClientRect();
    return r && r.width
      ? { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }
      : { x: W - 120, y: 30 };
  };
  /*
   * The wallet: bistro coins in the top bar's place for the coin pills (the
   * game's coins and Gold Leaves are hidden on the Bistro), just left of the
   * menu button, its height, wherever the bar puts it (phones, notches).
   */
  const wallet = $("#bs-wallet");
  const placeWallet = () => {
    const menu = Array.from(
      document.querySelectorAll<HTMLElement>(".header-menu, #home-settings"),
    )
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .sort((a, b) => a.left - b.left)[0];
    if (!menu) return;
    const box = layer.getBoundingClientRect();
    wallet.style.top = `${menu.top - box.top}px`;
    wallet.style.height = `${menu.height}px`;
    wallet.style.right = `${box.right - menu.left + 8}px`;
  };
  wallet.addEventListener("click", () => {
    sound("tick");
    openSheet("shop", "bank");
  });
  const banner = (html: string, ms = 2200) => {
    const el = $("#bs-banner");
    el.innerHTML = html;
    el.hidden = false;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (el.hidden = true), ms);
  };
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  const levelUp = (levels: number) => {
    if (levels <= 0 || visiting) return;
    sound("levelup");
    const c = coinTarget();
    for (let i = 0; i < (low ? 30 : 90); i++)
      particles.push({
        x: toWorld(W / 2, H * 0.3).x,
        y: toWorld(W / 2, H * 0.3).y,
        vx: (Math.random() - 0.5) * 520,
        vy: -Math.random() * 380 - 60,
        life: 0,
        max: 2.6,
        kind: "confetti",
        col: ["#ffd65b", "#ff7a7a", "#7fd0ff", "#9cf07f", "#ffb3f0"][i % 5],
        size: 5 + Math.random() * 4,
        rot: Math.random() * 6,
      });
    void c;
    const newDish = DISHES.find((d) => d.level === S.level);
    const newItem = ITEMS.filter((i) => i.level === S.level).map((i) => i.name);
    banner(
      `<b>Level ${S.level}!</b><span>${newDish ? `New recipe: ${esc(newDish.name)}` : newItem.length ? `New in the shop: ${esc(newItem.join(", "))}` : "Your bistro grows"}</span>`,
      3200,
    );
  };

  /* ───────────── customers ───────────── */
  const seatBusy = (chairId: number) =>
    customers.some((c) => c.seat.chair.id === chairId && c.state !== "leave") ||
    piles.some((p) => p.chairId === chairId);
  const reservedOrders = () =>
    customers.filter((c) => c.state !== "leave" && !c.dish).length;
  const freeSeats = () =>
    seatList.filter((s) => walkOf.has(s.chair.id) && !seatBusy(s.chair.id));
  /** Guests take the handiest free seat (near the counter, then the door). */
  const pickSeat = (free: Seat[]) => {
    let best = free[0],
      bestCost = Infinity;
    for (const st of free) {
      const w = walkOf.get(st.chair.id)!;
      const cost = w.waiter + 0.5 * w.guest + Math.random() * 2;
      if (cost < bestCost) {
        bestCost = cost;
        best = st;
      }
    }
    return best;
  };
  const queued = () => customers.filter((c) => c.state === "queue");
  const dropLitter = (at: Pt, server: boolean) => {
    if (litter.some((l) => l.x === at.x && l.y === at.y)) return;
    litter.push({
      id: nextId++,
      x: at.x,
      y: at.y,
      server,
      claimed: false,
      look: Math.floor(Math.random() * 3),
    });
    hudDirty = true;
  };
  /** The server's litter (left while you were away) on free tiles. */
  const syncLitter = () => {
    const want = visiting ? 0 : S.trash;
    const mine = litter.filter((l) => l.server);
    if (mine.length > want) {
      const drop = new Set(mine.slice(want));
      litter = litter.filter((l) => !drop.has(l));
      for (const w of waiters)
        if (w.task?.kind === "sweep" && drop.has(w.task.t)) w.task = null;
    }
    for (let n = mine.length; n < want; n++) {
      const free: Pt[] = [];
      for (let x = 1; x < R.cols; x++)
        for (let y = 3; y < R.rows; y++)
          if (
            !blocked[x]?.[y] &&
            !(y === 3 && x <= 4) &&
            !litter.some((l) => l.x === x && l.y === y)
          )
            free.push({ x, y });
      if (!free.length) break;
      dropLitter(free[Math.floor(Math.random() * free.length)], true);
    }
  };
  const sweepLitter = (l: Litter, byTap: boolean) => {
    litter = litter.filter((x) => x !== l);
    for (const w of waiters)
      if (w.task?.kind === "sweep" && w.task.t === l) w.task = null;
    if (l.server && !visiting) sync.do({ a: "sweep" });
    const p = iso(l.x, l.y);
    burst(p.x, p.y - 6, "puff", 6, "#e8e2d4", 0.4);
    if (byTap) sound("rustle");
    hudDirty = true;
  };
  /** Everyone in the queue walks to their place in it. */
  const requeue = () => {
    queued().forEach((c, i) => {
      const spot = queueTiles[i];
      if (!spot) return;
      const goal = c.path[c.path.length - 1];
      if (goal && goal.x === spot.x && goal.y === spot.y) return;
      if (
        !c.path.length &&
        Math.round(c.gx) === spot.x &&
        Math.round(c.gy) === spot.y
      )
        return;
      const from = { x: Math.round(c.gx), y: Math.round(c.gy) };
      const p = inside(from) ? findPath(blocked, from, spot) : null;
      c.path = p ? p.slice(1) : [spot];
    });
  };
  const spawn = () => {
    // Only when there is food not yet promised to someone.
    if (servingsLeft(S) <= reservedOrders()) return false;
    const pop = popNow().total;
    const free = freeSeats();
    // No seat: wait by the door, if the queue has room.
    const waiting = !free.length;
    if (
      waiting &&
      queued().length >= Math.min(queueMax(pop), queueTiles.length)
    )
      return false;
    const seat = waiting ? NO_SEAT : pickSeat(free);
    const vip = Math.random() < vipShare(pop, rushing());
    // Guests are never your own chef or staff (they are busy).
    const pool = ROSTER.filter(
      (r) => r !== chef.char && !S.staff.some((st) => st.char === r),
    );
    const char = pool[Math.floor(Math.random() * pool.length)] ?? "voltkit";
    const c: Customer = {
      ...mkWalker(char, DOOR.x - 1.2, DOOR.y, 1.9 + Math.random() * 0.4),
      id: nextId++,
      state: waiting ? "queue" : "enter",
      seat,
      vip,
      dish: null,
      slot: -1,
      sat: waiting ? T : 0,
      patience: waiting ? queuePatience(pop) : patienceSeconds(charmPts, vip),
      claimed: false,
      served: false,
      eatEnd: 0,
      combo: 1,
      hearts: 3,
      alpha: 0,
      angry: false,
      orderedAt: 0,
    };
    if (waiting) {
      const spot = queueTiles[queued().length];
      const p = findPath(blocked, DOOR, spot);
      if (!p) return false;
      c.path = [{ x: DOOR.x, y: DOOR.y }, ...p.slice(1)];
    } else {
      const p = findPath(blocked, DOOR, seat.chair);
      if (!p) return false;
      c.path = [{ x: DOOR.x, y: DOOR.y }, ...p.slice(1)];
    }
    customers.push(c);
    sound("knock");
    return true;
  };
  /** The head of the queue takes a seat that came free. */
  const seatFromQueue = () => {
    const c = queued()[0];
    if (!c) return;
    const free = freeSeats();
    if (!free.length) return;
    const seat = pickSeat(free);
    const from = { x: Math.round(c.gx), y: Math.round(c.gy) };
    const p = inside(from) ? findPath(blocked, from, seat.chair) : null;
    if (!p) return;
    c.seat = seat;
    c.state = "enter";
    c.path = p.slice(1);
    c.patience = patienceSeconds(charmPts, c.vip);
    requeue();
  };
  /** Waited too long by the door: off they go (they never sat down). */
  const leaveQueue = (c: Customer) => {
    c.state = "leave";
    c.angry = true;
    const from = { x: Math.round(c.gx), y: Math.round(c.gy) };
    const back = inside(from) ? (findPath(blocked, from, DOOR) ?? []) : [];
    c.path = [...back.slice(1), { x: DOOR.x - 1.4, y: DOOR.y }];
    const p = iso(c.gx, c.gy);
    floatText({ x: p.x, y: p.y - 90 }, "Too long a wait…", "#ffb0a0");
    requeue();
    changed();
  };
  const leave = (c: Customer, angry: boolean) => {
    c.state = "leave";
    c.angry = angry;
    c.claimed = false;
    // Off the chair onto a free tile next to it, then out of the door.
    const p = approach(blocked, DOOR, [c.seat.chair]);
    // Some leave a wrapper behind.
    if (p && !visiting && Math.random() < LITTER_RATE)
      dropLitter(p[p.length - 1], false);
    const back = findPath(blocked, p ? p[p.length - 1] : DOOR, DOOR) ?? [];
    c.path = [
      ...(p ? [p[p.length - 1]] : []),
      ...back.slice(1),
      { x: DOOR.x - 1.4, y: DOOR.y },
    ];
    c.gx = c.seat.chair.x;
    c.gy = c.seat.chair.y;
    if (angry) {
      if (!visiting) sync.do({ a: "leave" });
      burst(
        iso(c.gx, c.gy).x,
        iso(c.gx, c.gy).y - 80,
        "puff",
        8,
        "#8a8f9a",
        0.6,
      );
      floatText(
        { x: iso(c.gx, c.gy).x, y: iso(c.gx, c.gy).y - 90 },
        "Too slow…",
        "#ffb0a0",
      );
      // Their order goes back on the counter.
      if (c.dish && !c.served) releaseOrder(c);
      combo = 0;
      changed();
    }
  };
  /** A guest orders from the counter: the serving is theirs until they pay or leave. */
  const tryOrder = (c: Customer) => {
    const dish = pickOrder(S, Math.random, special(), c.vip);
    if (!dish) return;
    const slot = S.counter.findIndex((x) => x?.dish === dish && x.servings > 0);
    if (visiting) takeServing(S, dish);
    else if (!sync.reserve(c.id, dish)) return;
    c.slot = slot;
    c.dish = dish;
    c.orderedAt = T;
    changed();
  };
  const releaseOrder = (c: Customer) => {
    if (visiting) {
      const slot = S.counter.findIndex((x) => x?.dish === c.dish);
      const at = slot >= 0 ? slot : S.counter.findIndex((x) => !x);
      if (at >= 0 && c.dish) {
        const x = S.counter[at];
        S.counter[at] = x
          ? { ...x, servings: x.servings + 1 }
          : { dish: c.dish, servings: 1, perfect: false };
      }
    } else sync.release(c.id);
  };
  const updateCustomer = (c: Customer, dt: number) => {
    if (c.state === "queue") {
      c.alpha = Math.min(1, c.alpha + dt * 3);
      if (step(c, dt)) c.face = "down";
      if (T - c.sat > c.patience) leaveQueue(c);
      return;
    }
    if (c.state === "enter") {
      c.alpha = Math.min(1, c.alpha + dt * 3);
      if (step(c, dt)) {
        c.state = "seated";
        c.gx = c.seat.chair.x;
        c.gy = c.seat.chair.y;
        c.sat = T;
        c.face = sitFace(c.seat.dir);
        sound("pop", 2);
      }
      return;
    }
    if (c.state === "seated") {
      c.face = sitFace(c.seat.dir);
      if (!c.dish && T - c.sat > 0.7) tryOrder(c);
      if (T - c.sat > c.patience && !c.served) leave(c, true);
      return;
    }
    if (c.state === "eating") {
      c.face = sitFace(c.seat.dir);
      if (!low && Math.random() < dt * 0.9) {
        const p = iso(c.gx, c.gy);
        burst(p.x, p.y - 84, "heart", 1, "#ff6b8a", 0.3);
      }
      if (T >= c.eatEnd) pay(c);
      return;
    }
    // Leaving.
    if (step(c, dt)) c.alpha -= dt * 3;
  };
  const sitFace = (dir: number): Facing =>
    dir === 0 ? "right" : dir === 1 ? "left" : "up";
  const pay = (c: Customer) => {
    const bill = payment(c.dish!, {
      vip: c.vip,
      combo: c.combo,
      special: c.dish === special(),
      rush: rushing(),
      hearts: c.hearts,
    });
    const tDir = (c.seat.dir + 2) % 4;
    piles.push({
      id: nextId++,
      chairId: c.seat.chair.id,
      tableId: c.seat.table.id,
      spot: tableSpot(c.seat.table.x, c.seat.table.y, tDir),
      coins: bill.total,
      base: bill.base,
      t0: T,
      claimed: false,
      guest: c.id,
      sale: { dish: c.dish!, vip: c.vip, combo: c.combo, hearts: c.hearts },
    });
    const p = iso(c.gx, c.gy);
    floatText({ x: p.x, y: p.y - 96 }, "♥".repeat(c.hearts), "#ff7a9a");
    c.hop = 1;
    leave(c, false);
    changed();
  };

  /* ───────────── waiters ───────────── */
  const updateWaiter = (w: Waiter, dt: number) => {
    // Their pace: level, a friend's bonus, how tired they are.
    w.speed =
      2.8 * workSpeed(w.staff, visiting ? 100 : energyNow(S, w.staff, nowS()));
    if (!w.task) {
      // The best job: serving beats clearing, a long wait counts, and so
      // do the steps to get there (docs/bistro-gdd.md §3.4). Janitors
      // clear tables and sweep; with one on the team, waiters only serve.
      const from = { x: Math.round(w.gx), y: Math.round(w.gy) };
      const steps = (to: Pt[]) => {
        if (!inside(from)) return 12;
        const p = approach(blocked, from, to);
        return p ? p.length - 1 : 99;
      };
      const line = queued().length > 0;
      const janitor = w.staff.role === "janitor";
      const clears =
        janitor || !waiters.some((x) => x.staff.role === "janitor");
      let c: Customer | undefined;
      let p: Pile | undefined;
      let l: Litter | undefined;
      let best = -Infinity;
      if (janitor)
        for (const x of litter) {
          if (x.claimed) continue;
          const score = 8 - steps([{ x: x.x, y: x.y }]);
          if (score > best) {
            best = score;
            l = x;
          }
        }
      for (const x of customers) {
        if (janitor) break;
        if (x.state !== "seated" || !x.dish || x.claimed) continue;
        const score =
          30 +
          0.6 * (T - x.orderedAt) -
          steps([pickupTile(Math.max(0, x.slot))]);
        if (score > best) {
          best = score;
          c = x;
          p = undefined;
        }
      }
      for (const x of piles) {
        if (!clears) break;
        if (x.claimed || T - x.t0 <= 9) continue;
        const near = [x.chairId, x.tableId]
          .map((id) => S.items.find((i) => i.id === id))
          .filter((i): i is Item => !!i);
        const score = (line ? 25 : 10) + 0.6 * (T - x.t0 - 9) - steps(near);
        if (score > best) {
          best = score;
          p = x;
          c = undefined;
          l = undefined;
        }
      }
      if (l && !p) {
        l.claimed = true;
        w.task = { kind: "sweep", t: l };
        w.phase = "toPile";
        pathNear(w, [{ x: l.x, y: l.y }]);
        return;
      }
      if (c) {
        c.claimed = true;
        w.task = { kind: "serve", c };
        w.phase = "toCounter";
        if (!pathTo(w, pickupTile(Math.max(0, c.slot)))) w.phase = "pick";
        return;
      }
      if (p) {
        p.claimed = true;
        w.task = { kind: "clear", p };
        w.phase = "toPile";
        const chair = S.items.find((i) => i.id === p.chairId);
        const table = S.items.find((i) => i.id === p.tableId);
        pathNear(
          w,
          [chair, table].filter((x): x is Item => !!x),
        );
        return;
      }
      if (w.phase !== "home") {
        w.phase = "home";
        if (w.staff.role === "janitor") pathNear(w, [JANITOR_HOME]);
        else if (waiters.indexOf(w) === 0) pathTo(w, WAITER_HOME);
        else pathNear(w, [WAITER_HOME]);
      }
      if (step(w, dt)) w.face = "down";
      return;
    }
    const arrived = step(w, dt);
    if (w.task.kind === "serve") {
      const c = w.task.c;
      if (c.state === "leave" || !customers.includes(c)) {
        // They gave up: the dish goes back on the counter.
        w.carry = null;
        w.task = null;
        return;
      }
      if (w.phase === "toCounter" && arrived) {
        w.phase = "pick";
        w.timer = 0.35;
        w.face = "up";
      } else if (w.phase === "pick") {
        w.timer -= dt;
        w.face = "up";
        if (w.timer <= 0) {
          w.carry = c.dish;
          w.phase = "toTable";
          pathNear(w, [c.seat.chair, c.seat.table]);
        }
      } else if (w.phase === "toTable" && arrived) {
        w.phase = "drop";
        w.timer = 0.25;
      } else if (w.phase === "drop") {
        w.timer -= dt;
        if (w.timer <= 0) serve(w, c);
      }
    } else if (w.task.kind === "sweep") {
      const l = w.task.t;
      if (!litter.includes(l)) {
        w.task = null;
        return;
      }
      if (arrived) {
        sweepLitter(l, false);
        w.task = null;
      }
    } else {
      const p = w.task.p;
      if (!piles.includes(p)) {
        w.task = null;
        return;
      }
      if (arrived) {
        collectPile(p, false);
        w.task = null;
      }
    }
  };
  const serve = (w: Waiter, c: Customer) => {
    w.carry = null;
    w.task = null;
    c.served = true;
    c.state = "eating";
    c.eatEnd = T + 5 + Math.random() * 2.5;
    const waited = T - c.sat;
    c.hearts = heartsFor(waited, c.patience);
    combo = T - lastServe <= COMBO_SECONDS ? Math.min(COMBO_MAX, combo + 1) : 1;
    lastServe = T;
    c.combo = combo;
    c.hop = 1;
    sound("pop", combo + 2);
    const p = tableSpot(c.seat.table.x, c.seat.table.y, (c.seat.dir + 2) % 4);
    burst(p.x, p.y - 6, "spark", 6, "#fff3b0", 0.4);
    if (combo >= 2)
      floatText({ x: p.x, y: p.y - 40 }, `Combo ×${combo}`, "#9fe8ff", true);
    hudDirty = true;
  };
  const collectPile = (p: Pile, byTap: boolean) => {
    piles = piles.filter((x) => x !== p);
    // Free the waiter who was on the way.
    for (const w of waiters)
      if (w.task?.kind === "clear" && w.task.p === p) w.task = null;
    if (visiting) {
      // A friend's guests pay them, not you.
      burst(p.spot.x, p.spot.y - 6, "spark", 4, "#ffe27a", 0.4);
      return;
    }
    const quick = byTap && T - p.t0 < 5;
    const bill = payment(p.sale.dish, {
      ...p.sale,
      quick,
      special: p.sale.dish === special(),
      rush: inRush(nowS()),
    });
    const level = S.level;
    sync.pay(p.guest, { ...p.sale, quick });
    levelUp(S.level - level);
    const coins = bill.total;
    if (quick)
      floatText({ x: p.spot.x, y: p.spot.y - 30 }, "Quick tip!", "#9cf07f");
    floatText({ x: p.spot.x, y: p.spot.y - 14 }, `+${coins}`, "#ffe27a", true);
    flyCoins(p.spot, coins);
    burst(p.spot.x, p.spot.y - 6, "spark", 8, "#ffe27a", 0.6);
    if (byTap) sound("coin");
    changed();
  };

  /* ───────────── chef ───────────── */
  const updateChef = (dt: number) => {
    const now = nowS();
    // Go to a pot in its golden moment, else one that is done, else the one
    // that will finish first.
    let target = -1;
    let best = Infinity;
    const cookRun = new Set(cooks.map((_, i) => cookStove(S, i)));
    S.stoves.forEach((st, i) => {
      if (!st.dish || cookRun.has(i)) return;
      const p = cookProgress(st, now);
      const score = inPerfectWindow(st, now) ? -2 : p >= 1 ? -1 : 1 - p;
      if (score < best) {
        best = score;
        target = i;
      }
    });
    const own = S.stoves.map((_, i) => i).filter((i) => !cookRun.has(i));
    const tx =
      target >= 0
        ? STOVE_TILES[target].x
        : own.length
          ? (STOVE_TILES[own[0]].x + STOVE_TILES[own[own.length - 1]].x) / 2
          : 0.35;
    if (Math.abs(chef.gx - tx) > 0.02 && !chef.path.length)
      chef.path = [{ x: tx, y: 1 }];
    if (step(chef, dt)) chef.face = target >= 0 ? "up" : "down";
    // Cooks stand at their stove, facing it while something cooks.
    cooks.forEach((c, i) => {
      const idx = cookStove(S, i);
      const x = idx >= 0 ? STOVE_TILES[idx].x : 4.6;
      if (Math.abs(c.gx - x) > 0.02 && !c.path.length) c.path = [{ x, y: 1 }];
      if (step(c, dt)) c.face = idx >= 0 && S.stoves[idx]?.dish ? "up" : "down";
    });
  };
  /** The cooks' work, a few times a second: start their dish, plate it when done. */
  let kitchenT = 0;
  const runKitchen = (dt: number) => {
    kitchenT -= dt;
    if (kitchenT > 0) return;
    kitchenT = 0.4;
    for (const ev of autoKitchen(S, nowS())) {
      const c = iso(STOVE_TILES[ev.stove].x, STOVE_TILES[ev.stove].y);
      const walker = cooks.find((w) => w.staff.id === ev.cook.id);
      if (walker) walker.hop = 1;
      if (ev.kind === "start") {
        burst(c.x, c.y - 60, "spark", 6, "#ffb36b", 0.4);
      } else {
        const to = iso(1 + ev.slot, COUNTER_ROW);
        flights.push({
          dish: ev.dish,
          from: { x: c.x, y: c.y - 70 },
          to: { x: to.x, y: to.y - 52 },
          t: 0,
          dur: 0.55,
        });
        floatText({ x: c.x, y: c.y - 96 }, `+${ev.servings} servings`, "#fff");
        sound("pop", 3);
        levelUp(ev.levels);
      }
      changed();
    }
  };

  /* ───────────── input ───────────── */
  let editing = false;
  let held: { kind: ItemKind; rot: number; moving?: Item } | null = null;
  let hover: Pt | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: {
    x: number;
    y: number;
    px: number;
    py: number;
    moved: boolean;
  } | null = null;
  let pinch: { d: number; z: number } | null = null;
  const local = (e: PointerEvent | WheelEvent) => {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  cv.addEventListener("pointerdown", (e) => {
    const p = local(e);
    pointers.set(e.pointerId, p);
    cv.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
      drag = null;
      return;
    }
    drag = { x: p.x, y: p.y, px: pan.x, py: pan.y, moved: false };
  });
  cv.addEventListener("pointermove", (e) => {
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      zoom = clamp(
        (pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.d),
        0.8,
        2.4,
      );
      return;
    }
    if (editing && held) {
      const g = toGrid(toWorld(p.x, p.y));
      hover = { x: Math.round(g.x), y: Math.round(g.y) };
    }
    if (!drag) {
      cv.style.cursor = hit(p.x, p.y) ? "pointer" : "";
      return;
    }
    const dx = p.x - drag.x,
      dy = p.y - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 7) drag.moved = true;
    if (drag.moved && !(editing && held)) {
      pan.x = drag.px + dx;
      pan.y = drag.py + dy;
    }
  });
  const end = (e: PointerEvent) => {
    const p = local(e);
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      drag = null;
      return;
    }
    if (drag && (!drag.moved || (editing && held))) tap(p.x, p.y);
    drag = null;
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId);
    pinch = null;
    drag = null;
  });
  cv.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom = clamp(zoom * Math.exp(-e.deltaY * 0.0015), 0.8, 2.4);
    },
    { passive: false },
  );
  layer.querySelector(".bs-zoom")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    const z = b.dataset.z;
    if (z === "in") zoom = clamp(zoom * 1.2, 0.8, 2.4);
    else if (z === "out") zoom = clamp(zoom / 1.2, 0.8, 2.4);
    else {
      zoom = 1;
      pan.x = pan.y = 0;
    }
    sound("tick");
  });

  type Hit =
    | { kind: "pile"; p: Pile }
    | { kind: "stove"; i: number }
    | { kind: "stove-buy" }
    | { kind: "counter"; slot: number }
    | { kind: "customer"; c: Customer }
    | { kind: "item"; it: Item }
    | { kind: "staff"; who: "chef" | "waiter" }
    | { kind: "litter"; l: Litter }
    | { kind: "worker"; st: Staff };
  const hit = (sx: number, sy: number): Hit | null => {
    const w = toWorld(sx, sy);
    const near = (p: Pt, r: number) =>
      Math.hypot(p.x - w.x, (p.y - w.y) * 1.3) < r;
    if (!editing) {
      for (const p of piles)
        if (near({ x: p.spot.x + 6, y: p.spot.y - 6 }, 22))
          return { kind: "pile", p };
      for (const l of litter) {
        const c = iso(l.x, l.y);
        if (near({ x: c.x, y: c.y - 2 }, 20)) return { kind: "litter", l };
      }
      for (let i = 0; i < MAX_STOVES; i++) {
        const c = iso(STOVE_TILES[i].x, STOVE_TILES[i].y);
        if (Math.abs(w.x - c.x) < 34 && w.y > c.y - 92 && w.y < c.y + 20)
          return i < S.stoves.length
            ? { kind: "stove", i }
            : { kind: "stove-buy" };
      }
      for (let i = 0; i < COUNTER_SLOTS; i++) {
        const c = iso(1 + i, COUNTER_ROW);
        if (Math.abs(w.x - c.x) < 30 && w.y > c.y - 70 && w.y < c.y - 20)
          return { kind: "counter", slot: i };
      }
      for (const c of customers) {
        const p = iso(c.gx, c.gy);
        if (Math.abs(w.x - p.x) < 26 && w.y > p.y - 96 && w.y < p.y + 4)
          return { kind: "customer", c };
      }
      const cp = iso(chef.gx, chef.gy);
      if (Math.abs(w.x - cp.x) < 24 && w.y > cp.y - 96 && w.y < cp.y)
        return { kind: "staff", who: "chef" };
      for (const x of [...waiters, ...cooks]) {
        const p = iso(x.gx, x.gy);
        if (Math.abs(w.x - p.x) < 24 && w.y > p.y - 96 && w.y < p.y + 4)
          return { kind: "worker", st: x.staff };
      }
    }
    // Items: the tile under the pointer, or the item's tall body above it.
    const g = toGrid(w);
    const candidates = S.items
      .filter((it) => {
        const def = ITEM_BY_KIND[it.kind];
        if (def.floor) {
          return (
            g.x > it.x - 0.5 &&
            g.x < it.x + 1.5 &&
            g.y > it.y - 0.5 &&
            g.y < it.y + 1.5
          );
        }
        const c = iso(it.x, it.y);
        return Math.abs(w.x - c.x) < 34 && w.y > c.y - 80 && w.y < c.y + 22;
      })
      .sort(
        (a, b) =>
          b.x +
          b.y -
          (a.x + a.y) +
          (ITEM_BY_KIND[a.kind].floor ? 100 : 0) -
          (ITEM_BY_KIND[b.kind].floor ? 100 : 0),
      );
    if (candidates[0]) return { kind: "item", it: candidates[0] };
    return null;
  };
  const tip = $("#bs-tip");
  let tipTimer: ReturnType<typeof setTimeout> | undefined;
  const showTip = (sx: number, sy: number, html: string) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${clamp(sx - r.width / 2, 8, W - r.width - 8)}px`;
    tip.style.top = `${clamp(sy - r.height - 14, 8, H - r.height - 8)}px`;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => (tip.hidden = true), 2600);
  };
  const hint = $("#bs-hint");
  const hideHint = () => hint.classList.add("done");

  const tap = (sx: number, sy: number) => {
    hideHint();
    tip.hidden = true;
    if (editing) return editTap(sx, sy);
    const h = hit(sx, sy);
    if (!h) {
      closeSheet();
      return;
    }
    const now = nowS();
    if (h.kind === "pile") return collectPile(h.p, true);
    if (h.kind === "litter") {
      if (visiting)
        return showTip(
          sx,
          sy,
          `<b>Litter</b><span>Their janitor will get it</span>`,
        );
      return sweepLitter(h.l, true);
    }
    if (h.kind === "worker") {
      const st = h.st;
      const e = visiting ? energyMax(st.level) : energyNow(S, st, now);
      sound("boing");
      showTip(
        sx,
        sy,
        `<b>${esc(staffName(st))} · ${roleName(st.role)}</b><span>Energy ${Math.round(e)} of ${energyMax(st.level)} · ${moodName(e)}</span>${e < 50 && !visiting ? `<small>Feed them in Staff → Your team</small>` : ""}`,
      );
      if (e < 50 && !visiting) openSheet("staff", "team");
      return;
    }
    if (h.kind === "stove") {
      const st = S.stoves[h.i];
      if (visiting)
        return showTip(
          sx,
          sy,
          `<b>${esc(visiting.name)}'s kitchen</b><span>Only they can cook here</span>`,
        );
      if (!st.dish) return openSheet("cook", h.i);
      if (inPerfectWindow(st, now) && sync.do({ a: "stir", stove: h.i }).ok) {
        const c = iso(STOVE_TILES[h.i].x, STOVE_TILES[h.i].y);
        burst(c.x, c.y - 70, "spark", 18, "#ffd65b", 1);
        floatText({ x: c.x, y: c.y - 96 }, "Perfect!", "#ffd65b", true);
        sound("chime");
        chef.hop = 1;
        changed();
        return;
      }
      if (cookProgress(st, now) >= 1) return plateStove(h.i);
      const d = DISH_BY_ID[st.dish];
      const left = (stoveMs(st) - (now - st.start)) / 1000;
      const golden = !st.perfect && cookProgress(st, now) < PERFECT_FROM;
      return showTip(
        sx,
        sy,
        `<b>${esc(d.name)}</b><span>${fmtTime(left)} left${st.perfect ? " · perfect ★" : ""}</span>${golden ? `<small>Tap the pot when it glows gold for +${PERFECT_BONUS} servings</small>` : ""}`,
      );
    }
    if (h.kind === "stove-buy") return openSheet("staff", "upgrades");
    if (h.kind === "counter") {
      const c = S.counter[h.slot];
      return showTip(
        sx,
        sy,
        c
          ? `<b>${esc(DISH_BY_ID[c.dish].name)}</b><span>${c.servings} serving${c.servings === 1 ? "" : "s"} ready${c.perfect ? " · perfect ★" : ""}</span>`
          : `<b>Empty spot</b><span>Finished dishes go here</span>`,
      );
    }
    if (h.kind === "customer") {
      const c = h.c;
      const name = CHARACTERS[c.char].name;
      const what =
        c.state === "eating"
          ? "Enjoying the food"
          : c.state === "leave"
            ? c.angry
              ? "Left hungry"
              : "Full and happy"
            : c.dish
              ? `Wants ${DISH_BY_ID[c.dish].name}`
              : "Waiting for something to be cooked";
      c.hop = 1;
      sound("boing");
      return showTip(
        sx,
        sy,
        `<b>${c.vip ? "★ VIP · " : ""}${esc(name)}</b><span>${esc(what)}</span>`,
      );
    }
    if (h.kind === "staff") {
      chef.hop = 1;
      sound("boing");
      return showTip(
        sx,
        sy,
        `<b>Head chef ${esc(CHARACTERS[chef.char].name)}</b><span>Your Lobby fighter runs the kitchen</span>`,
      );
    }
    if (h.kind === "item") {
      const it = h.it;
      const c = iso(it.x, it.y);
      const fx: Partial<Record<ItemKind, () => void>> = {
        luckycat: () => (
          sound("meow"),
          burst(c.x, c.y - 60, "spark", 8, "#ffe27a", 0.5)
        ),
        aquarium: () => (
          sound("splash"),
          burst(c.x, c.y - 70, "spark", 6, "#bff0ff", 0.4)
        ),
        jukebox: () => (
          sound("chime"),
          burst(c.x, c.y - 70, "note", 5, "#ff9be8", 0.5)
        ),
        fountain: () => (
          sound("splash"),
          burst(c.x, c.y - 70, "spark", 10, "#c9f6ff", 0.6)
        ),
        plant: () => sound("rustle"),
        bonsai: () => sound("rustle"),
        lamp: () => sound("tick"),
      };
      fx[it.kind]?.();
      const def = ITEM_BY_KIND[it.kind];
      return showTip(
        sx,
        sy,
        `<b>${esc(def.name)}</b><span>${def.charm ? `+${def.charm} charm` : it.kind === "chair" ? "Seats one next to a table" : "Chairs around it seat guests"}</span>`,
      );
    }
  };
  const plateStove = (i: number) => {
    const st = S.stoves[i];
    const dish = st.dish!;
    const servings =
      DISH_BY_ID[dish].servings + (st.perfect ? PERFECT_BONUS : 0);
    let slot = S.counter.findIndex((c) => c?.dish === dish);
    if (slot < 0) slot = S.counter.findIndex((c) => !c);
    const level = S.level;
    const r = sync.do({ a: "plate", stove: i });
    if (!r.ok) {
      o.toast(r.error ?? "Can't plate that.");
      return;
    }
    const from = iso(STOVE_TILES[i].x, STOVE_TILES[i].y);
    const to = iso(1 + slot, COUNTER_ROW);
    flights.push({
      dish,
      from: { x: from.x, y: from.y - 70 },
      to: { x: to.x, y: to.y - 52 },
      t: 0,
      dur: 0.55,
    });
    sound("pop", 4);
    chef.hop = 1;
    floatText({ x: from.x, y: from.y - 96 }, `+${servings} servings`, "#fff");
    levelUp(S.level - level);
    changed();
  };

  /* ───────────── decorate mode ───────────── */
  const editEl = $("#bs-edit");
  const setEditing = (on: boolean) => {
    if (!on && held?.moving) held = null; // a moved item stays where it was
    editing = on;
    if (!on) held = null;
    hover = null;
    layer.classList.toggle("editing", on);
    closeSheet();
    renderEdit();
    hudDirty = true;
  };
  /** The plan's grade, and what it would be with the held item where it hovers. */
  let previewKey = "";
  let preview: LayoutStats | null = null;
  let previewItems: Item[] = [];
  const gradeText = () => {
    const now = layout.grade ?? "–";
    const then = preview ? (preview.grade ?? "–") : null;
    return then && then !== now
      ? `Floor plan ${now} → <b class="${then < now ? "up" : "down"}">${then}</b>`
      : `Floor plan <b>${now}</b>`;
  };
  const updatePreview = () => {
    const key =
      held && hover ? `${held.kind}:${hover.x},${hover.y},${held.rot}` : "";
    if (key === previewKey) return;
    previewKey = key;
    preview = null;
    if (held && hover && !ITEM_BY_KIND[held.kind].floor) {
      const copy: BistroState = {
        ...S,
        items: S.items.map((i) => ({ ...i })),
        stored: { ...S.stored, [held.kind]: (S.stored[held.kind] ?? 0) + 1 },
      };
      const moving = held.moving
        ? copy.items.find((i) => i.id === held!.moving!.id)
        : undefined;
      if (tryPlace(copy, held.kind, hover.x, hover.y, held.rot, moving).ok) {
        preview = layoutStats(copy.items, sizeOf(S.sizeLv));
        previewItems = copy.items;
      }
    }
    const g = editEl.querySelector("#bs-grade");
    if (g) g.innerHTML = gradeText();
  };
  const renderEdit = () => {
    editEl.hidden = !editing;
    if (!editing) return;
    const stored = Object.entries(S.stored).filter(([, n]) => (n ?? 0) > 0) as [
      ItemKind,
      number,
    ][];
    editEl.innerHTML = `
      <div class="bs-edit-head"><b>${held ? `Placing: ${esc(ITEM_BY_KIND[held.kind].name)}` : "Decorate"}</b><span>${held ? "Tap a floor tile to put it down" : "Tap something to move it · tags: a waiter's steps to each seat"}</span><em class="bs-grade" id="bs-grade">${gradeText()}</em></div>
      <div class="bs-store">${stored.length ? stored.map(([k, n]) => `<button type="button" data-hold="${k}" class="${held?.kind === k && !held.moving ? "on" : ""}"><img src="${itemIconUrl(k)}" alt=""><span>${esc(ITEM_BY_KIND[k].name)}</span><i>×${n}</i></button>`).join("") : `<em>Storage is empty</em>`}</div>
      <div class="bs-edit-btns">
        ${held?.kind === "chair" ? `<button type="button" data-ed="rot">Turn</button>` : ""}
        ${held ? `<button type="button" data-ed="store">Put away</button><button type="button" data-ed="cancel">Cancel</button>` : ""}
        <button type="button" data-ed="shop">Shop</button>
        <button type="button" class="go" data-ed="done">Done</button>
      </div>`;
  };
  editEl.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    sound("tick");
    if (b.dataset.hold) {
      held = { kind: b.dataset.hold as ItemKind, rot: 0 };
      renderEdit();
      return;
    }
    const a = b.dataset.ed;
    if (a === "done") setEditing(false);
    else if (a === "shop") openSheet("shop", "furniture");
    else if (a === "cancel") {
      held = null;
      renderEdit();
    } else if (a === "rot" && held) {
      held.rot = (held.rot + 1) % 4;
    } else if (a === "store" && held) {
      if (held.moving) {
        sync.do({ a: "store", id: held.moving.id });
        relayout();
        changed();
      }
      held = null;
      sound("whoosh");
      renderEdit();
    }
  });
  const inUse = (it: Item) => {
    if (it.kind === "chair") return seatBusy(it.id);
    if (it.kind === "table")
      return seatList.some((s) => s.table.id === it.id && seatBusy(s.chair.id));
    return false;
  };
  const standingOn = (x: number, y: number) =>
    [
      ...customers.filter((c) => c.state !== "seated" && c.state !== "eating"),
      ...waiters,
    ].some((w) => Math.round(w.gx) === x && Math.round(w.gy) === y);
  const editTap = (sx: number, sy: number) => {
    const g = toGrid(toWorld(sx, sy));
    const tile = { x: Math.round(g.x), y: Math.round(g.y) };
    if (!held) {
      const h = hit(sx, sy);
      if (h?.kind !== "item") return;
      if (inUse(h.it)) {
        o.toast("Someone is using that: wait until they leave.");
        return;
      }
      held = { kind: h.it.kind, rot: h.it.rot, moving: h.it };
      hover = { x: h.it.x, y: h.it.y };
      sound("rustle");
      renderEdit();
      return;
    }
    const def = ITEM_BY_KIND[held.kind];
    const fx = def.floor ? tile.x - 0 : tile.x,
      fy = tile.y;
    if (!def.floor && standingOn(fx, fy)) {
      o.toast("Someone is standing there.");
      return;
    }
    let rot = held.rot;
    if (held.kind === "chair") {
      // Turn the chair toward a table it touches.
      const tables = S.items.filter((i) => i.kind === "table");
      const t = tables.find(
        (t) => Math.abs(t.x - fx) + Math.abs(t.y - fy) === 1,
      );
      if (t) rot = t.x > fx ? 0 : t.y > fy ? 1 : t.x < fx ? 2 : 3;
    }
    const r = sync.do({
      a: "place",
      kind: held.kind,
      x: fx,
      y: fy,
      rot,
      ...(held.moving ? { id: held.moving.id } : {}),
    });
    if (!r.ok) {
      o.toast(r.error ?? "Can't put that there.");
      sound("tick");
      return;
    }
    const c = iso(fx, fy);
    burst(c.x, c.y - 10, "puff", 8, "#f3e2c6", 0.6);
    sound("plant");
    // Keep placing from storage while there are more of the same.
    held =
      !held.moving && (S.stored[held.kind] ?? 0) > 0
        ? { kind: held.kind, rot }
        : null;
    relayout();
    changed();
    renderEdit();
  };

  /* ───────────── sheets ───────────── */
  const sheet = $("#bs-sheet");
  let sheetKind: string | null = null;
  /** Staff → Hire: the role being hired for. */
  let hireRole: Role = "waiter";
  let hireChosen = false;
  let sheetArg: number | string | undefined;
  const closeSheet = () => {
    sheet.hidden = true;
    sheetKind = null;
    layer.classList.remove("sheet-open");
    layer
      .querySelectorAll(".bs-rail [data-sheet]")
      .forEach((b) => b.setAttribute("aria-expanded", "false"));
  };
  const openSheet = (kind: string, arg?: number | string) => {
    if (kind === "friends") void loadFriends();
    sheetKind = kind;
    sheetArg = arg;
    sheet.hidden = false;
    layer.classList.add("sheet-open");
    renderSheet();
    layer
      .querySelectorAll<HTMLElement>(".bs-rail [data-sheet]")
      .forEach((b) =>
        b.setAttribute("aria-expanded", String(b.dataset.sheet === kind)),
      );
    sound("tick");
  };
  const coinTag = (n: number) => `<i class="bs-c">${I("coin")}</i>${fmt(n)}`;
  const renderSheet = () => {
    if (!sheetKind) return;
    const head = (title: string, sub: string) =>
      `<header><div><h2>${title}</h2><p>${sub}</p></div><button type="button" class="x" data-close aria-label="Close">${I("close")}</button></header>`;
    if (sheetKind === "popularity") {
      const pi = popInput();
      const pp = popularity(S, pi);
      const rush = rushing();
      const row = (
        name: string,
        v: number,
        max: number,
        note: string,
        minus = false,
      ) =>
        `<div class="bs-pop-row${minus ? " minus" : ""}"><b>${name}</b><i style="--w:${clamp(v / max, 0, 1) * 100}%"></i><strong>${minus && v > 0 ? "−" : ""}${v.toFixed(1)}<small> / ${max}</small></strong><small>${note}</small></div>`;
      const lay = layout;
      sheet.innerHTML =
        head(
          `Popularity ${Math.round(pp.total)} · ${popTier(pp.total)}`,
          "How wanted your bistro is, out of 50: it sets how often guests come, how many wait at the door and how many are VIPs.",
        ) +
        `<div class="bs-pop">
          ${row("Service", pp.service, 30, `Rating ${S.rating.toFixed(1)} ★: quick, happy meals raise it`)}
          ${row("Decor", pp.decor, 10, `Charm ${charmPts}: decorations from the Shop add charm`)}
          ${row("Friends", pp.social, 4, `${pi.likesWeek ?? 0} likes this week · ${pi.dinedToday ?? 0} friends ate here today`)}
          ${row("Mess", pp.mess, 8, `${pi.dirty ?? 0} tables with coins left over ${DIRTY_SECONDS} s`, true)}
          <div class="bs-pop-fx">
            <div><b>${arrivalSeconds(pp.total, rush).toFixed(1)} s</b><small>between guests</small></div>
            <div><b>${Math.min(queueMax(pp.total), queueTiles.length)}</b><small>can wait at the door</small></div>
            <div><b>${Math.round(vipShare(pp.total, rush) * 100)}%</b><small>VIP guests</small></div>
          </div>
          <div class="bs-pop-plan">
            <div class="grade g-${lay.grade ?? "none"}">${lay.grade ?? "–"}</div>
            <p><b>Floor plan</b>${lay.grade ? `A waiter takes ${lay.tMeal.toFixed(1)} s a meal on average. Seats close to the counter are served fastest (and earn more while you're away).` : "No seat can be reached yet: put chairs next to tables."}</p>
            ${visiting ? "" : `<button type="button" class="pr" data-plan>Decorate</button>`}
          </div>
        </div>`;
      return;
    }
    if (sheetKind === "friends") {
      sheet.innerHTML =
        head(
          "Friends' bistros",
          "Visit, eat there once a day (they earn the dish and a tip; you get coins and XP) and leave a like once a week.",
        ) +
        (friendState === "loading"
          ? `<p class="bs-note">Looking up your friends…</p>`
          : friendState === "error"
            ? `<p class="bs-note">Couldn't load your friends. Try again in a moment.</p>`
            : !friendList.length
              ? `<p class="bs-note">None of your friends has a bistro yet. Add friends from the Lobby (Friends) and invite them to open one.</p>`
              : `<div class="bs-team">${friendList
                  .map(
                    (f) => `<div class="bs-staff friend">
                <img class="pt" src="${portrait(f.fighter)}" alt="">
                <div class="who"><b>${esc(f.name)}</b><span class="role waiter">Level ${f.level}</span>
                  ${f.popularity === undefined ? `<span class="lv">${"★".repeat(Math.round(f.rating))}<i>${"★".repeat(5 - Math.round(f.rating))}</i></span>` : `<span class="lv pop">Popularity ${Math.round(f.popularity)}</span>`}
                  <small>♥ ${fmt(f.likes)} · ${fmt(f.served)} guests served · ${f.servings ? `${f.servings} servings on the counter` : "nothing on the counter"}${f.dined ? " · you ate here today" : ""}</small>
                </div>
                <button type="button" class="pr" data-visit="${esc(f.id)}">Visit</button>
              </div>`,
                  )
                  .join("")}</div>`);
      return;
    }
    if (sheetKind === "cook" || sheetKind === "menu") {
      const cook = sheetKind === "cook";
      const sp = special();
      sheet.innerHTML =
        head(
          cook ? `Stove ${Number(sheetArg) + 1}: what's cooking?` : "Recipes",
          cook
            ? "Pick a dish. Tap the pot when it glows gold for a perfect batch."
            : "Everything your kitchen can make, and what opens next.",
        ) +
        `<div class="bs-dishes">${DISHES.map((d) => {
          const locked = d.level > S.level;
          const poor = S.coins < d.cost;
          const per = Math.round(
            (d.servings * d.price - d.cost) / (d.seconds / 60),
          );
          return `<button type="button" class="bs-dish${locked ? " locked" : ""}${d.id === sp ? " special" : ""}" data-dish="${d.id}" ${!cook || locked ? "disabled" : ""}>
            <img src="${dishIconUrl(d.id, 96)}" alt="">
            <b>${esc(d.name)}</b><small>${esc(d.blurb)}</small>
            ${locked ? `<span class="lk">${I("lock")} Level ${d.level}</span>` : `<span class="st"><em>${I("clock")} ${fmtTime(d.seconds)}</em><em>× ${d.servings}</em><em class="${poor ? "poor" : ""}">${coinTag(d.cost)}</em></span><span class="pf">${coinTag(d.price)} a plate · ~${fmt(per)}/min</span>`}
            ${d.id === sp ? `<i class="sp">Special ×1.5</i>` : ""}
          </button>`;
        }).join("")}</div>`;
    } else if (sheetKind === "staff") {
      const tab = (sheetArg as string) || "team";
      const tabs = [
        ["team", "Your team"],
        ["hire", "Hire"],
        ["upgrades", "Upgrades"],
      ];
      let body = "";
      if (tab === "team") {
        const now = nowS();
        const meal = fullestSlot(S) >= 0;
        const cards = S.staff.map((st) => {
          const name = staffName(st);
          const up =
            st.level < STAFF_MAX_LEVEL ? staffUpgradePrice(st.level) : null;
          const ci = staffOf(S, "cook").indexOf(st);
          const stove = st.role === "cook" ? cookStove(S, ci) : -1;
          const e = energyNow(S, st, now);
          const max = energyMax(st.level);
          const wait = st.fedAt ? FEED_COOLDOWN_MS - (now - st.fedAt) : 0;
          const pace = Math.round((workSpeed(st, e) - 1) * 100);
          const job =
            st.role === "cook"
              ? stove >= 0
                ? `Runs stove ${stove + 1}`
                : "Needs a stove: build one in Upgrades"
              : st.role === "janitor"
                ? "Clears tables and sweeps"
                : waiters.some((w) => w.staff.role === "janitor")
                  ? "Serves (the janitor clears)"
                  : "Serves and clears";
          const feed =
            e >= max - 0.5
              ? `<span class="lk">Full</span>`
              : wait > 0
                ? `<span class="lk">Ate ${fmtTime(Math.max(0, (FEED_COOLDOWN_MS - wait) / 1000))} ago</span>`
                : `<button type="button" class="pr feed" data-feed="${st.id}" ${meal ? "" : "disabled"} title="${meal ? "A serving from the counter: +50 energy" : "Nothing on the counter to eat"}">Feed</button>`;
          return `<div class="bs-staff${st.friend ? " is-friend" : ""}">
            <img class="pt" src="${portrait(st.char)}" alt="">
            <div class="who"><b>${esc(name)}</b><span class="role ${st.role}">${roleName(st.role)}</span>${st.friend ? `<span class="role friend">Friend</span>` : ""}
              <span class="lv">${"★".repeat(st.level)}<i>${"★".repeat(STAFF_MAX_LEVEL - st.level)}</i></span>
              <small>${job} · ${pace >= 0 ? `${pace}% faster` : `${-pace}% slower`}</small>
              <span class="en ${moodName(e).toLowerCase()}" title="Energy ${Math.round(e)} of ${max}"><i style="--e:${(e / max) * 100}%"></i><em>${moodName(e)} · ${Math.round(e)}</em></span>
            </div>
            <div class="acts">${feed}${up === null ? `<span class="lk">Top level</span>` : `<button type="button" class="pr ${S.coins < up ? "poor" : ""}" data-up="${st.id}">Train ${coinTag(up)}</button>`}</div>
            ${
              st.role === "cook"
                ? `<div class="cookdish"><small>Cooks</small>${unlockedDishes(
                    S.level,
                  )
                    .map(
                      (d) =>
                        `<button type="button" data-cd="${st.id}:${d.id}" class="${st.dish === d.id ? "on" : ""}" title="${esc(d.name)}"><img src="${dishIconUrl(d.id, 48)}" alt="${esc(d.name)}"></button>`,
                    )
                    .join("")}</div>`
                : ""
            }
          </div>`;
        });
        body = `<div class="bs-team">${cards.join("")}
          <p class="bs-note">${I("clock")} While you are away your staff keep the bistro open for up to <b>${SHIFT_HOURS[S.shiftLv]} hours</b>: cooks cook their dish, waiters serve what is on the counter.${staffOf(S, "cook").length ? "" : " <b>Hire a cook</b> so food keeps coming."} Work tires them (tired staff are slower): feed them a serving from the counter, put a Staff Corner in the room, or let them rest after the shift.</p></div>`;
      } else if (tab === "hire") {
        if (!friendsAsked) void loadFriends();
        // Until you pick one: a role you can hire for now.
        const open = (r: Role) => {
          const st = nextHire(S, r);
          return !!st && S.level >= st.level;
        };
        if (!hireChosen && !open(hireRole))
          hireRole =
            (["cook", "waiter", "janitor"] as const).find(open) ?? hireRole;
        const role = hireRole;
        const step = nextHire(S, role);
        const btn = (attr: string) =>
          !step
            ? `<span class="lk">${roleName(role)}s full</span>`
            : S.level < step.level
              ? `<span class="lk">${I("lock")} Level ${step.level}</span>`
              : `<button type="button" class="pr ${S.coins < step.price ? "poor" : ""}" ${attr} title="Hire as ${roleName(role).toLowerCase()}">Hire · ${step.price ? coinTag(step.price) : "free"}</button>`;
        const roles = (["cook", "waiter", "janitor"] as const)
          .map(
            (r) =>
              `<button type="button" data-role="${r}" aria-pressed="${r === role}">${roleName(r)} ${staffOf(S, r).length}/${HIRE_STEPS[r].length}</button>`,
          )
          .join("");
        const hired = new Set(S.staff.map((x) => x.friend?.id).filter(Boolean));
        const friends =
          friendState === "ready"
            ? friendList
                .filter((f) => !hired.has(f.id))
                .map(
                  (f) =>
                    `<div class="bs-item hire friend"><img src="${portrait(f.fighter)}" alt=""><b>${esc(f.name)}</b><small>Your friend · works 10% faster</small>${btn(`data-hirefriend="${esc(f.id)}"`)}</div>`,
                )
                .join("")
            : "";
        body = `<nav class="bs-tabs roles">${roles}</nav><div class="bs-items">${friends}${candidates(
          S,
          chef.char,
        )
          .map(
            (c) =>
              `<div class="bs-item hire"><img src="${portrait(c)}" alt=""><b>${esc(CHARACTERS[asChar(c)].name)}</b><small>${esc(CHARACTERS[asChar(c)].element)} · looking for work</small>${btn(`data-hire="${role}:${c}"`)}</div>`,
          )
          .join(
            "",
          )}</div><p class="bs-note">${role === "janitor" ? "Janitors clear the tables (so waiters only serve) and sweep up litter, which costs popularity." : role === "cook" ? "Cooks each run a stove on their own and keep the counter stocked." : "Waiters bring the dishes; more of them serve more guests."} New faces come by every day; friends can work for you too.</p>`;
      } else {
        const sp = nextStovePrice(S);
        const kp = KITCHEN_PRICES[S.kitchenLv];
        const shp = SHIFT_PRICES[S.shiftLv];
        const card = (
          attr: string,
          icon: string,
          title: string,
          sub: string,
          price: number | null | undefined,
          done: string,
        ) =>
          `<button type="button" class="bs-item" ${attr} ${price == null ? "disabled" : ""}><div class="ic">${I(icon)}</div><b>${title}</b><small>${sub}</small>${price == null ? `<span class="lk">${done}</span>` : `<span class="pr ${S.coins < price ? "poor" : ""}">${coinTag(price)}</span>`}</button>`;
        const ex = EXPAND_STEPS[S.sizeLv];
        const next = sizeOf(S.sizeLv + 1);
        const expandCard = !ex
          ? card(
              "data-expand",
              "house",
              "Dining room",
              `${R.cols} × ${R.rows}: the biggest it gets`,
              null,
              "Fully expanded",
            )
          : S.level < ex.level
            ? `<button type="button" class="bs-item" disabled><div class="ic">${I("house")}</div><b>Expand the dining room</b><small>${sizeOf(S.sizeLv).cols} × ${sizeOf(S.sizeLv).rows} → ${next.cols} × ${next.rows}</small><span class="lk">${I("lock")} Level ${ex.level}</span></button>`
            : card(
                "data-expand",
                "house",
                "Expand the dining room",
                `${sizeOf(S.sizeLv).cols} × ${sizeOf(S.sizeLv).rows} → ${next.cols} × ${next.rows}: room for more tables`,
                ex.price,
                "",
              );
        body = `<div class="bs-items">
          ${expandCard}
          ${card("data-buy-stove", "spark", "Another stove", `${S.stoves.length} of ${MAX_STOVES} in the kitchen`, sp, "All built")}
          ${card("data-kitchen", "star", `Kitchen level ${S.kitchenLv + 1}`, `Every dish cooks ${(S.kitchenLv + 1) * 10}% faster (now ${S.kitchenLv * 10}%)`, kp, "Fully upgraded")}
          ${card("data-shift", "clock", `Longer shifts`, `Open ${SHIFT_HOURS[S.shiftLv]} h while you're away${shp != null ? ` → ${SHIFT_HOURS[S.shiftLv + 1]} h` : ""}`, shp, "8 hours: the longest")}
        </div>`;
      }
      sheet.innerHTML =
        head("Staff", `Hire, train and upgrade · ${coinTag(S.coins)}`) +
        `<nav class="bs-tabs">${tabs.map(([id, label]) => `<button type="button" data-tab="${id}" aria-pressed="${id === tab}">${label}</button>`).join("")}</nav>` +
        body;
    } else if (sheetKind === "shop") {
      const tab = (sheetArg as string) || "furniture";
      const tabs = [
        ["furniture", "Furniture"],
        ["decor", "Decor"],
        ["style", "Floors & walls"],
        ["bank", "Bank"],
      ];
      let body = "";
      if (tab === "furniture" || tab === "decor") {
        body = `<div class="bs-items">${ITEMS.filter((i) => i.group === tab)
          .map((i) => {
            const locked = i.level > S.level;
            return `<button type="button" class="bs-item${locked ? " locked" : ""}" data-buy="${i.kind}" ${locked ? "disabled" : ""}>
              <img src="${itemIconUrl(i.kind, 96)}" alt=""><b>${esc(i.name)}</b>
              <small>${i.charm ? `+${i.charm} charm` : i.kind === "chair" ? "Seats one guest" : "Put chairs around it"}${S.stored[i.kind] ? ` · ${S.stored[i.kind]} stored` : ""}</small>
              ${locked ? `<span class="lk">${I("lock")} Level ${i.level}</span>` : `<span class="pr ${S.coins < i.price ? "poor" : ""}">${coinTag(i.price)}</span>`}
            </button>`;
          })
          .join("")}</div>`;
      } else if (tab === "bank") {
        const left = BISTRO_TRADE.dailyLeaves - sync.extras.tradedToday;
        body = `<div class="bs-bank"><p>Trade bistro coins for Gold Leaves (the Farm's currency): <b>${BISTRO_TRADE.coins} coins → ${BISTRO_TRADE.leaves} ${I("leaf")}</b>, up to ${BISTRO_TRADE.dailyLeaves} leaves a day.</p>
          <div class="bs-bank-left"><b>${fmt(Math.max(0, left))}</b><small>leaves left to trade today · you have ${fmt(sync.extras.leaves)} ${I("leaf")}</small></div>
          <div class="bs-items">${[1, 5, 15]
            .map((lots) => {
              const gets = lots * BISTRO_TRADE.leaves;
              const cost = lots * BISTRO_TRADE.coins;
              const off = gets > left;
              return `<button type="button" class="bs-item" data-trade="${lots}" ${off ? "disabled" : ""}><div class="ic">${I("leaf")}</div><b>${gets} Gold Leaves</b><small>for ${fmt(cost)} bistro coins</small>${off ? `<span class="lk">Over today's limit</span>` : `<span class="pr ${S.coins < cost ? "poor" : ""}">${coinTag(cost)}</span>`}</button>`;
            })
            .join("")}</div></div>`;
      } else {
        const row = (
          kind: "floor" | "wall",
          list: readonly { id: string; name: string; price: number }[],
          cur: string,
          owned: string[],
        ) =>
          list
            .map(
              (
                f,
              ) => `<button type="button" class="bs-item sw sw-${kind}-${f.id}${cur === f.id ? " on" : ""}" data-style="${kind}:${f.id}">
              <div class="swatch"></div><b>${esc(f.name)}</b><small>${kind === "floor" ? "Floor" : "Walls"}</small>
              ${cur === f.id ? `<span class="lk">In use</span>` : owned.includes(f.id) ? `<span class="pr">Use</span>` : `<span class="pr ${S.coins < f.price ? "poor" : ""}">${coinTag(f.price)}</span>`}
            </button>`,
            )
            .join("");
        body = `<div class="bs-items">${row("floor", FLOORS, S.floor, S.floors)}${row("wall", WALLS, S.wall, S.walls)}</div>`;
      }
      sheet.innerHTML =
        head("Shop", `Bistro coins: ${coinTag(S.coins)}`) +
        `<nav class="bs-tabs">${tabs.map(([id, label]) => `<button type="button" data-tab="${id}" aria-pressed="${id === tab}">${label}</button>`).join("")}</nav>` +
        body;
    }
  };
  sheet.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b || b.disabled) return;
    if (b.hasAttribute("data-close")) return closeSheet();
    if (b.hasAttribute("data-plan")) {
      closeSheet();
      return setEditing(true);
    }
    if (b.dataset.tab) {
      sheetArg = b.dataset.tab;
      sound("tick");
      return renderSheet();
    }
    if (b.dataset.dish && sheetKind === "cook") {
      const i = Number(sheetArg);
      const r = sync.do({
        a: "cook",
        stove: i,
        dish: b.dataset.dish as DishId,
      });
      if (!r.ok) return o.toast(r.error ?? "Can't cook that.");
      const c = iso(STOVE_TILES[i].x, STOVE_TILES[i].y);
      burst(c.x, c.y - 60, "spark", 8, "#ffb36b", 0.5);
      sound("plant");
      chef.hop = 1;
      closeSheet();
      changed();
      return;
    }
    if (b.dataset.buy) {
      const kind = b.dataset.buy as ItemKind;
      const r = sync.do({ a: "buy", kind });
      if (!r.ok) return o.toast(r.error ?? "Can't buy that.");
      sound("coin");
      changed();
      closeSheet();
      if (!editing) setEditing(true);
      held = { kind, rot: 0 };
      renderEdit();
      return;
    }
    if (b.hasAttribute("data-buy-stove")) {
      const r = sync.do({ a: "stove" });
      if (!r.ok) return o.toast(r.error ?? "Can't build that.");
      sound("fanfare");
      const c = iso(STOVE_TILES[S.stoves.length - 1].x, 0);
      burst(c.x, c.y - 50, "confetti", 30, "#ffd65b", 1);
      changed();
      return renderSheet();
    }
    if (b.dataset.role) {
      hireRole = b.dataset.role as Role;
      hireChosen = true;
      sound("tick");
      return renderSheet();
    }
    if (b.dataset.feed) {
      const id = Number(b.dataset.feed);
      const r = sync.do({ a: "feed", id });
      if (!r.ok) return o.toast(r.error ?? "Can't feed them now.");
      sound("chime");
      const w = [...waiters, ...cooks].find((x) => x.staff.id === id);
      if (w) {
        w.hop = 1;
        const p = iso(w.gx, w.gy);
        burst(p.x, p.y - 80, "heart", 6, "#ff9a6b", 0.6);
        floatText({ x: p.x, y: p.y - 100 }, "+50 energy", "#9cf07f", true);
      }
      changed();
      return renderSheet();
    }
    if (b.dataset.hire || b.dataset.hirefriend) {
      const f = b.dataset.hirefriend
        ? friendList.find((x) => x.id === b.dataset.hirefriend)
        : undefined;
      if (b.dataset.hirefriend && !f) return;
      const [role, char] = f
        ? [hireRole, f.fighter]
        : (b.dataset.hire!.split(":") as [Role, string]);
      if (f) friendNames.set(f.id, f.name);
      const r = sync.do(
        f ? { a: "hire", role, char, friend: f.id } : { a: "hire", role, char },
      );
      if (!r.ok) return o.toast(r.error ?? "Can't hire them.");
      syncStaff();
      sound("fanfare");
      const p = iso(DOOR.x, DOOR.y);
      burst(p.x, p.y - 40, "confetti", 30, "#ffd65b", 1);
      banner(
        `<b>Welcome aboard!</b><span>${esc(f ? f.name : CHARACTERS[asChar(char)].name)} joins as your ${roleName(role).toLowerCase()}</span>`,
      );
      changed();
      sheetArg = "team";
      return renderSheet();
    }
    if (b.dataset.up) {
      const r = sync.do({ a: "train", id: Number(b.dataset.up) });
      if (!r.ok) return o.toast(r.error ?? "Can't train them.");
      syncStaff();
      sound("levelup");
      changed();
      return renderSheet();
    }
    if (b.dataset.cd) {
      const [id, dish] = b.dataset.cd.split(":");
      const r = sync.do({
        a: "cookdish",
        id: Number(id),
        dish: dish as DishId,
      });
      if (!r.ok) return o.toast(r.error ?? "Can't cook that.");
      sound("tick");
      changed();
      return renderSheet();
    }
    if (b.hasAttribute("data-expand")) {
      const r = sync.do({ a: "expand" });
      if (!r.ok) return o.toast(r.error ?? "Can't expand now.");
      relayout();
      sound("fanfare");
      const c = iso(R.cols - 2, R.rows - 2);
      burst(c.x, c.y - 40, "confetti", low ? 30 : 80, "#ffd65b", 1.4);
      banner(
        `<b>A bigger bistro!</b><span>The dining room is now ${R.cols} × ${R.rows}: decorate the new space</span>`,
        3200,
      );
      changed();
      return renderSheet();
    }
    if (b.hasAttribute("data-kitchen") || b.hasAttribute("data-shift")) {
      const r = sync.do({
        a: b.hasAttribute("data-kitchen") ? "kitchen" : "shift",
      });
      if (!r.ok) return o.toast(r.error ?? "Can't upgrade that.");
      sound("fanfare");
      changed();
      return renderSheet();
    }
    if (b.dataset.trade) {
      const r = sync.do({ a: "trade", lots: Number(b.dataset.trade) });
      if (!r.ok) return o.toast(r.error ?? "Can't trade now.");
      sound("coin");
      void sync.flush();
      return renderSheet();
    }
    if (b.dataset.visit) {
      const f = friendList.find((x) => x.id === b.dataset.visit);
      if (f) void enterVisit(f);
      return;
    }
    if (b.dataset.style) {
      const [kind, id] = b.dataset.style.split(":") as [
        "floor" | "wall",
        string,
      ];
      const r = sync.do({ a: "style", kind, id });
      if (!r.ok) return o.toast(r.error ?? "Can't use that.");
      sound("plant");
      changed();
      return renderSheet();
    }
  });
  layer.querySelector(".bs-rail")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    hideHint();
    if (b.dataset.act === "decor") return setEditing(!editing);
    const k = b.dataset.sheet!;
    if (sheetKind === k) closeSheet();
    else openSheet(k);
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (sheetKind) closeSheet();
      else if (editing) setEditing(false);
    }
  };
  window.addEventListener("keydown", onKey);

  /* ───────────── HUD ───────────── */
  let hudDirty = true;
  let hudAt = 0;
  const badge = $("#bs-badge");
  const chips = $("#bs-chips");
  let lastChips = "";
  chips.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest("[data-pop]")) return;
    sound("tick");
    if (sheetKind === "popularity") closeSheet();
    else openSheet("popularity");
  });
  const bar = $("#bs-bar");
  const renderHud = () => {
    // The wallet (yours; hidden while you visit a friend).
    wallet.hidden = !!visiting;
    const coinsText = fmt(shownCoins);
    const coinsEl = wallet.querySelector("b")!;
    if (coinsEl.textContent !== coinsText) coinsEl.textContent = coinsText;
    placeWallet();
    hudDirty = false;
    // A dot on Staff when someone can be hired right now.
    const canHire = (["cook", "waiter", "janitor"] as const).some((r) => {
      const st = nextHire(S, r);
      return !!st && S.level >= st.level && S.coins >= st.price;
    });
    const dot = layer.querySelector<HTMLElement>("#bs-staff-dot");
    if (dot) dot.hidden = !canHire;
    const need = xpToNext(S.level);
    const name = visiting ? visiting.name : o.playerName();
    badge.innerHTML = `<div class="bs-ring" style="--p:${Math.round((S.xp / need) * 100)}"><b>${S.level}</b></div>
      <strong>${esc(name.endsWith("s") ? `${name}'` : `${name}'s`)} Bistro</strong>
      ${visiting ? `<small class="likes">♥ ${fmt(visiting.likes)}</small>` : ""}
      <div class="xpbar" title="${S.xp} / ${need} XP"><i style="width:${(S.xp / need) * 100}%"></i></div>`;
    const pop = popNow().total;
    const popN = Math.round(pop);
    const sp = DISH_BY_ID[special()];
    const chipsHtml = `<button type="button" class="bs-chip glass pop" data-pop title="Popularity ${popN} of 50 · ${popTier(pop)}"><span class="pop-ring" style="--p:${popN * 2}"><i>${popN}</i></span><span><small>Popularity</small><b>${popTier(pop)}</b></span><b class="ph">Popularity</b></button>
      <div class="bs-chip glass special"><img src="${dishIconUrl(sp.id, 48)}" alt=""><span><small>Today's special</small><b>${esc(sp.name)}</b></span></div>
      ${rushing() ? `<div class="bs-chip glass rush"><b>Rush hour!</b><small>Tips ×2 · ${RUSH_SECONDS - (Math.floor((nowS() + rushShift) / 1000) % RUSH_PERIOD)}s</small></div>` : `<button type="button" class="bs-chip glass soft lay" data-pop title="How handy the seats are for the waiters"><small>Floor plan</small><b>${layout.grade ? `Grade ${layout.grade}` : "No seats"}</b></button>`}`;
    // Only when something shows differently: a chip redrawn under a finger
    // would swallow the tap.
    if (chipsHtml !== lastChips) {
      lastChips = chipsHtml;
      chips.innerHTML = chipsHtml;
    }
    const slots = S.counter
      .map((c) =>
        c
          ? `<div class="bs-slot${c.perfect ? " perfect" : ""}" title="${esc(DISH_BY_ID[c.dish].name)}"><img src="${dishIconUrl(c.dish, 64)}" alt=""><b>${c.servings}</b></div>`
          : `<div class="bs-slot empty"></div>`,
      )
      .join("");
    const comboLeft = clamp(1 - (T - lastServe) / COMBO_SECONDS, 0, 1);
    bar.innerHTML = `<div class="bs-slots"><small>Counter</small>${slots}</div>
      <div class="bs-combo${combo >= 2 && comboLeft > 0 ? " on" : ""}" style="--c:${comboLeft * 100}%"><small>Streak</small><b>×${combo >= 2 && comboLeft > 0 ? combo : 1}</b></div>
      <div class="bs-open"><small>${customers.filter((c) => c.state !== "leave").length} guests</small><b>${seatList.length} seats</b></div>`;
  };

  /* ───────────── update ───────────── */
  const update = (dt: number) => {
    T += dt;
    cars = updateCars(cars, dt, Math.random());
    // Nothing happens inside until the server has answered once.
    if (!sync.ready && !visiting) return;
    const now = nowS();
    // Rush hours come by the server's clock (35 s of every 4 minutes).
    const rushNow = rushing();
    if (rushNow && !wasRush && servingsLeft(S) > 0 && !editing && !visiting) {
      banner(
        `<b>Rush hour!</b><span>Guests pour in · tips ×2 for ${RUSH_SECONDS} s</span>`,
      );
      sound("whoosh");
    }
    if (rushNow !== wasRush) hudDirty = true;
    wasRush = rushNow;
    // Arrivals.
    spawnT -= dt;
    if (spawnT <= 0 && !editing) {
      spawn();
      spawnT =
        arrivalSeconds(popNow().total, rushing()) * (0.7 + Math.random() * 0.6);
    }
    for (const c of customers) updateCustomer(c, dt);
    customers = customers.filter((c) => !(c.state === "leave" && c.alpha <= 0));
    if (customers.some((c) => c.state === "queue")) seatFromQueue();
    for (const w of waiters) updateWaiter(w, dt);
    updateChef(dt);
    runKitchen(dt);
    // Customers who just found food on the counter.
    // (Seated customers without an order retry in updateCustomer.)
    // The door swings while someone is near it.
    const near = customers.some(
      (c) =>
        Math.abs(c.gx - DOOR.x) < 1.1 &&
        Math.abs(c.gy - DOOR.y) < 0.7 &&
        c.alpha > 0,
    );
    doorOpen = clamp(doorOpen + (near ? dt * 4 : -dt * 2.5), 0, 1);
    // Steam from cooking pots.
    if (!low)
      S.stoves.forEach((st, i) => {
        if (st.dish && Math.random() < dt * 5) {
          const c = iso(STOVE_TILES[i].x, STOVE_TILES[i].y);
          particles.push({
            x: c.x + (Math.random() - 0.5) * 14,
            y: c.y - 74,
            vx: (Math.random() - 0.5) * 8,
            vy: -26,
            life: 0,
            max: 1.6,
            kind: "steam",
            col: "#fff",
            size: 6 + Math.random() * 4,
          });
        }
        if (cookProgress(st, now) >= 1 && st.dish && Math.random() < dt * 2) {
          const c = iso(STOVE_TILES[i].x, STOVE_TILES[i].y);
          burst(c.x + 10, c.y - 80, "spark", 1, "#fff6c0", 0.3);
        }
      });
    if (
      !low &&
      S.items.some((i) => i.kind === "jukebox") &&
      Math.random() < dt * 0.8
    ) {
      const j = S.items.find((i) => i.kind === "jukebox")!;
      const c = iso(j.x, j.y);
      burst(
        c.x,
        c.y - 70,
        "note",
        1,
        ["#ff9be8", "#9fe3ff", "#ffe27a"][Math.floor(Math.random() * 3)],
        0.4,
      );
    }
    for (const p of particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "confetti") {
        p.vy += 420 * dt;
        p.vx *= 0.99;
        p.rot = (p.rot ?? 0) + dt * 8;
      } else if (p.kind === "spark") {
        p.vy += 60 * dt;
        p.vx *= 0.96;
      } else if (p.kind === "steam") p.vx += Math.sin(T * 3 + p.y) * dt * 6;
      else {
        p.vx *= 0.95;
        p.vy *= 0.98;
      }
    }
    particles = particles.filter((p) => p.life < p.max);
    if (particles.length > 600) particles.splice(0, particles.length - 600);
    for (const f of floaters) f.life += dt;
    floaters = floaters.filter((f) => f.life < (f.big ? 1.6 : 1.3));
    for (const f of flights) f.t += dt;
    flights = flights.filter((f) => f.t < f.dur);
    for (const f of flyers) {
      f.t += dt;
      if (f.t >= f.dur && f.last) {
        f.last = false;
        shownCoins = S.coins;
        hudDirty = true;
        wallet.classList.remove("bump");
        void wallet.offsetWidth;
        wallet.classList.add("bump");
      }
    }
    flyers = flyers.filter((f) => f.t < f.dur);
    if (!flyers.length && shownCoins !== S.coins && modal.hidden) {
      shownCoins = S.coins;
      hudDirty = true;
    }
    if (T - hudAt > 0.25 || hudDirty) {
      hudAt = T;
      renderHud();
    }
  };

  /* ───────────── draw ───────────── */
  const light = (): Light => {
    const tod =
      (window as unknown as { __bistroTod?: number }).__bistroTod ??
      deviceTimeOfDay();
    return { night: nightLevel(tod), gold: goldenLevel(tod), t: T };
  };
  type Drawable = { d: number; f: () => void };
  const drawWalker = (
    w: Walker,
    opts: {
      sit?: boolean;
      alpha?: number;
      hat?: "chef" | "waiter" | "vip" | "janitor";
      mood?: Mood;
      carry?: DishId | null;
    },
  ) => {
    const s = sprite(w.char, w.face, opts.mood ?? "normal");
    const p = iso(w.gx, w.gy);
    const walking = w.moving;
    const bob = walking
      ? Math.abs(Math.sin(w.walkT * 9)) * 5
      : Math.sin(T * 2.2 + w.walkT) * 1.2;
    const hop = Math.sin(w.hop * Math.PI) * 14 * (w.hop > 0 ? 1 : 0);
    const lift = (opts.sit ? 20 : 0) + bob + hop;
    ctx.globalAlpha = opts.alpha ?? 1;
    if (!opts.sit) softShadow(ctx, p.x, p.y + 2, 22 - bob * 0.6, 9, 0.3);
    if (s.ready) {
      const sq = walking
        ? 1 + Math.sin(w.walkT * 18) * 0.03
        : 1 + Math.sin(T * 2.2 + w.walkT) * 0.015;
      const k = SPR;
      const dw = s.cv.width * k,
        dh = s.cv.height * k * sq;
      const x = p.x - s.ax * k,
        y = p.y - lift - s.ay * k * sq;
      ctx.drawImage(s.cv, x, y, dw, dh);
      const headY = y + s.top * k * sq;
      if (opts.hat === "chef")
        drawChefHat(p.x + (s.ax - s.cv.width / 2) * 0, headY + 6);
      else if (opts.hat === "waiter") drawWaiterCap(p.x, headY + 8);
      else if (opts.hat === "janitor") drawJanitorCap(p.x, headY + 8, p);
      else if (opts.hat === "vip") drawCrown(p.x, headY + 2);
      if (opts.carry) {
        // A tray held up beside the head.
        const tx = p.x + 18,
          ty = headY + 16;
        ctx.fillStyle = "#c9ced3";
        ctx.beginPath();
        ctx.ellipse(tx, ty, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e9edf0";
        ctx.beginPath();
        ctx.ellipse(tx, ty - 1.5, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        drawDish(ctx, opts.carry, tx, ty - 4, 11, T, false);
      }
    } else {
      // A soft placeholder while the drawing decodes.
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - lift - 30, 18, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  const drawChefHat = (x: number, y: number) => {
    ctx.fillStyle = "#e8e6e1";
    ctx.beginPath();
    ctx.roundRect(x - 13, y - 10, 26, 10, 3);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - 9, y - 16, 9, 0, Math.PI * 2);
    ctx.arc(x + 9, y - 16, 9, 0, Math.PI * 2);
    ctx.arc(x, y - 22, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.08)";
    ctx.fillRect(x - 13, y - 4, 26, 4);
  };
  /** A crumpled wrapper, a paper cup or a napkin. */
  const drawLitter = (l: Litter) => {
    const p = iso(l.x, l.y);
    const x = p.x + ((l.id * 7) % 13) - 6,
      y = p.y + ((l.id * 5) % 7) - 3;
    softShadow(ctx, x, y + 2, 9, 4, 0.18);
    if (l.look === 0) {
      ctx.fillStyle = "#f3efe4";
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 2);
      ctx.lineTo(x - 2, y - 8);
      ctx.lineTo(x + 6, y - 6);
      ctx.lineTo(x + 7, y + 1);
      ctx.lineTo(x, y + 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (l.look === 1) {
      ctx.fillStyle = "#e85d4f";
      ctx.beginPath();
      ctx.roundRect(x - 8, y - 5, 14, 7, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 3, y - 5, 3, 7);
    } else {
      ctx.fillStyle = "#ffd65b";
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 8, 4, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c9952f";
      ctx.beginPath();
      ctx.ellipse(x + 2, y - 2, 3, 2, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  /** A green bandana, and a broom over the shoulder. */
  const drawJanitorCap = (x: number, y: number, feet: Pt) => {
    ctx.strokeStyle = "#8a5a2b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(feet.x + 22, feet.y - 4);
    ctx.lineTo(feet.x + 8, y + 18);
    ctx.stroke();
    ctx.fillStyle = "#e3b34a";
    ctx.beginPath();
    ctx.moveTo(feet.x + 16, feet.y - 2);
    ctx.lineTo(feet.x + 30, feet.y - 2);
    ctx.lineTo(feet.x + 26, feet.y - 14);
    ctx.lineTo(feet.x + 19, feet.y - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2f9e6b";
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 13, 7, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 13, y - 5, 26, 3);
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 3);
    ctx.lineTo(x + 18, y + 3);
    ctx.lineTo(x + 13, y + 4);
    ctx.closePath();
    ctx.fill();
  };
  const drawWaiterCap = (x: number, y: number) => {
    ctx.fillStyle = "#c2322e";
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e0453f";
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 14, 20, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(x - 10, y - 6, 20, 3);
  };
  const drawCrown = (x: number, y: number) => {
    ctx.fillStyle = "#ffd65b";
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x - 13, y - 14);
    ctx.lineTo(x - 6, y - 7);
    ctx.lineTo(x, y - 17);
    ctx.lineTo(x + 6, y - 7);
    ctx.lineTo(x + 13, y - 14);
    ctx.lineTo(x + 12, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff5a7a";
    ctx.beginPath();
    ctx.arc(x, y - 5, 2.5, 0, 7);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(T * 6)})`;
    drawSparkle(ctx, x + 12, y - 16, 4);
  };

  // A couple of cars already on the road when the bistro opens.
  let cars: Car[] = [
    { y: -2, v: 2.8, col: "#3d8fd1", kind: 0 },
    { y: 13, v: -3.1, col: "#f2c14e", kind: 1 },
  ];
  const scenery = document.createElement("canvas");
  let sceneryKey = "";
  const sceneryCanvas = (L: Light) => {
    const key = [
      R.cols,
      R.rows,
      view.s.toFixed(4),
      view.x.toFixed(1),
      view.y.toFixed(1),
      R.cols,
      R.rows,
      W,
      H,
      DPR,
      Math.round(L.night * 24),
      Math.round(L.gold * 24),
      special(),
    ].join(":");
    if (key === sceneryKey) return scenery;
    sceneryKey = key;
    scenery.width = cv.width;
    scenery.height = cv.height;
    const g = scenery.getContext("2d")!;
    g.setTransform(
      view.s * DPR,
      0,
      0,
      view.s * DPR,
      view.x * DPR,
      view.y * DPR,
    );
    drawSceneryStatic(g, L, DISH_BY_ID[special()].name);
    return scenery;
  };
  /** The diorama's outline: the slab, the floor and the walls. */
  const roomPath = () => {
    const l = iso(-0.5, R.rows - 0.5),
      b = iso(R.cols - 0.5, R.rows - 0.5),
      r = iso(R.cols - 0.5, -0.5),
      t = iso(-0.5, -0.5);
    ctx.beginPath();
    ctx.moveTo(l.x - 16, l.y + 40);
    ctx.lineTo(b.x, b.y + 40);
    ctx.lineTo(r.x + 16, r.y + 40);
    ctx.lineTo(r.x + 16, r.y - 190);
    ctx.lineTo(t.x, t.y - 190);
    ctx.lineTo(l.x - 16, l.y - 190);
    ctx.closePath();
  };
  const draw = () => {
    applyView();
    const L = light();
    // The street corner around the bistro: drawn once per view and light.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sceneryCanvas(L), 0, 0);
    ctx.setTransform(
      view.s * DPR,
      0,
      0,
      view.s * DPR,
      view.x * DPR,
      view.y * DPR,
    );
    drawSceneryLive(ctx, L, cars, low);
    drawGroundShadow(ctx);
    const sh = shellCanvas();
    ctx.drawImage(
      sh,
      BOUNDS.x0 - PAD,
      BOUNDS.y0 - PAD,
      sh.width / shellScale,
      sh.height / shellScale,
    );
    drawWindows(ctx, L, low);
    drawDoorAndBoard(ctx, doorOpen, DISH_BY_ID[special()].name, L);
    drawFestoon(ctx, L);
    drawRoofSign(ctx, L, T);
    // Sunbeams through the right wall's windows by day.
    if (!low && L.night < 0.8) drawBeams(L);
    // Rugs lie on the floor under everything.
    for (const it of S.items)
      if (ITEM_BY_KIND[it.kind].floor && it !== held?.moving && roomShown())
        drawItem(ctx, it.kind, it.x, it.y, T, it.rot);
    // Edit mode: the grid and where the held item would go.
    if (editing) drawEditGrid();

    const now = nowS();
    const list: Drawable[] = [];
    // Kitchen fixtures.
    list.push({ d: 0, f: () => drawFixture(ctx, "fridge", 0, 0, T, 0) });
    list.push({ d: 5, f: () => drawFixture(ctx, "sink", 5, 0, T, 0) });
    STOVE_TILES.forEach((tile, i) => {
      const st = S.stoves[i];
      list.push({
        d: tile.x + tile.y,
        f: () => {
          if (!st) {
            drawFixture(ctx, "stove-locked", tile.x, tile.y, T, 0);
            const c = iso(tile.x, tile.y);
            ctx.fillStyle = "rgba(255,255,255,.85)";
            ctx.font = "800 22px 'Barlow Condensed', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("+", c.x, c.y - 52);
            return;
          }
          const p = cookProgress(st, now);
          const cooking = !!st.dish && p < 1;
          drawFixture(
            ctx,
            "stove",
            tile.x,
            tile.y,
            T,
            cooking ? 1 : st.dish ? 0.3 : 0,
          );
          if (st.dish)
            drawPot(
              ctx,
              tile.x,
              tile.y,
              T,
              cooking,
              inPerfectWindow(st, now) ? 1 : 0,
              p >= 1,
            );
        },
      });
    });
    for (let x = 0; x <= COUNTER_X1; x++) {
      list.push({
        d: x + COUNTER_ROW + 0.2,
        f: () => {
          drawCounterTile(ctx, x, x === COUNTER_X1);
          const slot = x - 1;
          if (slot >= 0 && slot < COUNTER_SLOTS) {
            const c = S.counter[slot];
            if (c) {
              const p = iso(x, COUNTER_ROW);
              // A small stack: up to three plates shown.
              const n = Math.min(3, Math.ceil(c.servings / 4));
              for (let k = 0; k < n; k++)
                drawDish(
                  ctx,
                  c.dish,
                  p.x - 10 + k * 10,
                  p.y - 50 - k * 3 + (k % 2) * 4,
                  12,
                  T + k,
                  k === n - 1,
                );
              if (c.perfect) {
                ctx.fillStyle = `rgba(255,226,122,${0.6 + 0.4 * Math.sin(T * 5 + x)})`;
                drawSparkle(ctx, p.x + 18, p.y - 70, 5);
              }
            }
          }
        },
      });
    }
    // Furniture (a seated guest draws with their chair).
    const seated = new Map<number, Customer>();
    for (const c of customers)
      if (c.state === "seated" || c.state === "eating")
        seated.set(c.seat.chair.id, c);
    const plates = new Map<
      number,
      { spot: Pt; dish?: DishId; pile?: Pile }[]
    >();
    for (const c of customers)
      if (c.state === "eating" && c.dish) {
        const arr = plates.get(c.seat.table.id) ?? [];
        arr.push({
          spot: tableSpot(c.seat.table.x, c.seat.table.y, (c.seat.dir + 2) % 4),
          dish: c.dish,
        });
        plates.set(c.seat.table.id, arr);
      }
    for (const p of piles) {
      const arr = plates.get(p.tableId) ?? [];
      arr.push({ spot: p.spot, pile: p });
      plates.set(p.tableId, arr);
    }
    const seatDir = new Map(seatList.map((s) => [s.chair.id, s.dir]));
    for (const it of S.items) {
      if (ITEM_BY_KIND[it.kind].floor || it === held?.moving || !roomShown())
        continue;
      if (it.kind === "chair") {
        const dir = seatDir.get(it.id) ?? it.rot;
        const guest = seated.get(it.id);
        list.push({
          d: it.x + it.y,
          f: () => {
            drawChair(ctx, it.x, it.y, dir, "behind", it.id);
            if (guest)
              drawWalker(guest, {
                sit: true,
                hat: guest.vip ? "vip" : undefined,
                mood: guest.state === "eating" ? "happy" : "normal",
              });
            drawChair(ctx, it.x, it.y, dir, "front", it.id);
          },
        });
      } else if (it.kind === "table") {
        list.push({
          d: it.x + it.y,
          f: () => {
            drawItem(ctx, "table", it.x, it.y, T);
            for (const pl of plates.get(it.id) ?? []) {
              if (pl.dish)
                drawDish(ctx, pl.dish, pl.spot.x, pl.spot.y, 11, T, true);
              else if (pl.pile)
                drawLeftovers(
                  ctx,
                  pl.spot.x,
                  pl.spot.y,
                  pl.pile.coins,
                  T,
                  T - pl.pile.t0 < 5 ? 1 : 0.4,
                );
            }
          },
        });
      } else
        list.push({
          d: it.x + it.y,
          f: () => drawItem(ctx, it.kind, it.x, it.y, T, it.rot),
        });
    }
    // Litter on the floor (under whoever stands there).
    for (const l of litter)
      list.push({ d: l.x + l.y - 0.05, f: () => drawLitter(l) });
    // People on their feet.
    for (const c of customers)
      if (c.state === "enter" || c.state === "leave" || c.state === "queue")
        list.push({
          d: c.gx + c.gy + 0.3,
          f: () =>
            drawWalker(c, {
              alpha: clamp(c.alpha, 0, 1),
              hat: c.vip ? "vip" : undefined,
              mood:
                c.state === "leave" && !c.angry
                  ? "happy"
                  : c.angry
                    ? "hurt"
                    : "normal",
            }),
        });
    for (const w of waiters)
      list.push({
        d: w.gx + w.gy + 0.3,
        f: () =>
          drawWalker(w, {
            hat: w.staff.role === "janitor" ? "janitor" : "waiter",
            carry: w.carry,
          }),
      });
    list.push({
      d: chef.gx + chef.gy + 0.1,
      f: () =>
        drawWalker(chef, {
          hat: "chef",
          mood: chef.hop > 0 ? "happy" : "normal",
        }),
    });
    // The held item follows the pointer.
    if (editing && held && hover && !ITEM_BY_KIND[held.kind].floor) {
      const h = held,
        hv = hover;
      list.push({
        d: hv.x + hv.y + 0.5,
        f: () => {
          ctx.globalAlpha = 0.75;
          drawItem(ctx, h.kind, hv.x, hv.y, T, h.rot);
          ctx.globalAlpha = 1;
        },
      });
    }
    list.sort((a, b) => a.d - b.d);
    for (const it of list) it.f();
    if (editing && held && hover && ITEM_BY_KIND[held.kind].floor) {
      ctx.globalAlpha = 0.7;
      drawItem(ctx, held.kind, hover.x, hover.y, T);
      ctx.globalAlpha = 1;
    }

    // Dishes flying from the stove to the counter.
    for (const f of flights) {
      const u = ease(f.t / f.dur);
      const x = f.from.x + (f.to.x - f.from.x) * u,
        y = f.from.y + (f.to.y - f.from.y) * u - Math.sin(u * Math.PI) * 50;
      drawDish(ctx, f.dish, x, y, 13, T, false);
    }

    drawFrontLamps(ctx, L);
    drawLighting(L);
    drawOverlay(now);
    // Screen-space: coins flying to the badge.
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const tgt = coinTarget();
    for (const f of flyers) {
      if (f.t < 0) continue;
      const u = ease(f.t / f.dur);
      const x = f.x0 + (tgt.x - f.x0) * u,
        y = f.y0 + (tgt.y - f.y0) * u - Math.sin(u * Math.PI) * 80;
      const r = 8 - u * 2;
      ctx.fillStyle = "#b98314";
      ctx.beginPath();
      ctx.arc(x, y + 1.5, r, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#ffd65b";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.7)";
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, 7);
      ctx.fill();
    }
  };
  const drawBeams = (L: Light) => {
    const a = 0.1 * (1 - L.night) + L.gold * 0.06;
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [g0, g1] of WINDOWS.right) {
      const w0 = iso(g0, -0.5),
        w1 = iso(g1, -0.5);
      const shift = { x: -70, y: 150 };
      const top0 = { x: w0.x, y: w0.y - 146 },
        top1 = { x: w1.x, y: w1.y - 146 };
      const f0 = { x: w0.x + shift.x, y: w0.y + shift.y },
        f1 = { x: w1.x + shift.x, y: w1.y + shift.y };
      const g = ctx.createLinearGradient(top0.x, top0.y, f0.x, f0.y);
      const col = L.gold > 0.3 ? "255,190,110" : "255,245,210";
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(top0.x, top0.y);
      ctx.lineTo(top1.x, top1.y);
      ctx.lineTo(f1.x, f1.y);
      ctx.lineTo(f0.x, f0.y);
      ctx.closePath();
      ctx.fill();
      // Dust motes drifting in the beam.
      for (let i = 0; i < 6; i++) {
        const u = (i * 0.17 + T * 0.03) % 1,
          v = (i * 0.37 + Math.sin(T * 0.4 + i) * 0.05 + 0.5) % 1;
        const x = top0.x + (top1.x - top0.x) * v + (f0.x - top0.x) * u,
          y = top0.y + (top1.y - top0.y) * v + (f0.y - top0.y) * u;
        ctx.fillStyle = `rgba(255,250,230,${0.5 * (1 - u)})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
    ctx.restore();
  };
  const drawLighting = (L: Light) => {
    const n = L.night;
    if (n <= 0.02 && L.gold <= 0.02) return;
    ctx.save();
    if (n > 0.02) {
      // The room darkens (the street outside has its own night colours).
      ctx.save();
      roomPath();
      ctx.clip();
      ctx.globalCompositeOperation = "multiply";
      const k = 0.42 * n;
      ctx.fillStyle = `rgb(${Math.round(255 - 150 * k)},${Math.round(255 - 140 * k)},${Math.round(255 - 70 * k)})`;
      ctx.fillRect(
        BOUNDS.x0 - 50,
        BOUNDS.y0 - 80,
        BOUNDS.x1 - BOUNDS.x0 + 100,
        BOUNDS.y1 - BOUNDS.y0 + 160,
      );
      ctx.restore();
      // Warm pools of light from lamps, stoves and the festoon.
      ctx.globalCompositeOperation = "lighter";
      const glow = (
        x: number,
        y: number,
        r: number,
        rgb: string,
        a: number,
      ) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${a})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (const it of S.items) {
        const gl = itemGlow(it.kind);
        if (!gl) continue;
        const c = iso(it.x, it.y);
        glow(c.x + gl[0], c.y + gl[1], gl[2], gl[3], 0.32 * n);
      }
      if (!low)
        for (const p of festoonPoints())
          glow(p.x, p.y + 6, 26, "255,210,140", 0.22 * n);
      S.stoves.forEach((st, i) => {
        if (!st.dish) return;
        const c = iso(STOVE_TILES[i].x, STOVE_TILES[i].y);
        glow(c.x, c.y - 46, 70, "255,150,80", 0.25 * n);
      });
      const door = iso(-0.5, DOOR.y);
      glow(door.x + 20, door.y - 40, 80, "255,200,140", 0.12 * n * doorOpen);
      // Street lamps, headlights and the rooftop sign.
      for (const [x, y, r, rgb, a] of [
        ...sceneryGlows(),
        ...carGlows(cars),
        roofSignGlow(),
      ])
        glow(x, y, r, rgb, a * n);
    }
    if (L.gold > 0.02) {
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(255,140,50,${0.55 * L.gold})`;
      ctx.fillRect(-5000, -5000, 10000, 10000);
    }
    ctx.restore();
  };
  const drawEditGrid = () => {
    ctx.save();
    for (let x = 0; x < R.cols; x++)
      for (let y = 0; y < R.rows; y++) {
        const k = x <= COUNTER_X1 && y <= COUNTER_ROW;
        if (k) continue;
        const a = iso(x - 0.5, y - 0.5),
          b = iso(x + 0.5, y - 0.5),
          c = iso(x + 0.5, y + 0.5),
          d = iso(x - 0.5, y + 0.5);
        ctx.strokeStyle = "rgba(70,35,20,.32)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.stroke();
      }
    // Each seat by how far the waiters walk to it: green, yellow, red.
    updatePreview();
    const heat = { good: "79,210,122", fair: "255,194,61", far: "255,90,90" };
    const plan = preview ? previewItems : S.items;
    for (const w of (preview ?? layout).seats) {
      const chair = plan.find((i) => i.id === w.chair);
      if (!chair) continue;
      const { x, y } = chair;
      const a = iso(x - 0.42, y - 0.42),
        b = iso(x + 0.42, y - 0.42),
        c = iso(x + 0.42, y + 0.42),
        d = iso(x - 0.42, y + 0.42);
      ctx.fillStyle = `rgba(${heat[seatHeat(w.waiter)]},.42)`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
    if (held && hover) {
      const def = ITEM_BY_KIND[held.kind];
      const ok = tryPlaceDry(held.kind, hover.x, hover.y);
      for (let dx = 0; dx < (def.w ?? 1); dx++)
        for (let dy = 0; dy < (def.h ?? 1); dy++) {
          const x = hover.x + dx,
            y = hover.y + dy;
          const a = iso(x - 0.5, y - 0.5),
            b = iso(x + 0.5, y - 0.5),
            c = iso(x + 0.5, y + 0.5),
            d = iso(x - 0.5, y + 0.5);
          ctx.fillStyle = ok ? "rgba(120,255,150,.35)" : "rgba(255,90,90,.35)";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.lineTo(d.x, d.y);
          ctx.closePath();
          ctx.fill();
        }
    }
    ctx.restore();
  };
  const tryPlaceDry = (kind: ItemKind, x: number, y: number) => {
    const copy: BistroState = {
      ...S,
      items: S.items.slice(),
      stored: { ...S.stored, [kind]: (S.stored[kind] ?? 0) + 1 },
    };
    return (
      tryPlace(copy, kind, x, y, held?.rot ?? 0, held?.moving).ok &&
      !standingOn(x, y)
    );
  };
  /** Bubbles, rings, floaters and particles: always on top of the room. */
  const drawOverlay = (now: number) => {
    // Decorating: each seat's walk for the waiters, as a coloured tag.
    if (editing) {
      const plan = preview ? previewItems : S.items;
      const heat = { good: "#3fbf6e", fair: "#e8a92a", far: "#e0524f" };
      ctx.font = "800 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const w of (preview ?? layout).seats) {
        const chair = plan.find((i) => i.id === w.chair);
        if (!chair) continue;
        const p = iso(chair.x, chair.y);
        const x = p.x,
          y = p.y - 64;
        ctx.fillStyle = heat[seatHeat(w.waiter)];
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fillText(String(w.waiter), x, y + 0.5);
      }
    }
    // Perfect-moment and ready badges over the stoves.
    S.stoves.forEach((st, i) => {
      if (!st.dish) return;
      const c = iso(STOVE_TILES[i].x, STOVE_TILES[i].y);
      const p = cookProgress(st, now);
      const x = c.x,
        y = c.y - 112;
      if (p >= 1) {
        const b = 1 + Math.sin(T * 6) * 0.06;
        bubble(x, y, 22 * b, "#fff7e0");
        drawDish(ctx, st.dish, x, y + 4, 12, T, false);
        ctx.fillStyle = "#3fbf5a";
        ctx.beginPath();
        ctx.arc(x + 16, y - 14, 7, 0, 7);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 12.5, y - 14);
        ctx.lineTo(x + 15.5, y - 11);
        ctx.lineTo(x + 20, y - 17);
        ctx.stroke();
        return;
      }
      // A progress ring with the golden part of the bar marked.
      const r = 15;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(20,24,40,.55)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      const a0 = -Math.PI / 2;
      ctx.strokeStyle = st.perfect ? "#ffd65b" : "rgba(255,214,91,.45)";
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        r,
        a0 + PERFECT_FROM * Math.PI * 2,
        a0 + PERFECT_TO * Math.PI * 2,
      );
      ctx.stroke();
      ctx.strokeStyle = st.perfect ? "#ffd65b" : "#7ff0a2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r, a0, a0 + p * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "800 10px 'Barlow Condensed', sans-serif";
      ctx.textAlign = "center";
      const left = (stoveMs(st) / 1000) * (1 - p);
      ctx.fillText(fmtTime(left), x, y + 4);
      if (inPerfectWindow(st, now)) {
        const pulse = 0.5 + 0.5 * Math.sin(T * 12);
        ctx.fillStyle = `rgba(255,214,91,${0.75 + pulse * 0.25})`;
        ctx.font = "900 15px 'Barlow Condensed', sans-serif";
        ctx.strokeStyle = "rgba(60,30,0,.7)";
        ctx.lineWidth = 3;
        ctx.strokeText("TAP!", x, y - 22 - pulse * 3);
        ctx.fillText("TAP!", x, y - 22 - pulse * 3);
      }
    });
    // Hungry or exhausted staff say so.
    if (!visiting)
      for (const x of [...waiters, ...cooks]) {
        const e = energyNow(S, x.staff, now);
        if (e >= 50) continue;
        const p = iso(x.gx, x.gy);
        const bx = p.x - 16,
          by = p.y - 118;
        bubble(bx, by, 14, e < 20 ? "#e9e3ff" : "#fff3dc");
        ctx.font = "15px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(e < 20 ? "💤" : "🍜", bx, by + 1);
      }
    // Waiting by the door: a small bubble with how long they'll wait.
    for (const c of customers) {
      if (c.state !== "queue" || c.path.length) continue;
      const p = iso(c.gx, c.gy);
      const x = p.x + 4,
        y = p.y - 112;
      const pat = clamp(1 - (T - c.sat) / c.patience, 0, 1);
      bubble(x, y, 15, "#ffffff");
      ctx.fillStyle = "#6b7280";
      ctx.font = "800 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⌛", x, y + 1);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle =
        pat > 0.5 ? "#4fd27a" : pat > 0.25 ? "#ffc23d" : "#ff5a5a";
      ctx.beginPath();
      ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + pat * Math.PI * 2);
      ctx.stroke();
    }
    // Order bubbles with a patience ring.
    for (const c of customers) {
      if (c.state !== "seated") continue;
      const p = iso(c.gx, c.gy);
      const x = p.x + 4,
        y = p.y - 128;
      const pat = clamp(1 - (T - c.sat) / c.patience, 0, 1);
      const shake = pat < 0.25 ? Math.sin(T * 30) * 1.5 : 0;
      bubble(x + shake, y, 21, c.vip ? "#fff3c4" : "#ffffff");
      if (c.dish) drawDish(ctx, c.dish, x + shake, y + 5, 14, T, false);
      else {
        ctx.fillStyle = "#6b7280";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(
            x - 7 + i * 7,
            y + 1 - Math.max(0, Math.sin(T * 6 - i)) * 3,
            2.4,
            0,
            7,
          );
          ctx.fill();
        }
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle =
        pat > 0.5 ? "#4fd27a" : pat > 0.25 ? "#ffc23d" : "#ff5a5a";
      ctx.beginPath();
      ctx.arc(x + shake, y, 24, -Math.PI / 2, -Math.PI / 2 + pat * Math.PI * 2);
      ctx.stroke();
    }
    // Coins waiting on tables: a pulsing ring says "tap me".
    for (const p of piles) {
      const fresh = T - p.t0 < 5;
      const r = 16 + Math.sin(T * 6) * 2;
      ctx.strokeStyle = fresh
        ? "rgba(255,226,122,.9)"
        : "rgba(255,255,255,.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.spot.x + 4, p.spot.y - 2, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Particles.
    for (const p of particles) {
      const u = p.life / p.max;
      const a = 1 - u;
      if (p.kind === "steam") {
        ctx.fillStyle = `rgba(255,255,255,${0.22 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + u * 1.5), 0, 7);
        ctx.fill();
      } else if (p.kind === "spark") {
        ctx.fillStyle = p.col;
        ctx.globalAlpha = a;
        drawSparkle(ctx, p.x, p.y, p.size * (1 - u * 0.5));
        ctx.globalAlpha = 1;
      } else if (p.kind === "heart") {
        ctx.fillStyle = p.col;
        ctx.globalAlpha = a;
        heart(p.x, p.y, p.size + 2);
        ctx.globalAlpha = 1;
      } else if (p.kind === "note") {
        ctx.fillStyle = p.col;
        ctx.globalAlpha = a;
        ctx.font = "700 14px sans-serif";
        ctx.fillText(p.size > 4 ? "♪" : "♫", p.x, p.y);
        ctx.globalAlpha = 1;
      } else if (p.kind === "puff") {
        ctx.fillStyle = p.col;
        ctx.globalAlpha = a * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + u * 2), 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.col;
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    // Floating text.
    for (const f of floaters) {
      const u = f.life / (f.big ? 1.6 : 1.3);
      const y = f.y - ease(u) * 34;
      ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      ctx.font = `900 ${f.big ? 19 : 14}px 'Barlow Condensed', sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(40,20,10,.75)";
      const sc = u < 0.12 ? 0.6 + (u / 0.12) * 0.4 : 1;
      ctx.save();
      ctx.translate(f.x, y);
      ctx.scale(sc, sc);
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.col;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  };
  const bubble = (x: number, y: number, r: number, col: string) => {
    ctx.fillStyle = "rgba(30,20,10,.25)";
    ctx.beginPath();
    ctx.arc(x + 1.5, y + 2.5, r, 0, 7);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x - 5, y + r - 2);
    ctx.lineTo(x - 2, y + r + 9);
    ctx.lineTo(x + 6, y + r - 3);
    ctx.fill();
  };
  const heart = (x: number, y: number, s: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.35);
    ctx.fill();
  };

  /* ───────────── friends' bistros ───────────── */
  let friendList: BistroFriend[] = [];
  let friendState: "loading" | "error" | "ready" = "loading";
  let friendsAsked = false;
  const loadFriends = async () => {
    friendsAsked = true;
    friendState = "loading";
    try {
      friendList = await o.api.friends();
      friendState = "ready";
    } catch {
      friendState = "error";
    }
    for (const f of friendList) friendNames.set(f.id, f.name);
    if (sheetKind === "friends" || sheetKind === "staff") renderSheet();
  };
  const visitEl = $("#bs-visit");
  /** Clear the floor: guests, plates and the staff's errands. */
  const resetFloor = () => {
    customers = [];
    piles = [];
    litter = [];
    flights = [];
    combo = 0;
    for (const w of waiters) {
      w.task = null;
      w.carry = null;
      w.phase = "idle";
    }
  };
  const showFriend = (raw: unknown, id: string) => {
    const got = readServer(raw);
    const r = raw as Record<string, unknown>;
    visiting = {
      id,
      name: String(r.name ?? "Friend"),
      fighter: String(r.fighter ?? "voltkit"),
      dined: r.dined === true,
      liked: r.liked === true,
      likes: Number(r.likes ?? 0),
      myDines: Number(r.myDines ?? 0),
      extras: got.extras,
    };
    return got.state;
  };
  const enterVisit = async (f: BistroFriend) => {
    closeSheet();
    if (editing) setEditing(false);
    showLoading(`Walking over to ${f.name}'s bistro…`);
    let raw: unknown;
    try {
      raw = await o.api.visit(f.id);
    } catch (e) {
      loadingEl.hidden = true;
      o.toast(e instanceof Error ? e.message : "Couldn't visit right now.");
      return;
    }
    // Your own tables' coins are banked before you go.
    for (const p of [...piles]) collectPile(p, false);
    resetFloor();
    S = showFriend(raw, f.id);
    chef.char = asChar(visiting!.extras.chef);
    for (const d of ["down", "left", "right", "up"] as Facing[])
      sprite(chef.char, d);
    relayout();
    syncStaff();
    layer.classList.add("visiting");
    loadingEl.hidden = true;
    renderVisit();
    sound("knock");
    hudDirty = true;
  };
  const leaveVisit = () => {
    resetFloor();
    visiting = null;
    S = sync.S;
    chef.char = chefChar();
    relayout();
    syncStaff();
    layer.classList.remove("visiting");
    visitEl.hidden = true;
    hudDirty = true;
    void sync.load().catch(() => {});
  };
  const renderVisit = () => {
    const v = visiting;
    if (!v) return;
    visitEl.hidden = false;
    const empty = servingsLeft(S) === 0;
    const full = v.myDines >= DINE.perDay;
    visitEl.innerHTML = `<div class="who"><img src="${portrait(v.fighter)}" alt=""><span><small>Visiting</small><b>${esc(v.name)}'s Bistro</b></span></div>
      <button type="button" data-v="dine" ${v.dined || empty || full ? "disabled" : ""}>${v.dined ? "Ate here today" : full ? "Full for today" : empty ? "Nothing to eat" : "Eat here"}</button>
      <button type="button" data-v="like" ${v.liked ? "disabled" : ""}>${v.liked ? "♥ Liked" : "♥ Like"}</button>
      <button type="button" class="go" data-v="home">Back home</button>`;
  };
  visitEl.addEventListener("click", async (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b || b.disabled || !visiting) return;
    const v = visiting;
    if (b.dataset.v === "home") return leaveVisit();
    const kind = b.dataset.v as "dine" | "like";
    b.disabled = true;
    try {
      const r = (await o.api.visitAct(v.id, kind)) as Record<
        string,
        unknown
      > & { ok?: boolean; error?: string };
      if (visiting !== v) return;
      const fresh = showFriend(r.bistro, v.id);
      // Keep the floor as it is; take their counter and likes.
      S.counter = fresh.counter;
      if (!r.ok) {
        o.toast(r.error ?? "Not now.");
      } else if (kind === "dine") {
        const dish = DISH_BY_ID[r.dish as DishId];
        banner(
          `<b>Delicious!</b><span>${esc(dish?.name ?? "A meal")} at ${esc(v.name)}'s · +${DINE.dinerCoins} coins, +${DINE.dinerXp} XP for you</span>`,
        );
        sound("chime");
        const p = iso(DOOR.x + 2, DOOR.y);
        burst(p.x, p.y - 60, "heart", 8, "#ff6b8a", 0.8);
      } else {
        sound("chime");
        const p = iso(5, 5);
        burst(p.x, p.y - 80, "heart", 14, "#ff6b8a", 1);
      }
    } catch (err) {
      o.toast(err instanceof Error ? err.message : "Not now.");
    }
    renderVisit();
    hudDirty = true;
  });

  /* ───────────── the server's answers ───────────── */
  const loadingEl = $("#bs-loading");
  const showLoading = (text: string) => {
    loadingEl.textContent = text;
    loadingEl.hidden = false;
  };
  let chefSent = false;
  let leavesShown = -1;
  const SILENT = new Set(["serve", "leave", "sync", "chef"]);
  function adopted(info: {
    away: AwayReport | null;
    errors: { action: BistroAction; error: string }[];
    payday?: { xp: number; bistros: number } | null;
  }) {
    loadingEl.hidden = true;
    if (!visiting) {
      S = sync.S;
      relayout();
      syncStaff();
      syncLitter();
    }
    if (info.payday)
      o.toast(
        `Payday: +${info.payday.xp} XP for working at ${info.payday.bistros === 1 ? "a friend's bistro" : `${info.payday.bistros} friends' bistros`}`,
      );
    persist();
    // The head chef is your Lobby fighter (friends see them in your kitchen).
    if (!chefSent && sync.extras.chef !== chefChar()) {
      chefSent = true;
      sync.do({ a: "chef", id: chefChar() });
    }
    if (sync.extras.leaves !== leavesShown) {
      if (leavesShown >= 0) o.onLeaves?.(sync.extras.leaves);
      leavesShown = sync.extras.leaves;
    }
    const shown = new Set<string>();
    for (const e of info.errors)
      if (!SILENT.has(e.action.a) && !shown.has(e.error)) {
        shown.add(e.error);
        o.toast(e.error);
      }
    if (info.away) handleAway(info.away);
    hudDirty = true;
    if (sheetKind && !visiting) renderSheet();
  }

  /* ───────────── the time away ───────────── */
  const modal = $("#bs-modal");
  const fmtDur = (ms: number) => {
    const m = Math.round(ms / 60000);
    return m >= 60
      ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim()
      : `${Math.max(1, m)} min`;
  };
  /** The server worked the time away: say what happened (once). */
  const handleAway = (rep: AwayReport) => {
    if (rep.served === 0 && rep.batches === 0) {
      if (rep.away > 10 * 60_000)
        o.toast(
          staffOf(sync.S, "cook").length
            ? "Your cooks had no coins for ingredients while you were away."
            : "Hire a cook (Staff) and the bistro keeps cooking while you're away.",
        );
      return;
    }
    shownCoins = Math.max(0, sync.S.coins - Math.max(0, rep.coins - rep.spent));
    showAway(rep);
  };
  const showAway = (rep: AwayReport) => {
    modal.hidden = false;
    modal.innerHTML = `<div class="bs-away glass" role="dialog" aria-label="While you were away">
      <div class="bs-away-staff">${S.staff.map((st) => `<img src="${portrait(st.char)}" alt="">`).join("")}</div>
      <h2>While you were away</h2>
      <p>Your staff ran the bistro for <b>${fmtDur(rep.worked)}</b>${rep.capped ? ` (you were gone ${fmtDur(rep.away)}: their shift is ${SHIFT_HOURS[S.shiftLv]} h)` : ""}.</p>
      <div class="bs-away-stats">
        <div><b>${fmt(rep.served)}</b><small>guests served</small></div>
        <div><b>${fmt(rep.batches)}</b><small>batches cooked</small></div>
        <div class="gold"><b>${I("coin")} ${fmt(rep.coins - rep.spent)}</b><small>profit${rep.spent ? ` (${fmt(rep.coins)} paid − ${fmt(rep.spent)} ingredients)` : ""}</small></div>
      </div>
      ${rep.levels ? `<p class="lvl">Level up! The bistro is now level ${S.level}.</p>` : ""}
      ${rep.capped && SHIFT_PRICES[S.shiftLv] != null ? `<p class="tip">Longer shifts in Staff → Upgrades keep it open longer.</p>` : ""}
      ${S.staff.some((st) => energyNow(S, st, nowS()) < 50) ? `<p class="tip">Some of your staff are tired: feed them in Staff → Your team.</p>` : ""}
      ${S.trash ? `<p class="tip">Guests left ${S.trash} bits of litter: tap them to sweep, or hire a janitor.</p>` : ""}
      <button type="button" class="go" data-collect>Collect</button>
    </div>`;
    modal.querySelector("[data-collect]")!.addEventListener("click", () => {
      modal.hidden = true;
      const c = toWorld(W / 2, H / 2);
      flyCoins(c, Math.max(0, rep.coins - rep.spent));
      for (let i = 0; i < 3; i++)
        flyCoins({ x: c.x + (i - 1) * 40, y: c.y }, 0);
      sound("coin");
      if (rep.levels) levelUp(rep.levels);
    });
  };

  /* ───────────── kept in this browser ───────────── */
  /** The guests and the tables' coins, with times as "seconds ago". */
  const floorSnapshot = (): FloorSnap => ({
    customers: customers.map((c) => ({
      id: c.id,
      char: c.char,
      state: c.state,
      chair: c.seat.chair.id,
      vip: c.vip,
      dish: c.dish,
      slot: c.slot,
      satAgo: T - c.sat,
      patience: c.patience,
      served: c.served,
      eatLeft: c.eatEnd - T,
      combo: c.combo,
      hearts: c.hearts,
      gx: c.gx,
      gy: c.gy,
      path: c.path,
      alpha: c.alpha,
      angry: c.angry,
      orderedAgo: T - c.orderedAt,
      face: c.face,
      speed: c.speed,
    })),
    piles: piles.map((p) => ({
      ...p,
      t0: undefined,
      ago: T - p.t0,
      claimed: false,
    })),
    combo,
    lastServeAgo: T - lastServe,
    nextId,
  });
  const persist = () => {
    if (!o.owner || (!sync.ready && !cached)) return;
    keepBistro(o.owner, {
      state: sync.S,
      extras: sync.extras,
      sync: sync.snapshot(),
      // A friend's floor is not kept (yours was cleared when you left).
      floor: visiting ? undefined : floorSnapshot(),
      at: Date.now(),
    });
  };
  /** Put the guests and coins back as they were (a reload, a new session). */
  const restoreFloor = (f: FloorSnap | undefined, ageMs: number) => {
    if (!f || !Array.isArray(f.customers) || !Array.isArray(f.piles)) return;
    const fresh = ageMs < 5 * 60_000;
    nextId = Math.max(nextId, Number(f.nextId) || 1);
    for (const raw of f.piles) {
      const p = raw as unknown as Pile & { ago: number };
      if (!p.sale || !isDish(p.sale.dish) || !p.spot) continue;
      const pile: Pile = { ...p, t0: T - (Number(p.ago) || 0), claimed: false };
      piles.push(pile);
      // Long gone: the waiter banked them meanwhile.
      if (!fresh) collectPile(pile, false);
    }
    if (!fresh) return;
    combo = Math.max(0, Math.min(COMBO_MAX, Number(f.combo) || 0));
    lastServe = T - (Number(f.lastServeAgo) || 99);
    for (const raw of f.customers) {
      const c = raw as Record<string, unknown>;
      const seat = seatList.find((x) => x.chair.id === c.chair);
      if (!seat || !(ROSTER as string[]).includes(String(c.char))) {
        sync.release(Number(c.id));
        continue;
      }
      customers.push({
        ...mkWalker(
          asChar(String(c.char)),
          Number(c.gx),
          Number(c.gy),
          Number(c.speed) || 2,
        ),
        id: Number(c.id),
        state: c.state as CustState,
        seat,
        vip: c.vip === true,
        dish: isDish(c.dish) ? c.dish : null,
        slot: Number(c.slot),
        sat: T - (Number(c.satAgo) || 0),
        patience: Number(c.patience) || 30,
        claimed: false,
        served: c.served === true,
        eatEnd: T + (Number(c.eatLeft) || 0),
        combo: Number(c.combo) || 1,
        hearts: Number(c.hearts) || 3,
        alpha: Number(c.alpha) || 1,
        angry: c.angry === true,
        orderedAt: T - (Number(c.orderedAgo) || 0),
        path: Array.isArray(c.path) ? (c.path as Pt[]) : [],
        face: (c.face as Facing) ?? "down",
      });
    }
  };
  const persistTimer = setInterval(() => {
    if (!paused) persist();
  }, 5000);
  window.addEventListener("pagehide", persist);

  /* ───────────── the loop ───────────── */
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let running = true;
  const frame = (ts: number) => {
    if (!running || paused) return;
    raf = requestAnimationFrame(frame);
    // Up to half a second at a time (a slow device keeps the game's pace),
    // simulated in steps of at most 1/20 s.
    const dt = Math.min(0.5, (ts - last) / 1000);
    // Low graphics: 30 frames a second.
    acc += dt;
    last = ts;
    if (low && acc < 1 / 31) return;
    let tick = low ? acc : dt;
    acc = 0;
    while (tick > 1e-6) {
      const h = Math.min(0.05, tick);
      update(h);
      tick -= h;
    }
    draw();
  };
  ro.observe(layer);
  setRoomSize(sizeOf(S.sizeLv));
  resize();
  if (kept && cached) restoreFloor(kept.floor, Date.now() - kept.at);
  raf = requestAnimationFrame(frame);
  const onVis = () => {
    // Hidden: send what is queued (the time away starts now). Back: the
    // server works the time away and says what happened.
    if (document.hidden) void sync.flush();
    else if (!visiting) void sync.load().catch(() => {});
    last = performance.now();
  };
  document.addEventListener("visibilitychange", onVis);
  renderHud();
  if (!sync.ready) showLoading("Opening your bistro…");
  // The first load tries again every few seconds until the server answers.
  let retry: ReturnType<typeof setTimeout> | undefined;
  const firstLoad = () =>
    sync.load().catch(() => {
      showLoading("Can't reach the bistro. Retrying…");
      if (running) retry = setTimeout(firstLoad, 4000);
    });
  void firstLoad();

  // Visual tests and the demo's screenshots drive the scene through this.
  if (import.meta.env.DEV)
    (window as unknown as { __bistroRules?: unknown }).__bistroRules = {
      ...Rules,
      applyLocal,
      readServer,
    };
  if (import.meta.env.DEV)
    (window as unknown as { __bistro?: unknown }).__bistro = {
      state: () => S,
      customers: () => customers,
      litter: () => litter,
      setTod: (v: number | undefined) =>
        ((window as unknown as { __bistroTod?: number }).__bistroTod = v),
      spawn: () => spawn(),
      sync: () => sync,
      setCars: (list: Car[]) => (cars = list),
      load: () => sync.load(),
      flush: () => sync.flush(),
      plate: (i: number) => plateStove(i),
      tap: (sx: number, sy: number) => tap(sx, sy),
      screen: (gx: number, gy: number, lift = 0) => {
        applyView();
        const p = iso(gx, gy);
        return toScreen({ x: p.x, y: p.y - lift });
      },
      rush: () =>
        (rushShift = RUSH_PERIOD * 1000 - (nowS() % (RUSH_PERIOD * 1000))),
      edit: (on: boolean) => setEditing(on),
      sheet: (k: string, a?: string | number) => openSheet(k, a),
      advance: (s: number) => {
        for (let i = 0; i < s * 30; i++) update(1 / 30);
      },
    };

  return {
    /** Behind another hub tab: kept as it is (guests, plates, coins), paused. */
    hide() {
      if (paused) return;
      paused = true;
      cancelAnimationFrame(raf);
      tip.hidden = true;
      persist();
      void sync.flush();
      layer.style.display = "none";
    },
    /** Back: just as you left it, then the server's word (and any time away). */
    show() {
      if (!paused) return;
      paused = false;
      layer.style.display = "";
      resize();
      last = performance.now();
      raf = requestAnimationFrame(frame);
      if (!visiting) {
        // A new Lobby fighter takes over the kitchen.
        if (chef.char !== chefChar()) {
          chef.char = chefChar();
          for (const d of ["down", "left", "right", "up"] as Facing[])
            sprite(chef.char, d);
          chefSent = false;
        }
        void sync.load().catch(() => {});
      }
      layer.focus({ preventScroll: true });
    },
    close() {
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(pingTimer);
      clearTimeout(retry);
      clearInterval(warm);
      clearTimeout(bannerTimer);
      clearTimeout(tipTimer);
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      // Coins left on the tables are banked (their sales go to the server);
      // orders not yet served stay on the counter (the server never took them).
      if (!visiting) for (const p of [...piles]) collectPile(p, false);
      sync.close();
      clearInterval(persistTimer);
      window.removeEventListener("pagehide", persist);
      persist();
      layer.remove();
    },
  };
}
