import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  RAID_COSMETICS,
  RAID_REWARDS,
  RAID_SLOTS,
} from "../../packages/shared/src/raid";

const sql = readFileSync("supabase/migrations/009_raid_hub.sql", "utf8");
/** Rows of the arena_raid_rewards seed in migration 009. */
const seeded = [
  ...sql.matchAll(
    /\('([a-z-]+)', (null|'[a-z-]+'), '([a-z]+)', '([^']+)', '(\{[^']*\})'\)/g,
  ),
].map(([, id, boss, slot, name, rule]) => ({
  id,
  boss: boss === "null" ? null : boss.slice(1, -1),
  slot,
  name,
  rule: JSON.parse(rule),
}));

describe("raid rewards", () => {
  it("matches the database seed exactly", () => {
    expect(seeded.length).toBe(RAID_REWARDS.length);
    for (const reward of RAID_REWARDS) {
      const row = seeded.find((r) => r.id === reward.id);
      expect(row, reward.id).toBeTruthy();
      expect(row!.boss).toBe(reward.boss);
      expect(row!.slot).toBe(reward.slot);
      expect(row!.name).toBe(reward.name);
      expect(row!.rule).toEqual(reward.rule);
    }
  });

  it("has a title row for every title reward", () => {
    const migrations = readdirSync("supabase/migrations")
      .map((f: string) => readFileSync(`supabase/migrations/${f}`, "utf8"))
      .join("\n");
    for (const reward of RAID_REWARDS.filter((r) => r.slot === "title"))
      expect(migrations, reward.name).toMatch(
        new RegExp(`\\('${reward.name}',\\s*'`),
      );
  });

  it("uses unique ids and known slots and bosses", () => {
    const ids = RAID_REWARDS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RAID_REWARDS) {
      expect([...RAID_SLOTS, "title"]).toContain(r.slot);
      if (r.boss) expect(RAID_BOSS_ORDER).toContain(r.boss);
    }
  });

  it("derives the cosmetic list (every slot item) from the rewards", () => {
    expect(Object.keys(RAID_COSMETICS).sort()).toEqual(
      RAID_REWARDS.filter((r) => r.slot !== "title")
        .map((r) => r.id)
        .sort(),
    );
    expect(RAID_COSMETICS["rockslide-flex"].slot).toBe("victory");
  });

  it("seeds every boss in the roster, and only playable ones can be raided", () => {
    for (const id of RAID_BOSS_ORDER) {
      expect(sql).toContain(`('${id}', '${RAID_BOSSES[id].name}', ${RAID_BOSSES[id].playable})`);
    }
  });
});
