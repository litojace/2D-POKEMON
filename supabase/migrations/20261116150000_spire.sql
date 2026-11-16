-- The Spire (season 0): a climb of Echo floors in the Raid Hub.
-- Run after 20261115230000_chat_friend_messages.sql. Safe to run again.
--
--   - arena_spire_progress: each player's highest floor, checkpoint
--     (the first floor of the zone they reached: 1, 11, 21 …) and climbs;
--   - arena_spire_runs / arena_spire_players: one row per climb (its
--     highest floor so far) and who climbed;
--   - arena_spire_claims: one-time first-clear rewards, once per player
--     and floor;
--   - arena_spire_rewards: what each floor gives (kept identical to
--     SPIRE_REWARDS in packages/shared/src/spire.ts; a unit test compares);
--   - arena_record_spire_floor(p): the game server saves each floor a climb
--     clears, at once (service role only). A first clear pays its coins
--     through the coin ledger (arena_grant: never twice) and its titles;
--   - arena_spire_start(p_players): the game server reads each climber's
--     checkpoint and raid clears before a climb (service role only);
--   - arena_spire_progress(): the signed-in player's climb (GET /api/spire).
-- Until this runs, the Spire is playable from floor 1 and saves nothing.

begin;

create table if not exists public.arena_spire_progress (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  season integer not null default 0,
  highest_floor integer not null default 0 check (highest_floor between 0 and 1000),
  checkpoint integer not null default 1 check (checkpoint >= 1),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, season)
);
create table if not exists public.arena_spire_runs (
  id uuid primary key,
  season integer not null default 0,
  start_floor integer not null check (start_floor >= 1),
  floor_reached integer not null check (floor_reached >= 1),
  party_size integer not null check (party_size between 1 and 4),
  seconds numeric not null check (seconds > 0),
  blessings jsonb not null default '{}'::jsonb,
  receipt jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.arena_spire_players (
  run_id uuid not null references public.arena_spire_runs(id) on delete cascade,
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  character text not null,
  primary key (run_id, player_id)
);
create index if not exists arena_spire_player_lookup on public.arena_spire_players(player_id);
create table if not exists public.arena_spire_claims (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  season integer not null,
  floor integer not null,
  run_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (player_id, season, floor)
);
create table if not exists public.arena_spire_rewards (
  season integer not null,
  floor integer not null,
  kind text not null check (kind in ('coins', 'title')),
  item text not null,
  amount integer not null default 0 check (amount >= 0),
  primary key (season, floor, kind, item)
);

alter table public.arena_spire_progress enable row level security;
alter table public.arena_spire_runs enable row level security;
alter table public.arena_spire_players enable row level security;
alter table public.arena_spire_claims enable row level security;
alter table public.arena_spire_rewards enable row level security;
revoke all on public.arena_spire_progress, public.arena_spire_runs,
  public.arena_spire_players, public.arena_spire_claims,
  public.arena_spire_rewards from anon, authenticated;

-- Season 0's first-clear rewards (SPIRE_REWARDS, zone 1; later zones add
-- theirs in their own migrations, which running this again leaves alone).
delete from public.arena_spire_rewards where season = 0 and floor between 1 and 10;
insert into public.arena_spire_rewards(season, floor, kind, item, amount) values
  (0, 1, 'coins', 'coins', 20),
  (0, 2, 'coins', 'coins', 20),
  (0, 3, 'coins', 'coins', 25),
  (0, 4, 'coins', 'coins', 25),
  (0, 5, 'coins', 'coins', 60),
  (0, 5, 'title', 'Echo Breaker', 0),
  (0, 6, 'coins', 'coins', 30),
  (0, 7, 'coins', 'coins', 30),
  (0, 8, 'coins', 'coins', 35),
  (0, 9, 'coins', 'coins', 35),
  (0, 10, 'coins', 'coins', 120),
  (0, 10, 'title', 'Earthshaker of the Spire', 0);

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Echo Breaker', 'Beat the Echo Captain on floor 5 of the Spire.', '#b79cff'),
  ('Earthshaker of the Spire', 'Clear floor 10 of the Spire: the Ascendant Cragmuff.', '#c9a46a')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

-- Raid clears per boss for a player (the Spire opens with Cragmuff's).
create or replace function public.arena_spire_clears(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_object_agg(b.boss, b.clears) from (
    select r.boss, count(*) as clears from public.arena_raid_players rp
    join public.arena_raid_runs r on r.id = rp.run_id
    where rp.player_id = pid and r.result = 'victory' group by r.boss
  ) b), '{}'::jsonb);
$$;
revoke all on function public.arena_spire_clears(uuid) from public, anon, authenticated, service_role;

-- The checkpoint after clearing up to `highest`: the first floor of the
-- zone it reaches, but only a zone that exists (has reward rows). Clearing
-- floor 10 (zone 1's boss) keeps checkpoint 1 until zone 2's floors are
-- added; that migration recomputes checkpoints with this function.
create or replace function public.arena_spire_checkpoint(s integer, highest integer) returns integer
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.arena_spire_rewards r
                 where r.season = s and r.floor = (greatest(highest, 0) / 10) * 10 + 1)
      then (greatest(highest, 0) / 10) * 10 + 1
    else ((greatest(highest, 1) - 1) / 10) * 10 + 1
  end;
