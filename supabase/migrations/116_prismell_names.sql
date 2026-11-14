-- Prismatail's raid boss is now Prismell, the prism-shelled snail.
-- Display texts only: the boss id stays 'prismatail', so runs, clears,
-- progress and rewards keep pointing at the same rows, and reward and title
-- names (what players own and wear) stay as they are. Run after 115.
-- Safe to run again.
begin;

update public.arena_raid_bosses set name = 'Prismell' where id = 'prismatail';

update public.arena_titles
  set description = replace(description, 'Prismatail', 'Prismell')
  where description like '%Prismatail%';

commit;
