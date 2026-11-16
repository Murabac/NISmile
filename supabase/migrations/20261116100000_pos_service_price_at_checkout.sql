-- Allow POS to send a unit_price on service lines (price entered at checkout).
-- Catalog retail price remains the default when unit_price is omitted.
-- Items still always use resolve_unit_price for the customer's price list.

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
  v_override numeric(12, 2);
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

      -- Checkout may pass unit_price; otherwise use catalog retail.
      if v_line ? 'unit_price'
        and nullif(trim(coalesce(v_line->>'unit_price', '')), '') is not null
      then
        v_override := (v_line->>'unit_price')::numeric;
        if v_override is null or v_override < 0 then
          raise exception 'Service unit price must be zero or greater';
        end if;
        v_unit := round(v_override, 2);
      else
        v_unit := dental.resolve_unit_price('retail', v_qty, null, v_service_id);
      end if;

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
