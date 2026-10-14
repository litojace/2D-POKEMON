-- Match history, head-to-head records, achievements (which grant titles),
-- monthly season leaderboards and fighter mastery. Run after 003_titles.sql.
--
-- How a match gets recorded without trusting any single browser: the game
-- server gives every player of a finished match the same summary, and each
-- player's game submits it with their own login. A match only counts once
-- EVERY human in it has submitted the identical summary, so nobody can invent
-- a win against someone else. (Matches against bots need only that one
-- player's report, so they never count towards leaderboards.)
begin;

alter table public.arena_profiles add column if not exists guest boolean not null default false;

create table if not exists public.arena_match_reports (
  match_id text not null check (char_length(match_id) between 8 and 64),
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create table if not exists public.arena_matches (
  id text primary key,
  played_at timestamptz not null default now(),
  mode text not null,
  arena text not null default 'classic',
  vs_bot boolean not null default false,
  summary jsonb not null
);
create index if not exists arena_matches_played on public.arena_matches(played_at desc);
create table if not exists public.arena_match_players (
  match_id text not null references public.arena_matches(id) on delete cascade,
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  character text not null,
  team integer not null,
  won boolean not null,
  dealt integer not null default 0,
  kos integer not null default 0,
  combos integer not null default 0,
  primary key (match_id, player_id)
);
create index if not exists arena_match_players_player on public.arena_match_players(player_id);
create table if not exists public.arena_achievements (
  id text primary key,
  name text not null,
  description text not null,
  title_id uuid references public.arena_titles(id) on delete set null,
  sort integer not null default 0
);
create table if not exists public.arena_player_achievements (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  achievement_id text not null references public.arena_achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (player_id, achievement_id)
);
alter table public.arena_match_reports enable row level security;
alter table public.arena_matches enable row level security;
alter table public.arena_match_players enable row level security;
alter table public.arena_achievements enable row level security;
alter table public.arena_player_achievements enable row level security;
revoke all on public.arena_match_reports, public.arena_matches, public.arena_match_players,
  public.arena_achievements, public.arena_player_achievements from anon, authenticated;

-- Each achievement grants a title of the same name.
insert into public.arena_titles(name, description, color, active) values
 ('First Victory', 'Won a match.', '#9ee6a8', true),
 ('Seasoned Brawler', 'Won 10 matches.', '#7fd3ff', true),
 ('Arena Legend', 'Won 50 matches.', '#ffd166', true),
 ('Flawless', 'Won a match without dropping a round.', '#f5f7ff', true),
 ('Comeback Kid', 'Won a match after losing the first two rounds.', '#ff9f6e', true),
 ('Combo Artist', 'Landed 5 signature combos in one match.', '#c9a7ff', true),
 ('Dynamic Duo', 'Won 10 team matches.', '#6ee7d8', true),
 ('Bot Breaker', 'Beat a Hard bot.', '#ff697f', true),
 ('Sworn Rivals', 'Played 10 matches against the same player.', '#f78fb3', true),
 ('Elemental Master', 'Won a match with every fighter.', '#d5f778', true)
on conflict (name) do nothing;
insert into public.arena_achievements(id, name, description, title_id, sort)
select a.id, a.name, a.description, t.id, a.sort
from (values
 ('first-win', 'First Victory', 'Win a match.', 1),
 ('wins-10', 'Seasoned Brawler', 'Win 10 matches.', 2),
 ('wins-50', 'Arena Legend', 'Win 50 matches.', 3),
 ('flawless', 'Flawless', 'Win a match without dropping a round.', 4),
 ('comeback', 'Comeback Kid', 'Win after losing the first two rounds.', 5),
 ('combo-artist', 'Combo Artist', 'Land 5 signature combos in one match.', 6),
 ('duo', 'Dynamic Duo', 'Win 10 team (2v2) matches.', 7),
 ('bot-breaker', 'Bot Breaker', 'Beat a Hard bot.', 8),
 ('rivals', 'Sworn Rivals', 'Play 10 matches against the same player.', 9),
 ('all-fighters', 'Elemental Master', 'Win a match with every fighter.', 10)
) as a(id, name, description, sort)
left join public.arena_titles t on t.name = a.name
on conflict (id) do nothing;

-- arena_me now also records whether this is a guest (anonymous) login.
create or replace function public.arena_me() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; candidate text; is_guest boolean;
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
 is_guest := coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'is_anonymous')::boolean, false);
 select left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),
   case when is_guest then 'Guest ' || upper(substr(replace(u.id::text,'-',''),1,4)) else 'Trainer' end),20)
   into candidate from auth.users u where u.id=auth.uid();
 if candidate is null then raise exception 'Account not found' using errcode='42501'; end if;
 insert into public.arena_profiles(id,display_name,guest) values(auth.uid(),candidate,is_guest) on conflict(id) do nothing;
 update public.arena_profiles set guest=is_guest where id=auth.uid() and guest<>is_guest;
 select jsonb_build_object('id',p.id,'displayName',p.display_name,'suspended',p.suspended,'isAdmin',public.arena_is_admin(),'guest',p.guest,
 'title',t.name,'titleColor',t.color,'ownedTitles',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'description',o.description,'color',o.color,'active',o.active) order by o.name) from public.arena_titles o join public.arena_player_titles g on g.title_id=o.id where g.player_id=p.id and o.active),'[]'::jsonb)) into result
 from public.arena_profiles p left join public.arena_player_titles g on g.player_id=p.id and g.title_id=p.equipped_title left join public.arena_titles t on t.id=g.title_id and t.active where p.id=auth.uid();
 return result;
