import { describe, expect, it } from "vitest";
import { PlazaWorld } from "../../apps/server/src/plaza";
import { PlazaAppearance } from "../../apps/server/src/plaza-appearance";
import type { PlazaProfile } from "../../packages/shared/src/plaza";

const base: Omit<PlazaProfile, "id" | "bot"> = {
  name: "Crew tester",
  title: null,
  titleColor: null,
  level: null,
  character: "auralynx",
  skin: null,
};
const deferred = <T = unknown>() => {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const setup = () => {
  const plaza = new PlazaWorld();
  plaza.join("self", "account", base);
  return plaza;
};

describe("verified Plaza appearance", () => {
  it("loads the selected champion skin, its stage, all wardrobe slots and the account level", async () => {
    const plaza = setup(),
      calls: string[] = [];
    const look = {
      skin: "candy-colours",
      aura: "galaxy-aura",
      entrance: "firefall",
      victory: "twin-spark",
      frame: "crescent",
    };
    const reader = new PlazaAppearance(plaza, {
      rpc: async (token, name) => {
        expect(token).toBe("verified-token");
        calls.push(name);
        return name === "arena_my_looks"
          ? {
              auralynx: { skin: "auralynx-celestial-sage", stage: 3 },
              voltkit: { skin: "voltkit-midnight", stage: 1 },
            }
          : name === "arena_raid_progress"
            ? { loadout: look }
            : { xp: 900 };
      },
    });
    await reader.refresh("self", "verified-token", true);
    expect(plaza.profileOf("self")).toMatchObject({
      skin: { skin: "auralynx-celestial-sage", stage: 3 },
      look,
      level: expect.any(Number),
    });
    expect(calls.sort()).toEqual([
      "arena_journey",
      "arena_my_looks",
      "arena_raid_progress",
    ]);
  });
  it("removes unequipped items and does not resend unchanged profiles", async () => {
    const plaza = setup();
    plaza.updateProfile("self", {
      skin: { skin: "auralynx-desert", stage: 1 },
      look: { aura: "galaxy-aura", skin: "candy-colours" },
    });
    const reader = new PlazaAppearance(plaza, { rpc: async () => ({}) });
    await reader.refresh("self", "token");
    expect(plaza.profileOf("self")).toMatchObject({ skin: null, look: {} });
    plaza.view("self");
    await reader.refresh("self", "token");
    expect(plaza.view("self")?.profiles).toEqual([]);
  });
  it("preserves the last verified loadout during an account-service failure", async () => {
    const plaza = setup();
    plaza.updateProfile("self", {
      skin: { skin: "auralynx-desert", stage: 1 },
      look: { aura: "nightmote" },
    });
    const before = plaza.profileOf("self");
    const reader = new PlazaAppearance(plaza, {
      rpc: async () => {
        throw new Error("Offline");
      },
    });
    await reader.refresh("self", "token", true);
    expect(plaza.profileOf("self")).toEqual(before);
  });
  it("applies a successful cosmetic lookup even if the other lookup fails", async () => {
    const plaza = setup();
    plaza.updateProfile("self", {
      skin: { skin: "auralynx-desert", stage: 1 },
    });
    const reader = new PlazaAppearance(plaza, {
      rpc: async (_token, name) => {
        if (name === "arena_my_looks") throw new Error("Offline");
        return { loadout: { aura: "lullaby-aura" } };
      },
    });
    await reader.refresh("self", "token");
    expect(plaza.profileOf("self")).toMatchObject({
      skin: { skin: "auralynx-desert" },
      look: { aura: "lullaby-aura" },
    });
  });
  it("ignores stale results after another save of the same champion", async () => {
    const plaza = setup(),
      oldSkin = deferred(),
      oldLook = deferred();
    let generation = 0;
    const reader = new PlazaAppearance(plaza, {
      rpc: async (_token, name) =>
        generation === 0
          ? name === "arena_my_looks"
            ? oldSkin.promise
            : oldLook.promise
          : name === "arena_my_looks"
            ? { auralynx: { skin: "auralynx-celestial-sage", stage: 3 } }
            : { loadout: { aura: "halo-aura" } },
    });
    const old = reader.refresh("self", "token");
    await flush();
    generation = 1;
    await reader.refresh("self", "token");
    oldSkin.resolve({ auralynx: { skin: "auralynx-desert", stage: 1 } });
    oldLook.resolve({ loadout: { aura: "nightmote" } });
    await old;
    expect(plaza.profileOf("self")).toMatchObject({
      skin: { skin: "auralynx-celestial-sage", stage: 3 },
      look: { aura: "halo-aura" },
    });
  });
  it("ignores a stale result after switching champions", async () => {
    const plaza = setup(),
      skin = deferred(),
      look = deferred();
    const reader = new PlazaAppearance(plaza, {
      rpc: async (_token, name) =>
        name === "arena_my_looks" ? skin.promise : look.promise,
    });
    const pending = reader.refresh("self", "token");
    plaza.updateProfile("self", { character: "voltkit", skin: null });
    skin.resolve({ auralynx: { skin: "auralynx-desert" } });
    look.resolve({ loadout: { aura: "nightmote" } });
    await pending;
    expect(plaza.profileOf("self")).toMatchObject({
      character: "voltkit",
      skin: null,
    });
    expect(plaza.profileOf("self")?.look).toBeUndefined();
  });
  it("ignores a result belonging to a previous visit on the same connection", async () => {
    const plaza = setup(),
      skin = deferred(),
      look = deferred();
    const reader = new PlazaAppearance(plaza, {
      rpc: async (_token, name) =>
        name === "arena_my_looks" ? skin.promise : look.promise,
    });
    const pending = reader.refresh("self", "token");
    plaza.leave("self");
    plaza.join("self", "account", base);
    skin.resolve({ auralynx: { skin: "auralynx-desert" } });
    look.resolve({ loadout: { aura: "nightmote" } });
    await pending;
    expect(plaza.profileOf("self")?.skin).toBeNull();
  });
  it("does not delay cosmetics behind a slow level lookup", async () => {
    const plaza = setup(),
      level = deferred();
    const reader = new PlazaAppearance(plaza, {
      rpc: async (_token, name) =>
        name === "arena_journey"
          ? level.promise
          : name === "arena_my_looks"
            ? { auralynx: { skin: "auralynx-desert", stage: 1 } }
            : { loadout: { skin: "candy-colours" } },
    });
    const pending = reader.refresh("self", "token", true);
    await flush();
    expect(plaza.profileOf("self")).toMatchObject({
      skin: { skin: "auralynx-desert" },
      look: { skin: "candy-colours" },
      level: null,
    });
    level.resolve({ xp: 900 });
    await pending;
    expect(plaza.profileOf("self")?.level).toBeGreaterThan(1);
  });
  it("handles legacy raid appearances and skips lookups outside the Plaza", async () => {
    const plaza = setup();
    let calls = 0;
    const reader = new PlazaAppearance(plaza, {
      rpc: async (_token, name) => {
        calls++;
        return name === "arena_raid_progress"
          ? { equipped: "mountain-aura" }
          : {};
      },
    });
    await reader.refresh("self", "token");
    expect(plaza.profileOf("self")?.look).toEqual({ aura: "mountain-aura" });
    plaza.leave("self");
    await reader.refresh("self", "token");
    expect(calls).toBe(2);
  });
});
