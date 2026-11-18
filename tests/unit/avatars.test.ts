import { readdirSync } from "node:fs";
import { expect, it } from "vitest";
import {
  AVATARS,
  AVATAR_STYLES,
  avatarSchema,
} from "../../packages/shared/src/avatars";

// The avatar library (packages/shared/src/avatars.ts): 77 avatars in three
// styles, a picture for each and no other (the second batch was added to
// the first 52, which all stay: owner, 19 Nov).
it("has 77 avatars in three styles, each with its picture and no other", () => {
  expect(AVATARS).toHaveLength(77);
  expect(
    AVATAR_STYLES.map((s) => AVATARS.filter((a) => a.style === s.id).length),
  ).toEqual([26, 26, 25]);
  const ids = AVATARS.map((a) => a.id);
  expect(new Set(ids).size).toBe(77);
  expect(ids.at(-1)).toBe("ea-avatar-077");
  const files = readdirSync("apps/client/public/assets/avatars").sort();
  expect(files).toEqual(ids.map((id) => `${id}.webp`).sort());
  expect(avatarSchema.safeParse("ea-avatar-077").success).toBe(true);
  expect(avatarSchema.safeParse("ea-avatar-078").success).toBe(false);
});

// The database's id check (migration 20261119160000) takes exactly these.
it("matches the database's id check", () => {
  const check = /^ea-avatar-0(0[1-9]|[1-6][0-9]|7[0-7])$/;
  for (const a of AVATARS) expect(a.id).toMatch(check);
  expect("ea-avatar-078").not.toMatch(check);
});
