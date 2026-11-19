/**
 * Where the hub's scene switch (Lobby, Plaza) sits in the top
 * bar. It is centred on the screen when it fits there; on narrow phones the
 * screen's middle runs into the coin pills (the player card on the left is
 * narrower than the pills on the right), so it moves to the middle of the
 * free gap between the card and the pills, and its tabs narrow only if even
 * that gap is too small. The switch is fixed and the pills flow in the
 * header, so CSS alone can't know where the pills start: this measures.
 */

import { PANEL_EVENT } from "./ui/hub-panel";

/** The least room between the switch and its neighbours (px). */
export const SWITCH_CLEARANCE = 8;

export interface SwitchPlace {
  /** The switch's centre (px from the left). */
  x: number;
  /** Narrow tabs: even the free gap is too small for the normal ones. */
  tight: boolean;
}

/**
 * left/right: the free gap's edges (the card's right, the pills' left).
 * width: the switch's normal width; tightWidth: with narrow tabs.
 */
export function placeSwitch(
  screen: number,
  left: number,
  right: number,
  width: number,
  tightWidth: number,
): SwitchPlace {
  const room = right - left - 2 * SWITCH_CLEARANCE;
  const middle = screen / 2;
  if (
    middle - width / 2 >= left + SWITCH_CLEARANCE &&
    middle + width / 2 <= right - SWITCH_CLEARANCE
  )
    return { x: middle, tight: false };
  const tight = width > room && tightWidth < width;
  return { x: (left + right) / 2, tight };
}

/** The gap between the player card and the chat button (px). */
export const CHAT_GAP = 12;

/** The tabs' width when narrowed (match .hub-scenes.is-tight in lobby.css). */
const TIGHT_TAB = 40;

/**
 * Under the player card, for screens too narrow for the chat button beside
 * it: right under the card's right end, or else right of what sits under
 * the card (the Plaza's quests). The first spot
 * whose middle and corners show only the scene behind is taken.
 */
function chatBelowCard(card: DOMRect, size: DOMRect, chat: HTMLElement) {
  // Under the card's right end, or right of what sits under the card (the
  // Plaza's quests); 8 px under it, or 2 px where
  // the screen is too short for that (the Lobby's stage starts close under
  // the card on a 320 px tall phone); last, the bottom left corner.
  const spots = [CHAT_GAP, 2].flatMap((gap) => [
    { x: card.right - size.width, y: card.bottom + gap },
    { x: card.right + CHAT_GAP, y: card.bottom + gap },
  ]);
  spots.push({
    x: card.left,
    y: innerHeight - size.height - CHAT_GAP - safeBottom(),
  });
  // What the hub keeps on screen, hit or not (some let taps through).
  const blocks = Array.from(document.querySelectorAll(HUD_BLOCKS))
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width && r.height);
  const free = (x: number, y: number) =>
    !blocks.some(
      (r) =>
        x < r.right &&
        r.left < x + size.width &&
        y < r.bottom &&
        r.top < y + size.height,
    ) &&
    [
      [x + 2, y + 2],
      [x + size.width - 2, y + 2],
      [x + 2, y + size.height - 2],
      [x + size.width - 2, y + size.height - 2],
      [x + size.width / 2, y + size.height / 2],
    ].every(([px, py]) => {
      const hit = document
        .elementsFromPoint(px, py)
        .find((e) => e !== chat && !chat.contains(e));
      if (!hit) return true;
      // The scene: a canvas, or a layer as big as the screen.
      if (hit instanceof HTMLCanvasElement) return true;
      const r = hit.getBoundingClientRect();
      return r.width * r.height >= innerWidth * innerHeight * 0.6;
    });
  return spots.find((s) => free(s.x, s.y)) ?? spots[0];
}
/** Boxes on the hub's scenes the chat button must keep out of: an open
 * screen too (a panel or a sheet, ui/hub-panel.ts), or the button lands on
 * its head (the Friends sheet's tabs on a 568x320 phone). Not one that is
 * fading out. */
