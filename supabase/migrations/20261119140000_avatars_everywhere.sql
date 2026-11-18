-- Avatars everywhere (docs/hidden-picks.md, "Avatars"): the leaderboard's
-- rows carry each player's id and avatar, and the game server can look up
-- any player's avatar by id (an avatar is on view to everyone).
-- Run after 20261119110000_avatar_photos.sql. Safe to run again.

begin;

-- 006's arena_leaderboard, with 'id' and 'avatar' in each row.
create or replace function public.arena_leaderboard(p_season text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; season text := coalesce(p_season, to_char(now() at time zone 'utc', 'YYYY-MM'));
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
 if season !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'Invalid season'; end if;
 perform public.arena_season_reset();
 with month as (
  select mp.player_id, count(*) filter (where mp.won) wins, count(*) matches
  from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
  where not m.vs_bot and to_char(m.played_at at time zone 'utc','YYYY-MM')=season
  group by mp.player_id
 ), ranked as (
  select r.player_id, r.rating, r.matches as rated,
   rank() over (order by r.rating desc) as place
  from public.arena_ratings r join public.arena_profiles p on p.id=r.player_id
  where r.matches >= public.arena_placement_matches() and not p.guest and not p.suspended
 )
 select jsonb_build_object('season', season,
  'rows', coalesce((select jsonb_agg(jsonb_build_object('rank',r.place,'id',p.id,'avatar',p.avatar,'name',p.display_name,'title',t.name,'titleColor',t.color,
     'rating',r.rating,'rankName',public.arena_rank_name(r.rating, r.rated, r.place = 1 and public.arena_is_top_rated(r.player_id)),
     'wins',coalesce(mo.wins,0),'matches',coalesce(mo.matches,0),'me',r.player_id=auth.uid()) order by r.place, p.display_name)
     from (select * from ranked order by place limit 20) r join public.arena_profiles p on p.id=r.player_id
     left join public.arena_titles t on t.id=p.equipped_title and t.active
     left join month mo on mo.player_id=r.player_id),'[]'::jsonb),
  'unranked', coalesce((select jsonb_agg(jsonb_build_object('name',p.display_name,'left',public.arena_placement_matches()-r.matches) order by r.matches desc, p.display_name)
     from public.arena_ratings r join public.arena_profiles p on p.id=r.player_id
     where r.matches between 1 and public.arena_placement_matches()-1 and not p.guest and not p.suspended),'[]'::jsonb),
  'me', (select jsonb_build_object('rank',rk.place,'wins',coalesce(mo.wins,0),'matches',coalesce(mo.matches,0))
     from (select auth.uid() as id) me left join ranked rk on rk.player_id=me.id left join month mo on mo.player_id=me.id
     where rk.place is not null or mo.matches is not null),
  'rating', public.arena_rating_of(auth.uid()))
 into result;
 return result;
end; $$;
revoke all on function public.arena_leaderboard(text) from public, anon;
grant execute on function public.arena_leaderboard(text) to authenticated;

-- A player's avatar by id (null: the default; suspended players: none).
create or replace function public.arena_avatar_of(p_player uuid) returns text
language sql security definer set search_path = '' stable as $$
 select avatar from public.arena_profiles where id = p_player and not suspended;
$$;
revoke all on function public.arena_avatar_of(uuid) from public, anon, authenticated;
grant execute on function public.arena_avatar_of(uuid) to service_role;

commit;
notify pgrst, 'reload schema';
