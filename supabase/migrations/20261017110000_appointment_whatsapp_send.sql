-- Step 34: one-click appointment WhatsApp (confirmation / reminder now).

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

  if v_kind = 'appointment_reminder_24h' then
    v_params := v_params_full;
  elsif v_kind = 'appointment_confirmation' then
    v_params := jsonb_build_object(
      '1', v_params_full->>'1',
      '2', v_params_full->>'3',
      '3', v_params_full->>'4',
      '4', v_params_full->>'5'
    );
  else
    -- appointment_reminder_2h
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

revoke all on function dental.notify_appointment_whatsapp(uuid, text) from public;
grant execute on function dental.notify_appointment_whatsapp(uuid, text) to authenticated, service_role;

-- Cancel notice: return queue id for optional one-click send after cancel.
drop function if exists dental.notify_appointment_cancelled(uuid);

create or replace function dental.notify_appointment_cancelled(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
  v_params jsonb;
  v_existing uuid;
begin
  select * into v_apt from dental.appointments where id = p_appointment_id;
  if not found then
    return null;
  end if;

  perform dental.cancel_related_notifications('appointment', p_appointment_id);

  v_params := dental.appointment_message_params(p_appointment_id);

  select id into v_existing
  from dental.notification_queue
  where related_type = 'appointment'
    and related_id = p_appointment_id
    and kind = 'appointment_cancel'
    and status in ('pending', 'processing')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    update dental.notification_queue
    set params = jsonb_build_object(
          '1', v_params->>'1',
          '2', v_params->>'3',
          '3', v_params->>'4'
        ),
        scheduled_at = now()
    where id = v_existing;
    return v_existing;
  end if;

  return dental.try_enqueue_notification(
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
