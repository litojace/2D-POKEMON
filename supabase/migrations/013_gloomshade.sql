-- Gloomshade, the third raid boss (docs/raid-roster-design.md §5.2).
-- Rewards are rows, not functions (see 009): this marks Gloomshade playable,
-- seeds its reward rules and creates its titles. Run after 012.
begin;

update public.arena_raid_bosses set playable = true where id = 'gloomshade';

-- Kept identical to RAID_REWARDS in packages/shared/src/raid.ts (a unit test compares them).
insert into public.arena_raid_rewards(id, boss, slot, name, rule) values
  ('lightbringer', 'gloomshade', 'title', 'Lightbringer', '{"kind":"clears","n":1}'),
  ('dusk-colors', 'gloomshade', 'skin', 'Dusk colors', '{"kind":"clears","n":5}'),
  ('moonlit-skin', 'gloomshade', 'skin', 'Moonlit skin', '{"kind":"clears","n":10}'),
  ('shadowstep', 'gloomshade', 'entrance', 'Shadowstep entrance', '{"kind":"peril","n":2}'),
  ('nights-end', 'gloomshade', 'title', 'Night''s End', '{"kind":"peril","n":3}'),
  ('crescent', 'gloomshade', 'frame', 'Crescent frame', '{"kind":"peril","n":3}'),
  ('nightmote', 'gloomshade', 'aura', 'Nightmote aura', '{"kind":"flawless","peril":3}'),
  ('crescent-bow', 'gloomshade', 'victory', 'Crescent Bow', '{"kind":"feat"}'),
  ('moonrunner', 'gloomshade', 'title', 'Moonrunner', '{"kind":"speed","peril":2,"party":1,"seconds":240}'),
  ('lone-lantern', 'gloomshade', 'title', 'Lone Lantern', '{"kind":"solo","peril":3}'),
  ('lamplighter-title', 'gloomshade', 'title', 'Lamplighter', '{"kind":"stat","stat":"pillars","n":50}')
on conflict (id) do update
  set boss = excluded.boss, slot = excluded.slot, name = excluded.name, rule = excluded.rule;

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Lightbringer', 'Defeat Gloomshade in a boss raid.', '#ffd65b'),
  ('Night''s End', 'Defeat Gloomshade on Peril 3.', '#7b5cd6'),
  ('Moonrunner', 'Clear Gloomshade on Peril 2 solo in under 4:00.', '#c9d4ff'),
  ('Lone Lantern', 'Clear Gloomshade on Peril 3 solo, with no self-revive.', '#f2b94b'),
  ('Lamplighter', 'Relight 50 lanterns in Gloomshade raids.', '#ffe7a8')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

commit;
