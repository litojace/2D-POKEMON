import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openTown } from "./helpers";

test("town loads the approved plaza art without relying on legacy cached URLs", async ({
  page,
}, info) => {
  let legacyRequests = 0;
  await page.route(
    /\/assets\/town\/(fountain|ground)\.webp(?:\?.*)?$/,
    (route) => {
      legacyRequests++;
      return route.fulfill({ status: 404, body: "Stale legacy URL" });
    },
  );
  const expected = ["town-fountain", "town-ground"];
  const loaded = expected.map((name) =>
    page.waitForResponse(
      (response) =>
        response.headers()["content-type"]?.startsWith("image/") &&
        response.url().includes(`${name}`),
    ),
  );
  const errors = await openTown(page);
  for (const [index, response] of (await Promise.all(loaded)).entries()) {
    expect(response.ok()).toBe(true);
    const source = await readFile(
      `apps/client/src/art/${expected[index]}.webp`,
    );
    const hash = (data: Buffer) =>
      createHash("sha256").update(data).digest("hex");
    expect(hash(await response.body())).toBe(hash(source));
  }
  expect(legacyRequests).toBe(0);
  await page.evaluate(() => (window as any).__townPosition(1810, 1080));
  await page.click("#town-zoom-out");
  await page.waitForTimeout(800);
  await info.attach("actual-town-plaza", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  expect(errors).toEqual([]);
});
