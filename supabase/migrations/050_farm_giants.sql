-- Hub redesign, decision 5: giant crops.
-- Run after 049_farm_pasture.sql. Safe to run again.
--  * Earth Carrot, Dusk Cap, Lava Pumpkin and Storm Melon can grow giant.
--    When a 3×3 square of one of them is all ripe, it is rolled once, for
--    the moment its last crop ripened: 10% that the square is one giant
--    crop. The roll comes from the secret salt (039), the player, the
--    square and its 9 plantings, so reading the farm again never re-rolls
--    it; only a new planting is a new roll. Where squares overlap, the one
--    that formed first wins (then the lower plot number).
--  * A giant is worked out from its plots, which keep their crops. The
--    `harvest-giant` action harvests it: each of its 9 crops gives twice
--    its harvest (36 crops, 54 with Rich Soil; one less for each crop a
--    friend snuck), keeping its own mutation, for twice the XP. It counts
--    as 9 harvests (crop book, mastery) and one giant grown, and needs
--    barn room for all of it. A plain `harvest` or `dig` of one of its
--    plots (arena_farm_act_core, not changed here) still works on that
--    plot and breaks the giant; a giant always gives more.
--  * Crows don't land on a giant. Friends see giants (arena_farm_view).
--  * Hooks (049): the action goes through arena_farm_act_extra and the
--    giants through arena_farm_state_extra, so arena_farm_act_core and
--    arena_farm_state are not copied. A friend's farm has no hook, so
--    arena_farm_view is as in 049 plus the giants.
--  * Tests pin the chance for their session with
--    set_config('arena.farm_giants', 'always' | 'never', false), as 044
--    does for bugs. Only the game server calls the database, and requests
--    can't set it.
begin;

alter table public.arena_farm_crops add column if not exists giant boolean not null default false;
update public.arena_farm_crops set giant = id in ('carrot', 'duskcap', 'pumpkin', 'melon')
 where giant is distinct from (id in ('carrot', 'duskcap', 'pumpkin', 'melon'));
-- Giants grown per crop (the crop book).
alter table public.arena_farm_harvests add column if not exists giants integer not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'arena_farm_harvests_giants_check'
      and conrelid = 'public.arena_farm_harvests'::regclass) then
    alter table public.arena_farm_harvests add constraint arena_farm_harvests_giants_check check (giants >= 0);
  end if;
end $$;

-- The chance for a full square (tests can pin it, see above).
create or replace function public.arena_farm_giant_chance() returns double precision
language sql stable set search_path = '' as $$
  select (case current_setting('arena.farm_giants', true)
    when 'always' then 1 when 'never' then 0 else 0.1 end)::double precision
$$;
-- A secret number in [0, 1) for one square: its top-left plot and the 9
-- plantings (in plot order).
create or replace function public.arena_farm_giant_roll(pid uuid, p_idx integer, p_planted timestamptz[])
returns double precision
language sql stable security definer set search_path = public as $$
  select public.arena_farm_hash((select salt from public.arena_farm_salt where id = 1)
    || ':' || pid || ':giant:' || p_idx || ':'
    || array_to_string(array(select extract(epoch from x.at)::text
      from unnest(p_planted) with ordinality x(at, n) order by x.n), ','))
$$;

-- The giant crops on a farm at a moment: each square's top-left plot, its
-- crop, its 9 plots and when it formed (its last crop ripened).
create or replace function public.arena_farm_giants(pid uuid, t timestamptz)
returns table(idx integer, crop text, plots integer[], formed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare b record; taken integer[] = '{}'; chance double precision = public.arena_farm_giant_chance();
begin
  if chance <= 0 then return; end if;
  for b in
    with g0 as (
      -- Plots holding a crop that can grow giant (growth not worked out yet).
      select p.idx::integer idx, p.crop from public.arena_farm_plots p
      join public.arena_farm_crops c on c.id = p.crop and c.giant
      where p.player_id = pid and p.owned
    ), sq0 as (
      -- Squares whose 9 plots hold one such crop: only these need growth.
      select k from generate_series(0, 27) k
      join g0 on g0.idx / 10 between k / 10 and k / 10 + 2 and g0.idx % 10 between k % 10 and k % 10 + 2
      where k % 10 <= 7
      group by k having count(*) = 9 and count(distinct g0.crop) = 1
    ), r as (
      -- Their ripe crops.
      select p.idx::integer idx, p.crop, p.planted_at, coalesce(s.ripe_at, t) ripe_at
      from public.arena_farm_plots p
      cross join lateral public.arena_farm_sim(p, t) s
      where p.player_id = pid and p.idx in (select x.idx from g0 x join sq0 on x.idx / 10 between sq0.k / 10
          and sq0.k / 10 + 2 and x.idx % 10 between sq0.k % 10 and sq0.k % 10 + 2)
        and s.g >= 1
    ), sq as (
      -- Every square: top-left in rows 0–2 and columns 0–7.
      select k, min(r.crop) crop, count(distinct r.crop) kinds, count(*) n, max(r.ripe_at) formed,
        array_agg(r.idx order by r.idx) cells, array_agg(r.planted_at order by r.idx) planted
      from generate_series(0, 27) k
      join r on r.idx / 10 between k / 10 and k / 10 + 2 and r.idx % 10 between k % 10 and k % 10 + 2
      where k % 10 <= 7
      group by k
    )
    select * from sq where n = 9 and kinds = 1 order by formed, k
  loop
    -- The first to form keeps its plots; a square it overlaps can't be giant.
    continue when b.cells && taken;
    continue when public.arena_farm_giant_roll(pid, b.k, b.planted) >= chance;
    taken = taken || b.cells;
    idx = b.k; crop = b.crop; plots = b.cells; formed_at = b.formed;
    return next;
  end loop;
end; $$;
create or replace function public.arena_farm_giants_json(pid uuid, t timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('i', g.idx, 'crop', g.crop, 'plots', to_jsonb(g.plots),
    'formedAt', g.formed_at) order by g.idx), '[]'::jsonb)
  from public.arena_farm_giants(pid, t) g
