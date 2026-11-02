import type { CharacterId } from "@arena/shared";
import { CHARACTERS } from "@arena/shared";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  RAID_COSMETICS,
  type RaidBossId,
} from "../../../packages/shared/src/raid";
import { LOOK_ITEM_BY_ID } from "../../../packages/shared/src/shop";
import { JOURNEY_ITEM_BY_ID } from "../../../packages/shared/src/journey";
import type { TownProfile } from "../../../packages/shared/src/town";
import { framedAvatar } from "./portraits";
import { raidSplashImage } from "./raid-splash-art";
import "./player-card.css";

/**
 * Another player's card, opened from Nearby players in town: their framed
 * portrait (with frame stars), name, level and title, what they wear, and
 * every boss they have beaten with clear counts.
 */
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const itemName = (id: string | null | undefined) =>
  !id
    ? null
    : (RAID_COSMETICS[id as keyof typeof RAID_COSMETICS]?.name ??
      LOOK_ITEM_BY_ID[id]?.name ??
      JOURNEY_ITEM_BY_ID[id]?.name ??
      null);

export function playerCardMarkup(p: TownProfile) {
  const character = (
    p.character in CHARACTERS ? p.character : "voltkit"
  ) as CharacterId;
  const portrait = framedAvatar(
    {
      character,
      raidLook: p.look,
      championLooks: p.skin ? { [character]: p.skin } : {},
      raidClears: p.raid,
    },
    `card-${p.id}`,
  );
  const worn = (
    [
      ["frame", "Frame"],
      ["aura", "Aura"],
      ["entrance", "Entrance"],
      ["victory", "Victory"],
      ["skin", "Colors"],
    ] as const
  )
    .map(([slot, label]) => [label, itemName(p.look?.[slot])] as const)
    .filter(([, name]) => name);
  const bosses = RAID_BOSS_ORDER.map((id: RaidBossId) => {
    const clears = p.raid?.[id] ?? 0;
    return `<li class="player-card-boss${clears ? " is-beaten" : ""}" style="--boss:${RAID_BOSSES[id].color}" title="${escape(RAID_BOSSES[id].name)}${clears ? ` · ${clears} ${clears === 1 ? "clear" : "clears"}` : " · not beaten yet"}"><span class="player-card-boss-art">${raidSplashImage(id)}</span><small>${clears ? `×${clears}` : "—"}</small></li>`;
  }).join("");
  const beaten = RAID_BOSS_ORDER.filter((id) => (p.raid?.[id] ?? 0) > 0).length;
  const total = Object.values(p.raid ?? {}).reduce((s, n) => s + (n ?? 0), 0);
  return `<div class="player-card"><div class="player-card-head"><span class="player-card-portrait">${portrait}</span><div><h2>${escape(p.name)}</h2><p>${p.level ? `Level ${p.level} · ` : ""}${escape(CHARACTERS[character].name)}</p>${p.title ? `<p class="player-card-title" style="color:${escape(p.titleColor ?? "#ffe58f")}">${escape(p.title)}</p>` : ""}</div></div>${worn.length ? `<ul class="player-card-worn">${worn.map(([label, name]) => `<li><small>${label}</small><b>${escape(name!)}</b></li>`).join("")}</ul>` : ""}<h3>Bosses beaten <small>${beaten}/${RAID_BOSS_ORDER.length} · ${total} ${total === 1 ? "clear" : "clears"}</small></h3><ul class="player-card-bosses">${bosses}</ul></div>`;
}
