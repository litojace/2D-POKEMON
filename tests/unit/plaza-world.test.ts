import { describe, expect, it } from "vitest";
import {
  PITCH_BOTS,
  PLAZA_RETURN_MS,
  PlazaWorld,
  TOWNSFOLK,
  townsfolkFor,
} from "../../apps/server/src/plaza";
import { CHAMPION_SKIN_BY_ID } from "../../packages/shared/src/shop";
import { FIGHTER_IDS } from "../../packages/shared/src/index";
import {
  ORB_SHOWER,
  PLAZA,
  PLAZA_FLAG,
  PLAZA_PITCH,
  PLAZA_STAGE,
  PLAZA_SPOTS,
  trackPoint,
} from "../../packages/shared/src/plaza";

const profile = (name: string) => ({
  name,
  title: null,
  titleColor: null,
  level: null,
  character: "voltkit",
  skin: null,
});
const DT = 1 / PLAZA.tick;
/** 21:16 UTC: between showers. */
const QUIET = Date.parse("2026-11-02T21:16:00.000Z");
const SHOWER = Date.parse("2026-11-02T21:30:00.000Z");
const run = (world: PlazaWorld, seconds: number, from: number) => {
  const events = [];
  let now = from;
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    now += DT * 1000;
    events.push(...world.step(DT, now));
  }
  return { events, now };
};
const place = (world: PlazaWorld, key: string, x: number, y: number) => {
  const b = world.bodyOf(key)!;
  b.x = x;
  b.y = y;
};

