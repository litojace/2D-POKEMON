import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STORE_MODES, openBetaFor } from "../../apps/client/src/open-beta";

// Open beta (owner, 28 Nov 2026; docs/open-beta.md): the web build marks
// the game BETA; a store build never does (Apple, Guideline 2.2).
const CLIENT = path.resolve(__dirname, "../../apps/client");
const html = readFileSync(path.join(CLIENT, "index.html"), "utf8");

describe("open beta", () => {
  it("is on for the web build and off for a store build or the app's shell", () => {
    expect(openBetaFor("production", false)).toBe(true);
    expect(openBetaFor("development", false)).toBe(true);
    for (const mode of STORE_MODES)
      expect(openBetaFor(mode, false)).toBe(false);
    // A web bundle inside the Capacitor shell by mistake: still no BETA.
    expect(openBetaFor("production", true)).toBe(false);
  });

  it("the iPhone app is built in a store mode", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(CLIENT, "package.json"), "utf8"),
    );
    const mode = /vite build --mode (\w+)/.exec(pkg.scripts["build:ios"]);
    expect(mode?.[1]).toBeDefined();
    expect(STORE_MODES as readonly string[]).toContain(mode![1]);
  });

  it("the boot screen carries the tag and hides it in every store mode", () => {
    // Vite writes the build's mode here (%MODE%), in every build.
    expect(html).toMatch(/<html lang="en" data-build="%MODE%">/);
    expect(html).toMatch(
      /<header class="boot-brand">[\s\S]*<\/h1>\s*<i class="beta-tag">Beta<\/i>\s*<\/header>/,
    );
    const hide = /:is\(([^)]*)\) #app-boot \.beta-tag \{\s*display: none;/.exec(
      html,
    );
    expect(hide).not.toBeNull();
    for (const mode of STORE_MODES)
      expect(hide![1]).toContain(`[data-build="${mode}"]`);
  });

  it("every tag in the game's code comes from betaTag(), behind the flag", () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.ts$/.test(e.name) && !p.endsWith("open-beta.ts")) {
          const src = readFileSync(p, "utf8");
          if (/class=\\?"beta-tag|classList\.add\("beta-tag"/.test(src))
            found.push(path.relative(CLIENT, p));
        }
      }
    };
    walk(path.join(CLIENT, "src"));
    expect(found).toEqual([]);
    // The curtain, the title screen and the sign-in screen use it.
    for (const file of [
      "src/server-connection.ts",
      "src/title-screen.ts",
      "src/home-screen.ts",
    ])
      expect(readFileSync(path.join(CLIENT, file), "utf8"), file).toContain(
        "${betaTag()}",
      );
  });
});
