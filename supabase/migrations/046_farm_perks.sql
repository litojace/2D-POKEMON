-- Hub redesign, phase 5h: farmer perks.
-- Run after 045_farm_dogs.sql. Safe to run again.
--  * Your farmer is the fighter you had in the Lobby when you last opened
--    the farm (the farm screen tells the server with a `farmer` action).
--    Each fighter has the prototype's perk:
--    Lumoth, Early Sun: crops grow 20% faster.
--    Terradon, Rich Soil: +1 crop per harvest.
--    Duskveil, Night Stalker: +1 crop for every bug you catch.
--    Mystowl, Foresight: one more weather forecast.
--    Auralynx, Shield: friends can't drop bugs on you (with friends' farms).
--    Voltkit, Zap: clears every bug on the farm.
--    Tidefin, Downpour: waters the whole farm.
--    Cindrake, Warmth: no bugs for 4 hours.
--    The last three are used with a tap, each once a Pacific day.
--  * A new farmer first counts every crop's growth up to now at the old
--    speed, so Early Sun only ever speeds up time Lumoth was farming.
begin;

alter table public.arena_farms
  add column if not exists farmer text not null default 'voltkit'
    check (farmer in ('voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil')),
  add column if not exists warm_until timestamptz;
create table if not exists public.arena_farm_perk_uses (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  perk text not null check (perk in ('zap', 'downpour', 'warmth')),
  day date not null,
  used_at timestamptz not null default now(),
  primary key (player_id, perk, day)
);
alter table public.arena_farm_perk_uses enable row level security;
revoke all on public.arena_farm_perk_uses from public, anon, authenticated, service_role;

-- Growth as in 044, 20% faster while Lumoth farms.
create or replace function public.arena_farm_sim(p public.arena_farm_plots, upto timestamptz,
  out g double precision, out wet boolean, out ripe_at timestamptz, out ripe_weather text)
language plpgsql stable set search_path = public as $$
declare at timestamptz; base double precision; s bigint; w text; seg_end timestamptz;
  rate double precision; need double precision; steps integer = 0;
begin
  if p.crop is null then g = 0; wet = false; return; end if;
  base = (case when p.fertilizer is not null then 1.4 else 1 end)
    * (1 - 0.2 * least(3, greatest(0, coalesce(p.pests, 0))))
    * (case when (select f.farmer from public.arena_farms f where f.player_id = p.player_id) = 'lumoth'
        then 1.2 else 1 end)
    / (select grow_seconds from public.arena_farm_crops where id = p.crop)::double precision;
  g = p.progress; at = p.progress_at;
  wet = p.wet or exists (select 1 from generate_series(public.arena_farm_slot(p.planted_at),
    public.arena_farm_slot(p.progress_at)) x where public.arena_farm_weather(x) = 'rain');
  if g >= 1 then
    g = 1; ripe_at = p.progress_at; ripe_weather = public.arena_farm_weather(public.arena_farm_slot(at));
    return;
  end if;
  loop
    s = public.arena_farm_slot(at);
    w = public.arena_farm_weather(s);
    if w = 'rain' then wet = true; end if;
    seg_end = to_timestamp((s + 1) * 14400);
    rate = base * (case when wet then 1.35 else 1 end) * public.arena_farm_weather_speed(w);
    need = (1 - g) / rate;
    if at + make_interval(secs => need) <= least(seg_end, upto) then
      g = 1; ripe_at = at + make_interval(secs => need); ripe_weather = w;
      return;
    end if;
    if seg_end >= upto then
      g = least(1, g + rate * greatest(0, extract(epoch from (upto - at))));
      return;
    end if;
    g = g + rate * extract(epoch from (seg_end - at));
    at = seg_end;
    steps = steps + 1;
    if steps > 1000 then return; end if;
  end loop;
end; $$;

