-- The Plaza's wishing fountain: treats thrown at the fountain fill a shared
-- meter per Plaza copy (the game server keeps it in memory). A full meter
-- sets off fireworks and pays each player who wished in that fill a few shop
-- coins, once per fill and at most a few fills a Pacific day.
-- Must match PLAZA_WISH (coins, perDay) in packages/shared/src/plaza.ts
-- (checked by tests/integration/plaza-wish.test.ts).
--
-- p: {"player": "<account uuid>", "ref": "<the fill's uuid>"}. Only the game
-- server calls it (service role). The coin ledger's unique
-- (player_id, reason, ref) makes a retried call pay nothing more; the
-- player's arena_plaza_days row is locked first (as arena_plaza_record does),
-- so two fills at once can't both slip under the daily cap.
--
-- A new function only (no table, no change to an existing function), made
-- with create or replace: safe to run again.
create or replace function public.arena_plaza_wish(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pid uuid; v_ref text = p->>'ref'; d date = public.arena_today();
  v_coins constant integer = 15; v_cap constant integer = 2; n integer;
begin
  begin pid = (p->>'player')::uuid; exception when others then raise exception 'Bad player'; end;
  if pid is null or not exists (select 1 from public.arena_profiles where id = pid and not suspended) then
    return null;
  end if;
  if v_ref is null or v_ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Bad wish';
  end if;
  insert into public.arena_plaza_days(player_id, day) values (pid, d) on conflict do nothing;
  perform 1 from public.arena_plaza_days where player_id = pid and day = d for update;
  select count(*) into n from public.arena_coin_ledger
   where player_id = pid and day = d and reason = 'plaza-wish';
  if n >= v_cap or exists (select 1 from public.arena_coin_ledger
      where player_id = pid and reason = 'plaza-wish' and ref = v_ref) then
    return jsonb_build_object('paid', false, 'coins', 0, 'today', n);
  end if;
  -- arena_grant is false when the ledger already has this (reason, ref).
  if not public.arena_grant(pid, v_coins, 'plaza-wish', v_ref, d) then
    return jsonb_build_object('paid', false, 'coins', 0, 'today', n);
  end if;
  return jsonb_build_object('paid', true, 'coins', v_coins, 'today', n + 1);
end; $$;
revoke all on function public.arena_plaza_wish(jsonb) from public, anon, authenticated;
grant execute on function public.arena_plaza_wish(jsonb) to service_role;
