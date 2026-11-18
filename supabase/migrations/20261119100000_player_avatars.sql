-- Player avatars (docs/hidden-picks.md, "Avatars"): who a player is, shown
-- wherever they are, whatever fighter they play. The library is
-- packages/shared/src/avatars.ts (ea-avatar-001 … ea-avatar-052, all free).
-- Run after 20261119090000_spire_zone7.sql. Safe to run again.
--
--   - arena_profiles.avatar: the chosen library avatar (null: the default);
--   - arena_set_avatar(p_avatar): the player sets their own;
--   - arena_my_avatar(): the player reads their own (the game server reads
--     it with the player's token for rooms);
--   - arena_friends: each friend's avatar ('avatar'), as their portrait.

begin;

alter table public.arena_profiles add column if not exists avatar text;
alter table public.arena_profiles drop constraint if exists arena_profiles_avatar_check;
alter table public.arena_profiles add constraint arena_profiles_avatar_check
  check (avatar is null or avatar ~ '^ea-avatar-0(0[1-9]|[1-4][0-9]|5[0-2])$');

create or replace function public.arena_set_avatar(p_avatar text) returns text
language plpgsql security definer set search_path = '' as $$
begin
 perform public.arena_require_player();
 if p_avatar is null or p_avatar !~ '^ea-avatar-0(0[1-9]|[1-4][0-9]|5[0-2])$' then
  raise exception 'Choose an avatar from the library.' using errcode = '22023';
 end if;
 update public.arena_profiles set avatar = p_avatar where id = auth.uid();
 return p_avatar;
end; $$;
revoke all on function public.arena_set_avatar(text) from public, anon;
grant execute on function public.arena_set_avatar(text) to authenticated;

create or replace function public.arena_my_avatar() returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
 perform public.arena_require_player();
 select avatar into v from public.arena_profiles where id = auth.uid();
 return v;
end; $$;
revoke all on function public.arena_my_avatar() from public, anon;
grant execute on function public.arena_my_avatar() to authenticated;

-- Friends: 075's arena_friends, with each friend's avatar.
create or replace function public.arena_friends() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform public.arena_require_player();
 select jsonb_build_object(
  'code', public.arena_friend_code(auth.uid()),
  'friends', coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.display_name,'title',t.name,'titleColor',t.color,
    'lastOnline',p.last_online_at,'fighter',p.portrait_character,'frame',l.frame,
    'avatar',p.avatar,
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

commit;
notify pgrst, 'reload schema';
