// Part of the UI remodel's Phase 0 (docs/ui-remodel/PLAN.md). Run from the repo
// root after starting the server it needs; PW_CHROMIUM picks the browser.
// The hub screens reached from the Lobby, opened in the visual-test harness
// (the real client with a fake API, plus sample friends, ranks, missions and
// raid progress). Needs: npx vite --config tests/visual/vite.config.ts
const { chromium } = require("playwright");
const fs = require("fs");
const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900, mobile: false },
  { name: "1280x720", width: 1280, height: 720, mobile: false },
  { name: "844x390", width: 844, height: 390, mobile: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    mobile: true,
    island: true,
  },
];
const today = new Date().toISOString().slice(0, 10);
const MISSIONS = [
  ["play-2", "easy", "Play 2 matches", 1, 2, 40, false],
  ["skills-30", "easy", "Use 30 skills", 30, 30, 40, true],
  ["bot-wins-3", "medium", "Win 3 matches against bots", 1, 3, 70, false],
  ["raids-2", "medium", "Clear 2 raids", 0, 2, 70, false],
  ["raid-solo-1", "medium", "Clear a raid on your own", 0, 1, 120, false],
  ["hard-bot", "medium", "Beat a Hard bot", 0, 1, 120, false],
].map(([id, tier, text, progress, target, coins, done], slot) => ({
  day: today,
  slot,
  id,
  tier: slot >= 4 ? "hard" : tier,
  text,
  progress,
  target,
  coins,
  done,
}));
const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
const FRIENDS = {
  code: "a1b2c3d4",
  friends: [
    {
      id: "f1",
      name: "Kai",
      title: "Stormcaller",
      titleColor: "#7cc4ff",
      online: true,
      activity: "lobby",
      fighter: "cindrake",
      joinable: false,
      lastOnline: iso(0),
    },
    {
      id: "f2",
      name: "Mina",
      title: null,
      titleColor: null,
      online: true,
      activity: "match",
      room: "ROOM42",
      joinable: true,
      fighter: "lumoth",
      lastOnline: iso(0),
    },
    {
      id: "f3",
      name: "Rae",
      title: "Cragbreaker",
      titleColor: "#d9b98a",
      online: true,
      activity: "town",
      fighter: "tidefin",
      lastOnline: iso(0),
    },
    {
      id: "f4",
      name: "Juniper",
      online: false,
      fighter: "terradon",
      lastOnline: iso(95),
    },
    {
      id: "f5",
      name: "Oskar",
      online: false,
      fighter: "mystowl",
      lastOnline: iso(60 * 30),
    },
    {
      id: "f6",
      name: "Lin",
      online: false,
      fighter: "voltkit",
      lastOnline: iso(60 * 24 * 9),
    },
  ],
  incoming: [{ id: "r1", name: "Pip" }],
  outgoing: [{ id: "o1", name: "Theo" }],
};
const NAMES = [
  "Aria",
  "Bram",
  "Cleo",
  "Dax",
  "Esme",
  "Finn",
  "tester",
  "Gus",
  "Hana",
  "Ivo",
  "Jude",
  "Koa",
];
const LEADERBOARD = {
  season: "2026-11",
  rows: NAMES.map((name, i) => ({
    rank: i + 1,
    name,
    title: i % 3 === 0 ? "Stormcaller" : null,
    titleColor: i % 3 === 0 ? "#7cc4ff" : null,
    wins: 60 - i * 4,
    matches: 80 - i * 3,
    me: name === "tester",
    rating: 1620 - i * 45,
    rankName:
      i < 2 ? "Master" : i < 5 ? "Expert" : i < 9 ? "Specialist" : "Pupil",
  })),
  unranked: [{ name: "Newbie", left: 3 }],
  me: { rank: 7, wins: 36, matches: 62 },
  rating: {
    rating: 1350,
    matches: 62,
    peak: 1400,
    rank: "Specialist",
    placementLeft: 0,
    next: { name: "Expert", at: 1450 },
  },
};
const RAIDS = {
  clears: 4,
  highestPeril: 2,
  bosses: {
    grumblecrag: { clears: 3, highestPeril: 2 },
    emberwing: { clears: 1, highestPeril: 1 },
  },
  titles: [],
  cosmetics: [],
  earned: [],
  weekly: [],
  loadout: {},
};

