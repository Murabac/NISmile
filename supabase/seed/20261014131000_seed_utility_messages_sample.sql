-- Step 21 sample: schedule utilities for the seeded appointment (if opted-in).
-- Safe to re-run.

do $$
declare
  v_apt_id uuid;
begin
  if exists (
    select 1
    from dental.notification_queue
    where params->>'seed' = 'SEED-UTILITY-CONFIRM'
  ) then
    return;
  end if;

  select id into v_apt_id
  from dental.appointments
  where notes = 'SEED-APPOINTMENT'
    and status in ('scheduled', 'confirmed')
  order by start_at
  limit 1;

  if v_apt_id is null then
    return;
  end if;

  -- Cancel any prior pending appointment queue for this id, then schedule fresh.
  perform dental.cancel_related_notifications('appointment', v_apt_id);
  perform dental.schedule_appointment_utilities(v_apt_id, true);

  -- Mark one queued row so re-runs skip (schedule may create 1–3 rows).
  update dental.notification_queue
  set params = coalesce(params, '{}'::jsonb) || jsonb_build_object('seed', 'SEED-UTILITY-CONFIRM')
  where id = (
    select id
    from dental.notification_queue
    where related_type = 'appointment'
      and related_id = v_apt_id
      and kind = 'appointment_confirmation'
      and status = 'pending'
    order by created_at desc
    limit 1
  );
end;
$$;
