-- Grumblecrag's raid boss is now Cragmuff, the crystal-horned mountain ram.
-- Display texts only: the boss id stays 'grumblecrag', so runs, clears,
-- progress and rewards keep pointing at the same rows.
update public.arena_raid_bosses set name = 'Cragmuff' where id = 'grumblecrag';

update public.arena_titles set description = replace(description, 'Grumblecrag', 'Cragmuff')
where description like '%Grumblecrag%';
