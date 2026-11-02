import { cosmeticTier } from "../../../packages/shared/src/cosmetic-tier";
import { JOURNEY_ITEM_BY_ID } from "../../../packages/shared/src/journey";
import { RAID_COSMETICS } from "../../../packages/shared/src/raid";
import { LOOK_ITEM_BY_ID } from "../../../packages/shared/src/shop";
import {
  drawCollectionAura,
  drawCollectionVictory,
  playCollectionEntrance,
} from "./skins/collection-fx";
import { canvasGraphics } from "./skins/fx-canvas";
import { drawColorsFx, isColors } from "./skins/colors-fx";
import "./cosmetic-fx.css";
import { FX_GRAVITY, drawAnyParticle, type FxParticle } from "./skins/skin-fx";

/**
 * Every item thumbnail (Shop, Wardrobe, Raid Hub, Journey, rewards) shows
 * what the item really does: auras circle, entrances burst and victories
 * play, looping, drawn by the same code as in a match. Each thumbnail also
 * gets its tier (data-tier) so frames and cards can dress up by rarity.
 * Only thumbnails on screen animate, at 30 frames a second.
 */
type Kind = "aura" | "entrance" | "victory" | "skin";
interface Live {
  el: HTMLElement;
  id: string;
  kind: Kind;
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  particles: (FxParticle & { age: number })[];
  start: number;
  last: number;
  cycle: number;
}
const slotOf = (id: string) =>
  LOOK_ITEM_BY_ID[id]?.slot ??
  RAID_COSMETICS[id as keyof typeof RAID_COSMETICS]?.slot ??
  JOURNEY_ITEM_BY_ID[id]?.slot;

const lives = new Map<HTMLElement, Live>();
const visible = new Set<Live>();
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let frame = 0;
let lastTick = 0;

/** Entrance pieces drawn by the rig itself in play get a matching stand-in. */
function entranceFallback(emit: (p: FxParticle) => void, id: string) {
  if (id !== "mountainborn") return false;
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI * (0.1 + (i / 18) * 0.8);
    emit({
      x: 0,
      y: 0,
      vx: Math.cos(a) * (80 + Math.random() * 90),
      vy: Math.sin(a) * (160 + Math.random() * 110),
      life: 0.9,
      size: 3 + Math.random() * 2,
      color: i % 3 ? 0x9b8466 : 0xffd28c,
      shape: "pebble",
    });
  }
  emit({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0.5,
    size: 16,
    color: 0xffd28c,
    shape: "ring",
  });
  return true;
}
function victoryFallback(
  g: ReturnType<typeof canvasGraphics>,
  id: string,
  t: number,
) {
  if (id !== "rockslide-flex") return false;
  // A pile of rocks rises under the fighter.
  const rise = Math.min(1, t / 0.35);
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 16,
      h = (18 + (3 - Math.abs(i - 3)) * 9) * rise;
    g.fillStyle(i % 2 ? 0x8a7458 : 0x6f5c45, 1).fillTriangle(
      x - 14,
      0,
      x + 14,
      0,
      x,
      -h,
    );
  }
  return true;
}

function size(canvas: HTMLCanvasElement, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)),
    h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h };
}

function draw(live: Live, now: number) {
  const { w, h } = size(live.front, live.el);
  size(live.back, live.el);
  const back = live.back.getContext("2d")!,
    front = live.front.getContext("2d")!;
  back.setTransform(1, 0, 0, 1, 0, 0);
  front.setTransform(1, 0, 0, 1, 0, 0);
  back.clearRect(0, 0, w, h);
  front.clearRect(0, 0, w, h);
  // World units around the fighter's feet, fitted to the thumbnail.
  const scale =
    live.kind === "aura"
      ? Math.min((w * 0.86) / 128, h / 110)
      : live.kind === "entrance"
        ? Math.min(w / 104, h / 92)
        : live.kind === "skin"
          ? h / 100
          : Math.min(w / 165, h / 118);
  const feetY =
    h * (live.kind === "aura" ? 0.65 : live.kind === "skin" ? 0.98 : 0.82);
  for (const c of [back, front])
    c.setTransform(scale, 0, 0, scale, w / 2, feetY);
  const gb = canvasGraphics(back),
    gf = canvasGraphics(front);
  const dt = Math.min(0.05, Math.max(0, (now - live.last) / 1000));
  live.last = now;
  const still = reduced.matches;
  const emit = (p: FxParticle) => live.particles.push({ ...p, age: 0 });
  if (live.kind === "skin") {
    // Colors: the set's motif, glints and tier extras around the fighter.
    drawColorsFx(
      {
        g: gf,
        under: gb,
        emit,
        // Thumbnails are small: twice the rate, larger motifs.
        chance: (rate, d) => Math.random() < rate * 2 * d,
        x: 0,
        y: 0,
        sc: 1.5,
        now: still ? 0 : now,
        dt,
        moving: false,
        portrait: true,
      },
      live.id,
    );
  } else if (live.kind === "aura") {
    drawCollectionAura(
      gb,
      live.id,
      0,
      0,
      still ? 0 : now,
      still,
      gf,
      18 / 48,
      3,
    );
  } else if (live.kind === "entrance") {
    const period = 2.4;
    const cycle = Math.floor((now - live.start) / 1000 / period);
    if (cycle !== live.cycle || (still && !live.particles.length)) {
      live.cycle = cycle;
      live.particles = [];
      if (!playCollectionEntrance(emit, live.id, 0, 0, 1))
        entranceFallback(emit, live.id);
      if (still) for (let s = 0; s < 7; s++) step(live, 0.05);
    }
  } else {
    const period = 3.6;
    const t = still ? 1 : ((now - live.start) / 1000) % period;
    const cycle = Math.floor((now - live.start) / 1000 / period);
    const first = cycle !== live.cycle;
    if (first) {
      live.cycle = cycle;
      live.particles = [];
    }
    const chance = (rate: number, d: number) => Math.random() < rate * d;
    if (
      !drawCollectionVictory(
        gf,
        gb,
        emit,
        chance,
        live.id,
        0,
        0,
        1,
        t,
        dt,
        first,
      )
    )
      victoryFallback(gb, live.id, t);
  }
  if (!still) step(live, dt);
  for (const p of live.particles) drawAnyParticle(gf, p, 1 - p.age / p.life);
}
function step(live: Live, dt: number) {
  for (const p of live.particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (FX_GRAVITY[p.shape] ?? 0) * dt;
  }
  live.particles = live.particles.filter((p) => p.age < p.life);
}

