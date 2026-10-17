import { expect, it } from "vitest";
import {
  MUSIC_LOOP_STEPS,
  scoreStep,
  type MusicTheme,
} from "../../apps/client/src/music-score";
import { noteHz } from "../../apps/client/src/audio";
it("provides distinct complete original scores with valid pitches and envelopes", () => {
  const scores = (["lobby", "pvp", "raid"] as MusicTheme[]).map((theme) =>
    Array.from({ length: MUSIC_LOOP_STEPS }, (_, s) =>
      scoreStep(theme, s),
    ).flat(),
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
      .filter((n) =>
        ["concert-bass", "concert-snare", "timpani"].includes(n.instrument),
      ).length;
  expect(count(3)).toBeGreaterThan(count(2));
  expect(count(2)).toBeGreaterThan(count(1));
});

it("plays a longer arrangement with a quieter breakdown and a return to the groove", () => {
  for (const theme of ["lobby", "pvp", "raid"] as MusicTheme[]) {
    const density = (bar: number) =>
      Array.from({ length: 64 }, (_, s) =>
        scoreStep(theme, bar * 16 + s),
      ).flat().length;
    expect(density(24)).toBeGreaterThan(density(16));
    expect(scoreStep(theme, MUSIC_LOOP_STEPS)).toEqual(scoreStep(theme, 0));
    expect(
      Array.from({ length: 128 }, (_, s) => scoreStep(theme, s)),
    ).not.toEqual(
      Array.from({ length: 128 }, (_, s) => scoreStep(theme, s + 128)),
    );
  }
});

it("composes distinct victory, defeat and draw endings that resolve without looping", async () => {
  const { RESULT_MUSIC_STEPS } =
    await import("../../apps/client/src/music-score");
  const endings = [];
  for (const theme of ["victory", "defeat", "draw"] as const) {
    const notes = Array.from({ length: RESULT_MUSIC_STEPS[theme] }, (_, s) =>
      scoreStep(theme, s),
    ).flat();
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(n.duration).toBeGreaterThan(0);
      expect(n.volume).toBeGreaterThan(0);
      if (n.note) expect(noteHz(n.note)).toBeGreaterThan(0);
    }
    expect(scoreStep(theme, RESULT_MUSIC_STEPS[theme])).toEqual([]);
    expect(scoreStep(theme, MUSIC_LOOP_STEPS)).toEqual([]);
    endings.push(notes);
  }
  expect(endings[0]).not.toEqual(endings[1]);
  expect(endings[1]).not.toEqual(endings[2]);
});
