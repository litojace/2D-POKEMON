-- Admin panel: announcements to every player, and when each player was last
-- online (apps/client/src/admin-panel.ts). Run after
-- 20261122100000_admin_player_tools.sql. Safe to run again.
--
--   - arena_announcements: a short message an admin sends to everyone, shown
--     until it ends (1 hour to 7 days, or ended early by an admin).
--   - arena_admin_announce / arena_admin_end_announcement /
--     arena_admin_announcements: send, end early, list the latest (admins).
--   - arena_current_announcements: the ones still running, for any signed-in
--     player (the game shows each once per device).
--   - arena_admin_player_list(search, offset, sort): the admin player list
--     with lastOnline (arena_profiles.last_online_at, migration 027), newest
--     accounts first or most recently online first. arena_admin_players stays
--     as it was for an older server.

begin;

create table if not exists public.arena_announcements (
  id bigint generated always as identity primary key,
  message text not null check (char_length(message) between 3 and 300),
  tone text not null default 'info' check (tone in ('info', 'event', 'warning')),
  created_by uuid references public.arena_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  ends_at timestamptz not null
);
create index if not exists arena_announcements_ends on public.arena_announcements(ends_at desc);
alter table public.arena_announcements enable row level security;
revoke all on public.arena_announcements from anon, authenticated;

create or replace function public.arena_announcement_json(a public.arena_announcements)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'message', a.message, 'tone', a.tone,
    'createdAt', a.created_at, 'endsAt', a.ends_at);
$$;

create or replace function public.arena_admin_announce(p_message text, p_tone text, p_hours integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_message text = trim(coalesce(p_message, '')); v_row public.arena_announcements;
begin
  perform public.arena_require_admin();
  if char_length(v_message) < 3 or char_length(v_message) > 300 then
    raise exception 'Write 3 to 300 characters';
  end if;
  if p_tone is null or p_tone not in ('info', 'event', 'warning') then
    raise exception 'Choose info, event or warning';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 168 then
    raise exception 'Choose 1 to 168 hours';
  end if;
  insert into public.arena_announcements(message, tone, created_by, ends_at)
  values (v_message, p_tone, auth.uid(), now() + make_interval(hours => p_hours))
  returning * into v_row;
  insert into public.arena_admin_audit(actor_id, action, target_id, details)
  values (auth.uid(), 'announce', null,
    jsonb_build_object('id', v_row.id, 'message', v_message, 'tone', p_tone, 'hours', p_hours));
  return public.arena_announcement_json(v_row);
end; $$;

create or replace function public.arena_admin_end_announcement(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.arena_require_admin();
  update public.arena_announcements set ends_at = least(ends_at, now()) where id = p_id;
  if not found then raise exception 'Announcement not found'; end if;
  insert into public.arena_admin_audit(actor_id, action, target_id, details)
  values (auth.uid(), 'end_announcement', null, jsonb_build_object('id', p_id));
end; $$;

create or replace function public.arena_admin_announcements()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.arena_require_admin();
  return coalesce((select jsonb_agg(public.arena_announcement_json(a)
      || jsonb_build_object('by', p.display_name) order by a.created_at desc, a.id desc)
    from (select * from public.arena_announcements order by created_at desc, id desc limit 20) a
    left join public.arena_profiles p on p.id = a.created_by), '[]'::jsonb);
end; $$;

create or replace function public.arena_current_announcements()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.arena_require_player();
  return coalesce((select jsonb_agg(public.arena_announcement_json(a) order by a.created_at desc, a.id desc)
    from (select * from public.arena_announcements where ends_at > now()
           order by created_at desc, id desc limit 3) a), '[]'::jsonb);
end; $$;

create or replace function public.arena_admin_player_list(p_search text, p_offset integer, p_sort text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text = coalesce(p_search, '');
begin
  perform public.arena_require_admin();
  if p_offset is null or p_offset < 0 or p_offset > 100000 or char_length(v_search) > 80
     or p_sort is null or p_sort not in ('new', 'online') then
    raise exception 'Invalid search';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.arena_profiles p
               where p.display_name ilike '%' || v_search || '%' or p.id::text = v_search),
    'players', coalesce((select jsonb_agg(rowdata order by n) from (
      select row_number() over (order by
          case when p_sort = 'online' then p.last_online_at end desc nulls last,
          p.created_at desc, p.id) as n, jsonb_build_object(
        'id', p.id, 'displayName', p.display_name, 'suspended', p.suspended,
        'isAdmin', exists (select 1 from public.arena_admins a where a.user_id = p.id),
        'title', t.name, 'createdAt', p.created_at, 'lastOnline', p.last_online_at,
        'titleIds', coalesce((select jsonb_agg(g.title_id) from public.arena_player_titles g
                               where g.player_id = p.id), '[]'::jsonb)) as rowdata
      from public.arena_profiles p
      left join public.arena_titles t on t.id = p.equipped_title and t.active
      where p.display_name ilike '%' || v_search || '%' or p.id::text = v_search
      order by
        case when p_sort = 'online' then p.last_online_at end desc nulls last,
        p.created_at desc, p.id
      limit 50 offset p_offset) rows), '[]'::jsonb));
end; $$;

revoke all on function public.arena_announcement_json(public.arena_announcements),
  public.arena_admin_announce(text, text, integer),
  public.arena_admin_end_announcement(bigint),
  public.arena_admin_announcements(),
  public.arena_current_announcements(),
  public.arena_admin_player_list(text, integer, text) from public, anon;
revoke all on function public.arena_announcement_json(public.arena_announcements) from authenticated;
grant execute on function public.arena_admin_announce(text, text, integer),
  public.arena_admin_end_announcement(bigint),
  public.arena_admin_announcements(),
  public.arena_current_announcements(),
  public.arena_admin_player_list(text, integer, text) to authenticated;

commit;
