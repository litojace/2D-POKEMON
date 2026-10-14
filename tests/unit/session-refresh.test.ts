import { describe, expect, it } from "vitest";
import { isQuietRefresh } from "../../apps/client/src/session-refresh";

const alice = { user: { id: "a" } },
  bob = { user: { id: "b" } };
describe("background session refresh", () => {
  it("stays quiet for the same player once their profile is loaded", () => {
    expect(isQuietRefresh(alice, { user: { id: "a" } }, true)).toBe(true);
  });
  it("updates fully on sign-in, sign-out, a different player or a forced refresh", () => {
    expect(isQuietRefresh(null, alice, true)).toBe(false); // first sign-in
    expect(isQuietRefresh(alice, null, true)).toBe(false); // sign-out
    expect(isQuietRefresh(alice, bob, true)).toBe(false); // switched account
    expect(isQuietRefresh(alice, alice, false)).toBe(false); // profile not loaded yet
    expect(isQuietRefresh(alice, alice, true, true)).toBe(false); // account-changed event
  });
});
