-- Legendary skins and full-roster skin sets. Safe to run again; keeps ownership.
--
-- 1. A new skin rarity, Legendary, between Epic and Mythical. The rarity check
--    is replaced with one that also allows it.
-- 2. The 18 Nova Vanguard hero costumes become Legendary at 5,500 coins (they
--    were Epic at 3,500; nobody owned one when this was written). Owners keep
--    them: only the catalog rows change.
-- 3. Seven skin sets, one per collection that dresses all 18 champions in one
--    design at one rarity (Wayfarer, Moonlit Tea, Astral Court, Cyber Mecha,
--    Abyssal Expedition, Dream Carnival, Nova Vanguard). Like the Look sets
--    (010), a set costs 80% of the pieces you don't own yet
--    (arena_item_price) and buying it grants each piece (arena_buy_item).
--    The Void Knight Mythicals are not bundled: each opens with its own
--    champion's Mythic Trial, which a set would skip.
-- The rows come from packages/shared/src/shop.ts (scripts/shop-seed.ts);
-- tests/unit/shop-catalog.test.ts checks they match.
begin;

alter table public.arena_shop_items drop constraint if exists arena_shop_items_rarity_check;
alter table public.arena_shop_items add constraint arena_shop_items_rarity_check
  check (rarity in ('common', 'rare', 'epic', 'legendary', 'mythical'));

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-nova-vanguard', 'champion', 'voltkit', null, 'Pulse Courier', 'legendary', 'nova-vanguard', 5500, null),
  ('cindrake-nova-vanguard', 'champion', 'cindrake', null, 'Solar Forger', 'legendary', 'nova-vanguard', 5500, null),
  ('tidefin-nova-vanguard', 'champion', 'tidefin', null, 'Riptide Ranger', 'legendary', 'nova-vanguard', 5500, null),
  ('auralynx-nova-vanguard', 'champion', 'auralynx', null, 'Prism Sentinel', 'legendary', 'nova-vanguard', 5500, null),
  ('lumoth-nova-vanguard', 'champion', 'lumoth', null, 'Lumen Warden', 'legendary', 'nova-vanguard', 5500, null),
  ('mystowl-nova-vanguard', 'champion', 'mystowl', null, 'Night Cartographer', 'legendary', 'nova-vanguard', 5500, null),
  ('terradon-nova-vanguard', 'champion', 'terradon', null, 'Bulwark Grove', 'legendary', 'nova-vanguard', 5500, null),
  ('duskveil-nova-vanguard', 'champion', 'duskveil', null, 'Echo Beacon', 'legendary', 'nova-vanguard', 5500, null),
  ('coilemur-nova-vanguard', 'champion', 'coilemur', null, 'Flux Runner', 'legendary', 'nova-vanguard', 5500, null),
  ('pyranda-nova-vanguard', 'champion', 'pyranda', null, 'Cinder Medic', 'legendary', 'nova-vanguard', 5500, null),
  ('glacelle-nova-vanguard', 'champion', 'glacelle', null, 'Frost Weaver', 'legendary', 'nova-vanguard', 5500, null),
  ('halcyra-nova-vanguard', 'champion', 'halcyra', null, 'Gale Captain', 'legendary', 'nova-vanguard', 5500, null),
  ('sunbara-nova-vanguard', 'champion', 'sunbara', null, 'Dawn Defender', 'legendary', 'nova-vanguard', 5500, null),
  ('astrabun-nova-vanguard', 'champion', 'astrabun', null, 'Comet Strider', 'legendary', 'nova-vanguard', 5500, null),
  ('wombolder-nova-vanguard', 'champion', 'wombolder', null, 'Quake Marshal', 'legendary', 'nova-vanguard', 5500, null),
  ('shadopus-nova-vanguard', 'champion', 'shadopus', null, 'Deepwatch Oracle', 'legendary', 'nova-vanguard', 5500, null),
  ('pangrove-nova-vanguard', 'champion', 'pangrove', null, 'Briar Bastion', 'legendary', 'nova-vanguard', 5500, null),
  ('mossloth-nova-vanguard', 'champion', 'mossloth', null, 'Cloud Keeper', 'legendary', 'nova-vanguard', 5500, null),
  ('wayfarer-skins', 'bundle', null, null, 'Wayfarer skins', null, 'wayfarer', 0, array['voltkit-wayfarer', 'cindrake-wayfarer', 'tidefin-wayfarer', 'auralynx-wayfarer', 'lumoth-wayfarer', 'mystowl-wayfarer', 'terradon-wayfarer', 'duskveil-wayfarer', 'coilemur-wayfarer', 'pyranda-wayfarer', 'glacelle-wayfarer', 'halcyra-wayfarer', 'sunbara-wayfarer', 'astrabun-wayfarer', 'wombolder-wayfarer', 'shadopus-wayfarer', 'pangrove-wayfarer', 'mossloth-wayfarer']),
  ('moonlit-tea-skins', 'bundle', null, null, 'Moonlit Tea skins', null, 'moonlit-tea', 0, array['voltkit-moonlit-tea', 'cindrake-moonlit-tea', 'tidefin-moonlit-tea', 'auralynx-moonlit-tea', 'lumoth-moonlit-tea', 'mystowl-moonlit-tea', 'terradon-moonlit-tea', 'duskveil-moonlit-tea', 'coilemur-moonlit-tea', 'pyranda-moonlit-tea', 'glacelle-moonlit-tea', 'halcyra-moonlit-tea', 'sunbara-moonlit-tea', 'astrabun-moonlit-tea', 'wombolder-moonlit-tea', 'shadopus-moonlit-tea', 'pangrove-moonlit-tea', 'mossloth-moonlit-tea']),
  ('astral-court-skins', 'bundle', null, null, 'Astral Court skins', null, 'astral-court', 0, array['voltkit-astral-court', 'cindrake-astral-court', 'tidefin-astral-court', 'auralynx-astral-court', 'lumoth-astral-court', 'mystowl-astral-court', 'terradon-astral-court', 'duskveil-astral-court', 'coilemur-astral-court', 'pyranda-astral-court', 'glacelle-astral-court', 'halcyra-astral-court', 'sunbara-astral-court', 'astrabun-astral-court', 'wombolder-astral-court', 'shadopus-astral-court', 'pangrove-astral-court', 'mossloth-astral-court']),
  ('cyber-skins', 'bundle', null, null, 'Cyber Mecha skins', null, 'cyber', 0, array['voltkit-arc-unit', 'cindrake-reactor', 'tidefin-hydro-frame', 'auralynx-prism-mech', 'lumoth-photon', 'mystowl-psi-core', 'terradon-tank-mk2', 'duskveil-phantom-os', 'coilemur-tesla-frame', 'pyranda-afterburner', 'glacelle-cryo-unit', 'halcyra-sniper-drone', 'sunbara-solar-mech', 'astrabun-warp-unit', 'wombolder-bulldozer', 'shadopus-stealth-mk', 'pangrove-scaleroller', 'mossloth-treehugger']),
  ('abyssal-expedition-skins', 'bundle', null, null, 'Abyssal Expedition skins', null, 'abyssal-expedition', 0, array['voltkit-abyssal-expedition', 'cindrake-abyssal-expedition', 'tidefin-abyssal-expedition', 'auralynx-abyssal-expedition', 'lumoth-abyssal-expedition', 'mystowl-abyssal-expedition', 'terradon-abyssal-expedition', 'duskveil-abyssal-expedition', 'coilemur-abyssal-expedition', 'pyranda-abyssal-expedition', 'glacelle-abyssal-expedition', 'halcyra-abyssal-expedition', 'sunbara-abyssal-expedition', 'astrabun-abyssal-expedition', 'wombolder-abyssal-expedition', 'shadopus-abyssal-expedition', 'pangrove-abyssal-expedition', 'mossloth-abyssal-expedition']),
  ('dream-carnival-skins', 'bundle', null, null, 'Dream Carnival skins', null, 'dream-carnival', 0, array['voltkit-dream-carnival', 'cindrake-dream-carnival', 'tidefin-dream-carnival', 'auralynx-dream-carnival', 'lumoth-dream-carnival', 'mystowl-dream-carnival', 'terradon-dream-carnival', 'duskveil-dream-carnival', 'coilemur-dream-carnival', 'pyranda-dream-carnival', 'glacelle-dream-carnival', 'halcyra-dream-carnival', 'sunbara-dream-carnival', 'astrabun-dream-carnival', 'wombolder-dream-carnival', 'shadopus-dream-carnival', 'pangrove-dream-carnival', 'mossloth-dream-carnival']),
  ('nova-vanguard-skins', 'bundle', null, null, 'Nova Vanguard skins', null, 'nova-vanguard', 0, array['voltkit-nova-vanguard', 'cindrake-nova-vanguard', 'tidefin-nova-vanguard', 'auralynx-nova-vanguard', 'lumoth-nova-vanguard', 'mystowl-nova-vanguard', 'terradon-nova-vanguard', 'duskveil-nova-vanguard', 'coilemur-nova-vanguard', 'pyranda-nova-vanguard', 'glacelle-nova-vanguard', 'halcyra-nova-vanguard', 'sunbara-nova-vanguard', 'astrabun-nova-vanguard', 'wombolder-nova-vanguard', 'shadopus-nova-vanguard', 'pangrove-nova-vanguard', 'mossloth-nova-vanguard'])

on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;
