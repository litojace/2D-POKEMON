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
  dishIconUrl,
  drawBackdrop,
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
  COLS,
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
  ROWS,
  STOVE_TILES,
  WAITER_HOME,
  WAITER_LEVEL,
  WAITER_PRICE,
  WALLS,
  addXp,
  approach,
  arrivalSeconds,
  blockedGrid,
  buyItem,
  buyStove,
  buyStyle,
  charm,
  cookProgress,
  findPath,
  heartsFor,
  hireWaiter,
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
} from "./bistro-model";
import "./bistro.css";

export interface BistroOptions {
  /** Whose bistro (the account id): keys the saved state. */
  owner?: string;
  playerName(): string;
  /** The Lobby fighter: the head chef. */
  character(): string;
  toast(message: string): void;
  sound?(cue: FarmCue, step?: number): void;
  reduced: boolean;
  low?: boolean;
}
export interface BistroHandle {
  close(): void;
}

const ROSTER = Object.keys(CHARACTERS) as CharacterId[];
const asChar = (c: string): CharacterId =>
  (ROSTER as string[]).includes(c) ? (c as CharacterId) : "voltkit";
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
type CustState = "enter" | "seated" | "eating" | "leave";
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
interface Waiter extends Walker {
  task: { kind: "serve"; c: Customer } | { kind: "clear"; p: Pile } | null;
  phase: "idle" | "toCounter" | "pick" | "toTable" | "drop" | "toPile" | "home";
  carry: DishId | null;
  timer: number;
}
interface Pile {
  id: number;
  chairId: number;
  tableId: number;
  spot: Pt;
  coins: number;
  base: number;
  t0: number;
  claimed: boolean;
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
  <div class="bs-chips" id="bs-chips"></div>
  <div class="bs-corner">
    <nav class="bs-rail glass" aria-label="Bistro menu">
      <button type="button" data-sheet="menu" title="Recipes">${I("book")}<span>Recipes</span></button>
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

