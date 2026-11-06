-- Element Bistro: a restaurant next to the Farm, kept on the server.
-- Run after 066_display_name_changes.sql. Safe to run again.
--
-- The server owns time and money, like the Farm. Every change goes through
-- arena_bistro_act (a list of actions with a request id: a retried request
-- is answered, never applied twice). Numbers and rules match
-- packages/shared/src/bistro.ts, which the client runs to show an action at
-- once (tests/integration/bistro.test.ts checks the two agree).
--
--  * Cooking: a dish on a stove is ready `dur_ms` after it started; a tap in
--    the golden part (78–96% of the time) makes it perfect (+2 servings);
--    plating puts its servings on the 4-spot counter.
--  * Guests are drawn by the client; it reports each sale. A sale needs a
--    serving of that dish on the counter, and sales are rate-limited by the
--    seats (a token bucket), VIPs by a second bucket. Prices, the daily
--    special and rush hours are the server's.
--  * Staff: cooks run a stove on their own (start their dish, plate it,
--    keep up to 24 servings on the counter); waiters set how fast guests are
--    served while you are away.
--  * Time away: when the bistro was last seen 60 s or more ago, the staff
--    work the time since then, up to the shift's length (2–8 h): cooks cook,
--    half as many guests come and pay the plain price. The report is shown
--    once.
--  * The floor plan: furniture on an 11 × 9 grid, never in the kitchen,
--    doorway or pickup spots, and every seat and pickup spot reachable from
--    the door.
--  * Bistro coins are their own currency: 100 trade for 20 Gold Leaves, up
--    to 300 leaves a Pacific day.
--  * Friends: eat at a friend's bistro once a day (they earn the dish and a
--    tip), like it once a week.
begin;

-- ───────────── the catalog ─────────────

create table if not exists public.arena_bistro_dishes (
  id text primary key,
  ord integer not null,
  name text not null,
  level integer not null check (level between 1 and 30),
  seconds integer not null check (seconds > 0),
  cost integer not null check (cost > 0),
  servings integer not null check (servings > 0),
  price integer not null check (price > 0),
  xp integer not null check (xp > 0)
);
insert into public.arena_bistro_dishes(id, ord, name, level, seconds, cost, servings, price, xp) values
  ('goicuon', 1, 'Spring Rolls', 1, 15, 10, 6, 4, 3),
  ('banhmi', 2, 'Banh Mi', 1, 30, 18, 8, 5, 5),
  ('pho', 3, 'Pho', 2, 60, 40, 10, 8, 9),
  ('buncha', 4, 'Bun Cha', 3, 120, 70, 12, 11, 14),
  ('comtam', 5, 'Broken Rice', 4, 180, 100, 14, 13, 20),
  ('che', 6, 'Rainbow Sweet Cup', 5, 300, 150, 16, 17, 28),
  ('caphe', 7, 'Iced Milk Coffee', 6, 420, 160, 18, 16, 34),
  ('lau', 8, 'Elemental Hotpot', 7, 600, 300, 20, 30, 50)
on conflict (id) do update set ord = excluded.ord, name = excluded.name, level = excluded.level,
  seconds = excluded.seconds, cost = excluded.cost, servings = excluded.servings,
  price = excluded.price, xp = excluded.xp;

create table if not exists public.arena_bistro_kinds (
  kind text primary key,
  name text not null,
  price integer not null check (price > 0),
  level integer not null check (level between 1 and 30),
  charm integer not null check (charm >= 0),
  -- Rugs lie on the floor (walkable, 2 × 2); everything else blocks a tile.
  floor boolean not null default false
);
insert into public.arena_bistro_kinds(kind, name, price, level, charm, floor) values
  ('table', 'Round Table', 60, 1, 0, false),
  ('chair', 'Cushioned Chair', 25, 1, 0, false),
  ('plant', 'Potted Fern', 40, 1, 2, false),
  ('rug', 'Woven Rug', 70, 1, 2, true),
  ('lamp', 'Paper Lantern', 80, 2, 3, false),
  ('bonsai', 'Bonsai Stand', 120, 3, 4, false),
  ('luckycat', 'Waving Cat', 150, 3, 5, false),
  ('jukebox', 'Jukebox', 250, 4, 6, false),
  ('aquarium', 'Aquarium', 300, 5, 8, false),
  ('fountain', 'Element Fountain', 420, 6, 10, false)
on conflict (kind) do update set name = excluded.name, price = excluded.price,
  level = excluded.level, charm = excluded.charm, floor = excluded.floor;

-- ───────────── a player's bistro ─────────────

