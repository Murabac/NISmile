-- Sample data for step 18 (returns).
-- Partial return of the walk-in sale item (PRD-001), restocked, cash refund.
-- Skips catalog / sales seeds. Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_sale_id uuid;
  v_sale_line_id uuid;
  v_item_qty numeric(12, 2);
  v_line_gross numeric(12, 2);
  v_return_id uuid;
begin
  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;
  if v_branch_id is null then
    raise exception 'No active branch.';
  end if;

  if exists (
    select 1 from dental.returns where notes = 'SEED-RETURN-WALKIN-ITEM'
  ) then
    return;
  end if;

  select id into v_sale_id
  from dental.sales
  where notes = 'SEED-SALE-WALKIN'
  order by created_at
  limit 1;

  if v_sale_id is null then
    raise exception 'SEED-SALE-WALKIN missing. Run sales sample seed first.';
  end if;

  select sl.id, sl.qty, sl.line_gross
  into v_sale_line_id, v_item_qty, v_line_gross
  from dental.sale_lines sl
  where sl.sale_id = v_sale_id
    and sl.line_type = 'item'
  order by sl.sort_order
  limit 1;

  if v_sale_line_id is null then
    raise exception 'Walk-in sale has no item line to return.';
  end if;

  -- Return the full item line (service stays sold).
  select dental.process_return(
    v_branch_id,
    v_sale_id,
    jsonb_build_array(
      jsonb_build_object('sale_line_id', v_sale_line_id, 'qty', v_item_qty)
    ),
    jsonb_build_array(
      jsonb_build_object(
        'tender', 'cash',
        'amount', v_line_gross,
        'reference', 'SEED-REFUND-CASH'
      )
    ),
    true,
    'Customer changed mind',
    'SEED-RETURN-WALKIN-ITEM'
  ) into v_return_id;
end;
$$;
