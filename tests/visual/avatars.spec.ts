import { expect, test, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";
import {
  createRoom,
  openLobby,
  openPlayPanel,
  pickRoomMode,
  snap,
} from "./helpers";
import { layoutProblems } from "./ui-measure";

// Avatars (docs/hidden-picks.md, "Avatars"): who a player is, wherever they
// are. The player card's Avatar tab picks one of the library's 52 (saved at
// once, worn in the header and on the card); a player can use their own
// photo (up to 10 MB, made a small 256 px picture on the device); and a tap
// on another player's picture in a room reports it.
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];
const PHOTO = "11111111-2222-4333-8444-555555555555";

/** A plain PNG, w × h, of one colour (a stand-in for a phone photo). */
function png(w: number, h: number, rgb: [number, number, number]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8;
  head[9] = 2;
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: w }, () => rgb).flat()),
  ]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The picture routes, answered as the server does; calls kept on window. */
async function fakePictures(page: Page) {
  await page.route(/\/api\/avatar-photo\/[0-9a-f-]{36}$/, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: png(64, 64, [230, 120, 160]),
    }),
  );
  await page.evaluate((photo) => {
    const w = window as any;
    w.__photoUploads = [];
    w.__photoReports = [];
    const before = window.fetch;
    window.fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        location.href,
      );
      if (url.pathname === "/api/account/avatar-photo") {
        const body = init?.body as Blob;
        w.__photoUploads.push({
          type: (init?.headers as Record<string, string>)["Content-Type"],
          size: body.size,
        });
        w.__avatar = `photo:${photo}`;
        return Response.json({ ok: true, avatar: `photo:${photo}` });
      }
      if (url.pathname === "/api/avatar-photo/report") {
        w.__photoReports.push(JSON.parse(String(init?.body)));
        return Response.json({ ok: true, reported: true, hidden: false });
      }
      return before(input, init);
    };
  }, PHOTO);
}

