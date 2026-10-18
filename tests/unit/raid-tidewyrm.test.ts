import { describe, expect, it } from "vitest";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { TidewyrmArena } from "../../apps/server/src/raid-tidewyrm";
import { CHARACTERS, blankInput, type CharacterId } from "@arena/shared";
import {
  RAID_BOSSES,
  RAID_BOSS_ATTACKS,
  TIDEWYRM,
  raidPattern,
  ritesFor,
  type RaidWarning,
} from "../../packages/shared/src/raid";

const tide = (characters: CharacterId[] = ["voltkit"], peril = 1) => {
  const a = createRaidArena("TIDE", "tidewyrm") as TidewyrmArena;
  characters.forEach((c, i) => a.add("p" + i, "Player " + i, c));
  a.configure(peril, false);
  a.start();
  a.phase = "playing";
  a.deadline = 480;
  // No surprise attacks: each test places its own warnings.
  (a as unknown as { nextAttack: number }).nextAttack = Infinity;
  (a as unknown as { started: boolean }).started = true;
  return a;
};
const place = (a: TidewyrmArena, id: string, x: number, y: number) => {
  const p = a.players.find((q) => q.id === id)!;
  p.x = x;
  p.y = y;
  return p;
};
const hurt = (a: TidewyrmArena, id: string) => {
  const p = a.players.find((q) => q.id === id)!;
  return CHARACTERS[p.character].health - p.hp;
};
const run = (a: TidewyrmArena, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 30) a.tick(1 / 30);
};
let serial = 9000;
const warn = (a: TidewyrmArena, w: Partial<RaidWarning> & Pick<RaidWarning, "kind">) => {
  const boss = a.boss()!;
  const warning = { id: ++serial, x: boss.x, y: boss.y, tx: boss.x, ty: boss.y, radius: 100, at: a.time, startedAt: a.time, ...w } as RaidWarning;
  a.raid.warnings.push(warning);
  return warning;
};
const island = TIDEWYRM.islands[0];

describe("Tidewyrm's setup", () => {
  it("is playable, uses the Lagoon Court and has no pillars", () => {
    expect(RAID_BOSSES.tidewyrm.playable).toBe(true);
    const a = tide();
    expect(a).toBeInstanceOf(TidewyrmArena);
    expect(a.arenaId).toBe("lagoon");
    expect(a.walls()).toEqual([]);
    expect(a.raid.pillars).toEqual([]);
    expect(a.raid.islands).toHaveLength(4);
    expect(["murky", "rip-current", "spring-tide"]).toContain(a.raid.trait);
    const gild = a.raid.gilded ? TIDEWYRM.health.gilded : 1;
    expect(a.raid.maxHp).toBe(Math.round(TIDEWYRM.health.base * gild));
  });
  it("teaches stranding first and adds the tide attacks from chapter 2", () => {
    const one = raidPattern(1, 1, 1, "tidewyrm");
    expect(one).toContain("dive");
    for (const late of ["hightide", "undertow", "prison"] as const) {
      expect(one).not.toContain(late);
      expect(raidPattern(2, 1, 2, "tidewyrm")).toContain(late);
    }
    // Every attack in a pattern is one of its own (and can be practised).
    for (const phase of [1, 2, 3])
      for (const kind of raidPattern(phase, 3, 4, "tidewyrm"))
        expect(RAID_BOSS_ATTACKS.tidewyrm).toContain(kind);
  });
  it("offers its themed rite only against itself", () => {
    expect(ritesFor("tidewyrm")).toContain("footing");
    expect(ritesFor("grumblecrag")).not.toContain("footing");
  });
});

