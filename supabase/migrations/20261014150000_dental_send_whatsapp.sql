-- Claim / fail helpers for the send-whatsapp Edge Function (test number now; production later).
-- Meta tokens stay in Edge secrets — never in this schema.

-- Replace 2-arg signature from step 22 with 4-arg (defaults keep old call sites working).
drop function if exists dental.mark_notification_sent(uuid, text);

create or replace function dental.mark_notification_sent(
  p_queue_id uuid,
  p_provider_message_id text default null,
  p_body_preview text default null,
  p_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.notification_queue%rowtype;
  v_provider text := nullif(trim(coalesce(p_provider_message_id, '')), '');
  v_preview text := nullif(trim(coalesce(p_body_preview, '')), '');
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
    coalesce(v_preview, 'Sent via WhatsApp Cloud API'),
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('source', 'mark_notification_sent'),
    v_provider
  );
end;
$$;

revoke all on function dental.mark_notification_sent(uuid, text, text, jsonb) from public;
grant execute on function dental.mark_notification_sent(uuid, text, text, jsonb) to authenticated, service_role;

create or replace function dental.mark_notification_failed(
  p_queue_id uuid,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.notification_queue%rowtype;
  v_err text := left(coalesce(nullif(trim(p_error_message), ''), 'Send failed'), 2000);
begin
  select * into v_row from dental.notification_queue where id = p_queue_id for update;
  if not found then
    raise exception 'Queue item not found';
  end if;

  update dental.notification_queue
  set
    status = 'failed',
    attempts = attempts + 1,
    last_error = v_err
  where id = p_queue_id;

  insert into dental.notification_log (
    queue_id, branch_id, direction, phone, language, kind,
    status, body_preview, payload, error_message
  )
  values (
    p_queue_id,
    v_row.branch_id,
    'outbound',
    v_row.phone,
    v_row.language,
    v_row.kind,
    'failed',
    'Send failed',
    jsonb_build_object('source', 'mark_notification_failed'),
    v_err
  );
end;
$$;

revoke all on function dental.mark_notification_failed(uuid, text) from public;
grant execute on function dental.mark_notification_failed(uuid, text) to authenticated, service_role;

-- Claim due (or one explicit) queue rows for the worker. Service role only.
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
  template_name text
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
    set status = 'processing'
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
    t.name
  from claimed c
  join dental.message_templates t on t.id = c.template_id;
end;
$$;

revoke all on function dental.claim_due_notifications(integer, uuid) from public;
grant execute on function dental.claim_due_notifications(integer, uuid) to service_role;
