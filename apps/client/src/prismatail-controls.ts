import type { Snapshot, Fighter } from "@arena/shared";
import { setHudStyle } from "./hud-dom";

/**
 * Phones (owner, 24 Nov 2026): the pair sits side by side in the touch
 * cluster's contextual slot, the court's free top-right corner left of the
 * target button, both always showing (one at a time, by skill 1, was hard to
 * find mid-fight). Turn mirror dims with no mirror in reach; Look away lights
 * up while Glare winds up, with the wind-up as a ring. Desktop keeps both as
 * labelled buttons.
 *
 * The icons are drawn (SVG on a 24-unit box, centred), not text glyphs:
 * a font's ↻ sits off-centre in a round button.
 */
const ICON = {
  turn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M19.5 3.5v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  away: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
};
/**
 * Prismell's atrium is on the court: its raid, or the Spire's boss floor in
 * its zone (the wave and elite floors have no mirrors or Glare).
 */
const prismCourt = (state: Snapshot) =>
  state.raid?.boss === "prismatail" &&
  (!state.raid.spire || state.raid.spire.kind === "boss");
let lookingAway = false,
  turningUntil = 0;
let turningBasicAt: number | undefined;
/** Input assistance stays local; the server still resolves the real aim and attack. */
export function prismatailAim(state: Snapshot, me: Fighter) {
  if (state.phase !== "playing" || !prismCourt(state) || me.hp <= 0) {
    lookingAway = false;
    turningUntil = 0;
    turningBasicAt = undefined;
    return;
  }
  if (lookingAway) {
    const boss = state.players.find((p) => p.raidBoss);
    if (boss)
      return {
        x: me.x + (me.x - boss.x),
        y: me.y + (me.y - boss.y),
        basic: false,
      };
  }
  if (performance.now() < turningUntil) {
    turningBasicAt ??= me.basicAt;
    if (me.basicAt > turningBasicAt && me.basicAt > state.time) {
      turningUntil = 0;
      turningBasicAt = undefined;
      return;
    }
    const mirror = [...(state.raid?.mirrors ?? [])].sort(
      (a, b) =>
        Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y),
    )[0];
    if (mirror && Math.hypot(mirror.x - me.x, mirror.y - me.y) <= 145)
      return { ...mirror, basic: true };
  }
}
export function renderPrismatailControls(
  state: Snapshot,
  me: Fighter,
  frame: HTMLElement,
) {
  let panel = document.getElementById("raid-prism-controls");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "raid-prism-controls";
    frame.append(panel);
  }
  // Phones: into the touch cluster's contextual slot (desktop: the frame).
  const slot = document.body.classList.contains("touch-mode")
    ? document.querySelector<HTMLElement>(".touch-buttons .touch-context")
    : null;
  const home = slot ?? frame;
  if (panel.parentElement !== home) home.append(panel);
  panel.classList.toggle("is-context", !!slot);
  panel.hidden = !prismCourt(state) || state.phase !== "playing" || me.hp <= 0;
  frame.classList.toggle(
    "prism-blinded",
    !panel.hidden && (state.raid?.blinded?.[me.id] ?? 0) > state.time,
  );
  if (panel.hidden) {
    panel
      .querySelector("[data-prism-away]")
      ?.setAttribute("aria-pressed", "false");
    lookingAway = false;
    turningUntil = 0;
    return;
  }
  if (!panel.childElementCount) {
    panel.innerHTML =
      `<button type="button" data-prism-turn aria-label="Turn mirror" title="Attack the nearby mirror to rotate it 45°"><span class="prism-icon">${ICON.turn}</span> Turn mirror</button>` +
      `<button type="button" data-prism-away aria-label="Look away" aria-pressed="false" title="Hold to aim away from Prismell during Glare"><span class="prism-icon">${ICON.away}</span> Look away</button>`;
    panel.querySelector<HTMLButtonElement>("[data-prism-turn]")!.onclick =
      () => {
        turningBasicAt = undefined;
        turningUntil = performance.now() + 1400;
      };
    const away = panel.querySelector<HTMLButtonElement>("[data-prism-away]")!;
    let hold: AbortController | undefined;
    const release = () => {
      lookingAway = false;
      away.setAttribute("aria-pressed", "false");
      hold?.abort();
      hold = undefined;
    };
    away.onpointerdown = (e) => {
      release();
      lookingAway = true;
      away.setAttribute("aria-pressed", "true");
      hold = new AbortController();
      const options = { capture: true, signal: hold.signal };
      for (const type of ["pointerup", "pointercancel"])
        window.addEventListener(
          type,
          (event) => {
            if ((event as PointerEvent).pointerId === e.pointerId) release();
          },
          options,
        );
      window.addEventListener(
        "pointerdown",
        (event) => {
          if (event.pointerType === "touch" && event.isPrimary) release();
        },
        options,
      );
      for (const type of ["touchend", "touchcancel"])
        window.addEventListener(
          type,
          (event) => {
            if (!(event as TouchEvent).touches.length) release();
          },
          { ...options, passive: true },
        );
      window.addEventListener("blur", release, options);
      window.addEventListener("pagehide", release, options);
      document.addEventListener("visibilitychange", release, options);
      try {
        away.setPointerCapture(e.pointerId);
      } catch {
        /* Window release listeners also cover iOS capture loss. */
      }
    };
    away.onpointerup = release;
    away.onpointercancel = release;
    away.onlostpointercapture = release;
    away.onblur = release;
    away.onkeydown = (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        lookingAway = true;
        away.setAttribute("aria-pressed", "true");
      }
    };
    away.onkeyup = release;
  }
  const nearby = state.raid!.mirrors?.some(
    (m) => Math.hypot(m.x - me.x, m.y - me.y) <= 145,
  );
  const turn = panel.querySelector<HTMLButtonElement>("[data-prism-turn]")!;
  const away = panel.querySelector<HTMLButtonElement>("[data-prism-away]")!;
  turn.disabled = !nearby;
  const glare = state.raid!.warnings.find((w) => w.kind === "glare");
  panel.classList.toggle("glare-warning", !!glare);
  // Both always show; each lights up when it matters (Look away also while
  // held).
  turn.toggleAttribute("data-ready", !!nearby);
  away.toggleAttribute("data-ready", !!glare || lookingAway);
  // How far Glare has wound up (0 to 1): the ring round Look away.
  const start = glare?.startedAt ?? glare?.at;
  const charge =
    glare && start !== undefined && glare.at > start
      ? Math.min(1, Math.max(0, (state.time - start) / (glare.at - start)))
      : 0;
  setHudStyle(away, "--charge", charge.toFixed(2));
}
