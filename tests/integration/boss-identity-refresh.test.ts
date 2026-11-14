import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
} from "../../packages/shared/src/raid-roster";

it("reconciles display names repeatedly without changing progress or reward links", async () => {
  const db = new PGlite();
  try {
    // Only the columns touched by this data migration, with dependent records
    // to catch accidental ID changes/deletions during the identity refresh.
    await db.exec(`
      create table arena_raid_bosses(id text primary key, name text not null);
      create table arena_titles(id uuid primary key, name text, description text);
      create table arena_raid_rewards(id text primary key, boss text references arena_raid_bosses(id));
      create table arena_raid_runs(id uuid primary key, boss text references arena_raid_bosses(id));
      insert into arena_titles values
        ('00000000-0000-4000-8000-000000000001', 'Veteran', 'Beat Grumblecrag, Tidewyrm, Gloomshade and Emberwing.');
    `);
    for (const id of RAID_BOSS_ORDER)
      await db.query("insert into arena_raid_bosses values ($1, $2)", [id, id]);
    await db.exec(`
      insert into arena_raid_rewards values ('lone-phoenix', 'emberwing');
      insert into arena_raid_runs values
        ('00000000-0000-4000-8000-000000000002', 'emberwing');
    `);
    const migration = await readFile(
      "supabase/migrations/116_boss_identity_refresh.sql",
      "utf8",
    );
    const before = {
      rewards: (await db.query("select * from arena_raid_rewards")).rows,
      runs: (await db.query("select * from arena_raid_runs")).rows,
      titles: (await db.query("select id, name from arena_titles")).rows,
    };
    await db.exec(migration);
    await db.exec(migration);
    expect(
      (await db.query("select id, name from arena_raid_bosses order by id"))
        .rows,
    ).toEqual(
      RAID_BOSS_ORDER.map((id) => ({ id, name: RAID_BOSSES[id].name })).sort(
        (a, b) => a.id.localeCompare(b.id),
      ),
    );
    expect(
      (await db.query("select description from arena_titles")).rows,
    ).toEqual([
      { description: "Beat Cragmuff, Tidelotl, Inkpurr and Lumiwick." },
    ]);
    expect({
      rewards: (await db.query("select * from arena_raid_rewards")).rows,
      runs: (await db.query("select * from arena_raid_runs")).rows,
      titles: (await db.query("select id, name from arena_titles")).rows,
    }).toEqual(before);
  } finally {
    await db.close();
  }
});
