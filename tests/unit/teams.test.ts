import { describe, expect, it } from "vitest";
import { CHARACTERS, blankInput, type CharacterId } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
/** A 2v2 arena in play: P0+P2 Blue, P1+P3 Red (join order alternates teams). */
function teams(
  chars: CharacterId[] = ["voltkit", "voltkit", "voltkit", "voltkit"],
) {
  const a = new Arena("TEAMS", "teams");
  chars.forEach((c, i) => a.add(`P${i}`, `P${i}`, c));
  a.start();
  for (const p of a.players) a.acknowledgeInstructions(p.id);
  for (let i = 0; i < 30 * 3 + 2; i++) a.tick();
  expect(a.phase).toBe("playing");
  const [b1, r1, b2, r2] = a.players;
  return { a, b1, r1, b2, r2 };
}
const place = (p: { x: number; y: number }, x: number, y: number) => {
  p.x = x;
  p.y = y;
};
describe("2v2 teams", () => {
  it("fills teams evenly and spawns partners side by side", () => {
    const { a, b1, r1, b2, r2 } = teams();
    expect([b1, b2].map((p) => p.team)).toEqual([0, 0]);
    expect([r1, r2].map((p) => p.team)).toEqual([1, 1]);
    expect(a.size).toBe(4);
    expect(a.roundsToWin).toBe(3);
    a.resetRound();
    expect(b1.x).toBe(b2.x);
    expect(b1.y).not.toBe(b2.y);
    expect(r1.x).toBeGreaterThan(b1.x);
  });
  it("needs all four confirmations before the countdown", () => {
    const a = new Arena("T", "teams");
    ["a", "b", "c", "d"].forEach((id) => a.add(id, id));
    a.start();
    for (const id of ["a", "b", "c"]) a.acknowledgeInstructions(id);
    expect(a.phase).toBe("briefing");
    a.acknowledgeInstructions("d");
    expect(a.phase).toBe("countdown");
  });
  it("never hurts a teammate: melee, nova, beam, zones and projectiles", () => {
    const { a, b1, r1, b2 } = teams([
      "auralynx",
      "terradon",
      "terradon",
      "terradon",
    ]);
    place(b1, 400, 450);
    place(b2, 470, 450); // teammate right in front
    place(r1, 470, 470); // enemy in the same spot
    b1.angle = 0;
    const ally = b2.hp,
      foe = r1.hp;
    a.cast(b1, CHARACTERS.auralynx.basic); // melee
    a.cast(b1, CHARACTERS.auralynx.skills[3]); // nova
    expect(b2.hp).toBe(ally);
    expect(r1.hp).toBeLessThan(foe);
    const m = teams(["mystowl", "terradon", "terradon", "terradon"]);
    place(m.b1, 300, 450);
    place(m.b2, 400, 450);
    place(m.r1, 500, 450);
    m.b1.angle = 0;
    const before = m.r1.hp;
    m.a.cast(m.b1, CHARACTERS.mystowl.skills[0]); // beam passes the ally
    expect(m.b2.hp).toBe(CHARACTERS.terradon.health);
    expect(m.r1.hp).toBeLessThan(before);
    m.b1.lastInput = { ...blankInput(), aimX: 400, aimY: 450 };
    m.a.cast(m.b1, CHARACTERS.mystowl.skills[3]); // zone on the ally
    m.a.cast(m.b1, CHARACTERS.mystowl.basic); // projectile through the ally
    for (let i = 0; i < 60; i++) m.a.tick();
    expect(m.b2.hp).toBe(CHARACTERS.terradon.health);
  });
  it("area attacks hit both enemies", () => {
    const { a, b1, r1, r2 } = teams([
      "lumoth",
      "terradon",
      "voltkit",
      "terradon",
    ]);
    place(b1, 800, 200);
    place(r1, 860, 200);
    place(r2, 800, 260);
    a.cast(b1, CHARACTERS.lumoth.skills[3]); // Radiant Flare nova
    expect(r1.hp).toBeLessThan(CHARACTERS.terradon.health);
    expect(r2.hp).toBeLessThan(CHARACTERS.terradon.health);
  });
  it("a round ends only when a whole team is down; knocked-out fighters sit still", () => {
    const { a, b1, r1, r2 } = teams();
    r1.hp = 0;
    r1.lastInput = { ...blankInput(), dx: 1, basic: true, aimX: 0, aimY: 0 };
    const x = r1.x;
    for (let i = 0; i < 10; i++) a.tick();
    expect(a.phase).toBe("playing");
    expect(r1.x).toBe(x);
    expect(r1.stats.skills).toBe(0);
    r2.hp = 0;
    a.tick();
    expect(a.phase).toBe("intermission");
    expect(a.roundWinnerTeam).toBe(0);
    expect(a.teamScores).toEqual([1, 0]);
    // Both Blue members get the round on the per-player scoreboard.
    expect(a.scores[b1.id]).toBe(1);
  });
  it("is first to three rounds (best of five)", () => {
    const { a } = teams();
    for (let round = 1; round <= 3; round++) {
      expect(a.phase).not.toBe("finished");
      a.endRound(1);
      if (round < 3) expect(a.phase).toBe("intermission");
    }
    expect(a.phase).toBe("finished");
    expect(a.winnerTeam).toBe(1);
  });
  it("breaks a time-out by the share of team health left", () => {
    const { a, b1, b2, r1, r2 } = teams();
    b1.hp = 10;
    b2.hp = 100; // Blue ~50%
    r1.hp = 80;
    r2.hp = 80; // Red ~73%
    void [b2, r2];
    a.deadline = a.time;
    a.tick();
    expect(a.roundWinnerTeam).toBe(1);
  });
  it("credits burn to whoever applied it", () => {
    const { a, b2, r1 } = teams(["voltkit", "voltkit", "cindrake", "voltkit"]);
    a.damage(r1, 1, b2.id, CHARACTERS.cindrake.skills[1]); // Magma Bomb burns
    const burn = r1.statuses.find((s) => s.kind === "burn")!;
    expect(burn.by).toBe(b2.id);
    const dealt = b2.stats.dealt;
    for (let i = 0; i < 30; i++) a.tick();
    expect(b2.stats.dealt).toBeGreaterThan(dealt);
  });
  it("keeps playing 2v1 when a player leaves for good", () => {
    const { a, b1, r1, r2 } = teams();
    Object.assign(r1, { out: true, hp: 0, connected: false });
    a.tick();
    expect(a.phase).toBe("playing");
    expect(a.enemiesOf(b1)).toEqual([r2]);
    r2.hp = 0;
    a.tick();
    expect(a.roundWinnerTeam).toBe(0);
    // Next round the leaver stays out.
    a.resetRound();
    expect(r1.hp).toBe(0);
    expect(r2.hp).toBe(CHARACTERS.voltkit.health);
  });
  it("leaves duels unchanged: two players, Blue vs Red, best of five", () => {
    const a = new Arena("D");
    a.add("x", "x");
    a.add("y", "y");
    expect(a.players.map((p) => p.team)).toEqual([0, 1]);
    expect(a.size).toBe(2);
    expect(a.roundsToWin).toBe(3);
  });
});