const HUD_BLOCKS = [
  ".ui-panel-host:not([data-ui-leaving]) > .ui-panel",
  ".lobby-party",
  ".lobby-rail",
  ".lobby-card",
  ".lobby-play",
  ".lobby-nameplate",
  ".lobby-step",
  "#pz-quests",
  ".pz-quests",
  "#pz-banner:not(:empty)",
  "#pz-event:not([hidden])",
  "#bs-chips",
  "#bs-bar",
  "#bs-wallet",
].join(",");
const safeBottom = () =>
  parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--safe-bottom",
    ),
  ) || 0;

/** Keeps the switch placed as the screen and the pills change. */
export function watchSceneSwitch(nav: HTMLElement) {
  let frame = 0;
  const place = () => {
    frame = 0;
    if (nav.hidden) return;
    const card = document.querySelector("#account-profile");
    // The first thing right of the card: the coins or the gear.
    const pills = ["#account-coins", "#home-settings"]
      .map((s) => document.querySelector(s)?.getBoundingClientRect())
      .filter((r): r is DOMRect => !!r && r.width > 0);
    const cardBox = card?.getBoundingClientRect();
    if (!cardBox?.width || !pills.length) {
      nav.style.removeProperty("--hub-scenes-x");
      nav.classList.remove("is-tight");
      return;
    }
    const right = Math.min(...pills.map((r) => r.left));
    const tabs = nav.querySelectorAll("button").length;
    nav.classList.remove("is-tight");
    const width = nav.getBoundingClientRect().width;
    const tabWidth = nav.querySelector("button")?.getBoundingClientRect().width;
    const tightWidth = width - tabs * Math.max(0, (tabWidth ?? 0) - TIGHT_TAB);
    // The chat button rides 12 px right of the card, in the same gap: the
    // switch then centres in what is left (chat/chat-ui.ts). Where even
    // narrow tabs wouldn't fit beside it (phones under ~620 px wide), it
    // drops under the card instead, to the first free spot.
    let left = cardBox.right;
    const chat = document.getElementById("chat-button");
    if (chat && !chat.hidden && chat.dataset.place === "hub") {
      const size = chat.getBoundingClientRect();
      const beside = cardBox.right + CHAT_GAP + size.width;
      const fits =
        right - beside - 2 * SWITCH_CLEARANCE >= Math.min(width, tightWidth);
      // Beside the card, CSS places it (chat.css); under it, this does.
      chat.dataset.row = fits ? "top" : "below";
      if (!fits) {
        const spot = chatBelowCard(cardBox, size, chat);
        chat.style.setProperty("--chat-x", `${Math.round(spot.x)}px`);
        chat.style.setProperty("--chat-y", `${Math.round(spot.y)}px`);
      }
      if (fits) left = beside;
    }
    const spot = placeSwitch(innerWidth, left, right, width, tightWidth);
    nav.classList.toggle("is-tight", spot.tight);
    nav.style.setProperty("--hub-scenes-x", `${Math.round(spot.x)}px`);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(place);
  };
  addEventListener("resize", schedule);
  // A hub screen opening or closing changes what the button must avoid.
  document.addEventListener(PANEL_EVENT, schedule);
  const sizes = new ResizeObserver(schedule);
  const watchAll = () => {
    for (const s of [
      "#account-nav",
      "#account-profile",
      "#account-coins",
      "#home-settings",
      "#chat-button",
    ]) {
      const e = document.querySelector(s);
      if (e) sizes.observe(e);
    }
  };
  watchAll();
  // The safe area (set on <html>) or a card that eased into place moves the
  // card without resizing it.
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  document.addEventListener("transitionend", (e) => {
    if ((e.target as Element | null)?.closest?.(".topbar")) schedule();
  });
  // The card and the pills are rebuilt when the account changes.
  new MutationObserver(() => {
    watchAll();
    schedule();
  }).observe(document.querySelector("#account-nav") ?? document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return schedule;
}
