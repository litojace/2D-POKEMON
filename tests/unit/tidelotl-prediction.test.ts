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
import { TIDEWYRM } from "../../packages/shared/src/raid";
import { heldInput } from "../../packages/shared/src/tidelotl-drift";

/**
 * Tidelotl moves you on the server every tick before your input does: the
 * Undertow pulls, a Bubble Prison carries you, a bubble roots you. The
 * phone predicts the same (stepRaidCarry), so from one snapshot the
 * predicted fighter and the server's stay together tick for tick; without
 * it they drift apart and every snapshot pulls you back (26 Nov 2026).
 */
function raid(variant?: "ascendant") {
  const a = createRaidArena("TIDEPR", "tidewyrm", { variant }) as RaidArena;
  a.add("me", "Me", "pyranda");
  a.add("mate", "Mate", "voltkit");
  a.start();
  a.phase = "playing";
  // No attacks of its own: each test sets up the one mechanic it checks.
  const inner = a as unknown as { started: boolean; nextAttack: number };
  inner.started = true;
  inner.nextAttack = Infinity;
  const me = a.players.find((p) => p.id === "me")!;
  me.x = 640;
  me.y = 420;
  return { a, me };
}
/** Walking on, turning now and then (as a thumb does). */
const walk = (i: number, seq: number): Input => ({
  ...blankInput(),
  seq,
  dx: Math.cos(i / 4),
  dy: Math.sin(i / 4),
  aimX: 900,
  aimY: 300,
});
/**
 * Ten ticks from one snapshot, on the server and in the phone's
 * prediction: the gap between them after each (px).
 */
function follow(
  a: RaidArena,
  me: Fighter,
  carry: boolean,
  ticks = 10,
): number[] {
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
  const gaps: number[] = [];
  for (let i = 1; i <= ticks; i++) {
    const input = walk(i, me.ack + 1);
    a.enqueue(me, input);
    a.drainInputs();
    for (const p of a.players) if (!p.raidBoss) p.hp = Math.max(p.hp, 50);
    a.tick();
    const time = snapshot.time + i / RULES.tick;
    predictFighter(local, stepRaidCarry(local, plan, input, time), time, true);
    gaps.push(Math.hypot(local.x - me.x, local.y - me.y));
  }
  return gaps;
}

describe("the phone predicts what Tidelotl does to you", () => {
  it.each([
    ["the Undertow", undefined],
    ["the Rip Current Undertow (it pulls harder)", "rip-current"],
  ] as const)("%s", (_, trait) => {
    for (const carry of [true, false]) {
      const { a, me } = raid();
      if (trait) a.raid.trait = trait;
      a.raid.undertow = {
        x: 900,
        y: 450,
        until: a.time + TIDEWYRM.undertow.seconds,
        radius: TIDEWYRM.undertow.centreRadius,
      };
      const gaps = follow(a, me, carry);
      if (carry) expect(Math.max(...gaps)).toBeLessThan(0.01);
      // Left out, a round trip of replay (about 4 ticks) misses ~19 px.
      else expect(Math.max(...gaps)).toBeGreaterThan(15);
    }
  });
  it("a Bubble Prison: carried to the boss's mouth, your input ignored", () => {
    for (const carry of [true, false]) {
      const { a, me } = raid();
      a.raid.prisons = [
        {
          playerId: me.id,
          x: me.x,
          y: me.y,
          hits: 0,
          presses: 0,
          until: a.time + 2,
          startedAt: a.time,
        },
      ];
      const gaps = follow(a, me, carry);
      if (carry) expect(Math.max(...gaps)).toBeLessThan(0.01);
      else expect(Math.max(...gaps)).toBeGreaterThan(15);
    }
  });
  it("a bubble's root: you stand still until it lets go", () => {
    for (const carry of [true, false]) {
      const { a, me } = raid();
      a.raid.rooted = { [me.id]: a.time + 5 / RULES.tick };
      const gaps = follow(a, me, carry);
      // Rooted for five ticks, then walking again: the same either side.
      if (carry) expect(Math.max(...gaps)).toBeLessThan(0.01);
      else expect(Math.max(...gaps)).toBeGreaterThan(15);
    }
  });
  it("the ascendant Tidelotl's Undertow too", () => {
    const { a, me } = raid("ascendant");
    a.raid.undertow = {
      x: 380,
      y: 300,
      until: a.time + TIDEWYRM.undertow.seconds,
      radius: TIDEWYRM.undertow.centreRadius,
    };
    expect(Math.max(...follow(a, me, true))).toBeLessThan(0.01);
  });
  it("a late input for a tick the server held only moves you", () => {
    const { a, me } = raid();
    a.raid.undertow = { x: 900, y: 450, until: a.time + 3, radius: 75 };
    const snapshot = structuredClone(a.snapshot(0));
    const plan = raidCarry(me, snapshot.raid, undefined, snapshot.time)!;
    const p = structuredClone(me);
    const input = walk(1, 1);
    // At or before the snapshot: its pull is in the snapshot already.
    expect(stepRaidCarry(p, plan, input, snapshot.time)).toBe(input);
    expect([p.x, p.y]).toEqual([me.x, me.y]);
    // Sealed, even a held step runs no input.
    const sealed = {
      ...plan,
      prison: { x: me.x, y: me.y, until: snapshot.time + 2 },
    };
    expect(stepRaidCarry(p, sealed, input, snapshot.time)).toEqual(
      heldInput(input, true),
    );
  });
  it("nothing to carry outside Tidelotl's mechanics", () => {
    const { a, me } = raid();
    expect(raidCarry(me, a.raid, undefined, a.time)).toBeUndefined();
    expect(raidCarry(me, undefined, undefined, 0)).toBeUndefined();
  });
});
