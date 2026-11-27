import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { RAID_COSMETICS } from "../../packages/shared/src/raid";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
import { REWARD_ITEMS } from "../../packages/shared/src/journey";

const css = (name: string) =>
  readFileSync(
    new URL(`../../apps/client/src/${name}`, import.meta.url),
    "utf8",
  );
const FRAME_CSS = [
  "boss-frames.css",
  "collection-frames.css",
  "journey-frames.css",
  "signature-frames.css",
]
  .map(css)
  .join("\n");
const frames = [
  ...Object.entries(RAID_COSMETICS).map(([id, item]) => ({ id, ...item })),
  ...LOOK_ITEMS,
  ...REWARD_ITEMS,
].filter((item) => item.slot === "frame");
/** The pictures the frame stylesheets name, as files (scripts/frame-files.mjs). */
const FRAMES_DIR = new URL("../../apps/client/src/frames/", import.meta.url);
const picture = (file: string) =>
  readFileSync(new URL(file, FRAMES_DIR), "utf8");
const named = (text: string) =>
  [...text.matchAll(/url\("\.\/frames\/([\w-]+\.svg)"\)/g)].map((m) => m[1]);

// Each frame has a look of its own (owner, 18 Nov 2026): art drawn in its
// ::before, never only a coloured ring that the rarity light makes look
// like every other frame of that rarity.
it("gives every frame its own artwork", () => {
  expect(frames.length).toBeGreaterThan(20);
  const plain = frames
    .map((item) => item.id)
    .filter(
      (id) =>
        !new RegExp(
          `\\[data-cosmetic="${id}"\\]::before\\s*\\{\\s*background-image:\\s*url\\("\\./frames/[\\w-]+\\.svg"\\)`,
        ).test(FRAME_CSS),
    );
  expect(plain).toEqual([]);
});

// Frame art is still light: nothing in it animates (no SMIL inside the
// SVGs, no CSS animation on the signature frames).
it("keeps the signature frames still", () => {
  const signature = css("signature-frames.css");
  expect(signature).not.toMatch(/<animate|animation\s*:/);
  const files = named(signature);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) expect(picture(file)).not.toMatch(/<animate/);
});

// The art lives in files the stylesheets name (frame-files.mjs), not in
// data URIs in the CSS every start downloads before it can draw (26 Nov
// 2026: 365 kB of it). Every file named exists and is a picture; no file is
// left that nothing names; no frame art went back inline.
it("keeps frame art in files the stylesheets name", () => {
  const files = named(FRAME_CSS);
  expect(files.length).toBeGreaterThan(40);
  for (const file of files) expect(picture(file)).toMatch(/^<svg /);
  const onDisk = readdirSync(FRAMES_DIR).filter((f) => f.endsWith(".svg"));
  expect(onDisk.sort()).toEqual([...new Set(files)].sort());
  expect(FRAME_CSS).not.toMatch(/data:image\/svg\+xml/);
});

it("signature-frames.css and its pictures are what its generator writes", () => {
  const before = css("signature-frames.css");
  const pictures = () =>
    readdirSync(FRAMES_DIR)
      .filter((f) => f.startsWith("signature-"))
      .map((f) => [f, picture(f)]);
  const drawn = pictures();
  execFileSync("node", ["scripts/signature-frame-art.mjs"]);
  execFileSync("npx", [
    "prettier",
    "--write",
    "apps/client/src/signature-frames.css",
  ]);
  expect(css("signature-frames.css")).toBe(before);
  expect(pictures()).toEqual(drawn);
}, 60_000);
