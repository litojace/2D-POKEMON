import { expect, it, vi } from "vitest";
import { PwaAutoUpdate } from "../../apps/client/src/pwa-auto-update";
import {
  peerMatchActive,
  safeToUpdate,
} from "../../apps/client/src/pwa-policy";

it("activates an available update automatically and reloads only after activation", async () => {
  const activate = vi.fn(async () => {}),
    reload = vi.fn();
  const gate = new PwaAutoUpdate({
    safe: () => true,
    activate,
    reload,
    now: () => 0,
  });
  await gate.sync();
  expect(activate).not.toHaveBeenCalled();
  gate.available();
  await gate.sync();
  expect(activate).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  gate.activated();
  await gate.sync();
  await gate.sync();
  expect(reload).toHaveBeenCalledTimes(1);
});
it("waits through all live match phases and peer matches before activation or reload", async () => {
  let phase: string | undefined = "playing",
    peer = true;
  const activate = vi.fn(async () => {}),
    reload = vi.fn();
  const gate = new PwaAutoUpdate({
    safe: () =>
      safeToUpdate(phase) &&
      !peerMatchActive([{ active: peer, at: 1000 }], 2000),
    activate,
    reload,
    now: () => 0,
  });
  gate.available();
  for (phase of ["playing", "briefing", "countdown", "intermission", "paused"])
    await gate.sync();
  expect(activate).not.toHaveBeenCalled();
  phase = "lobby";
  await gate.sync();
  expect(activate).not.toHaveBeenCalled();
  peer = false;
  await gate.sync();
  expect(activate).toHaveBeenCalledTimes(1);
  phase = "playing";
  gate.activated();
  await gate.sync();
  expect(reload).not.toHaveBeenCalled();
  phase = "finished";
  await gate.sync();
  expect(reload).not.toHaveBeenCalled();
  phase = "lobby";
  await gate.sync();
  expect(reload).toHaveBeenCalledTimes(1);
});
it("avoids duplicate activations and checks safety again when activation finishes", async () => {
  let safe = true,
    finish!: () => void;
  const activate = vi.fn(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    ),
    reload = vi.fn();
  const gate = new PwaAutoUpdate({
    safe: () => safe,
    activate,
    reload,
    now: () => 0,
  });
  gate.available();
  const running = gate.sync();
  await gate.sync();
  expect(activate).toHaveBeenCalledTimes(1);
  safe = false;
  gate.activated();
  finish();
  await running;
  expect(reload).not.toHaveBeenCalled();
  safe = true;
  await gate.sync();
  expect(reload).toHaveBeenCalledTimes(1);
});
it("retries failed activation automatically with backoff and waits while hidden or offline", async () => {
  let now = 0,
    visible = true,
    online = true;
  const activate = vi.fn(async () => {
      throw Error("temporarily unavailable");
    }),
    reload = vi.fn();
  const gate = new PwaAutoUpdate({
    safe: () => visible && online,
    activate,
    reload,
    now: () => now,
  });
  gate.available();
  visible = false;
  await gate.sync();
  visible = true;
  online = false;
  await gate.sync();
  expect(activate).not.toHaveBeenCalled();
  online = true;
  await gate.sync();
  await gate.sync();
  expect(activate).toHaveBeenCalledTimes(1);
  now = 15000;
  await gate.sync();
  expect(activate).toHaveBeenCalledTimes(2);
  expect(gate.waiting).toBe(true);
});
