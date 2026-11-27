-- The daily gift (packages/shared/src/daily-gifts.ts, docs/onboarding.md):
-- one gift a Pacific day, a little more each day in a row, a cosmetic on
-- the seventh day of a player's first week (coins from the second week on,
-- or when they own it already).
--
--   - arena_daily_gifts: one row per player: the last day taken (1-7), when,
--     whole weeks finished and gifts taken in all. Read and written only
--     through the functions below.
--   - arena_daily_gift(): where you are in the calendar today.
--   - arena_daily_gift_claim(): take today's gift. Once a day: the row is
--     locked, the date checked, and the coins and XP are ledger rows keyed
--     by the day, so a second claim can pay nothing.
--
-- A missed day is forgiven once in a row: two days after the last gift the
-- row still goes on; three or more, it starts again at day 1.
-- Run after 20261126120000_first_win_xp.sql. Safe to run again.
begin;

create table if not exists public.arena_daily_gifts (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  -- The last day taken: 0 before the first gift.
  day smallint not null default 0 check (day between 0 and 7),
  last_claim date,
  weeks integer not null default 0 check (weeks >= 0),
  total integer not null default 0 check (total >= 0),
  updated_at timestamptz not null default now()
);
alter table public.arena_daily_gifts enable row level security;
revoke all on public.arena_daily_gifts from public, anon, authenticated;

-- Days 1 to 7 (DAILY_GIFTS in packages/shared/src/daily-gifts.ts).
create or replace function public.arena_daily_gift_table() returns jsonb
language sql immutable set search_path = '' as $$
  select '[
    {"coins": 50},
    {"xp": 100},
    {"coins": 75},
    {"xp": 150},
    {"coins": 100},
    {"xp": 200},
    {"item": "firefly-aura", "coins": 200}
  ]'::jsonb
$$;

-- The day (1-7) the next gift is, from the last one (nextGiftDay).
create or replace function public.arena_daily_gift_next(p_day integer, p_last date, p_today date)
returns integer language sql immutable set search_path = '' as $$
  select case
    when p_last is null or p_today - p_last > 2 or p_today - p_last < 1 then 1
    when p_day >= 7 then 1
    else p_day + 1
  end
$$;

-- A player's place in the calendar (not callable by players: see below).
create or replace function public.arena_daily_gift_state(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d date = public.arena_today();
  r public.arena_daily_gifts;
  taken boolean;
  item text;
begin
  select * into r from public.arena_daily_gifts where player_id = pid;
  taken = r.last_claim is not null and r.last_claim >= d;
  item = public.arena_daily_gift_table()->6->>'item';
  return jsonb_build_object(
    'today', d::text,
    'claimed', taken,
    'day', case when taken then greatest(1, r.day)
                else public.arena_daily_gift_next(coalesce(r.day, 0), r.last_claim, d) end,
    'weeks', coalesce(r.weeks, 0),
    'ownsItem', exists (select 1 from public.arena_owned_items o
                        where o.player_id = pid and o.item_id = item)
  );
end; $$;

create or replace function public.arena_daily_gift() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.arena_require_player();
  return public.arena_daily_gift_state(auth.uid());
end; $$;

create or replace function public.arena_daily_gift_claim() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid = auth.uid();
  d date = public.arena_today();
  r public.arena_daily_gifts;
  next_day integer;
  gift jsonb;
  item text;
  coins integer;
  xp integer;
begin
  perform public.arena_require_player();
  -- The row first, then its lock: two claims at once wait for each other.
  insert into public.arena_daily_gifts(player_id) values (pid) on conflict do nothing;
  select * into r from public.arena_daily_gifts where player_id = pid for update;
  if r.last_claim is not null and r.last_claim >= d then
    raise exception 'Today''s gift is already yours. Come back tomorrow.' using errcode = 'P0001';
  end if;
  next_day = public.arena_daily_gift_next(r.day, r.last_claim, d);
  gift = public.arena_daily_gift_table()->(next_day - 1);
  -- The cosmetic: the first week only, and only if it isn't theirs yet.
  item = gift->>'item';
  if item is not null and (r.weeks > 0 or exists (
       select 1 from public.arena_owned_items o where o.player_id = pid and o.item_id = item)) then
    item = null;
  end if;
  coins = case when item is null then coalesce((gift->>'coins')::integer, 0) else 0 end;
  xp = coalesce((gift->>'xp')::integer, 0);
  if item is not null then
    insert into public.arena_owned_items(player_id, item_id) values (pid, item) on conflict do nothing;
  end if;
  if coins > 0 then perform public.arena_grant(pid, coins, 'daily-gift', d::text, d); end if;
  if xp > 0 then perform public.arena_add_xp(pid, xp, 'daily-gift', d::text, d); end if;
  update public.arena_daily_gifts set
    day = next_day,
    last_claim = d,
    weeks = weeks + case when next_day = 7 then 1 else 0 end,
    total = total + 1,
    updated_at = now()
  where player_id = pid;
  return public.arena_daily_gift_state(pid) || jsonb_build_object(
    'given', jsonb_build_object('day', next_day, 'coins', coins, 'xp', xp, 'item', item));
end; $$;

revoke all on function
  public.arena_daily_gift_table(),
  public.arena_daily_gift_next(integer, date, date),
  public.arena_daily_gift_state(uuid),
  public.arena_daily_gift(),
  public.arena_daily_gift_claim()
  from public, anon, authenticated;
grant execute on function public.arena_daily_gift(), public.arena_daily_gift_claim()
  to authenticated;
commit;
notify pgrst, 'reload schema';
