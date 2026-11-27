import { expect, test, type Page } from "@playwright/test";

import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  settle,
  snap,
} from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// The party's health in a raid (raid-party.ts, owner, 20 Nov 2026): each
// ally's name over a plain bar, top left, so a party sees who needs help
// when the phone's follow camera leaves allies off screen. Green, orange
// when low, red filling with the revive when down. The quick-chat button is
// glass like the Lobby's and steps below the list on phones.

const GREEN = "rgb(111, 220, 154)",
  ORANGE = "rgb(255, 166, 77)",
  RED = "rgb(255, 93, 108)";

type Rect = { left: number; top: number; right: number; bottom: number };
const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right - 1 &&
  a.right > b.left + 1 &&
  a.top < b.bottom - 1 &&
  a.bottom > b.top + 1;

/** Kai at full health, Mira at a quarter, Bao Long down and 40% revived. */
async function party(page: Page) {
  await page.evaluate(() => {
    const w = window as any,
      s = w.__snap;
    const friend = s.players.find((p: any) => p.id === "p2");
    friend.name = "Kai";
    const full = friend.hp;
    s.players.push(
      {
        ...friend,
        id: "p3",
        name: "Mira",
        character: "tidefin",
        x: 1450,
        y: 760,
        hp: Math.round(full * 0.25),
      },
      {
        ...friend,
        id: "p4",
        name: "Bao Long",
        character: "cindrake",
        x: 150,
        y: 800,
        hp: 0,
      },
    );
    s.raid.partySize = 4;
    s.raid.downed = { p4: { progress: 0.4, self: false } };
    w.__push();
  });
}

const read = (page: Page) =>
  page.evaluate(() => {
    const box = document.getElementById("raid-party")!;
    const rect = (e: Element | null): Rect | null => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const visible = (e: Element | null) =>
      !!e &&
      getComputedStyle(e).display !== "none" &&
      getComputedStyle(e).visibility !== "hidden";
    return {
      shown: visible(box),
      box: rect(box),
      rows: [...box.querySelectorAll<HTMLElement>(".rp-ally")].map((row) => ({
        name: row.querySelector("b")!.textContent,
        state: row.dataset.state,
        fill: Number(getComputedStyle(row).getPropertyValue("--fill")),
        colour: getComputedStyle(row.querySelector(".rp-bar > i")!)
          .backgroundColor,
        label: row.getAttribute("aria-label"),
      })),
      boss: rect(document.querySelector(".raid-boss-health")),
      chat: visible(document.querySelector("#battle-chat"))
        ? rect(document.querySelector("#battle-chat"))
        : null,
      chatBlur: getComputedStyle(document.querySelector("#battle-chat")!)
        .backdropFilter,
      // Its fill's opacity, through a canvas (Poster's colours compute as
      // oklch()).
      chatOpaque: (() => {
        const cx = document.createElement("canvas").getContext("2d")!;
        cx.fillStyle = getComputedStyle(
          document.querySelector("#battle-chat")!,
        ).backgroundColor;
        cx.fillRect(0, 0, 1, 1);
        return cx.getImageData(0, 0, 1, 1).data[3] === 255;
      })(),
      others: [".joystick-area", "#battle-menu", ".raid-elapsed"]
        .map((q) => document.querySelector(q))
        .filter(visible)
        .map(rect),
    };
  });

