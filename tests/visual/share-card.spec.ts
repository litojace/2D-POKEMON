import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { openLobby, settle, snap } from "./helpers";
import { ISLAND, layoutProblems, setInsets } from "./ui-measure";

/**
 * Share card as a picture to keep (owner, 25 Nov 2026): Share opens the
 * card large (share-preview.ts) with a QR code to the game on it. The code
 * is read back from the real PNG with jsQR, a decoder independent of the
 * encoder, at full size and seen smaller, as a camera would.
 */
const require = createRequire(import.meta.url);
const JSQR = require.resolve("jsqr/dist/jsQR.js");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
/** The harness has no VITE_SITE_URL: the code falls back to the game. */
const CARD_LINK = "https://parena.litojace.com/?ref=card";
const RESULT_LINK = "https://parena.litojace.com/?ref=result";

const SIZES = [
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];

const PROGRESS = {
  matches: 9999,
  wins: 5012,
  fighters: { voltkit: { matches: 64, wins: 40 } },
  achievements: [],
  season: { id: "2026-11", matches: 3, wins: 1 },
  rating: {
    rating: 1110,
    matches: 62,
    peak: 1140,
    rank: "Expert",
    placementLeft: 0,
    next: { name: "Candidate Master", at: 1150 },
  },
};

