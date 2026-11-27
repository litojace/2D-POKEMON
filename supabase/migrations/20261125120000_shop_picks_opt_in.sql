-- Today's Picks only offers items that were opened to it. Safe to run again.
--
-- Today's Picks draws four items a day, evenly, from every item on sale
-- (010_shop.sql). An app that was built before an item existed can't draw
-- that item's tile: the iOS app carries its own copy of the game, and a
-- phone keeps an old page open for days, so the Today tab broke for them on
-- the day a pick was an item they had never heard of.
--
--  * arena_shop_items.in_picks says whether an item may be a pick. It is
--    false for every row added from now on (the column's default), so a
--    catalog migration that only inserts rows keeps its new items out of
--    Today's Picks on its own. They are sold in the Shop's own tabs at once.
--  * Every item on sale today keeps its place: in_picks is set to true for
--    the rows that exist when the column is first added, and never again.
--  * To open new items later, a migration sets in_picks = true for their
--    ids, once the app versions still in use know them (docs/shop-new-items.md).
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'arena_shop_items' and column_name = 'in_picks'
  ) then
    alter table public.arena_shop_items add column in_picks boolean not null default false;
    update public.arena_shop_items set in_picks = true;
  end if;
end $$;

-- Today's Picks: four items; the first non-Mythical one is the deal.
create or replace function public.arena_shop_picks(p_day date)
returns table(item_id text, deal boolean) language sql stable security definer set search_path = public as $$
  with picked as (
    select id, rarity, row_number() over (order by md5('picks:' || p_day::text || ':' || id)) as n
      from public.arena_shop_items where active and in_picks and kind <> 'bundle'
  ), top as (select * from picked where n <= 4)
  select id, id = (select id from top where rarity <> 'mythical' order by n limit 1) from top order by n
$$;
-- Only the economy's own SECURITY DEFINER functions read it (034).
revoke all on function public.arena_shop_picks(date) from public, anon, authenticated;

commit;

select
  (select count(*) from public.arena_shop_items where active and kind <> 'bundle') as items_in_picks,
  (select count(*) from public.arena_shop_items where active and not in_picks and kind <> 'bundle') as items_held_back;
