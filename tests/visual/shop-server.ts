import type { Page } from "@playwright/test";

/**
 * A small stand-in for the game server's Shop calls, on top of the harness's
 * fake API (harness/fake-api.ts): /api/economy, /api/raids, /api/shop/buy,
 * /api/shop/equip, /api/shop/colours and /api/raids/equip. Shop Colors are
 * bought for the champion sent with them (migration 073). It records every call in
 * window.__shop.calls, and its answers are what the screen must show (the
 * server owns money). Set window.__shop.refuse to make the next purchase fail
 * with that reason, and window.__shop.delay to hold /api/economy until
 * window.__shop.release() is called.
 */
export interface ShopServer {
  balance?: number;
  owned?: string[];
  /** Remove these champions' skins from the default harness equipment. */
  cleared?: string[];
  /** Coins a purchase takes (the real server prices it; tests pick a number). */
  cost?: number;
  /** Raid progress: earned cosmetics and boss clears. */
  raids?: { cosmetics?: string[]; bosses?: Record<string, { clears: number }> };
  loadout?: Record<string, string | null>;
  unlimitedCoins?: boolean;
  mythicTesting?: boolean;
}
export async function shopServer(page: Page, o: ShopServer = {}) {
  await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}
window.__shop = Object.assign({ balance: 2340, owned: [], cost: 500, looks: {}, cleared: [], loadout: {}, colourUnlocks: {}, colours: {}, calls: [], refuse: null, delay: false }, ${JSON.stringify(o)});
const shopFetch = window.fetch.bind(window);
const shopEconomy = async () => {
  const s = window.__shop;
  const body = await (await shopFetch("/api/economy")).json();
  body.balance = s.balance;
  body.owned = [...new Set([...body.owned, ...s.owned])];
  Object.assign(body.looks, s.looks);
  for (const c of s.cleared) delete body.looks[c];
  body.colourUnlocks = s.colourUnlocks;
  if (s.unlimitedCoins) body.unlimitedCoins = true;
  if (s.mythicTesting) body.mythicTesting = true;
  return body;
};
const shopRaids = () => {
  const s = window.__shop, r = s.raids ?? {};
  return { v: 1, stats: {}, unlocked: [], cosmetics: r.cosmetics ?? [], earned: r.cosmetics ?? [], bosses: r.bosses ?? {}, loadout: { ...s.loadout, colours: s.colours } };
};
window.fetch = async (input, init) => {
  const s = window.__shop;
  const path = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href).pathname;
  const body = init?.body ? JSON.parse(init.body) : undefined;
  if (path === "/api/shop/buy") {
    s.calls.push(body.champion ? ["buy", body.item, body.champion] : ["buy", body.item]);
    if (s.refuse) { const error = s.refuse; s.refuse = null; return Response.json({ error }, { status: 400 }); }
    if (body.champion) (s.colourUnlocks[body.item] ??= []).push(body.champion);
    else s.owned.push(body.item);
    if (!s.unlimitedCoins) s.balance -= s.cost;
    return Response.json({ economy: await shopEconomy() });
  }
  if (path === "/api/shop/equip") {
    s.calls.push(["equip", body]);
    if (body.skin) { s.looks[body.champion] = { skin: body.skin, stage: body.stage ?? 1 }; s.cleared = s.cleared.filter((c) => c !== body.champion); }
    else { delete s.looks[body.champion]; s.cleared.push(body.champion); }
    return Response.json({ economy: await shopEconomy() });
  }
  if (path === "/api/shop/colours") {
    s.calls.push(["colours", body]);
    if (body.item) s.colours[body.champion] = body.item;
    else delete s.colours[body.champion];
    return Response.json({ economy: await shopEconomy() });
  }
  if (path === "/api/raids/equip") {
    s.calls.push(["look", body]);
    s.loadout[body.slot] = body.item;
    return Response.json({ progress: shopRaids() });
  }
  if (path === "/api/raids") return Response.json(shopRaids());
  if (path === "/api/economy") {
    const value = await shopEconomy();
    if (s.delay) { s.delay = false; await new Promise((resolve) => (s.release = resolve)); }
    return Response.json(value);
  }
  return shopFetch(input, init);
};`,
    });
  });
}

/** Expose the account UI and a fighter picker to the page (as other specs do). */
export async function exposeAccount(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = 'window.dispatchEvent(new Event("arena:ready"));';
    if (!body.includes(marker))
      throw new Error("main.ts changed: no ready marker");
    await route.fulfill({
      response,
      body: body.replace(
        marker,
        "window.__account=accountsUI;window.__choose=(id)=>{selected=id;syncHomePresentation();};" +
          marker,
      ),
    });
  });
}
