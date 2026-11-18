import { readFileSync } from "node:fs";
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
          `\\[data-cosmetic="${id}"\\]::before\\s*\\{\\s*background-image:\\s*url\\("data:image/svg`,
        ).test(FRAME_CSS),
    );
  expect(plain).toEqual([]);
});

// Frame art is still light: nothing in it animates (no SMIL inside the
// SVGs, no CSS animation on the signature frames).
it("keeps the signature frames still", () => {
  const signature = css("signature-frames.css");
  expect(signature).not.toMatch(/<animate|animation\s*:/);
});

it("signature-frames.css is what its generator writes", () => {
  const before = css("signature-frames.css");
  execFileSync("node", ["scripts/signature-frame-art.mjs"]);
  execFileSync("npx", [
    "prettier",
    "--write",
    "apps/client/src/signature-frames.css",
  ]);
  expect(css("signature-frames.css")).toBe(before);
}, 60_000);
