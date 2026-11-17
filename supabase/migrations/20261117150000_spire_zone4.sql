-- The Spire, zone 4 (season 0): floors 31–40, the Cloud Deck, with the
-- Ascendant Snoozaku on floor 40.
-- Run after 20261117090000_spire_zone3.sql. Safe to run again.
--
--   - zone 4's first-clear rewards (kept identical to SPIRE_REWARDS in
--     packages/shared/src/spire.ts; a unit test compares) and floor 40's
--     title;
--   - checkpoints recomputed: arena_spire_checkpoint only opens a zone that
--     has reward rows, so players who conquered zone 3 before this ran kept
--     checkpoint 21. They climb from floor 31 now.

begin;

-- Zone 4's first-clear rewards (SPIRE_REWARDS, floors 31–40).
delete from public.arena_spire_rewards where season = 0 and floor between 31 and 40;
insert into public.arena_spire_rewards(season, floor, kind, item, amount) values
  (0, 31, 'coins', 'coins', 70),
  (0, 32, 'coins', 'coins', 70),
  (0, 33, 'coins', 'coins', 75),
  (0, 34, 'coins', 'coins', 75),
  (0, 35, 'coins', 'coins', 160),
  (0, 36, 'coins', 'coins', 80),
  (0, 37, 'coins', 'coins', 80),
  (0, 38, 'coins', 'coins', 85),
  (0, 39, 'coins', 'coins', 85),
  (0, 40, 'coins', 'coins', 300),
  (0, 40, 'title', 'Dreambreaker of the Spire', 0);

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Dreambreaker of the Spire', 'Clear floor 40 of the Spire: the Ascendant Snoozaku.', '#c9a3ff')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

-- Zone 3 conquered before zone 4 existed: checkpoint 31 now.
update public.arena_spire_progress
set checkpoint = public.arena_spire_checkpoint(season, highest_floor),
    updated_at = now()
where checkpoint is distinct from public.arena_spire_checkpoint(season, highest_floor);

commit;
