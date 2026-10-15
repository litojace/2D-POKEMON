import { expect, it } from "vitest";
import { RaidArena } from "../../apps/server/src/raid";
import {
  CHARACTERS,
  blankInput,
  packSnapshot,
  unpackSnapshot,
} from "@arena/shared";
import { raidWeekly } from "../../packages/shared/src/raid";
const raid = (players = 1) => {
  const a = new RaidArena("TEST");
  for (let i = 0; i < players; i++) a.add("p" + i, "Player " + i);
  a.start();
  return a;
};
const fight = (a: RaidArena) => {
  a.phase = "playing";
  a.deadline = 480;
};
it("supports solo and four-player co-op with one distinct boss and scaled health", () => {
  const solo = raid(),
    team = raid(4);
  expect(solo.size).toBe(4);
  expect(solo.minPlayers).toBe(1);
  expect(solo.heroes()).toHaveLength(1);
  expect(team.heroes()).toHaveLength(4);
  expect(team.raid.maxHp).toBeGreaterThan(solo.raid.maxHp * 2);
  expect(team.enemiesOf(team.heroes()[0])).toEqual([team.boss()]);
  expect(team.enemiesOf(team.boss()!)).toHaveLength(4);
  const wire = packSnapshot(team.snapshot());
  expect(unpackSnapshot(wire).raid?.phase).toBe(1);
});
it("offers one starting rite and new stackable choices at each HP-gated phase", () => {
  const a = raid();
  expect(a.acknowledgeInstructions("p0")).toBe(true);
  expect(a.phase).toBe("intermission");
  const first = a.raid.offers.p0[0];
  expect(a.pickRite("p0", "forged")).toBe(false);
  expect(a.pickRite("p0", first)).toBe(true);
  fight(a);
  a.damage(a.boss()!, 100000, "p0");
  a.tick();
  expect(a.raid.phase).toBe(2);
  expect(a.phase).toBe("intermission");
  expect(a.raid.rites.p0).toContain(first);
  expect(a.raid.offers.p0).not.toContain(first);
  a.pickRite("p0", a.raid.offers.p0[0]);
  fight(a);
  a.damage(a.boss()!, 100000, "p0");
  a.tick();
  expect(a.raid.phase).toBe(3);
  a.pickRite("p0", a.raid.offers.p0[0]);
  fight(a);
  a.damage(a.boss()!, 100000, "p0");
  a.tick();
  expect(a.raid.result).toBe("victory");
  expect(a.winnerTeam).toBe(0);
  expect(a.raid.rites.p0).toHaveLength(3);
  expect(a.raid.resultId).toBeTruthy();
});
it("advances at fractional health gates despite floating-point roundoff", () => {
  const a = raid();
  a.raid.maxHp = 1008;
  for (const phase of [1, 2]) {
    fight(a);
    a.raid.phase = phase;
    a.boss()!.hp = a.raid.maxHp * (phase === 1 ? 0.67 : 0.33) + 1e-12;
    a.tick();
    expect(a.raid.phase).toBe(phase + 1);
    expect(a.phase).toBe("intermission");
    expect(a.raid.offers.p0.length).toBeGreaterThan(0);
  }
});
it("telegraphs boss attacks, breaks pillars on charge, and exposes the weak point", () => {
  const a = raid();
  fight(a);
  const b = a.boss()!,
    p = a.heroes()[0];
  b.x = 350;
  b.y = 305;
  p.x = 700;
  p.y = 305;
  a.raid.warnings = [
    {
      id: 100,
      kind: "charge",
      x: 350,
      y: 305,
      tx: 700,
      ty: 305,
      radius: 80,
      at: 0,
    },
  ];
  for (let i = 0; i < 12; i++) a.tick();
  expect(a.raid.pillars[0].broken).toBe(true);
  expect(a.raid.exposedUntil).toBeGreaterThan(a.time);
  expect(a.raid.stagger).toBeGreaterThanOrEqual(42);
  const before = b.hp;
  a.damage(b, 10, p.id);
  expect(before - b.hp).toBeGreaterThan(10);
});
it("turns control effects into stagger instead of allowing boss stun locks", () => {
  const a = raid();
  fight(a);
  a.status(a.boss()!, "stun", 100, "p0");
  expect(a.boss()!.statuses).toHaveLength(0);
  expect(a.raid.stagger).toBe(3);
  a.raid.stagger = 100;
  a.tick();
  expect(a.raid.staggerUntil).toBeGreaterThan(a.time);
  expect(a.raid.message).toContain("STAGGER");
});
it("lets solo revive once, then loses on a second down without awarding a win", () => {
  const a = raid();
  fight(a);
  const p = a.heroes()[0];
  a.damage(p, 10000, a.boss()!.id);
  expect(a.raid.downed.p0.self).toBe(true);
  for (let i = 0; i < 182; i++) a.tick();
  expect(p.hp).toBeGreaterThan(0);
  expect(a.raid.revives).toBe(1);
  a.damage(p, 10000, a.boss()!.id);
  a.tick();
  expect(a.raid.result).toBe("defeat");
  expect(a.winnerTeam).toBe(1);
});
it("keeps partial co-op revive progress when interrupted and never allows friendly fire", () => {
  const a = raid(2);
  fight(a);
  const [p, q] = a.heroes();
  p.x = 300;
  p.y = 200;
  q.x = 340;
  q.y = 200;
  const before = q.hp;
  a.damage(q, 99, p.id, CHARACTERS.voltkit.basic);
  expect(q.hp).toBe(before);
  a.damage(p, 10000, a.boss()!.id);
  for (let i = 0; i < 20; i++) a.tick();
  const progress = a.raid.downed.p0.progress;
  expect(progress).toBeGreaterThan(0);
  q.x = 700;
  for (let i = 0; i < 10; i++) a.tick();
  expect(a.raid.downed.p0.progress).toBeCloseTo(progress);
  q.x = 340;
  for (let i = 0; i < 95; i++) a.tick();
  expect(p.hp).toBeGreaterThan(0);
  expect(a.raid.revives).toBe(1);
});
it("rate limits crawling by simulation time and rejects downed attack packets", () => {
  const a = raid(2);
  fight(a);
  const p = a.heroes()[0];
  a.damage(p, 999, a.boss()!.id);
  const x = p.x;
  for (let i = 1; i <= 100; i++)
    a.submit(p, { ...blankInput(), seq: i, dx: 1, basic: true, skill: 0 });
  expect(p.x).toBe(x);
  a.tick();
  expect(p.x - x).toBeGreaterThan(0);
  expect(p.x - x).toBeLessThan(2);
  expect(p.stats.skills).toBe(0);
});
it("weekly seeds and traits are stable across rooms and team sizes", () => {
  const one = raidWeekly(new Date("2026-10-14T23:00:00Z")),
    two = raidWeekly(new Date("2026-10-18T01:00:00Z"));
  expect(one).toEqual(two);
  expect(one).not.toEqual(raidWeekly(new Date("2026-10-19T01:00:00Z")));
  const a = new RaidArena("AAA"),
    b = new RaidArena("BBB");
  a.add("a", "A");
  b.add("b", "B");
  b.add("c", "C");
  a.configure(1, true);
  b.configure(1, true);
  a.start();
  b.start();
  expect(a.raid.seed).toBe(b.raid.seed);
  expect(a.raid.trait).toBe(b.raid.trait);
  expect(a.raid.peril).toBe(2);
  expect(a.raid.gilded).toBe(false);
});

