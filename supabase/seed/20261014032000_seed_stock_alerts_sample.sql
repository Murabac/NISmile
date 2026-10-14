-- Sample data for step 10 (stock alerts).
-- Skips catalog/purchases/ledger domains already seeded; only shapes alert scenarios.
-- Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_item_gloves uuid;
  v_item_carton uuid;
  v_batch_id uuid;
  v_existing uuid;
  v_qty numeric;
begin
  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;

  if v_branch_id is null then
    raise exception 'No active branch.';
  end if;

  select id into v_item_gloves from dental.items where sku = 'CON-GLV-M100';
  select id into v_item_carton from dental.items where sku = 'WHL-001';

  if v_item_gloves is null then
    raise exception 'Gloves item missing.';
  end if;

  -- Low stock: raise reorder above current on-hand ------------------------------
  update dental.items
  set reorder_level = 200
  where id = v_item_gloves
    and reorder_level < 200;

  -- Near expiry ≤30d: dedicated alert batch -----------------------------------
  select id into v_existing
  from dental.stock_batches
  where branch_id = v_branch_id
    and item_id = v_item_gloves
    and batch_no = 'BATCH-SEED-ALERT-30D';

  if v_existing is null then
    insert into dental.stock_batches (
      branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
    )
    values (
      v_branch_id,
      v_item_gloves,
      'BATCH-SEED-ALERT-30D',
      current_date + 18,
      8,
      4.5
    )
    returning id into v_batch_id;

    insert into dental.stock_movements (
      branch_id, item_id, batch_id, movement_type, qty, ref_type, notes
    )
    values (
      v_branch_id,
      v_item_gloves,
      v_batch_id,
      'purchase_in',
      8,
      'seed',
      'Alert sample: expires within 30 days'
    );
  end if;

  -- Near expiry ≤60d (but >30): optional second band --------------------------
  select id into v_existing
  from dental.stock_batches
  where branch_id = v_branch_id
    and item_id = v_item_gloves
    and batch_no = 'BATCH-SEED-ALERT-60D';

  if v_existing is null then
    insert into dental.stock_batches (
      branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
    )
    values (
      v_branch_id,
      v_item_gloves,
      'BATCH-SEED-ALERT-60D',
      current_date + 50,
      6,
      4.5
    )
    returning id into v_batch_id;

    insert into dental.stock_movements (
      branch_id, item_id, batch_id, movement_type, qty, ref_type, notes
    )
    values (
      v_branch_id,
      v_item_gloves,
      v_batch_id,
      'purchase_in',
      6,
      'seed',
      'Alert sample: expires within 60 days'
    );
  end if;

  -- Out of stock: zero the wholesale carton that was received -----------------
  if v_item_carton is not null then
    select coalesce(sum(qty_remaining), 0) into v_qty
    from dental.stock_batches
    where branch_id = v_branch_id
      and item_id = v_item_carton;

    if v_qty > 0
       and not exists (
         select 1
         from dental.stock_movements
         where branch_id = v_branch_id
           and item_id = v_item_carton
           and notes like 'Expired batch:%SEED-ALERT-OUT%'
       )
    then
      perform dental.adjust_stock(
        v_branch_id,
        v_item_carton,
        -v_qty,
        'Expired batch',
        'SEED-ALERT-OUT cleared for out-of-stock demo',
        null
      );
    end if;
  end if;
end $$;
