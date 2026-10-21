import { describe, it, expect } from "vitest";
import {
  createExpedition,
  prepareExpedition,
  enterExpeditionCamp,
  chooseExpeditionCamp,
  advanceExpedition,
  restartExpedition,
  expeditionReceipt,
} from "../../apps/server/src/expedition";
import { CHARACTERS, blankInput } from "@arena/shared";
import type { RaidArena } from "../../apps/server/src/raid";
const setup = (size = 1, day = "2026-10-19") => {
  const a = createExpedition("EXPED", day);
  for (let i = 0; i < size; i++) a.add("p" + i, "Raider " + i, "voltkit");
  a.start();
  prepareExpedition(a);
  a.phase = "playing";
  return a;
};
const win = (a: RaidArena) => {
  a.raid.elapsed = 60;
  a.engaged.add("p0");
  for (const boss of a.players.filter((p) => p.raidBoss))
    a.damage(boss, 1e6, "p0");
  a.tick();
  expect(a.raid.result).toBe("victory");
};
describe("Boss Rush expedition", () => {
  for (const size of [1, 2, 3, 4])
    for (const day of ["2026-10-19", "2026-10-26", "2026-11-02"])
      it(`supports ${size} raiders on route ${day}`, () => {
        const a = setup(size, day);
        expect(a.raid.phase).toBe(3);
        expect(a.raid.peril).toBe(1);
        expect(a.heroes()).toHaveLength(size);
        expect(
          a.players.filter((p) => p.raidBoss).reduce((s, p) => s + p.hp, 0),
        ).toBe(a.raid.maxHp);
        expect(a.raid.expedition!.route).toHaveLength(3);
      });
  it("converts an intermediate win into a fifteen-second camp and retains each build", () => {
    const a = setup(2);
    a.heroes()[0].hp = 20;
    a.heroes()[0].ult = 10;
    a.raid.rites.p0 = ["core"];
    win(a);
    a.heroes()[0].ult = 10;
    expect(enterExpeditionCamp(a)).toBe(true);
    expect(a.phase).toBe("intermission");
    expect(a.raid.result).toBeNull();
    expect(a.raid.expedition!.completed).toBe(1);
    expect(a.deadline - a.time).toBe(15);
    expect(chooseExpeditionCamp(a, "nobody", "rest")).toBe(false);
    expect(chooseExpeditionCamp(a, "p0", "surge")).toBe(true);
    expect(chooseExpeditionCamp(a, "p0", "rest")).toBe(false);
    expect(chooseExpeditionCamp(a, "p1", "rest")).toBe(true);
    a.tick(1.1);
    const b = advanceExpedition(a)!;
    expect(b).toBeDefined();
    expect(b.phase).toBe("briefing");
    expect(b.raid.expedition!.leg).toBe(1);
    expect(b.raid.rites.p0).toEqual(["core"]);
    expect(b.heroes()[0].hp).toBeCloseTo(20 + CHARACTERS.voltkit.health * 0.35);
    expect(b.heroes()[0].ult).toBe(50);
    expect(b.heroes()[1].hp).toBe(CHARACTERS.voltkit.health);
  });
  it("defaults unselected camps to full healing and does not skip a leg", () => {
    const a = setup();
    a.heroes()[0].hp = 1;
    win(a);
    enterExpeditionCamp(a);
    expect(advanceExpedition(a)).toBeUndefined();
    a.tick(16);
    const b = advanceExpedition(a)!;
    expect(b.raid.expedition!.leg).toBe(1);
    expect(b.heroes()[0].hp).toBe(CHARACTERS.voltkit.health);
  });
  it("never advances camps or consumes choices during a reconnect pause", () => {
    const a = setup();
    win(a);
    enterExpeditionCamp(a);
    const t = a.time;
    a.phase = "paused";
    a.tick(20);
    expect(a.time).toBe(t);
    expect(chooseExpeditionCamp(a, "p0", "surge")).toBe(false);
    expect(advanceExpedition(a)).toBeUndefined();
  });
  it("saves exactly one full-run receipt and keeps ordinary per-boss clears separate", () => {
    let a = setup();
    const owners = new Map([["p0", "account-0"]]);
    for (let leg = 0; leg < 3; leg++) {
      expect(a.raid.expedition!.leg).toBe(leg);
      win(a);
      if (leg < 2) {
        expect(enterExpeditionCamp(a)).toBe(true);
        expect(expeditionReceipt(a, owners)).toBeUndefined();
        chooseExpeditionCamp(a, "p0", "rest");
        a.tick(1.1);
        a = advanceExpedition(a)!;
        a.phase = "playing";
      }
    }
    expect(enterExpeditionCamp(a)).toBe(false);
    const r = expeditionReceipt(a, owners)!;
    expect(r.kind).toBe("expedition");
    expect(r.players[0].expedition?.completed).toBe(3);
    expect(r.players[0].activeSeconds).toBeGreaterThanOrEqual(180);
    expect(r.players[0].participated).toBe(true);
    expect(r.players[0].raid).toBeUndefined();
    expect(expeditionReceipt(a, owners)).toBeUndefined();
  });
  it("records partial completion after a later defeat and restarts with fresh health, rites and a new run ID", () => {
    let a = setup();
    const id = a.raid.expedition!.id;
    win(a);
    enterExpeditionCamp(a);
    a.tick(16);
    a = advanceExpedition(a)!;
    a.phase = "playing";
    a.raid.elapsed = 40;
    a.forfeit("p0");
    const receipt = expeditionReceipt(a, new Map([["p0", "account"]]))!;
    expect(receipt.players[0].expedition?.completed).toBe(1);
    const reset = restartExpedition(a, "2026-10-19", true);
    expect(reset.raid.expedition!.id).not.toBe(id);
    expect(reset.raid.expedition!.leg).toBe(0);
    expect(reset.heroes()[0].hp).toBe(CHARACTERS.voltkit.health);
    expect(reset.raid.rites).toEqual({});
    expect(restartExpedition(a, "2026-10-19", false).phase).toBe("lobby");
  });
  it("keeps disconnected stand-ins through the next briefing without waiting for an impossible acknowledgement", () => {
    const a = setup(2);
    a.standIn("p1");
    win(a);
    enterExpeditionCamp(a);
    chooseExpeditionCamp(a, "p0", "rest");
    a.tick(1.1);
    const b = advanceExpedition(a)!;
    expect(b.bots.has("p1")).toBe(true);
    expect(b.instructionsReady).toContain("p1");
  });
});
