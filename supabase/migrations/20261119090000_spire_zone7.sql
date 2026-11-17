-- The Spire, zone 7 (season 0): floors 61–70, the Conductor Ring, with the
-- Ascendant Storm Twins on floor 70: the Spire's summit, its last floor.
-- Run after 20261118090000_spire_zone6.sql. Safe to run again.
--
--   - zone 7's first-clear rewards (kept identical to SPIRE_REWARDS in
--     packages/shared/src/spire.ts; a unit test compares) and floor 70's
--     title;
--   - checkpoints recomputed: arena_spire_checkpoint only opens a zone that
--     has reward rows, so players who conquered zone 6 before this ran kept
--     checkpoint 51. They climb from floor 61 now. (No floor cap lives in
--     the database: arena_record_spire_floor takes floors 1–1000, and a
--     clear of floor 70 keeps checkpoint 61, as there is no floor 71.)

begin;

-- Zone 7's first-clear rewards (SPIRE_REWARDS, floors 61–70).
delete from public.arena_spire_rewards where season = 0 and floor between 61 and 70;
insert into public.arena_spire_rewards(season, floor, kind, item, amount) values
  (0, 61, 'coins', 'coins', 115),
  (0, 62, 'coins', 'coins', 115),
  (0, 63, 'coins', 'coins', 120),
  (0, 64, 'coins', 'coins', 120),
  (0, 65, 'coins', 'coins', 250),
  (0, 66, 'coins', 'coins', 125),
  (0, 67, 'coins', 'coins', 125),
  (0, 68, 'coins', 'coins', 130),
  (0, 69, 'coins', 'coins', 130),
  (0, 70, 'coins', 'coins', 500),
  (0, 70, 'title', 'Stormbreaker of the Spire', 0);

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Stormbreaker of the Spire', 'Clear floor 70 of the Spire, its summit: the Ascendant Storm Twins.', '#8edfff')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

-- Zone 6 conquered before zone 7 existed: checkpoint 61 now.
update public.arena_spire_progress
set checkpoint = public.arena_spire_checkpoint(season, highest_floor),
    updated_at = now()
where checkpoint is distinct from public.arena_spire_checkpoint(season, highest_floor);

commit;
