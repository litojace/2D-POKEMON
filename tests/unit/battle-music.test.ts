import { expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { RaidArena } from "../../apps/server/src/raid";
import { battleMusic } from "../../apps/client/src/battle-music";

function match(mode: "duel" | "teams" | "ffa" = "duel") {
  const a = new Arena("MUSIC", mode);
  for (let i = 0; i < (mode === "duel" ? 2 : 4); i++)
    a.add("p" + i, "Player " + i);
  a.start();
  a.phase = "finished";
  a.winner = "p0";
  a.winnerTeam = 0;
  return a.snapshot();
}
it("chooses each player's win or loss in duel and free-for-all", () => {
  for (const mode of ["duel", "ffa"] as const) {
    const s = match(mode);
    expect(battleMusic(s, "p0")).toBe("victory");
    expect(battleMusic(s, "p1")).toBe("defeat");
  }
});
it("celebrates with every winning teammate, including a knocked-out player", () => {
  const s = match("teams");
  s.players.forEach((p, i) => {
    p.team = (i % 2) as 0 | 1;
  });
  s.players[2].hp = 0;
  expect(battleMusic(s, "p2")).toBe("victory");
  expect(battleMusic(s, "p3")).toBe("defeat");
  s.winnerTeam = null;
  expect(battleMusic(s, "p2")).toBe("draw");
});
it("uses the raid's shared result, even when another raider is named as winner", () => {
  const a = new RaidArena("RAID");
  a.add("p0", "Host");
  a.add("p1", "Friend");
  a.start();
  a.phase = "finished";
  a.winner = "p0";
  a.raid.result = "victory";
  expect(battleMusic(a.snapshot(), "p1")).toBe("victory");
  a.raid.result = "defeat";
  expect(battleMusic(a.snapshot(), "p1")).toBe("defeat");
  a.raid.drill = "slam";
  expect(battleMusic(a.snapshot(), "p1")).toBe("raid");
});
it("keeps rounds and training on battle music, and gives draws and spectators a neutral ending", () => {
  const s = match();
  s.winner = null;
  expect(battleMusic(s, "p0")).toBe("draw");
  s.winner = "p0";
  expect(battleMusic(s, "")).toBe("draw");
  s.phase = "intermission";
  expect(battleMusic(s, "p0")).toBe("pvp");
  s.phase = "playing";
  s.players[1].hp = 0;
  expect(battleMusic(s, "p1")).toBe("pvp");
  s.phase = "finished";
  s.practice = { unlimitedCooldowns: false, targetAttacks: false };
  expect(battleMusic(s, "p0")).toBe("pvp");
});
