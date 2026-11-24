-- American spelling in the Shop: "Candy colors", not "Candy colours".
-- Item ids stay the same (candy-colours…), so nothing owned changes.
begin;

update public.arena_shop_items set name = 'Candy colors' where id = 'candy-colours';
update public.arena_shop_items set name = 'Galaxy colors' where id = 'galaxy-colours';
update public.arena_shop_items set name = 'Retro colors' where id = 'retro-colours';
update public.arena_shop_items set name = 'Festival colors' where id = 'festival-colours';
update public.arena_shop_items set name = 'Spring colors' where id = 'garden-colours';
update public.arena_shop_items set name = 'Frost colors' where id = 'winter-colours';

notify pgrst, 'reload schema';
commit;
