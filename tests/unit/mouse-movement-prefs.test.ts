import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, MOUSE_BINDINGS, parsePrefs, withMoveMode } from "../../apps/client/src/controls";

describe("Controls → Movement", () => {
  it("defaults to the keyboard and keeps old saved settings on it", () => {
    expect(parsePrefs({}).move).toBe("keys");
    expect(parsePrefs({ cast: "instant" }).move).toBe("keys");
    expect(parsePrefs({ move: "bogus" }).move).toBe("keys");
  });
  it("mouse movement: 1 attacks, 2 3 4 5 cast (Q E R F as backups), right button dashes, left button free", () => {
    const prefs = withMoveMode(DEFAULT_PREFS, "mouse");
    expect(prefs.move).toBe("mouse");
    expect(prefs.bindings.basic[0]).toBe("Digit1");
    expect([prefs.bindings.skill1, prefs.bindings.skill2, prefs.bindings.skill3, prefs.bindings.skill4]).toEqual([
      ["Digit2", "KeyQ"],
      ["Digit3", "KeyE"],
      ["Digit4", "KeyR"],
      ["Digit5", "KeyF"],
    ]);
    expect(prefs.bindings.dash[0]).toBe("Mouse2");
    expect(Object.values(prefs.bindings).flat()).not.toContain("Mouse0");
    // No key is bound twice.
    const codes = Object.values(MOUSE_BINDINGS).flat().filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("survives a save and reload, and switching back restores the keyboard keys", () => {
    const saved = JSON.parse(JSON.stringify(withMoveMode(DEFAULT_PREFS, "mouse")));
    const loaded = parsePrefs(saved);
    expect(loaded.move).toBe("mouse");
    expect(loaded.bindings).toEqual(MOUSE_BINDINGS);
    expect(withMoveMode(loaded, "keys").bindings).toEqual(DEFAULT_PREFS.bindings);
  });
});
