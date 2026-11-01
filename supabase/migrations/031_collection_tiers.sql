-- Collection tiers: pricier, rarer pieces get grander effects.
-- Candy, Garden and Retro stay the standard sets. Winter and Festival become
-- premium (Epic pieces at about 1.6x the price, Colours Rare). Galaxy becomes
-- the showcase set (Mythical pieces at 2.5x, Colours Epic). Pieces already
-- bought stay owned; only future prices change.
begin;

update public.arena_shop_items set rarity = 'epic', price = 750 where id = 'galaxy-colours';
update public.arena_shop_items set rarity = 'mythical', price = 2250 where id = 'galaxy-aura';
update public.arena_shop_items set rarity = 'mythical', price = 2500 where id = 'galaxy-entrance';
update public.arena_shop_items set rarity = 'mythical', price = 2000 where id = 'galaxy-frame';
update public.arena_shop_items set rarity = 'mythical', price = 4500 where id = 'galaxy-victory';
update public.arena_shop_items set rarity = 'rare', price = 480 where id = 'festival-colours';
update public.arena_shop_items set rarity = 'epic', price = 1440 where id = 'festival-aura';
update public.arena_shop_items set rarity = 'epic', price = 1600 where id = 'festival-entrance';
update public.arena_shop_items set rarity = 'epic', price = 1280 where id = 'festival-frame';
update public.arena_shop_items set rarity = 'epic', price = 2880 where id = 'festival-victory';
update public.arena_shop_items set rarity = 'rare', price = 480 where id = 'winter-colours';
update public.arena_shop_items set rarity = 'epic', price = 1440 where id = 'winter-aura';
update public.arena_shop_items set rarity = 'epic', price = 1600 where id = 'winter-entrance';
update public.arena_shop_items set rarity = 'epic', price = 1280 where id = 'winter-frame';
update public.arena_shop_items set rarity = 'epic', price = 2880 where id = 'winter-victory';

notify pgrst, 'reload schema';
commit;
