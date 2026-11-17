/**
 * Ascendant Lumiwick (the Spire's sixtieth floor, Emberwing's id): harder
 * and smarter than the raid's Lumiwick, but fair. Its tier, pattern, new
 * moves (Snuffing Gale, Bound Wicks), feints, combos, overlap rule, shorter
 * openings and reads; its rules layer off for the ordinary raid and for
 * other bosses. Each move's fairness is checked here: a safe spot always
 * exists (never under a phone's touch controls), every warning is on screen
 * at least the raid's floor, and a dodger who reacts in 0.45 s at the
 * slowest speed is never hit (for the gale: such a keeper always reaches
 * the flame in time; for Bound Wicks: such a team always lights them before
 * the fuse burns out). Nothing a raider must see or reach (braziers, their
 * shelters, the open heart) sits under the controls. The whole raid also
 * keeps the honesty rules raid-fairness.test.ts checks for the other bosses.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTERS,
  RULES,
  type CharacterId,
  type Fighter,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { EmberwingArena } from "../../apps/server/src/raid-emberwing";
import {
  AscendantLumiwickArena,
  AscendantLumiwickRules,
  LUMI_SPATIAL,
  lumiShapeHits,
  lumiUnderControls,
  ringWalk,
  wickFuse,
  wickWalk,
} from "../../apps/server/src/raid-ascendant-lumiwick";
import {
  RAID_EXCLUSIVE_ATTACKS,
  RAID_FREEZE,
  RAID_HARMLESS_ATTACKS,
  RAID_JUMP_ATTACKS,
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  raidShapeOf,
  type RaidSituation,
} from "../../apps/server/src/raid-ai";
import {
  ASCENDANT_LUMIWICK as A,
  EMBERWING as E,
  RAID,
  RAID_ASCENDANT_TIER,
  RAID_ATTACKS,
  RAID_TELEGRAPH_FLOOR,
  ascendantLumiwickPattern,
  emberwingPattern,
  isAscendant,
  raidAttacksOf,
  raidBossName,
  raidChapters,
  raidPattern,
  raidSoloRevive,
  raidTierOf,
  type RaidAttack,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import { BOSS_ATTACK_ART } from "../../apps/client/src/boss-attack-art";

const DT = 1 / 30;
const EPS = 1e-6;
type Inner = AscendantLumiwickArena & { [key: string]: any };
type Point = { x: number; y: number };
const TEAM: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
const arena = (
  size = 1,
  phase = 1,
  form: "ascendant" | "raid" = "ascendant",
) => {
  const variant = form === "raid" ? undefined : form;
  const a = createRaidArena("ASC", "emberwing", { variant }) as Inner;
  TEAM.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configure(3, false);
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 600;
  a.raid.phase = phase;
  a.raid.trait = "restless";
  a.started = true;
  a.nextAttack = Infinity;
  if (form === "ascendant") a.takeoff();
  return a;
};
const place = (p: Fighter, x: number, y: number) =>
  Object.assign(p, { x, y, vx: 0, vy: 0 });
const run = (a: Inner, seconds: number) => {
  for (let t = 0; t < seconds; t += DT) {
    a.tick(DT);
    a.nextAttack = Infinity;
  }
};
const hurt = (p: Fighter) => CHARACTERS[p.character].health - p.hp;
/** Cast one attack as the boss would (its own cast number), settled. */
const cast = (a: Inner, kind: RaidAttack, target: Fighter) => {
  a.currentCast = ++a.castSerial;
  const before = new Set(a.raid.warnings);
  a.startAttack(kind, target);
  a.settleWarnings();
  const fresh = a.raid.warnings.filter((w: RaidWarning) => !before.has(w));
  a.currentCast = 0;
  return fresh as RaidWarning[];
};
const of = (a: Inner, kind: RaidAttack) =>
  a.raid.warnings.filter((w: RaidWarning) => w.kind === kind) as RaidWarning[];
const lit = (a: Inner, i: number) => a.raid.braziers![i].litUntil > a.time;
const light = (a: Inner, i: number) => {
  a.raid.braziers![i].progress = 1;
  a.raid.braziers![i].litUntil = a.time + 60;
};
/** Repeatable runs: the raid seeds itself through Web Crypto. */
const seeded = (seed: number) => {
  let s = seed >>> 0;
  vi.spyOn(crypto, "getRandomValues").mockImplementation(((
    buffer: Uint32Array,
  ) => {
    for (let i = 0; i < buffer.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      buffer[i] = s;
    }
    return buffer;
  }) as never);
};
afterEach(() => vi.restoreAllMocks());
const prng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};
/** A spot on the court clear of the phone's controls. */
const anywhere = (random: () => number, pad = 120) => {
  let x = 0,
    y = 0;
  do {
    x = pad + random() * (1600 - 2 * pad);
    y = pad + random() * (900 - 2 * pad);
  } while (lumiUnderControls(x, y, RULES.radius, 0));
  return { x, y };
};
/** Raiders hurt this tick by one of the moves being checked (see `track`). */
const lastHits = new Set<string>();
function track(a: Inner, moves: RaidAttack[]) {
  const hit = a.damage.bind(a);
  a.damage = (target: Fighter, amount: number, owner: string, ab?: any) => {
    if (!target.raidBoss && moves.includes(a.hitBy)) lastHits.add(target.id);
    return hit(target, amount, owner, ab);
  };
}
/** Hold everyone's health up (a test of dodging, not of surviving). */
const sturdy = (a: Inner) => {
  for (const p of a.heroes()) if (p.hp > 0) p.hp = 99999;
};
/** Walk `p` toward `to` at the slowest speed for one tick (stop within `near`). */
const step = (p: Fighter, to: Point, near = 0) => {
  const d = Math.hypot(to.x - p.x, to.y - p.y);
  if (d <= near) {
    p.vx = p.vy = 0;
    return;
  }
  const v = Math.min(RAID_SLOWEST_SPEED, (d - near) / DT);
  p.vx = ((to.x - p.x) / d) * v;
  p.vy = ((to.y - p.y) / d) * v;
  p.x += p.vx * DT;
  p.y += p.vy * DT;
};
/**
 * A scripted dodger: every raider sees each warning as it was 0.45 s ago and
 * walks at the slowest champion's speed to the nearest spot the arena's own
 * safe-spot rule calls clear (outside lanes, circles and Backdrafts, a
 * brazier's ring sheltering from a gale, clear of the phone's controls).
 * Returns the ids hurt by the tracked moves.
 */
