import type { Page } from "@playwright/test";

/**
 * A stand-in for the Bistro's server (migration 067) inside the page: the
 * harness has no database. It runs the same shared rules the database
 * mirrors (exposed by the scene as window.__bistroRules in development) on
 * a clock the test can move (window.__bistroServer.advance).
 */
export async function fakeBistro(page: Page) {
  // After the harness has set up its own fetch (call it once the hub is open).
  await page.evaluate(() => {
    const w = window as any;
    const server: any = {
      clock: 0,
      S: null,
      extras: {
        special: "banhmi",
        chef: "voltkit",
        likes: 3,
        leaves: 1234,
        tradedToday: 0,
        friendGuests: [],
        dinesToday: 0,
      },
      away: null,
      requests: [] as any[],
      friends: [] as any[],
      views: {} as Record<string, any>,
      now: () => Date.now() + server.clock,
      advance: (s: number) => (server.clock += s * 1000),
    };
    w.__bistroServer = server;
    const rules = async () => {
      while (!w.__bistroRules) await new Promise((r) => setTimeout(r, 10));
      return w.__bistroRules;
    };
    const catchUp = (R: any) => {
      const t = server.now();
      const from = server.S.lastSeen;
      server.S.lastSeen = t;
      if (!from || t <= from) return;
      if (t - from >= 60_000) {
        const rep = R.simulateAway(server.S, from, t, server.extras.special);
        if (rep) server.away = rep;
      } else R.autoKitchen(server.S, t);
    };
    const state = () => ({
      ...server.S,
      ...server.extras,
      now: server.now(),
    });
    const fetch = window.fetch.bind(window);
    window.fetch = async (input: any, init?: any) => {
      const url = String(input);
      if (!url.includes("/api/bistro")) return fetch(input, init);
      const R = await rules();
      if (!server.S) server.S = R.defaultState();
      const json = (v: unknown) =>
        new Response(JSON.stringify(v), {
          headers: { "Content-Type": "application/json" },
        });
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (url.endsWith("/api/bistro")) {
        catchUp(R);
        const away = server.away;
        server.away = null;
        return json({ ...state(), away });
      }
      if (url.endsWith("/api/bistro/act")) {
        server.requests.push(body);
        catchUp(R);
        const away = server.away;
        server.away = null;
        const results = body.actions.map((a: any) =>
          R.applyLocal(server.S, a, server.now(), server.extras),
        );
        return json({ bistro: state(), results, away });
      }
      if (url.endsWith("/api/bistro/friends")) return json(server.friends);
      if (url.includes("/api/bistro/visit/act")) {
        const v = server.views[body.friend];
        if (body.kind === "dine") {
          v.dined = true;
          v.myDines++;
          const c = v.counter.find((x: any) => x && x.servings > 0);
          if (c) c.servings--;
          return json({ bistro: v, ok: true, dish: c?.dish, paid: 6, coins: 10, xp: 5 });
        }
        v.liked = true;
        v.likes++;
        return json({ bistro: v, ok: true, xp: 2 });
      }
      if (url.includes("/api/bistro/visit/")) {
        const id = url.split("/").pop()!;
        return json(server.views[id]);
      }
      return fetch(input, init);
    };
  });
}
