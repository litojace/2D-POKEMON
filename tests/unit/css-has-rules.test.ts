import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * `.a:has(...) > *` (or `.a:has(...) *`): a `:has()` in the middle of a
 * selector that then matches every child. Chrome rechecks such a rule on
 * every style change anywhere in the page, battles included, even when the
 * screen it styles is closed. One of them (`.pf-main:has(> .pf-account) > *`,
 * the Profile screen) cost about 40% of all style recalculation in a duel
 * (25 Nov 2026; a Pixel 8a spent 22 ms a frame). Use a class set by the
 * screen's markup instead (profile-view.ts `has-account`).
 */
function hasThenAny(selector: string) {
  const at = selector.lastIndexOf(":has(");
  if (at < 0) return false;
  let depth = 0,
    end = at + 4;
  for (; end < selector.length; end++) {
    if (selector[end] === "(") depth++;
    else if (selector[end] === ")" && --depth === 0) break;
  }
  return (
    /^\s*[>~+]?\s*\*\s*$/.test(selector.slice(end + 1)) &&
    /\S/.test(selector.slice(end + 1))
  );
}

/**
 * `body:has(...)`, `html:has(...)`, `:root:has(...)`, `dialog:has(...)`
 * (also inside `:is()`/`:not()` on them): a `:has()` whose subject is the
 * whole page, or a dialog that holds a whole screen. Chrome rechecks it
 * whenever anything inside changes, so every HUD write in a battle pays for
 * it (CLAUDE.md, "CSS anywhere in the client counts in battle"). Use a class
 * or data attribute the owning code sets when the state changes instead.
 */
function wholePageHas(selector: string) {
  for (
    let at = selector.indexOf(":has(");
    at >= 0;
    at = selector.indexOf(":has(", at + 1)
  ) {
    // Back to the start of the compound this :has() belongs to, stepping
    // out of an :is()/:not()/:where() around it.
    let depth = 0,
      i = at - 1;
    for (; i >= 0; i--) {
      const c = selector[i];
      if (c === ")" || c === "]") depth++;
      else if (c === "(" || c === "[") {
        if (depth > 0) depth--;
      } else if (depth === 0 && /[\s>~+]/.test(c)) break;
    }
    const compound = selector.slice(i + 1, at);
    if (/^(?:html|body|dialog)(?![\w-])|^:root(?![\w-])/.test(compound))
      return true;
  }
  return false;
}

/**
 * Every rule's selector list (at-rule preludes such as @media are skipped,
 * their rules are not), with strings and comments left out of the way.
 */
function selectorLists(css: string) {
  const out: string[] = [];
  let buf = "",
    quote = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      buf += c;
      if (c === "\\") buf += css[++i] ?? "";
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") {
      quote = c;
      buf += c;
    } else if (c === "{") {
      const prelude = buf.trim();
      if (prelude && !prelude.startsWith("@")) out.push(prelude);
      buf = "";
    } else if (c === "}" || c === ";") buf = "";
    else buf += c;
  }
  return out;
}

/** A selector list split at its top-level commas only. */
function splitTop(list: string) {
  const out: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

function clientSelectors() {
  const files = execSync(
    "git ls-files 'apps/client/src/*.css' 'apps/client/src/**/*.css'",
  )
    .toString()
    .trim()
    .split("\n");
  const out: string[] = [];
  for (const file of files) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const list of selectorLists(css))
      for (const sel of splitTop(list))
        out.push(`${file}  ${sel.replace(/\s+/g, " ")}`);
  }
  return out;
}

/**
 * The page-wide :has() rules already in the client (26 Nov 2026). They stay
 * until their screen is reworked; this list may only get shorter: replace
 * one with a class its owning code sets, then remove it here. A new one
 * fails the test. (Removing them all measured no faster in a duel once the
 * HUD stopped re-creating text nodes: docs/performance-sweep-2026-11-25.md,
 * section 2, item 2. The cost is per change of what they watch, so new ones
 * are kept out.)
 */
