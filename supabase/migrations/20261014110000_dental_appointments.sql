-- DentaFlow appointments (step 19).
-- Per branch + dentist. Status: scheduled → confirmed → completed | cancelled | no_show.
-- Completing creates a sale (services) via checkout_sale. WhatsApp queue is step 20+.

do $$ begin
  create type dental.appointment_status as enum (
    'scheduled',
    'confirmed',
    'completed',
    'cancelled',
    'no_show'
  );
exception when duplicate_object then null;
end $$;

create table if not exists dental.appointments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  customer_id uuid not null references dental.customers (id),
  dentist_id uuid not null references dental.profiles (user_id),
  service_id uuid references dental.services (id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status dental.appointment_status not null default 'scheduled',
  notes text,
  sale_id uuid references dental.sales (id),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists appointments_branch_start_idx
  on dental.appointments (branch_id, start_at);
create index if not exists appointments_dentist_start_idx
  on dental.appointments (dentist_id, start_at);
create index if not exists appointments_customer_id_idx
  on dental.appointments (customer_id);
create index if not exists appointments_status_idx
  on dental.appointments (status);

create or replace function dental.can_manage_appointments()
returns boolean
language sql
stable
security definer
set search_path = dental
as $$
  select exists (
    select 1
    from dental.profiles
    where user_id = auth.uid()
      and role in ('owner', 'branch_manager', 'receptionist', 'dentist')
  );
$$;

revoke all on function dental.can_manage_appointments() from public;
grant execute on function dental.can_manage_appointments() to authenticated;

create or replace function dental.create_appointment(
  p_branch_id uuid,
  p_customer_id uuid,
  p_dentist_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_service_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_id uuid;
  v_customer dental.customers%rowtype;
  v_dentist dental.profiles%rowtype;
  v_duration integer;
  v_end timestamptz;
begin
  if p_branch_id is null or p_customer_id is null or p_dentist_id is null then
    raise exception 'Branch, patient, and dentist are required';
  end if;
  if p_start_at is null then
    raise exception 'Start time is required';
  end if;

  if auth.uid() is not null then
    if not dental.can_manage_appointments() and not dental.is_owner() then
      raise exception 'Not allowed to book appointments';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  select * into v_customer from dental.customers where id = p_customer_id;
  if not found then
    raise exception 'Patient not found';
  end if;
  if v_customer.branch_id <> p_branch_id then
    raise exception 'Patient belongs to another branch';
  end if;
  if v_customer.customer_type <> 'retail' then
    raise exception 'Appointments are for retail patients only';
  end if;

  select * into v_dentist from dental.profiles where user_id = p_dentist_id;
  if not found then
    raise exception 'Dentist not found';
  end if;
  if v_dentist.role <> 'dentist' and v_dentist.role <> 'owner' then
    raise exception 'Selected staff is not a dentist';
  end if;

  v_end := p_end_at;
  if v_end is null then
    v_duration := 30;
    if p_service_id is not null then
      select coalesce(duration_minutes, 30) into v_duration
      from dental.services
      where id = p_service_id and active;
      if not found then
        raise exception 'Service not found';
      end if;
    end if;
    v_end := p_start_at + make_interval(mins => v_duration);
  end if;

  if v_end <= p_start_at then
    raise exception 'End time must be after start time';
  end if;

  if p_service_id is not null
     and not exists (select 1 from dental.services where id = p_service_id and active)
  then
    raise exception 'Service not found or inactive';
  end if;

  insert into dental.appointments (
    branch_id, customer_id, dentist_id, service_id,
    start_at, end_at, status, notes, created_by
  )
  values (
    p_branch_id, p_customer_id, p_dentist_id, p_service_id,
    p_start_at, v_end, 'scheduled',
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function dental.create_appointment(uuid, uuid, uuid, timestamptz, timestamptz, uuid, text) from public;
grant execute on function dental.create_appointment(uuid, uuid, uuid, timestamptz, timestamptz, uuid, text) to authenticated, service_role;

create or replace function dental.set_appointment_status(
  p_appointment_id uuid,
  p_status dental.appointment_status
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
begin
  if p_appointment_id is null then
    raise exception 'Appointment is required';
  end if;
  if p_status is null then
    raise exception 'Status is required';
  end if;
  if p_status = 'completed' then
    raise exception 'Use complete_appointment to finish a visit';
  end if;

  select * into v_apt from dental.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if auth.uid() is not null then
    if not dental.can_manage_appointments() and not dental.is_owner() then
      raise exception 'Not allowed to update appointments';
    end if;
    if not dental.is_owner() and v_apt.branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if v_apt.status = 'completed' then
    raise exception 'Completed appointments cannot change status';
  end if;
  if v_apt.status in ('cancelled', 'no_show') and p_status not in ('scheduled', 'confirmed') then
    raise exception 'Reopen cancelled/no-show as scheduled or confirmed only';
  end if;

  update dental.appointments
  set status = p_status
  where id = p_appointment_id;
end;
$$;

revoke all on function dental.set_appointment_status(uuid, dental.appointment_status) from public;
grant execute on function dental.set_appointment_status(uuid, dental.appointment_status) to authenticated, service_role;

-- Complete visit: checkout services (default: booked service), link sale, mark completed.
-- p_lines: optional [{ line_type: 'service', service_id, qty }]; defaults to booked service × 1.
-- p_payments: tender list; if empty, full amount as cash.
create or replace function dental.complete_appointment(
  p_appointment_id uuid,
  p_lines jsonb default null,
  p_payments jsonb default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
  v_lines jsonb;
  v_payments jsonb;
  v_sale_id uuid;
  v_total numeric(12, 2);
  v_line jsonb;
  v_service_id uuid;
  v_qty numeric(12, 2);
  v_unit numeric(12, 2);
  v_tax numeric(8, 6);
  v_sub numeric(12, 2) := 0;
  v_tax_total numeric(12, 2) := 0;
begin
  select * into v_apt from dental.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if auth.uid() is not null then
    if not dental.can_manage_appointments() and not dental.is_owner() then
      raise exception 'Not allowed to complete appointments';
    end if;
    if not dental.is_owner() and v_apt.branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if v_apt.status in ('cancelled', 'no_show') then
    raise exception 'Cannot complete a % appointment', v_apt.status;
  end if;
  if v_apt.status = 'completed' then
    raise exception 'Appointment already completed';
  end if;
  if v_apt.sale_id is not null then
    raise exception 'Appointment already has a sale';
  end if;

  if p_lines is not null and jsonb_typeof(p_lines) = 'array' and jsonb_array_length(p_lines) > 0 then
    v_lines := p_lines;
  elsif v_apt.service_id is not null then
    v_lines := jsonb_build_array(
      jsonb_build_object(
        'line_type', 'service',
        'service_id', v_apt.service_id,
        'qty', 1
      )
    );
  else
    raise exception 'Select at least one service to complete this visit';
  end if;

  -- Preview total for default cash payment.
  for v_line in select * from jsonb_array_elements(v_lines)
  loop
    if lower(trim(coalesce(v_line->>'line_type', ''))) <> 'service' then
      raise exception 'Appointment completion supports service lines only';
    end if;
    v_service_id := (v_line->>'service_id')::uuid;
    v_qty := (v_line->>'qty')::numeric;
    if v_service_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Invalid service line';
    end if;
    v_unit := dental.resolve_unit_price('retail', v_qty, null, v_service_id);
    select coalesce(tr.rate, 0) into v_tax
    from dental.services s
    left join dental.tax_rates tr on tr.id = s.tax_rate_id and tr.active
    where s.id = v_service_id and s.active;
    if not found then
      raise exception 'Service not found';
    end if;
    v_sub := v_sub + round(v_unit * v_qty, 2);
    v_tax_total := v_tax_total + round(v_unit * v_qty * coalesce(v_tax, 0), 2);
  end loop;
  v_total := v_sub + v_tax_total;

  if p_payments is not null and jsonb_typeof(p_payments) = 'array' and jsonb_array_length(p_payments) > 0 then
    v_payments := p_payments;
  else
    v_payments := jsonb_build_array(
      jsonb_build_object(
        'tender', 'cash',
        'amount', v_total,
        'reference', 'APT-' || left(p_appointment_id::text, 8)
      )
    );
  end if;

  v_sale_id := dental.checkout_sale(
    v_apt.branch_id,
    v_apt.customer_id,
    v_lines,
    v_payments,
    coalesce(nullif(trim(coalesce(p_notes, '')), ''), 'Appointment ' || p_appointment_id::text),
    null
  );

  update dental.appointments
  set
    status = 'completed',
    sale_id = v_sale_id,
    notes = case
      when nullif(trim(coalesce(p_notes, '')), '') is null then notes
      when notes is null or notes = '' then trim(p_notes)
      else notes || E'\n' || trim(p_notes)
    end
  where id = p_appointment_id;

  return v_sale_id;
end;
$$;

revoke all on function dental.complete_appointment(uuid, jsonb, jsonb, text) from public;
grant execute on function dental.complete_appointment(uuid, jsonb, jsonb, text) to authenticated, service_role;

alter table dental.appointments enable row level security;

create policy appointments_select
on dental.appointments
for select
to authenticated
using (
  dental.is_owner()
  or branch_id in (select dental.user_branch_ids())
);

create policy appointments_insert
on dental.appointments
for insert
to authenticated
with check (
  (dental.can_manage_appointments() or dental.is_owner())
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

create policy appointments_update
on dental.appointments
for update
to authenticated
using (
  dental.is_owner()
  or branch_id in (select dental.user_branch_ids())
)
with check (
  (dental.can_manage_appointments() or dental.is_owner())
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

grant select, insert, update on dental.appointments to authenticated, service_role;
