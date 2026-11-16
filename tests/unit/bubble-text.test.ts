import { describe, expect, it } from "vitest";
import { bubbleLines } from "../../apps/client/src/chat/bubble-text";
import { CHAT_CALLS, CHAT_PHRASES } from "../../packages/shared/src/chat";

// Each character 8 px wide (a stand-in for the canvas's measureText).
const measure = (s: string) => [...s].length * 8;

describe("bubbleLines", () => {
  it("keeps a short phrase on one line", () => {
    expect(bubbleLines("Well played!", measure, 160)).toEqual(["Well played!"]);
  });
  it("wraps words so no line is wider than the bubble", () => {
    const lines = bubbleLines(
      "see you at the fountain in a minute",
      measure,
      96,
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(96);
  });
  it("cuts a word too long for any line", () => {
    const lines = bubbleLines("aaaaaaaaaaaaaaaaaaaa", measure, 64);
    expect(lines).toEqual(["aaaaaaaa", "aaaaaaaa", "aaaa"]);
  });
  it("ends with … past the last line, still within the width", () => {
    const lines = bubbleLines(
      "one two three four five six seven eight",
      measure,
      48,
      2,
    );
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(48);
  });
  it("every quick phrase and call fits one line of a Plaza bubble", () => {
    for (const t of [
      ...Object.values(CHAT_PHRASES),
      ...Object.values(CHAT_CALLS),
    ])
      expect(bubbleLines(t, measure, 160)).toEqual([t]);
  });
});
