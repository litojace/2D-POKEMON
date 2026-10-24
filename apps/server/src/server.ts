import { createExpedition, prepareExpedition, enterExpeditionCamp, chooseExpeditionCamp, advanceExpedition, restartExpedition, expeditionReceipt } from "./expedition.js";
import { ArcadeArena } from "./arcade.js";
import { arcadeWeek, ARCADE_IDS, type ArcadeId } from "../../../packages/shared/src/arcade.js";
import { RaidArena } from "./raid.js";
import { createRaidArena } from "./raid-bosses.js";
import type { ActivityReceipt } from "../../../packages/shared/src/shop.js";
import { DREAM_RUNES, RAID_ATTACKS, RAID_PINGS, RAID_COSMETICS, raidAttacksOf, type RaidAttack, raidLookOf, raidDay, raidWeek, RAID_BOSSES, RAID_BOSS_ORDER, type RaidBossId, type RaidProgress, type RaidReceipt } from "../../../packages/shared/src/raid.js";
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
  practiceOptionsSchema,
  FIGHTER_IDS,
  MUTATOR_IDS,
  type MutatorId,
  type Fighter,
  type Reply,
} from "../../../packages/shared/src/index.js";
import { Arena } from "./simulation.js";
import { TownWorld } from "./town.js";
import { TOWN } from "../../../packages/shared/src/town.js";
import { playerLevel } from "../../../packages/shared/src/journey.js";
import { MatchLedger, matchSummary } from "./match-summary.js";
import {
  BotBrain,
  BOT_DIFFICULTIES,
  BOT_LABELS,
  type BotDifficulty,
} from "./bot.js";
const botMatchSchema = identitySchema
  .extend({ character: characterSchema, difficulty: z.enum(BOT_DIFFICULTIES), arcade: z.enum(ARCADE_IDS as [ArcadeId, ...ArcadeId[]]).optional() })
  .strict();
