import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Phaser's addCanvas / createCanvas build a CanvasTexture, which reads the
// whole canvas back with getImageData: a stall that showed up as a hitch on
// the first hit of a match and when a raid floor's art arrived. Painted
// canvases go through addCanvasTexture (canvas-texture.ts) instead.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("no canvas read-back in the client", () => {
  it("never wraps a painted canvas in a CanvasTexture", () => {
    const offenders = files("apps/client/src").filter((path) =>
      /\.(addCanvas|createCanvas)\(/.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
