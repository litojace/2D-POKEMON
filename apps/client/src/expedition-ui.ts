import type { Fighter, Snapshot } from "@arena/shared";
import { RAID_BOSSES } from "../../../packages/shared/src/raid";
import type { Journey } from "../../../packages/shared/src/journey";
import { LIVE_SECONDS, fillLiveSeconds, setOverlayMarkup } from "./overlay";
import { iconLabel } from "./menu-icons";
import { resultXp } from "./adventure-ui";

const time = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
export function renderExpeditionOverlay(
  state: Snapshot,
  me: Fighter,
  request: (event: string, data?: unknown) => Promise<unknown>,
  journey?: Journey,
) {
  const e = state.raid?.expedition;
  if (!e || (!e.camp && state.phase !== "finished")) return false;
  const overlay = document.getElementById("arena-overlay")!;
  overlay.classList.remove("raid-victory-reveal");
  overlay.style.pointerEvents = "auto";
  const route = `<ol class="expedition-steps">${e.route.map((id, i) => `<li class="${i < e.completed ? "is-done" : i === e.leg ? "is-current" : ""}"><span>${i < e.completed ? "✓" : i + 1}</span><b>${RAID_BOSSES[id].name}</b></li>`).join("")}</ol>`;
  let body: string, actions: string, title: string;
  if (e.camp) {
    title = "Catch your breath";
    body = `${route}<p>${RAID_BOSSES[e.route[e.leg]].name} defeated. Next: <b>${RAID_BOSSES[e.route[e.leg + 1]].name}</b>.</p><p>Your rites carry forward. Each raider chooses their own camp benefit. Unanswered choices become Rest.</p>`;
    const chosen = e.choices[me.id];
    actions = chosen
      ? `<p class="expedition-ready" role="status">${chosen === "rest" ? "Rest" : "Surge"} selected · waiting for the team</p>`
      : `<div class="expedition-camp-options"><button class="secondary" data-expedition-choice="rest">${iconLabel("again", "Rest")}<small>Restore all health. Keep your ultimate charge.</small></button><button class="secondary" data-expedition-choice="surge">${iconLabel("battle", "Surge")}<small>Restore 35% health and gain 40 ultimate charge.</small></button></div>`;
  } else {
    const won = e.completed === 3;
    title = won ? "Expedition complete!" : "Your journey continues";
    body = `${route}<div class="raid-result-stats expedition-stats"><span><b>${e.completed}/3</b>Trials cleared</span><span><b>${time(e.elapsed)}</b>Active time</span><span><b>${e.downs}</b>Downs</span></div><table class="expedition-contributions"><thead><tr><th>Raider</th><th>Damage</th><th>Revives</th><th>Downs</th></tr></thead><tbody>${state.players
      .filter((p) => !p.raidBoss)
      .map((p) => {
        const c = e.contributions?.[p.id];
        return `<tr><th>${p.name.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)}</th><td>${Math.round(c?.damage ?? 0).toLocaleString("en-US")}</td><td>${c?.revives ?? 0}</td><td>${c?.downs ?? 0}</td></tr>`;
      })
      .join(
        "",
      )}</tbody></table><p class="raid-save-state" role="status">${e.saved === "saved" ? "✓ Expedition rewards saved." : e.saved === "unavailable" ? "Rewards could not be saved. Please check your connection and database update." : "Saving expedition rewards…"}</p>${resultXp(journey, `expedition:${e.id}`, e.saved, state.activityEligible?.includes(me.id) ?? true)}<p>Health and rites start fresh on your next expedition.</p>`;
    actions = `<div class="result-actions"><button class="primary" id="raid-retry" ${me.ready ? "disabled" : ""}>${iconLabel("again", me.ready ? "Waiting for the team…" : "Run again")}</button><button class="secondary" id="raid-lobby">${iconLabel("swap", "Change fighter")}</button><button class="quiet" id="raid-exit">${iconLabel("home", "Return to menu")}</button></div>`;
  }
  if (e.camp)
    actions =
      `<div class="expedition-camp-clock"><span>Choose your camp benefit</span><strong>${LIVE_SECONDS}</strong></div>` +
      actions;
  setOverlayMarkup(
    overlay,
    `<div class="overlay-card raid-overlay expedition-overlay action-overlay"><span class="eyebrow">BOSS RUSH · ${e.camp ? "CAMP" : `${e.completed} OF 3 CLEARED`}</span><h2>${title}</h2><div class="panel-scroll" tabindex="0" role="region" aria-label="Expedition details">${body}</div><div class="panel-actions">${actions}</div></div>`,
    `${e.id}:${e.leg}:${e.camp}`,
  );
  fillLiveSeconds(overlay, state.remaining);
  for (const b of Array.from(
    overlay.querySelectorAll<HTMLButtonElement>("[data-expedition-choice]"),
  ))
    b.onclick = () =>
      void request("expedition-choice", { choice: b.dataset.expeditionChoice });
  const retry = overlay.querySelector<HTMLButtonElement>("#raid-retry");
  if (retry) retry.onclick = () => void request("rematch");
  const lobby = overlay.querySelector<HTMLButtonElement>("#raid-lobby");
  if (lobby) lobby.onclick = () => void request("lobby");
  return true;
}
