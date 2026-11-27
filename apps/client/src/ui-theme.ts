/**
 * The game's look: which one this device shows, and switching it live
 * (owner, 26 Nov 2026: two looks, Poster and Showcase; a player picks one in
 * a dialog after creating an account and can change it in Settings).
 *
 * - The page carries `<html data-ui="poster">`. No attribute is the look
 *   the game has always had, which stays underneath every theme.
 * - A theme is a folder, `themes/<id>/`, whose `index.ts` exports its whole
 *   stylesheet as text (`css`), every selector under
 *   `:root[data-ui="<id>"]`. It is loaded only when chosen (its own chunk)
 *   and sits in one `<style id="ui-theme-css">`, swapped on a change: the
 *   other look's rules are never in the page, because all CSS counts in
 *   battle (CLAUDE.md, "Keeping battles smooth").
 * - The choice is kept on the device (`ea-ui`, like `ea-graphics`).
 *   `?ui=poster` overrides it for one page load, ready or not, for tests and
 *   screenshots; `?ui=classic` forces the look underneath.
 * - A theme is offered (the picker, Settings) only once it is `ready`, and
 *   the picker and the Settings row only appear while at least two are. A
 *   saved choice of a theme that is not ready is ignored. `?ui-preview=1`
 *   offers every theme for one page load (tests, a look at work in hand).
 * - Not an inline script in index.html: those are allowed by hash in the
 *   Content-Security-Policy and Render's headers.
 *
 * The dialog and the Settings row: ui-theme-picker.ts.
 */
import posterPreview from "./themes/poster/preview.webp";
import showcasePreview from "./themes/showcase/preview.webp";

export type UiThemeId = "poster" | "showcase";

export interface UiTheme {
  id: UiThemeId;
  name: string;
  /** One line under the name in the picker. */
  blurb: string;
  /** Finished and offered to players. The owner turns this on. */
  ready: boolean;
  /** A picture of the Lobby in this look (a URL). */
  preview: string;
  /** The theme's stylesheet, loaded when it is chosen. */
  load: () => Promise<{ css: string }>;
}

export const UI_THEMES: readonly UiTheme[] = [
  {
    id: "poster",
    name: "Poster",
    blurb: "Bold ink and your fighter's colour.",
    // On since 27 Nov 2026: the owner saw the full set from the real build.
    ready: true,
    preview: posterPreview,
    load: () => import("./themes/poster/index"),
  },
  {
    id: "showcase",
    name: "Showcase",
    blurb: "A dark stage with your fighter in the light.",
    // On since 27 Nov 2026, with Poster: the owner saw both sets.
    ready: true,
    preview: showcasePreview,
    load: () => import("./themes/showcase/index"),
  },
];

const KEY = "ea-ui";
const ASKED = (account: string) => `ea-ui-asked:${account}`;
/** Sent on `document` after the look has changed. */
export const UI_THEME_EVENT = "ea-ui-theme-change";
/** The fighter's element colour before a Lobby has set one (the game's gold). */
export const DEFAULT_ELEMENT_COLOUR = "#ffd65b";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Optional preference. */
  }
}

const themeById = (id: string | null | undefined) =>
  UI_THEMES.find((t) => t.id === id);

/** What the address asks for, for this page load. */
export interface UiQuery {
  /** `?ui=`: a theme, "classic" (the look underneath), or nothing. */
  ui: UiThemeId | "classic" | undefined;
  /** `?ui-preview=1`: offer every theme, ready or not. */
  preview: boolean;
}
export function readUiQuery(search: string): UiQuery {
  const q = new URLSearchParams(search);
  const ui = q.get("ui");
  const preview = q.get("ui-preview");
  return {
    ui: ui === "classic" ? "classic" : themeById(ui)?.id,
    preview: preview !== null && preview !== "0",
  };
}
let query: UiQuery | undefined;
function pageQuery() {
  query ??= readUiQuery(typeof location === "undefined" ? "" : location.search);
  return query;
}

