-- Original Nova Vanguard hero costumes. Safe to run again; preserve ownership.
begin;
insert into public.arena_shop_items (id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-nova-vanguard', 'champion', 'voltkit', null, 'Pulse Courier', 'epic', 'nova-vanguard', 3500, null),
  ('cindrake-nova-vanguard', 'champion', 'cindrake', null, 'Solar Forger', 'epic', 'nova-vanguard', 3500, null),
  ('tidefin-nova-vanguard', 'champion', 'tidefin', null, 'Riptide Ranger', 'epic', 'nova-vanguard', 3500, null),
  ('auralynx-nova-vanguard', 'champion', 'auralynx', null, 'Prism Sentinel', 'epic', 'nova-vanguard', 3500, null),
  ('lumoth-nova-vanguard', 'champion', 'lumoth', null, 'Lumen Warden', 'epic', 'nova-vanguard', 3500, null),
  ('mystowl-nova-vanguard', 'champion', 'mystowl', null, 'Night Cartographer', 'epic', 'nova-vanguard', 3500, null),
  ('terradon-nova-vanguard', 'champion', 'terradon', null, 'Bulwark Grove', 'epic', 'nova-vanguard', 3500, null),
  ('duskveil-nova-vanguard', 'champion', 'duskveil', null, 'Echo Beacon', 'epic', 'nova-vanguard', 3500, null),
  ('coilemur-nova-vanguard', 'champion', 'coilemur', null, 'Flux Runner', 'epic', 'nova-vanguard', 3500, null),
  ('pyranda-nova-vanguard', 'champion', 'pyranda', null, 'Cinder Medic', 'epic', 'nova-vanguard', 3500, null),
  ('glacelle-nova-vanguard', 'champion', 'glacelle', null, 'Frost Weaver', 'epic', 'nova-vanguard', 3500, null),
  ('halcyra-nova-vanguard', 'champion', 'halcyra', null, 'Gale Captain', 'epic', 'nova-vanguard', 3500, null),
  ('sunbara-nova-vanguard', 'champion', 'sunbara', null, 'Dawn Defender', 'epic', 'nova-vanguard', 3500, null),
  ('astrabun-nova-vanguard', 'champion', 'astrabun', null, 'Comet Strider', 'epic', 'nova-vanguard', 3500, null),
  ('wombolder-nova-vanguard', 'champion', 'wombolder', null, 'Quake Marshal', 'epic', 'nova-vanguard', 3500, null),
  ('shadopus-nova-vanguard', 'champion', 'shadopus', null, 'Deepwatch Oracle', 'epic', 'nova-vanguard', 3500, null),
  ('pangrove-nova-vanguard', 'champion', 'pangrove', null, 'Briar Bastion', 'epic', 'nova-vanguard', 3500, null),
  ('mossloth-nova-vanguard', 'champion', 'mossloth', null, 'Cloud Keeper', 'epic', 'nova-vanguard', 3500, null)
on conflict (id) do update set kind=excluded.kind, champion=excluded.champion,
 slot=excluded.slot, name=excluded.name, rarity=excluded.rarity,
 collection=excluded.collection, price=excluded.price, items=excluded.items;
commit;
