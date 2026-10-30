import { expect, it } from "vitest";
import { RAID_COSMETICS } from "../../packages/shared/src/raid";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
import { JOURNEY_ITEMS } from "../../packages/shared/src/journey";
import {
  framePortrait,
  framedAvatar,
  portraitAvatar,
} from "../../apps/client/src/portraits";
import { friendsMarkup } from "../../apps/client/src/friends-view";

it("renders every real raid, collection and journey frame without changing the avatar art", () => {
  const catalog = [
    ...Object.entries(RAID_COSMETICS).map(([id, item]) => ({ id, ...item })),
    ...LOOK_ITEMS,
    ...JOURNEY_ITEMS,
  ].filter((item) => item.slot === "frame");
  expect(catalog.length).toBeGreaterThan(15);
  for (const { id } of catalog) {
    const html = framePortrait('<svg data-test-avatar="original"></svg>', id);
    expect(html).toContain(`data-portrait-frame="${id}"`);
    expect(html).toContain('<svg data-test-avatar="original"></svg>');
  }
});
it("ignores cleared, unknown and non-frame cosmetics", () => {
  for (const frame of [
    undefined,
    null,
    "",
    "halo-aura",
    '" onclick="alert(1)',
    "not-a-real-frame",
  ])
    expect(framePortrait("portrait", frame)).toBe("portrait");
});
it("keeps the worn champion skin and legacy lobby frame rendering separate", () => {
  const player = {
    character: "voltkit" as const,
    raidLook: { frame: "conqueror" },
    championLooks: { voltkit: { skin: "voltkit-midnight", stage: 1 } },
  };
  const plain = portraitAvatar(player, "plain");
  const framed = framedAvatar(player, "framed");
  expect(plain).toContain("voltkit-midnight");
  expect(plain).not.toContain("data-portrait-frame");
  expect(framed).toContain("voltkit-midnight");
  expect(framed.match(/data-portrait-frame=/g)).toHaveLength(1);
});
it("preserves saved frames on offline friend initials and on live champion avatars", () => {
  const html = friendsMarkup({
    code: "ABCDEF12",
    friends: [
      { id: "offline", name: "Mia", online: false, frame: "conqueror" },
      {
        id: "online",
        name: "Nova",
        online: true,
        fighter: "auralynx",
        frame: "galaxy-frame",
      },
    ],
    incoming: [],
    outgoing: [],
  });
  expect(html).toContain('data-portrait-frame="conqueror"');
  expect(html).toContain('data-portrait-frame="galaxy-frame"');
  expect(html).toContain("Mia");
  expect(html).toContain("auralynx");
});