-- Count every crop's growth up to now (before its speed changes). A ripe
-- crop keeps the moment it ripened.
create or replace function public.arena_farm_rebase(pid uuid, t timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare p public.arena_farm_plots; s record;
begin
  for p in select * from public.arena_farm_plots where player_id = pid and crop is not null for update loop
    select * into s from public.arena_farm_sim(p, t);
    update public.arena_farm_plots set progress = s.g,
      progress_at = case when s.g >= 1 then coalesce(s.ripe_at, t) else t end
     where player_id = pid and idx = p.idx;
  end loop;
end; $$;

-- Rich Soil: 3 crops a harvest while Terradon farms.
create or replace function public.arena_farm_yield(pid uuid, p_idx integer) returns integer
language sql stable security definer set search_path = public as $$
  select case when (select farmer from public.arena_farms where player_id = pid) = 'terradon' then 3 else 2 end
$$;

-- Night Stalker: a plain crop of that plot for each bug Duskveil catches
-- (when the barn has room).
create or replace function public.arena_farm_caught(pid uuid, p_idx integer) returns void
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_crop text;
begin
  select * into f from public.arena_farms where player_id = pid;
  if f.farmer is distinct from 'duskveil' then return; end if;
  select crop into v_crop from public.arena_farm_plots where player_id = pid and idx = p_idx;
  if v_crop is null or (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = pid)
      >= 80 + 40 * f.barn_upgrades then
    return;
  end if;
  insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (pid, v_crop, '', 1)
  on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 1;
end; $$;

-- Pests as in 045; no bugs while Warmth lasts.
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
  chance = case when f.warm_until > t then 0 else 1 - exp(-0.00005 * (case when f.scarecrow then 0.5 else 1 end)
    * (case when v_dog = 'black' then 0.7 else 1 end) * secs) end;
  if chance > 0 then
    for p in select * from public.arena_farm_plots
        where player_id = pid and owned and crop is not null and pests < 2 order by idx loop
      if random() < chance and public.arena_farm_growth(p, t) < 1 then
        perform public.arena_farm_set_pests(pid, p.idx, p.pests + 1, t);
        n = n + 1;
      end if;
    end loop;
  end if;
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

-- Actions: as in 045 (hire a dog, shoo a crow), plus `farmer` and `perk`.
create or replace function public.arena_farm_act_more(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_dog text; v_days integer; cost integer; v_level integer;
  cur public.arena_farm_dog_hires; plot integer; p public.arena_farm_plots; v_perk text;
  inserted integer; n integer; v_plots jsonb; s record;
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
  elsif a->>'a' = 'farmer' then
    if a->>'id' is null or a->>'id' not in ('voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil') then
      err = 'Choose a valid champion';
    else
      if f.farmer is distinct from a->>'id' then
        perform public.arena_farm_rebase(pid, t);
        update public.arena_farms set farmer = a->>'id' where player_id = pid;
      end if;
      gained = jsonb_build_object('farmer', a->>'id');
    end if;
  elsif a->>'a' = 'perk' then
    v_perk = case f.farmer when 'voltkit' then 'zap' when 'tidefin' then 'downpour' when 'cindrake' then 'warmth' end;
    if v_perk is null then err = 'Your farmer''s perk is always on';
    else
      insert into public.arena_farm_perk_uses(player_id, perk, day) values (pid, v_perk, d) on conflict do nothing;
      get diagnostics inserted = row_count;
      if inserted = 0 then err = 'Already used today. It''s back tomorrow';
      elsif v_perk = 'zap' then
        n = 0;
        for p in select * from public.arena_farm_plots where player_id = pid and pests > 0 order by idx loop
          n = n + p.pests;
          perform public.arena_farm_set_pests(pid, p.idx, 0, t);
        end loop;
        gained = jsonb_build_object('perk', 'zap', 'cleared', n);
      elsif v_perk = 'downpour' then
        v_plots = '[]'::jsonb;
        for p in select * from public.arena_farm_plots where player_id = pid and owned and crop is not null
            order by idx for update loop
          select * into s from public.arena_farm_sim(p, t);
          if s.g >= 1 or s.wet then continue; end if;
          update public.arena_farm_plots set progress = s.g, progress_at = t, wet = true
           where player_id = pid and idx = p.idx;
          v_plots = v_plots || to_jsonb(p.idx);
        end loop;
        gained = jsonb_build_object('perk', 'downpour', 'watered', v_plots);
      else
        update public.arena_farms set warm_until = t + interval '4 hours' where player_id = pid;
        gained = jsonb_build_object('perk', 'warmth', 'until', t + interval '4 hours');
      end if;
    end if;
  else
    err = 'Unknown action';
  end if;
end; $$;
revoke all on function public.arena_farm_sim(public.arena_farm_plots, timestamptz),
  public.arena_farm_rebase(uuid, timestamptz), public.arena_farm_yield(uuid, integer),
  public.arena_farm_caught(uuid, integer), public.arena_farm_bugs(uuid),
  public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date)
  from public, anon, authenticated, service_role;

-- The farm state as in 045, plus the farmer, today's used perks and
-- Warmth. The third forecast is Mystowl's.
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (select public.arena_farm_state_core(pid) j, f.farmer, f.warm_until
    from public.arena_farms f where f.player_id = pid)
  select c.j || jsonb_build_object(
    'weather', case when c.farmer = 'mystowl' then c.j->'weather' else (c.j->'weather') - 'later' end,
    'farmer', c.farmer,
    'perksUsed', coalesce((select jsonb_agg(u.perk order by u.perk) from public.arena_farm_perk_uses u
      where u.player_id = pid and u.day = public.arena_today()), '[]'::jsonb),
    'warmUntil', case when c.warm_until > now() then c.warm_until end,
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
  from c
$$;
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;
commit;

select
  exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'arena_farms' and column_name = 'farmer') as farm_perks_enabled,
  to_regclass('public.arena_farm_perk_uses') is not null as farm_perk_uses_enabled;