end; $$;

-- Award any achievements a player now qualifies for; returns the new ones' names.
-- Win-count achievements need player-vs-player wins (a bot match is confirmed by
-- its one human alone, so it can't be trusted for those).
create or replace function public.arena_check_achievements(p_player uuid) returns text[]
language plpgsql security definer set search_path='' as $$
declare earned text[] := '{}'; a record; ok boolean;
begin
 for a in select * from public.arena_achievements x
   where not exists(select 1 from public.arena_player_achievements e where e.player_id=p_player and e.achievement_id=x.id)
   order by x.sort loop
  ok := case a.id
   when 'first-win' then exists(select 1 from public.arena_match_players where player_id=p_player and won)
   when 'wins-10' then (select count(*) from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
      where mp.player_id=p_player and mp.won and not m.vs_bot) >= 10
   when 'wins-50' then (select count(*) from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
      where mp.player_id=p_player and mp.won and not m.vs_bot) >= 50
   when 'flawless' then exists(select 1 from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
      where mp.player_id=p_player and mp.won and jsonb_array_length(m.summary->'rounds') > 0
      and not exists(select 1 from jsonb_array_elements(m.summary->'rounds') as r(v) where r.v <> to_jsonb(mp.team)))
   when 'comeback' then exists(select 1 from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
      where mp.player_id=p_player and mp.won and jsonb_array_length(m.summary->'rounds') >= 2
      and jsonb_typeof(m.summary->'rounds'->0)='number' and jsonb_typeof(m.summary->'rounds'->1)='number'
      and (m.summary->'rounds'->>0)::int <> mp.team and (m.summary->'rounds'->>1)::int <> mp.team)
   when 'combo-artist' then exists(select 1 from public.arena_match_players where player_id=p_player and combos >= 5)
   when 'duo' then (select count(*) from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
      where mp.player_id=p_player and mp.won and m.mode='teams' and not m.vs_bot) >= 10
   when 'bot-breaker' then exists(select 1 from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
      where mp.player_id=p_player and mp.won and m.summary->>'bot'='hard')
   when 'rivals' then exists(select 1 from public.arena_match_players me join public.arena_match_players o
      on o.match_id=me.match_id and o.player_id<>me.player_id
      where me.player_id=p_player group by o.player_id having count(*) >= 10)
   when 'all-fighters' then (select count(distinct mp.character) from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
      where mp.player_id=p_player and mp.won and not m.vs_bot) >= 8
   else false end;
  if ok then
   insert into public.arena_player_achievements(player_id, achievement_id) values(p_player, a.id) on conflict do nothing;
   if a.title_id is not null then
    insert into public.arena_player_titles(player_id, title_id) values(p_player, a.title_id) on conflict do nothing;
   end if;
   earned := earned || a.name;
  end if;
 end loop;
 return earned;
end; $$;

-- Head-to-head between the caller and each given player: confirmed matches
-- where they were on opposite sides.
create or replace function public.arena_records(p_opponents uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
 if p_opponents is null or cardinality(p_opponents) > 8 then raise exception 'Invalid players'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',pr.display_name,
   'wins',(select count(*) from public.arena_match_players a join public.arena_match_players b on b.match_id=a.match_id
      where a.player_id=auth.uid() and b.player_id=o.id and a.team<>b.team and a.won),
   'losses',(select count(*) from public.arena_match_players a join public.arena_match_players b on b.match_id=a.match_id
      where a.player_id=auth.uid() and b.player_id=o.id and a.team<>b.team and b.won),
   'together',(select count(*) from public.arena_match_players a join public.arena_match_players b on b.match_id=a.match_id
      where a.player_id=auth.uid() and b.player_id=o.id and a.team=b.team))),'[]'::jsonb) into result
 from unnest(p_opponents) as o(id) join public.arena_profiles pr on pr.id=o.id where o.id<>auth.uid();
 return result;
