import { describe, expect, it } from "vitest";
import { hitFeel, hitStrength } from "../../apps/client/src/game-feel";

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
