import { describe, expect, it, vi } from "vitest";
import { PlazaWorld, type PlazaEvent } from "../../apps/server/src/plaza";
import {
  FIREWORKS,
  PlazaFireworks,
  SHELL_KINDS,
  fireworkShells,
  shellEnds,
} from "../../apps/client/src/plaza/plaza-fireworks";
import {
  PLAZA,
  PLAZA_FOUNTAIN,
  PLAZA_OBSTACLES,
  PLAZA_SPAWN,
  PLAZA_WISH,
  atFountain,
  plazaCollide,
  wishTarget,
} from "../../packages/shared/src/plaza";

// The wishing fountain: treats thrown at the fountain fill a shared meter
// per Plaza copy; a full one sets off fireworks and pays every wisher.
const profile = (name: string) => ({
  name,
  title: null,
  titleColor: null,
  level: null,
  character: "voltkit",
  skin: null,
});
const QUIET = Date.parse("2026-11-02T21:16:00.000Z");
const world = (n: number) => {
  const w = new PlazaWorld(() => 0.5);
  let id = 0;
  w.wishId = () => `fill-${++id}`;
  for (let i = 1; i <= n; i++)
    w.join(`s${i}`, `acc-${i}`, profile(`P${i}`), QUIET);
  return w;
};
const meter = (events: PlazaEvent[]) =>
  events.find((e) => e.type === "wish") as Extract<
    PlazaEvent,
    { type: "wish" }
  >;

describe("the wish meter's size", () => {
  it("scales with the copy's players, between a minimum and a maximum", () => {
    expect(wishTarget(0)).toBe(PLAZA_WISH.min);
    expect(wishTarget(1)).toBe(PLAZA_WISH.min);
    expect(wishTarget(2)).toBe(PLAZA_WISH.min);
    // Three or four players fill it with two treats each.
    expect(wishTarget(3)).toBe(6);
    // Alone, a day's treats fill it once.
    expect(Math.floor(PLAZA.treatsDaily / wishTarget(1))).toBe(1);
    expect(wishTarget(4)).toBe(8);
    expect(wishTarget(PLAZA.capacity)).toBe(PLAZA_WISH.max);
  });
  it("needs fewer treats than a day's allowance from each of 3–4 players", () => {
    for (const n of [3, 4])
      expect(wishTarget(n) / n).toBeLessThanOrEqual(PLAZA.treatsDaily / 2);
  });
});

describe("standing at the fountain", () => {
  it("is within reach of the basin all round, but not at the spawn", () => {
    expect(atFountain(PLAZA_FOUNTAIN.x, PLAZA_FOUNTAIN.y)).toBe(true);
    expect(atFountain(PLAZA_SPAWN.x, PLAZA_SPAWN.y)).toBe(false);
    // Pushed out of the basin from any side, you still reach it.
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const p = plazaCollide({
        x: PLAZA_FOUNTAIN.x + Math.cos(a) * 30,
        y: PLAZA_FOUNTAIN.y + Math.sin(a) * 30,
      });
      expect(atFountain(p.x, p.y), `angle ${a.toFixed(2)}`).toBe(true);
    }
    expect(PLAZA_OBSTACLES[0]).toMatchObject({
      x: PLAZA_FOUNTAIN.x,
      y: PLAZA_FOUNTAIN.y,
    });
  });
  it("gives the server a little slack for lag", () => {
    const edge = PLAZA_FOUNTAIN.x + PLAZA_WISH.reach.rx + 20;
    expect(atFountain(edge, PLAZA_FOUNTAIN.y)).toBe(false);
    expect(atFountain(edge, PLAZA_FOUNTAIN.y, PLAZA_WISH.slack)).toBe(true);
  });
});

