-- Raid Hub: a roster of bosses, Raid of the Day, a Victory slot, and rewards
-- defined as rules in a table, so a new boss needs rows, not new functions.
-- Like 007/008, records are written ONLY by the game server's service-role
-- client, and raids never touch Elo or PvP boards. Run after 001–008.
begin;

-- The roster. Only playable bosses can be recorded.
create table if not exists public.arena_raid_bosses (
  id text primary key,
  name text not null,
  playable boolean not null default false
);
insert into public.arena_raid_bosses(id, name, playable) values
  ('grumblecrag', 'Grumblecrag', true),
  ('tidewyrm', 'Tidewyrm', false),
  ('gloomshade', 'Gloomshade', false),
  ('somnara', 'Somnara', false),
  ('prismatail', 'Prismatail', false),
  ('emberwing', 'Emberwing', false),
  ('storm-twins', 'Storm Twins', false)
on conflict (id) do update set name = excluded.name;

-- Every reward and the rule that earns it. Kept identical to RAID_REWARDS in
-- packages/shared/src/raid.ts (a unit test compares them).
create table if not exists public.arena_raid_rewards (
  id text primary key,
  boss text references public.arena_raid_bosses(id),
  slot text not null check (slot in ('skin', 'aura', 'entrance', 'frame', 'victory', 'title')),
  name text not null,
  rule jsonb not null,
  active boolean not null default true
);
insert into public.arena_raid_rewards(id, boss, slot, name, rule) values
  ('cragbreaker', 'grumblecrag', 'title', 'Cragbreaker', '{"kind":"clears","n":1}'),
  ('cragbound', 'grumblecrag', 'skin', 'Cragbound colors', '{"kind":"clears","n":5}'),
  ('cragstone', 'grumblecrag', 'skin', 'Cragstone skin', '{"kind":"clears","n":10}'),
  ('mountainborn', 'grumblecrag', 'entrance', 'Mountainborn entrance', '{"kind":"peril","n":2}'),
  ('mountain-conqueror', 'grumblecrag', 'title', 'Mountain Conqueror', '{"kind":"peril","n":3}'),
  ('conqueror', 'grumblecrag', 'frame', 'Conqueror frame', '{"kind":"peril","n":3}'),
  ('mountain-aura', 'grumblecrag', 'aura', 'Mountain aura', '{"kind":"flawless","peril":3}'),
  ('rockslide-flex', 'grumblecrag', 'victory', 'Rockslide Flex', '{"kind":"feat"}'),
  ('avalanche', 'grumblecrag', 'title', 'Avalanche', '{"kind":"speed","peril":2,"party":1,"seconds":210}'),
  ('lone-mountain', 'grumblecrag', 'title', 'Lone Mountain', '{"kind":"solo","peril":3}'),
  ('gilded-cragbreaker', 'grumblecrag', 'title', 'Gilded Cragbreaker', '{"kind":"gilded"}'),
  ('pillar-breaker', 'grumblecrag', 'title', 'Pillar Breaker', '{"kind":"stat","stat":"pillars","n":25}'),
  ('mountain-guardian', 'grumblecrag', 'title', 'Mountain Guardian', '{"kind":"stat","stat":"revives","n":20}'),
  ('boss-hunter', null, 'title', 'Boss Hunter', '{"kind":"total-clears","n":100}')
on conflict (id) do update
  set boss = excluded.boss, slot = excluded.slot, name = excluded.name, rule = excluded.rule;

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Avalanche', 'Clear Grumblecrag on Peril 2 solo in under 3:30.', '#cfe3f5'),
  ('Lone Mountain', 'Clear Grumblecrag on Peril 3 solo, with no self-revive.', '#c9a46a'),
  ('Boss Hunter', 'Clear 100 boss raids.', '#ff9f5a')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

alter table public.arena_raid_bosses enable row level security;
alter table public.arena_raid_rewards enable row level security;
revoke all on public.arena_raid_bosses, public.arena_raid_rewards from anon, authenticated;

