-- Sample data for step 9 (stock ledger).
-- Skips catalog, services, and purchase POs/suppliers (already seeded).
-- Adds a second FEFO gloves batch and one gloves write-off (FEFO).
-- Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_item_gloves uuid;
  v_batch_early uuid;
  v_existing uuid;
begin
  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;

  if v_branch_id is null then
    raise exception 'No active branch. Run the foundation migration first.';
  end if;

  select id into v_item_gloves from dental.items where sku = 'CON-GLV-M100';

  if v_item_gloves is null then
    raise exception 'Gloves item CON-GLV-M100 missing. Run purchase sample seed first.';
  end if;

  -- Earlier-expiry gloves batch so FEFO has two candidates -------------------
  select id into v_existing
  from dental.stock_batches
  where branch_id = v_branch_id
    and item_id = v_item_gloves
    and batch_no = 'BATCH-SEED-GLOVES-FEFO';

  if v_existing is null then
    insert into dental.stock_batches (
      branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
    )
    values (
      v_branch_id,
      v_item_gloves,
      'BATCH-SEED-GLOVES-FEFO',
      current_date + 45,
      20,
      4.5
    )
    returning id into v_batch_early;

    insert into dental.stock_movements (
      branch_id, item_id, batch_id, movement_type, qty, ref_type, notes
    )
    values (
      v_branch_id,
      v_item_gloves,
      v_batch_early,
      'purchase_in',
      20,
      'seed',
      'Ledger sample: earlier expiry FEFO batch'
    );
  end if;

  -- One FEFO write-off on gloves (hits earliest-expiry batch first) ----------
  if not exists (
       select 1
       from dental.stock_movements
       where branch_id = v_branch_id
         and item_id = v_item_gloves
         and ref_type = 'adjustment'
         and notes like 'Expired batch:%SEED-LEDGER%'
     )
     and exists (
       select 1
       from dental.stock_batches
       where branch_id = v_branch_id
         and item_id = v_item_gloves
         and qty_remaining >= 1
     )
  then
    perform dental.adjust_stock(
      v_branch_id,
      v_item_gloves,
      -1,
      'Expired batch',
      'SEED-LEDGER damaged unit removed from shelf',
      null
    );
  end if;
end $$;
