import { drawSunAtrium, drawPrismatailWarning, drawPrismatail } from "./raid-prismatail-art";
import { renderPrismatailControls } from "./prismatail-controls";
import { renderSomnaraControls } from "./somnara-controls";
import { drawCloudDeck, drawSomnaraWarning, drawSomnara } from "./raid-somnara-art";
import { buttonIcon, iconLabel, menuIcon } from "./menu-icons";
import {
  raidCue,
  raidContributions,
  raidGoals,
  raidRewardProgress,
} from "./raid-presentation";
import { raidDifficulty } from "./raid-difficulty";
import type Phaser from "phaser";
import {
  CHARACTERS,
  type Fighter,
  type Snapshot,
  type CharacterId,
} from "@arena/shared";
import {
  RAID,
  RAID_ATTACKS,
  raidAttacksOf,
  raidChapters,
  raidPerksOf,
  raidPingLabel,
  type RaidBossId,
  RAID_COSMETICS,
  RAID_PINGS,
  RAID_RITES,
  RAID_TRAITS,
  RAID_BOSSES,
  raidDay,
  raidLookOf,
  type RaidAttack,
  type RaidCosmetic,
  type RaidLoadout,
  type RaidPingKind,
  type RaidProgress,
  type RaidSlot,
} from "../../../packages/shared/src/raid";
import { raidGuideScene, raidGuideBossFor } from "./raid-guide-art";
import { raidRitePicture } from "./raid-rite-art";
import { drawRaidBoss } from "./raid-boss-art";
import { drawLagoon, drawTideAttacks, drawTidewyrm, drawTidewyrmWarning } from "./raid-tidewyrm-art";
import { drawGloomshade, drawGloomshadeWarning, drawLanternYard } from "./raid-gloomshade-art";
import { fighterAvatar } from "./fighter-art";
import { portraitAvatar, portraitCosmetics } from "./portraits";
import { LOOK_ITEMS } from "../../../packages/shared/src/shop";
import { setOverlayMarkup, LIVE_SECONDS, fillLiveSeconds } from "./overlay";
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
/** Host-only practice: pick one boss attack to repeat. */
function practicePicker(host: boolean, boss: RaidBossId) {
  return `<details class="raid-practice"><summary>Practice the boss's attacks</summary><p>The boss repeats one attack. Nobody gets hurt: hits and dodges are just counted.${host ? "" : " The host picks the attack."}</p><div class="raid-practice-options">${raidAttacksOf(boss).map((id) => `<button type="button" class="secondary" data-raid-drill="${id}" ${host ? "" : "disabled"}><b>${RAID_ATTACKS[id].name}</b><small>${RAID_ATTACKS[id].practice}</small></button>`).join("")}</div></details>`;
}
export function raidLobby(
  state: Snapshot,
  myId: string,
  selected?: CharacterId,
) {
  const r = state.raid!,
    host = state.players[0]?.id === myId;
  const me = state.players.find((p) => p.id === myId)!;
  const party = state.players
    .filter((p) => !p.raidBoss)
    .map((p) =>
      p.id === myId && selected ? { ...p, character: selected } : p,
    );
  const ready = party.filter((p) => p.ready).length;
  return `<div class="raid-lobby">
    <div class="raid-lobby-banner"><div><span class="eyebrow">Co-op raid · 1–4 players</span><h2>${RAID_BOSSES[r.boss].name}</h2><p>${RAID_BOSSES[r.boss].epithet}</p></div><svg viewBox="-65 -65 130 115" aria-hidden="true">${raidGuideBossFor(r.boss)}</svg></div>
    <div class="raid-invite"><div><span>Invite your party</span><b>${escape(state.code)}</b></div><button type="button" id="raid-copy-code" class="secondary" aria-label="Copy raid room code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg><span>Copy code</span></button></div>
    <section class="raid-party-section" aria-label="Raid party"><div class="raid-section-heading"><h3>Your party</h3><span>${ready}/${party.length} ready</span></div><div class="raid-party-list">${party.map((p) => `<div class="raid-party-member" data-raid-player="${escape(p.id)}"><span class="raid-party-avatar" data-raid-cosmetic="${portraitCosmetics(p)}">${portraitAvatar(p, "raid-lobby-" + p.id)}</span><div class="raid-party-identity"><b>${escape(p.name)}</b><span><span class="raid-player-character">${CHARACTERS[p.character].name}</span>${p.id === state.players[0]?.id ? " · Host" : ""}</span></div><span class="raid-ready-badge ${p.ready ? "is-ready" : ""}">${p.ready ? "Ready" : "Choosing"}</span></div>`).join("")}<div class="raid-open-slots">${Array.from({ length: Math.max(0, 4 - party.length) }, () => '<div class="raid-party-empty"><span aria-hidden="true">+</span>Open slot</div>').join("")}</div></div></section>
    <section class="raid-challenge" aria-label="Raid challenge"><div class="raid-section-heading"><h3>Choose your challenge</h3><span>${host ? "HOST CONTROLS" : "HOST SELECTS"}</span></div>${raidDifficulty(r.peril, !host || r.daily)}${raidDay().boss === r.boss ? `<label class="raid-weekly-option"><input id="raid-daily-toggle" type="checkbox" ${r.daily ? "checked" : ""} ${host ? "" : "disabled"}><span><b>Raid of the Day</b><small>Today's shared Peril 2 challenge · daily board</small></span></label>` : ""}<p class="raid-unlock-note">${r.daily ? (host ? "Uncheck Raid of the Day to choose a regular difficulty." : "The host can switch to a regular raid.") : "Clear a Peril to unlock the next difficulty."}</p></section>
    <div class="raid-lobby-rules"><span><svg class="raid-rule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10m-5-5h10"/></svg><span>${party.length === 1 ? (r.peril >= 3 ? "Peril 3 solo: no self-revive" : "One solo self-revive") : "Stand near allies to revive"}</span></span><span><svg class="raid-rule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 8 4v6c0 5-8 8-8 8s-8-3-8-8V7Z"/><path d="m8 12 3 3 5-6"/></svg><span>Separate from PvP rating</span></span></div>
    ${practicePicker(host, r.boss)}
    <div class="raid-lobby-actions"><button class="primary" id="ready"><span class="ready-label">${buttonIcon(me.ready ? "cancel" : "battle")}${me.ready ? "Cancel ready" : "Ready for the raid"}</span><span aria-hidden="true">${me.ready ? "" : "→"}</span></button><div><button class="secondary raid-icon-button" id="raid-bestiary">${menuIcon("bestiary")}<span>Raid Hub & rewards</span></button><button class="quiet leave-button" id="leave">${iconLabel("leave", "Leave room")}</button></div></div>
  </div>`;
}
const SLOT_NAMES: Record<RaidSlot, string> = {
  skin: "Skin",
  aura: "Aura",
  entrance: "Entrance",
  frame: "Portrait frame",
  victory: "Victory",
};
/** Appearance choices, one row of options per slot. Cosmetic only. */
export function raidCosmeticOptions(
  p: RaidProgress,
  character: CharacterId,
  shopOwned: string[] = [],
) {
  const look = raidLookOf(p);
  return (Object.keys(SLOT_NAMES) as RaidSlot[])
    .map((slot) => {
      const items: string[] = [
        ...(Object.keys(RAID_COSMETICS) as RaidCosmetic[]).filter(
          (id) => RAID_COSMETICS[id].slot === slot,
        ),
        // Shop collection pieces you own for this slot.
        ...LOOK_ITEMS.filter((i) => i.slot === slot && shopOwned.includes(i.id)).map((i) => i.id),
      ];
      const option = (id: string | null) => {
        const shop = id ? LOOK_ITEMS.find((i) => i.id === id) : undefined;
        const owned = id === null || !!shop || p.cosmetics.includes(id);
        const active = (look[slot] ?? null) === id;
        const info = shop
          ? { name: shop.name, description: shop.description, goal: "" }
          : id
            ? RAID_COSMETICS[id as RaidCosmetic]
            : null;
        const name = info?.name ?? (slot === "skin" ? "Original look" : slot === "victory" ? "Champion's own" : "None");
        const detail = info
          ? owned
            ? info.description
            : `Unlock: ${info.goal}`
          : slot === "skin"
            ? "Your champion's original colors"
            : slot === "victory"
              ? "Your champion's own celebration"
              : `No ${SLOT_NAMES[slot].toLowerCase()}`;
        return `<button class="secondary raid-cosmetic-option${active ? " is-equipped" : ""}" data-raid-slot="${slot}" data-raid-item="${id ?? ""}" data-raid-cosmetic="${id ?? ""}" ${!owned || active ? "disabled" : ""}><span class="raid-cosmetic-preview" data-cosmetic="${id ?? ""}" aria-hidden="true">${fighterAvatar(character, `cosmetic-${slot}-${id ?? "none"}`)}</span><span><b>${name}</b><small>${detail}</small></span><span class="raid-cosmetic-state">${active ? "✓ Equipped" : owned ? (id === null ? "Clear" : "Equip") : "Locked"}</span></button>`;
      };
      return `<div class="raid-slot"><h4>${SLOT_NAMES[slot]}</h4>${[null, ...items].map(option).join("")}</div>`;
    })
    .join("");
}
/** The appearance picker shown on a boss's Rewards tab. */
export function raidAppearance(
  p: RaidProgress,
  character: CharacterId = "voltkit",
  shopOwned: string[] = [],
) {
  return `<h3>Fighter appearance</h3><p class="raid-appearance-note">Pick a skin, aura, entrance, frame and victory separately. They show on all your fighters in PvP and raids (a champion skin from the Shop wins over the Skin slot). Shop collection pieces you own appear here too. Appearance only, no stat changes. Previewing ${CHARACTERS[character].name}.</p>${p.loadout && "victory" in p.loadout ? "" : '<p class="raid-appearance-note raid-update-needed">Saving every slot needs the latest database update: run migration 018_collection_equipping.sql in Supabase.</p>'}<div class="raid-equip">${raidCosmeticOptions(p, character, shopOwned)}</div><p class="raid-appearance-status" role="status"></p>`;
}
const resultProgress = new WeakMap<
  HTMLElement,
  { id: string; progress?: RaidProgress | null }
>();
export function renderRaidUI(
  state: Snapshot,
  me: Fighter,
  request: (event: string, data?: unknown) => Promise<unknown>,
  loadProgress?: () => Promise<RaidProgress>,
) {
  const r = state.raid!,
    boss = state.players.find((p) => p.id === r.bossId);
  let hud = document.getElementById("raid-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "raid-hud";
    document.getElementById("battle")!.prepend(hud);
  }
  const charge = r.warnings.find((w) => w.kind === "charge" || w.kind === "dive");
  const meteor = r.warnings.find((w) => w.kind === "share");
  const erupting = r.warnings.find((w) => w.kind === "eruption");
  const sealed = (id: string) => r.prisons?.some((q) => q.playerId === id);
  raidControls(state, me, request);
  const targetLocked =
    charge?.lockAt !== undefined && state.time >= charge.lockAt;
  const healthPercent = Math.max(
    0,
    Math.min(100, ((boss?.hp ?? 0) / r.maxHp) * 100),
  );
  hud.innerHTML = `<div class="raid-boss-heading"><b>${r.gilded ? "✦ GILDED " : ""}${RAID_BOSSES[r.boss].name.toUpperCase()}</b>${r.daily ? '<em class="raid-daily-badge">RAID OF THE DAY</em>' : ""}<span>PERIL ${r.peril} · PHASE ${r.phase}/3</span></div><div class="raid-boss-health" role="progressbar" aria-label="Boss health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(healthPercent)}" aria-valuetext="${Math.round(healthPercent)}% health. Rite choices open at 67% and 33% health."><i style="width:${healthPercent}%"></i>${[67, 33].map((mark, index) => `<span class="raid-health-mark${r.phase > index + 1 ? " is-passed" : ""}" style="left:${mark}%" aria-hidden="true"></span>`).join("")}</div><div class="raid-stagger"><i style="width:${r.boss === "prismatail" ? (r.exposedUntil > state.time ? 100 : Math.min(100,(r.lightHold ?? 0) / (r.phase === 3 && r.partySize === 1 ? 2 : .65) * 100)) : r.staggerUntil > state.time ? 100 : r.stagger}%"></i><span>${r.boss === "prismatail" ? (r.exposedUntil > state.time ? "HEART EXPOSED" : "LIGHT RELAY · SHIELDED") : r.staggerUntil > state.time ? "STAGGER · CORE EXPOSED" : "STAGGER"}</span></div><div class="raid-party-bars" data-party-size="${state.players.filter((p) => !p.raidBoss && !p.out).length}">${state.players
    .filter((p) => !p.raidBoss)
    .map(
      (p) =>
        `<span class="${p.hp <= 0 ? "downed" : charge?.targetId === p.id || meteor?.targetId === p.id ? "is-targeted" : ""}"><b>${escape(p.name)}${r.standIns?.includes(p.id) ? " · AI" : ""}</b><i style="--hp:${Math.max(0, (p.hp / CHARACTERS[p.character].health) * 100)}%"></i><small>${p.out ? "LEFT" : p.hp <= 0 ? `DOWN · ${Math.round((r.downed[p.id]?.progress ?? 0) * 100)}%` : sealed(p.id) ? (r.partySize > 1 ? "TRAPPED · POP IT" : "TRAPPED · MASH") : charge?.targetId === p.id ? (charge.kind === "dive" ? (targetLocked ? "LOCKED · STEP OFF" : "RIPPLE · ISLAND") : targetLocked ? "LOCKED · DODGE" : "TARGET · BAIT") : meteor?.targetId === p.id ? (meteor.lockAt !== undefined ? "METEOR · DODGE" : "METEOR · STACK") : erupting?.targetId === p.id ? "ERUPTING · RUN" : `${Math.ceil(p.hp)} HP`}</small></span>`,
    )
    .join(
      "",
    )}</div><div class="raid-status-row"><p class="raid-callout" role="status">${escape(raidCue(state, me.id))}</p><div class="raid-elapsed" role="timer" aria-label="Raid elapsed time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><b>${time(r.elapsed)}</b></div></div>`;
  const overlay = document.getElementById("arena-overlay")!;
  let progress = resultProgress.get(overlay);
  if (
    state.phase === "finished" &&
    r.rewardStatus === "saved" &&
    loadProgress
  ) {
    const id = `${me.id}:${r.resultId ?? r.seed}`;
    if (progress?.id !== id) {
      progress = { id };
      resultProgress.set(overlay, progress);
      const pending = progress;
      void loadProgress()
        .then((value) => {
          pending.progress = value;
        })
        .catch(() => {
          pending.progress = null;
        });
    }
  } else {
    resultProgress.delete(overlay);
    progress = undefined;
  }
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
    if (me.hp <= 0) banner.innerHTML = downedCard(state, me.id);
    return;
  }
  overlay.style.pointerEvents = "auto";
  let title = "",
    body = "",
    actions = "";
  if (state.phase === "briefing") {
    title = `${RAID_TRAITS[r.trait].name} ${RAID_BOSSES[r.boss].name}`;
    const guide =
      r.boss === "prismatail"
        ? `<span>${raidGuideScene("relay", me.character)}<b>Carry the light</b><small>Skylight → raider → mirror posts → heart. Follow the gold beams.</small></span><span>${raidGuideScene("mirror", me.character)}<b>Turn the mirrors</b><small>Hit a post to turn its arrow 45°. A connected chain opens the shield.</small></span><span>${raidGuideScene("glare", me.character)}<b>Watch the crest</b><small>Step out of its numbered fan cone. Aim away from Glare, or hold Look away.</small></span>`
        : r.boss === "somnara"
        ? `<span>${raidGuideScene("dream", me.character)}<b>Call the dream</b><small>Only the Dreamer sees it. Call runes with 1–4 or the rune bar.</small></span><span>${raidGuideScene("runes", me.character)}<b>Step the pads in order</b><small>Enter a matching pad for each rune. Solve it to expose Somnara.</small></span><span>${raidGuideScene("quiet", me.character)}<b>Stay awake</b><small>Jump rings, pop bubbles and follow the moving Quiet Zone.</small></span>`
        : r.boss === "gloomshade"
        ? `<span>${raidGuideScene("lantern", me.character)}<b>Keep the lights on</b><small>Hit a dark lantern twice. Light cleanses curses.</small></span><span>${raidGuideScene("shadow", me.character)}<b>Find the real one</b><small>Only it casts a shadow in light. Copies curse you.</small></span><span>${raidGuideScene("curse", me.character)}<b>Spread out</b><small>Curses jump to anyone close. Three makes you Haunted.</small></span>`
        : r.boss === "tidewyrm"
        ? `<span>${raidGuideScene("strand", me.character)}<b>Strand it</b><small>Lead the dive ripple onto an island, then step off.</small></span><span>${raidGuideScene("tide", me.character)}<b>Share the islands</b><small>High Tide floods the floor: two to an island.</small></span><span>${raidGuideScene("prison", me.character)}<b>Pop the bubble</b><small>Three hits free a trapped friend. Alone, mash attack.</small></span>`
        : `<span>${raidGuideScene("charge", me.character)}<b>Bait the charge</b><small>Lure the boss into a stone pillar.</small></span><span>${raidGuideScene("core", me.character)}<b>Strike the core</b><small>Armor breaks. Unleash your ultimate.</small></span><span>${raidGuideScene("revive", me.character)}<b>Revive together</b><small>Stand beside a fallen ally to revive.</small></span>`;
    body = `<div class="raid-briefing-body" tabindex="0" role="region" aria-label="Raid instructions"><p>${escape(RAID_TRAITS[r.trait].text)}</p><div class="raid-instructions">${guide}</div>${perkLines(state, me.id)}${r.partySize > 1 ? `<p class="raid-signals">Team signals: ${(Object.keys(RAID_PINGS) as RaidPingKind[]).map((k) => `<b>${RAID_PINGS[k].key}</b> ${raidPingLabel(k, r.boss)}`).join(" · ")} (or the buttons on the left)</p>` : ""}<p>Three phases · one shared fight · ${r.partySize === 1 ? (r.peril >= 3 ? "no self-revive on Peril 3" : "one solo self-revive") : "no required healer"} · no PvP rating changes.</p></div><div class="raid-briefing-actions"><button class="primary" id="raid-instructions" ${state.instructionsReady.includes(me.id) ? "disabled" : ""}>${state.instructionsReady.includes(me.id) ? "Waiting for the team…" : iconLabel("battle", "Let’s raid")}</button></div>`;
  } else if (state.phase === "intermission") {
    title =
      r.phase === 1
        ? "Choose your starting rite"
        : `Phase ${r.phase} · ${raidChapters(r.boss)[r.phase - 1].name}`;
    body = `<p class="raid-phase-objective">${raidChapters(r.boss)[r.phase - 1].detail}</p><details class="raid-team-summary"><summary>Team rites</summary><div class="raid-team-builds" aria-label="Team rites"></div></details>`;
    actions = `<p class="raid-rite-intro"><span>Rites stack for this run.</span><span class="raid-choice-timer" role="timer" aria-label="Time left to choose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><span>Choose in</span><strong>${LIVE_SECONDS}</strong></span></p><div class="raid-rite-options">${(r.offers[me.id] ?? []).map((id) => `<button data-raid-rite="${id}" class="secondary raid-rite-${id}">${raidRitePicture(id)}<span class="raid-rite-copy"><b>${RAID_RITES[id].name}</b><small>${RAID_RITES[id].text}</small></span></button>`).join("") || "<p>Rite locked in · waiting for the team.</p>"}</div>`;
  } else if (state.phase === "countdown") {
    title = String(Math.ceil(state.remaining));
    body = `<p>${raidChapters(r.boss)[r.phase - 1].objective}</p>`;
  } else if (state.phase === "paused") {
    title = "A teammate disconnected";
    body = "<p>The raid is paused while they reconnect.</p>";
  } else if (state.phase === "finished") {
    title =
      r.result === "victory"
        ? `${RAID_BOSSES[r.boss].name} defeated!`
        : r.boss === "tidewyrm"
          ? "The tide keeps rising"
          : r.boss === "somnara" ? "The dream drifts on"
          : r.boss === "gloomshade"
            ? "The night goes on"
            : "The mountain still stands";
    const heroes = state.players.filter((p) => !p.raidBoss && !p.out);
    const readyCount = heroes.filter((p) => p.ready).length;
    actions = `<div class="result-actions raid-result-actions"><button class="primary" id="raid-retry" ${me.ready || !heroes.every((p) => p.connected) ? "disabled" : ""}>${me.ready ? "Waiting for the team…" : iconLabel("again", "Run again")}</button><button class="secondary" id="raid-lobby">${iconLabel("swap", "Change champion / challenge")}</button><button class="secondary raid-icon-button" id="raid-rewards">${menuIcon("bestiary")}<span>Raid Hub & rewards</span></button><button class="quiet" id="raid-exit">${iconLabel("home", "Return to menu")}</button></div>`;
    body = `<div class="raid-result-summary"><div class="raid-result-art" aria-hidden="true"><svg viewBox="-65 -65 130 115">${raidGuideBossFor(r.boss)}</svg></div><div class="raid-result-stats"><span><b>${time(r.elapsed)}</b>${r.result === "victory" ? "Clear time" : "Time survived"}</span><span><b>${r.revives}</b>Revives</span><span><b>${r.downs}</b>Downs</span></div></div><div class="raid-result-body">${raidContributions(state)}<div class="raid-result-next">${
      r.result === "victory"
        ? `<p class="raid-save-state" role="status">${r.rewardStatus === "saved" ? "✓ Rewards saved to your account." : r.rewardStatus === "unavailable" ? "This clear could not be saved. Your reward progress has not been updated." : "Saving your rewards…"}</p>${r.rewardStatus === "saved" ? raidRewardProgress(loadProgress ? progress?.progress : null, r.boss) : ""}<p class="raid-next-challenge">${r.peril < 3 ? `Next challenge: Peril ${r.peril + 1} · ${r.boss === "prismatail" ? (r.peril === 1 ? "Stronger light attacks" : "Faster attacks and no solo self-revive") : r.boss === "somnara" ? (r.peril === 1 ? "Longer rune sequences" : "Backwards dreams and faster attacks") : r.boss === "tidewyrm" ? (r.peril === 1 ? "Shorter strands, harder hits" : "Islands sink for good") : r.boss === "gloomshade" ? (r.peril === 1 ? "Faster hands and more copies" : "Paired pulses and shifting tiles") : r.peril === 1 ? "Falling debris" : "Closing arena"}` : "Next challenge: a no-downs clear or the Raid of the Day."}</p>`
        : `${r.rewardStatus === "saved" ? `<p class="raid-save-state" role="status">✓ Progress saved: your ${r.boss === "tidewyrm" ? "strands" : r.boss === "gloomshade" ? "relights" : r.boss === "prismatail" ? "light relays" : r.boss === "somnara" ? "correct runes" : "pillars"} and revives count towards titles.</p>` : ""}<p class="raid-retry-tip">${defeatTip(state)}</p>`
    }<div class="raid-retry-status">${heroes.length === 1 ? "Same champion and challenge · choose fresh rites" : `${readyCount}/${heroes.length} ready · everyone confirms to run again`}</div>${!heroes.every((p) => p.connected) ? '<p class="raid-retry-tip">A teammate is disconnected. Return to the lobby to refill the party.</p>' : ""}</div></div>`;
  }
  const previousCard = overlay.querySelector<HTMLElement>(".raid-overlay");
  const previousScroller =
    overlay.querySelector<HTMLElement>(".raid-briefing-body") ??
    overlay.querySelector<HTMLElement>(".panel-scroll") ?? previousCard;
  const scrollTop =
    overlay.dataset.raidPhase === state.phase
      ? (previousScroller?.scrollTop ?? 0)
      : 0;
  const active = document.activeElement;
  const focusId = active && previousCard?.contains(active) ? active.id : "";
  const replaced = setOverlayMarkup(
    overlay,
    `<div class="overlay-card raid-overlay${state.phase === "finished" ? " raid-results action-overlay" : state.phase === "intermission" ? " raid-draft action-overlay" : state.phase === "briefing" ? " raid-briefing" : ""}"><span class="eyebrow">Boss raid · co-op</span><h2>${title}</h2>${actions ? `<div class="panel-scroll" tabindex="0" role="region" aria-label="Raid details">${body}</div><div class="panel-actions">${actions}</div>` : body}</div>`,
  );
  overlay.dataset.raidPhase = state.phase;
  const card = overlay.querySelector<HTMLElement>(".raid-overlay");
  // Leave native touch scrolling alone while snapshots keep the same DOM.
  const scroller = overlay.querySelector<HTMLElement>(".raid-briefing-body") ??
    overlay.querySelector<HTMLElement>(".panel-scroll") ?? card;
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
            `<div><b>${escape(p.name)}</b><span>${(r.rites[p.id] ?? []).map((id) => RAID_RITES[id].name).join(" · ") || "Choosing a starting rite"}${r.offers[p.id]?.length && r.rites[p.id]?.length ? " · Choosing…" : ""}</span></div>`,
        )
        .join(""),
    );
  fillLiveSeconds(overlay, state.remaining);
  overlay
    .querySelector(".raid-choice-timer")
    ?.classList.toggle("is-urgent", state.remaining <= 5);
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
) {
  const r = state.raid;
  if (!r) return;
  const tide = r.boss === "tidewyrm",
    gloom = r.boss === "gloomshade",
    dream = r.boss === "somnara";
  if (r.boss === "prismatail") drawSunAtrium(g, state, reduced);
  if (dream) drawCloudDeck(g, state, reduced);
  if (tide) drawLagoon(g, state, reduced);
  if (gloom) drawLanternYard(g, state, reduced);
  for (const w of r.warnings) {
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
        g.fillStyle(lava, 1).fillCircle(w.x - 8 + i * 16, w.y + w.radius + 14, 5);
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
    if (p.broken) {
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
      ping.kind === "stack" ? 0xffd65b : ping.kind === "revive" ? 0x7dffb0 : 0xffa94d;
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
  if (r.boss === "prismatail") return drawPrismatail(g, state, reduced, clock);
  if (dream) return drawSomnara(g, state, reduced, clock);
  return tide
    ? drawTidewyrm(g, state, reduced, clock)
    : gloom
      ? drawGloomshade(g, state, reduced, clock)
      : drawRaidBoss(g, state, reduced, clock);
}

/** Why the run was lost, from what downed people most. */
function defeatTip(state: Snapshot) {
  const r = state.raid!;
  const causes = new Map<RaidAttack, number>();
  for (const d of Object.values(r.downed))
    if (d.cause) causes.set(d.cause, (causes.get(d.cause) ?? 0) + 1);
  const worst = [...causes].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (worst) return `${RAID_ATTACKS[worst].name}: ${RAID_ATTACKS[worst].tip}`;
  if (r.boss === "prismatail") return "Stand inside the skylight ring, connect to the mirror posts, and hit a mirror to turn its arrow. Save ultimates for the open heart.";
  if (r.boss === "somnara") return "Call the runes, then enter their pads in order. Jump the rings and pop Dream Bubbles before three Drowsy stacks put you to sleep.";
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
  const head = down?.self
    ? "One self-revive charging…"
    : "Downed · crawl toward allies. Teammates revive by standing nearby.";
  const cause = down?.cause;
  if (!cause)
    return r.closingRadius
      ? `<b>${head}</b><small>The closing arena: stay inside the shrinking ring.</small>`
      : `<b>${head}</b>`;
  return `<b>${head}</b><small><b>${RAID_ATTACKS[cause].name}</b> · ${escape(RAID_ATTACKS[cause].tip)}</small>`;
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
    pings.innerHTML = (Object.keys(RAID_PINGS) as RaidPingKind[])
      .map(
        (kind) =>
          `<button type="button" data-raid-ping="${kind}" title="${raidPingLabel(kind, r.boss)} (${RAID_PINGS[kind].key})">${pingIcon(kind)}<span>${raidPingLabel(kind, r.boss)}</span></button>`,
      )
      .join("");
  }
  for (const b of Array.from(
    pings.querySelectorAll<HTMLButtonElement>("[data-raid-ping]"),
  ))
    b.onclick = () => void request("raid-ping", { kind: b.dataset.raidPing });
  const live = state.phase === "playing" || state.phase === "countdown";
  pings.hidden = !live || !!r.drill || r.partySize < 2;
  let drill = document.getElementById("raid-drill");
  if (!drill) {
    drill = document.createElement("div");
    drill.id = "raid-drill";
    frame.append(drill);
  }
  drill.hidden = !r.drill;
  if (!r.drill) return;
  const host = state.players[0]?.id === me.id;
  const key = `${r.drill}|${host}|${r.drillStats?.hits}|${r.drillStats?.dodges}`;
  if (drill.dataset.key === key) return;
  drill.dataset.key = key;
  drill.innerHTML = `<div class="raid-drill-head"><b>Practice · ${RAID_ATTACKS[r.drill].name}</b><span>Dodged ${r.drillStats?.dodges ?? 0} · Hit ${r.drillStats?.hits ?? 0}</span></div><p>${escape(RAID_ATTACKS[r.drill].tip)}</p><div class="raid-drill-options">${raidAttacksOf(r.boss).map((id) => `<button type="button" class="${id === r.drill ? "is-active" : ""}" data-raid-drill="${id}" ${host ? "" : "disabled"}>${RAID_ATTACKS[id].name}</button>`).join("")}<button type="button" class="quiet leave-button" id="raid-drill-leave">${host ? iconLabel("leave", "Leave practice") : "Host ends practice"}</button></div>`;
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
