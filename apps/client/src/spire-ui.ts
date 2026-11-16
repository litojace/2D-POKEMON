/**
 * The Spire's battle overlay cards (raid-ui.ts shows them for a climb): the
 * briefing before the first floor, the blessing cards between floors (the
 * raid rite flow and its "rite" message), the countdown, and the results.
 */
import { CHARACTERS, type Fighter, type Snapshot } from "@arena/shared";
import {
  SPIRE_BLESSINGS,
  SPIRE_BLESSING_IDS,
  SPIRE_FLOORS,
  SPIRE_ROLES,
  spireBlessingText,
  spireCheckpoint,
  type SpireBlessingId,
  type SpireFloor,
} from "../../../packages/shared/src/spire";
import { menuIcon } from "./menu-icons";
import { LIVE_COUNTDOWN, LIVE_SECONDS } from "./overlay";
import { spireBlessingIcon } from "./spire-art";
import { actions, button } from "./ui/components";
import "./spire-battle.css";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const clock = (s: number) =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;

/** Who a floor sends: each wave's Echoes and their roles. */
export function spireFloorPlan(f: SpireFloor | undefined) {
  if (!f) return "";
  if (f.kind === "elite" && f.elite)
    return `<ol class="spire-waves"><li><b>The captain</b><span>${escape(f.elite.name)} · plays Cragmuff's <b>eruptions</b> (they chase you: keep moving)</span></li><li><b>At half health</b><span>${f.elite.escorts.map((e) => `${escape(CHARACTERS[e.character].name)} (${SPIRE_ROLES[e.role].name})`).join(", ")} join it</span></li></ol>`;
  return `<ol class="spire-waves">${f.waves
    .map(
      (w, i) =>
        `<li><b>Wave ${i + 1}</b><span>${w.map((e) => `${escape(CHARACTERS[e.character].name)} <small>${SPIRE_ROLES[e.role].name}</small>`).join(" · ")}</span></li>`,
    )
    .join("")}</ol>`;
}
/** One blessing card (picked: checked and greyed, like a rite). */
export function spireBlessingCard(
  id: SpireBlessingId,
  stacks: number,
  o: { picked?: boolean; locked?: boolean } = {},
) {
  const b = SPIRE_BLESSINGS[id];
  const off = o.picked || o.locked;
  const text = spireBlessingText(id, stacks);
  const stack =
    stacks > 0
      ? `<i class="spire-stack" aria-label="stack ${stacks + 1}">×${stacks + 1}</i>`
      : "";
  return `<button data-raid-rite="${id}" class="secondary spire-blessing-card${o.picked ? " is-picked" : ""}"${off ? " disabled" : ""} aria-pressed="${!!o.picked}" title="${escape(text)}" aria-label="${escape(`${b.name}. ${text}${o.picked ? " Chosen." : ""}`)}"><span class="raid-rite-icon spire-blessing-badge">${spireBlessingIcon(id)}</span><span class="raid-rite-copy"><b>${escape(b.name)} ${stack}</b><small>${escape(text)}</small><small class="spire-blessing-tag">${escape(b.tag)}</small></span>${o.picked ? '<span class="raid-rite-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' : ""}</button>`;
}
/** The blessings a raider holds, as a short list. */
function held(state: Snapshot, id: string) {
  const mine = state.raid?.spire?.blessings[id] ?? {};
  const list = SPIRE_BLESSING_IDS.filter((b) => (mine[b] ?? 0) > 0);
  return list.length
    ? list
        .map(
          (b) =>
            `${SPIRE_BLESSINGS[b].name}${(mine[b] ?? 0) > 1 ? ` ×${mine[b]}` : ""}`,
        )
        .join(" · ")
    : "No blessings yet";
}
/** The cards offered this intermission (remembered after a pick). */
let offered: {
  key: string;
  ids: SpireBlessingId[];
  before: Partial<Record<SpireBlessingId, number>>;
} = { key: "", ids: [], before: {} };

/**
 * The overlay for a climb in this phase: its title, body and actions (the
 * same ids and data attributes as a raid's, so raid-ui.ts binds them).
 */
