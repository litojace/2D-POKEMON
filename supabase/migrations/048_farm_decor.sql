-- Hub redesign, phase 5j: decorations and Charm.
-- Run after 047_farm_friends.sql. Safe to run again.
--  * Eight spots around the farm take decorations from the prototype's
--    shop, bought with Gold Leaves from a farm level. Placing one replaces
--    what stood there; putting one away doesn't refund it (as in the
--    prototype).
--  * Each decoration has Charm. Every 2 Charm gives +1% farm XP, up to 25%.
--  * The crop book's 15-crop reward (the prototype's) is a free Golden
--    Voltkit Statue, also for farms already past 15 crops.
begin;

create table if not exists public.arena_farm_decor_items (
  id text primary key,
  name text not null,
  price integer not null check (price > 0),
  charm integer not null check (charm > 0),
  level integer not null check (level between 1 and 100)
);
insert into public.arena_farm_decor_items(id, name, price, charm, level) values
  ('rock', 'Mossy Rock', 300, 1, 1),
  ('bush6', 'Rose Bush', 450, 1, 3),
  ('bush7', 'Fern Bush', 550, 1, 5),
  ('crates', 'Crates', 950, 1, 8),
  ('lamp', 'Street Lamp', 1350, 2, 12),
  ('planter', 'Flower Planter', 2250, 3, 16),
  ('pine', 'Pine Tree', 3200, 2, 22),
  ('apple', 'Apple Tree', 4200, 4, 30),
  ('tower', 'Gazebo', 6050, 10, 45),
  ('plum', 'Guest Cottage', 8550, 12, 60),
  ('statue', 'Golden Voltkit Statue', 30000, 15, 75)
on conflict (id) do update set name = excluded.name, price = excluded.price,
  charm = excluded.charm, level = excluded.level;
create table if not exists public.arena_farm_decor (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  slot smallint not null check (slot between 0 and 7),
  -- Null when the spot was cleared.
  item text references public.arena_farm_decor_items(id),
  placed_at timestamptz not null default now(),
  primary key (player_id, slot)
);
-- Free decorations from rewards.
create table if not exists public.arena_farm_decor_credits (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  item text not null references public.arena_farm_decor_items(id),
  qty integer not null default 0 check (qty >= 0),
  primary key (player_id, item)
);
alter table public.arena_farm_decor_items enable row level security;
alter table public.arena_farm_decor enable row level security;
alter table public.arena_farm_decor_credits enable row level security;
revoke all on public.arena_farm_decor_items, public.arena_farm_decor, public.arena_farm_decor_credits
  from public, anon, authenticated, service_role;

-- A farm's Charm, and the farm XP bonus it gives (percent).
create or replace function public.arena_farm_charm(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(i.charm), 0)::integer from public.arena_farm_decor x
  join public.arena_farm_decor_items i on i.id = x.item where x.player_id = pid
