import { FighterAppearance, PortraitChoice } from "./fighter-appearance.js";
import { ServerDiagnostics } from "./diagnostics.js";
import { PresenceHistory } from "./presence-history.js";
import { apiClock, apiCors } from "./api-cors.js";
import { ArcadeArena } from "./arcade.js";
import {
  arcadeWeek,
  ARCADE_IDS,
  type ArcadeId,
} from "../../../packages/shared/src/arcade.js";
import { RaidArena } from "./raid.js";
import { createRaidArena } from "./raid-bosses.js";
import type { ActivityReceipt } from "../../../packages/shared/src/shop.js";
import {
  DREAM_RUNES,
  RAID_ATTACKS,
  RAID_PINGS,
  RAID_COSMETICS,
  raidAttacksOf,
  raidLookOf,
  type RaidAttack,
  pacificDate,
  raidWeek,
  RAID,
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  type RaidBossId,
  type RaidProgress,
  type RaidReceipt,
} from "../../../packages/shared/src/raid.js";
import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import path from "node:path";
import { Server } from "socket.io";
import {
  characterSchema,
  identitySchema,
  inputSchema,
  joinSchema,
  resumeSchema,
  RULES,
  blankInput,
  packSnapshot,
  MetaTracker,
  type WireSnapshot,
  practiceOptionsSchema,
  FIGHTER_IDS,
  MUTATOR_IDS,
  type MutatorId,
  type Fighter,
  type Reply,
} from "../../../packages/shared/src/index.js";
import { Arena } from "./simulation.js";
import {
  battleLoadSchema,
  connectionReportSchema,
} from "../../../packages/shared/src/connection.js";
import { PlazaWorld, type PlazaEvent } from "./plaza.js";
import { PLAZA, type PlazaRecord } from "../../../packages/shared/src/plaza.js";
import { Parties, type Party, type PartyAppearance } from "./party.js";
import { PlazaAppearance } from "./plaza-appearance.js";
import { MatchLedger, matchSummary } from "./match-summary.js";
import {
  BotBrain,
  BOT_DIFFICULTIES,
  BOT_LABELS,
  type BotDifficulty,
} from "./bot.js";
const botMatchSchema = identitySchema
  .extend({
    character: characterSchema,
    difficulty: z.enum(BOT_DIFFICULTIES),
    arcade: z.enum(ARCADE_IDS as [ArcadeId, ...ArcadeId[]]).optional(),
  })
  .strict();
const createSchema = identitySchema
  .extend({
    mode: z.enum(["duel", "teams", "ffa", "raid"]).optional(),
    arcade: z.enum(ARCADE_IDS as [ArcadeId, ...ArcadeId[]]).optional(),
    // Only bosses that are built can be raided.
    boss: z
      .enum(RAID_BOSS_ORDER as [RaidBossId, ...RaidBossId[]])
      .refine((id: RaidBossId) => RAID_BOSSES[id].playable)
      .optional(),
  })
  .strict();
const teamSchema = z
  .object({ team: z.union([z.literal(0), z.literal(1)]) })
  .strict();
const riteSchema = z.object({ id: z.string().min(1).max(64) }).strict();
const mutatorsSchema = z
  .object({
    ids: z.array(z.enum(MUTATOR_IDS as [MutatorId, ...MutatorId[]])).max(8),
  })
  .strict();
