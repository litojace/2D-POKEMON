-- Blocking players, and a filter for player names.
-- Run after 109_delete_my_account.sql. Safe to run again.
--
-- The App Store asks apps where players see each other's names to filter
-- them and to let players block each other (App Review Guideline 1.2).
--
-- Names: a trigger on arena_profiles checks every new name, whatever sets
-- it (sign-up, a guest's nickname, a Google or Apple name, a name change,
-- an admin's rename). A name picked at sign-up that fails becomes
-- "Trainer"; a change to one is refused. Names already in use stay until
-- they change. The words live in arena_name_words (the same lists as
-- packages/shared/src/name-filter.ts, which explains the check; the test
-- tests/integration/name-filter.test.ts keeps the two the same).
--
-- Blocking: arena_blocks holds who blocked whom. Blocking someone ends the
-- friendship and any requests both ways (so their farm and bistro visits,
-- invites and party invites stop too: those are for friends only). After
-- that, a request from them is dropped without telling them, and you're
-- asked to unblock them before you send one. The client hides players you
-- blocked in the Plaza.
begin;

create table if not exists public.arena_name_words (
 word text primary key check (word ~ '^[a-z]+$'),
 whole boolean not null
);
alter table public.arena_name_words enable row level security;
revoke all on public.arena_name_words from anon, authenticated;
delete from public.arena_name_words;
insert into public.arena_name_words(word, whole) values
 ('nigger', false),
 ('nigga', false),
 ('faggot', false),
 ('retard', false),
 ('tranny', false),
 ('wetback', false),
 ('fuck', false),
 ('shit', false),
 ('cunt', false),
 ('bitch', false),
 ('whore', false),
 ('slut', false),
 ('porn', false),
 ('penis', false),
 ('vagina', false),
 ('dildo', false),
 ('jizz', false),
 ('blowjob', false),
 ('handjob', false),
 ('asshole', false),
 ('pedophile', false),
 ('paedophile', false),
 ('molest', false),
 ('hitler', false),
 ('kkk', false),
 ('elementarena', false),
 ('ass', true),
 ('arse', true),
 ('cock', true),
 ('dick', true),
 ('pussy', true),
 ('fag', true),
 ('cum', true),
 ('rape', true),
 ('rapist', true),
 ('nazi', true),
 ('pedo', true),
 ('spic', true),
 ('coon', true),
 ('chink', true),
 ('kike', true),
 ('gook', true),
 ('dyke', true),
 ('twat', true),
 ('tit', true),
 ('tits', true),
 ('boob', true),
 ('boobs', true),
 ('sex', true),
 ('anal', true),
 ('wank', true),
 ('wanker', true),
 ('bastard', true),
 ('admin', true),
 ('administrator', true),
 ('moderator', true),
 ('official', true),
 ('staff', true);

-- Lower case, accents off, look-alike digits and symbols read as letters.
create or replace function public.arena_name_letters(p text) returns text
language sql immutable set search_path='' as $$
 select translate(translate(lower(coalesce(p, '')),
  'àáâãäåèéêëìíîïòóôõöùúûüýÿñç', 'aaaaaaeeeeiiiiooooouuuuyync'),
  '0134578@$!', 'oieastbasi')
$$;

create or replace function public.arena_name_allowed(p text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare letters text := public.arena_name_letters(p);
 squashed text := regexp_replace(letters, '[^a-z]', '', 'g');
 words text[] := array_remove(regexp_split_to_array(letters, '[^a-z]+'), '');
begin
 return not exists(select 1 from public.arena_name_words w
  where (not w.whole and position(w.word in squashed) > 0)
     or (w.whole and (w.word = any(words) or w.word || 's' = any(words))));
end; $$;

create or replace function public.arena_check_display_name() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op = 'UPDATE' and new.display_name is not distinct from old.display_name then return new; end if;
 if public.arena_name_allowed(new.display_name) then return new; end if;
 if tg_op = 'INSERT' then new.display_name := 'Trainer'; return new; end if;
 raise exception 'That name isn''t allowed. Please choose another.';
end; $$;
drop trigger if exists arena_profiles_name_filter on public.arena_profiles;
create trigger arena_profiles_name_filter before insert or update of display_name
 on public.arena_profiles for each row execute function public.arena_check_display_name();

-- Who blocked whom.
create table if not exists public.arena_blocks (
 blocker uuid not null references public.arena_profiles(id) on delete cascade,
 blocked uuid not null references public.arena_profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (blocker, blocked),
 check (blocker <> blocked)
);
create index if not exists arena_blocks_blocked on public.arena_blocks(blocked);
alter table public.arena_blocks enable row level security;
revoke all on public.arena_blocks from anon, authenticated;

-- Block or unblock a player. Blocking ends the friendship and requests.
create or replace function public.arena_block_player(p_player uuid, p_block boolean) returns void
language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid();
begin
 perform public.arena_require_player();
 if p_player is null or p_block is null then raise exception 'Choose a player.'; end if;
 if p_player = me then raise exception 'You can''t block yourself.'; end if;
 if not p_block then
  delete from public.arena_blocks where blocker = me and blocked = p_player;
  return;
 end if;
 if not exists(select 1 from public.arena_profiles where id = p_player) then
  raise exception 'Player not found'; end if;
 if (select count(*) from public.arena_blocks where blocker = me) >= 500 then
  raise exception 'You''ve blocked 500 players. Unblock someone first.'; end if;
 insert into public.arena_blocks(blocker, blocked) values(me, p_player) on conflict do nothing;
 delete from public.arena_friendships where a = least(me, p_player) and b = greatest(me, p_player);
 delete from public.arena_friend_requests
  where (from_id = me and to_id = p_player) or (from_id = p_player and to_id = me);
end; $$;

-- The players you blocked, newest first.
create or replace function public.arena_blocked_players() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.arena_require_player();
 return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name)
   order by b.created_at desc)
  from public.arena_blocks b join public.arena_profiles p on p.id = b.blocked
  where b.blocker = auth.uid()), '[]'::jsonb);
end; $$;

-- No requests or friendships between players where one blocked the other.
create or replace function public.arena_friend_block_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare x uuid; y uuid;
begin
 if tg_table_name = 'arena_friend_requests' then x := new.from_id; y := new.to_id;
 else x := new.a; y := new.b; end if;
 -- The one asking blocked the other: say so.
 if tg_table_name = 'arena_friend_requests'
    and exists(select 1 from public.arena_blocks where blocker = x and blocked = y) then
  raise exception 'You blocked this player. Unblock them first.';
 end if;
 -- Otherwise drop it quietly: a blocked player isn't told.
 if exists(select 1 from public.arena_blocks
   where (blocker = x and blocked = y) or (blocker = y and blocked = x)) then
  return null;
 end if;
 return new;
end; $$;
drop trigger if exists arena_friend_requests_block_guard on public.arena_friend_requests;
create trigger arena_friend_requests_block_guard before insert on public.arena_friend_requests
 for each row execute function public.arena_friend_block_guard();
drop trigger if exists arena_friendships_block_guard on public.arena_friendships;
create trigger arena_friendships_block_guard before insert on public.arena_friendships
 for each row execute function public.arena_friend_block_guard();

revoke all on function public.arena_name_letters(text), public.arena_name_allowed(text),
 public.arena_check_display_name(), public.arena_friend_block_guard(),
 public.arena_block_player(uuid, boolean), public.arena_blocked_players()
 from public, anon, authenticated;
grant execute on function public.arena_block_player(uuid, boolean), public.arena_blocked_players()
 to authenticated;
commit;
notify pgrst, 'reload schema';
