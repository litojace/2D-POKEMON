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
  EASY_DAZE_GAP,
  RAID_BOT_PROFILES,
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
    const raid = RAID_BOT_PROFILES.normal;
    const b = brain("A", { raidDazeBy: { cindrake: 1 }, dazeBy: {} }, raid);
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
    const awake = brain("A", { raidDazeBy: {}, dazeBy: {}, rest: 0 }, raid);
    expect(awake.think(arena, p).basic).toBe(true);
    // Easy (Spire Echoes on the early floors) is never dazed in a raid,
    // whatever its PvP lapses: a level without raidDazeBy keeps none.
    const echo = brain(
      "A",
      { dazeBy: { cindrake: 1 }, rest: 0, raidDazeBy: undefined },
      RAID_BOT_PROFILES.easy,
    );
    expect(echo.think(arena, p).basic).toBe(true);
  });

  it("elsewhere a dazed second is a lapse: it keeps moving but attacks nothing", () => {
    const { arena, p } = duel("cindrake", 600, "voltkit", 700);
    const b = brain("A", { daze: 1, dazeBy: {}, skillUse: 1 });
    let moved = 0;
    for (let i = 0; i < 10; i++) {
      arena.time += 1 / RULES.tick;
      const input = b.think(arena, p);
      expect([input.basic, input.skill ?? -1, input.dash, input.jump]).toEqual([
        false,
        -1,
        false,
        false,
      ]);
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

  it("calibrates Normal for every champion; Easy lapses less; Hard never", () => {
    const by = BOT_PROFILES.normal.dazeBy ?? {};
    const [n, h] = [BOT_PROFILES.normal, BOT_PROFILES.hard];
    for (const id of FIGHTER_IDS) {
      expect(by[id], id).toBeGreaterThanOrEqual(0);
      expect(by[id], id).toBeLessThanOrEqual(0.7);
    }
    // Hard is never dazed. Easy lapses 0.25 less than Normal (so only with
    // brawlers): it is weaker for being slower and looser, not switched off.
    expect(BOT_PROFILES.hard.daze ?? 0).toBe(0);
    expect(BOT_PROFILES.hard.dazeBy).toBeUndefined();
    const easy = BOT_PROFILES.easy.dazeBy ?? {};
    for (const id of FIGHTER_IDS)
      expect(easy[id] ?? 0, id).toBeCloseTo(
        Math.max(0, (by[id] ?? 0) - EASY_DAZE_GAP),
        3,
      );
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
    const raid = RAID_BOT_PROFILES.normal.raidDazeBy ?? {};
    // RAID_DAZE_BY first, then Normal's duel daze from before the smarter
    // bots (Duskveil and Mossloth were never in RAID_DAZE_BY).
    for (const [id, d] of Object.entries(RAID_DAZE_BY))
      expect(raid[id as keyof typeof raid], id).toBe(d);
    expect(raid.duskveil).toBe(0.27);
    expect(raid.mossloth).toBe(0.475);
    expect(RAID_BOT_PROFILES.easy.raidDazeBy).toBeUndefined();
    expect(RAID_BOT_PROFILES.hard.raidDazeBy).toBeUndefined();
  });

  it("plays raids and the Spire with the levels they were tuned with", () => {
    // The second round of smarter bots changed PvP only (docs/smarter-bots.md).
    for (const level of ["easy", "normal", "hard"] as const) {
      const { arena, p } = duel("cindrake", 600, "voltkit", 700);
      const pvp = new BotBrain("A", level, 3);
      pvp.think(arena, p);
      expect(pvp.profile, level).toBe(BOT_PROFILES[level]);
      arena.mode = "raid";
      const raid = new BotBrain("A", level, 3);
      raid.think(arena, p);
      expect(raid.profile, level).toBe(RAID_BOT_PROFILES[level]);
    }
    // Each PvP level is sharper than the one raids keep.
    for (const level of ["easy", "normal", "hard"] as const) {
      const [now, before] = [BOT_PROFILES[level], RAID_BOT_PROFILES[level]];
      expect(now.reaction, level).toBeLessThan(before.reaction);
      expect(now.aimError, level).toBeLessThan(before.aimError);
      expect(now.dodge, level).toBeGreaterThan(before.dodge);
      expect(now.rest, level).toBeLessThan(before.rest);
    }
  });

  it("leads a jinking opponent by how it moved lately, not its last step", () => {
    // Voltkit (a shooter) at A; the opponent runs up for a while, then jinks
    // down for an instant. A steady lead still aims up the way it went.
    const aimAt = (steadyLead: boolean) => {
      const { arena, p, q } = duel("voltkit", 300, "cindrake", 800);
      const b = brain(
        "A",
        {
          steadyLead,
          aimError: 0,
          reaction: 0.1,
          lead: 1,
          skillUse: 0,
          dazeBy: {},
        },
        BOT_PROFILES.hard,
      );
      let input = blankInput();
      for (let i = 0; i < 24; i++) {
        arena.time += 1 / RULES.tick;
        const jink = i >= 18;
        q.vy = jink ? 300 : -300;
        q.y += q.vy / RULES.tick;
        input = b.think(arena, p);
      }
      return input.aimY - q.y;
    };
    // Without it the bot leads the jink (down, +y); with it, up the court.
    expect(aimAt(false)).toBeGreaterThan(0);
    expect(aimAt(true)).toBeLessThan(aimAt(false));
  });
});