function dodge(a: Inner, seconds: number) {
  const history = new Map<number, { t: number; w: RaidWarning }[]>();
  const goals = new Map<string, Point>();
  const hits = new Set<string>();
  for (let t = 0; t < seconds; t += DT) {
    for (const w of a.raid.warnings) {
      const list = history.get(w.id) ?? [];
      list.push({ t: a.time, w: { ...w } });
      history.set(w.id, list);
    }
    const seen = (a.raid.warnings as RaidWarning[])
      .map(
        (w) =>
          history
            .get(w.id)!
            .filter((s) => s.t <= a.time - RAID_REACTION + EPS)
            .at(-1)?.w,
      )
      .filter((w) => w && LUMI_SPATIAL.has(w.kind))
      .map((w) => ({ ...w!, radius: w!.radius + 6 })) as RaidWarning[];
    for (const p of a.heroes()) {
      if (p.hp <= 0) continue;
      if (a.lumiClear(seen, p.x, p.y)) {
        p.vx = p.vy = 0;
        continue;
      }
      let spot = goals.get(p.id);
      if (!spot || !a.lumiClear(seen, spot.x, spot.y)) {
        spot = undefined;
        for (let r = 10; r <= 600 && !spot; r += 10)
          for (let i = 0; i < 48; i++) {
            const ang = (i / 48) * Math.PI * 2;
            const x = p.x + Math.cos(ang) * r,
              y = p.y + Math.sin(ang) * r;
            if (a.lumiClear(seen, x, y)) {
              spot = { x, y };
              break;
            }
          }
        if (spot) goals.set(p.id, spot);
      }
      if (spot) step(p, spot);
    }
    lastHits.clear();
    a.tick(DT);
    for (const id of lastHits) hits.add(id);
    a.nextAttack = Infinity;
    if (
      !a.raid.warnings.some((w: RaidWarning) => LUMI_SPATIAL.has(w.kind)) &&
      !a.charging &&
      t > 0.5
    )
      break;
  }
  return [...hits];
}
/** A point on the lane from the gale's start toward its end, `k` px along. */
const along = (w: RaidWarning, k: number) => {
  const d = Math.hypot(w.tx - w.x, w.ty - w.y) || 1;
  return { x: w.x + ((w.tx - w.x) / d) * k, y: w.y + ((w.ty - w.y) / d) * k };
};

describe("the Ascendant tier", () => {
  it("is the shared Ascendant row, with no solo revive", () => {
    expect(raidTierOf("emberwing", "ascendant")).toBe(RAID_ASCENDANT_TIER);
    expect(raidSoloRevive("emberwing", "ascendant")).toBeUndefined();
    const a = arena(1);
    expect(a.raid.variant).toBe("ascendant");
    expect(isAscendant(a.raid, "emberwing")).toBe(true);
    expect(a.tier().reviveSeconds).toBe(A.reviveSeconds);
  });
  it("never shortens a telegraph below the floor; Bound Wicks' fuse keeps its length", () => {
    const a = arena(1);
    for (const s of [0.9, 1.1, 1.25, 1.5, 1.75, 1.9, 2, 2.5])
      for (const kind of ["dive-bomb", "snuff-gale", "scorched-earth"] as const)
        expect(a.telegraph(kind, s)).toBeGreaterThanOrEqual(
          Math.min(s, RAID_TELEGRAPH_FLOOR),
        );
    expect(a.telegraph("bound-wicks", 7.3)).toBe(7.3);
    expect(a.telegraph("ember-rain", E.rain.delay)).toBe(E.rain.delay);
    expect(a.telegraph("flame-ring", E.ring.delay)).toBe(E.ring.delay);
  });
  it("health: the tier's formula alone; per extra raider, ASCENDANT_LUMIWICK.perExtraPlayer", () => {
    const solo = arena(1).raid.maxHp;
    for (const size of [2, 3, 4]) {
      const hp = arena(size).raid.maxHp;
      const want =
        ((solo / RAID.soloHealth) *
          (E.health.base + A.perExtraPlayer * (size - 1))) /
        E.health.base;
      expect(hp / want).toBeGreaterThan(0.97);
      expect(hp / want).toBeLessThan(1.03);
    }
  });
  it("hits by party size as ASCENDANT_LUMIWICK.damage sets (never past ×1.2); windows as set", () => {
    for (const size of [1, 2, 3, 4]) {
      const a = arena(size);
      expect(A.damage[size - 1]).toBeLessThanOrEqual(1.2);
      expect(a.bossDamage()).toBeCloseTo(
        RAID_ASCENDANT_TIER.damage *
          A.damage[size - 1] *
          (1 + A.partyDamage * (size - 1)),
      );
      expect(a.window(6)).toBeCloseTo(
        6 * RAID_ASCENDANT_TIER.windows * (1 + A.partyWindows * (size - 1)),
      );
      expect(a.exposeSeconds()).toBeCloseTo(
        A.expose * (1 + A.partyWindows * (size - 1)),
      );
    }
  });
  it("no ordinary hit takes more than 60% of the frailest champion's health, at any party size", () => {
    const frail = Math.min(...Object.values(CHARACTERS).map((c) => c.health));
    const weakest = (Object.keys(CHARACTERS) as CharacterId[]).find(
      (id) => CHARACTERS[id].health === frail,
    )!;
    const kit = {
      "dive-bomb": E.dive.damage,
      "ember-rain": E.rain.damage,
      "wing-gust": E.gust.damage,
      "flame-ring": E.ring.damage,
      "heat-mark": E.heat.damage,
      "snuff-gale": A.gale.damage,
      "bound-wicks": A.wicks.damage,
    };
    for (const size of [1, 2, 3, 4]) {
      const a = arena(size);
      for (const [kind, base] of Object.entries(kit))
        expect(
          base * a.bossDamage(),
          `${kind} with ${size}`,
        ).toBeLessThanOrEqual(0.6 * frail);
      // and a real dive on the frailest champion agrees
      const b = createRaidArena("CAP", "emberwing", {
        variant: "ascendant",
      }) as Inner;
      for (let i = 0; i < size; i++)
        b.add("p" + i, "P" + i, i === 0 ? weakest : TEAM[i]);
      b.configure(3, false);
      b.start();
      b.phase = "playing";
      b.started = true;
      b.nextAttack = Infinity;
      const p = b.heroes()[0];
      place(p, 500, 450);
      for (const q of b.heroes().slice(1)) place(q, 300, 150);
      p.immuneUntil = 0;
      b.seenAttacks.set("dive-bomb", 5);
      b.lumiFeintRoll = () => false;
      const [lane] = cast(b, "dive-bomb", p);
      run(b, lane.at - b.time + 0.6);
      expect(hurt(p), `dive with ${size}`).toBeGreaterThan(0);
      expect(hurt(p), `dive with ${size}`).toBeLessThanOrEqual(0.6 * frail);
    }
  });
  it("its rhythm tightens by chapter (the ordinary raid's does not)", () => {
    const gaps = [1, 2, 3].map((phase) => arena(4, phase).cadence());
    expect(gaps[1]).toBeLessThan(gaps[0]);
    expect(gaps[2]).toBeLessThan(gaps[1]);
    for (const phase of [1, 2, 3])
      expect(arena(4, phase).cadence()).toBeLessThan(
        arena(4, phase, "raid").cadence(),
      );
    // more raiders, more attacks
    expect(arena(4, 2).cadence()).toBeLessThan(arena(2, 2).cadence());
  });
});

