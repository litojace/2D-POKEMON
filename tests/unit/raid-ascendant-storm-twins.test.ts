/**
 * Ascendant Storm Twins (the Spire's seventieth floor, its summit): harder
 * and smarter than the raid's Fizz and Crackle, but fair. Its tier,
 * pattern, new moves (Mirror Charge, Short Circuit), feints, combos,
 * overlap rule and reads; its rules layer off for the ordinary raid (which
 * keeps its court and kit). Each move's fairness is checked here: a raider
 * who reacts in 0.45 s and walks at the slowest speed always discharges
 * their twin in time (alone too, with the sign flip), always walks onto
 * the Short Circuit before it fires, and always leaves an overload ring;
 * a safe spot always exists and is never under a phone's touch controls,
 * and nothing a raider must see or reach (the twins wherever they drift,
 * the posts, the pad, the beam to stand on) sits under them. No ordinary
 * hit takes more than 60% of the frailest champion's health. Full raids
 * keep the honesty rules (every warning on screen at least the floor) and
 * never mix the sign rules or a Short Circuit with an attack that would
 * leave no answer.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTERS,
  RULES,
  type CharacterId,
  type Fighter,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { StormTwinsArena } from "../../apps/server/src/raid-storm-twins";
import {
  AscendantStormTwinsArena,
  AscendantStormTwinsRules,
  SLOWEST_BASIC,
  mirrorNeed,
  mirrorSignOf,
  onShort,
  overloadDelay,
  shortShare,
  twinClear,
  twinReach,
  twinsUnderControls,
} from "../../apps/server/src/raid-ascendant-storm-twins";
import {
  RAID_EXCLUSIVE_ATTACKS,
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  raidShapeOf,
} from "../../apps/server/src/raid-ai";
import {
  ASCENDANT_STORM_TWINS as A,
  RAID,
  RAID_ASCENDANT_TIER,
  RAID_ATTACKS,
  RAID_TELEGRAPH_FLOOR,
  STORM_TWINS as S,
  ascendantStormTwinsPattern,
  isAscendant,
  raidAttacksOf,
  raidChapters,
  raidPattern,
  raidSoloRevive,
  raidTierOf,
  stormTwinsPattern,
  stormTwinsPosts,
  type RaidAttack,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import { SPIRE_PHONE_CONTROLS } from "../../packages/shared/src/spire";
import { BOSS_ATTACK_ART } from "../../apps/client/src/boss-attack-art";

const DT = 1 / 30;
type Inner = AscendantStormTwinsArena & { [key: string]: any };
type Point = { x: number; y: number };
const TEAM: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
const arena = (
  size = 1,
  phase = 1,
  form: "ascendant" | "raid" = "ascendant",
  team = TEAM,
) => {
  const variant = form === "raid" ? undefined : form;
  const a = createRaidArena("ASC", "storm-twins", { variant }) as Inner;
  team.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configure(3, false);
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 600;
  a.raid.phase = phase;
  a.raid.trait = "restless";
  a.started = true;
  a.nextAttack = Infinity;
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
  } while (twinsUnderControls(x, y, RULES.radius, 0));
  return { x, y };
};
/** Hold everyone's health up (a test of the answer, not of surviving). */
const sturdy = (a: Inner) => {
  for (const p of a.heroes()) if (p.hp > 0) p.hp = 99999;
};
/** Walk `p` toward `to` at the slowest speed for one tick (stop within `near`). */
const step = (p: Fighter, to: Point, near = 0, speed = RAID_SLOWEST_SPEED) => {
  const d = Math.hypot(to.x - p.x, to.y - p.y);
  if (d <= near) {
    p.vx = p.vy = 0;
    return;
  }
  const v = Math.min(speed, (d - near) / DT);
  p.vx = ((to.x - p.x) / d) * v;
  p.vy = ((to.y - p.y) / d) * v;
  p.x += p.vx * DT;
  p.y += p.vy * DT;
};
const frail = Math.min(...Object.values(CHARACTERS).map((c) => c.health));
const weakest = (Object.keys(CHARACTERS) as CharacterId[]).find(
  (id) => CHARACTERS[id].health === frail,
)!;
/**
 * The slowest raiders answering a Mirror Charge: each, 0.45 s after it
 * starts, walks at the slowest speed into its reach of the twin of the
 * opposite sign and hits it once per slowest basic interval. Runs until the
 * charge ends; returns the overload rings it left.
 */
function answerMirror(a: Inner) {
  const start = a.time;
  const last = new Map<string, number>();
  for (let t = 0; t < 30 && a.raid.stormMirror; t += DT) {
    const m = a.raid.stormMirror;
    if (a.time - start >= RAID_REACTION)
      for (const p of a.heroes()) {
        if (p.hp <= 0) continue;
        const sign = mirrorSignOf(m, p.id, a.time);
        const goal = m.twins.find((x: any) => x.sign !== sign);
        const twin = a.twins().find((q: Fighter) => q.id === goal?.id);
        if (!twin) continue;
        const reach = twinReach(p);
        if (Math.hypot(twin.x - p.x, twin.y - p.y) > reach - 2) {
          step(p, twin, reach - 4);
          continue;
        }
        p.vx = p.vy = 0;
        if (a.time - (last.get(p.id) ?? -9) >= SLOWEST_BASIC) {
          last.set(p.id, a.time);
          a.damage(twin, 1, p.id);
        }
      }
    a.tick(DT);
    a.nextAttack = Infinity;
  }
  return a.raid.warnings.filter(
    (w: RaidWarning) => w.kind === "mirror-charge" && w.overload,
  ) as RaidWarning[];
}

