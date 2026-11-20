import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";
import { countdownCard } from "../../apps/client/src/overlay";

/**
 * The countdown before a fight (3, 2, 1) is one piece of UI for every mode
 * (owner, 20 Nov 2026): PvP, bot matches, the raids, the Spire, and anyone
 * watching. overlay.ts countdownCard() is its only markup and style.css's
 * #arena-overlay.is-countdown rules its only look, so a fix to it reaches
 * every fight. (Raids and the Spire once drew their own card, which kept
 * the old look after PvP's countdown changed.)
 */
const SRC = join(__dirname, "../../apps/client/src");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : /\.(ts|css)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
const ALL = files(SRC);
const read = (f: string) => readFileSync(f, "utf8");

it("draws every countdown with countdownCard", () => {
  // The big number's slot and the card's class are written in overlay.ts
  // only; anywhere else, a mode is drawing its own countdown.
  const offenders = ALL.filter((f) => /\.ts$/.test(f))
    .filter((f) => relative(SRC, f) !== "overlay.ts")
    .flatMap((f) =>
      read(f)
        .split("\n")
        .flatMap((line, i) =>
          /LIVE_COUNTDOWN|live-countdown|countdown-card/.test(line)
            ? [`${relative(SRC, f)}:${i + 1}: ${line.trim()}`]
            : [],
        ),
    );
  expect(offenders).toEqual([]);
  // The PvP (players and watchers) and raid/Spire overlays use it.
  for (const f of ["main.ts", "raid-ui.ts"])
    expect(read(join(SRC, f)), f).toMatch(/countdownCard\(/);
});

it("gives the countdown one look in every mode", () => {
  const css = ALL.filter((f) => f.endsWith(".css"))
    .map(read)
    .join("\n");
  // No countdown rule leaves a mode out (raids, the Spire, watchers...).
  const rules = css.match(/[^{}]*is-countdown[^{}]*\{/g) ?? [];
  expect(rules.length).toBeGreaterThan(0);
  for (const rule of rules)
    expect(rule).not.toMatch(/:not\(\.(battle-raid|spectating|touch-mode)/);
});

it("builds the countdown card the CSS expects", () => {
  const html = countdownCard("Boss raid", "Bait charges into pillars.");
  expect(html).toBe(
    '<div class="overlay-card countdown-card"><span class="eyebrow">Boss raid</span><h2><span class="live-countdown"></span></h2><div>Bait charges into pillars.</div></div>',
  );
});