async function openProfile(page: Page, island = false) {
  await page.addInitScript((progress) => {
    const w = window as any;
    w.__progress = progress;
    w.__accountPatch = { title: "Cragbreaker", titleColor: "#d9b98a" };
  }, PROGRESS);
  const errors = await openLobby(page);
  if (island) await setInsets(page, ISLAND);
  await page.click("#account-profile");
  const panel = page.locator(".profile-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".pf-tile b").first()).toHaveText("9,999");
  return { errors, panel };
}

/** Read every QR code jsQR finds in the preview's picture: at full size,
 * then drawn at the given widths (the picture seen smaller). */
async function readPicture(page: Page, widths: number[]) {
  await page.addScriptTag({ path: JSQR });
  return page.evaluate(async (widths) => {
    const img = document.querySelector<HTMLImageElement>(
      "[data-share-picture]",
    )!;
    await img.decode();
    const out: { width: number; data: string | null }[] = [];
    for (const width of [img.naturalWidth, ...widths]) {
      const height = Math.round((width * img.naturalHeight) / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, width, height);
      const px = g.getImageData(0, 0, width, height);
      const read = (window as any).jsQR(px.data, width, height);
      out.push({ width, data: read?.data ?? null });
    }
    return {
      natural: [img.naturalWidth, img.naturalHeight],
      reads: out,
    };
  }, widths);
}

/** Save the picture itself (VISUAL_SHOTS) to look over. */
async function keepPicture(page: Page, name: string) {
  const dir = process.env.VISUAL_SHOTS;
  if (!dir) return;
  const b64 = await page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>(
      "[data-share-picture]",
    )!;
    const blob = await (await fetch(img.src)).blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  });
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.png`, Buffer.from(b64, "base64"));
}

/** The preview's layout: whole picture and buttons on screen, clear of the
 * safe areas, buttons on one row, their labels centred and not cut. */
async function previewProblems(
  page: Page,
  inset = { left: 0, right: 0, bottom: 0 },
) {
  await settle(page);
  return page.evaluate((inset) => {
    const problems: string[] = [];
    const W = innerWidth,
      H = innerHeight;
    const box = (el: Element) => el.getBoundingClientRect();
    const inside = (r: DOMRect, what: string) => {
      if (
        r.left < inset.left - 0.5 ||
        r.right > W - inset.right + 0.5 ||
        r.top < -0.5 ||
        r.bottom > H - inset.bottom + 0.5
      )
        problems.push(`${what} leaves the safe screen: ${JSON.stringify(r)}`);
    };
    const modal = document.querySelector(".sp-modal")!;
    const pic = document.querySelector("[data-share-picture]")!;
    inside(box(modal), "dialog");
    inside(box(pic), "picture");
    const p = box(pic);
    if (Math.abs(p.width / p.height - 1200 / 630) > 0.02)
      problems.push(`picture is stretched: ${p.width}x${p.height}`);
    if (p.width < Math.min(420, W * 0.6))
      problems.push(`picture is small: ${p.width}px wide`);
    const buttons = [...document.querySelectorAll(".sp-actions button")];
    const tops = new Set(buttons.map((b) => Math.round(box(b).top)));
    if (tops.size !== 1) problems.push("buttons are not on one row");
    for (const b of buttons) {
      const r = box(b);
      inside(r, `button ${b.textContent}`);
      const label = b.querySelector("span")!;
      if (label.scrollWidth > label.clientWidth + 1)
        problems.push(`${b.textContent} label is cut`);
      const l = box(label);
      const mid = (l.top + l.bottom) / 2 - (r.top + r.bottom) / 2;
      if (Math.abs(mid) > 2)
        problems.push(`${b.textContent} label is off centre by ${mid}`);
    }
    for (const [i, a] of buttons.entries())
      for (const b of buttons.slice(i + 1)) {
        const x = box(a),
          y = box(b);
        if (
          x.left < y.right &&
          y.left < x.right &&
          x.top < y.bottom &&
          y.top < x.bottom
        )
          problems.push(`${a.textContent} overlaps ${b.textContent}`);
      }
    const hint = document.querySelector<HTMLElement>(".sp-hint")!;
    if (!hint.hidden && hint.scrollWidth > hint.clientWidth + 1)
      problems.push("hint is cut");
    return problems;
  }, inset);
}

for (const size of SIZES)
  test(`Share card opens the picture with a QR code at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const { errors, panel } = await openProfile(page, size.island);
      const share = panel.locator("[data-profile-share]");
      await share.click();
      const preview = page.locator("[data-share-preview]");
      await expect(preview).toBeVisible();
      // Chromium here has no share sheet: Save image is the main button.
      await expect(preview.locator("[data-sp-share]")).toHaveCount(0);
      await expect(preview.locator("[data-sp-save]")).toHaveClass(/is-primary/);
      await expect(preview.locator(".sp-hint")).toHaveText(
        size.phone ? "Or press and hold the picture to download it." : "",
      );
      expect(
        await previewProblems(
          page,
          size.island ? ISLAND : { left: 0, right: 0, bottom: 0 },
        ),
      ).toEqual([]);
      // The shared rules too: 44 px hit areas on phones, labels whole.
      expect(
        await layoutProblems(page, {
          phone: size.phone,
          inset: size.island ? ISLAND : undefined,
        }),
      ).toEqual([]);
      const { natural, reads } = await readPicture(page, [800, 600, 400]);
      expect(natural).toEqual([1200, 630]);
      for (const r of reads)
        expect(r, `read at ${r.width}px`).toEqual({
          width: r.width,
          data: CARD_LINK,
        });
      // The picture's own long press is let through (Save to Photos /
      // Download image); everything else's menu stays cancelled.
      const menus = await page.evaluate(() => {
        const ask = (el: Element) => {
          const e = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
          });
          el.dispatchEvent(e);
          return e.defaultPrevented;
        };
        const pic = document.querySelector("[data-share-picture]")!;
        return {
          picture: ask(pic),
          button: ask(document.querySelector("[data-sp-close]")!),
          callout: getComputedStyle(pic).getPropertyValue(
            "-webkit-touch-callout",
          ),
        };
      });
      expect(menus.picture).toBe(false);
      expect(menus.button).toBe(true);
      await snap(page, info, `share-preview-${size.name}`);
      if (size.name === "844x390") await keepPicture(page, "card-default");
      // Save image downloads it, and says so.
      const download = page.waitForEvent("download");
      await preview.locator("[data-sp-save]").click();
      expect((await download).suggestedFilename()).toBe(
        "element-arena-player-card.png",
      );
      await expect(preview.locator(".sp-hint")).toHaveText(
        "Saved to your downloads.",
      );
      // Escape closes it, back on Share card.
      await page.keyboard.press("Escape");
      await expect(preview).toHaveCount(0);
      await expect(share).toBeFocused();
      await expect(
        panel.locator(".pf-status").filter({ hasText: /\S/ }),
      ).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("on iPhone: the share sheet gets the picture alone, hold to save", async ({
  browser,
}, info) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await context.newPage();
    // Safari's share sheet, recorded.
    await page.addInitScript(() => {
      const w = window as any;
      w.__shared = [];
      (navigator as any).canShare = (d: ShareData) =>
        !!d.files?.length && d.files.every((f) => f.type === "image/png");
      (navigator as any).share = async (d: ShareData) => {
        w.__shared.push({
          keys: Object.keys(d).sort(),
          files: d.files?.map((f) => [f.name, f.type, f.size > 10000]),
        });
      };
    });
    const { errors, panel } = await openProfile(page);
    await panel.locator("[data-profile-share]").click();
    const preview = page.locator("[data-share-preview]");
    await expect(preview).toBeVisible();
    // No download on iPhone: it would land in Files, or nowhere.
    await expect(preview.locator("[data-sp-save]")).toHaveCount(0);
    await expect(preview.locator(".sp-hint")).toHaveText(
      "Press and hold the picture, then Save to Photos.",
    );
    expect(await previewProblems(page)).toEqual([]);
    expect(await layoutProblems(page, { phone: true })).toEqual([]);
    await snap(page, info, "share-preview-iphone");
    await preview.locator("[data-sp-share]").click();
    await expect(preview).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__shared)).toEqual([
      {
        keys: ["files"],
        files: [["element-arena-player-card.png", "image/png", true]],
      },
    ]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a refused share sheet points to holding the picture", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      (navigator as any).canShare = () => true;
      (navigator as any).share = async () => {
        throw new DOMException("No activation", "NotAllowedError");
      };
    });
    const { panel } = await openProfile(page);
    await panel.locator("[data-profile-share]").click();
    const preview = page.locator("[data-share-preview]");
    await preview.locator("[data-sp-share]").click();
    await expect(preview.locator(".sp-hint")).toHaveText(
      "Sharing didn't open here. Press and hold the picture to save it.",
    );
    await expect(preview).toBeVisible();
  } finally {
    await context.close();
  }
});