function tick(now: number) {
  frame = 0;
  if (!visible.size) return;
  frame = requestAnimationFrame(tick);
  if (reduced.matches || now - lastTick < 33) return;
  lastTick = now;
  for (const live of visible) {
    if (!live.el.isConnected) {
      release(live);
      continue;
    }
    draw(live, now);
  }
}
function release(live: Live) {
  visible.delete(live);
  lives.delete(live.el);
  onScreen.unobserve(live.el);
}
const onScreen = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const live = lives.get(e.target as HTMLElement);
    if (!live) continue;
    if (!live.el.isConnected) {
      release(live);
      continue;
    }
    if (e.isIntersecting) {
      visible.add(live);
      live.last = performance.now();
      draw(live, live.last);
    } else visible.delete(live);
  }
  if (visible.size && !frame && !reduced.matches)
    frame = requestAnimationFrame(tick);
});

function attach(el: HTMLElement) {
  const id = el.dataset.cosmetic;
  if (!id || el.dataset.fxReady === id) return;
  el.dataset.fxReady = id;
  const stars = Number(el.dataset.frameStars ?? 0);
  el.dataset.tier = cosmeticTier(id, stars);
  const slot = slotOf(id);
  if (slot === "frame" && !el.querySelector(":scope > .tier-fx"))
    // Rays behind, the edge, then sparks orbiting in front.
    for (const name of ["tier-rays", "tier-fx", "tier-orbit"]) {
      const fx = document.createElement("i");
      fx.className = name;
      fx.setAttribute("aria-hidden", "true");
      el.append(fx);
    }
  const kind: Kind | undefined =
    slot === "aura" || slot === "entrance" || slot === "victory"
      ? slot
      : slot === "skin" && isColors(id)
        ? "skin"
        : undefined;
  if (!kind) return;
  // Small identity portraits (headers, nameplates) keep still.
  if (
    el.closest(
      ".account-avatar, .player-avatar, .friend-avatar, .raid-party-avatar, .raid-score-avatar, .player-card-portrait",
    )
  )
    return;
  const back = document.createElement("canvas"),
    front = document.createElement("canvas");
  back.className = "fx-live fx-back";
  front.className = "fx-live fx-front";
  back.setAttribute("aria-hidden", "true");
  front.setAttribute("aria-hidden", "true");
  el.prepend(back);
  el.append(front);
  const now = performance.now();
  const live: Live = {
    el,
    id,
    kind,
    back,
    front,
    particles: [],
    start: now,
    last: now,
    cycle: -1,
  };
  lives.set(el, live);
  onScreen.observe(el);
}
function scan(root: ParentNode) {
  if (
    root instanceof HTMLElement &&
    root.matches(".raid-cosmetic-preview[data-cosmetic]")
  )
    attach(root);
  root
    .querySelectorAll<HTMLElement>(".raid-cosmetic-preview[data-cosmetic]")
    .forEach(attach);
}

let watching = false;
export function watchCosmeticPreviews(root: HTMLElement = document.body) {
  if (watching) return;
  watching = true;
  scan(root);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes" && r.attributeName === "data-frame-stars") {
        const el = r.target as HTMLElement;
        if (el.dataset.cosmetic)
          el.dataset.tier = cosmeticTier(
            el.dataset.cosmetic,
            Number(el.dataset.frameStars ?? 0),
          );
        continue;
      }
      if (r.type === "attributes") {
        const el = r.target as HTMLElement;
        if (el.matches?.(".raid-cosmetic-preview[data-cosmetic]")) {
          // A reused thumbnail switched item: rebuild its effect.
          if (el.dataset.fxReady !== el.dataset.cosmetic) {
            el.querySelectorAll(
              ":scope > .fx-live, :scope > .tier-fx, :scope > .tier-orbit, :scope > .tier-rays",
            ).forEach((n) => n.remove());
            const live = lives.get(el);
            if (live) {
              visible.delete(live);
              lives.delete(el);
              onScreen.unobserve(el);
            }
            attach(el);
          }
        }
        continue;
      }
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) scan(n);
      });
    }
    // Offscreen thumbnails have already left `visible`, so the animation
    // loop cannot release them. Drop their canvases/observer references as
    // soon as a tab, preview or dialog removes them.
    if (records.some((r) => r.removedNodes.length))
      for (const live of lives.values())
        if (!live.el.isConnected) release(live);
  }).observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-cosmetic", "data-frame-stars"],
  });
  reduced.addEventListener("change", () => {
    for (const live of visible) draw(live, performance.now());
    if (!reduced.matches && visible.size && !frame)
      frame = requestAnimationFrame(tick);
  });
}
