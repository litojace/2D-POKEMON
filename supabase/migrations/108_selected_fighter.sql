-- The fighter you last picked, saved with your account, so it is still
-- yours when you log in on another device (phone, desktop, iPad).
-- Run after 107_bistro_cook_times.sql.
--
-- One row per player, read and written only through the two functions
-- below (row-level security on, no policies). The game server checks the
-- id against its roster before it saves; the format check here keeps the
-- column to short lower-case ids either way.
begin;

create table if not exists public.arena_preferences (
 user_id uuid primary key references public.arena_profiles(id) on delete cascade,
 fighter text check (fighter ~ '^[a-z]{2,24}$'),
 updated_at timestamptz not null default now()
);
alter table public.arena_preferences enable row level security;
revoke all on table public.arena_preferences from public, anon, authenticated;

-- Your saved fighter, or null if you never picked one on a signed-in device.
create or replace function public.arena_saved_fighter() returns text
language plpgsql stable security definer set search_path='' as $$
declare saved text;
begin
 perform public.arena_require_player();
 select fighter into saved from public.arena_preferences where user_id=auth.uid();
 return saved;
end; $$;

-- Save the fighter you picked.
create or replace function public.arena_save_fighter(p_fighter text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_player();
 if coalesce(p_fighter, '') !~ '^[a-z]{2,24}$' then
  raise exception 'That is not a fighter.'; end if;
 insert into public.arena_preferences(user_id, fighter, updated_at)
  values (auth.uid(), p_fighter, now())
  on conflict (user_id) do update set fighter=excluded.fighter, updated_at=excluded.updated_at;
end; $$;

revoke all on function public.arena_saved_fighter(), public.arena_save_fighter(text)
 from public, anon, authenticated;
grant execute on function public.arena_saved_fighter(), public.arena_save_fighter(text) to authenticated;
commit;
notify pgrst, 'reload schema';
