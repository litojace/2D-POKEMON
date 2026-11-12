import { RAID } from "../../packages/shared/src/raid";
import {
  drawCollectionAura,
  playCollectionEntrance,
  drawCollectionVictory,
} from "../../apps/client/src/skins/collection-fx";
import { SKINS, tonePixels } from "../../apps/client/src/animation/cosmetics";
import { describe, it, expect, vi } from "vitest";
import {
  CHARACTERS,
  blankInput,
  packSnapshot,
  type CharacterId,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import {
  PrismatailArena,
  fanEscape,
  prismDistanceToSegment,
} from "../../apps/server/src/raid-prismatail";
import {
  PRISMATAIL as P,
  RAID_BOSSES,
  RAID_BOSS_ATTACKS,
  traceLight,
  mirrorReaches,
  ritesFor,
  type RaidAttack,
} from "../../packages/shared/src/raid";
import {
  raidCue,
  featureLabel,
  raidContributions,
} from "../../apps/client/src/raid-presentation";
import {
  drawPrismatail,
  drawPrismatailWarning,
  drawSunAtrium,
} from "../../apps/client/src/raid-prismatail-art";
const setup = (
  size = 1,
  phase = 1,
  peril = 1,
  chars: CharacterId[] = ["voltkit"],
) => {
  const a = createRaidArena("PRISMS", "prismatail") as PrismatailArena;
  for (let i = 0; i < size; i++)
    a.add(`p${i}`, `Raider ${i}`, chars[i % chars.length]);
  a.configure(peril, false);
  a.start();
  a.phase = "playing";
  a.raid.phase = phase;
  a.raid.trait = "dazzling";
  a.raid.gilded = false;
  (a as any).started = true;
  (a as any).nextAttack = Infinity;
  a.heroes().forEach((p, i) =>
    Object.assign(p, {
      x: 470,
      y: phase === 3 && size > 1 ? (i % 2 ? 600 : 300) : 450,
      lastInput: blankInput(),
    }),
  );
  return a;
};
const run = (a: PrismatailArena, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 30); i++) a.tick();
};
/** The starting mirror arrows (the solo path skylight → raider → 0 → 1 → heart). */
const align = (a: PrismatailArena) =>
  a.raid.mirrors!.forEach((m, i) => {
    m.angle = i === 1 ? Math.PI / 4 : i === 3 ? (Math.PI * 7) / 4 : 0;
    delete m.scrambleAt;
    delete m.scrambleTurns;
  });
const prismDistance = (
  p: { x: number; y: number },
  w: { x: number; y: number; tx: number; ty: number },
) => prismDistanceToSegment(p, w, { x: w.tx, y: w.ty });
const attack = (a: PrismatailArena, kind: RaidAttack) =>
  (a as any).startAttack(kind, a.heroes()[0]);