create table if not exists public.arena_bistros (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  coins bigint not null default 150 check (coins >= 0),
  level integer not null default 1 check (level between 1 and 30),
  xp bigint not null default 0 check (xp >= 0),
  rating double precision not null default 3 check (rating between 0 and 5),
  served bigint not null default 0,
  floor text not null default 'checker' check (floor in ('checker', 'wood', 'teal')),
  wall text not null default 'butter' check (wall in ('butter', 'mint', 'brick')),
  floors text[] not null default array['checker'],
  walls text[] not null default array['butter'],
  kitchen_lv integer not null default 0 check (kitchen_lv between 0 and 3),
  shift_lv integer not null default 0 check (shift_lv between 0 and 3),
  -- The head chef shown in the kitchen (the player's Lobby fighter).
  chef text not null default 'voltkit',
  likes integer not null default 0 check (likes >= 0),
  -- When the bistro was last open (the start of any time away).
  last_seen timestamptz,
  -- The time-away report, shown once.
  away jsonb,
  -- Sales allowance (token buckets): guests and VIPs.
  sale_budget double precision not null default 4,
  sale_at timestamptz not null default now(),
  vip_budget double precision not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists public.arena_bistro_items (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  id integer not null check (id > 0),
  kind text not null references public.arena_bistro_kinds(kind),
  x integer not null check (x between 0 and 10),
  y integer not null check (y between 0 and 8),
  rot integer not null default 0 check (rot between 0 and 3),
  primary key (player_id, id)
);
create table if not exists public.arena_bistro_stored (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  kind text not null references public.arena_bistro_kinds(kind),
  qty integer not null default 0 check (qty >= 0),
  primary key (player_id, kind)
);
create table if not exists public.arena_bistro_stoves (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  idx integer not null check (idx between 0 and 3),
  dish text references public.arena_bistro_dishes(id),
  started_at timestamptz,
  dur_ms integer,
  perfect boolean not null default false,
  primary key (player_id, idx)
);
create table if not exists public.arena_bistro_counter (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  slot integer not null check (slot between 0 and 3),
  dish text references public.arena_bistro_dishes(id),
  servings integer not null default 0 check (servings >= 0),
  perfect boolean not null default false,
  primary key (player_id, slot)
);
create table if not exists public.arena_bistro_staff (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  id integer not null check (id > 0),
  creature text not null,
  role text not null check (role in ('cook', 'waiter')),
  level integer not null default 1 check (level between 1 and 5),
  dish text not null default 'goicuon' references public.arena_bistro_dishes(id),
  primary key (player_id, id),
  unique (player_id, creature)
);
create table if not exists public.arena_bistro_requests (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  request uuid not null,
  created_at timestamptz not null default now(),
  primary key (player_id, request)
);
create index if not exists arena_bistro_requests_age on public.arena_bistro_requests(created_at);
-- Meals eaten at friends' bistros (one a friend a Pacific day).
create table if not exists public.arena_bistro_dines (
  diner uuid not null references public.arena_profiles(id) on delete cascade,
  owner uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  dish text not null references public.arena_bistro_dishes(id),
  created_at timestamptz not null default now(),
  primary key (diner, owner, day)
);
create index if not exists arena_bistro_dines_owner on public.arena_bistro_dines(owner, day);
-- Likes (one a friend a week, the week starting Monday, Pacific).
create table if not exists public.arena_bistro_likes (
  liker uuid not null references public.arena_profiles(id) on delete cascade,
  owner uuid not null references public.arena_profiles(id) on delete cascade,
  week date not null,
  primary key (liker, owner, week)
);
alter table public.arena_bistro_dishes enable row level security;
alter table public.arena_bistro_kinds enable row level security;
alter table public.arena_bistros enable row level security;
alter table public.arena_bistro_items enable row level security;
alter table public.arena_bistro_stored enable row level security;
alter table public.arena_bistro_stoves enable row level security;
alter table public.arena_bistro_counter enable row level security;
alter table public.arena_bistro_staff enable row level security;
alter table public.arena_bistro_requests enable row level security;
alter table public.arena_bistro_dines enable row level security;
alter table public.arena_bistro_likes enable row level security;
revoke all on public.arena_bistro_dishes, public.arena_bistro_kinds, public.arena_bistros,
  public.arena_bistro_items, public.arena_bistro_stored, public.arena_bistro_stoves,
  public.arena_bistro_counter, public.arena_bistro_staff, public.arena_bistro_requests,
  public.arena_bistro_dines, public.arena_bistro_likes
  from public, anon, authenticated, service_role;

-- ───────────── curves and small rules ─────────────

create or replace function public.arena_bistro_need(p_level integer) returns integer
language sql immutable set search_path = '' as $$
  select round((40 * power(p_level, 1.45))::numeric)::integer
$$;
create or replace function public.arena_bistro_speed(p_level integer) returns double precision
language sql immutable set search_path = '' as $$
  select 1 + 0.12 * (p_level - 1)
$$;
-- How long a dish takes (ms) with this kitchen and this cook's level.
create or replace function public.arena_bistro_cook_ms(p_seconds integer, p_kitchen integer, p_cook integer)
returns integer language sql immutable set search_path = public as $$
  select round((p_seconds * 1000 * (1 - 0.1 * p_kitchen) / public.arena_bistro_speed(p_cook))::numeric)::integer
$$;
-- Rush hours by the clock: 35 s of every 240.
create or replace function public.arena_bistro_rush(t timestamptz) returns boolean
language sql immutable set search_path = '' as $$
  select (floor(extract(epoch from t))::bigint % 240) < 35
$$;
-- Today's special: one of the dishes the bistro can cook (at least level 2's).
create or replace function public.arena_bistro_special(p_level integer, p_day date) returns text
language sql stable set search_path = public as $$
  select id from public.arena_bistro_dishes where level <= greatest(p_level, 2) order by ord
  offset floor(public.arena_farm_hash('bistro-special:' || p_day::text)
    * (select count(*) from public.arena_bistro_dishes where level <= greatest(p_level, 2)))::integer
  limit 1
$$;
-- A guest's bill (whole percents for the tip, as packages/shared/src/bistro.ts).
create or replace function public.arena_bistro_pay(p_price integer, p_special boolean, p_vip boolean,
  p_combo integer, p_hearts integer, p_quick boolean, p_rush boolean) returns integer
language plpgsql immutable set search_path = '' as $$
declare base integer; pct integer;
begin
  base = round(p_price * (case when p_special then 1.5 else 1 end) * (case when p_vip then 2.5 else 1 end));
  pct = (least(5, greatest(1, coalesce(p_combo, 1))) - 1) * 8
    + (least(3, greatest(1, coalesce(p_hearts, 3))) - 1) * 5
    + case when p_quick then 10 else 0 end;
  if p_rush then pct = pct * 2; end if;
  return base + round(base * pct / 100.0)::integer;
end; $$;
revoke all on function public.arena_bistro_need(integer), public.arena_bistro_speed(integer),
  public.arena_bistro_cook_ms(integer, integer, integer), public.arena_bistro_rush(timestamptz),
  public.arena_bistro_special(integer, date),
  public.arena_bistro_pay(integer, boolean, boolean, integer, integer, boolean, boolean)
  from public, anon, authenticated, service_role;

-- ───────────── the floor plan ─────────────

-- Tiles that block walking (index y * 11 + x + 1): the kitchen and furniture.
create or replace function public.arena_bistro_blocked(pid uuid) returns boolean[]
language plpgsql stable security definer set search_path = public as $$
declare b boolean[] = array_fill(false, array[99]); it record; x integer; y integer;
begin
  for x in 0..5 loop for y in 0..2 loop b[y * 11 + x + 1] = true; end loop; end loop;
  for it in select i.x, i.y from public.arena_bistro_items i
      join public.arena_bistro_kinds k on k.kind = i.kind
      where i.player_id = pid and not k.floor loop
    b[it.y * 11 + it.x + 1] = true;
  end loop;
  return b;
end; $$;
-- Breadth-first: can you walk from (fx, fy) to (tx, ty)? The target itself may be blocked (a chair).
create or replace function public.arena_bistro_reach(b boolean[], fx integer, fy integer, tx integer, ty integer)
returns boolean language plpgsql immutable set search_path = '' as $$
declare seen boolean[] = array_fill(false, array[99]); q integer[]; head integer = 1;
  k integer; x integer; y integer; nx integer; ny integer; nk integer; d integer; goal integer = ty * 11 + tx;
begin
  if fx < 0 or fy < 0 or fx > 10 or fy > 8 or tx < 0 or ty < 0 or tx > 10 or ty > 8 then return false; end if;
  q = array[fy * 11 + fx];
  seen[fy * 11 + fx + 1] = true;
  while head <= array_length(q, 1) loop
    k = q[head]; head = head + 1;
    if k = goal then return true; end if;
    x = k % 11; y = k / 11;
    for d in 1..4 loop
      nx = x + (array[1, 0, -1, 0])[d];
      ny = y + (array[0, 1, 0, -1])[d];
      if nx < 0 or ny < 0 or nx > 10 or ny > 8 then continue; end if;
      nk = ny * 11 + nx;
      if seen[nk + 1] then continue; end if;
      if b[nk + 1] and nk <> goal then continue; end if;
      seen[nk + 1] = true;
      q = q || nk;
    end loop;
  end loop;
  return false;
end; $$;
-- Chairs that touch a table seat one guest each (the chair's facing breaks ties).
create or replace function public.arena_bistro_seats(pid uuid)
returns table(chair integer, cx integer, cy integer, tbl integer, dir integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.x, c.y, t.id, t.dir
  from public.arena_bistro_items c
  cross join lateral (
    select tt.id, case when tt.x > c.x then 0 when tt.y > c.y then 1 when tt.x < c.x then 2 else 3 end dir
    from public.arena_bistro_items tt
    where tt.player_id = pid and tt.kind = 'table' and abs(tt.x - c.x) + abs(tt.y - c.y) = 1
    order by (case when tt.x > c.x then 0 when tt.y > c.y then 1 when tt.x < c.x then 2 else 3 end) = c.rot desc, tt.id
    limit 1) t
  where c.player_id = pid and c.kind = 'chair'
$$;
-- Whether the plan works: the door reaches every pickup spot and every seat.
create or replace function public.arena_bistro_plan_error(pid uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare b boolean[] = public.arena_bistro_blocked(pid); i integer; s record;
begin
  for i in 0..3 loop
    if not public.arena_bistro_reach(b, 0, 7, 1 + i, 3) then return 'That would block the way to the counter.'; end if;
  end loop;
  for s in select * from public.arena_bistro_seats(pid) loop
    if not public.arena_bistro_reach(b, 0, 7, s.cx, s.cy) then return 'That would block a seat.'; end if;
  end loop;
  return null;
end; $$;
-- Whether an item can stand on (x, y); p_ignore is the item being moved.
create or replace function public.arena_bistro_place_error(pid uuid, p_kind text, px integer, py integer, p_ignore integer)
returns text language plpgsql stable security definer set search_path = public as $$
declare k public.arena_bistro_kinds; n integer; dx integer; dy integer; tx integer; ty integer;
begin
  select * into k from public.arena_bistro_kinds where kind = p_kind;
  if k.kind is null then return 'Unknown item.'; end if;
  n = case when k.floor then 1 else 0 end;
  for dx in 0..n loop for dy in 0..n loop
    tx = px + dx; ty = py + dy;
    if tx < 0 or ty < 0 or tx > 10 or ty > 8 then return 'That''s outside the restaurant.'; end if;
    if tx <= 5 and ty <= 2 then return 'The kitchen stays clear.'; end if;
    if not k.floor and ((tx = 0 and ty = 7) or (tx = 1 and ty = 7) or (ty = 3 and tx between 1 and 4)
        or (tx = 6 and ty = 3)) then
      return 'Keep the doorway and the counter clear.';
    end if;
    if exists (select 1 from public.arena_bistro_items i join public.arena_bistro_kinds ik on ik.kind = i.kind
        where i.player_id = pid and i.id <> coalesce(p_ignore, -1) and ik.floor = k.floor
          and tx between i.x and i.x + case when ik.floor then 1 else 0 end
          and ty between i.y and i.y + case when ik.floor then 1 else 0 end) then
      return 'Something''s already there.';
    end if;
  end loop; end loop;
  return null;
end; $$;
revoke all on function public.arena_bistro_blocked(uuid),
  public.arena_bistro_reach(boolean[], integer, integer, integer, integer),
  public.arena_bistro_seats(uuid), public.arena_bistro_plan_error(uuid),
  public.arena_bistro_place_error(uuid, text, integer, integer, integer)
  from public, anon, authenticated, service_role;

-- ───────────── a new bistro, XP ─────────────

create or replace function public.arena_bistro_ensure(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  insert into public.arena_bistros(player_id, chef)
  values (pid, coalesce((select portrait_character from public.arena_profiles where id = pid), 'voltkit'))
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;
  -- The starting room: three tables with two chairs each, a rug and ferns
  -- (defaultState in packages/shared/src/bistro.ts).
  insert into public.arena_bistro_items(player_id, id, kind, x, y, rot) values
    (pid, 1, 'rug', 3, 5, 0), (pid, 2, 'table', 4, 5, 0), (pid, 3, 'chair', 3, 5, 1),
    (pid, 4, 'chair', 5, 5, 3), (pid, 5, 'table', 8, 4, 0), (pid, 6, 'chair', 8, 3, 2),
    (pid, 7, 'chair', 8, 5, 0), (pid, 8, 'table', 8, 7, 0), (pid, 9, 'chair', 7, 7, 1),
    (pid, 10, 'chair', 9, 7, 3), (pid, 11, 'plant', 10, 0, 0), (pid, 12, 'plant', 0, 8, 0),
    (pid, 13, 'plant', 6, 0, 0)
  on conflict do nothing;
  insert into public.arena_bistro_stoves(player_id, idx) values (pid, 0), (pid, 1) on conflict do nothing;
  insert into public.arena_bistro_counter(player_id, slot, dish, servings) values
    (pid, 0, 'goicuon', 6), (pid, 1, null, 0), (pid, 2, null, 0), (pid, 3, null, 0)
  on conflict do nothing;
  insert into public.arena_bistro_staff(player_id, id, creature, role) values (pid, 1, 'sunbara', 'waiter')
  on conflict do nothing;
end; $$;
-- XP with level-ups; each level gives 40 + 20 × level coins. Returns the levels gained.
create or replace function public.arena_bistro_add_xp(pid uuid, amount integer) returns integer
language plpgsql security definer set search_path = public as $$
declare b public.arena_bistros; gained integer = 0;
begin
  if amount <= 0 then return 0; end if;
  select * into b from public.arena_bistros where player_id = pid;
  b.xp = b.xp + amount;
  while b.level < 30 and b.xp >= public.arena_bistro_need(b.level) loop
    b.xp = b.xp - public.arena_bistro_need(b.level);
    b.level = b.level + 1;
    b.coins = b.coins + 40 + 20 * b.level;
    gained = gained + 1;
  end loop;
  if b.level >= 30 then b.xp = least(b.xp, public.arena_bistro_need(30)); end if;
  update public.arena_bistros set level = b.level, xp = b.xp, coins = b.coins where player_id = pid;
  return gained;
end; $$;
revoke all on function public.arena_bistro_ensure(uuid), public.arena_bistro_add_xp(uuid, integer)
  from public, anon, authenticated, service_role;

-- ───────────── stoves and the counter ─────────────

create or replace function public.arena_bistro_servings(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(servings), 0)::integer from public.arena_bistro_counter where player_id = pid and dish is not null
$$;
-- Start a dish on a stove at time t (cook level 1 for the head chef). Returns an error or null.
create or replace function public.arena_bistro_start(pid uuid, p_idx integer, p_dish text, t timestamptz, p_cook integer)
returns text language plpgsql security definer set search_path = public as $$
declare st public.arena_bistro_stoves; d public.arena_bistro_dishes; b public.arena_bistros;
begin
  select * into st from public.arena_bistro_stoves where player_id = pid and idx = p_idx;
  if st.idx is null then return 'No stove there.'; end if;
  if st.dish is not null then return 'That stove is busy.'; end if;
  select * into d from public.arena_bistro_dishes where id = p_dish;
  if d.id is null then return 'Unknown dish.'; end if;
  select * into b from public.arena_bistros where player_id = pid;
  if d.level > b.level then return d.name || ' opens at level ' || d.level || '.'; end if;
  if b.coins < d.cost then return 'You need ' || d.cost || ' coins for ' || d.name || '.'; end if;
  update public.arena_bistros set coins = coins - d.cost where player_id = pid;
  update public.arena_bistro_stoves set dish = d.id, started_at = t, perfect = false,
    dur_ms = public.arena_bistro_cook_ms(d.seconds, b.kitchen_lv, p_cook)
   where player_id = pid and idx = p_idx;
  return null;
end; $$;
-- Plate a finished dish onto the counter: {ok, slot, servings, xp, levels} or {error}.
create or replace function public.arena_bistro_plate(pid uuid, p_idx integer, t timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st public.arena_bistro_stoves; d public.arena_bistro_dishes; v_slot integer; n integer; lv integer;
begin
  select * into st from public.arena_bistro_stoves where player_id = pid and idx = p_idx;
  if st.dish is null then return jsonb_build_object('error', 'Nothing cooking there.'); end if;
  if t < st.started_at + make_interval(secs => st.dur_ms / 1000.0) then
    return jsonb_build_object('error', 'Not ready yet.');
  end if;
  select * into d from public.arena_bistro_dishes where id = st.dish;
  n = d.servings + case when st.perfect then 2 else 0 end;
  select slot into v_slot from public.arena_bistro_counter where player_id = pid and dish = st.dish order by slot limit 1;
  if v_slot is null then
    select slot into v_slot from public.arena_bistro_counter where player_id = pid and dish is null order by slot limit 1;
  end if;
  if v_slot is null then return jsonb_build_object('error', 'The counter is full: serve some dishes first.'); end if;
  update public.arena_bistro_counter set dish = st.dish, servings = servings + n, perfect = perfect or st.perfect
   where player_id = pid and slot = v_slot;
  update public.arena_bistro_stoves set dish = null, started_at = null, dur_ms = null, perfect = false
   where player_id = pid and idx = p_idx;
  lv = public.arena_bistro_add_xp(pid, d.xp);
  return jsonb_build_object('ok', true, 'slot', v_slot, 'servings', n, 'xp', d.xp, 'levels', lv);
end; $$;
-- Take one serving of a dish off the counter; the slot, or null.
create or replace function public.arena_bistro_take(pid uuid, p_dish text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_slot integer;
begin
  select slot into v_slot from public.arena_bistro_counter
   where player_id = pid and dish = p_dish and servings > 0 order by slot limit 1;
  if v_slot is null then return null; end if;
  update public.arena_bistro_counter set servings = servings - 1 where player_id = pid and slot = v_slot;
  update public.arena_bistro_counter set dish = null, servings = 0, perfect = false
   where player_id = pid and slot = v_slot and servings <= 0;
  return v_slot;
end; $$;
-- The cooks' turn at time t: plate what is done, start their dish on an
-- empty stove (cooks take the stoves from the last one back). Returns
-- {plated, started, spent, levels}.
create or replace function public.arena_bistro_kitchen(pid uuid, t timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; i integer = 0; n_stoves integer; v_idx integer; st public.arena_bistro_stoves;
  r jsonb; pick text; b public.arena_bistros; plated integer = 0; started integer = 0; spent integer = 0; lv integer = 0;
begin
  select count(*) into n_stoves from public.arena_bistro_stoves where player_id = pid;
  for c in select * from public.arena_bistro_staff where player_id = pid and role = 'cook' order by id loop
    v_idx = n_stoves - 1 - i;
    i = i + 1;
    if v_idx < 0 then continue; end if;
    select * into st from public.arena_bistro_stoves where player_id = pid and idx = v_idx;
    if st.dish is not null and t >= st.started_at + make_interval(secs => st.dur_ms / 1000.0) then
      r = public.arena_bistro_plate(pid, v_idx, t);
      if r ? 'ok' then plated = plated + 1; lv = lv + (r->>'levels')::integer; end if;
    end if;
    select * into st from public.arena_bistro_stoves where player_id = pid and idx = v_idx;
    if st.dish is null and public.arena_bistro_servings(pid) < 24 then
      select * into b from public.arena_bistros where player_id = pid;
      -- Their dish, or the best one the bistro can still pay for.
      select d.id into pick from public.arena_bistro_dishes d
       where d.level <= b.level and d.cost <= b.coins
       order by (d.id = c.dish) desc, d.ord desc limit 1;
      if pick is not null and public.arena_bistro_start(pid, v_idx, pick, t, c.level) is null then
        started = started + 1;
        spent = spent + (select cost from public.arena_bistro_dishes where id = pick);
      end if;
    end if;
  end loop;
  return jsonb_build_object('plated', plated, 'started', started, 'spent', spent, 'levels', lv);
end; $$;
revoke all on function public.arena_bistro_servings(uuid),
  public.arena_bistro_start(uuid, integer, text, timestamptz, integer),
  public.arena_bistro_plate(uuid, integer, timestamptz), public.arena_bistro_take(uuid, text),
  public.arena_bistro_kitchen(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- ───────────── time away ─────────────

-- Guests a second the staff can serve: arrivals, seats and waiters, whichever is fewer.
create or replace function public.arena_bistro_service_rate(pid uuid) returns double precision
language sql stable security definer set search_path = public as $$
  select least(
    1 / greatest(2.2, 9 - b.rating * 0.9 - least(30, coalesce((select sum(k.charm) from public.arena_bistro_items i
      join public.arena_bistro_kinds k on k.kind = i.kind where i.player_id = pid), 0)) * 0.08),
    (select count(*) from public.arena_bistro_seats(pid)) / 28.0,
    coalesce((select sum(public.arena_bistro_speed(s.level)) from public.arena_bistro_staff s
      where s.player_id = pid and s.role = 'waiter'), 0) / 10)
  from public.arena_bistros b where b.player_id = pid
$$;
-- Bring the bistro up to time t. Cooks always catch up (15 s steps); after
-- 60 s or more away, guests come too, for up to the shift's length, and a
-- report is kept to show once.
create or replace function public.arena_bistro_catch_up(pid uuid, t timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare b public.arena_bistros; v_from timestamptz; v_end timestamptz; tt timestamptz; ev jsonb;
  rate double precision; acc double precision = 0; v_slot integer; v_dish text; v_price integer;
  v_special text; bill integer; v_served integer = 0; v_coins integer = 0; v_spent integer = 0; v_batches integer = 0;
  lv integer = 0; away boolean; cap interval;
begin
  select * into b from public.arena_bistros where player_id = pid;
  v_from = b.last_seen;
  update public.arena_bistros set last_seen = t where player_id = pid;
  if v_from is null or t <= v_from then return; end if;
  away = t - v_from >= interval '60 seconds';
  cap = make_interval(hours => (array[2, 4, 6, 8])[b.shift_lv + 1]);
  v_end = case when away then least(t, v_from + cap) else t end;
  rate = case when away then public.arena_bistro_service_rate(pid) * 0.5 else 0 end;
  v_special = public.arena_bistro_special(b.level, public.arena_today());
  tt = v_from;
  while tt < v_end loop
    ev = public.arena_bistro_kitchen(pid, tt);
    v_batches = v_batches + (ev->>'plated')::integer;
    v_spent = v_spent + (ev->>'spent')::integer;
    lv = lv + (ev->>'levels')::integer;
    if away then
      acc = acc + rate * (least(15000, extract(epoch from v_end - tt) * 1000) / 1000);
      while acc >= 1 loop
        select slot, dish into v_slot, v_dish from public.arena_bistro_counter
         where player_id = pid and dish is not null and servings > 0 order by servings desc, slot limit 1;
        if v_slot is null then acc = least(acc, 1); exit; end if;
        perform public.arena_bistro_take(pid, v_dish);
        select price into v_price from public.arena_bistro_dishes where id = v_dish;
        bill = public.arena_bistro_pay(v_price, v_dish = v_special, false, 1, 2, false, false);
        update public.arena_bistros set coins = coins + bill, served = served + 1 where player_id = pid;
        v_coins = v_coins + bill;
        v_served = v_served + 1;
        lv = lv + public.arena_bistro_add_xp(pid, 1);
        acc = acc - 1;
      end loop;
    end if;
    tt = tt + interval '15 seconds';
  end loop;
  if away then
    update public.arena_bistros set away = jsonb_build_object(
      'worked', round(extract(epoch from v_end - v_from) * 1000),
      'away', round(extract(epoch from t - v_from) * 1000),
      'capped', t - v_from > cap,
      'served', v_served, 'coins', v_coins, 'spent', v_spent, 'batches', v_batches, 'levels', lv)
     where player_id = pid;
  end if;
end; $$;
revoke all on function public.arena_bistro_service_rate(uuid), public.arena_bistro_catch_up(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- ───────────── what the player sees ─────────────

create or replace function public.arena_bistro_state(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.arena_bistros; t timestamptz = now(); d date = public.arena_today();
begin
  select * into b from public.arena_bistros where player_id = pid;
  return jsonb_build_object(
    'v', 1,
    'now', (extract(epoch from t) * 1000)::bigint,
    'coins', b.coins, 'xp', b.xp, 'level', b.level,
    'rating', round(b.rating::numeric, 3), 'served', b.served,
    'floor', b.floor, 'wall', b.wall, 'floors', to_jsonb(b.floors), 'walls', to_jsonb(b.walls),
    'kitchenLv', b.kitchen_lv, 'shiftLv', b.shift_lv, 'chef', b.chef, 'likes', b.likes,
    'lastSeen', coalesce((extract(epoch from b.last_seen) * 1000)::bigint, 0),
    'special', public.arena_bistro_special(b.level, d),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'x', x, 'y', y, 'rot', rot) order by id)
      from public.arena_bistro_items where player_id = pid), '[]'::jsonb),
    'nextId', coalesce((select max(id) from public.arena_bistro_items where player_id = pid), 0) + 1,
    'stored', coalesce((select jsonb_object_agg(kind, qty) from public.arena_bistro_stored
      where player_id = pid and qty > 0), '{}'::jsonb),
    'stoves', (select jsonb_agg(case when dish is null then jsonb_build_object('dish', null, 'start', 0, 'perfect', false)
        else jsonb_build_object('dish', dish, 'start', (extract(epoch from started_at) * 1000)::bigint,
          'perfect', perfect, 'dur', dur_ms) end order by idx)
      from public.arena_bistro_stoves where player_id = pid),
    'counter', (select jsonb_agg(case when dish is null then 'null'::jsonb
        else jsonb_build_object('dish', dish, 'servings', servings, 'perfect', perfect) end order by slot)
      from public.arena_bistro_counter where player_id = pid),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'char', creature, 'role', role,
        'level', level, 'dish', dish) order by id)
      from public.arena_bistro_staff where player_id = pid), '[]'::jsonb),
    'leaves', coalesce((select balance from public.arena_leaf_wallets where player_id = pid), 0),
    'tradedToday', coalesce((select sum(amount) from public.arena_leaf_ledger
      where player_id = pid and day = d and reason = 'bistro-trade'), 0),
    -- Friends who ate here today, newest first.
    'friendGuests', coalesce((select jsonb_agg(jsonb_build_object('name', p.display_name,
        'fighter', p.portrait_character, 'dish', x.dish) order by x.created_at desc)
      from public.arena_bistro_dines x join public.arena_profiles p on p.id = x.diner
      where x.owner = pid and x.day = d), '[]'::jsonb),
    'dinesToday', (select count(*) from public.arena_bistro_dines where diner = pid and day = d));
end; $$;
revoke all on function public.arena_bistro_state(uuid) from public, anon, authenticated, service_role;

-- Open the bistro: bring it up to now; the time-away report comes once.
create or replace function public.arena_bistro() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); v_away jsonb;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_bistro_ensure(me);
  perform 1 from public.arena_bistros where player_id = me for update;
  perform public.arena_bistro_catch_up(me, now());
  select away into v_away from public.arena_bistros where player_id = me;
  update public.arena_bistros set away = null where player_id = me and away is not null;
  return public.arena_bistro_state(me) || jsonb_build_object('away', v_away);
end; $$;
revoke all on function public.arena_bistro() from public, anon;
grant execute on function public.arena_bistro() to authenticated;

-- ───────────── actions ─────────────
-- cook {stove, dish} · stir {stove} · plate {stove} ·
-- serve {dish, vip, combo, hearts, quick} · leave · place {kind, x, y, rot, id?} ·
-- store {id} · buy {kind} · style {kind: floor|wall, id} · stove · kitchen · shift ·
-- hire {role, char} · train {id} · cookdish {id, dish} · chef {id} · trade {lots} · sync
create or replace function public.arena_bistro_act(p_request uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); t timestamptz = now(); d date = public.arena_today();
  b public.arena_bistros; a jsonb; i integer = 0; v_kind text; err text; gained jsonb; inserted integer;
  st public.arena_bistro_stoves; v_dish public.arena_bistro_dishes; k public.arena_bistro_kinds;
  v_idx integer; n integer; v_price integer; v_cost integer; r jsonb; v_x integer; v_y integer; v_rot integer;
  v_id integer; v_seats integer; v_vip boolean; v_hearts integer; v_bill integer; v_slot integer;
  v_staff public.arena_bistro_staff; v_count integer; v_lv integer; v_away jsonb; v_traded integer;
  results jsonb = '[]'::jsonb;
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
          v_bill = public.arena_bistro_pay(v_dish.price,
            v_dish.id = public.arena_bistro_special(b.level, d), v_vip,
            coalesce((a->>'combo')::integer, 1), v_hearts, coalesce((a->>'quick')::boolean, false),
            public.arena_bistro_rush(t));
          update public.arena_bistros set coins = coins + v_bill, served = served + 1,
            sale_budget = sale_budget - 1,
            vip_budget = least(3, vip_budget + 0.15) - case when v_vip then 1 else 0 end,
            rating = least(5, greatest(0, rating + ((case v_hearts when 3 then 5 when 2 then 4 else 2.5 end) - rating) * 0.08))
           where player_id = me;
          v_lv = public.arena_bistro_add_xp(me, case when v_vip then 3 else 1 end);
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
      elsif k.level > b.level then err = 'Opens at level ' || k.level || '.';
      elsif b.coins < k.price then err = 'You need ' || k.price || ' coins.';
      else
        update public.arena_bistros set coins = coins - k.price where player_id = me;
        insert into public.arena_bistro_stored(player_id, kind, qty) values (me, k.kind, 1)
        on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + 1;
      end if;
    elsif v_kind = 'style' then
      v_price = case a->>'kind'
        when 'floor' then case a->>'id' when 'checker' then 0 when 'wood' then 150 when 'teal' then 220 end
        when 'wall' then case a->>'id' when 'butter' then 0 when 'mint' then 150 when 'brick' then 220 end end;
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
      select count(*) into n from public.arena_bistro_stoves where player_id = me;
      v_price = (array[0, 0, 200, 450])[n + 1];
      if n >= 4 then err = 'Every stove slot is in use.';
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price where player_id = me;
        insert into public.arena_bistro_stoves(player_id, idx) values (me, n);
      end if;
    elsif v_kind in ('kitchen', 'shift') then
      v_lv = case when v_kind = 'kitchen' then b.kitchen_lv else b.shift_lv end;
      v_price = case when v_kind = 'kitchen' then (array[300, 700, 1400])[v_lv + 1] else (array[300, 800, 1600])[v_lv + 1] end;
      if v_price is null then err = case when v_kind = 'kitchen' then 'The kitchen is fully upgraded.' else 'Shifts are as long as they go.' end;
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      elsif v_kind = 'kitchen' then
        update public.arena_bistros set coins = coins - v_price, kitchen_lv = kitchen_lv + 1 where player_id = me;
      else
        update public.arena_bistros set coins = coins - v_price, shift_lv = shift_lv + 1 where player_id = me;
      end if;
    elsif v_kind = 'hire' then
      select count(*) into v_count from public.arena_bistro_staff where player_id = me and role = a->>'role';
      v_lv = case a->>'role' when 'cook' then (array[2, 5])[v_count + 1] when 'waiter' then (array[1, 3, 6])[v_count + 1] end;
      v_price = case a->>'role' when 'cook' then (array[250, 900])[v_count + 1] when 'waiter' then (array[0, 400, 1000])[v_count + 1] end;
      if a->>'role' not in ('cook', 'waiter') then err = 'Unknown role.';
      elsif v_lv is null then err = 'You have every ' || (a->>'role') || ' you can hire.';
      elsif b.level < v_lv then err = 'Hire at level ' || v_lv || '.';
      elsif not (a->>'char' = any(public.arena_champion_ids())) then err = 'Unknown creature.';
      elsif exists (select 1 from public.arena_bistro_staff where player_id = me and creature = a->>'char') then
        err = 'Already on your team.';
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price where player_id = me;
        insert into public.arena_bistro_staff(player_id, id, creature, role, dish)
        values (me, coalesce((select max(id) from public.arena_bistro_staff where player_id = me), 0) + 1,
          a->>'char', a->>'role',
          case when a->>'role' = 'cook' then (select id from public.arena_bistro_dishes where level <= b.level order by ord desc limit 1)
            else 'goicuon' end);
      end if;
    elsif v_kind = 'train' then
      select * into v_staff from public.arena_bistro_staff where player_id = me
        and id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer end;
      if v_staff.id is null then err = 'Not on your team.';
      elsif v_staff.level >= 5 then err = 'Already at the top level.';
      elsif b.coins < 150 * v_staff.level * v_staff.level then err = 'You need ' || 150 * v_staff.level * v_staff.level || ' coins.';
      else
        update public.arena_bistros set coins = coins - 150 * v_staff.level * v_staff.level where player_id = me;
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

-- ───────────── friends ─────────────

-- A friend's bistro as a visitor sees it (no wallet, no report).
create or replace function public.arena_bistro_view(me uuid, pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select (public.arena_bistro_state(pid) - 'coins' - 'leaves' - 'tradedToday' - 'stored' - 'dinesToday' - 'lastSeen')
    || jsonb_build_object(
      'id', pid,
      'name', pr.display_name,
      'fighter', pr.portrait_character,
      'dined', exists (select 1 from public.arena_bistro_dines x where x.diner = me and x.owner = pid
        and x.day = public.arena_today()),
      'liked', exists (select 1 from public.arena_bistro_likes l where l.liker = me and l.owner = pid
        and l.week = date_trunc('week', public.arena_today())::date),
      'myDines', (select count(*) from public.arena_bistro_dines x where x.diner = me and x.day = public.arena_today()))
  from public.arena_profiles pr where pr.id = pid
$$;
revoke all on function public.arena_bistro_view(uuid, uuid) from public, anon, authenticated, service_role;

-- Your friends who have a bistro.
create or replace function public.arena_bistro_friends() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  return coalesce((select jsonb_agg(x order by lower(x->>'name')) from (
    select jsonb_build_object('id', pr.id, 'name', pr.display_name, 'fighter', pr.portrait_character,
      'level', b.level, 'rating', round(b.rating::numeric, 2), 'likes', b.likes, 'served', b.served,
      'servings', public.arena_bistro_servings(pr.id),
      'dined', exists (select 1 from public.arena_bistro_dines x where x.diner = me and x.owner = pr.id and x.day = d),
      'liked', exists (select 1 from public.arena_bistro_likes l where l.liker = me and l.owner = pr.id
        and l.week = date_trunc('week', d)::date)) x
    from public.arena_friendships fs
    join public.arena_profiles pr on pr.id = case when fs.a = me then fs.b else fs.a end
    join public.arena_bistros b on b.player_id = pr.id
    where (fs.a = me or fs.b = me) and not pr.suspended
    limit 100) y), '[]'::jsonb);
end; $$;
revoke all on function public.arena_bistro_friends() from public, anon;
grant execute on function public.arena_bistro_friends() to authenticated;

create or replace function public.arena_bistro_friend(p_friend uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_friend is null or not public.arena_farm_are_friends(me, p_friend) then
    raise exception 'Only friends can visit';
  end if;
  if not exists (select 1 from public.arena_bistros where player_id = p_friend) then
    raise exception 'This friend has no bistro yet';
  end if;
  return public.arena_bistro_view(me, p_friend);
end; $$;
revoke all on function public.arena_bistro_friend(uuid) from public, anon;
grant execute on function public.arena_bistro_friend(uuid) to authenticated;

-- Eat at a friend's bistro (once a friend a Pacific day, up to 10 a day):
-- you take a serving from their counter; they earn its price and a 50% tip
-- and 2 XP; you get 5 XP and 10 coins. Or like it (once a friend a week; 2 XP).
create or replace function public.arena_bistro_friend_act(p_request uuid, p_friend uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); inserted integer; v_slot integer; v_dish text;
  v_price integer; v_pay integer; gained jsonb = '{}'::jsonb; err text;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_friend is null or not public.arena_farm_are_friends(me, p_friend) then
    raise exception 'Only friends can visit';
  end if;
  if not exists (select 1 from public.arena_bistros where player_id = p_friend) then
    raise exception 'This friend has no bistro yet';
  end if;
  if p_request is null or p_kind not in ('dine', 'like') then raise exception 'Invalid bistro request'; end if;
  perform public.arena_bistro_ensure(me);
  -- Your bistro first, then theirs (the same order everywhere: no deadlock).
  perform 1 from public.arena_bistros where player_id in (me, p_friend) order by player_id for update;
  insert into public.arena_bistro_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('bistro', public.arena_bistro_view(me, p_friend), 'ok', true, 'repeated', true);
  end if;
  if p_kind = 'dine' then
    if exists (select 1 from public.arena_bistro_dines where diner = me and owner = p_friend and day = d) then
      err = 'You already ate here today.';
    elsif (select count(*) from public.arena_bistro_dines where diner = me and day = d) >= 10 then
      err = 'You ate at 10 bistros today: come back tomorrow.';
    else
      select slot, dish into v_slot, v_dish from public.arena_bistro_counter
       where player_id = p_friend and dish is not null and servings > 0 order by servings desc, slot limit 1;
      if v_slot is null then err = 'Nothing on their counter right now.';
      else
        perform public.arena_bistro_take(p_friend, v_dish);
        select price into v_price from public.arena_bistro_dishes where id = v_dish;
        v_pay = v_price + round(v_price * 0.5)::integer;
        update public.arena_bistros set coins = coins + v_pay, served = served + 1 where player_id = p_friend;
        perform public.arena_bistro_add_xp(p_friend, 2);
        update public.arena_bistros set coins = coins + 10 where player_id = me;
        perform public.arena_bistro_add_xp(me, 5);
        insert into public.arena_bistro_dines(diner, owner, day, dish) values (me, p_friend, d, v_dish);
        gained = jsonb_build_object('dish', v_dish, 'paid', v_pay, 'coins', 10, 'xp', 5);
      end if;
    end if;
  else
    insert into public.arena_bistro_likes(liker, owner, week) values (me, p_friend, date_trunc('week', d)::date)
    on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted = 0 then err = 'You liked this bistro this week.';
    else
      update public.arena_bistros set likes = likes + 1 where player_id = p_friend;
      perform public.arena_bistro_add_xp(me, 2);
      gained = jsonb_build_object('xp', 2);
    end if;
  end if;
  return jsonb_build_object('bistro', public.arena_bistro_view(me, p_friend),
    'ok', err is null, 'error', err) || gained;
end; $$;
revoke all on function public.arena_bistro_friend_act(uuid, uuid, text) from public, anon;
grant execute on function public.arena_bistro_friend_act(uuid, uuid, text) to authenticated;
commit;

select
  (select count(*) from public.arena_bistro_dishes) = 8 as bistro_dishes_seeded,
  to_regprocedure('public.arena_bistro_act(uuid,jsonb)') is not null as bistro_actions_enabled,
  to_regprocedure('public.arena_bistro_friend_act(uuid,uuid,text)') is not null as bistro_friends_enabled;
