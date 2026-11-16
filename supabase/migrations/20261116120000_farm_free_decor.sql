-- Farm decorations stand anywhere on the farm's land, as in most farm games
-- (048 gave them 8 fixed spots). Run after 20261115230000_chat_friend_messages.sql.
-- Safe to run again.
--   * arena_farm_decor_pieces: each decoration on a farm, at a point on a
--     10 px grid (world px of the farm scene), mirrored or not. What stood
--     in the 8 spots moves here, at the same places.
--   * A decoration takes a box of ground (w, d per item); it can't overlap
--     the field, the buildings, the pond, the paths that must stay clear,
--     the farm's trees or another decoration. arena_farm_decor_fits is the
--     same check as decorFits in packages/shared/src/farm.ts.
--   * A farm has room for 10 + its level decorations, up to 60.
--   * Actions: decor-place (a stored copy first, free; otherwise bought with
--     Gold Leaves from its level), decor-move, decor-store (into storage,
--     to place again for free). The old spot actions answer that the game
--     needs updating.
--   * Eight new decorations drawn with the farm's existing art.
begin;

alter table public.arena_farm_decor_items add column if not exists w integer;
alter table public.arena_farm_decor_items add column if not exists d integer;
insert into public.arena_farm_decor_items(id, name, price, charm, level, w, d) values
  ('rock', 'Mossy Rock', 300, 1, 1, 26, 14),
  ('hay', 'Hay Bale', 400, 1, 2, 34, 16),
  ('bush6', 'Rose Bush', 450, 1, 3, 34, 16),
  ('mailbox', 'Mailbox', 500, 1, 4, 14, 8),
  ('bush7', 'Fern Bush', 550, 1, 5, 34, 16),
  ('bench', 'Park Bench', 700, 1, 6, 46, 12),
  ('flowers', 'Flower Bush', 650, 1, 7, 34, 16),
  ('crates', 'Crates', 950, 1, 8, 32, 16),
  ('lamp', 'Street Lamp', 1350, 2, 12, 14, 8),
  ('planter', 'Flower Planter', 2250, 3, 16, 50, 14),
  ('mintree', 'Mint Tree', 3000, 3, 19, 46, 20),
  ('pine', 'Pine Tree', 3200, 2, 22, 34, 18),
  ('autumn', 'Maple Tree', 3600, 3, 25, 46, 20),
  ('cherry', 'Cherry Tree', 3900, 3, 27, 46, 20),
  ('apple', 'Apple Tree', 4200, 4, 30, 46, 20),
  ('orange', 'Orange Tree', 4800, 4, 36, 46, 20),
  ('tower', 'Gazebo', 6050, 10, 45, 72, 34),
  ('plum', 'Guest Cottage', 8550, 12, 60, 88, 40),
  ('statue', 'Golden Voltkit Statue', 30000, 15, 75, 38, 18)
on conflict (id) do update set name = excluded.name, price = excluded.price,
  charm = excluded.charm, level = excluded.level, w = excluded.w, d = excluded.d;

create table if not exists public.arena_farm_decor_pieces (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  item text not null references public.arena_farm_decor_items(id),
  x integer not null check (x between 0 and 1760),
  y integer not null check (y between 0 and 1080),
  flip boolean not null default false,
  placed_at timestamptz not null default now()
);
create index if not exists arena_farm_decor_pieces_player on public.arena_farm_decor_pieces (player_id, id);
alter table public.arena_farm_decor_pieces enable row level security;
revoke all on public.arena_farm_decor_pieces from public, anon, authenticated, service_role;

