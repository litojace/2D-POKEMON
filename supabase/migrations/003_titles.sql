-- Title ordering (newest custom titles first) and deleting titles.
begin;
alter table public.arena_titles add column if not exists created_at timestamptz not null default now();
create or replace function public.arena_admin_titles() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin perform public.arena_require_admin();
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'color',color,'active',active,'createdAt',created_at) order by created_at desc, name),'[]'::jsonb) into result from public.arena_titles;
 return result;
end; $$;
-- Delete a title everywhere: it is removed from every player who owns or wears it.
create or replace function public.arena_admin_delete_title(p_title_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 perform public.arena_require_admin();
 select name into v_name from public.arena_titles where id=p_title_id;
 if v_name is null then raise exception 'Title not found'; end if;
 update public.arena_profiles set equipped_title=null where equipped_title=p_title_id;
 delete from public.arena_titles where id=p_title_id;
 insert into public.arena_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'delete_title',p_title_id,jsonb_build_object('name',v_name));
end; $$;
revoke all on function public.arena_admin_delete_title(uuid) from public,anon,authenticated;
grant execute on function public.arena_admin_delete_title(uuid) to authenticated;
commit;
notify pgrst, 'reload schema';
