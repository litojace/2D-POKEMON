-- Eighteen champions: the Nature element's Pangrove (a leaf-scaled pangolin)
-- and Mossloth (a sloth with a moss garden on its back) join the roster
-- everywhere SQL names the champions. Run after 069. Without it, choosing one
-- of them as your portrait, or playing one (your Lobby fighter is your
-- farmer), is refused.
--
--  * arena_champion_ids(): the roster in one place (functions check it).
--  * Portrait champion and farmer: the checks.
--  * Farm orders: the two new champions place orders too (as in 052, with
--    eighteen places and faces).
--  * Farm perks: Nature has no original champion, so each farms with the
--    perk that suits it: Pangrove hunts bugs (Duskveil's Night Stalker),
--    Mossloth grows crops faster (Lumoth's Early Sun). arena_farm_perk_of is
--    the one place every perk check reads (055); FARM_PERK_OF in
--    packages/shared/src/farm.ts is the same map for the client.
--  * Shop: their 7 skins each (3 Common, 2 Rare, 1 Epic, 1 Mythical). The
--    rows are printed from packages/shared/src/shop.ts by
--      node --experimental-strip-types scripts/print-shop-seed.ts
--    and tests/unit/shop-catalog.test.ts checks they still match. The Rares
--    and Epics join the Garden, Festival and Winter collections and the
--    Mythicals join Celestial, so those collections' free frames now need
--    these skins too; anyone who already earned a frame keeps it.
begin;

create or replace function public.arena_champion_ids() returns text[]
language sql immutable set search_path = '' as $$
  select array['voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil','coilemur','pyranda','glacelle','halcyra','sunbara','astrabun','wombolder','shadopus','pangrove','mossloth']::text[]
$$;

alter table public.arena_profiles drop constraint if exists arena_profiles_portrait_character_check;
alter table public.arena_profiles add constraint arena_profiles_portrait_character_check
  check (portrait_character in ('voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil','coilemur','pyranda','glacelle','halcyra','sunbara','astrabun','wombolder','shadopus','pangrove','mossloth'));
alter table public.arena_farms drop constraint if exists arena_farms_farmer_check;
alter table public.arena_farms add constraint arena_farms_farmer_check
  check (farmer in ('voltkit','cindrake','tidefin','auralynx','lumoth','mystowl','terradon','duskveil','coilemur','pyranda','glacelle','halcyra','sunbara','astrabun','wombolder','shadopus','pangrove','mossloth'));

-- As in 052, with eighteen places and faces.
create or replace function public.arena_farm_new_order(pid uuid, p_slot integer, p_level integer) returns void
language plpgsql security definer set search_path = public as $$
declare pool text[]; kinds integer; used text[] = '{}'; pick text; c public.arena_farm_crops;
  items jsonb = '[]'::jsonb; n integer; val integer = 0; v_xp integer = 0; r integer;
begin
  pool = array(select id from public.arena_farm_crops where level <= greatest(1, p_level) order by level, id);
  kinds = 1 + floor(random() * least(3, array_length(pool, 1)))::integer;
  for k in 1..kinds loop
    loop
      pick = pool[1 + floor(random() * array_length(pool, 1))::integer];
      exit when not pick = any(used);
    end loop;
    used = used || pick;
    select * into c from public.arena_farm_crops where id = pick;
    n = 2 + floor(random() * (case when c.level > 4 then 4 else 7 end))::integer;
    items = items || jsonb_build_array(jsonb_build_array(c.id, n));
    val = val + c.sell * n;
    v_xp = v_xp + c.xp * n;
  end loop;
  r = 1 + floor(random() * 18)::integer;
  insert into public.arena_farm_orders(player_id, slot, items, leaves, xp, bonus, who, face, wait_until)
  values (pid, p_slot, items, (round(val * 1.45 / 5) * 5)::integer, v_xp,
    case when random() < 0.3 then (array['super', 'gold', 'norm'])[1 + floor(random() * 3)::integer] end,
    (array['Volt Boba Truck', 'Raid Hall', 'Cindrake''s Forge', 'Mystowl''s Library',
      'Tidefin''s Kitchen', 'Lumoth''s Shrine', 'Terradon''s Quarry', 'Shadow Guild',
      'Coilemur''s Coil Shop', 'Pyranda''s Chestnut Cart', 'Glacelle''s Ice Parlour', 'Halcyra''s Lookout',
      'Sunbara''s Hot Spring', 'Astrabun''s Mochi Bakery', 'Wombolder''s Burrow', 'Shadopus''s Ink Den',
      'Pangrove''s Ant Hill', 'Mossloth''s Moss Garden'])[r],
    (array['voltkit', 'auralynx', 'cindrake', 'mystowl', 'tidefin', 'lumoth', 'terradon', 'duskveil',
      'coilemur', 'pyranda', 'glacelle', 'halcyra', 'sunbara', 'astrabun', 'wombolder', 'shadopus',
      'pangrove', 'mossloth'])[r],
    null)
  on conflict (player_id, slot) do update set items = excluded.items, leaves = excluded.leaves,
    xp = excluded.xp, bonus = excluded.bonus, who = excluded.who, face = excluded.face, wait_until = null;
end; $$;
revoke all on function public.arena_farm_new_order(uuid, integer, integer) from public, anon, authenticated, service_role;

-- As in 055, with the two Nature champions.
create or replace function public.arena_farm_perk_of(p_farmer text) returns text
language sql immutable set search_path = '' as $$
  select case p_farmer
    when 'coilemur' then 'voltkit'
    when 'pyranda' then 'cindrake'
    when 'glacelle' then 'tidefin'
    when 'halcyra' then 'auralynx'
    when 'sunbara' then 'lumoth'
    when 'astrabun' then 'mystowl'
    when 'wombolder' then 'terradon'
    when 'shadopus' then 'duskveil'
    when 'pangrove' then 'duskveil'
    when 'mossloth' then 'lumoth'
    else p_farmer
  end
$$;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('pangrove-autumn', 'champion', 'pangrove', null, 'Autumn', 'common', null, 500, null),
  ('pangrove-frostleaf', 'champion', 'pangrove', null, 'Frostleaf', 'common', null, 500, null),
  ('pangrove-jade', 'champion', 'pangrove', null, 'Jade', 'common', null, 500, null),
  ('pangrove-blossom', 'champion', 'pangrove', null, 'Blossom', 'rare', 'garden', 1500, null),
  ('pangrove-lantern-night', 'champion', 'pangrove', null, 'Lantern Night', 'rare', 'festival', 1500, null),
  ('pangrove-golden-sap', 'champion', 'pangrove', null, 'Golden Sap', 'epic', 'garden', 3500, null),
  ('pangrove-evergrove', 'champion', 'pangrove', null, 'Evergrove', 'mythical', 'celestial', 8000, null),
  ('mossloth-cinnamon', 'champion', 'mossloth', null, 'Cinnamon', 'common', null, 500, null),
  ('mossloth-snowy', 'champion', 'mossloth', null, 'Snowy', 'common', null, 500, null),
  ('mossloth-dusk', 'champion', 'mossloth', null, 'Dusk', 'common', null, 500, null),
  ('mossloth-acorn-nap', 'champion', 'mossloth', null, 'Acorn Nap', 'rare', 'garden', 1500, null),
  ('mossloth-cozy-knit', 'champion', 'mossloth', null, 'Cozy Knit', 'rare', 'winter', 1500, null),
  ('mossloth-bonsai-keeper', 'champion', 'mossloth', null, 'Bonsai Keeper', 'epic', 'garden', 3500, null),
  ('mossloth-moonbloom', 'champion', 'mossloth', null, 'Moonbloom', 'mythical', 'celestial', 8000, null)
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;
