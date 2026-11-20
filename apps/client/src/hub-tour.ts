/**
 * The Lobby tour: a new account's first look at the hub, one spotlight at a
 * time (PLAY, the rail, the cards, Lobby / Plaza, the party, the Menu).
 *
 * What big games teach about it (docs/onboarding.md): keep it short (a few
 * marks, each about what is on screen), let the player skip at any step
 * without a confirmation, and let them replay it later (the Menu and How to
 * play). Battle skills are taught in the first match instead (battle-coach.ts)
 * and side systems when they are opened, not here.
 *
 * Steps are data: a step whose target is not on screen (a phone layout, a
 * party bar) is passed over, so no step needs its own UI branch. Layout is
 * read once per step and on resize, never per frame.
 */
import { esc } from "./ui/components";
import "./hub-tour.css";

export interface TourStep {
  id: string;
  /** Where the spotlight goes: the first of these that is on screen. */
  targets: string[];
  title: string;
  text: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "play",
    targets: [".lobby-play"],
    title: "Press PLAY to fight",
    text: "The bar above PLAY picks what you play: Quick Match, a bot, a private room, a boss raid or practice.",
  },
  {
    id: "rail",
    targets: [".lobby-rail"],
    title: "Everything else is here",
    text: "Fighters (every kit and skin), Shop, Raids, daily Missions, Ranks and Friends.",
  },
  {
    id: "cards",
    targets: [".lobby-cards"],
    title: "Your goals for today",
    text: "Your next step (Getting started, later the season Journey) and today's missions. Tap a card to open it.",
  },
  {
    id: "fighter",
    targets: [".lobby-nameplate", "#lobby-fighter"],
    title: "Your fighter",
    text: "The arrows switch fighter. Each one has its own basic attack, three skills and an ultimate.",
  },
  {
    id: "scenes",
    targets: ["#hub-scenes"],
    title: "Lobby and Plaza",
    text: "The Plaza is a square to walk around with other players, with small daily quests that pay coins.",
  },
  {
    id: "menu",
    targets: ["#home-settings", ".header-menu > summary"],
    title: "Help is in the Menu",
    text: "How to play, Getting started and Settings. You can replay this tour from How to play.",
  },
];

/* ------------------------------------------------------------- saving */

export type TourSave = "done" | "skipped" | undefined;
/** Accounts at this level or below get the tour on their own. */
export const TOUR_NEW_LEVEL = 5;
const KEY = (account: string) => `arena-tour:${account}`;

export function loadTour(account: string | undefined): TourSave {
  if (!account) return undefined;
  try {
    const v = localStorage.getItem(KEY(account));
    return v === "done" || v === "skipped" ? v : undefined;
  } catch {
    return undefined;
  }
}
export function saveTour(
  account: string | undefined,
  value: "done" | "skipped",
) {
  if (!account) return;
  try {
    localStorage.setItem(KEY(account), value);
  } catch {
    /* Private mode: the tour may show again after a reload. */
  }
}
/** Start on its own: a new account (by level) that hasn't seen it. */
export function tourDue(save: TourSave, level: number | undefined) {
  return save === undefined && level !== undefined && level <= TOUR_NEW_LEVEL;
}

/* ------------------------------------------------------------ placing */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export type Side = "below" | "above" | "left" | "right" | "center";
/** Gap between the spotlight and the bubble. */
const GAP = 12;
/** Room kept from the screen's (safe) edges. */
const EDGE = 8;

/**
 * Where the bubble goes beside a target: the side with the most room that
 * fits it, kept inside the safe area. With no side that fits (a big target
 * on a small phone), it sits in the middle of the screen.
 */
