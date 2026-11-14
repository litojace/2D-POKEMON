-- Emberwing is drawn as Lumiwick, a sky-lantern spirit. Display texts only:
-- the boss id stays 'emberwing', and reward ids stay as they were, so runs,
-- progress and owned titles are untouched. Titles keep their ids (players
-- who own "Lone Phoenix" now own "Lone Lantern").
-- Run after 111_apple_tokens.sql. Safe to run again.
begin;
update public.arena_raid_bosses set name = 'Lumiwick' where id = 'emberwing';
update public.arena_raid_rewards set name = 'Lone Lantern' where id = 'lone-phoenix';
update public.arena_raid_rewards set name = 'Wicksnuffer' where id = 'wingbreaker';
-- Rename the title rows (granting joins rewards to titles by name).
update public.arena_titles t set name = v.new_name, description = v.description
  from (values
    ('Lone Lantern', 'Lone Phoenix', 'Clear Peril 3 solo (no self-revive).'),
    ('Wicksnuffer', 'Wingbreaker', 'Clear Peril 3.')
  ) v(new_name, old_name, description)
 where t.name = v.old_name
   and not exists (select 1 from public.arena_titles n where n.name = v.new_name);
-- A database that never had the old rows still gets the titles.
insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Lone Lantern', 'Clear Peril 3 solo (no self-revive).', '#ffad78'),
  ('Wicksnuffer', 'Clear Peril 3.', '#ffad78')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);
commit;
