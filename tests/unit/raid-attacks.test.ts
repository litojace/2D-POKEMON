import { RAID, RAID_TIERS } from "../../packages/shared/src/raid";
import { describe, expect, it } from "vitest";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { RaidArena } from "../../apps/server/src/raid";
import { CHARACTERS, blankInput, type CharacterId } from "@arena/shared";
import {
  GRUMBLECRAG,
  RAID_BOSSES,
  raidAttacksOf,
  type RaidBossId,
  raidPattern,
  type RaidWarning,
} from "../../packages/shared/src/raid";

const raid = (characters: CharacterId[] = ["voltkit"], peril = 1) => {
  const a = new RaidArena("ATTACKS");
  characters.forEach((c, i) => a.add("p" + i, "Player " + i, c));
  a.configure(peril, false);
  a.start();
  a.phase = "playing";
  a.deadline = 480;
  // No surprise attacks: each test places its own warnings.
  (a as unknown as { nextAttack: number }).nextAttack = Infinity;
  return a;
};
const place = (a: RaidArena, id: string, x: number, y: number) => {
  const p = a.players.find((q) => q.id === id)!;
  p.x = x;
  p.y = y;
  return p;
};
let serial = 5000;
const warn = (
  a: RaidArena,
  w: Partial<RaidWarning> & Pick<RaidWarning, "kind">,
) => {
  const boss = a.boss()!;
  const warning = {
    id: ++serial,
    x: boss.x,
    y: boss.y,
    tx: boss.x,
    ty: boss.y,
    radius: 100,
    at: a.time,
    ...w,
  } as RaidWarning;
  a.raid.warnings.push(warning);
  return warning;
};
const hurt = (a: RaidArena, id: string) => {
  const p = a.players.find((q) => q.id === id)!;
  return CHARACTERS[p.character].health - p.hp;
};

describe("Grumblecrag's attack plan", () => {
  it("teaches volleys in phase 1, adds eruptions and shared meteors after", () => {
    expect(raidPattern(1, 1, 2)).toContain("volley");
    expect(raidPattern(1, 1, 2)).not.toContain("share");
    for (const kind of ["eruption", "share"] as const)
      expect(raidPattern(2, 1, 3)).toContain(kind);
    // Alone at Peril 1, the meteor is swapped for something dodgeable.
    expect(raidPattern(2, 1, 1)).not.toContain("share");
    for (const kind of ["volley", "share", "eruption"] as const)
      expect(raidPattern(3, 3, 4)).toContain(kind);
  });
  it("reads its health from the boss data", () => {
    const solo = raid(["voltkit"]),
      duo = raid(["voltkit", "cindrake"]);
    // A rare Gilded boss is a little tougher.
    const gild = (a: RaidArena) =>
      a.raid.gilded ? GRUMBLECRAG.health.gilded : 1;
    // Every boss is scaled up, and more so on higher Peril.
    expect(solo.raid.maxHp).toBe(
      Math.round(
        GRUMBLECRAG.health.base *
          RAID.healthScale *
          RAID.perilHealth[solo.raid.peril] *
          RAID.soloHealth * // solo raiders face a little less health
          gild(solo),
      ),
    );
    expect(duo.raid.maxHp).toBe(
      Math.round(
        (GRUMBLECRAG.health.base + GRUMBLECRAG.health.perExtraPlayer) *
          RAID.healthScale *
          RAID.perilHealth[duo.raid.peril] *
          gild(duo),
      ),
    );
  });
});

