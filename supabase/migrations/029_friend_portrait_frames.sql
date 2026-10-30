-- Saved equipped frames remain visible to accepted friends while offline.
-- No inventory, other appearance slots, or request details are exposed.
begin;
create or replace function public.arena_friends() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.arena_require_player();
 select jsonb_build_object(
  'code', public.arena_friend_code(auth.uid()),
  'friends', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'title',t.name,'titleColor',t.color,'lastOnline',p.last_online_at,'frame',l.frame) order by lower(p.display_name))
    from public.arena_friendships f
    join public.arena_profiles p on p.id = case when f.a=auth.uid() then f.b else f.a end
    left join public.arena_titles t on t.id=p.equipped_title and t.active
    left join public.arena_raid_loadouts l on l.player_id=p.id
    where (f.a=auth.uid() or f.b=auth.uid()) and not p.suspended),'[]'::jsonb),
  'incoming', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.from_id where r.to_id=auth.uid() and not p.suspended),'[]'::jsonb),
  'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.to_id where r.from_id=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
revoke all on function public.arena_friends() from public, anon, authenticated;
grant execute on function public.arena_friends() to authenticated;
commit;