describe("the Plaza world's wishes", () => {
  it("knows who stands at the fountain", () => {
    const w = world(1);
    const b = w.bodyOf("s1")!;
    Object.assign(
      b,
      plazaCollide({ x: PLAZA_FOUNTAIN.x, y: PLAZA_FOUNTAIN.y + 40 }),
    );
    expect(w.atFountain("s1")).toBe(true);
    Object.assign(b, { x: PLAZA_SPAWN.x, y: PLAZA_SPAWN.y + 200 });
    expect(w.atFountain("s1")).toBe(false);
    expect(w.atFountain("nobody")).toBe(false);
  });

  it("counts wishes for the whole copy, fixing the goal at the first wish", () => {
    const w = world(3);
    expect(w.wishFor("s1", QUIET)).toEqual({ n: 0, target: 0 });
    expect(meter(w.wish("s1", QUIET)).wish).toEqual({ n: 1, target: 6 });
    // A fourth player arriving doesn't move this fill's goal.
    w.join("s4", "acc-4", profile("P4"), QUIET);
    expect(meter(w.wish("s4", QUIET + 1)).wish).toEqual({ n: 2, target: 6 });
    expect(w.wishFor("s2", QUIET + 2)).toEqual({ n: 2, target: 6 });
    // Each copy has its own meter.
    expect(meter(w.wish("nobody", QUIET)) ?? null).toBeNull();
  });

  it("fills: fireworks, news, every wisher paid once, and the meter starts again", () => {
    const w = world(3);
    const all: PlazaEvent[] = [];
    for (const [key, t] of [
      ["s1", 0],
      ["s2", 1],
      ["s1", 2],
      ["s2", 3],
      ["s1", 4],
    ] as const)
      all.push(...w.wish(key, QUIET + t * 1000));
    expect(all.some((e) => e.type === "wished")).toBe(false);
    const fill = w.wish("s1", QUIET + 5000);
    expect(fill).toContainEqual({
      type: "wished",
      accounts: ["acc-1", "acc-2"],
      ref: "fill-1",
    });
    expect(fill).toContainEqual({
      type: "news",
      plaza: 1,
      news: { kind: "wish" },
    });
    const show = meter(fill).wish;
    expect(show.n).toBe(0);
    expect(show.show).toEqual({ at: QUIET + 5000, seed: expect.any(Number) });
    // Someone joining during the show sees it; after it, only the meter.
    expect(w.wishFor("s3", QUIET + 6000)?.show?.at).toBe(QUIET + 5000);
    expect(
      w.wishFor("s3", QUIET + 5000 + PLAZA_WISH.showMs)?.show,
    ).toBeUndefined();
    // The next fill pays only its own wishers, under a new ref.
    let next: PlazaEvent[] = [];
    for (let i = 0; i < 6; i++) next = w.wish("s3", QUIET + 20_000 + i);
    expect(next).toContainEqual({
      type: "wished",
      accounts: ["acc-3"],
      ref: "fill-2",
    });
  });

  it("queues a second show after one still going", () => {
    const w = world(1);
    let last: PlazaEvent[] = [];
    for (let i = 0; i < PLAZA_WISH.min; i++) last = w.wish("s1", QUIET + i);
    const first = meter(last).wish.show!;
    for (let i = 0; i < PLAZA_WISH.min; i++)
      last = w.wish("s1", QUIET + 100 + i);
    expect(meter(last).wish.show!.at).toBe(first.at + PLAZA_WISH.showMs);
  });

  it("empties a meter nobody added to for a while, and tells the copy", () => {
    const w = world(2);
    w.wish("s1", QUIET);
    let now = QUIET,
      emptied: PlazaEvent[] = [];
    while (now < QUIET + PLAZA_WISH.idleMs + 1000 && !emptied.length) {
      now += 50;
      emptied = w.step(0.05, now).filter((e) => e.type === "wish");
    }
    expect(emptied).toEqual([
      { type: "wish", plaza: 1, wish: { n: 0, target: 0 } },
    ]);
    expect(now).toBeGreaterThanOrEqual(QUIET + PLAZA_WISH.idleMs);
    expect(w.wishFor("s1", now)).toEqual({ n: 0, target: 0 });
  });

  it("pays a wisher who left before the fill (they wished in it)", () => {
    const w = world(2);
    w.wish("s2", QUIET);
    w.leave("s2", QUIET + 1);
    let last: PlazaEvent[] = [];
    for (let i = 1; i < wishTarget(2); i++) last = w.wish("s1", QUIET + 10 + i);
    expect(last.find((e) => e.type === "wished")).toMatchObject({
      accounts: ["acc-2", "acc-1"],
    });
  });
});

