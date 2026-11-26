/**
 * Ascendant Snoozaku (the Spire's fortieth floor, Somnara's id): harder and
 * smarter than the raid's Snoozaku, but fair. Its tier, pattern, pads, new
 * moves (Twin Dream, Dream Tide), feints, combos, overlap rule, shorter
 * openings and reads; its rules layer off for the ordinary raid and for
 * other bosses. Each move's fairness is checked here: a safe spot always
 * exists (never under a phone's touch controls, never on a wrong pad
 * mid-dream), every warning is on screen at least the raid's floor, and a
 * dodger who reacts in 0.45 s at the slowest speed is never hit (for the
 * Dream Tide: a Seer who reads the vision in 0.45 s and a team that hears
 * the call 0.45 s later). The whole raid also keeps the honesty rules
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
import { SomnaraArena } from "../../apps/server/src/raid-somnara";
import {
  AscendantSnoozakuArena,
  AscendantSnoozakuRules,
  TIDE_AWAKE,
  tideDelay,
  underControls,
} from "../../apps/server/src/raid-ascendant-snoozaku";
import {
  RAID_EXCLUSIVE_ATTACKS,
  RAID_FREEZE,
  RAID_HARMLESS_ATTACKS,
  RAID_JUMP_ATTACKS,
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  raidShapeHits,
  raidShapeOf,
  type RaidSituation,
} from "../../apps/server/src/raid-ai";
import {
  ASCENDANT_SNOOZAKU as A,
  RAID,
  RAID_ASCENDANT_TIER,
  RAID_ATTACKS,
  RAID_TELEGRAPH_FLOOR,
  RAID_TIERS,
  SOMNARA as S,
  isAscendant,
  raidAttacksOf,
  raidBossName,
  raidChapters,
  raidPattern,
  raidSoloRevive,
  raidTierOf,
  somnaraPads,
  somnaraPattern,
  type DreamRune,
  type RaidAttack,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import { BOSS_ATTACK_ART } from "../../apps/client/src/boss-attack-art";
import { TIDE_AWAKE_COLOR } from "../../apps/client/src/ascendant-snoozaku-art";
import { padAtPoint } from "../../apps/client/src/raid-somnara-art";

const DT = 1 / 30;
const EPS = 1e-6;
type Inner = AscendantSnoozakuArena & { [key: string]: any };
const TEAM: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
const arena = (
  size = 1,
  phase = 1,
  form: "ascendant" | "raid" = "ascendant",
) => {
  const variant = form === "raid" ? undefined : form;
  const a = createRaidArena("ASC", "somnara", { variant }) as Inner;
  TEAM.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configure(3);
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 600;
  a.raid.phase = phase;
  a.raid.trait = "restless-dream";
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
/**
 * A scripted dodger: every raider sees each warning as it was 0.45 s ago and
 * walks at the slowest champion's speed to the nearest spot the arena's own
 * safe-spot rule calls clear (outside circles and lanes, off wrong pads, clear
 * of the phone's controls). Returns the ids hurt by the tracked moves.
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
      .filter(Boolean)
      .map((w) => ({ ...w!, radius: w!.radius + 6 })) as RaidWarning[];
    for (const p of a.heroes()) {
      if (p.hp <= 0) continue;
      let vx = 0,
        vy = 0;
      if (!a.snoozeClear(seen, p.x, p.y)) {
        let spot = goals.get(p.id);
        if (!spot || !a.snoozeClear(seen, spot.x, spot.y)) {
          spot = undefined;
          for (let r = 15; r <= 600 && !spot; r += 15)
            for (let i = 0; i < 32; i++) {
              const ang = (i / 32) * Math.PI * 2;
              const x = p.x + Math.cos(ang) * r,
                y = p.y + Math.sin(ang) * r;
              if (a.snoozeClear(seen, x, y)) {
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
    if (!a.raid.warnings.length && t > 0.5) break;
  }
  return [...hits];
}
/**
 * A Dream Tide played by the slowest team: the Seer reads its vision in
 * 0.45 s and calls it (taking `call` s), the others hear the call 0.45 s
 * later, and everyone walks at the slowest speed to the called pad's
 * middle. Returns who the tide hurt.
 */
