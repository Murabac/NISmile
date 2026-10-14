-- DentaFlow sales checkout (POS).
-- One RPC: sale + VAT snapshots + payments + FEFO item deduct + service recipes.
-- Promotions, points, wholesale credit, and documents come in later steps.

do $$ begin
  create type dental.payment_tender as enum ('cash', 'zaad', 'edahab', 'mycash');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.sale_status as enum ('partial', 'paid', 'void');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.sale_line_type as enum ('item', 'service');
exception when duplicate_object then null;
end $$;

create table if not exists dental.sales (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  customer_id uuid references dental.customers (id),
  status dental.sale_status not null,
  price_list dental.price_list not null,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount_total numeric(12, 2) not null default 0 check (discount_total >= 0),
  tax_total numeric(12, 2) not null check (tax_total >= 0),
  total numeric(12, 2) not null check (total >= 0),
  paid_total numeric(12, 2) not null check (paid_total >= 0),
  receipt_number text not null unique,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists dental.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references dental.sales (id) on delete cascade,
  line_type dental.sale_line_type not null,
  item_id uuid references dental.items (id),
  service_id uuid references dental.services (id),
  sku_or_code text not null,
  name text not null,
  qty numeric(12, 2) not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(8, 6) not null check (tax_rate >= 0),
  tax_amount numeric(12, 2) not null check (tax_amount >= 0),
  line_net numeric(12, 2) not null check (line_net >= 0),
  line_gross numeric(12, 2) not null check (line_gross >= 0),
  promotion_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (
    (line_type = 'item' and item_id is not null and service_id is null)
    or (line_type = 'service' and service_id is not null and item_id is null)
  )
);

create table if not exists dental.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references dental.sales (id) on delete cascade,
  tender dental.payment_tender not null,
  amount numeric(12, 2) not null check (amount > 0),
  reference text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists sales_branch_id_idx on dental.sales (branch_id);
create index if not exists sales_customer_id_idx on dental.sales (customer_id);
create index if not exists sales_created_at_idx on dental.sales (created_at desc);
create index if not exists sale_lines_sale_id_idx on dental.sale_lines (sale_id);
create index if not exists payments_sale_id_idx on dental.payments (sale_id);

create or replace function dental.can_checkout()
returns boolean
language sql
stable
security definer
set search_path = dental
as $$
  select exists (
    select 1
    from dental.profiles
    where user_id = auth.uid()
      and role in ('owner', 'branch_manager', 'receptionist', 'dentist')
  );
$$;

revoke all on function dental.can_checkout() from public;
grant execute on function dental.can_checkout() to authenticated;

create or replace function dental.next_receipt_number()
returns text
language plpgsql
security definer
set search_path = dental
as $$
declare
  today text := to_char(timezone('utc', now()), 'YYYYMMDD');
  seq integer;
begin
  select count(*)::integer + 1
  into seq
  from dental.sales
  where receipt_number like 'RCP-' || today || '-%';

  return 'RCP-' || today || '-' || lpad(seq::text, 3, '0');
end;
$$;

revoke all on function dental.next_receipt_number() from public;
grant execute on function dental.next_receipt_number() to authenticated, service_role;

