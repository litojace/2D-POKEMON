import type { Snapshot, Fighter } from "@arena/shared";
let lookingAway = false,
  turningUntil = 0;
let turningBasicAt: number | undefined;
/** Input assistance stays local; the server still resolves the real aim and attack. */
export function prismatailAim(state: Snapshot, me: Fighter) {
  if (
    state.phase !== "playing" ||
    state.raid?.boss !== "prismatail" ||
    me.hp <= 0
  ) {
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
    const mirror = [...(state.raid.mirrors ?? [])].sort(
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
  let panel = frame.querySelector<HTMLElement>("#raid-prism-controls");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "raid-prism-controls";
    frame.append(panel);
  }
  panel.hidden =
    state.raid?.boss !== "prismatail" ||
    state.phase !== "playing" ||
    me.hp <= 0;
  frame.classList.toggle(
    "prism-blinded",
    !panel.hidden && (state.raid?.blinded?.[me.id] ?? 0) > state.time,
  );
  if (panel.hidden) {
    panel.querySelector("[data-prism-away]")?.setAttribute("aria-pressed", "false");
    lookingAway = false;
    turningUntil = 0;
    return;
  }
  if (!panel.childElementCount) {
    panel.innerHTML =
      '<button type="button" data-prism-turn title="Attack the nearby mirror to rotate it 45°"><span aria-hidden="true">↻</span> Turn mirror</button><button type="button" data-prism-away aria-pressed="false" title="Hold to aim away from Prismatail during Glare"><span aria-hidden="true">◉</span> Look away</button>';
    panel.querySelector<HTMLButtonElement>("[data-prism-turn]")!.onclick =
      () => {
        turningBasicAt = undefined;
        turningUntil = performance.now() + 1400;
      };
    const away = panel.querySelector<HTMLButtonElement>("[data-prism-away]")!;
    away.onpointerdown = (e) => {
      lookingAway = true;
      away.setPointerCapture(e.pointerId);
      away.setAttribute("aria-pressed", "true");
    };
    const release = () => {
      lookingAway = false;
      away.setAttribute("aria-pressed", "false");
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
  panel.querySelector<HTMLButtonElement>("[data-prism-turn]")!.disabled =
    !nearby;
  panel.classList.toggle(
    "glare-warning",
    state.raid!.warnings.some((w) => w.kind === "glare"),
  );
}