describe("the Ascendant tier", () => {
  it("is the shared Ascendant row, with no solo revive and its own revive length", () => {
    expect(raidTierOf("storm-twins", "ascendant")).toBe(RAID_ASCENDANT_TIER);
    expect(raidSoloRevive("storm-twins", "ascendant")).toBeUndefined();
    const a = arena(1);
    expect(a).toBeInstanceOf(AscendantStormTwinsArena);
    expect(a.raid.variant).toBe("ascendant");
    expect(isAscendant(a.raid, "storm-twins")).toBe(true);
    expect(a.tier().reviveSeconds).toBe(A.reviveSeconds);
  });
  it("Mirror Charge and Short Circuit keep their fitted lengths; others never below the floor", () => {
    const a = arena(1);
    expect(a.telegraph("mirror-charge", 9.3)).toBe(9.3);
    expect(a.telegraph("short-circuit", 3.1)).toBe(3.1);
    for (const s of [0.9, 1.15, 1.3, 1.35, 2])
      for (const kind of ["twin-rush", "chain-lightning", "link-beam"] as const)
        expect(a.telegraph(kind, s)).toBeGreaterThanOrEqual(
          Math.min(s, RAID_TELEGRAPH_FLOOR),
        );
    expect(overloadDelay()).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
  });
  it("health: the tier's formula alone; per extra raider, ASCENDANT_STORM_TWINS.perExtraPlayer; split between the twins", () => {
    const solo = arena(1).raid.maxHp;
    for (const size of [2, 3, 4]) {
      const a = arena(size);
      const want =
        ((solo / RAID.soloHealth) *
          (S.health.base + A.perExtraPlayer * (size - 1))) /
        S.health.base;
      expect(a.raid.maxHp / want).toBeGreaterThan(0.97);
      expect(a.raid.maxHp / want).toBeLessThan(1.03);
      const [fizz, crackle] = a.pair();
      expect(fizz.hp + crackle.hp).toBe(a.raid.maxHp);
      expect(a.raid.twins!.map((t: any) => t.maxHp)).toEqual([
        fizz.hp,
        crackle.hp,
      ]);
    }
  });
  it("never Gilded: one look, one health, also on retries", () => {
    for (let i = 0; i < 8; i++) {
      seeded(i * 977 + 5);
      const a = arena(2);
      expect(a.raid.gilded).toBeFalsy();
      expect(a.raid.name).toBe(A.name);
      const [fizz, crackle] = a.pair();
      expect(fizz.name).toBe("Fizz");
      expect(crackle.name).toBe("Crackle");
      expect(fizz.hp + crackle.hp).toBe(a.raid.maxHp);
      a.retry();
      a.start();
      expect(a.raid.variant).toBe("ascendant");
      expect(a.raid.gilded).toBeFalsy();
    }
  });
  it("hits by party size as ASCENDANT_STORM_TWINS.damage sets (never past ×1.2)", () => {
    for (const size of [1, 2, 3, 4]) {
      const a = arena(size);
      expect(A.damage[size - 1]).toBeLessThanOrEqual(1.2);
      expect(a.bossDamage()).toBeCloseTo(
        RAID_ASCENDANT_TIER.damage * A.damage[size - 1],
      );
    }
  });
  it("no ordinary hit takes more than 60% of the frailest champion's health, at any party size", () => {
    const kit: Record<string, number> = {
      "link-beam": S.link.damage,
      "chain-lightning": S.chain.damage[0],
      "static-field": S.field.damage * 0.55,
      "twin-rush": S.rush.damage,
      polarity: S.polarity.damage,
      "polarity (same sign)": S.polarity.damage * A.polarityMismatch,
      thunderclap: S.clap.damage,
      "mirror-charge (overload)": A.mirror.damage,
      "short-circuit (alone on it)": shortShare(1, 4),
      "short-circuit (arc)": shortShare(0, 4),
    };
    for (const size of [1, 2, 3, 4]) {
      const a = arena(size);
      for (const [kind, base] of Object.entries(kit))
        expect(
          base * a.bossDamage(),
          `${kind} with ${size}`,
        ).toBeLessThanOrEqual(0.6 * frail);
    }
    // The share never exceeds its cap, whoever stands on it.
    for (const alive of [1, 2, 3, 4])
      for (let on = 0; on <= alive; on++)
        expect(shortShare(on, alive)).toBeLessThanOrEqual(A.short.maxShare);
  });
  it("real hits on the frailest champion agree: Short Circuit alone on it, a same-sign Polarity, an overload", () => {
    for (const size of [1, 2, 4]) {
      const team = [weakest, ...TEAM.filter((c) => c !== weakest)];
      // Short Circuit, the frailest alone on it
      const a = arena(size, 2, "ascendant", team);
      const [fizz, crackle] = a.pair();
      place(fizz, 500, 450);
      place(crackle, 900, 450);
      const p = a.heroes()[0];
      place(p, 700, 450);
      a.heroes()
        .slice(1)
        .forEach((q: Fighter, i: number) => place(q, 400 + i * 200, 800));
      const [w] = cast(a, "short-circuit", p);
      expect(w.kind).toBe("short-circuit");
      run(a, w.at - a.time + 0.1);
      expect(hurt(p), `short with ${size}`).toBeGreaterThan(0);
      expect(hurt(p), `short with ${size}`).toBeLessThanOrEqual(0.6 * frail);
      // Polarity, two raiders of the same sign together
      if (size >= 2) {
        const b = arena(size, 2, "ascendant", team);
        const [q, o] = b.heroes();
        place(q, 600, 300);
        place(o, 640, 300);
        b.heroes()
          .slice(2)
          .forEach((x: Fighter, i: number) => place(x, 300 + 300 * i, 800));
        b.raid.polarities = b.heroes().map((x: Fighter, i: number) => ({
          playerId: x.id,
          sign: i < 2 ? 1 : -1,
          until: b.time + 0.05,
          cancelled: false,
        }));
        run(b, 0.2);
        expect(hurt(q), `polarity with ${size}`).toBeGreaterThan(0);
        expect(hurt(q), `polarity with ${size}`).toBeLessThanOrEqual(
          0.6 * frail,
        );
      }
    }
  });
  it("its rhythm tightens by chapter and with the party (the ordinary raid's by less)", () => {
    const gaps = [1, 2, 3].map((phase) => arena(4, phase).cadence());
    expect(gaps[1]).toBeLessThan(gaps[0]);
    expect(gaps[2]).toBeLessThan(gaps[1]);
    for (const phase of [1, 2, 3])
      expect(arena(4, phase).cadence()).toBeLessThan(
        arena(4, phase, "raid").cadence(),
      );
    expect(arena(4, 2).cadence()).toBeLessThan(arena(2, 2).cadence());
  });
});

