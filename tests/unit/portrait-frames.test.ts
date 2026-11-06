import { expect, it } from "vitest";
import { RAID_COSMETICS } from "../../packages/shared/src/raid";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
import { JOURNEY_ITEMS } from "../../packages/shared/src/journey";
import {
  framePortrait,
  framedAvatar,
  portraitAvatar,
} from "../../apps/client/src/portraits";
import {
  friendsMarkup,
  friendsView,
} from "../../apps/client/src/screens/friends-view";

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
  ]) {
    const html = framePortrait("portrait", frame);
    expect(html).toBe('<span class="portrait-disc">portrait</span>');
    expect(html).not.toContain("data-portrait-frame");
  }
});
it("uses the worn champion skin inside a single circular frame", () => {
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
  const html = friendsMarkup(friendsView(), {
    list: {
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
    },
    recent: null,
    party: { size: 1, ids: [], leader: true },
  });
  expect(html).toContain('data-portrait-frame="conqueror"');
  expect(html).toContain('data-portrait-frame="galaxy-frame"');
  expect(html).toContain("Mia");
  expect(html).toContain("auralynx");
});

it("applies equipped Colors consistently and isolates SVG filters per placement", () => {
  const player = {
    character: "terradon" as const,
    raidLook: { skin: "candy-colours" as const },
  };
  const left = framedAvatar(player, "left"),
    right = framedAvatar(player, "right");
  expect(left).toContain('id="preview-palette-candy-colours-left-colors"');
  expect(right).toContain("url(#preview-palette-candy-colours-right-colors)");
  expect(left).toContain('class="portrait-disc"');
  expect(
    framedAvatar(
      {
        ...player,
        championLooks: { terradon: { skin: "terradon-mossy", stage: 1 } },
      },
      "skinned",
    ),
  ).not.toContain("preview-palette");
});
it("uses earned frame stars from the same saved clear counts everywhere and bounds malformed values", () => {
  const player = {
    character: "tidefin" as const,
    raidLook: { frame: "conqueror" as const },
    raidClears: { grumblecrag: 53 },
  };
  expect(framedAvatar(player, "party")).toContain('data-frame-stars="5"');
  expect(framedAvatar(player, "party")).toContain("★★★★★");
  for (const invalid of [NaN, Infinity, -5])
    expect(framePortrait("art", "conqueror", invalid)).toContain(
      'data-frame-stars="0"',
    );
  expect(framePortrait("art", "conqueror", 8.5)).toContain(
    'data-frame-stars="5"',
  );
});
it("shows the saved champion skin, awakening stage and evolved frame on offline friends", () => {
  const html = friendsMarkup(friendsView(), {
    recent: null,
    party: { size: 1, ids: [], leader: true },
    list: {
      code: "ABCDEF12",
      friends: [
        {
          id: "friend",
          name: "Pal",
          online: false,
          fighter: "tidefin",
          frame: "conqueror",
          look: { frame: "conqueror", skin: "candy-colours" },
          championLooks: { tidefin: { skin: "tidefin-moontide", stage: 3 } },
          raidClears: { grumblecrag: 40 },
        },
      ],
      incoming: [],
      outgoing: [],
    },
  });
  expect(html).toContain("tidefin-moontide");
  expect(html).toContain('data-frame-stars="4"');
  expect(html).not.toContain("preview-palette");
});
