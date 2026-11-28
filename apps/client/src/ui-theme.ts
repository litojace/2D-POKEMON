/**
 * The game's look: Poster, for every player (owner, 27 Nov 2026: "drop
 * Showcase, switch permanently to Poster"; Showcase, the picker and
 * Settings' Look row are gone from the code). docs/ui-themes.md.
 *
 * - The page carries `<html data-ui="poster">`. No attribute is the look
 *   the game had before, which stays underneath Poster until the visual
 *   tests have moved to Poster (ask the owner before removing it).
 * - A look is a folder, `themes/<id>/`, whose `index.ts` exports its whole
 *   stylesheet as text (`css`), every selector under `:root[data-ui="<id>"]`.
 *   Poster ships in the game's own script, so it is on the page before the
 *   first frame, in one `<style id="ui-theme-css">`.
 * - `ea-ui` on the device can say "classic": the look underneath. Players
 *   have no way to set it; the visual tests do, to keep the look their specs
 *   were written against (tests/visual/harness/look-asked.ts).
 * - `?ui=poster` or `?ui=classic` decides for one page load (tests,
 *   screenshots).
 * - Not an inline script in index.html: those are allowed by hash in the
 *   Content-Security-Policy and Render's headers.
 */
import { css as posterCss } from "./themes/poster/index";

export type UiThemeId = "poster";

export interface UiTheme {
  id: UiThemeId;
  name: string;
  /** The theme's stylesheet, as text. */
  load: () => Promise<{ css: string }>;
  /** The stylesheet itself, for a look that ships with the game's own
   *  script: it is on the page before the first frame, with no wait. */
  css?: string;
  /**
   * The look's chrome has colours of its own (Poster: cream, ink, gold and
   * red; owner, 27 Nov 2026), so the Lobby fighter's element colour is not
   * written on the root for it: it goes only to the few places that still
   * show it (FIGHTER_COLOUR_HOSTS).
   */
  fixedChrome?: boolean;
}

/**
 * The look every player gets. `null` here is the revert: every player back
 * on the look underneath.
 */
export const DEFAULT_UI_THEME: UiThemeId | null = "poster";

export const UI_THEMES: readonly UiTheme[] = [
  {
    id: "poster",
    name: "Poster",
    css: posterCss,
    load: async () => ({ css: posterCss }),
    fixedChrome: true,
  },
];

const KEY = "ea-ui";
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

const themeById = (id: string | null | undefined) =>
  UI_THEMES.find((t) => t.id === id);

/** What the address asks for, for this page load. */
export interface UiQuery {
  /** `?ui=`: a theme, "classic" (the look underneath), or nothing. */
  ui: UiThemeId | "classic" | undefined;
}
export function readUiQuery(search: string): UiQuery {
  const ui = new URLSearchParams(search).get("ui");
  return { ui: ui === "classic" ? "classic" : themeById(ui)?.id };
}
let query: UiQuery | undefined;
function pageQuery() {
  query ??= readUiQuery(typeof location === "undefined" ? "" : location.search);
  return query;
}

/**
 * The look to show: the address's, else "classic" if this device saved it
 * (the visual tests' pin), else the default look. A saved look that is
 * gone (a tester's "showcase") gets the default.
 */
export function resolveUiTheme(
  stored: string | null,
  q: UiQuery,
  themes: readonly UiTheme[] = UI_THEMES,
  fallback: UiThemeId | null = DEFAULT_UI_THEME,
): UiThemeId | null {
  if (q.ui === "classic") return null;
  if (q.ui) return q.ui;
  if (stored === "classic") return null;
  return (
    themes.find((t) => t.id === stored)?.id ??
    themes.find((t) => t.id === fallback)?.id ??
    null
  );
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
 * Put the look on the page: its stylesheet first, then the attribute, so
 * no rule ever meets a half-loaded theme. Call it first thing at startup.
 * Answers false when the theme could not be loaded: the page keeps the
 * look it has, and the next start tries again.
 */
export async function applyUiTheme(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const turn = ++applying;
  const id = getUiTheme();
  const root = document.documentElement;
  let css = "";
  const theme = themeById(id);
  if (theme?.css !== undefined)
    // Already here: applied before this function first gives way, so a
    // call at startup puts the look on the page before anything is drawn.
    css = theme.css;
  else if (theme) {
    try {
      css = (await theme.load()).css;
    } catch {
      return false;
    }
    // A later call was made while this one loaded.
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
  // The fighter's colour goes where this look reads it.
  paintElementColour();
  document.dispatchEvent(new Event(UI_THEME_EVENT));
  return true;
}

let elementColour = "";
/**
 * Where a look with a fixed chrome still shows the Lobby fighter's element
 * colour, as `--fighter`: the Lobby (its field, the name plate, the seats),
 * the raid room's backdrop and the battle's sheets (a win is the fighter's
 * colour). A rule in a style sheet of its own rather than a property on the
 * root: changing a custom property on the root restyles every element on
 * the page (about 59 ms on a throttled phone at each fighter switch, 27 Nov
 * 2026), while a rule's change reaches only what its selector names, and
 * what is made later still gets it.
 */
export const FIGHTER_COLOUR_HOSTS =
  ".lobby-layer, .room-screen, #arena-overlay";
const FIGHTER_SHEET = "ui-fighter-colour";
function paintElementColour() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  let sheet = document.getElementById(FIGHTER_SHEET);
  if (!themeById(root.dataset.ui)?.fixedChrome) {
    sheet?.remove();
    // The look underneath draws with `--el` on the root, on every screen.
    if (elementColour) root.style.setProperty("--el", elementColour);
    return;
  }
  root.style.removeProperty("--el");
  if (!elementColour) return;
  if (!sheet) {
    sheet = document.createElement("style");
    sheet.id = FIGHTER_SHEET;
    document.head.append(sheet);
  }
  const rule = `${FIGHTER_COLOUR_HOSTS}{--fighter:${elementColour}}`;
  if (sheet.textContent !== rule) sheet.textContent = rule;
}
/**
 * The Lobby fighter's element colour (a `#rrggbb`). The Lobby keeps it in
 * step (lobby-screen.ts). The look underneath draws its accents with it
 * (`--el` on the root); Poster shows it only on the fighter's own things
 * (`--fighter`, above). Written only when it changes.
 */
export function setUiElementColour(colour: string) {
  if (typeof document === "undefined" || colour === elementColour) return;
  // It is written into a style sheet: a colour and nothing else.
  if (!/^#[0-9a-f]{3,8}$/i.test(colour)) return;
  elementColour = colour;
  paintElementColour();
}

/** Tests: forget what the address said and what was applied. */
export function resetUiThemeForTests(search?: string) {
  query = search === undefined ? undefined : readUiQuery(search);
  elementColour = "";
  applying = 0;
}
