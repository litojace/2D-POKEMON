-- Admin panel, player tools (apps/client/src/admin-panel.ts). Run after
-- 20261121200000_season_thirty_by_800.sql. Safe to run again.
--
--   - arena_admin_player_status(player): what an admin sees when they open a
--     player's row: their coin balance, whether their chat is stopped (until
--     when, why) and their last coin movements.
--   - arena_admin_adjust_coins(player, amount, reason, ref): an admin adds or
--     takes coins. Taking never goes below 0. `ref` is a fresh id per click,
--     so a retried request never pays twice (arena_grant's ledger is unique
--     per player, reason and ref). Every change is kept in arena_admin_audit.
-- Nothing here changes a table; both functions are admin-only.

begin;

create or replace function public.arena_admin_player_status(p_player uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.arena_require_admin();
  if p_player is null or not exists (select 1 from public.arena_profiles where id = p_player) then
    raise exception 'Player not found';
  end if;
  return jsonb_build_object(
    'balance', coalesce((select balance from public.arena_wallets where player_id = p_player), 0),
    'chatUntil', (select until from public.arena_chat_restrictions
                   where player = p_player and until > now()),
    'chatReason', (select reason from public.arena_chat_restrictions
                    where player = p_player and until > now()),
    'coins', coalesce((select jsonb_agg(jsonb_build_object(
        'amount', l.amount, 'reason', l.reason, 'at', l.created_at) order by l.created_at desc, l.id desc)
      from (select id, amount, reason, created_at from public.arena_coin_ledger
             where player_id = p_player order by created_at desc, id desc limit 8) l), '[]'::jsonb));
end; $$;

create or replace function public.arena_admin_adjust_coins(
  p_player uuid, p_amount integer, p_reason text, p_ref uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_balance integer; v_amount integer; v_reason text = trim(coalesce(p_reason, ''));
begin
  perform public.arena_require_admin();
  if p_player is null or not exists (select 1 from public.arena_profiles where id = p_player) then
    raise exception 'Player not found';
  end if;
  if p_amount is null or p_amount = 0 or p_amount < -100000 or p_amount > 100000 then
    raise exception 'Choose an amount from -100000 to 100000 (not 0)';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 120 then
    raise exception 'Say why, in 3 to 120 characters';
  end if;
  if p_ref is null then raise exception 'Missing request id'; end if;
  insert into public.arena_wallets(player_id, balance) values (p_player, 0) on conflict do nothing;
  -- One change at a time per player: the lock comes before the checks.
  select balance into v_balance from public.arena_wallets where player_id = p_player for update;
  -- The same click again: report the balance, change nothing.
  if exists (select 1 from public.arena_coin_ledger
              where player_id = p_player and reason = 'admin' and ref = p_ref::text) then
    return jsonb_build_object('applied', 0, 'balance', v_balance);
  end if;
  -- Taking coins stops at 0.
  v_amount = greatest(p_amount, -v_balance);
  if v_amount = 0 then
    return jsonb_build_object('applied', 0, 'balance', v_balance);
  end if;
  if not public.arena_grant(p_player, v_amount, 'admin', p_ref::text, public.arena_today()) then
    return jsonb_build_object('applied', 0, 'balance', v_balance);
  end if;
  insert into public.arena_admin_audit(actor_id, action, target_id, details)
  values (auth.uid(), 'adjust_coins', p_player,
    jsonb_build_object('asked', p_amount, 'applied', v_amount, 'reason', v_reason, 'ref', p_ref));
  return jsonb_build_object('applied', v_amount, 'balance', v_balance + v_amount);
end; $$;

revoke all on function public.arena_admin_player_status(uuid),
  public.arena_admin_adjust_coins(uuid, integer, text, uuid) from public, anon;
grant execute on function public.arena_admin_player_status(uuid),
  public.arena_admin_adjust_coins(uuid, integer, text, uuid) to authenticated;

commit;
