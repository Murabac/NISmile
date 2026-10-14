-- Sample loyalty data for step 24.
-- Rates stay NULL (owner fills in Settings). Seeds ledger adjust for a retail patient.
-- Safe to re-run.

do $$
declare
  v_customer_id uuid;
  v_exists uuid;
begin
  -- Ensure settings singleton exists (migration also inserts).
  insert into dental.clinic_settings (id)
  select gen_random_uuid()
  where not exists (select 1 from dental.clinic_settings);

  select id into v_customer_id
  from dental.customers
  where notes = 'SEED-APPOINTMENT-PATIENT'
  order by created_at
  limit 1;

  if v_customer_id is null then
    raise notice 'No seed retail patient found; skip loyalty adjust.';
    return;
  end if;

  select id into v_exists
  from dental.loyalty_transactions
  where customer_id = v_customer_id
    and notes = 'SEED-LOYALTY-ADJUST'
  limit 1;

  if v_exists is not null then
    raise notice 'Seed loyalty adjust already present.';
    return;
  end if;

  -- Opening balance via adjust (does not invent earn/redeem rates).
  perform dental.apply_loyalty_transaction(
    v_customer_id,
    'adjust',
    250,
    null,
    null,
    'SEED-LOYALTY-ADJUST',
    null
  );
end $$;
