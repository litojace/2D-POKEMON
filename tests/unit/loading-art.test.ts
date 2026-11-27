import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";
import {
  LOADING_SCENES,
  NEXT_ART_KEY,
  artForThisStart,
  pickNextArt,
  type LoadingArt,
} from "../../apps/client/src/loading-art";

// The startup curtain's paintings (docs/loading-art-prompts.md): real
// Legendary / Mythical skins in the right modes, one picture per scene, any
// of them with the same chance and never twice in a row.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
afterEach(() => store.clear());

const ART_DIR = "apps/client/src/art/loading-art";
const fake = (ids: string[]): LoadingArt[] =>
  ids.map((id) => ({ ...LOADING_SCENES[0], id, src: `/${id}.webp` }));
/** A seeded random sequence, so the counts are the same every run. */
function seeded(seed = 7) {
  let x = seed;
  return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
}

describe("loading art", () => {
  it("every scene shows Legendary or Mythical Shop skins on their champions", () => {
    const ids = new Set<string>();
    for (const scene of LOADING_SCENES) {
      expect(scene.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(scene.id), scene.id).toBe(false);
      ids.add(scene.id);
      const size = scene.fighters.length;
      if (scene.mode === "duel") expect(size, scene.id).toBe(2);
      if (scene.mode === "teams") expect(size, scene.id).toBe(4);
      if (scene.mode === "ffa")
        expect(size, scene.id).toBeGreaterThanOrEqual(3);
      if (!scene.mode) expect(size, scene.id).toBeGreaterThanOrEqual(1);
      for (const f of scene.fighters) {
        const skin = CHAMPION_SKINS.find((s) => s.id === f.skin);
        expect(skin, f.skin).toBeTruthy();
        expect(skin!.champion, f.skin).toBe(f.champion);
        expect(["legendary", "mythical"], f.skin).toContain(skin!.rarity);
      }
    }
  });
  it("every skin in the brief has its reference picture", () => {
    // docs/loading-art-prompts.md: made with export-references.mjs and
    // shrink-references.py, attached in ChatGPT for each scene.
    for (const scene of LOADING_SCENES)
      for (const f of scene.fighters)
        expect(
          existsSync(`docs/loading-art-references/${f.skin}.png`),
          f.skin,
        ).toBe(true);
  });
  it("every painting in the game belongs to a scene", () => {
    const files = existsSync(ART_DIR) ? readdirSync(ART_DIR) : [];
    for (const file of files) {
      const id = file.match(/^startup-art-([a-z0-9-]+)\.webp$/)?.[1];
      expect(id, file).toBeTruthy();
      expect(
        LOADING_SCENES.some((s) => s.id === id),
        file,
      ).toBe(true);
    }
  });
  it("picks any painting with the same chance, never the one just shown", () => {
    const list = fake(["a", "b", "c", "d"]);
    const random = seeded();
    const counts = new Map<string, number>();
    let current = "a";
    for (let i = 0; i < 9000; i++) {
      const next = pickNextArt(current, list, random)!;
      expect(next.id).not.toBe(current);
      counts.set(next.id, (counts.get(next.id) ?? 0) + 1);
      current = next.id;
    }
    for (const id of ["a", "b", "c", "d"])
      expect(counts.get(id)! / 9000).toBeCloseTo(0.25, 1);
    // One painting: it is the only choice; none: nothing.
    expect(pickNextArt("a", fake(["a"]))?.id).toBe("a");
    expect(pickNextArt(undefined, [])).toBeUndefined();
  });
  it("shows the painting the last start chose, if it is still in the game", () => {
    const list = fake(["a", "b"]);
    expect(artForThisStart(list)).toBeUndefined();
    store.set(NEXT_ART_KEY, "b");
    expect(artForThisStart(list)?.id).toBe("b");
    store.set(NEXT_ART_KEY, "gone");
    expect(artForThisStart(list)).toBeUndefined();
  });
});
