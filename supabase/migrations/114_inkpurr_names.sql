-- Gloomshade's new look is Inkpurr, the ink sprite. Players see the new name;
-- the internal id stays 'gloomshade', so stats, progress, rewards and every
-- row keyed on it are untouched. Only display texts change.
begin;

update public.arena_raid_bosses set name = 'Inkpurr' where id = 'gloomshade';

-- The titles 013 created describe the boss by name.
update public.arena_titles
  set description = replace(description, 'Gloomshade', 'Inkpurr')
  where description like '%Gloomshade%';

commit;