async function init(page, vp) {
  await page.addInitScript(
    ({ missions, friends, leaderboard, raids, island }) => {
      try {
        localStorage.setItem("ea-graphics", "high");
        localStorage.setItem("ea-hub-scene", "lobby");
        localStorage.setItem("ea-plaza-help", "1");
      } catch {}
      window.__missions = missions;
      let cur = window.fetch;
      const extra = {
        "/api/friends": friends,
        "/api/leaderboard": leaderboard,
        "/api/raids": raids,
      };
      const wrap = (inner) => async (input, initArg) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
          location.href,
        );
        if (extra[url.pathname]) return Response.json(extra[url.pathname]);
        return inner(input, initArg);
      };
      cur = wrap(cur);
      Object.defineProperty(window, "fetch", {
        configurable: true,
        get: () => cur,
        set: (v) => {
          cur = wrap(v);
        },
      });
      if (island) {
        const add = () => {
          const s = document.documentElement.style;
          s.setProperty("--safe-left", "59px");
          s.setProperty("--safe-right", "59px");
          s.setProperty("--safe-bottom", "21px");
          s.setProperty("--safe-top", "0px");
          const pill = document.createElement("div");
          pill.style.cssText =
            "position:fixed;left:11px;top:50%;width:37px;height:126px;margin-top:-63px;border-radius:19px;background:#000;z-index:2147483647;pointer-events:none";
          const home = document.createElement("div");
          home.style.cssText =
            "position:fixed;left:50%;bottom:8px;width:140px;height:5px;margin-left:-70px;border-radius:3px;background:rgba(255,255,255,.75);z-index:2147483647;pointer-events:none";
          document.documentElement.append(pill, home);
        };
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", add);
        else add();
      }
    },
    {
      missions: MISSIONS,
      friends: FRIENDS,
      leaderboard: LEADERBOARD,
      raids: RAIDS,
      island: !!vp.island,
    },
  );
}

async function openHub(page) {
  await page.goto("http://localhost:4179/");
  await page.waitForFunction(() => !!window.__sock);
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => window.__sock.fire("connect"));
    if (await page.locator("#lobby-play").isVisible()) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600);
}
const hubMenu = (page, action) =>
  page.click(`.lobby-rail [data-lobby-action="${action}"]`);
async function pushUntilBattle(page) {
  for (let i = 0; i < 50; i++) {
    await page.evaluate(() => window.__push());
    if (
      await page.evaluate(() =>
        document.body.classList.contains("battle-active"),
      )
    )
      break;
    await page.waitForTimeout(400);
  }
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__push());
    await page.waitForTimeout(300);
  }
}
async function openPlayPanel(page) {
  await page.click("#lobby-mode");
  await page.click('#lobby-mode-menu [data-lobby-action="more-play"]');
  await page.locator("#practice").waitFor({ state: "visible" });
}