$$;
revoke all on function public.arena_spire_checkpoint(integer, integer) from public, anon, authenticated, service_role;

-- One cleared floor of a climb (the game server's receipt).
create or replace function public.arena_record_spire_floor(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  run uuid = (p->>'runId')::uuid;
  s integer = coalesce((p->>'season')::integer, 0);
  f integer = (p->>'floor')::integer;
  d date = public.arena_today();
  fresh boolean;
  pl jsonb;
  pid uuid;
  inserted integer;
  coins integer;
  titles jsonb;
  claims jsonb = '[]'::jsonb;
  reward record;
begin
  if run is null or f is null or f < 1 or f > 1000 or s < 0 then
    raise exception 'Invalid Spire floor';
  end if;
  if jsonb_typeof(p->'players') is distinct from 'array'
     or jsonb_array_length(p->'players') not between 1 and 4 then
    raise exception 'Invalid Spire party';
  end if;
  insert into public.arena_spire_runs(id, season, start_floor, floor_reached, party_size, seconds, blessings, receipt)
  values (run, s, greatest(1, coalesce((p->>'startFloor')::integer, 1)), f,
          least(4, greatest(1, coalesce((p->>'partySize')::integer, 1))),
          greatest(0.001, coalesce((p->>'seconds')::numeric, 0.001)),
          coalesce(p->'blessings', '{}'::jsonb), p)
  on conflict (id) do update set
    floor_reached = greatest(public.arena_spire_runs.floor_reached, excluded.floor_reached),
    seconds = greatest(public.arena_spire_runs.seconds, excluded.seconds),
    blessings = excluded.blessings,
    receipt = excluded.receipt
  returning (xmax = 0) into fresh;
  for pl in select value from jsonb_array_elements(p->'players') loop
    pid = (pl->>'accountId')::uuid;
    continue when pid is null or not exists (select 1 from public.arena_profiles where id = pid);
    insert into public.arena_spire_players(run_id, player_id, character)
    values (run, pid, left(coalesce(pl->>'character', ''), 32)) on conflict do nothing;
    insert into public.arena_spire_progress(player_id, season, highest_floor, checkpoint, attempts)
    values (pid, s, f, public.arena_spire_checkpoint(s, f), 1)
    on conflict (player_id, season) do update set
      highest_floor = greatest(public.arena_spire_progress.highest_floor, excluded.highest_floor),
      checkpoint = public.arena_spire_checkpoint(s, greatest(public.arena_spire_progress.highest_floor, excluded.highest_floor)),
      attempts = public.arena_spire_progress.attempts + case when fresh then 1 else 0 end,
      updated_at = now();
    insert into public.arena_spire_claims(player_id, season, floor, run_id)
    values (pid, s, f, run) on conflict do nothing;
    get diagnostics inserted = row_count;
    continue when inserted = 0;
    coins = 0;
    titles = '[]'::jsonb;
    for reward in select * from public.arena_spire_rewards r where r.season = s and r.floor = f loop
      if reward.kind = 'coins' and reward.amount > 0 then
        if public.arena_grant(pid, reward.amount, 'spire', 's' || s || ':f' || f, d) then
          coins = coins + reward.amount;
        end if;
      elsif reward.kind = 'title' then
        insert into public.arena_player_titles(player_id, title_id)
        select pid, t.id from public.arena_titles t where t.name = reward.item and t.active
        on conflict do nothing;
        titles = titles || to_jsonb(reward.item);
      end if;
    end loop;
    claims = claims || jsonb_build_object('accountId', pid, 'floor', f, 'coins', coins, 'titles', titles);
  end loop;
  return jsonb_build_object('newClaims', claims);
end; $$;
revoke all on function public.arena_record_spire_floor(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_spire_floor(jsonb) to service_role;

-- Each climber's checkpoint and raid clears, in the order asked.
create or replace function public.arena_spire_start(p_players uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id,
      'checkpoint', coalesce(sp.checkpoint, 1),
      'highestFloor', coalesce(sp.highest_floor, 0),
      'clears', public.arena_spire_clears(u.id)
    ) order by u.ord), '[]'::jsonb)
  from unnest(p_players) with ordinality as u(id, ord)
  left join public.arena_spire_progress sp on sp.player_id = u.id and sp.season = 0;
$$;
revoke all on function public.arena_spire_start(uuid[]) from public, anon, authenticated;
grant execute on function public.arena_spire_start(uuid[]) to service_role;

-- The signed-in player's climb.
create or replace function public.arena_spire_progress() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid = auth.uid(); sp public.arena_spire_progress;
begin
  if me is null then raise exception 'Login required'; end if;
  select * into sp from public.arena_spire_progress where player_id = me and season = 0;
  return jsonb_build_object(
    'season', 0,
    'highestFloor', coalesce(sp.highest_floor, 0),
    'checkpoint', coalesce(sp.checkpoint, 1),
    'attempts', coalesce(sp.attempts, 0),
    'claimed', coalesce((select jsonb_agg(c.floor order by c.floor)
                         from public.arena_spire_claims c
                         where c.player_id = me and c.season = 0), '[]'::jsonb),
    'clears', public.arena_spire_clears(me));
end; $$;
revoke all on function public.arena_spire_progress() from public, anon;
grant execute on function public.arena_spire_progress() to authenticated;

commit;
