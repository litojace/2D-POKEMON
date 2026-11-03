/**
 * Repeatable combat workloads for the performance scripts.
 *
 * Every fighter wears a fully equipped, realistic appearance (a Shop skin for
 * every champion that has one, all five raid slots, earned boss clears, a title and
 * mastery flair), because that is what a long-time player's snapshot carries
 * and what the network has to move.
 */
import { Arena } from "../../apps/server/src/simulation.js";
import { RaidArena } from "../../apps/server/src/raid.js";
import {
  CHARACTERS,
  blankInput,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";
import { CHAMPION_SKINS, LOOK_ITEMS } from "../../packages/shared/src/shop.js";
import { RAID_BOSSES } from "../../packages/shared/src/raid-roster.js";
import type { RaidBossId } from "../../packages/shared/src/raid.js";

export const ROSTER = Object.keys(CHARACTERS) as CharacterId[];

/** A fully equipped appearance, deterministic per seat. */
export function dressUp(p: Fighter, seat: number) {
  p.title = ["Storm Chaser", "Raid Veteran", "Crystal Duelist", "Gilded"][
    seat % 4
  ];
  p.titleColor = ["#7dd3fc", "#fbbf24", "#c084fc", "#f472b6"][seat % 4];
  p.flair = (["Bronze", "Silver", "Gold", "Crystal"] as const)[seat % 4];
  // Champions without Shop skins yet (the newest ones) wear their own look.
  p.championLooks = Object.fromEntries(
    ROSTER.flatMap((c, i) => {
      const skins = CHAMPION_SKINS.filter((s) => s.champion === c);
      if (!skins.length) return [];
      const s = skins[(seat + i) % skins.length];
      return [[c, { skin: s.id, stage: s.rarity === "mythical" ? 2 : 1 }]];
    }),
  );
  const bySlot = (slot: string) =>
    LOOK_ITEMS.filter((i) => i.slot === slot)[seat]?.id ?? null;
  p.raidLook = {
    skin: bySlot("skin"),
    aura: bySlot("aura"),
    entrance: bySlot("entrance"),
    frame: bySlot("frame"),
    victory: bySlot("victory"),
  };
  p.raidClears = Object.fromEntries(
    (Object.keys(RAID_BOSSES) as RaidBossId[]).map((b, i) => [
      b,
      3 + seat * 7 + i,
    ]),
  );
}

export type Scenario = "pvp2" | "pvp4" | "raid4";
export const SCENARIOS: Scenario[] = ["pvp2", "pvp4", "raid4"];

/** A room in the middle of a fight, with every seat dressed up. */
export function makeArena(
  scenario: Scenario,
  code = "PERF01",
  boss: RaidBossId = "grumblecrag",
): Arena {
  const a =
    scenario === "raid4"
      ? new RaidArena(code, boss)
      : new Arena(code, scenario === "pvp4" ? "ffa" : "duel");
  const seats = scenario === "pvp2" ? 2 : 4;
  for (let i = 0; i < seats; i++)
    a.add(`p${i + 1}`, `Player ${i + 1}`, ROSTER[(i * 3) % ROSTER.length]);
  a.players.forEach((p, i) => dressUp(p, i));
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 10_000;
  a.players
    .filter((p) => !p.raidBoss)
    .forEach((p, i) => {
      p.x = 520 + (i % 2) * 520;
      p.y = 260 + Math.floor(i / 2) * 380;
    });
  return a;
}

/**
 * Deterministic "busy" inputs: everyone runs in circles, holds Basic, and
 * in four-seat rooms all fighters fire skills on the same ticks.
 */
export function driveInputs(a: Arena, tick: number) {
  const heroes = a.players.filter((p) => !p.raidBoss && !a.bots.has(p.id));
  heroes.forEach((p, i) => {
    // Keep the room fighting rather than ending rounds.
    p.hp = CHARACTERS[p.character].health;
    p.ult = 100;
    const target =
      a.players.find((q) => q.raidBoss) ?? heroes[(i + 1) % heroes.length];
    const simultaneous = heroes.length >= 4 ? tick % 45 === 0 : false;
    a.submit(p, {
      ...blankInput(),
      seq: p.ack + 1,
      dx: Math.cos(tick / 20 + i),
      dy: Math.sin(tick / 20 + i),
      aimX: target.x,
      aimY: target.y,
      basic: true,
      skill: simultaneous
        ? Math.floor(tick / 45) % 4
        : (tick + i * 11) % 90 === 0
          ? ((tick / 90 + i) % 4) | 0
          : -1,
    });
  });
  if (a instanceof RaidArena)
    for (const p of a.heroes()) if (p.hp <= 0) p.hp = 1;
}