function playTide(a: Inner, tide: RaidWarning) {
  const hits = new Set<string>();
  const start = a.time;
  let calledAt = Infinity;
  for (let t = 0; t < 12 && a.raid.warnings.includes(tide); t += DT) {
    const seer = a.heroes().find((p: Fighter) => p.id === tide.targetId)!;
    const view = a.dreamFor(seer.id);
    if (
      calledAt === Infinity &&
      a.time >= start + RAID_REACTION + A.tide.call - EPS &&
      view?.tide
    ) {
      expect(a.callRune(seer.id, view.runes[0])).toBe(true);
      calledAt = a.time;
    }
    const call = (a.raid.runeCalls ?? []).find(
      (q: { step: number }) => q.step === -1,
    );
    for (const p of a.heroes() as Fighter[]) {
      if (p.hp <= 0) continue;
      const rune: DreamRune | undefined =
        p.id === seer.id && a.time >= start + RAID_REACTION - EPS
          ? view?.runes[0]
          : call && a.time >= calledAt + RAID_REACTION - EPS
            ? call.rune
            : undefined;
      const pad = A.pads.find((q) => q.rune === rune);
      let vx = 0,
        vy = 0;
      if (pad) {
        const d = Math.hypot(pad.x - p.x, pad.y - p.y);
        if (d > 4) {
          const v = Math.min(RAID_SLOWEST_SPEED, d / DT);
          vx = ((pad.x - p.x) / d) * v;
          vy = ((pad.y - p.y) / d) * v;
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
  }
  return [...hits];
}
/** The secret sequence and the awake runes never leave the server. */
const leaks = (a: Inner) => {
  const json = JSON.stringify(a.snapshot());
  return (
    json.includes('"sequence"') ||
    json.includes("tideRunes") ||
    (a.sequence.length > 2 && json.includes(JSON.stringify(a.sequence)))
  );
};

describe("the Ascendant tier", () => {
  it("is the shared Ascendant row, with no solo revive", () => {
    expect(raidTierOf("somnara", "ascendant")).toBe(RAID_ASCENDANT_TIER);
    expect(raidSoloRevive("somnara", "ascendant")).toBeUndefined();
    const a = arena(1);
    expect(a.raid.variant).toBe("ascendant");
    expect(isAscendant(a.raid, "somnara")).toBe(true);
    expect(a.tier().reviveSeconds).toBe(A.reviveSeconds);
  });
  it("never shortens a telegraph below the floor; a Dream Tide keeps its length", () => {
    const a = arena(1);
    for (const s of [0.9, 1.1, 1.25, 1.5, 2.5])
      expect(a.telegraph("falling-stars", s)).toBeGreaterThanOrEqual(
        Math.min(s, RAID_TELEGRAPH_FLOOR),
      );
    expect(a.telegraph("dream-tide", 3.7)).toBe(3.7);
    expect(a.telegraph("lullaby", S.lullaby.delay)).toBe(S.lullaby.delay);
  });
  it("health: the tier's formula alone; per extra raider, ASCENDANT_SNOOZAKU.perExtraPlayer", () => {
    const solo = arena(1).raid.maxHp,
      raidSolo = arena(1, 1, "raid");
    // Alone: the raid's formula on the Ascendant tier (never Gilded).
    expect(solo).toBeGreaterThan(
      raidSolo.raid.maxHp / (raidSolo.raid.gilded ? S.health.gilded : 1),
    );
    for (const size of [2, 3, 4]) {
      const hp = arena(size).raid.maxHp;
      const want =
        ((solo / RAID.soloHealth) *
          (S.health.base + A.perExtraPlayer * (size - 1))) /
        S.health.base;
      expect(hp / want).toBeGreaterThan(0.97);
      expect(hp / want).toBeLessThan(1.03);
    }
  });
  it("hits by party size as ASCENDANT_SNOOZAKU.damage sets; a party gets longer windows", () => {
    const base = arena(1, 1, "raid");
    const raidTier = base.bossDamage();
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
    }
    expect(raidTier).toBeCloseTo(RAID_TIERS[2].damage);
  });
  it("its rhythm tightens by chapter (the ordinary raid's does not)", () => {
    const gaps = [1, 2, 3].map((phase) => {
      const a = arena(4, phase);
      return a.cadence();
    });
    expect(gaps[1]).toBeLessThan(gaps[0]);
    expect(gaps[2]).toBeLessThan(gaps[1]);
    const solo = arena(1, 1).cadence(),
      pair = arena(2, 1).cadence();
    expect(solo).toBeLessThan(pair);
  });
});

describe("the layer acts only for Snoozaku's Ascendant form", () => {
  it("the ordinary raid keeps its class, pattern, pads, health and name", () => {
    const a = arena(2, 1, "raid");
    expect(a).toBeInstanceOf(SomnaraArena);
    expect(a).not.toBeInstanceOf(AscendantSnoozakuArena);
    expect(a.raid.variant).toBeUndefined();
    expect(a.pattern()).toEqual(somnaraPattern(1));
    expect(a.pads()).toBe(S.pads);
    expect(raidBossName(a.raid)).toBe("Snoozaku");
    expect(somnaraPads()).toBe(S.pads);
    expect(somnaraPads("ascendant")).toBe(A.pads);
  });
  it("is off on a Somnara arena that isn't Ascendant", () => {
    const Layered = AscendantSnoozakuRules(SomnaraArena);
    const a = new Layered("L", "somnara") as unknown as Inner;
    a.add("p0", "P0", "voltkit");
    a.configure(3);
    a.start();
    expect(a.raid.variant).toBeUndefined();
    expect(a.snoozeAscendant()).toBe(false);
    expect(a.pattern()).toEqual(somnaraPattern(a.raid.phase));
    expect(a.pads()).toBe(S.pads);
    expect(a.telegraph("dream-tide", 3)).not.toBe(Infinity);
  });
  it("is off for another boss's Ascendant form", () => {
    const Layered = AscendantSnoozakuRules(SomnaraArena);
    const a = new Layered("L", "grumblecrag") as unknown as Inner;
    a.add("p0", "P0", "voltkit");
    a.configure(3);
    a.start();
    a.raid.variant = "ascendant";
    expect(isAscendant(a.raid, "somnara")).toBe(false);
    expect(a.snoozeAscendant()).toBe(false);
    expect(a.pads()).toBe(S.pads);
  });
});

describe("Ascendant Snoozaku's kit", () => {
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
  it("plays both new moves every chapter, and keeps the raid's dream", () => {
    for (const phase of [1, 2, 3]) {
      const p = raidPattern(phase, 3, 4, "somnara", "ascendant");
      expect(p).toContain("twin-dream");
      expect(p).toContain("dream-tide");
      expect(p).toContain("dream-sequence");
      expect(arena(4, phase).pattern()).toEqual(p);
    }
    expect(raidChapters("somnara", "ascendant").map((c) => c.name)).toEqual([
      "Restless Slumber",
      "Lucid Depths",
      "Ascendant Dream",
    ]);
  });
  it("its new attacks have guide text, a glyph, a shape and a place in the guide", () => {
    for (const kind of ["twin-dream", "dream-tide"] as RaidAttack[]) {
      expect(RAID_ATTACKS[kind].name.length).toBeGreaterThan(3);
      expect(RAID_ATTACKS[kind].tip.length).toBeGreaterThan(20);
      expect(RAID_ATTACKS[kind].summary.length).toBeGreaterThan(10);
      expect(RAID_EXCLUSIVE_ATTACKS.has(kind)).toBe(true);
    }
    expect(raidShapeOf("dream-tide")).toBe("field");
    expect(RAID_HARMLESS_ATTACKS.has("twin-dream")).toBe(true);
    const guide = raidAttacksOf("somnara", "ascendant");
    expect(guide).toEqual(expect.arrayContaining(["twin-dream", "dream-tide"]));
    expect(guide).toHaveLength(8);
    for (const kind of guide) expect(BOSS_ATTACK_ART, kind).toContain(kind);
  });
});

describe("the client knows the Ascendant's deck", () => {
  it("its pads, and the awake pad's event colour", () => {
    expect(TIDE_AWAKE_COLOR).toBe(TIDE_AWAKE);
    for (const pad of A.pads) {
      expect(padAtPoint(pad.x, pad.y, "ascendant")).toBe(pad.rune);
      const raid = S.pads.find((q) => q.rune === pad.rune)!;
      expect(padAtPoint(raid.x, raid.y)).toBe(pad.rune);
    }
    const moon = S.pads.find((q) => q.rune === "moon")!;
    expect(padAtPoint(moon.x, moon.y, "ascendant")).toBeUndefined();
  });
});

describe("the phone's touch controls", () => {
  it("no pad, nor a Dream Tide's awake ring round it, sits under or near one", () => {
    expect(A.pads.map((p) => p.rune).sort()).toEqual(
      ["circle", "moon", "star", "wave"].sort(),
    );
    for (const pad of A.pads) {
      expect(underControls(pad.x, pad.y, S.padRadius), pad.rune).toBe(false);
      expect(underControls(pad.x, pad.y, A.tide.radius), pad.rune).toBe(false);
      // inside the court with the whole ring
      expect(pad.x - A.tide.radius).toBeGreaterThan(0);
      expect(pad.x + A.tide.radius).toBeLessThan(RULES.width);
      expect(pad.y - A.tide.radius).toBeGreaterThan(0);
      expect(pad.y + A.tide.radius).toBeLessThan(RULES.height);
      // two awake rings never overlap
      for (const q of A.pads)
        if (q !== pad)
          expect(Math.hypot(q.x - pad.x, q.y - pad.y)).toBeGreaterThan(
            2 * A.tide.radius,
          );
    }
    // The raid's square puts its Moon pad under the smallest phone's skills.
    const moon = S.pads.find((p) => p.rune === "moon")!;
    expect(underControls(moon.x, moon.y, S.padRadius)).toBe(true);
  });
  it("knows the controls: each box's middle is under, the court's middle is not", () => {
    for (const [x0, y0, x1, y1] of A.phoneControls)
      expect(underControls((x0 + x1) / 2, (y0 + y1) / 2)).toBe(true);
    expect(underControls(800, 450, 100)).toBe(false);
    // phones have no target row any more: nothing at the top right
    expect(underControls(1400, 230)).toBe(false);
  });
  it("the safe-spot rule never counts a spot under the controls", () => {
    const a = arena(1);
    expect(a.snoozeClear([], 1500, 700)).toBe(false);
    expect(a.snoozeClear([], 60, 760)).toBe(false);
    expect(a.snoozeClear([], 800, 450)).toBe(true);
    // A raider deep under the buttons with a circle landing soon far away:
    // the only ground in reach is under the controls, so no spot counts.
    const p = a.heroes()[0];
    place(p, 1500, 700);
    const w = {
      id: 1,
      kind: "falling-stars",
      x: 400,
      y: 400,
      tx: 400,
      ty: 400,
      radius: 64,
      at: a.time + RAID_REACTION + 0.1,
      startedAt: a.time,
    } as RaidWarning;
    expect(a.safeSpotExists([w])).toBe(false);
    place(p, 800, 700);
    expect(a.safeSpotExists([w])).toBe(true);
    // And whatever spot it finds is never under them.
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
      const spot = a.snoozeSpotNear([c], p, 300);
      if (spot) expect(underControls(spot.x, spot.y, 0, 0)).toBe(false);
    }
  });
});

describe("the Twin Dream", () => {
  it("two Dreamers each see only their own runes; both may call; nobody else", () => {
    seeded(11);
    const a = arena(3, 2);
    const [p0] = a.heroes();
    cast(a, "twin-dream", p0);
    const d = a.raid.dream!;
    expect(d).toBeDefined();
    expect(d.partnerId).toBeDefined();
    expect(d.partnerId).not.toBe(d.dreamerId);
    expect(d.backwards).toBe(false);
    expect(d.length).toBe(
      Math.max(2, 2 + 3 - 1) + A.twin.extra + A.longerDreams[1],
    );
    expect(d.until - a.time).toBeCloseTo(A.twin.seconds);
    const first = a.dreamFor(d.dreamerId)!,
      second = a.dreamFor(d.partnerId!)!;
    expect(first.full && second.full).toBe(true);
    for (let i = 0; i < d.length; i++) {
      expect(first.hidden!.includes(i)).toBe(i % 2 === 1);
      expect(second.hidden!.includes(i)).toBe(i % 2 === 0);
      // each sees the true rune of its own steps
      const own = i % 2 === 0 ? first : second;
      expect(own.runes[i]).toBe(a.sequence[i]);
    }
    const third = a
      .heroes()
      .find((p: Fighter) => p.id !== d.dreamerId && p.id !== d.partnerId)!;
    expect(a.dreamFor(third.id)).toBeUndefined();
    expect(a.callRune(third.id, "star")).toBe(false);
    expect(a.callRune(d.partnerId!, "star")).toBe(true);
    run(a, 0.35);
    expect(a.callRune(d.dreamerId, "moon")).toBe(true);
    expect(leaks(a)).toBe(false);
  });
  it("alone, the dream shows for a glimpse, then fades but for what is done", () => {
    seeded(12);
    const a = arena(1, 1);
    const p = a.heroes()[0];
    place(p, 800, 820);
    cast(a, "twin-dream", p);
    const d = a.raid.dream!;
    expect(d.partnerId).toBeUndefined();
    expect(d.fadeAt! - a.time).toBeCloseTo(A.twin.glimpse);
    expect(d.until - a.time).toBeCloseTo(A.twin.soloSeconds);
    expect(a.dreamFor(p.id)!.hidden).toBeUndefined();
    run(a, A.twin.glimpse + 0.1);
    const view = a.dreamFor(p.id)!;
    expect(view.hidden).toEqual(a.sequence.map((_: unknown, i: number) => i));
    expect(leaks(a)).toBe(false);
  });
  it("stand-ins solve it from their own runes and each other's calls alone", () => {
    for (const seed of [1, 2, 3, 4]) {
      seeded(100 + seed);
      const a = arena(2, 2);
      for (const p of a.heroes()) a.standIn(p.id);
      // Stand-ins may never read the secret: the sequence is hidden from them.
      cast(a, "twin-dream", a.heroes()[0]);
      const solved = a.raid.dreamsSolved ?? 0;
      for (let t = 0; t < A.twin.seconds + 1 && a.raid.dream; t += DT) {
        for (const p of a.heroes()) p.hp = Math.max(p.hp, 9999);
        a.tick(DT);
        a.nextAttack = Infinity;
      }
      expect(a.raid.dreamMistakes ?? 0, `seed ${seed}`).toBe(0);
      expect(a.raid.dreamsSolved, `seed ${seed}`).toBe(solved + 1);
    }
  });
  it("a second Dreamer who falls leaves the first the whole dream", () => {
    seeded(13);
    const a = arena(2, 1);
    cast(a, "twin-dream", a.heroes()[0]);
    const d = a.raid.dream!;
    const partner = a.heroes().find((p: Fighter) => p.id === d.partnerId)!;
    partner.hp = 0;
    run(a, DT * 2);
    expect(a.raid.dream?.partnerId).toBeUndefined();
    expect(a.dreamFor(d.dreamerId)!.hidden).toBeUndefined();
  });
  it("a Nightmare during a Twin Dream begins another Twin Dream; solving it ends the run", () => {
    seeded(14);
    const a = arena(2, 1);
    const [p0] = a.heroes();
    cast(a, "twin-dream", p0);
    const d = a.raid.dream!;
    // a wrong step
    const wrong = A.pads.find((q) => q.rune !== a.sequence[0])!;
    const stepper = a.heroes()[0];
    run(a, S.sequence.stepGap + 0.05);
    place(stepper, wrong.x, wrong.y);
    run(a, DT * 2);
    expect(a.raid.dreamMistakes).toBe(1);
    expect(a.raid.dream!.id).not.toBe(d.id);
    expect(a.raid.dream!.partnerId).toBeDefined();
  });
});

describe("the Dream Tide", () => {
  it("only the Seer sees the awake pad; the warning itself never tells", () => {
    seeded(21);
    const a = arena(3, 1);
    const [w] = cast(a, "dream-tide", a.heroes()[0]);
    expect(w.kind).toBe("dream-tide");
    expect([w.x, w.y]).toEqual([RULES.width / 2, RULES.height / 2]);
    const seer = w.targetId!;
    const view = a.dreamFor(seer)!;
    expect(view.tide).toBe(true);
    expect(view.runes).toHaveLength(1);
    for (const p of a.heroes())
      if (p.id !== seer) expect(a.dreamFor(p.id)).toBeUndefined();
    expect(leaks(a)).toBe(false);
    expect(JSON.stringify(a.raid.warnings)).not.toContain(view.runes[0]);
    // others can't call it
    const other = a.heroes().find((p: Fighter) => p.id !== seer)!;
    expect(a.callRune(other.id, view.runes[0])).toBe(false);
    expect(a.callRune(seer, view.runes[0])).toBe(true);
    const call = a.raid.runeCalls!.at(-1)!;
    expect(call.step).toBe(-1);
    expect(call.until).toBeGreaterThanOrEqual(w.at);
  });
  it("lands when the farthest raider can walk in after the vision and the call; never under the floor", () => {
    const random = prng(5);
    let checked = 0;
    for (let i = 0; i < 60; i++) {
      seeded(300 + i);
      const size = 1 + (i % 4);
      const a = arena(size, 1 + (i % 3));
      for (const p of a.heroes())
        place(p, 80 + random() * 1440, 80 + random() * 740);
      const [w] = cast(a, "dream-tide", a.heroes()[0]);
      const rune = a.dreamFor(w.targetId!)!.runes[0];
      const pad = A.pads.find((q) => q.rune === rune)!;
      const inside = A.tide.radius - RULES.radius - 14;
      const walk = Math.max(
        0,
        ...a
          .heroes()
          .map((p: Fighter) => Math.hypot(p.x - pad.x, p.y - pad.y) - inside),
      );
      expect(w.at - a.time).toBeCloseTo(tideDelay(walk));
      expect(w.at - a.time).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
      expect(walk + inside).toBeLessThanOrEqual(
        Math.max(
          A.tide.maxWalk,
          Math.min(
            ...A.pads.map((q) =>
              Math.max(
                ...a
                  .heroes()
                  .map((p: Fighter) => Math.hypot(p.x - q.x, p.y - q.y)),
              ),
            ),
          ),
        ) + EPS,
      );
      checked++;
    }
    expect(checked).toBe(60);
  });
  it("the deck hurts and makes drowsy; the awake ring spares you; everyone sees which pad it was", () => {
    seeded(22);
    const a = arena(2, 1);
    const [p0, p1] = a.heroes();
    place(p0, 800, 450);
    place(p1, 820, 470);
    const [w] = cast(a, "dream-tide", p0);
    const rune = a.dreamFor(w.targetId!)!.runes[0];
    const pad = A.pads.find((q) => q.rune === rune)!;
    place(p0, pad.x + 40, pad.y);
    a.events = [];
    run(a, w.at - a.time + DT);
    expect(hurt(p0)).toBe(0);
    expect(hurt(p1)).toBeGreaterThan(0);
    expect(a.raid.drowsy?.[p1.id]?.stacks).toBe(1);
    expect(
      a.events.some(
        (e: any) =>
          e.kind === "heal" &&
          e.color === TIDE_AWAKE &&
          e.x === pad.x &&
          e.y === pad.y,
      ),
    ).toBe(true);
  });
  it("a slow team that reacts in 0.45 s to the vision and again to the call always makes it", () => {
    const random = prng(9);
    let tides = 0;
    for (let i = 0; i < 48; i++) {
      seeded(500 + i);
      const size = 1 + (i % 4);
      const a = arena(size, 1);
      track(a, ["dream-tide"]);
      // spread out, corners included
      const corners = [
        [70, 70],
        [1530, 70],
        [70, 830],
        [1530, 830],
      ];
      a.heroes().forEach((p: Fighter, k: number) =>
        i % 3 === 0
          ? place(p, corners[(k + i) % 4][0], corners[(k + i) % 4][1])
          : place(p, 70 + random() * 1460, 70 + random() * 760),
      );
      const [w] = cast(a, "dream-tide", a.heroes()[0]);
      expect(playTide(a, w), `run ${i}`).toEqual([]);
      tides++;
    }
    expect(tides).toBe(48);
  });
  it("a Seer who falls asleep before calling passes the vision on, and the tide waits", () => {
    seeded(23);
    const a = arena(3, 1);
    const [w] = cast(a, "dream-tide", a.heroes()[0]);
    const seer = a.heroes().find((p: Fighter) => p.id === w.targetId)!;
    const rune = a.dreamFor(seer.id)!.runes[0];
    run(a, 0.5);
    seer.statuses.push({
      kind: "sleep",
      until: a.time + 3,
      nextTick: a.time + 3,
      by: a.raid.bossId,
    });
    const at = w.at;
    run(a, DT * 2);
    expect(w.targetId).not.toBe(seer.id);
    expect(a.dreamFor(w.targetId!)!.runes[0]).toBe(rune);
    expect(w.at).toBeGreaterThanOrEqual(at);
  });
  it("stand-ins: the Seer calls once it has read the vision; the team runs to the call", () => {
    for (const seed of [1, 2, 3]) {
      seeded(600 + seed);
      const a = arena(4, 1);
      for (const p of a.heroes()) a.standIn(p.id);
      track(a, ["dream-tide"]);
      const [w] = cast(a, "dream-tide", a.heroes()[0]);
      let calledAt = Infinity;
      const hits = new Set<string>();
      for (let t = 0; t < 10 && a.raid.warnings.includes(w); t += DT) {
        lastHits.clear();
        a.tick(DT);
        a.nextAttack = Infinity;
        for (const id of lastHits) hits.add(id);
        if (
          calledAt === Infinity &&
          a.raid.runeCalls?.some((q: any) => q.step === -1)
        )
          calledAt = a.time;
      }
      expect(calledAt - w.startedAt!).toBeGreaterThanOrEqual(
        RAID_REACTION - EPS,
      );
      expect([...hits], `seed ${seed}`).toEqual([]);
    }
  });
  it("never starts during a dream, and no dream starts during it", () => {
    seeded(24);
    const a = arena(2, 2);
    cast(a, "dream-sequence", a.heroes()[0]);
    expect(a.raid.dream).toBeDefined();
    expect(a.allows("dream-tide")).toBe(false);
    expect(a.allows("twin-dream")).toBe(false);
    const fresh = cast(a, "dream-tide", a.heroes()[0]);
    expect(fresh.every((w) => w.kind === "lullaby")).toBe(true);
    const b = arena(2, 2);
    cast(b, "dream-tide", b.heroes()[0]);
    expect(b.exclusive("dream-tide")).toBe(true);
    expect(b.canOverlap("dream-sequence")).toBe(false);
    // the whole floor is the tide's: nothing new starts while it rises
    expect(b.busy()).toBe(true);
  });
});

describe("Falling Stars", () => {
  it("mid-dream no star touches a pad", () => {
    for (let i = 0; i < 20; i++) {
      seeded(700 + i);
      const a = arena(2, 1 + (i % 3));
      cast(a, "dream-sequence", a.heroes()[0]);
      const p = a.heroes()[1];
      const pad = A.pads[i % 4];
      place(p, pad.x + 130, pad.y);
      for (const w of cast(a, "falling-stars", p))
        for (const q of A.pads)
          expect(Math.hypot(w.x - q.x, w.y - q.y)).toBeGreaterThanOrEqual(
            S.padRadius + S.stars.radius,
          );
    }
  });
  it("lands where a raider usually dodges", () => {
    const a = arena(2, 2);
    const p = a.heroes()[0];
    place(p, 700, 450);
    for (let i = 0; i < 4; i++) a.noteSnoozeDodge(p.id, 0, 1);
    expect(a.snoozeHabitOf(p.id)).toEqual({ x: 0, y: 1 });
    const stars = cast(a, "falling-stars", p);
    const spot = { x: 700, y: 450 + S.stars.radius * (1 + A.habit.offset) };
    expect(
      Math.min(...stars.map((w) => Math.hypot(w.x - spot.x, w.y - spot.y))),
    ).toBeLessThan(2);
    expect(a.snoozeReads.habits).toBe(1);
  });
  it("a safe spot always exists, and a 0.45 s dodger at the slowest speed is never hit", () => {
    const random = prng(17);
    for (let i = 0; i < 40; i++) {
      seeded(800 + i);
      const size = 1 + (i % 4);
      const a = arena(size, 1 + (i % 3));
      track(a, ["falling-stars"]);
      for (const p of a.heroes())
        place(p, 120 + random() * 1360, 120 + random() * 660);
      const target = a.heroes()[0];
      if (i % 2) for (let k = 0; k < 4; k++) a.noteSnoozeDodge(target.id, 1, 0);
      if (i % 5 === 0) cast(a, "dream-sequence", target);
      const stars = cast(a, "falling-stars", target);
      expect(stars.length).toBeGreaterThan(0);
      expect(a.safeSpotExists(stars), `run ${i}`).toBe(true);
      for (const w of stars)
        expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
          RAID_TELEGRAPH_FLOOR - EPS,
        );
      expect(dodge(a, 4), `run ${i}`).toEqual([]);
    }
  });
});

