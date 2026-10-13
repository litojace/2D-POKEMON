import { describe, expect, it } from "vitest";
import { OBSTACLES, blankInput } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
import {
  BOT_PROFILES,
  BotBrain,
  waypoint,
  type BotDifficulty,
} from "../../apps/server/src/bot";
type Id = Parameters<Arena["add"]>[2];
function botVsBot(
  a: BotDifficulty,
  b: BotDifficulty,
  ca: Id,
  cb: Id,
  seed: number,
) {
  const arena = new Arena("test");
  arena.add("A", "A", ca);
  arena.add("B", "B", cb);
  arena.bots.set("A", new BotBrain("A", a, seed));
  arena.bots.set("B", new BotBrain("B", b, seed * 7 + 3));
  arena.start();
  // Bots acknowledge the briefing themselves.
  expect(arena.instructionsReady.sort()).toEqual(["A", "B"]);
  // Any confirmation then finds everyone ready and starts the countdown.
  expect(arena.acknowledgeInstructions("A")).toBe(true);
  expect(arena.phase).toBe("countdown");
  for (let i = 0; i < 30 * 60 * 10 && arena.phase !== "finished"; i++)
    arena.tick();
  return arena;
}
describe("AI bot", () => {
  it("plays a whole match to a result", () => {
    const arena = botVsBot("normal", "normal", "voltkit", "duskveil", 3);
    expect(arena.phase).toBe("finished");
    expect(arena.winner).not.toBeNull();
    for (const p of arena.players) {
      expect(p.stats.dealt).toBeGreaterThan(0);
      expect(p.stats.skills).toBeGreaterThan(0);
    }
  });
  it("is deterministic for a seed (replays exactly)", () => {
    const one = botVsBot("hard", "easy", "lumoth", "tidefin", 9),
      two = botVsBot("hard", "easy", "lumoth", "tidefin", 9);
    expect(one.time).toBe(two.time);
    expect(one.winner).toBe(two.winner);
    expect(one.players.map((p) => p.stats)).toEqual(
      two.players.map((p) => p.stats),
    );
  });
  it("gets stronger with difficulty", () => {
    const fighters: Id[] = [
      "voltkit",
      "tidefin",
      "lumoth",
      "mystowl",
      "duskveil",
      "cindrake",
    ];
    let hardWins = 0,
      normalWins = 0;
    fighters.forEach((f, i) => {
      const g = fighters[(i + 2) % fighters.length];
      if (botVsBot("hard", "easy", f, g, 20 + i).winner === "A") hardWins++;
      if (botVsBot("easy", "normal", f, g, 40 + i).winner === "B") normalWins++;
    });
    expect(hardWins).toBeGreaterThanOrEqual(5);
    expect(normalWins).toBeGreaterThanOrEqual(5);
    expect(BOT_PROFILES.easy.reaction).toBeGreaterThan(
      BOT_PROFILES.hard.reaction,
    );
  });
  it("hunts down and beats a player who stands still", () => {
    const arena = new Arena("still");
    arena.add("H", "H", "voltkit");
    arena.add("B", "B", "auralynx");
    arena.bots.set("B", new BotBrain("B", "hard", 5));
    arena.start();
    arena.acknowledgeInstructions("H");
    for (let i = 0; i < 30 * 120 && arena.phase !== "finished"; i++) {
      const [h, b] = arena.players;
      if (arena.phase === "playing")
        h.lastInput = { ...blankInput(), aimX: b.x, aimY: b.y };
      arena.tick();
    }
    expect(arena.winner).toBe("B");
  });
  it("only sends inputs a client could send", () => {
    const arena = new Arena("valid");
    arena.add("H", "H", "terradon");
    arena.add("B", "B", "mystowl");
    const brain = new BotBrain("B", "hard", 2);
    arena.start();
    arena.phase = "playing";
    arena.deadline = arena.time + 100;
    for (let i = 0; i < 300; i++) {
      const input = brain.think(arena, arena.players[1]);
      expect(Math.abs(input.dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(input.dy)).toBeLessThanOrEqual(1);
      expect(input.aimX).toBeGreaterThanOrEqual(0);
      expect(input.aimX).toBeLessThanOrEqual(1600);
      expect(input.aimY).toBeGreaterThanOrEqual(0);
      expect(input.aimY).toBeLessThanOrEqual(900);
      expect(input.skill).toBeGreaterThanOrEqual(-1);
      expect(input.skill).toBeLessThanOrEqual(3);
      arena.players[1].lastInput = input;
      arena.tick();
    }
  });
  it("walks around pillars instead of into them", () => {
    const o = OBSTACLES[4];
    const clear = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      new Arena("w").lineClear(a, b);
    const from = { x: o.x - 80, y: o.y + o.h / 2 },
      goal = { x: o.x + o.w + 80, y: o.y + o.h / 2 };
    const via = waypoint(clear, from, goal)!;
    expect(via).not.toBeNull();
    expect(clear(from, via)).toBe(true);
    expect(clear(via, goal)).toBe(true);
    expect(waypoint(clear, { x: 200, y: 450 }, { x: 300, y: 450 })).toBeNull();
  });
});
