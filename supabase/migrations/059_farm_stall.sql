-- Farm social, part 3: the Farm Stall and the Valley Paper.
-- Run after 058_farm_balloon.sql. Safe to run again.
--  * Six shelves. Put up to 10 of one crop (and mutation) from your barn on
--    a shelf at a price between 0.5× and 1.5× what the Market pays you today.
--  * Friends see your shelves in the Valley Paper and buy a whole shelf; the
--    crops go to their barn. You collect the price less a 10% stall fee;
--    stall sales pay at most 3,000 leaves a Pacific day (the rest waits).
--  * Take an unsold shelf down and the crops go back to your barn.
--  * You can buy at most 10 shelves a Pacific day.
begin;

create table if not exists public.arena_farm_stall (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  slot smallint not null check (slot between 0 and 5),
  crop text not null references public.arena_farm_crops(id),
  mutation text not null default '',
  qty integer not null check (qty between 1 and 10),
  price integer not null check (price between 1 and 100000),
  listed_at timestamptz not null default now(),
  buyer uuid references public.arena_profiles(id) on delete set null,
  sold_at timestamptz,
  primary key (player_id, slot)
);
create table if not exists public.arena_farm_stall_days (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  earned integer not null default 0 check (earned >= 0),
  bought integer not null default 0 check (bought >= 0),
  primary key (player_id, day)
);
-- Every sale, for the Valley Cup and the seller's log.
create table if not exists public.arena_farm_stall_sales (
  id bigserial primary key,
  seller uuid not null references public.arena_profiles(id) on delete cascade,
  buyer uuid not null references public.arena_profiles(id) on delete cascade,
  crop text not null,
  qty integer not null,
  price integer not null,
  at timestamptz not null default now()
);
create index if not exists arena_farm_stall_sales_seller on public.arena_farm_stall_sales(seller, at);
alter table public.arena_farm_stall enable row level security;
alter table public.arena_farm_stall_days enable row level security;
alter table public.arena_farm_stall_sales enable row level security;
revoke all on public.arena_farm_stall, public.arena_farm_stall_days, public.arena_farm_stall_sales
  from public, anon, authenticated, service_role;
revoke all on sequence public.arena_farm_stall_sales_id_seq from public, anon, authenticated, service_role;

-- What the Market pays this player for one of a crop (with its mutation) today.
create or replace function public.arena_farm_unit_price(pid uuid, p_crop text, p_mutation text) returns integer
language sql stable security definer set search_path = public as $$
  select public.arena_farm_sell_price(c.sell, m.mult, coalesce(p_mutation, ''))
  from public.arena_farm_crops c
  join public.arena_farm_market(public.arena_today(),
    coalesce((select level from public.arena_farms where player_id = pid), 1), pid) m on m.crop = c.id
  where c.id = p_crop
$$;
revoke all on function public.arena_farm_unit_price(uuid, text, text) from public, anon, authenticated, service_role;

create or replace function public.arena_farm_stall_view(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shelves', coalesce((select jsonb_agg(jsonb_build_object('slot', s.slot, 'crop', s.crop,
        'mutation', s.mutation, 'qty', s.qty, 'price', s.price,
        'sold', s.buyer is not null, 'buyer', pr.display_name,
        'collect', case when s.buyer is not null then s.price - ceil(s.price * 0.1)::integer end)
      order by s.slot)
      from public.arena_farm_stall s left join public.arena_profiles pr on pr.id = s.buyer
      where s.player_id = pid), '[]'::jsonb),
    'earnedToday', coalesce((select earned from public.arena_farm_stall_days
      where player_id = pid and day = public.arena_today()), 0),
    'boughtToday', coalesce((select bought from public.arena_farm_stall_days
      where player_id = pid and day = public.arena_today()), 0),
    'earnCap', 3000,
    'buyCap', 10)
$$;
revoke all on function public.arena_farm_stall_view(uuid) from public, anon, authenticated, service_role;

-- Friends' unsold shelves.
create or replace function public.arena_farm_paper_for(me uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('seller', pr.id, 'name', pr.display_name,
      'fighter', pr.portrait_character, 'slot', s.slot, 'crop', s.crop, 'mutation', s.mutation,
      'qty', s.qty, 'price', s.price,
      'market', public.arena_farm_unit_price(me, s.crop, s.mutation) * s.qty)
    order by s.listed_at desc), '[]'::jsonb)
  from public.arena_friendships fs
  join public.arena_profiles pr on pr.id = case when fs.a = me then fs.b else fs.a end and not pr.suspended
  join public.arena_farm_stall s on s.player_id = pr.id and s.buyer is null
  where fs.a = me or fs.b = me
