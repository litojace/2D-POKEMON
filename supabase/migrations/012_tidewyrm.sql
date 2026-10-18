-- Tidewyrm, the second raid boss (docs/raid-roster-design.md §5.1).
-- Rewards are rows, not functions (see 009): this marks Tidewyrm playable,
-- seeds its reward rules and creates its titles. Run after 011.
begin;

update public.arena_raid_bosses set playable = true where id = 'tidewyrm';

-- Kept identical to RAID_REWARDS in packages/shared/src/raid.ts (a unit test compares them).
insert into public.arena_raid_rewards(id, boss, slot, name, rule) values
  ('tidebreaker', 'tidewyrm', 'title', 'Tidebreaker', '{"kind":"clears","n":1}'),
  ('seafoam', 'tidewyrm', 'skin', 'Seafoam colors', '{"kind":"clears","n":5}'),
  ('pearlscale', 'tidewyrm', 'skin', 'Pearlscale skin', '{"kind":"clears","n":10}'),
  ('riptide', 'tidewyrm', 'entrance', 'Riptide entrance', '{"kind":"peril","n":2}'),
  ('leviathans-bane', 'tidewyrm', 'title', 'Leviathan''s Bane', '{"kind":"peril","n":3}'),
  ('reef', 'tidewyrm', 'frame', 'Reef frame', '{"kind":"peril","n":3}'),
  ('tidal-aura', 'tidewyrm', 'aura', 'Tidal aura', '{"kind":"flawless","peril":3}'),
  ('splashdown', 'tidewyrm', 'victory', 'Splashdown', '{"kind":"feat"}'),
  ('flash-flood', 'tidewyrm', 'title', 'Flash Flood', '{"kind":"speed","peril":2,"party":1,"seconds":240}'),
  ('lone-current', 'tidewyrm', 'title', 'Lone Current', '{"kind":"solo","peril":3}'),
  ('shipwright', 'tidewyrm', 'title', 'Shipwright', '{"kind":"stat","stat":"pillars","n":30}')
on conflict (id) do update
  set boss = excluded.boss, slot = excluded.slot, name = excluded.name, rule = excluded.rule;

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Tidebreaker', 'Defeat Tidewyrm in a boss raid.', '#4fd6c8'),
  ('Leviathan''s Bane', 'Defeat Tidewyrm on Peril 3.', '#1d8fb0'),
  ('Flash Flood', 'Clear Tidewyrm on Peril 2 solo in under 4:00.', '#7fe9ff'),
  ('Lone Current', 'Clear Tidewyrm on Peril 3 solo, with no self-revive.', '#2fb7d6'),
  ('Shipwright', 'Strand Tidewyrm on an island 30 times.', '#d9c48a')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

commit;
