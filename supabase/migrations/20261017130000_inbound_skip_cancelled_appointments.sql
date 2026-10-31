-- Match inbound 1/2 to an active appointment only (skip cancelled/completed).

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
  v_params jsonb;
  v_ack_kind text;
  v_ack_queue_id uuid;
begin
  if v_phone is null then
    raise exception 'Phone is required';
  end if;

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

  select q.* into v_queue
  from dental.notification_queue q
  join dental.appointments a on a.id = q.related_id
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
    and a.status in ('scheduled', 'confirmed')
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
      v_ack_kind := 'appointment_reply_confirmed';
    elsif v_digits = '2' or v_body in ('2', 'jooji', 'إلغاء', 'الغاء', 'cancel') then
      perform dental.cancel_related_notifications('appointment', v_apt.id);
      update dental.appointments
      set status = 'cancelled'
      where id = v_apt.id;
      v_action := 'cancel';
      v_ack_kind := 'appointment_reply_cancelled';
    end if;
  end if;

  if v_ack_kind is not null and v_customer.id is not null and v_customer.whatsapp_opt_in then
    v_params := dental.appointment_message_params(v_apt.id);
    v_ack_queue_id := dental.try_enqueue_notification(
      v_apt.branch_id,
      v_ack_kind,
      v_phone,
      'en',
      v_customer.id,
      jsonb_build_object(
        '1', v_params->>'1',
        '2', v_params->>'3',
        '3', v_params->>'4'
      ),
      now(),
      'appointment',
      v_apt.id
    );
  end if;

  update dental.notification_log
  set payload = payload || jsonb_build_object(
    'action', v_action,
    'appointment_id', v_apt.id,
    'queue_id', v_queue.id,
    'ack_queue_id', v_ack_queue_id
  )
  where id = v_log_id;

  return jsonb_build_object(
    'action', v_action,
    'log_id', v_log_id,
    'customer_id', v_customer.id,
    'appointment_id', v_apt.id,
    'queue_id', v_queue.id,
    'ack_queue_id', v_ack_queue_id
  );
end;
$$;

revoke all on function dental.apply_whatsapp_inbound(text, text, text, jsonb) from public;
grant execute on function dental.apply_whatsapp_inbound(text, text, text, jsonb) to service_role;
