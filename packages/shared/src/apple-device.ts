// Whether to show "Continue with Apple" straight away (owner, 25 Nov 2026).
//
// On Apple devices (iPhone, iPad, Mac, and the iPhone app) the button shows
// as before. Elsewhere (Android, Windows, Linux, ChromeOS) it waits behind a
// small "Signed up with Apple?" link: Sign in with Apple works on the web in
// every browser, and a player who made their account on an iPhone (perhaps
// with Hide My Email) needs it to get back in on another device. Once they
// tap the link, that device remembers and shows the button from then on.
//
// When unsure what the device is, it counts as Apple: a button shown to
// someone who doesn't need it costs less than a player locked out.
//
// Used by the game's sign-in screen (apps/client/src/accounts.ts) and the
// website's account page (apps/site/src/account.ts).

export interface DeviceHints {
  /** navigator.userAgent */
  userAgent?: string;
  /** navigator.userAgentData?.platform (Chromium browsers only). */
  platform?: string;
  /** The native app's platform ("ios" or "android"); undefined in a browser. */
  nativePlatform?: string;
}

const APPLE_PLATFORMS = /^(macos|ios|ipados)$/i;
const OTHER_PLATFORMS = /^(android|windows|linux|chrome ?os|chromium ?os)$/i;
// iPadOS Safari asks for desktop pages as a Mac ("Macintosh"): Mac and iPad
// are both Apple, so the Mac counts too.
const APPLE_AGENT = /iPhone|iPad|iPod|Macintosh|Mac OS X/;
const OTHER_AGENT = /Android|Windows|CrOS|Linux|X11/;

/** True on Apple devices, and whenever the device can't be told. */
export function isAppleDevice(hints: DeviceHints): boolean {
  if (hints.nativePlatform === "ios") return true;
  if (hints.nativePlatform === "android") return false;
  const platform = hints.platform?.trim() ?? "";
  if (APPLE_PLATFORMS.test(platform)) return true;
  if (OTHER_PLATFORMS.test(platform)) return false;
  const agent = hints.userAgent ?? "";
  if (APPLE_AGENT.test(agent)) return true;
  if (OTHER_AGENT.test(agent)) return false;
  return true;
}

/** The browser's hints, for isAppleDevice. */
export function browserDeviceHints(nativePlatform?: string): DeviceHints {
  if (typeof navigator === "undefined") return { nativePlatform };
  const data = (navigator as { userAgentData?: { platform?: unknown } })
    .userAgentData;
  return {
    userAgent: navigator.userAgent,
    platform: typeof data?.platform === "string" ? data.platform : undefined,
    nativePlatform,
  };
}

/** This device's note that its player asked for the Apple button. */
export const APPLE_CHOICE_KEY = "parena-apple-sign-in";

type ChoiceStorage = Pick<Storage, "getItem" | "setItem">;

const localStore = (): ChoiceStorage | undefined => {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined; // storage blocked (private mode, site data off)
  }
};

/** Whether the player on this device asked for the Apple button before. */
export function appleChoiceRemembered(
  storage: ChoiceStorage | undefined = localStore(),
): boolean {
  try {
    return storage?.getItem(APPLE_CHOICE_KEY) === "shown";
  } catch {
    return false;
  }
}

/** Remember that the player on this device asked for the Apple button. */
export function rememberAppleChoice(
  storage: ChoiceStorage | undefined = localStore(),
): void {
  try {
    storage?.setItem(APPLE_CHOICE_KEY, "shown");
  } catch {
    // Storage full or blocked: the button still shows for now.
  }
}

/** Show the Apple button at once (else behind "Signed up with Apple?"). */
export function showAppleSignInAtOnce(
  hints: DeviceHints,
  storage?: ChoiceStorage,
): boolean {
  return (
    isAppleDevice(hints) ||
    appleChoiceRemembered(storage === undefined ? localStore() : storage)
  );
}
