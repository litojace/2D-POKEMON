-- Hub redesign, phase 4: the Elemental Farm (minimum version).
-- Run after 036_gold_leaves.sql. Safe to run again.
-- The server owns time: growth is stored as (progress, progress_at) and read
-- with now(); every change goes through arena_farm_act. Numbers match
-- packages/shared/src/farm.ts (checked by tests/integration/farm.test.ts).
begin;

create table if not exists public.arena_farm_crops (
  id text primary key,
  name text not null,
  level integer not null check (level between 1 and 100),
  grow_seconds integer not null check (grow_seconds > 0),
  seed_cost integer not null check (seed_cost > 0),
  sell integer not null check (sell > 0),
  xp integer not null check (xp > 0),
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'legendary'))
);
insert into public.arena_farm_crops(id, name, level, grow_seconds, seed_cost, sell, xp, rarity) values
  ('wheat', 'Breeze Wheat', 1, 3600, 5, 5, 3, 'common'),
  ('carrot', 'Earth Carrot', 1, 4800, 5, 5, 4, 'common'),
  ('voltberry', 'Volt Berry', 2, 6000, 5, 5, 5, 'common'),
  ('pepper', 'Ember Pepper', 4, 7200, 5, 5, 5, 'common'),
  ('mint', 'Spirit Mint', 3, 6720, 5, 5, 5, 'common'),
  ('lotus', 'Tide Lotus', 6, 8400, 5, 6, 6, 'common'),
  ('lumen', 'Lumen Bloom', 8, 9600, 10, 9, 7, 'common'),
  ('duskcap', 'Dusk Cap', 10, 10800, 10, 9, 7, 'common'),
  ('plum', 'Mind Plum', 12, 12000, 10, 9, 8, 'common'),
  ('pumpkin', 'Lava Pumpkin', 17, 14400, 15, 13, 11, 'uncommon'),
  ('grape', 'Thunder Grape', 15, 13200, 15, 13, 10, 'uncommon'),
  ('yam', 'Crystal Yam', 25, 16800, 15, 14, 12, 'uncommon'),
  ('cactus', 'Sun Cactus', 22, 15600, 15, 14, 12, 'uncommon'),
  ('kelp', 'Star Kelp', 19, 14400, 15, 13, 11, 'uncommon'),
  ('poppy', 'Dream Poppy', 28, 18000, 15, 14, 13, 'uncommon'),
  ('melon', 'Storm Melon', 35, 21600, 25, 22, 18, 'rare'),
  ('orange', 'Phoenix Orange', 42, 24000, 25, 23, 19, 'rare'),
  ('pearl', 'Pearl Pea', 38, 22800, 25, 23, 19, 'rare'),
  ('halotea', 'Halo Tea', 31, 20400, 20, 18, 14, 'uncommon'),
  ('cotton', 'Void Cotton', 46, 26400, 25, 24, 21, 'rare'),
  ('ginseng', 'Stone Ginseng', 50, 28800, 30, 27, 22, 'rare'),
  ('starfruit', 'Rainbow Starfruit', 66, 36000, 45, 41, 32, 'legendary'),
  ('boltcorn', 'Twin Bolt Corn', 60, 33600, 40, 37, 31, 'legendary'),
  ('emberlily', 'Dragon Lily', 72, 38400, 45, 42, 34, 'legendary'),
  ('dreamshroom', 'Dreamwhale Shroom', 80, 43200, 50, 46, 37, 'legendary')
on conflict (id) do update set name = excluded.name, level = excluded.level,
  grow_seconds = excluded.grow_seconds, seed_cost = excluded.seed_cost,
  sell = excluded.sell, xp = excluded.xp, rarity = excluded.rarity;

