import { expect, it } from "vitest";
import {
  authRedirectUrl,
  readAuthReturn,
  withoutAuthMarker,
} from "../../apps/client/src/auth-redirect";

it("sends auth emails back to the site root, which every host serves", () => {
  for (const site of [
    "https://parena.litojace.com",
    "https://parena.litojace.com/",
  ]) {
    expect(authRedirectUrl(site, "email-confirmed")).toBe(
      "https://parena.litojace.com/?auth=email-confirmed",
    );
    expect(authRedirectUrl(site, "reset-password")).toBe(
      "https://parena.litojace.com/?auth=reset-password",
    );
    expect(authRedirectUrl(site, "auth-callback")).toBe(
      "https://parena.litojace.com/?auth=auth-callback",
    );
  }
  for (const kind of [
    "email-confirmed",
    "reset-password",
    "auth-callback",
  ] as const)
    expect(
      new URL(authRedirectUrl("http://localhost:5173", kind)).pathname,
    ).toBe("/");
});

it("recognises the new query form and the old paths from earlier emails", () => {
  expect(readAuthReturn("/", "?auth=email-confirmed")).toBe("email-confirmed");
  expect(readAuthReturn("/", "?auth=reset-password&code=abc")).toBe(
    "reset-password",
  );
  expect(readAuthReturn("/email-confirmed", "")).toBe("email-confirmed");
  expect(readAuthReturn("/email-confirmed/", "")).toBe("email-confirmed");
  expect(readAuthReturn("/reset-password", "")).toBe("reset-password");
  expect(readAuthReturn("/auth/callback", "?code=abc")).toBe("auth-callback");
  expect(readAuthReturn("/", "")).toBeUndefined();
  expect(readAuthReturn("/", "?auth=<script>")).toBeUndefined();
  expect(readAuthReturn("/", "?room=AB12CD")).toBeUndefined();
});

it("drops only its own marker and keeps what Supabase reads", () => {
  expect(
    withoutAuthMarker(
      "https://parena.litojace.com/?auth=email-confirmed#access_token=t&type=signup",
    ),
  ).toBe("/#access_token=t&type=signup");
  expect(
    withoutAuthMarker(
      "https://parena.litojace.com/?auth=reset-password&code=abc",
    ),
  ).toBe("/?code=abc");
  expect(withoutAuthMarker("https://parena.litojace.com/?room=AB12CD")).toBe(
    "/?room=AB12CD",
  );
});
