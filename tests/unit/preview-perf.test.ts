import { describe, expect, it } from "vitest";
import { PreviewPerf } from "../../apps/client/src/preview-perf";

/** Browser frames every `refresh` ms for a second; the preview draws every
 *  `every`-th one, each taking `ms`. */
function run(refresh: number, every: number, ms: number) {
  const perf = new PreviewPerf();
  for (let i = 0; i < Math.round(1000 / refresh); i++) {
    const at = 1000 + i * refresh;
    perf.frame(at);
    if (i % every === 0) perf.draw(at, ms);
  }
  return perf.stats();
}

describe("the Lobby read-out's frame measurements", () => {
  it("tells the screen's refresh from the frames drawn", () => {
    expect(run(1000 / 60, 1, 3)).toMatchObject({
      screenHz: 60,
      fps: 60,
      stepMs: 3,
      late: 0,
    });
    // A 120 Hz screen held to 60.
    expect(run(1000 / 120, 2, 3)).toMatchObject({ screenHz: 120, fps: 60 });
    // Every other frame of a 60 Hz screen: what the owner saw ("like 30 Hz").
    expect(run(1000 / 60, 2, 3)).toMatchObject({ screenHz: 60, fps: 30 });
  });

  it("counts late frames against the usual pace", () => {
    const perf = new PreviewPerf();
    let at = 1000;
    for (let i = 0; i < 60; i++) {
      at += i % 10 === 9 ? 33.3 : 16.7;
      perf.frame(at);
      perf.draw(at, i === 30 ? 20 : 2);
    }
    const stats = perf.stats();
    expect(stats.late).toBeCloseTo(0.1, 1);
    expect(stats.stepMaxMs).toBe(20);
    expect(stats.stepMs).toBe(2);
  });

  it("keeps only the last two seconds", () => {
    const perf = new PreviewPerf();
    for (let i = 0; i < 600; i++) perf.draw(i * 10, i < 300 ? 50 : 1);
    expect(perf.stats().stepMaxMs).toBe(1);
  });
});
