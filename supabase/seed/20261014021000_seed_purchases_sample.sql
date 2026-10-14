-- Sample data for step 8 (suppliers & purchases).
-- Skips branch, categories, tax rates, items, and services (already seeded).
-- Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_supplier_gulf uuid;
  v_supplier_local uuid;
  v_supplier_dental uuid;
  v_item_paste uuid;
  v_item_brush uuid;
  v_item_gloves uuid;
  v_item_carton uuid;
  v_po_open uuid;
  v_po_received uuid;
  v_line_paste uuid;
  v_line_brush uuid;
  v_line_gloves uuid;
  v_line_carton uuid;
  v_receipt_id uuid;
  v_receipt_line uuid;
  v_batch_id uuid;
begin
  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;

  if v_branch_id is null then
    raise exception 'No active branch. Run the foundation migration first.';
  end if;

  select id into v_item_paste from dental.items where sku = 'PRD-001';
  select id into v_item_brush from dental.items where sku = 'PRD-002';
  select id into v_item_gloves from dental.items where sku = 'CON-GLV-M100';
  select id into v_item_carton from dental.items where sku = 'WHL-001';

  if v_item_paste is null or v_item_brush is null or v_item_carton is null then
    raise exception 'Catalog items missing. Run the N.I SMILE catalog seed first.';
  end if;

  -- Suppliers ---------------------------------------------------------------
  insert into dental.suppliers (name, phone, email, notes, active)
  values
    (
      'Gulf Dental Supplies',
      '+971 4 000 0000',
      'orders@gulfdental.example',
      'Dubai wholesale oral-care and clinic supply.',
      true
    ),
    (
      'Hargeisa Medical Trading',
      '+252 63 4000000',
      'sales@hargeisamed.example',
      'Local distributor for consumables and retail kits.',
      true
    ),
    (
      'East Africa Oral Care Co.',
      '+252 63 4111111',
      'wholesale@eaoral.example',
      'Cartons and bleaching kits for pharmacies.',
      true
    )
  on conflict (name) do update
  set
    phone = excluded.phone,
    email = excluded.email,
    notes = excluded.notes,
    active = true;

  select id into v_supplier_gulf from dental.suppliers where name = 'Gulf Dental Supplies';
  select id into v_supplier_local from dental.suppliers where name = 'Hargeisa Medical Trading';
  select id into v_supplier_dental from dental.suppliers where name = 'East Africa Oral Care Co.';

  -- Open PO (status ordered) — staff can try Receive in the UI ------------
  insert into dental.purchase_orders (
    id, branch_id, supplier_id, po_number, status, order_date, expected_date, notes
  )
  values (
    coalesce(
      (select id from dental.purchase_orders where po_number = 'PO-SAMPLE-OPEN-001'),
      gen_random_uuid()
    ),
    v_branch_id,
    v_supplier_gulf,
    'PO-SAMPLE-OPEN-001',
    'ordered',
    current_date - 2,
    current_date + 5,
    'Sample open order for toothpaste and sonic brushes.'
  )
  on conflict (po_number) do update
  set
    supplier_id = excluded.supplier_id,
    status = 'ordered',
    expected_date = excluded.expected_date,
    notes = excluded.notes
  returning id into v_po_open;

  delete from dental.purchase_order_lines where purchase_order_id = v_po_open;

  insert into dental.purchase_order_lines (
    purchase_order_id, item_id, qty_ordered, unit_cost, qty_received
  )
  values
    (v_po_open, v_item_paste, 40, 7.50, 0),
    (v_po_open, v_item_brush, 20, 28.00, 0);

  -- Received PO with stock batches ----------------------------------------
  insert into dental.purchase_orders (
    id, branch_id, supplier_id, po_number, status, order_date, expected_date, notes
  )
  values (
    coalesce(
      (select id from dental.purchase_orders where po_number = 'PO-SAMPLE-RECV-001'),
      gen_random_uuid()
    ),
    v_branch_id,
    v_supplier_local,
    'PO-SAMPLE-RECV-001',
    'received',
    current_date - 10,
    current_date - 3,
    'Sample received order. Stock batches already written.'
  )
  on conflict (po_number) do update
  set
    supplier_id = excluded.supplier_id,
    status = 'received',
    notes = excluded.notes
  returning id into v_po_received;

  -- Clear prior sample receipt / stock for this PO so re-runs stay clean.
  delete from dental.stock_movements
  where ref_type = 'goods_receipt'
    and ref_id in (
      select id from dental.goods_receipts where purchase_order_id = v_po_received
    );

  delete from dental.stock_batches
  where goods_receipt_line_id in (
    select grl.id
    from dental.goods_receipt_lines grl
    join dental.goods_receipts gr on gr.id = grl.goods_receipt_id
    where gr.purchase_order_id = v_po_received
  );

  delete from dental.goods_receipt_lines
  where goods_receipt_id in (
    select id from dental.goods_receipts where purchase_order_id = v_po_received
  );

  delete from dental.goods_receipts where purchase_order_id = v_po_received;
  delete from dental.purchase_order_lines where purchase_order_id = v_po_received;

  insert into dental.purchase_order_lines (
    purchase_order_id, item_id, qty_ordered, unit_cost, qty_received
  )
  values
    (v_po_received, coalesce(v_item_gloves, v_item_paste), 100, 4.00, 100),
    (v_po_received, v_item_carton, 5, 320.00, 5);

  select id into v_line_gloves
  from dental.purchase_order_lines
  where purchase_order_id = v_po_received
  order by created_at
  limit 1;

  select id into v_line_carton
  from dental.purchase_order_lines
  where purchase_order_id = v_po_received
    and item_id = v_item_carton;

  insert into dental.goods_receipts (purchase_order_id, branch_id, notes)
  values (v_po_received, v_branch_id, 'Sample seed receipt')
  returning id into v_receipt_id;

  -- Line 1 batch
  insert into dental.goods_receipt_lines (
    goods_receipt_id, purchase_order_line_id, item_id, qty, batch_no, expiry_date, unit_cost
  )
  select
    v_receipt_id,
    v_line_gloves,
    item_id,
    qty_ordered,
    'BATCH-SEED-GLOVES-01',
    (current_date + 540),
    unit_cost
  from dental.purchase_order_lines
  where id = v_line_gloves
  returning id into v_receipt_line;

  insert into dental.stock_batches (
    branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost, goods_receipt_line_id
  )
  select
    v_branch_id,
    item_id,
    batch_no,
    expiry_date,
    qty,
    unit_cost,
    id
  from dental.goods_receipt_lines
  where id = v_receipt_line
  returning id into v_batch_id;

  insert into dental.stock_movements (
    branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, notes
  )
  values (
    v_branch_id,
    (select item_id from dental.goods_receipt_lines where id = v_receipt_line),
    v_batch_id,
    'purchase_in',
    (select qty from dental.goods_receipt_lines where id = v_receipt_line),
    'goods_receipt',
    v_receipt_id,
    'Seed PO-SAMPLE-RECV-001'
  );

  -- Line 2 batch (carton)
  insert into dental.goods_receipt_lines (
    goods_receipt_id, purchase_order_line_id, item_id, qty, batch_no, expiry_date, unit_cost
  )
  select
    v_receipt_id,
    v_line_carton,
    item_id,
    qty_ordered,
    'BATCH-SEED-PASTE-CTN-01',
    (current_date + 720),
    unit_cost
  from dental.purchase_order_lines
  where id = v_line_carton
  returning id into v_receipt_line;

  insert into dental.stock_batches (
    branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost, goods_receipt_line_id
  )
  select
    v_branch_id,
    item_id,
    batch_no,
    expiry_date,
    qty,
    unit_cost,
    id
  from dental.goods_receipt_lines
  where id = v_receipt_line
  returning id into v_batch_id;

  insert into dental.stock_movements (
    branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, notes
  )
  values (
    v_branch_id,
    v_item_carton,
    v_batch_id,
    'purchase_in',
    (select qty from dental.goods_receipt_lines where id = v_receipt_line),
    'goods_receipt',
    v_receipt_id,
    'Seed PO-SAMPLE-RECV-001'
  );

  -- Optional third supplier kept for the Suppliers tab only
  perform 1 from dental.suppliers where id = v_supplier_dental;
end $$;
