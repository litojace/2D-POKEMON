import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

// Migration 112 renames Emberwing's rewards for Lumiwick. Titles are granted
// by name (arena_record_raid joins rewards to titles on it), so a renamed
// reward must land on a title of its own: "Lone Lantern" is already
// Gloomshade's solo title.
it("renames Emberwing's titles in place, without taking Gloomshade's", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table arena_raid_bosses(id text primary key, name text not null);
      create table arena_raid_rewards(id text primary key, boss text, slot text, name text);
      create table arena_titles(
        id uuid primary key default gen_random_uuid(),
        name text unique not null, description text, color text, active boolean);
      create table arena_player_titles(player_id uuid, title_id uuid references arena_titles(id));
      insert into arena_raid_bosses values ('emberwing', 'Emberwing'), ('gloomshade', 'Gloomshade');
      insert into arena_raid_rewards values
        ('lone-phoenix', 'emberwing', 'title', 'Lone Phoenix'),
        ('wingbreaker', 'emberwing', 'title', 'Wingbreaker'),
        ('lone-lantern', 'gloomshade', 'title', 'Lone Lantern');
      insert into arena_titles(id, name, description, color, active) values
        ('00000000-0000-4000-8000-000000000001', 'Lone Phoenix', 'Clear Peril 3 solo (no self-revive).', '#ffad78', true),
        ('00000000-0000-4000-8000-000000000002', 'Wingbreaker', 'Clear Peril 3.', '#ffad78', true),
        ('00000000-0000-4000-8000-000000000003', 'Lone Lantern', 'Clear Gloomshade on Peril 3 solo, with no self-revive.', '#f2b94b', true);
      insert into arena_player_titles values
        ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000001');
    `);
    const migration = (
      await readFile("supabase/migrations/112_lumiwick_names.sql", "utf8")
    ).replace(/public\./g, "");
    await db.exec(migration);
    await db.exec(migration);

    const granted = await db.query<{ reward: string; title: string }>(`
      select w.id as reward, t.id as title
        from arena_raid_rewards w join arena_titles t on t.name = w.name
       where w.slot = 'title' order by w.id`);
    // Each title reward finds exactly one title, and each its own.
    expect(granted.rows).toEqual([
      { reward: "lone-lantern", title: "00000000-0000-4000-8000-000000000003" },
      { reward: "lone-phoenix", title: "00000000-0000-4000-8000-000000000001" },
      { reward: "wingbreaker", title: "00000000-0000-4000-8000-000000000002" },
    ]);
    const titles = await db.query<{ id: string; name: string }>(
      "select id, name from arena_titles order by id",
    );
    expect(titles.rows.map((t) => t.name)).toEqual([
      "Lone Wick",
      "Wicksnuffer",
      "Lone Lantern",
    ]);
    // The player who owned Lone Phoenix owns the same row, now Lone Wick.
    expect(
      (await db.query("select count(*)::int as n from arena_player_titles"))
        .rows,
    ).toEqual([{ n: 1 }]);
    expect(
      (
        await db.query<{ name: string }>(
          "select name from arena_raid_bosses where id = 'emberwing'",
        )
      ).rows,
    ).toEqual([{ name: "Lumiwick" }]);
  } finally {
    await db.close();
  }
});