describe("the layer acts only for Lumiwick's Ascendant form", () => {
  it("the ordinary raid keeps its class, pattern, braziers, home, light and name", () => {
    const a = arena(2, 1, "raid");
    expect(a).toBeInstanceOf(EmberwingArena);
    expect(a).not.toBeInstanceOf(AscendantLumiwickArena);
    expect(a.raid.variant).toBeUndefined();
    expect(a.pattern()).toEqual(emberwingPattern(1, "restless"));
    expect(a.raid.braziers!.map((b) => ({ x: b.x, y: b.y }))).toEqual(
      E.braziers.map((b) => ({ ...b })),
    );
    expect(a.hoverHome()).toEqual(E.home);
    expect(a.lightSeconds()).toBe(E.lightSeconds);
    expect(a.fliesFrom()).toBe(2);
    expect(a.exposeSeconds()).toBe(E.expose);
    expect(raidBossName(a.raid)).toBe("Lumiwick");
    expect(raidAttacksOf("emberwing")).toHaveLength(6);
  });
  it("is off on an Emberwing arena that isn't Ascendant", () => {
    const Layered = AscendantLumiwickRules(EmberwingArena);
    const a = new Layered("L", "emberwing") as unknown as Inner;
    a.add("p0", "P0", "voltkit");
    a.configure(3, false);
    a.start();
    expect(a.raid.variant).toBeUndefined();
    expect(a.lumiAscendant()).toBe(false);
    expect(a.pattern()).toEqual(emberwingPattern(a.raid.phase, a.raid.trait));
    expect(a.raid.braziers!.map((b) => b.x)).toEqual(
      E.braziers.map((b) => b.x),
    );
    expect(a.exposeSeconds()).toBe(
      E.expose + (a.raid.trait === "updraft" ? 2 : 0),
    );
    expect(a.lightSeconds()).toBe(E.lightSeconds);
  });
  it("is off for another boss's Ascendant form", () => {
    const Layered = AscendantLumiwickRules(EmberwingArena);
    const a = new Layered("L", "grumblecrag") as unknown as Inner;
    a.add("p0", "P0", "voltkit");
    a.configure(3, false);
    a.start();
    a.raid.variant = "ascendant";
    expect(isAscendant(a.raid, "emberwing")).toBe(false);
    expect(a.lumiAscendant()).toBe(false);
  });
});

describe("Ascendant Lumiwick's kit", () => {
  it("has a name, never a Gilded look, and keeps both across retries", () => {
    for (let i = 0; i < 6; i++) {
      const a = arena(2);
      expect(a.raid.name).toBe(A.name);
      expect(a.raid.gilded).toBeFalsy();
      expect(a.boss()!.hp).toBe(a.raid.maxHp);
      a.retry();
      a.start();
      expect(a.raid.name).toBe(A.name);
      expect(a.raid.variant).toBe("ascendant");
      expect(a.raid.gilded).toBeFalsy();
    }
  });
  it("plays both new moves every chapter, and keeps the raid's kit", () => {
    for (const phase of [1, 2, 3]) {
      const p = raidPattern(phase, 3, 4, "emberwing", "ascendant");
      expect(p).toEqual(ascendantLumiwickPattern(phase));
      expect(p).toContain("snuff-gale");
      expect(p).toContain("bound-wicks");
      expect(p).toContain("dive-bomb");
      expect(p).toContain("ember-rain");
      expect(arena(4, phase).pattern()).toEqual(
        ascendantLumiwickPattern(phase, "restless"),
      );
    }
    // the raid's traits still apply
    expect(ascendantLumiwickPattern(1, "smouldering")).not.toContain(
      "ember-rain",
    );
    expect(
      ascendantLumiwickPattern(2, "molting").filter((k) => k === "dive-bomb"),
    ).toHaveLength(2);
    expect(raidChapters("emberwing", "ascendant").map((c) => c.name)).toEqual([
      "Lantern Rising",
      "Tethered Flames",
      "Ascendant Lantern",
    ]);
  });
  it("its new attacks have guide text, a glyph, a shape and a place in the guide", () => {
    for (const kind of ["snuff-gale", "bound-wicks"] as RaidAttack[]) {
      expect(RAID_ATTACKS[kind].name.length).toBeGreaterThan(3);
      expect(RAID_ATTACKS[kind].tip.length).toBeGreaterThan(20);
      expect(RAID_ATTACKS[kind].summary.length).toBeGreaterThan(10);
    }
    expect(raidShapeOf("snuff-gale")).toBe("line");
    expect(raidShapeOf("bound-wicks")).toBe("field");
    expect(RAID_HARMLESS_ATTACKS.has("bound-wicks")).toBe(true);
    expect(RAID_EXCLUSIVE_ATTACKS.has("snuff-gale")).toBe(false);
    const guide = raidAttacksOf("emberwing", "ascendant");
    expect(guide).toEqual(
      expect.arrayContaining(["snuff-gale", "bound-wicks"]),
    );
    expect(guide).toHaveLength(8);
    for (const kind of guide) expect(BOSS_ATTACK_ART, kind).toContain(kind);
  });
  it("refuses to come down: it flies from chapter 1 and its braziers are slower to catch", () => {
    const a = arena(2, 1);
    expect(a.fliesFrom()).toBe(1);
    expect(a.lightSeconds()).toBe(A.light);
    expect(A.light).toBeGreaterThan(E.lightSeconds);
    a.ground();
    expect(a.raid.airborne).toBe(false);
    run(a, a.raid.exposedUntil - a.time + 0.2);
    expect(a.raid.airborne).toBe(true);
  });
});

