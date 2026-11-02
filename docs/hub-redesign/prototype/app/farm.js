/* ======================================================================
   ELEMENTAL FARM: crops, levels, tools, dogs, weather, friends
   ====================================================================== */
const REAL = 240; // one farm time unit = 4 real minutes (crop and timer lengths are written in units)
// Real time by default: the farm clock advances 1 unit every 4 real minutes, so a "1 h" crop takes one real hour.
// Settings → "Fast demo time" makes 1 unit pass every real second, only for trying the demo.
const FAST = (() => { try { return localStorage.getItem("ea-fast") === "1"; } catch { return false; } })();
const TSCALE = FAST ? 1 : 1 / REAL;
// units until the next wall-clock boundary (every `hours` hours, starting at `offset` o'clock)
const untilClock = (hours, offset = 0, at = new Date()) => { const s = at.getHours() * 3600 + at.getMinutes() * 60 + at.getSeconds(), per = hours * 3600; let left = ((offset * 3600 - s) % per + per) % per; if (left < 1) left = per; return left / REAL; };
const W_HOURS = 4, SHOP_HOURS = 4, SHOP_OFFSET = 2;
const fmtReal = s => { const sec = Math.max(0, s * REAL), m = Math.floor(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : m >= 1 ? `${m}m` : `${Math.ceil(sec)}s`; };
const fmtClock = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const CROPS = [
  ["wheat", "Breeze Wheat", "Aura", "#f2d27a", "#c9952f", "grain", 15, 5, 5, 3, 1],
  ["carrot", "Earth Carrot", "Earth", "#ff8a3d", "#c4520f", "root", 20, 5, 5, 4, 1],
  ["voltberry", "Volt Berry", "Electric", "#ffd84a", "#e09a00", "berry", 25, 5, 5, 5, 2],
  ["pepper", "Ember Pepper", "Fire", "#ff4b2b", "#b0180a", "pepper", 30, 5, 5, 5, 4],
  ["mint", "Spirit Mint", "Aura", "#7fe7ff", "#1f9fb8", "herb", 28, 5, 5, 5, 3],
  ["lotus", "Tide Lotus", "Water", "#ff9bd2", "#e0559a", "lotus", 35, 5, 6, 6, 6],
  ["lumen", "Lumen Bloom", "Light", "#fff1a8", "#f2b62a", "flower", 40, 10, 9, 7, 8],
  ["duskcap", "Dusk Cap", "Shadow", "#8a6bff", "#3f2aa8", "mushroom", 45, 10, 9, 7, 10],
  ["plum", "Mind Plum", "Psychic", "#c47dff", "#6a2fb8", "tree", 50, 10, 9, 8, 12],
  ["pumpkin", "Lava Pumpkin", "Fire", "#ff8a1a", "#c0400a", "gourd", 60, 15, 13, 11, 17],
  ["grape", "Thunder Grape", "Electric", "#7a8cff", "#3340c8", "vine", 55, 15, 13, 10, 15],
  ["yam", "Crystal Yam", "Earth", "#c3adff", "#6f55d6", "crystal", 70, 15, 14, 12, 25],
  ["cactus", "Sun Cactus", "Light", "#ff8fb8", "#e04a86", "cactus", 65, 15, 14, 12, 22],
  ["kelp", "Star Kelp", "Water", "#5ff0e0", "#13909a", "kelp", 60, 15, 13, 11, 19],
  ["poppy", "Dream Poppy", "Psychic", "#ff6fae", "#9b3fd8", "flower", 75, 15, 14, 13, 28],
  ["melon", "Storm Melon", "Electric", "#57c04e", "#1f6b25", "melon", 90, 25, 22, 18, 35],
  ["orange", "Phoenix Orange", "Fire", "#ffad1f", "#e0480f", "tree", 100, 25, 23, 19, 42],
  ["pearl", "Pearl Pea", "Water", "#f4f8ff", "#8fc4f0", "pod", 95, 25, 23, 19, 38],
  ["halotea", "Halo Tea", "Light", "#d8ff8a", "#7fbf3a", "herb", 85, 20, 18, 14, 31],
  ["cotton", "Void Cotton", "Shadow", "#efe8ff", "#8a6bff", "boll", 110, 25, 24, 21, 46],
  ["ginseng", "Stone Ginseng", "Earth", "#f0cf9a", "#a8743a", "root", 120, 30, 27, 22, 50],
  ["starfruit", "Rainbow Starfruit", "Light", "#ffe27a", "#ff7ab8", "star", 150, 45, 41, 32, 66],
  ["boltcorn", "Twin Bolt Corn", "Electric", "#ffd65b", "#5a74ff", "corn", 140, 40, 37, 31, 60],
  ["emberlily", "Dragon Lily", "Fire", "#ff8a4f", "#ffd65b", "bigflower", 160, 45, 42, 34, 72],
  ["dreamshroom", "Dreamwhale Shroom", "Psychic", "#c9a3ff", "#4fd6ff", "glowshroom", 180, 50, 46, 37, 80],
].map(([id, n, el, c, c2, shape, t, cost, sell, xp, lv]) => ({ id, n, el, c, c2, shape, t, cost, sell, xp, lv, rar: lv >= 60 ? "legendary" : lv >= 35 ? "rare" : lv >= 15 ? "uncommon" : "common" }));
const CROP = Object.fromEntries(CROPS.map(c => [c.id, c]));
const FARM_CROP = CROP;
const RAR_VN = { common: "Common", uncommon: "Uncommon", rare: "Rare", legendary: "Legendary" };
const MUTS = {
  gold: { n: "Gold", x: 5, cls: "gold", tint: "#ffcf3a", a: .5 }, rainbow: { n: "Rainbow", x: 15, cls: "rainbow" },
  shock: { n: "Shocked", x: 3, cls: "shock", tint: "#9fd0ff", a: .38 }, moon: { n: "Moonlit", x: 2.5, cls: "moon", tint: "#b48cff", a: .38 },
  frost: { n: "Frozen", x: 2, cls: "frost", tint: "#e8fbff", a: .48 }, wet: { n: "Wet", x: 1.5, cls: "wet", tint: "#4fb3ff", a: .2 },
};
const MUT_ORDER = ["gold", "rainbow", "shock", "moon", "frost", "wet"];
const WEATHERS = {
  sun: { n: "Sunny", ic: "sun", c: "#ffd65b", d: "Crops grow 10% faster", w: 30 },
  rain: { n: "Rain", ic: "rain", c: "#4fb3ff", d: "Waters every plot · 30% Wet ×1.5", w: 22 },
  storm: { n: "Thunderstorm", ic: "storm", c: "#9fd0ff", d: "25% Shocked ×3", w: 14 },
  moon: { n: "Moonlit Night", ic: "moon", c: "#c9a3ff", d: "25% Moonlit ×2.5", w: 14 },
  frost: { n: "Frost", ic: "snow", c: "#dff6ff", d: "25% Frozen ×2 · crops grow 15% slower", w: 12 },
  rainbow: { n: "Rainbow", ic: "rainbow", c: "#ff9bd2", d: "Gold odds ×3 · Rainbow odds ×10", w: 8 },
};
const DOGS = {
  gold: { n: "Goldie", d: "Scares crows · catches 25% of thieves · digs up 1 gift a day", catch: .25, dig: 1, p1: 60, p3: 150, lv: 3, tint: null },
  black: { n: "Inky", d: "Catches 80% of thieves · 30% fewer bugs · scares crows", catch: .8, dig: 0, p1: 180, p3: 450, lv: 20, tint: ["#2a2420", .72] },
  cream: { n: "Fluffy", d: "Digs up 2 gifts a day · Gold odds ×1.5 · catches 40% of thieves", catch: .4, dig: 2, p1: 300, p3: 750, lv: 40, tint: ["#fff6e6", .5] },
};
const DAY = 360; // farm units in one real day (1 unit = 4 real minutes, so 360 units = 24 h)
const DECOR = [
  ["planter", "Flower Planter", 2250, 3, 16, "prop"], ["lamp", "Street Lamp", 1350, 2, 12, "prop"], ["bush6", "Rose Bush", 450, 1, 3, "nat"], ["bush7", "Fern Bush", 550, 1, 5, "nat"],
  ["rock", "Mossy Rock", 300, 1, 1, "nat"], ["crates", "Crates", 950, 1, 8, "prop"], ["pine", "Pine Tree", 3200, 2, 22, "nat"], ["apple", "Apple Tree", 4200, 4, 30, "nat"],
  ["tower", "Gazebo", 6050, 10, 45, "hd"], ["plum", "Guest Cottage", 8550, 12, 60, "hd"], ["statue", "Golden Voltkit Statue", 30000, 15, 75, "statue"],
].map(([id, n, cost, beauty, lv, kind]) => ({ id, n, cost, beauty, lv, kind }));
const DECO = Object.fromEntries(DECOR.map(d => [d.id, d]));
const DECO_SLOTS = [[80, 830], [230, 870], [530, 870], [1240, 870], [70, 540], [1700, 880], [1390, 890], [390, 890]];
const REQ = [["Volt Boba Truck", "voltkit"], ["Raid Hall", "auralynx"], ["Cindrake's Forge", "cindrake"], ["Mystowl's Library", "mystowl"], ["Tidefin's Kitchen", "tidefin"], ["Lumoth's Shrine", "lumoth"], ["Terradon's Quarry", "terradon"], ["Shadow Guild", "duskveil"]];
const PERKS = {
  voltkit: ["Zap", "Clears every bug on the farm", "zap"], tidefin: ["Downpour", "Waters the whole farm", "water"], cindrake: ["Warmth", "No bugs for 4 hours", "warm"],
  lumoth: ["Early Sun", "Crops grow 20% faster", null], terradon: ["Rich Soil", "+1 crop per harvest", null], auralynx: ["Shield", "Friends can't drop bugs on you", null],
  mystowl: ["Foresight", "See one more weather forecast", null], duskveil: ["Night Stalker", "+1 crop for every bug you catch", null],
};

const FM = (() => {
  let VW = 1280; const VH = 800;
  const COLS = 10, ROWS = 5, PW = 96, PH = 62, GAP = 10, OX = 360, OY = 380, WW = 1760, WH = 1080;
  const FW = COLS * PW + (COLS - 1) * GAP, FH = ROWS * PH + (ROWS - 1) * GAP, FCX = OX + FW / 2;
  const PAST = { x0: 1480, x1: 1720, y0: 420, y1: 664 }, HOUSE = { x: 190, y: 342 }, MILL = { x: 470, y: 328 }, BOARDP = { x: 700, y: 332 }, STALL = { x: 930, y: 328 }, BARN = { x: 1250, y: 346 }, WELL = { x: 150, y: 700 }, DOGH = { x: 1600, y: 810 }, POND = { x: 250, y: 990, rx: 150, ry: 56 };
  const WX0 = -360, WY0 = -180, WX1 = WW + 360, WY1 = WH + 200, BW = WX1 - WX0, BH = WY1 - WY0;
  let Z = .86, cam = { x: OX + FW / 2, y: 520 }, panning = null; let ZMIN = Math.max(VW / BW, VH / BH); let ZMAX = 1.35, wasPhone = false; const keysF = new Set();
  const cv = $("fm-cv"), ctx = cv.getContext("2d");
  let NW = 1280, NH = 800, PS = 1, K = 1, OFX = 0, OFY = 0;
  let running = false, raf = 0, last = 0, T = 0, inited = false;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const _NAT_UNUSED = [[30, 44, 381, 362], [440, 53, 381, 349], [852, 45, 372, 368], [40, 412, 363, 457], [461, 453, 359, 408], [918, 437, 255, 429], [34, 918, 372, 295], [431, 914, 399, 297], [874, 952, 345, 250]].map(a => a.map(v => v * .5));
  const PROP = Object.fromEntries(Object.entries({ well: [45, 12, 377, 447], lamp: [581, 13, 90, 442], board: [798, 18, 430, 420], sign: [77, 471, 327, 360], crates: [437, 541, 394, 283], mirror: [912, 432, 277, 411], plinth: [67, 864, 330, 350], dummy: [492, 837, 278, 382], planter: [824, 863, 405, 342] }).map(([k, a]) => [k, a.map(v => v * .5)]));
  const ANI = [[16, 82, 343, 208], [402, 74, 310, 217], [735, 91, 337, 199], [1124, 89, 298, 201], [72, 384, 237, 283], [423, 381, 233, 286], [761, 380, 281, 288], [1123, 380, 272, 287], [18, 717, 331, 267], [385, 725, 328, 270], [766, 725, 254, 281], [1119, 694, 313, 297]].map(a => a.map(v => v * .5));
  function tintCanvas(src, crop, color, a) { const [sx, sy, sw, sh] = crop || [0, 0, src.width, src.height], o = document.createElement("canvas"); o.width = sw; o.height = sh; const g = o.getContext("2d"); g.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh); g.globalCompositeOperation = "source-atop"; g.globalAlpha = a; g.fillStyle = color; g.fillRect(0, 0, sw, sh); return o; }
  /* ---------- crop art: drawn by CROPART (crops.js) ---------- */
  const cropSVG = (c, st) => CROPART.field(c, st);
  const CIMG = {};
  CROPS.forEach(c => { CIMG[c.id] = [0, 1, 2, 3, 4].map(st => { const im = new Image(); im.src = svgUrl(cropSVG(c, st)); return im; }); });
  const MILK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width="240" height="280"><defs><linearGradient id="mk" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe6ff"/></linearGradient></defs><path d="M44 40 h32 v14 l10 16 v52 a8 8 0 0 1 -8 8 h-36 a8 8 0 0 1 -8 -8 v-52 l10 -16z" fill="url(#mk)" stroke="#5f8cc0" stroke-width="3"/><rect x="40" y="28" width="40" height="14" rx="4" fill="#4fb3ff" stroke="#2a6fd0" stroke-width="2"/><rect x="38" y="84" width="44" height="26" rx="4" fill="#ffd65b"/><path d="M60 88 l-6 10 h5 l-3 9 l9 -12 h-5 l3 -7z" fill="#2a1f4c"/><ellipse cx="50" cy="70" rx="3" ry="10" fill="#fff" opacity=".8"/></svg>`;
  CROP.milk = { id: "milk", n: "Storm Milk", el: "Earth", c: "#ffffff", c2: "#9fd0ff", shape: "milk", t: 80, cost: 0, sell: 60, xp: 8, lv: 9, rar: "rare" };
  CIMG.milk = [0, 1, 2, 3, 4].map(() => { const im = new Image(); im.src = svgUrl(MILK_SVG); return im; });
  // menus, barn and orders show the harvested produce (like Stardew and Hay Day item icons); the field shows the plant
  const ITEM = {}; CROPS.forEach(c => { const im = new Image(); im.src = svgUrl(CROPART.item(c)); ITEM[c.id] = im; });
  const icon = id => (ITEM[id] || CIMG[id][4]).src;
  const mcache = new Map();
  function cropImage(id, st, mut, time) {
    const base = CIMG[id][st]; if (!mut || !base.complete) return base;
    let key = `${id}|${st}|${mut}`;
    if (mut === "rainbow") { const h = Math.floor((time * 3) % 6); key += h; if (!mcache.has(key)) mcache.set(key, tintCanvas(base, null, `hsl(${h * 60} 95% 60%)`, .42)); return mcache.get(key); }
    if (!mcache.has(key)) mcache.set(key, tintCanvas(base, null, MUTS[mut].tint, MUTS[mut].a));
    return mcache.get(key);
  }

  /* ---------- state ---------- */
  // what each farm level opens (crops come from their own table, dogs from DOGS)
  const FARM_UNLOCKS = [[4, "Scarecrow"], [6, "Super Fertilizer"], [8, "Copper Can"], [10, "Big Net"], [14, "Sickle"], [18, "Sprinkler"], [24, "Gold Fertilizer"], [30, "Gold Can"], [40, "Crop Mastery"]];
  const MAX_LV = 100, need = lv => lv >= MAX_LV ? Infinity : Math.round((40 + 2.418 * lv ** 2.1) / 10) * 10;
  const mkPlot = (o = {}) => ({ crop: null, prog: 0, wet: false, fert: null, pests: 0, mut: [], crow: null, locked: false, ...o });
  const F = {
    lv: 7, xp: 110, harv: {}, mast: {}, plots: [], seeds: { wheat: 10, carrot: 6, voltberry: 6, pepper: 4, mint: 3, lotus: 2, lumen: 1 }, barn: {}, barnCap: 80, barnUp: 0,
    can: 1, net: 1, sickle: false, scarecrow: false, sprinklers: [false, false, false, false, false], ferts: { norm: 3, super: 1, gold: 0 }, land: 0, pasture: false, milk: 30,
    dog: { type: "gold", until: DAY * .9, total: DAY }, dug: 0, decor: [null, "planter", null, null, null, "bush6", "lamp", null], seen: {}, sold: 0, coinsToday: 0,
    weather: { cur: "sun", until: FAST ? 60 : untilClock(W_HOURS), next: "rain", next2: "storm" }, shop: { at: 0, stock: {} }, market: { day: 0, mult: {}, until: FAST ? DAY : untilClock(24) }, orders: [], wish: true,
    tool: "hand", seed: "wheat", fert: "norm", warmUntil: 0, pranks: 3, gifts: 1, log: [], visiting: null, decorPick: null, shovelArm: null,
  };
  const START = i => (i % COLS) < 5 && Math.floor(i / COLS) < 3;
  for (let i = 0; i < COLS * ROWS; i++) F.plots.push(mkPlot({ locked: !START(i) }));
  const pre = { 0: ["voltberry", 1, ["gold"]], 1: ["voltberry", .82], 2: ["wheat", 1], 3: ["carrot", .55, null, 1], 4: ["pepper", .35, null, 0, true], 10: ["mint", .7, null, 0, true], 11: ["lotus", .2], 12: ["wheat", .9], 14: ["lumen", .48, null, 1], 21: ["carrot", 1, ["shock"]], 22: ["wheat", .6] };
  Object.entries(pre).forEach(([i, [crop, prog, mut, pests, wet]]) => Object.assign(F.plots[+i], { crop, prog, mut: mut || [], pests: pests || 0, wet: !!wet }));
  const LAND_LV = [3, 5, 7, 9, 11, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 37, 39, 41, 43, 45, 47, 49, 51, 53, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74], LAND_PRICE = [350, 400, 500, 600, 650, 800, 1150, 1200, 1250, 1400, 1450, 1500, 1550, 1600, 1700, 1750, 1800, 1850, 1900, 1950, 2000, 2050, 2100, 2200, 2250, 2300, 2350, 2450, 2500, 2550, 2600, 2700, 2750, 2800, 2850];
  const landPrice = k => LAND_PRICE[Math.min(k, 34)], landLv = k => LAND_LV[Math.min(k, 34)], LAND_MAX = COLS * ROWS - 15;
  const touching = (plots, i) => { const c = i % COLS, r = Math.floor(i / COLS); return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => { const cc = c + dc, rr = r + dr; return cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && !plots[rr * COLS + cc].locked; }); };
  const buyable = i => F.plots[i].locked && touching(F.plots, i);
  const LAND_ORDER = F.plots.map((_, i) => i).filter(i => !START(i)).sort((a, b) => ((a % COLS) + Math.floor(a / COLS) * .9) - ((b % COLS) + Math.floor(b / COLS) * .9));
  const COW = { milk: 30, x: 1600, y: 610, face: -1, t: 0 };
  const MARGIN = []; (() => { GFX.srand(91); const r = GFX.rnd, kinds = ["round", "pine", "mint", "autumn", "pine", "apple", "round", "cherry"];
    const inMargin = (x, y) => (x < -40 || x > WW + 40 || y < -10 || y > WH + 50) && !(y > -120 && y < -20) && Math.abs(x - FCX) > 90 && !(Math.abs(x - HOUSE.x) < 50 && y < 0);
    for (let i = 0; i < 1600 && MARGIN.filter(m => m.t).length < 52; i++) { const x = WX0 + 30 + r() * (BW - 60), y = WY0 + 70 + r() * (BH - 80); if (inMargin(x, y) && MARGIN.every(m => Math.hypot(m.x - x, m.y - y) > 115)) MARGIN.push({ x, y, t: GFX.tree(kinds[MARGIN.length % kinds.length], 200 + i, .75 + r() * .35), ph: r() * 6 }); }
    for (let i = 0; i < 1600 && MARGIN.filter(m => m.b).length < 34; i++) { const x = WX0 + 20 + r() * (BW - 40), y = WY0 + 40 + r() * (BH - 50); if (inMargin(x, y) && MARGIN.every(m => Math.hypot(m.x - x, m.y - y) > 80)) MARGIN.push({ x, y, b: r() < .7 ? GFX.bush(["flower", "green", "rose", "mint"][i % 4], 300 + i, 56 + r() * 30) : GFX.rock(400 + i, 30 + r() * 30) }); }
  })();
  const FDUCKS = [{ k: "drake", a: 0, s: .25 }, { k: "hen", a: 2.5, s: .2 }];
  const addBarn = (id, mut = "", n = 1) => { const k = `${id}|${mut}`; F.barn[k] = (F.barn[k] || 0) + n; if (F.barn[k] <= 0) delete F.barn[k]; };
  addBarn("wheat", "", 14); addBarn("carrot", "", 6); addBarn("voltberry", "", 9); addBarn("pepper", "", 3); addBarn("mint", "", 4); addBarn("voltberry", "gold", 1); addBarn("lotus", "wet", 2);
  ["wheat", "carrot", "voltberry", "pepper", "mint", "lotus", "lumen", "duskcap"].forEach(id => F.seen[id] = new Set([""]));
  F.seen.voltberry.add("gold"); F.seen.lotus.add("wet"); F.seen.carrot.add("shock");
  const barnUsed = () => Object.values(F.barn).reduce((a, b) => a + b, 0);
  const owned = id => Object.entries(F.barn).filter(([k]) => k.startsWith(id + "|")).reduce((a, [, n]) => a + n, 0);
  const beauty = () => F.decor.reduce((a, d) => a + (d ? DECO[d].beauty : 0), 0);
  const xpBonus = () => Math.min(25, Math.floor(beauty() / 2));
  const gardener = () => CH[S.champ].id;
  const dogOn = () => F.dog && F.dog.until > 0;

  /* market multipliers and orders */
  function newMarket() { F.market.day++; F.market.until = FAST ? DAY : untilClock(24); CROPS.forEach(c => { const prev = F.market.mult[c.id]?.m ?? 1, m = Math.round((.7 + Math.random() * .9) * 100) / 100; F.market.mult[c.id] = { m, prev }; }); F.market.mult.milk = { m: Math.round((.85 + Math.random() * .5) * 100) / 100, prev: F.market.mult.milk?.m ?? 1 }; const hot = pick(CROPS.filter(c => c.lv <= F.lv)); F.market.mult[hot.id].m = 1.6 + Math.random() * .3; F.market.hot = hot.id; }
  newMarket();
  function newOrder() {
    const pool = CROPS.filter(c => c.lv <= F.lv), kinds = 1 + Math.floor(Math.random() * Math.min(3, pool.length)), items = [];
    const used = new Set(); for (let i = 0; i < kinds; i++) { let c; do c = pick(pool); while (used.has(c.id)); used.add(c.id); items.push([c.id, 2 + Math.floor(Math.random() * (c.lv > 4 ? 4 : 7))]); }
    const val = items.reduce((a, [id, n]) => a + CROP[id].sell * n, 0), [who, face] = pick(REQ);
    return { who, face, items, leaves: Math.round(val * 1.45 / 5) * 5, xp: Math.round(items.reduce((a, [id, n]) => a + CROP[id].xp * n, 0)), bonus: Math.random() < .3 ? pick(["super", "gold", "norm"]) : null, wait: 0 };
  }
  const ORDER_WAIT = 5 * 60 / REAL; // a skipped order is replaced after 5 minutes
  F.orders = [newOrder(), newOrder(), newOrder()];
  function restock() {
    F.shop.at = FAST ? 60 : untilClock(SHOP_HOURS, SHOP_OFFSET); F.shop.stock = {};
    CROPS.forEach(c => { const r = c.rar; F.shop.stock[c.id] = r === "common" ? 20 + Math.floor(Math.random() * 10) : r === "uncommon" ? 4 + Math.floor(Math.random() * 7) : r === "rare" ? (Math.random() < .6 ? 1 + Math.floor(Math.random() * 4) : 0) : (Math.random() < .2 ? 1 : 0); });
  }
  restock(); F.shop.stock.starfruit = 1;
  const wpick = () => { const tot = Object.values(WEATHERS).reduce((a, w) => a + w.w, 0); let r = Math.random() * tot; for (const [k, w] of Object.entries(WEATHERS)) { if ((r -= w.w) < 0) return k; } return "sun"; };
  /* The farm is saved on this device (a demo convenience) so real-time crops keep growing while the page is closed. */
  const SAVE_KEY = "ea-farm-v1", TRANSIENT = new Set(["visiting", "decorPick", "shovelArm", "log"]);
  let noSave = false;
  function saveFarm() {
    if (noSave) return;
    try {
      const f = {}; for (const [k, v] of Object.entries(F)) if (!TRANSIENT.has(k)) f[k] = v;
      const data = JSON.stringify({ v: 1, t: Date.now(), F: f, warmLeft: Math.max(0, F.warmUntil - GT), milk: COW.milk, leaves: ECON.leaves, coins: typeof E !== "undefined" ? E.coins : null },
        (k, v) => k === "crow" ? null : v instanceof Set ? { __set: [...v] } : v);
      localStorage.setItem(SAVE_KEY, data);
    } catch { }
  }
  (function loadFarm() {
    let d; try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || "null", (k, v) => v && v.__set ? new Set(v.__set) : v); } catch { d = null; }
    if (!d || d.v !== 1) return;
    Object.assign(F, d.F); ECON.leaves = d.leaves ?? ECON.leaves; if (d.coins != null && typeof E !== "undefined") E.coins = d.coins;
    const away = Math.max(0, (Date.now() - d.t) / 1000 / REAL), then = new Date(d.t), now = new Date();
    F.plots.forEach(p => { p.crow = null; if (!p.crop || p.prog >= 1) return; let rate = 1 / CROP[p.crop].t; if (p.wet) rate *= 1.35; if (p.fert === "norm" || p.fert === "gold") rate *= 1.4; p.prog = Math.min(1, p.prog + rate * away); if (p.prog >= 1) rollMut(p); });
    if (F.dog) F.dog.until = Math.max(0, F.dog.until - away);
    COW.milk = Math.max(0, (d.milk ?? COW.milk) - away);
    F.warmUntil = Math.max(0, (d.warmLeft || 0) - away);
    if (!FAST) {
      const crossed = (hours, off) => Math.floor((now - then) / 3.6e6 / hours + ((then.getHours() + then.getMinutes() / 60 - off + 24) % hours) / hours);
      for (let k = Math.min(3, crossed(W_HOURS, 0)); k > 0; k--) { F.weather.cur = F.weather.next; F.weather.next = F.weather.next2; F.weather.next2 = wpick(); }
      F.weather.until = untilClock(W_HOURS);
      if (crossed(SHOP_HOURS, SHOP_OFFSET) > 0) restock(); else F.shop.at = untilClock(SHOP_HOURS, SHOP_OFFSET);
      if (then.toDateString() !== now.toDateString()) { newMarket(); F.wish = true; F.pranks = 3; F.gifts = 1; F.coinsToday = 0; } else F.market.until = untilClock(24);
    }
    F.log = []; F.visiting = null; F.decorPick = null;
    if (away * REAL > 60) setTimeout(() => log(`Welcome back! You were away ${fmtReal(away)}. Your crops kept growing.`, "good"), 300);
  })();
  setInterval(saveFarm, 15000);
  addEventListener("pagehide", saveFarm); document.addEventListener("visibilitychange", () => { if (document.hidden) saveFarm(); });

  /* friends' farms */
  const FRIENDS = [
    { n: "minh_anh", face: "cindrake", lv: 9, dog: null, seed: 3 }, { n: "BaoTide", face: "tidefin", lv: 14, dog: { type: "black", until: DAY * .4 }, seed: 9 },
    { n: "kenji.owl", face: "mystowl", lv: 11, dog: null, seed: 5 }, { n: "Lena", face: "terradon", lv: 18, dog: { type: "cream", until: DAY * 1.2 }, seed: 21 },
  ];
  function genFarm(f) {
    let s = f.seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pool = CROPS.filter(c => c.lv <= f.lv);
    const open = new Set(LAND_ORDER.slice(0, Math.min(LAND_MAX, Math.floor(f.lv * 1.5)))); f.pasture = f.lv >= 12;
    f.plots = Array.from({ length: COLS * ROWS }, (_, i) => { if (!START(i) && !open.has(i)) return mkPlot({ locked: true }); if (r() < .18) return mkPlot(); const c = pool[Math.floor(r() * pool.length)], prog = r() < .35 ? 1 : r(); return mkPlot({ crop: c.id, prog, pests: prog < 1 && r() < .25 ? 1 + Math.floor(r() * 2) : 0, wet: r() < .4, mut: prog >= 1 && r() < .2 ? [pick(["gold", "shock", "moon"])] : [] }); });
    f.decor = DECO_SLOTS.map((_, i) => r() < .5 ? pick(DECOR.filter(d => d.lv <= f.lv)).id : null);
    f.stolen = new Set();
  }
  FRIENDS.forEach(genFarm);
  const cur = () => F.visiting == null ? { plots: F.plots, decor: F.decor, dog: F.dog, pasture: F.pasture, me: true } : { ...FRIENDS[F.visiting], me: false };

  /* ---------- background ---------- */
  const bg = document.createElement("canvas"); bg.width = BW; bg.height = BH;
  function paintBg() {
    const g = bg.getContext("2d"); g.translate(-WX0, -WY0); GFX.srand(77); const rnd = GFX.rnd;
    g.fillStyle = "#7cc45e"; g.fillRect(WX0, WY0, BW, BH);
    for (let i = 0; i < 44; i++) { const x = (WX0 + rnd() * BW), y = (WY0 + rnd() * BH), r = 100 + rnd() * 220, gr = g.createRadialGradient(x, y, 0, x, y, r), c = rnd() < .5 ? "160,225,120" : "70,150,70"; gr.addColorStop(0, `rgba(${c},.28)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    const greens = ["#6fbb53", "#86cf66", "#62b04c", "#93d672", "#76bf57"];
    for (let i = 0; i < 21000; i++) { const x = (WX0 + rnd() * BW), y = (WY0 + rnd() * BH); g.fillStyle = greens[i % 5]; g.beginPath(); g.ellipse(x, y, 2.4 + rnd() * 2.6, 1.3 + rnd(), rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 1800; i++) { const x = (WX0 + rnd() * BW), y = (WY0 + rnd() * BH); g.strokeStyle = rnd() < .5 ? "#4f9a3c" : "#a6e07e"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x - 4, y - 7); g.moveTo(x, y); g.lineTo(x, y - 9); g.moveTo(x + 3, y); g.lineTo(x + 5, y - 7); g.stroke(); }
    for (let i = 0; i < 460; i++) { const x = (WX0 + rnd() * BW), y = (WY0 + rnd() * BH), c = ["#ffffff", "#fff3a6", "#ffc4dc", "#cfe2ff"][i % 4]; for (let k = 0; k < 5; k++) { g.fillStyle = c; g.beginPath(); g.arc(x + Math.cos(k * 1.256) * 2.2, y + Math.sin(k * 1.256) * 2.2, 1.8, 0, 7); g.fill(); } g.fillStyle = "#ffcf3a"; g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill(); }
    // dirt paths with pebbles
    const dirt = (pts, w) => { g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "rgba(90,70,40,.35)"; g.lineWidth = w + 12; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.strokeStyle = "#d8b98a"; g.lineWidth = w; g.stroke(); g.strokeStyle = "#e6cba0"; g.lineWidth = w * .45; g.stroke(); };
    dirt([[FCX, WY1 + 30], [FCX, OY + FH + 24]], 66);
    dirt([[WX0 - 20, -70], [WX1 + 20, -60]], 70); dirt([[HOUSE.x, HOUSE.y + 10], [HOUSE.x, -66]], 44);
    dirt([[FCX, OY + FH + 70], [420, OY + FH + 70], [260, 620], [HOUSE.x, HOUSE.y + 10]], 52);
    dirt([[FCX, OY + FH + 70], [1460, OY + FH + 70], [DOGH.x - 50, DOGH.y]], 52);
    dirt([[260, OY + FH + 70], [POND.x + 60, POND.y - 70]], 40);
    dirt([[HOUSE.x + 80, HOUSE.y + 10], [BARN.x - 40, BARN.y + 12]], 44);
    // field bed
    const x0 = OX - 20, y0 = OY - 16, w = FW + 40, h = FH + 34;
    g.fillStyle = "rgba(40,25,10,.35)"; g.beginPath(); g.roundRect(x0 + 6, y0 + 10, w, h, 22); g.fill();
    const fg = g.createLinearGradient(0, y0, 0, y0 + h); fg.addColorStop(0, "#8a6038"); fg.addColorStop(1, "#5e3f22"); g.fillStyle = fg; g.beginPath(); g.roundRect(x0, y0, w, h, 22); g.fill();
    g.strokeStyle = "#b0864f"; g.lineWidth = 3; g.stroke();
    // pond
    g.fillStyle = "rgba(40,60,40,.35)"; g.beginPath(); g.ellipse(POND.x, POND.y + 8, POND.rx + 22, POND.ry + 16, 0, 0, 7); g.fill();
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, x = POND.x + Math.cos(a) * (POND.rx + 8), y = POND.y + Math.sin(a) * (POND.ry + 6); g.fillStyle = "#7f8594"; g.beginPath(); g.ellipse(x, y + 3, 15, 9, a, 0, 7); g.fill(); g.fillStyle = ["#c9cdd6", "#b4b9c4", "#d9dce3"][i % 3]; g.beginPath(); g.ellipse(x, y, 14, 8, a, 0, 7); g.fill(); }
    // pasture ground
    g.fillStyle = "rgba(40,80,30,.3)"; g.beginPath(); g.roundRect(PAST.x0 + 4, PAST.y0 + 8, PAST.x1 - PAST.x0, PAST.y1 - PAST.y0, 18); g.fill();
    g.fillStyle = "#8fd46a"; g.beginPath(); g.roundRect(PAST.x0, PAST.y0, PAST.x1 - PAST.x0, PAST.y1 - PAST.y0, 18); g.fill();
    for (let i = 0; i < 180; i++) { const x = PAST.x0 + 8 + rnd() * (PAST.x1 - PAST.x0 - 16), y = PAST.y0 + 8 + rnd() * (PAST.y1 - PAST.y0 - 16); g.strokeStyle = rnd() < .5 ? "#5fae4a" : "#b6ec8c"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 7); g.moveTo(x + 2, y); g.lineTo(x + 4, y - 6); g.stroke(); }
  }
  const post = (g, x, y) => { const gg = g.createLinearGradient(x - 4, 0, x + 4, 0); gg.addColorStop(0, "#c48a4a"); gg.addColorStop(1, "#7a5230"); g.fillStyle = gg; g.beginPath(); g.roundRect(x - 4, y - 28, 8, 30, 3); g.fill(); g.fillStyle = "#e0a868"; g.beginPath(); g.ellipse(x, y - 28, 4, 2, 0, 0, 7); g.fill(); };
  const rail = (g, xa, ya, xb, yb) => { g.strokeStyle = "#7a5230"; g.lineWidth = 5; g.beginPath(); g.moveTo(xa, ya - 19); g.lineTo(xb, yb - 19); g.moveTo(xa, ya - 9); g.lineTo(xb, yb - 9); g.stroke(); g.strokeStyle = "#d39a5c"; g.lineWidth = 2.5; g.stroke(); };
  // The back rail sits behind everything on the field; the side rails (one item per post) and the front rail
  // are depth-sorted with animals, so a dog in front of the fence is drawn in front of it, never under it.
  const FR = { x0: OX - 36, x1: OX + FW + 36, y0: OY - 32, y1: OY + FH + 30 };
  function drawFence(g) { rail(g, FR.x0, FR.y0, FR.x1, FR.y0); for (let x = FR.x0; x <= FR.x1; x += 46) post(g, x, FR.y0); }
  function fenceItems(items) {
    for (let y = FR.y0; y < FR.y1; y += 46) { const yb = Math.min(FR.y1, y + 46); for (const x of [FR.x0, FR.x1]) items.push({ y: yb - 1, d: () => { rail(ctx, x, y, x, yb); post(ctx, x, yb); } }); }
    items.push({ y: FR.y1, d: () => drawFrontFence(ctx) });
  }
  function drawFrontFence(g) {
    const x0 = OX - 36, x1 = OX + FW + 36, y1 = OY + FH + 30, gap0 = FCX - 42, gap1 = FCX + 42;
    rail(g, x0, y1, gap0, y1); rail(g, gap1, y1, x1, y1);
    for (let x = x0; x <= gap0; x += 46) post(g, x, y1); post(g, gap0, y1); for (let x = gap1; x <= x1; x += 46) post(g, x, y1); post(g, x1, y1);
  }
  function drawPastureFence(g, back) {
    const { x0, x1, y0, y1 } = PAST;
    if (back) { rail(g, x0, y0, x1, y0); for (let x = x0; x <= x1; x += 41) post(g, x, y0); rail(g, x0, y0, x0, y1); rail(g, x1, y0, x1, y1); for (let y = y0 + 42; y < y1; y += 42) { post(g, x0, y); post(g, x1, y); } }
    else { rail(g, x0, y1, x1, y1); for (let x = x0; x <= x1; x += 41) post(g, x, y1); }
  }

  /* ---------- geometry ---------- */
  const plotRect = i => { const c = i % COLS, r = Math.floor(i / COLS); return { x: OX + c * (PW + GAP), y: OY + r * (PH + GAP), w: PW, h: PH, c, r }; };
  function plotAt(wx, wy) { for (let i = F.plots.length - 1; i >= 0; i--) { const p = plotRect(i); if (wx >= p.x && wx <= p.x + p.w && wy >= p.y - 18 && wy <= p.y + p.h) return i; } return -1; }
  const toWorld = (cx, cy) => { const r = cv.getBoundingClientRect(), nx = (cx - r.left) / r.width * NW, ny = (cy - r.top) / r.height * NH, vx = (nx - OFX) / K, vy = (ny - OFY) / K; return { x: (vx - VW / 2) / Z + cam.x, y: (vy - VH / 2) / Z + cam.y, vx, vy }; };
  const toScreen = (wx, wy) => ({ x: ((wx - cam.x) * Z + VW / 2) * K + OFX, y: ((wy - cam.y) * Z + VH / 2) * K + OFY });
  function clampCam() { const hw = VW / 2 / Z, hh = VH / 2 / Z; cam.x = BW <= hw * 2 ? (WX0 + WX1) / 2 : Math.max(WX0 + hw, Math.min(WX1 - hw, cam.x)); cam.y = BH <= hh * 2 ? (WY0 + WY1) / 2 : Math.max(WY0 + hh, Math.min(WY1 - hh, cam.y)); }
  function zoomAt(f, vx = VW / 2, vy = VH / 2) { const wx = (vx - VW / 2) / Z + cam.x, wy = (vy - VH / 2) / Z + cam.y; Z = Math.max(ZMIN, Math.min(ZMAX, Z * f)); cam.x = wx - (vx - VW / 2) / Z; cam.y = wy - (vy - VH / 2) / Z; clampCam(); $("fm-tip").hidden = true; $("fm-pop").hidden = true; }
  const area = (i, size) => { const { c, r } = plotRect(i), out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (size === 1 && (dr || dc)) continue; if (size === 2 && dr) continue; const cc = c + dc, rr = r + dr; if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS) out.push(rr * COLS + cc); } return out; };

  /* ---------- floating fx ---------- */
  const FX = [];
  const fly = (wx, wy, img, label) => FX.push({ fly: 1, x: wx, y: wy, img, label, t: 0, life: .9 });
  const float = (wx, wy, text, color = "#ffd65b") => FX.push({ text, x: wx, y: wy, t: 0, life: 1.2, color });
  function log(html, kind = "") { F.log.unshift({ html, kind }); const box = $("fm-log"), d = document.createElement("div"); d.className = kind; d.innerHTML = html; box.prepend(d); while (box.children.length > 3) box.lastChild.remove(); setTimeout(() => d.classList.add("out"), 6000); setTimeout(() => d.remove(), 6800); }

  /* ---------- core actions ---------- */
  function gainXP(n, wx, wy) {
    n = Math.round(n * (1 + xpBonus() / 100)); F.xp += n; if (wx != null) float(wx, wy - 30, `+${n} XP`, "#7ff0a2");
    while (F.lv < MAX_LV && F.xp >= need(F.lv)) { F.xp -= need(F.lv); F.lv++; levelUp(); }
    if (F.lv >= MAX_LV) F.xp = 0;
    renderBadge();
  }
  function levelUp() {
    const unl = CROPS.filter(c => c.lv === F.lv), reward = 40 + F.lv * 10; ECON.leaves += reward; updateWallet();
    const tools = [...FARM_UNLOCKS.filter(([l]) => l === F.lv).map(([, n]) => n), ...Object.values(DOGS).filter(d => d.lv === F.lv).map(d => `Guard dog: ${d.n}`)];
    // milestone packs: every 5 levels fertilizer, every 10 a Gold Fertilizer, 25/50/75/100 a title
    const packs = [];
    if (F.lv % 5 === 0) { F.ferts.norm += 3; F.ferts.super += 1; packs.push("Fertilizer ×3 + Super ×1"); }
    if (F.lv % 10 === 0) { F.ferts.gold += 1; packs.push("Gold Fertilizer"); }
    if (F.lv % 25 === 0) packs.push(`Title: ${{ 25: "Green Thumb", 50: "Master Grower", 75: "Harvest Legend", 100: "Elemental Farmer" }[F.lv]}`);
    tools.push(...packs);
    const deco = DECOR.filter(d => d.lv === F.lv).map(d => d.n);
    const m = $("fm-modal"); m.hidden = false;
    m.innerHTML = `<div class="lvcard"><div class="rays"></div><div class="big">${F.lv}</div><h5>Farm level up!</h5><div class="unl">${unl.map(c => `<span><img src="${icon(c.id)}" alt="">${c.n}</span>`).join("")}${[...tools, ...deco].map(n => `<span>${I("lock")} ${n}</span>`).join("")}<span>${L} +${reward}</span>${LAND_LV.includes(F.lv) ? `<span>${I("sign")} More land for sale</span>` : ""}</div>${F.lv >= MAX_LV ? `<p class="lv-max">Max farm level! Crop Mastery keeps going.</p>` : ""}<button type="button" data-lvok>Awesome!</button></div>`;
    m.querySelector("[data-lvok]").onclick = () => { m.hidden = true; };
    log(`Level <b>${F.lv}</b>! Unlocked ${unl.map(c => c.n).join(", ") || "new items"}`, "good");
  }
  function rollMut(p) {
    const w = F.weather.cur, mut = [];
    let gold = .03 * (p.fert === "gold" ? 3 : 1) * (F.dog.type === "cream" && dogOn() ? 1.5 : 1) * (w === "rainbow" ? 3 : 1), rb = .005 * (w === "rainbow" ? 10 : 1);
    const r = Math.random(); if (r < rb) mut.push("rainbow"); else if (r < rb + gold) mut.push("gold");
    const wm = { storm: ["shock", .25], moon: ["moon", .25], frost: ["frost", .25], rain: ["wet", .3] }[w];
    if (wm && Math.random() < wm[1]) mut.push(wm[0]);
    p.mut = mut;
    if (mut.length) { const r = plotRect(F.plots.indexOf(p)); float(r.x + PW / 2, r.y, mut.map(m => MUTS[m].n).join(" + ") + "!", mut.includes("rainbow") ? "#ff9bd2" : "#ffe27a"); if (mut.includes("gold") || mut.includes("rainbow")) log(`<b>${mut.map(m => MUTS[m].n).join(" + ")}</b> mutation on ${CROP[p.crop].n}!`, "good"); }
  }
  const mutX = mut => mut.reduce((a, m) => a * MUTS[m].x, 1);
  function harvest(i, silent) {
    const p = F.plots[i]; if (!p.crop || p.prog < 1) return false;
    const c = CROP[p.crop], n = 2 + (gardener() === "terradon" ? 1 : 0);
    if (barnUsed() + n > F.barnCap) { if (!silent) toast("Barn is full! Sell something or upgrade the barn."); return false; }
    const key = p.mut.length ? p.mut.slice().sort().join("+") : "";
    addBarn(c.id, key, n); F.harv[c.id] = (F.harv[c.id] || 0) + 1; (F.seen[c.id] ||= new Set()).add(key); p.mut.forEach(m => F.seen[c.id].add(m));
    const r = plotRect(i); fly(r.x + PW / 2, r.y + 10, icon(c.id), `+${n}`); gainXP(c.xp, r.x + PW / 2, r.y);
    Object.assign(p, mkPlot()); if (F.sprinklers[r.r]) p.wet = true;
    if (dragging) { combo.n++; combo.x = r.x + PW / 2; combo.y = r.y; if (combo.n >= 3) float(r.x + PW / 2, r.y - 26, `Combo ×${combo.n}!`, "#ff9bd2"); }
    return true;
  }
  function plant(i, id) {
    const p = F.plots[i]; if (p.locked || p.crop) return false;
    if (!F.seeds[id]) { toast(`Out of ${CROP[id].n} seeds. Buy more in the Shop.`); return false; }
    F.seeds[id]--; Object.assign(p, mkPlot({ crop: id, wet: F.sprinklers[plotRect(i).r] || F.weather.cur === "rain" }));
    const r = plotRect(i); FX.push({ puff: 1, x: r.x + PW / 2, y: r.y + PH / 2, t: 0, life: .5 }); return true;
  }
  function useTool(i, drag = false) {
    const s = cur(), p = s.plots[i]; if (!p) return;
    if (!s.me) return visitAct(i, drag);
    if (p.locked) { if (!drag) landClick(i); return; }
    const r = plotRect(i), cx = r.x + PW / 2;
    if (p.crow) { shoo(p); return; }
    switch (F.tool) {
      case "hand":
        if (p.pests) { catchPest(i); break; }
        if (p.crop && p.prog >= 1) { harvest(i); break; }
        if (!p.crop && !drag) seedPop(i);
        break;
      case "seed": if (!p.crop) plant(i, F.seed); else if (p.prog >= 1) harvest(i); break;
      case "can": for (const j of area(i, F.can)) { const q = F.plots[j]; if (q.crop && q.prog < 1 && !q.wet) { q.wet = true; const rr = plotRect(j); FX.push({ drops: 1, x: rr.x + PW / 2, y: rr.y + PH / 2, t: 0, life: .7 }); } } break;
      case "fert": {
        if (!p.crop || p.prog >= 1) break; const f = F.fert; if (!F.ferts[f]) { toast("Out of that fertilizer. Buy more in Shop → Tools."); break; } if (p.fert && f !== "super") { toast("This plot is already fertilized"); break; }
        F.ferts[f]--; if (f === "super") p.prog = Math.min(.999, p.prog + .5); else p.fert = f; float(cx, r.y, f === "gold" ? "Gold fertilizer!" : f === "super" ? "+50%" : "Fertilized", "#d8ff8a"); renderTools(); break;
      }
      case "net": for (const j of area(i, F.net === 2 ? 3 : 1)) if (F.plots[j].pests) catchPest(j); break;
      case "sickle": for (const j of area(i, 3)) harvest(j, true); break;
      case "shovel": if (!p.crop) break; if (F.shovelArm === i) { Object.assign(p, mkPlot()); F.shovelArm = null; float(cx, r.y, "Dug up", "#ff9b9b"); } else { F.shovelArm = i; toast("Click again to dig up this crop"); setTimeout(() => { if (F.shovelArm === i) F.shovelArm = null; }, 1800); } break;
    }
    renderChips(); renderTools();
  }
  function catchPest(i) {
    const p = F.plots[i]; if (!p.pests) return; p.pests--; const r = plotRect(i);
    FX.push({ poof: 1, x: r.x + PW / 2, y: r.y + PH / 2, t: 0, life: .5 }); gainXP(1, r.x + PW / 2, r.y);
    if (gardener() === "duskveil" && p.crop) { addBarn(p.crop, "", 1); float(r.x + PW / 2, r.y - 16, `+1 ${CROP[p.crop].n}`); }
  }
  function shoo(p) { p.crow.leave = true; const i = F.plots.indexOf(p), r = plotRect(i); float(r.x + PW / 2, r.y - 10, "Shoo!", "#fff"); }
  function seedPop(i) {
    const r = plotRect(i), sp = toScreen(r.x + PW / 2, r.y), pop = $("fm-pop"); pop.hidden = false; pop.classList.add("seedpick");
    const owned = CROPS.filter(c => F.seeds[c.id]), buy = CROPS.filter(c => !F.seeds[c.id] && c.lv <= F.lv && (F.shop.stock[c.id] ?? 0) > 0).slice(0, 4);
    const card = (c, have) => `<button type="button" class="opt sp r-${c.rar}${have ? "" : " spbuy"}" ${have ? `data-pseed="${c.id}"` : `data-pbuy="${c.id}"`} ${!have && ECON.leaves < c.cost ? "disabled" : ""} title="${c.n}"><b>${have ? `×${F.seeds[c.id]}` : `${c.cost}${L}`}</b><img src="${icon(c.id)}" alt=""><span>${c.n}</span><small>${I("clock")}${fmtReal(c.t)} · ${c.sell}${L}</small></button>`;
    pop.innerHTML = `<h6>What should grow here?</h6>${owned.length ? `<div class="grid">${owned.map(c => card(c, true)).join("")}</div>` : `<p class="sh-note" style="margin:2px 4px 6px">Your seed bag is empty.</p>`}${buy.length ? `<h6 style="margin-top:8px">Quick buy 1 seed</h6><div class="grid">${buy.map(c => card(c, false)).join("")}</div>` : ""}<p class="sh-note sp-tip">Tip: after picking a seed, <b>drag</b> across empty plots to sow them all.</p>`;
    const pw = 320; pop.style.width = `${pw}px`; pop.style.left = `${Math.max(8, Math.min(NW - pw - 8, sp.x - pw / 2))}px`;
    const top = sp.y - pop.offsetHeight - 14; pop.style.top = `${top < 60 ? Math.min(NH - pop.offsetHeight - 8, sp.y + PH * Z * K + 10) : top}px`;
    pop.onclick = e => {
      const b = e.target.closest("[data-pseed]"), q = e.target.closest("[data-pbuy]");
      if (q) { const c = CROP[q.dataset.pbuy]; ECON.leaves -= c.cost; F.shop.stock[c.id]--; F.seeds[c.id] = 1; updateWallet(); }
      const id = b?.dataset.pseed || q?.dataset.pbuy; if (!id) return;
      F.seed = id; F.tool = "seed"; plant(i, id); pop.hidden = true; pop.classList.remove("seedpick"); renderTools(); screen.focus({ preventScroll: true }); toast(`Planted ${CROP[id].n} · drag over empty plots to keep sowing`);
    };
  }

  /* ---------- visit mode ---------- */
  function visitAct(i, drag) {
    const f = FRIENDS[F.visiting], p = f.plots[i], r = plotRect(i), cx = r.x + PW / 2; if (!p || p.locked) return;
    const tool = F.tool;
    if (tool === "hand" || tool === "sickle" || tool === "seed") {
      if (p.pests) { p.pests--; FX.push({ poof: 1, x: cx, y: r.y + PH / 2, t: 0, life: .5 }); gainXP(3, cx, r.y); log(`Caught a bug for <b>${f.n}</b> +3 XP`, "good"); return; }
      if (p.crop && p.prog >= 1) {
        if (f.stolen.has(i)) { if (!drag) toast("You already snuck a crop from this plot"); return; }
        f.stolen.add(i);
        if (f.dog && f.dog.until > 0 && Math.random() < DOGS[f.dog.type].catch) { const fine = 20; ECON.leaves = Math.max(0, ECON.leaves - fine); updateWallet(); FX.push({ bark: 1, x: cx, y: r.y, t: 0, life: 1.2 }); log(`${f.n}'s <b>${DOGS[f.dog.type].n}</b> chased you off! −${fine} ${L}`, "bad"); toast(`Woof! ${DOGS[f.dog.type].n} caught you. You lost ${fine} Gold Leaves`); return; }
        const key = p.mut.length ? p.mut.slice().sort().join("+") : ""; addBarn(p.crop, key, 1); fly(cx, r.y + 10, icon(p.crop), "+1"); log(`Snuck 1 <b>${CROP[p.crop].n}</b> from ${f.n}'s farm`); return;
      }
      return;
    }
    if (tool === "can" && p.crop && p.prog < 1 && !p.wet) { p.wet = true; FX.push({ drops: 1, x: cx, y: r.y + PH / 2, t: 0, life: .7 }); gainXP(2, cx, r.y); return; }
    if (tool === "net" && p.pests) { p.pests--; FX.push({ poof: 1, x: cx, y: r.y + PH / 2, t: 0, life: .5 }); gainXP(3, cx, r.y); return; }
    if (tool === "prank") {
      if (!F.pranks) return toast("No pranks left today (3/3)");
      if (!p.crop || p.prog >= 1) return toast("Bugs only go on growing crops");
      p.pests = Math.min(3, p.pests + 1); F.pranks--; FX.push({ poof: 1, x: cx, y: r.y + PH / 2, t: 0, life: .5 }); log(`Dropped a Gloomling on <b>${f.n}</b>'s farm (${F.pranks}/3 left)`); renderTools(); return;
    }
  }
  function visit(i) { F.visiting = i; F.tool = "hand"; closeSheet(); renderAll(); const f = FRIENDS[i]; log(`Visiting <b>${f.n}</b>'s farm`); }
  function goHome() { F.visiting = null; F.tool = "hand"; renderAll(); }

  /* ---------- simulation ---------- */
  let crowT = 8, friendT = 25;
  let GT = 0; // farm clock in units
  // The farm clock follows the wall clock, not the frame rate: slow phones, hidden tabs and dropped frames never slow the crops.
  let lastWall = Date.now();
  function tick(rdt) {
    const nowW = Date.now(); let wdt = (nowW - lastWall) / 1000; lastWall = nowW; if (!(wdt > 0)) wdt = 0; wdt = Math.min(wdt, 7 * 86400);
    const dt = wdt * TSCALE; GT += dt;
    if (F.pasture && COW.milk > 0) COW.milk -= dt;
    F.orders.forEach((o, i) => { if (o.wait > 0) { o.wait -= dt; if (o.wait <= 0) { F.orders[i] = newOrder(); if (sheet === "orders") renderSheet(); } } });
    // weather
    F.weather.until -= dt;
    if (F.weather.until <= 0) { F.weather.cur = F.weather.next; F.weather.next = F.weather.next2; F.weather.next2 = wpick(); F.weather.until = FAST ? 60 : untilClock(W_HOURS); const w = WEATHERS[F.weather.cur]; log(`Weather changed: <b>${I(w.ic)} ${w.n}</b> · ${w.d}`); if (F.weather.cur === "rain") F.plots.forEach(p => { if (p.crop && p.prog < 1) p.wet = true; }); }
    if (F.weather.cur === "storm" && Math.random() < rdt * .3) { FX.push({ bolt: 1, x: cam.x - 500 + Math.random() * 1000, t: 0, life: .45 }); WX.flash = 1; }
    WX.flash = Math.max(0, WX.flash - rdt * 2.6);
    // shop & market & dog
    F.shop.at -= dt; if (F.shop.at <= 0) { restock(); log("The seed shop just <b>restocked</b>"); if (sheet === "shop") renderSheet(); }
    F.market.until -= dt; if (F.market.until <= 0) { newMarket(); F.wish = true; F.pranks = 3; F.gifts = 1; F.coinsToday = 0; log(`New market day: <b>${CROP[F.market.hot].n}</b> sells at ×${F.market.mult[F.market.hot].m.toFixed(2)}`); }
    if (dogOn()) { F.dog.until -= dt; F.dug += dt; const per = DAY / Math.max(1, DOGS[F.dog.type].dig || .0001); if (DOGS[F.dog.type].dig && F.dug > per * .25) { F.dug = 0; dogDig(); } if (F.dog.until <= 0) { F.dog.until = 0; log(`<b>${DOGS[F.dog.type].n}</b> finished guarding and went home`, "bad"); renderChips(); } }
    FRIENDS.forEach(f => { if (f.dog && f.dog.until > 0) f.dog.until -= dt; f.plots.forEach(p => { if (p.crop && p.prog < 1) p.prog = Math.min(1, p.prog + dt / CROP[p.crop].t * .8); }); });
    // growth
    const wmul = { sun: 1.1, frost: .85 }[F.weather.cur] ?? 1;
    F.plots.forEach((p, i) => {
      if (!p.crop || p.prog >= 1) return;
      let rate = 1 / CROP[p.crop].t * wmul; if (p.wet) rate *= 1.35; if (p.fert === "norm" || p.fert === "gold") rate *= 1.4; rate *= 1 - .2 * p.pests; if (gardener() === "lumoth") rate *= 1.2;
      p.prog = Math.min(1, p.prog + rate * dt);
      if (p.prog >= 1) rollMut(p);
      let pest = .012 * (F.scarecrow ? .5 : 1) * (dogOn() && F.dog.type === "black" ? .7 : 1); if (GT < F.warmUntil) pest = 0;
      if (p.pests < 2 && Math.random() < dt * pest) p.pests++;
    });
    // crows (Stardew-style): land on ripe crops unless scarecrow/dog
    crowT -= dt;
    if (crowT <= 0) { crowT = 14 + Math.random() * 14; const ripe = F.plots.filter(p => p.crop && p.prog >= 1 && !p.crow); if (ripe.length && !F.scarecrow) { const p = pick(ripe); p.crow = { t: 0, x: -60, y: 120, land: false }; log("A <b>crow</b> landed on your field! Click it to shoo it away", "bad"); } }
    F.plots.forEach((p, i) => {
      const c = p.crow; if (!c) return; const r = plotRect(i), tx = r.x + PW / 2, ty = r.y + 20;
      if (c.leave) { c.x += 360 * rdt; c.y -= 200 * rdt; if (c.y < -80) p.crow = null; return; }
      if (!c.land) { const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy); if (d < 8) c.land = true; else { c.x += dx / d * 300 * rdt; c.y += dy / d * 300 * rdt; } return; }
      if (dogOn() && !c.barked) { c.barked = true; dog.barkT = 1.2; FX.push({ bark: 1, follow: 1, x: dog.x, y: dog.y - 40, t: 0, life: 1.4 }); dog.chase = i; setTimeout(() => { if (p.crow) p.crow.leave = true; }, 700); return; }
      c.t += rdt; if (c.t > 5) { log(`A crow ate your <b>${CROP[p.crop].n}</b>! Get a Scarecrow or hire a dog`, "bad"); Object.assign(p, mkPlot()); }
    });
    // friends visiting you
    friendT -= dt;
    if (friendT <= 0 && F.visiting == null) {
      friendT = 30 + Math.random() * 25; const f = pick(FRIENDS), roll = Math.random();
      if (roll < .45) { const g = F.plots.filter(p => p.crop && p.prog < 1 && !p.wet); g.slice(0, 2).forEach(p => p.wet = true); if (g.length) log(`<b>${f.n}</b> watered ${Math.min(2, g.length)} plots for you`, "good"); }
      else if (roll < .7) { const g = F.plots.filter(p => p.pests); if (g.length) { g[0].pests--; log(`<b>${f.n}</b> caught a bug for you`, "good"); } }
      else { const ripe = F.plots.filter(p => p.crop && p.prog >= 1); if (ripe.length) { if (dogOn() && Math.random() < DOGS[F.dog.type].catch) { ECON.leaves += 20; updateWallet(); FX.push({ bark: 1, follow: 1, x: dog.x, y: dog.y - 40, t: 0, life: 1.4 }); log(`<b>${DOGS[F.dog.type].n}</b> caught ${f.n} sneaking crops! +20 ${L} fine`, "good"); } else { const p = pick(ripe); log(`<b>${f.n}</b> snuck 1 <b>${CROP[p.crop].n}</b> from you${dogOn() ? "" : " · hire a dog to guard"}`, "bad"); } } }
    }
    FRIENDS.forEach((f, i) => { if (Math.random() < dt * .01) { const g = f.plots.filter(p => p.crop && p.prog < 1); if (g.length && g[0].pests < 2) g[0].pests++; } });
  }
  function dogDig() {
    const r = Math.random(); let msg;
    if (r < .5) { const c = pick(CROPS.filter(c => c.lv <= F.lv + 2)); F.seeds[c.id] = (F.seeds[c.id] || 0) + 2; msg = `2 ${c.n} seeds`; }
    else if (r < .8) { const n = 15 + Math.floor(Math.random() * 30); ECON.leaves += n; updateWallet(); msg = `${n} ${L}`; }
    else { F.ferts.super++; msg = "1 Super Fertilizer"; }
    FX.push({ bark: 1, follow: 1, x: dog.x, y: dog.y - 40, t: 0, life: 1.2, text: "Woof!" }); dog.barkT = 1; log(`<b>${DOGS[F.dog.type].n}</b> dug up ${msg}!`, "good");
  }

  /* ---------- draw ---------- */
  const dog = { x: 1500, y: 820, tx: null, ty: null, wait: 0, face: -1, chase: null, barkT: 0, path: [] };
  // where animals may not stand or walk: the fenced field, the pasture, the pond, the well, the doghouse and placed decor
  const GATE = () => ({ out: [FCX, FR.y1 + 30], inn: [FCX, FR.y1 - 16] });
  const inField = (x, y, m = 0) => x > FR.x0 - 10 - m && x < FR.x1 + 10 + m && y > FR.y0 - 30 - m && y < FR.y1 + 14 + m;
  // m: extra margin in px; route planning uses a few px so a straight leg never shaves a corner between samples
  function blocked(x, y, inside, m = 0) {
    if (!inside && inField(x, y, m)) return true;
    if (x > PAST.x0 - 30 - m && x < PAST.x1 + 30 + m && y > PAST.y0 - 30 - m && y < PAST.y1 + 18 + m) return true;
    if (((x - POND.x) / (POND.rx + 30 + m)) ** 2 + ((y - POND.y) / (POND.ry + 22 + m)) ** 2 < 1) return true;
    if (Math.abs(x - WELL.x) < 52 + m && y > WELL.y - 30 - m && y < WELL.y + 16 + m) return true;
    if (Math.abs(x - DOGH.x) < 58 + m && y > DOGH.y - 34 - m && y < DOGH.y + 16 + m) return true;
    if (F.scarecrow && Math.abs(x - 288) < 26 + m && Math.abs(y - 562) < 16 + m) return true;
    return F.decor.some((d, k) => d && Math.abs(x - DECO_SLOTS[k][0]) < 42 + m && y > DECO_SLOTS[k][1] - 22 - m && y < DECO_SLOTS[k][1] + 12 + m);
  }
  const clearLine = (a, b, inside) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3); for (let k = 1; k <= n; k++) if (blocked(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, inside, 4)) return false; return true; };
  // Outside the field the dog finds its way around the pond, well, kennel, pasture and decorations:
  // A* on a 40 px grid of free spots, then the path is straightened wherever the way is clear.
  const STEP = 40;
  function walkPath(a, b, m = 4) {
    const line = (p, q, mm = m) => { const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (mm ? 3 : 2)); for (let k = 1; k <= n; k++) if (blocked(p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n, false, mm)) return false; return true; };
    if (line(a, b)) return [b];
    const cols = Math.ceil(WW / STEP) + 1, rows = Math.ceil(WH / STEP) + 1, id = (c, r) => r * cols + c, pt = n => [(n % cols) * STEP, Math.floor(n / cols) * STEP];
    const free = new Uint8Array(cols * rows); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) free[id(c, r)] = blocked(c * STEP, r * STEP, false, m) ? 0 : 1;
    const near = (p, mm) => { const out = []; const c0 = Math.round(p[0] / STEP), r0 = Math.round(p[1] / STEP); for (let r = r0 - 2; r <= r0 + 2; r++) for (let c = c0 - 2; c <= c0 + 2; c++) if (c >= 0 && r >= 0 && c < cols && r < rows && free[id(c, r)] && line(p, pt(id(c, r)), mm)) out.push(id(c, r)); return out; };
    const ends = p => { const t = near(p, m); return t.length ? t : near(p, 0); }; // a point inside the safety margin connects without it
    const starts = ends(a), goals = new Set(ends(b));
    const gS = new Map(), prev = new Map(), open = [], h = n => { const q = pt(n); return Math.hypot(q[0] - b[0], q[1] - b[1]); };
    starts.forEach(n => { const q = pt(n), d = Math.hypot(q[0] - a[0], q[1] - a[1]); gS.set(n, d); open.push([d + h(n), n]); });
    let end = -1;
    while (open.length && goals.size) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i; const [, n] = open.splice(bi, 1)[0];
      if (goals.has(n)) { end = n; break; }
      const c = n % cols, r = Math.floor(n / cols);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue; const mm = id(cc, rr); if (!free[mm] || (dr && dc && (!free[id(c + dc, r)] || !free[id(c, r + dr)])) || !line(pt(n), pt(mm))) continue; const gN = gS.get(n) + (dr && dc ? 1.414 : 1) * STEP; if (gN < (gS.get(mm) ?? Infinity)) { gS.set(mm, gN); prev.set(mm, n); open.push([gN + h(mm), mm]); } }
    }
    if (end < 0) return m ? walkPath(a, b, 0) : [b]; // a tight squeeze: try again hugging the obstacles
    const pts = []; for (let n = end; n != null; n = prev.get(n)) pts.unshift(pt(n)); pts.push(b);
    const out = []; let cur = a, i = 0; // straighten: jump to the farthest point we can walk to in a straight line
    while (i < pts.length) { let j = pts.length - 1; while (j > i && !line(cur, pts[j])) j--; out.push(pts[j]); cur = pts[j]; i = j + 1; }
    return out;
  }
  function dogRoute(tx, ty, inside) {
    const g = GATE(), here = inField(dog.x, dog.y), path = [];
    let from = [dog.x, dog.y];
    if (!here && blocked(dog.x, dog.y, false)) { from = [DOGH.x - 80, DOGH.y + 34]; path.push(from); } // stepping out of the kennel
    if (here && !inside) { path.push([dog.x, g.inn[1]], g.inn, g.out); path.push(...walkPath(g.out, [tx, ty])); }
    else if (!here && inside) { path.push(...walkPath(from, g.out), g.inn, [tx, g.inn[1]], [tx, ty]); }
    else if (!here) path.push(...walkPath(from, [tx, ty]));
    else path.push([tx, ty]);
    dog.path = path; dog.tx = tx; dog.ty = ty;
  }
  function dogIdleSpot() {
    const spots = [[1520, 860], [1400, 830], [1100, 840], [700, 845], [460, 830], [250, 780], [FCX + 90, 860], [1440, 760], [900, 960], [620, 940]];
    for (let t = 0; t < 12; t++) { const [x, y] = pick(spots); if (!blocked(x, y, false)) return [x, y]; }
    return [DOGH.x - 80, DOGH.y + 34];
  }
  const hens = [{ k: "white", x: 120, y: 800, face: 1, tx: null, ty: null, wait: 1, st: "idle" }, { k: "brown", x: 230, y: 840, face: -1, tx: null, ty: null, wait: 2, st: "idle" }, { k: "white", x: 70, y: 880, face: 1, tx: null, ty: null, wait: 3, st: "idle" }, { k: "brown", x: 480, y: 960, face: 1, tx: null, ty: null, wait: 2, st: "idle" }];
  const BREED = { gold: "gold", black: "black", cream: "cream" };
  const BUTTER = [0, 1, 2, 3].map(i => ({ hx: [230, 640, 1300, 1600][i], hy: [600, 300, 860, 720][i], ph: i * 1.7, c: ["#ffd65b", "#ffb3d1", "#bfe3ff", "#ffffff"][i] }));
  const FSMOKE = [];
  // Name tags for places on the farm: dark pill, cream capitals, same size on screen at any zoom.
  function nameTag(g, t, x, y, accent) {
    const z = 1 / Math.max(.6, Z), fs = 19 * z; g.save(); g.font = `800 ${fs}px 'Barlow Condensed', sans-serif`; g.letterSpacing = `${fs * .05}px`;
    const m = g.measureText(t), w = m.width + 22 * z, h = 28 * z;
    g.fillStyle = "rgba(16,12,34,.84)"; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill();
    g.strokeStyle = accent || "rgba(255,236,190,.45)"; g.lineWidth = 1.6 * z; g.stroke();
    g.fillStyle = "#fff4d6"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillText(t, x + fs * .025, y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    g.restore();
  }
  function drawDoghouse(g, x, y, on) {
    GFX.shadow(g, x + 10, y + 2, 76, 14); GFX.blit(g, GFX.doghouse(), x, y);
    const t = on ? DOGS[on.type].n.toUpperCase() : "EMPTY KENNEL"; nameTag(g, t, x, y - 116, on ? "#ffd65b" : null);
  }
  function drawDecor(g, id, x, y, time) {
    const d = DECO[id], sh = (rx) => GFX.shadow(g, x + 6, y + 2, rx, rx * .25);
    if (id === "planter") { sh(54); GFX.blit(g, GFX.flowerbed(96, 21), x, y + 6); }
    else if (id === "lamp") { sh(16); GFX.blit(g, GFX.lamp(), x, y + 4); }
    else if (id === "bush6") { sh(36); GFX.blit(g, GFX.bush("rose", 22), x, y + 4); }
    else if (id === "bush7") { sh(36); GFX.blit(g, GFX.bush("green", 23), x, y + 4); }
    else if (id === "rock") { sh(24); GFX.blit(g, GFX.rock(24, 44), x, y + 4); }
    else if (id === "crates") { sh(46); GFX.blit(g, GFX.crates(), x, y + 4); }
    else if (id === "pine") GFX.drawTree(g, GFX.tree("pine", 25, .8), x, y, time, x * .01, .7);
    else if (id === "apple") GFX.drawTree(g, GFX.tree("apple", 26, .7), x, y, time, x * .01, .7);
    else if (id === "tower") { sh(60); GFX.blit(g, GFX.gazebo(), x, y + 4); }
    else if (id === "plum") { sh(70); GFX.blit(g, GFX.house({ wall: "#f0e4ff", roof: "#8a4ad0", w: 100, hgt: 70, roofH: 50, windows: 1, chimney: false, flowers: true, shutters: "#ffffff", sd: 31, depth: 20 }), x, y + 4, .85); }
    else if (id === "statue") { sh(40); GFX.blit(g, GFX.plinth(), x, y + 4); if (!statueImg) { statueImg = new Image(); statueImg.src = svgUrl(ART["voltkit:base"]); } if (statueImg.complete) { if (!statueGold) statueGold = tintCanvas(statueImg, null, "#ffc93a", .62); g.drawImage(statueGold, x - 34, y - 122, 68, 69); } }
  }
  let statueImg = null, statueGold = null;
  function drawLockedPlot(g, i, s) {
    const r = plotRect(i), cx = r.x + r.w / 2, me = s.me, can = me && touching(s.plots, i);
    g.globalAlpha = can ? 1 : .55;
    g.fillStyle = "rgba(20,50,20,.3)"; g.beginPath(); g.roundRect(r.x + 2, r.y + 5, r.w, r.h, 12); g.fill();
    g.fillStyle = "#7cc45e"; g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 12); g.fill();
    GFX.srand(i * 13 + 5); for (let k = 0; k < 9; k++) { const x = r.x + 8 + GFX.rnd() * (r.w - 16), y = r.y + 10 + GFX.rnd() * (r.h - 14); g.strokeStyle = k % 2 ? "#4f9a3c" : "#a6e07e"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x - 5, y - 9); g.moveTo(x, y); g.lineTo(x, y - 12); g.moveTo(x + 3, y); g.lineTo(x + 6, y - 8); g.stroke(); }
    if (i % 3 === 0) GFX.blit(g, GFX.rock(i + 40, 22), r.x + r.w * .3, r.y + r.h * .8);
    g.globalAlpha = 1;
    if (me && hoverI === i && can) { g.strokeStyle = "#ffd65b"; g.lineWidth = 3; g.beginPath(); g.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 14); g.stroke(); }
    if (can) {
      const k = F.land, ok = F.lv >= landLv(k);
      g.fillStyle = "#6b4527"; g.fillRect(cx - 2, r.y + 18, 4, 30);
      g.save(); g.translate(cx, r.y + 16); g.rotate(-.05); g.fillStyle = ok ? "#c0392b" : "#6b7280"; g.beginPath(); g.roundRect(-34, -14, 68, 28, 6); g.fill(); g.strokeStyle = "#3a1410"; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = "#fff4d6"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "800 11px 'Barlow Condensed', sans-serif"; g.fillText("FOR SALE", 0, -5); g.textBaseline = "alphabetic"; g.font = "800 11px 'DM Sans', sans-serif"; if (ok) textWithIcon(g, String(landPrice(k)), "leaf", 0, 7, 11); else { g.textBaseline = "middle"; g.fillText(`Lv ${landLv(k)}`, 0, 7); g.textBaseline = "alphabetic"; } g.restore();
    }
  }
  function drawPlot(g, i, p, time, s) {
    const r = plotRect(i), cx = r.x + r.w / 2;
    if (p.locked) { drawLockedPlot(g, i, s); return; }
    const sg = g.createLinearGradient(0, r.y, 0, r.y + r.h); sg.addColorStop(0, p.wet ? "#4a301c" : "#8a5e36"); sg.addColorStop(1, p.wet ? "#3a2412" : "#6b4527");
    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.roundRect(r.x + 2, r.y + 5, r.w, r.h, 12); g.fill();
    g.fillStyle = sg; g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 12); g.fill();
    g.strokeStyle = p.wet ? "rgba(140,200,255,.25)" : "rgba(255,220,170,.22)"; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(r.x + 10, r.y + k * r.h / 4); g.lineTo(r.x + r.w - 10, r.y + k * r.h / 4); g.stroke(); }
    if (p.wet) { g.fillStyle = "rgba(160,215,255,.18)"; g.beginPath(); g.ellipse(cx - 18, r.y + 18, 22, 7, -.2, 0, 7); g.fill(); }
    if (p.fert) { g.fillStyle = p.fert === "gold" ? "rgba(255,210,80,.6)" : "rgba(200,255,140,.5)"; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(r.x + 16 + k * 14, r.y + r.h - 10 - (k % 2) * 6, 2.2, 0, 7); g.fill(); } }
    if (s.me && hoverI === i) { g.strokeStyle = "#ffd65b"; g.lineWidth = 3; g.beginPath(); g.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 14); g.stroke(); }
    if (!s.me && s.stolen?.has(i)) { g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 12); g.fill(); }
  }
  function drawPlotCrop(g, i, p, time) {
    if (p.locked || !p.crop) return;
    const r = plotRect(i), cx = r.x + r.w / 2, base = r.y + r.h * .72;
    const st = p.prog >= 1 ? 4 : p.prog > .66 ? 3 : p.prog > .33 ? 2 : p.prog > .05 ? 1 : 0;
    const mut = p.prog >= 1 ? (p.mut.includes("rainbow") ? "rainbow" : p.mut.includes("gold") ? "gold" : p.mut[0]) : null;
    const im = cropImage(p.crop, st, mut, time), w = 90, h = 105, sway = st >= 2 ? Math.sin(time * 1.6 + i) * .03 : 0;
    if (im && (im.complete ?? true)) { g.save(); g.translate(cx, base + 6); g.rotate(sway); if (st === 4) { const ph = (time * .55 + i * .37) % 3.2, hop = ph < .5 ? Math.sin(ph / .5 * Math.PI) : 0, b = 1 + Math.sin(time * 3 + i) * .015; g.scale(b * (1 + hop * .05), b * (1 - hop * .06)); } g.drawImage(im, -w / 2, -h * 132 / 140, w, h); g.restore(); }
    if (st === 4) {
      if (mut === "gold" || mut === "rainbow") for (let k = 0; k < 3; k++) { const a = time * 2 + k * 2.1 + i; g.fillStyle = "#fff"; g.globalAlpha = .5 + .5 * Math.sin(a * 2); g.beginPath(); g.arc(cx + Math.cos(a) * 30, base - 40 + Math.sin(a) * 18, 2.5, 0, 7); g.fill(); g.globalAlpha = 1; }
      if (p.mut.includes("shock")) { g.strokeStyle = `rgba(200,230,255,${.5 + .5 * Math.sin(time * 20 + i)})`; g.lineWidth = 2; g.beginPath(); let x = cx - 26, y = base - 70; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += 10; y += (k % 2 ? -8 : 8); g.lineTo(x, y); } g.stroke(); }
      if (p.mut.includes("moon")) { const gr = g.createRadialGradient(cx, base - 40, 4, cx, base - 40, 50); gr.addColorStop(0, "rgba(200,170,255,.35)"); gr.addColorStop(1, "rgba(200,170,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(cx, base - 40, 50, 0, 7); g.fill(); }
      if (p.mut.includes("frost")) { g.fillStyle = "#fff"; const sn = ICON_IMG("snow"); for (let k = 0; k < 4; k++) if (sn.complete) g.drawImage(sn, cx - 36 + k * 20, base - 72 + (k % 2) * 14, 12, 12); }
    }
    for (let k = 0; k < p.pests; k++) { const px = cx - 26 + k * 34, py = base - 10 + Math.sin(time * 6 + k + i) * 3; g.fillStyle = "#2a1f4a"; g.beginPath(); g.ellipse(px, py + 2, 12, 9, 0, 0, 7); g.fill(); g.fillStyle = "#5b45a8"; g.beginPath(); g.ellipse(px, py - 1, 11, 9, 0, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(px - 4, py - 3, 3, 0, 7); g.arc(px + 4, py - 3, 3, 0, 7); g.fill(); g.fillStyle = "#111"; g.beginPath(); g.arc(px - 3.5, py - 2.5, 1.4, 0, 7); g.arc(px + 4.5, py - 2.5, 1.4, 0, 7); g.fill(); g.strokeStyle = "#5b45a8"; g.lineWidth = 2; g.beginPath(); g.moveTo(px - 4, py - 8); g.lineTo(px - 7, py - 14); g.moveTo(px + 4, py - 8); g.lineTo(px + 7, py - 14); g.stroke(); }
    if (p.prog < 1 && p.prog > 0) { g.fillStyle = "rgba(0,0,0,.4)"; g.beginPath(); g.roundRect(r.x + 14, r.y + r.h - 8, r.w - 28, 5, 3); g.fill(); g.fillStyle = p.wet ? "#7fd4ff" : "#7ff0a2"; g.beginPath(); g.roundRect(r.x + 14, r.y + r.h - 8, (r.w - 28) * p.prog, 5, 3); g.fill(); }
  }
  // Weather you can see at a glance: layered rain with splashes, real lightning flashes,
  // drifting snow, a starry night with fireflies, a bright rainbow, warm sun rays.
  const WX = { flash: 0 };
  function drawWeather(g, time) {
    const w = F.weather.cur;
    if (w === "rain" || w === "storm") {
      const heavy = w === "storm";
      g.fillStyle = heavy ? "rgba(14,22,50,.36)" : "rgba(26,46,96,.24)"; g.fillRect(0, 0, VW, VH);
      g.lineCap = "round";
      for (const [n, len, sp, lw, a] of [[heavy ? 240 : 170, 15, 760, 1.3, .38], [heavy ? 160 : 110, 28, 1180, 2.3, .72]]) {
        g.strokeStyle = `rgba(205,228,255,${a})`; g.lineWidth = lw; g.beginPath();
        for (let k = 0; k < n; k++) { const x = ((k * 97.3 + time * sp * .32) % (VW + 220)) - 110, y = ((k * 53.7 + time * sp) % (VH + 60)) - 30; g.moveTo(x, y); g.lineTo(x - len * .32, y + len); }
        g.stroke();
      }
      g.strokeStyle = "rgba(215,238,255,.75)"; g.lineWidth = 1.4;
      for (let k = 0; k < (heavy ? 54 : 40); k++) { const c = time * 2.4 + k * .37, ph = c % 1, cyc = Math.floor(c), x = (k * 211.7 + cyc * 157) % VW, y = 110 + (k * 137.3 + cyc * 89) % (VH - 130); g.globalAlpha = 1 - ph; g.beginPath(); g.ellipse(x, y, 3 + ph * 11, 1.3 + ph * 3.6, 0, 0, 7); g.stroke(); }
      g.globalAlpha = 1;
      if (heavy && WX.flash > 0) { g.fillStyle = `rgba(235,242,255,${WX.flash * .6})`; g.fillRect(0, 0, VW, VH); }
    }
    if (w === "moon") {
      g.save(); g.globalCompositeOperation = "multiply"; g.fillStyle = "#454a86"; g.fillRect(0, 0, VW, VH); g.restore();
      const mx = VW - 260, gr = g.createRadialGradient(mx, 90, 10, mx, 90, 150); gr.addColorStop(0, "rgba(255,250,220,.95)"); gr.addColorStop(.18, "rgba(255,250,220,.55)"); gr.addColorStop(1, "rgba(255,250,220,0)"); g.fillStyle = gr; g.beginPath(); g.arc(mx, 90, 150, 0, 7); g.fill();
      g.fillStyle = "#fffbe6"; g.beginPath(); g.arc(mx, 90, 26, 0, 7); g.fill();
      for (let k = 0; k < 60; k++) { const tw = .4 + .6 * Math.abs(Math.sin(time * 1.6 + k * 2.1)); g.fillStyle = `rgba(255,255,240,${tw * .9})`; g.beginPath(); g.arc((k * 197.3) % VW, 12 + (k * 61.7) % 150, k % 5 ? 1.3 : 2.2, 0, 7); g.fill(); }
      g.save(); g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 46; k++) { const a = (.5 + .5 * Math.sin(time * 3 + k)) * .9, x = (k * 173.3 + Math.sin(time * .5 + k) * 30) % VW, y = 220 + (k * 97.1) % (VH - 260) + Math.sin(time + k) * 14; const fg = g.createRadialGradient(x, y, 0, x, y, 12); fg.addColorStop(0, `rgba(230,255,150,${a})`); fg.addColorStop(1, "rgba(230,255,150,0)"); g.fillStyle = fg; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); }
      g.restore();
    }
    if (w === "frost") {
      g.fillStyle = "rgba(222,242,255,.2)"; g.fillRect(0, 0, VW, VH);
      for (let k = 0; k < 170; k++) { const r = 1.6 + (k % 4) * 1, sp = 26 + (k % 5) * 13, x = ((k * 131.7 + Math.sin(time * .8 + k) * 40 + time * 22) % (VW + 40)) - 20, y = ((k * 71.3 + time * sp) % (VH + 20)) - 10; g.fillStyle = `rgba(255,255,255,${.65 + (k % 3) * .12})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      const vg = g.createRadialGradient(VW / 2, VH / 2, VH * .35, VW / 2, VH / 2, VH); vg.addColorStop(0, "rgba(220,245,255,0)"); vg.addColorStop(1, "rgba(225,245,255,.55)"); g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
    }
    if (w === "rainbow") {
      const cx = VW / 2, cy = VH + 40, R = Math.min(VW * .62, 820);
      g.save(); g.globalAlpha = .22; g.strokeStyle = "#fff"; g.lineWidth = 120; g.filter = "blur(18px)"; g.beginPath(); g.arc(cx, cy, R - 40, Math.PI, 0); g.stroke(); g.restore();
      g.save(); g.globalAlpha = .5; ["#ff5a5a", "#ffa94d", "#ffe066", "#69db7c", "#4dabf7", "#9775fa"].forEach((c, k) => { g.strokeStyle = c; g.lineWidth = 16; g.beginPath(); g.arc(cx, cy, R - k * 16, Math.PI, 0); g.stroke(); }); g.restore();
      g.save(); g.globalCompositeOperation = "lighter"; for (let k = 0; k < 40; k++) { const a = (.5 + .5 * Math.sin(time * 4 + k * 1.3)) * .8; g.fillStyle = `rgba(255,250,230,${a})`; const x = (k * 151.3 + time * 12) % VW, y = (k * 83.7) % (VH * .7); g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 1.6, y); g.lineTo(x, y + 5); g.lineTo(x - 1.6, y); g.fill(); } g.restore();
    }
    if (w === "sun") {
      g.save(); g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 5; k++) { g.fillStyle = "rgba(255,238,170,.075)"; g.beginPath(); g.moveTo(VW - 200 + k * 46, -20); g.lineTo(VW - 110 + k * 46, -20); g.lineTo(VW * .45 + k * 130, VH); g.lineTo(VW * .45 - 110 + k * 130, VH); g.fill(); }
      for (let k = 0; k < 36; k++) { const a = (.4 + .6 * Math.abs(Math.sin(time * .9 + k))) * .55; g.fillStyle = `rgba(255,240,190,${a})`; g.beginPath(); g.arc((k * 167.9 + Math.sin(time * .4 + k) * 40) % VW, (k * 97.7 + time * 9) % VH, 1.8, 0, 7); g.fill(); }
      g.restore();
    }
  }
  let hoverI = -1;
  const combo = { n: 0, x: 0, y: 0 };
  const CUR = { on: false, vx: 0, vy: 0, use: 0, grab: false };
  const AREA = t => t === "can" ? F.can : t === "net" ? (F.net === 2 ? 3 : 1) : t === "sickle" ? 3 : 1;
  const CUR_ICON = { hand: "hand", seed: "seed", can: () => ["", "can", "can2", "can3"][F.can], fert: () => F.fert === "gold" ? "fertGold" : F.fert === "super" ? "fertSuper" : "fert", net: "net", sickle: "sickle", shovel: "shovel", prank: "bug", gift: "gift" };
  // Each tool: how it moves when used (pivot near the grip), and what falls out of it.
  const CUR_MOTION = { can: [-.35, -.75], net: [-.4, 1.0], sickle: [-.15, -1.25], shovel: [.35, -.6], seed: [0, -.55], fert: [-.2, -.6], hand: [0, 0], prank: [0, .2], gift: [0, -.3] };
  function drawHoldRing(g) {
    if (!tapG || tapG.mode !== "pending") return; const k = (performance.now() - tapG.t0 - 90) / (HOLD_MS - 90); if (k <= 0) return;
    const r = cv.getBoundingClientRect(), vx = ((tapG.x0 - r.left) / r.width * NW - OFX) / K, vy = ((tapG.y0 - r.top) / r.height * NH - OFY) / K;
    g.save(); g.lineWidth = 4; g.strokeStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.arc(vx, vy, 30, 0, 7); g.stroke();
    g.strokeStyle = "#ffd65b"; g.beginPath(); g.arc(vx, vy, 30, -Math.PI / 2, -Math.PI / 2 + Math.min(1, k) * Math.PI * 2); g.stroke(); g.restore();
  }
  function drawToolCursor(g, time) {
    if (!CUR.on) return;
    const t = F.tool, k = Math.max(0, CUR.use), sw = Math.sin((1 - k) * Math.PI) * (k > 0 ? 1 : 0), x = CUR.vx, y = CUR.vy;
    const name = CUR.grab ? "hand" : typeof CUR_ICON[t] === "function" ? CUR_ICON[t]() : CUR_ICON[t] || "hand", im = ICON_IMG(name);
    const [rest, swing] = CUR_MOTION[t] || [0, 0], S = 44;
    g.save(); g.translate(x, y);
    g.save(); g.rotate(rest + swing * sw + (t === "seed" ? Math.sin(time * 3) * .05 : 0)); if (t === "hand" || CUR.grab) g.scale(1 - k * .12, 1 - k * .12);
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 6; g.shadowOffsetY = 3;
    if (im?.complete) g.drawImage(im, -S * .35, -S * .75, S, S);
    g.restore();
    if (t === "seed" && !CUR.grab) { const ci = ITEM[F.seed] || CIMG[F.seed]?.[4]; if (ci?.complete) g.drawImage(ci, S * .22, -S * .1, 20, 23); g.font = "800 11px 'DM Sans', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 3; g.strokeStyle = "#2a1f12"; g.fillStyle = "#fff"; const n = `×${F.seeds[F.seed] || 0}`; g.strokeText(n, S * .5, S * .5); g.fillText(n, S * .5, S * .5); g.textBaseline = "alphabetic"; }
    if (k > 0 && !CUR.grab) {
      if (t === "can") { g.fillStyle = "rgba(120,200,255,.9)"; for (let d = 0; d < 6; d++) { const f = ((1 - k) * 2 + d * .17) % 1; g.beginPath(); g.ellipse(22 + d % 3 * 3 + f * 6, -8 + f * 40, 2, 3.5, 0, 0, 7); g.fill(); } }
      if (t === "seed") { g.fillStyle = "#8a6238"; for (let d = 0; d < 5; d++) { g.beginPath(); g.ellipse(-4 + d * 3, 14 + (1 - k) * 20 + d % 2 * 4, 1.8, 2.6, d, 0, 7); g.fill(); } }
      if (t === "fert") { g.fillStyle = F.fert === "gold" ? "#ffd65b" : F.fert === "super" ? "#7fe7ff" : "#9be07a"; for (let d = 0; d < 7; d++) { g.beginPath(); g.arc(-6 + d * 3, 14 + (1 - k) * 24 + (d % 3) * 3, 1.8, 0, 7); g.fill(); } }
      if (t === "sickle") { g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = 3; g.beginPath(); g.arc(0, -6, 30, -2.4, -.4); g.stroke(); }
      if (t === "net") { g.strokeStyle = `rgba(200,170,255,${k})`; g.lineWidth = 2.5; g.beginPath(); g.arc(8, -12, 22, -1.8, .2); g.stroke(); }
    }
    g.restore();
  }
  function drawArea(g) {
    if (!CUR.on || hoverI < 0 || F.decorPick) return;
    const s = cur(); if (!s.me && !["can", "net", "hand"].includes(F.tool)) return;
    const ids = s.me && ["can", "net", "sickle"].includes(F.tool) ? area(hoverI, AREA(F.tool)) : [hoverI];
    const col = { can: "120,200,255", net: "200,170,255", sickle: "255,214,91", seed: "160,240,130", fert: "200,255,140", shovel: "255,140,140" }[F.tool] || "255,255,255";
    ids.forEach(j => { const r = plotRect(j), p = s.plots[j]; if (!p || (p.locked && s.me && F.tool !== "hand")) return; g.fillStyle = `rgba(${col},.18)`; g.strokeStyle = `rgba(${col},.9)`; g.lineWidth = 2.5; g.setLineDash([7, 5]); g.beginPath(); g.roundRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, 13); g.fill(); g.stroke(); g.setLineDash([]); });
  }
  function draw(time) {
    const s = cur();
    ctx.setTransform(PS, 0, 0, PS, 0, 0); ctx.fillStyle = "#2f5a26"; ctx.fillRect(0, 0, NW, NH);
    ctx.save(); ctx.translate(OFX, OFY); ctx.scale(K, K);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip(); ctx.translate(VW / 2, VH / 2); ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(bg, WX0, WY0);
    // back row: trees, buildings, labels
    [[338, 280, "apple", .62], [812, 240, "cherry", .6], [44, 400, "pine", .85], [1480, 340, "round", .7], [1700, 330, "pine", .8], [70, 210, "round", .7], [640, 1050, "autumn", .7], [1120, 1060, "round", .75], [1450, 1040, "cherry", .65], [1720, 1000, "pine", .8], [40, 1060, "mint", .7]].forEach(([x, y, k, sz], i) => GFX.drawTree(ctx, GFX.tree(k, 50 + i, sz), x, y, time, i, .7));
    GFX.shadow(ctx, HOUSE.x + 30, HOUSE.y + 4, 110, 20);
    const hs = GFX.house({ wall: "#fff3dd", roof: "#d9473f", shutters: "#4fae46", w: 150, sd: 9, sign: { t: "HOME", bg: "#7a3a1a" } }); GFX.blit(ctx, hs, HOUSE.x, HOUSE.y);
    const wm = GFX.windmillBody(); GFX.shadow(ctx, MILL.x + 20, MILL.y + 4, 60, 14); GFX.blit(ctx, wm, MILL.x, MILL.y); GFX.windmillSails(ctx, MILL.x + wm.hub[0], MILL.y + wm.hub[1], time * .7, .82);
    GFX.shadow(ctx, BOARDP.x + 8, BOARDP.y + 3, 70, 14); GFX.blit(ctx, GFX.board(), BOARDP.x, BOARDP.y);
    GFX.shadow(ctx, STALL.x + 10, STALL.y + 4, 96, 16); GFX.blit(ctx, GFX.stall(), STALL.x, STALL.y);
    GFX.shadow(ctx, BARN.x + 20, BARN.y + 4, 130, 22); GFX.blit(ctx, GFX.barn(), BARN.x, BARN.y);
    FSMOKE.forEach(m => { ctx.fillStyle = `rgba(240,240,245,${.5 * (1 - m.t / m.life)})`; ctx.beginPath(); ctx.arc(m.x, m.y, 6 + m.t * 7, 0, 7); ctx.fill(); });
    const lab = (t, x, y) => nameTag(ctx, t, x, y);
    if (s.me) lab("ORDERS", BOARDP.x, BOARDP.y - 22);
    drawFence(ctx);
    drawPastureFence(ctx, true);
    // decor slots
    const deco = s.decor;
    DECO_SLOTS.forEach(([x, y], k) => { if (F.decorPick && s.me) { ctx.strokeStyle = deco[k] ? "rgba(255,214,91,.6)" : "#ffd65b"; ctx.setLineDash([6, 5]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, 40, 16, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); } });
    // plots back-to-front
    s.plots.forEach((p, i) => drawPlot(ctx, i, p, time, s));
    drawArea(ctx);
    const items = [];
    MARGIN.forEach(m => items.push({ y: m.y, d: () => { if (m.t) GFX.drawTree(ctx, m.t, m.x, m.y, time, m.ph, .8); else { GFX.shadow(ctx, m.x + 6, m.y + 2, 30, 8); GFX.blit(ctx, m.b, m.x, m.y + 4); } } }));
    items.push({ y: -40, d: () => GFX.blit(ctx, GFX.sign("← PLAZA", "#2a6fd0"), HOUSE.x + 70, -40) });
    s.plots.forEach((p, i) => items.push({ y: plotRect(i).y + PH * .72, d: () => drawPlotCrop(ctx, i, p, time) }));
    deco.forEach((d, k) => { if (d) items.push({ y: DECO_SLOTS[k][1], d: () => drawDecor(ctx, d, DECO_SLOTS[k][0], DECO_SLOTS[k][1], time) }); });
    items.push({ y: WELL.y, d: () => { GFX.shadow(ctx, WELL.x + 8, WELL.y + 2, 56, 12); GFX.blit(ctx, GFX.well(), WELL.x, WELL.y); if (s.me) lab(F.wish ? "WISHING WELL ✦" : "WISHING WELL", WELL.x, WELL.y - 140); } });
    items.push({ y: HOUSE.y + 8, d: () => GFX.cat(ctx, "sleep", time, HOUSE.x - 40, HOUSE.y + 8, 1.1, 1) });
    if (s.me && F.scarecrow) items.push({ y: 560, d: () => { GFX.shadow(ctx, 292, 562, 26, 6); GFX.blit(ctx, GFX.scarecrow(), 288, 562); } });
    items.push({ y: POND.y - POND.ry, d: () => { const { x, y, rx, ry } = POND; const wg = ctx.createRadialGradient(x - 30, y - 20, 8, x, y, rx); wg.addColorStop(0, "#7fe0f0"); wg.addColorStop(1, "#2a92c0"); ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 1.5; for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let xx = x - rx + 20; xx < x + rx - 20; xx += 10) ctx.lineTo(xx, y - 30 + k * 18 + Math.sin(xx * .05 + time + k) * 2); ctx.stroke(); } [[x - 70, y - 10], [x + 80, y + 14]].forEach(([px, py], k) => { ctx.fillStyle = "#3f9a46"; ctx.beginPath(); ctx.ellipse(px, py, 16, 9, 0, .4, 6); ctx.lineTo(px, py); ctx.fill(); if (!k) { ctx.fillStyle = "#ff9bc4"; ctx.beginPath(); ctx.arc(px + 3, py - 4, 4, 0, 7); ctx.fill(); } }); FDUCKS.forEach(d => { const dx = x + Math.cos(d.a) * rx * .55, dy = y + Math.sin(d.a) * ry * .45; GFX.duck(ctx, d.k, "swim", time + d.a, dx, dy, 1.1, Math.sin(d.a) > 0 ? -1 : 1); }); } });
    if (s.me) F.sprinklers.forEach((on, r) => { if (!on) return; const y = OY + r * (PH + GAP) + PH / 2, sx = OX + FW + 12; items.push({ y, d: () => { ctx.fillStyle = "#8a93a6"; ctx.beginPath(); ctx.roundRect(sx - 4, y - 8, 9, 20, 3); ctx.fill(); ctx.fillStyle = "#4fb3ff"; ctx.beginPath(); ctx.arc(sx, y - 9, 4, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(160,220,255,.7)"; for (let k = 0; k < 7; k++) { const a = time * 4 + k; ctx.beginPath(); ctx.arc(sx - 8 - (k * 12 + time * 34) % 70, y - 12 - Math.sin(a) * 7, 2, 0, 7); ctx.fill(); } } }); });
    // pasture
    if (s.pasture) {
      items.push({ y: 482, d: () => { GFX.shadow(ctx, 1664, 484, 40, 8); GFX.blit(ctx, GFX.hay(), 1660, 484); } });
      items.push({ y: COW.y, d: () => { GFX.cow(ctx, s.me && COW.milk <= 0 ? "idle" : "graze", time, COW.x, COW.y, .95, COW.face); if (s.me && COW.milk <= 0) { const by = COW.y - 82 + Math.sin(time * 3) * 3; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(COW.x - 22, by - 22, 44, 32, 12); ctx.fill(); ctx.beginPath(); ctx.moveTo(COW.x - 5, by + 9); ctx.lineTo(COW.x + 5, by + 9); ctx.lineTo(COW.x, by + 16); ctx.fill(); const mk = ICON_IMG("milk"); if (mk.complete) ctx.drawImage(mk, COW.x - 11, by - 17, 22, 22); } } });
    } else if (s.me) {
      items.push({ y: 570, d: () => { GFX.blit(ctx, GFX.rock(61, 40), 1530, 610); GFX.blit(ctx, GFX.bush("green", 62, 56), 1680, 640); GFX.blit(ctx, GFX.sign(F.lv >= 9 ? "PASTURE · 900" : "PASTURE · Lv 9", "#c0392b"), 1600, 570); } });
    }
    items.push({ y: PAST.y1, d: () => drawPastureFence(ctx, false) });
    const dg = s.me ? F.dog : s.dog, dogActive = dg && dg.until > 0;
    items.push({ y: DOGH.y, d: () => drawDoghouse(ctx, DOGH.x, DOGH.y, dogActive ? dg : null) });
    if (dogActive) items.push({ y: s.me ? dog.y : DOGH.y + 14, d: () => { if (s.me) { const moving = dog.wait <= 0 && dog.tx != null; const st = dog.barkT > 0 ? "bark" : moving ? (dog.chase != null ? "run" : "walk") : (dog.wait > 2 ? "sit" : "idle"); GFX.dog(ctx, BREED[dg.type], st, time, dog.x, dog.y, .95, dog.face, { pant: st === "idle" }); } else GFX.dog(ctx, BREED[dg.type], "sit", time, DOGH.x - 90, DOGH.y + 14, .95, 1); } });
    if (s.me) hens.forEach(h => items.push({ y: h.y, d: () => GFX.chicken(ctx, h.k, h.st, time + h.x * .01, h.x, h.y, 1.1, h.face) }));
    fenceItems(items);
    items.sort((a, b) => a.y - b.y).forEach(it => it.d());
    BUTTER.forEach(b => GFX.butterfly(ctx, time + b.ph, b.hx + Math.sin(time * .7 + b.ph) * 50, b.hy + Math.cos(time * .9 + b.ph) * 22, b.c, 1.2));
    // crows
    if (s.me) F.plots.forEach((p, i) => { const c = p.crow; if (!c) return; if (c.land && !c.leave) { GFX.bird(ctx, "crow", "peck", time, c.x, c.y + 10, 1.5, -1); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.roundRect(c.x - 20, c.y - 22, 40, 6, 3); ctx.fill(); ctx.fillStyle = "#ef4f61"; ctx.beginPath(); ctx.roundRect(c.x - 20, c.y - 22, 40 * Math.min(1, c.t / 5), 6, 3); ctx.fill(); } else GFX.bird(ctx, "crow", "fly", time, c.x, c.y, 1.6, c.leave ? 1 : -1); });
    // dusk light when the weather is moonlit: glowing windows
    if (F.weather.cur === "moon" && hs.win) hs.win.forEach(([wx, wy, ww, wh]) => { ctx.fillStyle = "rgba(255,214,120,.85)"; ctx.beginPath(); ctx.roundRect(HOUSE.x + wx, HOUSE.y + wy, ww, wh, 3); ctx.fill(); });
    // fx
    for (const f of FX) {
      const k = f.t / f.life;
      if (f.text && !f.bark) { ctx.globalAlpha = 1 - Math.max(0, k - .6) / .4; ctx.font = "800 20px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "#0b1020"; ctx.strokeText(f.text, f.x, f.y - k * 40); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - k * 40); ctx.globalAlpha = 1; }
      else if (f.fly) { const tx = BARN.x, ty = BARN.y - 120, e = k * k, x = f.x + (tx - f.x) * e, y = f.y + (ty - f.y) * e - Math.sin(k * Math.PI) * 80; if (!f.im) { f.im = new Image(); f.im.src = f.img; } if (f.im.complete) ctx.drawImage(f.im, x - 22, y - 26, 44, 51); if (k < .5) { ctx.font = "800 18px 'Barlow Condensed', sans-serif"; ctx.fillStyle = "#ffd65b"; ctx.textAlign = "center"; ctx.fillText(f.label, x + 26, y - 20); } }
      else if (f.puff || f.poof) { ctx.fillStyle = f.poof ? `rgba(160,120,255,${1 - k})` : `rgba(210,170,120,${1 - k})`; for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * k * 30, f.y + Math.sin(a) * k * 14, 6 * (1 - k) + 2, 0, 7); ctx.fill(); } }
      else if (f.drops) { ctx.fillStyle = `rgba(120,200,255,${1 - k})`; for (let a = 0; a < 7; a++) { ctx.beginPath(); ctx.ellipse(f.x - 30 + a * 10, f.y - 30 + k * 40 + (a % 2) * 8, 2.5, 5, 0, 0, 7); ctx.fill(); } }
      else if (f.bark) { if (f.follow && dogOn()) { f.x = dog.x; f.y = dog.y - 40; } ctx.globalAlpha = 1 - Math.max(0, k - .7) / .3; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(f.x - 40, f.y - 50, 80, 30, 12); ctx.moveTo(f.x - 7, f.y - 21); ctx.lineTo(f.x + 1, f.y - 9); ctx.lineTo(f.x + 8, f.y - 21); ctx.fill(); ctx.fillStyle = "#2a1a00"; ctx.font = "800 18px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center"; ctx.fillText(f.text || "WOOF!", f.x, f.y - 29); ctx.globalAlpha = 1; }
      else if (f.bolt) { ctx.strokeStyle = `rgba(235,244,255,${1 - k})`; ctx.lineWidth = 5; ctx.shadowColor = "#bcd8ff"; ctx.shadowBlur = 18; ctx.beginPath(); let x = f.x, y = 0; ctx.moveTo(x, y); while (y < 420) { x += Math.random() * 30 - 15; y += 30; ctx.lineTo(x, y); } ctx.stroke(); ctx.fillStyle = `rgba(230,240,255,${(1 - k) * .25})`; ctx.fillRect(0, 0, WW, WH); }
    }
    ctx.restore();
    drawWeather(ctx, time);
    drawToolCursor(ctx, time); drawHoldRing(ctx);
    ctx.restore();
  }

  /* ---------- loop ---------- */
  function step(now) {
    raf = requestAnimationFrame(step);
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; // never negative: the first frame can be stamped before enter() ran T = now / 1000;
    if (!inited) return;
    tick(dt);
    // dog & hens
    if (dogOn()) {
      if (dog.chase != null && !dog.chasing) { const r = plotRect(dog.chase); dog.chasing = true; dogRoute(r.x + PW / 2, r.y + PH + 4, true); }
      if (dog.barkT > 0) dog.barkT -= dt;
      if (dog.wait > 0) { dog.wait -= dt; if (Math.random() < dt * .04) dog.barkT = .8; }
      else {
        if (!dog.path.length) { if (dog.chasing) { dog.chasing = false; dog.chase = null; } const [x, y] = dogIdleSpot(); dogRoute(x, y, false); }
        const [wx, wy] = dog.path[0], dx = wx - dog.x, dy = wy - dog.y, d = Math.hypot(dx, dy);
        if (d < 6) { dog.path.shift(); if (!dog.path.length) { dog.wait = dog.chasing ? .8 : 2 + Math.random() * 5; if (!dog.chasing) dog.tx = null; } }
        else { const sp = dog.chasing ? 270 : 85; dog.x += dx / d * Math.min(d, sp * dt); dog.y += dy / d * Math.min(d, sp * dt); dog.face = dx > 0 ? 1 : -1; }
      }
    }
    FDUCKS.forEach(d => d.a += d.s * dt);
    if (keysF.size) { const sp = 600 * dt / Z; if (keysF.has("a") || keysF.has("arrowleft")) cam.x -= sp; if (keysF.has("d") || keysF.has("arrowright")) cam.x += sp; if (keysF.has("w") || keysF.has("arrowup")) cam.y -= sp; if (keysF.has("s") || keysF.has("arrowdown")) cam.y += sp; clampCam(); }
    hens.forEach(h => { if (h.wait > 0) { h.wait -= dt; if (h.wait <= 0) h.st = "idle"; return; } if (h.tx == null) { if (Math.random() < .4) { h.st = "peck"; h.wait = 1.4 + Math.random() * 2; return; } let ok = false; for (let t = 0; t < 10 && !ok; t++) { h.tx = 30 + Math.random() * 540; h.ty = 790 + Math.random() * 120; ok = !blocked(h.tx, h.ty) && clearLine([h.x, h.y], [h.tx, h.ty]); } if (!ok) { h.tx = h.x; h.ty = h.y; } } const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy); if (d < 5) { h.tx = null; h.st = "idle"; h.wait = .6 + Math.random() * 1.6; return; } h.st = "walk"; h.face = dx > 0 ? 1 : -1; h.x += dx / d * 46 * dt; h.y += dy / d * 46 * dt; });
    if (Math.random() < dt * 2.5) { const hs = GFX.house({ wall: "#fff3dd", roof: "#d9473f", shutters: "#4fae46", w: 150, sd: 9, sign: { t: "HOME", bg: "#7a3a1a" } }); if (hs.chimney) FSMOKE.push({ x: HOUSE.x + hs.chimney[0], y: HOUSE.y + hs.chimney[1], t: 0, life: 2.4, vx: 6 + Math.random() * 6 }); }
    FSMOKE.forEach(m => { m.t += dt; m.x += m.vx * dt; m.y -= 20 * dt; }); for (let i = FSMOKE.length - 1; i >= 0; i--) if (FSMOKE[i].t > FSMOKE[i].life) FSMOKE.splice(i, 1);
    if (F.pasture) { COW.t += dt; if (COW.t > 12) { COW.t = 0; COW.face *= -1; } COW.x = Math.max(PAST.x0 + 46, Math.min(PAST.x1 - 46, COW.x + COW.face * 6 * dt)); }
    if (CUR.use > 0) CUR.use = Math.max(0, CUR.use - dt * 3.2);
    FX.forEach(f => f.t += dt); for (let i = FX.length - 1; i >= 0; i--) if (FX[i].t > FX[i].life) { if (FX[i].fly) { renderChips(); } FX.splice(i, 1); }
    draw(T);
    if (Math.floor(T * 4) !== Math.floor((T - dt) * 4)) { renderWeather(); renderChips(); if (sheet && ["shop", "market", "orders"].includes(sheet)) updateSheetTimers(); if (hoverI >= 0) showTip(hoverI); }
  }

  /* ---------- HUD ---------- */
  function renderBadge() {
    const s = cur(), b = $("fm-badge");
    if (!s.me) { b.innerHTML = `<div class="fm-ring" style="--p:100"><b>${s.lv}</b></div><div><strong>${esc(s.n)}'s Farm</strong><small>Visiting</small></div>`; return; }
    b.innerHTML = `<div class="fm-ring" style="--p:${F.lv >= MAX_LV ? 100 : (F.xp / need(F.lv)) * 100}"><b>${F.lv}</b></div><div><strong>tester's Farm</strong><small class="row2"><span>${F.lv >= MAX_LV ? "Max level" : `${F.xp}/${need(F.lv)} XP`}</span><span title="Charm: decorations give bonus XP">Charm ${beauty()} · +${xpBonus()}%</span></small><div class="xpbar"><i style="width:${F.lv >= MAX_LV ? 100 : (F.xp / need(F.lv)) * 100}%"></i></div></div>`;
  }
  function renderWeather() {
    const w = WEATHERS[F.weather.cur], n = WEATHERS[F.weather.next], el = $("fm-weather");
    el.style.setProperty("--wc", w.c + "55");
    const n2 = gardener() === "mystowl" ? WEATHERS[F.weather.next2] : null, nt = `Next: ${n.n} in ${fmtReal(F.weather.until)}${n2 ? `, then ${n2.n}` : ""}`;
    el.title = `${w.n}: ${w.d}. ${nt}`;
    el.innerHTML = `<span class="wi">${I(w.ic)}</span><div class="wt"><b>${w.n}</b><small>${w.d}</small></div><div class="next"><span>${I(n.ic)}${n2 ? I(n2.ic) : ""}<b>${fmtReal(F.weather.until)}</b></span><small>Next weather</small></div>`;
  }
  /* status orbs: perk · guard dog · barn. The ring shows what is left (or how full); tap for the details */
  const WPERIOD = 60; // one weather lasts 4 hours (60 units)
  const ringCol = p => p > .5 ? "#7ff0a2" : p > .2 ? "#ffd65b" : "#ff6b5a";
  let orbOpen = null, orbKey = "";
  const dogTotal = dg => dg.total || (dg.until > DAY ? Math.ceil(dg.until / DAY) * DAY : DAY);
  function renderChips() {
    const s = cur(), dg = s.me ? F.dog : s.dog, on = dg && dg.until > 0, pk = PERKS[gardener()], warm = pk[2] === "warm" && GT < F.warmUntil;
    const dp = on ? Math.min(1, dg.until / dogTotal(dg)) : 0, used = s.me ? barnUsed() : 0, bp = s.me ? Math.min(1, used / F.barnCap) : 0;
    // the orbs are built once and then updated in place, so a tap never lands on a button that was just replaced
    const wn = WEATHERS[F.weather.cur], wp = Math.max(0, Math.min(1, F.weather.until / WPERIOD));
    const want = [["weather", "o-weather", wp, wn.c, `<span class="wx-ic">${I(wn.ic)}</span>`, `${wn.n}: ${wn.d}. Changes in ${fmtReal(F.weather.until)}`], s.me && ["perk", `o-perk ${!pk[2] ? "passive" : warm ? "on" : "ready"}`, warm ? (F.warmUntil - GT) / 60 : 1, pk[2] ? "#ffd65b" : "#8fa3d0", `<img src="${heroArt(gardener())}" alt="">`, `${pk[0]}: ${pk[1]}`],
      ["dog", `o-dog${on ? "" : " off"}`, dp, on ? ringCol(dp) : "#ff6b5a", I("dog"), on ? `${DOGS[dg.type].n}: ${fmtReal(dg.until)} left` : "No guard dog"],
      s.me && ["barn", `o-barn${bp >= .9 ? " full" : ""}`, bp, bp >= .9 ? "#ff6b5a" : bp >= .75 ? "#ffd65b" : "#7ff0a2", I("barn"), `Barn ${used}/${F.barnCap}`]].filter(Boolean);
    const box = $("fm-chips"), sig = want.map(w => w[0] + (w[0] === "perk" ? gardener() : w[0] === "weather" ? F.weather.cur : "")).join();
    if (box.dataset.sig !== sig) { box.dataset.sig = sig; box.innerHTML = want.map(([k, , , , inner]) => `<button type="button" class="fm-orb" data-orb="${k}"><span class="ci">${inner}</span></button>`).join(""); }
    want.forEach(([k, cls, p, col, , label]) => { const b = box.querySelector(`[data-orb="${k}"]`); b.className = `fm-orb ${cls}`; b.style.setProperty("--p", p.toFixed(3)); b.style.setProperty("--rc", col); b.setAttribute("aria-expanded", String(orbOpen === k)); if (b.title !== label) { b.title = label; b.setAttribute("aria-label", label); } });
    if (orbOpen) renderOrbPop();
    $("fm-ord-dot").hidden = !F.orders.some(o => !o.wait && canFill(o));
    $("fm-fr-dot").hidden = !FRIENDS.some(f => f.plots.some(p => p.pests || (p.crop && p.prog >= 1)));
    $("fm-dock-dot").hidden = $("fm-ord-dot").hidden && $("fm-fr-dot").hidden;
  }
  function renderOrbPop() {
    const el = $("fm-orbpop"), s = cur(), k = orbOpen, btn = k && $("fm-chips").querySelector(`[data-orb="${k}"]`);
    if (!btn) { orbOpen = null; el.hidden = true; return; }
    let h = "";
    if (k === "weather") {
      const w = WEATHERS[F.weather.cur], n = WEATHERS[F.weather.next], n2 = gardener() === "mystowl" ? WEATHERS[F.weather.next2] : null, p = Math.max(0, Math.min(1, F.weather.until / WPERIOD));
      h = `<div class="op-h">${I(w.ic)}<b>${w.n}</b><span class="op-tag">Now</span></div><p>${w.d}.</p><div class="op-big">${fmtReal(F.weather.until)}<small>until it changes</small></div><div class="op-bar" style="--rc:${w.c}"><i style="width:${p * 100}%"></i></div><div class="op-next"><span>Next</span>${I(n.ic)}<b>${n.n}</b>${n2 ? `<span>then</span>${I(n2.ic)}<b>${n2.n}</b>` : ""}</div><p class="op-note">${n.d}.</p>`;
    } else if (k === "dog") {
      const dg = s.me ? F.dog : s.dog, on = dg && dg.until > 0, p = on ? Math.min(1, dg.until / dogTotal(dg)) : 0;
      h = on ? `<div class="op-h">${I("dog")}<b>${DOGS[dg.type].n}</b><span class="op-tag">On guard</span></div><div class="op-big">${fmtReal(dg.until)}<small>left of ${fmtReal(dogTotal(dg))}</small></div><div class="op-bar" style="--rc:${ringCol(p)}"><i style="width:${p * 100}%"></i></div><p>${DOGS[dg.type].d}.</p>${s.me ? `<button type="button" class="btn-s" data-orbgo="dogs">Extend or change dog</button>` : ""}`
        : `<div class="op-h">${I("dog")}<b>No guard dog</b><span class="op-tag warn">Unguarded</span></div><p>${s.me ? "Crows and thieves can take your crops. A dog scares crows away and catches thieves." : "This farm has no guard dog."}</p>${s.me ? `<button type="button" class="btn-s" data-orbgo="dogs">Hire a dog</button>` : ""}`;
    } else if (k === "barn") {
      const u = barnUsed(), p = u / F.barnCap;
      h = `<div class="op-h">${I("barn")}<b>Barn</b><span class="op-tag${p >= .9 ? " warn" : ""}">${p >= .9 ? "Almost full" : "Storage"}</span></div><div class="op-big">${u}<small>/ ${F.barnCap} items</small></div><div class="op-bar" style="--rc:${p >= .9 ? "#ff6b5a" : p >= .75 ? "#ffd65b" : "#7ff0a2"}"><i style="width:${p * 100}%"></i></div><p>Harvests go here. Sell at the market or deliver orders to make room.</p><button type="button" class="btn-s" data-orbgo="barn">Open barn</button>`;
    } else {
      const pk = PERKS[gardener()], warm = pk[2] === "warm" && GT < F.warmUntil;
      h = `<div class="op-h"><img src="${heroArt(gardener())}" alt=""><b>${pk[0]}</b><span class="op-tag">${!pk[2] ? "Passive" : warm ? "Active" : "Ready"}</span></div><p>${pk[1]}.${pk[2] ? "" : " Always on."}</p>${pk[2] ? (warm ? `<div class="op-big">${fmtReal(F.warmUntil - GT)}<small>left</small></div>` : `<button type="button" class="btn-s" data-orbgo="perk">Use ${pk[0]}</button>`) : `<p class="op-note">Your farmer is your Lobby fighter. Pick another fighter to change the perk.</p>`}`;
    }
    // build the card once; after that only the clock and the bar change, so it never flickers or swaps a button under a finger
    const key = k + "|" + h.replace(/<div class="op-big">.*?<\/div>|<i style="width:[^"]*"><\/i>|style="--rc:[^"]*"/g, "");
    if (key !== orbKey || el.hidden) { el.innerHTML = h; orbKey = key; }
    else { const tmp = document.createElement("div"); tmp.innerHTML = h; const nb = tmp.querySelector(".op-big"), ob = el.querySelector(".op-big"); if (nb && ob && ob.innerHTML !== nb.innerHTML) ob.innerHTML = nb.innerHTML; const nr = tmp.querySelector(".op-bar"), or = el.querySelector(".op-bar"); if (nr && or) { or.style.cssText = nr.style.cssText; or.firstElementChild.style.width = nr.firstElementChild.style.width; } }
    el.hidden = false;
    const hud = el.parentElement.getBoundingClientRect(), r = btn.getBoundingClientRect(), k2 = hud.width / el.parentElement.offsetWidth;
    // sits under its orb but always left of the side menu, never on top of it
    const dk = $("fm-dock").getBoundingClientRect();
    el.style.top = `${(r.bottom - hud.top) / k2 + 10}px`; el.style.right = `${Math.max(8, (hud.right - r.right) / k2 - 6, (hud.right - dk.left) / k2 + 8)}px`;
  }
  function usePerk() {
    const pk = PERKS[gardener()];
    if (pk[2] === "zap") { const n = F.plots.reduce((a, p) => a + p.pests, 0); F.plots.forEach(p => p.pests = 0); FX.push({ bolt: 1, x: 640, t: 0, life: .4 }); toast(`Zap! Cleared ${n} bug${n === 1 ? "" : "s"}`); }
    if (pk[2] === "water") { F.plots.forEach(p => { if (p.crop && p.prog < 1) p.wet = true; }); toast("Downpour! The whole farm is watered"); }
    if (pk[2] === "warm") { F.warmUntil = GT + 60; toast("Warmth: no bugs for 4 hours"); }
    renderChips();
  }
  const TOOLS = () => {
    const s = cur();
    if (!s.me) return [["hand", "hand", "Sneak"], ["can", "can", "Water"], ["net", "net", "Catch"], ["prank", "bug", "Prank", F.pranks], ["gift", "gift", "Gift", F.gifts]];
    return [["hand", "hand", "Hand"], ["seed", "seed", "Seeds", F.seeds[F.seed] || 0], ["can", "can", "Can", null, ["", "Wood", "Copper", "Gold"][F.can]], ["fert", F.fert === "gold" ? "fertGold" : F.fert === "super" ? "fertSuper" : "fert", "Fertilizer", F.ferts[F.fert]], ["net", "net", F.net === 2 ? "Big Net" : "Net"], ...(F.sickle ? [["sickle", "sickle", "Sickle"]] : []), ["shovel", "shovel", "Shovel"]];
  };
  function renderTools() {
    $("fm-tools").innerHTML = TOOLS().map(([id, ic, label, count, lvl], idx) => `<button type="button" class="fm-tool" data-tool="${id}" aria-pressed="${F.tool === id}" title="${id === "seed" ? `${CROP[F.seed].n} seeds` : label} (key ${idx + 1})"><kbd>${idx + 1}</kbd>${count != null ? `<b>${count > 99 ? "99+" : count}</b>` : ""}${id === "seed" ? `<span class="seedico">${I("seed")}<img src="${icon(F.seed)}" alt=""></span>` : I(ic)}<span>${id === "seed" ? CROP[F.seed].n.split(" ").pop() : label}</span>${lvl ? `<em>${lvl}</em>` : ""}</button>`).join("");
  }
  function renderVisit() {
    const el = $("fm-visit");
    if (F.visiting == null) { el.hidden = true; return; }
    const f = FRIENDS[F.visiting]; el.hidden = false;
    el.innerHTML = `<img src="${svgUrl(ART[f.face + ":base"])}" alt=""><div><b>${esc(f.n)}'s Farm</b><small>${f.dog && f.dog.until > 0 ? `${I("dog")} ${DOGS[f.dog.type].n} is on guard. Sneaking may get you caught` : "No guard dog"}</small></div><button type="button" data-home>← My farm</button>`;
  }
  function showTip(i) {
    const s = cur(), p = s.plots[i], tip = $("fm-tip");
    if (!p || p.locked || !p.crop) { tip.hidden = true; return; }
    const c = CROP[p.crop], r = plotRect(i), sp = toScreen(r.x + PW, r.y);
    const left = p.prog < 1 ? (1 - p.prog) * c.t / ((p.wet ? 1.35 : 1) * (p.fert ? 1.4 : 1)) : 0;
    tip.hidden = false;
    tip.innerHTML = `<b>${c.n}</b><div class="bar"><i style="width:${p.prog * 100}%"></i></div><div class="row"><span>${p.prog >= 1 ? "Ready" : "Time left"}</span><span>${p.prog >= 1 ? "Harvest now" : fmtReal(left)}</span></div>${p.prog >= 1 && p.mut.length ? `<div style="margin-top:4px">${p.mut.map(m => `<span class="mut ${MUTS[m].cls}">${MUTS[m].n} ×${MUTS[m].x}</span>`).join(" ")}</div>` : ""}<div class="row"><span>Water</span><span>${p.wet ? "watered" : "dry"}</span></div>${p.pests ? `<div class="row"><span>Bugs</span><span>×${p.pests} (−${p.pests * 20}% growth)</span></div>` : ""}${p.fert ? `<div class="row"><span>Fertilizer</span><span>${p.fert === "gold" ? "gold" : "regular"}</span></div>` : ""}`;
    tip.style.left = `${Math.min(NW - 200, sp.x + 8)}px`; tip.style.top = `${Math.max(60, sp.y - 10)}px`;
  }

  /* ---------- crop mastery: the long-term goal (and leaves sink) after the crop book is full ---------- */
  const MAST_HARV = [25, 75, 200, 500, 1000], MAST_LV = 40, mastCost = (c, st) => c.cost * 30 * st * st;
  function masteryHTML() {
    const lock = F.lv < MAST_LV;
    return `<div class="sh-body"><p class="sh-note">${lock ? `<b>Unlocks at farm Lv ${MAST_LV}.</b> ` : ""}Every star needs harvests of that crop and some leaves, and raises its sell price by 4%. Five stars turn it golden.</p>` +
      CROPS.filter(c => c.lv <= F.lv).map(c => { const st = F.mast[c.id] || 0, h = F.harv[c.id] || 0, nx = MAST_HARV[st], cost = st < 5 ? mastCost(c, st + 1) : 0;
        return `<div class="item mast"><span class="ic"><img src="${icon(c.id)}" alt=""></span><div><b>${c.n} <span class="stars">${"★".repeat(st)}<i>${"★".repeat(5 - st)}</i></span></b><small>${st < 5 ? `${Math.min(h, nx)}/${nx} harvests for ★${st + 1} · sells +${st * 4}%` : "Golden · sells +20%"}</small><div class="cap"><i style="width:${st < 5 ? Math.min(100, h / nx * 100) : 100}%"></i></div></div><div class="acts">${st < 5 ? `<button type="button" class="btn-s" data-mast="${c.id}" ${lock || h < nx || ECON.leaves < cost ? "disabled" : ""}>★ ${cost.toLocaleString("en-US")} ${L}</button>` : `<span class="tag legendary">MAX</span>`}</div></div>`; }).join("") + `</div>`;
  }

  /* ---------- sheets ---------- */
  let sheet = null, sheetTab = null;
  function openSheet(name, tab) { sheet = name; sheetTab = tab || ({ shop: "seeds", market: "sell", book: "book" }[name] ?? null); $("fm-pop").hidden = true; renderSheet(); $("fm-dock").querySelectorAll("[data-sheet]").forEach(b => b.setAttribute("aria-expanded", String(b.dataset.sheet === name))); }
  function closeSheet() { sheet = null; $("fm-sheet").hidden = true; F.decorPick = null; $("fm-dock").querySelectorAll("[data-sheet]").forEach(b => b.setAttribute("aria-expanded", "false")); }
  function head(k, h, tabs) { return `<div class="sh-head"><div><div class="k">${k}</div><h4>${h}</h4></div><span class="sp"></span><button type="button" class="x" data-close aria-label="Close">✕</button></div>${tabs ? `<nav class="sh-tabs">${tabs.map(([id, l]) => `<button type="button" data-tab="${id}" aria-selected="${sheetTab === id}">${l}</button>`).join("")}</nav>` : "<div></div>"}`; }
  const RC = { common: "#2a3a66", uncommon: "#1f5a3a", rare: "#1f4a7a", legendary: "#6a4a1a" };
  function renderSheet() {
    const el = $("fm-sheet"); el.hidden = false; const top = el.querySelector(".sh-body")?.scrollTop ?? 0; let html = "";
    if (sheet === "shop") {
      html = head("Farm Shop", "Shop", [["seeds", "Seeds"], ["tools", "Tools"], ["dogs", "Guard Dogs"], ["land", "Land"]]) + `<div class="sh-body">`;
      if (sheetTab === "seeds") html += `<div class="restock">${I("clock")}<span>Restock in <b id="fm-restock">${fmtReal(F.shop.at)}</b></span><span class="sh-note" style="margin-left:auto">Same stock for everyone · rare seeds come and go</span></div>` + CROPS.map(c => { const st = F.shop.stock[c.id] ?? 0, lock = c.lv > F.lv; return `<div class="item${lock ? " locked" : ""}" style="--rc:${RC[c.rar]}"><span class="ic"><img src="${icon(c.id)}" alt=""></span><div><b><span class="tag ${c.rar}">${RAR_VN[c.rar]}</span>${c.n}</b><small>${c.el} · grows in ${fmtReal(c.t)} · sells ${c.sell} ${L} · ${c.xp} XP${lock ? ` · <b style="color:#ffd65b">unlocks at Lv ${c.lv}</b>` : ""}</small><small>You have ${F.seeds[c.id] || 0} · <span class="stock${st ? "" : " out"}">${st ? `${st} in stock` : "sold out"}</span></small></div><div class="acts"><button type="button" class="btn-s" data-buyseed="${c.id}" data-n="1" ${lock || !st || ECON.leaves < c.cost ? "disabled" : ""}>${c.cost} ${L}</button>${c.rar === "common" ? `<button type="button" class="btn-s ghost" data-buyseed="${c.id}" data-n="5" ${lock || st < 5 || ECON.leaves < c.cost * 5 ? "disabled" : ""}>×5</button>` : `<span class="btn-s ghost btn-ph" aria-hidden="true"></span>`}</div></div>`; }).join("");
      if (sheetTab === "tools") {
        const T2 = [
          ["can2", "can2", "Copper Can", "Waters 3 plots in a row", 600, 8, F.can >= 2, F.can < 1],
          ["can3", "can3", "Gold Can", "Waters a 3×3 area", 4000, 30, F.can >= 3, F.can < 2],
          ["net2", "net", "Big Net", "Catches bugs in a 3×3 area", 700, 10, F.net >= 2],
          ["sickle", "sickle", "Sickle", "Harvests a 3×3 area at once", 1200, 14, F.sickle],
          ["scarecrow", "scarecrow", "Scarecrow", "50% fewer bugs and no crows", 300, 4, F.scarecrow],
          ["sprinkler", "sprinkler", `Sprinkler (${F.sprinklers.filter(Boolean).length}/${F.sprinklers.length})`, "Its row is watered whenever you plant", [1500, 2200, 3000, 3800, 4500][F.sprinklers.filter(Boolean).length] ?? 4500, [18, 26, 34, 42, 50][F.sprinklers.filter(Boolean).length] ?? 50, F.sprinklers.every(Boolean)],
          ["fnorm", "fert", `Fertilizer ×3 (have ${F.ferts.norm})`, "Crop grows 40% faster until ripe", 60, 1, false],
          ["fsuper", "fertSuper", `Super Fertilizer (have ${F.ferts.super})`, "Instantly adds 50% growth", 90, 6, false],
          ["fgold", "fertGold", `Gold Fertilizer (have ${F.ferts.gold})`, "Gold mutation odds ×3 for that crop", 200, 24, false],
          ["barn", "barn", `Barn +40 (${F.barnCap})`, "Store more crops", 250 * (F.barnUp + 1), 1, false],
        ];
        html += `<p class="sh-note">Tools are yours forever. Fertilizer is used up.</p>` + T2.map(([id, ic, n, d, cost, lv, have, blocked]) => { const lock = lv > F.lv; return `<div class="item${lock ? " locked" : ""}"><span class="ic">${I(ic)}</span><div><b>${n}</b><small>${d}${lock ? ` · <b style="color:#ffd65b">unlocks at Lv ${lv}</b>` : ""}</small></div><div class="acts">${have ? `<button type="button" class="btn-s green" disabled>Owned</button>` : `<button type="button" class="btn-s" data-buytool="${id}" data-cost="${cost}" ${lock || blocked || ECON.leaves < cost ? "disabled" : ""}>${cost.toLocaleString("en-US")} ${L}</button>`}</div></div>`; }).join("");
      }
      if (sheetTab === "dogs") {
        html += `<p class="sh-note">Hire a guard dog by the day. When time runs out the dog goes home, so remember to renew. ${FAST ? "Fast demo time: 1 day ≈ 6 minutes." : "A day is a real day."}</p>`;
        html += Object.entries(DOGS).map(([k, d]) => { const active = dogOn() && F.dog.type === k, dlock = d.lv > F.lv; return `<div class="dogcard${active ? " active" : ""}${dlock ? " locked" : ""}"><canvas data-dogprev="${k}" width="120" height="120"></canvas><div><b>${d.n}</b><small>${d.d}${active ? `<br><b style="color:#7ff0a2">On guard · ${fmtReal(F.dog.until)} left</b>` : ""}</small><div class="acts">${dlock ? `<span class="sh-note">Unlocks at Lv ${d.lv}</span>` : active ? `<button type="button" class="btn-s green" data-dog="${k}" data-days="1" ${ECON.leaves < d.p1 ? "disabled" : ""}>Renew 1 day · ${d.p1} ${L}</button>` : `<button type="button" class="btn-s" data-dog="${k}" data-days="1" ${ECON.leaves < d.p1 ? "disabled" : ""}>1 day · ${d.p1} ${L}</button><button type="button" class="btn-s ghost" data-dog="${k}" data-days="3" ${ECON.leaves < d.p3 ? "disabled" : ""}>3 days · ${d.p3} ${L}</button>`}</div></div></div>`; }).join("");
      }
      if (sheetTab === "land") {
        const k = F.land, ok = F.lv >= landLv(k), done = k >= LAND_MAX;
        html += `<p class="sh-note">Buy more land one plot at a time. Each plot costs more than the last. You can only buy plots <b>next to land you own</b>; they show a <b>FOR SALE</b> sign.</p>
        <div class="landmap" style="grid-template-columns:repeat(${COLS},1fr)">${F.plots.map((p, i) => `<button type="button" class="lm ${!p.locked ? "own" : buyable(i) ? "can" : "no"}" ${buyable(i) ? `data-landbuy="${i}"` : "disabled"} title="${!p.locked ? "Your land" : buyable(i) ? "For sale" : "Not yet"}">${!p.locked ? (p.crop ? I("sprout") : "") : buyable(i) ? I("sign") : ""}</button>`).join("")}</div>
        <div class="item"><span class="ic">${I("sign")}</span><div><b>Next plot · ${15 + k}/${COLS * ROWS} plots</b><small>${done ? "You own every plot" : `${landPrice(k)} ${L} · needs Lv ${landLv(k)}${ok ? "" : ` · <b style="color:#ffd65b">you are Lv ${F.lv}</b>`}`}</small><small>After that: ${done ? "—" : `${landPrice(k + 1)} ${L} · Lv ${landLv(k + 1)}`}</small></div></div>
        <div class="item${F.lv < 9 && !F.pasture ? " locked" : ""}"><span class="ic">${I("cow")}</span><div><b>Cow Pasture</b><small>Opens the meadow on the right with a cow that gives <b>Storm Milk</b> every ${fmtReal(80)} (sells for 60 ${L}).${F.pasture ? "" : " Needs Lv 9."}</small></div><div class="acts">${F.pasture ? `<button type="button" class="btn-s green" disabled>Owned</button>` : `<button type="button" class="btn-s" data-pasture ${F.lv < 9 || ECON.leaves < 900 ? "disabled" : ""}>900 ${L}</button>`}</div></div>
        <div class="item locked"><span class="ic">${I("fish")}</span><div><b>Fish Pond</b><small>Coming soon: fishing and koi. Unlocks at Lv 14.</small></div></div>`;
      }
      html += `</div>`;
    }
    if (sheet === "orders") {
      html = head("Order board", "Orders") + `<div class="sh-body"><p class="sh-note">Deliver the crops to earn Gold Leaves and XP. Orders pay more than the market.</p>` + F.orders.map((o, i) => o.wait > 0 ? `<div class="order wait">New order in <b data-ordwait="${i}">${fmtReal(o.wait)}</b></div>` : `<div class="order"><div class="who"><img src="${svgUrl(ART[o.face + ":base"])}" alt=""><div><b>${o.who}</b><small>needs these soon</small></div></div><div class="needs">${o.items.map(([id, n]) => `<span class="oneed ${owned(id) >= n ? "ok" : "no"}"><img src="${icon(id)}" alt="">${owned(id)}/${n} ${CROP[id].n}</span>`).join("")}</div><div class="rw"><span>+${o.leaves} ${L} · +${o.xp} XP${o.bonus ? ` · +1 ${{ norm: "Fertilizer", super: "Super Fertilizer", gold: "Gold Fertilizer" }[o.bonus]}` : ""}</span><span style="display:flex;gap:6px"><button type="button" class="btn-s ghost" data-ordskip="${i}">Skip</button><button type="button" class="btn-s green" data-ord="${i}" ${canFill(o) ? "" : "disabled"}>Deliver</button></span></div></div>`).join("") + `</div>`;
    }
    if (sheet === "market") {
      html = head("Farmers' market", "Market", [["sell", "Sell"], ["prices", "Prices"], ["coins", "Coins"]]) + `<div class="sh-body">`;
      if (sheetTab === "sell") { const rows = Object.entries(F.barn).sort((a, b) => price(b[0]) - price(a[0])); html += `<p class="sh-note">Prices change daily. Today <b>${CROP[F.market.hot].n}</b> is in demand. New day in <b data-mkt>${fmtReal(F.market.until)}</b>.</p>` + (rows.length ? rows.map(([k, n]) => { const [id, mut] = k.split("|"), c = CROP[id], m = F.market.mult[id]; return `<div class="item" style="--rc:${RC[c.rar]}"><span class="ic"><img src="${icon(id)}" alt=""></span><div><b>${c.n} ×${n}</b><small>${mut ? mut.split("+").map(x => `<span class="mut ${MUTS[x].cls}">${MUTS[x].n} ×${MUTS[x].x}</span>`).join(" ") + " · " : ""}<span class="price">${price(k)} ${L}</span> each <span class="trend ${id === F.market.hot ? "fire" : m.m >= m.prev ? "up" : "down"}">${id === F.market.hot ? "HOT" : m.m >= m.prev ? "▲" : "▼"} ×${m.m.toFixed(2)}</span></small></div><div class="acts"><button type="button" class="btn-s ghost b-sell1" data-sell="${k}" data-n="1">Sell 1</button><button type="button" class="btn-s b-sellall" data-sell="${k}" data-n="${n}">Sell all · ${(price(k) * n).toLocaleString("en-US")}</button></div></div>`; }).join("") : `<p class="sh-note">Your barn is empty. Harvest something and come back.</p>`); }
      if (sheetTab === "prices") html += `<p class="sh-note">Prices go up and down every day. Sell when the price is high.</p>` + CROPS.filter(c => c.lv <= F.lv + 3).map(c => { const m = F.market.mult[c.id]; return `<div class="item${c.lv > F.lv ? " locked" : ""}"><span class="ic"><img src="${icon(c.id)}" alt=""></span><div><b>${c.n}</b><small>Base ${c.sell} → today <span class="price">${Math.round(c.sell * m.m)} ${L}</span></small></div><span class="trend ${c.id === F.market.hot ? "fire" : m.m >= m.prev ? "up" : "down"}">${c.id === F.market.hot ? "HOT" : m.m >= m.prev ? "▲" : "▼"} ×${m.m.toFixed(2)}</span></div>`; }).join("");
      if (sheetTab === "coins") html += `<p class="sh-note">Trade Gold Leaves for <b>Arena coins</b> to buy skins. There is a daily cap, so farming never replaces playing matches.</p><div class="item"><span class="ic">${I("coin")}</span><div><b>100 ${L} → 5 coins</b><small>Traded today: ${F.coinsToday}/40 coins</small><div class="cap"><i style="width:${F.coinsToday / 40 * 100}%"></i></div></div><div class="acts"><button type="button" class="btn-s" data-coins ${ECON.leaves < 100 || F.coinsToday >= 40 ? "disabled" : ""}>Trade</button></div></div>`;
      html += `</div>`;
    }
    if (sheet === "barn") {
      const rows = Object.entries(F.barn);
      html = head("Barn storage", "Barn") + `<div class="sh-body"><div class="item"><span class="ic">${I("barn")}</span><div><b>${barnUsed()}/${F.barnCap} spaces</b><div class="cap"><i style="width:${barnUsed() / F.barnCap * 100}%"></i></div></div><div class="acts"><button type="button" class="btn-s ghost" data-goto="shop:tools">Upgrade</button></div></div>
        <div class="item"><span class="ic">${I("seed")}</span><div><b>Seeds</b><small>${CROPS.filter(c => F.seeds[c.id]).map(c => `${c.n} ×${F.seeds[c.id]}`).join(" · ") || "No seeds"}</small></div></div>
        <div class="item"><span class="ic">${I("fert")}</span><div><b>Fertilizer</b><small>Regular ×${F.ferts.norm} · Super ×${F.ferts.super} · Gold ×${F.ferts.gold}</small></div></div>
        ${rows.map(([k, n]) => { const [id, mut] = k.split("|"); return `<div class="item"><span class="ic"><img src="${icon(id)}" alt=""></span><div><b>${CROP[id].n} ×${n}</b><small>${mut ? mut.split("+").map(x => `<span class="mut ${MUTS[x].cls}">${MUTS[x].n}</span>`).join(" ") : "Regular"} · ${price(k)} ${L} each</small></div><div class="acts"><button type="button" class="btn-s ghost" data-goto="market:sell">Sell</button></div></div>`; }).join("")}
        <p class="sh-note">Regular crops double as treats to <b>throw in the Plaza</b> (key T).</p></div>`;
    }
    if (sheet === "book") {
      const found = CROPS.filter(c => F.seen[c.id]).length, M = [[5, `+100 ${L}`], [10, "Gold Fertilizer ×2"], [15, "Golden Voltkit Statue"], [20, `+1000 ${L}`], [25, "Arena title: Elemental Farmer"]];
      html = head("Farmer's almanac", sheetTab === "mastery" ? "Crop mastery" : `Crop book ${found}/25`, [["book", "Crop book"], ["mastery", "Mastery"]]) + (sheetTab === "mastery" ? masteryHTML() : `<div class="sh-body"><p class="sh-note">Harvest a crop to log it. The 6 dots are the mutations you have found: Gold, Rainbow, Shocked, Moonlit, Frozen, Wet.</p><div class="book">${CROPS.map(c => { const s = F.seen[c.id]; return `<div class="bk${s ? "" : " unk"}" title="${s ? c.n : `Unlocks at Lv ${c.lv}`}"><img src="${icon(c.id)}" alt=""><span>${s ? c.n : `??? · Lv ${c.lv}`}</span><span class="muts">${MUT_ORDER.map(m => `<i class="${s?.has(m) ? `on ${MUTS[m].cls}` : ""}"></i>`).join("")}</span></div>`; }).join("")}</div><h4 style="margin:.4em 0 0;font-family:var(--display);text-transform:uppercase">Collection rewards</h4><div class="miles">${M.map(([n, r]) => `<div class="mile${found >= n ? " done" : ""}"><span>${found >= n ? "✓" : "○"} ${n} crops</span><span>${r}</span></div>`).join("")}</div></div>`);
    }
    if (sheet === "decor") {
      html = head("Decorate", `Charm ${beauty()} · +${xpBonus()}% XP`) + `<div class="sh-body"><p class="sh-note">${F.decorPick ? `<b>Placing ${DECO[F.decorPick].n}:</b> click a glowing spot on the farm. A spot that already has decor is replaced.` : "Buy decor and place it in the 8 spots around the farm. Every 2 Charm gives +1% XP (up to 25%)."}</p>` + DECOR.map(d => { const lock = d.lv > F.lv; return `<div class="item${lock ? " locked" : ""}"><span class="ic">${I({ planter: "flower", lamp: "lamp", bush6: "rose", bush7: "fern", rock: "rock", crates: "crate", pine: "pine", apple: "apple", tower: "gazebo", plum: "house", statue: "statue" }[d.id])}</span><div><b>${d.n}</b><small>+${d.beauty} Charm${lock ? ` · <b style="color:#ffd65b">unlocks at Lv ${d.lv}</b>` : ""}</small></div><div class="acts"><button type="button" class="btn-s${F.decorPick === d.id ? " green" : ""}" data-deco="${d.id}" ${lock || ECON.leaves < d.cost ? "disabled" : ""}>${F.decorPick === d.id ? "Placing…" : `${d.cost.toLocaleString("en-US")} ${L}`}</button></div></div>`; }).join("") + `<div class="item"><span class="ic">${I("broom")}</span><div><b>Put decor away</b><small>Click "Remove", then click an item on the farm</small></div><div class="acts"><button type="button" class="btn-s ghost" data-deco="__remove">${F.decorPick === "__remove" ? "Removing…" : "Remove"}</button></div></div></div>`;
    }
    if (sheet === "friends") {
      html = head("Neighbors", "Friends") + `<div class="sh-body"><p class="sh-note">Visit a friend to <b>catch bugs and water</b> (+XP) or <b>sneak</b> 1 crop from each ripe plot. Watch out for guard dogs! You get 3 pranks and 1 seed gift a day.</p>` + FRIENDS.map((f, i) => { const pests = f.plots.reduce((a, p) => a + p.pests, 0), ripe = f.plots.filter((p, j) => p.crop && p.prog >= 1 && !f.stolen.has(j)).length; return `<div class="fr"><img src="${svgUrl(ART[f.face + ":base"])}" alt=""><div><b>${f.n} · Lv ${f.lv}</b><small>${pests ? `<span class="bd">${I("bug")} ${pests} bugs</span> · ` : ""}${ripe ? `<span class="bd">${I("wheat")} ${ripe} ripe</span> · ` : ""}${f.dog && f.dog.until > 0 ? `${I("dog")} ${DOGS[f.dog.type].n}` : "no dog"}</small></div><button type="button" class="btn-s${F.visiting === i ? " green" : ""}" data-visit="${i}">${F.visiting === i ? "Here now" : "Visit"}</button></div>`; }).join("") + `<h4 style="margin:.4em 0 0;font-family:var(--display);text-transform:uppercase">Farm log</h4>${F.log.slice(0, 8).map(l => `<p class="sh-note" style="margin:0">${l.html}</p>`).join("") || `<p class="sh-note">Nothing yet.</p>`}</div>`;
    }
    el.innerHTML = html;
    const b = el.querySelector(".sh-body"); if (b) b.scrollTop = top;
    el.querySelectorAll("[data-dogprev]").forEach(c => { const g = c.getContext("2d"); g.clearRect(0, 0, 120, 120); GFX.dog(g, BREED[c.dataset.dogprev], "sit", 0, 54, 108, 1.7, 1); });
  }
  function updateSheetTimers() { const r = $("fm-restock"); if (r) r.textContent = fmtReal(F.shop.at); const m = $("fm-sheet").querySelector("[data-mkt]"); if (m) m.textContent = fmtReal(F.market.until); $("fm-sheet").querySelectorAll("[data-ordwait]").forEach(el => el.textContent = fmtReal(F.orders[+el.dataset.ordwait].wait)); }
  const price = k => { const [id, mut] = k.split("|"), c = CROP[id]; return Math.max(1, Math.round(c.sell * F.market.mult[id].m * (1 + .04 * (F.mast[id] || 0)) * (mut ? mutX(mut.split("+")) : 1))); };
  const canFill = o => o.items.every(([id, n]) => owned(id) >= n);
  function take(id, n) { const keys = Object.keys(F.barn).filter(k => k.startsWith(id + "|")).sort((a, b) => price(a) - price(b)); for (const k of keys) { const t = Math.min(n, F.barn[k]); addBarn(id, k.split("|")[1], -t); n -= t; if (!n) break; } }

  $("fm-sheet").addEventListener("click", e => {
    const t = e.target.closest("button, a"); if (!t) return; const d = t.dataset;
    if ("close" in d) return closeSheet();
    if (d.tab) { sheetTab = d.tab; return renderSheet(); }
    if (d.goto) { const [s, tab] = d.goto.split(":"); return openSheet(s, tab); }
    if (d.buyseed) { const c = CROP[d.buyseed], n = +d.n; ECON.leaves -= c.cost * n; F.shop.stock[c.id] -= n; F.seeds[c.id] = (F.seeds[c.id] || 0) + n; F.seed = c.id; updateWallet(); toast(`Bought ${n} ${c.n} seed${n > 1 ? "s" : ""}`); renderTools(); return renderSheet(); }
    if (d.buytool) {
      const cost = +d.cost; ECON.leaves -= cost; updateWallet();
      const id = d.buytool; let msg = "";
      if (id === "can2") { F.can = 2; msg = "Copper Can"; } if (id === "can3") { F.can = 3; msg = "Gold Can"; } if (id === "net2") { F.net = 2; msg = "Big Net"; } if (id === "sickle") { F.sickle = true; msg = "Sickle"; } if (id === "scarecrow") { F.scarecrow = true; msg = "Scarecrow"; }
      if (id === "sprinkler") { const r = F.sprinklers.indexOf(false); F.sprinklers[r] = true; msg = `Sprinkler for row ${r + 1}`; }
      if (id === "fnorm") { F.ferts.norm += 3; msg = "3 Fertilizer"; } if (id === "fsuper") { F.ferts.super++; msg = "Super Fertilizer"; } if (id === "fgold") { F.ferts.gold++; msg = "Gold Fertilizer"; }
      if (id === "barn") { F.barnCap += 40; F.barnUp++; msg = "Barn +40"; }
      toast(`Bought ${msg}`); log(`Bought <b>${msg}</b>`); renderTools(); renderChips(); return renderSheet();
    }
    if (d.mast) { const c = CROP[d.mast], st = (F.mast[c.id] || 0) + 1, cost = mastCost(c, st); ECON.leaves -= cost; updateWallet(); F.mast[c.id] = st; toast(`${c.n} ★${st}: sells +${st * 4}%`); log(`Mastered <b>${c.n}</b> ★${st}`, "good"); return renderSheet(); }
    if (d.landbuy) return landClick(+d.landbuy);
    if ("pasture" in d) { ECON.leaves -= 900; updateWallet(); F.pasture = true; COW.milk = 20; FX.push({ puff: 1, x: 1600, y: 560, t: 0, life: .8 }); float(1600, 520, "New pasture!", "#7ff0a2"); log("Opened the <b>Pasture</b>. Your cow has moved in", "good"); gainXP(30); return renderSheet(); }
    if (d.dog) {
      const k = d.dog, days = +d.days, active = dogOn() && F.dog.type === k, cost = active ? DOGS[k].p1 : days === 3 ? DOGS[k].p3 : DOGS[k].p1;
      ECON.leaves -= cost; updateWallet();
      if (active) { F.dog.until += DAY; F.dog.total = (F.dog.total || DAY) + DAY; } else F.dog = { type: k, until: DAY * days, total: DAY * days };
      dog.x = DOGH.x - 70; dog.y = DOGH.y + 30; dog.path = []; dog.chasing = false; toast(active ? `${DOGS[k].n} stays 1 more day` : `${DOGS[k].n} is guarding your farm for ${days} day${days > 1 ? "s" : ""}!`); FX.push({ bark: 1, x: 1060, y: 600, t: 0, life: 1.2 }); log(`Hired <b>${DOGS[k].n}</b> to guard the farm`, "good"); renderChips(); return renderSheet();
    }
    if (d.ord != null && d.ord !== undefined && t.dataset.ord !== undefined) { const o = F.orders[+d.ord]; o.items.forEach(([id, n]) => take(id, n)); ECON.leaves += o.leaves; updateWallet(); if (o.bonus) F.ferts[o.bonus]++; gainXP(o.xp); toast(`Delivered to ${o.who}: +${o.leaves} Gold Leaves`); log(`Delivered to <b>${o.who}</b> +${o.leaves} ${L} +${o.xp} XP`, "good"); F.orders[+d.ord] = { wait: 20 }; renderChips(); return renderSheet(); }
    if (d.ordskip != null && t.dataset.ordskip !== undefined) { F.orders[+d.ordskip] = { wait: ORDER_WAIT }; return renderSheet(); }
    if (d.sell) { const k = d.sell, n = +d.n, [id, mut] = k.split("|"), p = price(k) * n; addBarn(id, mut, -n); ECON.leaves += p; updateWallet(); toast(`Sold ${n} ${CROP[id].n} · +${p} Gold Leaves`); renderChips(); return renderSheet(); }
    if ("coins" in d) { ECON.leaves -= 100; F.coinsToday += 5; E.coins += 5; setCoins(); updateWallet(); toast("+5 coins Arena"); return renderSheet(); }
    if (d.deco) { F.decorPick = F.decorPick === d.deco ? null : d.deco; return renderSheet(); }
    if (d.visit) { return visit(+d.visit); }
  });
  $("fm-dock").addEventListener("click", e => { const b = e.target.closest("[data-sheet]"); if (!b) return; if (sheet === b.dataset.sheet) closeSheet(); else openSheet(b.dataset.sheet); if (NH < 500 && dockEl.classList.contains("open")) dockSet(false); });
  $("fm-chips").addEventListener("click", e => {
    const b = e.target.closest("[data-orb]"); if (!b) return;
    orbOpen = orbOpen === b.dataset.orb ? null : b.dataset.orb; renderChips(); if (!orbOpen) $("fm-orbpop").hidden = true;
  });
  $("fm-orbpop").addEventListener("click", e => {
    const go = e.target.closest("[data-orbgo]")?.dataset.orbgo; if (!go) return;
    orbOpen = null; $("fm-orbpop").hidden = true;
    if (go === "dogs") openSheet("shop", "dogs"); else if (go === "barn") openSheet("barn"); else usePerk();
    renderChips();
  });
  // a tap anywhere else closes the card
  document.addEventListener("pointerdown", e => { if (orbOpen && !e.target.closest("#fm-orbpop, #fm-chips")) { orbOpen = null; $("fm-orbpop").hidden = true; renderChips(); } }, true);
  /* side menu: collapsed shows icons, expanded adds names (remembered on this device) */
  const dockEl = $("fm-dock"), dockSet = open => { dockEl.classList.toggle("open", open); const t = dockEl.querySelector(".dk-t"); t.setAttribute("aria-expanded", String(open)); t.innerHTML = `${I(open ? "close" : "menu")}<span>${open ? "Hide names" : "Menu"}</span><b class="dot" id="fm-dock-dot"${$("fm-ord-dot").hidden && $("fm-fr-dot").hidden ? " hidden" : ""}></b>`; try { localStorage.setItem("fmDockOpen", open ? "1" : "0"); } catch { } };
  dockEl.querySelector(".dk-t").addEventListener("click", () => dockSet(!dockEl.classList.contains("open")));
  let dock0 = false; try { dock0 = localStorage.getItem("fmDockOpen") === "1"; } catch { }
  dockSet(dock0);
  $("fm-tools").addEventListener("click", e => {
    const b = e.target.closest("[data-tool]"); if (!b) return; const id = b.dataset.tool;
    if (id === "seed") { if (F.tool === "seed") { const r = b.getBoundingClientRect(), sr = screen.getBoundingClientRect(), k = sr.width / NW; toolPop("seed", (r.left - sr.left) / k, (r.top - sr.top) / k); } F.tool = "seed"; }
    else if (id === "fert") { if (F.tool === "fert") { const r = b.getBoundingClientRect(), sr = screen.getBoundingClientRect(), k = sr.width / NW; toolPop("fert", (r.left - sr.left) / k, (r.top - sr.top) / k); } F.tool = "fert"; }
    else if (id === "gift") { giftPop(b); return; }
    else F.tool = id;
    renderTools();
  });
  function toolPop(kind, x, y) {
    const pop = $("fm-pop"); pop.hidden = false;
    if (kind === "seed") pop.innerHTML = `<h6>Pick a seed to sow</h6><div class="grid">${CROPS.filter(c => F.seeds[c.id]).map(c => `<button type="button" class="opt" data-tseed="${c.id}"><b>${F.seeds[c.id]}</b><img src="${icon(c.id)}" alt=""><span>${c.n}</span></button>`).join("") || `<p class="sh-note">No seeds</p>`}</div>`;
    else pop.innerHTML = `<h6>Pick a fertilizer</h6><div class="grid">${[["norm", "fert", "Regular"], ["super", "fertSuper", "Super"], ["gold", "fertGold", "Gold"]].map(([k, ic, n]) => `<button type="button" class="opt" data-tfert="${k}" ${F.ferts[k] ? "" : "disabled"}><b>${F.ferts[k]}</b>${I(ic, "big")}<span>${n}</span></button>`).join("")}</div>`;
    pop.style.left = `${Math.max(8, Math.min(NW - 308, x - 120))}px`; pop.style.top = `${y - pop.offsetHeight - 10}px`;
    pop.onclick = e => { const s = e.target.closest("[data-tseed]"), f = e.target.closest("[data-tfert]"); if (s) { F.seed = s.dataset.tseed; F.tool = "seed"; } if (f) { F.fert = f.dataset.tfert; F.tool = "fert"; } if (s || f) { pop.hidden = true; renderTools(); screen.focus({ preventScroll: true }); } };
  }
  function giftPop(b) {
    if (!F.gifts) return toast("You already sent a seed gift today");
    const f = FRIENDS[F.visiting], pop = $("fm-pop"), r = b.getBoundingClientRect(), sr = screen.getBoundingClientRect(), k = sr.width / NW; pop.hidden = false;
    pop.innerHTML = `<h6>Give ${f.n} 3 seeds</h6><div class="grid">${CROPS.filter(c => F.seeds[c.id] >= 3).map(c => `<button type="button" class="opt" data-gift="${c.id}"><b>${F.seeds[c.id]}</b><img src="${icon(c.id)}" alt=""><span>${c.n}</span></button>`).join("") || `<p class="sh-note">You need at least 3 of one seed</p>`}</div>`;
    pop.style.left = `${Math.max(8, (r.left - sr.left) / k - 120)}px`; pop.style.top = `${(r.top - sr.top) / k - pop.offsetHeight - 10}px`;
    pop.onclick = e => { const g = e.target.closest("[data-gift]"); if (!g) return; F.seeds[g.dataset.gift] -= 3; F.gifts--; pop.hidden = true; gainXP(5); log(`Gave <b>${f.n}</b> 3 ${CROP[g.dataset.gift].n} seeds +5 XP`, "good"); renderTools(); };
  }
  $("fm-visit").addEventListener("click", e => { if (e.target.closest("[data-home]")) goHome(); });

  /* two-finger pinch zoom on touch screens */
  const touchPts = new Map(); let pinch = null, tipT = 0;
  cv.addEventListener("pointerdown", e => {
    if (e.pointerType !== "touch") return;
    touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPts.size === 2) { e.stopImmediatePropagation(); if (tapG) { clearTimeout(tapG.timer); tapG = null; } endDrag(); panning = null; dragging = false; const [a, b] = [...touchPts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; }
  });
  cv.addEventListener("pointermove", e => {
    if (!touchPts.has(e.pointerId)) return; touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch) return; e.stopImmediatePropagation();
    const [a, b] = [...touchPts.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, m = toWorld((a.x + b.x) / 2, (a.y + b.y) / 2);
    zoomAt(d / pinch.d, m.vx, m.vy); pinch.d = d;
  });
  const dropTouch = e => { touchPts.delete(e.pointerId); if (touchPts.size < 2 && pinch) { pinch = null; panning = null; dragging = false; } };
  cv.addEventListener("pointerup", dropTouch); cv.addEventListener("pointercancel", dropTouch);
  // touch has no hover: tapping a growing crop with the hand shows its card for a moment
  $("fm-weather").addEventListener("click", () => toast($("fm-weather").title));
  if (matchMedia("(pointer: coarse)").matches) $("fm-hint").textContent = "Drag to move · pinch to zoom · hold a plot to plant many";

  /* canvas pointer */
  let dragging = false, lastI = -1;
  /* Touch gestures, like mobile farm games: a quick tap uses the tool / opens the building, a drag always moves
     the map (even when it starts on a plot or a building), press-and-hold then drag paints the tool across plots,
     two fingers zoom. The mouse keeps click-and-drag painting. */
  let tapG = null; const HOLD_MS = 300, MOVE_PX = 10;
  cv.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return press(e);
    if (touchPts.size >= 2) return;
    screen.focus({ preventScroll: true }); $("fm-pop").hidden = true; try { cv.setPointerCapture(e.pointerId); } catch { }
    const ev = { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType };
    if (tapG) clearTimeout(tapG.timer);
    tapG = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), ev, mode: "pending",
      timer: setTimeout(() => { if (tapG && tapG.mode === "pending") { tapG.mode = "paint"; navigator.vibrate?.(12); press(tapG.ev); } }, HOLD_MS) };
  });
  function press(e) {
    screen.focus({ preventScroll: true }); $("fm-pop").hidden = true;
    const w = toWorld(e.clientX, e.clientY), s = cur();
    if (F.decorPick && s.me) { const k = DECO_SLOTS.findIndex(([x, y]) => Math.hypot(w.x - x, (w.y - y) * 2) < 50); if (k >= 0) { if (F.decorPick === "__remove") { if (F.decor[k]) { log(`Put away <b>${DECO[F.decor[k]].n}</b>`); F.decor[k] = null; } } else { const d = DECO[F.decorPick]; ECON.leaves -= d.cost; updateWallet(); F.decor[k] = d.id; FX.push({ puff: 1, x: DECO_SLOTS[k][0], y: DECO_SLOTS[k][1], t: 0, life: .6 }); log(`Placed <b>${d.n}</b> · +${d.beauty} Charm`, "good"); if (ECON.leaves < d.cost) F.decorPick = null; } renderBadge(); renderSheet(); } return; }
    if (s.me && Math.hypot(w.x - WELL.x, w.y - (WELL.y - 50)) < 60) return wishWell();
    if (s.me && w.x > BOARDP.x - 70 && w.x < BOARDP.x + 70 && w.y > BOARDP.y - 140 && w.y < BOARDP.y) return openSheet("orders");
    if (s.me && w.x > STALL.x - 95 && w.x < STALL.x + 95 && w.y > STALL.y - 170 && w.y < STALL.y) return openSheet("market");
    if (s.me && w.x > BARN.x - 110 && w.x < BARN.x + 140 && w.y > BARN.y - 200 && w.y < BARN.y) return openSheet("barn");
    if (s.me && Math.hypot(w.x - DOGH.x, w.y - (DOGH.y - 40)) < 60) return openSheet("shop", "dogs");
    if (s.me && w.x > PAST.x0 && w.x < PAST.x1 && w.y > PAST.y0 && w.y < PAST.y1) return pastureClick();
    const i = plotAt(w.x, w.y);
    if (i < 0) { panning = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, k: NW / cv.getBoundingClientRect().width }; try { cv.setPointerCapture(e.pointerId); } catch { } CUR.grab = true; if (!CUR.on) cv.style.cursor = "grabbing"; return; }
    if (e.pointerType !== "mouse" && F.tool === "hand") { const pl = s.plots[i]; if (pl?.crop && pl.prog < 1) { showTip(i); clearTimeout(tipT); tipT = setTimeout(() => { $("fm-tip").hidden = true; }, 2600); } }
    dragging = true; lastI = i; try { cv.setPointerCapture(e.pointerId); } catch { } CUR.use = 1; useTool(i);
  }
  cv.addEventListener("pointermove", e => {
    if (tapG && tapG.id === e.pointerId && tapG.mode === "pending") {
      if (Math.hypot(e.clientX - tapG.x0, e.clientY - tapG.y0) < MOVE_PX) return;
      clearTimeout(tapG.timer); tapG.mode = "pan"; $("fm-tip").hidden = true;
      panning = { x: tapG.x0, y: tapG.y0, cx: cam.x, cy: cam.y, k: NW / cv.getBoundingClientRect().width }; CUR.grab = true;
    }
    if (panning) { const w0 = toWorld(e.clientX, e.clientY); CUR.vx = w0.vx; CUR.vy = w0.vy; cam.x = panning.cx - (e.clientX - panning.x) * panning.k / (K * Z); cam.y = panning.cy - (e.clientY - panning.y) * panning.k / (K * Z); clampCam(); $("fm-tip").hidden = true; return; }
    const w = toWorld(e.clientX, e.clientY), i = plotAt(w.x, w.y);
    if (i !== hoverI) { hoverI = i; if (i >= 0 && e.pointerType === "mouse") showTip(i); else if (e.pointerType === "mouse") $("fm-tip").hidden = true; }
    CUR.vx = w.vx; CUR.vy = w.vy; CUR.on = e.pointerType === "mouse" && !F.decorPick;
    cv.style.cursor = CUR.on ? "none" : (i >= 0 || F.decorPick ? "pointer" : "default");
    if (dragging && i >= 0 && i !== lastI && ["seed", "can", "net", "sickle", "hand", "fert"].includes(F.tool)) { lastI = i; CUR.use = 1; useTool(i, true); }
  });
  const endDrag = () => { if (combo.n >= 3) { const b = combo.n * 3; gainXP(b, combo.x, combo.y - 50); log(`Harvest combo <b>×${combo.n}</b> · +${b} bonus XP`, "good"); } combo.n = 0; dragging = false; lastI = -1; CUR.grab = false; if (panning) { panning = null; if (!CUR.on) cv.style.cursor = "default"; } };
  cv.addEventListener("wheel", e => { if (!running) return; e.preventDefault(); const w = toWorld(e.clientX, e.clientY); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, w.vx, w.vy); }, { passive: false });
  $("fm-zoom").addEventListener("click", e => { const b = e.target.closest("[data-z]"); if (!b) return; if (b.dataset.z === "in") zoomAt(1.2); else if (b.dataset.z === "out") zoomAt(1 / 1.2); else { Z = Math.max(ZMIN, Math.min(VW / (WW + 120), VH / (WH + 80))); cam = { x: WW / 2, y: WH / 2 }; clampCam(); } });
  screen.addEventListener("keydown", e => { if (S.scene !== "farm" || !running || e.target.closest?.("input, textarea")) return; const k = e.key.toLowerCase(); if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { keysF.add(k); e.preventDefault(); } if (/^[1-9]$/.test(k)) { const list = TOOLS(); const t = list[+k - 1]; if (t) { if (t[0] === "gift") { $("fm-tools").querySelector('[data-tool="gift"]')?.click(); } else { F.tool = t[0]; renderTools(); } } } if (k === "escape") { $("fm-pop").hidden = true; F.tool = "hand"; renderTools(); } if (k === "+" || k === "=") zoomAt(1.2); if (k === "-") zoomAt(1 / 1.2); });
  screen.addEventListener("keyup", e => keysF.delete(e.key.toLowerCase()));
  cv.addEventListener("pointerup", e => {
    if (tapG && tapG.id === e.pointerId) { clearTimeout(tapG.timer); const m = tapG.mode, ev = tapG.ev; tapG = null; if (m === "pending") { press(ev); endDrag(); return; } }
    endDrag();
  });
  cv.addEventListener("pointercancel", e => { if (tapG && tapG.id === e.pointerId) { clearTimeout(tapG.timer); tapG = null; } endDrag(); });
  cv.addEventListener("pointerleave", e => { hoverI = -1; CUR.on = false; if (e.pointerType === "mouse") $("fm-tip").hidden = true; });
  function landClick(i) {
    if (!buyable(i)) return toast("You can only buy plots next to land you own");
    const k = F.land, price = landPrice(k), lvReq = landLv(k), ok = F.lv >= lvReq, rich = ECON.leaves >= price, m = $("fm-modal");
    m.hidden = false;
    m.innerHTML = `<div class="deed"><div class="deed-top">Land deed</div><h5>Buy this plot</h5><div class="deed-plot">${I("sign", "big")}</div><div class="deed-rows"><span>Price</span><b>${price} ${L}</b><span>Requires</span><b class="${ok ? "" : "bad"}">Lv ${lvReq}${ok ? " ✓" : ` (you: Lv ${F.lv})`}</b><span>Your land</span><b>${15 + k} → ${16 + k} plots</b><span>Next plot</span><b>${landPrice(k + 1)} ${L} · Lv ${landLv(k + 1)}</b></div><div class="deed-acts"><button type="button" class="btn-s ghost" data-deedno>Not now</button><button type="button" class="btn-s" data-deedyes ${ok && rich ? "" : "disabled"}>${!ok ? `Needs Lv ${lvReq}` : !rich ? `Need ${price - ECON.leaves} more ${L}` : `Buy · ${price} ${L}`}</button></div></div>`;
    m.querySelector("[data-deedno]").onclick = () => { m.hidden = true; };
    m.querySelector("[data-deedyes]").onclick = () => {
      m.hidden = true; ECON.leaves -= price; updateWallet(); F.plots[i].locked = false; F.land++;
      const r = plotRect(i); for (let a = 0; a < 3; a++) FX.push({ puff: 1, x: r.x + 20 + a * 28, y: r.y + PH / 2, t: a * .1, life: .7 }); float(r.x + PW / 2, r.y, "New land!", "#7ff0a2"); gainXP(10, r.x + PW / 2, r.y + 20);
      log(`Bought a plot (${15 + F.land}/${COLS * ROWS}) · −${price} ${L}`, "good"); if (sheet === "shop") renderSheet(); renderChips();
    };
  }
  function pastureClick() {
    if (!F.pasture) { openSheet("shop", "land"); return; }
    if (COW.milk > 0) return toast(`The cow is grazing. Milk in ${fmtReal(COW.milk)}`);
    if (barnUsed() + 2 > F.barnCap) return toast("Barn is full! Sell something or upgrade the barn.");
    addBarn("milk", "", 2); COW.milk = 80; fly(COW.x, COW.y - 60, icon("milk"), "+2"); gainXP(8, COW.x, COW.y - 70); log("Collected 2 <b>Storm Milk</b>", "good");
  }
  function wishWell() {
    if (!F.wish) return toast("You already made a wish today. Come back tomorrow");
    F.wish = false; const got = [];
    for (let k = 0; k < 3; k++) { const r = Math.random(), pool = CROPS.filter(c => c.lv <= F.lv + (r < .08 ? 15 : 3)); const c = pool[Math.floor(Math.random() * pool.length)]; F.seeds[c.id] = (F.seeds[c.id] || 0) + 1; got.push(c.n); }
    for (let k = 0; k < 10; k++) FX.push({ text: "✦", x: 112 + Math.random() * 60 - 30, y: 500 - Math.random() * 40, t: Math.random() * .3, life: 1, color: "#ffe27a" });
    log(`The well granted: <b>${got.join(", ")}</b>`, "good"); toast(`Wish granted: ${got.join(", ")} seeds`); renderTools();
  }

  /* ---------- public ---------- */
  function renderAll() { renderBadge(); renderWeather(); renderChips(); renderTools(); renderVisit(); }
  // Phones: zoom so the whole field sits between the top HUD rows, the tool bar and the side menu.
  function frameField() {
    const top = 100 / K, bot = 72 / K, right = 68 / K, left = 12 / K;
    Z = Math.max(ZMIN, Math.min(ZMAX, (VW - left - right) / (FW + 40), (VH - top - bot) / (FH + 30)));
    cam.x = FCX + (right - left) / 2 / Z; cam.y = OY + FH / 2 - (top - bot) / 2 / Z; clampCam();
  }
  function resize(nw, nh, ps) { NW = nw; NH = nh; PS = ps; VW = Math.max(1280, Math.round(VH * nw / nh)); ZMIN = Math.max(VW / BW, VH / BH); Z = Math.max(Z, ZMIN); clampCam(); K = Math.min(nw / VW, nh / VH); OFX = (nw - VW * K) / 2; OFY = (nh - VH * K) / 2 + (nw < 1000 ? 0 : 6);
    const phone = nh < 500; if (phone !== wasPhone) { wasPhone = phone; ZMAX = phone ? 2.4 : 1.35; if (phone) frameField(); else { Z = Math.max(ZMIN, .86); cam = { x: OX + FW / 2, y: 520 }; clampCam(); } } cv.width = Math.round(nw * ps); cv.height = Math.round(nh * ps); }
  function enter() { if (!inited) { paintBg(); inited = true; } renderAll(); if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); } }
  function leave() { running = false; keysF.clear(); cancelAnimationFrame(raf); $("fm-tip").hidden = true; $("fm-pop").hidden = true; }
  // background simulation keeps the farm alive while you're elsewhere
  setInterval(() => { if (!running) tick(1); }, 1000);
  ECON.useTreat = () => { const k = Object.keys(F.barn).filter(k => k.endsWith("|")).sort((a, b) => F.barn[b] - F.barn[a])[0]; if (!k) return null; const id = k.split("|")[0]; addBarn(id, "", -1); return id; };
  ECON.treatCount = () => Object.entries(F.barn).filter(([k]) => k.endsWith("|")).reduce((a, [, n]) => a + n, 0);
  ECON.farmStatus = () => ({ ripe: F.plots.filter(p => p.crop && p.prog >= 1).length, pests: F.plots.reduce((a, p) => a + p.pests, 0), dog: dogOn() ? `${DOGS[F.dog.type].n} · ${fmtReal(F.dog.until)} left` : "No guard dog", lv: F.lv, weather: WEATHERS[F.weather.cur] });
  return { enter, leave, resize, save: saveFarm, reset: () => { noSave = true; try { localStorage.removeItem(SAVE_KEY); } catch { } }, _dbg: { dog, FR, blocked, inField, dogRoute, walkPath, GATE, DOGH, clearLine, DECO_SLOTS, F, FRIENDS, CROPS, harvest, plant, useTool, openSheet, landClick, buyable, plotAt: (x, y) => plotAt(x, y), toWorld: (x, y) => toWorld(x, y), plotClient: i => { const r = cv.getBoundingClientRect(), pr = plotRect(i), sp = toScreen(pr.x + PW / 2, pr.y + PH / 2); return { x: r.left + sp.x * r.width / NW, y: r.top + sp.y * r.height / NH }; }, cam: () => ({ ...cam, Z }) } };
})();
