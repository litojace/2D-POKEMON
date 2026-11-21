import { describe, expect, it } from "vitest";
import { mergeLane, MAX_FAST_FILES } from "../../scripts/merge-lane.mjs";

// The lane a branch takes to main (CLAUDE.md, "Merging to main").
describe("mergeLane", () => {
  it("a screen's own files and their tests take the fast lane", () => {
    const r = mergeLane([
      "apps/client/src/screens/profile-view.ts",
      "apps/client/src/screens/profile.css",
      "apps/server/src/match-history.ts",
      "tests/visual/profile.spec.ts",
      "tests/unit/profile.test.ts",
      "docs/match-history.md",
    ]);
    expect(r).toMatchObject({ lane: "FAST", reasons: [], docsOnly: false });
  });

  it("docs alone are fast, and say CI runs nothing", () => {
    expect(mergeLane(["docs/a.md", "CLAUDE.md"])).toMatchObject({
      lane: "FAST",
      docsOnly: true,
    });
  });

  it.each([
    ["supabase/migrations/20261121090000_x.sql", "production database"],
    ["package.json", "dependencies"],
    ["apps/client/package.json", "dependencies"],
    ["package-lock.json", "dependencies"],
    [".github/workflows/ci.yml", "CI"],
    ["render.yaml", "deploy"],
    ["apps/client/vite.config.ts", "build"],
    ["tests/visual/harness/fake-api.ts", "harness"],
    ["tests/visual/playwright.config.ts", "harness"],
    ["scripts/check-migrations.mjs", "CI or production runs"],
    ["scripts/full-run-due.mjs", "CI or production runs"],
    ["apps/client/src/ui/components.ts", "shared UI"],
    ["apps/client/src/style.css", "shared UI"],
    ["apps/client/src/fx-engine.ts", "battle"],
    ["apps/client/src/skill-fx-fire.ts", "battle"],
    ["apps/client/src/boss-prismell-rig.ts", "battle"],
    ["apps/client/src/networking/client.ts", "battle"],
    ["apps/server/src/simulation.ts", "game server"],
    ["packages/shared/src/index.ts", "shared rules"],
  ])("%s takes the full lane", (file, why) => {
    const r = mergeLane([file, "apps/client/src/screens/profile.ts"]);
    expect(r.lane).toBe("FULL");
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).toContain(why);
    expect(r.reasons[0]).toContain(file);
  });

  it("names every reason, each once", () => {
    const r = mergeLane([
      "supabase/migrations/a.sql",
      "supabase/migrations/b.sql",
      "apps/client/src/ui/motion.ts",
    ]);
    expect(r.reasons).toHaveLength(2);
  });

  it("too many files to check by hand is full; docs don't count", () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => `apps/client/src/screens/s${i}.ts`);
    expect(mergeLane(many(MAX_FAST_FILES)).lane).toBe("FAST");
    expect(mergeLane(many(MAX_FAST_FILES + 1)).lane).toBe("FULL");
    expect(
      mergeLane([...many(MAX_FAST_FILES), "docs/x.md", "README.md"]).lane,
    ).toBe("FAST");
  });

  it("ignores blank lines from git", () => {
    expect(mergeLane(["", " ", "apps/client/src/screens/a.ts\n"]).files).toBe(
      1,
    );
  });
});

describe("merge-lane in CI", () => {
  it("writes lane=FAST or lane=FULL to $GITHUB_OUTPUT", async () => {
    const { execFileSync } = await import("node:child_process");
    const { mkdtempSync, readFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const out = join(mkdtempSync(join(tmpdir(), "lane-")), "out");
    // HEAD against itself: nothing changes, so FAST.
    execFileSync("node", ["scripts/merge-lane.mjs", "HEAD"], {
      env: { ...process.env, GITHUB_OUTPUT: out },
    });
    expect(readFileSync(out, "utf8")).toBe("lane=FAST\n");
  });
});
