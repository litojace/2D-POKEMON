/**
 * The warning a new guest gets once, when their guest pass is made
 * (accounts.ts, warnNewGuest): what works, what it costs (the pass lives on
 * this device only and can't be recovered), and how to keep it (an email on
 * the player card). Three plain rows, each with its sign; the shared
 * confirm modal (ui/components.ts) frames them.
 */
import type { ConfirmOptions } from "./ui/components";
import { menuIcon } from "./menu-icons";
import "./guest-warning.css";

export const GUEST_WARNING_ROWS = [
  {
    tone: "ok",
    icon: "check",
    title: "Everything works",
    text: "Matches, raids, friends, the shop: play it all right away.",
  },
  {
    tone: "danger",
    icon: "lock",
    title: "Saved on this device only",
    text: "Log out, delete the app or its data, or change devices and it's gone for good. Nobody can bring it back, not even us.",
  },
  {
    tone: "accent",
    icon: "save",
    title: "Keep it with an email",
    text: "Add one on your player card any time. Your records, matches, coins, titles and friends come with you.",
  },
] as const;

export function guestWarning(): ConfirmOptions {
  const rows = GUEST_WARNING_ROWS.map(
    (r) =>
      `<li class="gw-row is-${r.tone}"><span class="gw-sign" aria-hidden="true">${menuIcon(r.icon)}</span><span class="gw-text"><b>${r.title}</b><small>${r.text}</small></span></li>`,
  ).join("");
  return {
    kicker: "Guest pass",
    title: "You're playing as a guest",
    lines: [],
    extra: `<ul class="gw-rows" data-guest-warning>${rows}</ul>`,
    cancel: "Got it",
    cancelIcon: "check",
    confirm: "Save account",
    confirmIcon: "save",
  };
}
