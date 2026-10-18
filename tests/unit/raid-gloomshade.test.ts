import { describe, expect, it } from "vitest";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { GloomshadeArena } from "../../apps/server/src/raid-gloomshade";
import { CHARACTERS, blankInput, type CharacterId } from "@arena/shared";
import {
  GLOOMSHADE,
  RAID_BOSSES,
  RAID_BOSS_ATTACKS,
  handsTileDark,
  raidPattern,
  ritesFor,
  type RaidWarning,
} from "../../packages/shared/src/raid";

const gloom = (characters: CharacterId[] = ["voltkit"], peril = 1) => {
  const a = createRaidArena("GLUM", "gloomshade") as GloomshadeArena;
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
const player = (a: GloomshadeArena, id: string) => a.players.find((q) => q.id === id)!;
const place = (a: GloomshadeArena, id: string, x: number, y: number) => {
  const p = player(a, id);
  p.x = x;
  p.y = y;
  return p;
};
const hurt = (a: GloomshadeArena, id: string) => {
  const p = player(a, id);
  return CHARACTERS[p.character].health - p.hp;
};
const run = (a: GloomshadeArena, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 30) a.tick(1 / 30);
};
let serial = 9000;
const warn = (a: GloomshadeArena, w: Partial<RaidWarning> & Pick<RaidWarning, "kind">) => {
  const boss = a.boss()!;
  const warning = { id: ++serial, x: boss.x, y: boss.y, tx: boss.x, ty: boss.y, radius: 100, at: a.time, startedAt: a.time, ...w } as RaidWarning;
  a.raid.warnings.push(warning);
  return warning;
};
/** A tile centre that is (or isn't) dark for a parity. */
const tile = (parity: number, dark: boolean) => {
  for (let c = 0; c < 8; c++)
    for (let r = 0; r < 5; r++) {
      const x = (c + 0.5) * 200,
        y = (r + 0.5) * 180;
      if (handsTileDark(x, y, parity) === dark) return { x, y };
    }
  throw new Error("no tile");
};
/** Hold the boss still somewhere out of the way. */
const park = (a: GloomshadeArena, x = 800, y = 430) => {
  const boss = a.boss()!;
  boss.x = x;
  boss.y = y;
  // Exposed, it holds still (staggered, it would also stop attacking).
  a.raid.exposedUntil = a.time + 999;
  return boss;
};
/** Press attack (a fresh press) aiming at a point. */
const swing = (a: GloomshadeArena, id: string, x: number, y: number) => {
  const p = player(a, id);
  p.lastInput = { ...blankInput(), aimX: x, aimY: y, basic: false };
  a.tick(1 / 30);
  p.lastInput = { ...p.lastInput, basic: true };
  a.tick(1 / 30);
  p.lastInput = { ...p.lastInput, basic: false };
};
const lantern = GLOOMSHADE.lanterns[0];

describe("Gloomshade's setup", () => {
  it("is playable, uses the Lantern Yard with four lit lanterns and no walls", () => {
    expect(RAID_BOSSES.gloomshade.playable).toBe(true);
    const a = gloom();
    expect(a).toBeInstanceOf(GloomshadeArena);
    expect(a.arenaId).toBe("lantern-yard");
    expect(a.walls()).toEqual([]);
    expect(a.raid.pillars).toEqual([]);
    expect(a.raid.lanterns).toHaveLength(4);
    expect(a.raid.lanterns!.every((l) => l.lit)).toBe(true);
    expect(["moonlit", "restless-spirits", "hollow"]).toContain(a.raid.trait);
    const gild = a.raid.gilded ? GLOOMSHADE.health.gilded : 1;
    expect(a.raid.maxHp).toBe(Math.round(GLOOMSHADE.health.base * gild));
  });
  it("keeps the copies and curses for chapter 2 on", () => {
    const one = raidPattern(1, 3, 1, "gloomshade");
    expect(one).toContain("lunge");
    expect(one).not.toContain("split");
    expect(one).not.toContain("curse");
    expect(raidPattern(2, 1, 2, "gloomshade")[0]).toBe("split");
    for (const phase of [1, 2, 3])
      for (const kind of raidPattern(phase, 3, 4, "gloomshade"))
        expect(RAID_BOSS_ATTACKS.gloomshade!).toContain(kind);
  });
  it("offers its themed rite only against itself", () => {
    expect(ritesFor("gloomshade")).toContain("lamplighter");
    expect(ritesFor("tidewyrm")).not.toContain("lamplighter");
  });
  it("is armoured until found: no always-on exposure", () => {
    const a = gloom();
    const boss = a.boss()!;
    const before = boss.hp;
    a.damage(boss, 100, "p0");
    expect(before - boss.hp).toBeCloseTo(72);
  });
});

