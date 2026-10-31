-- Sale WhatsApp PDF: private Storage bucket + claim returns related sale id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sale-documents',
  'sale-documents',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Service role bypasses Storage RLS; no public policies.

drop function if exists dental.claim_due_notifications(integer, uuid);

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
    t.name,
    c.related_type,
    c.related_id
  from claimed c
  join dental.message_templates t on t.id = c.template_id;
end;
$$;

revoke all on function dental.claim_due_notifications(integer, uuid) from public;
grant execute on function dental.claim_due_notifications(integer, uuid) to service_role;
