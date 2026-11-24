import { describe, expect, it } from "vitest";
import { CastPredictor, canBasic, canCastSkill, canDash } from "../../apps/client/src/cast-prediction";
import { pingLevel, smoothPing } from "../../apps/client/src/ping-badge";
import { RULES, type Fighter } from "../../packages/shared/src/index";

const fighter = (over: Partial<Fighter> = {}) =>
  ({
    hp: 100,
    out: false,
    charge: undefined,
    recoveryUntil: 0,
    statuses: [],
    cooldowns: [0, 0, 0, 0],
    ult: 0,
    basicAt: 0,
    dashAt: 0,
    ...over,
  }) as unknown as Fighter;

describe("which casts the client may show at once (same rules as the server)", () => {
  it("a ready skill casts; one cooling, recovering, charging or stunned does not", () => {
    expect(canCastSkill(fighter(), 0, 5)).toBe(true);
    expect(canCastSkill(fighter({ cooldowns: [9, 0, 0, 0] }), 0, 5)).toBe(false);
    expect(canCastSkill(fighter({ recoveryUntil: 5.2 }), 0, 5)).toBe(false);
    expect(canCastSkill(fighter({ charge: { at: 6, skill: 1, ex: false } } as Partial<Fighter>), 0, 5)).toBe(false);
    expect(canCastSkill(fighter({ statuses: [{ kind: "stun", until: 6 }] } as Partial<Fighter>), 0, 5)).toBe(false);
    // An expired status no longer blocks.
    expect(canCastSkill(fighter({ statuses: [{ kind: "stun", until: 4 }] } as Partial<Fighter>), 0, 5)).toBe(true);
    expect(canCastSkill(fighter({ hp: 0 }), 0, 5)).toBe(false);
  });
  it("the ultimate needs a full meter (or free cooldowns in practice)", () => {
    expect(canCastSkill(fighter({ ult: RULES.ultMax - 1 }), 3, 5)).toBe(false);
    expect(canCastSkill(fighter({ ult: RULES.ultMax }), 3, 5)).toBe(true);
    expect(canCastSkill(fighter({ ult: 0 }), 3, 5, true)).toBe(true);
  });
  it("basic follows its interval; dash ignores recovery but not a stun", () => {
    expect(canBasic(fighter({ basicAt: 5.1 }), 5)).toBe(false);
    expect(canBasic(fighter({ basicAt: 4.9 }), 5)).toBe(true);
    expect(canDash(fighter({ recoveryUntil: 9 }), 5)).toBe(true);
    expect(canDash(fighter({ dashAt: 6 }), 5)).toBe(false);
    expect(canDash(fighter({ statuses: [{ kind: "freeze", until: 9 }] } as Partial<Fighter>), 5)).toBe(false);
  });
});

describe("a predicted cast and the server's echo", () => {
  it("the echo within the window is not replayed; a late one is", () => {
    const p = new CastPredictor();
    p.rtt = 100; // window = 350 ms
    p.predict("skill1", 1000);
    expect(p.waiting("skill1", 1200)).toBe(true);
    expect(p.confirm("skill1", 1200)).toBe(true);
    expect(p.waiting("skill1", 1210)).toBe(false);
    p.predict("basic", 2000);
    expect(p.confirm("basic", 2400)).toBe(false);
    // Nothing was predicted: the echo plays.
    expect(p.confirm("skill2", 3000)).toBe(false);
  });
  it("a prediction the server never confirms expires once", () => {
    const p = new CastPredictor();
    p.rtt = 100;
    p.predict("skill0", 0);
    expect(p.expired(300)).toEqual([]);
    expect(p.expired(400)).toEqual(["skill0"]);
    expect(p.expired(500)).toEqual([]);
  });
  it("the window follows the round trip, within bounds", () => {
    const p = new CastPredictor();
    p.rtt = 10;
    p.predict("skill0", 0);
    expect(p.waiting("skill0", 299)).toBe(true); // at least 300 ms
    p.rtt = 5000;
    p.predict("skill0", 0);
    expect(p.waiting("skill0", 1199)).toBe(true); // at most 1200 ms
    expect(p.waiting("skill0", 1201)).toBe(false);
  });
});

describe("ping badge", () => {
  it("colours by round trip and smooths samples", () => {
    expect(pingLevel(40)).toBe("good");
    expect(pingLevel(100)).toBe("fair");
    expect(pingLevel(200)).toBe("poor");
    expect(smoothPing(undefined, 50)).toBe(50);
    expect(smoothPing(50, 150)).toBeCloseTo(80, 5);
  });
});
