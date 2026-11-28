import { describe, expect, it } from "vitest";
import { ServerCopies } from "../../apps/client/src/server-copies";

/** A fake server: each path answers what `answers` holds now; asks are counted. */
function server() {
  const answers = new Map<string, unknown>();
  const asks: string[] = [];
  let fail = false;
  let clock = 0;
  const copies = new ServerCopies(
    async (path) => {
      asks.push(path);
      if (fail) throw new Error("offline");
      return structuredClone(answers.get(path));
    },
    () => clock,
  );
  return {
    copies,
    asks,
    answers,
    later: (ms: number) => (clock += ms),
    failing: (on: boolean) => (fail = on),
  };
}

describe("the server's copies the Lobby's screens are drawn from", () => {
  it("a copy younger than its max age is used again without asking", async () => {
    const s = server();
    s.answers.set("/api/friends", { friends: [] });
    const a = await s.copies.get("me /api/friends", "/api/friends", 10_000);
    s.later(9_000);
    const b = await s.copies.get("me /api/friends", "/api/friends", 10_000);
    expect(b).toBe(a);
    expect(s.asks).toEqual(["/api/friends"]);
  });

  it("two screens asking at once share one request", async () => {
    const s = server();
    s.answers.set("/api/raids", { clears: 1 });
    const [a, b] = await Promise.all([
      s.copies.get("me /api/raids", "/api/raids", 30_000),
      s.copies.get("me /api/raids", "/api/raids", 30_000),
    ]);
    expect(a).toBe(b);
    expect(s.asks).toHaveLength(1);
  });

  it("an old copy is asked again; the same answer is the same object (no redraw)", async () => {
    const s = server();
    s.answers.set("/api/leaderboard", {
      rows: [{ name: "Aria", rating: 1200 }],
    });
    const drawn = await s.copies.get(
      "me /api/leaderboard",
      "/api/leaderboard",
      30_000,
    );
    s.later(31_000);
    const again = await s.copies.get(
      "me /api/leaderboard",
      "/api/leaderboard",
      30_000,
    );
    expect(s.asks).toHaveLength(2);
    expect(again).toBe(drawn);
  });

  it("a changed answer is a new object (the screen redraws)", async () => {
    const s = server();
    s.answers.set("/api/friends", { friends: [{ id: "a", online: false }] });
    const drawn = await s.copies.get("me /api/friends", "/api/friends", 10_000);
    s.answers.set("/api/friends", { friends: [{ id: "a", online: true }] });
    s.later(11_000);
    const fresh = await s.copies.get("me /api/friends", "/api/friends", 10_000);
    expect(fresh).not.toBe(drawn);
    expect(fresh).toEqual({ friends: [{ id: "a", online: true }] });
  });

  it("forget() makes the next screen ask, and still keeps an unchanged answer's object", async () => {
    const s = server();
    s.answers.set("/api/progress", { wins: 3 });
    const drawn = await s.copies.get(
      "me /api/progress",
      "/api/progress",
      30_000,
    );
    // A POST, or the server saying records changed.
    s.copies.forget();
    const same = await s.copies.get(
      "me /api/progress",
      "/api/progress",
      30_000,
    );
    expect(s.asks).toHaveLength(2);
    expect(same).toBe(drawn);
    s.answers.set("/api/progress", { wins: 4 });
    s.copies.forget();
    const won = await s.copies.get("me /api/progress", "/api/progress", 30_000);
    expect(won).not.toBe(drawn);
    expect(won).toEqual({ wins: 4 });
  });

  it("a copy changed in place is never handed back for its old answer", async () => {
    const s = server();
    s.answers.set("/api/economy", { balance: 100 });
    const drawn = (await s.copies.get(
      "me /api/economy",
      "/api/economy",
      30_000,
    )) as {
      balance: number;
    };
    drawn.balance = 50;
    s.later(31_000);
    const fresh = await s.copies.get("me /api/economy", "/api/economy", 30_000);
    expect(fresh).not.toBe(drawn);
    expect(fresh).toEqual({ balance: 100 });
  });

  it("another player shares nothing with the last one", async () => {
    const s = server();
    s.answers.set("/api/friends", { friends: [] });
    const mine = await s.copies.get("a /api/friends", "/api/friends", 10_000);
    s.copies.forgetAll();
    const theirs = await s.copies.get("b /api/friends", "/api/friends", 10_000);
    expect(theirs).not.toBe(mine);
    // Even under the same key, nothing of before is reused.
    s.copies.forgetAll();
    const again = await s.copies.get("a /api/friends", "/api/friends", 10_000);
    expect(again).not.toBe(mine);
    expect(s.asks).toHaveLength(3);
  });

  it("a failed answer isn't kept: the next screen asks again", async () => {
    const s = server();
    s.answers.set("/api/friends", { friends: [] });
    s.failing(true);
    await expect(
      s.copies.get("me /api/friends", "/api/friends", 10_000),
    ).rejects.toThrow("offline");
    s.failing(false);
    await expect(
      s.copies.get("me /api/friends", "/api/friends", 10_000),
    ).resolves.toEqual({ friends: [] });
    expect(s.asks).toHaveLength(2);
  });
});
