import Phaser from "phaser";
import type { Socket } from "socket.io-client";
import { CHARACTERS, type CharacterId, type Reply } from "@arena/shared";
import {
  TOWN,
  TOWN_EMOTES,
  TOWN_SPOTS,
  townHop,
  townStep,
  type TownEmote,
  type TownSpot,
  type TownProfile,
  type TownState,
} from "../../../packages/shared/src/town";
import { FighterRig } from "./animation/rig";
import { rigAssets, skinSuffix } from "./animation/assets";
import type { SkinLook } from "./creature-design";
import { drawCollectionAura } from "./skins/collection-fx";
import { actionFor, controlPrefs } from "./controls";
import { menuIcon } from "./menu-icons";
import { titleTreatment } from "./player-nameplate";
import { SHADE, TownScenery } from "./town-life";
import { SUN, TEXT_RES } from "./town-art";

/**
 * Elemental Plaza, the client: a separate Phaser game in a fullscreen layer.
 * You move instantly (the same step the server runs) and are gently pulled
 * back if the server disagrees; everyone else glides between updates.
 */
export interface TownOptions {
  socket: Socket;
  character: CharacterId;
  request: (event: string, data?: unknown) => Promise<Reply>;
  reduced: boolean;
  /** Walked into a portal and pressed enter (the town stays open behind it). */
  onPortal: (spot: TownSpot) => void;
  /** A button on the town's action bar. */
  onAction: (action: TownAction) => void;
  /** Called after the town has closed (`failed`: the server refused the join). */
  onClose: (failed: boolean) => void;
}
export type TownAction =
  "play" | "fighters" | "wardrobe" | "friends" | "adventure" | "raids";
const ACTIONS: [TownAction, string, string][] = [
  ["fighters", "Fighters", "user"],
  ["wardrobe", "Wardrobe", "wardrobe"],
  ["raids", "Raids", "bestiary"],
  ["adventure", "Journey", "sparkle"],
  ["friends", "Friends", "friends"],
];
const EMOTE_ICON: Record<TownEmote, string> = {
  wave: "👋",
  heart: "❤️",
  laugh: "😂",
  gg: "GG",
  fire: "🔥",
};
const RIG_SCALE = 0.62;
/** Rig pixels from the body pivot to the feet (see FighterRig). */
const FEET = 21;

interface Body {
  id: number;
  x: number;
  y: number;
  /** Latest server position (others glide toward it). */
  tx: number;
  ty: number;
  angle: number;
  moving: boolean;
  emote: number;
  seen: number;
  /** When the current hop started (scene time, ms). */
  jumpAt?: number;
  jumping?: boolean;
  rig?: FighterRig;
  rigFor?: string;
  rigVersion?: number;
  /** Keep the last complete outfit until the next skin's textures are ready. */
  worn?: TownProfile;
  aura: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  /** How the title is drawn (the same treatments as the arena nameplate). */
  titleFx?: {
    kind: ReturnType<typeof titleTreatment>;
    color: string;
    text: string;
    step: number;
  };
  bubble?: Phaser.GameObjects.Container;
}

/** Room around title text for its glow, so the blur isn't clipped. */
const TITLE_PAD = { x: 12, y: 7 };
/** Clear space between the title lettering and the player name below it. */
const TITLE_GAP = 2;
/**
 * Draw a title the way the arena nameplate does (see .player-title in
 * style.css): every title glows in its colour, Master titles pulse slowly,
 * Grandmaster ones faster, and Legendary titles are gold with a moving
 * shimmer between two sparkles. `t` is seconds; animated looks step about
 * 12 times a second so the text isn't redrawn every frame.
 */
