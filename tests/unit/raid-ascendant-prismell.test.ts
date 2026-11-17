/**
 * Ascendant Prismell (the Spire's fiftieth floor, Prismatail's id): harder
 * and smarter than the raid's Prismell, but fair. Its tier, pattern, new
 * moves (Eclipse, Umbral Prism), feints, combos, overlap rule, shorter
 * openings and reads; its rules layer off for the ordinary raid and for
 * other bosses. Each move's fairness is checked here: a safe spot always
 * exists (never under a phone's touch controls), every warning is on screen
 * at least the raid's floor, and a dodger who reacts in 0.45 s at the
 * slowest speed is never hit (for the Umbral Prism: a slowest pair who
 * react in 0.45 s always hand the light on in time). Nothing a raider must
 * see or reach (skylights, mirrors, the heart, halo gaps, hand-off spots)
 * sits under the controls. The whole raid also keeps the honesty rules
 * raid-fairness.test.ts checks for the other bosses.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTERS,
  RULES,
  type CharacterId,
  type Fighter,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { PrismatailArena } from "../../apps/server/src/raid-prismatail";
import {
  AscendantPrismellArena,
  AscendantPrismellRules,
  PRISM_SPATIAL,
  prismShapeHits,
  prismUnderControls,
  umbralDelay,
  umbralPlan,
} from "../../apps/server/src/raid-ascendant-prismell";
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
  ASCENDANT_PRISMELL as A,
  PRISMATAIL as P,
  RAID,
  RAID_ASCENDANT_TIER,
  RAID_ATTACKS,
  RAID_TELEGRAPH_FLOOR,
  ascendantPrismellPattern,
  isAscendant,
  mirrorReaches,
  prismatailPattern,
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
import { atriumSources } from "../../apps/client/src/raid-prismatail-atrium";

const DT = 1 / 30;
const EPS = 1e-6;
type Inner = AscendantPrismellArena & { [key: string]: any };
const TEAM: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
const arena = (
  size = 1,
  phase = 1,
  form: "ascendant" | "raid" = "ascendant",
) => {
  const variant = form === "raid" ? undefined : form;
  const a = createRaidArena("ASC", "prismatail", { variant }) as Inner;
  TEAM.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configure(3, false);
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 600;
  a.raid.phase = phase;
  a.raid.trait = "restless";
  a.started = true;
  a.nextAttack = Infinity;
  // the skylight shines from the start (the raid waits 2 s); the board
  // starts unsolved (every arrow points back west) unless a test aims it
  a.relayAt = a.time;
  for (const m of a.raid.mirrors ?? []) m.angle = Math.PI;
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
/**
 * A scripted dodger: every raider sees each warning as it was 0.45 s ago and
 * walks at the slowest champion's speed to the nearest spot the arena's own
 * safe-spot rule calls clear (outside lanes, the fan's hot slice, the halo's
 * band and sunfall, clear of the phone's controls). Returns the ids hurt by
 * the tracked moves.
 */
