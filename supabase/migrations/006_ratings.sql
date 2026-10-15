-- Skill ratings and the rank ladder. Run after 005_friends.sql.
--
-- Everyone starts at 1000. Confirmed player-vs-player matches move ratings
-- (Elo): beating stronger players earns more, beating weaker players less.
-- The first 5 rated matches are placement (bigger swings, shown as Unranked).
-- Reaching a rank grants its title for good; the current rank can drop.
-- Each month ratings move a quarter of the way back towards 1000.
begin;

create table if not exists public.arena_ratings (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  rating integer not null default 1000,
  matches integer not null default 0,
  peak integer not null default 1000,
  updated_at timestamptz not null default now()
);
create table if not exists public.arena_rating_changes (
  match_id text not null,
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  before integer not null,
  after integer not null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create table if not exists public.arena_rating_seasons (
  season text primary key,
  applied_at timestamptz not null default now()
);
create table if not exists public.arena_rank_ladder (
  name text primary key,
  min_rating integer not null,
  sort integer not null unique,
  title_id uuid references public.arena_titles(id) on delete set null
);
alter table public.arena_ratings enable row level security;
alter table public.arena_rating_changes enable row level security;
alter table public.arena_rating_seasons enable row level security;
alter table public.arena_rank_ladder enable row level security;
revoke all on public.arena_ratings, public.arena_rating_changes, public.arena_rating_seasons,
  public.arena_rank_ladder from anon, authenticated;

-- The ladder's titles (existing ones with these names are reused).
insert into public.arena_titles(name, description, color, active) values
 ('Newbie', 'Rank: rating under 950.', '#a9b4c9', true),
 ('Pupil', 'Rank: reached a 950 rating.', '#65d38a', true),
 ('Specialist', 'Rank: reached a 1000 rating.', '#50dbe9', true),
 ('Expert', 'Rank: reached a 1075 rating.', '#719aff', true),
 ('Candidate Master', 'Rank: reached a 1150 rating.', '#c68bff', true),
 ('Master', 'Rank: reached a 1225 rating.', '#ffbc65', true),
 ('International Master', 'Rank: reached a 1300 rating.', '#ffd29a', true),
 ('Grandmaster', 'Rank: reached a 1375 rating.', '#ff697f', true),
 ('International Grandmaster', 'Rank: reached a 1450 rating.', '#ff465f', true),
 ('Legendary Grandmaster', 'Rank: 1550 rating and #1 on the leaderboard.', '#ffd65b', true)
on conflict (name) do nothing;
insert into public.arena_rank_ladder(name, min_rating, sort, title_id)
select l.name, l.min_rating, l.sort, t.id
from (values
 ('Newbie', 0, 1), ('Pupil', 950, 2), ('Specialist', 1000, 3), ('Expert', 1075, 4),
 ('Candidate Master', 1150, 5), ('Master', 1225, 6), ('International Master', 1300, 7),
 ('Grandmaster', 1375, 8), ('International Grandmaster', 1450, 9), ('Legendary Grandmaster', 1550, 10)
) as l(name, min_rating, sort)
left join public.arena_titles t on t.name = l.name
on conflict (name) do nothing;
-- No reset for the month the ladder starts in.
insert into public.arena_rating_seasons(season) values (to_char(now() at time zone 'utc', 'YYYY-MM'))
on conflict do nothing;

-- Placement matches before a player gets a rank.
create or replace function public.arena_placement_matches() returns integer
language sql immutable set search_path='' as $$ select 5 $$;

-- The rank for a rating. Legendary Grandmaster also needs the #1 spot.
create or replace function public.arena_rank_name(p_rating integer, p_matches integer, p_top boolean) returns text
language sql stable security definer set search_path='' as $$
 select case when p_matches < public.arena_placement_matches() then 'Unranked' else
  (select l.name from public.arena_rank_ladder l
   where l.min_rating <= p_rating and (l.name <> 'Legendary Grandmaster' or p_top)
   order by l.sort desc limit 1) end;
$$;

-- Is this player #1 among ranked, non-guest, non-suspended players?
create or replace function public.arena_is_top_rated(p_player uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select r.player_id = p_player from public.arena_ratings r
   join public.arena_profiles p on p.id=r.player_id
   where r.matches >= public.arena_placement_matches() and not p.guest and not p.suspended
   order by r.rating desc, r.updated_at asc limit 1), false);
$$;

-- The monthly soft reset: once per month, every rating moves 25% of the way
-- back to 1000. Peaks and earned titles are untouched.
create or replace function public.arena_season_reset() returns void
language plpgsql security definer set search_path='' as $$
declare this_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
 insert into public.arena_rating_seasons(season) values (this_month) on conflict do nothing;
 if not found then return; end if;
 update public.arena_ratings set rating = round(1000 + (rating - 1000) * 0.75), updated_at = now();
end; $$;

