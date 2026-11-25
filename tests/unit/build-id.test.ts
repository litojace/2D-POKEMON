import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildId } from "../../apps/client/src/build-id";

const page = (content: string | null) => ({
  querySelector: (selector: string) =>
    selector === 'meta[name="arena-build"]' && content !== null
      ? ({ getAttribute: () => content } as unknown as Element)
      : null,
});

describe("build id", () => {
  it("is the commit the page says it was built from", () => {
    expect(buildId(page("0cdcb94"))).toBe("0cdcb94");
    expect(buildId(page("dev"))).toBe("dev");
  });
  it("is unknown without the page's meta, or with one that is not an id", () => {
    expect(buildId(page(null))).toBeUndefined();
    expect(buildId(page(""))).toBeUndefined();
    expect(buildId(page("<b>0cdcb94</b>"))).toBeUndefined();
    expect(buildId(page("a".repeat(17)))).toBeUndefined();
    // No page at all (these tests, a worker).
    expect(buildId(undefined)).toBeUndefined();
  });
  it("is written on the page, never compiled into a script", () => {
    // A constant in a script changes that script's hashed name, and the
    // name of every script importing it, on every deploy: phones then
    // download the whole game again for a deploy that changed nothing they
    // run (apps/client/vite.config.ts buildIdMeta).
    const config = readFileSync("apps/client/vite.config.ts", "utf8");
    expect(config).not.toMatch(/\bdefine\s*:/);
    expect(config).toContain('name: "arena-build"');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory()
          ? files(p)
          : p.endsWith(".ts")
            ? [p]
            : [];
      });
    const compiled = files("apps/client/src").filter((f) =>
      /__BUILD__/.test(readFileSync(f, "utf8")),
    );
    expect(compiled).toEqual([]);
  });
});
