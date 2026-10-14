-- DentaFlow stock ledger: FEFO deduction and adjustments.
-- stock_batches / stock_movements already exist from purchases.
-- Quantity changes go through these functions only.

create or replace function dental.can_manage_stock()
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

revoke all on function dental.can_manage_stock() from public;
grant execute on function dental.can_manage_stock() to authenticated;

-- Deduct a positive quantity using FEFO (earliest expiry first).
-- Writes negative stock_movements and reduces qty_remaining.
create or replace function dental.deduct_stock_fefo(
  p_branch_id uuid,
  p_item_id uuid,
  p_qty numeric,
  p_movement_type dental.stock_movement_type,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_remaining numeric(12, 2);
  v_batch dental.stock_batches%rowtype;
  v_take numeric(12, 2);
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Deduction quantity must be positive';
  end if;

  if p_movement_type not in (
    'sale_out', 'service_usage', 'adjustment', 'write_off', 'transfer_out'
  ) then
    raise exception 'Movement type % cannot deduct stock', p_movement_type;
  end if;

  -- auth.uid() is null when run from SQL editor / service role seeds.
  if auth.uid() is not null then
    if dental.is_owner() or dental.can_manage_stock() then
      null;
    elsif p_movement_type in ('sale_out', 'service_usage')
      and exists (select 1 from dental.profiles where user_id = auth.uid()) then
      null;
    else
      raise exception 'Not allowed to change stock';
    end if;

    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  v_remaining := p_qty;

  for v_batch in
    select *
    from dental.stock_batches
    where branch_id = p_branch_id
      and item_id = p_item_id
      and qty_remaining > 0
    order by expiry_date asc, created_at asc
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(v_batch.qty_remaining, v_remaining);

    update dental.stock_batches
    set qty_remaining = qty_remaining - v_take
    where id = v_batch.id;

    insert into dental.stock_movements (
      branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, created_by, notes
    )
    values (
      p_branch_id,
      p_item_id,
      v_batch.id,
      p_movement_type,
      -v_take,
      p_ref_type,
      p_ref_id,
      auth.uid(),
      p_notes
    );

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Insufficient stock for item % (short by %)', p_item_id, v_remaining;
  end if;
end;
$$;

revoke all on function dental.deduct_stock_fefo(uuid, uuid, numeric, dental.stock_movement_type, text, uuid, text) from public;
grant execute on function dental.deduct_stock_fefo(uuid, uuid, numeric, dental.stock_movement_type, text, uuid, text) to authenticated, service_role;

-- Manual stock adjustment (+ or -). Decreases use FEFO unless a batch is named.
create or replace function dental.adjust_stock(
  p_branch_id uuid,
  p_item_id uuid,
  p_qty_delta numeric,
  p_reason text,
  p_notes text default null,
  p_batch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_item dental.items%rowtype;
  v_batch dental.stock_batches%rowtype;
  v_batch_id uuid;
  v_movement dental.stock_movement_type;
  v_note text;
  v_abs numeric(12, 2);
begin
  if auth.uid() is not null then
    if not dental.can_manage_stock() and not dental.is_owner() then
      raise exception 'Not allowed to adjust stock';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if p_qty_delta is null or p_qty_delta = 0 then
    raise exception 'Adjustment quantity cannot be zero';
  end if;

  select * into v_item from dental.items where id = p_item_id;
  if not found then
    raise exception 'Item not found';
  end if;

  v_note := trim(both from coalesce(p_reason, '') ||
    case when nullif(trim(p_notes), '') is null then '' else ': ' || trim(p_notes) end);

  if lower(coalesce(p_reason, '')) like '%expir%' then
    v_movement := 'write_off';
  else
    v_movement := 'adjustment';
  end if;

  if p_qty_delta > 0 then
    if p_batch_id is not null then
      select * into v_batch
      from dental.stock_batches
      where id = p_batch_id
        and branch_id = p_branch_id
        and item_id = p_item_id
      for update;

      if not found then
        raise exception 'Batch not found for this item and branch';
      end if;

      update dental.stock_batches
      set qty_remaining = qty_remaining + p_qty_delta
      where id = v_batch.id;

      v_batch_id := v_batch.id;
    else
      insert into dental.stock_batches (
        branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
      )
      values (
        p_branch_id,
        p_item_id,
        'ADJ-' || to_char(timezone('utc', now()), 'YYYYMMDD-HH24MISS'),
        (current_date + 730),
        p_qty_delta,
        coalesce(v_item.cost, 0)
      )
      returning id into v_batch_id;
    end if;

    insert into dental.stock_movements (
      branch_id, item_id, batch_id, movement_type, qty, ref_type, created_by, notes
    )
    values (
      p_branch_id,
      p_item_id,
      v_batch_id,
      'adjustment',
      p_qty_delta,
      'adjustment',
      auth.uid(),
      v_note
    );
  else
    v_abs := abs(p_qty_delta);

    if p_batch_id is not null then
      select * into v_batch
      from dental.stock_batches
      where id = p_batch_id
        and branch_id = p_branch_id
        and item_id = p_item_id
      for update;

      if not found then
        raise exception 'Batch not found for this item and branch';
      end if;

      if v_batch.qty_remaining < v_abs then
        raise exception 'Batch has only % remaining', v_batch.qty_remaining;
      end if;

      update dental.stock_batches
      set qty_remaining = qty_remaining - v_abs
      where id = v_batch.id;

      insert into dental.stock_movements (
        branch_id, item_id, batch_id, movement_type, qty, ref_type, created_by, notes
      )
      values (
        p_branch_id,
        p_item_id,
        v_batch.id,
        v_movement,
        -v_abs,
        'adjustment',
        auth.uid(),
        v_note
      );
    else
      perform dental.deduct_stock_fefo(
        p_branch_id,
        p_item_id,
        v_abs,
        v_movement,
        'adjustment',
        null,
        v_note
      );
    end if;
  end if;
end;
$$;

revoke all on function dental.adjust_stock(uuid, uuid, numeric, text, text, uuid) from public;
grant execute on function dental.adjust_stock(uuid, uuid, numeric, text, text, uuid) to authenticated, service_role;

-- Quantity changes only through security-definer functions (and purchases receive).
revoke insert, update, delete on dental.stock_batches from authenticated;
revoke insert, update, delete on dental.stock_movements from authenticated;
grant select on dental.stock_batches to authenticated, service_role;
grant select on dental.stock_movements to authenticated, service_role;
grant select, insert, update, delete on dental.stock_batches to service_role;
grant select, insert on dental.stock_movements to service_role;

drop policy if exists stock_batches_write on dental.stock_batches;
drop policy if exists stock_movements_insert on dental.stock_movements;
