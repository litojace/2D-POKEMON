-- The rank road (packages/shared/src/accounts.ts RANK_TIERS, docs/rank-road.md):
-- seven tiers of three steps on the rating players already have, in place of
-- the ten ranks from 006.
--
--   Sprout  III 0     II 900   I 950
--   Spark   III 1000  II 1035  I 1070    100 coins
--   Flare   III 1105  II 1140  I 1175    150
--   Tempest III 1210  II 1250  I 1290    250
--   Prism   III 1330  II 1370  I 1410    400
--   Nova    III 1450  II 1500  I 1550    600
--   Legend  III 1600  II 1675  I 1750   1000
--
-- What stays: every rating, every match, and every title a player earned
-- under the old names (Newbie to Legendary Grandmaster). Those titles stay
-- in arena_titles and with their owners; only the ladder stops pointing at
-- them, so nobody earns them from here on.
--
-- What is new:
--   - a title per tier, kept for good once the tier is reached, and the
--     tier's coins, once (coin ledger reason 'rank-tier', ref the tier);
--   - a shield: reaching a higher tier gives one. The first loss that would
--     drop the player out of that tier leaves them on its first step
--     instead, and uses the shield up;
--   - the top rank no longer needs first place on the leaderboard.
--
-- Run after 20261126150000_daily_gift.sql. Safe to run again: the ladder
-- is written by name, titles and coins are given once, functions replaced.
begin;

alter table public.arena_rank_ladder add column if not exists tier smallint;
alter table public.arena_rank_ladder add column if not exists step smallint;
alter table public.arena_rank_ladder add column if not exists coins integer not null default 0;
-- The tier a shield protects (1-7), or null.
alter table public.arena_ratings add column if not exists shield smallint;
-- Whether a match's loss was held by the shield (for the result screen).
alter table public.arena_rating_changes add column if not exists shielded boolean not null default false;

insert into public.arena_titles(name, description, color, active) values
 ('Sprout', 'Rank road: finished the placement matches.', '#8ad66f', true),
 ('Spark', 'Rank road: reached Spark (1000 rating).', '#ffd65b', true),
 ('Flare', 'Rank road: reached Flare (1105 rating).', '#ff8a4c', true),
 ('Tempest', 'Rank road: reached Tempest (1210 rating).', '#50dbe9', true),
 ('Prism', 'Rank road: reached Prism (1330 rating).', '#c68bff', true),
 ('Nova', 'Rank road: reached Nova (1450 rating).', '#ff697f', true),
 ('Legend', 'Rank road: reached Legend (1600 rating).', '#ffe08a', true)
on conflict (name) do nothing;

-- The old ranks leave the ladder (their titles stay where they are).
delete from public.arena_rank_ladder
 where name in ('Newbie', 'Pupil', 'Specialist', 'Expert', 'Candidate Master', 'Master',
  'International Master', 'Grandmaster', 'International Grandmaster', 'Legendary Grandmaster');
insert into public.arena_rank_ladder(name, min_rating, sort, title_id, tier, step, coins)
select l.tier_name || ' ' || l.step_name, l.min_rating, l.sort, t.id, l.tier, l.step, l.coins
from (values
 ('Sprout', 'III', 0, 1, 1, 0, 0), ('Sprout', 'II', 900, 2, 1, 1, 0), ('Sprout', 'I', 950, 3, 1, 2, 0),
 ('Spark', 'III', 1000, 4, 2, 0, 100), ('Spark', 'II', 1035, 5, 2, 1, 100), ('Spark', 'I', 1070, 6, 2, 2, 100),
 ('Flare', 'III', 1105, 7, 3, 0, 150), ('Flare', 'II', 1140, 8, 3, 1, 150), ('Flare', 'I', 1175, 9, 3, 2, 150),
 ('Tempest', 'III', 1210, 10, 4, 0, 250), ('Tempest', 'II', 1250, 11, 4, 1, 250), ('Tempest', 'I', 1290, 12, 4, 2, 250),
 ('Prism', 'III', 1330, 13, 5, 0, 400), ('Prism', 'II', 1370, 14, 5, 1, 400), ('Prism', 'I', 1410, 15, 5, 2, 400),
 ('Nova', 'III', 1450, 16, 6, 0, 600), ('Nova', 'II', 1500, 17, 6, 1, 600), ('Nova', 'I', 1550, 18, 6, 2, 600),
 ('Legend', 'III', 1600, 19, 7, 0, 1000), ('Legend', 'II', 1675, 20, 7, 1, 1000), ('Legend', 'I', 1750, 21, 7, 2, 1000)
) as l(tier_name, step_name, min_rating, sort, tier, step, coins)
left join public.arena_titles t on t.name = l.tier_name
on conflict (name) do update set
 min_rating = excluded.min_rating, sort = excluded.sort, title_id = excluded.title_id,
 tier = excluded.tier, step = excluded.step, coins = excluded.coins;

-- The rank for a rating ("Spark II"), by rating alone. `p_top` is kept for
-- the callers that pass it (the leaderboard): the first ladder's highest
-- rank needed first place.
create or replace function public.arena_rank_name(p_rating integer, p_matches integer, p_top boolean) returns text
language sql stable security definer set search_path='' as $$
 select case when p_matches < public.arena_placement_matches() then 'Unranked' else
  (select l.name from public.arena_rank_ladder l
   where l.min_rating <= p_rating order by l.sort desc limit 1) end;
$$;

