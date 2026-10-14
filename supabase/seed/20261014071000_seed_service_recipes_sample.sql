-- Sample data for step 14 (service recipes).
-- Skips catalog prices / purchases. Sets durations, recipes, one service_usage deduct.
-- Also strips wholesale rows from service_prices (services are patient-priced only).
-- Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_cat_id uuid;
  v_tax_id uuid;
  v_gloves uuid;
  v_floss uuid;
  v_paste uuid;
  v_srv1 uuid;
  v_srv2 uuid;
  v_srv3 uuid;
  v_seeded boolean;
begin
  -- Services never use wholesale price lists.
  delete from dental.service_prices where price_list = 'wholesale';

  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;

  if v_branch_id is null then
    raise exception 'No active branch.';
  end if;

  select exists (
    select 1
    from dental.service_recipes sr
    join dental.services s on s.id = sr.service_id
    where s.code = 'SRV-001'
      and sr.qty = 2
  ) into v_seeded;

  if v_seeded then
    return;
  end if;

  select id into v_cat_id from dental.categories where active order by created_at limit 1;
  select id into v_tax_id from dental.tax_rates where active order by rate desc limit 1;

  select id into v_gloves from dental.items where sku = 'CON-GLV-M100';
  if v_gloves is null then
    insert into dental.items (
      sku, name, category_id, unit, cost, reorder_level, tax_rate_id, active
    )
    values (
      'CON-GLV-M100',
      'Latex Gloves M (Box of 100)',
      v_cat_id,
      'Box',
      4.00,
      20,
      v_tax_id,
      true
    )
    returning id into v_gloves;
  end if;

  select id into v_floss from dental.items where sku = 'PRD-006';
  select id into v_paste from dental.items where sku = 'PRD-001';
  if v_floss is null or v_paste is null then
    raise exception 'Catalog items PRD-001 / PRD-006 missing. Run catalog seed first.';
  end if;

  select id into v_srv1 from dental.services where code = 'SRV-001';
  select id into v_srv2 from dental.services where code = 'SRV-002';
  select id into v_srv3 from dental.services where code = 'SRV-003';
  if v_srv1 is null or v_srv2 is null or v_srv3 is null then
    raise exception 'Whitening services missing. Run catalog seed first.';
  end if;

  update dental.services set duration_minutes = 60 where id = v_srv1 and duration_minutes is null;
  update dental.services set duration_minutes = 30 where id = v_srv2 and duration_minutes is null;
  update dental.services set duration_minutes = 75 where id = v_srv3 and duration_minutes is null;

  insert into dental.service_recipes (service_id, item_id, qty)
  values
    (v_srv1, v_gloves, 2),
    (v_srv1, v_floss, 1),
    (v_srv1, v_paste, 1),
    (v_srv2, v_gloves, 2),
    (v_srv3, v_gloves, 2),
    (v_srv3, v_floss, 1)
  on conflict (service_id, item_id) do update
  set qty = excluded.qty;

  -- One FEFO service_usage so Stock movements show recipe deduction.
  if not exists (
    select 1
    from dental.stock_movements
    where movement_type = 'service_usage'
      and notes = 'Recipe: SRV-002'
      and branch_id = v_branch_id
  ) then
    -- Ensure gloves have stock at the branch for the sample deduct.
    if not exists (
      select 1
      from dental.stock_batches
      where branch_id = v_branch_id
        and item_id = v_gloves
        and qty_remaining > 0
    ) then
      insert into dental.stock_batches (
        branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
      )
      values (
        v_branch_id,
        v_gloves,
        'OPEN-RECIPE-GLOVES',
        current_date + 365,
        50,
        4.00
      );
    end if;

    perform dental.apply_service_recipe(
      v_branch_id,
      v_srv2,
      'seed',
      v_srv2
    );
  end if;
end;
$$;
