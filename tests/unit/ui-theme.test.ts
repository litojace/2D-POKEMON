import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  DEFAULT_UI_THEME,
  UI_THEMES,
  getUiTheme,
  readUiQuery,
  resetUiThemeForTests,
  resolveUiTheme,
} from "../../apps/client/src/ui-theme";
import { PLAYERS_LOOK } from "../visual/players-look";

// The game's look (ui-theme.ts): Poster for every player, the look
// underneath kept for the visual tests, and the rules a theme's folder
// keeps. In the page: tests/visual/ui-theme.spec.ts.
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

const plain = readUiQuery("");

describe("the address", () => {
  it("reads ?ui=", () => {
    expect(readUiQuery("?ui=poster")).toEqual({ ui: "poster" });
    expect(readUiQuery("?ui=classic").ui).toBe("classic");
    expect(readUiQuery("?ui=showcase").ui).toBeUndefined();
    expect(readUiQuery("?ui=nonsense").ui).toBeUndefined();
    expect(readUiQuery("?x=1")).toEqual({ ui: undefined });
  });
});

describe("which look shows", () => {
  it("is Poster with nothing saved, and the look underneath when there is no default", () => {
    expect(resolveUiTheme(null, plain)).toBe("poster");
    expect(resolveUiTheme(null, plain, UI_THEMES, null)).toBeNull();
  });
  it('a saved "classic" keeps the look underneath (the visual tests pin it)', () => {
    expect(resolveUiTheme("classic", plain)).toBeNull();
    expect(resolveUiTheme("classic", readUiQuery("?ui=poster"))).toBe("poster");
  });
  it("a saved look that is gone (a tester's Showcase) gets Poster", () => {
    expect(resolveUiTheme("showcase", plain)).toBe("poster");
    expect(resolveUiTheme("old-name", plain)).toBe("poster");
  });
  it("the address wins for a page load", () => {
    expect(resolveUiTheme("poster", readUiQuery("?ui=classic"))).toBeNull();
    expect(
      resolveUiTheme(null, readUiQuery("?ui=poster"), UI_THEMES, null),
    ).toBe("poster");
  });
});

describe("the look as shipped", () => {
  it("is Poster alone: Showcase and the picker are gone", () => {
    expect(UI_THEMES.map((t) => t.id)).toEqual(["poster"]);
    for (const gone of [
      "themes/showcase/index.ts",
      "ui-theme-picker.ts",
      "lobby-raid.ts",
    ])
      expect(
        existsSync(new URL(`../../apps/client/src/${gone}`, import.meta.url)),
        gone,
      ).toBe(false);
  });
  it("every player gets Poster, with nothing saved and nothing in the address", () => {
    resetUiThemeForTests("");
    expect(DEFAULT_UI_THEME).toBe("poster");
    expect(getUiTheme()).toBe("poster");
    // It ships in the game's own script: no chunk to wait for at startup.
    expect(typeof UI_THEMES[0].css).toBe("string");
    store.set("ea-ui", "showcase");
    expect(getUiTheme()).toBe("poster");
    store.set("ea-ui", "classic");
    expect(getUiTheme()).toBeNull();
  });
  it("the budget specs measure the look every player gets", () => {
    // tests/visual/players-look.ts: the battle and panel budgets run in
    // this look. Changing the default (or reverting it to null, the look
    // underneath) means changing PLAYERS_LOOK in the same pull request, or
    // the budgets would go on measuring a look players no longer have.
    expect(PLAYERS_LOOK).toBe(DEFAULT_UI_THEME ?? "classic");
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
        // One animation runs for ever, by the owner's leave (27 Nov 2026):
        // the title cover's slow turn (docs/ui-themes.md). Nothing else.
        const endless = css.match(/animation[^;{}]*\binfinite\b[^;{}]*/g) ?? [];
        expect(css.match(/\binfinite\b/g) ?? [], file).toHaveLength(
          endless.length,
        );
        for (const rule of endless)
          expect(rule, file).toMatch(/\bposter-cover-turn\b/);
        expect(endless.length, file).toBe(
          t.id === "poster" && file.endsWith("onboarding.css") ? 1 : 0,
        );
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