-- The tier (1-7) a rating stands in, and the rating a tier starts at.
create or replace function public.arena_rank_tier(p_rating integer) returns integer
language sql stable security definer set search_path='' as $$
 select coalesce((select l.tier::integer from public.arena_rank_ladder l
  where l.min_rating <= p_rating and l.tier is not null order by l.sort desc limit 1), 1);
$$;
create or replace function public.arena_rank_tier_floor(p_tier integer) returns integer
language sql stable security definer set search_path='' as $$
 select coalesce((select min(l.min_rating) from public.arena_rank_ladder l where l.tier = p_tier), 0);
$$;

-- A ranked player's tier titles (kept for good) and each reached tier's
-- coins, once.
create or replace function public.arena_grant_rank_titles(p_player uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r record; t record;
begin
 select * into r from public.arena_ratings where player_id=p_player;
 if not found or r.matches < public.arena_placement_matches() then return; end if;
 insert into public.arena_player_titles(player_id, title_id)
 select distinct p_player, l.title_id from public.arena_rank_ladder l
 where l.title_id is not null and l.min_rating <= r.rating
 on conflict do nothing;
 for t in select l.tier, max(l.coins) as coins from public.arena_rank_ladder l
   where l.tier is not null and l.min_rating <= r.rating group by l.tier having max(l.coins) > 0 loop
  perform public.arena_grant(p_player, t.coins, 'rank-tier', t.tier::text, public.arena_today());
 end loop;
end; $$;

-- Update ratings for a confirmed player-vs-player match (bots: no change).
-- As migration 065, with the shield where each new rating is written.
create or replace function public.arena_apply_ratings(p_match_id text, p_summary jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare
 pl record; op record; winner integer; mode text := p_summary->>'mode';
 k numeric; total numeric; n integer; e numeric; s numeric; my_avg numeric; their_avg numeric; delta integer;
 placement integer := public.arena_placement_matches();
 before integer; final integer; old_tier integer; new_tier integer; held smallint; saved boolean;
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
  k := case when pl.matches < placement then 40 else 24 end;
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
  before := round(pl.rating)::int;
  final := pl.new_rating;
  saved := false;
  -- The shield (ranked players only: placement matches have no rank yet).
  select r.shield into held from public.arena_ratings r where r.player_id = pl.player_id;
  if pl.matches >= placement then
   old_tier := public.arena_rank_tier(before);
   new_tier := public.arena_rank_tier(final);
   if new_tier > old_tier then
    -- Promoted: one shield for the tier just reached.
    held := new_tier;
   elsif new_tier < old_tier and held is not null and held = old_tier then
    -- The loss that would drop them out of it: held on its first step.
    final := public.arena_rank_tier_floor(old_tier);
    held := null;
    saved := true;
   end if;
  end if;
  insert into public.arena_rating_changes(match_id, player_id, before, after, shielded)
   values (p_match_id, pl.player_id, before, final, saved) on conflict do nothing;
  update public.arena_ratings set rating = final, matches = matches + 1,
   peak = greatest(peak, final), shield = held, updated_at = now() where player_id = pl.player_id;
 end loop;
 for pl in select * from arena_rating_work loop
  perform public.arena_grant_rank_titles(pl.player_id);
 end loop;
end; $$;

-- A match report (migration 006) also says when the shield held the loss.
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
   'previousRank', public.arena_rank_name(change.before, (rating->>'matches')::int - 1, false),
   'shielded', change.shielded);
 end if;
 return jsonb_build_object('confirmed', confirmed,
  'records', public.arena_records(array(select u.id from unnest(humans) as u(id) where u.id<>auth.uid())),
  'achievements', coalesce((select jsonb_agg(a.name order by a.sort) from public.arena_player_achievements e
     join public.arena_achievements a on a.id=e.achievement_id
     where e.player_id=auth.uid() and e.earned_at > now() - interval '5 minutes'),'[]'::jsonb),
  'rating', rating);
end; $$;

-- A player's rating, rank, the next rank to reach, and whether a shield
-- holds them in their tier.
create or replace function public.arena_rating_of(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r record; current_rank text; upcoming record; ranked boolean;
begin
 select * into r from public.arena_ratings where player_id=p_player;
 if not found then
  return jsonb_build_object('rating',1000,'matches',0,'peak',1000,'rank','Unranked',
   'placementLeft',public.arena_placement_matches(),'next',null,'shield',false);
 end if;
 ranked := r.matches >= public.arena_placement_matches();
 current_rank := public.arena_rank_name(r.rating, r.matches, false);
 select l.name, l.min_rating into upcoming from public.arena_rank_ladder l
  where l.min_rating > r.rating order by l.sort limit 1;
 return jsonb_build_object('rating',r.rating,'matches',r.matches,'peak',r.peak,'rank',current_rank,
  'placementLeft',greatest(0, public.arena_placement_matches() - r.matches),
  'next', case when upcoming.name is null then null
   else jsonb_build_object('name',upcoming.name,'at',upcoming.min_rating) end,
  'shield', ranked and r.shield is not null and r.shield = public.arena_rank_tier(r.rating));
end; $$;

revoke all on function public.arena_rank_tier(integer), public.arena_rank_tier_floor(integer)
 from public, anon, authenticated;

-- Players already ranked: their tier's title and coins now, not at their
-- next match.
do $$
declare p record;
begin
 for p in select player_id from public.arena_ratings
   where matches >= public.arena_placement_matches() loop
  perform public.arena_grant_rank_titles(p.player_id);
 end loop;
end $$;

commit;
notify pgrst, 'reload schema';
