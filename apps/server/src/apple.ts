import { createPrivateKey, sign } from "node:crypto";

/**
 * Sign in with Apple on the game server (docs/ios-app.md): trading the iPhone
 * app's one-time authorization code for Apple's refresh token, and revoking
 * that token when the player deletes their account (Apple's TN3194).
 *
 * Needs, on the Render web service:
 * - APPLE_TEAM_ID: your Apple Developer Team ID;
 * - APPLE_KEY_ID: the Key ID of a key with Sign in with Apple;
 * - APPLE_PRIVATE_KEY: that key's .p8 file (its text; "\n" may stand for
 *   line breaks);
 * - APPLE_APP_BUNDLE_ID: the iPhone app's bundle ID (the token's client).
 * Without them the app still signs in; deletion then can't revoke, and the
 * player is told how to remove the app from their Apple Account instead.
 */
export interface AppleConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
}
export function appleConfig(env = process.env): AppleConfig | null {
  const teamId = env.APPLE_TEAM_ID?.trim(),
    keyId = env.APPLE_KEY_ID?.trim(),
    privateKey = env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim(),
    bundleId = env.APPLE_APP_BUNDLE_ID?.trim();
  return teamId && keyId && privateKey && bundleId
    ? { teamId, keyId, privateKey, bundleId }
    : null;
}

const APPLE = "https://appleid.apple.com";
let appleFetch: typeof fetch = (...args) => fetch(...args);
/** Tests answer for Apple. */
export function setAppleFetch(f: typeof fetch) {
  appleFetch = f;
}

const b64url = (data: Buffer | string) =>
  Buffer.from(data).toString("base64url");

/**
 * The client secret Apple asks for: a short-lived token (5 minutes; Apple
 * allows up to 6 months) signed with your key (ES256).
 */
export function appleClientSecret(
  cfg: AppleConfig,
  clientId: string,
  now = Date.now(),
) {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const body = b64url(
    JSON.stringify({
      iss: cfg.teamId,
      iat,
      exp: iat + 300,
      aud: APPLE,
      sub: clientId,
    }),
  );
  const signature = sign("sha256", Buffer.from(`${head}.${body}`), {
    key: createPrivateKey(cfg.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${head}.${body}.${b64url(signature)}`;
}

/** The "sub" (Apple's id for the player) of an id token Apple just sent. */
function subjectOf(idToken: unknown) {
  if (typeof idToken !== "string") return null;
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Trade the app's authorization code for Apple's refresh token. The id
 * token comes straight from Apple over HTTPS, so its "sub" is trusted to
 * say whose token it is.
 */
export async function exchangeAppleCode(cfg: AppleConfig, code: string) {
  const response = await appleFetch(`${APPLE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.bundleId,
      client_secret: appleClientSecret(cfg, cfg.bundleId),
      code,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const reply = (await response.json().catch(() => ({}))) as {
    refresh_token?: unknown;
    id_token?: unknown;
    error?: unknown;
  };
  if (!response.ok || typeof reply.refresh_token !== "string")
    throw new Error(
      `Apple refused the code (${response.status} ${String(reply.error ?? "")})`.trim(),
    );
  const sub = subjectOf(reply.id_token);
  if (!sub) throw new Error("Apple's answer had no player id.");
  return { refreshToken: reply.refresh_token, sub, clientId: cfg.bundleId };
}

/** Revoke a refresh token. Resolves true when Apple accepts. */
export async function revokeAppleToken(
  cfg: AppleConfig,
  token: { refreshToken: string; clientId: string },
) {
  const response = await appleFetch(`${APPLE}/auth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: token.clientId,
      client_secret: appleClientSecret(cfg, token.clientId),
      token: token.refreshToken,
      token_type_hint: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}
