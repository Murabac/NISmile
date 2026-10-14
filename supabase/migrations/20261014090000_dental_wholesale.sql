-- DentaFlow wholesale: due dates, credit limit on checkout, AR settlement.
-- On-account = unpaid sale remainder (not a fifth tender).

alter table dental.sales
  add column if not exists due_date date;

create index if not exists sales_due_date_idx on dental.sales (due_date)
  where status = 'partial';

create or replace function dental.customer_ar_balance(p_customer_id uuid)
returns numeric
language sql
stable
security definer
set search_path = dental
as $$
  select coalesce(sum(total - paid_total), 0)::numeric(12, 2)
  from dental.sales
  where customer_id = p_customer_id
    and status = 'partial';
$$;

revoke all on function dental.customer_ar_balance(uuid) from public;
grant execute on function dental.customer_ar_balance(uuid) to authenticated, service_role;

-- Drop old checkout signature (5 args) and recreate with due_date.
drop function if exists dental.checkout_sale(uuid, uuid, jsonb, jsonb, text);

create or replace function dental.checkout_sale(
  p_branch_id uuid,
  p_customer_id uuid,
  p_lines jsonb,
  p_payments jsonb,
  p_notes text default null,
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_sale_id uuid;
  v_customer dental.customers%rowtype;
  v_price_list dental.price_list := 'retail';
  v_is_wholesale boolean := false;
  v_line jsonb;
  v_pay jsonb;
  v_line_type text;
  v_item_id uuid;
  v_service_id uuid;
  v_qty numeric(12, 2);
  v_unit_price numeric(12, 2);
  v_tax_rate numeric(8, 6);
  v_line_net numeric(12, 2);
  v_tax_amount numeric(12, 2);
  v_line_gross numeric(12, 2);
  v_sku text;
  v_name text;
  v_sort integer := 0;
  v_subtotal numeric(12, 2) := 0;
  v_tax_total numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_paid numeric(12, 2) := 0;
  v_unpaid numeric(12, 2);
  v_status dental.sale_status;
  v_receipt text;
  v_tender dental.payment_tender;
  v_amount numeric(12, 2);
  v_i integer;
  v_item dental.items%rowtype;
  v_service dental.services%rowtype;
  v_rate numeric(8, 6);
  v_ar numeric(12, 2);
  v_limit numeric(12, 2);
  v_pay_count integer := 0;
begin
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cart is empty';
  end if;

  if auth.uid() is not null then
    if not dental.can_checkout() and not dental.is_owner() then
      raise exception 'Not allowed to checkout';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if p_customer_id is not null then
    select * into v_customer from dental.customers where id = p_customer_id;
    if v_customer.id is null then
      raise exception 'Customer not found';
    end if;
    if v_customer.branch_id <> p_branch_id then
      raise exception 'Customer belongs to another branch';
    end if;
    if v_customer.customer_type = 'wholesale' then
      v_price_list := 'wholesale';
      v_is_wholesale := true;
    end if;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_type := lower(trim(coalesce(v_line->>'line_type', '')));
    v_qty := (v_line->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Line quantity must be positive';
    end if;

    if v_line_type = 'item' then
      v_item_id := (v_line->>'item_id')::uuid;
      if v_item_id is null then
        raise exception 'item_id is required for item lines';
      end if;
      select * into v_item from dental.items where id = v_item_id and active;
      if v_item.id is null then
        raise exception 'Item not found or inactive';
      end if;
      v_unit_price := dental.resolve_unit_price(v_price_list, v_qty, v_item_id, null);
      v_rate := 0;
      if v_item.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_item.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_tax_rate := v_rate;
      v_line_net := round(v_unit_price * v_qty, 2);
      v_tax_amount := round(v_line_net * v_tax_rate, 2);
      v_subtotal := v_subtotal + v_line_net;
      v_tax_total := v_tax_total + v_tax_amount;
    elsif v_line_type = 'service' then
      v_service_id := (v_line->>'service_id')::uuid;
      if v_service_id is null then
        raise exception 'service_id is required for service lines';
      end if;
      select * into v_service from dental.services where id = v_service_id and active;
      if v_service.id is null then
        raise exception 'Service not found or inactive';
      end if;
      if v_qty <> trunc(v_qty) then
        raise exception 'Service quantity must be a whole number';
      end if;
      v_unit_price := dental.resolve_unit_price('retail', v_qty, null, v_service_id);
      v_rate := 0;
      if v_service.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_service.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_tax_rate := v_rate;
      v_line_net := round(v_unit_price * v_qty, 2);
      v_tax_amount := round(v_line_net * v_tax_rate, 2);
      v_subtotal := v_subtotal + v_line_net;
      v_tax_total := v_tax_total + v_tax_amount;
    else
      raise exception 'Invalid line_type %', v_line_type;
    end if;
  end loop;

  v_total := v_subtotal + v_tax_total;

  if p_payments is not null and jsonb_typeof(p_payments) = 'array' then
    v_pay_count := jsonb_array_length(p_payments);
    for v_pay in select * from jsonb_array_elements(p_payments)
    loop
      v_amount := (v_pay->>'amount')::numeric;
      if v_amount is null or v_amount <= 0 then
        raise exception 'Payment amount must be positive';
      end if;
      v_paid := v_paid + v_amount;
    end loop;
  end if;

  v_unpaid := v_total - v_paid;

  if v_paid < v_total then
    if not v_is_wholesale then
      if v_paid <= 0 then
        raise exception 'Paid total must be greater than zero';
      end if;
      -- Retail partial still allowed (existing step 15) without due_date.
    else
      if p_due_date is null then
        raise exception 'Due date is required for wholesale on-account sales';
      end if;
      v_limit := coalesce(v_customer.credit_limit, 0);
      if v_limit <= 0 then
        raise exception 'Wholesale customer has no credit limit; pay in full';
      end if;
      v_ar := dental.customer_ar_balance(p_customer_id);
      if v_ar + v_unpaid > v_limit then
        raise exception 'Credit limit exceeded (AR % + unpaid % > limit %)', v_ar, v_unpaid, v_limit;
      end if;
    end if;
    v_status := 'partial';
  else
    if v_paid <= 0 then
      raise exception 'Paid total must be greater than zero';
    end if;
    v_status := 'paid';
  end if;

  -- Empty payments only for wholesale full on-account.
  if v_pay_count = 0 and not (v_is_wholesale and v_status = 'partial') then
    raise exception 'At least one payment is required';
  end if;

  v_receipt := dental.next_receipt_number();

  insert into dental.sales (
    branch_id, customer_id, status, price_list,
    subtotal, discount_total, tax_total, total, paid_total,
    receipt_number, notes, due_date, created_by
  )
  values (
    p_branch_id, p_customer_id, v_status, v_price_list,
    v_subtotal, 0, v_tax_total, v_total, v_paid,
    v_receipt, nullif(trim(p_notes), ''),
    case when v_status = 'partial' and v_is_wholesale then p_due_date else null end,
    auth.uid()
  )
  returning id into v_sale_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sort := v_sort + 1;
    v_line_type := lower(trim(coalesce(v_line->>'line_type', '')));
    v_qty := (v_line->>'qty')::numeric;

    if v_line_type = 'item' then
      v_item_id := (v_line->>'item_id')::uuid;
      select * into v_item from dental.items where id = v_item_id;
      v_unit_price := dental.resolve_unit_price(v_price_list, v_qty, v_item_id, null);
      v_rate := 0;
      if v_item.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_item.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_tax_rate := v_rate;
      v_line_net := round(v_unit_price * v_qty, 2);
      v_tax_amount := round(v_line_net * v_tax_rate, 2);
      v_line_gross := v_line_net + v_tax_amount;
      v_sku := v_item.sku;
      v_name := v_item.name;

      insert into dental.sale_lines (
        sale_id, line_type, item_id, service_id, sku_or_code, name,
        qty, unit_price, discount_amount, tax_rate, tax_amount,
        line_net, line_gross, sort_order
      )
      values (
        v_sale_id, 'item', v_item_id, null, v_sku, v_name,
        v_qty, v_unit_price, 0, v_tax_rate, v_tax_amount,
        v_line_net, v_line_gross, v_sort
      );

      perform dental.deduct_stock_fefo(
        p_branch_id, v_item_id, v_qty, 'sale_out', 'sale', v_sale_id, 'Sale ' || v_receipt
      );
    else
      v_service_id := (v_line->>'service_id')::uuid;
      select * into v_service from dental.services where id = v_service_id;
      v_unit_price := dental.resolve_unit_price('retail', v_qty, null, v_service_id);
      v_rate := 0;
      if v_service.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_service.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_tax_rate := v_rate;
      v_line_net := round(v_unit_price * v_qty, 2);
      v_tax_amount := round(v_line_net * v_tax_rate, 2);
      v_line_gross := v_line_net + v_tax_amount;
      v_sku := v_service.code;
      v_name := v_service.name;

      insert into dental.sale_lines (
        sale_id, line_type, item_id, service_id, sku_or_code, name,
        qty, unit_price, discount_amount, tax_rate, tax_amount,
        line_net, line_gross, sort_order
      )
      values (
        v_sale_id, 'service', null, v_service_id, v_sku, v_name,
        v_qty, v_unit_price, 0, v_tax_rate, v_tax_amount,
        v_line_net, v_line_gross, v_sort
      );

      for v_i in 1 .. v_qty::integer
      loop
        perform dental.apply_service_recipe(p_branch_id, v_service_id, 'sale', v_sale_id);
      end loop;
    end if;
  end loop;

  if p_payments is not null and jsonb_typeof(p_payments) = 'array' then
    for v_pay in select * from jsonb_array_elements(p_payments)
    loop
      v_tender := (lower(trim(v_pay->>'tender')))::dental.payment_tender;
      v_amount := (v_pay->>'amount')::numeric;
      insert into dental.payments (sale_id, tender, amount, reference, created_by)
      values (
        v_sale_id,
        v_tender,
        v_amount,
        nullif(trim(coalesce(v_pay->>'reference', '')), ''),
        auth.uid()
      );
    end loop;
  end if;

  return v_sale_id;
end;
$$;

revoke all on function dental.checkout_sale(uuid, uuid, jsonb, jsonb, text, date) from public;
grant execute on function dental.checkout_sale(uuid, uuid, jsonb, jsonb, text, date) to authenticated, service_role;

-- Allocate tender payments against open AR (FIFO by due_date, created_at).
create or replace function dental.apply_customer_payment(
  p_branch_id uuid,
  p_customer_id uuid,
  p_payments jsonb,
  p_sale_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_customer dental.customers%rowtype;
  v_elem jsonb;
  v_tenders text[] := array[]::text[];
  v_amounts numeric[] := array[]::numeric[];
  v_refs text[] := array[]::text[];
  v_pool numeric(12, 2) := 0;
  v_sale dental.sales%rowtype;
  v_due numeric(12, 2);
  v_need numeric(12, 2);
  v_take numeric(12, 2);
  v_idx integer;
  v_first_payment_id uuid;
  v_payment_id uuid;
  v_new_paid numeric(12, 2);
begin
  if p_branch_id is null or p_customer_id is null then
    raise exception 'Branch and customer are required';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'At least one payment is required';
  end if;

  if auth.uid() is not null then
    if not dental.can_checkout() and not dental.is_owner() then
      raise exception 'Not allowed to record payments';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  select * into v_customer from dental.customers where id = p_customer_id;
  if v_customer.id is null then
    raise exception 'Customer not found';
  end if;
  if v_customer.branch_id <> p_branch_id then
    raise exception 'Customer belongs to another branch';
  end if;

  for v_elem in select * from jsonb_array_elements(p_payments)
  loop
    v_take := (v_elem->>'amount')::numeric;
    if v_take is null or v_take <= 0 then
      raise exception 'Payment amount must be positive';
    end if;
    v_tenders := array_append(v_tenders, lower(trim(v_elem->>'tender')));
    v_amounts := array_append(v_amounts, v_take);
    v_refs := array_append(v_refs, nullif(trim(coalesce(v_elem->>'reference', '')), ''));
    v_pool := v_pool + v_take;
  end loop;

  for v_sale in
    select *
    from dental.sales
    where customer_id = p_customer_id
      and branch_id = p_branch_id
      and status = 'partial'
      and (p_sale_id is null or id = p_sale_id)
    order by due_date nulls last, created_at
    for update
  loop
    exit when v_pool <= 0;
    v_due := v_sale.total - v_sale.paid_total;
    if v_due <= 0 then
      continue;
    end if;

    v_need := least(v_pool, v_due);
    v_new_paid := 0;

    for v_idx in 1 .. coalesce(array_length(v_amounts, 1), 0)
    loop
      exit when v_need <= 0;
      if v_amounts[v_idx] <= 0 then
        continue;
      end if;
      v_take := least(v_need, v_amounts[v_idx]);
      insert into dental.payments (sale_id, tender, amount, reference, created_by)
      values (
        v_sale.id,
        v_tenders[v_idx]::dental.payment_tender,
        v_take,
        v_refs[v_idx],
        auth.uid()
      )
      returning id into v_payment_id;

      if v_first_payment_id is null then
        v_first_payment_id := v_payment_id;
      end if;

      v_amounts[v_idx] := v_amounts[v_idx] - v_take;
      v_need := v_need - v_take;
      v_new_paid := v_new_paid + v_take;
      v_pool := v_pool - v_take;
    end loop;

    update dental.sales
    set
      paid_total = paid_total + v_new_paid,
      status = case
        when paid_total + v_new_paid >= total then 'paid'::dental.sale_status
        else 'partial'::dental.sale_status
      end,
      due_date = case
        when paid_total + v_new_paid >= total then null
        else due_date
      end
    where id = v_sale.id;
  end loop;

  if v_first_payment_id is null then
    raise exception 'No open balance to apply payment to';
  end if;

  if v_pool > 0.009 then
    raise exception 'Payment exceeds open AR by %', v_pool;
  end if;

  return v_first_payment_id;
end;
$$;

revoke all on function dental.apply_customer_payment(uuid, uuid, jsonb, uuid) from public;
grant execute on function dental.apply_customer_payment(uuid, uuid, jsonb, uuid) to authenticated, service_role;

grant update on dental.sales to authenticated, service_role;
