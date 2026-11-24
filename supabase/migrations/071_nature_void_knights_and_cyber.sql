-- The Nature champions join the Void Knight and Cyber Mecha sets (067, 069),
-- which reached main while Pangrove and Mossloth (070) were being made with
-- the old Celestial Mythicals. Run after 070.
--
--  * Their Mythicals become Void Knights in place, as 067 did for the other
--    sixteen: the same skin id, so anyone who owns one keeps it, its
--    Awakening progress and the look they have equipped. Only the shop name
--    and the collection change; the art is client-side.
--  * Each gets its Cyber Mecha Epic, so every champion has 8 skins.
--
-- The rows are printed from packages/shared/src/shop.ts by
--   node --experimental-strip-types scripts/print-shop-seed.ts
-- and tests/unit/shop-catalog.test.ts checks they still match.
begin;

update public.arena_shop_items set name = 'Thorn Warden', collection = 'void' where id = 'pangrove-evergrove';
update public.arena_shop_items set name = 'Blight Sentinel', collection = 'void' where id = 'mossloth-moonbloom';

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('pangrove-scaleroller', 'champion', 'pangrove', null, 'Scale Roller', 'epic', 'cyber', 3500, null),
  ('mossloth-treehugger', 'champion', 'mossloth', null, 'Treehugger Mk', 'epic', 'cyber', 3500, null)
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;