function dodge(a: Inner, seconds: number) {
  const history = new Map<number, { t: number; w: RaidWarning }[]>();
  const goals = new Map<string, { x: number; y: number }>();
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
      .filter((w) => w && PRISM_SPATIAL.has(w.kind))
      .map((w) => ({
        ...w!,
        radius: w!.radius + (w!.kind === "halo-crush" ? 0 : 6),
      })) as RaidWarning[];
    for (const p of a.heroes()) {
      if (p.hp <= 0) continue;
      let vx = 0,
        vy = 0;
      if (!a.prismClear(seen, p.x, p.y)) {
        let spot = goals.get(p.id);
        if (!spot || !a.prismClear(seen, spot.x, spot.y)) {
          spot = undefined;
          for (let r = 10; r <= 600 && !spot; r += 10)
            for (let i = 0; i < 48; i++) {
              const ang = (i / 48) * Math.PI * 2;
              const x = p.x + Math.cos(ang) * r,
                y = p.y + Math.sin(ang) * r;
              if (a.prismClear(seen, x, y)) {
                spot = { x, y };
                break;
              }
            }
          if (spot) goals.set(p.id, spot);
        }
        if (spot) {
          const d = Math.hypot(spot.x - p.x, spot.y - p.y) || 1;
          const v = Math.min(RAID_SLOWEST_SPEED, d / DT);
          vx = ((spot.x - p.x) / d) * v;
          vy = ((spot.y - p.y) / d) * v;
        }
      }
      p.x += vx * DT;
      p.y += vy * DT;
      p.vx = vx;
      p.vy = vy;
    }
    lastHits.clear();
    a.tick(DT);
    for (const id of lastHits) hits.add(id);
    a.nextAttack = Infinity;
    if (
      !a.raid.warnings.some((w: RaidWarning) => PRISM_SPATIAL.has(w.kind)) &&
      t > 0.5
    )
      break;
  }
  return [...hits];
}
/** Point every mirror of a skylight's branch on, and the last at the heart. */
function aimBranch(a: Inner, branch: number[]) {
  const m = a.raid.mirrors!;
  const boss = a.boss()!;
  const aim = (i: number, to: { x: number; y: number }) => {
    m[i].angle =
      Math.round(Math.atan2(to.y - m[i].y, to.x - m[i].x) / (Math.PI / 4)) *
      (Math.PI / 4);
    m[i].angle = ((m[i].angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  };
  aim(branch[0], m[branch[1]]);
  aim(branch[1], boss);
  expect(mirrorReaches(m[branch[0]], m[branch[1]])).toBe(true);
  expect(mirrorReaches(m[branch[1]], boss)).toBe(true);
}

describe("the Ascendant tier", () => {
  it("is the shared Ascendant row, with no solo revive", () => {
    expect(raidTierOf("prismatail", "ascendant")).toBe(RAID_ASCENDANT_TIER);
    expect(raidSoloRevive("prismatail", "ascendant")).toBeUndefined();
    const a = arena(1);
    expect(a.raid.variant).toBe("ascendant");
    expect(isAscendant(a.raid, "prismatail")).toBe(true);
    expect(a.tier().reviveSeconds).toBe(A.reviveSeconds);
  });
  it("never shortens a telegraph below the floor; an Umbral Prism keeps its length", () => {
    const a = arena(1);
    for (const s of [0.9, 1.1, 1.25, 1.5, 1.75, 2, 2.5])
      for (const kind of ["prism-lance", "halo-crush", "eclipse"] as const)
        expect(a.telegraph(kind, s)).toBeGreaterThanOrEqual(
          Math.min(s, RAID_TELEGRAPH_FLOOR),
        );
    expect(a.telegraph("umbral-prism", 6.2)).toBe(6.2);
    expect(a.telegraph("fan-display", P.fan.delay)).toBe(P.fan.delay);
  });
  it("health: the tier's formula alone; per extra raider, ASCENDANT_PRISMELL.perExtraPlayer", () => {
    const solo = arena(1).raid.maxHp;
    for (const size of [2, 3, 4]) {
      const hp = arena(size).raid.maxHp;
      const want =
        ((solo / RAID.soloHealth) *
          (P.health.base + A.perExtraPlayer * (size - 1))) /
        P.health.base;
      expect(hp / want).toBeGreaterThan(0.97);
      expect(hp / want).toBeLessThan(1.03);
    }
  });
  it("hits by party size as ASCENDANT_PRISMELL.damage sets; a party gets longer windows", () => {
    for (const size of [1, 2, 3, 4]) {
      const a = arena(size);
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
  it("its rhythm tightens by chapter (the ordinary raid's does not)", () => {
    const gaps = [1, 2, 3].map((phase) => arena(4, phase).cadence());
    expect(gaps[1]).toBeLessThan(gaps[0]);
    expect(gaps[2]).toBeLessThan(gaps[1]);
    for (const phase of [1, 2, 3])
      expect(arena(4, phase).cadence()).toBeLessThan(
        arena(4, phase, "raid").cadence(),
      );
  });
});

describe("the layer acts only for Prismell's Ascendant form", () => {
  it("the ordinary raid keeps its class, pattern, rest spot, skylights and name", () => {
    const a = arena(2, 1, "raid");
    expect(a).toBeInstanceOf(PrismatailArena);
    expect(a).not.toBeInstanceOf(AscendantPrismellArena);
    expect(a.raid.variant).toBeUndefined();
    expect(a.pattern()).toEqual(prismatailPattern(1, "restless"));
    expect([1, 2, 3].map((ph) => arena(2, ph, "raid").restX())).toEqual([
      1000, 1040, 1080,
    ]);
    expect(arena(2, 3, "raid").relaySources()).toEqual([
      { x: 350, y: 300 },
      { x: 350, y: 600 },
    ]);
    expect(a.exposeSeconds()).toBe(P.expose);
    expect(raidBossName(a.raid)).toBe("Prismell");
    expect(raidAttacksOf("prismatail")).toHaveLength(6);
  });
  it("is off on a Prismatail arena that isn't Ascendant", () => {
    const Layered = AscendantPrismellRules(PrismatailArena);
    const a = new Layered("L", "prismatail") as unknown as Inner;
    a.add("p0", "P0", "voltkit");
    a.configure(3, false);
    a.start();
    expect(a.raid.variant).toBeUndefined();
    expect(a.prismAscendant()).toBe(false);
    expect(a.pattern()).toEqual(prismatailPattern(a.raid.phase, a.raid.trait));
    expect(a.restX()).toBe(1000);
    expect(a.exposeSeconds()).toBe(
      P.expose + (a.raid.trait === "kaleidoscope" ? 1 : 0),
    );
  });
  it("is off for another boss's Ascendant form", () => {
    const Layered = AscendantPrismellRules(PrismatailArena);
    const a = new Layered("L", "grumblecrag") as unknown as Inner;
    a.add("p0", "P0", "voltkit");
    a.configure(3, false);
    a.start();
    a.raid.variant = "ascendant";
    expect(isAscendant(a.raid, "prismatail")).toBe(false);
    expect(a.prismAscendant()).toBe(false);
  });
});

describe("Ascendant Prismell's kit", () => {
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
      const p = raidPattern(phase, 3, 4, "prismatail", "ascendant");
      expect(p).toEqual(ascendantPrismellPattern(phase));
      expect(p).toContain("eclipse");
      expect(p).toContain("umbral-prism");
      expect(p).toContain("halo-crush");
      expect(p).toContain("fan-display");
      expect(arena(4, phase).pattern()).toEqual(
        ascendantPrismellPattern(phase, "restless"),
      );
    }
    // the raid's traits still apply
    expect(ascendantPrismellPattern(1, "overcast")).not.toContain(
      "prism-lance",
    );
    expect(
      ascendantPrismellPattern(1, "dazzling").filter((k) => k === "glare"),
    ).toHaveLength(2);
    expect(raidChapters("prismatail", "ascendant").map((c) => c.name)).toEqual([
      "Corona Dawn",
      "Zenith Glass",
      "Ascendant Corona",
    ]);
  });
  it("its new attacks have guide text, a glyph, a shape and a place in the guide", () => {
    for (const kind of ["eclipse", "umbral-prism"] as RaidAttack[]) {
      expect(RAID_ATTACKS[kind].name.length).toBeGreaterThan(3);
      expect(RAID_ATTACKS[kind].tip.length).toBeGreaterThan(20);
      expect(RAID_ATTACKS[kind].summary.length).toBeGreaterThan(10);
    }
    expect(RAID_EXCLUSIVE_ATTACKS.has("eclipse")).toBe(true);
    expect(raidShapeOf("eclipse")).toBe("circle");
    expect(raidShapeOf("umbral-prism")).toBe("field");
    expect(RAID_HARMLESS_ATTACKS.has("umbral-prism")).toBe(true);
    const guide = raidAttacksOf("prismatail", "ascendant");
    expect(guide).toEqual(expect.arrayContaining(["eclipse", "umbral-prism"]));
    expect(guide).toHaveLength(8);
    for (const kind of guide) expect(BOSS_ATTACK_ART, kind).toContain(kind);
  });
});

describe("the phone's touch controls", () => {
  it("no skylight window, mirror or heart rest spot sits under or near one", () => {
    for (const set of [...A.windows.single, ...A.windows.pair])
      for (const s of set) {
        expect(prismUnderControls(s.x, s.y, 40), `${s.x},${s.y}`).toBe(false);
        // a raider can take its light from ground clear of the controls
        expect(
          prismUnderControls(s.x + 60, s.y, RULES.radius) &&
            prismUnderControls(s.x, s.y + 60, RULES.radius),
        ).toBe(false);
      }
    for (const m of P.mirrors)
      expect(prismUnderControls(m.x, m.y, 40), `${m.x},${m.y}`).toBe(false);
    for (const x of A.home)
      for (const dy of [-12, 0, 12])
        expect(prismUnderControls(x, 450 + dy, A.heartClear)).toBe(false);
    // The raid backs off until its heart is under the smallest phone's buttons.
    expect(prismUnderControls(1080, 450, A.heartClear)).toBe(true);
    // the boss really rests there
    const a = arena(2, 3);
    a.boss()!.x = 1100;
    run(a, 6);
    expect(Math.abs(a.boss()!.x - A.home[2])).toBeLessThan(2);
  });
  it("knows the controls: each box's middle is under, the court's middle is not", () => {
    for (const [x0, y0, x1, y1] of A.phoneControls)
      expect(prismUnderControls((x0 + x1) / 2, (y0 + y1) / 2)).toBe(true);
    expect(prismUnderControls(800, 450, 100)).toBe(false);
    expect(prismUnderControls(1400, 230)).toBe(false);
  });
  it("the safe-spot rule never counts a spot under the controls", () => {
    const a = arena(1);
    expect(a.prismClear([], 1500, 700)).toBe(false);
    expect(a.prismClear([], 60, 760)).toBe(false);
    expect(a.prismClear([], 800, 450)).toBe(true);
    // A raider deep under the buttons with a lane landing soon far away:
    // the only ground in reach is under the controls, so no spot counts.
    const p = a.heroes()[0];
    place(p, 1500, 700);
    const w = {
      id: 1,
      kind: "eclipse",
      x: 400,
      y: 400,
      tx: 560,
      ty: 170,
      radius: 64,
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
      const spot = a.prismSpotNear([c], p, 300);
      if (spot) expect(prismUnderControls(spot.x, spot.y, 0, 0)).toBe(false);
    }
  });
  it("a halo's gap never opens under the controls", () => {
    const random = prng(11);
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const a = arena(2, 2);
      const p = a.heroes()[0];
      place(p, 900 + random() * 600, 300 + random() * 500);
      if (prismUnderControls(p.x, p.y, 0, 0)) continue;
      p.vx = (random() - 0.5) * 400;
      p.vy = (random() - 0.5) * 400;
      const [halo] = cast(a, "halo-crush", p);
      const gx = halo.x + Math.cos(halo.gapAngle!) * halo.radius,
        gy = halo.y + Math.sin(halo.gapAngle!) * halo.radius;
      expect(prismUnderControls(gx, gy, P.halo.width), `${gx},${gy}`).toBe(
        false,
      );
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });
  it("hand-off spots and the teammate's spot are never under the controls", () => {
    const random = prng(21);
    const sources = [...A.windows.single, ...A.windows.pair];
    for (let i = 0; i < 300; i++) {
      const m = { x: 60 + random() * 1480, y: 60 + random() * 780 };
      const others = [{ x: 60 + random() * 1480, y: 60 + random() * 780 }];
      const plan = umbralPlan(m, others, sources[i % sources.length], P.range);
      expect(Number.isFinite(plan.walk)).toBe(true);
      expect(prismUnderControls(plan.spot!.x, plan.spot!.y)).toBe(false);
      expect(prismUnderControls(plan.feed!.x, plan.feed!.y)).toBe(false);
      const handoff = Math.hypot(
        plan.spot!.x - plan.feed!.x,
        plan.spot!.y - plan.feed!.y,
      );
      expect(handoff).toBeGreaterThanOrEqual(A.umbral.apart - EPS);
      expect(handoff).toBeLessThanOrEqual(P.range);
    }
  });
});

describe("the Eclipse", () => {
  it("sunfall on the skylight; the light opens at another window, shown from the start", () => {
    seeded(5);
    const a = arena(2, 1);
    track(a, ["eclipse"]);
    const [p0, p1] = a.heroes();
    place(p0, 360, 460); // in the sunfall
    place(p1, 800, 450);
    const [w] = cast(a, "eclipse", p0);
    expect(w.kind).toBe("eclipse");
    expect([w.x, w.y]).toEqual([350, 450]);
    expect(w.radius).toBe(A.eclipse.radius);
    const to = { x: w.tx, y: w.ty };
    expect(
      A.windows.single.some((s) => s[0].x === to.x && s[0].y === to.y),
    ).toBe(true);
    expect(to).not.toEqual({ x: 350, y: 450 });
    expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
      RAID_TELEGRAPH_FLOOR - EPS,
    );
    a.held = 0.9;
    lastHits.clear();
    run(a, w.at - a.time + DT);
    expect(lastHits.has(p0.id)).toBe(true);
    expect(hurt(p1)).toBe(0);
    expect(a.raid.lightSources).toEqual([to]);
    expect(a.relaySources()).toEqual([to]);
    expect(a.held).toBeLessThan(0.2);
    // the client draws the skylight where the server moved it
    expect(atriumSources(a.raid)).toEqual([to]);
    // a new chapter lights the raid's own skylight again
    a.raid.phase = 2;
    a.onChapter();
    expect(a.raid.lightSources).toBeUndefined();
    expect(a.relaySources()).toEqual([{ x: 350, y: 450 }]);
  });
  it("in the last chapter with a party, both skylights move", () => {
    seeded(6);
    const a = arena(3, 3);
    const ws = cast(a, "eclipse", a.heroes()[0]);
    expect(ws).toHaveLength(2);
    expect(ws.map((w) => [w.x, w.y])).toEqual([
      [350, 300],
      [350, 600],
    ]);
    expect(ws.map((w) => [w.tx, w.ty])).toEqual([
      [560, 170],
      [560, 730],
    ]);
    run(a, ws[0].at - a.time + DT);
    expect(a.relaySources()).toEqual([
      { x: 560, y: 170 },
      { x: 560, y: 730 },
    ]);
    // and back again
    const back = cast(a, "eclipse", a.heroes()[0]);
    expect(back.map((w) => [w.tx, w.ty])).toEqual([
      [350, 300],
      [350, 600],
    ]);
  });
  it("from every window the relay can break the shield (a raider at its light, mirrors aimed)", () => {
    for (const set of A.windows.single) {
      const a = arena(1, 1);
      a.raid.lightSources = set.map((s) => ({ ...s }));
      const p = a.heroes()[0];
      const spot = a.relaySpot(set[0]);
      place(p, spot.x, spot.y);
      expect(prismUnderControls(spot.x, spot.y)).toBe(false);
      aimBranch(a, a.branchOf(set[0]));
      for (const m of a.raid.mirrors!) delete m.scrambleAt;
      sturdy(a);
      run(a, 2);
      expect(a.raid.shieldBreaks, `${set[0].x},${set[0].y}`).toBe(1);
    }
    for (const set of A.windows.pair) {
      const a = arena(2, 3);
      a.raid.lightSources = set.map((s) => ({ ...s }));
      a.heroes().forEach((p: Fighter, i: number) => {
        const spot = a.relaySpot(set[i]);
        place(p, spot.x, spot.y);
        aimBranch(a, a.branchOf(set[i]));
      });
      sturdy(a);
      run(a, 2);
      expect(a.raid.shieldBreaks, `${set[0].x},${set[0].y}`).toBe(1);
    }
  });
  it("a safe spot always exists, and a 0.45 s dodger at the slowest speed is never hit", () => {
    const random = prng(41);
    for (let i = 0; i < 30; i++) {
      seeded(300 + i);
      const size = 1 + (i % 4);
      const a = arena(size, 1 + (i % 3));
      track(a, ["eclipse", "prism-lance"]);
      const sources = a.relaySources();
      for (const p of a.heroes()) {
        const s = sources[Math.floor(random() * sources.length)];
        place(
          p,
          s.x + (random() - 0.5) * 2 * A.eclipse.radius,
          s.y + (random() - 0.5) * 2 * A.eclipse.radius,
        );
      }
      const ws = cast(a, "eclipse", a.heroes()[0]);
      expect(a.safeSpotExists(ws), `run ${i}`).toBe(true);
      sturdy(a);
      expect(dodge(a, 6), `run ${i}`).toEqual([]);
    }
  });
});

describe("the Umbral Prism", () => {
  it("blocks the light: no beam passes through its raider", () => {
    const a = arena(2, 1);
    const [p0, p1] = a.heroes();
    place(p0, 470, 450);
    place(p1, 800, 450);
    const before = a.relayNodes().map((n: { id: string }) => n.id);
    expect(before).toContain(p0.id);
    cast(a, "umbral-prism", p0);
    expect(of(a, "umbral-prism")[0].targetId).toBe(p0.id);
    expect(a.relayNodes().map((n: { id: string }) => n.id)).not.toContain(
      p0.id,
    );
  });
  it("in a party, only light handed on from a step away cleanses it", () => {
    const a = arena(2, 1);
    const [m, mate] = a.heroes();
    place(mate, 470, 450); // in the skylight's light
    place(m, 470 + A.umbral.apart - 20, 450); // too close
    cast(a, "umbral-prism", m);
    expect(a.umbralLight(m).lit).toBe(false);
    place(m, 470 + 220, 450); // a hand-off away
    expect(a.umbralLight(m)).toEqual({ lit: true, from: { x: 470, y: 450 } });
    place(m, 470 + P.range + 40, 450); // out of reach
    expect(a.umbralLight(m).lit).toBe(false);
    // straight from the skylight doesn't count in a party
    place(mate, 1200, 200);
    place(m, 470, 450);
    expect(a.umbralLight(m).lit).toBe(false);
  });
  it("a mirror's arrow hands the light on too", () => {
    const a = arena(2, 1);
    const [m, mate] = a.heroes();
    const mirror = a.raid.mirrors![0];
    place(mate, 380, 300); // lights the mirror (it is within its reach)
    mirror.angle = Math.PI / 2; // pointing down
    place(m, mirror.x, mirror.y + 280);
    cast(a, "umbral-prism", m);
    // the teammate is too far away to light them directly
    expect(Math.hypot(m.x - mate.x, m.y - mate.y)).toBeGreaterThan(P.range);
    expect(a.umbralLight(m)).toEqual({
      lit: true,
      from: { x: mirror.x, y: mirror.y },
    });
    mirror.angle = 0;
    expect(a.umbralLight(m).lit).toBe(false);
  });
  it("alone, the skylight's own reach cleanses it", () => {
    const a = arena(1, 1);
    const [m] = a.heroes();
    cast(a, "umbral-prism", m);
    place(m, 350 + P.range - 10, 450);
    expect(a.umbralLight(m).lit).toBe(true);
    place(m, 350 + P.range + 30, 450);
    expect(a.umbralLight(m).lit).toBe(false);
  });
  it("fills while lit and is cleansed without harm; out of the light it shatters", () => {
    const a = arena(2, 1);
    track(a, ["umbral-prism"]);
    const [m, mate] = a.heroes();
    place(mate, 470, 450);
    place(m, 690, 450);
    const [w] = cast(a, "umbral-prism", m);
    sturdy(a);
    lastHits.clear();
    run(a, A.umbral.lit + 0.2);
    expect(of(a, "umbral-prism")).toHaveLength(0);
    expect(a.prismReads.cleansed).toBe(1);
    expect(lastHits.size).toBe(0);
    expect(w.lit).toBeGreaterThan(0);
    // now out of the light: it shatters, blinds and loses the relay's hold
    const b = arena(2, 1);
    track(b, ["umbral-prism"]);
    const [m2, mate2] = b.heroes();
    place(mate2, 1200, 200);
    place(m2, 1100, 750);
    const [w2] = cast(b, "umbral-prism", m2);
    b.held = 0.8;
    sturdy(b);
    lastHits.clear();
    run(b, w2.at - b.time - DT);
    expect(lastHits.size).toBe(0);
    b.held = 0.8;
    run(b, 3 * DT);
    expect(lastHits.has(m2.id)).toBe(true);
    expect(b.raid.blinded![m2.id]).toBeGreaterThan(b.time);
    expect(b.held).toBeLessThan(0.2);
    expect(b.prismReads.shattered).toBe(1);
  });
  it("its timer lets the slowest pair walk into place: a 0.45 s team always hands the light on", () => {
    const random = prng(61);
    for (let i = 0; i < 40; i++) {
      seeded(600 + i);
      const size = [1, 2, 4][i % 3];
      const a = arena(size, 1 + (i % 3));
      track(a, ["umbral-prism"]);
      if (i % 4 === 1) {
        const set = A.windows.single[1 + (i % 2)];
        a.raid.lightSources = set.map((s) => ({ ...s }));
      }
      for (const p of a.heroes()) {
        let x = 0,
          y = 0;
        do {
          x = 80 + random() * 1440;
          y = 80 + random() * 740;
        } while (prismUnderControls(x, y, 0, 0));
        place(p, x, y);
      }
      const m = a.heroes()[0];
      const [w] = cast(a, "umbral-prism", m);
      expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(A.umbral.min - EPS);
      const plan = a.umbralPlanFor(m);
      expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
        umbralDelay(plan.walk) - EPS,
      );
      // The team: after a reaction, the marked raider walks to the plan's
      // hand-off spot and the nearest teammate to its feeding spot.
      const others = a.heroes().filter((p: Fighter) => p !== m);
      const feeder = plan.feed
        ? [...others].sort(
            (p: Fighter, q: Fighter) =>
              Math.hypot(p.x - plan.feed!.x, p.y - plan.feed!.y) -
              Math.hypot(q.x - plan.feed!.x, q.y - plan.feed!.y),
          )[0]
        : undefined;
      const start = a.time;
      sturdy(a);
      lastHits.clear();
      const hits = new Set<string>();
      for (let t = 0; t < 12 && a.raid.warnings.includes(w); t += DT) {
        if (a.time >= start + RAID_REACTION - EPS) {
          for (const [p, goal] of [
            [m, plan.spot],
            [feeder, plan.feed],
          ] as const) {
            if (!p || !goal) continue;
            const d = Math.hypot(goal.x - p.x, goal.y - p.y);
            const v = d > 2 ? Math.min(RAID_SLOWEST_SPEED, d / DT) : 0;
            p.vx = d > 2 ? ((goal.x - p.x) / d) * v : 0;
            p.vy = d > 2 ? ((goal.y - p.y) / d) * v : 0;
            p.x += p.vx * DT;
            p.y += p.vy * DT;
          }
        }
        lastHits.clear();
        a.tick(DT);
        for (const id of lastHits) hits.add(id);
        a.nextAttack = Infinity;
      }
      expect([...hits], `run ${i} (${size} raiders)`).toEqual([]);
      expect(a.raid.warnings.includes(w), `run ${i}`).toBe(false);
      expect(a.prismReads.cleansed, `run ${i}`).toBeGreaterThanOrEqual(1);
    }
  });
  it("a teammate who falls (or a sun that moves) gives it the time it now needs", () => {
    const a = arena(2, 1);
    const [m, mate] = a.heroes();
    place(mate, 470, 450);
    place(m, 1300, 200);
    const [w] = cast(a, "umbral-prism", m);
    const at = w.at;
    mate.hp = 0;
    a.raid.downed[mate.id] = { progress: 0, self: false } as any;
    run(a, DT * 2);
    expect(w.at).toBeGreaterThan(at);
    expect(w.at - a.time).toBeGreaterThanOrEqual(
      umbralDelay(a.umbralPlanFor(m).walk) - 0.1,
    );
  });
  it("two prisms with three raiders or more from chapter 2; one at a time; never while the skylight is dark", () => {
    const a = arena(4, 2);
    const ws = cast(a, "umbral-prism", a.heroes()[0]);
    expect(ws).toHaveLength(2);
    expect(new Set(ws.map((w) => w.targetId)).size).toBe(2);
    expect(a.allows("umbral-prism")).toBe(false);
    expect(
      cast(arena(4, 1), "umbral-prism", arena(4, 1).heroes()[0]),
    ).toHaveLength(1);
    expect(
      cast(arena(2, 3), "umbral-prism", arena(2, 3).heroes()[0]),
    ).toHaveLength(1);
    const b = arena(2, 1);
    expect(b.allows("umbral-prism")).toBe(true);
    b.relayAt = b.time + 2;
    expect(b.allows("umbral-prism")).toBe(false);
    b.relayAt = b.time;
    b.raid.exposedUntil = b.time + 3;
    expect(b.allows("umbral-prism")).toBe(false);
  });
  it("a broken shield cleanses every prism", () => {
    const a = arena(2, 1);
    const [m, mate] = a.heroes();
    place(m, 1200, 200);
    cast(a, "umbral-prism", m);
    place(mate, 470, 450);
    aimBranch(a, [0, 1]);
    sturdy(a);
    run(a, 2);
    expect(a.raid.shieldBreaks).toBe(1);
    expect(of(a, "umbral-prism")).toHaveLength(0);
  });
});

