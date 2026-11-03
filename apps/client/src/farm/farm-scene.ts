// @ts-nocheck
/*
 * The Elemental Farm scene (hub redesign phase 4). The drawing, the camera,
 * the touch model, the HUD and the sheets are ported from the approved
 * prototype (docs/hub-redesign/prototype/app/farm.js). What changed: the
 * farm's state comes from the server (/api/farm) and every action goes to
 * /api/farm/act; the client only animates, counting on the server's clock.
 * Weather, pests, crows, dogs, orders, friends and decorations arrive with
 * the farm systems (phase 5). Ported drawing code is not type-checked line
 * by line; the typed entry point is farm-screen.ts.
 */
import {
  CROPS,
  CROP_BY_ID,
  FARM_COLS,
  FARM_PLOTS,
  FARM_UNLOCKS,
  LAND_LEVEL,
  LAND_PRICE,
  FERTILIZERS,
  LEAF_TRADE,
  barnUpgradePrice,
  FARM_TOOLS,
  FARM_DOGS,
  FARM_PERKS,
  FARM_DECOR,
  charmBonus,
  CROW_SECONDS,
  MILK,
  PASTURE,
  milkPrice,
  SPRINKLER_LEVELS,
  SPRINKLER_PRICES,
  farmXpToNext,
  farmLevelLeaves,
  isStartPlot,
  touchesOwned,
  GIANT,
  canGrowGiant,
  giantPlots,
  giantXp,
  giantYield,
} from "../../../../packages/shared/src/farm";
import {
  FARM_WEATHER_BY_ID,
  FARM_WEATHER_SECONDS,
} from "../../../../packages/shared/src/farm";
import { GIANT_ART, cropFieldSvg, cropGiantSvg, cropItemSvg } from "./crop-art";
import { GFX } from "./farm-gfx";
import {
  FrameRateProbe,
  graphicsSetting,
  rememberAutoLow,
} from "../graphics-quality";
import {
  DOG_SPOTS,
  blocked as pathBlocked,
  clearLine as pathClear,
  dogRoute,
} from "./farm-path";
import {
  farmIcon as I,
  LEAF_ICON as L,
  farmIconImage as ICON_IMG,
  textWithIcon,
} from "./farm-icons";
import "./farm.css";

