-- DentaFlow step 23: promotion engine.
-- Types: percentage, fixed_amount, buy_x_get_y, bundle, spend_threshold.
-- Best single promotion wins at checkout (no stacking). Owner publishes.

do $$ begin
  create type dental.promotion_type as enum (
    'percentage',
    'fixed_amount',
    'buy_x_get_y',
    'bundle',
    'spend_threshold'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.promotion_audience as enum (
    'all',
    'retail',
    'wholesale',
    'wholesale_subtype',
    'named_customers'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.promotion_scope as enum (
    'invoice',
    'items',
    'services',
    'categories'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.promotion_status as enum (
    'draft',
    'scheduled',
    'active',
    'paused',
    'ended'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.promotion_target_kind as enum (
    'item',
    'service',
    'category',
    'customer'
  );
exception when duplicate_object then null;
end $$;

create table if not exists dental.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  promo_type dental.promotion_type not null,
  audience dental.promotion_audience not null default 'all',
  wholesale_subtype text,
  scope dental.promotion_scope not null default 'invoice',
  percent_off numeric(8, 4) check (percent_off is null or (percent_off > 0 and percent_off <= 100)),
  amount_off numeric(12, 2) check (amount_off is null or amount_off >= 0),
  buy_qty numeric(12, 2) check (buy_qty is null or buy_qty > 0),
  get_qty numeric(12, 2) check (get_qty is null or get_qty > 0),
  bundle_price numeric(12, 2) check (bundle_price is null or bundle_price >= 0),
  spend_min numeric(12, 2) check (spend_min is null or spend_min > 0),
  min_qty numeric(12, 2) check (min_qty is null or min_qty > 0),
  max_redemptions_total integer check (max_redemptions_total is null or max_redemptions_total > 0),
  max_redemptions_per_customer integer check (
    max_redemptions_per_customer is null or max_redemptions_per_customer > 0
  ),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status dental.promotion_status not null default 'draft',
  notify_whatsapp boolean not null default false,
  whatsapp_message_en text,
  whatsapp_message_so text,
  whatsapp_message_ar text,
  created_by uuid references auth.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    audience <> 'wholesale_subtype'
    or (wholesale_subtype is not null and length(trim(wholesale_subtype)) > 0)
  )
);

create table if not exists dental.promotion_branches (
  promotion_id uuid not null references dental.promotions (id) on delete cascade,
  branch_id uuid not null references dental.branches (id) on delete cascade,
  primary key (promotion_id, branch_id)
);

create table if not exists dental.promotion_targets (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references dental.promotions (id) on delete cascade,
  target_kind dental.promotion_target_kind not null,
  item_id uuid references dental.items (id) on delete cascade,
  service_id uuid references dental.services (id) on delete cascade,
  category_id uuid references dental.categories (id) on delete cascade,
  customer_id uuid references dental.customers (id) on delete cascade,
  check (
    (target_kind = 'item' and item_id is not null and service_id is null and category_id is null and customer_id is null)
    or (target_kind = 'service' and service_id is not null and item_id is null and category_id is null and customer_id is null)
    or (target_kind = 'category' and category_id is not null and item_id is null and service_id is null and customer_id is null)
    or (target_kind = 'customer' and customer_id is not null and item_id is null and service_id is null and category_id is null)
  )
);

create table if not exists dental.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references dental.promotions (id),
  sale_id uuid not null references dental.sales (id) on delete cascade,
  branch_id uuid not null references dental.branches (id),
  customer_id uuid references dental.customers (id),
  discount_amount numeric(12, 2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  unique (sale_id)
);

create index if not exists promotions_status_dates_idx
  on dental.promotions (status, starts_at, ends_at);
create index if not exists promotion_targets_promotion_id_idx
  on dental.promotion_targets (promotion_id);
create index if not exists promotion_redemptions_promotion_id_idx
  on dental.promotion_redemptions (promotion_id);
create index if not exists promotion_redemptions_customer_id_idx
  on dental.promotion_redemptions (customer_id);

do $$ begin
  alter table dental.sale_lines
    add constraint sale_lines_promotion_id_fkey
    foreign key (promotion_id) references dental.promotions (id);
exception
  when duplicate_object then null;
end $$;

alter table dental.promotions enable row level security;
alter table dental.promotion_branches enable row level security;
alter table dental.promotion_targets enable row level security;
alter table dental.promotion_redemptions enable row level security;

drop policy if exists promotions_select on dental.promotions;
create policy promotions_select
on dental.promotions for select to authenticated
using (true);

drop policy if exists promotions_write on dental.promotions;
create policy promotions_write
on dental.promotions for all to authenticated
using (dental.is_owner())
with check (dental.is_owner());

drop policy if exists promotion_branches_select on dental.promotion_branches;
create policy promotion_branches_select
on dental.promotion_branches for select to authenticated
using (true);

drop policy if exists promotion_branches_write on dental.promotion_branches;
create policy promotion_branches_write
on dental.promotion_branches for all to authenticated
using (dental.is_owner())
with check (dental.is_owner());

drop policy if exists promotion_targets_select on dental.promotion_targets;
create policy promotion_targets_select
on dental.promotion_targets for select to authenticated
using (true);

drop policy if exists promotion_targets_write on dental.promotion_targets;
create policy promotion_targets_write
on dental.promotion_targets for all to authenticated
using (dental.is_owner())
with check (dental.is_owner());

drop policy if exists promotion_redemptions_select on dental.promotion_redemptions;
create policy promotion_redemptions_select
on dental.promotion_redemptions for select to authenticated
using (
  dental.is_owner()
  or branch_id in (select dental.user_branch_ids())
);

-- Writes only via checkout (security definer).
drop policy if exists promotion_redemptions_write on dental.promotion_redemptions;
create policy promotion_redemptions_write
on dental.promotion_redemptions for insert to authenticated
with check (false);

create or replace function dental.next_promotion_code()
returns text
language plpgsql
security definer
set search_path = dental
as $$
declare
  seq integer;
begin
  select count(*)::integer + 1 into seq from dental.promotions;
  return 'PROMO-' || lpad(seq::text, 4, '0');
end;
$$;

revoke all on function dental.next_promotion_code() from public;
grant execute on function dental.next_promotion_code() to authenticated, service_role;

create or replace function dental.publish_promotion(p_promotion_id uuid)
returns dental.promotions
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.promotions%rowtype;
  v_status dental.promotion_status;
begin
  if not dental.is_owner() then
    raise exception 'Only the owner can publish promotions';
  end if;

  select * into v_row from dental.promotions where id = p_promotion_id for update;
  if v_row.id is null then
    raise exception 'Promotion not found';
  end if;
  if v_row.status = 'ended' then
    raise exception 'Ended promotions cannot be published';
  end if;

  if v_row.ends_at <= now() then
    raise exception 'Promotion end date is in the past';
  end if;

  if v_row.starts_at > now() then
    v_status := 'scheduled';
  else
    v_status := 'active';
  end if;

  update dental.promotions
  set
    status = v_status,
    published_at = coalesce(published_at, now()),
    updated_at = now()
  where id = p_promotion_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function dental.publish_promotion(uuid) from public;
grant execute on function dental.publish_promotion(uuid) to authenticated, service_role;

create or replace function dental.set_promotion_status(
  p_promotion_id uuid,
  p_status dental.promotion_status
)
returns dental.promotions
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.promotions%rowtype;
begin
  if not dental.is_owner() then
    raise exception 'Only the owner can change promotion status';
  end if;
  if p_status not in ('draft', 'paused', 'ended', 'active', 'scheduled') then
    raise exception 'Invalid status';
  end if;

  update dental.promotions
  set status = p_status, updated_at = now()
  where id = p_promotion_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Promotion not found';
  end if;
  return v_row;
end;
$$;

revoke all on function dental.set_promotion_status(uuid, dental.promotion_status) from public;
grant execute on function dental.set_promotion_status(uuid, dental.promotion_status) to authenticated, service_role;

create or replace function dental.count_promotion_audience(p_promotion_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_promo dental.promotions%rowtype;
  v_count integer := 0;
  v_branch_filter boolean;
begin
  select * into v_promo from dental.promotions where id = p_promotion_id;
  if v_promo.id is null then
    return 0;
  end if;

  select exists (
    select 1 from dental.promotion_branches where promotion_id = p_promotion_id
  ) into v_branch_filter;

  select count(*)::integer into v_count
  from dental.customers c
  where c.whatsapp_opt_in
    and (
      not v_branch_filter
      or c.branch_id in (
        select branch_id from dental.promotion_branches where promotion_id = p_promotion_id
      )
    )
    and (
      v_promo.audience = 'all'
      or (v_promo.audience = 'retail' and c.customer_type = 'retail')
      or (v_promo.audience = 'wholesale' and c.customer_type = 'wholesale')
      or (
        v_promo.audience = 'wholesale_subtype'
        and c.customer_type = 'wholesale'
        and lower(coalesce(c.subtype, '')) = lower(v_promo.wholesale_subtype)
      )
      or (
        v_promo.audience = 'named_customers'
        and exists (
          select 1
          from dental.promotion_targets t
          where t.promotion_id = p_promotion_id
            and t.target_kind = 'customer'
            and t.customer_id = c.id
        )
      )
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function dental.count_promotion_audience(uuid) from public;
grant execute on function dental.count_promotion_audience(uuid) to authenticated, service_role;

-- Build priced cart lines (same rules as checkout) for evaluation / preview.
create or replace function dental.build_cart_lines(
  p_branch_id uuid,
  p_customer_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_customer dental.customers%rowtype;
  v_price_list dental.price_list := 'retail';
  v_line jsonb;
  v_out jsonb := '[]'::jsonb;
  v_line_type text;
  v_qty numeric(12, 2);
  v_item_id uuid;
  v_service_id uuid;
  v_item dental.items%rowtype;
  v_service dental.services%rowtype;
  v_unit numeric(12, 2);
  v_rate numeric(8, 6);
  v_net numeric(12, 2);
  v_sort integer := 0;
begin
  if p_customer_id is not null then
    select * into v_customer from dental.customers where id = p_customer_id;
    if v_customer.id is not null and v_customer.customer_type = 'wholesale' then
      v_price_list := 'wholesale';
    end if;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sort := v_sort + 1;
    v_line_type := lower(trim(coalesce(v_line->>'line_type', '')));
    v_qty := (v_line->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Line quantity must be positive';
    end if;

    if v_line_type = 'item' then
      v_item_id := (v_line->>'item_id')::uuid;
      select * into v_item from dental.items where id = v_item_id and active;
      if v_item.id is null then
        raise exception 'Item not found or inactive';
      end if;
      v_unit := dental.resolve_unit_price(v_price_list, v_qty, v_item_id, null);
      v_rate := 0;
      if v_item.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_item.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_net := round(v_unit * v_qty, 2);
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'sort', v_sort,
        'line_type', 'item',
        'item_id', v_item_id,
        'service_id', null,
        'category_id', v_item.category_id,
        'sku_or_code', v_item.sku,
        'name', v_item.name,
        'qty', v_qty,
        'unit_price', v_unit,
        'tax_rate', v_rate,
        'line_net', v_net
      ));
    elsif v_line_type = 'service' then
      v_service_id := (v_line->>'service_id')::uuid;
      select * into v_service from dental.services where id = v_service_id and active;
      if v_service.id is null then
        raise exception 'Service not found or inactive';
      end if;
      if v_qty <> trunc(v_qty) then
        raise exception 'Service quantity must be a whole number';
      end if;
      v_unit := dental.resolve_unit_price('retail', v_qty, null, v_service_id);
      v_rate := 0;
      if v_service.tax_rate_id is not null then
        select coalesce(tr.rate, 0) into v_rate
        from dental.tax_rates tr
        where tr.id = v_service.tax_rate_id and tr.active;
        v_rate := coalesce(v_rate, 0);
      end if;
      v_net := round(v_unit * v_qty, 2);
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'sort', v_sort,
        'line_type', 'service',
        'item_id', null,
        'service_id', v_service_id,
        'category_id', v_service.category_id,
        'sku_or_code', v_service.code,
        'name', v_service.name,
        'qty', v_qty,
        'unit_price', v_unit,
        'tax_rate', v_rate,
        'line_net', v_net
      ));
    else
      raise exception 'Invalid line_type %', v_line_type;
    end if;
  end loop;

  return v_out;
end;
$$;

revoke all on function dental.build_cart_lines(uuid, uuid, jsonb) from public;
grant execute on function dental.build_cart_lines(uuid, uuid, jsonb) to authenticated, service_role;

create or replace function dental.line_matches_promo_scope(
  p_promo dental.promotions,
  p_line jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_has_item_targets boolean;
  v_has_service_targets boolean;
  v_has_category_targets boolean;
begin
  if p_promo.scope = 'invoice' then
    return true;
  end if;

  if p_promo.scope = 'items' then
    if (p_line->>'line_type') <> 'item' then
      return false;
    end if;
    select exists (
      select 1 from dental.promotion_targets
      where promotion_id = p_promo.id and target_kind = 'item'
    ) into v_has_item_targets;
    if not v_has_item_targets then
      return true;
    end if;
    return exists (
      select 1 from dental.promotion_targets t
      where t.promotion_id = p_promo.id
        and t.target_kind = 'item'
        and t.item_id = (p_line->>'item_id')::uuid
    );
  end if;

  if p_promo.scope = 'services' then
    if (p_line->>'line_type') <> 'service' then
      return false;
    end if;
    select exists (
      select 1 from dental.promotion_targets
      where promotion_id = p_promo.id and target_kind = 'service'
    ) into v_has_service_targets;
    if not v_has_service_targets then
      return true;
    end if;
    return exists (
      select 1 from dental.promotion_targets t
      where t.promotion_id = p_promo.id
        and t.target_kind = 'service'
        and t.service_id = (p_line->>'service_id')::uuid
    );
  end if;

  if p_promo.scope = 'categories' then
    if (p_line->>'line_type') <> 'item' then
      return false;
    end if;
    select exists (
      select 1 from dental.promotion_targets
      where promotion_id = p_promo.id and target_kind = 'category'
    ) into v_has_category_targets;
    if not v_has_category_targets then
      return false;
    end if;
    return exists (
      select 1 from dental.promotion_targets t
      where t.promotion_id = p_promo.id
        and t.target_kind = 'category'
        and t.category_id = (p_line->>'category_id')::uuid
    );
  end if;

  return false;
end;
$$;

revoke all on function dental.line_matches_promo_scope(dental.promotions, jsonb) from public;
grant execute on function dental.line_matches_promo_scope(dental.promotions, jsonb) to authenticated, service_role;

create or replace function dental.compute_promotion_discount(
  p_promo dental.promotions,
  p_lines jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_line jsonb;
  v_eligible jsonb := '[]'::jsonb;
  v_eligible_net numeric(12, 2) := 0;
  v_eligible_qty numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_free numeric(12, 2);
  v_alloc jsonb := '[]'::jsonb;
  v_remain numeric(12, 2);
  v_share numeric(12, 2);
  v_i integer := 0;
  v_n integer;
  v_line_disc numeric(12, 2);
  v_ok boolean;
  v_missing boolean;
  v_target record;
begin
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    if dental.line_matches_promo_scope(p_promo, v_line) then
      v_eligible := v_eligible || jsonb_build_array(v_line);
      v_eligible_net := v_eligible_net + (v_line->>'line_net')::numeric;
      v_eligible_qty := v_eligible_qty + (v_line->>'qty')::numeric;
    end if;
  end loop;

  if jsonb_array_length(v_eligible) = 0 then
    return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
  end if;

  if p_promo.min_qty is not null and v_eligible_qty < p_promo.min_qty then
    return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
  end if;

  if p_promo.promo_type = 'percentage' then
    if p_promo.percent_off is null then
      return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
    end if;
    v_discount := round(v_eligible_net * p_promo.percent_off / 100.0, 2);

  elsif p_promo.promo_type = 'fixed_amount' then
    if p_promo.amount_off is null then
      return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
    end if;
    v_discount := least(p_promo.amount_off, v_eligible_net);

  elsif p_promo.promo_type = 'spend_threshold' then
    if p_promo.spend_min is null or v_eligible_net < p_promo.spend_min then
      return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
    end if;
    if p_promo.percent_off is not null then
      v_discount := round(v_eligible_net * p_promo.percent_off / 100.0, 2);
    else
      v_discount := least(coalesce(p_promo.amount_off, 0), v_eligible_net);
    end if;

  elsif p_promo.promo_type = 'buy_x_get_y' then
    if p_promo.buy_qty is null or p_promo.get_qty is null then
      return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
    end if;
    v_discount := 0;
    for v_line in select * from jsonb_array_elements(v_eligible)
    loop
      v_free := floor((v_line->>'qty')::numeric / p_promo.buy_qty) * p_promo.get_qty;
      if v_free > 0 then
        v_line_disc := round(least(v_free, (v_line->>'qty')::numeric) * (v_line->>'unit_price')::numeric, 2);
        v_discount := v_discount + v_line_disc;
        v_alloc := v_alloc || jsonb_build_array(jsonb_build_object(
          'sort', (v_line->>'sort')::integer,
          'discount_amount', v_line_disc
        ));
      end if;
    end loop;
    return jsonb_build_object('discount_total', v_discount, 'line_discounts', v_alloc);

  elsif p_promo.promo_type = 'bundle' then
    if p_promo.bundle_price is null then
      return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
    end if;
    -- Require every item/service target to appear in eligible lines.
    v_missing := false;
    for v_target in
      select * from dental.promotion_targets
      where promotion_id = p_promo.id and target_kind in ('item', 'service')
    loop
      v_ok := false;
      for v_line in select * from jsonb_array_elements(v_eligible)
      loop
        if v_target.target_kind = 'item'
          and (v_line->>'item_id')::uuid = v_target.item_id then
          v_ok := true;
        end if;
        if v_target.target_kind = 'service'
          and (v_line->>'service_id')::uuid = v_target.service_id then
          v_ok := true;
        end if;
      end loop;
      if not v_ok then
        v_missing := true;
        exit;
      end if;
    end loop;
    if v_missing then
      return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
    end if;
    v_discount := greatest(0, round(v_eligible_net - p_promo.bundle_price, 2));
  else
    return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
  end if;

  if v_discount <= 0 then
    return jsonb_build_object('discount_total', 0, 'line_discounts', '[]'::jsonb);
  end if;

  -- Proportional allocation across eligible lines.
  v_n := jsonb_array_length(v_eligible);
  v_remain := v_discount;
  v_i := 0;
  for v_line in select * from jsonb_array_elements(v_eligible)
  loop
    v_i := v_i + 1;
    if v_i = v_n then
      v_line_disc := v_remain;
    else
      v_share := case
        when v_eligible_net <= 0 then 0
        else round(v_discount * ((v_line->>'line_net')::numeric / v_eligible_net), 2)
      end;
      v_line_disc := least(v_share, (v_line->>'line_net')::numeric, v_remain);
      v_remain := v_remain - v_line_disc;
    end if;
    v_alloc := v_alloc || jsonb_build_array(jsonb_build_object(
      'sort', (v_line->>'sort')::integer,
      'discount_amount', v_line_disc
    ));
  end loop;

  return jsonb_build_object('discount_total', v_discount, 'line_discounts', v_alloc);
end;
$$;

revoke all on function dental.compute_promotion_discount(dental.promotions, jsonb) from public;
grant execute on function dental.compute_promotion_discount(dental.promotions, jsonb) to authenticated, service_role;

create or replace function dental.promotion_audience_matches(
  p_promo dental.promotions,
  p_customer dental.customers
)
returns boolean
language plpgsql
stable
security definer
set search_path = dental
as $$
begin
  if p_promo.audience = 'all' then
    return true;
  end if;
  if p_customer.id is null then
    -- Walk-in: retail-like for audience all/retail only.
    return p_promo.audience = 'retail';
  end if;
  if p_promo.audience = 'retail' then
    return p_customer.customer_type = 'retail';
  end if;
  if p_promo.audience = 'wholesale' then
    return p_customer.customer_type = 'wholesale';
  end if;
  if p_promo.audience = 'wholesale_subtype' then
    return p_customer.customer_type = 'wholesale'
      and lower(coalesce(p_customer.subtype, '')) = lower(p_promo.wholesale_subtype);
  end if;
  if p_promo.audience = 'named_customers' then
    return exists (
      select 1 from dental.promotion_targets t
      where t.promotion_id = p_promo.id
        and t.target_kind = 'customer'
        and t.customer_id = p_customer.id
    );
  end if;
  return false;
end;
$$;

revoke all on function dental.promotion_audience_matches(dental.promotions, dental.customers) from public;
grant execute on function dental.promotion_audience_matches(dental.promotions, dental.customers) to authenticated, service_role;

create or replace function dental.evaluate_best_promotion(
  p_branch_id uuid,
  p_customer_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_customer dental.customers%rowtype;
  v_priced jsonb;
  v_promo dental.promotions%rowtype;
  v_best_id uuid;
  v_best_name text;
  v_best_code text;
  v_best_discount numeric(12, 2) := 0;
  v_best_alloc jsonb := '[]'::jsonb;
  v_result jsonb;
  v_disc numeric(12, 2);
  v_total_redemptions integer;
  v_customer_redemptions integer;
  v_branch_ok boolean;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    return jsonb_build_object(
      'promotion_id', null,
      'discount_total', 0,
      'line_discounts', '[]'::jsonb
    );
  end if;

  if p_customer_id is not null then
    select * into v_customer from dental.customers where id = p_customer_id;
  end if;

  v_priced := dental.build_cart_lines(p_branch_id, p_customer_id, p_lines);

  for v_promo in
    select *
    from dental.promotions
    where status in ('active', 'scheduled')
      and starts_at <= now()
      and ends_at >= now()
  loop
    -- Treat scheduled that has reached start as eligible (same window check).
    if v_promo.status = 'scheduled' and v_promo.starts_at > now() then
      continue;
    end if;

    select not exists (
      select 1 from dental.promotion_branches where promotion_id = v_promo.id
    )
    or exists (
      select 1 from dental.promotion_branches
      where promotion_id = v_promo.id and branch_id = p_branch_id
    )
    into v_branch_ok;
    if not v_branch_ok then
      continue;
    end if;

    if not dental.promotion_audience_matches(v_promo, v_customer) then
      continue;
    end if;

    if v_promo.max_redemptions_total is not null then
      select count(*)::integer into v_total_redemptions
      from dental.promotion_redemptions where promotion_id = v_promo.id;
      if v_total_redemptions >= v_promo.max_redemptions_total then
        continue;
      end if;
    end if;

    if v_promo.max_redemptions_per_customer is not null and p_customer_id is not null then
      select count(*)::integer into v_customer_redemptions
      from dental.promotion_redemptions
      where promotion_id = v_promo.id and customer_id = p_customer_id;
      if v_customer_redemptions >= v_promo.max_redemptions_per_customer then
        continue;
      end if;
    end if;

    v_result := dental.compute_promotion_discount(v_promo, v_priced);
    v_disc := coalesce((v_result->>'discount_total')::numeric, 0);
    if v_disc > v_best_discount then
      v_best_discount := v_disc;
      v_best_id := v_promo.id;
      v_best_name := v_promo.name;
      v_best_code := v_promo.code;
      v_best_alloc := coalesce(v_result->'line_discounts', '[]'::jsonb);
    end if;
  end loop;

  return jsonb_build_object(
    'promotion_id', v_best_id,
    'code', v_best_code,
    'name', v_best_name,
    'discount_total', v_best_discount,
    'line_discounts', v_best_alloc,
    'priced_lines', v_priced
  );
end;
$$;

revoke all on function dental.evaluate_best_promotion(uuid, uuid, jsonb) from public;
grant execute on function dental.evaluate_best_promotion(uuid, uuid, jsonb) to authenticated, service_role;

-- Replace checkout to apply best promotion (discount before VAT).
drop function if exists dental.checkout_sale(uuid, uuid, jsonb, jsonb, text, date);

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
  v_discount_total := coalesce((v_eval->>'discount_total')::numeric, 0);

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
    -- Subtotal is pre-discount net; documents show Discount separately.
    v_subtotal := v_subtotal + (v_line->>'line_net')::numeric;
    v_line_net := round((v_line->>'line_net')::numeric - v_line_disc, 2);
    if v_line_net < 0 then
      v_line_net := 0;
    end if;
    v_tax_rate := (v_line->>'tax_rate')::numeric;
    v_tax_amount := round(v_line_net * v_tax_rate, 2);
    v_tax_total := v_tax_total + v_tax_amount;
  end loop;

  v_total := round(v_subtotal - v_discount_total + v_tax_total, 2);

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
    receipt_number, notes, due_date, created_by
  )
  values (
    p_branch_id, p_customer_id, v_status, v_price_list,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_paid,
    v_receipt, nullif(trim(p_notes), ''),
    case when v_status = 'partial' and v_is_wholesale then p_due_date else null end,
    auth.uid()
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
        case when v_line_disc > 0 then v_promo_id else null end,
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
        case when v_line_disc > 0 then v_promo_id else null end,
        v_sort
      );

      for v_i in 1 .. v_qty::integer
      loop
        perform dental.apply_service_recipe(p_branch_id, v_service_id, 'sale', v_sale_id);
      end loop;
    end if;
  end loop;

  if v_promo_id is not null and v_discount_total > 0 then
    insert into dental.promotion_redemptions (
      promotion_id, sale_id, branch_id, customer_id, discount_amount
    )
    values (
      v_promo_id, v_sale_id, p_branch_id, p_customer_id, v_discount_total
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

  return v_sale_id;
end;
$$;

revoke all on function dental.checkout_sale(uuid, uuid, jsonb, jsonb, text, date) from public;
grant execute on function dental.checkout_sale(uuid, uuid, jsonb, jsonb, text, date) to authenticated, service_role;
