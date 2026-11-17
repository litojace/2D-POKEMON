-- A roomier Chicken Coop: its ground grows from 990..1350 × 846..1010 to
-- 960..1440 × 846..1040 (world px), so the hens have room to roam and are
-- easier to tap on a phone. The cherry tree at (1450, 1040) is felled for it
-- (as the round tree at (1120, 1060) was in 20261117100000). Run after
-- 20261117150000_spire_zone4.sql. Safe to run again.
--   * arena_farm_decor_fits: as in 20261117120000_farm_decor_catalog.sql
--     (ground pieces may overlap), with the coop's new block and without the
--     felled tree. COOP / DECOR_BLOCKS in packages/shared/src/farm.ts match.
--   * Decorations standing on the coop's new ground go into storage (placed
--     again for free), as in 20261117100000.
begin;

with gone as (
  delete from public.arena_farm_decor_pieces p
   using public.arena_farm_decor_items i
   where i.id = p.item
     and p.x - coalesce(i.w, 30) < 1440 and 960 < p.x + coalesce(i.w, 30)
     and p.y - coalesce(i.d, 14) < 1040 and 846 < p.y + 4
  returning p.player_id, p.item
)
insert into public.arena_farm_decor_credits(player_id, item, qty)
select player_id, item, count(*)::integer from gone group by player_id, item
on conflict (player_id, item) do update set qty = public.arena_farm_decor_credits.qty + excluded.qty;

-- As 20261117120000's, with the coop's wider block and the cherry tree at
-- (1450, 1040) felled.
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
      ('rect', 20, 1460, 120, 360), ('rect', 1450, 1750, 390, 690),
      ('rect', 80, 220, 630, 726), ('rect', 1470, 1680, 754, 840),
      ('rect', 250, 326, 520, 576), ('rect', 830, 940, 770, 1060),
      ('rect', 960, 1440, 846, 1040)) r(k, a1, a2, a3, a4) loop
    if x0 < b.a2 and b.a1 < x1 and y0 < b.a4 and b.a3 < y1 then
      return 'Something is in the way';
    end if;
  end loop;
  for b in select * from (values (250, 990, 190, 82),
      (338, 230, 52, 26), (812, 190, 52, 26), (44, 400, 52, 26), (1480, 340, 52, 26),
      (1700, 330, 52, 26), (70, 210, 52, 26), (640, 1050, 52, 26),
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

commit;

select position('(''rect'', 960, 1440, 846, 1040)' in
  pg_get_functiondef('public.arena_farm_decor_fits(uuid,text,integer,integer,bigint)'::regprocedure)) > 0
  as farm_coop_wider;
