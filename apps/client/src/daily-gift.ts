/**
 * The daily gift's dialog (rules: packages/shared/src/daily-gifts.ts). Seven
 * days in a row, today's lit; Claim takes it, and the dialog then shows what
 * it gave and what tomorrow's is, so the last thing a player sees before
 * they leave is a reason to come back.
 *
 * Markup and the dialog's own behaviour; main.ts decides when it shows and
 * talks to the server. No layout is read here.
 */
import {
  DAILY_GIFTS,
  DAILY_GIFT_DAYS,
  giftOn,
  type DailyGiftClaim,
  type DailyGiftState,
} from "../../../packages/shared/src/daily-gifts";
import { LOOK_ITEM_BY_ID } from "../../../packages/shared/src/shop";
import { actions, button, esc } from "./ui/components";
import { menuIcon } from "./menu-icons";
import { enter, fadeIn, leave } from "./ui/motion";
import "./daily-gift.css";

type Given = { coins: number; xp: number; item: string | null };
const itemName = (id: string) => LOOK_ITEM_BY_ID[id]?.name ?? "A cosmetic";
/** A gift in words: "75 coins", "150 XP", "Firefly aura". */
export function giftLabel(g: Given) {
  if (g.item) return itemName(g.item);
  if (g.xp) return `${g.xp} XP`;
  return `${g.coins} coins`;
}
/** The day after `day` in the calendar (7 is followed by 1). */
export const dayAfter = (day: number) => (day >= DAILY_GIFT_DAYS ? 1 : day + 1);
/**
 * Tomorrow's gift, if the row goes on: the day after today's, in the week
 * that day falls in (a first week's day 7 taken today makes tomorrow day 1
 * of the second).
 */
export function tomorrowGift(s: DailyGiftState) {
  const day = dayAfter(s.day);
  return { day, ...giftOn(day, s) };
}

/** One day's tile: its number, a picture of what it gives, and how much. */
function dayTile(day: number, s: DailyGiftState, given?: Given) {
  // Today's tile, just taken, shows what it gave (the first week's aura,
  // which the calendar after it would show as next week's coins).
  const g = given && day === s.day ? given : giftOn(day, s);
  const taken = day < s.day || (day === s.day && s.claimed);
  const today = day === s.day;
  const picture = g.item ? "sparkle" : g.xp ? "star" : "coin";
  const amount = g.item ? "Aura" : g.xp ? `${g.xp} XP` : String(g.coins);
  return `<li class="gift-day${taken ? " is-taken" : ""}${today ? " is-today" : ""}${g.item ? " is-item" : ""}" aria-label="Day ${day}: ${esc(giftLabel(g))}${taken ? ", taken" : today ? ", today" : ""}"${today ? ' aria-current="date"' : ""}><small>Day ${day}</small><span class="gift-day-art" aria-hidden="true">${menuIcon(taken ? "check" : picture)}</span><b>${esc(amount)}</b></li>`;
}

/** The dialog for a calendar: waiting to be claimed, or already taken today. */
export function giftMarkup(s: DailyGiftState, given?: Given) {
  const today = giftOn(s.day, s);
  const next = tomorrowGift(s);
  const last = DAILY_GIFTS[DAILY_GIFT_DAYS - 1];
  const week = giftOn(DAILY_GIFT_DAYS, s);
  const title = s.claimed
    ? given
      ? `Day ${s.day}: +${giftLabel(given)}`
      : "Today's gift is yours"
    : `Today's gift: ${giftLabel(today)}`;
  const sub = s.claimed
    ? `Tomorrow: ${giftLabel(next)}`
    : `Come back every day. Day ${DAILY_GIFT_DAYS}: ${week.item ? `the ${itemName(week.item)}` : `${last.coins} coins`}.`;
  const days = Array.from({ length: DAILY_GIFT_DAYS }, (_, i) =>
    dayTile(i + 1, s, given),
  ).join("");
  const buttons = s.claimed
    ? actions(
        button("Got it", {
          kind: "primary",
          attrs: { "data-gift-close": true },
        }),
      )
    : actions(
        button("Later", { attrs: { "data-gift-close": true } }),
        button("Claim", {
          kind: "primary",
          icon: "check",
          attrs: { "data-gift-claim": true },
        }),
      );
  return `<div class="ui-modal gift-modal${s.claimed ? " is-claimed" : ""}" role="dialog" aria-modal="true" aria-label="Daily gift"><div class="ui-modal-body"><span class="ui-kicker">Daily gift · Day ${s.day} of ${DAILY_GIFT_DAYS}</span><b class="ui-title">${esc(title)}</b><span class="ui-modal-sub gift-sub">${esc(sub)}</span><ol class="gift-days">${days}</ol><small class="gift-rule">Miss a day and your row still goes on. Miss two and it starts again.</small></div>${buttons}</div>`;
}