describe("the layer acts only for the twins' Ascendant form", () => {
  it("the ordinary raid keeps its class, pattern, court and kit", () => {
    const a = arena(2, 1, "raid");
    expect(a).toBeInstanceOf(StormTwinsArena);
    expect(a).not.toBeInstanceOf(AscendantStormTwinsArena);
    expect(a.raid.variant).toBeUndefined();
    expect(a.pattern()).toEqual(stormTwinsPattern(1, "restless"));
    const [fizz, crackle] = a.players.filter((p: Fighter) => p.raidBoss);
    expect([fizz.x, fizz.y, crackle.x, crackle.y]).toEqual([
      960, 380, 1150, 520,
    ]);
    expect(a.beamPosts()).toBe(S.posts);
    expect(a.rushBox()).toBe(S.rush.box);
    expect(a.orbitHome()).toBe(S.home);
    expect(a.orbitRadius()).toBe(120);
    expect(stormTwinsPosts(a.raid)).toBe(S.posts);
    expect(raidAttacksOf("storm-twins")).not.toContain("mirror-charge");
    for (const phase of [1, 2, 3])
      expect(raidPattern(phase, 3, 4, "storm-twins")).not.toEqual(
        expect.arrayContaining(["mirror-charge"]),
      );
  });
  it("is off on a Storm Twins arena that isn't Ascendant", () => {
    const Layered = AscendantStormTwinsRules(StormTwinsArena);
    const a = new Layered("L", "storm-twins") as unknown as Inner;
    a.add("p0", "P0", "voltkit");
    a.configure(3, false);
    a.start();
    expect(a.twinsAscendant()).toBe(false);
    expect(a.pattern()).toEqual(stormTwinsPattern(a.raid.phase, a.raid.trait));
    expect(a.twinSpawns()).toEqual([
      { x: 960, y: 380 },
      { x: 1150, y: 520 },
    ]);
    expect(a.beamPosts()).toBe(S.posts);
    // its mirror and short-circuit rules are not consulted
    expect(a.allows("polarity")).toBe(true);
  });
  it("switching the variant on before the twins spawn lays the Ascendant's court (the Spire's order)", () => {
    const Layered = AscendantStormTwinsRules(StormTwinsArena);
    const a = new Layered("L", "storm-twins") as unknown as Inner;
    a.add("p0", "P0", "voltkit");
    a.configure(3, false);
    a.start();
    // The Spire: setupArena (variant off), then the variant on, then spawnBoss.
    a.players = a.players.filter((p: Fighter) => !p.raidBoss);
    a.setupArena();
    a.raid.variant = "ascendant";
    a.spawnBoss();
    const twins = a.players.filter((p: Fighter) => p.raidBoss);
    expect(twins.map((p: Fighter) => ({ x: p.x, y: p.y }))).toEqual(
      A.spawns.map((p) => ({ ...p })),
    );
    expect(a.beamPosts()).toBe(A.posts);
    expect(stormTwinsPosts(a.raid)).toBe(A.posts);
  });
});

describe("Ascendant Storm Twins' kit", () => {
  it("plays Mirror Charge every chapter and Short Circuit from chapter 2, and keeps the raid's kit", () => {
    for (const phase of [1, 2, 3]) {
      const p = raidPattern(phase, 3, 4, "storm-twins", "ascendant");
      expect(p).toEqual(ascendantStormTwinsPattern(phase));
      expect(p).toContain("mirror-charge");
      if (phase > 1) expect(p).toContain("short-circuit");
      expect(p).toContain("link-beam");
      expect(p).toContain("twin-rush");
      expect(arena(4, phase).pattern()).toEqual(
        ascendantStormTwinsPattern(phase),
      );
    }
    expect(raidChapters("storm-twins", "ascendant").map((c) => c.name)).toEqual(
      ["Charged Pair", "Overcharge", "Ascendant Storm"],
    );
  });
  it("its new attacks have guide text, a glyph, a shape and a place in the guide", () => {
    for (const kind of ["mirror-charge", "short-circuit"] as RaidAttack[]) {
      expect(RAID_ATTACKS[kind].name.length).toBeGreaterThan(3);
      expect(RAID_ATTACKS[kind].tip.length).toBeGreaterThan(20);
      expect(RAID_ATTACKS[kind].summary.length).toBeGreaterThan(10);
    }
    expect(raidShapeOf("short-circuit")).toBe("line");
    expect(raidShapeOf("mirror-charge")).toBe("circle");
    expect(RAID_EXCLUSIVE_ATTACKS.has("mirror-charge")).toBe(false);
    const a = arena(2);
    expect(a.exclusive("short-circuit")).toBe(true);
    const guide = raidAttacksOf("storm-twins", "ascendant");
    expect(guide).toEqual(
      expect.arrayContaining(["mirror-charge", "short-circuit"]),
    );
    expect(guide).toHaveLength(8);
    for (const kind of guide) expect(BOSS_ATTACK_ART, kind).toContain(kind);
  });
  it("with one twin down, both new moves become a Thunderclap", () => {
    for (const kind of ["mirror-charge", "short-circuit"] as RaidAttack[]) {
      const a = arena(2, 3);
      const [, crackle] = a.pair();
      a.damage(crackle, 99999, a.heroes()[0].id);
      expect(crackle.hp).toBeLessThanOrEqual(0);
      const fresh = cast(a, kind, a.heroes()[0]);
      expect(fresh.map((w) => w.kind)).toEqual(["thunderclap"]);
      expect(a.raid.stormMirror).toBeUndefined();
    }
  });
});

