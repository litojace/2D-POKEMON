-- Cyber Mecha: a second Epic for every champion (16 skins), in its own
-- paint over chrome with neon in a contrasting colour, a mecha headset and
-- core collar in place of its own head and neck pieces, and a jetpack.
-- With these every champion has 8 skins. Run after 067 (and 068, the Bistro).
--
-- The rows are printed from packages/shared/src/shop.ts by
--   node --experimental-strip-types scripts/print-shop-seed.ts
-- and tests/unit/shop-catalog.test.ts checks they still match. The Cyber
-- Mecha collection has no frame yet, so the collection bonus is unchanged.
begin;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-arc-unit', 'champion', 'voltkit', null, 'Arc Unit', 'epic', 'cyber', 3500, null),
  ('cindrake-reactor', 'champion', 'cindrake', null, 'Reactor', 'epic', 'cyber', 3500, null),
  ('tidefin-hydro-frame', 'champion', 'tidefin', null, 'Hydro Frame', 'epic', 'cyber', 3500, null),
  ('auralynx-prism-mech', 'champion', 'auralynx', null, 'Prism Mech', 'epic', 'cyber', 3500, null),
  ('lumoth-photon', 'champion', 'lumoth', null, 'Photon', 'epic', 'cyber', 3500, null),
  ('mystowl-psi-core', 'champion', 'mystowl', null, 'Psi Core', 'epic', 'cyber', 3500, null),
  ('terradon-tank-mk2', 'champion', 'terradon', null, 'Tank Mk II', 'epic', 'cyber', 3500, null),
  ('duskveil-phantom-os', 'champion', 'duskveil', null, 'Phantom OS', 'epic', 'cyber', 3500, null),
  ('coilemur-tesla-frame', 'champion', 'coilemur', null, 'Tesla Frame', 'epic', 'cyber', 3500, null),
  ('pyranda-afterburner', 'champion', 'pyranda', null, 'Afterburner', 'epic', 'cyber', 3500, null),
  ('glacelle-cryo-unit', 'champion', 'glacelle', null, 'Cryo Unit', 'epic', 'cyber', 3500, null),
  ('halcyra-sniper-drone', 'champion', 'halcyra', null, 'Sniper Drone', 'epic', 'cyber', 3500, null),
  ('sunbara-solar-mech', 'champion', 'sunbara', null, 'Solar Mech', 'epic', 'cyber', 3500, null),
  ('astrabun-warp-unit', 'champion', 'astrabun', null, 'Warp Unit', 'epic', 'cyber', 3500, null),
  ('wombolder-bulldozer', 'champion', 'wombolder', null, 'Bulldozer', 'epic', 'cyber', 3500, null),
  ('shadopus-stealth-mk', 'champion', 'shadopus', null, 'Stealth Mk', 'epic', 'cyber', 3500, null)
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;
