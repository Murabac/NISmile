-- DentaFlow step 25: WhatsApp campaigns.
-- Preview opt-in audience, enqueue promotion announcement / ending-soon
-- in each customer's language (so / ar / en). Marketing templates.

do $$ begin
  create type dental.campaign_status as enum (
    'draft',
    'scheduled',
    'sending',
    'sent',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists dental.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  promotion_id uuid references dental.promotions (id) on delete set null,
  kind text not null check (kind in ('promotion_announcement', 'promotion_ending_soon')),
  status dental.campaign_status not null default 'draft',
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  target_count integer not null default 0 check (target_count >= 0),
  enqueued_count integer not null default 0 check (enqueued_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists campaigns_created_at_idx
  on dental.campaigns (created_at desc);
create index if not exists campaigns_promotion_id_idx
  on dental.campaigns (promotion_id);

alter table dental.campaigns enable row level security;

drop policy if exists campaigns_select on dental.campaigns;
create policy campaigns_select
on dental.campaigns for select to authenticated
using (dental.is_owner() or dental.can_manage_notifications());

drop policy if exists campaigns_write on dental.campaigns;
create policy campaigns_write
on dental.campaigns for all to authenticated
using (dental.is_owner())
with check (dental.is_owner());

-- Marketing templates (so / ar / en). Body uses {{1}} = announcement text.
insert into dental.message_templates (
  kind, language, name, category, body_text, variables, status
)
values
  (
    'promotion_announcement', 'so',
    'Promotion announcement (SO)',
    'marketing',
    E'{{1}}\n\n— N.I SMILE Oral care & Teeth whitening\nJawab STOP si aad uga baxdo.',
    '["1"]'::jsonb,
    'draft'
  ),
  (
    'promotion_announcement', 'ar',
    'Promotion announcement (AR)',
    'marketing',
    E'{{1}}\n\n— N.I SMILE Oral care & Teeth whitening\nأرسل STOP لإلغاء الاشتراك.',
    '["1"]'::jsonb,
    'draft'
  ),
  (
    'promotion_announcement', 'en',
    'Promotion announcement (EN)',
    'marketing',
    E'{{1}}\n\n— N.I SMILE Oral care & Teeth whitening\nReply STOP to opt out.',
    '["1"]'::jsonb,
    'draft'
  ),
  (
    'promotion_ending_soon', 'so',
    'Promotion ending soon (SO)',
    'marketing',
    E'Xasuusin: {{1}}\n\n— N.I SMILE Oral care & Teeth whitening\nJawab STOP si aad uga baxdo.',
    '["1"]'::jsonb,
    'draft'
  ),
  (
    'promotion_ending_soon', 'ar',
    'Promotion ending soon (AR)',
    'marketing',
    E'تذكير: {{1}}\n\n— N.I SMILE Oral care & Teeth whitening\nأرسل STOP لإلغاء الاشتراك.',
    '["1"]'::jsonb,
    'draft'
  ),
  (
    'promotion_ending_soon', 'en',
    'Promotion ending soon (EN)',
    'marketing',
    E'Reminder: {{1}}\n\n— N.I SMILE Oral care & Teeth whitening\nReply STOP to opt out.',
    '["1"]'::jsonb,
    'draft'
  )
on conflict (kind, language) do nothing;

create or replace function dental.promotion_message_for_language(
  p_promo dental.promotions,
  p_language dental.whatsapp_language
)
returns text
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_msg text;
begin
  if p_language = 'so' then
    v_msg := nullif(trim(coalesce(p_promo.whatsapp_message_so, '')), '');
  elsif p_language = 'ar' then
    v_msg := nullif(trim(coalesce(p_promo.whatsapp_message_ar, '')), '');
  else
    v_msg := nullif(trim(coalesce(p_promo.whatsapp_message_en, '')), '');
  end if;

  if v_msg is null then
    v_msg := coalesce(
      nullif(trim(coalesce(p_promo.whatsapp_message_en, '')), ''),
      nullif(trim(coalesce(p_promo.whatsapp_message_so, '')), ''),
      nullif(trim(coalesce(p_promo.whatsapp_message_ar, '')), ''),
      p_promo.name
    );
  end if;

  return v_msg;
end;
$$;

revoke all on function dental.promotion_message_for_language(dental.promotions, dental.whatsapp_language) from public;
grant execute on function dental.promotion_message_for_language(dental.promotions, dental.whatsapp_language) to authenticated, service_role;

-- Opt-in audience with phone for a promotion (preview).
create or replace function dental.list_promotion_audience(p_promotion_id uuid)
returns table (
  customer_id uuid,
  branch_id uuid,
  name text,
  phone text,
  language dental.whatsapp_language,
  customer_type text,
  subtype text
)
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_promo dental.promotions%rowtype;
  v_branch_filter boolean;
begin
  if auth.uid() is not null then
    if not dental.is_owner() and not dental.can_manage_notifications() then
      raise exception 'Not allowed to preview campaign audience';
    end if;
  end if;

  select * into v_promo from dental.promotions where id = p_promotion_id;
  if v_promo.id is null then
    raise exception 'Promotion not found';
  end if;

  select exists (
    select 1 from dental.promotion_branches where promotion_id = p_promotion_id
  ) into v_branch_filter;

  return query
  select
    c.id,
    c.branch_id,
    c.name,
    c.phone,
    c.language,
    c.customer_type,
    c.subtype
  from dental.customers c
  where c.whatsapp_opt_in
    and nullif(trim(coalesce(c.phone, '')), '') is not null
    and (
      not v_branch_filter
      or c.branch_id in (
        select pb.branch_id from dental.promotion_branches pb where pb.promotion_id = p_promotion_id
      )
    )
    and (
      v_promo.audience = 'all'
      or (v_promo.audience = 'retail' and c.customer_type = 'retail')
      or (v_promo.audience = 'wholesale' and c.customer_type = 'wholesale')
      or (
        v_promo.audience = 'wholesale_subtype'
        and c.customer_type = 'wholesale'
        and lower(coalesce(c.subtype, '')) = lower(v_promo.wholesale_subtype)
      )
      or (
        v_promo.audience = 'named_customers'
        and exists (
          select 1
          from dental.promotion_targets t
          where t.promotion_id = p_promotion_id
            and t.target_kind = 'customer'
            and t.customer_id = c.id
        )
      )
    )
  order by c.name;
end;
$$;

revoke all on function dental.list_promotion_audience(uuid) from public;
grant execute on function dental.list_promotion_audience(uuid) to authenticated, service_role;

-- Enqueue campaign: one queue row per opt-in recipient in their language.
create or replace function dental.enqueue_promotion_campaign(
  p_promotion_id uuid,
  p_kind text default 'promotion_announcement',
  p_scheduled_at timestamptz default null,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_promo dental.promotions%rowtype;
  v_campaign_id uuid;
  v_kind text := trim(coalesce(p_kind, 'promotion_announcement'));
  v_when timestamptz := coalesce(p_scheduled_at, now());
  v_target integer := 0;
  v_enqueued integer := 0;
  v_skipped integer := 0;
  v_rec record;
  v_msg text;
  v_queue_id uuid;
  v_status dental.campaign_status;
  v_camp_name text;
begin
  -- Seed / service_role have no auth.uid(); staff callers must be owner.
  if auth.uid() is not null and not dental.is_owner() then
    raise exception 'Only the owner can enqueue promotion campaigns';
  end if;

  if v_kind not in ('promotion_announcement', 'promotion_ending_soon') then
    raise exception 'Invalid campaign kind %', v_kind;
  end if;

  select * into v_promo from dental.promotions where id = p_promotion_id;
  if v_promo.id is null then
    raise exception 'Promotion not found';
  end if;

  if not v_promo.notify_whatsapp then
    raise exception 'Promotion does not have WhatsApp notify enabled';
  end if;

  if dental.promotion_message_for_language(v_promo, 'so') is null
    and dental.promotion_message_for_language(v_promo, 'ar') is null
    and dental.promotion_message_for_language(v_promo, 'en') is null
  then
    raise exception 'Promotion has no WhatsApp announcement text';
  end if;

  -- Ensure marketing templates exist for all languages used.
  if not exists (
    select 1 from dental.message_templates
    where kind = v_kind and language = 'so'
  ) then
    raise exception 'Missing % template for so', v_kind;
  end if;

  v_camp_name := coalesce(
    nullif(trim(coalesce(p_name, '')), ''),
    case
      when v_kind = 'promotion_ending_soon' then 'Ending soon: ' || v_promo.name
      else 'Announce: ' || v_promo.name
    end
  );

  select count(*)::integer into v_target
  from dental.list_promotion_audience(p_promotion_id);

  if v_when > now() + interval '1 minute' then
    v_status := 'scheduled';
  else
    v_status := 'sending';
  end if;

  insert into dental.campaigns (
    name, promotion_id, kind, status, scheduled_at,
    started_at, target_count, created_by
  )
  values (
    v_camp_name,
    p_promotion_id,
    v_kind,
    v_status,
    v_when,
    case when v_status = 'sending' then now() else null end,
    v_target,
    auth.uid()
  )
  returning id into v_campaign_id;

  for v_rec in
    select * from dental.list_promotion_audience(p_promotion_id)
  loop
    -- Skip recent duplicate for same promo + kind (7 days).
    if exists (
      select 1
      from dental.notification_queue q
      where q.customer_id = v_rec.customer_id
        and q.kind = v_kind
        and q.status in ('pending', 'processing', 'sent')
        and q.related_type = 'campaign'
        and q.created_at > now() - interval '7 days'
        and (q.params->>'promotion_id') = p_promotion_id::text
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_msg := dental.promotion_message_for_language(v_promo, v_rec.language);

    begin
      v_queue_id := dental.enqueue_notification(
        v_rec.branch_id,
        v_kind,
        v_rec.phone,
        v_rec.language,
        v_rec.customer_id,
        jsonb_build_object(
          '1', v_msg,
          'promotion_id', p_promotion_id,
          'promo_code', v_promo.code,
          'promo_name', v_promo.name,
          'customer_name', v_rec.name,
          'ends_at', v_promo.ends_at,
          'campaign_id', v_campaign_id
        ),
        v_when,
        'campaign',
        v_campaign_id
      );
      v_enqueued := v_enqueued + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  update dental.campaigns
  set
    enqueued_count = v_enqueued,
    skipped_count = v_skipped,
    status = case
      when v_when > now() + interval '1 minute' then 'scheduled'::dental.campaign_status
      else 'sent'::dental.campaign_status
    end,
    completed_at = case
      when v_when > now() + interval '1 minute' then null
      else now()
    end
  where id = v_campaign_id;

  return v_campaign_id;
end;
$$;

revoke all on function dental.enqueue_promotion_campaign(uuid, text, timestamptz, text) from public;
grant execute on function dental.enqueue_promotion_campaign(uuid, text, timestamptz, text) to authenticated, service_role;

create or replace function dental.cancel_campaign(p_campaign_id uuid)
returns dental.campaigns
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.campaigns%rowtype;
  v_q record;
begin
  if auth.uid() is not null and not dental.is_owner() then
    raise exception 'Only the owner can cancel campaigns';
  end if;

  select * into v_row from dental.campaigns where id = p_campaign_id for update;
  if v_row.id is null then
    raise exception 'Campaign not found';
  end if;
  if v_row.status in ('sent', 'cancelled') then
    raise exception 'Campaign cannot be cancelled (status %)', v_row.status;
  end if;

  for v_q in
    select id from dental.notification_queue
    where related_type = 'campaign'
      and related_id = p_campaign_id
      and status in ('pending', 'failed')
  loop
    perform dental.cancel_queued_notification(v_q.id);
  end loop;

  update dental.campaigns
  set status = 'cancelled', completed_at = now()
  where id = p_campaign_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function dental.cancel_campaign(uuid) from public;
grant execute on function dental.cancel_campaign(uuid) to authenticated, service_role;

-- Campaign delivery stats from queue + log.
create or replace function dental.campaign_stats(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = dental
as $$
  select jsonb_build_object(
    'target_count', c.target_count,
    'enqueued_count', c.enqueued_count,
    'skipped_count', c.skipped_count,
    'pending', (
      select count(*)::integer from dental.notification_queue q
      where q.related_type = 'campaign' and q.related_id = c.id and q.status = 'pending'
    ),
    'sent', (
      select count(*)::integer from dental.notification_queue q
      where q.related_type = 'campaign' and q.related_id = c.id and q.status = 'sent'
    ),
    'failed', (
      select count(*)::integer from dental.notification_queue q
      where q.related_type = 'campaign' and q.related_id = c.id and q.status = 'failed'
    ),
    'delivered', (
      select count(distinct l.queue_id)::integer
      from dental.notification_log l
      join dental.notification_queue q on q.id = l.queue_id
      where q.related_type = 'campaign' and q.related_id = c.id and l.status = 'delivered'
    ),
    'read', (
      select count(distinct l.queue_id)::integer
      from dental.notification_log l
      join dental.notification_queue q on q.id = l.queue_id
      where q.related_type = 'campaign' and q.related_id = c.id and l.status = 'read'
    )
  )
  from dental.campaigns c
  where c.id = p_campaign_id;
$$;

revoke all on function dental.campaign_stats(uuid) from public;
grant execute on function dental.campaign_stats(uuid) to authenticated, service_role;
