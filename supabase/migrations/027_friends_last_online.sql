-- Persist last-online history; live connection state remains server-owned.
-- Run after 026_six_daily_missions.sql. Existing players start with unknown history.
begin;
alter table public.arena_profiles add column if not exists last_online_at timestamptz;

-- Only the authenticated player's own row can be touched. Never accept a user id
-- or timestamp from the caller; another player's history cannot be changed.
create or replace function public.arena_touch_presence() returns timestamptz
language plpgsql security definer set search_path='' as $$
declare seen timestamptz;
begin
 perform public.arena_require_player();
 update public.arena_profiles
 set last_online_at=greatest(coalesce(last_online_at,'-infinity'::timestamptz),clock_timestamp())
 where id=auth.uid()
 returning last_online_at into seen;
 return seen;
end; $$;

-- The timestamp is visible only in the caller's accepted friends list, never in
-- incoming/outgoing requests or a new public player lookup.
create or replace function public.arena_friends() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.arena_require_player();
 select jsonb_build_object(
  'code', public.arena_friend_code(auth.uid()),
  'friends', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'title',t.name,'titleColor',t.color,'lastOnline',p.last_online_at) order by lower(p.display_name))
    from public.arena_friendships f
    join public.arena_profiles p on p.id = case when f.a=auth.uid() then f.b else f.a end
    left join public.arena_titles t on t.id=p.equipped_title and t.active
    where (f.a=auth.uid() or f.b=auth.uid()) and not p.suspended),'[]'::jsonb),
  'incoming', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.from_id where r.to_id=auth.uid() and not p.suspended),'[]'::jsonb),
  'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.to_id where r.from_id=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end; $$;

revoke all on function public.arena_touch_presence(), public.arena_friends() from public, anon, authenticated;
grant execute on function public.arena_touch_presence(), public.arena_friends() to authenticated;
commit;
