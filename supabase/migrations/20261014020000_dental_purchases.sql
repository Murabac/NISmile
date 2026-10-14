-- DentaFlow purchases: suppliers, purchase orders, goods receipts.
-- Receiving writes stock_batches and stock_movements (purchase_in).
-- Safe to re-run after a partial apply.

do $$ begin
  create type dental.purchase_status as enum (
    'draft',
    'ordered',
    'partial',
    'received',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.stock_movement_type as enum (
    'purchase_in',
    'sale_out',
    'service_usage',
    'adjustment',
    'write_off',
    'transfer_out',
    'transfer_in'
  );
exception when duplicate_object then null;
end $$;

create table if not exists dental.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists dental.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  supplier_id uuid not null references dental.suppliers (id),
  po_number text not null unique,
  status dental.purchase_status not null default 'draft',
  order_date date not null default current_date,
  expected_date date,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists dental.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references dental.purchase_orders (id) on delete cascade,
  item_id uuid not null references dental.items (id),
  qty_ordered numeric(12, 2) not null check (qty_ordered > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  qty_received numeric(12, 2) not null default 0 check (qty_received >= 0),
  created_at timestamptz not null default now()
);

create table if not exists dental.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references dental.purchase_orders (id),
  branch_id uuid not null references dental.branches (id),
  received_at timestamptz not null default now(),
  received_by uuid references auth.users (id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists dental.goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references dental.goods_receipts (id) on delete cascade,
  purchase_order_line_id uuid not null references dental.purchase_order_lines (id),
  item_id uuid not null references dental.items (id),
  qty numeric(12, 2) not null check (qty > 0),
  batch_no text not null,
  expiry_date date not null,
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

create table if not exists dental.stock_batches (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  item_id uuid not null references dental.items (id),
  batch_no text not null,
  expiry_date date not null,
  qty_remaining numeric(12, 2) not null check (qty_remaining >= 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  goods_receipt_line_id uuid references dental.goods_receipt_lines (id),
  created_at timestamptz not null default now()
);

create table if not exists dental.stock_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  item_id uuid not null references dental.items (id),
  batch_id uuid references dental.stock_batches (id),
  movement_type dental.stock_movement_type not null,
  qty numeric(12, 2) not null,
  ref_type text,
  ref_id uuid,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists purchase_orders_branch_id_idx on dental.purchase_orders (branch_id);
create index if not exists purchase_orders_supplier_id_idx on dental.purchase_orders (supplier_id);
create index if not exists purchase_order_lines_po_id_idx on dental.purchase_order_lines (purchase_order_id);
create index if not exists goods_receipts_po_id_idx on dental.goods_receipts (purchase_order_id);
create index if not exists stock_batches_branch_item_idx on dental.stock_batches (branch_id, item_id);
create index if not exists stock_batches_expiry_idx on dental.stock_batches (expiry_date);
create index if not exists stock_movements_branch_item_idx on dental.stock_movements (branch_id, item_id);

create or replace function dental.can_manage_purchases()
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
      and role in ('owner', 'branch_manager', 'storekeeper')
  );
$$;

revoke all on function dental.can_manage_purchases() from public;
grant execute on function dental.can_manage_purchases() to authenticated;

create or replace function dental.next_po_number()
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
  from dental.purchase_orders
  where po_number like 'PO-' || today || '-%';

  return 'PO-' || today || '-' || lpad(seq::text, 3, '0');
end;
$$;

revoke all on function dental.next_po_number() from public;
grant execute on function dental.next_po_number() to authenticated;

create or replace function dental.receive_purchase_order(
  p_purchase_order_id uuid,
  p_lines jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_po dental.purchase_orders%rowtype;
  v_receipt_id uuid;
  v_line jsonb;
  v_po_line dental.purchase_order_lines%rowtype;
  v_qty numeric(12, 2);
  v_batch text;
  v_expiry date;
  v_unit_cost numeric(12, 2);
  v_receipt_line_id uuid;
  v_batch_id uuid;
  v_open integer;
begin
  if not dental.can_manage_purchases() and not dental.is_owner() then
    raise exception 'Not allowed to receive purchases';
  end if;

  select * into v_po
  from dental.purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then
    raise exception 'Purchase order not found';
  end if;

  if v_po.status in ('received', 'cancelled') then
    raise exception 'Purchase order cannot be received in status %', v_po.status;
  end if;

  if not dental.is_owner() and v_po.branch_id not in (select dental.user_branch_ids()) then
    raise exception 'Branch access denied';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one receipt line is required';
  end if;

  insert into dental.goods_receipts (purchase_order_id, branch_id, received_by, notes)
  values (v_po.id, v_po.branch_id, auth.uid(), p_notes)
  returning id into v_receipt_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    select * into v_po_line
    from dental.purchase_order_lines
    where id = (v_line->>'purchase_order_line_id')::uuid
      and purchase_order_id = v_po.id
    for update;

    if not found then
      raise exception 'PO line not found';
    end if;

    v_qty := (v_line->>'qty')::numeric;
    v_batch := nullif(trim(v_line->>'batch_no'), '');
    v_expiry := (v_line->>'expiry_date')::date;
    v_unit_cost := coalesce((v_line->>'unit_cost')::numeric, v_po_line.unit_cost);

    if v_qty is null or v_qty <= 0 then
      raise exception 'Receipt quantity must be positive';
    end if;
    if v_batch is null then
      raise exception 'Batch number is required';
    end if;
    if v_expiry is null then
      raise exception 'Expiry date is required';
    end if;
    if v_po_line.qty_received + v_qty > v_po_line.qty_ordered then
      raise exception 'Received quantity exceeds ordered quantity for item %', v_po_line.item_id;
    end if;

    insert into dental.goods_receipt_lines (
      goods_receipt_id, purchase_order_line_id, item_id, qty, batch_no, expiry_date, unit_cost
    )
    values (
      v_receipt_id, v_po_line.id, v_po_line.item_id, v_qty, v_batch, v_expiry, v_unit_cost
    )
    returning id into v_receipt_line_id;

    insert into dental.stock_batches (
      branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost, goods_receipt_line_id
    )
    values (
      v_po.branch_id, v_po_line.item_id, v_batch, v_expiry, v_qty, v_unit_cost, v_receipt_line_id
    )
    returning id into v_batch_id;

    insert into dental.stock_movements (
      branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, created_by, notes
    )
    values (
      v_po.branch_id,
      v_po_line.item_id,
      v_batch_id,
      'purchase_in',
      v_qty,
      'goods_receipt',
      v_receipt_id,
      auth.uid(),
      'PO ' || v_po.po_number
    );

    update dental.purchase_order_lines
    set qty_received = qty_received + v_qty
    where id = v_po_line.id;
  end loop;

  select count(*) into v_open
  from dental.purchase_order_lines
  where purchase_order_id = v_po.id
    and qty_received < qty_ordered;

  if v_open = 0 then
    update dental.purchase_orders set status = 'received' where id = v_po.id;
  else
    update dental.purchase_orders set status = 'partial' where id = v_po.id;
  end if;

  return v_receipt_id;
end;
$$;

revoke all on function dental.receive_purchase_order(uuid, jsonb, text) from public;
grant execute on function dental.receive_purchase_order(uuid, jsonb, text) to authenticated;

alter table dental.suppliers enable row level security;
alter table dental.purchase_orders enable row level security;
alter table dental.purchase_order_lines enable row level security;
alter table dental.goods_receipts enable row level security;
alter table dental.goods_receipt_lines enable row level security;
alter table dental.stock_batches enable row level security;
alter table dental.stock_movements enable row level security;

drop policy if exists suppliers_select on dental.suppliers;
drop policy if exists suppliers_write on dental.suppliers;
drop policy if exists purchase_orders_select on dental.purchase_orders;
drop policy if exists purchase_orders_write on dental.purchase_orders;
drop policy if exists purchase_order_lines_select on dental.purchase_order_lines;
drop policy if exists purchase_order_lines_write on dental.purchase_order_lines;
drop policy if exists goods_receipts_select on dental.goods_receipts;
drop policy if exists goods_receipts_insert on dental.goods_receipts;
drop policy if exists goods_receipt_lines_select on dental.goods_receipt_lines;
drop policy if exists goods_receipt_lines_insert on dental.goods_receipt_lines;
drop policy if exists stock_batches_select on dental.stock_batches;
drop policy if exists stock_batches_write on dental.stock_batches;
drop policy if exists stock_movements_select on dental.stock_movements;
drop policy if exists stock_movements_insert on dental.stock_movements;

create policy suppliers_select on dental.suppliers
for select to authenticated using (true);

create policy suppliers_write on dental.suppliers
for all to authenticated
using (dental.can_manage_purchases())
with check (dental.can_manage_purchases());

create policy purchase_orders_select on dental.purchase_orders
for select to authenticated
using (dental.is_owner() or branch_id in (select dental.user_branch_ids()));

create policy purchase_orders_write on dental.purchase_orders
for all to authenticated
using (
  dental.can_manage_purchases()
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
)
with check (
  dental.can_manage_purchases()
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

create policy purchase_order_lines_select on dental.purchase_order_lines
for select to authenticated
using (
  exists (
    select 1 from dental.purchase_orders po
    where po.id = purchase_order_id
      and (dental.is_owner() or po.branch_id in (select dental.user_branch_ids()))
  )
);

create policy purchase_order_lines_write on dental.purchase_order_lines
for all to authenticated
using (
  dental.can_manage_purchases()
  and exists (
    select 1 from dental.purchase_orders po
    where po.id = purchase_order_id
      and (dental.is_owner() or po.branch_id in (select dental.user_branch_ids()))
  )
)
with check (
  dental.can_manage_purchases()
  and exists (
    select 1 from dental.purchase_orders po
    where po.id = purchase_order_id
      and (dental.is_owner() or po.branch_id in (select dental.user_branch_ids()))
  )
);

create policy goods_receipts_select on dental.goods_receipts
for select to authenticated
using (dental.is_owner() or branch_id in (select dental.user_branch_ids()));

create policy goods_receipts_insert on dental.goods_receipts
for insert to authenticated
with check (
  dental.can_manage_purchases()
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

create policy goods_receipt_lines_select on dental.goods_receipt_lines
for select to authenticated
using (
  exists (
    select 1 from dental.goods_receipts gr
    where gr.id = goods_receipt_id
      and (dental.is_owner() or gr.branch_id in (select dental.user_branch_ids()))
  )
);

create policy goods_receipt_lines_insert on dental.goods_receipt_lines
for insert to authenticated
with check (
  dental.can_manage_purchases()
  and exists (
    select 1 from dental.goods_receipts gr
    where gr.id = goods_receipt_id
      and (dental.is_owner() or gr.branch_id in (select dental.user_branch_ids()))
  )
);

create policy stock_batches_select on dental.stock_batches
for select to authenticated
using (dental.is_owner() or branch_id in (select dental.user_branch_ids()));

create policy stock_batches_write on dental.stock_batches
for all to authenticated
using (
  dental.can_manage_purchases()
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
)
with check (
  dental.can_manage_purchases()
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

create policy stock_movements_select on dental.stock_movements
for select to authenticated
using (dental.is_owner() or branch_id in (select dental.user_branch_ids()));

create policy stock_movements_insert on dental.stock_movements
for insert to authenticated
with check (
  dental.can_manage_purchases()
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

grant select, insert, update, delete on dental.suppliers to authenticated, service_role;
grant select, insert, update, delete on dental.purchase_orders to authenticated, service_role;
grant select, insert, update, delete on dental.purchase_order_lines to authenticated, service_role;
grant select, insert, update, delete on dental.goods_receipts to authenticated, service_role;
grant select, insert, update, delete on dental.goods_receipt_lines to authenticated, service_role;
grant select, insert, update, delete on dental.stock_batches to authenticated, service_role;
grant select, insert on dental.stock_movements to authenticated, service_role;
grant usage on type dental.purchase_status to authenticated, service_role;
grant usage on type dental.stock_movement_type to authenticated, service_role;
