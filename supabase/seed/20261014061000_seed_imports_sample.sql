-- Sample confirmed customer import for step 13.
-- Skips catalog/stock domains. Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_batch_id uuid;
begin
  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;

  if v_branch_id is null then
    raise exception 'No active branch.';
  end if;

  if exists (
    select 1 from dental.import_batches where notes = 'SEED-IMPORT-CUSTOMERS'
  ) then
    return;
  end if;

  v_batch_id := dental.create_import_batch(
    'customers',
    v_branch_id,
    'seed_customers.csv',
    jsonb_build_array(
      jsonb_build_object(
        'name', 'Seed Retail Patient',
        'customer_type', 'retail',
        'subtype', '',
        'phone', '634111222',
        'language', 'so',
        'credit_limit', '',
        'notes', 'SEED-IMPORT-CUSTOMERS'
      ),
      jsonb_build_object(
        'name', 'Seed Wholesale Pharmacy',
        'customer_type', 'wholesale',
        'subtype', 'pharmacy',
        'phone', '+252634333444',
        'language', 'ar',
        'credit_limit', '2500',
        'notes', 'SEED-IMPORT-CUSTOMERS'
      )
    ),
    'SEED-IMPORT-CUSTOMERS'
  );

  perform dental.confirm_import(v_batch_id);
end $$;
