// Sample screens built from the shared UI components (UI remodel step 1), so
// the visual checks can measure the shell before any real screen uses it.
// Loaded in the page with `await import("/ui-kit.ts")`.
import {
  CHARACTERS,
  type CharacterId,
} from "../../../packages/shared/src/index";
import {
  actionBar,
  actions,
  avatar,
  bar,
  button,
  chips,
  emptyState,
  itemTile,
  panel,
  price,
  row,
  segmented,
  tabs,
  tag,
  timer,
} from "../../../apps/client/src/ui/components";
import {
  askConfirm,
  openHubPanel,
} from "../../../apps/client/src/ui/hub-panel";
import {
  fighterAvatar,
  fighterArt,
} from "../../../apps/client/src/fighter-art";
import { itemPicture } from "../../../apps/client/src/shop-ui";
import { picksCountdown } from "../../../apps/client/src/shop-ui";
import { CHAMPION_SKINS, skinPrice } from "../../../packages/shared/src/shop";

const STATE: Record<string, "owned" | "equipped"> = {
  "voltkit-midnight": "owned",
  "voltkit-stormcrown": "equipped",
};
const SKINS = CHAMPION_SKINS.filter((s) => s.champion === "voltkit").map(
  (s) =>
    [
      s.id,
      s.name,
      s.rarity,
      "Voltkit skin",
      STATE[s.id] ?? skinPrice(s),
    ] as const,
);

/** A full panel: tabs, filters, a tile grid and an action bar. */
export function demoPanel() {
  const grid = SKINS.map(([id, name, rarity, sub, state], i) =>
    itemTile({
      id,
      art: itemPicture(id, "voltkit", `demo-${id}`),
      name,
      sub,
      rarity,
      pressed: i === 0,
      foot:
        state === "owned"
          ? "Owned"
          : state === "equipped"
            ? "Equipped"
            : price(state as number),
      footKind: typeof state === "number" ? "default" : "ok",
      corner: i === 2 ? tag("−20%", "sale") : "",
    }),
  ).join("");
  return panel({
    kicker: `Today · new in ${picksCountdown()}`,
    title: "Shop",
    tools: segmented(
      [
        { id: "shop", label: "Shop", selected: true },
        { id: "wardrobe", label: "Wardrobe" },
      ],
      "Shop or Wardrobe",
      "mode",
      true,
    ),
    tabs: tabs(
      [
        { id: "today", label: "Today", selected: true },
        { id: "skins", label: "Skins" },
        { id: "mythic", label: "Mythic Hall" },
        { id: "sets", label: "Collections" },
      ],
      "Shop sections",
    ),
    body: `${chips(
      [
        { id: "all", label: "All", selected: true },
        { id: "owned", label: "Owned" },
        { id: "new", label: "Not owned" },
      ],
      "Show",
    )}<div class="ui-grid" style="--cols:3">${grid}</div>${timer("New picks in 7 h 12 m")}`,
    foot: actionBar(
      `<span class="ui-note">Midnight · Voltkit skin</span>`,
      actions(button("Revert"), button("Equip", { kind: "ok", icon: "check" })),
    ),
  });
}

/** A sheet: the Lobby fighter and PLAY stay in view. */
export function demoSheet() {
  const friends: [
    string,
    CharacterId,
    "online" | "busy" | "plaza" | "away",
    string,
    string,
  ][] = [
    ["Kai", "cindrake", "online", "In the Lobby", "Invite"],
    ["Mina", "lumoth", "busy", "In a 2v2", "Watch"],
    ["Rae", "tidefin", "plaza", "In the Plaza", "Invite"],
    ["Juniper", "terradon", "away", "Online 1 h ago", ""],
  ];
  return panel({
    kind: "sheet",
    kicker: "3 online",
    title: "Friends",
    body: `${row({
      lead: avatar(fighterAvatar("auralynx", "demo-pip"), { size: 40 }),
      title: "Pip",
      sub: "wants to be friends",
      actions:
        button("Decline", { size: "s" }) +
        button("Accept", { size: "s", kind: "ok" }),
    })}${friends
      .map(([name, c, status, sub, act]) =>
        row({
          lead: avatar(fighterAvatar(c, `demo-${name}`), {
            element: CHARACTERS[c].element,
            status,
            size: 44,
          }),
          title: name,
          sub,
          actions: act
            ? button(act, {
                size: "s",
                kind: act === "Invite" ? "primary" : "default",
              })
            : "",
        }),
      )
      .join(
        "",
      )}${bar(2, 6, { label: "Missions done" })}${emptyState("No recent players", "Play a match and they show up here.")}`,
  });
}

export function openDemo(kind: "panel" | "sheet") {
  return openHubPanel(kind === "panel" ? demoPanel() : demoSheet(), {
    rail: kind === "panel" ? "shop" : "friends",
  });
}

/** The purchase confirmation, with the game's own numbers for a 20%-off skin. */
export function demoConfirm() {
  return askConfirm({
    kicker: "Confirm purchase",
    title: "Blue Flame",
    art: fighterArt("cindrake", undefined, {
      skin: "cindrake-blue-flame",
      stage: 1,
    } as never),
    lines: [
      ["Price", price(1200, 1500)],
      ["Your coins", price(2340)],
    ],
    total: ["After", price(1140)],
    confirm: "Buy",
    confirmAfter: price(1200),
  });
}
