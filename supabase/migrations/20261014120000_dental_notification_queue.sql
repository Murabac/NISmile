-- DentaFlow notification queue (step 20).
-- message_templates: one Somali + one Arabic row per kind.
-- Actual Cloud API send is step 21+; credentials stay in Edge Function secrets.

do $$ begin
  create type dental.message_category as enum ('utility', 'marketing');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.template_approval_status as enum (
    'draft', 'pending', 'approved', 'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.queue_status as enum (
    'pending', 'processing', 'sent', 'failed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.log_direction as enum ('outbound', 'inbound');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dental.log_status as enum (
    'queued', 'sent', 'delivered', 'read', 'failed', 'replied'
  );
exception when duplicate_object then null;
end $$;

create table if not exists dental.message_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  language dental.whatsapp_language not null,
  name text not null,
  category dental.message_category not null default 'utility',
  body_text text not null,
  variables jsonb not null default '[]'::jsonb,
  whatsapp_template_id text,
  status dental.template_approval_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, language)
);

create index if not exists message_templates_kind_idx
  on dental.message_templates (kind);

create table if not exists dental.notification_queue (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  customer_id uuid references dental.customers (id),
  phone text not null,
  language dental.whatsapp_language not null,
  template_id uuid not null references dental.message_templates (id),
  kind text not null,
  params jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  status dental.queue_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  related_type text,
  related_id uuid,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notification_queue_due_idx
  on dental.notification_queue (status, scheduled_at)
  where status in ('pending', 'failed');
create index if not exists notification_queue_branch_idx
  on dental.notification_queue (branch_id, created_at desc);
create index if not exists notification_queue_customer_idx
  on dental.notification_queue (customer_id);

create table if not exists dental.notification_log (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references dental.notification_queue (id) on delete set null,
  branch_id uuid references dental.branches (id),
  direction dental.log_direction not null default 'outbound',
  phone text not null,
  language dental.whatsapp_language,
  kind text,
  status dental.log_status not null,
  body_preview text,
  payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists notification_log_created_idx
  on dental.notification_log (created_at desc);
create index if not exists notification_log_queue_idx
  on dental.notification_log (queue_id);
create index if not exists notification_log_branch_idx
  on dental.notification_log (branch_id, created_at desc);

create or replace function dental.can_manage_notifications()
returns boolean
language sql
stable
security definer
set search_path = dental
as $$
  select exists (
    select 1
    from dental.profiles
    where user_id = auth.uid()
      and role in ('owner', 'branch_manager', 'receptionist')
  );
$$;

revoke all on function dental.can_manage_notifications() from public;
grant execute on function dental.can_manage_notifications() to authenticated;

-- Enqueue by kind + customer language (or explicit language).
create or replace function dental.enqueue_notification(
  p_branch_id uuid,
  p_kind text,
  p_phone text,
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
  v_lang dental.whatsapp_language;
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_template dental.message_templates%rowtype;
  v_queue_id uuid;
  v_customer dental.customers%rowtype;
begin
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if nullif(trim(coalesce(p_kind, '')), '') is null then
    raise exception 'Message kind is required';
  end if;

  if auth.uid() is not null then
    if not dental.can_manage_notifications() and not dental.is_owner() then
      raise exception 'Not allowed to enqueue notifications';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  v_lang := p_language;
  if p_customer_id is not null then
    select * into v_customer from dental.customers where id = p_customer_id;
    if not found then
      raise exception 'Customer not found';
    end if;
    if v_customer.branch_id <> p_branch_id then
      raise exception 'Customer belongs to another branch';
    end if;
    if v_lang is null then
      v_lang := v_customer.language;
    end if;
    if v_phone is null then
      v_phone := nullif(trim(coalesce(v_customer.phone, '')), '');
    end if;
    if not v_customer.whatsapp_opt_in then
      raise exception 'Customer has not opted in to WhatsApp';
    end if;
  end if;

  if v_lang is null then
    v_lang := 'so';
  end if;
  if v_phone is null then
    raise exception 'Recipient phone is required';
  end if;

  select * into v_template
  from dental.message_templates
  where kind = trim(p_kind)
    and language = v_lang;

  if not found then
    raise exception 'No % template for language %', p_kind, v_lang;
  end if;

  insert into dental.notification_queue (
    branch_id, customer_id, phone, language, template_id, kind,
    params, scheduled_at, status, related_type, related_id, created_by
  )
  values (
    p_branch_id,
    p_customer_id,
    v_phone,
    v_lang,
    v_template.id,
    v_template.kind,
    coalesce(p_params, '{}'::jsonb),
    coalesce(p_scheduled_at, now()),
    'pending',
    nullif(trim(coalesce(p_related_type, '')), ''),
    p_related_id,
    auth.uid()
  )
  returning id into v_queue_id;

  insert into dental.notification_log (
    queue_id, branch_id, direction, phone, language, kind,
    status, body_preview, payload
  )
  values (
    v_queue_id,
    p_branch_id,
    'outbound',
    v_phone,
    v_lang,
    v_template.kind,
    'queued',
    left(v_template.body_text, 180),
    jsonb_build_object(
      'params', coalesce(p_params, '{}'::jsonb),
      'template_id', v_template.id,
      'scheduled_at', coalesce(p_scheduled_at, now())
    )
  );

  return v_queue_id;
end;
$$;

revoke all on function dental.enqueue_notification(uuid, text, text, dental.whatsapp_language, uuid, jsonb, timestamptz, text, uuid) from public;
grant execute on function dental.enqueue_notification(uuid, text, text, dental.whatsapp_language, uuid, jsonb, timestamptz, text, uuid) to authenticated, service_role;

create or replace function dental.cancel_queued_notification(p_queue_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.notification_queue%rowtype;
begin
  select * into v_row from dental.notification_queue where id = p_queue_id for update;
  if not found then
    raise exception 'Queue item not found';
  end if;

  if auth.uid() is not null then
    if not dental.can_manage_notifications() and not dental.is_owner() then
      raise exception 'Not allowed to cancel notifications';
    end if;
    if not dental.is_owner() and v_row.branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if v_row.status not in ('pending', 'failed') then
    raise exception 'Only pending or failed items can be cancelled';
  end if;

  update dental.notification_queue
  set status = 'cancelled'
  where id = p_queue_id;

  insert into dental.notification_log (
    queue_id, branch_id, direction, phone, language, kind, status, body_preview, payload
  )
  values (
    p_queue_id,
    v_row.branch_id,
    'outbound',
    v_row.phone,
    v_row.language,
    v_row.kind,
    'failed',
    'Cancelled before send',
    jsonb_build_object('reason', 'cancelled')
  );
end;
$$;

revoke all on function dental.cancel_queued_notification(uuid) from public;
grant execute on function dental.cancel_queued_notification(uuid) to authenticated, service_role;

alter table dental.message_templates enable row level security;
alter table dental.notification_queue enable row level security;
alter table dental.notification_log enable row level security;

create policy message_templates_select
on dental.message_templates
for select
to authenticated
using (true);

create policy message_templates_update
on dental.message_templates
for update
to authenticated
using (dental.is_owner() or dental.can_manage_notifications())
with check (dental.is_owner() or dental.can_manage_notifications());

create policy notification_queue_select
on dental.notification_queue
for select
to authenticated
using (
  dental.is_owner()
  or branch_id in (select dental.user_branch_ids())
);

create policy notification_queue_insert
on dental.notification_queue
for insert
to authenticated
with check (
  (dental.can_manage_notifications() or dental.is_owner())
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

create policy notification_log_select
on dental.notification_log
for select
to authenticated
using (
  dental.is_owner()
  or branch_id is null
  or branch_id in (select dental.user_branch_ids())
);

grant select on dental.message_templates to authenticated, service_role;
grant update on dental.message_templates to authenticated, service_role;
grant select, insert, update on dental.notification_queue to authenticated, service_role;
grant select, insert on dental.notification_log to authenticated, service_role;
