-- DentaFlow returns (step 18).
-- Linked to original sale; optional item restock; refund tenders or AR credit.
-- Restock writes stock_movements as adjustment (ref_type return).
-- Points / promotions reverse when those modules exist (stubs only here).

create table if not exists dental.returns (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  sale_id uuid not null references dental.sales (id),
  return_number text not null unique,
  restock boolean not null default true,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  tax_total numeric(12, 2) not null check (tax_total >= 0),
  total numeric(12, 2) not null check (total >= 0),
  refund_total numeric(12, 2) not null default 0 check (refund_total >= 0),
  reason text,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists dental.return_lines (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references dental.returns (id) on delete cascade,
  sale_line_id uuid not null references dental.sale_lines (id),
  qty numeric(12, 2) not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  tax_rate numeric(8, 6) not null check (tax_rate >= 0),
  tax_amount numeric(12, 2) not null check (tax_amount >= 0),
  line_net numeric(12, 2) not null check (line_net >= 0),
  line_gross numeric(12, 2) not null check (line_gross >= 0),
  restocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists dental.return_refunds (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references dental.returns (id) on delete cascade,
  tender dental.payment_tender not null,
  amount numeric(12, 2) not null check (amount > 0),
  reference text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists returns_sale_id_idx on dental.returns (sale_id);
create index if not exists returns_branch_id_idx on dental.returns (branch_id);
create index if not exists return_lines_return_id_idx on dental.return_lines (return_id);
create index if not exists return_lines_sale_line_id_idx on dental.return_lines (sale_line_id);
create index if not exists return_refunds_return_id_idx on dental.return_refunds (return_id);

create or replace function dental.next_return_number()
returns text
language plpgsql
security definer
set search_path = dental
as $$
declare
  today text := to_char(timezone('utc', now()), 'YYYYMMDD');
  seq integer;
begin
  select count(*)::integer + 1
  into seq
  from dental.returns
  where return_number like 'RET-' || today || '-%';

  return 'RET-' || today || '-' || lpad(seq::text, 3, '0');
end;
$$;

revoke all on function dental.next_return_number() from public;
grant execute on function dental.next_return_number() to authenticated, service_role;

-- Put qty back onto original sale_out batches when possible; else new RET batch.
create or replace function dental.restock_sale_item(
  p_branch_id uuid,
  p_item_id uuid,
  p_qty numeric,
  p_sale_id uuid,
  p_return_id uuid
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_remaining numeric(12, 2) := p_qty;
  v_take numeric(12, 2);
  v_mov record;
  v_item dental.items%rowtype;
  v_batch_id uuid;
  v_unit_cost numeric(12, 2);
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Restock quantity must be positive';
  end if;

  for v_mov in
    select m.id, m.batch_id, abs(m.qty) as qty_out
    from dental.stock_movements m
    where m.branch_id = p_branch_id
      and m.item_id = p_item_id
      and m.ref_type = 'sale'
      and m.ref_id = p_sale_id
      and m.movement_type = 'sale_out'
      and m.batch_id is not null
    order by m.created_at desc, m.id desc
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_mov.qty_out);
    if v_take <= 0 then
      continue;
    end if;

    update dental.stock_batches
    set qty_remaining = qty_remaining + v_take
    where id = v_mov.batch_id
      and branch_id = p_branch_id
      and item_id = p_item_id;

    if not found then
      continue;
    end if;

    insert into dental.stock_movements (
      branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, created_by, notes
    )
    values (
      p_branch_id,
      p_item_id,
      v_mov.batch_id,
      'adjustment',
      v_take,
      'return',
      p_return_id,
      auth.uid(),
      'Return restock'
    );

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    select * into v_item from dental.items where id = p_item_id;
    v_unit_cost := coalesce(v_item.cost, 0);

    insert into dental.stock_batches (
      branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
    )
    values (
      p_branch_id,
      p_item_id,
      'RET-' || to_char(timezone('utc', now()), 'YYYYMMDD-HH24MISS'),
      current_date + 365,
      v_remaining,
      v_unit_cost
    )
    returning id into v_batch_id;

    insert into dental.stock_movements (
      branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, created_by, notes
    )
    values (
      p_branch_id,
      p_item_id,
      v_batch_id,
      'adjustment',
      v_remaining,
      'return',
      p_return_id,
      auth.uid(),
      'Return restock (new batch)'
    );
  end if;
end;
$$;

revoke all on function dental.restock_sale_item(uuid, uuid, numeric, uuid, uuid) from public;
grant execute on function dental.restock_sale_item(uuid, uuid, numeric, uuid, uuid) to authenticated, service_role;

-- p_lines: [{ sale_line_id, qty }]
-- p_refunds: [{ tender, amount, reference? }] — required when refund cash is due
-- p_restock: restock returned item qty (services never restock materials)
create or replace function dental.process_return(
  p_branch_id uuid,
  p_sale_id uuid,
  p_lines jsonb,
  p_refunds jsonb default '[]'::jsonb,
  p_restock boolean default true,
  p_reason text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_sale dental.sales%rowtype;
  v_return_id uuid;
  v_return_number text;
  v_line jsonb;
  v_sale_line dental.sale_lines%rowtype;
  v_qty numeric(12, 2);
  v_already numeric(12, 2);
  v_avail numeric(12, 2);
  v_ratio numeric;
  v_line_net numeric(12, 2);
  v_tax_amount numeric(12, 2);
  v_line_gross numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_tax_total numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_unpaid numeric(12, 2);
  v_refund_due numeric(12, 2);
  v_refund_sum numeric(12, 2) := 0;
  v_pay jsonb;
  v_tender dental.payment_tender;
  v_amount numeric(12, 2);
  v_restocked boolean;
  v_new_subtotal numeric(12, 2);
  v_new_tax numeric(12, 2);
  v_new_total numeric(12, 2);
  v_new_paid numeric(12, 2);
  v_status dental.sale_status;
begin
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if p_sale_id is null then
    raise exception 'Sale is required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Return lines are required';
  end if;
  if p_refunds is null then
    p_refunds := '[]'::jsonb;
  end if;

  if auth.uid() is not null then
    if not dental.can_checkout() and not dental.is_owner() then
      raise exception 'Not allowed to process returns';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  select * into v_sale from dental.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found';
  end if;
  if v_sale.branch_id <> p_branch_id then
    raise exception 'Sale belongs to another branch';
  end if;
  if v_sale.status = 'void' then
    raise exception 'Sale is already void';
  end if;

  v_return_number := dental.next_return_number();

  insert into dental.returns (
    branch_id, sale_id, return_number, restock,
    subtotal, tax_total, total, refund_total,
    reason, notes, created_by
  )
  values (
    p_branch_id, p_sale_id, v_return_number, coalesce(p_restock, true),
    0, 0, 0, 0,
    nullif(trim(coalesce(p_reason, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_return_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    select * into v_sale_line
    from dental.sale_lines
    where id = (v_line->>'sale_line_id')::uuid
      and sale_id = p_sale_id
    for update;

    if not found then
      raise exception 'Sale line not found on this sale';
    end if;

    v_qty := (v_line->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Return qty must be positive';
    end if;

    select coalesce(sum(rl.qty), 0)
    into v_already
    from dental.return_lines rl
    join dental.returns r on r.id = rl.return_id
    where rl.sale_line_id = v_sale_line.id
      and r.id <> v_return_id;

    v_avail := v_sale_line.qty - v_already;
    if v_qty > v_avail + 0.0001 then
      raise exception 'Cannot return more than % of %', v_avail, v_sale_line.name;
    end if;

    v_ratio := v_qty / v_sale_line.qty;
    v_line_net := round(v_sale_line.line_net * v_ratio, 2);
    v_tax_amount := round(v_sale_line.tax_amount * v_ratio, 2);
    v_line_gross := v_line_net + v_tax_amount;

    v_restocked := false;
    if coalesce(p_restock, true)
      and v_sale_line.line_type = 'item'
      and v_sale_line.item_id is not null
    then
      perform dental.restock_sale_item(
        p_branch_id,
        v_sale_line.item_id,
        v_qty,
        p_sale_id,
        v_return_id
      );
      v_restocked := true;
    end if;

    insert into dental.return_lines (
      return_id, sale_line_id, qty, unit_price, tax_rate,
      tax_amount, line_net, line_gross, restocked
    )
    values (
      v_return_id,
      v_sale_line.id,
      v_qty,
      v_sale_line.unit_price,
      v_sale_line.tax_rate,
      v_tax_amount,
      v_line_net,
      v_line_gross,
      v_restocked
    );

    v_subtotal := v_subtotal + v_line_net;
    v_tax_total := v_tax_total + v_tax_amount;
  end loop;

  v_total := round(v_subtotal + v_tax_total, 2);
  if v_total <= 0 then
    raise exception 'Return total must be positive';
  end if;

  v_unpaid := greatest(v_sale.total - v_sale.paid_total, 0);
  v_refund_due := greatest(v_total - v_unpaid, 0);

  for v_pay in select * from jsonb_array_elements(p_refunds)
  loop
    if nullif(trim(coalesce(v_pay->>'tender', '')), '') is null then
      continue;
    end if;
    v_amount := coalesce((v_pay->>'amount')::numeric, 0);
    if v_amount <= 0 then
      continue;
    end if;
    v_tender := (lower(trim(v_pay->>'tender')))::dental.payment_tender;
    insert into dental.return_refunds (
      return_id, tender, amount, reference, created_by
    )
    values (
      v_return_id,
      v_tender,
      v_amount,
      nullif(trim(coalesce(v_pay->>'reference', '')), ''),
      auth.uid()
    );
    v_refund_sum := v_refund_sum + v_amount;
  end loop;

  if abs(v_refund_sum - v_refund_due) > 0.009 then
    raise exception
      'Refund tenders must total %. Unpaid credit covers %.',
      v_refund_due,
      least(v_total, v_unpaid);
  end if;

  if v_refund_sum > v_sale.paid_total + 0.009 then
    raise exception 'Cannot refund more than paid on this sale';
  end if;

  update dental.returns
  set
    subtotal = v_subtotal,
    tax_total = v_tax_total,
    total = v_total,
    refund_total = v_refund_sum
  where id = v_return_id;

  v_new_subtotal := greatest(round(v_sale.subtotal - v_subtotal, 2), 0);
  v_new_tax := greatest(round(v_sale.tax_total - v_tax_total, 2), 0);
  v_new_total := greatest(round(v_sale.total - v_total, 2), 0);
  v_new_paid := greatest(round(v_sale.paid_total - v_refund_sum, 2), 0);

  if v_new_total <= 0.009 then
    v_status := 'void';
    v_new_total := 0;
    v_new_subtotal := 0;
    v_new_tax := 0;
    v_new_paid := 0;
  elsif v_new_paid + 0.009 >= v_new_total then
    v_status := 'paid';
    v_new_paid := v_new_total;
  else
    v_status := 'partial';
  end if;

  update dental.sales
  set
    subtotal = v_new_subtotal,
    tax_total = v_new_tax,
    total = v_new_total,
    paid_total = v_new_paid,
    status = v_status,
    due_date = case when v_status = 'partial' then due_date else null end
  where id = p_sale_id;

  -- Loyalty / promotions reverse in later steps when those ledgers exist.
  return v_return_id;
end;
$$;

revoke all on function dental.process_return(uuid, uuid, jsonb, jsonb, boolean, text, text) from public;
grant execute on function dental.process_return(uuid, uuid, jsonb, jsonb, boolean, text, text) to authenticated, service_role;

alter table dental.returns enable row level security;
alter table dental.return_lines enable row level security;
alter table dental.return_refunds enable row level security;

create policy returns_select
on dental.returns
for select
to authenticated
using (
  dental.is_owner()
  or branch_id in (select dental.user_branch_ids())
);

create policy returns_insert
on dental.returns
for insert
to authenticated
with check (
  (dental.can_checkout() or dental.is_owner())
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

create policy return_lines_select
on dental.return_lines
for select
to authenticated
using (
  exists (
    select 1 from dental.returns r
    where r.id = return_id
      and (dental.is_owner() or r.branch_id in (select dental.user_branch_ids()))
  )
);

create policy return_refunds_select
on dental.return_refunds
for select
to authenticated
using (
  exists (
    select 1 from dental.returns r
    where r.id = return_id
      and (dental.is_owner() or r.branch_id in (select dental.user_branch_ids()))
  )
);

grant select, insert on dental.returns to authenticated, service_role;
grant select, insert on dental.return_lines to authenticated, service_role;
grant select, insert on dental.return_refunds to authenticated, service_role;