export function placeBubble(
  target: Rect | null,
  bubble: { w: number; h: number },
  view: { w: number; h: number },
  safe: Insets,
): { x: number; y: number; side: Side } {
  const minX = safe.left + EDGE,
    maxX = view.w - safe.right - EDGE - bubble.w,
    minY = safe.top + EDGE,
    maxY = view.h - safe.bottom - EDGE - bubble.h;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(Math.max(lo, hi), v));
  const center = {
    x: clamp((view.w - bubble.w) / 2, minX, maxX),
    y: clamp((view.h - bubble.h) / 2, minY, maxY),
    side: "center" as Side,
  };
  if (!target) return center;
  const room = {
    below: view.h - safe.bottom - EDGE - (target.y + target.h + GAP),
    above: target.y - GAP - safe.top - EDGE,
    right: view.w - safe.right - EDGE - (target.x + target.w + GAP),
    left: target.x - GAP - safe.left - EDGE,
  };
  const fits: [Side, number][] = (
    [
      ["right", room.right - bubble.w],
      ["left", room.left - bubble.w],
      ["below", room.below - bubble.h],
      ["above", room.above - bubble.h],
    ] as [Side, number][]
  ).filter(([, spare]) => spare >= 0);
  if (!fits.length) return center;
  // Something in the header (a button up top) gets its bubble below it;
  // otherwise the most spare room wins: on a landscape phone, usually a side.
  const high = target.y + target.h < view.h * 0.25;
  const below = fits.find(([s]) => s === "below");
  const [side] = high && below ? below : fits.sort((a, b) => b[1] - a[1])[0];
  const midX = target.x + target.w / 2 - bubble.w / 2,
    midY = target.y + target.h / 2 - bubble.h / 2;
  if (side === "below")
    return { side, x: clamp(midX, minX, maxX), y: target.y + target.h + GAP };
  if (side === "above")
    return { side, x: clamp(midX, minX, maxX), y: target.y - GAP - bubble.h };
  if (side === "right")
    return { side, x: target.x + target.w + GAP, y: clamp(midY, minY, maxY) };
  return { side, x: target.x - GAP - bubble.w, y: clamp(midY, minY, maxY) };
}

/* ------------------------------------------------------------- markup */

export function tourMarkup(step: TourStep, index: number, total: number) {
  const last = index === total - 1;
  const dots = Array.from(
    { length: total },
    (_, i) =>
      `<i class="${i < index ? "is-done" : i === index ? "is-now" : ""}"></i>`,
  ).join("");
  return `<div class="tour-bubble-head"><span class="tour-count">${index + 1} / ${total}</span><button type="button" class="tour-skip" data-tour="skip">Skip tour</button></div><h3 class="tour-title" id="tour-title">${esc(step.title)}</h3><p class="tour-text" id="tour-text">${esc(step.text)}</p><div class="tour-foot"><span class="tour-dots" aria-hidden="true">${dots}</span>${index > 0 ? `<button type="button" class="tour-back" data-tour="back">Back</button>` : ""}<button type="button" class="tour-next" data-tour="next">${last ? "Got it" : "Next"}</button></div>`;
}

/* ------------------------------------------------------------ runtime */

const visibleRect = (el: Element | null): Rect | null => {
  // (The page behind the tour is inert while it runs: that is fine.)
  if (!el || el.closest("[hidden]")) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  if (r.right <= 0 || r.bottom <= 0) return null;
  if (r.left >= innerWidth || r.top >= innerHeight) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};
const findTarget = (step: TourStep) => {
  for (const s of step.targets) {
    for (const el of Array.from(document.querySelectorAll(s))) {
      const rect = visibleRect(el);
      if (rect) return rect;
    }
  }
  return null;
};
/** The safe-area insets as pixels (ui/tokens.css --safe-*). */
function safeInsets(): Insets {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;padding:var(--safe-top,0px) var(--safe-right,0px) var(--safe-bottom,0px) var(--safe-left,0px)";
  document.body.append(probe);
  const s = getComputedStyle(probe);
  const out = {
    top: parseFloat(s.paddingTop) || 0,
    right: parseFloat(s.paddingRight) || 0,
    bottom: parseFloat(s.paddingBottom) || 0,
    left: parseFloat(s.paddingLeft) || 0,
  };
  probe.remove();
  return out;
}

export interface TourHandle {
  close(): void;
  readonly open: boolean;
}
export interface TourOptions {
  /** Done (last step) or skipped; also how far the player got. */
  onEnd(result: "done" | "skipped", reached: number): void;
  reduced?: boolean;
}

