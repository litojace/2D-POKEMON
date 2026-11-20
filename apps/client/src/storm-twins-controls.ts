import { healthTrail } from "./raid-health-trail";
import type { Snapshot } from "@arena/shared";
import { mirrorTwinFor } from "./ascendant-storm-twins-art";
let targetId: string | undefined;
/**
 * Is there a pair of twins to aim at? Their raid, and the Spire's floor 70
 * (the Spire's other zone-7 floors field Echoes: no twins).
 */
const twinsUp = (state: Snapshot) =>
  state.raid?.boss === "storm-twins" &&
  state.phase === "playing" &&
  (!state.raid.spire || state.raid.spire.kind === "boss");
/**
 * The twin to aim at: the one picked with the buttons; during an Ascendant
 * Mirror Charge (no button picked), the twin `myId`'s sign discharges.
 */
export function stormTarget(state: Snapshot, myId?: string) {
  if (!twinsUp(state)) {
    targetId = undefined;
    return;
  }
  if (!targetId) return myId ? mirrorTwinFor(state, myId) : undefined;
  let p = state.players.find(
    (p) => p.id === targetId && p.raidBoss && p.hp > 0,
  );
  if (!p) {
    p = state.players.find((p) => p.raidBoss && p.hp > 0);
    targetId = p?.id;
  }
  return p;
}
export function renderStormTargets(state: Snapshot, frame: HTMLElement) {
  let panel = frame.querySelector<HTMLElement>("#raid-storm-targets");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "raid-storm-targets";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Choose which twin to aim at");
    frame.append(panel);
  }
  panel.hidden = !twinsUp(state);
  if (panel.hidden) {
    targetId = undefined;
    return;
  }
  if (!panel.childElementCount) {
    panel.innerHTML =
      '<button type="button" data-twin-index="0" aria-pressed="false">Target Fizz</button><button type="button" data-twin-index="1" aria-pressed="false">Target Crackle</button>';
    for (const b of Array.from(
      panel.querySelectorAll<HTMLButtonElement>("button"),
    ))
      b.onclick = () => {
        const id = state.raid!.twins?.[Number(b.dataset.twinIndex)]?.id;
        targetId = targetId === id ? undefined : id;
        b.setAttribute("aria-pressed", String(targetId === id));
      };
  }
  const mirror = state.raid!.stormMirror;
  for (const b of Array.from(
    panel.querySelectorAll<HTMLButtonElement>("button"),
  )) {
    const index = Number(b.dataset.twinIndex),
      id = state.raid!.twins?.[index]?.id;
    b.disabled = !state.players.some((p) => p.id === id && p.hp > 0);
    b.setAttribute("aria-pressed", String(targetId === id));
    b.title = `Aim at ${index ? "Crackle" : "Fizz"}. Tap again for automatic targeting.`;
    // Mirror Charge: each button carries its twin's charge (written only when it changes).
    const charge = mirror?.twins.find((t) => t.id === id);
    const label = `Target ${index ? "Crackle" : "Fizz"}${charge && charge.hits < charge.need ? (charge.sign > 0 ? " +" : " \u2212") : ""}`;
    if (b.textContent !== label) b.textContent = label;
  }
}
/** Separate bars show each twin's real health and stagger; the shared thin bar retains phase marks. */
export interface TwinBarView {
  id: string;
  name: string;
  /** Under the name: revive countdown, core exposed, defeated or nothing. */
  status: string;
  percent: number;
  trail: number;
  stagger: number;
}
/** One twin's bar (Storm Twins). Moves its damage trail along. */
export function twinBars(state: Snapshot): TwinBarView[] {
  const r = state.raid!;
  return (r.twins ?? []).map((t) => {
    const p = state.players.find((p) => p.id === t.id),
      hp = Math.max(0, p?.hp ?? 0),
      percent = Math.max(0, Math.min(100, (hp / t.maxHp) * 100)),
      down = hp <= 0;
    return {
      id: t.id,
      name: t.name,
      status: down
        ? state.phase === "finished"
          ? r.result === "victory"
            ? "DEFEATED"
            : "DOWN"
          : `REVIVES IN ${Math.max(0, Math.ceil((t.reviveAt ?? state.time) - state.time))}s`
        : t.exposedUntil > state.time
          ? "CORE EXPOSED"
          : "",
      percent,
      trail: healthTrail(`twin:${t.id}`, percent),
      stagger: t.exposedUntil > state.time ? 100 : t.stagger,
    };
  });
}

/** The twins' bars as markup (the live HUD builds the same structure once
 *  and updates it in place: see raid-hud.ts). */
export function stormTwinHealth(state: Snapshot) {
  return `<div class="raid-twin-health">${twinBars(state)
    .map(
      (t, i) =>
        `<div class="raid-twin-bar" style="--twin-color:${i ? "#8edfff" : "#ffe18b"}"><div><b>${t.name}</b><span>${t.status}</span></div><div class="raid-twin-track" role="progressbar" aria-label="${t.name} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(t.percent)}"><i class="raid-boss-trail" style="width:${t.trail}%"></i><i class="raid-boss-fill" style="width:${t.percent}%"></i><span class="raid-boss-pct" aria-hidden="true">${Math.ceil(t.percent)}%</span></div><div class="raid-twin-stagger" title="${t.name} stagger"><i style="--fill:${t.stagger}"></i></div></div>`,
    )
    .join("")}</div>`;
}
