-- DentaFlow foundation: one clinic branch, staff profiles, and branch access.
-- Staff app language stays English. Customer WhatsApp language is so or ar.

create schema if not exists dental;

create type dental.staff_role as enum (
  'owner',
  'branch_manager',
  'receptionist',
  'dentist',
  'storekeeper'
);

create type dental.whatsapp_language as enum ('so', 'ar');

create table dental.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  tax_id text,
  zaad text,
  edahab text,
  mycash text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table dental.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role dental.staff_role not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table dental.user_branches (
  user_id uuid not null references dental.profiles (user_id) on delete cascade,
  branch_id uuid not null references dental.branches (id) on delete cascade,
  primary key (user_id, branch_id)
);

create table dental.customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  name text not null,
  phone text,
  customer_type text not null default 'retail' check (customer_type in ('retail', 'wholesale')),
  subtype text,
  language dental.whatsapp_language not null default 'so',
  whatsapp_opt_in boolean not null default false,
  credit_limit numeric(12, 2),
  notes text,
  created_at timestamptz not null default now()
);

create index customers_branch_id_idx on dental.customers (branch_id);
create index user_branches_branch_id_idx on dental.user_branches (branch_id);

alter table dental.branches enable row level security;
alter table dental.profiles enable row level security;
alter table dental.user_branches enable row level security;
alter table dental.customers enable row level security;

create or replace function dental.is_owner()
returns boolean
language sql
stable
security definer
set search_path = dental
as $$
  select exists (
    select 1
    from profiles
    where user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function dental.current_role()
returns dental.staff_role
language sql
stable
security definer
set search_path = dental
as $$
  select role
  from profiles
  where user_id = auth.uid();
$$;

create or replace function dental.user_branch_ids()
returns setof uuid
language sql
stable
security definer
set search_path = dental
as $$
  select branch_id
  from user_branches
  where user_id = auth.uid();
$$;

revoke all on function dental.is_owner() from public;
revoke all on function dental.current_role() from public;
revoke all on function dental.user_branch_ids() from public;
grant execute on function dental.is_owner() to authenticated;
grant execute on function dental.current_role() to authenticated;
grant execute on function dental.user_branch_ids() to authenticated;

create policy branches_select
on dental.branches
for select
to authenticated
using (dental.is_owner() or id in (select dental.user_branch_ids()));

create policy branches_write
on dental.branches
for all
to authenticated
using (dental.is_owner())
with check (dental.is_owner());

create policy profiles_select
on dental.profiles
for select
to authenticated
using (user_id = auth.uid() or dental.is_owner());

create policy profiles_update
on dental.profiles
for update
to authenticated
using (user_id = auth.uid() or dental.is_owner())
with check (
  dental.is_owner()
  or (user_id = auth.uid() and role = dental.current_role())
);

create policy user_branches_select
on dental.user_branches
for select
to authenticated
using (user_id = auth.uid() or dental.is_owner());

create policy user_branches_write
on dental.user_branches
for all
to authenticated
using (dental.is_owner())
with check (dental.is_owner());

create policy customers_branch
on dental.customers
for all
to authenticated
using (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
with check (dental.is_owner() or branch_id in (select dental.user_branch_ids()));

grant usage on schema dental to authenticated, service_role;
grant select, insert, update, delete on all tables in schema dental to authenticated, service_role;
grant usage on all sequences in schema dental to authenticated, service_role;
alter default privileges in schema dental
  grant select, insert, update, delete on tables to authenticated, service_role;

insert into dental.branches (name, address, phone, tax_id, zaad, edahab, mycash, active)
values (
  'N.I SMILE Oral care & Teeth whitening',
  '26 June Road 1, Hargeisa, Somaliland',
  '+252 63 4749276',
  '11114',
  '484594',
  '764043',
  null,
  true
);

create or replace function dental.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = dental
as $$
declare
  assigned_role dental.staff_role;
begin
  if not exists (select 1 from profiles) then
    assigned_role := 'owner';
  else
    assigned_role := 'receptionist';
  end if;

  insert into profiles (user_id, role, name)
  values (
    new.id,
    assigned_role,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );

  if assigned_role = 'owner' then
    insert into user_branches (user_id, branch_id)
    select new.id, id
    from branches
    where active
    order by created_at
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function dental.handle_new_user() from public;
grant usage on schema dental to supabase_auth_admin;
grant execute on function dental.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function dental.handle_new_user();
