-- Reject checkout overpayment (paid > sale total).
create or replace function dental.checkout_sale(
  p_branch_id uuid,
  p_customer_id uuid,
  p_lines jsonb,
  p_payments jsonb,
  p_notes text default null,
  p_due_date date default null,
  p_redeem_points numeric default 0
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
  v_eval jsonb;
  v_priced jsonb;
  v_promo_id uuid;
  v_line jsonb;
  v_pay jsonb;
  v_disc_map jsonb := '{}'::jsonb;
  v_entry jsonb;
  v_line_disc numeric(12, 2);
  v_qty numeric(12, 2);
  v_unit_price numeric(12, 2);
  v_tax_rate numeric(8, 6);
  v_line_net numeric(12, 2);
  v_tax_amount numeric(12, 2);
  v_line_gross numeric(12, 2);
  v_sku text;
  v_name text;
  v_sort integer;
  v_subtotal numeric(12, 2) := 0;
  v_promo_discount numeric(12, 2) := 0;
  v_loyalty_discount numeric(12, 2) := 0;
  v_discount_total numeric(12, 2) := 0;
  v_tax_total numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_paid numeric(12, 2) := 0;
  v_unpaid numeric(12, 2);
  v_status dental.sale_status;
  v_receipt text;
  v_tender dental.payment_tender;
  v_amount numeric(12, 2);
  v_i integer;
  v_item_id uuid;
  v_service_id uuid;
  v_pay_count integer := 0;
  v_ar numeric(12, 2);
  v_limit numeric(12, 2);
  v_line_type text;
  v_settings dental.clinic_settings%rowtype;
  v_remaining_net numeric(12, 2) := 0;
  v_redeem_points numeric(12, 2) := 0;
  v_preview jsonb;
  v_net_after numeric(12, 2);
  v_share numeric(12, 2);
  v_loy_remain numeric(12, 2);
  v_n integer;
  v_idx integer;
  v_points_earned numeric(12, 2) := 0;
  v_paid_ex_vat numeric(12, 2);
  v_taxable_net numeric(12, 2);
  v_expires timestamptz;
  v_due_date date;
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

  v_eval := dental.evaluate_best_promotion(p_branch_id, p_customer_id, p_lines);
  v_priced := coalesce(v_eval->'priced_lines', '[]'::jsonb);
  v_promo_id := nullif(v_eval->>'promotion_id', '')::uuid;
  v_promo_discount := coalesce((v_eval->>'discount_total')::numeric, 0);

  for v_entry in select * from jsonb_array_elements(coalesce(v_eval->'line_discounts', '[]'::jsonb))
  loop
    v_disc_map := v_disc_map || jsonb_build_object(
      (v_entry->>'sort'),
      (v_entry->>'discount_amount')::numeric
    );
  end loop;

  for v_line in select * from jsonb_array_elements(v_priced)
  loop
    v_sort := (v_line->>'sort')::integer;
    v_line_disc := coalesce((v_disc_map->>v_sort::text)::numeric, 0);
    v_subtotal := v_subtotal + (v_line->>'line_net')::numeric;
    v_remaining_net := v_remaining_net + greatest(
      round((v_line->>'line_net')::numeric - v_line_disc, 2),
      0
    );
  end loop;

  -- Loyalty redeem (after promo), rates blank => skip.
  if p_customer_id is not null and coalesce(p_redeem_points, 0) > 0 then
    v_preview := dental.preview_loyalty_redeem(p_customer_id, p_redeem_points, v_remaining_net);
    if coalesce((v_preview->>'ok')::boolean, false) then
      v_redeem_points := (v_preview->>'points')::numeric;
      v_loyalty_discount := (v_preview->>'discount')::numeric;

      -- Allocate loyalty discount proportionally on remaining net after promo.
      v_n := jsonb_array_length(v_priced);
      v_loy_remain := v_loyalty_discount;
      v_idx := 0;
      for v_line in select * from jsonb_array_elements(v_priced)
      loop
        v_idx := v_idx + 1;
        v_sort := (v_line->>'sort')::integer;
        v_line_disc := coalesce((v_disc_map->>v_sort::text)::numeric, 0);
        v_net_after := greatest(round((v_line->>'line_net')::numeric - v_line_disc, 2), 0);
        if v_net_after <= 0 or v_remaining_net <= 0 then
          continue;
        end if;
        if v_idx = v_n then
          v_share := least(v_loy_remain, v_net_after);
        else
          v_share := least(
            round(v_loyalty_discount * (v_net_after / v_remaining_net), 2),
            v_net_after,
            v_loy_remain
          );
        end if;
        v_loy_remain := v_loy_remain - v_share;
        v_disc_map := v_disc_map || jsonb_build_object(
          v_sort::text,
          v_line_disc + v_share
        );
      end loop;
    end if;
  end if;

  v_discount_total := round(v_promo_discount + v_loyalty_discount, 2);

  for v_line in select * from jsonb_array_elements(v_priced)
  loop
    v_sort := (v_line->>'sort')::integer;
    v_line_disc := coalesce((v_disc_map->>v_sort::text)::numeric, 0);
    v_line_net := round((v_line->>'line_net')::numeric - v_line_disc, 2);
    if v_line_net < 0 then
      v_line_net := 0;
    end if;
    v_tax_rate := (v_line->>'tax_rate')::numeric;
    v_tax_amount := round(v_line_net * v_tax_rate, 2);
    v_tax_total := v_tax_total + v_tax_amount;
  end loop;

  v_total := round(v_subtotal - v_discount_total + v_tax_total, 2);
  v_taxable_net := round(v_subtotal - v_discount_total, 2);

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

  if v_paid > v_total then
    raise exception 'Paid total (%) exceeds sale total (%)', v_paid, v_total;
  end if;

  v_unpaid := v_total - v_paid;

  if v_paid < v_total then
    if not v_is_wholesale then
      if v_paid <= 0 then
        raise exception 'Paid total must be greater than zero';
      end if;
    else
      -- Default due date: 7 days when staff leave it blank.
      v_due_date := coalesce(p_due_date, (current_date + 7));
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

  if v_pay_count = 0 and not (v_is_wholesale and v_status = 'partial') then
    raise exception 'At least one payment is required';
  end if;

  v_receipt := dental.next_receipt_number();

  insert into dental.sales (
    branch_id, customer_id, status, price_list,
    subtotal, discount_total, tax_total, total, paid_total,
    receipt_number, notes, due_date, created_by,
    loyalty_points_earned, loyalty_points_redeemed, loyalty_discount
  )
  values (
    p_branch_id, p_customer_id, v_status, v_price_list,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_paid,
    v_receipt, nullif(trim(p_notes), ''),
    case when v_status = 'partial' and v_is_wholesale then coalesce(v_due_date, p_due_date, (current_date + 7)) else null end,
    auth.uid(),
    0, v_redeem_points, v_loyalty_discount
  )
  returning id into v_sale_id;

  for v_line in select * from jsonb_array_elements(v_priced)
  loop
    v_sort := (v_line->>'sort')::integer;
    v_line_type := v_line->>'line_type';
    v_qty := (v_line->>'qty')::numeric;
    v_unit_price := (v_line->>'unit_price')::numeric;
    v_tax_rate := (v_line->>'tax_rate')::numeric;
    v_line_disc := coalesce((v_disc_map->>v_sort::text)::numeric, 0);
    v_line_net := round((v_line->>'line_net')::numeric - v_line_disc, 2);
    if v_line_net < 0 then
      v_line_net := 0;
    end if;
    v_tax_amount := round(v_line_net * v_tax_rate, 2);
    v_line_gross := v_line_net + v_tax_amount;
    v_sku := v_line->>'sku_or_code';
    v_name := v_line->>'name';

    if v_line_type = 'item' then
      v_item_id := (v_line->>'item_id')::uuid;
      insert into dental.sale_lines (
        sale_id, line_type, item_id, service_id, sku_or_code, name,
        qty, unit_price, discount_amount, tax_rate, tax_amount,
        line_net, line_gross, promotion_id, sort_order
      )
      values (
        v_sale_id, 'item', v_item_id, null, v_sku, v_name,
        v_qty, v_unit_price, v_line_disc, v_tax_rate, v_tax_amount,
        v_line_net, v_line_gross,
        case when v_promo_id is not null and v_line_disc > 0 then v_promo_id else null end,
        v_sort
      );

      perform dental.deduct_stock_fefo(
        p_branch_id, v_item_id, v_qty, 'sale_out', 'sale', v_sale_id, 'Sale ' || v_receipt
      );
    else
      v_service_id := (v_line->>'service_id')::uuid;
      insert into dental.sale_lines (
        sale_id, line_type, item_id, service_id, sku_or_code, name,
        qty, unit_price, discount_amount, tax_rate, tax_amount,
        line_net, line_gross, promotion_id, sort_order
      )
      values (
        v_sale_id, 'service', null, v_service_id, v_sku, v_name,
        v_qty, v_unit_price, v_line_disc, v_tax_rate, v_tax_amount,
        v_line_net, v_line_gross,
        case when v_promo_id is not null and v_line_disc > 0 then v_promo_id else null end,
        v_sort
      );

      for v_i in 1 .. v_qty::integer
      loop
        perform dental.apply_service_recipe(p_branch_id, v_service_id, 'sale', v_sale_id);
      end loop;
    end if;
  end loop;

  if v_promo_id is not null and v_promo_discount > 0 then
    insert into dental.promotion_redemptions (
      promotion_id, sale_id, branch_id, customer_id, discount_amount
    )
    values (
      v_promo_id, v_sale_id, p_branch_id, p_customer_id, v_promo_discount
    );
  end if;

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

  -- Redeem points from balance.
  if p_customer_id is not null and v_redeem_points > 0 then
    perform dental.apply_loyalty_transaction(
      p_customer_id, 'redeem', v_redeem_points, v_sale_id, null,
      'Redeem on ' || v_receipt, null
    );
  end if;

  -- Earn on paid amount excluding VAT (rates blank => skip).
  v_settings := dental.get_clinic_settings();
  if p_customer_id is not null
    and v_settings.loyalty_earn_per_usd is not null
    and v_settings.loyalty_earn_per_usd > 0
    and v_paid > 0
    and v_total > 0
  then
    v_paid_ex_vat := round(least(v_paid, v_total) * (v_taxable_net / v_total), 2);
    if v_paid_ex_vat > 0 then
      v_points_earned := floor(v_paid_ex_vat * v_settings.loyalty_earn_per_usd);
      if v_points_earned > 0 then
        v_expires := null;
        if v_settings.loyalty_expire_days is not null then
          v_expires := now() + make_interval(days => v_settings.loyalty_expire_days);
        end if;
        perform dental.apply_loyalty_transaction(
          p_customer_id, 'earn', v_points_earned, v_sale_id, null,
          'Earn on ' || v_receipt, v_expires
        );
        update dental.sales
        set loyalty_points_earned = v_points_earned
        where id = v_sale_id;
      end if;
    end if;
  end if;

  return v_sale_id;
end;
$$;



revoke all on function dental.checkout_sale(uuid, uuid, jsonb, jsonb, text, date, numeric) from public;
grant execute on function dental.checkout_sale(uuid, uuid, jsonb, jsonb, text, date, numeric) to authenticated, service_role;