end; $$;

-- Submit a finished match's summary. Returns whether it is now confirmed,
-- the caller's head-to-head records and achievements earned in the last minutes.
create or replace function public.arena_report_match(p_match_id text, p_summary jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare humans uuid[]; agreeing integer; confirmed boolean; pl jsonb; winner jsonb; h uuid;
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
   foreach h in array humans loop
    perform public.arena_check_achievements(h);
   end loop;
  end if;
 end if;
 -- Unconfirmed reports older than a day can never complete: tidy them.
 delete from public.arena_match_reports where created_at < now() - interval '1 day';
 return jsonb_build_object('confirmed', confirmed,
  'records', public.arena_records(array(select u.id from unnest(humans) as u(id) where u.id<>auth.uid())),
  -- Achievements earned in the last few minutes, so whoever reported first
  -- (before the match was confirmed) still hears about theirs on a re-check.
  'achievements', coalesce((select jsonb_agg(a.name order by a.sort) from public.arena_player_achievements e
     join public.arena_achievements a on a.id=e.achievement_id
     where e.player_id=auth.uid() and e.earned_at > now() - interval '5 minutes'),'[]'::jsonb));
end; $$;

-- The caller's progress: totals, achievements, per-fighter mastery, this season.
create or replace function public.arena_my_progress() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; season text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
 select jsonb_build_object(
  'matches', (select count(*) from public.arena_match_players where player_id=auth.uid()),
  'wins', (select count(*) from public.arena_match_players where player_id=auth.uid() and won),
  'achievements', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'description',a.description,
     'earnedAt',e.earned_at) order by a.sort) from public.arena_achievements a
     left join public.arena_player_achievements e on e.achievement_id=a.id and e.player_id=auth.uid()),'[]'::jsonb),
  'fighters', coalesce((select jsonb_object_agg(character, jsonb_build_object('matches',n,'wins',w)) from
     (select character, count(*) n, count(*) filter (where won) w from public.arena_match_players
      where player_id=auth.uid() group by character) f),'{}'::jsonb),
  'season', jsonb_build_object('id', season,
     'matches', (select count(*) from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
        where mp.player_id=auth.uid() and not m.vs_bot and to_char(m.played_at at time zone 'utc','YYYY-MM')=season),
     'wins', (select count(*) from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
        where mp.player_id=auth.uid() and mp.won and not m.vs_bot and to_char(m.played_at at time zone 'utc','YYYY-MM')=season))
 ) into result;
 return result;
end; $$;

-- Monthly season standings: player-vs-player wins (bots and guests excluded).
create or replace function public.arena_leaderboard(p_season text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; season text := coalesce(p_season, to_char(now() at time zone 'utc', 'YYYY-MM'));
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
 if season !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'Invalid season'; end if;
 with standings as (
  select mp.player_id, count(*) filter (where mp.won) wins, count(*) matches
  from public.arena_match_players mp join public.arena_matches m on m.id=mp.match_id
  join public.arena_profiles p on p.id=mp.player_id
  where not m.vs_bot and not p.guest and not p.suspended and to_char(m.played_at at time zone 'utc','YYYY-MM')=season
  group by mp.player_id
 ), ranked as (
  select s.*, rank() over (order by s.wins desc, (s.wins::numeric / greatest(s.matches,1)) desc) as place from standings s
 )
 select jsonb_build_object('season', season,
  'rows', coalesce((select jsonb_agg(jsonb_build_object('rank',r.place,'name',p.display_name,'title',t.name,'titleColor',t.color,
     'wins',r.wins,'matches',r.matches,'me',r.player_id=auth.uid()) order by r.place, p.display_name)
     from (select * from ranked order by place limit 20) r join public.arena_profiles p on p.id=r.player_id
     left join public.arena_titles t on t.id=p.equipped_title and t.active),'[]'::jsonb),
  'me', (select jsonb_build_object('rank',place,'wins',wins,'matches',matches) from ranked where player_id=auth.uid()))
 into result;
 return result;
end; $$;

revoke all on function public.arena_check_achievements(uuid), public.arena_records(uuid[]),
 public.arena_report_match(text, jsonb), public.arena_my_progress(), public.arena_leaderboard(text) from public, anon, authenticated;
grant execute on function public.arena_records(uuid[]), public.arena_report_match(text, jsonb),
 public.arena_my_progress(), public.arena_leaderboard(text) to authenticated;
commit;
notify pgrst, 'reload schema';