const svgUrl = (s) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmtSecs = (s) => {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  return m >= 60
    ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`
    : m >= 1
      ? `${m}m`
      : `${s}s`;
};
/** Longer durations, for dogs hired by the day: "2d 5h". */
const fmtDur = (s) =>
  s >= 86400
    ? `${Math.floor(s / 86400)}d${Math.floor((s % 86400) / 3600) ? ` ${Math.floor((s % 86400) / 3600)}h` : ""}`
    : fmtSecs(s);
const DOG = Object.fromEntries(FARM_DOGS.map((d) => [d.id, d]));
const DECO = Object.fromEntries(FARM_DECOR.map((d) => [d.id, d]));
/** The 8 decoration spots around the farm (the prototype's). */
const DECO_SLOTS = [
  [80, 830],
  [230, 870],
  [530, 870],
  [1240, 870],
  [70, 540],
  [1700, 880],
  [1390, 890],
  [390, 890],
];
const GIFT_KEY = "arena-farm-gift-seen";
/** Giant crops this device has already announced (migration 050). */
const GIANT_KEY = "arena-farm-giants-seen";
const RAR_NAME = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};
const RC = {
  common: "#2a3a66",
  uncommon: "#1f5a3a",
  rare: "#1f4a7a",
  legendary: "#6a4a1a",
};
// The prototype's crop objects: short names used by the ported drawing code.
const PCROPS = CROPS.map((c) => ({
  ...c,
  n: c.name,
  el: c.element,
  c: c.color,
  c2: c.accent,
  t: c.growSeconds,
  cost: c.seedCost,
  lv: c.level,
  rar: c.rarity,
}));
const CROP = Object.fromEntries(PCROPS.map((c) => [c.id, c]));
// Storm Milk (migration 049) sits in the barn like a crop, so the barn and
// market rows can look it up; it is not in PCROPS (no seeds, book or prices list).
CROP.milk = {
  id: MILK.id,
  n: MILK.name,
  el: "Earth",
  c: "#ffffff",
  c2: "#9fd0ff",
  t: PASTURE.milkSeconds,
  cost: 0,
  sell: MILK.sell,
  xp: PASTURE.milkXp,
  lv: PASTURE.level,
  rar: "rare",
};
const MILK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width="240" height="280"><defs><linearGradient id="mk" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe6ff"/></linearGradient></defs><path d="M44 40 h32 v14 l10 16 v52 a8 8 0 0 1 -8 8 h-36 a8 8 0 0 1 -8 -8 v-52 l10 -16z" fill="url(#mk)" stroke="#5f8cc0" stroke-width="3"/><rect x="40" y="28" width="40" height="14" rx="4" fill="#4fb3ff" stroke="#2a6fd0" stroke-width="2"/><rect x="38" y="84" width="44" height="26" rx="4" fill="#ffd65b"/><path d="M60 88 l-6 10 h5 l-3 9 l9 -12 h-5 l3 -7z" fill="#2a1f4c"/><ellipse cx="50" cy="70" rx="3" ry="10" fill="#fff" opacity=".8"/></svg>`;

const FARM_HTML = `<div class="fm" id="fm">
  <canvas id="fm-cv" aria-label="Your farm"></canvas>
  <div class="fm-hud">
    <div class="fm-badge glass" id="fm-badge"></div>
    <div class="fm-chips" id="fm-chips"></div>
    <div class="fm-corner" id="fm-corner">
      <nav class="fm-dock glass" id="fm-dock" aria-label="Farm menu" hidden>
        <button type="button" data-sheet="shop">${I("shop")}<span>Shop</span></button>
        <button type="button" data-sheet="orders">${I("orders")}<span>Orders</span><b class="dot" id="fm-ord-dot" hidden></b></button>
        <button type="button" data-sheet="market">${I("market")}<span>Market</span></button>
        <button type="button" data-sheet="barn">${I("barn")}<span>Barn</span></button>
        <button type="button" data-sheet="book">${I("book")}<span>Almanac</span></button>
        <button type="button" data-sheet="decor">${I("decor")}<span>Decor</span></button>
        <button type="button" data-sheet="friends">${I("friends")}<span>Friends</span><b class="dot" id="fm-fr-dot" hidden></b></button>
        <button type="button" data-wish>${I("spark")}<span>Wish</span><b class="dot" id="fm-wish-dot" hidden></b></button>
      </nav>
      <div class="fm-menu glass"><button type="button" class="fm-tool fm-menu-btn" id="fm-menu-btn" aria-expanded="false" aria-pressed="false" aria-controls="fm-dock" title="Menu (M)"><kbd>M</kbd>${I("menu")}<span>Menu</span></button></div>
      <div class="fm-zoom glass" id="fm-zoom" role="group" aria-label="Zoom"><button type="button" data-z="in" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" data-z="out" aria-label="Zoom out" title="Zoom out (−)">−</button><button type="button" data-z="fit" aria-label="Show the whole farm" title="Show the whole farm">⤢</button></div>
    </div>
    <div class="fm-visit glass" id="fm-visit" hidden></div>
    <div class="fm-tools glass" id="fm-tools"></div>
    <div class="fm-log" id="fm-log" aria-live="polite"></div>
    <div class="fm-tip glass" id="fm-tip" hidden></div>
    <div class="fm-pop glass" id="fm-pop" hidden></div>
    <div class="fm-orbpop glass" id="fm-orbpop" hidden></div>
    <section class="fm-sheet glass" id="fm-sheet" hidden></section>
    <div class="fm-hint" id="fm-hint">Drag the grass to move · scroll or press +/− to zoom</div>
    <div class="fm-modal" id="fm-modal" hidden></div>
  </div>
</div>`;

export function openFarm(options) {
  const layer = document.createElement("div");
  layer.className = "farm-layer";
  layer.tabIndex = -1;
  layer.innerHTML = FARM_HTML;
  document.body.append(layer);
  const screen = layer;
  const $ = (id) => layer.querySelector(`#${id}`);
  // A toast replaces the one-time hint above the tool bar (they share the spot).
  const toast = (m) => {
    layer.querySelector("#fm-hint")?.classList.add("done");
    options.toast(m);
  };
  // HUD popovers are placed inside the HUD, which keeps clear of notches.
  const hudEl = layer.querySelector(".fm-hud");
  const hudOff = () => {
    const a = hudEl.getBoundingClientRect(),
      b = layer.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  };
  const syncPhone = () => {
    // The same switch as the hub's max-height: 500px rules (the player card).
    layer.classList.toggle("phone", matchMedia("(max-height: 500px)").matches);
    layer.classList.toggle("coarse", matchMedia("(pointer: coarse)").matches);
  };
  syncPhone();

  let VW = 1280;
  const VH = 800;
  const COLS = 10,
    ROWS = 5,
    PW = 96,
    PH = 62,
    GAP = 10,
    OX = 360,
    OY = 380,
    WW = 1760,
    WH = 1080;
  const FW = COLS * PW + (COLS - 1) * GAP,
    FH = ROWS * PH + (ROWS - 1) * GAP,
    FCX = OX + FW / 2;
  // The back row (home, mill, orders board, market, barn) stands 50 px
  // behind the field's fence, so a lane runs in front of it: the barn's door
  // and the market's counter no longer open onto the fence, and the lane
  // from home to the barn shows instead of running under it.
  const PAST = { x0: 1480, x1: 1720, y0: 420, y1: 664 },
    HOUSE = { x: 190, y: 292 },
    MILL = { x: 470, y: 278 },
    BOARDP = { x: 700, y: 282 },
    STALL = { x: 930, y: 278 },
    BARN = { x: 1250, y: 296 },
    WELL = { x: 150, y: 700 },
    DOGH = { x: 1600, y: 810 },
    POND = { x: 250, y: 990, rx: 150, ry: 56 };
  const WX0 = -360,
    WY0 = -180,
    WX1 = WW + 360,
    WY1 = WH + 200,
    BW = WX1 - WX0,
    BH = WY1 - WY0;
  let Z = 0.86,
    cam = { x: OX + FW / 2, y: 520 },
    panning = null;
  let ZMIN = Math.max(VW / BW, VH / BH);
  let ZMAX = 1.35,
    wasPhone = false;
  const keysF = new Set();
  const cv = $("fm-cv"),
    ctx = cv.getContext("2d");
  let NW = 1280,
    NH = 800,
    PS = 1,
    K = 1,
    OFX = 0,
    OFY = 0;
  let running = false,
    raf = 0,
    last = 0,
    T = 0,
    inited = false;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function tintCanvas(src, crop, color, a) {
    const [sx, sy, sw, sh] = crop || [0, 0, src.width, src.height],
      o = document.createElement("canvas");
    o.width = sw;
    o.height = sh;
    const g = o.getContext("2d");
    g.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = a;
    g.fillStyle = color;
    g.fillRect(0, 0, sw, sh);
    return o;
  }

  /* ---------- crop art (crops.js) ---------- */
  const CIMG = {},
    ITEM = {};
  for (const c of CROPS) {
    CIMG[c.id] = [0, 1, 2, 3, 4].map((st) => {
      const im = new Image();
      im.src = svgUrl(cropFieldSvg(c, st));
      return im;
    });
    const im = new Image();
    im.src = svgUrl(cropItemSvg(c));
    ITEM[c.id] = im;
  }
  ITEM.milk = new Image();
  ITEM.milk.src = svgUrl(MILK_SVG);
  // Giant crops (migration 050): one picture across a 3×3 square.
  const GIMG = {};
  for (const id of GIANT.crops) {
    const im = new Image();
    im.src = svgUrl(cropGiantSvg(CROP_BY_ID[id]));
    GIMG[id] = im;
  }
  const icon = (id) => (ITEM[id] || CIMG[id]?.[4])?.src ?? "";
  const MUTS = {
    gold: { n: "Gold", x: 5, cls: "gold", tint: "#ffcf3a", a: 0.5 },
    rainbow: { n: "Rainbow", x: 15, cls: "rainbow" },
    shock: { n: "Shocked", x: 3, cls: "shock", tint: "#9fd0ff", a: 0.38 },
    moon: { n: "Moonlit", x: 2.5, cls: "moon", tint: "#b48cff", a: 0.38 },
    frost: { n: "Frozen", x: 2, cls: "frost", tint: "#e8fbff", a: 0.48 },
    wet: { n: "Wet", x: 1.5, cls: "wet", tint: "#4fb3ff", a: 0.2 },
  };
  const mcache = new Map();
  function cropImage(id, st, mut, time) {
    const base = CIMG[id][st];
    if (!mut || !base.complete) return base;
    let key = `${id}|${st}|${mut}`;
    if (mut === "rainbow") {
      const h = Math.floor((time * 3) % 6);
      key += h;
      if (!mcache.has(key))
        mcache.set(key, tintCanvas(base, null, `hsl(${h * 60} 95% 60%)`, 0.42));
      return mcache.get(key);
    }
    if (!MUTS[mut]) return base;
    if (!mcache.has(key))
      mcache.set(key, tintCanvas(base, null, MUTS[mut].tint, MUTS[mut].a));
    return mcache.get(key);
  }

  /* ---------- state: what the server last said, plus pending local actions ---------- */
  const mkPlot = (o = {}) => ({
    crop: null,
    prog: 0,
    prog0: 0,
    at0: 0,
    ripeAt: null,
    wet: false,
    fert: null,
    pests: 0,
    mut: [],
    crowAt: null,
    locked: false,
    ...o,
  });
  const F = {
    lv: 1,
    xp: 0,
    plots: Array.from({ length: FARM_PLOTS }, (_, i) =>
      mkPlot({ locked: !isStartPlot(i) }),
    ),
    seeds: {},
    barn: {},
    orders: [],
    barnCap: 80,
    barnUp: 0,
    ferts: { norm: 0, super: 0, gold: 0 },
    land: 0,
    harv: {},
    shop: { restockAt: 0, stock: {} },
    market: { day: "", mult: {}, hot: null },
    leaves: 0,
    tool: "hand",
    seed: "wheat",
    fert: "norm",
    can: 1,
    net: 1,
    sickle: false,
    scarecrow: false,
    sprinklers: 0,
    dog: null,
    gifts: [],
    farmer: null,
    perksUsed: [],
    decor: Array(8).fill(null),
    charm: 0,
    decorCredits: {},
    warmUntil: 0,
    log: [],
    decorPick: null,
    shovelArm: null,
    weather: { cur: null },
    visiting: null,
    loaded: false,
    // Giant crops (migration 050): the giants, plot → its giant, giants grown
    // per crop, squares the server has already answered for, and squares of
    // ripe giant crops waiting for that answer (see updatePending).
    giants: [],
    giantAt: {},
    giantsGrown: {},
    sqChecked: new Set(),
    pending: new Set(),
  };
  let offset = 0; // server clock minus this device's clock, in ms
  const serverNow = () => Date.now() + offset;
  const barnUsed = () => Object.values(F.barn).reduce((a, b) => a + b, 0);
  const dogOn = () => !!F.dog && F.dog.until > serverNow();
  /** Crops a harvest gives: 3 while Terradon farms (Rich Soil). */
  const yieldN = () => (F.farmer === "terradon" ? 3 : 2);
  const perk = () => (F.farmer ? FARM_PERKS[F.farmer] : null);
  const warmLeft = () => Math.max(0, (F.warmUntil - serverNow()) / 1000);
  let farmerSent = false;
  const owned = (id) =>
    Object.entries(F.barn)
      .filter(([k]) => k.startsWith(id + "|"))
      .reduce((a, [, n]) => a + n, 0);
  const need = (lv) => farmXpToNext(lv);
  const landLv = (k) => LAND_LEVEL[Math.min(k, 34)],
    landPrice = (k) => LAND_PRICE[Math.min(k, 34)];
  const touching = (plots, i) =>
    touchesOwned(
      plots.map((p) => !p.locked),
      i,
    );
  const buyable = (i) => F.plots[i].locked && touching(F.plots, i);
  function growth(p, now) {
    if (!p.crop) return 0;
    if (p.prog0 >= 1 || !p.ripeAt || p.ripeAt <= p.at0)
      return Math.min(
        1,
        p.prog0 >= 1 || (p.ripeAt && now >= p.ripeAt) ? 1 : p.prog0,
      );
    return Math.min(
      1,
      p.prog0 + (1 - p.prog0) * Math.max(0, (now - p.at0) / (p.ripeAt - p.at0)),
    );
  }
  /* ---------- giant crops (migration 050) ---------- */
  /** Index a farm's giants: plot → giant, and the mutations its crops carry. */
  function indexGiants(o) {
    o.giantAt = {};
    for (const gi of o.giants) {
      const muts = gi.plots.map((j) => o.plots[j].mut);
      gi.muts = [...new Set(muts.flat())];
      // Tinted only when all nine share a mutation (the most valuable first).
      gi.tint =
        ["rainbow", "gold", "shock", "moon", "frost", "wet"].find((m) =>
          muts.every((x) => x.includes(m)),
        ) ?? null;
      for (const j of gi.plots) o.giantAt[j] = gi;
    }
  }
  const readGiants = (list) =>
    (list ?? [])
      .filter((g) => GIMG[g.crop] && g.plots?.length === 9)
      .map((g) => ({
        i: g.i,
        crop: g.crop,
        plots: g.plots,
        key: `${g.i}|${g.formedAt}`,
      }));
  /** Squares of one giant crop whose 9 plots all pass `ripe`. */
  function squares(plots, ripe) {
    const out = [];
    for (let k = 0; k < FARM_PLOTS; k++) {
      const ps = giantPlots(k);
      if (!ps) continue;
      const crop = plots[ps[0]].crop;
      if (
        !canGrowGiant(crop) ||
        !ps.every((j) => {
          const q = plots[j];
          return !q.locked && q.crop === crop && ripe(q);
        })
      )
        continue;
      out.push({
        k,
        crop,
        plots: ps,
        key: `${k}|${crop}|${Math.max(...ps.map((j) => plots[j].ripeAt || 0))}`,
      });
    }
    return out;
  }
  /**
   * A giant is only known once the server is asked after its square ripens,
   * and a plain harvest of one of its plots would break it. So a square of
   * ripe giant crops the server hasn't answered for yet holds its harvest
   * until it has (the step loop asks).
   */
  function updatePending() {
    F.pending.clear();
    if (!F.loaded) return;
    for (const q of squares(F.plots, (p) => p.prog >= 1))
      if (!F.sqChecked.has(q.key) && !q.plots.some((j) => F.giantAt[j]))
        for (const j of q.plots) F.pending.add(j);
  }
  /** Giants this device hasn't shown yet: a toast, a log line and a pop. */
  const giantBorn = new Map();
  function announceGiants() {
    let seen = [];
    try {
      seen = JSON.parse(localStorage.getItem(GIANT_KEY) || "[]");
    } catch {}
    if (!Array.isArray(seen)) seen = [];
    const fresh = F.giants.filter((g) => !seen.includes(g.key));
    for (const g of fresh) {
      giantBorn.set(g.key, T);
      log(
        `A giant <b>${CROP[g.crop]?.n ?? g.crop}</b> grew on your farm!`,
        "good",
      );
    }
    if (fresh.length)
      toast(
        `A giant ${CROP[fresh[0].crop]?.n ?? fresh[0].crop} grew! Tap it to harvest`,
      );
    if (fresh.length)
      try {
        localStorage.setItem(
          GIANT_KEY,
          JSON.stringify([...seen, ...fresh.map((g) => g.key)].slice(-30)),
        );
      } catch {}
  }
  function applyState(st) {
    const now = Date.parse(st.now);
    offset = now - Date.now();
    F.lv = st.level;
    F.xp = st.xp;
    F.land = st.landBought;
    F.barnCap = st.barnCap;
    F.barnUp = st.barnUpgrades;
    F.ferts = { ...st.fertilizer };
    // Tools (migration 044; a wooden can and a hand net before it).
    F.can = st.tools?.can ?? 1;
    F.net = st.tools?.bigNet ? 2 : 1;
    F.sickle = !!st.tools?.sickle;
    F.scarecrow = !!st.tools?.scarecrow;
    F.sprinklers = st.tools?.sprinklers ?? 0;
    if (F.tool === "sickle" && !F.sickle) F.tool = "hand";
    F.seeds = { ...st.seeds };
    F.harv = { ...(st.harvests ?? {}) };
    F.barn = {};
    for (const b of st.barn) F.barn[`${b.crop}|${b.mutation}`] = b.qty;
    F.market = {
      day: st.market.day,
      hot: st.market.hot,
      mult: Object.fromEntries(
        Object.entries(st.market.mult).map(([k, m]) => [
          k,
          { m: Number(m), prev: Number(m) },
        ]),
      ),
    };
    F.shop = {
      restockAt: Date.parse(st.shop.restockAt),
      stock: { ...st.shop.stock },
    };
    F.leaves = st.leaves;
    options.onLeaves?.(st.leaves);
    F.bookRewards = st.bookRewards ?? [];
    F.wishReady = !!st.wishReady;
    F.mast = { ...(st.mastery ?? {}) };
    // The dog on guard and its gifts (migration 045).
    F.dog = st.dog
      ? {
          type: st.dog.type,
          since: Date.parse(st.dog.since),
          until: Date.parse(st.dog.until),
        }
      : null;
    F.gifts = st.dogGifts ?? [];
    // The farmer and perks (migration 046). The farm follows your Lobby
    // fighter: tell the server once if it changed since the last visit.
    // Decorations and Charm (migration 048).
    F.decor = Array(8).fill(null);
    for (const d of st.decor ?? []) F.decor[d.slot] = d.item;
    F.charm = st.charm ?? 0;
    F.decorCredits = { ...(st.decorCredits ?? {}) };
    // The Cow Pasture and Storm Milk's price today (migration 049).
    F.pasture = !!st.pasture;
    F.milkAt = st.milkAt ? Date.parse(st.milkAt) : 0;
    if (st.milkMult != null)
      F.market.mult.milk = {
        m: Number(st.milkMult),
        prev: Number(st.milkMult),
      };
    F.farmer = st.farmer ?? null;
    F.perksUsed = st.perksUsed ?? [];
    F.warmUntil = st.warmUntil ? Date.parse(st.warmUntil) : 0;
    const me = options.character?.();
    if (F.farmer && me && F.farmer !== me && !farmerSent) {
      farmerSent = true;
      queueMicrotask(() => act({ a: "farmer", id: me }, true));
    }
    // The order board (migration 040; none before it).
    F.orders = (st.orders ?? []).map((o) => ({
      slot: o.slot,
      who: o.who,
      face: o.face,
      items: o.items ?? null,
      leaves: o.leaves,
      xp: o.xp,
      bonus: o.bonus,
      waitUntil: o.waitUntil ? Date.parse(o.waitUntil) : 0,
    }));
    // The weather now and the forecast (none before migration 039).
    const wx = (w) => (w && w !== "none" ? w : null);
    F.weather = st.weather
      ? {
          cur: wx(st.weather.now),
          next: wx(st.weather.next),
          next2: wx(st.weather.later),
          until: Date.parse(st.weather.until),
        }
      : { cur: null };
    const eaten = [];
    for (const p of st.plots) {
      const old = F.plots[p.i];
      // A crow that wasn't shooed took the crop (a harvest here clears the plot first).
      if (old.crowAt && old.crop && !p.crop) eaten.push(old.crop);
      Object.assign(F.plots[p.i], {
        locked: !p.owned,
        crop: p.crop,
        prog0: Number(p.progress),
        prog: Number(p.progress),
        at0: now,
        ripeAt: p.ripeAt ? Date.parse(p.ripeAt) : null,
        wet: p.wet,
        fert: p.fertilizer,
        mut: p.mutation ? p.mutation.split("+") : [],
        pests: p.pests ?? 0,
        crowAt: st.crows?.[p.i] ? Date.parse(st.crows[p.i]) : null,
      });
    }
    // Giant crops (migration 050). A square the server saw ripe is answered:
    // it is a giant now or it won't be.
    F.giants = readGiants(st.giants);
    F.giantsGrown = { ...(st.giantsGrown ?? {}) };
    indexGiants(F);
    for (const q of squares(F.plots, (p) => p.prog0 >= 1))
      F.sqChecked.add(q.key);
    for (const c of eaten)
      log(
        `A crow ate your <b>${CROP[c]?.n ?? c}</b>! A Scarecrow or a guard dog keeps crows away`,
        "bad",
      );
    if (eaten.length)
      toast(
        `A crow ate your ${CROP[eaten[0]]?.n ?? eaten[0]}! Get a Scarecrow or a guard dog`,
      );
    announceGifts();
    announceVisits(st.visits);
    if (!F.seeds[F.seed]) {
      const first = CROPS.find((c) => F.seeds[c.id]);
      if (first) F.seed = first.id;
    }
    F.loaded = true;
    for (const a of queue) applyLocal(a);
    announceGiants();
    updatePending();
    renderAll();
    if (sheet) renderSheet();
  }
  /** What an action looks like before the server answers (the answer replaces it). */
  function applyLocal(a) {
    const p = F.plots[a.plot],
      now = serverNow();
    if (a.a === "buy-seeds") {
      F.seeds[a.crop] = (F.seeds[a.crop] || 0) + a.qty;
      return;
    }
    if (a.a === "harvest-giant") {
      const gi = F.giantAt[a.plot];
      if (!gi) return;
      for (const j of gi.plots) {
        const q = F.plots[j],
          key = `${q.crop}|${q.mut.slice().sort().join("+")}`;
        F.barn[key] = (F.barn[key] || 0) + GIANT.harvestMult * yieldN();
        Object.assign(q, mkPlot());
      }
      F.giants = F.giants.filter((x) => x !== gi);
      indexGiants(F);
      return;
    }
    if (a.a === "perk") {
      if (F.farmer === "voltkit") F.plots.forEach((q) => (q.pests = 0));
      if (F.farmer === "tidefin")
        F.plots.forEach((q) => {
          if (!q.locked && q.crop && q.prog < 1) q.wet = true;
        });
      return;
    }
    if (!p) return;
    const g = growth(p, now),
      left = p.ripeAt ? Math.max(0, p.ripeAt - now) : 0;
    if (a.a === "plant") {
      const c = CROP[a.crop],
        wet = Math.floor(a.plot / COLS) < F.sprinklers;
      Object.assign(
        p,
        mkPlot({
          crop: a.crop,
          wet,
          at0: now,
          ripeAt: now + (c.t * 1000) / (wet ? 1.35 : 1),
        }),
      );
      F.seeds[a.crop] = Math.max(0, (F.seeds[a.crop] || 0) - 1);
    } else if (a.a === "water")
      // The can you own waters its area; the server decides which plots.
      for (const j of area(a.plot, F.can)) {
        const q = F.plots[j];
        if (q.locked || !q.crop || q.prog >= 1 || q.wet) continue;
        const gq = growth(q, now),
          lq = q.ripeAt ? Math.max(0, q.ripeAt - now) : 0;
        Object.assign(q, {
          wet: true,
          prog0: gq,
          at0: now,
          ripeAt: now + lq / 1.35,
        });
      }
    else if (a.a === "shoo") p.crowAt = null;
    else if (a.a === "catch")
      for (const j of area(a.plot, a.tool === "net" && F.net === 2 ? 3 : 1)) {
        const q = F.plots[j];
        if (q.pests > 0) q.pests--;
      }
    else if (a.a === "harvest" && a.tool === "sickle")
      for (const j of area(a.plot, 3)) {
        const q = F.plots[j];
        if (q.locked || !q.crop || q.prog < 1) continue;
        const key = `${q.crop}|${q.mut.slice().sort().join("+")}`;
        F.barn[key] = (F.barn[key] || 0) + yieldN();
        Object.assign(q, mkPlot());
      }
    else if (a.a === "fertilize" && a.kind === "super") {
      const rate = left > 0 ? (1 - g) / left : 0,
        ng = Math.min(0.999, g + 0.5);
      Object.assign(p, {
        prog0: ng,
        at0: now,
        ripeAt: now + (rate ? (1 - ng) / rate : 0),
      });
      F.ferts.super = Math.max(0, F.ferts.super - 1);
    } else if (a.a === "fertilize") {
      Object.assign(p, {
        fert: a.kind,
        prog0: g,
        at0: now,
        ripeAt: now + left / 1.4,
      });
      F.ferts[a.kind] = Math.max(0, F.ferts[a.kind] - 1);
    } else if (a.a === "harvest") {
      const key = `${p.crop}|${p.mut.slice().sort().join("+")}`;
      F.barn[key] = (F.barn[key] || 0) + yieldN();
      Object.assign(p, mkPlot());
    } else if (a.a === "dig") Object.assign(p, mkPlot());
  }
  /* actions: batched (a drag across plots is one request) and sent in order */
  let queue = [],
    sending = false,
    flushTimer = 0;
  function act(a, now = false) {
    queue.push(a);
    applyLocal(a);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, now ? 0 : dragging ? 450 : 90);
  }
  /* ---------- crop mastery: the long-term goal (and leaves sink) after the crop book (migration 043) ---------- */
  const MAST_HARV = [25, 75, 200, 500, 1000],
    MAST_LV = 40,
    mastCost = (c, st) => c.cost * 30 * st * st;
  function masteryHTML() {
    const lock = F.lv < MAST_LV;
    return (
      `<div class="sh-body"><p class="sh-note">${lock ? `<b>Unlocks at farm Lv ${MAST_LV}.</b> ` : ""}Every star needs harvests of that crop and some leaves, and raises its sell price by 4%. Five stars turn it golden.</p>` +
      PCROPS.filter((c) => c.lv <= F.lv)
        .map((c) => {
          const st = F.mast?.[c.id] || 0,
            h = F.harv[c.id] || 0,
            nx = MAST_HARV[st],
            cost = st < 5 ? mastCost(c, st + 1) : 0;
          return `<div class="item mast"><span class="ic"><img src="${icon(c.id)}" alt=""></span><div><b>${c.n} <span class="stars">${"★".repeat(st)}<i>${"★".repeat(5 - st)}</i></span></b><small>${st < 5 ? `${Math.min(h, nx)}/${nx} harvests for ★${st + 1} · sells +${st * 4}%` : "Golden · sells +20%"}</small><div class="cap"><i style="width:${st < 5 ? Math.min(100, (h / nx) * 100) : 100}%"></i></div></div><div class="acts">${st < 5 ? `<button type="button" class="btn-s" data-mast="${c.id}" ${lock || h < nx || F.leaves < cost ? "disabled" : ""}>★ ${cost.toLocaleString("en-US")} ${L}</button>` : `<span class="tag legendary">MAX</span>`}</div></div>`;
        })
        .join("") +
      `</div>`
    );
  }
  /** The Cow Pasture: open it in the shop, then milk the cow (migration 049). */
  function pastureClick() {
    if (!F.pasture) return openSheet("shop", "land");
    const left = (F.milkAt - serverNow()) / 1000;
    if (left > 0) return toast(`The cow is grazing. Milk in ${fmtDur(left)}`);
    if (barnUsed() + PASTURE.milk > F.barnCap)
      return toast("Your barn is full! Sell something or upgrade the barn.");
    act({ a: "milk" }, true);
  }
  /** The wishing well: 3 seeds once a Pacific day (migration 042). */
  let wishing = false;
  async function wishWell() {
    if (!F.wishReady)
      return toast("You already made a wish today. Come back tomorrow");
    if (wishing) return;
    wishing = true;
    try {
      await flush();
      const r = await options.wish();
      if (r?.farm) applyState(r.farm);
      if (!r?.ok) return toast(r?.error ?? "The well is quiet right now.");
      const names = r.seeds.map((id) => CROP[id]?.n ?? id);
      for (let k = 0; k < 10; k++)
        FX.push({
          text: "✦",
          x: WELL.x + Math.random() * 60 - 30,
          y: WELL.y - 100 - Math.random() * 40,
          t: Math.random() * 0.3,
          life: 1,
          color: "#ffe27a",
        });
      log(`The well granted: <b>${names.join(", ")}</b>`, "good");
      toast(`Wish granted: ${names.join(", ")} seeds`);
      renderTools();
    } catch (err) {
      toast(err?.message || "Couldn't reach the well.");
    } finally {
      wishing = false;
    }
  }
  /** Crop book rewards (migration 041), by crops found. */
  const BOOK_REWARDS = [
    [5, `+100 ${L}`],
    [10, "Gold Fertilizer ×2"],
    [15, "Golden Voltkit Statue"],
    [20, `+1,000 ${L}`],
    [25, "Title: Elemental Botanist"],
  ];
  async function flush() {
    clearTimeout(flushTimer);
    if (sending || !queue.length) return;
    const actions = queue.slice(0, 60),
      lvBefore = F.lv;
    sending = true;
    try {
      const r = await options.act(actions);
      queue = queue.slice(actions.length);
      applyState(r.farm);
      const errors = r.results.filter((x) => !x.ok).map((x) => x.error);
      if (errors.length) toast(errors[0]);
      for (const x of r.results) {
        if (!x.ok || !x.tool) continue;
        const name =
          x.tool === "sprinkler"
            ? `Sprinkler for row ${F.sprinklers}`
            : (FARM_TOOLS.find((t) => t.id === x.tool)?.name ?? x.tool);
        toast(`Bought ${name}`);
        log(`Bought <b>${name}</b>`, "good");
      }
      for (const x of r.results) {
        if (!x.ok || !x.decor) continue;
        const d = DECO[x.decor];
        log(
          `Placed <b>${d?.name ?? x.decor}</b> · +${d?.charm ?? 0} Charm${x.cost ? "" : " · free"}`,
          "good",
        );
      }
      for (const x of r.results) {
        if (!x.ok || !x.perk) continue;
        const msg =
          x.perk === "zap"
            ? `Zap! Cleared ${x.cleared} bug${x.cleared === 1 ? "" : "s"}`
            : x.perk === "downpour"
              ? "Downpour! The whole farm is watered"
              : "Warmth: no bugs for 4 hours";
        toast(msg);
        log(msg, "good");
        for (const j of x.watered ?? []) {
          const rr = plotRect(j);
          FX.push({
            drops: 1,
            x: rr.x + PW / 2,
            y: rr.y + PH / 2,
            t: 0,
            life: 0.7,
          });
        }
      }
      for (const x of r.results) {
        if (!x.ok || !x.dog) continue;
        const n = DOG[x.dog]?.name ?? "Your dog",
          days = `${x.days} day${x.days > 1 ? "s" : ""}`;
        const msg = x.extended
          ? `${n} stays ${days} more`
          : `${n} is guarding your farm for ${days}!`;
        toast(msg);
        log(msg, "good");
        if (!x.extended)
          Object.assign(dog, {
            x: DOGH.x - 70,
            y: DOGH.y + 30,
            path: [],
            wait: 1,
            chase: null,
            chasing: false,
            moving: false,
          });
        dogBark();
      }
      for (const x of r.results) {
        if (!x.ok) continue;
        if (x.pasture) {
          FX.push({ puff: 1, x: 1600, y: 560, t: 0, life: 0.8 });
          float(1600, 520, "New pasture!", "#7ff0a2");
          toast("Your pasture is open. A cow moved in!");
          log("Opened the <b>Cow Pasture</b>. Your cow has moved in", "good");
        }
        if (x.milk) {
          fly(COW.x, COW.y - 60, icon("milk"), `+${x.milk}`);
          float(COW.x, COW.y - 100, `+${PASTURE.milkXp} XP`, "#7ff0a2");
          log(`Collected ${x.milk} <b>${MILK.name}</b>`, "good");
        }
      }
      for (const x of r.results) {
        if (!x.ok || x.giant == null) continue;
        const n = CROP[x.crop]?.n ?? x.crop;
        toast(`Giant ${n} harvested: +${x.qty} crops`);
        log(
          `Harvested a giant <b>${n}</b> · +${x.qty} crops · +${x.xp} XP`,
          "good",
        );
      }
      if (r.results.some((x) => x.ok && x.barnFull))
        toast("Your barn is full! Sell something or upgrade the barn.");
      if (r.combo >= 3)
        log(
          `Harvest combo <b>×${r.combo}</b> · +${r.combo * 3} bonus XP`,
          "good",
        );
      if (r.farm.level > lvBefore) levelUp(lvBefore, r.farm.level);
      for (const n of r.book ?? []) {
        const reward = BOOK_REWARDS.find(([k]) => k === n)?.[1] ?? "";
        toast(
          `Crop book: ${n} crops found · ${reward.replace(/<[^>]+>/g, "").trim()}`,
        );
        log(`Crop book: <b>${n} crops</b> found · ${reward}`, "good");
      }
    } catch (e) {
      queue = queue.slice(actions.length);
      toast(e?.message || "Couldn't reach your farm. Check your connection.");
      await refresh();
    } finally {
      sending = false;
      if (queue.length) flushTimer = setTimeout(flush, 60);
    }
  }
  async function refresh() {
    try {
      applyState(await options.load());
    } catch (e) {
      toast(e?.message || "Couldn't load your farm.");
    }
  }

  /* ---------- scenery (verbatim from the prototype) ---------- */
  const MARGIN = [];
  (() => {
    GFX.srand(91);
    const r = GFX.rnd,
      kinds = [
        "round",
        "pine",
        "mint",
        "autumn",
        "pine",
        "apple",
        "round",
        "cherry",
      ];
    const inMargin = (x, y) =>
      (x < -40 || x > WW + 40 || y < -10 || y > WH + 50) &&
      !(y > -120 && y < -20) &&
      Math.abs(x - FCX) > 90 &&
      !(Math.abs(x - HOUSE.x) < 50 && y < 0);
    for (let i = 0; i < 1600 && MARGIN.filter((m) => m.t).length < 52; i++) {
      const x = WX0 + 30 + r() * (BW - 60),
        y = WY0 + 70 + r() * (BH - 80);
      if (
        inMargin(x, y) &&
        MARGIN.every((m) => Math.hypot(m.x - x, m.y - y) > 115)
      )
        MARGIN.push({
          x,
          y,
          t: GFX.tree(
            kinds[MARGIN.length % kinds.length],
            200 + i,
            0.75 + r() * 0.35,
          ),
          ph: r() * 6,
        });
    }
    for (let i = 0; i < 1600 && MARGIN.filter((m) => m.b).length < 34; i++) {
      const x = WX0 + 20 + r() * (BW - 40),
        y = WY0 + 40 + r() * (BH - 50);
      if (
        inMargin(x, y) &&
        MARGIN.every((m) => Math.hypot(m.x - x, m.y - y) > 80)
      )
        MARGIN.push({
          x,
          y,
          b:
            r() < 0.7
              ? GFX.bush(
                  ["flower", "green", "rose", "mint"][i % 4],
                  300 + i,
                  56 + r() * 30,
                )
              : GFX.rock(400 + i, 30 + r() * 30),
        });
    }
  })();
  const FDUCKS = [
    { k: "drake", a: 0, s: 0.25 },
    { k: "hen", a: 2.5, s: 0.2 },
  ];
  /* The guard dog walks the farm (phase 6): it sits a while, then trots to
     another spot, around the pond, the well, the pasture and decorations,
     into the field only through the gate; a crow coming for a ripe crop gets
     chased off (with a dog on guard no crow lands: the server's rule). */
  const dog = {
    x: DOGH.x - 90,
    y: DOGH.y + 14,
    path: [],
    wait: 3,
    face: 1,
    barkT: 0,
    chase: null,
    chasing: false,
    moving: false,
  };
  const pathWorld = () => ({
    field: FR,
    pasture: PAST,
    pond: POND,
    well: WELL,
    doghouse: DOGH,
    scarecrow: F.scarecrow ? [288, 562] : null,
    decor: F.decor.flatMap((d, k) => (d ? [DECO_SLOTS[k]] : [])),
    gateX: FCX,
    width: WW,
    height: WH,
  });
  function dogTo(x, y, inside) {
    dog.path = dogRoute(pathWorld(), [dog.x, dog.y], [x, y], inside);
    dog.moving = true;
  }
  function dogIdleSpot() {
    const w = pathWorld();
    for (let t = 0; t < 12; t++) {
      const [x, y] = DOG_SPOTS[Math.floor(Math.random() * DOG_SPOTS.length)];
      if (!pathBlocked(w, x, y, false)) return [x, y];
    }
    return [DOGH.x - 80, DOGH.y + 34];
  }
  /** A "Woof!" bubble that follows the dog. */
  function dogBark(text = "WOOF!") {
    dog.barkT = 1.2;
    FX.push({
      bark: 1,
      follow: 1,
      x: dog.x,
      y: dog.y - 40,
      t: 0,
      life: 1.4,
      text,
    });
  }
  /** Crows the dog chases off before they can land (drawn only). */
  const decoys = [];
  let decoyIn = 60 + Math.random() * 120;
  // The pasture's cow (migration 049): it walks slowly from side to side.
  const COW = { x: 1600, y: 610, face: -1, t: 0 };
  const milkReady = () => F.pasture && F.milkAt <= serverNow();
  const hens = [
    {
      k: "white",
      x: 120,
      y: 800,
      face: 1,
      tx: null,
      ty: null,
      wait: 1,
      st: "idle",
    },
    {
      k: "brown",
      x: 230,
      y: 840,
      face: -1,
      tx: null,
      ty: null,
      wait: 2,
      st: "idle",
    },
    {
      k: "white",
      x: 70,
      y: 880,
      face: 1,
      tx: null,
      ty: null,
      wait: 3,
      st: "idle",
    },
    {
      k: "brown",
      x: 480,
      y: 960,
      face: 1,
      tx: null,
      ty: null,
      wait: 2,
      st: "idle",
    },
  ];
  const BUTTER = [0, 1, 2, 3].map((i) => ({
    hx: [230, 640, 1300, 1600][i],
    hy: [600, 300, 860, 720][i],
    ph: i * 1.7,
    c: ["#ffd65b", "#ffb3d1", "#bfe3ff", "#ffffff"][i],
  }));
  const FSMOKE = [];
  // Name tags for places on the farm: dark pill, cream capitals, same size on screen at any zoom.
  function nameTag(g, t, x, y, accent) {
    const z = 1 / Math.max(0.6, Z),
      fs = 19 * z;
    g.save();
    g.font = `800 ${fs}px 'Barlow Condensed', sans-serif`;
    g.letterSpacing = `${fs * 0.05}px`;
    const m = g.measureText(t),
      w = m.width + 22 * z,
      h = 28 * z;
    g.fillStyle = "rgba(16,12,34,.84)";
    g.beginPath();
    g.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    g.fill();
    g.strokeStyle = accent || "rgba(255,236,190,.45)";
    g.lineWidth = 1.6 * z;
    g.stroke();
    g.fillStyle = "#fff4d6";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(
      t,
      x + fs * 0.025,
      y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
    );
    g.restore();
  }
  /* ---------- background ---------- */
  const bg = document.createElement("canvas");
  bg.width = BW;
  bg.height = BH;
  function paintBg() {
    const g = bg.getContext("2d");
    g.translate(-WX0, -WY0);
    GFX.srand(77);
    const rnd = GFX.rnd;
    g.fillStyle = "#7cc45e";
    g.fillRect(WX0, WY0, BW, BH);
    for (let i = 0; i < 44; i++) {
      const x = WX0 + rnd() * BW,
        y = WY0 + rnd() * BH,
        r = 100 + rnd() * 220,
        gr = g.createRadialGradient(x, y, 0, x, y, r),
        c = rnd() < 0.5 ? "160,225,120" : "70,150,70";
      gr.addColorStop(0, `rgba(${c},.28)`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const greens = ["#6fbb53", "#86cf66", "#62b04c", "#93d672", "#76bf57"];
    for (let i = 0; i < 21000; i++) {
      const x = WX0 + rnd() * BW,
        y = WY0 + rnd() * BH;
      g.fillStyle = greens[i % 5];
      g.beginPath();
      g.ellipse(x, y, 2.4 + rnd() * 2.6, 1.3 + rnd(), rnd() * 3, 0, 7);
      g.fill();
    }
    for (let i = 0; i < 1800; i++) {
      const x = WX0 + rnd() * BW,
        y = WY0 + rnd() * BH;
      g.strokeStyle = rnd() < 0.5 ? "#4f9a3c" : "#a6e07e";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x - 3, y);
      g.lineTo(x - 4, y - 7);
      g.moveTo(x, y);
      g.lineTo(x, y - 9);
      g.moveTo(x + 3, y);
      g.lineTo(x + 5, y - 7);
      g.stroke();
    }
    for (let i = 0; i < 460; i++) {
      const x = WX0 + rnd() * BW,
        y = WY0 + rnd() * BH,
        c = ["#ffffff", "#fff3a6", "#ffc4dc", "#cfe2ff"][i % 4];
      for (let k = 0; k < 5; k++) {
        g.fillStyle = c;
        g.beginPath();
        g.arc(
          x + Math.cos(k * 1.256) * 2.2,
          y + Math.sin(k * 1.256) * 2.2,
          1.8,
          0,
          7,
        );
        g.fill();
      }
      g.fillStyle = "#ffcf3a";
      g.beginPath();
      g.arc(x, y, 1.2, 0, 7);
      g.fill();
    }
    // dirt paths with pebbles
    const dirt = (pts, w) => {
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "rgba(90,70,40,.35)";
      g.lineWidth = w + 12;
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.strokeStyle = "#d8b98a";
      g.lineWidth = w;
      g.stroke();
      g.strokeStyle = "#e6cba0";
      g.lineWidth = w * 0.45;
      g.stroke();
    };
    dirt(
      [
        [FCX, WY1 + 30],
        [FCX, OY + FH + 24],
      ],
      66,
    );
    dirt(
      [
        [WX0 - 20, -70],
        [WX1 + 20, -60],
      ],
      70,
    );
    dirt(
      [
        [HOUSE.x, HOUSE.y + 10],
        [HOUSE.x, -66],
      ],
      44,
    );
    dirt(
      [
        [FCX, OY + FH + 70],
        [420, OY + FH + 70],
        [260, 620],
        [HOUSE.x, HOUSE.y + 10],
      ],
      52,
    );
    dirt(
      [
        [FCX, OY + FH + 70],
        [1460, OY + FH + 70],
        [DOGH.x - 50, DOGH.y],
      ],
      52,
    );
    dirt(
      [
        [260, OY + FH + 70],
        [POND.x + 60, POND.y - 70],
      ],
      40,
    );
    dirt(
      [
        [HOUSE.x + 80, HOUSE.y + 10],
        [BARN.x - 40, BARN.y + 12],
      ],
      44,
    );
    // field bed
    const x0 = OX - 20,
      y0 = OY - 16,
      w = FW + 40,
      h = FH + 34;
    g.fillStyle = "rgba(40,25,10,.35)";
    g.beginPath();
    g.roundRect(x0 + 6, y0 + 10, w, h, 22);
    g.fill();
    const fg = g.createLinearGradient(0, y0, 0, y0 + h);
    fg.addColorStop(0, "#8a6038");
    fg.addColorStop(1, "#5e3f22");
    g.fillStyle = fg;
    g.beginPath();
    g.roundRect(x0, y0, w, h, 22);
    g.fill();
    g.strokeStyle = "#b0864f";
    g.lineWidth = 3;
    g.stroke();
    // pond
    g.fillStyle = "rgba(40,60,40,.35)";
    g.beginPath();
    g.ellipse(POND.x, POND.y + 8, POND.rx + 22, POND.ry + 16, 0, 0, 7);
    g.fill();
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2,
        x = POND.x + Math.cos(a) * (POND.rx + 8),
        y = POND.y + Math.sin(a) * (POND.ry + 6);
      g.fillStyle = "#7f8594";
      g.beginPath();
      g.ellipse(x, y + 3, 15, 9, a, 0, 7);
      g.fill();
      g.fillStyle = ["#c9cdd6", "#b4b9c4", "#d9dce3"][i % 3];
      g.beginPath();
      g.ellipse(x, y, 14, 8, a, 0, 7);
      g.fill();
    }
    // pasture ground
    g.fillStyle = "rgba(40,80,30,.3)";
    g.beginPath();
    g.roundRect(
      PAST.x0 + 4,
      PAST.y0 + 8,
      PAST.x1 - PAST.x0,
      PAST.y1 - PAST.y0,
      18,
    );
    g.fill();
    g.fillStyle = "#8fd46a";
    g.beginPath();
    g.roundRect(PAST.x0, PAST.y0, PAST.x1 - PAST.x0, PAST.y1 - PAST.y0, 18);
    g.fill();
    for (let i = 0; i < 180; i++) {
      const x = PAST.x0 + 8 + rnd() * (PAST.x1 - PAST.x0 - 16),
        y = PAST.y0 + 8 + rnd() * (PAST.y1 - PAST.y0 - 16);
      g.strokeStyle = rnd() < 0.5 ? "#5fae4a" : "#b6ec8c";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 2, y - 7);
      g.moveTo(x + 2, y);
      g.lineTo(x + 4, y - 6);
      g.stroke();
    }
  }
  // A fence post, painted once and stamped (~100 a frame).
  let postArt = null;
  const post = (g, x, y) => {
    postArt ??= GFX.sprite(10, 34, 5, 30, (c) => {
      const gg = c.createLinearGradient(-4, 0, 4, 0);
      gg.addColorStop(0, "#c48a4a");
      gg.addColorStop(1, "#7a5230");
      c.fillStyle = gg;
      c.beginPath();
      c.roundRect(-4, -28, 8, 30, 3);
      c.fill();
      c.fillStyle = "#e0a868";
      c.beginPath();
      c.ellipse(0, -28, 4, 2, 0, 0, 7);
      c.fill();
    });
    g.drawImage(postArt.c, x - 5, y - 30, 10, 34);
  };
  const rail = (g, xa, ya, xb, yb) => {
    g.strokeStyle = "#7a5230";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(xa, ya - 19);
    g.lineTo(xb, yb - 19);
    g.moveTo(xa, ya - 9);
    g.lineTo(xb, yb - 9);
    g.stroke();
    g.strokeStyle = "#d39a5c";
    g.lineWidth = 2.5;
    g.stroke();
  };
  // The back rail sits behind everything on the field; the side rails (one item per post) and the front rail
  // are depth-sorted with animals, so a dog in front of the fence is drawn in front of it, never under it.
  const FR = { x0: OX - 36, x1: OX + FW + 36, y0: OY - 32, y1: OY + FH + 30 };
  function drawFence(g) {
    rail(g, FR.x0, FR.y0, FR.x1, FR.y0);
    for (let x = FR.x0; x <= FR.x1; x += 46) post(g, x, FR.y0);
  }
  function fenceItems(items) {
    for (let y = FR.y0; y < FR.y1; y += 46) {
      const yb = Math.min(FR.y1, y + 46);
      for (const x of [FR.x0, FR.x1])
        items.push({
          y: yb - 1,
          d: () => {
            rail(ctx, x, y, x, yb);
            post(ctx, x, yb);
          },
        });
    }
    items.push({ y: FR.y1, d: () => drawFrontFence(ctx) });
  }
  function drawFrontFence(g) {
    const x0 = OX - 36,
      x1 = OX + FW + 36,
      y1 = OY + FH + 30,
      gap0 = FCX - 42,
      gap1 = FCX + 42;
    rail(g, x0, y1, gap0, y1);
    rail(g, gap1, y1, x1, y1);
    for (let x = x0; x <= gap0; x += 46) post(g, x, y1);
    post(g, gap0, y1);
    for (let x = gap1; x <= x1; x += 46) post(g, x, y1);
    post(g, x1, y1);
  }
  function drawPastureFence(g, back) {
    const { x0, x1, y0, y1 } = PAST;
    if (back) {
      rail(g, x0, y0, x1, y0);
      for (let x = x0; x <= x1; x += 41) post(g, x, y0);
      rail(g, x0, y0, x0, y1);
      rail(g, x1, y0, x1, y1);
      for (let y = y0 + 42; y < y1; y += 42) {
        post(g, x0, y);
        post(g, x1, y);
      }
    } else {
      rail(g, x0, y1, x1, y1);
      for (let x = x0; x <= x1; x += 41) post(g, x, y1);
    }
  }

  /* ---------- geometry ---------- */
  const plotRect = (i) => {
    const c = i % COLS,
      r = Math.floor(i / COLS);
    return {
      x: OX + c * (PW + GAP),
      y: OY + r * (PH + GAP),
      w: PW,
      h: PH,
      c,
      r,
    };
  };
  function plotAt(wx, wy) {
    // A giant crop's picture covers its square, gaps included: the plot of
    // the square under the pointer (migration 050).
    for (const gi of cur().giants ?? []) {
      const b = giantBox(gi);
      if (wx < b.x0 - 6 || wx > b.x1 + 6 || wy < b.y0 - 18 || wy > b.y1)
        continue;
      const c = Math.max(0, Math.min(2, Math.floor((wx - b.x0) / (PW + GAP)))),
        r = Math.max(0, Math.min(2, Math.floor((wy - b.y0) / (PH + GAP))));
      return gi.i + r * COLS + c;
    }
    for (let i = F.plots.length - 1; i >= 0; i--) {
      const p = plotRect(i);
      if (wx >= p.x && wx <= p.x + p.w && wy >= p.y - 18 && wy <= p.y + p.h)
        return i;
    }
    return -1;
  }
  const toWorld = (cx, cy) => {
    const r = cv.getBoundingClientRect(),
      nx = ((cx - r.left) / r.width) * NW,
      ny = ((cy - r.top) / r.height) * NH,
      vx = (nx - OFX) / K,
      vy = (ny - OFY) / K;
    return {
      x: (vx - VW / 2) / Z + cam.x,
      y: (vy - VH / 2) / Z + cam.y,
      vx,
      vy,
    };
  };
  const toScreen = (wx, wy) => ({
    x: ((wx - cam.x) * Z + VW / 2) * K + OFX,
    y: ((wy - cam.y) * Z + VH / 2) * K + OFY,
  });
  function clampCam() {
    const hw = VW / 2 / Z,
      hh = VH / 2 / Z;
    cam.x =
      BW <= hw * 2
        ? (WX0 + WX1) / 2
        : Math.max(WX0 + hw, Math.min(WX1 - hw, cam.x));
    cam.y =
      BH <= hh * 2
        ? (WY0 + WY1) / 2
        : Math.max(WY0 + hh, Math.min(WY1 - hh, cam.y));
  }
  function zoomAt(f, vx = VW / 2, vy = VH / 2) {
    const wx = (vx - VW / 2) / Z + cam.x,
      wy = (vy - VH / 2) / Z + cam.y;
    Z = Math.max(ZMIN, Math.min(ZMAX, Z * f));
    cam.x = wx - (vx - VW / 2) / Z;
    cam.y = wy - (vy - VH / 2) / Z;
    clampCam();
    $("fm-tip").hidden = true;
    $("fm-pop").hidden = true;
  }
  const area = (i, size) => {
    const { c, r } = plotRect(i),
      out = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (size === 1 && (dr || dc)) continue;
        if (size === 2 && dr) continue;
        const cc = c + dc,
          rr = r + dr;
        if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS)
          out.push(rr * COLS + cc);
      }
    return out;
  };

  /* ---------- floating fx ---------- */
  const FX = [];
  const fly = (wx, wy, img, label) =>
    FX.push({ fly: 1, x: wx, y: wy, img, label, t: 0, life: 0.9 });
  const float = (wx, wy, text, color = "#ffd65b") =>
    FX.push({ text, x: wx, y: wy, t: 0, life: 1.2, color });
  function log(html, kind = "") {
    F.log.unshift({ html, kind });
    const box = $("fm-log"),
      d = document.createElement("div");
    d.className = kind;
    d.innerHTML = html;
    box.prepend(d);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => d.classList.add("out"), 6000);
    setTimeout(() => d.remove(), 6800);
  }
  /** A decoration in its spot (the prototype's drawings). */
  let statueImg = null,
    statueGold = null;
  function drawDecor(g, id, x, y, time) {
    const sh = (rx) => GFX.shadow(g, x + 6, y + 2, rx, rx * 0.25);
    if (id === "planter") {
      sh(54);
      GFX.blit(g, GFX.flowerbed(96, 21), x, y + 6);
    } else if (id === "lamp") {
      sh(16);
      GFX.blit(g, GFX.lamp(), x, y + 4);
    } else if (id === "bush6") {
      sh(36);
      GFX.blit(g, GFX.bush("rose", 22), x, y + 4);
    } else if (id === "bush7") {
      sh(36);
      GFX.blit(g, GFX.bush("green", 23), x, y + 4);
    } else if (id === "rock") {
      sh(24);
      GFX.blit(g, GFX.rock(24, 44), x, y + 4);
    } else if (id === "crates") {
      sh(46);
      GFX.blit(g, GFX.crates(), x, y + 4);
    } else if (id === "pine")
      GFX.drawTree(g, GFX.tree("pine", 25, 0.8), x, y, time, x * 0.01, 0.7);
    else if (id === "apple")
      GFX.drawTree(g, GFX.tree("apple", 26, 0.7), x, y, time, x * 0.01, 0.7);
    else if (id === "tower") {
      sh(60);
      GFX.blit(g, GFX.gazebo(), x, y + 4);
    } else if (id === "plum") {
      sh(70);
      GFX.blit(
        g,
        GFX.house({
          wall: "#f0e4ff",
          roof: "#8a4ad0",
          w: 100,
          hgt: 70,
          roofH: 50,
          windows: 1,
          chimney: false,
          flowers: true,
          shutters: "#ffffff",
          sd: 31,
          depth: 20,
        }),
        x,
        y + 4,
        0.85,
      );
    } else if (id === "statue") {
      sh(40);
      GFX.blit(g, GFX.plinth(), x, y + 4);
      if (!statueImg) {
        statueImg = new Image();
        statueImg.src = options.art("voltkit");
      }
      if (statueImg.complete && statueImg.naturalWidth) {
        if (!statueGold)
          statueGold = tintCanvas(statueImg, null, "#ffc93a", 0.62);
        g.drawImage(statueGold, x - 34, y - 122, 68, 69);
      }
    }
  }
  // Grass on land you don't own yet: painted once per plot, then stamped.
  // Land not for sale yet is faded: each stroke at 55%, as drawn before, so
  // the picture matches (fading the finished picture would look darker).
  const lockedArts = new Map();
  function lockedArt(i, can) {
    const key = `${i}|${can ? 1 : 0}`;
    let a = lockedArts.get(key);
    if (a) return a;
    a = GFX.sprite(PW + 12, PH + 30, 4, 12, (g) => {
      g.globalAlpha = can ? 1 : 0.55;
      g.fillStyle = "rgba(20,50,20,.3)";
      g.beginPath();
      g.roundRect(2, 5, PW, PH, 12);
      g.fill();
      g.fillStyle = "#7cc45e";
      g.beginPath();
      g.roundRect(0, 0, PW, PH, 12);
      g.fill();
      GFX.srand(i * 13 + 5);
      for (let k = 0; k < 9; k++) {
        const x = 8 + GFX.rnd() * (PW - 16),
          y = 10 + GFX.rnd() * (PH - 14);
        g.strokeStyle = k % 2 ? "#4f9a3c" : "#a6e07e";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - 3, y);
        g.lineTo(x - 5, y - 9);
        g.moveTo(x, y);
        g.lineTo(x, y - 12);
        g.moveTo(x + 3, y);
        g.lineTo(x + 6, y - 8);
        g.stroke();
      }
      if (i % 3 === 0) GFX.blit(g, GFX.rock(i + 40, 22), PW * 0.3, PH * 0.8);
    });
    lockedArts.set(key, a);
    return a;
  }
  function drawLockedPlot(g, i, s) {
    const r = plotRect(i),
      cx = r.x + r.w / 2,
      me = s.me,
      can = me && touching(s.plots, i);
    GFX.blit(g, lockedArt(i, can), r.x, r.y);
    if (me && hoverI === i && can) {
      g.strokeStyle = "#ffd65b";
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 14);
      g.stroke();
    }
    if (can) {
      const k = F.land,
        ok = F.lv >= landLv(k);
      g.fillStyle = "#6b4527";
      g.fillRect(cx - 2, r.y + 18, 4, 30);
      g.save();
      g.translate(cx, r.y + 16);
      g.rotate(-0.05);
      g.fillStyle = ok ? "#c0392b" : "#6b7280";
      g.beginPath();
      g.roundRect(-34, -14, 68, 28, 6);
      g.fill();
      g.strokeStyle = "#3a1410";
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = "#fff4d6";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "800 11px 'Barlow Condensed', sans-serif";
      g.fillText("FOR SALE", 0, -5);
      g.textBaseline = "alphabetic";
      g.font = "800 11px 'DM Sans', sans-serif";
      if (ok) textWithIcon(g, String(landPrice(k)), "leaf", 0, 7, 11);
      else {
        g.textBaseline = "middle";
        g.fillText(`Lv ${landLv(k)}`, 0, 7);
        g.textBaseline = "alphabetic";
      }
      g.restore();
    }
  }
  // Soil: one picture per wet / fertilizer mix, stamped on every plot.
  const soilArts = new Map();
  function soilArt(wet, fert) {
    const key = `${wet ? 1 : 0}|${fert ?? ""}`;
    let a = soilArts.get(key);
    if (a) return a;
    a = GFX.sprite(PW + 4, PH + 7, 0, 0, (g) => {
      const sg = g.createLinearGradient(0, 0, 0, PH);
      sg.addColorStop(0, wet ? "#4a301c" : "#8a5e36");
      sg.addColorStop(1, wet ? "#3a2412" : "#6b4527");
      g.fillStyle = "rgba(0,0,0,.25)";
      g.beginPath();
      g.roundRect(2, 5, PW, PH, 12);
      g.fill();
      g.fillStyle = sg;
      g.beginPath();
      g.roundRect(0, 0, PW, PH, 12);
      g.fill();
      g.strokeStyle = wet ? "rgba(140,200,255,.25)" : "rgba(255,220,170,.22)";
      g.lineWidth = 2;
      for (let k = 1; k < 4; k++) {
        g.beginPath();
        g.moveTo(10, (k * PH) / 4);
        g.lineTo(PW - 10, (k * PH) / 4);
        g.stroke();
      }
      if (wet) {
        g.fillStyle = "rgba(160,215,255,.18)";
        g.beginPath();
        g.ellipse(PW / 2 - 18, 18, 22, 7, -0.2, 0, 7);
        g.fill();
      }
      if (fert) {
        g.fillStyle =
          fert === "gold" ? "rgba(255,210,80,.6)" : "rgba(200,255,140,.5)";
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          g.arc(16 + k * 14, PH - 10 - (k % 2) * 6, 2.2, 0, 7);
          g.fill();
        }
      }
    });
    soilArts.set(key, a);
    return a;
  }
  /** The one bed a giant crop stands on, across its square (migration 050). */
  let giantBed = null;
  function giantSoil() {
    if (giantBed) return giantBed;
    const W = 3 * PW + 2 * GAP,
      H = 3 * PH + 2 * GAP;
    giantBed = GFX.sprite(W + 4, H + 7, 0, 0, (g) => {
      const sg = g.createLinearGradient(0, 0, 0, H);
      sg.addColorStop(0, "#7a5230");
      sg.addColorStop(1, "#5a3a20");
      g.fillStyle = "rgba(0,0,0,.25)";
      g.beginPath();
      g.roundRect(2, 5, W, H, 18);
      g.fill();
      g.fillStyle = sg;
      g.beginPath();
      g.roundRect(0, 0, W, H, 18);
      g.fill();
      g.strokeStyle = "rgba(255,214,91,.45)";
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(1.5, 1.5, W - 3, H - 3, 17);
      g.stroke();
      g.strokeStyle = "rgba(255,220,170,.18)";
      g.lineWidth = 2;
      for (let k = 1; k < 12; k++) {
        g.beginPath();
        g.moveTo(14, (k * H) / 12);
        g.lineTo(W - 14, (k * H) / 12);
        g.stroke();
      }
    });
    return giantBed;
  }
  function drawPlot(g, i, p, time, s) {
    const r = plotRect(i),
      cx = r.x + r.w / 2;
    if (p.locked) {
      drawLockedPlot(g, i, s);
      return;
    }
    const gi = s.giantAt?.[i];
    if (gi) {
      if (i !== gi.i) return;
      GFX.blit(g, giantSoil(), r.x, r.y);
      if (s.me && hoverI >= 0 && s.giantAt[hoverI] === gi) {
        const b = giantBox(gi);
        g.strokeStyle = "#ffd65b";
        g.lineWidth = 3;
        g.beginPath();
        g.roundRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4, 20);
        g.stroke();
      }
      return;
    }
    GFX.blit(g, soilArt(p.wet, p.fert), r.x, r.y);
    // A ripe square of a giant crop waiting for the server's answer glows.
    if (s.me && F.pending.has(i)) {
      g.strokeStyle = `rgba(255,214,91,${0.45 + 0.4 * Math.sin(time * 8)})`;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 14);
      g.stroke();
    }
    if (s.me && hoverI === i) {
      g.strokeStyle = "#ffd65b";
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 14);
      g.stroke();
    }
    if (!s.me && s.stolen?.has(i)) {
      g.fillStyle = "rgba(0,0,0,.25)";
      g.beginPath();
      g.roundRect(r.x, r.y, r.w, r.h, 12);
      g.fill();
    }
  }
  function drawPlotCrop(g, i, p, time) {
    if (p.locked || !p.crop) return;
    const r = plotRect(i),
      cx = r.x + r.w / 2,
      base = r.y + r.h * 0.72;
    const st =
      p.prog >= 1
        ? 4
        : p.prog > 0.66
          ? 3
          : p.prog > 0.33
            ? 2
            : p.prog > 0.05
              ? 1
              : 0;
    const mut =
      p.prog >= 1
        ? p.mut.includes("rainbow")
          ? "rainbow"
          : p.mut.includes("gold")
            ? "gold"
            : p.mut[0]
        : null;
    const im = cropImage(p.crop, st, mut, time),
      w = 90,
      h = 105,
      sway = st >= 2 ? Math.sin(time * 1.6 + i) * 0.03 : 0;
    if (im && (im.complete ?? true)) {
      g.save();
      g.translate(cx, base + 6);
      g.rotate(sway);
      if (st === 4) {
        const ph = (time * 0.55 + i * 0.37) % 3.2,
          hop = ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) : 0,
          b = 1 + Math.sin(time * 3 + i) * 0.015;
        g.scale(b * (1 + hop * 0.05), b * (1 - hop * 0.06));
      }
      g.drawImage(im, -w / 2, (-h * 132) / 140, w, h);
      g.restore();
    }
    if (st === 4) {
      if (mut === "gold" || mut === "rainbow")
        for (let k = 0; k < 3; k++) {
          const a = time * 2 + k * 2.1 + i;
          g.fillStyle = "#fff";
          g.globalAlpha = 0.5 + 0.5 * Math.sin(a * 2);
          g.beginPath();
          g.arc(cx + Math.cos(a) * 30, base - 40 + Math.sin(a) * 18, 2.5, 0, 7);
          g.fill();
          g.globalAlpha = 1;
        }
      if (p.mut.includes("shock")) {
        g.strokeStyle = `rgba(200,230,255,${0.5 + 0.5 * Math.sin(time * 20 + i)})`;
        g.lineWidth = 2;
        g.beginPath();
        let x = cx - 26,
          y = base - 70;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += 10;
          y += k % 2 ? -8 : 8;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      if (p.mut.includes("moon")) {
        const gr = g.createRadialGradient(cx, base - 40, 4, cx, base - 40, 50);
        gr.addColorStop(0, "rgba(200,170,255,.35)");
        gr.addColorStop(1, "rgba(200,170,255,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, base - 40, 50, 0, 7);
        g.fill();
      }
      if (p.mut.includes("frost")) {
        g.fillStyle = "#fff";
        const sn = ICON_IMG("snow");
        for (let k = 0; k < 4; k++)
          if (sn.complete)
            g.drawImage(sn, cx - 36 + k * 20, base - 72 + (k % 2) * 14, 12, 12);
      }
    }
    drawBugs(g, i, p, time);
    if (p.prog < 1 && p.prog > 0) {
      g.fillStyle = "rgba(0,0,0,.4)";
      g.beginPath();
      g.roundRect(r.x + 14, r.y + r.h - 8, r.w - 28, 5, 3);
      g.fill();
      g.fillStyle = p.wet ? "#7fd4ff" : "#7ff0a2";
      g.beginPath();
      g.roundRect(r.x + 14, r.y + r.h - 8, (r.w - 28) * p.prog, 5, 3);
      g.fill();
    }
  }
  /** Bugs on a plot (also drawn over a giant crop, whose plots can keep them). */
  function drawBugs(g, i, p, time) {
    const r = plotRect(i),
      cx = r.x + r.w / 2,
      base = r.y + r.h * 0.72;
    for (let k = 0; k < p.pests; k++) {
      const px = cx - 26 + k * 34,
        py = base - 10 + Math.sin(time * 6 + k + i) * 3;
      g.fillStyle = "#2a1f4a";
      g.beginPath();
      g.ellipse(px, py + 2, 12, 9, 0, 0, 7);
      g.fill();
      g.fillStyle = "#5b45a8";
      g.beginPath();
      g.ellipse(px, py - 1, 11, 9, 0, 0, 7);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(px - 4, py - 3, 3, 0, 7);
      g.arc(px + 4, py - 3, 3, 0, 7);
      g.fill();
      g.fillStyle = "#111";
      g.beginPath();
      g.arc(px - 3.5, py - 2.5, 1.4, 0, 7);
      g.arc(px + 4.5, py - 2.5, 1.4, 0, 7);
      g.fill();
      g.strokeStyle = "#5b45a8";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(px - 4, py - 8);
      g.lineTo(px - 7, py - 14);
      g.moveTo(px + 4, py - 8);
      g.lineTo(px + 7, py - 14);
      g.stroke();
    }
  }
  /** A giant crop's square in the world, and the ground its picture stands on. */
  const giantBox = (gi) => {
    const a = plotRect(gi.i),
      b = plotRect(gi.i + 2 * COLS + 2);
    return {
      x0: a.x,
      y0: a.y,
      x1: b.x + b.w,
      y1: b.y + b.h,
      cx: (a.x + b.x + b.w) / 2,
      ground: b.y + PH * 0.72 + 6,
    };
  };
  const gmcache = new Map();
  function giantImage(gi, time) {
    const base = GIMG[gi.crop],
      mut = gi.tint;
    if (!mut || !base.complete) return base;
    let key = `${gi.crop}|${mut}`;
    if (mut === "rainbow") {
      const h = Math.floor((time * 3) % 6);
      key += h;
      if (!gmcache.has(key))
        gmcache.set(
          key,
          tintCanvas(base, null, `hsl(${h * 60} 95% 60%)`, 0.42),
        );
      return gmcache.get(key);
    }
    if (!MUTS[mut]) return base;
    if (!gmcache.has(key))
      gmcache.set(key, tintCanvas(base, null, MUTS[mut].tint, MUTS[mut].a));
    return gmcache.get(key);
  }
  /** A giant crop: one picture across its square, with every mutation its crops carry. */
  function drawGiant(g, gi, s, time) {
    const b = giantBox(gi),
      im = giantImage(gi, time),
      k = (b.x1 - b.x0 + 22) / GIANT_ART.w,
      w = GIANT_ART.w * k,
      h = GIANT_ART.h * k;
    // Just grown: it pops up out of its bed.
    const age = giantBorn.has(gi.key) ? T - giantBorn.get(gi.key) : 9,
      u = Math.min(1, Math.max(0, age / 0.7)),
      pop = reduced
        ? 1
        : 0.55 + 0.45 * (1 - (1 - u) ** 3) + Math.sin(u * Math.PI) * 0.08,
      br = reduced ? 1 : 1 + Math.sin(time * 1.4 + gi.i) * 0.012;
    GFX.shadow(g, b.cx, b.ground - 2, 150 * k * pop, 16 * k, 0.22);
    if (im && (im.complete ?? true)) {
      g.save();
      g.translate(b.cx, b.ground);
      g.scale(pop * br, pop * (2 - br));
      g.drawImage(im, -w / 2, -GIANT_ART.ground * k, w, h);
      g.restore();
    }
    const cy = b.ground - 110 * k;
    if (gi.muts.includes("gold") || gi.muts.includes("rainbow"))
      for (let n = 0; n < 7; n++) {
        const a = time * 1.3 + n * 0.9 + gi.i;
        g.fillStyle = gi.muts.includes("rainbow")
          ? `hsl(${(n * 52 + time * 90) % 360} 95% 75%)`
          : "#fff6c2";
        g.globalAlpha = 0.5 + 0.5 * Math.sin(a * 2);
        g.beginPath();
        g.arc(
          b.cx + Math.cos(a) * 140 * k,
          cy + Math.sin(a) * 80 * k,
          3.4,
          0,
          7,
        );
        g.fill();
        g.globalAlpha = 1;
      }
    if (gi.muts.includes("shock"))
      for (const side of [-1, 1]) {
        g.strokeStyle = `rgba(200,230,255,${0.5 + 0.5 * Math.sin(time * 20 + side)})`;
        g.lineWidth = 3;
        g.beginPath();
        let x = b.cx + side * 70 * k - 30,
          y = cy - 70 * k;
        g.moveTo(x, y);
        for (let n = 0; n < 6; n++) {
          x += 12;
          y += n % 2 ? -10 : 10;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    if (gi.muts.includes("moon")) {
      const gr = g.createRadialGradient(b.cx, cy, 10, b.cx, cy, 170 * k);
      gr.addColorStop(0, "rgba(200,170,255,.32)");
      gr.addColorStop(1, "rgba(200,170,255,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(b.cx, cy, 170 * k, 0, 7);
      g.fill();
    }
    if (gi.muts.includes("frost")) {
      const sn = ICON_IMG("snow");
      if (sn.complete)
        for (let n = 0; n < 6; n++)
          g.drawImage(
            sn,
            b.cx - 120 * k + n * 46 * k,
            cy - 80 * k + (n % 2) * 30 * k,
            16,
            16,
          );
    }
    for (const j of gi.plots)
      if (s.plots[j].pests) drawBugs(g, j, s.plots[j], time);
  }
  // Weather you can see at a glance: layered rain with splashes, real lightning flashes,
  // drifting snow, a starry night with fireflies, a bright rainbow, warm sun rays.
  const WX = { flash: 0 };
  function drawWeather(g, time) {
    const w = F.weather.cur;
    if (w === "rain" || w === "storm") {
      const heavy = w === "storm";
      g.fillStyle = heavy ? "rgba(14,22,50,.36)" : "rgba(26,46,96,.24)";
      g.fillRect(0, 0, VW, VH);
      g.lineCap = "round";
      // Low graphics: half the drops and splashes.
      const share = low ? 0.5 : 1;
      for (const [n, len, sp, lw, a] of [
        [(heavy ? 240 : 170) * share, 15, 760, 1.3, 0.38],
        [(heavy ? 160 : 110) * share, 28, 1180, 2.3, 0.72],
      ]) {
        g.strokeStyle = `rgba(205,228,255,${a})`;
        g.lineWidth = lw;
        g.beginPath();
        for (let k = 0; k < n; k++) {
          const x = ((k * 97.3 + time * sp * 0.32) % (VW + 220)) - 110,
            y = ((k * 53.7 + time * sp) % (VH + 60)) - 30;
          g.moveTo(x, y);
          g.lineTo(x - len * 0.32, y + len);
        }
        g.stroke();
      }
      g.strokeStyle = "rgba(215,238,255,.75)";
      g.lineWidth = 1.4;
      for (let k = 0; k < (heavy ? 54 : 40) * share; k++) {
        const c = time * 2.4 + k * 0.37,
          ph = c % 1,
          cyc = Math.floor(c),
          x = (k * 211.7 + cyc * 157) % VW,
          y = 110 + ((k * 137.3 + cyc * 89) % (VH - 130));
        g.globalAlpha = 1 - ph;
        g.beginPath();
        g.ellipse(x, y, 3 + ph * 11, 1.3 + ph * 3.6, 0, 0, 7);
        g.stroke();
      }
      g.globalAlpha = 1;
      if (heavy && WX.flash > 0) {
        g.fillStyle = `rgba(235,242,255,${WX.flash * 0.6})`;
        g.fillRect(0, 0, VW, VH);
      }
    }
    if (w === "moon") {
      g.save();
      g.globalCompositeOperation = "multiply";
      g.fillStyle = "#454a86";
      g.fillRect(0, 0, VW, VH);
      g.restore();
      const mx = VW - 260,
        gr = g.createRadialGradient(mx, 90, 10, mx, 90, 150);
      gr.addColorStop(0, "rgba(255,250,220,.95)");
      gr.addColorStop(0.18, "rgba(255,250,220,.55)");
      gr.addColorStop(1, "rgba(255,250,220,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(mx, 90, 150, 0, 7);
      g.fill();
      g.fillStyle = "#fffbe6";
      g.beginPath();
      g.arc(mx, 90, 26, 0, 7);
      g.fill();
      for (let k = 0; k < 60; k++) {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.6 + k * 2.1));
        g.fillStyle = `rgba(255,255,240,${tw * 0.9})`;
        g.beginPath();
        g.arc(
          (k * 197.3) % VW,
          12 + ((k * 61.7) % 150),
          k % 5 ? 1.3 : 2.2,
          0,
          7,
        );
        g.fill();
      }
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 46; k++) {
        const a = (0.5 + 0.5 * Math.sin(time * 3 + k)) * 0.9,
          x = (k * 173.3 + Math.sin(time * 0.5 + k) * 30) % VW,
          y = 220 + ((k * 97.1) % (VH - 260)) + Math.sin(time + k) * 14;
        const fg = g.createRadialGradient(x, y, 0, x, y, 12);
        fg.addColorStop(0, `rgba(230,255,150,${a})`);
        fg.addColorStop(1, "rgba(230,255,150,0)");
        g.fillStyle = fg;
        g.beginPath();
        g.arc(x, y, 12, 0, 7);
        g.fill();
      }
      g.restore();
    }
    if (w === "frost") {
      g.fillStyle = "rgba(222,242,255,.2)";
      g.fillRect(0, 0, VW, VH);
      for (let k = 0; k < 170; k++) {
        const r = 1.6 + (k % 4) * 1,
          sp = 26 + (k % 5) * 13,
          x =
            ((k * 131.7 + Math.sin(time * 0.8 + k) * 40 + time * 22) %
              (VW + 40)) -
            20,
          y = ((k * 71.3 + time * sp) % (VH + 20)) - 10;
        g.fillStyle = `rgba(255,255,255,${0.65 + (k % 3) * 0.12})`;
        g.beginPath();
        g.arc(x, y, r, 0, 7);
        g.fill();
      }
      const vg = g.createRadialGradient(
        VW / 2,
        VH / 2,
        VH * 0.35,
        VW / 2,
        VH / 2,
        VH,
      );
      vg.addColorStop(0, "rgba(220,245,255,0)");
      vg.addColorStop(1, "rgba(225,245,255,.55)");
      g.fillStyle = vg;
      g.fillRect(0, 0, VW, VH);
    }
    if (w === "rainbow") {
      const cx = VW / 2,
        cy = VH + 40,
        R = Math.min(VW * 0.62, 820);
      g.save();
      g.globalAlpha = 0.22;
      g.strokeStyle = "#fff";
      g.lineWidth = 120;
      g.filter = "blur(18px)";
      g.beginPath();
      g.arc(cx, cy, R - 40, Math.PI, 0);
      g.stroke();
      g.restore();
      g.save();
      g.globalAlpha = 0.5;
      [
        "#ff5a5a",
        "#ffa94d",
        "#ffe066",
        "#69db7c",
        "#4dabf7",
        "#9775fa",
      ].forEach((c, k) => {
        g.strokeStyle = c;
        g.lineWidth = 16;
        g.beginPath();
        g.arc(cx, cy, R - k * 16, Math.PI, 0);
        g.stroke();
      });
      g.restore();
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 40; k++) {
        const a = (0.5 + 0.5 * Math.sin(time * 4 + k * 1.3)) * 0.8;
        g.fillStyle = `rgba(255,250,230,${a})`;
        const x = (k * 151.3 + time * 12) % VW,
          y = (k * 83.7) % (VH * 0.7);
        g.beginPath();
        g.moveTo(x, y - 5);
        g.lineTo(x + 1.6, y);
        g.lineTo(x, y + 5);
        g.lineTo(x - 1.6, y);
        g.fill();
      }
      g.restore();
    }
    if (w === "sun") {
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 5; k++) {
        g.fillStyle = "rgba(255,238,170,.075)";
        g.beginPath();
        g.moveTo(VW - 200 + k * 46, -20);
        g.lineTo(VW - 110 + k * 46, -20);
        g.lineTo(VW * 0.45 + k * 130, VH);
        g.lineTo(VW * 0.45 - 110 + k * 130, VH);
        g.fill();
      }
      for (let k = 0; k < 36; k++) {
        const a = (0.4 + 0.6 * Math.abs(Math.sin(time * 0.9 + k))) * 0.55;
        g.fillStyle = `rgba(255,240,190,${a})`;
        g.beginPath();
        g.arc(
          (k * 167.9 + Math.sin(time * 0.4 + k) * 40) % VW,
          (k * 97.7 + time * 9) % VH,
          1.8,
          0,
          7,
        );
        g.fill();
      }
      g.restore();
    }
  }
  let hoverI = -1;
  const combo = { n: 0, x: 0, y: 0 };
  const CUR = { on: false, vx: 0, vy: 0, use: 0, grab: false };
  const AREA = (t) =>
    t === "can"
      ? F.can
      : t === "net"
        ? F.net === 2
          ? 3
          : 1
        : t === "sickle"
          ? 3
          : 1;
  const CUR_ICON = {
    hand: "hand",
    seed: "seed",
    can: () => ["", "can", "can2", "can3"][F.can],
    fert: () =>
      F.fert === "gold"
        ? "fertGold"
        : F.fert === "super"
          ? "fertSuper"
          : "fert",
    net: "net",
    sickle: "sickle",
    shovel: "shovel",
    prank: "bug",
    gift: "gift",
  };
  // Each tool: how it moves when used (pivot near the grip), and what falls out of it.
  const CUR_MOTION = {
    can: [-0.35, -0.75],
    net: [-0.4, 1.0],
    sickle: [-0.15, -1.25],
    shovel: [0.35, -0.6],
    seed: [0, -0.55],
    fert: [-0.2, -0.6],
    hand: [0, 0],
    prank: [0, 0.2],
    gift: [0, -0.3],
  };
  function drawHoldRing(g) {
    if (!tapG || tapG.mode !== "pending") return;
    const k = (performance.now() - tapG.t0 - 90) / (HOLD_MS - 90);
    if (k <= 0) return;
    const r = cv.getBoundingClientRect(),
      vx = (((tapG.x0 - r.left) / r.width) * NW - OFX) / K,
      vy = (((tapG.y0 - r.top) / r.height) * NH - OFY) / K;
    g.save();
    g.lineWidth = 4;
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.beginPath();
    g.arc(vx, vy, 30, 0, 7);
    g.stroke();
    g.strokeStyle = "#ffd65b";
    g.beginPath();
    g.arc(
      vx,
      vy,
      30,
      -Math.PI / 2,
      -Math.PI / 2 + Math.min(1, k) * Math.PI * 2,
    );
    g.stroke();
    g.restore();
  }
  function drawToolCursor(g, time) {
    if (!CUR.on) return;
    const t = F.tool,
      k = Math.max(0, CUR.use),
      sw = Math.sin((1 - k) * Math.PI) * (k > 0 ? 1 : 0),
      x = CUR.vx,
      y = CUR.vy;
    const name = CUR.grab
        ? "hand"
        : typeof CUR_ICON[t] === "function"
          ? CUR_ICON[t]()
          : CUR_ICON[t] || "hand",
      im = ICON_IMG(name);
    const [rest, swing] = CUR_MOTION[t] || [0, 0],
      S = 44;
    g.save();
    g.translate(x, y);
    g.save();
    g.rotate(
      rest + swing * sw + (t === "seed" ? Math.sin(time * 3) * 0.05 : 0),
    );
    if (t === "hand" || CUR.grab) g.scale(1 - k * 0.12, 1 - k * 0.12);
    g.shadowColor = "rgba(0,0,0,.35)";
    g.shadowBlur = 6;
    g.shadowOffsetY = 3;
    if (im?.complete) g.drawImage(im, -S * 0.35, -S * 0.75, S, S);
    g.restore();
    if (t === "seed" && !CUR.grab) {
      const ci = ITEM[F.seed] || CIMG[F.seed]?.[4];
      if (ci?.complete) g.drawImage(ci, S * 0.22, -S * 0.1, 20, 23);
      g.font = "800 11px 'DM Sans', sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 3;
      g.strokeStyle = "#2a1f12";
      g.fillStyle = "#fff";
      const n = `×${F.seeds[F.seed] || 0}`;
      g.strokeText(n, S * 0.5, S * 0.5);
      g.fillText(n, S * 0.5, S * 0.5);
      g.textBaseline = "alphabetic";
    }
    if (k > 0 && !CUR.grab) {
      if (t === "can") {
        g.fillStyle = "rgba(120,200,255,.9)";
        for (let d = 0; d < 6; d++) {
          const f = ((1 - k) * 2 + d * 0.17) % 1;
          g.beginPath();
          g.ellipse(22 + (d % 3) * 3 + f * 6, -8 + f * 40, 2, 3.5, 0, 0, 7);
          g.fill();
        }
      }
      if (t === "seed") {
        g.fillStyle = "#8a6238";
        for (let d = 0; d < 5; d++) {
          g.beginPath();
          g.ellipse(
            -4 + d * 3,
            14 + (1 - k) * 20 + (d % 2) * 4,
            1.8,
            2.6,
            d,
            0,
            7,
          );
          g.fill();
        }
      }
      if (t === "fert") {
        g.fillStyle =
          F.fert === "gold"
            ? "#ffd65b"
            : F.fert === "super"
              ? "#7fe7ff"
              : "#9be07a";
        for (let d = 0; d < 7; d++) {
          g.beginPath();
          g.arc(-6 + d * 3, 14 + (1 - k) * 24 + (d % 3) * 3, 1.8, 0, 7);
          g.fill();
        }
      }
      if (t === "sickle") {
        g.strokeStyle = `rgba(255,255,255,${k})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, -6, 30, -2.4, -0.4);
        g.stroke();
      }
      if (t === "net") {
        g.strokeStyle = `rgba(200,170,255,${k})`;
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(8, -12, 22, -1.8, 0.2);
        g.stroke();
      }
    }
    g.restore();
  }
  function drawArea(g) {
    if (!CUR.on || hoverI < 0 || F.decorPick) return;
    const s = cur();
    if (!s.me && !["can", "net", "hand", "prank"].includes(F.tool)) return;
    let ids =
      s.me && ["can", "net", "sickle"].includes(F.tool)
        ? area(hoverI, AREA(F.tool))
        : [hoverI];
    // A giant crop the tool takes whole lights up whole (migration 050).
    if (s.me && ["hand", "seed", "sickle"].includes(F.tool))
      ids = [
        ...new Set(
          ids.flatMap((j) => (s.giantAt?.[j] ? s.giantAt[j].plots : [j])),
        ),
      ];
    const col =
      {
        can: "120,200,255",
        net: "200,170,255",
        sickle: "255,214,91",
        seed: "160,240,130",
        fert: "200,255,140",
        shovel: "255,140,140",
      }[F.tool] || "255,255,255";
    ids.forEach((j) => {
      const r = plotRect(j),
        p = s.plots[j];
      if (!p || (p.locked && s.me && F.tool !== "hand")) return;
      g.fillStyle = `rgba(${col},.18)`;
      g.strokeStyle = `rgba(${col},.9)`;
      g.lineWidth = 2.5;
      g.setLineDash([7, 5]);
      g.beginPath();
      g.roundRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, 13);
      g.fill();
      g.stroke();
      g.setLineDash([]);
    });
  }

  /* ---------- friends' farms (migration 047): visit mode ---------- */
  // V is the friend's farm being visited (null at home). Their plots use the
  // same shape as yours, so the drawing code shows either.
  let V = null,
    friendsList = null,
    visitQueue = [],
    visitSending = false,
    visitTimer = 0;
  const cur = () =>
    V
      ? {
          plots: V.plots,
          me: false,
          stolen: V.stolen,
          dog: V.dog,
          pasture: V.pasture,
          giants: V.giants,
          giantAt: V.giantAt,
        }
      : {
          plots: F.plots,
          me: true,
          pasture: F.pasture,
          giants: F.giants,
          giantAt: F.giantAt,
        };
  function applyVisit(v) {
    const now = Date.parse(v.now);
    offset = now - Date.now();
    V = {
      id: v.id,
      name: v.name,
      fighter: v.fighter,
      level: v.level,
      farmer: v.farmer,
      dog: v.dog,
      pasture: !!v.pasture,
      today: v.today ?? { helpXp: 0, sneaks: 0, pranks: 0 },
      stolen: new Set(),
      plots: v.plots.map((p) =>
        mkPlot({
          locked: !p.owned,
          crop: p.crop,
          prog0: Number(p.progress),
          prog: Number(p.progress),
          at0: now,
          ripeAt: p.ripeAt ? Date.parse(p.ripeAt) : null,
          wet: p.wet,
          pests: p.pests ?? 0,
          mut: p.mutation ? p.mutation.split("+") : [],
        }),
      ),
    };
    // Ripe plots you can no longer sneak from are shaded.
    for (const p of v.plots)
      if (p.crop && Number(p.progress) >= 1 && !p.sneak) V.stolen.add(p.i);
    // Their giant crops (migration 050).
    V.giants = readGiants(v.giants);
    indexGiants(V);
    for (const a of visitQueue) applyVisitLocal(a);
    renderVisit();
    renderAll();
  }
  function renderVisit() {
    const el = $("fm-visit");
    if (!V) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = `<img src="${options.art(V.fighter)}" alt=""><div><b>${esc(V.name)}'s Farm</b><small>${V.dog ? `${I("dog")} ${DOG[V.dog]?.name ?? "A dog"} is on guard. Sneaking may get you caught` : "No guard dog"}</small></div><button type="button" data-home>← My farm</button>`;
  }
  async function visitFriend(id) {
    try {
      await flush();
      const v = await options.visit(id);
      closeSheet();
      F.tool = "hand";
      visitQueue = [];
      applyVisit(v);
      log(`Visiting <b>${esc(v.name)}</b>'s farm`);
    } catch (e) {
      toast(e?.message || "Couldn't visit that farm.");
    }
  }
  async function goHome() {
    await visitFlush();
    V = null;
    F.tool = "hand";
    renderVisit();
    renderAll();
    // Helping friends gave you farm XP.
    await refresh();
  }
  async function loadFriends() {
    try {
      friendsList = await options.friends();
    } catch {
      friendsList = friendsList ?? [];
    }
    $("fm-fr-dot").hidden = !friendsList.some((f) => f.bugs || f.ripe);
    syncMenuDot();
    if (sheet === "friends") renderSheet();
  }
  /** What a visit action looks like before the server answers. */
  function applyVisitLocal(a) {
    const p = V?.plots[a.plot];
    if (!p) return;
    if (a.a === "catch") p.pests = Math.max(0, p.pests - 1);
    else if (a.a === "water") p.wet = true;
    else if (a.a === "sneak") V.stolen.add(a.plot);
    else if (a.a === "prank") p.pests += 1;
  }
  /** A tap on a friend's plot: catch, water, sneak or prank, by tool. */
  function visitTool(i, drag) {
    const p = V.plots[i];
    if (!p || p.locked) return;
    const r = plotRect(i),
      cx = r.x + PW / 2;
    let a = null;
    // A friend's giant crop (migration 050): its 9 crops are 9 plantings. A
    // tap sneaks from the one under it, or the next you haven't tried.
    const gi = V.giantAt?.[i];
    if (F.tool === "hand" && gi && !p.pests) {
      const j = [i, ...gi.plots].find((x) => !V.stolen.has(x));
      if (j == null) {
        if (!drag) toast("You already tried every crop of this giant");
        return;
      }
      i = j;
    }
    if (F.tool === "hand") {
      if (p.pests) a = "catch";
      else if (p.crop && p.prog >= 1) {
        if (V.stolen.has(i)) {
          if (!drag) toast("You already snuck a crop from this plot");
          return;
        }
        a = "sneak";
      }
    } else if (F.tool === "can") {
      if (p.crop && p.prog < 1 && !p.wet) a = "water";
    } else if (F.tool === "net") {
      if (p.pests) a = "catch";
    } else if (F.tool === "prank") {
      if (V.today.pranks >= 3) return toast("No pranks left today (3/3)");
      if (V.farmer === "auralynx")
        return toast(`${V.name}'s Shield blocks pranks`);
      if (!p.crop || p.prog >= 1) {
        if (!drag) toast("Bugs only go on growing crops");
        return;
      }
      V.today.pranks++;
      a = "prank";
    }
    if (!a) return;
    if (a === "catch" || a === "prank")
      FX.push({ poof: 1, x: cx, y: r.y + PH / 2, t: 0, life: 0.5 });
    if (a === "water")
      FX.push({ drops: 1, x: cx, y: r.y + PH / 2, t: 0, life: 0.7 });
    const action = { a, plot: i };
    visitQueue.push(action);
    applyVisitLocal(action);
    renderTools();
    clearTimeout(visitTimer);
    visitTimer = setTimeout(visitFlush, dragging ? 450 : 90);
  }
  async function visitFlush() {
    clearTimeout(visitTimer);
    if (visitSending || !visitQueue.length || !V) return;
    const actions = visitQueue.slice(0, 30),
      friend = V;
    visitSending = true;
    try {
      const r = await options.visitAct(friend.id, actions);
      visitQueue = visitQueue.slice(actions.length);
      if (typeof r.leaves === "number") options.onLeaves?.(r.leaves);
      if (V && V.id === friend.id) applyVisit(r.farm);
      const errors = r.results.filter((x) => !x.ok).map((x) => x.error);
      if (errors.length) toast(errors[0]);
      let xp = 0;
      r.results.forEach((x, k) => {
        if (!x.ok) return;
        const a = actions[k],
          rr = plotRect(a.plot),
          cx = rr.x + PW / 2;
        if (x.xp) {
          xp += x.xp;
          float(cx, rr.y, `+${x.xp} XP`, "#7ff0a2");
        }
        if (x.crop) {
          fly(cx, rr.y + 10, icon(x.crop), "+1");
          log(
            `Snuck 1 <b>${CROP[x.crop]?.n ?? x.crop}</b> from ${esc(friend.name)}'s farm`,
          );
        }
        if (x.caught) {
          const dog = DOG[x.caught]?.name ?? "Their dog";
          FX.push({ bark: 1, x: cx, y: rr.y, t: 0, life: 1.2 });
          const msg = x.fine
            ? `Woof! ${dog} caught you. You lost ${x.fine} Gold Leaves`
            : `Woof! ${dog} chased you off`;
          toast(msg);
          log(msg, "bad");
        }
        if (a.a === "prank")
          log(
            `Dropped a bug on <b>${esc(friend.name)}</b>'s farm (${x.pranksLeft ?? 0}/3 left)`,
          );
      });
      if (
        !xp &&
        r.results.some((x, k) => x.ok && "xp" in x && actions[k].a !== "sneak")
      )
        toast("You've earned today's 60 XP for helping friends");
    } catch (e) {
      visitQueue = visitQueue.slice(actions.length);
      toast(e?.message || "Couldn't reach your friend's farm.");
    } finally {
      visitSending = false;
      if (visitQueue.length) visitTimer = setTimeout(visitFlush, 60);
    }
  }
  /** Who visited your farm since this device last showed it (migration 047). */
  const VISIT_KEY = "arena-farm-visit-seen";
  function announceVisits(list) {
    if (!list?.length) return;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(VISIT_KEY)) || 0;
    } catch {}
    const day = serverNow() - 86400e3,
      fresh = list
        .filter((v) => (seen ? v.id > seen : Date.parse(v.at) > day))
        .reverse();
    let notable = null;
    for (const v of fresh) {
      const crop = CROP[v.crop]?.n ?? "crop",
        who = `<b>${esc(v.name)}</b>`;
      const text =
        v.kind === "water"
          ? `${who} watered your ${crop}`
          : v.kind === "catch"
            ? `${who} caught a bug on your ${crop}`
            : v.kind === "sneak"
              ? `${who} snuck 1 ${crop} from you`
              : v.kind === "caught"
                ? `Your dog caught ${who} sneaking${v.n ? `: +${v.n} ${L} fine` : ""}`
                : `${who} dropped a bug on your ${crop}`;
      log(text, v.kind === "sneak" || v.kind === "prank" ? "bad" : "good");
      if (v.kind !== "water" && v.kind !== "catch") notable = text;
    }
    if (notable) toast(notable.replace(/<[^>]+>/g, ""));
    try {
      localStorage.setItem(
        VISIT_KEY,
        String(Math.max(seen, ...list.map((v) => v.id))),
      );
    } catch {}
  }

  /* ---------- core actions (sent to the server) ---------- */
  function plantAt(i, id) {
    const p = F.plots[i],
      c = CROP[id];
    if (!c || p.locked || p.crop) return false;
    if (c.lv > F.lv) {
      toast(`${c.n} unlocks at farm level ${c.lv}`);
      return false;
    }
    if (!F.seeds[id]) {
      toast(`Out of ${c.n} seeds. Buy more in the Shop.`);
      return false;
    }
    act({ a: "plant", plot: i, crop: id });
    const r = plotRect(i);
    FX.push({ puff: 1, x: r.x + PW / 2, y: r.y + PH / 2, t: 0, life: 0.5 });
    return true;
  }
  function harvestAt(i, silent) {
    const p = F.plots[i];
    if (!p.crop || p.prog < 1) return false;
    if (F.pending.has(i)) {
      if (!silent) toast("Something big is growing here…");
      return false;
    }
    if (barnUsed() + yieldN() > F.barnCap) {
      if (!silent)
        toast("Your barn is full! Sell something or upgrade the barn.");
      return false;
    }
    const c = CROP[p.crop],
      r = plotRect(i);
    fly(r.x + PW / 2, r.y + 10, icon(c.id), `+${yieldN()}`);
    float(r.x + PW / 2, r.y - 30, `+${c.xp} XP`, "#7ff0a2");
    act({ a: "harvest", plot: i });
    if (dragging) {
      combo.n++;
      if (combo.n >= 3)
        float(r.x + PW / 2, r.y - 26, `Combo ×${combo.n}!`, "#ff9bd2");
    }
    return true;
  }
  /** Crows that were shooed, flying off (drawn until they leave the screen). */
  const crowsLeaving = [];
  function shooAt(i) {
    const r = plotRect(i);
    act({ a: "shoo", plot: i }, true);
    crowsLeaving.push({ x: r.x + PW / 2, y: r.y + 20, t: 0 });
    float(r.x + PW / 2, r.y - 10, "Shoo!", "#fff");
  }
  /** Decorating (migration 048): place the picked decoration, or put one away. */
  function placeDecor(k) {
    const pick = F.decorPick;
    if (pick === "__remove") {
      if (!F.decor[k]) return toast("Nothing to put away there");
      act({ a: "decor-remove", slot: k }, true);
      log(`Put away <b>${DECO[F.decor[k]]?.name ?? "decor"}</b>`);
      F.decor[k] = null;
    } else {
      const d = DECO[pick];
      if (!d) return;
      if (F.decor[k] === pick) return toast("That is already there");
      act({ a: "decor", slot: k, item: pick }, true);
      FX.push({
        puff: 1,
        x: DECO_SLOTS[k][0],
        y: DECO_SLOTS[k][1],
        t: 0,
        life: 0.6,
      });
      F.decor[k] = pick;
      // One free (reward) decoration places once.
      if (!F.decorCredits[pick] && F.leaves < d.price * 2) F.decorPick = null;
    }
    if (sheet === "decor") renderSheet();
  }
  /** Gifts the dogs dug up since this device last showed them. */
  function announceGifts() {
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(GIFT_KEY)) || 0;
    } catch {}
    const since = seen || serverNow() - 86400e3,
      fresh = F.gifts.filter((g) => Date.parse(g.at) > since).reverse();
    for (const g of fresh) {
      const what =
        g.kind === "seeds"
          ? `${g.qty} ${CROP[g.crop]?.n ?? g.crop} seeds`
          : g.kind === "leaves"
            ? `${g.qty} Gold Leaves`
            : "a Super Fertilizer";
      log(`<b>${DOG[g.dog]?.name ?? "Your dog"}</b> dug up ${what}!`, "good");
      if (g === fresh[fresh.length - 1]) {
        toast(`${DOG[g.dog]?.name ?? "Your dog"} dug up ${what}!`);
        if (dogOn()) dogBark("Woof!");
      }
    }
    if (F.gifts.length)
      try {
        localStorage.setItem(
          GIFT_KEY,
          String(Math.max(seen, ...F.gifts.map((g) => Date.parse(g.at)))),
        );
      } catch {}
  }
  /** Catch bugs: one by hand, one on each plot of a 3×3 with the Big Net (+1 XP each). */
  function catchAt(i, net = false) {
    const ids = area(i, net && F.net === 2 ? 3 : 1).filter(
      (j) => F.plots[j].pests > 0,
    );
    if (!ids.length) return false;
    act(net ? { a: "catch", plot: i, tool: "net" } : { a: "catch", plot: i });
    for (const j of ids) {
      const r = plotRect(j);
      FX.push({ poof: 1, x: r.x + PW / 2, y: r.y + PH / 2, t: 0, life: 0.5 });
      float(r.x + PW / 2, r.y, "+1 XP", "#7ff0a2");
    }
    return true;
  }
  /** A giant crop (migration 050): the whole of it, into the barn at once. */
  function harvestGiant(gi, silent, checked = false) {
    const c = CROP[gi.crop],
      n = giantYield(yieldN());
    if (!checked && barnUsed() + n > F.barnCap) {
      if (!silent)
        toast(`Your barn is full! This giant needs room for ${n} crops.`);
      return false;
    }
    const b = giantBox(gi);
    fly(b.cx, b.y0 + 60, icon(c.id), `+${n}`);
    float(b.cx, b.y0 - 6, `+${giantXp(c.xp)} XP`, "#7ff0a2");
    FX.push({ puff: 1, x: b.cx, y: b.y0 + 120, t: 0, life: 0.8 });
    act({ a: "harvest-giant", plot: gi.i });
    return true;
  }
  /**
   * The Sickle: every ripe plot of the 3×3 in one go. A giant it touches is
   * harvested whole, first; then the other ripe plots one by one, so a giant
   * that can't be harvested (a full barn) is never cut up plot by plot.
   */
  function sickleAt(i) {
    const reach = area(i, 3),
      giants = [...new Set(reach.map((j) => F.giantAt[j]).filter(Boolean))],
      ripe = reach.filter((j) => {
        const q = F.plots[j];
        return (
          !F.giantAt[j] &&
          !F.pending.has(j) &&
          !q.locked &&
          q.crop &&
          q.prog >= 1
        );
      });
    if (!ripe.length && !giants.length) {
      if (!dragging && reach.some((j) => F.pending.has(j)))
        toast("Something big is growing here…");
      return false;
    }
    const need =
      giants.length * giantYield(yieldN()) + (ripe.length ? yieldN() : 0);
    if (barnUsed() + need > F.barnCap) {
      toast(
        giants.length
          ? `Your barn is full! This giant needs room for ${giantYield(yieldN())} crops.`
          : "Your barn is full! Sell something or upgrade the barn.",
      );
      return false;
    }
    for (const gi of giants) harvestGiant(gi, true, true);
    for (const j of ripe) {
      const c = CROP[F.plots[j].crop],
        r = plotRect(j);
      fly(r.x + PW / 2, r.y + 10, icon(c.id), `+${yieldN()}`);
      float(r.x + PW / 2, r.y - 30, `+${c.xp} XP`, "#7ff0a2");
    }
    if (!giants.length) act({ a: "harvest", plot: i, tool: "sickle" });
    else for (const j of ripe) act({ a: "harvest", plot: j });
    return true;
  }
  function useTool(i, drag = false) {
    if (V) return visitTool(i, drag);
    const p = F.plots[i];
    if (!p || !F.loaded) return;
    if (p.locked) {
      if (!drag) landClick(i);
      return;
    }
    const r = plotRect(i),
      cx = r.x + PW / 2;
    // A crow on the plot: any tap shoos it first.
    if (p.crowAt) {
      shooAt(i);
      return;
    }
    // A giant crop (migration 050): the hand and the seed bag harvest all of
    // it (a bug on its plot is caught first); the shovel leaves it.
    const gi = F.giantAt[i];
    if (gi && ["hand", "seed", "shovel"].includes(F.tool)) {
      if (F.tool === "hand" && p.pests) catchAt(i);
      else if (F.tool === "shovel") {
        if (!drag) toast("Harvest the giant crop first");
      } else harvestGiant(gi, F.tool === "seed" && drag);
      renderChips();
      renderTools();
      return;
    }
    switch (F.tool) {
      case "hand":
        if (p.pests) {
          catchAt(i);
          break;
        }
        if (p.crop && p.prog >= 1) {
          harvestAt(i);
          break;
        }
        if (!p.crop && !drag) seedPop(i);
        break;
      case "seed":
        if (!p.crop) plantAt(i, F.seed);
        else if (p.prog >= 1) harvestAt(i, true);
        break;
      case "can": {
        const dry = area(i, F.can).filter((j) => {
          const q = F.plots[j];
          return !q.locked && q.crop && q.prog < 1 && !q.wet;
        });
        if (!dry.length) break;
        act({ a: "water", plot: i });
        for (const j of dry) {
          const rr = plotRect(j);
          FX.push({
            drops: 1,
            x: rr.x + PW / 2,
            y: rr.y + PH / 2,
            t: 0,
            life: 0.7,
          });
        }
        break;
      }
      case "net":
        catchAt(i, true);
        break;
      case "sickle":
        sickleAt(i);
        break;
      case "fert": {
        if (!p.crop || p.prog >= 1) break;
        const f = F.fert;
        if (f === "super" && F.lv < 6) {
          toast("Super Fertilizer unlocks at farm level 6");
          break;
        }
        if (f === "gold" && F.lv < 24) {
          toast("Gold Fertilizer unlocks at farm level 24");
          break;
        }
        if (!F.ferts[f]) {
          toast("Out of that fertilizer. Buy more in Shop → Tools.");
          break;
        }
        if (p.fert && f !== "super") {
          if (!drag) toast("This plot is already fertilized");
          break;
        }
        act({ a: "fertilize", plot: i, kind: f });
        float(
          cx,
          r.y,
          f === "gold"
            ? "Gold fertilizer!"
            : f === "super"
              ? "+50%"
              : "Fertilized",
          "#d8ff8a",
        );
        break;
      }
      case "shovel":
        if (!p.crop || drag) break;
        if (F.shovelArm === i) {
          act({ a: "dig", plot: i });
          F.shovelArm = null;
          float(cx, r.y, "Dug up", "#ff9b9b");
        } else {
          F.shovelArm = i;
          toast("Tap again to dig up this crop");
          setTimeout(() => {
            if (F.shovelArm === i) F.shovelArm = null;
          }, 1800);
        }
        break;
    }
    renderChips();
    renderTools();
  }
  function seedPop(i) {
    const r = plotRect(i),
      o = hudOff(),
      sp0 = toScreen(r.x + PW / 2, r.y),
      sp = { x: sp0.x - o.x, y: sp0.y - o.y },
      pop = $("fm-pop");
    pop.hidden = false;
    pop.classList.add("seedpick");
    const have = PCROPS.filter((c) => F.seeds[c.id]),
      buy = PCROPS.filter(
        (c) => !F.seeds[c.id] && c.lv <= F.lv && (F.shop.stock[c.id] ?? 0) > 0,
      ).slice(0, 4);
    const card = (c, mine) =>
      `<button type="button" class="opt sp r-${c.rar}${mine ? "" : " spbuy"}" ${mine ? `data-pseed="${c.id}"` : `data-pbuy="${c.id}"`} ${!mine && F.leaves < c.cost ? "disabled" : ""} title="${c.n}"><b>${mine ? `×${F.seeds[c.id]}` : `${c.cost}${L}`}</b><img src="${icon(c.id)}" alt=""><span>${c.n}</span><small>${I("clock")}${fmtSecs(c.t)} · ${c.sell}${L}</small></button>`;
    pop.innerHTML = `<h6>What should grow here?</h6>${have.length ? `<div class="grid">${have.map((c) => card(c, true)).join("")}</div>` : `<p class="sh-note" style="margin:2px 4px 6px">Your seed bag is empty.</p>`}${buy.length ? `<h6 style="margin-top:8px">Quick buy 1 seed</h6><div class="grid">${buy.map((c) => card(c, false)).join("")}</div>` : ""}<p class="sh-note sp-tip">Tip: after picking a seed, <b>drag</b> across empty plots to sow them all.</p>`;
    const pw = Math.min(320, o.w - 16);
    pop.style.width = `${pw}px`;
    pop.style.left = `${Math.max(8, Math.min(o.w - pw - 8, sp.x - pw / 2))}px`;
    const top = sp.y - pop.offsetHeight - 14;
    pop.style.top = `${top < 60 ? Math.min(o.h - pop.offsetHeight - 8, sp.y + PH * Z * K + 10) : top}px`;
    pop.onclick = (e) => {
      const b = e.target.closest("[data-pseed]"),
        q = e.target.closest("[data-pbuy]");
      const id = b?.dataset.pseed || q?.dataset.pbuy;
      if (!id) return;
      if (q) act({ a: "buy-seeds", crop: id, qty: 1 });
      F.seed = id;
      F.tool = "seed";
      plantAt(i, id);
      pop.hidden = true;
      pop.classList.remove("seedpick");
      renderTools();
      screen.focus({ preventScroll: true });
      toast(`Planting ${CROP[id].n} · drag over empty plots to keep sowing`);
    };
  }
  function landClick(i) {
    if (!buyable(i))
      return toast("You can only buy plots next to land you own");
    const k = F.land,
      price = landPrice(k),
      lvReq = landLv(k),
      ok = F.lv >= lvReq,
      rich = F.leaves >= price,
      m = $("fm-modal");
    if (k >= 35) return toast("You own every plot");
    m.hidden = false;
    m.innerHTML = `<div class="deed"><div class="deed-top">Land deed</div><h5>Buy this plot</h5><div class="deed-plot">${I("sign", "big")}</div><div class="deed-rows"><span>Price</span><b>${price} ${L}</b><span>Requires</span><b class="${ok ? "" : "bad"}">Lv ${lvReq}${ok ? " ✓" : ` (you: Lv ${F.lv})`}</b><span>Your land</span><b>${15 + k} → ${16 + k} plots</b>${k < 34 ? `<span>Next plot</span><b>${landPrice(k + 1)} ${L} · Lv ${landLv(k + 1)}</b>` : ""}</div><div class="deed-acts"><button type="button" class="btn-s ghost" data-deedno>Not now</button><button type="button" class="btn-s" data-deedyes ${ok && rich ? "" : "disabled"}>${!ok ? `Needs Lv ${lvReq}` : !rich ? `Need ${price - F.leaves} more ${L}` : `Buy · ${price} ${L}`}</button></div></div>`;
    m.querySelector("[data-deedno]").onclick = () => {
      m.hidden = true;
    };
    m.querySelector("[data-deedyes]").onclick = () => {
      m.hidden = true;
      act({ a: "buy-land", plot: i }, true);
      const r = plotRect(i);
      for (let a = 0; a < 3; a++)
        FX.push({
          puff: 1,
          x: r.x + 20 + a * 28,
          y: r.y + PH / 2,
          t: a * 0.1,
          life: 0.7,
        });
      float(r.x + PW / 2, r.y, "New land!", "#7ff0a2");
    };
  }
  function levelUp(from, to) {
    const crops = PCROPS.filter((c) => c.lv > from && c.lv <= to),
      tools = [
        ...FARM_UNLOCKS.filter(([l]) => l > from && l <= to).map(([, n]) => n),
        ...FARM_DOGS.filter((d) => d.level > from && d.level <= to).map(
          (d) => `Guard dog: ${d.name}`,
        ),
        ...FARM_DECOR.filter((d) => d.level > from && d.level <= to).map(
          (d) => `Decor: ${d.name}`,
        ),
      ];
    let leaves = 0;
    for (let l = from + 1; l <= to; l++) leaves += farmLevelLeaves(l);
    const packs = [];
    for (let l = from + 1; l <= to; l++) {
      if (l % 5 === 0) packs.push("Fertilizer ×3 + Super ×1");
      if (l % 10 === 0) packs.push("Gold Fertilizer");
      if (l % 25 === 0)
        packs.push(
          `Title: ${{ 25: "Green Thumb", 50: "Master Grower", 75: "Harvest Legend", 100: "Elemental Farmer" }[l]}`,
        );
    }
    const land = LAND_LEVEL.some((l) => l > from && l <= to);
    const m = $("fm-modal");
    m.hidden = false;
    m.innerHTML = `<div class="lvcard"><div class="rays"></div><div class="big">${to}</div><h5>Farm level up!</h5><div class="unl">${crops.map((c) => `<span><img src="${icon(c.id)}" alt="">${c.n}</span>`).join("")}${[...tools, ...packs].map((n) => `<span>${I("lock")} ${esc(n)}</span>`).join("")}<span>${L} +${leaves}</span>${land ? `<span>${I("sign")} More land for sale</span>` : ""}</div>${to >= 100 ? `<p class="lv-max">Max farm level!</p>` : ""}<button type="button" data-lvok>Awesome!</button></div>`;
    m.querySelector("[data-lvok]").onclick = () => {
      m.hidden = true;
    };
    log(
      `Level <b>${to}</b>! ${crops.length ? `Unlocked ${crops.map((c) => c.n).join(", ")}` : "New rewards"}`,
      "good",
    );
  }

  /* ---------- draw ---------- */
  function draw(time) {
    const s = cur();
    ctx.setTransform(PS, 0, 0, PS, 0, 0);
    ctx.fillStyle = "#2f5a26";
    ctx.fillRect(0, 0, NW, NH);
    ctx.save();
    ctx.translate(OFX, OFY);
    ctx.scale(K, K);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();
    ctx.translate(VW / 2, VH / 2);
    ctx.scale(Z, Z);
    ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(bg, WX0, WY0);
    [
      [338, 230, "apple", 0.62],
      [812, 190, "cherry", 0.6],
      [44, 400, "pine", 0.85],
      [1480, 340, "round", 0.7],
      [1700, 330, "pine", 0.8],
      [70, 210, "round", 0.7],
      [640, 1050, "autumn", 0.7],
      [1120, 1060, "round", 0.75],
      [1450, 1040, "cherry", 0.65],
      [1720, 1000, "pine", 0.8],
      [40, 1060, "mint", 0.7],
    ].forEach(([x, y, k, sz], i) =>
      GFX.drawTree(ctx, GFX.tree(k, 50 + i, sz), x, y, time, i, 0.7),
    );
    GFX.shadow(ctx, HOUSE.x + 30, HOUSE.y + 4, 110, 20);
    const hs = GFX.house({
      wall: "#fff3dd",
      roof: "#d9473f",
      shutters: "#4fae46",
      w: 150,
      sd: 9,
      sign: { t: "HOME", bg: "#7a3a1a" },
    });
    GFX.blit(ctx, hs, HOUSE.x, HOUSE.y);
    const wm = GFX.windmillBody();
    GFX.shadow(ctx, MILL.x + 20, MILL.y + 4, 60, 14);
    GFX.blit(ctx, wm, MILL.x, MILL.y);
    GFX.windmillSails(
      ctx,
      MILL.x + wm.hub[0],
      MILL.y + wm.hub[1],
      reduced ? 0 : time * 0.7,
      0.82,
    );
    GFX.shadow(ctx, BOARDP.x + 8, BOARDP.y + 3, 70, 14);
    GFX.blit(ctx, GFX.board(), BOARDP.x, BOARDP.y);
    GFX.shadow(ctx, STALL.x + 10, STALL.y + 4, 96, 16);
    GFX.blit(ctx, GFX.stall(), STALL.x, STALL.y);
    GFX.shadow(ctx, BARN.x + 20, BARN.y + 4, 130, 22);
    GFX.blit(ctx, GFX.barn(), BARN.x, BARN.y);
    FSMOKE.forEach((m) => {
      ctx.fillStyle = `rgba(240,240,245,${0.5 * (1 - m.t / m.life)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6 + m.t * 7, 0, 7);
      ctx.fill();
    });
    nameTag(ctx, "MARKET", STALL.x, STALL.y - 178);
    nameTag(ctx, "BARN", BARN.x + 10, BARN.y - 214);
    nameTag(
      ctx,
      F.wishReady ? "WISHING WELL ✦" : "WISHING WELL",
      WELL.x,
      WELL.y - 140,
    );
    drawFence(ctx);
    drawPastureFence(ctx, true);
    s.plots.forEach((p, i) => drawPlot(ctx, i, p, time, s));
    drawArea(ctx);
    const items = [];
    MARGIN.forEach((m) =>
      items.push({
        y: m.y,
        d: () => {
          if (m.t) GFX.drawTree(ctx, m.t, m.x, m.y, time, m.ph, 0.8);
          else {
            GFX.shadow(ctx, m.x + 6, m.y + 2, 30, 8);
            GFX.blit(ctx, m.b, m.x, m.y + 4);
          }
        },
      }),
    );
    items.push({
      y: -40,
      d: () => GFX.blit(ctx, GFX.sign("← PLAZA", "#2a6fd0"), HOUSE.x + 70, -40),
    });
    s.plots.forEach((p, i) => {
      if (s.giantAt?.[i]) return;
      items.push({
        y: plotRect(i).y + PH * 0.72,
        d: () => drawPlotCrop(ctx, i, p, time),
      });
    });
    // Giant crops (migration 050): one picture each, at the depth of their
    // square's bottom row, just after the crops beside it.
    for (const gi of s.giants ?? [])
      items.push({
        y: plotRect(gi.i + 2 * COLS).y + PH * 0.72 + 0.5,
        d: () => drawGiant(ctx, gi, s, time),
      });
    // The dog on guard waits by its doghouse (walking about comes with the art pass).
    if (!s.me && V?.dog)
      items.push({
        y: DOGH.y + 14,
        d: () =>
          GFX.dog(ctx, V.dog, "sit", time, DOGH.x - 90, DOGH.y + 14, 0.95, 1),
      });
    if (s.me && dogOn()) {
      // With reduced motion the dog stays by its doghouse.
      const still = reduced,
        st = still
          ? time % 23 < 1.2
            ? "bark"
            : "sit"
          : dog.barkT > 0
            ? "bark"
            : dog.wait <= 0 && dog.moving
              ? dog.chasing
                ? "run"
                : "walk"
              : dog.wait > 2
                ? "sit"
                : "idle",
        x = still ? DOGH.x - 90 : dog.x,
        y = still ? DOGH.y + 14 : dog.y;
      items.push({
        y,
        d: () =>
          GFX.dog(ctx, F.dog.type, st, time, x, y, 0.95, still ? 1 : dog.face, {
            pant: st === "idle",
          }),
      });
    }
    // Decorations in their spots; in placing mode the spots glow.
    if (s.me) {
      F.decor.forEach((d, k) => {
        if (d)
          items.push({
            y: DECO_SLOTS[k][1],
            d: () =>
              drawDecor(ctx, d, DECO_SLOTS[k][0], DECO_SLOTS[k][1], time),
          });
      });
      if (F.decorPick)
        DECO_SLOTS.forEach(([x, y], k) =>
          items.push({
            y: y - 1,
            d: () => {
              ctx.strokeStyle = F.decor[k] ? "rgba(255,214,91,.6)" : "#ffd65b";
              ctx.setLineDash([6, 5]);
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.ellipse(x, y, 40, 16, 0, 0, 7);
              ctx.stroke();
              ctx.setLineDash([]);
            },
          }),
        );
    }
    // Tools you own stand on the farm: the Scarecrow left of the field, a
    // sprinkler at the right end of each row that has one.
    if (s.me && F.scarecrow)
      items.push({
        y: 560,
        d: () => {
          GFX.shadow(ctx, 292, 562, 26, 6);
          GFX.blit(ctx, GFX.scarecrow(), 288, 562);
        },
      });
    if (s.me)
      for (let r = 0; r < Math.min(F.sprinklers, ROWS); r++) {
        const y = OY + r * (PH + GAP) + PH / 2,
          sx = OX + FW + 12;
        items.push({
          y,
          d: () => {
            ctx.fillStyle = "#8a93a6";
            ctx.beginPath();
            ctx.roundRect(sx - 4, y - 8, 9, 20, 3);
            ctx.fill();
            ctx.fillStyle = "#4fb3ff";
            ctx.beginPath();
            ctx.arc(sx, y - 9, 4, 0, 7);
            ctx.fill();
            ctx.fillStyle = "rgba(160,220,255,.7)";
            for (let k = 0; k < 7; k++) {
              const a = time * 4 + k;
              ctx.beginPath();
              ctx.arc(
                sx - 8 - ((k * 12 + time * 34) % 70),
                y - 12 - Math.sin(a) * 7,
                2,
                0,
                7,
              );
              ctx.fill();
            }
          },
        });
      }
    items.push({
      y: WELL.y,
      d: () => {
        GFX.shadow(ctx, WELL.x + 8, WELL.y + 2, 56, 12);
        GFX.blit(ctx, GFX.well(), WELL.x, WELL.y);
      },
    });
    items.push({
      y: HOUSE.y + 8,
      d: () => GFX.cat(ctx, "sleep", time, HOUSE.x - 40, HOUSE.y + 8, 1.1, 1),
    });
    items.push({
      y: POND.y - POND.ry,
      d: () => {
        const { x, y, rx, ry } = POND;
        const wg = ctx.createRadialGradient(x - 30, y - 20, 8, x, y, rx);
        wg.addColorStop(0, "#7fe0f0");
        wg.addColorStop(1, "#2a92c0");
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.3)";
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.ellipse(
            x + Math.sin(time * 0.6 + k) * 30,
            y + Math.cos(time * 0.5 + k * 2) * 12,
            18 + k * 6,
            4 + k,
            0,
            0,
            7,
          );
          ctx.stroke();
        }
      },
    });
    if (s.pasture)
      items.push({
        y: COW.y,
        d: () => {
          const ready = s.me && milkReady();
          GFX.cow(
            ctx,
            ready ? "idle" : "graze",
            time,
            COW.x,
            COW.y,
            0.95,
            COW.face,
          );
          if (!ready) return;
          // A speech bubble with a milk bottle: tap the cow.
          const by = COW.y - 82 + (reduced ? 0 : Math.sin(time * 3) * 3);
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.roundRect(COW.x - 22, by - 22, 44, 32, 12);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(COW.x - 5, by + 9);
          ctx.lineTo(COW.x + 5, by + 9);
          ctx.lineTo(COW.x, by + 16);
          ctx.fill();
          if (ITEM.milk.complete)
            ctx.drawImage(ITEM.milk, COW.x - 11, by - 17, 22, 22);
        },
      });
    else
      items.push({
        y: 570,
        d: () => {
          GFX.blit(ctx, GFX.rock(61, 40), 1530, 610);
          GFX.blit(ctx, GFX.bush("green", 62, 56), 1680, 640);
          if (s.me)
            GFX.blit(
              ctx,
              GFX.sign(
                F.lv >= PASTURE.level
                  ? `PASTURE · ${PASTURE.price}`
                  : `PASTURE · Lv ${PASTURE.level}`,
                "#c0392b",
              ),
              1600,
              570,
            );
        },
      });
    items.push({ y: PAST.y1, d: () => drawPastureFence(ctx, false) });
    items.push({
      y: DOGH.y,
      d: () => {
        GFX.shadow(ctx, DOGH.x + 10, DOGH.y + 2, 76, 14);
        GFX.blit(ctx, GFX.doghouse(), DOGH.x, DOGH.y);
      },
    });
    hens.forEach((h) =>
      items.push({
        y: h.y,
        d: () =>
          GFX.chicken(ctx, h.k, h.st, time + h.x * 0.01, h.x, h.y, 1.1, h.face),
      }),
    );
    fenceItems(items);
    items.sort((a, b) => a.y - b.y).forEach((it) => it.d());
    // Crows: fly in, then peck with a bar showing the time left to shoo them.
    if (s.me) {
      const sn = serverNow();
      F.plots.forEach((p, i) => {
        if (!p.crowAt) return;
        const r = plotRect(i),
          tx = r.x + PW / 2,
          ty = r.y + 20,
          age = (sn - p.crowAt) / 1000;
        if (age < 1) {
          const k = Math.max(0, age);
          GFX.bird(
            ctx,
            "crow",
            "fly",
            time,
            tx - 300 * (1 - k),
            ty - 240 * (1 - k),
            1.6,
            -1,
          );
          return;
        }
        GFX.bird(ctx, "crow", "peck", time, tx, ty + 10, 1.5, -1);
        ctx.fillStyle = "rgba(0,0,0,.5)";
        ctx.beginPath();
        ctx.roundRect(tx - 20, ty - 22, 40, 6, 3);
        ctx.fill();
        ctx.fillStyle = "#ef4f61";
        ctx.beginPath();
        ctx.roundRect(
          tx - 20,
          ty - 22,
          40 * Math.min(1, age / CROW_SECONDS),
          6,
          3,
        );
        ctx.fill();
      });
      // A crow the dog is about to chase off: flies in, lands, no time bar.
      for (const c of decoys) {
        const r = plotRect(c.i),
          tx = r.x + PW / 2,
          ty = r.y + 20;
        if (c.t < 1)
          GFX.bird(
            ctx,
            "crow",
            "fly",
            time,
            tx - 300 * (1 - c.t),
            ty - 240 * (1 - c.t),
            1.6,
            -1,
          );
        else GFX.bird(ctx, "crow", "peck", time, tx, ty + 10, 1.5, -1);
      }
      for (const c of crowsLeaving)
        GFX.bird(
          ctx,
          "crow",
          "fly",
          time,
          c.x + 360 * c.t,
          c.y - 200 * c.t,
          1.6,
          1,
        );
    }
    if (!reduced)
      BUTTER.forEach((b) =>
        GFX.butterfly(
          ctx,
          time + b.ph,
          b.hx + Math.sin(time * 0.7 + b.ph) * 50,
          b.hy + Math.cos(time * 0.9 + b.ph) * 22,
          b.c,
          1.2,
        ),
      );
    for (const f of FX) {
      const k = f.t / f.life;
      if (f.bark) {
        // A speech bubble; one that follows the dog moves with it.
        if (f.follow && dogOn() && !V && !reduced) {
          f.x = dog.x;
          f.y = dog.y - 40;
        }
        ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(f.x - 40, f.y - 50, 80, 30, 12);
        ctx.moveTo(f.x - 7, f.y - 21);
        ctx.lineTo(f.x + 1, f.y - 9);
        ctx.lineTo(f.x + 8, f.y - 21);
        ctx.fill();
        ctx.fillStyle = "#2a1a00";
        ctx.font = "800 18px 'Barlow Condensed', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(f.text || "WOOF!", f.x, f.y - 35);
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = 1;
      } else if (f.text) {
        ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
        ctx.font = "800 20px 'Barlow Condensed', sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#0b1020";
        ctx.strokeText(f.text, f.x, f.y - k * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - k * 40);
        ctx.globalAlpha = 1;
      } else if (f.fly) {
        const tx = BARN.x,
          ty = BARN.y - 120,
          e = k * k,
          x = f.x + (tx - f.x) * e,
          y = f.y + (ty - f.y) * e - Math.sin(k * Math.PI) * 80;
        if (!f.im) {
          f.im = new Image();
          f.im.src = f.img;
        }
        if (f.im.complete) ctx.drawImage(f.im, x - 22, y - 26, 44, 51);
        if (k < 0.5) {
          ctx.font = "800 18px 'Barlow Condensed', sans-serif";
          ctx.fillStyle = "#ffd65b";
          ctx.textAlign = "center";
          ctx.fillText(f.label, x + 26, y - 18);
        }
      } else if (f.puff || f.poof) {
        ctx.fillStyle = f.poof
          ? `rgba(160,120,255,${1 - k})`
          : `rgba(210,170,120,${1 - k})`;
        for (let a = 0; a < 6; a++) {
          ctx.beginPath();
          ctx.arc(
            f.x + Math.cos(a) * k * 30,
            f.y + Math.sin(a) * k * 14,
            6 * (1 - k) + 2,
            0,
            7,
          );
          ctx.fill();
        }
      } else if (f.drops) {
        ctx.fillStyle = `rgba(120,200,255,${1 - k})`;
        for (let a = 0; a < 7; a++) {
          ctx.beginPath();
          ctx.ellipse(
            f.x - 30 + a * 10,
            f.y - 30 + k * 40 + (a % 2) * 8,
            2.5,
            5,
            0,
            0,
            7,
          );
          ctx.fill();
        }
      }
    }
    ctx.restore();
    drawWeather(ctx, time);
    drawToolCursor(ctx, time);
    drawHoldRing(ctx);
    ctx.restore();
  }

  /* ---------- loop: the farm's time is the server's clock ---------- */
  const reduced = !!options.reduced;
  /** Low graphics (slow phones, as in the Plaza): 30 fps, a 1× canvas, no
   *  hens, ducks or butterflies, lighter rain. Auto measures the frame rate
   *  for a few seconds and switches to Low (remembered) when it's too slow. */
  let low = !!options.low;
  layer.dataset.graphics = low ? "low" : "high";
  layer.dataset.frozen = "false";
  let probe =
    graphicsSetting() === "auto" && !low ? new FrameRateProbe() : undefined;
  function goLow() {
    low = true;
    layer.dataset.graphics = "low";
    for (const list of [hens, FDUCKS, BUTTER]) list.length = 0;
    onResize();
  }
  // Opening at Low: no ambient animals (the canvas is sized 1× when it opens).
  if (low) for (const list of [hens, FDUCKS, BUTTER]) list.length = 0;
  /* A dialog or drawer (Settings, the Shop, Missions) fills the screen: stop
     drawing behind it and wake when it closes. Looked up once per DOM change. */
  let cover;
  const COVERS = "dialog, .home-drawer";
  const covered = () =>
    (cover ??= !!document.querySelector(
      "dialog[open], .home-drawer:not([hidden])",
    ));
  let frozen = false,
    coveredAt;
  function freeze() {
    frozen = true;
    layer.dataset.frozen = "true";
    cancelAnimationFrame(raf);
    probe?.pause();
  }
  function wake() {
    if (!frozen || !running || covered() || document.hidden) return;
    frozen = false;
    layer.dataset.frozen = "false";
    last = performance.now();
    raf = requestAnimationFrame(step);
  }
  const coverWatch = new MutationObserver((records) => {
    for (const r of records) {
      const hit =
        r.type === "attributes"
          ? r.target instanceof Element && r.target.matches(COVERS)
          : [...r.addedNodes, ...r.removedNodes].some(
              (n) =>
                n instanceof Element &&
                (n.matches(COVERS) || n.querySelector(COVERS)),
            );
      if (hit) {
        cover = undefined;
        if (frozen) wake();
        return;
      }
    }
  });
  coverWatch.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["open", "hidden"],
  });
  // Safety net: while asleep, look again each second without the cache.
  const thawCheck = setInterval(() => {
    if (!frozen) return;
    cover = undefined;
    wake();
  }, 1000);
  let crowAsked = 0,
    lastDraw = 0;
  let pendingT = 0,
    pendingAsked = 0;
  function step(now) {
    raf = requestAnimationFrame(step);
    if (low && now - lastDraw < 30) return;
    lastDraw = now;
    if (probe) {
      if (document.hidden || covered()) probe.pause();
      else {
        const verdict = probe.frame(performance.now());
        if (verdict === "low") {
          probe = undefined;
          rememberAutoLow();
          goLow();
        } else if (verdict === "ok")
          // Keep watching: a busier farm later can still be too much.
          probe = new FrameRateProbe(0);
      }
    }
    if (covered()) {
      coveredAt ??= now;
      if (now - coveredAt > 300 && !dragging) {
        coveredAt = undefined;
        freeze();
        return;
      }
    } else coveredAt = undefined;
    // Never negative: the first frame can be stamped before enter() ran.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    T = now / 1000;
    if (!inited) return;
    const sn = serverNow();
    for (const p of F.plots) if (p.crop) p.prog = growth(p, sn);
    if (V) for (const p of V.plots) if (p.crop) p.prog = growth(p, sn);
    for (let k = crowsLeaving.length - 1; k >= 0; k--)
      if ((crowsLeaving[k].t += dt) > 1.2) crowsLeaving.splice(k, 1);
    // A square of ripe giant crops: ask the server whether it grew giant
    // before any of it can be harvested (migration 050).
    if (!V && T - pendingT > 0.25) {
      pendingT = T;
      updatePending();
      if (
        F.pending.size &&
        sn - pendingAsked > 1500 &&
        !queue.length &&
        !sending
      ) {
        pendingAsked = sn;
        void refresh();
      }
    }
    // A crow nobody shooed: ask the server once its time (and allowance) is up.
    if (
      F.plots.some(
        (p) => p.crowAt && sn - p.crowAt > (CROW_SECONDS + 2.5) * 1000,
      ) &&
      sn - crowAsked > 5000 &&
      !queue.length &&
      !sending
    ) {
      crowAsked = sn;
      void refresh();
    }
    if (keysF.size) {
      const sp = (600 * dt) / Z;
      if (keysF.has("a") || keysF.has("arrowleft")) cam.x -= sp;
      if (keysF.has("d") || keysF.has("arrowright")) cam.x += sp;
      if (keysF.has("w") || keysF.has("arrowup")) cam.y -= sp;
      if (keysF.has("s") || keysF.has("arrowdown")) cam.y += sp;
      clampCam();
    }
    // The guard dog (your farm only; a friend's dog waits by its doghouse).
    if (dogOn() && !V && !reduced) {
      // Now and then a crow comes for a ripe crop; the dog chases it off.
      decoyIn -= dt;
      if (decoyIn <= 0) {
        decoyIn = 120 + Math.random() * 180;
        const ripe = [];
        F.plots.forEach((p, i) => {
          if (p.crop && p.prog >= 1 && !p.crowAt && !F.giantAt[i]) ripe.push(i);
        });
        if (ripe.length && dog.chase == null && !decoys.length)
          decoys.push({
            i: ripe[Math.floor(Math.random() * ripe.length)],
            t: 0,
          });
      }
      for (let k = decoys.length - 1; k >= 0; k--) {
        const c = decoys[k];
        c.t += dt;
        if (c.t >= 1 && !c.barked) {
          c.barked = true;
          dog.chase = c.i;
          dogBark();
        }
        if (c.t >= 1.7) {
          const r = plotRect(c.i);
          crowsLeaving.push({ x: r.x + PW / 2, y: r.y + 20, t: 0 });
          decoys.splice(k, 1);
        }
      }
      if (dog.chase != null && !dog.chasing) {
        const r = plotRect(dog.chase);
        dog.chasing = true;
        dogTo(r.x + PW / 2, r.y + PH + 4, true);
      }
      if (dog.barkT > 0) dog.barkT -= dt;
      if (dog.wait > 0) {
        dog.wait -= dt;
        if (Math.random() < dt * 0.04) dog.barkT = 0.8;
      } else {
        if (!dog.path.length) {
          if (dog.chasing) {
            dog.chasing = false;
            dog.chase = null;
          }
          const [x, y] = dogIdleSpot();
          dogTo(x, y, false);
        }
        const [wx, wy] = dog.path[0],
          dx = wx - dog.x,
          dy = wy - dog.y,
          d = Math.hypot(dx, dy);
        if (d < 6) {
          dog.path.shift();
          if (!dog.path.length) {
            dog.wait = dog.chasing ? 0.8 : 2 + Math.random() * 5;
            dog.moving = false;
          }
        } else {
          const sp = dog.chasing ? 270 : 85;
          dog.x += (dx / d) * Math.min(d, sp * dt);
          dog.y += (dy / d) * Math.min(d, sp * dt);
          dog.face = dx > 0 ? 1 : -1;
        }
      }
    }
    if (cur().pasture && !reduced) {
      COW.t += dt;
      if (COW.t > 12) {
        COW.t = 0;
        COW.face *= -1;
      }
      COW.x = Math.max(
        PAST.x0 + 46,
        Math.min(PAST.x1 - 46, COW.x + COW.face * 6 * dt),
      );
    }
    if (!reduced)
      hens.forEach((h) => {
        if (h.wait > 0) {
          h.wait -= dt;
          if (h.wait <= 0) h.st = "idle";
          return;
        }
        if (h.tx == null) {
          if (Math.random() < 0.4) {
            h.st = "peck";
            h.wait = 1.4 + Math.random() * 2;
            return;
          }
          // A free spot they can walk to in a straight line (not the well or the pond).
          const w = pathWorld();
          let ok = false;
          for (let t = 0; t < 10 && !ok; t++) {
            h.tx = 30 + Math.random() * 540;
            h.ty = 790 + Math.random() * 120;
            ok =
              !pathBlocked(w, h.tx, h.ty) &&
              pathClear(w, [h.x, h.y], [h.tx, h.ty]);
          }
          if (!ok) {
            h.tx = h.x;
            h.ty = h.y;
          }
          h.st = "walk";
        }
        const dx = h.tx - h.x,
          dy = h.ty - h.y,
          d = Math.hypot(dx, dy);
        if (d < 4) {
          h.tx = null;
          h.st = "idle";
          h.wait = 1 + Math.random() * 3;
          return;
        }
        h.x += (dx / d) * Math.min(d, 40 * dt);
        h.y += (dy / d) * Math.min(d, 40 * dt);
        h.face = dx > 0 ? 1 : -1;
      });
    if (!reduced && Math.random() < dt * 2.5) {
      const hs = GFX.house({
        wall: "#fff3dd",
        roof: "#d9473f",
        shutters: "#4fae46",
        w: 150,
        sd: 9,
        sign: { t: "HOME", bg: "#7a3a1a" },
      });
      if (hs.chimney)
        FSMOKE.push({
          x: HOUSE.x + hs.chimney[0],
          y: HOUSE.y + hs.chimney[1],
          t: 0,
          life: 2.4,
          vx: 6 + Math.random() * 6,
        });
    }
    FSMOKE.forEach((m) => {
      m.t += dt;
      m.x += m.vx * dt;
      m.y -= 20 * dt;
    });
    for (let i = FSMOKE.length - 1; i >= 0; i--)
      if (FSMOKE[i].t > FSMOKE[i].life) FSMOKE.splice(i, 1);
    if (CUR.use > 0) CUR.use = Math.max(0, CUR.use - dt * 3.2);
    FX.forEach((f) => (f.t += dt));
    for (let i = FX.length - 1; i >= 0; i--)
      if (FX[i].t > FX[i].life) FX.splice(i, 1);
    draw(T);
    if (Math.floor(T * 4) !== Math.floor((T - dt) * 4)) {
      renderChips();
      if (sheet && ["shop", "market", "orders"].includes(sheet))
        updateSheetTimers();
      if (hoverI >= 0) showTip(hoverI);
    }
  }

  /* ---------- HUD ---------- */
  function renderBadge() {
    const p = F.lv >= 100 ? 100 : (F.xp / need(F.lv)) * 100;
    $("fm-badge").innerHTML =
      `<div class="fm-ring" style="--p:${p}"><b>${F.lv}</b></div><div><strong>${esc(options.playerName())}'s Farm</strong><small class="row2"><span>${F.lv >= 100 ? "Max level" : `${F.xp}/${need(F.lv)} XP`}</span></small><div class="xpbar"><i style="width:${p}%"></i></div></div>`;
  }
  const dogLeft = () => Math.max(0, (F.dog.until - serverNow()) / 1000),
    dogTotal = () => Math.max(1, (F.dog.until - F.dog.since) / 1000);
  const ringCol = (p) =>
    p > 0.5 ? "#7ff0a2" : p > 0.2 ? "#ffd65b" : "#ff6b5a";
  let orbOpen = null;
  /* status orbs: weather and barn. The ring shows what is left (or how full); tap for the details */
  let orbKey = "";
  const weatherLeft = () =>
    Math.max(0, ((F.weather.until ?? 0) - serverNow()) / 1000);
  function renderChips() {
    const used = barnUsed(),
      bp = Math.min(1, used / F.barnCap),
      wn = F.weather.cur ? FARM_WEATHER_BY_ID[F.weather.cur] : null,
      wp = Math.max(0, Math.min(1, weatherLeft() / FARM_WEATHER_SECONDS));
    const want = [
      wn && [
        "weather",
        "o-weather",
        wp,
        wn.color,
        `<span class="wx-ic">${I(wn.icon)}</span>`,
        `${wn.name}: ${wn.text}. Changes in ${fmtSecs(weatherLeft())}`,
      ],
      !V &&
        perk() && [
          "perk",
          `o-perk ${!perk().active ? "passive" : warmLeft() > 0 ? "on" : F.perksUsed.includes(perk().active) ? "used" : "ready"}`,
          warmLeft() > 0
            ? warmLeft() / 14400
            : perk().active && F.perksUsed.includes(perk().active)
              ? 0
              : 1,
          perk().active ? "#ffd65b" : "#8fa3d0",
          `<img src="${options.art(F.farmer)}" alt="">`,
          `${perk().name}: ${perk().text}`,
        ],
      !V && [
        "dog",
        `o-dog${dogOn() ? "" : " off"}`,
        dogOn() ? dogLeft() / dogTotal() : 0,
        dogOn() ? ringCol(dogLeft() / dogTotal()) : "#ff6b5a",
        I("dog"),
        dogOn()
          ? `${DOG[F.dog.type].name}: ${fmtDur(dogLeft())} left`
          : "No guard dog",
      ],
      [
        "barn",
        `o-barn${bp >= 0.9 ? " full" : ""}`,
        bp,
        bp >= 0.9 ? "#ff6b5a" : bp >= 0.75 ? "#ffd65b" : "#7ff0a2",
        I("barn"),
        `Barn ${used}/${F.barnCap}`,
      ],
    ].filter(Boolean);
    // Built once, then updated in place, so a tap never lands on a button that was just replaced.
    const box = $("fm-chips"),
      sig = want
        .map(
          (w) =>
            w[0] +
            (w[0] === "weather"
              ? F.weather.cur
              : w[0] === "perk"
                ? F.farmer
                : ""),
        )
        .join();
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.innerHTML = want
        .map(
          ([k, , , , inner]) =>
            `<button type="button" class="fm-orb" data-orb="${k}"><span class="ci">${inner}</span></button>`,
        )
        .join("");
    }
    want.forEach(([k, cls, p, col, , label]) => {
      const b = box.querySelector(`[data-orb="${k}"]`);
      b.className = `fm-orb ${cls}`;
      b.style.setProperty("--p", p.toFixed(3));
      b.style.setProperty("--rc", col);
      b.setAttribute("aria-expanded", String(orbOpen === k));
      if (b.title !== label) {
        b.title = label;
        b.setAttribute("aria-label", label);
      }
    });
    if (orbOpen) renderOrbPop();
    $("fm-ord-dot").hidden = !F.orders.some((o) => o.items && canFill(o));
    $("fm-wish-dot").hidden = !F.wishReady || !!V;
    syncMenuDot();
  }
  const canFill = (o) => o.items.every(([id, n]) => owned(id) >= n);
  const FERT_NAME = {
    norm: "Fertilizer",
    super: "Super Fertilizer",
    gold: "Gold Fertilizer",
  };
  function renderOrbPop() {
    const el = $("fm-orbpop"),
      k = orbOpen,
      btn = k && $("fm-chips").querySelector(`[data-orb="${k}"]`);
    if (!btn) {
      orbOpen = null;
      el.hidden = true;
      return;
    }
    let h = "";
    if (k === "weather") {
      const w = FARM_WEATHER_BY_ID[F.weather.cur],
        n = F.weather.next ? FARM_WEATHER_BY_ID[F.weather.next] : null,
        // The third forecast comes only with Mystowl's Foresight (migration 046).
        n2 = F.weather.next2 ? FARM_WEATHER_BY_ID[F.weather.next2] : null,
        p = Math.max(0, Math.min(1, weatherLeft() / FARM_WEATHER_SECONDS));
      h = `<div class="op-h">${I(w.icon)}<b>${w.name}</b><span class="op-tag">Now</span></div><p>${w.text}.</p><div class="op-big">${fmtSecs(weatherLeft())}<small>until it changes</small></div><div class="op-bar" style="--rc:${w.color}"><i style="width:${p * 100}%"></i></div>${n ? `<div class="op-next"><span>Next</span>${I(n.icon)}<b>${n.name}</b></div><p class="op-note">${n.text}.</p>` : ""}${n2 ? `<div class="op-next"><span>Then</span>${I(n2.icon)}<b>${n2.name}</b></div><p class="op-note">Foresight: ${n2.text}.</p>` : ""}`;
    } else if (k === "perk") {
      const pk = perk(),
        used = pk.active && F.perksUsed.includes(pk.active),
        warm = warmLeft() > 0;
      h = `<div class="op-h"><img src="${options.art(F.farmer)}" alt=""><b>${pk.name}</b><span class="op-tag">${!pk.active ? "Passive" : warm ? "Active" : used ? "Used today" : "Ready"}</span></div><p>${pk.text}.${pk.active ? " Once a day." : " Always on."}</p>${pk.active ? (warm ? `<div class="op-big">${fmtSecs(warmLeft())}<small>left</small></div>` : used ? `<p class="op-note">Back tomorrow.</p>` : `<button type="button" class="btn-s" data-perk>Use ${pk.name}</button>`) : ""}<p class="op-note">Your farmer is your Lobby fighter. Pick another fighter there for another perk.</p>`;
    } else if (k === "dog") {
      if (dogOn()) {
        const d = DOG[F.dog.type],
          p = Math.min(1, dogLeft() / dogTotal());
        h = `<div class="op-h">${I("dog")}<b>${d.name}</b><span class="op-tag">On guard</span></div><div class="op-big">${fmtDur(dogLeft())}<small>left of ${fmtDur(dogTotal())}</small></div><div class="op-bar" style="--rc:${ringCol(p)}"><i style="width:${p * 100}%"></i></div><p>${d.text}.</p><button type="button" class="btn-s" data-orbgo="dogs">Extend or change dog</button>`;
      } else
        h = `<div class="op-h">${I("dog")}<b>No guard dog</b><span class="op-tag warn">Unguarded</span></div><p>Crows can eat ripe crops while you are on the farm. Every dog keeps them away, and some dig up gifts.</p><button type="button" class="btn-s" data-orbgo="dogs">Hire a dog</button>`;
    } else {
      const u = barnUsed(),
        p = u / F.barnCap;
      h = `<div class="op-h">${I("barn")}<b>Barn</b><span class="op-tag${p >= 0.9 ? " warn" : ""}">${p >= 0.9 ? "Almost full" : "Storage"}</span></div><div class="op-big">${u}<small>/ ${F.barnCap} items</small></div><div class="op-bar" style="--rc:${p >= 0.9 ? "#ff6b5a" : p >= 0.75 ? "#ffd65b" : "#7ff0a2"}"><i style="width:${p * 100}%"></i></div><p>Harvests go here. Sell them at the market to make room.</p><button type="button" class="btn-s" data-orbgo="barn">Open barn</button>`;
    }
    // The card is built once; after that only the clock and the bar change.
    const key =
      k +
      "|" +
      h.replace(
        /<div class="op-big">.*?<\/div>|<i style="width:[^"]*"><\/i>|style="--rc:[^"]*"/g,
        "",
      );
    if (key !== orbKey || el.hidden) {
      el.innerHTML = h;
      orbKey = key;
    } else {
      const tmp = document.createElement("div");
      tmp.innerHTML = h;
      const nb = tmp.querySelector(".op-big"),
        ob = el.querySelector(".op-big");
      if (nb && ob && ob.innerHTML !== nb.innerHTML)
        ob.innerHTML = nb.innerHTML;
      const nr = tmp.querySelector(".op-bar"),
        or = el.querySelector(".op-bar");
      if (nr && or) {
        or.style.cssText = nr.style.cssText;
        or.firstElementChild.style.width = nr.firstElementChild.style.width;
      }
    }
    el.hidden = false;
    const hud = el.parentElement.getBoundingClientRect(),
      r = btn.getBoundingClientRect();
    el.style.top = `${r.bottom - hud.top + 10}px`;
    el.style.right = `${Math.max(8, hud.right - r.right - 6)}px`;
  }
  const TOOLS = () => (V ? VISIT_TOOLS() : HOME_TOOLS());
  const VISIT_TOOLS = () => [
    ["hand", "hand", "Sneak"],
    ["can", "can", "Water"],
    ["net", "net", "Catch"],
    ["prank", "bug", "Prank", Math.max(0, 3 - V.today.pranks)],
  ];
  const HOME_TOOLS = () => [
    ["hand", "hand", "Hand"],
    ["seed", "seed", "Seeds", F.seeds[F.seed] || 0],
    [
      "can",
      ["", "can", "can2", "can3"][F.can],
      "Can",
      null,
      ["", "Wood", "Copper", "Gold"][F.can],
    ],
    [
      "fert",
      F.fert === "gold"
        ? "fertGold"
        : F.fert === "super"
          ? "fertSuper"
          : "fert",
      "Fertilizer",
      F.ferts[F.fert],
    ],
    ["net", "net", F.net === 2 ? "Big Net" : "Net"],
    ...(F.sickle ? [["sickle", "sickle", "Sickle"]] : []),
    ["shovel", "shovel", "Shovel"],
  ];
  /** The Tools tab: [id, icon, name, text, price, level, owned, why not yet]. */
  function toolRows() {
    const has = {
        scarecrow: F.scarecrow,
        can2: F.can >= 2,
        net2: F.net >= 2,
        sickle: F.sickle,
        can3: F.can >= 3,
      },
      n = Math.min(F.sprinklers, 4);
    return [
      ...FARM_TOOLS.map((t) => [
        t.id,
        t.icon,
        t.name,
        t.text,
        t.price,
        t.level,
        has[t.id],
        t.id === "can3" && F.can < 2 ? "buy the Copper Can first" : "",
      ]),
      [
        "sprinkler",
        "sprinkler",
        `Sprinkler (${F.sprinklers}/5)`,
        F.sprinklers >= 5
          ? "Every row waters what you plant"
          : `Waters what you plant in row ${F.sprinklers + 1}`,
        SPRINKLER_PRICES[n],
        SPRINKLER_LEVELS[n],
        F.sprinklers >= 5,
        "",
      ],
    ];
  }
  function renderTools() {
    $("fm-tools").innerHTML = TOOLS()
      .map(
        ([id, ic, label, count, lvl], idx) =>
          `<button type="button" class="fm-tool" data-tool="${id}" aria-pressed="${F.tool === id}" title="${id === "seed" ? `${CROP[F.seed]?.n ?? "Seed"} seeds` : label} (key ${idx + 1})"><kbd>${idx + 1}</kbd>${count != null ? `<b>${count > 99 ? "99+" : count}</b>` : ""}${id === "seed" ? `<span class="seedico">${I("seed")}<img src="${icon(F.seed)}" alt=""></span>` : I(ic)}<span>${id === "seed" ? (CROP[F.seed]?.n ?? "Seeds").split(" ").pop() : label}</span>${lvl ? `<em>${lvl}</em>` : ""}</button>`,
      )
      .join("");
  }
  function showTip(i) {
    const p = cur().plots[i],
      tip = $("fm-tip");
    if (!p || p.locked || !p.crop) {
      tip.hidden = true;
      return;
    }
    const gi = cur().giantAt?.[i];
    if (gi) {
      // A giant crop (migration 050): what it gives and the mutations it holds.
      const c = CROP[gi.crop],
        b = giantBox(gi),
        o = hudOff(),
        sp0 = toScreen(b.x1, b.y0),
        sp = { x: sp0.x - o.x, y: sp0.y - o.y },
        count = {};
      for (const j of gi.plots)
        for (const m of cur().plots[j].mut) count[m] = (count[m] || 0) + 1;
      const muts = Object.entries(count)
        .map(([m, n]) => `${n} ${MUTS[m]?.n ?? m}`)
        .join(" · ");
      const left = V ? gi.plots.filter((j) => !V.stolen.has(j)).length : 0;
      tip.hidden = false;
      tip.innerHTML = `<b>Giant ${c.n}</b><div class="row"><span>Ready</span><span>${V ? "Sneak a crop" : "Harvest it all"}</span></div>${V ? `<div class="row"><span>Crops to try</span><span>${left} of 9</span></div>` : `<div class="row"><span>Harvest</span><span>${giantYield(yieldN())} crops</span></div><div class="row"><span>XP</span><span>+${giantXp(c.xp)}</span></div>`}${muts ? `<div class="row"><span>Mutations</span><span>${muts}</span></div>` : ""}`;
      tip.style.left = `${Math.min(o.w - 200, sp.x + 8)}px`;
      tip.style.top = `${Math.max(60, sp.y - 10)}px`;
      return;
    }
    const c = CROP[p.crop],
      r = plotRect(i),
      o = hudOff(),
      sp0 = toScreen(r.x + PW, r.y),
      sp = { x: sp0.x - o.x, y: sp0.y - o.y };
    const left = p.prog < 1 && p.ripeAt ? (p.ripeAt - serverNow()) / 1000 : 0;
    tip.hidden = false;
    tip.innerHTML = `<b>${c.n}</b><div class="bar"><i style="width:${p.prog * 100}%"></i></div><div class="row"><span>${p.prog >= 1 ? "Ready" : "Time left"}</span><span>${p.prog >= 1 ? (!V && F.pending.has(i) ? "Just a moment…" : "Harvest now") : fmtSecs(left)}</span></div><div class="row"><span>Water</span><span>${p.wet ? "watered" : "dry"}</span></div>${p.pests ? `<div class="row"><span>Bugs</span><span>${p.pests} · ${p.pests * 20}% slower</span></div>` : ""}${p.fert ? `<div class="row"><span>Fertilizer</span><span>${p.fert === "gold" ? "gold" : "regular"}</span></div>` : ""}`;
    tip.style.left = `${Math.min(o.w - 200, sp.x + 8)}px`;
    tip.style.top = `${Math.max(60, sp.y - 10)}px`;
  }
  function renderAll() {
    renderBadge();
    renderChips();
    renderTools();
  }

  /* ---------- sheets ---------- */
  let sheet = null,
    sheetTab = null;
  function openSheet(name, tab) {
    sheet = name;
    sheetTab =
      tab || ({ shop: "seeds", market: "sell", book: "book" }[name] ?? null);
    $("fm-pop").hidden = true;
    renderSheet();
    $("fm-dock")
      .querySelectorAll("[data-sheet]")
      .forEach((b) =>
        b.setAttribute("aria-expanded", String(b.dataset.sheet === name)),
      );
  }
  function closeSheet() {
    sheet = null;
    $("fm-sheet").hidden = true;
    // Closing the Decorate sheet stops placing, except on phones, where it
    // closes so the spots can be tapped (Escape stops it there).
    if (!layer.classList.contains("phone")) F.decorPick = null;
    $("fm-dock")
      .querySelectorAll("[data-sheet]")
      .forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  function head(k, h, tabs) {
    return `<div class="sh-head"><div><div class="k">${k}</div><h4>${h}</h4></div><span class="sp"></span><button type="button" class="x" data-close aria-label="Close">✕</button></div>${tabs ? `<nav class="sh-tabs">${tabs.map(([id, l]) => `<button type="button" data-tab="${id}" aria-selected="${sheetTab === id}">${l}</button>`).join("")}</nav>` : "<div></div>"}`;
  }
  const restockIn = () => Math.max(0, (F.shop.restockAt - serverNow()) / 1000);
  const marketIn = () => {
    const d = new Date(serverNow());
    const pt = new Date(
      d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
    );
    const next = new Date(pt);
    next.setHours(24, 0, 0, 0);
    return Math.max(0, (next - pt) / 1000);
  };
  const price = (k) => {
    const [id, mut] = k.split("|"),
      c = CROP[id],
      m = F.market.mult[id]?.m ?? 1;
    // The server's sell price: one rounding, after every multiplier.
    return Math.max(
      1,
      Math.round(
        c.sell *
          m *
          (mut ? mut.split("+").reduce((a, x) => a * (MUTS[x]?.x ?? 1), 1) : 1),
      ),
    );
  };
  function renderSheet() {
    const el = $("fm-sheet");
    el.hidden = false;
    const top = el.querySelector(".sh-body")?.scrollTop ?? 0;
    let html = "";
    if (sheet === "shop") {
      html =
        head("Farm Shop", "Shop", [
          ["seeds", "Seeds"],
          ["tools", "Tools"],
          ["dogs", "Guard Dogs"],
          ["land", "Land"],
        ]) + `<div class="sh-body">`;
      if (sheetTab === "seeds")
        html +=
          `<div class="restock">${I("clock")}<span>Restock in <b id="fm-restock">${fmtSecs(restockIn())}</b></span><span class="sh-note" style="margin-left:auto">Same stock list for everyone · rare seeds come and go</span></div>` +
          PCROPS.map((c) => {
            const st = F.shop.stock[c.id] ?? 0,
              lock = c.lv > F.lv;
            return `<div class="item${lock ? " locked" : ""}" style="--rc:${RC[c.rar]}"><span class="ic"><img src="${icon(c.id)}" alt=""></span><div><b><span class="tag ${c.rar}">${RAR_NAME[c.rar]}</span>${c.n}</b><small>${c.el} · grows in ${fmtSecs(c.t)} · sells ${c.sell} ${L} · ${c.xp} XP${lock ? ` · <b style="color:#ffd65b">unlocks at Lv ${c.lv}</b>` : ""}</small><small>You have ${F.seeds[c.id] || 0} · <span class="stock${st ? "" : " out"}">${st ? `${st} in stock` : "sold out"}</span></small></div><div class="acts"><button type="button" class="btn-s" data-buyseed="${c.id}" data-n="1" ${lock || st < 1 || F.leaves < c.cost ? "disabled" : ""}>1 · ${c.cost} ${L}</button><button type="button" class="btn-s ghost" data-buyseed="${c.id}" data-n="5" ${lock || st < 5 || F.leaves < c.cost * 5 ? "disabled" : ""}>5 · ${c.cost * 5} ${L}</button></div></div>`;
          }).join("");
      if (sheetTab === "tools")
        html +=
          `<p class="sh-note">Tools are yours forever. Fertilizer is used up.</p>` +
          toolRows()
            .map(([id, ic, n, text, cost, lv, have, blocked]) => {
              const lock = lv > F.lv && !have;
              return `<div class="item${lock ? " locked" : ""}"><span class="ic">${I(ic)}</span><div><b>${n}</b><small>${text}${lock ? ` · <b style="color:#ffd65b">unlocks at Lv ${lv}</b>` : blocked ? ` · <b style="color:#ffd65b">${blocked}</b>` : ""}</small></div><div class="acts">${have ? `<button type="button" class="btn-s green" disabled>Owned</button>` : `<button type="button" class="btn-s" data-buytool="${id}" ${lock || blocked || F.leaves < cost ? "disabled" : ""}>${cost.toLocaleString("en-US")} ${L}</button>`}</div></div>`;
            })
            .join("") +
          Object.entries(FERTILIZERS)
            .map(([k, f]) => {
              const lock = f.level > F.lv;
              return `<div class="item${lock ? " locked" : ""}"><span class="ic">${I(k === "gold" ? "fertGold" : k === "super" ? "fertSuper" : "fert")}</span><div><b>${f.name}${f.amount > 1 ? ` ×${f.amount}` : ""} (have ${F.ferts[k]})</b><small>${f.text}${lock ? ` · <b style="color:#ffd65b">unlocks at Lv ${f.level}</b>` : ""}</small></div><div class="acts"><button type="button" class="btn-s" data-buyfert="${k}" ${lock || F.leaves < f.price ? "disabled" : ""}>${f.price} ${L}</button></div></div>`;
            })
            .join("") +
          `<div class="item"><span class="ic">${I("barn")}</span><div><b>Barn +40 (${F.barnCap})</b><small>Store more crops</small></div><div class="acts"><button type="button" class="btn-s" data-barnup ${F.leaves < barnUpgradePrice(F.barnUp) ? "disabled" : ""}>${barnUpgradePrice(F.barnUp).toLocaleString("en-US")} ${L}</button></div></div>`;
      if (sheetTab === "dogs")
        html +=
          `<p class="sh-note">Hire a guard dog by the day. When the time runs out the dog goes home, so remember to renew. Hiring a different dog sends the one on guard home.</p>` +
          FARM_DOGS.map((d) => {
            const active = dogOn() && F.dog.type === d.id,
              lock = d.level > F.lv;
            return `<div class="dogcard${active ? " active" : ""}${lock ? " locked" : ""}"><canvas data-dogprev="${d.id}" width="120" height="120"></canvas><div><b>${d.name}</b><small>${d.text}${active ? `<br><b style="color:#7ff0a2">On guard · ${fmtDur(dogLeft())} left</b>` : ""}</small><div class="acts">${lock ? `<span class="sh-note">Unlocks at Lv ${d.level}</span>` : `<button type="button" class="btn-s${active ? " green" : ""}" data-dog="${d.id}" data-days="1" ${F.leaves < d.price1 ? "disabled" : ""}>${active ? "+1 day" : "1 day"} · ${d.price1} ${L}</button><button type="button" class="btn-s ghost" data-dog="${d.id}" data-days="3" ${F.leaves < d.price3 ? "disabled" : ""}>${active ? "+3 days" : "3 days"} · ${d.price3} ${L}</button>`}</div></div></div>`;
          }).join("");
      if (sheetTab === "land") {
        const k = F.land,
          ok = F.lv >= landLv(k),
          done = k >= 35;
        html += `<p class="sh-note">Buy more land one plot at a time. Each plot costs more than the last. You can only buy plots <b>next to land you own</b>; they show a <b>FOR SALE</b> sign.</p><div class="landmap" style="grid-template-columns:repeat(${COLS},minmax(0,1fr))">${F.plots.map((p, i) => `<button type="button" class="lm ${!p.locked ? "own" : buyable(i) ? "can" : "no"}" ${buyable(i) ? `data-landbuy="${i}"` : "disabled"} title="${!p.locked ? "Your land" : buyable(i) ? "For sale" : "Not yet"}">${!p.locked ? (p.crop ? I("sprout") : "") : buyable(i) ? I("sign") : ""}</button>`).join("")}</div><div class="item"><span class="ic">${I("sign")}</span><div><b>Next plot · ${15 + k}/${FARM_PLOTS} plots</b><small>${done ? "You own every plot" : `${landPrice(k)} ${L} · needs Lv ${landLv(k)}${ok ? "" : ` · <b style="color:#ffd65b">you are Lv ${F.lv}</b>`}`}</small></div></div>`;
        const pLock = F.lv < PASTURE.level;
        html += `<div class="item${pLock && !F.pasture ? " locked" : ""}"><span class="ic">${I("cow")}</span><div><b>Cow Pasture</b><small>Opens the meadow on the right with a cow that gives <b>${PASTURE.milk} ${MILK.name}</b> every ${fmtDur(PASTURE.milkSeconds)}, about ${MILK.sell} ${L} each${F.pasture ? "" : pLock ? ` · <b style="color:#ffd65b">unlocks at Lv ${PASTURE.level}</b>` : ""}</small></div><div class="acts">${F.pasture ? `<button type="button" class="btn-s green" disabled>Owned</button>` : `<button type="button" class="btn-s" data-pasture ${pLock || F.leaves < PASTURE.price ? "disabled" : ""}>${PASTURE.price} ${L}</button>`}</div></div>`;
      }
      html += `</div>`;
    }
    if (sheet === "market") {
      html =
        head("Farmers' market", "Market", [
          ["sell", "Sell"],
          ["prices", "Prices"],
          ["coins", "Coins"],
        ]) + `<div class="sh-body">`;
      if (sheetTab === "sell") {
        const rows = Object.entries(F.barn)
          .filter(([, n]) => n > 0)
          .sort((a, b) => price(b[0]) - price(a[0]));
        html +=
          `<p class="sh-note">Prices change daily. Today <b>${CROP[F.market.hot]?.n ?? "one crop"}</b> is in demand. New day in <b data-mkt>${fmtSecs(marketIn())}</b>.</p>` +
          (rows.length
            ? rows
                .map(([k, n]) => {
                  const [id, mut] = k.split("|"),
                    c = CROP[id],
                    m = F.market.mult[id]?.m ?? 1;
                  return `<div class="item" style="--rc:${RC[c.rar]}"><span class="ic"><img src="${icon(id)}" alt=""></span><div><b>${c.n} ×${n}</b><small>${
                    mut
                      ? mut
                          .split("+")
                          .map(
                            (x) =>
                              `<span class="mut ${MUTS[x]?.cls ?? ""}">${MUTS[x]?.n ?? x} ×${MUTS[x]?.x ?? 1}</span>`,
                          )
                          .join(" ") + " · "
                      : ""
                  }<span class="price">${price(k)} ${L}</span> each <span class="trend ${id === F.market.hot ? "fire" : "up"}">${id === F.market.hot ? "HOT" : ""} ×${m.toFixed(2)}</span></small></div><div class="acts"><button type="button" class="btn-s b-sell1" data-sell="${k}" data-n="1">Sell 1</button><button type="button" class="btn-s ghost b-sellall" data-sell="${k}" data-n="${n}">All · ${price(k) * n} ${L}</button></div></div>`;
                })
                .join("")
            : `<p class="sh-note">Your barn is empty. Harvest ripe crops, then sell them here.</p>`);
      }
      if (sheetTab === "prices")
        html +=
          `<p class="sh-note">Prices go up and down every day. Sell when the price is high.</p>` +
          PCROPS.filter((c) => c.lv <= F.lv + 3)
            .map((c) => {
              const m = F.market.mult[c.id]?.m ?? 1;
              return `<div class="item${c.lv > F.lv ? " locked" : ""}"><span class="ic"><img src="${icon(c.id)}" alt=""></span><div><b>${c.n}</b><small>Base ${c.sell} → today <span class="price">${Math.max(1, Math.round(c.sell * m))} ${L}</span></small></div><span class="trend ${c.id === F.market.hot ? "fire" : m >= 1 ? "up" : "down"}">${c.id === F.market.hot ? "HOT" : m >= 1 ? "▲" : "▼"} ×${m.toFixed(2)}</span></div>`;
            })
            .join("") +
          (F.pasture && F.market.mult.milk
            ? (() => {
                const m = F.market.mult.milk.m;
                return `<div class="item"><span class="ic"><img src="${icon("milk")}" alt=""></span><div><b>${MILK.name}</b><small>Base ${MILK.sell} → today <span class="price">${milkPrice(m)} ${L}</span></small></div><span class="trend ${m >= 1 ? "up" : "down"}">${m >= 1 ? "▲" : "▼"} ×${m.toFixed(2)}</span></div>`;
              })()
            : "");
      if (sheetTab === "coins") {
        const e = options.economy?.()?.leaves,
          traded = e?.tradedToday ?? 0,
          cap = LEAF_TRADE.dailyCoins;
        html += `<p class="sh-note">Trade Gold Leaves for <b>Arena coins</b> to buy skins. There is a daily cap, so farming never replaces playing matches.</p><div class="item"><span class="ic">${I("coin")}</span><div><b>${LEAF_TRADE.leaves} ${L} → ${LEAF_TRADE.coins} coins</b><small>Traded today: ${traded}/${cap} coins</small><div class="cap"><i style="width:${(traded / cap) * 100}%"></i></div></div><div class="acts"><button type="button" class="btn-s" data-coins="1" ${F.leaves < LEAF_TRADE.leaves || traded >= cap ? "disabled" : ""}>Trade</button></div></div>`;
      }
      html += `</div>`;
    }
    if (sheet === "orders") {
      html =
        head("Order board", "Orders") +
        `<div class="sh-body"><p class="sh-note">Deliver the crops to earn Gold Leaves and XP. Orders pay more than the market.</p>` +
        F.orders
          .map((o) =>
            !o.items
              ? `<div class="order wait">New order in <b data-ordwait="${o.slot}">${fmtSecs(Math.max(0, (o.waitUntil - serverNow()) / 1000))}</b></div>`
              : `<div class="order"><div class="who"><img src="${options.art(o.face)}" alt=""><div><b>${esc(o.who)}</b><small>needs these soon</small></div></div><div class="needs">${o.items
                  .map(
                    ([id, n]) =>
                      `<span class="oneed ${owned(id) >= n ? "ok" : "no"}"><img src="${icon(id)}" alt="">${owned(id)}/${n} ${CROP[id].n}</span>`,
                  )
                  .join(
                    "",
                  )}</div><div class="rw"><span>+${o.leaves} ${L} · +${o.xp} XP${o.bonus ? ` · +1 ${FERT_NAME[o.bonus]}` : ""}</span><span style="display:flex;gap:6px"><button type="button" class="btn-s ghost" data-ordskip="${o.slot}">Skip</button><button type="button" class="btn-s green" data-ord="${o.slot}" ${canFill(o) ? "" : "disabled"}>Deliver</button></span></div></div>`,
          )
          .join("") +
        `</div>`;
    }
    if (sheet === "barn") {
      const rows = Object.entries(F.barn).filter(([, n]) => n > 0);
      html =
        head("Barn storage", "Barn") +
        `<div class="sh-body"><div class="item"><span class="ic">${I("barn")}</span><div><b>${barnUsed()}/${F.barnCap} spaces</b><div class="cap"><i style="width:${(barnUsed() / F.barnCap) * 100}%"></i></div></div><div class="acts"><button type="button" class="btn-s ghost" data-goto="shop:tools">Upgrade</button></div></div>
        <div class="item"><span class="ic">${I("seed")}</span><div><b>Seeds</b><small>${
          PCROPS.filter((c) => F.seeds[c.id])
            .map((c) => `${c.n} ×${F.seeds[c.id]}`)
            .join(" · ") || "No seeds"
        }</small></div></div>
        <div class="item"><span class="ic">${I("fert")}</span><div><b>Fertilizer</b><small>Regular ×${F.ferts.norm} · Super ×${F.ferts.super} · Gold ×${F.ferts.gold}</small></div></div>
        ${rows
          .map(([k, n]) => {
            const [id, mut] = k.split("|");
            return `<div class="item"><span class="ic"><img src="${icon(id)}" alt=""></span><div><b>${CROP[id].n} ×${n}</b><small>${
              mut
                ? mut
                    .split("+")
                    .map(
                      (x) =>
                        `<span class="mut ${MUTS[x]?.cls ?? ""}">${MUTS[x]?.n ?? x}</span>`,
                    )
                    .join(" ")
                : id === MILK.id
                  ? "From your cow"
                  : "Regular"
            } · ${price(k)} ${L} each</small></div><div class="acts"><button type="button" class="btn-s ghost" data-goto="market:sell">Sell</button></div></div>`;
          })
          .join(
            "",
          )}<p class="sh-note">Regular crops double as treats to <b>throw in the Plaza</b> (key T).</p></div>`;
    }
    if (sheet === "book") {
      const found = PCROPS.filter((c) => F.harv[c.id]).length;
      const tabs = [
        ["book", "Crop book"],
        ["mastery", "Mastery"],
      ];
      if (sheetTab === "mastery")
        html = head("Farmer's almanac", "Crop mastery", tabs) + masteryHTML();
      else
        html =
          head(
            "Farmer's almanac",
            `Crop book ${found}/${PCROPS.length}`,
            tabs,
          ) +
          `<div class="sh-body"><p class="sh-note">Harvest a crop to log it in your book. Crops marked GIANT can grow into one giant crop: plant 9 in a 3×3 square.</p><div class="book">${PCROPS.map(
            (c) => {
              const n = F.harv[c.id] || 0,
                gn = F.giantsGrown[c.id] || 0,
                giant = canGrowGiant(c.id)
                  ? `<em class="gt${gn ? " on" : ""}">GIANT${gn ? ` ×${gn}` : ""}</em>`
                  : "";
              return `<div class="bk${n ? "" : " unk"}" title="${n ? `${c.n} · harvested ${n}×` : `Unlocks at Lv ${c.lv}`}${giant ? ` · ${gn ? `grew giant ${gn}×` : "can grow giant"}` : ""}">${giant}<img src="${icon(c.id)}" alt=""><span>${n ? c.n : `??? · Lv ${c.lv}`}</span><span class="muts"><small>${n ? `${n}×` : ""}</small></span></div>`;
            },
          ).join(
            "",
          )}</div><h4 style="margin:.4em 0 0;font-family:var(--display);text-transform:uppercase">Collection rewards</h4><div class="miles">${BOOK_REWARDS.map(
            ([n, r]) => {
              const got = (F.bookRewards ?? []).includes(n);
              return `<div class="mile${got ? " done" : ""}"><span>${got ? "✓" : "○"} ${n} crops</span><span>${r}</span></div>`;
            },
          ).join("")}</div></div>`;
    }
    if (sheet === "decor")
      html =
        head("Decorate", `Charm ${F.charm} · +${charmBonus(F.charm)}% XP`) +
        `<div class="sh-body"><p class="sh-note">${
          F.decorPick === "__remove"
            ? "<b>Putting away:</b> tap a decoration on the farm. It is not refunded."
            : F.decorPick
              ? `<b>Placing ${DECO[F.decorPick]?.name}:</b> tap a glowing spot on the farm. A spot that already has decor is replaced.`
              : "Buy decor and place it in the 8 spots around the farm. Every 2 Charm gives +1% farm XP (up to 25%)."
        }</p>` +
        FARM_DECOR.map((d) => {
          const free = F.decorCredits[d.id] > 0,
            lock = d.level > F.lv && !free,
            picking = F.decorPick === d.id;
          return `<div class="item${lock ? " locked" : ""}"><span class="ic">${I(d.icon)}</span><div><b>${d.name}</b><small>+${d.charm} Charm${free ? ` · <b style="color:#7ff0a2">1 free</b>` : ""}${lock ? ` · <b style="color:#ffd65b">unlocks at Lv ${d.level}</b>` : ""}</small></div><div class="acts"><button type="button" class="btn-s${picking ? " green" : ""}" data-deco="${d.id}" ${lock || (!free && F.leaves < d.price) ? "disabled" : ""}>${picking ? "Placing…" : free ? "Free" : `${d.price.toLocaleString("en-US")} ${L}`}</button></div></div>`;
        }).join("") +
        `<div class="item"><span class="ic">${I("broom")}</span><div><b>Put decor away</b><small>Tap "Remove", then a decoration on the farm</small></div><div class="acts"><button type="button" class="btn-s ghost" data-deco="__remove">${F.decorPick === "__remove" ? "Removing…" : "Remove"}</button></div></div></div>`;
    if (sheet === "friends")
      html =
        head("Neighbors", "Friends") +
        `<div class="sh-body"><p class="sh-note">Visit a friend to <b>catch bugs and water</b> (+XP, up to 60 a day) or <b>sneak</b> 1 crop from a ripe plot. Watch out for guard dogs! You get 3 pranks a day.</p>` +
        (friendsList === null
          ? `<p class="sh-note">Loading your friends…</p>`
          : friendsList.length
            ? friendsList
                .map(
                  (f) =>
                    `<div class="fr"><img src="${options.art(f.fighter)}" alt=""><div><b>${esc(f.name)} · Lv ${f.level}</b><small>${f.bugs ? `<span class="bd">${I("bug")} ${f.bugs} bug${f.bugs === 1 ? "" : "s"}</span> · ` : ""}${f.ripe ? `<span class="bd">${I("wheat")} ${f.ripe} ripe</span> · ` : ""}${f.dog ? `${I("dog")} ${DOG[f.dog]?.name ?? "Guard dog"}` : "No guard dog"}</small></div><button type="button" class="btn-s" data-visit="${esc(f.id)}"${V?.id === f.id ? " disabled" : ""}>${V?.id === f.id ? "Here" : "Visit"}</button></div>`,
                )
                .join("")
            : `<p class="sh-note">None of your friends has a farm yet. Add friends from the Lobby, then visit their farms here.</p>`) +
        `</div>`;
    el.innerHTML = html;
    el.querySelectorAll("[data-dogprev]").forEach((c) => {
      const g = c.getContext("2d");
      g.clearRect(0, 0, 120, 120);
      GFX.dog(g, c.dataset.dogprev, "sit", 0, 54, 108, 1.7, 1);
    });
    const b = el.querySelector(".sh-body");
    if (b) b.scrollTop = top;
  }
  function updateSheetTimers() {
    const r = $("fm-restock");
    if (r) r.textContent = fmtSecs(restockIn());
    const m = $("fm-sheet").querySelector("[data-mkt]");
    if (m) m.textContent = fmtSecs(marketIn());
    let due = false;
    $("fm-sheet")
      .querySelectorAll("[data-ordwait]")
      .forEach((el) => {
        const o = F.orders.find((x) => x.slot === +el.dataset.ordwait),
          left = o ? Math.max(0, (o.waitUntil - serverNow()) / 1000) : 0;
        el.textContent = fmtSecs(left);
        if (!left) due = true;
      });
    // A waiting order is ready: opening the farm again brings it.
    if (due && !ordersRefreshing) {
      ordersRefreshing = true;
      refresh().finally(() => {
        ordersRefreshing = false;
        if (sheet === "orders") renderSheet();
      });
    }
  }
  let ordersRefreshing = false;
  $("fm-sheet").addEventListener("click", async (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    const d = t.dataset;
    if ("close" in d) return closeSheet();
    if (d.tab) {
      sheetTab = d.tab;
      return renderSheet();
    }
    if (d.goto) {
      const [s, tab] = d.goto.split(":");
      return openSheet(s, tab);
    }
    if (d.buyseed) {
      act({ a: "buy-seeds", crop: d.buyseed, qty: +d.n }, true);
      F.seed = d.buyseed;
      toast(`Bought ${d.n} ${CROP[d.buyseed].n} seed${+d.n > 1 ? "s" : ""}`);
      renderTools();
      return renderSheet();
    }
    if (d.buyfert) {
      act({ a: "buy-fertilizer", kind: d.buyfert }, true);
      return;
    }
    if (d.buytool) {
      act({ a: "buy-tool", tool: d.buytool }, true);
      return;
    }
    if (d.dog) {
      act({ a: "hire-dog", dog: d.dog, days: +d.days }, true);
      return;
    }
    if ("barnup" in d) {
      act({ a: "upgrade-barn" }, true);
      return;
    }
    if (d.deco) {
      F.decorPick = F.decorPick === d.deco ? null : d.deco;
      // On a phone the sheet covers the spots: close it while placing.
      if (F.decorPick && layer.classList.contains("phone")) {
        closeSheet();
        return toast(
          F.decorPick === "__remove"
            ? "Tap a decoration to put it away"
            : "Tap a glowing spot on the farm",
        );
      }
      return renderSheet();
    }
    if (d.visit) return visitFriend(d.visit);
    if (d.landbuy) return landClick(+d.landbuy);
    if (d.mast) {
      t.disabled = true;
      try {
        await flush();
        const r = await options.master(d.mast);
        if (r?.farm) applyState(r.farm);
        if (r?.ok) {
          toast(`${CROP[d.mast].n} ★${r.stars}: sells +${r.stars * 4}%`);
          log(`Mastered <b>${CROP[d.mast].n}</b> ★${r.stars}`, "good");
        } else if (r?.error) toast(r.error);
      } catch (err) {
        toast(err?.message || "Couldn't reach your farm.");
      }
      return renderSheet();
    }
    if (d.ord !== undefined || d.ordskip !== undefined) {
      const slot = +(d.ord ?? d.ordskip),
        kind = d.ord !== undefined ? "deliver" : "skip";
      t.disabled = true;
      try {
        await flush();
        const r = await options.order(slot, kind);
        if (r?.farm) applyState(r.farm);
        if (r?.ok && kind === "deliver") {
          toast(
            `Delivered to ${r.gained.who}: +${r.gained.leaves} Gold Leaves`,
          );
          log(
            `Delivered to <b>${esc(r.gained.who)}</b> +${r.gained.leaves} ${L} +${r.gained.xp} XP`,
            "good",
          );
        } else if (!r?.ok && r?.error) toast(r.error);
      } catch (err) {
        toast(err?.message || "Couldn't reach the order board.");
      }
      renderChips();
      return renderSheet();
    }
    if ("pasture" in d) {
      act({ a: "buy-pasture" }, true);
      return renderSheet();
    }
    if (d.sell) {
      const [id, mut] = d.sell.split("|"),
        n = +d.n;
      act(
        id === MILK.id
          ? { a: "sell-milk", qty: n }
          : { a: "sell", crop: id, mutation: mut || "", qty: n },
        true,
      );
      F.barn[d.sell] = Math.max(0, (F.barn[d.sell] || 0) - n);
      toast(`Selling ${n} ${CROP[id].n}…`);
      return renderSheet();
    }
    if ("coins" in d) {
      t.disabled = true;
      try {
        await options.trade(1);
        toast(`+${LEAF_TRADE.coins} Arena coins`);
        await refresh();
      } catch (err) {
        toast(err?.message || "Couldn't trade right now.");
      }
      return renderSheet();
    }
  });
  $("fm-dock").addEventListener("click", (e) => {
    if (e.target.closest("[data-wish]")) {
      menuSet(false);
      void wishWell();
      return;
    }
    const b = e.target.closest("[data-sheet]");
    if (!b) return;
    menuSet(false);
    if (b.dataset.sheet === "friends" && sheet !== "friends")
      void loadFriends();
    if (sheet === b.dataset.sheet) closeSheet();
    else openSheet(b.dataset.sheet);
  });
  $("fm-visit").addEventListener("click", (e) => {
    if (e.target.closest("[data-home]")) void goHome();
  });
  $("fm-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-orb]");
    if (!b) return;
    orbOpen = orbOpen === b.dataset.orb ? null : b.dataset.orb;
    renderChips();
    if (!orbOpen) $("fm-orbpop").hidden = true;
  });
  $("fm-orbpop").addEventListener("click", (e) => {
    if (e.target.closest("[data-perk]")) {
      orbOpen = null;
      $("fm-orbpop").hidden = true;
      act({ a: "perk" }, true);
      renderChips();
      return;
    }
    const go = e.target.closest("[data-orbgo]");
    if (!go) return;
    orbOpen = null;
    $("fm-orbpop").hidden = true;
    if (go.dataset.orbgo === "dogs") openSheet("shop", "dogs");
    else openSheet("barn");
    renderChips();
  });
  const closeOrb = (e) => {
    if (orbOpen && !e.target.closest("#fm-orbpop, #fm-chips")) {
      orbOpen = null;
      $("fm-orbpop").hidden = true;
      renderChips();
    }
  };
  layer.addEventListener("pointerdown", closeOrb, true);
  /* The farm menu (phase 6): one Menu button in the bottom-right corner, the
     size of a tool, opens a grid of tiles above it; a tile, a tap elsewhere,
     Escape or M again folds it. */
  const dockEl = $("fm-dock"),
    menuBtn = $("fm-menu-btn");
  function menuSet(open) {
    dockEl.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-pressed", String(open));
    if (open) {
      orbOpen = null;
      $("fm-orbpop").hidden = true;
      $("fm-pop").hidden = true;
    }
  }
  function syncMenuDot() {
    $("fm-menu-btn").toggleAttribute(
      "data-dot",
      ["fm-ord-dot", "fm-fr-dot", "fm-wish-dot"].some((id) => !$(id).hidden),
    );
  }
  menuBtn.addEventListener("click", () => menuSet(dockEl.hidden));
  layer.addEventListener(
    "pointerdown",
    (e) => {
      if (!dockEl.hidden && !e.target.closest("#fm-dock, #fm-menu-btn"))
        menuSet(false);
    },
    true,
  );
  $("fm-tools").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tool]");
    if (!b) return;
    const id = b.dataset.tool;
    if (id === "seed") {
      if (F.tool === "seed") {
        const r = b.getBoundingClientRect(),
          sr = hudEl.getBoundingClientRect();
        toolPop("seed", r.left - sr.left, r.top - sr.top);
      }
      F.tool = "seed";
    } else if (id === "fert") {
      if (F.tool === "fert") {
        const r = b.getBoundingClientRect(),
          sr = hudEl.getBoundingClientRect();
        toolPop("fert", r.left - sr.left, r.top - sr.top);
      }
      F.tool = "fert";
    } else F.tool = id;
    renderTools();
  });
  function toolPop(kind, x, y) {
    const pop = $("fm-pop");
    pop.hidden = false;
    if (kind === "seed")
      pop.innerHTML = `<h6>Pick a seed to sow</h6><div class="grid">${
        CROPS.filter((c) => F.seeds[c.id])
          .map(
            (c) =>
              `<button type="button" class="opt" data-tseed="${c.id}"><b>${F.seeds[c.id]}</b><img src="${icon(c.id)}" alt=""><span>${c.n}</span></button>`,
          )
          .join("") || `<p class="sh-note">No seeds</p>`
      }</div>`;
    else
      pop.innerHTML = `<h6>Pick a fertilizer</h6><div class="grid">${[
        ["norm", "fert", "Regular"],
        ["super", "fertSuper", "Super"],
        ["gold", "fertGold", "Gold"],
      ]
        .map(
          ([k, ic, n]) =>
            `<button type="button" class="opt" data-tfert="${k}" ${F.ferts[k] ? "" : "disabled"}><b>${F.ferts[k]}</b>${I(ic, "big")}<span>${n}</span></button>`,
        )
        .join("")}</div>`;
    pop.style.left = `${Math.max(8, Math.min(NW - 308, x - 120))}px`;
    pop.style.top = `${y - pop.offsetHeight - 10}px`;
    pop.onclick = (e) => {
      const s = e.target.closest("[data-tseed]"),
        f = e.target.closest("[data-tfert]");
      if (s) {
        F.seed = s.dataset.tseed;
        F.tool = "seed";
      }
      if (f) {
        F.fert = f.dataset.tfert;
        F.tool = "fert";
      }
      if (s || f) {
        pop.hidden = true;
        renderTools();
        screen.focus({ preventScroll: true });
      }
    };
  }
  /* two-finger pinch zoom on touch screens */
  const touchPts = new Map();
  let pinch = null,
    tipT = 0;
  cv.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPts.size === 2) {
      e.stopImmediatePropagation();
      if (tapG) {
        clearTimeout(tapG.timer);
        tapG = null;
      }
      endDrag();
      panning = null;
      dragging = false;
      const [a, b] = [...touchPts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!touchPts.has(e.pointerId)) return;
    touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch) return;
    e.stopImmediatePropagation();
    const [a, b] = [...touchPts.values()],
      d = Math.hypot(a.x - b.x, a.y - b.y) || 1,
      m = toWorld((a.x + b.x) / 2, (a.y + b.y) / 2);
    zoomAt(d / pinch.d, m.vx, m.vy);
    pinch.d = d;
  });
  const dropTouch = (e) => {
    touchPts.delete(e.pointerId);
    if (touchPts.size < 2 && pinch) {
      pinch = null;
      panning = null;
      dragging = false;
    }
  };
  cv.addEventListener("pointerup", dropTouch);
  cv.addEventListener("pointercancel", dropTouch);
  // touch has no hover: tapping a growing crop with the hand shows its card for a moment
  if (matchMedia("(pointer: coarse)").matches)
    $("fm-hint").textContent =
      "Drag to move · pinch to zoom · hold a plot to plant many";

  /* canvas pointer */
  let dragging = false,
    lastI = -1;
  /* Touch gestures, like mobile farm games: a quick tap uses the tool / opens the building, a drag always moves
     the map (even when it starts on a plot or a building), press-and-hold then drag paints the tool across plots,
     two fingers zoom. The mouse keeps click-and-drag painting. */
  let tapG = null;
  const HOLD_MS = 300,
    MOVE_PX = 10;
  cv.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return press(e);
    if (touchPts.size >= 2) return;
    screen.focus({ preventScroll: true });
    $("fm-pop").hidden = true;
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {}
    const ev = {
      clientX: e.clientX,
      clientY: e.clientY,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
    };
    if (tapG) clearTimeout(tapG.timer);
    tapG = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
      ev,
      mode: "pending",
      timer: setTimeout(() => {
        if (tapG && tapG.mode === "pending") {
          tapG.mode = "paint";
          navigator.vibrate?.(12);
          press(tapG.ev);
        }
      }, HOLD_MS),
    };
  });
  function press(e) {
    screen.focus({ preventScroll: true });
    $("fm-pop").hidden = true;
    const w = toWorld(e.clientX, e.clientY);
    if (F.decorPick && !V) {
      const k = DECO_SLOTS.findIndex(
        ([x, y]) => Math.hypot(w.x - x, (w.y - y) * 2) < 50,
      );
      if (k >= 0) return placeDecor(k);
    }
    if (
      w.x > STALL.x - 95 &&
      w.x < STALL.x + 95 &&
      w.y > STALL.y - 170 &&
      w.y < STALL.y
    )
      return openSheet("market");
    if (
      w.x > BARN.x - 110 &&
      w.x < BARN.x + 140 &&
      w.y > BARN.y - 200 &&
      w.y < BARN.y
    )
      return openSheet("barn");
    if (Math.hypot(w.x - WELL.x, w.y - (WELL.y - 50)) < 60) return wishWell();
    if (
      !V &&
      w.x > PAST.x0 &&
      w.x < PAST.x1 &&
      w.y > PAST.y0 - 60 &&
      w.y < PAST.y1
    )
      return pastureClick();
    const i = plotAt(w.x, w.y);
    if (i < 0) {
      panning = {
        x: e.clientX,
        y: e.clientY,
        cx: cam.x,
        cy: cam.y,
        k: NW / cv.getBoundingClientRect().width,
      };
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {}
      CUR.grab = true;
      if (!CUR.on) cv.style.cursor = "grabbing";
      return;
    }
    if (e.pointerType !== "mouse" && F.tool === "hand") {
      const pl = F.plots[i];
      if (pl?.crop && pl.prog < 1) {
        showTip(i);
        clearTimeout(tipT);
        tipT = setTimeout(() => {
          $("fm-tip").hidden = true;
        }, 2600);
      }
    }
    dragging = true;
    lastI = i;
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {}
    CUR.use = 1;
    useTool(i);
  }
  cv.addEventListener("pointermove", (e) => {
    if (tapG && tapG.id === e.pointerId && tapG.mode === "pending") {
      if (Math.hypot(e.clientX - tapG.x0, e.clientY - tapG.y0) < MOVE_PX)
        return;
      clearTimeout(tapG.timer);
      tapG.mode = "pan";
      $("fm-tip").hidden = true;
      panning = {
        x: tapG.x0,
        y: tapG.y0,
        cx: cam.x,
        cy: cam.y,
        k: NW / cv.getBoundingClientRect().width,
      };
      CUR.grab = true;
    }
    if (panning) {
      const w0 = toWorld(e.clientX, e.clientY);
      CUR.vx = w0.vx;
      CUR.vy = w0.vy;
      cam.x = panning.cx - ((e.clientX - panning.x) * panning.k) / (K * Z);
      cam.y = panning.cy - ((e.clientY - panning.y) * panning.k) / (K * Z);
      clampCam();
      $("fm-tip").hidden = true;
      return;
    }
    const w = toWorld(e.clientX, e.clientY),
      i = plotAt(w.x, w.y);
    if (i !== hoverI) {
      hoverI = i;
      if (i >= 0 && e.pointerType === "mouse") showTip(i);
      else if (e.pointerType === "mouse") $("fm-tip").hidden = true;
    }
    CUR.vx = w.vx;
    CUR.vy = w.vy;
    CUR.on = e.pointerType === "mouse" && !F.decorPick;
    cv.style.cursor = CUR.on
      ? "none"
      : i >= 0 || F.decorPick
        ? "pointer"
        : "default";
    if (
      dragging &&
      i >= 0 &&
      i !== lastI &&
      ["seed", "can", "net", "sickle", "hand", "fert"].includes(F.tool)
    ) {
      lastI = i;
      CUR.use = 1;
      useTool(i, true);
    }
  });
  const endDrag = () => {
    combo.n = 0;
    dragging = false;
    lastI = -1;
    CUR.grab = false;
    if (panning) {
      panning = null;
      if (!CUR.on) cv.style.cursor = "default";
    }
    if (queue.length) {
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 0);
    }
  };
  cv.addEventListener(
    "wheel",
    (e) => {
      if (!running) return;
      e.preventDefault();
      const w = toWorld(e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, w.vx, w.vy);
    },
    { passive: false },
  );
  $("fm-zoom").addEventListener("click", (e) => {
    const b = e.target.closest("[data-z]");
    if (!b) return;
    if (b.dataset.z === "in") zoomAt(1.2);
    else if (b.dataset.z === "out") zoomAt(1 / 1.2);
    else {
      Z = Math.max(ZMIN, Math.min(VW / (WW + 120), VH / (WH + 80)));
      cam = { x: WW / 2, y: WH / 2 };
      clampCam();
    }
  });
  layer.addEventListener("keydown", (e) => {
    if (!running || e.target.closest?.("input, textarea")) return;
    const k = e.key.toLowerCase();
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(k)
    ) {
      keysF.add(k);
      e.preventDefault();
    }
    if (/^[1-9]$/.test(k)) {
      const t = TOOLS()[+k - 1];
      if (t) {
        F.tool = t[0];
        renderTools();
      }
    }
    if (k === "m") menuSet(dockEl.hidden);
    if (k === "escape" && !dockEl.hidden) {
      menuSet(false);
      return;
    }
    if (k === "escape") {
      F.decorPick = null;
      $("fm-pop").hidden = true;
      $("fm-modal").hidden = true;
      closeSheet();
      F.tool = "hand";
      renderTools();
    }
    if (k === "+" || k === "=") zoomAt(1.2);
    if (k === "-") zoomAt(1 / 1.2);
  });
  layer.addEventListener("keyup", (e) => keysF.delete(e.key.toLowerCase()));
  cv.addEventListener("pointerup", (e) => {
    if (tapG && tapG.id === e.pointerId) {
      clearTimeout(tapG.timer);
      const m = tapG.mode,
        ev = tapG.ev;
      tapG = null;
      if (m === "pending") {
        press(ev);
        endDrag();
        return;
      }
    }
    endDrag();
  });
  cv.addEventListener("pointercancel", (e) => {
    if (tapG && tapG.id === e.pointerId) {
      clearTimeout(tapG.timer);
      tapG = null;
    }
    endDrag();
  });
  cv.addEventListener("pointerleave", (e) => {
    hoverI = -1;
    CUR.on = false;
    if (e.pointerType === "mouse") $("fm-tip").hidden = true;
  });
  function frameField() {
    const top = 100 / K,
      bot = 72 / K,
      right = 68 / K,
      left = 12 / K;
    Z = Math.max(
      ZMIN,
      Math.min(
        ZMAX,
        (VW - left - right) / (FW + 40),
        (VH - top - bot) / (FH + 30),
      ),
    );
    cam.x = FCX + (right - left) / 2 / Z;
    cam.y = OY + FH / 2 - (top - bot) / 2 / Z;
    clampCam();
  }
  function resize(nw, nh, ps) {
    NW = nw;
    NH = nh;
    PS = ps;
    VW = Math.max(1280, Math.round((VH * nw) / nh));
    ZMIN = Math.max(VW / BW, VH / BH);
    Z = Math.max(Z, ZMIN);
    clampCam();
    K = Math.min(nw / VW, nh / VH);
    OFX = (nw - VW * K) / 2;
    OFY = (nh - VH * K) / 2 + (nw < 1000 ? 0 : 6);
    const phone = nh <= 500;
    if (phone !== wasPhone) {
      wasPhone = phone;
      ZMAX = phone ? 2.4 : 1.35;
      if (phone) frameField();
      else {
        Z = Math.max(ZMIN, 0.86);
        cam = { x: OX + FW / 2, y: 520 };
        clampCam();
      }
    }
    cv.width = Math.round(nw * ps);
    cv.height = Math.round(nh * ps);
  }
  function enter() {
    if (!inited) {
      paintBg();
      inited = true;
    }
    renderAll();
    if (!running) {
      running = true;
      frozen = false;
      layer.dataset.frozen = "false";
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  }
  function leave() {
    running = false;
    keysF.clear();
    cancelAnimationFrame(raf);
    $("fm-tip").hidden = true;
    $("fm-pop").hidden = true;
  }
  const onResize = () => {
    syncPhone();
    resize(
      layer.clientWidth || innerWidth,
      layer.clientHeight || innerHeight,
      low ? 1 : Math.min(2, devicePixelRatio || 1),
    );
  };
  addEventListener("resize", onResize);
  // While the farm is open, come back to the server now and then: ripe
  // crops, the restock and the market day are all decided there.
  const poll = setInterval(() => {
    if (document.hidden) return;
    if (V) {
      if (!visitQueue.length && !visitSending)
        options
          .visit(V.id)
          .then((v) => V && V.id === v.id && applyVisit(v))
          .catch(() => {});
    } else if (!queue.length && !sending) void refresh();
  }, 60_000);
  onResize();
  if (matchMedia("(pointer: coarse)").matches)
    $("fm-hint").textContent =
      "Drag to move · pinch to zoom · hold a plot to plant many";
  enter();
  void refresh();
  // The Friends button shows a dot when a friend's farm has bugs or ripe crops.
  void loadFriends();
  layer.focus({ preventScroll: true });
  return {
    refresh,
    close() {
      void flush();
      leave();
      clearInterval(poll);
      clearInterval(thawCheck);
      coverWatch.disconnect();
      removeEventListener("resize", onResize);
      layer.remove();
    },
    /** Debug handle for tests. */
    _dbg: {
      F,
      /** The guard dog (tests): where it is, its route, and a bark. */
      dog,
      dogTo,
      dogBark,
      decoys,
      gate: () => ({ x: FCX, out: FR.y1 + 30, inn: FR.y1 - 16 }),
      /** Where a world point is on the page (tests). */
      worldClient: (x, y) => {
        const r = cv.getBoundingClientRect(),
          sp = toScreen(x, y);
        return {
          x: r.left + (sp.x * r.width) / NW,
          y: r.top + (sp.y * r.height) / NH,
        };
      },
      well: WELL,
      /** Center the camera on a world point (tests). */
      look: (x, y) => {
        cam.x = x;
        cam.y = y;
        clampCam();
      },
      /** Where a giant crop's square is on the page (tests). */
      giantClient: (i) => {
        const r = cv.getBoundingClientRect(),
          a = plotRect(i),
          b = plotRect(i + 2 * COLS + 2),
          sp = toScreen((a.x + b.x + b.w) / 2, (a.y + b.y + b.h) / 2);
        return {
          x: r.left + (sp.x * r.width) / NW,
          y: r.top + (sp.y * r.height) / NH,
        };
      },
      plotClient: (i) => {
        const r = cv.getBoundingClientRect(),
          pr = plotRect(i),
          sp = toScreen(pr.x + PW / 2, pr.y + PH / 2);
        return {
          x: r.left + (sp.x * r.width) / NW,
          y: r.top + (sp.y * r.height) / NH,
        };
      },
    },
  };
}