it("raid rites protect allies, share energy and heal without leaking into PvP kits", () => {
  const a = raid(2);
  fight(a);
  const [p, q] = a.heroes();
  a.raid.rites[p.id] = ["shelter", "sharing", "mending"];
  a.submit(p, { ...blankInput(), seq: 1, dash: true });
  a.tick();
  expect(a.raid.wards).toHaveLength(1);
  const before = q.hp;
  a.damage(q, 20, a.boss()!.id);
  expect(before - q.hp).toBeCloseTo(15);
  p.ult = 0;
  q.ult = 0;
  a.orbs = [{ id: 100, x: p.x, y: p.y, kind: "energy" }];
  a.stepOrbs();
  expect(p.ult).toBe(35);
  expect(q.ult).toBe(12);
  q.hp = 20;
  a.cast(p, CHARACTERS[p.character].skills[3]);
  expect(q.hp).toBeGreaterThan(20);
  expect(p.rites).toEqual([]); // Dedicated raid upgrades never modify saved PvP rites.
});
it("counter reflection cannot skip HP-gated phases or kill the boss during phase one", () => {
  const a = raid();
  fight(a);
  const p = a.heroes()[0],
    b = a.boss()!;
  a.status(p, "counter", 3);
  a.damage(p, 100000, b.id);
  expect(b.hp).toBeGreaterThanOrEqual(a.raid.maxHp * 0.67);
});
it("Peril 3 closes the final arena gradually instead of only increasing boss health", () => {
  const a = raid();
  fight(a);
  a.raid.peril = 3;
  a.raid.phase = 3;
  const hp = a.raid.maxHp;
  a.heroes()[0].hp = 100000;
  a.tick();
  const radius = a.raid.closingRadius!;
  for (let i = 0; i < 100; i++) a.tick();
  expect(a.raid.closingRadius).toBeLessThan(radius);
  expect(a.raid.maxHp).toBe(hp);
});

