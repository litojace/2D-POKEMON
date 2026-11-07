-- Element Bistro: the six dishes of 100_bistro_long_term.sql get their
-- recipes on the server. Run after 104_bistro_economy_items.sql. Safe to run
-- again.
--
-- arena_bistro_recipe still knew only the first eight dishes. For Sizzling
-- Crepe, Turmeric Noodles, Dill Fish Grill, Caramel Flan, Crab Noodle Soup and
-- the Phoenix Feast it gave null, so a level-up ran into "You need 1 " ||
-- null || "." — a null message, which the action took for success while
-- changing nothing: the client showed the new level, then the server's
-- bistro put it back. The recipes are RECIPES in packages/shared/src/bistro.ts.

begin;

create or replace function public.arena_bistro_recipe(p_dish text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_dish when 'goicuon' then array['rice', 'herbs'] when 'banhmi' then array['flour', 'pork']
    when 'pho' then array['flour', 'herbs'] when 'buncha' then array['flour', 'pork']
    when 'comtam' then array['rice', 'egg'] when 'che' then array['beans', 'coconut']
    when 'caphe' then array['coffee', 'milk'] when 'lau' then array['chili', 'beans']
    when 'banhxeo' then array['rice', 'pork'] when 'miquang' then array['chili', 'egg']
    when 'chaca' then array['herbs', 'chili'] when 'flan' then array['egg', 'milk']
    when 'banhcanh' then array['rice', 'chili'] when 'phoenix' then array['pork', 'coconut'] end
$$;
revoke all on function public.arena_bistro_recipe(text) from public, anon, authenticated, service_role;

commit;

select (select count(*) from public.arena_bistro_dishes where public.arena_bistro_recipe(id) is null) = 0
  as bistro_all_recipes;
