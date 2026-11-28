import { expect, test, type Page } from "@playwright/test";
import { createRoom, openHub, openPlayPanel, pushUntilBattle } from "./helpers";
import { onPlayersLook } from "./players-look";

// One scale for how serious a word is (owner, 27 Nov 2026: colour by danger
// and importance, without breaking the look): themes/poster/severity.css.
onPlayersLook();

type Rgb = [number, number, number];
const lum = (c: Rgb) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Colours as the page resolves them (Poster's can be oklch: via a canvas). */
const resolve = (page: Page, colours: string[]) =>
  page.evaluate((colours) => {
    const g = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    g.canvas.width = g.canvas.height = 1;
    const probe = document.createElement("i");
    document.body.append(probe);
    const out = colours.map((c) => {
      probe.style.color = "";
      probe.style.color = c;
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = getComputedStyle(probe).color;
      g.fillRect(0, 0, 1, 1);
      return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    });
    probe.remove();
    return out as [number, number, number][];
  }, colours);

const rgbOf = (page: Page, selector: string, prop: string, pseudo = "") =>
  page.evaluate(
    ([selector, prop, pseudo]) => {
      const el = document.querySelector(selector)!;
      const g = document.createElement("canvas").getContext("2d", {
        willReadFrequently: true,
      })!;
      g.canvas.width = g.canvas.height = 1;
      g.fillStyle = getComputedStyle(el, pseudo || null).getPropertyValue(prop);
      g.fillRect(0, 0, 1, 1);
      return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)] as Rgb;
    },
    [selector, prop, pseudo],
  );

test("severity colours hold their contrast on the surfaces they sit on", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openHub(page);
  // Words on ink: the page, a panel's board and a raised row.
  const [ok, warn, danger, ink, ink1, ink2] = await resolve(page, [
    "var(--sev-ok)",
    "var(--sev-warn)",
    "var(--sev-danger)",
    "var(--ink)",
    "var(--ink-1)",
    "var(--ink-2)",
  ]);
  for (const [name, c] of [
    ["ok", ok],
    ["warn", warn],
    ["danger", danger],
  ] as const)
    for (const [surface, bg] of [
      ["ink", ink],
      ["ink-1", ink1],
      ["ink-2", ink2],
    ] as const)
      expect(ratio(c, bg), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
  // Words on cream (with room to spare: the cream family varies), on white
  // clippings and on the gold of a button beside them.
  const [okP, warnP, dangerP, cream, white, gold] = await resolve(page, [
    "var(--sev-ok-paper)",
    "var(--sev-warn-paper)",
    "var(--sev-danger-paper)",
    "var(--paper, #f4ead5)",
    "#ffffff",
    "#ffd65b",
  ]);
  for (const [name, c] of [
    ["ok", okP],
    ["warn", warnP],
    ["danger", dangerP],
  ] as const) {
    expect(ratio(c, cream), `${name} on cream`).toBeGreaterThanOrEqual(4.8);
    expect(ratio(c, white), `${name} on white`).toBeGreaterThanOrEqual(4.8);
    expect(ratio(c, gold), `${name} on gold`).toBeGreaterThanOrEqual(4.5);
  }
  // The danger confirm: white words on the red block.
  await page.evaluate(() => {
    const m = document.createElement("div");
    m.innerHTML =
      '<div class="ui-modal" id="sev-probe"><button type="button" class="ui-btn is-danger">Block</button></div>';
    document.body.append(m);
  });
  const fill = await rgbOf(page, "#sev-probe .ui-btn", "background-color");
  const words = await rgbOf(page, "#sev-probe .ui-btn", "color");
  expect(ratio(words, fill)).toBeGreaterThanOrEqual(4.5);
  expect(fill[0]).toBeGreaterThan(180); // red, not the primary button
});

/** What the clock is drawn on: the nearest box behind it with a fill. */
const clockGround = (page: Page) =>
  page.evaluate(() => {
    const g = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    g.canvas.width = g.canvas.height = 1;
    for (
      let n: Element | null = document.getElementById("timer");
      n;
      n = n.parentElement
    ) {
      const bg = getComputedStyle(n).backgroundColor;
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = bg;
      g.fillRect(0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      if (d[3] > 240) return [d[0], d[1], d[2]] as Rgb;
    }
    return null;
  });

test("the battle clock warns while the ring closes and turns red in the last 10 s", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", {
      mode: "duel",
      phase: "playing",
      pos: [300, 450, 1300, 450],
    }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  const [warn, danger] = await resolve(page, [
    "var(--sev-warn)",
    "var(--sev-danger)",
  ]);
  const at = async (remaining: number) => {
    await page.evaluate((remaining) => {
      const w = window as any;
      w.__snap.remaining = remaining;
      w.__push();
    }, remaining);
    await page.waitForTimeout(250);
  };
  const timer = page.locator("#timer");
  const sign = () =>
    page.evaluate(
      () =>
        getComputedStyle(document.getElementById("phase-label")!, "::before")
          .content,
    );

  await at(120);
  await expect(timer).toHaveAttribute("data-clock", "");
  expect(await sign()).toBe("none");

  await at(45);
  await expect(timer).toHaveAttribute("data-clock", "ring");
  await expect(page.locator("#phase-label")).toContainText("RING CLOSING");
  expect(await rgbOf(page, "#timer", "color")).toEqual(warn);
  expect(await sign()).not.toBe("none");
  expect(
    await rgbOf(page, "#phase-label", "background-color", "::before"),
  ).toEqual(warn);
  // Words on the clock's own ink badge: AA, amber and red alike.
  const ground = await clockGround(page);
  expect(ground).not.toBeNull();
  expect(ratio(warn, ground!), "amber clock").toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: info.outputPath("ring.png") });

  await at(7);
  await expect(timer).toHaveAttribute("data-clock", "low");
  expect(await rgbOf(page, "#timer", "color")).toEqual(danger);
  expect(
    await rgbOf(page, "#phase-label", "background-color", "::before"),
  ).toEqual(danger);
  expect(ratio(danger, ground!), "red clock").toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: info.outputPath("low.png") });
  expect(errors).toEqual([]);
});

test("each toast kind carries its sign and its colour; the words stay cream", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openHub(page);
  const [ok, warn, danger, cream] = await resolve(page, [
    "var(--sev-ok)",
    "var(--sev-warn)",
    "var(--sev-danger)",
    "var(--ui-text)",
  ]);
  // main.ts toast(message, kind) writes data-kind (none for a plain note).
  const show = (kind: string | null) =>
    page.evaluate((kind) => {
      const t = document.getElementById("toast")!;
      if (kind) t.dataset.kind = kind;
      else delete t.dataset.kind;
      t.textContent = "Saved.";
      t.classList.add("show");
    }, kind);
  for (const [kind, colour] of [
    ["ok", ok],
    ["warn", warn],
    ["error", danger],
  ] as const) {
    await show(kind);
    expect(await rgbOf(page, "#toast", "border-left-color"), kind).toEqual(
      colour,
    );
    expect(
      await rgbOf(page, "#toast", "background-color", "::before"),
      kind,
    ).toEqual(colour);
    expect(
      await page.evaluate(
        () =>
          getComputedStyle(document.getElementById("toast")!, "::before")
            .maskImage,
      ),
      kind,
    ).toContain("svg");
    expect(await rgbOf(page, "#toast", "color"), kind).toEqual(cream);
  }
  // A plain note keeps no mark.
  await show(null);
  expect(
    await page.evaluate(
      () =>
        getComputedStyle(document.getElementById("toast")!, "::before").content,
    ),
  ).toBe("none");
});
