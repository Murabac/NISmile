-- DentaFlow stock transfers between branches.
-- draft → in_transit → received, or cancelled (draft only).
-- Stock leaves source on send (FEFO); enters destination on receive.
-- Short receives write an adjustment for the difference.

do $$ begin
  create type dental.transfer_status as enum (
    'draft',
    'in_transit',
    'received',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists dental.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text not null unique,
  from_branch_id uuid not null references dental.branches (id),
  to_branch_id uuid not null references dental.branches (id),
  status dental.transfer_status not null default 'draft',
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  received_at timestamptz,
  received_by uuid references auth.users (id),
  check (from_branch_id <> to_branch_id)
);

create table if not exists dental.stock_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references dental.stock_transfers (id) on delete cascade,
  item_id uuid not null references dental.items (id),
  qty_requested numeric(12, 2) not null check (qty_requested > 0),
  qty_received numeric(12, 2) check (qty_received is null or qty_received >= 0),
  created_at timestamptz not null default now()
);

-- Batches pulled from source on send; used to recreate stock at destination.
create table if not exists dental.stock_transfer_allocations (
  id uuid primary key default gen_random_uuid(),
  transfer_line_id uuid not null references dental.stock_transfer_lines (id) on delete cascade,
  from_batch_id uuid references dental.stock_batches (id),
  batch_no text not null,
  expiry_date date not null,
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  qty numeric(12, 2) not null check (qty > 0),
  created_at timestamptz not null default now()
);

create index if not exists stock_transfers_from_branch_idx on dental.stock_transfers (from_branch_id);
create index if not exists stock_transfers_to_branch_idx on dental.stock_transfers (to_branch_id);
create index if not exists stock_transfer_lines_transfer_idx on dental.stock_transfer_lines (transfer_id);
create index if not exists stock_transfer_allocations_line_idx on dental.stock_transfer_allocations (transfer_line_id);

create or replace function dental.can_manage_transfers()
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

revoke all on function dental.can_manage_transfers() from public;
grant execute on function dental.can_manage_transfers() to authenticated;

create or replace function dental.next_transfer_number()
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
  from dental.stock_transfers
  where transfer_number like 'TRF-' || today || '-%';

  return 'TRF-' || today || '-' || lpad(seq::text, 3, '0');
end;
$$;

revoke all on function dental.next_transfer_number() from public;
grant execute on function dental.next_transfer_number() to authenticated, service_role;

