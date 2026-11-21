import { describe, expect, it } from "vitest";
import { PlazaWorld } from "../../apps/server/src/plaza";
import { fishArt } from "../../apps/client/src/plaza/plaza-fish-art";
import {
  PLAZA_FIGHT,
  plazaFightMovesOk,
  plazaFightReplay,
  plazaFightStart,
  plazaFightStep,
  type PlazaFightRarity,
} from "../../packages/shared/src/plaza-fight";
import {
  PLAZA,
  PLAZA_FISH,
  PLAZA_FISH_BY_ID,
  PLAZA_FISH_RARITY,
  PLAZA_FISH_SHAPES,
  PLAZA_FISHING,
  PLAZA_PATHS,
  PLAZA_POND,
  PLAZA_QUESTS,
  PLAZA_SIGNPOSTS,
  PLAZA_SPOTS,
  plazaCollide,
  plazaFishFor,
  plazaFishPick,
  plazaIsNight,
  plazaSpotAt,
  plazaTimeOfDay,
  segmentDistance,
  type PlazaFishNote,
} from "../../packages/shared/src/plaza";

const DT = 1 / PLAZA.tick;
/** 14:00 UTC: day on a UTC clock. */
const NOON = Date.parse("2026-11-02T14:00:00.000Z");
const SPOT = PLAZA_SPOTS.find((s) => s.id === "fish")!;
const profile = {
  name: "Ann",
  title: null,
  titleColor: null,
  level: null,
  character: "voltkit",
  skin: null,
};
/** A world whose random numbers come from `rolls` (then 0.5). */
function world(given: number[] = []) {
  const rolls: number[] = [];
  const w = new PlazaWorld(() => rolls.shift() ?? 0.5);
  w.join("s1", "acc-1", profile, NOON);
  // After joining (which rolls for the spawn spot and the townsfolk).
  rolls.push(...given);
  const b = w.bodyOf("s1")!;
  b.x = SPOT.x;
  b.y = SPOT.y;
  return w;
}
/**
 * A player who reacts `delay` steps late: holds while the needle (as they
 * saw it) is under the band's middle. Their presses and let-goes, and how
 * the fight went.
 */
function play(seed: number, rarity: PlazaFightRarity, delay = 4) {
  const f = plazaFightStart(seed, rarity),
    k = PLAZA_FIGHT.fish[rarity],
    seen: number[] = [],
    moves: number[] = [];
  let holding = false;
  while (f.result === "going") {
    seen.push(f.tension);
    const want = seen[Math.max(0, seen.length - 1 - delay)] < (k.lo + k.hi) / 2;
    if (want !== holding) {
      holding = want;
      moves.push(f.tick);
    }
    plazaFightStep(f, holding);
  }
  return { moves, f };
}
const run = (w: PlazaWorld, ms: number, from: number) => {
  const notes: PlazaFishNote[] = [];
  let now = from;
  for (let t = 0; t < ms - 1e-6; t += DT * 1000) {
    now += DT * 1000;
    for (const e of w.step(DT, now))
      if (e.type === "fish" && e.key === "s1") notes.push(e.note);
  }
  return { notes, now };
};