describe("Shadow Lunge and Grasping Hands", () => {
  it("lunges along a line: on the line hurts, a step aside doesn't", () => {
    const a = gloom(["voltkit", "terradon"]);
    park(a, 400, 450);
    place(a, "p0", 900, 450);
    place(a, "p1", 900, 600);
    warn(a, { kind: "lunge", x: 400, y: 450, tx: 1160, ty: 450, radius: GLOOMSHADE.lunge.width, at: a.time + 0.05, lockAt: a.time });
    run(a, 0.2);
    expect(hurt(a, "p0")).toBeGreaterThan(0);
    expect(hurt(a, "p1")).toBe(0);
    expect(a.downCauses).toEqual({});
  });
  it("grabs from dark tiles only", () => {
    const a = gloom(["voltkit", "terradon"]);
    park(a);
    const dark = tile(0, true),
      light = tile(0, false);
    place(a, "p0", dark.x, dark.y);
    place(a, "p1", light.x, light.y);
    warn(a, { kind: "hands", parity: 0, at: a.time + 0.05 });
    run(a, 0.2);
    expect(hurt(a, "p0")).toBeGreaterThan(0);
    expect(hurt(a, "p1")).toBe(0);
  });
  it("flips the tiles when the warning shifts (Peril 2+)", () => {
    const a = gloom(["voltkit"], 2);
    park(a);
    const first = tile(0, false);
    place(a, "p0", first.x, first.y);
    warn(a, { kind: "hands", parity: 0, shiftAt: a.time, at: a.time + 0.05 });
    run(a, 0.2);
    // The tile that looked safe was dark after the shift.
    expect(hurt(a, "p0")).toBeGreaterThan(0);
  });
});

describe("Snuff Out and the lanterns", () => {
  it("snuffs a lantern, and two hits from a raider relight it (credited)", () => {
    const a = gloom();
    park(a);
    warn(a, { kind: "snuff", lantern: 0, x: lantern.x, y: lantern.y, at: a.time + 0.05 });
    run(a, 0.2);
    expect(a.raid.lanterns![0].lit).toBe(false);
    expect(a.lit(lantern.x, lantern.y)).toBe(false);
    place(a, "p0", lantern.x + 80, lantern.y);
    swing(a, "p0", lantern.x, lantern.y);
    expect(a.raid.lanterns![0].lit).toBe(false);
    swing(a, "p0", lantern.x, lantern.y);
    expect(a.raid.lanterns![0].lit).toBe(true);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
  });
  it("relights with one hit for a Lamplighter, who also heals in the light", () => {
    const a = gloom();
    park(a);
    a.raid.rites.p0 = ["lamplighter"];
    a.raid.lanterns![0].lit = false;
    const p = place(a, "p0", lantern.x + 80, lantern.y);
    swing(a, "p0", lantern.x, lantern.y);
    expect(a.raid.lanterns![0].lit).toBe(true);
    p.hp = 50;
    run(a, 1);
    expect(p.hp).toBeGreaterThan(50);
  });
  it("relights lanterns and cleanses curses with Lumoth's Radiant Flare", () => {
    const a = gloom(["lumoth", "terradon"]);
    park(a);
    a.raid.lanterns![0].lit = false;
    const lumoth = place(a, "p0", lantern.x + 100, lantern.y + 60);
    place(a, "p1", lantern.x + 140, lantern.y + 60);
    a.raid.curses = { p1: { stacks: 2, hauntedUntil: 0 } };
    lumoth.lastInput = { ...blankInput(), aimX: lumoth.x, aimY: lumoth.y };
    a.cast(lumoth, CHARACTERS.lumoth.skills.find((s) => s.id === "radiant-flare")!);
    expect(a.raid.lanterns![0].lit).toBe(true);
    expect(a.raid.curses.p1).toBeUndefined();
  });
  it("lights a wider circle on a Moonlit night", () => {
    const a = gloom();
    const edge = { x: lantern.x + GLOOMSHADE.lightRadius + 15, y: lantern.y };
    a.raid.trait = "hollow";
    expect(a.lit(edge.x, edge.y)).toBe(false);
    a.raid.trait = "moonlit";
    expect(a.lit(edge.x, edge.y)).toBe(true);
  });
  it("lights a patch of floor where Voltkit's Ball Lightning lands", () => {
    const a = gloom();
    park(a);
    const p = place(a, "p0", 800, 800);
    p.lastInput = { ...blankInput(), aimX: 1100, aimY: 800 };
    expect(a.lit(1100, 800)).toBe(false);
    a.cast(p, CHARACTERS.voltkit.skills.find((s) => s.id === "ball-lightning")!);
    expect(a.lit(1100, 800)).toBe(true);
    run(a, GLOOMSHADE.sparkLight + 0.2);
    expect(a.lit(1100, 800)).toBe(false);
  });
});

