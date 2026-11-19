import { describe, expect, it } from "vitest";
import { stepLadder, type Ladder } from "../../apps/client/src/bot-ladder";

const at = (level: Ladder["level"], streak = 0): Ladder => ({ level, streak });

describe("Quick Match's sparring bot level", () => {
  it("two wins in a row move it up, two losses move it down", () => {
    let l = at("easy");
    l = stepLadder(l, "easy", true);
    expect(l).toEqual(at("easy", 1));
    l = stepLadder(l, "easy", true);
    expect(l).toEqual(at("normal"));
    l = stepLadder(stepLadder(l, "normal", false), "normal", false);
    expect(l).toEqual(at("easy"));
  });

  it("a loss breaks a win streak, and it never leaves Easy to Hard", () => {
    expect(stepLadder(at("normal", 1), "normal", false)).toEqual(
      at("normal", -1),
    );
    expect(stepLadder(at("easy", -1), "easy", false)).toEqual(at("easy", -2));
    expect(stepLadder(at("hard", 1), "hard", true)).toEqual(at("hard", 2));
  });

  it("a harder bot beaten by choice moves it there; anything else at another level doesn't count", () => {
    expect(stepLadder(at("easy", 1), "hard", true)).toEqual(at("hard"));
    expect(stepLadder(at("normal", 1), "easy", true)).toEqual(at("normal", 1));
    expect(stepLadder(at("easy", 1), "hard", false)).toEqual(at("easy", 1));
  });
});
