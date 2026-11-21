-- Plaza daily quests: an even 100 shop coins a day in all (owner's decision,
-- 21 Nov 2026), "Catch 10 fish" 30. Weighted by the effort each takes
-- (docs/plaza-economy.md has the reasoning and the comparison with the
-- Lobby's daily missions):
--   goal   20 -> 15  (a goal against the pitch's bots: a minute or two)
--   lap    20 -> 20  (a lap under 30 s over the hurdles: skill, a few tries)
--   cheers 15 -> 10  (15 cheers on the runway: under ten seconds standing)
--   orbs   15 -> 20  (10 orbs in one Orb Shower: up to 15 minutes' wait)
--   photo  10 ->  5  (one tap at the Photo Spot)
--   fish   25 -> 30  (10 catches, each won in a fight: about five minutes)
-- Before: 105 a day. Must match PLAZA_QUESTS in packages/shared/src/plaza.ts
-- (tests/integration/plaza-rewards.test.ts, remove-farm-bistro-leaves.test.ts).
-- Same signature, so create or replace keeps it in place and the migration is
-- safe to run again. Quests already paid today stay paid at the old amount
-- (arena_plaza_days.paid); the next one pays the new amount.
create or replace function public.arena_plaza_quests() returns table(id text, needed integer, coins integer)
language sql immutable set search_path = public as $$
  values ('goal', 1, 15), ('lap', 1, 20), ('cheers', 15, 10), ('orbs', 10, 20), ('photo', 1, 5), ('fish', 10, 30)
$$;
revoke all on function public.arena_plaza_quests() from public, anon, authenticated, service_role;
