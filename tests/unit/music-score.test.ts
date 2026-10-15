import { expect, it } from "vitest";
import { scoreStep, type MusicTheme } from "../../apps/client/src/music-score";
import { noteHz } from "../../apps/client/src/audio";
it("provides distinct complete original scores with valid pitches and envelopes", () => {
  const scores = (["lobby", "pvp", "raid"] as MusicTheme[]).map((theme) =>
    Array.from({ length: 128 }, (_, s) => scoreStep(theme, s)).flat(),
  );
  for (const score of scores) {
    expect(score.length).toBeGreaterThan(0);
    for (const n of score) {
      expect(n.duration).toBeGreaterThan(0);
      expect(n.volume).toBeGreaterThan(0);
      if (n.note) expect(noteHz(n.note)).toBeGreaterThan(0);
    }
  }
  expect(scores[0]).not.toEqual(scores[1]);
  expect(scores[1]).not.toEqual(scores[2]);
  expect(noteHz("A4")).toBe(440);
});
it("intensifies the final raid phase with additional percussion", () => {
  const count = (phase: number) =>
    Array.from({ length: 16 }, (_, s) => scoreStep("raid", s, phase))
      .flat()
      .filter((n) => ["kick", "tom", "hat"].includes(n.instrument)).length;
  expect(count(3)).toBeGreaterThan(count(2));
  expect(count(2)).toBeGreaterThan(count(1));
});