const SCREENS = {
  async lobby(page, shot) {
    await shot("lobby");
  },
  async "mode-menu"(page, shot) {
    await page.click("#lobby-mode");
    await page.waitForTimeout(300);
    await shot("lobby-mode-menu");
  },
  async play(page, shot) {
    await openPlayPanel(page);
    await page.waitForTimeout(400);
    await shot("play-panel");
  },
  // The roster (step 3): the grid, then a fighter's detail and its tabs.
  async fighters(page, shot) {
    await hubMenu(page, "fighters");
    await page.locator(".roster-room").waitFor({ state: "visible" });
    await page.waitForTimeout(1500);
    await shot("fighters");
    await page.click("[data-roster-details]");
    await page.waitForTimeout(2500);
    await shot("fighters-skills");
    for (const tab of ["overview", "skins"]) {
      await page.click(`[data-ui-rtab=${tab}]`);
      await page.waitForTimeout(600);
      await shot(`fighters-${tab}`);
    }
  },
  // The fitting room (step 2): Shop sections, then the Wardrobe's slots.
  async shop(page, shot) {
    await hubMenu(page, "shop");
    await page.locator(".fit-room").waitFor({ state: "visible" });
    await page.waitForTimeout(1500);
    await shot("shop");
    for (const section of ["skins", "mythic", "collections"]) {
      await page.click(`[data-ui-section=${section}]`);
      await page.waitForTimeout(1200);
      await shot(`shop-${section}`);
    }
  },
  async wardrobe(page, shot) {
    await hubMenu(page, "wardrobe");
    await page.locator(".fit-room").waitFor({ state: "visible" });
    await page.waitForTimeout(1800);
    await shot("wardrobe");
    for (const slot of ["skin", "aura", "entrance", "victory", "frame"]) {
      await page.click(`[data-fit-slot=${slot}]`);
      await page.waitForTimeout(900);
      await shot(`wardrobe-${slot}`);
    }
  },
  // Raids (step 5): the Raid Hall, then a boss's page and its tabs.
  async raids(page, shot) {
    await hubMenu(page, "raids");
    await page.locator(".rh-room").waitFor({ state: "visible" });
    // The cards' portraits load lazily: wait until they are drawn.
    await page.evaluate(() =>
      Promise.all(
        [...document.querySelectorAll(".rh-room img")].map((i) =>
          i.decode().catch(() => {}),
        ),
      ),
    );
    await page.waitForTimeout(1500);
    await shot("raid-hall");
    await page.click('[data-raid-card="grumblecrag"]');
    await page.waitForTimeout(1500);
    await shot("raid-boss");
    for (const tab of ["attacks", "rewards", "guide"]) {
      await page.click(`[data-ui-raid-tab="${tab}"]`);
      await page.waitForTimeout(1500);
      await shot(`raid-${tab}`);
    }
  },
  async "raid-lobby"(page, shot) {
    await page.evaluate(() => {
      const w = window;
      w.__room("raid", { boss: "prismatail" });
      w.__snap.phase = "lobby";
      w.__snap.players = w.__snap.players.filter((p) => !p.raidBoss);
    });
    await hubMenu(page, "raids");
    await page.click('[data-raid-card="prismatail"]');
    await page.click('[data-ui-raid-play="party"]');
    await page.click('[data-raid-start="party"]');
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => window.__push());
      if (
        await page.evaluate(() =>
          document.body.classList.contains("lobby-active"),
        )
      )
        break;
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1200);
    await shot("raid-lobby");
    const drawer = page.locator(".lobby-room-drawer > summary");
    if (await drawer.isVisible().catch(() => false)) {
      await drawer.click();
      await page.waitForTimeout(600);
      await shot("raid-lobby-drawer");
    }
  },
  async "raid-briefing"(page, shot) {
    await page.evaluate(() => window.__room("raid", { boss: "grumblecrag" }));
    await openPlayPanel(page);
    await page.click("#play-create");
    await pushUntilBattle(page);
    await page.evaluate(() => {
      const w = window;
      w.__room("raid", { boss: "grumblecrag" });
      w.__snap.phase = "briefing";
      w.__push();
    });
    await page.waitForTimeout(2500);
    await shot("raid-briefing");
    await page.evaluate(() => {
      const w = window;
      Object.assign(w.__snap, {
        phase: "finished",
        matchId: "raid-test",
        winner: "me",
      });
      if (w.__snap.raid)
        w.__snap.raid.result = w.__snap.raid.result || "victory";
      w.__push();
    });
    await page.waitForTimeout(2500);
    await shot("raid-results");
  },
  async journey(page, shot) {
    await hubMenu(page, "journey");
    await page.waitForTimeout(1500);
    await shot("journey-levels");
    for (const tab of ["season", "arcade"]) {
      const t = page.locator(`[data-adventure-tab="${tab}"]`).first();
      if (await t.isVisible().catch(() => false)) {
        await t.click();
        await page.waitForTimeout(900);
        await shot(`journey-${tab}`);
      }
    }
  },
  async missions(page, shot) {
    await hubMenu(page, "missions");
    await page.waitForTimeout(1500);
    await shot("missions");
  },
  async ranks(page, shot) {
    await hubMenu(page, "ranks");
    await page.waitForTimeout(1500);
    await shot("ranks");
  },
  async friends(page, shot) {
    await hubMenu(page, "friends");
    await page.waitForTimeout(1800);
    await shot("friends");
    const add = page
      .locator("[data-friends-add], .friends-add-toggle, #friends-add")
      .first();
    if (await add.isVisible().catch(() => false)) {
      await add.click();
      await page.waitForTimeout(600);
      await shot("friends-add");
    }
  },
  async invite(page, shot) {
    await page
      .locator('.lobby-slot[data-lobby-action="invite"]')
      .first()
      .click();
    await page.waitForTimeout(1500);
    await shot("party-invite");
  },
  async profile(page, shot) {
    await page.click("#account-profile");
    await page.waitForTimeout(1500);
    await shot("profile");
  },
  async settings(page, shot) {
    await page.evaluate(() => document.getElementById("settings").click());
    await page.waitForTimeout(1000);
    await shot("settings");
  },
};

async function launch() {
  return chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
}
async function newPage(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await init(page, vp);
  return page;
}
module.exports = {
  VIEWPORTS,
  SCREENS,
  launch,
  newPage,
  openHub,
  hubMenu,
  init,
};