-- What stood in the 8 spots moves to the same places (the client's spots).
insert into public.arena_farm_decor_pieces(player_id, item, x, y, placed_at)
select x.player_id, x.item, s.x, s.y, x.placed_at
  from public.arena_farm_decor x
  join (values (0, 80, 830), (1, 230, 870), (2, 530, 870), (3, 1240, 870),
               (4, 70, 540), (5, 1700, 880), (6, 1390, 890), (7, 390, 890)) s(slot, x, y)
    on s.slot = x.slot
 where x.item is not null
 order by x.player_id, x.slot;
delete from public.arena_farm_decor;

create or replace function public.arena_farm_charm(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(i.charm), 0)::integer from public.arena_farm_decor_pieces x
  join public.arena_farm_decor_items i on i.id = x.item where x.player_id = pid
$$;
revoke all on function public.arena_farm_charm(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_farm_decor_cap(lv integer) returns integer
language sql immutable as $$ select least(60, 10 + greatest(1, lv)) $$;
revoke all on function public.arena_farm_decor_cap(integer) from public, anon, authenticated, service_role;

-- Null when the decoration fits at (px, py); otherwise why not. The same
-- check, blocks and boxes as decorFits / DECOR_BLOCKS in the shared rules.
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
      ('rect', 250, 326, 520, 576), ('rect', 830, 940, 770, 1060)) r(k, a1, a2, a3, a4) loop
    if x0 < b.a2 and b.a1 < x1 and y0 < b.a4 and b.a3 < y1 then
      return 'Something is in the way';
    end if;
  end loop;
  -- Ovals: centre, radii (the pond, then the farm's trees).
  for b in select * from (values (250, 990, 190, 82),
      (338, 230, 52, 26), (812, 190, 52, 26), (44, 400, 52, 26), (1480, 340, 52, 26),
      (1700, 330, 52, 26), (70, 210, 52, 26), (640, 1050, 52, 26), (1120, 1060, 52, 26),
      (1450, 1040, 52, 26), (1720, 1000, 52, 26), (40, 1060, 52, 26)) o(ox, oy, rx, ry) loop
    cx = least(greatest(b.ox::double precision, x0), x1);
    cy = least(greatest(b.oy::double precision, y0), y1);
    if ((cx - b.ox) / b.rx) ^ 2 + ((cy - b.oy) / b.ry) ^ 2 < 1 then
      return 'Something is in the way';
    end if;
  end loop;
  if exists (select 1 from public.arena_farm_decor_pieces p
      join public.arena_farm_decor_items o on o.id = p.item
     where p.player_id = pid and p.id is distinct from except_id
       and x0 < p.x + coalesce(o.w, 30) and p.x - coalesce(o.w, 30) < x1
       and y0 < p.y + 4 and p.y - coalesce(o.d, 14) < y1) then
    return 'Too close to another decoration';
  end if;
  return null;
end; $$;
revoke all on function public.arena_farm_decor_fits(uuid, text, integer, integer, bigint)
  from public, anon, authenticated, service_role;

-- The farm state: as before, with the decorations where they stand.
do $$
begin
  if to_regprocedure('public.arena_farm_state_spots(uuid)') is null then
    alter function public.arena_farm_state(uuid) rename to arena_farm_state_spots;
  end if;
end $$;
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.arena_farm_state_spots(pid) || jsonb_build_object(
    'decor', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'item', p.item,
        'x', p.x, 'y', p.y, 'flip', p.flip) order by p.id)
      from public.arena_farm_decor_pieces p where p.player_id = pid), '[]'::jsonb),
    'charm', public.arena_farm_charm(pid))
$$;
revoke all on function public.arena_farm_state(uuid), public.arena_farm_state_spots(uuid)
  from public, anon, authenticated, service_role;

-- The decoration actions; everything else as before (065's function).
do $$
begin
  if to_regprocedure('public.arena_farm_act_spots(uuid, jsonb, text, timestamptz, date)') is null then
    alter function public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date) rename to arena_farm_act_spots;
  end if;
