import { expect, it, vi } from "vitest";
import { FighterRig } from "../../apps/client/src/animation/rig";
import { parts, rigKey } from "../../apps/client/src/animation/assets";

// This exercises texture loading without starting Phaser's browser renderer.
vi.mock("phaser", () => ({ default: {} }));

it("keeps the current skin until every layer and expression of the next stage has loaded", () => {
  const loaded = new Set<string>();
  const queued: string[] = [];
  const images = new Map(parts.map((part) => [part, { setTexture: vi.fn() }]));
  const scene = {
    textures: { exists: (key: string) => loaded.has(key) },
    load: {
      svg: vi.fn((key: string) => queued.push(key)),
      isLoading: () => false,
      start: vi.fn(),
    },
  };
  const rig: FighterRig = Object.assign(Object.create(FighterRig.prototype), {
    scene,
    character: "cindrake",
    dir: "down",
    suffix: "",
    images,
  });
  for (const stage of [1, 2, 3]) {
    queued.length = 0;
    for (const image of images.values()) image.setTexture.mockClear();
    const look = { skin: "cindrake-sunforged", stage };
    const suffix = `~${look.skin}~${stage}`;
    rig.wear(look);
    expect(queued.length).toBeGreaterThan(parts.length);
    // The body is often ready before the head, accessories and arms.
    loaded.add(rigKey("cindrake", "down", "body", suffix));
    rig.wear(look);
    for (const image of images.values())
      expect(image.setTexture).not.toHaveBeenCalled();
    // Even an unfinished expression texture must delay the switch.
    for (const key of queued.slice(0, -1)) loaded.add(key);
    rig.wear(look);
    for (const image of images.values())
      expect(image.setTexture).not.toHaveBeenCalled();
    loaded.add(queued.at(-1)!);
    rig.wear(look);
    for (const [part, image] of images) {
      expect(image.setTexture).toHaveBeenCalledExactlyOnceWith(
        rigKey("cindrake", "down", part, suffix),
      );
    }
  }
  // Already-loaded stages can be restored immediately.
  for (const image of images.values()) image.setTexture.mockClear();
  rig.wear({ skin: "cindrake-sunforged", stage: 1 });
  for (const [part, image] of images) {
    expect(image.setTexture).toHaveBeenCalledExactlyOnceWith(
      rigKey("cindrake", "down", part, "~cindrake-sunforged~1"),
    );
  }
  expect(scene.load.start).toHaveBeenCalledTimes(3);
});