describe("rock volley", () => {
  it("hits inside the cone, misses outside it, and pillars give cover", () => {
    const a = raid(["voltkit", "cindrake", "tidefin"]);
    const boss = a.boss()!;
    place(a, "p0", 950, 450); // in the cone, clear line
    place(a, "p1", 950, 120); // far off to the side
    place(a, "p2", 640, 450); // behind the centre pillar
    warn(a, {
      kind: "volley",
      tx: boss.x - 560,
      ty: boss.y,
      radius: 560,
      spread: GRUMBLECRAG.volley.spread / 2,
    });
    a.tick();
    expect(hurt(a, "p0")).toBeCloseTo(GRUMBLECRAG.volley.damage, 0);
    expect(hurt(a, "p1")).toBe(0);
    expect(hurt(a, "p2")).toBe(0);
  });
  it("Auralynx's Facet Guard blocks it and staggers the boss", () => {
    const a = raid(["auralynx"]);
    const boss = a.boss()!;
    const p = place(a, "p0", 950, 450);
    a.status(p, "counter", 2);
    warn(a, {
      kind: "volley",
      tx: boss.x - 560,
      ty: boss.y,
      radius: 560,
      spread: 0.45,
    });
    const stagger = a.raid.stagger;
    a.tick();
    expect(hurt(a, "p0")).toBe(0);
    expect(a.raid.stagger).toBeGreaterThanOrEqual(stagger + 12);
  });
});

describe("chasing eruption", () => {
  it("follows its target: each eruption spawns the next where they now stand", () => {
    const a = raid(["voltkit"]);
    place(a, "p0", 400, 200);
    warn(a, { kind: "eruption", x: 400, y: 200, targetId: "p0", chain: 3 });
    a.tick();
    expect(hurt(a, "p0")).toBeGreaterThan(0);
    const next = a.raid.warnings.find((w) => w.kind === "eruption")!;
    expect(next.chain).toBe(2);
    place(a, "p0", 600, 760);
    for (let i = 0; i < 30 && a.raid.warnings.includes(next); i++) a.tick();
    const third = a.raid.warnings.find((w) => w.kind === "eruption")!;
    expect(third.chain).toBe(1);
    expect(Math.hypot(third.x - 600, third.y - 760)).toBeLessThan(40);
  });
});

describe("shared meteor", () => {
  it("splits its damage among everyone stacked on the target", () => {
    const a = raid(["voltkit", "cindrake", "tidefin"]);
    place(a, "p0", 400, 200);
    place(a, "p1", 430, 210);
    place(a, "p2", 900, 760);
    warn(a, { kind: "share", targetId: "p0", radius: 125 });
    a.tick();
    expect(hurt(a, "p0")).toBeCloseTo(GRUMBLECRAG.share.damage / 2, 0);
    expect(hurt(a, "p1")).toBeCloseTo(GRUMBLECRAG.share.damage / 2, 0);
    expect(hurt(a, "p2")).toBe(0);
  });
  it("hits a lone target for the full amount, and Mystowl's Wing Cloak softens it for all", () => {
    const alone = raid(["voltkit", "cindrake"]);
    place(alone, "p0", 400, 200);
    place(alone, "p1", 900, 760);
    warn(alone, { kind: "share", targetId: "p0", radius: 125 });
    alone.tick();
    expect(hurt(alone, "p0")).toBeCloseTo(GRUMBLECRAG.share.damage, 0);

    const warded = raid(["voltkit", "mystowl"]);
    place(warded, "p0", 400, 200);
    const owl = place(warded, "p1", 420, 200);
    warded.status(owl, "shield", 3);
    warn(warded, { kind: "share", targetId: "p0", radius: 125 });
    warded.tick();
    expect(hurt(warded, "p0")).toBeCloseTo(
      (GRUMBLECRAG.share.damage / 2) * (1 - GRUMBLECRAG.share.wardReduction),
      0,
    );
  });
  it("alone, it locks so it can be dodged", () => {
    const a = raid(["voltkit"]);
    place(a, "p0", 400, 200);
    const w = warn(a, {
      kind: "share",
      targetId: "p0",
      radius: 125,
      at: a.time + 0.5,
      lockAt: a.time,
    });
    place(a, "p0", 700, 760);
    for (let i = 0; i < 20; i++) a.tick();
    expect(a.raid.warnings).not.toContain(w);
    expect(hurt(a, "p0")).toBe(0);
  });
});

