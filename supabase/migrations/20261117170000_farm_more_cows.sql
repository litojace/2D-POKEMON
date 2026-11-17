-- More cows, sooner. Run after 20261117160000_farm_coop_wider.sql.
-- Safe to run again. Numbers and reasons: docs/farm-coop.md.
--   * The pasture holds 5 cows (was 3). The 2nd comes at farm level 32 for
--     4000 Gold Leaves (was 40, 6000), the 3rd at 42 for 6000 (was 55,
--     10000), the 4th at 55 for 9000 and the 5th at 68 for 13000
--     (PASTURE.cowLevels / cowPrices in packages/shared/src/farm.ts).
--     Cows already bought stay; nothing is refunded.
--   * Each new cow is like the others: 2 Storm Milk every 2 hours, its first
--     milk 20 minutes after it arrives; `milk` takes the cow (0 to 4).
--   * A bigger pasture for them: its top moves from 420 up to 348, level
--     with the field's back rail, and its right side from 1720 out past the
--     farm's edge to 1860 (world px; no decoration from 318 down, was 390).
--     The round tree at (1480, 340) and the pine at (1700, 330) are felled
--     for it, and on the client the edge trees beside it.
--     arena_farm_decor_fits is 20261117160000's with that block and without
--     the two trees (DECOR_BLOCKS in packages/shared/src/farm.ts matches);
--     decorations standing on the new ground go into storage (placed again
--     for free), as in 20261117160000.
--   * Hooks as in 20261117100000: arena_farm_act_extra wraps the function
--     it replaces (renamed once to arena_farm_act_extra_coop) and handles
--     buying cows and milking cows 1 to 4 itself; anything else goes on.
begin;

