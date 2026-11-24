-- Phone and browser notifications for friends' messages (docs/chat-plan.md).
-- Run after 20261115230000_chat_friend_messages.sql. Safe to run again.
--
-- A player who turns on "Notify me" in the chat's gear gives their browser's
-- push subscription (Web Push: an endpoint at their browser's push service
-- and its two public keys). The game server keeps it and, when a friend
-- messages them while they're away, sends a notification that says who it's
-- from (never what it says).
--   - arena_push_subscriptions: one row per device, at most 10 per player;
--   - arena_push_save / arena_push_remove / arena_push_list: the game
--     server's calls (service role only). Deleting the account deletes them.

begin;

create table if not exists public.arena_push_subscriptions (
  endpoint text primary key check (char_length(endpoint) between 10 and 1000),
  player uuid not null references public.arena_profiles(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 4 and 100),
  created_at timestamptz not null default now(),
  used_at timestamptz not null default now()
);
create index if not exists arena_push_subscriptions_player
  on public.arena_push_subscriptions (player, used_at desc);
alter table public.arena_push_subscriptions enable row level security;
revoke all on public.arena_push_subscriptions from anon, authenticated;

-- Keep a device's subscription for a player (a device moves to whoever
-- turned it on last); a player keeps their 10 most recent devices.
create or replace function public.arena_push_save(p_player uuid, p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.arena_push_subscriptions(endpoint, player, p256dh, auth)
 values (p_endpoint, p_player, p_p256dh, p_auth)
 on conflict (endpoint) do update set player = excluded.player,
   p256dh = excluded.p256dh, auth = excluded.auth, used_at = now();
 delete from public.arena_push_subscriptions
  where player = p_player and endpoint in (
   select endpoint from public.arena_push_subscriptions where player = p_player
    order by used_at desc offset 10);
end; $$;

-- Forget a device (turned off, or its push service says it's gone).
create or replace function public.arena_push_remove(p_endpoint text)
returns void language sql security definer set search_path='' as $$
 delete from public.arena_push_subscriptions where endpoint = p_endpoint;
$$;

-- A player's devices, to notify.
create or replace function public.arena_push_list(p_player uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'endpoint', endpoint, 'p256dh', p256dh, 'auth', auth) order by used_at desc), '[]'::jsonb)
 from public.arena_push_subscriptions where player = p_player;
$$;

revoke all on function public.arena_push_save(uuid, text, text, text),
 public.arena_push_remove(text), public.arena_push_list(uuid)
 from public, anon, authenticated;
grant execute on function public.arena_push_save(uuid, text, text, text),
 public.arena_push_remove(text), public.arena_push_list(uuid) to service_role;
commit;
notify pgrst, 'reload schema';