describe("difficulty and champions", () => {
  it("Peril raises boss damage; live raids (Peril 3) use the star tier's", () => {
    const slam = (peril: number) => {
      const a = raid(["voltkit"], peril);
      place(a, "p0", a.boss()!.x - 60, a.boss()!.y);
      warn(a, { kind: "slam", radius: 240 });
      a.tick();
      return hurt(a, "p0");
    };
    const one = slam(1),
      three = slam(3);
    expect(one).toBeCloseTo(GRUMBLECRAG.slam.damage, 0);
    // Grumblecrag is ★: its tier's damage replaces Peril 3's ×1.5.
    expect(three / one).toBeCloseTo(RAID_TIERS[1].damage, 2);
  });
  it("Terradon stops a charge head-on for half damage and a stagger", () => {
    const a = raid(["terradon"]);
    const boss = a.boss()!;
    place(a, "p0", 1050, 450);
    warn(a, { kind: "charge", tx: 500, ty: 450, radius: 80 });
    for (let i = 0; i < 20; i++) a.tick();
    expect(hurt(a, "p0")).toBeCloseTo(GRUMBLECRAG.charge.damage / 2, 0);
    expect(a.raid.stagger).toBeGreaterThanOrEqual(20);
    // It stopped at Terradon instead of running on to the pillar.
    expect(boss.x).toBeGreaterThan(900);
    expect(a.raid.pillars.every((p) => !p.broken)).toBe(true);
  });
  it("Lumoth's Kindle fills half of a fallen ally's revive", () => {
    const a = raid(["lumoth", "voltkit"]);
    const ally = place(a, "p1", 400, 300);
    place(a, "p0", 900, 700);
    a.damage(ally, 10000, a.boss()!.id);
    expect(a.raid.downed.p1).toBeDefined();
    const lumoth = place(a, "p0", 450, 300);
    a.cast(
      lumoth,
      CHARACTERS.lumoth.skills.find((s) => s.id === "kindle")!,
    );
    expect(a.raid.downed.p1.progress).toBeGreaterThanOrEqual(0.5);
  });
  it("remembers what downed each raider", () => {
    const a = raid(["voltkit", "cindrake"]);
    const p = place(a, "p0", a.boss()!.x - 50, a.boss()!.y);
    p.hp = 1;
    warn(a, { kind: "slam", radius: 240 });
    a.tick();
    expect(a.raid.downed.p0.cause).toBe("slam");
    expect(a.downCauses.slam).toBe(1);
    expect(a.raid.contributions!.p0.downs).toBe(1);
  });
});