describe("the phone's touch controls", () => {
  const under = (p: Point, r = S.radius) => twinsUnderControls(p.x, p.y, r);
  it("knows the controls: each box's middle is under, the court's middle is not", () => {
    expect(A.phoneControls).toBe(SPIRE_PHONE_CONTROLS);
    for (const [x0, y0, x1, y1] of A.phoneControls)
      expect(under({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, 0)).toBe(true);
    expect(under({ x: 800, y: 450 }, 0)).toBe(false);
  });
  it("the twins start, orbit, sweep and rush clear of them (the raid's court does not)", () => {
    for (const p of A.spawns) expect(under(p), `${p.x},${p.y}`).toBe(false);
    for (const radius of [A.orbit.first, A.orbit.later, A.orbit.bickering])
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        const p = {
          x: A.home.x + Math.cos(a) * radius,
          y: A.home.y + Math.sin(a) * Math.min(170, radius * 0.6),
        };
        expect(under(p), `orbit ${radius} ${k}`).toBe(false);
      }
    const b = A.box;
    for (let i = 0; i <= 20; i++)
      for (let j = 0; j <= 20; j++) {
        const p = {
          x: b.x0 + ((b.x1 - b.x0) * i) / 20,
          y: b.y0 + ((b.y1 - b.y0) * j) / 20,
        };
        expect(under(p), `box ${p.x},${p.y}`).toBe(false);
      }
    // the raid's own: Crackle starts under them, its orbit and box reach them
    expect(under({ x: 1150, y: 520 })).toBe(true);
    expect(under({ x: S.rush.box.x1, y: 600 })).toBe(true);
  });
  it("the copper posts and every beam through them stand clear (the raid's bottom-right post does not)", () => {
    const post = 30; // a post's drawn half-width and orb
    for (const p of A.posts)
      expect(under(p, post), `${p.x},${p.y}`).toBe(false);
    expect(S.posts.some((p) => under(p, post))).toBe(true);
    // beams between any two spots of the box, through any post: every point clear
    const corners = [
      { x: A.box.x0, y: A.box.y0 },
      { x: A.box.x1, y: A.box.y0 },
      { x: A.box.x0, y: A.box.y1 },
      { x: A.box.x1, y: A.box.y1 },
    ];
    for (const a of corners)
      for (const b of corners)
        for (const via of A.posts)
          for (const [p, q] of [
            [a, via],
            [via, b],
          ])
            for (let k = 0; k <= 10; k++)
              expect(
                under(
                  {
                    x: p.x + ((q.x - p.x) * k) / 10,
                    y: p.y + ((q.y - p.y) * k) / 10,
                  },
                  S.link.width,
                ),
              ).toBe(false);
  });
  it("the solo pad is always clear of them, wherever the last raider stands", () => {
    const random = prng(11);
    for (let i = 0; i < 300; i++) {
      const a = arena(1, 2);
      const p = a.heroes()[0];
      const at = { x: 60 + random() * 1480, y: 60 + random() * 780 };
      place(p, at.x, at.y);
      const pad = a.padSpot(p);
      expect(
        twinsUnderControls(pad.x, pad.y, S.polarity.padRadius),
        `${at.x},${at.y}`,
      ).toBe(false);
      expect(Math.hypot(pad.x - p.x, pad.y - p.y)).toBeLessThanOrEqual(260);
      if (i > 20) break;
    }
    // and really used by Polarity
    for (const at of [
      [1300, 600],
      [140, 700],
      [1250, 400],
    ]) {
      const a = arena(1, 2);
      place(a.heroes()[0], at[0], at[1]);
      cast(a, "polarity", a.heroes()[0]);
      const pad = a.raid.polarityPad!;
      expect(twinsUnderControls(pad.x, pad.y, S.polarity.padRadius)).toBe(
        false,
      );
    }
  });
  it("a twin pushed under them glides back out in moments, and no attack starts meanwhile", () => {
    const a = arena(2, 2);
    const [fizz] = a.pair();
    place(fizz, 1250, 600);
    expect(twinClear(fizz)).toBe(false);
    expect(a.canStartAttack()).toBe(false);
    run(a, 1.6);
    expect(twinClear(fizz)).toBe(true);
    expect(a.canStartAttack()).toBe(true);
  });
  it("the safe-spot rule never counts ground under them", () => {
    const a = arena(1, 2);
    for (const [x0, y0, x1, y1] of A.phoneControls) {
      const x = Math.max(30, Math.min(1570, (x0 + x1) / 2)),
        y = (y0 + y1) / 2;
      expect(a.twinClearSpot([], x, y)).toBe(false);
    }
    expect(a.twinClearSpot([], 700, 450)).toBe(true);
  });
});

