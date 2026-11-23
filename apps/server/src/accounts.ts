import { appleConfig, exchangeAppleCode, revokeAppleToken } from "./apple.js";
import type { AnnouncementPush, PushDevice, PushStore } from "./push.js";
import { clientOrigins } from "./api-cors.js";
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
import type {
  SpireFloorReceipt,
  SpireFloorResult,
  SpireMember,
} from "../../../packages/shared/src/spire.js";
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
  avatarSchema,
  isAvatar,
  photoIdOf,
  DEFAULT_AVATAR,
  PHOTO_MAX_BYTES,
} from "../../../packages/shared/src/avatars.js";
import { createClient } from "@supabase/supabase-js";
import {
  createAvatarPhotoStore,
  type AvatarPhotoStore,
  type PhotoClient,
} from "./avatar-photos.js";
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
import { buildMatchHistory, type MatchHistoryPage } from "./match-history.js";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  accountSchema,
  suspendSchema,
  deletePlayerSchema,
  deleteMyAccountSchema,
  appleCodeSchema,
  deleteTitleSchema,
  reportSchema,
  resolveReportSchema,
  titleUpdateSchema,
  titleGrantSchema,
  adminCoinsSchema,
  announceSchema,
  equipTitleSchema,
  nameChangeSchema,
  matchReportSchema,
  friendsSchema,
  friendRequestSchema,
  blockSchema,
  friendRespondSchema,
  friendRemoveSchema,
  ratingSchema,
  MATCH_HISTORY_KINDS,
  MATCH_HISTORY_PAGE,
  type Friend,
  type Account,
  type MatchSummary,
  type OnlineList,
} from "../../../packages/shared/src/accounts.js";
/** The newest database migration the server expects. */
export const LATEST_MIGRATION = "20261120140000_match_history.sql";
/** A page of match history: whose, from where, and which matches. */
const matchHistoryQuerySchema = z
  .object({
    player: z.string().uuid().optional(),
    at: z
      .string()
      .max(40)
      .refine((s) => !Number.isNaN(Date.parse(s)))
      .optional(),
    id: z.string().min(8).max(64).optional(),
    kind: z.enum(MATCH_HISTORY_KINDS).optional(),
  })
  .strict();