$$;

-- Harvest the giant crop that covers a plot.
create or replace function public.arena_farm_harvest_giant(pid uuid, p_plot integer, t timestamptz,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; gi record; c public.arena_farm_crops; q public.arena_farm_plots; s record;
  j integer; base integer; n integer; total integer = 0; v_mut text; v_plots jsonb = '[]'::jsonb;
begin
  xp = 0;
  if p_plot is null or p_plot not between 0 and 49 then err = 'Unknown plot'; return; end if;
  select * into f from public.arena_farms where player_id = pid;
  perform 1 from public.arena_farm_plots where player_id = pid order by idx for update;
  select * into gi from public.arena_farm_giants(pid, t) g where p_plot = any(g.plots);
  if not found then err = 'No giant crop here'; return; end if;
  select * into c from public.arena_farm_crops where id = gi.crop;
  -- Each crop: twice its harvest (2, or 3 with Rich Soil) less what a friend snuck.
  for j in select unnest(gi.plots) loop
    select * into q from public.arena_farm_plots where player_id = pid and idx = j;
    base = public.arena_farm_yield(pid, j) + q.stolen;
    total = total + 2 * base - q.stolen;
  end loop;
  if (select coalesce(sum(b.qty), 0) from public.arena_farm_barn b where b.player_id = pid) + total
      > 80 + 40 * f.barn_upgrades then
    err = 'Your barn is full. This giant needs room for ' || total || ' crops';
    return;
  end if;
  for j in select unnest(gi.plots) loop
    select * into q from public.arena_farm_plots where player_id = pid and idx = j;
    select * into s from public.arena_farm_sim(q, t);
    base = public.arena_farm_yield(pid, j) + q.stolen;
    n = 2 * base - q.stolen;
    v_mut = coalesce(public.arena_farm_mutation(pid, q, s.ripe_weather), '');
    insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (pid, c.id, v_mut, n)
    on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + n;
    v_plots = v_plots || jsonb_build_object('plot', j, 'crop', c.id, 'qty', n, 'xp', 2 * c.xp, 'mutation', v_mut);
  end loop;
  insert into public.arena_farm_harvests(player_id, crop, harvests, giants) values (pid, c.id, 9, 1)
  on conflict (player_id, crop) do update set harvests = public.arena_farm_harvests.harvests + 9,
    giants = public.arena_farm_harvests.giants + 1;
  update public.arena_farm_plots set crop = null, planted_at = null, progress = 0, progress_at = null,
    wet = false, fertilizer = null, mutation = null, pests = 0
   where player_id = pid and idx = any(gi.plots);
  xp = 18 * c.xp;
  gained = jsonb_build_object('giant', gi.idx, 'crop', c.id, 'qty', total, 'xp', xp, 'harvested', v_plots);
end; $$;

-- Farm actions added after 048 (049's pasture actions, plus harvest-giant).
create or replace function public.arena_farm_act_extra(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; n integer; cost integer; used integer;
begin
  xp = 0;
  select * into f from public.arena_farms where player_id = pid;
  if a->>'a' = 'harvest-giant' then
    select x.err, x.gained, x.xp into err, gained, xp
      from public.arena_farm_harvest_giant(pid,
        case when jsonb_typeof(a->'plot') = 'number' then (a->>'plot')::integer end, t) x;
  elsif a->>'a' = 'buy-pasture' then
    if f.pasture then err = 'You already have the pasture';
    elsif f.level < 9 then err = 'Unlocks at farm level 9';
    elsif not public.arena_spend_leaves(pid, 900, 'farm-pasture', 'pasture', d) then
      err = 'Not enough Gold Leaves';
    else
      update public.arena_farms set pasture = true, milk_at = t + interval '80 minutes' where player_id = pid;
      gained = jsonb_build_object('pasture', true, 'milkAt', t + interval '80 minutes');
      xp = 30;
    end if;
  elsif a->>'a' = 'milk' then
    if not f.pasture then err = 'Open the pasture first';
    elsif f.milk_at > t then err = 'The cow is still grazing';
    elsif (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = pid) + 2
        > 80 + 40 * f.barn_upgrades then
      err = 'Your barn is full';
    else
      insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (pid, 'milk', '', 2)
      on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 2;
      update public.arena_farms set milk_at = t + interval '5 hours 20 minutes' where player_id = pid;
      gained = jsonb_build_object('milk', 2, 'milkAt', t + interval '5 hours 20 minutes');
      xp = 8;
    end if;
  elsif a->>'a' = 'sell-milk' then
    n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer end;
    if n is null or n < 1 or n > 10000 then err = 'Choose how many to sell';
    else
      update public.arena_farm_barn set qty = qty - n
       where player_id = pid and crop = 'milk' and mutation = '' and qty >= n;
      get diagnostics used = row_count;
      if used = 0 then err = 'You don''t have that many';
      else
        cost = greatest(1, round(60 * public.arena_farm_milk_mult(d)))::integer * n;
        perform public.arena_grant_leaves(pid, cost, 'farm-sell', ref, d);
        gained = jsonb_build_object('leaves', cost);
      end if;
    end if;
  else
    err = 'Unknown action';
  end if;
end; $$;

-- Farm state fields added after 048 (049's pasture, plus the giants).
create or replace function public.arena_farm_state_extra(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('pasture', f.pasture, 'milkAt', f.milk_at,
      'milkMult', public.arena_farm_milk_mult(public.arena_today()))
    from public.arena_farms f where f.player_id = pid), '{}'::jsonb)
  || jsonb_build_object(
    'giants', public.arena_farm_giants_json(pid, now()),
    'giantsGrown', coalesce((select jsonb_object_agg(h.crop, h.giants) from public.arena_farm_harvests h
      where h.player_id = pid and h.giants > 0), '{}'::jsonb))
$$;

-- A friend's farm as in 049, plus their giant crops.
create or replace function public.arena_farm_view(me uuid, pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', pid,
    'name', pr.display_name,
    'fighter', pr.portrait_character,
    'level', f.level,
    'farmer', f.farmer,
    'now', now(),
    'plots', (select jsonb_agg(jsonb_build_object(
        'i', p.idx, 'owned', p.owned, 'crop', p.crop,
        'progress', round(s.g::numeric, 4),
        'ripeAt', public.arena_farm_ripe_at(p),
        'wet', coalesce(s.wet, false), 'pests', p.pests,
        'mutation', case when s.g >= 1 then public.arena_farm_mutation(pid, p, s.ripe_weather) end,
        -- Ripe, and still worth a try for this visitor.
        'sneak', s.g >= 1 and p.stolen < 1 and not exists (select 1 from public.arena_farm_sneaks k
          where k.thief = me and k.owner = pid and k.idx = p.idx and k.planted_at = p.planted_at)) order by p.idx)
      from public.arena_farm_plots p cross join lateral public.arena_farm_sim(p, now()) s where p.player_id = pid),
    'dog', public.arena_farm_dog(pid, now()),
    'scarecrow', f.scarecrow,
    'pasture', f.pasture,
    'giants', public.arena_farm_giants_json(pid, now()),
    'sprinklers', f.sprinklers,
    'today', (select jsonb_build_object('helpXp', coalesce(max(d.help_xp), 0), 'sneaks', coalesce(max(d.sneaks), 0),
        'pranks', coalesce(max(d.pranks), 0))
      from public.arena_farm_friend_days d where d.player_id = me and d.day = public.arena_today()))
  from public.arena_farms f join public.arena_profiles pr on pr.id = f.player_id
  where f.player_id = pid
$$;

-- A crow that picks a giant crop flies off.
create or replace function public.arena_farm_plots_giant_crow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.arena_farm_giants(new.player_id, new.crow_at) g
      where new.idx = any(g.plots)) then
    new.crow_at = null;
  end if;
  return new;
end; $$;
drop trigger if exists arena_farm_plots_giant_crow on public.arena_farm_plots;
create trigger arena_farm_plots_giant_crow before update of crow_at on public.arena_farm_plots
  for each row when (new.crow_at is not null and old.crow_at is null)
  execute function public.arena_farm_plots_giant_crow();

revoke all on function public.arena_farm_giant_chance(),
  public.arena_farm_giant_roll(uuid, integer, timestamptz[]),
  public.arena_farm_giants(uuid, timestamptz), public.arena_farm_giants_json(uuid, timestamptz),
  public.arena_farm_harvest_giant(uuid, integer, timestamptz),
  public.arena_farm_act_extra(uuid, jsonb, text, timestamptz, date), public.arena_farm_state_extra(uuid),
  public.arena_farm_view(uuid, uuid), public.arena_farm_plots_giant_crow()
  from public, anon, authenticated, service_role;
commit;

select
  (select count(*) from public.arena_farm_crops where giant) = 4 as giant_crops_seeded,
  to_regprocedure('public.arena_farm_harvest_giant(uuid, integer, timestamptz)') is not null as giant_crops_enabled;
