-- Sample data for step 15 (POS / sales).
-- One walk-in checkout: toothpaste + express whitening, cash paid in full.
-- Skips catalog / purchases / recipes. Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_item_id uuid;
  v_service_id uuid;
  v_item_price numeric(12, 2);
  v_service_price numeric(12, 2);
  v_item_tax numeric(8, 6) := 0;
  v_service_tax numeric(8, 6) := 0;
  v_subtotal numeric(12, 2);
  v_tax_total numeric(12, 2);
  v_total numeric(12, 2);
  v_sale_id uuid;
  v_gloves uuid;
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
    select 1 from dental.sales where notes = 'SEED-SALE-WALKIN'
  ) then
    return;
  end if;

  select id into v_item_id from dental.items where sku = 'PRD-001' and active;
  select id into v_service_id from dental.services where code = 'SRV-002' and active;

  if v_item_id is null or v_service_id is null then
    raise exception 'PRD-001 or SRV-002 missing. Run catalog + recipe seeds first.';
  end if;

  v_item_price := dental.resolve_unit_price('retail', 1, v_item_id, null);
  v_service_price := dental.resolve_unit_price('retail', 1, null, v_service_id);

  select coalesce(tr.rate, 0) into v_item_tax
  from dental.items i
  left join dental.tax_rates tr on tr.id = i.tax_rate_id and tr.active
  where i.id = v_item_id;

  select coalesce(tr.rate, 0) into v_service_tax
  from dental.services s
  left join dental.tax_rates tr on tr.id = s.tax_rate_id and tr.active
  where s.id = v_service_id;

  v_subtotal := round(v_item_price, 2) + round(v_service_price, 2);
  v_tax_total := round(v_item_price * coalesce(v_item_tax, 0), 2)
    + round(v_service_price * coalesce(v_service_tax, 0), 2);
  v_total := v_subtotal + v_tax_total;

  if not exists (
    select 1
    from dental.stock_batches
    where branch_id = v_branch_id
      and item_id = v_item_id
      and qty_remaining > 0
  ) then
    insert into dental.stock_batches (
      branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
    )
    values (
      v_branch_id,
      v_item_id,
      'OPEN-SALE-PRD-001',
      current_date + 400,
      25,
      7.50
    );
  end if;

  -- SRV-002 recipe uses gloves; ensure stock for service_usage.
  select id into v_gloves from dental.items where sku = 'CON-GLV-M100';
  if v_gloves is not null
    and not exists (
      select 1
      from dental.stock_batches
      where branch_id = v_branch_id
        and item_id = v_gloves
        and qty_remaining >= 2
    )
  then
    insert into dental.stock_batches (
      branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
    )
    values (
      v_branch_id,
      v_gloves,
      'OPEN-SALE-GLOVES',
      current_date + 365,
      50,
      4.00
    );
  end if;

  select dental.checkout_sale(
    v_branch_id,
    null,
    jsonb_build_array(
      jsonb_build_object('line_type', 'item', 'item_id', v_item_id, 'qty', 1),
      jsonb_build_object('line_type', 'service', 'service_id', v_service_id, 'qty', 1)
    ),
    jsonb_build_array(
      jsonb_build_object('tender', 'cash', 'amount', v_total)
    ),
    'SEED-SALE-WALKIN'
  ) into v_sale_id;
end;
$$;