export interface GiftDialogOptions {
  state: DailyGiftState;
  /** Take today's gift: the calendar after it, or a message when refused. */
  claim(): Promise<DailyGiftClaim | string>;
  /** Closed (by Later, Got it, Escape or a tap outside). */
  onClose(state: DailyGiftState): void;
}
export interface GiftDialog {
  readonly open: boolean;
  close(): void;
}
/** Show the calendar over the hub. One at a time. */
export function openGiftDialog(o: GiftDialogOptions): GiftDialog {
  let state = o.state;
  let open = true;
  let busy = false;
  const returnFocus = document.activeElement as HTMLElement | null;
  const scrim = document.createElement("div");
  // data-ui-confirm: the hub treats it as a dialog in front (the tour and
  // the Unlocked dialog wait for it).
  scrim.className = "ui-scrim gift-scrim";
  scrim.setAttribute("data-ui-confirm", "");
  scrim.setAttribute("data-gift", "");
  const draw = (given?: Given, note = "") => {
    scrim.innerHTML = giftMarkup(state, given);
    if (note)
      scrim
        .querySelector(".gift-rule")!
        .insertAdjacentHTML(
          "beforebegin",
          `<p class="gift-problem" role="alert">${esc(note)}</p>`,
        );
    // The main button: Claim while it waits, Got it once taken.
    (
      scrim.querySelector<HTMLElement>("[data-gift-claim]") ??
      scrim.querySelector<HTMLElement>("[data-gift-close]")
    )?.focus({ preventScroll: true });
  };
  const close = () => {
    if (!open) return;
    open = false;
    document.removeEventListener("keydown", onKey, true);
    scrim.removeAttribute("data-ui-confirm");
    scrim.style.pointerEvents = "none";
    const modal = scrim.querySelector(".ui-modal");
    void Promise.all([
      leave(scrim, { opacity: 0 }),
      modal &&
        leave(modal, { opacity: 0, transform: "translateY(10px) scale(.97)" }),
    ]).then(() => scrim.remove());
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    o.onClose(state);
  };
  const claim = async () => {
    if (busy || state.claimed) return;
    busy = true;
    scrim
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => (b.disabled = true));
    const result = await o
      .claim()
      .catch(() => "Couldn't reach the server. Try again.");
    busy = false;
    if (!open) return;
    if (typeof result === "string") return draw(undefined, result);
    state = result;
    draw(result.given);
    scrim.querySelector(".gift-day.is-today")?.classList.add("is-fresh");
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  scrim.addEventListener("click", (event) => {
    const t = event.target as Element;
    if (t.closest("[data-gift-claim]")) void claim();
    else if (t === scrim || t.closest("[data-gift-close]")) close();
  });
  document.addEventListener("keydown", onKey, true);
  document.body.append(scrim);
  draw();
  fadeIn([scrim]);
  const modal = scrim.querySelector(".ui-modal");
  if (modal)
    enter(modal, { opacity: 0, transform: "translateY(14px) scale(.95)" });
  return {
    get open() {
      return open;
    },
    close,
  };
}
