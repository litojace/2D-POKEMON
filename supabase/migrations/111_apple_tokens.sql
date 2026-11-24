-- Sign in with Apple tokens, so deleting an account can revoke them.
-- Run after 110_blocks_and_name_filter.sql. Safe to run again.
--
-- Apple asks apps that offer Sign in with Apple to revoke the player's
-- tokens when they delete their account (Apple's TN3194). Revoking needs
-- Apple's refresh token, which Supabase doesn't keep. When a player signs
-- in with Apple in the iPhone app, the game server trades the one-time
-- authorization code for that refresh token and keeps it here; deleting
-- the account revokes it first (apps/server/src/apple.ts), then the row
-- goes with the profile.
--
-- Only the game server's service key reads or writes these rows: players
-- can't, not even their own (row-level security on, no policies, and the
-- functions are granted to service_role only).
begin;

create table if not exists public.arena_apple_tokens (
 player_id uuid primary key references public.arena_profiles(id) on delete cascade,
 -- Apple's id for the player (the identity token's "sub").
 apple_sub text not null check (char_length(apple_sub) between 1 and 255),
 -- The app's bundle ID the token was issued to (revoking needs the same).
 client_id text not null check (char_length(client_id) between 1 and 255),
 refresh_token text not null check (char_length(refresh_token) between 1 and 2000),
 updated_at timestamptz not null default now()
);
alter table public.arena_apple_tokens enable row level security;
revoke all on public.arena_apple_tokens from anon, authenticated;

create or replace function public.arena_apple_token_save(
 p_player uuid, p_sub text, p_client text, p_token text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.arena_profiles where id = p_player) then
  raise exception 'Player not found'; end if;
 insert into public.arena_apple_tokens(player_id, apple_sub, client_id, refresh_token, updated_at)
  values(p_player, p_sub, p_client, p_token, now())
  on conflict (player_id) do update set apple_sub = excluded.apple_sub,
   client_id = excluded.client_id, refresh_token = excluded.refresh_token, updated_at = now();
end; $$;

create or replace function public.arena_apple_token_of(p_player uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('sub', apple_sub, 'clientId', client_id, 'refreshToken', refresh_token)
 from public.arena_apple_tokens where player_id = p_player
$$;

revoke all on function public.arena_apple_token_save(uuid, text, text, text),
 public.arena_apple_token_of(uuid) from public, anon, authenticated;
grant execute on function public.arena_apple_token_save(uuid, text, text, text),
 public.arena_apple_token_of(uuid) to service_role;
commit;
notify pgrst, 'reload schema';
