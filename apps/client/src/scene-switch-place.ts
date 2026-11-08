/**
 * Where the hub's scene switch (Lobby, Plaza, Farm, Bistro) sits in the top
 * bar. It is centred on the screen when it fits there; on narrow phones the
 * screen's middle runs into the coin pills (the player card on the left is
 * narrower than the pills on the right), so it moves to the middle of the
 * free gap between the card and the pills, and its tabs narrow only if even
 * that gap is too small. The switch is fixed and the pills flow in the
 * header, so CSS alone can't know where the pills start: this measures.
 */

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

/** The tabs' width when narrowed (match .hub-scenes.is-tight in lobby.css). */
const TIGHT_TAB = 40;

/** Keeps the switch placed as the screen and the pills change. */
export function watchSceneSwitch(nav: HTMLElement) {
  let frame = 0;
  const place = () => {
    frame = 0;
    if (nav.hidden) return;
    const card = document.querySelector("#account-profile");
    // The first thing right of the card: the coins, the leaves or the gear.
    const pills = ["#account-coins", "#account-leaves", "#home-settings"]
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
    const spot = placeSwitch(
      innerWidth,
      cardBox.right,
      right,
      width,
      tightWidth,
    );
    nav.classList.toggle("is-tight", spot.tight);
    nav.style.setProperty("--hub-scenes-x", `${Math.round(spot.x)}px`);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(place);
  };
  addEventListener("resize", schedule);
  const sizes = new ResizeObserver(schedule);
  const watchAll = () => {
    for (const s of [
      "#account-nav",
      "#account-profile",
      "#account-coins",
      "#account-leaves",
      "#home-settings",
    ]) {
      const e = document.querySelector(s);
      if (e) sizes.observe(e);
    }
  };
  watchAll();
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
