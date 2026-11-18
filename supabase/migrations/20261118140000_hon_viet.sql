-- Hồn Việt: an Epic collection of Vietnamese heritage costumes. Safe to run again; keeps ownership.
--
-- 18 skins, one per champion, each a figure of its own (Trung Thu lanterns,
-- Thánh Gióng, quan họ, Kim Quy, hát bội...), Epic at 3,500 coins, and their
-- full-roster set: like the other sets it costs 80% of the skins you don't
-- own yet (arena_item_price) and buying it grants each skin (arena_buy_item).
-- The rows come from packages/shared/src/shop.ts (scripts/shop-seed.ts);
-- tests/unit/shop-catalog.test.ts checks they match.
begin;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-hon-viet', 'champion', 'voltkit', null, 'Đèn Ông Sao', 'epic', 'hon-viet', 3500, null),
  ('cindrake-hon-viet', 'champion', 'cindrake', null, 'Thánh Gióng', 'epic', 'hon-viet', 3500, null),
  ('tidefin-hon-viet', 'champion', 'tidefin', null, 'Hoa Đăng', 'epic', 'hon-viet', 3500, null),
  ('auralynx-hon-viet', 'champion', 'auralynx', null, 'Võ Sư Vovinam', 'epic', 'hon-viet', 3500, null),
  ('lumoth-hon-viet', 'champion', 'lumoth', null, 'Đèn Lồng Hội An', 'epic', 'hon-viet', 3500, null),
  ('mystowl-hon-viet', 'champion', 'mystowl', null, 'Liền Chị Quan Họ', 'epic', 'hon-viet', 3500, null),
  ('terradon-hon-viet', 'champion', 'terradon', null, 'Kim Quy', 'epic', 'hon-viet', 3500, null),
  ('duskveil-hon-viet', 'champion', 'duskveil', null, 'Đèn Kéo Quân', 'epic', 'hon-viet', 3500, null),
  ('coilemur-hon-viet', 'champion', 'coilemur', null, 'Nghệ Nhân Đàn Bầu', 'epic', 'hon-viet', 3500, null),
  ('pyranda-hon-viet', 'champion', 'pyranda', null, 'Hạt Dẻ Phố Cổ', 'epic', 'hon-viet', 3500, null),
  ('glacelle-hon-viet', 'champion', 'glacelle', null, 'Sương Sa Pa', 'epic', 'hon-viet', 3500, null),
  ('halcyra-hon-viet', 'champion', 'halcyra', null, 'Chim Lạc Đông Sơn', 'epic', 'hon-viet', 3500, null),
  ('sunbara-hon-viet', 'champion', 'sunbara', null, 'Xuân Hoa Mai', 'epic', 'hon-viet', 3500, null),
  ('astrabun-hon-viet', 'champion', 'astrabun', null, 'Thỏ Ngọc Cung Trăng', 'epic', 'hon-viet', 3500, null),
  ('wombolder-hon-viet', 'champion', 'wombolder', null, 'Mùa Lúa Chín', 'epic', 'hon-viet', 3500, null),
  ('shadopus-hon-viet', 'champion', 'shadopus', null, 'Tướng Hát Bội', 'epic', 'hon-viet', 3500, null),
  ('pangrove-hon-viet', 'champion', 'pangrove', null, 'Đầm Sen Đồng Tháp', 'epic', 'hon-viet', 3500, null),
  ('mossloth-hon-viet', 'champion', 'mossloth', null, 'Ông Đồ', 'epic', 'hon-viet', 3500, null),
  ('hon-viet-skins', 'bundle', null, null, 'Hồn Việt skins', null, 'hon-viet', 0, array['voltkit-hon-viet', 'cindrake-hon-viet', 'tidefin-hon-viet', 'auralynx-hon-viet', 'lumoth-hon-viet', 'mystowl-hon-viet', 'terradon-hon-viet', 'duskveil-hon-viet', 'coilemur-hon-viet', 'pyranda-hon-viet', 'glacelle-hon-viet', 'halcyra-hon-viet', 'sunbara-hon-viet', 'astrabun-hon-viet', 'wombolder-hon-viet', 'shadopus-hon-viet', 'pangrove-hon-viet', 'mossloth-hon-viet'])

on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;
