-- Removes co-ops and the weekly Valley Cup (060_farm_cup.sql) for good.
-- Run after 062_farm_faster_crops.sql. Safe to run again.
-- Nothing else reads these tables or calls these functions.
begin;

drop function if exists public.arena_farm_cup_act(uuid, text, text);
drop function if exists public.arena_farm_cup();
drop function if exists public.arena_farm_cup_state(uuid);
drop function if exists public.arena_farm_coop_points(uuid, date);
drop function if exists public.arena_farm_cup_settle(uuid);
drop function if exists public.arena_farm_cup_week();
drop function if exists public.arena_farm_cup_counter(uuid, text);
drop function if exists public.arena_farm_cup_catalog();

drop table if exists public.arena_farm_cup_rewards;
drop table if exists public.arena_farm_cup_tasks;
drop table if exists public.arena_farm_coop_members;
drop table if exists public.arena_farm_coops;

commit;
