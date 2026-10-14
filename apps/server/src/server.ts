import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomInt } from "node:crypto";
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
  type Reply,
} from "../../../packages/shared/src/index.js";
import { Arena } from "./simulation.js";
import {
  BotBrain,
  BOT_DIFFICULTIES,
  BOT_LABELS,
  type BotDifficulty,
} from "./bot.js";
const botMatchSchema = identitySchema
  .extend({ character: characterSchema, difficulty: z.enum(BOT_DIFFICULTIES) })
  .strict();
const createSchema = identitySchema
  .extend({ mode: z.enum(["duel", "teams"]).optional() })
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
const BOT_COLORS = { easy: "#65d38a", normal: "#7ff3ff", hard: "#ff697f" };
import {
  createAccountProvider,
  authorize,
  installAccountRoutes,
  AccountError,
  type AccountProvider,
} from "./accounts.js";
import type {
  Account,
  OnlineList,
  OnlinePlayer,
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
        ? "menu"
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
    const order = { match: 0, practice: 1, lobby: 2, menu: 3 };
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
  function broadcast(arena: Arena) {
    let remaining = 0;
    if (arena.phase === "paused") {
      const deadlines = [...sessions.values()]
        .filter((s) => s.code === arena.code && !s.socketId)
        .map((s) => s.expires);
      remaining = Math.max(0, (Math.min(...deadlines) - Date.now()) / 1000);
    }
    const snapshot = arena.snapshot(remaining);
    snapshot.events = snapshot.events.filter(
      (e) => e.id > (eventCursors.get(arena) ?? 0),
    );
    if (snapshot.events.length)
      eventCursors.set(arena, snapshot.events.at(-1)!.id);
    io.to(arena.code).emit("state", packSnapshot(snapshot));
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
    if (!["lobby", "finished", "paused"].includes(arena.phase)) {
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
      arena.mode === "teams" &&
      leaver &&
      !["lobby", "finished"].includes(arena.phase)
    ) {
      // 2v2: the leaver is out for good; their partner plays on alone.
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
      if (!partners.length && opponents.length) {
        arena.forfeit(opponents[0].id);
        for (const p of arena.players) p.ready = false;
      } else resume(arena);
    } else if (arena.phase === "paused" && other) {
      arena.forfeit(other.id);
      for (const p of arena.players) p.ready = false;
    } else if (arena.phase === "lobby")
      arena.players = arena.players.filter((p) => p.id !== session.id);
    if (![...sessions.values()].some((s) => s.code === arena.code))
      rooms.delete(arena.code);
    else broadcast(arena);
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
      sessions.set(token, {
        accountId: profile.id,
        id,
        token,
        code: arena.code,
        socketId: socket.id,
        expires: Infinity,
      });
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
      const arena = new Arena(code, result.data.mode ?? "duel");
      arena.rotateArenas = true;
      rooms.set(code, arena);
      attach(arena, result.data.name, cb);
    });
    socket.on("join", (data: unknown, cb: unknown) => {
      if (!requirePlayer(cb)) return;
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
      const a = new Arena(code);
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
        p.character = result.data;
        p.ready = false;
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
          a.players.length === a.size &&
          a.players.filter((p) => a.teamOf(p) === 0).length === half &&
          a.players.every((p) => p.ready && p.connected)
        )
          a.start();
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
        if (
          a.phase !== "finished" ||
          a.players.length !== a.size ||
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
        if (a.bots.size) return fail(cb, "Leave to return to the menu.");
        a.phase = "lobby";
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
    socket.on("disconnect", () => {
      const s = getSession(socket.id);
      if (s) detach(s);
    });
  });
  let ticks = 0;
  const step = () => {
    ticks++;
    for (const s of sessions.values())
      if (!s.socketId && s.expires <= Date.now()) expire(s);
    for (const a of rooms.values()) {
      const before = a.phase;
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
  };
  const timer =
    options.autoTick === false
      ? undefined
      : setInterval(step, 1000 / RULES.tick);
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
    step,
    broadcast,
    close: async () => {
      if (timer) clearInterval(timer);
      if (accountTimer) clearInterval(accountTimer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
