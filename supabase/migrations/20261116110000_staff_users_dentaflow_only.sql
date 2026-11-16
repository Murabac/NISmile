-- Shared Supabase project: stop auto-creating dental.profiles for every Auth user
-- (Loolan and other apps). Staff profiles are created only via create_staff_user /
-- create_branch_dentist. Clean up accidental profiles from other apps.

create or replace function dental.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = dental
as $$
begin
  -- No-op. DentaFlow staff rows are inserted by dental.create_staff_user
  -- (and dentist create). Auto-inserting here pulled every Auth user into
  -- Settings → Users on this shared project.
  return new;
end;
$$;

revoke all on function dental.handle_new_user() from public;
grant execute on function dental.handle_new_user() to supabase_auth_admin;

-- Drop accidental profiles (other-app Auth users). Keep @nismile.com staff
-- and legacy @nismile.local demo logins. Cascade clears user_branches.
delete from dental.profiles p
using auth.users u
where u.id = p.user_id
  and lower(coalesce(u.email, '')) not like '%@nismile.com'
  and lower(coalesce(u.email, '')) not like '%@nismile.local';

-- List only DentaFlow staff emails going forward.
drop function if exists dental.list_staff_users();

create function dental.list_staff_users()
returns table (
  user_id uuid,
  email text,
  name text,
  display_name text,
  role dental.staff_role,
  branch_ids uuid[],
  banned boolean
)
language plpgsql
security definer
set search_path = dental, auth
as $$
begin
  if not dental.is_owner() then
    raise exception 'Owner only';
  end if;

  return query
  select
    p.user_id,
    u.email::text,
    p.name,
    p.display_name,
    p.role,
    coalesce(
      (select array_agg(ub.branch_id order by ub.branch_id)
       from dental.user_branches ub
       where ub.user_id = p.user_id),
      '{}'::uuid[]
    ) as branch_ids,
    (u.banned_until is not null and u.banned_until > now()) as banned
  from dental.profiles p
  join auth.users u on u.id = p.user_id
  where lower(coalesce(u.email, '')) like '%@nismile.com'
     or lower(coalesce(u.email, '')) like '%@nismile.local'
  order by p.name;
end;
$$;

revoke all on function dental.list_staff_users() from public;
grant execute on function dental.list_staff_users() to authenticated, service_role;
