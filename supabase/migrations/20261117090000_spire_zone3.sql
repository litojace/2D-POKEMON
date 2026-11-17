-- The Spire, zone 3 (season 0): floors 21–30, the Lantern Yard, with the
-- Ascendant Inkpurr on floor 30.
-- Run after 20261116180000_spire_zone2.sql. Safe to run again.
--
--   - zone 3's first-clear rewards (kept identical to SPIRE_REWARDS in
--     packages/shared/src/spire.ts; a unit test compares) and floor 30's
--     title;
--   - checkpoints recomputed: arena_spire_checkpoint only opens a zone that
--     has reward rows, so players who conquered zone 2 before this ran kept
--     checkpoint 11. They climb from floor 21 now.

begin;

-- Zone 3's first-clear rewards (SPIRE_REWARDS, floors 21–30).
delete from public.arena_spire_rewards where season = 0 and floor between 21 and 30;
insert into public.arena_spire_rewards(season, floor, kind, item, amount) values
  (0, 21, 'coins', 'coins', 55),
  (0, 22, 'coins', 'coins', 55),
  (0, 23, 'coins', 'coins', 60),
  (0, 24, 'coins', 'coins', 60),
  (0, 25, 'coins', 'coins', 130),
  (0, 26, 'coins', 'coins', 65),
  (0, 27, 'coins', 'coins', 65),
  (0, 28, 'coins', 'coins', 70),
  (0, 29, 'coins', 'coins', 70),
  (0, 30, 'coins', 'coins', 250),
  (0, 30, 'title', 'Lanternbane of the Spire', 0);

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Lanternbane of the Spire', 'Clear floor 30 of the Spire: the Ascendant Inkpurr.', '#b48cff')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

-- Zone 2 conquered before zone 3 existed: checkpoint 21 now.
update public.arena_spire_progress
set checkpoint = public.arena_spire_checkpoint(season, highest_floor),
    updated_at = now()
where checkpoint is distinct from public.arena_spire_checkpoint(season, highest_floor);

commit;
