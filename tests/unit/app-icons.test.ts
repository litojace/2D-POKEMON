import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  APP_ICONS,
  appIconCardHTML,
  appIconThumbnail,
} from "../../apps/client/src/app-icon-setting";

// Settings → App icon (docs/ios-app.md). Three lists name the alternate
// icons and must agree, or iOS refuses the switch on a player's phone: the
// Settings picker, the generator that renders them, and the Xcode build
// setting that puts them in the app.
const ios = "apps/client/ios/App/";
const catalog = `${ios}App/Assets.xcassets/`;
const alternates = APP_ICONS.flatMap((c) => (c.set ? [c.set] : []));

/** A PNG's width, height and colour type, read from its IHDR chunk. */
function pngHeader(path: string) {
  const bytes = readFileSync(path);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colourType: bytes[25],
  };
}
const RGB = 2;
const GRAY_ALPHA = 4;
const RGBA = 6;

describe("alternate app icons", () => {
  it("the picker, the generator and the Xcode build setting list the same icons", () => {
    expect(APP_ICONS[0].set).toBeNull();
    expect(alternates.length).toBeGreaterThan(0);
    const generator = readFileSync("scripts/generate-icons.mjs", "utf8");
    const listed = [
      ...generator
        .slice(generator.indexOf("const ALTERNATES"))
        .matchAll(/\["(AppIcon-\w+)", "[\w-]+\.svg"\]/g),
    ].map((m) => m[1]);
    expect(listed).toEqual(alternates);
    const project = readFileSync(`${ios}App.xcodeproj/project.pbxproj`, "utf8");
    const settings = [
      ...project.matchAll(
        /ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = "([^"]*)";/g,
      ),
    ].map((m) => m[1].split(" "));
    // Debug and Release.
    expect(settings).toEqual([alternates, alternates]);
  });

  it("every icon set has default, dark and tinted 1024 px images of the right kind", () => {
    for (const set of ["AppIcon", ...alternates]) {
      const folder = `${catalog}${set}.appiconset/`;
      const contents = JSON.parse(
        readFileSync(folder + "Contents.json", "utf8"),
      );
      const byAppearance = new Map<string, string>(
        contents.images.map(
          (image: {
            filename: string;
            size: string;
            appearances?: { value: string }[];
          }) => {
            expect(image.size).toBe("1024x1024");
            return [image.appearances?.[0].value ?? "default", image.filename];
          },
        ),
      );
      expect([...byAppearance.keys()].sort()).toEqual([
        "dark",
        "default",
        "tinted",
      ]);
      const kinds = { default: RGB, dark: RGBA, tinted: GRAY_ALPHA };
      for (const [appearance, colourType] of Object.entries(kinds)) {
        const png = pngHeader(folder + byAppearance.get(appearance));
        // The default icon has no alpha channel: App Store Connect rejects one.
        expect({ set, appearance, ...png }).toEqual({
          set,
          appearance,
          width: 1024,
          height: 1024,
          colourType,
        });
      }
    }
  });

  it("every choice has a Settings thumbnail", () => {
    for (const { set } of APP_ICONS) {
      const file = `apps/client/public${appIconThumbnail(set)}`;
      expect(existsSync(file), file).toBe(true);
      expect(pngHeader(file)).toMatchObject({ width: 144, height: 144 });
    }
  });

  it("the app registers the plugin that switches icons", () => {
    expect(readFileSync(`${ios}App/AppleSignIn.swift`, "utf8")).toContain(
      "registerPluginInstance(AppIconPlugin())",
    );
    const project = readFileSync(`${ios}App.xcodeproj/project.pbxproj`, "utf8");
    expect(project).toContain("/* AppIcon.swift in Sources */,");
  });

  it("the card starts hidden, with one choice per icon and the current one ticked", () => {
    const html = appIconCardHTML("AppIcon-Pyranda");
    expect(html).toMatch(/<section[^>]*id="prefs-app-icon-card"[^>]*\bhidden>/);
    const choices = [
      ...html.matchAll(/data-app-icon="([^"]*)" aria-checked="(\w+)"/g),
    ];
    expect(choices.map((m) => m[1] || null)).toEqual(
      APP_ICONS.map((c) => c.set),
    );
    expect(choices.filter((m) => m[2] === "true").map((m) => m[1])).toEqual([
      "AppIcon-Pyranda",
    ]);
  });
});
