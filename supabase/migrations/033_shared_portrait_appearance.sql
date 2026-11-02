-- Accepted friends see the same saved portrait as room, party and profile cards.
-- Only the caller may change their chosen champion; cosmetics remain verified
-- by the existing wardrobe equip functions and private appearance tables.
begin;
alter table public.arena_profiles
  add column if not exists portrait_character text not null default 'voltkit'
  check (portrait_character in ('voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil'));

create or replace function public.arena_set_portrait_character(p_character text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_player();
 if p_character is null or p_character not in ('voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil') then
   raise exception 'Choose a valid champion';
 end if;
 update public.arena_profiles set portrait_character=p_character
   where id=auth.uid() and portrait_character is distinct from p_character;
end; $$;
revoke all on function public.arena_set_portrait_character(text) from public, anon, authenticated;
grant execute on function public.arena_set_portrait_character(text) to authenticated;

create or replace function public.arena_friends() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.arena_require_player();
 select jsonb_build_object(
  'code', public.arena_friend_code(auth.uid()),
  'friends', coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.display_name,'title',t.name,'titleColor',t.color,
    'lastOnline',p.last_online_at,'fighter',p.portrait_character,'frame',l.frame,
    'look',jsonb_build_object('skin',l.skin,'aura',l.aura,'entrance',l.entrance,'frame',l.frame,'victory',l.victory),
    'championLooks',coalesce((select jsonb_object_agg(c.champion,jsonb_build_object('skin',c.skin,'stage',c.stage))
      from public.arena_champion_looks c where c.player_id=p.id and c.champion=p.portrait_character),'{}'::jsonb),
    'raidClears',coalesce((select jsonb_object_agg(b.boss,b.clears) from (
      select r.boss,count(*) as clears from public.arena_raid_players rp
      join public.arena_raid_runs r on r.id=rp.run_id
      where rp.player_id=p.id and r.result='victory' group by r.boss
    ) b),'{}'::jsonb)
  ) order by lower(p.display_name))
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
