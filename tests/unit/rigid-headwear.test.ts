import { describe, expect, it, vi } from "vitest";
import { FighterRig } from "../../apps/client/src/animation/rig";
import { rigAssets, partsFor } from "../../apps/client/src/animation/assets";
import type { AnimationPose } from "../../apps/client/src/animation/controller";
import { creatureLayers, ANIMATED_CRESTS } from "../../apps/client/src/creature-design";
import { CHARACTERS, type CharacterId } from "@arena/shared";

vi.mock("phaser", () => ({ default: {} }));

/** Just enough of a Phaser image for the rig to pose its parts. */
class Image {
  x = 0;
  y = 0;
  rotation = 0;
  scaleX = 1;
  scaleY = 1;
  texture = { key: "" };
  setRotation(v: number) { this.rotation = v; return this; }
  setAngle(v: number) { return this.setRotation((v * Math.PI) / 180); }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setTexture(key: string) { this.texture.key = key; return this; }
  setOrigin() { return this; }
  setDepth() { return this; }
  setVisible() { return this; }
  setAlpha() { return this; }
  setTint() { return this; }
  add() { return this; }
  moveTo() { return this; }
}

/** Frames of the flame and hat layers, standing idle or attacking. */
function frames(id: CharacterId, skin: string, dir = Math.PI / 2, state?: string) {
  const graphics: any = new Proxy({}, { get: () => () => graphics });
  const images: Image[] = [];
  const scene = {
    time: { now: 0 },
    textures: { exists: () => true },
    load: { isLoading: () => true, start() {} },
    add: {
      container: () => new Image(),
      graphics: () => graphics,
      image: (x: number, y: number, key: string) => {
        const image = new Image().setPosition(x, y).setTexture(key);
        images.push(image);
        return image;
      },
    },
  };
  // Built on its own look, then wearing the skin (FighterRig.wear), as in play.
  const rig = new FighterRig(scene as any, id, rigAssets(id));
  vi.spyOn(rig as any, "drawEffects").mockImplementation(() => {});
  (rig as any).tiltAt = Infinity;
  const flame = (rig as any).images.get("flame") as Image;
  const hat = (rig as any).images.get("hat") as Image;
  const head = (rig as any).images.get("head") as Image;
  const pose: AnimationPose = { hp: 100, speed: 0, angle: dir, dash: false, jump: false, skin: { skin, stage: 1 } } as any;
  const out: { flame: [number, number, number]; hat: [number, number, number]; head: number }[] = [];
  for (let f = 0; f < 120; f++) {
    if (state && f === 10) rig.trigger(state as any, 50_000 + f * 16, 500);
    rig.render(pose, 200, 174, 50_000 + f * 16, 1, false);
    out.push({ flame: [flame.scaleX, flame.scaleY, flame.rotation], hat: [hat.scaleX, hat.scaleY, hat.rotation], head: head.rotation });
  }
  return out;
}

describe("headwear over an animated crest rides the head", () => {
  it("gives only the champions with an animated crest a hat layer", () => {
    for (const id of Object.keys(CHARACTERS) as CharacterId[])
      expect(partsFor(id).includes("hat"), id).toBe(ANIMATED_CRESTS.has(id));
  });

  it("moves a skin's headwear off Cindrake's living flame, the crest itself staying on it", () => {
    for (const dir of ["down", "right", "up"] as const) {
      const { layers } = creatureLayers("cindrake", dir, "normal", { skin: "cindrake-sky-pirates", stage: 1 });
      // The bandana (and its knot) on the hat layer; the redrawn flame on the crest's.
      expect(layers.hat, dir).toContain("skin-accessory");
      expect(layers.flame, dir).toContain('data-crest="1"');
      // Its hip lantern rides the torso (scarf layer), never a head layer.
      expect(layers.scarf, dir).toContain("#3a2a1c");
      expect(layers.flame + layers.hat, dir).not.toContain('rx="2" fill="#3a2a1c"');
    }
    // Skins that keep Cindrake's own flame put all their headwear on the hat.
    const { layers } = creatureLayers("cindrake", "down", "normal", { skin: "cindrake-stars-stripes", stage: 1 });
    expect(layers.hat).toContain("skin-accessory");
    expect(layers.flame).not.toContain("skin-accessory");
  });

  it("lets the flame flicker while the hat holds still with the head", () => {
    const f = frames("cindrake", "cindrake-sky-pirates");
    const flameScales = new Set(f.map((x) => x.flame[1].toFixed(4)));
    expect(flameScales.size).toBeGreaterThan(5);
    for (const x of f) {
      expect(x.hat[0]).toBe(0.5);
      expect(x.hat[1]).toBe(0.5);
      expect(x.hat[2]).toBeCloseTo(x.head, 6);
    }
  });

  it("keeps the hat steady through an attack and in profile", () => {
    for (const [dir, state] of [[0, "attack"], [Math.PI / 2, "cast"]] as const) {
      const f = frames("cindrake", "cindrake-sky-pirates", dir, state);
      for (const x of f) {
        expect(x.hat[0]).toBe(0.5);
        expect(x.hat[1]).toBe(0.5);
      }
    }
  });
});
