import { describe, expect, it } from "vitest";
import {
  APPLE_CHOICE_KEY,
  appleChoiceRemembered,
  isAppleDevice,
  rememberAppleChoice,
  showAppleSignInAtOnce,
} from "../../packages/shared/src/apple-device";

// Real user agents (and, for Chromium browsers, userAgentData.platform).
const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  // iPadOS Safari asks for the desktop page: it says Macintosh.
  ipadDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  ipadMobile:
    "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  androidFirefox:
    "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  linuxFirefox:
    "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  chromeOS:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

describe("isAppleDevice", () => {
  it.each([
    ["iPhone Safari", UA.iphoneSafari, undefined],
    ["iPhone Chrome", UA.iphoneChrome, undefined],
    ["iPad asking for the desktop page", UA.ipadDesktop, undefined],
    ["iPad, mobile page", UA.ipadMobile, undefined],
    ["Mac Safari", UA.macSafari, undefined],
    ["Mac Chrome", UA.macChrome, "macOS"],
  ])("%s is Apple", (_, userAgent, platform) => {
    expect(isAppleDevice({ userAgent, platform })).toBe(true);
  });

  it.each([
    ["Android Chrome", UA.androidChrome, "Android"],
    ["Samsung Internet", UA.samsungInternet, "Android"],
    ["Android Firefox", UA.androidFirefox, undefined],
    ["Windows Chrome", UA.windowsChrome, "Windows"],
    ["Windows Edge", UA.windowsEdge, "Windows"],
    ["Linux Firefox", UA.linuxFirefox, undefined],
    ["ChromeOS", UA.chromeOS, "Chrome OS"],
  ])("%s is not Apple", (_, userAgent, platform) => {
    expect(isAppleDevice({ userAgent, platform })).toBe(false);
    // Without the platform hint (older Chromium), the agent alone decides.
    expect(isAppleDevice({ userAgent })).toBe(false);
  });

  it("the iPhone app is Apple, the Android app isn't, whatever the agent", () => {
    expect(
      isAppleDevice({ userAgent: UA.androidChrome, nativePlatform: "ios" }),
    ).toBe(true);
    expect(
      isAppleDevice({ userAgent: UA.iphoneSafari, nativePlatform: "android" }),
    ).toBe(false);
  });

  it("the platform hint wins over the agent when it names one", () => {
    // userAgentData.platform is the browser's own answer; the agent string
    // can be changed by extensions and "request desktop site".
    expect(
      isAppleDevice({ userAgent: UA.windowsChrome, platform: "macOS" }),
    ).toBe(true);
    expect(
      isAppleDevice({ userAgent: UA.macChrome, platform: "Windows" }),
    ).toBe(false);
  });

  it("an unknown device counts as Apple (shows the button)", () => {
    expect(isAppleDevice({})).toBe(true);
    expect(isAppleDevice({ userAgent: "" })).toBe(true);
    expect(isAppleDevice({ userAgent: "SomeBot/1.0", platform: "" })).toBe(
      true,
    );
    expect(
      isAppleDevice({ userAgent: "SomeBot/1.0", platform: "Unknown" }),
    ).toBe(true);
  });
});

/** A Storage stand-in; `broken` throws as a blocked one does. */
function fakeStorage(broken = false) {
  const items = new Map<string, string>();
  return {
    items,
    getItem(key: string) {
      if (broken) throw new DOMException("blocked", "SecurityError");
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (broken) throw new DOMException("full", "QuotaExceededError");
      items.set(key, value);
    },
  };
}

describe("remembering the player's choice", () => {
  const android = { userAgent: UA.androidChrome, platform: "Android" };

  it("an Android device shows the button once its player asked for it", () => {
    const storage = fakeStorage();
    expect(showAppleSignInAtOnce(android, storage)).toBe(false);
    expect(appleChoiceRemembered(storage)).toBe(false);
    rememberAppleChoice(storage);
    expect(storage.items.get(APPLE_CHOICE_KEY)).toBe("shown");
    expect(appleChoiceRemembered(storage)).toBe(true);
    expect(showAppleSignInAtOnce(android, storage)).toBe(true);
  });

  it("an Apple device shows it without asking", () => {
    expect(
      showAppleSignInAtOnce({ userAgent: UA.iphoneSafari }, fakeStorage()),
    ).toBe(true);
  });

  it("blocked storage never throws and keeps the link", () => {
    const storage = fakeStorage(true);
    expect(() => rememberAppleChoice(storage)).not.toThrow();
    expect(appleChoiceRemembered(storage)).toBe(false);
    expect(showAppleSignInAtOnce(android, storage)).toBe(false);
  });

  it("no storage at all (node) never throws", () => {
    expect(() => rememberAppleChoice()).not.toThrow();
    expect(appleChoiceRemembered()).toBe(false);
  });
});
