import { expect, it } from "vitest";
import {
  FrameCap,
  capGameFrames,
  screenHz,
} from "../../apps/client/src/frame-cap";

/** Frames drawn a second on a screen of `hz`, with rAF times that wobble. */
function drawn(hz: number, seconds = 3, wobble = 0.4, enabled = true) {
  const cap = new FrameCap(() => enabled);
  let t = 1000,
    frames = 0,
    longest = 0,
    lastDrawn = 0;
  const steps = Math.round(seconds * hz);
  for (let i = 0; i < steps; i++) {
    t += 1000 / hz + (i % 2 ? wobble : -wobble);
    if (cap.draw(t)) {
      // Skip the first quarter second (learning the screen).
      if (t > 1250) {
        frames++;
        if (lastDrawn) longest = Math.max(longest, t - lastDrawn);
      }
      lastDrawn = t;
    }
  }
  return { fps: frames / (seconds - 0.25), longest };
}

it("holds a 120 or 144 Hz screen to about 60 frames a second", () => {
  const at120 = drawn(120);
  expect(at120.fps).toBeGreaterThan(58);
  expect(at120.fps).toBeLessThan(62);
  // Every other refresh: never two skipped in a row.
  expect(at120.longest).toBeLessThan(18);
  const at144 = drawn(144);
  expect(at144.fps).toBeGreaterThan(60);
  expect(at144.fps).toBeLessThan(75);
});

it("leaves 60 and 90 Hz screens alone", () => {
  expect(drawn(60).fps).toBeGreaterThan(59);
  // A cap at 90 Hz would give 45 fps or an uneven 60: none.
  expect(drawn(90).fps).toBeGreaterThan(89);
  // Switched off, a fast screen draws every frame.
  expect(drawn(120, 3, 0.4, false).fps).toBeGreaterThan(118);
});

it("draws a late frame at once (a refresh missed)", () => {
  const cap = new FrameCap();
  let t = 0;
  for (let i = 0; i < 64; i++) cap.draw((t += 1000 / 120));
  // Draw on this frame; the next refresh is skipped as usual...
  expect([cap.draw((t += 8.33)), cap.draw((t += 8.33))]).toContain(false);
  cap.draw((t += 8.33));
  // ...but after a hitch the next frame draws straight away.
  expect(cap.draw((t += 25))).toBe(true);
});

it("gives a Phaser game every millisecond of the frames it skips", () => {
  const seen: number[] = [];
  const game = {
    step: (_time: number, delta: number) => {
      seen.push(delta);
    },
  };
  capGameFrames(game);
  let t = 0;
  for (let i = 0; i < 600; i++) {
    t += 1000 / 120;
    game.step(t, 1000 / 120);
  }
  const total = seen.reduce((a, b) => a + b, 0);
  // Five seconds of 120 Hz frames, about half of them drawn, no time lost
  // (bar the frames still owed at the end).
  expect(seen.length).toBeLessThan(340);
  expect(total).toBeGreaterThan(5000 - 2 * (1000 / 120));
  expect(total).toBeLessThanOrEqual(5000 + 1e-6);
});

it("is not fooled by two calls in one frame, and reports only a screen's rate", () => {
  // A slow device (3 fps) whose loop sometimes runs twice in one frame.
  const cap = new FrameCap();
  let t = 0;
  for (let i = 0; i < 60; i++) {
    cap.draw((t += 300));
    cap.draw((t += 0.05));
  }
  expect(cap.refresh).toBe(0);
  expect(screenHz(cap)).toBeUndefined();
  // A 120 Hz screen reports 120; nothing measured reports nothing.
  const fast = new FrameCap();
  t = 0;
  for (let i = 0; i < 60; i++) fast.draw((t += 1000 / 120));
  expect(screenHz(fast)).toBe(120);
  expect(screenHz(undefined)).toBeUndefined();
});
