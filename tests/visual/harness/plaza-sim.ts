// The Plaza server, in the page: the real PlazaWorld with the player in it.
import { PlazaWorld } from "../../../apps/server/src/plaza";
import {
  PLAZA,
  PLAZA_EMOTES,
  PLAZA_FISHING,
  PLAZA_QUESTS,
} from "../../../packages/shared/src/plaza";
import { CHAT_LIMITS, quickText } from "../../../packages/shared/src/chat";

const w = window as unknown as Record<string, any>;
const world = new PlazaWorld();
const ME = "local";
/** Nearby lines said here, as the server's ChatHub keeps them. */
const placeLines: unknown[] = [];
w.__plazaWorld = world;
/** Move the player (tests). */
w.__plazaPosition = (x: number, y: number) => {
  const b = world.bodyOf(ME);
  if (b) Object.assign(b, { x, y });
};
/** Today's quests and TOP DASH as the database would send them. */
w.__plazaProgress = {
  day: "2026-11-02",
  quests: Object.fromEntries(
    PLAZA_QUESTS.map((q) => [
      q.id,
      { n: q.id === "cheers" ? 6 : 0, done: q.id === "photo" },
    ]),
  ),
  orbsToday: 0,
  bestLapMs: 7420,
  board: [
    { name: "Nova", ms: 6120 },
    { name: "tester", ms: 7420, me: true },
  ],
};
/** Tests: the fish on the line bites at the next step. */
w.__plazaBiteNow = () => {
  const line = (world as any).visitors.get(ME)?.line;
  if (line) line.biteAt = 0;
};
/** Treats left today (PLAZA.treatsDaily a day): treats to throw. */
w.__plazaTreats = 3;
w.__plazaTreatsThrown = [] as string[];
const handle = (ev: string, data: any) => {
  if (ev === "plaza-join") {
    const me = world.join(ME, "acct-me", {
      name: "tester",
      title: null,
      titleColor: null,
      level: 12,
      character: data.character,
      skin: null,
    });
    // The server sends your treat count after the join.
    setTimeout(() => w.__sock?.fire("plaza-treats", { n: w.__plazaTreats }), 0);
    return { ok: true, plaza: me.plaza, me: me.profile.id };
  }
  if (ev === "plaza-treat") {
    if (!world.treatReady(ME, Date.now()))
      return { ok: false, error: "Wait a moment between treats." };
    if (w.__plazaTreats < 1)
      return {
        ok: false,
        error: "No treats left today. More tomorrow!",
        treats: 0,
      };
    w.__plazaTreats--;
    w.__plazaTreatsThrown.push("cupcake");
    const thrown = world.treat(ME, "cupcake");
    setTimeout(() => w.__sock?.fire("plaza-treat", thrown), 0);
    return { ok: true, treat: "cupcake", treats: w.__plazaTreats };
  }
  if (ev === "plaza-look") {
    world.updateProfile(ME, { character: data.character });
    return { ok: true };
  }
  if (ev === "plaza-leave") {
    world.leave(ME);
    return { ok: true };
  }
  if (ev === "plaza-emote")
    return { ok: world.emote(ME, data.emote, Date.now()) };
  // Chat's Nearby channel (server.ts): a quick line, and the Plaza's own
  // emote over your head when it has one.
  if (ev === "chat-send") {
    const text = data.quick ? quickText(data.quick) : null;
    if (!text) return { ok: false, error: "Here you can use quick chat." };
    if ((PLAZA_EMOTES as readonly string[]).includes(text))
      world.emote(ME, text, Date.now());
    w.__chatSerial = (w.__chatSerial ?? 0) + 1;
    const line = {
      id: w.__chatSerial,
      channel: "place",
      from: { id: "11111111-1111-4111-8111-111111111111", name: "tester" },
      at: Date.now(),
      quick: data.quick,
    };
    placeLines.push(line);
    if (placeLines.length > CHAT_LIMITS.history) placeLines.shift();
    setTimeout(() => w.__sock?.fire("chat", line));
    return { ok: true };
  }
  // The Nearby lines the server keeps (the drawer reads them on opening).
  if (ev === "chat-history") return { ok: true, lines: [...placeLines] };
  // Fishing: the real PlazaWorld decides; a catch is recorded here as the
  // database would (arena_plaza_record), and the progress sent back.
  if (ev === "plaza-fish") {
    if (data?.act === "cast") return world.cast(ME, Date.now(), data.tz);
    const r = world.reel(ME, Date.now());
    if (r.ok) {
      const p = w.__plazaProgress;
      p.fishBook = { ...(p.fishBook ?? {}) };
      if ((p.fishToday ?? 0) < PLAZA_FISHING.perDay) {
        p.fishToday = (p.fishToday ?? 0) + 1;
        p.fishBook[r.fish] = (p.fishBook[r.fish] ?? 0) + 1;
        const q = p.quests.fish;
        q.n = Math.min(3, q.n + 1);
        q.done = q.n >= 3;
      } else p.fishBook[r.fish] ??= 0;
      setTimeout(() => w.__sock?.fire("plaza-progress", structuredClone(p)));
    }
    return r;
  }
  if (ev === "plaza-act") {
    if (data.spot === "cafe") {
      if (!world.at(ME, "cafe"))
        return { ok: false, error: "Walk up to the Volt Boba truck first." };
      world.boost(ME);
      return { ok: true };
    }
    return { ok: world.at(ME, data.spot) };
  }
  return undefined;
};
const before = { reply: w.__reply, emit: w.__emit };
w.__reply = (ev: string, data: any) =>
  ev.startsWith("plaza-") ||
  ((ev === "chat-send" || ev === "chat-history") && data?.channel === "place")
    ? handle(ev, data)
    : before.reply?.(ev, data);
w.__emit = (ev: string, data: any) => {
  // Numbered and timed, as the game server takes them (PlazaTiming).
  const timing = { s: data?.s, t: data?.t };
  if (ev === "plaza-input") world.input(ME, data.dx, data.dy, timing);
  else if (ev === "plaza-jump") world.jump(ME, timing);
  else if (ev === "plaza-dash") world.dash(ME, data?.dx, data?.dy, timing);
  else before.emit?.(ev, data);
};
let ticks = 0;
setInterval(() => {
  for (const e of world.step(1 / PLAZA.tick, Date.now()))
    if (e.type === "news") w.__sock?.fire("plaza-news", e.news);
    else if (e.type === "fish") w.__sock?.fire("plaza-fish", e.note);
    else if (e.type === "orbs") w.__sock?.fire("plaza-orbs", e.orbs);
  if (++ticks % 2) return;
  const v = w.__sock && world.view(ME);
  if (!v) return;
  if (v.profiles.length) w.__sock.fire("plaza-profiles", v.profiles);
  w.__sock.fire("plaza-state", v.state);
}, 1000 / PLAZA.tick);
