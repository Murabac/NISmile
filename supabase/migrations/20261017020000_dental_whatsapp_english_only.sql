-- WhatsApp English-only: all queued/sent messages use language en (Meta Cloud API: en_US).
-- Keeps whatsapp_language enum values so/ar unused to avoid enum rewrite.

-- Force existing customers to English.
update dental.customers
set language = 'en'
where language is distinct from 'en';

-- Ensure English utility + marketing templates exist BEFORE remapping queue FKs.
insert into dental.message_templates (
  kind, language, name, category, body_text, variables, status
)
values
(
  'appointment_confirmation', 'en',
  'Appointment confirmation (English)', 'utility',
  E'Dear {{1}},\n\nYour appointment at N.I SMILE Oral care & Teeth whitening is booked.\nDate: {{2}} at {{3}}.\nDentist: {{4}}.\n\nReply 1 to confirm, or 2 to cancel.',
  '["patient_name","date","time","dentist_name"]'::jsonb,
  'draft'
),
(
  'appointment_reminder_24h', 'en',
  '24h appointment reminder (English)', 'utility',
  E'Dear {{1}},\n\nReminder: your dental appointment at N.I SMILE Oral care & Teeth whitening ({{2}}).\nDate: {{3}} at {{4}}.\nDentist: {{5}}.\n\nReply 1 to confirm, or 2 to cancel.',
  '["patient_name","branch_name","date","time","dentist_name"]'::jsonb,
  'draft'
),
(
  'appointment_reminder_2h', 'en',
  '2h appointment reminder (English)', 'utility',
  E'Dear {{1}},\n\nYour N.I SMILE appointment is in about 2 hours: {{2}} at {{3}}.\nDentist: {{4}}.\n\nReply 1 to confirm / 2 to cancel.',
  '["patient_name","date","time","dentist_name"]'::jsonb,
  'draft'
),
(
  'appointment_reschedule', 'en',
  'Reschedule notice (English)', 'utility',
  E'Dear {{1}},\n\nYour appointment has been rescheduled.\nNew time: {{2}} at {{3}}.\nDentist: {{4}}.',
  '["patient_name","date","time","dentist_name"]'::jsonb,
  'draft'
),
(
  'appointment_cancel', 'en',
  'Cancel notice (English)', 'utility',
  E'Dear {{1}},\n\nYour appointment on {{2}} at {{3}} has been cancelled. Contact us to book a new one.',
  '["patient_name","date","time"]'::jsonb,
  'draft'
),
(
  'receipt_notice', 'en',
  'Receipt notice (English)', 'utility',
  E'Dear {{1}},\n\nThank you. Your N.I SMILE receipt #{{2}} totals ${{3}}. The PDF is in English.',
  '["customer_name","receipt_number","amount"]'::jsonb,
  'draft'
),
(
  'invoice_notice', 'en',
  'Invoice notice (English)', 'utility',
  E'Dear {{1}},\n\nYour N.I SMILE invoice #{{2}} totals ${{3}}. The PDF is in English.',
  '["customer_name","invoice_number","amount"]'::jsonb,
  'draft'
),
(
  'promotion_announcement', 'en',
  'Promotion announcement (EN)', 'marketing',
  E'{{1}}\n\n— N.I SMILE Oral care & Teeth whitening\nReply STOP to opt out.',
  '["1"]'::jsonb,
  'draft'
),
(
  'promotion_ending_soon', 'en',
  'Promotion ending soon (EN)', 'marketing',
  E'Reminder: {{1}}\n\n— N.I SMILE Oral care & Teeth whitening\nReply STOP to opt out.',
  '["1"]'::jsonb,
  'draft'
)
on conflict (kind, language) do nothing;

-- Remap every queue row that still points at a so/ar template onto the English twin
-- (template_id is NOT NULL — cancel alone is not enough to allow delete).
update dental.notification_queue q
set
  template_id = en.id,
  language = 'en',
  last_error = case
    when q.status in ('pending', 'failed', 'processing')
      and q.language in ('so', 'ar')
    then coalesce(q.last_error, 'Remapped to English: WhatsApp English-only cutover')
    else q.last_error
  end
from dental.message_templates old
join dental.message_templates en
  on en.kind = old.kind
 and en.language = 'en'
where q.template_id = old.id
  and old.language in ('so', 'ar');

-- Cancel unfinished so/ar-language queue work that somehow still lacks an English twin.
update dental.notification_queue q
set
  status = 'cancelled',
  last_error = coalesce(last_error, 'Cancelled: WhatsApp English-only cutover (no English template)')