describe("Creeping Curse", () => {
  it("haunts at three stacks, hurts over time, and lantern light cleanses it", () => {
    const a = gloom(["voltkit", "terradon"]);
    park(a);
    place(a, "p0", 800, 800);
    place(a, "p1", 1500, 100);
    for (let i = 0; i < 3; i++) {
      warn(a, { kind: "curse", targetId: "p0", at: a.time + 0.05, lockAt: a.time });
      run(a, 0.1);
    }
    expect(a.raid.curses!.p0.hauntedUntil).toBeGreaterThan(a.time);
    run(a, 1);
    expect(hurt(a, "p0")).toBeGreaterThan(3);
    expect(hurt(a, "p1")).toBe(0);
    place(a, "p0", lantern.x + 40, lantern.y);
    run(a, GLOOMSHADE.curse.cleanseSeconds + 0.2);
    expect(a.raid.curses!.p0).toBeUndefined();
  });
  it("spreads to a teammate who stays close for two seconds", () => {
    const a = gloom(["voltkit", "terradon"]);
    park(a);
    if (a.raid.trait === "restless-spirits") a.raid.trait = "hollow";
    place(a, "p0", 800, 800);
    place(a, "p1", 860, 800);
    a.raid.curses = { p0: { stacks: 1, hauntedUntil: 0 } };
    run(a, 1.5);
    expect(a.raid.curses.p1).toBeUndefined();
    run(a, 0.7);
    expect(a.raid.curses.p1?.stacks).toBe(1);
  });
  it("grows on a solo raider who stands still", () => {
    const a = gloom();
    park(a);
    place(a, "p0", 800, 800);
    a.raid.curses = { p0: { stacks: 1, hauntedUntil: 0 } };
    run(a, GLOOMSHADE.curse.soloStill + 0.3);
    expect(a.raid.curses.p0.stacks).toBe(2);
  });
});