const KNOWN_PAGE_HAS = [
  "apps/client/src/loading-preview.css  html:has(.lp-refs)",
  "apps/client/src/loading-preview.css  body:has(.lp-refs)",
  "apps/client/src/match-sheet.css  :root body.battle-active:has(#arena-overlay.is-sheet:not(:empty)) :is(#chat-button, #battle-chat)",
  'apps/client/src/match-sheet.css  :root body.battle-active:has(#arena-overlay.is-sheet:not(:empty)) :is(#chat-button, #battle-chat):is( :hover, :focus-visible, [aria-expanded="true"] )',
  "apps/client/src/match-sheet.css  :root body.battle-active:has(#arena-overlay.is-sheet:not(:empty)) #chat-button .chat-unread",
  "apps/client/src/match-sheet.css  body.battle-active:has(#arena-overlay:is(.is-sheet, .is-rites):not(:empty)) :is(#chat-button, #battle-chat, #battle-chat-grid, #battle-chat-feed)",
  "apps/client/src/screens/raid-rites.css  body:has(.battle-chat:not([hidden])) #arena-overlay#arena-overlay.is-rites .rites-screen",
  "apps/client/src/screens/room.css  body:has(#menu > .room-screen)",
  "apps/client/src/screens/room.css  body:has(#menu > .room-screen) .topbar",
  'apps/client/src/screens/room.css  body:has(#menu > .room-screen) .chat-button[data-place="room"]',
  'apps/client/src/screens/room.css  :root body:has(#menu > .room-screen) .chat-button[data-place="room"]',
  'apps/client/src/screens/room.css  :root body:has(#menu > .room-screen) .chat-button[data-place="room"]:is( :hover, :focus-visible, [aria-expanded="true"] )',
  'apps/client/src/screens/room.css  :root body:has(#menu > .room-screen) .chat-button[data-place="room"] .chat-unread',
  "apps/client/src/screens/room.css  body:has(#menu > .room-screen)",
  "apps/client/src/spire-battle.css  body:has(.battle-chat:not([hidden]), #chat-button:not([hidden])) #arena-overlay .rc-card:has(.spire-briefing, .spire-summary)",
  "apps/client/src/style.css  html:has(body.battle-active:not(.touch-mode))",
  "apps/client/src/style.css  html:has(body.hub-active)",
  "apps/client/src/style.css  dialog:has(.bindings)",
  "apps/client/src/style.css  dialog:has(.illustrated-guide)",
  "apps/client/src/style.css  html:has(body.battle-active)::before",
  "apps/client/src/style.css  dialog:has(.settings-screen)",
  "apps/client/src/style.css  dialog:has(.bindings)",
  "apps/client/src/style.css  dialog:has(.controls-layout, .help-screen, #controls-reset, .admin-tabs)",
  "apps/client/src/style.css  dialog:has( .settings-screen, #auth-form, #report-form, .credits-screen, .skills-screen, .fp-screen, .fullscreen-steps, .fullscreen-actions )",
  "apps/client/src/style.css  dialog:is(:has(.admin-tabs), :has(#admin-message))",
  "apps/client/src/style.css  html:has(body.home-active)::before",
  "apps/client/src/ui/aero.css  html:has(body.lobby-active)",
  "apps/client/src/ui/aero.css  html:has(body.lobby-active)::before",
  'apps/client/src/ui/components.css  body[data-hub-scene="lobby"]:has(.ui-panel) #toast',
  "apps/client/src/ui/components.css  body.lobby-active:has(.room-screen .ui-panel) #toast",
  'apps/client/src/ui/components.css  body[data-hub-scene="lobby"]:has(.ui-panel) #toast',
  "apps/client/src/ui/components.css  body.lobby-active:has(.room-screen .ui-panel) #toast",
];

/** Entries of `a` not matched one-for-one by an entry of `b`. */
function minus(a: string[], b: string[]) {
  const left = [...b];
  return a.filter((x) => {
    const i = left.indexOf(x);
    if (i < 0) return true;
    left.splice(i, 1);
    return false;
  });
}

describe("CSS :has() rules", () => {
  const selectors = clientSelectors();

  it("never match every child after a :has() (slow style recalculation on Chrome)", () => {
    const bad = selectors.filter((s) => hasThenAny(s.split("  ")[1]));
    expect(bad).toEqual([]);
  });

  it("add no :has() on body, html, :root or a dialog (use a class the owning code sets)", () => {
    const found = selectors.filter((s) => wholePageHas(s.split("  ")[1]));
    expect(
      minus(found, KNOWN_PAGE_HAS),
      "new page-wide :has(): set a class or data attribute where the state changes and style that instead",
    ).toEqual([]);
    expect(
      minus(KNOWN_PAGE_HAS, found),
      "gone from the CSS: remove it from KNOWN_PAGE_HAS",
    ).toEqual([]);
  });

  it("catches the patterns", () => {
    expect(hasThenAny(".pf-main:has(> .pf-account) > *")).toBe(true);
    expect(hasThenAny(".a:has(.b) *")).toBe(true);
    expect(hasThenAny(".pf-main.has-account > *")).toBe(false);
    expect(hasThenAny(".a:has(.b) .c")).toBe(false);
    expect(hasThenAny(".a:has(> .b)")).toBe(false);

    expect(wholePageHas("body:has(.x)")).toBe(true);
    expect(wholePageHas("body.battle-active:has(#o:not(:empty)) .c")).toBe(
      true,
    );
    expect(wholePageHas(':root body[data-a="b"]:has(.x) .y')).toBe(true);
    expect(wholePageHas("html:has(body.hub-active)::before")).toBe(true);
    expect(wholePageHas(":root:has(.x)")).toBe(true);
    expect(wholePageHas("dialog:has(.bindings)")).toBe(true);
    expect(wholePageHas("dialog:is(:has(.a), :has(#b))")).toBe(true);
    expect(wholePageHas("dialog:not(:has(.a)) .b")).toBe(true);
    expect(wholePageHas("body .panel:has(.x)")).toBe(false);
    expect(wholePageHas("body.battle-active .panel:has(> .x)")).toBe(false);
    expect(wholePageHas(".dialog:has(.x)")).toBe(false);
    expect(wholePageHas("bodyguard:has(.x)")).toBe(false);
    expect(wholePageHas("dialog.is-sheet .card")).toBe(false);

    expect(selectorLists("@media (x) { a:has(b) > * { c: d } }")).toEqual([
      "a:has(b) > *",
    ]);
    expect(selectorLists('a { b: url("x{;}") } c { d: e }')).toEqual([
      "a",
      "c",
    ]);
    expect(splitTop("dialog:is(:has(.a), :has(.b)), body")).toEqual([
      "dialog:is(:has(.a), :has(.b))",
      "body",
    ]);
  });
});
