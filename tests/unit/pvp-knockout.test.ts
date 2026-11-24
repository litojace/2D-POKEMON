import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { CHARACTERS, RULES, blankInput } from "../../packages/shared/src/index";
import { predictFighter } from "../../apps/client/src/predict-fighter";
import { PvpSpectator } from "../../apps/client/src/pvp-spectator";

function playing(mode: "ffa" | "teams" | "duel" = "ffa") {
  const a = new Arena("PVP123", mode);
  for (let i = 0; i < (mode === "duel" ? 2 : 4); i++)
    a.add(`p${i}`, `Player ${i}`);
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 90;
  return a;
}
const attack = (seq: number) => ({
  ...blankInput(),
  seq,
  dx: 1,
  dy: 1,
  basic: true,
  skill: 0,
  dash: true,
  jump: true,
  aimX: 1400,
  aimY: 700,
});

describe("knocked-out PvP participants", () => {
  it.each(["ffa", "teams", "duel"] as const)(
    "cannot move, dash, jump, cast or heal themselves after a knockout in %s",
    (mode) => {
      const a = playing(mode),
        p = a.players[0];
      p.ult = RULES.ultMax;
      a.submit(p, attack(1));
      p.dashUntil = a.time + 2;
      p.jumpUntil = a.time + 2;
      p.vx = 200;
      a.damage(p, 99999, a.players[1].id);
      expect(p.hp).toBe(0);
      const pos = [p.x, p.y],
        eventId = a.events.at(-1)?.id ?? 0;
      for (let i = 2; i < 20; i++) {
        a.submit(p, attack(i));
        a.cast(p, CHARACTERS.voltkit.skills[0]);
        a.tick();
      }
      expect([p.x, p.y]).toEqual(pos);
      expect([p.vx, p.vy, p.dashUntil, p.jumpUntil]).toEqual([0, 0, 0, 0]);
      expect(p.charge).toBeUndefined();
      expect(p.channel).toBeUndefined();
      expect(p.hp).toBe(0);
      expect(
        a.events.filter(
          (e) => e.id > eventId && e.kind === "cast" && e.owner === p.id,
        ),
      ).toEqual([]);
      expect(a.projectiles.filter((shot) => shot.owner === p.id)).toEqual([]);
    },
  );
  it("cancels a queued cast when burn kills the caster during the tick", () => {
    const a = playing(),
      p = a.players[0];
    p.hp = 1;
    p.statuses = [
      { kind: "burn", until: a.time + 10, nextTick: a.time, by: "p1" },
    ];
    a.submit(p, attack(1));
    const pos = [p.x, p.y];
    a.tick();
    expect(p.hp).toBe(0);
    expect([p.x, p.y]).toEqual(pos);
    expect(a.events.some((e) => e.kind === "cast" && e.owner === p.id)).toBe(
      false,
    );
  });
  it("stops phone prediction immediately but retains raid crawling and next-round movement", () => {
    const a = playing(),
      p = a.players[0];
    p.hp = 0;
    const pos = [p.x, p.y];
    predictFighter(p, attack(1), a.time, false);
    expect([p.x, p.y]).toEqual(pos);
    predictFighter(p, attack(2), a.time, true);
    expect([p.x, p.y]).not.toEqual(pos);
    expect(p.dashUntil).toBe(0);
    p.out = true;
    const down = [p.x, p.y];
    predictFighter(p, attack(3), a.time, true);
    expect([p.x, p.y]).toEqual(down);
    p.out = false;
    p.hp = 100;
    predictFighter(p, attack(4), a.time, false);
    expect(p.dashUntil).toBeGreaterThan(a.time);
  });
});

describe("eliminated participant camera", () => {
  it("switches between survivors, replaces dead targets, and resets next round", () => {
    const a = playing(),
      spectator = new PvpSpectator();
    a.players[0].hp = 0;
    const state = () => a.snapshot();
    expect(spectator.target(state(), "p0")?.id).toBe("p1");
    spectator.cycle(state(), "p0", 1);
    expect(spectator.target(state(), "p0")?.id).toBe("p2");
    a.players[2].hp = 0;
    expect(spectator.target(state(), "p0")?.id).toBe("p1");
    spectator.cycle(state(), "p0", -1);
    expect(spectator.target(state(), "p0")?.id).toBe("p3");
    a.round++;
    expect(spectator.target(state(), "p0")?.id).toBe("p1");
    a.players[0].hp = 100;
    expect(spectator.target(state(), "p0")).toBeUndefined();
  });
  it("prioritises a living teammate and excludes leavers", () => {
    const a = playing("teams"),
      spectator = new PvpSpectator();
    a.players[0].hp = 0;
    expect(spectator.target(a.snapshot(), "p0")?.team).toBe(a.players[0].team);
    expect(spectator.candidates(a.snapshot(), "p0")).toHaveLength(1);
    const ally = a.players.find(
      (p) => p.id !== "p0" && p.team === a.players[0].team,
    )!;
    ally.out = true;
    expect(spectator.candidates(a.snapshot(), "p0")).toHaveLength(2);
  });
});
