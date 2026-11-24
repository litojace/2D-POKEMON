import { describe, expect, it } from "vitest";
import {
  collectTests,
  durationKey,
  recordDuration,
  sortedDurations,
  planShards,
  testKey,
  unlistable,
} from "../../scripts/visual-shards.mjs";
import durations from "../visual/durations.json";

// CI's visual shards (scripts/visual-shards.mjs): every test runs on exactly
// one shard, and the shards come out close in running time.
describe("visual shards", () => {
  const keys = (n: number) =>
    Array.from({ length: n }, (_, i) => `t${String(i).padStart(3, "0")}`);

  it("puts every test on exactly one shard", () => {
    const all = keys(97);
    const d = Object.fromEntries(all.map((k, i) => [k, ((i * 37) % 50) + 1]));
    const shards = planShards(all, d, 18);
    const dealt = shards.flatMap((s) => s.keys);
    expect(dealt.sort()).toEqual([...all].sort());
    expect(new Set(dealt).size).toBe(all.length);
  });

  it("balances by time, not by count: one slow test gets a shard to itself", () => {
    const d: Record<string, number> = { slow: 600 };
    const all = ["slow", ...keys(30)];
    for (const k of keys(30)) d[k] = 20;
    const shards = planShards(all, d, 2);
    const slow = shards.find((s) => s.keys.includes("slow"))!;
    expect(slow.keys).toEqual(["slow"]);
    // Count-based halves would be 600+15*20 and 15*20; LPT gives 600 and 600.
    expect(Math.max(...shards.map((s) => s.seconds))).toBe(600);
  });

  it("is the same plan on every runner, whatever order the list comes in", () => {
    const all = keys(60);
    const d = Object.fromEntries(all.map((k, i) => [k, i % 7 === 0 ? 30 : 10]));
    const a = planShards(all, d, 6).map((s) => s.keys);
    const b = planShards([...all].reverse(), d, 6).map((s) => s.keys);
    expect(b).toEqual(a);
  });

  it("counts a test with no measured time as the median one", () => {
    const d = { a: 10, b: 20, c: 30 };
    const shards = planShards(["a", "b", "c", "new"], d, 1);
    expect(shards[0].seconds).toBe(80);
  });

  it("refuses a bad shard total", () => {
    expect(() => planShards(["a"], {}, 0)).toThrow();
  });

  it("reads the test list from a Playwright --list JSON report", () => {
    const report = {
      suites: [
        {
          title: "plaza.spec.ts",
          file: "plaza.spec.ts",
          specs: [{ title: "top", file: "plaza.spec.ts" }],
          suites: [
            {
              title: "on a phone",
              file: "plaza.spec.ts",
              specs: [{ title: "inner", file: "plaza.spec.ts" }],
            },
          ],
        },
      ],
    };
    expect(collectTests(report).map((t) => testKey(t.file, t.titles))).toEqual([
      "plaza.spec.ts › top",
      "plaza.spec.ts › on a phone › inner",
    ]);
  });

  it("the durations reporter keys tests as the list does and keeps a retry's passing time", () => {
    const key = durationKey(["", "", "plaza.spec.ts", "on a phone", "inner"]);
    expect(key).toBe("plaza.spec.ts › on a phone › inner");
    const times: Record<string, number> = {};
    const passed = new Set<string>();
    recordDuration(times, passed, "b", { status: "failed", duration: 9000 });
    recordDuration(times, passed, "b", { status: "passed", duration: 12345 });
    recordDuration(times, passed, "a", { status: "passed", duration: 800 });
    recordDuration(times, passed, "a", { status: "failed", duration: 99000 });
    expect(sortedDurations(times)).toEqual({ a: 0.8, b: 12.3 });
    expect(Object.keys(sortedDurations(times))).toEqual(["a", "b"]);
  });

  it("spots titles a --test-list line can't carry", () => {
    expect(unlistable(["a › b"])).toBe(true);
    expect(unlistable(["x > y"])).toBe(true);
    expect(unlistable([" padded"])).toBe(true);
    expect(unlistable(["on a phone", "fine title at 844x390"])).toBe(false);
  });

  it("the committed durations file is in the form the plan reads", () => {
    const entries = Object.entries(durations as Record<string, number>);
    expect(entries.length).toBeGreaterThan(100);
    for (const [k, v] of entries) {
      expect(k).toMatch(/^[\w.-]+\.spec\.ts › /);
      expect(typeof v).toBe("number");
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
