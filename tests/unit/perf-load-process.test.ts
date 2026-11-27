import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ask, verifyRenderLimits } from "../../scripts/perf/load-process.mjs";

afterEach(() => vi.useRealTimers());

describe("Render load-test limits", () => {
  it("accepts the production 1 CPU / 2 GB cgroup", () => {
    expect(verifyRenderLimits("100000 100000\n", "2147483648\n")).toMatchObject(
      {
        profile: "render-1c-2g",
        verified: true,
        cpu: 1,
        memoryBytes: 2147483648,
      },
    );
  });

  it.each([
    ["50000 100000", "2147483648"],
    ["100000 100000", "536870912"],
    ["200000 100000", "2147483648"],
    ["max 100000", "2147483648"],
    ["100000 100000", "max"],
    ["", ""],
  ])("rejects an old, missing or uncapped profile (%s, %s)", (cpu, memory) => {
    expect(() => verifyRenderLimits(cpu, memory)).toThrow(
      "Expected 1 CPU / 2 GiB",
    );
  });
});

describe("load-server control", () => {
  function channel() {
    return Object.assign(new EventEmitter(), { send: vi.fn() });
  }

  it("ignores other messages and removes listeners after the matching reply", async () => {
    const child = channel();
    const reply = ask(child, { cmd: "report" }, "report");
    child.emit("message", { type: "fighting" });
    child.emit("message", { type: "report", report: { rooms: 4 } });
    await expect(reply).resolves.toEqual({
      type: "report",
      report: { rooms: 4 },
    });
    expect(
      child.listenerCount("message") + child.listenerCount("failure"),
    ).toBe(0);
  });

  it("fails promptly when the server exits", async () => {
    const child = channel();
    const reply = ask(child, { cmd: "report" }, "report");
    child.emit("failure", new Error("server exited"));
    await expect(reply).rejects.toThrow("server exited");
    expect(
      child.listenerCount("message") + child.listenerCount("failure"),
    ).toBe(0);
  });

  it("bounds a missing reply and cleans up", async () => {
    vi.useFakeTimers();
    const child = channel();
    const reply = expect(
      ask(child, { cmd: "report" }, "report", 20),
    ).rejects.toThrow("did not reply");
    await vi.advanceTimersByTimeAsync(20);
    await reply;
    expect(
      child.listenerCount("message") + child.listenerCount("failure"),
    ).toBe(0);
  });
});
