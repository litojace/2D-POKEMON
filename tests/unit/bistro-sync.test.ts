import { describe, expect, it, vi } from "vitest";
import {
  BistroSync,
  type BistroAction,
} from "../../apps/client/src/bistro/bistro-sync";
import { defaultState } from "../../packages/shared/src/bistro";

const server = () => ({
  ...defaultState(),
  // Enough for the purchases these tests make.
  coins: 5000,
  special: "banhmi",
  chef: "voltkit",
  now: Date.now(),
});
const hooks = () => ({ onAdopt: vi.fn(), onFail: vi.fn() });
/** The actions without when they were done (each carries its own `at`). */
const bare = (xs: BistroAction[]) =>
  xs.map(({ at, ...x }) => (expect(at).toBeTypeOf("number"), x));

describe("bistro sync: a batch keeps its request id", () => {
  it("a retry after a failure sends the same id, so the server applies it once", async () => {
    vi.useFakeTimers();
    const calls: [string, BistroAction[]][] = [];
    let fail = true;
    const api = {
      load: async () => server(),
      act: async (id: string, actions: BistroAction[]) => {
        calls.push([id, actions]);
        if (fail) throw new Error("offline");
        return { bistro: server(), results: actions.map(() => ({ ok: true })) };
      },
    };
    const sync = new BistroSync(api, hooks());
    await sync.load();
    sync.do({ a: "buy", kind: "plant" });
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toHaveLength(1);
    fail = false;
    sync.do({ a: "buy", kind: "chair" }); // queued behind the unanswered batch
    await vi.advanceTimersByTimeAsync(4100);
    expect(calls[1][0]).toBe(calls[0][0]);
    expect(bare(calls[1][1])).toEqual([{ a: "buy", kind: "plant" }]);
    // When it was done goes with it, the same on the retry.
    expect(calls[1][1][0].at).toBe(calls[0][1][0].at);
    await vi.advanceTimersByTimeAsync(300);
    expect(bare(calls[2][1])).toEqual([{ a: "buy", kind: "chair" }]);
    expect(calls[2][0]).not.toBe(calls[0][0]);
    vi.useRealTimers();
  });
  it("a page closed mid-send sends the same batch again when it opens", async () => {
    vi.useFakeTimers();
    const calls: [string, BistroAction[]][] = [];
    const never = {
      load: async () => server(),
      act: () => new Promise<never>(() => {}),
    };
    const first = new BistroSync(
      {
        load: never.load,
        act: (id: string, a: BistroAction[]) => (
          calls.push([id, a]),
          never.act()
        ),
      },
      hooks(),
    );
    await first.load();
    first.do({ a: "buy", kind: "plant" });
    await vi.advanceTimersByTimeAsync(200);
    const kept = JSON.parse(JSON.stringify(first.snapshot()));
    expect(bare(kept.pending.actions)).toEqual([{ a: "buy", kind: "plant" }]);
    const second = new BistroSync(
      {
        load: async () => server(),
        act: async (id: string, a: BistroAction[]) => (
          calls.push([id, a]),
          { bistro: server(), results: [] }
        ),
      },
      hooks(),
    );
    second.restore(kept);
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    vi.useRealTimers();
  });
  it("orders guests made keep their servings through a restore", async () => {
    const api = {
      load: async () => server(),
      act: async () => ({ bistro: server(), results: [] }),
    };
    const sync = new BistroSync(api, hooks());
    await sync.load();
    expect(sync.reserve(7, "goicuon")).toBe(true);
    const snap = JSON.parse(JSON.stringify(sync.snapshot()));
    const again = new BistroSync(api, hooks());
    again.restore(snap);
    await again.load();
    expect(again.S.counter[0]?.servings).toBe(5);
    expect(again.reservedCount()).toBe(1);
  });
  it("a batch the server keeps refusing goes one by one, and only the bad action is lost", async () => {
    vi.useFakeTimers();
    const calls: [string, BistroAction[]][] = [];
    const refuse = () =>
      Object.assign(new Error("Invalid request."), { status: 400 });
    const api = {
      load: async () => ({ ...server(), coins: 100000 }),
      act: async (id: string, actions: BistroAction[]) => {
        calls.push([id, actions]);
        if (actions.some((x) => x.a === "buy" && x.kind === "rug"))
          throw refuse();
        return {
          bistro: { ...server(), coins: 100000 },
          results: actions.map(() => ({ ok: true })),
        };
      },
    };
    const h = hooks();
    const sync = new BistroSync(api, h);
    await sync.load();
    sync.do({ a: "buy", kind: "plant" });
    sync.do({ a: "buy", kind: "rug" });
    sync.do({ a: "buy", kind: "chair" });
    await vi.advanceTimersByTimeAsync(200);
    // A refusal may pass: the same batch, same id, twice more.
    await vi.advanceTimersByTimeAsync(1600);
    await vi.advanceTimersByTimeAsync(1600);
    expect(calls.slice(0, 3).map((c) => c[0])).toEqual(
      Array(3).fill(calls[0][0]),
    );
    // Then one action per batch, each with a new id.
    await vi.advanceTimersByTimeAsync(10000);
    const after = calls.slice(3);
    expect(after.every((c) => c[1].length === 1)).toBe(true);
    expect(new Set(after.map((c) => c[0])).has(calls[0][0])).toBe(false);
    const kinds = after.map((c) => (c[1][0] as { kind: string }).kind);
    expect(kinds).toEqual(["plant", "rug", "rug", "rug", "chair"]);
    // Nothing waits any more, and the lost action was reported.
    expect(sync.snapshot().pending).toBeNull();
    expect(sync.snapshot().outbox).toEqual([]);
    const errors = h.onAdopt.mock.calls.flatMap((c) => c[0].errors);
    expect(errors).toEqual([
      {
        action: { a: "buy", kind: "rug", at: expect.any(Number) },
        error: "That change couldn't be saved.",
      },
    ]);
    vi.useRealTimers();
  });
  it("a lone refused action still brings the server's bistro back", async () => {
    vi.useFakeTimers();
    const calls: BistroAction[][] = [];
    const api = {
      load: async () => ({ ...server(), coins: 100000 }),
      act: async (_id: string, actions: BistroAction[]) => {
        calls.push(actions);
        if (actions[0].a === "buy")
          throw Object.assign(new Error("Invalid request."), { status: 400 });
        return {
          bistro: { ...server(), coins: 100000 },
          results: actions.map(() => ({ ok: true })),
        };
      },
    };
    const sync = new BistroSync(api, hooks());
    await sync.load();
    sync.do({ a: "buy", kind: "plant" });
    expect(sync.S.coins).toBeLessThan(100000);
    await vi.advanceTimersByTimeAsync(10000);
    expect(calls.map((c) => c[0].a)).toEqual(["buy", "buy", "buy", "sync"]);
    expect(sync.S.coins).toBe(100000); // the server's, without the purchase
    vi.useRealTimers();
  });
  it("a fault that isn't a refusal keeps trying the same batch", async () => {
    vi.useFakeTimers();
    const ids: string[] = [];
    const api = {
      load: async () => ({ ...server(), coins: 100000 }),
      act: async (id: string) => {
        ids.push(id);
        throw Object.assign(new Error("Account service failed."), {
          status: 500,
        });
      },
    };
    const sync = new BistroSync(api, hooks());
    await sync.load();
    sync.do({ a: "buy", kind: "plant" });
    await vi.advanceTimersByTimeAsync(30000);
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids).size).toBe(1);
    vi.useRealTimers();
  });
});

