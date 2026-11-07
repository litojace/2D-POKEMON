import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  RULES,
  blankInput,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";

// Wave 2 of making every kit its own: four of the six melee stun strikes and
// two of the four knockback novas now play on mechanics no one else has.

const arena = (me: CharacterId, them: CharacterId = "terradon") => {
  const a = new Arena("WAVE2", "duel");
  a.add("me", "Me", me);
  a.add("them", "Them", them);
  a.start();
  a.phase = "playing";
  a.deadline = 999;
  return a;
};
const place = (p: Fighter, x: number, y: number, aimX = x + 100, aimY = y) => {
  Object.assign(p, { x, y, vx: 0, vy: 0 });
  p.lastInput = { ...blankInput(), aimX, aimY };
  p.angle = Math.atan2(aimY - y, aimX - x);
};
const ticks = (a: Arena, n: number) => {
  for (let i = 0; i < n; i++) a.tick();
};
const seconds = (a: Arena, s: number) => ticks(a, Math.round(RULES.tick * s));
const skill = (c: CharacterId, id: string) =>
  CHARACTERS[c].skills.find((k) => k.id === id)!;
/** Open ground on the classic arena's top row. */
const Y = 150;
let seq = 0;

describe("Eyespot Flash (Lumoth)", () => {
  it("stuns only the enemies looking at Lumoth", () => {
    const a = arena("lumoth");
    const [me, them] = a.players;
    place(me, 400, Y);
    place(them, 600, Y, 400, Y);
    a.cast(me, skill("lumoth", "eyespot-flash"));
    expect(a.has(them, "stun")).toBe(true);
    const b = arena("lumoth");
    const [me2, them2] = b.players;
    place(me2, 400, Y);
    place(them2, 600, Y, 900, Y);
    const hp = them2.hp;
    b.cast(me2, skill("lumoth", "eyespot-flash"));
    expect(b.has(them2, "stun")).toBe(false);
    expect(hp - them2.hp).toBe(skill("lumoth", "eyespot-flash").damage);
  });
});

describe("Static Clamp (Coilemur)", () => {
  it("goes off after its fuse, and arcs to enemies near the target", () => {
    const a = new Arena("WAVE2", "ffa");
    a.add("me", "Me", "coilemur");
    a.add("t1", "T1", "terradon");
    a.add("t2", "T2", "voltkit");
    a.start();
    a.phase = "playing";
    a.deadline = 999;
    const [me, t1, t2] = a.players;
    place(me, 400, Y);
    place(t1, 500, Y);
    place(t2, 640, Y);
    const clamp = skill("coilemur", "static-clamp");
    const hp1 = t1.hp,
      hp2 = t2.hp;
    a.cast(me, clamp);
    expect(a.has(t1, "clamp")).toBe(true);
    expect(t1.hp).toBe(hp1);
    seconds(a, (clamp.fuse ?? 1.5) - 0.2);
    expect(t1.hp).toBe(hp1);
    seconds(a, 0.4);
    expect(hp1 - t1.hp).toBeCloseTo(clamp.damage, 0);
    expect(hp2 - t2.hp).toBeCloseTo(clamp.damage * (clamp.chain ?? 0.5), 0);
    expect(a.has(t1, "paralysis")).toBe(true);
    expect(a.has(t1, "clamp")).toBe(false);
  });
  it("goes off at once on a Magnetised target", () => {
    const a = arena("coilemur");
    const [me, them] = a.players;
    place(me, 400, Y);
    place(them, 500, Y);
    a.damage(them, 10, me.id, skill("coilemur", "magnet-lash"));
    place(them, 500, Y);
    const hp = them.hp;
    a.cast(me, skill("coilemur", "static-clamp"));
    expect(hp - them.hp).toBeGreaterThan(
      skill("coilemur", "static-clamp").damage,
    );
    expect(a.has(them, "clamp")).toBe(false);
  });
});

describe("Kraken Grasp (Shadopus)", () => {
  it("holds the enemy, then hurls it toward the aim", () => {
    const a = arena("shadopus");
    const [me, them] = a.players;
    place(me, 400, Y, 600, Y);
    place(them, 520, Y);
    const grasp = skill("shadopus", "kraken-grasp");
    const hp = them.hp;
    a.cast(me, grasp);
    expect(me.grab?.target).toBe(them.id);
    // Held in front while Shadopus aims down the open row.
    ticks(a, 3);
    expect(Math.hypot(them.x - me.x, them.y - me.y)).toBeLessThan(80);
    me.lastInput = { ...me.lastInput, aimX: 1200, aimY: Y };
    seconds(a, (grasp.hold ?? 0.5) + 0.1);
    expect(me.grab).toBeUndefined();
    expect(them.x).toBeGreaterThan(me.x + 300);
    expect(hp - them.hp).toBeGreaterThanOrEqual(grasp.damage);
  });
  it("hits harder into a wall", () => {
    const thrown = (aimY: number) => {
      const a = arena("shadopus");
      const [me, them] = a.players;
      place(me, 400, Y, 400, aimY);
      place(them, 400, Y + 80);
      if (aimY < Y) place(them, 400, Y - 70);
      me.angle = Math.atan2(aimY - Y, 0);
      const hp = them.hp;
      a.cast(me, skill("shadopus", "kraken-grasp"));
      seconds(a, 0.7);
      return hp - them.hp;
    };
    // Up: the arena's top wall is right there. Down: open floor? Not always,
    // so compare against the ability's plain damage instead.
    expect(thrown(0)).toBeCloseTo(
      skill("shadopus", "kraken-grasp").damage *
        (skill("shadopus", "kraken-grasp").wallSlam ?? 1),
      0,
    );
  });
});

