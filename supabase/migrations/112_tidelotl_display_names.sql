-- Tidewyrm is shown as Tidelotl (an axolotl) from now on. Only the texts
-- players see change: the boss id stays 'tidewyrm', so stats, progress,
-- routes and reward rows stay valid, and title names (what players own and
-- wear) stay as they are. Run after 111.

update public.arena_raid_bosses set name = 'Tidelotl' where id = 'tidewyrm';

update public.arena_titles
set description = replace(description, 'Tidewyrm', 'Tidelotl')
where name in ('Tidebreaker', 'Leviathan''s Bane', 'Flash Flood', 'Lone Current', 'Shipwright')
  and description like '%Tidewyrm%';
