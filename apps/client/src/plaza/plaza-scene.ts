// @ts-nocheck
/*
 * The Plaza scene (hub redesign phase 3). The painting, the props, the
 * animals, the HUD and the touch model are ported from the approved
 * prototype (docs/hub-redesign/prototype/app/plaza.js). What changed: the
 * people are real players (and four pitch bots) that the game server moves;
 * the ball, the Orb Shower, lap times, runway cheers, quests and Volt Boba
 * all come from the server. The browser predicts only your own movement with
 * the same shared step. Ported drawing code is not type-checked line by
 * line; the typed entry point is plaza-screen.ts.
 */
import {
  ORB_SHOWER,
  PLAZA,
  PLAZA_BENCHES,
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
  PLAZA_PHOTO,
  PLAZA_PITCH,
  PLAZA_POND,
  PLAZA_QUESTS,
  PLAZA_ROCKS,
  PLAZA_SPAWN,
  PLAZA_SQUARE,
  PLAZA_STAGE,
  PLAZA_TRACK,
  PLAZA_TREES,
  PLAZA_WALK,
  inPitch,
  inSquare,
  onRunway,
  orbHeight,
  orbShower,
  plazaBody,
  plazaClear,
  plazaDash,
  plazaJump,
  plazaStep,
  trackPoint,
  trackPolar,
} from "../../../../packages/shared/src/plaza";
import { CROP_BY_ID } from "../../../../packages/shared/src/farm";
import { GFX } from "../farm/farm-gfx";
import {
  farmIcon as I,
  LEAF_ICON as L,
  farmIconImage as ICON_IMG,
  textWithIcon,
} from "../farm/farm-icons";
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
import "./plaza.css";

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const EMOTE_KEYS = PLAZA_EMOTES;

const PLAZA_HTML = `<div class="pz" id="pz">
  <canvas id="pz-cv" aria-label="Plaza"></canvas>
  <div class="pz-hud">
    <div class="pz-banner" id="pz-banner" aria-live="polite"></div>
    <div class="pz-event" id="pz-event" hidden></div>
    <div class="pz-timer glass" id="pz-timer" hidden></div>
    <div class="pz-mini glass" id="pz-mini" title="Click to walk there"><canvas id="pz-mcv"></canvas><button type="button" class="pz-clock" id="pz-clock" title="Preview day or night">--:--</button></div>
    <aside class="pz-quests glass" id="pz-quests"></aside>
    <div class="pz-feed" id="pz-feed" aria-live="polite"></div>
    <div class="pz-runcard glass" id="pz-runcard" hidden></div>
    <div class="pz-joy" id="pz-joy"><div class="ring" id="pz-ring"><div class="knob" id="pz-knob"></div></div></div>
    <div class="pz-left">
      <button type="button" class="pz-round" id="pz-wheel-btn" aria-label="Emotes">${I("smile")}<small>Emote</small></button>
      <button type="button" class="pz-round" id="pz-treat" aria-label="Throw a treat (T)">${I("berry")}<small id="pz-treats">0</small></button>
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
    <div class="pz-card glass" id="pz-card" role="dialog" aria-label="Player" hidden></div>
    <div class="pz-start" id="pz-start" hidden><b>Plaza</b><span>Click to start</span><div class="pz-keys"><span><kbd>WASD</kbd> move</span><span><kbd>Space</kbd> jump</span><span><kbd>Shift</kbd> dash</span><span><kbd>E</kbd> interact</span><span><kbd>Q</kbd> emote</span><span><kbd>T</kbd> treat</span></div></div>
  </div>
</div>`;

