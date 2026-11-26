import { expect, test } from "vitest";
import { announcementSchema } from "../../packages/shared/src/accounts";
import { moveNotice, newAddress } from "../../apps/client/src/domain-move";

const SITE = "https://play.elementarenausa.com";

test("only the old address offers the new one", () => {
  expect(newAddress("parena.litojace.com", SITE)).toBe(SITE);
  expect(newAddress("parena.litojace.com", `${SITE}/`)).toBe(SITE);
  // The new address itself, the iPhone app, test hosts: nothing.
  expect(newAddress("play.elementarenausa.com", SITE)).toBeNull();
  expect(newAddress("localhost", SITE)).toBeNull();
  expect(newAddress("twod-pokemon.onrender.com", SITE)).toBeNull();
  // Before VITE_SITE_URL moves, the old address is still the game's.
  expect(
    newAddress("parena.litojace.com", "https://parena.litojace.com"),
  ).toBeNull();
  expect(newAddress("parena.litojace.com", "")).toBeNull();
  expect(newAddress("parena.litojace.com", undefined)).toBeNull();
  expect(newAddress("parena.litojace.com", "not a url")).toBeNull();
  expect(
    newAddress("parena.litojace.com", "http://play.elementarenausa.com"),
  ).toBeNull();
});

test("the notice is a valid announcement that comes back every few days", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 10, 26, 8);
  const a = moveNotice(SITE, now);
  expect(announcementSchema.safeParse(a).success).toBe(true);
  expect(a.message).toContain("play.elementarenausa.com");
  expect(moveNotice(SITE, now + day).id).toBeLessThanOrEqual(a.id + 1);
  expect(moveNotice(SITE, now + 3 * day).id).toBe(a.id + 1);
  expect(Date.parse(a.endsAt)).toBeGreaterThan(now);
});