describe("Mirror Split", () => {
  it("splits into copies (one fewer when solo) on separate spots", () => {
    const party = gloom(["voltkit", "terradon"]);
    if (party.raid.trait !== "restless-spirits") party.raid.trait = "restless-spirits";
    warn(party, { kind: "split", at: party.time + 0.05 });
    run(party, 0.1);
    expect(party.raid.decoys).toHaveLength(GLOOMSHADE.split.copies - 1);
    const solo = gloom();
    solo.raid.trait = "restless-spirits";
    warn(solo, { kind: "split", at: solo.time + 0.05 });
    run(solo, 0.1);
    expect(solo.raid.decoys).toHaveLength(GLOOMSHADE.split.copies - 2);
    const boss = party.boss()!;
    const spots = [boss, ...party.raid.decoys!].map((d) => `${Math.round(d.x)},${Math.round(d.y)}`);
    expect(new Set(spots).size).toBe(spots.length);
  });
  it("curses whoever hits a copy, and the feat is lost", () => {
    const a = gloom(["voltkit", "terradon"]);
    a.raid.trait = "restless-spirits";
    warn(a, { kind: "split", at: a.time + 0.05 });
    run(a, 0.1);
    a.raid.exposedUntil = a.time + 999;
    const copy = a.raid.decoys![0];
    place(a, "p0", copy.x + 90, copy.y);
    const before = a.raid.decoys!.length;
    swing(a, "p0", copy.x, copy.y);
    expect(a.raid.decoys).toHaveLength(before - 1);
    expect(a.raid.decoys!.some((d) => d.id === copy.id)).toBe(false);
    expect(a.raid.curses!.p0.stacks).toBe(1);
    expect(a.decoyHits).toBe(1);
    a.raid.result = "victory";
    expect(a.feat()).toBe(false);
  });
  it("is exposed by six hits in a row on the real one, and the copies vanish", () => {
    const a = gloom(["voltkit", "terradon"]);
    a.raid.trait = "restless-spirits";
    warn(a, { kind: "split", at: a.time + 0.05 });
    run(a, 0.1);
    const boss = a.boss()!;
    for (let i = 0; i < GLOOMSHADE.exposeHits - 1; i++) {
      a.damage(boss, 5, "p0");
      run(a, 0.25);
    }
    expect(a.raid.exposedUntil).toBeLessThanOrEqual(a.time);
    // The sixth counts from anyone: each raider has their own short gap.
    a.damage(boss, 5, "p1");
    expect(a.raid.exposedUntil).toBeGreaterThan(a.time);
    expect(a.raid.decoys).toEqual([]);
    a.raid.result = "victory";
    expect(a.feat()).toBe(true);
  });
  it("only counts hits in a row while there are copies to find", () => {
    const a = gloom(["voltkit"]);
    const boss = a.boss()!;
    for (let i = 0; i < GLOOMSHADE.exposeHits + 2; i++) {
      a.damage(boss, 5, "p0");
      run(a, 0.25);
    }
    expect(a.raid.streak).toBe(0);
    expect(a.raid.exposedUntil).toBeLessThanOrEqual(a.time);
  });
  it("is revealed by Mystowl's Focus Ray and Duskveil's Curse Mark", () => {
    const a = gloom(["mystowl", "duskveil"]);
    const boss = park(a, 800, 430);
    const owl = place(a, "p0", 400, 430);
    owl.lastInput = { ...blankInput(), aimX: 1200, aimY: 430 };
    a.cast(owl, CHARACTERS.mystowl.skills.find((s) => s.id === "focus-ray")!);
    expect(a.raid.revealUntil).toBeCloseTo(a.time + GLOOMSHADE.revealRay);
    const dusk = place(a, "p1", 800, 800);
    dusk.lastInput = { ...blankInput(), aimX: boss.x, aimY: boss.y };
    a.cast(dusk, CHARACTERS.duskveil.skills.find((s) => s.id === "curse-mark")!);
    expect(a.raid.revealUntil).toBeCloseTo(a.time + GLOOMSHADE.revealMark);
  });
});

describe("Nightmare Pulse", () => {
  it("hurts nearby raiders unless they jump it", () => {
    const a = gloom(["voltkit", "terradon"]);
    const boss = park(a);
    place(a, "p0", boss.x + 120, boss.y);
    const jumper = place(a, "p1", boss.x - 120, boss.y);
    warn(a, { kind: "pulse", radius: GLOOMSHADE.pulse.radius, at: a.time + 0.05 });
    jumper.jumpUntil = a.time + 1;
    run(a, 0.1);
    expect(hurt(a, "p0")).toBeGreaterThan(0);
    expect(hurt(a, "p1")).toBe(0);
    expect(a.raid.revealUntil).toBeGreaterThan(a.time);
  });
});

describe("a whole run", () => {
  it("plays through every chapter with stand-ins and uses every attack", () => {
    const a = createRaidArena("SIM", "gloomshade") as GloomshadeArena;
    for (const [i, c] of (["voltkit", "lumoth", "terradon"] as CharacterId[]).entries()) a.add("b" + i, "Bot " + i, c);
    a.configure(3, false);
    a.start();
    for (const p of a.heroes()) a.standIn(p.id);
    a.phase = "playing";
    a.deadline = 480;
    const seen = new Set<string>();
    let copies = 0;
    // The test sets the boss's health itself, so each chapter lasts about a
    // minute however hard the stand-ins hit (their damage is undone).
    const chip = a.raid.maxHp / 3 / 60 / 30;
    let thirdFor = 0;
    for (let t = 0; t < 470 && !a.raid.result && thirdFor < 60; t += 1 / 30) {
      const boss = a.boss()!,
        before = boss.hp;
      a.tick(1 / 30);
      boss.hp = before - (a.phase === "playing" ? chip : 0);
      for (const w of a.raid.warnings) seen.add(w.kind);
      copies = Math.max(copies, a.raid.decoys?.length ?? 0);
      if ((a.phase as string) === "intermission") {
        for (const [id, offer] of Object.entries(a.raid.offers)) a.pickRite(id, offer[0]);
        a.tick(1 / 30);
      }
      if (a.raid.phase === 3) thirdFor += 1 / 30;
    }
    expect(a.raid.phase).toBe(3);
    expect(copies).toBeGreaterThan(0);
    for (const kind of RAID_BOSS_ATTACKS.gloomshade!) expect([...seen]).toContain(kind);
  });
});