describe("Mirror Charge", () => {
  it("marks Fizz +, Crackle −, and splits the raiders half each (nearer Crackle: +)", () => {
    for (const size of [2, 3, 4]) {
      const a = arena(size, 1);
      const [fizz, crackle] = a.pair();
      place(fizz, 500, 450);
      place(crackle, 1000, 450);
      a.heroes().forEach((p: Fighter, i: number) =>
        place(p, i % 2 ? 950 : 550, 300 + i * 80),
      );
      cast(a, "mirror-charge", a.heroes()[0]);
      const m = a.raid.stormMirror!;
      expect(m.twins.map((t: any) => [t.id, t.sign])).toEqual([
        [fizz.id, 1],
        [crackle.id, -1],
      ]);
      const plus = m.signs.filter((s: any) => s.sign > 0);
      expect(Math.abs(plus.length * 2 - size)).toBeLessThanOrEqual(1);
      // those nearer Crackle take + (to hit it)
      for (const s of m.signs) {
        const p = a.heroes().find((q: Fighter) => q.id === s.playerId)!;
        if (size % 2 === 0) expect(s.sign > 0).toBe(p.x > 800);
      }
      for (const t of m.twins)
        expect(t.need).toBe(
          A.mirror.hits * m.signs.filter((s: any) => s.sign !== t.sign).length,
        );
    }
  });
  it("only the opposite sign discharges a twin; the same sign is repelled (no damage)", () => {
    const a = arena(2, 1);
    const [fizz, crackle] = a.pair();
    cast(a, "mirror-charge", a.heroes()[0]);
    const m = a.raid.stormMirror!;
    const plus = a
      .heroes()
      .find((p: Fighter) => mirrorSignOf(m, p.id, a.time) === 1)!;
    const before = fizz.hp;
    a.damage(fizz, 10, plus.id);
    expect(fizz.hp).toBe(before);
    expect(m.twins[0].hits).toBe(0);
    const hp = crackle.hp;
    a.damage(crackle, 10, plus.id);
    expect(crackle.hp).toBeLessThan(hp);
    expect(m.twins[1].hits).toBe(1);
    // a quick second hit within `every` does not count twice
    a.damage(crackle, 10, plus.id);
    expect(m.twins[1].hits).toBe(1);
  });
  it("the slowest party discharges both in time from anywhere (a reaction, the walk, the hits)", () => {
    const random = prng(7);
    for (const size of [2, 3, 4])
      for (let i = 0; i < 12; i++) {
        const a = arena(size, 1 + (i % 3));
        sturdy(a);
        for (const p of a.heroes()) {
          const at = anywhere(random, 80);
          place(p, at.x, at.y);
        }
        cast(a, "mirror-charge", a.heroes()[0]);
        const m = a.raid.stormMirror!;
        // the charge fits each raider's need
        for (const s of m.signs) {
          const p = a.heroes().find((q: Fighter) => q.id === s.playerId)!;
          const twin = a.pair()[s.sign > 0 ? 1 : 0];
          expect(m.until - m.startedAt + 1e-6).toBeGreaterThanOrEqual(
            mirrorNeed(
              Math.hypot(twin.x - p.x, twin.y - p.y),
              twinReach(p),
              A.mirror.hits,
            ),
          );
        }
        const rings = answerMirror(a);
        expect(rings, `${size} raiders, run ${i}`).toEqual([]);
        expect(a.twinReads.discharged).toBe(1);
      }
  });
  it("alone: the sign flips half-way (shown from the start), and the slowest raider discharges both", () => {
    const random = prng(3);
    for (let i = 0; i < 12; i++) {
      const a = arena(1, 1 + (i % 3));
      sturdy(a);
      const p = a.heroes()[0];
      const at = anywhere(random, 80);
      place(p, at.x, at.y);
      cast(a, "mirror-charge", p);
      const m = a.raid.stormMirror!;
      expect(m.flipAt).toBeDefined();
      expect(m.flipAt! - m.startedAt).toBeCloseTo((m.until - m.startedAt) / 2);
      const first = mirrorSignOf(m, p.id, a.time);
      expect(mirrorSignOf(m, p.id, m.flipAt! + 0.01)).toBe(-first!);
      for (const t of m.twins) expect(t.need).toBe(A.mirror.soloHits);
      expect(answerMirror(a), `run ${i}`).toEqual([]);
    }
  });
  it("alone, the first twin can't be discharged after the flip: it overloads", () => {
    const a = arena(1, 1);
    sturdy(a);
    const p = a.heroes()[0];
    cast(a, "mirror-charge", p);
    const m = a.raid.stormMirror!;
    const sign = mirrorSignOf(m, p.id, a.time)!;
    const firstTwin = a.pair()[sign > 0 ? 1 : 0];
    run(a, m.flipAt! - a.time + 0.05);
    for (let i = 0; i < 5; i++) {
      a.mirrorHitAt.clear();
      a.damage(firstTwin, 1, p.id);
    }
    expect(m.twins.find((t: any) => t.id === firstTwin.id)!.hits).toBe(0);
  });
  it("a twin left charged overloads: a ring round it, long enough to walk out of from its middle", () => {
    const a = arena(2, 2);
    sturdy(a);
    const [fizz, crackle] = a.pair();
    const [stay, leave] = a.heroes();
    place(fizz, 480, 450);
    place(crackle, 960, 450);
    cast(a, "mirror-charge", stay);
    const m = a.raid.stormMirror!;
    run(a, m.until - a.time + DT);
    const rings = of(a, "mirror-charge").filter((w) => w.overload);
    expect(rings).toHaveLength(2);
    expect(a.twinReads.overloads).toBe(2);
    for (const w of rings) {
      expect(w.radius).toBe(A.mirror.radius);
      expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
        RAID_REACTION + (w.radius + RULES.radius) / RAID_SLOWEST_SPEED,
      );
      expect([fizz.id, crackle.id]).toContain(w.casterId);
    }
    // the twins hold still while their rings are drawn
    const ring = rings.find((w) => w.casterId === fizz.id)!;
    const other = rings.find((w) => w !== ring)!;
    // away from the other ring; beside its body (a raider inside would shove it)
    const len = Math.hypot(ring.x - other.x, ring.y - other.y) || 1,
      ux = (ring.x - other.x) / len,
      uy = (ring.y - other.y) / len,
      gap = S.radius + RULES.radius + 4;
    place(stay, ring.x + ux * gap, ring.y + uy * gap);
    place(leave, ring.x + ux * gap, ring.y + uy * gap);
    const start = a.time;
    const hp = { stay: stay.hp, leave: leave.hp };
    const away = { x: ring.x + ux * 420, y: ring.y + uy * 420 };
    while (a.time < ring.at + 0.1) {
      if (a.time - start >= RAID_REACTION) step(leave, away);
      a.tick(DT);
      a.nextAttack = Infinity;
      if (a.time < ring.at)
        expect(Math.hypot(fizz.x - ring.x, fizz.y - ring.y)).toBeLessThan(1);
    }
    expect(hp.stay - stay.hp).toBeGreaterThan(0);
    expect(hp.leave - leave.hp).toBe(0);
  });
  it("a raider going down refits the need: a twin whose opposite raiders are all down is discharged", () => {
    const a = arena(2, 1);
    cast(a, "mirror-charge", a.heroes()[0]);
    const m = a.raid.stormMirror!;
    const plus = a
      .heroes()
      .find((p: Fighter) => mirrorSignOf(m, p.id, a.time) === 1)!;
    plus.hp = 0;
    run(a, 0.1);
    // Crackle (−) needed + hits: it is no longer charged
    expect(m.twins[1].need).toBe(0);
  });
});

