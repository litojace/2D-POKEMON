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
  // Every raid boss is vector art, drawn by the client: no boss atlases.
  "raid-spell-flipbook",
])
  assert(
    urls.some((url) => new RegExp(`^assets/${art}-[\\w-]+\\.webp$`).test(url)),
    `${art} must use a content-hashed URL and remain available offline`,
  );
assert(
  !urls.some((url) => /^assets\/raid-(whole|directions)-/.test(url)),
  "Boss atlases are gone (every boss is vector art) and must not be precached",
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
// Phaser loads after the first screen (phaser-runtime.ts), not with the
// page, yet stays installed for offline battles; so do the Lobby panels
// that load on first use.
const entry = readFileSync(root + "index.html", "utf8");
assert(
  !/assets\/phaser-[\w-]+\.js/.test(entry),
  "Phaser must not load with the page (phaser-runtime.ts)",
);
assert(
  !/assets\/battle-kit-[\w-]+\.js/.test(entry),
  "The battle kit must not load with the page (phaser-runtime.ts)",
);
for (const chunk of [
  "phaser",
  "battle-kit",
  "raid-hall",
  "fitting-room",
  "journey",
])
  assert(
    urls.some((url) => new RegExp(`^assets/${chunk}-[\\w-]+\\.js$`).test(url)),
    `${chunk} must stay available offline`,
  );
// Every script a precached script imports is precached too: an installed
// game must not open a panel or a battle offline and miss half of it.
const scriptImports = (file) =>
  [
    ...readFileSync(root + file, "utf8").matchAll(
      /\bfrom\s*"\.\/([\w.-]+\.js)"|\bimport\s*"\.\/([\w.-]+\.js)"/g,
    ),
  ].map((match) => "assets/" + (match[1] ?? match[2]));
for (const url of urls.filter((url) => /^assets\/[^/]+\.js$/.test(url)))
  for (const needed of scriptImports(url))
    assert(
      urls.includes(needed),
      `${url} imports ${needed}, which is not precached`,
    );
// The script the game starts with. The service worker precaches nothing
// over 3 MiB (vite.config.ts), so a startup script that grows past it
// leaves installed games without their entry. Battle-only code belongs in
// the battle kit (apps/client/src/battle-kit.ts), a screen's code in its
// own import(): this fails well before that limit, while there is room.
const startup = entry.match(/src="\/(assets\/index-[\w-]+\.js)"/)?.[1];
assert(startup && urls.includes(startup), "The startup script is precached");
const startupBytes = readFileSync(root + startup).length;
const STARTUP_BUDGET = 2_400_000;
assert(
  startupBytes <= STARTUP_BUDGET,
  `The startup script is ${startupBytes} bytes, over its ${STARTUP_BUDGET} budget (the precache limit is 3,145,728): load battle-only code with the battle kit, or a screen's code on demand`,
);
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
  `PWA build verified: ${urls.length} static precache entries, icons, manifest, and preview exclusion. Startup script ${startupBytes} bytes of ${STARTUP_BUDGET}.`,
);

assert(!existsSync(root + "safe-preview.html"));

assert(!existsSync(root + "readiness-preview.html"));

assert(!existsSync(root + "animation-preview.html"));
assert(!existsSync(root + "boss-animation-preview.html"));
assert(!existsSync(root + "mobile-layout-preview.html"));
