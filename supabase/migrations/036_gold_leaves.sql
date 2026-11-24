-- Hub redesign, phase 3a: Gold Leaves, a second soft currency.
-- Run after 035_level_100_daily_spark.sql. Safe to run again.
--  * Earned on the Farm and in the Plaza, only through server functions
--    (arena_grant_leaves), once per (player, reason, ref) like coins.
--  * Spent through server functions (arena_spend_leaves); never below zero.
--  * 100 leaves trade for 5 coins, at most 40 coins a Pacific day.
--  * arena_economy() reports the wallet as `leaves`.
begin;

create table if not exists public.arena_leaf_wallets (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0)
);
create table if not exists public.arena_leaf_ledger (
  id bigserial primary key,
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null,
  ref text not null,
  day date not null,
  created_at timestamptz not null default now(),
  unique (player_id, reason, ref)
);
create index if not exists arena_leaf_ledger_day on public.arena_leaf_ledger(player_id, day, reason);
alter table public.arena_leaf_wallets enable row level security;
alter table public.arena_leaf_ledger enable row level security;
revoke all on public.arena_leaf_wallets, public.arena_leaf_ledger from public, anon, authenticated, service_role;

-- Pay leaves once per (reason, ref). Returns whether it paid.
create or replace function public.arena_grant_leaves(pid uuid, p_amount integer, p_reason text, p_ref text, p_day date)
returns boolean language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then return false; end if;
  if not exists (select 1 from public.arena_profiles where id = pid and not suspended) then return false; end if;
  insert into public.arena_leaf_ledger(player_id, amount, reason, ref, day)
  values (pid, p_amount, p_reason, p_ref, p_day) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return false; end if;
  insert into public.arena_leaf_wallets(player_id, balance) values (pid, p_amount)
  on conflict (player_id) do update set balance = public.arena_leaf_wallets.balance + p_amount;
  return true;
end; $$;

-- Spend leaves once per (reason, ref). False when the balance is too low or
-- the same spend was already made (a retried request never charges twice).
create or replace function public.arena_spend_leaves(pid uuid, p_amount integer, p_reason text, p_ref text, p_day date)
returns boolean language plpgsql security definer set search_path = public as $$
declare paid integer;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then return false; end if;
  insert into public.arena_leaf_wallets(player_id) values (pid) on conflict do nothing;
  if exists (select 1 from public.arena_leaf_ledger where player_id = pid and reason = p_reason and ref = p_ref) then
    return false;
  end if;
  update public.arena_leaf_wallets set balance = balance - p_amount
   where player_id = pid and balance >= p_amount;
  get diagnostics paid = row_count;
  if paid = 0 then return false; end if;
  insert into public.arena_leaf_ledger(player_id, amount, reason, ref, day)
  values (pid, -p_amount, p_reason, p_ref, p_day);
  return true;
end; $$;
revoke all on function public.arena_grant_leaves(uuid, integer, text, text, date),
  public.arena_spend_leaves(uuid, integer, text, text, date)
  from public, anon, authenticated, service_role;

-- The caller's wallet: balance and today's trade allowance.
create or replace function public.arena_leaves() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today();
begin
  if me is null then raise exception 'Login required'; end if;
  return jsonb_build_object(
    'balance', coalesce((select balance from public.arena_leaf_wallets where player_id = me), 0),
    'tradedToday', coalesce((select sum(amount) from public.arena_coin_ledger
       where player_id = me and day = d and reason = 'leaf-trade'), 0),
    'tradeCap', 40,
    'tradeLeaves', 100,
    'tradeCoins', 5);
end; $$;
revoke all on function public.arena_leaves() from public, anon;
grant execute on function public.arena_leaves() to authenticated;

-- Trade leaves for coins: `p_lots` × 100 leaves → `p_lots` × 5 coins, up to
-- 40 coins a Pacific day. The coin wallet and the leaf wallet change together.
create or replace function public.arena_trade_leaves(p_lots integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); traded integer; ref text = gen_random_uuid()::text;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_lots is null or p_lots < 1 or p_lots > 8 then raise exception 'Choose how many to trade'; end if;
  insert into public.arena_leaf_wallets(player_id) values (me) on conflict do nothing;
  -- One trade at a time per player, so two requests share one daily cap.
  perform 1 from public.arena_leaf_wallets where player_id = me for update;
  traded = coalesce((select sum(amount) from public.arena_coin_ledger
     where player_id = me and day = d and reason = 'leaf-trade'), 0);
  if traded + p_lots * 5 > 40 then raise exception 'You can trade for at most 40 coins a day'; end if;
  if not public.arena_spend_leaves(me, p_lots * 100, 'trade', ref, d) then
    raise exception 'Not enough Gold Leaves';
  end if;
  perform public.arena_grant(me, p_lots * 5, 'leaf-trade', ref, d);
  return public.arena_economy();
end; $$;
revoke all on function public.arena_trade_leaves(integer) from public, anon;
grant execute on function public.arena_trade_leaves(integer) to authenticated;

-- The economy now carries the leaf wallet.
create or replace function public.arena_economy() returns jsonb
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  e = public.arena_economy_before_journey();
  return e || jsonb_build_object(
    'journey', public.arena_journey(),
    'rerollsUsed', coalesce((select rerolls_used from public.arena_mission_days
      where player_id = auth.uid() and day = public.arena_today()), 0),
    'rerollLimit', 5,
    'leaves', public.arena_leaves());
end; $$;
revoke all on function public.arena_economy() from public, anon;
grant execute on function public.arena_economy() to authenticated;
commit;

select
  to_regclass('public.arena_leaf_wallets') is not null as leaf_wallet_enabled,
  position('''leaves''' in pg_get_functiondef('public.arena_economy()'::regprocedure)) > 0 as economy_reports_leaves;