describe("the phone's touch controls", () => {
  it("no brazier ring (nor a raider anywhere in one) sits under or near one", () => {
    for (const b of A.braziers)
      expect(
        lumiUnderControls(b.x, b.y, E.brazierRadius + RULES.radius),
        `${b.x},${b.y}`,
      ).toBe(false);
    // the raid's own triangle has one under the smallest phone's buttons
    expect(
      E.braziers.some((b) =>
        lumiUnderControls(b.x, b.y, E.brazierRadius + RULES.radius),
      ),
    ).toBe(true);
    // and the arena really uses them
    expect(arena(2).raid.braziers!.map((b) => ({ x: b.x, y: b.y }))).toEqual(
      A.braziers.map((b) => ({ ...b })),
    );
  });
  it("its heart hovers clear of them, aloft or grounded (the raid's home is not)", () => {
    for (const air of [true, false]) {
      const sway = air ? A.sway.air : A.sway.ground;
      for (let k = -1; k <= 1; k += 0.05)
        for (const dy of [-40, 0, 40])
          expect(
            lumiUnderControls(A.home.x + k * sway, A.home.y + dy, A.heartClear),
            `${air} ${k}`,
          ).toBe(false);
    }
    expect(lumiUnderControls(E.home.x, E.home.y, A.heartClear)).toBe(true);
    // the boss really hovers there
    const a = arena(2, 2);
    a.boss()!.x = 1200;
    run(a, 12);
    for (let t = 0; t < 8; t += 0.5) {
      run(a, 0.5);
      expect(lumiUnderControls(a.boss()!.x, a.boss()!.y, A.heartClear)).toBe(
        false,
      );
    }
  });
  it("brought down under the controls (after a dive), the open heart glides out in moments", () => {
    for (const [x, y] of [
      [1350, 600],
      [120, 760],
      [1280, 420],
    ]) {
      const a = arena(2, 2);
      Object.assign(a.boss()!, { x, y });
      a.ground();
      expect(lumiUnderControls(x, y, A.heartClear)).toBe(true);
      run(a, 0.9);
      expect(
        lumiUnderControls(a.boss()!.x, a.boss()!.y, A.heartClear),
        `${x},${y}`,
      ).toBe(false);
      expect(a.raid.exposedUntil).toBeGreaterThan(a.time);
    }
  });
  it("knows the controls: each box's middle is under, the court's middle is not", () => {
    for (const [x0, y0, x1, y1] of A.phoneControls)
      expect(lumiUnderControls((x0 + x1) / 2, (y0 + y1) / 2)).toBe(true);
    expect(lumiUnderControls(800, 450, 100)).toBe(false);
  });
  it("the safe-spot rule never counts a spot under the controls", () => {
    const a = arena(1);
    expect(a.lumiClear([], 1500, 700)).toBe(false);
    expect(a.lumiClear([], 60, 760)).toBe(false);
    expect(a.lumiClear([], 800, 450)).toBe(true);
    // A raider deep under the buttons with embers landing soon far away:
    // the only ground in reach is under the controls, so no spot counts.
    const p = a.heroes()[0];
    place(p, 1500, 700);
    const w = {
      id: 1,
      kind: "ember-rain",
      x: 400,
      y: 400,
      tx: 400,
      ty: 400,
      radius: 48,
      at: a.time + RAID_REACTION + 0.1,
      startedAt: a.time,
    } as RaidWarning;
    expect(a.safeSpotExists([w])).toBe(false);
    place(p, 800, 700);
    expect(a.safeSpotExists([w])).toBe(true);
    const random = prng(3);
    for (let i = 0; i < 300; i++) {
      place(p, 40 + random() * 1520, 40 + random() * 820);
      const c = {
        ...w,
        x: p.x + (random() - 0.5) * 200,
        y: p.y + (random() - 0.5) * 200,
        radius: 60 + random() * 120,
        at: a.time + 0.9 + random(),
      };
      const spot = a.lumiSpotNear([c], p, 300);
      if (spot) expect(lumiUnderControls(spot.x, spot.y, 0, 0)).toBe(false);
    }
  });
});

describe("the Snuffing Gale", () => {
  it("blows through a burning brazier someone can reach; nobody in its ring: the flame goes out", () => {
    const a = arena(2, 2);
    const [p0, p1] = a.heroes();
    light(a, 1);
    place(p0, A.braziers[1].x + 120, A.braziers[1].y); // near, not in it
    place(p1, 300, 150);
    a.seenAttacks.set("snuff-gale", 5);
    const [w] = cast(a, "snuff-gale", p1);
    expect(w.kind).toBe("snuff-gale");
    expect(w.brazier).toBe(1);
    // the lane runs from the boss through the brazier
    expect(
      Math.hypot(
        A.braziers[1].x -
          along(w, Math.hypot(A.braziers[1].x - w.x, A.braziers[1].y - w.y)).x,
        A.braziers[1].y -
          along(w, Math.hypot(A.braziers[1].x - w.x, A.braziers[1].y - w.y)).y,
      ),
    ).toBeLessThan(1);
    expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
    place(p0, 300, 300); // walked away
    sturdy(a);
    run(a, w.at - a.time + DT);
    expect(lit(a, 1)).toBe(false);
    expect(a.raid.braziers![1].progress).toBe(0);
    expect(a.lumiReads.snuffed).toBe(1);
  });
  it("a keeper in the ring holds the flame and is sheltered; anyone else in the lane is hit and blown on", () => {
    const a = arena(3, 2);
    const [p0, p1, p2] = a.heroes();
    light(a, 1);
    place(p0, A.braziers[1].x, A.braziers[1].y);
    place(p2, 200, 120);
    a.seenAttacks.set("snuff-gale", 5);
    const [w] = cast(a, "snuff-gale", p0);
    expect(w.brazier).toBe(1);
    const k = Math.hypot(A.braziers[1].x - w.x, A.braziers[1].y - w.y) - 160;
    const inLane = along(w, k);
    place(p1, inLane.x, inLane.y);
    expect(lumiShapeHits(w, p1.x, p1.y, a.raid.braziers!)).toBe(true);
    expect(lumiShapeHits(w, p0.x, p0.y, a.raid.braziers!)).toBe(false);
    run(a, w.at - a.time + DT);
    expect(lit(a, 1)).toBe(true);
    expect(a.lumiReads.held).toBe(1);
    expect(hurt(p0)).toBe(0);
    expect(hurt(p1)).toBeGreaterThan(0);
    expect(Math.hypot(p1.x - inLane.x, p1.y - inLane.y)).toBeGreaterThan(50);
  });
  it("with no flame anyone can reach (or on the ground) it goes at a raider", () => {
    const a = arena(2, 2);
    const [p0, p1] = a.heroes();
    light(a, 0);
    place(p0, 1350, 820);
    place(p1, 1450, 200);
    a.seenAttacks.set("snuff-gale", 5);
    const [w] = cast(a, "snuff-gale", p0);
    expect(w.brazier).toBeUndefined();
    expect(lumiShapeHits(w, p0.x, p0.y, a.raid.braziers!)).toBe(true);
    const b = arena(2, 2);
    light(b, 1);
    b.raid.airborne = false;
    place(b.heroes()[0], A.braziers[1].x, A.braziers[1].y);
    b.seenAttacks.set("snuff-gale", 5);
    expect(cast(b, "snuff-gale", b.heroes()[0])[0].brazier).toBeUndefined();
  });
  it("a keeper who reacts in 0.45 s at the slowest speed always reaches the flame in time", () => {
    const random = prng(41);
    let aimed = 0;
    for (let i = 0; i < 60; i++) {
      const size = 1 + (i % 4);
      const a = arena(size, 1 + (i % 3));
      for (const p of a.heroes()) {
        const s = anywhere(random);
        place(p, s.x, s.y);
      }
      const b = i % 3;
      if (i % 2) light(a, b);
      else a.raid.braziers![b].progress = 0.4;
      a.seenAttacks.set("snuff-gale", 5);
      const [w] = cast(a, "snuff-gale", a.heroes()[0]);
      if (w.brazier === undefined) continue;
      aimed++;
      const ring = A.braziers[w.brazier];
      const keeper = [...a.heroes()].sort(
        (p, q) => ringWalk(p, ring) - ringWalk(q, ring),
      )[0];
      track(a, ["snuff-gale"]);
      sturdy(a);
      const start = a.time;
      lastHits.clear();
      const hits = new Set<string>();
      while (a.time < w.at + DT) {
        if (a.time >= start + RAID_REACTION)
          step(keeper, ring, E.brazierRadius - 12);
        a.tick(DT);
        for (const id of lastHits) hits.add(id);
        lastHits.clear();
        a.nextAttack = Infinity;
      }
      expect(a.lumiReads.held, `run ${i}`).toBe(1);
      expect(hits.has(keeper.id), `run ${i}`).toBe(false);
    }
    expect(aimed).toBeGreaterThan(20);
  });
});

