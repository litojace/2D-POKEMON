/**
 * Choosing the game's look (ui-theme.ts): the dialog a player meets once,
 * and Settings → Display → Look.
 *
 * The dialog shows each look's Lobby with its name; one tap chooses and
 * goes on. There is nothing else to press: it asks one thing, and Settings
 * changes the answer at any time. Both appear only while at least two looks
 * are ready (uiThemeChoice).
 */
import {
  getUiTheme,
  markLookAsked,
  offeredThemes,
  setUiTheme,
  uiThemeChoice,
  type UiTheme,
  type UiThemeId,
} from "./ui-theme";
import "./ui-theme-picker.css";

const card = (t: UiTheme, current: UiThemeId | null) =>
  `<button type="button" class="look-card" data-look="${t.id}" aria-pressed="${t.id === current}"><img src="${t.preview}" alt="" width="560" height="259" decoding="async"><span class="look-card-text"><b>${t.name}</b><small>${t.blurb}</small></span></button>`;

export function lookPickerMarkup(
  themes: readonly UiTheme[] = offeredThemes(),
  current: UiThemeId | null = getUiTheme(),
) {
  return `<div class="ui-scrim look-scrim" data-look-picker><div class="ui-modal look-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="look-title"><div class="ui-modal-body"><span class="ui-kicker">Your look</span><b class="ui-title" id="look-title">Pick a look</b><span class="look-sub">Tap one. You can change it any time in Settings.</span><div class="look-cards">${themes.map((t) => card(t, current)).join("")}</div></div></div></div>`;
}

/**
 * Ask this account for its look, once. Resolves with the choice, after it
 * is on the page (or kept for the next start, if it could not be loaded).
 */
export function askLook(account: string): Promise<UiThemeId> {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = lookPickerMarkup();
    const scrim = wrap.firstElementChild as HTMLElement;
    const cards = Array.from(
      scrim.querySelectorAll<HTMLButtonElement>("[data-look]"),
    );
    const onKey = (event: KeyboardEvent) => {
      // One question with no way round it: Escape stays inside, Tab and the
      // arrows move between the looks.
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const step =
        event.key === "Tab"
          ? event.shiftKey
            ? -1
            : 1
          : event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
      if (!step) return;
      event.preventDefault();
      event.stopPropagation();
      const i = cards.indexOf(document.activeElement as HTMLButtonElement);
      cards[(i + step + cards.length) % cards.length]?.focus();
    };
    let chosen = false;
    for (const button of cards)
      button.onclick = () => {
        if (chosen) return;
        chosen = true;
        const id = button.dataset.look as UiThemeId;
        markLookAsked(account);
        document.removeEventListener("keydown", onKey, true);
        scrim.remove();
        void setUiTheme(id).then(() => resolve(id));
      };
    document.addEventListener("keydown", onKey, true);
    document.body.append(scrim);
    // Neither look starts out marked: focus waits on the dialog itself.
    scrim
      .querySelector<HTMLElement>(".look-modal")
      ?.focus({ preventScroll: true });
  });
}

/** Settings → Display → Look: the looks on offer, switched live. */
export function lookRow() {
  if (!uiThemeChoice()) return "";
  const current = getUiTheme();
  const options = offeredThemes()
    .map(
      (t) =>
        `<button type="button" role="radio" data-look-set="${t.id}" aria-checked="${t.id === current}">${t.name}</button>`,
    )
    .join("");
  return `<div class="st-row st-graphics st-look"><span class="st-row-text"><b id="prefs-look">Look</b><small>How the menus and the battle screen are drawn.</small></span><div class="prefs-choice" role="radiogroup" aria-labelledby="prefs-look">${options}</div></div>`;
}
export function bindLookRow(root: ParentNode = document) {
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-look-set]"),
  );
  for (const b of buttons)
    b.onclick = () => {
      for (const other of buttons)
        other.setAttribute("aria-checked", String(other === b));
      void setUiTheme(b.dataset.lookSet as UiThemeId);
    };
}