describe("Mochi Pound (Astrabun)", () => {
  const slot = CHARACTERS.astrabun.skills.findIndex(
    (k) => k.id === "mochi-pound",
  );
  it("chains three pounds; only the last stuns; then the cooldown runs", () => {
    const a = arena("astrabun");
    const [me, them] = a.players;
    place(me, 400, Y);
    place(them, 500, Y);
    const pound = skill("astrabun", "mochi-pound");
    const hits: number[] = [];
    for (let i = 0; i < 3; i++) {
      const hp = them.hp;
      place(them, 500, Y);
      a.submit(me, { ...me.lastInput, seq: ++seq, skill: slot });
      a.tick();
      hits.push(hp - them.hp);
      if (i < 2) expect(a.has(them, "stun")).toBe(false);
      seconds(a, 0.4);
    }
    expect(hits).toEqual(pound.strikes);
    expect(a.has(them, "stun") || them.immuneUntil > 0).toBe(true);
    expect(me.pound).toBeUndefined();
    expect(me.cooldowns[slot]).toBeGreaterThan(a.time + pound.cooldown - 1);
  });
  it("lapses if the next pound doesn't come in time", () => {
    const a = arena("astrabun");
    const [me, them] = a.players;
    place(me, 400, Y);
    place(them, 500, Y);
    a.submit(me, { ...me.lastInput, seq: ++seq, skill: slot });
    a.tick();
    expect(me.pound?.step).toBe(1);
    seconds(a, 1.5);
    expect(me.pound).toBeUndefined();
    expect(me.cooldowns[slot]).toBeGreaterThan(a.time + 5);
  });
});

describe("Crystal Cage (Auralynx)", () => {
  it("keeps whoever is inside in, whoever is outside out, and stops shots", () => {
    const a = new Arena("WAVE2", "ffa");
    a.add("me", "Me", "auralynx");
    a.add("in", "In", "terradon");
    a.add("out", "Out", "voltkit");
    a.start();
    a.phase = "playing";
    a.deadline = 999;
    const [me, inside, outside] = a.players;
    place(me, 500, Y + 100);
    place(inside, 600, Y + 100);
    place(outside, 900, Y + 100);
    const cage = skill("auralynx", "crystal-cage");
    const hp = inside.hp;
    a.cast(me, cage);
    expect(hp - inside.hp).toBe(cage.damage);
    inside.lastInput = { ...inside.lastInput, dx: 1 };
    outside.lastInput = { ...outside.lastInput, dx: -1 };
    seconds(a, 1.5);
    expect(
      Math.hypot(inside.x - 500, inside.y - (Y + 100)),
    ).toBeLessThanOrEqual(cage.radius);
    expect(
      Math.hypot(outside.x - 500, outside.y - (Y + 100)),
    ).toBeGreaterThanOrEqual(cage.radius);
    // A shot from outside dies on the ring.
    a.projectiles.push({
      id: ++a.serial,
      owner: outside.id,
      x: outside.x,
      y: outside.y,
      vx: -900,
      vy: 0,
      remaining: 800,
      ability: CHARACTERS.voltkit.basic,
      color: 0,
    });
    const meHp = me.hp;
    ticks(a, 20);
    expect(me.hp).toBe(meHp);
    // Free once it falls.
    seconds(a, cage.duration);
    expect(inside.statuses.some((s) => s.kind === "cage")).toBe(false);
  });
});

describe("Radiant Flare (Lumoth)", () => {
  it("sweeps nearby enemies with turning rays, again and again", () => {
    const a = arena("lumoth");
    const [me, them] = a.players;
    place(me, 500, Y);
    place(them, 650, Y);
    const flare = skill("lumoth", "radiant-flare");
    const hp = them.hp;
    a.cast(me, flare);
    seconds(a, flare.duration + 0.1);
    const sweeps = (hp - them.hp) / flare.damage;
    const expected =
      (flare.duration / (flare.spin ?? 1.2)) * (flare.count ?? 3);
    expect(sweeps).toBeGreaterThanOrEqual(expected - 1);
    expect(sweeps).toBeLessThanOrEqual(expected + 1);
    // Out of reach: untouched.
    const b = arena("lumoth");
    const [me2, them2] = b.players;
    place(me2, 500, Y);
    place(them2, 500 + flare.range + 80, Y);
    const hp2 = them2.hp;
    b.cast(me2, flare);
    seconds(b, flare.duration + 0.1);
    expect(them2.hp).toBe(hp2);
  });
});