describe("Bound Wicks", () => {
  it("ties two dark braziers (three in the last chapter with three raiders); never alone", () => {
    const a = arena(2, 1);
    const [w] = cast(a, "bound-wicks", a.heroes()[0]);
    expect(w.braziers).toHaveLength(2);
    expect(a.allows("bound-wicks")).toBe(false); // one at a time
    expect(arena(3, 3).allows("bound-wicks")).toBe(true);
    expect(
      cast(arena(3, 3), "bound-wicks", arena(3, 3).heroes()[0]),
    ).toBeDefined();
    const c = arena(3, 3);
    expect(cast(c, "bound-wicks", c.heroes()[0])[0].braziers).toHaveLength(3);
    const d = arena(2, 3);
    expect(cast(d, "bound-wicks", d.heroes()[0])[0].braziers).toHaveLength(2);
    // never alone, nor on the ground, nor with fewer than two dark braziers
    expect(arena(1, 2).allows("bound-wicks")).toBe(false);
    expect(cast(arena(1, 2), "bound-wicks", arena(1, 2).heroes()[0])).toEqual(
      [],
    );
    const e = arena(2, 2);
    e.raid.airborne = false;
    expect(e.allows("bound-wicks")).toBe(false);
    const f = arena(2, 2);
    light(f, 0);
    light(f, 1);
    expect(f.allows("bound-wicks")).toBe(false);
    // a fuse never shorter than its floor
    expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(A.wicks.min - EPS);
  });
  it("bound braziers catch only while every bound ring has a raider in it, and together", () => {
    const a = arena(2, 2);
    const [p0, p1] = a.heroes();
    const [w] = cast(a, "bound-wicks", p0);
    const [i, j] = w.braziers!;
    place(p0, A.braziers[i].x, A.braziers[i].y);
    place(p1, 200, 120);
    run(a, A.light + 0.5);
    expect(a.raid.braziers![i].progress).toBe(0);
    expect(lit(a, i)).toBe(false);
    place(p1, A.braziers[j].x, A.braziers[j].y);
    run(a, A.light - 0.3);
    expect(lit(a, i) || lit(a, j)).toBe(false);
    run(a, 0.4);
    expect(lit(a, i)).toBe(true);
    expect(lit(a, j)).toBe(true);
    expect(
      Math.abs(a.raid.braziers![i].litUntil - a.raid.braziers![j].litUntil),
    ).toBeLessThan(EPS);
    expect(of(a, "bound-wicks")).toHaveLength(0);
    expect(a.lumiReads.kindled).toBe(1);
  });
  it("a team that reacts in 0.45 s and walks at the slowest speed always lights them before the fuse", () => {
    const random = prng(77);
    for (let i = 0; i < 48; i++) {
      const size = 2 + (i % 3);
      const a = arena(size, 1 + (i % 3));
      for (const p of a.heroes()) {
        const s = anywhere(random, 60);
        place(p, s.x, s.y);
      }
      const ws = cast(a, "bound-wicks", a.heroes()[0]);
      expect(ws, `run ${i}`).toHaveLength(1);
      const w = ws[0];
      const seats = a.wickSeats(w) as Map<string, number>;
      expect(seats.size).toBe(w.braziers!.length);
      const start = a.time,
        at = w.at;
      for (
        let t = 0;
        t < at - start + 0.5 && of(a, "bound-wicks").length;
        t += DT
      ) {
        if (a.time >= start + RAID_REACTION)
          for (const [id, b] of seats)
            step(
              a.heroes().find((p: Fighter) => p.id === id)!,
              A.braziers[b],
              E.brazierRadius - 12,
            );
        a.tick(DT);
        a.nextAttack = Infinity;
      }
      expect(a.lumiReads.snapped, `run ${i}`).toBe(0);
      expect(a.lumiReads.kindled, `run ${i}`).toBe(1);
      expect(w.braziers!.every((b) => a.raid.braziers![b].litUntil > 0)).toBe(
        true,
      );
    }
  });
  it("its fuse is the slowest team's walk in, a reaction, the light and a spare second or so", () => {
    expect(wickFuse(0)).toBe(A.wicks.min);
    expect(wickFuse(900)).toBeCloseTo(
      RAID_REACTION + 900 / RAID_SLOWEST_SPEED + A.light + A.wicks.spare,
    );
    const plan = wickWalk(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
      [
        { x: 1000, y: 100 },
        { x: 0, y: 100 },
      ],
    );
    expect(plan.seats).toEqual([1, 0]);
    expect(plan.walk).toBeCloseTo(100 - (E.brazierRadius - 10));
    expect(wickWalk([{ x: 0, y: 0 }], A.braziers).walk).toBe(Infinity);
  });
  it("burnt out unlit, the wick snaps: a Backdraft from each bound brazier and every flame out", () => {
    const a = arena(3, 2);
    const [p0, p1, p2] = a.heroes();
    const [w] = cast(a, "bound-wicks", p0);
    const [i] = w.braziers!;
    const free = [0, 1, 2].find((k) => !w.braziers!.includes(k))!;
    light(a, free);
    place(p0, A.braziers[i].x, A.braziers[i].y); // alone in a bound ring
    place(p1, 200, 120); // well away
    place(p2, A.braziers[free].x, A.braziers[free].y);
    a.raid.braziers![free].litUntil = a.time + 999;
    run(a, w.at - a.time + DT);
    expect(a.lumiReads.snapped).toBe(1);
    expect(hurt(p0)).toBeGreaterThan(0);
    expect(hurt(p1)).toBe(0);
    for (const b of a.raid.braziers!) {
      expect(b.litUntil).toBe(0);
      expect(b.progress).toBe(0);
    }
  });
  it("a raider who steps out of the Backdraft in time is never hit", () => {
    const random = prng(5);
    for (let i = 0; i < 24; i++) {
      seeded(300 + i);
      const a = arena(2 + (i % 3), 1 + (i % 3));
      track(a, ["bound-wicks"]);
      const [w] = cast(a, "bound-wicks", a.heroes()[0]);
      // everyone starts in (or near) a bound ring, and nobody lights it
      for (const [k, p] of a.heroes().entries()) {
        const b = A.braziers[w.braziers![k % w.braziers!.length]];
        place(p, b.x + (random() - 0.5) * 60, b.y + (random() - 0.5) * 60);
      }
      a.kindler = () => undefined;
      sturdy(a);
      run(a, w.at - a.time - 2.5);
      expect(dodge(a, 4), `run ${i}`).toEqual([]);
      expect(a.lumiReads.snapped).toBe(1);
    }
  });
  it("a teammate who falls drops a bound brazier (or the whole wick, harmlessly)", () => {
    const a = arena(3, 3);
    const [p0, p1, p2] = a.heroes();
    const [w] = cast(a, "bound-wicks", p0);
    expect(w.braziers).toHaveLength(3);
    p2.hp = 0;
    run(a, DT * 2);
    expect(of(a, "bound-wicks")[0].braziers).toHaveLength(2);
    p1.hp = 0;
    run(a, DT * 2);
    expect(of(a, "bound-wicks")).toHaveLength(0);
    expect(a.lumiReads.snapped).toBe(0);
    expect(hurt(p0)).toBe(0);
  });
});

