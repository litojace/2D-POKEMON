import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  appleClientSecret,
  appleConfig,
  exchangeAppleCode,
  revokeAppleToken,
  setAppleFetch,
  type AppleConfig,
} from "../../apps/server/src/apple";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const cfg: AppleConfig = {
  teamId: "TEAM123456",
  keyId: "KEY1234567",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  bundleId: "com.example.arena",
};
const part = (jwt: string, i: number) =>
  JSON.parse(Buffer.from(jwt.split(".")[i], "base64url").toString("utf8"));
const idToken = (sub: string) =>
  `x.${Buffer.from(JSON.stringify({ sub })).toString("base64url")}.y`;
type Sent = { url: string; form: Record<string, string> };
function fakeApple(answer: (url: string) => Response) {
  const sent: Sent[] = [];
  setAppleFetch((async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    sent.push({
      url,
      form: Object.fromEntries(new URLSearchParams(String(init?.body))),
    });
    return answer(url);
  }) as typeof fetch);
  return sent;
}
afterEach(() => setAppleFetch((...a) => fetch(...a)));

describe("the config", () => {
  it("needs all four values, and reads \\n in the key as line breaks", () => {
    const env = {
      APPLE_TEAM_ID: "T",
      APPLE_KEY_ID: "K",
      APPLE_PRIVATE_KEY: "-----BEGIN-----\\nabc\\n-----END-----",
      APPLE_APP_BUNDLE_ID: "com.x",
    };
    expect(appleConfig(env)?.privateKey).toBe(
      "-----BEGIN-----\nabc\n-----END-----",
    );
    expect(appleConfig({ ...env, APPLE_KEY_ID: "" })).toBeNull();
    expect(appleConfig({})).toBeNull();
  });
});

describe("the client secret", () => {
  it("is an ES256 token for Apple, from your team, for the app, signed with your key", () => {
    const now = Date.parse("2026-11-13T12:00:00Z");
    const jwt = appleClientSecret(cfg, cfg.bundleId, now);
    expect(part(jwt, 0)).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(part(jwt, 1)).toEqual({
      iss: "TEAM123456",
      iat: now / 1000,
      exp: now / 1000 + 300,
      aud: "https://appleid.apple.com",
      sub: "com.example.arena",
    });
    const [h, b, s] = jwt.split(".");
    expect(
      verify(
        "sha256",
        Buffer.from(`${h}.${b}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(s, "base64url"),
      ),
    ).toBe(true);
    // A raw 64-byte signature (r||s), as JWT wants, not DER.
    expect(Buffer.from(s, "base64url")).toHaveLength(64);
  });
});

describe("trading the code", () => {
  it("sends the code with the app as client, and returns the refresh token and Apple's id", async () => {
    const sent = fakeApple(() =>
      Response.json({ refresh_token: "r-1", id_token: idToken("apple-sub") }),
    );
    expect(await exchangeAppleCode(cfg, "code-1")).toEqual({
      refreshToken: "r-1",
      sub: "apple-sub",
      clientId: "com.example.arena",
    });
    expect(sent[0].url).toBe("https://appleid.apple.com/auth/token");
    expect(sent[0].form).toMatchObject({
      client_id: "com.example.arena",
      code: "code-1",
      grant_type: "authorization_code",
    });
    expect(part(sent[0].form.client_secret, 1).sub).toBe("com.example.arena");
  });
  it("fails when Apple refuses, or answers without a token or a player id", async () => {
    fakeApple(() => Response.json({ error: "invalid_grant" }, { status: 400 }));
    await expect(exchangeAppleCode(cfg, "used")).rejects.toThrow(
      "invalid_grant",
    );
    fakeApple(() => Response.json({ id_token: idToken("s") }));
    await expect(exchangeAppleCode(cfg, "c")).rejects.toThrow("refused");
    fakeApple(() => Response.json({ refresh_token: "r", id_token: "bad" }));
    await expect(exchangeAppleCode(cfg, "c")).rejects.toThrow("player id");
  });
});

describe("revoking", () => {
  it("sends the refresh token with the client it was issued to", async () => {
    const sent = fakeApple(() => new Response(null, { status: 200 }));
    expect(
      await revokeAppleToken(cfg, { refreshToken: "r-1", clientId: "com.old" }),
    ).toBe(true);
    expect(sent[0].url).toBe("https://appleid.apple.com/auth/revoke");
    expect(sent[0].form).toMatchObject({
      client_id: "com.old",
      token: "r-1",
      token_type_hint: "refresh_token",
    });
    expect(part(sent[0].form.client_secret, 1).sub).toBe("com.old");
    fakeApple(() => new Response(null, { status: 400 }));
    expect(
      await revokeAppleToken(cfg, { refreshToken: "r", clientId: "c" }),
    ).toBe(false);
  });
});
