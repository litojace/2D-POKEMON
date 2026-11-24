-- Shop skins for the eight newest champions (Coilemur, Pyranda, Glacelle,
-- Halcyra, Sunbara, Astrabun, Wombolder, Shadopus): 3 Common, 2 Rare and 1
-- Epic each. Their Mythicals come in a later migration. Run after 052.
--
-- The rows are printed from packages/shared/src/shop.ts by
--   node --experimental-strip-types scripts/print-shop-seed.ts
-- and tests/unit/shop-catalog.test.ts checks they still match.
--
-- The Rares and Epics join existing collections (Winter, Festival, Garden,
-- Arcade), so those collections' free frame (arena_collection_bonus, 011) now
-- needs these skins too. Anyone who already earned a frame keeps it.
begin;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('coilemur-sifaka', 'champion', 'coilemur', null, 'Sifaka', 'common', null, 500, null),
  ('coilemur-copper-wire', 'champion', 'coilemur', null, 'Copper Wire', 'common', null, 500, null),
  ('coilemur-blackout', 'champion', 'coilemur', null, 'Blackout', 'common', null, 500, null),
  ('coilemur-firecracker', 'champion', 'coilemur', null, 'Firecracker', 'rare', 'festival', 1500, null),
  ('coilemur-frost-fuse', 'champion', 'coilemur', null, 'Frost Fuse', 'rare', 'winter', 1500, null),
  ('coilemur-tesla-coil', 'champion', 'coilemur', null, 'Tesla Coil', 'epic', 'arcade', 3500, null),
  ('pyranda-snowy', 'champion', 'pyranda', null, 'Snowy', 'common', null, 500, null),
  ('pyranda-cinnamon', 'champion', 'pyranda', null, 'Cinnamon', 'common', null, 500, null),
  ('pyranda-plum', 'champion', 'pyranda', null, 'Plum', 'common', null, 500, null),
  ('pyranda-chestnut-grove', 'champion', 'pyranda', null, 'Chestnut Grove', 'rare', 'garden', 1500, null),
  ('pyranda-street-vendor', 'champion', 'pyranda', null, 'Street Vendor', 'rare', 'festival', 1500, null),
  ('pyranda-fireside-knit', 'champion', 'pyranda', null, 'Fireside Knit', 'epic', 'winter', 3500, null),
  ('glacelle-deep-sea', 'champion', 'glacelle', null, 'Deep Sea', 'common', null, 500, null),
  ('glacelle-lilac-tide', 'champion', 'glacelle', null, 'Lilac Tide', 'common', null, 500, null),
  ('glacelle-seafoam', 'champion', 'glacelle', null, 'Seafoam', 'common', null, 500, null),
  ('glacelle-water-lily', 'champion', 'glacelle', null, 'Water Lily', 'rare', 'garden', 1500, null),
  ('glacelle-snow-globe', 'champion', 'glacelle', null, 'Snow Globe', 'rare', 'winter', 1500, null),
  ('glacelle-deep-glow', 'champion', 'glacelle', null, 'Deep Glow', 'epic', 'arcade', 3500, null),
  ('halcyra-teal-wing', 'champion', 'halcyra', null, 'Teal Wing', 'common', null, 500, null),
  ('halcyra-pied', 'champion', 'halcyra', null, 'Pied', 'common', null, 500, null),
  ('halcyra-sunset', 'champion', 'halcyra', null, 'Sunset', 'common', null, 500, null),
  ('halcyra-fletcher', 'champion', 'halcyra', null, 'Fletcher', 'rare', 'festival', 1500, null),
  ('halcyra-winter-plume', 'champion', 'halcyra', null, 'Winter Plume', 'rare', 'winter', 1500, null),
  ('halcyra-paper-crane', 'champion', 'halcyra', null, 'Paper Crane', 'epic', 'festival', 3500, null),
  ('sunbara-cocoa', 'champion', 'sunbara', null, 'Cocoa', 'common', null, 500, null),
  ('sunbara-milk-tea', 'champion', 'sunbara', null, 'Milk Tea', 'common', null, 500, null),
  ('sunbara-rose-quartz', 'champion', 'sunbara', null, 'Rose Quartz', 'common', null, 500, null),
  ('sunbara-bathhouse', 'champion', 'sunbara', null, 'Bathhouse', 'rare', 'festival', 1500, null),
  ('sunbara-snow-day', 'champion', 'sunbara', null, 'Snow Day', 'rare', 'winter', 1500, null),
  ('sunbara-sunflower', 'champion', 'sunbara', null, 'Sunflower', 'epic', 'garden', 3500, null),
  ('astrabun-nightfall', 'champion', 'astrabun', null, 'Nightfall', 'common', null, 500, null),
  ('astrabun-sakura-mochi', 'champion', 'astrabun', null, 'Sakura Mochi', 'common', null, 500, null),
  ('astrabun-matcha', 'champion', 'astrabun', null, 'Matcha', 'common', null, 500, null),
  ('astrabun-mochi-maker', 'champion', 'astrabun', null, 'Mochi Maker', 'rare', 'festival', 1500, null),
  ('astrabun-clover', 'champion', 'astrabun', null, 'Clover', 'rare', 'garden', 1500, null),
  ('astrabun-space-cadet', 'champion', 'astrabun', null, 'Space Cadet', 'epic', 'arcade', 3500, null),
  ('wombolder-sandy', 'champion', 'wombolder', null, 'Sandy', 'common', null, 500, null),
  ('wombolder-coal', 'champion', 'wombolder', null, 'Coal', 'common', null, 500, null),
  ('wombolder-ochre', 'champion', 'wombolder', null, 'Ochre', 'common', null, 500, null),
  ('wombolder-mushroom-hollow', 'champion', 'wombolder', null, 'Mushroom Hollow', 'rare', 'garden', 1500, null),
  ('wombolder-snowplough', 'champion', 'wombolder', null, 'Snowplough', 'rare', 'winter', 1500, null),
  ('wombolder-gold-rush', 'champion', 'wombolder', null, 'Gold Rush', 'epic', 'arcade', 3500, null),
  ('shadopus-coral-reef', 'champion', 'shadopus', null, 'Coral Reef', 'common', null, 500, null),
  ('shadopus-deep-blue', 'champion', 'shadopus', null, 'Deep Blue', 'common', null, 500, null),
  ('shadopus-mimic', 'champion', 'shadopus', null, 'Mimic', 'common', null, 500, null),
  ('shadopus-masquerade', 'champion', 'shadopus', null, 'Masquerade', 'rare', 'festival', 1500, null),
  ('shadopus-tide-pool', 'champion', 'shadopus', null, 'Tide Pool', 'rare', 'garden', 1500, null),
  ('shadopus-anglerlight', 'champion', 'shadopus', null, 'Anglerlight', 'epic', 'garden', 3500, null)
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;
