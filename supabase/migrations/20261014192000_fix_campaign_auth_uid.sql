-- Allow campaign enqueue/cancel from SQL seed / service_role (auth.uid() is null).
-- Staff callers still must be owner.

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
