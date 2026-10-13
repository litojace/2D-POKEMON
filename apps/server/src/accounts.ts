import { createClient } from "@supabase/supabase-js";
import type { Express, Request, Response, NextFunction } from "express";
import {
  accountSchema,
  suspendSchema,
  deletePlayerSchema,
  reportSchema,
  resolveReportSchema,
  titleUpdateSchema,
  titleGrantSchema,
  equipTitleSchema,
  type Account,
} from "../../../packages/shared/src/accounts.js";
export interface AccountProvider {
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
