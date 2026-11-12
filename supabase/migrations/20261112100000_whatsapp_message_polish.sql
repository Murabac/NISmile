-- Step 39: WhatsApp message polish.
--  * Friendly dates/times (Friday, 13 November / 12:00 PM), first names, real dentist name.
--  * Reminder wording follows the real time left; 2h reminder skipped once the patient confirms.
--  * Every template body gets one layout and the same contact line.
-- Does not change whatsapp_template_id / status. Meta v2 templates are switched on in
-- WhatsApp -> Templates once approved (see docs/WhatsApp-Templates-v2.md).

alter table dental.profiles add column if not exists display_name text;

-- ---------------------------------------------------------------------------
-- Formatting helpers
-- ---------------------------------------------------------------------------

-- "AYAAN ABDI" -> "Ayaan". Skips titles, strips digits/punctuation, falls back to "there".
create or replace function dental.whatsapp_first_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_parts text[];
  v_token text;
  v_i integer;
begin
  v_parts := regexp_split_to_array(trim(coalesce(p_name, '')), '\s+');
  for v_i in 1 .. coalesce(array_length(v_parts, 1), 0) loop
    v_token := translate(v_parts[v_i], '0123456789()[]{}<>@#$%^&*+=|~/\_.,;:!?"`', '');
    v_token := btrim(v_token, '-''');
    if v_token = '' then
      continue;
    end if;
    if lower(v_token) in ('dr', 'mr', 'mrs', 'ms', 'miss', 'eng', 'prof') then
      continue;
    end if;
    return initcap(lower(v_token));
  end loop;
  return 'there';
end;
$$;

-- "Friday, 13 November" (clinic time, Africa/Mogadishu)
create or replace function dental.whatsapp_date_label(p_ts timestamptz)
returns text
language sql
stable
as $$
  select to_char(timezone('Africa/Mogadishu', p_ts), 'FMDay, FMDD FMMonth')
$$;

-- "12:00 PM" / "1:30 PM"
create or replace function dental.whatsapp_time_label(p_ts timestamptz)
returns text
language sql
stable
as $$
  select to_char(timezone('Africa/Mogadishu', p_ts), 'FMHH12:MI AM')
$$;

-- "1 December 2026" (due dates)
create or replace function dental.whatsapp_day_label(p_date date)
returns text
language sql
immutable
as $$
  select case when p_date is null then null else to_char(p_date, 'FMDD FMMonth YYYY') end
$$;

-- Wording that matches reality at send time:
-- "in less than an hour" / "in about 2 hours" / "today" / "tomorrow" / "in 3 days"
create or replace function dental.appointment_when_label(
  p_start timestamptz,
  p_at timestamptz default now()
)
returns text
language plpgsql
stable
as $$
declare
  v_mins integer := floor(extract(epoch from (p_start - p_at)) / 60);
  v_days integer :=
    (timezone('Africa/Mogadishu', p_start))::date - (timezone('Africa/Mogadishu', p_at))::date;
  v_hours integer;
begin
  if v_mins <= 0 then
    return 'starting now';
  end if;
  if v_mins < 60 then
    return 'in less than an hour';
  end if;
  if v_mins < 360 then
    v_hours := round(v_mins / 60.0);
    return case
      when v_hours <= 1 then 'in about 1 hour'
      else format('in about %s hours', v_hours)
    end;
  end if;
  if v_days <= 0 then
    return 'today';
  end if;
  if v_days = 1 then
    return 'tomorrow';
  end if;
  return format('in %s days', v_days);
end;
$$;

