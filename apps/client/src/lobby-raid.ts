/**
 * The Lobby's Raid card: one boss, with its own splash painting. A look
 * that wants the card shows it (themes/showcase/lobby.css); it is in the
 * Lobby's markup for every look and hidden otherwise (lobby.css).
 *
 * Which boss: the next one you have not cleared, in the Raid Hall's order,
 * so the card always points at something new. Cragmuff comes first because
 * the other six open after one clear of it (raidUnlocked, raid-hall-view.ts).
 * With every boss cleared there is no "next": the card then shows one boss a
 * day, changing at midnight Pacific as the group's day does.
 *
 * Boss ids are the old names (CLAUDE.md): `grumblecrag` is Cragmuff.
 */
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  pacificDate,
  type RaidBossId,
} from "../../../packages/shared/src/raid-roster";
import art0 from "./art/raid-splash/grumblecrag-lobby.webp";
import art1 from "./art/raid-splash/tidewyrm-lobby.webp";
import art2 from "./art/raid-splash/gloomshade-lobby.webp";
import art3 from "./art/raid-splash/somnara-lobby.webp";
import art4 from "./art/raid-splash/prismatail-lobby.webp";
import art5 from "./art/raid-splash/emberwing-lobby.webp";
import art6 from "./art/raid-splash/storm-twins-lobby.webp";

/** Each painting at 640 × 427 (the card is at most 272 px wide). */
const ART: Record<RaidBossId, string> = {
  grumblecrag: art0,
  tidewyrm: art1,
  gloomshade: art2,
  somnara: art3,
  prismatail: art4,
  emberwing: art5,
  "storm-twins": art6,
};
/**
 * Where the boss's face is in its painting, as fractions of its width and
 * height (the Raid Hall's framing points, BOSS_FRAMES in raid-hall-view.ts):
 * the card is a wide strip of the painting, cut around this point.
 */
const FACE: Record<RaidBossId, [number, number]> = {
  grumblecrag: [0.54, 0.38],
  tidewyrm: [0.65, 0.42],
  gloomshade: [0.62, 0.36],
  somnara: [0.64, 0.4],
  prismatail: [0.675, 0.46],
  emberwing: [0.51, 0.38],
  "storm-twins": [0.55, 0.46],
};

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** Days since 1970 of a YYYY-MM-DD date: one boss per Pacific day. */
const dayNumber = (date: string) => Math.floor(Date.parse(date) / 86_400_000);

/** The boss the Lobby's Raid card shows. */
export function lobbyRaidBoss(
  clears: Partial<Record<RaidBossId, number>> = {},
  today = pacificDate(),
): RaidBossId {
  const open = RAID_BOSS_ORDER.filter((id) => RAID_BOSSES[id].playable);
  if (!open.length || !(clears.grumblecrag ?? 0)) return "grumblecrag";
  const next = open.find((id) => !(clears[id] ?? 0));
  if (next) return next;
  const n = dayNumber(today);
  return open[((n % open.length) + open.length) % open.length]!;
}

/**
 * The card's contents (lobby-screen.ts puts them in its button).
 * `opensAt`: raids are still locked at your level, and open at this one.
 */
export function lobbyRaidCard(id: RaidBossId, opensAt?: number) {
  const boss = RAID_BOSSES[id];
  const [x, y] = FACE[id];
  const kicker = opensAt ? `Raid · opens at Lv ${opensAt}` : "Raid";
  return `<img class="lobby-raid-art" src="${ART[id]}" alt="" width="640" height="427" decoding="async" loading="lazy" style="object-position:${Math.round(x * 100)}% ${Math.round(y * 100)}%"><span class="lobby-card-kicker">${kicker}</span><b>${escape(boss.name)}</b><small>${escape(boss.epithet)}</small>`;
}
