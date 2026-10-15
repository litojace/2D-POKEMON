import type Phaser from "phaser";
import { CHARACTERS, type Fighter, type Snapshot } from "@arena/shared";
import {
  RAID,
  RAID_RITES,
  RAID_TRAITS,
  raidWeekly,
  type RaidProgress,
} from "../../../packages/shared/src/raid";
import { raidGuideScene, raidGuideBoss } from "./raid-guide-art";
import { raidRitePicture } from "./raid-rite-art";
import { drawRaidBoss } from "./raid-boss-art";
import { fighterAvatar } from "./fighter-art";
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
export function raidLobby(state: Snapshot, myId: string) {
  const r = state.raid!,
    host = state.players[0]?.id === myId;
  const me = state.players.find((p) => p.id === myId)!;
  const party = state.players.filter((p) => !p.raidBoss);
  const ready = party.filter((p) => p.ready).length;
  return `<div class="raid-lobby">
    <div class="raid-lobby-banner"><div><span class="eyebrow">CO-OP RAID · 1–4 PLAYERS</span><h2>Grumblecrag</h2><p>The living mountain</p></div><svg viewBox="-65 -65 130 115" aria-hidden="true">${raidGuideBoss()}</svg></div>
    <div class="raid-invite"><div><span>INVITE YOUR PARTY</span><b>${escape(state.code)}</b></div><button type="button" id="raid-copy-code" class="secondary" aria-label="Copy raid room code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg><span>Copy code</span></button></div>
    <section class="raid-party-section" aria-label="Raid party"><div class="raid-section-heading"><h3>Your party</h3><span>${ready}/${party.length} ready</span></div><div class="raid-party-list">${party.map((p) => `<div class="raid-party-member">${fighterAvatar(p.character, "raid-lobby-" + p.id)}<div class="raid-party-identity"><b>${escape(p.name)}</b><span>${CHARACTERS[p.character].name}${p.id === state.players[0]?.id ? " · Host" : ""}</span></div><span class="raid-ready-badge ${p.ready ? "is-ready" : ""}">${p.ready ? "Ready" : "Choosing"}</span></div>`).join("")}<div class="raid-open-slots">${Array.from({ length: Math.max(0, 4 - party.length) }, () => '<div class="raid-party-empty"><span aria-hidden="true">+</span>Open slot</div>').join("")}</div></div></section>
    <section class="raid-challenge" aria-label="Raid challenge"><div class="raid-section-heading"><h3>Choose your challenge</h3><span>${host ? "HOST CONTROLS" : "HOST SELECTS"}</span></div><label class="raid-peril-label" for="raid-peril">Difficulty</label><div class="raid-select-wrap"><select id="raid-peril" ${host && !r.weekly ? "" : "disabled"}>${[1, 2, 3].map((p) => `<option value="${p}" ${p === r.peril ? "selected" : ""}>Peril ${p} · ${["Learn the mountain", "Falling debris", "Closing arena"][p - 1]}</option>`).join("")}</select><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg></div><label class="raid-weekly-option"><input id="raid-weekly" type="checkbox" ${r.weekly ? "checked" : ""} ${host ? "" : "disabled"}><span><b>Raid of the Week</b><small>Shared Peril 2 challenge · weekly leaderboard</small></span></label><p class="raid-unlock-note">Clear a Peril to unlock the next difficulty.</p></section>
    <div class="raid-lobby-rules"><span><svg class="raid-rule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10m-5-5h10"/></svg><span>${party.length === 1 ? "One solo self-revive" : "Stand near allies to revive"}</span></span><span><svg class="raid-rule-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 8 4v6c0 5-8 8-8 8s-8-3-8-8V7Z"/><path d="m8 12 3 3 5-6"/></svg><span>Separate from PvP rating</span></span></div>
    <div class="raid-lobby-actions"><button class="primary" id="ready">${me.ready ? "Cancel ready" : "Ready for the raid"}<span aria-hidden="true">${me.ready ? "×" : "→"}</span></button><div><button class="secondary" id="raid-bestiary">Bestiary & rewards</button><button class="quiet" id="leave">Leave room</button></div></div>
  </div>`;
}
export function raidBestiary(p: RaidProgress & { equipped?: string | null }) {
  return `<div class="eyebrow">BOSS BESTIARY</div><h2>Grumblecrag</h2><div class="raid-bestiary-art" aria-hidden="true"><svg viewBox="0 0 300 220" width="240" height="176"><ellipse cx="150" cy="193" rx="111" ry="21" fill="#070e1e" opacity=".5"/><g stroke="#202e43" stroke-width="4" stroke-linejoin="round"><path d="m81 176-16 19 14 12 48-2 4-25m88-4 16 19-14 12-48-2-4-25" fill="#52657b"/><path d="m76 67 25-29 73-6 49 37-3 88-39 35-73-7-35-43Z" fill="#52657b"/><path d="m76 67 25-29 73-6 49 37-57 10-63-1Z" fill="#8a9eb1"/><path d="m96 92 30-12 57 3 23 32-20 58-39 13-44-23Z" fill="#202e43"/><path d="m19 121 14-32 29-3 25 22-6 63-32 13-29-22Zm199-13 23-25 32 7 13 32-3 43-30 17-33-17Z" fill="#52657b"/><path d="m19 121 14-32 29-3 25 22-31 5Zm199-13 23-25 32 7 13 32-33-8Z" fill="#8a9eb1"/><path d="m52 76 2-38 19-27 17 53-10 20Zm148-13 16-58 23 30-2 44Zm35 5 16-33 13 35-11 18Z" fill="#ffce75"/><path d="m54 38 19-27-1 57-20 8Zm162-33 0 56-16 2Z" fill="#b6c6d1"/><path d="m103 61 24-19 43 0 28 23-9 39-45 9-40-17Z" fill="#202e43"/><path d="m103 61 24-19 43 0 28 23-48-6-12 13Z" fill="#8a9eb1"/><path d="m117 77 20 6-1 7-19-3Zm43 6 21-7-1 10-20 4Z" fill="#ffce75" stroke="none"/><path d="m121 103 23 7 31-8-13 20-26-1Z" fill="#52657b"/><path d="m149 121 24 18-4 25-21 17-21-19-2-26Z" fill="#8a9eb1"/><path d="m149 128 16 15-4 17-13 13-14-16 0-17Z" fill="#ffce75"/><path d="m149 128-1 45-14-16v-17Z" fill="#fff0bc" stroke="none"/><path d="m105 120 10 13-5 15m79-31-10 17 7 12M43 131l6 13-6 16m218-32-8 16 6 12" fill="none" stroke="#ffce75" stroke-width="2"/></g></svg><b>THE LIVING MOUNTAIN</b></div><p>A guardian of the old coliseum. Its rage is its weakness: bait a charge into a pillar to crack its armor.</p><div class="fighter-stats"><span><b>${p.clears}</b>Clears</span><span><b>${p.highestPeril}</b>Highest Peril</span><span><b>${p.bestSeconds === null ? "—" : time(p.bestSeconds)}</b>Best clear</span></div><h3>Your next rewards</h3><div class="raid-rewards"><p>${p.clears ? "✓" : "○"} First clear → <b>Cragbreaker title</b></p><p>${p.clears >= 5 ? "✓" : "○"} ${Math.min(p.clears, 5)}/5 clears → <b>Cragbound color variant</b></p><p>${p.highestPeril >= 3 ? "✓" : "○"} Peril 3 → <b>Mountain Conqueror title</b></p><p>${p.cosmetics.includes("mountain-aura") ? "✓" : "○"} Peril 3 with no downs → <b>Mountain aura</b></p><p>A rare Gilded encounter grants its own title. All other rewards have guaranteed goals.</p></div><h3>Equip a cosmetic</h3><div class="raid-equip">${[null, ...p.cosmetics].map((id) => `<button class="secondary" data-raid-cosmetic="${id ?? ""}" ${p.equipped == id ? "disabled" : ""}>${id === "cragbound" ? "Cragbound colors" : id === "mountain-aura" ? "Mountain aura" : "Original appearance"}</button>`).join("")}</div><h3>Raid of the Week · ${raidWeekly().week}</h3><p>Same boss, trait, seed and Peril for everyone. Times are separated by team size.</p>${[
    1, 2, 3, 4,
  ]
    .map(
      (size) =>
        `<details class="raid-board"><summary>${size === 1 ? "Solo" : size + " players"}</summary>${
          p.weekly
            .filter((row) => row.partySize === size)
            .slice(0, 10)
            .map(
              (row, i) =>
                `<p><b>#${i + 1} · ${time(row.seconds)}</b> ${row.names.map(escape).join(" + ")}</p>`,
            )
            .join("") || "<p>No clears in this bracket yet.</p>"
        }</details>`,
    )
    .join("")}`;
}
export function renderRaidUI(
  state: Snapshot,
  me: Fighter,
  request: (event: string, data?: unknown) => Promise<unknown>,
) {
  const r = state.raid!,
    boss = state.players.find((p) => p.id === r.bossId);
  let hud = document.getElementById("raid-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "raid-hud";
    document.getElementById("battle")!.prepend(hud);
  }
  hud.innerHTML = `<div class="raid-boss-heading"><b>${r.gilded ? "✦ GILDED " : ""}GRUMBLECRAG</b><span>PERIL ${r.peril} · PHASE ${r.phase}/3</span></div><div class="raid-boss-health"><i style="width:${Math.max(0, ((boss?.hp ?? 0) / r.maxHp) * 100)}%"></i></div><div class="raid-stagger"><i style="width:${r.staggerUntil > state.time ? 100 : r.stagger}%"></i><span>${r.staggerUntil > state.time ? "STAGGER · CORE EXPOSED" : "STAGGER"}</span></div><div class="raid-party-bars">${state.players
    .filter((p) => !p.raidBoss)
    .map(
      (p) =>
        `<span class="${p.hp <= 0 ? "downed" : ""}"><b>${escape(p.name)}</b><i style="--hp:${Math.max(0, (p.hp / CHARACTERS[p.character].health) * 100)}%"></i><small>${p.out ? "LEFT" : p.hp <= 0 ? `DOWN · ${Math.round((r.downed[p.id]?.progress ?? 0) * 100)}%` : `${Math.ceil(p.hp)} HP`}</small></span>`,
    )
    .join(
      "",
    )}</div><div class="raid-status-row"><p class="raid-callout" role="status">${escape(r.message)}</p><div class="raid-elapsed" role="timer" aria-label="Raid elapsed time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><b>${time(r.elapsed)}</b></div></div>`;
  const overlay = document.getElementById("arena-overlay")!;
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
    if (me.hp <= 0)
      banner.textContent = r.downed[me.id]?.self
        ? "One self-revive charging…"
        : "Downed · crawl toward allies. Teammates revive by standing nearby.";
    return;
  }
  overlay.style.pointerEvents = "auto";
  let title = "",
    body = "";
  if (state.phase === "briefing") {
    title = `${RAID_TRAITS[r.trait].name} Grumblecrag`;
    body = `<p>${escape(RAID_TRAITS[r.trait].text)}</p><div class="raid-instructions"><span>${raidGuideScene("charge", me.character)}<b>Bait the charge</b><small>Lure the boss into a stone pillar.</small></span><span>${raidGuideScene("core", me.character)}<b>Strike the core</b><small>Armor breaks. Unleash your ultimate.</small></span><span>${raidGuideScene("revive", me.character)}<b>Revive together</b><small>Stand beside a fallen ally to revive.</small></span></div><p>Three phases · one shared fight · ${r.partySize === 1 ? "one solo self-revive" : "no required healer"} · no PvP rating changes.</p><button class="primary" id="raid-instructions" ${state.instructionsReady.includes(me.id) ? "disabled" : ""}>${state.instructionsReady.includes(me.id) ? "Waiting for the team…" : "Let’s raid →"}</button>`;
  } else if (state.phase === "intermission") {
    title =
      r.phase === 1
        ? "Choose your starting rite"
        : `Phase ${r.phase} · ${RAID.phases[r.phase - 1]}`;
    body = `<p class="raid-rite-intro"><span>Rites stack for this run.</span><span class="raid-choice-timer" role="timer" aria-label="Time left to choose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><span>CHOOSE IN</span><strong>${LIVE_SECONDS}</strong></span></p><div class="raid-rite-options">${(r.offers[me.id] ?? []).map((id) => `<button data-raid-rite="${id}" class="secondary raid-rite-${id}">${raidRitePicture(id)}<span class="raid-rite-copy"><b>${RAID_RITES[id].name}</b><small>${RAID_RITES[id].text}</small></span></button>`).join("") || "<p>Rite locked in · waiting for the team.</p>"}</div>`;
  } else if (state.phase === "countdown") {
    title = String(Math.ceil(state.remaining));
    body = "<p>Stay together. Watch the ground.</p>";
  } else if (state.phase === "paused") {
    title = "A teammate disconnected";
    body = "<p>The raid is paused while they reconnect.</p>";
  } else if (state.phase === "finished") {
    title =
      r.result === "victory"
        ? "Grumblecrag defeated!"
        : "The mountain still stands";
    body = `<div class="raid-result-stats"><span><b>${time(r.elapsed)}</b>Clear time</span><span><b>${r.revives}</b>Revives</span><span><b>${r.downs}</b>Downs</span></div><p>${r.result === "victory" ? "Clear reward: Cragbreaker title. Five clears earn Cragbound colors." : "Change champion or try a different rite build."}</p>${r.result === "victory" ? `<p class="raid-save-state">${r.rewardStatus === "saved" ? "✓ Rewards saved to your account." : r.rewardStatus === "unavailable" ? "Reward storage is unavailable. This clear has not been saved; contact the host." : "Saving your rewards…"}</p><p>Next challenge: ${r.peril < 3 ? "Peril " + (r.peril + 1) + " · " + ["", "Falling Debris", "Closing Arena"][r.peril] : "Try another champion, a no-downs clear, or Raid of the Week."}</p>` : ""}<div class="result-actions"><button class="primary" id="raid-retry">${me.ready ? "Waiting for the team…" : "Run again →"}</button><button class="secondary" id="raid-lobby">Change champion / challenge</button><button class="secondary" id="raid-rewards">Bestiary & rewards</button><button class="quiet" id="raid-exit">Return to menu</button></div>`;
  }
  setOverlayMarkup(
    overlay,
    `<div class="overlay-card raid-overlay"><span class="eyebrow">BOSS RAID · CO-OP</span><h2>${title}</h2>${body}</div>`,
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
  for (const w of r.warnings) {
    const pulse = reduced ? 1 : 0.86 + Math.sin(state.time * 8) * 0.14;
    const danger = 0xff4059,
      edge = 0xff8c99;
    if (w.kind === "charge") {
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
      if (w.kind === "charge") {
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
  for (const w of r.wards)
    g.lineStyle(3, 0x8beed2, 0.7).strokeCircle(w.x, w.y, 130);
  for (const p of state.players)
    if (r.downed[p.id]) {
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
  return drawRaidBoss(g, state, reduced, clock);
}
