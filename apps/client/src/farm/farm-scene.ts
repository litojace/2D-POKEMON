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
  farmPerk,
  farmPerkOf,
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
  FARM_BONDS,
  BALLOON,
  STALL as STALL_RULES,
  FARM_EMOTES,
  PARTY,
  FARM_INVITE_STEPS,
  FARM_INVITE_WELCOME,
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
  FarmFeel,
  deviceTimeOfDay,
  glow,
  goldenLevel,
  gradeView,
  isSuperSwipe,
  nightLevel,
  star,
} from "./farm-feel";
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
import { fadeIn } from "../ui/motion";

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
      <nav class="fm-rail glass" id="fm-rail" aria-label="Farm menu">
        <button type="button" data-sheet="shop" title="Shop">${I("shop")}<span>Shop</span></button>
        <button type="button" data-sheet="friends" title="Friends">${I("friends")}<span>Friends</span><b class="dot" id="fm-fr-dot" hidden></b></button>
        <button type="button" data-sheet="decor" title="Decorate">${I("decor")}<span>Decor</span></button>
        <button type="button" data-sheet="book" title="Almanac">${I("book")}<span>Almanac</span></button>
      </nav>
      <div class="fm-zoom glass" id="fm-zoom" role="group" aria-label="Zoom"><button type="button" data-z="in" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" data-z="out" aria-label="Zoom out" title="Zoom out (−)">−</button><button type="button" data-z="fit" aria-label="Show the whole farm" title="Show the whole farm">⤢</button></div>
    </div>
    <div class="fm-visit glass" id="fm-visit" hidden></div>
    <div class="fm-visit fm-here glass" id="fm-here" hidden></div>
    <div class="fm-tools glass" id="fm-tools"></div>
    <div class="fm-log" id="fm-log" aria-live="polite"></div>
    <div class="fm-tip glass" id="fm-tip" hidden></div>
    <div class="fm-pop glass" id="fm-pop" hidden></div>
    <div class="fm-acts" id="fm-acts" hidden></div>
    <div class="fm-sickle fm-seedbub" id="fm-seed" hidden><button type="button" data-seedbub></button></div>
    <div class="fm-sickle" id="fm-sickle" hidden><button type="button" data-sickle aria-label="Harvest: tap, or drag across ripe crops">${I("sickle")}</button></div>
    <div class="fm-ghost" id="fm-ghost" hidden aria-hidden="true"></div>
    <div class="fm-orbpop glass" id="fm-orbpop" hidden></div>
    <section class="fm-sheet glass" id="fm-sheet" hidden></section>
    <div class="fm-hint" id="fm-hint">Drag the grass to move · scroll or press +/− to zoom</div>
    <div class="fm-modal" id="fm-modal" hidden></div>
  </div>