describe("Short Circuit", () => {
  it("is drawn long enough for the slowest raider to walk onto it, and the twins hold still", () => {
    const random = prng(5);
    for (const size of [1, 2, 4])
      for (let i = 0; i < 10; i++) {
        const a = arena(size, 2 + (i % 2));
        sturdy(a);
        for (const p of a.heroes()) {
          const at = anywhere(random, 70);
          place(p, at.x, at.y);
        }
        const [w] = cast(a, "short-circuit", a.heroes()[0]);
        expect(w.kind).toBe("short-circuit");
        expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(A.short.delay);
        const stretch = a.shortStretch(
          { x: w.x, y: w.y },
          { x: w.tx, y: w.ty },
        );
        expect(stretch.length).toBeGreaterThan(0);
        for (const s of stretch)
          expect(twinsUnderControls(s.x, s.y, RULES.radius)).toBe(false);
        const twins = a.pair().map((p: Fighter) => ({ x: p.x, y: p.y }));
        const start = a.time;
        while (a.time < w.at - 1e-6) {
          if (a.time - start >= RAID_REACTION)
            for (const p of a.heroes()) {
              const goal = [...stretch].sort(
                (m: Point, n: Point) =>
                  Math.hypot(m.x - p.x, m.y - p.y) -
                  Math.hypot(n.x - p.x, n.y - p.y),
              )[0];
              step(p, goal);
            }
          a.tick(DT);
          a.nextAttack = Infinity;
          a.pair().forEach((p: Fighter, j: number) =>
            expect(Math.hypot(p.x - twins[j].x, p.y - twins[j].y)).toBeLessThan(
              1,
            ),
          );
        }
        for (const p of a.heroes())
          expect(onShort(w, p), `${size} raiders, run ${i}`).toBe(true);
        run(a, 0.1);
        expect(a.twinReads.shared).toBe(1);
        expect(a.raid.stormShort?.sharers).toHaveLength(size);
      }
  });
  it("those on it share the shock (a floor each, a cap each); nobody on it and it arcs to everyone", () => {
    for (const on of [0, 1, 2, 4]) {
      const a = arena(4, 2);
      const [fizz, crackle] = a.pair();
      place(fizz, 450, 450);
      place(crackle, 950, 450);
      a.heroes().forEach((p: Fighter, i: number) =>
        i < on ? place(p, 560 + i * 90, 450) : place(p, 300 + i * 250, 800),
      );
      const [w] = cast(a, "short-circuit", a.heroes()[0]);
      // jumping does not help: it can't be jumped
      for (const p of a.heroes()) p.jumpUntil = w.at + 1;
      run(a, w.at - a.time + 0.05);
      const each = shortShare(on, 4) * a.bossDamage();
      a.heroes().forEach((p: Fighter, i: number) => {
        const want = on === 0 || i < on ? each : 0;
        expect(hurt(p), `${on} on it, raider ${i}`).toBeCloseTo(want, 0);
      });
      expect(a.twinReads[on ? "shared" : "arced"]).toBe(1);
    }
    expect(shortShare(4, 4)).toBe(A.short.minShare);
    expect(shortShare(0, 4)).toBeGreaterThan(shortShare(4, 4));
  });
  it("never with chain lightning, Polarity or a Mirror Charge; nothing joins it", () => {
    const a = arena(4, 3);
    expect(a.allows("short-circuit")).toBe(true);
    cast(a, "chain-lightning", a.heroes()[0]);
    expect(a.allows("short-circuit")).toBe(false);
    a.raid.warnings = [];
    a.raid.polarities = [
      { playerId: "p0", sign: 1, until: a.time + 3, cancelled: false },
    ];
    expect(a.allows("short-circuit")).toBe(false);
    a.raid.polarities = [];
    cast(a, "mirror-charge", a.heroes()[0]);
    expect(a.allows("short-circuit")).toBe(false);
    a.clearAttacks();
    a.raid.warnings = [];
    cast(a, "short-circuit", a.heroes()[0]);
    expect(a.allows("chain-lightning")).toBe(false);
    expect(a.allows("polarity")).toBe(false);
    expect(a.allows("mirror-charge")).toBe(false);
    expect(a.busy()).toBe(true);
  });
  it("a twin falling or staggered puts it out", () => {
    const a = arena(2, 3);
    cast(a, "short-circuit", a.heroes()[0]);
    a.damage(a.pair()[1], 99999, "p0");
    expect(of(a, "short-circuit")).toEqual([]);
    const b = arena(2, 2);
    cast(b, "short-circuit", b.heroes()[0]);
    b.raid.twins![1].exposedUntil = b.time + 5;
    run(b, 0.1);
    expect(of(b, "short-circuit")).toEqual([]);
  });
});

