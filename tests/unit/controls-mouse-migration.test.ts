import { expect, it } from "vitest";
import { DEFAULT_BINDINGS, parsePrefs } from "../../apps/client/src/controls";

// The mouse-movement option was removed: anyone who had picked it (its keys
// were 1-5 with no left-button attack) gets the default keys back.
it("players who chose the removed mouse movement get the default keys back", () => {
  const saved = {
    move: "mouse",
    cast: "instant",
    aimAssist: true,
    bindings: { ...DEFAULT_BINDINGS, basic: ["Digit1", null], skill1: ["Digit2", "KeyQ"] },
  };
  const prefs = parsePrefs(JSON.parse(JSON.stringify(saved)));
  expect(prefs.bindings).toEqual(DEFAULT_BINDINGS);
  expect(prefs.bindings.basic[0]).toBe("Mouse0");
  // Their other choices stay.
  expect(prefs.cast).toBe("instant");
  expect(prefs.aimAssist).toBe(true);
  expect("move" in prefs).toBe(false);
});
it("custom keys from the keyboard scheme are kept as before", () => {
  const prefs = parsePrefs({ bindings: { ...DEFAULT_BINDINGS, skill1: ["KeyZ", null] } });
  expect(prefs.bindings.skill1).toEqual(["KeyZ", null]);
});
