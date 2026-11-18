import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AVATARS,
  AVATAR_BY_ID,
  RETIRED_AVATARS,
  avatarSchema,
  avatarUrl,
  isAvatar,
  knownAvatar,
} from "../../packages/shared/src/avatars";

// The avatar library (packages/shared/src/avatars.ts): the owner's 25, a
// picture for each and no other, and the first library's 27 that left it
// still showing their character (nobody's choice is lost).
describe("the avatar library", () => {
  it("has 25 avatars, each with its picture, and no stray pictures", () => {
    expect(AVATARS).toHaveLength(25);
    const files = readdirSync("apps/client/public/assets/avatars").sort();
    expect(files).toEqual(AVATARS.map((a) => `${a.id}.webp`).sort());
  });

  it("shows a retired avatar as the same character's", () => {
    expect(RETIRED_AVATARS.size).toBe(27);
    for (const [old, now] of RETIRED_AVATARS) {
      expect(AVATAR_BY_ID.has(old)).toBe(false);
      expect(AVATAR_BY_ID.has(now)).toBe(true);
      expect(isAvatar(old)).toBe(true);
      expect(knownAvatar(old)).toBe(now);
      expect(avatarUrl(old)).toBe(`/assets/avatars/${now}.webp`);
    }
    // The first library's Anime 2D set: 027-044 the champions in order,
    // 045-050 the bosses; Crackle and Fizz now the Storm Twins together.
    expect(AVATAR_BY_ID.get(knownAvatar("ea-avatar-027"))!.name).toBe(
      "Voltkit",
    );
    expect(AVATAR_BY_ID.get(knownAvatar("ea-avatar-044"))!.name).toBe(
      "Mossloth",
    );
    expect(AVATAR_BY_ID.get(knownAvatar("ea-avatar-050"))!.name).toBe(
      "Lumiwick",
    );
    for (const twin of ["ea-avatar-026", "ea-avatar-051", "ea-avatar-052"])
      expect(AVATAR_BY_ID.get(knownAvatar(twin))!.name).toBe("Storm Twins");
  });

  it("lets a player choose only what is in the library", () => {
    expect(avatarSchema.safeParse("ea-avatar-025").success).toBe(true);
    expect(avatarSchema.safeParse("ea-avatar-027").success).toBe(false);
    expect(knownAvatar("ea-avatar-053")).toBe("ea-avatar-001");
    expect(knownAvatar(null)).toBe("ea-avatar-001");
  });
});
