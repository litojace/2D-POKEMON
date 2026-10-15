import type Phaser from "phaser";
import { CHARACTERS, type Fighter, type Snapshot } from "@arena/shared";
import {
  RAID,
  RAID_RITES,
  RAID_TRAITS,
  raidWeekly,
  type RaidProgress,
} from "../../../packages/shared/src/raid";
import { raidRitePicture } from "./raid-rite-art";
import { drawRaidBoss } from "./raid-boss-art";
import { abilityIcon } from "./ability-icons";
import { fighterAvatar } from "./fighter-art";
import { setOverlayMarkup } from "./overlay";
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
  return `<div class="eyebrow">BOSS RAID · CO-OP · 1–4 PLAYERS</div><h2>The mountain awakens.</h2><p class="raid-room-code">Room <b>${escape(state.code)}</b> · invite friends with this code</p><div class="raid-team">${state.players
    .filter((p) => !p.raidBoss)
    .map(
      (p) =>
        `<div>${fighterAvatar(p.character, "raid-lobby-" + p.id)}<span><b>${escape(p.name)}</b><small>${p.ready ? "Ready" : "Choosing a champion"}</small></span></div>`,
    )
    .join(
      "",
    )}</div><label>CHALLENGE<select id="raid-peril" ${host ? "" : "disabled"}>${[1, 2, 3].map((p) => `<option value="${p}" ${p === r.peril ? "selected" : ""}>Peril ${p} · ${["Learn the mountain", "Falling debris", "Closing arena"][p - 1]}</option>`).join("")}</select></label><label class="choice"><input id="raid-weekly" type="checkbox" ${r.weekly ? "checked" : ""} ${host ? "" : "disabled"}>Raid of the Week · shared Peril 2 challenge</label><p class="raid-small">Solo gets one self-revive. Co-op revives by standing near a downed ally. Higher Perils unlock through clears. Raid progress is separate from PvP ratings.</p><button class="primary" id="ready">${me.ready ? "Cancel ready" : "Ready for the raid →"}</button><button class="secondary" id="raid-bestiary">Bestiary & rewards</button><button class="quiet" id="leave">Leave room</button>`;
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
  hud.innerHTML = `<div class="raid-boss-heading"><b>${r.gilded ? "✦ GILDED " : ""}GRUMBLECRAG</b><span>PERIL ${r.peril} · PHASE ${r.phase}/3 · ${time(r.elapsed)}</span></div><div class="raid-boss-health"><i style="width:${Math.max(0, ((boss?.hp ?? 0) / r.maxHp) * 100)}%"></i></div><div class="raid-stagger"><i style="width:${r.staggerUntil > state.time ? 100 : r.stagger}%"></i><span>${r.staggerUntil > state.time ? "STAGGER · CORE EXPOSED" : "STAGGER"}</span></div><div class="raid-party-bars">${state.players
    .filter((p) => !p.raidBoss)
    .map(
      (p) =>
        `<span class="${p.hp <= 0 ? "downed" : ""}"><b>${escape(p.name)}</b><i style="--hp:${Math.max(0, (p.hp / CHARACTERS[p.character].health) * 100)}%"></i><small>${p.out ? "LEFT" : p.hp <= 0 ? `DOWN · ${Math.round((r.downed[p.id]?.progress ?? 0) * 100)}%` : `${Math.ceil(p.hp)} HP`}</small></span>`,
    )
    .join(
      "",
    )}</div><p class="raid-callout" role="status">${escape(r.message)}</p>`;
  const overlay = document.getElementById("arena-overlay")!;
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
    body = `<p>${escape(RAID_TRAITS[r.trait].text)}</p><div class="raid-instructions"><span>${abilityIcon("Dash")}<b>Bait the charge</b><small>Lead the warning line into stone pillars.</small></span><span>${abilityIcon("Overcharge")}<b>Break & stagger</b><small>Hit the glowing core. Save ultimates for stagger.</small></span><span>${abilityIcon("Jump")}<b>Rescue your team</b><small>Stand near a downed ally; interrupted progress is kept.</small></span></div><p>Three phases · one shared fight · ${r.partySize === 1 ? "one solo self-revive" : "no required healer"} · no PvP rating changes.</p><button class="primary" id="raid-instructions" ${state.instructionsReady.includes(me.id) ? "disabled" : ""}>${state.instructionsReady.includes(me.id) ? "Waiting for the team…" : "Let’s raid →"}</button>`;
  } else if (state.phase === "intermission") {
    title =
      r.phase === 1
        ? "Choose your starting rite"
        : `Phase ${r.phase} · ${RAID.phases[r.phase - 1]}`;
    body = `<p>Rites stack for this run. Choose within ${Math.ceil(state.remaining)} seconds.</p><div class="raid-rite-options">${(r.offers[me.id] ?? []).map((id) => `<button data-raid-rite="${id}" class="secondary raid-rite-${id}">${raidRitePicture(id)}<span class="raid-rite-copy"><b>${RAID_RITES[id].name}</b><small>${RAID_RITES[id].text}</small></span></button>`).join("") || "<p>Rite locked in · waiting for the team.</p>"}</div>`;
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
  drawRaidBoss(g, state, reduced);
}
