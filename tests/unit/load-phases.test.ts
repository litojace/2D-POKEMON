import { describe, expect, it } from "vitest";
import { loadPhases } from "../../apps/client/src/battle-perf";
import { battleLoadSchema } from "../../packages/shared/src/connection";

describe("battle load phases", () => {
  it("splits the load into renderer start, art and scene", () => {
    const phases = loadPhases(1000, { preload: 1400.4, create: 2600 }, 2850);
    expect(phases).toEqual({ boot: 400, assets: 1200, scene: 250 });
  });
  it("leaves out a phase whose mark is missing or out of order", () => {
    expect(loadPhases(1000, { preload: 0, create: 0 }, 2000)).toEqual({});
    expect(loadPhases(1000, { preload: 1500, create: 0 }, 2000)).toEqual({
      boot: 500,
    });
    expect(loadPhases(1000, { preload: 1500, create: 1400 }, 2000)).toEqual({
      boot: 500,
      scene: 600,
    });
  });
  it("is what the server accepts", () => {
    const report = {
      ms: 1850,
      fighters: 2,
      ...loadPhases(1000, { preload: 1400, create: 2600 }, 2850),
      density: 1.5,
      build: "dev",
      os: "android",
      app: false,
    };
    expect(battleLoadSchema.safeParse(report).success).toBe(true);
    expect(
      battleLoadSchema.safeParse({ ...report, os: "symbian" }).success,
    ).toBe(false);
  });
});