-- Places 1..4 in the pasture (the first cow's milk stays arena_farms.milk_at).
alter table public.arena_farm_cows drop constraint if exists arena_farm_cows_idx_check;
alter table public.arena_farm_cows add constraint arena_farm_cows_idx_check check (idx between 1 and 4);

-- Decorations on the pasture's new ground go into storage.
with gone as (
  delete from public.arena_farm_decor_pieces p
   using public.arena_farm_decor_items i
   where i.id = p.item
     and p.x - coalesce(i.w, 30) < 1750 and 1450 < p.x + coalesce(i.w, 30)
     and p.y - coalesce(i.d, 14) < 690 and 318 < p.y + 4
  returning p.player_id, p.item
)
insert into public.arena_farm_decor_credits(player_id, item, qty)
select player_id, item, count(*)::integer from gone group by player_id, item
on conflict (player_id, item) do update set qty = public.arena_farm_decor_credits.qty + excluded.qty;

-- As 20261117160000's, with the pasture's taller block and its two trees felled.
create or replace function public.arena_farm_decor_fits(pid uuid, v_item text, px integer, py integer,
  except_id bigint default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare i public.arena_farm_decor_items; x0 double precision; x1 double precision;
  y0 double precision; y1 double precision; b record; cx double precision; cy double precision;
begin
  select * into i from public.arena_farm_decor_items where id = v_item;
  if px is null or py is null or px % 10 <> 0 or py % 10 <> 0 then
    return 'Choose a spot on the farm';
  end if;
  x0 = px - coalesce(i.w, 30); x1 = px + coalesce(i.w, 30);
  y0 = py - coalesce(i.d, 14); y1 = py + 4;
  if x0 < 20 or x1 > 1740 or y0 < 120 or y1 > 1060 then
    return 'Choose a spot on the farm';
  end if;
  for b in select * from (values
      ('rect', 314, 1456, 338, 770), ('rect', 380, 1480, 770, 842),
      ('rect', 20, 1460, 120, 360), ('rect', 1450, 1750, 318, 690),
      ('rect', 80, 220, 630, 726), ('rect', 1470, 1680, 754, 840),
      ('rect', 250, 326, 520, 576), ('rect', 830, 940, 770, 1060),
      ('rect', 960, 1440, 846, 1040)) r(k, a1, a2, a3, a4) loop
    if x0 < b.a2 and b.a1 < x1 and y0 < b.a4 and b.a3 < y1 then
      return 'Something is in the way';
    end if;
  end loop;
  for b in select * from (values (250, 990, 190, 82),
      (338, 230, 52, 26), (812, 190, 52, 26), (44, 400, 52, 26),
      (70, 210, 52, 26), (640, 1050, 52, 26),
      (1720, 1000, 52, 26), (40, 1060, 52, 26)) o(ox, oy, rx, ry) loop
    cx = least(greatest(b.ox::double precision, x0), x1);
    cy = least(greatest(b.oy::double precision, y0), y1);
    if ((cx - b.ox) / b.rx) ^ 2 + ((cy - b.oy) / b.ry) ^ 2 < 1 then
      return 'Something is in the way';
    end if;
  end loop;
  if exists (select 1 from public.arena_farm_decor_pieces p
      join public.arena_farm_decor_items o on o.id = p.item
     where p.player_id = pid and p.id is distinct from except_id
       and not (coalesce(i.ground, false) and o.ground)
       and x0 < p.x + coalesce(o.w, 30) and p.x - coalesce(o.w, 30) < x1
       and y0 < p.y + 4 and p.y - coalesce(o.d, 14) < y1) then
    return 'Too close to another decoration';
  end if;
  return null;
end; $$;
revoke all on function public.arena_farm_decor_fits(uuid, text, integer, integer, bigint)
  from public, anon, authenticated, service_role;

do $$
begin
  if to_regprocedure('public.arena_farm_act_extra_coop(uuid, jsonb, text, timestamptz, date)') is null then
    alter function public.arena_farm_act_extra(uuid, jsonb, text, timestamptz, date) rename to arena_farm_act_extra_coop;
  end if;
end $$;
create or replace function public.arena_farm_act_extra(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; c public.arena_farm_cows; n integer; cost integer; lv integer;
begin
  xp = 0;
  n = case when jsonb_typeof(a->'cow') = 'number' and (a->>'cow') ~ '^[0-9]+$' then (a->>'cow')::integer end;
  if a->>'a' = 'milk' and a ? 'cow' and (n is null or n > 4) then
    err = 'Choose a cow';
    return;
  end if;
  if not (a->>'a' = 'buy-cow' or (a->>'a' = 'milk' and coalesce(n between 1 and 4, false))) then
    select x.err, x.gained, x.xp into err, gained, xp
      from public.arena_farm_act_extra_coop(pid, a, ref, t, d) x;
    return;
  end if;
  select * into f from public.arena_farms where player_id = pid;
  if a->>'a' = 'buy-cow' then
    select count(*) + 1 into n from public.arena_farm_cows where player_id = pid;
    lv = case n when 1 then 32 when 2 then 42 when 3 then 55 when 4 then 68 end;
    cost = case n when 1 then 4000 when 2 then 6000 when 3 then 9000 when 4 then 13000 end;
    if not f.pasture then err = 'Open the pasture first';
    elsif lv is null then err = 'Your pasture is full';
    elsif f.level < lv then err = 'Unlocks at farm level ' || lv;
    -- One purchase per place in the pasture: a retry can never buy it twice.
    elsif not public.arena_spend_leaves(pid, cost, 'farm-cow', 'cow-' || n, d) then
      err = 'Not enough Gold Leaves';
    else
      insert into public.arena_farm_cows(player_id, idx, milk_at) values (pid, n, t + interval '20 minutes');
      gained = jsonb_build_object('cow', n, 'cost', cost, 'milkAt', t + interval '20 minutes');
    end if;
  else
    -- Cows 1 to 4 (the first, 0, is 064's).
    select * into c from public.arena_farm_cows where player_id = pid and idx = n for update;
    if c.idx is null then err = 'Choose a cow';
    elsif c.milk_at > t then err = 'The cow is still grazing';
    elsif (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = pid) + 2
        > 80 + 40 * f.barn_upgrades then
      err = 'Your barn is full';
    else
      insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (pid, 'milk', '', 2)
      on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 2;
      update public.arena_farm_cows set milk_at = t + interval '2 hours' where player_id = pid and idx = n;
      gained = jsonb_build_object('milk', 2, 'cow', n, 'milkAt', t + interval '2 hours');
      xp = 8;
    end if;
  end if;
end; $$;

revoke all on function public.arena_farm_act_extra(uuid, jsonb, text, timestamptz, date),
  public.arena_farm_act_extra_coop(uuid, jsonb, text, timestamptz, date)
  from public, anon, authenticated, service_role;
commit;

select
  to_regprocedure('public.arena_farm_act_extra_coop(uuid, jsonb, text, timestamptz, date)') is not null as farm_more_cows_hooked;
