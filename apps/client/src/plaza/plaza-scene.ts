// @ts-nocheck
/*
 * The Plaza scene (hub redesign phase 3). The painting, the props, the
 * animals, the HUD and the touch model are ported from the approved
 * prototype (docs/hub-redesign/prototype/app/plaza.js). What changed: the
 * people are real players (plus four pitch bots and the townsfolk, NPCs who
 * fill a quiet Plaza) that the game server moves;
 * the ball, the Orb Shower, lap times, runway cheers, quests and Volt Boba
 * all come from the server. The browser predicts only your own movement with
 * the same shared step. Ported drawing code is not type-checked line by
 * line; the typed entry point is plaza-screen.ts.
 */
import { CHAT_EMOTES } from "../../../../packages/shared/src/chat";
import { photoIdOf } from "../../../../packages/shared/src/avatars";
import { avatarSrc } from "../portraits";
import { bubbleLines } from "../chat/bubble-text";
import { iconLabel } from "../menu-icons";
/** A chat bubble's text is at most this wide; longer lines wrap. */
const BUBBLE_TEXT_W = 150;
import { syncHubGraphics } from "../hub-graphics";
import { goldenLevel } from "../hub-art/day-light";
import { NightLight } from "../world-light";
import {
  ORB_SHOWER,
  PLAZA,
  PLAZA_BENCHES,
  PLAZA_SIGNPOSTS,
  PLAZA_DECOR,
  PLAZA_BOARD,
  PLAZA_BUSHES,
  PLAZA_CAFE,
  PLAZA_EMOTES,
  PLAZA_FLAG,
  PLAZA_FLOODLIGHTS,
  PLAZA_FOUNTAIN,
  PLAZA_GATE,
  PLAZA_HOUSES,
  PLAZA_HURDLE_SEGMENTS,
  PLAZA_LAMPS,
  PLAZA_LEADER,
  PLAZA_LED,
  PLAZA_PADS,
  PLAZA_PAIR,
  PLAZA_PAIR_EMOTES,
  PLAZA_TREAT_BY_ID,
  PLAZA_PATHS,
  PLAZA_PHOTO,
  PLAZA_PHOTO_CAMERA,
  PLAZA_LANDINGS,
  PLAZA_PITCH,
  PLAZA_POND,
  PLAZA_DOCK,
  PLAZA_QUESTS,
  PLAZA_PLACES,
  plazaPlaceOf,
  PLAZA_ROCKS,
  PLAZA_FISH,
  PLAZA_FISH_RARITY,
  PLAZA_FISH_TITLE,
  PLAZA_FISHING,
  PLAZA_SPAWN,
  PLAZA_SQUARE,
  PLAZA_STAGE,
  PLAZA_TRACK,
  PLAZA_TREES,
  PLAZA_WALK,
  atFountain,
  wishTarget,
  inLapLane,
  inPitch,
  inSquare,
  onRunway,
  orbHeight,
  orbShower,
  plazaBody,
  plazaClear,
  plazaCollide,
  plazaDash,
  plazaJump,
  plazaPairOf,
  plazaStep,
  trackPoint,
  segmentDistance,
  trackPolar,
  plazaPathGap,
} from "../../../../packages/shared/src/plaza";
import {
  fountainBasin,
  fountainTiers,
  waterOf as fountainWater,
} from "./plaza-fountain-art";
import {
  fallenLeaves,
  grassEdge,
  grassLight,
  grit,
  meadowLife,
  pathCobble,
  tuft,
} from "./plaza-ground-art";
import { GFX } from "../hub-art/gfx";
import {
  hubIcon as I,
  hubIconImage as ICON_IMG,
  textWithIcon,
} from "../hub-art/icons";
import {
  FrameRateProbe,
  graphicsSetting,
  rememberAutoLow,
} from "../graphics-quality";
import {
  ALBUM_LIMIT,
  albumImages,
  openAlbum,
  photoDay,
  pictureName,
} from "./plaza-album";
import { bakeSprite } from "./plaza-sprite";
import "./plaza.css";
import { fadeIn } from "../ui/motion";
import { setInner } from "../ui/patch";
import { memoryConstrained, sceneDensity } from "../render-budget";
import { FrameCap } from "../frame-cap";
import { PreviewPerf } from "../preview-perf";
import { sceneLines, setPerfSource } from "../perf-hud";
import { depthSort, slices, spot } from "./plaza-depth";
import { createFightView } from "./plaza-fight-view";
import { plazaPath } from "./plaza-path";
import { mapFrac, mapPinsHtml, paintPlazaMap } from "./plaza-map";
import { PlazaPrediction } from "./plaza-predict";
import {
  FIGHT_IN_SECONDS,
  fishingFrame,
  FISH_SPOT,
  catchCard,
  createFishing,
  fishBook,
} from "./plaza-fishing";
import { PlazaFireworks } from "./plaza-fireworks";
import {
  PLAZA_SPRITE_PX,
  PLAZA_SPRITE_TALL,
  PLAZA_SPRITE_TOP,
  cheerWearer,
  drawWornBehind,
  drawWornFront,
  greetWearer,
} from "./plaza-cosmetics";
import {
  PLAZA_MARGIN,
  PLAZA_SCALE,
  plazaCamClamp,
  plazaZoomAt,
  plazaZoomRange,
  plazaZoomable,
} from "./plaza-surround";
import {
  RIVER_LAMPS,
  paintSurroundings,
  drawFieldLife,
  drawRiver,
  drawRiverLights,
  liveDrawables,
  paintVerge,
} from "./plaza-surround-art";

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const EMOTE_KEYS = PLAZA_EMOTES;
/** Each Plaza emote's quick-chat id (chat.ts). */
const CHAT_EMOTE_OF = Object.fromEntries(
  Object.entries(CHAT_EMOTES).map(([id, e]) => [e, id]),
);

const PLAZA_HTML = `<div class="pz" id="pz">
  <canvas id="pz-cv" aria-label="Plaza"></canvas>
  <div class="pz-hud">
    <div class="pz-banner" id="pz-banner" aria-live="polite"></div>
    <div class="pz-event" id="pz-event" hidden></div>
    <div class="pz-timer glass" id="pz-timer" hidden></div>
    <button type="button" class="pz-clock glass" id="pz-clock" title="Preview day or night">--:--</button>
    <aside class="pz-quests" id="pz-quests"></aside>
    <div class="pz-feed" id="pz-feed" aria-live="polite"></div>
    <div class="pz-runcard glass" id="pz-runcard" hidden></div>
    <div class="pz-joy" id="pz-joy"><div class="ring" id="pz-ring"><div class="knob" id="pz-knob"></div></div></div>
    <div class="pz-left">
      <button type="button" class="pz-round" id="pz-map-btn" aria-label="Plaza map (M)">${I("map")}<small>Map</small></button>
      <button type="button" class="pz-round" id="pz-treat" aria-label="Throw a treat (T)">${I("gift")}<small id="pz-treats">0</small><b class="pz-wishn" id="pz-wishn" hidden></b></button>
      <button type="button" class="pz-round" id="pz-album-btn" aria-label="Photo album">${I("album")}<small>Album</small></button>
    </div>
    <div class="pz-wheel" id="pz-wheel" hidden>
      ${EMOTE_KEYS.map((e, i) => `<button type="button" data-emote="${e}" style="--a:${i}" aria-label="Emote ${e}">${e}</button>`).join("")}
    </div>
    <div class="pz-actions">
      <button type="button" class="pz-act pz-interact" id="pz-interact" hidden></button>
      <button type="button" class="pz-act" id="pz-dash">Dash<small>Shift</small></button>
      <button type="button" class="pz-act big" id="pz-jump">Jump<small>Space</small></button>
    </div>
    <div class="pz-photo" id="pz-photo" hidden></div>
    <div class="pz-album" id="pz-album" role="dialog" aria-modal="true" aria-label="Photo album" hidden>
      <section class="pz-album-panel" id="pz-album-panel">
        <header><b>${I("album")}<span>Album</span></b><span class="pz-album-count" id="pz-album-count" aria-live="polite">0 / ${ALBUM_LIMIT}</span><button type="button" class="x" data-al="close" aria-label="Close the album">✕</button></header>
        <div class="pz-album-grid" id="pz-album-grid"></div>
        <p class="pz-album-note">Saved on this device only · the newest ${ALBUM_LIMIT} are kept</p>
      </section>
      <div class="pz-album-view" id="pz-album-view" hidden></div>
    </div>
    <div class="pz-catch" id="pz-catch" aria-live="polite" hidden></div>
    <div class="pz-fishhud" id="pz-fishhud" hidden>
      <button type="button" class="pz-fish-exit" id="pz-fish-exit" aria-label="Leave fishing (Esc)">✕<span>Leave</span></button>
      <div class="pz-fish-hint" id="pz-fish-hint" aria-live="polite"></div>
      <div class="pz-fish-side">
        <span class="pz-round pz-fish-today" id="pz-fish-today" role="status" aria-label="Fish counted today"></span>
        <button type="button" class="pz-round" id="pz-fish-book2" aria-label="Fish book">${I("fish")}<small>Book</small></button>
      </div>
      <button type="button" class="pz-fish-act" id="pz-fish-act"><svg class="ico-rod" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 27 25 5" stroke="#8a5a32" stroke-width="3" stroke-linecap="round"/><circle cx="9" cy="23" r="3.2" fill="#3a2a1a"/><path d="M25 5q4 9 0 17" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="25" cy="23.5" r="2.6" fill="#ef4f61" stroke="#fff" stroke-width="1"/></svg><b></b><kbd>E</kbd></button>
    </div>
    <div class="pz-fishbook" id="pz-fishbook" role="dialog" aria-modal="true" aria-label="Fish book" hidden>
      <section class="pz-fishbook-panel">
        <header><b>${I("fish")}<span>Fish book</span></b><span class="pz-fishbook-count" id="pz-fishbook-count" aria-live="polite"></span><button type="button" class="x" data-fb="close" aria-label="Close the Fish book">✕</button></header>
        <ul class="pz-fishbook-list" id="pz-fishbook-list"></ul>
        <p class="pz-fishbook-note" id="pz-fishbook-note"></p>
      </section>
    </div>
    <div class="pz-map" id="pz-map" role="dialog" aria-modal="true" aria-label="Plaza map" hidden>
      <section class="pz-map-panel">
        <header><b>${I("map")}<span>Plaza map</span></b><span class="pz-map-hint" id="pz-map-hint">Tap a place to walk there</span><button type="button" class="x" data-map="close" aria-label="Close the map">✕</button></header>
        <div class="pz-map-body">
          <div class="pz-map-view" id="pz-map-view">
            <canvas id="pz-map-cv" aria-hidden="true"></canvas>
            <div class="pz-map-dots" id="pz-map-dots" aria-hidden="true"></div>
            <div class="pz-map-pins" id="pz-map-pins"></div>
          </div>
          <ul class="pz-map-list" id="pz-map-list"></ul>
        </div>
      </section>
    </div>
    <div class="pz-card glass" id="pz-card" role="dialog" aria-label="Player" hidden></div>
    <div class="pz-ask glass" id="pz-ask" role="alertdialog" aria-label="Pair emote request" hidden></div>
    <div class="pz-start" id="pz-start" hidden><b>Plaza</b><span>Click to start</span><div class="pz-keys"><span><kbd>WASD</kbd> move</span><span><kbd>Space</kbd> jump</span><span><kbd>Shift</kbd> dash</span><span><kbd>E</kbd> interact</span><span><kbd>Q</kbd> emote</span><span><kbd>T</kbd> treat</span><span><kbd>M</kbd> map</span><span><kbd>B</kbd> Fish book</span></div></div>
  </div>
</div>`;

