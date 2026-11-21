import { describe, expect, it } from "vitest";
import { PlazaWorld } from "../../apps/server/src/plaza";
import { fishArt } from "../../apps/client/src/plaza/plaza-fish-art";
import {
  PLAZA,
  PLAZA_FISH,
  PLAZA_FISH_BY_ID,
  PLAZA_FISH_RARITY,
  PLAZA_FISH_SHAPES,
  PLAZA_FISHING,
  PLAZA_POND,
  PLAZA_QUESTS,
  PLAZA_SPOTS,
  plazaCollide,
  plazaFishFor,
  plazaFishPick,
  plazaIsNight,
  plazaSpotAt,
  plazaTimeOfDay,
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
      max: 3,
    });
  });
});

describe("fishing on the server", () => {
  it("bites at a random 2-6 s, and a tap in the window catches the fish it picked", () => {
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
    expect(w.reel("s1", now + 600)).toEqual({ ok: true, fish: line.fish });
    expect(w.lineOf("s1")).toBeNull();
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