end $$;
create or replace function public.arena_farm_act_more(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; v_item public.arena_farm_decor_items; v_piece public.arena_farm_decor_pieces;
  px integer; py integer; v_flip boolean; v_id bigint; cost integer; used integer; n integer;
begin
  xp = 0;
  if a->>'a' in ('decor', 'decor-remove') then
    err = 'Update the game to decorate';
    return;
  end if;
  if a->>'a' not in ('decor-place', 'decor-move', 'decor-store') then
    select x.err, x.gained, x.xp into err, gained, xp
      from public.arena_farm_act_spots(pid, a, ref, t, d) x;
    return;
  end if;
  select * into f from public.arena_farms where player_id = pid;
  px = case when jsonb_typeof(a->'x') = 'number' and (a->>'x') ~ '^-?[0-9]+$' then (a->>'x')::integer end;
  py = case when jsonb_typeof(a->'y') = 'number' and (a->>'y') ~ '^-?[0-9]+$' then (a->>'y')::integer end;
  v_flip = coalesce(case when jsonb_typeof(a->'flip') = 'boolean' then (a->>'flip')::boolean end, false);
  v_id = case when jsonb_typeof(a->'piece') = 'number' and (a->>'piece') ~ '^[0-9]+$' then (a->>'piece')::bigint end;
  if a->>'a' = 'decor-place' then
    select * into v_item from public.arena_farm_decor_items where id = a->>'item';
    if v_item.id is null then err = 'Unknown decoration'; return; end if;
    -- A stored one (put away, or a reward) can be placed before its level.
    if f.level < v_item.level and not exists (select 1 from public.arena_farm_decor_credits
        where player_id = pid and item = v_item.id and qty > 0) then
      err = 'Unlocks at farm level ' || v_item.level; return;
    end if;
    select count(*) into n from public.arena_farm_decor_pieces where player_id = pid;
    if n >= public.arena_farm_decor_cap(f.level) then
      err = 'Your farm has room for ' || public.arena_farm_decor_cap(f.level) || ' decorations'; return;
    end if;
    err = public.arena_farm_decor_fits(pid, v_item.id, px, py);
    if err is not null then return; end if;
    update public.arena_farm_decor_credits set qty = qty - 1
     where player_id = pid and item = v_item.id and qty > 0;
    get diagnostics used = row_count;
    cost = case when used > 0 then 0 else v_item.price end;
    if cost > 0 and not public.arena_spend_leaves(pid, cost, 'farm-decor', ref, d) then
      err = 'Not enough Gold Leaves'; return;
    end if;
    insert into public.arena_farm_decor_pieces(player_id, item, x, y, flip, placed_at)
    values (pid, v_item.id, px, py, v_flip, t) returning id into v_id;
    gained = jsonb_build_object('decor', v_item.id, 'piece', v_id, 'x', px, 'y', py, 'cost', cost);
  elsif a->>'a' = 'decor-move' then
    select * into v_piece from public.arena_farm_decor_pieces where player_id = pid and id = v_id for update;
    if v_piece.id is null then err = 'Nothing there'; return; end if;
    err = public.arena_farm_decor_fits(pid, v_piece.item, px, py, v_piece.id);
    if err is not null then return; end if;
    update public.arena_farm_decor_pieces set x = px, y = py, flip = v_flip where id = v_piece.id;
    gained = jsonb_build_object('moved', v_piece.id, 'x', px, 'y', py);
  else
    select * into v_piece from public.arena_farm_decor_pieces where player_id = pid and id = v_id for update;
    if v_piece.id is null then err = 'Nothing there'; return; end if;
    delete from public.arena_farm_decor_pieces where id = v_piece.id;
    insert into public.arena_farm_decor_credits(player_id, item, qty) values (pid, v_piece.item, 1)
    on conflict (player_id, item) do update set qty = public.arena_farm_decor_credits.qty + 1;
    gained = jsonb_build_object('stored', v_piece.item, 'piece', v_piece.id);
  end if;
end; $$;
revoke all on function public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date),
  public.arena_farm_act_spots(uuid, jsonb, text, timestamptz, date)
  from public, anon, authenticated, service_role;

commit;

select
  to_regclass('public.arena_farm_decor_pieces') is not null as farm_free_decor_enabled,
  (select count(*) from public.arena_farm_decor_items) = 19 as decor_items_seeded;
