import { expect, it } from "vitest";
import {
  clearWithCameraBackdrop,
  takeCameraBackdrop,
  type BackdropCamera,
  type BackdropColor,
} from "../../apps/client/src/camera-clear";

function color(red: number, green: number, blue: number, alpha = 255) {
  const c: BackdropColor = {
    red,
    green,
    blue,
    alpha,
    setTo(r, g, b, a = 255) {
      c.red = r;
      c.green = g;
      c.blue = b;
      c.alpha = a;
    },
  };
  return c;
}
function camera(over: Partial<BackdropCamera> = {}): BackdropCamera {
  return {
    x: 0,
    y: 0,
    width: 1266,
    height: 585,
    visible: true,
    mask: null,
    backgroundColor: color(0x14, 0x27, 0x46),
    ...over,
  };
}

it("clears with a full-screen camera's colour and skips its rectangle", () => {
  const clear = color(0x1e, 0x35, 0x57);
  const cam = camera();
  const restore = takeCameraBackdrop(cam, clear, 1266, 585);
  expect([clear.red, clear.green, clear.blue, clear.alpha]).toEqual([
    0x14, 0x27, 0x46, 255,
  ]);
  // Phaser draws a camera's background only while its alpha is above 0.
  expect(cam.backgroundColor.alpha).toBe(0);
  restore!();
  expect(cam.backgroundColor.alpha).toBe(255);
  expect(cam.backgroundColor.red).toBe(0x14);
  // The game's own clear colour comes back with it.
  expect([clear.red, clear.green, clear.blue, clear.alpha]).toEqual([
    0x1e, 0x35, 0x57, 255,
  ]);
});

it("leaves Phaser to draw backgrounds that would not look the same", () => {
  const cases: [string, BackdropCamera | undefined][] = [
    ["no camera", undefined],
    ["a hidden camera", camera({ visible: false })],
    ["a masked camera", camera({ mask: {} })],
    [
      "a see-through background",
      camera({ backgroundColor: color(10, 20, 30, 128) }),
    ],
    [
      "a transparent background",
      camera({ backgroundColor: color(0, 0, 0, 0) }),
    ],
    ["a camera short of the right edge", camera({ width: 1200 })],
    ["a camera short of the bottom", camera({ height: 500 })],
    ["an inset camera", camera({ x: 10 })],
  ];
  for (const [what, cam] of cases) {
    const clear = color(1, 2, 3);
    const before = cam ? cam.backgroundColor.alpha : 0;
    expect(takeCameraBackdrop(cam, clear, 1266, 585), what).toBeUndefined();
    expect([clear.red, clear.green, clear.blue], what).toEqual([1, 2, 3]);
    if (cam) expect(cam.backgroundColor.alpha, what).toBe(before);
  }
});

it("wraps the renderer: the camera has its colour back after every frame", () => {
  const clear = color(0x1e, 0x35, 0x57);
  const cam = camera();
  const seen: number[] = [];
  const renderer = {
    config: { backgroundColor: clear },
    width: 1266,
    height: 585,
    preRender() {
      seen.push(clear.red);
    },
    postRender() {
      // Cameras are drawn between preRender and postRender.
      seen.push(cam.backgroundColor.alpha);
    },
  };
  clearWithCameraBackdrop(renderer, () => cam);
  for (let frame = 0; frame < 3; frame++) {
    renderer.preRender();
    renderer.postRender();
    expect(cam.backgroundColor.alpha).toBe(255);
  }
  expect(seen).toEqual([0x14, 0, 0x14, 0, 0x14, 0]);
  // A new colour (a raid's edge) is the clear colour from the next frame.
  cam.backgroundColor.setTo(0x30, 0x20, 0x10);
  renderer.preRender();
  expect([clear.red, clear.green, clear.blue]).toEqual([0x30, 0x20, 0x10]);
  renderer.postRender();
  // After each frame the clear is the game's own colour again, so a frame
  // without a usable camera (the scene asleep under the hub) clears with it,
  // not the last battle's, and never touches the camera.
  expect([clear.red, clear.green, clear.blue]).toEqual([0x1e, 0x35, 0x57]);
  const hidden = camera({ visible: false });
  const asleep = { ...renderer, preRender() {}, postRender() {} };
  clearWithCameraBackdrop(asleep, () => hidden);
  asleep.preRender();
  expect([clear.red, clear.green, clear.blue]).toEqual([0x1e, 0x35, 0x57]);
  expect(hidden.backgroundColor.alpha).toBe(255);
  asleep.postRender();
});

it("puts the camera back even when a frame's rendering throws", () => {
  const clear = color(0, 0, 0);
  const cam = camera();
  const renderer = {
    config: { backgroundColor: clear },
    width: 1266,
    height: 585,
    preRender() {},
    postRender() {
      throw new Error("lost context");
    },
  };
  clearWithCameraBackdrop(renderer, () => cam);
  renderer.preRender();
  expect(cam.backgroundColor.alpha).toBe(0);
  expect(() => renderer.postRender()).toThrow("lost context");
  expect(cam.backgroundColor.alpha).toBe(255);
});
