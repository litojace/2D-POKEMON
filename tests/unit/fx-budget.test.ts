import { describe, expect, it } from "vitest";
import { Fx } from "../../apps/client/src/fx-engine";

/** A stand-in scene whose frame events the test can fire itself. */
function scene(width = 1000, height = 500, zoom = 1) {
  const handlers = new Map<string, (...a: number[]) => void>();
  const object = (): any => new Proxy({}, { get: () => () => object() });
  const s: any = {
    add: { graphics: object, image: object },
    textures: { exists: () => true },
    events: {
      on: (name: string, fn: any, ctx: any) => handlers.set(name, fn.bind(ctx)),
      off() {},
      once() {},
    },
    cameras: { main: { zoom, shake() {} } },
    scale: { width, height },
  };
  const frame = (draw: (fx: Fx) => void, fx: Fx, ms = 16) => {
    handlers.get("preupdate")!(0);
    draw(fx);
    handlers.get("postupdate")!(0, ms);
  };
  return { s, frame };
}

describe("effect work counters", () => {
  it("counts glows and how much of the screen they cover", () => {
    const { s, frame } = scene(1000, 500);
    const fx = new Fx(s);
    // Two glows of radius 125 (250×250 sprites): 125 000 px² of 500 000.
    frame((fx) => {
      fx.glow(100, 100, 125, 0xffffff);
      fx.glow(300, 100, 125, 0xffffff);
      fx.soft(100, 100, 50, 0x000000);
    }, fx);
    expect(fx.stats.glows).toBe(2);
    expect(fx.stats.glowCover).toBeCloseTo(0.25);
    expect(fx.stats.softs).toBe(1);
    expect(fx.stats.softCover).toBeCloseTo(0.02);
    expect(fx.stats.shrink).toBe(1);
    // The camera's zoom scales what the world covers on screen.
    const zoomed = scene(1000, 500, 2);
    const fx2 = new Fx(zoomed.s);
    zoomed.frame((fx) => fx.glow(0, 0, 125, 0xffffff), fx2);
    expect(fx2.stats.glowCover).toBeCloseTo(0.5);
  });
});

describe("the glow budget (Low)", () => {
  // Twenty big glows: 20 × (500×500) = 5 000 000 px², 10 screens.
  const heavy = (fx: Fx) => {
    for (let i = 0; i < 20; i++) fx.glow(i * 10, 0, 250, 0xffffff);
  };

  it("draws everything as is without a budget", () => {
    const { s, frame } = scene();
    const fx = new Fx(s);
    for (let i = 0; i < 30; i++) frame(heavy, fx);
    expect(fx.stats.shrink).toBe(1);
    expect(fx.stats.glows).toBe(20);
    expect(fx.stats.glowCover).toBeCloseTo(10);
  });

  it("holds the budget from the very first frame, never below half size", () => {
    const { s, frame } = scene();
    const fx = new Fx(s);
    fx.glowBudget = 4;
    // 10 screens into 4: radius × √0.4 ≈ 0.63, on the first heavy frame
    // (a burst that peaks in one frame on a slow phone is caught too).
    frame(heavy, fx, 250);
    expect(fx.stats.shrink).toBeCloseTo(Math.sqrt(0.4), 3);
    expect(fx.stats.glowCover).toBeCloseTo(4, 2);
    // Far over budget, glows stay at least half their size.
    fx.glowBudget = 0.1;
    frame(heavy, fx);
    expect(fx.stats.shrink).toBe(0.5);
  });

  it("grows back smoothly once the effects end, whatever the frame rate", () => {
    const back = (ms: number) => {
      const { s, frame } = scene();
      const fx = new Fx(s);
      fx.glowBudget = 4;
      frame(heavy, fx, ms);
      let t = 0,
        biggest = 0,
        last = fx.stats.shrink;
      while (fx.stats.shrink < 1 && t < 5000) {
        frame((fx) => fx.glow(0, 0, 20, 0), fx, ms);
        biggest = Math.max(biggest, fx.stats.shrink - last);
        last = fx.stats.shrink;
        t += ms;
      }
      return { t, biggest };
    };
    const smooth = back(1000 / 60);
    // No pop at 60 fps: small steps, back to full size within ~2 s.
    expect(smooth.biggest).toBeLessThan(0.05);
    expect(smooth.t).toBeLessThan(2500);
    // About as long on a slow phone (4 fps), not 15 times longer.
    expect(back(250).t).toBeLessThan(2500);
  });

  it("never shrinks an essential glow (a warning)", () => {
    const { s, frame } = scene();
    const fx = new Fx(s);
    fx.glowBudget = 1;
    for (let i = 0; i < 60; i++)
      frame((fx) => {
        heavy(fx);
        fx.essential(() => fx.glow(0, 0, 200, 0xff0000));
      }, fx);
    const shrink = fx.stats.shrink;
    expect(shrink).toBeLessThan(1);
    // The essential glow keeps its full size (400×400): only the
    // decorative ten screens shrink.
    const essential = (400 * 400) / 500_000;
    expect(fx.stats.essentialCover).toBeCloseTo(essential);
    expect(fx.stats.glowCover).toBeCloseTo(essential + 10 * shrink * shrink, 2);
  });

  it("returns to full size once the effects end", () => {
    const { s, frame } = scene();
    const fx = new Fx(s);
    fx.glowBudget = 2;
    for (let i = 0; i < 60; i++) frame(heavy, fx);
    expect(fx.stats.shrink).toBeLessThan(1);
    // Back to full size within two seconds (it eases back up).
    for (let i = 0; i < 120; i++) frame((fx) => fx.glow(0, 0, 20, 0), fx);
    expect(fx.stats.shrink).toBe(1);
  });
});

describe("effects on a slow phone", () => {
  it("live their designed time in real seconds at 10 fps, not longer", () => {
    const { s, frame } = scene();
    const fx = new Fx(s);
    const burst = (fx: Fx) =>
      fx.burst({
        x: 0,
        y: 0,
        count: 50,
        kind: "spark",
        color: 0xffffff,
        speed: [10, 20],
        life: [1, 1],
        size: [1, 1],
      });
    frame(burst, fx, 100);
    expect(fx.stats.particles).toBe(50);
    // One second later at 10 fps (ten 100 ms frames) they are gone. With
    // steps capped at 50 ms they lived two seconds: twice as many at once.
    for (let i = 0; i < 11; i++) frame(() => {}, fx, 100);
    expect(fx.stats.particles).toBe(0);
  });
});
