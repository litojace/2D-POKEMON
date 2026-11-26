-- Six more Look pieces sold on their own (collection 'singles'). Safe to run
-- again; keeps ownership.
--
-- Each is a theme of its own, priced like a set's piece of the same slot and
-- tier (docs/shop-new-items.md, Singles):
--   Music aura           Rare     900   Rune aura          Epic   1,440
--   Smoke-bomb entrance  Rare   1,000   Rainbow entrance   Epic   1,600
--   Balloon victory      Epic   1,800   Disco victory      Epic   2,880
-- No bundle. The rows come from packages/shared/src/shop.ts; the test
-- tests/unit/shop-catalog.test.ts checks they match.
-- They go straight into Today's Picks (in_picks true): the owner asked on
-- 25 Nov to open new pieces at once, since nobody plays yet, and the client
-- that skips picks it doesn't know (#435) is live.
begin;

-- Never add items before the picks opt-in exists.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'arena_shop_items' and column_name = 'in_picks'
  ) then
    raise exception 'Run 20261125120000_shop_picks_opt_in.sql first';
  end if;
end $$;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('music-aura', 'look', null, 'aura', 'Music aura', 'rare', 'singles', 900, null),
  ('rune-aura', 'look', null, 'aura', 'Rune aura', 'epic', 'singles', 1440, null),
  ('smoke-entrance', 'look', null, 'entrance', 'Smoke-bomb entrance', 'rare', 'singles', 1000, null),
  ('rainbow-entrance', 'look', null, 'entrance', 'Rainbow entrance', 'epic', 'singles', 1600, null),
  ('balloon-victory', 'look', null, 'victory', 'Balloon victory', 'epic', 'singles', 1800, null),
  ('disco-victory', 'look', null, 'victory', 'Disco victory', 'epic', 'singles', 2880, null)
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

-- Into Today's Picks at once (see above).
update public.arena_shop_items set in_picks = true
 where id in ('music-aura', 'rune-aura', 'smoke-entrance', 'rainbow-entrance', 'balloon-victory', 'disco-victory')
   and not in_picks;

commit;

select
  (select count(*) from public.arena_shop_items where collection = 'singles' and kind = 'look' and active) as singles,
  (select count(*) from public.arena_shop_items where collection = 'singles' and in_picks) as in_todays_picks;
