-- Retire the Dream Carnival collection (owner's decision, 18 Nov 2026). Safe to run again.
--
-- Its 18 Epic skins and their full-roster set leave the Shop. Nobody owned
-- one when this was written; anyone who bought one before it ran gets the
-- skin's list price back (one ledger line per skin, so running again
-- refunds nothing twice), and the skin comes off their champion.
begin;

create temporary table retired_items on commit drop as
  select id, kind, price from public.arena_shop_items where collection = 'dream-carnival';

-- Refunds: the list price of each retired skin someone owns.
with owned as (
  select o.player_id, r.id, r.price
  from public.arena_owned_items o join retired_items r on r.id = o.item_id
  where r.kind = 'champion' and r.price > 0
), booked as (
  insert into public.arena_coin_ledger(player_id, amount, reason, ref, day)
  select player_id, price, 'refund', id, current_date from owned
  on conflict (player_id, reason, ref) do nothing
  returning player_id, amount
), totals as (
  select player_id, sum(amount)::int as amount from booked group by player_id
)
insert into public.arena_wallets(player_id, balance)
select player_id, amount from totals
on conflict (player_id) do update set balance = public.arena_wallets.balance + excluded.balance;

delete from public.arena_champion_looks where skin in (select id from retired_items);
delete from public.arena_skin_progress where skin_id in (select id from retired_items);
delete from public.arena_owned_items where item_id in (select id from retired_items);
delete from public.arena_shop_items where id in (select id from retired_items);

commit;
