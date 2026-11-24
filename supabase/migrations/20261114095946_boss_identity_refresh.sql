-- Presentation-only reconciliation after 112–115. These are replacement
-- identities of the same seven raids, not new bosses. Preserve IDs and all
-- foreign keys used by runs, rewards, clears and cosmetic ownership.
begin;

update public.arena_raid_bosses as b
set name = current_boss.name
from (values
  ('grumblecrag', 'Cragmuff'),
  ('tidewyrm', 'Tidelotl'),
  ('gloomshade', 'Inkpurr'),
  ('somnara', 'Snoozaku'),
  ('prismatail', 'Prismell'),
  ('emberwing', 'Lumiwick'),
  ('storm-twins', 'Storm Twins')
) as current_boss(id, name)
where b.id = current_boss.id and b.name is distinct from current_boss.name;

update public.arena_titles
set description = replace(replace(replace(replace(description,
  'Grumblecrag', 'Cragmuff'), 'Tidewyrm', 'Tidelotl'),
  'Gloomshade', 'Inkpurr'), 'Emberwing', 'Lumiwick')
where description ~ '(Grumblecrag|Tidewyrm|Gloomshade|Emberwing)';

commit;