-- Dentist line: display name if set, else a dentist's own name, else "Our dental team".
create or replace function dental.whatsapp_dentist_label(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_p dental.profiles%rowtype;
begin
  select * into v_p from dental.profiles where user_id = p_user_id;
  if not found then
    return 'Our dental team';
  end if;
  if nullif(trim(coalesce(v_p.display_name, '')), '') is not null then
    return trim(v_p.display_name);
  end if;
  if v_p.role = 'dentist' and nullif(trim(coalesce(v_p.name, '')), '') is not null then
    return trim(v_p.name);
  end if;
  return 'Our dental team';
end;
$$;

revoke all on function dental.whatsapp_first_name(text) from public;
revoke all on function dental.whatsapp_date_label(timestamptz) from public;
revoke all on function dental.whatsapp_time_label(timestamptz) from public;
revoke all on function dental.whatsapp_day_label(date) from public;
revoke all on function dental.appointment_when_label(timestamptz, timestamptz) from public;
revoke all on function dental.whatsapp_dentist_label(uuid) from public;
grant execute on function dental.whatsapp_first_name(text) to authenticated, service_role;
grant execute on function dental.whatsapp_date_label(timestamptz) to authenticated, service_role;
grant execute on function dental.whatsapp_time_label(timestamptz) to authenticated, service_role;
grant execute on function dental.whatsapp_day_label(date) to authenticated, service_role;
grant execute on function dental.appointment_when_label(timestamptz, timestamptz) to authenticated, service_role;
grant execute on function dental.whatsapp_dentist_label(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Appointment params: same keys as before ('1' name, '2' branch, '3' date, '4' time,
-- '5' dentist), friendlier values. Reschedule / cancel / reply-ack builders read these.
-- ---------------------------------------------------------------------------

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
  v_branch dental.branches%rowtype;
  v_first text;
  v_branch_name text;
  v_date text;
  v_time text;
  v_dentist text;
begin
  select * into v_apt from dental.appointments where id = p_appointment_id;
  if not found then
    return '{}'::jsonb;
  end if;
  select * into v_customer from dental.customers where id = v_apt.customer_id;
  select * into v_branch from dental.branches where id = v_apt.branch_id;

  v_first := dental.whatsapp_first_name(v_customer.name);
  v_branch_name := coalesce(v_branch.name, 'N.I SMILE');
  v_date := dental.whatsapp_date_label(v_apt.start_at);
  v_time := dental.whatsapp_time_label(v_apt.start_at);
  v_dentist := dental.whatsapp_dentist_label(v_apt.dentist_id);

  return jsonb_build_object(
    '1', v_first,
    '2', v_branch_name,
    '3', v_date,
    '4', v_time,
    '5', v_dentist,
    'patient_name', v_first,
    'branch_name', v_branch_name,
    'date', v_date,
    'time', v_time,
    'dentist_name', v_dentist
  );
end;
$$;

-- Time-aware reminder: '1' name, '2' when ("tomorrow", "in about 2 hours"), '3' date,
-- '4' time, '5' dentist. p_at is the moment the message is (or will be) sent.
create or replace function dental.appointment_reminder_params(
  p_appointment_id uuid,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
  v_full jsonb;
begin
  select * into v_apt from dental.appointments where id = p_appointment_id;
  if not found then
    return '{}'::jsonb;
  end if;
  v_full := dental.appointment_message_params(p_appointment_id);
  return jsonb_build_object(
    '1', v_full->>'1',
    '2', dental.appointment_when_label(v_apt.start_at, p_at),
    '3', v_full->>'3',
    '4', v_full->>'4',
    '5', v_full->>'5'
  );
end;
$$;

revoke all on function dental.appointment_reminder_params(uuid, timestamptz) from public;
grant execute on function dental.appointment_reminder_params(uuid, timestamptz) to authenticated, service_role;

-- Booking: confirmation now, 24h reminder, 2h reminder (skipped when too late or confirmed).
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

  -- Confirmation / 2h / reschedule use {{1}} name {{2}} date {{3}} time {{4}} dentist.
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

  -- Reminder template: {{1}} name {{2}} when {{3}} date {{4}} time {{5}} dentist.
  if v_at_24 > now() then
    perform dental.try_enqueue_notification(
      v_apt.branch_id,
      'appointment_reminder_24h',
      null,
      null,
      v_apt.customer_id,
      dental.appointment_reminder_params(p_appointment_id, v_at_24),
      v_at_24,
      'appointment',
      p_appointment_id
    );
  end if;

  -- No 2h reminder when the visit is less than 2h away, or the patient already confirmed.
  if v_at_2 > now() and v_apt.status <> 'confirmed' then
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

-- One-click send. Reminder buttons pick the template by the real time left, so the
-- wording is never wrong ("in about 2 hours" only when it is about 2 hours).
create or replace function dental.notify_appointment_whatsapp(
  p_appointment_id uuid,
  p_kind text default 'appointment_confirmation'
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
  v_kind text := trim(p_kind);
  v_params_full jsonb;
  v_params jsonb;
  v_existing uuid;
  v_mins integer;
begin
  if v_kind not in (
    'appointment_confirmation',
    'appointment_reminder_24h',
    'appointment_reminder_2h'
  ) then
    raise exception 'Unsupported appointment WhatsApp kind: %', v_kind;
  end if;

  select * into v_apt from dental.appointments where id = p_appointment_id;
  if not found then
    return null;
  end if;
  if v_apt.status in ('cancelled', 'no_show', 'completed') then
    return null;
  end if;
  if v_apt.customer_id is null then
    return null;
  end if;

  v_params_full := dental.appointment_message_params(p_appointment_id);

  if v_kind in ('appointment_reminder_24h', 'appointment_reminder_2h') then
    v_mins := floor(extract(epoch from (v_apt.start_at - now())) / 60);
    if v_mins between 90 and 150 then
      v_kind := 'appointment_reminder_2h';
      v_params := jsonb_build_object(
        '1', v_params_full->>'1',
        '2', v_params_full->>'3',
        '3', v_params_full->>'4',
        '4', v_params_full->>'5'
      );
    else
      v_kind := 'appointment_reminder_24h';
      v_params := dental.appointment_reminder_params(p_appointment_id, now());
    end if;
  else
    v_params := jsonb_build_object(
      '1', v_params_full->>'1',
      '2', v_params_full->>'3',
      '3', v_params_full->>'4',
      '4', v_params_full->>'5'
    );
  end if;

  -- Reuse pending/processing row for this appointment + kind; send immediately.
  select id into v_existing
  from dental.notification_queue
  where related_type = 'appointment'
    and related_id = p_appointment_id
    and kind = v_kind
    and status in ('pending', 'processing')
  order by created_at desc
  limit 1;

  if v_existing is not null then
    update dental.notification_queue
    set params = v_params,
        scheduled_at = now()
    where id = v_existing;
    return v_existing;
  end if;

  -- Avoid duplicate same-day sent for the same kind.
  if exists (
    select 1 from dental.notification_queue
    where related_type = 'appointment'
      and related_id = p_appointment_id
      and kind = v_kind
      and status = 'sent'
      and sent_at >= date_trunc('day', now())
  ) then
    return null;
  end if;

  return dental.try_enqueue_notification(
    v_apt.branch_id,
    v_kind,
    null,
    null,
    v_apt.customer_id,
    v_params,
    now(),
    'appointment',
    p_appointment_id
  );
end;
$$;

-- Patient confirmed (reply 1 or staff): drop the pending 2h reminder.
create or replace function dental.appointments_skip_2h_when_confirmed()
returns trigger
language plpgsql
security definer
set search_path = dental
as $$
begin
  if new.status = 'confirmed' and old.status is distinct from new.status then
    update dental.notification_queue
    set status = 'cancelled',
        last_error = coalesce(last_error, 'Skipped: patient already confirmed')
    where related_type = 'appointment'
      and related_id = new.id
      and kind = 'appointment_reminder_2h'
      and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_skip_2h_when_confirmed on dental.appointments;
create trigger appointments_skip_2h_when_confirmed
  after update of status on dental.appointments
  for each row
  execute function dental.appointments_skip_2h_when_confirmed();

-- Receipt / invoice notice: first name, friendly due date.
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
  v_existing uuid;
  v_open_balance numeric(12, 2);
  v_due_label text;
  v_params jsonb;
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

  v_open_balance := dental.customer_ar_balance(v_sale.customer_id);
  if v_open_balance <= 0 or v_sale.due_date is null then
    v_due_label := 'N/A';
  else
    v_due_label := dental.whatsapp_day_label(v_sale.due_date);
  end if;

  if v_sale.price_list = 'wholesale' then
    v_kind := 'invoice_notice';
    v_doc := replace(v_sale.receipt_number, 'RCP', 'INV');
  else
    v_kind := 'receipt_notice';
    v_doc := v_sale.receipt_number;
  end if;

  v_params := jsonb_build_object(
    '1', dental.whatsapp_first_name(v_customer.name),
    '2', v_doc,
    '3', to_char(v_sale.total, 'FM999999990.00'),
    '4', to_char(coalesce(v_sale.paid_total, 0), 'FM999999990.00'),
    '5', to_char(v_open_balance, 'FM999999990.00'),
    '6', v_due_label
  );

  -- Reuse open queue row; refresh params so paid/balance/due stay current.
  select id into v_existing
  from dental.notification_queue
  where related_type = 'sale'
    and related_id = p_sale_id
    and kind in ('receipt_notice', 'invoice_notice')
    and status in ('pending', 'processing')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    update dental.notification_queue
    set params = v_params
    where id = v_existing;
    return v_existing;
  end if;

  if exists (
    select 1 from dental.notification_queue
    where related_type = 'sale'
      and related_id = p_sale_id
      and kind in ('receipt_notice', 'invoice_notice')
      and status = 'sent'
  ) then
    return null;
  end if;

  return dental.try_enqueue_notification(
    v_sale.branch_id,
    v_kind,
    null,
    null,
    v_sale.customer_id,
    v_params,
    now(),
    'sale',
    p_sale_id
  );
end;
$$;

-- Payment due reminder: first name, friendly due date.
create or replace function dental.notify_ar_payment_reminder(
  p_customer_id uuid,
  p_sale_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_customer dental.customers%rowtype;
  v_sale dental.sales%rowtype;
  v_open numeric(12, 2);
  v_due_label text;
  v_params jsonb;
  v_existing uuid;
  v_related_id uuid;
begin
  if p_customer_id is null then
    return null;
  end if;

  select * into v_customer from dental.customers where id = p_customer_id;
  if not found or not v_customer.whatsapp_opt_in then
    return null;
  end if;
  if nullif(trim(coalesce(v_customer.phone, '')), '') is null then
    return null;
  end if;

  if p_sale_id is not null then
    select * into v_sale from dental.sales where id = p_sale_id;
    if not found
       or v_sale.customer_id is distinct from p_customer_id
       or v_sale.status <> 'partial' then
      return null;
    end if;
    v_open := greatest(coalesce(v_sale.total, 0) - coalesce(v_sale.paid_total, 0), 0)::numeric(12, 2);
    if v_open <= 0 then
      return null;
    end if;
    v_due_label := case
      when v_sale.due_date is null then 'N/A'
      else dental.whatsapp_day_label(v_sale.due_date)
    end;
    v_related_id := v_sale.id;
  else
    v_open := dental.customer_ar_balance(p_customer_id);
    if v_open <= 0 then
      return null;
    end if;
    select dental.whatsapp_day_label(min(due_date))
    into v_due_label
    from dental.sales
    where customer_id = p_customer_id
      and status = 'partial'
      and due_date is not null;
    v_due_label := coalesce(v_due_label, 'N/A');
    v_related_id := p_customer_id;
  end if;

  v_params := jsonb_build_object(
    '1', dental.whatsapp_first_name(v_customer.name),
    '2', to_char(v_open, 'FM999999990.00'),
    '3', v_due_label
  );

  -- Reuse pending/processing reminder for same related target (customer or sale).
  select id into v_existing
  from dental.notification_queue
  where kind = 'payment_due_reminder'
    and related_type = case when p_sale_id is null then 'customer' else 'sale' end
    and related_id = v_related_id
    and status in ('pending', 'processing')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    update dental.notification_queue
    set params = v_params,
        phone = v_customer.phone,
        scheduled_at = now()
    where id = v_existing;
    return v_existing;
  end if;

  -- Avoid duplicate same-day sent reminder for the same target.
  if exists (
    select 1 from dental.notification_queue
    where kind = 'payment_due_reminder'
      and related_type = case when p_sale_id is null then 'customer' else 'sale' end
      and related_id = v_related_id
      and status = 'sent'
      and sent_at >= date_trunc('day', now())
  ) then
    return null;
  end if;

  return dental.try_enqueue_notification(
    v_customer.branch_id,
    'payment_due_reminder',
    v_customer.phone,
    'en',
    p_customer_id,
    v_params,
    now(),
    case when p_sale_id is null then 'customer' else 'sale' end,
    v_related_id
  );
end;
$$;

-- Claim: 24h reminder wording ("tomorrow", "today", ...) is worked out when the
-- message is actually sent, so a late send never says the wrong day.
create or replace function dental.claim_due_notifications(
  p_limit integer default 10,
  p_queue_id uuid default null
)
returns table (
  queue_id uuid,
  branch_id uuid,
  phone text,
  language dental.whatsapp_language,
  kind text,
  params jsonb,
  body_text text,
  whatsapp_template_id text,
  template_status dental.template_approval_status,
  template_name text,
  related_type text,
  related_id uuid
)
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  return query
  with picked as (
    select q.id
    from dental.notification_queue q
    where (
        p_queue_id is not null
        and q.id = p_queue_id
        and q.status in ('pending', 'failed', 'processing')
      )
      or (
        p_queue_id is null
        and q.status in ('pending', 'failed')
        and q.scheduled_at <= now()
        and q.attempts < 5
      )
    order by q.scheduled_at asc
    limit v_limit
    for update of q skip locked
  ),
  claimed as (
    update dental.notification_queue q
    set status = 'processing',
        params = case
          when q.kind = 'appointment_reminder_24h'
            and q.related_type = 'appointment'
            and q.related_id is not null
          then coalesce(
            nullif(dental.appointment_reminder_params(q.related_id, now()), '{}'::jsonb),
            q.params
          )
          else q.params
        end
    from picked
    where q.id = picked.id
    returning q.*
  )
  select
    c.id,
    c.branch_id,
    c.phone,
    c.language,
    c.kind,
    c.params,
    t.body_text,
    t.whatsapp_template_id,
    t.status,
    t.name,
    c.related_type,
    c.related_id
  from claimed c
  join dental.message_templates t on t.id = c.template_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Template bodies: one layout, friendly dates, bold labels, same contact line.
-- Text here is the free-form wording AND the preview in WhatsApp -> Templates.
-- It must match the Meta v2 templates word for word (docs/WhatsApp-Templates-v2.md).
-- whatsapp_template_id / status are NOT touched here.
-- ---------------------------------------------------------------------------

update dental.message_templates t
set
  body_text = v.body_text,
  variables = v.variables::jsonb,
  updated_at = now()
from (
  values
  (
    'appointment_confirmation',
    E'Hello {{1}},\n\nYour appointment at N.I SMILE is booked.\n\n*Date:* {{2}}\n*Time:* {{3}}\n*Dentist:* {{4}}\n\nReply *1* to confirm or *2* to cancel.\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["patient_name","date","time","dentist_name"]'
  ),
  (
    'appointment_reminder_24h',
    E'Hello {{1}},\n\nReminder: your appointment at N.I SMILE is {{2}}.\n\n*Date:* {{3}}\n*Time:* {{4}}\n*Dentist:* {{5}}\n\nReply *1* to confirm or *2* to cancel.\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["patient_name","when","date","time","dentist_name"]'
  ),
  (
    'appointment_reminder_2h',
    E'Hello {{1}},\n\nYour appointment at N.I SMILE is in about 2 hours.\n\n*Date:* {{2}}\n*Time:* {{3}}\n*Dentist:* {{4}}\n\nReply *1* to confirm or *2* to cancel.\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["patient_name","date","time","dentist_name"]'
  ),
  (
    'appointment_reschedule',
    E'Hello {{1}},\n\nYour appointment at N.I SMILE has been rescheduled.\n\n*New date:* {{2}}\n*New time:* {{3}}\n*Dentist:* {{4}}\n\nReply *1* to confirm or *2* to cancel.\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["patient_name","date","time","dentist_name"]'
  ),
  (
    'appointment_cancel',
    E'Hello {{1}},\n\nYour appointment at N.I SMILE on {{2}} at {{3}} has been cancelled. We can book a new time for you.\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["patient_name","date","time"]'
  ),
  (
    'appointment_reply_confirmed',
    E'Thank you {{1}}! Your appointment is confirmed.\n\n*Date:* {{2}}\n*Time:* {{3}}\n\nWe look forward to seeing you at N.I SMILE.\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["patient_name","date","time"]'
  ),
  (
    'appointment_reply_cancelled',
    E'Thank you {{1}}. Your appointment on {{2}} at {{3}} has been cancelled.\n\nTo book a new time, just message us.\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["patient_name","date","time"]'
  ),
  (
    'receipt_notice',
    E'Hello {{1}},\n\nThank you for choosing N.I SMILE. Here is your receipt summary.\n\n*Receipt:* #{{2}}\n*Total:* ${{3}}\n*Paid:* ${{4}}\n*Open balance:* ${{5}}\n*Due date:* {{6}}\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["customer_name","receipt_number","amount_total","amount_paid","open_balance","due_date"]'
  ),
  (
    'invoice_notice',
    E'Hello {{1}},\n\nThank you for choosing N.I SMILE. Here is your invoice summary.\n\n*Invoice:* #{{2}}\n*Total:* ${{3}}\n*Paid:* ${{4}}\n*Open balance:* ${{5}}\n*Due date:* {{6}}\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["customer_name","invoice_number","amount_total","amount_paid","open_balance","due_date"]'
  ),
  (
    'payment_due_reminder',
    E'Hello {{1}},\n\nThis is a payment reminder from N.I SMILE.\n\n*Open balance:* ${{2}}\n*Due date:* {{3}}\n\nPlease pay it on time.\n\nFor further instructions or questions, contact us: https://wa.me/252634548732',
    '["customer_name","open_balance","due_date"]'
  ),
  (
    'promotion_announcement',
    E'Hello,\n\n{{1}}\n\nFor further instructions or questions, contact us: https://wa.me/252634548732\n\nReply STOP to opt out.',
    '["1"]'
  ),
  (
    'promotion_ending_soon',
    E'Hello,\n\nEnding soon: {{1}}\n\nFor further instructions or questions, contact us: https://wa.me/252634548732\n\nReply STOP to opt out.',
    '["1"]'
  )
) as v(kind, body_text, variables)
where t.kind = v.kind
  and t.language = 'en';

-- ---------------------------------------------------------------------------
-- Staff display name (shown to patients as the Dentist line)
-- ---------------------------------------------------------------------------

drop function if exists dental.list_staff_users();

create function dental.list_staff_users()
returns table (
  user_id uuid,
  email text,
  name text,
  display_name text,
  role dental.staff_role,
  branch_ids uuid[],
  banned boolean
)
language plpgsql
security definer
set search_path = dental, auth
as $$
begin
  if not dental.is_owner() then
    raise exception 'Owner only';
  end if;

  return query
  select
    p.user_id,
    u.email::text,
    p.name,
    p.display_name,
    p.role,
    coalesce(
      (select array_agg(ub.branch_id order by ub.branch_id)
       from dental.user_branches ub
       where ub.user_id = p.user_id),
      '{}'::uuid[]
    ) as branch_ids,
    (u.banned_until is not null and u.banned_until > now()) as banned
  from dental.profiles p
  join auth.users u on u.id = p.user_id
  order by p.name;
end;
$$;

revoke all on function dental.list_staff_users() from public;
grant execute on function dental.list_staff_users() to authenticated, service_role;

create or replace function dental.set_staff_display_name(
  p_user_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
begin
  if not dental.is_owner() then
    raise exception 'Owner only';
  end if;
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  update dental.profiles
  set display_name = nullif(left(trim(coalesce(p_display_name, '')), 60), '')
  where user_id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function dental.set_staff_display_name(uuid, text) from public;
grant execute on function dental.set_staff_display_name(uuid, text) to authenticated, service_role;
