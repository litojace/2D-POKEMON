import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { openHub, settle, snap } from "./helpers";
import { exposeAccount } from "./shop-server";
import { ISLAND, setInsets } from "./ui-measure";
import { onPlayersLook } from "./players-look";

// The words in a form read in Poster's greys, not the look underneath's
// blue-greys (style.css: `dialog label` and `.room-panel label` #c1cfe4,
// `.auth-check` #c9d4e8, the code field's #8092b4 placeholder). A field's
// caption is --ui-dim and an option's own name (beside its tick or radio)
// the text cream; themes/poster/dialogs.css and screens.css.
//
// Every text in a label is checked for a blue cast (blue over red by more
// than 10 of 255), so any of the old blue-greys fails, not one hex value.
onPlayersLook();

const DIM = [184, 184, 192];
const CREAM = [244, 234, 213];
const dialogTs = fileURLToPath(
  new URL("../../apps/client/src/dialog.ts", import.meta.url),
);

type Text = { what: string; rgb: number[] };

/** Each text in `root`'s labels (and its fields' placeholders) as sRGB,
 * through a canvas: Poster's colours can compute as oklch(). */
const texts = (page: Page, root: string) =>
  page.evaluate((root) => {
    const ctx = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    const rgb = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const out: { what: string; rgb: number[] }[] = [];
    const scope = document.querySelector(root);
    if (!scope) return out;
    for (const label of scope.querySelectorAll("label")) {
      for (const el of [label, ...label.querySelectorAll("*")]) {
        if (el.matches("input, select, textarea, option")) continue;
        const own = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && n.textContent!.trim(),
        );
        if (!own) continue;
        out.push({
          what: `${label.className || "label"} › ${el.textContent!.trim().slice(0, 30)}`,
          rgb: rgb(getComputedStyle(el).color),
        });
      }
    }
    for (const field of scope.querySelectorAll<HTMLInputElement>(
      "input[placeholder]:not([placeholder=''])",
    ))
      out.push({
        what: `placeholder ${field.placeholder}`,
        rgb: rgb(getComputedStyle(field, "::placeholder").color),
      });
    return out;
  }, root);

const blueCast = (t: Text) => t.rgb[2] - t.rgb[0] > 10;
const is = (t: Text, want: number[]) =>
  t.rgb.every((v, i) => Math.abs(v - want[i]) <= 2);

async function noBlue(page: Page, root: string, name: string) {
  const all = await texts(page, root);
  expect(all.length, `${name}: words found`).toBeGreaterThan(0);
  expect(
    all.filter(blueCast).map((t) => `${t.what} rgb(${t.rgb.join(", ")})`),
    `${name}: no blue-grey`,
  ).toEqual([]);
  return all;
}

/** One property of one element, as sRGB (through a canvas). */
const colourOf = (page: Page, selector: string, prop: string) =>
  page.locator(selector).evaluate((el, prop) => {
    const ctx = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    ctx.fillStyle = "#000";
    ctx.fillStyle = getComputedStyle(el).getPropertyValue(prop);
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }, prop);

const closeDialog = (page: Page) =>
  page.evaluate(() =>
    (document.getElementById("dialog") as HTMLDialogElement).close(),
  );

const SIZES = [
  { name: "667x375", width: 667, height: 375, phone: true, island: false },
  { name: "844x390", width: 844, height: 390, phone: true, island: false },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
  { name: "1440x900", width: 1440, height: 900, phone: false, island: false },
];

