-- Opens the collections added on 25 Nov 2026 to Today's Picks: the eight
-- sets and Singles (20261125200000_look_singles.sql). Safe to run again.
--
-- They were seeded with in_picks false (20261125120000_shop_picks_opt_in.sql):
-- a client built before an item existed broke its Today tab when that item
-- was a pick. Both conditions in docs/shop-new-items.md now hold:
--  * The client that skips picks it doesn't know (#435) has been live on the
--    web since 25 Nov 00:01 PT. No App Store build exists yet
--    (docs/ios-app.md), and any first build carries #435.
--  * Every one of these collections is in the client that is live on the
--    web (#438 to #473, and Singles #483, merged 25 Nov).
-- The owner asked on 25 Nov to open Singles at once too, since nobody plays
-- yet. The file is named after Singles' so that a fresh database (tests,
-- check-migrations) opens the same rows as production.
-- Set bundles stay out: Today's Picks never offers a bundle.
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'arena_shop_items' and column_name = 'in_picks'
  ) then
    raise exception 'Run 20261125120000_shop_picks_opt_in.sql first';
  end if;
end $$;

update public.arena_shop_items
   set in_picks = true
 where collection in ('starlight-idol', 'seaside', 'steamworks', 'borealis', 'birthstone', 'rainy-day', 'grand-prix', 'sun-dynasty', 'singles')
   and kind <> 'bundle'
   and not in_picks;

commit;

select
  (select count(*) from public.arena_shop_items
    where collection in ('starlight-idol', 'seaside', 'steamworks', 'borealis', 'birthstone', 'rainy-day', 'grand-prix', 'sun-dynasty', 'singles')
      and kind <> 'bundle' and in_picks) as opened,
  (select count(*) from public.arena_shop_items where active and kind <> 'bundle' and not in_picks) as still_held_back;
