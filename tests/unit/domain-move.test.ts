import { expect, test } from "vitest";
import { announcementSchema } from "../../packages/shared/src/accounts";
import {
  moveLink,
  moveNotice,
  newAddress,
} from "../../apps/client/src/domain-move";

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

test("the notice opens the new address and tells guests to keep their account", () => {
  expect(moveLink(SITE)).toEqual({
    href: `${SITE}/`,
    label: "Open",
    title: "Element Arena has moved",
  });
  const { message } = moveNotice(SITE);
  // A guest's account lives on this address only: an email keeps it.
  expect(message).toMatch(/guest/i);
  expect(message).toMatch(/email/i);
  expect(message).toMatch(/Home Screen/);
});
