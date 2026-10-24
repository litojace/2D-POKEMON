import Phaser from "phaser";
import type { Socket } from "socket.io-client";
import { CHARACTERS, type CharacterId, type Reply } from "@arena/shared";
import {
  TOWN,
  TOWN_EMOTES,
  TOWN_SPOTS,
  townStep,
  type TownEmote,
  type TownSpot,
  type TownProfile,
  type TownState,
} from "../../../packages/shared/src/town";
import { FighterRig } from "./animation/rig";
import { rigAssets } from "./animation/assets";
import { actionFor, controlPrefs } from "./controls";
import { menuIcon } from "./menu-icons";
import { TownScenery } from "./town-life";
import { TEXT_RES } from "./town-art";

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
export type TownAction = "play" | "fighters" | "wardrobe" | "friends" | "adventure" | "raids";
const ACTIONS: [TownAction, string, string][] = [
  ["fighters", "Fighters", "user"],
  ["wardrobe", "Wardrobe", "wardrobe"],
  ["raids", "Raids", "bestiary"],
  ["adventure", "Journey", "sparkle"],
  ["friends", "Friends", "friends"],
];
const EMOTE_ICON: Record<TownEmote, string> = { wave: "👋", heart: "❤️", laugh: "😂", gg: "GG", fire: "🔥" };
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
  rig?: FighterRig;
  rigFor?: string;
  shadow: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  bubble?: Phaser.GameObjects.Container;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function openTown(options: TownOptions) {
  const { socket, request } = options;
  const layer = document.createElement("div");
  layer.className = "town-layer";
  layer.innerHTML = `<div class="town-canvas" id="town-canvas"></div>
<header class="town-hud">
  <div class="town-place"><b>Elemental Plaza</b><small id="town-pop">Joining…</small></div>
</header>
<nav class="town-actions" aria-label="Main menu">${ACTIONS.map(
    ([id, label, icon]) => `<button type="button" data-action="${id}" title="${label}">${menuIcon(icon as Parameters<typeof menuIcon>[0])}<span>${label}</span></button>`,
  ).join("")}<button type="button" class="town-play primary btn-primary" data-action="play">${menuIcon("battle")}<span>Play</span></button></nav>
<div class="town-prompt" id="town-prompt" hidden></div>
<div class="town-emotes" role="group" aria-label="Emotes">${TOWN_EMOTES.map(
    (e) => `<button type="button" data-emote="${e}" aria-label="${e}" title="${e}">${EMOTE_ICON[e]}</button>`,
  ).join("")}</div>
<div class="town-stick" id="town-stick" aria-hidden="true"><span></span></div>`;
  document.body.append(layer);
  document.body.classList.add("town-active");
  const $ = <T extends HTMLElement>(id: string) => layer.querySelector<T>(`#${id}`)!;

  const profiles = new Map<number, TownProfile>();
  const bodies = new Map<number, Body>();
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
  const typing = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName ?? "");
  /** A panel or dialog is open over the town: it gets the keys, you stand still. */
  const covered = () =>
    !!document.querySelector("dialog[open], .home-drawer:not([hidden]), .header-menu[open]");
  const keydown = (e: KeyboardEvent) => {
    if (typing() || covered()) return;
    if ((e.code === "KeyE" || e.code === "Enter") && nearPortal) {
      e.preventDefault();
      held.clear();
      return void options.onPortal(nearPortal);
    }
    const digit = Number(e.key);
    if (digit >= 1 && digit <= TOWN_EMOTES.length) void emote(TOWN_EMOTES[digit - 1]);
    if (actionFor(controlPrefs().bindings, e.code)) {
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
  canvasEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || !scene) return;
    const cam = scene.cameras.main,
      rect = canvasEl.getBoundingClientRect(),
      p = cam.getWorldPoint((e.clientX - rect.left) * devicePixelRatio, (e.clientY - rect.top) * devicePixelRatio);
    walkTo = { x: p.x, y: p.y };
  });

  const sendInput = (now: number, dir: { x: number; y: number }) => {
    const changed = Math.abs(dir.x - sent.x) > 0.01 || Math.abs(dir.y - sent.y) > 0.01;
    // On change (at most 20 a second), plus a slow keep-alive while walking.
    if ((changed && now - sentAt > 50) || ((dir.x || dir.y) && now - sentAt > 1000)) {
      sent = { ...dir };
      sentAt = now;
      socket.emit("town-input", { dx: Math.round(dir.x * 100) / 100, dy: Math.round(dir.y * 100) / 100 });
    }
  };
  const emote = async (kind: TownEmote) => {
    const button = layer.querySelector<HTMLButtonElement>(`[data-emote="${kind}"]`);
    button?.classList.add("pressed");
    setTimeout(() => button?.classList.remove("pressed"), 300);
    socket.timeout(3000).emit("town-emote", { emote: kind }, () => undefined);
  };
  layer.querySelectorAll<HTMLButtonElement>("[data-emote]").forEach((b) => {
    b.onclick = () => void emote(b.dataset.emote as TownEmote);
  });
  layer.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((b) => {
    b.onclick = () => {
      held.clear();
      options.onAction(b.dataset.action as TownAction);
    };
  });
  const prompt = $("town-prompt");
  prompt.onclick = () => nearPortal && options.onPortal(nearPortal);

  // --- Server --------------------------------------------------------------
  const onState = (s: TownState) => {
    me = s.me;
    $("town-pop").textContent = `Town ${s.town} · ${s.population} ${s.population === 1 ? "player" : "players"} here`;
    const now = performance.now();
    for (const [id, x, y, angle, moving, emoteIndex] of s.walkers) {
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
      }
      if (emoteIndex !== body.emote) {
        body.emote = emoteIndex;
        scene?.showEmote(body);
      }
    }
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
    private following?: Body;
    constructor() {
      super("town");
    }
    create() {
      scene = this;
      this.scenery = new TownScenery(this, options.reduced);
      const cam = this.cameras.main;
      cam.setBackgroundColor("#2f4224");
      this.fit();
      this.scale.on("resize", () => this.fit());
    }
    /** Show roughly 1100×650 of the world; phones see a closer, narrower slice. */
    fit() {
      const w = this.scale.width / devicePixelRatio,
        h = this.scale.height / devicePixelRatio;
      // Never zoomed out past the edge of the map.
      // Short landscape phones get a closer view so fighters stay readable.
      const view = h < 500 ? h / 430 : Math.min(1.5, Math.min(w / 1100, h / 650) * 1.1);
      this.zoomBase = Math.max(w / TOWN.width, h / TOWN.height, view);
      const cam = this.cameras.main;
      cam.setZoom(this.zoomBase * devicePixelRatio);
      cam.setBounds(0, 0, TOWN.width, TOWN.height);
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
        shadow: this.add.ellipse(x, y, 46, 16, 0x000000, 0.25),
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
            strokeThickness: 4,
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
      body.name.setText(`${level}${p.name}`).setColor(body.id === me ? "#ffe27a" : "#ffffff");
      body.title.setText(p.title ?? "").setColor(p.titleColor ?? "#c9d2e3");
      const character = (p.character in CHARACTERS ? p.character : "voltkit") as CharacterId;
      if (body.rigFor !== character) {
        body.rig?.destroy();
        body.rig = undefined;
        body.rigFor = character;
        this.ensureRig(character, () => {
          if (bodies.get(body.id) !== body || body.rigFor !== character || body.rig) return;
          body.rig = new FighterRig(this, character, rigAssets(character));
          body.rig.root.setScale(RIG_SCALE, RIG_SCALE);
        });
      }
    }
    private ensureRig(id: CharacterId, ready: () => void) {
      const assets = rigAssets(id);
      const missing = assets.filter((a) => !this.textures.exists(a.key));
      if (!missing.length) return ready();
      this.load.once(`town-ready-${id}`, ready);
      if (this.loading.has(id)) return;
      this.loading.add(id);
      for (const a of missing) this.load.svg(a.key, a.url, { width: a.width, height: a.height });
      const done = () => {
        if (assets.some((a) => !this.textures.exists(a.key))) return;
        this.load.off("complete", done);
        this.loading.delete(id);
        this.load.emit(`town-ready-${id}`);
      };
      this.load.on("complete", done);
      if (!this.load.isLoading()) this.load.start();
    }
    removeBody(body: Body) {
      body.rig?.destroy();
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
      const ui = Math.max(1, 1 / this.zoomBase);
      body.bubble = this.add.container(body.x, body.y, [g, text]).setDepth(6000).setScale(ui);
      if (!options.reduced) {
        body.bubble.setScale(0.3 * ui);
        this.tweens.add({ targets: body.bubble, scale: ui, duration: 260, ease: "Back.Out" });
      }
    }
    update(time: number, delta: number) {
      const dt = Math.min(0.1, delta / 1000);
      this.scenery.update(time, dt, bodies.get(me));
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
        const near = TOWN_SPOTS.filter((p) => Math.hypot(p.x - mine.x, p.y + 10 - mine.y) < p.reach).sort((a, b) => Math.hypot(a.x - mine.x, a.y - mine.y) - Math.hypot(b.x - mine.x, b.y - mine.y))[0];
        if (near !== nearPortal) {
          nearPortal = near;
          prompt.hidden = !near;
          if (near)
            prompt.innerHTML = `<b style="color:${near.color}">${esc(near.label)}</b><span>${esc(near.sub)} · ${
              matchMedia("(pointer: coarse)").matches ? "Tap" : "Press E"
            }</span>`;
        }
      }
    }
    private place(body: Body, now: number) {
      body.shadow.setPosition(body.x, body.y).setDepth(body.y - 0.5);
      const p = profiles.get(body.id);
      if (body.rig) {
        const character = body.rig.character;
        body.rig.root.setScale(RIG_SCALE, RIG_SCALE);
        body.rig.setDepth(body.y);
        body.rig.render(
          {
            hp: 1,
            speed: body.moving ? CHARACTERS[character].speed : 0,
            angle: body.angle,
            dash: false,
            jump: false,
            skin: p?.skin ?? null,
          },
          body.x,
          body.y - FEET * RIG_SCALE,
          now,
          1,
          options.reduced,
        );
      }
      const head = body.y - 60;
      const ui = Math.max(1, 1 / this.zoomBase);
      body.name.setScale(ui).setPosition(body.x, head);
      body.title.setScale(ui);
      body.title.setPosition(body.x, head - (body.name.height - 4) * ui);
      const top = head - (body.name.height + (body.title.text ? body.title.height - 4 : 0)) * ui;
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
  const resize = () => game.scale.resize(Math.round(host.clientWidth * dpr), Math.round(host.clientHeight * dpr));
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
    game.destroy(true);
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
      if (!closed) socket.timeout(3000).emit("town-look", { character }, () => undefined);
    },
  };
}
