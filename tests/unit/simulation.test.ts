import { describe, it, expect } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  RULES,
  ULT_SLOT,
  advanceMovement,
  blankInput,
  blocked,
  move,
  normalize,
  inputSchema,
} from "../../packages/shared/src/index.js";
const duel = () => {
  const a = new Arena("ABC123");
  a.add("one", "One");
  a.add("two", "Two", "cindrake");
  a.start();
  a.phase = "playing";
  a.deadline = 180;
  return a;
};
const input = (overrides: Partial<ReturnType<typeof blankInput>> = {}) => ({
  ...blankInput(),
  seq: 1,
  ...overrides,
});
describe("authoritative simulation", () => {
  it("normalizes diagonal movement without accelerating beyond cardinal speed", () => {
    expect(Math.hypot(...Object.values(normalize(1, 1)))).toBeCloseTo(1);
    const a = duel(),
      p = a.players[0],
      q = structuredClone(p);
    for (let i = 0; i < 60; i++) {
      advanceMovement(p, input({ dx: 1 }), 1 / 30, i / 30);
      advanceMovement(q, input({ dx: 1, dy: -1 }), 1 / 30, i / 30);
    }
    expect(Math.hypot(q.vx, q.vy)).toBeCloseTo(Math.hypot(p.vx, p.vy));
  });
  it("blocks walls, rocks and swept movement while allowing sliding", () => {
    const p = { x: 450, y: 280 };
    move(p, 500, 10);
    expect(p.x).toBeLessThanOrEqual(466);
    expect(p.y).toBeGreaterThan(280);
    expect(blocked(p.x, p.y)).toBe(false);
    move(p, -3000, 0);
    expect(p.x).toBeGreaterThanOrEqual(24);
  });
  it("applies projectile damage and knockback only on server collision", () => {
    const a = duel(),
      [p, q] = a.players;
    q.x = 400;
    q.y = 450;
    p.lastInput = input({ aimX: q.x, aimY: q.y, basic: true });
    a.tick();
    for (let i = 0; i < 10; i++) a.tick();
    expect(q.hp).toBeLessThan(CHARACTERS[q.character].health);
    expect(p.stats.dealt).toBeGreaterThan(0);
    expect(q.x).toBeGreaterThan(400);
  });
  it("enforces cooldowns and prevents repeated or out-of-state inputs", () => {
    const a = duel(),
      p = a.players[0];
    a.submit(p, input({ skill: 0 }));
    a.tick();
    const end = p.cooldowns[0];
    a.submit(p, input({ seq: 2, skill: 0 }));
    a.tick();
    expect(p.cooldowns[0]).toBe(end);
    expect(p.stats.skills).toBe(1);
    a.submit(p, input({ seq: 1, dx: 1 }));
    expect(p.ack).toBe(2);
    a.phase = "finished";
    a.submit(p, input({ seq: 99 }));
    expect(p.ack).toBe(2);
  });
  it("caps dash speed, cooldown and wall crossings", () => {
    const a = duel(),
      p = a.players[0];
    p.x = 450;
    p.y = 280;
    a.submit(p, input({ dx: 1, dash: true }));
    a.tick();
    const end = p.dashAt;
    for (let i = 0; i < 8; i++) {
      a.submit(p, input({ seq: i + 2, dx: 1, dash: true }));
      a.tick();
    }
    expect(p.dashAt).toBe(end);
    expect(p.x).toBeLessThan(490);
    expect(blocked(p.x, p.y)).toBe(false);
  });
  it("tracks jump takeoff and landing and avoids only ground attacks", () => {
    const a = duel(),
      [p, q] = a.players;
    a.submit(q, input({ jump: true }));
    a.tick();
    expect(q.jumpUntil).toBeGreaterThan(a.time);
    const hp = q.hp;
    a.damage(q, 10, p.id, { ...CHARACTERS.voltkit.skills[2], ground: true });
    expect(q.hp).toBe(hp);
    a.damage(q, 10, p.id, CHARACTERS.voltkit.basic);
    expect(q.hp).toBe(hp - 10);
    for (let i = 0; i < 22; i++) a.tick();
    expect(q.jumpUntil).toBeLessThan(a.time);
    expect(q.jumpAt).toBeGreaterThan(a.time);
  });
  it("handles burn, slow, counter, haste and crowd-control immunity", () => {
    const a = duel(),
      [p, q] = a.players;
    a.status(q, "burn", 1);
    for (let i = 0; i < 20; i++) a.tick();
    expect(q.hp).toBeLessThan(CHARACTERS.cindrake.health);
    a.status(q, "stun", 0.3);
    const until = q.statuses.find((s) => s.kind === "stun")!.until;
    a.status(q, "stun", 5);
    expect(q.statuses.find((s) => s.kind === "stun")!.until).toBe(until);
    a.status(q, "counter", 1);
    const hp = q.hp,
      source = p.hp;
    a.damage(q, 20, p.id);
    expect(q.hp).toBe(hp - 10);
    expect(p.hp).toBe(source - 6);
    a.status(q, "slow", 1);
    a.status(q, "haste", 1);
    expect(q.statuses.map((s) => s.kind)).toContain("slow");
  });
  it("resets rounds and wins best of five", () => {
    const a = duel();
    a.players[1].hp = 0;
    a.tick();
    expect(a.scores.one).toBe(1);
    expect(a.phase).toBe("intermission");
    for (let i = 0; i < 125; i++) a.tick();
    expect(a.phase).toBe("countdown");
    expect(a.players[1].hp).toBe(CHARACTERS.cindrake.health);
    expect(a.players[0].cooldowns).toEqual([0, 0, 0, 0]);
    // Rounds two and three: the match ends on the third win.
    for (const last of [false, true]) {
      a.phase = "playing";
      a.players[1].hp = 0;
      a.tick();
      expect(a.phase).toBe(last ? "finished" : "intermission");
    }
    expect(a.scores.one).toBe(3);
    expect(a.winner).toBe("one");
    a.start();
    expect(a.scores.one).toBe(0);
    expect(a.players[0].stats.skills).toBe(0);
  });
  it("uses health percentages on timeout and overtime on ties", () => {
    const a = duel();
    a.deadline = 0;
    a.players[0].hp = 100;
    a.players[1].hp = 100;
    a.tick();
    expect(a.roundWinner).toBe("one");
    const b = duel();
    b.deadline = 0;
    b.tick();
    expect(b.overtime).toBe(true);
    for (let i = 0; i < 450 && b.phase === "playing"; i++) b.tick();
    expect(b.phase).toBe("intermission");
  });
  it("rejects fabricated positions, health, damage and malformed controls", () => {
    expect(
      inputSchema.safeParse({ ...input(), hp: 999, x: 0, damage: 1000 })
        .success,
    ).toBe(false);
    expect(inputSchema.safeParse(input({ dx: 100 })).success).toBe(false);
    expect(inputSchema.safeParse(input({ aimX: NaN })).success).toBe(false);
  });
  it("all characters have four functional skills with charged cast timing", () => {
    const selfStatus = {
      counter: "counter",
      barrier: "shield",
      buff: "empower",
      rest: "sleep",
    } as const;
    for (const c of Object.values(CHARACTERS)) {
      expect(c.skills).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        const a = duel(),
          p = a.players[0];
        p.character = c.id;
        if (i === ULT_SLOT) p.ult = RULES.ultMax;
        a.submit(p, input({ skill: i, aimX: 420, aimY: 450 }));
        a.tick();
        if (c.skills[i].cast) {
          expect(a.projectiles).toHaveLength(0);
          for (let j = 0; j < 22; j++) a.tick();
        }
        expect(p.stats.skills).toBe(1);
        if (i === ULT_SLOT) expect(p.ult).toBeLessThan(5);
        else expect(p.cooldowns[i]).toBeGreaterThan(0);
        if (c.skills[i].kind === "clone") expect(p.clone).toBeDefined();
        const kind = c.skills[i].kind;
        if (kind in selfStatus)
          expect(
            p.statuses.some(
              (s) => s.kind === selfStatus[kind as keyof typeof selfStatus],
            ),
          ).toBe(true);
      }
    }
  });
  it("obstacles stop projectiles and melee cannot reach through walls", () => {
    const a = duel(),
      [p, q] = a.players;
    p.x = 450;
    p.y = 300;
    q.x = 620;
    q.y = 300;
    p.lastInput = input({ aimX: q.x, aimY: q.y, skill: 0 });
    for (let i = 0; i < 30; i++) a.tick();
    expect(q.hp).toBe(CHARACTERS.cindrake.health);
    expect(a.projectiles).toHaveLength(0);
  });
  it("preserves a skill edge arriving between movement packets", () => {
    const a = duel(),
      p = a.players[0];
    a.submit(p, input({ skill: 1 }));
    a.submit(p, input({ seq: 2 }));
    a.tick();
    expect(p.stats.skills).toBe(1);
  });
  it("does not grant universal dash invulnerability", () => {
    const a = duel(),
      [p, q] = a.players;
    a.submit(q, input({ dash: true, dx: 1 }));
    a.tick();
    a.damage(q, 10, p.id);
    expect(q.hp).toBe(CHARACTERS.cindrake.health - 10);
  });
});