for (const size of SIZES)
  test(`every form's words read in Poster's greys at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      await exposeAccount(page);
      const errors = await openHub(page);
      if (size.island) await setInsets(page, ISLAND);

      // Join or watch (#724): the two captions dim, "ABC123" fainter.
      await page.click("#lobby-mode");
      await page.click('#lobby-mode-menu [data-lobby-action="more-play"]');
      await expect(page.locator("#code")).toBeVisible();
      await settle(page);
      const join = await noBlue(page, ".room-panel", "Join or watch");
      for (const t of join.filter((t) => !t.what.startsWith("placeholder")))
        expect(is(t, DIM), `${t.what} is --ui-dim`).toBe(true);
      await snap(page, info, `form-join-${size.name}`);
      await page.keyboard.press("Escape");

      // Settings: Game's sliders, then Help → Controls and Report.
      await page.locator("#home-settings").click();
      await page.locator('[data-settings-tab="game"]').click();
      await settle(page);
      await noBlue(page, "#dialog", "Settings → Game");
      await page.locator('[data-settings-tab="help"]').click();
      await page.locator("#open-controls").click();
      const more = page.locator("#dialog .controls-more");
      if (await more.count())
        await more.evaluate((d) => ((d as HTMLDetailsElement).open = true));
      await settle(page);
      const controls = await noBlue(page, "#dialog", "Controls");
      // An option's name is cream, its note dim.
      const names = controls.filter((t) => t.what.startsWith("choice"));
      expect(names.some((t) => is(t, CREAM))).toBe(true);
      expect(names.some((t) => is(t, DIM))).toBe(true);
      // "Back to settings" on the masthead: the masthead's dim words, not
      // the look underneath's #b8cce8.
      const back = await colourOf(page, "#controls-back", "color");
      expect(
        back[2] - back[0],
        `Back to settings rgb(${back})`,
      ).toBeLessThanOrEqual(10);
      await snap(page, info, `form-controls-${size.name}`);
      await closeDialog(page);

      await page.locator("#home-settings").click();
      await page.locator('[data-settings-tab="help"]').click();
      await page.locator("#settings-report").click();
      await expect(page.locator("#report-form")).toBeVisible();
      await settle(page);
      const report = await noBlue(page, "#dialog", "Report a problem");
      for (const t of report.filter((t) => !t.what.startsWith("placeholder")))
        expect(is(t, DIM), `${t.what} is --ui-dim`).toBe(true);
      // The drop-down is the text field beside it (ink-2), not navy.
      const pick = await colourOf(
        page,
        "#report-form select",
        "background-color",
      );
      const area = await colourOf(
        page,
        "#report-form textarea",
        "background-color",
      );
      expect(pick, "the drop-down's fill is the text field's").toEqual(area);
      await snap(page, info, `form-report-${size.name}`);
      await closeDialog(page);

      // Sign in, opened as a dialog from the hub (the welcome screen's
      // copy is checked below): "Remember me" cream.
      await page.evaluate(() => (window as any).__account.showAuth("login"));
      await expect(page.locator("#dialog .auth-panel")).toBeVisible();
      await settle(page);
      const auth = await noBlue(page, "#dialog", "Sign in");
      const remember = auth.find((t) => t.what.includes("Remember me"));
      expect(remember && is(remember, CREAM), "Remember me is cream").toBe(
        true,
      );
      await snap(page, info, `form-auth-${size.name}`);
      await closeDialog(page);

      // The admin panel's forms (admin-panel.ts) live in the same dialog:
      // their label classes, as the panel writes them, in #dialog. A
      // caption dim, the push switch's name cream.
      await page.evaluate(async (dialogTs) => {
        const { setDialogContent } = await import(
          /* @vite-ignore */ `/@fs${dialogTs}`
        );
        const d = document.getElementById("dialog") as HTMLDialogElement;
        setDialogContent(
          d,
          `<div id="adm-root" class="adm"><label><span>Type the name to confirm</span><input data-confirm-name></label><label class="adm-field-block"><span>Message</span><textarea></textarea><small>Shown to everyone</small></label><label class="adm-hours"><span>For</span><select><option>6 hours</option></select></label><label class="adm-check"><input type="checkbox"><span><b>Send a push</b><small>To players who allowed it</small></span></label><label class="adm-tier-pick"><span>Tier</span><select><option>Common</option></select></label></div>`,
        );
        d.showModal();
      }, dialogTs);
      await settle(page);
      const admin = await noBlue(page, "#dialog", "Admin forms");
      expect(
        is(
          admin.find((t) => t.what.endsWith("Send a push"))!,
          CREAM,
        ),
      ).toBe(true);
      expect(
        is(
          admin.find((t) => t.what.endsWith("Tier"))!,
          DIM,
        ),
      ).toBe(true);
      await closeDialog(page);

      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("the welcome screen's sign-in reads in Poster's greys", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  // Signed out: the welcome screen, its sign-in form in #gate-auth.
  await page.route("**/stubs.ts*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "getSession: async () => ({ data: { session } })",
        "getSession: async () => ({ data: { session: null } })",
      ),
    });
  });
  await page.goto("/");
  await page.click('[data-auth-tab="login"]');
  await expect(page.locator("#gate-auth .auth-check")).toBeVisible();
  await settle(page);
  const gate = await noBlue(page, "#gate-auth", "Welcome sign-in");
  const remember = gate.find((t) => t.what.includes("Remember me"));
  expect(remember && is(remember, CREAM), "Remember me is cream").toBe(true);
  await snap(page, info, "form-welcome-login");
});
