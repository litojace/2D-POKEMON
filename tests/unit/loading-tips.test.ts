import { describe, expect, it } from "vitest";
import { ORB_SPOTS, RITE_RULES, RULES } from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
import {
  LOADING_TIPS,
  tipMarkup,
  tipReadMs,
} from "../../apps/client/src/loading-tips";

// The startup curtain's tips state facts about the game. Each is checked
// here against the server's own simulation, so a rule change that makes a
// tip wrong fails this test instead of misleading players.
const tick = (a: Arena, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * RULES.tick); i++) a.tick();
};
const [TOP, BOTTOM] = ORB_SPOTS;
function playing(mode?: "teams") {
  const a = mode ? new Arena("TIPS", mode) : new Arena("TIPS");
  const ids = mode ? ["a", "b", "c", "d"] : ["a", "b"];
  ids.forEach((id) => a.add(id, id, "voltkit"));
  a.start();
  for (const p of a.players) a.acknowledgeInstructions(p.id);
  tick(a, RULES.countdown + 0.05);
  expect(a.phase).toBe("playing");
  return a;
}
const tip = (id: string) => LOADING_TIPS.find((t) => t.id === id)!.text;
const orbsAt = (a: Arena) =>
  a.orbs.map((o) => ({ x: o.x, y: o.y, kind: o.kind }));

describe("loading tips", () => {
  it("1v1: healing on top at the stated second, energy at the bottom in between", () => {
    expect(TOP.y).toBeLessThan(BOTTOM.y);
    expect(TOP.x).toBe(800);
    expect(BOTTOM.x).toBe(800);
    const text = tip("duel-orbs");
    expect(text).toContain(`${RULES.orbFirst} s into each round`);
    expect(text).toContain(`every ${RULES.orbInterval * 2} s`);
    for (let round = 0; round < 2; round++) {
      const a = playing();
      if (round) {
        // A new round starts the orbs over: still healing on top first.
        a.endRound(0);
        // Between rounds each side picks a rite (or runs out of time).
        tick(a, Math.max(RULES.intermission, RITE_RULES.seconds) + 0.1);
        tick(a, RULES.countdown + 0.1);
        expect(a.phase).toBe("playing");
      }
      tick(a, RULES.orbFirst - 0.2);
      expect(a.orbs).toHaveLength(0);
      tick(a, 0.3);
      expect(orbsAt(a)).toEqual([{ x: TOP.x, y: TOP.y, kind: "heal" }]);
      tick(a, RULES.orbInterval);
      expect(orbsAt(a)).toEqual([
        { x: TOP.x, y: TOP.y, kind: "heal" },
        { x: BOTTOM.x, y: BOTTOM.y, kind: "energy" },
      ]);
      // The top orb taken, the next one on top heals again, 36 s after the first.
      a.orbs = a.orbs.filter((o) => o.y !== TOP.y);
      tick(a, RULES.orbInterval);
      expect(orbsAt(a)).toContainEqual({ x: TOP.x, y: TOP.y, kind: "heal" });
    }
  });
  it("2v2: one orb at each spot together, kinds taking turns", () => {
    const a = playing("teams");
    tick(a, RULES.orbFirst + 0.1);
    expect(orbsAt(a)).toEqual([
      { x: TOP.x, y: TOP.y, kind: "heal" },
      { x: BOTTOM.x, y: BOTTOM.y, kind: "heal" },
    ]);
    a.orbs = [];
    tick(a, RULES.orbInterval);
    expect(orbsAt(a).map((o) => o.kind)).toEqual(["energy", "energy"]);
    expect(tip("team-orbs")).toContain(`every ${RULES.orbInterval} s`);
  });
  it("orb values, and full fighters walk through", () => {
    const a = playing();
    tick(a, RULES.orbFirst + 0.1);
    const [p] = a.players;
    const full = p.hp;
    Object.assign(p, { x: TOP.x, y: TOP.y });
    a.tick();
    expect(a.orbs).toHaveLength(1); // full health: left for later
    p.hp = full / 2;
    a.tick();
    expect(a.orbs).toHaveLength(0);
    expect(p.hp).toBeCloseTo(full / 2 + full * RULES.orbHeal, 0);
    expect(tip("orb-values")).toContain(
      `${Math.round(RULES.orbHeal * 100)}% of your health`,
    );
    expect(tip("orb-values")).toContain(`adds ${RULES.orbEnergy} charge`);
  });
  it("states the other rules with the server's numbers", () => {
    expect(tip("basic-cooldowns")).toContain(`${RULES.basicHitCooldownCut} s`);
    expect(tip("comeback")).toContain(`${RULES.ultComeback} extra`);
    expect(tip("best-of")).toContain(`win ${RULES.roundsToWin} rounds`);
    expect(tip("ult-charge")).toContain(
      `${(RULES.ultPerDamageDealt / RULES.ultPerDamageTaken).toFixed(1)}×`,
    );
  });
  it("each tip has time to be read, and is safe markup", () => {
    for (const t of LOADING_TIPS) {
      const ms = tipReadMs(t);
      expect(ms).toBeGreaterThanOrEqual(3000);
      expect(ms).toBeLessThanOrEqual(7000);
      // Short enough to read in that time at about four words a second.
      expect(t.text.split(/\s+/).length).toBeLessThanOrEqual(30);
      expect(tipMarkup(t)).not.toMatch(/<script|on\w+=/i);
    }
    expect(new Set(LOADING_TIPS.map((t) => t.id)).size).toBe(
      LOADING_TIPS.length,
    );
  });
});
