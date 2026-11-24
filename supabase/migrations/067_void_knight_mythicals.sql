-- The Void Knight Mythicals replace the Celestial set (design §10.6).
-- Every champion's Mythical becomes a Void Knight: the same skin id, so
-- anyone who owns one keeps it, its Awakening progress and the look they
-- have equipped. Only the shop name and the collection change; the art is
-- client-side. The Celestial collection had no frame, and Void Knight has
-- none yet, so the collection bonus is unaffected.
--
-- The names are printed from packages/shared/src/shop.ts, and
-- tests/unit/shop-catalog.test.ts checks they still match.
begin;

update public.arena_shop_items set name = 'Storm Revenant', collection = 'void' where id = 'voltkit-stormcrown';
update public.arena_shop_items set name = 'Hellforge', collection = 'void' where id = 'cindrake-sunforged';
update public.arena_shop_items set name = 'Abyssal Reaver', collection = 'void' where id = 'tidefin-moontide';
update public.arena_shop_items set name = 'Spectral Warden', collection = 'void' where id = 'auralynx-celestial-sage';
update public.arena_shop_items set name = 'Fallen Lightbringer', collection = 'void' where id = 'lumoth-starweaver';
update public.arena_shop_items set name = 'Void Inquisitor', collection = 'void' where id = 'mystowl-oracle';
update public.arena_shop_items set name = 'Obsidian Bulwark', collection = 'void' where id = 'terradon-world-shell';
update public.arena_shop_items set name = 'Crimson Sovereign', collection = 'void' where id = 'duskveil-eclipse';
update public.arena_shop_items set name = 'Volt Executioner', collection = 'void' where id = 'coilemur-cometcaller';
update public.arena_shop_items set name = 'Ashen Warlord', collection = 'void' where id = 'pyranda-harvest-moon';
update public.arena_shop_items set name = 'Rimebane', collection = 'void' where id = 'glacelle-polaris';
update public.arena_shop_items set name = 'Nightfeather', collection = 'void' where id = 'halcyra-starfletch';
update public.arena_shop_items set name = 'Eclipse Templar', collection = 'void' where id = 'sunbara-daybreak';
update public.arena_shop_items set name = 'Rift Duelist', collection = 'void' where id = 'astrabun-full-moon';
update public.arena_shop_items set name = 'Iron Juggernaut', collection = 'void' where id = 'wombolder-saturnine';
update public.arena_shop_items set name = 'Abyss Stalker', collection = 'void' where id = 'shadopus-nebula';

commit;
