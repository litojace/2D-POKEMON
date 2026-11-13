-- Players delete their own account from the player card. The App Store
-- asks every app that lets people make an account to let them delete it
-- inside the app (App Review Guideline 5.1.1(v)).
-- Run after 108_selected_fighter.sql. Safe to run again.
--
-- Deleting the login (auth.users) removes everything the player owns:
-- every table that keeps a player's data points at auth.users or at
-- arena_profiles with "on delete cascade", and the few shared records
-- (reports they sent, raids and matches others played with them) keep
-- their row with "on delete set null" or lose only this player's line.
-- tests/integration/delete-my-account.test.ts checks every such key.
--
-- Shared records also keep a copy of who played in JSON: a match summary
-- has each player's account id and name, a raid receipt each account id.
-- Other players keep those matches and raids, so this player's entries
-- are rewritten as "Deleted player" with no account id.
--
-- A friend who helped in someone's bistro (arena_bistro_staff.friend_id)
-- is let go by that bistro's own catch-up once the friendship is gone,
-- which also picks a free creature if theirs is taken.
--
-- Administrators are refused here, as in arena_admin_delete_player: their
-- audit entries point at their login, and an admin removing themselves by
-- accident would lock the dashboard. Removing an admin is done in SQL.
-- No audit entry is written: it would point at the login being deleted.
begin;

create or replace function public.arena_forget_player_in(p_players jsonb, p_key text, p_id uuid)
returns jsonb language sql immutable set search_path='' as $$
  select coalesce(jsonb_agg(
    case when x.v->>p_key = p_id::text
      then case when x.v ? 'name'
        then x.v || jsonb_build_object(p_key, null, 'name', 'Deleted player')
        else x.v || jsonb_build_object(p_key, null) end
      else x.v end
    order by x.i), '[]'::jsonb)
  from jsonb_array_elements(p_players) with ordinality as x(v, i)
$$;

create or replace function public.arena_delete_my_account() returns void
language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid();
begin
 if me is null then raise exception 'Please log in first.'; end if;
 if exists(select 1 from public.arena_admins where user_id=me) then
   raise exception 'Administrators cannot delete their own account here.';
 end if;
 update public.arena_matches set summary = jsonb_set(summary, '{players}',
     public.arena_forget_player_in(summary->'players', 'account', me))
  where summary->'players' @> jsonb_build_array(jsonb_build_object('account', me::text));
 update public.arena_match_reports set summary = jsonb_set(summary, '{players}',
     public.arena_forget_player_in(summary->'players', 'account', me))
  where summary->'players' @> jsonb_build_array(jsonb_build_object('account', me::text));
 update public.arena_raid_runs set receipt = jsonb_set(receipt, '{players}',
     public.arena_forget_player_in(receipt->'players', 'accountId', me))
  where receipt->'players' @> jsonb_build_array(jsonb_build_object('accountId', me::text));
 delete from public.arena_profiles where id=me;
 delete from auth.users where id=me;
end; $$;

revoke all on function public.arena_forget_player_in(jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.arena_delete_my_account() from public, anon, authenticated;
grant execute on function public.arena_delete_my_account() to authenticated;
commit;
notify pgrst, 'reload schema';
