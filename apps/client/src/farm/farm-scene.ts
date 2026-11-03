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
  SPRINKLER_LEVELS,
  SPRINKLER_PRICES,
  farmXpToNext,
  farmLevelLeaves,
  isStartPlot,
  touchesOwned,
} from "../../../../packages/shared/src/farm";
import {
  FARM_WEATHER_BY_ID,
  FARM_WEATHER_SECONDS,
} from "../../../../packages/shared/src/farm";
import { cropFieldSvg, cropItemSvg } from "./crop-art";
import { GFX } from "./farm-gfx";
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

const FARM_HTML = `<div class="fm" id="fm">
  <canvas id="fm-cv" aria-label="Your farm"></canvas>
  <div class="fm-hud">
    <div class="fm-badge glass" id="fm-badge"></div>
    <div class="fm-chips" id="fm-chips"></div>
    <nav class="fm-dock glass" id="fm-dock" aria-label="Farm">
      <button type="button" class="dk-t" aria-expanded="false" aria-controls="fm-dock"><span>Menu</span></button>
      <button type="button" data-sheet="shop">${I("shop")}<span>Shop</span></button>
      <button type="button" data-sheet="orders">${I("orders")}<span>Orders</span><b class="dot" id="fm-ord-dot" hidden></b></button>
      <button type="button" data-sheet="market">${I("market")}<span>Market</span></button>
      <button type="button" data-sheet="barn">${I("barn")}<span>Barn</span></button>
      <button type="button" data-sheet="book">${I("book")}<span>Almanac</span></button>
    </nav>
    <div class="fm-tools glass" id="fm-tools"></div>
    <div class="fm-log" id="fm-log" aria-live="polite"></div>
    <div class="fm-tip glass" id="fm-tip" hidden></div>
    <div class="fm-pop glass" id="fm-pop" hidden></div>
    <div class="fm-orbpop glass" id="fm-orbpop" hidden></div>
    <section class="fm-sheet glass" id="fm-sheet" hidden></section>
    <div class="fm-zoom glass" id="fm-zoom" role="group" aria-label="Zoom"><button type="button" data-z="in" aria-label="Zoom in" title="Zoom in (+)">+</button><button type="button" data-z="out" aria-label="Zoom out" title="Zoom out (−)">−</button><button type="button" data-z="fit" aria-label="Show the whole farm" title="Show the whole farm">⤢</button></div>
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
  const toast = (m) => options.toast(m);
  // HUD popovers are placed inside the HUD, which keeps clear of notches.
  const hudEl = layer.querySelector(".fm-hud");
  const hudOff = () => {
    const a = hudEl.getBoundingClientRect(),
      b = layer.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  };
  const syncPhone = () => {
    layer.classList.toggle("phone", innerHeight < 500);
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
  const PAST = { x0: 1480, x1: 1720, y0: 420, y1: 664 },
    HOUSE = { x: 190, y: 342 },
    MILL = { x: 470, y: 328 },
    BOARDP = { x: 700, y: 332 },
    STALL = { x: 930, y: 328 },
    BARN = { x: 1250, y: 346 },
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
    crow: null,
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
    log: [],
    decorPick: null,
    shovelArm: null,
    weather: { cur: null },
    visiting: null,
    loaded: false,
  };
  let offset = 0; // server clock minus this device's clock, in ms
  const serverNow = () => Date.now() + offset;
  const barnUsed = () => Object.values(F.barn).reduce((a, b) => a + b, 0);
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
    for (const p of st.plots)
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
        crow: null,
      });
    if (!F.seeds[F.seed]) {
      const first = CROPS.find((c) => F.seeds[c.id]);
      if (first) F.seed = first.id;
    }
    F.loaded = true;
    for (const a of queue) applyLocal(a);
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
        F.barn[key] = (F.barn[key] || 0) + 2;
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
      F.barn[key] = (F.barn[key] || 0) + 2;
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
  const post = (g, x, y) => {
    const gg = g.createLinearGradient(x - 4, 0, x + 4, 0);
    gg.addColorStop(0, "#c48a4a");
    gg.addColorStop(1, "#7a5230");
    g.fillStyle = gg;
    g.beginPath();
    g.roundRect(x - 4, y - 28, 8, 30, 3);
    g.fill();
    g.fillStyle = "#e0a868";
    g.beginPath();
    g.ellipse(x, y - 28, 4, 2, 0, 0, 7);
    g.fill();
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
  function drawLockedPlot(g, i, s) {
    const r = plotRect(i),
      cx = r.x + r.w / 2,
      me = s.me,
      can = me && touching(s.plots, i);
    g.globalAlpha = can ? 1 : 0.55;
    g.fillStyle = "rgba(20,50,20,.3)";
    g.beginPath();
    g.roundRect(r.x + 2, r.y + 5, r.w, r.h, 12);
    g.fill();
    g.fillStyle = "#7cc45e";
    g.beginPath();
    g.roundRect(r.x, r.y, r.w, r.h, 12);
    g.fill();
    GFX.srand(i * 13 + 5);
    for (let k = 0; k < 9; k++) {
      const x = r.x + 8 + GFX.rnd() * (r.w - 16),
        y = r.y + 10 + GFX.rnd() * (r.h - 14);
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
    if (i % 3 === 0)
      GFX.blit(g, GFX.rock(i + 40, 22), r.x + r.w * 0.3, r.y + r.h * 0.8);
    g.globalAlpha = 1;
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
  function drawPlot(g, i, p, time, s) {
    const r = plotRect(i),
      cx = r.x + r.w / 2;
    if (p.locked) {
      drawLockedPlot(g, i, s);
      return;
    }
    const sg = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    sg.addColorStop(0, p.wet ? "#4a301c" : "#8a5e36");
    sg.addColorStop(1, p.wet ? "#3a2412" : "#6b4527");
    g.fillStyle = "rgba(0,0,0,.25)";
    g.beginPath();
    g.roundRect(r.x + 2, r.y + 5, r.w, r.h, 12);
    g.fill();
    g.fillStyle = sg;
    g.beginPath();
    g.roundRect(r.x, r.y, r.w, r.h, 12);
    g.fill();
    g.strokeStyle = p.wet ? "rgba(140,200,255,.25)" : "rgba(255,220,170,.22)";
    g.lineWidth = 2;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo(r.x + 10, r.y + (k * r.h) / 4);
      g.lineTo(r.x + r.w - 10, r.y + (k * r.h) / 4);
      g.stroke();
    }
    if (p.wet) {
      g.fillStyle = "rgba(160,215,255,.18)";
      g.beginPath();
      g.ellipse(cx - 18, r.y + 18, 22, 7, -0.2, 0, 7);
      g.fill();
    }
    if (p.fert) {
      g.fillStyle =
        p.fert === "gold" ? "rgba(255,210,80,.6)" : "rgba(200,255,140,.5)";
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.arc(r.x + 16 + k * 14, r.y + r.h - 10 - (k % 2) * 6, 2.2, 0, 7);
        g.fill();
      }
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
      for (const [n, len, sp, lw, a] of [
        [heavy ? 240 : 170, 15, 760, 1.3, 0.38],
        [heavy ? 160 : 110, 28, 1180, 2.3, 0.72],
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
      for (let k = 0; k < (heavy ? 54 : 40); k++) {
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
    if (!s.me && !["can", "net", "hand"].includes(F.tool)) return;
    const ids =
      s.me && ["can", "net", "sickle"].includes(F.tool)
        ? area(hoverI, AREA(F.tool))
        : [hoverI];
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

  const cur = () => ({ plots: F.plots, me: true });

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
    if (barnUsed() + 2 > F.barnCap) {
      if (!silent)
        toast("Your barn is full! Sell something or upgrade the barn.");
      return false;
    }
    const c = CROP[p.crop],
      r = plotRect(i);
    fly(r.x + PW / 2, r.y + 10, icon(c.id), "+2");
    float(r.x + PW / 2, r.y - 30, `+${c.xp} XP`, "#7ff0a2");
    act({ a: "harvest", plot: i });
    if (dragging) {
      combo.n++;
      if (combo.n >= 3)
        float(r.x + PW / 2, r.y - 26, `Combo ×${combo.n}!`, "#ff9bd2");
    }
    return true;
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
  /** The Sickle: every ripe plot of the 3×3 in one go. */
  function sickleAt(i) {
    const ripe = area(i, 3).filter((j) => {
      const q = F.plots[j];
      return !q.locked && q.crop && q.prog >= 1;
    });
    if (!ripe.length) return false;
    if (barnUsed() + 2 > F.barnCap) {
      toast("Your barn is full! Sell something or upgrade the barn.");
      return false;
    }
    for (const j of ripe) {
      const c = CROP[F.plots[j].crop],
        r = plotRect(j);
      fly(r.x + PW / 2, r.y + 10, icon(c.id), "+2");
      float(r.x + PW / 2, r.y - 30, `+${c.xp} XP`, "#7ff0a2");
    }
    act({ a: "harvest", plot: i, tool: "sickle" });
    return true;
  }
  function useTool(i, drag = false) {
    const p = F.plots[i];
    if (!p || !F.loaded) return;
    if (p.locked) {
      if (!drag) landClick(i);
      return;
    }
    const r = plotRect(i),
      cx = r.x + PW / 2;
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
      tools = FARM_UNLOCKS.filter(([l]) => l > from && l <= to).map(
        ([, n]) => n,
      );
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
      [338, 280, "apple", 0.62],
      [812, 240, "cherry", 0.6],
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
    s.plots.forEach((p, i) =>
      items.push({
        y: plotRect(i).y + PH * 0.72,
        d: () => drawPlotCrop(ctx, i, p, time),
      }),
    );
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
    items.push({
      y: 570,
      d: () => {
        GFX.blit(ctx, GFX.rock(61, 40), 1530, 610);
        GFX.blit(ctx, GFX.bush("green", 62, 56), 1680, 640);
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
      if (f.text) {
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
  function step(now) {
    raf = requestAnimationFrame(step);
    // Never negative: the first frame can be stamped before enter() ran.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    T = now / 1000;
    if (!inited) return;
    const sn = serverNow();
    for (const p of F.plots) if (p.crop) p.prog = growth(p, sn);
    if (keysF.size) {
      const sp = (600 * dt) / Z;
      if (keysF.has("a") || keysF.has("arrowleft")) cam.x -= sp;
      if (keysF.has("d") || keysF.has("arrowright")) cam.x += sp;
      if (keysF.has("w") || keysF.has("arrowup")) cam.y -= sp;
      if (keysF.has("s") || keysF.has("arrowdown")) cam.y += sp;
      clampCam();
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
          h.tx = 30 + Math.random() * 540;
          h.ty = 790 + Math.random() * 120;
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
        .map((w) => w[0] + (w[0] === "weather" ? F.weather.cur : ""))
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
        p = Math.max(0, Math.min(1, weatherLeft() / FARM_WEATHER_SECONDS));
      h = `<div class="op-h">${I(w.icon)}<b>${w.name}</b><span class="op-tag">Now</span></div><p>${w.text}.</p><div class="op-big">${fmtSecs(weatherLeft())}<small>until it changes</small></div><div class="op-bar" style="--rc:${w.color}"><i style="width:${p * 100}%"></i></div>${n ? `<div class="op-next"><span>Next</span>${I(n.icon)}<b>${n.name}</b></div><p class="op-note">${n.text}.</p>` : ""}`;
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
      r = btn.getBoundingClientRect(),
      dk = $("fm-dock").getBoundingClientRect();
    el.style.top = `${r.bottom - hud.top + 10}px`;
    el.style.right = `${Math.max(8, hud.right - r.right - 6, hud.right - dk.left + 8)}px`;
  }
  const TOOLS = () => [
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
    const p = F.plots[i],
      tip = $("fm-tip");
    if (!p || p.locked || !p.crop) {
      tip.hidden = true;
      return;
    }
    const c = CROP[p.crop],
      r = plotRect(i),
      o = hudOff(),
      sp0 = toScreen(r.x + PW, r.y),
      sp = { x: sp0.x - o.x, y: sp0.y - o.y };
    const left = p.prog < 1 && p.ripeAt ? (p.ripeAt - serverNow()) / 1000 : 0;
    tip.hidden = false;
    tip.innerHTML = `<b>${c.n}</b><div class="bar"><i style="width:${p.prog * 100}%"></i></div><div class="row"><span>${p.prog >= 1 ? "Ready" : "Time left"}</span><span>${p.prog >= 1 ? "Harvest now" : fmtSecs(left)}</span></div><div class="row"><span>Water</span><span>${p.wet ? "watered" : "dry"}</span></div>${p.pests ? `<div class="row"><span>Bugs</span><span>${p.pests} · ${p.pests * 20}% slower</span></div>` : ""}${p.fert ? `<div class="row"><span>Fertilizer</span><span>${p.fert === "gold" ? "gold" : "regular"}</span></div>` : ""}`;
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
      if (sheetTab === "land") {
        const k = F.land,
          ok = F.lv >= landLv(k),
          done = k >= 35;
        html += `<p class="sh-note">Buy more land one plot at a time. Each plot costs more than the last. You can only buy plots <b>next to land you own</b>; they show a <b>FOR SALE</b> sign.</p><div class="landmap" style="grid-template-columns:repeat(${COLS},1fr)">${F.plots.map((p, i) => `<button type="button" class="lm ${!p.locked ? "own" : buyable(i) ? "can" : "no"}" ${buyable(i) ? `data-landbuy="${i}"` : "disabled"} title="${!p.locked ? "Your land" : buyable(i) ? "For sale" : "Not yet"}">${!p.locked ? (p.crop ? I("sprout") : "") : buyable(i) ? I("sign") : ""}</button>`).join("")}</div><div class="item"><span class="ic">${I("sign")}</span><div><b>Next plot · ${15 + k}/${FARM_PLOTS} plots</b><small>${done ? "You own every plot" : `${landPrice(k)} ${L} · needs Lv ${landLv(k)}${ok ? "" : ` · <b style="color:#ffd65b">you are Lv ${F.lv}</b>`}`}</small></div></div>`;
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
                  }<span class="price">${price(k)} ${L}</span> each <span class="trend ${id === F.market.hot ? "fire" : "up"}">${id === F.market.hot ? "HOT" : ""} ×${m.toFixed(2)}</span></small></div><div class="acts"><button type="button" class="btn-s" data-sell="${k}" data-n="1">Sell 1</button><button type="button" class="btn-s ghost" data-sell="${k}" data-n="${n}">All · ${price(k) * n} ${L}</button></div></div>`;
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
            .join("");
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
                : "Regular"
            } · ${price(k)} ${L} each</small></div><div class="acts"><button type="button" class="btn-s ghost" data-goto="market:sell">Sell</button></div></div>`;
          })
          .join("")}</div>`;
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
          `<div class="sh-body"><p class="sh-note">Harvest a crop to log it in your book.</p><div class="book">${PCROPS.map(
            (c) => {
              const n = F.harv[c.id] || 0;
              return `<div class="bk${n ? "" : " unk"}" title="${n ? `${c.n} · harvested ${n}×` : `Unlocks at Lv ${c.lv}`}"><img src="${icon(c.id)}" alt=""><span>${n ? c.n : `??? · Lv ${c.lv}`}</span><span class="muts"><small>${n ? `${n}×` : ""}</small></span></div>`;
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
    el.innerHTML = html;
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
    if ("barnup" in d) {
      act({ a: "upgrade-barn" }, true);
      return;
    }
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
    if (d.sell) {
      const [id, mut] = d.sell.split("|"),
        n = +d.n;
      act({ a: "sell", crop: id, mutation: mut || "", qty: n }, true);
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
    const b = e.target.closest("[data-sheet]");
    if (!b) return;
    if (sheet === b.dataset.sheet) closeSheet();
    else openSheet(b.dataset.sheet);
    if (NH < 500 && dockEl.classList.contains("open")) dockSet(false);
  });
  $("fm-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-orb]");
    if (!b) return;
    orbOpen = orbOpen === b.dataset.orb ? null : b.dataset.orb;
    renderChips();
    if (!orbOpen) $("fm-orbpop").hidden = true;
  });
  $("fm-orbpop").addEventListener("click", (e) => {
    if (!e.target.closest("[data-orbgo]")) return;
    orbOpen = null;
    $("fm-orbpop").hidden = true;
    openSheet("barn");
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
  /* side menu: collapsed shows icons, expanded adds names (remembered on this device) */
  const dockEl = $("fm-dock"),
    dockSet = (open) => {
      dockEl.classList.toggle("open", open);
      const t = dockEl.querySelector(".dk-t");
      t.setAttribute("aria-expanded", String(open));
      t.innerHTML = `${I(open ? "close" : "menu")}<span>${open ? "Hide names" : "Menu"}</span>`;
      try {
        localStorage.setItem("fmDockOpen", open ? "1" : "0");
      } catch {}
    };
  dockEl
    .querySelector(".dk-t")
    .addEventListener("click", () =>
      dockSet(!dockEl.classList.contains("open")),
    );
  let dock0 = false;
  try {
    dock0 = localStorage.getItem("fmDockOpen") === "1";
  } catch {}
  dockSet(dock0);
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
    if (k === "escape") {
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
    const phone = nh < 500;
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
      Math.min(2, devicePixelRatio || 1),
    );
  };
  addEventListener("resize", onResize);
  // While the farm is open, come back to the server now and then: ripe
  // crops, the restock and the market day are all decided there.
  const poll = setInterval(() => {
    if (!document.hidden && !queue.length && !sending) void refresh();
  }, 60_000);
  onResize();
  if (matchMedia("(pointer: coarse)").matches)
    $("fm-hint").textContent =
      "Drag to move · pinch to zoom · hold a plot to plant many";
  enter();
  void refresh();
  layer.focus({ preventScroll: true });
  return {
    refresh,
    close() {
      void flush();
      leave();
      clearInterval(poll);
      removeEventListener("resize", onResize);
      layer.remove();
    },
    /** Debug handle for tests. */
    _dbg: {
      F,
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
