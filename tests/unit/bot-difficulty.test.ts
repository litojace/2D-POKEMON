import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  FIGHTER_IDS,
  RULES,
  blankInput,
  type Fighter,
} from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
import {
  BOT_PROFILES,
  BotBrain,
  RAID_DAZE_BY,
} from "../../apps/server/src/bot";

/** A duel mid-round on open ground (y = 820), placed by hand. */
function duel(a: string, ax: number, b: string, bx: number) {
  const arena = new Arena("T");
  arena.add("A", "A", a as never);
  arena.add("B", "B", b as never);
  arena.start();
  arena.phase = "playing";
  arena.deadline = 999;
  const [p, q] = arena.players;
  Object.assign(p, { x: ax, y: 820, vx: 0, vy: 0 });
  Object.assign(q, { x: bx, y: 820, vx: 0, vy: 0 });
  return { arena, p, q };
}
/** A brain with its profile changed (tests only). */
function brain(id: string, change: object, base = BOT_PROFILES.normal) {
  const b = new BotBrain(id, "normal", 3);
  Object.assign(b, { profile: { ...base, ...change } });
  return b;
}
/** B (Voltkit) fires its basic at A; ticks until the shot is close. */
function incoming(arena: Arena, p: Fighter, q: Fighter) {
  q.lastInput = { ...blankInput(), aimX: p.x, aimY: p.y };
  q.angle = Math.atan2(p.y - q.y, p.x - q.x);
  arena.cast(q, CHARACTERS.voltkit.basic);
  for (let i = 0; i < 30 && arena.projectiles.length; i++) {
    arena.tick();
    const shot = arena.projectiles[0];
    if (shot && Math.hypot(shot.x - p.x, shot.y - p.y) < 380) return;
  }
  throw new Error("the shot never came close");
}

describe("bot difficulty", () => {
  it("sees a shot coming even when it will not dodge it, and shields", () => {
    // Mystowl's Wing Cloak (skill slot 2) is a barrier. The opponent stands out of
    // reach of its attacking skills, so only a threat makes it worth casting.
    for (const seeShots of [true, false]) {
      const { arena, p, q } = duel("mystowl", 200, "voltkit", 900);
      incoming(arena, p, q);
      const b = brain("A", { dodge: 0, skillUse: 1, seeShots, dazeBy: {} });
      // It casts it on the spot: the input carries the skill.
      expect(b.think(arena, p).skill ?? -1, `seeShots ${seeShots}`).toBe(
        seeShots ? 2 : -1,
      );
    }
  });

  it("in raids, does nothing at all in a dazed second", () => {
    const { arena, p } = duel("cindrake", 600, "voltkit", 700);
    // Raid mode (stand-ins, Spire Echoes) keeps the old daze, from raidDazeBy.
    arena.mode = "raid";
    const b = brain("A", { raidDazeBy: { cindrake: 1 }, dazeBy: {} });
    for (let i = 0; i < 10; i++) {
      arena.time += 1 / RULES.tick;
      const input = b.think(arena, p);
      expect([input.dx, input.dy, input.basic, input.skill ?? -1]).toEqual([
        0,
        0,
        false,
        -1,
      ]);
    }
    // Not dazed: the same spot gets a swing.
    const awake = brain("A", { raidDazeBy: {}, dazeBy: {}, rest: 0 });
    expect(awake.think(arena, p).basic).toBe(true);
  });

  it("elsewhere a dazed second is a lapse: it keeps moving but attacks nothing", () => {
    const { arena, p } = duel("cindrake", 600, "voltkit", 700);
    const b = brain("A", { daze: 1, dazeBy: {}, skillUse: 1 });
    let moved = 0;
    for (let i = 0; i < 10; i++) {
      arena.time += 1 / RULES.tick;
      const input = b.think(arena, p);
      expect([input.basic, input.skill ?? -1, input.dash, input.jump]).toEqual(
        [false, -1, false, false],
      );
      if (input.dx || input.dy) moved++;
    }
    expect(moved).toBe(10);
    const awake = brain("A", { daze: 0, dazeBy: {}, rest: 0 });
    expect(awake.think(arena, p).basic).toBe(true);
  });

  it("takes its own champion's daze from dazeBy", () => {
    const { arena, p } = duel("cindrake", 600, "voltkit", 700);
    const b = brain("A", { daze: 0, dazeBy: { cindrake: 1 } });
    expect(b.think(arena, p).basic).toBe(false);
    const other = brain("A", { daze: 0, dazeBy: { voltkit: 1 }, rest: 0 });
    expect(other.think(arena, p).basic).toBe(true);
  });

  it("calibrates Normal for every champion; Easy and Hard are never dazed", () => {
    const by = BOT_PROFILES.normal.dazeBy ?? {};
    const [n, h] = [BOT_PROFILES.normal, BOT_PROFILES.hard];
    for (const id of FIGHTER_IDS) {
      expect(by[id], id).toBeGreaterThanOrEqual(0);
      expect(by[id], id).toBeLessThanOrEqual(0.7);
    }
    // Easy is never dazed either: it is weaker for being slower, looser and
    // more hesitant than Normal, not for switching off.
    for (const level of ["easy", "hard"] as const) {
      expect(BOT_PROFILES[level].daze ?? 0, level).toBe(0);
      expect(BOT_PROFILES[level].dazeBy, level).toBeUndefined();
    }
    const e = BOT_PROFILES.easy;
    expect(e.reaction).toBeGreaterThan(n.reaction);
    expect(e.aimError).toBeGreaterThan(n.aimError);
    expect(e.skillUse).toBeLessThan(n.skillUse);
    expect(e.dodge).toBeLessThan(n.dodge);
    // Hard still reacts, aims and decides faster than Normal.
    expect(h.reaction).toBeLessThan(n.reaction);
    expect(h.aimError).toBeLessThan(n.aimError);
    expect(h.think).toBeLessThan(n.think);
    expect(h.dodge).toBeGreaterThan(n.dodge);
  });

  it("leaves raids on the daze they were tuned with", () => {
    const raid = BOT_PROFILES.normal.raidDazeBy ?? {};
    // RAID_DAZE_BY first, then Normal's duel daze from before the smarter
    // bots (Duskveil and Mossloth were never in RAID_DAZE_BY).
    for (const [id, d] of Object.entries(RAID_DAZE_BY))
      expect(raid[id as keyof typeof raid], id).toBe(d);
    expect(raid.duskveil).toBe(0.27);
    expect(raid.mossloth).toBe(0.475);
    expect(BOT_PROFILES.easy.raidDazeBy).toBeUndefined();
    expect(BOT_PROFILES.hard.raidDazeBy).toBeUndefined();
  });
});
