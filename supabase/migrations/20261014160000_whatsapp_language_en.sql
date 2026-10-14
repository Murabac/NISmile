-- Add English as a third WhatsApp message language (customer preference).
-- Staff UI stays English-only; this does not add a UI language switcher.

alter type dental.whatsapp_language add value if not exists 'en';

-- Allow en on customer Excel import validation.
create or replace function dental.validate_import_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_batch dental.import_batches%rowtype;
  v_row dental.import_rows%rowtype;
  v_errors text[];
  v_sku text;
  v_name text;
  v_cat text;
  v_phone text;
  v_type text;
  v_lang text;
  v_qty numeric;
  v_expiry date;
  v_batch_no text;
  v_legacy boolean;
begin
  select * into v_batch from dental.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Import batch not found'; end if;

  if auth.uid() is not null then
    if not dental.can_manage_imports() and not dental.is_owner() then
      raise exception 'Not allowed to manage imports';
    end if;
    if v_batch.branch_id is not null
       and not dental.is_owner()
       and v_batch.branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  for v_row in select * from dental.import_rows where batch_id = v_batch.id order by row_number
  loop
    v_errors := '{}';

    if v_batch.import_type = 'items' then
      v_sku := nullif(trim(v_row.raw->>'sku'), '');
      v_name := nullif(trim(v_row.raw->>'name'), '');
      v_cat := nullif(trim(v_row.raw->>'category'), '');
      if v_sku is null then v_errors := array_append(v_errors, 'SKU is required'); end if;
      if v_name is null then v_errors := array_append(v_errors, 'Name is required'); end if;
      if v_cat is null then v_errors := array_append(v_errors, 'Category is required'); end if;
      if nullif(trim(v_row.raw->>'unit'), '') is null then
        v_errors := array_append(v_errors, 'Unit is required');
      end if;
      if coalesce((v_row.raw->>'retail_price')::numeric, -1) < 0 then
        v_errors := array_append(v_errors, 'retail_price must be >= 0');
      end if;
    elsif v_batch.import_type = 'customers' then
      if v_batch.branch_id is null then
        v_errors := array_append(v_errors, 'Branch is required for customer import');
      end if;
      v_name := nullif(trim(v_row.raw->>'name'), '');
      v_type := lower(coalesce(nullif(trim(v_row.raw->>'customer_type'), ''), 'retail'));
      v_lang := lower(coalesce(nullif(trim(v_row.raw->>'language'), ''), 'so'));
      v_phone := dental.normalize_import_phone(v_row.raw->>'phone');
      if v_name is null then v_errors := array_append(v_errors, 'Name is required'); end if;
      if v_type not in ('retail', 'wholesale') then
        v_errors := array_append(v_errors, 'customer_type must be retail or wholesale');
      end if;
      if v_lang not in ('so', 'ar', 'en') then
        v_errors := array_append(v_errors, 'language must be so, ar, or en');
      end if;
      if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$' then
        v_errors := array_append(v_errors, 'Phone must be international (+252…)');
      end if;
    elsif v_batch.import_type = 'opening_stock' then
      if v_batch.branch_id is null then
        v_errors := array_append(v_errors, 'Branch is required for opening stock');
      end if;
      v_sku := nullif(trim(v_row.raw->>'sku'), '');
      v_batch_no := nullif(trim(v_row.raw->>'batch_no'), '');
      v_legacy := lower(coalesce(v_row.raw->>'legacy', 'n')) in ('y', 'yes', 'true', '1');
      if v_sku is null then v_errors := array_append(v_errors, 'SKU is required'); end if;
      if not exists (select 1 from dental.items where sku = v_sku) then
        v_errors := array_append(v_errors, 'Unknown SKU');
      end if;
      begin
        v_qty := (v_row.raw->>'quantity')::numeric;
      exception when others then
        v_qty := null;
      end;
      if v_qty is null or v_qty <= 0 then
        v_errors := array_append(v_errors, 'quantity must be positive');
      end if;
      if v_legacy then
        if v_batch_no is null then v_batch_no := 'LEGACY-' || coalesce(v_sku, 'ITEM'); end if;
      else
        if v_batch_no is null then v_errors := array_append(v_errors, 'batch_no is required'); end if;
        begin
          v_expiry := (v_row.raw->>'expiry_date')::date;
        exception when others then
          v_expiry := null;
        end;
        if v_expiry is null then
          v_errors := array_append(v_errors, 'expiry_date is required (YYYY-MM-DD)');
        elsif v_expiry < current_date then
          v_errors := array_append(v_errors, 'expiry_date is in the past');
        end if;
      end if;
    end if;

    update dental.import_rows
    set
      status = case when coalesce(array_length(v_errors, 1), 0) = 0 then 'ok'::dental.import_row_status
                    else 'error'::dental.import_row_status end,
      errors = v_errors,
      raw = case
        when v_batch.import_type = 'customers' then
          jsonb_set(v_row.raw, '{phone}', to_jsonb(dental.normalize_import_phone(v_row.raw->>'phone')))
        else v_row.raw
      end
    where id = v_row.id;
  end loop;

  update dental.import_batches
  set status = 'validated'
  where id = v_batch.id;
end;
$$;
