import { describe, expect, it } from "vitest";
import { QuickQueue } from "../../apps/server/src/matchmaking";

const entry = (n: number, account = `acc-${n}`) => ({
  socketId: `sock-${n}`,
  accountId: account,
  since: n,
});

describe("Quick Match queue", () => {
  it("a lone player waits; the next one meets them at once", () => {
    const q = new QuickQueue();
    expect(q.join(entry(1))).toBeNull();
    expect(q.size).toBe(1);
    expect(q.join(entry(2))?.socketId).toBe("sock-1");
    expect(q.size).toBe(0);
  });

  it("pairs the longest-waiting player first", () => {
    const q = new QuickQueue((a, b) => !(a === "acc-1" && b === "acc-2"));
    q.join(entry(1));
    // acc-1 blocked acc-2: acc-2 waits instead of meeting acc-1.
    expect(q.join(entry(2))).toBeNull();
    expect(q.join(entry(3))?.socketId).toBe("sock-1");
    expect(q.has("sock-2")).toBe(true);
  });

  it("never pairs an account with itself, and a second device replaces the first", () => {
    const q = new QuickQueue();
    q.join(entry(1, "same"));
    expect(q.join(entry(2, "same"))).toBeNull();
    expect(q.size).toBe(1);
    expect(q.has("sock-1")).toBe(false);
    expect(q.has("sock-2")).toBe(true);
  });

  it("checks blocks both ways", () => {
    const q = new QuickQueue((a, b) => !(a === "acc-2" && b === "acc-1"));
    q.join(entry(1));
    expect(q.join(entry(2))).toBeNull();
  });

  it("leaving takes the player out, once", () => {
    const q = new QuickQueue();
    q.join(entry(1));
    expect(q.leave("sock-1")?.accountId).toBe("acc-1");
    expect(q.leave("sock-1")).toBeNull();
    expect(q.join(entry(2))).toBeNull();
  });
});