describe("feints: a trunk slam that turns into Falling Stars", () => {
  it("part-way through, the lane fades and stars come down round its raider, shown in full", () => {
    seeded(31);
    let turned = 0;
    for (let i = 0; i < 30 && turned < 3; i++) {
      const a = arena(2, 3);
      a.seenAttacks.set("tail-splash", 5);
      a.attacks = i;
      a.snoozeFeintRoll = () => true;
      const p = a.heroes()[0];
      place(p, a.boss()!.x - 250, a.boss()!.y);
      const [lane] = cast(a, "tail-splash", p);
      expect(lane.kind).toBe("tail-splash");
      const turnAt =
        lane.startedAt! + (lane.at - lane.startedAt!) * A.feint.turnAt;
      run(a, turnAt - a.time - DT * 2);
      expect(of(a, "tail-splash")).toHaveLength(1);
      run(a, DT * 4);
      expect(of(a, "tail-splash")).toHaveLength(0);
      const stars = of(a, "falling-stars");
      expect(stars.length).toBeGreaterThan(0);
      for (const w of stars)
        expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
          RAID_TELEGRAPH_FLOOR - EPS,
        );
      expect(a.snoozeReads.feints).toBe(1);
      turned++;
    }
    expect(turned).toBe(3);
  });
  it("never on a teaching slam, nor while another attack is live", () => {
    const a = arena(2, 3);
    a.snoozeFeintRoll = () => true;
    cast(a, "tail-splash", a.heroes()[0]);
    expect(a.snoozeFeints.size).toBe(0);
    const b = arena(2, 3);
    b.snoozeFeintRoll = () => true;
    b.seenAttacks.set("tail-splash", 5);
    cast(b, "lullaby", b.heroes()[1]);
    cast(b, "tail-splash", b.heroes()[0]);
    expect(b.snoozeFeints.size).toBe(0);
  });
});