  /* ───────────── state ───────────── */
  const KEY = `ea-bistro:${o.owner ?? "guest"}`;
  let S: BistroState;
  try {
    S = sanitize(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    S = sanitize(null);
  }
  let dirty = false;
  const save = () => {
    dirty = false;
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch {
      /* Private mode: the demo still plays. */
    }
  };
  const changed = () => {
    dirty = true;
    hudDirty = true;
  };
  const saveTimer = setInterval(() => dirty && save(), 4000);

  /* ───────────── people ───────────── */
  const chefChar = () => asChar(o.character());
  const WAITER_CHARS: CharacterId[] = ["sunbara", "astrabun"];
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
  let waiters: Waiter[] = [];
  const syncWaiters = () => {
    while (waiters.length < S.waiters) {
      const i = waiters.length;
      const ch = WAITER_CHARS[i] === chef.char ? "halcyra" : WAITER_CHARS[i];
      waiters.push({
        ...mkWalker(ch, WAITER_HOME.x + i, WAITER_HOME.y + i * 0, 2.8),
        task: null,
        phase: "idle",
        carry: null,
        timer: 0,
      });
    }
  };
  syncWaiters();
  // Warm the sprite cache: the staff first, then the whole roster bit by bit.
  for (const d of ["down", "left", "right", "up"] as Facing[]) {
    sprite(chef.char, d);
    for (const w of waiters) sprite(w.char, d);
  }
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
  let particles: Particle[] = [];
  let floaters: Floater[] = [];
  let flyers: Flyer[] = [];
  let flights: DishFlight[] = [];
  let nextId = 1;
  let T = 0; // scene seconds
  let spawnT = 3;
  let combo = 0;
  let lastServe = -99;
  let rushAt = 150;
  let rushEnd = -1;
  let doorOpen = 0;
  let shownCoins = S.coins;
  const special = () => todaySpecial(S.level);
  const rushing = () => T < rushEnd;
  let blocked = blockedGrid(S.items);
  let seatList = seats(S.items);
  let charmPts = charm(S.items);
  const relayout = () => {
    blocked = blockedGrid(S.items);
    seatList = seats(S.items);
    charmPts = charm(S.items);
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
  const inside = (p: Pt) => p.x >= 0 && p.y >= 0 && p.x < COLS && p.y < ROWS;

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
    const key = `${S.floor}:${S.wall}:${sc}`;
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
    x: clamp(Math.round(w.gx), 0, COLS - 1),
    y: clamp(Math.round(w.gy), 0, ROWS - 1),
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
    const el = layer.querySelector("#bs-coins");
    const r = el?.getBoundingClientRect();
    const b = layer.getBoundingClientRect();
    return r
      ? { x: r.left - b.left + 14, y: r.top - b.top + r.height / 2 }
      : { x: 60, y: 120 };
  };
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
    if (!levels) return;
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
  const spawn = () => {
    const free = seatList.filter((s) => !seatBusy(s.chair.id));
    if (!free.length) return false;
    // Only when there is food not yet promised to someone.
    if (servingsLeft(S) <= reservedOrders()) return false;
    const seat = free[Math.floor(Math.random() * free.length)];
    const vip = Math.random() < (rushing() ? 0.18 : 0.11);
    const char = ROSTER[Math.floor(Math.random() * ROSTER.length)];
    const c: Customer = {
      ...mkWalker(char, DOOR.x - 1.2, DOOR.y, 1.9 + Math.random() * 0.4),
      id: nextId++,
      state: "enter",
      seat,
      vip,
      dish: null,
      slot: -1,
      sat: 0,
      patience: patienceSeconds(charmPts, vip),
      claimed: false,
      served: false,
      eatEnd: 0,
      combo: 1,
      hearts: 3,
      alpha: 0,
      angry: false,
      orderedAt: 0,
    };
    const p = findPath(blocked, DOOR, seat.chair);
    if (!p) return false;
    c.path = [{ x: DOOR.x, y: DOOR.y }, ...p.slice(1)];
    customers.push(c);
    sound("knock");
    return true;
  };
  const leave = (c: Customer, angry: boolean) => {
    c.state = "leave";
    c.angry = angry;
    c.claimed = false;
    // Off the chair onto a free tile next to it, then out of the door.
    const p = approach(blocked, DOOR, [c.seat.chair]);
    const back = findPath(blocked, p ? p[p.length - 1] : DOOR, DOOR) ?? [];
    c.path = [
      ...(p ? [p[p.length - 1]] : []),
      ...back.slice(1),
      { x: DOOR.x - 1.4, y: DOOR.y },
    ];
    c.gx = c.seat.chair.x;
    c.gy = c.seat.chair.y;
    if (angry) {
      S.rating = rate(S.rating, 0.5);
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
      // Return the order to the counter (a waiter carrying it takes it back).
      const carrying = waiters.some(
        (w) => w.task?.kind === "serve" && w.task.c === c && w.carry,
      );
      if (c.dish && !c.served && !carrying) returnServing(c.dish);
      combo = 0;
      changed();
    }
  };
  const returnServing = (dish: DishId) => {
    let slot = S.counter.findIndex((s) => s?.dish === dish);
    if (slot < 0) slot = S.counter.findIndex((s) => !s);
    if (slot < 0) return;
    const s = S.counter[slot];
    S.counter[slot] = s
      ? { ...s, servings: s.servings + 1 }
      : { dish, servings: 1, perfect: false };
  };
  const tryOrder = (c: Customer) => {
    const dish = pickOrder(S, Math.random, special(), c.vip);
    if (!dish) return;
    c.slot = takeServing(S, dish);
    c.dish = dish;
    c.orderedAt = T;
    changed();
  };
  const updateCustomer = (c: Customer, dt: number) => {
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
    });
    S.rating = rate(S.rating, c.hearts === 3 ? 5 : c.hearts === 2 ? 4 : 2.5);
    S.served++;
    const levels = addXp(S, c.vip ? 3 : 1);
    levelUp(levels);
    const p = iso(c.gx, c.gy);
    floatText({ x: p.x, y: p.y - 96 }, "♥".repeat(c.hearts), "#ff7a9a");
    c.hop = 1;
    leave(c, false);
    changed();
  };

  /* ───────────── waiters ───────────── */
  const updateWaiter = (w: Waiter, dt: number) => {
    if (!w.task) {
      // Serve the longest-waiting order first, then clear old plates.
      const c = customers
        .filter((c) => c.state === "seated" && c.dish && !c.claimed)
        .sort((a, b) => a.orderedAt - b.orderedAt)[0];
      if (c) {
        c.claimed = true;
        w.task = { kind: "serve", c };
        w.phase = "toCounter";
        if (!pathTo(w, pickupTile(Math.max(0, c.slot)))) w.phase = "pick";
        return;
      }
      const p = piles.find((p) => !p.claimed && T - p.t0 > 9);
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
        const i = waiters.indexOf(w);
        pathTo(w, {
          x: WAITER_HOME.x + (i ? 1 : 0),
          y: WAITER_HOME.y + (i ? 1 : 0),
        });
      }
      if (step(w, dt)) w.face = "down";
      return;
    }
    const arrived = step(w, dt);
    if (w.task.kind === "serve") {
      const c = w.task.c;
      if (c.state === "leave" || !customers.includes(c)) {
        // They gave up: the dish goes back on the counter.
        if (w.carry) returnServing(w.carry);
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
    let coins = p.coins;
    if (byTap && T - p.t0 < 5) {
      const quick = Math.max(1, Math.round(p.base * 0.1));
      coins += quick;
      floatText(
        { x: p.spot.x, y: p.spot.y - 30 },
        `Quick tip +${quick}`,
        "#9cf07f",
      );
    }
    S.coins += coins;
    floatText({ x: p.spot.x, y: p.spot.y - 14 }, `+${coins}`, "#ffe27a", true);
    flyCoins(p.spot, coins);
    burst(p.spot.x, p.spot.y - 6, "spark", 8, "#ffe27a", 0.6);
    if (byTap) sound("coin");
    // Free the waiter who was on the way.
    for (const w of waiters)
      if (w.task?.kind === "clear" && w.task.p === p) w.task = null;
    changed();
  };

  /* ───────────── chef ───────────── */
  const updateChef = (dt: number) => {
    const now = Date.now();
    // Go to a pot in its golden moment, else one that is done, else the one
    // that will finish first.
    let target = -1;
    let best = Infinity;
    S.stoves.forEach((st, i) => {
      if (!st.dish) return;
      const p = cookProgress(st, now);
      const score = inPerfectWindow(st, now) ? -2 : p >= 1 ? -1 : 1 - p;
      if (score < best) {
        best = score;
        target = i;
      }
    });
    const tx = target >= 0 ? STOVE_TILES[target].x : 2.5;
    if (Math.abs(chef.gx - tx) > 0.02 && !chef.path.length)
      chef.path = [{ x: tx, y: 1 }];
    if (step(chef, dt)) chef.face = target >= 0 ? "up" : "down";
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
    | { kind: "staff"; who: "chef" | "waiter" };
  const hit = (sx: number, sy: number): Hit | null => {
    const w = toWorld(sx, sy);
    const near = (p: Pt, r: number) =>
      Math.hypot(p.x - w.x, (p.y - w.y) * 1.3) < r;
    if (!editing) {
      for (const p of piles)
        if (near({ x: p.spot.x + 6, y: p.spot.y - 6 }, 22))
          return { kind: "pile", p };
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
    const now = Date.now();
    if (h.kind === "pile") return collectPile(h.p, true);
    if (h.kind === "stove") {
      const st = S.stoves[h.i];
      if (!st.dish) return openSheet("cook", h.i);
      if (stir(S, h.i, now)) {
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
      const left = (d.seconds * 1000 - (now - st.start)) / 1000;
      const golden = !st.perfect && cookProgress(st, now) < PERFECT_FROM;
      return showTip(
        sx,
        sy,
        `<b>${esc(d.name)}</b><span>${fmtTime(left)} left${st.perfect ? " · perfect ★" : ""}</span>${golden ? `<small>Tap the pot when it glows gold for +${PERFECT_BONUS} servings</small>` : ""}`,
      );
    }
    if (h.kind === "stove-buy") return openSheet("shop", "kitchen");
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
    const r = plate(S, i, Date.now());
    if (!r.ok) {
      o.toast(r.error);
      return;
    }
    const from = iso(STOVE_TILES[i].x, STOVE_TILES[i].y);
    const to = iso(1 + r.slot!, COUNTER_ROW);
    flights.push({
      dish,
      from: { x: from.x, y: from.y - 70 },
      to: { x: to.x, y: to.y - 52 },
      t: 0,
      dur: 0.55,
    });
    sound("pop", 4);
    chef.hop = 1;
    floatText({ x: from.x, y: from.y - 96 }, `+${r.servings} servings`, "#fff");
    levelUp(r.levels ?? 0);
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
  const renderEdit = () => {
    editEl.hidden = !editing;
    if (!editing) return;
    const stored = Object.entries(S.stored).filter(([, n]) => (n ?? 0) > 0) as [
      ItemKind,
      number,
    ][];
    editEl.innerHTML = `
      <div class="bs-edit-head"><b>${held ? `Placing: ${esc(ITEM_BY_KIND[held.kind].name)}` : "Decorate"}</b><span>${held ? "Tap a floor tile to put it down" : "Tap something to move it · buy more in the Shop"}</span></div>
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
        putAway(S, held.moving.id);
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
    const r = tryPlace(S, held.kind, fx, fy, rot, held.moving);
    if (!r.ok) {
      o.toast(r.error);
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
  let sheetArg: number | string | undefined;
  const closeSheet = () => {
    sheet.hidden = true;
    sheetKind = null;
    layer
      .querySelectorAll(".bs-rail [data-sheet]")
      .forEach((b) => b.setAttribute("aria-expanded", "false"));
  };
  const openSheet = (kind: string, arg?: number | string) => {
    sheetKind = kind;
    sheetArg = arg;
    sheet.hidden = false;
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
    } else if (sheetKind === "shop") {
      const tab = (sheetArg as string) || "furniture";
      const tabs = [
        ["furniture", "Furniture"],
        ["decor", "Decor"],
        ["kitchen", "Kitchen & staff"],
        ["style", "Floors & walls"],
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
      } else if (tab === "kitchen") {
        const sp = nextStovePrice(S);
        body = `<div class="bs-items">
          <button type="button" class="bs-item" data-buy-stove ${sp === null ? "disabled" : ""}><div class="ic">${I("spark")}</div><b>Another stove</b><small>${S.stoves.length} of ${MAX_STOVES} in the kitchen</small>${sp === null ? `<span class="lk">All built</span>` : `<span class="pr ${S.coins < sp ? "poor" : ""}">${coinTag(sp)}</span>`}</button>
          <button type="button" class="bs-item" data-hire ${S.waiters >= 2 || S.level < WAITER_LEVEL ? "disabled" : ""}><div class="ic">${I("friends")}</div><b>Second waiter</b><small>Serves and clears tables twice as fast</small>${S.waiters >= 2 ? `<span class="lk">Hired</span>` : S.level < WAITER_LEVEL ? `<span class="lk">${I("lock")} Level ${WAITER_LEVEL}</span>` : `<span class="pr ${S.coins < WAITER_PRICE ? "poor" : ""}">${coinTag(WAITER_PRICE)}</span>`}</button>
        </div>`;
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
    if (b.dataset.tab) {
      sheetArg = b.dataset.tab;
      sound("tick");
      return renderSheet();
    }
    if (b.dataset.dish && sheetKind === "cook") {
      const i = Number(sheetArg);
      const r = startCooking(S, i, b.dataset.dish as DishId, Date.now());
      if (!r.ok) return o.toast(r.error);
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
      const r = buyItem(S, kind);
      if (!r.ok) return o.toast(r.error);
      sound("coin");
      changed();
      closeSheet();
      if (!editing) setEditing(true);
      held = { kind, rot: 0 };
      renderEdit();
      return;
    }
    if (b.hasAttribute("data-buy-stove")) {
      const r = buyStove(S);
      if (!r.ok) return o.toast(r.error);
      sound("fanfare");
      const c = iso(STOVE_TILES[S.stoves.length - 1].x, 0);
      burst(c.x, c.y - 50, "confetti", 30, "#ffd65b", 1);
      changed();
      return renderSheet();
    }
    if (b.hasAttribute("data-hire")) {
      const r = hireWaiter(S);
      if (!r.ok) return o.toast(r.error);
      syncWaiters();
      sound("fanfare");
      changed();
      return renderSheet();
    }
    if (b.dataset.style) {
      const [kind, id] = b.dataset.style.split(":") as [
        "floor" | "wall",
        string,
      ];
      const r = buyStyle(S, kind, id);
      if (!r.ok) return o.toast(r.error);
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
  const bar = $("#bs-bar");
  const renderHud = () => {
    hudDirty = false;
    const need = xpToNext(S.level);
    const name = o.playerName();
    badge.innerHTML = `<div class="bs-ring" style="--p:${Math.round((S.xp / need) * 100)}"><b>${S.level}</b></div>
      <strong>${esc(name.endsWith("s") ? `${name}'` : `${name}'s`)} Bistro</strong>
      <small id="bs-coins">${I("coin")}<span>${fmt(shownCoins)}</span></small>
      <div class="xpbar" title="${S.xp} / ${need} XP"><i style="width:${(S.xp / need) * 100}%"></i></div>`;
    const stars = S.rating;
    const sp = DISH_BY_ID[special()];
    chips.innerHTML = `<div class="bs-chip glass" title="Rating ${stars.toFixed(1)} of 5"><span class="stars" style="--r:${(stars / 5) * 100}%">★★★★★</span><b>${stars.toFixed(1)}</b></div>
      <div class="bs-chip glass special"><img src="${dishIconUrl(sp.id, 48)}" alt=""><span><small>Today's special</small><b>${esc(sp.name)}</b></span></div>
      ${rushing() ? `<div class="bs-chip glass rush"><b>Rush hour!</b><small>Tips ×2 · ${Math.ceil(rushEnd - T)}s</small></div>` : `<div class="bs-chip glass soft"><small>Charm</small><b>${charmPts}</b></div>`}`;
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
    const now = Date.now();
    // Rush hours, every few minutes while there is food to sell.
    if (T >= rushAt && servingsLeft(S) > 0 && !editing) {
      rushEnd = T + 35;
      rushAt = T + 210;
      banner(`<b>Rush hour!</b><span>Guests pour in · tips ×2 for 35 s</span>`);
      sound("whoosh");
      hudDirty = true;
    }
    // Arrivals.
    spawnT -= dt;
    if (spawnT <= 0 && !editing) {
      spawn();
      spawnT =
        arrivalSeconds(S.rating, charmPts, rushing()) *
        (0.7 + Math.random() * 0.6);
    }
    for (const c of customers) updateCustomer(c, dt);
    customers = customers.filter((c) => !(c.state === "leave" && c.alpha <= 0));
    for (const w of waiters) updateWaiter(w, dt);
    updateChef(dt);
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
        const el = layer.querySelector("#bs-coins");
        el?.classList.remove("bump");
        void (el as HTMLElement | null)?.offsetWidth;
        el?.classList.add("bump");
      }
    }
    flyers = flyers.filter((f) => f.t < f.dur);
    if (!flyers.length && shownCoins !== S.coins) {
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
      hat?: "chef" | "waiter" | "vip";
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

  const draw = () => {
    applyView();
    const L = light();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackdrop(ctx, W, H, L, low);
    ctx.setTransform(
      view.s * DPR,
      0,
      0,
      view.s * DPR,
      view.x * DPR,
      view.y * DPR,
    );
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
    // Sunbeams through the right wall's windows by day.
    if (!low && L.night < 0.8) drawBeams(L);
    // Rugs lie on the floor under everything.
    for (const it of S.items)
      if (ITEM_BY_KIND[it.kind].floor && it !== held?.moving)
        drawItem(ctx, it.kind, it.x, it.y, T, it.rot);
    // Edit mode: the grid and where the held item would go.
    if (editing) drawEditGrid();

    const now = Date.now();
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
      if (ITEM_BY_KIND[it.kind].floor || it === held?.moving) continue;
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
    // People on their feet.
    for (const c of customers)
      if (c.state === "enter" || c.state === "leave")
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
        f: () => drawWalker(w, { hat: "waiter", carry: w.carry }),
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
    for (const [g0, g1] of [
      [6.3, 7.9],
      [8.7, 10.3],
    ]) {
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
      ctx.globalCompositeOperation = "multiply";
      const k = 0.42 * n;
      ctx.fillStyle = `rgb(${Math.round(255 - 150 * k)},${Math.round(255 - 140 * k)},${Math.round(255 - 70 * k)})`;
      ctx.fillRect(
        BOUNDS.x0 - 400,
        BOUNDS.y0 - 400,
        BOUNDS.x1 - BOUNDS.x0 + 800,
        BOUNDS.y1 - BOUNDS.y0 + 800,
      );
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
    }
    if (L.gold > 0.02) {
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(255,140,50,${0.55 * L.gold})`;
      ctx.fillRect(
        BOUNDS.x0 - 400,
        BOUNDS.y0 - 400,
        BOUNDS.x1 - BOUNDS.x0 + 800,
        BOUNDS.y1 - BOUNDS.y0 + 800,
      );
    }
    ctx.restore();
  };
  const drawEditGrid = () => {
    ctx.save();
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++) {
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
      const left = DISH_BY_ID[st.dish].seconds * (1 - p);
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

  /* ───────────── the loop ───────────── */
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let running = true;
  const frame = (ts: number) => {
    if (!running) return;
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
  resize();
  raf = requestAnimationFrame(frame);
  const onVis = () => {
    if (document.hidden) save();
    last = performance.now();
  };
  document.addEventListener("visibilitychange", onVis);
  renderHud();

  // Visual tests and the demo's screenshots drive the scene through this.
  if (import.meta.env.DEV)
    (window as unknown as { __bistro?: unknown }).__bistro = {
      state: () => S,
      customers: () => customers,
      setTod: (v: number | undefined) =>
        ((window as unknown as { __bistroTod?: number }).__bistroTod = v),
      spawn: () => spawn(),
      cook: (i: number, dish: DishId, ago = 0) => {
        S.coins += DISH_BY_ID[dish].cost;
        startCooking(S, i, dish, Date.now() - ago * 1000);
        changed();
      },
      plate: (i: number) => plateStove(i),
      tap: (sx: number, sy: number) => tap(sx, sy),
      screen: (gx: number, gy: number, lift = 0) => {
        applyView();
        const p = iso(gx, gy);
        return toScreen({ x: p.x, y: p.y - lift });
      },
      rush: () => (rushAt = T),
      edit: (on: boolean) => setEditing(on),
      sheet: (k: string, a?: string | number) => openSheet(k, a),
      advance: (s: number) => {
        for (let i = 0; i < s * 30; i++) update(1 / 30);
      },
    };

  return {
    close() {
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(saveTimer);
      clearInterval(warm);
      clearTimeout(bannerTimer);
      clearTimeout(tipTimer);
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      // Orders not yet served go back on the counter; coins left on the
      // tables are banked, so leaving the tab loses nothing.
      for (const c of customers) if (c.dish && !c.served) returnServing(c.dish);
      for (const p of piles) S.coins += p.coins;
      save();
      layer.remove();
    },
  };
}
