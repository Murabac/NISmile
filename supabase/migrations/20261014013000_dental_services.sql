-- DentaFlow services catalog (shared). Recipes come later.
-- English names only.

create table dental.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category_id uuid not null references dental.categories (id),
  description text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  tax_rate_id uuid references dental.tax_rates (id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table dental.service_prices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references dental.services (id) on delete cascade,
  price_list dental.price_list not null,
  min_qty numeric(12, 2) not null default 1 check (min_qty > 0),
  price numeric(12, 2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  unique (service_id, price_list, min_qty)
);

create index services_category_id_idx on dental.services (category_id);
create index services_tax_rate_id_idx on dental.services (tax_rate_id);
create index services_active_idx on dental.services (active);
create index service_prices_service_id_idx on dental.service_prices (service_id);

create or replace function dental.can_manage_services()
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
      and role in ('owner', 'branch_manager', 'dentist')
  );
$$;

revoke all on function dental.can_manage_services() from public;
grant execute on function dental.can_manage_services() to authenticated;

alter table dental.services enable row level security;
alter table dental.service_prices enable row level security;

create policy services_select
on dental.services
for select
to authenticated
using (true);

create policy services_write
on dental.services
for all
to authenticated
using (dental.can_manage_services())
with check (dental.can_manage_services());

create policy service_prices_select
on dental.service_prices
for select
to authenticated
using (true);

create policy service_prices_write
on dental.service_prices
for all
to authenticated
using (dental.can_manage_services())
with check (dental.can_manage_services());

grant select, insert, update, delete on dental.services to authenticated, service_role;
grant select, insert, update, delete on dental.service_prices to authenticated, service_role;