const BOT_NAMES = [
  "Pip",
  "Nova",
  "Bramble",
  "Zuzu",
  "Kip",
  "Mochi",
  "Echo",
  "Taro",
];
const BOT_COLORS = { easy: "#65d38a", normal: "#7ff3ff", hard: "#ff697f" };
import {
  createAccountProvider,
  authorize,
  installAccountRoutes,
  AccountError,
  type AccountProvider,
} from "./accounts.js";
import {
  friendCode,
  friendsSchema,
  roomInviteRequestSchema,
  partyInviteRequestSchema,
  partyAcceptSchema,
  MASTERY_TIERS,
  progressSchema,
  type Account,
  type OnlineList,
  type OnlinePlayer,
} from "../../../packages/shared/src/accounts.js";
import { z, ZodError } from "zod";
import type { Request, Response, NextFunction } from "express";
type Session = {
  accountId: string;
  id: string;
  token: string;
  code: string;
  socketId: string | null;
  expires: number;
};
/** When a socket counts as congested (see broadcast). */
export const BACKPRESSURE = { bytes: 16 * 1024, messages: 4 };
export function createArenaServer(
  options: {
    reconnectMs?: number;
    autoTick?: boolean;
    accounts?: AccountProvider;
    /** Collect tick/broadcast/CPU/memory/byte measurements (see diagnostics.ts). */
    diagnostics?: boolean;
    /**
     * Hold snapshots back from congested sockets (see broadcast). Needs the
     * steady 15 Hz loop to deliver the catch-up, so it defaults to autoTick.
     */
    backpressure?: boolean;
    /**
     * Where diagnostic lines go: dropped players ("arena-disconnect",
     * "arena-client-drop") and battle load times ("arena-load"). Defaults
     * to console.log on a live server (autoTick), and to nothing in tests.
     */
    connectionLog?: (event: string, details: Record<string, unknown>) => void;
  } = {},
) {
  const connectionLog =
    options.connectionLog ??
    (options.autoTick === false
      ? () => {}
      : (event: string, details: Record<string, unknown>) =>
          console.log(event, JSON.stringify(details)));
  const diagnosticsEvery = Number(process.env.ARENA_DIAGNOSTICS ?? 0);
  const diagnostics = new ServerDiagnostics(
    options.diagnostics ?? diagnosticsEvery > 0,
  );
  const app = express();
  const accounts = options.accounts ?? createAccountProvider();
  const fighterAppearance = new FighterAppearance(accounts);
  const portraitChoice = new PortraitChoice(accounts);
  app.use("/api", apiCors(process.env.CLIENT_ORIGIN));
  app.use("/api", apiClock());
  app.use(express.json({ limit: "4kb" }));
  const http = createServer(app);
  const io = new Server(http, {
    maxHttpBufferSize: 4096,
    cors: process.env.CLIENT_ORIGIN
      ? { origin: process.env.CLIENT_ORIGIN }
      : undefined,
  });
  if (diagnostics.enabled)
    io.engine.on("connection", (conn: import("engine.io").Socket) =>
      conn.on("packetCreate", (packet: { data?: unknown }) => {
        if (typeof packet.data === "string")
          diagnostics.packet(Buffer.byteLength(packet.data));
      }),
    );
  const rooms = new Map<string, Arena>(),
    sessions = new Map<string, Session>();
  // Input packets arrive every simulation tick: avoid scanning all sessions
  // to identify the sending socket on this hot path.
  const socketSessions = new Map<string, Session>();
  // One live game connection per account, including Plaza/menu/spectator seats.
  const activeAccounts = new Map<string, string>();
  const ownsConnection = (socket: import("socket.io").Socket) =>
    socket.connected &&
    !socket.data.sessionReplaced &&
    (!socket.data.account ||
      activeAccounts.get(socket.data.account.id) === socket.id);
  function claimAccount(socket: import("socket.io").Socket) {
    const id = socket.data.account?.id as string | undefined;
    if (!id) return;
    const previousId = activeAccounts.get(id);
    activeAccounts.set(id, socket.id);
    const previous = previousId && io.sockets.sockets.get(previousId);
    if (previous && previous !== socket) {
      previous.data.sessionReplaced = true;
      previous.emit("session-replaced");
      // A server disconnect stops Socket.IO's automatic reconnect loop.
      previous.disconnect(true);
    }
  }
  const grace =
    options.reconnectMs ??
    Number(process.env.RECONNECT_MS ?? RULES.reconnectMs);
  const eventCursors = new WeakMap<Arena, number>();
  /** Per room: which appearance revision fighters wear (snapshot-meta.ts). */
  const metaTrackers = new WeakMap<Arena, MetaTracker>();
  /** Congested sockets: their room and the last event they received. */
  const laggingSockets = new Map<string, { code: string; from: number }>();
  /**
   * Truly congested, not merely mid-write: the WebSocket has more than a
   * couple of snapshots waiting for the kernel, or Engine.IO has queued
   * several messages behind an unfinished write. (Long-polling keeps its
   * own buffering.)
   */
  const backpressure = options.backpressure ?? options.autoTick !== false;
  const congested = (socket: import("socket.io").Socket) => {
    if (!backpressure) return false;
    const conn = socket.conn as unknown as {
      transport?: { name?: string; socket?: { bufferedAmount?: number } };
      writeBuffer?: unknown[];
    };
    if (conn.transport?.name !== "websocket") return false;
    return (
      (conn.transport.socket?.bufferedAmount ?? 0) > BACKPRESSURE.bytes ||
      (conn.writeBuffer?.length ?? 0) >= BACKPRESSURE.messages
    );
  };
  /** Rooms where a socket just joined/resumed/started watching. */
  const metaWanted = new WeakSet<Arena>();
  const metaTracker = (arena: Arena) => {
    let tracker = metaTrackers.get(arena);
    if (!tracker) metaTrackers.set(arena, (tracker = new MetaTracker()));
    return tracker;
  };
  /** Join the room's broadcast channel and send it everyone's appearance. */
  const joinChannel = (socket: import("socket.io").Socket, arena: Arena) => {
    socket.join(arena.code);
    metaWanted.add(arena);
  };
  /** Which account plays each fighter (kept after a player leaves). */
  const fighterAccounts = new WeakMap<Arena, Map<string, string>>();
  const ledger = new MatchLedger();
  /** The Plaza (hub redesign phase 3): movement, the pitch, orbs, laps. */
  const plaza = new PlazaWorld();
  const plazaAppearance = new PlazaAppearance(plaza, accounts);
  const presenceHistory = new PresenceHistory(accounts);
  /** Friends watching a room: socket id → room code and display name. */
  const watchers = new Map<string, { code: string; name: string }>();
  const MAX_WATCHERS = 6;
  const roomInviteCooldowns = new Map<string, number>();
  const roomInvitesPending = new Set<string>();
  const parties = new Parties();
  /** The connected sockets of an account (a replaced tab has no account). */
  const accountSockets = (accountId: string) =>
    [...io.sockets.sockets.values()].filter(
      (s) => s.data.account?.id === accountId && !s.data.account?.suspended,
    );
  // Each member stands on the others' Lobby stage in their saved look: the
  // skin worn on the champion they picked, and their raid look (aura...).
  const partyView = (party: Party) => ({
    code: party.code,
    leader: party.leader,
    members: party.members.map((m) => {
      const saved = parties.appearanceOf(m.id);
      return saved
        ? { ...m, skin: saved.looks[m.character] ?? null, look: saved.look }
        : { ...m };
    }),
  });
  const emitParty = (party: Party, ended = false) => {
    for (const member of party.members)
      for (const s of accountSockets(member.id))
        s.emit("party", ended ? null : partyView(party));
  };
  /** Only the latest load per account may land (a newer save wins). */
  const partyAppearanceLoads = new Map<string, symbol>();
  /** Read a party member's saved appearance from their own account. */
  const loadPartyAppearance = async (accountId: string, token: string) => {
    const request = Symbol();
    partyAppearanceLoads.set(accountId, request);
    const read = (name: string) =>
      Promise.resolve().then(() => accounts.rpc(token, name, {}));
    const [skins, progress] = await Promise.allSettled([
      read("arena_my_looks"),
      read("arena_raid_progress"),
    ]);
    if (partyAppearanceLoads.get(accountId) !== request) return;
    partyAppearanceLoads.delete(accountId);
    const before = parties.appearanceOf(accountId);
    const looks: PartyAppearance["looks"] = {};
    if (skins.status === "fulfilled") {
      for (const [champion, look] of Object.entries(
        (skins.value ?? {}) as Record<string, unknown>,
      )) {
        const { skin, stage } = (look ?? {}) as Record<string, unknown>;
        if (typeof skin === "string" && skin && skin.length <= 80)
          looks[champion] = {
            skin,
            stage: Number.isInteger(stage)
              ? Math.min(3, Math.max(1, Number(stage)))
              : 1,
          };
      }
    }
    const party = parties.setAppearance(accountId, {
      looks: skins.status === "fulfilled" ? looks : (before?.looks ?? {}),
      look:
        progress.status === "fulfilled"
          ? raidLookOf(progress.value as RaidProgress | null)
          : (before?.look ?? {}),
    });
    if (party) emitParty(party);
  };
  const inRoom = (accountId: string) =>
    [...sessions.values()].some((s) => s.accountId === accountId);
  const watchersOf = (code: string) =>
    [...watchers.values()].filter((w) => w.code === code).map((w) => w.name);
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.accessToken;
      if (token) {
        socket.data.account = await authorize(accounts, token);
        socket.data.accessToken = token;
      }
      next();
    } catch (error) {
      const failure = new Error(
        error instanceof Error ? error.message : "Unable to verify login.",
      ) as Error & { data: { code: string; status: number } };
      failure.data = {
        code: "ACCOUNT_ERROR",
        status: error instanceof AccountError ? error.status : 503,
      };
      next(failure);
    }
  });
  async function refreshSocket(socket: import("socket.io").Socket) {
    try {
      const account = await authorize(accounts, socket.data.accessToken);
      if (!ownsConnection(socket)) return;
      socket.data.account = account;
      socket.data.expiredChecks = 0;
      if (!account.guest)
        void presenceHistory.touch(account.id, socket.data.accessToken);
      const session = getSession(socket.id);
      const arena = session && rooms.get(session.code);
      const fighter = arena?.players.find((p) => p.id === session!.id);
      if (fighter) {
        fighter.name = account.displayName;
        fighter.title = account.title;
        fighter.titleColor = account.titleColor;
      }
      if (fighter && arena)
        await fighterAppearance.refresh(
          fighter,
          socket.data.accessToken,
          () =>
            ownsConnection(socket) &&
            getSession(socket.id)?.code === arena.code &&
            arena.players.includes(fighter),
          () => {},
        );
      if (!ownsConnection(socket)) return;
      if (arena && fighter) broadcast(arena);
      const visitor = plaza.profileOf(socket.id);
      if (visitor) {
        if (
          visitor.name !== account.displayName ||
          visitor.title !== account.title ||
          visitor.titleColor !== account.titleColor
        )
          plaza.updateProfile(socket.id, {
            name: account.displayName,
            title: account.title,
            titleColor: account.titleColor,
          });
        void plazaAppearance.refresh(socket.id, socket.data.accessToken, true);
      }
      socket.emit("account-changed");
    } catch (error) {
      if (!ownsConnection(socket)) return;
      // An expired token is normal (Supabase tokens last an hour): ask the
      // client for its refreshed one instead of kicking it out mid-match.
      // Only give up if no fresh token arrives for a few checks.
      if (
        error instanceof AccountError &&
        error.status === 401 &&
        (socket.data.expiredChecks = (socket.data.expiredChecks ?? 0) + 1) <= 4
      ) {
        socket.emit("token-expired");
        return;
      }
      socket.emit("access-revoked", {
        error: error instanceof Error ? error.message : "Login required.",
      });
      const session = getSession(socket.id);
      if (session) {
        socket.leave(session.code);
        detach(session, true);
      }
      socket.disconnect(true);
    }
  }
  installAccountRoutes(
    app,
    accounts,
    (id) => {
      for (const socket of io.sockets.sockets.values())
        if ((socket.data.account as Account | undefined)?.id === id)
          void refreshSocket(socket);
    },
    listOnline,
    (matchId, accountId) => ledger.forPlayer(matchId, accountId),
    (accountId) => {
      const me = listOnline().players.find((p) => p.id === accountId);
      if (!me)
        return {
          online: false,
          activity: null,
          room: null,
          ...(presenceHistory.lastOnline(accountId)
            ? { lastOnline: presenceHistory.lastOnline(accountId) }
            : {}),
        };
      const arena = me.room ? rooms.get(me.room) : undefined;
      const socketId = activeAccounts.get(accountId);
      const session = socketId ? getSession(socketId) : undefined;
      const fighter = session
        ? rooms.get(session.code)?.players.find((p) => p.id === session.id)
        : undefined;
      const visitor = socketId ? plaza.profileOf(socketId) : undefined;
      const look = fighter?.raidLook ?? visitor?.look;
      return {
        online: true,
        activity: me.activity,
        room: me.room,
        ...((me.fighter ?? visitor?.character)
          ? { fighter: me.fighter ?? visitor?.character }
          : {}),
        ...(look !== undefined ? { frame: look.frame ?? null, look } : {}),
        ...(fighter?.championLooks !== undefined
          ? { championLooks: fighter.championLooks }
          : visitor?.look !== undefined
            ? {
                championLooks: visitor.skin
                  ? { [visitor.character]: visitor.skin }
                  : {},
              }
            : {}),
        ...(fighter?.raidClears !== undefined
          ? { raidClears: fighter.raidClears }
          : visitor?.raid !== undefined
            ? { raidClears: visitor.raid }
            : {}),
        joinable:
          !!arena &&
          arena.phase === "lobby" &&
          arena.players.length < arena.size,
      };
    },
    (target) => {
      // `target` is an account id, or "code:XXXXXXXX" for a friend code.
      for (const socket of io.sockets.sockets.values()) {
        const id = (socket.data.account as Account | undefined)?.id;
        if (!id) continue;
        if (
          id === target ||
          (target.startsWith("code:") && friendCode(id) === target.slice(5))
        )
          socket.emit("friends-changed");
      }
    },
  );
  /** Signed-in players with a live connection, merged per account. */
  function listOnline(): OnlineList {
    const byAccount = new Map<string, OnlinePlayer>();
    let guests = 0;
    for (const socket of io.sockets.sockets.values()) {
      const account = socket.data.account as Account | undefined;
      if (!account) {
        guests++;
        continue;
      }
      const since = new Date(socket.handshake.issued).toISOString();
      const session = getSession(socket.id);
      const arena = session ? rooms.get(session.code) : undefined;
      const me = arena?.players.find((p) => p.id === session!.id);
      const others = me && arena ? arena.enemiesOf(me) : [];
      const other = others.length
        ? { name: others.map((o) => o.name).join(" & ") }
        : undefined;
      // "town" is the Plaza's wire name (clients already show "In the Plaza").
      const activity: OnlinePlayer["activity"] = !arena
        ? plaza.plazaOf(socket.id) !== undefined
          ? "town"
          : "menu"
        : arena.practice
          ? "practice"
          : arena.phase === "lobby"
            ? "lobby"
            : "match";
      const entry: OnlinePlayer = {
        id: account.id,
        displayName: account.displayName,
        title: account.title ?? null,
        titleColor: account.titleColor ?? null,
        isAdmin: account.isAdmin,
        ...(account.guest ? { guest: true } : {}),
        connections: 1,
        since,
        activity,
        room: arena && !arena.practice && !arena.bots.size ? arena.code : null,
        phase: arena?.phase ?? null,
        fighter: me?.character ?? null,
        opponent: arena?.practice ? null : (other?.name ?? null),
      };
      const existing = byAccount.get(account.id);
      if (!existing) byAccount.set(account.id, entry);
      else {
        // Prefer the tab that is actually in a room; keep the earliest login time.
        const merged =
          existing.activity === "menu" && activity !== "menu"
            ? entry
            : existing;
        merged.connections = existing.connections + 1;
        merged.since = existing.since < since ? existing.since : since;
        byAccount.set(account.id, merged);
      }
    }
    const order = { match: 0, practice: 1, lobby: 2, town: 3, menu: 4 };
    const players = [...byAccount.values()].sort(
      (a, b) =>
        order[a.activity] - order[b.activity] ||
        a.displayName.localeCompare(b.displayName),
    );
    return { players, guests, at: new Date().toISOString() };
  }
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, rooms: rooms.size }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Unknown API endpoint." }),
  );
  app.use(
    (error: unknown, req: Request, res: Response, _next: NextFunction) => {
      // A player sees only "Account service failed" or "Invalid request.";
      // the reason goes to the log, or nobody can tell why a screen failed.
      // So does every 5xx (a refusal by the rules, a 4xx, is the player's).
      if (!(error instanceof AccountError))
        console.error(
          `[api] ${req.method} ${req.path} failed:`,
          error instanceof ZodError
            ? JSON.stringify(error.issues).slice(0, 800)
            : error instanceof Error
              ? error.message
              : String(error),
        );
      else if (error.status >= 500 && !error.logged)
        console.error(
          `[api] ${req.method} ${req.path} failed (${error.status}):`,
          error.detail ?? error.message,
        );
      res
        .status(
          error instanceof AccountError
            ? error.status
            : error instanceof ZodError
              ? 400
              : 500,
        )
        .json({
          error:
            error instanceof AccountError
              ? error.message
              : error instanceof ZodError
                ? "Invalid request."
                : "Account service failed. Please try again.",
        });
    },
  );
  const client = path.resolve(
    process.env.INIT_CWD ?? process.cwd(),
    "apps/client/dist",
  );
  app.use(
    express.static(client, {
      // Old auth paths have no file here (the build's `<path>.html` copies are
      // for the Static Site); the catch-all below serves them, with no
      // directory redirect (`/auth/` exists because of auth/callback.html).
      redirect: false,
      setHeaders(res, file) {
        if (
          /[/\\](sw\.js|manifest\.webmanifest|index\.html|offline\.html)$/.test(
            file,
          )
        )
          res.setHeader("Cache-Control", "no-cache");
        if (file.endsWith("manifest.webmanifest"))
          res.setHeader("Content-Type", "application/manifest+json");
        // Build files carry a content hash in their name, so they never change.
        else if (
          /[/\\]assets[/\\][^/\\]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/.test(file)
        )
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );
  // A file that isn't there is a 404, never the app page: answering a missing
  // script or stylesheet with index.html (200, text/html) let the installed
  // app's offline cache store the page in their place, so it opened unstyled
  // on the rotate notice until its cache was cleared.
  app.use((req, res, next) => {
    if (req.path.startsWith("/assets/") || path.extname(req.path)) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    next();
  });
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(client, "index.html"));
  });
  function getSession(socketId: string) {
    return socketSessions.get(socketId);
  }
  const raidSaves = new WeakMap<RaidArena, string>();
  /** The Shop skin a fighter is wearing for the champion in play. */
  const lookFor = (p: Fighter) => p.championLooks?.[p.character]?.skin ?? null;
  function recordActivity(
    receipt: ActivityReceipt,
    done?: (saved: boolean) => void,
    arena?: Arena,
  ) {
    if (arena) {
      const eligible = new Set(
        receipt.players
          .filter(
            (p) =>
              p.activeSeconds >= 20 &&
              !p.abandoned &&
              p.participated !== false &&
              (receipt.kind !== "match" || p.vsPeople || p.botLevel),
          )
          .map((p) => p.accountId),
      );
      const owners = fighterAccounts.get(arena);
      arena.activityEligible = arena.players
        .filter((p) => eligible.has(owners?.get(p.id) ?? ""))
        .map((p) => p.id);
    }
    if (!accounts.recordActivity || !receipt.players.length) {
      done?.(false);
      return;
    }
    void accounts
      .recordActivity(receipt)
      .then(() => {
        done?.(true);
        // Wallets and missions changed: let those players' games refresh.
        for (const socket of io.sockets.sockets.values())
          if (
            receipt.players.some((p) => p.accountId === socket.data.account?.id)
          )
            socket.emit("economy-changed");
      })
      .catch((error) => {
        done?.(false);
        console.error(
          "Activity not stored:",
          error instanceof Error ? error.message : error,
        );
      });
  }
  function startArena(a: Arena) {
    a.start();
  }
  function broadcast(arena: Arena) {
    const started = diagnostics.now();
    // Wins and real attempts (not practice, not instant quits) are saved:
    // losses still count towards titles and tell us which attacks are unfair.
    if (
      arena instanceof RaidArena &&
      arena.raid.result &&
      !arena.raid.drill &&
      (arena.raid.result === "victory" || arena.raid.elapsed >= 20) &&
      arena.raid.resultId &&
      raidSaves.get(arena) !== arena.raid.resultId
    ) {
      raidSaves.set(arena, arena.raid.resultId);
      const runId = arena.raid.resultId,
        r = arena.raid;
      const owners = fighterAccounts.get(arena);
      const players = arena
        .heroes()
        .map((p) => {
          const c = r.contributions?.[p.id];
          return {
            accountId: owners?.get(p.id) ?? "",
            character: p.character,
            damage: Math.round(c?.damage ?? 0),
            revives: c?.revives ?? 0,
            pillars: c?.pillars ?? 0,
            downs: c?.downs ?? 0,
          };
        })
        .filter((p) => p.accountId);
      const receipt: RaidReceipt = {
        id: runId,
        boss: r.boss,
        peril: r.peril,
        trait: r.trait,
        gilded: r.gilded,
        weekly: false,
        week: raidWeek(new Date(`${r.day}T12:00:00Z`)),
        daily: r.daily,
        day: r.day,
        feat: arena.feat(),
        seed: r.seed,
        partySize: r.partySize,
        seconds: Math.max(0.001, Math.round(r.elapsed * 1000) / 1000),
        downs: r.downs,
        revives: r.revives,
        result: r.result ?? undefined,
        phaseReached: r.phase,
        downCauses: { ...arena.downCauses },
        players,
      };
      r.rewardStatus = "saving";
      arena.activityStatus = "saving";
      recordActivity(
        {
          id: `raid:${runId}`,
          kind: "raid",
          day: r.day,
          // Keep departed seats: the database excludes their rewards but needs
          // the original party size to distinguish co-op and solo missions.
          players: arena.players
            .filter((p) => !p.raidBoss && owners?.get(p.id))
            .map((p) => {
              const c = r.contributions?.[p.id];
              return {
                accountId: owners!.get(p.id)!,
                character: p.character,
                won: r.result === "victory",
                vsPeople: false,
                botLevel: null,
                mode: "raid",
                knockedOut: (c?.downs ?? 0) > 0,
                skillUses: p.stats.skills,
                ults: p.stats.ults ?? 0,
                activeSeconds: r.elapsed,
                skin: lookFor(p),
                raid: {
                  cleared: r.result === "victory",
                  daily: r.daily,
                  peril: r.peril,
                  flawless: r.downs === 0,
                  feat: arena.feat(),
                  revives: c?.revives ?? 0,
                  phaseReached: r.phase,
                },
                participated:
                  arena.engaged.has(p.id) ||
                  p.stats.skills > 0 ||
                  p.stats.dealt > 0 ||
                  (c?.revives ?? 0) > 0,
                abandoned: p.out,
              };
            }),
        },
        (saved) => {
          if (arena.raid.resultId !== runId) return;
          arena.activityStatus = saved ? "saved" : "unavailable";
          broadcast(arena);
        },
        arena,
      );
      void (
        accounts.recordRaid
          ? accounts.recordRaid(receipt)
          : Promise.reject(
              new Error("Raid rewards need server storage configuration."),
            )
      )
        .then(() => {
          if (arena.raid.resultId !== runId) return;
          r.rewardStatus = "saved";
          for (const socket of io.sockets.sockets.values())
            if (players.some((p) => p.accountId === socket.data.account?.id)) {
              socket.emit("account-changed");
              // New frame stars must reach peers/results as soon as the clear
              // is saved, rather than waiting for the periodic profile refresh.
              void refreshSocket(socket);
            }
          broadcast(arena);
        })
        .catch(() => {
          if (arena.raid.resultId === runId) {
            r.rewardStatus = "unavailable";
            broadcast(arena);
          }
        });
    }

    // A real match just ended: file its summary for the players to report.
    if (
      arena.phase === "finished" &&
      !arena.matchId &&
      !arena.practice &&
      arena.mode !== "raid"
    ) {
      const matchId: string = randomUUID();
      arena.matchId = matchId;
      const owners = fighterAccounts.get(arena);
      if (!arena.arcade)
        ledger.add(
          matchId,
          matchSummary(arena, (id) => owners?.get(id) ?? null),
        );
      // Coins and missions: reported by the server, never by the players.
      const humans = arena.players.filter(
        (p) => !arena.bots.has(p.id) && owners?.get(p.id),
      );
      const vsPeople = humans.length >= 2 && arena.bots.size === 0;
      const botLevel = [...arena.bots.values()][0]?.difficulty ?? null;
      arena.activityStatus = "saving";
      recordActivity(
        {
          id: `match:${matchId}`,
          kind: "match",
          day: pacificDate(),
          players: humans.map((p) => ({
            accountId: owners!.get(p.id)!,
            character: p.character,
            won:
              arena.winnerTeam !== null && arena.winnerTeam !== undefined
                ? arena.teamOf(p) === arena.winnerTeam
                : arena.winner === p.id,
            vsPeople,
            botLevel,
            mode: arena.mode,
            knockedOut: (p.stats.knocked ?? 0) > 0,
            skillUses: p.stats.skills,
            ults: p.stats.ults ?? 0,
            activeSeconds: arena.playTime,
            arcade: arena.arcade?.id,
            participated:
              arena.engaged.has(p.id) ||
              p.stats.skills > 0 ||
              p.stats.dealt > 0,
            abandoned: p.out || !p.connected,
            skin: lookFor(p),
          })),
        },
        (saved) => {
          if (arena.matchId !== matchId) return;
          arena.activityStatus = saved ? "saved" : "unavailable";
          broadcast(arena);
        },
        arena,
      );
    }
    let remaining = 0;
    if (arena.phase === "paused") {
      const deadlines = [...sessions.values()]
        .filter((s) => s.code === arena.code && !s.socketId)
        .map((s) => s.expires);
      remaining = Math.max(0, (Math.min(...deadlines) - Date.now()) / 1000);
    }
    const snapshot = arena.snapshot(remaining);
    snapshot.watchers = watchersOf(arena.code);
    const cursor = eventCursors.get(arena) ?? 0;
    snapshot.events = snapshot.events.filter((e) => e.id > cursor);
    if (snapshot.events.length)
      eventCursors.set(arena, snapshot.events.at(-1)!.id);
    // Appearance only travels when it changes or someone (re)joins.
    const tracker = metaTracker(arena);
    const changed = tracker.update(snapshot.players);
    const wanted = metaWanted.delete(arena);
    const wire = packSnapshot(snapshot, {
      compact: true,
      metaRev: tracker.rev,
      meta: changed || wanted ? tracker.meta(snapshot.players) : undefined,
    });
    // Sampled: measuring every payload would cost as much as sending it.
    if (diagnostics.enabled && ticks % 20 === 0)
      diagnostics.snapshot(Buffer.byteLength(JSON.stringify(wire)));
    // Backpressure: a socket still writing an earlier message is congested.
    // Queuing more 15 Hz snapshots behind it only makes it later, so it is
    // skipped; its first snapshot once it drains carries every event it
    // missed (from the room's recent-event history) and the appearance.
    const held = new Set<string>();
    const personal = new Map<string, WireSnapshot>();
    for (const id of io.sockets.adapter.rooms.get(arena.code) ?? []) {
      const socket = io.sockets.sockets.get(id);
      if (!socket) continue;
      const behind = laggingSockets.get(id);
      if (congested(socket)) {
        held.add(id);
        if (!behind || behind.code !== arena.code)
          laggingSockets.set(id, { code: arena.code, from: cursor });
        diagnostics.skip();
        continue;
      }
      if (!behind) continue;
      laggingSockets.delete(id);
      if (behind.code !== arena.code) continue;
      held.add(id);
      personal.set(id, {
        ...wire,
        events: arena.events.filter((e) => e.id > behind.from),
        meta: tracker.meta(snapshot.players),
      });
    }
    // Serialize shared world data once. Somnara's private sequence is added
    // only to the authenticated seat's socket, never a room/spectator broadcast.
    const seats =
      arena instanceof RaidArena && arena.raid.boss === "somnara"
        ? [...sessions.values()].filter(
            (s) => s.code === arena.code && s.socketId,
          )
        : [];
    for (const session of seats) held.add(session.socketId!);
    if (held.size)
      io.to(arena.code)
        .except([...held])
        .emit("state", wire);
    else io.to(arena.code).emit("state", wire);
    for (const session of seats) {
      const id = session.socketId!;
      if (laggingSockets.has(id) && !personal.has(id)) continue;
      io.to(id).emit("state", {
        ...(personal.get(id) ?? wire),
        raidDream: (arena as RaidArena).dreamFor(session.id),
      });
      personal.delete(id);
    }
    for (const [id, catchUp] of personal) io.to(id).emit("state", catchUp);
    diagnostics.broadcast(started);
  }
  function resume(arena: Arena) {
    if (
      arena.phase === "paused" &&
      arena.players.every((p) => p.out || p.connected)
    )
      arena.phase = arena.previousPhase;
  }
  function detach(session: Session, permanent = false) {
    const arena = rooms.get(session.code);
    const p = arena?.players.find((p) => p.id === session.id);
    if (!arena || !p) {
      expire(session);
      return;
    }
    p.connected = false;
    p.ready = false;
    p.lastInput = blankInput();
    arena.clearInputQueue(p.id);
    if (session.socketId) socketSessions.delete(session.socketId);
    session.socketId = null;
    session.expires = Date.now() + (permanent ? 0 : grace);
    const standIn =
      arena instanceof RaidArena &&
      ["playing", "countdown", "intermission"].includes(arena.phase) &&
      arena
        .heroes()
        .some(
          (h) =>
            h.id !== p.id &&
            h.connected &&
            !arena.raid.standIns?.includes(h.id),
        ) &&
      arena.standIn(p.id);
    if (!standIn && !["lobby", "finished", "paused"].includes(arena.phase)) {
      arena.previousPhase = arena.phase;
      arena.phase = "paused";
    }
    if (permanent) expire(session);
    broadcast(arena);
  }
  function expire(session: Session) {
    const arena = rooms.get(session.code);
    sessions.delete(session.token);
    if (session.socketId) socketSessions.delete(session.socketId);
    if (!arena) return;
    const other = arena.players.find((p) => p.id !== session.id);
    const leaver = arena.players.find((p) => p.id === session.id);
    if (
      arena.mode !== "duel" &&
      leaver &&
      !["lobby", "finished"].includes(arena.phase)
    ) {
      // 2v2 / free-for-all: the leaver is out for good; the rest play on.
      if (arena instanceof RaidArena) arena.release(leaver.id);
      leaver.out = true;
      leaver.hp = 0;
      leaver.connected = false;
      const team = arena.teamOf(leaver);
      const partners = arena.players.filter(
        (p) => !p.out && arena.teamOf(p) === team,
      );
      const opponents = arena.players.filter(
        (p) => !p.out && arena.teamOf(p) !== team,
      );
      // 2v2: a team with nobody left forfeits. Free-for-all: the match goes
      // on until only one fighter is left in it.
      const over =
        arena.mode === "ffa"
          ? opponents.length <= 1
          : !partners.length && opponents.length > 0;
      if (over && opponents.length) {
        arena.forfeit(opponents[0].id);
        for (const p of arena.players) p.ready = false;
      } else resume(arena);
    } else if (arena.phase === "paused" && other) {
      arena.forfeit(other.id);
      for (const p of arena.players) p.ready = false;
    } else if (arena.phase === "lobby")
      arena.players = arena.players.filter((p) => p.id !== session.id);
    if (![...sessions.values()].some((s) => s.code === arena.code)) {
      rooms.delete(arena.code);
      // Anyone watching is told the room has closed.
      for (const [id, w] of watchers)
        if (w.code === arena.code) {
          watchers.delete(id);
          const viewer = io.sockets.sockets.get(id);
          viewer?.leave(arena.code);
          viewer?.emit("watch-ended", { reason: "The room closed." });
        }
    } else broadcast(arena);
  }
  io.on("connection", (socket) => {
    claimAccount(socket);
    const signedIn = socket.data.account as Account | undefined;
    if (signedIn && !signedIn.guest)
      void presenceHistory.touch(signedIn.id, socket.data.accessToken);
    const account = () => socket.data.account as Account | undefined;
    const requirePlayer = (cb: unknown) => {
      if (!ownsConnection(socket)) {
        fail(cb, "This account is playing on another device.");
        return false;
      }
      if (!account()) {
        fail(cb, "Please log in to play.");
        return false;
      }
      if (account()!.suspended) {
        fail(cb, "This game account is suspended.");
        return false;
      }
      return true;
    };
    let windowStart = Date.now(),
      messages = 0;
    const allowed = (limit = 90) => {
      const now = Date.now();
      if (now - windowStart > 1000) {
        windowStart = now;
        messages = 0;
      }
      return ++messages <= limit;
    };
    const reply = (cb: unknown, value: Reply) => {
      if (typeof cb === "function") cb(value);
    };
    const fail = (cb: unknown, error: string) =>
      reply(cb, { ok: false, error });
    const attach = (
      arena: Arena,
      name: string,
      cb: unknown,
      publish = true,
    ) => {
      const id = randomBytes(12).toString("hex"),
        token = randomBytes(32).toString("hex");
      arena.add(id, name);
      const profile = account()!;
      Object.assign(arena.players.at(-1)!, {
        name: profile.displayName,
        title: profile.title,
        titleColor: profile.titleColor,
      });
      if (!fighterAccounts.has(arena)) fighterAccounts.set(arena, new Map());
      fighterAccounts.get(arena)!.set(id, profile.id);
      const session: Session = {
        accountId: profile.id,
        id,
        token,
        code: arena.code,
        socketId: socket.id,
        expires: Infinity,
      };
      sessions.set(token, session);
      socketSessions.set(socket.id, session);
      const attached = arena.players.find((p) => p.id === id);
      if (attached)
        void fighterAppearance.refresh(
          attached,
          socket.data.accessToken,
          () =>
            ownsConnection(socket) &&
            getSession(socket.id) === session &&
            arena.players.includes(attached),
          () => broadcast(arena),
        );
      joinChannel(socket, arena);
      reply(cb, { ok: true, id, token, code: arena.code });
      if (publish) broadcast(arena);
    };
    const releaseDisconnected = () => {
      const owned = [...sessions.values()].filter(
        (s) => s.accountId === account()?.id,
      );
      if (owned.some((s) => s.socketId && io.sockets.sockets.has(s.socketId)))
        return;
      for (const session of owned) detach(session, true);
    };
    /** Leave the room this socket is watching, if any. */
    const stopWatching = () => {
      const w = watchers.get(socket.id);
      if (!w) return;
      watchers.delete(socket.id);
      socket.leave(w.code);
      const arena = rooms.get(w.code);
      if (arena) broadcast(arena);
    };
    // Watch a friend's room: live view only, no seat and no inputs.
    socket.on("watch", (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
      if (!allowed(15)) return fail(cb, "Too many requests.");
      const code =
        data && typeof data === "object"
          ? String((data as { code?: unknown }).code ?? "")
              .trim()
              .toUpperCase()
          : "";
      if (!/^[A-Z0-9]{6}$/.test(code))
        return fail(cb, "Enter the six-character room code.");
      if (getSession(socket.id))
        return fail(cb, "Leave your current room first.");
      const arena = rooms.get(code);
      if (!arena || arena.practice || arena.bots.size)
        return fail(cb, "Room not found. Check the code with your friend.");
      // Check the seat before leaving any room already being watched, so a
      // full room doesn't also end the current watch.
      const already = watchers.get(socket.id)?.code === code;
      if (!already && watchersOf(code).length >= MAX_WATCHERS)
        return fail(cb, "This room already has the most watchers it allows.");
      stopWatching();
      watchers.set(socket.id, { code, name: account()!.displayName });
      joinChannel(socket, arena);
      reply(cb, { ok: true, code });
      broadcast(arena);
    });
    socket.on("unwatch", (_data: unknown, cb: unknown) => {
      stopWatching();
      reply(cb, { ok: true });
    });
    socket.on("room-invite", async (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
      if (!allowed(10)) return fail(cb, "Too many requests.");
      const parsed = roomInviteRequestSchema.safeParse(data);
      if (!parsed.success) return fail(cb, "Choose a friend to invite.");
      const sender = account()!,
        targetId = parsed.data.playerId;
      const seat = getSession(socket.id),
        arena = seat && rooms.get(seat.code);
      const lobbyAvailable = () =>
        !!arena &&
        arena.phase === "lobby" &&
        !arena.practice &&
        !arena.bots.size &&
        arena.players.length < arena.size &&
        getSession(socket.id) === seat &&
        socket.connected;
      if (!lobbyAvailable())
        return fail(cb, "Open a room with an available seat first.");
      const key = `${sender.id}:${targetId}`;
      for (const [id, until] of roomInviteCooldowns)
        if (until <= Date.now()) roomInviteCooldowns.delete(id);
      if (roomInvitesPending.has(key) || roomInviteCooldowns.has(key))
        return fail(cb, "Invite already sent. Give your friend a moment.");
      if (roomInviteCooldowns.size >= 1000)
        return fail(cb, "Try inviting again in a moment.");
      roomInvitesPending.add(key);
      try {
        const list = friendsSchema.parse(
          await accounts.rpc(socket.data.accessToken, "arena_friends", {}),
        );
        if (
          targetId === sender.id ||
          !list.friends.some((f) => f.id === targetId)
        )
          return fail(cb, "You can only invite someone on your friends list.");
        // Recheck after the database call: the room may have filled or started.
        if (!lobbyAvailable()) return fail(cb, "This room is no longer open.");
        const targets = [...io.sockets.sockets.values()].filter(
          (s) => s.data.account?.id === targetId && !s.data.account?.suspended,
        );
        if (!targets.length) return fail(cb, "Your friend is offline.");
        if ([...sessions.values()].some((s) => s.accountId === targetId))
          return fail(cb, "Your friend is already in a room.");
        if (targets.some((s) => watchers.has(s.id)))
          return fail(cb, "Your friend is watching a match.");
        const expiresAt = Date.now() + 90000;
        roomInviteCooldowns.set(key, Date.now() + 30000);
        const invite = {
          id: randomUUID(),
          fromId: sender.id,
          name: sender.displayName,
          code: arena!.code,
          mode: arena!.mode,
          expiresAt,
        };
        for (const target of targets) target.emit("room-invite", invite);
        reply(cb, { ok: true });
      } catch {
        fail(cb, "Couldn't check your friends. Try again.");
      } finally {
        roomInvitesPending.delete(key);
      }
    });
    // Parties before a room: friends gather on the Lobby, then follow the
    // leader into the room their PLAY opens.
    const knownCharacter = (id: string) =>
      (FIGHTER_IDS as readonly string[]).includes(id);
    const memberOf = (character: string) => ({
      id: account()!.id,
      name: account()!.displayName,
      character,
    });
    socket.on("party-invite", async (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
      if (!allowed(10)) return fail(cb, "Too many requests.");
      const parsed = partyInviteRequestSchema.safeParse(data);
      if (!parsed.success || !knownCharacter(parsed.data.character))
        return fail(cb, "Choose a friend to invite.");
      const sender = account()!,
        targetId = parsed.data.playerId;
      if (getSession(socket.id) || inRoom(sender.id))
        return fail(cb, "Leave your room to start a party.");
      const key = `party:${sender.id}:${targetId}`;
      if (roomInvitesPending.has(key))
        return fail(cb, "Invite already sent. Give your friend a moment.");
      roomInvitesPending.add(key);
      try {
        const list = friendsSchema.parse(
          await accounts.rpc(socket.data.accessToken, "arena_friends", {}),
        );
        if (
          targetId === sender.id ||
          !list.friends.some((f) => f.id === targetId)
        )
          return fail(cb, "You can only invite someone on your friends list.");
        const targets = accountSockets(targetId);
        if (!targets.length) return fail(cb, "Your friend is offline.");
        if (inRoom(targetId))
          return fail(cb, "Your friend is already in a room.");
        if (targets.some((s) => watchers.has(s.id)))
          return fail(cb, "Your friend is watching a match.");
        if (!socket.connected || getSession(socket.id))
          return fail(cb, "Try again.");
        const result = parties.invite(
          memberOf(parsed.data.character),
          targetId,
          Date.now(),
        );
        if (!result.ok) return fail(cb, result.error);
        const invite = {
          id: randomUUID(),
          fromId: sender.id,
          name: sender.displayName,
          code: result.party.code,
          mode: "party" as const,
          expiresAt: result.expiresAt,
        };
        for (const target of targets) target.emit("room-invite", invite);
        emitParty(result.party);
        if (!parties.appearanceOf(sender.id))
          void loadPartyAppearance(sender.id, socket.data.accessToken);
        reply(cb, { ok: true });
      } catch {
        fail(cb, "Couldn't check your friends. Try again.");
      } finally {
        roomInvitesPending.delete(key);
      }
    });
    socket.on("party-accept", (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
      if (!allowed(10)) return fail(cb, "Too many requests.");
      const parsed = partyAcceptSchema.safeParse(data);
      if (!parsed.success || !knownCharacter(parsed.data.character))
        return fail(cb, "This invitation has expired.");
      if (getSession(socket.id) || inRoom(account()!.id))
        return fail(cb, "Leave your current room before joining a party.");
      const result = parties.accept(
        memberOf(parsed.data.character),
        parsed.data.code,
        Date.now(),
      );
      if (!result.ok) return fail(cb, result.error);
      if (result.disbanded) emitParty(result.disbanded, true);
      else if (result.left) emitParty(result.left);
      emitParty(result.party);
      void loadPartyAppearance(account()!.id, socket.data.accessToken);
      reply(cb, { ok: true });
    });
    socket.on("party-decline", (data: unknown, cb: unknown) => {
      if (!account()) return fail(cb, "Please log in to play.");
      const code = partyAcceptSchema.shape.code.safeParse(
        (data as { code?: unknown } | null)?.code,
      );
      if (code.success) parties.decline(account()!.id, code.data);
      reply(cb, { ok: true });
    });
    const leaveParty = (accountId: string) => {
      const result = parties.leave(accountId);
      for (const s of accountSockets(accountId)) s.emit("party", null);
      if (!result) return;
      if (result.disbanded) emitParty(result.disbanded, true);
      else emitParty(result.party);
    };
    socket.on("party-leave", (_data: unknown, cb: unknown) => {
      if (!account()) return fail(cb, "Please log in to play.");
      leaveParty(account()!.id);
      reply(cb, { ok: true });
    });
    socket.on("party-character", (data: unknown) => {
      const character = (data as { character?: unknown } | null)?.character;
      if (!account() || !allowed(20) || typeof character !== "string") return;
      if (!knownCharacter(character)) return;
      const party = parties.setCharacter(account()!.id, character);
      if (party) emitParty(party);
    });
    // A member saved a new look (Wardrobe, Shop): read it again from their
    // account, so the others see it. The message carries nothing to trust.
    socket.on("party-look", () => {
      if (!account() || !allowed(20) || !parties.of(account()!.id)) return;
      void loadPartyAppearance(account()!.id, socket.data.accessToken);
    });
    // The leader opened a room: the others follow it in with an ordinary join.
    socket.on("party-room", (_data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
      if (!allowed(10)) return fail(cb, "Too many requests.");
      const me = account()!,
        party = parties.of(me.id);
      if (!party || party.leader !== me.id)
        return fail(cb, "Only the party leader starts the game.");
      const seat = getSession(socket.id),
        arena = seat && rooms.get(seat.code);
      if (
        !arena ||
        arena.phase !== "lobby" ||
        arena.practice ||
        arena.bots.size
      )
        return fail(cb, "Open a room first.");
      for (const member of party.members)
        if (member.id !== me.id)
          for (const s of accountSockets(member.id))
            s.emit("party-room", { code: arena.code, mode: arena.mode });
      reply(cb, { ok: true });
    });
    // The client hands over each refreshed login token (they expire hourly).
    socket.on("token", async (data: unknown, cb: unknown) => {
      if (!allowed(10)) return fail(cb, "Too many requests.");
      const token =
        data && typeof data === "object"
          ? (data as { token?: unknown }).token
          : undefined;
      try {
        const next = await authorize(accounts, token);
        if (!ownsConnection(socket))
          return fail(cb, "This connection is no longer active.");
        const current = account();
        if (current && current.id !== next.id)
          return fail(cb, "This connection belongs to a different account.");
        socket.data.accessToken = token;
        socket.data.account = next;
        claimAccount(socket);
        if (!next.guest) void presenceHistory.touch(next.id, token as string);
        socket.data.expiredChecks = 0;
        reply(cb, { ok: true });
      } catch (error) {
        fail(cb, error instanceof Error ? error.message : "Login required.");
      }
    });
    socket.on("create", (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
      stopWatching();
      if (!allowed(15))
        return fail(cb, "Too many requests. Try again in a moment.");
      const result = createSchema.safeParse(data);
      if (!result.success)
        return fail(cb, "Use a display name of 1–20 characters.");
      if (getSession(socket.id))
        return fail(cb, "Leave your current room first.");
      releaseDisconnected();
      if ([...sessions.values()].some((s) => s.accountId === account()!.id))
        return fail(
          cb,
          "This account already has a room. Reconnect or leave that room first.",
        );
      if (rooms.size >= 500)
        return fail(cb, "The arena is busy. Please try again later.");
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code: string;
      do {
        code = Array.from(
          { length: 6 },
          () => chars[randomInt(chars.length)],
        ).join("");
      } while (rooms.has(code));
      const weekly = arcadeWeek(pacificDate());
      if (
        result.data.arcade &&
        (result.data.arcade !== weekly.id ||
          !["duel", "teams"].includes(result.data.mode ?? "duel"))
      )
        return fail(cb, "Choose this week’s arcade event in 1v1 or 2v2.");
      const arena =
        result.data.mode === "raid"
          ? createRaidArena(code, result.data.boss)
          : result.data.arcade
            ? new ArcadeArena(
                code,
                result.data.arcade,
                weekly.week,
                result.data.mode ?? "duel",
              )
            : new Arena(code, result.data.mode ?? "duel");
      arena.rotateArenas = true;
      rooms.set(code, arena);
      attach(arena, result.data.name, cb);
    });
    socket.on("join", (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
      stopWatching();
      if (!allowed(15)) return fail(cb, "Too many requests.");
      const result = joinSchema.safeParse(data);
      if (!result.success)
        return fail(cb, "Enter your name and a six-character room code.");
      if (getSession(socket.id))
        return fail(cb, "Leave your current room first.");
      releaseDisconnected();
      if ([...sessions.values()].some((s) => s.accountId === account()!.id))
        return fail(cb, "This account already has a room.");
      const arena = rooms.get(result.data.code);
      if (!arena)
        return fail(cb, "Room not found. Check the code with your friend.");
      if (arena.practice)
        return fail(cb, "Solo practice sessions cannot be joined.");
      if (arena.bots.size) return fail(cb, "Bot matches cannot be joined.");
      if (arena.players.length >= arena.size)
        return fail(cb, "This room is full.");
      if (arena.phase !== "lobby")
        return fail(cb, "This match has already started.");
      attach(arena, result.data.name, cb);
    });
    socket.on("resume", async (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
      if (!allowed(15)) return fail(cb, "Too many requests.");
      const result = resumeSchema.safeParse(data);
      if (!result.success) return fail(cb, "Invalid session.");
      if (getSession(socket.id))
        return fail(cb, "You already have an active session.");
      const s = sessions.get(result.data.token);
      if (s && s.accountId !== account()!.id)
        return fail(cb, "This room session belongs to a different account.");
      if (!s || s.expires < Date.now())
        return fail(cb, "Your session expired. Create or join a room again.");
      if (s.socketId) return fail(cb, "This player is already connected.");
      const arena = rooms.get(s.code);
      const p = arena?.players.find((p) => p.id === s.id);
      if (!arena || !p) return fail(cb, "Room expired.");
      if (arena.practice) {
        try {
          socket.data.account = await authorize(
            accounts,
            socket.data.accessToken,
            false,
          );
        } catch (error) {
          return fail(
            cb,
            error instanceof Error ? error.message : "Sign in required.",
          );
        }
        if (s.socketId) return fail(cb, "This player is already connected.");
      }
      if (!requirePlayer(cb)) return;
      s.socketId = socket.id;
      socketSessions.set(socket.id, s);
      s.expires = Infinity;
      p.connected = true;
      p.lastInput = blankInput();
      arena.clearInputQueue(p.id);
      if (arena instanceof RaidArena) arena.release(p.id);
      joinChannel(socket, arena);
      resume(arena);
      reply(cb, { ok: true, id: s.id, code: s.code, token: s.token });
      broadcast(arena);
    });
    const withRoom = (
      cb: unknown,
      action: (arena: Arena, id: string) => void,
      rateLimited = true,
    ) => {
      if (!requirePlayer(cb)) return;
      if (rateLimited && !allowed()) return fail(cb, "Too many requests.");
      const s = getSession(socket.id);
      const a = s && rooms.get(s.code);
      if (!s || !a) return fail(cb, "Join a room first.");
      action(a, s.id);
    };
    socket.on("practice", async (data: unknown, cb: unknown) => {
      if (!ownsConnection(socket)) return;
      stopWatching();
      if (!allowed(15)) return fail(cb, "Too many requests.");
      try {
        socket.data.account = await authorize(
          accounts,
          socket.data.accessToken,
          false,
        );
      } catch (error) {
        return fail(
          cb,
          error instanceof Error ? error.message : "Sign in required.",
        );
      }
      if (!requirePlayer(cb)) return;
      const result = identitySchema
        .extend({ character: characterSchema })
        .safeParse(data);
      if (!result.success)
        return fail(cb, "Choose a valid character and display name.");
      if (getSession(socket.id))
        return fail(cb, "Leave your current room first.");
      releaseDisconnected();
      if ([...sessions.values()].some((s) => s.accountId === account()!.id))
        return fail(cb, "This account already has a room.");
      if (rooms.size >= 500)
        return fail(cb, "The arena is busy. Please try again later.");
      let code: string;
      do {
        code = randomBytes(12).toString("hex");
      } while (rooms.has(code));
      const a = new Arena(code);
      a.practice = { unlimitedCooldowns: false, targetAttacks: false };
      rooms.set(code, a);
      attach(a, result.data.name, cb, false);
      a.players[0].character = result.data.character;
      a.add(`target-${code}`, "Training target");
      a.resetPractice();
      broadcast(a);
    });
    // Solo vs an AI bot: a private room nobody else can join, straight to the briefing.
    socket.on("bot-match", (data: unknown, cb: unknown) => {
      stopWatching();
      if (!requirePlayer(cb)) return;
      if (!allowed(15)) return fail(cb, "Too many requests.");
      const result = botMatchSchema.safeParse(data);
      if (!result.success)
        return fail(cb, "Choose a fighter, a display name and a difficulty.");
      if (getSession(socket.id))
        return fail(cb, "Leave your current room first.");
      releaseDisconnected();
      if ([...sessions.values()].some((s) => s.accountId === account()!.id))
        return fail(cb, "This account already has a room.");
      if (rooms.size >= 500)
        return fail(cb, "The arena is busy. Please try again later.");
      let code: string;
      do {
        code = randomBytes(12).toString("hex");
      } while (rooms.has(code));
      const weekly = arcadeWeek(pacificDate());
      if (result.data.arcade && result.data.arcade !== weekly.id)
        return fail(
          cb,
          "The weekly arcade event has changed. Reopen the menu.",
        );
      const a = result.data.arcade
        ? new ArcadeArena(code, result.data.arcade, weekly.week)
        : new Arena(code);
      a.rotateArenas = true;
      rooms.set(code, a);
      attach(a, result.data.name, cb, false);
      a.players[0].character = result.data.character;
      const difficulty: BotDifficulty = result.data.difficulty,
        botId = `bot-${code}`,
        character = FIGHTER_IDS[randomInt(FIGHTER_IDS.length)];
      const bot = a.add(
        botId,
        `${BOT_NAMES[randomInt(BOT_NAMES.length)]} (Bot)`,
        character,
      );
      Object.assign(bot, {
        title: `AI · ${BOT_LABELS[difficulty]}`,
        titleColor: BOT_COLORS[difficulty],
        ready: true,
      });
      a.bots.set(botId, new BotBrain(botId, difficulty, randomInt(1, 2 ** 31)));
      a.start();
      broadcast(a);
    });
    const withPracticeRoom = async (
      cb: unknown,
      action: (a: Arena, id: string) => void,
    ) => {
      if (!allowed()) return fail(cb, "Too many requests.");
      try {
        socket.data.account = await authorize(
          accounts,
          socket.data.accessToken,
          false,
        );
        withRoom(cb, action, false);
      } catch (error) {
        fail(cb, error instanceof Error ? error.message : "Sign in required.");
      }
    };
    socket.on("practice-character", (data: unknown, cb: unknown) =>
      withPracticeRoom(cb, (a, id) => {
        const result = characterSchema.safeParse(data);
        if (!a.practice || !result.success || a.phase === "paused")
          return fail(
            cb,
            "Character changes are available only in active solo practice.",
          );
        a.players.find((p) => p.id === id)!.character = result.data;
        a.resetPractice();
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("practice-reset", (_data: unknown, cb: unknown) =>
      withPracticeRoom(cb, (a) => {
        if (!a.practice || a.phase === "paused")
          return fail(cb, "Reset is available only in active solo practice.");
        a.resetPractice();
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("practice-options", (data: unknown, cb: unknown) =>
      withPracticeRoom(cb, (a) => {
        const result = practiceOptionsSchema.safeParse(data);
        if (!a.practice || !result.success)
          return fail(cb, "Invalid practice options.");
        a.practice = result.data;
        a.nextPracticeZone = a.time + 1;
        if (!a.practice.targetAttacks) {
          const target = a.players[1];
          target.lastInput = blankInput();
          a.projectiles = a.projectiles.filter((p) => p.owner !== target.id);
          a.zones = a.zones.filter((z) => z.owner !== target.id);
        }
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("select", (data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        const result = characterSchema.safeParse(data);
        if (a.phase !== "lobby" || !result.success)
          return fail(cb, "Character selection is unavailable.");
        const p = a.players.find((p) => p.id === id)!;
        if (p.character !== result.data) p.flair = undefined;
        p.character = result.data;
        const owner = account();
        if (owner && !owner.guest)
          void portraitChoice.save(
            owner.id,
            socket.data.accessToken,
            result.data,
          );
        p.ready = false;
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("raid-config", async (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb) || !allowed(10)) return;
      const s = getSession(socket.id),
        a = s && rooms.get(s.code);
      if (
        !(a instanceof RaidArena) ||
        a.phase !== "lobby" ||
        a.players[0]?.id !== s?.id
      )
        return fail(
          cb,
          "Only the raid host can change the challenge in the lobby.",
        );
      // Raids have one difficulty now (Peril 3); old clients may still ask.
      const result = z
        .object({
          peril: z.number().int().min(1).max(3),
          daily: z.literal(false).optional(),
        })
        .strict()
        .safeParse(data);
      if (!result.success) return fail(cb, "Choose a valid raid challenge.");
      a.configure(RAID.maxPeril);
      for (const p of a.players) p.ready = false;
      reply(cb, { ok: true });
      broadcast(a);
    });
    socket.on("raid-ping", (data: unknown, cb: unknown) =>
      withRoom(
        cb,
        (a, id) => {
          const kind = z
            .object({
              kind: z.enum(
                Object.keys(RAID_PINGS) as ["stack", "revive", "bait"],
              ),
            })
            .strict()
            .safeParse(data);
          if (!(a instanceof RaidArena) || !kind.success)
            return fail(cb, "Pings are for raids.");
          if (!a.ping(id, kind.data.kind))
            return fail(cb, "Wait a moment before pinging again.");
          reply(cb, { ok: true });
          broadcast(a);
        },
        false,
      ),
    );
    socket.on("raid-rune", (data: unknown, cb: unknown) =>
      withRoom(
        cb,
        (a, id) => {
          const result = z
            .object({ rune: z.enum(DREAM_RUNES) })
            .strict()
            .safeParse(data);
          if (
            !(a instanceof RaidArena) ||
            !result.success ||
            !a.callRune(id, result.data.rune)
          )
            return fail(
              cb,
              "Only the awake Dreamer can call a rune. Wait a moment between calls.",
            );
          reply(cb, { ok: true });
          broadcast(a);
        },
        false,
      ),
    );
    socket.on("raid-drill", (data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        const result = z
          .object({
            kind: z
              .enum(Object.keys(RAID_ATTACKS) as [RaidAttack, ...RaidAttack[]])
              .nullable(),
          })
          .strict()
          .safeParse(data);
        if (
          !(a instanceof RaidArena) ||
          !result.success ||
          (result.data.kind !== null &&
            !raidAttacksOf(a.raid.boss).includes(result.data.kind))
        )
          return fail(cb, "Choose an attack to practise.");
        if (a.players[0]?.id !== id)
          return fail(cb, "The host picks the practice attack.");
        const kind = result.data.kind;
        const ok =
          kind === null
            ? a.stopDrill()
            : a.raid.drill
              ? a.setDrill(kind)
              : a.startDrill(kind);
        if (!ok) return fail(cb, "Practice opens from the raid lobby.");
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("ready", (_data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        if (a.phase !== "lobby")
          return fail(cb, "The match has already started.");
        const p = a.players.find((p) => p.id === id)!;
        p.ready = !p.ready;
        const half = a.size / 2;
        if (
          a.players.length >= a.minPlayers &&
          (a.mode !== "teams" ||
            a.players.filter((p) => a.teamOf(p) === 0).length === half) &&
          a.players.every((p) => p.ready && p.connected)
        )
          startArena(a);
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    // 2v2 lobby: move to the other team when it has a free slot.
    socket.on("team", (data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        const result = teamSchema.safeParse(data);
        if (a.mode !== "teams" || a.phase !== "lobby" || !result.success)
          return fail(cb, "Teams can only be changed in a 2v2 lobby.");
        const team = result.data.team;
        const p = a.players.find((p) => p.id === id)!;
        if (a.teamOf(p) === team) return reply(cb, { ok: true });
        if (a.players.filter((o) => a.teamOf(o) === team).length >= a.size / 2)
          return fail(cb, "That team is full.");
        p.team = team;
        for (const o of a.players) o.ready = false;
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    // The host (first player in the room) can deal random, even teams.
    socket.on("shuffle", (_data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        if (a.mode !== "teams" || a.phase !== "lobby")
          return fail(cb, "Teams can only be shuffled in a 2v2 lobby.");
        if (a.players[0]?.id !== id)
          return fail(cb, "Only the room host can shuffle teams.");
        const order = a.players.map((p) => ({ p, k: randomInt(1 << 30) }));
        order.sort((x, y) => x.k - y.k);
        order.forEach(({ p }, i) => (p.team = i % 2 === 0 ? 0 : 1));
        for (const o of a.players) o.ready = false;
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    // Mastery flair: a ring in your tier's colour, checked against your records.
    socket.on("flair", async (data: unknown, cb: unknown) => {
      if (!allowed(10)) return fail(cb, "Too many requests.");
      const tier =
        data && typeof data === "object"
          ? (data as { tier?: unknown }).tier
          : undefined;
      const wanted = MASTERY_TIERS.find((t) => t.name === tier);
      if (tier !== null && !wanted) return fail(cb, "Unknown mastery tier.");
      const s = getSession(socket.id);
      const arena = s && rooms.get(s.code);
      const p = arena?.players.find((q) => q.id === s!.id);
      if (!arena || !p) return fail(cb, "Join a room first.");
      if (!wanted) {
        p.flair = undefined;
        reply(cb, { ok: true });
        return broadcast(arena);
      }
      try {
        const progress = progressSchema.parse(
          await accounts.rpc(socket.data.accessToken, "arena_my_progress", {}),
        );
        if (!requirePlayer(cb) || getSession(socket.id) !== s) return;
        const played = progress.fighters[p.character]?.matches ?? 0;
        if (played < wanted.matches)
          return fail(cb, "That mastery tier isn't unlocked for this fighter.");
        p.flair = wanted.name;
        reply(cb, { ok: true });
        broadcast(arena);
      } catch {
        fail(cb, "Mastery couldn't be checked right now.");
      }
    });
    // Party rules: the host switches them on or off in the lobby.
    socket.on("mutators", (data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        if (
          a.phase !== "lobby" ||
          a.bots.size ||
          a.practice ||
          a.mode === "raid"
        )
          return fail(cb, "Party rules can only be changed in a room lobby.");
        if (a.players[0]?.id !== id)
          return fail(cb, "Only the room host can change the party rules.");
        if (a.arcade)
          return fail(cb, "Weekly arcade rules are fixed for everyone.");
        const result = mutatorsSchema.safeParse(data);
        if (!result.success) return fail(cb, "Unknown party rule.");
        a.mutators = new Set(result.data.ids);
        // Everyone confirms again under the new rules.
        for (const p of a.players) p.ready = false;
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("instructions-ready", (_data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        if (!a.acknowledgeInstructions(id))
          return fail(cb, "Instructions are not awaiting confirmation.");
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("rite", (data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        const result = riteSchema.safeParse(data);
        if (!result.success || !a.pickRite(id, result.data.id))
          return fail(cb, "That upgrade is not on offer.");
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    // A client whose appearance cache missed a revision asks for it again.
    socket.on("snapshot-meta", (_data: unknown, cb: unknown) => {
      if (typeof cb !== "function") return;
      if (!allowed(30)) return fail(cb, "Too many requests.");
      const code = getSession(socket.id)?.code ?? watchers.get(socket.id)?.code;
      const arena = code ? rooms.get(code) : undefined;
      if (!arena || !socket.rooms.has(arena.code))
        return fail(cb, "Join a room first.");
      const tracker = metaTracker(arena);
      cb({ ok: true, code: arena.code, meta: tracker.meta(arena.players) });
    });
    // Round-trip check for the in-battle ping badge: answer at once.
    socket.on("rtt", (_data: unknown, cb: unknown) => {
      if (typeof cb === "function") cb();
    });
    socket.on("input", (data: unknown) =>
      withRoom(undefined, (a, id) => {
        const result = inputSchema.safeParse(data);
        if (result.success)
          a.enqueue(
            a.players.find((p) => p.id === id)!,
            result.data,
          );
      }),
    );
    socket.on("rematch", (_data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        if (a instanceof RaidArena) {
          if (
            a.phase !== "finished" ||
            !a.heroes().length ||
            !a.heroes().every((p) => p.connected)
          )
            return fail(cb, "Return to the lobby to refill the team.");
          a.players.find((p) => p.id === id)!.ready = true;
          if (a.heroes().every((p) => p.ready)) a.retry();
          reply(cb, { ok: true });
          broadcast(a);
          return;
        }
        if (
          a.phase !== "finished" ||
          a.players.length < a.minPlayers ||
          (a.mode !== "ffa" && a.players.length !== a.size) ||
          !a.players.every((p) => p.connected && !p.out)
        )
          return fail(
            cb,
            a.size > 2
              ? "Everyone must still be here for a rematch. Return to the lobby to refill the room."
              : "Both players must be connected for a rematch.",
          );
        const p = a.players.find((p) => p.id === id)!;
        p.ready = true;
        if (a.players.every((p) => p.ready)) a.start();
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("lobby", (_data: unknown, cb: unknown) =>
      withRoom(cb, (a) => {
        if (a instanceof RaidArena && a.raid.drill) {
          a.stopDrill();
          reply(cb, { ok: true });
          broadcast(a);
          return;
        }
        if (a.phase !== "finished") return fail(cb, "Finish the match first.");
        // Raid stand-ins hand back their seats in the lobby.
        if (a instanceof RaidArena)
          for (const id of [...(a.raid.standIns ?? [])]) a.release(id);
        if (a.bots.size) return fail(cb, "Leave to return to the menu.");
        a.phase = "lobby";
        a.restoreChosen();
        a.players = a.players.filter((p) =>
          [...sessions.values()].some(
            (s) => s.code === a.code && s.id === p.id,
          ),
        );
        for (const p of a.players) {
          p.ready = false;
          p.out = false;
        }
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("leave", (data: unknown, cb: unknown) => {
      let s = getSession(socket.id);
      const token =
        data && typeof data === "object"
          ? (data as { token?: unknown }).token
          : undefined;
      if (!s && typeof token === "string") {
        const reserved = sessions.get(token);
        if (reserved && reserved.accountId !== account()?.id)
          return fail(cb, "This room session belongs to a different account.");
        if (reserved?.socketId && reserved.socketId !== socket.id)
          return fail(cb, "This room is active in another tab.");
        s = reserved;
      }
      if (s) {
        socket.leave(s.code);
        detach(s, true);
      }
      reply(cb, { ok: true });
    });
    // Only the active connection may act. Starting or joining a room takes
    // you out of the Plaza.
    socket.use((args: unknown[], next: (error?: Error) => void) => {
      if (!ownsConnection(socket)) {
        fail(args.at(-1), "This connection is no longer active.");
        return;
      }
      const [event] = args;
      if (
        ["create", "join", "practice", "bot-match", "resume", "watch"].includes(
          String(event),
        ) &&
        plaza.plazaOf(socket.id) !== undefined
      ) {
        plaza.leave(socket.id);
        socket.emit("plaza-closed");
      }
      next();
    });
    // ───────────── Plaza (hub redesign phase 3) ─────────────
    socket.on("plaza-join", (data: unknown, cb: unknown) => {
      if (!allowed(10) || !requirePlayer(cb)) return;
      if (getSession(socket.id))
        return fail(cb, "Leave your room before visiting the Plaza.");
      const parsed = characterSchema.safeParse(
        (data as { character?: unknown } | null)?.character,
      );
      if (!parsed.success) return fail(cb, "Choose a fighter first.");
      const me = account()!;
      const visitor = plaza.join(socket.id, me.id, {
        name: me.displayName,
        title: me.title ?? null,
        titleColor: me.titleColor ?? null,
        level: null,
        character: parsed.data,
        skin: null,
      });
      reply(cb, { ok: true, plaza: visitor.plaza, me: visitor.profile.id });
      const orbs = plaza.orbsFor(socket.id);
      if (orbs) socket.emit("plaza-orbs", orbs);
      const token = socket.data.accessToken as string | undefined;
      if (token) void plazaAppearance.refresh(socket.id, token, true);
      if (token) void sendTreats(token);
      if (!me.guest)
        void portraitChoice.save(me.id, socket.data.accessToken, parsed.data);
    });
    socket.on("plaza-look", (data: unknown, cb: unknown) => {
      if (!allowed(10)) return;
      if (plaza.plazaOf(socket.id) === undefined)
        return fail(cb, "Not in the Plaza.");
      const parsed = characterSchema.safeParse(
        (data as { character?: unknown } | null)?.character,
      );
      if (!parsed.success) return fail(cb, "Choose a fighter first.");
      if (plaza.profileOf(socket.id)?.character !== parsed.data) {
        plaza.updateProfile(socket.id, { character: parsed.data, skin: null });
        const owner = account();
        if (owner && !owner.guest)
          void portraitChoice.save(
            owner.id,
            socket.data.accessToken,
            parsed.data,
          );
      }
      const token = socket.data.accessToken as string | undefined;
      if (token) void plazaAppearance.refresh(socket.id, token, false);
      reply(cb, { ok: true });
    });
    socket.on("plaza-input", (data: unknown) => {
      if (!allowed(40)) return;
      const d = data as { dx?: unknown; dy?: unknown } | null;
      plaza.input(socket.id, d?.dx, d?.dy);
    });
    socket.on("plaza-jump", () => {
      if (!allowed(10)) return;
      plaza.jump(socket.id);
    });
    socket.on("plaza-dash", () => {
      if (!allowed(10)) return;
      plaza.dash(socket.id);
    });
    socket.on("plaza-emote", (data: unknown, cb: unknown) => {
      if (!allowed(10)) return;
      const ok = plaza.emote(
        socket.id,
        (data as { emote?: unknown } | null)?.emote,
        Date.now(),
      );
      reply(
        cb,
        ok
          ? { ok: true }
          : { ok: false, error: "Wait a moment between emotes." },
      );
    });
    // Treats (migration 049): regular crops from your barn, thrown for everyone.
    const sendTreats = async (token: string) => {
      try {
        const n = await accounts.rpc(token, "arena_plaza_treats", {});
        if (plaza.plazaOf(socket.id) !== undefined && typeof n === "number")
          socket.emit("plaza-treats", { n });
      } catch {
        // Older databases have no treats; the button stays at 0.
      }
    };
    let treatPending = false;
    socket.on("plaza-treat", async (_data: unknown, cb: unknown) => {
      if (!allowed(10)) return;
      const copy = plaza.plazaOf(socket.id);
      if (copy === undefined) return fail(cb, "Not in the Plaza.");
      const token = socket.data.accessToken as string | undefined;
      if (!token || treatPending) return fail(cb, "One moment…");
      if (!plaza.treatReady(socket.id, Date.now()))
        return fail(cb, "Wait a moment between treats.");
      treatPending = true;
      try {
        // A fresh id per throw: a retry of this request can't take two crops.
        const r = (await accounts.rpc(token, "arena_plaza_treat", {
          p_ref: randomUUID(),
        })) as {
          ok?: boolean;
          crop?: string;
          left?: number;
          error?: string;
        } | null;
        if (!r?.ok || !r.crop)
          return reply(cb, {
            ok: false,
            error: r?.error ?? "No crops to throw yet.",
            treats: r?.left ?? 0,
          });
        const thrown = plaza.treat(socket.id, r.crop);
        if (thrown) toPlaza(copy, "plaza-treat", thrown);
        reply(cb, { ok: true, crop: r.crop, treats: r.left ?? 0 });
      } catch (error) {
        fail(
          cb,
          error instanceof AccountError
            ? error.message
            : "Treats can't be thrown right now.",
        );
      } finally {
        treatPending = false;
      }
    });
    let bobaPending = false;
    socket.on("plaza-act", async (data: unknown, cb: unknown) => {
      if (!allowed(10)) return;
      const spot = (data as { spot?: unknown } | null)?.spot;
      if (plaza.plazaOf(socket.id) === undefined)
        return fail(cb, "Not in the Plaza.");
      if (spot === "photo") {
        if (!plaza.at(socket.id, "photo"))
          return fail(cb, "Stand on the Photo Spot first.");
        recordPlaza(socket.id, { kind: "photo" });
        return reply(cb, { ok: true });
      }
      if (spot !== "cafe") return fail(cb, "Nothing to do here.");
      if (!plaza.at(socket.id, "cafe"))
        return fail(cb, "Walk up to the Volt Boba truck first.");
      if (plaza.boosted(socket.id))
        return fail(cb, "Your boba boost is still active.");
      const token = socket.data.accessToken as string | undefined;
      if (!token || bobaPending) return fail(cb, "One moment…");
      bobaPending = true;
      try {
        // A fresh id per purchase: a retry of this request can't charge twice.
        const paid = (await accounts.rpc(token, "arena_plaza_boba", {
          p_ref: randomUUID(),
        })) as { ok?: boolean; leaves?: number } | null;
        if (!paid?.ok)
          return reply(cb, {
            ok: false,
            error: "Not enough Gold Leaves.",
            leaves: paid?.leaves,
          });
        plaza.boost(socket.id);
        reply(cb, { ok: true, leaves: paid.leaves });
      } catch (error) {
        fail(
          cb,
          error instanceof AccountError
            ? error.message
            : "Volt Boba is closed right now.",
        );
      } finally {
        bobaPending = false;
      }
    });
    socket.on("plaza-leave", (_data: unknown, cb: unknown) => {
      plaza.leave(socket.id);
      reply(cb, { ok: true });
    });
    socket.on("connection-report", (data: unknown) => {
      // One report per connection, from a signed-in player.
      const who = account();
      if (!who || socket.data.connectionReported) return;
      const result = connectionReportSchema.safeParse(data);
      if (!result.success) return;
      socket.data.connectionReported = true;
      connectionLog("arena-client-drop", { ...result.data, account: who.id });
    });
    socket.on("battle-loaded", (data: unknown) =>
      withRoom(undefined, (a, id) => {
        // One per battle renderer; a cap keeps a looping client quiet.
        const sent = (socket.data.loadReports ?? 0) as number;
        if (sent >= 20) return;
        const result = battleLoadSchema.safeParse(data);
        if (!result.success) return;
        socket.data.loadReports = sent + 1;
        connectionLog("arena-load", {
          ...result.data,
          account: account()?.id,
          room: a.code,
          mode: a.mode,
          phase: a.phase,
          character: a.players.find((p) => p.id === id)?.character,
        });
      }),
    );
    socket.on("disconnect", (reason: string) => {
      // Record why a player in a room dropped: the opponent only sees
      // "Opponent disconnected", and Socket.IO's reason says whether the
      // connection closed, errored, went quiet (ping timeout) or was kicked.
      const dropped = getSession(socket.id);
      if (dropped) {
        const arena = rooms.get(dropped.code);
        const conn = socket.conn as unknown as {
          transport?: { name?: string };
        };
        connectionLog("arena-disconnect", {
          reason,
          transport: conn.transport?.name ?? "unknown",
          ...(socket.data.sessionReplaced ? { replaced: true } : {}),
          room: dropped.code,
          mode: arena?.mode,
          phase: arena?.phase,
          account: dropped.accountId,
          connectedFor: Math.round(
            (Date.now() - socket.handshake.issued) / 1000,
          ),
        });
      }
      const who = account();
      if (who && activeAccounts.get(who.id) === socket.id)
        activeAccounts.delete(who.id);
      const stillOnline =
        who &&
        [...io.sockets.sockets.values()].some(
          (other) =>
            other.id !== socket.id &&
            other.connected &&
            other.data.account?.id === who.id,
        );
      if (who && !who.guest && !stillOnline)
        void presenceHistory.touch(who.id, socket.data.accessToken, true);
      if (who && !stillOnline) leaveParty(who.id);
      plaza.leave(socket.id);
      laggingSockets.delete(socket.id);
      stopWatching();
      const s = getSession(socket.id);
      if (s) detach(s);
    });
  });
  let ticks = 0;
  const step = () => {
    const started = diagnostics.now();
    ticks++;
    for (const s of sessions.values())
      if (!s.socketId && s.expires <= Date.now()) expire(s);
    for (let a of [...rooms.values()]) {
      const before = a.phase;
      a.drainInputs();
      a.tick();
      if (before !== a.phase && a.phase === "finished")
        // Bots are always up for a rematch.
        for (const p of a.players) p.ready = a.bots.has(p.id);
      if (
        ticks % Math.round(RULES.tick / RULES.snapshot) === 0 ||
        before !== a.phase
      )
        broadcast(a);
    }
    diagnostics.tick(started);
  };
  const timer =
    options.autoTick === false
      ? undefined
      : setInterval(step, 1000 / RULES.tick);
  /**
   * Plaza events the database must see go one at a time per player, in order,
   * so caps hold and the newest progress reaches the browser last.
   */
  const plazaQueue = new Map<string, Promise<void>>();
  const recordPlaza = (key: string, event: Omit<PlazaRecord, "player">) => {
    const player = plaza.accountOf(key);
    if (!player || !accounts.recordPlaza) return;
    const run = (plazaQueue.get(player) ?? Promise.resolve())
      .then(() => accounts.recordPlaza!({ player, ...event }))
      .then((progress) => {
        const socket = io.sockets.sockets.get(key);
        if (progress && socket?.connected)
          socket.emit("plaza-progress", progress);
      })
      .catch(() => undefined)
      .finally(() => {
        if (plazaQueue.get(player) === run) plazaQueue.delete(player);
      });
    plazaQueue.set(player, run);
  };
  const toPlaza = (copy: number, event: string, data: unknown) => {
    for (const key of plaza.keys())
      if (plaza.plazaOf(key) === copy)
        io.sockets.sockets.get(key)?.emit(event, data);
  };
  const plazaEvent = (e: PlazaEvent) => {
    if (e.type === "orb") recordPlaza(e.key, { kind: "orb", ref: e.ref });
    else if (e.type === "goal") recordPlaza(e.key, { kind: "goal" });
    else if (e.type === "lap") recordPlaza(e.key, { kind: "lap", ms: e.ms });
    else if (e.type === "cheers")
      recordPlaza(e.key, { kind: "cheers", n: e.n });
    else if (e.type === "news") toPlaza(e.plaza, "plaza-news", e.news);
    else toPlaza(e.plaza, "plaza-orbs", e.orbs);
  };
  /** Move everyone in the Plaza, run the pitch and the orbs, send each player what is near. */
  let plazaTicks = 0;
  const plazaStep = (now = Date.now()) => {
    plazaTicks++;
    for (const e of plaza.step(1 / PLAZA.tick, now)) plazaEvent(e);
    if (plazaTicks % Math.round(PLAZA.tick / PLAZA.send) !== 0) return;
    for (const key of plaza.keys()) {
      const socket = io.sockets.sockets.get(key);
      if (!socket) {
        plaza.leave(key);
        continue;
      }
      const view = plaza.view(key);
      if (!view) continue;
      if (view.profiles.length) socket.emit("plaza-profiles", view.profiles);
      socket.emit("plaza-state", view.state);
    }
  };
  const plazaTimer =
    options.autoTick === false
      ? undefined
      : setInterval(() => {
          if (plaza.size) plazaStep();
        }, 1000 / PLAZA.tick);
  const diagnosticsTimer =
    diagnosticsEvery > 0 && options.autoTick !== false
      ? setInterval(
          () =>
            console.log(
              "arena-diagnostics",
              JSON.stringify(
                diagnostics.report({
                  rooms: rooms.size,
                  sockets: io.engine.clientsCount,
                  plaza: plaza.size,
                }),
              ),
            ),
          diagnosticsEvery * 1000,
        )
      : undefined;
  const accountTimer =
    options.autoTick === false
      ? undefined
      : setInterval(() => {
          for (const socket of io.sockets.sockets.values())
            if (socket.data.account) void refreshSocket(socket);
        }, 30000);
  return {
    app,
    http,
    io,
    rooms,
    sessions,
    ledger,
    step,
    broadcast,
    plaza,
    plazaStep,
    diagnostics,
    close: async () => {
      if (timer) clearInterval(timer);
      if (plazaTimer) clearInterval(plazaTimer);
      if (accountTimer) clearInterval(accountTimer);
      if (diagnosticsTimer) clearInterval(diagnosticsTimer);
      diagnostics.close();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await presenceHistory.flush();
    },
  };
}
