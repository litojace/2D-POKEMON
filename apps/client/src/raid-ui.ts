import { drawBossBattleEffects } from "./boss-spell-art";
import { resultXp } from "./adventure-ui";
import type { Journey } from "../../../packages/shared/src/journey";
import {
  drawConductorRing,
  drawStormWarning,
  drawStormTwins,
} from "./raid-storm-twins-art";
import { renderStormTargets } from "./storm-twins-controls";
import {
  drawSkyTerrace,
  drawEmberwingWarning,
  drawEmberwing,
} from "./raid-emberwing-art";
import {
  drawSunAtrium,
  drawPrismatailWarning,
  drawPrismatail,
} from "./raid-prismatail-art";
import { renderPrismatailControls } from "./prismatail-controls";
import { renderSomnaraControls } from "./somnara-controls";
import {
  drawCloudDeck,
  drawSomnaraWarning,
  drawSomnara,
} from "./raid-somnara-art";
import { iconLabel, menuIcon } from "./menu-icons";
import { actions as uiActions, button as uiButton } from "./ui/components";
import "./screens/raid-cards.css";
import { raidContributions, raidGoals } from "./raid-presentation";
import { paintRaidHud, raidHudView } from "./raid-hud";
import type Phaser from "phaser";
import type { LayerAt } from "./raid-layers";
import { CHARACTERS, type Fighter, type Snapshot } from "@arena/shared";
import {
  RAID_RITE_PICKS,
  RAID,
  RAID_ATTACKS,
  raidAttacksOf,
  raidChapters,
  raidPerksOf,
  raidPingLabel,
  type RaidBossId,
  RAID_PINGS,
  RAID_RITES,
  RAID_TRAITS,
  RAID_BOSSES,
  type RaidAttack,
  type RaidLoadout,
  type RaidPingKind,
  type RaidProgress,
} from "../../../packages/shared/src/raid";
import { raidGuideBossFor } from "./raid-guide-art";
import { raidBriefingGuide } from "./raid-briefing";
import {
  raidRiteChoices,
  raidRiteDetails,
  bindRaidRiteDetails,
} from "./raid-rite-cards";
import { drawRaidBoss } from "./raid-boss-art";
import {
  drawLagoon,
  drawTideAttacks,
  drawTidewyrm,
  drawTidewyrmWarning,
} from "./raid-tidewyrm-art";
import {
  drawGloomshade,
  drawGloomshadeWarning,
  drawLanternYard,
} from "./raid-gloomshade-art";
import {
  setOverlayMarkup,
  LIVE_SECONDS,
  LIVE_COUNTDOWN,
  fillLiveSeconds,
  fillLiveCountdown,
} from "./overlay";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const time = (s: number) =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
/** Equipped items as a space-separated list (for data-raid-cosmetic~=...). */
export function raidLookList(look: RaidLoadout | null | undefined) {
  return Object.values(look ?? {})
    .filter(Boolean)
    .join(" ");
}
export { portraitAvatar, portraitCosmetics } from "./portraits";
/** The result whose saved progress was already fetched, per overlay. */
const resultProgress = new WeakMap<HTMLElement, string>();
export function renderRaidUI(
  state: Snapshot,
  me: Fighter,
  request: (event: string, data?: unknown) => Promise<unknown>,
  loadProgress?: () => Promise<RaidProgress>,
  journey?: Journey,
) {
  const r = state.raid!;
  document.body.classList.toggle(
    "raid-downed",
    state.phase === "playing" && me.hp <= 0,
  );
  if (state.phase !== "playing")
    document.getElementById("spectate")?.setAttribute("hidden", "");
  let hud = document.getElementById("raid-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "raid-hud";
    document.getElementById("battle")!.prepend(hud);
  }
  // Each fighter's health is on its overhead nameplate, and who is targeted,
  // sealed or down is told in the callout and on the court, so the HUD shows
  // the boss only.
  raidControls(state, me, request);
  paintRaidHud(hud, raidHudView(state, me));
  const overlay = document.getElementById("arena-overlay")!;
  // Fetch saved progress once per result: the caller refreshes frame stars
  // and turns over newly earned reward cards from it.
  if (
    state.phase === "finished" &&
    r.rewardStatus === "saved" &&
    loadProgress
  ) {
    const id = `${me.id}:${r.resultId ?? r.seed}`;
    if (resultProgress.get(overlay) !== id) {
      resultProgress.set(overlay, id);
      void loadProgress().catch(() => {});
    }
  } else resultProgress.delete(overlay);
  // Reveal results after the collapse, without restarting when reward status updates.
  if (r.result === "victory" && state.phase === "finished") {
    const id = r.resultId ?? String(r.seed);
    if (overlay.dataset.raidVictory !== id) {
      overlay.dataset.raidVictory = id;
      overlay.classList.add("raid-victory-reveal");
    }
  } else {
    delete overlay.dataset.raidVictory;
    overlay.classList.remove("raid-victory-reveal");
  }

  if (state.phase === "playing") {
    setOverlayMarkup(overlay, "");
    overlay.style.pointerEvents = "none";
    const banner = document.getElementById("spectate")!;
    banner.hidden = me.hp > 0;
    if (me.hp <= 0) {
      const markup = downedCard(state, me.id);
      if (banner.innerHTML !== markup) banner.innerHTML = markup;
    }
    return;
  }
  overlay.style.pointerEvents = "auto";
  let title = "",
    body = "",
    actions = "";
  if (state.phase === "briefing") {
    title = `${RAID_TRAITS[r.trait].name} ${RAID_BOSSES[r.boss].name}`;
    const waiting = state.instructionsReady.includes(me.id);
    body = `<div class="rc-body" tabindex="0" role="region" aria-label="Raid instructions">${raidBriefingGuide(r.boss, me.character, r.partySize === 1)}<details class="rc-extra" id="raid-briefing-extra"><summary>Your fighter, team &amp; modifiers</summary><p><b>${escape(RAID_TRAITS[r.trait].name)}</b> · ${escape(RAID_TRAITS[r.trait].text)}</p>${perkLines(state, me.id)}${r.partySize > 1 ? `<p class="raid-signals">Team signals: ${(Object.keys(RAID_PINGS) as RaidPingKind[]).map((k) => `<b>${RAID_PINGS[k].key}</b> ${raidPingLabel(k, r.boss)}`).join(" · ")} (or use the on-screen buttons)</p>` : ""}</details></div>`;
    actions = `<p class="ui-note rc-meta">Three phases · one shared fight · ${r.partySize === 1 ? "Solo · one self-revive" : "Team · stand beside fallen allies to revive"}</p>${uiActions(uiButton(waiting ? "Waiting for the team…" : "I’m ready", { kind: "primary", icon: waiting ? undefined : "battle", disabled: waiting, attrs: { id: "raid-instructions", "aria-label": waiting ? "Waiting for the team" : "I’m ready — start raid" } }))}`;
  } else if (state.phase === "intermission") {
    // Rites are chosen once, before the fight (RAID_RITE_PICKS each).
    const picked = Math.min(RAID_RITE_PICKS, (r.rites[me.id] ?? []).length);
    title = `Choose ${RAID_RITE_PICKS} rites · ${picked}/${RAID_RITE_PICKS}`;
    body = `<p class="raid-phase-objective">${raidChapters(r.boss)[r.phase - 1].detail}</p><details class="raid-team-summary"><summary>Team rites</summary><div class="raid-team-builds" aria-label="Team rites"></div></details>`;
    const offers = r.offers[me.id] ?? [];
    actions = `<div class="raid-rite-intro"><span>Grow stronger each chapter</span><span class="raid-choice-timer" role="timer" aria-label="Time left to choose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><span>Choose in</span><strong>${LIVE_SECONDS}</strong></span>${raidRiteDetails(offers)}</div><div class="raid-rite-options">${raidRiteChoices(offers)}</div>`;
  } else if (state.phase === "countdown") {
    title = LIVE_COUNTDOWN;
    body = `<p>${raidChapters(r.boss)[r.phase - 1].objective}</p>`;
  } else if (state.phase === "paused") {
    title = "A teammate disconnected";
    body = "<p>The raid is paused while they reconnect.</p>";
  } else if (state.phase === "finished") {
    title =
      r.result === "victory"
        ? `${RAID_BOSSES[r.boss].name} defeated!`
        : r.boss === "storm-twins"
          ? "The storm gathers again"
          : r.boss === "emberwing"
            ? "The sky still burns"
            : r.boss === "prismatail"
              ? "The heart stays shielded"
              : r.boss === "tidewyrm"
                ? "The tide keeps rising"
                : r.boss === "somnara"
                  ? "The dream drifts on"
                  : r.boss === "gloomshade"
                    ? "The night goes on"
                    : "The mountain still stands";
    const heroes = state.players.filter((p) => !p.raidBoss && !p.out);
    const readyCount = heroes.filter((p) => p.ready).length;
    const retryWait = me.ready || !heroes.every((p) => p.connected);
    actions = `<p class="ui-note rc-meta">${heroes.length === 1 ? "Same champion and challenge · choose fresh rites" : `${readyCount}/${heroes.length} ready · everyone confirms to run again`}</p>${uiActions(
      uiButton("Return to menu", {
        kind: "danger",
        icon: "home",
        attrs: { id: "raid-exit" },
      }),
      uiButton("Change setup", {
        icon: "swap",
        attrs: {
          id: "raid-lobby",
          "aria-label": "Change champion or challenge",
          title: "Change champion or challenge",
        },
      }),
      uiButton(me.ready ? "Waiting…" : "Run again", {
        kind: "primary",
        icon: me.ready ? undefined : "again",
        disabled: retryWait,
        attrs: {
          id: "raid-retry",
          "aria-label": me.ready ? "Waiting for the team" : "Run again",
        },
      }),
    )}`;
    // Saved state and the retry count share one bar under the scoreboard;
    // the next milestone lives in the Raid Hub (the reward reveal still runs).
    const saved =
      r.result === "victory"
        ? r.rewardStatus === "saved"
          ? "✓ Rewards saved to your account."
          : r.rewardStatus === "unavailable"
            ? "This clear could not be saved. Your reward progress has not been updated."
            : "Saving your rewards…"
        : r.rewardStatus === "saved"
          ? `✓ Progress saved: your ${r.boss === "tidewyrm" ? "strands" : r.boss === "gloomshade" ? "relights" : r.boss === "storm-twins" ? "polarity pairs" : r.boss === "emberwing" ? "braziers lit" : r.boss === "prismatail" ? "light relays" : r.boss === "somnara" ? "correct runes" : "pillars"} and revives count towards titles.`
          : "";
    body = `<div class="rc-summary"><span class="rc-art" aria-hidden="true"><svg viewBox="-65 -65 130 115">${raidGuideBossFor(r.boss)}</svg></span><div class="rc-stats"><span class="rc-stat"><b class="ui-num">${time(r.elapsed)}</b><small>${r.result === "victory" ? "Clear time" : "Time survived"}</small></span><span class="rc-stat"><b class="ui-num">${r.revives}</b><small>Revives</small></span><span class="rc-stat"><b class="ui-num">${r.downs}</b><small>Downs</small></span></div></div>${raidContributions(state, me.id)}${saved ? `<p class="rc-save${r.rewardStatus === "saved" ? " is-saved" : r.rewardStatus === "unavailable" ? " is-error" : ""}" role="status">${saved}</p>` : ""}${r.result === "victory" ? "" : `<p class="rc-tip">${defeatTip(state)}</p>`}${!heroes.every((p) => p.connected) ? '<p class="rc-tip">A teammate is disconnected. Return to the lobby to refill the party.</p>' : ""}`;
  }
  if (state.phase === "finished")
    body += resultXp(
      journey,
      r.resultId ? `raid:${r.resultId}` : undefined,
      state.activityStatus,
      state.activityEligible?.includes(me.id) ?? true,
    );
  const previousCard = overlay.querySelector<HTMLElement>(
    ".raid-overlay, .rc-card",
  );
  const guideExpanded =
    overlay.querySelector<HTMLDetailsElement>("#raid-briefing-extra")?.open ??
    false;
  const previousScroller =
    overlay.querySelector<HTMLElement>(".rc-body") ??
    overlay.querySelector<HTMLElement>(".panel-scroll") ??
    previousCard;
  const scrollTop =
    overlay.dataset.raidPhase === state.phase
      ? (previousScroller?.scrollTop ?? 0)
      : 0;
  const active = document.activeElement;
  const focusId = active && previousCard?.contains(active) ? active.id : "";
  // The briefing and the results use the hub's shared panel, tags and
  // buttons (UI remodel step 5); the rites, countdown and pause keep the
  // match's own card.
  const shared = state.phase === "briefing" || state.phase === "finished";
  const replaced = setOverlayMarkup(
    overlay,
    shared
      ? `<div class="ui rc-card ${state.phase === "finished" ? "is-results" : "is-briefing"}" role="dialog" aria-label="${escape(title)}"><header class="rc-head"><span class="ui-kicker">Boss raid · co-op</span><h2 class="ui-title">${title}</h2></header>${state.phase === "finished" ? `<div class="rc-body panel-scroll" tabindex="0" role="region" aria-label="Raid details">${body}</div>` : body}<footer class="rc-foot">${actions}</footer></div>`
      : `<div class="overlay-card raid-overlay${state.phase === "intermission" ? " raid-draft action-overlay" : ""}"><span class="eyebrow">Boss raid · co-op</span><h2>${title}</h2>${actions ? `<div class="panel-scroll" tabindex="0" role="region" aria-label="Raid details">${body}</div><div class="panel-actions">${actions}</div>` : body}</div>`,
  );
  overlay.dataset.raidPhase = state.phase;
  const card = overlay.querySelector<HTMLElement>(".raid-overlay, .rc-card");
  // Leave native touch scrolling alone while snapshots keep the same DOM.
  const scroller =
    overlay.querySelector<HTMLElement>(".rc-body") ??
    overlay.querySelector<HTMLElement>(".panel-scroll") ??
    card;
  if (replaced && guideExpanded) {
    const extra = overlay.querySelector<HTMLDetailsElement>(
      "#raid-briefing-extra",
    );
    if (extra) extra.open = true;
  }
  if (replaced && scroller) scroller.scrollTop = scrollTop;
  if (replaced && focusId) {
    const button = document.getElementById(focusId);
    if (button && card?.contains(button) && !button.hasAttribute("disabled"))
      button.focus({ preventScroll: true });
  }
  const builds = overlay.querySelector<HTMLElement>(".raid-team-builds");
  if (builds)
    setOverlayMarkup(
      builds,
      state.players
        .filter((p) => !p.raidBoss && !p.out)
        .map(
          (p) =>
            `<div><b>${escape(p.name)}</b><span>${(r.rites[p.id] ?? []).map((id) => RAID_RITES[id].name).join(" · ") || "Choosing rites"}${r.offers[p.id]?.length && r.rites[p.id]?.length ? " · Choosing…" : ""}</span></div>`,
        )
        .join(""),
    );
  fillLiveSeconds(overlay, state.remaining);
  if (state.phase === "countdown") fillLiveCountdown(overlay, state.remaining);
  overlay
    .querySelector(".raid-choice-timer")
    ?.classList.toggle("is-urgent", state.remaining <= 5);
  bindRaidRiteDetails(overlay);
  const ready = overlay.querySelector<HTMLButtonElement>("#raid-instructions");
  if (ready) ready.onclick = () => void request("instructions-ready");
  for (const b of Array.from(
    overlay.querySelectorAll<HTMLButtonElement>("[data-raid-rite]"),
  ))
    b.onclick = () => void request("rite", { id: b.dataset.raidRite });
  const retry = overlay.querySelector<HTMLButtonElement>("#raid-retry");
  if (retry) retry.onclick = () => void request("rematch");
  const lobby = overlay.querySelector<HTMLButtonElement>("#raid-lobby");
  if (lobby) lobby.onclick = () => void request("lobby");
}
export function drawRaidArena(
  g: Phaser.GameObjects.Graphics,
  state: Snapshot,
  reduced = false,
  clock = performance.now() / 1000,
  /**
   * Layers that sort with the fighters: `boss` for the boss (its depth is set
   * by the scene from where it stands), `at` for standing scenery (posts,
   * lanterns, braziers, mirrors) and for bosses with several bodies. On the
   * Coliseum court (`court`) broken pillars are rubble drawn by the scene.
   */
  layers?: { boss: Phaser.GameObjects.Graphics; at: LayerAt; court: boolean },
) {
  const r = state.raid;
  if (!r) return;
  const at = layers?.at;
  const tide = r.boss === "tidewyrm",
    gloom = r.boss === "gloomshade",
    dream = r.boss === "somnara";
  if (r.boss === "storm-twins") drawConductorRing(g, state, reduced, at, clock);
  if (r.boss === "emberwing") drawSkyTerrace(g, state, reduced, at);
  if (r.boss === "prismatail") drawSunAtrium(g, state, reduced, at);
  if (dream) drawCloudDeck(g, state, reduced);
  if (tide) drawLagoon(g, state, reduced);
  if (gloom) drawLanternYard(g, state, reduced, at, clock);
  for (const w of r.warnings) {
    if (r.boss === "storm-twins" && drawStormWarning(g, state, w)) continue;
    if (r.boss === "emberwing" && drawEmberwingWarning(g, state, w)) continue;
    if (r.boss === "prismatail" && drawPrismatailWarning(g, state, w)) continue;
    if (dream && drawSomnaraWarning(g, state, w, reduced)) continue;
    if (tide && drawTidewyrmWarning(g, state, w, reduced)) continue;
    if (gloom && drawGloomshadeWarning(g, state, w, reduced)) continue;
    const pulse = reduced ? 1 : 0.86 + Math.sin(state.time * 8) * 0.14;
    const danger = 0xff4059,
      edge = 0xff8c99;
    if (w.kind === "charge") {
      const target = state.players.find((p) => p.id === w.targetId && p.hp > 0);
      const locked = w.lockAt !== undefined && state.time >= w.lockAt;
      if (target) {
        const color = locked ? 0xff4059 : 0xffd982;
        g.lineStyle(3, color, 1).strokeCircle(target.x, target.y - 75, 16);
        g.lineStyle(3, color, 1)
          .lineBetween(
            target.x - 23,
            target.y - 75,
            target.x + 23,
            target.y - 75,
          )
          .lineBetween(target.x, target.y - 98, target.x, target.y - 52);
        if (locked)
          g.fillStyle(color, 1).fillCircle(target.x, target.y - 75, 5);
      }
      const dx = w.tx - w.x,
        dy = w.ty - w.y;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length,
        uy = dy / length;
      const nx = -uy * w.radius,
        ny = ux * w.radius;
      g.lineStyle(w.radius * 2, danger, 0.2 * pulse).lineBetween(
        w.x,
        w.y,
        w.tx,
        w.ty,
      );
      // Exact lane edges and chevrons remain legible without color perception.
      g.lineStyle(3, danger, 1)
        .lineBetween(w.x + nx, w.y + ny, w.tx + nx, w.ty + ny)
        .lineBetween(w.x - nx, w.y - ny, w.tx - nx, w.ty - ny);
      const flow = reduced ? 0 : (state.time * 85) % 90;
      for (let distance = 24 + flow; distance < length - 12; distance += 90) {
        const cx = w.x + ux * distance,
          cy = w.y + uy * distance;
        g.lineStyle(3, edge, 0.95)
          .lineBetween(
            cx - ux * 13 - uy * 15,
            cy - uy * 13 + ux * 15,
            cx + ux * 9,
            cy + uy * 9,
          )
          .lineBetween(
            cx + ux * 9,
            cy + uy * 9,
            cx - ux * 13 + uy * 15,
            cy - uy * 13 - ux * 15,
          );
      }
    } else if (w.kind === "volley") {
      // A cone of stones: exact edges plus stone ticks along the arc.
      const aim = Math.atan2(w.ty - w.y, w.tx - w.x),
        spread = w.spread ?? 0.45;
      g.fillStyle(danger, 0.16 * pulse)
        .slice(w.x, w.y, w.radius, aim - spread, aim + spread, false)
        .fillPath();
      g.lineStyle(4, danger, 1)
        .slice(w.x, w.y, w.radius, aim - spread, aim + spread, false)
        .strokePath();
      for (let i = -2; i <= 2; i++) {
        const a = aim + (spread * i) / 2.5;
        const rr = w.radius - 30;
        g.fillStyle(edge, 0.95).fillCircle(
          w.x + Math.cos(a) * rr,
          w.y + Math.sin(a) * rr,
          6,
        );
      }
    } else if (w.kind === "share") {
      // Shared meteor: gold while it follows (gather!), red once it locks.
      const locked = w.lockAt !== undefined && state.time >= w.lockAt;
      const solo = w.lockAt !== undefined;
      const gold = locked ? danger : 0xffd65b;
      g.fillStyle(gold, 0.16 * pulse).fillCircle(w.x, w.y, w.radius);
      g.lineStyle(4, gold, 1).strokeCircle(w.x, w.y, w.radius);
      if (!solo) {
        // Inward arrows: come here.
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          const ox = w.x + Math.cos(a) * (w.radius + 26),
            oy = w.y + Math.sin(a) * (w.radius + 26);
          const ix = w.x + Math.cos(a) * (w.radius + 8),
            iy = w.y + Math.sin(a) * (w.radius + 8);
          g.lineStyle(3, 0xffd65b, 1).lineBetween(ox, oy, ix, iy);
          g.fillStyle(0xffd65b, 1).fillTriangle(
            ix,
            iy,
            ix + Math.cos(a + 0.5) * 10,
            iy + Math.sin(a + 0.5) * 10,
            ix + Math.cos(a - 0.5) * 10,
            iy + Math.sin(a - 0.5) * 10,
          );
        }
        // One pip per raider standing in it (up to four).
        for (let i = 0; i < 4; i++)
          g.fillStyle(i < (w.sharers ?? 0) ? 0xffd65b : 0x3a3020, 1).fillCircle(
            w.x - 27 + i * 18,
            w.y - w.radius - 16,
            6,
          );
      } else if (locked)
        g.lineStyle(3, edge, 1)
          .lineBetween(w.x - 10, w.y - 10, w.x + 10, w.y + 10)
          .lineBetween(w.x + 10, w.y - 10, w.x - 10, w.y + 10);
    } else if (w.kind === "eruption") {
      // Orange vents, with a dot for each eruption still to come.
      const lava = 0xff8a3d;
      g.fillStyle(lava, 0.2 * pulse).fillCircle(w.x, w.y, w.radius);
      g.lineStyle(4, lava, 1).strokeCircle(w.x, w.y, w.radius);
      g.fillStyle(0xffc46b, 1).fillTriangle(
        w.x - 9,
        w.y + 8,
        w.x,
        w.y - 12,
        w.x + 9,
        w.y + 8,
      );
      for (let i = 0; i < (w.chain ?? 1) - 1; i++)
        g.fillStyle(lava, 1).fillCircle(
          w.x - 8 + i * 16,
          w.y + w.radius + 14,
          5,
        );
    } else {
      // Keep the boundary fixed at the server's damage radius; pulse opacity only.
      g.fillStyle(danger, 0.18 * pulse).fillCircle(w.x, w.y, w.radius);
      g.lineStyle(4, danger, 1).strokeCircle(w.x, w.y, w.radius);
      g.lineStyle(1, edge, 0.9).strokeCircle(
        w.x,
        w.y,
        Math.max(0, w.radius - 7),
      );
      g.lineStyle(3, edge, 1)
        .lineBetween(w.x - 8, w.y - 8, w.x + 8, w.y + 8)
        .lineBetween(w.x + 8, w.y - 8, w.x - 8, w.y + 8);
    }
    if (w.startedAt !== undefined) {
      const duration = Math.max(0.01, w.at - w.startedAt);
      const progress = Math.max(
        0,
        Math.min(1, (state.time - w.startedAt) / duration),
      );
      if (w.kind === "volley") {
        const aim = Math.atan2(w.ty - w.y, w.tx - w.x);
        g.lineStyle(5, 0xffd1d6, 0.95)
          .beginPath()
          .arc(
            w.x,
            w.y,
            w.radius * progress,
            aim - (w.spread ?? 0.45),
            aim + (w.spread ?? 0.45),
            false,
          )
          .strokePath();
      } else if (w.kind === "charge") {
        // A growing center stripe shows time remaining alongside the flowing arrows.
        g.lineStyle(5, edge, 0.65).lineBetween(
          w.x,
          w.y,
          w.x + (w.tx - w.x) * progress,
          w.y + (w.ty - w.y) * progress,
        );
      } else if (progress > 0) {
        g.lineStyle(5, 0xffd1d6, 0.95)
          .beginPath()
          .arc(
            w.x,
            w.y,
            Math.max(0, w.radius - 12),
            -Math.PI / 2,
            -Math.PI / 2 + progress * Math.PI * 2,
            false,
          )
          .strokePath();
      }
    }
  }
  if (tide) drawTideAttacks(g, state, reduced);
  for (const w of r.wards)
    g.lineStyle(3, 0x8beed2, 0.7).strokeCircle(w.x, w.y, 130);
  for (const p of state.players)
    if (r.downed[p.id]) {
      g.fillStyle(0x102d29, 0.95).fillCircle(p.x, p.y - 60, 20);
      g.lineStyle(5, 0x7dffb0, 1)
        .lineBetween(p.x - 10, p.y - 60, p.x + 10, p.y - 60)
        .lineBetween(p.x, p.y - 70, p.x, p.y - 50);
      g.lineStyle(4, 0x7dffb0, 0.7).strokeCircle(p.x, p.y, 70);
      g.lineStyle(7, 0x7dffb0, 1)
        .beginPath()
        .arc(
          p.x,
          p.y,
          74,
          -Math.PI / 2,
          -Math.PI / 2 + Math.max(0.01, r.downed[p.id].progress) * Math.PI * 2,
          false,
        )
        .strokePath();
    }
  for (const p of r.pillars)
    if (p.broken && !layers?.court) {
      g.fillStyle(0x21334e, 0.98).fillRoundedRect(
        p.x - 52,
        p.y - 72,
        104,
        144,
        12,
      );
      for (let i = 0; i < 5; i++)
        g.fillStyle(i % 2 ? 0x76859b : 0x485b75).fillTriangle(
          p.x - 40 + i * 16,
          p.y + 18,
          p.x - 28 + i * 16,
          p.y - 2 - (i % 2) * 10,
          p.x - 13 + i * 16,
          p.y + 25,
        );
    }
  if (r.closingRadius)
    g.lineStyle(6, 0xef6e7e, 0.7).strokeCircle(800, 450, r.closingRadius);
  // Team signals over raiders' heads.
  for (const ping of r.pings ?? []) {
    const p = state.players.find((q) => q.id === ping.playerId);
    if (!p || ping.until <= state.time) continue;
    const y = p.y - 112,
      bob = reduced ? 0 : Math.sin(state.time * 6) * 3;
    const color =
      ping.kind === "stack"
        ? 0xffd65b
        : ping.kind === "revive"
          ? 0x7dffb0
          : 0xffa94d;
    g.fillStyle(0x0c1b32, 0.92).fillCircle(p.x, y + bob, 18);
    g.lineStyle(3, color, 1).strokeCircle(p.x, y + bob, 18);
    if (ping.kind === "stack") {
      g.lineStyle(3, color, 1)
        .lineBetween(p.x, y + bob - 9, p.x, y + bob + 4)
        .lineBetween(p.x - 6, y + bob - 2, p.x, y + bob + 4)
        .lineBetween(p.x + 6, y + bob - 2, p.x, y + bob + 4)
        .lineBetween(p.x - 9, y + bob + 9, p.x + 9, y + bob + 9);
      // A ring on the ground: "here".
      g.lineStyle(2, color, 0.7).strokeEllipse(p.x, p.y + 14, 90, 34);
    } else if (ping.kind === "revive")
      g.lineStyle(4, color, 1)
        .lineBetween(p.x - 8, y + bob, p.x + 8, y + bob)
        .lineBetween(p.x, y + bob - 8, p.x, y + bob + 8);
    else {
      g.lineStyle(2.5, color, 1).strokeCircle(p.x, y + bob, 8);
      g.fillStyle(color, 1).fillCircle(p.x, y + bob, 3);
    }
  }
  // Single-bodied bosses draw on the boss layer; the twins and Gloomshade's
  // copies each get a layer of their own (their memory stays keyed on g).
  const boss = layers?.boss ?? g;
  drawBossBattleEffects(
    r.boss === "storm-twins" || gloom ? g : boss,
    state,
    reduced,
    clock,
  );
  if (r.boss === "storm-twins")
    return drawStormTwins(g, state, reduced, clock, at);
  if (r.boss === "emberwing") return drawEmberwing(boss, state, reduced, clock);
  if (r.boss === "prismatail")
    return drawPrismatail(boss, state, reduced, clock);
  if (dream) return drawSomnara(boss, state, reduced, clock);
  return tide
    ? drawTidewyrm(boss, state, reduced, clock)
    : gloom
      ? drawGloomshade(g, state, reduced, clock, at)
      : drawRaidBoss(boss, state, reduced, clock);
}