export function openPlaza(options) {
  const layer = document.createElement("div");
  layer.className = "plaza-layer";
  layer.tabIndex = -1;
  layer.innerHTML = PLAZA_HTML;
  document.body.append(layer);
  const screen = layer;
  const $ = (id) => layer.querySelector(`#${id}`);
  const socket = options.socket;
  const reduced = options.reduced;
  /** Low graphics (slow phones): no ambient animals or night glow, 30 fps. */
  let low = !!options.low;
  layer.dataset.graphics = low ? "low" : "high";
  layer.dataset.frozen = "false";
  // Auto (Settings → Graphics) watches the frame rate and may switch to Low.
  let probe =
    graphicsSetting() === "auto" && !low ? new FrameRateProbe() : undefined;
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
    ctx = cv.getContext("2d"),
    mcv = $("pz-mcv"),
    mctx = mcv.getContext("2d");
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
  const HOUSES = PLAZA_HOUSES.map((h) => ({ ...h, spr: GFX.house(h.o) }));
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
  bg.width = W;
  bg.height = H;
  function paintBg() {
    const g = bg.getContext("2d");
    seed = 11;
    // grass: soft gradient, painterly dabs, tufts, clover, little flowers
    g.fillStyle = "#77c25b";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W,
        y = rnd() * H,
        r = 120 + rnd() * 320,
        gr = g.createRadialGradient(x, y, 0, x, y, r),
        c = rnd() < 0.5 ? "150,220,110" : "70,150,70";
      gr.addColorStop(0, `rgba(${c},.28)`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const greens = ["#6cb851", "#82cc63", "#5fae4a", "#8fd46e", "#71bd55"];
    for (let i = 0; i < 26000; i++) {
      const x = rnd() * W,
        y = rnd() * H;
      g.fillStyle = greens[i % 5];
      g.beginPath();
      g.ellipse(x, y, 2.4 + rnd() * 2.6, 1.3 + rnd(), rnd() * 3, 0, 7);
      g.fill();
    }
    for (let i = 0; i < 2200; i++) {
      const x = rnd() * W,
        y = rnd() * H;
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
    for (let i = 0; i < 520; i++) {
      const x = rnd() * W,
        y = rnd() * H;
      if (!clear(x, y)) continue;
      const c = ["#ffffff", "#fff3a6", "#ffc4dc", "#cfe2ff"][i % 4];
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
    // stone paths: soft bed + rounded cobbles
    const path = (pts, w = 100) => {
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "rgba(60,90,40,.35)";
      g.lineWidth = w + 18;
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.strokeStyle = "#d9c9a3";
      g.lineWidth = w + 6;
      g.stroke();
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i],
          [x1, y1] = pts[i + 1],
          L = Math.hypot(x1 - x0, y1 - y0),
          ux = (x1 - x0) / L,
          uy = (y1 - y0) / L;
        for (let d = 0; d < L; d += 22)
          for (let k = -w / 2 + 14; k < w / 2 - 6; k += 24) {
            const jx = (rnd() - 0.5) * 6,
              jy = (rnd() - 0.5) * 6,
              x = x0 + ux * d - uy * (k + ((d / 22) % 2) * 12) + jx,
              y = y0 + uy * d + ux * (k + ((d / 22) % 2) * 12) + jy;
            const c = ["#efe3c8", "#e6d6b4", "#f4ead6", "#dccaa6"][
              Math.floor(rnd() * 4)
            ];
            g.fillStyle = "rgba(120,100,60,.45)";
            g.beginPath();
            g.roundRect(x - 10, y - 7 + 2, 20, 15, 6);
            g.fill();
            g.fillStyle = c;
            g.beginPath();
            g.roundRect(x - 10, y - 8, 20, 15, 6);
            g.fill();
            g.fillStyle = "rgba(255,255,255,.35)";
            g.beginPath();
            g.roundRect(x - 7, y - 6, 9, 3.5, 2);
            g.fill();
          }
      }
    };
    path(
      [
        [SQ.x, SQ.y + 200],
        [SQ.x, GATE.y + 30],
      ],
      116,
    );
    path(
      [
        [SQ.x + 330, SQ.y],
        [PITCH.x0 + 10, SQ.y],
      ],
      104,
    );
    path(
      [
        [SQ.x - 350, SQ.y],
        [TRACK.cx + TRACK.ro[0] - 30, TRACK.cy],
      ],
      104,
    );
    path(
      [
        [SQ.x, SQ.y - 200],
        [SQ.x, WALK.y1 - 10],
      ],
      116,
    );
    path(
      [
        [SQ.x + 220, SQ.y - 180],
        [CAFE.x - 40, CAFE.y + 50],
      ],
      80,
    );
    path(
      [
        [SQ.x - 220, SQ.y - 180],
        [PHOTO.x + 20, PHOTO.y + 50],
      ],
      80,
    );
    path(
      [
        [SQ.x - 240, SQ.y + 200],
        [BOARD.x + 30, BOARD.y - 10],
      ],
      72,
    );
    path(
      [
        [SQ.x + 120, GATE.y - 200],
        [POND.x - 170, POND.y - 40],
      ],
      72,
    );
    path(
      [
        [TRACK.cx - 40, TRACK.cy - TRACK.ro[1] - 10],
        [LEADER.x + 20, LEADER.y + 30],
      ],
      64,
    );
    path(
      [
        [410, 330],
        [410, 470],
        [900, 520],
      ],
      64,
    );
    path(
      [
        [2300, 330],
        [2300, 460],
        [1900, 500],
      ],
      64,
    );
    // plaza square: concentric pavers + elemental mosaic
    g.save();
    g.translate(SQ.x, SQ.y);
    g.scale(1, SQ.ry / SQ.rx);
    g.fillStyle = "rgba(60,50,30,.35)";
    g.beginPath();
    g.arc(0, 14, SQ.rx + 16, 0, 7);
    g.fill();
    g.fillStyle = "#b9a98a";
    g.beginPath();
    g.arc(0, 0, SQ.rx + 8, 0, 7);
    g.fill();
    const tones = ["#f2e8d4", "#e9dcc2", "#efe2c9", "#e2d3b5", "#f6eedd"];
    for (let r0 = 130; r0 < SQ.rx; r0 += 30) {
      const r1 = Math.min(SQ.rx, r0 + 30),
        n = Math.round((2 * Math.PI * r1) / 44),
        off = rnd();
      for (let k = 0; k < n; k++) {
        const a0 = ((k + off) / n) * Math.PI * 2,
          a1 = ((k + 1 + off) / n) * Math.PI * 2;
        g.beginPath();
        g.arc(0, 0, r1 - 2, a0 + 0.006, a1 - 0.006);
        g.arc(0, 0, r0 + 2, a1 - 0.006, a0 + 0.006, true);
        g.closePath();
        g.fillStyle =
          r0 > SQ.rx - 40 ? "#d2c2a2" : tones[Math.floor(rnd() * tones.length)];
        g.fill();
      }
    }
    g.fillStyle = "#e9dcc2";
    g.beginPath();
    g.arc(0, 0, 128, 0, 7);
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
      g.beginPath();
      g.moveTo(0, -60);
      g.lineTo(150, -10);
      g.lineTo(220, 0);
      g.lineTo(150, 10);
      g.lineTo(0, 60);
      g.closePath();
      g.fillStyle = GFX.rgba(EL[i], 0.5);
      g.fill();
      g.restore();
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2,
        x = Math.cos(a) * (SQ.rx - 70),
        y = Math.sin(a) * (SQ.rx - 70);
      g.fillStyle = "#f8f2e4";
      g.beginPath();
      g.arc(x, y, 24, 0, 7);
      g.fill();
      g.fillStyle = EL[i];
      g.beginPath();
      g.arc(x, y, 15, 0, 7);
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
    g.beginPath();
    g.ellipse(TRACK.cx, TRACK.cy, TRACK.ro[0], TRACK.ro[1], 0, 0, 7);
    g.ellipse(TRACK.cx, TRACK.cy, TRACK.ri[0], TRACK.ri[1], 0, 0, 7, true);
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
    g.save();
    g.beginPath();
    g.ellipse(TRACK.cx, TRACK.cy, TRACK.ri[0] - 3, TRACK.ri[1] - 3, 0, 0, 7);
    g.clip();
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? "rgba(140,210,100,.35)" : "rgba(80,150,60,.25)";
      g.fillRect(TRACK.cx - 270 + i * 54, TRACK.cy - 180, 54, 360);
    }
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
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? "#5fb951" : "#56ad48";
      g.fillRect(
        PITCH.x0 + (i * (PITCH.x1 - PITCH.x0)) / 10,
        PITCH.y0,
        (PITCH.x1 - PITCH.x0) / 10 + 1,
        PITCH.y1 - PITCH.y0,
      );
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
    g.fillStyle = "rgba(255,255,255,.22)";
    g.beginPath();
    g.ellipse(PHOTO.x, PHOTO.y + 30, 74, 40, 0, 0, 7);
    g.fill();
    g.strokeStyle = "#ffffffaa";
    g.setLineDash([8, 8]);
    g.lineWidth = 2;
    g.stroke();
    g.setLineDash([]);
    // garden strip beyond the gate
    g.fillStyle = "#5fa444";
    g.fillRect(0, GATE.y + 20, W, H - GATE.y - 20);
    for (let r = 0; r < 2; r++)
      for (let x = 80; x < W - 60; x += 150) {
        if (Math.abs(x + 55 - GATE.x) < 170) continue;
        g.fillStyle = "#7a5534";
        g.beginPath();
        g.roundRect(x, GATE.y + 42 + r * 30, 110, 20, 8);
        g.fill();
        for (let k = 0; k < 5; k++) {
          g.fillStyle = "#3f8f3a";
          g.beginPath();
          g.arc(x + 11 + k * 22, GATE.y + 46 + r * 30, 7, 0, 7);
          g.fill();
          g.fillStyle = "#8fdc66";
          g.beginPath();
          g.arc(x + 9 + k * 22, GATE.y + 44 + r * 30, 4, 0, 7);
          g.fill();
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
  }
  function prep() {
    paintBg();
    ready = true;
  }

  /* ---------- people: you (predicted) and everyone the server shows ---------- */
  const art = new Map();
  const imageFor = (character, skin) => {
    const key = `${character}:${skin?.skin ?? ""}:${skin?.stage ?? 1}`;
    let im = art.get(key);
    if (!im) {
      im = new Image();
      im.decoding = "async";
      im.src = options.art(character, skin);
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
  /** The server's latest position for you, to correct the prediction. */
  let srv = null;
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
    r: 0.4 + (i % 2) * 0.25,
  }));
  const FISH = [0, 1, 2].map((i) => ({
    a: i * 2,
    x: POND.x,
    y: POND.y,
    s: 0.3 + i * 0.1,
    jump: 0,
    c: ["#ff8a3d", "#ffffff", "#ffd65b"][i],
  }));
  const HENS = ["white", "brown", "white"].map((k, i) => ({
    k,
    x: GATE.x - 220 + i * 190,
    y: GATE.y - 100 + i * 18,
    tx: null,
    ty: null,
    wait: 1 + i,
    face: 1,
    st: "idle",
    t0: 0,
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
  /** Low graphics: the ambient animals go; the people, ball and orbs stay. */
  function goLow() {
    low = true;
    layer.dataset.graphics = "low";
    for (const list of [DUCKS, FISH, HENS, PIGEONS, BUTTER, SMOKE])
      list.length = 0;
    flock = null;
    // Redraw at 1x (before the first resize, that sizes it anyway).
    if (sized) resize();
  }
  if (low) goLow();
  let claps = 0,
    runwayOn = false,
    zoneName = "",
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
            text: `+${ORB_SHOWER.leaves}`,
            leaf: 1,
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
  const qmin = { desk: false, phone: true };
  const qk = () => (layer.classList.contains("phone") ? "phone" : "desk");
  function renderQuests() {
    const box = $("pz-quests");
    const q = progress?.quests;
    const done = q ? PLAZA_QUESTS.filter((x) => q[x.id]?.done).length : 0;
    box.className = `pz-quests glass${qmin[qk()] ? " min" : ""}`;
    box.innerHTML = `<h5><span>Plaza today · ${done}/${PLAZA_QUESTS.length}</span><button type="button" data-qmin aria-label="${qmin[qk()] ? "Expand" : "Collapse"}">${qmin[qk()] ? "▾" : "▴"}</button></h5>${PLAZA_QUESTS.map(
      (x) => {
        const n = q?.[x.id]?.n ?? 0,
          paid = q?.[x.id]?.done;
        return `<div class="pz-q${paid ? " done" : ""}"><span>${x.text}</span><span class="rw">${paid ? "✓" : `+${x.leaves} ${L}`}</span><span class="bar"><i style="width:${(Math.min(n, x.max) / x.max) * 100}%"></i></span></div>`;
      },
    ).join("")}`;
  }
  $("pz-quests").addEventListener("click", (e) => {
    if (e.target.closest("[data-qmin]")) {
      qmin[qk()] = !qmin[qk()];
      renderQuests();
    }
  });
  function setProgress(p) {
    if (!p?.quests) return;
    const before = progress;
    progress = p;
    if (before)
      for (const x of PLAZA_QUESTS)
        if (p.quests[x.id]?.done && !before.quests[x.id]?.done) {
          feed(
            null,
            `Quest complete: <b>${esc(x.text)}</b> · +${x.leaves} ${L}`,
          );
          pzToast(`+${x.leaves} Gold Leaves`);
        }
    if (typeof p.leaves === "number") options.onLeaves(p.leaves);
    renderQuests();
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
    if (n.kind === "goal") {
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
    if (photoOpen) {
      if (k === "escape" || k === "e") closePhoto();
      return;
    }
    start();
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
    if ("12345678".includes(k) && k.length === 1) emote(EMOTE_KEYS[+k - 1]);
  }
  screen.addEventListener("keydown", onKey);
  screen.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  screen.addEventListener("blur", () => keys.clear());
  function start() {
    $("pz-start").hidden = true;
  }
  $("pz-start").onclick = () => {
    start();
    screen.focus({ preventScroll: true });
  };
  $("pz-jump").onclick = () => {
    start();
    jump();
    screen.focus({ preventScroll: true });
  };
  $("pz-dash").onclick = () => {
    start();
    dash();
    screen.focus({ preventScroll: true });
  };
  $("pz-interact").onclick = () => {
    interact();
    screen.focus({ preventScroll: true });
  };
  $("pz-treat").onclick = () => {
    start();
    throwTreat();
    screen.focus({ preventScroll: true });
  };
  $("pz-wheel-btn").onclick = () => {
    start();
    toggleWheel();
  };
  $("pz-album-btn").onclick = () => {
    start();
    showAlbum();
  };
  $("pz-wheel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-emote]");
    if (b) {
      emote(b.dataset.emote);
      toggleWheel(false);
      screen.focus({ preventScroll: true });
    }
  });
  function toggleWheel(on) {
    const w = $("pz-wheel"),
      show = on ?? w.hidden;
    w.hidden = !show;
    if (show) {
      const r = $("pz-wheel-btn").getBoundingClientRect(),
        sr = $("pz").querySelector(".pz-hud").getBoundingClientRect();
      w.style.left = `${Math.min(sr.width - 120, r.left + r.width / 2 - sr.left + 100)}px`;
      w.style.top = `${Math.max(120, r.top - sr.top - 90)}px`;
    }
  }
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
    toggleWheel(false);
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
    if (e.pointerType === "mouse") target = w;
  });
  /** The player card: name, level, title; add friend, invite to party. */
  let cardFor = null;
  function showCard(b) {
    const p = profiles.get(b.id);
    if (!p?.accountId) return;
    cardFor = p;
    const card = $("pz-card");
    card.innerHTML = `<div class="pc-h"><img src="${b.img?.src ?? ""}" alt=""><div><b>${esc(p.name)}</b><small>${p.level ? `Lv ${p.level}` : ""}${p.title ? ` · <span style="color:${esc(p.titleColor ?? "#ffd65b")}">${esc(p.title)}</span>` : ""}</small></div><button type="button" class="x" data-pc="close" aria-label="Close">✕</button></div><div class="pc-acts"><button type="button" data-pc="friend">Add friend</button><button type="button" data-pc="party">Invite to party</button></div>`;
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
    b.disabled = true;
    try {
      await options.onPlayer(b.dataset.pc, cardFor.accountId);
    } finally {
      b.disabled = false;
    }
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
  $("pz-mini").addEventListener("pointerdown", (e) => {
    if (e.target.closest("#pz-clock")) return;
    e.stopPropagation();
    start();
    const r = $("pz-mini").getBoundingClientRect();
    target = {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
    screen.focus({ preventScroll: true });
  });

  /* ---------- actions: predicted here, decided by the server ---------- */
  function jump() {
    if (plazaJump(P)) socket.emit("plaza-jump");
  }
  function dash() {
    if (plazaDash(P)) socket.emit("plaza-dash");
  }
  let emoteAt = 0;
  function emote(e) {
    const now = performance.now();
    if (now - emoteAt < 1000) return;
    emoteAt = now;
    showEmote(P, e);
    socket.emit("plaza-emote", { emote: e });
  }
  function showEmote(b, e) {
    b.emote = e;
    b.emoteT = PLAZA.emoteSeconds;
    if (e === "💃") b.dance = 4;
  }
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
      label: `Volt Boba · ${PLAZA.boba.leaves}`,
      icon: "boba",
      leaf: true,
      act: buyTea,
    },
    {
      id: "board",
      x: BOARD.x,
      y: BOARD.y + 30,
      r: 100,
      label: "Event board",
      icon: "clipboard",
      act: () => {
        qmin[qk()] = false;
        renderQuests();
        pzToast("Plaza quests are open");
      },
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
    {
      id: "gate",
      x: GATE.x,
      y: GATE.y - 40,
      r: 110,
      label: "Enter the Farm",
      icon: "wheat",
      act: () => options.goFarm(),
    },
  ];
  let near = null;
  function interact() {
    if (near) near.act();
  }
  /* treats (migration 049): a regular crop from your barn, tossed for everyone */
  let treats = 0,
    treatBusy = false;
  function setTreats(n) {
    treats = Math.max(0, n | 0);
    $("pz-treats").textContent = treats > 99 ? "99+" : String(treats);
  }
  function throwTreat() {
    if (treatBusy) return;
    if (treats < 1)
      return pzToast("No crops to throw yet. Harvest some on the Farm.");
    treatBusy = true;
    socket.timeout(5000).emit("plaza-treat", {}, (err, r) => {
      treatBusy = false;
      if (err) return pzToast("The treat didn't go. Try again.");
      if (typeof r?.treats === "number") setTreats(r.treats);
      if (!r?.ok)
        return pzToast(r?.error ?? "Treats can't be thrown right now.");
      pzToast(`Tossed ${CROP_BY_ID[r.crop]?.name ?? "a treat"} to everyone!`);
    });
  }
  // Everyone in this Plaza sees a treat burst where it was thrown.
  const onTreat = (t) => {
    if (!t || typeof t.x !== "number") return;
    burst(t.x, t.y, 70, "●", 18, CROP_BY_ID[t.crop]?.color ?? "#ff6fae", 1.2);
  };
  const onTreats = (t) => setTreats(t?.n ?? 0);
  socket.on("plaza-treat", onTreat);
  socket.on("plaza-treats", onTreats);
  let bobaBusy = false;
  function buyTea() {
    if (P.boost > 0) return pzToast("Your boba boost is still active");
    if (bobaBusy) return;
    bobaBusy = true;
    socket.timeout(5000).emit("plaza-act", { spot: "cafe" }, (err, r) => {
      bobaBusy = false;
      if (err) return pzToast("Volt Boba didn't answer. Try again.");
      if (typeof r?.leaves === "number") options.onLeaves(r.leaves);
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
      socket.emit("plaza-input", { dx: 0, dy: 0 });
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
      box.innerHTML = `<div class="polaroid"><div class="print"><img src="${url}" alt="Photo taken in the Plaza"><p title="${esc(caption)}">${esc(caption)}</p><small>${esc(place)}</small></div><div class="acts"><button type="button" class="pz-main" data-ph="album">Save to album</button><a data-ph="keep" href="${url}" download="${pictureName(at)}">Save picture</a><button type="button" data-ph="close">Close</button></div></div>`;
      box.querySelector('[data-ph="album"]').onclick = (e) =>
        keepInAlbum(mine, e.currentTarget);
      box.querySelector('[data-ph="keep"]').onclick = () =>
        setTimeout(closePhoto, 100);
      box.querySelector('[data-ph="close"]').onclick = closePhoto;
    }, 160);
  }
  function closePhoto() {
    shot = null;
    $("pz-photo").hidden = true;
    screen.focus({ preventScroll: true });
  }

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
    if (!x && !y && target) {
      const dx = target.x - P.x,
        dy = target.y - P.y,
        d = Math.hypot(dx, dy);
      if (d < 10) target = null;
      else {
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
  /** Send the stick when it changes (at most every 50 ms), and once a second while moving. */
  let sent = { x: 0, y: 0 },
    sentAt = 0;
  function sendInput(dir, now) {
    const x = Math.round(dir.x * 100) / 100,
      y = Math.round(dir.y * 100) / 100,
      changed = x !== sent.x || y !== sent.y;
    if ((changed && now - sentAt >= 50) || ((x || y) && now - sentAt >= 1000)) {
      socket.emit("plaza-input", { dx: x, dy: y });
      sent = { x, y };
      sentAt = now;
    }
  }

  /** Set markup only when it changed (no relayout every frame). */
  const setHtml = (el, html) => {
    if (el.__html !== html) {
      el.__html = html;
      el.innerHTML = html;
    }
  };
  const setClass = (el, cls) => {
    if (el.className !== cls) el.className = cls;
  };
  /* ---------- the server's view ---------- */
  socket.on("plaza-profiles", onProfiles);
  function onProfiles(list) {
    for (const p of list) {
      profiles.set(p.id, p);
      const b = others.get(p.id);
      if (b)
        Object.assign(b, {
          name: p.name,
          bot: !!p.bot,
          skin: p.skin,
          img: imageFor(p.character, p.skin),
        });
      if (p.id === meId) {
        P.name = p.name;
        P.character = p.character;
        P.skin = p.skin;
        P.img = imageFor(p.character, p.skin);
      }
    }
  }
  socket.on("plaza-state", onState);
  function onState(s) {
    meId = s.me;
    offset = s.now - Date.now();
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
        if (!(flags & PLAZA_FLAG.boost)) P.boost = 0;
        continue;
      }
      seen.add(id);
      let b = others.get(id);
      const p = profiles.get(id);
      if (!b) {
        b = decorate({
          id,
          x,
          y,
          name: p?.name ?? "",
          bot: !!p?.bot,
          skin: p?.skin ?? null,
          img: imageFor(p?.character ?? "voltkit", p?.skin ?? null),
          emoteIdx: 0,
        });
        others.set(id, b);
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
      if (emoteIdx !== b.emoteIdx) {
        b.emoteIdx = emoteIdx;
        if (emoteIdx) showEmote(b, EMOTE_KEYS[emoteIdx - 1]);
      }
    }
    for (const id of others.keys()) if (!seen.has(id)) others.delete(id);
  }
  let lapState = null,
    lapShown = null;
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
    if (!lapState) {
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
        const skin = P.skin?.skin ? options.skinName(P.skin.skin) : null;
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
    setClass(el, "pz-event");
    setHtml(
      el,
      `<span class="ic">${I("orb")}</span><span>Orb Shower · <b>${Math.max(0, Math.ceil((s.endsAt - now) / 1000))}s</b> left</span><small>+${ORB_SHOWER.leaves} ${L} per orb</small>`,
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
  function drawLamp(g, l) {
    GFX.shadow(g, l.x + 6, l.y + 2, 18, 6);
    GFX.blit(g, GFX.lamp(), l.x, l.y + 4);
  }
  function drawFountain(g, time) {
    const { x, y } = FOUNT;
    // basin wall (front) + rim + water
    const brx = 126,
      bry = 80,
      wallH = 24;
    g.fillStyle = "rgba(30,40,40,.3)";
    g.beginPath();
    g.ellipse(x + 8, y + wallH + 6, brx + 10, bry + 8, 0, 0, 7);
    g.fill();
    g.beginPath();
    g.ellipse(x, y, brx, bry, 0, 0, Math.PI);
    g.lineTo(x - brx, y + wallH);
    g.ellipse(x, y + wallH, brx, bry, 0, Math.PI, 0, true);
    g.closePath();
    const wg = g.createLinearGradient(0, y, 0, y + bry + wallH);
    wg.addColorStop(0, "#efe6d4");
    wg.addColorStop(1, "#b4a78e");
    g.fillStyle = wg;
    g.fill();
    g.strokeStyle = "#857a64";
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = "rgba(133,122,100,.5)";
    g.lineWidth = 1.2;
    for (let k = -5; k <= 5; k++) {
      const a = Math.PI / 2 + k * 0.27,
        px = x + Math.cos(a) * brx,
        py = y + Math.sin(a) * bry;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px, py + wallH);
      g.stroke();
    }
    g.fillStyle = "#f7f0e2";
    g.beginPath();
    g.ellipse(x, y, brx, bry, 0, 0, 7);
    g.fill();
    g.strokeStyle = "#a59a84";
    g.lineWidth = 2;
    g.stroke();
    const water = g.createRadialGradient(x - 30, y - 20, 10, x, y, brx);
    water.addColorStop(0, "#9ff0ff");
    water.addColorStop(0.6, "#3fb8d8");
    water.addColorStop(1, "#1f86b0");
    g.fillStyle = water;
    g.beginPath();
    g.ellipse(x, y + 2, brx - 15, bry - 11, 0, 0, 7);
    g.fill();
    g.save();
    g.beginPath();
    g.ellipse(x, y + 2, brx - 15, bry - 11, 0, 0, 7);
    g.clip();
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) {
      const yy = y - 50 + i * 12,
        ph = time * 1.4 + i;
      g.beginPath();
      for (let xx = x - brx; xx < x + brx; xx += 8)
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
    g.restore();
    // pillar + middle bowl
    const pil = (yt, yb, w) => {
      g.fillStyle = GFX.mix("#f2ead8", "#b9ad94", 0.1);
      const gg = g.createLinearGradient(x - w, 0, x + w, 0);
      gg.addColorStop(0, "#fffaf0");
      gg.addColorStop(1, "#b9ad94");
      g.fillStyle = gg;
      g.fillRect(x - w, yt, w * 2, yb - yt);
      g.strokeStyle = "#857a64";
      g.lineWidth = 1.5;
      g.strokeRect(x - w, yt, w * 2, yb - yt);
    };
    pil(y - 52, y, 13);
    const bowl = (by, rx, ry, d) => {
      g.beginPath();
      g.ellipse(x, by, rx, ry, 0, 0, Math.PI);
      g.lineTo(x - rx * 0.55, by + d);
      g.ellipse(x, by + d, rx * 0.55, ry * 0.5, 0, Math.PI, 0, true);
      g.closePath();
      const bg2 = g.createLinearGradient(0, by, 0, by + d + ry);
      bg2.addColorStop(0, "#f2ead8");
      bg2.addColorStop(1, "#a99c82");
      g.fillStyle = bg2;
      g.fill();
      g.strokeStyle = "#857a64";
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = "#f7f0e2";
      g.beginPath();
      g.ellipse(x, by, rx, ry, 0, 0, 7);
      g.fill();
      g.stroke();
      g.fillStyle = water;
      g.beginPath();
      g.ellipse(x, by + 1, rx - 8, ry - 5, 0, 0, 7);
      g.fill();
    };
    bowl(y - 56, 64, 30, 18);
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
    pil(y - 104, y - 56, 9);
    bowl(y - 108, 34, 16, 10);
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
    if (star && star.img?.complete) {
      g.drawImage(star.img, x0 + 20, y0 + 6, h * 0.99, h * 1.0);
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
  function drawGoal(g, x, left) {
    const y0 = PITCH.gy0,
      y1 = PITCH.gy1,
      d = left ? -46 : 46,
      hgt = 60;
    g.strokeStyle = "rgba(255,255,255,.55)";
    g.lineWidth = 1;
    for (let k = 0; k <= 6; k++) {
      const yy = y0 + ((y1 - y0) * k) / 6;
      g.beginPath();
      g.moveTo(x, yy - hgt);
      g.lineTo(x + d, yy - hgt * 0.6);
      g.lineTo(x + d, yy);
      g.stroke();
    }
    for (let k = 0; k <= 4; k++) {
      const hh = (hgt * k) / 4;
      g.beginPath();
      g.moveTo(x, y0 - hh);
      g.lineTo(x, y1 - hh);
      g.stroke();
    }
    g.strokeStyle = "#fff";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, y1);
    g.lineTo(x, y1 - hgt);
    g.lineTo(x, y0 - hgt);
    g.lineTo(x, y0);
    g.stroke();
    g.strokeStyle = left ? "#5ab0ff" : "#ff5d6c";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x, y0 - hgt);
    g.lineTo(x, y1 - hgt);
    g.stroke();
  }
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
  function drawGantry(g) {
    const x = TRACK.cx,
      ya = TRACK.cy - TRACK.ro[1] - 4,
      yb = TRACK.cy - TRACK.ri[1] + 4;
    g.fillStyle = "#2a2f42";
    g.fillRect(x - 6, ya - 150, 12, 152);
    g.fillRect(x - 6, yb - 150, 12, 152);
    g.fillStyle = "#11131d";
    g.beginPath();
    g.moveTo(x - 10, ya - 170);
    g.lineTo(x + 10, ya - 170);
    g.lineTo(x + 10, yb - 140);
    g.lineTo(x - 10, yb - 140);
    g.fill();
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
  function drawHurdle(g, [p0, p1]) {
    g.strokeStyle = "rgba(0,0,0,.3)";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(p0.x, p0.y + 4);
    g.lineTo(p1.x, p1.y + 4);
    g.stroke();
    g.fillStyle = "#e6e6ee";
    [p0, p1].forEach((p) => g.fillRect(p.x - 3, p.y - 24, 6, 26));
    g.lineCap = "butt";
    g.strokeStyle = "#fff";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(p0.x, p0.y - 22);
    g.lineTo(p1.x, p1.y - 22);
    g.stroke();
    g.strokeStyle = "#ef4f61";
    g.setLineDash([14, 14]);
    g.beginPath();
    g.moveTo(p0.x, p0.y - 22);
    g.lineTo(p1.x, p1.y - 22);
    g.stroke();
    g.setLineDash([]);
  }
  function drawLeader(g) {
    const { x, y } = LEADER;
    g.fillStyle = "rgba(0,0,0,.25)";
    g.beginPath();
    g.ellipse(x + 10, y + 3, 90, 14, 0, 0, 7);
    g.fill();
    g.fillStyle = "#2a2f42";
    g.fillRect(x - 70, y - 150, 8, 152);
    g.fillRect(x + 62, y - 150, 8, 152);
    g.fillStyle = "#0b0d16";
    g.fillRect(x - 90, y - 250, 180, 150);
    g.fillStyle = "#151b36";
    g.fillRect(x - 84, y - 244, 168, 138);
    g.textAlign = "left";
    g.font = "800 20px 'Barlow Condensed', sans-serif";
    g.fillStyle = "#ffd65b";
    {
      const tr = ICON_IMG("trophy");
      if (tr.complete) g.drawImage(tr, x - 76, y - 238, 22, 22);
    }
    g.fillText("TOP DASH", x - 50, y - 220);
    const rows = boardRows();
    if (!rows.length) {
      g.font = "700 14px 'DM Sans', sans-serif";
      g.fillStyle = "#a0afc8";
      g.fillText("No laps this week yet", x - 74, y - 196);
    }
    rows.slice(0, 5).forEach(([n, t, mine], i) => {
      g.font = "700 14px 'DM Sans', sans-serif";
      g.fillStyle = mine ? "#ffd65b" : "#e6ecff";
      g.fillText(`${i + 1}. ${n}`, x - 74, y - 196 + i * 20);
      g.textAlign = "right";
      g.fillText(t.toFixed(2), x + 74, y - 196 + i * 20);
      g.textAlign = "left";
    });
  }
  function drawPhoto(g, time) {
    const { x, y } = PHOTO;
    GFX.blit(g, GFX.bush("flower", 31, 70), x - 104, y + 6);
    GFX.blit(g, GFX.bush("rose", 32, 70), x + 104, y + 6);
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
    g.strokeText("PHOTO SPOT", x, y - 246);
    g.fillText("PHOTO SPOT", x, y - 246);
    // camera on a tripod
    const cx = x + 72,
      cy = y - 6;
    g.strokeStyle = "#2c3348";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx, cy - 46);
    g.lineTo(cx - 12, cy);
    g.moveTo(cx, cy - 46);
    g.lineTo(cx + 12, cy);
    g.moveTo(cx, cy - 46);
    g.lineTo(cx, cy + 2);
    g.stroke();
    g.fillStyle = "#2c3348";
    g.beginPath();
    g.roundRect(cx - 16, cy - 66, 32, 22, 5);
    g.fill();
    g.fillStyle = "#8fd0ff";
    g.beginPath();
    g.arc(cx - 3, cy - 55, 7, 0, 7);
    g.fill();
    g.fillStyle = "#ef4f61";
    g.beginPath();
    g.arc(cx + 10, cy - 62, 2.5, 0, 7);
    g.fill();
  }
  function drawCafe(g) {
    GFX.blit(g, GFX.foodTruck(), CAFE.x, CAFE.y + 4);
    GFX.blit(g, GFX.bench(), CAFE.x - 170, CAFE.y + 70);
  }
  function drawBoard(g) {
    GFX.shadow(g, BOARD.x + 8, BOARD.y + 2, 70, 14);
    GFX.blit(g, GFX.board(), BOARD.x, BOARD.y + 4);
    g.textAlign = "center";
    g.font = "800 18px 'Barlow Condensed', sans-serif";
    g.fillStyle = "#fff";
    g.strokeStyle = "#2a1f12";
    g.lineWidth = 4;
    g.strokeText("EVENT BOARD", BOARD.x, BOARD.y - 150);
    g.fillText("EVENT BOARD", BOARD.x, BOARD.y - 150);
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
    g.fillStyle = "#7a5230";
    g.beginPath();
    g.roundRect(x - 64, y - 206, 128, 36, 8);
    g.fill();
    g.fillStyle = "#fff4d6";
    g.font = "800 22px 'Barlow Condensed', sans-serif";
    g.textAlign = "center";
    g.fillText("THE FARM", x, y - 181);
    GFX.blit(g, GFX.mailbox(), x + 120, y + 2);
    GFX.blit(g, GFX.hay(), x - 140, y + 4);
  }
  function drawHouse(g, h, n) {
    GFX.shadow(g, h.x + 30, h.y + 4, 110, 22);
    GFX.blit(g, h.spr, h.x, h.y);
    if (n > 0.05 && h.spr.win)
      h.spr.win.forEach(([wx, wy, ww, wh]) => {
        g.fillStyle = `rgba(255,214,120,${0.85 * n})`;
        g.beginPath();
        g.roundRect(h.x + wx, h.y + wy, ww, wh, 3);
        g.fill();
      });
  }
  function drawBody(g, b, time, photo) {
    const s = 84,
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
    if (!im || !im.complete) return;
    for (const tr of b.trail) {
      g.globalAlpha = 0.32 * (1 - tr.t / 0.3);
      drawSprite(g, im, tr.x, tr.y - tr.z, s, b.face, 0, 0);
    }
    g.globalAlpha = 1;
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
    drawSprite(g, im, b.x, b.y - b.z - bob, s, b.face, rot, sq);
    g.font = "700 13px 'DM Sans', sans-serif";
    g.textAlign = "center";
    g.lineWidth = 3.5;
    g.strokeStyle = "rgba(11,16,32,.85)";
    g.fillStyle = b.me ? "#ffd65b" : "#fff";
    const ny = b.y - b.z - s * 0.92 - 6;
    g.strokeText(b.name, b.x, ny);
    g.fillText(b.name, b.x, ny);
    if (b.emoteT > 0) {
      const a = Math.max(
        0,
        Math.min(1, b.emoteT / 0.3, (2.6 - b.emoteT) / 0.15),
      );
      g.globalAlpha = a;
      const by = ny - 26;
      g.fillStyle = "#fff";
      g.beginPath();
      g.roundRect(b.x - 23, by - 19, 46, 32, 11);
      g.fill();
      g.beginPath();
      g.moveTo(b.x - 5, by + 13);
      g.lineTo(b.x + 5, by + 13);
      g.lineTo(b.x, by + 19);
      g.fill();
      g.fillStyle = "#111";
      g.font =
        b.emote.length > 2
          ? "800 17px 'Barlow Condensed', sans-serif"
          : "19px sans-serif";
      g.fillText(b.emote, b.x, by + 4);
      g.globalAlpha = 1;
    }
  }
  function drawSprite(g, im, x, y, s, face, rot, sq) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale((face < 0 ? -1 : 1) * (1 + sq), 1 - sq);
    g.drawImage(im, -s / 2, -s * 0.9, s, s * 1.01);
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
      [x - 120, y - 30, 22],
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
      const nx = POND.x + Math.cos(d.a) * POND.rx * d.r * 1.2,
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
    HENS.forEach((h) => {
      if (h.wait > 0) {
        h.wait -= dt;
        if (h.wait <= 0) h.st = "idle";
        return;
      }
      if (h.tx == null) {
        if (Math.random() < 0.4) {
          h.st = "peck";
          h.wait = 1.5 + Math.random() * 2;
          return;
        }
        h.tx = GATE.x - 300 + Math.random() * 600;
        h.ty = GATE.y - 170 + Math.random() * 130;
        if (Math.abs(h.tx - GATE.x) < 90) h.tx += 200;
      }
      const dx = h.tx - h.x,
        dy = h.ty - h.y,
        d = Math.hypot(dx, dy);
      if (d < 5) {
        h.tx = null;
        h.st = "idle";
        h.wait = 0.6 + Math.random() * 1.5;
        return;
      }
      h.st = "walk";
      h.face = dx > 0 ? 1 : -1;
      h.x += (dx / d) * 50 * dt;
      h.y += (dy / d) * 50 * dt;
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
  function drawSpotlights(g, time) {
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
    g.save();
    g.globalCompositeOperation = "lighter";
    targets.forEach((t, k) => {
      const hx =
          heads[stars.length ? (k === 0 ? 1 : k % 2 ? 0 : 2) : k ? 2 : 0],
        w = 58;
      const gr = g.createLinearGradient(hx, hy, t.x, t.y);
      gr.addColorStop(0, `rgba(255,246,210,${0.28 * t.on})`);
      gr.addColorStop(1, `rgba(255,246,210,${0.06 * t.on})`);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(hx - 8, hy);
      g.lineTo(hx + 8, hy);
      g.lineTo(t.x + w, t.y);
      g.ellipse(t.x, t.y, w, w * 0.38, 0, 0, Math.PI);
      g.lineTo(t.x - w, t.y);
      g.closePath();
      g.fill();
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
  function drawWorld(g, time, photo = false) {
    // What this canvas shows of the world, so only that much is drawn.
    const inv = g.getTransform().inverse(),
      c0 = inv.transformPoint({ x: 0, y: 0 }),
      c1 = inv.transformPoint({ x: g.canvas.width, y: g.canvas.height }),
      vx0 = Math.max(0, Math.floor(c0.x) - 2),
      vy0 = Math.max(0, Math.floor(c0.y) - 2),
      vx1 = Math.min(W, Math.ceil(c1.x) + 2),
      vy1 = Math.min(H, Math.ceil(c1.y) + 2);
    if (vx1 > vx0 && vy1 > vy0)
      g.drawImage(
        bg,
        vx0,
        vy0,
        vx1 - vx0,
        vy1 - vy0,
        vx0,
        vy0,
        vx1 - vx0,
        vy1 - vy0,
      );
    // pad glow, runway spotlight
    PADS.forEach(([x, y]) => {
      g.fillStyle = `rgba(159,208,255,${0.18 + Math.sin(time * 3 + x) * 0.1})`;
      g.beginPath();
      g.ellipse(x, y, 46, 29, 0, 0, 7);
      g.fill();
    });

    HSEG.forEach((s) => drawHurdle(g, s));
    drawSpotlights(g, time);
    drawPond(g, time);
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
    const items = [
      ...TREES.map((o) => ({
        x: o.x,
        y: o.y,
        d: () => GFX.drawTree(g, o.t, o.x, o.y, time, o.ph),
      })),
      ...BUSHES.map((o) => ({
        x: o.x,
        y: o.y,
        d: () => {
          GFX.shadow(g, o.x + 6, o.y + 2, 36, 9);
          GFX.blit(g, o.spr, o.x, o.y + 4);
        },
      })),
      ...ROCKS.map((o) => ({
        x: o.x,
        y: o.y,
        d: () => {
          GFX.shadow(g, o.x + 4, o.y + 2, 24, 6);
          GFX.blit(g, o.spr, o.x, o.y + 4);
        },
      })),
      ...LAMPS.map((o) => ({ x: o.x, y: o.y, d: () => drawLamp(g, o) })),
      ...BEDS.map((o) => ({
        x: o.x,
        y: o.y,
        d: () => {
          GFX.shadow(g, o.x + 6, o.y + 4, 70, 12);
          GFX.blit(g, o.spr, o.x, o.y + 6);
        },
      })),
      ...BENCHES.map((o) => ({
        x: o.x,
        y: o.y,
        d: () => {
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
        x: h.x,
        y: h.y,
        d: () => drawHouse(g, h, night()),
      })),
      ...HENS.map((h) => ({
        x: h.x,
        y: h.y,
        d: () => GFX.chicken(g, h.k, h.st, time + h.t0, h.x, h.y, 1.15, h.face),
      })),
      ...PIGEONS.map((b) => ({
        x: b.x,
        y: b.y,
        d: () => {
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
      })),
      ...(low
        ? []
        : [
            {
              y: PET.y,
              d: () => {
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
            },
          ]),
      ...FLOOD.map((o) => ({
        x: o.x,
        y: o.y,
        d: () => drawFlood(g, o, night()),
      })),
      { y: FOUNT.y, d: () => drawFountain(g, time) },
      { y: LED.y1, d: () => drawLED(g, time) },
      { y: PITCH.y0 - 40, d: () => drawScoreboard(g) },
      {
        y: (PITCH.gy0 + PITCH.gy1) / 2,
        d: () => {
          drawGoal(g, PITCH.x0, true);
          drawGoal(g, PITCH.x1, false);
        },
      },
      { y: TRACK.cy - TRACK.ri[1], d: () => drawGantry(g) },
      { y: LEADER.y, d: () => drawLeader(g) },
      { y: PHOTO.y, d: () => drawPhoto(g, time) },
      { y: CAFE.y, d: () => drawCafe(g) },
      { y: BOARD.y, d: () => drawBoard(g) },
      { y: GATE.y, d: () => drawGate(g) },
      { y: ball.y, d: () => drawBall(g) },
      ...ev.orbs.map((o) => ({
        y: o.y,
        d: () => {
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
      })),
      ...BODIES().map((b) => ({
        x: b.x,
        y: b.y,
        d: () => drawBody(g, b, time, photo),
      })),
    ];
    // Things stand on their y and reach up to ~340 px (houses, floodlights).
    items
      .filter(
        (i) =>
          i.y > vy0 - 40 &&
          i.y < vy1 + 340 &&
          (i.x == null || (i.x > vx0 - 260 && i.x < vx1 + 260)),
      )
      .sort((a, b) => a.y - b.y)
      .forEach((i) => i.d());
    BUTTER.forEach((b) => GFX.butterfly(g, time + b.ph, b.x, b.y, b.c, 1.3));
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
        if (f.leaf)
          textWithIcon(g, f.text, "leaf", f.x, f.y - k * 50 - 8, 24, true);
        else {
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
    // day / night grading and lights
    const n = night();
    if (n > 0) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "multiply";
      g.fillStyle = `rgba(${Math.round(255 - 170 * n)},${Math.round(255 - 150 * n)},${Math.round(255 - 70 * n)},1)`;
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
      g.restore();
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
        glow(l.x, l.y - 78, 90, "255,214,140", 0.55 * n);
        glow(l.x, l.y, 120, "255,200,120", 0.18 * n);
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
      // string lights between square lamps
      g.save();
      for (let i = 0; i < 8; i++) {
        const a = LAMPS[i],
          b = LAMPS[(i + 1) % 8];
        g.strokeStyle = "rgba(40,30,20,.6)";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(a.x, a.y - 74);
        g.quadraticCurveTo(
          (a.x + b.x) / 2,
          (a.y + b.y) / 2 - 30,
          b.x,
          b.y - 74,
        );
        g.stroke();
        for (let k = 1; k < 8; k++) {
          const t = k / 8,
            x =
              (1 - t) ** 2 * a.x +
              (2 * (1 - t) * t * (a.x + b.x)) / 2 +
              t * t * b.x,
            y =
              (1 - t) ** 2 * (a.y - 74) +
              2 * (1 - t) * t * ((a.y + b.y) / 2 - 30) +
              t * t * (b.y - 74);
          g.fillStyle = ["#ffd65b", "#ff8fb8", "#7fe7ff", "#b6f36b"][
            (k + i) % 4
          ];
          g.globalAlpha = 0.4 + 0.6 * n;
          g.beginPath();
          g.arc(x, y, 3.2, 0, 7);
          g.fill();
        }
      }
      g.restore();
    } else {
      // daytime: string lights unlit, butterflies
      for (let i = 0; i < 8; i++) {
        const a = LAMPS[i],
          b = LAMPS[(i + 1) % 8];
        g.strokeStyle = "rgba(40,30,20,.45)";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(a.x, a.y - 74);
        g.quadraticCurveTo(
          (a.x + b.x) / 2,
          (a.y + b.y) / 2 - 30,
          b.x,
          b.y - 74,
        );
        g.stroke();
      }
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
  function drawMini() {
    const w = mcv.width,
      h = mcv.height,
      s = w / W;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.drawImage(bg, 0, 0, w, h);
    mctx.fillStyle = "rgba(11,16,32,.25)";
    mctx.fillRect(0, 0, w, h);
    mctx.setTransform(s, 0, 0, s, 0, 0);
    const icon = (x, y, t) => {
      const im = ICON_IMG(t);
      if (im?.complete) mctx.drawImage(im, x - 70, y - 70, 140, 140);
    };
    icon(SQ.x, SQ.y - 30, "fountain");
    icon((LED.x0 + LED.x1) / 2, LED.y1 + 30, "star");
    icon((PITCH.x0 + PITCH.x1) / 2, SQ.y, "ball");
    icon(TRACK.cx, TRACK.cy, "flag");
    icon(GATE.x, GATE.y - 30, "wheat");
    icon(PHOTO.x, PHOTO.y - 60, "camera");
    icon(CAFE.x, CAFE.y - 60, "boba");
    others.forEach((n) => {
      mctx.fillStyle = "#fff";
      mctx.beginPath();
      mctx.arc(n.x, n.y, 20, 0, 7);
      mctx.fill();
    });
    mctx.fillStyle = "#c8a3ff";
    mctx.beginPath();
    mctx.arc(ball.x, ball.y, 18, 0, 7);
    mctx.fill();
    mctx.fillStyle = "#ffd65b";
    mctx.strokeStyle = "#0b1020";
    mctx.lineWidth = 12;
    mctx.beginPath();
    mctx.arc(P.x, P.y, 38, 0, 7);
    mctx.fill();
    mctx.stroke();
    mctx.strokeStyle = "rgba(255,255,255,.85)";
    mctx.lineWidth = 8;
    mctx.strokeRect(cam.x - NW / 2 / Z, cam.y - NH / 2 / Z, NW / Z, NH / Z);
  }

  function starSkin(b) {
    return b.skin?.skin ? (options.skinName(b.skin.skin) ?? "") : "";
  }

  /* ---------- loop ---------- */
  const ZONES = [
    {
      n: "Runway",
      s: "step up to show off your skin",
      c: "#ff9bd2",
      t: (p) => inRunway(p),
    },
    {
      n: "Orb Ball Pitch",
      s: "bump to dribble · dash to shoot",
      c: "#5ab0ff",
      t: (p) => inPitch(p.x, p.y, 30),
    },
    {
      n: "Dash Track",
      s: "cross the start line to start the clock",
      c: "#ff9b6a",
      t: (p) => ell(p.x, p.y).r <= 1.08,
    },
    {
      n: "Photo Spot",
      s: "press E to take a photo",
      c: "#ffffff",
      t: (p) => Math.hypot(p.x - PHOTO.x, (p.y - PHOTO.y) * 1.4) < 150,
    },
    {
      n: "Volt Boba",
      s: "a drink that makes you faster",
      c: "#ffd84a",
      t: (p) => Math.hypot(p.x - CAFE.x, (p.y - CAFE.y - 30) * 1.3) < 170,
    },
    {
      n: "Farm Gate",
      s: "press E to enter",
      c: "#7cc95a",
      t: (p) => p.y > GATE.y - 200 && Math.abs(p.x - GATE.x) < 240,
    },
    {
      n: "Fountain Square",
      s: "hop on a bounce pad",
      c: "#ffd65b",
      t: (p) => inSquare(p.x, p.y, 1.05),
    },
    { n: "Elemental Plaza", s: "take a stroll", c: "#a0afc8", t: () => true },
  ];
  const DASH_EVERY = PLAZA.dashEvery;
  let lastDraw = 0;
  function step(now) {
    raf = requestAnimationFrame(step);
    if (low && now - lastDraw < 30) return;
    lastDraw = now;
    if (probe) {
      if (covered() || document.hidden) probe.pause();
      else {
        const verdict = probe.frame(performance.now());
        if (verdict === "low") {
          probe = undefined;
          rememberAutoLow();
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
    last = now;
    T = now / 1000;
    if (!ready) return;
    const photo = !$("pz-photo").hidden;
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
      const ev2 = plazaStep(P, dir, dt);
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
      if (srv) {
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
        b.z += (b.tz - b.z) * Math.min(1, k * 1.6);
        b.air = b.z > 1 ? 1 : 0;
        if (b.dash && Math.random() < 0.8)
          b.trail.push({ x: px, y: py, z: b.z, t: 0 });
      }
      for (const b of BODIES()) {
        if (b.emoteT > 0) b.emoteT -= dt;
        if (b.dance > 0) b.dance -= dt;
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
      if (near) {
        if (ib.dataset.id !== near.id) {
          ib.dataset.id = near.id;
          ib.innerHTML = `${I(near.icon)}<span>${near.label}${near.leaf ? L : ""}</span><kbd>E</kbd>`;
        }
        ib.hidden = false;
      } else {
        ib.hidden = true;
        ib.dataset.id = "";
      }
      const zn = ZONES.find((z) => z.t(P));
      if (zn.n !== zoneName) {
        const first = !zoneName;
        zoneName = zn.n;
        if (!first && zn.n !== "Elemental Plaza") banner(zn.n, zn.s, zn.c);
      }
      const dcd = $("pz-dash");
      dcd.classList.toggle("cd", P.dashCd > 0);
      const cd = String(
        Math.round(Math.max(0, (1 - P.dashCd / DASH_EVERY) * 100)),
      );
      if (dcd.__cd !== cd) {
        dcd.__cd = cd;
        dcd.style.setProperty("--cd", cd);
      }
      const lead = { x: P.vx * 0.25, y: P.vy * 0.2 };
      cam.x +=
        (Math.max(NW / 2 / Z, Math.min(W - NW / 2 / Z, P.x + lead.x)) - cam.x) *
        Math.min(1, dt * 5);
      cam.y +=
        (Math.max(
          NH / 2 / Z,
          Math.min(H - NH / 2 / Z + 40, P.y - 40 + lead.y),
        ) -
          cam.y) *
        Math.min(1, dt * 5);
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
    ctx.fillStyle = "#24452a";
    ctx.fillRect(0, 0, NW, NH);
    ctx.save();
    ctx.translate(NW / 2, NH / 2);
    ctx.scale(Z, Z);
    ctx.translate(-cam.x, -cam.y);
    drawWorld(ctx, T);
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
    if (Math.floor(T * 10) % 2 === 0) drawMini();
  }

  /* ---------- size, enter, leave ---------- */
  function resize() {
    syncPhone();
    const nw = Math.max(1, layer.clientWidth),
      nh = Math.max(1, layer.clientHeight),
      // Low graphics draws one pixel per CSS pixel.
      ps = low ? 1 : Math.min(2, devicePixelRatio || 1);
    NW = nw;
    NH = nh;
    PS = ps;
    Z = nw < 1000 ? 0.66 : 1;
    cv.width = Math.round(nw * ps);
    cv.height = Math.round(nh * ps);
    const r = $("pz-mini");
    mcv.width = Math.round(r.offsetWidth * ps);
    mcv.height = Math.round(r.offsetHeight * ps);
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
  setTimeout(
    () => banner("Elemental Plaza", "Everyone's playground", "#ffd65b"),
    50,
  );
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

  return {
    /** Your fighter or skin changed. */
    look(character, skin) {
      P.character = character;
      P.skin = skin ?? null;
      P.img = imageFor(character, skin ?? null);
    },
    close() {
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
      removeEventListener("pointermove", joyMove, true);
      removeEventListener("pointerup", joyEnd, true);
      removeEventListener("pointercancel", joyEnd, true);
      removeEventListener("blur", joyReset);
      removeEventListener("orientationchange", joyReset);
      document.removeEventListener("visibilitychange", onHidden);
      hideAlbum();
      album.close();
      layer.remove();
    },
    _dbg: {
      /** Where a world point is on the page (tests). */
      worldClient(x, y) {
        const r = cv.getBoundingClientRect();
        return {
          x: r.left + (((x - cam.x) * Z + NW / 2) / NW) * r.width,
          y: r.top + (((y - cam.y) * Z + NH / 2) / NH) * r.height,
        };
      },
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
      SPOTS,
      /** The photo album's store (tests fill it). */
      album,
    },
  };
}
