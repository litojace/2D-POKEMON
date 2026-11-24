import { expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import {
  META_KEYS,
  MetaCache,
  MetaTracker,
  packSnapshot,
  unpackSnapshot,
  type Fighter,
} from "../../packages/shared/src/index";

function room() {
  const a = new Arena("META01", "teams");
  const one = a.add("one", "One", "voltkit");
  const two = a.add("two", "Two", "tidefin");
  one.title = "Storm Chaser";
  one.titleColor = "#7dd3fc";
  one.flair = "Gold";
  one.championLooks = { voltkit: { skin: "voltkit-snowcap", stage: 1 } };
  one.raidLook = { frame: "festival-frame", skin: null };
  one.raidClears = { grumblecrag: 12 };
  two.raidLook = {};
  return { a, one, two };
}
const wire = (a: Arena, tracker: MetaTracker, send?: boolean) => {
  const s = a.snapshot();
  const changed = tracker.update(s.players);
  return JSON.parse(
    JSON.stringify(
      packSnapshot(s, {
        compact: true,
        metaRev: tracker.rev,
        meta: changed || send ? tracker.meta(s.players) : undefined,
      }),
    ),
  );
};

it("sends appearance once, then only combat state, until something changes", () => {
  const { a, one } = room();
  const tracker = new MetaTracker();
  const first = wire(a, tracker);
  expect(first.meta.players.one).toMatchObject({
    name: "One",
    title: "Storm Chaser",
    flair: "Gold",
    raidClears: { grumblecrag: 12 },
  });
  for (const key of META_KEYS) expect(first.players[0]).not.toHaveProperty(key);
  const second = wire(a, tracker);
  expect(second.meta).toBeUndefined();
  expect(second.metaRev).toBe(first.metaRev);
  expect(JSON.stringify(second).length).toBeLessThan(
    JSON.stringify(packSnapshot(a.snapshot())).length * 0.85,
  );
  // Equipping replaces the saved object: a new revision with the new look.
  one.championLooks = { voltkit: { skin: "voltkit-storm", stage: 2 } };
  const third = wire(a, tracker);
  expect(third.metaRev).toBe(first.metaRev + 1);
  expect(third.meta.players.one.championLooks.voltkit.skin).toBe(
    "voltkit-storm",
  );
});

it("notices joins, leaves and even in-place edits (periodic verification)", () => {
  const { a, one } = room();
  const tracker = new MetaTracker(5);
  wire(a, tracker);
  const rev = tracker.rev;
  a.add("three", "Three", "lumoth");
  expect(wire(a, tracker).meta.players.three.name).toBe("Three");
  a.players.splice(2, 1);
  const left = wire(a, tracker);
  expect(left.metaRev).toBe(rev + 2);
  expect(left.meta.players.three).toBeUndefined();
  // An object edited in place is caught by the full comparison within 5 calls.
  (one.raidClears as Record<string, number>).grumblecrag = 13;
  let seen = false;
  for (let i = 0; i < 5 && !seen; i++)
    seen = wire(a, tracker).meta?.players.one.raidClears.grumblecrag === 13;
  expect(seen).toBe(true);
});

it("restores full fighters on the client, keeping prediction values exact", () => {
  const { a, one } = room();
  one.x = 123.456789123;
  one.vx = -98.7654321;
  one.dashUntil = 10 + 1 / 3;
  one.ult = 99.996;
  one.lastInput = { ...one.lastInput, aimX: 640.123456, aimY: 300.5 };
  const tracker = new MetaTracker();
  const cache = new MetaCache();
  const s = unpackSnapshot(wire(a, tracker), cache);
  const me = s.players.find((p) => p.id === "one")!;
  expect(me.x).toBe(123.456789123);
  expect(me.vx).toBe(-98.7654321);
  expect(me.dashUntil).toBe(10 + 1 / 3);
  // Never shown ready before the server's meter is full.
  expect(me.ult).toBeLessThan(100);
  expect(me.lastInput.aimX).toBeCloseTo(640.12, 2);
  expect(me.lastInput.basic).toBe(false);
  expect(me).toMatchObject({
    name: "One",
    title: "Storm Chaser",
    titleColor: "#7dd3fc",
    raidLook: { frame: "festival-frame", skin: null },
  });
  // Later compact snapshots reuse the cache.
  const next = unpackSnapshot(wire(a, tracker), cache);
  expect(next.players.find((p) => p.id === "one")!.championLooks).toEqual(
    one.championLooks,
  );
});

it("tells a client its cache is stale so it can ask for a fresh block", () => {
  const { a, one } = room();
  const tracker = new MetaTracker();
  const cache = new MetaCache();
  unpackSnapshot(wire(a, tracker), cache);
  one.title = "Gilded";
  // The snapshot carrying the change is missed (e.g. a skipped send).
  wire(a, tracker);
  const later = wire(a, tracker);
  expect(cache.current(later.code, later.metaRev)).toBe(false);
  // The server's reply to "snapshot-meta" brings it back up to date.
  cache.apply(a.code, tracker.meta(a.players));
  expect(cache.current(later.code, later.metaRev)).toBe(true);
  const s = unpackSnapshot(later, cache);
  expect(s.players.find((p: Fighter) => p.id === "one")!.title).toBe("Gilded");
  // An older block arriving afterwards never replaces a newer one.
  cache.apply(a.code, { rev: 0, players: {} });
  expect(cache.rev).toBe(tracker.rev);
});

it("still accepts full (legacy) snapshots without any cache", () => {
  const { a } = room();
  const s = unpackSnapshot(
    JSON.parse(JSON.stringify(packSnapshot(a.snapshot()))),
  );
  expect(s.players[0]).toMatchObject({ name: "One", title: "Storm Chaser" });
});
