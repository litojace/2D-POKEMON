import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The iOS app is an iPad app too (docs/ios-app.md, "iPad"). Xcode can't run
// here, so these read the project files the Mac build uses.
const ios = "apps/client/ios/App/";
const project = readFileSync(`${ios}App.xcodeproj/project.pbxproj`, "utf8");
const plist = readFileSync(`${ios}App/Info.plist`, "utf8");

/** The strings in the plist array under `key`. */
function plistArray(key: string) {
  const at = plist.indexOf(`<key>${key}</key>`);
  expect(at, key).toBeGreaterThan(-1);
  const body = plist.slice(at, plist.indexOf("</array>", at));
  return [...body.matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]);
}
/** The boolean under `key`, or undefined when the key is missing. */
function plistBool(key: string) {
  const m = plist.match(new RegExp(`<key>${key}</key>\\s*<(true|false)/>`));
  return m ? m[1] === "true" : undefined;
}

const LANDSCAPE = [
  "UIInterfaceOrientationLandscapeLeft",
  "UIInterfaceOrientationLandscapeRight",
];

describe("the iPad build", () => {
  it("builds for iPhone and iPad in Debug and Release", () => {
    const families = [
      ...project.matchAll(/TARGETED_DEVICE_FAMILY = ([^;]+);/g),
    ].map((m) => m[1]);
    expect(families).toEqual(['"1,2"', '"1,2"']);
  });

  it("stays landscape on iPad, full screen", () => {
    expect(plistArray("UISupportedInterfaceOrientations").sort()).toEqual(
      LANDSCAPE,
    );
    expect(plistArray("UISupportedInterfaceOrientations~ipad").sort()).toEqual(
      LANDSCAPE,
    );
    // An iPad app that doesn't support all four orientations must opt out of
    // iPad multitasking, or App Store validation rejects the upload. The key
    // is deprecated from iPadOS 26 but still honoured with the iOS 26 SDK;
    // the opt-out key below would switch it off, so it must not be added.
    expect(plistBool("UIRequiresFullScreen")).toBe(true);
    expect(plist).not.toContain(
      "UIRequiresFullScreenIgnoredStartingWithVersion",
    );
    expect(plistBool("UIApplicationSupportsMultipleScenes")).toBe(false);
  });

  it("has app icons every device can use", () => {
    for (const set of [
      "AppIcon",
      "AppIcon-Pyranda",
      "AppIcon-SplitFace",
      "AppIcon-StareDown",
    ]) {
      const images: { idiom: string; size: string }[] = JSON.parse(
        readFileSync(
          `${ios}App/Assets.xcassets/${set}.appiconset/Contents.json`,
          "utf8",
        ),
      ).images;
      expect(images.length, set).toBeGreaterThan(0);
      for (const image of images) {
        // One 1024 px "universal" image: Xcode makes the iPhone and iPad
        // sizes from it. An iphone-only set would leave the iPad without one.
        expect(image.idiom, set).toBe("universal");
        expect(image.size, set).toBe("1024x1024");
      }
    }
  });
});
