-- Element Bistro, part 9: the economy rebalanced, and items with perks. Run
-- after 103_bistro_stove_shop.sql. Safe to run again.
--
-- Measured (tests/unit, the shared rules): an attentive player earned ~1.5k
-- coins an hour at level 1, 30k at 10 and 130k at 30, reached level 30 in ~19
-- hours, and by level 10 had little left to buy. So: prices up (furniture
-- 2.5-12x, expansions 3k-100k, kitchen 1.5k-20k, shifts 1k-15k, staff 600-12k,
-- training 300 x level^2, stoves 500/8k/40k, floors and walls 800/1.5k), XP
-- to the next level steeper from level 4 (about 45 hours to level 30), and 24
-- new items (tables and chairs, machines, decor) whose perks are worth saving
-- for: tips (+% on tips while you play), patience (client side), waiter speed,
-- VIPs, and rest (a Staff Corner). Rules match packages/shared/src/bistro.ts
-- (ITEMS, PERK_CAPS, perkTotal, payment, rateFrom, xpToNext and the prices).
begin;

alter table public.arena_bistro_kinds add column if not exists seat text check (seat in ('table', 'chair'));
alter table public.arena_bistro_kinds add column if not exists tip integer not null default 0;
alter table public.arena_bistro_kinds add column if not exists patience integer not null default 0;
alter table public.arena_bistro_kinds add column if not exists speed integer not null default 0;
alter table public.arena_bistro_kinds add column if not exists vip integer not null default 0;
alter table public.arena_bistro_kinds add column if not exists rest integer not null default 0;
insert into public.arena_bistro_kinds(kind, name, price, level, charm, floor, event, tokens, gift, seat, tip, patience, speed, vip, rest) values
  ('table', 'Round Table', 150, 1, 0, false, null, null, false, 'table', 0, 0, 0, 0, 0),
  ('chair', 'Cushioned Chair', 60, 1, 0, false, null, null, false, 'chair', 0, 0, 0, 0, 0),
  ('plant', 'Potted Fern', 120, 1, 2, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('rug', 'Woven Rug', 200, 1, 2, true, null, null, false, null, 0, 0, 0, 0, 0),
  ('lamp', 'Paper Lantern', 300, 2, 3, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('bonsai', 'Bonsai Stand', 600, 3, 4, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('luckycat', 'Waving Cat', 900, 3, 5, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('jukebox', 'Jukebox', 2000, 4, 6, false, null, null, false, null, 0, 10, 0, 0, 0),
  ('aquarium', 'Aquarium', 3000, 5, 8, false, null, null, false, null, 0, 5, 0, 0, 0),
  ('fountain', 'Element Fountain', 5000, 6, 10, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('corner', 'Staff Corner', 4000, 5, 1, false, null, null, false, null, 0, 0, 0, 0, 1),
  ('stool', 'Bar Stool', 90, 2, 0, false, null, null, false, 'chair', 0, 0, 0, 0, 0),
  ('gardentable', 'Garden Table', 700, 4, 1, false, null, null, false, 'table', 0, 10, 0, 0, 0),
  ('armchair', 'Velvet Armchair', 2500, 7, 1, false, null, null, false, 'chair', 0, 15, 0, 0, 0),
  ('marbletable', 'Marble Table', 6000, 10, 2, false, null, null, false, 'table', 2, 0, 0, 0, 0),
  ('goldtable', 'Golden Table', 25000, 18, 3, false, null, null, false, 'table', 4, 0, 0, 0, 0),
  ('throne', 'Royal Throne', 30000, 20, 3, false, null, null, false, 'chair', 4, 0, 0, 0, 0),
  ('tipjar', 'Tip Jar', 500, 3, 0, false, null, null, false, null, 3, 0, 0, 0, 0),
  ('espresso', 'Espresso Machine', 3500, 6, 1, false, null, null, false, null, 0, 0, 0, 0, 1),
  ('cart', 'Serving Cart', 6000, 8, 0, false, null, null, false, null, 0, 0, 8, 0, 0),
  ('arcade', 'Arcade Cabinet', 5000, 9, 2, false, null, null, false, null, 0, 25, 0, 0, 0),
  ('neon', 'Neon Sign', 9000, 11, 4, false, null, null, false, null, 0, 0, 0, 20, 0),
  ('freezer', 'Ice Cream Freezer', 11000, 12, 1, false, null, null, false, null, 4, 0, 0, 0, 0),
  ('massage', 'Massage Chair', 14000, 13, 1, false, null, null, false, null, 0, 0, 0, 0, 1),
  ('piano', 'Grand Piano', 20000, 15, 6, false, null, null, false, null, 6, 0, 0, 0, 0),
  ('podium', 'Golden Podium', 45000, 22, 5, false, null, null, false, null, 0, 0, 0, 30, 0),
  ('robot', 'Robot Waiter Dock', 65000, 25, 2, false, null, null, false, null, 0, 0, 15, 0, 0),
  ('vase', 'Flower Vase', 200, 2, 3, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('screen', 'Bamboo Screen', 900, 5, 5, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('bookshelf', 'Bookshelf', 2500, 8, 6, false, null, null, false, null, 0, 5, 0, 0, 0),
  ('carpet', 'Red Carpet', 5000, 10, 2, true, null, null, false, null, 0, 0, 0, 15, 0),
  ('koi', 'Koi Pond', 16000, 14, 12, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('chandelier', 'Crystal Chandelier', 22000, 17, 10, false, null, null, false, null, 2, 0, 0, 0, 0),
  ('sakura', 'Cherry Tree', 26000, 19, 12, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('statue', 'Dragon Statue', 55000, 24, 16, false, null, null, false, null, 0, 0, 0, 0, 0),
  ('pumpkin', 'Pumpkin Lantern', 1, 1, 4, false, 'harvest', 30, false, null, 0, 0, 0, 0, 0),
  ('haybale', 'Hay Bale', 1, 1, 3, false, 'harvest', 20, false, null, 0, 0, 0, 0, 0),
  ('lantern', 'Red Lantern Stand', 1, 1, 4, false, 'lantern', 30, false, null, 0, 0, 0, 0, 0),
  ('blossom', 'Plum Blossom', 1, 1, 5, false, 'lantern', 40, false, null, 0, 0, 0, 0, 0),
  ('trophy', 'Golden Plate', 1, 1, 6, false, null, null, true, null, 0, 0, 0, 0, 0)
on conflict (kind) do update set name = excluded.name, price = excluded.price, level = excluded.level,
  charm = excluded.charm, floor = excluded.floor, event = excluded.event, tokens = excluded.tokens, gift = excluded.gift,
  seat = excluded.seat, tip = excluded.tip, patience = excluded.patience, speed = excluded.speed, vip = excluded.vip,
  rest = excluded.rest;

-- A perk's total over the placed items, capped (perkTotal / PERK_CAPS).
create or replace function public.arena_bistro_perk(pid uuid, p_perk text) returns integer
language sql stable security definer set search_path = public as $$
  select least(case p_perk when 'tip' then 30 when 'patience' then 60 when 'speed' then 25 when 'vip' then 50 else 2 end,
    coalesce(sum(case p_perk when 'tip' then k.tip when 'patience' then k.patience when 'speed' then k.speed
      when 'vip' then k.vip else k.rest end), 0))::integer
  from public.arena_bistro_items i join public.arena_bistro_kinds k on k.kind = i.kind
  where i.player_id = pid
$$;
revoke all on function public.arena_bistro_perk(uuid, text) from public, anon, authenticated, service_role;

-- XP to the next level (xpToNext): steeper from level 4.
create or replace function public.arena_bistro_need(p_level integer) returns integer
language sql immutable set search_path = '' as $$
  select round((40 * power(p_level, 1.45) * (1 + 0.08 * greatest(0, p_level - 3)))::numeric)::integer
$$;
-- Seats (see 068): any table and chair by its role.
create or replace function public.arena_bistro_seats(pid uuid)
returns table(chair integer, cx integer, cy integer, tbl integer, dir integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.x, c.y, t.id, t.dir
  from public.arena_bistro_items c
  cross join lateral (
    select tt.id, case when tt.x > c.x then 0 when tt.y > c.y then 1 when tt.x < c.x then 2 else 3 end dir
    from public.arena_bistro_items tt
    where tt.player_id = pid and abs(tt.x - c.x) + abs(tt.y - c.y) = 1
      and (select seat from public.arena_bistro_kinds k where k.kind = tt.kind) = 'table'
    order by (case when tt.x > c.x then 0 when tt.y > c.y then 1 when tt.x < c.x then 2 else 3 end) = c.rot desc, tt.id
    limit 1) t
  where c.player_id = pid and (select seat from public.arena_bistro_kinds k where k.kind = c.kind) = 'chair'
$$;
revoke all on function public.arena_bistro_seats(uuid) from public, anon, authenticated, service_role;
-- Rest spots (see 073): every item with the rest perk, up to two.
create or replace function public.arena_bistro_corners(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select public.arena_bistro_perk(pid, 'rest')
$$;
revoke all on function public.arena_bistro_corners(uuid) from public, anon, authenticated, service_role;
-- The staff's pace (see 073): waiters faster with the speed perk.
create or replace function public.arena_bistro_pace(pid uuid, p_role text, ms double precision, p_corners integer)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare s public.arena_bistro_staff; total double precision = 0;
begin
  for s in select * from public.arena_bistro_staff where player_id = pid and role = p_role order by id loop
    total = total + public.arena_bistro_work_speed(s.level, s.friend_id is not null,
      public.arena_bistro_energy(s, ms, p_corners));
  end loop;
  -- Serving carts and the like make the waiters faster (rateFrom does the same).
  if p_role = 'waiter' then
    total = total * (1::float8 + public.arena_bistro_perk(pid, 'speed')::float8 / 100::float8);
  end if;
  return total;
end; $$;
revoke all on function public.arena_bistro_pace(uuid, text, double precision, integer) from public, anon, authenticated, service_role;
-- A guest's bill (see 068) with the room's tip perk while you play.
create or replace function public.arena_bistro_pay(p_price integer, p_special boolean, p_vip boolean,
  p_combo integer, p_hearts integer, p_quick boolean, p_rush boolean, p_perk integer) returns integer
language plpgsql immutable set search_path = '' as $$
declare base integer; pct integer;
begin
  base = round(p_price * (case when p_special then 1.5 else 1 end) * (case when p_vip then 2.5 else 1 end));
  pct = (least(5, greatest(1, coalesce(p_combo, 1))) - 1) * 8
    + (least(3, greatest(1, coalesce(p_hearts, 3))) - 1) * 5
    + case when p_quick then 10 else 0 end
    + greatest(0, coalesce(p_perk, 0));
  if p_rush then pct = pct * 2; end if;
  return base + round(base * pct / 100.0)::integer;
end; $$;
-- While away, the plain bill (no perk), as before.
create or replace function public.arena_bistro_pay(p_price integer, p_special boolean, p_vip boolean,
  p_combo integer, p_hearts integer, p_quick boolean, p_rush boolean) returns integer
language sql immutable set search_path = '' as $$
  select public.arena_bistro_pay(p_price, p_special, p_vip, p_combo, p_hearts, p_quick, p_rush, 0)
$$;
revoke all on function public.arena_bistro_pay(integer, boolean, boolean, integer, integer, boolean, boolean, integer),
  public.arena_bistro_pay(integer, boolean, boolean, integer, integer, boolean, boolean)
  from public, anon, authenticated, service_role;
-- Actions (see 103): the new prices; sales with the tip and VIP perks.
create or replace function public.arena_bistro_act(p_request uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); t timestamptz = now(); d date = public.arena_today();
  b public.arena_bistros; a jsonb; i integer = 0; v_kind text; err text; gained jsonb; inserted integer;
  st public.arena_bistro_stoves; v_dish public.arena_bistro_dishes; k public.arena_bistro_kinds;
  v_idx integer; n integer; v_price integer; v_cost integer; r jsonb; v_x integer; v_y integer; v_rot integer;
  v_id integer; v_seats integer; v_vip boolean; v_hearts integer; v_bill integer; v_slot integer;
  v_staff public.arena_bistro_staff; v_count integer; v_lv integer; v_away jsonb; v_traded integer;
  results jsonb = '[]'::jsonb; v_friend uuid; v_char text; v_e double precision;
  v_rec text[]; v_spice integer; v_have integer; v_ing text;
  v_model text; v_kx integer; v_sp integer; v_lvl integer; v_name text;
  v_order public.arena_bistro_orders; v_od jsonb; v_need integer; v_put integer; v_done boolean; v_k integer; v_reg record; v_step integer; v_ev text; v_last integer; lw date;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or jsonb_typeof(p_actions) is distinct from 'array'
     or jsonb_array_length(p_actions) not between 1 and 40 then
    raise exception 'Invalid bistro request';
  end if;
  perform public.arena_bistro_ensure(me);
  -- One request at a time per bistro.
  perform 1 from public.arena_bistros where player_id = me for update;
  insert into public.arena_bistro_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('bistro', public.arena_bistro_state(me), 'results', '[]'::jsonb, 'repeated', true);
  end if;
  delete from public.arena_bistro_requests where player_id = me and created_at < t - interval '2 days';
  perform public.arena_bistro_catch_up(me, t);
  perform public.arena_bistro_orders_refresh(me, t);
  v_ev = public.arena_bistro_event(d);
  select away into v_away from public.arena_bistros where player_id = me;
  update public.arena_bistros set away = null where player_id = me and away is not null;
  for a in select * from jsonb_array_elements(p_actions) loop
    i = i + 1; err = null; gained = null;
    v_kind = a->>'a';
    select * into b from public.arena_bistros where player_id = me;
    v_idx = case when jsonb_typeof(a->'stove') = 'number' then (a->>'stove')::integer else null end;
    if v_kind in ('cook', 'stir', 'plate') then
      select * into st from public.arena_bistro_stoves where player_id = me and idx = v_idx;
    end if;
    if v_kind in ('cook', 'stir', 'plate') and st.idx is null then
      err = 'No stove there.';
    elsif v_kind = 'cook' then
      err = public.arena_bistro_start(me, v_idx, a->>'dish', t, 1);
    elsif v_kind = 'stir' then
      if st.dish is null or st.perfect
         or t < st.started_at + make_interval(secs => st.dur_ms * 0.78 / 1000.0)
         or t >= st.started_at + make_interval(secs => st.dur_ms * 0.96 / 1000.0) then
        err = 'Not the golden moment.';
      else
        update public.arena_bistro_stoves set perfect = true where player_id = me and idx = v_idx;
      end if;
    elsif v_kind = 'plate' then
      r = public.arena_bistro_plate(me, v_idx, t);
      if r ? 'error' then err = r->>'error'; else gained = r - 'ok'; end if;
    elsif v_kind = 'serve' then
      select * into v_dish from public.arena_bistro_dishes where id = a->>'dish';
      select count(*) into v_seats from public.arena_bistro_seats(me);
      -- The allowance refills by the seats; each guest takes one.
      b.sale_budget = least(v_seats + 4, b.sale_budget + greatest(0, extract(epoch from t - b.sale_at)) * (v_seats * 0.1));
      update public.arena_bistros set sale_budget = b.sale_budget, sale_at = t where player_id = me;
      if v_dish.id is null then err = 'Unknown dish.';
      elsif b.sale_budget < 1 then err = 'Too many guests at once.';
      else
        v_slot = public.arena_bistro_take(me, v_dish.id);
        if v_slot is null then err = 'None left on the counter.';
        else
          -- A VIP only while the VIP allowance lasts.
          v_vip = coalesce((a->>'vip')::boolean, false) and b.vip_budget >= 1;
          v_hearts = least(3, greatest(1, coalesce((a->>'hearts')::integer, 3)));
          v_bill = public.arena_bistro_pay(public.arena_bistro_price_at(v_dish.price, public.arena_bistro_lv(me, v_dish.id), b.stars),
            v_dish.id = public.arena_bistro_special(b.level, d), v_vip,
            coalesce((a->>'combo')::integer, 1), v_hearts, coalesce((a->>'quick')::boolean, false),
            public.arena_bistro_rush(t), public.arena_bistro_perk(me, 'tip'));
          update public.arena_bistros set coins = coins + v_bill, served = served + 1,
            sale_budget = sale_budget - 1,
            vip_budget = least(3, vip_budget + 0.15 * (1 + public.arena_bistro_perk(me, 'vip') / 100.0))
              - case when v_vip then 1 else 0 end,
            rating = least(5, greatest(0, rating + ((case v_hearts when 3 then 5 when 2 then 4 else 2.5 end) - rating) * 0.08))
           where player_id = me;
          v_lv = public.arena_bistro_add_xp(me, case when v_vip then 3 else 1 end);
          perform public.arena_bistro_points(me, 1);
          gained = jsonb_build_object('coins', v_bill, 'vip', v_vip, 'levels', v_lv);
        end if;
      end if;
    elsif v_kind = 'leave' then
      -- A guest left hungry: the stars drop a little.
      update public.arena_bistros set rating = greatest(0, rating + (0.5 - rating) * 0.08) where player_id = me;
    elsif v_kind = 'place' then
      select * into k from public.arena_bistro_kinds where kind = a->>'kind';
      v_x = case when jsonb_typeof(a->'x') = 'number' then (a->>'x')::integer else -1 end;
      v_y = case when jsonb_typeof(a->'y') = 'number' then (a->>'y')::integer else -1 end;
      v_rot = least(3, greatest(0, coalesce((a->>'rot')::integer, 0)));
      v_id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer else null end;
      if k.kind is null then err = 'Unknown item.';
      elsif v_id is not null and not exists (select 1 from public.arena_bistro_items
          where player_id = me and id = v_id and kind = k.kind) then err = 'Nothing there.';
      elsif v_id is null and coalesce((select qty from public.arena_bistro_stored
          where player_id = me and kind = k.kind), 0) < 1 then err = 'None in storage.';
      else
        err = public.arena_bistro_place_error(me, k.kind, v_x, v_y, v_id);
        if err is null then
          begin
            if v_id is null then
              update public.arena_bistro_stored set qty = qty - 1 where player_id = me and kind = k.kind;
              insert into public.arena_bistro_items(player_id, id, kind, x, y, rot)
              values (me, coalesce((select max(id) from public.arena_bistro_items where player_id = me), 0) + 1,
                k.kind, v_x, v_y, v_rot);
            else
              update public.arena_bistro_items set x = v_x, y = v_y, rot = v_rot where player_id = me and id = v_id;
            end if;
            err = public.arena_bistro_plan_error(me);
            -- A plan that doesn't work is undone.
            if err is not null then raise exception using errcode = 'P0001', message = 'bistro-plan'; end if;
          exception when sqlstate 'P0001' then
            if sqlerrm <> 'bistro-plan' then raise; end if;
          end;
        end if;
      end if;
    elsif v_kind = 'store' then
      v_id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer else null end;
      if not exists (select 1 from public.arena_bistro_items where player_id = me and id = v_id) then
        err = 'Nothing there.';
      else
        insert into public.arena_bistro_stored(player_id, kind, qty)
        select me, kind, 1 from public.arena_bistro_items where player_id = me and id = v_id
        on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + 1;
        delete from public.arena_bistro_items where player_id = me and id = v_id;
      end if;
    elsif v_kind = 'buy' then
      select * into k from public.arena_bistro_kinds where kind = a->>'kind';
      if k.kind is null then err = 'Unknown item.';
      elsif k.gift then err = 'That one is a gift from a regular.';
      elsif k.level > b.level then err = 'Opens at level ' || k.level || '.';
      elsif k.event is not null and k.event is distinct from v_ev then err = 'Only during its event.';
      elsif k.event is not null and b.tokens < k.tokens then err = 'You need ' || k.tokens || ' tokens.';
      elsif k.event is not null then
        update public.arena_bistros set tokens = tokens - k.tokens where player_id = me;
        insert into public.arena_bistro_stored(player_id, kind, qty) values (me, k.kind, 1)
        on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + 1;
      elsif b.coins < k.price then err = 'You need ' || k.price || ' coins.';
      else
        update public.arena_bistros set coins = coins - k.price where player_id = me;
        insert into public.arena_bistro_stored(player_id, kind, qty) values (me, k.kind, 1)
        on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + 1;
      end if;
    elsif v_kind = 'style' then
      v_price = case a->>'kind'
        when 'floor' then case a->>'id' when 'checker' then 0 when 'wood' then 800 when 'teal' then 1500 end
        when 'wall' then case a->>'id' when 'butter' then 0 when 'mint' then 800 when 'brick' then 1500 end end;
      if v_price is null then err = 'Unknown style.';
      elsif not ((a->>'kind' = 'floor' and a->>'id' = any(b.floors)) or (a->>'kind' = 'wall' and a->>'id' = any(b.walls)))
            and b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      elsif a->>'kind' = 'floor' then
        update public.arena_bistros set
          coins = coins - case when a->>'id' = any(floors) then 0 else v_price end,
          floors = case when a->>'id' = any(floors) then floors else floors || (a->>'id') end,
          floor = a->>'id' where player_id = me;
      else
        update public.arena_bistros set
          coins = coins - case when a->>'id' = any(walls) then 0 else v_price end,
          walls = case when a->>'id' = any(walls) then walls else walls || (a->>'id') end,
          wall = a->>'id' where player_id = me;
      end if;
    elsif v_kind = 'stove' then
      -- A Clay Stove on the first free back-wall spot (buyStove).
      select count(*) into n from public.arena_bistro_stoves where player_id = me;
      v_kx = public.arena_bistro_kitchen_x1(b.size_lv);
      select g into v_x from generate_series(1, v_kx - 1) g
       where not exists (select 1 from public.arena_bistro_stoves s where s.player_id = me and s.x = g) order by g limit 1;
      if n >= v_kx - 1 or v_x is null then err = 'Every stove spot is in use.';
      elsif b.coins < 500 then err = 'You need 500 coins.';
      else
        update public.arena_bistros set coins = coins - 500 where player_id = me;
        insert into public.arena_bistro_stoves(player_id, idx, x, model) values (me, n, v_x, 'clay');
      end if;
    elsif v_kind = 'stovebuy' then
      -- A stove from the Shop, into storage (buyStoveModel).
      v_model = a->>'model';
      select x.price, x.level, x.name into v_price, v_lvl, v_name from (values
        ('clay', 500, 1, 'Clay Stove'), ('steel', 8000, 8, 'Steel Range'), ('dragon', 40000, 16, 'Dragon Oven'))
        as x(model, price, level, name) where x.model = v_model;
      if v_name is null then err = 'Unknown stove.';
      elsif v_lvl > b.level then err = v_name || ' opens at level ' || v_lvl || '.';
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price where player_id = me;
        insert into public.arena_bistro_stove_store(player_id, model, qty) values (me, v_model, 1)
        on conflict (player_id, model) do update set qty = public.arena_bistro_stove_store.qty + 1;
      end if;
    elsif v_kind = 'stoveplace' then
      -- A stove from storage onto the back wall: a new one, or a swap (placeStove).
      v_model = a->>'model';
      v_x = case when jsonb_typeof(a->'x') = 'number' then (a->>'x')::integer else -1 end;
      v_kx = public.arena_bistro_kitchen_x1(b.size_lv);
      select * into st from public.arena_bistro_stoves where player_id = me and x = v_x;
      if v_model is null or v_model not in ('clay', 'steel', 'dragon') then err = 'Unknown stove.';
      elsif coalesce((select qty from public.arena_bistro_stove_store where player_id = me and model = v_model), 0) < 1 then
        err = 'None in storage.';
      elsif v_x < 1 or v_x > v_kx - 1 then err = 'Stoves go on the kitchen''s back wall.';
      elsif st.idx is not null and st.dish is not null then err = 'That stove is cooking: wait until it''s done.';
      elsif st.idx is not null and st.model = v_model then err = 'That''s the same stove.';
      elsif st.idx is null and (select count(*) from public.arena_bistro_stoves where player_id = me) >= v_kx - 1 then
        err = 'Every stove spot is in use.';
      else
        if st.idx is not null then
          insert into public.arena_bistro_stove_store(player_id, model, qty) values (me, st.model, 1)
          on conflict (player_id, model) do update set qty = public.arena_bistro_stove_store.qty + 1;
          update public.arena_bistro_stoves set model = v_model where player_id = me and idx = st.idx;
        else
          insert into public.arena_bistro_stoves(player_id, idx, x, model)
          values (me, (select count(*) from public.arena_bistro_stoves where player_id = me), v_x, v_model);
        end if;
        update public.arena_bistro_stove_store set qty = qty - 1 where player_id = me and model = v_model;
        delete from public.arena_bistro_stove_store where player_id = me and qty <= 0;
      end if;
    elsif v_kind = 'stovemove' then
      -- A stove to another free spot on the back wall (moveStove).
      v_x = case when jsonb_typeof(a->'x') = 'number' then (a->>'x')::integer else -1 end;
      v_kx = public.arena_bistro_kitchen_x1(b.size_lv);
      select * into st from public.arena_bistro_stoves where player_id = me and idx = v_idx;
      if st.idx is null then err = 'No stove there.';
      elsif v_x < 1 or v_x > v_kx - 1 then err = 'Stoves go on the kitchen''s back wall.';
      elsif exists (select 1 from public.arena_bistro_stoves where player_id = me and x = v_x and idx <> st.idx) then
        err = 'Something''s already there.';
      else
        update public.arena_bistro_stoves set x = v_x where player_id = me and idx = st.idx;
      end if;
    elsif v_kind = 'expand' then
      -- A bigger dining room (EXPAND_STEPS).
      v_lv = (array[4, 8, 12, 16, 20])[b.size_lv + 1];
      v_price = (array[3000, 12000, 30000, 60000, 100000])[b.size_lv + 1];
      if v_price is null then err = 'The dining room is as big as it gets.';
      elsif b.level < v_lv then err = 'Expand at level ' || v_lv || '.';
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price, size_lv = size_lv + 1 where player_id = me;
        -- The kitchen grows a column: furniture standing there goes into storage.
        perform public.arena_bistro_clear_kitchen(me);
      end if;
    elsif v_kind in ('kitchen', 'shift') then
      v_lv = case when v_kind = 'kitchen' then b.kitchen_lv else b.shift_lv end;
      v_price = case when v_kind = 'kitchen' then (array[1500, 6000, 20000])[v_lv + 1] else (array[1000, 5000, 15000])[v_lv + 1] end;
      if v_price is null then err = case when v_kind = 'kitchen' then 'The kitchen is fully upgraded.' else 'Shifts are as long as they go.' end;
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      elsif v_kind = 'kitchen' then
        update public.arena_bistros set coins = coins - v_price, kitchen_lv = kitchen_lv + 1 where player_id = me;
      else
        update public.arena_bistros set coins = coins - v_price, shift_lv = shift_lv + 1 where player_id = me;
      end if;
    elsif v_kind = 'hire' then
      select count(*) into v_count from public.arena_bistro_staff where player_id = me and role = a->>'role';
      v_lv = case a->>'role' when 'cook' then (array[2, 5, 9])[v_count + 1] when 'waiter' then (array[1, 3, 6])[v_count + 1]
        when 'janitor' then (array[4, 8])[v_count + 1] end;
      v_price = case a->>'role' when 'cook' then (array[600, 3500, 12000])[v_count + 1] when 'waiter' then (array[0, 1500, 6000])[v_count + 1]
        when 'janitor' then (array[1200, 8000])[v_count + 1] end;
      v_friend = case when coalesce(a->>'friend', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then (a->>'friend')::uuid end;
      v_char = case when v_friend is not null
        then (select portrait_character from public.arena_profiles where id = v_friend and not suspended) else a->>'char' end;
      if a->>'role' not in ('cook', 'waiter', 'janitor') then err = 'Unknown role.';
      elsif v_lv is null then err = 'You have every ' || (a->>'role') || ' you can hire.';
      elsif b.level < v_lv then err = 'Hire at level ' || v_lv || '.';
      elsif a ? 'friend' and (v_friend is null or v_friend = me or not public.arena_farm_are_friends(me, v_friend)) then
        err = 'Only friends can work here.';
      elsif v_char is null or not (v_char = any(public.arena_champion_ids())) then err = 'Unknown creature.';
      elsif v_friend is not null and exists (select 1 from public.arena_bistro_staff where player_id = me and friend_id = v_friend) then
        err = 'Already on your team.';
      elsif v_friend is null and exists (select 1 from public.arena_bistro_staff where player_id = me and friend_id is null and creature = v_char) then
        err = 'Already on your team.';
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price where player_id = me;
        insert into public.arena_bistro_staff(player_id, id, creature, role, dish, friend_id)
        values (me, coalesce((select max(id) from public.arena_bistro_staff where player_id = me), 0) + 1,
          v_char, a->>'role',
          case when a->>'role' = 'cook' then (select id from public.arena_bistro_dishes where level <= b.level order by ord desc limit 1)
            else 'goicuon' end, v_friend);
      end if;
    elsif v_kind = 'feed' then
      select * into v_staff from public.arena_bistro_staff where player_id = me
        and id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer end;
      select slot, dish into v_slot, v_char from public.arena_bistro_counter
       where player_id = me and dish is not null and servings > 0 order by servings desc, slot limit 1;
      if v_staff.id is null then err = 'Not on your team.';
      elsif v_staff.fed_at is not null and t < v_staff.fed_at + interval '10 minutes' then
        err = 'They just ate: try again in a few minutes.';
      elsif v_slot is null then err = 'Nothing on the counter to eat.';
      else
        perform public.arena_bistro_take(me, v_char);
        -- Energy is as of now (the catch-up just ran).
        v_e = coalesce(v_staff.energy, public.arena_bistro_energy_max(v_staff.level));
        update public.arena_bistro_staff set fed_at = t,
          energy = least(public.arena_bistro_energy_max(level), v_e + 50)
         where player_id = me and id = v_staff.id;
      end if;
    elsif v_kind = 'sweep' then
      if b.trash <= 0 then err = 'Nothing to sweep.';
      else update public.arena_bistros set trash = trash - 1 where player_id = me;
      end if;
    elsif v_kind = 'dishup' then
      select * into v_dish from public.arena_bistro_dishes where id = a->>'dish';
      select l.lv, l.mastery into v_lv, n from public.arena_bistro_dish_lv l where l.player_id = me and l.dish = v_dish.id;
      v_lv = coalesce(v_lv, 1); n = coalesce(n, 0);
      v_rec = public.arena_bistro_recipe(v_dish.id);
      v_spice = (array[0, 0, 0, 0, 1, 1, 2, 2, 3])[v_lv];
      v_cost = v_dish.cost * (array[2, 5, 10, 16, 22, 30, 40, 50, 60])[v_lv];
      if v_dish.id is null then err = 'Unknown dish.';
      elsif v_dish.level > b.level then err = 'Opens at level ' || v_dish.level || '.';
      elsif v_lv >= 10 then err = v_dish.name || ' is at the top level.';
      elsif n < 5 * v_lv then err = 'Cook ' || (5 * v_lv - n) || ' more batches of ' || v_dish.name || ' first.';
      elsif public.arena_bistro_pantry_qty(me, v_rec[1]) < v_lv then
        err = 'You need ' || v_lv || ' ' || public.arena_bistro_ingredient_name(v_rec[1]) || '.';
      elsif public.arena_bistro_pantry_qty(me, v_rec[2]) < v_lv then
        err = 'You need ' || v_lv || ' ' || public.arena_bistro_ingredient_name(v_rec[2]) || '.';
      elsif public.arena_bistro_pantry_qty(me, 'spice') < v_spice then err = 'You need ' || v_spice || ' Spice.';
      elsif b.coins < v_cost then err = 'You need ' || v_cost || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_cost where player_id = me;
        update public.arena_bistro_pantry set qty = qty - v_lv where player_id = me and ingredient in (v_rec[1], v_rec[2]);
        update public.arena_bistro_pantry set qty = qty - v_spice where player_id = me and ingredient = 'spice' and v_spice > 0;
        insert into public.arena_bistro_dish_lv(player_id, dish, lv, mastery) values (me, v_dish.id, v_lv + 1, 0)
        on conflict (player_id, dish) do update set lv = v_lv + 1, mastery = 0;
      end if;
    elsif v_kind = 'market' then
      n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer else null end;
      v_ing = a->>'id';
      v_price = public.arena_bistro_market_price(t, v_ing);
      v_count = coalesce((select qty from public.arena_bistro_market where player_id = me and day = d and ingredient = v_ing), 0);
      if v_price is null then err = 'That''s not at the Market right now.';
      elsif n is null or n < 1 or n > 5 then err = 'Choose how many to buy.';
      elsif v_count + n > 5 then err = 'At most 5 ' || public.arena_bistro_ingredient_name(v_ing) || ' a day.';
      elsif public.arena_bistro_pantry_qty(me, v_ing) + n > 99 then err = 'Your pantry can''t hold more of that.';
      elsif b.coins < v_price * n then err = 'You need ' || v_price * n || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price * n where player_id = me;
        perform public.arena_bistro_add_ingredient(me, v_ing, n);
        insert into public.arena_bistro_market(player_id, day, ingredient, qty) values (me, d, v_ing, n)
        on conflict (player_id, day, ingredient) do update set qty = public.arena_bistro_market.qty + n;
      end if;
    elsif v_kind = 'farm' then
      n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer else null end;
      v_char = a->>'id';
      v_ing = case v_char when 'wheat' then 'flour' when 'mint' then 'herbs' when 'pepper' then 'chili'
        when 'lotus' then 'beans' when 'milk' then 'milk' end;
      v_count = coalesce((select qty from public.arena_bistro_farm_sent where player_id = me and day = d), 0);
      v_have = coalesce((select qty from public.arena_farm_barn where player_id = me and crop = v_char and mutation = ''), 0);
      if v_ing is null then err = 'That doesn''t go in the bistro.';
      elsif n is null or n < 1 or n > 30 then err = 'Choose how many to bring.';
      elsif v_count + n > 30 then err = 'At most 30 ingredients a day from the Farm.';
      elsif v_have < n * 3 then err = 'You need ' || n * 3 || ' in the Farm''s barn.';
      elsif public.arena_bistro_pantry_qty(me, v_ing) + n > 99 then err = 'Your pantry can''t hold more of that.';
      else
        update public.arena_farm_barn set qty = qty - n * 3 where player_id = me and crop = v_char and mutation = '';
        perform public.arena_bistro_add_ingredient(me, v_ing, n);
        insert into public.arena_bistro_farm_sent(player_id, day, qty) values (me, d, n)
        on conflict (player_id, day) do update set qty = public.arena_bistro_farm_sent.qty + n;
      end if;
    elsif v_kind in ('order', 'skip') then
      select * into v_order from public.arena_bistro_orders where player_id = me
        and slot = case when jsonb_typeof(a->'slot') = 'number' then (a->>'slot')::integer end;
      if v_order.dishes is null then err = 'No order there yet.';
      elsif v_kind = 'skip' then
        -- What was put aside goes back on the counter.
        perform public.arena_bistro_return_aside(me, v_order.filled);
        update public.arena_bistro_orders set dishes = null, filled = '{}'::jsonb, next_at = t + interval '30 minutes'
         where player_id = me and slot = v_order.slot;
      else
        -- Put aside what it still needs, as much as the counter has.
        v_put = 0;
        for v_od in select * from jsonb_array_elements(v_order.dishes) loop
          v_need = least(greatest(0, (v_od->>'qty')::integer - coalesce((v_order.filled->>(v_od->>'dish'))::integer, 0)),
            public.arena_bistro_on_counter(me, v_od->>'dish'));
          for v_k in 1..v_need loop perform public.arena_bistro_take(me, v_od->>'dish'); end loop;
          if v_need > 0 then
            v_order.filled = jsonb_set(v_order.filled, array[v_od->>'dish'],
              to_jsonb(coalesce((v_order.filled->>(v_od->>'dish'))::integer, 0) + v_need));
          end if;
          v_put = v_put + v_need;
        end loop;
        select bool_and(coalesce((v_order.filled->>(x->>'dish'))::integer, 0) >= (x->>'qty')::integer) into v_done
          from jsonb_array_elements(v_order.dishes) x;
        if v_put = 0 and not v_done then
          err = 'Nothing for this order on the counter yet.';
        elsif v_done then
          update public.arena_bistros set coins = coins + v_order.coins, tokens = tokens + v_order.tokens where player_id = me;
          perform public.arena_bistro_add_xp(me, v_order.xp);
          perform public.arena_bistro_points(me, 10);
          update public.arena_bistro_orders set dishes = null, filled = '{}'::jsonb, next_at = t + interval '15 minutes'
           where player_id = me and slot = v_order.slot;
        else
          update public.arena_bistro_orders set filled = v_order.filled where player_id = me and slot = v_order.slot;
        end if;
      end if;
    elsif v_kind = 'regular' then
      v_step = coalesce((select step from public.arena_bistro_regulars where player_id = me and rid = a->>'id'), 0);
      select r.*, dd.name dname, dd.level dlevel, dd.price dprice,
        (select count(*) from public.arena_bistro_regular_steps r2 where r2.rid = r.rid) nsteps
        into v_reg from public.arena_bistro_regular_steps r join public.arena_bistro_dishes dd on dd.id = r.dish
       where r.rid = a->>'id' and r.step = least(v_step, 2);
      if v_reg.rid is null then err = 'Nobody by that name.';
      elsif b.level < v_reg.level then err = v_reg.name || ' comes by at level ' || v_reg.level || '.';
      elsif v_step >= v_reg.nsteps then err = v_reg.name || '''s story is complete.';
      elsif v_reg.dlevel > b.level then err = v_reg.dname || ' opens at level ' || v_reg.dlevel || '.';
      elsif public.arena_bistro_on_counter(me, v_reg.dish) < v_reg.qty then
        err = 'You need ' || v_reg.qty || ' ' || v_reg.dname || ' on the counter.';
      else
        for n in 1..v_reg.qty loop perform public.arena_bistro_take(me, v_reg.dish); end loop;
        update public.arena_bistros set coins = coins + v_reg.qty * v_reg.dprice * 3
            + case when v_step = v_reg.nsteps - 1 then 1000 else 0 end,
          tokens = tokens + case when v_ev is not null then 3 else 0 end
         where player_id = me;
        perform public.arena_bistro_add_xp(me, v_reg.qty * 3);
        if v_step = v_reg.nsteps - 1 then
          insert into public.arena_bistro_stored(player_id, kind, qty) values (me, 'trophy', 1)
          on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + 1;
        end if;
        insert into public.arena_bistro_regulars(player_id, rid, step) values (me, v_reg.rid, v_step + 1)
        on conflict (player_id, rid) do update set step = v_step + 1;
        perform public.arena_bistro_points(me, 15);
      end if;
    elsif v_kind = 'league' then
      lw = (date_trunc('week', d) - interval '7 days')::date;
      v_last = coalesce((select points from public.arena_bistro_week where player_id = me and week = lw), 0);
      n = 1 + (select count(*) from public.arena_bistro_week w2 where w2.week = lw and w2.points > v_last
        and public.arena_farm_are_friends(me, w2.player_id));
      if v_last < 50 or exists (select 1 from public.arena_bistro_league_claims where player_id = me and week = lw) then
        err = 'Nothing to claim.';
      else
        insert into public.arena_bistro_league_claims(player_id, week) values (me, lw);
        update public.arena_bistros set coins = coins + case n when 1 then 2000 when 2 then 1200 when 3 then 800 else 300 end
         where player_id = me;
        perform public.arena_bistro_add_ingredient(me, 'spice', case n when 1 then 5 when 2 then 3 when 3 then 2 else 1 end);
      end if;
    elsif v_kind = 'branch' then
      if b.level < 30 then err = 'Open a new branch at level 30.';
      elsif b.stars >= 5 then err = 'Five stars: the most there are.';
      else
        -- Start over: the furniture goes into storage, the first room comes back.
        insert into public.arena_bistro_stored(player_id, kind, qty)
        select me, kind, count(*) from public.arena_bistro_items where player_id = me group by kind
        on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + excluded.qty;
        delete from public.arena_bistro_items where player_id = me;
        insert into public.arena_bistro_items(player_id, id, kind, x, y, rot) values
          (me, 1, 'rug', 3, 5, 0), (me, 2, 'table', 4, 5, 0), (me, 3, 'chair', 3, 5, 1),
          (me, 4, 'chair', 5, 5, 3), (me, 5, 'table', 8, 4, 0), (me, 6, 'chair', 8, 3, 2),
          (me, 7, 'chair', 8, 5, 0), (me, 8, 'table', 8, 7, 0), (me, 9, 'chair', 7, 7, 1),
          (me, 10, 'chair', 9, 7, 3), (me, 11, 'plant', 10, 0, 0), (me, 12, 'plant', 0, 8, 0),
          (me, 13, 'plant', 6, 0, 0);
        insert into public.arena_bistro_stove_store(player_id, model, qty)
        select me, model, count(*) from public.arena_bistro_stoves where player_id = me group by model
        on conflict (player_id, model) do update set qty = public.arena_bistro_stove_store.qty + excluded.qty;
        delete from public.arena_bistro_stoves where player_id = me;
        insert into public.arena_bistro_stoves(player_id, idx, x, model) values (me, 0, 1, 'clay'), (me, 1, 2, 'clay');
        update public.arena_bistro_counter set dish = case slot when 0 then 'goicuon' end,
          servings = case slot when 0 then 6 else 0 end, perfect = false where player_id = me;
        delete from public.arena_bistro_staff where player_id = me;
        insert into public.arena_bistro_staff(player_id, id, creature, role) values (me, 1, 'sunbara', 'waiter');
        delete from public.arena_bistro_orders where player_id = me;
        update public.arena_bistros set level = 1, xp = 0, coins = 500, rating = 3, kitchen_lv = 0, shift_lv = 0,
          size_lv = 0, trash = 0, stars = stars + 1 where player_id = me;
      end if;
    elsif v_kind = 'train' then
      select * into v_staff from public.arena_bistro_staff where player_id = me
        and id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer end;
      if v_staff.id is null then err = 'Not on your team.';
      elsif v_staff.level >= 10 then err = 'Already at the top level.';
      elsif b.coins < 300 * v_staff.level * v_staff.level then err = 'You need ' || 300 * v_staff.level * v_staff.level || ' coins.';
      else
        update public.arena_bistros set coins = coins - 300 * v_staff.level * v_staff.level where player_id = me;
        update public.arena_bistro_staff set level = level + 1 where player_id = me and id = v_staff.id;
      end if;
    elsif v_kind = 'cookdish' then
      select * into v_staff from public.arena_bistro_staff where player_id = me and role = 'cook'
        and id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer end;
      select * into v_dish from public.arena_bistro_dishes where id = a->>'dish';
      if v_staff.id is null then err = 'Not a cook.';
      elsif v_dish.id is null then err = 'Unknown dish.';
      elsif v_dish.level > b.level then err = 'Opens at level ' || v_dish.level || '.';
      else update public.arena_bistro_staff set dish = v_dish.id where player_id = me and id = v_staff.id;
      end if;
    elsif v_kind = 'chef' then
      if not (a->>'id' = any(public.arena_champion_ids())) then err = 'Unknown creature.';
      else update public.arena_bistros set chef = a->>'id' where player_id = me;
      end if;
    elsif v_kind = 'trade' then
      n = case when jsonb_typeof(a->'lots') = 'number' then (a->>'lots')::integer else null end;
      v_traded = coalesce((select sum(amount) from public.arena_leaf_ledger
        where player_id = me and day = d and reason = 'bistro-trade'), 0);
      if n is null or n < 1 or n > 15 then err = 'Choose how many to trade.';
      elsif v_traded + n * 20 > 300 then err = 'You can trade for at most 300 Gold Leaves a day.';
      elsif b.coins < n * 100 then err = 'You need ' || n * 100 || ' coins.';
      elsif not public.arena_grant_leaves(me, n * 20, 'bistro-trade', p_request || ':' || i, d) then
        err = 'The trade could not be made.';
      else
        update public.arena_bistros set coins = coins - n * 100 where player_id = me;
        gained = jsonb_build_object('leaves', n * 20);
      end if;
    elsif v_kind = 'sync' then
      null;
    else
      err = 'Unknown action.';
    end if;
    results = results || jsonb_build_array(case when err is null
      then jsonb_build_object('ok', true) || coalesce(gained, '{}'::jsonb)
      else jsonb_build_object('ok', false, 'error', err) end);
  end loop;
  return jsonb_build_object('bistro', public.arena_bistro_state(me), 'results', results, 'away', v_away);
end; $$;
revoke all on function public.arena_bistro_act(uuid, jsonb) from public, anon;
grant execute on function public.arena_bistro_act(uuid, jsonb) to authenticated;

commit;

select (select count(*) from public.arena_bistro_kinds where seat is not null) = 8 as bistro_items_perks;