</div>`;

/*
 * The farm as you left it, this session, per player: where the animals
 * stood. Opening the farm again starts from here. (The balloon and stall,
 * loaded after the farm, come kept from openFarmScreen so they don't pop in.)
 */
const LEFT = new Map();
export function openFarm(options) {
  const layer = document.createElement("div");
  layer.className = "farm-layer";
  layer.tabIndex = -1;
  layer.innerHTML = FARM_HTML;
  document.body.append(layer);
  // Each hub scene (Lobby, Plaza, Farm) fades in as you switch to it.
  fadeIn([layer], 260);
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

  // The view in virtual pixels: at least 1280 × 800, and grown along the
  // screen's longer side so it always fills the screen (no bands).
  let VW = 1280,
    VH = 800;
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
    decorFromStore: false,
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
  const yieldN = () =>
    (farmPerkOf(F.farmer ?? "") === "terradon" ? 3 : 2) +
    (party && !V ? PARTY.bonus : 0);
  const perk = () => farmPerk(F.farmer);
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
  /** Rain and storms water every growing crop (the server's rule, 039 and
   *  067): show it the moment it rains, before the next update says so. */
  const raining = () => ["rain", "storm"].includes(F.weather.cur);
  const wetNow = (p) => !!p.wet || (!!p.crop && p.prog < 1 && raining());
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
      if (farmPerkOf(F.farmer ?? "") === "voltkit")
        F.plots.forEach((q) => (q.pests = 0));
      if (farmPerkOf(F.farmer ?? "") === "tidefin")
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
    sfx("coin");
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
  /* The scenery's random numbers come from sequences of its own. GFX's shared
     one is reseeded each time a sprite is painted, and sprites are cached, so
     scenery drawn from it moved between the first visit and the next. */
  const seeded = (s) => {
    let x = Math.max(1, Math.floor(s) % 2147483646);
    return () => (x = (x * 16807) % 2147483647) / 2147483647;
  };
  const MARGIN = [];
  (() => {
    const r = seeded(91),
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
          kind: kinds[MARGIN.length % kinds.length],
          ph: r() * 6,
          shake: 0,
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
    return { x, y, w, h };
  }
  /* ---------- background ---------- */
  const bg = document.createElement("canvas");
  bg.width = BW;
  bg.height = BH;
  function paintBg() {
    const g = bg.getContext("2d");
    g.translate(-WX0, -WY0);
    const rnd = seeded(77);
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
  /* ---------- the feel layer (farm-feel.ts): particles, light, taps, sound ---------- */
  const feel = new FarmFeel({
    reduced: !!options.reduced,
    low: () => low,
    width: WW,
    height: 800,
  });
  const sfx = (cue, step = 0) => {
    try {
      options.sound?.(cue, step);
    } catch {}
  };
  // Time of day follows the device clock, as in the Plaza (tests can set it).
  let todOverride = null,
    TOD = deviceTimeOfDay();
  const TREES = [
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
  ].map(([x, y, kind, sz], i) => ({
    x,
    y,
    kind,
    t: GFX.tree(kind, 50 + i, sz),
    ph: i,
    shake: 0,
  }));
  /** Your home. Its name is a tag above it, like every building's. */
  const HOUSE_SPR = () =>
    GFX.house({
      wall: "#fff3dd",
      roof: "#d9473f",
      shutters: "#4fae46",
      w: 150,
      sd: 9,
    });
  /** Squash-and-stretch after a tap (house, mill, barn…): 1 → 0. */
  const bounce = {};
  const squash = (k) => {
    const b = (typeof k === "string" ? bounce[k] : k.bump) || 0;
    return b > 0 ? Math.sin((1 - b) * Math.PI * 3) * b * 0.08 : 0;
  };
  function blitB(key, spr, x, y) {
    const k = squash(key);
    if (!k) return GFX.blit(ctx, spr, x, y);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 + k, 1 - k);
    GFX.blit(ctx, spr, 0, 0);
    ctx.restore();
  }
  /* Placing decor: each spot you can tap glows on the ground (a pulsing light,
     a solid ring, marching dashes and a ripple), gold to place and coral to
     put away; a pin over it (drawn with the labels, above trees) says what a
     tap does. Putting away marks only the spots that have decor. */
  const decorTarget = (k) =>
    !!F.decorPick && (F.decorPick !== "__remove" || !!F.decor[k]);
  const decorRgb = () =>
    F.decorPick === "__remove" ? "255,122,89" : "255,214,91";
  function drawDecorSpot(x, y, k, time) {
    const rgb = decorRgb(),
      pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(time * 4 + k);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.4);
    glow(ctx, 0, 0, 64, rgb, 0.35 + 0.3 * pulse);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = `rgba(${rgb},${0.8 + 0.2 * pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y, 42 + 3 * pulse, 17 + 1.2 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = reduced ? 0 : -time * 24;
    ctx.beginPath();
    ctx.ellipse(x, y, 52, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!reduced) {
      const r = (time * 0.7 + k * 0.13) % 1;
      ctx.strokeStyle = `rgba(${rgb},${0.6 * (1 - r)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, 44 + 34 * r, 18 + 14 * r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  /** The pin over a decor spot: + to place, ⟳ to swap, × to put away. */
  function drawDecorPins(time, z) {
    if (!F.decorPick || V) return;
    const rm = F.decorPick === "__remove",
      rgb = decorRgb();
    // Night, moonlight and rain darken the ground rings with the farm: light
    // them again on top, as strong as the dark, so they read at any hour.
    const w = F.weather.cur,
      dark = Math.max(
        nightLevel(TOD),
        w === "moon" ? 0.85 : 0,
        w === "storm" ? 0.5 : w === "rain" ? 0.3 : 0,
      );
    if (dark > 0.05)
      DECO_SLOTS.forEach(([x, y], k) => {
        if (!decorTarget(k)) return;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, dark * 1.2);
        drawDecorSpot(x, y, k, time);
        ctx.restore();
      });
    DECO_SLOTS.forEach(([x, y], k) => {
      if (!decorTarget(k)) return;
      const bob = reduced ? 0 : Math.sin(time * 3 + k) * 4 * z,
        r = 14 * z,
        cy = y - 62 - bob;
      ctx.save();
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.strokeStyle = "#2a1a05";
      ctx.lineWidth = 2.5 * z;
      ctx.beginPath();
      ctx.moveTo(x - 6 * z, cy + r - 2 * z);
      ctx.lineTo(x, cy + r + 9 * z);
      ctx.lineTo(x + 6 * z, cy + r - 2 * z);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#2a1a05";
      ctx.lineWidth = 3 * z;
      ctx.lineCap = "round";
      ctx.beginPath();
      const a = 6 * z;
      if (rm) {
        ctx.moveTo(x - a, cy - a);
        ctx.lineTo(x + a, cy + a);
        ctx.moveTo(x + a, cy - a);
        ctx.lineTo(x - a, cy + a);
      } else if (F.decor[k]) {
        // Swap: a circular arrow.
        ctx.arc(x, cy, a, -Math.PI * 0.2, Math.PI * 1.35);
        ctx.moveTo(x + a * 0.81, cy - a * 0.59);
        ctx.lineTo(x + a * 0.95, cy - a * 1.35);
        ctx.moveTo(x + a * 0.81, cy - a * 0.59);
        ctx.lineTo(x + a * 0.05, cy - a * 0.5);
      } else {
        ctx.moveTo(x - a, cy);
        ctx.lineTo(x + a, cy);
        ctx.moveTo(x, cy - a);
        ctx.lineTo(x, cy + a);
      }
      ctx.stroke();
      ctx.restore();
    });
  }
  /* The wishing well twinkles: a shimmer on the water and stars that drift
     up out of it and fade, gold and busier while today's wish is waiting. */
  function drawWellSparkles(time) {
    const ready = F.wishReady && !V,
      n = ready ? 9 : 5,
      rgb = ready ? "255,214,91" : "150,220,255";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // A soft light in the water, breathing slowly.
    const sh = 0.5 + 0.5 * Math.sin(time * 2.2);
    ctx.save();
    ctx.translate(WELL.x, WELL.y - 30);
    ctx.scale(1, 0.32);
    glow(ctx, 0, 0, 44, rgb, (ready ? 0.7 : 0.4) * (0.6 + 0.4 * sh));
    ctx.restore();
    for (let k = 0; k < n; k++) {
      // Each star rises 90px over its own 2.4–3.6 s, offset so they never bunch.
      const per = 2.4 + (k % 4) * 0.4,
        f = (time / per + k * 0.37) % 1,
        x = WELL.x + Math.sin(k * 2.39 + time * 0.9) * (14 + (k % 3) * 9),
        y = WELL.y - 32 - f * 90,
        a = Math.sin(Math.PI * f),
        sz = (ready ? 7 : 5) * (0.6 + 0.4 * a);
      glow(ctx, x, y, sz * 2.6, rgb, 0.45 * a);
      ctx.globalAlpha = a;
      ctx.fillStyle = ready ? "#fff3c4" : "#eefaff";
      star(ctx, x, y, sz);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function drawTreeS(tr, time, shadowK) {
    if (!(tr.shake > 0))
      return GFX.drawTree(ctx, tr.t, tr.x, tr.y, time, tr.ph, shadowK);
    ctx.save();
    ctx.translate(tr.x, tr.y);
    ctx.rotate(Math.sin(time * 42) * 0.07 * tr.shake);
    GFX.drawTree(ctx, tr.t, 0, 0, time, tr.ph, shadowK);
    ctx.restore();
  }
  let millA = 0,
    millBoost = 0,
    catAwake = 0,
    scareSpin = 0,
    duckRush = 0,
    chirpT = 3,
    rainLevel = -1;
  /** Birds startled out of a tree: they fly off the top of the farm. */
  const flyAway = [];
  const FIREFLIES = Array.from({ length: 34 }, (_, k) => ({
    x:
      [OX - 40, OX + FW + 40, POND.x, WELL.x, 900, 1500][k % 6] +
      Math.sin(k * 7.1) * 140,
    y:
      [OY + 120, OY + 160, POND.y - 30, WELL.y - 30, 820, 760][k % 6] +
      Math.cos(k * 3.3) * 90,
    ph: k * 1.37,
    sp: 0.4 + (k % 5) * 0.15,
  }));
  const windAt = (x) =>
    Math.sin(T * 1.25 - x * 0.007) * 0.6 +
    Math.sin(T * 0.43 + 1.3) * 0.4 +
    (F.weather.cur === "storm" ? Math.sin(T * 3.1 - x * 0.01) * 0.8 : 0);
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
      const pr = seeded(i * 13 + 5);
      for (let k = 0; k < 9; k++) {
        const x = 8 + pr() * (PW - 16),
          y = 10 + pr() * (PH - 14);
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
    GFX.blit(g, soilArt(wetNow(p), p.fert), r.x, r.y);
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
      sway =
        st >= 2
          ? Math.sin(time * 1.6 + i) * 0.025 +
            (reduced ? 0 : windAt(cx) * 0.035)
          : 0;
    if (st === 4 && (mut === "gold" || mut === "rainbow") && !low) {
      const pulse = 0.55 + 0.25 * Math.sin(time * 3 + i),
        col =
          mut === "gold"
            ? "255,200,60"
            : `${Math.round(160 + 90 * Math.sin(time * 2))},${Math.round(160 + 90 * Math.sin(time * 2 + 2))},${Math.round(160 + 90 * Math.sin(time * 2 + 4))}`;
      g.save();
      g.globalCompositeOperation = "lighter";
      glow(g, cx, base - 30, 64, col, 0.45 * pulse);
      g.restore();
    }
    if (im && (im.complete ?? true)) {
      g.save();
      g.translate(cx, base + 6);
      g.rotate(
        sway + (p.wob > 0 ? Math.sin((1 - p.wob) * 22) * 0.16 * p.wob : 0),
      );
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
      g.fillStyle = wetNow(p) ? "#7fd4ff" : "#7ff0a2";
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
  /* Rain splashes ring out on the ground itself, drawn before the houses,
     trees and animals, so anything standing in front of a splash covers it
     (they used to ring out on roofs and treetops). In world space, spread
     over what the camera sees, the same density at any zoom. */
  function drawRainSplashes(g, time) {
    const w = F.weather.cur;
    if (w !== "rain" && w !== "storm") return;
    const heavy = w === "storm",
      vw = VW / Z,
      vh = VH / Z,
      x0 = cam.x - vw / 2,
      y0 = cam.y - vh / 2,
      n = Math.round((heavy ? 54 : 40) * (low ? 0.5 : 1));
    g.save();
    // A touch stronger than the drops: the rain's tint is drawn over them.
    g.strokeStyle = "rgba(225,242,255,.95)";
    g.lineWidth = 1.7 / Math.max(0.6, Z);
    for (let k = 0; k < n; k++) {
      const c = time * 2.4 + k * 0.37,
        ph = c % 1,
        cyc = Math.floor(c),
        // Spread over the view in fractions, so a splash keeps its place on
        // the ground for its whole ring.
        fx = ((k * 211.7 + cyc * 157) % 1000) / 1000,
        fy = ((k * 137.3 + cyc * 89) % 1000) / 1000;
      const sx = x0 + fx * vw,
        sy = y0 + fy * vh;
      g.globalAlpha = 1 - ph;
      g.beginPath();
      g.ellipse(sx, sy, 3 + ph * 11, 1.3 + ph * 3.6, 0, 0, Math.PI * 2);
      g.stroke();
      // Every third drop throws up two droplets that arc back down.
      if (k % 3 === 0 && ph < 0.5) {
        const q = ph / 0.5,
          up = Math.sin(q * Math.PI) * 9;
        g.fillStyle = "rgba(225,242,255,.9)";
        g.fillRect(sx - 3 - q * 7, sy - up, 1.6, 1.6);
        g.fillRect(sx + 2 + q * 7, sy - up * 0.8, 1.6, 1.6);
      }
    }
    g.restore();
  }
  /* Weather, drawn over the farm in screen space but tied to the world:
     rain and snow fall in depth layers that shift with the camera, lean
     with a gusting wind and never repeat in a visible grid (each drop has
     its own length, speed and place); storms bring real lightning (a
     branching bolt, a flicker, thunder after it; none with reduced motion);
     the sun casts soft shafts; a rainbow is a soft spectral bow with a faint
     second one outside it. Low graphics draws about half. */
  const WX = { flash: 0, next: 4, boltT: -9, bolt: null, rainbow: null };
  /** A fixed random number in [0, 1) for drop k of layer s. */
  const wxHash = (k, s) => {
    const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  /** The wind's lean (horizontal per vertical), gusting slowly. */
  const wxWind = (w, time) =>
    (w === "storm" ? 0.42 : w === "frost" ? 0.2 : 0.24) +
    Math.sin(time * 0.37) * 0.08 +
    Math.sin(time * 1.3 + 1) * 0.03;
  /** How far a layer at `depth` (0 far … 1 near) has moved with the camera. */
  const wxPan = (depth) => ({ x: -cam.x * Z * depth, y: -cam.y * Z * depth });
  const wxMod = (v, m) => ((v % m) + m) % m;
  /** A soft round flake, drawn once. */
  let flakeSprite;
  function flakeImg() {
    if (flakeSprite) return flakeSprite;
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d"),
      gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.45, "rgba(255,255,255,.75)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    return (flakeSprite = c);
  }
  /** A jagged bolt from the clouds, with a few forks. */
  function makeBolt() {
    const main = [];
    let x = VW * (0.15 + Math.random() * 0.7),
      y = -10;
    const end = VH * (0.42 + Math.random() * 0.3);
    main.push([x, y]);
    while (y < end) {
      x += (Math.random() - 0.5) * 70;
      y += 22 + Math.random() * 30;
      main.push([x, y]);
    }
    const forks = [];
    for (let k = 2; k < main.length - 2; k++)
      if (Math.random() < 0.3) {
        let [fx, fy] = main[k];
        const dir = Math.random() < 0.5 ? -1 : 1,
          f = [[fx, fy]];
        for (let n = 0; n < 3 + Math.random() * 3; n++) {
          fx += dir * (10 + Math.random() * 30);
          fy += 14 + Math.random() * 22;
          f.push([fx, fy]);
        }
        forks.push(f);
      }
    return { main, forks };
  }
  function strokePath(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
    g.stroke();
  }
  function drawRain(g, time, heavy) {
    const wind = wxWind(heavy ? "storm" : "rain", time),
      share = low ? 0.5 : 1;
    // The cloud deck darkens the top; mist lies low over the ground.
    const sky = g.createLinearGradient(0, 0, 0, VH);
    sky.addColorStop(0, heavy ? "rgba(16,22,40,.66)" : "rgba(38,54,88,.42)");
    sky.addColorStop(0.45, heavy ? "rgba(20,28,52,.36)" : "rgba(34,50,90,.2)");
    sky.addColorStop(1, heavy ? "rgba(40,52,78,.34)" : "rgba(70,90,120,.2)");
    g.fillStyle = sky;
    g.fillRect(0, 0, VW, VH);
    // Curtains of heavier rain sweep across now and then.
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      const cx = wxMod(k * 520 + time * (40 + k * 12), VW + 900) - 450,
        a = (heavy ? 0.06 : 0.04) * (0.6 + 0.4 * Math.sin(time * 0.5 + k));
      const band = g.createLinearGradient(cx - 220, 0, cx + 220, 0);
      band.addColorStop(0, "rgba(200,215,240,0)");
      band.addColorStop(0.5, `rgba(200,215,240,${a})`);
      band.addColorStop(1, "rgba(200,215,240,0)");
      g.fillStyle = band;
      g.beginPath();
      g.moveTo(cx - 220, 0);
      g.lineTo(cx + 220, 0);
      g.lineTo(cx + 220 + VH * wind, VH);
      g.lineTo(cx - 220 + VH * wind, VH);
      g.fill();
    }
    g.restore();
    // Three layers of drops, far to near.
    g.lineCap = "round";
    for (const [layer, n, len, sp, lw, a, depth] of [
      [1, heavy ? 160 : 120, 12, 620, 1, 0.3, 0.15],
      [2, heavy ? 130 : 95, 20, 900, 1.5, 0.5, 0.4],
      [3, heavy ? 75 : 50, 34, 1350, 2.3, 0.62, 0.8],
    ]) {
      const pan = wxPan(depth),
        span = VW + 400;
      g.strokeStyle = `rgba(214,230,255,${a})`;
      g.lineWidth = lw;
      g.beginPath();
      for (let k = 0; k < n * share; k++) {
        const r1 = wxHash(k, layer),
          r2 = wxHash(k, layer + 10),
          r3 = wxHash(k, layer + 20),
          L = len * (0.7 + r2 * 0.6),
          fall = time * sp * (0.85 + r3 * 0.3) + r1 * 5000,
          y = wxMod(fall + pan.y, VH + L * 2) - L,
          x = wxMod(r1 * span + y * wind + pan.x, span) - 200;
        g.moveTo(x, y);
        g.lineTo(x - L * wind, y - L);
      }
      g.stroke();
    }
    if (heavy) drawLightning(g, time);
  }
  function drawLightning(g, time) {
    // Spaced out and gentle; never with reduced motion (no flashing).
    if (reduced) return;
    if (time >= WX.next) {
      WX.next = time + 6 + Math.random() * 9;
      WX.boltT = time;
      WX.bolt = makeBolt();
      // Thunder follows, later the farther the strike.
      setTimeout(() => sfx("thunder"), 300 + Math.random() * 1200);
    }
    const k = time - WX.boltT;
    if (k > 0.6 || !WX.bolt) return;
    // Two flickers, then a fading glow.
    const on = k < 0.08 || (k > 0.14 && k < 0.22) ? 1 : 0.35,
      a = (1 - k / 0.6) * on;
    g.save();
    g.fillStyle = `rgba(225,232,255,${0.32 * a})`;
    g.fillRect(0, 0, VW, VH);
    g.globalCompositeOperation = "lighter";
    g.lineJoin = "round";
    g.lineCap = "round";
    for (const [lw, c] of [
      [16, `rgba(150,180,255,${0.2 * a})`],
      [6, `rgba(200,220,255,${0.5 * a})`],
      [2.6, `rgba(255,255,255,${a})`],
    ]) {
      g.lineWidth = lw;
      g.strokeStyle = c;
      strokePath(g, WX.bolt.main);
      g.lineWidth = lw * 0.6;
      for (const f of WX.bolt.forks) strokePath(g, f);
    }
    g.restore();
  }
  function drawSnow(g, time) {
    const wind = wxWind("frost", time),
      share = low ? 0.5 : 1,
      img = flakeImg();
    // A cold, pale sky and a little haze.
    const sky = g.createLinearGradient(0, 0, 0, VH);
    sky.addColorStop(0, "rgba(214,232,250,.34)");
    sky.addColorStop(0.5, "rgba(226,240,255,.1)");
    sky.addColorStop(1, "rgba(230,244,255,.16)");
    g.fillStyle = sky;
    g.fillRect(0, 0, VW, VH);
    for (const [layer, n, r, sp, a, depth] of [
      [4, 110, 1.4, 22, 0.55, 0.15],
      [5, 70, 2.8, 36, 0.8, 0.45],
      [6, 24, 6.5, 62, 0.85, 0.85],
    ]) {
      const pan = wxPan(depth),
        span = VW + 200;
      for (let k = 0; k < n * share; k++) {
        const r1 = wxHash(k, layer),
          r2 = wxHash(k, layer + 10),
          r3 = wxHash(k, layer + 20),
          R = r * (0.7 + r2 * 0.6),
          y =
            wxMod(time * sp * (0.8 + r3 * 0.4) + r1 * 3000 + pan.y, VH + 40) -
            20,
          // Mostly straight down: a slow, slight sway and a gentle drift.
          sway = Math.sin(time * (0.25 + r2 * 0.25) + r1 * 9) * (1 + 2 * depth),
          x =
            wxMod(
              r1 * span +
                time * wind * 6 * depth +
                y * wind * 0.12 +
                sway +
                pan.x,
              span,
            ) - 100;
        g.globalAlpha = a * (0.7 + 0.3 * r3);
        g.drawImage(img, x - R * 1.6, y - R * 1.6, R * 3.2, R * 3.2);
      }
    }
    g.globalAlpha = 1;
    // Frost creeps in at the edges of the view.
    const vg = g.createRadialGradient(
      VW / 2,
      VH / 2,
      VH * 0.4,
      VW / 2,
      VH / 2,
      VH * 1.05,
    );
    vg.addColorStop(0, "rgba(220,245,255,0)");
    vg.addColorStop(1, "rgba(228,246,255,.45)");
    g.fillStyle = vg;
    g.fillRect(0, 0, VW, VH);
  }
  function drawSun(g, time) {
    // The sun stands off the top right; its light fans out in soft shafts.
    const sx = VW * 0.95,
      sy = -VH * 0.28;
    g.save();
    g.globalCompositeOperation = "lighter";
    const glowR = VH * 0.95,
      gl = g.createRadialGradient(sx, sy, 0, sx, sy, glowR);
    gl.addColorStop(0, "rgba(255,240,190,.3)");
    gl.addColorStop(0.4, "rgba(255,230,170,.1)");
    gl.addColorStop(1, "rgba(255,230,170,0)");
    g.fillStyle = gl;
    g.fillRect(0, 0, VW, VH);
    const reach = Math.hypot(VW, VH) * 1.15;
    for (let k = 0; k < (low ? 4 : 7); k++) {
      const ang =
          Math.PI * (0.6 + k * 0.055) + Math.sin(time * 0.15 + k) * 0.01,
        wid = 0.012 + wxHash(k, 30) * 0.02,
        a = 0.07 + 0.05 * Math.sin(time * 0.5 + k * 1.7);
      const ex = sx + Math.cos(ang) * reach,
        ey = sy + Math.sin(ang) * reach,
        sh = g.createLinearGradient(sx, sy, ex, ey);
      sh.addColorStop(0, `rgba(255,242,200,${a})`);
      sh.addColorStop(0.55, `rgba(255,242,200,${a * 0.45})`);
      sh.addColorStop(1, "rgba(255,242,200,0)");
      g.fillStyle = sh;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(
        sx + Math.cos(ang - wid) * reach,
        sy + Math.sin(ang - wid) * reach,
      );
      g.lineTo(
        sx + Math.cos(ang + wid) * reach,
        sy + Math.sin(ang + wid) * reach,
      );
      g.fill();
    }
    // Dust drifting in the light.
    const wind = 0.15 + Math.sin(time * 0.2) * 0.05;
    for (let k = 0; k < (low ? 14 : 28); k++) {
      const r1 = wxHash(k, 40),
        r2 = wxHash(k, 41),
        x = wxMod(
          r1 * VW + time * 12 * wind * (1 + r2) + Math.sin(time * 0.5 + k) * 20,
          VW,
        ),
        y = wxMod(r2 * VH + Math.sin(time * 0.3 + k * 2) * 18 - time * 3, VH),
        a = (0.35 + 0.65 * Math.abs(Math.sin(time * 0.8 + k))) * 0.45;
      g.fillStyle = `rgba(255,244,200,${a})`;
      g.beginPath();
      g.arc(x, y, 1.1 + r2 * 1.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  /** The rainbow, drawn once per screen size: a soft spectral bow that fades
   *  into the ground at both ends, and a faint second bow outside it with
   *  its colours reversed, the sky brighter inside the main bow. */
  function rainbowImg() {
    const key = `${VW}x${VH}`;
    if (WX.rainbow?.key === key) return WX.rainbow.c;
    const c = document.createElement("canvas");
    c.width = VW;
    c.height = VH;
    const g = c.getContext("2d"),
      cx = VW * 0.5,
      cy = VH * 1.08,
      R = Math.min(VW * 0.56, 780),
      cols = [
        "255,70,70",
        "255,150,60",
        "255,225,90",
        "100,210,120",
        "80,170,255",
        "90,110,240",
        "160,110,240",
      ];
    // Brighter sky inside the bow.
    const inside = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    inside.addColorStop(0.6, "rgba(255,255,255,0)");
    inside.addColorStop(1, "rgba(255,255,255,.07)");
    g.fillStyle = inside;
    g.beginPath();
    g.arc(cx, cy, R, Math.PI, 0);
    g.fill();
    const bow = (r0, band, order, alpha) => {
      const seg = 28;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[order ? i : cols.length - 1 - i],
          r = r0 - i * band;
        for (let s = 0; s < seg; s++) {
          const a0 = Math.PI + (Math.PI * s) / seg,
            a1 = Math.PI + (Math.PI * (s + 1)) / seg,
            fade = Math.pow(Math.sin(((s + 0.5) / seg) * Math.PI), 0.7);
          for (const [lw, k] of [
            [band * 2.2, 0.35],
            [band * 1.1, 1],
          ]) {
            g.strokeStyle = `rgba(${col},${alpha * fade * k})`;
            g.lineWidth = lw;
            g.beginPath();
            g.arc(cx, cy, r, a0, a1 + 0.002);
            g.stroke();
          }
        }
      }
    };
    bow(R, 8, true, 0.3);
    bow(R * 1.3, 9, false, 0.11);
    WX.rainbow = { key, c };
    return c;
  }
  function drawWeather(g, time) {
    const w = F.weather.cur;
    if (w === "rain" || w === "storm") drawRain(g, time, w === "storm");
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
    if (w === "frost") drawSnow(g, time);
    if (w === "rainbow") {
      g.drawImage(rainbowImg(), 0, 0);
      // Drops still glinting in the air after the rain.
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < (low ? 12 : 24); k++) {
        const a = (0.5 + 0.5 * Math.sin(time * 4 + k * 1.3)) * 0.6,
          x = wxMod(wxHash(k, 50) * VW + time * 8, VW),
          y = wxHash(k, 51) * VH * 0.75;
        g.fillStyle = `rgba(255,250,230,${a})`;
        g.beginPath();
        g.moveTo(x, y - 4);
        g.lineTo(x + 1.3, y);
        g.lineTo(x, y + 4);
        g.lineTo(x - 1.3, y);
        g.fill();
      }
      g.restore();
    }
    if (w === "sun") drawSun(g, time);
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
    if (s.me && ["hand", "sickle"].includes(F.tool))
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
    const t = tour?.find((x) => x.id === V.id);
    el.innerHTML = `<img src="${options.art(V.fighter)}" alt=""><div><b>${esc(V.name)}'s Farm</b><small>${V.dog ? `${I("dog")} ${DOG[V.dog]?.name ?? "A dog"} is on guard. Sneaking may get you caught` : "No guard dog"}</small></div>${options.here ? emoteButtons() : ""}${options.like ? `<button type="button" data-like="${esc(V.id)}" ${t?.liked ? "disabled" : ""}>${t?.liked ? "Liked" : "❤ Like"}</button>` : ""}<button type="button" data-home>← My farm</button>`;
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
      present.clear();
      void ping();
      if (!tour) void loadTour();
    } catch (e) {
      toast(e?.message || "Couldn't visit that farm.");
    }
  }
  async function goHome() {
    await visitFlush();
    V = null;
    F.tool = "hand";
    present.clear();
    void ping();
    renderVisit();
    renderAll();
    // Helping friends gave you farm XP.
    await refresh();
  }
  /* ---------- live visits, Harvest Parties and likes (migration 061) ---------- */
  const likesOf = (id) => {
    const t = tour?.find((x) => x.id === id);
    return t ? ` · ❤ ${t.likes}${t.here ? " · on their farm now" : ""}` : "";
  };
  let here = null,
    tour = null,
    hereAt = 0,
    party = false;
  const shownEmote = new Map(),
    present = new Map();
  const EMO = FARM_EMOTES;
  async function ping(emote) {
    if (!options.here || document.hidden) return;
    hereAt = performance.now();
    try {
      const h = await options.here(V ? V.id : null, emote);
      here = h;
      const was = party;
      party = !V && h.party;
      if (party && !was) {
        const who = h.present.find((p) => !p.owner)?.name ?? "A friend";
        toast(`Harvest Party with ${who}! Each harvest gives one more crop`);
        log(
          `<b>Harvest Party</b> with ${esc(who)} · +${PARTY.bonus} crop a harvest`,
          "good",
        );
        sfx("fanfare");
        feel.pop(VW / 2, VH * 0.3, 50);
      }
      syncPresent(h);
      renderHere();
    } catch {
      /* offline: try again next time */
    }
  }
  /** Friends on the farm stand by the field gate, each with their fighter. */
  function syncPresent(h) {
    const ids = new Set(h.present.map((p) => p.id));
    for (const id of [...present.keys()]) if (!ids.has(id)) present.delete(id);
    h.present.forEach((p, k) => {
      let a = present.get(p.id);
      if (!a) {
        const im = new Image();
        im.src = options.art(p.fighter);
        a = {
          im,
          name: p.name,
          x: FCX + (k % 2 ? 1 : -1) * (90 + 60 * k),
          t0: Math.random() * 6,
        };
        present.set(p.id, a);
        if (!p.owner) sfx("boing");
      }
      if (p.emote && p.emoteAt && shownEmote.get(p.id) !== p.emoteAt) {
        shownEmote.set(p.id, p.emoteAt);
        a.emote = EMO[p.emote] ?? null;
        a.emoteT = performance.now();
      }
    });
  }
  function drawPresent(items, time) {
    let k = 0;
    for (const a of present.values()) {
      const x = a.x,
        y = FR.y1 + 52 + (k++ % 2) * 14;
      items.push({
        y,
        d: () => {
          const bob = reduced ? 0 : Math.abs(Math.sin(time * 2.2 + a.t0)) * 3;
          ctx.fillStyle = "rgba(0,0,0,.26)";
          ctx.beginPath();
          ctx.ellipse(x, y, 24, 8, 0, 0, 7);
          ctx.fill();
          if (a.im.complete) ctx.drawImage(a.im, x - 40, y - 78 - bob, 80, 81);
          nameTag(ctx, a.name.toUpperCase(), x, y - 96);
          const age = (performance.now() - (a.emoteT ?? 0)) / 1000;
          if (a.emote && age < 3) {
            const s = Math.min(1, age / 0.18);
            ctx.save();
            ctx.translate(x, y - 128);
            ctx.scale(s, s);
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.roundRect(-22, -18, 44, 32, 12);
            ctx.fill();
            ctx.font =
              "20px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(a.emote, 0, -2);
            ctx.textBaseline = "alphabetic";
            ctx.restore();
          }
        },
      });
    }
  }
  /** On your farm with friends there: who is here, the party, emotes. */
  function renderHere() {
    const el = $("fm-here");
    if (V || !here || !here.present.length) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const names = here.present.map((p) => esc(p.name)).join(", ");
    el.innerHTML = `<div><b>${names} ${here.present.length > 1 ? "are" : "is"} here</b><small>${party ? `Harvest Party: +${PARTY.bonus} crop a harvest · ${Math.ceil(here.partyLeft / 60)} min left today` : "No party minutes left today"}</small></div>${emoteButtons()}`;
  }
  const emoteButtons = () =>
    `<span class="fm-emotes">${Object.entries(EMO)
      .map(
        ([k, e]) =>
          `<button type="button" data-emote="${k}" aria-label="${k}">${e}</button>`,
      )
      .join("")}</span>`;
  async function loadTour() {
    if (!options.tour) return;
    try {
      tour = await options.tour();
    } catch {
      return;
    }
    if (sheet === "friends") renderSheet();
    renderVisit();
  }
  async function likeFarm(owner) {
    if (!options.like) return;
    try {
      const r = await options.like(owner);
      tour = r.tour;
      if (r.ok) {
        sfx("chime");
        feel.burst(cam.x, cam.y, 10, "heart", {
          v: 90,
          up: 60,
          life: 1.1,
          s: 18,
          c: "#ff7aa8",
        });
        toast("You liked this farm");
      } else toast(r.error || "That didn't work.");
    } catch (e) {
      toast(e?.message || "Couldn't reach your farm. Check your connection.");
    }
    renderVisit();
  }
  /* ---------- the Farm Stall and the Valley Paper (migration 059) ---------- */
  let stall = options.initialStall ?? null,
    stallSlot = null;
  const stallForm = { key: null, qty: 1, f: 1.1 };
  async function loadStall() {
    if (!options.stall) return;
    try {
      stall = await options.stall();
    } catch {
      return;
    }
    if (sheet === "market") renderSheet();
  }
  async function stallAct(action) {
    if (!options.stallAct) return;
    try {
      const r = await options.stallAct(action);
      stall = r;
      if (!r.ok) {
        if (!r.repeated) toast(r.error || "That didn't work.");
      } else if (action.kind === "list") {
        sfx("boing");
        bounce.stall = 1;
        stallSlot = null;
        toast("On your stall. Friends see it in the Valley Paper.");
      } else if (action.kind === "unlist") {
        sfx("tick");
      } else if (action.kind === "collect") {
        sfx("coin");
        bounce.stall = 1;
        feel.burst(STALL.x, STALL.y - 120, 14, "spark", { v: 160 });
        feel.text(
          STALL.x,
          STALL.y - 140,
          `+${r.gained?.leaves}`,
          "#ffd65b",
          34,
        );
        toast(
          `Collected ${r.gained?.leaves} Gold Leaves (the stall kept ${r.gained?.fee})`,
        );
      } else if (action.kind === "buy") {
        sfx("coin");
        toast(
          `Bought ${r.gained?.qty} ${CROP[r.gained?.crop]?.n ?? "crops"}. They're in your barn.`,
        );
      }
      void refresh();
    } catch (e) {
      toast(e?.message || "Couldn't reach your farm. Check your connection.");
    }
    if (sheet === "market") renderSheet();
  }
  const stallRange = (key, qty) => {
    const unit = price(key);
    return {
      min: Math.ceil(unit * qty * STALL_RULES.minPrice),
      max: Math.floor(unit * qty * STALL_RULES.maxPrice),
      unit,
    };
  };
  const stallPrice = () => {
    const r = stallRange(stallForm.key, stallForm.qty);
    return Math.max(
      r.min,
      Math.min(r.max, Math.round(r.unit * stallForm.qty * stallForm.f)),
    );
  };
  function stallHTML() {
    if (!stall) return `<p class="sh-note">Loading your stall…</p>`;
    const shelves = Array.from({ length: STALL_RULES.shelves }, (_, k) => {
      const s = stall.shelves.find((x) => x.slot === k);
      if (!s)
        return `<button type="button" class="fm-shelf empty${stallSlot === k ? " picked" : ""}" data-shelf="${k}"><b>+</b><small>Empty shelf</small></button>`;
      const c = CROP[s.crop];
      if (s.sold)
        return `<div class="fm-shelf sold"><img src="${icon(s.crop)}" alt=""><small>Sold to <b>${esc(s.buyer ?? "a friend")}</b></small><button type="button" class="btn-s gold" data-scollect="${k}">Collect ${s.collect}</button></div>`;
      return `<div class="fm-shelf"><img src="${icon(s.crop)}" alt=""><b>${s.qty} ${esc(c?.n ?? s.crop)}${s.mutation ? ` · ${s.mutation}` : ""}</b><small class="price">${s.price} ${L}</small><button type="button" class="btn-s ghost" data-sunlist="${k}">Take down</button></div>`;
    }).join("");
    let form = "";
    if (stallSlot != null) {
      const keys = Object.entries(F.barn).filter(([, n]) => n > 0);
      if (!keys.length)
        form = `<p class="sh-note">Your barn is empty. Harvest something to sell first.</p>`;
      else {
        if (!stallForm.key || !F.barn[stallForm.key])
          stallForm.key = keys[0][0];
        const have = F.barn[stallForm.key];
        stallForm.qty = Math.max(
          1,
          Math.min(stallForm.qty, have, STALL_RULES.maxQty),
        );
        const r = stallRange(stallForm.key, stallForm.qty);
        form = `<div class="fm-stall-form"><label>Crop<select id="fm-st-crop">${keys
          .map(([k, n]) => {
            const [id, mut] = k.split("|");
            return `<option value="${esc(k)}"${k === stallForm.key ? " selected" : ""}>${esc(CROP[id]?.n ?? id)}${mut ? ` (${esc(mut)})` : ""} · have ${n}</option>`;
          })
          .join(
            "",
          )}</select></label><label>How many<select id="fm-st-qty">${Array.from(
          { length: Math.min(have, STALL_RULES.maxQty) },
          (_, i) =>
            `<option${i + 1 === stallForm.qty ? " selected" : ""}>${i + 1}</option>`,
        ).join(
          "",
        )}</select></label><label>Price <b id="fm-st-f">${stallForm.f.toFixed(1)}×</b> the market<input id="fm-st-price" type="range" min="${STALL_RULES.minPrice}" max="${STALL_RULES.maxPrice}" step="0.1" value="${stallForm.f}"></label><p class="sh-note" id="fm-st-read">Asking <b>${stallPrice()} ${L}</b> · the Market pays ${r.unit * stallForm.qty}</p><button type="button" class="btn-s gold fm-wide" data-slist>Put on shelf ${stallSlot + 1}</button></div>`;
      }
    }
    return `<p class="sh-note">Friends see your shelves in the <b>Valley Paper</b> and buy whole shelves. Price ${STALL_RULES.minPrice}×–${STALL_RULES.maxPrice}× the market; the stall keeps ${STALL_RULES.fee * 100}%. Stall income today: ${stall.earnedToday}/${stall.earnCap} ${L}.</p><div class="fm-shelves">${shelves}</div>${form}`;
  }
  function paperHTML() {
    if (!stall) return `<p class="sh-note">Loading the Valley Paper…</p>`;
    const rows = stall.paper.map((p) => {
      const c = CROP[p.crop],
        locked = c && c.lv > F.lv;
      return `<div class="fr"><img src="${options.art(p.fighter)}" alt=""><div><b>${p.qty} ${esc(c?.n ?? p.crop)}${p.mutation ? ` · ${esc(p.mutation)}` : ""}</b><small><img class="mini" src="${icon(p.crop)}" alt=""> ${esc(p.name)}'s stall · the Market pays ${p.market}${locked ? ` · <b style="color:#ffd65b">you grow it at Lv ${c.lv}</b>` : ""}</small></div><button type="button" class="btn-s gold" data-sbuy="${esc(p.seller)}:${p.slot}" ${F.leaves < p.price || stall.boughtToday >= stall.buyCap ? "disabled" : ""}>${p.price} ${L}</button></div>`;
    });
    return `<p class="sh-note">Your friends' shelves. Buy crops you can't grow yet for orders and balloons. Bought today: ${stall.boughtToday}/${stall.buyCap}.</p>${rows.join("") || `<p class="sh-note">Your friends' shelves are empty right now.</p>`}`;
  }
  function wireStallForm(el) {
    const crop = el.querySelector("#fm-st-crop"),
      qty = el.querySelector("#fm-st-qty"),
      range = el.querySelector("#fm-st-price");
    if (!crop) return;
    const read = () => {
      const r = stallRange(stallForm.key, stallForm.qty);
      el.querySelector("#fm-st-f").textContent = `${stallForm.f.toFixed(1)}×`;
      el.querySelector("#fm-st-read").innerHTML =
        `Asking <b>${stallPrice()} ${L}</b> · the Market pays ${r.unit * stallForm.qty}`;
    };
    crop.onchange = () => {
      stallForm.key = crop.value;
      renderSheet();
    };
    qty.onchange = () => {
      stallForm.qty = +qty.value;
      read();
    };
    range.oninput = () => {
      stallForm.f = +range.value;
      read();
    };
  }
  /* ---------- the Supply Balloon and friends' help (migration 058) ---------- */
  const left = LEFT.get(options.owner ?? "");
  let balloon = options.initialBalloon ?? null,
    helpList = null;
  const BAL = { x: 1080, y: 105 },
    PEG = { x: 1104, y: 300 };
  const bal = { mode: "idle", t0: 0, armed: false };
  const balReady = () =>
    !!balloon?.crates && balloon.crates.every((c) => c.state === "done");
  async function loadBalloon() {
    if (!options.balloon) return;
    try {
      balloon = await options.balloon();
    } catch {
      return;
    }
    if (balloon.crates && bal.mode !== "idle") bal.mode = "idle";
    if (sheet === "balloon") renderSheet();
  }
  async function loadHelp() {
    if (!options.help) return;
    try {
      helpList = await options.help();
    } catch {
      return;
    }
    if (sheet === "friends") renderSheet();
  }
  async function balloonAct(kind, slot) {
    if (!options.balloonAct) return;
    try {
      const r = await options.balloonAct(kind, slot);
      if (!r.ok) {
        if (!r.repeated) toast(r.error || "That didn't work.");
      } else if (kind === "fill") {
        sfx("pop", 3);
        feel.burst(BAL.x, BAL.y + 90, 12, "spark", { v: 150, life: 0.8 });
      } else if (kind === "ask") {
        sfx("whoosh");
        toast("Asked your friends. It's on their Help list now.");
      } else if (kind === "launch") {
        bal.mode = "leave";
        bal.t0 = performance.now();
        sfx("whoosh");
        setTimeout(() => sfx("fanfare"), 300);
        feel.pop(
          (BAL.x - cam.x) * Z + VW / 2,
          (BAL.y - cam.y) * Z + VH / 2,
          90,
        );
        feel.text(
          BAL.x,
          BAL.y + 40,
          `+${r.gained?.leaves ?? ""}`,
          "#ffd65b",
          40,
        );
        toast(
          r.gained?.bonus === "gold"
            ? `Balloon launched: +${r.gained?.leaves} Gold Leaves, +${r.gained?.xp} XP and a Gold Fertilizer`
            : `Balloon sent with ${r.gained?.crates} crate${r.gained?.crates === 1 ? "" : "s"}: +${r.gained?.leaves} Gold Leaves, +${r.gained?.xp} XP`,
        );
        log(
          `Launched the <b>Supply Balloon</b> · +${r.gained?.leaves} ${L}`,
          "good",
        );
        closeSheet();
      }
      balloon = r.balloon;
      void refresh();
    } catch (e) {
      toast(e?.message || "Couldn't reach your farm. Check your connection.");
    }
    if (sheet === "balloon") renderSheet();
  }
  async function helpFill(friend, slot) {
    if (!options.helpFill) return;
    try {
      const r = await options.helpFill(friend, slot);
      if (r.ok) {
        sfx("coin");
        toast(
          `Crate filled! +${r.gained?.leaves ?? 0} Gold Leaves and a Helper Star`,
        );
        log(`Filled a friend's balloon crate · +1 Helper Star`, "good");
        void refresh();
      } else if (!r.repeated) toast(r.error || "That didn't work.");
      if (helpList) helpList.requests = r.help;
      void loadHelp();
    } catch (e) {
      toast(e?.message || "Couldn't reach your farm. Check your connection.");
    }
    if (sheet === "friends") renderSheet();
  }
  function balloonPos(time, now) {
    let x = BAL.x + (reduced ? 0 : Math.sin(time * 0.45) * 5),
      y = BAL.y + (reduced ? 0 : Math.sin(time * 0.9) * 7),
      sc = 1,
      a = 1;
    if (bal.mode === "leave") {
      const k = Math.min(1, (now - bal.t0) / 2600),
        e = k * k;
      y -= e * 700;
      x += e * 260;
      sc = 1 - e * 0.35;
      a = 1 - Math.max(0, k - 0.8) * 5;
    }
    return { x, y, sc, a };
  }
  function balloonHit(w) {
    if (V || !balloon?.crates || bal.mode !== "idle") return false;
    return (
      Math.hypot(w.x - BAL.x, (w.y - (BAL.y - 30)) * 0.9) < 85 ||
      (Math.abs(w.x - BAL.x) < 40 && w.y > BAL.y && w.y < BAL.y + 135)
    );
  }
  function drawBalloon(g, time) {
    if (V || !balloon) return;
    const now = performance.now();
    if (bal.mode === "leave" && now - bal.t0 > 2600) bal.mode = "gone";
    if (!balloon.crates || bal.mode === "gone") {
      // The next one is on its way: its tether peg waits with a sign.
      const left = balloon.arrivesAt
        ? (new Date(balloon.arrivesAt).getTime() - serverNow()) / 1000
        : 0;
      g.fillStyle = "#7a5230";
      g.fillRect(PEG.x - 3, PEG.y - 14, 6, 16);
      return;
    }
    const { x, y, sc, a } = balloonPos(time, now),
      rot = reduced ? 0 : Math.sin(time * 0.7) * 0.03,
      done = balloon.crates.filter((c) => c.state === "done").length;
    g.save();
    // Its shadow on the ground, and the tether to its peg.
    g.fillStyle = "rgba(20,40,20,.16)";
    g.beginPath();
    g.ellipse(x + 30, PEG.y + 2, 54, 13, 0, 0, 7);
    g.fill();
    if (bal.mode === "idle") {
      g.strokeStyle = "rgba(90,60,30,.8)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(PEG.x, PEG.y - 8);
      g.quadraticCurveTo(
        (PEG.x + x) / 2 + 20,
        (PEG.y + y + 110) / 2 + 30,
        x + 18,
        y + 118,
      );
      g.stroke();
      g.fillStyle = "#7a5230";
      g.fillRect(PEG.x - 3, PEG.y - 14, 6, 16);
    }
    g.globalAlpha = Math.max(0, Math.min(1, a));
    g.translate(x, y);
    g.rotate(rot);
    g.scale(sc, sc);
    g.strokeStyle = "#6b4a24";
    g.lineWidth = 2;
    for (const [p, q, r, t] of [
      [-44, 30, -26, 92],
      [44, 30, 26, 92],
      [-16, 44, -10, 92],
      [16, 44, 10, 92],
    ]) {
      g.beginPath();
      g.moveTo(p, q);
      g.lineTo(r, t);
      g.stroke();
    }
    const env = () => {
      g.beginPath();
      g.moveTo(0, 52);
      g.bezierCurveTo(-30, 40, -76, 4, -74, -44);
      g.bezierCurveTo(-72, -96, -36, -118, 0, -118);
      g.bezierCurveTo(36, -118, 72, -96, 74, -44);
      g.bezierCurveTo(76, 4, 30, 40, 0, 52);
      g.closePath();
    };
    g.save();
    env();
    g.clip();
    const cols = ["#ffd65b", "#ff7a59", "#ffd65b", "#5ec2ff"];
    for (let k = 0; k < 8; k++) {
      const a0 = -74 + (k * 148) / 8,
        a1 = -74 + ((k + 1) * 148) / 8;
      g.fillStyle = cols[k % 4];
      g.beginPath();
      g.moveTo(0, 60);
      g.bezierCurveTo(a0 * 0.4, 30, a0 * 1.25, -20, a0 * 0.9, -70);
      g.lineTo(0, -130);
      g.lineTo(a1 * 0.9, -70);
      g.bezierCurveTo(a1 * 1.25, -20, a1 * 0.4, 30, 0, 60);
      g.fill();
    }
    const sh = g.createRadialGradient(-30, -70, 10, 0, -30, 110);
    sh.addColorStop(0, "rgba(255,255,255,.5)");
    sh.addColorStop(0.35, "rgba(255,255,255,0)");
    sh.addColorStop(1, "rgba(40,20,60,.45)");
    g.fillStyle = sh;
    g.fillRect(-80, -130, 160, 190);
    g.restore();
    env();
    g.strokeStyle = "rgba(90,40,30,.55)";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = "#c4502f";
    g.beginPath();
    g.roundRect(-18, 44, 36, 10, 4);
    g.fill();
    const fl =
      (bal.mode === "idle" ? 0.6 : 1.3) +
      (reduced ? 0 : Math.sin(time * 13) * 0.2 + Math.sin(time * 7.3) * 0.2);
    g.fillStyle = `rgba(255,190,80,${0.35 * fl})`;
    g.beginPath();
    g.ellipse(0, 62, 10 * fl, 14 * fl, 0, 0, 7);
    g.fill();
    g.fillStyle = "#8a5a2f";
    g.beginPath();
    g.roundRect(-30, 88, 60, 36, 7);
    g.fill();
    g.strokeStyle = "#b07a45";
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(-28, 94 + k * 8);
      g.lineTo(28, 94 + k * 8);
      g.stroke();
    }
    g.fillStyle = "#6b4527";
    g.beginPath();
    g.roundRect(-33, 84, 66, 8, 4);
    g.fill();
    balloon.crates.slice(0, 3).forEach((c, k) => {
      const cx = -26 + k * 18;
      g.fillStyle = c.state === "done" ? "#c99a5e" : "#7a5230";
      g.beginPath();
      g.roundRect(cx, 74, 16, 10, 2);
      g.fill();
      const im = c.state === "done" ? ITEM[c.crop] : null;
      if (im?.complete) g.drawImage(im, cx - 2, 60, 20, 23);
    });
    g.restore();
  }
  function balloonHTML() {
    if (!balloon)
      return `<div class="sh-body"><p class="sh-note">Loading…</p></div>`;
    const stars = `<div class="item"><span class="ic">${I("spark")}</span><div><b>${balloon.helperStars} Helper Star${balloon.helperStars === 1 ? "" : "s"}</b><small>Fill a friend's asked crate from Friends → Help: ${BALLOON.help}× its value in ${L} (up to ${balloon.helperCap} a day; ${balloon.helperLeavesToday} today) and a Helper Star.</small></div></div>`;
    if (!balloon.crates) {
      const left = balloon.arrivesAt
        ? (new Date(balloon.arrivesAt).getTime() - serverNow()) / 1000
        : 0;
      return `<div class="sh-body"><p class="sh-note">The balloon is away. The next one floats in ${left > 0 ? `in <b>${fmtSecs(left)}</b>` : "any moment"}. Balloons launched: ${balloon.launches}.</p>${stars}</div>`;
    }
    const asked = balloon.crates.filter(
      (c) => c.state === "asked" || c.by,
    ).length;
    const crates = balloon.crates
      .map((c, k) => {
        const crop = CROP[c.crop],
          have = owned(c.crop);
        const act =
          c.state === "done"
            ? `<small class="got">✓ ${c.by ? `Filled by ${esc(balloon.helpers[c.by] ?? "a friend")}` : "Filled"}</small>`
            : have >= c.qty
              ? `<button type="button" class="btn-s green" data-bfill="${k}">Fill</button>`
              : c.state === "asked"
                ? `<small class="asked">Friends can fill it</small>`
                : `<button type="button" class="btn-s" data-bask="${k}" ${asked >= BALLOON.ask ? "disabled" : ""}>Ask friends</button>`;
        return `<div class="fm-crate ${c.state}"><img src="${icon(c.crop)}" alt=""><b>${c.qty} ${esc(crop?.n ?? c.crop)}</b><small>You have ${have}${crop && crop.lv > F.lv ? ` · grows at Lv ${crop.lv}` : ""}</small>${act}</div>`;
      })
      .join("");
    const ready = balReady(),
      done = balloon.crates.filter((c) => c.state === "done").length;
    return `<div class="sh-body"><p class="sh-note">Fill six crates for a big reward. Ask friends for the ones you can't fill (up to ${BALLOON.ask} a balloon): they get leaves and a Helper Star.</p><div class="fm-crates">${crates}</div><p class="sh-note">All six: <b>${balloon.leaves} ${L}</b> · +${balloon.xp} XP · a Gold Fertilizer.${!ready && done ? ` It can leave now with the ${done} you filled: <b>${balloon.leavesNow ?? 0} ${L}</b> · +${balloon.xpNow ?? 0} XP.` : ""}</p><button type="button" class="btn-s gold fm-wide${bal.armed ? " armed" : ""}" data-blaunch ${done ? "" : "disabled"}>${ready ? "Launch the balloon" : !done ? "Fill a crate to launch" : bal.armed ? `Tap again: leave with ${done}/6 (no Gold Fertilizer)` : `Send it off now · ${balloon.leavesNow ?? 0} ${L}`}</button>${stars}</div>`;
  }
  function helpHTML() {
    if (!helpList)
      return `<div class="sh-body"><p class="sh-note">Loading your friends' requests…</p></div>`;
    const rows = helpList.requests.map((h) => {
      const c = CROP[h.crop];
      return `<div class="fr"><img src="${options.art(h.fighter)}" alt=""><div><b>${esc(h.name)} needs ${h.qty} ${esc(c?.n ?? h.crop)}</b><small>You have ${h.have} · pays ${h.reward} ${L} + a Helper Star</small></div><button type="button" class="btn-s green" data-hfill="${esc(h.friend)}:${h.slot}" ${h.have >= h.qty ? "" : "disabled"}>Fill</button></div>`;
    });
    return `<div class="sh-body"><p class="sh-note">Crates your friends asked for on their Supply Balloons. Helper leaves today: ${helpList.helperLeavesToday}/${helpList.helperCap} · Helper Stars: ${helpList.helperStars}.</p>${rows.join("") || `<p class="sh-note">No requests right now. When a friend asks for a crate, it shows here.</p>`}</div>`;
  }
  /* ---------- gifts, friendship days and invites (migration 057) ---------- */
  let gifts = null;
  async function loadGifts() {
    if (!options.gifts) return;
    try {
      gifts = await options.gifts();
    } catch {
      gifts = gifts ?? null;
    }
    syncFriendDot();
    if (sheet === "friends") renderSheet();
  }
  function syncFriendDot() {
    $("fm-fr-dot").hidden = !(
      friendsList?.some((f) => f.bugs || f.ripe) ||
      gifts?.friends?.some((f) => f.waiting > 0)
    );
  }
  async function giftAct(kind, id) {
    const call = kind === "send" ? options.giftSend : options.giftOpen;
    if (!call) return;
    try {
      const r = await call(id);
      gifts = r.state;
      const f = gifts.friends.find((x) => x.id === id);
      if (!r.ok) toast(r.error || "That didn't work.");
      else if (kind === "send") {
        sfx("whoosh");
        toast(`Sent ${f?.name ?? "your friend"} a seed parcel`);
      } else {
        sfx("chime");
        const c = CROP[r.crop];
        toast(
          `${f?.name ?? "Your friend"}'s gift: ${r.qty} ${c?.n ?? r.crop} seed${r.qty === 1 ? "" : "s"}`,
        );
        log(
          `Opened a gift from <b>${esc(f?.name ?? "a friend")}</b> · ${r.qty} ${esc(c?.n ?? r.crop)} seeds`,
          "good",
        );
        feel.pop(VW / 2, VH * 0.4, 40);
        void refresh();
      }
    } catch (e) {
      toast(e?.message || "Couldn't reach your farm. Check your connection.");
    }
    syncFriendDot();
    if (sheet === "friends") renderSheet();
  }
  async function loadFriends() {
    try {
      friendsList = await options.friends();
    } catch {
      friendsList = friendsList ?? [];
    }
    syncFriendDot();
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
      if (p.crop && p.prog < 1 && !wetNow(p)) a = "water";
    } else if (F.tool === "net") {
      if (p.pests) a = "catch";
    } else if (F.tool === "prank") {
      if (V.today.pranks >= 3) return toast("No pranks left today (3/3)");
      if (farmPerkOf(V.farmer ?? "") === "auralynx")
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
    sfx("plant");
    p_wob(i);
    const r = plotRect(i);
    FX.push({ puff: 1, x: r.x + PW / 2, y: r.y + PH / 2, t: 0, life: 0.5 });
    return true;
  }
  /** Tapping the farm's life and buildings: purely for fun, nothing is sent. */
  function treeHit(tr, w) {
    const t = tr.t,
      half = (t.pine ? t.pine.w : t.canopy.w) * 0.5,
      top = t.pine ? t.pine.h : t.h + t.canopy.h;
    return Math.abs(w.x - tr.x) < half && w.y < tr.y + 10 && w.y > tr.y - top;
  }
  function shakeTree(tr) {
    tr.shake = 1;
    sfx("rustle");
    const t = tr.t,
      top = tr.y - (t.pine ? t.pine.h : t.h + t.canopy.h) * 0.75,
      leaves =
        tr.kind === "cherry"
          ? ["#ffc4dc", "#ffe1ec"]
          : tr.kind === "autumn"
            ? ["#ffa13d", "#e8673c", "#ffd65b"]
            : ["#4fae46", "#86cf66"];
    feel.burst(
      tr.x,
      top,
      tr.kind === "pine" ? 6 : 12,
      tr.kind === "cherry" ? "petal" : "leaf",
      {
        v: 110,
        life: 2.4,
        c: leaves,
        floor: tr.y + 14,
      },
    );
    const fruit = { apple: "#e8453c", cherry: "#ff4f7a", autumn: "#ffa13d" }[
      tr.kind
    ];
    if (fruit && !reduced)
      for (let k = 0; k < 3; k++)
        feel.fruit(
          tr.x + (Math.random() - 0.5) * 70,
          top + Math.random() * 30,
          tr.y + 8 + Math.random() * 30,
          fruit,
        );
    if (!reduced && Math.random() < 0.5)
      for (let k = 0; k < 2; k++)
        flyAway.push({
          x: tr.x + (k - 0.5) * 30,
          y: top,
          vx: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 80),
          vy: -160 - Math.random() * 60,
          ph: k,
        });
  }
  function poke(w) {
    for (const h of hens)
      if (Math.hypot(w.x - h.x, w.y - (h.y - 12)) < 32) {
        sfx("cluck");
        feel.burst(h.x, h.y - 20, 7, "feather", {
          v: 80,
          up: 60,
          g: 80,
          life: 1.5,
          c: h.k === "white" ? "#ffffff" : "#d99a5a",
        });
        for (const o of hens) {
          if (o !== h && Math.hypot(o.x - h.x, o.y - h.y) > 160) continue;
          o.hop = o === h ? 1 : 0.7;
          if (reduced) continue;
          o.fast = 0.9;
          o.wait = 0;
          o.st = "walk";
          o.tx = Math.max(
            30,
            Math.min(570, o.x + (o.x - w.x) * 3 + (Math.random() - 0.5) * 80),
          );
          o.ty = Math.max(790, Math.min(910, o.y + (Math.random() - 0.5) * 70));
        }
        return;
      }
    if (!V && dogOn() && Math.hypot(w.x - dog.x, w.y - (dog.y - 18)) < 42) {
      dogBark();
      sfx("bark");
      feel.burst(dog.x, dog.y - 50, 5, "heart", {
        v: 50,
        up: 50,
        life: 1,
        s: 15,
        c: "#ff7aa8",
      });
      return;
    }
    if (Math.hypot(w.x - (HOUSE.x - 40), w.y - HOUSE.y) < 30) {
      catAwake = 3;
      sfx("meow");
      FX.push({
        bark: 1,
        x: HOUSE.x - 40,
        y: HOUSE.y - 16,
        t: 0,
        life: 1.4,
        text: "MRRP?",
      });
      feel.burst(HOUSE.x - 40, HOUSE.y - 30, 4, "heart", {
        v: 40,
        up: 50,
        life: 0.9,
        s: 13,
        c: "#ff9bd2",
      });
      return;
    }
    const { x: px, y: py, rx, ry } = POND;
    if (((w.x - px) / rx) ** 2 + ((w.y - py) / ry) ** 2 < 1) {
      feel.ring(w.x, w.y, 36);
      feel.ring(w.x, w.y, 18);
      feel.burst(w.x, w.y, 10, "drop", { v: 110, up: 220, g: 1200, life: 0.6 });
      sfx("splash");
      setTimeout(() => sfx("quack"), 200);
      duckRush = 1.2;
      return;
    }
    for (const tr of [...TREES, ...MARGIN.filter((m) => m.t)])
      if (treeHit(tr, w)) return shakeTree(tr);
    if (
      Math.abs(w.x - MILL.x) < 60 &&
      w.y < MILL.y + 10 &&
      w.y > MILL.y - 230
    ) {
      millBoost = 1;
      bounce.mill = 1;
      sfx("whoosh");
      return;
    }
    if (
      Math.abs(w.x - (HOUSE.x + 10)) < 95 &&
      w.y < HOUSE.y + 10 &&
      w.y > HOUSE.y - 200
    ) {
      bounce.house = 1;
      sfx("knock");
      const hs = HOUSE_SPR();
      if (hs.chimney)
        for (let k = 0; k < 4; k++)
          FSMOKE.push({
            x: HOUSE.x + hs.chimney[0],
            y: HOUSE.y + hs.chimney[1] - k * 8,
            t: k * 0.1,
            life: 2.4,
            vx: 4 + Math.random() * 8,
          });
      return;
    }
    if (
      Math.abs(w.x - DOGH.x) < 70 &&
      w.y < DOGH.y + 10 &&
      w.y > DOGH.y - 110
    ) {
      bounce.dogh = 1;
      if (!V && dogOn()) {
        dogBark();
        sfx("bark");
      } else sfx("knock");
      return;
    }
    if (
      !V &&
      F.scarecrow &&
      Math.abs(w.x - 288) < 40 &&
      w.y < 572 &&
      w.y > 440
    ) {
      scareSpin = 1;
      sfx("whoosh");
      feel.burst(288, 470, 8, "leaf", {
        v: 90,
        life: 1.8,
        c: "#e8c27a",
        floor: 572,
      });
      return;
    }
    for (const m of MARGIN)
      if (m.b && Math.abs(w.x - m.x) < 34 && w.y < m.y + 10 && w.y > m.y - 50) {
        m.bump = 1;
        sfx("rustle");
        feel.burst(m.x, m.y - 30, 8, "leaf", {
          v: 90,
          life: 1.5,
          c: ["#4fae46", "#86cf66", "#ffc4dc"],
          floor: m.y + 10,
        });
        return;
      }
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
    harvestFeel(i, p.mut ?? [], dragging ? combo.n : 1);
    return true;
  }
  /** Sparkles, a pop that climbs with the swipe, and cheers for big moments. */
  function harvestFeel(i, muts, n) {
    const r = plotRect(i),
      cx = r.x + PW / 2;
    p_wob(i);
    sfx("pop", n - 1);
    feel.burst(cx, r.y + 14, 10, "spark", { v: 170, life: 0.7, s: 6 });
    feel.burst(cx, r.y + PH - 6, 5, "dust", {
      v: 50,
      life: 0.6,
      s: 4,
      c: "#b38a5a",
    });
    const vx = (cx - cam.x) * Z + VW / 2,
      vy = (r.y - cam.y) * Z + VH / 2;
    const big = muts.includes("rainbow")
      ? "rainbow"
      : muts.includes("gold")
        ? "gold"
        : null;
    if (big) {
      const m = MUTS[big];
      feel.text(
        cx,
        r.y - 60,
        `${m.n.toUpperCase()} ×${m.x}!`,
        big === "gold" ? "#ffd65b" : "#ff9bd2",
        38,
      );
      feel.burst(cx, r.y + 10, 18, "spark", { v: 240, life: 0.9, s: 8 });
      sfx("chime");
      setTimeout(() => sfx("coin"), 250);
      feel.pop(vx, vy, big === "rainbow" ? 70 : 40);
    }
    if (isSuperSwipe(n)) {
      feel.text(cx, r.y - 96, "SUPER SWIPE!", "#7ff0a2", 42);
      sfx("fanfare");
      feel.pop(vx, vy, 60);
    }
  }
  function p_wob(i) {
    const p = cur().plots?.[i];
    if (p) p.wob = 1;
  }
  /** Crows that were shooed, flying off (drawn until they leave the screen). */
  const crowsLeaving = [];
  function shooAt(i) {
    const r = plotRect(i);
    act({ a: "shoo", plot: i }, true);
    sfx("whoosh");
    crowsLeaving.push({ x: r.x + PW / 2, y: r.y + 20, t: 0 });
    float(r.x + PW / 2, r.y - 10, "Shoo!", "#fff");
  }
  /** Put a decoration in storage (migration 065): it places again for free. */
  function storeDecor(id) {
    if (id) F.decorCredits[id] = (F.decorCredits[id] || 0) + 1;
  }
  /** Decorating (migration 048): place the picked decoration, or put one away. */
  function placeDecor(k) {
    const pick = F.decorPick;
    if (pick === "__remove") {
      if (!F.decor[k]) return toast("Nothing to put away there");
      act({ a: "decor-remove", slot: k }, true);
      log(`Put <b>${DECO[F.decor[k]]?.name ?? "decor"}</b> in storage`);
      storeDecor(F.decor[k]);
      F.decor[k] = null;
    } else {
      const d = DECO[pick];
      if (!d) return;
      if (F.decor[k] === pick) return toast("That is already there");
      act({ a: "decor", slot: k, item: pick }, true);
      // A stored copy places first, for free; what stood there is stored.
      if (F.decorCredits[pick] > 0) F.decorCredits[pick]--;
      else F.leaves -= d.price;
      if (F.decor[k]) {
        log(`Put <b>${DECO[F.decor[k]]?.name ?? "decor"}</b> in storage`);
        storeDecor(F.decor[k]);
      }
      FX.push({
        puff: 1,
        x: DECO_SLOTS[k][0],
        y: DECO_SLOTS[k][1],
        t: 0,
        life: 0.6,
      });
      F.decor[k] = pick;
      // Stop placing when nothing is left in storage and another can't (or,
      // picked in Storage, shouldn't) be bought.
      if (!F.decorCredits[pick] && (F.decorFromStore || F.leaves < d.price))
        F.decorPick = null;
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
    sfx("whoosh");
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
    sfx("fanfare");
    feel.text(b.cx, b.y0 - 40, "GIANT!", "#ffd65b", 46);
    feel.burst(b.cx, b.y0 + 80, 24, "spark", { v: 260, life: 1, s: 8 });
    feel.pop((b.cx - cam.x) * Z + VW / 2, (b.y0 + 60 - cam.y) * Z + VH / 2, 80);
    return true;
  }
  /**
   * The Sickle: every ripe plot of the 3×3 in one go. A giant it touches is
   * harvested whole, first; then the other ripe plots one by one, so a giant
   * that can't be harvested (a full barn) is never cut up plot by plot.
   */
  function sickleAt(i, silent = false) {
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
      if (!silent && reach.some((j) => F.pending.has(j)))
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
    if (gi && ["hand", "shovel"].includes(F.tool)) {
      if (F.tool === "hand" && p.pests) catchAt(i);
      else if (
        F.tool === "hand" &&
        pressType !== "mouse" &&
        !drag &&
        !holdPaint
      ) {
        sicklePop(i);
        return;
      } else if (F.tool === "shovel") {
        if (!drag) toast("Harvest the giant crop first");
      } else harvestGiant(gi, drag);
      renderChips();
      renderTools();
      return;
    }
    switch (F.tool) {
      case "hand":
        if (p.pests) {
          if (drag || holdPaint) catchAt(i);
          else actsPop(i);
          break;
        }
        if (p.crop && p.prog < 1 && !drag && !holdPaint) {
          actsPop(i);
          break;
        }
        if (p.crop && p.prog >= 1) {
          // A touch tap shows the sickle to drag across the field.
          if (pressType !== "mouse" && !drag && !holdPaint) sicklePop(i);
          // A click cuts a 3×3 with the Sickle you bought, else one plot.
          else if (F.sickle && !drag) sickleAt(i);
          else harvestAt(i);
          break;
        }
        if (!p.crop && !drag) seedPop(i);
        break;
      case "can": {
        const dry = area(i, F.can).filter((j) => {
          const q = F.plots[j];
          return !q.locked && q.crop && q.prog < 1 && !wetNow(q);
        });
        if (!dry.length) break;
        act({ a: "water", plot: i });
        sfx("water");
        dry.forEach(p_wob);
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
        sfx("chime");
        feel.burst(cx, r.y + PH / 2, 10, "spark", {
          v: 90,
          up: 60,
          life: 0.8,
          s: 5,
          c: f === "gold" ? "#ffd65b" : "#d8ff8a",
        });
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
          sfx("plant");
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
  /** Tap an empty plot: pick a seed, then sow with the bubble (seedBubble). */
  function seedPop(i) {
    const r = plotRect(i),
      o = hudOff(),
      sp0 = toScreen(r.x + PW / 2, r.y),
      sp = { x: sp0.x - o.x, y: sp0.y - o.y },
      pop = $("fm-pop");
    pop.hidden = false;
    pop.classList.add("seedpick");
    // Seeds you can't grow yet (a gift or a wish above your level) are greyed
    // out at the end, with the level they need, as in the Shop.
    const have = PCROPS.filter((c) => F.seeds[c.id]).sort(
      (a, b) => +(a.lv > F.lv) - +(b.lv > F.lv),
    );
    const card = (c) => {
      const lock = c.lv > F.lv;
      return `<button type="button" class="opt sp r-${c.rar}${lock ? " locked" : ""}" data-pseed="${c.id}" ${lock ? "disabled" : ""} title="${lock ? `${c.n}: grows at Lv ${c.lv}` : c.n}"><b>×${F.seeds[c.id]}</b><img src="${icon(c.id)}" alt=""><span>${c.n}</span><small>${lock ? `Lv ${c.lv}` : `${I("clock")}${fmtSecs(c.t)} · ${c.sell}${L}`}</small></button>`;
    };
    pop.innerHTML = have.length
      ? `<h6>What should grow here?</h6><div class="grid">${have.map(card).join("")}</div><p class="sh-note sp-tip">Pick a seed, then <b>drag</b> it across empty plots to sow them.</p>`
      : `<h6>What should grow here?</h6><p class="sh-note" style="margin:2px 4px 8px">Your seed bag is empty.</p><button type="button" class="btn-s gold fm-wide" data-seedshop>Buy seeds in the Shop</button>`;
    const pw = Math.min(320, o.w - 16);
    pop.style.width = `${pw}px`;
    pop.style.left = `${Math.max(8, Math.min(o.w - pw - 8, sp.x - pw / 2))}px`;
    const top = sp.y - pop.offsetHeight - 14;
    pop.style.top = `${top < 60 ? Math.min(o.h - pop.offsetHeight - 8, sp.y + PH * Z * K + 10) : top}px`;
    pop.onclick = (e) => {
      if (e.target.closest("[data-seedshop]")) {
        pop.hidden = true;
        pop.classList.remove("seedpick");
        return openSheet("shop", "seeds");
      }
      const b = e.target.closest("[data-pseed]");
      if (!b || b.disabled) return;
      pop.hidden = true;
      pop.classList.remove("seedpick");
      seedBubble(i, b.dataset.pseed);
      screen.focus({ preventScroll: true });
    };
  }
  /* ---------- planting and harvesting by hand, as in mobile farm games ----------
     Tap an empty plot: the seed tray opens; press a seed and drag it across
     the field and every empty plot it passes is sown. Tap a ripe crop (on a
     touch screen): a sickle pops up beside it; drag it across the field and
     every ripe crop it passes is harvested (a giant whole), or tap it for
     just that one. The seed or sickle rides under your finger meanwhile. The
     mouse keeps click and click-and-drag with the tool in hand. */
  let pressType = "mouse",
    holdPaint = false,
    carry = null,
    carriedAt = 0;
  /** A carry just ended with a drag: the click that follows is not a tap. */
  const carried = () => performance.now() - carriedAt < 400;
  /** Where a bubble (seed or sickle) floats: just above the plot's right. */
  function placeBubble(el, i) {
    const r = plotRect(i),
      o = hudOff(),
      sp0 = toScreen(r.x + PW * 0.82, r.y + PH * 0.15);
    el.hidden = false;
    el.dataset.plot = String(i);
    el.style.left = `${Math.max(8, Math.min(o.w - 72, sp0.x - o.x - 32))}px`;
    el.style.top = `${Math.max(56, Math.min(o.h - 72, sp0.y - o.y - 70))}px`;
  }
  /** The picked seed, ready to sow: drag it across empty plots, or tap it to
   *  sow just the plot you picked it for. Only this seed is sown: when it
   *  runs out, sowing stops (no other seed is picked for you). */
  function seedBubble(i, id) {
    const el = $("fm-seed"),
      b = el.querySelector("[data-seedbub]");
    $("fm-sickle").hidden = true;
    b.innerHTML = `<img src="${icon(id)}" alt=""><b>×${F.seeds[id] || 0}</b>`;
    b.setAttribute(
      "aria-label",
      `Sow ${CROP[id]?.n}: tap, or drag across empty plots`,
    );
    placeBubble(el, i);
    b.onpointerdown = (e) => startCarry(e, "seed", id, i);
    b.onclick = () => {
      if (carried()) return;
      el.hidden = true;
      carryOne("seed", id, i);
    };
  }
  /** The icon a tool shows (the can and net you own). */
  const toolIcon = (kind, id) =>
    kind === "can"
      ? ["", "can", "can2", "can3"][F.can]
      : kind === "fert"
        ? { norm: "fert", super: "fertSuper", gold: "fertGold" }[id]
        : kind;
  /** Tap a growing crop: a row of bubbles with what it can use — the net
   *  for its bugs, the can when it's dry, each fertilizer you have when it
   *  has none, the shovel. Drag one across the field to use it on every
   *  plot it passes (the can and the Big Net reach their own area), or tap
   *  it for just this plot. The shovel only taps, twice, to dig up. */
  function actsPop(i) {
    const p = F.plots[i],
      acts = [];
    if (p.pests) acts.push(["net", "", "Catch the bugs"]);
    if (p.crop && p.prog < 1) {
      if (!wetNow(p)) acts.push(["can", "", "Water"]);
      for (const [k, lv, n] of [
        ["norm", 1, "Fertilizer"],
        ["super", 6, "Super Fertilizer"],
        ["gold", 24, "Gold Fertilizer"],
      ])
        if (F.ferts[k] > 0 && F.lv >= lv && (!p.fert || k === "super"))
          acts.push(["fert", k, n]);
      acts.push(["shovel", "", "Dig up"]);
    }
    if (!acts.length) return;
    const el = $("fm-acts");
    $("fm-sickle").hidden = true;
    $("fm-seed").hidden = true;
    el.innerHTML = acts
      .map(
        ([k, id, n]) =>
          `<button type="button" data-act="${k}" data-id="${id}" aria-label="${n}: tap, or drag across the field" title="${n}">${I(toolIcon(k, id))}${k === "fert" ? `<b>×${F.ferts[id]}</b>` : ""}</button>`,
      )
      .join("");
    const r = plotRect(i),
      o = hudOff(),
      sp0 = toScreen(r.x + PW / 2, r.y),
      w = acts.length * 70;
    el.hidden = false;
    el.dataset.plot = String(i);
    el.style.left = `${Math.max(8, Math.min(o.w - w - 8, sp0.x - o.x - w / 2))}px`;
    el.style.top = `${Math.max(56, Math.min(o.h - 72, sp0.y - o.y - 74))}px`;
    el.querySelectorAll("[data-act]").forEach((b) => {
      const k = b.dataset.act,
        id = b.dataset.id || null;
      if (k !== "shovel") b.onpointerdown = (e) => startCarry(e, k, id, i);
      b.onclick = () => {
        if (carried()) return;
        useAs(k, id, i, false);
        // The shovel asks for a second tap: keep it there for that.
        if (k === "shovel" && F.shovelArm === i) {
          b.classList.add("armed");
          return;
        }
        el.hidden = true;
        endDrag();
      };
    });
  }
  /** Use a tool on one plot, as the tool bar's tool used to. */
  function useAs(kind, id, i, drag) {
    const t = F.tool,
      f = F.fert;
    F.tool = kind;
    if (kind === "fert") F.fert = id;
    try {
      useTool(i, drag);
    } finally {
      F.tool = t;
      F.fert = f;
    }
  }
  function sicklePop(i) {
    const el = $("fm-sickle");
    $("fm-seed").hidden = true;
    placeBubble(el, i);
    const b = el.querySelector("[data-sickle]");
    b.onpointerdown = (e) => startCarry(e, "sickle", null, i);
    b.onclick = () => {
      if (carried()) return;
      el.hidden = true;
      carryOne("sickle", null, i);
      endDrag();
    };
  }
  function startCarry(e, kind, id, from) {
    if (e.button > 0) return;
    carry = {
      kind,
      id,
      from,
      pid: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      moved: false,
      done: new Set(),
      out: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  }
  function carryOne(kind, id, i) {
    if (i < 0 || carry?.done.has(i)) return;
    carry?.done.add(i);
    const p = F.plots[i];
    if (!p || p.locked) return;
    if (kind === "seed") {
      if (p.crop) return;
      if (!F.seeds[id]) {
        if (carry && !carry.out) {
          carry.out = true;
          toast(`Out of ${CROP[id]?.n ?? "these"} seeds`);
        }
        return;
      }
      plantAt(i, id);
      return;
    }
    if (kind !== "sickle") {
      if (p.crop) useAs(kind, id, i, !!carry);
      return;
    }
    if (p.crowAt) return shooAt(i);
    // The Sickle you bought cuts a 3×3 at each plot it passes.
    if (F.sickle) {
      sickleAt(i, !!carry);
      return;
    }
    const gi = F.giantAt[i];
    if (gi) {
      for (const j of gi.plots) carry?.done.add(j);
      harvestGiant(gi, true);
      return;
    }
    if (p.crop && p.prog >= 1) harvestAt(i, true);
  }
  function carryMove(e) {
    if (!carry || e.pointerId !== carry.pid) return;
    if (!carry.moved) {
      if (Math.hypot(e.clientX - carry.x0, e.clientY - carry.y0) < 8) return;
      carry.moved = true;
      dragging = true;
      $("fm-pop").hidden = true;
      $("fm-pop").classList.remove("seedpick");
      $("fm-sickle").hidden = true;
      $("fm-seed").hidden = true;
      $("fm-acts").hidden = true;
      $("fm-tip").hidden = true;
      const g = $("fm-ghost");
      g.innerHTML =
        carry.kind === "seed"
          ? `<img src="${icon(carry.id)}" alt="">`
          : I(toolIcon(carry.kind, carry.id));
      g.hidden = false;
      // The plot it started from counts too.
      carryOne(carry.kind, carry.id, carry.from);
    }
    e.preventDefault();
    carry.lx = e.clientX;
    carry.ly = e.clientY;
    const o = hudOff(),
      lr = layer.getBoundingClientRect(),
      g = $("fm-ghost");
    g.style.left = `${e.clientX - lr.left - o.x}px`;
    g.style.top = `${e.clientY - lr.top - o.y}px`;
    const w = toWorld(e.clientX, e.clientY);
    carryOne(carry.kind, carry.id, plotAt(w.x, w.y));
  }
  /** Carrying a seed or a tool to the edge of the view scrolls the farm that
   *  way, faster the closer to the edge; what slides under the finger is
   *  sown, watered or cut as it goes. Called every frame; it starts once the
   *  finger has left the edges, so a drag starting there doesn't scroll. */
  function edgeScroll(dt) {
    if (!carry?.moved || carry.lx == null) return;
    const r = cv.getBoundingClientRect(),
      ex = Math.min(72, r.width * 0.12),
      ey = Math.min(72, r.height * 0.16),
      push = (v, lo, hi, e) =>
        v < lo + e
          ? -Math.min(1, (lo + e - v) / e)
          : v > hi - e
            ? Math.min(1, (v - (hi - e)) / e)
            : 0,
      kx = push(carry.lx, r.left, r.right, ex),
      ky = push(carry.ly, r.top, r.bottom, ey);
    // Only once the finger has been away from the edges: a bubble near the
    // top of a phone screen doesn't scroll the farm as the drag starts.
    if (!kx && !ky) {
      carry.edgeOk = true;
      return;
    }
    if (!carry.edgeOk) return;
    const sp = (900 * dt) / Z,
      bx = cam.x,
      by = cam.y;
    cam.x += kx * sp;
    cam.y += ky * sp;
    clampCam();
    if (cam.x === bx && cam.y === by) return; // already at the farm's edge
    const w = toWorld(carry.lx, carry.ly);
    carryOne(carry.kind, carry.id, plotAt(w.x, w.y));
  }
  function carryEnd(e) {
    if (!carry || e.pointerId !== carry.pid) return;
    const moved = carry.moved;
    carry = null;
    $("fm-ghost").hidden = true;
    if (!moved) return; // a tap: the button's click handles it
    carriedAt = performance.now();
    renderTools();
    endDrag();
  }
  addEventListener("pointermove", carryMove, true);
  addEventListener("pointerup", carryEnd, true);
  addEventListener("pointercancel", carryEnd, true);
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
    sfx("levelup");
    if (!reduced) {
      const card = m.querySelector(".lvcard"),
        cols = [
          "#ffd65b",
          "#ff7a59",
          "#7ff0a2",
          "#5ec2ff",
          "#ff9bd2",
          "#c77dff",
        ];
      for (let k = 0; k < (low ? 18 : 40); k++) {
        const c = document.createElement("i");
        c.className = "lv-confetti";
        c.style.cssText = `left:${Math.random() * 100}%;background:${cols[k % cols.length]};animation-delay:${(Math.random() * 0.6).toFixed(2)}s;--drift:${Math.round((Math.random() - 0.5) * 120)}px;--spin:${Math.round(360 + Math.random() * 540)}deg`;
        card?.append(c);
      }
    }
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
    drawFence(ctx);
    drawPastureFence(ctx, true);
    s.plots.forEach((p, i) => drawPlot(ctx, i, p, time, s));
    drawArea(ctx);
    drawRainSplashes(ctx, time);
    const items = [];
    // Trees and the back row stand in the depth order too, so nothing
    // walking behind them is drawn over them.
    TREES.forEach((tr) =>
      items.push({ y: tr.y, d: () => drawTreeS(tr, time, 0.7) }),
    );
    items.push(
      {
        y: HOUSE.y,
        d: () => {
          GFX.shadow(ctx, HOUSE.x + 30, HOUSE.y + 4, 110, 20);
          blitB("house", HOUSE_SPR(), HOUSE.x, HOUSE.y);
        },
      },
      {
        y: MILL.y,
        d: () => {
          const wm = GFX.windmillBody();
          GFX.shadow(ctx, MILL.x + 20, MILL.y + 4, 60, 14);
          blitB("mill", wm, MILL.x, MILL.y);
          GFX.windmillSails(
            ctx,
            MILL.x + wm.hub[0],
            MILL.y + wm.hub[1],
            reduced ? 0 : millA,
            0.82,
          );
        },
      },
      {
        y: BOARDP.y,
        d: () => {
          GFX.shadow(ctx, BOARDP.x + 8, BOARDP.y + 3, 70, 14);
          blitB("board", GFX.board(), BOARDP.x, BOARDP.y);
        },
      },
      {
        y: STALL.y,
        d: () => {
          GFX.shadow(ctx, STALL.x + 10, STALL.y + 4, 96, 16);
          blitB("stall", GFX.stall(), STALL.x, STALL.y);
        },
      },
      {
        y: BARN.y,
        d: () => {
          GFX.shadow(ctx, BARN.x + 20, BARN.y + 4, 130, 22);
          blitB("barn", GFX.barn(), BARN.x, BARN.y);
        },
      },
    );
    MARGIN.forEach((m) =>
      items.push({
        y: m.y,
        d: () => {
          if (m.t) drawTreeS(m, time, 0.8);
          else {
            GFX.shadow(ctx, m.x + 6, m.y + 2, 30, 8);
            blitB(m, m.b, m.x, m.y + 4);
          }
        },
      }),
    );
    drawPresent(items, time);
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
        DECO_SLOTS.forEach(([x, y], k) => {
          if (decorTarget(k))
            items.push({ y: y - 1, d: () => drawDecorSpot(x, y, k, time) });
        });
    }
    // Tools you own stand on the farm: the Scarecrow left of the field, a
    // sprinkler at the right end of each row that has one.
    if (s.me && F.scarecrow)
      items.push({
        y: 560,
        d: () => {
          GFX.shadow(ctx, 292, 562, 26, 6);
          ctx.save();
          ctx.translate(288, 562);
          if (scareSpin > 0)
            ctx.scale(Math.cos((1 - scareSpin) * Math.PI * 4), 1);
          GFX.blit(ctx, GFX.scarecrow(), 0, 0);
          ctx.restore();
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
        blitB("well", GFX.well(), WELL.x, WELL.y);
        drawWellSparkles(time);
      },
    });
    items.push({
      y: HOUSE.y + 8,
      d: () =>
        GFX.cat(
          ctx,
          catAwake > 0 ? "awake" : "sleep",
          time,
          HOUSE.x - 40,
          HOUSE.y + 8,
          1.1,
          1,
        ),
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
        // The ducks paddle round the pond (they hurry after a splash).
        FDUCKS.forEach((d, k) => {
          const r = 0.55 - k * 0.15;
          GFX.duck(
            ctx,
            d.k,
            "swim",
            time + d.a,
            x + Math.cos(d.a) * rx * r,
            y + Math.sin(d.a) * ry * r,
            1.05,
            Math.sin(d.a) * Math.sign(d.s) < 0 ? 1 : -1,
            true,
          );
        });
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
            COW.y - Math.sin((COW.hop || 0) * Math.PI) * 16,
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
        blitB("dogh", GFX.doghouse(), DOGH.x, DOGH.y);
      },
    });
    hens.forEach((h) =>
      items.push({
        y: h.y,
        d: () =>
          GFX.chicken(
            ctx,
            h.k,
            h.hop > 0 ? "flap" : h.st,
            time + h.x * 0.01,
            h.x,
            h.y - Math.sin((h.hop || 0) * Math.PI) * 24,
            1.1,
            h.face,
          ),
      }),
    );
    fenceItems(items);
    items.push(...feel.groundItems(ctx));
    items.sort((a, b) => a.y - b.y).forEach((it) => it.d());
    FSMOKE.forEach((m) => {
      ctx.fillStyle = `rgba(240,240,245,${0.5 * (1 - m.t / m.life)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6 + m.t * 7, 0, 7);
      ctx.fill();
    });
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
    drawBalloon(ctx, time);
    for (const b of flyAway)
      GFX.bird(
        ctx,
        "pigeon",
        "fly",
        time + b.ph,
        b.x,
        b.y,
        1.3,
        b.vx > 0 ? 1 : -1,
      );
    feel.drawWorld(ctx);
    const wcur = F.weather.cur;
    if (!low && !reduced && !["rain", "storm", "moon"].includes(wcur))
      feel.drawClouds(ctx, 0.14 * (1 - nightLevel(TOD) * 0.7));
    ctx.restore();
    lightPass(time);
    drawWeather(ctx, time);
    drawToolCursor(ctx, time);
    drawHoldRing(ctx);
    feel.drawConfetti(ctx);
    ctx.restore();
  }
  /** The time of day over the farm, then the lights that glow through it. */
  function lightPass(time) {
    const w = F.weather.cur,
      wet = w === "rain" || w === "storm",
      n = nightLevel(TOD),
      golden = wet || w === "moon" ? 0 : goldenLevel(TOD) * (1 - n * 0.6),
      warm = wet || w === "moon" || w === "frost" ? 0 : (1 - n) * (1 - golden);
    // The Moonlit weather already paints a night: no second darkening.
    gradeView(ctx, VW, VH, { night: w === "moon" ? 0 : n, golden, warm, low });
    const lit = Math.max(
      n,
      w === "moon" ? 0.85 : 0,
      golden * 0.55,
      w === "storm" ? 0.5 : w === "rain" ? 0.3 : 0,
    );
    if (low || lit < 0.02) return drawLabels(time);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();
    ctx.translate(VW / 2, VH / 2);
    ctx.scale(Z, Z);
    ctx.translate(-cam.x, -cam.y);
    ctx.globalCompositeOperation = "lighter";
    const fl = 0.92 + Math.sin(time * 9) * 0.04 + Math.sin(time * 5.3) * 0.04;
    const hs = HOUSE_SPR();
    for (const [wx, wy, ww, wh] of hs.win ?? []) {
      ctx.fillStyle = `rgba(255,200,90,${0.6 * lit})`;
      ctx.fillRect(HOUSE.x + wx + 3, HOUSE.y + wy + 3, ww - 6, wh - 6);
      glow(
        ctx,
        HOUSE.x + wx + ww / 2,
        HOUSE.y + wy + wh / 2,
        70,
        "255,190,90",
        0.45 * lit * fl,
      );
    }
    glow(ctx, BARN.x, BARN.y - 128, 70, "255,200,90", 0.4 * lit * fl);
    glow(ctx, STALL.x, STALL.y - 100, 110, "255,190,110", 0.35 * lit * fl);
    glow(ctx, WELL.x, WELL.y - 60, 70, "190,230,255", 0.2 * lit);
    // Fireflies by night (the Moonlit weather brings its own).
    if (n > 0.35 && w !== "moon" && !reduced)
      for (const f of FIREFLIES) {
        const x = f.x + Math.sin(time * 0.3 * f.sp + f.ph) * 50,
          y = f.y + Math.sin(time * 0.5 * f.sp + f.ph * 2) * 30,
          b = Math.max(0, Math.sin(time * 2 * f.sp + f.ph));
        glow(ctx, x, y, 16, "210,255,120", 0.75 * n * b);
      }
    ctx.restore();
    drawLabels(time);
  }
  /**
   * The name of every place you can use (the house opens nothing, so it has
   * none), on a tag just above its picture, drawn last so no tree covers it
   * and the night doesn't dim it. A building with something
   * for you shows a badge on its tag, as in the farm games people know.
   */
  function drawLabels(time) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();
    ctx.translate(VW / 2, VH / 2);
    ctx.scale(Z, Z);
    ctx.translate(-cam.x, -cam.y);
    const z = 1 / Math.max(0.6, Z),
      tag = (t, x, top, accent) => nameTag(ctx, t, x, top - 20 * z, accent);
    const bob = reduced ? 0 : Math.abs(Math.sin(time * 3)) * 2.5 * z;
    /** A badge pinned to a tag's top-right corner, so it reads as part of
     *  it: big, outlined, with a glow ring pulsing out to catch the eye. */
    const badge = (box, t, bg) => {
      const fs = 18 * z;
      ctx.save();
      ctx.font = `900 ${fs}px 'Barlow Condensed', sans-serif`;
      const w = Math.max(28 * z, ctx.measureText(t).width + 16 * z),
        h = 28 * z,
        x = box.x + box.w / 2 - 6 * z,
        y = box.y - box.h / 2 - 2 * z - bob;
      if (!reduced) {
        const k = (time * 0.9) % 1;
        ctx.globalAlpha = 0.55 * (1 - k);
        ctx.strokeStyle = bg;
        ctx.lineWidth = 3 * z;
        ctx.beginPath();
        ctx.roundRect(
          x - w / 2 - k * 12 * z,
          y - h / 2 - k * 12 * z,
          w + k * 24 * z,
          h + k * 24 * z,
          h / 2 + k * 12 * z,
        );
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = bg;
      ctx.strokeStyle = "#1a0f05";
      ctx.lineWidth = 2.5 * z;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1a0f05";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t, x, y + 1 * z);
      ctx.restore();
    };
    drawDecorPins(time, z);
    // A place with something for you: its tag gets a gold edge and a badge.
    const orderReady = !V && F.orders.some((o) => o.items && canFill(o)),
      sold = !V && stall?.shelves?.some((x) => x.sold),
      full = !V && barnUsed() >= F.barnCap * 0.9;
    const tOrders = tag(
        "ORDERS",
        BOARDP.x,
        BOARDP.y - 140,
        orderReady ? "#ffd65b" : undefined,
      ),
      tMarket = tag(
        "MARKET",
        STALL.x,
        STALL.y - 150,
        sold ? "#7ff0a2" : undefined,
      ),
      tBarn = tag("BARN", BARN.x, BARN.y - 196, full ? "#ff8a7a" : undefined);
    tag(
      F.wishReady && !V ? "WISHING WELL ✦" : "WISHING WELL",
      WELL.x,
      WELL.y - 138,
      F.wishReady && !V ? "#ffd65b" : undefined,
    );
    if (!V) {
      if (orderReady) badge(tOrders, "!", "#ffd65b");
      if (sold) badge(tMarket, "SOLD!", "#7ff0a2");
      if (full) badge(tBarn, "FULL", "#ff8a7a");
      if (balloon) {
        if (balloon.crates && bal.mode === "idle") {
          const p = balloonPos(time, performance.now()),
            done = balloon.crates.filter((c) => c.state === "done").length,
            ready = done === balloon.crates.length;
          tag(
            ready ? "READY TO LAUNCH!" : `SUPPLY BALLOON ${done}/6`,
            p.x,
            p.y - 118,
            ready ? "#7ff0a2" : undefined,
          );
        } else if (!balloon.crates || bal.mode === "gone") {
          const left = balloon.arrivesAt
            ? (new Date(balloon.arrivesAt).getTime() - serverNow()) / 1000
            : 0;
          if (left > 0)
            tag(`BALLOON IN ${fmtSecs(left).toUpperCase()}`, PEG.x, PEG.y - 14);
        }
      }
    }
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
    rainLevel = -1;
    try {
      options.rainSound?.(0);
    } catch {}
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
  let todAt = 0;
  function feelStep(dt) {
    if (
      options.here &&
      performance.now() - hereAt > (here?.present?.length ? 10_000 : 20_000)
    )
      void ping();
    if (T - todAt > 1) {
      todAt = T;
      TOD = todOverride ?? deviceTimeOfDay();
    }
    for (const k in bounce) bounce[k] = Math.max(0, bounce[k] - dt / 0.6);
    for (const tr of TREES)
      if (tr.shake > 0) tr.shake = Math.max(0, tr.shake - dt / 0.9);
    for (const m of MARGIN) {
      if (m.shake > 0) m.shake = Math.max(0, m.shake - dt / 0.9);
      if (m.bump > 0) m.bump = Math.max(0, m.bump - dt / 0.6);
    }
    for (const p of cur().plots ?? [])
      if (p.wob > 0) p.wob = Math.max(0, p.wob - dt / 0.7);
    millBoost = Math.max(0, millBoost - dt / 2.5);
    const w = F.weather.cur;
    millA += dt * (0.7 + millBoost * 6 + (w === "storm" ? 1.4 : 0));
    catAwake = Math.max(0, catAwake - dt);
    scareSpin = Math.max(0, scareSpin - dt / 0.9);
    duckRush = Math.max(0, duckRush - dt);
    if (COW.hop > 0) COW.hop = Math.max(0, COW.hop - dt / 0.5);
    if (!reduced)
      for (const d of FDUCKS) d.a += d.s * dt * (duckRush > 0 ? 5 : 1);
    for (let k = flyAway.length - 1; k >= 0; k--) {
      const b = flyAway[k];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < WY0 - 100) flyAway.splice(k, 1);
    }
    // Cherry petals drift from the cherry trees on the breeze.
    if (!low && !reduced && w !== "storm" && w !== "frost")
      for (const tr of TREES)
        if (tr.kind === "cherry" && Math.random() < dt * 1.1)
          feel.burst(tr.x - 40 + Math.random() * 80, tr.y - 110, 1, "petal", {
            v: 15,
            life: 7,
            c: ["#ffc4dc", "#ffe1ec"],
            floor: tr.y + 60 + Math.random() * 120,
          });
    feel.step(dt, windAt);
    // Birdsong by day, crickets at night, rain on the roof.
    chirpT -= dt;
    if (chirpT <= 0) {
      if (nightLevel(TOD) > 0.6) {
        sfx("cricket");
        chirpT = 0.8 + Math.random() * 1.6;
      } else if (w !== "rain" && w !== "storm") {
        sfx("chirp");
        chirpT = 3 + Math.random() * 6;
      } else chirpT = 2;
    }
    const rl = w === "storm" ? 1.6 : w === "rain" ? 1 : 0;
    if (rl !== rainLevel) {
      rainLevel = rl;
      try {
        options.rainSound?.(rl);
      } catch {}
    }
  }
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
    edgeScroll(dt);
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
          if (Math.random() < dt * (dog.chasing ? 9 : 2.5))
            feel.burst(dog.x - dog.face * 10, dog.y + 2, 1, "dust", {
              v: 20,
              life: 0.5,
              s: 4,
              c: "#c9a877",
            });
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
        const hv = h.fast > 0 ? 150 : 40;
        h.x += (dx / d) * Math.min(d, hv * dt);
        h.y += (dy / d) * Math.min(d, hv * dt);
        h.face = dx > 0 ? 1 : -1;
      });
    hens.forEach((h) => {
      if (h.hop > 0) h.hop = Math.max(0, h.hop - dt / 0.45);
      if (h.fast > 0) h.fast -= dt;
    });
    if (!reduced && Math.random() < dt * 2.5) {
      const hs = HOUSE_SPR();
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
    let landed = false;
    for (let i = FX.length - 1; i >= 0; i--)
      if (FX[i].t > FX[i].life) {
        // Produce reaching the barn: the barn gives a little bump.
        if (FX[i].fly) landed = true;
        FX.splice(i, 1);
      }
    if (landed) {
      bounce.barn = 1;
      sfx("tick");
    }
    feelStep(dt);
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
  /** Your own farm has no tool bar: every tool is a bubble by the plot. */
  const HOME_TOOLS = () => [];
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
    $("fm-tools").hidden = !TOOLS().length;
    $("fm-tools").innerHTML = TOOLS()
      .map(
        ([id, ic, label, count, lvl], idx) =>
          `<button type="button" class="fm-tool" data-tool="${id}" aria-pressed="${F.tool === id}" title="${label} (key ${idx + 1})"><kbd>${idx + 1}</kbd>${count != null ? `<b>${count > 99 ? "99+" : count}</b>` : ""}${I(ic)}<span>${label}</span>${lvl ? `<em>${lvl}</em>` : ""}</button>`,
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
    tip.innerHTML = `<b>${c.n}</b><div class="bar"><i style="width:${p.prog * 100}%"></i></div><div class="row"><span>${p.prog >= 1 ? "Ready" : "Time left"}</span><span>${p.prog >= 1 ? (!V && F.pending.has(i) ? "Just a moment…" : "Harvest now") : fmtSecs(left)}</span></div><div class="row"><span>Water</span><span>${p.wet ? "watered" : wetNow(p) ? "watered by the rain" : "dry"}</span></div>${p.pests ? `<div class="row"><span>Bugs</span><span>${p.pests} · ${p.pests * 20}% slower</span></div>` : ""}${p.fert ? `<div class="row"><span>Fertilizer</span><span>${p.fert === "gold" ? "gold" : "regular"}</span></div>` : ""}`;
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
      tab ||
      ({
        shop: "seeds",
        market: "sell",
        book: "book",
        friends: "visit",
        decor: "buy",
      }[name] ??
        null);
    $("fm-pop").hidden = true;
    renderSheet();
    $("fm-rail")
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
    $("fm-rail")
      .querySelectorAll("[data-sheet]")
      .forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  function head(k, h, tabs) {
    return `<div class="sh-head"><div><div class="k">${k}</div><h4>${h}</h4></div><span class="sp"></span><button type="button" class="x" data-close aria-label="Close">✕</button></div>${tabs ? `<nav class="sh-tabs">${tabs.map(([id, l]) => `<button type="button" data-tab="${id}" aria-selected="${sheetTab === id}">${l}</button>`).join("")}</nav>` : "<div></div>"}`;
  }
  const hearts = (n) =>
    `<span class="fm-hearts" aria-label="${FARM_BONDS[n].name}">${FARM_BONDS.map((_, k) => `<i class="${k <= n ? "on" : ""}"></i>`).join("")}</span>`;
  function giftsHTML() {
    if (!gifts)
      return `<div class="sh-body"><p class="sh-note">Loading your friends…</p></div>`;
    const rows = gifts.friends.map((f) => {
      const next = FARM_BONDS[f.bond + 1];
      return `<div class="fr"><img src="${options.art(f.fighter)}" alt=""><div><b>${esc(f.name)} · Lv ${f.level}</b><small>${hearts(f.bond)} <b>${FARM_BONDS[f.bond].name}</b> · ${f.days} friendship day${f.days === 1 ? "" : "s"}${next ? ` · ${next.days - f.days} more to ${next.name}` : ""}</small></div><div class="acts">${f.waiting ? `<button type="button" class="btn-s green" data-gift-open="${esc(f.id)}">Open${f.waiting > 1 ? ` (${f.waiting})` : ""}</button>` : ""}<button type="button" class="btn-s${f.sent ? " ghost" : ""}" data-gift-send="${esc(f.id)}" ${f.sent ? "disabled" : ""}>${f.sent ? "Sent" : "Send seeds"}</button></div></div>`;
    });
    return `<div class="sh-body"><p class="sh-note">Send each friend a <b>seed parcel</b> once a day; parcels keep for 7 days. Every day a parcel between you is opened is a <b>friendship day</b>: ${FARM_BONDS.slice(
      1,
    )
      .map((b) => `${b.name} at ${b.days}`)
      .join(
        ", ",
      )}. Opened today: ${gifts.openedToday}/${gifts.openCap}.</p>${rows.join("") || `<p class="sh-note">None of your friends has a farm yet. Invite them from the Invite tab.</p>`}</div>`;
  }
  function inviteHTML() {
    const iv = gifts?.invites;
    if (!iv)
      return `<div class="sh-body"><p class="sh-note">Loading…</p></div>`;
    const link = options.inviteLink?.(iv.code) ?? iv.code;
    return `<div class="sh-body"><div class="fm-invite"><b>Bring a friend to the farm</b><p>Share your link. A new player who opens it becomes your friend. Once they reach <b>farm level 10</b> they get ${FARM_INVITE_WELCOME} ${L} and your invite counts.</p><div class="fm-invite-link"><input id="fm-invite-link" readonly value="${esc(link)}" aria-label="Your invite link"><button type="button" class="btn-s gold" data-invite-copy>Copy</button></div><div class="fm-invite-steps">${FARM_INVITE_STEPS.map(
      (s) =>
        `<div class="${iv.claimed.includes(s.invites) ? "got" : ""}"><b>${iv.claimed.includes(s.invites) ? "✓ " : ""}${s.invites} friend${s.invites > 1 ? "s" : ""}</b><span>${esc(s.reward)}</span></div>`,
    ).join(
      "",
    )}</div><p class="sh-note">Joined with your link: ${iv.joined} · reached level 10: ${iv.counted}. Rewards arrive by themselves.${iv.invitedBy ? ` You joined through ${esc(iv.invitedBy)}'s invite.` : ""}</p></div></div>`;
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
          ["stall", "Stall"],
          ["paper", "Paper"],
          ["prices", "Prices"],
          ["coins", "Coins"],
        ]) + `<div class="sh-body">`;
      if (sheetTab === "stall") html += stallHTML();
      if (sheetTab === "paper") html += paperHTML();
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
    if (sheet === "decor") {
      const storedN = Object.values(F.decorCredits).reduce(
          (a, n) => a + (n > 0 ? n : 0),
          0,
        ),
        placed = F.decor.filter(Boolean).length,
        note =
          F.decorPick === "__remove"
            ? "<b>Putting away:</b> tap a decoration on the farm. It goes to storage and places again for free."
            : F.decorPick
              ? `<b>Placing ${DECO[F.decorPick]?.name}:</b> tap a glowing spot on the farm. Decor already on that spot goes to storage.`
              : sheetTab === "storage"
                ? `Decor you put away, or replace with another, waits here and places again for free. On the farm: ${placed}/${DECO_SLOTS.length} spots.`
                : "Buy decor and place it in the 8 spots around the farm. Every 2 Charm gives +1% farm XP (up to 25%).";
      const row = (d, sub, btn) =>
        `<div class="item${d.lock ? " locked" : ""}"><span class="ic">${I(d.icon)}</span><div><b>${d.name}</b><small>${sub}</small></div><div class="acts">${btn}</div></div>`;
      const removeRow = `<div class="item"><span class="ic">${I("broom")}</span><div><b>Put decor away</b><small>Tap "Remove", then a decoration on the farm.</small></div><div class="acts"><button type="button" class="btn-s ghost" data-deco="__remove" ${placed ? "" : "disabled"}>${F.decorPick === "__remove" ? "Removing…" : "Remove"}</button></div></div>`;
      let body;
      if (sheetTab === "storage") {
        const kept = FARM_DECOR.filter((d) => F.decorCredits[d.id] > 0);
        body =
          removeRow +
          (kept.length
            ? kept
                .map((d) => {
                  const picking = F.decorPick === d.id;
                  return row(
                    d,
                    `+${d.charm} Charm · <b style="color:#7ff0a2">×${F.decorCredits[d.id]}</b>`,
                    `<button type="button" class="btn-s${picking ? " green" : " gold"}" data-deco="${d.id}">${picking ? "Placing…" : "Place"}</button>`,
                  );
                })
                .join("")
            : `<p class="sh-note">Storage is empty.</p>`);
      } else
        body = FARM_DECOR.map((d) => {
          const stored = F.decorCredits[d.id] || 0,
            free = stored > 0,
            lock = d.level > F.lv && !free,
            picking = F.decorPick === d.id;
          return row(
            { ...d, lock },
            `+${d.charm} Charm${free ? ` · <b style="color:#7ff0a2">${stored} in storage</b>` : ""}${lock ? ` · <b style="color:#ffd65b">unlocks at Lv ${d.level}</b>` : ""}`,
            `<button type="button" class="btn-s${picking ? " green" : ""}" data-deco="${d.id}" ${lock || (!free && F.leaves < d.price) ? "disabled" : ""}>${picking ? "Placing…" : free ? "Place free" : `${d.price.toLocaleString("en-US")} ${L}`}</button>`,
          );
        }).join("");
      html =
        head("Decorate", `Charm ${F.charm} · +${charmBonus(F.charm)}% XP`, [
          ["buy", "Shop"],
          ["storage", `Storage${storedN ? ` (${storedN})` : ""}`],
        ]) + `<div class="sh-body"><p class="sh-note">${note}</p>${body}</div>`;
    }
    if (sheet === "balloon")
      html =
        head(
          "Supply balloon",
          balloon?.crates
            ? `${balloon.crates.filter((c) => c.state === "done").length}/6 crates`
            : "On its way",
        ) + balloonHTML();
    if (sheet === "friends") {
      const tabs = [
        ["visit", "Visit"],
        [
          "help",
          `Help${helpList?.requests?.length ? ` (${helpList.requests.length})` : ""}`,
        ],
        ["gifts", `Gifts${gifts?.friends?.some((f) => f.waiting) ? " •" : ""}`],
        ["invite", "Invite"],
      ];
      if (sheetTab === "gifts")
        html = head("Neighbors", "Gifts", tabs) + giftsHTML();
      else if (sheetTab === "help")
        html = head("Neighbors", "Help friends", tabs) + helpHTML();
      else if (sheetTab === "invite")
        html = head("Neighbors", "Invite friends", tabs) + inviteHTML();
      else
        html =
          head("Neighbors", "Friends", tabs) +
          `<div class="sh-body"><p class="sh-note">Visit a friend to <b>catch bugs and water</b> (+XP, up to 60 a day) or <b>sneak</b> 1 crop from a ripe plot. Watch out for guard dogs! You get 3 pranks a day.</p>` +
          (friendsList === null
            ? `<p class="sh-note">Loading your friends…</p>`
            : friendsList.length
              ? friendsList
                  .map(
                    (f) =>
                      `<div class="fr"><img src="${options.art(f.fighter)}" alt=""><div><b>${esc(f.name)} · Lv ${f.level}${likesOf(f.id)}</b><small>${f.bugs ? `<span class="bd">${I("bug")} ${f.bugs} bug${f.bugs === 1 ? "" : "s"}</span> · ` : ""}${f.ripe ? `<span class="bd">${I("wheat")} ${f.ripe} ripe</span> · ` : ""}${f.dog ? `${I("dog")} ${DOG[f.dog]?.name ?? "Guard dog"}` : "No guard dog"}</small></div><button type="button" class="btn-s" data-visit="${esc(f.id)}"${V?.id === f.id ? " disabled" : ""}>${V?.id === f.id ? "Here" : "Visit"}</button></div>`,
                  )
                  .join("")
              : `<p class="sh-note">None of your friends has a farm yet. Add friends from the Lobby, or invite them from the Invite tab.</p>`) +
          `</div>`;
    }
    el.innerHTML = html;
    if (sheet === "market" && sheetTab === "stall") wireStallForm(el);
    el.querySelectorAll("[data-dogprev]").forEach((c) => {
      const g = c.getContext("2d");
      g.clearRect(0, 0, 120, 120);
      GFX.dog(g, c.dataset.dogprev, "sit", 0, 54, 108, 1.7, 1);
    });
    lineUpButtons(el);
    const b = el.querySelector(".sh-body");
    if (b) b.scrollTop = top;
  }
  /* Buttons of one kind line up in a column from row to row: each gets the
     width of the widest (a bigger price, "All · 102" next to "All · 30", no
     longer shifts its row's buttons). Measured once each time a sheet is
     drawn, on phones and desktop alike. */
  const LINE_UP = [
    ".b-sell1",
    ".b-sellall",
    '[data-buyseed][data-n="1"]',
    '[data-buyseed][data-n="5"]',
    "[data-buytool]",
    "[data-deco]",
    "[data-mast]",
  ];
  function lineUpButtons(el) {
    for (const sel of LINE_UP) {
      const bs = [...el.querySelectorAll(`.item .acts ${sel}`)];
      if (bs.length < 2) continue;
      const w = Math.max(...bs.map((x) => x.offsetWidth));
      for (const x of bs) x.style.minWidth = `${w}px`;
    }
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
    if (d.shelf) {
      stallSlot = stallSlot === +d.shelf ? null : +d.shelf;
      return renderSheet();
    }
    if ("slist" in d) {
      const [crop, mutation = ""] = stallForm.key.split("|");
      return void stallAct({
        kind: "list",
        slot: stallSlot,
        crop,
        mutation,
        qty: stallForm.qty,
        price: stallPrice(),
      });
    }
    if (d.sunlist) return void stallAct({ kind: "unlist", slot: +d.sunlist });
    if (d.scollect)
      return void stallAct({ kind: "collect", slot: +d.scollect });
    if (d.sbuy) {
      const [seller, slot] = d.sbuy.split(":");
      return void stallAct({ kind: "buy", slot: +slot, seller });
    }
    if (d.bfill) return void balloonAct("fill", +d.bfill);
    if (d.bask) return void balloonAct("ask", +d.bask);
    if ("blaunch" in d) {
      // Leaving early asks for a second tap (it gives up the other crates).
      if (!balReady() && !bal.armed) {
        bal.armed = true;
        setTimeout(() => {
          bal.armed = false;
          if (sheet === "balloon") renderSheet();
        }, 4000);
        return renderSheet();
      }
      bal.armed = false;
      return void balloonAct("launch");
    }
    if (d.hfill) {
      const [friend, slot] = d.hfill.split(":");
      return void helpFill(friend, +slot);
    }
    if (d.giftSend) return void giftAct("send", d.giftSend);
    if (d.giftOpen) return void giftAct("open", d.giftOpen);
    if ("inviteCopy" in d) {
      const inp = $("fm-invite-link");
      try {
        await navigator.clipboard.writeText(inp.value);
        toast("Invite link copied");
      } catch {
        inp.select();
        toast("Select the link and copy it");
      }
      return;
    }
    if (d.tab) {
      if (sheet === "market" && (d.tab === "stall" || d.tab === "paper"))
        void loadStall();
      sheetTab = d.tab;
      return renderSheet();
    }
    if (d.goto) {
      const [s, tab] = d.goto.split(":");
      return openSheet(s, tab);
    }
    if (d.buyseed) {
      act({ a: "buy-seeds", crop: d.buyseed, qty: +d.n }, true);
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
      // Picked in Storage: placing stops when the stored copies run out.
      F.decorFromStore = sheetTab === "storage";
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
  $("fm-rail").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sheet]");
    if (!b) return;
    if (b.dataset.sheet === "friends" && sheet !== "friends") {
      void loadTour();
      void loadFriends();
      void loadGifts();
      void loadHelp();
    }
    if (sheet === b.dataset.sheet) closeSheet();
    else openSheet(b.dataset.sheet);
  });
  $("fm-visit").addEventListener("click", (e) => {
    if (e.target.closest("[data-home]")) void goHome();
    const like = e.target.closest("[data-like]");
    if (like) void likeFarm(like.dataset.like);
    const em = e.target.closest("[data-emote]");
    if (em) sendEmote(em.dataset.emote);
  });
  $("fm-here").addEventListener("click", (e) => {
    const em = e.target.closest("[data-emote]");
    if (em) sendEmote(em.dataset.emote);
  });
  function sendEmote(k) {
    sfx("tick");
    feel.text(cam.x, cam.y - 40, EMO[k] ?? "", "#fff", 40);
    void ping(k);
  }
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
  // A press outside a status orb's card closes it, and a press on the farm
  // itself closes the open sheet too (the rail's lit button also does).
  // On the farm that press only closes: it doesn't also plant, harvest or
  // open a building. Placing decor on desktop keeps the Decorate sheet
  // open: those taps place.
  const closeOutside = (e) => {
    const t = e.target,
      orb = orbOpen && !t.closest("#fm-orbpop, #fm-chips"),
      field = t === cv && sheet && !(sheet === "decor" && F.decorPick);
    if (orb) {
      orbOpen = null;
      $("fm-orbpop").hidden = true;
      renderChips();
    }
    if (field) closeSheet();
    if ((orb || field) && t === cv) {
      e.stopPropagation();
      screen.focus({ preventScroll: true });
    }
  };
  layer.addEventListener("pointerdown", closeOutside, true);
  // The deed and the level-up card: a tap on the dimmed background around
  // them (pressed and let go there, not a drag out of the card) puts them
  // away, like "Not now" and "Awesome!".
  {
    const m = $("fm-modal");
    let pressed = false;
    m.addEventListener("pointerdown", (e) => (pressed = e.target === m));
    m.addEventListener("click", (e) => {
      if (pressed && e.target === m) m.hidden = true;
      pressed = false;
    });
  }
  $("fm-tools").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tool]");
    if (!b) return;
    const id = b.dataset.tool;
    if (id === "fert") {
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
      const f = e.target.closest("[data-tfert]");
      if (f) {
        F.fert = f.dataset.tfert;
        F.tool = "fert";
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
      "Tap a plot, then drag a seed or a tool across the field · drag the grass to move";

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
    $("fm-sickle").hidden = true;
    $("fm-seed").hidden = true;
    $("fm-acts").hidden = true;
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
          holdPaint = true;
          press(tapG.ev);
          holdPaint = false;
        }
      }, HOLD_MS),
    };
  });
  function press(e) {
    screen.focus({ preventScroll: true });
    $("fm-pop").hidden = true;
    $("fm-sickle").hidden = true;
    $("fm-seed").hidden = true;
    $("fm-acts").hidden = true;
    pressType = e.pointerType ?? "mouse";
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
    ) {
      bounce.stall = 1;
      sfx("tick");
      void loadStall();
      return openSheet("market");
    }
    if (
      w.x > BARN.x - 110 &&
      w.x < BARN.x + 140 &&
      w.y > BARN.y - 200 &&
      w.y < BARN.y
    ) {
      bounce.barn = 1;
      sfx("boing");
      return openSheet("barn");
    }
    // The orders board opens the orders, like the market and the barn.
    if (
      !V &&
      w.x > BOARDP.x - 75 &&
      w.x < BOARDP.x + 75 &&
      w.y > BOARDP.y - 140 &&
      w.y < BOARDP.y
    ) {
      bounce.board = 1;
      sfx("tick");
      return openSheet("orders");
    }
    if (balloonHit(w)) {
      sfx("boing");
      void loadBalloon();
      return openSheet("balloon");
    }
    if (Math.hypot(w.x - WELL.x, w.y - (WELL.y - 50)) < 60) {
      bounce.well = 1;
      sfx("splash");
      feel.burst(WELL.x, WELL.y - 70, 10, "drop", {
        v: 100,
        up: 220,
        g: 1200,
        life: 0.7,
      });
      return wishWell();
    }
    if (
      !V &&
      w.x > PAST.x0 &&
      w.x < PAST.x1 &&
      w.y > PAST.y0 - 60 &&
      w.y < PAST.y1
    ) {
      if (F.pasture && Math.hypot(w.x - COW.x, w.y - (COW.y - 30)) < 60) {
        COW.hop = 1;
        sfx("moo");
        FX.push({
          bark: 1,
          x: COW.x,
          y: COW.y - 50,
          t: 0,
          life: 1.4,
          text: "MOO!",
        });
        feel.burst(COW.x, COW.y - 60, 5, "heart", {
          v: 50,
          up: 50,
          life: 1,
          s: 15,
          c: "#ff7aa8",
        });
      }
      return pastureClick();
    }
    const i = plotAt(w.x, w.y);
    if (i < 0) {
      panning = {
        x: e.clientX,
        y: e.clientY,
        cx: cam.x,
        cy: cam.y,
        k: NW / cv.getBoundingClientRect().width,
        w: { x: w.x, y: w.y },
        moved: false,
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
        moved: true,
      };
      CUR.grab = true;
    }
    if (panning) {
      if (Math.hypot(e.clientX - panning.x, e.clientY - panning.y) >= MOVE_PX)
        panning.moved = true;
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
  // A tap on the grass that didn't drag: whatever is there reacts (cosmetic).
  const pokeAt = () =>
    panning && !panning.moved && panning.w ? panning.w : null;
  cv.addEventListener("pointerup", (e) => {
    if (tapG && tapG.id === e.pointerId) {
      clearTimeout(tapG.timer);
      const m = tapG.mode,
        ev = tapG.ev;
      tapG = null;
      if (m === "pending") {
        press(ev);
        const pw = pokeAt();
        endDrag();
        if (pw) poke(pw);
        return;
      }
    }
    const pw = pokeAt();
    endDrag();
    if (pw) poke(pw);
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
    // Wider than 16:10 grows the view's width, taller grows its height, so
    // the farm fills the screen on any shape (it used to leave bands above
    // and below on tall windows). ZMIN then zooms in far enough that the
    // view never shows past the farm's edges.
    if (nw * 800 >= nh * 1280) {
      VH = 800;
      VW = Math.round((800 * nw) / nh);
    } else {
      VW = 1280;
      VH = Math.round((1280 * nh) / nw);
    }
    ZMIN = Math.max(VW / BW, VH / BH);
    Z = Math.max(Z, ZMIN);
    clampCam();
    K = Math.min(nw / VW, nh / VH);
    OFX = (nw - VW * K) / 2;
    OFY = (nh - VH * K) / 2;
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
    hereAt = 0;
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
    hereAt = Infinity;
    void options.gone?.().catch(() => {});
    rainLevel = -1;
    try {
      options.rainSound?.(0);
    } catch {}
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
  let hiddenAway = false;
  const poll = setInterval(() => {
    if (document.hidden || hiddenAway) return;
    if (V) {
      if (!visitQueue.length && !visitSending)
        options
          .visit(V.id)
          .then((v) => V && V.id === v.id && applyVisit(v))
          .catch(() => {});
    } else if (!queue.length && !sending) {
      void refresh();
    }
  }, 60_000);
  onResize();
  if (matchMedia("(pointer: coarse)").matches)
    $("fm-hint").textContent =
      "Tap a plot, then drag a seed or a tool across the field · drag the grass to move";
  // The animals stand where you left them.
  if (left) {
    if (left.dog) Object.assign(dog, left.dog, { path: [], moving: false });
    left.hens?.forEach((h, k) => hens[k] && Object.assign(hens[k], h));
    left.ducks?.forEach((a, k) => FDUCKS[k] && (FDUCKS[k].a = a));
    if (left.cow) Object.assign(COW, left.cow);
  }
  // The farm as last known (this session): drawn at once, then refreshed.
  if (options.initial) {
    try {
      applyState(options.initial);
    } catch {}
  }
  enter();
  void refresh();
  // The Friends button shows a dot when a friend's farm has bugs or ripe crops.
  void loadFriends();
  void loadGifts();
  void loadBalloon();
  void loadHelp();
  // The Market tag shows SOLD! when a friend bought a shelf.
  void loadStall();
  layer.focus({ preventScroll: true });
  return {
    refresh,
    /** Behind the Lobby or the Plaza: paused (no drawing, sound or polls)
     *  and gone from your farm for visiting friends, but kept as it is. */
    hide() {
      if (hiddenAway) return;
      hiddenAway = true;
      void flush();
      leave();
      layer.style.display = "none";
    },
    /** Back on the farm: just as you left it, then refreshed. */
    show() {
      if (!hiddenAway) return;
      hiddenAway = false;
      layer.style.display = "";
      onResize();
      enter();
      void refresh();
      void loadBalloon();
      void loadStall();
      layer.focus({ preventScroll: true });
    },
    close() {
      removeEventListener("pointermove", carryMove, true);
      removeEventListener("pointerup", carryEnd, true);
      removeEventListener("pointercancel", carryEnd, true);
      LEFT.set(options.owner ?? "", {
        dog: {
          x: dog.x,
          y: dog.y,
          face: dog.face,
          wait: 1 + Math.random() * 3,
        },
        hens: hens.map((h) => ({
          x: h.x,
          y: h.y,
          face: h.face,
          tx: null,
          ty: null,
          st: "idle",
          wait: 1 + Math.random() * 2,
        })),
        ducks: FDUCKS.map((d) => d.a),
        cow: { x: COW.x, face: COW.face, t: COW.t },
      });
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
      /** Preview a time of day (0..1), or null for the device clock (tests). */
      tod: (v) => {
        todOverride = v;
        TOD = v ?? deviceTimeOfDay();
      },
      feel,
      hens,
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
      /** The weather's effects state: lightning timing (tests). */
      wx: WX,
      /** The farm's clock, in seconds since it opened (tests). */
      time: () => T,
      /** Whether the Supply Balloon is drawn (tests). */
      hasBalloon: () => !!balloon?.crates,
      /** Where the scenery around the farm stands (tests: it never moves). */
      scenery: () => MARGIN.map((m) => [Math.round(m.x), Math.round(m.y)]),
      /** A world point that opens each place on the farm when tapped (tests). */
      place: (k) =>
        ({
          orders: { x: BOARDP.x, y: BOARDP.y - 70 },
          market: { x: STALL.x, y: STALL.y - 60 },
          barn: { x: BARN.x + 20, y: BARN.y - 60 },
          balloon: { x: BAL.x, y: BAL.y - 30 },
          well: { x: WELL.x, y: WELL.y - 50 },
        })[k],
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
      /** A plot's centre on the farm (tests). */
      plotWorld: (i) => {
        const pr = plotRect(i);
        return { x: pr.x + PW / 2, y: pr.y + PH / 2 };
      },
      /** Zoom (tests): the farm's scale, and a way to set it. */
      zoom: (z) => {
        if (z) {
          Z = Math.max(ZMIN, Math.min(ZMAX, z));
          clampCam();
        }
        return Z;
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
