-- Ratings work through the API again (6 Nov 2026).
--
-- Supabase loads pg-safeupdate for API sessions: an UPDATE or DELETE with
-- no WHERE clause is refused ("UPDATE requires a WHERE clause"). Two
-- statements from 006 had none:
--  - arena_season_reset() softens every rating once a month. It first ran on
--    1 November, was refused, and rolled back with the season row it had
--    just inserted, so every later call tried again and failed: the
--    leaderboard, your rating card and the rating update after a match.
--  - arena_apply_ratings() empties its scratch table with a bare DELETE, so
--    every confirmed player-vs-player match report was refused (none was
--    ever saved; bot matches skip ratings and were saved).
-- Both now say which rows they mean. Nothing else changes; run after 064.

create or replace function public.arena_season_reset() returns void
language plpgsql security definer set search_path='' as $$
declare this_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
 insert into public.arena_rating_seasons(season) values (this_month) on conflict do nothing;
 if not found then return; end if;
 update public.arena_ratings set rating = round(1000 + (rating - 1000) * 0.75), updated_at = now()
  where player_id is not null;
end; $$;

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
 delete from arena_rating_work where player_id is not null;
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
