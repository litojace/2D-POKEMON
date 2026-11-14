-- Presentation-only reconciliation after 112–115. These are replacement
-- identities of the same seven raids, not new bosses. Preserve IDs and all
-- foreign keys used by runs, rewards, clears and cosmetic ownership.
begin;

-- One statement per boss, in the form 112–115 use (tests/unit/raid-rewards
-- reads it to check the roster and the database agree).
update public.arena_raid_bosses set name = 'Cragmuff' where id = 'grumblecrag';
update public.arena_raid_bosses set name = 'Tidelotl' where id = 'tidewyrm';
update public.arena_raid_bosses set name = 'Inkpurr' where id = 'gloomshade';
update public.arena_raid_bosses set name = 'Snoozaku' where id = 'somnara';
update public.arena_raid_bosses set name = 'Prismell' where id = 'prismatail';
update public.arena_raid_bosses set name = 'Lumiwick' where id = 'emberwing';
update public.arena_raid_bosses set name = 'Storm Twins' where id = 'storm-twins';

update public.arena_titles
set description = replace(replace(replace(replace(description,
  'Grumblecrag', 'Cragmuff'), 'Tidewyrm', 'Tidelotl'),
  'Gloomshade', 'Inkpurr'), 'Emberwing', 'Lumiwick')
where description ~ '(Grumblecrag|Tidewyrm|Gloomshade|Emberwing)';

commit;
