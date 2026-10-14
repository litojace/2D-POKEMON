import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  MUTATOR_RULES,
  RULES,
  roundsNeeded,
} from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
const tick = (a: Arena, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * RULES.tick); i++) a.tick();
};
function duel(rules: string[] = []) {
  const a = new Arena("RULES");
  a.mutators = new Set(rules as never[]);
  a.add("one", "One", "voltkit");
  a.add("two", "Two", "tidefin");
  a.start();
  a.acknowledgeInstructions("one");
  a.acknowledgeInstructions("two");
  tick(a, RULES.countdown + 0.1);
  return a;
}
describe("party rules", () => {
  it("quick match is first to two", () => {
    expect(roundsNeeded([])).toBe(RULES.roundsToWin);
    expect(roundsNeeded(["quick"])).toBe(2);
    const a = duel(["quick"]);
    a.endRound(0);
    expect(a.phase).toBe("intermission");
    a.endRound(0);
    expect(a.phase).toBe("finished");
    expect(a.snapshot().mutators).toEqual(["quick"]);
  });
  it("glass cannon multiplies damage", () => {
    const plain = duel(),
      glass = duel(["glass"]);
    for (const a of [plain, glass])
      a.damage(a.players[1], 20, "one", CHARACTERS.voltkit.basic);
    const lost = (a: Arena) => CHARACTERS.tidefin.health - a.players[1].hp;
    expect(lost(glass)).toBeCloseTo(lost(plain) * MUTATOR_RULES.glassDamage);
  });
  it("turbo halves skill cooldowns and speeds up the meter", () => {
    const a = duel(["turbo"]);
    const p = a.players[0];
    p.lastInput = { ...p.lastInput, skill: 0, aimX: 1500, aimY: 450 };
    a.tick();
    const skill = CHARACTERS.voltkit.skills[0];
    expect(p.cooldowns[0]).toBeGreaterThan(a.time + 0.5);
    expect(p.cooldowns[0] - a.time).toBeLessThanOrEqual(
      skill.cooldown * MUTATOR_RULES.turboCooldown + 0.05,
    );
    p.ult = 0;
    a.chargeUlt(p, 10);
    expect(p.ult).toBeCloseTo(10 * MUTATOR_RULES.turboUlt);
  });
  it("orb rain doubles orbs; calm court stays on the Stone Court", () => {
    const a = duel(["orbs"]);
    tick(a, RULES.orbFirst / 2 + 0.2);
    expect(a.orbs).toHaveLength(1);
    const calm = new Arena("CALM");
    calm.rotateArenas = true;
    calm.mutators = new Set(["calm"]);
    calm.add("a", "A");
    calm.add("b", "B");
    for (let i = 0; i < 4; i++) {
      calm.start();
      expect(calm.arenaId).toBe("classic");
    }
  });
});
describe("crown hill and team-ups", () => {
  it("a side alone in the crown circle long enough takes the round", async () => {
    const { CROWN } = await import("@arena/shared");
    const a = duel(["crown"]);
    const [one, two] = a.players;
    Object.assign(one, { x: CROWN.x - 110, y: CROWN.y });
    Object.assign(two, { x: 1500, y: 450 });
    tick(a, CROWN.holdSeconds / 2);
    expect(a.crown[0]).toBeGreaterThan(CROWN.holdSeconds / 2 - 0.2);
    // Contested: nobody gains.
    Object.assign(two, { x: CROWN.x + 110, y: CROWN.y });
    const held = a.crown[0];
    tick(a, 2);
    expect(a.crown[0]).toBeCloseTo(held, 5);
    Object.assign(two, { x: 1500, y: 450 });
    tick(a, CROWN.holdSeconds / 2 + 0.5);
    expect(a.phase).toBe("intermission");
    expect(a.roundWinner).toBe("one");
    expect(a.snapshot().crown).toBeDefined();
    expect(duel().snapshot().crown).toBeUndefined();
  });
  it("2v2 partners side by side hit harder", async () => {
    const { TEAMUP } = await import("@arena/shared");
    const t = new Arena("TU", "teams");
    ["a", "b", "c", "d"].forEach((id) => t.add(id, id, "voltkit"));
    t.start();
    t.phase = "playing";
    const [a, b, c] = t.players; // a & c are partners (Blue)
    Object.assign(c, { x: a.x, y: a.y + 100 });
    const before = b.hp;
    t.damage(b, 20, "a", CHARACTERS.voltkit.basic);
    const together = before - b.hp;
    Object.assign(c, { x: a.x + TEAMUP.range + 200, y: a.y });
    const mid = b.hp;
    t.damage(b, 20, "a", CHARACTERS.voltkit.basic);
    const apart = mid - b.hp;
    expect(together).toBeCloseTo(apart * TEAMUP.damage, 5);
  });
});
describe("fun party rules", () => {
  it("fighter roulette deals random fighters each round, skips rites, restores picks", () => {
    const a = new Arena("ROULETTE-SEED");
    a.mutators = new Set(["random"] as never[]);
    a.add("one", "One", "voltkit");
    a.add("two", "Two", "voltkit");
    a.start();
    const seen = new Set<string>();
    for (let r = 0; r < 6; r++) {
      for (const p of a.players) {
        seen.add(p.character);
        expect(p.hp).toBe(CHARACTERS[p.character].health);
      }
      a.phase = "playing";
      a.endRound(r % 2 === 0 ? 0 : null);
      expect(a.players.every((p) => !p.riteOffer)).toBe(true);
      a.resetRound();
    }
    expect(seen.size).toBeGreaterThan(2);
    a.restoreChosen();
    expect(a.players.map((p) => p.character)).toEqual(["voltkit", "voltkit"]);
  });
  it("double time makes fighters run faster, on server and in prediction alike", async () => {
    const shared = await import("@arena/shared");
    const run = (scale: number) => {
      shared.useSpeedScale(scale);
      const a = new Arena("RUN");
      a.add("one", "One", "voltkit");
      const p = a.players[0];
      Object.assign(p, { x: 300, y: 450, vx: 0, vy: 0 });
      for (let i = 0; i < 30; i++)
        shared.advanceMovement(
          p,
          { ...shared.blankInput(), dx: 1, aimX: 1600, aimY: 450 },
          1 / 30,
          i / 30,
        );
      return p.x - 300;
    };
    const normal = run(1),
      fast = run(MUTATOR_RULES.speed);
    shared.useSpeedScale(1);
    expect(fast / normal).toBeGreaterThan(1.4);
    // Each arena applies its own rule every tick (rooms share the module).
    const travel = (rules: string[]) => {
      const a = duel(rules);
      const p = a.players[0];
      Object.assign(p, { x: 300, y: 450, vx: 0, vy: 0 });
      a.submit(p, { ...p.lastInput, seq: 99, dx: 1, dy: 0, aimX: 1600, aimY: 450 });
      for (let i = 0; i < 15; i++) a.tick();
      return p.x - 300;
    };
    expect(travel(["speed"]) / travel([])).toBeGreaterThan(1.4);
  });
});
describe("element team-ups", () => {
  async function pair(a: string, c: string) {
    const t = new Arena("GIFT", "teams");
    t.add("a", "A", a as never);
    t.add("b", "B", "voltkit");
    t.add("c", "C", c as never);
    t.add("d", "D", "voltkit");
    t.start();
    t.phase = "playing";
    t.deadline = t.time + RULES.roundSeconds;
    const [pa, , pc] = t.players;
    Object.assign(pc, { x: pa.x, y: pa.y + 100 });
    return t;
  }
  it("a Tidefin partner heals you while you stand together", async () => {
    const t = await pair("voltkit", "tidefin");
    const me = t.players[0];
    me.hp = 50;
    for (let i = 0; i < 30; i++) t.tick();
    expect(me.hp).toBeGreaterThan(51.5);
    expect(me.hp).toBeLessThan(52.5);
  });
  it("an Auralynx partner softens hits on you; a Cindrake partner sharpens yours", async () => {
    const shield = await pair("voltkit", "auralynx"),
      plain = await pair("voltkit", "voltkit");
    for (const t of [shield, plain]) t.damage(t.players[0], 20, "b", CHARACTERS.voltkit.basic);
    const lost = (t: Arena) => CHARACTERS.voltkit.health - t.players[0].hp;
    expect(lost(shield)).toBeCloseTo(lost(plain) * 0.92, 5);
    const fire = await pair("voltkit", "cindrake");
    const victim = fire.players[1];
    fire.damage(victim, 20, "a", CHARACTERS.voltkit.basic);
    const plain2 = await pair("voltkit", "voltkit");
    plain2.damage(plain2.players[1], 20, "a", CHARACTERS.voltkit.basic);
    const dealt = (t: Arena) => CHARACTERS.voltkit.health - t.players[1].hp;
    expect(dealt(fire)).toBeCloseTo(dealt(plain2) * 1.06, 5);
  });
  it("gifts only work side by side", async () => {
    const t = await pair("voltkit", "tidefin");
    const [me, , partner] = t.players;
    partner.x = me.x + 900;
    me.hp = 50;
    for (let i = 0; i < 30; i++) t.tick();
    expect(me.hp).toBe(50);
  });
});
