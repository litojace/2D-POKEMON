import { describe, expect, it } from "vitest";
import { GroupQueue, QuickQueue } from "../../apps/server/src/matchmaking";

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

// 2v2 and Free-for-all: searchers gather; a full group plays at once, and a
// player who won't wait plays with whoever is there (bots take the rest).
describe("group queue (2v2, Free-for-all)", () => {
  it("players wait until four are searching, then all play, longest wait first", () => {
    const q = new GroupQueue(4);
    expect(q.join(entry(1))).toBeNull();
    expect(q.join(entry(2))).toBeNull();
    expect(q.join(entry(3))).toBeNull();
    expect(q.length).toBe(3);
    expect(q.join(entry(4))?.map((e) => e.socketId)).toEqual([
      "sock-1",
      "sock-2",
      "sock-3",
      "sock-4",
    ]);
    expect(q.length).toBe(0);
  });
  it("a player who won't wait takes everyone searching with them", () => {
    const q = new GroupQueue(4);
    q.join(entry(1));
    q.join(entry(2));
    q.join(entry(3));
    // The second to search asks: they come first, the others by their wait.
    expect(q.fill("sock-2").map((e) => e.socketId)).toEqual([
      "sock-2",
      "sock-1",
      "sock-3",
    ]);
    expect(q.length).toBe(0);
  });
  it("alone, they play alone (with bots)", () => {
    const q = new GroupQueue(4);
    q.join(entry(1));
    expect(q.fill("sock-1").map((e) => e.socketId)).toEqual(["sock-1"]);
    expect(q.fill("sock-1")).toEqual([]);
    expect(q.fill("sock-9")).toEqual([]);
  });
  it("never seats more than the mode holds", () => {
    const q = new GroupQueue(2);
    q.join(entry(1));
    // (A queue of two fills as the second joins.)
    expect(q.join(entry(2))).toHaveLength(2);
    const big = new GroupQueue(3);
    big.join(entry(1));
    big.join(entry(2));
    expect(big.join(entry(3))).toHaveLength(3);
    expect(big.join(entry(4))).toBeNull();
    expect(big.length).toBe(1);
  });
  it("never puts a player with someone they blocked, or who blocked them", () => {
    const blocks = (a: string, b: string) => !(a === "acc-1" && b === "acc-2");
    const q = new GroupQueue(3, blocks);
    q.join(entry(1));
    q.join(entry(2));
    // Three searching, but 1 and 2 can't share a match: nobody plays yet.
    expect(q.join(entry(3))).toBeNull();
    expect(q.length).toBe(3);
    // 2 starts: with 3, not with 1.
    expect(q.fill("sock-2").map((e) => e.socketId)).toEqual([
      "sock-2",
      "sock-3",
    ]);
    expect(q.has("sock-1")).toBe(true);
  });
  it("an account searching again replaces its earlier search, and can leave", () => {
    const q = new GroupQueue(4);
    q.join(entry(1, "same"));
    q.join(entry(2, "same"));
    expect(q.length).toBe(1);
    expect(q.has("sock-1")).toBe(false);
    expect(q.leave("sock-2")?.socketId).toBe("sock-2");
    expect(q.leave("sock-2")).toBeNull();
    expect(q.length).toBe(0);
  });
});