describe("the raid's attacks, the Ascendant's way", () => {
  it("a halo closes over the spot a raider usually dodges to; standing still stays safe", () => {
    const a = arena(2, 2);
    const p = a.heroes()[0];
    place(p, 700, 450);
    for (let k = 0; k < 4; k++) a.notePrismDodge(p.id, 0, 1);
    const [halo] = cast(a, "halo-crush", p);
    expect(a.prismReads.habits).toBe(1);
    expect(prismShapeHits(halo, p.x, p.y)).toBe(false);
    const habitSpot = { x: p.x, y: p.y + P.halo.radius * A.habit.offset };
    expect(
      Math.abs(
        Math.hypot(habitSpot.x - halo.x, habitSpot.y - halo.y) - halo.radius,
      ),
    ).toBeLessThan(2);
  });
  it("the safe-spot rule reads the halo's band and gap, the fan's hot slice and a lane", () => {
    const a = arena(1, 2);
    const halo = {
      id: 1,
      kind: "halo-crush",
      x: 700,
      y: 450,
      tx: 700,
      ty: 450,
      radius: P.halo.radius,
      gapAngle: 0,
      at: a.time + 1.5,
    } as RaidWarning;
    expect(a.prismClear([halo], 700, 450)).toBe(true); // the middle
    expect(a.prismClear([halo], 700, 450 + P.halo.radius)).toBe(false); // the band
    expect(a.prismClear([halo], 700 + P.halo.radius, 450)).toBe(true); // the gap
    expect(a.prismClear([halo], 700, 450 + P.halo.radius + 80)).toBe(true);
    const fan = {
      ...halo,
      kind: "fan-display",
      x: 1000,
      y: 450,
      radius: P.fan.radius,
      prismIndex: 3,
      prismCount: 6,
    } as RaidWarning;
    expect(a.prismClear([fan], 700, 450)).toBe(false); // slice 3 points left
    expect(a.prismClear([fan], 1000, 150)).toBe(true);
    const lane = {
      ...halo,
      kind: "prism-lance",
      x: 1000,
      y: 450,
      tx: 40,
      ty: 450,
      radius: P.lance.width,
    } as RaidWarning;
    expect(a.prismClear([lane], 600, 450)).toBe(false);
    expect(a.prismClear([lane], 600, 520)).toBe(true);
  });
  it("each attack leaves a safe spot clear of the controls, and a 0.45 s dodger at the slowest speed is never hit", () => {
    const random = prng(17);
    const kinds: RaidAttack[] = [
      "prism-lance",
      "refraction",
      "fan-display",
      "halo-crush",
    ];
    for (let i = 0; i < 48; i++) {
      seeded(800 + i);
      const size = 1 + (i % 4);
      const a = arena(size, 1 + (i % 3));
      const kind = kinds[i % kinds.length];
      track(a, [...kinds, "eclipse"]);
      for (const p of a.heroes()) {
        let x = 0,
          y = 0;
        do {
          x = 120 + random() * 1360;
          y = 120 + random() * 660;
        } while (prismUnderControls(x, y, 0, 0));
        place(p, x, y);
      }
      const target = a.heroes()[0];
      if (i % 2) for (let k = 0; k < 4; k++) a.notePrismDodge(target.id, 1, 0);
      a.seenAttacks.set(kind, 5);
      a.prismFeintRoll = () => false;
      const ws = cast(a, kind, target);
      expect(ws.length, kind).toBeGreaterThan(0);
      expect(a.safeSpotExists(ws), `run ${i} ${kind}`).toBe(true);
      for (const w of ws)
        expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
          Math.min(RAID_TELEGRAPH_FLOOR, P.lance.delay) - EPS,
        );
      sturdy(a);
      expect(dodge(a, 6), `run ${i} ${kind}`).toEqual([]);
    }
  });
});