describe("bistro sync: the server's clock", () => {
  it("keeps the tightest bound: a slow answer doesn't set it back; a changed device clock starts it again", async () => {
    vi.useFakeTimers();
    const skew = 60_000;
    let shift = 0;
    let delay = 0;
    // The server stamps its time, then the answer takes `delay` to arrive.
    const answer = async () => {
      const now = Date.now() + skew + shift;
      if (delay) await new Promise((r) => setTimeout(r, delay));
      return { ...server(), now };
    };
    const sync = new BistroSync(
      {
        load: answer,
        act: async () => ({ bistro: await answer(), results: [] }),
      },
      hooks(),
    );
    await sync.load();
    expect(sync.now() - Date.now()).toBe(skew);
    delay = 2000;
    const slow = sync.load();
    await vi.advanceTimersByTimeAsync(2000);
    await slow;
    // (Taken as it came, the clock would go 2 s back, and every timer with it.)
    expect(sync.now() - Date.now()).toBe(skew);
    // This device's clock is set an hour back: the next answer doesn't fit
    // the others, so the clock starts again from it.
    delay = 0;
    vi.setSystemTime(Date.now() - 3_600_000);
    shift = 3_600_000;
    await sync.load();
    expect(sync.now() - Date.now()).toBe(skew + 3_600_000);
    vi.useRealTimers();
  });
});
