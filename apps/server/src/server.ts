import { FighterAppearance, PortraitChoice } from "./fighter-appearance.js";
import { ServerDiagnostics } from "./diagnostics.js";
import { PresenceHistory } from "./presence-history.js";
import { apiClock, apiCors, clientOrigins } from "./api-cors.js";
import { ArcadeArena } from "./arcade.js";
import {
  arcadeWeek,
  ARCADE_IDS,
  type ArcadeId,
} from "../../../packages/shared/src/arcade.js";
import { RaidArena } from "./raid.js";
import { createRaidArena } from "./raid-bosses.js";
import { createSpireArena, isSpireArena, type SpireRoom } from "./spire.js";
import {
  SPIRE_BUILT_ZONES,
  spireStartFrom,
  spireZoneOf,
  spireZoneStart,
  spireZoneTop,
  type SpireMember,
} from "../../../packages/shared/src/spire.js";
import type { ActivityReceipt } from "../../../packages/shared/src/shop.js";
import {
  DREAM_RUNES,
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
  CHARACTERS,
  blankInput,
  packSnapshot,
  MetaTracker,
  type WireSnapshot,
  practiceOptionsSchema,
  FIGHTER_IDS,
  type Fighter,
  type Reply,
  picksHidden,
  isAvatar,
  pickTakenBy,
  pickClashes,
  veilPlayers,
} from "../../../packages/shared/src/index.js";
import { Arena } from "./simulation.js";
import { DRAIN_MESSAGE, busyRoom, trackWrites, waitForDrain } from "./drain.js";
/** Every champion's basic attack: spammed, so it never forces a snapshot. */
const BASIC_IDS = new Set(Object.values(CHARACTERS).map((c) => c.basic.id));
import {
  battleArtSchema,
  battleLoadSchema,
  battlePerfSchema,
  connectionReportSchema,
} from "../../../packages/shared/src/connection.js";
import { PlazaWorld, type PlazaEvent } from "./plaza.js";
import {
  PLAZA,
  PLAZA_FISH,
  PLAZA_FISH_BY_ID,
  PLAZA_FISH_RARITY,
  type PlazaRecord,
} from "../../../packages/shared/src/plaza.js";
import {
  PARTY_AWAY_MS,
  Parties,
  type Party,
  type PartyAppearance,
} from "./party.js";
import { ChatReports, reportContext } from "./chat-moderation.js";
import {
  CHAT_LIMITS,
  CHAT_MODES,
  type ChatLine,
  type ChatMode,
  type ChatQuick,
} from "../../../packages/shared/src/chat.js";
import {
  ChatHub,
  plazaEmoteFor,
  type ChatMember,
  type ChatRoute,
} from "./chat.js";
import { PlazaAppearance } from "./plaza-appearance.js";
import { MatchLedger, matchSummary } from "./match-summary.js";
import { QuickQueue, type QueueEntry, type QueueLeave } from "./matchmaking.js";
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
    /** Quick Match found nobody and the player took the sparring bot. */
    quick: z.literal(true).optional(),
  })
  .strict();
const quickSchema = identitySchema
  .extend({ character: characterSchema })
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
    // The Spire (season 0): a climb in a raid room, one zone per room. The
    // first floor of a built zone (0: zone 1, as before zones). Whether the
    // party has earned it is checked against storage when the climb starts.
    spire: z
      .number()
      .int()
      .refine(
        (f) =>
          f === 0 ||
          SPIRE_BUILT_ZONES.some((zone) => spireZoneStart(zone) === f),
      )
      .optional(),
  })
  .strict();
const teamSchema = z
  .object({ team: z.union([z.literal(0), z.literal(1)]) })
  .strict();