/** Cards drawn straight from data: long names, long titles, a framed
 * avatar or none, and the match result card. Each one's code reads. */
test("every card variant carries a readable code", async ({
  browser,
}, info) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    await openLobby(page);
    await page.addScriptTag({ path: JSQR });
    const results = await page.evaluate(
      async ({ root, progress }) => {
        const card = await import(
          `/@fs${root}apps/client/src/screens/profile-card.ts`
        );
        const result = await import(`/@fs${root}apps/client/src/share-card.ts`);
        const base = {
          name: "tester",
          title: "Cragbreaker",
          titleColor: "#d9b98a",
          titles: [],
          guest: false,
          role: "Player",
          fighter: "voltkit",
          avatar: null,
          progress,
          raids: { clears: 12, totalClears: 12 },
          nameStatus: null,
          canDelete: true,
          journey: { xp: 52000 },
        };
        const variants: Record<string, unknown> = {
          "card-long-name": {
            ...base,
            name: "WWWWWWWWWWWWWWWWWWWW",
            title: "Mountain Conqueror of the Endless Spire",
          },
          "card-no-title-no-art": { ...base, title: null, progress: null },
          "card-big-numbers": {
            ...base,
            progress: { ...progress, matches: 1234567, wins: 999999 },
            raids: { clears: 88888, totalClears: 88888 },
          },
        };
        const out: Record<string, { data: string | null; png: string }> = {};
        const read = (c: HTMLCanvasElement) => {
          const g = c.getContext("2d")!;
          const px = g.getImageData(0, 0, c.width, c.height);
          return (window as any).jsQR(px.data, c.width, c.height)?.data ?? null;
        };
        for (const [name, d] of Object.entries(variants)) {
          const c = document.createElement("canvas");
          await card.drawPlayerCard(
            c,
            d,
            "https://parena.litojace.com",
            name !== "card-no-title-no-art",
          );
          out[name] = { data: read(c), png: c.toDataURL("image/png") };
        }
        const players = ["Ana", "Benedetta the Unbroken", "Cy", "Dee"].map(
          (name, i) => ({
            id: `p${i}`,
            name,
            character: ["voltkit", "tidefin", "cindrake", "lumoth"][i],
            team: i % 2,
            stats: { dealt: 1200 - i * 100, kos: 3 - i },
          }),
        );
        const state = {
          mode: "teams",
          players,
          scores: { p0: 3, p1: 2, p2: 3, p3: 2 },
          teamScores: [3, 2],
          winnerTeam: 0,
          winner: null,
        };
        const c = document.createElement("canvas");
        await result.drawShareCard(
          c,
          state,
          "p0",
          "https://parena.litojace.com",
        );
        out["result-2v2"] = { data: read(c), png: c.toDataURL("image/png") };
        return out;
      },
      { root: ROOT, progress: PROGRESS },
    );
    const dir = process.env.VISUAL_SHOTS;
    for (const [name, r] of Object.entries(results)) {
      expect(r.data, name).toBe(
        name.startsWith("result") ? RESULT_LINK : CARD_LINK,
      );
      const body = Buffer.from(r.png.split(",")[1], "base64");
      await info.attach(name, { body, contentType: "image/png" });
      if (dir) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${dir}/${name}.png`, body);
      }
    }
  } finally {
    await context.close();
  }
});
