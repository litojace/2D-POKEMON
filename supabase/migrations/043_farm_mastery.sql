-- Hub redesign, phase 5e: crop mastery.
-- Run after 042_farm_wish.sql. Safe to run again.
--  * From farm level 40, each crop can earn up to 5 stars. A star needs
--    25 / 75 / 200 / 500 / 1,000 harvests of that crop and costs
--    seed price × 30 × star² Gold Leaves. Each star sells the crop for 4%
--    more; five stars is a golden crop (+20%).
--  * The bonus is part of your market price for that crop, so selling and
--    the prices you see both include it.
begin;

create table if not exists public.arena_farm_mastery (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  crop text not null references public.arena_farm_crops(id),
  stars integer not null default 0 check (stars between 0 and 5),
  primary key (player_id, crop)
);
alter table public.arena_farm_mastery enable row level security;
revoke all on public.arena_farm_mastery from public, anon, authenticated, service_role;

-- Today's market for a player: the day's price, times their mastery bonus.
create or replace function public.arena_farm_market(p_day date, p_level integer, pid uuid)
returns table(crop text, mult numeric, hot boolean)
language sql stable set search_path = public as $$
  with hot as (
    select c.id from public.arena_farm_crops c where c.level <= greatest(1, p_level)
    order by md5('hot:' || p_day::text || ':' || pid::text || ':' || c.id) limit 1
  )
  select c.id,
    round(((case when c.id = (select id from hot)
      then 1.6 + 0.3 * public.arena_farm_hash('hotx:' || p_day::text || ':' || c.id)
      else 0.7 + 0.9 * public.arena_farm_hash('mkt:' || p_day::text || ':' || c.id) end)
      * (1 + 0.04 * coalesce((select m.stars from public.arena_farm_mastery m
          where m.player_id = pid and m.crop = c.id), 0)))::numeric, 2),
    c.id = (select id from hot)
  from public.arena_farm_crops c
$$;
revoke all on function public.arena_farm_market(date, integer, uuid) from public, anon, authenticated, service_role;

-- The farm state: the core, the orders, the crop book rewards paid, whether
-- today's wish is there, and mastery stars.
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.arena_farm_state_core(pid) || jsonb_build_object(
    'orders', coalesce((select jsonb_agg(jsonb_build_object('slot', o.slot, 'items', o.items,
        'leaves', o.leaves, 'xp', o.xp, 'bonus', o.bonus, 'who', o.who, 'face', o.face,
        'waitUntil', o.wait_until) order by o.slot)
      from public.arena_farm_orders o where o.player_id = pid), '[]'::jsonb),
    'bookRewards', coalesce((select jsonb_agg(b.found order by b.found)
      from public.arena_farm_book_rewards b where b.player_id = pid), '[]'::jsonb),
    'wishReady', not exists (select 1 from public.arena_farm_wishes w
      where w.player_id = pid and w.day = public.arena_today()),
    'mastery', coalesce((select jsonb_object_agg(m.crop, m.stars) from public.arena_farm_mastery m
      where m.player_id = pid and m.stars > 0), '{}'::jsonb))
$$;
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;

-- Buy the next star for a crop. A retried request is answered, not charged again.
create or replace function public.arena_farm_master(p_request uuid, p_crop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); f public.arena_farms; c public.arena_farm_crops;
  st integer; need integer; have integer; cost integer; inserted integer; err text;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null then raise exception 'Invalid mastery request'; end if;
  perform public.arena_farm_ensure(me);
  select * into f from public.arena_farms where player_id = me for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('farm', public.arena_farm_state(me), 'ok', false, 'repeated', true);
  end if;
  select * into c from public.arena_farm_crops where id = p_crop;
  st = coalesce((select stars from public.arena_farm_mastery where player_id = me and crop = p_crop), 0);
  if c.id is null then err = 'Unknown crop';
  elsif f.level < 40 then err = 'Crop mastery unlocks at farm level 40';
  elsif st >= 5 then err = 'Already golden';
  else
    need = (array[25, 75, 200, 500, 1000])[st + 1];
    have = coalesce((select harvests from public.arena_farm_harvests where player_id = me and crop = c.id), 0);
    cost = c.seed_cost * 30 * (st + 1) * (st + 1);
    if have < need then err = 'Harvest ' || c.name || ' ' || need || ' times first';
    elsif not public.arena_spend_leaves(me, cost, 'farm-mastery', p_request::text, d) then
      err = 'Not enough Gold Leaves';
    else
      insert into public.arena_farm_mastery(player_id, crop, stars) values (me, c.id, st + 1)
      on conflict (player_id, crop) do update set stars = st + 1;
    end if;
  end if;
  return jsonb_build_object('farm', public.arena_farm_state(me), 'ok', err is null, 'error', err,
    'stars', case when err is null then st + 1 else st end, 'cost', cost);
end; $$;
revoke all on function public.arena_farm_master(uuid, text) from public, anon;
grant execute on function public.arena_farm_master(uuid, text) to authenticated;
commit;

select to_regprocedure('public.arena_farm_master(uuid, text)') is not null as crop_mastery_enabled;
