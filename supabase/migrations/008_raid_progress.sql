-- Raid progress: per-player stats, saved defeats, balance data, separate
-- appearance slots and new rewards. Like 007, records are written ONLY by the
-- game server's service-role client, and raids never touch Elo or PvP boards.
begin;

-- Defeats are saved too (they count towards titles and tell us which attacks
-- are unfair). Rows from 007 were all victories.
alter table public.arena_raid_runs
  add column if not exists result text not null default 'victory',
  add column if not exists phase_reached integer not null default 3,
  add column if not exists down_causes jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.arena_raid_runs
    add constraint arena_raid_runs_result check (result in ('victory', 'defeat'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.arena_raid_runs
    add constraint arena_raid_runs_phase check (phase_reached between 1 and 3);
exception when duplicate_object then null; end $$;

alter table public.arena_raid_players
  add column if not exists damage integer not null default 0,
  add column if not exists revives integer not null default 0,
  add column if not exists pillars integer not null default 0,
  add column if not exists downs integer not null default 0;

-- One item per slot. The 007 "cosmetic" column is kept for older servers.
alter table public.arena_raid_loadouts
  add column if not exists skin text,
  add column if not exists aura text,
  add column if not exists entrance text,
  add column if not exists frame text;
do $$ begin
  alter table public.arena_raid_loadouts
    add constraint arena_raid_loadouts_slots check (
      (skin is null or skin in ('cragbound', 'cragstone')) and
      (aura is null or aura = 'mountain-aura') and
      (entrance is null or entrance = 'mountainborn') and
      (frame is null or frame = 'conqueror'));
exception when duplicate_object then null; end $$;
update public.arena_raid_loadouts
   set skin = case when cosmetic = 'cragbound' then 'cragbound' end,
       aura = case when cosmetic = 'mountain-aura' then 'mountain-aura' end
 where cosmetic is not null and skin is null and aura is null;

create index if not exists arena_raid_runs_result on public.arena_raid_runs(result, peril);

insert into public.arena_titles(name, description, color, active)
select name, description, color, true from (values
  ('Pillar Breaker', 'Bait 25 charges into pillars in raids.', '#d9b98a'),
  ('Mountain Guardian', 'Help revive teammates 20 times in raids.', '#8fe3b4')
) v(name, description, color)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

create or replace function public.arena_record_raid(p_receipt jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  player jsonb; pid uuid; inserted integer;
  outcome text = coalesce(p_receipt->>'result', 'victory');
  run uuid = (p_receipt->>'id')::uuid;
  peril integer = (p_receipt->>'peril')::integer;
  total_pillars integer; total_revives integer;
begin
  if p_receipt->>'boss' <> 'grumblecrag'
     or jsonb_array_length(p_receipt->'players') not between 1 and 4
     or outcome not in ('victory', 'defeat') then
    raise exception 'Invalid raid';
  end if;
  insert into public.arena_raid_runs(id, boss, peril, trait, gilded, weekly, week, party_size,
      seconds, downs, revives, receipt, created_at, result, phase_reached, down_causes)
  values (run, p_receipt->>'boss', peril, p_receipt->>'trait',
      (p_receipt->>'gilded')::boolean, (p_receipt->>'weekly')::boolean, (p_receipt->>'week')::date,
      (p_receipt->>'partySize')::integer, (p_receipt->>'seconds')::numeric,
      (p_receipt->>'downs')::integer, (p_receipt->>'revives')::integer, p_receipt, now(),
      outcome, least(3, greatest(1, coalesce((p_receipt->>'phaseReached')::integer, 3))),
      case when jsonb_typeof(p_receipt->'downCauses') = 'object' then p_receipt->'downCauses' else '{}'::jsonb end)
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
    if outcome = 'victory' then
      insert into public.arena_player_titles(player_id, title_id)
      select pid, t.id from public.arena_titles t
       where t.name = 'Cragbreaker'
          or (t.name = 'Mountain Conqueror' and peril = 3)
          or (t.name = 'Gilded Cragbreaker' and (p_receipt->>'gilded')::boolean)
      on conflict do nothing;
    end if;
    -- Lifetime totals over every run, wins and losses.
    select coalesce(sum(p.pillars), 0), coalesce(sum(p.revives), 0)
      into total_pillars, total_revives
      from public.arena_raid_players p where p.player_id = pid;
    insert into public.arena_player_titles(player_id, title_id)
    select pid, t.id from public.arena_titles t
     where (t.name = 'Pillar Breaker' and total_pillars >= 25)
        or (t.name = 'Mountain Guardian' and total_revives >= 20)
    on conflict do nothing;
  end loop;
end; $$;
revoke all on function public.arena_record_raid(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_raid(jsonb) to service_role;

create or replace function public.arena_raid_progress() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); result jsonb; clears integer; highest integer; best numeric;
  unbroken boolean; runs integer; pillars integer; revives integer;
  cosmetics jsonb = '[]'; loadout public.arena_raid_loadouts;
begin
  if me is null then raise exception 'Login required'; end if;
  select count(*) filter (where r.result = 'victory'),
         coalesce(max(r.peril) filter (where r.result = 'victory'), 0),
         min(r.seconds) filter (where r.result = 'victory'),
         coalesce(bool_or(r.result = 'victory' and r.peril = 3 and r.downs = 0), false),
         count(*), coalesce(sum(p.pillars), 0), coalesce(sum(p.revives), 0)
    into clears, highest, best, unbroken, runs, pillars, revives
    from public.arena_raid_runs r join public.arena_raid_players p on p.run_id = r.id
   where p.player_id = me;
  if clears >= 5 then cosmetics = cosmetics || '"cragbound"'::jsonb; end if;
  if clears >= 10 then cosmetics = cosmetics || '"cragstone"'::jsonb; end if;
  if unbroken then cosmetics = cosmetics || '"mountain-aura"'::jsonb; end if;
  if highest >= 2 then cosmetics = cosmetics || '"mountainborn"'::jsonb; end if;
  if highest >= 3 then cosmetics = cosmetics || '"conqueror"'::jsonb; end if;
  select * into loadout from public.arena_raid_loadouts where player_id = me;
  result = jsonb_build_object(
    'clears', clears, 'highestPeril', highest, 'bestSeconds', best,
    'runs', runs, 'pillars', pillars, 'revives', revives,
    'cosmetics', cosmetics,
    'equipped', coalesce(loadout.skin, loadout.aura, loadout.cosmetic),
    'loadout', jsonb_build_object('skin', loadout.skin, 'aura', loadout.aura,
                                  'entrance', loadout.entrance, 'frame', loadout.frame),
    'titles', coalesce((select jsonb_agg(t.name order by t.name)
                          from public.arena_player_titles g join public.arena_titles t on t.id = g.title_id
                         where g.player_id = me and t.name in ('Cragbreaker', 'Mountain Conqueror',
                               'Gilded Cragbreaker', 'Pillar Breaker', 'Mountain Guardian')), '[]'::jsonb),
    'weekly', coalesce((select jsonb_agg(to_jsonb(q)) from (
      select r.party_size as "partySize", r.seconds, r.peril,
             (select jsonb_agg(pr.display_name order by pr.display_name)
                from public.arena_raid_players rp join public.arena_profiles pr on pr.id = rp.player_id
               where rp.run_id = r.id) as names
        from (select rr.*, row_number() over (partition by rr.party_size order by rr.seconds, rr.id) as place
                from public.arena_raid_runs rr
               where rr.weekly and rr.result = 'victory'
                 and rr.week = date_trunc('week', now() at time zone 'utc')::date) r
       where r.place <= 10
       order by r.party_size, r.seconds limit 40) q), '[]'::jsonb));
  return result;
end; $$;
revoke all on function public.arena_raid_progress() from public, anon;
grant execute on function public.arena_raid_progress() to authenticated;

create or replace function public.arena_equip_raid_slot(p_slot text, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare progress jsonb; me uuid = auth.uid();
begin
  if me is null then raise exception 'Login required'; end if;
  if p_slot not in ('skin', 'aura', 'entrance', 'frame') then raise exception 'Unknown slot'; end if;
  if p_item is not null then
    if not ((p_slot = 'skin' and p_item in ('cragbound', 'cragstone'))
         or (p_slot = 'aura' and p_item = 'mountain-aura')
         or (p_slot = 'entrance' and p_item = 'mountainborn')
         or (p_slot = 'frame' and p_item = 'conqueror')) then
      raise exception 'That item belongs in another slot';
    end if;
    progress = public.arena_raid_progress();
    if not (progress->'cosmetics' ? p_item) then raise exception 'Cosmetic not earned'; end if;
  end if;
  insert into public.arena_raid_loadouts(player_id) values (me) on conflict (player_id) do nothing;
  update public.arena_raid_loadouts set
    skin = case when p_slot = 'skin' then p_item else skin end,
    aura = case when p_slot = 'aura' then p_item else aura end,
    entrance = case when p_slot = 'entrance' then p_item else entrance end,
    frame = case when p_slot = 'frame' then p_item else frame end,
    cosmetic = null
  where player_id = me;
end; $$;
revoke all on function public.arena_equip_raid_slot(text, text) from public, anon;
grant execute on function public.arena_equip_raid_slot(text, text) to authenticated;

-- The 007 single-cosmetic call still works: it sets the matching slot.
create or replace function public.arena_equip_raid_cosmetic(p_cosmetic text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_cosmetic is null then
    perform public.arena_equip_raid_slot('skin', null);
    perform public.arena_equip_raid_slot('aura', null);
  elsif p_cosmetic = 'mountain-aura' then
    perform public.arena_equip_raid_slot('aura', p_cosmetic);
  else
    perform public.arena_equip_raid_slot('skin', p_cosmetic);
  end if;
end; $$;
revoke all on function public.arena_equip_raid_cosmetic(text) from public, anon;
grant execute on function public.arena_equip_raid_cosmetic(text) to authenticated;

-- Balance data for admins: how far runs get and which attacks down people.
create or replace function public.arena_raid_balance() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.arena_require_admin();
  return jsonb_build_object(
    'runs', coalesce((select jsonb_agg(to_jsonb(q)) from (
      select peril, party_size as "partySize", result, phase_reached as "phaseReached",
             count(*) as count, round(avg(seconds)) as "averageSeconds"
        from public.arena_raid_runs
       group by peril, party_size, result, phase_reached
       order by peril, party_size, result, phase_reached) q), '[]'::jsonb),
    'downCauses', coalesce((select jsonb_object_agg(cause, total) from (
      select key as cause, sum(value::integer) as total
        from public.arena_raid_runs, jsonb_each_text(down_causes)
       group by key) q), '{}'::jsonb));
end; $$;
revoke all on function public.arena_raid_balance() from public, anon;
grant execute on function public.arena_raid_balance() to authenticated;
commit;
