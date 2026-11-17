-- The Spire, zone 6 (season 0): floors 51–60, the Sky Terrace, with the
-- Ascendant Lumiwick on floor 60.
-- Run after 20261117210000_spire_zone5.sql. Safe to run again.
--
--   - zone 6's first-clear rewards (kept identical to SPIRE_REWARDS in
--     packages/shared/src/spire.ts; a unit test compares) and floor 60's
--     title;
--   - checkpoints recomputed: arena_spire_checkpoint only opens a zone that
--     has reward rows, so players who conquered zone 5 before this ran kept
--     checkpoint 41. They climb from floor 51 now.

begin;

-- Zone 6's first-clear rewards (SPIRE_REWARDS, floors 51–60).
delete from public.arena_spire_rewards where season = 0 and floor between 51 and 60;
insert into public.arena_spire_rewards(season, floor, kind, item, amount) values
  (0, 51, 'coins', 'coins', 100),
  (0, 52, 'coins', 'coins', 100),
  (0, 53, 'coins', 'coins', 105),
  (0, 54, 'coins', 'coins', 105),
  (0, 55, 'coins', 'coins', 220),
  (0, 56, 'coins', 'coins', 110),
  (0, 57, 'coins', 'coins', 110),
  (0, 58, 'coins', 'coins', 115),
  (0, 59, 'coins', 'coins', 115),
  (0, 60, 'coins', 'coins', 400),
  (0, 60, 'title', 'Flamebreaker of the Spire', 0);

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Flamebreaker of the Spire', 'Clear floor 60 of the Spire: the Ascendant Lumiwick.', '#ff9a4a')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

-- Zone 5 conquered before zone 6 existed: checkpoint 51 now.
update public.arena_spire_progress
set checkpoint = public.arena_spire_checkpoint(season, highest_floor),
    updated_at = now()
where checkpoint is distinct from public.arena_spire_checkpoint(season, highest_floor);

commit;
