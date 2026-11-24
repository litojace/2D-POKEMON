import { describe, expect, it } from "vitest";
import { FIGHTER_IDS } from "@arena/shared";
import {
  CHAMPION_QUIPS,
  COMMON_QUIPS,
  POKED_QUIPS,
  QUIP_MAX_LENGTH,
  QUIP_MOVE_MS,
  pickQuip,
} from "../../apps/client/src/lobby-quips";

const all = [
  ...COMMON_QUIPS,
  ...POKED_QUIPS,
  ...Object.values(CHAMPION_QUIPS).flat(),
];

describe("Lobby fighter lines", () => {
  it("every champion has its own lines", () => {
    for (const id of FIGHTER_IDS)
      expect(CHAMPION_QUIPS[id]?.length ?? 0, id).toBeGreaterThanOrEqual(6);
  });
  it("every line is short, plain English and has a move", () => {
    for (const quip of all) {
      expect(quip.text.length, quip.text).toBeLessThanOrEqual(QUIP_MAX_LENGTH);
      expect(quip.text, quip.text).toMatch(/^[\x20-\x7e’…—]+$/);
      expect(QUIP_MOVE_MS[quip.move], quip.text).toBeGreaterThan(0);
    }
  });
  it("no line is said twice in the pools", () => {
    const texts = all.map((q) => q.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
  it("never says the same line twice in a row", () => {
    for (const id of FIGHTER_IDS) {
      let last: string | undefined;
      for (let i = 0; i < 200; i++) {
        const quip = pickQuip(id, last, i % 7 === 0);
        expect(quip.text).not.toBe(last);
        last = quip.text;
      }
    }
  });
  it("answers a poke from the poked lines, else its own or the shared", () => {
    const poked = pickQuip("voltkit", undefined, true, () => 0.5);
    expect(POKED_QUIPS).toContain(poked);
    expect(CHAMPION_QUIPS.voltkit).toContain(
      pickQuip("voltkit", undefined, false, () => 0.1),
    );
    expect(COMMON_QUIPS).toContain(
      pickQuip("voltkit", undefined, false, () => 0.9),
    );
  });
});
