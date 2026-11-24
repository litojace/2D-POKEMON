-- The Spire, zone 5 (season 0): floors 41–50, the Sun Atrium, with the
-- Ascendant Prismell on floor 50.
-- Run after 20261117150000_spire_zone4.sql. Safe to run again.
--
--   - zone 5's first-clear rewards (kept identical to SPIRE_REWARDS in
--     packages/shared/src/spire.ts; a unit test compares) and floor 50's
--     title;
--   - checkpoints recomputed: arena_spire_checkpoint only opens a zone that
--     has reward rows, so players who conquered zone 4 before this ran kept
--     checkpoint 31. They climb from floor 41 now.

begin;

-- Zone 5's first-clear rewards (SPIRE_REWARDS, floors 41–50).
delete from public.arena_spire_rewards where season = 0 and floor between 41 and 50;
insert into public.arena_spire_rewards(season, floor, kind, item, amount) values
  (0, 41, 'coins', 'coins', 85),
  (0, 42, 'coins', 'coins', 85),
  (0, 43, 'coins', 'coins', 90),
  (0, 44, 'coins', 'coins', 90),
  (0, 45, 'coins', 'coins', 190),
  (0, 46, 'coins', 'coins', 95),
  (0, 47, 'coins', 'coins', 95),
  (0, 48, 'coins', 'coins', 100),
  (0, 49, 'coins', 'coins', 100),
  (0, 50, 'coins', 'coins', 350),
  (0, 50, 'title', 'Sunbreaker of the Spire', 0);

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Sunbreaker of the Spire', 'Clear floor 50 of the Spire: the Ascendant Prismell.', '#ffe27a')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

-- Zone 4 conquered before zone 5 existed: checkpoint 41 now.
update public.arena_spire_progress
set checkpoint = public.arena_spire_checkpoint(season, highest_floor),
    updated_at = now()
where checkpoint is distinct from public.arena_spire_checkpoint(season, highest_floor);

commit;