describe("the fireworks", () => {
  /** A phone's view of the square (world px), as the scene passes it. */
  const VIEW = { x0: 1000, y0: 700, x1: 1960, y1: 1240 };
  it("are the same for everyone with the same seed, every kind, ending with the show", () => {
    expect(fireworkShells(42)).toEqual(fireworkShells(42));
    expect(fireworkShells(42)).not.toEqual(fireworkShells(43));
    const shells = fireworkShells(7);
    expect(new Set(shells.map((s) => s.kind))).toEqual(
      new Set(Object.keys(SHELL_KINDS)),
    );
    for (const s of shells) {
      expect(Math.abs(s.u)).toBeLessThanOrEqual(FIREWORKS.across / 2);
      expect(s.v).toBeGreaterThanOrEqual(FIREWORKS.band[0]);
      expect(s.v).toBeLessThanOrEqual(FIREWORKS.band[1]);
      expect(s.launch + shellEnds(s.kind)).toBeLessThanOrEqual(
        PLAZA_WISH.showMs / 1000,
      );
    }
    // A finale: the last three go up together.
    const last = shells.slice(-3).map((s) => s.launch);
    expect(Math.max(...last) - Math.min(...last)).toBeLessThanOrEqual(0.15);
    // No kind's sparks go further than the reach.
    for (const k of Object.values(SHELL_KINDS))
      expect(k.speed[1] / k.drag).toBeLessThanOrEqual(FIREWORKS.reach + 1e-9);
  });

  const play = (
    fw: PlazaFireworks,
    from: number,
    until: number,
    view = VIEW,
  ) => {
    let peak = 0;
    const sparks = (fw as any).sparks as { x: number; y: number }[];
    let out = 0;
    for (let t = from; t <= until; t += 1000 / 60) {
      fw.step(t, 1 / 60, view);
      const live = (fw as any).live as number;
      peak = Math.max(peak, live);
      for (let i = 0; i < live; i++)
        if (
          sparks[i].x < view.x0 ||
          sparks[i].x > view.x1 ||
          sparks[i].y < view.y0 ||
          sparks[i].y > view.y1
        )
          out++;
    }
    return { peak, out };
  };

  it("burst in the viewer's view, centred under the top HUD, sparks on screen", () => {
    const fw = new PlazaFireworks(() => 0.5);
    fw.start(0, 9, 0);
    const { peak, out } = play(fw, 0, PLAZA_WISH.showMs + 1500);
    expect(peak).toBeGreaterThan(0);
    expect(out).toBe(0);
    // Burst centres sit below the top quarter of a 375 px phone, where the
    // scene switch and the event pill are.
    const h = VIEW.y1 - VIEW.y0,
      centres = fw.centres();
    expect(centres).toHaveLength(fireworkShells(9).length);
    for (const c of centres) expect((c.y - VIEW.y0) / h).toBeGreaterThan(0.4);
  });

  it("stay within the spark cap, and Low and reduced motion are lighter", () => {
    const high = new PlazaFireworks(() => 0.5),
      low = new PlazaFireworks(() => 0.5),
      reduced = new PlazaFireworks(() => 0.5);
    high.setLevel(false, false);
    low.setLevel(true, false);
    reduced.setLevel(false, true);
    for (const fw of [high, low, reduced]) fw.start(1000, 9, 1000);
    const peaks = [high, low, reduced].map((fw) => play(fw, 1000, 7000).peak);
    expect(peaks[0]).toBeGreaterThan(0);
    expect(peaks[0]).toBeLessThanOrEqual(FIREWORKS.maxSparks);
    expect(peaks[1]).toBeLessThanOrEqual(Math.ceil(peaks[0] * 0.4));
    expect(peaks[2]).toBeLessThanOrEqual(Math.ceil(peaks[0] * 0.4));
    expect(low.tails).toBe(false);
    expect(low.glowBudget).toBe(FIREWORKS.lowGlowBudget);
    // All done after the show: nothing left to draw.
    for (const fw of [high, low, reduced]) expect(fw.active(7000)).toBe(false);
  });

  it("arriving late skips the shells already gone up", () => {
    const fw = new PlazaFireworks(() => 0.5);
    fw.start(0, 9, 4000);
    expect((fw as any).next).toBeGreaterThanOrEqual(6);
    fw.start(0, 9, PLAZA_WISH.showMs + 1);
    expect(fw.active(PLAZA_WISH.showMs + 1)).toBe(false);
  });

  it("hold Low's flashes to the glow budget, never below half size", () => {
    const calls: number[] = [];
    const ctx = {
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fillRect() {},
      rect() {},
      fill() {},
      setTransform() {},
      canvas: { width: 667, height: 375 },
      drawImage(_i: unknown, _x: number, _y: number, w: number) {
        calls.push(w);
      },
    } as unknown as CanvasRenderingContext2D;
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({
          createRadialGradient: () => ({ addColorStop() {} }),
          fillRect() {},
        }),
      }),
    });
    try {
      /** A 667×375 phone at `zoom`: the view is the screen over the zoom. */
      const measure = (low: boolean, zoom: number, budget?: number) => {
        const fw = new PlazaFireworks(() => 0.5);
        fw.setLevel(low, false);
        if (budget !== undefined) fw.glowBudget = budget;
        fw.start(0, 9, 0);
        const view = { x0: 0, y0: 0, x1: 667 / zoom, y1: 375 / zoom };
        for (let t = 0; t <= PLAZA_WISH.showMs; t += 1000 / 60) {
          fw.step(t, 1 / 60, view);
          fw.draw(ctx, t, zoom, 667, 375);
        }
        return { ...fw.peak };
      };
      const high = measure(false, 0.7),
        low = measure(true, 0.7);
      expect(high.flashes).toBeGreaterThan(0);
      expect(high.shrink).toBe(1);
      // A fraction of the screen at its brightest (the finale's three).
      expect(high.glowCover).toBeGreaterThan(0.05);
      expect(high.glowCover).toBeLessThan(0.6);
      // Low holds it to its budget, never below half size.
      expect(low.glowCover).toBeLessThanOrEqual(FIREWORKS.lowGlowBudget + 1e-9);
      expect(low.shrink).toBeGreaterThanOrEqual(0.5);
      // The flashes take the same share of any screen, whatever the zoom.
      expect(measure(false, 1.5).glowCover).toBeCloseTo(high.glowCover, 5);
      // Over a budget they all shrink to fit it…
      const tight = measure(true, 0.7, high.glowCover / 2);
      expect(tight.glowCover).toBeLessThanOrEqual(high.glowCover / 2 + 1e-9);
      expect(tight.shrink).toBeLessThan(1);
      expect(tight.shrink).toBeGreaterThan(0.5);
      // …never below half size.
      expect(measure(true, 0.7, 0.001).shrink).toBe(0.5);
      expect(calls.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
