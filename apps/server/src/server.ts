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
  type Reply,
} from "../../../packages/shared/src/index.js";
import { Arena } from "./simulation.js";
type Session = {
  id: string;
  token: string;
  code: string;
  socketId: string | null;
  expires: number;
};
export function createArenaServer(
  options: { reconnectMs?: number; autoTick?: boolean } = {},
) {
  const app = express();
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
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, rooms: rooms.size }),
  );
  const client = path.resolve("apps/client/dist");
  app.use(express.static(client));
  app.get("*", (_req, res) => res.sendFile(path.join(client, "index.html")));
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
    if (arena.phase === "paused" && arena.players.every((p) => p.connected))
      arena.phase = arena.previousPhase;
  }
  function detach(session: Session, permanent = false) {
    const arena = rooms.get(session.code);
    if (!arena) return;
    const p = arena.players.find((p) => p.id === session.id);
    if (!p) return;
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
    if (arena.phase === "paused" && other) {
      arena.forfeit(other.id);
      for (const p of arena.players) p.ready = false;
    } else if (arena.phase === "lobby")
      arena.players = arena.players.filter((p) => p.id !== session.id);
    if (![...sessions.values()].some((s) => s.code === arena.code))
      rooms.delete(arena.code);
    else broadcast(arena);
  }
  io.on("connection", (socket) => {
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
      sessions.set(token, {
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
    socket.on("create", (data: unknown, cb: unknown) => {
      if (!allowed(15))
        return fail(cb, "Too many requests. Try again in a moment.");
      const result = identitySchema.safeParse(data);
      if (!result.success)
        return fail(cb, "Use a display name of 1–20 characters.");
      if (getSession(socket.id))
        return fail(cb, "Leave your current room first.");
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
      const arena = new Arena(code);
      rooms.set(code, arena);
      attach(arena, result.data.name, cb);
    });
    socket.on("join", (data: unknown, cb: unknown) => {
      if (!allowed(15)) return fail(cb, "Too many requests.");
      const result = joinSchema.safeParse(data);
      if (!result.success)
        return fail(cb, "Enter your name and a six-character room code.");
      if (getSession(socket.id))
        return fail(cb, "Leave your current room first.");
      const arena = rooms.get(result.data.code);
      if (!arena)
        return fail(cb, "Room not found. Check the code with your friend.");
      if (arena.practice)
        return fail(cb, "Solo practice sessions cannot be joined.");
      if (arena.players.length >= 2) return fail(cb, "This room is full.");
      if (arena.phase !== "lobby")
        return fail(cb, "This match has already started.");
      attach(arena, result.data.name, cb);
    });
    socket.on("resume", (data: unknown, cb: unknown) => {
      if (!allowed(15)) return fail(cb, "Too many requests.");
      const result = resumeSchema.safeParse(data);
      if (!result.success) return fail(cb, "Invalid session.");
      if (getSession(socket.id))
        return fail(cb, "You already have an active session.");
      const s = sessions.get(result.data.token);
      if (!s || s.expires < Date.now())
        return fail(cb, "Your session expired. Create or join a room again.");
      if (s.socketId) return fail(cb, "This player is already connected.");
      const arena = rooms.get(s.code);
      const p = arena?.players.find((p) => p.id === s.id);
      if (!arena || !p) return fail(cb, "Room expired.");
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
    ) => {
      if (!allowed()) return fail(cb, "Too many requests.");
      const s = getSession(socket.id);
      const a = s && rooms.get(s.code);
      if (!s || !a) return fail(cb, "Join a room first.");
      action(a, s.id);
    };
    socket.on("practice", (data: unknown, cb: unknown) => {
      if (!allowed(15)) return fail(cb, "Too many requests.");
      const result = identitySchema
        .extend({ character: characterSchema })
        .safeParse(data);
      if (!result.success)
        return fail(cb, "Choose a valid character and display name.");
      if (getSession(socket.id))
        return fail(cb, "Leave your current room first.");
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
    socket.on("practice-character", (data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
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
      withRoom(cb, (a) => {
        if (!a.practice || a.phase === "paused")
          return fail(cb, "Reset is available only in active solo practice.");
        a.resetPractice();
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("practice-options", (data: unknown, cb: unknown) =>
      withRoom(cb, (a) => {
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
        if (
          a.players.length === 2 &&
          a.players.every((p) => p.ready && p.connected)
        )
          a.start();
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("input", (data: unknown) =>
      withRoom(undefined, (a, id) => {
        const result = inputSchema.safeParse(data);
        if (result.success)
          a.submit(
            a.players.find((p) => p.id === id)!,
            result.data,
          );
      }),
    );
    socket.on("rematch", (_data: unknown, cb: unknown) =>
      withRoom(cb, (a, id) => {
        if (
          a.phase !== "finished" ||
          a.players.length !== 2 ||
          !a.players.every((p) => p.connected)
        )
          return fail(cb, "Both players must be connected for a rematch.");
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
        a.phase = "lobby";
        a.players = a.players.filter((p) =>
          [...sessions.values()].some(
            (s) => s.code === a.code && s.id === p.id,
          ),
        );
        for (const p of a.players) p.ready = false;
        reply(cb, { ok: true });
        broadcast(a);
      }),
    );
    socket.on("leave", (_data: unknown, cb: unknown) => {
      const s = getSession(socket.id);
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
        for (const p of a.players) p.ready = false;
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
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
