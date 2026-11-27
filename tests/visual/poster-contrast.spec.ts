import { expect, test, type Page } from "@playwright/test";
import { hubMenu, openHub, skipTour } from "./helpers";

// Poster paints with the Lobby fighter's element colour (--el). Each word on
// the Lobby, the hub's screens and Settings must keep WCAG AA contrast
// (4.5:1, 3:1 for large text) against what is really drawn under it, in
// every element colour: the page is shot once with its words hidden, and
// each word's colour is compared with the middle of the pixels under it.
// So slabs drawn with pseudo-elements, gradients and art all count.
// Not covered yet: the battle, the result and the raid screens. Words
// whose own element or a parent is aria-hidden, and SVG text, are skipped:
// they are decoration or have a label.
const COLOURS: Record<string, string> = {
  electric: "#ffd84a",
  fire: "#ff7a45",
  water: "#4fb3ff",
  aura: "#7fe7ff",
  light: "#fff1a8",
  psychic: "#c47dff",
  earth: "#c8955a",
  shadow: "#8a6bff",
  nature: "#7fcf6a",
};

type Word = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fg: [number, number, number, number];
  need: number;
};

/** The words on screen, with their colour and the contrast they need. */
const words = (page: Page) =>
  page.evaluate(() => {
    const out: Word[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const seen = new Set<Element>();
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      const text = t.textContent?.trim();
      if (!el || seen.has(el) || !text) continue;
      seen.add(el);
      if (el.closest("svg, [aria-hidden='true']")) continue;
      // The text's own box, not its element's (padding, icons).
      const range = document.createRange();
      range.selectNodeContents(t);
      const r = range.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (
        r.left < 0 ||
        r.top < 0 ||
        r.right > innerWidth ||
        r.bottom > innerHeight
      )
        continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== "visible") continue;
      let op = 1;
      for (let n: Element | null = el; n; n = n.parentElement)
        op *= Number(getComputedStyle(n).opacity);
      if (op < 0.05) continue;
      // Under something else (a sheet over the Lobby): not seen.
      const hit = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      );
      if (!hit || !(el.contains(hit) || hit.contains(el))) continue;
      const m = cs.color.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const p = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      const size = parseFloat(cs.fontSize);
      const bold =
        Number(cs.fontWeight) >= 700 || cs.fontFamily.includes("Anton");
      const large = size >= 24 || (bold && size >= 18.66);
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string"
          ? el.className
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((c) => `.${c}`)
              .join("")
          : "";
      out.push({
        name: `${el.tagName.toLowerCase()}${id}${cls} "${text.slice(0, 24)}"`,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        fg: [p[0], p[1], p[2], (p[3] ?? 1) * op],
        need: large ? 3 : 4.5,
      });
    }
    return out;
  });

/** Words whose contrast is under what they need, with the measure. */
async function measure(page: Page, where: string) {
  const list = await words(page);
  const hide = await page.addStyleTag({
    content:
      "*, *::before, *::after { color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; caret-color: transparent !important; transition: none !important; }",
  });
  const png = (await page.screenshot({ animations: "disabled" })).toString(
    "base64",
  );
  await hide.evaluate((s) => (s as Element).remove());
  return page.evaluate(
    async ({ png, list, where }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / innerWidth;
      const lum = (c: number[]) => {
        const f = (v: number) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      };
      const out: string[] = [];
      for (const w of list) {
        const data = ctx.getImageData(
          Math.floor(w.x * scale),
          Math.floor(w.y * scale),
          Math.max(1, Math.floor(w.w * scale)),
          Math.max(1, Math.floor(w.h * scale)),
        ).data;
        // The backdrop's middle: sort the pixels by brightness, take the
        // median one.
        const px: number[][] = [];
        for (let i = 0; i < data.length; i += 4)
          px.push([data[i], data[i + 1], data[i + 2]]);
        px.sort((a, b) => lum(a) - lum(b));
        const bg = px[px.length >> 1];
        const a = w.fg[3];
        const fg = [0, 1, 2].map((i) => w.fg[i] * a + bg[i] * (1 - a));
        const l1 = lum(fg);
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < w.need)
          out.push(
            `${where} ${w.name} ${ratio.toFixed(2)} < ${w.need} (fg rgb(${fg.map((v) => v | 0)}), bg rgb(${bg}))`,
          );
      }
      return out;
    },
    { png, list, where },
  );
}

test("Poster: words keep AA contrast in every element colour", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await skipTour(page);
  await page.addInitScript(() => {
    if (!location.search) history.replaceState(null, "", "/?ui=poster");
  });
  await openHub(page);
  await page.evaluate(() => document.fonts.ready);
  const failures: string[] = [];
  const shots = process.env.CONTRAST_SHOTS;
  for (const [name, hex] of Object.entries(COLOURS)) {
    await page.evaluate(
      (hex) => document.documentElement.style.setProperty("--el", hex),
      hex,
    );
    failures.push(...(await measure(page, `${name} lobby`)));
    if (shots) await page.screenshot({ path: `${shots}/${name}-lobby.png` });
    for (const action of [
      "fighters",
      "shop",
      "missions",
      "ranks",
      "friends",
      "raids",
    ]) {
      await hubMenu(page, action);
      const panel = page
        .locator(
          ".ui-panel-host:not([data-ui-parked]) > .ui-panel:not([data-ui-leaving])",
        )
        .last();
      await expect(panel).toBeVisible();
      await page.waitForTimeout(500);
      failures.push(...(await measure(page, `${name} ${action}`)));
      if (shots)
        await page.screenshot({ path: `${shots}/${name}-${action}.png` });
      await panel.locator(".ui-close").click();
      await expect(panel).toBeHidden();
    }
    await page.evaluate(() => document.getElementById("settings")!.click());
    await expect(page.locator("#dialog .settings-screen")).toBeVisible();
    await page.waitForTimeout(400);
    failures.push(...(await measure(page, `${name} settings`)));
    if (shots) await page.screenshot({ path: `${shots}/${name}-settings.png` });
    await page.keyboard.press("Escape");
    await expect(page.locator("#dialog .settings-screen")).toBeHidden();
  }
  console.log(failures.join("\n"));
  expect(failures).toEqual([]);
});
