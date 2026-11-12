import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
const root = "apps/client/dist/";
const manifest = JSON.parse(
  readFileSync(root + "manifest.webmanifest", "utf8"),
);
assert.equal(manifest.display, "standalone");
assert.deepEqual(manifest.display_override, ["fullscreen", "standalone"]);
assert.equal(manifest.orientation, "landscape");
assert.equal(manifest.scope, "/");
assert(manifest.icons.some((icon) => icon.purpose === "maskable"));
for (const [path, size] of [
  ["arena-192.png", 192],
  ["arena-512.png", 512],
  ["arena-maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const image = readFileSync(root + "icons/" + path);
  assert.equal(image.readUInt32BE(16), size);
  assert.equal(image.readUInt32BE(20), size);
}
const sw = readFileSync(root + "sw.js", "utf8");
const urls = [...sw.matchAll(/"url":"([^"]+)"/g)].map((match) => match[1]);
assert(urls.length >= 8, "Build must precache public assets");
assert(
  urls.every((url) =>
    /^(assets\/|icons\/|offline\.html$|manifest\.webmanifest$)/.test(url),
  ),
  "Only public static assets may be cached",
);
assert(urls.includes("offline.html"));
for (const art of [
  "startup-starfield",
  "startup-sigil",
  "raid-spell-flipbook",
  // Painted bosses (Grumblecrag and Tidewyrm are vector art, drawn by the client).
  ...["gloomshade", "somnara", "prismatail", "emberwing", "storm-twins"].map(
    (name) => `raid-whole-${name}`,
  ),
  ...["gloomshade", "somnara", "prismatail", "emberwing", "storm-twins"].map(
    (name) => `raid-directions-${name}`,
  ),
])
  assert(
    urls.some((url) => new RegExp(`^assets/${art}-[\\w-]+\\.webp$`).test(url)),
    `${art} must use a content-hashed URL and remain available offline`,
  );
assert(!urls.includes("assets/town/fountain.webp"));
assert(!urls.includes("assets/town/ground.webp"));
// The hub's Plaza replaced the old town: its art is no longer downloaded.
assert(
  !urls.some((url) => /^assets\/town-/.test(url)),
  "The old town's art must not be precached",
);
const music = JSON.parse(
  readFileSync("apps/client/public/assets/music/sources.json", "utf8"),
);
for (const sample of music) {
  assert(
    urls.includes(`assets/music/${sample.file}`),
    `Missing offline instrument: ${sample.file}`,
  );
}
assert(
  !urls.includes("index.html"),
  "Game entry navigation must remain network-only",
);
assert(urls.every((url) => existsSync(root + url)));
// Links in old emails land on these paths; each must be the game page.
const page = readFileSync(root + "index.html", "utf8");
for (const path of ["email-confirmed", "reset-password", "auth/callback"]) {
  assert.equal(
    readFileSync(root + `${path}.html`, "utf8"),
    page,
    `Old auth link page ${path}.html must match index.html`,
  );
  assert(!existsSync(root + path), `Drop the unused ${path}/ copy`);
}
assert(!existsSync(root + "touch-preview.html"));
assert(!existsSync(root + "ability-preview.html"));
console.log(
  `PWA build verified: ${urls.length} static precache entries, icons, manifest, and preview exclusion.`,
);

assert(!existsSync(root + "safe-preview.html"));

assert(!existsSync(root + "readiness-preview.html"));

assert(!existsSync(root + "animation-preview.html"));
assert(!existsSync(root + "boss-animation-preview.html"));
assert(!existsSync(root + "mobile-layout-preview.html"));