describe("Dive & Surface", () => {
  it("strands it on an island: exposed, staggered, counted, and the island cracks", () => {
    const a = tide(["voltkit", "cindrake"], 2);
    place(a, "p0", island.x, island.y);
    place(a, "p1", 1400, 800);
    const w = warn(a, { kind: "dive", targetId: "p0", lockAt: a.time + 0.2, at: a.time + 0.3, radius: TIDEWYRM.dive.radius });
    a.raid.submerged = true;
    run(a, 0.1);
    // The ripple follows the target until it locks.
    expect([w.x, w.y]).toEqual([island.x, island.y]);
    run(a, 0.12); // locked now
    place(a, "p0", island.x + 200, island.y + 120); // step off before it surfaces
    run(a, 0.2);
    expect(a.raid.submerged).toBe(false);
    expect(a.boss()!.x).toBeCloseTo(island.x);
    expect(a.raid.exposedUntil).toBeGreaterThan(a.time + 4);
    expect(a.raid.strands).toBe(1);
    expect(a.raid.stagger).toBeGreaterThanOrEqual(TIDEWYRM.dive.strandStagger);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
    expect(a.raid.islands![0].cracks).toBe(1);
    expect(hurt(a, "p0")).toBe(0);
  });
  it("splashes whoever stays on the spot, and lingers in water when it misses land", () => {
    const a = tide(["voltkit"], 1);
    place(a, "p0", 800, 700);
    warn(a, { kind: "dive", targetId: "p0", lockAt: a.time, at: a.time + 0.05, x: 800, y: 700, tx: 800, ty: 700, radius: TIDEWYRM.dive.radius });
    a.raid.submerged = true;
    run(a, 0.2);
    expect(hurt(a, "p0")).toBeCloseTo(TIDEWYRM.dive.damage, 0);
    expect(a.raid.strands ?? 0).toBe(0);
    expect(a.raid.exposedUntil).toBeLessThanOrEqual(a.time);
    // It lingers, then swims home under water, where it can't be hurt.
    run(a, 2.6);
    expect(a.raid.submerged).toBe(true);
    const boss = a.boss()!,
      hp = boss.hp;
    a.damage(boss, 50, "p0");
    expect(boss.hp).toBe(hp);
  });
  it("sinks an island after two strands, until the next chapter", () => {
    const a = tide(["voltkit"], 1);
    for (let n = 0; n < 2; n++) {
      place(a, "p0", 1400, 820);
      warn(a, { kind: "dive", targetId: "p1", lockAt: a.time, at: a.time + 0.03, x: island.x, y: island.y, tx: island.x, ty: island.y, radius: 110 });
      run(a, 0.1);
      a.raid.exposedUntil = a.time; // strand over
      run(a, 0.1);
    }
    expect(a.raid.islands![0].sunk).toBe(true);
    expect(a.islandAt(island.x, island.y)).toBeUndefined();
    (a as unknown as { onChapter(): void }).onChapter();
    expect(a.raid.islands![0].sunk).toBe(false);
  });
  it("follows Tidefin's Mirror Mist clone instead of Tidefin", () => {
    const a = tide(["tidefin"], 1);
    const p = place(a, "p0", 300, 450);
    p.clone = { x: island.x, y: island.y, until: a.time + 3 };
    const w = warn(a, { kind: "dive", targetId: "p0", lockAt: a.time + 1, at: a.time + 1.5 });
    run(a, 0.1);
    expect([w.x, w.y]).toEqual([island.x, island.y]);
  });
});

describe("waves, bubbles and the tide", () => {
  it("lets you jump a low wave but only an island saves you from a high one", () => {
    const low = tide(["voltkit", "cindrake"], 1);
    const jumper = place(low, "p0", 400, 450),
      stander = place(low, "p1", 400, 300);
    jumper.jumpUntil = low.time + 5;
    warn(low, { kind: "wave", x: 0, y: 450, tx: 1, ty: 450, radius: 70, high: false });
    run(low, 1.5);
    expect(hurt(low, "p0")).toBe(0);
    expect(hurt(low, "p1")).toBeGreaterThan(0);
    void stander;
    const high = tide(["voltkit", "cindrake"], 1);
    const safe = place(high, "p0", island.x, island.y),
      jumping = place(high, "p1", 400, 450);
    jumping.jumpUntil = high.time + 5;
    warn(high, { kind: "wave", x: 0, y: 450, tx: 1, ty: 450, radius: 70, high: true });
    run(high, 1.5);
    void safe;
    expect(hurt(high, "p0")).toBe(0);
    expect(hurt(high, "p1")).toBeGreaterThan(0);
  });
  it("roots raiders hit by bubbles, unless they have Sure Footing", () => {
    const a = tide(["voltkit", "cindrake"], 1);
    a.raid.rites.p1 = ["footing"];
    const boss = a.boss()!;
    place(a, "p0", boss.x + 120, boss.y - 60);
    place(a, "p1", boss.x + 120, boss.y + 60);
    a.raid.bubbles = [
      { id: 1, x: boss.x + 120, y: boss.y - 60, vx: 0, vy: 0, until: a.time + 3 },
      { id: 2, x: boss.x + 120, y: boss.y + 60, vx: 0, vy: 0, until: a.time + 3 },
    ];
    run(a, 0.05);
    expect(hurt(a, "p0")).toBeGreaterThan(0);
    const rooted = (a as unknown as { rootedUntil: Map<string, number> }).rootedUntil;
    expect(rooted.get("p0")).toBeGreaterThan(a.time);
    expect(rooted.has("p1")).toBe(false);
  });
  it("floods the floor at High Tide: islands are safe, two to an island", () => {
    const a = tide(["voltkit", "cindrake", "tidefin"], 1);
    a.raid.phase = 2;
    place(a, "p0", island.x, island.y);
    run(a, 0.05);
    place(a, "p1", island.x + 10, island.y);
    run(a, 0.05);
    place(a, "p2", island.x - 10, island.y + 5); // the third arrival
    a.raid.floodUntil = a.time + 2;
    run(a, 0.5);
    const p2 = a.players.find((q) => q.id === "p2")!;
    expect(Math.hypot(p2.x - island.x, p2.y - island.y)).toBeGreaterThan(TIDEWYRM.islandRadius);
    expect(hurt(a, "p0")).toBe(0);
    expect(hurt(a, "p1")).toBe(0);
    expect(hurt(a, "p2")).toBeGreaterThan(0);
  });
  it("pulls everyone toward the whirlpool and hurts at its centre", () => {
    const a = tide(["voltkit"], 1);
    const p = place(a, "p0", 800 + 300, 450);
    a.raid.undertow = { x: 800, y: 450, until: a.time + 3, radius: TIDEWYRM.undertow.centreRadius };
    run(a, 1);
    expect(p.x).toBeLessThan(800 + 300 - 80);
    run(a, 2);
    expect(hurt(a, "p0")).toBeCloseTo(TIDEWYRM.undertow.damage * 1, 0);
  });
});

