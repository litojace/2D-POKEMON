import type {
  PlazaProgress,
  PlazaRecord,
} from "../../../packages/shared/src/plaza.js";
import {
  RAID_COSMETICS,
  RAID_SLOTS,
  type RaidCosmetic,
  type RaidProgress,
  type RaidReceipt,
} from "../../../packages/shared/src/raid.js";
import { z } from "zod";
import {
  characterSchema,
  FIGHTER_IDS,
} from "../../../packages/shared/src/index.js";
import {
  DAILY_MISSION_COUNT,
  LOOK_ITEM_BY_ID,
  type ActivityReceipt,
} from "../../../packages/shared/src/shop.js";
import { JOURNEY_ITEM_BY_ID } from "../../../packages/shared/src/journey.js";
import {
  MAX_SIZE as BISTRO_MAX_SIZE,
  MAX_STOVES as BISTRO_MAX_STOVES,
} from "../../../packages/shared/src/bistro.js";
import { createClient } from "@supabase/supabase-js";
import {
  buildFriendsBoard,
  buildRecentPlayers,
  RECENT_DAYS,
  RECENT_MATCHES,
  seasonBounds,
  seasonOf,
  supabaseSocialStore,
  type SocialStore,
} from "./social.js";
import type { Express, Request, Response, NextFunction } from "express";
import {
  accountSchema,
  suspendSchema,
  deletePlayerSchema,
  deleteTitleSchema,
  reportSchema,
  resolveReportSchema,
  titleUpdateSchema,
  titleGrantSchema,
  equipTitleSchema,
  nameChangeSchema,
  matchReportSchema,
  friendsSchema,
  friendRequestSchema,
  friendRespondSchema,
  friendRemoveSchema,
  ratingSchema,
  type Friend,
  type Account,
  type MatchSummary,
  type OnlineList,
} from "../../../packages/shared/src/accounts.js";
/** The newest database migration the server expects. */
export const LATEST_MIGRATION = "106_bistro_fast_catch_up.sql";
/** The migration that last redefined the raid appearance functions. */
export const RAID_FUNCTIONS_MIGRATION = "018_collection_equipping.sql";
export interface AccountProvider {
  recordRaid?(receipt: RaidReceipt): Promise<void>;
  /** Coins, missions and Mythic progress after a real match or raid. */
  recordActivity?(receipt: ActivityReceipt): Promise<void>;
  /** Something the game server saw in the Plaza (quests, orbs, laps); returns the player's progress. */
  recordPlaza?(event: PlazaRecord): Promise<PlazaProgress | null>;
  authenticate(token: string): Promise<Account | null>;
  /** Read-only rows for friends' ratings and recent players (step 6). */
  social?: SocialStore;
  rpc(
    token: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;
}
export class AccountError extends Error {
  constructor(
    public status: number,
    message: string,
    /** What went wrong, for the server's log only (not shown to players). */
    public detail?: string,
    /** Already written to the log (by rpc()). */
    public logged = false,
  ) {
    super(message);
  }
}
/** SQLSTATE classes where the database itself failed, not the request:
 * resources (53), a cancelled or timed-out statement (57: 57014), lost
 * connections (08), serialization failures and deadlocks (40), system and
 * internal errors (58, XX). */
const DB_FAILED = /^(53|57|08|40|58|XX)/;
/**
 * A failed RPC as the API's error. The rules' own refusals (a plpgsql
 * `raise exception`, PostgREST's 4xx) stay 400 (or 403) with their message;
 * a failure of the database itself (a timeout, a lost connection, PostgREST
 * answering 5xx, Supabase unreachable) is a 503 the player can retry, its
 * reason in `detail` for the log.
 */
export function rpcError(
  name: string,
  error: {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  },
  status?: number,
): AccountError {
  const code = error.code ?? "";
  const reason = [
    code || (status ? `HTTP ${status}` : "no answer"),
    error.message,
    error.details,
    error.hint,
  ]
    .filter(Boolean)
    .join(" · ");
  // PGRST202: the function isn't in the database (a migration wasn't run).
  if (code === "PGRST202")
    return new AccountError(
      503,
      `The database needs an update (missing ${name}). In Supabase's SQL Editor, run the files in supabase/migrations you haven't run yet, newest last (${LATEST_MIGRATION}).`,
      `${name}: ${reason}`,
    );
  if ((status ?? 0) >= 500 || DB_FAILED.test(code) || (!code && !status))
    return new AccountError(
      503,
      "The server is busy right now. Please try again in a moment.",
      `${name}: ${reason}`,
    );
  return new AccountError(
    code === "42501" ? 403 : 400,
    error.message || "Request refused.",
  );
}
export function createAccountProvider(): AccountProvider {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_ANON_KEY;
  const client = (token: string) => {
    if (!url || !key)
      throw new AccountError(503, "Accounts are not configured yet.");
    return createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  };
  return {
    social: supabaseSocialStore(),
    async recordRaid(receipt) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey)
        throw new AccountError(
          503,
          "Raid rewards require server storage configuration.",
        );
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const result = await admin.rpc("arena_record_raid", {
        p_receipt: receipt,
      });
      if (result.error)
        throw new AccountError(503, "Raid rewards could not be stored.");
    },
    async recordPlaza(event) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey)
        throw new AccountError(
          503,
          "Plaza rewards require server storage configuration.",
        );
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const result = await admin.rpc("arena_plaza_record", { p: event });
      if (result.error)
        throw new AccountError(503, "Plaza rewards could not be stored.");
      return (result.data as PlazaProgress | null) ?? null;
    },
    async recordActivity(receipt) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey)
        throw new AccountError(
          503,
          "Coins require server storage configuration.",
        );
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const result = await admin.rpc("arena_record_activity", { p: receipt });
      if (result.error)
        throw new AccountError(503, "Coins and missions could not be stored.");
    },
    async authenticate(token) {
      const scoped = client(token);
      const { data, error } = await scoped.auth.getUser(token);
      if (error || !data.user) return null;
      const result = await scoped.rpc("arena_me");
      if (result.error)
        throw new AccountError(
          503,
          "Account storage is unavailable. Check the Supabase migration.",
        );
      return accountSchema.parse(result.data);
    },
    async rpc(token, name, args) {
      const request = client(token).rpc(name, args);
      const result = await (name === "arena_touch_presence"
        ? request.abortSignal(AbortSignal.timeout(8000))
        : request);
      if (result.error) {
        const error = rpcError(name, result.error, result.status);
        // A failure of the database itself goes to the log here, whichever
        // route (HTTP or socket) called: players only see "try again".
        if (error.status >= 500) {
          console.error(`[db] rpc ${error.detail ?? name}`);
          error.logged = true;
        }
        throw error;
      }
      return result.data;
    },
  };
}
export async function authorize(
  provider: AccountProvider,
  token: unknown,
  admin = false,
): Promise<Account> {
  if (typeof token !== "string" || !token || token.length > 4096)
    throw new AccountError(401, "Please log in to play.");
  const account = await provider.authenticate(token);
  if (!account)
    throw new AccountError(401, "Your login expired. Please sign in again.");
  if (account.suspended)
    throw new AccountError(403, "This game account is suspended.");
  if (admin && !account.isAdmin)
    throw new AccountError(403, "Admin access is required.");
  return account;
}
export function installAccountRoutes(
  app: Express,
  provider: AccountProvider,
  onPlayerChanged: (id: string) => void,
  listOnline: () => OnlineList = () => ({
    players: [],
    guests: 0,
    at: new Date().toISOString(),
  }),
  /** A finished match's summary, if this account played in it. */
  finishedMatch: (
    matchId: string,
    accountId: string,
  ) => MatchSummary | undefined = () => undefined,
  /** Live presence for a friend (online, what they're doing, their room). */
  presence: (accountId: string) => Partial<Friend> = () => ({ online: false }),
  /** Tell a player's open games that their friends list changed. */
  onFriendsChanged: (accountId: string) => void = () => {},
) {
  const requests = new Map<string, { count: number; until: number }>();
  app.use("/api", (req, res, next) => {
    if (req.path === "/health") return next();
    const origin = req.get("origin");
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {}
      if (
        originHost !== req.get("host") &&
        origin !== process.env.CLIENT_ORIGIN
      )
        return res.status(403).json({ error: "This origin is not allowed." });
    }
    const key = req.ip ?? "unknown",
      now = Date.now();
    for (const [id, limit] of requests)
      if (limit.until < now) requests.delete(id);
    const limit = requests.get(key) ?? { count: 0, until: now + 60000 };
    limit.count++;
    requests.set(key, limit);
    if (limit.count > 120)
      return res
        .status(429)
        .json({ error: "Too many account requests. Try again shortly." });
    next();
  });
  const route =
    (
      admin: boolean,
      action: (
        req: Request,
        res: Response,
        token: string,
        account: Account,
      ) => Promise<void>,
    ) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const header = req.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        const account = await authorize(provider, token, admin);
        await action(req, res, token, account);
      } catch (error) {
        next(error);
      }
    };
  app.get(
    "/api/account",
    route(false, async (_req, res, _token, account) => {
      res.json(account);
    }),
  );
  app.post(
    "/api/account/title",
    route(false, async (req, res, token, account) => {
      const data = equipTitleSchema.parse(req.body);
      await provider.rpc(token, "arena_equip_title", {
        p_title_id: data.titleId,
      });
      onPlayerChanged(account.id);
      res.json({ ok: true });
    }),
  );
  // Your name: when you can next change it, and the change itself
  // (migration 066; the database owns the 14 days and the checks).
  app.get(
    "/api/account/name",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_name_status", {}));
    }),
  );
  app.post(
    "/api/account/name",
    route(false, async (req, res, token, account) => {
      const { name } = nameChangeSchema.parse(req.body);
      const result = await provider.rpc(token, "arena_change_name", {
        p_name: name,
      });
      // Your open games (a room, the Plaza) show the new name.
      onPlayerChanged(account.id);
      res.json(result);
    }),
  );
  // Report a finished match for your records. The summary comes from the
  // game server's own copy, never from the browser.
  app.post(
    "/api/matches/report",
    route(false, async (req, res, token, account) => {
      const { matchId } = matchReportSchema.parse(req.body);
      const summary = finishedMatch(matchId, account.id);
      if (!summary)
        throw new AccountError(404, "That match is no longer available.");
      const result = await provider.rpc(token, "arena_report_match", {
        p_match_id: matchId,
        p_summary: summary,
      });
      if (
        result &&
        typeof result === "object" &&
        ((result as { achievements?: unknown[] }).achievements?.length ?? 0) > 0
      )
        onPlayerChanged(account.id);
      res.json(result);
    }),
  );
  app.get(
    "/api/friends",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      const list = friendsSchema.parse(
        await provider.rpc(token, "arena_friends", {}),
      );
      list.friends = list.friends
        .map((f) => {
          const live = presence(f.id);
          return {
            ...f,
            ...live,
            // A local reconnect cache must not replace newer saved history.
            ...(f.lastOnline &&
            (!live.lastOnline ||
              Date.parse(f.lastOnline) > Date.parse(live.lastOnline))
              ? { lastOnline: f.lastOnline }
              : {}),
          };
        })
        .sort(
          (a, b) =>
            Number(!!b.online) - Number(!!a.online) ||
            a.name.localeCompare(b.name),
        );
      res.json(list);
    }),
  );
  app.post(
    "/api/friends/request",
    route(false, async (req, res, token) => {
      const data = friendRequestSchema.parse(req.body);
      const result = await provider.rpc(token, "arena_friend_request", {
        p_code: data.code ?? null,
        p_player: data.playerId ?? null,
      });
      // Let the other player's open game know (by id, when we have it).
      if (data.playerId) onFriendsChanged(data.playerId);
      else friendsChangedByCode(data.code!);
      res.json({ result });
    }),
  );
  app.post(
    "/api/friends/respond",
    route(false, async (req, res, token) => {
      const data = friendRespondSchema.parse(req.body);
      await provider.rpc(token, "arena_friend_respond", {
        p_from: data.playerId,
        p_accept: data.accept,
      });
      onFriendsChanged(data.playerId);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/friends/remove",
    route(false, async (req, res, token) => {
      const data = friendRemoveSchema.parse(req.body);
      await provider.rpc(token, "arena_friend_remove", {
        p_player: data.playerId,
      });
      onFriendsChanged(data.playerId);
      res.json({ ok: true });
    }),
  );
  /** Requests by code: tell whichever online player owns that code. */
  function friendsChangedByCode(code: string) {
    onFriendsChanged(`code:${code.toUpperCase()}`);
  }
  // The Shop: balance, catalog ownership, missions and equipped skins.
  app.get(
    "/api/economy",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_economy", {}));
    }),
  );
  app.post(
    "/api/shop/buy",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          item: z
            .string()
            .min(1)
            .max(64)
            .regex(/^[a-z0-9-]+$/),
        })
        .strict()
        .parse(req.body);
      const economy = await provider.rpc(token, "arena_buy_item", {
        p_item: data.item,
      });
      onPlayerChanged(account.id);
      res.json({ ok: true, economy });
    }),
  );
  // Gold Leaves: 100 leaves → 5 coins, up to 40 coins a day (migration 036).
  app.post(
    "/api/leaves/trade",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({ lots: z.number().int().min(1).max(8) })
        .strict()
        .parse(req.body);
      const economy = await provider.rpc(token, "arena_trade_leaves", {
        p_lots: data.lots,
      });
      onPlayerChanged(account.id);
      res.json({ ok: true, economy });
    }),
  );
  // The Plaza (migration 038): today's quests and the TOP DASH board.
  app.get(
    "/api/plaza",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_plaza", {}));
    }),
  );
  // The farm (migration 037): its state at the server's time, and actions.
  app.get(
    "/api/farm",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_farm", {}));
    }),
  );
  const farmAction = z
    .object({
      a: z.enum([
        "plant",
        "water",
        "fertilize",
        "harvest",
        "dig",
        "buy-seeds",
        "buy-land",
        "sell",
        "buy-fertilizer",
        "upgrade-barn",
        "catch",
        "buy-tool",
        "hire-dog",
        "shoo",
        "farmer",
        "perk",
        "decor",
        "decor-remove",
        "buy-pasture",
        "milk",
        "sell-milk",
        "harvest-giant",
      ]),
      plot: z.number().int().min(0).max(49).optional(),
      slot: z.number().int().min(0).max(7).optional(),
      item: z
        .string()
        .max(32)
        .regex(/^[a-z0-9]+$/)
        .optional(),
      tool: z
        .enum([
          "net",
          "sickle",
          "scarecrow",
          "can2",
          "net2",
          "can3",
          "sprinkler",
        ])
        .optional(),
      dog: z.enum(["gold", "black", "cream"]).optional(),
      // A farmer: any champion in the roster, by its exact id (it was the
      // first eight only).
      id: z.enum(FIGHTER_IDS).optional(),
      days: z.union([z.literal(1), z.literal(3)]).optional(),
      crop: z
        .string()
        .max(32)
        .regex(/^[a-z]+$/)
        .optional(),
      kind: z.enum(["norm", "super", "gold"]).optional(),
      mutation: z
        .string()
        .max(64)
        .regex(/^[a-z+]*$/)
        .optional(),
      qty: z.number().int().min(1).max(10000).optional(),
    })
    .strict();
  // Crop mastery: buy a crop's next star (migration 043).
  app.post(
    "/api/farm/master",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          request: z.string().uuid(),
          crop: z
            .string()
            .max(32)
            .regex(/^[a-z]+$/),
        })
        .strict()
        .parse(req.body);
      const result = await provider.rpc(token, "arena_farm_master", {
        p_request: data.request,
        p_crop: data.crop,
      });
      onPlayerChanged(account.id);
      res.json(result);
    }),
  );
  // The wishing well: 3 seeds once a Pacific day (migration 042).
  app.post(
    "/api/farm/wish",
    route(false, async (_req, res, token) => {
      res.json(await provider.rpc(token, "arena_farm_wish", {}));
    }),
  );
  // Deliver or skip an order on the farm's board (migration 040).
  app.post(
    "/api/farm/order",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          request: z.string().uuid(),
          slot: z.number().int().min(0).max(2),
          kind: z.enum(["deliver", "skip"]),
        })
        .strict()
        .parse(req.body);
      const result = await provider.rpc(token, "arena_farm_order", {
        p_request: data.request,
        p_slot: data.slot,
        p_kind: data.kind,
      });
      onPlayerChanged(account.id);
      res.json(result);
    }),
  );
  app.post(
    "/api/farm/act",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          request: z.string().uuid(),
          actions: z.array(farmAction).min(1).max(60),
        })
        .strict()
        .parse(req.body);
      const result = await provider.rpc(token, "arena_farm_act", {
        p_request: data.request,
        p_actions: data.actions,
      });
      // Selling and buying change the leaf wallet shown in the top bar.
      if (
        data.actions.some(
          (x) => !["water", "harvest", "harvest-giant"].includes(x.a),
        )
      )
        onPlayerChanged(account.id);
      res.json(result);
    }),
  );
  // Friends' farms (migration 047): the list, a visit, and helping or
  // sneaking there.
  app.get(
    "/api/farm/friends",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_farm_friends", {}));
    }),
  );
  app.get(
    "/api/farm/visit/:id",
    route(false, async (req, res, token) => {
      const friend = z.string().uuid().parse(req.params.id);
      res.setHeader("Cache-Control", "no-store");
      res.json(
        await provider.rpc(token, "arena_farm_friend", { p_friend: friend }),
      );
    }),
  );
  app.post(
    "/api/farm/visit/act",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          request: z.string().uuid(),
          friend: z.string().uuid(),
          actions: z
            .array(
              z
                .object({
                  a: z.enum(["water", "catch", "sneak", "prank"]),
                  plot: z.number().int().min(0).max(49),
                })
                .strict(),
            )
            .min(1)
            .max(30),
        })
        .strict()
        .parse(req.body);
      const result = await provider.rpc(token, "arena_farm_friend_act", {
        p_request: data.request,
        p_friend: data.friend,
        p_actions: data.actions,
      });
      // A dog's fine changes both wallets.
      onPlayerChanged(account.id);
      onPlayerChanged(data.friend);
      res.json(result);
    }),
  );
  // The Element Bistro (migration 068): its state at the server's time,
  // actions, and friends' bistros.
  const bistroId = z
    .string()
    .max(32)
    .regex(/^[a-z]+$/);
  const bistroAction = z
    .object({
      a: z.enum([
        "cook",
        "stir",
        "plate",
        "serve",
        "leave",
        "place",
        "store",
        "buy",
        "style",
        "stove",
        "kitchen",
        "shift",
        "expand",
        "hire",
        "train",
        "cookdish",
        "chef",
        "trade",
        "feed",
        "sweep",
        "dishup",
        "market",
        "farm",
        "order",
        "skip",
        "regular",
        "league",
        "branch",
        // Stoves from the Shop (migration 103).
        "stovebuy",
        "stoveplace",
        "stovemove",
        "sync",
      ]),
      stove: z
        .number()
        .int()
        .min(0)
        .max(BISTRO_MAX_STOVES - 1)
        .optional(),
      model: z.enum(["clay", "steel", "dragon"]).optional(),
      dish: bistroId.optional(),
      vip: z.boolean().optional(),
      combo: z.number().int().min(1).max(5).optional(),
      hearts: z.number().int().min(1).max(3).optional(),
      quick: z.boolean().optional(),
      kind: bistroId.optional(),
      id: z
        .union([
          z.number().int().min(1).max(100000),
          z.enum(FIGHTER_IDS),
          bistroId,
        ])
        .optional(),
      // Anywhere on the biggest floor (the room grows with expansions).
      x: z
        .number()
        .int()
        .min(0)
        .max(BISTRO_MAX_SIZE.cols - 1)
        .optional(),
      y: z
        .number()
        .int()
        .min(0)
        .max(BISTRO_MAX_SIZE.rows - 1)
        .optional(),
      rot: z.number().int().min(0).max(3).optional(),
      role: z.enum(["cook", "waiter", "janitor"]).optional(),
      // Hiring a friend (migration 073): their account id.
      friend: z.string().uuid().optional(),
      char: z.enum(FIGHTER_IDS).optional(),
      lots: z.number().int().min(1).max(15).optional(),
      // Market buys and Farm crops (migration 074).
      qty: z.number().int().min(1).max(30).optional(),
      // Catering orders (migration 100).
      slot: z.number().int().min(0).max(3).optional(),
    })
    .strict();
  app.get(
    "/api/bistro",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_bistro", {}));
    }),
  );
  app.post(
    "/api/bistro/act",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          request: z.string().uuid(),
          actions: z.array(bistroAction).min(1).max(40),
        })
        .strict()
        .parse(req.body);
      const result = await provider.rpc(token, "arena_bistro_act", {
        p_request: data.request,
        p_actions: data.actions,
      });
      // A trade changes the leaf wallet; Farm crops leave the barn.
      if (data.actions.some((x) => x.a === "trade" || x.a === "farm"))
        onPlayerChanged(account.id);
      res.json(result);
    }),
  );
  app.get(
    "/api/bistro/friends",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_bistro_friends", {}));
    }),
  );
  app.get(
    "/api/bistro/visit/:id",
    route(false, async (req, res, token) => {
      const friend = z.string().uuid().parse(req.params.id);
      res.setHeader("Cache-Control", "no-store");
      res.json(
        await provider.rpc(token, "arena_bistro_friend", { p_friend: friend }),
      );
    }),
  );
  app.post(
    "/api/bistro/visit/act",
    route(false, async (req, res, token) => {
      const data = z
        .object({
          request: z.string().uuid(),
          friend: z.string().uuid(),
          kind: z.enum(["dine", "like"]),
        })
        .strict()
        .parse(req.body);
      res.json(
        await provider.rpc(token, "arena_bistro_friend_act", {
          p_request: data.request,
          p_friend: data.friend,
          p_kind: data.kind,
        }),
      );
    }),
  );
  // Farm gifts, friendship days and farm invites (migration 057).
  app.get(
    "/api/farm/gifts",
    route(false, async (_req, res, token, account) => {
      res.setHeader("Cache-Control", "no-store");
      const result = await provider.rpc(token, "arena_farm_gifts", {});
      // Invite rewards may have just been paid.
      onPlayerChanged(account.id);
      res.json(result);
    }),
  );
  const friendBody = z.object({ friend: z.string().uuid() }).strict();
  app.post(
    "/api/farm/gifts/send",
    route(false, async (req, res, token) => {
      const { friend } = friendBody.parse(req.body);
      res.json(
        await provider.rpc(token, "arena_farm_gift_send", { p_friend: friend }),
      );
    }),
  );
  app.post(
    "/api/farm/gifts/open",
    route(false, async (req, res, token) => {
      const { friend } = friendBody.parse(req.body);
      res.json(
        await provider.rpc(token, "arena_farm_gift_open", { p_friend: friend }),
      );
    }),
  );
  // The Supply Balloon and friends' help (migration 058).
  app.get(
    "/api/farm/balloon",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_farm_balloon", {}));
    }),
  );
  app.post(
    "/api/farm/balloon",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          request: z.string().uuid(),
          kind: z.enum(["fill", "ask", "launch"]),
          slot: z.number().int().min(0).max(5).optional(),
        })
        .strict()
        .parse(req.body);
      const result = await provider.rpc(token, "arena_farm_balloon_act", {
        p_request: data.request,
        p_kind: data.kind,
        p_slot: data.slot ?? null,
      });
      if (data.kind === "launch") onPlayerChanged(account.id);
      res.json(result);
    }),
  );
  app.get(
    "/api/farm/help",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_farm_help_list", {}));
    }),
  );
  app.post(
    "/api/farm/help",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          request: z.string().uuid(),
          friend: z.string().uuid(),
          slot: z.number().int().min(0).max(5),
        })
        .strict()
        .parse(req.body);
      const result = await provider.rpc(token, "arena_farm_help_fill", {
        p_request: data.request,
        p_friend: data.friend,
        p_slot: data.slot,
      });
      onPlayerChanged(account.id);
      res.json(result);
    }),
  );
  // The Farm Stall and the Valley Paper (migration 059).
  app.get(
    "/api/farm/stall",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_farm_stall", {}));
    }),
  );
  app.post(
    "/api/farm/stall",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          request: z.string().uuid(),
          kind: z.enum(["list", "unlist", "collect", "buy"]),
          slot: z.number().int().min(0).max(5),
          crop: z
            .string()
            .max(32)
            .regex(/^[a-z]+$/)
            .optional(),
          mutation: z
            .string()
            .max(64)
            .regex(/^[a-z+]*$/)
            .optional(),
          qty: z.number().int().min(1).max(10).optional(),
          price: z.number().int().min(1).max(100000).optional(),
          seller: z.string().uuid().optional(),
        })
        .strict()
        .parse(req.body);
      const result = await provider.rpc(token, "arena_farm_stall_act", {
        p_request: data.request,
        p_kind: data.kind,
        p_slot: data.slot,
        p_crop: data.crop ?? null,
        p_mutation: data.mutation ?? null,
        p_qty: data.qty ?? null,
        p_price: data.price ?? null,
        p_seller: data.seller ?? null,
      });
      if (data.kind === "collect" || data.kind === "buy")
        onPlayerChanged(account.id);
      if (data.seller) onPlayerChanged(data.seller);
      res.json(result);
    }),
  );
  // Live visits, Harvest Parties and farm likes (migration 061).
  app.post(
    "/api/farm/here",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          owner: z.string().uuid().optional(),
          emote: z.enum(["wave", "heart", "party", "laugh"]).optional(),
        })
        .strict()
        .parse(req.body);
      res.json(
        await provider.rpc(token, "arena_farm_here", {
          p_owner: data.owner ?? account.id,
          p_emote: data.emote ?? null,
        }),
      );
    }),
  );
  app.post(
    "/api/farm/gone",
    route(false, async (_req, res, token) => {
      await provider.rpc(token, "arena_farm_gone", {});
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/farm/tour",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_farm_tour", {}));
    }),
  );
  app.post(
    "/api/farm/like",
    route(false, async (req, res, token) => {
      const { owner } = z
        .object({ owner: z.string().uuid() })
        .strict()
        .parse(req.body);
      res.json(
        await provider.rpc(token, "arena_farm_like", { p_owner: owner }),
      );
    }),
  );
  app.post(
    "/api/farm/invite",
    route(false, async (req, res, token, account) => {
      const { code } = z
        .object({ code: z.string().regex(/^[0-9A-Fa-f]{8}$/) })
        .strict()
        .parse(req.body);
      const result = (await provider.rpc(token, "arena_farm_invite_claim", {
        p_code: code,
      })) as { ok?: boolean };
      if (result?.ok) onFriendsChanged(account.id);
      res.json(result);
    }),
  );
  app.post(
    "/api/shop/equip",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({
          champion: characterSchema,
          skin: z
            .string()
            .min(1)
            .max(64)
            .regex(/^[a-z0-9-]+$/)
            .nullable(),
          stage: z.number().int().min(1).max(3).default(1),
        })
        .strict()
        .parse(req.body);
      const economy = await provider.rpc(token, "arena_equip_champion_skin", {
        p_champion: data.champion,
        p_skin: data.skin,
        p_stage: data.stage,
      });
      onPlayerChanged(account.id);
      res.json({ ok: true, economy });
    }),
  );
  app.post(
    "/api/missions/reroll",
    route(false, async (req, res, token) => {
      const data = z
        .object({
          slot: z
            .number()
            .int()
            .min(0)
            .max(DAILY_MISSION_COUNT - 1),
        })
        .strict()
        .parse(req.body);
      res.json({
        ok: true,
        economy: await provider.rpc(token, "arena_reroll_mission", {
          p_slot: data.slot,
        }),
      });
    }),
  );
  app.get(
    "/api/raids",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_raid_progress", {}));
    }),
  );
  app.post(
    "/api/raids/cosmetic",
    route(false, async (req, res, token, account) => {
      const data = z
        .object({ cosmetic: z.enum(["cragbound", "mountain-aura"]).nullable() })
        .strict()
        .parse(req.body);
      await provider.rpc(token, "arena_equip_raid_cosmetic", {
        p_cosmetic: data.cosmetic,
      });
      onPlayerChanged(account.id);
      res.json({ ok: true });
    }),
  );
  // One item per slot (skin, aura, entrance, frame; victory from migration 009).
  app.post(
    "/api/raids/equip",
    route(false, async (req, res, token, account) => {
      // Raid rewards, Shop collection pieces and Journey rewards share the
      // appearance slots. The database checks the player owns the item.
      const slotOf = (id: string) =>
        RAID_COSMETICS[id as RaidCosmetic]?.slot ??
        LOOK_ITEM_BY_ID[id]?.slot ??
        JOURNEY_ITEM_BY_ID[id]?.slot;
      const data: { slot: (typeof RAID_SLOTS)[number]; item: string | null } = z
        .object({
          slot: z.enum(
            RAID_SLOTS as [(typeof RAID_SLOTS)[number], ...typeof RAID_SLOTS],
          ),
          item: z
            .string()
            .max(64)
            .refine((id: string) => !!slotOf(id), "Unknown item.")
            .nullable(),
        })
        .strict()
        .parse(req.body);
      if (data.item && slotOf(data.item) !== data.slot)
        throw new AccountError(400, "That item belongs in another slot.");
      try {
        await provider.rpc(token, "arena_equip_raid_slot", {
          p_slot: data.slot,
          p_item: data.item,
        });
      } catch (error) {
        // The request's slot was already checked against the current catalog.
        // Older raid functions reject owned Shop pieces as if the slot were wrong.
        if (
          data.item &&
          LOOK_ITEM_BY_ID[data.item] &&
          error instanceof AccountError &&
          /belongs in another slot|Unknown cosmetic/.test(error.message)
        )
          throw new AccountError(
            503,
            `Shop appearance support needs a database update. Run supabase/migrations/${RAID_FUNCTIONS_MIGRATION} in Supabase's SQL Editor, then try equipping again.`,
          );
        throw error;
      }
      // Read it back: only report success if the database really kept it.
      const progress = (await provider.rpc(
        token,
        "arena_raid_progress",
        {},
      )) as RaidProgress;
      if (
        !progress?.loadout ||
        (progress.loadout[data.slot] ?? null) !== data.item
      )
        throw new AccountError(
          503,
          `Your appearance couldn't be kept: the database's raid functions are out of date. In Supabase's SQL Editor, run supabase/migrations/${RAID_FUNCTIONS_MIGRATION}, then try again.`,
        );
      onPlayerChanged(account.id);
      res.json({ ok: true, progress });
    }),
  );
  app.get(
    "/api/progress",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      const progress = (await provider.rpc(
        token,
        "arena_my_progress",
        {},
      )) as Record<string, unknown>;
      // Rating and rank (migration 006); progress still loads without it.
      try {
        progress.rating = await provider.rpc(token, "arena_my_rating", {});
      } catch {
        /* ratings not set up yet */
      }
      res.json(progress);
    }),
  );
  app.get(
    "/api/leaderboard",
    route(false, async (req, res, token) => {
      const season =
        typeof req.query.season === "string" &&
        /^\d{4}-\d{2}$/.test(req.query.season)
          ? req.query.season
          : null;
      res.setHeader("Cache-Control", "no-store");
      res.json(
        await provider.rpc(token, "arena_leaderboard", { p_season: season }),
      );
    }),
  );
  /** Read-only rows for the two social views, or a plain 503. */
  const socialStore = () => {
    if (!provider.social)
      throw new AccountError(
        503,
        "Friends' ratings and recent players need server storage configuration.",
      );
    return provider.social;
  };
  // Ranks › Friends: you and your friends ranked among yourselves (step 6).
  app.get(
    "/api/leaderboard/friends",
    route(false, async (_req, res, token, account) => {
      res.setHeader("Cache-Control", "no-store");
      const store = socialStore();
      const list = friendsSchema.parse(
        await provider.rpc(token, "arena_friends", {}),
      );
      // Your own rating card, exactly as the Everyone board shows it.
      let rating;
      try {
        rating = ratingSchema.parse(
          await provider.rpc(token, "arena_my_rating", {}),
        );
      } catch {
        /* ratings not set up yet */
      }
      const friends = list.friends.slice(0, 500);
      const ids = [account.id, ...friends.map((f) => f.id)];
      const season = seasonOf(Date.now());
      const { from, to } = seasonBounds(season);
      const [ratings, top, month] = await Promise.all([
        store.ratings(ids),
        store.topRated(),
        store.monthResults(ids, from, to),
      ]);
      res.json(
        buildFriendsBoard({
          me: {
            id: account.id,
            name: account.displayName,
            title: account.title,
            titleColor: account.titleColor,
          },
          friends,
          ratings,
          top,
          month,
          season,
          rating,
        }),
      );
    }),
  );
  // Friends › Recent: the players in your latest matches (step 6).
  app.get(
    "/api/friends/recent",
    route(false, async (_req, res, token, account) => {
      res.setHeader("Cache-Control", "no-store");
      const store = socialStore();
      const list = friendsSchema.parse(
        await provider.rpc(token, "arena_friends", {}),
      );
      const since = new Date(
        Date.now() - RECENT_DAYS * 86_400_000,
      ).toISOString();
      const mine = (await store.myMatches(account.id, since))
        .sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at))
        .slice(0, RECENT_MATCHES);
      const others = await store.matchPlayers(
        mine.map((m) => m.match_id),
        account.id,
      );
      const profiles = await store.profiles([
        ...new Set(others.map((o) => o.player_id)),
      ]);
      res.json({
        players: buildRecentPlayers({
          mine,
          others,
          profiles,
          friends: list,
          presence,
        }),
      });
    }),
  );
  app.get(
    "/api/admin/players",
    route(true, async (req, res, token) => {
      const search =
        typeof req.query.search === "string"
          ? req.query.search.slice(0, 80)
          : "";
      const offset = Number(req.query.offset ?? 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
        throw new AccountError(400, "Invalid page.");
      res.json(
        await provider.rpc(token, "arena_admin_players", {
          p_search: search,
          p_offset: offset,
        }),
      );
    }),
  );
  app.post(
    "/api/admin/players/suspend",
    route(true, async (req, res, token) => {
      const data = suspendSchema.parse(req.body);
      await provider.rpc(token, "arena_admin_set_suspended", {
        p_player_id: data.id,
        p_suspended: data.suspended,
      });
      // Live sessions re-check the account; suspended players are removed from rooms.
      onPlayerChanged(data.id);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/players/delete",
    route(true, async (req, res, token) => {
      const data = deletePlayerSchema.parse(req.body);
      await provider.rpc(token, "arena_admin_delete_player", {
        p_player_id: data.id,
      });
      onPlayerChanged(data.id);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/reports",
    route(false, async (req, res, token) => {
      const data = reportSchema.parse(req.body);
      const id = await provider.rpc(token, "arena_submit_report", {
        p_category: data.category,
        p_message: data.message,
        p_context: data.context,
      });
      res.json({ ok: true, id });
    }),
  );
  app.get(
    "/api/admin/reports",
    route(true, async (req, res, token) => {
      const status =
        typeof req.query.status === "string" ? req.query.status : "open";
      if (!["open", "resolved", "all"].includes(status))
        throw new AccountError(400, "Invalid report filter.");
      const offset = Number(req.query.offset ?? 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
        throw new AccountError(400, "Invalid page.");
      res.json(
        await provider.rpc(token, "arena_admin_reports", {
          p_status: status,
          p_offset: offset,
        }),
      );
    }),
  );
  app.post(
    "/api/admin/reports/resolve",
    route(true, async (req, res, token) => {
      const data = resolveReportSchema.parse(req.body);
      await provider.rpc(token, "arena_admin_resolve_report", {
        p_report_id: data.id,
        p_resolved: data.resolved,
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/admin/titles",
    route(true, async (_req, res, token) => {
      res.json(await provider.rpc(token, "arena_admin_titles", {}));
    }),
  );
  app.post(
    "/api/admin/titles",
    route(true, async (req, res, token) => {
      const data = titleUpdateSchema.parse(req.body);
      res.json(
        await provider.rpc(token, "arena_admin_save_title", {
          p_title_id: data.id,
          p_name: data.name,
          p_description: data.description,
          p_color: data.color,
          p_active: data.active,
        }),
      );
    }),
  );
  app.post(
    "/api/admin/titles/delete",
    route(true, async (req, res, token) => {
      const data = deleteTitleSchema.parse(req.body);
      await provider.rpc(token, "arena_admin_delete_title", {
        p_title_id: data.id,
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/admin/online",
    route(true, async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(listOnline());
    }),
  );
  app.post(
    "/api/admin/grants",
    route(true, async (req, res, token) => {
      const data = titleGrantSchema.parse(req.body);
      await provider.rpc(token, "arena_admin_grant_title", {
        p_player_id: data.playerId,
        p_title_id: data.titleId,
        p_grant: data.grant,
      });
      onPlayerChanged(data.playerId);
      res.json({ ok: true });
    }),
  );
}
