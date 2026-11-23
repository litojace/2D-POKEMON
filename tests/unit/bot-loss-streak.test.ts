import { describe, expect, it } from "vitest";
import {
  LOSS_STREAK_HINT,
  easierBot,
  stepLosses,
} from "../../apps/client/src/bot-ladder";

describe("losses in a row against bots", () => {
  it("counts losses, a win starts over, a draw changes nothing", () => {
    let l = { streak: 0 };
    l = stepLosses(l, "loss");
    l = stepLosses(l, "loss");
    l = stepLosses(l, "draw");
    expect(l.streak).toBe(2);
    l = stepLosses(l, "loss");
    expect(l.streak).toBe(LOSS_STREAK_HINT);
    expect(stepLosses(l, "win").streak).toBe(0);
  });
  it("offers the level below, none below Easy", () => {
    expect(easierBot("hard")).toBe("normal");
    expect(easierBot("normal")).toBe("easy");
    expect(easierBot("easy")).toBeNull();
  });
});
