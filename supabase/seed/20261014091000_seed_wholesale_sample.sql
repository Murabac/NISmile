-- Sample data for step 16 (wholesale credit).
-- One wholesale customer, one on-account sale, one settlement payment.
-- Skips catalog. Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_customer_id uuid;
  v_item_id uuid;
  v_sale_id uuid;
  v_price numeric(12, 2);
  v_tax numeric(8, 6) := 0;
  v_total numeric(12, 2);
  v_settle numeric(12, 2);
begin
  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;
  if v_branch_id is null then
    raise exception 'No active branch.';
  end if;

  select id into v_item_id from dental.items where sku = 'PRD-001' and active;
  if v_item_id is null then
    raise exception 'PRD-001 missing. Run catalog seed first.';
  end if;

  select id into v_customer_id
  from dental.customers
  where notes = 'SEED-WHOLESALE-CUSTOMER'
  limit 1;

  if v_customer_id is null then
    insert into dental.customers (
      branch_id, name, phone, customer_type, subtype, language,
      whatsapp_opt_in, credit_limit, notes
    )
    values (
      v_branch_id,
      'Hargeisa Dental Supply Co.',
      '+252634555666',
      'wholesale',
      'pharmacy',
      'so',
      true,
      2500,
      'SEED-WHOLESALE-CUSTOMER'
    )
    returning id into v_customer_id;
  end if;

  -- Customer already has the sample on-account sale.
  if exists (
    select 1 from dental.sales
    where customer_id = v_customer_id
      and notes = 'SEED-WHOLESALE-ON-ACCOUNT'
  ) then
    return;
  end if;

  if not exists (
    select 1 from dental.stock_batches
    where branch_id = v_branch_id and item_id = v_item_id and qty_remaining >= 5
  ) then
    insert into dental.stock_batches (
      branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
    )
    values (
      v_branch_id, v_item_id, 'OPEN-WS-PRD-001', current_date + 400, 40, 7.50
    );
  end if;

  v_price := dental.resolve_unit_price('wholesale', 5, v_item_id, null);
  select coalesce(tr.rate, 0) into v_tax
  from dental.items i
  left join dental.tax_rates tr on tr.id = i.tax_rate_id and tr.active
  where i.id = v_item_id;
  v_total := round(v_price * 5, 2) + round(v_price * 5 * coalesce(v_tax, 0), 2);

  select dental.checkout_sale(
    v_branch_id,
    v_customer_id,
    jsonb_build_array(
      jsonb_build_object('line_type', 'item', 'item_id', v_item_id, 'qty', 5)
    ),
    '[]'::jsonb,
    'SEED-WHOLESALE-ON-ACCOUNT',
    current_date + 30
  ) into v_sale_id;

  -- Settle half against the open invoice.
  v_settle := round(v_total / 2, 2);
  perform dental.apply_customer_payment(
    v_branch_id,
    v_customer_id,
    jsonb_build_array(
      jsonb_build_object('tender', 'zaad', 'amount', v_settle, 'reference', 'SEED-ZAAD-WS')
    ),
    v_sale_id
  );
end;
$$;