describe("Bubble Prison", () => {
  it("is popped by three teammate hits, and Magma Bomb pops it at once", () => {
    const a = tide(["voltkit", "cindrake"], 1);
    place(a, "p0", 400, 450);
    const friend = place(a, "p1", 460, 450);
    a.raid.prisons = [{ playerId: "p0", x: 400, y: 450, hits: 0, presses: 0, until: a.time + 6, startedAt: a.time }];
    friend.lastInput = { ...blankInput(), basic: true, aimX: 400, aimY: 450 };
    for (let i = 0; i < 40 && a.raid.prisons!.length; i++) {
      friend.lastInput = { ...friend.lastInput, basic: true };
      friend.x = a.raid.prisons![0].x + 50;
      friend.y = a.raid.prisons![0].y;
      run(a, 0.1);
    }
    expect(a.raid.prisons).toHaveLength(0);
    expect(hurt(a, "p0")).toBe(0);
  });
  it("pops at once with Cindrake's Magma Bomb", () => {
    const a = tide(["voltkit", "cindrake"], 1);
    place(a, "p0", 400, 450);
    place(a, "p1", 900, 450);
    a.raid.prisons = [{ playerId: "p0", x: 400, y: 450, hits: 0, presses: 0, until: a.time + 6, startedAt: a.time }];
    const bomb = CHARACTERS.cindrake.skills.find((s) => s.id === "magma-bomb")!;
    a.projectiles.push({ id: 777, owner: "p1", x: 405, y: 450, vx: 0, vy: 0, remaining: 50, ability: bomb, color: 0xff7a4f });
    run(a, 0.04);
    expect(a.raid.prisons).toHaveLength(0);
  });
  it("lets an AI stand-in mash its way out too", () => {
    const a = tide(["voltkit"], 1);
    place(a, "p0", 400, 450);
    a.standIn("p0");
    a.raid.prisons = [{ playerId: "p0", x: 400, y: 450, hits: 0, presses: 0, until: a.time + 6, startedAt: a.time }];
    run(a, 4);
    expect(a.raid.prisons).toHaveLength(0);
    expect(a.players.find((q) => q.id === "p0")!.hp).toBeGreaterThan(0);
  });
  it("lets a solo raider mash out, and downs them at the mouth", () => {
    const solo = tide(["voltkit"], 1);
    const p = place(solo, "p0", 400, 450);
    solo.raid.prisons = [{ playerId: "p0", x: 400, y: 450, hits: 0, presses: 0, until: solo.time + 6, startedAt: solo.time }];
    for (let i = 1; i <= TIDEWYRM.prison.presses * 2; i++)
      solo.submit(p, { ...blankInput(), seq: i, basic: i % 2 === 1 });
    run(solo, 0.05);
    expect(solo.raid.prisons).toHaveLength(0);
    const late = tide(["voltkit", "cindrake"], 1);
    place(late, "p0", 400, 450);
    place(late, "p1", 1400, 800);
    late.raid.prisons = [{ playerId: "p0", x: 400, y: 450, hits: 0, presses: 0, until: late.time + 1, startedAt: late.time }];
    run(late, 1.2);
    const caught = late.players.find((q) => q.id === "p0")!;
    expect(caught.hp).toBeLessThanOrEqual(0);
    expect(late.raid.downed.p0?.cause).toBe("prison");
  });
});

describe("a whole run", () => {
  it("plays through every chapter with stand-ins without errors", () => {
    const a = createRaidArena("SIM", "tidewyrm") as TidewyrmArena;
    for (const [i, c] of (["voltkit", "tidefin", "terradon"] as CharacterId[]).entries()) {
      a.add("b" + i, "Bot " + i, c);
    }
    a.configure(3, false);
    a.start();
    for (const p of a.heroes()) a.standIn(p.id);
    a.phase = "playing";
    a.deadline = 480;
    const seen = new Set<string>();
    for (let t = 0; t < 400 && !a.raid.result; t += 1 / 30) {
      a.tick(1 / 30);
      for (const w of a.raid.warnings) seen.add(w.kind);
      if ((a.phase as string) === "intermission") {
        for (const [id, offer] of Object.entries(a.raid.offers)) a.pickRite(id, offer[0]);
        a.tick(1 / 30);
      }
      // Speed the fight along: chip the boss so every chapter is reached.
      const boss = a.boss();
      if (boss && a.phase === "playing" && !a.raid.submerged) boss.hp -= 0.6;
    }
    expect(a.raid.phase).toBe(3);
    for (const kind of ["dive", "wave", "bubbles", "hightide", "undertow", "prison"]) expect(seen).toContain(kind);
  });
});