const resolve = (a: PrismatailArena) => {
  for (const w of a.raid.warnings) {
    (a as any).struck.clear();
    (a as any).resolveWarning(w, a.boss()!);
  }
  a.raid.warnings = [];
};
describe("Prismatail light relay", () => {
  it("uses its own Sun Atrium, health scaling, chapters, drills and rite", () => {
    const a = setup(4);
    expect(a).toBeInstanceOf(PrismatailArena);
    expect(a.arenaId).toBe("sun-atrium");
    expect(a.walls()).toEqual([]);
    expect(a.raid.pillars).toEqual([]);
    expect(RAID_BOSSES.prismatail.playable).toBe(true);
    const f = RAID.healthScale * RAID.perilHealth[a.raid.peril];
    expect([Math.round(3990 * f), Math.round(3990 * f * 1.12)]).toContain(
      a.raid.maxHp,
    );
    expect(ritesFor("prismatail")).toContain("polished");
    expect(ritesFor("somnara")).not.toContain("polished");
    for (const phase of [1, 2, 3]) {
      a.raid.phase = phase;
      for (const kind of (a as any).pattern())
        expect(RAID_BOSS_ATTACKS.prismatail).toContain(kind);
    }
  });
  for (const size of [1, 2, 3, 4])
    for (const peril of [1, 2, 3])
      it(`completes final-phase light relay with ${size} raider(s), Peril ${peril}`, () => {
        const a = setup(size, 3, peril);
        run(a, 4.4);
        expect(a.raid.shieldBreaks).toBe(1);
        expect(a.raid.exposedUntil).toBeGreaterThan(a.time);
        expect(a.raid.contributions!.p0.pillars).toBe(1);
        expect(a.raid.quickBreaks).toBe(1);
      });
  it("requires a continuous two-second solo hold in Solar Crown", () => {
    const a = setup(1, 3);
    run(a, 3);
    expect(a.raid.shieldBreaks).toBe(0);
    expect(a.raid.lightHold).toBeGreaterThan(0.8);
    a.heroes()[0].x = 1400;
    run(a, 0.3);
    expect(a.raid.lightHold).toBe(0);
    a.heroes()[0].x = 470;
    run(a, 2.2);
    expect(a.raid.shieldBreaks).toBe(1);
  });
  it("cannot satisfy a split beam with only its second arrival or the same ordinary carrier", () => {
    const a = setup(2, 3);
    a.heroes()[0].x = 1500;
    a.heroes()[1].y = 700;
    run(a, 5);
    expect(a.raid.shieldBreaks).toBe(0);
    expect(a.raid.lightArrivals?.[1]).toBeGreaterThanOrEqual(0);
  });
  it("expires a split arrival after three seconds and lets the team retry", () => {
    const a = setup(2, 3);
    a.heroes()[1].x = 1500;
    run(a, 2.5);
    a.heroes()[0].x = 1500;
    run(a, 3.5);
    a.heroes()[1].x = 470;
    run(a, 1);
    expect(a.raid.shieldBreaks).toBe(0);
    a.heroes()[0].x = 470;
    run(a, P.hold.party + 0.2);
    expect(a.raid.shieldBreaks).toBe(1);
  });
  it("stops light at a wrongly oriented mirror, recovers when turned, excludes dead raiders", () => {
    const a = setup();
    a.raid.mirrors!.forEach((m) => (m.angle = Math.PI));
    run(a, 4);
    expect(a.raid.shieldBreaks).toBe(0);
    a.raid.mirrors![0].angle = 0;
    a.raid.mirrors![1].angle = Math.PI / 4;
    run(a, P.hold.solo + 0.3);
    expect(a.raid.shieldBreaks).toBe(1);
    const dead = setup();
    dead.heroes()[0].hp = 0;
    (dead as any).worldStep(0.1, dead.boss());
    expect(dead.raid.shieldBreaks).toBe(0);
  });
  it("burns carriers, while Polished prevents burn and is not a global immunity", () => {
    const a = setup(),
      p = a.heroes()[0],
      hp = p.hp;
    run(a, 3);
    expect(hp - p.hp).toBeGreaterThan(1);
    const b = setup(),
      q = b.heroes()[0];
    b.raid.rites[q.id] = ["polished"];
    run(b, 3);
    expect(q.hp).toBe(CHARACTERS[q.character].health);
    b.damage(q, 20, b.boss()!.id);
    expect(q.hp).toBeLessThan(CHARACTERS[q.character].health);
  });
  it("keeps Overcast solvable and extends Kaleidoscope exposure", () => {
    const until: number[] = [];
    for (const trait of ["overcast", "kaleidoscope", "dazzling"] as const) {
      const a = setup();
      a.raid.trait = trait;
      run(a, 3.5);
      expect(a.raid.shieldBreaks).toBe(1);
      until.push(a.raid.exposedUntil);
    }
    // Kaleidoscope's exposure lasts a second longer than the others'.
    expect(until[1] - until[2]).toBeCloseTo(1, 1);
  });
  it("resists chip damage, prevents stagger bypass, and accepts exposed damage without skipping chapters", () => {
    const a = setup(),
      b = a.boss()!,
      p = a.heroes()[0];
    a.damage(b, 100, p.id);
    expect(a.raid.maxHp - b.hp).toBeCloseTo(8.64);
    expect(a.raid.stagger).toBe(0);
    for (let i = 0; i < 40; i++) a.status(b, "stun", 2, p.id);
    expect(a.raid.stagger).toBe(0);
    run(a, 3.5);
    const before = b.hp;
    a.damage(b, 100, p.id);
    expect(before - b.hp).toBeCloseTo(160);
    a.damage(b, 100000, p.id);
    a.tick();
    expect(a.raid.phase).toBe(2);
    // No rite screen: the next chapter starts at once.
    expect(a.phase).toBe("playing");
    expect(a.raid.lightLinks).toEqual([]);
  });
  it("credits once per completion and unlocks the three-quick-break feat only on victory", () => {
    const a = setup();
    run(a, 3.5);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
    run(a, 4.5);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
    // After each exposure the team re-aims the scrambled mirrors.
    for (let i = 0; i < 2; i++) {
      run(a, a.raid.exposedUntil - a.time + 0.1);
      align(a);
      run(a, P.relayRestart + P.hold.solo + 0.3);
    }
    expect(a.raid.contributions!.p0.pillars).toBe(3);
    expect(a.raid.quickBreaks).toBeGreaterThanOrEqual(3);
    expect(a.feat()).toBe(false);
    a.raid.result = "victory";
    expect(a.feat()).toBe(true);
  });
  it("never credits practice, and clears mechanics for drill changes, results and retries", () => {
    const a = setup();
    a.raid.drill = "light-relay";
    run(a, 3);
    expect(a.raid.contributions!.p0.pillars).toBe(0);
    expect(a.raid.drillStats?.dodges ?? 0).toBe(0);
    a.setDrill("glare");
    expect(a.raid.lightLinks).toEqual([]);
    expect(a.raid.lightHold).toBe(0);
    a.stopDrill();
    expect(a.phase).toBe("lobby");
    const b = setup();
    run(b, 2.3);
    b.forfeit("p0");
    expect(b.raid.lightLinks).toEqual([]);
    b.retry();
    expect(b.raid.shieldBreaks).toBe(0);
    expect(b.raid.blinded).toEqual({});
  });
  it("bounds routes, rejects loops, honors range and mirror direction", () => {
    const source = { x: 0, y: 0 },
      heart = { x: 700, y: 0 },
      nodes = [
        { id: "p", x: 200, y: 0, player: true },
        { id: "m", x: 450, y: 0, angle: 0 },
      ];
    expect(traceLight(source, nodes, heart).map((n) => n.id)).toEqual([
      "p",
      "m",
    ]);
    expect(traceLight(source, nodes, heart, 150)).toEqual([]);
    expect(traceLight(source, nodes, heart, 300, 3)).toEqual([]);
    expect(traceLight(source, nodes, heart, 300, 2, new Set(["p"]))).toEqual(
      [],
    );
    expect(mirrorReaches({ ...nodes[1], angle: Math.PI }, heart)).toBe(false);
  });
});
describe("Prismatail attack fairness and champion tricks", () => {
  it("locks the lance and avoids duplicate reflected hits", () => {
    const a = setup();
    attack(a, "prism-lance");
    const w = { ...a.raid.warnings[0] };
    a.heroes()[0].y += 200;
    a.tick();
    expect(a.raid.warnings[0].ty).toBe(w.ty);
    resolve(a);
    expect(a.heroes()[0].hp).toBe(CHARACTERS.voltkit.health);
    const b = setup();
    attack(b, "refraction");
    expect(b.raid.warnings).toHaveLength(2);
    expect(b.raid.warnings[1].at - b.raid.warnings[0].at).toBeGreaterThan(0.3);
  });
  it("only fires the indicated fan cone, with eight cones for Kaleidoscope", () => {
    const a = setup(2);
    a.raid.trait = "kaleidoscope";
    attack(a, "fan-display");
    const w = a.raid.warnings[0],
      b = a.boss()!,
      angle = (w.prismIndex! * Math.PI * 2) / 8;
    Object.assign(a.heroes()[0], {
      x: b.x + Math.cos(angle) * 200,
      y: b.y + Math.sin(angle) * 200,
    });
    Object.assign(a.heroes()[1], {
      x: b.x + Math.cos(angle + Math.PI) * 200,
      y: b.y + Math.sin(angle + Math.PI) * 200,
    });
    resolve(a);
    expect(a.heroes()[0].hp).toBeLessThan(CHARACTERS.voltkit.health);
    expect(a.heroes()[1].hp).toBe(CHARACTERS.voltkit.health);
    expect(w.prismCount).toBe(8);
  });
  it("Glare blinds a facing raider but deals no damage; aiming away avoids it", () => {
    const a = setup(2);
    a.heroes()[0].angle = 0;
    a.heroes()[1].angle = Math.PI;
    attack(a, "glare");
    resolve(a);
    expect(a.raid.blinded!.p0).toBeCloseTo(a.time + 1.5);
    expect(a.raid.blinded!.p1).toBeUndefined();
    expect(a.heroes()[0].hp).toBe(CHARACTERS.voltkit.health);
  });
  it("Mystowl’s Wing Cloak shelters nearby allies from Glare until it expires", () => {
    const a = setup(2, 1, 1, ["mystowl", "voltkit"]),
      p = a.heroes()[0];
    a.cast(
      p,
      CHARACTERS.mystowl.skills.find((a) => a.id === "wing-cloak")!,
    );
    a.heroes().forEach((p) => (p.angle = 0));
    attack(a, "glare");
    resolve(a);
    expect(a.raid.blinded).toEqual({});
    a.time += 4;
    attack(a, "glare");
    resolve(a);
    expect(a.raid.blinded!.p1).toBeGreaterThan(a.time);
  });
  it("Halo Crush has a safe gap and a safe inner region", () => {
    const a = setup(3);
    attack(a, "halo-crush");
    const w = a.raid.warnings[0],
      gap = w.gapAngle!;
    Object.assign(a.heroes()[0], {
      x: w.x + Math.cos(gap) * w.radius,
      y: w.y + Math.sin(gap) * w.radius,
    });
    Object.assign(a.heroes()[1], {
      x: w.x - Math.cos(gap) * w.radius,
      y: w.y - Math.sin(gap) * w.radius,
    });
    Object.assign(a.heroes()[2], { x: w.x, y: w.y });
    resolve(a);
    expect(a.heroes()[0].hp).toBe(CHARACTERS.voltkit.health);
    expect(a.heroes()[1].hp).toBeLessThan(CHARACTERS.voltkit.health);
    expect(a.heroes()[2].hp).toBe(CHARACTERS.voltkit.health);
  });
  it("Cindrake creates a temporary relay point; Lumoth can carry both split beams", () => {
    const a = setup(1, 1, 1, ["cindrake"]),
      p = a.heroes()[0];
    p.lastInput.aimX = 700;
    p.lastInput.aimY = 450;
    a.cast(
      p,
      CHARACTERS.cindrake.skills.find((a) => a.id === "sunfire-pillar")!,
    );
    expect(a.raid.sunPillars).toHaveLength(1);
    expect(a.raid.sunPillars![0].x).toBe(700);
    run(a, 4.1);
    expect(a.raid.sunPillars).toEqual([]);
    const b = setup(2, 3, 1, ["lumoth", "voltkit"]);
    b.heroes()[0].y = 450;
    b.heroes()[1].x = 1500;
    b.cast(
      b.heroes()[0],
      CHARACTERS.lumoth.skills.find((a) => a.id === "radiant-flare")!,
    );
    run(b, 3.5);
    expect(b.raid.shieldBreaks).toBe(1);
  });
  it("Duskveil’s Void Orb swallows a lance segment", () => {
    const a = setup(1, 1, 1, ["duskveil"]),
      p = a.heroes()[0];
    p.angle = 0;
    p.lastInput.aimX = 1000;
    p.lastInput.aimY = 450;
    a.cast(
      p,
      CHARACTERS.duskveil.skills.find((a) => a.id === "void-orb")!,
    );
    expect(a.projectiles.length).toBeGreaterThan(0);
    attack(a, "prism-lance");
    resolve(a);
    expect(p.hp).toBe(CHARACTERS.duskveil.health);
    expect(a.raid.message).toContain("swallowed");
  });
  it("ordinary attacks rotate a mirror 45° with a cooldown", () => {
    const a = setup(),
      m = a.raid.mirrors![0],
      p = a.heroes()[0];
    Object.assign(p, { x: m.x - 90, y: m.y, angle: 0 });
    const before = m.angle;
    a.cast(p, { ...CHARACTERS.voltkit.basic, kind: "beam", range: 150 });
    expect(m.angle - before).toBeCloseTo(Math.PI / 4);
    a.cast(p, { ...CHARACTERS.voltkit.basic, kind: "beam", range: 150 });
    expect(m.angle - before).toBeCloseTo(Math.PI / 4);
  });
  it("bots turn away from Glare and aim for separate relay spots", () => {
    const a = setup(2, 3),
      p = a.heroes()[1];
    p.x = 800;
    attack(a, "glare");
    const input = a.botInput(p, blankInput());
    expect(input.aimX).toBeLessThan(p.x);
    a.raid.warnings = [];
    const relay = a.botInput(p, blankInput());
    expect(relay.dx).toBeLessThan(0);
    expect(relay.dy).toBeCloseTo(0);
  });
  it("packs relay state, uses correct contribution labels, and draws every warning without mutating state", () => {
    const a = setup(2, 3);
    run(a, 2.2);
    expect(packSnapshot(a.snapshot()).raid!.mirrors).toHaveLength(4);
    expect(featureLabel("prismatail")).toBe("Relays");
    expect(raidContributions(a.snapshot())).toContain("Relays");
    expect(raidCue(a.snapshot(), "p0")).toContain("Split Light");
    const g: any = new Proxy(
      {},
      { get: (_t, key) => (key === "then" ? undefined : vi.fn(() => g)) },
    );
    const before = JSON.stringify(a.snapshot());
    drawSunAtrium(g, a.snapshot(), true);
    drawPrismatail(g, a.snapshot(), true, 0);
    expect(JSON.stringify(a.snapshot())).toBe(before);
    for (const kind of RAID_BOSS_ATTACKS.prismatail!) {
      attack(a, kind);
      for (const w of a.raid.warnings)
        expect(drawPrismatailWarning(g, a.snapshot(), w)).toBe(true);
      a.raid.warnings = [];
    }
  });
});

