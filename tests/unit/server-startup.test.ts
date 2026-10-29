import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ServerStartup,
  type StartupStatus,
} from "../../apps/client/src/server-startup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const options = {
  deadlineMs: 1000,
  requestMs: 200,
  retryMs: 100,
  freshMs: 2000,
};

it("shares the readiness request between auth and sockets, then caches warm success", async () => {
  let release!: (ready: boolean) => void;
  const probe = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        release = resolve;
      }),
  );
  const statuses: StartupStatus[] = [];
  const startup = new ServerStartup(
    probe,
    (s) => statuses.push(s),
    () => true,
    options,
  );
  const first = startup.wait();
  expect(startup.wait()).toBe(first);
  release(true);
  await first;
  await startup.wait();
  expect(probe).toHaveBeenCalledTimes(1);
  expect(statuses).toEqual(["connecting", "ready"]);
  expect(vi.getTimerCount()).toBe(0);
});

it("retries cold-start responses and network errors before allowing the profile request", async () => {
  const probe = vi
    .fn()
    .mockResolvedValueOnce(false)
    .mockRejectedValueOnce(Error("502 HTML"))
    .mockResolvedValueOnce(true);
  const statuses: StartupStatus[] = [];
  const startup = new ServerStartup(
    probe,
    (s) => statuses.push(s),
    () => true,
    options,
  );
  const profile = vi.fn();
  const load = startup.wait().then(profile);
  await vi.advanceTimersByTimeAsync(150);
  expect(profile).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(100);
  await load;
  expect(probe).toHaveBeenCalledTimes(3);
  expect(profile).toHaveBeenCalledTimes(1);
  expect(statuses).toEqual(["connecting", "waiting", "waiting", "ready"]);
});

it("bounds hung fetches, aborts them and allows a fresh manual retry", async () => {
  const signals: AbortSignal[] = [];
  const probe = vi.fn((signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<boolean>(() => {});
  });
  const statuses: StartupStatus[] = [];
  const startup = new ServerStartup(
    probe,
    (s) => statuses.push(s),
    () => true,
    options,
  );
  const failed = expect(startup.wait()).rejects.toThrow("taking longer");
  await vi.advanceTimersByTimeAsync(1000);
  await failed;
  expect(signals.length).toBeGreaterThan(1);
  expect(signals.every((s) => s.aborted)).toBe(true);
  expect(statuses.at(-1)).toBe("failed");
  probe.mockImplementation(async () => true);
  await startup.wait();
  expect(statuses.at(-1)).toBe("ready");
  expect(vi.getTimerCount()).toBe(0);
});

it("does not fetch while offline and resumes automatically when connectivity returns", async () => {
  let online = false;
  const probe = vi.fn(async () => true);
  const statuses: StartupStatus[] = [];
  const startup = new ServerStartup(
    probe,
    (s) => statuses.push(s),
    () => online,
    options,
  );
  const task = startup.wait();
  await vi.advanceTimersByTimeAsync(200);
  expect(probe).not.toHaveBeenCalled();
  expect(statuses[0]).toBe("offline");
  online = true;
  await vi.advanceTimersByTimeAsync(100);
  await task;
  expect(probe).toHaveBeenCalledTimes(1);
});

it("rechecks on a later login after an idle tab, without scheduling keep-alive pings", async () => {
  const probe = vi.fn(async () => true);
  const startup = new ServerStartup(
    probe,
    () => {},
    () => true,
    options,
  );
  await startup.wait();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(probe).toHaveBeenCalledTimes(1);
  await startup.wait();
  expect(probe).toHaveBeenCalledTimes(2);
});
