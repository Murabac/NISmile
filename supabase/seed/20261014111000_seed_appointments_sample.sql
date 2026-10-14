-- Sample data for step 19 (appointments).
-- One retail patient + booked/confirmed slots for the demo dentist.
-- Skips catalog. Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_customer_id uuid;
  v_dentist_id uuid;
  v_service_id uuid;
  v_duration integer := 45;
  v_day date := current_date;
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
    select 1 from dental.appointments where notes = 'SEED-APPOINTMENT'
  ) then
    return;
  end if;

  select user_id into v_dentist_id
  from dental.profiles
  where role = 'dentist'
  order by created_at
  limit 1;

  if v_dentist_id is null then
    select user_id into v_dentist_id
    from dental.profiles
    where role = 'owner'
    order by created_at
    limit 1;
  end if;

  if v_dentist_id is null then
    raise exception 'No dentist/owner profile. Seed demo users first.';
  end if;

  select id, coalesce(duration_minutes, 45)
  into v_service_id, v_duration
  from dental.services
  where code = 'SRV-002' and active
  limit 1;

  if v_service_id is null then
    select id, coalesce(duration_minutes, 45)
    into v_service_id, v_duration
    from dental.services
    where active
    order by created_at
    limit 1;
  end if;

  if v_service_id is null then
    raise exception 'No active service. Run catalog seed first.';
  end if;

  select id into v_customer_id
  from dental.customers
  where notes = 'SEED-APPOINTMENT-PATIENT'
  limit 1;

  if v_customer_id is null then
    insert into dental.customers (
      branch_id, name, phone, customer_type, language,
      whatsapp_opt_in, notes
    )
    values (
      v_branch_id,
      'Ayaan Abdi Mohamed',
      '+252634819201',
      'retail',
      'so',
      true,
      'SEED-APPOINTMENT-PATIENT'
    )
    returning id into v_customer_id;
  end if;

  -- Today mid-afternoon, confirmed.
  insert into dental.appointments (
    branch_id, customer_id, dentist_id, service_id,
    start_at, end_at, status, notes, created_by
  )
  values (
    v_branch_id,
    v_customer_id,
    v_dentist_id,
    v_service_id,
    (v_day + time '15:00') at time zone 'Africa/Mogadishu',
    (v_day + time '15:00') at time zone 'Africa/Mogadishu'
      + make_interval(mins => v_duration),
    'confirmed',
    'SEED-APPOINTMENT',
    v_dentist_id
  );

  -- Tomorrow morning, scheduled.
  insert into dental.appointments (
    branch_id, customer_id, dentist_id, service_id,
    start_at, end_at, status, notes, created_by
  )
  values (
    v_branch_id,
    v_customer_id,
    v_dentist_id,
    v_service_id,
    ((v_day + 1) + time '10:30') at time zone 'Africa/Mogadishu',
    ((v_day + 1) + time '10:30') at time zone 'Africa/Mogadishu'
      + make_interval(mins => v_duration),
    'scheduled',
    'SEED-APPOINTMENT',
    v_dentist_id
  );
end;
$$;
