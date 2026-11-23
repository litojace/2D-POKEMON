-- Admin announcements as phone and browser notifications (apps/server/src/
-- push.ts AnnouncementPush). Run after 20261122120000_admin_announcements.sql.
-- Safe to run again.
--
-- A device that turned on notifications (the chat's gear,
-- 20261116100000_push_subscriptions.sql) also gets the admins' announcements
-- when an admin ticks "Also send as a notification", unless its player turned
-- "Game news" off in the same gear.
--   - arena_push_subscriptions.news: whether this device wants game news;
--   - arena_push_set_news(player, endpoint, on): the game server sets it for
--     the player's own device;
--   - arena_push_news_page(after, limit): the devices to notify, a page at a
--     time in endpoint order (suspended players left out);
--   - arena_push_news_count(): how many devices an announcement would reach.
-- All are the game server's calls (service role only).

begin;

alter table public.arena_push_subscriptions
  add column if not exists news boolean not null default true;

create or replace function public.arena_push_set_news(p_player uuid, p_endpoint text, p_news boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.arena_push_subscriptions set news = coalesce(p_news, true)
   where endpoint = p_endpoint and player = p_player;
  return found;
end; $$;

create or replace function public.arena_push_news_page(p_after text, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth) order by s.endpoint), '[]'::jsonb)
  from (select d.endpoint, d.p256dh, d.auth
          from public.arena_push_subscriptions d
          join public.arena_profiles p on p.id = d.player and not p.suspended
         where d.news and d.endpoint > coalesce(p_after, '')
         order by d.endpoint
         limit least(greatest(coalesce(p_limit, 500), 1), 1000)) s;
$$;

create or replace function public.arena_push_news_count()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.arena_push_subscriptions d
    join public.arena_profiles p on p.id = d.player and not p.suspended
   where d.news;
$$;

revoke all on function public.arena_push_set_news(uuid, text, boolean),
  public.arena_push_news_page(text, integer),
  public.arena_push_news_count() from public, anon, authenticated;
grant execute on function public.arena_push_set_news(uuid, text, boolean),
  public.arena_push_news_page(text, integer),
  public.arena_push_news_count() to service_role;

commit;
notify pgrst, 'reload schema';
