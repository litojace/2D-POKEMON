import type { Snapshot } from "@arena/shared";
let targetId: string | undefined;
export function stormTarget(state: Snapshot) {
  if (state.raid?.boss !== "storm-twins" || state.phase !== "playing") {
    targetId = undefined;
    return;
  }
  if (!targetId) return;
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
  panel.hidden =
    state.raid?.boss !== "storm-twins" || state.phase !== "playing";
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
  for (const b of Array.from(
    panel.querySelectorAll<HTMLButtonElement>("button"),
  )) {
    const id = state.raid!.twins?.[Number(b.dataset.twinIndex)]?.id;
    b.disabled = !state.players.some((p) => p.id === id && p.hp > 0);
    b.setAttribute("aria-pressed", String(targetId === id));
    b.title = `Aim at ${Number(b.dataset.twinIndex) ? "Crackle" : "Fizz"}. Tap again for automatic targeting.`;
  }
}
/** Separate bars show each twin's real health and stagger; the shared thin bar retains phase marks. */
export function stormTwinHealth(state: Snapshot) {
  const r = state.raid!;
  return `<div class="raid-twin-health">${(r.twins ?? [])
    .map((t, i) => {
      const p = state.players.find((p) => p.id === t.id),
        hp = Math.max(0, p?.hp ?? 0),
        percent = Math.max(0, Math.min(100, (hp / t.maxHp) * 100)),
        down = hp <= 0;
      return `<div class="raid-twin-bar" style="--twin-color:${i ? "#8edfff" : "#ffe18b"}"><div><b>${t.name}</b><span>${down ? (state.phase === "finished" ? (r.result === "victory" ? "DEFEATED" : "DOWN") : `REVIVES IN ${Math.max(0, Math.ceil((t.reviveAt ?? state.time) - state.time))}s`) : t.exposedUntil > state.time ? "CORE EXPOSED" : ""}</span></div><div class="raid-twin-track" role="progressbar" aria-label="${t.name} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><i style="width:${percent}%"></i></div><div class="raid-twin-stagger" title="${t.name} stagger"><i style="width:${t.exposedUntil > state.time ? 100 : t.stagger}%"></i></div></div>`;
    })
    .join("")}</div>`;
}
