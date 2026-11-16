-- In-game chat: messages between friends (docs/chat-plan.md, step 7).
-- Run after 20261115200000_chat_restrictions.sql. Safe to run again.
--
-- The owner chose (15 Nov 2026) what suits the game best: a friend's
-- messages stay so you can read back, the last 200 per pair of friends,
-- for as long as both accounts exist (deleting either account deletes
-- them). Party, room and Nearby chat are still not stored.
--   - arena_chat_dms: the messages (filtered text, or a quick-chat id);
--   - arena_chat_dm_reads: how far each player has read each friend;
--   - arena_dm_save / arena_dm_history / arena_dm_unread / arena_dm_read:
--     the game server's calls (service role only). Saving checks the two
--     are friends and trims the pair to its last 200.
-- Until this runs, friends can still message while both are online; the
-- messages just aren't kept.

begin;

create table if not exists public.arena_chat_dms (
  id bigint generated always as identity primary key,
  a uuid not null references public.arena_profiles(id) on delete cascade,
  b uuid not null references public.arena_profiles(id) on delete cascade,
  sender uuid not null references public.arena_profiles(id) on delete cascade,
  body text check (body is null or char_length(body) <= 160),
  quick text check (quick is null or char_length(quick) <= 24),
  created_at timestamptz not null default now(),
  check (a < b),
  check (sender = a or sender = b),
  check ((body is null) <> (quick is null))
);
create index if not exists arena_chat_dms_pair on public.arena_chat_dms (a, b, id desc);
alter table public.arena_chat_dms enable row level security;
revoke all on public.arena_chat_dms from anon, authenticated;

create table if not exists public.arena_chat_dm_reads (
  reader uuid not null references public.arena_profiles(id) on delete cascade,
  friend uuid not null references public.arena_profiles(id) on delete cascade,
  last_read bigint not null default 0,
  primary key (reader, friend)
);
alter table public.arena_chat_dm_reads enable row level security;
revoke all on public.arena_chat_dm_reads from anon, authenticated;

-- Keep one message between two friends; returns its id.
create or replace function public.arena_dm_save(p_from uuid, p_to uuid, p_body text, p_quick text)
returns bigint language plpgsql security definer set search_path='' as $$
declare lo uuid := least(p_from, p_to); hi uuid := greatest(p_from, p_to); new_id bigint;
begin
 if p_from is null or p_to is null or p_from = p_to then raise exception 'Choose a friend'; end if;
 if not exists (select 1 from public.arena_friendships where a = lo and b = hi) then
  raise exception 'Only friends can message';
 end if;
 insert into public.arena_chat_dms(a, b, sender, body, quick)
 values (lo, hi, p_from, p_body, p_quick) returning id into new_id;
 -- The pair keeps its last 200.
 delete from public.arena_chat_dms
  where a = lo and b = hi and id <= (
   select id from public.arena_chat_dms where a = lo and b = hi
    order by id desc offset 200 limit 1);
 return new_id;
end; $$;

-- The last messages between two players, oldest first.
create or replace function public.arena_dm_history(p_me uuid, p_friend uuid, p_limit integer)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id', m.id, 'from', m.sender, 'at', (extract(epoch from m.created_at) * 1000)::bigint,
   'text', m.body, 'quick', m.quick) order by m.id), '[]'::jsonb)
 from (select * from public.arena_chat_dms
   where a = least(p_me, p_friend) and b = greatest(p_me, p_friend)
   order by id desc limit greatest(1, least(coalesce(p_limit, 50), 200))) m;
$$;

-- How many messages each friend sent that this player hasn't read.
create or replace function public.arena_dm_unread(p_me uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(s.sender, s.n), '{}'::jsonb) from (
  select m.sender, count(*) as n from public.arena_chat_dms m
  left join public.arena_chat_dm_reads r on r.reader = p_me and r.friend = m.sender
  where (m.a = p_me or m.b = p_me) and m.sender <> p_me and m.id > coalesce(r.last_read, 0)
  group by m.sender) s;
$$;

-- This player has read everything a friend sent so far.
create or replace function public.arena_dm_read(p_me uuid, p_friend uuid)
returns void language sql security definer set search_path='' as $$
 insert into public.arena_chat_dm_reads(reader, friend, last_read)
 select p_me, p_friend, coalesce(max(id), 0) from public.arena_chat_dms
  where a = least(p_me, p_friend) and b = greatest(p_me, p_friend)
 on conflict (reader, friend) do update set last_read = excluded.last_read;
$$;

revoke all on function public.arena_dm_save(uuid, uuid, text, text),
 public.arena_dm_history(uuid, uuid, integer), public.arena_dm_unread(uuid),
 public.arena_dm_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.arena_dm_save(uuid, uuid, text, text),
 public.arena_dm_history(uuid, uuid, integer), public.arena_dm_unread(uuid),
 public.arena_dm_read(uuid, uuid) to service_role;
commit;
notify pgrst, 'reload schema';
