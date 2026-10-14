-- DentaFlow step 24: loyalty points.
-- Settings rates stay NULL until the owner fills them in (do not invent rates).
-- Earn on paid amount excluding VAT. Redeem at checkout as discount. Ledger + returns reverse.

do $$ begin
  create type dental.loyalty_tx_type as enum ('earn', 'redeem', 'reverse', 'adjust');
exception when duplicate_object then null;
end $$;

create table if not exists dental.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  vat_percent numeric(8, 4) check (vat_percent is null or (vat_percent >= 0 and vat_percent <= 100)),
  loyalty_earn_per_usd numeric(12, 4) check (
    loyalty_earn_per_usd is null or loyalty_earn_per_usd >= 0
  ),
  loyalty_usd_per_point numeric(12, 6) check (
    loyalty_usd_per_point is null or loyalty_usd_per_point >= 0
  ),
  loyalty_min_redeem_points numeric(12, 2) check (
    loyalty_min_redeem_points is null or loyalty_min_redeem_points >= 0
  ),
  loyalty_expire_days integer check (
    loyalty_expire_days is null or loyalty_expire_days > 0
  ),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Singleton: at most one settings row.
create unique index if not exists clinic_settings_singleton_idx
  on dental.clinic_settings ((true));

insert into dental.clinic_settings (id)
select gen_random_uuid()
where not exists (select 1 from dental.clinic_settings);

alter table dental.customers
  add column if not exists loyalty_points numeric(12, 2) not null default 0
  check (loyalty_points >= 0);

alter table dental.sales
  add column if not exists loyalty_points_earned numeric(12, 2) not null default 0
  check (loyalty_points_earned >= 0);

alter table dental.sales
  add column if not exists loyalty_points_redeemed numeric(12, 2) not null default 0
  check (loyalty_points_redeemed >= 0);

alter table dental.sales
  add column if not exists loyalty_discount numeric(12, 2) not null default 0
  check (loyalty_discount >= 0);

create table if not exists dental.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references dental.customers (id),
  tx_type dental.loyalty_tx_type not null,
  points numeric(12, 2) not null check (points <> 0),
  balance_after numeric(12, 2) not null check (balance_after >= 0),
  sale_id uuid references dental.sales (id) on delete set null,
  return_id uuid references dental.returns (id) on delete set null,
  notes text,
  expires_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists loyalty_transactions_customer_id_idx
  on dental.loyalty_transactions (customer_id, created_at desc);
create index if not exists loyalty_transactions_sale_id_idx
  on dental.loyalty_transactions (sale_id)
  where sale_id is not null;

alter table dental.clinic_settings enable row level security;
alter table dental.loyalty_transactions enable row level security;

drop policy if exists clinic_settings_select on dental.clinic_settings;
create policy clinic_settings_select
on dental.clinic_settings for select to authenticated
using (true);

drop policy if exists clinic_settings_write on dental.clinic_settings;
create policy clinic_settings_write
on dental.clinic_settings for all to authenticated
using (dental.is_owner())
with check (dental.is_owner());

drop policy if exists loyalty_transactions_select on dental.loyalty_transactions;
create policy loyalty_transactions_select
on dental.loyalty_transactions for select to authenticated
using (
  dental.is_owner()
  or exists (
    select 1 from dental.customers c
    where c.id = customer_id
      and c.branch_id in (select dental.user_branch_ids())
  )
);

-- Writes only via security definer functions.
drop policy if exists loyalty_transactions_write on dental.loyalty_transactions;
create policy loyalty_transactions_write
on dental.loyalty_transactions for insert to authenticated
with check (false);

create or replace function dental.get_clinic_settings()
returns dental.clinic_settings
language sql
stable
security definer
set search_path = dental
as $$
  select * from dental.clinic_settings order by created_at limit 1;
$$;

revoke all on function dental.get_clinic_settings() from public;
grant execute on function dental.get_clinic_settings() to authenticated, service_role;

create or replace function dental.update_clinic_settings(
  p_vat_percent numeric default null,
  p_loyalty_earn_per_usd numeric default null,
  p_loyalty_usd_per_point numeric default null,
  p_loyalty_min_redeem_points numeric default null,
  p_loyalty_expire_days integer default null,
  p_clear_vat boolean default false,
  p_clear_loyalty_earn boolean default false,
  p_clear_loyalty_redeem boolean default false,
  p_clear_loyalty_min boolean default false,
  p_clear_loyalty_expire boolean default false
)
returns dental.clinic_settings
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.clinic_settings%rowtype;
begin
  if not dental.is_owner() then
    raise exception 'Only the owner can update clinic settings';
  end if;

  insert into dental.clinic_settings (id)
  select gen_random_uuid()
  where not exists (select 1 from dental.clinic_settings);

  update dental.clinic_settings
  set
    vat_percent = case
      when p_clear_vat then null
      when p_vat_percent is not null then p_vat_percent
      else vat_percent
    end,
    loyalty_earn_per_usd = case
      when p_clear_loyalty_earn then null
      when p_loyalty_earn_per_usd is not null then p_loyalty_earn_per_usd
      else loyalty_earn_per_usd
    end,
    loyalty_usd_per_point = case
      when p_clear_loyalty_redeem then null
      when p_loyalty_usd_per_point is not null then p_loyalty_usd_per_point
      else loyalty_usd_per_point
    end,
    loyalty_min_redeem_points = case
      when p_clear_loyalty_min then null
      when p_loyalty_min_redeem_points is not null then p_loyalty_min_redeem_points
      else loyalty_min_redeem_points
    end,
    loyalty_expire_days = case
      when p_clear_loyalty_expire then null
      when p_loyalty_expire_days is not null then p_loyalty_expire_days
      else loyalty_expire_days
    end,
    updated_by = auth.uid(),
    updated_at = now()
  where id = (select id from dental.clinic_settings order by created_at limit 1)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function dental.update_clinic_settings(
  numeric, numeric, numeric, numeric, integer, boolean, boolean, boolean, boolean, boolean
) from public;
grant execute on function dental.update_clinic_settings(
  numeric, numeric, numeric, numeric, integer, boolean, boolean, boolean, boolean, boolean
) to authenticated, service_role;

