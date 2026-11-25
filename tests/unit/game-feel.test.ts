import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buzz,
  hitFeel,
  hitStrength,
  rumble,
  setNativeTap,
  setVibration,
  vibrationOn,
} from "../../apps/client/src/game-feel";

describe("hit feel", () => {
  it("grades hits by damage, and any knockout is critical", () => {
    expect(hitStrength(5)).toBe("weak");
    expect(hitStrength(12)).toBe("strong");
    expect(hitStrength(30)).toBe("critical");
    expect(hitStrength(3, true)).toBe("critical");
  });
  it("freezes longer and shakes harder for bigger hits (typical 50-120 ms stops)", () => {
    const strong = hitFeel("strong", "victim"),
      crit = hitFeel("critical", "victim");
    expect(hitFeel("weak", "victim").stopMs).toBe(0);
    expect(strong.stopMs).toBeGreaterThanOrEqual(50);
    expect(crit.stopMs).toBeGreaterThan(strong.stopMs);
    expect(crit.stopMs).toBeLessThanOrEqual(150);
    expect(crit.shake).toBeGreaterThan(strong.shake);
  });
  it("shakes the victim most, the attacker less, and never a spectator", () => {
    const v = hitFeel("critical", "victim"),
      a = hitFeel("critical", "attacker"),
      s = hitFeel("critical", "spectator");
    expect(a.shake).toBeLessThan(v.shake);
    expect(s.shake).toBe(0);
    expect(s.rumbleMs).toBe(0);
    expect(s.stopMs).toBe(v.stopMs); // everyone sees the impact freeze
  });
  it("turns off freeze and shake for reduced motion but keeps the flash", () => {
    const r = hitFeel("critical", "victim", true);
    expect([r.stopMs, r.shakeMs, r.shake]).toEqual([0, 0, 0]);
    expect(r.flashMs).toBeGreaterThan(0);
  });
});

it("never freezes a live match for any participant, while keeping hit confirmation", () => {
  for (const strength of ["weak", "strong", "critical"] as const)
    for (const role of ["victim", "attacker", "spectator"] as const) {
      const feel = hitFeel(strength, role, false, true);
      expect(feel.stopMs).toBe(0);
      expect(feel.flashMs).toBeGreaterThan(0);
      expect(feel.shakeMs).toBeLessThanOrEqual(80);
      expect(feel.shake).toBeLessThanOrEqual(0.0025);
    }
  expect(hitFeel("critical", "victim", true, true).shake).toBe(0);
});

describe("rumble", () => {
  afterEach(() => {
    setNativeTap(null);
    vi.unstubAllGlobals();
  });
  const phone = () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate, getGamepads: () => [] });
    return vibrate;
  };
  it("vibrates the phone in a browser (Android)", () => {
    const vibrate = phone();
    rumble(100, 0.5);
    expect(vibrate).toHaveBeenCalledWith(60);
  });
  it("taps the iPhone app's haptics instead, with the hit's strength", () => {
    const vibrate = phone();
    const tap = vi.fn();
    setNativeTap(tap);
    rumble(100, 0.8);
    expect(tap).toHaveBeenCalledWith(0.8);
    expect(vibrate).not.toHaveBeenCalled();
  });
  it("does nothing for a hit with no rumble", () => {
    phone();
    const tap = vi.fn();
    setNativeTap(tap);
    rumble(0, 0.8);
    rumble(100, 0);
    expect(tap).not.toHaveBeenCalled();
  });
});

describe("Settings → Vibration", () => {
  afterEach(() => {
    setNativeTap(null);
    vi.unstubAllGlobals();
  });
  const device = () => {
    const vibrate = vi.fn();
    const store = new Map<string, string>();
    vi.stubGlobal("navigator", { vibrate, getGamepads: () => [] });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    return { vibrate, store };
  };
  it("is on by default", () => {
    device();
    expect(vibrationOn()).toBe(true);
  });
  it("off: no phone buzz, no app haptics, no Plaza buzz; and it stops one going", () => {
    const { vibrate, store } = device();
    const tap = vi.fn();
    setNativeTap(tap);
    setVibration(false);
    expect(store.get("arena-vibration")).toBe("off");
    expect(vibrate).toHaveBeenCalledWith(0);
    vibrate.mockClear();
    rumble(140, 0.9);
    buzz([30, 40, 30]);
    expect(tap).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });
  it("back on: hits buzz again", () => {
    const { vibrate, store } = device();
    setVibration(false);
    setVibration(true);
    expect(store.has("arena-vibration")).toBe(false);
    rumble(100, 0.5);
    buzz(18);
    expect(vibrate).toHaveBeenCalledWith(60);
    expect(vibrate).toHaveBeenCalledWith(18);
  });
  it("stays on when storage can't be read (private mode)", () => {
    vi.stubGlobal("navigator", { vibrate: vi.fn(), getGamepads: () => [] });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(vibrationOn()).toBe(true);
  });
});