describe("pings, practice and stand-ins", () => {
  it.each(Object.keys(RAID_BOSSES) as RaidBossId[])(
    "%s practice accepts movement immediately without a countdown or rite choice",
    (boss) => {
      const a = createRaidArena("DRILL", boss);
      const hero = a.add("p0", "Learner", "voltkit");
      expect(a.startDrill(raidAttacksOf(boss)[0])).toBe(true);
      expect(a.phase).toBe("playing");
      expect(a.raid.offers).toEqual({});
      const y = hero.y;
      hero.lastInput = { ...blankInput(), dy: 1 };
      a.tick();
      expect(hero.y).toBeGreaterThan(y);
      expect(a.raid.elapsed).toBeGreaterThan(0);
      expect(a.raid.warnings).toHaveLength(0);
      expect(a.stopDrill()).toBe(true);
      expect(a.phase).toBe("lobby");
      expect(a.startDrill(raidAttacksOf(boss)[0])).toBe(true);
      expect(a.phase).toBe("playing");
    },
  );

  it("shows a ping for a few seconds and limits spam", () => {
    const a = raid(["voltkit", "cindrake"]);
    expect(a.ping("p0", "stack")).toBe(true);
    expect(a.ping("p0", "bait")).toBe(false);
    for (let i = 0; i < 40; i++) a.tick();
    expect(a.ping("p0", "revive")).toBe(true);
    expect(a.raid.pings!.filter((q) => q.playerId === "p0")).toHaveLength(1);
    for (let i = 0; i < 130; i++) a.tick();
    expect(a.raid.pings).toHaveLength(0);
    expect(a.ping("boss-or-stranger", "stack")).toBe(false);
  });
  it("practice repeats one attack, counts hits without hurting anyone, then returns to the lobby", () => {
    const a = new RaidArena("DRILL");
    a.add("p0", "Learner", "voltkit");
    expect(a.startDrill("volley")).toBe(true);
    expect(a.phase).toBe("playing");
    for (let i = 0; i < 30 * 12; i++) a.tick();
    expect(a.phase).toBe("playing");
    const stats = a.raid.drillStats!;
    expect(stats.hits + stats.dodges).toBeGreaterThan(0);
    const p = a.heroes()[0];
    expect(p.hp).toBe(CHARACTERS.voltkit.health);
    const boss = a.boss()!,
      before = boss.hp;
    a.damage(boss, 500, p.id);
    expect(boss.hp).toBe(before);
    expect(a.raid.result).toBeNull();
    expect(a.setDrill("charge")).toBe(true);
    expect(a.raid.drill).toBe("charge");
    expect(a.stopDrill()).toBe(true);
    expect(a.phase).toBe("lobby");
    expect(a.boss()).toBeUndefined();
  });
  it("an AI stand-in dodges telegraphs, stacks for meteors and hands back control", () => {
    const a = raid(["voltkit", "cindrake"]);
    expect(a.standIn("p1")).toBe(true);
    expect(a.raid.standIns).toEqual(["p1"]);
    const bot = place(a, "p1", 500, 300);
    place(a, "p0", 900, 700);
    warn(a, { kind: "debris", x: 520, y: 300, radius: 95, at: a.time + 1 });
    const flee = a.botInput(bot, blankInput());
    expect(flee.dx).toBeLessThan(0);
    a.raid.warnings = [];
    warn(a, { kind: "share", targetId: "p0", x: 900, y: 700, at: a.time + 2 });
    const stack = a.botInput(bot, blankInput());
    expect(stack.dx).toBeGreaterThan(0);
    expect(stack.dy).toBeGreaterThan(0);
    expect(a.release("p1")).toBe(true);
    expect(a.bots.has("p1")).toBe(false);
  });
  it("the final phase attacks faster than the first", () => {
    const a = raid(["voltkit"]);
    const cadence = () => (a as unknown as { cadence(): number }).cadence();
    const first = cadence();
    a.raid.phase = 3;
    expect(cadence()).toBeLessThan(first);
  });
});

describe("boss health by Peril", () => {
  it("grows with Peril, so higher Peril fights last longer", () => {
    const hp = (peril: number) => {
      const a = raid(["voltkit"]);
      a.raid.peril = peril;
      a.start();
      return a.raid.maxHp / (a.raid.gilded ? GRUMBLECRAG.health.gilded : 1);
    };
    expect(hp(1)).toBeCloseTo(
      GRUMBLECRAG.health.base * RAID.healthScale * RAID.soloHealth,
      -1,
    );
    expect(hp(2)).toBeGreaterThan(hp(1));
    expect(hp(3)).toBeGreaterThan(hp(2));
  });
});

