import { afterEach, describe, expect, it } from "vitest";
import {
  loadSpireSeen,
  markSpireSeen,
  spireLobbyCard,
  spireNudge,
  spireSeenKeys,
} from "../../apps/client/src/spire-nudge";
import type { SpireProgress } from "../../packages/shared/src/spire";
import { expandedSpire } from "../fixtures/spire-catalogue";

// The Lobby's Spire card and Raids badge: only while something in the Spire
// is new to the player, never before it opens, and never again once seen.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
afterEach(() => store.clear());

const climb = (o: Partial<SpireProgress> = {}): SpireProgress => ({
  season: 0,
  highestFloor: 0,
  checkpoint: 1,
  attempts: 0,
  claimed: [],
  clears: { grumblecrag: 1 },
  ...o,
});
/** Zone 1 conquered: checkpoint 11, floors 1–10 cleared. */
const zone1Done = climb({
  highestFloor: 10,
  checkpoint: 11,
  claimed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
});

describe("spireNudge", () => {
  it("stays quiet before the Spire opens (no Cragmuff clear)", () => {
    expect(spireNudge({ spire: climb({ clears: {} }), seen: [] })).toBeNull();
    expect(
      spireNudge({
        spire: climb({ clears: {} }),
        clears: { tidewyrm: 3 },
        seen: [],
      }),
    ).toBeNull();
  });
  it("stays quiet while the climb is unknown", () => {
    expect(
      spireNudge({ spire: null, clears: { grumblecrag: 1 }, seen: [] }),
    ).toBeNull();
    expect(spireNudge({ spire: undefined, seen: [] })).toBeNull();
  });
  it("announces the Spire once a Cragmuff clear opens it", () => {
    expect(spireNudge({ spire: climb(), seen: [] })).toEqual({
      key: "s0-z1",
      zone: 1,
      from: 1,
      title: "The Spire is open",
      note: "Climb from floor 1",
    });
    // The raid records' clear counts too (the climb's copy may lag).
    expect(
      spireNudge({
        spire: climb({ clears: {} }),
        clears: { grumblecrag: 1 },
        seen: [],
      })?.key,
    ).toBe("s0-z1");
  });
  it("stays quiet once a floor of the open zone is cleared", () => {
    expect(
      spireNudge({ spire: climb({ highestFloor: 1, claimed: [1] }), seen: [] }),
    ).toBeNull();
    expect(
      spireNudge({ spire: climb({ highestFloor: 7 }), seen: [] }),
    ).toBeNull();
  });
  it("announces a newly opened zone at its first floor", () => {
    expect(spireNudge({ spire: zone1Done, seen: ["s0-z1"] })).toEqual({
      key: "s0-z2",
      zone: 2,
      from: 11,
      title: "Zone 2 is open",
      note: "Climb from floor 11 · Lagoon",
    });
    // A floor of zone 2 cleared: under way, quiet.
    expect(
      spireNudge({ spire: { ...zone1Done, highestFloor: 11 }, seen: [] }),
    ).toBeNull();
  });
  it("announces a zone released later to a player already at its checkpoint", () => {
    const three = expandedSpire(3);
    const atZone3 = climb({ highestFloor: 20, checkpoint: 21 });
    // Before zone 3 is built, the checkpoint stays in zone 2 (cleared): quiet.
    expect(
      spireNudge({ spire: atZone3, seen: [] }, expandedSpire(2)),
    ).toBeNull();
    expect(spireNudge({ spire: atZone3, seen: [] }, three)).toMatchObject({
      key: "s0-z3",
      from: 21,
      title: "Zone 3 is open",
    });
  });
  it("announces zone 4 (the Cloud Deck) to a zone-3 conqueror, quiet once climbing", () => {
    const atZone4 = climb({
      highestFloor: 30,
      checkpoint: 31,
      clears: { grumblecrag: 1, gloomshade: 1 },
    });
    expect(spireNudge({ spire: atZone4, seen: ["s0-z3"] })).toEqual({
      key: "s0-z4",
      zone: 4,
      from: 31,
      title: "Zone 4 is open",
      note: "Climb from floor 31 · Cloud Deck",
    });
    expect(spireSeenKeys(atZone4)).toEqual([
      "s0-z1",
      "s0-z2",
      "s0-z3",
      "s0-z4",
    ]);
    expect(spireNudge({ spire: atZone4, seen: ["s0-z4"] })).toBeNull();
    expect(
      spireNudge({ spire: { ...atZone4, highestFloor: 31 }, seen: [] }),
    ).toBeNull();
  });
  it("is never shown again for a zone once seen, even unclimbed", () => {
    expect(spireNudge({ spire: climb(), seen: ["s0-z1"] })).toBeNull();
    expect(spireNudge({ spire: zone1Done, seen: ["s0-z2"] })).toBeNull();
    // Seen in an earlier season: a new season's zone is new again.
    expect(
      spireNudge({ spire: climb({ season: 1 }), seen: ["s0-z1"] })?.key,
    ).toBe("s1-z1");
  });
});

