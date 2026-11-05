import { describe, expect, it } from "vitest";
import { RULES, type CharacterId } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
import { BotBrain } from "../../apps/server/src/bot";

const CHAMPS: CharacterId[] = ["voltkit", "tidefin", "cindrake", "lumoth"];
/** A free-for-all mid-round, everyone placed by hand (open ground, y = 840). */
function ffa(spots: number[]) {
  const a = new Arena("T", "ffa");
  spots.forEach((_, i) => a.add(`p${i}`, `P${i}`, CHAMPS[i]));
  a.start();
  a.phase = "playing";
  a.deadline = 999;
  a.players.forEach((p, i) =>
    Object.assign(p, { x: spots[i], y: 840, vx: 0, vy: 0 }),
  );
  return a;
}
const targetOf = (brain: BotBrain) =>
  (brain as unknown as { targetId?: string }).targetId;

describe("bot targeting", () => {
  it("fights the nearest opponent, not the first to join", () => {
    // p3 thinks: p0 (first in join order) is far left, p2 is right next to it.
    const a = ffa([150, 600, 1180, 1300]);
    const brain = new BotBrain("p3", "hard", 5);
    const input = brain.think(a, a.players[3]);
    expect(targetOf(brain)).toBe("p2");
    expect(input.aimX).toBeLessThan(a.players[3].x);
    expect(input.aimX).toBeGreaterThan(900);
  });

  it("prefers a hurt opponent at a similar distance", () => {
    const a = ffa([500, 800, 1100, 1400]);
    // p1 is as far from p2 as p3 is, but nearly knocked out.
    a.players[1].hp = 10;
    const brain = new BotBrain("p2", "hard", 5);
    brain.think(a, a.players[2]);
    expect(targetOf(brain)).toBe("p1");
  });

  it("stays on its target between decisions and when another is only a bit closer", () => {
    const a = ffa([150, 600, 1000, 1300]);
    const brain = new BotBrain("p3", "hard", 5);
    brain.think(a, a.players[3]);
    expect(targetOf(brain)).toBe("p2");
    // p1 walks up to just inside p2's distance: not worth switching for.
    a.players[1].x = 1020;
    a.players[2].x = 1000;
    for (let i = 0; i < 3 * RULES.tick; i++) {
      a.time += 1 / RULES.tick;
      brain.think(a, a.players[3]);
    }
    expect(targetOf(brain)).toBe("p2");
    // Once p2 is knocked out it moves on.
    a.players[2].hp = 0;
    brain.think(a, a.players[3]);
    expect(targetOf(brain)).toBe("p1");
  });

  it("no longer hands free-for-alls to whoever joined last", () => {
    // Seeded bot free-for-alls: before the fix seat 0 never won (everyone
    // went for the first fighter to join) and the last seat won ~60-78%.
    const wins = [0, 0, 0, 0];
    for (let m = 0; m < 8; m++) {
      const a = new Arena(`F${m}`, "ffa");
      for (let i = 0; i < 4; i++) {
        a.add(`p${i}`, `P${i}`, CHAMPS[(i + m) % 4]);
        a.bots.set(`p${i}`, new BotBrain(`p${i}`, "hard", 100 + m * 4 + i));
      }
      a.start();
      a.acknowledgeInstructions("p0");
      for (let t = 0; t < 30 * 60 * 12 && a.phase !== "finished"; t++) a.tick();
      expect(a.phase).toBe("finished");
      wins[a.winnerTeam!]++;
    }
    expect(wins[0] + wins[1]).toBeGreaterThan(0);
    expect(wins[3]).toBeLessThan(8);
    // Eight whole bot matches: allow for a busy machine.
  }, 60_000);
});
