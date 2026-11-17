import type { Page } from "@playwright/test";

// Hub redesign phase 4: the Farm scene. The harness has no database, so this
// page answers /api/farm and /api/farm/act itself, the way the server does.
export async function fakeFarm(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    const now = () => new Date().toISOString();
    const at = (s: number) => new Date(Date.now() + s * 1000).toISOString();
    const plots = Array.from({ length: 50 }, (_, i) => ({
      i,
      owned: i % 10 < 5 && Math.floor(i / 10) < 3,
      crop: null as string | null,
      progress: 0,
      ripeAt: null as string | null,
      wet: false,
      fertilizer: null,
      mutation: null,
      pests: 0,
    }));
    Object.assign(plots[0], { crop: "wheat", progress: 1, ripeAt: at(-60) });
    Object.assign(plots[1], {
      crop: "carrot",
      progress: 0.4,
      ripeAt: at(2400),
      wet: true,
    });
    Object.assign(plots[2], {
      crop: "wheat",
      progress: 0.8,
      ripeAt: at(700),
      pests: 1,
    });
    Object.assign(plots[4], {
      crop: "carrot",
      progress: 1,
      ripeAt: at(-30),
      mutation: "gold",
    });
    const farm = {
      now: now(),
      level: 3,
      xp: 20,
      landBought: 0,
      barnCap: 80,
      barnUpgrades: 0,
      fertilizer: { norm: 3, super: 1, gold: 0 },
      // Every tool owned (Copper Can, Sickle), a scarecrow and a sprinkler.
      tools: {
        can: 2,
        bigNet: false,
        sickle: true,
        scarecrow: true,
        sprinklers: 1,
      },
      plots,
      seeds: { wheat: 9, carrot: 6 },
      barn: [{ crop: "wheat", mutation: "", qty: 4 }],
      harvests: { wheat: 2 },
      market: {
        day: "2026-11-02",
        hot: "carrot",
        mult: { wheat: 1.1, carrot: 1.7, voltberry: 0.9, mint: 1.2 },
      },
      shop: {
        window: "1",
        restockAt: at(5000),
        stock: { wheat: 24, carrot: 22, voltberry: 21, mint: 25 },
      },
      leaves: 1234,
      // The third forecast ("later") is only Mystowl's (migration 046).
      weather: { now: "storm", next: "rainbow", until: at(5000) },
      bookRewards: [5],
      wishReady: true,
      // No farmer before migration 046: set by the perk test.
      farmer: undefined as string | undefined,
      perksUsed: [] as string[],
      decor: [] as {
        id: number;
        item: string;
        x: number;
        y: number;
        flip: boolean;
      }[],
      charm: 0,
      decorCredits: {} as Record<string, number>,
      // The Cow Pasture (migration 049).
      pasture: false,
      milkAt: null as string | null,
      milkMult: 1.12,
      // The Chicken Coop (20261117100000).
      coop: false,
      hens: [] as { i: number; eggAt: string | null }[],
      eggMult: 1.2,
      dog: null as any,
      dogGifts: [] as any[],
      crows: {} as Record<string, string>,
      // Giant crops (migration 050).
      giants: [] as {
        i: number;
        crop: string;
        plots: number[];
        formedAt: string;
      }[],
      giantsGrown: {} as Record<string, number>,
      orders: [
        {
          slot: 0,
          items: [["wheat", 3]],
          leaves: 20,
          xp: 9,
          bonus: "super",
          who: "Tidefin's Kitchen",
          face: "tidefin",
          waitUntil: null,
        },
        {
          slot: 1,
          items: [["carrot", 4]],
          leaves: 30,
          xp: 16,
          bonus: null,
          who: "Bistro",
          face: "auralynx",
          waitUntil: null,
        },
        {
          slot: 2,
          items: null,
          leaves: null,
          xp: null,
          bonus: null,
          who: null,
          face: null,
          waitUntil: at(240),
        },
      ],
    };
    w.__farmRequests = [];
    w.__fakeFarm = farm;
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input);
      const json = (v: unknown) =>
        new Response(JSON.stringify(v), {
          headers: { "Content-Type": "application/json" },
        });
      if (url.endsWith("/api/farm")) {
        // Tests can change the farm as it is read, and slow the answer down.
        w.__farmGets = (w.__farmGets ?? 0) + 1;
        w.__onFarmGet?.();
        if (w.__farmDelay)
          await new Promise((r) => setTimeout(r, w.__farmDelay));
        return json({ ...farm, now: now() });
      }
      // Friends' farms (migration 047).
      if (url.endsWith("/api/farm/friends")) return json(w.__friends ?? []);
      // The Farm Stall (059), live visits and likes (061).
      if (url.endsWith("/api/farm/stall") && !init?.body)
        return json(
          w.__stall ?? {
            shelves: [],
            earnedToday: 0,
            boughtToday: 0,
            earnCap: 3000,
            buyCap: 10,
            paper: [],
          },
        );
      if (url.endsWith("/api/farm/stall")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push({ stall: body.kind, ...body });
        const st = w.__stall;
        if (body.kind === "list")
          st.shelves.push({
            slot: body.slot,
            crop: body.crop,
            mutation: body.mutation ?? "",
            qty: body.qty,
            price: body.price,
            sold: false,
            buyer: null,
            collect: null,
          });
        if (body.kind === "buy")
          st.paper = st.paper.filter(
            (p: any) => !(p.seller === body.seller && p.slot === body.slot),
          );
        return json({
          ...st,
          ok: true,
          gained:
            body.kind === "buy" ? { crop: "melon", qty: 2, price: 50 } : null,
        });
      }
      if (url.endsWith("/api/farm/here"))
        return json(
          w.__here ?? {
            owner: "me",
            present: [],
            party: false,
            partyLeft: 3600,
          },
        );
      if (url.endsWith("/api/farm/gone")) {
        w.__gones = (w.__gones ?? 0) + 1;
        return json({ ok: true });
      }
      if (url.endsWith("/api/farm/tour")) return json(w.__tour ?? []);
      if (url.endsWith("/api/farm/like"))
        return json({ ok: true, tour: w.__tour ?? [] });
      // The Supply Balloon and friends' help (migration 058).
      if (url.endsWith("/api/farm/balloon") && !init?.body) {
        if (w.__balloonDelay)
          await new Promise((r) => setTimeout(r, w.__balloonDelay));
        return json(
          w.__balloon ?? {
            crates: null,
            arrivesAt: null,
            launches: 0,
            leaves: null,
            xp: null,
            helperStars: 0,
            helperLeavesToday: 0,
            helperCap: 600,
            helpers: {},
          },
        );
      }
      if (url.endsWith("/api/farm/balloon")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push({ balloon: body.kind, slot: body.slot });
        const b = w.__balloon;
        if (body.kind === "launch") {
          const gained = { leaves: b.leaves, xp: b.xp, bonus: "gold" };
          Object.assign(b, {
            crates: null,
            arrivesAt: at(3600),
            launches: b.launches + 1,
          });
          return json({ balloon: b, ok: true, gained });
        }
        b.crates[body.slot].state = body.kind === "ask" ? "asked" : "done";
        return json({ balloon: b, ok: true });
      }
      if (url.endsWith("/api/farm/help") && !init?.body)
        return json(
          w.__help ?? {
            requests: [],
            helperStars: 0,
            helperLeavesToday: 0,
            helperCap: 600,
          },
        );
      if (url.endsWith("/api/farm/help")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push({ help: body.friend, slot: body.slot });
        w.__help.requests = w.__help.requests.filter(
          (r: any) => r.slot !== body.slot,
        );
        w.__help.helperStars++;
        return json({
          help: w.__help.requests,
          ok: true,
          gained: { leaves: 26, star: 1 },
        });
      }
      // Gifts, friendship days and invites (migration 057).
      if (url.endsWith("/api/farm/gifts"))
        return json(
          w.__gifts ?? {
            day: "2026-11-05",
            openedToday: 0,
            openCap: 20,
            friends: [],
            invites: {
              code: "AB12CD34",
              joined: 0,
              counted: 0,
              claimed: [],
              invitedBy: null,
            },
          },
        );
      if (
        url.endsWith("/api/farm/gifts/send") ||
        url.endsWith("/api/farm/gifts/open")
      ) {
        const body = JSON.parse(String(init?.body));
        const g = w.__gifts,
          f = g.friends.find((x: any) => x.id === body.friend);
        w.__farmRequests.push({
          gift: url.endsWith("send") ? "send" : "open",
          ...body,
        });
        if (url.endsWith("send")) {
          f.sent = true;
          return json({ ok: true, state: g });
        }
        f.waiting--;
        f.days++;
        g.openedToday++;
        return json({ ok: true, crop: "carrot", qty: 3, state: g });
      }
      if (url.endsWith("/api/farm/visit/act")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push(body);
        const v = w.__visit;
        const results = body.actions.map((a: any) => {
          const p = v.plots[a.plot];
          if (a.a === "sneak" && p.sneak) {
            p.sneak = false;
            return { ok: true, crop: p.crop, qty: 1, mutation: "" };
          }
          if (a.a === "catch" && p.pests) {
            p.pests--;
            return { ok: true, xp: 3 };
          }
          return { ok: false, error: "Not in this test" };
        });
        return json({ farm: { ...v, now: now() }, results, leaves: 1234 });
      }
      if (url.includes("/api/farm/visit/"))
        return json({ ...w.__visit, now: now() });
      if (url.endsWith("/api/farm/act")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push(body);
        const results = body.actions.map((a: any) => {
          const p = plots[a.plot];
          if (a.a === "harvest-giant") {
            const g = farm.giants.find((x) => x.plots.includes(a.plot));
            if (!g) return { ok: false, error: "No giant crop here" };
            for (const j of g.plots)
              Object.assign(plots[j], {
                crop: null,
                progress: 0,
                ripeAt: null,
                mutation: null,
                pests: 0,
              });
            farm.giants = farm.giants.filter((x) => x !== g);
            farm.giantsGrown[g.crop] = (farm.giantsGrown[g.crop] ?? 0) + 1;
            // A giant counts as 9 harvests in the crop book.
            (farm.harvests as Record<string, number>)[g.crop] =
              ((farm.harvests as Record<string, number>)[g.crop] ?? 0) + 9;
            farm.barn = [...farm.barn, { crop: g.crop, mutation: "", qty: 36 }];
            return { ok: true, giant: g.i, crop: g.crop, qty: 36, xp: 72 };
          }
          if (a.a === "harvest" && p?.crop && p.progress >= 1) {
            Object.assign(p, { crop: null, progress: 0, ripeAt: null });
            return { ok: true, crop: "wheat", qty: 2, xp: 3 };
          }
          if (a.a === "plant" && p && !p.crop) {
            Object.assign(p, { crop: a.crop, progress: 0, ripeAt: at(3600) });
            return { ok: true };
          }
          if (a.a === "catch" && p?.pests) {
            p.pests--;
            return { ok: true, caught: 1, xp: 1 };
          }
          // Decor (048) with storage (065): a stored copy places free, and
          // what it replaces, or what is put away, is stored.
          const store = (id: string) =>
            (farm.decorCredits[id] = (farm.decorCredits[id] ?? 0) + 1);
          // Anywhere on the farm (20261116120000), checked with the shared
          // rules the database mirrors.
          const R = w.__farm?.rules;
          const item = R?.FARM_DECOR.find((d: any) => d.id === a.item);
          if (a.a === "decor-place") {
            if (!item) return { ok: false, error: "Unknown decoration" };
            const free = (farm.decorCredits[a.item] ?? 0) > 0;
            if (!free && farm.level < item.level)
              return {
                ok: false,
                error: `Unlocks at farm level ${item.level}`,
              };
            if (farm.decor.length >= R.decorCap(farm.level))
              return {
                ok: false,
                error: `Your farm has room for ${R.decorCap(farm.level)} decorations`,
              };
            const why = R.decorFits(a.item, a.x, a.y, farm.decor);
            if (why) return { ok: false, error: why };
            if (!free && farm.leaves < item.price)
              return { ok: false, error: "Not enough Gold Leaves" };
            if (free && !--farm.decorCredits[a.item])
              delete farm.decorCredits[a.item];
            if (!free) farm.leaves -= item.price;
            const id = (w.__fakeDecorId = (w.__fakeDecorId ?? 100) + 1);
            farm.decor.push({
              id,
              item: a.item,
              x: a.x,
              y: a.y,
              flip: !!a.flip,
            });
            farm.charm += item.charm;
            return {
              ok: true,
              decor: a.item,
              piece: id,
              x: a.x,
              y: a.y,
              cost: free ? 0 : item.price,
            };
          }
          const piece = farm.decor.find((d: any) => d.id === a.piece);
          if (a.a === "decor-move") {
            if (!piece) return { ok: false, error: "Nothing there" };
            const why = R.decorFits(piece.item, a.x, a.y, farm.decor, piece.id);
            if (why) return { ok: false, error: why };
            Object.assign(piece, { x: a.x, y: a.y, flip: !!a.flip });
            return { ok: true, moved: piece.id, x: a.x, y: a.y };
          }
          if (a.a === "decor-store") {
            if (!piece) return { ok: false, error: "Nothing there" };
            farm.decor = farm.decor.filter((d: any) => d !== piece);
            farm.charm -= R.FARM_DECOR.find(
              (d: any) => d.id === piece.item,
            ).charm;
            farm.decorCredits[piece.item] =
              (farm.decorCredits[piece.item] ?? 0) + 1;
            return { ok: true, stored: piece.item, piece: piece.id };
          }
          if (a.a === "farmer") {
            farm.farmer = a.id;
            return { ok: true, farmer: a.id };
          }
          if (a.a === "perk" && farm.farmer === "voltkit") {
            farm.perksUsed = ["zap"];
            let cleared = 0;
            for (const q of plots) {
              cleared += q.pests;
              q.pests = 0;
            }
            return { ok: true, perk: "zap", cleared };
          }
          if (a.a === "shoo" && farm.crows[a.plot]) {
            delete farm.crows[a.plot];
            return { ok: true, shooed: true };
          }
          if (a.a === "hire-dog") {
            const price = { gold: [60, 150], black: [180, 450] } as any;
            farm.leaves -= price[a.dog][a.days === 3 ? 1 : 0];
            const extended = farm.dog?.type === a.dog;
            farm.dog = {
              type: a.dog,
              since: extended ? farm.dog.since : now(),
              until: at((extended ? 86400 : 0) + a.days * 86400),
            };
            return { ok: true, dog: a.dog, days: a.days, extended };
          }
          if (a.a === "buy-pasture" && !farm.pasture && farm.level >= 9) {
            farm.pasture = true;
            farm.milkAt = at(1200);
            farm.leaves -= 900;
            return { ok: true, pasture: true, milkAt: farm.milkAt };
          }
          if (a.a === "milk" && farm.pasture) {
            farm.milkAt = at(7200);
            farm.barn = [...farm.barn, { crop: "milk", mutation: "", qty: 2 }];
            return { ok: true, milk: 2, milkAt: farm.milkAt };
          }
          if (a.a === "sell-milk") {
            const m = farm.barn.find((b: any) => b.crop === "milk");
            if (!m || m.qty < a.qty)
              return { ok: false, error: "You don't have that many" };
            m.qty -= a.qty;
            const leaves = Math.round(60 * farm.milkMult) * a.qty;
            farm.leaves += leaves;
            return { ok: true, leaves };
          }
          // The Chicken Coop (20261117100000), with the shared rules.
          const barnQty = (crop: string) =>
            farm.barn.find((b: any) => b.crop === crop && b.mutation === "")
              ?.qty ?? 0;
          const addBarn = (crop: string, n: number) => {
            const b = farm.barn.find(
              (x: any) => x.crop === crop && x.mutation === "",
            );
            if (b) b.qty += n;
            else farm.barn = [...farm.barn, { crop, mutation: "", qty: n }];
          };
          if (a.a === "buy-coop") {
            if (farm.coop)
              return { ok: false, error: "You already have the coop" };
            if (farm.level < R.COOP.level)
              return {
                ok: false,
                error: `Unlocks at farm level ${R.COOP.level}`,
              };
            if (farm.leaves < R.COOP.price)
              return { ok: false, error: "Not enough Gold Leaves" };
            farm.leaves -= R.COOP.price;
            farm.coop = true;
            farm.hens = Array.from({ length: R.COOP.hens }, (_, i) => ({
              i,
              eggAt: null,
            }));
            return { ok: true, coop: true };
          }
          if (a.a === "sell-eggs") {
            if (barnQty("egg") < a.qty)
              return { ok: false, error: "You don't have that many" };
            addBarn("egg", -a.qty);
            const leaves = Math.round(30 * farm.eggMult) * a.qty;
            farm.leaves += leaves;
            return { ok: true, leaves };
          }
          if (["buy-hen", "feed-hen", "collect-egg"].includes(a.a)) {
            if (!farm.coop) return { ok: false, error: "Open the coop first" };
            if (a.a === "buy-hen") {
              const cost = R.henPrice(farm.hens.length);
              if (cost == null)
                return { ok: false, error: "Your coop is full" };
              if (farm.leaves < cost)
                return { ok: false, error: "Not enough Gold Leaves" };
              farm.leaves -= cost;
              const n = farm.hens.length;
              farm.hens = [...farm.hens, { i: n, eggAt: null }];
              return { ok: true, hen: n, cost };
            }
            const h = farm.hens.find((x: any) => x.i === a.hen);
            if (!h) return { ok: false, error: "Choose a hen" };
            const st = R.henState(h.eggAt, Date.now());
            if (a.a === "feed-hen") {
              if (st === "laying")
                return { ok: false, error: "This hen is already fed" };
              if (st === "egg")
                return { ok: false, error: "Collect her egg first" };
              if (barnQty(R.COOP.feedCrop) < R.COOP.feedQty)
                return { ok: false, error: "You need 2 Breeze Wheat" };
              addBarn(R.COOP.feedCrop, -R.COOP.feedQty);
              h.eggAt = at(R.COOP.laySeconds);
              return { ok: true, fed: h.i, eggAt: h.eggAt };
            }
            if (st === "hungry")
              return { ok: false, error: "Feed this hen first" };
            if (st === "laying")
              return { ok: false, error: "This hen is still laying" };
            addBarn("egg", 1);
            h.eggAt = null;
            return { ok: true, egg: 1, hen: h.i };
          }
          if (a.a === "buy-tool" && a.tool === "net2") {
            farm.tools.bigNet = true;
            farm.leaves -= 700;
            return { ok: true, tool: "net2", cost: 700 };
          }
          return { ok: false, error: "Not in this test" };
        });
        return json({ farm: { ...farm, now: now() }, results });
      }
      if (url.endsWith("/api/farm/wish")) {
        w.__farmRequests.push({ wish: true });
        farm.wishReady = false;
        farm.seeds = { ...farm.seeds, mint: 1, voltberry: 2 };
        return json({
          farm: { ...farm, now: now() },
          ok: true,
          seeds: ["mint", "voltberry", "voltberry"],
        });
      }
      if (url.endsWith("/api/farm/order")) {
        const body = JSON.parse(String(init?.body));
        w.__farmRequests.push(body);
        const o = farm.orders[body.slot];
        const gained = {
          leaves: o.leaves,
          xp: o.xp,
          bonus: o.bonus,
          who: o.who,
        };
        farm.orders[body.slot] = {
          ...o,
          items: null,
          waitUntil: at(body.kind === "deliver" ? 4800 : 300),
        };
        if (body.kind === "deliver") {
          farm.barn = [{ crop: "wheat", mutation: "", qty: 1 }];
          farm.leaves += gained.leaves;
        }
        return json({
          farm: { ...farm, now: now() },
          ok: true,
          gained: body.kind === "deliver" ? gained : null,
        });
      }
      const response = await fetch(input, init);
      if (!url.includes("/api/economy")) return response;
      const body = await response.json();
      return json({
        ...body,
        leaves: {
          balance: 1234,
          tradedToday: 0,
          tradeCap: 60,
          tradeLeaves: 100,
          tradeCoins: 5,
        },
      });
    };
  });
}