create or replace function dental.apply_loyalty_transaction(
  p_customer_id uuid,
  p_tx_type dental.loyalty_tx_type,
  p_points numeric,
  p_sale_id uuid default null,
  p_return_id uuid default null,
  p_notes text default null,
  p_expires_at timestamptz default null
)
returns dental.loyalty_transactions
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_customer dental.customers%rowtype;
  v_delta numeric(12, 2);
  v_balance numeric(12, 2);
  v_row dental.loyalty_transactions%rowtype;
begin
  if p_customer_id is null then
    raise exception 'Customer is required for loyalty';
  end if;
  if p_points is null or p_points = 0 then
    raise exception 'Points must be non-zero';
  end if;

  select * into v_customer from dental.customers where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'Customer not found';
  end if;

  -- Signed delta stored on the ledger row.
  if p_tx_type = 'earn' then
    v_delta := abs(p_points);
  elsif p_tx_type = 'redeem' then
    v_delta := -abs(p_points);
  else
    -- adjust / reverse: caller passes signed points
    v_delta := p_points;
  end if;

  v_balance := round(coalesce(v_customer.loyalty_points, 0) + v_delta, 2);
  if v_balance < 0 then
    raise exception 'Insufficient loyalty points (balance %, delta %)', v_customer.loyalty_points, v_delta;
  end if;

  update dental.customers
  set loyalty_points = v_balance
  where id = p_customer_id;

  insert into dental.loyalty_transactions (
    customer_id, tx_type, points, balance_after,
    sale_id, return_id, notes, expires_at, created_by
  )
  values (
    p_customer_id, p_tx_type, v_delta, v_balance,
    p_sale_id, p_return_id, nullif(trim(p_notes), ''), p_expires_at, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function dental.apply_loyalty_transaction(
  uuid, dental.loyalty_tx_type, numeric, uuid, uuid, text, timestamptz
) from public;
grant execute on function dental.apply_loyalty_transaction(
  uuid, dental.loyalty_tx_type, numeric, uuid, uuid, text, timestamptz
) to authenticated, service_role;

-- Owner/staff adjust helper (positive or negative magnitude via signed points).
create or replace function dental.adjust_loyalty_points(
  p_customer_id uuid,
  p_points numeric,
  p_notes text default null
)
returns dental.loyalty_transactions
language plpgsql
security definer
set search_path = dental
as $$
begin
  if auth.uid() is not null then
    if not dental.is_owner() and not dental.can_checkout() then
      raise exception 'Not allowed to adjust loyalty points';
    end if;
  end if;
  if p_points is null or p_points = 0 then
    raise exception 'Points must be non-zero';
  end if;
  return dental.apply_loyalty_transaction(
    p_customer_id, 'adjust', p_points, null, null, coalesce(p_notes, 'Manual adjust'), null
  );
end;
$$;

revoke all on function dental.adjust_loyalty_points(uuid, numeric, text) from public;
grant execute on function dental.adjust_loyalty_points(uuid, numeric, text) to authenticated, service_role;

-- Preview redeem discount for POS.
create or replace function dental.preview_loyalty_redeem(
  p_customer_id uuid,
  p_redeem_points numeric,
  p_remaining_net numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_settings dental.clinic_settings%rowtype;
  v_customer dental.customers%rowtype;
  v_points numeric(12, 2);
  v_discount numeric(12, 2);
  v_min numeric(12, 2);
begin
  if p_customer_id is null or coalesce(p_redeem_points, 0) <= 0 then
    return jsonb_build_object('points', 0, 'discount', 0, 'ok', false, 'reason', 'none');
  end if;

  v_settings := dental.get_clinic_settings();
  if v_settings.loyalty_usd_per_point is null or v_settings.loyalty_usd_per_point <= 0 then
    return jsonb_build_object('points', 0, 'discount', 0, 'ok', false, 'reason', 'rates_blank');
  end if;

  select * into v_customer from dental.customers where id = p_customer_id;
  if v_customer.id is null then
    return jsonb_build_object('points', 0, 'discount', 0, 'ok', false, 'reason', 'no_customer');
  end if;

  v_min := coalesce(v_settings.loyalty_min_redeem_points, 0);
  if v_customer.loyalty_points < v_min then
    return jsonb_build_object('points', 0, 'discount', 0, 'ok', false, 'reason', 'below_min');
  end if;

  v_points := least(p_redeem_points, v_customer.loyalty_points);
  v_discount := round(v_points * v_settings.loyalty_usd_per_point, 2);
  if p_remaining_net is not null and p_remaining_net >= 0 then
    if v_discount > p_remaining_net then
      v_discount := p_remaining_net;
      if v_settings.loyalty_usd_per_point > 0 then
        v_points := round(v_discount / v_settings.loyalty_usd_per_point, 2);
      end if;
    end if;
  end if;

  if v_points < v_min and v_min > 0 then
    return jsonb_build_object('points', 0, 'discount', 0, 'ok', false, 'reason', 'below_min');
  end if;

  return jsonb_build_object(
    'points', v_points,
    'discount', v_discount,
    'ok', v_discount > 0,
    'balance', v_customer.loyalty_points,
    'usd_per_point', v_settings.loyalty_usd_per_point,
    'min_points', v_min
  );
end;
$$;

revoke all on function dental.preview_loyalty_redeem(uuid, numeric, numeric) from public;
grant execute on function dental.preview_loyalty_redeem(uuid, numeric, numeric) to authenticated, service_role;

-- Replace checkout with redeem + earn.
drop function if exists dental.checkout_sale(uuid, uuid, jsonb, jsonb, text, date);

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

  v_unpaid := v_total - v_paid;

  if v_paid < v_total then
    if not v_is_wholesale then
      if v_paid <= 0 then
        raise exception 'Paid total must be greater than zero';
      end if;
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
    case when v_status = 'partial' and v_is_wholesale then p_due_date else null end,
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

-- Reverse loyalty on returns (proportional to returned net vs original taxable net).
create or replace function dental.reverse_loyalty_for_return(
  p_sale_id uuid,
  p_return_id uuid,
  p_returned_net numeric
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_sale dental.sales%rowtype;
  v_orig_net numeric(12, 2);
  v_ratio numeric;
  v_rev_earn numeric(12, 2);
  v_rev_redeem numeric(12, 2);
  v_already_earn numeric(12, 2);
  v_already_redeem numeric(12, 2);
begin
  select * into v_sale from dental.sales where id = p_sale_id;
  if v_sale.id is null or v_sale.customer_id is null then
    return;
  end if;

  v_orig_net := greatest(round(v_sale.subtotal - v_sale.discount_total, 2), 0);
  if v_orig_net <= 0 or coalesce(p_returned_net, 0) <= 0 then
    return;
  end if;

  v_ratio := least(1, p_returned_net / v_orig_net);

  select coalesce(sum(case when points < 0 then -points else 0 end), 0)
  into v_already_earn
  from dental.loyalty_transactions
  where sale_id = p_sale_id and tx_type = 'reverse' and points < 0;

  select coalesce(sum(case when points > 0 then points else 0 end), 0)
  into v_already_redeem
  from dental.loyalty_transactions
  where sale_id = p_sale_id and tx_type = 'reverse' and points > 0;

  v_rev_earn := greatest(
    round(v_sale.loyalty_points_earned * v_ratio, 2) - v_already_earn,
    0
  );
  v_rev_redeem := greatest(
    round(v_sale.loyalty_points_redeemed * v_ratio, 2) - v_already_redeem,
    0
  );

  -- Reverse earn: remove points (negative).
  if v_rev_earn > 0 then
    begin
      perform dental.apply_loyalty_transaction(
        v_sale.customer_id, 'reverse', -v_rev_earn, p_sale_id, p_return_id,
        'Reverse earn on return', null
      );
    exception when others then
      -- Cap to available balance.
      perform dental.apply_loyalty_transaction(
        v_sale.customer_id, 'reverse',
        -least(v_rev_earn, (select loyalty_points from dental.customers where id = v_sale.customer_id)),
        p_sale_id, p_return_id, 'Reverse earn on return (capped)', null
      );
    end;
  end if;

  -- Reverse redeem: restore points (positive).
  if v_rev_redeem > 0 then
    perform dental.apply_loyalty_transaction(
      v_sale.customer_id, 'reverse', v_rev_redeem, p_sale_id, p_return_id,
      'Reverse redeem on return', null
    );
  end if;
end;
$$;

revoke all on function dental.reverse_loyalty_for_return(uuid, uuid, numeric) from public;
grant execute on function dental.reverse_loyalty_for_return(uuid, uuid, numeric) to authenticated, service_role;

-- Re-apply process_return with loyalty reverse (body matches step 18 + reverse call).
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

  perform dental.reverse_loyalty_for_return(p_sale_id, v_return_id, v_subtotal);

  return v_return_id;
end;
$$;

revoke all on function dental.process_return(uuid, uuid, jsonb, jsonb, boolean, text, text) from public;
grant execute on function dental.process_return(uuid, uuid, jsonb, jsonb, boolean, text, text) to authenticated, service_role;
