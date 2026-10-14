-- Step 22 sample: mark a queued reminder as delivered, then simulate reply "1" (confirm).
-- Safe to re-run.

do $$
declare
  v_queue_id uuid;
  v_phone text;
  v_provider text;
  v_apt_id uuid;
begin
  if exists (
    select 1
    from dental.notification_log
    where payload->>'seed' = 'SEED-WEBHOOK-REPLY'
  ) then
    return;
  end if;

  select q.id, q.phone, q.related_id
  into v_queue_id, v_phone, v_apt_id
  from dental.notification_queue q
  where q.related_type = 'appointment'
    and q.kind in ('appointment_confirmation', 'appointment_reminder_24h')
    and q.status in ('pending', 'sent')
  order by q.created_at desc
  limit 1;

  if v_queue_id is null or v_phone is null then
    return;
  end if;

  v_provider := 'seed-wamid-' || left(v_queue_id::text, 8);

  if exists (
    select 1 from dental.notification_queue where id = v_queue_id and status = 'pending'
  ) then
    perform dental.mark_notification_sent(v_queue_id, v_provider);
  end if;

  perform dental.apply_whatsapp_delivery_status(
    v_provider,
    'delivered',
    null,
    jsonb_build_object('seed', 'SEED-WEBHOOK-DELIVERED')
  );

  perform dental.apply_whatsapp_inbound(
    v_phone,
    '1',
    'seed-inbound-' || left(v_queue_id::text, 8),
    jsonb_build_object('seed', 'SEED-WEBHOOK-REPLY')
  );
end;
$$;