describe("every attack keeps a way out", () => {
  it("each attack leaves a safe spot clear of the controls, and a 0.45 s dodger at the slowest speed is never hit", () => {
    const random = prng(17);
    const kinds: RaidAttack[] = [
      "dive-bomb",
      "snuff-gale",
      "ember-rain",
      "scorched-earth",
    ];
    for (let i = 0; i < 48; i++) {
      seeded(800 + i);
      const size = 1 + (i % 4);
      const a = arena(size, 1 + (i % 3));
      const kind = kinds[i % kinds.length];
      track(a, [...kinds]);
      for (const p of a.heroes()) {
        const s = anywhere(random);
        place(p, s.x, s.y);
      }
      if (i % 3 === 0) light(a, i % 3);
      const target = a.heroes()[0];
      if (i % 2) for (let k = 0; k < 4; k++) a.noteLumiDodge(target.id, 1, 0);
      a.seenAttacks.set(kind, 5);
      a.lumiFeintRoll = () => false;
      const ws = cast(a, kind, target);
      expect(ws.length, kind).toBeGreaterThan(0);
      expect(a.safeSpotExists(ws), `run ${i} ${kind}`).toBe(true);
      for (const w of ws)
        expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
          RAID_TELEGRAPH_FLOOR - EPS,
        );
      sturdy(a);
      expect(dodge(a, 6), `run ${i} ${kind}`).toEqual([]);
    }
  });
  it("the safe-spot rule reads a gale's lane and its shelters, a dive's lane and a Backdraft", () => {
    const a = arena(1, 2);
    const b = a.raid.braziers!;
    const gale = {
      id: 1,
      kind: "snuff-gale",
      x: 200,
      y: b[1].y,
      tx: 1400,
      ty: b[1].y,
      radius: A.gale.width,
      brazier: 1,
      at: a.time + 1.5,
    } as RaidWarning;
    expect(a.lumiClear([gale], 400, b[1].y)).toBe(false); // the lane
    expect(a.lumiClear([gale], b[1].x, b[1].y)).toBe(true); // a shelter
    expect(a.lumiClear([gale], b[2].x, b[2].y)).toBe(true); // any ring shelters
    expect(a.lumiClear([gale], 400, b[1].y - A.gale.width - 40)).toBe(true);
    const wick = {
      ...gale,
      kind: "bound-wicks",
      radius: E.brazierRadius + A.wicks.burst,
      braziers: [0, 2],
    } as RaidWarning;
    expect(a.lumiClear([wick], b[0].x, b[0].y)).toBe(false);
    expect(a.lumiClear([wick], b[1].x, b[1].y)).toBe(true);
    expect(
      a.lumiClear(
        [wick],
        b[0].x,
        b[0].y - E.brazierRadius - A.wicks.burst - 30,
      ),
    ).toBe(true);
    const lane = { ...gale, kind: "dive-bomb", radius: E.dive.width };
    expect(a.lumiClear([lane], b[1].x, b[1].y)).toBe(false); // no shelter from a dive
  });
});

describe("feints: a dive that turns into a Snuffing Gale", () => {
  it("part-way through, the lane fades and a gale is drawn, shown in full", () => {
    seeded(31);
    let turned = 0;
    for (let i = 0; i < 30 && turned < 3; i++) {
      const a = arena(2, 3);
      a.seenAttacks.set("dive-bomb", 5);
      a.attacks = i;
      a.lumiFeintRoll = () => true;
      const p = a.heroes()[0];
      place(p, 500, 450 + i * 3);
      place(a.heroes()[1], 300, 150);
      const [lane] = cast(a, "dive-bomb", p);
      expect(lane.kind).toBe("dive-bomb");
      const turnAt =
        lane.startedAt! + (lane.at - lane.startedAt!) * A.feint.turnAt;
      run(a, turnAt - a.time - DT * 2);
      expect(of(a, "dive-bomb")).toHaveLength(1);
      run(a, DT * 4);
      expect(of(a, "dive-bomb")).toHaveLength(0);
      const gales = of(a, "snuff-gale");
      expect(gales).toHaveLength(1);
      expect(gales[0].at - gales[0].startedAt!).toBeGreaterThanOrEqual(
        RAID_TELEGRAPH_FLOOR - EPS,
      );
      expect(a.lumiReads.feints).toBe(1);
      turned++;
    }
    expect(turned).toBe(3);
  });
  it("never on a teaching dive, nor while another attack is live", () => {
    const a = arena(2, 3);
    a.lumiFeintRoll = () => true;
    cast(a, "dive-bomb", a.heroes()[0]);
    expect(a.lumiFeints.size).toBe(0);
    const b = arena(2, 3);
    b.lumiFeintRoll = () => true;
    b.seenAttacks.set("dive-bomb", 5);
    b.seenAttacks.set("ember-rain", 5);
    cast(b, "ember-rain", b.heroes()[1]);
    cast(b, "dive-bomb", b.heroes()[0]);
    expect(b.lumiFeints.size).toBe(0);
  });
});

describe("combos", () => {
  it("from chapter 1, a gale whose flame was held drops embers on its keeper", () => {
    const a = arena(2, 1);
    const [p0, p1] = a.heroes();
    light(a, 1);
    place(p0, A.braziers[1].x, A.braziers[1].y);
    place(p1, 200, 120);
    a.seenAttacks.set("snuff-gale", 5);
    const [w] = cast(a, "snuff-gale", p0);
    run(a, w.at - a.time + DT);
    const embers = of(a, "ember-rain");
    expect(embers).toHaveLength(1);
    expect(embers[0].followUp).toBe(true);
    expect(embers[0].targetId).toBe(p0.id);
    expect(embers[0].at - a.time).toBeGreaterThanOrEqual(
      (E.rain.radius + RULES.radius) / RAID_SLOWEST_SPEED + RAID_REACTION,
    );
    expect(a.lumiReads.combos).toBe(1);
  });
  it("from chapter 2, kindled wicks answer with a gale at a new flame (chapter 1: none)", () => {
    for (const phase of [1, 2]) {
      const a = arena(2, phase);
      const [p0, p1] = a.heroes();
      const [w] = cast(a, "bound-wicks", p0);
      const [i, j] = w.braziers!;
      place(p0, A.braziers[i].x, A.braziers[i].y);
      place(p1, A.braziers[j].x, A.braziers[j].y);
      run(a, A.light + 0.2);
      expect(a.lumiReads.kindled).toBe(1);
      const gales = of(a, "snuff-gale");
      if (phase === 1) expect(gales).toHaveLength(0);
      else {
        expect(gales).toHaveLength(1);
        expect(gales[0].followUp).toBe(true);
        expect(w.braziers).toContain(gales[0].brazier);
        expect(a.lumiReads.combos).toBe(1);
        // its keepers are already there: they hold
        sturdy(a);
        run(a, gales[0].at - a.time + DT);
        expect(a.lumiReads.held).toBe(1);
      }
    }
  });
});