describe("Prismatail stand-ins and long encounters", () => {
  it("repairs a misaligned mirror by attacking it and completes a solo relay", () => {
    const a = setup();
    a.raid.mirrors![0].angle = Math.PI / 4;
    a.standIn("p0");
    run(a, 25);
    expect(a.raid.shieldBreaks).toBeGreaterThan(0);
  });
  it("does not bank beam burn across an exposure", () => {
    const a = setup();
    run(a, 3.5);
    // Only the beam here: no attack after the exposure.
    (a as any).nextAttack = Infinity;
    const p = a.heroes()[0];
    const before = p.hp;
    run(a, 6.8);
    expect(before - p.hp).toBeLessThan(3);
  });
  it("exercises all chapters with four stand-ins without invalid positions or stuck relay state", () => {
    const a = setup(4, 1, 3, ["voltkit", "cindrake", "tidefin", "mystowl"]);
    a.heroes().forEach((p) => a.standIn(p.id));
    (a as any).nextAttack = 0;
    const seen = new Set<string>();
    let finalFor = 0,
      breaks = 0;
    const chip = a.raid.maxHp / 3 / 75 / 30;
    for (let t = 0; t < 460 && !a.raid.result && finalFor < 75; t += 1 / 30) {
      const boss = a.boss()!,
        before = boss.hp;
      a.tick();
      boss.hp = before - (a.phase === "playing" ? chip : 0);
      for (const w of a.raid.warnings) seen.add(w.kind);
      breaks = Math.max(breaks, a.raid.shieldBreaks ?? 0);
      if (a.phase === "intermission")
        for (const [id, offer] of Object.entries(a.raid.offers))
          a.pickRite(id, offer[0]);
      for (const p of a.heroes()) {
        p.hp = CHARACTERS[p.character].health;
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      if (a.raid.phase === 3) finalFor += 1 / 30;
    }
    expect(a.raid.phase).toBe(3);
    expect(breaks).toBeGreaterThan(1);
    for (const kind of RAID_BOSS_ATTACKS.prismatail!.filter(
      (k) => k !== "light-relay",
    ))
      expect(seen, kind).toContain(kind);
  });
});

describe("Prismatail AI: scrambled mirrors, held relays and steered attacks", () => {
  it("flashes the path's mirrors before the exposure ends, then turns them so the light breaks", () => {
    const a = setup();
    run(a, 3.5);
    expect(a.raid.shieldBreaks).toBe(1);
    const end = a.raid.exposedUntil;
    expect(end - a.time).toBeLessThanOrEqual(P.expose);
    expect(a.raid.mirrors!.some((m) => m.scrambleAt !== undefined)).toBe(false);
    run(a, end - P.scramble.warn - a.time + 0.05);
    // In the first chapter a mirror that carried the light, plus one on the
    // board's other route (0 → 1 and 2 → 3 both reach the heart from here).
    const flashing = a.raid.mirrors!.flatMap((m, i) =>
      m.scrambleAt !== undefined ? [i] : [],
    );
    expect(flashing).toHaveLength(2);
    expect([0, 1]).toContain(flashing[0]);
    expect([2, 3]).toContain(flashing[1]);
    const m = a.raid.mirrors![flashing[0]],
      before = m.angle;
    // The flash stays on screen for the whole warning (well over 0.9 s).
    expect(m.scrambleAt! - a.time).toBeGreaterThan(1.4);
    expect(Math.abs(m.scrambleAt! - end)).toBeLessThan(0.05);
    run(a, m.scrambleAt! - a.time + 0.05);
    expect(m.scrambleAt).toBeUndefined();
    const turned =
      (((before - m.angle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    expect([2, 3].map((k) => (k * Math.PI) / 4)).toContainEqual(
      expect.closeTo(turned, 5),
    );
    // A raider who does not re-aim the mirror cannot break the shield again.
    run(a, P.relayRestart + 3);
    expect(a.raid.shieldBreaks).toBe(1);
  });
  it("scrambles two mirrors from the second chapter, and when a chapter starts", () => {
    const a = setup(1, 2);
    run(a, 3.5);
    run(a, a.raid.exposedUntil - P.scramble.warn - a.time + 0.05);
    expect(
      a.raid.mirrors!.filter((m) => m.scrambleAt !== undefined),
    ).toHaveLength(2);
    const b = setup();
    b.damage(b.boss()!, 1e6, "p0");
    b.tick();
    expect(b.raid.phase).toBe(2);
    expect(
      b.raid.mirrors!.filter((m) => m.scrambleAt !== undefined),
    ).toHaveLength(2);
    // One route on the board from where the raider stands: one mirror.
    const one = setup();
    one.raid.trait = "kaleidoscope";
    Object.assign(one.heroes()[0], { x: 450, y: 300 });
    run(one, 3.5);
    expect(one.raid.shieldBreaks).toBe(1);
    run(one, one.raid.exposedUntil - P.scramble.warn - one.time + 0.05);
    expect(
      one.raid.mirrors!.flatMap((m, i) =>
        m.scrambleAt !== undefined ? [i] : [],
      ),
    ).toHaveLength(1);
    // Practice never scrambles.
    const c = setup();
    c.raid.drill = "light-relay";
    run(c, 3.5 + P.expose);
    expect(c.raid.mirrors!.every((m) => m.scrambleAt === undefined)).toBe(true);
  });
  it("holds 1.2 s with a party, 1 s solo and 2 s solo in the last chapter, and returns 3 s after an exposure", () => {
    expect(P.hold).toEqual({ party: 1.2, solo: 1, soloFinal: 2 });
    const a = setup(2);
    a.heroes()[1].x = 1500;
    run(a, 2 + 1.05);
    expect(a.raid.shieldBreaks).toBe(0);
    run(a, 0.3);
    expect(a.raid.shieldBreaks).toBe(1);
    const end = a.raid.exposedUntil;
    expect(end - a.time).toBeLessThanOrEqual(P.expose);
    run(a, end - a.time + P.relayRestart - 0.1);
    align(a);
    expect(a.raid.lightStartedAt).toBeUndefined();
    run(a, 0.2);
    expect(a.raid.lightStartedAt).toBeGreaterThan(end + P.relayRestart - 0.05);
  });
  it("burns a carrier at 6 health a second", () => {
    expect(P.burn).toBe(6);
    const a = setup(),
      p = a.heroes()[0];
    // A broken chain still burns whoever takes the skylight, and never breaks.
    a.raid.mirrors!.forEach((m) => (m.angle = Math.PI));
    run(a, 2.05);
    const hp = p.hp;
    run(a, 3);
    expect(a.raid.shieldBreaks).toBe(0);
    expect(hp - p.hp).toBeGreaterThan(15);
    expect(hp - p.hp).toBeLessThan(19.5);
  });
  it("aims lances at the raider carrying the light, and ahead of a running raider", () => {
    const a = setup(3);
    Object.assign(a.heroes()[1], { x: 1300, y: 200 });
    Object.assign(a.heroes()[2], { x: 1300, y: 750 });
    run(a, 2.3);
    expect(a.raid.lightHold).toBeGreaterThan(0);
    const alive = a.heroes();
    for (let i = 0; i < 6; i++) {
      (a as any).attacks = i;
      expect((a as any).chooseTarget("prism-lance", alive).id).toBe("p0");
      expect((a as any).chooseTarget("refraction", alive).id).toBe("p0");
    }
    // Not a carrier, running: the lane is drawn ahead of where they are.
    const b = setup(2);
    (b as any).relayAt = Infinity;
    const q = b.heroes()[1];
    Object.assign(q, { x: 600, y: 700, vx: 0, vy: -222 });
    (b as any).startAttack("prism-lance", q);
    const w = b.raid.warnings[0],
      d = prismDistance({ x: 600, y: 700 }, w),
      ahead = prismDistance(
        { x: 600, y: 700 - Math.min(140, 0.7 * 222 * P.lance.delay) },
        w,
      );
    expect(d).toBeGreaterThan(P.lance.width + 24);
    expect(ahead).toBeLessThan(5);
    // Standing still always beats a led lance.
    const c = setup(2);
    const still = c.heroes()[1];
    Object.assign(still, { x: 600, y: 700, vx: 0, vy: 0 });
    (c as any).startAttack("prism-lance", still);
    expect(prismDistance(still, c.raid.warnings[0])).toBeLessThan(1);
  });
  it("fires the fan slice over the most raiders that can still all leave it", () => {
    const a = setup(3),
      b = a.boss()!;
    (a as any).relayAt = Infinity;
    // Two raiders bunched in slice 2, one alone in slice 4.
    const at = (i: number, d: number, off = 0) => ({
      x: b.x + Math.cos((i * Math.PI) / 3 + off) * d,
      y: b.y + Math.sin((i * Math.PI) / 3 + off) * d,
    });
    Object.assign(a.heroes()[0], at(2, 250, 0.1));
    Object.assign(a.heroes()[1], at(2, 300, -0.1));
    Object.assign(a.heroes()[2], at(4, 260));
    attack(a, "fan-display");
    expect(a.raid.warnings[0].prismIndex).toBe(2);
    // Deep in a slice, too far from any way out: that slice is skipped.
    Object.assign(a.heroes()[0], at(2, 440));
    Object.assign(a.heroes()[1], at(2, 420, 0.03));
    a.raid.warnings = [];
    attack(a, "fan-display");
    const w = a.raid.warnings[0];
    expect(w.prismIndex).not.toBe(2);
    for (const p of a.heroes())
      expect(fanEscape(p, w, w.prismIndex!, w.prismCount!)).toBeLessThanOrEqual(
        222 * (P.fan.delay - 0.45),
      );
  });
  it("opens the halo's gap away from raiders around it and against the target's run", () => {
    const a = setup(3);
    (a as any).relayAt = Infinity;
    const t = a.heroes()[0];
    Object.assign(t, { x: 800, y: 450, vx: 0, vy: 0 });
    Object.assign(a.heroes()[1], { x: 950, y: 450 });
    Object.assign(a.heroes()[2], { x: 800, y: 600 });
    attack(a, "halo-crush");
    let gap = a.raid.warnings[0].gapAngle!;
    // Away from the raiders standing east and south of the ring.
    expect(Math.cos(gap)).toBeLessThan(0.1);
    expect(Math.sin(gap)).toBeLessThan(0.1);
    a.raid.warnings = [];
    Object.assign(a.heroes()[1], { x: 200, y: 200 });
    Object.assign(a.heroes()[2], { x: 1400, y: 200 });
    Object.assign(t, { vx: 0, vy: 230 });
    attack(a, "halo-crush");
    gap = a.raid.warnings[0].gapAngle!;
    // Running south: the way out is behind them.
    expect(Math.sin(gap)).toBeLessThan(-0.3);
    // Near a wall the gap still opens onto the floor.
    a.raid.warnings = [];
    Object.assign(t, { x: 120, y: 450, vx: -230, vy: 0 });
    attack(a, "halo-crush");
    gap = a.raid.warnings[0].gapAngle!;
    expect(120 + Math.cos(gap) * (P.halo.radius + 40)).toBeGreaterThan(60);
    expect(P.halo.delay).toBe(1.75);
  });
});

it("keeps lances locked onto stationary targets near every arena edge", () => {
  for (const pos of [
    { x: 470, y: 300 },
    { x: 80, y: 80 },
    { x: 1500, y: 820 },
    { x: 800, y: 80 },
    { x: 1100, y: 800 },
  ]) {
    const a = setup();
    Object.assign(a.heroes()[0], pos);
    attack(a, "prism-lance");
    resolve(a);
    expect(a.heroes()[0].hp, JSON.stringify(pos)).toBeLessThan(
      CHARACTERS.voltkit.health,
    );
  }
});

it("renders every Prismatail appearance reward, with distinct palettes and animated aura/victory geometry", () => {
  const commands: unknown[] = [];
  const g: any = new Proxy(
    {},
    {
      get:
        (_t, key) =>
        (...args: unknown[]) => {
          commands.push([key, ...args]);
          return g;
        },
    },
  );
  const emit = vi.fn();
  expect(drawCollectionAura(g, "halo-aura", 0, 0, 1000, false)).toBe(true);
  const first = JSON.stringify(commands);
  commands.length = 0;
  drawCollectionAura(g, "halo-aura", 0, 0, 2000, false);
  expect(JSON.stringify(commands)).not.toBe(first);
  expect(playCollectionEntrance(emit, "sunburst", 0, 0, 1)).toBe(true);
  expect(emit).toHaveBeenCalledTimes(25);
  expect(
    drawCollectionVictory(
      g,
      g,
      emit,
      () => false,
      "rainbow-fan",
      0,
      0,
      1,
      1,
      0.016,
      false,
    ),
  ).toBe(true);
  const palettes = [];
  for (const skin of ["dawn-colors", "prismatic-skin"] as const) {
    expect(SKINS).toContain(skin);
    const pixels = new Uint8ClampedArray([120, 140, 160, 255]);
    tonePixels(pixels, skin);
    palettes.push([...pixels]);
  }
  expect(palettes[0]).not.toEqual(palettes[1]);
});