-- Resolve unit price from price tiers (highest min_qty <= p_qty).
create or replace function dental.resolve_unit_price(
  p_price_list dental.price_list,
  p_qty numeric,
  p_item_id uuid default null,
  p_service_id uuid default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_price numeric(12, 2);
begin
  if p_item_id is not null then
    select price into v_price
    from dental.item_prices
    where item_id = p_item_id
      and price_list = p_price_list
      and min_qty <= p_qty
    order by min_qty desc
    limit 1;

    if v_price is null and p_price_list = 'wholesale' then
      select price into v_price
      from dental.item_prices
      where item_id = p_item_id
        and price_list = 'retail'
        and min_qty <= p_qty
      order by min_qty desc
      limit 1;
    end if;
  elsif p_service_id is not null then
    -- Services are patient-priced only.
    select price into v_price
    from dental.service_prices
    where service_id = p_service_id
      and price_list = 'retail'
      and min_qty <= p_qty
    order by min_qty desc
    limit 1;
  end if;

  if v_price is null then
    raise exception 'No price found for line';
  end if;

  return v_price;
end;
$$;

revoke all on function dental.resolve_unit_price(dental.price_list, numeric, uuid, uuid) from public;
grant execute on function dental.resolve_unit_price(dental.price_list, numeric, uuid, uuid) to authenticated, service_role;

create or replace function dental.checkout_sale(
  p_branch_id uuid,
  p_customer_id uuid,
  p_lines jsonb,
  p_payments jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_sale_id uuid;
  v_customer dental.customers%rowtype;
  v_price_list dental.price_list := 'retail';
  v_line jsonb;
  v_pay jsonb;
  v_line_type text;
  v_item_id uuid;
  v_service_id uuid;
  v_qty numeric(12, 2);
  v_unit_price numeric(12, 2);
  v_tax_rate numeric(8, 6);
  v_line_net numeric(12, 2);
  v_tax_amount numeric(12, 2);
  v_line_gross numeric(12, 2);
  v_sku text;
  v_name text;
  v_sort integer := 0;
  v_subtotal numeric(12, 2) := 0;
  v_tax_total numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_paid numeric(12, 2) := 0;
  v_status dental.sale_status;
  v_receipt text;
  v_tender dental.payment_tender;
  v_amount numeric(12, 2);
  v_i integer;
  v_item dental.items%rowtype;
  v_service dental.services%rowtype;
  v_rate numeric(8, 6);
begin
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cart is empty';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'At least one payment is required';
  end if;

  if auth.uid() is not null then
    if not dental.can_checkout() and not dental.is_owner() then
      raise exception 'Not allowed to checkout';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if p_customer_id is not null then
    select * into v_customer from dental.customers where id = p_customer_id;
    if v_customer.id is null then
      raise exception 'Customer not found';
    end if;
    if v_customer.branch_id <> p_branch_id then
      raise exception 'Customer belongs to another branch';
    end if;
    if v_customer.customer_type = 'wholesale' then
      v_price_list := 'wholesale';
    end if;
  end if;

  -- First pass: validate and accumulate totals.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_type := lower(trim(coalesce(v_line->>'line_type', '')));
    v_qty := (v_line->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Line quantity must be positive';
    end if;

    if v_line_type = 'item' then
      v_item_id := (v_line->>'item_id')::uuid;
      if v_item_id is null then
        raise exception 'item_id is required for item lines';
      end if;
      select * into v_item from dental.items where id = v_item_id and active;
      if v_item.id is null then
        raise exception 'Item not found or inactive';
      end if;
      v_unit_price := dental.resolve_unit_price(v_price_list, v_qty, v_item_id, null);
      v_rate := 0;
      if v_item.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_item.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_tax_rate := v_rate;
      v_line_net := round(v_unit_price * v_qty, 2);
      v_tax_amount := round(v_line_net * v_tax_rate, 2);
      v_subtotal := v_subtotal + v_line_net;
      v_tax_total := v_tax_total + v_tax_amount;
    elsif v_line_type = 'service' then
      v_service_id := (v_line->>'service_id')::uuid;
      if v_service_id is null then
        raise exception 'service_id is required for service lines';
      end if;
      select * into v_service from dental.services where id = v_service_id and active;
      if v_service.id is null then
        raise exception 'Service not found or inactive';
      end if;
      if v_qty <> trunc(v_qty) then
        raise exception 'Service quantity must be a whole number';
      end if;
      v_unit_price := dental.resolve_unit_price('retail', v_qty, null, v_service_id);
      v_rate := 0;
      if v_service.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_service.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_tax_rate := v_rate;
      v_line_net := round(v_unit_price * v_qty, 2);
      v_tax_amount := round(v_line_net * v_tax_rate, 2);
      v_subtotal := v_subtotal + v_line_net;
      v_tax_total := v_tax_total + v_tax_amount;
    else
      raise exception 'Invalid line_type %', v_line_type;
    end if;
  end loop;

  v_total := v_subtotal + v_tax_total;

  for v_pay in select * from jsonb_array_elements(p_payments)
  loop
    v_amount := (v_pay->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Payment amount must be positive';
    end if;
    v_paid := v_paid + v_amount;
  end loop;

  if v_paid <= 0 then
    raise exception 'Paid total must be greater than zero';
  end if;

  if v_paid < v_total then
    v_status := 'partial';
  else
    v_status := 'paid';
  end if;

  v_receipt := dental.next_receipt_number();

  insert into dental.sales (
    branch_id, customer_id, status, price_list,
    subtotal, discount_total, tax_total, total, paid_total,
    receipt_number, notes, created_by
  )
  values (
    p_branch_id, p_customer_id, v_status, v_price_list,
    v_subtotal, 0, v_tax_total, v_total, v_paid,
    v_receipt, nullif(trim(p_notes), ''), auth.uid()
  )
  returning id into v_sale_id;

  -- Second pass: insert lines + stock.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sort := v_sort + 1;
    v_line_type := lower(trim(coalesce(v_line->>'line_type', '')));
    v_qty := (v_line->>'qty')::numeric;

    if v_line_type = 'item' then
      v_item_id := (v_line->>'item_id')::uuid;
      select * into v_item from dental.items where id = v_item_id;
      v_unit_price := dental.resolve_unit_price(v_price_list, v_qty, v_item_id, null);
      v_rate := 0;
      if v_item.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_item.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_tax_rate := v_rate;
      v_line_net := round(v_unit_price * v_qty, 2);
      v_tax_amount := round(v_line_net * v_tax_rate, 2);
      v_line_gross := v_line_net + v_tax_amount;
      v_sku := v_item.sku;
      v_name := v_item.name;

      insert into dental.sale_lines (
        sale_id, line_type, item_id, service_id, sku_or_code, name,
        qty, unit_price, discount_amount, tax_rate, tax_amount,
        line_net, line_gross, sort_order
      )
      values (
        v_sale_id, 'item', v_item_id, null, v_sku, v_name,
        v_qty, v_unit_price, 0, v_tax_rate, v_tax_amount,
        v_line_net, v_line_gross, v_sort
      );

      perform dental.deduct_stock_fefo(
        p_branch_id,
        v_item_id,
        v_qty,
        'sale_out',
        'sale',
        v_sale_id,
        'Sale ' || v_receipt
      );
    else
      v_service_id := (v_line->>'service_id')::uuid;
      select * into v_service from dental.services where id = v_service_id;
      v_unit_price := dental.resolve_unit_price('retail', v_qty, null, v_service_id);
      v_rate := 0;
      if v_service.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_service.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_tax_rate := v_rate;
      v_line_net := round(v_unit_price * v_qty, 2);
      v_tax_amount := round(v_line_net * v_tax_rate, 2);
      v_line_gross := v_line_net + v_tax_amount;
      v_sku := v_service.code;
      v_name := v_service.name;

      insert into dental.sale_lines (
        sale_id, line_type, item_id, service_id, sku_or_code, name,
        qty, unit_price, discount_amount, tax_rate, tax_amount,
        line_net, line_gross, sort_order
      )
      values (
        v_sale_id, 'service', null, v_service_id, v_sku, v_name,
        v_qty, v_unit_price, 0, v_tax_rate, v_tax_amount,
        v_line_net, v_line_gross, v_sort
      );

      for v_i in 1 .. v_qty::integer
      loop
        perform dental.apply_service_recipe(
          p_branch_id,
          v_service_id,
          'sale',
          v_sale_id
        );
      end loop;
    end if;
  end loop;

  for v_pay in select * from jsonb_array_elements(p_payments)
  loop
    v_tender := (lower(trim(v_pay->>'tender')))::dental.payment_tender;
    v_amount := (v_pay->>'amount')::numeric;
    insert into dental.payments (sale_id, tender, amount, reference, created_by)
    values (
      v_sale_id,
      v_tender,
      v_amount,
      nullif(trim(coalesce(v_pay->>'reference', '')), ''),
      auth.uid()
    );
  end loop;

  return v_sale_id;
end;
$$;

revoke all on function dental.checkout_sale(uuid, uuid, jsonb, jsonb, text) from public;
grant execute on function dental.checkout_sale(uuid, uuid, jsonb, jsonb, text) to authenticated, service_role;

alter table dental.sales enable row level security;
alter table dental.sale_lines enable row level security;
alter table dental.payments enable row level security;

create policy sales_select
on dental.sales
for select
to authenticated
using (
  dental.is_owner()
  or branch_id in (select dental.user_branch_ids())
);

create policy sales_insert
on dental.sales
for insert
to authenticated
with check (
  (dental.can_checkout() or dental.is_owner())
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

create policy sale_lines_select
on dental.sale_lines
for select
to authenticated
using (
  exists (
    select 1 from dental.sales s
    where s.id = sale_id
      and (dental.is_owner() or s.branch_id in (select dental.user_branch_ids()))
  )
);

create policy payments_select
on dental.payments
for select
to authenticated
using (
  exists (
    select 1 from dental.sales s
    where s.id = sale_id
      and (dental.is_owner() or s.branch_id in (select dental.user_branch_ids()))
  )
);

grant select, insert on dental.sales to authenticated, service_role;
grant select, insert on dental.sale_lines to authenticated, service_role;
grant select, insert on dental.payments to authenticated, service_role;
