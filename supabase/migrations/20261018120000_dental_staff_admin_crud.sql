-- Owner staff user admin + customer soft-active + expense category write grants.

-- ---------------------------------------------------------------------------
-- Customers: soft-active (no hard delete)
-- ---------------------------------------------------------------------------
alter table dental.customers
  add column if not exists active boolean not null default true;

create index if not exists customers_branch_active_idx
  on dental.customers (branch_id, active);

-- ---------------------------------------------------------------------------
-- Expense categories: owner can write (RLS already allows; grants were select-only)
-- ---------------------------------------------------------------------------
grant select, insert, update on dental.expense_categories to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Staff admin RPCs (owner-only; Auth writes via security definer)
-- ---------------------------------------------------------------------------

create or replace function dental.list_staff_users()
returns table (
  user_id uuid,
  email text,
  name text,
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
  order by p.name;
end;
$$;

revoke all on function dental.list_staff_users() from public;
grant execute on function dental.list_staff_users() to authenticated, service_role;

create or replace function dental.create_staff_user(
  p_name text,
  p_email text,
  p_password text,
  p_role dental.staff_role,
  p_branch_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = dental, auth, extensions
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_password text := trim(coalesce(p_password, ''));
  v_user_id uuid;
  v_encrypted text;
  v_branch uuid;
begin
  if not dental.is_owner() then
    raise exception 'Owner only';
  end if;
  if v_name = '' then
    raise exception 'Name is required';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Valid email is required';
  end if;
  if char_length(v_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if p_role is null then
    raise exception 'Role is required';
  end if;
  if p_branch_ids is null or cardinality(p_branch_ids) = 0 then
    raise exception 'At least one branch is required';
  end if;

  foreach v_branch in array p_branch_ids loop
    if not exists (select 1 from dental.branches where id = v_branch) then
      raise exception 'Branch not found';
    end if;
  end loop;

  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Email already registered';
  end if;

  v_user_id := gen_random_uuid();
  v_encrypted := crypt(v_password, gen_salt('bf'));

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  values (
    coalesce(
      (select instance_id from auth.users limit 1),
      '00000000-0000-0000-0000-000000000000'
    ),
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', v_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  insert into dental.profiles (user_id, role, name)
  values (v_user_id, p_role, v_name)
  on conflict (user_id) do update
  set role = excluded.role, name = excluded.name;

  delete from dental.user_branches where user_id = v_user_id;
  insert into dental.user_branches (user_id, branch_id)
  select v_user_id, unnest(p_branch_ids)
  on conflict do nothing;

  return v_user_id;
end;
$$;

revoke all on function dental.create_staff_user(text, text, text, dental.staff_role, uuid[]) from public;
grant execute on function dental.create_staff_user(text, text, text, dental.staff_role, uuid[]) to authenticated, service_role;

create or replace function dental.update_staff_user(
  p_user_id uuid,
  p_name text,
  p_role dental.staff_role,
  p_branch_ids uuid[],
  p_email text default null,
  p_password text default null
)
returns void
language plpgsql
security definer
set search_path = dental, auth, extensions
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_password text := trim(coalesce(p_password, ''));
  v_branch uuid;
  v_old_role dental.staff_role;
  v_owner_count int;
begin
  if not dental.is_owner() then
    raise exception 'Owner only';
  end if;
  if p_user_id is null then
    raise exception 'User is required';
  end if;
  if v_name = '' then
    raise exception 'Name is required';
  end if;
  if p_role is null then
    raise exception 'Role is required';
  end if;
  if p_branch_ids is null or cardinality(p_branch_ids) = 0 then
    raise exception 'At least one branch is required';
  end if;

  select role into v_old_role from dental.profiles where user_id = p_user_id;
  if not found then
    raise exception 'Staff profile not found';
  end if;

  if v_old_role = 'owner' and p_role is distinct from 'owner' then
    select count(*) into v_owner_count from dental.profiles where role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'Cannot demote the last owner';
    end if;
  end if;

  foreach v_branch in array p_branch_ids loop
    if not exists (select 1 from dental.branches where id = v_branch) then
      raise exception 'Branch not found';
    end if;
  end loop;

  update dental.profiles
  set name = v_name, role = p_role
  where user_id = p_user_id;

  delete from dental.user_branches where user_id = p_user_id;
  insert into dental.user_branches (user_id, branch_id)
  select p_user_id, unnest(p_branch_ids)
  on conflict do nothing;

  if v_email <> '' then
    if position('@' in v_email) = 0 then
      raise exception 'Valid email is required';
    end if;
    if exists (
      select 1 from auth.users
      where email = v_email and id is distinct from p_user_id
    ) then
      raise exception 'Email already registered';
    end if;
    update auth.users
    set email = v_email,
        updated_at = now(),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', v_name)
    where id = p_user_id;
    update auth.identities
    set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email),
        updated_at = now()
    where user_id = p_user_id and provider = 'email';
  else
    update auth.users
    set updated_at = now(),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', v_name)
    where id = p_user_id;
  end if;

  if v_password <> '' then
    if char_length(v_password) < 8 then
      raise exception 'Password must be at least 8 characters';
    end if;
    update auth.users
    set encrypted_password = crypt(v_password, gen_salt('bf')),
        updated_at = now()
    where id = p_user_id;
  end if;
end;
$$;

revoke all on function dental.update_staff_user(uuid, text, dental.staff_role, uuid[], text, text) from public;
grant execute on function dental.update_staff_user(uuid, text, dental.staff_role, uuid[], text, text) to authenticated, service_role;

create or replace function dental.set_staff_login_enabled(
  p_user_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = dental, auth
as $$
declare
  v_role dental.staff_role;
  v_owner_count int;
begin
  if not dental.is_owner() then
    raise exception 'Owner only';
  end if;
  if p_user_id is null then
    raise exception 'User is required';
  end if;
  if p_user_id = auth.uid() and not coalesce(p_enabled, true) then
    raise exception 'Cannot disable your own login';
  end if;

  select role into v_role from dental.profiles where user_id = p_user_id;
  if not found then
    raise exception 'Staff profile not found';
  end if;

  if v_role = 'owner' and not coalesce(p_enabled, true) then
    select count(*) into v_owner_count
    from dental.profiles p
    join auth.users u on u.id = p.user_id
    where p.role = 'owner'
      and (u.banned_until is null or u.banned_until <= now());
    if v_owner_count <= 1 then
      raise exception 'Cannot disable the last active owner';
    end if;
  end if;

  if coalesce(p_enabled, true) then
    update auth.users
    set banned_until = null, updated_at = now()
    where id = p_user_id;
  else
    update auth.users
    set banned_until = 'infinity'::timestamptz, updated_at = now()
    where id = p_user_id;
  end if;
end;
$$;

revoke all on function dental.set_staff_login_enabled(uuid, boolean) from public;
grant execute on function dental.set_staff_login_enabled(uuid, boolean) to authenticated, service_role;

-- Appointments dentist shortcut: owners reuse create_staff_user; managers keep local insert.
create or replace function dental.create_branch_dentist(
  p_branch_id uuid,
  p_name text,
  p_email text,
  p_password text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental, auth, extensions
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_password text := coalesce(nullif(trim(p_password), ''), 'dentaflow-demo');
  v_user_id uuid;
  v_encrypted text;
begin
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if v_name = '' then
    raise exception 'Dentist name is required';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Valid email is required';
  end if;
  if char_length(v_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  if auth.uid() is not null then
    if not dental.can_manage_appointments() and not dental.is_owner() then
      raise exception 'Not allowed to add dentists';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if dental.is_owner() then
    return dental.create_staff_user(
      v_name,
      v_email,
      v_password,
      'dentist'::dental.staff_role,
      array[p_branch_id]
    );
  end if;

  if not exists (select 1 from dental.branches where id = p_branch_id and active) then
    raise exception 'Branch not found';
  end if;

  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Email already registered';
  end if;

  v_user_id := gen_random_uuid();
  v_encrypted := crypt(v_password, gen_salt('bf'));

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    coalesce((select instance_id from auth.users limit 1), '00000000-0000-0000-0000-000000000000'),
    v_user_id, 'authenticated', 'authenticated', v_email, v_encrypted, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', v_name), now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email', v_user_id::text, now(), now(), now()
  );

  insert into dental.profiles (user_id, role, name)
  values (v_user_id, 'dentist', v_name)
  on conflict (user_id) do update
  set role = 'dentist', name = excluded.name;

  insert into dental.user_branches (user_id, branch_id)
  values (v_user_id, p_branch_id)
  on conflict do nothing;

  return v_user_id;
end;
$$;
