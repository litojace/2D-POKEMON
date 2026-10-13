import { describe, expect, it } from "vitest";
import {
  fullscreenHelp,
  fullscreenPlatform,
} from "../../apps/client/src/fullscreen-help";
describe("Want fullscreen? help", () => {
  it("detects the platform for the right instructions", () => {
    expect(
      fullscreenPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", 5),
    ).toBe("iphone");
    expect(
      fullscreenPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5),
    ).toBe("ipad");
    expect(
      fullscreenPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0),
    ).toBe("desktop");
    expect(
      fullscreenPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)", 5),
    ).toBe("android");
  });
  it("gives home-screen steps per platform", () => {
    const base = { standalone: false, canPrompt: false, canFullscreen: false };
    expect(fullscreenHelp({ ...base, platform: "iphone" })).toContain(
      "Add to Home Screen",
    );
    expect(fullscreenHelp({ ...base, platform: "android" })).toContain(
      "Install app",
    );
    expect(fullscreenHelp({ ...base, platform: "desktop" })).toContain("F11");
  });
  it("offers the one-tap install and fullscreen buttons only when available", () => {
    const html = fullscreenHelp({
      standalone: false,
      platform: "android",
      canPrompt: true,
      canFullscreen: true,
    });
    expect(html).toContain('id="fullscreen-install"');
    expect(html).toContain('id="fullscreen-now"');
    const none = fullscreenHelp({
      standalone: false,
      platform: "iphone",
      canPrompt: false,
      canFullscreen: false,
    });
    expect(none).not.toContain("fullscreen-install");
    expect(none).not.toContain("fullscreen-now");
  });
  it("says so when already running from the home screen", () => {
    expect(
      fullscreenHelp({
        standalone: true,
        platform: "iphone",
        canPrompt: false,
        canFullscreen: false,
      }),
    ).toContain("already fullscreen");
  });
});
