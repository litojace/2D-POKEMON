import { test, expect } from "@playwright/test";
import { openLobby, hubMenu } from "./helpers";

// Friends on phones: every row and options button shows its icon beside
// its label (owner, 19 Nov), and no label is cut on the 76 px buttons;
// the two longer ones (Add friend, Report picture) grow instead.
const PAL = "22222222-2222-4222-8222-222222222222";
for (const [width, height] of [
  [844, 390],
  [667, 375],
  [568, 320],
] as const)
  test(`friends' buttons keep icon and label at ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      await page.evaluate((pal) => {
        const f0 = window.fetch.bind(window);
        window.fetch = async (input, init) =>
          String(input).endsWith("/api/friends")
            ? new Response(
                JSON.stringify({
                  code: "AABBCCDD",
                  incoming: [
                    {
                      id: "33333333-3333-4333-8333-333333333333",
                      name: "Mina",
                    },
                  ],
                  outgoing: [],
                  friends: [
                    { id: pal, name: "Kai", online: true, activity: "town" },
                    {
                      id: "55555555-5555-4555-8555-555555555555",
                      name: "Bo",
                      online: true,
                      activity: "lobby",
                      room: "ROOM12",
                      joinable: true,
                    },
                  ],
                }),
                { headers: { "Content-Type": "application/json" } },
              )
            : f0(input, init);
      }, PAL);
      await hubMenu(page, "friends");
      await expect(page.locator("[data-friend-accept]")).toBeVisible();
      const buttons = () =>
        page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              ".fr-row .ui-row-acts > .ui-btn, .fr-opts > .ui-btn",
            ),
          ]
            .filter((b) => b.offsetWidth)
            .map((b) => {
              const label = b.querySelector("span")!;
              const svg = b.querySelector("svg");
              const br = b.getBoundingClientRect(),
                lr = label.getBoundingClientRect();
              return {
                text: label.textContent,
                icon: !!svg && getComputedStyle(svg).display !== "none",
                cut:
                  label.scrollWidth > label.clientWidth + 1 ||
                  lr.left < br.left + 2 ||
                  lr.right > br.right - 2,
              };
            }),
        );
      const seen = [...(await buttons())];
      await page.locator(`[data-friend-menu="${PAL}"]`).click();
      seen.push(...(await buttons()));
      await page.locator(`[data-friend-remove="${PAL}"]`).click();
      seen.push(...(await buttons()));
      const texts = seen.map((b) => b.text);
      for (const t of ["Decline", "Accept", "Join", "Invite", "Remove", "Keep"])
        expect(texts).toContain(t);
      expect(seen.filter((b) => !b.icon || b.cut)).toEqual([]);
      // The longer labels, in a button that grows as theirs do.
      const long = await page.evaluate(() => {
        const b = document.querySelector<HTMLElement>(
          ".fr-row .ui-row-acts > .ui-btn",
        )!;
        const label = b.querySelector("span")!;
        b.setAttribute("data-friend-add-id", "x");
        return ["Add friend", "Report picture", "Unblock", "Invited"].filter(
          (t) => {
            label.textContent = t;
            const br = b.getBoundingClientRect(),
              lr = label.getBoundingClientRect();
            return (
              label.scrollWidth > label.clientWidth + 1 ||
              lr.left < br.left + 2 ||
              lr.right > br.right - 2
            );
          },
        );
      });
      expect(long).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