describe("combos", () => {
  it("from chapter 1, a trunk slam that misses calls stars down along its raider's way", () => {
    seeded(41);
    const a = arena(2, 1);
    a.seenAttacks.set("tail-splash", 5);
    a.snoozeFeintRoll = () => false;
    const p = a.heroes()[0];
    place(p, a.boss()!.x - 250, a.boss()!.y);
    const [lane] = cast(a, "tail-splash", p);
    place(p, a.boss()!.x - 250, a.boss()!.y + 260);
    run(a, lane.at - a.time + DT);
    const stars = of(a, "falling-stars");
    expect(stars).toHaveLength(A.comboStars);
    expect(stars.every((w) => w.followUp)).toBe(true);
    expect(Math.hypot(stars[0].x - p.x, stars[0].y - p.y)).toBeLessThan(2);
    // one combo per slam
    expect(a.snoozeReads.combos).toBe(1);
  });
  it("a slam that hits calls nothing down", () => {
    const a = arena(2, 1);
    a.seenAttacks.set("tail-splash", 5);
    a.snoozeFeintRoll = () => false;
    const p = a.heroes()[0];
    place(p, a.boss()!.x - 250, a.boss()!.y);
    const [lane] = cast(a, "tail-splash", p);
    place(p, lane.tx, lane.ty);
    run(a, lane.at - a.time + DT);
    expect(of(a, "falling-stars")).toHaveLength(0);
  });
  it("from chapter 2, a Nightmare drops stars on whoever stepped wrong", () => {
    for (const phase of [1, 2]) {
      seeded(42);
      const a = arena(2, phase);
      cast(a, "dream-sequence", a.heroes()[0]);
      run(a, S.sequence.stepGap + 0.05);
      const stepper = a.heroes()[1];
      const wrong = A.pads.find((q) => q.rune !== a.sequence[0])!;
      place(stepper, wrong.x, wrong.y);
      run(a, DT * 2);
      expect(a.raid.dreamMistakes).toBe(1);
      const stars = of(a, "falling-stars");
      if (phase < A.combosFrom.nightmare) expect(stars).toHaveLength(0);
      else {
        expect(stars.length).toBeGreaterThan(0);
        expect(
          Math.hypot(stars[0].x - stepper.x, stars[0].y - stepper.y),
        ).toBeLessThan(S.padRadius + S.stars.radius + 10);
      }
    }
  });
  it("from chapter 2, a Dream Tide that lands rings out lullabies from the awake pad", () => {
    for (const phase of [1, 2, 3]) {
      seeded(43);
      const a = arena(2, phase);
      const [w] = cast(a, "dream-tide", a.heroes()[0]);
      const pad = A.pads.find(
        (q) => q.rune === a.dreamFor(w.targetId!)!.runes[0],
      )!;
      run(a, w.at - a.time + DT);
      const rings = of(a, "lullaby");
      if (phase < A.combosFrom.tide) expect(rings).toHaveLength(0);
      else {
        expect(rings).toHaveLength(1);
        expect([rings[0].x, rings[0].y]).toEqual([pad.x, pad.y]);
        expect(rings[0].followUp).toBe(true);
        expect(rings[0].at - a.time).toBeGreaterThanOrEqual(
          S.lullaby.delay - DT - EPS,
        );
      }
    }
  });
});