const riteSchema = z.object({ id: z.string().min(1).max(64) }).strict();
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
/** Six-character room codes: no 0/O or 1/I, so a code read aloud works. */
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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
import { TickClock } from "./tick-clock.js";
import { z, ZodError } from "zod";
import type { Request, Response, NextFunction } from "express";
import {
  FriendPush,
  validDevice,
  webPushSender,
  type PushSender,
} from "./push.js";
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
    /** How long a party keeps a member whose connection dropped (party.ts). */
    partyAwayMs?: number;
    /**
     * Typed chat lines on (quick chat is always on). Defaults to the
     * CHAT_FREE_TEXT environment switch ("on"); off until reporting ships
     * (docs/chat-plan.md).
     */
    chatFreeText?: boolean;
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
    /**
     * Sends friends'-message notifications (push.ts). Defaults to Web Push
     * with the PUSH_VAPID_* keys, or none without them; null turns it off.
     */
    push?: PushSender | null;
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
  /** Saves still on their way to the database (drain waits for them). */
  const inflight = new Set<Promise<unknown>>();
  const accounts = trackWrites(
    options.accounts ?? createAccountProvider(),
    inflight,
  );
  /**
   * A deploy is replacing this server (drain, below): matches already running
   * play on to the end, and no new ones start here.
   */
  let draining = false;
  /** Notifications of friends' messages to players who are away (push.ts). */
  const pushSender =
    options.push === undefined
      ? options.autoTick === false
        ? null
        : webPushSender()
      : options.push;
  const friendPush =
    pushSender && accounts.pushDevices
      ? new FriendPush(accounts.pushDevices, pushSender)
      : null;
  const fighterAppearance = new FighterAppearance(accounts);
  const portraitChoice = new PortraitChoice(accounts);
  app.use("/api", apiCors(clientOrigins()));
  app.use("/api", apiClock());
  app.use(express.json({ limit: "4kb" }));
  const http = createServer(app);
  const io = new Server(http, {
    maxHttpBufferSize: 4096,
    // The static site (CLIENT_ORIGIN) and the iPhone app (api-cors.ts).
    cors: { origin: [...clientOrigins()] },
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
  /**
   * Room invitations still open ("sender:friend" → room and expiry): the
   * friend who joins that room through one joins the sender's party too, and
   * a Decline reaches the sender (their button stops saying Invited).
   */
  const roomInvitesOut = new Map<string, { code: string; expiresAt: number }>();
  const parties = new Parties();
  const partyAwayMs = options.partyAwayMs ?? PARTY_AWAY_MS;
  /** Pending checks on members whose connection dropped. */
  const partyAwayTimers = new Set<ReturnType<typeof setTimeout>>();
  /** In-game chat (docs/chat-plan.md): party and room channels. */
  /** Reports from chat, and the pause after several (chat-moderation.ts). */
  const chatReports = new ChatReports();
  /** Until when an admin stopped each online account typing (ms). */
  const chatStops = new Map<string, number>();
  /** Each online account's chat setting (free, quick only, off). */
  const chatModes = new Map<string, ChatMode>();
  /** Each online account's friends (id → name), for friends' messages. */
  const chatFriends = new Map<string, Map<string, string>>();
  /**
   * Quick Match (matchmaking.ts): who is searching, and how each searching
   * socket is told it was paired (set by that socket's connection).
   */
  const quickQueue = new QuickQueue<
    QueueEntry & { name: string; matched: (arena: Arena) => void }
  >((a, b) => !chat.blocks(a, b));
  /** Rooms Quick Match made: "human" (two searchers) or "bot" (fallback). */
  const quickRooms = new WeakMap<Arena, "human" | "bot">();
  /** Players connected with an account, for "N online" while searching. */
  const onlineCount = () =>
    new Set(
      [...io.sockets.sockets.values()]
        .map((s) => (s.data.account as Account | undefined)?.id)
        .filter(Boolean),
    ).size;
  /**
   * One line per finished match (docs/pvp-plan.md, item 2): who fought whom
   * with what, who won, how long it took and whether Quick Match made it.
   * No names or accounts: the match tag joins it to the arena-perf lines.
   */
  const logMatch = (arena: Arena) => {
    const humans = arena.players.filter((p) => !arena.bots.has(p.id));
    connectionLog("arena-match", {
      tag: arena.matchTag,
      mode: arena.mode,
      arcade: arena.arcade?.id ?? null,
      humans: humans.length,
      bots: arena.bots.size,
      botLevel: [...arena.bots.values()][0]?.difficulty ?? null,
      quick: quickRooms.get(arena) ?? null,
      fighters: arena.players.map((p) => ({
        character: p.character,
        team: arena.teamOf(p),
        bot: arena.bots.has(p.id),
      })),
      winnerTeam: arena.winnerTeam,
      rounds: arena.roundLog.length,
      seconds: Math.round(arena.playTime),
      arena: arena.arenaId,
    });
  };
  const logQueue = (entry: QueueEntry, outcome: "human" | QueueLeave) =>
    connectionLog("arena-queue", {
      outcome,
      waitMs: Date.now() - entry.since,
      online: onlineCount(),
      queued: quickQueue.size,
    });
  const chat = new ChatHub({
    // Typed lines are on unless CHAT_FREE_TEXT=off (a switch to pause them).
    freeText: () =>
      options.chatFreeText ?? process.env.CHAT_FREE_TEXT !== "off",
    typingStopped: (id) => {
      if (chatReports.isPaused(id))
        return "After several reports you can't type for a while. Quick chat still works.";
      const until = chatStops.get(id);
      if (until && until > Date.now())
        return `An admin stopped your chat until ${new Date(until).toUTCString().slice(5, 22)} UTC. Quick chat still works.`;
      return null;
    },
  });
  /**
   * Read this account's friends, who they may message (kept per account;
   * read again whenever the chat's Friends tab opens, so a friend added a
   * moment ago is there).
   */
  const loadChatFriends = async (socket: import("socket.io").Socket) => {
    const who = socket.data.account as Account | undefined;
    const token = socket.data.accessToken as string | undefined;
    if (!who || !token) return;
    try {
      const list = await accounts.rpc(token, "arena_friends", {});
      const friends = (
        list as { friends?: { id?: unknown; name?: unknown }[] } | null
      )?.friends;
      if (!Array.isArray(friends)) return;
      chatFriends.set(
        who.id,
        new Map(
          friends
            .filter((f) => typeof f?.id === "string")
            .map((f) => [f.id as string, String(f.name ?? "")]),
        ),
      );
    } catch {
      // Kept as it was.
    }
  };
  /** Read who this account blocked, so chat delivers nothing between them. */
  const loadChatBlocks = async (socket: import("socket.io").Socket) => {
    const who = socket.data.account as Account | undefined;
    const token = socket.data.accessToken as string | undefined;
    if (!who || !token) return;
    // Their friends, who they may message.
    void loadChatFriends(socket);
    // And whether an admin stopped them typing.
    void accounts.chatStoppedUntil?.(who.id).then((until) => {
      const ms = until ? Date.parse(until) : NaN;
      if (Number.isFinite(ms)) chatStops.set(who.id, ms);
      else chatStops.delete(who.id);
    });
    try {
      const list = await accounts.rpc(token, "arena_blocked_players", {});
      if (!Array.isArray(list)) return;
      chat.setBlocks(
        who.id,
        list
          .map((b) => (b as { id?: unknown } | null)?.id)
          .filter((id): id is string => typeof id === "string"),
      );
    } catch {
      // Kept as it was; the next change to the list tries again.
    }
  };
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
      const away = parties.isAway(m.id) ? { away: true } : {};
      return saved
        ? {
            ...m,
            skin: saved.looks[m.character] ?? null,
            look: saved.look,
            avatar: saved.avatar ?? null,
            ...away,
          }
        : { ...m, ...away };
    }),
    // The room the party plays in (the leader's), and who was invited.
    room: party.room ?? null,
    invites: parties.pending(party.code, Date.now()),
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
    const [skins, progress, avatar] = await Promise.allSettled([
      read("arena_my_looks"),
      read("arena_raid_progress"),
      read("arena_my_avatar"),
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
      avatar:
        avatar.status === "fulfilled"
          ? isAvatar(avatar.value)
            ? (avatar.value as string)
            : null
          : (before?.avatar ?? null),
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
      // Logged so a player who can't get online leaves a trace (the client
      // renews an expired login and connects again).
      console.log(
        `arena-auth-refused ${JSON.stringify({
          status: error instanceof AccountError ? error.status : 503,
          reason: error instanceof Error ? error.message : "unknown",
        })}`,
      );
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
      void loadChatBlocks(socket);
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
      // A new avatar (or look) reaches the party's members.
      if (parties.of(account.id))
        void loadPartyAppearance(account.id, socket.data.accessToken);
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
        ) {
          socket.emit("friends-changed");
          // A block or unblock changes who hears whom in chat.
          if (id === target) void loadChatBlocks(socket);
        }
      }
    },
    connectionLog,
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
      const others = me && arena ? arena.enemiesOf(me, true) : [];
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
        // A pick in a PvP lobby is secret (friends may be on the other side).
        fighter: me && arena && !picksHidden(arena) ? me.character : null,
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
      // A body over its route's limit (a picture, say): the player's to fix.
      if ((error as { type?: unknown } | null)?.type === "entity.too.large")
        return res.status(413).json({ error: "That's too large to send." });
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
    if (isSpireArena(a)) return void startSpire(a);
    const secret = picksHidden(a);
    a.start();
    if (secret) savePicks(a);
  }
  /**
   * The match has started and every pick is public: save each player's
   * fighter as their friends' portrait (held back in the lobby, where it
   * would have shown a hidden pick).
   */
  function savePicks(a: Arena) {
    for (const session of sessions.values()) {
      if (session.code !== a.code || !session.socketId) continue;
      const socket = io.sockets.sockets.get(session.socketId);
      const owner = socket?.data.account as Account | undefined;
      const p = a.players.find((p) => p.id === session.id);
      if (socket && owner && !owner.guest && p)
        void portraitChoice.save(
          owner.id,
          socket.data.accessToken,
          p.character,
        );
    }
  }
  /** A 2v2 side's team chat (docs/hidden-picks.md). */
  const teamChatKey = (code: string, team: number) => `team:${code}:${team}`;
  /** Teams changed, or the room closed: both sides' team chats go. */
  function dropTeamChat(code: string) {
    chat.drop(teamChatKey(code, 0));
    chat.drop(teamChatKey(code, 1));
  }
  /** The 2v2 teammate who already locked in this fighter, if any. */
  function takenBy(a: Arena, p: Fighter, character: Fighter["character"]) {
    return pickTakenBy(a.mode, a.players, p, character, (o) => a.teamOf(o));
  }
  const takenMessage = (by: Fighter, character: Fighter["character"]) =>
    `${by.name} already picked ${CHARACTERS[character].name}. Pick another fighter.`;
  function lockPick(a: Arena, p: Fighter) {
    p.locked = true;
    p.browse = undefined;
    a.lockOrder.set(p.id, ++a.lockSerial);
  }
  /** After a team change: teammates on the same fighter, the later lock gives way. */
  function unlockClashes(a: Arena) {
    for (const p of pickClashes(
      a.mode,
      a.players,
      (o) => a.teamOf(o),
      (o) => a.lockOrder.get(o.id) ?? 0,
    )) {
      p.locked = false;
      p.ready = false;
      a.lockOrder.delete(p.id);
    }
  }
  /** Climbs being checked against storage (one at a time per room). */
  const spireChecks = new WeakSet<SpireRoom>();
  /**
   * A climb starts at the first floor of the room's zone, if every member
   * has earned that checkpoint, below the lowest boss floor someone hasn't
   * unlocked (each read from storage, never from a client). Without
   * storage: zone 1 from floor 1 only.
   */
  async function startSpire(a: SpireRoom) {
    if (spireChecks.has(a)) return;
    spireChecks.add(a);
    const owners = fighterAccounts.get(a);
    const ids = a
      .heroes()
      .map((p) => owners?.get(p.id))
      .filter((id): id is string => !!id);
    let members: SpireMember[] | null = null;
    try {
      members = accounts.spireStart ? await accounts.spireStart(ids) : null;
    } catch {
      members = null;
    }
    spireChecks.delete(a);
    if (
      rooms.get(a.code) !== a ||
      a.phase !== "lobby" ||
      !a.players.length ||
      !a.players.every((p) => p.ready && p.connected)
    )
      return;
    const plan = members
      ? spireStartFrom(members, a.zone)
      : a.zone === 1
        ? { ok: true, startFloor: 1, ceiling: spireZoneTop(1) }
        : {
            ok: false,
            startFloor: 1,
            ceiling: 0,
            reason: "Climbing past zone 1 needs your saved progress.",
          };
    if (!plan.ok) {
      a.spire.state.problem = plan.reason;
      for (const p of a.players) p.ready = false;
      return broadcast(a);
    }
    a.configureSpire(plan);
    a.start();
    broadcast(a);
  }
  /** Save each floor a climb cleared, at once (the climb may still fail). */
  function saveSpireFloors(arena: SpireRoom) {
    const owners = fighterAccounts.get(arena);
    for (const floor of arena.spire.pending.splice(0)) {
      const runId = floor.runId;
      const save = arena.spire.state.saves.find(
        (s) => s.floor === floor.floor && s.status === "saving",
      );
      const accountOf = (id: string) => owners?.get(id) ?? "";
      const players = floor.players
        .map((p) => ({
          accountId: accountOf(p.accountId),
          character: p.character,
        }))
        .filter((p) => p.accountId);
      const receipt = {
        ...floor,
        players,
        blessings: Object.fromEntries(
          Object.entries(floor.blessings)
            .filter(([id]) => accountOf(id))
            .map(([id, b]) => [accountOf(id), b]),
        ),
      };
      void (
        accounts.recordSpireFloor && players.length
          ? accounts.recordSpireFloor(receipt)
          : Promise.reject(new Error("Spire progress needs server storage."))
      )
        .then((result) => {
          if (arena.spire.runId !== runId || !save) return;
          const fighterOf = new Map(
            [...(owners ?? new Map<string, string>())].map(([f, acc]) => [
              acc,
              f,
            ]),
          );
          save.status = "saved";
          save.claims = result.newClaims
            .filter((c) => fighterOf.has(c.accountId))
            .map((c) => ({
              playerId: fighterOf.get(c.accountId)!,
              coins: c.coins,
              titles: c.titles,
            }));
          for (const socket of io.sockets.sockets.values())
            if (players.some((p) => p.accountId === socket.data.account?.id)) {
              socket.emit("account-changed");
              socket.emit("economy-changed");
            }
          broadcast(arena);
        })
        .catch(() => {
          if (arena.spire.runId !== runId || !save) return;
          save.status = "unavailable";
          broadcast(arena);
        });
    }
  }
  function broadcast(arena: Arena) {
    const started = diagnostics.now();
    // Wins and real attempts (not instant quits) are saved:
    // losses still count towards titles and tell us which attacks are unfair.
    if (isSpireArena(arena) && arena.spire.pending.length)
      saveSpireFloors(arena);
    // Raid clears (not Spire climbs: those save floor by floor, above).
    if (
      arena instanceof RaidArena &&
      !arena.spire &&
      arena.raid.result &&
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
      logMatch(arena);
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
            quick: quickRooms.get(arena) ?? null,
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
    // A PvP lobby hides each side's picks from the others: every side (and
    // the watchers) gets its own copy, built once per side.
    if (picksHidden(arena)) {
      const sideOf = (id: string | undefined) => {
        const p = id ? arena.players.find((p) => p.id === id) : undefined;
        return p ? arena.teamOf(p) : -1;
      };
      const views = new Map<number, WireSnapshot>();
      const veil = (base: WireSnapshot, viewer: string | undefined) => ({
        ...base,
        players: veilPlayers(
          base.players,
          sideOf(viewer) < 0 ? undefined : viewer,
          (x, y) => sideOf(x) === sideOf(y),
        ),
      });
      for (const id of io.sockets.adapter.rooms.get(arena.code) ?? []) {
        const catchUp = personal.get(id);
        if (!catchUp && held.has(id)) continue;
        const session = getSession(id);
        const viewer = session?.code === arena.code ? session.id : undefined;
        const side = sideOf(viewer);
        let view = catchUp && veil(catchUp, viewer);
        if (!view) {
          view = views.get(side) ?? veil(wire, viewer);
          views.set(side, view);
        }
        io.to(id).emit("state", view);
      }
      diagnostics.broadcast(started);
      return;
    }
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
    // The leader left the party's room: the party has no room until the next.
    if (parties.of(session.accountId)?.room?.code === session.code) {
      const party = parties.setRoom(session.accountId, undefined);
      if (party) emitParty(party);
    }
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
      chat.drop(`room:${arena.code}`);
      dropTeamChat(arena.code);
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
    if (draining) socket.emit("server-update", { draining: true });
    void loadChatBlocks(socket);
    // Whether typed lines are on, so the chat box shows the right state.
    socket.emit("chat-config", { freeText: chat.freeText });
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
    /** Refuses a new match while a deploy replaces this server. */
    const updating = (cb: unknown) => {
      if (draining) fail(cb, DRAIN_MESSAGE);
      return draining;
    };
    const attach = (
      arena: Arena,
      name: string,
      cb: unknown,
      publish = true,
    ) => {
      leaveQuick("cancel");
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
    /** Stop searching for a Quick Match, logging why. */
    const leaveQuick = (why: QueueLeave) => {
      const entry = quickQueue.leave(socket.id);
      if (entry) logQueue(entry, why);
      return !!entry;
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
        for (const [id, out] of roomInvitesOut)
          if (out.expiresAt <= Date.now()) roomInvitesOut.delete(id);
        roomInvitesOut.set(key, { code: arena!.code, expiresAt });
        for (const target of targets) target.emit("room-invite", invite);
        reply(cb, { ok: true });
      } catch {
        fail(cb, "Couldn't check your friends. Try again.");
      } finally {
        roomInvitesPending.delete(key);
      }
    });
    // A room invitation turned down: the sender may invite again at once.
    socket.on("room-invite-decline", (data: unknown, cb: unknown) => {
      if (!account()) return fail(cb, "Please log in to play.");
      const fromId = (data as { fromId?: unknown } | null)?.fromId;
      const key = typeof fromId === "string" && `${fromId}:${account()!.id}`;
      if (key && roomInvitesOut.delete(key)) {
        roomInviteCooldowns.delete(key);
        for (const s of accountSockets(fromId as string))
          s.emit("invite-declined", {
            playerId: account()!.id,
            name: account()!.displayName,
          });
      }
      reply(cb, { ok: true });
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
        // Nobody joins a party with someone either of them blocked (the
        // reason isn't told: a block stays private).
        const current = parties.of(sender.id);
        if (
          (current?.members ?? [{ id: sender.id }]).some((m) =>
            chat.blocks(m.id, targetId),
          )
        )
          return fail(cb, "Your friend can't join this party.");
        const result = parties.invite(
          memberOf(parsed.data.character),
          targetId,
          Date.now(),
        );
        if (!result.ok) return fail(cb, result.error);
        const lead = result.party.members.find(
          (m) => m.id === result.party.leader,
        );
        const invite = {
          id: randomUUID(),
          fromId: sender.id,
          name: sender.displayName,
          code: result.party.code,
          mode: "party" as const,
          expiresAt: result.expiresAt,
          // A member invited you: whose party it is.
          ...(lead && lead.id !== sender.id ? { leader: lead.name } : {}),
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
      const invite = code.success
        ? parties.decline(account()!.id, code.data)
        : undefined;
      if (invite) {
        for (const s of accountSockets(invite.fromId))
          s.emit("invite-declined", {
            playerId: account()!.id,
            name: account()!.displayName,
          });
        const party = parties.of(invite.fromId);
        if (party) emitParty(party);
      }
      reply(cb, { ok: true });
    });
    const leaveParty = (accountId: string) => {
      const result = parties.leave(accountId);
      for (const s of accountSockets(accountId)) s.emit("party", null);
      if (!result) return;
      if (result.disbanded) {
        emitParty(result.disbanded, true);
        chat.drop(`party:${result.disbanded.code}`);
      } else emitParty(result.party);
    };
    /** Back online: your party shows you again, and this tab sees it. */
    const rejoinParty = () => {
      const id = account()?.id;
      const back = id ? parties.back(id) : undefined;
      if (back) emitParty(back.party);
    };
    rejoinParty();
    socket.on("party-leave", (_data: unknown, cb: unknown) => {
      if (!account()) return fail(cb, "Please log in to play.");
      leaveParty(account()!.id);
      reply(cb, { ok: true });
    });
    // The leader removes a member: they leave the party (not a room they
    // sit in) and are told so.
    socket.on("party-kick", (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
      if (!allowed(10)) return fail(cb, "Too many requests.");
      const playerId = (data as { playerId?: unknown } | null)?.playerId;
      if (typeof playerId !== "string") return fail(cb, "Choose a player.");
      const result = parties.kick(account()!.id, playerId);
      if (!result.ok) return fail(cb, result.error);
      for (const s of accountSockets(playerId)) {
        s.emit("party", null);
        s.emit("party-kicked", { by: account()!.displayName });
      }
      if (result.disbanded) {
        emitParty(result.disbanded, true);
        chat.drop(`party:${result.disbanded.code}`);
      } else emitParty(result.party);
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
      if (parties.setRoom(me.id, { code: arena.code, mode: arena.mode }))
        emitParty(party);
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
        if (!current) {
          void loadChatBlocks(socket);
          rejoinParty();
        }
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
      if (updating(cb)) return;
      releaseDisconnected();
      if ([...sessions.values()].some((s) => s.accountId === account()!.id))
        return fail(
          cb,
          "This account already has a room. Reconnect or leave that room first.",
        );
      if (rooms.size >= 500)
        return fail(cb, "The arena is busy. Please try again later.");
      let code: string;
      do {
        code = Array.from(
          { length: 6 },
          () => ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)],
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
          ? result.data.spire !== undefined
            ? createSpireArena(code, spireZoneOf(result.data.spire || 1))
            : createRaidArena(code, result.data.boss)
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
      if (updating(cb)) return;
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
      joinedByInvite(arena);
    });
    /**
     * Joined a room a friend invited you to: you join their party as well
     * (party.ts link), so the two of you stay together back on the Lobby
     * and follow the leader into the next room, as in most team games.
     */
    const joinedByInvite = (arena: Arena) => {
      const me = account()!;
      if (getSession(socket.id)?.code !== arena.code) return;
      const now = Date.now();
      for (const [key, out] of roomInvitesOut) {
        const [fromId, toId] = key.split(":");
        if (toId !== me.id) continue;
        if (out.expiresAt <= now || out.code !== arena.code) continue;
        roomInvitesOut.delete(key);
        const host = [...sessions.values()].find(
          (s) => s.accountId === fromId && s.code === arena.code,
        );
        const hostFighter = host && arena.players.find((p) => p.id === host.id);
        const hostAccount = accountSockets(fromId)[0]?.data.account as
          Account | undefined;
        if (!hostFighter || !hostAccount) continue;
        // Nobody joins a party with someone either of them blocked.
        const theirs = parties.of(fromId);
        if (
          (theirs?.members ?? [{ id: fromId }]).some((m) =>
            chat.blocks(m.id, me.id),
          )
        )
          continue;
        // A PvP lobby pick is secret: the party (which may include the
        // other side) gets the fighter it already knew, not the pick.
        const shown = (accountId: string, p: Fighter | undefined) =>
          (picksHidden(arena)
            ? parties.of(accountId)?.members.find((m) => m.id === accountId)
                ?.character
            : p?.character) ?? "voltkit";
        const result = parties.link(
          {
            id: fromId,
            name: hostAccount.displayName,
            character: shown(fromId, hostFighter),
          },
          {
            id: me.id,
            name: me.displayName,
            character: shown(
              me.id,
              arena.players.find((p) => p.id === getSession(socket.id)?.id),
            ),
          },
        );
        if (!result.ok) continue;
        if (result.disbanded) emitParty(result.disbanded, true);
        else if (result.left) emitParty(result.left);
        // An inviter who leads (a party made now, say): its room is this one.
        if (result.party.leader === fromId)
          parties.setRoom(fromId, { code: arena.code, mode: arena.mode });
        emitParty(result.party);
        void loadPartyAppearance(me.id, socket.data.accessToken);
        if (!parties.appearanceOf(fromId))
          void loadPartyAppearance(
            fromId,
            accountSockets(fromId)[0]!.data.accessToken,
          );
        break;
      }
    };
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
      if (updating(cb)) return;
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
      if (updating(cb)) return;
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
      if (result.data.quick) {
        leaveQuick("bot");
        quickRooms.set(a, "bot");
      }
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
        locked: true,
      });
      a.bots.set(botId, new BotBrain(botId, difficulty, randomInt(1, 2 ** 31)));
      a.start();
      broadcast(a);
    });
    /**
     * Quick Match: queue for a 1v1 against whoever else is searching. The
     * reply says whether you met someone now (a room, as "create" replies)
     * or are queued; a later pairing arrives as "quick-found" with the same
     * fields. The client offers a labelled bot after QUICK_MATCH_FALLBACK_MS.
     */
    socket.on("quick-join", (data: unknown, cb: unknown) => {
      stopWatching();
      if (!requirePlayer(cb)) return;
      if (!allowed(15)) return fail(cb, "Too many requests.");
      const result = quickSchema.safeParse(data);
      if (!result.success)
        return fail(cb, "Choose a valid character and display name.");
      if (getSession(socket.id))
        return fail(cb, "Leave your current room first.");
      if (updating(cb)) return;
      releaseDisconnected();
      if ([...sessions.values()].some((s) => s.accountId === account()!.id))
        return fail(cb, "This account already has a room.");
      if ((parties.of(account()!.id)?.members.length ?? 0) > 1)
        return fail(
          cb,
          "With a party, choose a room: 1v1, 2v2 or Free-for-all.",
        );
      if (rooms.size >= 500)
        return fail(cb, "The arena is busy. Please try again later.");
      const name = result.data.name;
      const character = result.data.character;
      // Joins this socket to a room Quick Match made, as if it had created
      // or joined it, with its pick shown to itself only (a PvP lobby).
      const enter = (arena: Arena, done: (r: Reply) => void) => {
        attach(arena, name, done);
        const me = arena.players.at(-1)!;
        if (picksHidden(arena)) me.browse = character;
        else me.character = character;
      };
      const entry = {
        socketId: socket.id,
        accountId: account()!.id,
        since: Date.now(),
        name,
        matched: (arena: Arena) =>
          enter(arena, (r) => socket.emit("quick-found", r)),
      };
      const other = quickQueue.join(entry);
      if (!other) {
        reply(cb, { ok: true, queued: true, online: onlineCount() - 1 });
        return;
      }
      logQueue(other, "human");
      logQueue(entry, "human");
      let code: string;
      do {
        code = Array.from(
          { length: 6 },
          () => ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)],
        ).join("");
      } while (rooms.has(code));
      const arena = new Arena(code, "duel");
      arena.rotateArenas = true;
      rooms.set(code, arena);
      quickRooms.set(arena, "human");
      other.matched(arena);
      enter(arena, (r) => reply(cb, r));
      broadcast(arena);
    });
    socket.on("quick-leave", (_data: unknown, cb: unknown) => {
      leaveQuick("cancel");
      reply(cb, { ok: true });
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
        const taken = takenBy(a, p, result.data);
        if (taken) return fail(cb, takenMessage(taken, result.data));
        if (p.character !== result.data) p.flair = undefined;
        p.character = result.data;
        lockPick(a, p);
        // A PvP pick is secret until the match starts: the friends' portrait
        // is saved then (savePicks), so a friend can't read it here.
        const owner = account();
        if (owner && !owner.guest && !picksHidden(a))
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
    // PvP lobby: the fighter you're looking at, for your teammate (enemies
    // never get it). Elsewhere (a raid room) it is the pick itself.
    socket.on("browse", (data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        const result = characterSchema.safeParse(data);
        if (a.phase !== "lobby" || !result.success)
          return fail(cb, "Character selection is unavailable.");
        const p = a.players.find((p) => p.id === id)!;
        if (!picksHidden(a)) {
          if (p.character !== result.data) {
            p.flair = undefined;
            p.character = result.data;
            p.ready = false;
          }
        } else if (p.browse === result.data) return reply(cb, { ok: true });
        else p.browse = result.data;
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
    // Boss practice was removed; an old cached client may still ask for it.
    socket.on("raid-drill", (_data: unknown, cb: unknown) =>
      fail(cb, "Boss practice is no longer available. Refresh the game."),
    );
    socket.on("ready", (_data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        if (a.phase !== "lobby")
          return fail(cb, "The match has already started.");
        const p = a.players.find((p) => p.id === id)!;
        if (!p.ready && updating(cb)) return;
        // Ready locks in the fighter on show (a pick that was never locked).
        if (!p.ready && picksHidden(a) && !p.locked) {
          const pick = p.browse ?? p.character;
          const taken = takenBy(a, p, pick);
          if (taken) return fail(cb, takenMessage(taken, pick));
          if (p.character !== pick) p.flair = undefined;
          p.character = pick;
          lockPick(a, p);
        }
        p.ready = !p.ready;
        // Cancelling Ready unlocks the pick too (the seat reads Choosing
        // again; in 2v2 the fighter is free for your teammate). Owner,
        // 19 Nov 2026: a cancelled Ready that stayed Locked read as stuck.
        if (!p.ready && picksHidden(a) && p.locked) {
          p.locked = false;
          a.lockOrder.delete(p.id);
        }
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
        unlockClashes(a);
        // A new side must not read the old one's plans.
        dropTeamChat(a.code);
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
        unlockClashes(a);
        dropTeamChat(a.code);
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
        if (updating(cb)) return;
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
    // ───────────── Chat (docs/chat-plan.md) ─────────────
    /** A player as chat sees them. */
    const chatMember = (
      accountId: string,
      name: string,
      team?: number,
    ): ChatMember => {
      const live = accountSockets(accountId)[0]?.data.account as
        Account | undefined;
      return {
        accountId,
        name,
        guest: !!live?.guest,
        mode: chatModes.get(accountId) ?? "free",
        ...(team !== undefined ? { team } : {}),
      };
    };
    /** Who hears this socket in a channel, from the server's own state. */
    const chatRoute = (channel: unknown, to?: unknown): ChatRoute | null => {
      const me = account();
      if (!me) return null;
      if (channel === "friend") {
        // A friend, by the server's own list (blocking ends a friendship).
        const name =
          typeof to === "string" ? chatFriends.get(me.id)?.get(to) : undefined;
        if (name === undefined || typeof to !== "string") return null;
        const [lo, hi] = [me.id, to].sort();
        return {
          channel,
          key: `friend:${lo}:${hi}`,
          inBattle: false,
          members: [chatMember(me.id, me.displayName), chatMember(to, name)],
        };
      }
      if (channel === "party") {
        const party = parties.of(me.id);
        if (!party) return null;
        return {
          channel,
          key: `party:${party.code}`,
          inBattle: false,
          members: party.members.map((m) => chatMember(m.id, m.name)),
        };
      }
      if (channel === "room") {
        const session = getSession(socket.id);
        const arena = session && rooms.get(session.code);
        if (!arena) return null;
        const owners = fighterAccounts.get(arena);
        const members: ChatMember[] = [];
        for (const p of arena.players) {
          const accountId = owners?.get(p.id);
          // Bots have no account; a player still in a room has a session.
          if (!accountId || arena.bots.has(p.id)) continue;
          if (![...sessions.values()].some((s) => s.id === p.id)) continue;
          const team = arena instanceof RaidArena ? 0 : arena.teamOf(p);
          members.push(chatMember(accountId, p.name, team));
        }
        return {
          channel,
          key: `room:${arena.code}`,
          inBattle: arena.phase !== "lobby" && arena.phase !== "finished",
          members,
        };
      }
      if (channel === "team") {
        // A 2v2 room's own side: the sender's teammates only.
        const session = getSession(socket.id);
        const arena = session && rooms.get(session.code);
        const me = arena?.players.find((p) => p.id === session!.id);
        if (!arena || !me || arena.mode !== "teams") return null;
        const team = arena.teamOf(me);
        const owners = fighterAccounts.get(arena);
        const members: ChatMember[] = [];
        for (const p of arena.players) {
          const accountId = owners?.get(p.id);
          if (!accountId || arena.bots.has(p.id) || arena.teamOf(p) !== team)
            continue;
          if (![...sessions.values()].some((s) => s.id === p.id)) continue;
          members.push(chatMember(accountId, p.name, team));
        }
        return {
          channel,
          key: teamChatKey(arena.code, team),
          inBattle: arena.phase !== "lobby" && arena.phase !== "finished",
          members,
        };
      }
      if (channel === "place") {
        // The Plaza: everyone in the same copy.
        const copy = plaza.plazaOf(socket.id);
        if (copy !== undefined)
          return {
            channel,
            key: `place:plaza:${copy}`,
            inBattle: false,
            members: plaza
              .mates(socket.id)
              .map((m) => chatMember(m.accountId, m.name)),
          };
      }
      return null;
    };
    socket.on("chat-send", async (data: unknown, cb: unknown) => {
      if (!allowed(10) || !requirePlayer(cb)) return;
      const input = (data ?? {}) as {
        channel?: unknown;
        to?: unknown;
        text?: unknown;
        quick?: unknown;
      };
      const route = chatRoute(input.channel, input.to);
      if (!route) return fail(cb, "There's no one to chat with here.");
      const sent = chat.send(
        account()!.id,
        route,
        input.quick !== undefined
          ? { quick: input.quick }
          : { text: input.text },
      );
      if (!sent.ok) return fail(cb, sent.error);
      // In a room the line names the speaker's fighter (a bubble over them).
      if (route.channel === "room" || route.channel === "team") {
        const session = getSession(socket.id);
        if (session) sent.line.fighter = session.id;
      }
      // On the Plaza an emote also pops over your head for everyone, the
      // way the Plaza's own emotes always have (older apps see it too).
      const pop = sent.line.quick && plazaEmoteFor(sent.line.quick);
      if (route.channel === "place" && pop)
        plaza.emote(socket.id, pop, Date.now());
      // Between friends the line is kept (the last 200 a pair), so a friend
      // reads it later; its id is then the stored one, negated, so a page
      // that loads it again knows it. Not kept until the migration runs.
      let kept: boolean | undefined;
      if (route.channel === "friend") {
        kept = false;
        const to = route.members.find((m) => m.accountId !== account()!.id)!;
        sent.line.to = to.accountId;
        try {
          const id = await accounts.friendMessages?.save(
            account()!.id,
            to.accountId,
            sent.line.quick
              ? { quick: sent.line.quick }
              : { text: sent.line.text },
          );
          if (id) {
            sent.line.id = -id;
            kept = true;
          }
        } catch {
          // Kept in memory only.
        }
      }
      for (const id of sent.deliver)
        for (const s of accountSockets(id)) s.emit("chat", sent.line);
      // A friend who is away (no device connected) gets a notification, if
      // they turned them on: who it's from, never the words.
      if (route.channel === "friend" && sent.line.to) {
        const to = sent.line.to;
        if (!accountSockets(to).length)
          void friendPush
            ?.notify(to, { id: account()!.id, name: account()!.displayName })
            .catch(() => {});
      }
      // A friend's line says whether it was kept (read later) or only shown.
      reply(cb, kept === undefined ? { ok: true } : { ok: true, kept });
    });
    /** A friend's kept messages, as chat lines. */
    const friendHistory = async (route: ChatRoute, me: string) => {
      const friend = route.members.find((m) => m.accountId !== me)!;
      const names = new Map(route.members.map((m) => [m.accountId, m.name]));
      try {
        const rows = await accounts.friendMessages!.history(
          me,
          friend.accountId,
          CHAT_LIMITS.history,
        );
        return rows.map((r): ChatLine => ({
          id: -r.id,
          channel: "friend",
          from: { id: r.from, name: names.get(r.from) ?? "" },
          at: r.at,
          to: r.from === me ? friend.accountId : me,
          ...(r.quick
            ? { quick: r.quick as ChatQuick }
            : { text: r.text ?? "" }),
        }));
      } catch {
        return chat.history(route.key, me);
      }
    };
    // Unread friends' messages (a dot on the chat); reading a friend clears it.
    // The chat's Friends tab: your friends (read afresh), who is online, and
    // how many messages each sent that you haven't read.
    socket.on("chat-friends", async (_data: unknown, cb: unknown) => {
      if (!allowed(10) || typeof cb !== "function") return;
      if (!account()) return cb({ ok: true, friends: [] });
      const me = account()!;
      await loadChatFriends(socket);
      let unread: Record<string, number> = {};
      try {
        unread = (await accounts.friendMessages?.unread(me.id)) ?? {};
      } catch {
        // Nothing kept yet (the database update hasn't run).
      }
      cb({
        ok: true,
        friends: [...(chatFriends.get(me.id) ?? new Map<string, string>())]
          .map(([id, name]) => ({
            id,
            name,
            online: accountSockets(id).length > 0,
            unread: Math.max(0, Number(unread[id]) || 0),
          }))
          .sort(
            (a, b) =>
              b.unread - a.unread ||
              Number(b.online) - Number(a.online) ||
              a.name.localeCompare(b.name),
          ),
      });
    });
    socket.on("chat-unread", async (_data: unknown, cb: unknown) => {
      if (!allowed(10) || typeof cb !== "function") return;
      if (!account()) return cb({ ok: true, unread: {} });
      try {
        cb({
          ok: true,
          unread: (await accounts.friendMessages?.unread(account()!.id)) ?? {},
        });
      } catch {
        cb({ ok: true, unread: {} });
      }
    });
    socket.on("chat-read", (data: unknown) => {
      if (!allowed(10) || !account()) return;
      const to = (data as { to?: unknown } | null)?.to;
      if (typeof to !== "string" || !chatFriends.get(account()!.id)?.has(to))
        return;
      void accounts.friendMessages?.read(account()!.id, to).catch(() => {});
      friendPush?.read(account()!.id, to);
    });
    // Notifications of friends' messages (push.ts): the key to subscribe
    // with (null: the server sends none), then this device on or off.
    socket.on("push-config", (_data: unknown, cb: unknown) => {
      if (!allowed(10) || typeof cb !== "function") return;
      cb({ ok: true, key: friendPush?.publicKey ?? null });
    });
    socket.on("push-subscribe", async (data: unknown, cb: unknown) => {
      if (!allowed(5) || !requirePlayer(cb)) return;
      const device = validDevice(data);
      if (!friendPush || !accounts.pushDevices)
        return fail(cb, "Notifications aren't available right now.");
      if (!device) return fail(cb, "This browser can't get notifications.");
      try {
        await accounts.pushDevices.save(account()!.id, device);
        reply(cb, { ok: true });
      } catch {
        fail(cb, "Couldn't turn notifications on. Try again.");
      }
    });
    socket.on("push-unsubscribe", async (data: unknown, cb: unknown) => {
      if (!allowed(5) || !account()) return;
      const endpoint = (data as { endpoint?: unknown } | null)?.endpoint;
      if (typeof endpoint !== "string" || endpoint.length > 1000)
        return fail(cb, "Nothing to turn off.");
      try {
        await accounts.pushDevices?.remove(endpoint);
        reply(cb, { ok: true });
      } catch {
        fail(cb, "Couldn't turn notifications off. Try again.");
      }
    });
    // The player's chat setting (Settings): free, quick chat only, or off.
    socket.on("chat-mode", (data: unknown, cb: unknown) => {
      if (!allowed(10) || !account()) return;
      const mode = (data as { mode?: unknown } | null)?.mode;
      if (!CHAT_MODES.includes(mode as ChatMode))
        return fail(cb, "Choose free, quick or off.");
      chatModes.set(account()!.id, mode as ChatMode);
      reply(cb, { ok: true });
    });
    // Report a line (App Store Review Guideline 1.2): the server attaches the
    // lines it kept itself, so a report can't be made up.
    socket.on("chat-report", async (data: unknown, cb: unknown) => {
      if (!allowed(5) || !requirePlayer(cb)) return;
      const input = (data ?? {}) as {
        channel?: unknown;
        to?: unknown;
        id?: unknown;
        reason?: unknown;
      };
      const me = account()!;
      const route = chatRoute(input.channel, input.to);
      const kept = route ? chat.history(route.key, me.id) : [];
      const at = kept.findIndex((l) => l.id === input.id);
      const line = kept[at];
      if (!route || !line) return fail(cb, "That message is gone.");
      if (line.from.id === me.id) return fail(cb, "That's your own message.");
      const reason =
        typeof input.reason === "string"
          ? input.reason.trim().slice(0, 900)
          : "";
      try {
        await accounts.rpc(socket.data.accessToken, "arena_submit_report", {
          p_category: "player",
          p_message: `Chat: ${line.from.name}${reason ? `: ${reason}` : " (reported from chat)"}`,
          p_context: reportContext(route.key, line.from, kept.slice(0, at + 1)),
        });
      } catch (error) {
        return fail(
          cb,
          error instanceof Error ? error.message : "Couldn't send the report.",
        );
      }
      const { pausedNow } = chatReports.record(me.id, line.from.id);
      if (pausedNow) connectionLog("chat-paused", { account: line.from.id });
      reply(cb, { ok: true });
    });
    socket.on("chat-history", async (data: unknown, cb: unknown) => {
      if (!allowed(10) || !account()) return;
      const input = (data ?? {}) as { channel?: unknown; to?: unknown };
      const route = chatRoute(input.channel, input.to);
      if (typeof cb !== "function") return;
      const me = account()!.id;
      cb({
        ok: true,
        lines: !route
          ? []
          : route.channel === "friend" && accounts.friendMessages
            ? await friendHistory(route, me)
            : chat.history(route.key, me),
      });
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
      const wish = plaza.wishFor(socket.id);
      if (wish) socket.emit("plaza-wish", wish);
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
      const d = data as {
        dx?: unknown;
        dy?: unknown;
        s?: unknown;
        t?: unknown;
      } | null;
      plaza.input(socket.id, d?.dx, d?.dy, { s: d?.s, t: d?.t });
    });
    socket.on("plaza-jump", (data: unknown) => {
      if (!allowed(10)) return;
      const d = data as { s?: unknown; t?: unknown } | null;
      plaza.jump(socket.id, { s: d?.s, t: d?.t });
    });
    socket.on("plaza-dash", (data: unknown) => {
      if (!allowed(10)) return;
      const d = data as {
        dx?: unknown;
        dy?: unknown;
        s?: unknown;
        t?: unknown;
      } | null;
      plaza.dash(socket.id, d?.dx, d?.dy, { s: d?.s, t: d?.t });
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
    // Pair emotes (a high five…): asked from a player's card, answered by
    // them. Requests between blocked players are never delivered.
    const pairBlocked = (a: string, b: string) => chat.blocks(a, b);
    socket.on("plaza-pair-ask", (data: unknown, cb: unknown) => {
      if (!allowed(10)) return;
      const d = data as { to?: unknown; kind?: unknown } | null;
      const r = plaza.pairAsk(
        socket.id,
        d?.to,
        d?.kind,
        Date.now(),
        pairBlocked,
      );
      if (!r.ok) return fail(cb, r.error);
      io.sockets.sockets.get(r.to)?.emit("plaza-pair-ask", r.ask);
      reply(cb, { ok: true });
    });
    socket.on("plaza-pair-answer", (data: unknown, cb: unknown) => {
      if (!allowed(10)) return;
      const d = data as { from?: unknown; yes?: unknown } | null;
      const r = plaza.pairAnswer(
        socket.id,
        d?.from,
        d?.yes === true,
        Date.now(),
        pairBlocked,
      );
      if (!r.ok) return fail(cb, r.error);
      if (r.declined)
        io.sockets.sockets
          .get(r.asker)
          ?.emit("plaza-pair-no", { name: plaza.profileOf(socket.id)?.name });
      else
        for (const key of r.keys)
          io.sockets.sockets.get(key)?.emit("plaza-pair", r.start);
      reply(cb, { ok: true });
    });
    // Treats: a free handful a Pacific day (PLAZA.treatsDaily), thrown for everyone.
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
      // Thrown at the fountain: a wish (where they stood when they threw).
      const wishing = plaza.atFountain(socket.id);
      treatPending = true;
      try {
        // A fresh id per throw: a retry of this request can't take two treats.
        const r = (await accounts.rpc(token, "arena_plaza_treat", {
          p_ref: randomUUID(),
        })) as {
          ok?: boolean;
          treat?: string;
          left?: number;
          error?: string;
        } | null;
        if (!r?.ok || !r.treat)
          return reply(cb, {
            ok: false,
            error: r?.error ?? "No treats left today.",
            treats: r?.left ?? 0,
          });
        const thrown = plaza.treat(socket.id, r.treat);
        if (thrown)
          toPlaza(
            copy,
            "plaza-treat",
            wishing ? { ...thrown, wish: true } : thrown,
          );
        reply(cb, {
          ok: true,
          treat: r.treat,
          treats: r.left ?? 0,
          ...(wishing ? { wish: true } : {}),
        });
        if (wishing)
          for (const e of plaza.wish(socket.id, Date.now())) plazaEvent(e);
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
        // Free since 20261119190000_remove_farm_bistro_leaves; the database
        // still checks the player.
        const ok = (await accounts.rpc(token, "arena_plaza_boba", {
          p_ref: randomUUID(),
        })) as { ok?: boolean } | null;
        if (!ok?.ok)
          return reply(cb, {
            ok: false,
            error: "Volt Boba is closed right now.",
          });
        plaza.boost(socket.id);
        reply(cb, { ok: true });
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
    // Fishing at the pond: the server picks the fish and the bite
    // (PlazaWorld.cast/reel); a catch is recorded like the other quests.
    socket.on("plaza-fish", (data: unknown, cb: unknown) => {
      if (!allowed(10)) return;
      const d = data as { act?: unknown; tz?: unknown } | null;
      if (plaza.plazaOf(socket.id) === undefined)
        return fail(cb, "Not in the Plaza.");
      const now = Date.now();
      if (d?.act === "cast") return reply(cb, plaza.cast(socket.id, now, d.tz));
      if (d?.act === "stop")
        return reply(cb, { ok: plaza.stopFishing(socket.id, now) });
      if (d?.act === "reel") return reply(cb, plaza.reel(socket.id, now));
      if (d?.act !== "land") return fail(cb, "Nothing to do here.");
      // The fight's end: the server runs it again from its seed (plaza-fight.ts).
      const r = plaza.land(socket.id, now, (d as { moves?: unknown }).moves);
      if (r.ok)
        recordPlaza(socket.id, {
          kind: "fish",
          ref: r.fish,
          coins:
            PLAZA_FISH_RARITY[PLAZA_FISH_BY_ID[r.fish]?.rarity]?.firstCoins ??
            0,
          bookSize: PLAZA_FISH.length,
        });
      reply(cb, r);
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
    socket.on("battle-art", (data: unknown) =>
      withRoom(undefined, (a) => {
        // A fighter's art found blank and loaded again (rig-health.ts in the
        // client); a cap keeps a looping client quiet.
        const sent = (socket.data.artReports ?? 0) as number;
        if (sent >= 10) return;
        const result = battleArtSchema.safeParse(data);
        if (!result.success) return;
        socket.data.artReports = sent + 1;
        connectionLog("arena-art-blank", {
          ...result.data,
          account: account()?.id,
          room: a.code,
          mode: a.mode,
          phase: a.phase,
          ...(a instanceof RaidArena ? { boss: a.raid.boss } : {}),
        });
      }),
    );
    socket.on("battle-perf", (data: unknown) =>
      withRoom(undefined, (a, id) => {
        // One per match; a cap keeps a looping client quiet. Technical
        // numbers only: no account (battle-perf.ts in the client).
        const sent = (socket.data.perfReports ?? 0) as number;
        if (sent >= 20) return;
        const result = battlePerfSchema.safeParse(data);
        if (!result.success) return;
        socket.data.perfReports = sent + 1;
        const bot = [...a.bots.values()][0];
        connectionLog("arena-perf", {
          ...result.data,
          mode: a.mode,
          players: a.players.length,
          bots: a.bots.size,
          ...(bot ? { botLevel: bot.difficulty } : {}),
          ...(a instanceof RaidArena ? { boss: a.raid.boss } : {}),
          ...(isSpireArena(a) ? { spire: a.spire.state.floor } : {}),
          character: a.players.find((p) => p.id === id)?.character,
          // Who you fought (champions only), and a tag shared by every
          // player's report of this match, to read both sides together.
          opponents: a.players
            .filter((p) => p.id !== id && !p.raidBoss)
            .map((p) => p.character)
            .slice(0, 8),
          ...(a.matchTag ? { match: a.matchTag } : {}),
          // The combat loop's last minute: its real rate (30 is right), how
          // late its ticks ran and how long they took (tick-clock.ts).
          ...(timer?.stats() ?? {}),
          // The court, and this player's input queue over the match
          // (Arena.inputStats: held ticks, late and burst steps, folds).
          arena: a.arenaId,
          ...(a.inputStats(id) ?? {}),
        });
      }),
    );
    socket.on("disconnect", (reason: string) => {
      leaveQuick("disconnect");
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
      if (who && !stillOnline) {
        // The party keeps your place for a while (a locked phone, a network
        // change); still gone by then, it lets you go.
        const party = parties.setAway(who.id, Date.now() + partyAwayMs);
        if (party) {
          emitParty(party);
          const check = setTimeout(() => {
            partyAwayTimers.delete(check);
            if (
              parties.lapsed(Date.now()).includes(who.id) &&
              !accountSockets(who.id).some((s) => s.connected)
            )
              leaveParty(who.id);
          }, partyAwayMs + 50);
          check.unref?.();
          partyAwayTimers.add(check);
        }
        chat.forget(who.id);
        chatStops.delete(who.id);
        chatModes.delete(who.id);
        chatFriends.delete(who.id);
      }
      plaza.leave(socket.id);
      laggingSockets.delete(socket.id);
      stopWatching();
      const s = getSession(socket.id);
      if (s) detach(s);
    });
  });
  let ticks = 0;
  /**
   * A skill was cast or a fighter dashed this tick: send the snapshot now
   * rather than at the next 15 Hz slot (up to 33 ms later), so the cast
   * reaches every player, and its echo the caster, a tick sooner. Basic
   * attacks, which players spam, keep the steady rate.
   */
  const castThisTick = (a: Arena, serial: number) =>
    a.serial > serial &&
    a.events.some(
      (e) =>
        e.id > serial &&
        (e.kind === "dash" ||
          (e.kind === "cast" && !!e.abilityId && !BASIC_IDS.has(e.abilityId))),
    );
  const step = () => {
    const started = diagnostics.now();
    ticks++;
    for (const s of sessions.values())
      if (!s.socketId && s.expires <= Date.now()) expire(s);
    for (let a of [...rooms.values()]) {
      const before = a.phase;
      const serial = a.serial;
      a.drainInputs();
      a.tick();
      if (before !== a.phase && a.phase === "finished")
        // Bots are always up for a rematch.
        for (const p of a.players) p.ready = a.bots.has(p.id);
      if (
        ticks % Math.round(RULES.tick / RULES.snapshot) === 0 ||
        before !== a.phase ||
        castThisTick(a, serial)
      )
        broadcast(a);
    }
    diagnostics.tick(started);
  };
  // Exactly 30 ticks a second on average, as the phones' input clocks run
  // (tick-clock.ts): setInterval drifts, and every drift is a jump.
  const timer =
    options.autoTick === false ? undefined : new TickClock(step, RULES.tick);
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
  /** A full wish meter: pay each wisher once (the fill's ref) within the
   * daily cap, in their Plaza queue, and tell them if they're still here. */
  const payWish = (player: string, ref: string) => {
    if (!accounts.recordWish) return;
    const run = (plazaQueue.get(player) ?? Promise.resolve())
      .then(() => accounts.recordWish!(player, ref))
      .then((pay) => {
        if (!pay?.paid) return;
        for (const key of plaza.keys())
          if (plaza.accountOf(key) === player)
            io.sockets.sockets.get(key)?.emit("plaza-wish-paid", pay);
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
    else if (e.type === "fish")
      io.sockets.sockets.get(e.key)?.emit("plaza-fish", e.note);
    else if (e.type === "news") toPlaza(e.plaza, "plaza-news", e.news);
    else if (e.type === "wish") toPlaza(e.plaza, "plaza-wish", e.wish);
    else if (e.type === "wished")
      for (const player of e.accounts) payWish(player, e.ref);
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
    /** Whether a deploy is replacing this server (drain). */
    get draining() {
      return draining;
    },
    /**
     * A deploy is replacing this server (SIGTERM, index.ts): tell every
     * player, refuse new matches, and wait until the matches already running
     * have ended and their rewards are saved, or until `deadline` (epoch ms).
     */
    drain: async (deadline: number, every?: number) => {
      if (!draining) {
        draining = true;
        io.emit("server-update", { draining: true });
      }
      const busy = () => [...rooms.values()].filter(busyRoom).length;
      connectionLog("arena-drain", { busy: busy(), saving: inflight.size });
      const result = await waitForDrain({ busy, inflight, deadline, every });
      connectionLog("arena-drain-done", result);
      return result;
    },
    close: async () => {
      timer?.stop();
      for (const check of partyAwayTimers) clearTimeout(check);
      if (plazaTimer) clearInterval(plazaTimer);
      if (accountTimer) clearInterval(accountTimer);
      if (diagnosticsTimer) clearInterval(diagnosticsTimer);
      diagnostics.close();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await presenceHistory.flush();
    },
  };
}
