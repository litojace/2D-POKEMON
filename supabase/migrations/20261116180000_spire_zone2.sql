-- The Spire, zone 2 (season 0): floors 11–20, the Lagoon, with the
-- Ascendant Tidelotl on floor 20.
-- Run after 20261116150001_raise_currency_trade_caps.sql. Safe to run again.
--
--   - zone 2's first-clear rewards (kept identical to SPIRE_REWARDS in
--     packages/shared/src/spire.ts; a unit test compares) and floor 20's
--     title;
--   - checkpoints recomputed: arena_spire_checkpoint only opens a zone that
--     has reward rows, so players who conquered zone 1 before this ran kept
--     checkpoint 1. They climb from floor 11 now.

begin;

-- Zone 2's first-clear rewards (SPIRE_REWARDS, floors 11–20).
delete from public.arena_spire_rewards where season = 0 and floor between 11 and 20;
insert into public.arena_spire_rewards(season, floor, kind, item, amount) values
  (0, 11, 'coins', 'coins', 40),
  (0, 12, 'coins', 'coins', 40),
  (0, 13, 'coins', 'coins', 45),
  (0, 14, 'coins', 'coins', 45),
  (0, 15, 'coins', 'coins', 100),
  (0, 16, 'coins', 'coins', 50),
  (0, 17, 'coins', 'coins', 50),
  (0, 18, 'coins', 'coins', 55),
  (0, 19, 'coins', 'coins', 55),
  (0, 20, 'coins', 'coins', 200),
  (0, 20, 'title', 'Tidecaller of the Spire', 0);

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Tidecaller of the Spire', 'Clear floor 20 of the Spire: the Ascendant Tidelotl.', '#4fd6e6')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

-- Zone 1 conquered before zone 2 existed: checkpoint 11 now.
update public.arena_spire_progress
set checkpoint = public.arena_spire_checkpoint(season, highest_floor),
    updated_at = now()
where checkpoint is distinct from public.arena_spire_checkpoint(season, highest_floor);

commit;