describe("overlap keeps a way out", () => {
  it("stars that would leave no spot clear of a live lane wait until it has landed", () => {
    const a = arena(2, 2);
    const [p0, p1] = a.heroes();
    place(p0, 1000, 400);
    place(p1, 400, 700);
    a.seenAttacks.set("tail-splash", 5);
    a.snoozeFeintRoll = () => false;
    const [lane] = cast(a, "tail-splash", p0);
    // a ring of stars right round p0 (between the lane and the controls)
    const stars = [0, 1, 2, 3, 4, 5].map((k) =>
      a.warn(
        "falling-stars",
        p0.x + Math.cos(k) * 120,
        p0.y + Math.sin(k) * 120,
        p0.x + Math.cos(k) * 120,
        p0.y + Math.sin(k) * 120,
        S.stars.radius,
        S.stars.delay,
      ),
    );
    const blocked = !a.safeSpotExists([lane, ...stars]);
    a.spaceOverlap(stars);
    for (const s of stars)
      if (blocked) expect(s.at).toBeGreaterThanOrEqual(lane.at + 1 - EPS);
      else expect(Math.abs(s.at - lane.at)).toBeGreaterThanOrEqual(0.5 - EPS);
  });
  it("mid-dream the wrong pads are not a way out; the next right pad is", () => {
    seeded(51);
    const a = arena(2, 2);
    cast(a, "dream-sequence", a.heroes()[0]);
    const right = A.pads.find((q) => q.rune === a.sequence[0])!;
    const wrong = A.pads.find((q) => q.rune !== a.sequence[0])!;
    expect(a.snoozeClear([], wrong.x, wrong.y)).toBe(false);
    expect(a.snoozeClear([], right.x, right.y)).toBe(true);
  });
});

