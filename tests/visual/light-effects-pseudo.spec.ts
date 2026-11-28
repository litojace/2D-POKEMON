import { expect, test } from "@playwright/test";
import { openLobby } from "./helpers";

// The looping lights on pseudo-elements stop on Low graphics and with Reduce
// motion (ui/light-effects.css). The rule listed `.lobby-play::before` and a
// cosmetic's `::after` inside :is(), where a pseudo-element is not valid and
// is dropped without a word: a frame's ornament (the Conqueror frame's pulse,
// boss-frames.css) kept looping wherever no other rule stopped it, as in a
// profile or a nameplate (27 Nov 2026).
// tests/unit/css-pseudo-in-is.test.ts keeps such entries out of :is().
const PHONE = { width: 844, height: 390 };

async function loops(
  browser: import("@playwright/test").Browser,
  graphics: "low" | "high",
  reducedMotion: "reduce" | "no-preference",
) {
  const context = await browser.newContext({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
    reducedMotion,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(
      (g) => localStorage.setItem("ea-graphics", g),
      graphics,
    );
    const errors = await openLobby(page);
    const running = await page.evaluate(async () => {
      // A frame as the game draws one outside the Shop (a nameplate).
      const frame = document.createElement("span");
      frame.className = "raid-cosmetic-preview";
      frame.dataset.cosmetic = "conqueror";
      frame.style.cssText =
        "position:fixed;left:20px;top:120px;width:80px;height:80px";
      document.body.append(frame);
      await new Promise((r) => setTimeout(r, 300));
      return document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === "running" &&
            a.effect?.getTiming().iterations === Infinity,
        )
        .map((a) => {
          const e = a.effect as KeyframeEffect;
          return `${(e.target as Element)?.className}${e.pseudoElement ?? ""} ${(a as CSSAnimation).animationName}`;
        })
        .filter((l) => l.includes("::"));
    });
    return { running, errors };
  } finally {
    await context.close();
  }
}

test("a frame's looping ornament runs on High and stops on Low and with Reduce motion", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const high = await loops(browser, "high", "no-preference");
  expect(
    high.running.some((l) => l.includes("raid-cosmetic-preview::after")),
    "the ornament loops on High (else this proves nothing)",
  ).toBe(true);
  const low = await loops(browser, "low", "no-preference");
  expect(
    low.running.filter((l) => l.includes("raid-cosmetic-preview")),
    "on Low",
  ).toEqual([]);
  const still = await loops(browser, "high", "reduce");
  expect(
    still.running.filter((l) => l.includes("raid-cosmetic-preview")),
    "with Reduce motion",
  ).toEqual([]);
  for (const r of [high, low, still]) expect(r.errors).toEqual([]);
});
