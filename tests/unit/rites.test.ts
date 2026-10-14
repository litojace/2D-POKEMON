import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { BotBrain } from "../../apps/server/src/bot";
import {
  CHARACTERS,
  FIGHTER_IDS,
  RITES,
  RITE_BY_ID,
  RITE_RULES,
  kitOf,
  packSnapshot,
  riteOffer,
  unpackSnapshot,
} from "@arena/shared";

const duel = () => {
  const arena = new Arena("RITES");
  arena.add("one", "One", "cindrake");
  arena.add("two", "Two", "tidefin");
  arena.start();
  arena.phase = "playing";
  arena.deadline = 999;
  return { arena, p: arena.players[0], q: arena.players[1] };
};
const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe("rites", () => {
  it("every fighter has four minors and two majors on real abilities", () => {
    for (const id of FIGHTER_IDS) {
      const own = RITES.filter((r) => r.fighter === id);
      expect(own.filter((r) => r.tier === "minor")).toHaveLength(4);
      expect(own.filter((r) => r.tier === "major")).toHaveLength(2);
      const ids = [CHARACTERS[id].basic, ...CHARACTERS[id].skills].map(
        (a) => a.id,
      );
      for (const r of own) {
        expect(ids).toContain(r.skill);
        // Each rite really changes its ability.
        const before = [CHARACTERS[id].basic, ...CHARACTERS[id].skills].find(
          (a) => a.id === r.skill,
        )!;
        const after = [kitOf(id, [r.id]).basic, ...kitOf(id, [r.id]).skills].find(
          (a) => a.id === r.skill,
        )!;
        expect(after).not.toEqual(before);
      }
    }
    expect(new Set(RITES.map((r) => r.id)).size).toBe(RITES.length);
  });
  it("applies changes without touching the shared roster", () => {
    const kit = kitOf("cindrake", ["cindrake-wide-bomb", "cindrake-searing-snap"]);
    expect(kit.skills[1].explosion).toBeCloseTo(110 * 1.3);
    expect(kit.basic.damage).toBe(18);
    expect(CHARACTERS.cindrake.skills[1].explosion).toBe(110);
    expect(CHARACTERS.cindrake.basic.damage).toBe(15);
    // Another fighter's rite does nothing.
    expect(kitOf("cindrake", ["tidefin-deep-pool"]).skills).toEqual(
      CHARACTERS.cindrake.skills,
    );
  });
  it("offers minors early, majors from round three until one is taken", () => {
    const early = riteOffer("lumoth", [], 2, seeded());
    expect(early).toHaveLength(RITE_RULES.choices);
    expect(early.every((id) => RITE_BY_ID[id].tier === "minor")).toBe(true);
    const later = riteOffer("lumoth", [], 3, seeded());
    expect(later.filter((id) => RITE_BY_ID[id].tier === "major")).toHaveLength(2);
    const major = later.find((id) => RITE_BY_ID[id].tier === "major")!;
    const after = riteOffer("lumoth", [major], 4, seeded(), 1);
    expect(after).toHaveLength(4);
    expect(after.some((id) => RITE_BY_ID[id].tier === "major")).toBe(false);
    expect(after).not.toContain(major);
  });
  it("deals choices between rounds; the loser gets an extra one", () => {
    const { arena, p, q } = duel();
    arena.endRound(0);
    expect(arena.phase).toBe("intermission");
    expect(p.riteOffer).toHaveLength(RITE_RULES.choices);
    expect(q.riteOffer).toHaveLength(RITE_RULES.choices + 1);
    expect(arena.pickRite(p.id, "not-offered")).toBe(false);
    expect(arena.pickRite(p.id, p.riteOffer![1])).toBe(true);
    expect(p.rites).toHaveLength(1);
    expect(p.riteOffer).toBeUndefined();
  });
  it("auto-picks when time runs out and ends early once everyone chose", () => {
    const { arena, p, q } = duel();
    arena.endRound(0);
    const first = q.riteOffer![0];
    arena.pickRite(p.id, p.riteOffer![0]);
    expect(arena.deadline - arena.time).toBeCloseTo(RITE_RULES.seconds);
    for (let i = 0; i < 30 * (RITE_RULES.seconds + 0.5); i++) arena.tick();
    expect(arena.round).toBe(2);
    expect(q.rites).toEqual([first]);
    const { arena: b, p: p2, q: q2 } = duel();
    b.endRound(1);
    b.pickRite(p2.id, p2.riteOffer![0]);
    b.pickRite(q2.id, q2.riteOffer![0]);
    expect(b.deadline - b.time).toBeCloseTo(RITE_RULES.minSeconds);
  });
  it("bots choose immediately, and rites reset for a new match", () => {
    const { arena, p, q } = duel();
    arena.bots.set(q.id, new BotBrain(q.id, "normal", 3));
    arena.endRound(0);
    expect(q.riteOffer).toBeUndefined();
    expect(q.rites).toHaveLength(1);
    arena.start();
    expect(q.rites).toEqual([]);
    expect(p.rites).toEqual([]);
  });
  it("cast uses the rite version: cooldowns and the client's view agree", () => {
    const { arena, p } = duel();
    p.rites = ["cindrake-wide-bomb"];
    arena.cast(p, arena.kit(p).skills[1]);
    const wire = unpackSnapshot(packSnapshot(arena.snapshot()));
    expect(wire.projectiles[0].ability.explosion).toBeCloseTo(110 * 1.3);
    const tide = duel();
    tide.q.rites = ["tidefin-rapid-stars"];
    tide.arena.submit(tide.q, {
      ...tide.q.lastInput,
      seq: 99,
      skill: 0,
    });
    tide.arena.tick();
    expect(tide.q.cooldowns[0] - tide.arena.time).toBeCloseTo(5, 1);
  });
});