describe("feints: a lance that curls into a Halo Crush", () => {
  it("part-way through, the lane fades and a halo closes round its raider, shown in full", () => {
    seeded(31);
    let turned = 0;
    for (let i = 0; i < 30 && turned < 3; i++) {
      const a = arena(2, 3);
      a.seenAttacks.set("prism-lance", 5);
      a.attacks = i;
      a.prismFeintRoll = () => true;
      const p = a.heroes()[0];
      place(p, 700, 450 + i * 3);
      const [lane] = cast(a, "prism-lance", p);
      expect(lane.kind).toBe("prism-lance");
      const turnAt =
        lane.startedAt! + (lane.at - lane.startedAt!) * A.feint.turnAt;
      run(a, turnAt - a.time - DT * 2);
      expect(of(a, "prism-lance")).toHaveLength(1);
      run(a, DT * 4);
      expect(of(a, "prism-lance")).toHaveLength(0);
      const halos = of(a, "halo-crush");
      expect(halos).toHaveLength(1);
      expect(halos[0].targetId).toBe(p.id);
      expect(halos[0].at - halos[0].startedAt!).toBeGreaterThanOrEqual(
        RAID_TELEGRAPH_FLOOR - EPS,
      );
      expect(a.prismReads.feints).toBe(1);
      turned++;
    }
    expect(turned).toBe(3);
  });
  it("never on a teaching lance, nor while another attack is live", () => {
    const a = arena(2, 3);
    a.prismFeintRoll = () => true;
    cast(a, "prism-lance", a.heroes()[0]);
    expect(a.prismFeints.size).toBe(0);
    const b = arena(2, 3);
    b.prismFeintRoll = () => true;
    b.seenAttacks.set("prism-lance", 5);
    cast(b, "fan-display", b.heroes()[1]);
    cast(b, "prism-lance", b.heroes()[0]);
    expect(b.prismFeints.size).toBe(0);
  });
});

