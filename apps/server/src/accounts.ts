import { RAID_COSMETICS, type RaidReceipt } from "../../../packages/shared/src/raid.js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
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
  matchReportSchema,
  friendsSchema,
  friendRequestSchema,
  friendRespondSchema,
  friendRemoveSchema,
  type Friend,
  type Account,
  type MatchSummary,
  type OnlineList,
} from "../../../packages/shared/src/accounts.js";
/** The newest database migration the server expects. */
export const LATEST_MIGRATION = "008_raid_progress.sql";
export interface AccountProvider {
  recordRaid?(receipt: RaidReceipt): Promise<void>;
  authenticate(token: string): Promise<Account | null>;
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
  ) {
    super(message);
  }
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
    async recordRaid(receipt) {
      const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
      if(!url||!serviceKey)throw new AccountError(503,'Raid rewards require server storage configuration.');
      const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const result=await admin.rpc('arena_record_raid',{p_receipt:receipt});
      if(result.error)throw new AccountError(503,'Raid rewards could not be stored.');
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
      const result = await client(token).rpc(name, args);
      // PGRST202: the function isn't in the database (a migration wasn't run).
      if (result.error?.code === "PGRST202")
        throw new AccountError(
          503,
          `The database needs an update (missing ${name}). In Supabase's SQL Editor, run the files in supabase/migrations you haven't run yet, newest last (${LATEST_MIGRATION}).`,
        );
      if (result.error)
        throw new AccountError(
          result.error.code === "42501" ? 403 : 400,
          result.error.message,
        );
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
        .map((f) => ({ ...f, ...presence(f.id) }))
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
  app.get('/api/raids',route(false,async(_req,res,token)=>{
    res.setHeader('Cache-Control','no-store');res.json(await provider.rpc(token,'arena_raid_progress',{}));
  }));
  app.post('/api/raids/cosmetic',route(false,async(req,res,token,account)=>{
    const data=z.object({cosmetic:z.enum(['cragbound','mountain-aura']).nullable()}).strict().parse(req.body);
    await provider.rpc(token,'arena_equip_raid_cosmetic',{p_cosmetic:data.cosmetic});onPlayerChanged(account.id);res.json({ok:true});
  }));
  // One item per slot (skin, aura, entrance, frame), from migration 008.
  app.post('/api/raids/equip',route(false,async(req,res,token,account)=>{
    const data=z.object({slot:z.enum(['skin','aura','entrance','frame']),item:z.enum(['cragbound','cragstone','mountain-aura','mountainborn','conqueror']).nullable()}).strict().parse(req.body);
    if(data.item&&RAID_COSMETICS[data.item].slot!==data.slot)throw new AccountError(400,'That item belongs in another slot.');
    await provider.rpc(token,'arena_equip_raid_slot',{p_slot:data.slot,p_item:data.item});onPlayerChanged(account.id);res.json({ok:true});
  }));
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
