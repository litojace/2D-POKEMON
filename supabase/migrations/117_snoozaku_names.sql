-- Somnara's raid boss is now Snoozaku, the dream-eating baku in a starry
-- nightcap. Display texts only: the boss id stays 'somnara', so runs, clears,
-- progress and rewards keep pointing at the same rows.
update public.arena_raid_bosses set name = 'Snoozaku' where id = 'somnara';

update public.arena_titles set description = replace(description, 'Somnara', 'Snoozaku')
where description like '%Somnara%';
