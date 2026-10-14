-- Sample data for step 11 (stock transfers).
-- Adds a second demo branch so transfers can run; does not re-seed catalog/purchases/ledger.
-- Safe to re-run.

do $$
declare
  v_main uuid;
  v_north uuid;
  v_gloves uuid;
  v_draft uuid;
  v_transit uuid;
begin
  select id into v_main
  from dental.branches
  where active
  order by created_at
  limit 1;

  if v_main is null then
    raise exception 'No active branch.';
  end if;

  select id into v_north
  from dental.branches
  where name = 'Hargeisa North'
  limit 1;

  if v_north is null then
    insert into dental.branches (name, address, phone, active)
    values (
      'Hargeisa North',
      'North Road, Hargeisa, Somaliland',
      '+252 63 0000000',
      true
    )
    returning id into v_north;
  end if;

  select id into v_gloves from dental.items where sku = 'CON-GLV-M100';
  if v_gloves is null then
    raise exception 'Gloves item missing. Seed catalog and purchases first.';
  end if;

  -- Draft transfer (not sent) -------------------------------------------------
  if not exists (
    select 1 from dental.stock_transfers
    where notes = 'SEED-TRANSFER-DRAFT'
  ) then
    v_draft := dental.create_stock_transfer(
      v_main,
      v_north,
      jsonb_build_array(
        jsonb_build_object('item_id', v_gloves, 'qty', 5)
      ),
      'SEED-TRANSFER-DRAFT'
    );
  end if;

  -- In-transit transfer (sent, ready to receive at North) ---------------------
  if not exists (
    select 1 from dental.stock_transfers
    where notes = 'SEED-TRANSFER-IN-TRANSIT'
  ) then
    if not exists (
      select 1
      from dental.stock_batches
      where branch_id = v_main
        and item_id = v_gloves
        and qty_remaining >= 10
    ) then
      raise exception 'Not enough gloves on main branch to seed in-transit transfer.';
    end if;

    v_transit := dental.create_stock_transfer(
      v_main,
      v_north,
      jsonb_build_array(
        jsonb_build_object('item_id', v_gloves, 'qty', 10)
      ),
      'SEED-TRANSFER-IN-TRANSIT'
    );
    perform dental.send_stock_transfer(v_transit);
  end if;
end $$;