describe("overlap keeps a way out", () => {
  it("a gale stands alone in chapter 1 and alone; from chapter 2 embers may fall while it is drawn", () => {
    expect(arena(2, 1).exclusive("snuff-gale")).toBe(true);
    expect(arena(1, 3).exclusive("snuff-gale")).toBe(true);
    const a = arena(2, 2);
    expect(a.exclusive("snuff-gale")).toBe(false);
    a.seenAttacks.set("snuff-gale", 5);
    cast(a, "snuff-gale", a.heroes()[0]);
    expect(a.canOverlap("ember-rain")).toBe(true);
    expect(a.canOverlap("dive-bomb")).toBe(false);
    expect(a.allows("snuff-gale")).toBe(false);
  });
  it("embers that would leave no spot clear of the gale wait until it has landed", () => {
    const random = prng(91);
    for (let i = 0; i < 30; i++) {
      const a = arena(2, 2);
      const [p0, p1] = a.heroes();
      const s0 = anywhere(random),
        s1 = anywhere(random);
      place(p0, s0.x, s0.y);
      place(p1, s1.x, s1.y);
      a.seenAttacks.set("snuff-gale", 5);
      const [gale] = cast(a, "snuff-gale", p0);
      a.seenAttacks.set("ember-rain", 5);
      const embers = cast(a, "ember-rain", p0);
      a.spaceOverlap(embers);
      expect(
        a.safeSpotExists([gale, ...embers]) ||
          embers.every((e) => e.at >= gale.at + 1 - EPS),
      ).toBe(true);
      for (const e of embers)
        expect(Math.abs(e.at - gale.at)).toBeGreaterThanOrEqual(0.5 - EPS);
    }
    // A circle too wide to leave in time beside the gale: it must wait.
    const a = arena(2, 2);
    const [p0, p1] = a.heroes();
    place(p0, 700, 450);
    place(p1, 400, 300);
    a.seenAttacks.set("snuff-gale", 5);
    const [gale] = cast(a, "snuff-gale", p0);
    a.currentCast = ++a.castSerial;
    const wide = a.warn("ember-rain", 700, 450, 700, 450, 520, 1.2);
    a.currentCast = 0;
    expect(a.safeSpotExists([gale, wide], 0.1)).toBe(false);
    a.spaceOverlap([wide]);
    expect(wide.at).toBeGreaterThanOrEqual(gale.at + 1 - EPS);
  });
});

describe("fewer, shorter openings", () => {
  it("the open heart lasts less than in the raid", () => {
    for (const size of [1, 2, 4])
      expect(arena(size, 1).exposeSeconds()).toBeLessThan(
        arena(size, 1, "raid").exposeSeconds(),
      );
    const a = arena(3, 1);
    a.heroes().forEach((p: Fighter, i: number) =>
      place(p, A.braziers[i].x, A.braziers[i].y),
    );
    run(a, A.light + 0.3);
    expect(a.raid.groundings).toBe(1);
    expect(a.raid.exposedUntil - a.time).toBeLessThanOrEqual(A.expose);
  });
});

describe("it reads the fight", () => {
  it("needs a consistent habit, and learns it from real dodges", () => {
    const a = arena(1, 2);
    const p = a.heroes()[0];
    a.noteLumiDodge(p.id, 1, 0);
    a.noteLumiDodge(p.id, -1, 0);
    a.noteLumiDodge(p.id, 0, 1);
    expect(a.lumiHabitOf(p.id)).toBeUndefined();
    const b = arena(1, 2);
    const q = b.heroes()[0];
    for (let i = 0; i < 3; i++) {
      place(q, 800, 450);
      b.warn("ember-rain", 800, 450, 800, 450, E.rain.radius, 1.2);
      b.learnLumiDodges();
      place(q, 800, 650);
      b.raid.warnings = [];
      b.learnLumiDodges();
    }
    expect(b.lumiHabitOf(q.id)?.y).toBeGreaterThan(0.9);
  });
  it("embers fall where a raider usually dodges; standing still is the raid's own circle", () => {
    const a = arena(2, 2);
    const [p, q] = a.heroes();
    place(p, 700, 450);
    place(q, 300, 150);
    for (let k = 0; k < 4; k++) a.noteLumiDodge(p.id, 0, 1);
    a.seenAttacks.set("ember-rain", 5);
    const embers = cast(a, "ember-rain", p);
    expect(a.lumiReads.habits).toBe(1);
    const habit = embers.find(
      (w) => Math.hypot(w.x - 700, w.y - (450 + A.habit.offset)) < 1,
    );
    expect(habit).toBeDefined();
    expect(embers.some((w) => Math.hypot(w.x - p.x, w.y - p.y) < 1)).toBe(true);
    expect(a.safeSpotExists(embers)).toBe(true);
  });
  it("answers a raider standing still to attack with a dive", () => {
    const a = arena(2, 1);
    const p = a.heroes()[0];
    place(p, 700, 450);
    a.lumiStill.set(p.id, a.time - 2);
    a.lumiHitAt.set(p.id, a.time - 0.2);
    expect(a.lumiAnchored(p)).toBe(true);
    const s = a.situation(a.heroes()) as RaidSituation;
    expect(a.reactions(s)).toContainEqual({
      kind: "dive-bomb",
      score: 1.5,
      target: p,
    });
    a.seenAttacks.set("dive-bomb", 5);
    cast(a, "dive-bomb", p);
    expect(a.lumiReads.anchors).toBe(1);
  });
  it("hunts the raider kneeling to revive a teammate", () => {
    const a = arena(3, 1);
    const [p0, p1, p2] = a.heroes();
    place(p0, 600, 450);
    place(p1, 620, 470);
    place(p2, 1200, 300);
    p0.hp = 0;
    a.raid.downed[p0.id] = {
      at: a.time,
      until: a.time + 30,
      self: false,
    } as any;
    for (const kind of [
      "dive-bomb",
      "ember-rain",
      "heat-mark",
      "snuff-gale",
    ] as const)
      expect(a.chooseTarget(kind, [p1, p2])).toBe(p1);
    const s = a.situation([p1, p2]) as RaidSituation;
    expect(s.reviving).toContain(p1);
    expect(a.reactions(s)).toContainEqual({
      kind: "ember-rain",
      score: 1.6,
      target: p1,
    });
  });
  it("plays its new moves and reads in a real fight", () => {
    seeded(77);
    const a = createRaidArena("REAL", "emberwing", {
      variant: "ascendant",
    }) as Inner;
    TEAM.forEach((c, i) => a.add("p" + i, "P" + i, c));
    a.configure(3, false);
    a.start();
    a.phase = "playing";
    a.deadline = a.time + 600;
    for (const p of a.heroes()) a.standIn(p.id);
    for (let t = 0; t < 240 && !a.raid.result; t += DT) {
      for (const p of a.heroes()) if (p.hp > 0) p.hp = Math.max(p.hp, 400);
      a.tick(DT);
      if ((a.phase as string) === "intermission") a.phase = "playing";
    }
    expect(a.lumiReads.gales).toBeGreaterThan(0);
    expect(a.lumiReads.held).toBeGreaterThan(0);
    expect(a.lumiReads.wicks).toBeGreaterThan(0);
    expect(a.lumiReads.kindled).toBeGreaterThan(0);
    expect(a.lumiReads.combos).toBeGreaterThan(0);
    expect(a.raid.groundings).toBeGreaterThan(0);
  });
});

