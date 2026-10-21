import { describe, it, expect } from "vitest";
import { ArcadeArena } from "../../apps/server/src/arcade";
import { Arena } from "../../apps/server/src/simulation";
import { ARCADE_IDS } from "../../packages/shared/src/arcade";
import { blankInput, CHARACTERS } from "@arena/shared";
const setup = (id = ARCADE_IDS[0]) => {
  const a = new ArcadeArena("ARCADE", id, "2026-10-19");
  a.add("a", "A", "voltkit");
  a.add("b", "B", "terradon");
  a.start();
  a.phase = "playing";
  a.deadline = 180;
  a.hazardClock = a.time;
  return a;
};
const run = (a: Arena, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 30); i++) a.tick();
};
describe("weekly arcade", () => {
  it.each(ARCADE_IDS)(
    "keeps %s rules and snapshots through a rematch",
    (id) => {
      const a = setup(id);
      expect(a.roundsToWin).toBe(2);
      expect(a.snapshot().arcade?.id).toBe(id);
      a.start();
      expect(a.arcade.id).toBe(id);
      expect(a.arenaId).toBe("conductor-ring");
      expect(a.walls()).toEqual([]);
    },
  );
  it("moves the hill every fifteen seconds and scores only uncontested occupancy", () => {
    const a = setup("crown-chase"),
      h = a.crownZone;
    a.players[0].x = h.x;
    a.players[0].y = h.y;
    run(a, 1);
    expect(a.crown[0]).toBeCloseTo(1);
    Object.assign(a.players[1], h);
    run(a, 0.5);
    expect(a.crown[0]).toBeCloseTo(1);
    a.time = 15;
    expect(a.crownZone.x).not.toBe(h.x);
    expect(a.snapshot().arcade!.hill!.target).toBe(18);
  });
  it("wins by following the hill for eighteen seconds rather than requiring a knockout", () => {
    const a = setup("crown-chase");
    for (let i = 0; i < 550 && a.phase === "playing"; i++) {
      Object.assign(a.players[0], { x: a.crownZone.x, y: a.crownZone.y });
      a.players[1].x = 1500;
      a.players[1].y = 100;
      a.tick();
    }
    expect(a.roundWinnerTeam).toBe(0);
    expect(a.players[1].hp).toBeGreaterThan(0);
  });
  it("telegraphs meteors before damage and lets jumping players avoid the impact", () => {
    const a = setup("meteor-mayhem");
    a.tick();
    expect(a.arcade.meteors!.length).toBe(2);
    const m = a.arcade.meteors![0];
    a.arcade.meteors = [m];
    (a as any).nextMeteor = Infinity;
    Object.assign(a.players[0], { x: m.x, y: m.y });
    Object.assign(a.players[1], { x: m.x, y: m.y, jumpUntil: 10 });
    const hp = a.players.map((p) => p.hp);
    run(a, 1);
    expect(a.players.map((p) => p.hp)).toEqual(hp);
    run(a, 0.4);
    expect(a.players[0].hp).toBe(hp[0] - 28);
    expect(a.players[1].hp).toBe(hp[1]);
    expect(a.events.some((e) => e.kind === "raid-impact")).toBe(true);
  });
  it("freezes meteor countdowns during a reconnect pause and clears them between rounds", () => {
    const a = setup("meteor-mayhem");
    a.tick();
    a.phase = "paused";
    const before = JSON.stringify(a.arcade.meteors),
      t = a.time;
    run(a, 3);
    expect(a.time).toBe(t);
    expect(JSON.stringify(a.arcade.meteors)).toBe(before);
    a.resetRound();
    expect(a.arcade.meteors).toEqual([]);
  });
  it("charges the ultimate four times faster without changing health or attack damage", () => {
    const a = setup("ultimate-overload"),
      p = a.players[0];
    expect(p.hp).toBe(CHARACTERS.voltkit.health);
    a.chargeUlt(p, 10);
    expect(p.ult).toBe(40);
    expect(CHARACTERS.voltkit.basic.damage).toBe(6);
  });
  it("lets stand-ins chase the hill and escape marked meteors", () => {
    const a = setup("crown-chase"),
      p = a.players[0];
    const input = a.botInput(p, blankInput());
    expect(Math.hypot(input.dx, input.dy)).toBeCloseTo(1);
    a.arcade.meteors = [{ id: 1, x: p.x, y: p.y, radius: 95, at: a.time + 1 }];
    expect(a.botInput(p, blankInput()).dx).toBeGreaterThan(0);
  });
  it("records participation only from live inputs and resets it for a new match", () => {
    const a = setup();
    a.submit(a.players[0], { ...blankInput(), seq: 1 });
    expect(a.engaged.size).toBe(0);
    a.submit(a.players[0], { ...blankInput(), seq: 2, dx: 1 });
    expect(a.engaged.has("a")).toBe(true);
    a.start();
    expect(a.engaged.size).toBe(0);
  });
});