describe("the fish table", () => {
  it("has 8 to 12 fish with unique ids, known rarities and a few night-only ones", () => {
    expect(PLAZA_FISH.length).toBeGreaterThanOrEqual(8);
    expect(PLAZA_FISH.length).toBeLessThanOrEqual(12);
    expect(new Set(PLAZA_FISH.map((f) => f.id)).size).toBe(PLAZA_FISH.length);
    for (const f of PLAZA_FISH) {
      expect(PLAZA_FISH_RARITY[f.rarity], f.id).toBeDefined();
      expect(f.id).toMatch(/^[a-z][a-z0-9-]{1,31}$/);
      expect(PLAZA_FISH_BY_ID[f.id]).toBe(f);
    }
    const night = PLAZA_FISH.filter((f) => f.time === "night");
    expect(night.length).toBeGreaterThanOrEqual(2);
    // Night fish only at night, day fish only by day.
    expect(plazaFishFor(false).some((f) => f.time === "night")).toBe(false);
    expect(plazaFishFor(true).some((f) => f.time === "day")).toBe(false);
    expect(plazaFishFor(true)).toEqual(expect.arrayContaining(night));
  });

  it("draws every fish in its own shape, with ids unique on the page", () => {
    const shapes = new Set<string>();
    const ids: string[] = [];
    for (const f of PLAZA_FISH) {
      expect(PLAZA_FISH_SHAPES, f.id).toContain(f.shape);
      shapes.add(f.shape);
      for (const known of [true, false]) {
        const svg = fishArt(f, known);
        expect(svg).toMatch(/^<svg viewBox="0 0 64 40"[^]*<\/svg>$/);
        expect(svg).not.toMatch(/NaN|undefined/);
        ids.push(...[...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
        // Not caught yet: a shadow, never its colours.
        if (!known) expect(svg).not.toContain(f.color);
      }
    }
    expect(shapes.size).toBe(PLAZA_FISH.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("picks by rarity weight, from the fish that bite at that time", () => {
    const count = (night: boolean) => {
      const n: Record<string, number> = {};
      for (let i = 0; i < 10_000; i++) {
        const f = plazaFishPick((i + 0.5) / 10_000, night);
        n[f.id] = (n[f.id] ?? 0) + 1;
      }
      return n;
    };
    for (const night of [false, true]) {
      const n = count(night),
        pool = plazaFishFor(night),
        total = pool.reduce(
          (s, f) => s + PLAZA_FISH_RARITY[f.rarity].weight,
          0,
        );
      expect(Object.keys(n).sort()).toEqual(pool.map((f) => f.id).sort());
      for (const f of pool)
        expect(n[f.id] / 10_000).toBeCloseTo(
          PLAZA_FISH_RARITY[f.rarity].weight / total,
          2,
        );
    }
    // Out-of-range numbers still give a fish.
    expect(plazaFishPick(-1, false)).toBe(plazaFishFor(false)[0]);
    expect(plazaFishPick(1, true)).toBe(plazaFishFor(true).at(-1));
  });

  it("tells night from day on the player's own clock", () => {
    expect(plazaTimeOfDay(NOON)).toBeCloseTo(14 / 24, 6);
    // UTC-8 (getTimezoneOffset 480): 06:00 there.
    expect(plazaTimeOfDay(NOON, 480)).toBeCloseTo(6 / 24, 6);
    // UTC+9 (-540): 23:00.
    expect(plazaTimeOfDay(NOON, -540)).toBeCloseTo(23 / 24, 6);
    // Nonsense offsets count as UTC.
    expect(plazaTimeOfDay(NOON, 99_999)).toBeCloseTo(14 / 24, 6);
    expect(plazaTimeOfDay(NOON, NaN)).toBeCloseTo(14 / 24, 6);
    expect(plazaIsNight(14 / 24)).toBe(false);
    expect(plazaIsNight(23 / 24)).toBe(true);
    expect(plazaIsNight(3 / 24)).toBe(true);
    expect(plazaIsNight(6 / 24)).toBe(false);
  });

  it("puts the fishing spot on the pond's bank, the bobber in the water, and a fish quest in the list", () => {
    const P = PLAZA_POND,
      inPond = (x: number, y: number) =>
        ((x - P.x) / P.rx) ** 2 + ((y - P.y) / P.ry) ** 2 < 1;
    expect(inPond(SPOT.x, SPOT.y)).toBe(false);
    // Standing on the spot is not pushed off it.
    const b = plazaCollide({ x: SPOT.x, y: SPOT.y });
    expect([b.x, b.y]).toEqual([SPOT.x, SPOT.y]);
    expect(plazaSpotAt(SPOT.x, SPOT.y)?.id).toBe("fish");
    expect(inPond(PLAZA_FISHING.bobber.x, PLAZA_FISHING.bobber.y)).toBe(true);
    // No other spot overlaps it.
    for (const s of PLAZA_SPOTS)
      if (s !== SPOT)
        expect(Math.hypot(s.x - SPOT.x, s.y - SPOT.y)).toBeGreaterThan(
          s.r + SPOT.r,
        );
    expect(PLAZA_QUESTS.find((q) => q.id === "fish")).toMatchObject({
      text: "Catch 10 fish",
      max: 10,
    });
  });
});

describe("the way to the pond", () => {
  it("has a FISHING signpost at the fork, beside the pond path, pointing at the pond", () => {
    const pond = PLAZA_PATHS.find((p) => {
      const [x, y] = p.pts[p.pts.length - 1];
      return Math.hypot(x - PLAZA_POND.x, y - PLAZA_POND.y) < PLAZA_POND.rx;
    })!;
    const [a, b] = pond.pts.map(([x, y]) => ({ x, y }));
    const sign = PLAZA_SIGNPOSTS.find((s) =>
      s.arms.some((a) => a.text === "FISHING"),
    )!;
    const arm = sign.arms.find((a) => a.text === "FISHING")!;
    expect(arm.dir).toBe(Math.sign(PLAZA_POND.x - sign.x));
    // Near where the pond path leaves the main path, just off its stones.
    expect(Math.hypot(sign.x - a.x, sign.y - a.y)).toBeLessThan(160);
    const off = segmentDistance(sign.x, sign.y, a, b) - pond.w / 2;
    expect(off).toBeGreaterThan(4);
    expect(off).toBeLessThan(40);
    // Nobody walks through it.
    const walker = { x: sign.x, y: sign.y + 2 };
    plazaCollide(walker);
    expect(walker.y - sign.y).toBeGreaterThan(PLAZA.radius);
  });
});

describe("landing a hooked fish", () => {
  it("is the same fight from the same seed, live or replayed from its moves", () => {
    for (const rarity of Object.keys(PLAZA_FIGHT.fish) as PlazaFightRarity[])
      for (const seed of [1, 99, 123456]) {
        const { moves, f } = play(seed, rarity);
        const again = plazaFightReplay(seed, rarity, moves);
        expect([again.result, again.tick, again.progress]).toEqual([
          f.result,
          f.tick,
          f.progress,
        ]);
        expect(plazaFightMovesOk(moves)).toBe(true);
      }
  });

  it("snaps when held, lets the fish go when slack, and lands it in the band", () => {
    expect(plazaFightReplay(7, "common", [0]).result).toBe("snap");
    expect(plazaFightReplay(7, "common", []).result).toBe("escape");
    const { f } = play(7, "common");
    expect(f.result).toBe("caught");
    // A few seconds, not a chore.
    expect(f.tick * PLAZA_FIGHT.tickMs).toBeGreaterThan(2500);
    expect(f.tick * PLAZA_FIGHT.tickMs).toBeLessThan(9000);
  });

  it("gets harder with rarity, and a quick player lands even the legendary one", () => {
    const rate = (r: PlazaFightRarity, delay: number) => {
      let n = 0;
      for (let seed = 1; seed <= 200; seed++)
        if (play(seed * 7919, r, delay).f.result === "caught") n++;
      return n / 200;
    };
    // A player a fifth of a second late: commons always, the legendary
    // most times; half a second late loses the legendary.
    expect(rate("common", 4)).toBe(1);
    expect(rate("legendary", 2)).toBeGreaterThan(0.95);
    expect(rate("legendary", 4)).toBeGreaterThan(0.6);
    expect(rate("legendary", 6)).toBeLessThan(rate("common", 6));
    const F = PLAZA_FIGHT.fish;
    expect(F.legendary.hi - F.legendary.lo).toBeLessThan(
      F.common.hi - F.common.lo,
    );
    expect(F.legendary.pull).toBeGreaterThan(F.common.pull);
  });
});

describe("fishing on the server", () => {
  it("bites at a random 2-6 s; a tap in the window hooks it, and landing it brings in the fish it picked", () => {
    // Rolls: the fish (0 → the first that bites by day), then the bite (0.5 → 4 s).
    const w = world([0, 0.5]);
    expect(w.cast("s1", NOON, 0)).toEqual({ ok: true });
    const line = w.lineOf("s1")!;
    expect(line.biteAt).toBe(NOON + 4000);
    expect(line.fish).toBe(plazaFishFor(false)[0].id);
    let { notes, now } = run(w, 3900, NOON);
    expect(notes).toEqual([]);
    ({ notes, now } = run(w, 150, now));
    expect(notes).toEqual([{ state: "bite" }]);
    const hooked = w.reel("s1", now + 600);
    expect(hooked).toEqual({
      ok: true,
      hooked: true,
      rarity: PLAZA_FISH_BY_ID[line.fish].rarity,
      seed: expect.any(Number),
    });
    // Still on the line while the fight lasts; no second reel, no "late".
    expect(w.reel("s1", now + 700).ok).toBe(false);
    ({ notes, now } = run(w, 3000, now + 600));
    expect(notes).toEqual([]);
    if (!hooked.ok) throw new Error();
    const { moves, f } = play(hooked.seed, hooked.rarity);
    expect(f.result).toBe("caught");
    expect(w.land("s1", now + f.tick * PLAZA_FIGHT.tickMs, moves)).toEqual({
      ok: true,
      fish: line.fish,
    });
    expect(w.lineOf("s1")).toBeNull();
  });

  it("runs the fight again itself: a snap, a fish let go, a made-up win or a too-quick one lands nothing", () => {
    const hook = () => {
      const w = world([0, 0]);
      w.cast("s1", NOON);
      const { now } = run(w, PLAZA_FISHING.biteMinMs, NOON);
      const r = w.reel("s1", now);
      if (!r.ok) throw new Error("not hooked");
      return { w, now, seed: r.seed, rarity: r.rarity };
    };
    const late = (n: number) => n + PLAZA_FIGHT.maxTicks * PLAZA_FIGHT.tickMs;
    // Held all the way: the line snaps.
    let h = hook();
    expect(h.w.land("s1", late(h.now), [0])).toMatchObject({
      ok: false,
      why: "snap",
    });
    // Never reeled: it swims off.
    h = hook();
    expect(h.w.land("s1", late(h.now), [])).toMatchObject({
      ok: false,
      why: "escape",
    });
    // A real win, sent sooner than the fight could have taken.
    h = hook();
    const { moves, f } = play(h.seed, h.rarity);
    expect(h.w.land("s1", h.now + 200, moves)).toMatchObject({
      ok: false,
      why: "bad",
    });
    // Moves that aren't moves.
    for (const bad of [null, "x", [5, 3], [1.5], new Array(999).fill(1)]) {
      h = hook();
      expect(h.w.land("s1", late(h.now), bad)).toMatchObject({ ok: false });
    }
    // Nothing hooked, or a fish already landed: nothing to land.
    expect(world().land("s1", NOON, moves)).toMatchObject({ ok: false });
    h = hook();
    expect(h.w.land("s1", h.now + f.tick * 50, moves).ok).toBe(true);
    expect(h.w.land("s1", h.now + f.tick * 50, moves).ok).toBe(false);
  });

  it("lets a fight nobody finishes go, and leaving mid-fight takes the line in", () => {
    const w = world([0, 0]);
    w.cast("s1", NOON);
    let { now } = run(w, PLAZA_FISHING.biteMinMs, NOON);
    expect(w.reel("s1", now).ok).toBe(true);
    let notes: PlazaFishNote[];
    ({ notes, now } = run(
      w,
      PLAZA_FIGHT.maxTicks * PLAZA_FIGHT.tickMs + 3000,
      now,
    ));
    expect(notes).toEqual([{ state: "gone", why: "late" }]);
    expect(w.lineOf("s1")).toBeNull();
    const v = world([0, 0]);
    v.cast("s1", NOON);
    ({ now } = run(v, PLAZA_FISHING.biteMinMs, NOON));
    v.reel("s1", now);
    expect(v.stopFishing("s1", now + 500)).toBe(true);
    expect(v.lineOf("s1")).toBeNull();
  });

  it("covers the whole 2-6 s range", () => {
    for (const [r, ms] of [
      [0, PLAZA_FISHING.biteMinMs],
      [0.999999, PLAZA_FISHING.biteMaxMs],
    ]) {
      const w = world([0.3, r]);
      w.cast("s1", NOON);
      expect(w.lineOf("s1")!.biteAt - NOON).toBeCloseTo(ms, -1);
    }
  });

  it("picks night fish by the player's clock", () => {
    // 0.999999: the last fish of the pool, a night one at night.
    const w = world([0.999999, 0.5]);
    w.cast("s1", NOON, -540);
    expect(PLAZA_FISH_BY_ID[w.lineOf("s1")!.fish].time).toBe("night");
    const d = world([0.999999, 0.5]);
    d.cast("s1", NOON, 0);
    expect(PLAZA_FISH_BY_ID[d.lineOf("s1")!.fish].time).not.toBe("night");
  });

  it("loses the fish to a tap too soon or too late, or when it waits too long", () => {
    let w = world([0, 0]);
    w.cast("s1", NOON);
    expect(w.reel("s1", NOON + 500)).toMatchObject({ ok: false, why: "early" });
    // The window, with slack for the round trip.
    w = world([0, 0]);
    w.cast("s1", NOON);
    let { notes, now } = run(w, PLAZA_FISHING.biteMinMs, NOON);
    expect(notes).toEqual([{ state: "bite" }]);
    expect(
      w.reel("s1", now + PLAZA_FISHING.windowMs + PLAZA_FISHING.slackMs + 50),
    ).toMatchObject({ ok: false, why: "late" });
    // Nobody taps: the server lets it go and says so.
    w = world([0, 0]);
    w.cast("s1", NOON);
    ({ notes, now } = run(w, PLAZA_FISHING.biteMinMs + 2000, NOON));
    expect(notes).toEqual([{ state: "bite" }, { state: "gone", why: "late" }]);
    expect(w.lineOf("s1")).toBeNull();
    expect(w.reel("s1", now)).toMatchObject({ ok: false });
  });

  it("only casts at the pond, one line at a time, not too often, and reels in when you walk off", () => {
    const w = world([0, 0.5]);
    const b = w.bodyOf("s1")!;
    b.x = SPOT.x - SPOT.r - PLAZA_FISHING.reachSlack - 30;
    expect(w.cast("s1", NOON)).toMatchObject({ ok: false });
    b.x = SPOT.x;
    expect(w.cast("s1", NOON).ok).toBe(true);
    expect(w.cast("s1", NOON + 10)).toMatchObject({
      ok: false,
      error: "Your line is already out.",
    });
    w.reel("s1", NOON + 100);
    // The next cast waits a moment.
    expect(w.cast("s1", NOON + 200).ok).toBe(false);
    expect(w.cast("s1", NOON + 100 + PLAZA_FISHING.castGapMs).ok).toBe(true);
    // Walking away takes the line in.
    b.x = SPOT.x - SPOT.r - PLAZA_FISHING.reachSlack - 30;
    const { notes } = run(w, 100, NOON + 1200);
    expect(notes).toEqual([{ state: "gone", why: "moved" }]);
    expect(w.lineOf("s1")).toBeNull();
    // Not in the Plaza at all.
    expect(w.cast("nobody", NOON).ok).toBe(false);
    expect(w.reel("nobody", NOON).ok).toBe(false);
  });

  it("leaving fishing mode takes the line in quietly", () => {
    const w = world([0, 0.5]);
    expect(w.stopFishing("s1", NOON)).toBe(false);
    w.cast("s1", NOON);
    expect(w.stopFishing("s1", NOON + 100)).toBe(true);
    expect(w.lineOf("s1")).toBeNull();
    // No bite or "gone" note follows, and the next cast waits as usual.
    const { notes } = run(w, 7000, NOON + 100);
    expect(notes).toEqual([]);
    expect(w.cast("s1", NOON + 200).ok).toBe(false);
    expect(w.cast("s1", NOON + 100 + PLAZA_FISHING.castGapMs).ok).toBe(true);
    expect(w.stopFishing("nobody", NOON)).toBe(false);
  });

  it("never sends the fish before it is caught", () => {
    const w = world([0, 0]);
    w.cast("s1", NOON);
    const { notes } = run(w, PLAZA_FISHING.biteMinMs + 100, NOON);
    expect(JSON.stringify(notes)).not.toContain(w.lineOf("s1")!.fish);
    expect(JSON.stringify(w.view("s1"))).not.toContain(w.lineOf("s1")!.fish);
  });
});
