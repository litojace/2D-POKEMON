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
  it("reaches the battle kit's modules through the kit, not by importing them", () => {
    // What a battle draws with loads with Phaser (battle-kit.ts). A value
    // import of one of its modules in main.ts puts that module, and all it
    // imports, back into the script the game starts with.
    const kit = readFileSync(join(SRC, "battle-kit.ts"), "utf8");
    const modules = [...kit.matchAll(/from\s+"(\.\/[^"]+)"/g)].map((m) => m[1]);
    expect(modules.length).toBeGreaterThan(30);
    const main = readFileSync(join(SRC, "main.ts"), "utf8");
    const direct = [
      ...main.matchAll(/^import\s+(?!type\b)[^;]*?from\s+"([^"]+)";/gm),
    ]
      .map((m) => m[1])
      .filter((spec) => modules.includes(spec));
    expect(direct).toEqual([]);
    // The kit itself is only ever loaded on demand, with Phaser.
    const importers = files(SRC).filter((f) =>
      /from\s+"[^"]*\/battle-kit"|import\("[^"]*\/battle-kit"\)/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(importers.map((f) => f.slice(SRC.length + 1))).toEqual([
      "phaser-runtime.ts",
    ]);
    expect(readFileSync(join(SRC, "phaser-runtime.ts"), "utf8")).toContain(
      'import("./battle-kit")',
    );
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
      // Loaded when it opens (or just before, accounts.ts loadRaids).
      expect(accounts).toContain(`import("./screens/${screen}")`);
    }
  });
});