-- Raid of the Day and feats. The server supplies the Pacific calendar day.
alter table public.arena_raid_runs
  add column if not exists daily boolean not null default false,
  add column if not exists day date,
  add column if not exists feat boolean not null default false;
create index if not exists arena_raid_daily
  on public.arena_raid_runs(day, party_size, seconds) where daily and result = 'victory';
create index if not exists arena_raid_runs_boss on public.arena_raid_runs(boss);

-- The Victory slot. Items are checked against the rewards table when they
-- are equipped, so the hard-coded list from 008 is no longer needed.
alter table public.arena_raid_loadouts add column if not exists victory text;
alter table public.arena_raid_loadouts drop constraint if exists arena_raid_loadouts_slots;

-- Reward ids a player has earned. Internal: only the functions below call it.
create or replace function public.arena_raid_earned(pid uuid) returns setof text
language sql stable security definer set search_path = public as $$
  with runs as (
    select r.boss, r.result, r.peril, r.party_size, r.seconds, r.downs, r.gilded,
           r.feat, r.day, p.pillars, p.revives
      from public.arena_raid_runs r
      join public.arena_raid_players p on p.run_id = r.id
     where p.player_id = pid
  )
  select w.id from public.arena_raid_rewards w
   where w.active and case w.rule->>'kind'
    when 'clears' then
      (select count(*) from runs where result = 'victory' and boss = w.boss) >= (w.rule->>'n')::int
    when 'peril' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss
                 and peril >= (w.rule->>'n')::int)
    when 'flawless' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss
                 and peril >= (w.rule->>'peril')::int and downs = 0)
    -- Solo Peril 3 has had no self-revive since this migration (day is set);
    -- older solo clears count only when nobody went down.
    when 'solo' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss and party_size = 1
                 and peril >= (w.rule->>'peril')::int and (day is not null or downs = 0))
    when 'speed' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss
                 and peril >= (w.rule->>'peril')::int
                 and party_size = (w.rule->>'party')::int
                 and seconds <= (w.rule->>'seconds')::numeric)
    when 'gilded' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss and gilded)
    when 'feat' then
      exists (select 1 from runs where result = 'victory' and boss = w.boss and feat)
    when 'stat' then
      coalesce((select sum(case w.rule->>'stat' when 'pillars' then pillars
                                                 when 'revives' then revives else 0 end)
                  from runs where boss = w.boss), 0) >= (w.rule->>'n')::int
    when 'total-clears' then
      (select count(*) from runs where result = 'victory') >= (w.rule->>'n')::int
    else false end;
