import { describe, expect, it } from "vitest";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
} from "../../packages/shared/src/raid-roster";
import { lobbyRaidBoss, lobbyRaidCard } from "../../apps/client/src/lobby-raid";

const all = (n: number) =>
  Object.fromEntries(RAID_BOSS_ORDER.map((id) => [id, n]));

describe("the Lobby's Raid card", () => {
  it("shows Cragmuff until it is cleared: the others are locked till then", () => {
    expect(lobbyRaidBoss()).toBe("grumblecrag");
    expect(lobbyRaidBoss({})).toBe("grumblecrag");
    // A clear of a later boss without Cragmuff's can't happen; even so the
    // card never points at a locked boss.
    expect(lobbyRaidBoss({ tidewyrm: 2 })).toBe("grumblecrag");
  });

  it("then shows the next boss not cleared, in the Raid Hall's order", () => {
    expect(lobbyRaidBoss({ grumblecrag: 1 })).toBe("tidewyrm");
    expect(lobbyRaidBoss({ grumblecrag: 3, tidewyrm: 1 })).toBe("gloomshade");
    expect(
      lobbyRaidBoss({ grumblecrag: 1, tidewyrm: 1, somnara: 4, emberwing: 1 }),
    ).toBe("gloomshade");
  });

  it("with every boss cleared, shows one a day and all of them in turn", () => {
    const day = (d: number) =>
      lobbyRaidBoss(all(1), `2026-11-${String(d).padStart(2, "0")}`);
    expect(day(26)).toBe(day(26));
    expect(day(27)).not.toBe(day(26));
    const week = new Set(Array.from({ length: 7 }, (_, i) => day(20 + i)));
    expect([...week].sort()).toEqual([...RAID_BOSS_ORDER].sort());
  });

  it("only ever shows a boss that can be raided", () => {
    for (let d = 1; d <= 28; d++) {
      const id = lobbyRaidBoss(all(1), `2026-02-${String(d).padStart(2, "0")}`);
      expect(RAID_BOSSES[id].playable).toBe(true);
    }
  });

  it("names the boss players know, not its id", () => {
    const card = lobbyRaidCard("gloomshade");
    expect(card).toContain("<b>Inkpurr</b>");
    expect(card).not.toContain("gloomshade</");
    expect(card).toContain('class="lobby-raid-art"');
    expect(card).toContain('loading="lazy"');
  });

  it("has a painting and a framing point for every boss", () => {
    for (const id of RAID_BOSS_ORDER) {
      const card = lobbyRaidCard(id);
      expect(card).toMatch(/src="[^"]+"/);
      expect(card).toMatch(/object-position:\d+% \d+%/);
      expect(card).toContain(`<b>${RAID_BOSSES[id].name}</b>`);
    }
  });
});