where q.language in ('so', 'ar')
  and q.status in ('pending', 'failed', 'processing');

-- Safety: drop any queue rows still glued to so/ar templates (kinds with no English twin).
delete from dental.notification_queue q
using dental.message_templates t
where q.template_id = t.id
  and t.language in ('so', 'ar');

delete from dental.message_templates
where language in ('so', 'ar');

-- Always store customer WhatsApp language as English.
create or replace function dental.force_customer_whatsapp_english()
returns trigger
language plpgsql
security definer
set search_path = dental
as $$
begin
  new.language := 'en';
  return new;
end;
$$;

drop trigger if exists customers_force_whatsapp_english on dental.customers;
create trigger customers_force_whatsapp_english
before insert or update of language on dental.customers
for each row
execute function dental.force_customer_whatsapp_english();

-- Enqueue always uses English templates.
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
  v_lang dental.whatsapp_language := 'en';
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

  if p_customer_id is not null then
    select * into v_customer from dental.customers where id = p_customer_id;
    if not found then
      raise exception 'Customer not found';
    end if;
    if v_customer.branch_id <> p_branch_id then
      raise exception 'Customer belongs to another branch';
    end if;
    if v_phone is null then
      v_phone := nullif(trim(coalesce(v_customer.phone, '')), '');
    end if;
    if not v_customer.whatsapp_opt_in then
      raise exception 'Customer has not opted in to WhatsApp';
    end if;
  end if;

  -- p_language ignored; WhatsApp is English-only.
  if v_phone is null then
    raise exception 'Recipient phone is required';
  end if;

  select * into v_template
  from dental.message_templates
  where kind = trim(p_kind)
    and language = 'en';

  if not found then
    raise exception 'No % English template', p_kind;
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
begin
  -- English-only; p_language ignored.
  return coalesce(
    nullif(trim(coalesce(p_promo.whatsapp_message_en, '')), ''),
    p_promo.name
  );