export function openPlaza(options) {
  const layer = document.createElement("div");
  layer.className = "plaza-layer";
  layer.tabIndex = -1;
  layer.innerHTML = PLAZA_HTML;
  document.body.append(layer);
  // Each hub scene (Lobby, Plaza) fades in as you switch to it.
  fadeIn([layer], 260);
  const screen = layer;
  const $ = (id) => layer.querySelector(`#${id}`);
  const socket = options.socket;
  const reduced = options.reduced;
  /** Low graphics (slow phones): no ambient animals or night glow, 30 fps. */
  let low = !!options.low;
  // The night's light map (not at Low). Shadows are the round ones under
  // each thing: shadows cast from the sun (drawn at half resolution) blurred
  // the edges beside every fighter, and were taken out.
  const nightLight = new NightLight();
  layer.dataset.graphics = low ? "low" : "high";
  syncHubGraphics();
  layer.dataset.frozen = "false";
  // Auto (Settings → Graphics) watches the frame rate and may switch to Low.
  let probe =
    graphicsSetting() === "auto" && !low ? new FrameRateProbe() : undefined;
  /**
   * Draw at up to 2x on iPhones too (sceneDensity's `sharp`), so fighters
   * and names are crisp. Where Auto finds that too slow, this device steps
   * back to 1.5x for good (SOFT_KEY) before anything goes Low.
   */
  const SOFT_KEY = "ea-plaza-soft";
  let sharp = (() => {
    try {
      return localStorage.getItem(SOFT_KEY) !== "1";
    } catch {
      return true;
    }
  })();
  const pzToast = (m) => options.toast(m);
  const syncPhone = () => {
    layer.classList.toggle("phone", innerHeight < 500);
    layer.classList.toggle("coarse", matchMedia("(pointer: coarse)").matches);
  };
  syncPhone();

  /* ---------- the shared layout, under the prototype's names ---------- */
  const W = PLAZA.width,
    H = PLAZA.height,
    R = PLAZA.radius;
  const SQ = PLAZA_SQUARE,
    FOUNT = PLAZA_FOUNTAIN,
    STAGE = PLAZA_STAGE,
    WALK = PLAZA_WALK,
    LED = PLAZA_LED,
    PITCH = PLAZA_PITCH,
    TRACK = PLAZA_TRACK,
    POND = PLAZA_POND,
    GATE = PLAZA_GATE,
    PADS = PLAZA_PADS,
    PHOTO = PLAZA_PHOTO,
    CAFE = PLAZA_CAFE,
    BOARD = PLAZA_BOARD,
    LEADER = PLAZA_LEADER;
  const HSEG = PLAZA_HURDLE_SEGMENTS;
  const ell = trackPolar,
    trackPt = trackPoint,
    clear = plazaClear;
  const inRunway = (p) => onRunway(p.x, p.y);

  const cv = $("pz-cv"),
    ctx = cv.getContext("2d");
  let NW = 1280,
    NH = 800,
    PS = 1,
    Z = 1,
    cam = { x: SQ.x, y: SQ.y + 120 };
  let running = false,
    started = true,
    ready = false,
    raf = 0,
    last = 0,
    T = 0;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ---------- scenery sprites (positions from the shared layout) ---------- */
  // Houses sized to the fighters: a door about as tall as one (PLAZA_SCALE).
  const HOUSES = PLAZA_HOUSES.map((h) => ({
    ...h,
    spr: GFX.house({
      ...h.o,
      hgt: PLAZA_SCALE.houseWall,
      doorH: PLAZA_SCALE.houseDoor,
    }),
  }));
  const TREES = PLAZA_TREES.map((t, i) => ({
    x: t.x,
    y: t.y,
    k: t.kind,
    t: GFX.tree(t.kind, 11 + i, t.kind === "pine" ? 1 : 0.9 + (i % 3) * 0.08),
    ph: i * 1.7,
  }));
  const BUSHES = PLAZA_BUSHES.map((b) => ({
    x: b.x,
    y: b.y,
    spr: GFX.bush(b.kind, b.seed, b.size),
  }));
  const ROCKS = PLAZA_ROCKS.map((b) => ({
    x: b.x,
    y: b.y,
    spr: GFX.rock(b.seed, b.size),
  }));
  const LAMPS = PLAZA_LAMPS,
    BEDS = [],
    BENCHES = PLAZA_BENCHES,
    FLOOD = PLAZA_FLOODLIGHTS;

  /* ---------- background prerender ---------- */
  const bg = document.createElement("canvas");
  /** Cancels the hidden Plaza's pending ground release (hide/show). */
  let idleRelease;
  const requestIdle = (run) => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 1000);
    return () => clearTimeout(id);
  };
  /**
   * One meadow: the Plaza's ground and the world around it (the river's
   * banks, the woods, the fields: plaza-surround*.ts) are painted as one
   * picture, PLAZA_MARGIN past each edge, so there is no seam where a
   * separate picture would meet it. World (0, 0) is at (GM, GM) in it.
   */
  const GM = PLAZA_MARGIN,
    GW = W + 2 * GM,
    GH = H + 2 * GM;
  bg.width = GW;
  bg.height = GH;
  function paintBg() {
    const g = bg.getContext("2d");
    g.setTransform(1, 0, 0, 1, GM, GM);
    seed = 11;
    // grass: soft gradient, painterly dabs, tufts, clover, little flowers,
    // over the whole meadow at the same density everywhere
    const more = (GW * GH) / (W * H),
      gx = () => -GM + rnd() * GW,
      gy = () => -GM + rnd() * GH;
    g.fillStyle = "#77c25b";
    g.fillRect(-GM, -GM, GW, GH);
    for (let i = 0; i < 70 * more; i++) {
      const x = gx(),
        y = gy(),
        r = 120 + rnd() * 320,
        gr = g.createRadialGradient(x, y, 0, x, y, r),
        c = rnd() < 0.5 ? "150,220,110" : "70,150,70";
      gr.addColorStop(0, `rgba(${c},.28)`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const greens = ["#6cb851", "#82cc63", "#5fae4a", "#8fd46e", "#71bd55"];
    for (let i = 0; i < 26000 * more; i++) {
      const x = gx(),
        y = gy();
      g.fillStyle = greens[i % 5];
      g.beginPath();
      g.ellipse(x, y, 2.4 + rnd() * 2.6, 1.3 + rnd(), rnd() * 3, 0, 7);
      g.fill();
    }
    // Big soft patches of sunlit and shaded grass, as the land rolls.
    grassLight(g, rnd, -GM, -GM, GW, GH, Math.round(26 * more));
    // Tufts: dark at the root, lit at the tips (light from the top left).
    for (let i = 0; i < 2000 * more; i++) tuft(g, rnd, gx(), gy(), 0.8 + rnd() * 0.5);
    // Flowers in drifts, clover patches and dandelion clocks, rather than
    // an even sprinkle of one flower.
    meadowLife(g, rnd, 0, 0, W, H, (x, y) => clear(x, y), 230);
    // Leaves (and the odd fruit) fallen round each tree's foot.
    for (const t of PLAZA_TREES)
      fallenLeaves(g, rnd, t.x, t.y, t.kind, (x, y) => clear(x, y));
    // stone paths: soft bed + rounded cobbles. Drawn in layers (every
    // path's bed, then every path's sand, then the stones) so where paths
    // meet they run into each other instead of one's edge lying on another.
    // One stroke over every path at a width: the canvas paints their union,
    // so overlapping paths don't darken or edge each other where they meet.
    const strokeAll = (extra, style) => {
      g.lineCap = "round";
      g.lineJoin = "round";
      for (const w of new Set(PLAZA_PATHS.map((p) => p.w))) {
        g.strokeStyle = style;
        g.lineWidth = w + extra;
        g.beginPath();
        for (const p of PLAZA_PATHS)
          if (p.w === w)
            p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
      }
    };
    // Landings (where paths arrive) are part of the same bed and sand.
    const landings = (grow, style) => {
      g.fillStyle = style;
      g.beginPath();
      for (const l of PLAZA_LANDINGS) {
        g.moveTo(l.x + l.rx + grow, l.y);
        g.ellipse(l.x, l.y, l.rx + grow, l.ry + grow, 0, 0, Math.PI * 2);
      }
      g.fill();
    };
    strokeAll(18, "rgba(60,90,40,.35)");
    landings(9, "rgba(60,90,40,.35)");
    strokeAll(6, "#d9c9a3");
    landings(3, "#d9c9a3");
    // Grit in the sand: the joints between the stones show it.
    {
      const onSand = (x, y) => plazaPathGap(x, y).gap < -2;
      for (const { pts, w } of PLAZA_PATHS) {
        const xs = pts.map((p) => p[0]),
          ys = pts.map((p) => p[1]),
          x0 = Math.min(...xs) - w / 2,
          y0 = Math.min(...ys) - w / 2,
          bw = Math.max(...xs) - x0 + w / 2,
          bh = Math.max(...ys) - y0 + w / 2;
        grit(g, rnd, x0, y0, bw, bh, onSand, Math.min(9000, (bw * bh) / 60));
      }
    }
    // A worn stone (plaza-ground-art.ts). Stones lie wider than tall
    // whichever way the path runs: the ground is seen at a slant.
    const cobble = (x, y) => pathCobble(g, rnd, x, y);
    // A landing's stones first, in rows; the paths' stones stop at its edge.
    const inLanding = (x, y, inset) =>
      PLAZA_LANDINGS.some(
        (l) =>
          ((x - l.x) / (l.rx - inset)) ** 2 +
            ((y - l.y) / (l.ry - inset)) ** 2 <
          1,
      );
    for (const l of PLAZA_LANDINGS)
      for (let y = l.y - l.ry, row = 0; y <= l.y + l.ry; y += 17, row++)
        for (let x = l.x - l.rx + (row % 2) * 12; x <= l.x + l.rx; x += 24) {
          const sx = x + (rnd() - 0.5) * 4,
            sy = y + (rnd() - 0.5) * 4;
          if (
            ((sx - l.x) / (l.rx - 12)) ** 2 + ((sy - l.y) / (l.ry - 9)) ** 2 <
            1
          )
            cobble(sx, sy);
        }
    /** Segments already paved: a stone that would land on one is left out. */
    const paved = [];
    const onPaved = (x, y) =>
      inLanding(x, y, 2) ||
      paved.some((s) => segmentDistance(x, y, s.a, s.b) < s.w / 2 - 10);
    for (const { pts, w } of PLAZA_PATHS) {
      const mine = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i],
          [x1, y1] = pts[i + 1],
          L = Math.hypot(x1 - x0, y1 - y0),
          ux = (x1 - x0) / L,
          uy = (y1 - y0) / L;
        // Rows across the path, centred on its line: 0, ±24... on even rows
        // and ±12, ±36... on odd ones, as far as a stone stays on the sand.
        for (let d = 0, row = 0; d < L; d += 22, row++)
          for (
            let k =
              -Math.floor((w / 2 - 8 + (row % 2) * 12) / 24) * 24 +
              (row % 2) * 12;
            k <= w / 2 - 8;
            k += 24
          ) {
            const jx = (rnd() - 0.5) * 6,
              jy = (rnd() - 0.5) * 6,
              x = x0 + ux * d - uy * k + jx,
              y = y0 + uy * d + ux * k + jy;
            if (!onPaved(x, y)) cobble(x, y);
          }
        // The segment before this one counts once this one is laid, so a
        // bend's stones don't pile up either.
        mine.push({
          a: { x: x0, y: y0 },
          b: { x: x1, y: y1 },
          w,
        });
        if (mine.length > 1) paved.push(mine[mine.length - 2]);
      }
      paved.push(mine[mine.length - 1]);
    }
    // Grass grown up to the paths' edges, leaning over the sand (not where
    // a path meets another, the square or a landing).
    {
      const edgeAt = (x, y) => {
        const gap = plazaPathGap(x, y).gap;
        return (
          gap > -7 &&
          gap < 2 &&
          !inSquare(x, y, 1.06) &&
          !PLAZA_LANDINGS.some(
            (l) => ((x - l.x) / (l.rx + 8)) ** 2 + ((y - l.y) / (l.ry + 8)) ** 2 < 1,
          )
        );
      };
      for (const { pts, w } of PLAZA_PATHS) grassEdge(g, rnd, pts, w, edgeAt);
    }
    // plaza square: concentric pavers + elemental mosaic
    g.save();
    g.translate(SQ.x, SQ.y);
    g.scale(1, SQ.ry / SQ.rx);
    g.fillStyle = "rgba(60,50,30,.35)";
    g.beginPath();
    g.arc(0, 14, SQ.rx + 16, 0, 7);
    g.fill();
    // The kerb round the square: a raised ring of dressed stone, its
    // front (south) face in shade below a lit top.
    g.fillStyle = "#9a8a6c";
    g.beginPath();
    g.arc(0, 7, SQ.rx + 10, 0, 7);
    g.fill();
    g.fillStyle = "#b9a98a";
    g.beginPath();
    g.arc(0, 0, SQ.rx + 10, 0, 7);
    g.fill();
    // The grout under the pavers: what shows between them.
    g.fillStyle = "#c2b08c";
    g.beginPath();
    g.arc(0, 0, SQ.rx, 0, 7);
    g.fill();
    const tones = ["#f2e8d4", "#e9dcc2", "#efe2c9", "#e2d3b5", "#f6eedd"];
    for (let r0 = 130; r0 < SQ.rx; r0 += 30) {
      const r1 = Math.min(SQ.rx, r0 + 30),
        n = Math.round((2 * Math.PI * r1) / 44),
        off = rnd(),
        edge = r0 > SQ.rx - 40;
      for (let k = 0; k < n; k++) {
        const a0 = ((k + off) / n) * Math.PI * 2,
          a1 = ((k + 1 + off) / n) * Math.PI * 2,
          c = edge
            ? GFX.mix("#d2c2a2", "#c4b391", rnd() * 0.6)
            : tones[Math.floor(rnd() * tones.length)];
        const paver = (i0, i1) => {
          g.beginPath();
          g.arc(0, 0, r1 - i1, a0 + 0.008, a1 - 0.008);
          g.arc(0, 0, r0 + i0, a1 - 0.008, a0 + 0.008, true);
          g.closePath();
        };
        // Each paver: its shaded edge, then its face set up and in from it
        // so a sliver of shade shows on the side away from the light, and a
        // lit edge on the side toward it (the top left).
        paver(2, 2);
        g.fillStyle = GFX.dk(c, 0.14);
        g.fill();
        const mid = (a0 + a1) / 2,
          lx = Math.cos(mid),
          ly = Math.sin(mid),
          // How much this paver's outer edge faces the light (top left).
          face = -(lx + ly) * 0.7071;
        g.save();
        g.translate(-0.8, -1.1);
        paver(2.5, 3);
        g.fillStyle = c;
        g.fill();
        g.restore();
        g.strokeStyle = `rgba(255,255,255,${0.16 + 0.22 * Math.max(0, -face)})`;
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(0, 0, r0 + 3.4, a0 + 0.03, a1 - 0.03);
        g.stroke();
        // Now and then a stain or a chip, so the stones read as worn.
        if (rnd() < 0.18) {
          const ra = a0 + (a1 - a0) * (0.25 + rnd() * 0.5),
            rr = r0 + 6 + rnd() * 18;
          g.fillStyle = "rgba(140,115,75,.16)";
          g.beginPath();
          g.ellipse(
            Math.cos(ra) * rr,
            Math.sin(ra) * rr,
            5 + rnd() * 6,
            3 + rnd() * 3,
            ra,
            0,
            7,
          );
          g.fill();
        }
      }
    }
    g.fillStyle = "#c2b08c";
    g.beginPath();
    g.arc(0, 0, 130, 0, 7);
    g.fill();
    g.fillStyle = "#e9dcc2";
    g.beginPath();
    g.arc(0, 0, 127, 0, 7);
    g.fill();
    const EL = [
      "#ffd84a",
      "#ff7a45",
      "#4fb3ff",
      "#7fe7ff",
      "#fff1a8",
      "#c47dff",
      "#c8955a",
      "#8a6bff",
    ];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      g.save();
      g.rotate(a);
      const ray = () => {
        g.beginPath();
        g.moveTo(0, -60);
        g.lineTo(150, -10);
        g.lineTo(220, 0);
        g.lineTo(150, 10);
        g.lineTo(0, 60);
        g.closePath();
      };
      ray();
      g.fillStyle = GFX.rgba(EL[i], 0.5);
      g.fill();
      // Set in small tiles, with a fine dark edge and a bright spine.
      g.save();
      g.clip();
      g.strokeStyle = "rgba(255,255,255,.28)";
      g.lineWidth = 1;
      g.beginPath();
      for (let t = 14; t < 222; t += 12) {
        g.moveTo(t, -62);
        g.lineTo(t, 62);
      }
      g.moveTo(0, -24);
      g.lineTo(222, -24);
      g.moveTo(0, 24);
      g.lineTo(222, 24);
      g.stroke();
      g.restore();
      ray();
      g.strokeStyle = GFX.rgba(GFX.dk(EL[i], 0.4), 0.55);
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,.55)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(8, 0);
      g.lineTo(212, 0);
      g.stroke();
      g.restore();
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2,
        x = Math.cos(a) * (SQ.rx - 70),
        y = Math.sin(a) * (SQ.rx - 70);
      g.fillStyle = "#a99877";
      g.beginPath();
      g.arc(x + 1, y + 2.5, 25, 0, 7);
      g.fill();
      g.fillStyle = "#f8f2e4";
      g.beginPath();
      g.arc(x, y, 24, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(180,160,120,.7)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, 19.5, 0, 7);
      g.stroke();
      g.fillStyle = GFX.dk(EL[i], 0.25);
      g.beginPath();
      g.arc(x, y, 15, 0, 7);
      g.fill();
      g.fillStyle = EL[i];
      g.beginPath();
      g.arc(x - 0.6, y - 1, 13.6, 0, 7);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.6)";
      g.beginPath();
      g.arc(x - 5, y - 5, 5, 0, 7);
      g.fill();
    }
    g.restore();
    // bounce pads
    PADS.forEach(([x, y]) => {
      g.fillStyle = "rgba(20,25,60,.45)";
      g.beginPath();
      g.ellipse(x, y + 6, 52, 32, 0, 0, 7);
      g.fill();
      g.fillStyle = "#2a3170";
      g.beginPath();
      g.ellipse(x, y + 3, 50, 31, 0, 0, 7);
      g.fill();
      const gr = g.createRadialGradient(x - 12, y - 8, 4, x, y, 48);
      gr.addColorStop(0, "#c8f0ff");
      gr.addColorStop(0.5, "#5f8cff");
      gr.addColorStop(1, "#3a4fd0");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, 47, 29, 0, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.75)";
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x, y, 30, 18, 0, 0, 7);
      g.stroke();
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(x, y - 12);
      g.lineTo(x + 9, y - 2);
      g.lineTo(x + 4, y - 2);
      g.lineTo(x + 4, y + 8);
      g.lineTo(x - 4, y + 8);
      g.lineTo(x - 4, y - 2);
      g.lineTo(x - 9, y - 2);
      g.closePath();
      g.fill();
    });
    // track: rubber surface with lanes
    g.save();
    g.fillStyle = "rgba(60,30,20,.35)";
    g.beginPath();
    g.ellipse(
      TRACK.cx,
      TRACK.cy + 10,
      TRACK.ro[0] + 14,
      TRACK.ro[1] + 14,
      0,
      0,
      7,
    );
    g.fill();
    // The ring: two closed ellipses of exactly one turn each. (Drawn to
    // 7 radians, more than a turn, the overlap and the join between the two
    // cut a wedge out of the lane with "evenodd".)
    g.beginPath();
    g.moveTo(TRACK.cx + TRACK.ro[0], TRACK.cy);
    g.ellipse(TRACK.cx, TRACK.cy, TRACK.ro[0], TRACK.ro[1], 0, 0, Math.PI * 2);
    g.closePath();
    g.moveTo(TRACK.cx + TRACK.ri[0], TRACK.cy);
    g.ellipse(
      TRACK.cx,
      TRACK.cy,
      TRACK.ri[0],
      TRACK.ri[1],
      0,
      0,
      Math.PI * 2,
      true,
    );
    g.closePath();
    const tg = g.createLinearGradient(
      0,
      TRACK.cy - TRACK.ro[1],
      0,
      TRACK.cy + TRACK.ro[1],
    );
    tg.addColorStop(0, "#e8735a");
    tg.addColorStop(1, "#c9503c");
    g.fillStyle = tg;
    g.fill("evenodd");
    g.restore();
    for (let i = 0; i < 3000; i++) {
      const a = rnd() * Math.PI * 2,
        k = rnd(),
        p = trackPt(a, k);
      g.fillStyle =
        rnd() < 0.5 ? "rgba(255,255,255,.08)" : "rgba(80,20,10,.08)";
      g.fillRect(p.x, p.y, 2, 2);
    }
    g.strokeStyle = "#fff5ea";
    g.lineWidth = 4;
    [TRACK.ro, TRACK.ri].forEach(([a, b]) => {
      g.beginPath();
      g.ellipse(TRACK.cx, TRACK.cy, a, b, 0, 0, 7);
      g.stroke();
    });
    g.lineWidth = 2.5;
    g.strokeStyle = "rgba(255,245,234,.7)";
    [1 / 3, 2 / 3].forEach((k) => {
      g.beginPath();
      g.ellipse(
        TRACK.cx,
        TRACK.cy,
        TRACK.ri[0] + (TRACK.ro[0] - TRACK.ri[0]) * k,
        TRACK.ri[1] + (TRACK.ro[1] - TRACK.ri[1]) * k,
        0,
        0,
        7,
      );
      g.stroke();
    });
    const y0 = TRACK.cy - TRACK.ro[1],
      y1 = TRACK.cy - TRACK.ri[1];
    for (let y = y0, i = 0; y < y1; y += 12, i++)
      for (let k = 0; k < 3; k++) {
        g.fillStyle = (i + k) % 2 ? "#1c1c24" : "#fafafa";
        g.fillRect(TRACK.cx - 18 + k * 12, y, 12, 12);
      }
    {
      // Lane numbers just past the start line, and arrows the way you run.
      g.font = "800 22px 'Barlow Condensed', sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(255,245,234,.85)";
      const lw = (TRACK.ro[1] - TRACK.ri[1]) / 3;
      for (let k = 0; k < 3; k++) {
        const y = TRACK.cy - TRACK.ri[1] - lw * (k + 0.5);
        g.fillText(String(k + 1), TRACK.cx + 42, y + 1);
        g.beginPath();
        g.moveTo(TRACK.cx + 66, y - 5);
        g.lineTo(TRACK.cx + 78, y);
        g.lineTo(TRACK.cx + 66, y + 5);
        g.closePath();
        g.fill();
      }
      g.textBaseline = "alphabetic";
    }
    g.save();
    g.beginPath();
    g.ellipse(TRACK.cx, TRACK.cy, TRACK.ri[0] - 3, TRACK.ri[1] - 3, 0, 0, 7);
    g.clip();
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? "rgba(140,210,100,.35)" : "rgba(80,150,60,.25)";
      g.fillRect(TRACK.cx - 270 + i * 54, TRACK.cy - 180, 54, 360);
    }
    g.restore();
    // The infield's kerb: a low concrete ring just inside the lane, lit
    // on its top, with the infield in its shadow along the north side.
    g.save();
    g.lineWidth = 7;
    g.strokeStyle = "rgba(30,60,30,.25)";
    g.beginPath();
    g.ellipse(TRACK.cx + 1, TRACK.cy + 4, TRACK.ri[0] - 7, TRACK.ri[1] - 7, 0, 0, 7);
    g.stroke();
    g.lineWidth = 6;
    g.strokeStyle = "#d9d6cc";
    g.beginPath();
    g.ellipse(TRACK.cx, TRACK.cy, TRACK.ri[0] - 5, TRACK.ri[1] - 5, 0, 0, 7);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = "#f6f4ee";
    g.beginPath();
    g.ellipse(TRACK.cx - 0.6, TRACK.cy - 1.2, TRACK.ri[0] - 5, TRACK.ri[1] - 5, 0, 0, 7);
    g.stroke();
    g.restore();
    // The lane's rubber worn paler where runners run (lane 1's line).
    g.save();
    g.lineWidth = 16;
    g.strokeStyle = "rgba(255,200,170,.07)";
    g.beginPath();
    g.ellipse(TRACK.cx, TRACK.cy, TRACK.ri[0] + 22, TRACK.ri[1] + 22, 0, 0, 7);
    g.stroke();
    g.restore();
    g.font = "800 50px 'Barlow Condensed', sans-serif";
    g.textAlign = "center";
    g.fillStyle = "rgba(255,255,255,.88)";
    g.fillText("DASH TRACK", TRACK.cx, TRACK.cy + 18);
    // pitch
    g.fillStyle = "rgba(30,60,30,.4)";
    g.beginPath();
    g.roundRect(
      PITCH.x0 - 34,
      PITCH.y0 - 30,
      PITCH.x1 - PITCH.x0 + 68,
      PITCH.y1 - PITCH.y0 + 60,
      18,
    );
    g.fill();
    g.fillStyle = "#4fa443";
    g.beginPath();
    g.roundRect(
      PITCH.x0 - 28,
      PITCH.y0 - 24,
      PITCH.x1 - PITCH.x0 + 56,
      PITCH.y1 - PITCH.y0 + 48,
      16,
    );
    g.fill();
    // Mown in a chequer, as stadium grass is: stripes across, fainter
    // stripes down, and the grain of the blades over it.
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? "#5fb951" : "#56ad48";
      g.fillRect(
        PITCH.x0 + (i * (PITCH.x1 - PITCH.x0)) / 10,
        PITCH.y0,
        (PITCH.x1 - PITCH.x0) / 10 + 1,
        PITCH.y1 - PITCH.y0,
      );
    }
    for (let j = 0; j < 8; j++) {
      if (j % 2) continue;
      g.fillStyle = "rgba(255,255,255,.045)";
      g.fillRect(
        PITCH.x0,
        PITCH.y0 + (j * (PITCH.y1 - PITCH.y0)) / 8,
        PITCH.x1 - PITCH.x0,
        (PITCH.y1 - PITCH.y0) / 8,
      );
    }
    for (let i = 0; i < 1600; i++) {
      g.fillStyle =
        rnd() < 0.5 ? "rgba(30,80,30,.18)" : "rgba(200,255,170,.14)";
      g.fillRect(
        PITCH.x0 + rnd() * (PITCH.x1 - PITCH.x0),
        PITCH.y0 + rnd() * (PITCH.y1 - PITCH.y0),
        1.2,
        3,
      );
    }
    // Worn grass in each goalmouth, where everyone stands.
    for (const gx of [PITCH.x0 + 26, PITCH.x1 - 26]) {
      const wg = g.createRadialGradient(
        gx,
        (PITCH.gy0 + PITCH.gy1) / 2,
        4,
        gx,
        (PITCH.gy0 + PITCH.gy1) / 2,
        60,
      );
      wg.addColorStop(0, "rgba(160,130,70,.35)");
      wg.addColorStop(1, "rgba(160,130,70,0)");
      g.fillStyle = wg;
      g.fillRect(gx - 60, PITCH.gy0 - 20, 120, PITCH.gy1 - PITCH.gy0 + 40);
    }
    g.strokeStyle = "#f6fff2";
    g.lineWidth = 5;
    g.strokeRect(PITCH.x0, PITCH.y0, PITCH.x1 - PITCH.x0, PITCH.y1 - PITCH.y0);
    const pcx = (PITCH.x0 + PITCH.x1) / 2,
      pcy = (PITCH.y0 + PITCH.y1) / 2;
    g.beginPath();
    g.moveTo(pcx, PITCH.y0);
    g.lineTo(pcx, PITCH.y1);
    g.stroke();
    g.beginPath();
    g.ellipse(pcx, pcy, 78, 52, 0, 0, 7);
    g.stroke();
    g.fillStyle = "#f6fff2";
    g.beginPath();
    g.arc(pcx, pcy, 5, 0, 7);
    g.fill();
    g.strokeRect(PITCH.x0, PITCH.gy0 - 50, 96, PITCH.gy1 - PITCH.gy0 + 100);
    g.strokeRect(
      PITCH.x1 - 96,
      PITCH.gy0 - 50,
      96,
      PITCH.gy1 - PITCH.gy0 + 100,
    );
    {
      // Penalty spots, the arcs at the boxes and the corner arcs.
      const my = (PITCH.gy0 + PITCH.gy1) / 2;
      g.fillStyle = "#f6fff2";
      for (const px of [PITCH.x0 + 70, PITCH.x1 - 70]) {
        g.beginPath();
        g.ellipse(px, my, 4, 3, 0, 0, 7);
        g.fill();
      }
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(PITCH.x0 + 70, my, 54, 36, 0, -1.0, 1.0);
      g.stroke();
      g.beginPath();
      g.ellipse(PITCH.x1 - 70, my, 54, 36, 0, Math.PI - 1.0, Math.PI + 1.0);
      g.stroke();
      for (const [cx, cy, a0] of [
        [PITCH.x0, PITCH.y0, 0],
        [PITCH.x1, PITCH.y0, Math.PI / 2],
        [PITCH.x1, PITCH.y1, Math.PI],
        [PITCH.x0, PITCH.y1, -Math.PI / 2],
      ]) {
        g.beginPath();
        g.ellipse(cx, cy, 14, 10, 0, a0, a0 + Math.PI / 2);
        g.stroke();
      }
    }
    // pond rim stones
    g.fillStyle = "rgba(40,60,40,.35)";
    g.beginPath();
    g.ellipse(POND.x, POND.y + 10, POND.rx + 26, POND.ry + 18, 0, 0, 7);
    g.fill();
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2,
        x = POND.x + Math.cos(a) * (POND.rx + 10),
        y = POND.y + Math.sin(a) * (POND.ry + 8);
      const c = ["#c9cdd6", "#b4b9c4", "#d9dce3"][i % 3];
      g.fillStyle = "#7f8594";
      g.beginPath();
      g.ellipse(x, y + 3, 18, 11, a, 0, 7);
      g.fill();
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(x, y, 17, 10, a, 0, 7);
      g.fill();
    }
    // runway floor & catwalk
    g.fillStyle = "rgba(10,5,25,.5)";
    g.fillRect(
      STAGE.x0 - 10,
      STAGE.y0 + 6,
      STAGE.x1 - STAGE.x0 + 20,
      STAGE.y1 - STAGE.y0 + 24,
    );
    g.fillRect(
      WALK.x0 - 8,
      WALK.y0,
      WALK.x1 - WALK.x0 + 16,
      WALK.y1 - WALK.y0 + 22,
    );
    g.fillStyle = "#231a3d";
    g.fillRect(STAGE.x0, STAGE.y1, STAGE.x1 - STAGE.x0, 18);
    g.fillRect(WALK.x0, WALK.y1, WALK.x1 - WALK.x0, 16);
    const fl = g.createLinearGradient(0, STAGE.y0, 0, STAGE.y1);
    fl.addColorStop(0, "#3a2b66");
    fl.addColorStop(1, "#2a1f4c");
    g.fillStyle = fl;
    g.fillRect(STAGE.x0, STAGE.y0, STAGE.x1 - STAGE.x0, STAGE.y1 - STAGE.y0);
    const fw = g.createLinearGradient(WALK.x0, 0, WALK.x1, 0);
    fw.addColorStop(0, "#2a1f4c");
    fw.addColorStop(0.5, "#3d2d6e");
    fw.addColorStop(1, "#2a1f4c");
    g.fillStyle = fw;
    g.fillRect(WALK.x0, WALK.y0 - 1, WALK.x1 - WALK.x0, WALK.y1 - WALK.y0 + 1);
    {
      // The stage dressed for a show: lacquered boards with a sheen, a gold
      // star in a ring at its centre, and a pink carpet down the catwalk
      // with gold piping. (It was a bare purple floor.)
      const sw = STAGE.x1 - STAGE.x0,
        sh = STAGE.y1 - STAGE.y0,
        scx = (STAGE.x0 + STAGE.x1) / 2,
        scy = (STAGE.y0 + STAGE.y1) / 2;
      g.save();
      g.beginPath();
      g.rect(STAGE.x0, STAGE.y0, sw, sh);
      g.clip();
      g.strokeStyle = "rgba(10,6,24,.35)";
      g.lineWidth = 1;
      for (let y = STAGE.y0 + 11, r = 0; y < STAGE.y1; y += 11, r++) {
        g.beginPath();
        g.moveTo(STAGE.x0, y);
        g.lineTo(STAGE.x1, y);
        g.stroke();
        for (let x = STAGE.x0 + ((r * 53) % 90); x < STAGE.x1; x += 90) {
          g.beginPath();
          g.moveTo(x, y - 11);
          g.lineTo(x, y);
          g.stroke();
        }
      }
      // The sheen: a soft diagonal band of light across the boards.
      const sg = g.createLinearGradient(STAGE.x0, STAGE.y0, STAGE.x1, STAGE.y1);
      sg.addColorStop(0.25, "rgba(255,255,255,0)");
      sg.addColorStop(0.42, "rgba(255,220,255,.12)");
      sg.addColorStop(0.5, "rgba(255,255,255,.04)");
      sg.addColorStop(0.62, "rgba(255,220,255,.1)");
      sg.addColorStop(0.8, "rgba(255,255,255,0)");
      g.fillStyle = sg;
      g.fillRect(STAGE.x0, STAGE.y0, sw, sh);
      g.restore();
      // The star in its ring (flattened: the floor is seen at a slant).
      g.save();
      g.translate(scx, scy + 4);
      g.scale(1, 0.5);
      g.strokeStyle = "rgba(255,214,91,.75)";
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, 0, 70, 0, 7);
      g.stroke();
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, 80, 0, 7);
      g.stroke();
      const star = (r0, r1) => {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5,
            r = i % 2 ? r1 : r0;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
      };
      star(56, 23);
      const st = g.createLinearGradient(0, -56, 0, 56);
      st.addColorStop(0, "#fff1a8");
      st.addColorStop(1, "#e0a020");
      g.fillStyle = st;
      g.fill();
      g.strokeStyle = "#8a5a10";
      g.lineWidth = 2;
      g.stroke();
      g.restore();
      // The catwalk's carpet.
      const cw = 40,
        cx0 = (WALK.x0 + WALK.x1) / 2 - cw / 2;
      const cg = g.createLinearGradient(cx0, 0, cx0 + cw, 0);
      cg.addColorStop(0, "#d04a8a");
      cg.addColorStop(0.5, "#ff7fb8");
      cg.addColorStop(1, "#d04a8a");
      g.fillStyle = cg;
      g.fillRect(cx0, STAGE.y1, cw, WALK.y1 - STAGE.y1);
      g.fillStyle = "#ffd65b";
      g.fillRect(cx0 - 2, STAGE.y1, 2, WALK.y1 - STAGE.y1);
      g.fillRect(cx0 + cw, STAGE.y1, 2, WALK.y1 - STAGE.y1);
      g.fillStyle = "rgba(255,255,255,.18)";
      for (let y = STAGE.y1 + 8; y < WALK.y1 - 6; y += 16)
        g.fillRect(cx0 + 6, y, cw - 12, 2);
      // Steps up at both ends of the stage's front.
      for (const sx of [STAGE.x0 + 30, STAGE.x1 - 90])
        for (let k = 0; k < 2; k++) {
          g.fillStyle = k ? "#3d2d6e" : "#2a1f4c";
          g.fillRect(sx, STAGE.y1 + 18 + k * 9, 60, 9);
          g.fillStyle = "rgba(255,214,91,.6)";
          g.fillRect(sx, STAGE.y1 + 18 + k * 9, 60, 1.5);
        }
    }
    g.strokeStyle = "#ffd65b";
    g.lineWidth = 3;
    g.strokeRect(STAGE.x0, STAGE.y0, STAGE.x1 - STAGE.x0, STAGE.y1 - STAGE.y0);
    g.beginPath();
    g.moveTo(WALK.x0, WALK.y0);
    g.lineTo(WALK.x0, WALK.y1);
    g.lineTo(WALK.x1, WALK.y1);
    g.lineTo(WALK.x1, WALK.y0);
    g.stroke();
    for (let x = STAGE.x0 + 14; x < STAGE.x1; x += 26) {
      g.fillStyle = "#fff4c2";
      g.beginPath();
      g.arc(x, STAGE.y1 + 9, 3, 0, 7);
      g.fill();
    }
    for (let y = WALK.y0 + 14; y < WALK.y1; y += 24) {
      g.fillStyle = "#ff9bd2";
      [WALK.x0 + 8, WALK.x1 - 8].forEach((x) => {
        g.beginPath();
        g.arc(x, y, 2.6, 0, 7);
        g.fill();
      });
    }
    // photo spot pad
    // (On the landing's stones, so a warm outline that shows on them.)
    g.fillStyle = "rgba(255,255,255,.14)";
    g.beginPath();
    g.ellipse(PHOTO.x, PHOTO.y + 30, 74, 40, 0, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(150,110,50,.75)";
    g.setLineDash([8, 8]);
    g.lineWidth = 2.5;
    g.stroke();
    g.setLineDash([]);
    // The flower border along the south fence. (It was rows of vegetable
    // beds, left from the Farm that has gone: now a park's flower walk, a
    // trimmed box hedge with beds of tulips in drifts of one colour.)
    g.fillStyle = "#5fa444";
    g.fillRect(0, GATE.y + 20, W, H - GATE.y - 20);
    {
      const y0 = GATE.y + 34,
        y1 = H - 8;
      const BLOOM = [
        ["#ff6f9a", "#ffd0de"],
        ["#ffd65b", "#fff4b8"],
        ["#ffffff", "#ffe9f2"],
        ["#c47dff", "#ecd6ff"],
        ["#ff8a3d", "#ffd2a8"],
        ["#4fb3ff", "#d3ecff"],
      ];
      for (let x = 30, k = 0; x < W - 30; k++) {
        const w = 150 + ((k * 37) % 60);
        if (Math.abs(x + w / 2 - GATE.x) < 110 + w / 2) {
          x += 40;
          continue;
        }
        // The bed: dark soil inside a clipped box edge.
        g.fillStyle = "#3f8a37";
        g.beginPath();
        g.roundRect(x - 6, y0 - 6, w + 12, y1 - y0 + 12, 14);
        g.fill();
        g.fillStyle = "#6a4a2c";
        g.beginPath();
        g.roundRect(x, y0, w, y1 - y0, 10);
        g.fill();
        g.fillStyle = "rgba(255,255,255,.08)";
        for (let i = 0; i < 40; i++)
          g.fillRect(x + rnd() * w, y0 + rnd() * (y1 - y0), 2, 2);
        // Box hedge highlights along its top edge.
        g.fillStyle = "#5fb34c";
        for (let hx = x; hx < x + w; hx += 12) {
          g.beginPath();
          g.arc(hx + 6, y0 - 4, 5, 0, 7);
          g.fill();
        }
        // Tulips: leaves, then a cup of petals, in rows staggered.
        const [c, hi] = BLOOM[k % BLOOM.length];
        for (let ty = y0 + 12, row = 0; ty < y1 - 4; ty += 14, row++)
          for (let tx = x + 10 + (row % 2) * 8; tx < x + w - 8; tx += 16) {
            const jx = (rnd() - 0.5) * 4,
              jy = (rnd() - 0.5) * 3;
            g.fillStyle = "#3f9a3a";
            g.beginPath();
            g.ellipse(tx + jx - 3, ty + jy + 2, 2, 5, -0.5, 0, 7);
            g.ellipse(tx + jx + 3, ty + jy + 2, 2, 5, 0.5, 0, 7);
            g.fill();
            g.fillStyle = c;
            g.beginPath();
            g.moveTo(tx + jx - 4.5, ty + jy - 6);
            g.lineTo(tx + jx - 2, ty + jy - 3);
            g.lineTo(tx + jx, ty + jy - 7);
            g.lineTo(tx + jx + 2, ty + jy - 3);
            g.lineTo(tx + jx + 4.5, ty + jy - 6);
            g.quadraticCurveTo(tx + jx + 5, ty + jy + 1, tx + jx, ty + jy + 1);
            g.quadraticCurveTo(
              tx + jx - 5,
              ty + jy + 1,
              tx + jx - 4.5,
              ty + jy - 6,
            );
            g.fill();
            g.fillStyle = hi;
            g.fillRect(tx + jx - 2.5, ty + jy - 4, 1.5, 3);
          }
        x += w + 26;
      }
    }
    for (let x = 10; x < W; x += 30) {
      if (Math.abs(x - GATE.x) < 72) continue;
      g.fillStyle = "#9a6a3a";
      g.beginPath();
      g.roundRect(x, GATE.y + 2, 10, 28, 3);
      g.fill();
      g.fillStyle = "#c48a4a";
      g.fillRect(x, GATE.y + 2, 10, 4);
    }
    g.fillStyle = "#b07a42";
    g.fillRect(0, GATE.y + 10, GATE.x - 72, 5);
    g.fillRect(GATE.x + 72, GATE.y + 10, W - GATE.x - 72, 5);
    g.fillRect(0, GATE.y + 21, GATE.x - 72, 4);
    g.fillRect(GATE.x + 72, GATE.y + 21, W - GATE.x - 72, 4);
    // The river bank's verge and railing along the north edge, and the
    // world past the edges.
    paintVerge(g);
    paintSurroundings(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  /** The map board's small picture of the Plaza: made once, with the
   * ground, while the Plaza opens (scaling the whole ground down is the
   * costly part, too slow to do mid-frame on a slow phone). */
  let boardPic = null;
  function prep() {
    paintBg();
    boardPic = paintPlazaMap(bg, GM, 264);
    ready = true;
  }

  /* ---------- people: you (predicted) and everyone the server shows ---------- */
  const art = new Map();
  // The <img> (its src shows in cards and the feed) carries `sprite`, the
  // bitmap the canvas draws once it is painted (see plaza-sprite.ts).
  // `colour`: the all-fighter Skin slot (a palette such as candy-colours),
  // shown when no champion skin is worn, as in battle and on portraits.
  const imageFor = (character, skin, colour = null) => {
    const key = `${character}:${skin?.skin ?? ""}:${skin?.stage ?? 1}:${colour ?? ""}`;
    let im = art.get(key);
    if (!im) {
      im = new Image();
      im.decoding = "async";
      im.src = options.art(character, skin, false, colour);
      im.sprite = null;
      bakeSprite(im, options.art(character, skin, true, colour)).then(
        (sprite) => (im.sprite = sprite),
        () => {},
      );
      art.set(key, im);
    }
    return im;
  };
  const decorate = (b) =>
    Object.assign(b, {
      vx: 0,
      vy: 0,
      z: 0,
      air: 0,
      dash: 0,
      stun: 0,
      face: 1,
      emote: null,
      emoteT: 0,
      sp: 0,
      trail: [],
      dance: 0,
      buff: 0,
    });
  const P = Object.assign(plazaBody(PLAZA_SPAWN.x, PLAZA_SPAWN.y), {
    me: true,
    name: options.playerName(),
    character: options.character,
    skin: null,
    colour: null,
    img: imageFor(options.character, null),
    emote: null,
    emoteT: 0,
    sp: 0,
    trail: [],
    dance: 0,
    buff: 0,
  });
  let meId = 0;
  /** Everyone else in view: profile id → body (smoothed toward the server). */
  const others = new Map();
  const profiles = new Map();
  const nameOf = (id) =>
    id === meId ? P.name : (profiles.get(id)?.name ?? "Someone");
  const imgOf = (id) => (id === meId ? P.img : (others.get(id)?.img ?? P.img));
  const BODIES = () => [P, ...others.values()];
  /** Who draws a skin's ambient particles this frame (pickFullFx). */
  const FULL_FX_NEAREST = 5;
  let fullFx = new Set();
  function pickFullFx() {
    const near = [...others.values()]
      .map((b) => [Math.hypot(b.x - P.x, b.y - P.y), b])
      .sort((a, b) => a[0] - b[0])
      .slice(0, FULL_FX_NEAREST)
      .map((e) => e[1]);
    fullFx = new Set([P, ...near]);
  }
  /** Entrances play for who arrives while you're here, not for everyone
   *  already in the Plaza when you join (a burst for the whole crowd). */
  const enteredAt = performance.now();
  const ARRIVAL_MS = 4000;
  function greetArrival(b) {
    if (b.greeted || performance.now() > (b.arrived ?? 0) + ARRIVAL_MS) return;
    if (!b.entrance && !b.skin?.skin) return;
    b.greeted = true;
    greetWearer(b);
  }
  /** The server's latest position for you, to correct the prediction. */
  let srv = null;
  /** Your sticks, jumps and dashes go out numbered and timed on this clock
   * (ms of steps run), and the server's position is compared with where
   * you were that long after (plaza-predict.ts). */
  const predict = new PlazaPrediction();
  let stepClock = 0;
  /** Number and time the next stick, jump or dash: from where the next step starts. */
  const stamp = () => {
    const t = Math.round(stepClock);
    return { s: predict.send(t), t };
  };
  /** Server clock: Date.now() + offset. */
  let offset = 0;
  const serverNow = () => Date.now() + offset;
  const ball = {
    x: (PITCH.x0 + PITCH.x1) / 2,
    y: (PITCH.y0 + PITCH.y1) / 2,
    z: 0,
    tx: null,
    ty: null,
    tz: 0,
    r: 22,
    spin: 0,
    lock: 0,
  };
  let score = [0, 0];
  const FX = [];
  const DUCKS = ["drake", "hen", "hen", "drake"].map((k, i) => ({
    k,
    a: i * 1.6,
    s: (0.1 + i * 0.02) * (i % 2 ? 1 : -1),
    x: 0,
    y: 0,
    face: 1,
    dab: 0,
    r: 0.4 + (i % 2) * 0.15,
  }));
  const FISH = [0, 1, 2].map((i) => ({
    a: i * 2,
    x: POND.x,
    y: POND.y,
    s: 0.3 + i * 0.1,
    jump: 0,
    c: ["#ff8a3d", "#ffffff", "#ffd65b"][i],
  }));
  const PIGEONS = Array.from({ length: 9 }, (_, i) => {
    const a = i * 0.7 + 1,
      r = 0.35 + (i % 3) * 0.18;
    return {
      x: SQ.x + Math.cos(a) * SQ.rx * r,
      y: SQ.y + Math.sin(a) * SQ.ry * r + 30,
      z: 0,
      st: "idle",
      face: i % 2 ? 1 : -1,
      tx: null,
      ty: null,
      wait: Math.random() * 3,
      fly: 0,
      kind: i === 4 ? "sparrow" : "pigeon",
    };
  });
  const BUTTER = Array.from({ length: 7 }, (_, i) => {
    const h = [...BEDS, ...BUSHES][(i * 2) % (BEDS.length + BUSHES.length)];
    return {
      hx: h.x,
      hy: h.y - 40,
      x: h.x,
      y: h.y - 40,
      ph: i * 1.3,
      c: [
        "#ffd65b",
        "#ffb3d1",
        "#bfe3ff",
        "#ffffff",
        "#c9a3ff",
        "#ffd65b",
        "#ff9b6a",
      ][i],
    };
  });
  let flock = null;
  const CAT = { b: BENCHES[2], awake: 0 };
  // The corgi has no owner here: it trots between spots round the square.
  const PET = {
    x: SQ.x,
    y: SQ.y + 100,
    face: 1,
    st: "idle",
    breed: "corgi",
    bark: 0,
    tx: null,
    ty: null,
    wait: 2,
  };
  const SMOKE = [];
  let sized = false;
  /* the wishing fountain (PLAZA_WISH): this copy's meter and its fireworks */
  const wish = { n: 0, target: 0 };
  /** Players in this copy (the state's count), for an empty meter's goal. */
  let population = 1;
  const fireworks = new PlazaFireworks();
  fireworks.setLevel(low, reduced);
  /** The fireworks' own drawing time (ms), for the frame-rate test. */
  const fwCost = { frames: 0, ms: 0, max: 0 };
  /** Low graphics: the ambient animals go; the people, ball and orbs stay. */
  function goLow() {
    low = true;
    layer.dataset.graphics = "low";
    syncHubGraphics();
    for (const list of [DUCKS, FISH, PIGEONS, BUTTER, SMOKE]) list.length = 0;
    flock = null;
    fireworks.setLevel(true, reduced);
    // Redraw at 1x (before the first resize, that sizes it anyway).
    if (sized) resize();
  }
  if (low) goLow();
  let claps = 0,
    runwayOn = false,
    bannerT = 0;
  // Time of day follows the device clock; the clock button previews day or night for 2 minutes.
  const realTod = () => {
    const d = new Date();
    return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
  };
  let tod = realTod(),
    todHold = 0;

  /* ---------- the Orb Shower (server orbs) ---------- */
  const ORB_COLORS = [
    "#ffd84a",
    "#ff7a45",
    "#4fb3ff",
    "#7fe7ff",
    "#c47dff",
    "#8a6bff",
  ];
  const orbs = new Map();
  let shower = null,
    caughtThisShower = 0;
  const ev = {
    get on() {
      return orbShower(serverNow()).on;
    },
    get orbs() {
      return [...orbs.values()];
    },
  };
  socket.on("plaza-orbs", onOrbs);
  function onOrbs(o) {
    if (o.reset || o.shower !== shower) {
      if (o.shower !== shower) caughtThisShower = 0;
      shower = o.shower;
      if (o.reset) orbs.clear();
    }
    for (const [id, x, y, at] of o.add)
      orbs.set(id, {
        id,
        x,
        y,
        at,
        z: ORB_SHOWER.height,
        c: pick(ORB_COLORS),
        landed: false,
      });
    for (const [id, who] of o.gone) {
      const orb = orbs.get(id);
      orbs.delete(id);
      if (!orb || !who) continue;
      burst(orb.x, orb.y, 20, "✦", 6, orb.c, 0.6);
      if (who === meId) {
        caughtThisShower++;
        if (
          caughtThisShower <= ORB_SHOWER.perShower &&
          (progress?.orbsToday ?? 0) < ORB_SHOWER.perDay
        )
          FX.push({
            text: "+1",
            icon: "orb",
            x: orb.x,
            y: orb.y - 40,
            t: 0,
            life: 0.9,
            small: 1,
          });
      }
    }
  }

  /* ---------- Plaza today (quests) and TOP DASH, from the server ---------- */
  let progress = null;
  /**
   * Plaza today: a round button, as the Lobby rail's Missions, with the
   * quests still to do on a blue badge and the day's progress as a ring
   * round it. A tap opens the list over it, wide enough that a quest reads
   * on one line, its progress and coins beside it; a row still to do walks
   * you to its place (owner, 22 Nov: the folded pill and its narrow rows
   * broke quests over three lines).
   */
  let questsOpen = false;
  function renderQuests() {
    const box = $("pz-quests");
    const q = progress?.quests;
    const total = PLAZA_QUESTS.length;
    const done = q ? PLAZA_QUESTS.filter((x) => q[x.id]?.done).length : 0;
    const left = PLAZA_QUESTS.filter((x) => !q?.[x.id]?.done).reduce(
      (a, x) => a + x.coins,
      0,
    );
    const todo = total - done;
    box.classList.toggle("open", questsOpen);
    const rows = PLAZA_QUESTS.map((x) => {
      const n = Math.min(q?.[x.id]?.n ?? 0, x.max),
        paid = !!q?.[x.id]?.done,
        place = plazaPlaceOf(x.id),
        shown = paid ? x.max : n;
      const inner = `<span class="ic" aria-hidden="true">${I(place?.icon ?? "star")}</span><span class="tx"><b>${esc(x.text)}</b><span class="pg"><span class="bar"><i style="width:${(shown / x.max) * 100}%"></i></span><small>${shown}/${x.max}</small></span></span><span class="rw">${paid ? `<span class="ok">✓</span>` : `+${x.coins}${I("coin", "coin")}`}</span>`;
      // Go: walk to where it is done (the map's places, shared data).
      return place && !paid
        ? `<li class="pz-q"><button type="button" class="row" data-go="${place.id}" aria-label="${esc(x.text)}, ${shown} of ${x.max}, ${x.coins} coins. Go to ${esc(place.name)}">${inner}<i class="go" aria-hidden="true"></i></button></li>`
        : `<li class="pz-q${paid ? " done" : ""}"><div class="row">${inner}</div></li>`;
    }).join("");
    setInner(
      box,
      `<button type="button" class="pz-round pz-qbtn" data-qopen aria-expanded="${questsOpen}" aria-controls="pz-qpanel" aria-label="Plaza today, ${done} of ${total} done${left ? `, ${left} coins to earn` : ""}" title="Plaza today"><i class="pz-qring" style="--p:${done / total}" aria-hidden="true"></i>${I("quests")}<small>Today</small><b class="pz-qbadge${todo ? "" : " ok"}" aria-hidden="true">${todo || "✓"}</b></button><section class="pz-qpanel glass" id="pz-qpanel" aria-label="Plaza today"${questsOpen ? "" : " hidden"}><header><h5><span class="t">Plaza today</span><span class="n">${done}/${total}</span></h5>${left ? `<span class="c">+${left}${I("coin", "coin")}<small>to earn</small></span>` : `<span class="c ok">All done</span>`}<button type="button" class="x" data-qclose aria-label="Close Plaza today">✕</button></header><ul class="pz-qlist">${rows}</ul></section>`,
    );
  }
  function showQuests(on = !questsOpen) {
    if (questsOpen === on) return;
    questsOpen = on;
    renderQuests();
    if (on) toggleWheel(false);
  }
  $("pz-quests").addEventListener("click", (e) => {
    if (e.target.closest("[data-qopen]")) showQuests();
    else if (e.target.closest("[data-qclose]")) showQuests(false);
    const go = e.target.closest("[data-go]");
    if (go) {
      showQuests(false);
      goToPlace(go.dataset.go);
    }
  });
  function setProgress(p) {
    if (!p?.quests) return;
    const before = progress;
    progress = p;
    let paid = false;
    if (before)
      for (const x of PLAZA_QUESTS)
        if (p.quests[x.id]?.done && !before.quests[x.id]?.done) {
          feed(
            null,
            `Quest complete: <b>${esc(x.text)}</b> · +${x.coins} ${I("coin", "coin")}`,
          );
          pzToast(`+${x.coins} coins`);
          paid = true;
        }
    // Fishing: a first catch pays coins once; the whole book earns a title.
    if (before) {
      for (const f of PLAZA_FISH)
        if (
          p.fishBook?.[f.id] !== undefined &&
          before.fishBook?.[f.id] === undefined
        ) {
          const c = PLAZA_FISH_RARITY[f.rarity].firstCoins;
          feed(
            null,
            `First catch: <b>${esc(f.name)}</b> · +${c} ${I("coin", "coin")}`,
          );
          paid = true;
        }
      if (p.fishTitle && !before.fishTitle) {
        feed(null, `Title earned: <b>${esc(PLAZA_FISH_TITLE.name)}</b>`);
        pzToast(`Fish book complete! Title earned: ${PLAZA_FISH_TITLE.name}`);
      }
    }
    // Quests pay coins on the server: the top bar's balance follows.
    if (paid) options.onCoins?.();
    renderQuests();
    if (fishing.active) renderFishHud();
    if (!$("pz-fishbook").hidden) renderFishBook();
  }
  socket.on("plaza-progress", setProgress);
  const bestLap = () =>
    progress?.bestLapMs ? progress.bestLapMs / 1000 : null;
  /** TOP DASH rows for the board: [name, seconds, me]. */
  const boardRows = () =>
    (progress?.board ?? []).map((r) => [r.name, r.ms / 1000, !!r.me]);

  /* ---------- feed / banner ---------- */
  function feed(id, html) {
    const box = $("pz-feed"),
      d = document.createElement("div");
    const im = id == null ? P.img : imgOf(id);
    d.innerHTML = `<img src="${im?.src ?? ""}" alt=""><span>${html}</span>`;
    box.prepend(d);
    while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => d.classList.add("out"), 5200);
    setTimeout(() => d.remove(), 6000);
  }
  function banner(name, sub, color) {
    const b = $("pz-banner");
    b.style.setProperty("--zc", color);
    b.innerHTML = `<b>${name}</b><i></i><span>${sub}</span>`;
    b.classList.add("on");
    clearTimeout(bannerT);
    bannerT = setTimeout(() => b.classList.remove("on"), 2200);
  }
  socket.on("plaza-news", onNews);
  function onNews(n) {
    const who = n.id === meId ? "You" : `<b>${esc(n.name)}</b>`;
    // Scoring and finishing a lap play the Victory slot (and the skin's
    // celebration), as winning a match does.
    if (n.kind === "goal" || n.kind === "lap") {
      const b = n.id === meId ? P : others.get(n.id);
      if (b) cheerWearer(b, performance.now());
    }
    if (n.kind === "wish") {
      // A feed line, no banner: the banner would hide the fireworks.
      feed(null, "The Plaza's wish came true!");
    } else if (n.kind === "goal") {
      FX.push({ text: "GOAL!", x: ball.x, y: ball.y - 50, t: 0, life: 1.5 });
      burst(
        ball.x,
        ball.y,
        20,
        "✦",
        22,
        n.side === 0 ? "#5ab0ff" : "#ff5d6c",
        1.3,
      );
      if (n.id === meId) pzToast("GOAL! You scored");
      else feed(n.id, `${who} scored a goal on the pitch`);
    } else if (n.kind === "lap") {
      const t = n.ms / 1000,
        best = bestLap(),
        pb = n.id === meId && (best == null || t < best);
      if (n.id === meId) {
        lapShown = { t, until: performance.now() + 2500 };
        pzToast(
          pb ? `New record: ${t.toFixed(2)} s!` : `Finished: ${t.toFixed(2)} s`,
        );
        burst(P.x, P.y, 50, "★", 16, "#ffd65b");
      }
      feed(
        n.id,
        `${who} finished a lap in <b>${t.toFixed(2)} s</b>${pb ? " · new record" : ""}`,
      );
    } else if (n.kind === "runway" && n.id !== meId)
      feed(n.id, `${who} hit the runway`);
  }

  /* ---------- zoom: pinch (tablets), the wheel, + and − ---------- */
  /** The player's zoom against the usual one (kept on this device). */
  let zoomF = 1;
  /** The zoom the player chose, and fishing mode's extra on top of it. */
  let zBase = 1,
    fz = 1;
  try {
    zoomF = Number(localStorage.getItem("ea-plaza-zoom")) || 1;
  } catch {
    /* no storage */
  }
  /** Phones always show the usual zoom (plazaZoomable); a zoom kept from
   *  before is left in storage but not used there. */
  const zoomable = () =>
    plazaZoomable(matchMedia("(pointer: coarse)").matches, NW, NH);
  function setZoom(f, keep = true) {
    if (!zoomable()) {
      // Fishing's frame stays on top (fz), so turning a phone mid-fishing
      // keeps the fishing zoom.
      zBase = plazaZoomAt(NW, NH, 1);
      Z = zBase * fz;
      cam = plazaCamClamp(cam.x, cam.y, NW, NH, Z);
      return;
    }
    const r = plazaZoomRange(NW, NH);
    zBase = plazaZoomAt(NW, NH, f);
    // What was asked for past a limit is not kept: a wider screen later
    // starts from what was really shown.
    zoomF = zBase / r.base;
    // Fishing mode's frame on top (fz eases to fishingFrame's zoom).
    Z = zBase * fz;
    // Inside at once (the camera eases after this): zooming or resizing
    // never shows past what is painted.
    cam = plazaCamClamp(cam.x, cam.y, NW, NH, Z);
    if (keep)
      try {
        localStorage.setItem("ea-plaza-zoom", String(zoomF));
      } catch {
        /* no storage */
      }
  }
  const onWheel = (e) => {
    e.preventDefault();
    start();
    setZoom(
      zoomF * Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.0015),
    );
  };
  cv.addEventListener("wheel", onWheel, { passive: false });
  /** Two fingers on the playground: pinch to zoom. */
  const fingers = new Map();
  let pinchFrom = 0,
    pinchF = 1;
  const spread = () => {
    const [a, b] = [...fingers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  cv.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !zoomable()) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
      pinchFrom = spread();
      pinchF = zoomF;
    }
  });
  const pinchMove = (e) => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    f.x = e.clientX;
    f.y = e.clientY;
    if (fingers.size === 2 && pinchFrom > 20)
      setZoom(pinchF * (spread() / pinchFrom));
  };
  const pinchEnd = (e) => {
    fingers.delete(e.pointerId);
    if (fingers.size < 2) pinchFrom = 0;
  };
  addEventListener("pointermove", pinchMove, true);
  addEventListener("pointerup", pinchEnd, true);
  addEventListener("pointercancel", pinchEnd, true);

  /* ---------- input ---------- */
  const keys = new Set();
  let joy = { x: 0, y: 0, id: null },
    target = null;
  function onKey(e) {
    if (!running) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const albumOpen = !$("pz-album").hidden,
      photoOpen = !$("pz-photo").hidden;
    // Over the album or a polaroid, Space and Enter press the focused button.
    const onButton =
      (albumOpen || photoOpen) && e.target.closest?.("button, a[href]");
    if (
      !onButton &&
      [
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " ",
        "shift",
      ].includes(k)
    )
      e.preventDefault();
    if (albumOpen) {
      if (k === "escape") albumBack();
      else if (k === "tab") keepTabInAlbum(e);
      return;
    }
    if (mapOpen()) {
      if (k === "escape" || k === "m") hideMap();
      return;
    }
    // Esc folds Plaza today away (walking keys still walk).
    if (questsOpen && k === "escape") {
      showQuests(false);
      return;
    }
    if (!$("pz-fishbook").hidden) {
      if (k === "escape") hideFishBook();
      else if (k === "tab") {
        // Its only button: Tab stays on it, not on the HUD behind.
        e.preventDefault();
        $("pz-fishbook").querySelector('[data-fb="close"]').focus();
      }
      return;
    }
    // Fishing mode: its own keys. E, Space or Enter casts and reels; Esc
    // or a step leaves.
    if (fishing.active) {
      if (!onButton) e.preventDefault();
      if (e.repeat) return;
      if (k === "e" || k === " " || k === "enter") {
        if (fishing.phase === "fight") fishing.hold(true);
        else fishing.act();
      } else if (
        [
          "escape",
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(k)
      )
        exitFishing();
      else if (k === "b") showFishBook();
      return;
    }
    if (photoOpen) {
      if (k === "escape" || k === "e") closePhoto();
      return;
    }
    start();
    // + and − (or =) zoom in and out.
    if (k === "+" || k === "=" || k === "-" || k === "_") {
      setZoom(zoomF * (k === "-" || k === "_" ? 1 / 1.15 : 1.15));
      return;
    }
    if (
      e.repeat &&
      ![
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(k)
    )
      return;
    keys.add(k);
    target = null;
    if (k === " ") jump();
    if (k === "shift" || k === "j") dash();
    if (k === "e") interact();
    if (k === "q") toggleWheel();
    if (k === "t") throwTreat();
    if (k === "m") showMap();
    if (k === "b") showFishBook();
    if ("12345678".includes(k) && k.length === 1) emote(EMOTE_KEYS[+k - 1]);
  }
  screen.addEventListener("keydown", onKey);
  screen.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    // Letting go of the reel key in a fight gives line.
    if (k === "e" || k === " " || k === "enter") fishing.hold(false);
  });
  screen.addEventListener("blur", () => keys.clear());
  function start() {
    $("pz-start").hidden = true;
  }
  $("pz-start").onclick = () => {
    start();
    screen.focus({ preventScroll: true });
  };
  /**
   * An action button that works while the other thumb holds the joystick: it
   * acts on the press itself. Phones send a second finger pointer events but
   * often no click, so Jump and Dash did nothing while moving. Enter or
   * Space on the focused button still clicks (a click with no pointer
   * press, detail 0); a pointer press has already acted on its own click.
   */
  function onPress(el, act) {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      act();
    });
    el.addEventListener("click", (e) => {
      if (e.detail === 0) act();
    });
  }
  onPress($("pz-jump"), () => {
    start();
    jump();
    screen.focus({ preventScroll: true });
  });
  onPress($("pz-dash"), () => {
    start();
    dash();
    screen.focus({ preventScroll: true });
  });
  onPress($("pz-interact"), () => {
    interact();
    screen.focus({ preventScroll: true });
  });
  onPress($("pz-treat"), () => {
    start();
    throwTreat();
    screen.focus({ preventScroll: true });
  });
  $("pz-album-btn").onclick = () => {
    start();
    showAlbum();
  };
  // The Fish book opens from fishing's Book (or with B): the map's and
  // the HUD's buttons went, to keep the screens short (owner, 22 Nov).
  $("pz-wheel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-emote]");
    if (b) {
      emote(b.dataset.emote);
      toggleWheel(false);
      screen.focus({ preventScroll: true });
    }
  });
  /**
   * The emote wheel, from Q (or 1-8 straight away) on a keyboard. Touch
   * screens send emotes from the Chat button's quick chips: the wheel's
   * own Chat button went to keep the row over Dash short and to lead
   * players to the one chat (owner, 22 Nov). It opens over you.
   */
  function toggleWheel(on) {
    const w = $("pz-wheel"),
      show = on ?? w.hidden;
    w.hidden = !show;
    if (show) {
      const sr = $("pz").querySelector(".pz-hud").getBoundingClientRect(),
        rad = 110;
      w.style.left = `${sr.width / 2}px`;
      w.style.top = `${Math.max(rad + 60, Math.min(sr.height - rad - 8, sr.height / 2 - 70))}px`;
    }
  }
  // A press anywhere outside the emote wheel or a player's card closes it
  // (the Emote button toggles its own wheel). On the Plaza itself that press
  // only closes it: it doesn't also walk you there or open another card.
  layer.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target,
        quests = questsOpen && !t.closest("#pz-quests"),
        wheel = !$("pz-wheel").hidden && !t.closest("#pz-wheel"),
        card = !$("pz-card").hidden && !t.closest("#pz-card");
      if (quests) showQuests(false);
      if (wheel) toggleWheel(false);
      if (card) hideCard();
      if ((quests || wheel || card) && t === cv) {
        e.stopPropagation();
        screen.focus({ preventScroll: true });
      }
    },
    true,
  );
  $("pz-clock").onclick = (e) => {
    e.stopPropagation();
    tod = tod > 0.3 && tod < 0.7 ? 0.86 : 0.42;
    todHold = 120;
  };
  function toWorld(cx, cy) {
    const r = cv.getBoundingClientRect();
    const vx = ((cx - r.left) / r.width) * NW,
      vy = ((cy - r.top) / r.height) * NH;
    return { x: (vx - NW / 2) / Z + cam.x, y: (vy - NH / 2) / Z + cam.y };
  }
  cv.addEventListener("pointerdown", (e) => {
    start();
    screen.focus({ preventScroll: true });
    // Tap someone to see who they are (and befriend or invite them).
    const w = toWorld(e.clientX, e.clientY),
      who = [...others.values()].find(
        (b) =>
          !b.bot &&
          Math.abs(b.x - w.x) < 40 &&
          w.y > b.y - b.z - 84 &&
          w.y < b.y + 12,
      );
    if (who) return showCard(who);
    hideCard();
    // Fishing: the playground doesn't take you anywhere (Leave does).
    if (fishing.active) return;
    // A click walks you there, round whatever is in the way (plaza-path.ts).
    if (e.pointerType === "mouse") walkTo(w, true);
  });
  /** The rest of the way after `target`, and where it ends. */
  let route = [],
    routeEnd = null,
    replannedAt = 0;
  function walkTo(w, click = false) {
    routeEnd = w;
    route = plazaPath(P, w);
    const end = route[route.length - 1];
    target = route.shift() ?? null;
    replannedAt = performance.now();
    // The click marker (as in MOBAs and ARPGs): where you're going, or a
    // red cross where there is no way.
    if (click)
      clickMark = end
        ? { x: end.x, y: end.y, t: 0, ok: true }
        : { x: w.x, y: w.y, t: 0, ok: false };
  }
  /** The click marker: where a click sent you (drawn on the ground). */
  let clickMark = null;
  const MARK_BURST = 0.45;
  function drawClickMark(g, time) {
    const m = clickMark;
    if (!m) return;
    m.t = m.t ? m.t : time;
    const age = time - m.t;
    // Arrived (or walked off with the keys): the marker goes.
    const going = m.ok && routeEnd && target;
    if (age > MARK_BURST && !going) {
      if (age > MARK_BURST + 0.25 || m.ok) clickMark = null;
      if (!clickMark) return;
    }
    g.save();
    g.translate(m.x, m.y);
    g.scale(1, 0.42);
    g.lineCap = "round";
    if (!m.ok) {
      // No way there: a red cross, fading.
      const a = Math.max(0, 1 - age / (MARK_BURST + 0.25));
      g.scale(1, 1 / 0.42);
      g.strokeStyle = `rgba(20,8,12,${0.5 * a})`;
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(-9, -6);
      g.lineTo(9, 6);
      g.moveTo(9, -6);
      g.lineTo(-9, 6);
      g.stroke();
      g.strokeStyle = `rgba(255,90,100,${a})`;
      g.lineWidth = 4;
      g.stroke();
      g.restore();
      return;
    }
    const k = Math.min(1, age / MARK_BURST),
      ease = 1 - (1 - k) ** 3;
    // Gold with a dark edge and a white core, so it stands out on the
    // grass, the stones and the track alike (pale blue sank into them).
    const line = (a, w = 1) => {
      g.strokeStyle = `rgba(28,18,8,${0.75 * a})`;
      g.lineWidth = 8 * w;
      g.stroke();
      g.strokeStyle = `rgba(255,206,48,${a})`;
      g.lineWidth = 4.5 * w;
      g.stroke();
      g.strokeStyle = `rgba(255,250,220,${0.9 * a})`;
      g.lineWidth = 1.5 * w;
      g.stroke();
    };
    if (k < 1 && !reduced) {
      // The burst: a ring closing in and four chevrons pointing to the spot.
      const r = 50 - 32 * ease,
        a = 1 - k * 0.5;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      line(a);
      for (let i = 0; i < 4; i++) {
        g.save();
        g.rotate((i * Math.PI) / 2 + Math.PI / 4);
        g.translate(r + 14, 0);
        g.beginPath();
        g.moveTo(12, -12);
        g.lineTo(0, 0);
        g.lineTo(12, 12);
        line(a);
        g.restore();
      }
    }
    // While you walk there: a ring pulsing on the spot, a dot in it.
    const p = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * 6);
    g.beginPath();
    g.arc(0, 0, 15 + 3 * p, 0, Math.PI * 2);
    line(0.8 + 0.2 * p, 0.85);
    g.beginPath();
    g.arc(0, 0, 5.5, 0, Math.PI * 2);
    g.fillStyle = "rgba(28,18,8,.7)";
    g.fill();
    g.beginPath();
    g.arc(0, 0, 3.8, 0, Math.PI * 2);
    g.fillStyle = "#ffce30";
    g.fill();
    g.restore();
  }
  /** The player card: name, level, title; add friend, invite to party. */
  let cardFor = null;
  function showCard(b) {
    const p = profiles.get(b.id);
    if (!p?.accountId) return;
    cardFor = p;
    const card = $("pz-card");
    // Who they are: their avatar (docs/hidden-picks.md, "Avatars").
    const photo = photoIdOf(p.avatar);
    card.innerHTML = `<div class="pc-h"><img class="pc-avatar" src="${avatarSrc(p.avatar)}" alt=""><div><b>${esc(p.name)}</b><small>${p.level ? `Lv ${p.level}` : ""}${p.title ? ` · <span style="color:${esc(p.titleColor ?? "#ffd65b")}">${esc(p.title)}</span>` : ""}</small></div><button type="button" class="x" data-pc="close" aria-label="Close">✕</button></div><div class="pc-acts pc-pair">${PLAZA_PAIR_EMOTES.map((e) => `<button type="button" data-pc="pair" data-kind="${e.id}"><span class="pc-emo" aria-hidden="true">${e.icon}</span>${e.label}</button>`).join("")}</div><div class="pc-acts"><button type="button" data-pc="friend">${iconLabel("add-friend", "Add friend")}</button><button type="button" data-pc="party">${iconLabel("friends", "Invite to party")}</button></div><div class="pc-acts pc-safety">${photo ? `<button type="button" data-pc="report-photo">${iconLabel("report", "Report picture")}</button>` : ""}<button type="button" data-pc="report">${iconLabel("report", "Report")}</button><button type="button" data-pc="block" class="pc-block">${iconLabel("block", "Block")}</button></div>`;
    card.hidden = false;
  }
  function hideCard() {
    cardFor = null;
    $("pz-card").hidden = true;
  }
  $("pz-card").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pc]");
    if (!b) return;
    if (b.dataset.pc === "close" || !cardFor) return hideCard();
    if (b.dataset.pc === "pair") {
      askPair(cardFor.id, b.dataset.kind);
      hideCard();
      screen.focus({ preventScroll: true });
      return;
    }
    b.disabled = true;
    let close = false;
    try {
      close = !!(await options.onPlayer(
        b.dataset.pc,
        cardFor.accountId,
        cardFor.name,
        cardFor.avatar,
      ));
    } finally {
      b.disabled = false;
    }
    if (close) hideCard();
    screen.focus({ preventScroll: true });
  });
  const joyEl = $("pz-joy"),
    ring = $("pz-ring"),
    knob = $("pz-knob");
  // Joystick that can't get stuck: the origin is set before pointer capture (which some browsers refuse),
  // moves/releases are also heard at the window, and lost focus / hidden page / rotation reset it.
  joyEl.addEventListener("pointerdown", (e) => {
    start();
    const r = joyEl.getBoundingClientRect(),
      k = r.width / joyEl.offsetWidth || 1;
    joy = { x: 0, y: 0, id: e.pointerId, ox: e.clientX, oy: e.clientY, k };
    ring.style.display = "block";
    ring.style.left = `${(e.clientX - r.left) / k}px`;
    ring.style.top = `${(e.clientY - r.top) / k}px`;
    knob.style.transform = "";
    try {
      joyEl.setPointerCapture(e.pointerId);
    } catch {
      /* window listeners below still track this finger */
    }
  });
  const joyMove = (e) => {
    if (joy.id == null || e.pointerId !== joy.id) return;
    const dx = (e.clientX - joy.ox) / joy.k,
      dy = (e.clientY - joy.oy) / joy.k,
      m = Math.hypot(dx, dy),
      max = 55,
      k = m > max ? max / m : 1;
    joy.x = (dx / max) * k;
    joy.y = (dy / max) * k;
    if (
      !Number.isFinite(joy.x) ||
      !Number.isFinite(joy.y) ||
      Math.hypot(joy.x, joy.y) < 0.15
    )
      joy.x = joy.y = 0;
    knob.style.transform = `translate(${dx * k || 0}px, ${dy * k || 0}px)`;
  };
  const joyReset = () => {
    joy = { x: 0, y: 0, id: null };
    ring.style.display = "none";
  };
  const joyEnd = (e) => {
    if (joy.id != null && e.pointerId === joy.id) joyReset();
  };
  const onHidden = () => {
    if (document.hidden) {
      joyReset();
      keys.clear();
    }
  };
  addEventListener("pointermove", joyMove, true);
  addEventListener("pointerup", joyEnd, true);
  addEventListener("pointercancel", joyEnd, true);
  addEventListener("blur", joyReset);
  addEventListener("orientationchange", joyReset);
  document.addEventListener("visibilitychange", onHidden);

  /* ---------- actions: predicted here, decided by the server ---------- */
  function jump() {
    if (plazaJump(P)) socket.emit("plaza-jump", stamp());
  }
  function dash() {
    // Send the way you dashed: the server's last stick can be a step old.
    if (plazaDash(P))
      socket.emit("plaza-dash", {
        dx: Math.round(P.dashX * 1000) / 1000,
        dy: Math.round(P.dashY * 1000) / 1000,
        ...stamp(),
      });
  }
  let emoteAt = 0;
  function emote(e) {
    const now = performance.now();
    if (now - emoteAt < 1000) return;
    emoteAt = now;
    showEmote(P, e);
    // Through chat (Nearby): the server pops it over your head for everyone
    // in the Plaza, as before, and it shows in the chat's Nearby tab.
    const quick = e === "GG" ? "gg" : CHAT_EMOTE_OF[e];
    if (options.quickChat && quick) options.quickChat(quick);
    else socket.emit("plaza-emote", { emote: e });
  }
  /** A Nearby line said by someone here: a bubble over their head. */
  function say(accountId, text) {
    if (accountId === options.myAccountId?.()) return showEmote(P, text);
    for (const [id, b] of others)
      if (profiles.get(id)?.accountId === accountId) return showEmote(b, text);
  }
  function showEmote(b, e) {
    b.emote = e;
    b.emoteT = PLAZA.emoteSeconds;
    if (e === "💃") {
      b.dance = 4;
      // A dance shows off the Victory slot (and the skin's celebration).
      cheerWearer(b, performance.now());
    }
  }
  /* ---------- pair emotes (asked from a player's card) ---------- */
  /** Play pair emote `pair` (PLAZA_PAIR_EMOTES) on body `b`. */
  function startPair(b, pair) {
    if (b.pairT > 0 && b.pairKind === pair.id) return;
    b.pairKind = pair.id;
    b.pairT = PLAZA_PAIR.playSeconds;
    b.emote = pair.icon;
    b.emoteT = PLAZA_PAIR.playSeconds;
    b.dance = pair.id === "dance" ? PLAZA_PAIR.playSeconds : 0;
    burst(b.x + b.face * 22, b.y, 70, pair.icon, low ? 2 : 4, null, 0.5);
  }
  function askPair(to, kind) {
    const pair = PLAZA_PAIR_EMOTES.find((e) => e.id === kind);
    if (!pair) return;
    socket.timeout(5000).emit("plaza-pair-ask", { to, kind }, (err, r) => {
      if (err) return pzToast("That didn't go through. Try again.");
      if (!r?.ok) return pzToast(r?.error ?? "They can't be asked right now.");
      pzToast(`Asked ${nameOf(to)} for a ${pair.label.toLowerCase()}…`);
    });
  }
  /** A request to you: a small prompt, open for its few seconds. */
  let askFrom = null,
    askTimer = 0;
  function hideAsk() {
    askFrom = null;
    clearTimeout(askTimer);
    $("pz-ask").hidden = true;
  }
  const onPairAsk = (a) => {
    const pair = PLAZA_PAIR_EMOTES.find((e) => e.id === a?.kind);
    if (!pair || typeof a.from !== "number") return;
    const acc = profiles.get(a.from)?.accountId;
    if (acc && options.isBlocked?.(acc)) return;
    askFrom = a.from;
    const el = $("pz-ask");
    el.innerHTML = `<span class="pa-emo" aria-hidden="true">${pair.icon}</span><p><b>${esc(a.name)}</b> wants a ${esc(pair.label.toLowerCase())}!</p><button type="button" data-pa="yes">Accept</button><button type="button" class="x" data-pa="no" aria-label="No thanks">✕</button>`;
    el.hidden = false;
    clearTimeout(askTimer);
    askTimer = setTimeout(hideAsk, Math.max(1000, Math.min(a.ms || 0, 10_000)));
  };
  $("pz-ask").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pa]");
    if (!b || askFrom == null) return;
    const yes = b.dataset.pa === "yes";
    socket
      .timeout(5000)
      .emit("plaza-pair-answer", { from: askFrom, yes }, (err, r) => {
        if (yes && (err || !r?.ok))
          pzToast(
            err
              ? "That didn't go through."
              : (r?.error ?? "That request has ended."),
          );
      });
    hideAsk();
    screen.focus({ preventScroll: true });
  });
  /** Both players: face each other and play it now (others see it in the next snapshot). */
  const onPair = (m) => {
    const pair = PLAZA_PAIR_EMOTES.find((e) => e.id === m?.kind);
    if (!pair) return;
    const body = (id) => (id === meId ? P : others.get(id));
    const a = body(m.a),
      b = body(m.b);
    if (a && b) {
      a.face = b.x >= a.x ? 1 : -1;
      b.face = -a.face;
    }
    if (a) startPair(a, pair);
    if (b) startPair(b, pair);
  };
  const onPairNo = (m) => pzToast(`${m?.name || "They"} said maybe later.`);
  socket.on("plaza-pair-ask", onPairAsk);
  socket.on("plaza-pair", onPair);
  socket.on("plaza-pair-no", onPairNo);
  function burst(x, y, z, glyph, n = 12, color, spd = 1) {
    if (reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      FX.push({
        g: glyph,
        x,
        y,
        z,
        vx: Math.cos(a) * (110 + Math.random() * 90) * spd,
        vy: Math.sin(a) * (70 + Math.random() * 60) * spd,
        vz: 170 + Math.random() * 120,
        t: 0,
        life: 1.1,
        c: color,
      });
    }
  }

  /* interactables */
  const SPOTS = [
    {
      id: "photo",
      x: PHOTO.x,
      y: PHOTO.y + 30,
      r: 90,
      label: "Take photo",
      icon: "camera",
      act: takePhoto,
    },
    {
      id: "cafe",
      x: CAFE.x,
      y: CAFE.y + 40,
      r: 110,
      label: "Volt Boba · free",
      icon: "boba",
      act: buyTea,
    },
    {
      id: "board",
      x: BOARD.x,
      y: BOARD.y + 30,
      r: 100,
      label: "Plaza map",
      icon: "map",
      act: () => showMap(),
    },
    {
      id: "leader",
      x: LEADER.x,
      y: LEADER.y + 30,
      r: 110,
      label: "Leaderboard",
      icon: "trophy",
      act: () => {
        const rows = boardRows();
        pzToast(
          rows.length
            ? `TOP DASH this week: ${rows
                .slice(0, 3)
                .map(([n, t]) => `${n} ${t.toFixed(2)}s`)
                .join(" · ")}`
            : "No laps this week yet. Run one!",
        );
      },
    },
  ];
  // Fishing at the pond (plaza-fishing.ts): a mode with its own buttons, the
  // camera in close; the server picks the bite and the fish.
  let catchTimer = 0;
  const fishing = createFishing({
    socket,
    toast: pzToast,
    low: () => low,
    changed: () => renderFishHud(),
    isNew: (f) => progress?.fishBook?.[f.id] === undefined,
    caught: (f, first) => {
      // Low graphics: the name only, no splash of particles.
      if (!low)
        burst(
          PLAZA_FISHING.bobber.x,
          PLAZA_FISHING.bobber.y,
          20,
          "●",
          10,
          f.color,
        );
      // The fish itself, drawn in full, for a moment over the Plaza.
      const card = $("pz-catch");
      // New to the book: its first-catch coins (the server pays them).
      card.innerHTML = catchCard(f, first);
      card.hidden = false;
      clearTimeout(catchTimer);
      catchTimer = setTimeout(() => (card.hidden = true), 2600);
    },
  });
  const fightView = createFightView();
  /** Where the fight's gauge stands: over the Leave button (measured once
   * as the fight starts, never per frame). */
  let fightRoom = { gx: 0, gy0: 0, gy1: 0 };
  SPOTS.push({ ...FISH_SPOT, act: () => enterFishing() });
  /** Walking out onto the dock for fishing: turn to the water on arrival. */
  let toDock = false;
  function enterFishing() {
    if (fishing.active) return;
    standStill();
    toggleWheel(false);
    hideCard();
    showQuests(false);
    fishing.enter();
    // Out to the end of the dock (PLAZA_DOCK), as the camera comes in, so
    // you fish from its planks rather than from wherever you pressed Fish.
    const S = PLAZA_DOCK.stand;
    if (Math.hypot(P.x - S.x, P.y - S.y) > 6) walkTo({ x: S.x, y: S.y });
    toDock = true;
    screen.focus({ preventScroll: true });
  }
  function exitFishing() {
    fishing.exit();
    screen.focus({ preventScroll: true });
  }
  /** The fishing HUD, from the mode's phase (only when it changes). */
  function renderFishHud() {
    const on = fishing.active;
    layer.classList.toggle("fishing", on);
    $("pz-fishhud").hidden = !on;
    if (!on) return;
    // A new cast puts the last catch's card away (it would hide the "!").
    if (fishing.phase === "cast") {
      clearTimeout(catchTimer);
      $("pz-catch").hidden = true;
    }
    const b = fishing.button(),
      act = $("pz-fish-act");
    $("pz-fishhud").dataset.phase = fishing.phase;
    if (fishing.phase === "fight" && act.dataset.kind !== "fight") {
      fightView.reset();
      const r = $("pz-fish-exit").getBoundingClientRect(),
        l = layer.getBoundingClientRect(),
        top = r.top - l.top;
      fightRoom = {
        gx: r.left - l.left + 22,
        gy0: Math.max(84, top - 34 - Math.min(230, NH * 0.5)),
        gy1: top - 34,
      };
    }
    if (b.kind !== "fight") act.classList.remove("held");
    act.dataset.kind = b.kind;
    act.querySelector("b").textContent = b.label;
    act.disabled = b.kind === "busy";
    $("pz-fish-hint").textContent = fishing.hint();
    $("pz-fish-hint").dataset.kind = fishing.phase;
    const caught = Math.min(progress?.fishToday ?? 0, PLAZA_FISHING.perDay),
      today = `${caught}/${PLAZA_FISHING.perDay}`;
    if ($("pz-fish-today").dataset.n !== today) {
      $("pz-fish-today").dataset.n = today;
      $("pz-fish-today").innerHTML =
        `<b>${caught}<i>/${PLAZA_FISHING.perDay}</i></b><small>today</small>`;
    }
  }
  onPress($("pz-fish-act"), () => {
    if (fishing.phase !== "fight") fishing.act();
  });
  // In a fight the button is held: down reels, up (or the finger sliding
  // off, or the page losing it) gives line.
  {
    const act = $("pz-fish-act");
    act.addEventListener("pointerdown", (e) => {
      if (fishing.phase !== "fight" || e.button !== 0) return;
      act.setPointerCapture?.(e.pointerId);
      fishing.hold(true);
      act.classList.add("held");
    });
    const up = () => {
      fishing.hold(false);
      act.classList.remove("held");
    };
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
      act.addEventListener(ev, up);
    act.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  $("pz-fish-exit").onclick = exitFishing;
  $("pz-fish-book2").onclick = () => showFishBook();
  const onFish = (note) => fishing.onNote(note);
  socket.on("plaza-fish", onFish);
  function renderFishBook() {
    const b = fishBook(progress?.fishBook);
    $("pz-fishbook-count").textContent = `${b.caught} / ${b.total}`;
    setInner($("pz-fishbook-list"), b.html);
    $("pz-fishbook-note").textContent = `${
      progress?.fishTitle
        ? `Title earned: ${PLAZA_FISH_TITLE.name} ✓`
        : `Catch all ${b.total} for the title ${PLAZA_FISH_TITLE.name}`
    } · today ${Math.min(progress?.fishToday ?? 0, PLAZA_FISHING.perDay)} / ${PLAZA_FISHING.perDay} count`;
  }
  function showFishBook() {
    toggleWheel(false);
    hideCard();
    $("pz-fishbook").hidden = false;
    renderFishBook();
    $("pz-fishbook").querySelector('[data-fb="close"]').focus();
  }
  function hideFishBook() {
    $("pz-fishbook").hidden = true;
    screen.focus({ preventScroll: true });
  }
  $("pz-fishbook").querySelector('[data-fb="close"]').onclick = hideFishBook;

  /* ---------- the Plaza map (plaza-map.ts): every place, and Go ---------- */
  let mapPic = null,
    mapDotsAt = 0;
  const mapOpen = () => !$("pz-map").hidden;
  /** Today's unfinished quests done at a place. */
  const questsAt = (place) =>
    PLAZA_QUESTS.filter(
      (x) => place.quests.includes(x.id) && !progress?.quests?.[x.id]?.done,
    );
  function renderMap() {
    if (!mapPic) mapPic = paintPlazaMap(bg, GM, 900);
    const cvm = $("pz-map-cv");
    if (cvm.width !== mapPic.width) {
      cvm.width = mapPic.width;
      cvm.height = mapPic.height;
      cvm.getContext("2d").drawImage(mapPic, 0, 0);
    }
    setInner(
      $("pz-map-pins"),
      mapPinsHtml(PLAZA_PLACES, I, (p) => questsAt(p).length > 0),
    );
    setInner(
      $("pz-map-list"),
      PLAZA_PLACES.map((p) => {
        const q = questsAt(p)[0];
        const line = q
          ? `<small class="q">${esc(q.text)} · +${q.coins} ${I("coin", "coin")}</small>`
          : `<small>${esc(p.blurb)}</small>`;
        return `<li><button type="button" data-place="${p.id}"${q ? ' class="quest"' : ""}>${I(p.icon)}<span><b>${esc(p.name)}</b>${line}</span><i aria-hidden="true">Go</i></button></li>`;
      }).join(""),
    );
    renderMapDots();
  }
  /** You and the other players on the map (every quarter second while open). */
  function renderMapDots() {
    mapDotsAt = performance.now();
    const dot = (b, cls) => {
      const { fx, fy } = mapFrac(b.x, b.y);
      return `<i class="${cls}" style="left:${(fx * 100).toFixed(2)}%;top:${(fy * 100).toFixed(2)}%"></i>`;
    };
    let html = "";
    for (const b of others.values()) if (!b.bot) html += dot(b, "pl");
    $("pz-map-dots").innerHTML = html + dot(P, "me");
  }
  function showMap() {
    toggleWheel(false);
    hideCard();
    standStill();
    $("pz-map").hidden = false;
    renderMap();
    $("pz-map").querySelector('[data-map="close"]').focus();
  }
  function hideMap() {
    $("pz-map").hidden = true;
    screen.focus({ preventScroll: true });
  }
  /** Walk to a place on the map (round whatever is in the way). */
  function goToPlace(id) {
    const p = PLAZA_PLACES.find((x) => x.id === id);
    if (!p) return;
    start();
    if (mapOpen()) hideMap();
    if (fishing.active) exitFishing();
    walkTo({ x: p.x, y: p.y }, true);
    pzToast(`Walking to ${p.name}`);
  }
  $("pz-map").querySelector('[data-map="close"]').onclick = hideMap;
  $("pz-map").addEventListener("click", (e) => {
    const b = e.target.closest("[data-place]");
    if (b) goToPlace(b.dataset.place);
  });
  $("pz-map-btn").onclick = () => {
    start();
    showMap();
  };
  let near = null;
  function interact() {
    if (near) near.act();
  }
  /* treats: a free daily allowance (PLAZA.treatsDaily), tossed for everyone */
  let treats = 0,
    treatBusy = false;
  function setTreats(n) {
    treats = Math.max(0, n | 0);
    $("pz-treats").textContent = treats > 99 ? "99+" : String(treats);
  }
  function throwTreat() {
    if (treatBusy) return;
    if (treats < 1) return pzToast("No treats left today. More tomorrow!");
    treatBusy = true;
    socket.timeout(5000).emit("plaza-treat", {}, (err, r) => {
      treatBusy = false;
      if (err) return pzToast("The treat didn't go. Try again.");
      if (typeof r?.treats === "number") setTreats(r.treats);
      if (!r?.ok)
        return pzToast(r?.error ?? "Treats can't be thrown right now.");
      const what = PLAZA_TREAT_BY_ID[r.treat]?.name ?? "a treat";
      pzToast(
        r.wish
          ? `You made a wish with ${what}!`
          : `Tossed ${what} to everyone!`,
      );
    });
  }
  // Everyone in this Plaza sees a treat burst where it was thrown.
  const onTreat = (t) => {
    if (!t || typeof t.x !== "number") return;
    const color = PLAZA_TREAT_BY_ID[t.treat]?.color ?? "#ff6fae";
    if (t.wish) {
      // Into the fountain: a splash and a ring on the water.
      burst(FOUNT.x, FOUNT.y - 10, 30, "✦", 10, color, 0.6);
      FX.push({ ring: 1, x: FOUNT.x, y: FOUNT.y, t: 0, life: 0.6, c: color });
      return;
    }
    burst(
      t.x,
      t.y,
      70,
      "●",
      18,
      PLAZA_TREAT_BY_ID[t.treat]?.color ?? "#ff6fae",
      1.2,
    );
  };
  const onTreats = (t) => setTreats(t?.n ?? 0);
  socket.on("plaza-treat", onTreat);
  socket.on("plaza-treats", onTreats);
  // The copy's wish meter; a full one brings the fireworks (server time).
  const onWish = (w) => {
    if (!w || typeof w.n !== "number") return;
    wish.n = Math.max(0, w.n | 0);
    wish.target = Math.max(0, w.target | 0);
    if (w.show && typeof w.show.at === "number")
      fireworks.start(w.show.at, w.show.seed | 0, serverNow());
  };
  const onWishPaid = (p) => {
    if (!p?.paid) return;
    pzToast(`Your wish came true: +${p.coins} coins`);
    options.onCoins?.();
  };
  socket.on("plaza-wish", onWish);
  socket.on("plaza-wish-paid", onWishPaid);
  /** Wishes to fill the meter: the fill's own, or what this copy would need. */
  const wishGoal = () => wish.target || wishTarget(population);
  /** The meter over the fountain, while it has wishes or you're nearby. On a
   * phone the top HUD covers that spot: the treat button's badge shows it. */
  function drawWishMeter(g) {
    if (layer.classList.contains("phone")) return;
    if (!wish.n && Math.hypot(P.x - FOUNT.x, P.y - FOUNT.y) > 480) return;
    const goal = wishGoal(),
      k = Math.min(1, wish.n / goal),
      w = 132,
      h = 24,
      x = FOUNT.x - w / 2,
      // Just over the basin: on screen for someone at the fountain on the
      // smallest phone (the statue's top is cut off there).
      y = FOUNT.y - 150;
    g.save();
    g.globalAlpha = 0.92;
    g.fillStyle = "#0b1020d9";
    g.beginPath();
    g.roundRect(x, y, w, h, h / 2);
    g.fill();
    if (k > 0) {
      g.fillStyle = "#ff8fc4";
      g.beginPath();
      g.roundRect(
        x + 3,
        y + 3,
        Math.max(h - 6, (w - 6) * k),
        h - 6,
        (h - 6) / 2,
      );
      g.fill();
    }
    g.globalAlpha = 1;
    g.font = "800 15px 'Barlow Condensed', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 3;
    g.strokeStyle = "#0b1020";
    const label = `✦ WISHES ${wish.n}/${goal}`;
    g.lineJoin = "round";
    g.strokeText(label, FOUNT.x, y + h / 2 + 1);
    g.fillStyle = "#fff";
    g.fillText(label, FOUNT.x, y + h / 2 + 1);
    g.restore();
  }
  let bobaBusy = false;
  function buyTea() {
    if (P.boost > 0) return pzToast("Your boba boost is still active");
    if (bobaBusy) return;
    bobaBusy = true;
    socket.timeout(5000).emit("plaza-act", { spot: "cafe" }, (err, r) => {
      bobaBusy = false;
      if (err) return pzToast("Volt Boba didn't answer. Try again.");
      if (!r?.ok) return pzToast(r?.error ?? "Volt Boba is closed right now.");
      P.boost = PLAZA.boba.seconds;
      burst(P.x, P.y, 60, "⚡", 10, "#ffd84a");
      pzToast(`Volt Boba: 30% faster for ${PLAZA.boba.seconds} seconds`);
    });
  }

  /* photo mode */
  /** The polaroid on screen: its canvas and words, for Save to album. */
  let shot = null;
  /** Stop walking on the server too (the scene pauses behind the polaroid). */
  function standStill() {
    keys.clear();
    target = null;
    joyReset();
    if (sent.x || sent.y) {
      socket.emit("plaza-input", { dx: 0, dy: 0, ...stamp() });
      sent = { x: 0, y: 0 };
      sentAt = performance.now();
    }
  }
  function takePhoto() {
    socket.emit("plaza-act", { spot: "photo" }, () => {});
    standStill();
    const fl = document.createElement("div");
    fl.className = "flash";
    $("pz").append(fl);
    setTimeout(() => fl.remove(), 600);
    const o = document.createElement("canvas"),
      w = 640,
      h = 420;
    o.width = w;
    o.height = h;
    const g = o.getContext("2d"),
      z = 1.15;
    g.translate(w / 2, h / 2);
    g.scale(z, z);
    g.translate(-P.x, -(P.y - 50));
    drawWorld(g, T, true);
    const people = [...others.values()]
      .filter(
        (n) => !n.bot && Math.abs(n.x - P.x) < 300 && Math.abs(n.y - P.y) < 200,
      )
      .map((n) => n.name);
    const caption = people.length
      ? `${P.name} with ${people.slice(0, 3).join(", ")}${people.length > 3 ? ` +${people.length - 3}` : ""}`
      : `${P.name} at the Photo Spot`;
    const place = `Elemental Plaza · ${clockText()}`;
    const at = Date.now();
    const url = o.toDataURL("image/jpeg", 0.9);
    const mine = { canvas: o, caption, place, at };
    setTimeout(() => {
      shot = mine;
      const box = $("pz-photo");
      box.hidden = false;
      box.innerHTML = `<div class="polaroid"><div class="print"><img src="${url}" alt="Photo taken in the Plaza"><p title="${esc(caption)}">${esc(caption)}</p><small>${esc(place)}</small></div><div class="acts"><button type="button" class="pz-main" data-ph="album">${iconLabel("save", "Save to album")}</button><a data-ph="keep" href="${url}" download="${pictureName(at)}">Save picture</a><button type="button" data-ph="close">${iconLabel("cancel", "Close")}</button></div></div>`;
      box.querySelector('[data-ph="album"]').onclick = (e) =>
        keepInAlbum(mine, e.currentTarget);
      box.querySelector('[data-ph="keep"]').onclick = () =>
        setTimeout(closePhoto, 100);
      box.querySelector('[data-ph="close"]').onclick = closePhoto;
    }, 160);
  }
  /** A tap on an overlay's dimmed background (pressed and let go there, not
   * a drag out of its card) calls `back`. */
  function onBackdrop(el, isBackdrop, back) {
    let pressed = false;
    el.addEventListener("pointerdown", (e) => (pressed = isBackdrop(e.target)));
    el.addEventListener("click", (e) => {
      const was = pressed;
      pressed = false;
      if (was && isBackdrop(e.target)) back();
    });
  }
  function closePhoto() {
    shot = null;
    $("pz-photo").hidden = true;
    screen.focus({ preventScroll: true });
  }
  // A tap on the dimmed background around the polaroid puts it away.
  onBackdrop($("pz-photo"), (t) => t.id === "pz-photo", closePhoto);
  onBackdrop($("pz-fishbook"), (t) => t.id === "pz-fishbook", hideFishBook);
  onBackdrop($("pz-map"), (t) => t.id === "pz-map", hideMap);

  /* the photo album: on this device only (plaza-album.ts, PLAN.md) */
  const album = openAlbum();
  let albumPhotos = [],
    albumState = "loading",
    albumLoad = 0,
    viewing = null,
    sureT = 0;
  /** Object URLs of the grid's thumbnails, by photo id. */
  const thumbUrls = new Map();
  async function keepInAlbum(mine, btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      const { image, thumb } = await albumImages(mine.canvas);
      const r = await album.add({
        at: mine.at,
        caption: mine.caption,
        place: mine.place,
        image,
        thumb,
      });
      pzToast(
        r.dropped
          ? "Saved to your album. The oldest photo made room."
          : `Saved to your album (${r.count}/${ALBUM_LIMIT})`,
      );
      if (shot === mine) closePhoto();
    } catch {
      btn.disabled = false;
      btn.textContent = "Save to album";
      pzToast("This browser couldn't keep the photo. Use Save picture.");
    }
  }
  async function showAlbum() {
    toggleWheel(false);
    hideCard();
    const box = $("pz-album");
    box.hidden = false;
    closeShot();
    albumState = "loading";
    renderAlbum();
    $("pz-album").querySelector('[data-al="close"]').focus();
    const token = ++albumLoad;
    try {
      const list = await album.list();
      if (token !== albumLoad || box.hidden) return;
      albumPhotos = list;
      albumState = "ready";
    } catch {
      if (token !== albumLoad || box.hidden) return;
      albumPhotos = [];
      albumState = "error";
    }
    renderAlbum();
  }
  function hideAlbum() {
    albumLoad++;
    closeShot();
    $("pz-album").hidden = true;
    for (const url of thumbUrls.values()) URL.revokeObjectURL(url);
    thumbUrls.clear();
    albumPhotos = [];
    screen.focus({ preventScroll: true });
  }
  /** Tab goes round the album's buttons, not to the HUD behind it. */
  function keepTabInAlbum(e) {
    const all = [...$("pz-album").querySelectorAll("button, a[href]")].filter(
      (el) => el.offsetParent !== null && !el.disabled,
    );
    if (!all.length) return;
    const i = all.indexOf(document.activeElement),
      last = all.length - 1;
    if (i === -1 || (e.shiftKey ? i === 0 : i === last)) {
      e.preventDefault();
      all[e.shiftKey ? last : 0].focus();
    }
  }
  /** Escape or Back: from a photo to the grid, from the grid out. */
  function albumBack() {
    if (viewing) {
      const id = viewing.photo.id;
      closeShot();
      $("pz-album-grid").querySelector(`[data-id="${id}"]`)?.focus();
    } else hideAlbum();
  }
  function renderAlbum() {
    const n = albumPhotos.length;
    $("pz-album-count").textContent = `${n} / ${ALBUM_LIMIT}`;
    // Thumbnails: keep the URLs of photos still here, let go of the rest.
    const keep = new Set(albumPhotos.map((p) => p.id));
    for (const [id, url] of thumbUrls)
      if (!keep.has(id)) {
        URL.revokeObjectURL(url);
        thumbUrls.delete(id);
      }
    let html = "";
    for (let i = 0; i < ALBUM_LIMIT; i++) {
      const p = albumPhotos[i];
      if (!p) {
        html += `<span class="slot empty"></span>`;
        continue;
      }
      if (!thumbUrls.has(p.id))
        thumbUrls.set(p.id, URL.createObjectURL(p.thumb));
      html += `<button type="button" class="slot" data-id="${p.id}" aria-label="Open photo: ${esc(p.caption)}"><img src="${thumbUrls.get(p.id)}" alt=""></button>`;
    }
    if (albumState === "ready" && !n)
      html += `<div class="pz-album-empty" role="status">${I("camera")}<b>No photos yet</b><span>Take one at the Photo Spot, then press Save to album.</span></div>`;
    else if (albumState === "error")
      html += `<div class="pz-album-empty" role="status">${I("camera")}<b>The album can't open here</b><span>This browser won't keep photos. Use Save picture on the polaroid.</span></div>`;
    $("pz-album-grid").innerHTML = html;
  }
  function openShot(id) {
    const photo = albumPhotos.find((p) => p.id === id);
    if (!photo) return;
    closeShot();
    const url = URL.createObjectURL(photo.image);
    viewing = { photo, url };
    const view = $("pz-album-view");
    view.innerHTML = `<div class="polaroid"><div class="print"><img src="${url}" alt="${esc(photo.caption)}"><p title="${esc(photo.caption)}">${esc(photo.caption)}</p><small>${esc(photo.place)} · ${photoDay(photo.at)}</small></div><div class="acts"><a class="pz-main" data-al="save" href="${url}" download="${pictureName(photo.at)}">Save picture</a><button type="button" class="pz-delete" data-al="delete">Delete</button><button type="button" data-al="back">Back</button></div></div>`;
    $("pz-album-panel").hidden = true;
    view.hidden = false;
    view.querySelector('[data-al="back"]').focus();
  }
  function closeShot() {
    clearTimeout(sureT);
    if (viewing) URL.revokeObjectURL(viewing.url);
    viewing = null;
    const view = $("pz-album-view");
    view.hidden = true;
    view.innerHTML = "";
    $("pz-album-panel").hidden = false;
  }
  async function deleteShot(btn) {
    if (!viewing || btn.disabled) return;
    // First press asks; a second within 3 s deletes.
    if (btn.dataset.sure !== "1") {
      btn.dataset.sure = "1";
      btn.textContent = "Delete?";
      clearTimeout(sureT);
      sureT = setTimeout(() => {
        btn.dataset.sure = "";
        btn.textContent = "Delete";
      }, 3000);
      return;
    }
    clearTimeout(sureT);
    btn.disabled = true;
    const id = viewing.photo.id;
    try {
      await album.remove(id);
    } catch {
      btn.disabled = false;
      return pzToast("The photo couldn't be deleted. Try again.");
    }
    // The grid and the count change in place (the count is read out), so no
    // toast covers the album.
    if ($("pz-album").hidden) return;
    albumPhotos = albumPhotos.filter((p) => p.id !== id);
    if (viewing?.photo.id === id) {
      closeShot();
      $("pz-album").querySelector('[data-al="close"]').focus();
    }
    renderAlbum();
  }
  // A tap on the dimmed background, outside the album or the photo, goes
  // back: from a photo to the grid, from the grid out of the album.
  onBackdrop(
    $("pz-album"),
    (t) => t.id === "pz-album" || t.id === "pz-album-view",
    albumBack,
  );
  $("pz-album").addEventListener("click", (e) => {
    const b = e.target.closest("[data-al], [data-id]");
    if (!b) return;
    if (b.dataset.id) return openShot(Number(b.dataset.id));
    const act = b.dataset.al;
    if (act === "close") hideAlbum();
    else if (act === "back") albumBack();
    else if (act === "delete") deleteShot(b);
  });

  /* ---------- your movement ---------- */
  function inputDir() {
    let x = 0,
      y = 0;
    if (keys.has("a") || keys.has("arrowleft")) x--;
    if (keys.has("d") || keys.has("arrowright")) x++;
    if (keys.has("w") || keys.has("arrowup")) y--;
    if (keys.has("s") || keys.has("arrowdown")) y++;
    if (Number.isFinite(joy.x) && Number.isFinite(joy.y)) {
      x += joy.x;
      y += joy.y;
    }
    if (!target) route = [];
    // Held up on the way (someone in it, a bump): find the way again.
    if (
      !x &&
      !y &&
      target &&
      routeEnd &&
      P.stuckT > 0.5 &&
      performance.now() - replannedAt > 1000
    )
      walkTo(routeEnd);
    if (!x && !y && target) {
      const dx = target.x - P.x,
        dy = target.y - P.y,
        d = Math.hypot(dx, dy);
      // A turn on the way is passed a little early, so you round it.
      if (d < (route.length ? 18 : 10)) {
        target = route.shift() ?? null;
        if (!target) routeEnd = null;
      } else {
        x = dx / d;
        y = dy / d;
        if (P.stuckT > 0.12) {
          const c = Math.cos(1.2),
            s = Math.sin(1.2);
          [x, y] = [x * c - y * s, x * s + y * c];
        }
      }
    }
    const m = Math.hypot(x, y);
    return m > 1 ? { x: x / m, y: y / m } : { x, y };
  }
  /** Send the stick when it changes (at most every 50 ms), and once a second
   *  while moving. You walk with the stick as sent, so the server, playing
   *  the same sticks at the same moments, walks you the same way. */
  let sent = { x: 0, y: 0 },
    sentAt = 0;
  function sendInput(dir, now) {
    const x = Math.round(dir.x * 100) / 100,
      y = Math.round(dir.y * 100) / 100,
      changed = x !== sent.x || y !== sent.y;
    if ((changed && now - sentAt >= 50) || ((x || y) && now - sentAt >= 1000)) {
      socket.emit("plaza-input", { dx: x, dy: y, ...stamp() });
      sent = { x, y };
      sentAt = now;
    }
  }

  /** Set markup only when it changed, and then only the part that did
   *  (no relayout every frame; ui/patch.ts). */
  const setHtml = (el, html) => setInner(el, html);
  const setClass = (el, cls) => {
    if (el.className !== cls) el.className = cls;
  };
  /* ---------- the server's view ---------- */
  socket.on("plaza-profiles", onProfiles);
  function onProfiles(list) {
    for (const p of list) {
      profiles.set(p.id, p);
      const b = others.get(p.id);
      if (b) {
        Object.assign(b, {
          name: p.name,
          bot: !!p.bot,
          character: p.character,
          skin: p.skin,
          colour: p.look?.skin ?? null,
          aura: p.look?.aura ?? null,
          entrance: p.look?.entrance ?? null,
          victory: p.look?.victory ?? null,
          img: imageFor(p.character, p.skin, p.look?.skin ?? null),
        });
        // Their wardrobe comes a moment after they do.
        greetArrival(b);
      }
      // Your own fighter and skins come from your saved wardrobe (look()), at
      // once: the server's copy starts bare until it has read the wardrobe.
      if (p.id === meId) P.name = p.name;
    }
  }
  socket.on("plaza-state", onState);
  function onState(s) {
    meId = s.me;
    offset = s.now - Date.now();
    population = s.population | 0;
    score = s.score;
    if (s.claps > claps && runwayOn)
      for (let i = 0; i < Math.min(4, s.claps - claps); i++) {
        const a = Math.random() * Math.PI;
        FX.push({
          heart: 1,
          x: P.x + Math.cos(a) * 420,
          y: P.y + 260,
          z: 60,
          tx: P.x,
          ty: P.y,
          t: 0,
          life: 0.9 + i * 0.15,
        });
      }
    claps = s.claps;
    lapState = s.lap ?? null;
    if (s.ball) {
      if (
        ball.tx == null ||
        Math.hypot(s.ball[0] - ball.x, s.ball[1] - ball.y) > 300
      ) {
        ball.x = s.ball[0];
        ball.y = s.ball[1];
      }
      ball.tx = s.ball[0];
      ball.ty = s.ball[1];
      ball.tz = s.ball[2];
    }
    const seen = new Set();
    for (const [id, x, y, z, face, flags, emoteIdx, speed] of s.walkers) {
      if (id === s.me) {
        srv = { x, y, flags };
        if (s.ack) {
          const r = predict.server(srv, s.ack, P);
          // Too far to ease (a new spot on joining, a lost stream): go there.
          if (r.snap) {
            predict.shift(x - P.x, y - P.y);
            P.x = x;
            P.y = y;
          }
        }
        srv.acked = !!s.ack;
        if (!(flags & PLAZA_FLAG.boost)) P.boost = 0;
        continue;
      }
      const p = profiles.get(id);
      // Players you blocked aren't drawn, tappable or heard (their emotes).
      if (p?.accountId && options.isBlocked?.(p.accountId)) continue;
      seen.add(id);
      let b = others.get(id);
      if (!b) {
        b = decorate({
          id,
          x,
          y,
          name: p?.name ?? "",
          bot: !!p?.bot,
          character: p?.character ?? "voltkit",
          skin: p?.skin ?? null,
          colour: p?.look?.skin ?? null,
          aura: p?.look?.aura ?? null,
          entrance: p?.look?.entrance ?? null,
          victory: p?.look?.victory ?? null,
          // Arrived while you're here (not in the crowd you joined).
          arrived: performance.now() - enteredAt > 1500 ? performance.now() : 0,
          img: imageFor(
            p?.character ?? "voltkit",
            p?.skin ?? null,
            p?.look?.skin ?? null,
          ),
          emoteIdx: 0,
        });
        others.set(id, b);
        greetArrival(b);
      }
      b.tx = x;
      b.ty = y;
      b.tz = z;
      b.face = face;
      b.flags = flags;
      b.sp = speed;
      b.dash = flags & PLAZA_FLAG.dash ? 1 : 0;
      b.stun = flags & PLAZA_FLAG.stun ? 1 : 0;
      b.buff = flags & PLAZA_FLAG.boost ? 1 : 0;
      const pair = plazaPairOf(emoteIdx, flags),
        ek = pair ? -emoteIdx : emoteIdx;
      if (ek !== b.emoteIdx) {
        b.emoteIdx = ek;
        if (pair) startPair(b, pair);
        else if (emoteIdx) showEmote(b, EMOTE_KEYS[emoteIdx - 1]);
      }
    }
    for (const id of others.keys()) if (!seen.has(id)) others.delete(id);
  }
  let lapState = null,
    lapShown = null,
    /** The lap (its start time) you ran off the lane in: gone from the
     * screen at once, before the server's word arrives a trip later. */
    lapLeft = null;
  function updateRun() {
    const el = $("pz-timer"),
      best = bestLap();
    if (lapShown && performance.now() < lapShown.until) {
      el.hidden = false;
      setHtml(
        el,
        `${lapShown.t.toFixed(2)}<small>${best ? `best ${best.toFixed(2)}` : "lap"}</small>`,
      );
      return;
    }
    if (lapState && !inLapLane(P.x, P.y)) lapLeft = lapState[0];
    if (!lapState || lapState[0] === lapLeft) {
      el.hidden = true;
      return;
    }
    const t = Math.max(0, (serverNow() - lapState[0]) / 1000);
    el.hidden = false;
    setHtml(
      el,
      `${t.toFixed(2)}<small>${Math.min(3, Math.floor(lapState[1] * 4))}/4${best ? ` · best ${best.toFixed(2)}` : ""}</small>`,
    );
  }
  function updateRunway() {
    const on = inRunway(P),
      rc = $("pz-runcard");
    if (on !== runwayOn) {
      runwayOn = on;
      if (on) {
        const skin = starSkin(P) || null;
        rc.innerHTML = `<img src="${P.img.src}" alt=""><div><small>ON THE RUNWAY</small><b>${esc(P.name)}</b><em>${esc(skin ?? "Original look")} · ${esc(options.fighterName(P.character))}</em></div><span class="claps">${I("heart")}<b id="pz-claps">${claps}</b></span>`;
        rc.className = "pz-runcard glass";
        rc.hidden = false;
      } else rc.hidden = true;
    }
    if (on) {
      const c = $("pz-claps");
      if (c && c.textContent !== String(claps)) c.textContent = claps;
    }
  }
  function updateEvent() {
    const el = $("pz-event"),
      s = orbShower(serverNow()),
      now = serverNow();
    if (!s.on) {
      const next = Math.max(0, (s.startsAt - now) / 1000);
      el.hidden = false;
      setClass(el, "pz-event soon");
      setHtml(
        el,
        `<span class="ic">${I("orb")}</span><span>Orb Shower in <b>${next >= 60 ? `${Math.floor(next / 60)}:${String(Math.floor(next % 60)).padStart(2, "0")}` : `${Math.max(0, Math.ceil(next))}s`}</b></span><small>around the fountain</small>`,
      );
      if (wasOn) wasOn = false;
      return;
    }
    if (!wasOn) {
      wasOn = true;
      banner("Orb Shower!", "grab orbs around the fountain", "#c047ff");
    }
    // Shown here too: arriving mid-shower, the pill had never been unhidden.
    el.hidden = false;
    setClass(el, "pz-event");
    setHtml(
      el,
      `<span class="ic">${I("orb")}</span><span>Orb Shower · <b>${Math.max(0, Math.ceil((s.endsAt - now) / 1000))}s</b> left</span><small>catch them for today's quest</small>`,
    );
    for (const o of orbs.values()) {
      const z = orbHeight(now - o.at);
      if (z === 0 && !o.landed) {
        o.landed = true;
        FX.push({ ring: 1, x: o.x, y: o.y, t: 0, life: 0.4, c: o.c });
      }
      o.z = z;
    }
  }
  let wasOn = false;

  /* ---------- draw ---------- */
  function clockText() {
    const m = Math.floor(tod * 24 * 60),
      h = Math.floor(m / 60),
      mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  function night() {
    // 0 day .. 1 night
    const t = tod;
    if (t > 0.3 && t < 0.7) return 0;
    if (t >= 0.7 && t < 0.8) return (t - 0.7) / 0.1;
    if (t >= 0.2 && t <= 0.3) return 1 - (t - 0.2) / 0.1;
    return 1;
  }
  /**
   * The night's light map: each lamp, floodlight and lit window lifts the
   * darkness around it, so what it lights keeps its colours.
   */
  function drawNightMap(g, n, vx0, vy0, vx1, vy1) {
    nightLight.begin(g, [255 - 150 * n, 255 - 132 * n, 255 - 62 * n]);
    nightLight.follow(g);
    const L = (x, y, r, k, flat) => {
      if (x + r < vx0 || x - r > vx1 || y + r < vy0 || y - r > vy1) return;
      nightLight.light(x, y, r, k * n, flat);
    };
    for (const l of LAMPS) L(l.x, l.y - 6, 150, 0.48, 0.6);
    for (const f of FLOOD) L(f.x, f.y - 40, 320, 0.45, 0.66);
    L((PITCH.x0 + PITCH.x1) / 2, (PITCH.y0 + PITCH.y1) / 2, 520, 0.3, 0.7);
    L((LED.x0 + LED.x1) / 2, LED.y1 + 40, 380, 0.35, 0.6);
    L(CAFE.x, CAFE.y - 30, 220, 0.5, 0.7);
    L(FOUNT.x, FOUNT.y - 10, 230, 0.3, 0.7);
    for (const h of HOUSES)
      for (const [wx, wy, ww, wh] of h.spr.win ?? [])
        L(h.x + (wx + ww / 2) * HK, h.y + (wy + wh) * HK, 100, 0.4, 0.8);
    for (const h of HOUSES)
      if (h.spr.lamp)
        L(h.x + h.spr.lamp[0] * HK, h.y + 6, 60, 0.35, 0.8);
    for (const l of RIVER_LAMPS) L(l.x, l.y - 6, 150, 0.48, 0.6);
    for (const o of ev.orbs) L(o.x, o.y - 10, 90, 0.5, 0.8);
    nightLight.end(g);
  }
  function drawLamp(g, l) {
    GFX.shadow(g, l.x + 6, l.y + 2, 18, 6);
    GFX.blit(g, GFX.lamp(), l.x, l.y + 4, PLAZA_SCALE.lamp);
  }
  /** A lamp's head above its foot (the lamp sprite, scaled). */
  const LAMP_HEAD = 78 * PLAZA_SCALE.lamp;
  /** Coins on the fountain's bottom (round its centre, off the column). */
  const FOUNT_COINS = Array.from({ length: 16 }, (_, k) => {
    const a = k * 2.399,
      r = 0.42 + ((k * 37) % 50) / 100;
    return [Math.cos(a) * 96 * r, 2 + Math.sin(a) * 50 * r, k];
  });
  function drawFountain(g, time) {
    // The stonework is baked (plaza-fountain-art.ts); only the water moves.
    // As big as bodies keep clear of (PLAZA_FOUNTAIN, PLAZA_OBSTACLES).
    const { x, y } = FOUNT,
      wr = fountainWater(FOUNT);
    GFX.blit(g, fountainBasin(FOUNT), x, y);
    g.save();
    g.beginPath();
    g.ellipse(x, y + wr.dy, wr.rx, wr.ry, 0, 0, 7);
    g.clip();
    // Wishes: coins on the bottom, a few catching the light in turn.
    for (const [cx, cy, k] of FOUNT_COINS) {
      const tw = low ? 0 : Math.max(0, Math.sin(time * 2.2 + k * 5.3));
      g.fillStyle = "rgba(160,110,20,.55)";
      g.beginPath();
      g.ellipse(x + cx, y + cy, 4.2, 2.4, 0, 0, 7);
      g.fill();
      g.fillStyle = `rgba(255,${214 + tw * 30},${91 + tw * 120},${0.55 + tw * 0.45})`;
      g.beginPath();
      g.ellipse(x + cx - 0.5, y + cy - 0.6, 3.4, 1.9, 0, 0, 7);
      g.fill();
    }
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) {
      const yy = y - 50 + i * 12,
        ph = time * 1.4 + i;
      g.beginPath();
      for (let xx = x - wr.rx; xx < x + wr.rx; xx += 8)
        g.lineTo(xx, yy + Math.sin(xx * 0.05 + ph) * 2.5);
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const k = (time * 0.5 + i / 3) % 1;
      g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, y - 2, 30 + k * 80, 18 + k * 50, 0, 0, 7);
      g.stroke();
    }
    if (!low) {
      // Splashes where the falling water lands, and glints of sun on the
      // water that come and go.
      for (let i = -6; i <= 6; i += 2) {
        const a = Math.PI / 2 + i * 0.2,
          k = (time * 1.6 + i * 0.37 + 10) % 1,
          sx = x + Math.cos(a) * 96,
          sy = y - 56 + Math.sin(a) * 28 + 54;
        g.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
        g.lineWidth = 1.4;
        g.beginPath();
        g.ellipse(sx, sy, 3 + k * 9, 1.5 + k * 4, 0, 0, 7);
        g.stroke();
      }
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 7; i++) {
        const tw = Math.sin(time * 3.1 + i * 2.7);
        if (tw < 0.6) continue;
        const gx = x - 70 + ((i * 53) % 140),
          gy = y - 30 + ((i * 29) % 60);
        g.globalAlpha = (tw - 0.6) * 2.2;
        g.fillRect(gx - 3, gy - 0.6, 6, 1.2);
        g.fillRect(gx - 0.6, gy - 2, 1.2, 4);
      }
      g.globalAlpha = 1;
    }
    g.restore();
    // The pillars and bowls.
    GFX.blit(g, fountainTiers(), x, y);
    // water curtain from middle bowl
    g.strokeStyle = "rgba(220,250,255,.55)";
    g.lineWidth = 3;
    g.setLineDash([10, 8]);
    g.lineDashOffset = -time * 60;
    for (let i = -6; i <= 6; i++) {
      const a = Math.PI / 2 + i * 0.2,
        px = x + Math.cos(a) * 62,
        py = y - 56 + Math.sin(a) * 28;
      g.beginPath();
      g.moveTo(px, py);
      g.quadraticCurveTo(
        px + Math.cos(a) * 26,
        py + 10,
        px + Math.cos(a) * 34,
        py + 54,
      );
      g.stroke();
    }
    g.setLineDash([]);
    // jet + floating crystal
    g.fillStyle = "rgba(220,250,255,.75)";
    g.beginPath();
    g.ellipse(x, y - 132 - Math.sin(time * 6) * 3, 5, 22, 0, 0, 7);
    g.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + time * 0.5,
        k = (time * 1.3 + i * 0.37) % 1,
        px = x + Math.cos(a) * (8 + k * 26),
        py = y - 150 + k * k * 46 - Math.sin(k * Math.PI) * 22;
      g.fillStyle = `rgba(235,252,255,${1 - k * 0.5})`;
      g.beginPath();
      g.arc(px, py, 2.4 * (1 - k * 0.4), 0, 7);
      g.fill();
    }
    const cy = y - 196 + Math.sin(time * 1.6) * 6,
      hue = (time * 40) % 360;
    const cg = g.createRadialGradient(x, cy, 2, x, cy, 46);
    cg.addColorStop(0, `hsla(${hue},90%,75%,.55)`);
    cg.addColorStop(1, `hsla(${hue},90%,75%,0)`);
    g.fillStyle = cg;
    g.beginPath();
    g.arc(x, cy, 46, 0, 7);
    g.fill();
    g.save();
    g.translate(x, cy);
    g.scale(Math.cos(time * 1.2), 1);
    g.beginPath();
    g.moveTo(0, -24);
    g.lineTo(13, -4);
    g.lineTo(0, 22);
    g.lineTo(-13, -4);
    g.closePath();
    const gem = g.createLinearGradient(-13, -24, 13, 22);
    gem.addColorStop(0, "#ffffff");
    gem.addColorStop(0.4, `hsl(${hue},85%,70%)`);
    gem.addColorStop(1, `hsl(${(hue + 60) % 360},80%,45%)`);
    g.fillStyle = gem;
    g.fill();
    g.strokeStyle = "rgba(255,255,255,.8)";
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }
  function drawLED(g, time) {
    const { x0, x1, y0, y1 } = LED,
      w = x1 - x0,
      h = y1 - y0;
    // truss + legs
    g.fillStyle = "#1a1a24";
    g.fillRect(x0 - 24, y0 - 34, w + 48, 16);
    [x0 - 24, x1 + 10].forEach((x) =>
      g.fillRect(x, y0 - 34, 14, STAGE.y0 - y0 + 34),
    );
    for (let i = 0; i < 6; i++) {
      const x = x0 + 30 + (i * (w - 60)) / 5;
      g.fillStyle = "#2b2b38";
      g.beginPath();
      g.arc(x, y0 - 20, 9, 0, 7);
      g.fill();
      g.fillStyle = `rgba(255,240,200,${0.5 + 0.5 * Math.sin(time * 3 + i)})`;
      g.beginPath();
      g.arc(x, y0 - 14, 5, 0, 7);
      g.fill();
    }
    // screen
    g.fillStyle = "#07060f";
    g.fillRect(x0 - 6, y0 - 6, w + 12, h + 12);
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    const hshift = (time * 30) % 360;
    gr.addColorStop(0, `hsl(${(300 + hshift) % 360} 80% 28%)`);
    gr.addColorStop(1, `hsl(${(220 + hshift) % 360} 80% 22%)`);
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
    g.save();
    g.beginPath();
    g.rect(x0, y0, w, h);
    g.clip();
    const star = runwayOn ? P : [...others.values()].find((n) => inRunway(n));
    if (star && star.img?.sprite) {
      g.drawImage(star.img.sprite, x0 + 20, y0 + 6, h * 0.99, h * 1.0);
      g.textAlign = "left";
      g.fillStyle = "#ff9bd2";
      g.font = "800 16px 'DM Sans', sans-serif";
      g.fillText("ON THE RUNWAY", x0 + h + 34, y0 + 40);
      g.fillStyle = "#fff";
      g.font = "800 46px 'Barlow Condensed', sans-serif";
      g.fillText(String(star.name).toUpperCase(), x0 + h + 34, y0 + 86);
      g.fillStyle = "#ffd65b";
      g.font = "700 20px 'DM Sans', sans-serif";
      g.fillText(starSkin(star), x0 + h + 34, y0 + 118);
      if (star.me) {
        const sw = g.measureText(starSkin(star)).width,
          hi = ICON_IMG("heart");
        if (hi.complete) g.drawImage(hi, x0 + h + 46 + sw, y0 + 101, 22, 22);
        g.fillText(String(claps), x0 + h + 72 + sw, y0 + 118);
      }
    } else {
      g.textAlign = "center";
      g.fillStyle = "#fff";
      g.font = "800 64px 'Barlow Condensed', sans-serif";
      g.fillText("RUNWAY", (x0 + x1) / 2, y0 + 84);
      g.fillStyle = "#ff9bd2";
      g.font = "700 18px 'DM Sans', sans-serif";
      g.fillText(
        ev.on ? "ORB SHOWER IN PROGRESS" : "STEP UP TO SHOW OFF YOUR SKIN",
        (x0 + x1) / 2,
        y0 + 118,
      );
    }
    g.fillStyle = "rgba(0,0,0,.18)";
    for (let y = y0; y < y1; y += 4) g.fillRect(x0, y, w, 1.5);
    g.restore();
    // speakers
    [x0 - 70, x1 + 30].forEach((x) => {
      g.fillStyle = "#15151f";
      g.fillRect(x, STAGE.y0 - 120, 40, 120);
      g.fillStyle = "#2c2c3a";
      [STAGE.y0 - 96, STAGE.y0 - 46].forEach((y) => {
        g.beginPath();
        g.arc(x + 20, y, 14, 0, 7);
        g.fill();
      });
    });
  }
  /**
   * A goal runs away from the viewer (along y), so it is drawn in slices
   * (plaza-depth.ts): someone in its mouth stands between its far post and
   * its near one, the crossbar passing in front of or behind them.
   */
  const GOAL_SLICES = 6;
  function goalDrawables(g, x, left) {
    const y0 = PITCH.gy0,
      y1 = PITCH.gy1,
      d = left ? -46 : 46,
      hgt = PLAZA_SCALE.goal;
    return slices(
      Math.min(x, x + d),
      Math.max(x, x + d),
      y0,
      y1,
      GOAL_SLICES,
      hgt,
      (ya, yb, i) => {
        g.strokeStyle = "rgba(255,255,255,.55)";
        g.lineWidth = 1;
        g.beginPath();
        // The net's rib at this slice's far edge (and the last one's near edge).
        for (const yy of i === GOAL_SLICES - 1 ? [ya, yb] : [ya]) {
          g.moveTo(x, yy - hgt);
          g.lineTo(x + d, yy - hgt * 0.6);
          g.lineTo(x + d, yy);
        }
        // The net's long strands along this slice, at the back and the top.
        for (let k = 0; k <= 4; k++) {
          const hh = (hgt * k) / 4;
          g.moveTo(x, ya - hh);
          g.lineTo(x, yb - hh);
        }
        g.moveTo(x + d, ya - hgt * 0.6);
        g.lineTo(x + d, yb - hgt * 0.6);
        g.moveTo(x + d, ya);
        g.lineTo(x + d, yb);
        g.stroke();
        g.strokeStyle = "#fff";
        g.lineWidth = 5;
        g.lineCap = "round";
        g.beginPath();
        if (i === 0) {
          g.moveTo(x, y0);
          g.lineTo(x, y0 - hgt);
        }
        if (i === GOAL_SLICES - 1) {
          g.moveTo(x, y1);
          g.lineTo(x, y1 - hgt);
        }
        g.stroke();
        g.lineCap = "butt";
        // The crossbar, in the team's colour.
        g.strokeStyle = left ? "#5ab0ff" : "#ff5d6c";
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(x, ya - hgt);
        g.lineTo(x, yb - hgt);
        g.stroke();
      },
      { name: left ? "goal-left" : "goal-right" },
    );
  }
  /** A corner flag: a white pole and a pennant in the side's colour,
   * rippling in the breeze (a still pennant on Low graphics). */
  function drawCornerFlag(g, x, y, i, time) {
    GFX.shadow(g, x + 2, y + 1, 6, 2);
    g.fillStyle = "#f6f6f6";
    g.fillRect(x - 1.5, y - 44, 3, 44);
    g.fillStyle = "#c9c9c9";
    g.fillRect(x + 0.5, y - 44, 1, 44);
    const c = x < (PITCH.x0 + PITCH.x1) / 2 ? "#4fb3ff" : "#ef4f61",
      t = low ? 0 : time * 6 + i * 1.7;
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x + 1.5, y - 44);
    for (let k = 1; k <= 4; k++)
      g.lineTo(x + 1.5 + k * 4.5, y - 44 + Math.sin(t + k) * k * 0.6 + k * 0.5);
    for (let k = 4; k >= 1; k--)
      g.lineTo(x + 1.5 + k * 4.5, y - 32 + Math.sin(t + k) * k * 0.6 - k * 0.9);
    g.lineTo(x + 1.5, y - 31);
    g.closePath();
    g.fill();
    g.fillStyle = "#ffd65b";
    g.beginPath();
    g.arc(x, y - 45, 2.4, 0, 7);
    g.fill();
  }
  /** Dragonflies over the pond: they hover, then dart to a new spot. */
  const DRAGONFLIES = [0, 1, 2].map((i) => ({
    x: POND.x - 80 + i * 70,
    y: POND.y - 30 + i * 18,
    tx: POND.x,
    ty: POND.y,
    wait: i * 0.7,
    c: ["#4fd0ff", "#ff7fb8", "#8fe36a"][i],
  }));
  let dragonT = 0;
  function drawDragonflies(g, time) {
    const dt = Math.min(0.05, Math.max(0, time - dragonT));
    dragonT = time;
    for (const d of DRAGONFLIES) {
      if ((d.wait -= dt) <= 0) {
        // A new spot over the water or the reeds by the dock.
        const a = Math.random() * Math.PI * 2,
          r = 0.3 + Math.random() * 0.75;
        d.tx = POND.x + Math.cos(a) * POND.rx * r;
        d.ty = POND.y + Math.sin(a) * POND.ry * r;
        d.wait = 1.2 + Math.random() * 2.5;
      }
      const k = Math.min(1, dt * 4);
      d.x += (d.tx - d.x) * k;
      d.y += (d.ty - d.y) * k;
      const hx = d.x + Math.sin(time * 3 + d.c.length) * 2,
        hy = d.y - 34 + Math.sin(time * 5 + d.x) * 2,
        face = d.tx >= d.x ? 1 : -1;
      GFX.shadow(g, d.x, d.y, 5, 1.6, 0.14);
      g.save();
      g.translate(hx, hy);
      g.scale(face, 1);
      // Wings: a blur of four, flickering.
      const f = 0.55 + 0.45 * Math.abs(Math.sin(time * 40 + d.x));
      g.fillStyle = `rgba(230,250,255,${0.55 * f})`;
      for (const [wx, wy, r] of [
        [-1, -1, -0.5],
        [-1, 1, 0.5],
        [2, -1, -0.3],
        [2, 1, 0.3],
      ]) {
        g.beginPath();
        g.ellipse(wx, wy * 4, 6, 2, r, 0, 7);
        g.fill();
      }
      g.fillStyle = d.c;
      g.fillRect(-9, -0.8, 12, 1.6);
      g.beginPath();
      g.arc(4.5, 0, 2.2, 0, 7);
      g.fill();
      g.restore();
    }
  }
  /** How each kind of PLAZA_DECOR is drawn: its picture, footprint half
   * width, height, and ground shadow (none for reeds and pots). */
  const DECOR_ART = {
    rodrack: { spr: () => GFX.rodRack(), foot: 26, h: 90, shadow: [26, 5] },
    bucket: { spr: () => GFX.bucket(), foot: 14, h: 50, shadow: [14, 5] },
    tackle: { spr: () => GFX.tackleBox(), foot: 14, h: 50, shadow: [14, 5] },
    rowboat: { spr: () => GFX.rowboat(), foot: 56, h: 50, shadow: [58, 9] },
    reeds: { spr: (seed) => GFX.reeds(seed), foot: 14, h: 70 },
    chalkboard: {
      spr: () => GFX.chalkboard(),
      foot: 20,
      h: 80,
      shadow: [20, 5],
    },
    parasol: {
      spr: () => GFX.parasol(),
      foot: 34,
      h: 118,
      shadow: [40, 9],
      sw: 56,
    },
    pot: {
      spr: (seed) => GFX.flowerPot(seed),
      foot: 12,
      h: 44,
      shadow: [11, 4],
    },
  };
  function drawFlood(g, f, n) {
    g.fillStyle = "rgba(0,0,0,.25)";
    g.beginPath();
    g.ellipse(f.x + 10, f.y + 2, 16, 6, 0, 0, 7);
    g.fill();
    g.fillStyle = "#3a3f52";
    g.fillRect(f.x - 4, f.y - 230, 8, 232);
    g.fillStyle = "#222634";
    g.fillRect(f.x - 26, f.y - 252, 52, 26);
    g.fillStyle = n > 0.3 ? "#fff8d8" : "#c9cfdc";
    for (let i = 0; i < 3; i++)
      g.fillRect(f.x - 22 + i * 16, f.y - 248, 12, 18);
  }
  function drawScoreboard(g) {
    const x = (PITCH.x0 + PITCH.x1) / 2,
      y = PITCH.y0 - 50;
    g.fillStyle = "#1a1a24";
    g.fillRect(x - 6, y - 10, 12, 50);
    g.fillStyle = "#0b0b14";
    g.fillRect(x - 120, y - 92, 240, 84);
    g.fillStyle = "#162040";
    g.fillRect(x - 114, y - 86, 228, 72);
    g.textAlign = "center";
    g.font = "700 14px 'DM Sans', sans-serif";
    g.fillStyle = "#9fb0d8";
    g.fillText("ORB BALL", x, y - 66);
    g.font = "800 44px 'Barlow Condensed', sans-serif";
    g.fillStyle = "#5ab0ff";
    g.fillText(score[0], x - 50, y - 24);
    g.fillStyle = "#fff";
    g.fillText(":", x, y - 26);
    g.fillStyle = "#ff5d6c";
    g.fillText(score[1], x + 50, y - 24);
  }
  /**
   * The lap gantry spans the lane from its outer edge to its inner one,
   * along the view's depth, so in this front-and-above view its posts,
   * beam and sign stack into one column over the start line. Drawn part by
   * part in depth order, the beam's near half and the near post striped
   * whoever stood on the line, name tag and all, and the beam cut through
   * its own sign. It is one picture instead, standing at the lane's far
   * edge: a runner anywhere on the line, or in front of it, is drawn over
   * it; someone beyond the far edge, under it. The sign is painted last,
   * so nothing of the gantry crosses it. `below` lets its box on screen
   * reach the near post's foot; `always`, because its foot (the far edge)
   * can be above the view while the near post is in it.
   */
  function gantryDrawables(g) {
    const x = TRACK.cx,
      ya = TRACK.cy - TRACK.ro[1] - 4,
      yb = TRACK.cy - TRACK.ri[1] + 4;
    return [
      {
        x0: x - 10,
        x1: x + 10,
        y0: ya - 2,
        y1: ya,
        h: 172,
        sw: 96,
        below: yb - ya + 2,
        always: true,
        name: "gantry",
        draw: () => drawGantry(g, x, ya, yb),
      },
    ];
  }
  function drawGantry(g, x, ya, yb) {
    g.fillStyle = "#2a2f42";
    g.fillRect(x - 6, ya - 150, 12, 152);
    // The beam, seen from above: a strip from its far end to its near one.
    g.fillStyle = "#11131d";
    g.fillRect(x - 10, ya - 170, 20, yb - ya + 1);
    g.fillStyle = "#2a2f42";
    g.fillRect(x - 6, yb - 150, 12, 152);
    drawGantrySign(g, x, ya, yb);
  }
  function drawGantrySign(g, x, ya, yb) {
    g.save();
    g.translate(x, (ya + yb) / 2 - 160);
    g.fillStyle = "#0b0d16";
    g.fillRect(-96, -26, 192, 52);
    g.fillStyle = "#1c2448";
    g.fillRect(-90, -20, 180, 40);
    g.textAlign = "center";
    g.fillStyle = "#ffd65b";
    g.font = "800 26px 'Barlow Condensed', sans-serif";
    g.fillText(
      lapState
        ? ((serverNow() - lapState[0]) / 1000).toFixed(2)
        : bestLap()
          ? `BEST ${bestLap().toFixed(2)}`
          : "TOP DASH",
      0,
      9,
    );
    g.restore();
  }
  /**
   * A hurdle never moves: drawn once into its own picture (twice the
   * resolution) and copied after, so its thin dashed bar doesn't shimmer
   * as the camera glides a fraction of a pixel each frame. Kept by the
   * hurdle's number (one picture each): keyed by its [p0, p1] pair, the
   * depth order's fresh pair every frame never matched, and each frame made
   * and kept a new picture per hurdle in view (two a frame where you
   * start on an iPhone, about 120 a second at 60 fps, never let go;
   * 19 Nov 2026).
   */
  const hurdlePics = new Map();
  function drawHurdle(g, i) {
    const seg = HSEG[i];
    const [p0, p1] = seg;
    let pic = hurdlePics.get(i);
    if (!pic) {
      const pad = 12,
        k = 2,
        x0 = Math.min(p0.x, p1.x) - pad,
        y0 = Math.min(p0.y, p1.y) - PLAZA_SCALE.hurdle - pad,
        x1 = Math.max(p0.x, p1.x) + pad,
        y1 = Math.max(p0.y, p1.y) + pad;
      const c = document.createElement("canvas");
      c.width = Math.ceil((x1 - x0) * k);
      c.height = Math.ceil((y1 - y0) * k);
      const cg = c.getContext("2d");
      cg.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
      paintHurdle(cg, seg);
      pic = { c, x0, y0, w: x1 - x0, h: y1 - y0 };
      hurdlePics.set(i, pic);
    }
    g.drawImage(pic.c, pic.x0, pic.y0, pic.w, pic.h);
  }
  function paintHurdle(g, [p0, p1]) {
    g.strokeStyle = "rgba(0,0,0,.3)";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(p0.x, p0.y + 4);
    g.lineTo(p1.x, p1.y + 4);
    g.stroke();
    const hb = PLAZA_SCALE.hurdle;
    g.fillStyle = "#e6e6ee";
    [p0, p1].forEach((p) => g.fillRect(p.x - 3, p.y - hb - 2, 6, hb + 4));
    g.lineCap = "butt";
    g.strokeStyle = "#fff";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(p0.x, p0.y - hb);
    g.lineTo(p1.x, p1.y - hb);
    g.stroke();
    g.strokeStyle = "#ef4f61";
    g.setLineDash([14, 14]);
    g.beginPath();
    g.moveTo(p0.x, p0.y - hb);
    g.lineTo(p1.x, p1.y - hb);
    g.stroke();
    g.setLineDash([]);
  }
  /**
   * The TOP DASH board: a stadium scoreboard on two legs, a gold header with
   * the trophy, medals for the top three, your row lit, and bulbs along its
   * top. Painted into a sprite whenever the week's rows change (not every
   * frame); the bulbs twinkle live.
   */
  let leaderSpr = null,
    leaderKey = "",
    leaderTry = null,
    leaderAt = 0;
  function leaderSprite() {
    const rows = boardRows().slice(0, 5);
    const key = rows.map(([n, t, m]) => `${n}|${t}|${m}`).join(";");
    const ready = ICON_IMG("trophy")?.complete;
    if (leaderSpr && key === leaderKey) return leaderSpr;
    // Before the trophy has loaded: the last one, again at most twice a second.
    if (leaderTry && key === leaderKey && performance.now() - leaderAt < 500)
      return leaderTry;
    leaderAt = performance.now();
    const R = 2,
      w = 200,
      h = 262,
      ax = 100,
      ay = 254;
    const c = document.createElement("canvas");
    c.width = w * R;
    c.height = h * R;
    const g = c.getContext("2d");
    g.scale(R, R);
    g.translate(ax, ay);
    // Legs on base plates.
    for (const lx of [-66, 58]) {
      const lg = g.createLinearGradient(lx, 0, lx + 8, 0);
      lg.addColorStop(0, "#4a5068");
      lg.addColorStop(1, "#262a3a");
      g.fillStyle = lg;
      g.fillRect(lx, -110, 8, 110);
      g.fillStyle = "#1c2030";
      g.beginPath();
      g.roundRect(lx - 6, -6, 20, 7, 2);
      g.fill();
    }
    // The cabinet: a bevelled steel frame round a navy screen.
    g.fillStyle = "rgba(0,0,0,.3)";
    g.beginPath();
    g.roundRect(-92, -246, 190, 146, 10);
    g.fill();
    const fr = g.createLinearGradient(0, -250, 0, -100);
    fr.addColorStop(0, "#5a6280");
    fr.addColorStop(0.5, "#2f3550");
    fr.addColorStop(1, "#1f2438");
    g.fillStyle = fr;
    g.beginPath();
    g.roundRect(-94, -250, 188, 146, 10);
    g.fill();
    g.fillStyle = "#0d1226";
    g.beginPath();
    g.roundRect(-86, -242, 172, 130, 6);
    g.fill();
    for (const [bx, by] of [
      [-88, -244],
      [88, -244],
      [-88, -110],
      [88, -110],
    ]) {
      g.fillStyle = "#8a92b0";
      g.beginPath();
      g.arc(bx, by, 2, 0, 7);
      g.fill();
    }
    // Gold header band with the trophy.
    const hb = g.createLinearGradient(0, -240, 0, -214);
    hb.addColorStop(0, "#ffe58a");
    hb.addColorStop(1, "#e0a020");
    g.fillStyle = hb;
    g.beginPath();
    g.roundRect(-84, -240, 168, 26, 5);
    g.fill();
    const tr = ICON_IMG("trophy");
    if (tr?.complete) g.drawImage(tr, -78, -238, 22, 22);
    g.fillStyle = "#3a2406";
    g.font = "800 19px 'Barlow Condensed', sans-serif";
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText("TOP DASH", -52, -226);
    g.textAlign = "right";
    g.font = "800 10px 'DM Sans', sans-serif";
    g.fillText("THIS WEEK", 78, -226);
    // Rows: medals for the top three, your row lit.
    const MEDAL = ["#ffd65b", "#d6dbe6", "#e0995a"];
    if (!rows.length) {
      g.textAlign = "center";
      g.fillStyle = "#a0afc8";
      g.font = "700 13px 'DM Sans', sans-serif";
      g.fillText("No laps this week yet", 0, -176);
      g.fillStyle = "#ffd65b";
      g.font = "800 13px 'DM Sans', sans-serif";
      g.fillText("Be the first!", 0, -156);
    }
    rows.forEach(([n, t, mine], i) => {
      const ry = -198 + i * 20;
      if (i % 2) {
        g.fillStyle = "rgba(255,255,255,.04)";
        g.fillRect(-84, ry - 10, 168, 20);
      }
      if (mine) {
        g.fillStyle = "rgba(255,214,91,.16)";
        g.fillRect(-84, ry - 10, 168, 20);
        g.fillStyle = "#ffd65b";
        g.fillRect(-84, ry - 10, 3, 20);
      }
      if (i < 3) {
        g.fillStyle = MEDAL[i];
        g.beginPath();
        g.arc(-70, ry, 7.5, 0, 7);
        g.fill();
        g.fillStyle = "rgba(0,0,0,.55)";
        g.font = "800 10px 'DM Sans', sans-serif";
        g.textAlign = "center";
        g.fillText(String(i + 1), -70, ry + 0.5);
      } else {
        g.fillStyle = "#7f8bb0";
        g.font = "800 11px 'DM Sans', sans-serif";
        g.textAlign = "center";
        g.fillText(String(i + 1), -70, ry + 0.5);
      }
      g.textAlign = "left";
      g.fillStyle = mine ? "#ffd65b" : "#e6ecff";
      g.font = "700 13px 'DM Sans', sans-serif";
      let name = String(n);
      while (name.length > 3 && g.measureText(name).width > 100)
        name = name.slice(0, -2) + "…";
      g.fillText(name, -56, ry + 0.5);
      g.textAlign = "right";
      g.font = "800 13px 'DM Sans', sans-serif";
      g.fillText(t.toFixed(2), 78, ry + 0.5);
    });
    g.textBaseline = "alphabetic";
    const spr = { c, w, h, ax, ay };
    leaderKey = key;
    if (ready) leaderSpr = spr;
    else leaderSpr = null;
    return (leaderTry = spr);
  }
  function drawLeader(g, time) {
    const { x, y } = LEADER;
    GFX.shadow(g, x + 10, y + 3, 92, 14, 0.25);
    GFX.blit(g, leaderSprite(), x, y);
    // Bulbs along the top, chasing.
    for (let i = 0; i < 9; i++) {
      const bx = x - 80 + i * 20,
        on = low ? 1 : 0.55 + 0.45 * Math.sin(time * 4 - i * 0.8);
      g.fillStyle = `rgba(255,236,170,${on})`;
      g.beginPath();
      g.arc(bx, y - 254, 2.6, 0, 7);
      g.fill();
    }
  }
  /** The Photo Spot's camera, seen from behind: it stands in front of the
   * arch on its own feet (not against a post) and points at the spot. */
  function drawCamera(g) {
    const { x: cx, y: cy } = PLAZA_PHOTO_CAMERA;
    g.save();
    g.fillStyle = "rgba(0,0,0,.18)";
    g.beginPath();
    g.ellipse(cx, cy + 1, 18, 5, 0, 0, 7);
    g.fill();
    g.strokeStyle = "#2c3348";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx, cy - 46);
    g.lineTo(cx - 14, cy);
    g.moveTo(cx, cy - 46);
    g.lineTo(cx + 14, cy);
    g.moveTo(cx, cy - 46);
    g.lineTo(cx + 3, cy - 6);
    g.stroke();
    // The lens, toward the arch (up and to the right), behind the body.
    g.fillStyle = "#1f2536";
    g.beginPath();
    g.roundRect(cx + 4, cy - 76, 14, 12, 3);
    g.fill();
    g.fillStyle = "#2c3348";
    g.beginPath();
    g.roundRect(cx - 16, cy - 66, 32, 22, 5);
    g.fill();
    // Its back: the screen, and the red light while it is ready.
    g.fillStyle = "#8fd0ff";
    g.beginPath();
    g.roundRect(cx - 11, cy - 62, 17, 13, 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.5)";
    g.fillRect(cx - 9, cy - 60, 6, 3);
    g.fillStyle = "#ef4f61";
    g.beginPath();
    g.arc(cx + 11, cy - 60, 2.5, 0, 7);
    g.fill();
    g.restore();
  }
  function drawPhoto(g, time) {
    const { x, y } = PHOTO;
    // The two bushes stand together west of the arch, clear of its posts,
    // the tripod, the stage and the lane in front (they used to sit on both
    // posts' feet, half hiding them).
    const post = (px) => {
      const gg = g.createLinearGradient(px - 6, 0, px + 6, 0);
      gg.addColorStop(0, "#fffaf0");
      gg.addColorStop(1, "#c9bfae");
      g.fillStyle = gg;
      g.beginPath();
      g.roundRect(px - 6, y - 150, 12, 152, 4);
      g.fill();
    };
    post(x - 80);
    post(x + 80);
    g.strokeStyle = "#3f8f3a";
    g.lineWidth = 20;
    g.beginPath();
    g.arc(x, y - 150, 80, Math.PI, 0);
    g.stroke();
    g.strokeStyle = "#5fbf4f";
    g.lineWidth = 14;
    g.stroke();
    for (let i = 0; i < 15; i++) {
      const a = Math.PI + (i / 14) * Math.PI,
        px = x + Math.cos(a) * 80,
        py = y - 150 + Math.sin(a) * 80,
        c = ["#ff8fb8", "#ffffff", "#ffd65b"][i % 3];
      for (let k = 0; k < 5; k++) {
        g.fillStyle = c;
        g.beginPath();
        g.arc(
          px + Math.cos(k * 1.256) * 4,
          py + Math.sin(k * 1.256) * 4,
          3.6,
          0,
          7,
        );
        g.fill();
      }
      g.fillStyle = "#ffcf3a";
      g.beginPath();
      g.arc(px, py, 2.4, 0, 7);
      g.fill();
    }
    g.textAlign = "center";
    g.font = "800 22px 'Barlow Condensed', sans-serif";
    g.fillStyle = "#fff";
    g.strokeStyle = "#2a1f4c";
    g.lineWidth = 4;
    g.lineJoin = "round";
    g.strokeText("PHOTO SPOT", x, y - 246);
    g.fillText("PHOTO SPOT", x, y - 246);
  }
  function drawCafe(g) {
    GFX.blit(g, GFX.foodTruck(), CAFE.x, CAFE.y + 4);
  }
  /**
   * The Plaza map board ("you are here"): the same painted map as the Map
   * dialog, framed on two posts under a little roof, with a red pin where
   * the board stands. Painted once, the first time it is drawn.
   */
  let boardSpr = null,
    boardTry = null,
    boardTryAt = 0;
  function mapBoard() {
    if (boardSpr) return boardSpr;
    // Not all drawn yet: the last try, again at most twice a second.
    if (boardTry && performance.now() - boardTryAt < 500) return boardTry;
    boardTryAt = performance.now();
    const R = 2,
      w = 168,
      h = 190,
      ax = 84,
      ay = 182;
    const c = document.createElement("canvas");
    c.width = w * R;
    c.height = h * R;
    const g = c.getContext("2d");
    g.scale(R, R);
    g.translate(ax, ay);
    // Posts.
    for (const x of [-66, 58]) {
      const pg = g.createLinearGradient(x, 0, x + 8, 0);
      pg.addColorStop(0, "#8a5a30");
      pg.addColorStop(1, "#5a3a1e");
      g.fillStyle = pg;
      g.beginPath();
      g.roundRect(x, -150, 8, 150, 3);
      g.fill();
    }
    // The frame and the map in it.
    g.fillStyle = "rgba(0,0,0,.3)";
    g.beginPath();
    g.roundRect(-72, -138, 148, 102, 8);
    g.fill();
    const fg = g.createLinearGradient(0, -142, 0, -40);
    fg.addColorStop(0, "#c98d52");
    fg.addColorStop(1, "#8f5a2c");
    g.fillStyle = fg;
    g.beginPath();
    g.roundRect(-74, -142, 148, 102, 8);
    g.fill();
    g.strokeStyle = "#4e2c12";
    g.lineWidth = 2.5;
    g.stroke();
    const mw = 132,
      mh = Math.round((mw * H) / W),
      mx = -mw / 2,
      my = -134;
    g.drawImage(boardPic, mx, my, mw, mh);
    g.strokeStyle = "rgba(60,30,10,.6)";
    g.lineWidth = 1.5;
    g.strokeRect(mx, my, mw, mh);
    // The places' icons, small, and the red "you are here" pin.
    for (const p of PLAZA_PLACES) {
      const im = ICON_IMG(p.icon);
      const px = mx + (p.x / W) * mw,
        py = my + (p.y / H) * mh;
      g.fillStyle = "rgba(255,255,255,.9)";
      g.beginPath();
      g.arc(px, py, 5.5, 0, 7);
      g.fill();
      if (im?.complete) g.drawImage(im, px - 4.5, py - 4.5, 9, 9);
    }
    {
      const px = mx + (BOARD.x / W) * mw,
        py = my + (BOARD.y / H) * mh;
      g.fillStyle = "#ef4f61";
      g.strokeStyle = "#fff";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(px, py);
      g.bezierCurveTo(px - 7, py - 7, px - 5, py - 13, px, py - 13);
      g.bezierCurveTo(px + 5, py - 13, px + 7, py - 7, px, py);
      g.fill();
      g.stroke();
    }
    // The roof and its sign.
    g.beginPath();
    g.moveTo(-86, -140);
    g.lineTo(0, -170);
    g.lineTo(86, -140);
    g.closePath();
    const rg = g.createLinearGradient(0, -170, 0, -140);
    rg.addColorStop(0, "#4fb3a8");
    rg.addColorStop(1, "#1f6b6a");
    g.fillStyle = rg;
    g.fill();
    g.strokeStyle = "#143f40";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = "#fff4d6";
    g.strokeStyle = "#2a1f12";
    g.lineWidth = 3.5;
    g.font = "800 17px 'Barlow Condensed', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.strokeText("PLAZA MAP", 0, -150);
    g.fillText("PLAZA MAP", 0, -150);
    // Kept once its icons have drawn (data pictures, a moment after load;
    // until then it is put together again at most twice a second, from the
    // map picture made once in prep, never from the whole ground).
    const done = PLAZA_PLACES.every((p) => ICON_IMG(p.icon)?.complete);
    const spr = { c, w, h, ax, ay };
    if (done) boardSpr = spr;
    return (boardTry = spr);
  }
  function drawBoard(g) {
    GFX.shadow(g, BOARD.x + 8, BOARD.y + 2, 76, 14);
    GFX.blit(g, mapBoard(), BOARD.x, BOARD.y + 4);
  }
  function drawGate(g) {
    const { x, y } = GATE;
    [x - 70, x + 70].forEach((px) => {
      const gg = g.createLinearGradient(px - 9, 0, px + 9, 0);
      gg.addColorStop(0, "#c48a4a");
      gg.addColorStop(1, "#7a5230");
      g.fillStyle = gg;
      g.beginPath();
      g.roundRect(px - 9, y - 116, 18, 120, 4);
      g.fill();
    });
    g.strokeStyle = "#3f8f3a";
    g.lineWidth = 22;
    g.beginPath();
    g.arc(x, y - 112, 70, Math.PI, 0);
    g.stroke();
    g.strokeStyle = "#6fcf5a";
    g.lineWidth = 15;
    g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (i / 11) * Math.PI;
      GFX.ball(
        g,
        x + Math.cos(a) * 70,
        y - 112 + Math.sin(a) * 70,
        6,
        ["#ff8fb8", "#ffd65b", "#ffffff"][i % 3],
      );
    }
  }
  const HK = PLAZA_SCALE.house;
  function drawHouse(g, h, n) {
    GFX.shadow(g, h.x + 30 * HK, h.y + 4, 110 * HK, 22 * HK);
    GFX.blit(g, h.spr, h.x, h.y, HK);
    if (n > 0.05 && h.spr.win)
      h.spr.win.forEach(([wx, wy, ww, wh]) => {
        g.fillStyle = `rgba(255,214,120,${0.85 * n})`;
        g.beginPath();
        g.roundRect(h.x + wx * HK, h.y + wy * HK, ww * HK, wh * HK, 3 * HK);
        g.fill();
      });
    // The porch lantern by the door, lit at dusk.
    if (n > 0.05 && h.spr.lamp) {
      const [lx, ly] = h.spr.lamp;
      g.fillStyle = `rgba(255,236,170,${0.9 * n})`;
      g.beginPath();
      g.arc(h.x + lx * HK, h.y + ly * HK, 3.2 * HK, 0, 7);
      g.fill();
    }
  }
  function drawBody(g, b, time, photo) {
    const s = PLAZA_SPRITE_PX,
      im = b.img;
    const sh = 1 - Math.min(0.6, b.z / 220);
    g.fillStyle = "rgba(0,0,0,.28)";
    g.beginPath();
    g.ellipse(b.x, b.y, 24 * sh, 9 * sh, 0, 0, 7);
    g.fill();
    if (b.me && !photo) {
      g.strokeStyle = b.buff > 0 ? "#ffd84a" : "#ffd65b";
      g.lineWidth = 2.5;
      g.beginPath();
      g.ellipse(b.x, b.y, 29, 11, 0, 0, 7);
      g.stroke();
      if (b.buff > 0) {
        g.strokeStyle = `rgba(255,216,74,${0.4 + 0.3 * Math.sin(time * 10)})`;
        g.beginPath();
        g.ellipse(b.x, b.y, 36, 14, 0, 0, 7);
        g.stroke();
      }
    }
    const sp = im?.sprite;
    if (!sp) return;
    const { bob, rot, sq } = bodyPose(b, time);
    b.bob = bob;
    // What they wear shows here as everywhere: the Aura's ring, the Colors'
    // motif, a skin's own effects, entrances and victories behind, their
    // near half in front (plaza-cosmetics.ts).
    const worn = { now: time * 1000, reduced, low, full: fullFx.has(b) };
    drawWornBehind(g, b, worn);
    for (const tr of b.trail) {
      g.globalAlpha = 0.32 * (1 - tr.t / 0.3);
      drawSprite(g, sp, tr.x, tr.y - tr.z, s, b.face, 0, 0);
    }
    g.globalAlpha = 1;
    drawSprite(g, sp, b.x, b.y - b.z - bob, s, b.face, rot, sq);
    drawWornFront(g, b, worn);
    // Bots (the pitch bots and the townsfolk) wear a quieter, italic name
    // tag, so nobody mistakes them for players.
    g.font = b.bot
      ? "italic 600 12px 'DM Sans', sans-serif"
      : "700 13px 'DM Sans', sans-serif";
    g.textAlign = "center";
    // A thin, even outline: round joins (the default mitre joins left
    // spikes on A, M, N, V and W) and 2.6 px, not 3.5 (owner, 22 Nov).
    g.lineWidth = 2.6;
    g.miterLimit = 2;
    g.strokeStyle = "rgba(11,16,32,.8)";
    g.fillStyle = b.me ? "#ffd65b" : b.bot ? "#aebbe0" : "#fff";
    const ny = b.y - b.z - s * 0.92 - 6;
    g.lineJoin = "round";
    g.strokeText(b.name, b.x, ny);
    g.fillText(b.name, b.x, ny);
    if (b.emoteT > 0) {
      const a = Math.max(
        0,
        Math.min(1, b.emoteT / 0.3, (2.6 - b.emoteT) / 0.15),
      );
      g.globalAlpha = a;
      const by = ny - 26;
      g.font =
        b.emote.length > 2
          ? "800 17px 'Barlow Condensed', sans-serif"
          : "19px sans-serif";
      // Sized to its text (wrapped past BUBBLE_TEXT_W), so a phrase never
      // runs out of the bubble; worked out once per line said.
      if (b.bubbleFor !== b.emote) {
        b.bubbleFor = b.emote;
        b.bubbleLines = bubbleLines(
          b.emote,
          (t) => g.measureText(t).width,
          BUBBLE_TEXT_W,
        );
        b.bubbleW = Math.max(
          46,
          Math.ceil(
            Math.max(...b.bubbleLines.map((t) => g.measureText(t).width)),
          ) + 22,
        );
      }
      const rows = b.bubbleLines.length,
        bw = b.bubbleW,
        bh = 32 + (rows - 1) * 18,
        top = by + 13 - bh;
      g.fillStyle = "#fff";
      g.beginPath();
      g.roundRect(b.x - bw / 2, top, bw, bh, 11);
      g.fill();
      g.beginPath();
      g.moveTo(b.x - 5, by + 13);
      g.lineTo(b.x + 5, by + 13);
      g.lineTo(b.x, by + 19);
      g.fill();
      g.fillStyle = "#111";
      for (let i = 0; i < rows; i++)
        g.fillText(b.bubbleLines[i], b.x, top + 23 + i * 18);
      g.globalAlpha = 1;
    }
  }
  /** How a body bobs, sways and squashes this frame (walk, dance, stun). */
  function bodyPose(b, time) {
    let bob =
        b.sp > 10 && !b.air
          ? Math.abs(Math.sin(time * 12 + b.x * 0.01)) * 4
          : Math.sin(time * 2.4 + b.x) * 1.2,
      rot = 0,
      sq = 0;
    if (b.dance > 0) {
      bob = Math.abs(Math.sin(time * 9)) * 10;
      rot = Math.sin(time * 9) * 0.14;
      sq = Math.sin(time * 18) * 0.06;
    }
    if (b.stun > 0) rot = Math.sin(time * 30) * 0.12;
    if (b.pairT > 0 && b.pairKind !== "dance") {
      // A high five or a hug: lean in toward the other (`face`), and a
      // high five hops on the slap.
      const u = PLAZA_PAIR.playSeconds - b.pairT,
        k = Math.min(1, u / 0.25, b.pairT / 0.25);
      rot = b.face * (b.pairKind === "hug" ? 0.16 : 0.24) * k;
      if (b.pairKind === "hug") sq = -0.04 * k + Math.sin(time * 5) * 0.02;
      else bob += Math.max(0, Math.sin(Math.min(1, u / 0.6) * Math.PI)) * 10;
    }
    return { bob, rot, sq };
  }
  // The front art carries its tail, lantern or staff on its right side, so
  // as drawn it reads as walking left: mirror it to walk right (it was
  // mirrored to walk left, and everyone seemed to walk backwards).
  function drawSprite(g, im, x, y, s, face, rot, sq) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale((face > 0 ? -1 : 1) * (1 + sq), 1 - sq);
    g.drawImage(im, -s / 2, -s * PLAZA_SPRITE_TOP, s, s * PLAZA_SPRITE_TALL);
    g.restore();
  }
  function drawBall(g) {
    if (ball.lock > 0 && ball.lock < 1.3) return;
    g.fillStyle = "rgba(0,0,0,.3)";
    g.beginPath();
    g.ellipse(
      ball.x,
      ball.y + ball.r * 0.6,
      ball.r * (1 - ball.z / 400),
      ball.r * 0.32,
      0,
      0,
      7,
    );
    g.fill();
    const y = ball.y - 4 - ball.z,
      gr = g.createRadialGradient(ball.x - 7, y - 9, 3, ball.x, y, ball.r);
    gr.addColorStop(0, "#fff");
    gr.addColorStop(0.5, "#dccfff");
    gr.addColorStop(1, "#7a55ff");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(ball.x, y, ball.r, 0, 7);
    g.fill();
    g.strokeStyle = "#4a2fc0";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(ball.x, y, ball.r * 0.68, ball.spin, ball.spin + 2.2);
    g.stroke();
    g.beginPath();
    g.arc(ball.x, y, ball.r * 0.68, ball.spin + 3.1, ball.spin + 5.3);
    g.stroke();
  }
  function drawPond(g, time) {
    const { x, y, rx, ry } = POND;
    const wg = g.createRadialGradient(x - 40, y - 30, 10, x, y, rx);
    wg.addColorStop(0, "#7fe0f0");
    wg.addColorStop(0.7, "#2fa6cc");
    wg.addColorStop(1, "#1a7aa6");
    g.fillStyle = wg;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, 7);
    g.fill();
    g.save();
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, 7);
    g.clip();
    FISH.forEach((f) => {
      if (!f.jump) GFX.fish(g, time, f.x, f.y, f.ang);
    });
    g.strokeStyle = "rgba(255,255,255,.28)";
    g.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const yy = y - ry + 20 + i * 26,
        ph = time * 0.9 + i * 1.7;
      g.beginPath();
      for (let xx = x - rx; xx < x + rx; xx += 10)
        g.lineTo(xx, yy + Math.sin(xx * 0.04 + ph) * 3);
      g.stroke();
    }
    [
      // (Clear of the dock's end, PLAZA_DOCK.)
      [x - 110, y - 55, 22],
      [x + 100, y + 40, 18],
      [x + 30, y - 60, 16],
      [x - 60, y + 55, 20],
    ].forEach(([px, py, r], i) => {
      const b = Math.sin(time * 1.2 + i) * 1.5;
      g.fillStyle = "#3f9a46";
      g.beginPath();
      g.ellipse(px, py + b, r, r * 0.6, 0, 0.35, Math.PI * 2 - 0.35);
      g.lineTo(px, py + b);
      g.fill();
      g.fillStyle = "#6fcf5a";
      g.beginPath();
      g.ellipse(
        px - 2,
        py - 2 + b,
        r * 0.7,
        r * 0.4,
        0,
        0.4,
        Math.PI * 2 - 0.4,
      );
      g.lineTo(px - 2, py - 2 + b);
      g.fill();
      if (i % 2 === 0) {
        for (let k = 0; k < 6; k++) {
          g.fillStyle = k % 2 ? "#ffd0e4" : "#ff8fbd";
          g.beginPath();
          g.ellipse(
            px + 4 + Math.cos(k) * 4,
            py - 6 + b + Math.sin(k) * 2,
            4,
            2.5,
            k,
            0,
            7,
          );
          g.fill();
        }
      }
    });
    g.restore();
    FISH.forEach((f) => {
      if (f.jump) {
        GFX.fish(
          g,
          time,
          f.x,
          f.y,
          f.ang,
          f.c,
          Math.sin(f.jump * Math.PI) * 50,
        );
        if (f.jump > 0.9) {
          g.strokeStyle = "rgba(255,255,255,.7)";
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(f.x, f.y, 16, 6, 0, 0, 7);
          g.stroke();
        }
      }
    });
    DUCKS.forEach((d) =>
      GFX.duck(
        g,
        d.k,
        d.dab > 0 ? "dabble" : "swim",
        time + d.a,
        d.x,
        d.y,
        1.25,
        d.face,
        true,
      ),
    );
  }
  function updateAnimals(dt) {
    DUCKS.forEach((d) => {
      d.a += d.s * dt * (d.dab > 0 ? 0.2 : 1);
      // Round a point east of the middle, clear of the dock (PLAZA_DOCK)
      // and of the bobber's spot (PLAZA_FISHING).
      const nx = POND.x + 30 + Math.cos(d.a) * POND.rx * d.r * 1.2,
        ny = POND.y + Math.sin(d.a) * POND.ry * d.r * 1.1;
      d.face = nx > d.x ? 1 : -1;
      d.x = nx;
      d.y = ny;
      if (d.dab > 0) d.dab -= dt;
      else if (Math.random() < dt * 0.07) d.dab = 2;
    });
    FISH.forEach((f) => {
      if (f.jump) {
        f.jump += dt * 1.4;
        if (f.jump >= 1) f.jump = 0;
        return;
      }
      f.a += f.s * dt;
      const nx = POND.x + Math.cos(f.a) * POND.rx * 0.55,
        ny = POND.y + Math.sin(f.a * 1.3) * POND.ry * 0.5;
      f.ang = Math.atan2(ny - f.y, nx - f.x);
      f.x = nx;
      f.y = ny;
      if (Math.random() < dt * 0.03) f.jump = 0.01;
    });
    PIGEONS.forEach((b) => {
      const threat =
        BODIES().some(
          (n) =>
            Math.hypot(n.x - b.x, n.y - b.y) <
            (n.dash > 0 || n.sp > 200 ? 110 : 55),
        ) || Math.hypot(PET.x - b.x, PET.y - b.y) < 70;
      if (b.fly > 0) {
        b.fly -= dt;
        const dx = b.tx - b.x,
          dy = b.ty - b.y,
          d = Math.hypot(dx, dy) || 1;
        b.x += (dx / d) * Math.min(d, 260 * dt);
        b.y += (dy / d) * Math.min(d, 260 * dt);
        b.face = dx > 0 ? 1 : -1;
        b.z =
          b.fly > 0.6
            ? Math.min(90, b.z + 200 * dt)
            : Math.max(0, b.z - 160 * dt);
        if (b.fly <= 0) {
          b.z = 0;
          b.st = "idle";
          b.wait = 1;
        }
        return;
      }
      if (threat) {
        const a = Math.random() * Math.PI * 2,
          r = 0.3 + Math.random() * 0.6;
        b.tx = SQ.x + Math.cos(a) * SQ.rx * r;
        b.ty = SQ.y + Math.sin(a) * SQ.ry * r;
        b.fly = 2.2;
        return;
      }
      if (b.wait > 0) {
        b.wait -= dt;
        return;
      }
      if (b.tx == null || b.st !== "walk") {
        const r = Math.random();
        if (r < 0.35) {
          b.st = "peck";
          b.wait = 1 + Math.random() * 1.5;
          b.tx = null;
          return;
        }
        if (r < 0.5) {
          b.st = "idle";
          b.wait = 1 + Math.random() * 2;
          b.tx = null;
          return;
        }
        b.tx = b.x + (Math.random() - 0.5) * 120;
        b.ty = b.y + (Math.random() - 0.5) * 70;
        if (
          !inSquare(b.tx, b.ty, 0.95) ||
          ((b.tx - FOUNT.x) / 140) ** 2 + ((b.ty - FOUNT.y) / 100) ** 2 < 1
        ) {
          b.tx = null;
          return;
        }
        b.st = "walk";
      }
      const dx = b.tx - b.x,
        dy = b.ty - b.y,
        d = Math.hypot(dx, dy);
      if (d < 3) {
        b.tx = null;
        b.st = "idle";
        b.wait = 0.3 + Math.random();
        return;
      }
      b.face = dx > 0 ? 1 : -1;
      b.x += (dx / d) * 34 * dt;
      b.y += (dy / d) * 34 * dt;
    });
    BUTTER.forEach((b) => {
      b.ph += dt;
      b.x = b.hx + Math.sin(b.ph * 0.7) * 50 + Math.sin(b.ph * 1.9) * 14;
      b.y = b.hy + Math.cos(b.ph * 0.9) * 24 - 10 + Math.sin(b.ph * 3) * 6;
    });
    if (!flock && Math.random() < dt * 0.04) {
      const y = 200 + Math.random() * 900;
      flock = {
        birds: Array.from({ length: 6 }, (_, i) => ({
          x: -60 - (i % 3) * 40 - i * 12,
          y: y + ((i * 37) % 60) - 30,
          o: i * 0.7,
        })),
      };
    }
    if (flock) {
      flock.birds.forEach((b) => {
        b.x += 240 * dt;
        b.y += Math.sin(T * 2 + b.o) * 0.3;
      });
      if (flock.birds.every((b) => b.x > W + 100)) flock = null;
    }
    CAT.awake =
      Math.hypot(P.x - CAT.b.x, P.y - CAT.b.y) < 120
        ? 1
        : Math.max(0, CAT.awake - dt * 0.5);
    // The corgi trots between spots round the square and barks now and then.
    if (PET.wait > 0) {
      PET.wait -= dt;
      if (PET.bark > 0) {
        PET.bark -= dt;
        PET.st = "bark";
      } else PET.st = PET.wait > 2 ? "sit" : "idle";
      if (Math.random() < dt * 0.05) PET.bark = 0.8;
    } else {
      if (PET.tx == null) {
        const a = Math.random() * Math.PI * 2,
          r = 0.45 + Math.random() * 0.5;
        PET.tx = SQ.x + Math.cos(a) * SQ.rx * r;
        PET.ty = SQ.y + Math.sin(a) * SQ.ry * r + 20;
        if (
          ((PET.tx - FOUNT.x) / 150) ** 2 + ((PET.ty - FOUNT.y) / 105) ** 2 <
          1
        )
          PET.tx = null;
      }
      if (PET.tx != null) {
        const dx = PET.tx - PET.x,
          dy = PET.ty - PET.y,
          d = Math.hypot(dx, dy);
        if (d < 6) {
          PET.tx = null;
          PET.wait = 2 + Math.random() * 4;
        } else {
          const sp = 120;
          PET.x += (dx / d) * Math.min(d, sp * dt);
          PET.y += (dy / d) * Math.min(d, sp * dt);
          PET.face = dx > 0 ? 1 : -1;
          PET.st = "walk";
        }
      }
    }
    if (Math.random() < dt * 6)
      HOUSES.forEach((h) => {
        if (h.spr.chimney && Math.random() < 0.25)
          SMOKE.push({
            x: h.x + h.spr.chimney[0],
            y: h.y + h.spr.chimney[1],
            t: 0,
            life: 2.4,
            vx: 8 + Math.random() * 6,
          });
      });
    SMOKE.forEach((m) => {
      m.t += dt;
      m.x += m.vx * dt;
      m.y -= 22 * dt;
    });
    for (let i = SMOKE.length - 1; i >= 0; i--)
      if (SMOKE[i].t > SMOKE[i].life) SMOKE.splice(i, 1);
  }
  /** Where the runway's spotlights hang and what they follow: whoever is
   *  on the runway, or two slow idle sweeps of the stage. */
  function spotRig(time) {
    const stars = BODIES().filter((b) => inRunway(b));
    const heads = [LED.x0 + 40, (LED.x0 + LED.x1) / 2, LED.x1 - 40],
      hy = LED.y0 - 14;
    const targets = stars.length
      ? stars.map((b) => ({ x: b.x, y: b.y, z: b.z || 0, on: 1 }))
      : [0, 1].map((k) => ({
          x: (STAGE.x0 + STAGE.x1) / 2 + Math.sin(time * 0.7 + k * 2.4) * 150,
          y: STAGE.y0 + 50 + Math.cos(time * 0.9 + k) * 22,
          z: 0,
          on: 0.55,
        }));
    const headOf = (k) =>
      heads[stars.length ? (k === 0 ? 1 : k % 2 ? 0 : 2) : k ? 2 : 0];
    return { stars, heads, hy, targets, headOf };
  }
  /** A cone of light from (hx, hy) to a pool around t. */
  function spotCone(g, hx, hy, t, w, a0, a1) {
    const gr = g.createLinearGradient(hx, hy, t.x, t.y);
    gr.addColorStop(0, `rgba(255,246,210,${a0})`);
    gr.addColorStop(1, `rgba(255,246,210,${a1})`);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(hx - 8, hy);
    g.lineTo(hx + 8, hy);
    g.lineTo(t.x + w, t.y);
    g.ellipse(t.x, t.y, w, w * 0.38, 0, 0, Math.PI);
    g.lineTo(t.x - w, t.y);
    g.closePath();
    g.fill();
  }
  /** After the night grading: the spotlights shine (they were drawn with
   *  everything else and darkened with it), and whoever stands in one is
   *  lit — their sprite again over the darkened one, part way to daylight,
   *  so they read clearly without glaring. */
  function drawSpotlightsNight(g, time, n) {
    const { stars, hy, targets, headOf } = spotRig(time);
    g.save();
    g.globalCompositeOperation = "lighter";
    targets.forEach((t, k) => {
      const hx = headOf(k),
        w = 58;
      spotCone(g, hx, hy, t, w, 0.16 * n * t.on, 0.05 * n * t.on);
      const pool = g.createRadialGradient(t.x, t.y, 4, t.x, t.y, w * 1.25);
      pool.addColorStop(0, `rgba(255,244,205,${0.3 * n * t.on})`);
      pool.addColorStop(1, "rgba(255,244,205,0)");
      g.fillStyle = pool;
      g.beginPath();
      g.ellipse(t.x, t.y, w * 1.25, w * 0.52, 0, 0, 7);
      g.fill();
      g.fillStyle = `rgba(255,250,225,${0.75 * n * t.on})`;
      g.beginPath();
      g.arc(hx, hy + 2, 6, 0, 7);
      g.fill();
    });
    g.globalCompositeOperation = "source-over";
    for (const b of [...stars].sort((a, c) => a.y - c.y)) {
      const sp = b.img?.sprite;
      if (!sp) continue;
      const { bob, rot, sq } = bodyPose(b, time);
      g.globalAlpha = 0.6 * n;
      drawSprite(g, sp, b.x, b.y - b.z - bob, 84, b.face, rot, sq);
    }
    g.restore();
  }
  function drawSpotlights(g, time) {
    const { heads, hy, targets, headOf } = spotRig(time);
    // The moving heads hang under the truss bar, in front of the screen.
    heads.forEach((hx) => {
      g.fillStyle = "#1a1a24";
      g.fillRect(hx - 2, hy - 10, 4, 6);
      g.fillStyle = "#2b2b38";
      g.beginPath();
      g.roundRect(hx - 9, hy - 6, 18, 13, 4);
      g.fill();
    });
    g.save();
    g.globalCompositeOperation = "lighter";
    targets.forEach((t, k) => {
      const hx = headOf(k),
        w = 58;
      spotCone(g, hx, hy, t, w, 0.28 * t.on, 0.06 * t.on);
      const pool = g.createRadialGradient(t.x, t.y, 4, t.x, t.y, w * 1.2);
      pool.addColorStop(0, `rgba(255,248,215,${0.32 * t.on})`);
      pool.addColorStop(1, "rgba(255,248,215,0)");
      g.fillStyle = pool;
      g.beginPath();
      g.ellipse(t.x, t.y, w * 1.2, w * 0.5, 0, 0, 7);
      g.fill();
      for (let i = 0; i < 6; i++) {
        const f = (time * 0.3 + i / 6 + k * 0.13) % 1,
          px = hx + (t.x - hx) * f + Math.sin(time * 2 + i * 3) * 12 * f,
          py = hy + (t.y - hy) * f;
        g.fillStyle = `rgba(255,255,240,${0.5 * t.on * (1 - Math.abs(f - 0.5) * 2)})`;
        g.beginPath();
        g.arc(px, py, 1.6, 0, 7);
        g.fill();
      }
      g.fillStyle = `rgba(255,250,225,${0.9 * t.on})`;
      g.beginPath();
      g.arc(hx, hy + 2, 7, 0, 7);
      g.fill();
    });
    g.restore();
  }
  /* ---------- string lights ----------
     LED strings on wires: the square's ring between its lamps (as before),
     a garland on the stage truss and lights wound round its legs, festoons
     from the square out along the south and east paths, and bulbs on the
     Photo Spot and south gate arches and along the stage's edge. At night
     each bulb glows with a pre-painted halo (one image draw a bulb) and
     twinkles; Low graphics keeps the bulbs and drops the halos, and
     reduced motion holds them steady. */
  const BULB = [
    "#ffd65b",
    "#ff8fb8",
    "#7fe7ff",
    "#b6f36b",
    "#c9a3ff",
    "#fff3c4",
  ];
  const HALO = BULB.map((c) => {
    const s = document.createElement("canvas");
    s.width = s.height = 64;
    const hg = s.getContext("2d"),
      gr = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, c + "ff");
    gr.addColorStop(0.22, c + "8c");
    gr.addColorStop(1, c + "00");
    hg.fillStyle = gr;
    hg.fillRect(0, 0, 64, 64);
    return s;
  });
  /** Wired strings: a curve (a → b through control c) or a chain of points. */
  const STRINGS = [];
  /** Bulbs on props (arches, the stage's edge): lit at night only. */
  const SPARKS = [];
  const bez = (a, c, b, t) => [
    (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
    (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
  ];
  const boxOf = (pts) => [
    Math.min(...pts.map((p) => p[0])) - 24,
    Math.min(...pts.map((p) => p[1])) - 24,
    Math.max(...pts.map((p) => p[0])) + 24,
    Math.max(...pts.map((p) => p[1])) + 24,
  ];
  function swag(a, b, { sag = 22, n, cols = [0, 1, 2, 3], c } = {}) {
    c ??= [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2];
    n ??= Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 24));
    const i = STRINGS.length,
      bulbs = [];
    for (let k = 1; k <= n; k++) {
      const [x, y] = bez(a, c, b, k / (n + 1));
      bulbs.push({
        x,
        y,
        c: cols[(k + i) % cols.length],
        ph: k * 1.7 + i * 2.3,
      });
    }
    STRINGS.push({ a, c, b, bulbs, box: boxOf([a, b, c]) });
  }
  function chain(pts, cols) {
    const i = STRINGS.length;
    STRINGS.push({
      pts,
      bulbs: pts.map(([x, y], k) => ({
        x,
        y,
        c: cols[k % cols.length],
        ph: k * 1.3 + i * 2.3,
      })),
      box: boxOf(pts),
    });
  }
  {
    const top = (l) => [l.x, l.y - 74];
    // The square's ring, exactly as before (8 spans of 7 bulbs).
    for (let i = 0; i < 8; i++) {
      const a = LAMPS[i],
        b = LAMPS[(i + 1) % 8];
      swag(top(a), top(b), {
        n: 7,
        c: [(a.x + b.x) / 2, (a.y + b.y) / 2 - 30],
      });
    }
    // The stage: a warm garland along the truss, lights round both legs.
    const tx0 = LED.x0 - 24,
      tx1 = LED.x1 + 24,
      ty = LED.y0 - 33;
    for (let k = 0; k < 6; k++)
      swag(
        [tx0 + ((tx1 - tx0) * k) / 6, ty],
        [tx0 + ((tx1 - tx0) * (k + 1)) / 6, ty],
        { sag: 8, n: 3, cols: [5, 0, 5, 1] },
      );
    for (const cx of [LED.x0 - 17, LED.x1 + 17]) {
      const pts = [];
      for (let y = LED.y0 - 8, k = 0; y < STAGE.y0 - 4; y += 16, k++)
        pts.push([cx + (k % 2 ? 6 : -6), y]);
      chain(pts, [5, 1, 4]);
    }
    // Festoons from the square down the south path and across it twice.
    const [S1, S2, S3, S4] = LAMPS.slice(8, 12);
    swag(top(LAMPS[2]), top(S1), { sag: 26 });
    swag(top(LAMPS[1]), top(S2), { sag: 26 });
    swag(top(S1), top(S2), { sag: 20, cols: [0, 4, 2, 1] });
    swag(top(S3), top(S4), { sag: 20, cols: [1, 2, 4, 0] });
    // …and out along the east path.
    const [E1, E2] = LAMPS.slice(12, 14);
    swag(top(LAMPS[7]), top(E1), { sag: 16 });
    swag(top(LAMPS[0]), top(E2), { sag: 16 });
    // Arches: between the Photo Spot's flowers and the south gate's balls.
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + ((i + 0.5) / 14) * Math.PI;
      SPARKS.push({
        x: PHOTO.x + Math.cos(a) * 80,
        y: PHOTO.y - 150 + Math.sin(a) * 80,
        c: [5, 1, 0][i % 3],
        ph: i * 0.9,
        r: 12,
      });
    }
    for (let i = 0; i < 11; i++) {
      const a = Math.PI + ((i + 0.5) / 11) * Math.PI;
      SPARKS.push({
        x: GATE.x + Math.cos(a) * 70,
        y: GATE.y - 112 + Math.sin(a) * 70,
        c: [0, 5, 1][i % 3],
        ph: i * 1.1,
        r: 12,
      });
    }
    // The stage's edge and the catwalk's sides (painted bulbs) light up and
    // chase toward the front.
    for (let x = STAGE.x0 + 14, k = 0; x < STAGE.x1; x += 26, k++)
      SPARKS.push({ x, y: STAGE.y1 + 9, c: 5, chase: k, r: 9 });
    for (let y = WALK.y0 + 14, k = 0; y < WALK.y1; y += 24, k++)
      for (const x of [WALK.x0 + 8, WALK.x1 - 8])
        SPARKS.push({ x, y, c: 1, chase: k + 4, r: 9 });
  }
  /** The strings, wires and bulbs; at night (n > 0) lit, with halos. */
  function drawStringLights(g, time, n, vx0, vy0, vx1, vy1) {
    const seen = (b) => b[2] > vx0 && b[0] < vx1 && b[3] > vy0 && b[1] < vy1;
    const strings = STRINGS.filter((st) => seen(st.box));
    g.save();
    g.strokeStyle = n > 0 ? "rgba(40,30,20,.6)" : "rgba(40,30,20,.45)";
    g.lineWidth = 1.2;
    g.beginPath();
    for (const st of strings) {
      if (st.pts) {
        g.moveTo(st.pts[0][0], st.pts[0][1]);
        for (const p of st.pts.slice(1)) g.lineTo(p[0], p[1]);
      } else {
        g.moveTo(st.a[0], st.a[1]);
        g.quadraticCurveTo(st.c[0], st.c[1], st.b[0], st.b[1]);
      }
    }
    g.stroke();
    const tw = (ph) => (reduced ? 1 : 0.72 + 0.28 * Math.sin(time * 2.4 + ph));
    const lit = [];
    for (const st of strings)
      for (const b of st.bulbs) lit.push({ ...b, k: tw(b.ph), r: 13 });
    if (n > 0)
      for (const s of SPARKS) {
        if (
          s.x < vx0 - 20 ||
          s.x > vx1 + 20 ||
          s.y < vy0 - 20 ||
          s.y > vy1 + 20
        )
          continue;
        const k =
          s.chase == null
            ? tw(s.ph)
            : reduced
              ? 0.85
              : 0.45 + 0.55 * Math.max(0, Math.sin(time * 4 - s.chase * 0.7));
        lit.push({ ...s, k });
      }
    if (n > 0 && !low) {
      g.globalCompositeOperation = "lighter";
      for (const b of lit) {
        g.globalAlpha = Math.min(1, 0.62 * n * b.k);
        g.drawImage(HALO[b.c], b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
      g.globalCompositeOperation = "source-over";
    }
    for (const b of lit) {
      if (n <= 0 && b.chase != null) continue;
      g.fillStyle = BULB[b.c];
      g.globalAlpha = n > 0 ? (0.4 + 0.6 * n) * (0.75 + 0.25 * b.k) : 0.45;
      g.beginPath();
      g.arc(b.x, b.y, b.chase != null ? 2.8 : 3.2, 0, 7);
      g.fill();
    }
    if (n > 0) {
      // A white-hot centre makes them read as lit LEDs.
      g.fillStyle = "#fff";
      for (const b of lit) {
        g.globalAlpha = 0.85 * n * b.k;
        g.beginPath();
        g.arc(b.x, b.y, 1.3, 0, 7);
        g.fill();
      }
    }
    g.restore();
  }
  function drawWorld(g, time, photo = false) {
    // What this canvas shows of the world, so only that much is drawn.
    const inv = g.getTransform().inverse(),
      c0 = inv.transformPoint({ x: 0, y: 0 }),
      c1 = inv.transformPoint({ x: g.canvas.width, y: g.canvas.height }),
      vx0 = Math.max(-PLAZA_MARGIN, Math.floor(c0.x) - 2),
      vy0 = Math.max(-PLAZA_MARGIN, Math.floor(c0.y) - 2),
      vx1 = Math.min(W + PLAZA_MARGIN, Math.ceil(c1.x) + 2),
      vy1 = Math.min(H + PLAZA_MARGIN, Math.ceil(c1.y) + 2);
    {
      // The river's water first, under the meadow's hole for it; then the
      // meadow (the Plaza and the world around it, one picture).
      if (vy0 < 0) drawRiver(g, time, night(), low, vx0, vy0, vx1);
      const bx0 = Math.max(-GM, vx0),
        by0 = Math.max(-GM, vy0),
        bx1 = Math.min(W + GM, vx1),
        by1 = Math.min(H + GM, vy1);
      if (bx1 > bx0 && by1 > by0)
        g.drawImage(
          bg,
          bx0 + GM,
          by0 + GM,
          bx1 - bx0,
          by1 - by0,
          bx0,
          by0,
          bx1 - bx0,
          by1 - by0,
        );
      drawFieldLife(g, time, reduced, vx0, vy1, vx1);
    }
    // Where a click sent you, on the ground under everyone.
    if (!photo) drawClickMark(g, time);
    // pad glow, runway spotlight
    PADS.forEach(([x, y]) => {
      g.fillStyle = `rgba(159,208,255,${0.18 + Math.sin(time * 3 + x) * 0.1})`;
      g.beginPath();
      g.ellipse(x, y, 46, 29, 0, 0, 7);
      g.fill();
    });

    drawPond(g, time);
    fishing.drawWater(g, time);
    FX.filter((f) => f.ring || f.dust).forEach((f) => {
      const k = f.t / f.life;
      g.strokeStyle = f.dust
        ? `rgba(255,255,255,${0.5 * (1 - k)})`
        : f.c
          ? f.c +
            Math.round((1 - k) * 255)
              .toString(16)
              .padStart(2, "0")
          : `rgba(255,255,255,${1 - k})`;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(
        f.x,
        f.y,
        (f.dust ? 14 : 22) + k * (f.dust ? 20 : 60),
        (f.dust ? 6 : 14) + k * (f.dust ? 8 : 38),
        0,
        0,
        7,
      );
      g.stroke();
    });
    // orbs shadows
    ev.orbs.forEach((o) => {
      g.fillStyle = "rgba(0,0,0,.25)";
      g.beginPath();
      g.ellipse(o.x, o.y, 12 * (1 - o.z / 500), 5, 0, 0, 7);
      g.fill();
    });
    // A skin's ambient particles: you and the nearest few only (a crowd
    // costs a phone's GPU; plaza-cosmetics.ts).
    if (!photo) pickFullFx();
    // Everything standing, each with its footprint on the ground, drawn in
    // depth order (plaza-depth.ts): long things (hurdles, goals, the
    // gantry, the food truck) behind or in front of each walker where they
    // actually meet, not by one number each.
    const items = [
      ...TREES.map((o) => {
        const crown = o.t.pine ? o.t.pine.w / 2 : o.t.canopy.w / 2;
        return spot(
          o.x,
          o.y,
          18,
          o.t.pine ? o.t.pine.ay : o.t.h + o.t.canopy.ay,
          () => GFX.drawTree(g, o.t, o.x, o.y, time, o.ph),
          { sw: crown, name: "tree" },
        );
      }),
      ...BUSHES.map((o) =>
        spot(
          o.x,
          o.y,
          26,
          60,
          () => {
            GFX.shadow(g, o.x + 6, o.y + 2, 36, 9);
            GFX.blit(g, o.spr, o.x, o.y + 4);
          },
          { sw: o.spr.w / 2, name: "bush" },
        ),
      ),
      ...ROCKS.map((o) =>
        spot(
          o.x,
          o.y,
          16,
          34,
          () => {
            GFX.shadow(g, o.x + 4, o.y + 2, 24, 6);
            GFX.blit(g, o.spr, o.x, o.y + 4);
          },
          { sw: o.spr.w / 2, name: "rock" },
        ),
      ),
      ...PLAZA_DECOR.map((o) => {
        const d = DECOR_ART[o.kind];
        return spot(
          o.x,
          o.y,
          d.foot,
          d.h,
          () => {
            if (d.shadow)
              GFX.shadow(g, o.x + 3, o.y + 2, d.shadow[0], d.shadow[1]);
            GFX.blit(g, d.spr(o.seed), o.x, o.y + 4);
          },
          { sw: d.sw ?? 0, name: o.kind },
        );
      }),
      ...PLAZA_SIGNPOSTS.map((o) =>
        spot(
          o.x,
          o.y,
          8,
          70 + o.arms.length * 34,
          () => {
            GFX.shadow(g, o.x + 4, o.y + 2, 16, 5);
            GFX.blit(g, GFX.signpost(o.arms, ICON_IMG), o.x, o.y + 4);
          },
          { sw: 72, name: "signpost" },
        ),
      ),
      ...LAMPS.map((o) =>
        spot(o.x, o.y, 9, 110 * PLAZA_SCALE.lamp, () => drawLamp(g, o), {
          sw: 24,
          name: "lamp",
        }),
      ),
      ...BENCHES.map((o) => ({
        x0: o.x - 42,
        x1: o.x + 42,
        y0: o.y - 14,
        y1: o.y,
        h: 60,
        name: "bench",
        draw: () => {
          GFX.shadow(g, o.x + 4, o.y + 2, 46, 8);
          GFX.blit(g, GFX.bench(), o.x, o.y + 4);
          if (o === CAT.b)
            GFX.cat(
              g,
              CAT.awake > 0 ? "awake" : "sleep",
              time,
              o.x - 14,
              o.y - 18,
              1.15,
              1,
            );
        },
      })),
      ...HOUSES.map((h) => ({
        x0: h.x - 94,
        x1: h.x + 132,
        y0: h.y - 50,
        y1: h.y,
        h: 290,
        name: "house",
        draw: () => drawHouse(g, h, night()),
      })),
      ...PIGEONS.map((b) =>
        spot(
          b.x,
          b.y,
          8,
          26,
          () => {
            if (b.z > 2) {
              GFX.shadow(g, b.x, b.y, 10, 3, 0.2);
              GFX.bird(
                g,
                b.kind,
                "fly",
                time + b.x,
                b.x,
                b.y - b.z,
                1.05,
                b.face,
              );
            } else
              GFX.bird(
                g,
                b.kind,
                b.st,
                time + b.x * 0.01,
                b.x,
                b.y,
                1.05,
                b.face,
              );
          },
          { z: b.z > 2 ? b.z : 0, name: "pigeon" },
        ),
      ),
      ...(low
        ? []
        : [
            spot(
              PET.x,
              PET.y,
              14,
              50,
              () => {
                GFX.dog(
                  g,
                  PET.breed,
                  PET.st,
                  time,
                  PET.x,
                  PET.y,
                  0.8,
                  PET.face,
                  {
                    collar: "#4fb3ff",
                    pant: PET.st === "idle",
                  },
                );
              },
              { name: "pet" },
            ),
          ]),
      // Corner flags on the pitch, waving (still on Low graphics).
      ...[
        [PITCH.x0, PITCH.y0],
        [PITCH.x1, PITCH.y0],
        [PITCH.x0, PITCH.y1],
        [PITCH.x1, PITCH.y1],
      ].map(([x, y], i) =>
        spot(x, y, 4, 48, () => drawCornerFlag(g, x, y, i, time), {
          sw: 20,
          name: "corner-flag",
        }),
      ),
      ...FLOOD.map((o) =>
        spot(o.x, o.y, 6, 256, () => drawFlood(g, o, night()), {
          sw: 28,
          name: "flood",
        }),
      ),
      // The basin's foot on the ground: someone in front of the wall is
      // drawn over it, someone behind the rim under it.
      {
        x0: FOUNT.x - FOUNT.rx,
        x1: FOUNT.x + FOUNT.rx,
        y0: FOUNT.y + FOUNT.wall - FOUNT.ry,
        y1: FOUNT.y + FOUNT.wall + FOUNT.ry,
        h: 230,
        name: "fountain",
        draw: () => drawFountain(g, time),
      },
      {
        x0: LED.x0,
        x1: LED.x1,
        y0: LED.y1 - 20,
        y1: LED.y1,
        h: 340,
        name: "led",
        draw: () => drawLED(g, time),
      },
      // The spotlights hang from the truss in front of the screen and shine
      // down on the stage: drawn after the screen, before anyone standing
      // on the stage. Always drawn: the camera may see only the beams' end.
      {
        x0: LED.x0,
        x1: LED.x1,
        y0: LED.y1 + 0.5,
        y1: LED.y1 + 0.5,
        h: 340,
        always: true,
        name: "spotlights",
        draw: () => drawSpotlights(g, time),
      },
      spot(
        (PITCH.x0 + PITCH.x1) / 2,
        PITCH.y0 - 10,
        6,
        150,
        () => drawScoreboard(g),
        { sw: 120, name: "scoreboard" },
      ),
      ...goalDrawables(g, PITCH.x0, true),
      ...goalDrawables(g, PITCH.x1, false),
      ...HSEG.map(([p0, p1], i) => ({
        x0: p0.x,
        y0: p0.y,
        x1: p1.x,
        y1: p1.y,
        line: true,
        h: PLAZA_SCALE.hurdle + 8,
        name: `hurdle-${i}`,
        draw: () => drawHurdle(g, i),
      })),
      ...gantryDrawables(g),
      {
        x0: LEADER.x - 90,
        x1: LEADER.x + 90,
        y0: LEADER.y - 4,
        y1: LEADER.y,
        h: 252,
        name: "leader",
        draw: () => drawLeader(g, time),
      },
      {
        x0: PHOTO.x - 86,
        x1: PHOTO.x + 86,
        y0: PHOTO.y - 4,
        y1: PHOTO.y,
        h: 262,
        name: "photo-arch",
        draw: () => drawPhoto(g, time),
      },
      // The arch's two bushes, each standing on its own spot.
      spot(
        PHOTO.x - 160,
        PHOTO.y - 50,
        30,
        60,
        () =>
          GFX.blit(g, GFX.bush("flower", 31, 70), PHOTO.x - 160, PHOTO.y - 50),
        { sw: 43, name: "bush" },
      ),
      spot(
        PHOTO.x - 235,
        PHOTO.y - 30,
        30,
        60,
        () =>
          GFX.blit(g, GFX.bush("rose", 32, 70), PHOTO.x - 235, PHOTO.y - 30),
        { sw: 43, name: "bush" },
      ),
      spot(
        PLAZA_PHOTO_CAMERA.x,
        PLAZA_PHOTO_CAMERA.y,
        14,
        80,
        () => drawCamera(g),
        { name: "camera" },
      ),
      // The food truck is long: its footprint runs its whole length.
      {
        x0: CAFE.x - 130,
        x1: CAFE.x + 130,
        y0: CAFE.y - 50,
        y1: CAFE.y,
        h: 190,
        name: "cafe",
        draw: () => drawCafe(g),
      },
      {
        x0: CAFE.x - 212,
        x1: CAFE.x - 128,
        y0: CAFE.y + 56,
        y1: CAFE.y + 70,
        h: 60,
        name: "bench",
        draw: () => GFX.blit(g, GFX.bench(), CAFE.x - 170, CAFE.y + 70),
      },
      {
        x0: BOARD.x - 70,
        x1: BOARD.x + 70,
        y0: BOARD.y - 6,
        y1: BOARD.y,
        h: 190,
        name: "board",
        draw: () => drawBoard(g),
      },
      {
        x0: GATE.x - 80,
        x1: GATE.x + 80,
        y0: GATE.y - 4,
        y1: GATE.y,
        h: 195,
        name: "gate",
        draw: () => drawGate(g),
      },
      spot(ball.x, ball.y, ball.r || 14, 40, () => drawBall(g), {
        z: ball.z || 0,
        name: "ball",
      }),
      ...ev.orbs.map((o) =>
        spot(
          o.x,
          o.y,
          12,
          60,
          () => {
            const y = o.y - 22 - o.z + Math.sin(time * 5 + o.x) * 3,
              gr = g.createRadialGradient(o.x, y, 2, o.x, y, 28);
            gr.addColorStop(0, "#fff");
            gr.addColorStop(0.3, o.c);
            gr.addColorStop(1, o.c + "00");
            g.fillStyle = gr;
            g.beginPath();
            g.arc(o.x, y, 28, 0, 7);
            g.fill();
            g.fillStyle = "#fff";
            g.beginPath();
            g.arc(o.x, y, 7, 0, 7);
            g.fill();
            if (o.z > 0) {
              g.strokeStyle = o.c + "88";
              g.lineWidth = 4;
              g.beginPath();
              g.moveTo(o.x, y - 10);
              g.lineTo(o.x, y - 60);
              g.stroke();
            }
          },
          { z: o.z, sw: 28, name: "orb" },
        ),
      ),
      ...liveDrawables(g, time, vx0, vx1),
      ...BODIES().map((b) =>
        spot(b.x, b.y, 12, 84, () => drawBody(g, b, time, photo), {
          z: b.z || 0,
          sw: 44,
          name: b === P ? "me" : "body",
        }),
      ),
    ];
    // Only what can reach the view (things reach up to ~340 px).
    const shown = items.filter(
      (i) =>
        i.always ||
        (Math.max(i.y0, i.y1) > vy0 - 40 &&
          Math.min(i.y0, i.y1) < vy1 + 360 &&
          Math.max(i.x0, i.x1) + (i.sw ?? 0) > vx0 - 40 &&
          Math.min(i.x0, i.x1) - (i.sw ?? 0) < vx1 + 40),
    );
    const sorted = depthSort(shown);
    if (debugOrder) debugOrder = sorted.map((i) => i.name ?? "?");
    for (const i of sorted) i.draw();
    if (!photo) fishing.drawRod(g, P);
    BUTTER.forEach((b) => GFX.butterfly(g, time + b.ph, b.x, b.y, b.c, 1.3));
    if (!low) drawDragonflies(g, time);
    SMOKE.forEach((m) => {
      g.fillStyle = `rgba(240,240,245,${0.45 * (1 - m.t / m.life)})`;
      g.beginPath();
      g.arc(m.x, m.y, 6 + m.t * 8, 0, 7);
      g.fill();
    });
    if (flock)
      flock.birds.forEach((b) => {
        GFX.shadow(g, b.x, b.y + 160, 8, 2.5, 0.15);
        GFX.bird(g, "sparrow", "fly", time + b.o, b.x, b.y, 0.9, 1);
      });
    for (const f of FX) {
      const k = f.t / f.life;
      if (f.text) {
        g.font = f.small
          ? "800 24px 'Barlow Condensed', sans-serif"
          : "800 72px 'Barlow Condensed', sans-serif";
        g.textAlign = "center";
        g.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
        g.lineWidth = f.small ? 4 : 7;
        g.strokeStyle = "#0b1020";
        g.strokeStyle = "#0b1020";
        g.fillStyle = "#ffd65b";
        if (f.icon)
          textWithIcon(g, f.text, f.icon, f.x, f.y - k * 50 - 8, 24, true);
        else {
          g.lineJoin = "round";
          g.strokeText(f.text, f.x, f.y - k * 50);
          g.fillText(f.text, f.x, f.y - k * 50);
        }
        g.globalAlpha = 1;
      } else if (f.heart) {
        const x = f.x + (f.tx - f.x) * k,
          y = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 120 - 60;
        g.globalAlpha = 1 - k * 0.5;
        g.fillStyle = "#ff6fae";
        {
          const hi = ICON_IMG("heart");
          if (hi.complete) g.drawImage(hi, x - 13, y - 24, 26, 26);
        }
        g.globalAlpha = 1;
      } else if (f.g) {
        g.globalAlpha = 1 - k;
        g.fillStyle = f.c || "#fff";
        g.font = "800 20px sans-serif";
        g.textAlign = "center";
        g.fillText(f.g, f.x, f.y - f.z);
        g.globalAlpha = 1;
      }
    }
    if (!photo) fishing.drawCatch(g, P);
    // day / night grading and lights
    const n = night();
    // Golden hour: the late sun warms the whole square.
    const gold = low ? 0 : goldenLevel(tod) * (1 - n);
    if (gold > 0.01) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "soft-light";
      const cw = g.canvas.width,
        chh = g.canvas.height,
        sg = g.createLinearGradient(0, 0, cw * 0.7, chh);
      sg.addColorStop(0, `rgba(255,190,80,${0.7 * gold})`);
      sg.addColorStop(0.65, `rgba(255,140,70,${0.45 * gold})`);
      sg.addColorStop(1, `rgba(200,90,110,${0.4 * gold})`);
      g.fillStyle = sg;
      g.fillRect(0, 0, cw, chh);
      g.restore();
    }
    if (n > 0) {
      if (!low) drawNightMap(g, n, vx0, vy0, vx1, vy1);
      else {
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = "multiply";
        // A little lighter than it was, so the night reads as lit, not dark.
        g.fillStyle = `rgba(${Math.round(255 - 150 * n)},${Math.round(255 - 132 * n)},${Math.round(255 - 62 * n)},1)`;
        g.fillRect(0, 0, g.canvas.width, g.canvas.height);
        g.restore();
      }
      drawSpotlightsNight(g, time, n);
      g.save();
      g.globalCompositeOperation = "lighter";
      const glow = (x, y, r, c, a) => {
        if (low) return;
        if (x + r < vx0 || x - r > vx1 || y + r < vy0 || y - r > vy1) return;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${c},${a})`);
        gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, r, 0, 7);
        g.fill();
      };
      LAMPS.forEach((l) => {
        glow(l.x, l.y - LAMP_HEAD, 90, "255,214,140", 0.55 * n);
        glow(l.x, l.y, 110, "255,200,120", (low ? 0.18 : 0.08) * n);
      });
      FLOOD.forEach((f) => glow(f.x, f.y - 240, 120, "255,250,220", 0.5 * n));
      glow(
        (PITCH.x0 + PITCH.x1) / 2,
        (PITCH.y0 + PITCH.y1) / 2,
        420,
        "220,235,255",
        0.16 * n,
      );
      glow((LED.x0 + LED.x1) / 2, LED.y1, 340, "200,120,255", 0.22 * n);
      glow(CAFE.x, CAFE.y - 120, 160, "255,200,140", 0.35 * n);
      glow(FOUNT.x, FOUNT.y - 40, 170, "120,220,255", 0.22 * n);
      for (const l of RIVER_LAMPS)
        glow(l.x, l.y - LAMP_HEAD, 90, "255,214,140", 0.55 * n);
      // The porch lanterns by the houses' doors.
      for (const h of HOUSES)
        if (h.spr.lamp)
          glow(
            h.x + h.spr.lamp[0] * HK,
            h.y + h.spr.lamp[1] * HK,
            26,
            "255,214,140",
            0.7 * n,
          );
      if (!low && vy0 < 0) drawRiverLights(g, time, n, vx0, vx1);
      for (let i = 0; i < 40; i++) {
        const t = TREES[i % TREES.length];
        const x = t.x + Math.sin(time * 0.7 + i * 3.1) * 70,
          y = t.y - 80 + Math.cos(time * 0.9 + i * 1.7) * 50;
        glow(
          x,
          y,
          9,
          "210,255,140",
          (0.5 + 0.5 * Math.sin(time * 3 + i)) * 0.8 * n,
        );
      }
      if (ev.orbs.length)
        ev.orbs.forEach((o) =>
          glow(o.x, o.y - 18 - o.z, 40, "220,170,255", 0.5 * n),
        );
      g.restore();
      drawStringLights(g, time, n, vx0, vy0, vx1, vy1);
    } else {
      // daytime: string lights unlit, butterflies
      drawStringLights(g, time, 0, vx0, vy0, vx1, vy1);
      for (let i = 0; i < 10; i++) {
        const t = TREES[(i * 5) % TREES.length],
          x = t.x + Math.sin(time * 0.8 + i) * 60,
          y = t.y - 40 + Math.sin(time * 1.3 + i * 2) * 30,
          f = Math.abs(Math.sin(time * 14 + i));
        g.fillStyle = ["#fff6b8", "#ffb3d1", "#bfe3ff"][i % 3];
        g.beginPath();
        g.ellipse(x - 4 * f, y, 4 * f + 1, 3, 0, 0, 7);
        g.ellipse(x + 4 * f, y, 4 * f + 1, 3, 0, 0, 7);
        g.fill();
      }
    }
  }
  function starSkin(b) {
    if (b.skin?.skin) return options.skinName(b.skin.skin) ?? "";
    // A palette from the Skin slot: "candy-colours" → "Candy Colours".
    return b.colour
      ? (options.skinName(b.colour) ??
          b.colour.replace(
            /(^|-)(\w)/g,
            (_, d, c) => (d ? " " : "") + c.toUpperCase(),
          ))
      : "";
  }

  /* ---------- loop ---------- */
  // No title card for each area you walk into (Fountain Square, Dash
  // Track…): the places are signposted in the painting, and the cards
  // repeated them every time you crossed a border. The banner is kept for
  // events (the Orb Shower).
  const DASH_EVERY = PLAZA.dashEvery;
  let lastDraw = 0;
  /** The last frame's drawing order, once a test asks for it. */
  let debugOrder = false;
  // A 120 Hz phone: about 60 frames a second, as everywhere (frame-cap.ts).
  const cap = new FrameCap();
  // The frame-rate read-out's lines while the Plaza shows (perf-hud.ts).
  const drawn = new PreviewPerf();
  setPerfSource("plaza", () =>
    running ? sceneLines("plaza", drawn, cv, probe) : undefined,
  );
  function step(now) {
    raf = requestAnimationFrame(step);
    if (low ? now - lastDraw < 30 : !cap.draw(now)) return;
    lastDraw = now;
    drawn.draw(now, 0);
    if (probe) {
      if (covered() || document.hidden) probe.pause();
      else {
        const verdict = probe.frame(performance.now());
        if (verdict === "low" && sharp && sceneDensity(NW, NH) < PS) {
          // First a step back to 1.5x (as before 22 Nov), watched afresh.
          sharp = false;
          try {
            localStorage.setItem(SOFT_KEY, "1");
          } catch {
            /* private mode: soft for this visit only */
          }
          resize();
          probe = new FrameRateProbe(0);
        } else if (verdict === "low") {
          rememberAutoLow(`Plaza ran at ${Math.round(probe.lastFps)} fps`);
          probe = undefined;
          goLow();
        } else if (verdict === "ok")
          // Keep watching: a busier Plaza later can still be too much.
          probe = new FrameRateProbe(0);
      }
    }
    // The Shop, Settings or a drawer fills the screen: stop drawing behind it
    // (once you've stopped walking) and wake when it closes.
    if (hidden()) {
      coveredAt ??= performance.now();
      if (performance.now() - coveredAt > 300 && !sent.x && !sent.y) {
        coveredAt = undefined;
        freeze();
        return;
      }
    } else coveredAt = undefined;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    // The fireworks keep to the clock down to 4 frames a second: at dt's
    // 0.05 s cap a slow device (under 20 fps) aged their sparks in slow
    // motion, and the show outlasted PLAZA_WISH.showMs by many seconds.
    // They only look, so a longer step costs nothing.
    const showDt = Math.max(0, Math.min(0.25, (now - last) / 1000));
    last = now;
    T = now / 1000;
    if (!ready) return;
    const photo = !$("pz-photo").hidden;
    if (mapOpen() && now - mapDotsAt > 250) renderMapDots();
    if (!photo) {
      if (todHold > 0) todHold -= dt;
      else tod = realTod();
      // You: the same step as the server, then a gentle pull toward where it says you are.
      let dir = inputDir();
      if (covered()) {
        keys.clear();
        target = null;
        dir = { x: 0, y: 0 };
      }
      sendInput(dir, now);
      const ox = P.x,
        oy = P.y;
      const ev2 = plazaStep(P, sent, dt);
      stepClock += dt * 1000;
      if (ev2.bounced !== undefined)
        FX.push({
          ring: 1,
          x: PADS[ev2.bounced][0],
          y: PADS[ev2.bounced][1],
          t: 0,
          life: 0.5,
          c: "#9fd0ff",
        });
      if (ev2.landed) FX.push({ dust: 1, x: P.x, y: P.y, t: 0, life: 0.4 });
      if (ev2.tripped) {
        showEmote(P, "💫");
        pzToast("Tripped! Press Space to jump the hurdles.");
      }
      P.stuckT =
        target && P.speed < PLAZA.speed * 0.5 && P.dash <= 0
          ? (P.stuckT || 0) + dt
          : Math.max(0, (P.stuckT || 0) - dt * 0.5);
      if (srv?.acked) {
        // Ease in what the server disagreed on (plaza-predict.ts).
        const bx = P.x,
          by = P.y,
          c = predict.ease(dt);
        P.x += c.x;
        P.y += c.y;
        plazaCollide(P);
        predict.shift(P.x - bx, P.y - by);
      } else if (srv) {
        // A server without numbered inputs: the old gentle pull.
        const err = Math.hypot(srv.x - P.x, srv.y - P.y),
          moving = Math.hypot(dir.x, dir.y) > 0.05 || P.dash > 0;
        if (err > 160) {
          P.x = srv.x;
          P.y = srv.y;
        } else if (moving ? err > 100 : err > 2) {
          const k = 1 - Math.exp(-dt / (moving ? 0.8 : 0.15));
          P.x += (srv.x - P.x) * k;
          P.y += (srv.y - P.y) * k;
        }
      }
      predict.record(stepClock, P.x, P.y);
      P.sp = P.speed;
      P.buff = P.boost;
      if (P.dash > 0 && Math.random() < 0.8)
        P.trail.push({ x: ox, y: oy, z: P.z, t: 0 });
      // Everyone else: smoothed toward the server.
      const k = 1 - Math.exp(-dt / 0.09);
      for (const b of others.values()) {
        const px = b.x,
          py = b.y;
        b.x += (b.tx - b.x) * k;
        b.y += (b.ty - b.y) * k;
        if (dt > 0) {
          b.vx = (b.x - px) / dt;
          b.vy = (b.y - py) / dt;
        }
        b.z += (b.tz - b.z) * Math.min(1, k * 1.6);
        b.air = b.z > 1 ? 1 : 0;
        if (b.dash && Math.random() < 0.8)
          b.trail.push({ x: px, y: py, z: b.z, t: 0 });
      }
      for (const b of BODIES()) {
        if (b.emoteT > 0) b.emoteT -= dt;
        if (b.dance > 0) b.dance -= dt;
        if (b.pairT > 0) b.pairT -= dt;
        b.trail.forEach((t) => (t.t += dt));
        b.trail = b.trail.filter((t) => t.t < 0.3);
      }
      if (ball.tx != null) {
        const ox2 = ball.x,
          oy2 = ball.y;
        ball.x += (ball.tx - ball.x) * Math.min(1, k * 1.4);
        ball.y += (ball.ty - ball.y) * Math.min(1, k * 1.4);
        ball.z += (ball.tz - ball.z) * Math.min(1, k * 1.6);
        ball.spin += Math.hypot(ball.x - ox2, ball.y - oy2) / ball.r;
      }
      updateRun();
      updateRunway();
      updateEvent();
      FX.forEach((f) => {
        f.t += dt;
        if (f.g) {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vz -= 500 * dt;
          f.z = Math.max(0, f.z + f.vz * dt);
        }
      });
      for (let i = FX.length - 1; i >= 0; i--)
        if (FX[i].t > FX[i].life) FX.splice(i, 1);
      if (!low) updateAnimals(dt);
      near =
        SPOTS.find((s) => Math.hypot(P.x - s.x, (P.y - s.y) * 1.3) < s.r) ||
        null;
      const ib = $("pz-interact");
      fishing.update(dt);
      if (toDock && (!fishing.active || !target)) {
        // At the dock's end: face the water, where the line goes.
        if (fishing.active) P.face = PLAZA_FISHING.bobber.x >= P.x ? 1 : -1;
        toDock = false;
      }
      if (near) {
        if (ib.dataset.id !== near.id) {
          ib.dataset.id = near.id;
          ib.innerHTML = `${I(near.icon)}<span>${near.label}</span><kbd>E</kbd>`;
        }
        ib.hidden = false;
      } else {
        ib.hidden = true;
        ib.dataset.id = "";
      }
      const dcd = $("pz-dash");
      dcd.classList.toggle("cd", P.dashCd > 0);
      {
        // At the fountain the treat button makes a wish (PLAZA_WISH).
        const tb = $("pz-treat"),
          well = atFountain(P.x, P.y);
        if (tb.__wish !== well) {
          tb.__wish = well;
          tb.classList.toggle("wish", well);
          tb.setAttribute(
            "aria-label",
            well ? "Make a wish (T)" : "Throw a treat (T)",
          );
        }
        // The copy's meter as a ring round it, wherever you are.
        const fill = wish.n ? `${wish.n}/${wishGoal()}` : "";
        if (tb.__fill !== fill) {
          tb.__fill = fill;
          tb.classList.toggle("wishing", !!fill);
          tb.style.setProperty(
            "--wish",
            String(Math.min(1, wish.n / wishGoal())),
          );
          tb.title = fill ? `Wishes ${fill}` : "";
          const badge = $("pz-wishn");
          badge.hidden = !fill;
          badge.textContent = fill;
        }
      }
      const cd = String(
        Math.round(Math.max(0, (1 - P.dashCd / DASH_EVERY) * 100)),
      );
      if (dcd.__cd !== cd) {
        dcd.__cd = cd;
        dcd.style.setProperty("--cd", cd);
      }
      const lead = { x: P.vx * 0.25, y: P.vy * 0.2 };
      // Follows you a little past the Plaza's edges, onto the river, the
      // woods and the fields, never past what is painted (plaza-surround.ts).
      // Fishing: the angler and the whole pond, centred, as big as fits
      // between fishing's buttons (fishingFrame).
      const frame = fishing.active ? fishingFrame(NW, NH) : null;
      const fzWant = frame ? frame.z / zBase : 1;
      if (Math.abs(fz - fzWant) > 0.001) {
        fz += (fzWant - fz) * Math.min(1, dt * 4);
        Z = zBase * fz;
      }
      const look = frame ?? { x: P.x + lead.x, y: P.y - 40 + lead.y };
      const want = plazaCamClamp(look.x, look.y, NW, NH, Z);
      cam.x += (want.x - cam.x) * Math.min(1, dt * 5);
      cam.y += (want.y - cam.y) * Math.min(1, dt * 5);
      {
        const nt = night() > 0.5,
          ck = $("pz-clock");
        if (ck.dataset.k !== `${nt}${clockText()}`) {
          ck.dataset.k = `${nt}${clockText()}`;
          ck.innerHTML = `${I(nt ? "moon" : "sun")}<span>${clockText()}</span>`;
        }
      }
    }
    ctx.setTransform(PS, 0, 0, PS, 0, 0);
    ctx.imageSmoothingQuality = "high";
    // A hooked fish's fight: its close-up comes in over the Plaza, then
    // stands in for it (one scene to paint, not two).
    const fv = fishing.fightView();
    if (fv && fv.t >= FIGHT_IN_SECONDS) {
      fightView.draw(ctx, fv, NW, NH, T, low, fightRoom, 1, PS, night());
      // A show going on meanwhile keeps moving (unseen), so its sparks
      // aren't frozen in place when the fight ends.
      if (fireworks.active(serverNow()))
        fireworks.step(serverNow(), dt, {
          x0: cam.x - NW / 2 / Z,
          y0: cam.y - NH / 2 / Z,
          x1: cam.x + NW / 2 / Z,
          y1: cam.y + NH / 2 / Z,
        });
      return;
    }
    ctx.fillStyle = "#24452a";
    ctx.fillRect(0, 0, NW, NH);
    ctx.save();
    ctx.translate(NW / 2, NH / 2);
    ctx.scale(Z, Z);
    ctx.translate(-cam.x, -cam.y);
    drawWorld(ctx, T);
    drawWishMeter(ctx);
    if (fireworks.active(serverNow())) {
      const t0 = performance.now();
      fireworks.step(serverNow(), showDt, {
        x0: cam.x - NW / 2 / Z,
        y0: cam.y - NH / 2 / Z,
        x1: cam.x + NW / 2 / Z,
        y1: cam.y + NH / 2 / Z,
      });
      fireworks.draw(ctx, serverNow(), Z, NW, NH);
      const ms = performance.now() - t0;
      fwCost.frames++;
      fwCost.ms += ms;
      fwCost.max = Math.max(fwCost.max, ms);
    }
    ctx.restore();
    const vg = ctx.createRadialGradient(
      NW / 2,
      NH / 2,
      NH * 0.45,
      NW / 2,
      NH / 2,
      NH * 0.95,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(5,10,25,.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, NW, NH);
    if (fv)
      fightView.draw(
        ctx,
        fv,
        NW,
        NH,
        T,
        low,
        fightRoom,
        fv.t / FIGHT_IN_SECONDS,
        PS,
        night(),
      );
  }

  /* ---------- size, enter, leave ---------- */
  function resize() {
    syncPhone();
    const nw = Math.max(1, layer.clientWidth),
      nh = Math.max(1, layer.clientHeight),
      // Low graphics draws one pixel per CSS pixel; iPhones and iPads keep
      // within a pixel budget (render-budget.ts).
      ps = low
        ? 1
        : sceneDensity(nw, nh, undefined, undefined, undefined, sharp);
    NW = nw;
    NH = nh;
    PS = ps;
    // The player's zoom, within what this screen may show (never more than
    // is built: an ultrawide monitor zooms in until it fills).
    setZoom(zoomF, false);
    cv.width = Math.round(nw * ps);
    cv.height = Math.round(nh * ps);
    renderQuests();
    sized = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(layer);
  resize();
  prep();
  renderQuests();
  try {
    if (
      localStorage.getItem("ea-plaza-help") !== "1" &&
      !matchMedia("(pointer: coarse)").matches
    ) {
      $("pz-start").hidden = false;
      localStorage.setItem("ea-plaza-help", "1");
    }
  } catch {
    /* no storage: no first-visit help */
  }
  /* ---------- panels over the Plaza ---------- */
  // What covers the Plaza, looked up once per DOM change, not every frame.
  let cover;
  const COVERS = "dialog, .home-drawer, .header-menu";
  const coverWatch = new MutationObserver((records) => {
    if (!cover) return;
    for (const r of records) {
      if (r.type === "attributes") return void (cover = undefined);
      for (const list of [r.addedNodes, r.removedNodes])
        for (const node of Array.from(list))
          if (
            node instanceof Element &&
            (node.matches(COVERS) || node.querySelector(COVERS))
          )
            return void (cover = undefined);
    }
  });
  coverWatch.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["open", "hidden"],
  });
  // The album counts too: you stand still, and the Plaza behind it rests.
  const coverNow = () =>
    (cover ??= {
      covered: !!document.querySelector(
        "dialog[open], .home-drawer:not([hidden]), .header-menu[open], .plaza-layer .pz-album:not([hidden])",
      ),
      hides: !!document.querySelector(
        "dialog[open], .home-drawer:not([hidden]), .plaza-layer .pz-album:not([hidden])",
      ),
    });
  /** A panel or menu is open over the Plaza: it gets the keys, you stand still. */
  function covered() {
    return coverNow().covered;
  }
  /** A dialog or drawer fills the screen: nothing of the Plaza shows. */
  function hidden() {
    return coverNow().hides;
  }
  let coveredAt,
    frozen = false;
  function freeze() {
    frozen = true;
    layer.dataset.frozen = "true";
    cancelAnimationFrame(raf);
    probe?.pause();
  }
  function wake() {
    if (!frozen || !running || hidden() || document.hidden) return;
    frozen = false;
    layer.dataset.frozen = "false";
    last = performance.now();
    raf = requestAnimationFrame(step);
  }
  const thaw = new MutationObserver(wake);
  thaw.observe(document.body, {
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

  running = true;
  last = performance.now();
  raf = requestAnimationFrame(step);
  screen.focus({ preventScroll: true });
  options
    .loadProgress()
    .then(setProgress)
    .catch(() => {});
  // Animals look alive even before the first server update.
  const chatter = setInterval(() => {
    if (!running || reduced) return;
    const b = pick([...others.values()].filter((o) => o.bot));
    if (b && Math.random() < 0.4) showEmote(b, pick(["👋", "GG", "🔥", "😎"]));
  }, 4000);

  let away = false;
  return {
    /** Behind the Lobby: stop drawing and walking, kept as it is
     *  (the screen leaves the Plaza on the server meanwhile). */
    hide() {
      if (away) return;
      away = true;
      running = false;
      cancelAnimationFrame(raf);
      joyReset();
      keys.clear();
      probe?.pause();
      layer.style.display = "none";
      // Where memory is short (an iPhone), the painted ground (a 3300 × 2300
      // canvas, 30 MB, with the world around the Plaza) is painted again on return instead of kept behind
      // the Lobby.
      // (Once the page is idle, not in the tap that switched tabs.)
      if (memoryConstrained())
        idleRelease = requestIdle(() => {
          if (!away) return;
          bg.width = bg.height = 0;
        });
    },
    /** Back: drawn at once as you left it; the server's state follows. */
    show() {
      if (!away) return;
      away = false;
      idleRelease?.();
      idleRelease = undefined;
      if (!bg.width) {
        bg.width = GW;
        bg.height = GH;
        // (paintBg reseeds the scene's random numbers; the rest of the
        // scene's sequence carries on as if it had not run again.)
        const kept = seed;
        paintBg();
        seed = kept;
      }
      layer.style.display = "";
      running = true;
      frozen = false;
      layer.dataset.frozen = "false";
      last = performance.now();
      raf = requestAnimationFrame(step);
      screen.focus({ preventScroll: true });
      options
        .loadProgress()
        .then(setProgress)
        .catch(() => {});
    },
    say,
    /** Your fighter or skin changed. */
    look(
      character,
      skin,
      colour = null,
      aura = null,
      entrance = null,
      victory = null,
    ) {
      P.character = character;
      P.skin = skin ?? null;
      P.colour = colour ?? null;
      // Your Aura shows at once; others' come with their profiles.
      P.aura = aura ?? null;
      P.entrance = entrance ?? null;
      P.victory = victory ?? null;
      P.fx = [];
      P.img = imageFor(character, skin ?? null, colour ?? null);
      // Arriving, or changing fighter or outfit: your entrance plays.
      greetWearer(P);
    },
    close() {
      setPerfSource("plaza", undefined);
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(chatter);
      clearInterval(thawCheck);
      coverWatch.disconnect();
      thaw.disconnect();
      ro.disconnect();
      socket.off("plaza-orbs", onOrbs);
      socket.off("plaza-progress", setProgress);
      socket.off("plaza-news", onNews);
      socket.off("plaza-profiles", onProfiles);
      socket.off("plaza-state", onState);
      socket.off("plaza-treat", onTreat);
      socket.off("plaza-treats", onTreats);
      socket.off("plaza-fish", onFish);
      clearTimeout(catchTimer);
      fishing.reset();
      socket.off("plaza-pair-ask", onPairAsk);
      socket.off("plaza-pair", onPair);
      socket.off("plaza-pair-no", onPairNo);
      clearTimeout(askTimer);
      socket.off("plaza-wish", onWish);
      socket.off("plaza-wish-paid", onWishPaid);
      removeEventListener("pointermove", pinchMove, true);
      removeEventListener("pointerup", pinchEnd, true);
      removeEventListener("pointercancel", pinchEnd, true);
      removeEventListener("pointermove", joyMove, true);
      removeEventListener("pointerup", joyEnd, true);
      removeEventListener("pointercancel", joyEnd, true);
      removeEventListener("blur", joyReset);
      removeEventListener("orientationchange", joyReset);
      document.removeEventListener("visibilitychange", onHidden);
      hideAlbum();
      album.close();
      layer.remove();
      syncHubGraphics();
    },
    _dbg: {
      /** The painted ground's colour at a world point (tests). */
      groundAt(x, y) {
        return [
          ...bg
            .getContext("2d")
            .getImageData(Math.round(x) + GM, Math.round(y) + GM, 1, 1).data,
        ];
      },
      /** Where a world point is on the page (tests). */
      worldClient(x, y) {
        const r = cv.getBoundingClientRect();
        return {
          x: r.left + (((x - cam.x) * Z + NW / 2) / NW) * r.width,
          y: r.top + (((y - cam.y) * Z + NH / 2) / NH) * r.height,
        };
      },
      /** The order things were last drawn in (tests; starts recording). */
      drawOrder() {
        const o = debugOrder === false ? [] : debugOrder;
        debugOrder = debugOrder || [];
        return o;
      },
      /** The view in world px, and the zoom (tests). */
      view: () => ({
        x0: cam.x - NW / 2 / Z,
        y0: cam.y - NH / 2 / Z,
        x1: cam.x + NW / 2 / Z,
        y1: cam.y + NH / 2 / Z,
        z: Z,
      }),
      /** The click marker now (tests). */
      clickMark: () => (clickMark ? { ...clickMark } : null),
      /** Tests: zoom to a factor of the usual (as a pinch or the wheel). */
      setZoom: (f) => setZoom(f),
      zoomRange: () => plazaZoomRange(NW, NH),
      /** Tests: hold the time of day (0.42 = midday). */
      setTod(t) {
        tod = t;
        todHold = 1e9;
      },
      P,
      others,
      orbs,
      ball,
      get score() {
        return score;
      },
      get progress() {
        return progress;
      },
      /** Treat particles flying now (tests). */
      treatFx: () => FX.filter((f) => f.g === "●").length,
      /** The wish meter and the fireworks' counts (tests). */
      wish: () => ({ ...wish, goal: wishGoal() }),
      fireworks: () => ({
        active: fireworks.active(serverNow()),
        stats: { ...fireworks.stats },
        peak: { ...fireworks.peak },
        cost: { ...fwCost },
        box: fireworks.bounds(),
        centres: fireworks.centres(),
      }),
      SPOTS,
      /** Fishing's line now: null, "cast", "wait" or "bite" (tests). */
      get fishing() {
        return fishing.state;
      },
      /** Fishing mode: on, its phase and the camera's extra zoom (tests). */
      get fishingMode() {
        return {
          active: fishing.active,
          phase: fishing.phase,
          fz,
          fight: fishing.fightView(),
          // What the camera shows, in Plaza coordinates.
          view: {
            x0: cam.x - NW / 2 / Z,
            y0: cam.y - NH / 2 / Z,
            x1: cam.x + NW / 2 / Z,
            y1: cam.y + NH / 2 / Z,
          },
        };
      },
      /** The photo album's store (tests fill it). */
      album,
    },
  };
}