for (const size of [
  { width: 844, height: 390, mobile: true, island: false },
  { width: 667, height: 375, mobile: true, island: false },
  { width: 956, height: 440, mobile: true, island: true },
  { width: 1440, height: 900, mobile: false, island: false },
])
  test(`a party sees each ally's name and health at ${size.width}x${size.height}${size.island ? " with the Dynamic Island" : ""}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.mobile,
      hasTouch: size.mobile,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "grumblecrag" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      if (size.island) await setInsets(page, ISLAND);
      await party(page);
      await expect(page.locator("#raid-party .rp-ally")).toHaveCount(3);
      await settle(page);
      const look = await read(page);
      expect(look.shown).toBe(true);
      expect(look.rows.map((r) => [r.name, r.state, r.colour])).toEqual([
        ["Kai", "ok", GREEN],
        ["Mira", "low", ORANGE],
        ["Bao Long", "down", RED],
      ]);
      expect(look.rows[0].fill).toBeCloseTo(1, 2);
      expect(look.rows[1].fill).toBeCloseTo(0.25, 1);
      expect(look.rows[2].fill).toBeCloseTo(0.4, 2);
      expect(look.rows[2].label).toBe("Bao Long: down, 40% revived");
      // Clear of the boss's bar, the quick-chat button and the controls,
      // and inside the safe area.
      const box = look.box!;
      expect(overlaps(box, look.boss!)).toBe(false);
      if (look.chat) expect(overlaps(box, look.chat)).toBe(false);
      for (const other of look.others)
        expect(overlaps(box, other!)).toBe(false);
      const inset = size.island
        ? ISLAND
        : { left: 0, top: 0, right: 0, bottom: 0 };
      expect(box.left).toBeGreaterThanOrEqual(inset.left);
      expect(box.top).toBeGreaterThanOrEqual(inset.top);
      // The quick-chat button reads over the fight, as in the Lobby: glass
      // in the old look (a blur, on High graphics), a solid ink block in
      // Poster's.
      if (look.chat)
        expect(
          look.chatBlur.includes("blur") || look.chatOpaque,
          `chat button: ${look.chatBlur}, opaque ${look.chatOpaque}`,
        ).toBe(true);
      await snap(
        page,
        info,
        `raid-party-${size.width}x${size.height}${size.island ? "-island" : ""}`,
      );

      // Health changes write the bar in place: the rows are not rebuilt.
      await page.evaluate(() => {
        for (const row of document.querySelectorAll("#raid-party .rp-ally"))
          (row as any).__kept = true;
        const w = window as any,
          s = w.__snap;
        s.players.find((p: any) => p.id === "p2").hp = 1;
        s.raid.downed.p4.progress = 0.9;
        w.__push();
      });
      await expect
        .poll(async () => (await read(page)).rows.map((r) => r.state))
        .toEqual(["low", "low", "down"]);
      expect(
        await page.evaluate(() =>
          [...document.querySelectorAll("#raid-party .rp-ally")].every(
            (row) => (row as any).__kept,
          ),
        ),
      ).toBe(true);
      expect((await read(page)).rows[2].fill).toBeCloseTo(0.9, 2);

      // The rites screen covers the fight: the list steps aside.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "intermission";
        w.__snap.raid.offers.me = [
          "shelter",
          "sharing",
          "core",
          "rescue",
          "courage",
          "mending",
        ];
        w.__push();
      });
      await expect(page.locator("[data-raid-rite]")).toHaveCount(6);
      expect((await read(page)).shown).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("solo, nothing shows; in the Spire a climbing partner does; Low graphics drops the chat's blur", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("raid", { boss: "grumblecrag" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    // Solo: only the raider and the boss.
    await page.evaluate(() => {
      const w = window as any,
        s = w.__snap;
      s.players = s.players.filter((p: any) => p.raidBoss || p.id === "me");
      s.raid.partySize = 1;
      w.__push();
    });
    await expect(page.locator("#raid-party")).toBeHidden();

    // A Spire climb with a partner: one row, the climb's Echoes aren't allies.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { stage: "playing", floor: 2, seats: 2 });
      w.__push();
    });
    await expect
      .poll(async () => {
        await page.evaluate(() => (window as any).__push());
        return (await read(page)).rows.map((r) => r.name).length;
      })
      .toBe(1);
    await expect(page.locator("#raid-party")).toBeVisible();
    await snap(page, info, "raid-party-spire-844x390");

    // Low graphics: the chat's glass is near solid, without the blur.
    await page.evaluate(() => {
      document.documentElement.dataset.uiEffects = "light";
    });
    expect((await read(page)).chatBlur).toBe("none");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
