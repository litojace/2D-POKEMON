import { describe, expect, it, vi } from "vitest";
import { FighterRig } from "../../apps/client/src/animation/rig";
import { rigAssets } from "../../apps/client/src/animation/assets";
import type { AnimationPose } from "../../apps/client/src/animation/controller";

vi.mock("phaser", () => ({ default: {} }));
const turn = Math.PI * 2;
const wrap = (angle: number) =>
  ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI;
const change = (before: number, after: number) =>
  Math.atan2(Math.sin(after - before), Math.cos(after - before));

/** Phaser normalizes image.rotation to [-PI, PI], even for a continuously spinning ring. */
class Image {
  x = 0;
  y = 0;
  scaleX = 1;
  scaleY = 1;
  texture = { key: "" };
  private angle = 0;
  get rotation() {
    return this.angle;
  }
  set rotation(value: number) {
    this.angle = wrap(value);
  }
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
function preview(stage: number) {
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
  const rig = new FighterRig(scene as any, "auralynx", rigAssets("auralynx"));
  // Only drawing is stubbed; the real pose, angle wrapping and spring code run.
  vi.spyOn(rig as any, "drawEffects").mockImplementation(() => {});
  const ring = images.find((image) => image.texture.key.includes("-wings"))!;
  const pose: AnimationPose = {
    hp: 100,
    speed: 0,
    angle: Math.PI / 2,
    dash: false,
    jump: false,
    skin: { skin: "auralynx-celestial-sage", stage },
  };
  const render = (
    time: number,
    extra: Partial<AnimationPose> = {},
    reduced = false,
  ) => {
    rig.render({ ...pose, ...extra }, 200, 174, time, 1, reduced);
    return ring.rotation;
  };
  return { rig, render };
}

describe("Auralynx's spinning aura ring", () => {
  it.each([1, 2, 3])(
    "never reverses or snaps while crossing full turns at stage %i",
    (stage) => {
      const { render } = preview(stage);
      let before = render(100_000);
      let angle = 0;
      for (let frame = 1; frame <= 1800; frame++) {
        const after = render(100_000 + frame * 16);
        const delta = change(before, after);
        expect(delta).toBeGreaterThanOrEqual(-0.00001);
        expect(delta).toBeLessThan(0.02);
        angle += delta;
        before = after;
      }
      expect(angle).toBeGreaterThan(turn * 3);
    },
  );
  it("changes idle, charge and victory speeds without changing its rotation phase", () => {
    const { render } = preview(3);
    let before = render(800_000);
    for (let frame = 1; frame <= 1200; frame++) {
      const charging = frame >= 180 && frame < 360;
      const victory = frame >= 600 && frame < 900;
      const after = render(800_000 + frame * 16, { charging, victory });
      const delta = change(before, after);
      expect(delta).toBeGreaterThanOrEqual(-0.00001);
      expect(delta).toBeLessThan(0.105);
      before = after;
    }
  });
  it("does not catch up with a burst after a long hidden-tab gap or a clock reset", () => {
    const { render } = preview(3);
    render(20_000);
    const before = render(20_016);
    const after = render(500_000);
    expect(Math.abs(change(before, after))).toBeLessThan(0.04);
    const restarted = render(100);
    expect(Math.abs(change(after, restarted))).toBeLessThan(0.00001);
    expect(change(restarted, render(116))).toBeGreaterThan(0);
  });
  it("holds its phase when reduced motion is enabled and resumes without snapping", () => {
    const { render } = preview(3);
    render(10_000);
    const before = render(10_016);
    for (let frame = 1; frame <= 60; frame++)
      expect(change(before, render(10_016 + frame * 16, {}, true))).toBeCloseTo(
        0,
      );
    const resumed = render(11_000);
    expect(change(before, resumed)).toBeGreaterThanOrEqual(0);
    expect(change(before, resumed)).toBeLessThan(0.02);
  });
});
