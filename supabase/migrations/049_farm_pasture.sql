-- Hub redesign, phase 5k: the pasture and Storm Milk, and treats in the Plaza.
-- Run after 048_farm_decor.sql. Safe to run again.
--  * The Cow Pasture opens at farm level 9 for 900 Gold Leaves (+30 farm XP).
--    Its cow gives 2 Storm Milk every 5 h 20 m (the first 1 h 20 m after the
--    pasture opens); collecting it gives 8 farm XP. Milk goes in the barn
--    (it takes barn space) and sells for 60 Gold Leaves times its own price
--    of the day (0.85 to 1.35).
--  * The barn holds crops and Storm Milk: its crop column now refers to
--    arena_farm_goods (every crop, and 'milk') instead of the crops table.
--  * Treats: in the Plaza you can throw a regular crop from your barn (no
--    mutation, not milk): the one you have most of, the cheapest on a tie.
--    The game server calls arena_plaza_treat with your token and a fresh id
--    per throw, so a retry never takes two.
--  * Hooks: arena_farm_state_extra and arena_farm_act_extra, so later
--    migrations add farm fields and actions without copying the state and
--    arena_farm_act_more again.
begin;

-- What the barn can hold: every crop, and Storm Milk.
create table if not exists public.arena_farm_goods (id text primary key);
insert into public.arena_farm_goods(id) select id from public.arena_farm_crops on conflict do nothing;
insert into public.arena_farm_goods(id) values ('milk') on conflict do nothing;
alter table public.arena_farm_goods enable row level security;
revoke all on public.arena_farm_goods from public, anon, authenticated, service_role;
-- A crop added later is a good too.
create or replace function public.arena_farm_crops_good() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.arena_farm_goods(id) values (new.id) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists arena_farm_crops_good on public.arena_farm_crops;
create trigger arena_farm_crops_good after insert on public.arena_farm_crops
  for each row execute function public.arena_farm_crops_good();
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'arena_farm_barn_crop_fkey'
      and conrelid = 'public.arena_farm_barn'::regclass) then
    alter table public.arena_farm_barn drop constraint arena_farm_barn_crop_fkey;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'arena_farm_barn_good_fkey'
      and conrelid = 'public.arena_farm_barn'::regclass) then
    alter table public.arena_farm_barn add constraint arena_farm_barn_good_fkey
      foreign key (crop) references public.arena_farm_goods(id);
  end if;
end $$;

-- The pasture, and when the cow's milk is ready (null: no pasture).
alter table public.arena_farms add column if not exists pasture boolean not null default false;
alter table public.arena_farms add column if not exists milk_at timestamptz;

-- Storm Milk's price of the day, the same for everyone (0.85 to 1.35).
create or replace function public.arena_farm_milk_mult(p_day date) returns numeric
language sql immutable set search_path = public as $$
  select round((0.85 + 0.5 * public.arena_farm_hash('milk:' || p_day::text))::numeric, 2)
$$;

-- Farm actions added after 048. Called by arena_farm_act_more for any action
-- it doesn't know.
create or replace function public.arena_farm_act_extra(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; n integer; cost integer; used integer;
begin
  xp = 0;
  select * into f from public.arena_farms where player_id = pid;
  if a->>'a' = 'buy-pasture' then
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

-- Farm state fields added after 048 (merged into arena_farm_state).
create or replace function public.arena_farm_state_extra(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('pasture', f.pasture, 'milkAt', f.milk_at,
      'milkMult', public.arena_farm_milk_mult(public.arena_today()))
    from public.arena_farms f where f.player_id = pid), '{}'::jsonb)
$$;

-- arena_farm_act_more as in 048, handing unknown actions to the hook.
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
    -- 049: later actions (the pasture, Storm Milk) live in arena_farm_act_extra.
    select x.err, x.gained, x.xp into err, gained, xp
      from public.arena_farm_act_extra(pid, a, ref, t, d) x;
  end if;
end; $$;

-- The farm state as in 048, plus the hook's fields.
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
    -- 049: later fields (the pasture, Storm Milk) come from arena_farm_state_extra.
    || public.arena_farm_state_extra(pid)
  from c
$$;

-- A friend's farm as in 047, plus their pasture (they see your cow).
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
    'sprinklers', f.sprinklers,
    'today', (select jsonb_build_object('helpXp', coalesce(max(d.help_xp), 0), 'sneaks', coalesce(max(d.sneaks), 0),
        'pranks', coalesce(max(d.pranks), 0))
      from public.arena_farm_friend_days d where d.player_id = me and d.day = public.arena_today()))
  from public.arena_farms f join public.arena_profiles pr on pr.id = f.player_id
  where f.player_id = pid
$$;

-- Treats in the Plaza: how many you have (regular crops in your barn).
create or replace function public.arena_plaza_treats() returns integer
language plpgsql stable security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  return coalesce((select sum(b.qty) from public.arena_farm_barn b
    join public.arena_farm_crops c on c.id = b.crop
    where b.player_id = me and b.mutation = '' and b.qty > 0), 0)::integer;
end; $$;

-- Throw one: takes the regular crop you have most of (the cheapest on a tie).
create or replace function public.arena_plaza_treat(p_ref uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); v_crop text; inserted integer;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_ref is null then raise exception 'Bad request'; end if;
  insert into public.arena_farm_requests(player_id, request) values (me, p_ref) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('ok', false, 'error', 'Already thrown', 'left', public.arena_plaza_treats());
  end if;
  select b.crop into v_crop from public.arena_farm_barn b
    join public.arena_farm_crops c on c.id = b.crop
   where b.player_id = me and b.mutation = '' and b.qty > 0
   order by b.qty desc, c.sell, b.crop limit 1
   for update of b;
  if v_crop is null then
    return jsonb_build_object('ok', false, 'error', 'No crops to throw yet. Harvest some on the Farm.', 'left', 0);
  end if;
  update public.arena_farm_barn set qty = qty - 1
   where player_id = me and crop = v_crop and mutation = '';
  return jsonb_build_object('ok', true, 'crop', v_crop, 'left', public.arena_plaza_treats());
end; $$;

revoke all on function public.arena_farm_crops_good(), public.arena_farm_milk_mult(date),
  public.arena_farm_act_extra(uuid, jsonb, text, timestamptz, date), public.arena_farm_state_extra(uuid),
  public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date), public.arena_farm_state(uuid),
  public.arena_farm_view(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.arena_plaza_treats(), public.arena_plaza_treat(uuid) from public, anon;
grant execute on function public.arena_plaza_treats(), public.arena_plaza_treat(uuid) to authenticated;
commit;

select
  to_regclass('public.arena_farm_goods') is not null as farm_goods_enabled,
  to_regprocedure('public.arena_plaza_treat(uuid)') is not null as plaza_treats_enabled;