describe("combos", () => {
  it("from chapter 1, a lance that misses closes a halo round its raider", () => {
    const a = arena(2, 1);
    a.seenAttacks.set("prism-lance", 5);
    a.prismFeintRoll = () => false;
    const p = a.heroes()[0];
    place(p, 600, 450);
    const [lane] = cast(a, "prism-lance", p);
    place(p, 600, 650); // dodged
    run(a, lane.at - a.time + DT);
    const halos = of(a, "halo-crush");
    expect(halos).toHaveLength(1);
    expect(halos[0].followUp).toBe(true);
    expect(halos[0].targetId).toBe(p.id);
    expect(a.prismReads.combos).toBe(1);
  });
  it("a lance that hits closes nothing", () => {
    const a = arena(2, 1);
    a.seenAttacks.set("prism-lance", 5);
    a.prismFeintRoll = () => false;
    const p = a.heroes()[0];
    place(p, 600, 450);
    const [lane] = cast(a, "prism-lance", p);
    sturdy(a);
    run(a, lane.at - a.time + DT);
    expect(of(a, "halo-crush")).toHaveLength(0);
  });
  it("from chapter 2, a landed Eclipse sends lances after whoever stood in the old light", () => {
    const one = arena(2, 1);
    const [w1] = cast(one, "eclipse", one.heroes()[0]);
    place(one.heroes()[0], 600, 450);
    run(one, w1.at - one.time + DT);
    expect(of(one, "prism-lance")).toHaveLength(0);
    const a = arena(3, 2);
    const [p0, p1, p2] = a.heroes();
    place(p0, 560, 450); // in the light, out of the sunfall
    place(p1, 500, 300);
    place(p2, 1300, 200); // far from it
    const [w] = cast(a, "eclipse", p0);
    run(a, w.at - a.time + DT);
    const lances = of(a, "prism-lance");
    expect(lances).toHaveLength(2);
    expect(lances.every((l) => l.followUp)).toBe(true);
    expect(lances.map((l) => l.targetId).sort()).toEqual([p0.id, p1.id].sort());
    for (const l of lances)
      expect(l.at - a.time).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR - 0.3);
    expect(a.prismReads.combos).toBe(1);
  });
});

