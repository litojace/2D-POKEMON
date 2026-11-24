// The Plaza server, in the page: the real PlazaWorld with the player in it.
import { PlazaWorld } from "../../../apps/server/src/plaza";
import {
  PLAZA,
  PLAZA_EMOTES,
  PLAZA_FISH,
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
  gifts: 3,
  bestLapMs: 7420,
  board: [
    { name: "Nova", ms: 6120 },
    { name: "tester", ms: 7420, me: true },
  ],
};
/** Tests: how long a new cast waits before its fish bites (ms), instead of
 * the server's random 2-6 s; unset keeps the server's. */
w.__plazaBiteAfter = 0;
/** Tests: a fish that has bitten waits for the tap instead of swimming off
 * after the window (off: the server's window). */
w.__plazaBiteHold = false;
/** Tests: the fish on the line bites at the next step. */
w.__plazaBiteNow = () => {
  const line = (world as any).visitors.get(ME)?.line;
  if (line) line.biteAt = 0;
};
/** Gift boxes left today (the database's count, PLAZA_GIFT), the boxes
 * tossed so far, and tests: the next box is golden. */
w.__plazaGifts = 3;
w.__plazaGiftsThrown = [] as boolean[];
w.__plazaGolden = false;
/** Tests: a gift box tossed by someone else (profile `by`, standing at
 * x0, y0), as the server would send it. */
w.__plazaOtherGift = (x0: number, y0: number, golden = false) => {
  const other = world.join("gift-other", "acct-gift-other", {
    name: "Nova",
    title: null,
    titleColor: null,
    level: 9,
    character: "voltkit",
    skin: null,
  });
  Object.assign(world.bodyOf("gift-other")!, {
    x: x0,
    y: y0,
    lastX: 1,
    lastY: 0,
  });
  const t = world.throwGift("gift-other", golden, Date.now());
  if (t) w.__sock?.fire("plaza-gift", t.gift);
  return other.profile.id;
};
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
    return { ok: true, plaza: me.plaza, me: me.profile.id };
  }
  if (ev === "plaza-gift") {
    if (!world.giftReady(ME, Date.now()))
      return { ok: false, error: "Wait a moment between gift boxes." };
    if (w.__plazaGifts < 1) {
      world.giftRefused(ME);
      return {
        ok: false,
        error:
          "No gift boxes left today. Plaza quests and rare fish earn more!",
        gifts: 0,
      };
    }
    w.__plazaGifts--;
    const golden = !!w.__plazaGolden;
    w.__plazaGiftsThrown.push(golden);
    const t = world.throwGift(ME, golden, Date.now());
    if (t) setTimeout(() => w.__sock?.fire("plaza-gift", t.gift), 0);
    return { ok: true, golden, gifts: w.__plazaGifts };
  }
  if (ev === "plaza-look") {
    world.updateProfile(ME, { character: data.character });
    return { ok: true };
  }
  if (ev === "plaza-leave") {
    world.leave(ME);
    return { ok: true };
  }
  // Pair emotes (server.ts): a request goes to the other player's socket,
  // kept here for tests; a yes starts it for both.
  if (ev === "plaza-pair-ask") {
    const r = world.pairAsk(ME, data?.to, data?.kind, Date.now());
    if (!r.ok) return r;
    (w.__plazaPairAsks ??= []).push({ to: r.to, ...r.ask });
    return { ok: true };
  }
  if (ev === "plaza-pair-answer") {
    const r = world.pairAnswer(ME, data?.from, data?.yes === true, Date.now());
    if (!r.ok) return r;
    if (!r.declined) setTimeout(() => w.__sock?.fire("plaza-pair", r.start));
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
    if (data?.act === "cast") {
      const r = world.cast(ME, Date.now(), data.tz);
      // Tests: a fish that bites only when told (__plazaBiteNow), so a slow
      // machine never sees it bite and swim off between two looks.
      const line = (world as any).visitors.get(ME)?.line;
      if (r.ok && line && w.__plazaBiteAfter)
        line.biteAt = Date.now() + w.__plazaBiteAfter;
      return r;
    }
    if (data?.act === "stop") return { ok: world.stopFishing(ME, Date.now()) };
    if (data?.act === "reel") return world.reel(ME, Date.now());
    const r = world.land(ME, Date.now(), data?.moves);
    if (r.ok) {
      const p = w.__plazaProgress;
      p.fishBook = { ...(p.fishBook ?? {}) };
      if ((p.fishToday ?? 0) < PLAZA_FISHING.perDay) {
        p.fishToday = (p.fishToday ?? 0) + 1;
        p.fishBook[r.fish] = (p.fishBook[r.fish] ?? 0) + 1;
        const q = p.quests.fish;
        const max = PLAZA_QUESTS.find((x) => x.id === "fish")!.max;
        q.n = Math.min(max, q.n + 1);
        q.done = q.n >= max;
      } else p.fishBook[r.fish] ??= 0;
      // The whole book: the title (arena_plaza_record).
      p.fishTitle = PLAZA_FISH.every((f) => p.fishBook[f.id] !== undefined);
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
  else if (ev === "plaza-trip") world.trip(ME, data?.left, timing);
  else if (ev === "plaza-fish" && data?.act === "stop")
    world.stopFishing(ME, Date.now());
  else before.emit?.(ev, data);
};
/** What server.ts sends for a Plaza event (rewards are the database's). */
function fire(e: ReturnType<PlazaWorld["step"]>[number]) {
  if (e.type === "news") w.__sock?.fire("plaza-news", e.news);
  else if (e.type === "orbs") w.__sock?.fire("plaza-orbs", e.orbs);
  else if (e.type === "fish") w.__sock?.fire("plaza-fish", e.note);
  else if (e.type === "giftGone") w.__sock?.fire("plaza-gift-gone", e.gone);
  // A gift orb caught: the database counts it toward the orbs quest.
  else if (e.type === "orb")
    w.__plazaOrbRefs = [...(w.__plazaOrbRefs ?? []), e.ref];
}
let ticks = 0;
setInterval(() => {
  // Tests: a bite that waits for the tap (__plazaBiteHold), so a slow
  // machine's tap still lands inside the window.
  const line = (world as any).visitors.get(ME)?.line;
  if (
    w.__plazaBiteHold &&
    line &&
    line.bitAt !== null &&
    line.hookedAt === null
  )
    line.bitAt = Date.now();
  for (const e of world.step(1 / PLAZA.tick, Date.now())) fire(e);
  if (++ticks % 2) return;
  const v = w.__sock && world.view(ME);
  if (!v) return;
  if (v.profiles.length) w.__sock.fire("plaza-profiles", v.profiles);
  w.__sock.fire("plaza-state", v.state);
}, 1000 / PLAZA.tick);
