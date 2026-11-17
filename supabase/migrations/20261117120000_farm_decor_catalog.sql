-- More decorations, in groups, with paths, seasons and collections.
-- Run after 20261116180000_spire_zone2.sql. Safe to run again.
--   * arena_farm_decor_items gains decor_group (the shop's tab), ground
--     (paths and paving: they may overlap each other, never anything
--     standing) and season (sold only then). 42 new decorations, 61 in all,
--     the same list as FARM_DECOR in packages/shared/src/farm.ts.
--   * arena_farm_decor_seasons(day): the seasons on sale on a game day
--     (arena_today, Los Angeles), the same table as DECOR_SEASONS.
--     A seasonal decoration is bought only in its season; a stored one
--     places again at any time.
--   * Collections (arena_farm_decor_sets, _set_items, as DECOR_SETS): every
--     piece of a set on the farm at once adds the set's Charm
--     (arena_farm_charm, as decorCharm).
--   * arena_farm_decor_fits: as before, except two ground pieces may
--     overlap (decorFits).
--   * The farm state adds decorSeasons, the seasons on sale today.
begin;

alter table public.arena_farm_decor_items add column if not exists decor_group text;
alter table public.arena_farm_decor_items add column if not exists ground boolean not null default false;
alter table public.arena_farm_decor_items add column if not exists season text;
insert into public.arena_farm_decor_items(id, name, price, charm, level, w, d, decor_group, ground, season) values
  ('rock', 'Mossy Rock', 300, 1, 1, 26, 14, 'plants', false, null),
  ('hay', 'Hay Bale', 400, 1, 2, 34, 16, 'furniture', false, null),
  ('bush6', 'Rose Bush', 450, 1, 3, 34, 16, 'plants', false, null),
  ('mailbox', 'Mailbox', 500, 1, 4, 14, 8, 'furniture', false, null),
  ('bush7', 'Fern Bush', 550, 1, 5, 34, 16, 'plants', false, null),
  ('bench', 'Park Bench', 700, 1, 6, 46, 12, 'furniture', false, null),
  ('flowers', 'Flower Bush', 650, 1, 7, 34, 16, 'plants', false, null),
  ('crates', 'Crates', 950, 1, 8, 32, 16, 'furniture', false, null),
  ('lamp', 'Street Lamp', 1350, 2, 12, 14, 8, 'lights', false, null),
  ('planter', 'Flower Planter', 2250, 3, 16, 50, 14, 'plants', false, null),
  ('mintree', 'Mint Tree', 3000, 3, 19, 46, 20, 'trees', false, null),
  ('pine', 'Pine Tree', 3200, 2, 22, 34, 18, 'trees', false, null),
  ('autumn', 'Maple Tree', 3600, 3, 25, 46, 20, 'trees', false, null),
  ('cherry', 'Cherry Tree', 3900, 3, 27, 46, 20, 'trees', false, null),
  ('apple', 'Apple Tree', 4200, 4, 30, 46, 20, 'trees', false, null),
  ('orange', 'Orange Tree', 4800, 4, 36, 46, 20, 'trees', false, null),
  ('tower', 'Gazebo', 6050, 10, 45, 72, 34, 'furniture', false, null),
  ('plum', 'Guest Cottage', 8550, 12, 60, 88, 40, 'furniture', false, null),
  ('statue', 'Golden Voltkit Statue', 30000, 15, 75, 38, 18, 'statues', false, null),
  ('picket', 'Picket Fence', 300, 1, 3, 25, 6, 'fences', false, null),
  ('railfence', 'Rail Fence', 350, 1, 5, 25, 6, 'fences', false, null),
  ('gate', 'Garden Gate', 600, 1, 9, 25, 6, 'fences', false, null),
  ('hedge', 'Box Hedge', 1000, 2, 14, 25, 10, 'fences', false, null),
  ('pathstone', 'Stepping Stones', 300, 1, 2, 20, 16, 'fences', true, null),
  ('pathgravel', 'Gravel Path', 300, 1, 4, 30, 16, 'fences', true, null),
  ('pathbrick', 'Brick Path', 450, 1, 10, 30, 16, 'fences', true, null),
  ('tulips', 'Tulip Patch', 350, 1, 2, 20, 10, 'plants', false, null),
  ('potdaisy', 'Potted Daisies', 400, 1, 4, 12, 8, 'plants', false, null),
  ('sunflowers', 'Sunflowers', 450, 1, 6, 20, 10, 'plants', false, null),
  ('barrow', 'Flower Barrow', 1000, 2, 13, 26, 12, 'plants', false, null),
  ('lavender', 'Lavender Row', 1100, 2, 15, 30, 10, 'plants', false, null),
  ('topiary', 'Topiary', 1500, 3, 20, 16, 10, 'plants', false, null),
  ('birch', 'Silver Birch', 1800, 3, 18, 30, 18, 'trees', false, null),
  ('bamboo', 'Bamboo Grove', 1650, 3, 21, 24, 12, 'trees', false, null),
  ('palm', 'Palm Tree', 2400, 4, 28, 30, 18, 'trees', false, null),
  ('willow', 'Weeping Willow', 3000, 5, 34, 46, 20, 'trees', false, null),
  ('deckchair', 'Deck Chair', 450, 1, 5, 16, 10, 'furniture', false, null),
  ('picnic', 'Picnic Table', 900, 2, 9, 40, 16, 'furniture', false, null),
  ('parasol', 'Patio Umbrella', 1000, 2, 11, 22, 12, 'furniture', false, null),
  ('swing', 'Garden Swing', 1500, 3, 17, 36, 14, 'furniture', false, null),
  ('birdbath', 'Birdbath', 550, 1, 7, 14, 8, 'water', false, null),
  ('lilypond', 'Lily Pond', 1800, 3, 20, 46, 22, 'water', false, null),
  ('fountain', 'Little Fountain', 2400, 4, 24, 30, 16, 'water', false, null),
  ('bridge', 'Wooden Bridge', 1800, 3, 26, 36, 16, 'water', false, null),
  ('torch', 'Tiki Torch', 500, 1, 8, 10, 8, 'lights', false, null),
  ('lantern', 'Paper Lantern', 900, 2, 10, 12, 8, 'lights', false, null),
  ('stringlights', 'String Lights', 1650, 3, 23, 40, 8, 'lights', false, null),
  ('stonelantern', 'Stone Lantern', 2200, 4, 29, 16, 10, 'lights', false, null),
  ('frog', 'Frog Statue', 550, 1, 6, 14, 8, 'statues', false, null),
  ('bunny', 'Bunny Statue', 900, 2, 12, 14, 8, 'statues', false, null),
  ('owl', 'Owl Statue', 1100, 2, 16, 14, 10, 'statues', false, null),
  ('deer', 'Deer Statue', 2400, 4, 32, 24, 12, 'statues', false, null),
  ('pumpkin', 'Jack-o''-Lantern', 600, 1, 1, 14, 10, 'seasonal', false, 'halloween'),
  ('tombstone', 'Spooky Tombstone', 900, 2, 5, 16, 8, 'seasonal', false, 'halloween'),
  ('cauldron', 'Witch''s Cauldron', 1500, 3, 10, 18, 10, 'seasonal', false, 'halloween'),
  ('redlantern', 'Red Lantern Post', 600, 1, 1, 12, 8, 'seasonal', false, 'lunar'),
  ('luckycat', 'Lucky Cat', 900, 2, 5, 14, 10, 'seasonal', false, 'lunar'),
  ('plumtree', 'Plum Blossom Tree', 1800, 3, 10, 30, 18, 'seasonal', false, 'lunar'),
  ('snowman', 'Snowman', 600, 1, 1, 18, 10, 'seasonal', false, 'christmas'),
  ('gifts', 'Gift Pile', 900, 2, 5, 20, 10, 'seasonal', false, 'christmas'),
  ('xmastree', 'Christmas Tree', 1800, 3, 10, 30, 18, 'seasonal', false, 'christmas')
on conflict (id) do update set name = excluded.name, price = excluded.price,
  charm = excluded.charm, level = excluded.level, w = excluded.w, d = excluded.d,
  decor_group = excluded.decor_group, ground = excluded.ground, season = excluded.season;

create table if not exists public.arena_farm_decor_sets (
  id text primary key,
  name text not null,
  charm integer not null check (charm > 0)
);
create table if not exists public.arena_farm_decor_set_items (
  set_id text not null references public.arena_farm_decor_sets(id) on delete cascade,
  item text not null references public.arena_farm_decor_items(id),
  primary key (set_id, item)
);
alter table public.arena_farm_decor_sets enable row level security;
alter table public.arena_farm_decor_set_items enable row level security;
revoke all on public.arena_farm_decor_sets, public.arena_farm_decor_set_items
  from public, anon, authenticated, service_role;
insert into public.arena_farm_decor_sets(id, name, charm) values
  ('cottage', 'Cottage Garden', 4),
  ('picnic', 'Picnic Meadow', 4),
  ('lanterns', 'Lantern Walk', 5),
  ('orchard', 'Orchard', 5),
  ('watergarden', 'Water Garden', 6),
  ('woodland', 'Woodland Friends', 6),
  ('spooky', 'Spooky Night', 3),
  ('lunar', 'Lunar New Year', 3),
  ('winter', 'Winter Holiday', 3)
on conflict (id) do update set name = excluded.name, charm = excluded.charm;
delete from public.arena_farm_decor_set_items where set_id in
  ('cottage', 'picnic', 'lanterns', 'orchard', 'watergarden', 'woodland', 'spooky', 'lunar', 'winter');
insert into public.arena_farm_decor_set_items(set_id, item) values
  ('cottage', 'picket'),
  ('cottage', 'gate'),
  ('cottage', 'tulips'),
  ('cottage', 'birdbath'),
  ('cottage', 'barrow'),
  ('picnic', 'picnic'),
  ('picnic', 'parasol'),
  ('picnic', 'deckchair'),
  ('picnic', 'sunflowers'),
  ('picnic', 'pathgravel'),
  ('lanterns', 'torch'),
  ('lanterns', 'lantern'),
  ('lanterns', 'stringlights'),
  ('lanterns', 'stonelantern'),
  ('lanterns', 'pathstone'),
  ('orchard', 'apple'),
  ('orchard', 'orange'),
  ('orchard', 'cherry'),
  ('orchard', 'autumn'),
  ('orchard', 'hay'),
  ('watergarden', 'fountain'),
  ('watergarden', 'lilypond'),
  ('watergarden', 'bridge'),
  ('watergarden', 'frog'),
  ('watergarden', 'bamboo'),
  ('woodland', 'birch'),
  ('woodland', 'willow'),
  ('woodland', 'owl'),
  ('woodland', 'bunny'),
  ('woodland', 'deer'),
  ('spooky', 'pumpkin'),
  ('spooky', 'tombstone'),
  ('spooky', 'cauldron'),
  ('lunar', 'redlantern'),
  ('lunar', 'luckycat'),
  ('lunar', 'plumtree'),
  ('winter', 'snowman'),
  ('winter', 'gifts'),
  ('winter', 'xmastree');

-- The seasons on sale on a game day: "MM-DD" from..to, over the new year
-- when to < from (DECOR_SEASONS).
create or replace function public.arena_farm_decor_seasons(day date) returns text[]
language sql stable as $$
  select coalesce(array_agg(s.id order by s.ord), '{}'::text[]) from (values
      (1, 'halloween', '10-01', '11-07'),
      (2, 'christmas', '12-01', '01-06'),
      (3, 'lunar', '01-15', '02-29')) s(ord, id, f, t)
   where case when s.f <= s.t then to_char(day, 'MM-DD') between s.f and s.t
              else to_char(day, 'MM-DD') >= s.f or to_char(day, 'MM-DD') <= s.t end
$$;
revoke all on function public.arena_farm_decor_seasons(date) from public, anon, authenticated, service_role;

-- Charm: the decorations' and every complete collection's.
create or replace function public.arena_farm_charm(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(i.charm) from public.arena_farm_decor_pieces x
      join public.arena_farm_decor_items i on i.id = x.item where x.player_id = pid), 0)
    + coalesce((select sum(s.charm) from public.arena_farm_decor_sets s
       where not exists (select 1 from public.arena_farm_decor_set_items si
          where si.set_id = s.id and not exists (select 1 from public.arena_farm_decor_pieces p
             where p.player_id = pid and p.item = si.item))), 0))::integer