describe("fewer, shorter openings", () => {
  it("a stagger and a woken heart last less than in the raid", () => {
    const asc = arena(1, 1),
      raid = arena(1, 1, "raid");
    expect(asc.window(S.sequence.expose)).toBeLessThan(
      raid.window(S.sequence.expose),
    );
    asc.raid.stagger = 100;
    run(asc, DT);
    expect(asc.raid.staggerUntil - asc.time).toBeCloseTo(
      RAID.staggerSeconds * RAID_ASCENDANT_TIER.windows,
      1,
    );
  });
});

describe("it reads the fight", () => {
  it("needs a consistent habit, and learns it from real dodges", () => {
    const a = arena(1, 2);
    const p = a.heroes()[0];
    a.noteSnoozeDodge(p.id, 1, 0);
    a.noteSnoozeDodge(p.id, -1, 0);
    a.noteSnoozeDodge(p.id, 0, 1);
    expect(a.snoozeHabitOf(p.id)).toBeUndefined();
    const b = arena(1, 2);
    const q = b.heroes()[0];
    for (let i = 0; i < 3; i++) {
      place(q, 800, 450);
      b.warn("falling-stars", 800, 450, 800, 450, S.stars.radius, 1.2);
      b.learnSnoozeDodges();
      place(q, 800, 600);
      b.raid.warnings = [];
      b.learnSnoozeDodges();
    }
    expect(b.snoozeHabitOf(q.id)?.y).toBeGreaterThan(0.9);
  });
  it("answers a raider standing still to attack with stars", () => {
    const a = arena(2, 1);
    const p = a.heroes()[0];
    place(p, 700, 450);
    a.snoozeStill.set(p.id, a.time - 2);
    a.snoozeHitAt.set(p.id, a.time - 0.2);
    expect(a.snoozeAnchored(p)).toBe(true);
    const s = a.situation(a.heroes()) as RaidSituation;
    const r = a.reactions(s);
    expect(r).toContainEqual({ kind: "falling-stars", score: 1.5, target: p });
    cast(a, "falling-stars", p);
    expect(a.snoozeReads.anchors).toBe(1);
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
    expect(a.chooseTarget("falling-stars", [p1, p2])).toBe(p1);
    expect(a.chooseTarget("tail-splash", [p1, p2])).toBe(p1);
    const s = a.situation([p1, p2]) as RaidSituation;
    expect(s.reviving).toContain(p1);
    expect(a.reactions(s)).toContainEqual({
      kind: "falling-stars",
      score: 1.6,
      target: p1,
    });
  });
  it("plays its new moves and reads in a real fight", () => {
    seeded(77);
    const a = createRaidArena("REAL", "somnara", {
      variant: "ascendant",
    }) as Inner;
    TEAM.forEach((c, i) => a.add("p" + i, "P" + i, c));
    a.configure(3);
    a.start();
    a.phase = "playing";
    a.deadline = a.time + 600;
    for (const p of a.heroes()) a.standIn(p.id);
    for (let t = 0; t < 240 && !a.raid.result; t += DT) {
      for (const p of a.heroes()) if (p.hp > 0) p.hp = Math.max(p.hp, 400);
      a.tick(DT);
      if ((a.phase as string) === "intermission") a.phase = "playing";
    }
    expect(a.snoozeReads.tides).toBeGreaterThan(0);
    expect(a.snoozeReads.twins).toBeGreaterThan(0);
    expect(a.snoozeReads.combos).toBeGreaterThan(0);
    expect(a.raid.dreamsSolved).toBeGreaterThan(0);
  });
});