export function spireOverlay(state: Snapshot, me: Fighter) {
  const r = state.raid!,
    s = r.spire!;
  const floor = SPIRE_FLOORS[s.floor];
  const heroes = state.players.filter((p) => !p.raidBoss && !p.echo && !p.out);
  let title = "",
    body = "",
    acts = "";
  if (state.phase === "briefing") {
    const waiting = state.instructionsReady.includes(me.id);
    title = `Floor ${s.floor} · ${escape(floor?.name ?? "The Spire")}`;
    body = `<div class="rc-body spire-briefing" tabindex="0" role="region" aria-label="Floor briefing"><p class="spire-lead">Echoes are shadow copies of the champions, with their whole kits. Read their wind-ups as you would in a match, and beat every wave to open the stairs.</p>${spireFloorPlan(floor)}<ul class="spire-rules"><li>${menuIcon("sparkle")}<span>After each floor you pick a <b>blessing</b>. They stack until the climb ends.</span></li><li>${menuIcon("save")}<span>Every floor you clear is <b>saved at once</b>, with its first-clear reward.</span></li><li>${menuIcon("again")}<span>${r.partySize > 1 ? "Stand beside a fallen ally to revive them." : "One self-revive on each floor."} A defeat ends the climb; you start again from floor ${spireCheckpoint(s.startFloor)}.</span></li></ul></div>`;
    acts = `<p class="ui-note rc-meta">Climbing from floor ${s.startFloor} · ${r.partySize === 1 ? "Solo" : `${r.partySize} climbers`}</p>${actions(button(waiting ? "Waiting for the team…" : "I’m ready", { kind: "primary", icon: waiting ? undefined : "battle", disabled: waiting, attrs: { id: "raid-instructions", "aria-label": waiting ? "Waiting for the team" : "I’m ready — start the climb" } }))}`;
  } else if (state.phase === "intermission") {
    const offers = s.offers[me.id] ?? [];
    const mine = s.blessings[me.id] ?? {};
    // The server drops the offer once one is picked: the cards stay put,
    // the picked one checked (like rites), from what was first offered.
    const key = `${s.floor}:${me.id}`;
    if (
      offers.length &&
      (offered.key !== key || offers.join() !== offered.ids.join())
    )
      offered = { key, ids: [...offers], before: { ...mine } };
    if (offered.key !== key) offered = { key, ids: [], before: { ...mine } };
    const picked = offered.ids.find(
      (id) => (mine[id] ?? 0) > (offered.before[id] ?? 0),
    );
    const locked = !offers.length;
    title = locked
      ? `Blessing chosen · Floor ${s.floor} next`
      : `Choose a blessing · Floor ${s.floor} next`;
    body = `<p class="raid-phase-objective"><b>${escape(floor?.name ?? "")}</b> · ${floor?.kind === "elite" ? "Elite floor" : `${s.waves} waves`}</p>${spireFloorPlan(floor)}<details class="raid-team-summary"><summary>Your blessings</summary><div class="spire-team" aria-label="Team blessings">${heroes.map((p) => `<div><b>${escape(p.name)}</b><span>${escape(held(state, p.id))}${s.offers[p.id]?.length ? " · Choosing…" : ""}</span></div>`).join("")}</div></details>`;
    const cards = offered.ids
      .map((id) =>
        spireBlessingCard(id, offered.before[id] ?? 0, {
          picked: id === picked,
          locked,
        }),
      )
      .join("");
    acts = `<div class="raid-rite-intro">${locked ? '<span class="raid-rite-locked">Blessing locked in · waiting for the team</span>' : "<span>One of three · they stack</span>"}<span class="raid-choice-timer" role="timer" aria-label="Time left to choose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><span>Choose in</span><strong>${LIVE_SECONDS}</strong></span></div><div class="raid-rite-options spire-blessings">${cards || "<p>Blessing locked in · waiting for the team.</p>"}</div>`;
  } else if (state.phase === "countdown") {
    title = LIVE_COUNTDOWN;
    body = `<p>Floor ${s.floor} · ${escape(floor?.name ?? "")}</p>`;
  } else if (state.phase === "paused") {
    title = "A teammate disconnected";
    body = "<p>The climb is paused while they reconnect.</p>";
  } else if (state.phase === "finished") {
    const won = r.result === "victory";
    title = won
      ? `Floor ${s.best} cleared!`
      : `The Echoes held floor ${s.floor}`;
    const mine = s.saves.flatMap((v) =>
      (v.claims ?? []).filter((c) => c.playerId === me.id),
    );
    const coins = mine.reduce((n, c) => n + c.coins, 0);
    const titles = mine.flatMap((c) => c.titles);
    const saving = s.saves.some((v) => v.status === "saving");
    const failed = s.saves.some((v) => v.status === "unavailable");
    const saved = !s.saves.length
      ? ""
      : saving
        ? "Saving your floors…"
        : failed
          ? "Some floors could not be saved. Your climb records have not been updated."
          : `✓ ${s.saves.length} ${s.saves.length === 1 ? "floor" : "floors"} saved to your account.`;
    const rewards =
      coins || titles.length
        ? `<div class="spire-rewards" role="status"><span class="ui-kicker">First clears</span>${coins ? `<span class="ui-price"><i class="ui-coin" aria-hidden="true"></i><span>${coins}<span class="sr-only"> coins</span></span></span>` : ""}${titles.map((t) => `<span class="ui-tag">${menuIcon("leaderboard")}${escape(t)}</span>`).join("")}</div>`
        : "";
    const next = spireCheckpoint(Math.max(s.startFloor, s.best + 1));
    body = `<div class="rc-summary spire-summary"><div class="rc-stats"><span class="rc-stat"><b class="ui-num">${s.best || "—"}</b><small>Best floor</small></span><span class="rc-stat"><b class="ui-num">${next}</b><small>Checkpoint</small></span><span class="rc-stat"><b class="ui-num">${clock(s.climbSeconds)}</b><small>Climb time</small></span><span class="rc-stat"><b class="ui-num">${r.downs}</b><small>Downs</small></span></div></div>${rewards}<p class="spire-held"><span class="ui-kicker">Blessings</span>${escape(held(state, me.id))}</p>${saved ? `<p class="rc-save${!saving && !failed ? " is-saved" : failed ? " is-error" : ""}" role="status">${saved}</p>` : ""}<p class="rc-tip">${escape(r.message)}</p>`;
    const readyCount = heroes.filter((p) => p.ready).length;
    const retryWait = me.ready || !heroes.every((p) => p.connected);
    acts = `<p class="ui-note rc-meta">${heroes.length === 1 ? `A new climb from floor ${next} · no blessings` : `${readyCount}/${heroes.length} ready · everyone confirms to climb again`}</p>${actions(
      button("Return to menu", {
        kind: "danger",
        icon: "home",
        attrs: { id: "raid-exit" },
      }),
      button("Change setup", {
        icon: "swap",
        attrs: { id: "raid-lobby", "aria-label": "Change champion" },
      }),
      button(me.ready ? "Waiting…" : "Climb again", {
        kind: "primary",
        icon: me.ready ? undefined : "again",
        disabled: retryWait,
        attrs: {
          id: "raid-retry",
          "aria-label": me.ready ? "Waiting for the team" : "Climb again",
        },
      }),
    )}`;
  }
  return { title, body, actions: acts, kicker: `The Spire · Floor ${s.floor}` };
}