describe("boss target choice", () => {
  type Smart = {
    chooseTarget(kind: string, alive: unknown[]): { id: string };
    threat: Map<string, number>;
    lastTargetId?: string;
  };
  const smart = (a: RaidArena) => a as unknown as Smart;
  const party = (peril: number) => {
    const a = raid(["voltkit", "cindrake", "tidefin"], peril);
    place(a, "p0", 600, 450);
    place(a, "p1", 700, 450);
    place(a, "p2", 650, 520);
    return a;
  };
  const alive = (a: RaidArena) => a.heroes().filter((p) => p.hp > 0);

  it("practice keeps a plain rotation", () => {
    const a = raid(["voltkit", "cindrake"]);
    a.raid.drill = "slam" as never;
    const picks = new Set<string>();
    for (let i = 0; i < 4; i++) {
      (a as unknown as { attacks: number }).attacks = i;
      picks.add(smart(a).chooseTarget("slam", alive(a)).id);
    }
    expect(picks.size).toBe(2);
  });
  it("turns on whoever is hurting it most", () => {
    const a = party(3);
    smart(a).threat.set("p2", 400);
    smart(a).threat.set("p0", 20);
    expect(smart(a).chooseTarget("slam", alive(a)).id).toBe("p2");
  });
  it("punishes a raider kneeling to revive a fallen ally", () => {
    const a = party(3);
    const down = a.players.find((p) => p.id === "p1")!;
    down.hp = 0;
    place(a, "p2", down.x + 40, down.y);
    place(a, "p0", 200, 200);
    expect(smart(a).chooseTarget("slam", alive(a)).id).toBe("p2");
  });
  it("throws a charge at the raider keeping their distance", () => {
    const a = party(3);
    const boss = a.boss()!;
    place(a, "p0", boss.x + 80, boss.y);
    place(a, "p1", boss.x - 90, boss.y);
    place(a, "p2", 100, 100);
    expect(smart(a).chooseTarget("charge", alive(a)).id).toBe("p2");
  });
  it("rarely picks the same raider twice in a row", () => {
    const a = party(2);
    let repeats = 0;
    for (let i = 0; i < 40; i++) {
      (a as unknown as { attacks: number }).attacks = i;
      const id = smart(a).chooseTarget("slam", alive(a)).id;
      if (id === smart(a).lastTargetId) repeats++;
      smart(a).lastTargetId = id;
    }
    expect(repeats).toBe(0);
  });
});

describe("volley aim", () => {
  type Aim = {
    warnVolley(t: unknown, teach: boolean): { tx: number; ty: number };
    motion: Map<string, { t: number; vx: number; vy: number }[]>;
  };
  // `was` is how the raider was moving 0.3 s ago.
  const aim = (peril: number, was = { vx: 0, vy: 300 }) => {
    const a = raid(["voltkit"], peril);
    const boss = a.boss()!;
    const p = place(a, "p0", boss.x - 300, boss.y);
    p.vx = 0;
    p.vy = 300; // running down the screen
    (a as unknown as Aim).motion.set("p0", [{ t: a.time - 0.3, ...was }]);
    const w = (a as unknown as Aim).warnVolley(p, false);
    // How far the cone's centre line passes ahead of the raider (px).
    const d = Math.hypot(w.tx - boss.x, w.ty - boss.y);
    return ((w.ty - boss.y) / d) * 300;
  };
  it("aims straight at the raider on Peril 1 and a little ahead from Peril 2", () => {
    expect(Math.abs(aim(1))).toBeLessThan(1);
    expect(aim(2)).toBeGreaterThan(20);
  });
  it("on Peril 3 leads only a raider running straight, never past the tier's cap", () => {
    // ★ tier: 55% of the travel, at most 110 px.
    expect(aim(3)).toBeLessThanOrEqual(RAID_TIERS[1].leadCap + 1);
    expect(aim(3)).toBeGreaterThan(60);
    // Just turned (was running across the screen): not led at all.
    expect(Math.abs(aim(3, { vx: 300, vy: 0 }))).toBeLessThan(1);
    // Standing still 0.3 s ago (just started): not led either.
    expect(Math.abs(aim(3, { vx: 0, vy: 0 }))).toBeLessThan(1);
  });
});
