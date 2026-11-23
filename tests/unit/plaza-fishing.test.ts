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
  PLAZA_DOCK,
  PLAZA_FISH,
  PLAZA_FISH_BY_ID,
  PLAZA_FISH_RARITY,
  PLAZA_FISH_SHAPES,
  PLAZA_FISHING,
  PLAZA_PATHS,
  PLAZA_POND,
  PLAZA_QUESTS,
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
    // What they saw: the needle and the band's middle (it wanders).
    seen: [number, number][] = [],
    moves: number[] = [];
  let holding = false;
  while (f.result === "going") {
    seen.push([f.tension, (f.lo + f.hi) / 2]);
    const [t, mid] = seen[Math.max(0, seen.length - 1 - delay)];
    const want = t < mid;
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
  it("has a full pond: every rarity several times over, unique ids, day- and night-only ones", () => {
    expect(PLAZA_FISH.length).toBeGreaterThanOrEqual(20);
    const by = (r: string) => PLAZA_FISH.filter((f) => f.rarity === r);
    expect(by("common").length).toBeGreaterThanOrEqual(6);
    expect(by("uncommon").length).toBeGreaterThanOrEqual(5);
    expect(by("rare").length).toBeGreaterThanOrEqual(4);
    expect(by("legendary").length).toBeGreaterThanOrEqual(2);
    // Every rarity can bite by day and by night.
    for (const night of [false, true])
      for (const r of ["common", "uncommon", "rare", "legendary"])
        expect(
          plazaFishFor(night).some((f) => f.rarity === r),
          `${r} ${night ? "night" : "day"}`,
        ).toBe(true);
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

  it("draws every fish, each looking its own, with ids unique on the page", () => {
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
    // Every shape is used, and no two fish look alike (shape, mark and
    // colour together).
    expect(shapes.size).toBe(PLAZA_FISH_SHAPES.length);
    expect(
      new Set(PLAZA_FISH.map((f) => `${f.shape}/${f.mark}/${f.color}`)).size,
    ).toBe(PLAZA_FISH.length);
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

describe("the fishing dock", () => {
  const P = PLAZA_POND,
    inPond = (x: number, y: number) =>
      ((x - P.x) / P.rx) ** 2 + ((y - P.y) / P.ry) ** 2 < 1;
  it("is where Fish takes you: on its planks, out over the water, in reach of the spot", () => {
    const S = PLAZA_DOCK.stand,
      D = PLAZA_DOCK;
    expect(inPond(S.x, S.y)).toBe(true);
    expect(plazaCollide({ x: S.x, y: S.y })).toEqual({ x: S.x, y: S.y });
    expect(S.x).toBeGreaterThan(D.x0);
    expect(S.x).toBeLessThan(D.x1);
    expect(S.y).toBeGreaterThan(D.y0);
    expect(S.y).toBeLessThan(D.y1);
    expect(plazaSpotAt(S.x, S.y)?.id).toBe("fish");
    // From the bank onto the dock is clear walking (the click path too).
    const walker = { x: SPOT.x, y: S.y };
    for (let x = SPOT.x; x <= S.x; x += 4) {
      walker.x = x;
      plazaCollide(walker);
      expect(walker.y).toBe(S.y);
    }
  });
  it("keeps feet on its planks: off its sides or its end you stay on it", () => {
    const W = PLAZA_DOCK.walk;
    for (const [x, y] of [
      [2030, W.y0 - 15],
      [2030, W.y1 + 15],
      [W.x1 + 15, 1420],
    ]) {
      const b = plazaCollide({ x, y });
      expect(b.x).toBeLessThanOrEqual(W.x1);
      expect(b.y).toBeGreaterThanOrEqual(W.y0);
      expect(b.y).toBeLessThanOrEqual(W.y1);
    }
    // Elsewhere the pond still pushes you out onto its bank.
    const b = plazaCollide({ x: P.x, y: P.y + 30 });
    expect(inPond(b.x, b.y)).toBe(false);
  });
  it("casts out near the pond's middle, well past the dock's end", () => {
    const B = PLAZA_FISHING.bobber;
    expect(Math.abs(B.x - P.x)).toBeLessThan(P.rx * 0.2);
    expect(Math.abs(B.y - P.y)).toBeLessThan(P.ry * 0.2);
    expect(B.x - PLAZA_DOCK.x1).toBeGreaterThan(80);
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

  it("keeps a common fish's band still, and lets a rarer fish's wander inside the gauge", () => {
    const spread = (r: PlazaFightRarity) => {
      const f = plazaFightStart(5, r);
      let lo = 1,
        hi = 0;
      for (let i = 0; i < 200; i++) {
        plazaFightStep(f, i % 6 < 3);
        if (f.result !== "going") break;
        lo = Math.min(lo, f.lo);
        hi = Math.max(hi, f.hi);
        expect(f.lo).toBeGreaterThanOrEqual(0.12 - 1e-9);
        expect(f.hi).toBeLessThanOrEqual(0.9 + 1e-9);
      }
      return hi - lo - (PLAZA_FIGHT.fish[r].hi - PLAZA_FIGHT.fish[r].lo);
    };
    expect(spread("common")).toBeCloseTo(0, 5);
    expect(spread("rare")).toBeGreaterThan(0.1);
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
    // A quick player (a tenth of a second late) lands every kind; a fifth
    // of a second late: commons and uncommons always, rares most times, the
    // legendary about two times in three; three tenths late: commons still,
    // rares and legendaries hardly ever.
    expect(rate("legendary", 2)).toBeGreaterThan(0.95);
    expect(rate("common", 4)).toBe(1);
    expect(rate("uncommon", 4)).toBeGreaterThan(0.95);
    expect(rate("rare", 4)).toBeGreaterThan(0.8);
    const legend = rate("legendary", 4);
    expect(legend).toBeGreaterThan(0.45);
    expect(legend).toBeLessThan(0.85);
    expect(rate("common", 6)).toBeGreaterThan(0.95);
    expect(rate("uncommon", 6)).toBeLessThan(0.95);
    expect(rate("rare", 6)).toBeLessThan(0.2);
    expect(rate("legendary", 6)).toBeLessThan(0.1);
    const F = PLAZA_FIGHT.fish;
    // Rarer fish run harder and their band wanders further (commons don't).
    expect(F.common.drift).toBe(0);
    expect(F.common.run).toBe(0);
    expect(F.uncommon.run).toBeLessThanOrEqual(F.rare.run);
    expect(F.rare.run).toBeLessThanOrEqual(F.legendary.run);
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
