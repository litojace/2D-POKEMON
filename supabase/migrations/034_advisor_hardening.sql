-- Supabase security advisor clean-up. No behaviour change for players.
--  * arena_level_for: pin its search_path (lint 0011, mutable search_path).
--  * arena_shop_picks and the old 3-argument arena_daily_mission were callable
--    by anon and every signed-in user through /rest/v1/rpc (lint 0028/0029).
--    The game never calls them directly: arena_shop_picks is only used inside
--    SECURITY DEFINER functions (arena_item_price, arena_economy_before_journey)
--    that run as the owner, and the 3-argument arena_daily_mission is a leftover
--    overload replaced by the 4-argument one in 014_missions.sql.
begin;

alter function public.arena_level_for(bigint) set search_path = '';

revoke all on function public.arena_shop_picks(date)
  from public, anon, authenticated;
revoke all on function public.arena_daily_mission(date, text, integer)
  from public, anon, authenticated;

commit;

select
  (select proconfig @> array['search_path=""'] from pg_proc
    where oid = 'public.arena_level_for(bigint)'::regprocedure) as level_for_search_path_pinned,
  not has_function_privilege('anon', 'public.arena_shop_picks(date)', 'execute')
    and not has_function_privilege('authenticated', 'public.arena_shop_picks(date)', 'execute')
    as shop_picks_private,
  not has_function_privilege('anon', 'public.arena_daily_mission(date,text,integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.arena_daily_mission(date,text,integer)', 'execute')
    as old_daily_mission_private;
