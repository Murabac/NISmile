-- Quick-add dentist from Appointments booking (owner / branch manager).
-- Creates auth user + dentist profile + branch link.

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

  if not exists (select 1 from dental.branches where id = p_branch_id and active) then
    raise exception 'Branch not found';
  end if;

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

  -- Trigger may have inserted receptionist; force dentist + name.
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

revoke all on function dental.create_branch_dentist(uuid, text, text, text) from public;
grant execute on function dental.create_branch_dentist(uuid, text, text, text) to authenticated, service_role;
