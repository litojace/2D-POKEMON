-- Admin clean-up and problem reports. Run after 001_arena_accounts.sql.
begin;

-- Audit rows keep their history when the acting account is later deleted.
alter table public.arena_admin_audit alter column actor_id drop not null;
alter table public.arena_admin_audit drop constraint if exists arena_admin_audit_actor_id_fkey;
alter table public.arena_admin_audit
  add constraint arena_admin_audit_actor_id_fkey foreign key (actor_id) references auth.users(id) on delete set null;

create table if not exists public.arena_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_name text not null default '',
  category text not null check (category in ('bug','player','account','other')),
  message text not null check (char_length(message) between 5 and 1000),
  context jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index if not exists arena_reports_status_created on public.arena_reports(status, created_at desc);
alter table public.arena_reports enable row level security;
revoke all on public.arena_reports from anon, authenticated;

-- Any signed-in, non-suspended player can report a problem (max 5 per 10 minutes).
create or replace function public.arena_submit_report(p_category text, p_message text, p_context jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare result bigint; reporter text;
begin
 select display_name into reporter from public.arena_profiles where id=auth.uid() and not suspended;
 if auth.uid() is null or reporter is null then raise exception 'Login required' using errcode='42501'; end if;
 if p_category is null or p_category not in ('bug','player','account','other') then raise exception 'Choose a report type'; end if;
 if p_message is null or char_length(trim(p_message)) not between 5 and 1000 then raise exception 'Describe the problem in 5 to 1000 characters'; end if;
 if p_context is null or jsonb_typeof(p_context)<>'object' or char_length(p_context::text)>2000 then raise exception 'Invalid report details'; end if;
 if (select count(*) from public.arena_reports where reporter_id=auth.uid() and created_at>now()-interval '10 minutes')>=5 then
   raise exception 'Too many reports. Please wait a few minutes.';
 end if;
 insert into public.arena_reports(reporter_id,reporter_name,category,message,context)
 values(auth.uid(),reporter,p_category,trim(p_message),p_context) returning id into result;
 return result;
end; $$;

create or replace function public.arena_admin_reports(p_status text default 'open', p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.arena_require_admin();
 if p_status not in ('open','resolved','all') or p_offset<0 or p_offset>100000 then raise exception 'Invalid report filter'; end if;
 select jsonb_build_object(
  'total',(select count(*) from public.arena_reports r where p_status='all' or r.status=p_status),
  'open',(select count(*) from public.arena_reports r where r.status='open'),
  'reports',coalesce((select jsonb_agg(row_data) from (
    select jsonb_build_object('id',r.id,'reporterId',r.reporter_id,'reporterName',r.reporter_name,'category',r.category,
      'message',r.message,'context',r.context,'status',r.status,'createdAt',r.created_at,'resolvedAt',r.resolved_at) row_data
    from public.arena_reports r where p_status='all' or r.status=p_status
    order by r.created_at desc, r.id desc limit 50 offset p_offset) rows),'[]'::jsonb)) into result;
 return result;
end; $$;

create or replace function public.arena_admin_resolve_report(p_report_id bigint, p_resolved boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_admin();
 if p_resolved is null then raise exception 'Invalid report status'; end if;
 update public.arena_reports set status=case when p_resolved then 'resolved' else 'open' end,
   resolved_at=case when p_resolved then now() else null end,
   resolved_by=case when p_resolved then auth.uid() else null end
 where id=p_report_id;
 if not found then raise exception 'Report not found'; end if;
 insert into public.arena_admin_audit(actor_id,action,details) values(auth.uid(),'resolve_report',jsonb_build_object('reportId',p_report_id,'resolved',p_resolved));
end; $$;

create or replace function public.arena_admin_set_suspended(p_player_id uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_admin();
 if p_suspended is null then raise exception 'Invalid suspension'; end if;
 if p_player_id=auth.uid() or exists(select 1 from public.arena_admins where user_id=p_player_id) then
   raise exception 'Administrators cannot be suspended here';
 end if;
 update public.arena_profiles set suspended=p_suspended where id=p_player_id;
 if not found then raise exception 'Player not found'; end if;
 insert into public.arena_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'set_suspended',p_player_id,jsonb_build_object('suspended',p_suspended));
end; $$;

-- Permanently removes the login and everything attached to it (profile, titles).
create or replace function public.arena_admin_delete_player(p_player_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 perform public.arena_require_admin();
 if p_player_id=auth.uid() or exists(select 1 from public.arena_admins where user_id=p_player_id) then
   raise exception 'Administrators cannot be deleted here';
 end if;
 select display_name into v_name from public.arena_profiles where id=p_player_id;
 if v_name is null then raise exception 'Player not found'; end if;
 insert into public.arena_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'delete_player',p_player_id,jsonb_build_object('displayName',v_name));
 delete from auth.users where id=p_player_id;
 delete from public.arena_profiles where id=p_player_id;
end; $$;

revoke all on function public.arena_submit_report(text,text,jsonb),public.arena_admin_reports(text,integer),public.arena_admin_resolve_report(bigint,boolean),public.arena_admin_set_suspended(uuid,boolean),public.arena_admin_delete_player(uuid) from public,anon,authenticated;
grant execute on function public.arena_submit_report(text,text,jsonb),public.arena_admin_reports(text,integer),public.arena_admin_resolve_report(bigint,boolean),public.arena_admin_set_suspended(uuid,boolean),public.arena_admin_delete_player(uuid) to authenticated;
commit;
