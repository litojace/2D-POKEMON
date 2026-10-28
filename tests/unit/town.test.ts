import { describe, expect, it } from "vitest";
import { TownWorld } from "../../apps/server/src/town.js";
import { TOWN, TOWN_OBSTACLES, TOWN_SPOTS, TOWN_TREES, townCollide, townHop, townStep } from "../../packages/shared/src/town.js";

const profile = (name: string) => ({ name, title: null, titleColor: null, level: 3, character: "voltkit", skin: null });

describe("town", () => {
  it("fills a town, then opens the next one", () => {
    const world = new TownWorld();
    for (let i = 0; i < TOWN.capacity + 3; i++) world.join(`s${i}`, `a${i}`, profile(`P${i}`));
    expect(world.population(1)).toBe(TOWN.capacity);
    expect(world.population(2)).toBe(3);
    world.leave("s0");
    world.join("late", "a-late", profile("Late"));
    expect(world.townOf("late")).toBe(1);
  });

  it("keeps one body per account", () => {
    const world = new TownWorld();
    world.join("tab1", "acct", profile("Me"));
    world.join("tab2", "acct", profile("Me"));
    expect(world.size).toBe(1);
    expect(world.townOf("tab2")).toBe(1);
  });

  it("walks at town speed and never enters the fountain or leaves the map", () => {
    const world = new TownWorld();
    world.join("me", "acct", profile("Me"));
    world.input("me", 0, -1);
    for (let i = 0; i < 200; i++) world.step(1 / TOWN.tick, i * 50);
    const fountain = TOWN_OBSTACLES.find((o) => o.kind === "fountain")! as { x: number; y: number; rx: number; ry: number };
    const me = world.view("me")!.state.walkers[0];
    const inside = Math.hypot((me[1] - fountain.x) / fountain.rx, (me[2] - fountain.y) / fountain.ry);
    expect(inside).toBeGreaterThanOrEqual(1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let p: { x: number; y: number } = { x: TOWN.spawn.x, y: TOWN.spawn.y };
      for (let i = 0; i < 400; i++) p = townStep(p, dx, dy, 0.05);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(TOWN.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(TOWN.height);
    }
    const step = townStep(TOWN.spawn, 3, 0, 0.1);
    expect(step.x - TOWN.spawn.x).toBeCloseTo(TOWN.speed * 0.1, 0);
  });

  it("ignores bad input and rate-limits emotes", () => {
    const world = new TownWorld();
    world.join("me", "acct", profile("Me"));
    expect(world.input("me", Number.NaN, "fast")).toBe(true);
    world.step(0.05, 0);
    expect(world.view("me")!.state.walkers[0][4]).toBe(0);
    expect(world.emote("me", "heart", 5000)).toBe(true);
    expect(world.emote("me", "heart", 5400)).toBe(false);
    expect(world.emote("me", "dance-on-tables", 7000)).toBe(false);
    expect(world.view("me")!.state.walkers[0][5]).toBe(2);
    world.step(0.05, 5000 + TOWN.emoteMs);
    expect(world.view("me")!.state.walkers[0][5]).toBe(0);
  });

  it("lets you hop, at most once per jumpEveryMs, and shows it to viewers", () => {
    const world = new TownWorld();
    world.join("me", "acct", profile("Me"));
    world.step(0.05, 1000);
    expect(world.jump("me", 1000)).toBe(true);
    expect(world.jump("me", 1000 + TOWN.jumpEveryMs - 1)).toBe(false);
    world.step(0.05, 1100);
    expect(world.view("me")!.state.walkers[0][6]).toBe(1);
    world.step(0.05, 1000 + TOWN.jumpMs + 1);
    expect(world.view("me")!.state.walkers[0][6]).toBe(0);
    expect(world.jump("me", 1000 + TOWN.jumpEveryMs)).toBe(true);
    expect(townHop(TOWN.jumpMs / 2)).toBeGreaterThan(30);
    expect(townHop(TOWN.jumpMs)).toBe(0);
  });

  it("shows only nearby walkers in your own town, and each profile once", () => {
    const world = new TownWorld();
    const near = world.join("near", "a1", profile("Near"));
    const far = world.join("far", "a2", profile("Far"));
    const me = world.join("me", "a3", profile("Me"));
    Object.assign(me, townCollide(200, 200));
    Object.assign(near, townCollide(320, 260));
    Object.assign(far, townCollide(1550, 860));
    const first = world.view("me")!;
    const ids = first.state.walkers.map((w) => w[0]);
    expect(ids).toContain(near.profile.id);
    expect(ids).not.toContain(far.profile.id);
    expect(first.profiles.map((p) => p.name).sort()).toEqual(["Me", "Near"]);
    expect(first.profiles.find(p => p.id === near.profile.id)?.accountId).toBe("a1");
    expect(world.view("me")!.profiles).toEqual([]);
    world.updateProfile("near", { level: 12 });
    expect(world.view("me")!.profiles.map((p) => p.level)).toEqual([12]);
  });

  it("can walk from the spawn to every station", () => {
    // Flood-fill a 16 px grid of standable points from the spawn.
    const cell = 16,
      cols = Math.ceil(TOWN.width / cell),
      rows = Math.ceil(TOWN.height / cell);
    const free = (c: number, r: number) => {
      const x = c * cell,
        y = r * cell,
        p = townCollide(x, y);
      return Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5;
    };
    const seen = new Uint8Array(cols * rows);
    const start = [Math.round(TOWN.spawn.x / cell), Math.round(TOWN.spawn.y / cell)];
    expect(free(start[0], start[1])).toBe(true);
    const queue = [start];
    seen[start[1] * cols + start[0]] = 1;
    while (queue.length) {
      const [c, r] = queue.pop()!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc,
          nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || seen[nr * cols + nc] || !free(nc, nr)) continue;
        seen[nr * cols + nc] = 1;
        queue.push([nc, nr]);
      }
    }
    for (const s of TOWN_SPOTS) {
      // Some reachable cell lies within the station's reach.
      let ok = false;
      for (let r = 0; r < rows && !ok; r++)
        for (let c = 0; c < cols && !ok; c++)
          if (seen[r * cols + c] && Math.hypot(c * cell - s.x, r * cell - (s.y + 10)) < s.reach - 8) ok = true;
      expect(ok, `${s.label} is reachable`).toBe(true);
    }
    expect(TOWN_TREES.length).toBeGreaterThan(60);
  });
});
