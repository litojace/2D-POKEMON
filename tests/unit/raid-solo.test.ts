import { describe, expect, it } from "vitest";
import { soloRevives } from "../../apps/client/src/raid-solo";
import {
  RAID_BOSSES,
  raidSoloRevive,
  type RaidBossId,
} from "../../packages/shared/src/raid";

describe("the solo ★★★ warning", () => {
  it("follows the server's solo-revive rule for every boss", () => {
    for (const boss of Object.keys(RAID_BOSSES) as RaidBossId[]) {
      expect(soloRevives(boss)).toBe(!!raidSoloRevive(boss));
      // ★★★ bosses give no self-revive; the others do.
      expect(soloRevives(boss)).toBe(RAID_BOSSES[boss].stars < 3);
    }
  });
});
