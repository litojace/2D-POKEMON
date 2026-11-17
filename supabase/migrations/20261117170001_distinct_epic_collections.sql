-- Two distinct Epic collections for all eighteen champions (36 costumes).
-- Generated from the shared catalog. Safe to rerun; preserves player ownership.
begin;

update public.arena_shop_items set rarity = 'rare', price = 1500 where kind = 'champion' and collection = 'astral-court';
update public.arena_shop_items set active = false where kind = 'champion' and collection = 'clockwork-reverie';

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-abyssal-expedition', 'champion', 'voltkit', null, 'Arc Diver', 'epic', 'abyssal-expedition', 3500, null),
  ('voltkit-dream-carnival', 'champion', 'voltkit', null, 'Harlequin Spark', 'epic', 'dream-carnival', 3500, null),
  ('cindrake-abyssal-expedition', 'champion', 'cindrake', null, 'Thermal Vent', 'epic', 'abyssal-expedition', 3500, null),
  ('cindrake-dream-carnival', 'champion', 'cindrake', null, 'Crimson Fire Dancer', 'epic', 'dream-carnival', 3500, null),
  ('tidefin-abyssal-expedition', 'champion', 'tidefin', null, 'Reef Submariner', 'epic', 'abyssal-expedition', 3500, null),
  ('tidefin-dream-carnival', 'champion', 'tidefin', null, 'Pearl Masquerade', 'epic', 'dream-carnival', 3500, null),
  ('auralynx-abyssal-expedition', 'champion', 'auralynx', null, 'Cryo Naut', 'epic', 'abyssal-expedition', 3500, null),
  ('auralynx-dream-carnival', 'champion', 'auralynx', null, 'Moonlight Acrobat', 'epic', 'dream-carnival', 3500, null),
  ('lumoth-abyssal-expedition', 'champion', 'lumoth', null, 'Abyssal Lantern', 'epic', 'abyssal-expedition', 3500, null),
  ('lumoth-dream-carnival', 'champion', 'lumoth', null, 'Ribbonwing Revue', 'epic', 'dream-carnival', 3500, null),
  ('mystowl-abyssal-expedition', 'champion', 'mystowl', null, 'Sonar Owl', 'epic', 'abyssal-expedition', 3500, null),
  ('mystowl-dream-carnival', 'champion', 'mystowl', null, 'Velvet Ringmaster', 'epic', 'dream-carnival', 3500, null),
  ('terradon-abyssal-expedition', 'champion', 'terradon', null, 'Reef Bastion', 'epic', 'abyssal-expedition', 3500, null),
  ('terradon-dream-carnival', 'champion', 'terradon', null, 'Carousel Keeper', 'epic', 'dream-carnival', 3500, null),
  ('duskveil-abyssal-expedition', 'champion', 'duskveil', null, 'Diving Bell Wisp', 'epic', 'abyssal-expedition', 3500, null),
  ('duskveil-dream-carnival', 'champion', 'duskveil', null, 'Midnight Marionette', 'epic', 'dream-carnival', 3500, null),
  ('coilemur-abyssal-expedition', 'champion', 'coilemur', null, 'Cable Runner', 'epic', 'abyssal-expedition', 3500, null),
  ('coilemur-dream-carnival', 'champion', 'coilemur', null, 'Hoop Trickster', 'epic', 'dream-carnival', 3500, null),
  ('pyranda-abyssal-expedition', 'champion', 'pyranda', null, 'Coral Rescuer', 'epic', 'abyssal-expedition', 3500, null),
  ('pyranda-dream-carnival', 'champion', 'pyranda', null, 'Scarlet Fan Dancer', 'epic', 'dream-carnival', 3500, null),
  ('glacelle-abyssal-expedition', 'champion', 'glacelle', null, 'Bathyal Bell', 'epic', 'abyssal-expedition', 3500, null),
  ('glacelle-dream-carnival', 'champion', 'glacelle', null, 'Glassbell Ballerina', 'epic', 'dream-carnival', 3500, null),
  ('halcyra-abyssal-expedition', 'champion', 'halcyra', null, 'Current Pilot', 'epic', 'abyssal-expedition', 3500, null),
  ('halcyra-dream-carnival', 'champion', 'halcyra', null, 'Opera Skydancer', 'epic', 'dream-carnival', 3500, null),
  ('sunbara-abyssal-expedition', 'champion', 'sunbara', null, 'Buoy Captain', 'epic', 'abyssal-expedition', 3500, null),
  ('sunbara-dream-carnival', 'champion', 'sunbara', null, 'Honey Parade', 'epic', 'dream-carnival', 3500, null),
  ('astrabun-abyssal-expedition', 'champion', 'astrabun', null, 'Lunar Aquanaut', 'epic', 'abyssal-expedition', 3500, null),
  ('astrabun-dream-carnival', 'champion', 'astrabun', null, 'Mochi Harlequin', 'epic', 'dream-carnival', 3500, null),
  ('wombolder-abyssal-expedition', 'champion', 'wombolder', null, 'Trench Miner', 'epic', 'abyssal-expedition', 3500, null),
  ('wombolder-dream-carnival', 'champion', 'wombolder', null, 'Grand Drum Major', 'epic', 'dream-carnival', 3500, null),
  ('shadopus-abyssal-expedition', 'champion', 'shadopus', null, 'Nautilus Captain', 'epic', 'abyssal-expedition', 3500, null),
  ('shadopus-dream-carnival', 'champion', 'shadopus', null, 'Eightfold Jester', 'epic', 'dream-carnival', 3500, null),
  ('pangrove-abyssal-expedition', 'champion', 'pangrove', null, 'Kelp Bulwark', 'epic', 'abyssal-expedition', 3500, null),
  ('pangrove-dream-carnival', 'champion', 'pangrove', null, 'Verdant Masquerader', 'epic', 'dream-carnival', 3500, null),
  ('mossloth-abyssal-expedition', 'champion', 'mossloth', null, 'Coral Keeper', 'epic', 'abyssal-expedition', 3500, null),
  ('mossloth-dream-carnival', 'champion', 'mossloth', null, 'Dreamtime Jester', 'epic', 'dream-carnival', 3500, null)
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;
