import { describe, expect, it } from "vitest";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import type { RaidArena } from "../../apps/server/src/raid";
import {
  predictFighter,
  raidCarry,
  stepRaidCarry,
} from "../../apps/client/src/predict-fighter";
import {
  RULES,
  blankInput,
  type Fighter,
  type Input,
} from "../../packages/shared/src/index";
import {
  ASCENDANT_LUMIWICK,
  EMBERWING,
  type RaidWarning,
} from "../../packages/shared/src/raid";

/**
 * Lumiwick's Wing Gust (and the ascendant's Snuffing Gale) blow you 220
 * (140) px in the tick they land, on a warning the snapshot already shows.
 * The phone lands them in the same tick (stepRaidCarry), so from one
 * snapshot the predicted fighter and the server's stay together; without
 * it the snapshot after the blow jumped you (26 Nov 2026).
 */
function raid(variant?: "ascendant") {
  const a = createRaidArena("LUMIPR", "emberwing", { variant }) as RaidArena;
  a.add("me", "Me", "pyranda");
  a.add("mate", "Mate", "voltkit");
  a.start();
  a.phase = "playing";
  const inner = a as unknown as {
    started: boolean;
    nextAttack: number;
    warn(
      kind: string,
      x: number,
      y: number,
      tx: number,
      ty: number,
      radius: number,
      delay: number,
    ): RaidWarning;
  };
  inner.started = true;
  inner.nextAttack = Infinity;
  const boss = a.players.find((p) => p.raidBoss)!;
  boss.x = 800;
  boss.y = 250;
  const me = a.players.find((p) => p.id === "me")!;
  me.x = 800;
  me.y = 480;
  const mate = a.players.find((p) => p.id === "mate")!;
  mate.x = 300;
  mate.y = 700;
  // The server's own warning, landing three ticks from now. It was warned
  // two seconds ago, so the telegraph floor (settleWarnings, once, as it is
  // made) leaves its time alone, as it does by the time a snapshot shows it.
  const warn = (...args: Parameters<typeof inner.warn>) => {
    const w = inner.warn.call(a, ...args);
    w.startedAt = a.time - 2;
    w.at = a.time + 3 / RULES.tick;
    return w;
  };
  return { a, me, boss, warn };
}
const walk = (i: number, seq: number, dash = false): Input => ({
  ...blankInput(),
  seq,
  dx: Math.cos(i / 5) * 0.3,
  dy: -1,
  dash,
  aimX: 800,
  aimY: 250,
});
/** Ten ticks from one snapshot, server and prediction: the gap after each. */
function follow(
  a: RaidArena,
  me: Fighter,
  carry: boolean,
  input: (i: number, seq: number) => Input = walk,
) {
  const snapshot = structuredClone(a.snapshot(0));
  const server = snapshot.players.find((p) => p.id === "me")!;
  const local = structuredClone(server);
  const plan = carry
    ? raidCarry(
        server,
        snapshot.raid,
        snapshot.players.find((p) => p.raidBoss),
        snapshot.time,
      )
    : undefined;
  const startY = me.y;
  const gaps: number[] = [];
  for (let i = 1; i <= 10; i++) {
    const step = input(i, me.ack + 1);
    a.enqueue(me, step);
    a.drainInputs();
    for (const p of a.players) if (!p.raidBoss) p.hp = Math.max(p.hp, 50);
    a.tick();
    const time = snapshot.time + i / RULES.tick;
    predictFighter(local, stepRaidCarry(local, plan, step, time), time, true);
    gaps.push(Math.hypot(local.x - me.x, local.y - me.y));
  }
  // Down the court, away from the boss (the way both blows go here); you
  // walk (or dash) the other way.
  return { gaps, away: me.y - startY };
}