$$;
revoke all on function public.arena_farm_paper_for(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_farm_stall() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_farm_ensure(me);
  return public.arena_farm_stall_view(me) || jsonb_build_object('paper', public.arena_farm_paper_for(me));
end; $$;
revoke all on function public.arena_farm_stall() from public, anon;
grant execute on function public.arena_farm_stall() to authenticated;

-- List, take down or collect a shelf; or buy a friend's shelf.
create or replace function public.arena_farm_stall_act(p_request uuid, p_kind text, p_slot integer,
  p_crop text default null, p_mutation text default null, p_qty integer default null,
  p_price integer default null, p_seller uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); inserted integer; err text; gained jsonb;
  s public.arena_farm_stall; unit integer; fee integer; pay integer; v_earned integer; v_used integer;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or p_kind not in ('list', 'unlist', 'collect', 'buy')
     or p_slot is null or p_slot not between 0 and 5 then
    raise exception 'Invalid stall request';
  end if;
  if p_kind = 'buy' and (p_seller is null or p_seller = me or not public.arena_farm_are_friends(me, p_seller)) then
    raise exception 'Only friends can buy from your stall';
  end if;
  perform public.arena_farm_ensure(me);
  if p_kind = 'buy' then
    perform 1 from public.arena_farms where player_id in (me, p_seller) order by player_id for update;
  else
    perform 1 from public.arena_farms where player_id = me for update;
  end if;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return public.arena_farm_stall_view(me) || jsonb_build_object('paper', public.arena_farm_paper_for(me),
      'ok', false, 'repeated', true);
  end if;
  insert into public.arena_farm_stall_days(player_id, day) values (me, d) on conflict do nothing;
  if p_kind = 'list' then
    unit = public.arena_farm_unit_price(me, p_crop, coalesce(p_mutation, ''));
    if exists (select 1 from public.arena_farm_stall where player_id = me and slot = p_slot) then
      err = 'That shelf is in use';
    elsif unit is null then err = 'Unknown crop';
    elsif p_qty is null or p_qty not between 1 and 10 then err = 'Put 1 to 10 crops on a shelf';
    elsif p_price is null or p_price < ceil(unit * p_qty * 0.5) or p_price > floor(unit * p_qty * 1.5) then
      err = 'Price it between ' || ceil(unit * p_qty * 0.5)::integer || ' and '
        || floor(unit * p_qty * 1.5)::integer || ' leaves';
    else
      update public.arena_farm_barn set qty = qty - p_qty
       where player_id = me and crop = p_crop and mutation = coalesce(p_mutation, '') and qty >= p_qty;
      get diagnostics v_used = row_count;
      if v_used = 0 then err = 'You don''t have that many';
      else
        insert into public.arena_farm_stall(player_id, slot, crop, mutation, qty, price)
        values (me, p_slot, p_crop, coalesce(p_mutation, ''), p_qty, p_price);
      end if;
    end if;
  elsif p_kind = 'unlist' then
    select * into s from public.arena_farm_stall where player_id = me and slot = p_slot for update;
    if s.player_id is null then err = 'That shelf is empty';
    elsif s.buyer is not null then err = 'That shelf sold. Collect it';
    else
      delete from public.arena_farm_stall where player_id = me and slot = p_slot;
      insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (me, s.crop, s.mutation, s.qty)
      on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + excluded.qty;
    end if;
  elsif p_kind = 'collect' then
    select * into s from public.arena_farm_stall where player_id = me and slot = p_slot for update;
    select x.earned into v_earned from public.arena_farm_stall_days x where x.player_id = me and x.day = d for update;
    fee = ceil(s.price * 0.1)::integer;
    pay = s.price - fee;
    if s.player_id is null or s.buyer is null then err = 'Nothing to collect';
    elsif v_earned + pay > 3000 then err = 'Your stall paid 3,000 leaves today. Collect this tomorrow';
    else
      delete from public.arena_farm_stall where player_id = me and slot = p_slot;
      update public.arena_farm_stall_days set earned = earned + pay where player_id = me and day = d;
      perform public.arena_grant_leaves(me, pay, 'farm-stall', p_request::text, d);
      gained = jsonb_build_object('leaves', pay, 'fee', fee);
    end if;
  else
    select * into s from public.arena_farm_stall where player_id = p_seller and slot = p_slot for update;
    if s.player_id is null or s.buyer is not null then err = 'Someone bought that already';
    elsif (select bought from public.arena_farm_stall_days where player_id = me and day = d) >= 10 then
      err = 'You bought 10 shelves today. Shop again tomorrow';
    elsif (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = me) + s.qty
          > (select 80 + 40 * barn_upgrades from public.arena_farms where player_id = me) then
      err = 'Your barn is full';
    elsif not public.arena_spend_leaves(me, s.price, 'farm-stall-buy', p_request::text, d) then
      err = 'Not enough Gold Leaves';
    else
      update public.arena_farm_stall set buyer = me, sold_at = now() where player_id = p_seller and slot = p_slot;
      insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (me, s.crop, s.mutation, s.qty)
      on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + excluded.qty;
      update public.arena_farm_stall_days set bought = bought + 1 where player_id = me and day = d;
      insert into public.arena_farm_stall_sales(seller, buyer, crop, qty, price)
      values (p_seller, me, s.crop, s.qty, s.price);
      gained = jsonb_build_object('crop', s.crop, 'mutation', s.mutation, 'qty', s.qty, 'price', s.price);
    end if;
  end if;
  return public.arena_farm_stall_view(me) || jsonb_build_object('paper', public.arena_farm_paper_for(me),
    'ok', err is null, 'error', err, 'gained', gained);
end; $$;
revoke all on function public.arena_farm_stall_act(uuid, text, integer, text, text, integer, integer, uuid)
  from public, anon;
grant execute on function public.arena_farm_stall_act(uuid, text, integer, text, text, integer, integer, uuid)
  to authenticated;

commit;