/** Run the tour over the page. Steps without a target on screen are passed. */
export function runTour(o: TourOptions): TourHandle {
  const steps = TOUR_STEPS;
  const root = document.createElement("div");
  root.className = "hub-tour";
  root.dataset.tour = "";
  if (o.reduced) root.classList.add("is-reduced");
  root.innerHTML = `<div class="tour-hole" aria-hidden="true"></div><section class="tour-bubble" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text"></section>`;
  const hole = root.querySelector<HTMLElement>(".tour-hole")!;
  const bubble = root.querySelector<HTMLElement>(".tour-bubble")!;
  const returnFocus = document.activeElement as HTMLElement | null;
  let index = -1,
    open = true,
    reached = 0,
    safe = safeInsets();

  const place = () => {
    const step = steps[index];
    const target = findTarget(step);
    const pad = 6;
    const spot = target && {
      x: target.x - pad,
      y: target.y - pad,
      w: target.w + pad * 2,
      h: target.h + pad * 2,
    };
    root.classList.toggle("has-target", !!spot);
    if (spot) {
      hole.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
      hole.style.width = `${spot.w}px`;
      hole.style.height = `${spot.h}px`;
    }
    const at = placeBubble(
      spot,
      { w: bubble.offsetWidth, h: bubble.offsetHeight },
      { w: innerWidth, h: innerHeight },
      safe,
    );
    bubble.dataset.side = at.side;
    bubble.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
  };
  /** Show step `to`, passing over steps with nothing on screen. */
  const show = (to: number, dir: 1 | -1) => {
    let i = to;
    while (i >= 0 && i < steps.length && !findTarget(steps[i])) i += dir;
    if (i >= steps.length) return end("done");
    if (i < 0) return show(0, 1);
    index = i;
    reached = Math.max(reached, i + 1);
    const shown = steps.filter((s, k) => k === i || findTarget(s));
    bubble.innerHTML = tourMarkup(
      steps[i],
      shown.indexOf(steps[i]),
      shown.length,
    );
    place();
    bubble.querySelector<HTMLElement>("[data-tour=next]")?.focus({
      preventScroll: true,
    });
  };
  const step = (dir: 1 | -1) => {
    if (dir === 1 && index >= steps.length - 1) return end("done");
    const next = index + dir;
    // Last shown step: Next ends it even if hidden steps follow.
    if (dir === 1 && !steps.slice(next).some((s) => findTarget(s)))
      return end("done");
    show(next, dir);
  };
  const onClick = (e: Event) => {
    const t = (e.target as Element).closest<HTMLElement>("[data-tour]");
    // Taps anywhere else wait for the bubble: the Lobby is not live yet.
    e.stopPropagation();
    if (!t) return;
    const what = t.dataset.tour;
    if (what === "skip") end("skipped");
    else if (what === "back") step(-1);
    else if (what === "next") step(1);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      end("skipped");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      step(-1);
    } else if (e.key === "Tab") {
      // Keep focus inside the bubble.
      const all = Array.from(bubble.querySelectorAll<HTMLElement>("button"));
      const i = all.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      all[(i + (e.shiftKey ? -1 : 1) + all.length) % all.length]?.focus();
    }
  };
  let resizeFrame = 0;
  const onResize = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      safe = safeInsets();
      if (open && index >= 0) place();
    });
  };
  function end(result: "done" | "skipped") {
    if (!open) return;
    close();
    o.onEnd(result, reached);
  }
  function close() {
    if (!open) return;
    open = false;
    cancelAnimationFrame(resizeFrame);
    root.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey, true);
    removeEventListener("resize", onResize);
    root.remove();
    for (const el of stilled) el.inert = false;
    document.body.classList.remove("tour-active");
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  root.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey, true);
  addEventListener("resize", onResize);
  // Everything behind waits (keyboard, controller and screen readers too).
  const stilled = Array.from(document.body.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && !el.inert,
  );
  for (const el of stilled) el.inert = true;
  document.body.append(root);
  document.body.classList.add("tour-active");
  show(0, 1);
  return {
    close,
    get open() {
      return open;
    },
  };
}