it("tracks the chosen hero before locking, then preserves the telegraphed lane", () => {
  const a = raid();
  fight(a);
  const p = a.heroes()[0];
  p.hp = 100000;
  for (let i = 0; i < 65; i++) a.tick();
  const w = a.raid.warnings.find((w) => w.kind === "charge")!;
  expect(w.targetId).toBe(p.id);
  expect(w.lockAt! - w.startedAt!).toBeCloseTo(1);
  const original = w.ty;
  p.y = 730;
  a.tick();
  expect(w.ty).not.toBe(original);
  while (a.time < w.lockAt!) a.tick();
  const locked = { x: w.tx, y: w.ty };
  p.x = 1450;
  p.y = 100;
  for (let i = 0; i < 6; i++) a.tick();
  expect({ x: w.tx, y: w.ty }).toEqual(locked);
  expect(w.at - w.lockAt!).toBeCloseTo(0.7);
});

it("gives phase two a second slam with time to recover a jump, cancelled by stagger", () => {
  const a = raid();
  fight(a);
  a.raid.phase = 2;
  a.raid.warnings = [
    {
      id: 900,
      kind: "slam",
      x: 800,
      y: 450,
      tx: 800,
      ty: 450,
      radius: 240,
      at: 0,
      startedAt: 0,
    },
  ];
  a.tick();
  const second = a.raid.warnings.find((w) => w.followUp)!;
  expect(second.kind).toBe("slam");
  expect(second.at - second.startedAt!).toBeGreaterThan(2);
  a.raid.stagger = 100;
  a.tick();
  expect(a.raid.warnings).toHaveLength(0);
  for (let i = 0; i < 100; i++) a.tick();
  expect(a.raid.warnings).toHaveLength(0);
});

it("ends a final-phase slam combination with debris and a recovery window", () => {
  const a = raid();
  fight(a);
  a.raid.phase = 3;
  a.heroes()[0].hp = 100000;
  a.raid.warnings = [
    {
      id: 900,
      kind: "slam",
      x: 800,
      y: 450,
      tx: 800,
      ty: 450,
      radius: 320,
      at: 0,
      followUp: true,
    },
  ];
  a.tick();
  expect(a.raid.warnings.some((w) => w.kind === "debris")).toBe(true);
  for (let i = 0; i < 85; i++) a.tick();
  expect(a.raid.warnings).toHaveLength(0);
  const before = a.boss()!.hp;
  a.damage(a.boss()!, 10, "p0");
  expect(before - a.boss()!.hp).toBeGreaterThan(10);
});

it("varies teammates' rite offers while preserving weekly seat reproducibility", () => {
  const make = (code: string) => {
    const a = new RaidArena(code);
    for (let i = 0; i < 4; i++) a.add(code + i, "Player");
    a.configure(1, true);
    a.start();
    a.heroes().forEach((p) => a.acknowledgeInstructions(p.id));
    return a;
  };
  const a = make("A"),
    b = make("B");
  const offers = Object.values(a.raid.offers);
  expect(new Set(offers.map((v) => v.join(","))).size).toBe(4);
  expect(offers).toEqual(Object.values(b.raid.offers));
});

it("credits actual damage and pillar baiting, and resets contributions on quick retry", () => {
  const a = raid();
  fight(a);
  a.damage(a.boss()!, 100000, "p0");
  expect(a.raid.contributions!.p0.damage).toBeCloseTo(a.raid.maxHp * 0.33);
  a.boss()!.x = 350;
  a.boss()!.y = 305;
  a.raid.warnings = [
    {
      id: 990,
      kind: "charge",
      x: 350,
      y: 305,
      tx: 700,
      ty: 305,
      radius: 80,
      at: 0,
      targetId: "p0",
    },
  ];
  // Keep this chapter active while the charge reaches the pillar.
  a.boss()!.hp = a.raid.maxHp;
  for (let i = 0; i < 12; i++) a.tick();
  expect(a.raid.contributions!.p0.pillars).toBe(1);
  a.forfeit("p0");
  a.retry();
  expect(a.phase).toBe("intermission");
  expect(a.raid.contributions!.p0).toEqual({
    damage: 0,
    revives: 0,
    pillars: 0,
  });
  expect(a.raid.offers.p0).toHaveLength(3);
});

it("credits all participating rescuers, including help before an interruption", () => {
  const a = raid(3);
  fight(a);
  const [p, q, r] = a.heroes();
  p.x = q.x = r.x = 280;
  p.y = q.y = r.y = 220;
  a.damage(p, 10000, a.boss()!.id);
  for (let i = 0; i < 15; i++) a.tick();
  q.x = 700;
  for (let i = 0; i < 80; i++) a.tick();
  expect(p.hp).toBeGreaterThan(0);
  expect(a.raid.contributions![q.id].revives).toBe(1);
  expect(a.raid.contributions![r.id].revives).toBe(1);
  expect(a.raid.contributions![p.id].revives).toBe(0);
});
