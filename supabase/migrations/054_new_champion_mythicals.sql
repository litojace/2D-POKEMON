-- Mythical skins for the eight newest champions: Cometcaller (Coilemur),
-- Harvest Moon (Pyranda), Polaris (Glacelle), Starfletch (Halcyra), Daybreak
-- (Sunbara), Full Moon (Astrabun), Saturnine (Wombolder) and Nebula
-- (Shadopus). Run after 053. With these, every champion has 7 skins.
--
-- The rows are printed from packages/shared/src/shop.ts by
--   node --experimental-strip-types scripts/print-shop-seed.ts
-- and tests/unit/shop-catalog.test.ts checks they still match.
--
-- Like the original Mythicals they need the 30-win Mythic Trial and awaken
-- with arena_skin_progress, which is per skin, so nothing else changes. They
-- join the Celestial collection, so its free frame now needs all sixteen
-- Mythicals; anyone who already earned it keeps it.
begin;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('coilemur-cometcaller', 'champion', 'coilemur', null, 'Cometcaller', 'mythical', 'celestial', 8000, null),
  ('pyranda-harvest-moon', 'champion', 'pyranda', null, 'Harvest Moon', 'mythical', 'celestial', 8000, null),
  ('glacelle-polaris', 'champion', 'glacelle', null, 'Polaris', 'mythical', 'celestial', 8000, null),
  ('halcyra-starfletch', 'champion', 'halcyra', null, 'Starfletch', 'mythical', 'celestial', 8000, null),
  ('sunbara-daybreak', 'champion', 'sunbara', null, 'Daybreak', 'mythical', 'celestial', 8000, null),
  ('astrabun-full-moon', 'champion', 'astrabun', null, 'Full Moon', 'mythical', 'celestial', 8000, null),
  ('wombolder-saturnine', 'champion', 'wombolder', null, 'Saturnine', 'mythical', 'celestial', 8000, null),
  ('shadopus-nebula', 'champion', 'shadopus', null, 'Nebula', 'mythical', 'celestial', 8000, null)
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;
