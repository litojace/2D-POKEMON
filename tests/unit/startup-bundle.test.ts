import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Phaser loads after the first screen (apps/client/src/phaser-runtime.ts):
// a module that imports it as a value would put all of it back into the
// game's start. Types come from `import type Phaser from "phaser"`.
const SRC = "apps/client/src";
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });

describe("startup bundle", () => {
  it("imports Phaser as a value only where it is loaded on demand", () => {
    const valueImports = files(SRC).filter((f) =>
      /^import\s+(?!type\b)[^;]*from\s+["']phaser["']/m.test(
        readFileSync(f, "utf8"),
      ),
    );
    // shop-preview.ts is itself imported with import().
    expect(valueImports.map((f) => f.slice(SRC.length + 1))).toEqual([
      "shop-preview.ts",
    ]);
  });
  it("opens the raid screens, the fitting room and the Journey on demand", () => {
    const accounts = readFileSync(join(SRC, "accounts.ts"), "utf8");
    for (const screen of ["raid-hall", "fitting-room", "journey"]) {
      expect(accounts).not.toMatch(
        new RegExp(
          `^import\\s+\\{[^}]*\\bopen\\w+[^}]*\\}\\s+from\\s+"\\./screens/${screen}"`,
          "m",
        ),
      );
      expect(accounts).toContain(`await import("./screens/${screen}")`);
    }
  });
});