const createSchema = identitySchema
  .extend({
    mode: z.enum(["duel", "teams", "ffa", "raid"]).optional(),
    arcade: z.enum(ARCADE_IDS as [ArcadeId, ...ArcadeId[]]).optional(),
    expedition: z.boolean().optional(),
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
  .object({ ids: z.array(z.enum(MUTATOR_IDS as [MutatorId, ...MutatorId[]])).max(8) })
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
export function createArenaServer(
  options: {
    reconnectMs?: number;
    autoTick?: boolean;
    accounts?: AccountProvider;
  } = {},
) {
  const app = express();
  const accounts = options.accounts ?? createAccountProvider();
  app.use(express.json({ limit: "4kb" }));
  const http = createServer(app);
  const io = new Server(http, {
    maxHttpBufferSize: 4096,
    cors: process.env.CLIENT_ORIGIN
      ? { origin: process.env.CLIENT_ORIGIN }
      : undefined,
  });
  const rooms = new Map<string, Arena>(),
    sessions = new Map<string, Session>();
  const grace =
    options.reconnectMs ??
    Number(process.env.RECONNECT_MS ?? RULES.reconnectMs);
  const eventCursors = new WeakMap<Arena, number>();
  /** Which account plays each fighter (kept after a player leaves). */
  const fighterAccounts = new WeakMap<Arena, Map<string, string>>();
  const ledger = new MatchLedger();
  /** Elemental Plaza: everyone walking around the shared town. */
  const town = new TownWorld();
  /** Friends watching a room: socket id → room code and display name. */
  const watchers = new Map<string, { code: string; name: string }>();
  const MAX_WATCHERS = 6;
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
      next(
        new Error(
          error instanceof Error ? error.message : "Unable to verify login.",
        ),
      );
    }
  });
  async function refreshSocket(socket: import("socket.io").Socket) {
    try {
      const account = await authorize(accounts, socket.data.accessToken);
      socket.data.account = account;
      socket.data.expiredChecks = 0;
      const session = getSession(socket.id);
      const arena = session && rooms.get(session.code);
      const fighter = arena?.players.find((p) => p.id === session!.id);
      if (fighter) {
        fighter.name = account.displayName;
        fighter.title = account.title;
        fighter.titleColor = account.titleColor;
      }
      if(fighter) {
        try {const progress=await accounts.rpc(socket.data.accessToken,'arena_raid_progress',{}) as RaidProgress;fighter.raidLook=raidLookOf(progress);}catch{/* Optional until migration 007 is configured. */}
        try {fighter.championLooks=await accounts.rpc(socket.data.accessToken,'arena_my_looks',{}) as Fighter['championLooks'];}catch{/* Optional until migration 010 is configured. */}
      }
      if(arena && fighter)broadcast(arena);
      socket.emit("account-changed");
    } catch (error) {
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
      if (!me) return { online: false, activity: null, room: null };
      const arena = me.room ? rooms.get(me.room) : undefined;
      return {
        online: true,
        activity: me.activity,
        room: me.room,
        fighter: me.fighter,
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
      const activity: OnlinePlayer["activity"] = !arena
        ? town.townOf(socket.id) !== undefined
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
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
      setHeaders(res, file) {
        if (
          /[/\\](sw\.js|manifest\.webmanifest|index\.html|offline\.html)$/.test(
            file,
          )
        )
          res.setHeader("Cache-Control", "no-cache");
        if (file.endsWith("manifest.webmanifest"))
          res.setHeader("Content-Type", "application/manifest+json");
      },
    }),
  );
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(client, "index.html"));
  });
  function getSession(socketId: string) {
    return [...sessions.values()].find((s) => s.socketId === socketId);
  }
  const raidSaves = new WeakMap<RaidArena,string>();
  /** The Shop skin a fighter is wearing for the champion in play. */
  const lookFor = (p: Fighter) => p.championLooks?.[p.character]?.skin ?? null;
  function recordActivity(receipt: ActivityReceipt, done?: (saved: boolean) => void, arena?: Arena) {
    if (arena) {
      const eligible = new Set(receipt.players.filter(p=>p.activeSeconds>=20&&!p.abandoned&&p.participated!==false&&(receipt.kind!=='match'||p.vsPeople||p.botLevel)).map(p=>p.accountId));
      const owners = fighterAccounts.get(arena);
      arena.activityEligible = arena.players.filter(p=>eligible.has(owners?.get(p.id)??'')).map(p=>p.id);
    }
    if (!accounts.recordActivity || !receipt.players.length) { done?.(false); return; }
    void accounts.recordActivity(receipt).then(() => {
      done?.(true);
      // Wallets and missions changed: let those players' games refresh.
      for (const socket of io.sockets.sockets.values())
        if (receipt.players.some((p) => p.accountId === socket.data.account?.id))
          socket.emit("economy-changed");
    }).catch((error) => { done?.(false); console.error("Activity not stored:", error instanceof Error ? error.message : error); });
  }
  function replaceRaidRoom(old: RaidArena, next: RaidArena) {
    const owners = fighterAccounts.get(old);
    if (owners) fighterAccounts.set(next, owners);
    rooms.set(old.code, next);
    return next;
  }
  function startArena(a: Arena) {
    a.start();
    if (a instanceof RaidArena) prepareExpedition(a);
  }
  function broadcast(arena: Arena) {
    if (arena instanceof RaidArena && arena.raid.expedition) {
      enterExpeditionCamp(arena);
      const receipt = expeditionReceipt(arena, fighterAccounts.get(arena));
      if (receipt) recordActivity(receipt, saved => {
        const e = arena.raid.expedition!;
        e.saved = saved ? 'saved' : 'unavailable';
        if (rooms.get(arena.code) === arena) broadcast(arena);
      },arena);
    }
    // Wins and real attempts (not practice, not instant quits) are saved:
    // losses still count towards titles and tell us which attacks are unfair.
    if(arena instanceof RaidArena && !arena.raid.expedition && arena.raid.result && !arena.raid.drill && (arena.raid.result==='victory'||arena.raid.elapsed>=20) && arena.raid.resultId && raidSaves.get(arena)!==arena.raid.resultId) {
      raidSaves.set(arena,arena.raid.resultId);
      const runId=arena.raid.resultId, r=arena.raid;
      const owners=fighterAccounts.get(arena);
      const players=arena.heroes().map(p=>{const c=r.contributions?.[p.id];return {accountId:owners?.get(p.id)??'',character:p.character,damage:Math.round(c?.damage??0),revives:c?.revives??0,pillars:c?.pillars??0,downs:c?.downs??0};}).filter(p=>p.accountId);
      const receipt:RaidReceipt={id:runId,boss:r.boss,peril:r.peril,trait:r.trait,gilded:r.gilded,weekly:false,week:raidWeek(new Date(`${r.day}T12:00:00Z`)),daily:r.daily,day:r.day,feat:arena.feat(),seed:r.seed,partySize:r.partySize,seconds:Math.max(0.001,Math.round(r.elapsed*1000)/1000),downs:r.downs,revives:r.revives,result:r.result??undefined,phaseReached:r.phase,downCauses:{...arena.downCauses},players};
      r.rewardStatus='saving';
      arena.activityStatus='saving';
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
      void (accounts.recordRaid ? accounts.recordRaid(receipt) : Promise.reject(new Error('Raid rewards need server storage configuration.'))).then(()=>{
        if(arena.raid.resultId!==runId)return;
        r.rewardStatus='saved';for(const socket of io.sockets.sockets.values())if(players.some(p=>p.accountId===socket.data.account?.id))socket.emit('account-changed');broadcast(arena);
      }).catch(()=>{if(arena.raid.resultId===runId){r.rewardStatus='unavailable';broadcast(arena);}});
    }

    // A real match just ended: file its summary for the players to report.
    if (arena.phase === "finished" && !arena.matchId && !arena.practice && arena.mode !== "raid") {
      const matchId: string = randomUUID();
      arena.matchId = matchId;
      const owners = fighterAccounts.get(arena);
      if (!arena.arcade) ledger.add(
        matchId,
        matchSummary(arena, (id) => owners?.get(id) ?? null),
      );
      // Coins and missions: reported by the server, never by the players.
      const humans = arena.players.filter((p) => !arena.bots.has(p.id) && owners?.get(p.id));
      const vsPeople = humans.length >= 2 && arena.bots.size === 0;
      const botLevel = [...arena.bots.values()][0]?.difficulty ?? null;
      arena.activityStatus = "saving";
      recordActivity({
        id: `match:${matchId}`,
        kind: "match",
        day: raidDay().day,
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
          participated: arena.engaged.has(p.id) || p.stats.skills > 0 || p.stats.dealt > 0,
          abandoned: p.out || !p.connected,
          skin: lookFor(p),
        })),
      }, saved => { if(arena.matchId!==matchId)return; arena.activityStatus=saved?"saved":"unavailable"; broadcast(arena); },arena);
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
    snapshot.events = snapshot.events.filter(
      (e) => e.id > (eventCursors.get(arena) ?? 0),
    );
    if (snapshot.events.length)
      eventCursors.set(arena, snapshot.events.at(-1)!.id);
    const wire = packSnapshot(snapshot);
    if (arena instanceof RaidArena && arena.raid.boss === "somnara") {
      const recipients = [...sessions.values()].filter(s => s.code === arena.code && s.socketId);
      // Serialize shared world data once. The private sequence is added only
      // to the authenticated seat's socket, never a room/spectator broadcast.
      io.to(arena.code).except(recipients.map(s => s.socketId!)).emit("state", wire);
      for (const session of recipients)
        io.to(session.socketId!).emit("state", { ...wire, raidDream: arena.dreamFor(session.id) });
    } else io.to(arena.code).emit("state", wire);
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
    session.socketId = null;
    session.expires = Date.now() + (permanent ? 0 : grace);
    const standIn =
      arena instanceof RaidArena &&
      ["playing", "countdown", "intermission"].includes(arena.phase) &&
      arena.heroes().some(
        (h) =>
          h.id !== p.id && h.connected && !arena.raid.standIns?.includes(h.id),
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
    const account = () => socket.data.account as Account | undefined;
    const requirePlayer = (cb: unknown) => {
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
      sessions.set(token, {
        accountId: profile.id,
        id,
        token,
        code: arena.code,
        socketId: socket.id,
        expires: Infinity,
      });
      const attached=arena.players.find(p=>p.id===id);
      void accounts.rpc(socket.data.accessToken,'arena_raid_progress',{}).then(value=>{if(attached){attached.raidLook=raidLookOf(value as RaidProgress);broadcast(arena);}}).catch(()=>{});
      // Equipped Shop skins (migration 010); the client shows the one for the champion in play.
      void accounts.rpc(socket.data.accessToken,'arena_my_looks',{}).then(value=>{if(attached){attached.championLooks=value as Fighter['championLooks'];broadcast(arena);}}).catch(()=>{});
      socket.join(arena.code);
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
      stopWatching();
      if (watchersOf(code).length >= MAX_WATCHERS)
        return fail(cb, "This room already has the most watchers it allows.");
      watchers.set(socket.id, { code, name: account()!.displayName });
      socket.join(code);
      reply(cb, { ok: true, code });
      broadcast(arena);
    });
    socket.on("unwatch", (_data: unknown, cb: unknown) => {
      stopWatching();
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
        const current = account();
        if (current && current.id !== next.id)
          return fail(cb, "This connection belongs to a different account.");
        socket.data.accessToken = token;
        socket.data.account = next;
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
      const weekly = arcadeWeek(raidDay().day);
      if (result.data.arcade && (result.data.arcade !== weekly.id || !['duel','teams'].includes(result.data.mode ?? 'duel')))
        return fail(cb, 'Choose this week’s arcade event in 1v1 or 2v2.');
      if (result.data.expedition && (result.data.mode !== "raid" || result.data.arcade)) return fail(cb, "Boss Rush is a co-op raid expedition.");
      const arena = result.data.mode === "raid" ? result.data.expedition ? createExpedition(code, raidDay().day) : createRaidArena(code, result.data.boss) : result.data.arcade ? new ArcadeArena(code, result.data.arcade, weekly.week, result.data.mode ?? 'duel') : new Arena(code, result.data.mode ?? "duel");
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
      s.socketId = socket.id;
      s.expires = Infinity;
      p.connected = true;
      p.lastInput = blankInput();
      if (arena instanceof RaidArena) arena.release(p.id);
      socket.join(s.code);
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
      const weekly = arcadeWeek(raidDay().day);
      if (result.data.arcade && result.data.arcade !== weekly.id) return fail(cb, 'The weekly arcade event has changed. Reopen the menu.');
      const a = result.data.arcade ? new ArcadeArena(code, result.data.arcade, weekly.week) : new Arena(code);
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
        p.ready = false;
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on('raid-config',async(data:unknown,cb:unknown)=>{
      if(!requirePlayer(cb)||!allowed(10))return;
      const s=getSession(socket.id),a=s&&rooms.get(s.code);
      if(!(a instanceof RaidArena)||a.raid.expedition||a.phase!=='lobby'||a.players[0]?.id!==s?.id)return fail(cb,'Only the raid host can change the challenge in the lobby.');
      const result=z.object({peril:z.number().int().min(1).max(3),daily:z.boolean()}).strict().safeParse(data);
      if(!result.success)return fail(cb,'Choose a valid raid challenge.');
      const boss=a.raid.boss,today=raidDay();
      if(result.data.daily&&today.boss!==boss)return fail(cb,`Today's raid is ${RAID_BOSSES[today.boss].name}.`);
      let highest=0,unlocked=boss==='grumblecrag';
      if((result.data.peril>1&&!result.data.daily)||!unlocked){
        try {
          const progress=await accounts.rpc(socket.data.accessToken,'arena_raid_progress',{} ) as RaidProgress;
          highest=progress.bosses?.[boss]?.highestPeril??(boss==='grumblecrag'?progress.highestPeril:0);
          unlocked||=(progress.bosses?.grumblecrag?.clears??progress.clears)>0;
        }
        catch { return fail(cb,'Raid progression is unavailable. Peril 1 is always open.'); }
      }
      // Recheck state after the asynchronous account lookup.
      if(a.phase!=='lobby'||getSession(socket.id)?.id!==s!.id)return fail(cb,'The room changed while checking this challenge.');
      if(!unlocked)return fail(cb,'Clear Grumblecrag first to unlock this boss.');
      if(!result.data.daily&&result.data.peril>highest+1)return fail(cb,'Clear the previous Peril first.');
      a.configure(result.data.peril,result.data.daily);for(const p of a.players)p.ready=false;reply(cb,{ok:true});broadcast(a);
    });
    socket.on('raid-ping',(data:unknown,cb:unknown)=>
      withRoom(cb,(a,id)=>{
        const kind=z.object({kind:z.enum(Object.keys(RAID_PINGS) as ['stack','revive','bait'])}).strict().safeParse(data);
        if(!(a instanceof RaidArena)||!kind.success)return fail(cb,'Pings are for raids.');
        if(!a.ping(id,kind.data.kind))return fail(cb,'Wait a moment before pinging again.');
        reply(cb,{ok:true});broadcast(a);
      },false));
    socket.on("raid-rune", (data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        const result = z.object({ rune: z.enum(DREAM_RUNES) }).strict().safeParse(data);
        if (!(a instanceof RaidArena) || !result.success || !a.callRune(id, result.data.rune))
          return fail(cb, "Only the awake Dreamer can call a rune. Wait a moment between calls.");
        reply(cb, { ok: true }); broadcast(a);
      }, false));
    socket.on('raid-drill',(data:unknown,cb:unknown)=>
      withRoom(cb,(a,id)=>{
        const result=z.object({kind:z.enum(Object.keys(RAID_ATTACKS) as [RaidAttack,...RaidAttack[]]).nullable()}).strict().safeParse(data);
        if(!(a instanceof RaidArena)||a.raid.expedition||!result.success||(result.data.kind!==null&&!raidAttacksOf(a.raid.boss).includes(result.data.kind)))return fail(cb,'Choose an attack to practise.');
        if(a.players[0]?.id!==id)return fail(cb,'The host picks the practice attack.');
        const kind=result.data.kind;
        const ok=kind===null?a.stopDrill():a.raid.drill?a.setDrill(kind):a.startDrill(kind);
        if(!ok)return fail(cb,'Practice opens from the raid lobby.');
        reply(cb,{ok:true});broadcast(a);
      }));
    socket.on('expedition-choice', (data: unknown, cb: unknown) => withRoom(cb, (a,id) => {
      const result = z.object({choice:z.enum(['rest','surge'])}).strict().safeParse(data);
      if (!(a instanceof RaidArena) || !result.success || !chooseExpeditionCamp(a,id,result.data.choice)) return fail(cb,'Choose a camp option once between Boss Rush legs.');
      reply(cb,{ok:true});broadcast(a);
    }));
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
        if (a.phase !== "lobby" || a.bots.size || a.practice || a.mode === "raid")
          return fail(cb, "Party rules can only be changed in a room lobby.");
        if (a.players[0]?.id !== id)
          return fail(cb, "Only the room host can change the party rules.");
        if (a.arcade) return fail(cb, "Weekly arcade rules are fixed for everyone.");
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
    socket.on("input", (data: unknown) =>
      withRoom(undefined, (a, id) => {
        const result = inputSchema.safeParse(data);
        if (result.success)
          a.submit(a.players.find((p) => p.id === id)!, result.data);
      }),
    );
    socket.on("rematch", (_data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        if(a instanceof RaidArena){
          if(a.raid.expedition){
            if(a.phase!=='finished'||!a.heroes().every(p=>p.connected))return fail(cb,'Finish the expedition and reconnect before retrying.');
            a.players.find(p=>p.id===id)!.ready=true;
            if(a.heroes().every(p=>p.ready))a=replaceRaidRoom(a,restartExpedition(a,raidDay().day,true));
            reply(cb,{ok:true});broadcast(a);return;
          }
          if(a.phase!=='finished'||!a.heroes().length||!a.heroes().every(p=>p.connected))return fail(cb,'Return to the lobby to refill the team.');
          a.players.find(p=>p.id===id)!.ready=true;
          if(a.heroes().every(p=>p.ready))a.retry();
          reply(cb,{ok:true});broadcast(a);return;
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
        if (a instanceof RaidArena && a.raid.expedition && a.phase === 'finished') {
          a = replaceRaidRoom(a,restartExpedition(a,raidDay().day,false));
          reply(cb,{ok:true});broadcast(a);return;
        }
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
    // ───────────── Town ─────────────
    // Starting or joining a room takes you out of town.
    socket.use(([event]: unknown[], next: (error?: Error) => void) => {
      if (["create", "join", "practice", "bot-match", "resume", "watch"].includes(String(event)) && town.townOf(socket.id) !== undefined) {
        town.leave(socket.id);
        socket.emit("town-closed");
      }
      next();
    });
    socket.on("town-join", (data: unknown, cb: unknown) => {
      if (!allowed(10) || !requirePlayer(cb)) return;
      if (getSession(socket.id)) return fail(cb, "Leave your room before visiting the town.");
      const parsed = characterSchema.safeParse((data as { character?: unknown } | null)?.character);
      if (!parsed.success) return fail(cb, "Choose a fighter first.");
      const me = account()!;
      const walker = town.join(socket.id, me.id, {
        name: me.displayName,
        title: me.title ?? null,
        titleColor: me.titleColor ?? null,
        level: null,
        character: parsed.data,
        skin: null,
      });
      reply(cb, { ok: true, town: walker.town, me: walker.profile.id });
      lookUpTownProfile(parsed.data, true);
    });
    /** Level and the fighter's equipped skin need account lookups; they follow shortly. */
    const lookUpTownProfile = (character: string, level: boolean) => {
      const token = socket.data.accessToken as string | undefined;
      if (!token) return;
      if (level)
        void accounts
          .rpc(token, "arena_journey", {})
          .then((j) => {
            const xp = Number((j as { xp?: unknown } | null)?.xp);
            if (Number.isFinite(xp)) town.updateProfile(socket.id, { level: playerLevel(xp).level });
          })
          .catch(() => undefined);
      void accounts
        .rpc(token, "arena_my_looks", {})
        .then((looks) => {
          // Ignore an answer for a fighter the player has since switched from.
          if (town.profileOf(socket.id)?.character !== character) return;
          const look = (looks as Record<string, { skin: string; stage?: number }> | null)?.[character];
          const skin = look?.skin ? { skin: look.skin, stage: look.stage } : null;
          if (JSON.stringify(skin) !== JSON.stringify(town.profileOf(socket.id)?.skin ?? null))
            town.updateProfile(socket.id, { skin });
        })
        .catch(() => undefined);
    };
    // Switched fighter, or equipped a different skin, while in town.
    socket.on("town-look", (data: unknown, cb: unknown) => {
      if (!allowed(10)) return;
      if (town.townOf(socket.id) === undefined) return fail(cb, "Not in town.");
      const parsed = characterSchema.safeParse((data as { character?: unknown } | null)?.character);
      if (!parsed.success) return fail(cb, "Choose a fighter first.");
      if (town.profileOf(socket.id)?.character !== parsed.data)
        town.updateProfile(socket.id, { character: parsed.data, skin: null });
      lookUpTownProfile(parsed.data, false);
      reply(cb, { ok: true });
    });
    socket.on("town-input", (data: unknown) => {
      if (!allowed(40)) return;
      const d = data as { dx?: unknown; dy?: unknown } | null;
      town.input(socket.id, d?.dx, d?.dy);
    });
    socket.on("town-jump", () => {
      if (!allowed(10)) return;
      town.jump(socket.id, Date.now());
    });
    socket.on("town-emote", (data: unknown, cb: unknown) => {
      if (!allowed(10)) return;
      const ok = town.emote(socket.id, (data as { emote?: unknown } | null)?.emote, Date.now());
      reply(cb, ok ? { ok: true } : { ok: false, error: "Wait a moment between emotes." });
    });
    socket.on("town-leave", (_data: unknown, cb: unknown) => {
      town.leave(socket.id);
      reply(cb, { ok: true });
    });
    socket.on("disconnect", () => {
      town.leave(socket.id);
      stopWatching();
      const s = getSession(socket.id);
      if (s) detach(s);
    });
  });
  let ticks = 0;
  const step = () => {
    ticks++;
    for (const s of sessions.values())
      if (!s.socketId && s.expires <= Date.now()) expire(s);
    for (let a of [...rooms.values()]) {
      const before = a.phase;
      a.tick();
      if (a instanceof RaidArena && a.raid.expedition?.camp) {
        const next = advanceExpedition(a);
        if (next) a = replaceRaidRoom(a,next);
      }
      if (before !== a.phase && a.phase === "finished")
        // Bots are always up for a rematch.
        for (const p of a.players) p.ready = a.bots.has(p.id);
      if (
        ticks % Math.round(RULES.tick / RULES.snapshot) === 0 ||
        before !== a.phase
      )
        broadcast(a);
    }
  };
  const timer =
    options.autoTick === false
      ? undefined
      : setInterval(step, 1000 / RULES.tick);
  /** Move everyone in town and send each player what is near them. */
  let townTicks = 0;
  const townStep = () => {
    townTicks++;
    town.step(1 / TOWN.tick, Date.now());
    if (townTicks % Math.round(TOWN.tick / TOWN.send) !== 0) return;
    for (const key of town.keys()) {
      const socket = io.sockets.sockets.get(key);
      if (!socket) {
        town.leave(key);
        continue;
      }
      const view = town.view(key);
      if (!view) continue;
      if (view.profiles.length) socket.emit("town-profiles", view.profiles);
      socket.emit("town-state", view.state);
    }
  };
  const townTimer =
    options.autoTick === false
      ? undefined
      : setInterval(() => {
          if (town.size) townStep();
        }, 1000 / TOWN.tick);
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
    town,
    townStep,
    close: async () => {
      if (timer) clearInterval(timer);
      if (townTimer) clearInterval(townTimer);
      if (accountTimer) clearInterval(accountTimer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