$$;
revoke all on function public.arena_raid_earned(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_record_raid(p_receipt jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  player jsonb; pid uuid; inserted integer;
  outcome text = coalesce(p_receipt->>'result', 'victory');
  run uuid = (p_receipt->>'id')::uuid;
  peril integer = (p_receipt->>'peril')::integer;
  is_daily boolean = coalesce((p_receipt->>'daily')::boolean, false);
begin
  if not exists (select 1 from public.arena_raid_bosses b
                  where b.id = p_receipt->>'boss' and b.playable)
     or jsonb_array_length(p_receipt->'players') not between 1 and 4
     or outcome not in ('victory', 'defeat')
     or (is_daily and p_receipt->>'day' is null) then
    raise exception 'Invalid raid';
  end if;
  insert into public.arena_raid_runs(id, boss, peril, trait, gilded, weekly, week, party_size,
      seconds, downs, revives, receipt, created_at, result, phase_reached, down_causes,
      daily, day, feat)
  values (run, p_receipt->>'boss', peril, p_receipt->>'trait',
      (p_receipt->>'gilded')::boolean, coalesce((p_receipt->>'weekly')::boolean, false),
      coalesce((p_receipt->>'week')::date, (p_receipt->>'day')::date, current_date),
      (p_receipt->>'partySize')::integer, (p_receipt->>'seconds')::numeric,
      (p_receipt->>'downs')::integer, (p_receipt->>'revives')::integer, p_receipt, now(),
      outcome, least(3, greatest(1, coalesce((p_receipt->>'phaseReached')::integer, 3))),
      case when jsonb_typeof(p_receipt->'downCauses') = 'object' then p_receipt->'downCauses' else '{}'::jsonb end,
      is_daily, (p_receipt->>'day')::date,
      outcome = 'victory' and coalesce((p_receipt->>'feat')::boolean, false))
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;
  for player in select * from jsonb_array_elements(p_receipt->'players') loop
    pid = (player->>'accountId')::uuid;
    insert into public.arena_raid_players(run_id, player_id, character, damage, revives, pillars, downs)
    values (run, pid, player->>'character',
      least(1000000, greatest(0, coalesce((player->>'damage')::numeric, 0)))::integer,
      least(100, greatest(0, coalesce((player->>'revives')::integer, 0))),
      least(20, greatest(0, coalesce((player->>'pillars')::integer, 0))),
      least(100, greatest(0, coalesce((player->>'downs')::integer, 0))));
    -- Every title rule (first clear, Peril 3, speed, lifetime stats…) at once.
    insert into public.arena_player_titles(player_id, title_id)
    select pid, t.id
      from public.arena_raid_rewards w
      join public.arena_titles t on t.name = w.name
     where w.slot = 'title' and w.id in (select public.arena_raid_earned(pid))
    on conflict do nothing;
  end loop;
end; $$;
revoke all on function public.arena_record_raid(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_raid(jsonb) to service_role;

create or replace function public.arena_raid_progress() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid();
  today date = (now() at time zone 'America/Los_Angeles')::date;
  week_start date;
  earned text[];
  loadout public.arena_raid_loadouts;
  bosses jsonb; stats jsonb; crag jsonb;
begin
  if me is null then raise exception 'Login required'; end if;
  week_start = today - extract(dow from today)::int;
  earned = array(select public.arena_raid_earned(me));
  select coalesce(jsonb_object_agg(boss, jsonb_build_object(
           'clears', clears, 'highestPeril', highest, 'bestSeconds', best, 'runs', runs)), '{}'::jsonb),
         coalesce(jsonb_object_agg(boss, jsonb_build_object(
           'pillars', pillars, 'revives', revives, 'feats', feats)), '{}'::jsonb)
    into bosses, stats
    from (select r.boss,
                 count(*) filter (where r.result = 'victory') as clears,
                 coalesce(max(r.peril) filter (where r.result = 'victory'), 0) as highest,
                 min(r.seconds) filter (where r.result = 'victory') as best,
                 count(*) as runs,
                 coalesce(sum(p.pillars), 0) as pillars,
                 coalesce(sum(p.revives), 0) as revives,
                 count(*) filter (where r.result = 'victory' and r.feat) as feats
            from public.arena_raid_runs r join public.arena_raid_players p on p.run_id = r.id
           where p.player_id = me
           group by r.boss) b;
  crag = coalesce(bosses->'grumblecrag',
    '{"clears":0,"highestPeril":0,"bestSeconds":null,"runs":0}'::jsonb);
  select * into loadout from public.arena_raid_loadouts where player_id = me;
  return jsonb_build_object(
    -- Grumblecrag's numbers at the top level, for clients older than the Hub.
    'clears', (crag->>'clears')::int,
    'highestPeril', (crag->>'highestPeril')::int,
    'bestSeconds', crag->'bestSeconds',
    'runs', (crag->>'runs')::int,
    'pillars', coalesce((stats->'grumblecrag'->>'pillars')::int, 0),
    'revives', coalesce((stats->'grumblecrag'->>'revives')::int, 0),
    'bosses', bosses,
    'stats', stats,
    'totalClears', (select count(*) from public.arena_raid_runs r
                      join public.arena_raid_players p on p.run_id = r.id
                     where p.player_id = me and r.result = 'victory'),
    'earned', to_jsonb(earned),
    'cosmetics', coalesce((select jsonb_agg(w.id order by w.id) from public.arena_raid_rewards w
                            where w.slot <> 'title' and w.id = any(earned)), '[]'::jsonb),
    'equipped', coalesce(loadout.skin, loadout.aura, loadout.cosmetic),
    'loadout', jsonb_build_object('skin', loadout.skin, 'aura', loadout.aura,
                                  'entrance', loadout.entrance, 'frame', loadout.frame,
                                  'victory', loadout.victory),
    'titles', coalesce((select jsonb_agg(t.name order by t.name)
                          from public.arena_player_titles g join public.arena_titles t on t.id = g.title_id
                         where g.player_id = me
                           and t.name in (select w.name from public.arena_raid_rewards w where w.slot = 'title')),
                       '[]'::jsonb),
    'weekly', '[]'::jsonb,
    'today', jsonb_build_object(
      'day', today,
      'cleared', exists (select 1 from public.arena_raid_runs r join public.arena_raid_players p on p.run_id = r.id
                          where p.player_id = me and r.daily and r.result = 'victory' and r.day = today),
      'board', coalesce((select jsonb_agg(to_jsonb(q)) from (
        select r.party_size as "partySize", r.seconds, r.peril,
               (select jsonb_agg(pr.display_name order by pr.display_name)
                  from public.arena_raid_players rp join public.arena_profiles pr on pr.id = rp.player_id
                 where rp.run_id = r.id) as names
          from (select rr.*, row_number() over (partition by rr.party_size order by rr.seconds, rr.id) as place
                  from public.arena_raid_runs rr
                 where rr.daily and rr.result = 'victory' and rr.day = today) r
         where r.place <= 10
         order by r.party_size, r.seconds limit 40) q), '[]'::jsonb)),
    'dailyClears', coalesce((select jsonb_agg(distinct r.day order by r.day)
                               from public.arena_raid_runs r join public.arena_raid_players p on p.run_id = r.id
                              where p.player_id = me and r.daily and r.result = 'victory'
                                and r.day between week_start and week_start + 6), '[]'::jsonb));
end; $$;
revoke all on function public.arena_raid_progress() from public, anon;
grant execute on function public.arena_raid_progress() to authenticated;

create or replace function public.arena_equip_raid_slot(p_slot text, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null then raise exception 'Login required'; end if;
  if p_slot not in ('skin', 'aura', 'entrance', 'frame', 'victory') then raise exception 'Unknown slot'; end if;
  if p_item is not null then
    if not exists (select 1 from public.arena_raid_rewards w where w.id = p_item and w.slot = p_slot) then
      raise exception 'That item belongs in another slot';
    end if;
    if not exists (select 1 from public.arena_raid_earned(me) e where e = p_item) then
      raise exception 'Cosmetic not earned';
    end if;
  end if;
  insert into public.arena_raid_loadouts(player_id) values (me) on conflict (player_id) do nothing;
  update public.arena_raid_loadouts set
    skin = case when p_slot = 'skin' then p_item else skin end,
    aura = case when p_slot = 'aura' then p_item else aura end,
    entrance = case when p_slot = 'entrance' then p_item else entrance end,
    frame = case when p_slot = 'frame' then p_item else frame end,
    victory = case when p_slot = 'victory' then p_item else victory end,
    cosmetic = null
  where player_id = me;
end; $$;
revoke all on function public.arena_equip_raid_slot(text, text) from public, anon;
grant execute on function public.arena_equip_raid_slot(text, text) to authenticated;

-- Balance data for admins, now split by boss.
create or replace function public.arena_raid_balance() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.arena_require_admin();
  return jsonb_build_object(
    'runs', coalesce((select jsonb_agg(to_jsonb(q)) from (
      select boss, peril, party_size as "partySize", result, phase_reached as "phaseReached",
             count(*) as count, round(avg(seconds)) as "averageSeconds"
        from public.arena_raid_runs
       group by boss, peril, party_size, result, phase_reached
       order by boss, peril, party_size, result, phase_reached) q), '[]'::jsonb),
    'downCauses', coalesce((select jsonb_object_agg(boss || ':' || cause, total) from (
      select boss, key as cause, sum(value::integer) as total
        from public.arena_raid_runs, jsonb_each_text(down_causes)
       group by boss, key) q), '{}'::jsonb));
end; $$;
revoke all on function public.arena_raid_balance() from public, anon;
grant execute on function public.arena_raid_balance() to authenticated;
commit;