describe("Ascendant Snoozaku keeps the honesty rules through a raid", () => {
  it.each([1, 2, 4])(
    "with %i raider(s)",
    (size) => {
      seeded(4242 + size);
      const a = createRaidArena("FAIR", "somnara", {
        variant: "ascendant",
      }) as Inner;
      TEAM.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
      a.configure(3);
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
        twins = 0;
      const chip = a.raid.maxHp / 3 / 50 / 30;
      for (let t = 0; t < 160 && !a.raid.result; t += DT) {
        const b = a.boss()!,
          before = b.hp;
        const was = new Map(a.raid.warnings.map((w: RaidWarning) => [w.id, w]));
        for (const p of a.heroes()) if (p.hp > 0) p.hp = 99999;
        a.tick(DT);
        if (a.raid.dream?.partnerId || a.raid.dream?.fadeAt) twins++;
        if (leaks(a)) note("the dream leaked into the snapshot");
        if (a.boss()) a.boss()!.hp = before - chip;
        if ((a.phase as string) === "intermission") a.phase = "playing";
        const now = new Set(a.raid.warnings.map((w: RaidWarning) => w.id));
        const landed = [...was.values()].filter(
          (w) => !now.has(w.id) && w.at <= a.time + EPS,
        );
        for (const w of landed) {
          if (RAID_JUMP_ATTACKS.has(w.kind) && w.kind !== "lullaby")
            jumps.push(w);
          const s = seen.get(w.id);
          if (
            s &&
            !s.followUp &&
            a.harmful(w) &&
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
            .filter((s) => s.cast === c && a.harmful(s.w))
            .map((s) => s.w);
          const old = (a.raid.warnings as RaidWarning[]).filter(
            (w) => !mine.includes(w) && a.harmful(w),
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
      for (const [i, m] of jumps.entries())
        for (const n of jumps.slice(i + 1))
          if (
            Math.abs(n.at - m.at) < RULES.jumpCooldown - EPS &&
            Math.hypot(n.x - m.x, n.y - m.y) < n.radius + m.radius
          )
            note(`${m.kind} and ${n.kind} too close on the same ground`);
      expect(problems).toEqual([]);
      expect(seen.size).toBeGreaterThan(10);
      expect(kindsSeen).toContain("dream-tide");
      expect(twins).toBeGreaterThan(0);
      expect(a.raid.phase).toBeGreaterThanOrEqual(2);
      if (size === 4) expect(overlaps).toBeGreaterThan(0);
    },
    120_000,
  );
});
