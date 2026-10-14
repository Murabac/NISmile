-- DentaFlow catalog: shared categories, tax rates, items, and price tiers.
-- Staff UI stays English. No stock quantities in this migration.

create type dental.price_list as enum ('retail', 'wholesale');

create table dental.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table dental.tax_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rate numeric(6, 4) not null check (rate >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table dental.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  barcode text unique,
  name text not null,
  category_id uuid not null references dental.categories (id),
  unit text not null,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  reorder_level numeric(12, 2) not null default 0 check (reorder_level >= 0),
  tax_rate_id uuid references dental.tax_rates (id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table dental.item_prices (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references dental.items (id) on delete cascade,
  price_list dental.price_list not null,
  min_qty numeric(12, 2) not null default 1 check (min_qty > 0),
  price numeric(12, 2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  unique (item_id, price_list, min_qty)
);

create index items_category_id_idx on dental.items (category_id);
create index items_tax_rate_id_idx on dental.items (tax_rate_id);
create index items_active_idx on dental.items (active);
create index item_prices_item_id_idx on dental.item_prices (item_id);

create or replace function dental.can_manage_catalog()
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
      and role in ('owner', 'branch_manager', 'storekeeper')
  );
$$;

revoke all on function dental.can_manage_catalog() from public;
grant execute on function dental.can_manage_catalog() to authenticated;

alter table dental.categories enable row level security;
alter table dental.tax_rates enable row level security;
alter table dental.items enable row level security;
alter table dental.item_prices enable row level security;

create policy categories_select
on dental.categories
for select
to authenticated
using (true);

create policy categories_write
on dental.categories
for all
to authenticated
using (dental.can_manage_catalog())
with check (dental.can_manage_catalog());

create policy tax_rates_select
on dental.tax_rates
for select
to authenticated
using (true);

create policy tax_rates_write
on dental.tax_rates
for all
to authenticated
using (dental.is_owner())
with check (dental.is_owner());

create policy items_select
on dental.items
for select
to authenticated
using (true);

create policy items_write
on dental.items
for all
to authenticated
using (dental.can_manage_catalog())
with check (dental.can_manage_catalog());

create policy item_prices_select
on dental.item_prices
for select
to authenticated
using (true);

create policy item_prices_write
on dental.item_prices
for all
to authenticated
using (dental.can_manage_catalog())
with check (dental.can_manage_catalog());

grant select, insert, update, delete on dental.categories to authenticated, service_role;
grant select, insert, update, delete on dental.tax_rates to authenticated, service_role;
grant select, insert, update, delete on dental.items to authenticated, service_role;
grant select, insert, update, delete on dental.item_prices to authenticated, service_role;
grant usage on type dental.price_list to authenticated, service_role;

insert into dental.categories (name, active)
values
  ('Restorative', true),
  ('Consumables', true),
  ('Anesthetics', true),
  ('Hygiene', true),
  ('Cosmetic', true),
  ('Prosthodontics', true),
  ('Surgical', true)
on conflict (name) do nothing;