-- Grant every ladder title a ranked player has reached (titles are kept).
create or replace function public.arena_grant_rank_titles(p_player uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r record; top boolean;
begin
 select * into r from public.arena_ratings where player_id=p_player;
 if not found or r.matches < public.arena_placement_matches() then return; end if;
 top := public.arena_is_top_rated(p_player);
 insert into public.arena_player_titles(player_id, title_id)
 select p_player, l.title_id from public.arena_rank_ladder l
 where l.title_id is not null and l.min_rating <= r.rating
   and (l.name <> 'Legendary Grandmaster' or top)
 on conflict do nothing;
end; $$;

-- Update ratings for a confirmed player-vs-player match (bots: no change).
create or replace function public.arena_apply_ratings(p_match_id text, p_summary jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare
 pl record; op record; winner integer; mode text := p_summary->>'mode';
 k numeric; total numeric; n integer; e numeric; s numeric; my_avg numeric; their_avg numeric; delta integer;
begin
 if exists(select 1 from public.arena_rating_changes where match_id=p_match_id) then return; end if;
 if exists(select 1 from jsonb_array_elements(p_summary->'players') as x(v) where x.v->>'account' is null) then return; end if;
 perform public.arena_season_reset();
 winner := case when jsonb_typeof(p_summary->'winnerTeam')='number' then (p_summary->>'winnerTeam')::int end;
 create temporary table if not exists arena_rating_work (
  player_id uuid primary key, team integer, rating numeric, matches integer, wins integer, new_rating integer
 ) on commit drop;
 delete from arena_rating_work;
 insert into public.arena_ratings(player_id)
  select distinct (x.v->>'account')::uuid from jsonb_array_elements(p_summary->'players') as x(v)
  on conflict do nothing;
 insert into arena_rating_work(player_id, team, rating, matches, wins)
  select (x.v->>'account')::uuid, coalesce((x.v->>'team')::int, 0), r.rating, r.matches,
   (select count(*) from jsonb_array_elements(p_summary->'rounds') as y(t)
     where jsonb_typeof(y.t)='number' and (y.t)::text = coalesce(x.v->>'team','-1'))
  from jsonb_array_elements(p_summary->'players') as x(v)
  join public.arena_ratings r on r.player_id = (x.v->>'account')::uuid
  on conflict do nothing;
 for pl in select * from arena_rating_work loop
  k := case when pl.matches < public.arena_placement_matches() then 40 else 24 end;
  if mode = 'teams' then
   -- 2v2: team average against the other team's average; partners move alike.
   select avg(rating) into my_avg from arena_rating_work where team = pl.team;
   select avg(rating) into their_avg from arena_rating_work where team <> pl.team;
   if their_avg is null then continue; end if;
   e := 1 / (1 + power(10, (their_avg - my_avg) / 400));
   s := case when winner = pl.team then 1 when winner is not null then 0 else 0.5 end;
   delta := round(k * (s - e));
  else
   -- 1v1 and free-for-all: a result against each opponent, averaged.
   total := 0; n := 0;
   for op in select * from arena_rating_work where team <> pl.team loop
    e := 1 / (1 + power(10, (op.rating - pl.rating) / 400));
    s := case
     when winner = pl.team then 1
     when winner = op.team then 0
     when pl.wins > op.wins then 1
     when pl.wins < op.wins then 0
     else 0.5 end;
    total := total + (s - e); n := n + 1;
   end loop;
   if n = 0 then continue; end if;
   delta := round(k * total / n);
  end if;
  update arena_rating_work set new_rating = greatest(100, round(pl.rating)::int + delta) where player_id = pl.player_id;
 end loop;
 for pl in select * from arena_rating_work where new_rating is not null loop
  insert into public.arena_rating_changes(match_id, player_id, before, after)
   values (p_match_id, pl.player_id, round(pl.rating)::int, pl.new_rating) on conflict do nothing;
  update public.arena_ratings set rating = pl.new_rating, matches = matches + 1,
   peak = greatest(peak, pl.new_rating), updated_at = now() where player_id = pl.player_id;
 end loop;
 for pl in select * from arena_rating_work loop
  perform public.arena_grant_rank_titles(pl.player_id);
 end loop;
end; $$;

-- A player's rating, rank and the next rank to reach.
create or replace function public.arena_rating_of(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r record; top boolean; current_rank text; upcoming record;
begin
 select * into r from public.arena_ratings where player_id=p_player;
 if not found then
  return jsonb_build_object('rating',1000,'matches',0,'peak',1000,'rank','Unranked',
   'placementLeft',public.arena_placement_matches(),'next',null);
 end if;
 top := public.arena_is_top_rated(p_player);
 current_rank := public.arena_rank_name(r.rating, r.matches, top);
 select l.name, l.min_rating into upcoming from public.arena_rank_ladder l
  where l.min_rating > r.rating or (l.name = 'Legendary Grandmaster' and not top)
  order by l.sort limit 1;
 return jsonb_build_object('rating',r.rating,'matches',r.matches,'peak',r.peak,'rank',current_rank,
  'placementLeft',greatest(0, public.arena_placement_matches() - r.matches),
  'next', case when upcoming.name is null then null
   else jsonb_build_object('name',upcoming.name,'at',upcoming.min_rating) end);
end; $$;

create or replace function public.arena_my_rating() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
 perform public.arena_season_reset();
 return public.arena_rating_of(auth.uid());
end; $$;

-- Match reports now also update ratings and say how yours moved.
create or replace function public.arena_report_match(p_match_id text, p_summary jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare humans uuid[]; agreeing integer; confirmed boolean; pl jsonb; winner jsonb; h uuid; change record; has_change boolean; rating jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.arena_profiles where id=auth.uid() and not suspended) then
  raise exception 'Login required' using errcode='42501'; end if;
 if p_match_id is null or char_length(p_match_id) not between 8 and 64 then raise exception 'Invalid match'; end if;
 if p_summary is null or jsonb_typeof(p_summary)<>'object' or char_length(p_summary::text) > 6000
  or jsonb_typeof(p_summary->'players')<>'array' or jsonb_array_length(p_summary->'players') not between 2 and 4
  or jsonb_typeof(p_summary->'rounds')<>'array' or jsonb_array_length(p_summary->'rounds') > 20
  or coalesce(p_summary->>'mode','') not in ('duel','teams','ffa') then
  raise exception 'Invalid match summary'; end if;
 select array_agg(distinct (x.v->>'account')::uuid) into humans
  from jsonb_array_elements(p_summary->'players') as x(v) where x.v->>'account' is not null;
 if humans is null or not (auth.uid() = any(humans)) then raise exception 'You did not play in this match' using errcode='42501'; end if;
 if exists(select 1 from unnest(humans) u(id) where not exists(select 1 from public.arena_profiles where id=u.id)) then
  raise exception 'Unknown player in match'; end if;
 insert into public.arena_match_reports(match_id, player_id, summary) values(p_match_id, auth.uid(), p_summary)
  on conflict do nothing;
 confirmed := exists(select 1 from public.arena_matches where id=p_match_id);
 if not confirmed then
  select count(*) into agreeing from public.arena_match_reports
   where match_id=p_match_id and summary=p_summary and player_id = any(humans);
  if agreeing = cardinality(humans) then
   winner := p_summary->'winnerTeam';
   insert into public.arena_matches(id, mode, arena, vs_bot, summary)
    values(p_match_id, p_summary->>'mode', left(coalesce(p_summary->>'arena','classic'),32),
     exists(select 1 from jsonb_array_elements(p_summary->'players') as x(v) where x.v->>'account' is null), p_summary);
   for pl in select x.v from jsonb_array_elements(p_summary->'players') as x(v) loop
    if pl->>'account' is not null then
     insert into public.arena_match_players(match_id, player_id, character, team, won, dealt, kos, combos)
      values(p_match_id, (pl->>'account')::uuid, left(coalesce(pl->>'character',''),24), coalesce((pl->>'team')::int,0),
       jsonb_typeof(winner)='number' and (winner)::text = coalesce(pl->>'team','-1'),
       least(greatest(coalesce((pl->>'dealt')::numeric,0),0),100000)::int,
       least(greatest(coalesce((pl->>'kos')::numeric,0),0),100)::int,
       least(greatest(coalesce((pl->>'combos')::numeric,0),0),1000)::int)
      on conflict do nothing;
    end if;
   end loop;
   delete from public.arena_match_reports where match_id=p_match_id;
   confirmed := true;
   perform public.arena_apply_ratings(p_match_id, p_summary);
   foreach h in array humans loop
    perform public.arena_check_achievements(h);
   end loop;
  end if;
 end if;
 delete from public.arena_match_reports where created_at < now() - interval '1 day';
 select * into change from public.arena_rating_changes where match_id=p_match_id and player_id=auth.uid();
 has_change := found;
 rating := public.arena_rating_of(auth.uid());
 if has_change then
  rating := rating || jsonb_build_object('before', change.before,
   'previousRank', public.arena_rank_name(change.before, (rating->>'matches')::int - 1, false));
 end if;
 return jsonb_build_object('confirmed', confirmed,
  'records', public.arena_records(array(select u.id from unnest(humans) as u(id) where u.id<>auth.uid())),
  'achievements', coalesce((select jsonb_agg(a.name order by a.sort) from public.arena_player_achievements e
     join public.arena_achievements a on a.id=e.achievement_id
     where e.player_id=auth.uid() and e.earned_at > now() - interval '5 minutes'),'[]'::jsonb),
  'rating', rating);
end; $$;

-- The leaderboard: ranked players by rating (guests and the suspended left
-- out), with this month's player-vs-player record; then the unranked.
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
  'rows', coalesce((select jsonb_agg(jsonb_build_object('rank',r.place,'name',p.display_name,'title',t.name,'titleColor',t.color,
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

revoke all on function public.arena_placement_matches(), public.arena_rank_name(integer, integer, boolean),
 public.arena_is_top_rated(uuid), public.arena_season_reset(), public.arena_grant_rank_titles(uuid),
 public.arena_apply_ratings(text, jsonb), public.arena_rating_of(uuid), public.arena_my_rating(),
 public.arena_report_match(text, jsonb), public.arena_leaderboard(text) from public, anon, authenticated;
grant execute on function public.arena_my_rating(), public.arena_report_match(text, jsonb),
 public.arena_leaderboard(text) to authenticated;
commit;
notify pgrst, 'reload schema';