for (const size of SIZES)
  test(`choose an avatar, or your own photo, at ${size.name}`, async ({
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
      const errors = await openLobby(page);
      await fakePictures(page);
      // The header is you: the default avatar until you choose one.
      const header = page.locator(".account-avatar img.portrait-avatar");
      await expect(header).toHaveAttribute("src", /ea-avatar-001\.webp$/);
      await page.click("#account-profile");
      const panel = page.locator(".profile-panel");
      await expect(panel).toBeVisible();
      // The avatar library has its own tab on every screen.
      await panel.locator('[data-ui-profile-tab="avatar"]').click();
      // One style at a time: 26 avatars.
      const tiles = panel.locator("[data-profile-avatar]");
      await expect(tiles).toHaveCount(26);
      await expect(
        panel.locator('[data-profile-avatar="ea-avatar-001"]'),
      ).toHaveAttribute("aria-pressed", "true");
      // The third style: the second batch's 25 (the Storm Twins together).
      await panel.locator('[data-profile-avatar-style="expressions"]').click();
      await expect(tiles).toHaveCount(25);
      await expect(
        panel.locator('[data-profile-avatar="ea-avatar-077"]'),
      ).toHaveAttribute("aria-label", "Storm Twins");
      // Round, not ellipses: each tile and its picture are square (Safari
      // stretched the buttons taller than wide, owner 19 Nov).
      const shapes = await tiles.evaluateAll((bs) =>
        bs.flatMap((b) =>
          [b, b.querySelector("img")!].map((e) => {
            const r = e.getBoundingClientRect();
            return Math.abs(r.width - r.height) <= 1
              ? "round"
              : `${r.width}x${r.height}`;
          }),
        ),
      );
      expect(new Set(shapes)).toEqual(new Set(["round"]));
      await panel.locator('[data-profile-avatar-style="anime-2d"]').click();
      await expect(tiles).toHaveCount(26);
      await panel.locator('[data-profile-avatar="ea-avatar-040"]').click();
      await expect(panel.locator(".pf-avatar-status")).toContainText(
        "Avatar on",
      );
      expect(await page.evaluate(() => (window as any).__avatarSaves)).toEqual([
        "ea-avatar-040",
      ]);
      // Worn at once: the header and the card.
      await expect(header).toHaveAttribute("src", /ea-avatar-040\.webp$/);
      await expect(
        panel.locator(".pf-card img.portrait-avatar"),
      ).toHaveAttribute("src", /ea-avatar-040\.webp$/);
      // Every picture loads (no broken avatar).
      expect(
        await panel.locator("img.portrait-avatar").evaluateAll((imgs) =>
          Promise.all(
            (imgs as HTMLImageElement[]).map((i) =>
              i.decode().then(
                () => i.naturalWidth,
                () => 0,
              ),
            ),
          ),
        ),
      ).not.toContain(0);
      expect(await layoutProblems(page, { phone: size.phone })).toEqual([]);
      await snap(page, info, `avatars-library-${size.name}`);

      // Your own photo: a 10 MB+ file is refused on the device…
      const input = panel.locator("[data-profile-photo-input]");
      await input.setInputFiles({
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 1),
      });
      await expect(panel.locator(".pf-avatar-status")).toContainText(
        "over 10 MB",
      );
      // …a photo is cut square and made small before it leaves the device.
      await input.setInputFiles({
        name: "me.png",
        mimeType: "image/png",
        buffer: png(1600, 1000, [40, 160, 220]),
      });
      await expect(panel.locator(".pf-avatar-status")).toContainText(
        "Picture on",
      );
      const [upload] = await page.evaluate(
        () => (window as any).__photoUploads,
      );
      expect(["image/webp", "image/jpeg"]).toContain(upload.type);
      expect(upload.size).toBeLessThanOrEqual(65536);
      await expect(header).toHaveAttribute(
        "src",
        new RegExp(`/api/avatar-photo/${PHOTO}$`),
      );
      await expect(panel.locator(".pf-photo-now img")).toHaveCount(1);
      await expect(panel.locator("[data-profile-photo]")).toContainText(
        "Change photo",
      );
      await snap(page, info, `avatars-photo-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("a guest can't use their own photo", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__accountPatch = { guest: true };
  });
  const errors = await openLobby(page);
  await page.click("#account-profile");
  const panel = page.locator(".profile-panel");
  await panel.locator('[data-ui-profile-tab="avatar"]').click();
  await expect(panel.locator(".pf-photo-note")).toContainText(
    "Make an account",
  );
  await expect(panel.locator("[data-profile-photo]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a tap on another player's picture in a room reports it, after asking", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await openLobby(page);
  await fakePictures(page);
  await page.evaluate((photo) => {
    const w = window as any;
    w.__room("pvp", { mode: "duel", phase: "lobby" });
    w.__snap.players.find((p: any) => p.id === "p2").avatar = `photo:${photo}`;
  }, PHOTO);
  await openPlayPanel(page);
  await pickRoomMode(page, "duel");
  await createRoom(page);
  await expect
    .poll(async () => {
      await page.evaluate(() => (window as any).__push());
      return page.locator(".room-screen .roster-room").count();
    })
    .toBe(1);
  // Your own seat isn't reportable; theirs is.
  await expect(
    page.locator(".room-seats [data-me] [data-room-report-photo]"),
  ).toHaveCount(0);
  const theirs = page.locator(
    `.room-seats [data-room-report-photo="${PHOTO}"]`,
  );
  await expect(theirs.locator("img.portrait-avatar")).toHaveAttribute(
    "src",
    new RegExp(`/api/avatar-photo/${PHOTO}$`),
  );
  await theirs.click();
  const ask = page.locator("[data-ui-confirm]");
  await expect(ask).toContainText("Report Kai's picture?");
  await snap(page, info, "avatars-report-844x390");
  await ask.locator("[data-ui-confirm-ok]").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__photoReports))
    .toEqual([{ photo: PHOTO }]);
  expect(errors).toEqual([]);
});