create table if not exists public.arena_farms (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  level integer not null default 1 check (level between 1 and 100),
  -- XP into the current level.
  xp bigint not null default 0 check (xp >= 0),
  land_bought integer not null default 0 check (land_bought between 0 and 35),
  barn_upgrades integer not null default 0 check (barn_upgrades between 0 and 100),
  fert_norm integer not null default 3 check (fert_norm >= 0),
  fert_super integer not null default 1 check (fert_super >= 0),
  fert_gold integer not null default 0 check (fert_gold >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.arena_farm_plots (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  idx smallint not null check (idx between 0 and 49),
  owned boolean not null default false,
  crop text references public.arena_farm_crops(id),
  planted_at timestamptz,
  -- Growth 0–1 as of progress_at; read it at any time with arena_farm_growth.
  progress double precision not null default 0 check (progress between 0 and 1),
  progress_at timestamptz,
  wet boolean not null default false,
  fertilizer text check (fertilizer in ('norm', 'gold')),
  mutation text,
  primary key (player_id, idx)
);
create table if not exists public.arena_farm_seeds (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  crop text not null references public.arena_farm_crops(id),
  qty integer not null default 0 check (qty >= 0),
  primary key (player_id, crop)
);
create table if not exists public.arena_farm_barn (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  crop text not null references public.arena_farm_crops(id),
  mutation text not null default '',
  qty integer not null default 0 check (qty >= 0),
  primary key (player_id, crop, mutation)
);
-- Seeds bought per restock window (the stock list is the same for everyone,
-- the quantities are per player).
create table if not exists public.arena_farm_purchases (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  restock bigint not null,
  crop text not null references public.arena_farm_crops(id),
  qty integer not null default 0 check (qty >= 0),
  primary key (player_id, restock, crop)
);
-- Harvests per crop (the crop book and, later, mastery).
create table if not exists public.arena_farm_harvests (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  crop text not null references public.arena_farm_crops(id),
  harvests integer not null default 0 check (harvests >= 0),
  primary key (player_id, crop)
);
-- Requests already applied: a retried request is answered, never applied twice.
create table if not exists public.arena_farm_requests (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  request uuid not null,
  created_at timestamptz not null default now(),
  primary key (player_id, request)
);
create index if not exists arena_farm_requests_age on public.arena_farm_requests(created_at);
alter table public.arena_farm_crops enable row level security;
alter table public.arena_farms enable row level security;
alter table public.arena_farm_plots enable row level security;
alter table public.arena_farm_seeds enable row level security;
alter table public.arena_farm_barn enable row level security;
alter table public.arena_farm_purchases enable row level security;
alter table public.arena_farm_harvests enable row level security;
alter table public.arena_farm_requests enable row level security;
revoke all on public.arena_farm_crops, public.arena_farms, public.arena_farm_plots,
  public.arena_farm_seeds, public.arena_farm_barn, public.arena_farm_purchases,
  public.arena_farm_harvests, public.arena_farm_requests
  from public, anon, authenticated, service_role;

insert into public.arena_titles(name, description, color, active)
select v.name, v.description, '#9be07a', true from (values
  ('Green Thumb', 'Reach farm level 25.'),
  ('Master Grower', 'Reach farm level 50.'),
  ('Harvest Legend', 'Reach farm level 75.'),
  ('Elemental Farmer', 'Reach farm level 100.')
) v(name, description)
where not exists (select 1 from public.arena_titles t where t.name = v.name);

-- A number in [0, 1) from text, the same on every call (prices, stock).
create or replace function public.arena_farm_hash(p text) returns double precision
language sql immutable set search_path = '' as $$
  select ('x' || substr(md5(p), 1, 8))::bit(32)::bigint / 4294967296.0
$$;
-- XP from a farm level to the next.
create or replace function public.arena_farm_need(p_level integer) returns integer
language sql immutable set search_path = '' as $$
  select case when p_level >= 100 then 0
    else (round((40 + 2.418 * power(p_level, 2.1)) / 10) * 10)::integer end
$$;
create or replace function public.arena_farm_land_level(k integer) returns integer
language sql immutable set search_path = '' as $$
  select (array[3,5,7,9,11,14,16,18,20,22,24,26,28,30,32,34,37,39,41,43,45,47,49,51,53,56,58,60,62,64,66,68,70,72,74])[k + 1]
$$;
create or replace function public.arena_farm_land_price(k integer) returns integer
language sql immutable set search_path = '' as $$
  select (array[350,400,500,600,650,800,1150,1200,1250,1400,1450,1500,1550,1600,1700,1750,1800,1850,1900,1950,2000,2050,2100,2200,2250,2300,2350,2450,2500,2550,2600,2700,2750,2800,2850])[k + 1]
$$;
-- Growth speed per second: watered ×1.35, fertilized ×1.4.
create or replace function public.arena_farm_rate(p public.arena_farm_plots) returns double precision
language sql stable set search_path = public as $$
  select case when p.crop is null then 0 else
    (case when p.wet then 1.35 else 1 end) * (case when p.fertilizer is not null then 1.4 else 1 end)
      / (select grow_seconds from public.arena_farm_crops where id = p.crop)::double precision end
$$;
-- Growth 0–1 of a plot at a time.
create or replace function public.arena_farm_growth(p public.arena_farm_plots, at timestamptz) returns double precision
language sql stable set search_path = public as $$
  select case when p.crop is null then 0 else least(1, p.progress +
    public.arena_farm_rate(p) * greatest(0, extract(epoch from (at - p.progress_at)))) end
$$;
create or replace function public.arena_farm_ripe_at(p public.arena_farm_plots) returns timestamptz
language sql stable set search_path = public as $$
  select case when p.crop is null then null
    when p.progress >= 1 then p.progress_at
    else p.progress_at + make_interval(secs => (1 - p.progress) / public.arena_farm_rate(p)) end
$$;
-- Today's market: every crop between ×0.70 and ×1.60; one HOT crop per
-- player and Pacific day between ×1.60 and ×1.90, picked from crops they grow.
create or replace function public.arena_farm_market(p_day date, p_level integer, pid uuid)
returns table(crop text, mult numeric, hot boolean)
language sql stable set search_path = public as $$
  with hot as (
    select c.id from public.arena_farm_crops c where c.level <= greatest(1, p_level)
    order by md5('hot:' || p_day::text || ':' || pid::text || ':' || c.id) limit 1
  )
  select c.id,
    case when c.id = (select id from hot)
      then round((1.6 + 0.3 * public.arena_farm_hash('hotx:' || p_day::text || ':' || c.id))::numeric, 2)
      else round((0.7 + 0.9 * public.arena_farm_hash('mkt:' || p_day::text || ':' || c.id))::numeric, 2) end,
    c.id = (select id from hot)
  from public.arena_farm_crops c
$$;
-- Seed restocks every 4 hours at 02:00, 06:00, … UTC. The stock list is the
-- same for everyone; each player can buy up to it.
create or replace function public.arena_farm_restock(at timestamptz) returns bigint
language sql immutable set search_path = '' as $$
  select floor((extract(epoch from at) - 7200) / 14400)::bigint
$$;
create or replace function public.arena_farm_stock(p_restock bigint, p_crop text, p_rarity text) returns integer
language sql immutable set search_path = public as $$
  select case p_rarity
    when 'common' then 20 + floor(10 * public.arena_farm_hash('stock:' || p_restock || ':' || p_crop))::int
    when 'uncommon' then 4 + floor(7 * public.arena_farm_hash('stock:' || p_restock || ':' || p_crop))::int
    when 'rare' then case when public.arena_farm_hash('roll:' || p_restock || ':' || p_crop) < 0.6
      then 1 + floor(4 * public.arena_farm_hash('stock:' || p_restock || ':' || p_crop))::int else 0 end
    else case when public.arena_farm_hash('roll:' || p_restock || ':' || p_crop) < 0.2 then 1 else 0 end end
$$;
revoke all on function public.arena_farm_hash(text), public.arena_farm_need(integer),
  public.arena_farm_land_level(integer), public.arena_farm_land_price(integer),
  public.arena_farm_rate(public.arena_farm_plots), public.arena_farm_growth(public.arena_farm_plots, timestamptz),
  public.arena_farm_ripe_at(public.arena_farm_plots), public.arena_farm_market(date, integer, uuid),
  public.arena_farm_restock(timestamptz), public.arena_farm_stock(bigint, text, text)
  from public, anon, authenticated, service_role;

-- A new farm: 15 plots, starter seeds and fertilizer, and 100 Gold Leaves.
create or replace function public.arena_farm_ensure(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  insert into public.arena_farms(player_id) values (pid) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;
  insert into public.arena_farm_plots(player_id, idx, owned)
  select pid, i, (i % 10) < 5 and (i / 10) < 3 from generate_series(0, 49) i
  on conflict do nothing;
  insert into public.arena_farm_seeds(player_id, crop, qty) values (pid, 'wheat', 10), (pid, 'carrot', 6)
  on conflict do nothing;
  perform public.arena_grant_leaves(pid, 100, 'farm-welcome', 'welcome', public.arena_today());
end; $$;

-- Farm XP with level-ups: Gold Leaves every level, fertilizer every 5,
-- Gold Fertilizer every 10, titles at 25, 50, 75 and 100.
create or replace function public.arena_farm_add_xp(pid uuid, amount integer) returns void
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_title text;
begin
  if amount <= 0 then return; end if;
  select * into f from public.arena_farms where player_id = pid for update;
  f.xp = f.xp + amount;
  while f.level < 100 and f.xp >= public.arena_farm_need(f.level) loop
    f.xp = f.xp - public.arena_farm_need(f.level);
    f.level = f.level + 1;
    perform public.arena_grant_leaves(pid, 40 + 10 * f.level, 'farm-level', f.level::text, public.arena_today());
    if f.level % 5 = 0 then f.fert_norm = f.fert_norm + 3; f.fert_super = f.fert_super + 1; end if;
    if f.level % 10 = 0 then f.fert_gold = f.fert_gold + 1; end if;
    v_title = case f.level when 25 then 'Green Thumb' when 50 then 'Master Grower'
      when 75 then 'Harvest Legend' when 100 then 'Elemental Farmer' else null end;
    if v_title is not null then
      insert into public.arena_player_titles(player_id, title_id)
      select pid, id from public.arena_titles where name = v_title on conflict do nothing;
    end if;
  end loop;
  if f.level >= 100 then f.xp = 0; end if;
  update public.arena_farms set level = f.level, xp = f.xp, fert_norm = f.fert_norm,
    fert_super = f.fert_super, fert_gold = f.fert_gold where player_id = pid;
end; $$;
revoke all on function public.arena_farm_ensure(uuid), public.arena_farm_add_xp(uuid, integer)
  from public, anon, authenticated, service_role;

-- The farm as the player sees it, read at the server's now().
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f public.arena_farms; t timestamptz = now(); d date = public.arena_today(); r bigint;
begin
  select * into f from public.arena_farms where player_id = pid;
  r = public.arena_farm_restock(t);
  return jsonb_build_object(
    'now', t,
    'level', f.level,
    'xp', f.xp,
    'landBought', f.land_bought,
    'barnCap', 80 + 40 * f.barn_upgrades,
    'barnUpgrades', f.barn_upgrades,
    'fertilizer', jsonb_build_object('norm', f.fert_norm, 'super', f.fert_super, 'gold', f.fert_gold),
    'plots', (select jsonb_agg(jsonb_build_object(
        'i', p.idx, 'owned', p.owned, 'crop', p.crop,
        'progress', round(public.arena_farm_growth(p, t)::numeric, 4),
        'ripeAt', public.arena_farm_ripe_at(p),
        'wet', p.wet, 'fertilizer', p.fertilizer, 'mutation', p.mutation) order by p.idx)
      from public.arena_farm_plots p where p.player_id = pid),
    'seeds', coalesce((select jsonb_object_agg(crop, qty) from public.arena_farm_seeds
      where player_id = pid and qty > 0), '{}'::jsonb),
    'barn', coalesce((select jsonb_agg(jsonb_build_object('crop', crop, 'mutation', mutation, 'qty', qty)
        order by crop, mutation) from public.arena_farm_barn where player_id = pid and qty > 0), '[]'::jsonb),
    'harvests', coalesce((select jsonb_object_agg(crop, harvests) from public.arena_farm_harvests
      where player_id = pid), '{}'::jsonb),
    'market', jsonb_build_object('day', d,
      'mult', (select jsonb_object_agg(m.crop, m.mult) from public.arena_farm_market(d, f.level, pid) m),
      'hot', (select m.crop from public.arena_farm_market(d, f.level, pid) m where m.hot)),
    'shop', jsonb_build_object('window', r,
      'restockAt', to_timestamp((r + 1) * 14400 + 7200),
      'stock', (select jsonb_object_agg(c.id, greatest(0, public.arena_farm_stock(r, c.id, c.rarity)
          - coalesce((select qty from public.arena_farm_purchases b
              where b.player_id = pid and b.restock = r and b.crop = c.id), 0)))
        from public.arena_farm_crops c)),
    'leaves', coalesce((select balance from public.arena_leaf_wallets where player_id = pid), 0));
end; $$;
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_farm() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_farm_ensure(me);
  return public.arena_farm_state(me);
end; $$;
revoke all on function public.arena_farm() from public, anon;
grant execute on function public.arena_farm() to authenticated;

-- Apply a list of farm actions in order (a drag across plots is one request).
-- Each action succeeds or reports why not; nothing trusts the client's clock.
-- Actions: plant {plot, crop} · water {plot} · fertilize {plot, kind} ·
-- harvest {plot} · dig {plot} · buy-seeds {crop, qty} · buy-land {plot} ·
-- sell {crop, mutation, qty} · buy-fertilizer {kind} · upgrade-barn.
create or replace function public.arena_farm_act(p_request uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); t timestamptz = now(); d date = public.arena_today();
  f public.arena_farms; a jsonb; i integer = 0; kind text; plot integer; p public.arena_farm_plots;
  c public.arena_farm_crops; g double precision; n integer; cost integer; used integer;
  results jsonb = '[]'::jsonb; err text; gained jsonb; harvested integer = 0; v_xp integer = 0;
  inserted integer; r bigint; left_stock integer; v_owned boolean[]; k integer; v_mult numeric;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or jsonb_typeof(p_actions) is distinct from 'array'
     or jsonb_array_length(p_actions) not between 1 and 60 then
    raise exception 'Invalid farm request';
  end if;
  perform public.arena_farm_ensure(me);
  -- One request at a time per farm.
  select * into f from public.arena_farms where player_id = me for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('farm', public.arena_farm_state(me), 'results', '[]'::jsonb, 'repeated', true);
  end if;
  delete from public.arena_farm_requests where player_id = me and created_at < t - interval '2 days';
  for a in select * from jsonb_array_elements(p_actions) loop
    i = i + 1; err = null; gained = null;
    kind = a->>'a';
    plot = case when jsonb_typeof(a->'plot') = 'number' then (a->>'plot')::integer else null end;
    p = null;
    if plot is not null and plot between 0 and 49 then
      select * into p from public.arena_farm_plots where player_id = me and idx = plot for update;
    end if;
    select * into f from public.arena_farms where player_id = me;
    if kind in ('plant', 'water', 'fertilize', 'harvest', 'dig', 'buy-land') and p.idx is null then
      err = 'Unknown plot';
    elsif kind = 'plant' then
      select * into c from public.arena_farm_crops where id = a->>'crop';
      if not p.owned then err = 'Buy this plot first';
      elsif p.crop is not null then err = 'Something is already growing here';
      elsif c.id is null then err = 'Unknown crop';
      elsif c.level > f.level then err = 'Unlocks at farm level ' || c.level;
      else
        update public.arena_farm_seeds set qty = qty - 1 where player_id = me and crop = c.id and qty > 0;
        get diagnostics used = row_count;
        if used = 0 then err = 'Out of ' || c.name || ' seeds';
        else
          update public.arena_farm_plots set crop = c.id, planted_at = t, progress = 0, progress_at = t,
            wet = false, fertilizer = null, mutation = null where player_id = me and idx = plot;
        end if;
      end if;
    elsif kind = 'water' then
      g = public.arena_farm_growth(p, t);
      if p.crop is null or g >= 1 then err = 'Nothing growing here';
      elsif p.wet then err = 'Already watered';
      else
        update public.arena_farm_plots set progress = g, progress_at = t, wet = true
         where player_id = me and idx = plot;
      end if;
    elsif kind = 'fertilize' then
      g = public.arena_farm_growth(p, t);
      if p.crop is null or g >= 1 then err = 'Nothing growing here';
      elsif a->>'kind' = 'super' then
        if f.level < 6 then err = 'Unlocks at farm level 6';
        elsif f.fert_super < 1 then err = 'Out of Super Fertilizer';
        else
          update public.arena_farms set fert_super = fert_super - 1 where player_id = me;
          update public.arena_farm_plots set progress = least(0.999, g + 0.5), progress_at = t
           where player_id = me and idx = plot;
        end if;
      elsif a->>'kind' in ('norm', 'gold') then
        if p.fertilizer is not null then err = 'This plot is already fertilized';
        elsif a->>'kind' = 'gold' and f.level < 24 then err = 'Unlocks at farm level 24';
        elsif (a->>'kind' = 'norm' and f.fert_norm < 1) or (a->>'kind' = 'gold' and f.fert_gold < 1) then
          err = 'Out of that fertilizer';
        else
          update public.arena_farms set fert_norm = fert_norm - case when a->>'kind' = 'norm' then 1 else 0 end,
            fert_gold = fert_gold - case when a->>'kind' = 'gold' then 1 else 0 end where player_id = me;
          update public.arena_farm_plots set progress = g, progress_at = t, fertilizer = a->>'kind'
           where player_id = me and idx = plot;
        end if;
      else err = 'Unknown fertilizer';
      end if;
    elsif kind = 'harvest' then
      g = public.arena_farm_growth(p, t);
      if p.crop is null then err = 'Nothing to harvest';
      elsif g < 1 then err = 'Not ripe yet';
      elsif (select coalesce(sum(b.qty), 0) from public.arena_farm_barn b where b.player_id = me) + 2
            > 80 + 40 * f.barn_upgrades then err = 'Your barn is full';
      else
        select * into c from public.arena_farm_crops where id = p.crop;
        insert into public.arena_farm_barn(player_id, crop, mutation, qty)
        values (me, p.crop, coalesce(p.mutation, ''), 2)
        on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 2;
        insert into public.arena_farm_harvests(player_id, crop, harvests) values (me, p.crop, 1)
        on conflict (player_id, crop) do update set harvests = public.arena_farm_harvests.harvests + 1;
        update public.arena_farm_plots set crop = null, planted_at = null, progress = 0, progress_at = null,
          wet = false, fertilizer = null, mutation = null where player_id = me and idx = plot;
        harvested = harvested + 1;
        v_xp = v_xp + c.xp;
        gained = jsonb_build_object('crop', c.id, 'qty', 2, 'xp', c.xp);
      end if;
    elsif kind = 'dig' then
      if p.crop is null then err = 'Nothing to dig up';
      else
        update public.arena_farm_plots set crop = null, planted_at = null, progress = 0, progress_at = null,
          wet = false, fertilizer = null, mutation = null where player_id = me and idx = plot;
      end if;
    elsif kind = 'buy-seeds' then
      select * into c from public.arena_farm_crops where id = a->>'crop';
      n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer else 1 end;
      r = public.arena_farm_restock(t);
      if c.id is null then err = 'Unknown crop';
      elsif n is null or n < 1 or n > 50 then err = 'Choose how many seeds';
      elsif c.level > f.level then err = 'Unlocks at farm level ' || c.level;
      else
        left_stock = public.arena_farm_stock(r, c.id, c.rarity) - coalesce((select b.qty from public.arena_farm_purchases b
          where b.player_id = me and b.restock = r and b.crop = c.id), 0);
        if n > left_stock then err = case when left_stock <= 0 then 'Sold out until the restock' else 'Only ' || left_stock || ' left' end;
        elsif not public.arena_spend_leaves(me, c.seed_cost * n, 'farm-seeds', p_request || ':' || i, d) then
          err = 'Not enough Gold Leaves';
        else
          insert into public.arena_farm_purchases(player_id, restock, crop, qty) values (me, r, c.id, n)
          on conflict (player_id, restock, crop) do update set qty = public.arena_farm_purchases.qty + n;
          insert into public.arena_farm_seeds(player_id, crop, qty) values (me, c.id, n)
          on conflict (player_id, crop) do update set qty = public.arena_farm_seeds.qty + n;
        end if;
      end if;
    elsif kind = 'buy-land' then
      k = f.land_bought;
      select array_agg(x.owned order by x.idx) into v_owned from public.arena_farm_plots x where x.player_id = me;
      if p.owned then err = 'You already own this plot';
      elsif k >= 35 then err = 'You own every plot';
      elsif not ((plot % 10 > 0 and v_owned[plot]) or (plot % 10 < 9 and v_owned[plot + 2])
                 or (plot >= 10 and v_owned[plot - 9]) or (plot < 40 and v_owned[plot + 11])) then
        err = 'You can only buy plots next to land you own';
      elsif f.level < public.arena_farm_land_level(k) then err = 'Needs farm level ' || public.arena_farm_land_level(k);
      elsif not public.arena_spend_leaves(me, public.arena_farm_land_price(k), 'farm-land', (k + 1)::text, d) then
        err = 'Not enough Gold Leaves';
      else
        update public.arena_farm_plots set owned = true where player_id = me and idx = plot;
        update public.arena_farms set land_bought = land_bought + 1 where player_id = me;
        v_xp = v_xp + 10;
      end if;
    elsif kind = 'sell' then
      select * into c from public.arena_farm_crops where id = a->>'crop';
      n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer else null end;
      if c.id is null then err = 'Unknown crop';
      elsif n is null or n < 1 or n > 10000 then err = 'Choose how many to sell';
      else
        update public.arena_farm_barn b set qty = b.qty - n
         where b.player_id = me and b.crop = c.id and b.mutation = coalesce(a->>'mutation', '') and b.qty >= n;
        get diagnostics used = row_count;
        if used = 0 then err = 'You don''t have that many';
        else
          select m.mult into v_mult from public.arena_farm_market(d, f.level, me) m where m.crop = c.id;
          cost = greatest(1, round(c.sell * coalesce(v_mult, 1)))::integer * n;
          perform public.arena_grant_leaves(me, cost, 'farm-sell', p_request || ':' || i, d);
          gained = jsonb_build_object('leaves', cost);
        end if;
      end if;
    elsif kind = 'buy-fertilizer' then
      cost = case a->>'kind' when 'norm' then 60 when 'super' then 90 when 'gold' then 200 else null end;
      if cost is null then err = 'Unknown fertilizer';
      elsif (a->>'kind' = 'super' and f.level < 6) or (a->>'kind' = 'gold' and f.level < 24) then
        err = 'Unlocks at farm level ' || case a->>'kind' when 'super' then 6 else 24 end;
      elsif not public.arena_spend_leaves(me, cost, 'farm-fertilizer', p_request || ':' || i, d) then
        err = 'Not enough Gold Leaves';
      else
        update public.arena_farms set
          fert_norm = fert_norm + case when a->>'kind' = 'norm' then 3 else 0 end,
          fert_super = fert_super + case when a->>'kind' = 'super' then 1 else 0 end,
          fert_gold = fert_gold + case when a->>'kind' = 'gold' then 1 else 0 end
         where player_id = me;
      end if;
    elsif kind = 'upgrade-barn' then
      cost = 250 * (f.barn_upgrades + 1);
      if f.barn_upgrades >= 100 then err = 'Your barn is as big as it gets';
      elsif not public.arena_spend_leaves(me, cost, 'farm-barn', (f.barn_upgrades + 1)::text, d) then
        err = 'Not enough Gold Leaves';
      else
        update public.arena_farms set barn_upgrades = barn_upgrades + 1 where player_id = me;
      end if;
    else
      err = 'Unknown action';
    end if;
    results = results || jsonb_build_array(case when err is null
      then jsonb_build_object('ok', true) || coalesce(gained, '{}'::jsonb)
      else jsonb_build_object('ok', false, 'error', err) end);
  end loop;
  -- A drag that harvests three or more plots earns a combo bonus.
  if harvested >= 3 then v_xp = v_xp + 3 * harvested; end if;
  perform public.arena_farm_add_xp(me, v_xp);
  return jsonb_build_object('farm', public.arena_farm_state(me), 'results', results,
    'combo', case when harvested >= 3 then harvested else 0 end, 'xp', v_xp);
end; $$;
revoke all on function public.arena_farm_act(uuid, jsonb) from public, anon;
grant execute on function public.arena_farm_act(uuid, jsonb) to authenticated;
commit;

select
  (select count(*) from public.arena_farm_crops) = 25 as farm_crops_seeded,
  to_regprocedure('public.arena_farm_act(uuid,jsonb)') is not null as farm_actions_enabled;
