import { afterEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import {
  DEFAULT_UI_THEME,
  UI_THEMES,
  getUiTheme,
  lookPickerDue,
  markLookAsked,
  offeredThemes,
  readUiQuery,
  resetUiThemeForTests,
  resolveUiTheme,
  setUiTheme,
  uiThemeChoice,
  type UiTheme,
} from "../../apps/client/src/ui-theme";
import {
  lookPickerMarkup,
  lookRow,
} from "../../apps/client/src/ui-theme-picker";

// The game's looks (ui-theme.ts): which one a device shows, when a player
// is offered the choice, and the rules each theme's folder keeps. The picker
// and Settings in the page: tests/visual/ui-theme.spec.ts.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
afterEach(() => {
  store.clear();
  resetUiThemeForTests();
});

const theme = (id: UiTheme["id"], ready: boolean): UiTheme => ({
  id,
  name: id,
  blurb: "",
  ready,
  preview: "",
  load: async () => ({ css: "" }),
});
const NONE = [theme("poster", false), theme("showcase", false)];
const ONE = [theme("poster", true), theme("showcase", false)];
const BOTH = [theme("poster", true), theme("showcase", true)];
const plain = readUiQuery("");

describe("the address", () => {
  it("reads ?ui= and ?ui-preview", () => {
    expect(readUiQuery("?ui=poster")).toEqual({ ui: "poster", preview: false });
    expect(readUiQuery("?ui=classic").ui).toBe("classic");
    expect(readUiQuery("?ui=nonsense").ui).toBeUndefined();
    expect(readUiQuery("?ui-preview=1").preview).toBe(true);
    expect(readUiQuery("?ui-preview=0").preview).toBe(false);
    expect(readUiQuery("?x=1")).toEqual({ ui: undefined, preview: false });
  });
});

describe("which look shows", () => {
  it("is the look underneath when nothing is chosen and there is no default", () => {
    expect(resolveUiTheme(null, plain, BOTH, null)).toBeNull();
  });
  it("is the default look when nothing is chosen, once that look is ready", () => {
    expect(resolveUiTheme(null, plain, ONE, "poster")).toBe("poster");
    expect(resolveUiTheme(null, plain, NONE, "poster")).toBeNull();
    // A saved look that isn't ready falls to the default, not to nothing.
    expect(resolveUiTheme("showcase", plain, ONE, "poster")).toBe("poster");
  });
  it('a saved "classic" keeps the look underneath (the visual tests pin it)', () => {
    expect(resolveUiTheme("classic", plain, ONE, "poster")).toBeNull();
    expect(
      resolveUiTheme("classic", readUiQuery("?ui=poster"), ONE, "poster"),
    ).toBe("poster");
  });
  it("is the saved one once it is ready", () => {
    expect(resolveUiTheme("showcase", plain, BOTH)).toBe("showcase");
  });
  it("ignores a saved look that is not ready, or not a look", () => {
    expect(resolveUiTheme("showcase", plain, ONE, null)).toBeNull();
    expect(resolveUiTheme("old-name", plain, BOTH, null)).toBeNull();
  });
  it("the address wins for a page load, ready or not", () => {
    expect(resolveUiTheme("showcase", readUiQuery("?ui=poster"), NONE)).toBe(
      "poster",
    );
    expect(resolveUiTheme("showcase", readUiQuery("?ui=classic"), BOTH)).toBe(
      null,
    );
  });
  it("?ui-preview offers unfinished looks", () => {
    expect(resolveUiTheme("showcase", readUiQuery("?ui-preview=1"), NONE)).toBe(
      "showcase",
    );
  });
});

describe("when a player is offered the choice", () => {
  it("only while two looks are ready", () => {
    expect(uiThemeChoice(NONE, plain)).toBe(false);
    expect(uiThemeChoice(ONE, plain)).toBe(false);
    expect(uiThemeChoice(BOTH, plain)).toBe(true);
    expect(uiThemeChoice(NONE, readUiQuery("?ui-preview=1"))).toBe(true);
    expect(offeredThemes(ONE, plain).map((t) => t.id)).toEqual(["poster"]);
  });
  it("the picker is owed once per account, and never while the address forces a look", () => {
    resetUiThemeForTests("?ui-preview=1");
    expect(lookPickerDue(undefined)).toBe(false);
    expect(lookPickerDue("a")).toBe(true);
    markLookAsked("a");
    expect(lookPickerDue("a")).toBe(false);
    expect(lookPickerDue("b")).toBe(true);
    resetUiThemeForTests("?ui-preview=1&ui=poster");
    expect(lookPickerDue("b")).toBe(false);
  });
});

describe("the looks as shipped", () => {
  // The owner turns a look on after seeing the whole set of screenshots.
  // Turning one on: change this list in the same pull request.
  const READY: string[] = ["poster"];
  it("are ready only when the owner has said so", () => {
    expect(UI_THEMES.filter((t) => t.ready).map((t) => t.id)).toEqual(READY);
  });
  it("every player gets Poster, with nothing saved and nothing in the address", () => {
    resetUiThemeForTests("");
    expect(DEFAULT_UI_THEME).toBe("poster");
    expect(getUiTheme()).toBe("poster");
    // It ships in the game's own script: no chunk to wait for at startup.
    expect(typeof UI_THEMES.find((t) => t.id === "poster")!.css).toBe("string");
    store.set("ea-ui", "showcase");
    expect(getUiTheme()).toBe("poster");
    store.set("ea-ui", "classic");
    expect(getUiTheme()).toBeNull();
  });
  it("show nothing to choose while fewer than two are ready", () => {
    resetUiThemeForTests("");
    if (READY.length >= 2) return;
    expect(lookPickerDue("a")).toBe(false);
    expect(lookRow()).toBe("");
    store.set("ea-ui", "poster");
    expect(getUiTheme()).toBe(READY.includes("poster") ? "poster" : null);
  });
  it("a choice is kept on the device", async () => {
    resetUiThemeForTests("?ui-preview=1");
    await setUiTheme("showcase");
    expect(store.get("ea-ui")).toBe("showcase");
    expect(getUiTheme()).toBe("showcase");
    await setUiTheme(null);
    expect(store.has("ea-ui")).toBe(false);
  });
  it("the picker and Settings name every look on offer", () => {
    resetUiThemeForTests("?ui-preview=1");
    const picker = lookPickerMarkup();
    const row = lookRow();
    for (const t of UI_THEMES) {
      expect(picker).toContain(`data-look="${t.id}"`);
      expect(picker).toContain(t.name);
      expect(row).toContain(`data-look-set="${t.id}"`);
    }
    // One tap chooses: the picker has no other button.
    expect(picker.match(/<button/g)?.length).toBe(UI_THEMES.length);
  });

  const dir = (id: string) =>
    new URL(`../../apps/client/src/themes/${id}/`, import.meta.url);
  const cssFiles = (id: string) =>
    readdirSync(dir(id), { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".css"));
  /** A stylesheet without its comments and without what sits inside braces. */
  const selectors = (css: string) => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const out: string[] = [];
    let depth = 0,
      start = 0;
    // At-rules that hold rules (their own selectors are checked inside).
    const groups: boolean[] = [];
    for (let i = 0; i < bare.length; i++) {
      const c = bare[i];
      if (c === "{") {
        const head = bare.slice(start, i).trim();
        const group = /^@(media|supports|layer|container)\b/.test(head);
        if (!group && groups.every(Boolean) && !head.startsWith("@"))
          out.push(head);
        groups.push(group);
        depth++;
        start = i + 1;
      } else if (c === "}") {
        groups.pop();
        depth--;
        start = i + 1;
      } else if (c === ";" && groups.every(Boolean)) start = i + 1;
    }
    expect(depth).toBe(0);
    return out;
  };
  /** A blur behind a surface: any backdrop-filter but `none`. */
  const BLURS = /backdrop-filter\s*:(?!\s*none\b)/;
  it("a look may switch a blur off, never on", () => {
    expect("backdrop-filter: none;").not.toMatch(BLURS);
    expect("-webkit-backdrop-filter:none").not.toMatch(BLURS);
    expect("backdrop-filter: blur(2px)").toMatch(BLURS);
    expect("backdrop-filter:var(--x)").toMatch(BLURS);
  });
  it("the selector reader finds rules inside and outside media queries", () => {
    expect(
      selectors(
        `/* x */ @import "./a.css"; :root[data-ui="p"] .a, .b { c: d } @media (x) { .e { f: g } } @font-face { font-family: X } @keyframes k { from { a: b } }`,
      ),
    ).toEqual([':root[data-ui="p"] .a, .b', ".e"]);
  });
  for (const t of UI_THEMES)
    it(`${t.id}: every selector sits under :root[data-ui="${t.id}"]`, () => {
      expect(cssFiles(t.id).length).toBeGreaterThan(0);
      const scope = `:root[data-ui="${t.id}"]`;
      for (const file of cssFiles(t.id)) {
        const css = readFileSync(new URL(file, dir(t.id)), "utf8");
        // No rule that runs for ever or blurs what is behind it (the
        // reference's rules for both looks). `none` is allowed: a look
        // turns off the blurs the look underneath writes by value.
        expect(css, file).not.toMatch(BLURS);
        expect(css, file).not.toMatch(/\binfinite\b/);
        for (const rule of selectors(css))
          for (const one of rule.split(/,(?![^()]*\))/))
            expect(one.trim().startsWith(scope), `${file}: ${one.trim()}`).toBe(
              true,
            );
      }
    });
  it("each look's stylesheet loads as text", async () => {
    for (const t of UI_THEMES)
      expect(typeof (await t.load()).css).toBe("string");
  });
});
