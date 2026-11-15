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
 *   not a web page;
 * - Settings → App icon switches the Home Screen icon (AppIcon.swift);
 * - hits and long presses tap the Taptic Engine (iPhones have no web
 *   vibration), and the screen never locks while the game is open
 *   (SceneDelegate.swift); edge swipes need a second swipe to leave the
 *   game, and the home bar fades out (ArenaViewController).
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * The privacy policy (public/privacy.html). The app's own pages live at
 * capacitor://localhost, so it links to the website's copy, which opens in
 * Safari; the website links to its own.
 */
export const PRIVACY_URL = `${(import.meta.env.VITE_SITE_URL || "").replace(/\/+$/, "")}/privacy.html`;

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

interface AppIconPlugin {
  getIcon(): Promise<{ supported: boolean; name?: string }>;
  setIcon(options: { name?: string }): Promise<void>;
}
const AppIcon = registerPlugin<AppIconPlugin>("AppIcon");

/**
 * The Home Screen icon in use (ios/App/App/AppIcon.swift): the alternate
 * icon set's name, or null for the default icon. Null as a whole outside the
 * app, or where iOS can't change the icon.
 */
export async function appIconState(): Promise<{ name: string | null } | null> {
  if (!isNativeApp()) return null;
  try {
    const { supported, name } = await AppIcon.getIcon();
    return supported ? { name: name ?? null } : null;
  } catch {
    return null;
  }
}

/** Switch the Home Screen icon (null: the default). iOS confirms it itself. */
export async function setAppIcon(name: string | null) {
  await AppIcon.setIcon(name ? { name } : {});
}

/**
 * Set up the app shell: hidden status bar, haptics, and `onResume` when the
 * app comes back to the front. Does nothing in a browser.
 */
export async function setupNativeShell(onResume: () => void) {
  if (!isNativeApp()) return;
  document.documentElement.classList.add("native-app");
  const [{ StatusBar }, { App }, { Haptics, ImpactStyle }, { setNativeTap }] =
    await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/app"),
      import("@capacitor/haptics"),
      import("./game-feel"),
    ]);
  await StatusBar.hide().catch(() => {});
  setNativeTap((strength) => {
    void Haptics.impact({
      style:
        strength >= 0.66
          ? ImpactStyle.Heavy
          : strength >= 0.33
            ? ImpactStyle.Medium
            : ImpactStyle.Light,
    }).catch(() => {});
  });
  await App.addListener("resume", onResume);
}
