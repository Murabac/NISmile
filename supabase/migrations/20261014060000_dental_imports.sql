-- DentaFlow CSV imports: items, customers, opening stock.
-- Flow: upload → validate → dry run → confirm → optional revert.

do $$ begin
  create type dental.import_type as enum (
    'items',
    'customers',
    'opening_stock'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.import_batch_status as enum (
    'uploaded',
    'validated',
    'dry_run',
    'confirmed',
    'reverted',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.import_row_status as enum (
    'pending',
    'ok',
    'error',
    'applied',
    'reverted'
  );
exception when duplicate_object then null;
end $$;

create table if not exists dental.import_batches (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references dental.branches (id),
  import_type dental.import_type not null,
  status dental.import_batch_status not null default 'uploaded',
  file_name text,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  reverted_at timestamptz
);

create table if not exists dental.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references dental.import_batches (id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw jsonb not null default '{}'::jsonb,
  status dental.import_row_status not null default 'pending',
  errors text[] not null default '{}',
  created_entity_type text,
  created_entity_id uuid,
  created_action text,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index if not exists import_batches_branch_idx on dental.import_batches (branch_id);
create index if not exists import_rows_batch_idx on dental.import_rows (batch_id);

create or replace function dental.can_manage_imports()
returns boolean
language sql
stable
security definer
set search_path = dental
as $$
  select exists (
    select 1 from dental.profiles
    where user_id = auth.uid()
      and role in ('owner', 'branch_manager')
  );
$$;

revoke all on function dental.can_manage_imports() from public;
grant execute on function dental.can_manage_imports() to authenticated;

create or replace function dental.normalize_import_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  if p_phone is null then return null; end if;
  v := regexp_replace(trim(p_phone), '[\s\-()]', '', 'g');
  if v = '' then return null; end if;
  if left(v, 1) = '+' then
    return v;
  end if;
  if v ~ '^252[0-9]{6,}$' then
    return '+' || v;
  end if;
  if v ~ '^[0-9]{7,12}$' then
    return '+252' || ltrim(v, '0');
  end if;
  return v;
end;
$$;

revoke all on function dental.normalize_import_phone(text) from public;
grant execute on function dental.normalize_import_phone(text) to authenticated, service_role;

-- Validate one batch's rows in place.
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
      if v_lang not in ('so', 'ar') then
        v_errors := array_append(v_errors, 'language must be so or ar');
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

revoke all on function dental.validate_import_batch(uuid) from public;
grant execute on function dental.validate_import_batch(uuid) to authenticated, service_role;

create or replace function dental.create_import_batch(
  p_import_type dental.import_type,
  p_branch_id uuid,
  p_file_name text,
  p_rows jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_id uuid;
  v_row jsonb;
  v_num integer := 0;
begin
  if auth.uid() is not null then
    if not dental.can_manage_imports() and not dental.is_owner() then
      raise exception 'Not allowed to manage imports';
    end if;
    if p_branch_id is not null
       and not dental.is_owner()
       and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import';
  end if;

  if p_import_type in ('customers', 'opening_stock') and p_branch_id is null then
    raise exception 'Branch is required for this import type';
  end if;

  insert into dental.import_batches (
    branch_id, import_type, status, file_name, notes, created_by
  )
  values (
    p_branch_id, p_import_type, 'uploaded', p_file_name, p_notes, auth.uid()
  )
  returning id into v_id;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_num := v_num + 1;
    insert into dental.import_rows (batch_id, row_number, raw, status)
    values (v_id, v_num, v_row, 'pending');
  end loop;

  perform dental.validate_import_batch(v_id);
  return v_id;
end;
$$;

revoke all on function dental.create_import_batch(dental.import_type, uuid, text, jsonb, text) from public;
grant execute on function dental.create_import_batch(dental.import_type, uuid, text, jsonb, text) to authenticated, service_role;

create or replace function dental.dry_run_import(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_batch dental.import_batches%rowtype;
  v_errors integer;
begin
  perform dental.validate_import_batch(p_batch_id);

  select * into v_batch from dental.import_batches where id = p_batch_id;
  if v_batch.status not in ('validated', 'dry_run') then
    raise exception 'Batch cannot dry-run in status %', v_batch.status;
  end if;

  select count(*) into v_errors
  from dental.import_rows
  where batch_id = p_batch_id and status = 'error';

  if v_errors > 0 then
    update dental.import_batches set status = 'failed' where id = p_batch_id;
    raise exception 'Dry run failed: % row(s) have errors', v_errors;
  end if;

  update dental.import_batches set status = 'dry_run' where id = p_batch_id;
end;
$$;

revoke all on function dental.dry_run_import(uuid) from public;
grant execute on function dental.dry_run_import(uuid) to authenticated, service_role;

create or replace function dental.confirm_import(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_batch dental.import_batches%rowtype;
  v_row dental.import_rows%rowtype;
  v_cat_id uuid;
  v_item_id uuid;
  v_tax_id uuid;
  v_action text;
  v_batch_id uuid;
  v_batch_no text;
  v_expiry date;
  v_qty numeric(12, 2);
  v_cost numeric(12, 2);
  v_legacy boolean;
  v_phone text;
  v_cust_id uuid;
begin
  perform dental.dry_run_import(p_batch_id);

  select * into v_batch from dental.import_batches where id = p_batch_id for update;
  if v_batch.status <> 'dry_run' then
    raise exception 'Confirm requires a successful dry run';
  end if;

  select id into v_tax_id from dental.tax_rates where active order by created_at limit 1;

  for v_row in
    select * from dental.import_rows
    where batch_id = v_batch.id and status = 'ok'
    order by row_number
    for update
  loop
    if v_batch.import_type = 'items' then
      select id into v_cat_id from dental.categories
      where lower(name) = lower(trim(v_row.raw->>'category')) limit 1;
      if v_cat_id is null then
        insert into dental.categories (name, active)
        values (trim(v_row.raw->>'category'), true)
        returning id into v_cat_id;
      end if;

      select id into v_item_id from dental.items where sku = trim(v_row.raw->>'sku');
      if v_item_id is null then
        insert into dental.items (
          sku, barcode, name, category_id, unit, cost, reorder_level, tax_rate_id, active
        )
        values (
          trim(v_row.raw->>'sku'),
          nullif(trim(v_row.raw->>'barcode'), ''),
          trim(v_row.raw->>'name'),
          v_cat_id,
          trim(v_row.raw->>'unit'),
          coalesce((v_row.raw->>'cost')::numeric, 0),
          coalesce((v_row.raw->>'reorder_level')::numeric, 0),
          v_tax_id,
          true
        )
        returning id into v_item_id;
        v_action := 'insert';
      else
        update dental.items set
          name = trim(v_row.raw->>'name'),
          category_id = v_cat_id,
          unit = trim(v_row.raw->>'unit'),
          cost = coalesce((v_row.raw->>'cost')::numeric, cost),
          reorder_level = coalesce((v_row.raw->>'reorder_level')::numeric, reorder_level),
          barcode = coalesce(nullif(trim(v_row.raw->>'barcode'), ''), barcode),
          active = true
        where id = v_item_id;
        v_action := 'update';
      end if;

      insert into dental.item_prices (item_id, price_list, min_qty, price)
      values (v_item_id, 'retail', 1, coalesce((v_row.raw->>'retail_price')::numeric, 0))
      on conflict (item_id, price_list, min_qty)
      do update set price = excluded.price;

      if v_row.raw ? 'wholesale_price' and nullif(v_row.raw->>'wholesale_price', '') is not null then
        insert into dental.item_prices (item_id, price_list, min_qty, price)
        values (v_item_id, 'wholesale', 1, (v_row.raw->>'wholesale_price')::numeric)
        on conflict (item_id, price_list, min_qty)
        do update set price = excluded.price;
      end if;

      update dental.import_rows
      set status = 'applied', created_entity_type = 'item', created_entity_id = v_item_id, created_action = v_action
      where id = v_row.id;

    elsif v_batch.import_type = 'customers' then
      v_phone := dental.normalize_import_phone(v_row.raw->>'phone');
      insert into dental.customers (
        branch_id, name, phone, customer_type, subtype, language, credit_limit, notes
      )
      values (
        v_batch.branch_id,
        trim(v_row.raw->>'name'),
        v_phone,
        lower(coalesce(nullif(trim(v_row.raw->>'customer_type'), ''), 'retail')),
        nullif(trim(v_row.raw->>'subtype'), ''),
        lower(coalesce(nullif(trim(v_row.raw->>'language'), ''), 'so'))::dental.whatsapp_language,
        nullif(v_row.raw->>'credit_limit', '')::numeric,
        nullif(trim(v_row.raw->>'notes'), '')
      )
      returning id into v_cust_id;

      update dental.import_rows
      set status = 'applied', created_entity_type = 'customer', created_entity_id = v_cust_id, created_action = 'insert'
      where id = v_row.id;

    elsif v_batch.import_type = 'opening_stock' then
      select id into v_item_id from dental.items where sku = trim(v_row.raw->>'sku');
      v_legacy := lower(coalesce(v_row.raw->>'legacy', 'n')) in ('y', 'yes', 'true', '1');
      v_qty := (v_row.raw->>'quantity')::numeric;
      v_cost := coalesce((v_row.raw->>'unit_cost')::numeric, 0);
      v_batch_no := nullif(trim(v_row.raw->>'batch_no'), '');
      if v_legacy then
        v_batch_no := coalesce(v_batch_no, 'LEGACY-' || trim(v_row.raw->>'sku'));
        v_expiry := coalesce((v_row.raw->>'expiry_date')::date, current_date + 730);
      else
        v_expiry := (v_row.raw->>'expiry_date')::date;
      end if;

      insert into dental.stock_batches (
        branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost
      )
      values (v_batch.branch_id, v_item_id, v_batch_no, v_expiry, v_qty, v_cost)
      returning id into v_batch_id;

      insert into dental.stock_movements (
        branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, created_by, notes
      )
      values (
        v_batch.branch_id, v_item_id, v_batch_id, 'purchase_in', v_qty,
        'import_batch', v_batch.id, auth.uid(),
        case when v_legacy then 'Legacy opening stock' else 'Opening stock import' end
      );

      update dental.import_rows
      set status = 'applied', created_entity_type = 'stock_batch', created_entity_id = v_batch_id, created_action = 'insert'
      where id = v_row.id;
    end if;
  end loop;

  update dental.import_batches
  set status = 'confirmed', confirmed_at = timezone('utc', now())
  where id = v_batch.id;
end;
$$;

revoke all on function dental.confirm_import(uuid) from public;
grant execute on function dental.confirm_import(uuid) to authenticated, service_role;

create or replace function dental.revert_import(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_batch dental.import_batches%rowtype;
  v_row dental.import_rows%rowtype;
  v_sale_refs integer;
begin
  select * into v_batch from dental.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Import batch not found'; end if;

  if auth.uid() is not null then
    if not dental.can_manage_imports() and not dental.is_owner() then
      raise exception 'Not allowed to revert imports';
    end if;
  end if;

  if v_batch.status <> 'confirmed' then
    raise exception 'Only confirmed imports can be reverted';
  end if;

  -- Block if any sale_out references imported stock batches.
  select count(*) into v_sale_refs
  from dental.stock_movements m
  join dental.import_rows r on r.created_entity_id = m.batch_id
  where r.batch_id = v_batch.id
    and r.created_entity_type = 'stock_batch'
    and m.movement_type = 'sale_out';

  if v_sale_refs > 0 then
    raise exception 'Cannot revert: imported stock was used on a sale';
  end if;

  for v_row in
    select * from dental.import_rows
    where batch_id = v_batch.id and status = 'applied'
    order by row_number desc
  loop
    if v_row.created_entity_type = 'stock_batch' and v_row.created_entity_id is not null then
      delete from dental.stock_movements where batch_id = v_row.created_entity_id;
      delete from dental.stock_batches where id = v_row.created_entity_id;
    elsif v_row.created_entity_type = 'customer' and v_row.created_entity_id is not null then
      delete from dental.customers where id = v_row.created_entity_id;
    elsif v_row.created_entity_type = 'item'
          and v_row.created_action = 'insert'
          and v_row.created_entity_id is not null then
      if not exists (
        select 1 from dental.stock_batches where item_id = v_row.created_entity_id
      ) and not exists (
        select 1 from dental.stock_movements where item_id = v_row.created_entity_id
      ) then
        delete from dental.item_prices where item_id = v_row.created_entity_id;
        delete from dental.items where id = v_row.created_entity_id;
      end if;
    end if;

    update dental.import_rows set status = 'reverted' where id = v_row.id;
  end loop;

  update dental.import_batches
  set status = 'reverted', reverted_at = timezone('utc', now())
  where id = v_batch.id;
end;
$$;

revoke all on function dental.revert_import(uuid) from public;
grant execute on function dental.revert_import(uuid) to authenticated, service_role;

alter table dental.import_batches enable row level security;
alter table dental.import_rows enable row level security;

drop policy if exists import_batches_select on dental.import_batches;
drop policy if exists import_rows_select on dental.import_rows;

create policy import_batches_select on dental.import_batches
for select to authenticated
using (
  dental.is_owner()
  or branch_id is null
  or branch_id in (select dental.user_branch_ids())
);

create policy import_rows_select on dental.import_rows
for select to authenticated
using (
  exists (
    select 1 from dental.import_batches b
    where b.id = batch_id
      and (
        dental.is_owner()
        or b.branch_id is null
        or b.branch_id in (select dental.user_branch_ids())
      )
  )
);

grant select on dental.import_batches to authenticated, service_role;
grant select on dental.import_rows to authenticated, service_role;
grant select, insert, update, delete on dental.import_batches to service_role;
grant select, insert, update, delete on dental.import_rows to service_role;
grant usage on type dental.import_type to authenticated, service_role;
grant usage on type dental.import_batch_status to authenticated, service_role;
grant usage on type dental.import_row_status to authenticated, service_role;
