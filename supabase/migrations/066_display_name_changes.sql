-- Players change their own display name, at most once every 14 days.
-- Run after 065_ratings_safe_updates.sql.
--
-- The first change can happen at any time (many players kept the name they
-- typed at sign-up, or "Trainer"); after that the next one opens 14 days
-- after the last, on the database's clock. An admin's rename (Admin →
-- Players) doesn't count against it. Names stay what they were: 1 to 20
-- characters, not unique (the friend code tells players apart).
begin;

alter table public.arena_profiles add column if not exists name_changed_at timestamptz;

-- When you last changed your name and when you can next.
create or replace function public.arena_name_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare changed timestamptz;
begin
 perform public.arena_require_player();
 select name_changed_at into changed from public.arena_profiles where id=auth.uid();
 return jsonb_build_object(
  'changedAt', changed,
  'nextAt', case when changed is null then null else changed + interval '14 days' end,
  'now', now(),
  'days', 14);
end; $$;

-- Change your name: the server cleans it, checks it and the 14 days.
create or replace function public.arena_change_name(p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me record; clean text; changed timestamptz := now();
begin
 perform public.arena_require_player();
 -- No control or invisible characters (they could hide or fake a name);
 -- checked before the clean-up below, which would turn a line break into
 -- a space.
 if coalesce(p_name, '') ~ '[[:cntrl:]\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]' then
  raise exception 'That name has characters that can''t be shown.'; end if;
 -- Spaces trimmed and runs of spaces made one.
 clean := regexp_replace(btrim(coalesce(p_name, '')), ' +', ' ', 'g');
 if char_length(clean) not between 1 and 20 then
  raise exception 'A name is 1 to 20 characters.'; end if;
 if clean ~ '^[[:punct:][:space:]]+$' then
  raise exception 'Use at least one letter or number.'; end if;
 select display_name, name_changed_at into me from public.arena_profiles
  where id=auth.uid() for update;
 if me.display_name = clean then
  raise exception 'That is already your name.'; end if;
 if me.name_changed_at is not null and changed < me.name_changed_at + interval '14 days' then
  raise exception 'You can change your name again on %.',
   to_char((me.name_changed_at + interval '14 days') at time zone 'utc', 'FMMonth FMDD, YYYY "at" HH24:MI "UTC"');
 end if;
 update public.arena_profiles set display_name=clean, name_changed_at=changed where id=auth.uid();
 return jsonb_build_object('displayName', clean, 'changedAt', changed,
  'nextAt', changed + interval '14 days', 'now', changed, 'days', 14);
end; $$;

revoke all on function public.arena_name_status(), public.arena_change_name(text)
 from public, anon, authenticated;
grant execute on function public.arena_name_status(), public.arena_change_name(text) to authenticated;
commit;
notify pgrst, 'reload schema';
