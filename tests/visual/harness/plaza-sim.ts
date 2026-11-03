// The Plaza server, in the page: the real PlazaWorld with the player in it.
import { PlazaWorld } from "../../../apps/server/src/plaza";
import { PLAZA, PLAZA_QUESTS } from "../../../packages/shared/src/plaza";

const w = window as unknown as Record<string, any>;
const world = new PlazaWorld();
const ME = "local";
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
    PLAZA_QUESTS.map((q) => [q.id, { n: q.id === "cheers" ? 6 : 0, done: q.id === "photo" }]),
  ),
  orbsToday: 0,
  bestLapMs: 7420,
  board: [
    { name: "Nova", ms: 6120 },
    { name: "tester", ms: 7420, me: true },
  ],
  leaves: 1234,
};
/** Regular crops in the barn: treats to throw (migration 049). */
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
        error: "No crops to throw yet. Harvest some on the Farm.",
        treats: 0,
      };
    w.__plazaTreats--;
    w.__plazaTreatsThrown.push("wheat");
    const thrown = world.treat(ME, "wheat");
    setTimeout(() => w.__sock?.fire("plaza-treat", thrown), 0);
    return { ok: true, crop: "wheat", treats: w.__plazaTreats };
  }
  if (ev === "plaza-look") {
    world.updateProfile(ME, { character: data.character });
    return { ok: true };
  }
  if (ev === "plaza-leave") {
    world.leave(ME);
    return { ok: true };
  }
  if (ev === "plaza-emote") return { ok: world.emote(ME, data.emote, Date.now()) };
  if (ev === "plaza-act") {
    if (data.spot === "cafe") {
      if (!world.at(ME, "cafe")) return { ok: false, error: "Walk up to the Volt Boba truck first." };
      world.boost(ME);
      w.__plazaProgress.leaves -= PLAZA.boba.leaves;
      return { ok: true, leaves: w.__plazaProgress.leaves };
    }
    return { ok: world.at(ME, data.spot) };
  }
  return undefined;
};
const before = { reply: w.__reply, emit: w.__emit };
w.__reply = (ev: string, data: unknown) =>
  ev.startsWith("plaza-") ? handle(ev, data) : before.reply?.(ev, data);
w.__emit = (ev: string, data: any) => {
  if (ev === "plaza-input") world.input(ME, data.dx, data.dy);
  else if (ev === "plaza-jump") world.jump(ME);
  else if (ev === "plaza-dash") world.dash(ME);
  else before.emit?.(ev, data);
};
let ticks = 0;
setInterval(() => {
  for (const e of world.step(1 / PLAZA.tick, Date.now()))
    if (e.type === "news") w.__sock?.fire("plaza-news", e.news);
    else if (e.type === "orbs") w.__sock?.fire("plaza-orbs", e.orbs);
  if (++ticks % 2) return;
  const v = w.__sock && world.view(ME);
  if (!v) return;
  if (v.profiles.length) w.__sock.fire("plaza-profiles", v.profiles);
  w.__sock.fire("plaza-state", v.state);
}, 1000 / PLAZA.tick);