end;
$$;

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

  if nullif(trim(coalesce(v_promo.whatsapp_message_en, '')), '') is null
     and nullif(trim(coalesce(v_promo.name, '')), '') is null then
    raise exception 'Promotion has no English WhatsApp announcement text';
  end if;

  if not exists (
    select 1 from dental.message_templates
    where kind = v_kind and language = 'en'
  ) then
    raise exception 'Missing % English template', v_kind;
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

    v_msg := dental.promotion_message_for_language(v_promo, 'en');

    begin
      v_queue_id := dental.enqueue_notification(
        v_rec.branch_id,
        v_kind,
        v_rec.phone,
        'en'::dental.whatsapp_language,
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

-- Customer import: language column optional / ignored; always English.
create or replace function dental.validate_import_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_batch dental.import_batches%rowtype;
  v_row dental.import_rows%rowtype;
  v_errors text[];
  v_sku text;
  v_name text;
  v_cat text;
  v_phone text;
  v_type text;
  v_qty numeric;
  v_expiry date;
  v_batch_no text;
  v_legacy boolean;
begin
  select * into v_batch from dental.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Import batch not found'; end if;

  if auth.uid() is not null then
    if not dental.can_manage_imports() and not dental.is_owner() then
      raise exception 'Not allowed to manage imports';
    end if;
    if v_batch.branch_id is not null
       and not dental.is_owner()
       and v_batch.branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  for v_row in select * from dental.import_rows where batch_id = v_batch.id order by row_number
  loop
    v_errors := '{}';

    if v_batch.import_type = 'items' then
      v_sku := nullif(trim(v_row.raw->>'sku'), '');
      v_name := nullif(trim(v_row.raw->>'name'), '');
      v_cat := nullif(trim(v_row.raw->>'category'), '');
      if v_sku is null then v_errors := array_append(v_errors, 'SKU is required'); end if;
      if v_name is null then v_errors := array_append(v_errors, 'Name is required'); end if;
      if v_cat is null then v_errors := array_append(v_errors, 'Category is required'); end if;
      if nullif(trim(v_row.raw->>'unit'), '') is null then
        v_errors := array_append(v_errors, 'Unit is required');
      end if;
      if coalesce((v_row.raw->>'retail_price')::numeric, -1) < 0 then
        v_errors := array_append(v_errors, 'retail_price must be >= 0');
      end if;
    elsif v_batch.import_type = 'customers' then
      if v_batch.branch_id is null then
        v_errors := array_append(v_errors, 'Branch is required for customer import');
      end if;
      v_name := nullif(trim(v_row.raw->>'name'), '');
      v_type := lower(coalesce(nullif(trim(v_row.raw->>'customer_type'), ''), 'retail'));
      v_phone := dental.normalize_import_phone(v_row.raw->>'phone');
      if v_name is null then v_errors := array_append(v_errors, 'Name is required'); end if;
      if v_type not in ('retail', 'wholesale') then
        v_errors := array_append(v_errors, 'customer_type must be retail or wholesale');
      end if;
      if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$' then
        v_errors := array_append(v_errors, 'Phone must be international (+252…)');
      end if;
    elsif v_batch.import_type = 'opening_stock' then
      if v_batch.branch_id is null then
        v_errors := array_append(v_errors, 'Branch is required for opening stock');
      end if;
      v_sku := nullif(trim(v_row.raw->>'sku'), '');
      v_batch_no := nullif(trim(v_row.raw->>'batch_no'), '');
      v_legacy := lower(coalesce(v_row.raw->>'legacy', 'n')) in ('y', 'yes', 'true', '1');
      if v_sku is null then v_errors := array_append(v_errors, 'SKU is required'); end if;
      if not exists (select 1 from dental.items where sku = v_sku) then
        v_errors := array_append(v_errors, 'Unknown SKU');
      end if;
      begin
        v_qty := (v_row.raw->>'quantity')::numeric;
      exception when others then
        v_qty := null;
      end;
      if v_qty is null or v_qty <= 0 then
        v_errors := array_append(v_errors, 'quantity must be positive');
      end if;
      if v_legacy then
        if v_batch_no is null then v_batch_no := 'LEGACY-' || coalesce(v_sku, 'ITEM'); end if;
      else
        if v_batch_no is null then v_errors := array_append(v_errors, 'batch_no is required'); end if;
        begin
          v_expiry := (v_row.raw->>'expiry_date')::date;
        exception when others then
          v_expiry := null;
        end;
        if v_expiry is null then
          v_errors := array_append(v_errors, 'expiry_date is required (YYYY-MM-DD)');
        elsif v_expiry < current_date then
          v_errors := array_append(v_errors, 'expiry_date is in the past');
        end if;
      end if;
    end if;

    update dental.import_rows
    set
      status = case when coalesce(array_length(v_errors, 1), 0) = 0 then 'ok'::dental.import_row_status
                    else 'error'::dental.import_row_status end,
      errors = v_errors,
      raw = case
        when v_batch.import_type = 'customers' then
          jsonb_set(
            jsonb_set(v_row.raw, '{phone}', to_jsonb(dental.normalize_import_phone(v_row.raw->>'phone'))),
            '{language}',
            to_jsonb('en'::text)
          )
        else v_row.raw
      end
    where id = v_row.id;
  end loop;

  update dental.import_batches
  set status = 'validated'
  where id = v_batch.id;
end;
$$;

create or replace function dental.go_live_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_settings dental.clinic_settings%rowtype;
  v_tpl jsonb;
begin
  if auth.uid() is not null and not dental.is_owner() then
    raise exception 'Only the owner can view go-live status';
  end if;

  v_settings := dental.get_clinic_settings();

  select jsonb_build_object(
    'utility_draft', count(*) filter (
      where category = 'utility' and status = 'draft' and language = 'en'
    )::integer,
    'utility_approved', count(*) filter (
      where category = 'utility' and status = 'approved' and language = 'en'
    )::integer,
    'marketing_draft', count(*) filter (
      where category = 'marketing' and status = 'draft' and language = 'en'
    )::integer,
    'marketing_approved', count(*) filter (
      where category = 'marketing' and status = 'approved' and language = 'en'
    )::integer,
    'by_language', jsonb_build_object(
      'en', count(*) filter (where language = 'en')::integer
    )
  )
  into v_tpl
  from dental.message_templates;

  return jsonb_build_object(
    'checklist', coalesce(v_settings.go_live, '{}'::jsonb),
    'gaps', jsonb_build_object(
      'vat_percent_blank', v_settings.vat_percent is null,
      'loyalty_earn_blank', v_settings.loyalty_earn_per_usd is null,
      'loyalty_redeem_blank', v_settings.loyalty_usd_per_point is null,
      'mycash_pending', true
    ),
    'templates', v_tpl,
    'updated_at', v_settings.updated_at
  );
end;
$$;
