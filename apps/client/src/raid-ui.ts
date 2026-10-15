import type Phaser from "phaser";
import { CHARACTERS, type Fighter, type Snapshot } from "@arena/shared";
import {
  RAID,
  RAID_RITES,
  RAID_TRAITS,
  raidWeekly,
  type RaidProgress,
} from "../../../packages/shared/src/raid";
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
  return `<div class="eyebrow">BOSS BESTIARY</div><h2>Grumblecrag</h2><div class="raid-bestiary-art" aria-hidden="true"><svg viewBox="0 0 260 170" width="200" height="135"><ellipse cx="130" cy="145" rx="95" ry="19" fill="#070e1e" opacity=".5"/><rect x="62" y="39" width="136" height="112" rx="32" fill="#53677f"/><path d="m57 52 25-50 26 40m95 10L178 2l-26 40" fill="#9ba9bb"/><rect x="20" y="84" width="40" height="69" rx="17" fill="#53677f"/><rect x="200" y="84" width="40" height="69" rx="17" fill="#53677f"/><rect x="85" y="66" width="90" height="28" rx="8" fill="#1c293f"/><ellipse cx="106" cy="79" rx="8" ry="5" fill="#ffd47c"/><ellipse cx="154" cy="79" rx="8" ry="5" fill="#ffd47c"/><circle cx="130" cy="118" r="20" fill="#b89966"/><path d="m112 33 12 27m33 50 16 23" stroke="#a6b7cf" stroke-width="3"/></svg><b>THE LIVING MOUNTAIN</b></div><p>A guardian of the old coliseum. Its rage is its weakness: bait a charge into a pillar to crack its armor.</p><div class="fighter-stats"><span><b>${p.clears}</b>Clears</span><span><b>${p.highestPeril}</b>Highest Peril</span><span><b>${p.bestSeconds === null ? "—" : time(p.bestSeconds)}</b>Best clear</span></div><h3>Your next rewards</h3><div class="raid-rewards"><p>${p.clears ? "✓" : "○"} First clear → <b>Cragbreaker title</b></p><p>${p.clears >= 5 ? "✓" : "○"} ${Math.min(p.clears, 5)}/5 clears → <b>Cragbound color variant</b></p><p>${p.highestPeril >= 3 ? "✓" : "○"} Peril 3 → <b>Mountain Conqueror title</b></p><p>${p.cosmetics.includes("mountain-aura") ? "✓" : "○"} Peril 3 with no downs → <b>Mountain aura</b></p><p>A rare Gilded encounter grants its own title. All other rewards have guaranteed goals.</p></div><h3>Equip a cosmetic</h3><div class="raid-equip">${[null, ...p.cosmetics].map((id) => `<button class="secondary" data-raid-cosmetic="${id ?? ""}" ${p.equipped == id ? "disabled" : ""}>${id === "cragbound" ? "Cragbound colors" : id === "mountain-aura" ? "Mountain aura" : "Original appearance"}</button>`).join("")}</div><h3>Raid of the Week · ${raidWeekly().week}</h3><p>Same boss, trait, seed and Peril for everyone. Times are separated by team size.</p>${[
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
    body = `<p>Rites stack for this run. Choose within ${Math.ceil(state.remaining)} seconds.</p><div class="raid-rite-options">${(r.offers[me.id] ?? []).map((id) => `<button data-raid-rite="${id}" class="secondary">${abilityIcon(RAID_RITES[id].icon)}<span><b>${RAID_RITES[id].name}</b><small>${RAID_RITES[id].text}</small></span></button>`).join("") || "<p>Rite locked in · waiting for the team.</p>"}</div>`;
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
    const pulse = reduced ? 1 : 1 + Math.sin(state.time * 8) * 0.06;
    if (w.kind === "charge") {
      g.lineStyle(w.radius * 2, 0xffa665, 0.15).lineBetween(
        w.x,
        w.y,
        w.tx,
        w.ty,
      );
      g.lineStyle(3, 0xffc776, 0.9).lineBetween(w.x, w.y, w.tx, w.ty);
    } else {
      g.fillStyle(w.kind === "slam" ? 0xffc15b : 0xef6e7e, 0.13).fillCircle(
        w.x,
        w.y,
        w.radius,
      );
      g.lineStyle(3, 0xffc15b, 0.85).strokeCircle(w.x, w.y, w.radius * pulse);
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
  const boss = state.players.find((p) => p.raidBoss);
  if (!boss) return;
  const x = boss.x,
    y = boss.y,
    exposed = r.exposedUntil > state.time || r.staggerUntil > state.time;
  const rock = r.gilded ? 0xc4a36a : 0x53677f,
    light = r.gilded ? 0xf7d88a : 0x9ba9bb;
  g.fillStyle(0x040d20, 0.4).fillEllipse(x, y + 52, 185, 62);
  g.fillStyle(rock).fillRoundedRect(x - 68, y - 58, 136, 112, 32);
  g.fillStyle(light)
    .fillTriangle(x - 73, y - 45, x - 48, y - 95, x - 22, y - 55)
    .fillTriangle(x + 73, y - 45, x + 48, y - 95, x + 22, y - 55);
  g.fillStyle(rock)
    .fillRoundedRect(x - 110, y - 13, 40, 69, 17)
    .fillRoundedRect(x + 70, y - 13, 40, 69, 17);
  g.fillStyle(0x26344c)
    .fillEllipse(x - 43, y + 53, 58, 28)
    .fillEllipse(x + 43, y + 53, 58, 28);
  g.fillStyle(0x1c293f).fillRoundedRect(x - 45, y - 31, 90, 28, 8);
  g.fillStyle(exposed ? 0x7cffe5 : 0xffd47c)
    .fillEllipse(x - 24, y - 18, 15, 10)
    .fillEllipse(x + 24, y - 18, 15, 10);
  g.lineStyle(3, light, 0.7)
    .lineBetween(x - 18, y - 64, x - 6, y - 37)
    .lineBetween(x + 27, y + 12, x + 43, y + 35);
  g.fillStyle(exposed ? 0x71ffe3 : 0xb89966, exposed ? 0.9 : 0.35).fillCircle(
    x,
    y + 21,
    exposed ? 25 : 16,
  );
  if (exposed)
    g.lineStyle(4, 0x9affeb, 0.75).strokeCircle(
      x,
      y + 21,
      33 + (reduced ? 0 : Math.sin(state.time * 10) * 3),
    );
}
