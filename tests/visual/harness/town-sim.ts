// The town server, in the page: the real TownWorld with the player in it.
import { TownWorld } from "../../../apps/server/src/town";
import { TOWN } from "../../../packages/shared/src/town";

const w = window as unknown as Record<string, any>;
const world = new TownWorld();
const ME = "local";
const handle = (ev: string, data: any) => {
  if (ev === "town-join") {
    const me = world.join(ME, "acct-me", {
      name: "tester",
      title: null,
      titleColor: null,
      level: 12,
      character: data.character,
      skin: null,
    });
    me.x = 1600;
    me.y = 1330;
    return { ok: true, town: 1, me: me.profile.id };
  }
  if (ev === "town-input") {
    world.input(ME, data.dx, data.dy);
    return { ok: true };
  }
  if (ev === "town-look") {
    world.updateProfile(ME, { character: data.character });
    return { ok: true };
  }
  if (ev === "town-leave") {
    world.leave(ME);
    return { ok: true };
  }
  if (ev === "town-emote") return { ok: world.emote(ME, data.emote, Date.now()) };
  if (ev === "town-jump") return { ok: world.jump(ME, Date.now()) };
  return undefined;
};
w.__reply = (ev: string, data: unknown) => (ev.startsWith("town-") ? handle(ev, data) : undefined);
w.__emit = (ev: string, data: unknown) => {
  if (ev === "town-input" || ev === "town-leave" || ev === "town-jump") handle(ev, data);
};
setInterval(() => {
  world.step(1 / TOWN.tick, Date.now());
  const v = w.__sock && world.view(ME);
  if (!v) return;
  if (v.profiles.length) w.__sock.fire("town-profiles", v.profiles);
  w.__sock.fire("town-state", v.state);
}, 1000 / TOWN.tick);