describe("overlap keeps a way out", () => {
  it("in a party a lance or fan may fly while a halo closes; alone, never", () => {
    const a = arena(2, 1);
    expect(a.exclusive("halo-crush")).toBe(false);
    cast(a, "halo-crush", a.heroes()[0]);
    expect(a.canOverlap("prism-lance")).toBe(true);
    expect(a.canOverlap("fan-display")).toBe(true);
    expect(a.canOverlap("eclipse")).toBe(false);
    expect(arena(1, 1).exclusive("halo-crush")).toBe(true);
    expect(arena(2, 1, "raid").exclusive("halo-crush")).toBe(true);
  });
  it("a lance whose lane would leave no spot clear of the halo waits until it has landed", () => {
    let blockedSeen = 0;
    const random = prng(91);
    for (let i = 0; i < 40; i++) {
      const a = arena(2, 2);
      const [p0, p1] = a.heroes();
      place(p0, 600 + random() * 300, 300 + random() * 300);
      place(p1, 300 + random() * 300, 250 + random() * 400);
      const [halo] = cast(a, "halo-crush", p0);
      a.seenAttacks.set("prism-lance", 5);
      a.prismFeintRoll = () => false;
      const lanes = cast(a, "prism-lance", p0);
      const blocked = !a.safeSpotExists([halo, ...lanes], 0.1);
      a.spaceOverlap(lanes);
      for (const l of lanes)
        if (blocked) {
          blockedSeen++;
          expect(l.at).toBeGreaterThanOrEqual(halo.at + 1 - EPS);
        } else
          expect(Math.abs(l.at - halo.at)).toBeGreaterThanOrEqual(0.5 - EPS);
      expect(
        a.safeSpotExists([halo, ...lanes]) ||
          lanes.every((l) => l.at >= halo.at + 1 - EPS),
      ).toBe(true);
    }
    // A lane too wide to leave in time beside the halo: it must wait.
    const a = arena(2, 2);
    const [p0, p1] = a.heroes();
    place(p0, 700, 450);
    place(p1, 400, 300);
    const [halo] = cast(a, "halo-crush", p0);
    a.currentCast = ++a.castSerial;
    const wide = a.warn("prism-lance", 1000, 450, 40, 450, 260, P.lance.delay);
    a.currentCast = 0;
    expect(a.safeSpotExists([halo, wide], 0.1)).toBe(false);
    a.spaceOverlap([wide]);
    expect(wide.at).toBeGreaterThanOrEqual(halo.at + 1 - EPS);
    expect(blockedSeen).toBeGreaterThanOrEqual(0);
  });
  it("the fan's hot slice always leaves every raider a spot clear of the controls", () => {
    const random = prng(5);
    for (let i = 0; i < 60; i++) {
      const a = arena(1 + (i % 4), 2);
      for (const p of a.heroes()) {
        let x = 0,
          y = 0;
        do {
          x = 100 + random() * 1400;
          y = 100 + random() * 700;
        } while (prismUnderControls(x, y, 0, 0));
        place(p, x, y);
      }
      const [fan] = cast(a, "fan-display", a.heroes()[0]);
      expect(a.safeSpotExists([fan]), `run ${i}`).toBe(true);
    }
  });
});

