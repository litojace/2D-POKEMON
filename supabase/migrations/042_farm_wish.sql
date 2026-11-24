-- Hub redesign, phase 5d: the wishing well.
-- Run after 041_farm_book.sql. Safe to run again.
--  * Once per Pacific day the well grants 3 seeds: each a crop up to 3
--    levels above your farm level (8% of the time up to 15 above).
begin;

create table if not exists public.arena_farm_wishes (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  seeds jsonb not null,
  primary key (player_id, day)
);
alter table public.arena_farm_wishes enable row level security;
revoke all on public.arena_farm_wishes from public, anon, authenticated, service_role;

-- The farm state: the core, the orders, the crop book rewards paid, and
-- whether today's wish is still there.
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
      where w.player_id = pid and w.day = public.arena_today()))
$$;
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;

-- Make today's wish: 3 seeds, once per Pacific day.
create or replace function public.arena_farm_wish() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); lvl integer; got jsonb = '[]'::jsonb;
  pick text; inserted integer; cap integer;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_farm_ensure(me);
  select level into lvl from public.arena_farms where player_id = me for update;
  insert into public.arena_farm_wishes(player_id, day, seeds) values (me, d, '[]'::jsonb) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('farm', public.arena_farm_state(me), 'ok', false,
      'error', 'You already made a wish today. Come back tomorrow');
  end if;
  for k in 1..3 loop
    cap = lvl + case when random() < 0.08 then 15 else 3 end;
    select id into pick from public.arena_farm_crops where level <= cap order by random() limit 1;
    insert into public.arena_farm_seeds(player_id, crop, qty) values (me, pick, 1)
    on conflict (player_id, crop) do update set qty = public.arena_farm_seeds.qty + 1;
    got = got || to_jsonb(pick);
  end loop;
  update public.arena_farm_wishes set seeds = got where player_id = me and day = d;
  return jsonb_build_object('farm', public.arena_farm_state(me), 'ok', true, 'seeds', got);
end; $$;
revoke all on function public.arena_farm_wish() from public, anon;
grant execute on function public.arena_farm_wish() to authenticated;
commit;

select to_regprocedure('public.arena_farm_wish()') is not null as wishing_well_enabled;