describe("the phone lands Lumiwick's blows when the server does", () => {
  it("a Wing Gust blows you down its cone", () => {
    for (const carry of [true, false]) {
      const { a, me, boss, warn } = raid();
      const w = warn(
        "wing-gust",
        boss.x,
        boss.y,
        me.x,
        me.y,
        EMBERWING.gust.radius,
        3 / RULES.tick,
      );
      w.spread = EMBERWING.gust.spread;
      const { gaps, away } = follow(a, me, carry);
      expect(away).toBeGreaterThan(100);
      if (carry) expect(Math.max(...gaps)).toBeLessThan(0.01);
      else expect(Math.max(...gaps)).toBeGreaterThan(150);
    }
  });
  it("dashing into the wind holds you: the phone does not blow you either", () => {
    const { a, me, boss, warn } = raid();
    const w = warn(
      "wing-gust",
      boss.x,
      boss.y,
      me.x,
      me.y,
      EMBERWING.gust.radius,
      3 / RULES.tick,
    );
    w.spread = EMBERWING.gust.spread;
    // Dash toward the boss (into the gust) just before it lands.
    const { gaps, away } = follow(a, me, true, (i, seq) =>
      walk(i, seq, i === 2),
    );
    expect(away).toBeLessThan(0);
    expect(Math.max(...gaps)).toBeLessThan(0.01);
  });
  it("outside the cone nothing happens on either side", () => {
    const { a, me, boss, warn } = raid();
    const w = warn(
      "wing-gust",
      boss.x,
      boss.y,
      boss.x + 600,
      boss.y,
      EMBERWING.gust.radius,
      3 / RULES.tick,
    );
    w.spread = EMBERWING.gust.spread;
    const { gaps, away } = follow(a, me, true);
    expect(away).toBeLessThan(0);
    expect(Math.max(...gaps)).toBeLessThan(0.01);
  });
  it("a staggered Lumiwick lands nothing until it recovers", () => {
    const { a, me, boss, warn } = raid();
    const w = warn(
      "wing-gust",
      boss.x,
      boss.y,
      me.x,
      me.y,
      EMBERWING.gust.radius,
      3 / RULES.tick,
    );
    w.spread = EMBERWING.gust.spread;
    a.raid.staggerUntil = a.time + 1;
    const { gaps, away } = follow(a, me, true);
    expect(away).toBeLessThan(0);
    expect(Math.max(...gaps)).toBeLessThan(0.01);
  });
  it("the ascendant's Snuffing Gale blows you down its lane", () => {
    for (const carry of [true, false]) {
      const { a, me, boss, warn } = raid("ascendant");
      a.raid.braziers = (a.raid.braziers ?? []).map((b) => ({
        ...b,
        x: 100,
        y: 100,
      }));
      warn(
        "snuff-gale",
        boss.x,
        boss.y,
        me.x,
        me.y + 200,
        ASCENDANT_LUMIWICK.gale.width,
        3 / RULES.tick,
      );
      const { gaps, away } = follow(a, me, carry);
      expect(away).toBeGreaterThan(40);
      if (carry) expect(Math.max(...gaps)).toBeLessThan(0.01);
      else expect(Math.max(...gaps)).toBeGreaterThan(100);
    }
  });
  it("a brazier's ring shelters you from the Gale, on both sides", () => {
    const { a, me, boss, warn } = raid("ascendant");
    const ring = a.raid.braziers?.[0];
    expect(ring).toBeDefined();
    ring!.x = me.x;
    ring!.y = me.y;
    warn(
      "snuff-gale",
      boss.x,
      boss.y,
      me.x,
      me.y + 200,
      ASCENDANT_LUMIWICK.gale.width,
      3 / RULES.tick,
    );
    const { gaps, away } = follow(a, me, true, (i, seq) => ({
      ...walk(i, seq),
      dx: 0,
      dy: 0,
    }));
    expect(Math.abs(away)).toBeLessThan(20);
    expect(Math.max(...gaps)).toBeLessThan(0.01);
  });
});