describe("fewer, shorter openings", () => {
  it("the open shield lasts less than in the raid", () => {
    for (const size of [1, 2, 4])
      expect(arena(size, 1).exposeSeconds()).toBeLessThan(
        arena(size, 1, "raid").exposeSeconds(),
      );
    const a = arena(1, 1);
    place(a.heroes()[0], 470, 450);
    aimBranch(a, [0, 1]);
    sturdy(a);
    run(a, 2);
    expect(a.raid.shieldBreaks).toBe(1);
    expect(a.raid.exposedUntil - a.time).toBeLessThanOrEqual(A.expose);
  });
});

describe("it reads the fight", () => {
  it("needs a consistent habit, and learns it from real dodges", () => {
    const a = arena(1, 2);
    const p = a.heroes()[0];
    a.notePrismDodge(p.id, 1, 0);
    a.notePrismDodge(p.id, -1, 0);
    a.notePrismDodge(p.id, 0, 1);
    expect(a.prismHabitOf(p.id)).toBeUndefined();
    const b = arena(1, 2);
    const q = b.heroes()[0];
    for (let i = 0; i < 3; i++) {
      place(q, 800, 450);
      b.warn("eclipse", 800, 450, 560, 170, A.eclipse.radius, 1.2);
      b.learnPrismDodges();
      place(q, 800, 650);
      b.raid.warnings = [];
      b.learnPrismDodges();
    }
    expect(b.prismHabitOf(q.id)?.y).toBeGreaterThan(0.9);
  });
  it("answers a raider standing still to attack with a lance", () => {
    const a = arena(2, 1);
    const p = a.heroes()[0];
    place(p, 700, 450);
    a.prismStill.set(p.id, a.time - 2);
    a.prismHitAt.set(p.id, a.time - 0.2);
    expect(a.prismAnchored(p)).toBe(true);
    const s = a.situation(a.heroes()) as RaidSituation;
    expect(a.reactions(s)).toContainEqual({
      kind: "prism-lance",
      score: 1.5,
      target: p,
    });
    a.seenAttacks.set("prism-lance", 5);
    cast(a, "prism-lance", p);
    expect(a.prismReads.anchors).toBe(1);
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
    for (const kind of ["prism-lance", "halo-crush", "umbral-prism"] as const)
      expect(a.chooseTarget(kind, [p1, p2])).toBe(p1);
    const s = a.situation([p1, p2]) as RaidSituation;
    expect(s.reviving).toContain(p1);
    expect(a.reactions(s)).toContainEqual({
      kind: "prism-lance",
      score: 1.6,
      target: p1,
    });
  });
  it("plays its new moves and reads in a real fight", () => {
    seeded(77);
    const a = createRaidArena("REAL", "prismatail", {
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
    expect(a.prismReads.eclipses).toBeGreaterThan(0);
    expect(a.prismReads.umbrals).toBeGreaterThan(0);
    expect(a.prismReads.cleansed).toBeGreaterThan(0);
    expect(a.prismReads.combos).toBeGreaterThan(0);
    expect(a.raid.shieldBreaks).toBeGreaterThan(0);
  });
});

describe("Ascendant Prismell keeps the honesty rules through a raid", () => {
  it.each([1, 2, 4])(
    "with %i raider(s)",
    (size) => {
      seeded(4242 + size);
      const a = createRaidArena("FAIR", "prismatail", {
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
      const jumps: RaidWarning[] = [];
      const kindsSeen = new Set<RaidAttack>();
      let overlaps = 0,
        controls = 0;
      const chip = a.raid.maxHp / 3 / 50 / 30;
      for (let t = 0; t < 160 && !a.raid.result; t += DT) {
        const b = a.boss()!,
          before = b.hp;
        const was = new Map(a.raid.warnings.map((w: RaidWarning) => [w.id, w]));
        for (const p of a.heroes()) if (p.hp > 0) p.hp = 99999;
        a.tick(DT);
        if (a.boss()) a.boss()!.hp = before - chip;
        if ((a.phase as string) === "intermission") a.phase = "playing";
        for (const s of a.relaySources())
          if (prismUnderControls(s.x, s.y, 40)) controls++;
        if (prismUnderControls(b.x, b.y, A.heartClear)) controls++;
        const now = new Set(a.raid.warnings.map((w: RaidWarning) => w.id));
        const landed = [...was.values()].filter(
          (w) => !now.has(w.id) && w.at <= a.time + EPS,
        );
        for (const w of landed) {
          if (RAID_JUMP_ATTACKS.has(w.kind)) jumps.push(w);
          const s = seen.get(w.id);
          if (
            s &&
            !s.followUp &&
            (a.harmful(w) || PRISM_SPATIAL.has(w.kind)) &&
            w.at - (w.startedAt ?? w.at) <
              Math.min(RAID_TELEGRAPH_FLOOR, P.lance.delay) - EPS
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
            .filter((s) => s.cast === c && PRISM_SPATIAL.has(s.w.kind))
            .map((s) => s.w);
          const old = (a.raid.warnings as RaidWarning[]).filter(
            (w) => !mine.includes(w) && PRISM_SPATIAL.has(w.kind),
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
      expect(kindsSeen).toContain("eclipse");
      expect(kindsSeen).toContain("umbral-prism");
      expect(a.raid.phase).toBeGreaterThanOrEqual(2);
      if (size === 4) expect(overlaps).toBeGreaterThan(0);
    },
    120_000,
  );
});
