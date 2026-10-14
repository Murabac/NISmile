-- Step 22: WhatsApp webhook handlers (delivery status, reply 1/2, opt-out).
-- Edge Function calls these with the service role. No Meta credentials stored here.

create or replace function dental.normalize_whatsapp_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(p_phone, '')), '') is null then null
    when left(regexp_replace(trim(p_phone), '[^0-9+]', '', 'g'), 1) = '+'
      then regexp_replace(trim(p_phone), '[^0-9+]', '', 'g')
    else '+' || regexp_replace(trim(p_phone), '[^0-9]', '', 'g')
  end;
$$;

revoke all on function dental.normalize_whatsapp_phone(text) from public;
grant execute on function dental.normalize_whatsapp_phone(text) to authenticated, service_role;

create index if not exists notification_log_provider_msg_idx
  on dental.notification_log (provider_message_id)
  where provider_message_id is not null;

create index if not exists notification_queue_phone_idx
  on dental.notification_queue (phone);

-- Mark a queue row as sent (worker or simulate) and attach Meta message id.
create or replace function dental.mark_notification_sent(
  p_queue_id uuid,
  p_provider_message_id text default null
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.notification_queue%rowtype;
  v_provider text := nullif(trim(coalesce(p_provider_message_id, '')), '');
begin
  select * into v_row from dental.notification_queue where id = p_queue_id for update;
  if not found then
    raise exception 'Queue item not found';
  end if;

  update dental.notification_queue
  set
    status = 'sent',
    sent_at = coalesce(sent_at, now()),
    attempts = attempts + 1,
    last_error = null
  where id = p_queue_id;

  insert into dental.notification_log (
    queue_id, branch_id, direction, phone, language, kind,
    status, body_preview, payload, provider_message_id
  )
  values (
    p_queue_id,
    v_row.branch_id,
    'outbound',
    v_row.phone,
    v_row.language,
    v_row.kind,
    'sent',
    'Marked sent',
    jsonb_build_object('source', 'mark_notification_sent'),
    v_provider
  );
end;
$$;

revoke all on function dental.mark_notification_sent(uuid, text) from public;
grant execute on function dental.mark_notification_sent(uuid, text) to authenticated, service_role;

-- Delivery / read / failed from Meta status webhooks.
create or replace function dental.apply_whatsapp_delivery_status(
  p_provider_message_id text,
  p_status text,
  p_error_message text default null,
  p_raw jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_provider text := nullif(trim(coalesce(p_provider_message_id, '')), '');
  v_status text := lower(trim(coalesce(p_status, '')));
  v_log_status dental.log_status;
  v_queue_id uuid;
  v_phone text;
  v_branch uuid;
  v_lang dental.whatsapp_language;
  v_kind text;
  v_log_id uuid;
begin
  if v_provider is null then
    raise exception 'provider_message_id is required';
  end if;

  v_log_status := case v_status
    when 'sent' then 'sent'::dental.log_status
    when 'delivered' then 'delivered'::dental.log_status
    when 'read' then 'read'::dental.log_status
    when 'failed' then 'failed'::dental.log_status
    else null
  end;

  if v_log_status is null then
    raise exception 'Unsupported delivery status %', p_status;
  end if;

  select queue_id, phone, branch_id, language, kind
  into v_queue_id, v_phone, v_branch, v_lang, v_kind
  from dental.notification_log
  where provider_message_id = v_provider
  order by created_at desc
  limit 1;

  if v_queue_id is null then
    select id, phone, branch_id, language, kind
    into v_queue_id, v_phone, v_branch, v_lang, v_kind
    from dental.notification_queue
    where id::text = v_provider
    limit 1;
  end if;

  if v_queue_id is not null then
    if v_log_status = 'failed' then
      update dental.notification_queue
      set status = 'failed', last_error = coalesce(p_error_message, last_error)
      where id = v_queue_id and status <> 'cancelled';
    elsif v_log_status in ('sent', 'delivered', 'read') then
      update dental.notification_queue
      set status = 'sent', sent_at = coalesce(sent_at, now()), last_error = null
      where id = v_queue_id and status in ('pending', 'processing', 'failed', 'sent');
    end if;
  end if;

  insert into dental.notification_log (
    queue_id, branch_id, direction, phone, language, kind,
    status, body_preview, payload, provider_message_id, error_message
  )
  values (
    v_queue_id,
    v_branch,
    'outbound',
    coalesce(v_phone, 'unknown'),
    v_lang,
    v_kind,
    v_log_status,
    'Delivery status: ' || v_status,
    coalesce(p_raw, '{}'::jsonb),
    v_provider,
    p_error_message
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

revoke all on function dental.apply_whatsapp_delivery_status(text, text, text, jsonb) from public;
grant execute on function dental.apply_whatsapp_delivery_status(text, text, text, jsonb) to service_role;

-- Inbound: "1" confirm, "2" cancel latest open appointment; STOP / etc → opt-out.
create or replace function dental.apply_whatsapp_inbound(
  p_phone text,
  p_body text,
  p_provider_message_id text default null,
  p_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_phone text := dental.normalize_whatsapp_phone(p_phone);
  v_body text := lower(trim(coalesce(p_body, '')));
  v_digits text;
  v_customer dental.customers%rowtype;
  v_queue dental.notification_queue%rowtype;
  v_apt dental.appointments%rowtype;
  v_action text := 'ignored';
  v_log_id uuid;
  v_provider text := nullif(trim(coalesce(p_provider_message_id, '')), '');
begin
  if v_phone is null then
    raise exception 'Phone is required';
  end if;

  -- Strip to leading digit for 1/2 detection.
  v_digits := regexp_replace(v_body, '[^0-9]', '', 'g');

  select * into v_customer
  from dental.customers
  where dental.normalize_whatsapp_phone(phone) = v_phone
  order by created_at desc
  limit 1;

  insert into dental.notification_log (
    queue_id, branch_id, direction, phone, language, kind,
    status, body_preview, payload, provider_message_id
  )
  values (
    null,
    v_customer.branch_id,
    'inbound',
    v_phone,
    v_customer.language,
    'inbound_reply',
    'replied',
    left(coalesce(p_body, ''), 180),
    coalesce(p_raw, '{}'::jsonb) || jsonb_build_object('body', p_body),
    v_provider
  )
  returning id into v_log_id;

  -- Opt-out keywords (EN/SO/AR common forms). Staff UI stays English.
  if v_body ~ '(stop|unsubscribe|opt[ -]?out|jooji|iska\s*diiwaangelin|الغاء|إلغاء|توقف|وقف)'
     or v_body in ('0', 'stop', 'توقف')
  then
    if v_customer.id is not null then
      update dental.customers
      set whatsapp_opt_in = false
      where id = v_customer.id;

      update dental.notification_queue
      set status = 'cancelled'
      where customer_id = v_customer.id
        and status in ('pending', 'failed');
    end if;
    v_action := 'opt_out';
    return jsonb_build_object(
      'action', v_action,
      'log_id', v_log_id,
      'customer_id', v_customer.id
    );
  end if;

  -- Find latest appointment-related outbound for this phone.
  select q.* into v_queue
  from dental.notification_queue q
  where dental.normalize_whatsapp_phone(q.phone) = v_phone
    and q.related_type = 'appointment'
    and q.related_id is not null
    and q.kind in (
      'appointment_confirmation',
      'appointment_reminder_24h',
      'appointment_reminder_2h',
      'appointment_reschedule'
    )
    and q.status in ('sent', 'pending', 'processing')
  order by q.scheduled_at desc, q.created_at desc
  limit 1;

  if v_queue.id is not null then
    select * into v_apt
    from dental.appointments
    where id = v_queue.related_id
    for update;
  end if;

  if v_apt.id is not null and v_apt.status in ('scheduled', 'confirmed') then
    if v_digits = '1' or v_body in ('1', 'xaqiiji', 'تأكيد', 'تاكيد', 'confirm') then
      update dental.appointments
      set status = 'confirmed'
      where id = v_apt.id
        and status = 'scheduled';
      v_action := 'confirm';
    elsif v_digits = '2' or v_body in ('2', 'jooji', 'إلغاء', 'الغاء', 'cancel') then
      -- Silent cancel: no outbound cancel notice (patient already replied).
      perform dental.cancel_related_notifications('appointment', v_apt.id);
      update dental.appointments
      set status = 'cancelled'
      where id = v_apt.id;
      v_action := 'cancel';
    end if;
  end if;

  update dental.notification_log
  set payload = payload || jsonb_build_object(
    'action', v_action,
    'appointment_id', v_apt.id,
    'queue_id', v_queue.id
  )
  where id = v_log_id;

  return jsonb_build_object(
    'action', v_action,
    'log_id', v_log_id,
    'customer_id', v_customer.id,
    'appointment_id', v_apt.id,
    'queue_id', v_queue.id
  );
end;
$$;

revoke all on function dental.apply_whatsapp_inbound(text, text, text, jsonb) from public;
grant execute on function dental.apply_whatsapp_inbound(text, text, text, jsonb) to service_role;

-- Staff/demo helper: simulate Meta inbound without Cloud API credentials.
create or replace function dental.simulate_whatsapp_inbound(
  p_phone text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = dental
as $$
begin
  if auth.uid() is not null then
    if not dental.can_manage_notifications() and not dental.is_owner() then
      raise exception 'Not allowed to simulate inbound WhatsApp';
    end if;
  end if;

  return dental.apply_whatsapp_inbound(
    p_phone,
    p_body,
    'sim-' || gen_random_uuid()::text,
    jsonb_build_object('source', 'simulate')
  );
end;
$$;

revoke all on function dental.simulate_whatsapp_inbound(text, text) from public;
grant execute on function dental.simulate_whatsapp_inbound(text, text) to authenticated, service_role;

-- Staff/demo: mark latest pending queue row sent + apply delivered status.
create or replace function dental.simulate_whatsapp_delivery(
  p_queue_id uuid,
  p_status text default 'delivered'
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_provider text := 'sim-' || p_queue_id::text;
begin
  if auth.uid() is not null then
    if not dental.can_manage_notifications() and not dental.is_owner() then
      raise exception 'Not allowed to simulate delivery';
    end if;
  end if;

  perform dental.mark_notification_sent(p_queue_id, v_provider);
  return dental.apply_whatsapp_delivery_status(
    v_provider,
    p_status,
    null,
    jsonb_build_object('source', 'simulate')
  );
end;
$$;

revoke all on function dental.simulate_whatsapp_delivery(uuid, text) from public;
grant execute on function dental.simulate_whatsapp_delivery(uuid, text) to authenticated, service_role;