$$;
create or replace function public.arena_farm_charm_bonus(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select least(25, public.arena_farm_charm(pid) / 2)
$$;
revoke all on function public.arena_farm_charm(uuid), public.arena_farm_charm_bonus(uuid)
  from public, anon, authenticated, service_role;

-- Farm XP as in 037 (level-ups pay leaves and fertilizer, titles at 25,
-- 50, 75 and 100), now with the Charm bonus.
create or replace function public.arena_farm_add_xp(pid uuid, amount integer) returns void
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_title text;
begin
  if amount <= 0 then return; end if;
  select * into f from public.arena_farms where player_id = pid for update;
  -- Charm (048): +1% for every 2 Charm, up to 25%.
  f.xp = f.xp + round(amount * (1 + public.arena_farm_charm_bonus(pid) / 100.0))::integer;
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
revoke all on function public.arena_farm_add_xp(uuid, integer) from public, anon, authenticated, service_role;

-- Crop book rewards as in 041, with the 15-crop statue.
create or replace function public.arena_farm_book_rewards(pid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_found integer; m integer; inserted integer; paid jsonb = '[]'::jsonb;
begin
  n_found = (select count(*) from public.arena_farm_harvests where player_id = pid and harvests > 0);
  foreach m in array array[5, 10, 15, 20, 25] loop
    continue when n_found < m;
    insert into public.arena_farm_book_rewards(player_id, found) values (pid, m) on conflict do nothing;
    get diagnostics inserted = row_count;
    continue when inserted = 0;
    if m = 5 then
      perform public.arena_grant_leaves(pid, 100, 'farm-book', '5', public.arena_today());
    elsif m = 10 then
      update public.arena_farms set fert_gold = fert_gold + 2 where player_id = pid;
    elsif m = 15 then
      insert into public.arena_farm_decor_credits(player_id, item, qty) values (pid, 'statue', 1)
      on conflict (player_id, item) do update set qty = public.arena_farm_decor_credits.qty + 1;
    elsif m = 20 then
      perform public.arena_grant_leaves(pid, 1000, 'farm-book', '20', public.arena_today());
    else
      insert into public.arena_player_titles(player_id, title_id)
      select pid, id from public.arena_titles where name = 'Elemental Botanist' on conflict do nothing;
    end if;
    paid = paid || to_jsonb(m);
  end loop;
  return paid;
end; $$;
revoke all on function public.arena_farm_book_rewards(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_farm_act_more(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_dog text; v_days integer; cost integer; v_level integer;
  cur public.arena_farm_dog_hires; plot integer; p public.arena_farm_plots; v_perk text;
  inserted integer; n integer; v_plots jsonb; s record; v_item public.arena_farm_decor_items;
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
  elsif a->>'a' = 'decor' then
    -- Place a decoration in one of the 8 spots (what stood there is replaced).
    plot = case when jsonb_typeof(a->'slot') = 'number' then (a->>'slot')::integer end;
    select * into v_item from public.arena_farm_decor_items where id = a->>'item';
    if plot is null or plot not between 0 and 7 then err = 'Choose a spot';
    elsif v_item.id is null then err = 'Unknown decoration';
    -- A free one (a reward) can be placed before its level.
    elsif f.level < v_item.level and not exists (select 1 from public.arena_farm_decor_credits
        where player_id = pid and item = v_item.id and qty > 0) then
      err = 'Unlocks at farm level ' || v_item.level;
    elsif exists (select 1 from public.arena_farm_decor where player_id = pid and slot = plot and item = v_item.id) then
      err = 'That is already there';
    else
      update public.arena_farm_decor_credits set qty = qty - 1
       where player_id = pid and item = v_item.id and qty > 0;
      get diagnostics inserted = row_count;
      cost = case when inserted > 0 then 0 else v_item.price end;
      if cost > 0 and not public.arena_spend_leaves(pid, cost, 'farm-decor', ref, d) then
        err = 'Not enough Gold Leaves';
      else
        insert into public.arena_farm_decor(player_id, slot, item, placed_at) values (pid, plot, v_item.id, t)
        on conflict (player_id, slot) do update set item = excluded.item, placed_at = excluded.placed_at;
        gained = jsonb_build_object('decor', v_item.id, 'slot', plot, 'cost', cost);
      end if;
    end if;
  elsif a->>'a' = 'decor-remove' then
    plot = case when jsonb_typeof(a->'slot') = 'number' then (a->>'slot')::integer end;
    if plot is null or plot not between 0 and 7 then err = 'Choose a spot';
    elsif not exists (select 1 from public.arena_farm_decor where player_id = pid and slot = plot and item is not null) then
      err = 'Nothing there';
    else
      update public.arena_farm_decor set item = null, placed_at = t where player_id = pid and slot = plot;
      gained = jsonb_build_object('removed', plot);
    end if;
  else
    err = 'Unknown action';
  end if;
end; $$;
revoke all on function public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date)
  from public, anon, authenticated, service_role;

-- The farm state as in 047, plus decorations, Charm and free decorations.
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
      where x.player_id = pid and x.crow_at is not null), '{}'::jsonb),
    'visits', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'at', v.at, 'name', pr.display_name,
        'kind', v.kind, 'crop', v.crop, 'n', v.n) order by v.at desc, v.id desc)
      from (select * from public.arena_farm_visits v where v.owner = pid and v.at > now() - interval '3 days'
        order by v.at desc, v.id desc limit 20) v join public.arena_profiles pr on pr.id = v.visitor), '[]'::jsonb),
    'decor', coalesce((select jsonb_agg(jsonb_build_object('slot', x.slot, 'item', x.item) order by x.slot)
      from public.arena_farm_decor x where x.player_id = pid and x.item is not null), '[]'::jsonb),
    'charm', public.arena_farm_charm(pid),
    'decorCredits', coalesce((select jsonb_object_agg(x.item, x.qty) from public.arena_farm_decor_credits x
      where x.player_id = pid and x.qty > 0), '{}'::jsonb))
  from c
$$;
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;

-- The statue for farms already past 15 crops.
do $$
declare pid uuid;
begin
  for pid in select distinct player_id from public.arena_farm_harvests loop
    perform public.arena_farm_book_rewards(pid);
  end loop;
end $$;
commit;

select
  to_regclass('public.arena_farm_decor') is not null as farm_decor_enabled,
  (select count(*) from public.arena_farm_decor_items) = 11 as decor_items_seeded;