/** Why the run was lost, from what downed people most. */
function defeatTip(state: Snapshot) {
  const r = state.raid!;
  const causes = new Map<RaidAttack, number>();
  for (const d of Object.values(r.downed))
    if (d.cause) causes.set(d.cause, (causes.get(d.cause) ?? 0) + 1);
  const worst = [...causes].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (worst) return `${RAID_ATTACKS[worst].name}: ${RAID_ATTACKS[worst].tip}`;
  if (r.boss === "storm-twins")
    return "Lower both health bars before finishing either twin. Pair opposite Polarity signs, then finish both during the countdown.";
  if (r.boss === "emberwing")
    return "Light all three braziers together to ground Emberwing. Solo flames last longer. Spread out for Heat Marks and save ultimates for the open heart.";
  if (r.boss === "prismatail")
    return "Stand inside the skylight ring, connect to the mirror posts, and hit a mirror to turn its arrow. Save ultimates for the open heart.";
  if (r.boss === "somnara")
    return "Call the runes, then enter their pads in order. Jump the rings and pop Dream Bubbles before three Drowsy stacks put you to sleep.";
  if (r.boss === "gloomshade")
    return Object.values(r.contributions ?? {}).some((c) => c.pillars > 0)
      ? "Look for the one with a shadow in lantern light, then hit it six times in a row to expose its core."
      : "Relight dark lanterns with two hits: their light cleanses curses and shows which Gloomshade is real.";
  if (r.boss === "tidewyrm")
    return Object.values(r.contributions ?? {}).some((c) => c.pillars > 0)
      ? "Save ultimates for when it's stranded. Get onto an island as soon as the water's edge glows."
      : "When the ripple follows you, walk onto an island and step off just before it locks.";
  return Object.values(r.contributions ?? {}).some((c) => c.pillars > 0)
    ? "Save ultimates for the exposed core. Leave the slam circle if your jump is cooling down."
    : "Try lining up a pillar between you and the boss, then dodge when the charge locks.";
}
/** "What downed you": the attack and how to avoid it next time. */
export function downedCard(state: Snapshot, myId: string) {
  const r = state.raid!;
  const down = r.downed[myId];
  const percent = Math.max(
    0,
    Math.min(100, Math.round((down?.progress ?? 0) * 100)),
  );
  const head = down?.self ? "Self-revive" : percent > 0 ? "Reviving" : "Downed";
  const instruction = down?.self
    ? "Reviving automatically"
    : r.partySize > 1
      ? "Crawl toward an ally to revive"
      : "Waiting for raid result";
  const cause = down?.cause;
  const causeText = cause
    ? `Hit by ${RAID_ATTACKS[cause].name}`
    : r.closingRadius
      ? "Outside the closing ring"
      : "";
  const tip = cause
    ? RAID_ATTACKS[cause].tip
    : "Stay inside the shrinking ring.";
  return `<div class="raid-revive-head">${menuIcon("motion")}<b>${head}</b><span>${percent}%</span></div><div class="raid-revive-progress" role="progressbar" aria-label="Revive progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div><p class="raid-revive-instruction">${instruction}</p>${causeText ? `<small class="raid-revive-cause" title="${escape(tip)}">${escape(causeText)}</small>` : ""}`;
}
/** What the party's champions can do against this boss. */
function perkLines(state: Snapshot, myId: string) {
  const party = state.players.filter((p) => !p.raidBoss && !p.out);
  const lines = party
    .map((p) => {
      const perk = raidPerksOf(state.raid!.boss)[p.character];
      return perk
        ? `<li><b>${p.id === myId ? "You" : escape(p.name)} · ${CHARACTERS[p.character].name}</b> — ${perk.skill}: ${perk.text}</li>`
        : "";
    })
    .join("");
  return lines
    ? `<div class="raid-perks"><h3>Champion tricks</h3><ul>${lines}</ul></div>`
    : "";
}
/** Ping buttons (Stack, Revive, Bait) and the practice bar. */
function raidControls(
  state: Snapshot,
  me: Fighter,
  request: (event: string, data?: unknown) => Promise<unknown>,
) {
  const r = state.raid!;
  // The arena frame holds the game canvas (#game).
  const frame = document.getElementById("game")?.parentElement;
  if (!frame) return;
  renderSomnaraControls(state, me, frame, request);
  renderPrismatailControls(state, me, frame);
  renderStormTargets(state, frame);
  let pings = document.getElementById("raid-pings");
  if (!pings) {
    pings = document.createElement("div");
    pings.id = "raid-pings";
    pings.setAttribute("role", "group");
    pings.setAttribute("aria-label", "Team signals");
    frame.append(pings);
  }
  // The third signal changes meaning per boss ("Island here" on Tidewyrm).
  if (pings.dataset.boss !== r.boss) {
    pings.dataset.boss = r.boss;
    const buttons = (Object.keys(RAID_PINGS) as RaidPingKind[])
      .map(
        (kind) =>
          `<button type="button" data-raid-ping="${kind}" title="${raidPingLabel(kind, r.boss)} (${RAID_PINGS[kind].key})">${pingIcon(kind)}<span>${raidPingLabel(kind, r.boss)}</span></button>`,
      )
      .join("");
    pings.innerHTML = `<details class="raid-ping-menu" ${document.body.classList.contains("touch-mode") ? "" : "open"}><summary aria-label="Team signals" title="Team signals">${menuIcon("friends")}</summary><div class="raid-ping-options">${buttons}</div></details>`;
  }
  for (const b of Array.from(
    pings.querySelectorAll<HTMLButtonElement>("[data-raid-ping]"),
  ))
    b.onclick = () => {
      void request("raid-ping", { kind: b.dataset.raidPing });
      if (document.body.classList.contains("touch-mode"))
        pings!.querySelector<HTMLDetailsElement>("details")!.open = false;
    };
  const live = state.phase === "playing" || state.phase === "countdown";
  pings.hidden = !live || !!r.drill || r.partySize < 2;
  let drill = document.getElementById("raid-drill");
  if (!drill) {
    drill = document.createElement("div");
    drill.id = "raid-drill";
  }
  const battle = document.getElementById("battle");
  if (battle && drill.parentElement !== battle) battle.append(drill);
  drill.hidden = !r.drill;
  if (!r.drill) return;
  const host = state.players[0]?.id === me.id;
  const stats = `Dodged ${r.drillStats?.dodges ?? 0} · Hit ${r.drillStats?.hits ?? 0}`;
  const counter = drill.querySelector(".raid-drill-count");
  if (counter) counter.textContent = stats;
  const key = `${r.drill}|${host}`;
  if (drill.dataset.key === key) return;
  drill.dataset.key = key;
  const expanded =
    drill.querySelector<HTMLDetailsElement>("details")?.open ?? false;
  drill.innerHTML = `<div class="raid-drill-head"><b>Practice · ${RAID_ATTACKS[r.drill].name}</b><span class="raid-drill-count">${stats}</span></div><details class="raid-drill-picker"><summary>Change attack / instructions</summary><div class="raid-drill-body"><p>${escape(RAID_ATTACKS[r.drill].tip)}</p><div class="raid-drill-options">${raidAttacksOf(
    r.boss,
  )
    .map(
      (id) =>
        `<button type="button" class="${id === r.drill ? "is-active" : ""}" aria-pressed="${id === r.drill}" data-raid-drill="${id}" ${host ? "" : "disabled"}>${RAID_ATTACKS[id].name}</button>`,
    )
    .join(
      "",
    )}</div></div><button type="button" class="quiet leave-button" id="raid-drill-leave">${host ? iconLabel("leave", "Leave practice") : "Host ends practice"}</button></details>`;
  drill.querySelector<HTMLDetailsElement>("details")!.open = expanded;
  for (const b of Array.from(
    drill.querySelectorAll<HTMLButtonElement>("[data-raid-drill]"),
  ))
    b.onclick = () => void request("raid-drill", { kind: b.dataset.raidDrill });
  const leave = drill.querySelector<HTMLButtonElement>("#raid-drill-leave");
  if (leave) {
    leave.disabled = !host;
    leave.onclick = () => void request("raid-drill", { kind: null });
  }
}
export function pingIcon(kind: RaidPingKind) {
  const path =
    kind === "stack"
      ? '<path d="M12 4v7m-4-3 4 4 4-4M5 16a7 3 0 0 0 14 0"/>'
      : kind === "revive"
        ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>'
        : '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
