/**
 * Settings → App icon, in the iPhone app only: the player picks the Home
 * Screen icon from the default and the alternates (ios/App/App/AppIcon.swift
 * switches it; iOS shows its own confirmation).
 *
 * The card starts hidden and appears once the app says it can change icons,
 * with the icon in use ticked.
 */
import { menuIcon } from "./menu-icons";
import { appIconState, setAppIcon } from "./native";

export interface AppIconChoice {
  /** The asset catalog's icon set; null for the default icon. */
  set: string | null;
  label: string;
}
/**
 * The default icon and the alternates: the same sets as ALTERNATES in
 * scripts/generate-icons.mjs, which renders their images and the
 * thumbnails in public/icons/app-icons, and as the Xcode build setting
 * ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES
 * (tests/unit/app-icons.test.ts checks they all agree).
 */
export const APP_ICONS: readonly AppIconChoice[] = [
  { set: null, label: "Clash" },
  { set: "AppIcon-Pyranda", label: "Pyranda" },
  { set: "AppIcon-SplitFace", label: "Split face" },
  { set: "AppIcon-StareDown", label: "Stare-down" },
];

export const appIconThumbnail = (set: string | null) =>
  `/icons/app-icons/${set ?? "AppIcon"}.png`;

/** The card, hidden until bindAppIconCard finds that icons can change. */
export function appIconCardHTML(current: string | null = null) {
  const choice = ({ set, label }: AppIconChoice) =>
    `<button type="button" role="radio" data-app-icon="${set ?? ""}" aria-checked="${set === current}" aria-label="${label}"><img src="${appIconThumbnail(set)}" alt="" width="56" height="56"><span>${label}</span></button>`;
  return `<section class="prefs-card prefs-app-icon" id="prefs-app-icon-card" aria-labelledby="prefs-app-icon" hidden><h3 id="prefs-app-icon">${menuIcon("home")}App icon</h3><div class="prefs-app-icons" role="radiogroup" aria-labelledby="prefs-app-icon">${APP_ICONS.map(choice).join("")}</div></section>`;
}

function tick(card: HTMLElement, current: string | null) {
  for (const b of Array.from(
    card.querySelectorAll<HTMLButtonElement>("[data-app-icon]"),
  ))
    b.setAttribute(
      "aria-checked",
      String((b.dataset.appIcon || null) === current),
    );
}

/**
 * Shows the card (if the app can change icons) and makes its choices work.
 * `toast` reports a failed change.
 */
export async function bindAppIconCard(toast: (message: string) => void) {
  const card = document.getElementById("prefs-app-icon-card");
  if (!card) return;
  const state = await appIconState();
  // Settings may have closed or redrawn while the app answered.
  if (!state || !card.isConnected) return;
  let current = state.name;
  tick(card, current);
  card.hidden = false;
  for (const b of Array.from(
    card.querySelectorAll<HTMLButtonElement>("[data-app-icon]"),
  ))
    b.onclick = async () => {
      const wanted = b.dataset.appIcon || null;
      if (wanted === current) return;
      tick(card, wanted);
      try {
        await setAppIcon(wanted);
        current = wanted;
      } catch (error) {
        tick(card, current);
        const reason = ((error as Error).message || "try again").replace(
          /\.$/,
          "",
        );
        toast(`The app icon didn't change: ${reason}.`);
      }
    };
}