/** The migration that last redefined the raid appearance functions. */
export const RAID_FUNCTIONS_MIGRATION = "018_collection_equipping.sql";
export interface AccountProvider {
  recordRaid?(receipt: RaidReceipt): Promise<void>;
  /** The Spire: save one cleared floor (first-clear rewards once per player). */
  recordSpireFloor?(receipt: SpireFloorReceipt): Promise<SpireFloorResult>;
  /** The Spire: each climber's checkpoint and raid clears, before a climb. */
  spireStart?(accountIds: string[]): Promise<SpireMember[]>;
  /** Coins, missions and Mythic progress after a real match or raid. */
  recordActivity?(receipt: ActivityReceipt): Promise<void>;
  /** Something the game server saw in the Plaza (quests, orbs, laps); returns the player's progress. */
  recordPlaza?(event: PlazaRecord): Promise<PlazaProgress | null>;
  authenticate(token: string): Promise<Account | null>;
  /** Read-only rows for friends' ratings and recent players (step 6). */
  social?: SocialStore;
  /** Sign in with Apple tokens, for revoking on deletion (migration 111). */
  apple?: AppleTokenStore;
  /**
   * Until when an admin stopped this player typing in chat (ISO time), or
   * null (migration 20261115200000; null until it runs).
   */
  chatStoppedUntil?(accountId: string): Promise<string | null>;
  /**
   * Friends' messages, kept (migration 20261115230000). Each call fails
   * (throws) until the migration runs; the game then keeps them in memory.
   */
  friendMessages?: FriendMessageStore;
  /** Devices to notify of friends' messages (migration 20261116100000). */
  pushDevices?: PushStore;
  rpc(
    token: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;
  /**
   * Players' own pictures: files in the private Storage bucket
   * avatar-photos, rows in arena_avatar_photos (migration 20261119120000;
   * service role). Without it, pictures can't be added and show the default.
   */
  photos?: AvatarPhotoStore;
  /** A player's avatar by account id (migration 20261119140000; service role). */
  avatarOf?(playerId: string): Promise<string | null>;
}
/** One kept message between friends, as the database returns it. */
export interface StoredFriendMessage {
  id: number;
  from: string;
  at: number;
  text: string | null;
  quick: string | null;
}
export interface FriendMessageStore {
  save(
    from: string,
    to: string,
    body: { text?: string; quick?: string },
  ): Promise<number>;
  history(
    me: string,
    friend: string,
    limit: number,
  ): Promise<StoredFriendMessage[]>;
  unread(me: string): Promise<Record<string, number>>;
  read(me: string, friend: string): Promise<void>;
}
export interface AppleToken {
  sub: string;
  clientId: string;
  refreshToken: string;
}
export interface AppleTokenStore {
  /** Apple's id for the signed-in player, if they signed in with Apple. */
  subjectOf(token: string): Promise<string | null>;
  save(playerId: string, token: AppleToken): Promise<void>;
  tokenOf(playerId: string): Promise<AppleToken | null>;
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
  const admin = () => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey)
      throw new AccountError(503, "Server storage is not configured.");
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  };
  return {
    social: supabaseSocialStore(),
    apple: {
      async subjectOf(token) {
        const { data, error } = await client(token).auth.getUser(token);
        if (error || !data.user) return null;
        const apple = data.user.identities?.find((i) => i.provider === "apple");
        const sub = apple?.identity_data?.sub ?? apple?.id;
        return typeof sub === "string" && sub ? sub : null;
      },
      async save(playerId, token) {
        const result = await admin().rpc("arena_apple_token_save", {
          p_player: playerId,
          p_sub: token.sub,
          p_client: token.clientId,
          p_token: token.refreshToken,
        });
        if (result.error)
          throw new AccountError(
            503,
            "The Sign in with Apple token couldn't be kept.",
            result.error.message,
          );
      },
      async tokenOf(playerId) {
        const result = await admin().rpc("arena_apple_token_of", {
          p_player: playerId,
        });
        if (result.error)
          throw new AccountError(503, "Apple tokens are unavailable.");
        const t = result.data as Partial<AppleToken> | null;
        return t?.sub && t.clientId && t.refreshToken
          ? { sub: t.sub, clientId: t.clientId, refreshToken: t.refreshToken }
          : null;
      },
    },
    friendMessages: {
      async save(from, to, body) {
        const r = await admin().rpc("arena_dm_save", {
          p_from: from,
          p_to: to,
          p_body: body.text ?? null,
          p_quick: body.quick ?? null,
        });
        if (r.error) throw new Error(r.error.message);
        return Number(r.data);
      },
      async history(me, friend, limit) {
        const r = await admin().rpc("arena_dm_history", {
          p_me: me,
          p_friend: friend,
          p_limit: limit,
        });
        if (r.error) throw new Error(r.error.message);
        return (r.data as StoredFriendMessage[] | null) ?? [];
      },
      async unread(me) {
        const r = await admin().rpc("arena_dm_unread", { p_me: me });
        if (r.error) throw new Error(r.error.message);
        return (r.data as Record<string, number> | null) ?? {};
      },
      async read(me, friend) {
        const r = await admin().rpc("arena_dm_read", {
          p_me: me,
          p_friend: friend,
        });
        if (r.error) throw new Error(r.error.message);
      },
    },
    pushDevices: {
      async save(player, d) {
        const r = await admin().rpc("arena_push_save", {
          p_player: player,
          p_endpoint: d.endpoint,
          p_p256dh: d.p256dh,
          p_auth: d.auth,
        });
        if (r.error) throw new Error(r.error.message);
      },
      async remove(endpoint) {
        const r = await admin().rpc("arena_push_remove", {
          p_endpoint: endpoint,
        });
        if (r.error) throw new Error(r.error.message);
      },
      async list(player) {
        const r = await admin().rpc("arena_push_list", { p_player: player });
        if (r.error) throw new Error(r.error.message);
        return (r.data as PushDevice[] | null) ?? [];
      },
      // Game news (migration 20261122140000).
      async setNews(player, endpoint, on) {
        const r = await admin().rpc("arena_push_set_news", {
          p_player: player,
          p_endpoint: endpoint,
          p_news: on,
        });
        if (r.error) throw new Error(r.error.message);
        return r.data === true;
      },
      async newsPage(after, limit) {
        const r = await admin().rpc("arena_push_news_page", {
          p_after: after,
          p_limit: limit,
        });
        if (r.error) throw new Error(r.error.message);
        return (r.data as PushDevice[] | null) ?? [];
      },
      async newsCount() {
        const r = await admin().rpc("arena_push_news_count", {});
        if (r.error) throw new Error(r.error.message);
        return Number(r.data ?? 0);
      },
    },
    photos: createAvatarPhotoStore(() => admin() as unknown as PhotoClient),
    async avatarOf(playerId) {
      try {
        const result = await admin().rpc("arena_avatar_of", {
          p_player: playerId,
        });
        return result.error ? null : ((result.data as string | null) ?? null);
      } catch {
        return null;
      }
    },
    async chatStoppedUntil(accountId) {
      try {
        const result = await admin().rpc("arena_chat_stopped_until", {
          p_player: accountId,
        });
        return result.error ? null : ((result.data as string | null) ?? null);
      } catch {
        return null;
      }
    },
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
    async recordSpireFloor(receipt) {
      const r = await admin().rpc("arena_record_spire_floor", { p: receipt });
      if (r.error)
        throw new AccountError(
          503,
          "Spire progress could not be stored.",
          r.error.message,
        );
      const data = r.data as Partial<SpireFloorResult> | null;
      return { newClaims: data?.newClaims ?? [] };
    },
    async spireStart(accountIds) {
      const r = await admin().rpc("arena_spire_start", {
        p_players: accountIds,
      });
      if (r.error)
        throw new AccountError(
          503,
          "Spire progress is unavailable.",
          r.error.message,
        );
      return ((r.data as SpireMember[] | null) ?? []).map((m) => ({
        checkpoint: Number(m.checkpoint) || 1,
        clears: m.clears ?? {},
      }));
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
/** A fighter to keep with the account: one on the roster. */
const savedFighterSchema = z.object({ fighter: z.enum(FIGHTER_IDS) }).strict();
/**
 * How a Lobby tour ended (apps/client/src/hub-tour.ts): finished or skipped,
 * how many of its steps the player saw, and whether it was a replay.
 */
export const tourEndSchema = z
  .object({
    result: z.enum(["done", "skipped"]),
    reached: z.number().int().min(0).max(20),
    steps: z.number().int().min(1).max(20),
    replay: z.boolean(),
  })
  .strict()
  .refine((t) => t.reached <= t.steps, "More steps reached than shown.");
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
  /** One line for the server log (server.ts connectionLog). */
  log: (event: string, details: Record<string, unknown>) => void = () => {},
  /** Send an event to every connected game (an admin's announcement). */
  broadcast: (event: string, payload: unknown) => void = () => {},
  /** Announcements as notifications (push.ts); null without VAPID keys. */
  announcePush: Pick<
    AnnouncementPush,
    "available" | "reach" | "send"
  > | null = null,
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
      if (originHost !== req.get("host") && !clientOrigins().includes(origin))
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
  // The fighter you last picked, kept with your account so another device
  // starts on it (migration 108). Null before the first save.
  app.get(
    "/api/account/fighter",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      const saved = await provider.rpc(token, "arena_saved_fighter", {});
      res.json({
        fighter:
          typeof saved === "string" &&
          (FIGHTER_IDS as readonly string[]).includes(saved)
            ? saved
            : null,
      });
    }),
  );
  app.post(
    "/api/account/fighter",
    route(false, async (req, res, token) => {
      const { fighter } = savedFighterSchema.parse(req.body);
      await provider.rpc(token, "arena_save_fighter", { p_fighter: fighter });
      res.json({ ok: true });
    }),
  );
  // How your Lobby tour ended (migration 20261121090000), so another device
  // doesn't show it again. Null before it ever ended.
  app.get(
    "/api/account/tour",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      const saved = await provider.rpc(token, "arena_my_tour", {});
      res.json({
        tour: saved === "done" || saved === "skipped" ? saved : null,
      });
    }),
  );
  app.post(
    "/api/account/tour",
    route(false, async (req, res, token) => {
      const end = tourEndSchema.parse(req.body);
      await provider.rpc(token, "arena_save_tour", {
        p_result: end.result,
        p_reached: end.reached,
      });
      // The new-player funnel (docs/player-funnel.md): how tours end. No
      // account: the database row is the per-account record.
      log("arena-tour", end);
      res.json({ ok: true });
    }),
  );
  // Your avatar from the library (packages/shared/src/avatars.ts; migration
  // 20261119100000). Null before the first choice: the client shows the
  // default. A change reaches your seat in a room at once.
  app.get(
    "/api/account/avatar",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      const saved = await provider.rpc(token, "arena_my_avatar", {});
      res.json({
        avatar: isAvatar(saved) ? saved : null,
      });
    }),
  );
  // Your own picture (migrations 20261119110000 and 20261119120000): the
  // device cuts and shrinks the photo to a 256 px WebP or JPEG; this puts
  // it in the Storage bucket and the database takes it (or refuses).
  app.post(
    "/api/account/avatar-photo",
    express.raw({
      type: ["image/webp", "image/jpeg"],
      limit: PHOTO_MAX_BYTES + 1024,
    }),
    route(false, async (req, res, _token, account) => {
      const type = req.get("content-type")?.split(";")[0].trim();
      const body = req.body as unknown;
      if (
        !Buffer.isBuffer(body) ||
        !body.length ||
        body.length > PHOTO_MAX_BYTES ||
        (type !== "image/webp" && type !== "image/jpeg")
      )
        throw new AccountError(400, "Use a WebP or JPEG picture under 64 KB.");
      if (!provider.photos)
        throw new AccountError(503, "Server storage is not configured.");
      const avatar = await provider.photos.save(account.id, type, body);
      onPlayerChanged(account.id);
      res.json({ ok: true, avatar });
    }),
  );
  // A picture, by id, for anyone (no account needed: it's on view
  // everywhere). Hidden (reported) or removed: the default avatar.
  app.get("/api/avatar-photo/:id", async (req, res, next) => {
    try {
      const id = photoIdOf(`photo:${req.params.id}`);
      const photo = id ? await provider.photos?.read(id) : null;
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      if (!photo) {
        res.setHeader("Cache-Control", "public, max-age=300");
        return res.redirect(302, `/assets/avatars/${DEFAULT_AVATAR}.webp`);
      }
      // Short: a picture an admin removes stops showing within minutes.
      res.setHeader("Cache-Control", "public, max-age=600");
      res.type(photo.type).send(photo.data);
    } catch (error) {
      next(error);
    }
  });
  // Any player's avatar by account id, as a picture: a redirect to the
  // library file or their own picture (an avatar is on view to everyone).
  // Lists that know only who (the party) point their pictures here.
  app.get("/api/avatar/of/:id", async (req, res, next) => {
    try {
      const id =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          req.params.id,
        )
          ? req.params.id
          : null;
      const avatar = id ? await provider.avatarOf?.(id) : null;
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      const photo = photoIdOf(avatar);
      res.redirect(
        302,
        photo
          ? `/api/avatar-photo/${photo}`
          : `/assets/avatars/${isAvatar(avatar) ? avatar : DEFAULT_AVATAR}.webp`,
      );
    } catch (error) {
      next(error);
    }
  });
  // Report a player's picture: the admins see it; at three reporters it is
  // hidden until an admin looks.
  app.post(
    "/api/avatar-photo/report",
    route(false, async (req, res, token) => {
      const data = z
        .object({
          photo: z.string().uuid(),
          message: z.string().max(300).optional(),
        })
        .strict()
        .parse(req.body);
      const result = await provider.rpc(token, "arena_report_avatar_photo", {
        p_photo: data.photo,
        p_message: data.message ?? "",
      });
      res.json({ ok: true, ...(result as object) });
    }),
  );
  app.post(
    "/api/account/avatar",
    route(false, async (req, res, token, account) => {
      const { avatar } = z
        .object({ avatar: avatarSchema })
        .strict()
        .parse(req.body);
      await provider.rpc(token, "arena_set_avatar", { p_avatar: avatar });
      onPlayerChanged(account.id);
      res.json({ ok: true, avatar });
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
  // Sign in with Apple in the iPhone app: keep Apple's refresh token
  // (migration 111) so deleting the account can revoke it. The code is
  // traded with Apple here; Apple's answer must name the same Apple account
  // the player is signed in with.
  app.post(
    "/api/account/apple",
    route(false, async (req, res, token, account) => {
      const { code } = appleCodeSchema.parse(req.body);
      const cfg = appleConfig();
      if (!cfg || !provider.apple)
        throw new AccountError(503, "Sign in with Apple isn't set up here.");
      const sub = await provider.apple.subjectOf(token);
      if (!sub)
        throw new AccountError(400, "This account isn't signed in with Apple.");
      let issued;
      try {
        issued = await exchangeAppleCode(cfg, code);
      } catch (error) {
        throw new AccountError(
          400,
          "Apple didn't accept that sign-in. Try signing in again.",
          error instanceof Error ? error.message : String(error),
        );
      }
      if (issued.sub !== sub)
        throw new AccountError(
          403,
          "That Apple sign-in is for another account.",
        );
      await provider.apple.save(account.id, issued);
      res.json({ ok: true });
    }),
  );
  // Delete your own account (App Store 5.1.1(v), migration 109). The
  // database removes the login and everything that belongs to it; open
  // games drop the player once their login no longer checks out. A kept
  // Sign in with Apple token is revoked first (Apple's TN3194); if that
  // fails the account is deleted anyway, as Apple asks.
  app.post(
    "/api/account/delete",
    route(false, async (req, res, token, account) => {
      deleteMyAccountSchema.parse(req.body);
      if (account.isAdmin)
        throw new AccountError(
          403,
          "Administrators cannot delete their own account here.",
        );
      const appleRevoked = await revokeAppleFor(account.id);
      const photo = await provider.photos?.pathOf(account.id);
      await provider.rpc(token, "arena_delete_my_account", {});
      // The picture's row went with the account; its file goes now.
      if (photo) await provider.photos?.remove([photo]);
      onPlayerChanged(account.id);
      res.json({ ok: true, appleRevoked });
    }),
  );
  async function revokeAppleFor(playerId: string) {
    const cfg = appleConfig();
    if (!cfg || !provider.apple) return false;
    try {
      const kept = await provider.apple.tokenOf(playerId);
      if (!kept) return false;
      const ok = await revokeAppleToken(cfg, kept);
      if (!ok) console.warn("[apple] Apple refused to revoke a token");
      return ok;
    } catch (error) {
      console.warn(
        "[apple] couldn't revoke:",
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }
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
  // Blocking (migration 110): the players you blocked, and block/unblock.
  // Blocking ends the friendship, so both players' lists refresh.
  app.get(
    "/api/blocks",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_blocked_players", {}));
    }),
  );
  app.post(
    "/api/blocks",
    route(false, async (req, res, token, account) => {
      const data = blockSchema.parse(req.body);
      await provider.rpc(token, "arena_block_player", {
        p_player: data.playerId,
        p_block: data.block,
      });
      onFriendsChanged(data.playerId);
      onFriendsChanged(account.id);
      res.json({ ok: true });
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
  // The Plaza (migration 038): today's quests and the TOP DASH board.
  app.get(
    "/api/plaza",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_plaza", {}));
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
    "/api/spire",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_spire_progress", {}));
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
  // Match history (docs/match-history.md): yours, or a friend's (the
  // database refuses anyone else), a page at a time.
  app.get(
    "/api/matches/history",
    route(false, async (req, res, token, account) => {
      res.setHeader("Cache-Control", "no-store");
      const q = matchHistoryQuerySchema.safeParse(req.query);
      if (!q.success) throw new AccountError(400, "Invalid page.");
      const player = q.data.player ?? account.id;
      const page = (await provider.rpc(token, "arena_match_history", {
        p_player: player,
        p_before_at: q.data.at ?? null,
        p_before_id: q.data.at ? (q.data.id ?? null) : null,
        p_limit: MATCH_HISTORY_PAGE,
        p_kind: q.data.kind ?? "all",
      })) as MatchHistoryPage;
      res.json(buildMatchHistory(page, player));
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
      const sort = req.query.sort === "online" ? "online" : "new";
      try {
        // With last-online and the sort (migration 20261122120000).
        res.json(
          await provider.rpc(token, "arena_admin_player_list", {
            p_search: search,
            p_offset: offset,
            p_sort: sort,
          }),
        );
      } catch (error) {
        // Before that migration: the older list, newest first.
        if (sort === "online") throw error;
        res.json(
          await provider.rpc(token, "arena_admin_players", {
            p_search: search,
            p_offset: offset,
          }),
        );
      }
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
      const photo = await provider.photos?.pathOf(data.id);
      await provider.rpc(token, "arena_admin_delete_player", {
        p_player_id: data.id,
      });
      if (photo) await provider.photos?.remove([photo]);
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
    "/api/admin/chat-ban",
    route(true, async (req, res, token) => {
      const data = z
        .object({
          playerId: z.string().uuid(),
          hours: z.number().int().min(0).max(8760),
          reason: z.string().trim().max(300).optional(),
        })
        .strict()
        .parse(req.body);
      await provider.rpc(token, "arena_admin_chat_ban", {
        p_player: data.playerId,
        p_hours: data.hours,
        p_reason: data.reason ?? null,
      });
      onPlayerChanged(data.playerId);
      res.json({ ok: true });
    }),
  );
  // A reported picture: an admin sees it (hidden or not), then keeps it or
  // removes it (migration 20261119110000).
  app.get(
    "/api/admin/avatar-photo/:id",
    route(true, async (req, res, token) => {
      const id = photoIdOf(`photo:${req.params.id}`);
      const row = (
        id
          ? await provider.rpc(token, "arena_admin_avatar_photo_image", {
              p_photo: id,
            })
          : null
      ) as { type?: unknown; path?: unknown; hidden?: boolean } | null;
      const file =
        row &&
        typeof row.path === "string" &&
        (row.type === "image/webp" || row.type === "image/jpeg")
          ? await provider.photos?.file(row.path, row.type)
          : null;
      res.setHeader("Cache-Control", "no-store");
      res.json(
        file
          ? {
              src: `data:${file.type};base64,${file.data.toString("base64")}`,
              hidden: !!row?.hidden,
            }
          : { src: null, hidden: false },
      );
    }),
  );
  app.post(
    "/api/admin/avatar-photo",
    route(true, async (req, res, token) => {
      const data = z
        .object({ photo: z.string().uuid(), keep: z.boolean() })
        .strict()
        .parse(req.body);
      const result = (await provider.rpc(token, "arena_admin_avatar_photo", {
        p_photo: data.photo,
        p_keep: data.keep,
      })) as { owner?: unknown; path?: unknown } | null;
      // A removed picture's file goes from the bucket too.
      if (typeof result?.path === "string")
        await provider.photos?.remove([result.path]);
      // The owner's seat, Friends and card stop showing a removed picture.
      if (typeof result?.owner === "string") onPlayerChanged(result.owner);
      res.json({ ok: true });
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
  // A player's coins and chat stop, and coins added or taken by an admin
  // (migration 20261122100000).
  app.get(
    "/api/admin/players/:id/status",
    route(true, async (req, res, token) => {
      const id = z.string().uuid().safeParse(req.params.id);
      if (!id.success) throw new AccountError(400, "Invalid player.");
      res.setHeader("Cache-Control", "no-store");
      res.json(
        await provider.rpc(token, "arena_admin_player_status", {
          p_player: id.data,
        }),
      );
    }),
  );
  app.post(
    "/api/admin/coins",
    route(true, async (req, res, token) => {
      const data = adminCoinsSchema.parse(req.body);
      const result = await provider.rpc(token, "arena_admin_adjust_coins", {
        p_player: data.playerId,
        p_amount: data.amount,
        p_reason: data.reason,
        p_ref: data.ref,
      });
      onPlayerChanged(data.playerId);
      res.json(result);
    }),
  );
  // Announcements (migration 20261122120000): an admin sends one to every
  // player; games online get it at once, the rest when they next sign in.
  app.get(
    "/api/announcements",
    route(false, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        res.json(await provider.rpc(token, "arena_current_announcements", {}));
      } catch {
        // Before the migration (or a database hiccup): no announcements.
        res.json([]);
      }
    }),
  );
  app.get(
    "/api/admin/announcements",
    route(true, async (_req, res, token) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await provider.rpc(token, "arena_admin_announcements", {}));
    }),
  );
  app.post(
    "/api/admin/announce",
    route(true, async (req, res, token) => {
      const data = announceSchema.parse(req.body);
      const sent = await provider.rpc(token, "arena_admin_announce", {
        p_message: data.message,
        p_tone: data.tone,
        p_hours: data.hours,
      });
      broadcast("announcement", sent);
      log("arena-announce", {
        tone: data.tone,
        hours: data.hours,
        push: !!data.push,
      });
      // Notifications go out in the background: thousands of devices take
      // a while, and the admin needn't wait. The log says how it went.
      let push: { devices: number } | { error: string } | undefined;
      if (data.push) {
        if (!announcePush?.available)
          push = { error: "Notifications aren't set up on the server." };
        else {
          const devices = await announcePush.reach().catch(() => 0);
          push = { devices };
          void announcePush
            .send(sent as { id: number; message: string; tone: string })
            .then(
              (r) => log("arena-announce-push", { ...r }),
              (error: unknown) =>
                log("arena-announce-push", { error: String(error) }),
            );
        }
      }
      res.json(push ? { ...(sent as object), push } : sent);
    }),
  );
  // How many devices an announcement's notification would reach.
  app.get(
    "/api/admin/push-reach",
    route(true, async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      if (!announcePush?.available) {
        res.json({ available: false, devices: 0 });
        return;
      }
      res.json({
        available: true,
        devices: await announcePush.reach().catch(() => 0),
      });
    }),
  );
  app.post(
    "/api/admin/announcements/end",
    route(true, async (req, res, token) => {
      const data = z
        .object({ id: z.number().int().positive() })
        .strict()
        .parse(req.body);
      await provider.rpc(token, "arena_admin_end_announcement", {
        p_id: data.id,
      });
      broadcast("announcement-ended", { id: data.id });
      res.json({ ok: true });
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
