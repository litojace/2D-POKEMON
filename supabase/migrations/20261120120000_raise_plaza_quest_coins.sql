-- Raise the Plaza's daily quest rewards (owner's decision, Nov 2026): the
-- five quests paid 8 shop coins a day in all, next to 40 for one easy daily
-- mission. They now pay 80 a day, the harder ones more:
--   goal 2 -> 20, lap 2 -> 20, cheers 2 -> 15, orbs 1 -> 15, photo 1 -> 10.
-- Must match PLAZA_QUESTS in packages/shared/src/plaza.ts (checked by
-- tests/integration/plaza-rewards.test.ts and remove-farm-bistro-leaves.test.ts).
-- Same signature as before, so create or replace keeps it in place and the
-- migration is safe to run again. Quests already paid today stay paid at the
-- old rate (arena_plaza_days.paid); the next one pays the new amount.
create or replace function public.arena_plaza_quests() returns table(id text, needed integer, coins integer)
language sql immutable set search_path = public as $$
  values ('goal', 1, 20), ('lap', 1, 20), ('cheers', 15, 15), ('orbs', 10, 15), ('photo', 1, 10)
$$;
revoke all on function public.arena_plaza_quests() from public, anon, authenticated, service_role;
