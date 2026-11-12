import { describe, expect, it, vi } from "vitest";
import { FighterRig } from "../../apps/client/src/animation/rig";
import { rigAssets } from "../../apps/client/src/animation/assets";
import type { AnimationPose } from "../../apps/client/src/animation/controller";
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
  setRotation(value: number) {
    this.rotation = value;
    return this;
  }
  setAngle(value: number) {
    return this.setRotation((value * Math.PI) / 180);
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setScale(x: number, y = x) {
    this.scaleX = x;
    this.scaleY = y;
    return this;
  }
  setTexture(key: string) {
    this.texture.key = key;
    return this;
  }
  setOrigin() {
    return this;
  }
  setDepth() {
    return this;
  }
  setVisible() {
    return this;
  }
  setAlpha() {
    return this;
  }
  setTint() {
    return this;
  }
  add() {
    return this;
  }
}

/** The head's rotation, frame by frame, standing idle facing the camera. */
function idleHead(id: CharacterId) {
  const graphics: any = new Proxy({}, { get: () => () => graphics });
  const images: Image[] = [];
  const scene = {
    time: { now: 0 },
    textures: { exists: () => true },
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
  const rig = new FighterRig(scene as any, id, rigAssets(id));
  vi.spyOn(rig as any, "drawEffects").mockImplementation(() => {});
  // Mystowl's owlish tilt comes now and then, to a random side: held off
  // here, so what is left is the head's resting angle and the breath.
  (rig as any).tiltAt = Infinity;
  const head = images.find((image) => /-head(-|$)/.test(image.texture.key))!;
  const pose: AnimationPose = {
    hp: 100,
    speed: 0,
    angle: Math.PI / 2,
    dash: false,
    jump: false,
  };
  const angles: number[] = [];
  // Two idle breaths (the bob runs on sin(now / 430), about 2.7 s each).
  for (let frame = 0; frame < 340; frame++) {
    rig.render(pose, 200, 174, 50_000 + frame * 16, 1, false);
    angles.push(head.rotation);
  }
  return angles;
}

describe("fighters' heads sit straight", () => {
  it.each(Object.keys(CHARACTERS) as CharacterId[])(
    "%s's head is level on average while it stands idle",
    (id) => {
      // Over two whole breaths the rocking cancels out: what is left is a
      // lean to one side.
      const angles = idleHead(id);
      const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
      expect(Math.abs(mean), `${id} leans`).toBeLessThan(0.01);
    },
  );
});