$$;
revoke all on function public.arena_farm_charm(uuid) from public, anon, authenticated, service_role;

-- As 20261116120000's, except two ground pieces may overlap.
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
       and not (coalesce(i.ground, false) and o.ground)
       and x0 < p.x + coalesce(o.w, 30) and p.x - coalesce(o.w, 30) < x1
       and y0 < p.y + 4 and p.y - coalesce(o.d, 14) < y1) then
    return 'Too close to another decoration';
  end if;
  return null;
end; $$;
revoke all on function public.arena_farm_decor_fits(uuid, text, integer, integer, bigint)
  from public, anon, authenticated, service_role;

-- The farm state: as before, with the seasons on sale today.
do $$
begin
  if to_regprocedure('public.arena_farm_state_decor(uuid)') is null then
    alter function public.arena_farm_state(uuid) rename to arena_farm_state_decor;
  end if;
end $$;
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.arena_farm_state_decor(pid) || jsonb_build_object(
    'decorSeasons', to_jsonb(public.arena_farm_decor_seasons(public.arena_today())))
$$;
revoke all on function public.arena_farm_state(uuid), public.arena_farm_state_decor(uuid)
  from public, anon, authenticated, service_role;

-- Buying a seasonal decoration out of its season; everything else as
-- 20261116120000's function (a stored one places at any time).
do $$
begin
  if to_regprocedure('public.arena_farm_act_decor(uuid, jsonb, text, timestamptz, date)') is null then
    alter function public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date) rename to arena_farm_act_decor;
  end if;
end $$;
create or replace function public.arena_farm_act_more(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare v_item public.arena_farm_decor_items;
begin
  xp = 0;
  if a->>'a' = 'decor-place' then
    select * into v_item from public.arena_farm_decor_items where id = a->>'item';
    if v_item.season is not null
       and not (v_item.season = any(public.arena_farm_decor_seasons(d)))
       and not exists (select 1 from public.arena_farm_decor_credits
          where player_id = pid and item = v_item.id and qty > 0) then
      err = 'On sale only for ' || case v_item.season when 'halloween' then 'Halloween'
        when 'christmas' then 'Christmas' when 'lunar' then 'Lunar New Year' else v_item.season end;
      return;
    end if;
  end if;
  select x.err, x.gained, x.xp into err, gained, xp
    from public.arena_farm_act_decor(pid, a, ref, t, d) x;
end; $$;
revoke all on function public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date),
  public.arena_farm_act_decor(uuid, jsonb, text, timestamptz, date)
  from public, anon, authenticated, service_role;

commit;

select
  (select count(*) from public.arena_farm_decor_items) = 61 as decor_items_seeded,
  (select count(*) from public.arena_farm_decor_sets) = 9 as decor_sets_seeded;
