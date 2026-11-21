import { afterEach, describe, expect, it } from "vitest";
import {
  PROFILE_COPY_KEY,
  PROFILE_COPY_MAX_AGE_MS,
  forgetProfileCopy,
  keepProfileCopy,
  readProfileCopy,
  type ProfileCopy,
} from "../../apps/client/src/profile-copy";

// The profile this device last saw, for drawing the hub at once on the next
// start (docs/loading-screens.md). Only the same account's copy, only while
// fresh and well formed; anything else falls back to the server's.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
afterEach(() => store.clear());

const ID = "11111111-1111-4111-8111-111111111111";
const copy = (): ProfileCopy => ({
  account: {
    id: ID,
    displayName: "tester",
    isAdmin: false,
    suspended: false,
    title: "Cragbreaker",
    titleColor: "#d9b98a",
    ownedTitles: [],
    guest: false,
  } as unknown as ProfileCopy["account"],
  economy: {
    balance: 2340,
    owned: ["voltkit-stormcrown"],
    looks: { voltkit: { skin: "voltkit-stormcrown", stage: 2 } },
    missions: [],
  } as unknown as ProfileCopy["economy"],
  raidLook: { frame: "cragbound" } as ProfileCopy["raidLook"],
  raidClears: { cragmuff: 2 } as ProfileCopy["raidClears"],
  spire: null,
  avatar: null,
  fighter: "cindrake",
});

describe("profile copy", () => {
  it("keeps and reads back what the first screen shows", () => {
    keepProfileCopy(copy(), 1_000);
    const read = readProfileCopy(ID, 2_000)!;
    expect(read.account.displayName).toBe("tester");
    expect(read.economy?.balance).toBe(2340);
    expect(read.economy?.looks.voltkit?.skin).toBe("voltkit-stormcrown");
    expect(read.raidClears).toEqual({ cragmuff: 2 });
    expect(read.fighter).toBe("cindrake");
  });
  it("is only for the same account, while fresh, in this version", () => {
    keepProfileCopy(copy(), 1_000);
    expect(readProfileCopy("22222222-2222-4222-8222-222222222222", 2_000)).toBe(
      null,
    );
    expect(readProfileCopy(ID, 1_000 + PROFILE_COPY_MAX_AGE_MS + 1)).toBe(null);
    const stored = JSON.parse(store.get(PROFILE_COPY_KEY)!);
    store.set(PROFILE_COPY_KEY, JSON.stringify({ ...stored, v: 999 }));
    expect(readProfileCopy(ID, 2_000)).toBe(null);
  });
  it("ignores what it can't trust instead of drawing it", () => {
    store.set(PROFILE_COPY_KEY, "{not json");
    expect(readProfileCopy(ID)).toBe(null);
    keepProfileCopy(copy(), 1_000);
    const stored = JSON.parse(store.get(PROFILE_COPY_KEY)!);
    store.set(
      PROFILE_COPY_KEY,
      JSON.stringify({
        ...stored,
        economy: { balance: "lots" },
        fighter: "not-a-fighter",
        avatar: "<img onerror=x>",
      }),
    );
    const read = readProfileCopy(ID, 2_000)!;
    expect(read.economy).toBeUndefined();
    expect(read.fighter).toBeUndefined();
    expect(read.avatar).toBe(null);
    // The account itself must parse, or there is no copy at all.
    store.set(
      PROFILE_COPY_KEY,
      JSON.stringify({ ...stored, account: { id: ID } }),
    );
    expect(readProfileCopy(ID, 2_000)).toBe(null);
  });
  it("is forgotten on sign-out", () => {
    keepProfileCopy(copy());
    forgetProfileCopy();
    expect(readProfileCopy(ID)).toBe(null);
  });
});
