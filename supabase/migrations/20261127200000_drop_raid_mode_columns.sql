-- Drop the retired raid modes' columns from arena_raid_runs: `weekly` and
-- `week` (Raid of the Week, 007) and `daily` (Raid of the Day, 009). #500
-- removed the modes from the game; since 028 every run stores weekly and
-- daily as false and `week` as the Monday of its day. Nothing reads them.
--
-- No values are lost: every run's `receipt` (jsonb) still holds the keys
-- the server sent, and that copy is not changed here.
--
-- `day` stays: arena_raid_earned (030) reads it for the legacy solo rule,
-- and it is the run's Pacific date.
--
-- Two functions still named these columns, and Postgres does not track
-- columns used inside a function body, so both are replaced first, with
-- the same names and grants (028's wrappers call them):
-- - arena_record_raid_before_mode_retirement: 021's body without the three
--   columns. Old servers' extra keys stay in `receipt` and are otherwise
--   ignored. 028's wrapper still refuses `daily: true`.
-- - arena_raid_progress_before_mode_retirement: 018's body without `today`
--   and `dailyClears`, which 028's wrapper already took off every answer.
--   Players get the same answer as before.
-- Safe to run again: create or replace, drop ... if exists.
begin;

create or replace function public.arena_record_raid_before_mode_retirement(p_receipt jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  player jsonb; pid uuid; inserted integer;
  outcome text = coalesce(p_receipt->>'result', 'victory');
  run uuid = (p_receipt->>'id')::uuid;
  peril integer = (p_receipt->>'peril')::integer;
begin
  if not exists (select 1 from public.arena_raid_bosses b
                  where b.id = p_receipt->>'boss' and b.playable)
     or jsonb_array_length(p_receipt->'players') not between 1 and 4
     or outcome not in ('victory', 'defeat') then
    raise exception 'Invalid raid';
  end if;
  insert into public.arena_raid_runs(id, boss, peril, trait, gilded, party_size,
      seconds, downs, revives, receipt, created_at, result, phase_reached, down_causes,
      day, feat)
  values (run, p_receipt->>'boss', peril, p_receipt->>'trait',
      (p_receipt->>'gilded')::boolean,
      (p_receipt->>'partySize')::integer, (p_receipt->>'seconds')::numeric,
      (p_receipt->>'downs')::integer, (p_receipt->>'revives')::integer, p_receipt, now(),
      outcome, least(3, greatest(1, coalesce((p_receipt->>'phaseReached')::integer, 3))),
      case when jsonb_typeof(p_receipt->'downCauses') = 'object' then p_receipt->'downCauses' else '{}'::jsonb end,
      (p_receipt->>'day')::date,
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
      least(case when p_receipt->>'boss' in ('somnara', 'prismatail', 'emberwing', 'storm-twins') then 300 else 20 end, greatest(0, coalesce((player->>'pillars')::integer, 0))),
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
revoke all on function public.arena_record_raid_before_mode_retirement(jsonb) from public, anon, authenticated, service_role;

create or replace function public.arena_raid_progress_before_mode_retirement() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid();
  earned text[];
  loadout public.arena_raid_loadouts;
  bosses jsonb; stats jsonb; crag jsonb;
begin
  if me is null then raise exception 'Login required'; end if;
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
    -- Always empty since 009; kept for clients that still read it.
    'weekly', '[]'::jsonb);
end; $$;
revoke all on function public.arena_raid_progress_before_mode_retirement() from public, anon, authenticated, service_role;

drop index if exists public.arena_raid_weekly;
drop index if exists public.arena_raid_daily;
alter table public.arena_raid_runs
  drop column if exists weekly,
  drop column if exists week,
  drop column if exists daily;

notify pgrst, 'reload schema';
commit;
