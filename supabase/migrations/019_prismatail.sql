-- Prismatail: Sun Atrium, light relays and eleven guaranteed rewards.
-- Apply after 018_collection_equipping.sql. Safe to run again.
begin;
update public.arena_raid_bosses set playable = true where id = 'prismatail';
insert into public.arena_raid_rewards(id, boss, slot, name, rule) values
  ('prismbreaker', 'prismatail', 'title', 'Prismbreaker', '{"kind":"clears","n":1}'),
  ('dawn-colors', 'prismatail', 'skin', 'Dawn colors', '{"kind":"clears","n":5}'),
  ('prismatic-skin', 'prismatail', 'skin', 'Prismatic skin', '{"kind":"clears","n":10}'),
  ('sunburst', 'prismatail', 'entrance', 'Sunburst entrance', '{"kind":"peril","n":2}'),
  ('sunshatter', 'prismatail', 'title', 'Sunshatter', '{"kind":"peril","n":3}'),
  ('stained-glass', 'prismatail', 'frame', 'Stained-glass frame', '{"kind":"peril","n":3}'),
  ('halo-aura', 'prismatail', 'aura', 'Halo aura', '{"kind":"flawless","peril":3}'),
  ('rainbow-fan', 'prismatail', 'victory', 'Rainbow Fan', '{"kind":"feat"}'),
  ('sunbeam-sprint', 'prismatail', 'title', 'Sunbeam Sprint', '{"kind":"speed","peril":2,"party":1,"seconds":240}'),
  ('lone-sun', 'prismatail', 'title', 'Lone Sun', '{"kind":"solo","peril":3}'),
  ('lightkeeper', 'prismatail', 'title', 'Lightkeeper', '{"kind":"stat","stat":"pillars","n":80}')
on conflict (id) do update set boss=excluded.boss,slot=excluded.slot,name=excluded.name,rule=excluded.rule;
insert into public.arena_titles(name,description,color,active)
select name,description,color,true from (values
  ('Prismbreaker', 'First clear.', '#ffe27a'),
  ('Sunshatter', 'Clear Peril 3.', '#ffe27a'),
  ('Sunbeam Sprint', 'Clear Peril 2 solo in under 4:00.', '#ffe27a'),
  ('Lone Sun', 'Clear Peril 3 solo (no self-revive).', '#ffe27a'),
  ('Lightkeeper', 'Relay light 80 times (wins and losses).', '#ffe27a')
) v(name,description,color)
where not exists(select 1 from public.arena_titles t where t.name=v.name);
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
      least(case when p_receipt->>'boss' in ('somnara', 'prismatail') then 300 else 20 end, greatest(0, coalesce((player->>'pillars')::integer, 0))),
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

commit;

select exists(select 1 from public.arena_raid_bosses where id='prismatail' and playable) as prismatail_enabled,
 (select count(*)=11 from public.arena_raid_rewards where boss='prismatail') as prismatail_rewards_ready;