describe("Ascendant Lumiwick keeps the honesty rules through a raid", () => {
  it.each([1, 2, 4])(
    "with %i raider(s)",
    (size) => {
      seeded(4242 + size);
      const a = createRaidArena("FAIR", "emberwing", {
        variant: "ascendant",
      }) as Inner;
      TEAM.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
      a.configure(3, false);
      a.start();
      a.phase = "playing";
      a.deadline = a.time + 600;
      for (const p of a.heroes()) a.standIn(p.id);
      const problems: string[] = [];
      const note = (s: string) => problems.length < 12 && problems.push(s);
      const start = a.startAttack.bind(a);
      const counted = new Set<number>();
      a.startAttack = (kind: RaidAttack, target: Fighter) => {
        if (
          a.currentCast &&
          a.currentCast === a.castSerial &&
          !counted.has(a.currentCast)
        ) {
          counted.add(a.currentCast);
          const live = a.liveThreats();
          if (live >= a.concurrency())
            note(
              `${kind} started with ${live} live (limit ${a.concurrency()})`,
            );
        }
        start(kind, target);
      };
      type Seen = {
        w: RaidWarning;
        followUp: boolean;
        frozen?: string;
        cast: number;
      };
      const shape = (w: RaidWarning) =>
        [w.x, w.y, w.tx, w.ty, w.radius].map((v) => v.toFixed(3)).join(",");
      const seen = new Map<number, Seen>();
      const kindsSeen = new Set<RaidAttack>();
      let overlaps = 0,
        controls = 0,
        openSince = -1;
      const chip = a.raid.maxHp / 3 / 50 / 30;
      for (let t = 0; t < 160 && !a.raid.result; t += DT) {
        const b = a.boss()!,
          before = b.hp;
        const was = new Map(a.raid.warnings.map((w: RaidWarning) => [w.id, w]));
        for (const p of a.heroes()) if (p.hp > 0) p.hp = 99999;
        a.tick(DT);
        if (a.boss()) a.boss()!.hp = before - chip;
        if ((a.phase as string) === "intermission") a.phase = "playing";
        for (const z of a.raid.braziers ?? [])
          if (lumiUnderControls(z.x, z.y, E.brazierRadius + RULES.radius))
            controls++;
        const open = a.raid.exposedUntil > a.time || !!a.raid.permanentGround;
        if (!open) openSince = -1;
        else if (openSince < 0) openSince = a.time;
        if (
          open &&
          a.time - openSince > 0.9 &&
          lumiUnderControls(b.x, b.y, A.heartClear)
        )
          controls++;
        const now = new Set(a.raid.warnings.map((w: RaidWarning) => w.id));
        const landed = [...was.values()].filter(
          (w) => !now.has(w.id) && w.at <= a.time + EPS,
        );
        for (const w of landed) {
          const s = seen.get(w.id);
          if (
            s &&
            !s.followUp &&
            (a.harmful(w) || LUMI_SPATIAL.has(w.kind)) &&
            w.at - (w.startedAt ?? w.at) < RAID_TELEGRAPH_FLOOR - EPS
          )
            note(`${w.kind} on screen ${(w.at - w.startedAt!).toFixed(2)} s`);
        }
        const fresh: Seen[] = [];
        for (const w of a.raid.warnings as RaidWarning[]) {
          kindsSeen.add(w.kind);
          let s = seen.get(w.id);
          if (!s) {
            s = {
              w,
              followUp: !!w.followUp || landed.length > 0,
              cast: a.castOf.get(w) ?? -w.id,
            };
            seen.set(w.id, s);
            fresh.push(s);
          }
          if (w.lockAt !== undefined && w.lockAt < w.at) {
            if (w.lockAt > w.at - RAID_FREEZE + EPS)
              note(`${w.kind} locks ${(w.at - w.lockAt).toFixed(2)} s before`);
            if (a.time >= w.lockAt + DT + EPS) {
              s.frozen ??= shape(w);
              if (s.frozen !== shape(w)) note(`${w.kind} moved after its lock`);
            }
          }
        }
        for (const s of fresh) {
          if (s.followUp || !a.harmful(s.w)) continue;
          for (const o of a.raid.warnings as RaidWarning[]) {
            const other = seen.get(o.id)!;
            if (other.cast === s.cast || other.followUp || !a.harmful(o))
              continue;
            const gap =
              RAID_JUMP_ATTACKS.has(o.kind) && RAID_JUMP_ATTACKS.has(s.w.kind)
                ? RULES.jumpCooldown + 0.3
                : 0.5;
            if (Math.abs(o.at - s.w.at) < gap - EPS)
              note(
                `${s.w.kind} lands ${Math.abs(o.at - s.w.at).toFixed(2)} s from ${o.kind}`,
              );
          }
        }
        const newCasts = new Set(
          fresh.filter((s) => !s.followUp).map((s) => s.cast),
        );
        for (const c of newCasts) {
          const mine = fresh
            .filter(
              (s) =>
                s.cast === c &&
                LUMI_SPATIAL.has(s.w.kind) &&
                s.w.kind !== "bound-wicks",
            )
            .map((s) => s.w);
          const old = (a.raid.warnings as RaidWarning[]).filter(
            (w) =>
              !mine.includes(w) &&
              LUMI_SPATIAL.has(w.kind) &&
              w.kind !== "bound-wicks",
          );
          if (!mine.length || !old.length) continue;
          overlaps++;
          const sequential =
            Math.min(...mine.map((w) => w.at)) >=
            Math.max(...old.map((w) => w.at)) + 1 - EPS;
          if (!sequential && !a.safeSpotExists([...old, ...mine]))
            note(`${mine[0].kind} overlaps ${old[0].kind} with no safe spot`);
        }
      }
      expect(problems).toEqual([]);
      expect(controls).toBe(0);
      expect(seen.size).toBeGreaterThan(10);
      expect(kindsSeen).toContain("snuff-gale");
      if (size > 1) expect(kindsSeen).toContain("bound-wicks");
      expect(a.raid.phase).toBeGreaterThanOrEqual(2);
      if (size === 4) expect(overlaps).toBeGreaterThan(0);
    },
    120_000,
  );
});
