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
  it("announces zone 5 (the Sun Atrium) to a zone-4 conqueror, quiet once climbing", () => {
    const atZone5 = climb({
      highestFloor: 40,
      checkpoint: 41,
      clears: { grumblecrag: 1, somnara: 1 },
    });
    expect(spireNudge({ spire: atZone5, seen: ["s0-z4"] })).toEqual({
      key: "s0-z5",
      zone: 5,
      from: 41,
      title: "Zone 5 is open",
      note: "Climb from floor 41 · Sun Atrium",
    });
    expect(spireSeenKeys(atZone5)).toEqual([
      "s0-z1",
      "s0-z2",
      "s0-z3",
      "s0-z4",
      "s0-z5",
    ]);
    expect(spireNudge({ spire: atZone5, seen: ["s0-z5"] })).toBeNull();
    expect(
      spireNudge({ spire: { ...atZone5, highestFloor: 41 }, seen: [] }),
    ).toBeNull();
  });
  it("announces zone 6 (the Sky Terrace) to a zone-5 conqueror, quiet once climbing", () => {
    const atZone6 = climb({
      highestFloor: 50,
      checkpoint: 51,
      clears: { grumblecrag: 1, prismatail: 1 },
    });
    expect(spireNudge({ spire: atZone6, seen: ["s0-z5"] })).toEqual({
      key: "s0-z6",
      zone: 6,
      from: 51,
      title: "Zone 6 is open",
      note: "Climb from floor 51 · Sky Terrace",
    });
    expect(spireSeenKeys(atZone6)).toEqual([
      "s0-z1",
      "s0-z2",
      "s0-z3",
      "s0-z4",
      "s0-z5",
      "s0-z6",
    ]);
    expect(spireNudge({ spire: atZone6, seen: ["s0-z6"] })).toBeNull();
    expect(
      spireNudge({ spire: { ...atZone6, highestFloor: 51 }, seen: [] }),
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
// Raid Hub): the news while a zone is new, else the next title within
// reach with how far it is and your best floor (owner, 27 Nov 2026: the
// card should give a reason to tap), and the floors to it as a ladder.
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
      note: "Floor 5 → new title",
      fresh: true,
      ladder: { from: 1, to: 5, cleared: 0 },
    });
  });
  it("stays once seen, with the climb's standing and no news", () => {
    expect(spireLobbyCard({ spire: climb(), seen: ["s0-z1"] })).toMatchObject({
      title: "Start your climb",
      note: "Floor 5 → new title",
      fresh: false,
      ladder: { from: 1, to: 5, cleared: 0 },
    });
    // The raid records' clear counts open it too.
    expect(
      spireLobbyCard({
        spire: climb({ clears: {}, highestFloor: 7 }),
        clears: { grumblecrag: 1 },
        seen: [],
      }),
    ).toMatchObject({
      // Past the title at floor 5: the next is floor 10's.
      title: "Floor 10 → title",
      note: "3 floors to go · best 7",
      fresh: false,
      ladder: { from: 6, to: 10, cleared: 7 },
    });
    expect(
      spireLobbyCard({ spire: { ...zone1Done, highestFloor: 14 }, seen: [] }),
    ).toMatchObject({
      title: "Floor 20 → title",
      note: "6 floors to go · best 14",
      fresh: false,
      ladder: { from: 11, to: 20, cleared: 14 },
    });
    // One floor short.
    expect(
      spireLobbyCard({ spire: { ...zone1Done, highestFloor: 19 }, seen: [] }),
    ).toMatchObject({ note: "1 floor to go · best 19" });
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
  it("celebrates the whole Spire once its summit (floor 70) falls", () => {
    expect(
      spireLobbyCard({
        spire: climb({
          highestFloor: 70,
          checkpoint: 61,
          clears: { grumblecrag: 1, "storm-twins": 1 },
        }),
        seen: ["s0-z1", "s0-z2", "s0-z3", "s0-z4", "s0-z5", "s0-z6", "s0-z7"],
      }),
    ).toMatchObject({
      title: "The Spire is yours",
      note: "Climb from floor 61 · Conductor Ring",
      fresh: false,
    });
    // Zone 6 conquered, zone 7 not yet climbed: zone 7 is news.
    expect(
      spireLobbyCard({
        spire: climb({ highestFloor: 60, checkpoint: 61 }),
        seen: ["s0-z1", "s0-z2", "s0-z3", "s0-z4", "s0-z5", "s0-z6"],
      }),
    ).toMatchObject({
      title: "Zone 7 is open",
      note: "Floor 70 → new title",
      fresh: true,
      ladder: { from: 61, to: 70, cleared: 60 },
    });
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
