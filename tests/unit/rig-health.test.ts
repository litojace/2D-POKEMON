import { describe, expect, it } from "vitest";
import {
  rigArtHealth,
  rigTextures,
  sourceLooksBlank,
  type ArtNode,
  type ArtSource,
} from "../../apps/client/src/rig-health";
import { FighterLoading } from "../../apps/client/src/animation/fighter-loading";

// A player's own fighter vanished mid-raid on an iPhone (22 Nov 2026): its
// ring and nameplate drew, its body didn't. The battle now checks after the
// page comes back (and on a resume, a new renderer, a restored context)
// whether a rig's textures still have pixels, and loads blank ones again.

/** A canvas-like source with this many painted pixels in a 16x16 probe. */
const canvas = (painted: number): ArtSource & { painted: number } => ({
  width: 400,
  height: 404,
  painted,
});
const read = (s: ArtSource) => {
  const px = new Uint8ClampedArray(16 * 16 * 4);
  const n = (s as { painted?: number }).painted ?? 0;
  for (let i = 0; i < n; i++) px[i * 4 + 3] = 255;
  return px;
};
const tex = (key: string, image: unknown) => ({ key, source: [{ image }] });
const rig = (...textures: ReturnType<typeof tex>[]): ArtNode => ({
  list: [
    { list: textures.slice(0, 1).map((t) => ({ texture: t })) },
    ...textures.slice(1).map((t) => ({ texture: t })),
    // A Graphics layer (no texture) and a second image of the same texture.
    {},
    ...textures.slice(0, 1).map((t) => ({ texture: t })),
  ],
});

describe("a texture's source", () => {
  it("is blank with no pixels, no size, or an image that never loaded", () => {
    expect(sourceLooksBlank(canvas(0), read)).toBe(true);
    expect(sourceLooksBlank(canvas(1), read)).toBe(false);
    expect(sourceLooksBlank({ width: 0, height: 404 }, read)).toBe(true);
    expect(sourceLooksBlank(undefined, read)).toBe(true);
    expect(
      sourceLooksBlank(
        { width: 10, height: 10, complete: true, naturalWidth: 0 },
        read,
      ),
    ).toBe(true);
    expect(
      sourceLooksBlank(
        { width: 10, height: 10, complete: false, naturalWidth: 10 },
        read,
      ),
    ).toBe(true);
  });
  it("counts as fine when it can't be read (another origin): no repair loop", () => {
    const throws = () => {
      throw new Error("tainted");
    };
    expect(sourceLooksBlank(canvas(0), throws)).toBe(false);
    expect(sourceLooksBlank(canvas(0), () => null)).toBe(false);
  });
});

describe("a rig's art", () => {
  it("walks the rig for its textures, once each", () => {
    const r = rig(tex("body", canvas(9)), tex("head", canvas(9)));
    expect([...rigTextures(r).keys()]).toEqual(["body", "head"]);
  });
  it("is fine when its parts have pixels, even with one bare layer", () => {
    const h = rigArtHealth(
      rig(
        tex("body", canvas(9)),
        tex("head", canvas(9)),
        tex("spark", canvas(0)),
      ),
      read,
    );
    expect(h.blank).toBe(false);
    expect(h.total).toBe(3);
  });
  it("is blank when half or more of its textures are, and only those go", () => {
    // The fighter's parts blank, a shared glow still fine: blank, and the
    // repair removes the parts, never the glow.
    const h = rigArtHealth(
      rig(
        tex("body", canvas(0)),
        tex("head", canvas(0)),
        tex("arm", canvas(0)),
        tex("glow", canvas(5)),
      ),
      read,
    );
    expect(h).toEqual({ blank: true, keys: ["body", "head", "arm"], total: 4 });
    // A missing texture counts as blank but is never removed.
    const m = rigArtHealth(
      rig(tex("__MISSING", null), tex("body", canvas(0))),
      read,
    );
    expect(m).toEqual({ blank: true, keys: ["body"], total: 2 });
    // Nothing drawn at all is not "blank": there is nothing to repair.
    expect(rigArtHealth({ list: [{}] }, read).blank).toBe(false);
  });
});

describe("forgetting a fighter's art", () => {
  it("makes it load again from scratch, with fresh attempts", () => {
    const have = new Set<string>();
    const f = new FighterLoading(
      {
        build: () => [{ key: "a" } as never],
        keys: () => ["a"],
        exists: (k) => have.has(k),
      },
      1,
    );
    expect(f.toRequest(["astrabun"])).toEqual(["astrabun"]);
    f.settled();
    have.add("a");
    expect(f.hasArt("astrabun")).toBe(true);
    // Its texture went (removed as blank): still "ready" until forgotten.
    have.delete("a");
    expect(f.hasArt("astrabun")).toBe(true);
    f.forget("astrabun");
    expect(f.hasArt("astrabun")).toBe(false);
    // Out of attempts before (maxAttempts 1): asked for again all the same.
    expect(f.toRequest(["astrabun"])).toEqual(["astrabun"]);
  });
});
