import { describe, expect, it, vi } from "vitest";
import {
  BistroSync,
  type BistroAction,
} from "../../apps/client/src/bistro/bistro-sync";
import { defaultState } from "../../packages/shared/src/bistro";

const server = () => ({
  ...defaultState(),
  special: "banhmi",
  chef: "voltkit",
  now: Date.now(),
});
const hooks = () => ({ onAdopt: vi.fn(), onFail: vi.fn() });

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
    expect(calls[1][1]).toEqual([{ a: "buy", kind: "plant" }]);
    await vi.advanceTimersByTimeAsync(300);
    expect(calls[2][1]).toEqual([{ a: "buy", kind: "chair" }]);
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
    expect(kept.pending.actions).toEqual([{ a: "buy", kind: "plant" }]);
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
});
