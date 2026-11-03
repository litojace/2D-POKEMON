-- Hub redesign, phase 5g: guard dogs and crows.
-- Run after 044_farm_tools.sql. Safe to run again.
--  * Guard dogs, hired by the day with Gold Leaves (the prototype's three):
--    Goldie (farm Lv 3; 60 for a day, 150 for 3): digs up 1 gift a day.
--    Inky (Lv 20; 180 / 450): 30% fewer bugs.
--    Fluffy (Lv 40; 300 / 750): digs up 2 gifts a day, and crops that ripen
--    while she is on guard roll Gold ×1.5.
--    Every dog keeps crows away. (Catching thieves comes with friends' farms.)
--    Hiring the dog on guard adds the days; another dog takes over, and the
--    old one's time left is lost. At most 30 days ahead.
--  * Gifts: half are 2 seeds of a crop up to 2 levels above yours, 30% are
--    15–44 Gold Leaves, 20% a Super Fertilizer. They are counted from the
--    hire, also while you are away.
--  * Crows: while you are on the farm (044's rule) and it has no Scarecrow
--    and no dog, about one crow every 84 minutes lands on a ripe crop. Tap
--    it within 8 s (`shoo`) or it eats the crop; the server allows 2 s more
--    for the network.
--  * Hires are kept as a history, so a crop's Gold roll never changes after
--    it ripened, whatever dog you have later.
begin;

create table if not exists public.arena_farm_dog_hires (
  id bigserial primary key,
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  dog text not null check (dog in ('gold', 'black', 'cream')),
  started_at timestamptz not null,
  ends_at timestamptz not null,
  -- Gifts are counted up to here.
  dug_at timestamptz not null,
  check (ends_at >= started_at)
);
create index if not exists arena_farm_dog_hires_player on public.arena_farm_dog_hires(player_id, ends_at desc);
create table if not exists public.arena_farm_dog_gifts (
  id bigserial primary key,
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  dug_at timestamptz not null,
  dog text not null,
  kind text not null check (kind in ('seeds', 'leaves', 'super')),
  crop text references public.arena_farm_crops(id),
  qty integer not null check (qty > 0)
);
create index if not exists arena_farm_dog_gifts_player on public.arena_farm_dog_gifts(player_id, dug_at desc);
alter table public.arena_farm_dog_hires enable row level security;
alter table public.arena_farm_dog_gifts enable row level security;
revoke all on public.arena_farm_dog_hires, public.arena_farm_dog_gifts from public, anon, authenticated, service_role;

alter table public.arena_farm_plots add column if not exists crow_at timestamptz;

-- A crow leaves with the crop: planting, harvesting or digging clears it.
create or replace function public.arena_farm_plots_crow() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.crop is distinct from old.crop or new.planted_at is distinct from old.planted_at then
    new.crow_at = null;
  end if;
  return new;
end; $$;
drop trigger if exists arena_farm_plots_crow on public.arena_farm_plots;
create trigger arena_farm_plots_crow before update on public.arena_farm_plots
  for each row execute function public.arena_farm_plots_crow();

-- The dog on guard at a moment, if any.
create or replace function public.arena_farm_dog(pid uuid, at timestamptz) returns text
language sql stable security definer set search_path = public as $$
  select h.dog from public.arena_farm_dog_hires h
  where h.player_id = pid and h.started_at <= at and h.ends_at > at
  order by h.ends_at desc limit 1
$$;

-- Mutations as in 039, with Fluffy's Gold ×1.5 for crops that ripened while
-- she was on guard.
create or replace function public.arena_farm_mutation(pid uuid, p public.arena_farm_plots, w text) returns text
language plpgsql stable set search_path = public as $$
declare gold double precision; rb double precision; r1 double precision; r2 double precision;
  m1 text; m2 text; wm text; wp double precision; ripe timestamptz;
begin
  -- 'none' is the pinned no-weather of tests: no mutations at all.
  if p.crop is null or w is null or w = 'none' then return ''; end if;
  gold = 0.03 * (case when p.fertilizer = 'gold' then 3 else 1 end) * (case when w = 'rainbow' then 3 else 1 end);
  if exists (select 1 from public.arena_farm_dog_hires h where h.player_id = pid and h.dog = 'cream') then
    ripe = public.arena_farm_ripe_at(p);
    if ripe is not null and public.arena_farm_dog(pid, ripe) = 'cream' then gold = gold * 1.5; end if;
  end if;
  rb = 0.005 * (case when w = 'rainbow' then 10 else 1 end);
  r1 = public.arena_farm_roll(pid, p.idx, p.planted_at, 'luck');
  r2 = public.arena_farm_roll(pid, p.idx, p.planted_at, 'weather');
  m1 = case when r1 < rb then 'rainbow' when r1 < rb + gold then 'gold' end;
  wm = case w when 'storm' then 'shock' when 'moon' then 'moon' when 'frost' then 'frost' when 'rain' then 'wet' end;
  wp = case w when 'rain' then 0.3 else 0.25 end;
  if wm is not null and r2 < wp then m2 = wm; end if;
  return array_to_string(array(select x from unnest(array[m1, m2]) x where x is not null order by x collate "C"), '+');
end; $$;

-- Pests while you are on the farm (044): bugs, now 30% fewer with Inky,
-- and crows when there is no Scarecrow and no dog.
create or replace function public.arena_farm_bugs(pid uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; t timestamptz = now(); secs double precision; chance double precision;
  p public.arena_farm_plots; n integer = 0; v_dog text; v_crow integer;
begin
  if current_setting('arena.farm_bugs', true) = 'off' then return 0; end if;
  select * into f from public.arena_farms where player_id = pid for update;
  if f.player_id is null then return 0; end if;
  update public.arena_farms set seen_at = t where player_id = pid;
  secs = extract(epoch from (t - f.seen_at));
  if secs is null or secs <= 0 or secs > 150 then return 0; end if;
  v_dog = public.arena_farm_dog(pid, t);
  chance = 1 - exp(-0.00005 * (case when f.scarecrow then 0.5 else 1 end)
    * (case when v_dog = 'black' then 0.7 else 1 end) * secs);
  for p in select * from public.arena_farm_plots
      where player_id = pid and owned and crop is not null and pests < 2 order by idx loop
    if random() < chance and public.arena_farm_growth(p, t) < 1 then
      perform public.arena_farm_set_pests(pid, p.idx, p.pests + 1, t);
      n = n + 1;
    end if;
  end loop;
  -- A crow: about one every 84 minutes on the farm, on a ripe crop.
  if not f.scarecrow and v_dog is null and random() < 1 - exp(-secs / 5040.0) then
    select x.idx into v_crow from public.arena_farm_plots x
     where x.player_id = pid and x.owned and x.crop is not null and x.crow_at is null
       and public.arena_farm_growth(x, t) >= 1
     order by random() limit 1;
    if v_crow is not null then
      update public.arena_farm_plots set crow_at = t where player_id = pid and idx = v_crow;
    end if;
  end if;
  return n;
end; $$;

-- What happened while you looked away: crows that were not shooed eat
-- their crop, and dogs dig up their gifts.
create or replace function public.arena_farm_dogs(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t timestamptz = now(); h public.arena_farm_dog_hires; per double precision; n integer;
  k integer; at timestamptz; r double precision; v_crop text; v_qty integer; v_level integer;
begin
  update public.arena_farm_plots set crop = null, planted_at = null, progress = 0, progress_at = null,
    wet = false, fertilizer = null, mutation = null, pests = 0, crow_at = null
   where player_id = pid and crow_at < t - interval '10 seconds';
  select level into v_level from public.arena_farms where player_id = pid;
  for h in select * from public.arena_farm_dog_hires
      where player_id = pid and dog in ('gold', 'cream') and dug_at < least(t, ends_at)
      order by id for update loop
    per = 86400.0 / case h.dog when 'cream' then 2 else 1 end;
    n = floor(extract(epoch from (least(t, h.ends_at) - h.dug_at)) / per);
    if n <= 0 then continue; end if;
    for k in 1 .. least(n, 60) loop
      at = h.dug_at + make_interval(secs => per * k);
      r = random();
      if r < 0.5 then
        select c.id into v_crop from public.arena_farm_crops c
         where c.level <= coalesce(v_level, 1) + 2 order by random() limit 1;
        insert into public.arena_farm_seeds(player_id, crop, qty) values (pid, v_crop, 2)
        on conflict (player_id, crop) do update set qty = public.arena_farm_seeds.qty + 2;
        insert into public.arena_farm_dog_gifts(player_id, dug_at, dog, kind, crop, qty)
        values (pid, at, h.dog, 'seeds', v_crop, 2);
      elsif r < 0.8 then
        v_qty = 15 + floor(random() * 30)::integer;
        perform public.arena_grant_leaves(pid, v_qty, 'farm-dog', 'gift:' || h.id || ':' || extract(epoch from at)::bigint,
          public.arena_today());
        insert into public.arena_farm_dog_gifts(player_id, dug_at, dog, kind, qty)
        values (pid, at, h.dog, 'leaves', v_qty);
      else
        update public.arena_farms set fert_super = fert_super + 1 where player_id = pid;
        insert into public.arena_farm_dog_gifts(player_id, dug_at, dog, kind, qty)
        values (pid, at, h.dog, 'super', 1);
      end if;
    end loop;
    update public.arena_farm_dog_hires set dug_at = dug_at + make_interval(secs => per * n) where id = h.id;
  end loop;
  delete from public.arena_farm_dog_gifts where player_id = pid and dug_at < t - interval '30 days';
end; $$;

-- New actions: hire a dog, shoo a crow.
create or replace function public.arena_farm_act_more(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_dog text; v_days integer; cost integer; v_level integer;
  cur public.arena_farm_dog_hires; plot integer; p public.arena_farm_plots;
begin
  xp = 0;
  select * into f from public.arena_farms where player_id = pid;
  if a->>'a' = 'hire-dog' then
    v_dog = a->>'dog';
    v_days = case when jsonb_typeof(a->'days') = 'number' then (a->>'days')::integer end;
    v_level = case v_dog when 'gold' then 3 when 'black' then 20 when 'cream' then 40 end;
    cost = case when v_days = 1 then case v_dog when 'gold' then 60 when 'black' then 180 when 'cream' then 300 end
      when v_days = 3 then case v_dog when 'gold' then 150 when 'black' then 450 when 'cream' then 750 end end;
    select * into cur from public.arena_farm_dog_hires h
     where h.player_id = pid and h.started_at <= t and h.ends_at > t order by h.ends_at desc limit 1 for update;
    if v_level is null then err = 'Unknown dog';
    elsif cost is null then err = 'Hire for 1 or 3 days';
    elsif f.level < v_level then err = 'Unlocks at farm level ' || v_level;
    elsif cur.dog = v_dog and cur.ends_at + make_interval(days => v_days) > t + interval '30 days' then
      err = 'That is as long as a dog can be booked';
    elsif not public.arena_spend_leaves(pid, cost, 'farm-dog', ref, d) then err = 'Not enough Gold Leaves';
    elsif cur.dog = v_dog then
      update public.arena_farm_dog_hires set ends_at = ends_at + make_interval(days => v_days) where id = cur.id;
      gained = jsonb_build_object('dog', v_dog, 'days', v_days, 'cost', cost, 'extended', true);
    else
      -- Another dog takes over: the old one goes home now.
      if cur.id is not null then
        update public.arena_farm_dog_hires set ends_at = t, dug_at = least(dug_at, t) where id = cur.id;
      end if;
      insert into public.arena_farm_dog_hires(player_id, dog, started_at, ends_at, dug_at)
      values (pid, v_dog, t, t + make_interval(days => v_days), t);
      gained = jsonb_build_object('dog', v_dog, 'days', v_days, 'cost', cost, 'extended', false);
    end if;
  elsif a->>'a' = 'shoo' then
    plot = case when jsonb_typeof(a->'plot') = 'number' then (a->>'plot')::integer end;
    select * into p from public.arena_farm_plots where player_id = pid and idx = plot for update;
    if p.idx is null then err = 'Unknown plot';
    elsif p.crow_at is null then err = 'No crow here';
    else
      update public.arena_farm_plots set crow_at = null where player_id = pid and idx = plot;
      gained = jsonb_build_object('shooed', true);
    end if;
  else
    err = 'Unknown action';
  end if;
end; $$;
revoke all on function public.arena_farm_plots_crow(), public.arena_farm_dog(uuid, timestamptz),
  public.arena_farm_bugs(uuid), public.arena_farm_dogs(uuid),
  public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date)
  from public, anon, authenticated, service_role;

-- Farm actions: what happened while away, pests, the core, then crop book
-- rewards.
create or replace function public.arena_farm_act(p_request uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; book jsonb;
begin
  if auth.uid() is not null and exists (select 1 from public.arena_farms where player_id = auth.uid()) then
    perform public.arena_farm_dogs(auth.uid());
    perform public.arena_farm_bugs(auth.uid());
  end if;
  r = public.arena_farm_act_core(p_request, p_actions);
  if coalesce((r->>'repeated')::boolean, false) then return r; end if;
  book = public.arena_farm_book_rewards(auth.uid());
  if jsonb_array_length(book) > 0 then
    r = r || jsonb_build_object('farm', public.arena_farm_state(auth.uid()), 'book', book);
  end if;
  return r;
end; $$;
revoke all on function public.arena_farm_act(uuid, jsonb) from public, anon;
grant execute on function public.arena_farm_act(uuid, jsonb) to authenticated;

create or replace function public.arena_farm() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_farm_ensure(me);
  perform public.arena_farm_orders_refresh(me);
  perform public.arena_farm_dogs(me);
  perform public.arena_farm_bugs(me);
  return public.arena_farm_state(me);
end; $$;
revoke all on function public.arena_farm() from public, anon;
grant execute on function public.arena_farm() to authenticated;

-- The farm state as in 043, plus the dog on guard, recent gifts and crows.
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
      where m.player_id = pid and m.stars > 0), '{}'::jsonb),
    'dog', (select jsonb_build_object('type', h.dog, 'since', h.started_at, 'until', h.ends_at)
      from public.arena_farm_dog_hires h
      where h.player_id = pid and h.started_at <= now() and h.ends_at > now()
      order by h.ends_at desc limit 1),
    'dogGifts', coalesce((select jsonb_agg(jsonb_build_object('at', g.dug_at, 'dog', g.dog,
        'kind', g.kind, 'crop', g.crop, 'qty', g.qty) order by g.dug_at desc)
      from (select * from public.arena_farm_dog_gifts g where g.player_id = pid
        order by g.dug_at desc limit 10) g), '[]'::jsonb),
    'crows', coalesce((select jsonb_object_agg(x.idx::text, x.crow_at) from public.arena_farm_plots x
      where x.player_id = pid and x.crow_at is not null), '{}'::jsonb))
$$;
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;
commit;

select
  to_regclass('public.arena_farm_dog_hires') is not null as farm_dogs_enabled,
  to_regprocedure('public.arena_farm_dogs(uuid)') is not null as farm_crows_enabled;