describe("the Plaza world", () => {
  it("keeps the townsfolk, bots and ball where they were while the Plaza is empty", () => {
    const world = new PlazaWorld(() => 0.5);
    world.join("s1", "acc-1", profile("Ann"), QUIET);
    const { now } = run(world, 20, QUIET);
    const c = (world as any).copies.get(1);
    const where = () => [
      ...c.folk.map((f: any) => [f.body.x, f.body.y]),
      ...c.bots.map((b: any) => [b.body.x, b.body.y]),
      [c.ball.x, c.ball.y],
    ];
    const left = where();
    world.leave("s1", now);
    // Nobody there for five minutes: nothing moves (and nothing runs).
    run(world, 5, now + 5 * 60_000 - 5000);
    expect(where()).toEqual(left);
    // Back: the same copy, everyone where they were.
    world.join("s2", "acc-1", profile("Ann"), now + 5 * 60_000);
    expect((world as any).copies.get(1)).toBe(c);
    expect(c.emptySince).toBeNull();
    expect(where()).toEqual(left);
  });

  it("puts you back where you stood when you return within ten minutes", () => {
    const world = new PlazaWorld(() => 0.5);
    world.join("s1", "acc-1", profile("Ann"), QUIET);
    place(world, "s1", 900, 1150);
    world.leave("s1", QUIET);
    // Back a few minutes later (a new socket): the same spot.
    const back = world.join("s2", "acc-1", profile("Ann"), QUIET + 5 * 60_000);
    expect(Math.hypot(back.body.x - 900, back.body.y - 1150)).toBeLessThan(2);
    // Someone else never gets your spot.
    const other = world.join("s3", "acc-2", profile("Ben"), QUIET);
    expect(Math.abs(other.body.x - 1350)).toBeLessThan(80);
    // Too long away: by the fountain again.
    place(world, "s2", 900, 1150);
    world.leave("s2", QUIET);
    const late = world.join(
      "s4",
      "acc-1",
      profile("Ann"),
      QUIET + PLAZA_RETURN_MS,
    );
    expect(Math.abs(late.body.x - 1350)).toBeLessThan(80);
  });

  it("spawns players by the fountain, one body per account, with four pitch bots per copy", () => {
    const world = new PlazaWorld(() => 0.5);
    const a = world.join("s1", "acc-1", profile("Ann"), QUIET);
    expect(a.plaza).toBe(1);
    expect(Math.abs(a.body.x - 1350)).toBeLessThan(80);
    world.join("s2", "acc-1", profile("Ann again"), QUIET);
    expect(world.size).toBe(1);
    expect(world.plazaOf("s1")).toBeUndefined();
    place(world, "s2", 300, 1300);
    const view = world.view("s2")!;
    // Nobody else but bots (the townsfolk jog the track nearby); the pitch
    // bots are out of view.
    expect(
      view.state.walkers.filter((w) => !(w[5] & PLAZA_FLAG.bot)),
    ).toHaveLength(1);
    const pitchBot = (p: { name: string }) =>
      PITCH_BOTS.some(([name]) => name === p.name);
    expect(view.profiles.filter(pitchBot)).toHaveLength(0);
    expect(view.state.ball).toBeUndefined();
    place(world, "s2", PLAZA_PITCH.x0 - 60, 900);
    const near = world.view("s2")!;
    expect(near.profiles.filter((p) => p.bot && pitchBot(p))).toHaveLength(4);
    // NPC names, as the townsfolk have (they were "Blue Bot" and "Red Bot",
    // so the news read "Red Bot scored a goal"), each its own.
    expect(PITCH_BOTS.some(([name]) => /bot/i.test(name))).toBe(false);
    expect(new Set(PITCH_BOTS.map(([name]) => name)).size).toBe(4);
    expect(near.state.ball).toBeDefined();
    // Profiles are sent once.
    expect(world.view("s2")!.profiles).toEqual([]);
    world.leave("s2");
    expect(world.size).toBe(0);
  });

  it("fills a quiet Plaza with townsfolk who never count for anything", () => {
    // A seeded random, so the townsfolk's day is the same every run.
    let seed = 7;
    const world = new PlazaWorld(() => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    });
    world.join("s1", "acc-1", profile("Ann"), QUIET);
    const folk = () =>
      (world as any).copies.get(1).folk as {
        leaving: boolean;
        profile: { id: number; name: string; bot?: boolean };
        body: { x: number; y: number };
      }[];
    // Alone, all of them are about; each is a marked bot in a real Shop skin.
    expect(folk()).toHaveLength(TOWNSFOLK.length);
    for (const t of TOWNSFOLK) {
      expect(FIGHTER_IDS).toContain(t.character);
      if (t.skin) {
        expect(CHAMPION_SKIN_BY_ID[t.skin.skin]?.champion).toBe(t.character);
      }
      expect(t.name).not.toMatch(/\d/);
    }
    expect(folk().every((f) => f.profile.bot)).toBe(true);
    // Each runway model and runner keeps to their own side or lane.
    const runway = TOWNSFOLK.filter((t) => t.ai === "runway").map(
      (t) => t.side,
    );
    const lanes = TOWNSFOLK.filter((t) => t.ai === "track").map((t) => t.lane);
    expect(new Set(runway).size).toBe(runway.length);
    expect(new Set(lanes).size).toBe(lanes.length);
    // They move about, and nothing they do pays or makes news.
    // They walk about (all but the dancer and the café regular, who stay
    // put), and runners jump every hurdle: nobody trips.
    const walked = folk().map(() => 0);
    let trips = 0,
      now = QUIET,
      last = folk().map((f) => ({ ...f.body }));
    const events = [];
    for (let t = 0; t < 60; t += DT) {
      now += DT * 1000;
      events.push(...world.step(DT, now));
      folk().forEach((f, i) => {
        walked[i] += Math.hypot(f.body.x - last[i].x, f.body.y - last[i].y);
        trips += (f.body as { stun?: number }).stun ? 1 : 0;
      });
      last = folk().map((f) => ({ ...f.body }));
    }
    expect(trips).toBe(0);
    expect(walked.filter((d) => d > 500).length).toBe(
      TOWNSFOLK.filter((t) => t.ai !== "dance" && t.ai !== "cafe").length,
    );
    const folkIds = new Set(folk().map((f) => f.profile.id));
    expect(
      events.filter(
        (e) =>
          e.type === "lap" ||
          e.type === "cheers" ||
          e.type === "orb" ||
          e.type === "goal" ||
          (e.type === "news" && folkIds.has((e.news as { id: number }).id)),
      ),
    ).toEqual([]);
    // Only players count as the Plaza's population.
    expect(world.view("s1")!.state.population).toBe(1);
    // Players arrive: townsfolk walk out to make room, and come back later.
    for (let i = 2; i <= 6; i++)
      world.join(`s${i}`, `acc-${i}`, profile(`P${i}`), now);
    const later = run(world, 90, now);
    expect(folk()).toHaveLength(townsfolkFor(6));
    for (let i = 2; i <= 6; i++) world.leave(`s${i}`);
    run(world, 1, later.now);
    expect(folk()).toHaveLength(TOWNSFOLK.length);
    // Once the last player goes the copy stops, paused for a while, then
    // it is dropped.
    world.leave("s1", later.now);
    expect((world as any).copies.get(1).emptySince).toBe(later.now);
    world.step(DT, later.now + PLAZA_RETURN_MS);
    expect((world as any).copies.size).toBe(0);
  });

  it("opens a second copy when one is full", () => {
    const world = new PlazaWorld();
    for (let i = 0; i < PLAZA.capacity; i++)
      world.join(`s${i}`, `acc-${i}`, profile(`P${i}`), QUIET);
    expect(world.join("late", "acc-late", profile("Late"), QUIET).plaza).toBe(
      2,
    );
  });

  it("moves at the server's speed and ignores junk input", () => {
    const world = new PlazaWorld();
    world.join("s1", "acc-1", profile("Ann"), QUIET);
    place(world, "s1", 600, 1300);
    world.input("s1", 50, 0);
    run(world, 1, QUIET);
    expect(world.bodyOf("s1")!.x).toBeCloseTo(840, 0);
    world.input("s1", "fast", NaN);
    run(world, 0.5, QUIET);
    expect(world.bodyOf("s1")!.x).toBeCloseTo(840, 0);
    expect(world.dash("s1")).toBe(true);
    expect(world.dash("s1")).toBe(false);
  });

  it("drops orbs during the shower and reports each catch, paying at most 10 a shower", () => {
    const world = new PlazaWorld();
    world.join("s1", "acc-1", profile("Ann"), SHOWER);
    world.join("s2", "acc-2", profile("Ben"), SHOWER);
    place(world, "s2", 300, 1300); // far from the square: catches nothing
    let now = SHOWER,
      caught = 0;
    const orbEvents: string[] = [];
    // Stand on each orb as soon as it can be caught.
    for (let t = 0; t < 59; t += DT) {
      now += DT * 1000;
      for (const e of world.step(DT, now)) {
        if (e.type === "orb") {
          expect(e.key).toBe("s1");
          orbEvents.push(e.ref);
        }
        if (e.type === "orbs") {
          for (const [id, , , at] of e.orbs.add)
            pending.set(id, { at, ...pos(e.orbs.add, id) });
          for (const [, who] of e.orbs.gone) if (who) caught++;
        }
      }
      // Stop catching 20 s before the end, so some orbs are left lying.
      if (t < 39)
        for (const [id, o] of pending)
          if (now - o.at > 1100) {
            place(world, "s1", o.x, o.y);
            pending.delete(id);
            break;
          }
    }
    expect(caught).toBeGreaterThan(ORB_SHOWER.perShower);
    expect(orbEvents).toHaveLength(ORB_SHOWER.perShower);
    expect(new Set(orbEvents).size).toBe(ORB_SHOWER.perShower);
    expect(orbEvents[0]).toMatch(
      new RegExp(`^${Date.parse("2026-11-02T21:30:00.000Z") / 60000}-\\d+$`),
    );
    // After the minute, the leftover orbs are cleared for everyone.
    const after = run(world, 1, now).events;
    expect(after.some((e) => e.type === "orbs" && e.orbs.gone.length > 0)).toBe(
      true,
    );
    expect(world.orbsFor("s1")).toBeUndefined();
  });

  it("counts runway cheers and reports them every 15", () => {
    const world = new PlazaWorld();
    world.join("s1", "acc-1", profile("Ann"), QUIET);
    world.join("s2", "acc-2", profile("Ben"), QUIET);
    place(
      world,
      "s1",
      (PLAZA_STAGE.x0 + PLAZA_STAGE.x1) / 2,
      PLAZA_STAGE.y0 + 50,
    );
    const { events } = run(world, 0.65, QUIET);
    expect(events).toContainEqual({
      type: "news",
      plaza: 1,
      news: { kind: "runway", id: 1, name: "Ann" },
    });
    // A friend's cheer emote counts too.
    place(world, "s2", 1350, 700);
    expect(world.emote("s2", "👏", QUIET)).toBe(true);
    expect(world.emote("s2", "👏", QUIET + 10)).toBe(false);
    expect(world.emote("s2", "🦖", QUIET + 2000)).toBe(false);
    const more = run(world, 8, QUIET).events;
    expect(more.filter((e) => e.type === "cheers")).toEqual([
      { type: "cheers", key: "s1", n: 15 },
    ]);
    expect(world.view("s1")!.state.claps).toBeGreaterThanOrEqual(15);
  });

  it("times a lap run clockwise round the track", () => {
    const world = new PlazaWorld();
    world.join("s1", "acc-1", profile("Ann"), QUIET);
    const b = world.bodyOf("s1")!;
    let now = QUIET,
      lap: number | undefined;
    // Walk the middle of the lane with jumps over the hurdles.
    for (let a = -Math.PI / 2 - 0.15; a < Math.PI * 1.5 + 0.2; a += 0.02) {
      const p = trackPoint(a);
      b.x = p.x;
      b.y = p.y;
      b.z = 30; // in the air over every hurdle
      now += 25;
      for (const e of world.step(0.025, now)) if (e.type === "lap") lap = e.ms;
      b.stun = 0;
    }
    expect(lap).toBeDefined();
    expect(lap!).toBeGreaterThan(5000);
  });

  it("lets a player score with a dash into the ball and names them", () => {
    const world = new PlazaWorld(() => 0.99); // bots never dash
    world.join("s1", "acc-1", profile("Ann"), QUIET);
    // Send the bots off the pitch so only Ann touches the ball.
    for (const bot of (world as any).copies.get(1).bots) {
      bot.body.x = 100;
      bot.body.y = 1500;
    }
    const cx = (PLAZA_PITCH.x0 + PLAZA_PITCH.x1) / 2,
      cy = (PLAZA_PITCH.y0 + PLAZA_PITCH.y1) / 2;
    place(world, "s1", cx - 38, cy);
    world.input("s1", 1, 0);
    world.dash("s1");
    const { events } = run(world, 1.5, QUIET);
    expect(events.filter((e) => e.type === "goal")).toEqual([
      { type: "goal", key: "s1" },
    ]);
    expect(events).toContainEqual({
      type: "news",
      plaza: 1,
      news: { kind: "goal", id: 1, name: "Ann", side: 0 },
    });
    expect(world.view("s1")!.state.score).toEqual([1, 0]);
  });

  it("checks spots by server position", () => {
    const world = new PlazaWorld();
    world.join("s1", "acc-1", profile("Ann"), QUIET);
    expect(world.at("s1", "photo")).toBe(false);
    const photo = PLAZA_SPOTS.find((s) => s.id === "photo")!;
    place(world, "s1", photo.x, photo.y);
    expect(world.at("s1", "photo")).toBe(true);
    expect(world.at("s1", "cafe")).toBe(false);
    expect(world.boost("s1")).toBe(true);
    expect(world.boosted("s1")).toBe(true);
  });
});

const pending = new Map<number, { at: number; x: number; y: number }>();
const pos = (add: [number, number, number, number][], id: number) => {
  const o = add.find((a) => a[0] === id)!;
  return { x: o[1], y: o[2] };
};