// The Lobby's Spire card stays once the Spire is open (a shortcut past the
// Raid Hub): the news while a zone is new, else your best floor.
describe("spireLobbyCard", () => {
  it("is absent before the Spire opens or while the climb is unknown", () => {
    expect(
      spireLobbyCard({ spire: climb({ clears: {} }), seen: [] }),
    ).toBeNull();
    expect(
      spireLobbyCard({ spire: null, clears: { grumblecrag: 1 }, seen: [] }),
    ).toBeNull();
  });
  it("carries the news, fresh, while a zone is new", () => {
    expect(spireLobbyCard({ spire: climb(), seen: [] })).toEqual({
      key: "new:s0-z1",
      title: "The Spire is open",
      note: "Climb from floor 1",
      fresh: true,
    });
  });
  it("stays once seen, with the climb's standing and no news", () => {
    expect(spireLobbyCard({ spire: climb(), seen: ["s0-z1"] })).toMatchObject({
      title: "Start your climb",
      note: "Climb from floor 1 · Raid Coliseum",
      fresh: false,
    });
    // The raid records' clear counts open it too.
    expect(
      spireLobbyCard({
        spire: climb({ clears: {}, highestFloor: 7 }),
        clears: { grumblecrag: 1 },
        seen: [],
      }),
    ).toMatchObject({
      title: "Best: floor 7",
      note: "Climb from floor 1 · Raid Coliseum",
      fresh: false,
    });
    expect(
      spireLobbyCard({ spire: { ...zone1Done, highestFloor: 14 }, seen: [] }),
    ).toMatchObject({
      title: "Best: floor 14",
      note: "Climb from floor 11 · Lagoon",
      fresh: false,
    });
  });
  it("says so once every released floor is cleared", () => {
    const three = expandedSpire(3);
    expect(
      spireLobbyCard(
        {
          spire: climb({ highestFloor: three.builtTop, checkpoint: 21 }),
          seen: ["s0-z1", "s0-z2", "s0-z3"],
        },
        three,
      ),
    ).toMatchObject({ title: "Every floor cleared", fresh: false });
  });
  it("changes its key when its words change", () => {
    const a = spireLobbyCard({ spire: climb({ highestFloor: 2 }), seen: [] })!;
    const b = spireLobbyCard({ spire: climb({ highestFloor: 3 }), seen: [] })!;
    expect(a.key).not.toBe(b.key);
  });
});

describe("seen marks", () => {
  it("opening the Spire marks every open zone, per account", () => {
    expect(spireSeenKeys(null)).toEqual([]);
    expect(spireSeenKeys(climb())).toEqual(["s0-z1"]);
    expect(spireSeenKeys(zone1Done)).toEqual(["s0-z1", "s0-z2"]);
    expect(markSpireSeen("a", spireSeenKeys(zone1Done))).toBe(true);
    expect(loadSpireSeen("a")).toEqual(["s0-z1", "s0-z2"]);
    // Nothing new to mark: no change (the Lobby isn't redrawn for it).
    expect(markSpireSeen("a", ["s0-z2"])).toBe(false);
    expect(loadSpireSeen("b")).toEqual([]);
    expect(
      spireNudge({ spire: zone1Done, seen: loadSpireSeen("a") }),
    ).toBeNull();
    expect(
      spireNudge({ spire: zone1Done, seen: loadSpireSeen("b") })?.key,
    ).toBe("s0-z2");
  });
  it("signed out: nothing is kept", () => {
    expect(markSpireSeen(undefined, ["s0-z1"])).toBe(false);
    expect(loadSpireSeen(undefined)).toEqual([]);
  });
  it("ignores a damaged save", () => {
    store.set("arena-spire-seen:c", "{not json");
    expect(loadSpireSeen("c")).toEqual([]);
    store.set("arena-spire-seen:c", JSON.stringify(["s0-z1", 4, null]));
    expect(loadSpireSeen("c")).toEqual(["s0-z1"]);
  });
});
