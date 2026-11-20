import { expect, it, vi } from "vitest";
import {
  PwaAutoUpdate,
  UPDATE_SNOOZE_MS,
} from "../../apps/client/src/pwa-auto-update";
import {
  peerMatchActive,
  safeToUpdate,
} from "../../apps/client/src/pwa-policy";

it("activates an accepted update and reloads only after activation", async () => {
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
  await gate.accept();
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
  gate.accepted = true;
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
  const running = gate.accept();
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
it("retries a failed accepted activation with backoff and waits while hidden or offline", async () => {
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
  gate.accepted = true;
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
it("defers activation and an already-activated reload while a Shop or other menu is open", async () => {
  let menuOpen = true;
  const activate = vi.fn(async () => {}),
    reload = vi.fn();
  const gate = new PwaAutoUpdate({
    safe: () => safeToUpdate(undefined, menuOpen),
    activate,
    reload,
    now: () => 0,
  });
  gate.available();
  gate.accepted = true;
  await gate.sync();
  expect(activate).not.toHaveBeenCalled();
  gate.activated();
  await gate.sync();
  expect(reload).not.toHaveBeenCalled();
  menuOpen = false;
  await gate.sync();
  expect(reload).toHaveBeenCalledOnce();
  expect(safeToUpdate("lobby", true)).toBe(false);
  expect(safeToUpdate("playing", false)).toBe(false);
});
it("asks only where updating is safe, and changes nothing until the player accepts", async () => {
  let now = 0,
    safe = false;
  const activate = vi.fn(async () => {}),
    reload = vi.fn();
  const gate = new PwaAutoUpdate({
    safe: () => safe,
    activate,
    reload,
    now: () => now,
  });
  expect(gate.asking).toBe(false);
  gate.available();
  // Mid-match: no prompt, and nothing applies on its own.
  expect(gate.asking).toBe(false);
  await gate.sync();
  safe = true;
  expect(gate.asking).toBe(true);
  await gate.sync();
  await gate.sync();
  expect(activate).not.toHaveBeenCalled();
  // Later: gone until the snooze ends, then asks again.
  gate.later();
  expect(gate.asking).toBe(false);
  now = UPDATE_SNOOZE_MS - 1;
  expect(gate.asking).toBe(false);
  now = UPDATE_SNOOZE_MS;
  expect(gate.asking).toBe(true);
  await gate.accept();
  expect(gate.asking).toBe(false);
  expect(activate).toHaveBeenCalledOnce();
  gate.activated();
  await gate.sync();
  expect(reload).toHaveBeenCalledOnce();
});
it("asks before reloading into an update another tab already activated", async () => {
  const reload = vi.fn();
  const gate = new PwaAutoUpdate({
    safe: () => true,
    activate: async () => {},
    reload,
    now: () => 0,
  });
  gate.activated();
  expect(gate.asking).toBe(true);
  await gate.sync();
  expect(reload).not.toHaveBeenCalled();
  await gate.accept();
  expect(reload).toHaveBeenCalledOnce();
});