function styleTitle(
  text: Phaser.GameObjects.Text,
  fx: NonNullable<Body["titleFx"]>,
  t: number,
  still: boolean,
) {
  const pulse = (period: number) =>
    still ? 0 : (1 - Math.cos((t / period) * Math.PI * 2)) / 2;
  if (fx.kind === "legendary") {
    const shift = still ? 0.5 : (t / 2.4) % 1;
    const w = Math.max(1, text.width);
    const g = text.context.createLinearGradient(0, 0, w, 0);
    // A band of light sliding across gold, like the arena's shimmer.
    const stops: [number, string][] = [
      [0, "#c38a15"],
      [0.2, "#ffdf75"],
      [0.5, "#ffcc39"],
      [0.8, "#ffe995"],
      [1, "#b97807"],
    ];
    for (const [o, c] of stops) g.addColorStop(o, c);
    const at = 0.1 + shift * 0.8;
    g.addColorStop(Math.max(0, at - 0.08), "rgba(255,226,120,1)");
    g.addColorStop(at, "#fff4b0");
    g.addColorStop(Math.min(1, at + 0.08), "rgba(255,210,80,1)");
    text.setFill(g as unknown as string);
    text.setShadow(0, 0, "#ffcc39", 5 + pulse(2) * 5, true, false);
    return;
  }
  const blur =
    fx.kind === "grandmaster"
      ? 5 + pulse(1.8) * 7
      : fx.kind === "master"
        ? 5 + pulse(2.6) * 5
        : 5;
  text.setFill(fx.color);
  // A tight glow around the dark outline: visible on light stone, letters stay crisp.
  text.setShadow(0, 0, fx.color, blur, true, false);
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Zoom steps: buttons and keys, and one wheel notch. */
const ZOOM_STEP = 1.25,
  WHEEL_STEP = 1.1,
  /** How far in from the screen's natural view; zooming out goes until the town fills the screen. */
  ZOOM_MAX = 2;
/** The player's zoom, relative to the natural view; kept between visits. */
let userZoom = (() => {
  try {
    const v = Number(localStorage.getItem("town-zoom"));
    return v > 0.05 && v <= ZOOM_MAX ? v : 1;
  } catch {
    return 1;
  }
})();

export function openTown(options: TownOptions) {
  const { socket, request } = options;
  const layer = document.createElement("div");
  layer.className = "town-layer";
  layer.innerHTML = `<div class="town-canvas" id="town-canvas"></div>
<div class="town-light" aria-hidden="true"></div>
<header class="town-hud">
  <div class="town-place"><b>Elemental Plaza</b><small id="town-pop">Joining…</small></div>
</header>
<nav class="town-actions" aria-label="Main menu" data-open="false">
  <button type="button" class="town-menu-toggle" id="town-menu-toggle" aria-expanded="false" aria-controls="town-menu-items" title="Menu (M)"><span class="town-burger" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span></button>
  <div class="town-menu-items" id="town-menu-items" inert>
    <button type="button" class="town-play primary btn-primary" data-action="play" style="--i:0">${menuIcon("battle")}<span>Play</span></button>${ACTIONS.map(
      ([id, label, icon], i) =>
        `<button type="button" data-action="${id}" title="${label}" style="--i:${i + 1}">${menuIcon(icon as Parameters<typeof menuIcon>[0])}<span>${label}</span></button>`,
    ).join("")}
  </div>
</nav>
<div class="town-prompt" id="town-prompt" hidden></div>
<div class="town-emotes" role="group" aria-label="Emotes">${TOWN_EMOTES.map(
    (e) =>
      `<button type="button" data-emote="${e}" aria-label="${e}" title="${e}">${EMOTE_ICON[e]}</button>`,
  ).join("")}</div>
<div class="town-stick" id="town-stick" aria-hidden="true"><span></span></div>
<div class="town-zoom" role="group" aria-label="Zoom">
  <button type="button" id="town-zoom-in" aria-label="Zoom in" title="Zoom in (+)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
  <button type="button" id="town-zoom-out" aria-label="Zoom out" title="Zoom out (−)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
</div>
<button type="button" class="town-zoom-reset" id="town-zoom-reset" aria-label="Reset zoom" title="Reset zoom (0)" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg></button>`;
  document.body.append(layer);
  document.body.classList.add("town-active");
  const $ = <T extends HTMLElement>(id: string) =>
    layer.querySelector<T>(`#${id}`)!;

  const profiles = new Map<number, TownProfile>();
  const bodies = new Map<number, Body>();
  const arrived = new Set<number>();
  let ambient = new Set<number>();
  let me = 0,
    closed = false,
    scene: TownScene | undefined;
  const held = new Set<string>();
  let stick = { x: 0, y: 0 };
  let sent = { x: 0, y: 0 },
    sentAt = 0;
  let nearPortal: TownSpot | undefined;

  // --- Input -------------------------------------------------------------
  const stickInput = () => {
    if (stick.x || stick.y) return stick;
    const bindings = controlPrefs().bindings;
    let x = 0,
      y = 0;
    for (const code of held) {
      const action = actionFor(bindings, code);
      if (action === "left") x -= 1;
      else if (action === "right") x += 1;
      else if (action === "up") y -= 1;
      else if (action === "down") y += 1;
    }
    const len = Math.hypot(x, y);
    return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  };
  const typing = () =>
    ["INPUT", "TEXTAREA", "SELECT"].includes(
      document.activeElement?.tagName ?? "",
    );
  /** A panel or dialog is open over the town: it gets the keys, you stand still. */
  const covered = () =>
    !!document.querySelector(
      "dialog[open], .home-drawer:not([hidden]), .header-menu[open]",
    );
  const keydown = (e: KeyboardEvent) => {
    if (typing() || covered()) return;
    if (
      e.code === "KeyM" ||
      (e.code === "Escape" && menu.dataset.open === "true")
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return void setMenu(e.code === "KeyM" && menu.dataset.open !== "true");
    }
    if ((e.code === "KeyE" || e.code === "Enter") && nearPortal) {
      e.preventDefault();
      held.clear();
      return void options.onPortal(nearPortal);
    }
    if (!e.ctrlKey && !e.metaKey && e.key === "0") {
      e.preventDefault();
      e.stopImmediatePropagation();
      return void scene?.resetZoom();
    }
    if (!e.ctrlKey && !e.metaKey && ["+", "=", "-", "_"].includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return void scene?.zoomBy(
        e.key === "+" || e.key === "=" ? ZOOM_STEP : 1 / ZOOM_STEP,
      );
    }
    const digit = Number(e.key);
    if (digit >= 1 && digit <= TOWN_EMOTES.length)
      void emote(TOWN_EMOTES[digit - 1]);
    const action = actionFor(controlPrefs().bindings, e.code);
    if (action === "jump") {
      e.preventDefault();
      if (!e.repeat) jump();
    } else if (action) {
      held.add(e.code);
      e.preventDefault();
    }
    // The arena's own key handlers must not see town movement.
    e.stopImmediatePropagation();
  };
  const keyup = (e: KeyboardEvent) => {
    held.delete(e.code);
    e.stopImmediatePropagation();
  };
  const blur = () => held.clear();
  window.addEventListener("keydown", keydown, true);
  window.addEventListener("keyup", keyup, true);
  window.addEventListener("blur", blur);

  // Touch stick: appears where the thumb lands on the left half.
  const stickEl = $("town-stick"),
    knob = stickEl.querySelector("span")!;
  let stickPointer = -1,
    origin = { x: 0, y: 0 };
  const canvasEl = $("town-canvas");
  canvasEl.addEventListener("pointerdown", (e) => {
    if (menu.dataset.open === "true") setMenu(false);
    if (e.pointerType === "mouse" || stickPointer >= 0) return;
    stickPointer = e.pointerId;
    origin = { x: e.clientX, y: e.clientY };
    stickEl.style.left = `${e.clientX}px`;
    stickEl.style.top = `${e.clientY}px`;
    stickEl.classList.add("on");
    canvasEl.setPointerCapture(e.pointerId);
  });
  canvasEl.addEventListener("pointermove", (e) => {
    if (e.pointerId !== stickPointer) return;
    const dx = e.clientX - origin.x,
      dy = e.clientY - origin.y,
      len = Math.hypot(dx, dy),
      k = Math.min(1, len / 48);
    knob.style.transform = `translate(${len ? (dx / len) * k * 40 : 0}px, ${len ? (dy / len) * k * 40 : 0}px)`;
    // Quantise to 16 directions so a wobbling thumb does not flood the server.
    if (len < 12) stick = { x: 0, y: 0 };
    else {
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) * (Math.PI / 8);
      stick = { x: Math.cos(a), y: Math.sin(a) };
    }
  });
  const stickEnd = (e: PointerEvent) => {
    if (e.pointerId !== stickPointer) return;
    stickPointer = -1;
    stick = { x: 0, y: 0 };
    knob.style.transform = "";
    stickEl.classList.remove("on");
  };
  canvasEl.addEventListener("pointerup", stickEnd);
  canvasEl.addEventListener("pointercancel", stickEnd);
  // Desktop: click a spot to walk there.
  let walkTo: { x: number; y: number } | undefined;
  let clickMark: { x: number; y: number; at: number } | undefined;
  canvasEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || !scene) return;
    const cam = scene.cameras.main,
      rect = canvasEl.getBoundingClientRect(),
      p = cam.getWorldPoint(
        (e.clientX - rect.left) * devicePixelRatio,
        (e.clientY - rect.top) * devicePixelRatio,
      );
    walkTo = { x: p.x, y: p.y };
    // Where you clicked: a marker on the ground (see drawClickMark).
    clickMark = { x: p.x, y: p.y, at: scene.time.now };
  });

  const sendInput = (now: number, dir: { x: number; y: number }) => {
    const changed =
      Math.abs(dir.x - sent.x) > 0.01 || Math.abs(dir.y - sent.y) > 0.01;
    // On change (at most 20 a second), plus a slow keep-alive while walking.
    if (
      (changed && now - sentAt > 50) ||
      ((dir.x || dir.y) && now - sentAt > 1000)
    ) {
      sent = { ...dir };
      sentAt = now;
      socket.emit("town-input", {
        dx: Math.round(dir.x * 100) / 100,
        dy: Math.round(dir.y * 100) / 100,
      });
    }
  };
  // Hop: shown at once for you, and sent so everyone nearby sees it.
  let lastJump = -Infinity;
  const jump = () => {
    const mine = bodies.get(me);
    if (!scene || !mine) return;
    const now = scene.time.now;
    if (now - lastJump < TOWN.jumpEveryMs) return;
    lastJump = now;
    mine.jumpAt = now;
    socket.emit("town-jump", {});
  };
  const emote = async (kind: TownEmote) => {
    const button = layer.querySelector<HTMLButtonElement>(
      `[data-emote="${kind}"]`,
    );
    button?.classList.add("pressed");
    setTimeout(() => button?.classList.remove("pressed"), 300);
    socket.timeout(3000).emit("town-emote", { emote: kind }, () => undefined);
  };
  layer.querySelectorAll<HTMLButtonElement>("[data-emote]").forEach((b) => {
    b.onclick = () => void emote(b.dataset.emote as TownEmote);
  });
  // Zoom: the + / − buttons (top right, under the settings button), the
  // mouse wheel and the + / − keys all step the same zoom.
  const zoomIn = $<HTMLButtonElement>("town-zoom-in"),
    zoomOut = $<HTMLButtonElement>("town-zoom-out");
  zoomIn.onclick = () => scene?.zoomBy(ZOOM_STEP);
  zoomOut.onclick = () => scene?.zoomBy(1 / ZOOM_STEP);
  const zoomReset = $<HTMLButtonElement>("town-zoom-reset");
  zoomReset.onclick = () => scene?.resetZoom();
  const syncZoomButtons = (
    atMin: boolean,
    atMax: boolean,
    isDefault: boolean,
  ) => {
    zoomIn.disabled = atMax;
    zoomOut.disabled = atMin;
    // Reset shows only once the view has been zoomed away from the default.
    zoomReset.hidden = isDefault;
  };
  // The menu button folds the actions away; tapping it fans them out.
  const menu = layer.querySelector<HTMLElement>(".town-actions")!,
    menuToggle = $("town-menu-toggle"),
    menuItems = $("town-menu-items");
  const setMenu = (open: boolean) => {
    menu.dataset.open = String(open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuItems.inert = !open;
  };
  menuToggle.onclick = () => setMenu(menu.dataset.open !== "true");
  layer.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((b) => {
    b.onclick = () => {
      held.clear();
      setMenu(false);
      options.onAction(b.dataset.action as TownAction);
    };
  });
  const prompt = $("town-prompt");
  prompt.onclick = () => nearPortal && options.onPortal(nearPortal);

  // --- Server --------------------------------------------------------------
  const onState = (s: TownState) => {
    me = s.me;
    $("town-pop").textContent =
      `Town ${s.town} · ${s.population} ${s.population === 1 ? "player" : "players"} here`;
    const now = performance.now();
    for (const [id, x, y, angle, moving, emoteIndex, jumping] of s.walkers) {
      let body = bodies.get(id);
      if (!body) {
        if (!scene) continue;
        body = scene.addBody(id, x, y);
        // Registered before dressing: the rig callback checks the body is still ours.
        bodies.set(id, body);
        scene.dressBody(body);
      }
      body.tx = x;
      body.ty = y;
      body.seen = now;
      if (id !== me) {
        body.angle = angle;
        body.moving = !!moving;
        // Someone else started a hop.
        if (jumping && !body.jumping && scene) body.jumpAt = scene.time.now;
      }
      body.jumping = !!jumping;
      if (emoteIndex !== body.emote) {
        body.emote = emoteIndex;
        scene?.showEmote(body);
      }
    }
    // Reserve elaborate skin ambience for you and the three nearest visitors.
    // Everyone still wears their full skin, colours and equipped aura.
    const mine = bodies.get(me);
    ambient = new Set(
      [...bodies.values()]
        .sort(
          (a, b) =>
            Number(b.id === me) - Number(a.id === me) ||
            Math.hypot(a.tx - (mine?.tx ?? 0), a.ty - (mine?.ty ?? 0)) -
              Math.hypot(b.tx - (mine?.tx ?? 0), b.ty - (mine?.ty ?? 0)),
        )
        .slice(0, 4)
        .map((body) => body.id),
    );
    // Gone out of view, or left.
    for (const [id, body] of bodies)
      if (body.seen !== now) {
        scene?.removeBody(body);
        bodies.delete(id);
      }
  };
  const onProfiles = (list: TownProfile[]) => {
    for (const p of list) {
      profiles.set(p.id, p);
      const body = bodies.get(p.id);
      if (body) scene?.dressBody(body);
    }
  };
  const onClosed = () => close();
  const onDisconnect = () => close();
  socket.on("town-state", onState);
  socket.on("town-profiles", onProfiles);
  socket.on("town-closed", onClosed);
  socket.on("disconnect", onDisconnect);

  // --- Scene ---------------------------------------------------------------
  class TownScene extends Phaser.Scene {
    private scenery!: TownScenery;
    private loading = new Set<string>();
    private zoomBase = 1;
    /** The camera's zoom right now, in CSS pixels per world pixel (labels scale against it). */
    private zoomNow = 1;
    private following?: Body;
    private clickG?: Phaser.GameObjects.Graphics;
    /**
     * The click-to-move marker: a ring that pops out where you clicked and
     * fades, four arrows that close in on the spot, and a small dot that
     * stays until you arrive (or set off somewhere else).
     */
    private drawClickMark(time: number) {
      const g = (this.clickG ??= this.add.graphics().setDepth(-300)).clear();
      if (!clickMark) return;
      const age = (time - clickMark.at) / 1000,
        { x, y } = clickMark,
        gold = 0xffd65b;
      const LIFE = 0.6;
      if (age < LIFE) {
        const t = age / LIFE,
          ease = 1 - (1 - t) ** 3,
          r = 12 + ease * 34;
        g.lineStyle(3, gold, 1 - t).strokeEllipse(x, y, r * 2, r * 2 * 0.55);
        g.lineStyle(2, 0xffffff, (1 - t) * 0.8).strokeEllipse(
          x,
          y,
          r * 1.3,
          r * 1.3 * 0.55,
        );
        if (!options.reduced)
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + Math.PI / 4,
              d = 46 - ease * 26,
              cx = x + Math.cos(a) * d,
              cy = y + Math.sin(a) * d * 0.55,
              ux = -Math.cos(a),
              uy = -Math.sin(a) * 0.55,
              px = -uy,
              py = ux;
            g.fillStyle(0x000000, (1 - t) * 0.35).fillTriangle(
              cx + ux * 11,
              cy + uy * 11 + 2,
              cx + px * 8,
              cy + py * 8 + 2,
              cx - px * 8,
              cy - py * 8 + 2,
            );
            g.fillStyle(gold, 1 - t).fillTriangle(
              cx + ux * 11,
              cy + uy * 11,
              cx + px * 8,
              cy + py * 8,
              cx - px * 8,
              cy - py * 8,
            );
          }
      }
      // While still walking there: a soft dot that gently pulses.
      if (walkTo && Math.hypot(walkTo.x - x, walkTo.y - y) < 1) {
        const pulse = options.reduced ? 0 : (Math.sin(time / 160) + 1) / 2;
        g.fillStyle(0x000000, 0.25).fillEllipse(x, y + 2, 26, 13);
        g.lineStyle(2.5, gold, 0.9).strokeEllipse(
          x,
          y,
          24 + pulse * 6,
          (24 + pulse * 6) * 0.5,
        );
        g.fillStyle(gold, 0.95).fillEllipse(x, y, 9, 5);
        g.fillStyle(0xffffff, 0.8).fillEllipse(x - 1.5, y - 1, 3.5, 2);
      } else if (age >= LIFE) clickMark = undefined;
    }
    constructor() {
      super("town");
    }
    create() {
      if (closed) return;
      scene = this;
      this.scenery = new TownScenery(this, options.reduced);
      const cam = this.cameras.main;
      cam.setBackgroundColor("#2f4224");
      this.fit();
      this.scale.on("resize", () => this.fit());
      // Wheel zoom (a trackpad sends many small steps; the sign is what counts).
      this.input.on(
        "wheel",
        (_p: unknown, _o: unknown, _dx: number, dy: number) => {
          if (dy) this.zoomBy(dy < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, 90);
        },
      );
    }
    /** Show roughly 1100×650 of the world; phones see a closer, narrower slice. */
    fit() {
      const w = this.scale.width / devicePixelRatio,
        h = this.scale.height / devicePixelRatio;
      // Never zoomed out past the edge of the map.
      // Short landscape phones get a closer view so fighters stay readable.
      const view =
        h < 500 ? h / 430 : Math.min(1.5, Math.min(w / 1100, h / 650) * 1.1);
      this.zoomBase = Math.max(w / TOWN.width, h / TOWN.height, view);
      const cam = this.cameras.main;
      cam.setBounds(0, 0, TOWN.width, TOWN.height);
      this.applyZoom(0);
    }
    /**
     * Allowed zoom range for this screen: out until the whole town fills it
     * (on a 16:10 screen that's all of it; wider phones see its full width),
     * in to 2× closer than the natural view.
     */
    private zoomRange() {
      const w = this.scale.width / devicePixelRatio,
        h = this.scale.height / devicePixelRatio;
      const fill = Math.max(w / TOWN.width, h / TOWN.height);
      return {
        min: Math.min(fill, this.zoomBase),
        max: this.zoomBase * ZOOM_MAX,
      };
    }
    resetZoom() {
      userZoom = 1;
      try {
        localStorage.removeItem("town-zoom");
      } catch {
        /* Optional preference. */
      }
      this.applyZoom(220);
    }
    zoomBy(factor: number, ms = 160) {
      const { min, max } = this.zoomRange();
      const target = Math.min(
        max,
        Math.max(min, this.zoomBase * userZoom * factor),
      );
      userZoom = target / this.zoomBase;
      // Stepping back to where you started counts as the default view again.
      if (Math.abs(userZoom - 1) < 0.02) userZoom = 1;
      try {
        localStorage.setItem("town-zoom", userZoom.toFixed(3));
      } catch {
        /* Optional preference. */
      }
      this.applyZoom(ms);
    }
    private applyZoom(ms: number) {
      const { min, max } = this.zoomRange();
      const z = Math.min(max, Math.max(min, this.zoomBase * userZoom));
      this.zoomNow = z;
      const cam = this.cameras.main;
      // A plain tween (the camera's own zoom effect can stop short of its target).
      this.tweens.killTweensOf(cam);
      if (ms && !options.reduced)
        this.tweens.add({
          targets: cam,
          zoom: z * devicePixelRatio,
          duration: ms,
          ease: "Sine.easeOut",
        });
      else cam.setZoom(z * devicePixelRatio);
      syncZoomButtons(
        z <= min * 1.001,
        z >= max * 0.999,
        Math.abs(userZoom - 1) < 0.001,
      );
    }
    addBody(id: number, x: number, y: number): Body {
      const body: Body = {
        id,
        x,
        y,
        tx: x,
        ty: y,
        angle: Math.PI / 2,
        moving: false,
        emote: 0,
        seen: 0,
        aura: this.add.graphics(),
        shadow: this.add.ellipse(x, y, 46, 16, SHADE, SUN.alpha),
        name: this.add
          .text(x, y, "", {
            resolution: TEXT_RES,
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            fontStyle: "bold",
            color: "#ffffff",
            stroke: "#101318",
            strokeThickness: 4,
            align: "center",
          })
          .setOrigin(0.5, 1)
          .setDepth(5000),
        title: this.add
          .text(x, y, "", {
            resolution: TEXT_RES,
            fontFamily: "DM Sans, sans-serif",
            fontSize: "11px",
            fontStyle: "bold",
            color: "#c9d2e3",
            stroke: "#101318",
            strokeThickness: 3,
            padding: { x: TITLE_PAD.x, y: TITLE_PAD.y },
          })
          .setOrigin(0.5, 1)
          .setDepth(5000),
      };
      return body;
    }
    /** Nameplate and fighter once we know who this is. */
    dressBody(body: Body) {
      const p = profiles.get(body.id);
      if (!p) return;
      const level = p.level ? `Lv ${p.level}  ` : "";
      body.name
        .setText(`${level}${p.name}`)
        .setColor(body.id === me ? "#ffe27a" : "#ffffff");
      const color =
        p.titleColor && /^#[0-9a-f]{6}$/i.test(p.titleColor)
          ? p.titleColor
          : "#ffd65b";
      const kind = titleTreatment(p.title ?? "");
      const text = p.title
        ? kind === "legendary"
          ? `✦  ${p.title}  ✦`
          : p.title
        : "";
      if (
        !body.titleFx ||
        body.titleFx.text !== text ||
        body.titleFx.color !== color
      ) {
        body.title.setText(text);
        body.titleFx = { kind, color, text, step: -1 };
        styleTitle(body.title, body.titleFx, 0, options.reduced);
      }
      const character = (
        p.character in CHARACTERS ? p.character : "voltkit"
      ) as CharacterId;
      const skin = p.skin ?? null;
      const key = character + skinSuffix(character, skin);
      if (body.rigFor !== key) {
        body.rigFor = key;
        const version = (body.rigVersion = (body.rigVersion ?? 0) + 1);
        this.ensureRig(character, skin, () => {
          if (
            closed ||
            !this.sys.isActive() ||
            bodies.get(body.id) !== body ||
            body.rigFor !== key ||
            body.rigVersion !== version
          )
            return;
          body.rig?.destroy();
          body.rig = new FighterRig(this, character, rigAssets(character));
          body.rig.wear(skin);
          body.rig.root.setScale(RIG_SCALE, RIG_SCALE);
          body.worn = profiles.get(body.id);
        });
      } else if (
        body.rig?.character === character &&
        key === character + skinSuffix(character, body.worn?.skin)
      ) {
        body.worn = p;
      }
    }
    private ensureRig(
      id: CharacterId,
      skin: SkinLook | null,
      ready: () => void,
    ) {
      const suffix = skinSuffix(id, skin);
      const key = id + suffix;
      const base = rigAssets(id);
      const assets = suffix ? [...base, ...rigAssets(id, skin)] : base;
      const missing = assets.filter((a) => !this.textures.exists(a.key));
      if (!missing.length) return ready();
      this.load.once(`town-ready-${key}`, ready);
      if (this.loading.has(key)) return;
      this.loading.add(key);
      for (const a of missing)
        this.load.svg(a.key, a.url, { width: a.width, height: a.height });
      const done = () => {
        if (closed) {
          this.load.off("complete", done);
          return;
        }
        if (assets.some((a) => !this.textures.exists(a.key))) return;
        this.load.off("complete", done);
        this.loading.delete(key);
        this.load.emit(`town-ready-${key}`);
      };
      this.load.on("complete", done);
      if (!this.load.isLoading()) this.load.start();
    }
    removeBody(body: Body) {
      body.rig?.destroy();
      body.aura.destroy();
      body.shadow.destroy();
      body.name.destroy();
      body.title.destroy();
      body.bubble?.destroy();
    }
    showEmote(body: Body) {
      body.bubble?.destroy();
      body.bubble = undefined;
      if (!body.emote) return;
      const kind = TOWN_EMOTES[body.emote - 1];
      if (!options.reduced && (kind === "wave" || kind === "gg"))
        body.rig?.trigger(
          kind === "wave" ? "wave" : "victory",
          this.time.now,
          2200,
        );
      const text = this.add
        .text(0, -4, EMOTE_ICON[kind], {
          resolution: TEXT_RES,
          fontFamily: "DM Sans, sans-serif",
          fontSize: kind === "gg" ? "20px" : "24px",
          fontStyle: "bold",
          color: "#1c2030",
        })
        .setOrigin(0.5);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.18).fillRoundedRect(-27, -26, 56, 44, 14);
      g.fillStyle(0xffffff, 1).fillRoundedRect(-28, -28, 56, 44, 14);
      g.fillTriangle(-6, 14, 6, 14, 0, 24);
      const ui = Math.max(1, 1 / this.zoomNow);
      body.bubble = this.add
        .container(body.x, body.y, [g, text])
        .setDepth(6000)
        .setScale(ui);
      if (!options.reduced) {
        body.bubble.setScale(0.3 * ui);
        this.tweens.add({
          targets: body.bubble,
          scale: ui,
          duration: 260,
          ease: "Back.Out",
        });
      }
    }
    update(time: number, delta: number) {
      const dt = Math.min(0.1, delta / 1000);
      this.scenery.update(time, dt, bodies.get(me));
      this.drawClickMark(time);
      const mine = bodies.get(me);
      // Your input: keys, stick or a clicked spot.
      let dir = stickInput();
      if (covered()) {
        held.clear();
        walkTo = undefined;
        dir = { x: 0, y: 0 };
      }
      if (dir.x || dir.y) walkTo = undefined;
      else if (walkTo && mine) {
        const dx = walkTo.x - mine.x,
          dy = walkTo.y - mine.y,
          len = Math.hypot(dx, dy);
        if (len < 8) walkTo = undefined;
        else dir = { x: dx / len, y: dy / len };
      }
      sendInput(time, dir);
      for (const body of bodies.values()) {
        if (body === mine) {
          const step = townStep(body, dir.x, dir.y, dt);
          // A clicked spot inside a wall: stop instead of pushing forever.
          if (walkTo && !step.moving) walkTo = undefined;
          body.x = step.x;
          body.y = step.y;
          body.moving = step.moving;
          if (step.moving) body.angle = Math.atan2(dir.y, dir.x);
          // Server correction: small drift fades out, large jumps snap.
          const ex = body.tx - body.x,
            ey = body.ty - body.y,
            err = Math.hypot(ex, ey);
          if (err > 160) {
            body.x = body.tx;
            body.y = body.ty;
          } else if (err > (body.moving ? 48 : 2)) {
            const k = 1 - Math.exp(-dt / (body.moving ? 0.3 : 0.15));
            body.x += ex * k;
            body.y += ey * k;
          }
        } else {
          const k = 1 - Math.exp(-dt / 0.09);
          body.x += (body.tx - body.x) * k;
          body.y += (body.ty - body.y) * k;
        }
        this.place(body, time);
      }
      if (mine) {
        if (this.following !== mine) {
          this.following = mine;
          this.cameras.main.startFollow(mine.shadow, true, 0.12, 0.12);
        }
        // The nearest place you can use.
        const near = TOWN_SPOTS.filter(
          (p) => Math.hypot(p.x - mine.x, p.y + 10 - mine.y) < p.reach,
        ).sort(
          (a, b) =>
            Math.hypot(a.x - mine.x, a.y - mine.y) -
            Math.hypot(b.x - mine.x, b.y - mine.y),
        )[0];
        if (near !== nearPortal) {
          nearPortal = near;
          this.scenery.active = near;
          prompt.hidden = !near;
          if (near)
            prompt.innerHTML = `<b style="color:${near.color}">${esc(near.label)}</b><span>${esc(near.sub)} · ${
              matchMedia("(pointer: coarse)").matches ? "Tap" : "Press E"
            }</span>`;
        }
      }
    }
    private place(body: Body, now: number) {
      const lift = body.jumpAt === undefined ? 0 : townHop(now - body.jumpAt);
      // The shadow stays on the ground and shrinks as you rise.
      body.shadow
        .setPosition(body.x, body.y)
        .setDepth(body.y - 0.5)
        .setScale(1 - lift / 120);
      const p = body.worn;
      const auraScale = RIG_SCALE / 1.2;
      body.aura
        .clear()
        .setPosition(body.x, body.y)
        .setScale(auraScale)
        .setDepth(body.y - 0.2);
      if (p?.look?.aura === "mountain-aura")
        body.aura.lineStyle(3, 0xffd28c, 0.7).strokeEllipse(0, 0, 95, 45);
      else if (p?.look?.aura)
        drawCollectionAura(body.aura, p.look.aura, 0, 0, now, options.reduced);
      if (body.rig) {
        if (p?.look !== undefined && !arrived.has(body.id)) {
          arrived.add(body.id);
          if (!options.reduced && !body.moving)
            body.rig.trigger("wave", now, 1800);
        }
        const character = body.rig.character;
        body.rig.root.setScale(RIG_SCALE, RIG_SCALE);
        body.rig.setDepth(body.y);
        body.rig.render(
          {
            hp: 1,
            speed: body.moving ? CHARACTERS[character].speed : 0,
            angle: body.angle,
            dash: false,
            jump: lift > 0,
            skin: p?.skin ?? null,
            look: p?.look ?? {},
            ambient: ambient.has(body.id),
          },
          body.x,
          body.y - FEET * RIG_SCALE - lift,
          now,
          1,
          options.reduced,
        );
      }
      const head = Math.min(
        body.y - 60 - lift,
        body.rig ? body.rig.root.y - 47 : Infinity,
      );
      const ui = Math.max(1, 1 / this.zoomNow);
      // Zoomed far out the town reads as a map: names and titles fade away,
      // and come back as you zoom in.
      const labels = Math.min(
        1,
        Math.max(0, (this.zoomNow / this.zoomBase - 0.45) / 0.15),
      );
      body.name.setAlpha(labels).setVisible(labels > 0);
      body.title.setAlpha(labels).setVisible(labels > 0);
      body.name.setScale(ui).setPosition(body.x, head);
      body.title.setScale(ui);
      // Measure from the lettering, keeping the glow padding out of the gap.
      body.title.setPosition(
        body.x,
        head - (body.name.height + TITLE_GAP - TITLE_PAD.y) * ui,
      );
      const fx = body.titleFx;
      if (
        fx &&
        fx.text &&
        fx.kind !== "glow" &&
        !options.reduced &&
        labels > 0
      ) {
        const step = Math.floor(now / 80);
        if (step !== fx.step) {
          fx.step = step;
          styleTitle(body.title, fx, now / 1000, false);
        }
      }
      const top = body.title.text
        ? body.title.y - body.title.height * ui
        : head - body.name.height * ui;
      body.bubble?.setPosition(body.x, top - 28);
    }
  }

  const host = $("town-canvas");
  const dpr = devicePixelRatio || 1;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    backgroundColor: "#2f4224",
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(host.clientWidth * dpr),
      height: Math.round(host.clientHeight * dpr),
      zoom: 1 / dpr,
    },
    render: { antialias: true },
    scene: [TownScene],
  });
  const resize = () =>
    game.scale.resize(
      Math.round(host.clientWidth * dpr),
      Math.round(host.clientHeight * dpr),
    );
  window.addEventListener("resize", resize);

  void request("town-join", { character: options.character }).then((reply) => {
    if (!reply.ok) close(true);
    else if (reply.me) me = reply.me;
  });

  function close(failed = false) {
    if (closed) return;
    closed = true;
    socket.off("town-state", onState);
    socket.off("town-profiles", onProfiles);
    socket.off("town-closed", onClosed);
    socket.off("disconnect", onDisconnect);
    if (socket.connected) socket.emit("town-leave", {}, () => undefined);
    window.removeEventListener("keydown", keydown, true);
    window.removeEventListener("keyup", keyup, true);
    window.removeEventListener("blur", blur);
    window.removeEventListener("resize", resize);
    profiles.clear();
    bodies.clear();
    arrived.clear();
    game.destroy(true);
    if (game.isRunning && !game.loop.running) game.loop.wake();
    layer.remove();
    document.body.classList.remove("town-active");
    options.onClose(failed);
  }
  let character = options.character;
  return {
    close,
    /** Switched fighter or equipped a skin: everyone sees the new look. */
    look(next: CharacterId) {
      character = next;
      if (!closed)
        socket.timeout(3000).emit("town-look", { character }, () => undefined);
    },
  };
}
