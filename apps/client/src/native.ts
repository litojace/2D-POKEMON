/**
 * The iPhone app (docs/ios-app.md). The same client runs in the browser and
 * inside the Capacitor shell; this file is the only place that knows which.
 *
 * In the app:
 * - there's no service worker or "install" prompt (App Store updates
 *   replace them; pwa.ts and style.css check isNativeApp());
 * - the status bar stays hidden and the screen is landscape (Info.plist);
 * - coming back from the background reconnects at once (iOS pauses the
 *   app, and its game connection, soon after you switch away);
 * - Sign in with Apple is Apple's own sheet (ios/App/App/AppleSignIn.swift),
 *   not a web page.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

export const isNativeApp = () => Capacitor.isNativePlatform();

interface AppleSignInResult {
  user: string;
  identityToken: string;
  authorizationCode: string;
  email?: string;
  givenName?: string;
  familyName?: string;
}
interface AppleSignInPlugin {
  authorize(options: { nonce: string }): Promise<AppleSignInResult>;
}
const AppleSignIn = registerPlugin<AppleSignInPlugin>("AppleSignIn");

/** A random nonce: Apple gets its SHA-256, Supabase the nonce itself. */
function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export interface NativeAppleSignIn {
  /** Apple's identity token, for supabase.auth.signInWithIdToken. */
  identityToken: string;
  /** The nonce Apple was given the hash of: Supabase checks it. */
  nonce: string;
  /** One-time code the game server trades for Apple's refresh token. */
  authorizationCode: string;
  /** "Given Family", only the first time this player signs in here. */
  fullName: string;
}

/** Apple's sign-in sheet. Resolves null if the player cancels. */
export async function signInWithAppleNatively(): Promise<NativeAppleSignIn | null> {
  const nonce = randomNonce();
  try {
    const result = await AppleSignIn.authorize({
      nonce: await sha256Hex(nonce),
    });
    return {
      identityToken: result.identityToken,
      nonce,
      authorizationCode: result.authorizationCode,
      fullName: [result.givenName, result.familyName]
        .filter(Boolean)
        .join(" ")
        .trim(),
    };
  } catch (error) {
    if ((error as { code?: string }).code === "cancelled") return null;
    throw error;
  }
}

/**
 * Set up the app shell: hidden status bar, and `onResume` when the app
 * comes back to the front. Does nothing in a browser.
 */
export async function setupNativeShell(onResume: () => void) {
  if (!isNativeApp()) return;
  document.documentElement.classList.add("native-app");
  const [{ StatusBar }, { App }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/app"),
  ]);
  await StatusBar.hide().catch(() => {});
  await App.addListener("resume", onResume);
}
