import { expect, it } from "vitest";
import {
  FighterAppearance,
  PortraitChoice,
} from "../../apps/server/src/fighter-appearance";
import { Arena } from "../../apps/server/src/simulation";

const player = () => {
  const arena = new Arena("TESTAA");
  arena.add("one", "Pal");
  return arena.players[0];
};
const deferred = () => {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
it("broadcasts all saved wardrobe slots, skins and earned frame counts together", async () => {
  const p = player();
  const look = {
    skin: "candy-colours",
    aura: "galaxy-aura",
    entrance: "firefall",
    victory: "twin-spark",
    frame: "conqueror",
  };
  const skins = { tidefin: { skin: "tidefin-moontide", stage: 3 } };
  let broadcasts = 0;
  const reader = new FighterAppearance({
    rpc: async (_token, name) =>
      name === "arena_raid_progress"
        ? { loadout: look, bosses: { grumblecrag: { clears: 50 } } }
        : skins,
  });
  await reader.refresh(
    p,
    "verified",
    () => true,
    () => broadcasts++,
  );
  expect(p).toMatchObject({
    raidLook: look,
    championLooks: skins,
    raidClears: { grumblecrag: 50 },
  });
  expect(broadcasts).toBe(1);
  await new FighterAppearance({ rpc: async () => ({}) }).refresh(
    p,
    "verified",
    () => true,
    () => {},
  );
  expect(p).toMatchObject({ raidLook: {}, championLooks: {}, raidClears: {} });
});
it("keeps the latest equip when an older room lookup finishes late", async () => {
  const p = player(),
    delayed = deferred();
  let calls = 0;
  const reader = new FighterAppearance({
    rpc: async (_token, name) =>
      name === "arena_raid_progress"
        ? ++calls === 1
          ? delayed.promise
          : { loadout: { frame: "crescent" } }
        : {},
  });
  const old = reader.refresh(
    p,
    "token",
    () => true,
    () => {},
  );
  await Promise.resolve();
  await reader.refresh(
    p,
    "token",
    () => true,
    () => {},
  );
  delayed.resolve({ loadout: { frame: "conqueror" } });
  await old;
  expect(p.raidLook?.frame).toBe("crescent");
});
it("ignores results for departed rooms and retains verified gear on provider failures", async () => {
  const p = player();
  p.raidLook = { frame: "conqueror" };
  const reader = new FighterAppearance({ rpc: async () => ({ loadout: {} }) });
  await reader.refresh(
    p,
    "token",
    () => false,
    () => {
      throw Error("departed");
    },
  );
  const unavailable = new FighterAppearance({
    rpc: async () => {
      throw Error("offline");
    },
  });
  await unavailable.refresh(
    p,
    "token",
    () => true,
    () => {
      throw Error("unchanged");
    },
  );
  expect(p.raidLook?.frame).toBe("conqueror");
});
it("serializes rapid portrait choices and continues after a failed save", async () => {
  const first = deferred(),
    calls: string[] = [];
  const choices = new PortraitChoice({
    rpc: async (_token, _name, args) => {
      calls.push(String(args.p_character));
      if (calls.length === 1) {
        await first.promise;
        throw Error("temporary");
      }
    },
  });
  const old = choices.save("account", "token", "tidefin");
  const latest = choices.save("account", "token", "terradon");
  await Promise.resolve();
  expect(calls).toEqual(["tidefin"]);
  first.resolve(null);
  await old;
  await latest;
  expect(calls).toEqual(["tidefin", "terradon"]);
});