describe("feints, combos and reads", () => {
  it("a Twin Rush may turn, part-way, into a Link Beam shown in full from then", () => {
    const a = arena(2, 2);
    a.seenAttacks.set("twin-rush", 5);
    a.twinFeintRoll = () => true;
    const lanes = cast(a, "twin-rush", a.heroes()[0]);
    expect(lanes.map((w) => w.kind)).toEqual(["twin-rush", "twin-rush"]);
    const turn =
      lanes[0].startedAt! +
      (lanes[0].at - lanes[0].startedAt!) * A.feint.turnAt;
    run(a, turn - a.time + DT);
    expect(of(a, "twin-rush")).toEqual([]);
    const [beam] = of(a, "link-beam");
    expect(beam).toBeDefined();
    expect(beam.startedAt).toBeGreaterThanOrEqual(turn - 1e-6);
    expect(beam.at - beam.startedAt!).toBeGreaterThanOrEqual(
      RAID_TELEGRAPH_FLOOR,
    );
    expect(a.twinReads.feints).toBe(1);
  });
  it("a Twin Rush whose lanes teach it never feints", () => {
    const a = arena(2, 2);
    a.twinFeintRoll = () => true;
    cast(a, "twin-rush", a.heroes()[0]);
    expect(a.twinFeints.size).toBe(0);
  });
  it("chapter 3: both twins discharged answer with Polarity on the same signs", () => {
    const a = arena(2, 3);
    sturdy(a);
    const [one, two] = a.heroes();
    place(one, 600, 450);
    place(two, 900, 450);
    cast(a, "mirror-charge", one);
    const m = a.raid.stormMirror!;
    const signs = Object.fromEntries(
      m.signs.map((s: any) => [s.playerId, s.sign]),
    );
    expect(answerMirror(a)).toEqual([]);
    expect(a.twinReads.combos).toBe(1);
    expect(
      Object.fromEntries(
        a.raid.polarities!.map((p: any) => [p.playerId, p.sign]),
      ),
    ).toEqual(signs);
    // not before chapter 3
    const b = arena(2, 2);
    sturdy(b);
    cast(b, "mirror-charge", b.heroes()[0]);
    answerMirror(b);
    expect(b.raid.polarities ?? []).toEqual([]);
  });
  it("from chapter 2, a shared Short Circuit leaves a static field where its sharers stood", () => {
    const a = arena(2, 2);
    sturdy(a);
    const [fizz, crackle] = a.pair();
    place(fizz, 450, 450);
    place(crackle, 950, 450);
    a.heroes().forEach((p: Fighter, i: number) => place(p, 620 + i * 100, 450));
    const [w] = cast(a, "short-circuit", a.heroes()[0]);
    run(a, w.at - a.time + 0.05);
    const [field] = of(a, "static-field");
    expect(field).toBeDefined();
    expect(field.followUp).toBe(true);
    expect(Math.hypot(field.x - 670, field.y - 450)).toBeLessThan(5);
    expect(field.at - a.time).toBeGreaterThan(0.5);
    expect(a.twinReads.combos).toBe(1);
  });
  it("a static field lands where a raider usually dodges, once the habit is trusted", () => {
    const a = arena(2, 2);
    const p = a.heroes()[0];
    place(p, 700, 450);
    cast(a, "static-field", p);
    expect(of(a, "static-field")).toHaveLength(1);
    a.raid.warnings = [];
    for (let i = 0; i < A.habit.samples; i++) a.noteTwinDodge(p.id, 1, 0);
    cast(a, "static-field", p);
    const fields = of(a, "static-field");
    expect(fields).toHaveLength(2);
    expect(fields.some((f) => Math.abs(f.x - (700 + A.habit.offset)) < 1)).toBe(
      true,
    );
    expect(a.twinReads.habits).toBe(1);
  });
  it("standing still to attack draws a Twin Rush; kneeling to revive draws a field and the hunt", () => {
    const a = arena(3, 2);
    const [still, kneel, down] = a.heroes();
    place(still, 500, 300);
    a.twinStill.set(still.id, a.time - 2);
    a.twinHitAt.set(still.id, a.time - 0.2);
    expect(a.twinAnchored(still)).toBe(true);
    place(down, 900, 700);
    down.hp = 0;
    a.raid.downed[down.id] = { at: a.time, until: a.time + 30 } as any;
    place(kneel, 930, 700);
    const s = a.situation(a.heroes().filter((p: Fighter) => p.hp > 0));
    const r = a.reactions(s);
    expect(r).toContainEqual(
      expect.objectContaining({ kind: "twin-rush", target: still }),
    );
    expect(r).toContainEqual(
      expect.objectContaining({ kind: "static-field", target: kneel }),
    );
    expect(a.chooseTarget("chain-lightning", [still, kneel])).toBe(kneel);
  });
});

describe("a party meets both twins at once", () => {
  it("from ASCENDANT_STORM_TWINS.pair, a chain or a clap comes from both twins (at another raider, a moment later)", () => {
    const a = arena(A.pair.raiders, A.pair.from);
    const [one, two] = a.heroes();
    place(one, 400, 300);
    place(two, 1000, 700);
    const chains = cast(a, "chain-lightning", one);
    expect(chains).toHaveLength(2);
    expect(new Set(chains.map((w) => w.casterId)).size).toBe(2);
    expect(new Set(chains.map((w) => w.targetId)).size).toBe(2);
    expect(chains[1].at - chains[0].at).toBeCloseTo(A.pair.gap, 1);
    const claps = cast(a, "thunderclap", one);
    expect(claps).toHaveLength(2);
    expect(new Set(claps.map((w) => w.casterId)).size).toBe(2);
    expect(a.twinReads.pairs).toBe(2);
  });
  it("not before its chapter, nor with fewer raiders up", () => {
    expect(
      cast(arena(4, A.pair.from - 1), "chain-lightning", arena(4).heroes()[0]),
    ).toHaveLength(1);
    const b = arena(A.pair.raiders - 1, 3);
    expect(cast(b, "chain-lightning", b.heroes()[0])).toHaveLength(1);
  });
});