/** The themes a player may choose between. */
export function offeredThemes(
  themes: readonly UiTheme[] = UI_THEMES,
  q: UiQuery = pageQuery(),
) {
  return themes.filter((t) => t.ready || q.preview);
}
/** There is a choice to make: the picker and Settings' Look row show. */
export function uiThemeChoice(
  themes: readonly UiTheme[] = UI_THEMES,
  q: UiQuery = pageQuery(),
) {
  return offeredThemes(themes, q).length >= 2;
}

/**
 * The look to show: the address's (ready or not), else the saved one if it
 * is offered, else none (the look underneath).
 */
export function resolveUiTheme(
  stored: string | null,
  q: UiQuery,
  themes: readonly UiTheme[] = UI_THEMES,
): UiThemeId | null {
  if (q.ui === "classic") return null;
  if (q.ui) return q.ui;
  return offeredThemes(themes, q).find((t) => t.id === stored)?.id ?? null;
}
export function getUiTheme(): UiThemeId | null {
  return resolveUiTheme(read(KEY), pageQuery());
}

/** The look on the page now (what applyUiTheme last finished). */
export function shownUiTheme(): UiThemeId | null {
  return typeof document === "undefined"
    ? null
    : (themeById(document.documentElement.dataset.ui)?.id ?? null);
}

let applying = 0;
/**
 * Put the chosen look on the page: its stylesheet first, then the
 * attribute, so no rule ever meets a half-loaded theme. Call it first thing
 * at startup. Answers false when the theme could not be loaded (offline):
 * the page keeps the look it has, and the next start tries again.
 */
export async function applyUiTheme(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const turn = ++applying;
  const id = getUiTheme();
  const root = document.documentElement;
  let css = "";
  if (id) {
    try {
      css = (await themeById(id)!.load()).css;
    } catch {
      return false;
    }
    // A later choice was made while this one loaded.
    if (turn !== applying) return false;
  }
  if ((root.dataset.ui ?? null) === id) return true;
  let sheet = document.getElementById("ui-theme-css");
  if (id) {
    if (!sheet) {
      sheet = document.createElement("style");
      sheet.id = "ui-theme-css";
      document.head.append(sheet);
    }
    sheet.textContent = css;
    root.dataset.ui = id;
  } else {
    delete root.dataset.ui;
    sheet?.remove();
  }
  document.dispatchEvent(new Event(UI_THEME_EVENT));
  return true;
}

/**
 * Choose a look (null: the look underneath) and show it at once, no reload.
 * A choice made here also ends the address's `?ui=` for this page.
 */
export function setUiTheme(id: UiThemeId | null): Promise<boolean> {
  write(KEY, id);
  const q = pageQuery();
  // The address no longer decides; an unfinished theme chosen through it (or
  // through ?ui-preview) stays offered until the page is left.
  query = {
    ui: undefined,
    preview: q.preview || (!!id && !themeById(id)!.ready),
  };
  return applyUiTheme();
}

/**
 * The picker is owed to this account: there is a choice, the address isn't
 * forcing a look, and this account hasn't been asked on this device.
 */
export function lookPickerDue(account: string | undefined) {
  return (
    !!account &&
    uiThemeChoice() &&
    !pageQuery().ui &&
    read(ASKED(account)) === null
  );
}
export function markLookAsked(account: string | undefined) {
  if (account) write(ASKED(account), "1");
}

let elementColour = "";
/**
 * `--el` on `:root`: the Lobby fighter's element colour, which both looks
 * draw with. The Lobby keeps it in step (lobby-screen.ts); written only
 * when it changes, since a custom property on the root restyles the page.
 */
export function setUiElementColour(colour: string) {
  if (typeof document === "undefined" || colour === elementColour) return;
  elementColour = colour;
  document.documentElement.style.setProperty("--el", colour);
}

/** Tests: forget what the address said and what was applied. */
export function resetUiThemeForTests(search?: string) {
  query = search === undefined ? undefined : readUiQuery(search);
  elementColour = "";
  applying = 0;
}
