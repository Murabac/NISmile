-- Step 21: utility WhatsApp messages into the queue (so/ar by customer language).
-- Does not call Meta — only enqueue. PDFs stay English when attached later.

-- Soft enqueue: skips opt-out / missing phone / missing template without failing the caller.
create or replace function dental.try_enqueue_notification(
  p_branch_id uuid,
  p_kind text,
  p_phone text default null,
  p_language dental.whatsapp_language default null,
  p_customer_id uuid default null,
  p_params jsonb default '{}'::jsonb,
  p_scheduled_at timestamptz default null,
  p_related_type text default null,
  p_related_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_customer dental.customers%rowtype;
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_lang dental.whatsapp_language := p_language;
begin
  if p_customer_id is not null then
    select * into v_customer from dental.customers where id = p_customer_id;
    if not found then
      return null;
    end if;
    if not v_customer.whatsapp_opt_in then
      return null;
    end if;
    if v_phone is null then
      v_phone := nullif(trim(coalesce(v_customer.phone, '')), '');
    end if;
    if v_lang is null then
      v_lang := v_customer.language;
    end if;
  end if;

  if v_phone is null then
    return null;
  end if;

  if not exists (
    select 1 from dental.message_templates
    where kind = trim(p_kind) and language = coalesce(v_lang, 'so'::dental.whatsapp_language)
  ) then
    return null;
  end if;

  begin
    return dental.enqueue_notification(
      p_branch_id,
      p_kind,
      v_phone,
      v_lang,
      p_customer_id,
      coalesce(p_params, '{}'::jsonb),
      p_scheduled_at,
      p_related_type,
      p_related_id
    );
  exception when others then
    return null;
  end;
end;
$$;

revoke all on function dental.try_enqueue_notification(uuid, text, text, dental.whatsapp_language, uuid, jsonb, timestamptz, text, uuid) from public;
grant execute on function dental.try_enqueue_notification(uuid, text, text, dental.whatsapp_language, uuid, jsonb, timestamptz, text, uuid) to authenticated, service_role;

create or replace function dental.cancel_related_notifications(
  p_related_type text,
  p_related_id uuid
)
returns integer
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_count integer := 0;
begin
  update dental.notification_queue
  set status = 'cancelled'
  where related_type = p_related_type
    and related_id = p_related_id
    and status in ('pending', 'failed');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function dental.cancel_related_notifications(text, uuid) from public;
grant execute on function dental.cancel_related_notifications(text, uuid) to authenticated, service_role;

create or replace function dental.appointment_message_params(p_appointment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
  v_customer dental.customers%rowtype;
  v_dentist dental.profiles%rowtype;
  v_branch dental.branches%rowtype;
  v_date text;
  v_time text;
begin
  select * into v_apt from dental.appointments where id = p_appointment_id;
  if not found then
    return '{}'::jsonb;
  end if;
  select * into v_customer from dental.customers where id = v_apt.customer_id;
  select * into v_dentist from dental.profiles where user_id = v_apt.dentist_id;
  select * into v_branch from dental.branches where id = v_apt.branch_id;

  v_date := to_char(timezone('Africa/Mogadishu', v_apt.start_at), 'YYYY-MM-DD');
  v_time := to_char(timezone('Africa/Mogadishu', v_apt.start_at), 'HH24:MI');

  return jsonb_build_object(
    '1', coalesce(v_customer.name, 'Patient'),
    '2', coalesce(v_branch.name, 'N.I SMILE'),
    '3', v_date,
    '4', v_time,
    '5', coalesce(v_dentist.name, 'Dentist'),
    'patient_name', coalesce(v_customer.name, 'Patient'),
    'branch_name', coalesce(v_branch.name, 'N.I SMILE'),
    'date', v_date,
    'time', v_time,
    'dentist_name', coalesce(v_dentist.name, 'Dentist')
  );
end;
$$;

revoke all on function dental.appointment_message_params(uuid) from public;
grant execute on function dental.appointment_message_params(uuid) to authenticated, service_role;

-- Confirmation now + 24h/2h reminders when still in the future.
create or replace function dental.schedule_appointment_utilities(
  p_appointment_id uuid,
  p_include_confirmation boolean default true
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
  v_params jsonb;
  v_at_24 timestamptz;
  v_at_2 timestamptz;
begin
  select * into v_apt from dental.appointments where id = p_appointment_id;
  if not found then
    return;
  end if;
  if v_apt.status in ('cancelled', 'no_show', 'completed') then
    return;
  end if;

  v_params := dental.appointment_message_params(p_appointment_id);

  -- Reminder templates use {{1}} name {{2}} branch {{3}} date {{4}} time {{5}} dentist
  -- Confirmation uses {{1}} name {{2}} date {{3}} time {{4}} dentist — remap:
  if p_include_confirmation then
    perform dental.try_enqueue_notification(
      v_apt.branch_id,
      'appointment_confirmation',
      null,
      null,
      v_apt.customer_id,
      jsonb_build_object(
        '1', v_params->>'1',
        '2', v_params->>'3',
        '3', v_params->>'4',
        '4', v_params->>'5'
      ),
      now(),
      'appointment',
      p_appointment_id
    );
  end if;

  v_at_24 := v_apt.start_at - interval '24 hours';
  v_at_2 := v_apt.start_at - interval '2 hours';

  if v_at_24 > now() then
    perform dental.try_enqueue_notification(
      v_apt.branch_id,
      'appointment_reminder_24h',
      null,
      null,
      v_apt.customer_id,
      v_params,
      v_at_24,
      'appointment',
      p_appointment_id
    );
  end if;

  if v_at_2 > now() then
    perform dental.try_enqueue_notification(
      v_apt.branch_id,
      'appointment_reminder_2h',
      null,
      null,
      v_apt.customer_id,
      jsonb_build_object(
        '1', v_params->>'1',
        '2', v_params->>'3',
        '3', v_params->>'4',
        '4', v_params->>'5'
      ),
      v_at_2,
      'appointment',
      p_appointment_id
    );
  end if;
end;
$$;

revoke all on function dental.schedule_appointment_utilities(uuid, boolean) from public;
grant execute on function dental.schedule_appointment_utilities(uuid, boolean) to authenticated, service_role;

create or replace function dental.notify_appointment_cancelled(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
  v_params jsonb;
begin
  select * into v_apt from dental.appointments where id = p_appointment_id;
  if not found then
    return;
  end if;

  perform dental.cancel_related_notifications('appointment', p_appointment_id);

  v_params := dental.appointment_message_params(p_appointment_id);
  perform dental.try_enqueue_notification(
    v_apt.branch_id,
    'appointment_cancel',
    null,
    null,
    v_apt.customer_id,
    jsonb_build_object(
      '1', v_params->>'1',
      '2', v_params->>'3',
      '3', v_params->>'4'
    ),
    now(),
    'appointment',
    p_appointment_id
  );
end;
$$;

revoke all on function dental.notify_appointment_cancelled(uuid) from public;
grant execute on function dental.notify_appointment_cancelled(uuid) to authenticated, service_role;

-- Rebuild create_appointment with utility enqueue.
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

  perform dental.schedule_appointment_utilities(v_id, true);

  return v_id;
end;
$$;

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

  if p_status in ('cancelled', 'no_show') then
    perform dental.notify_appointment_cancelled(p_appointment_id);
  elsif p_status in ('scheduled', 'confirmed') and v_apt.status in ('cancelled', 'no_show') then
    perform dental.schedule_appointment_utilities(p_appointment_id, true);
  end if;
end;
$$;

create or replace function dental.reschedule_appointment(
  p_appointment_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
  v_end timestamptz;
  v_duration integer;
  v_params jsonb;
begin
  if p_appointment_id is null or p_start_at is null then
    raise exception 'Appointment and new start time are required';
  end if;

  select * into v_apt from dental.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if auth.uid() is not null then
    if not dental.can_manage_appointments() and not dental.is_owner() then
      raise exception 'Not allowed to reschedule appointments';
    end if;
    if not dental.is_owner() and v_apt.branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if v_apt.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Cannot reschedule a % appointment', v_apt.status;
  end if;

  v_end := p_end_at;
  if v_end is null then
    v_duration := greatest(
      15,
      round(extract(epoch from (v_apt.end_at - v_apt.start_at)) / 60.0)::integer
    );
    v_end := p_start_at + make_interval(mins => v_duration);
  end if;
  if v_end <= p_start_at then
    raise exception 'End time must be after start time';
  end if;

  perform dental.cancel_related_notifications('appointment', p_appointment_id);

  update dental.appointments
  set start_at = p_start_at, end_at = v_end, status = 'scheduled'
  where id = p_appointment_id;

  v_params := dental.appointment_message_params(p_appointment_id);
  perform dental.try_enqueue_notification(
    v_apt.branch_id,
    'appointment_reschedule',
    null,
    null,
    v_apt.customer_id,
    jsonb_build_object(
      '1', v_params->>'1',
      '2', v_params->>'3',
      '3', v_params->>'4',
      '4', v_params->>'5'
    ),
    now(),
    'appointment',
    p_appointment_id
  );

  perform dental.schedule_appointment_utilities(p_appointment_id, false);
end;
$$;

revoke all on function dental.reschedule_appointment(uuid, timestamptz, timestamptz) from public;
grant execute on function dental.reschedule_appointment(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- Sale document notice (receipt retail / invoice wholesale). PDF attachment later; English PDF.
create or replace function dental.notify_sale_document(p_sale_id uuid)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_sale dental.sales%rowtype;
  v_customer dental.customers%rowtype;
  v_kind text;
  v_doc text;
begin
  select * into v_sale from dental.sales where id = p_sale_id;
  if not found or v_sale.customer_id is null then
    return null;
  end if;
  if v_sale.status = 'void' then
    return null;
  end if;

  select * into v_customer from dental.customers where id = v_sale.customer_id;
  if not found or not v_customer.whatsapp_opt_in then
    return null;
  end if;

  if exists (
    select 1 from dental.notification_queue
    where related_type = 'sale'
      and related_id = p_sale_id
      and kind in ('receipt_notice', 'invoice_notice')
      and status in ('pending', 'processing', 'sent')
  ) then
    return null;
  end if;

  if v_sale.price_list = 'wholesale' then
    v_kind := 'invoice_notice';
    v_doc := replace(v_sale.receipt_number, 'RCP', 'INV');
  else
    v_kind := 'receipt_notice';
    v_doc := v_sale.receipt_number;
  end if;

  return dental.try_enqueue_notification(
    v_sale.branch_id,
    v_kind,
    null,
    null,
    v_sale.customer_id,
    jsonb_build_object(
      '1', v_customer.name,
      '2', v_doc,
      '3', to_char(v_sale.total, 'FM999999990.00')
    ),
    now(),
    'sale',
    p_sale_id
  );
end;
$$;

revoke all on function dental.notify_sale_document(uuid) from public;
grant execute on function dental.notify_sale_document(uuid) to authenticated, service_role;

create or replace function dental.sales_after_insert_notify()
returns trigger
language plpgsql
security definer
set search_path = dental
as $$
begin
  perform dental.notify_sale_document(new.id);
  return new;
end;
$$;

drop trigger if exists sales_after_insert_notify on dental.sales;
create trigger sales_after_insert_notify
  after insert on dental.sales
  for each row
  execute function dental.sales_after_insert_notify();