describe("Twin Rush alone", () => {
  it("the second lane runs beside the lone raider, so the twins don't end on top of each other", () => {
    const a = arena(1, 2);
    const p = a.heroes()[0];
    place(p, 600, 450);
    const [first, second] = cast(a, "twin-rush", p);
    const off = (w: RaidWarning) => {
      const dx = w.tx - w.x,
        dy = w.ty - w.y,
        len = Math.hypot(dx, dy) || 1;
      return Math.abs((p.x - w.x) * dy - (p.y - w.y) * dx) / len;
    };
    expect(off(first)).toBeLessThan(5);
    expect(off(second)).toBeGreaterThan(60);
    expect(
      Math.hypot(first.tx - second.tx, first.ty - second.ty),
    ).toBeGreaterThan(2 * S.radius);
    // the raid's twins keep their own aim
    const b = arena(1, 2, "raid");
    place(b.heroes()[0], 600, 450);
    const lanes = cast(b, "twin-rush", b.heroes()[0]);
    expect(lanes.every((w) => off(w) < 5)).toBe(true);
  });
});

describe("overlap and the safe-spot rule", () => {
  it("chapter 1 (or alone): nothing starts while a Mirror Charge runs", () => {
    for (const [size, phase] of [
      [2, 1],
      [1, 3],
    ]) {
      const a = arena(size, phase);
      cast(a, "mirror-charge", a.heroes()[0]);
      for (const kind of ascendantStormTwinsPattern(phase))
        expect(a.allows(kind), `${size} ${phase} ${kind}`).toBe(false);
    }
  });
  it("from chapter 2 with two raiders up: anything but Polarity, Short Circuit or another charge", () => {
    const a = arena(2, 2);
    cast(a, "mirror-charge", a.heroes()[0]);
    for (const kind of [
      "chain-lightning",
      "static-field",
      "thunderclap",
      "link-beam",
      "twin-rush",
    ] as RaidAttack[])
      expect(a.allows(kind), kind).toBe(true);
    for (const kind of [
      "polarity",
      "short-circuit",
      "mirror-charge",
    ] as RaidAttack[])
      expect(a.allows(kind), kind).toBe(false);
  });
  it("an attack that would leave no safe spot with what is live waits until it landed", () => {
    const a = arena(1, 2);
    const p = a.heroes()[0];
    place(p, 700, 450);
    // overload rings and fields closing every spot within reach
    a.raid.warnings = [];
    const old = Object.assign(
      a.warn("mirror-charge", 700, 450, 700, 450, A.mirror.radius, 1.6),
      { overload: true, casterId: a.pair()[0].id },
    );
    a.currentCast = ++a.castSerial;
    const fresh: RaidWarning[] = [];
    for (const [x, y] of [
      [700, 200],
      [700, 700],
      [430, 450],
      [970, 450],
      [500, 260],
      [900, 260],
      [500, 640],
      [900, 640],
    ])
      fresh.push(
        Object.assign(a.warn("static-field", x, y, x, y, S.field.radius, 1.2), {
          casterId: a.pair()[0].id,
        }),
      );
    a.currentCast = 0;
    expect(a.safeSpotExists([old, ...fresh])).toBe(false);
    a.spaceOverlap(fresh);
    for (const w of fresh) expect(w.at).toBeGreaterThan(old.at);
  });
});

describe("whole raids keep the honesty rules", () => {
  for (const size of [1, 2, 4])
    it(`${size} stand-in raider(s): every warning on screen, no sign rules mixed with a Short Circuit, the twins clear of the controls`, () => {
      seeded(900 + size);
      const a = arena(size, 1);
      a.nextAttack = a.time + 1;
      for (const p of a.heroes()) a.standIn(p.id);
      const seen = new Set<number>();
      const kinds = new Set<string>();
      let under = 0,
        ticks = 0;
      for (let t = 0; t < 240 && !a.raid.result; t += DT) {
        a.tick(DT);
        ticks++;
        const r = a.raid;
        for (const w of r.warnings as RaidWarning[]) {
          if (seen.has(w.id)) continue;
          seen.add(w.id);
          kinds.add(w.kind);
          if (!w.followUp && a.harmful(w))
            expect(
              w.at - (w.startedAt ?? w.at) + 1e-6,
              w.kind,
            ).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
        }
        const short = r.warnings.some(
          (w: RaidWarning) => w.kind === "short-circuit",
        );
        if (short) {
          expect(r.stormMirror).toBeUndefined();
          expect((r.polarities ?? []).some((m: any) => m.until > a.time)).toBe(
            false,
          );
          expect(
            r.warnings.some((w: RaidWarning) => w.kind === "chain-lightning"),
          ).toBe(false);
        }
        if (r.stormMirror)
          expect((r.polarities ?? []).some((m: any) => m.until > a.time)).toBe(
            false,
          );
        for (const p of a.twins())
          if (p.hp > 0) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
            if (!twinClear(p)) under++;
          }
        for (const p of a.heroes()) if (p.hp > 0) p.hp = Math.max(p.hp, 60);
      }
      expect(kinds.has("mirror-charge")).toBe(true);
      // knocked or pulled under the controls, a twin is back out at once
      expect(under / ticks).toBeLessThan(0.01);
    });
});
