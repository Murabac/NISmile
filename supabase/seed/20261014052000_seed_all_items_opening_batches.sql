-- Opening batches for every active item at the primary branch (if none yet).
-- Does not touch items that already have a batch at that branch.
-- Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_item record;
  v_qty numeric(12, 2);
  v_batch_id uuid;
begin
  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;

  if v_branch_id is null then
    raise exception 'No active branch.';
  end if;

  for v_item in
    select i.id, i.sku, i.cost, i.reorder_level
    from dental.items i
    where i.active
      and not exists (
        select 1
        from dental.stock_batches b
        where b.branch_id = v_branch_id
          and b.item_id = i.id
      )
    order by i.sku
  loop
    v_qty := greatest(coalesce(v_item.reorder_level, 0), 5);

    insert into dental.stock_batches (
      branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
    )
    values (
      v_branch_id,
      v_item.id,
      'OPEN-' || v_item.sku,
      current_date + 365,
      v_qty,
      coalesce(v_item.cost, 0)
    )
    returning id into v_batch_id;

    insert into dental.stock_movements (
      branch_id, item_id, batch_id, movement_type, qty, ref_type, notes
    )
    values (
      v_branch_id,
      v_item.id,
      v_batch_id,
      'purchase_in',
      v_qty,
      'seed',
      'Opening batch so item appears on stock counts'
    );
  end loop;
end $$;