create or replace function dental.create_stock_transfer(
  p_from_branch_id uuid,
  p_to_branch_id uuid,
  p_lines jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_qty numeric(12, 2);
begin
  if auth.uid() is not null then
    if not dental.can_manage_transfers() and not dental.is_owner() then
      raise exception 'Not allowed to create transfers';
    end if;
    if not dental.is_owner() and p_from_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if p_from_branch_id = p_to_branch_id then
    raise exception 'Source and destination must differ';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one transfer line is required';
  end if;

  insert into dental.stock_transfers (
    transfer_number, from_branch_id, to_branch_id, status, notes, created_by
  )
  values (
    dental.next_transfer_number(),
    p_from_branch_id,
    p_to_branch_id,
    'draft',
    p_notes,
    auth.uid()
  )
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := (v_line->>'item_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    if v_item_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Each line needs item_id and positive qty';
    end if;
    insert into dental.stock_transfer_lines (transfer_id, item_id, qty_requested)
    values (v_id, v_item_id, v_qty);
  end loop;

  return v_id;
end;
$$;

revoke all on function dental.create_stock_transfer(uuid, uuid, jsonb, text) from public;
grant execute on function dental.create_stock_transfer(uuid, uuid, jsonb, text) to authenticated, service_role;

create or replace function dental.send_stock_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_tr dental.stock_transfers%rowtype;
  v_line dental.stock_transfer_lines%rowtype;
  v_remaining numeric(12, 2);
  v_batch dental.stock_batches%rowtype;
  v_take numeric(12, 2);
begin
  if auth.uid() is not null then
    if not dental.can_manage_transfers() and not dental.is_owner() then
      raise exception 'Not allowed to send transfers';
    end if;
  end if;

  select * into v_tr
  from dental.stock_transfers
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer not found';
  end if;

  if v_tr.status <> 'draft' then
    raise exception 'Only draft transfers can be sent';
  end if;

  if auth.uid() is not null
     and not dental.is_owner()
     and v_tr.from_branch_id not in (select dental.user_branch_ids()) then
    raise exception 'Branch access denied';
  end if;

  for v_line in
    select * from dental.stock_transfer_lines
    where transfer_id = v_tr.id
    for update
  loop
    v_remaining := v_line.qty_requested;

    for v_batch in
      select *
      from dental.stock_batches
      where branch_id = v_tr.from_branch_id
        and item_id = v_line.item_id
        and qty_remaining > 0
      order by expiry_date asc, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_batch.qty_remaining, v_remaining);

      update dental.stock_batches
      set qty_remaining = qty_remaining - v_take
      where id = v_batch.id;

      insert into dental.stock_transfer_allocations (
        transfer_line_id, from_batch_id, batch_no, expiry_date, unit_cost, qty
      )
      values (
        v_line.id, v_batch.id, v_batch.batch_no, v_batch.expiry_date, v_batch.unit_cost, v_take
      );

      insert into dental.stock_movements (
        branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, created_by, notes
      )
      values (
        v_tr.from_branch_id,
        v_line.item_id,
        v_batch.id,
        'transfer_out',
        -v_take,
        'stock_transfer',
        v_tr.id,
        auth.uid(),
        'Transfer ' || v_tr.transfer_number
      );

      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'Insufficient stock for item % (short by %)', v_line.item_id, v_remaining;
    end if;
  end loop;

  update dental.stock_transfers
  set status = 'in_transit', sent_at = timezone('utc', now())
  where id = v_tr.id;
end;
$$;

revoke all on function dental.send_stock_transfer(uuid) from public;
grant execute on function dental.send_stock_transfer(uuid) to authenticated, service_role;

create or replace function dental.receive_stock_transfer(
  p_transfer_id uuid,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_tr dental.stock_transfers%rowtype;
  v_line_json jsonb;
  v_line dental.stock_transfer_lines%rowtype;
  v_qty_recv numeric(12, 2);
  v_short numeric(12, 2);
  v_alloc dental.stock_transfer_allocations%rowtype;
  v_need numeric(12, 2);
  v_take numeric(12, 2);
  v_batch_id uuid;
begin
  if auth.uid() is not null then
    if not dental.can_manage_transfers() and not dental.is_owner() then
      raise exception 'Not allowed to receive transfers';
    end if;
  end if;

  select * into v_tr
  from dental.stock_transfers
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer not found';
  end if;

  if v_tr.status <> 'in_transit' then
    raise exception 'Only in-transit transfers can be received';
  end if;

  if auth.uid() is not null
     and not dental.is_owner()
     and v_tr.to_branch_id not in (select dental.user_branch_ids()) then
    raise exception 'Branch access denied';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Receipt lines are required';
  end if;

  for v_line_json in select * from jsonb_array_elements(p_lines)
  loop
    select * into v_line
    from dental.stock_transfer_lines
    where id = (v_line_json->>'transfer_line_id')::uuid
      and transfer_id = v_tr.id
    for update;

    if not found then
      raise exception 'Transfer line not found';
    end if;

    v_qty_recv := (v_line_json->>'qty_received')::numeric;
    if v_qty_recv is null or v_qty_recv < 0 then
      raise exception 'qty_received must be zero or positive';
    end if;
    if v_qty_recv > v_line.qty_requested then
      raise exception 'Cannot receive more than sent for item %', v_line.item_id;
    end if;

    update dental.stock_transfer_lines
    set qty_received = v_qty_recv
    where id = v_line.id;

    v_need := v_qty_recv;
    for v_alloc in
      select *
      from dental.stock_transfer_allocations
      where transfer_line_id = v_line.id
      order by expiry_date asc, created_at asc
    loop
      exit when v_need <= 0;
      v_take := least(v_alloc.qty, v_need);

      insert into dental.stock_batches (
        branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
      )
      values (
        v_tr.to_branch_id,
        v_line.item_id,
        v_alloc.batch_no,
        v_alloc.expiry_date,
        v_take,
        v_alloc.unit_cost
      )
      returning id into v_batch_id;

      insert into dental.stock_movements (
        branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, created_by, notes
      )
      values (
        v_tr.to_branch_id,
        v_line.item_id,
        v_batch_id,
        'transfer_in',
        v_take,
        'stock_transfer',
        v_tr.id,
        auth.uid(),
        'Transfer ' || v_tr.transfer_number
      );

      v_need := v_need - v_take;
    end loop;

    v_short := v_line.qty_requested - v_qty_recv;
    if v_short > 0 then
      insert into dental.stock_movements (
        branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, created_by, notes
      )
      values (
        v_tr.to_branch_id,
        v_line.item_id,
        null,
        'adjustment',
        -v_short,
        'stock_transfer',
        v_tr.id,
        auth.uid(),
        'Short receive on ' || v_tr.transfer_number || ' (in-transit variance)'
      );
    end if;
  end loop;

  update dental.stock_transfers
  set
    status = 'received',
    received_at = timezone('utc', now()),
    received_by = auth.uid()
  where id = v_tr.id;
end;
$$;

revoke all on function dental.receive_stock_transfer(uuid, jsonb) from public;
grant execute on function dental.receive_stock_transfer(uuid, jsonb) to authenticated, service_role;

create or replace function dental.cancel_stock_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_tr dental.stock_transfers%rowtype;
begin
  if auth.uid() is not null then
    if not dental.can_manage_transfers() and not dental.is_owner() then
      raise exception 'Not allowed to cancel transfers';
    end if;
  end if;

  select * into v_tr
  from dental.stock_transfers
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer not found';
  end if;

  if v_tr.status <> 'draft' then
    raise exception 'Only draft transfers can be cancelled';
  end if;

  if auth.uid() is not null
     and not dental.is_owner()
     and v_tr.from_branch_id not in (select dental.user_branch_ids()) then
    raise exception 'Branch access denied';
  end if;

  update dental.stock_transfers
  set status = 'cancelled'
  where id = v_tr.id;
end;
$$;

revoke all on function dental.cancel_stock_transfer(uuid) from public;
grant execute on function dental.cancel_stock_transfer(uuid) to authenticated, service_role;

alter table dental.stock_transfers enable row level security;
alter table dental.stock_transfer_lines enable row level security;
alter table dental.stock_transfer_allocations enable row level security;

drop policy if exists stock_transfers_select on dental.stock_transfers;
drop policy if exists stock_transfers_insert on dental.stock_transfers;
drop policy if exists stock_transfers_update on dental.stock_transfers;
drop policy if exists stock_transfer_lines_select on dental.stock_transfer_lines;
drop policy if exists stock_transfer_lines_write on dental.stock_transfer_lines;
drop policy if exists stock_transfer_allocations_select on dental.stock_transfer_allocations;

create policy stock_transfers_select on dental.stock_transfers
for select to authenticated
using (
  dental.is_owner()
  or from_branch_id in (select dental.user_branch_ids())
  or to_branch_id in (select dental.user_branch_ids())
);

-- Writes go through security-definer RPCs.
create policy stock_transfer_lines_select on dental.stock_transfer_lines
for select to authenticated
using (
  exists (
    select 1 from dental.stock_transfers t
    where t.id = transfer_id
      and (
        dental.is_owner()
        or t.from_branch_id in (select dental.user_branch_ids())
        or t.to_branch_id in (select dental.user_branch_ids())
      )
  )
);

create policy stock_transfer_allocations_select on dental.stock_transfer_allocations
for select to authenticated
using (
  exists (
    select 1
    from dental.stock_transfer_lines l
    join dental.stock_transfers t on t.id = l.transfer_id
    where l.id = transfer_line_id
      and (
        dental.is_owner()
        or t.from_branch_id in (select dental.user_branch_ids())
        or t.to_branch_id in (select dental.user_branch_ids())
      )
  )
);

grant select on dental.stock_transfers to authenticated, service_role;
grant select on dental.stock_transfer_lines to authenticated, service_role;
grant select on dental.stock_transfer_allocations to authenticated, service_role;
grant select, insert, update, delete on dental.stock_transfers to service_role;
grant select, insert, update, delete on dental.stock_transfer_lines to service_role;
grant select, insert, update, delete on dental.stock_transfer_allocations to service_role;
grant usage on type dental.transfer_status to authenticated, service_role;
