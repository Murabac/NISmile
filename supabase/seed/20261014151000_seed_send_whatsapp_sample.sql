-- Make one pending queue row due now for Cloud API send testing (test number).
-- Recipient must be allowlisted on the Meta test number. Safe to re-run.

do $$
declare
  v_id uuid;
begin
  select q.id
  into v_id
  from dental.notification_queue q
  where q.status in ('pending', 'failed')
  order by q.created_at desc
  limit 1;

  if v_id is null then
    raise notice 'No pending queue row to schedule for send test';
    return;
  end if;

  update dental.notification_queue
  set
    scheduled_at = now(),
    status = 'pending',
    last_error = null
  where id = v_id;

  raise notice 'Queue % scheduled for immediate send test', v_id;
end;
$$;
