import { it, expect } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { shareSummary } from "../../apps/client/src/share-card";

it("words the shared result from the sharer's side", () => {
  const a = new Arena("SHARE");
  a.add("p1", "Ana", "voltkit");
  a.add("p2", "Ben", "tidefin");
  a.start();
  a.scores = { p1: 3, p2: 1 };
  a.teamScores = [3, 1];
  a.winner = "p1";
  a.winnerTeam = 0;
  a.phase = "finished";
  const snap = a.snapshot();
  const ana = shareSummary(snap, "p1");
  expect(ana.won).toBe(true);
  expect(ana.headline).toBe("Victory 3–1");
  expect(ana.text).toContain("won 3–1 against Ben");
  expect(ana.text).toContain("Voltkit");
  const ben = shareSummary(snap, "p2");
  expect(ben.won).toBe(false);
  expect(ben.headline).toBe("Fought hard 1–3");
  expect(ben.text).toContain("Rematch me");
});

it("names both rivals in a 2v2", () => {
  const a = new Arena("SHARE2", "teams");
  ["a", "b", "c", "d"].forEach((id) => a.add(id, id.toUpperCase()));
  a.start();
  a.teamScores = [3, 2];
  a.winnerTeam = 0;
  a.phase = "finished";
  const s = shareSummary(a.snapshot(), "a");
  expect(s.won).toBe(true);
  expect(s.headline).toBe("Victory 3–2");
  expect(s.versus).toBe("B & D");
});
