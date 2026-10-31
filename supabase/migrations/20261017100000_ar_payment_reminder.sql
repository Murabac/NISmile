-- Step 33: AR payment due reminder (one-click WhatsApp).

insert into dental.message_templates (
  kind, language, name, category, body_text, variables, status
)
values (
  'payment_due_reminder', 'en',
  'Payment due reminder (English)', 'utility',
  E'Dear {{1}},\n\nThis is a payment reminder from N.I SMILE Oral care & Teeth whitening.\nOpen balance: ${{2}}.\nPlease pay it on time.\nDue date: {{3}}.',
  '["customer_name","open_balance","due_date"]'::jsonb,
  'draft'
)
on conflict (kind, language) do update
set
  body_text = excluded.body_text,
  variables = excluded.variables,
  name = excluded.name,
  category = excluded.category,
  updated_at = now();

create or replace function dental.notify_ar_payment_reminder(
  p_customer_id uuid,
  p_sale_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_customer dental.customers%rowtype;
  v_sale dental.sales%rowtype;
  v_open numeric(12, 2);
  v_due_label text;
  v_params jsonb;
  v_existing uuid;
  v_related_id uuid;
begin
  if p_customer_id is null then
    return null;
  end if;

  select * into v_customer from dental.customers where id = p_customer_id;
  if not found or not v_customer.whatsapp_opt_in then
    return null;
  end if;
  if nullif(trim(coalesce(v_customer.phone, '')), '') is null then
    return null;
  end if;

  if p_sale_id is not null then
    select * into v_sale from dental.sales where id = p_sale_id;
    if not found
       or v_sale.customer_id is distinct from p_customer_id
       or v_sale.status <> 'partial' then
      return null;
    end if;
    v_open := greatest(coalesce(v_sale.total, 0) - coalesce(v_sale.paid_total, 0), 0)::numeric(12, 2);
    if v_open <= 0 then
      return null;
    end if;
    v_due_label := case
      when v_sale.due_date is null then 'N/A'
      else to_char(v_sale.due_date, 'YYYY-MM-DD')
    end;
    v_related_id := v_sale.id;
  else
    v_open := dental.customer_ar_balance(p_customer_id);
    if v_open <= 0 then
      return null;
    end if;
    select to_char(min(due_date), 'YYYY-MM-DD')
    into v_due_label
    from dental.sales
    where customer_id = p_customer_id
      and status = 'partial'
      and due_date is not null;
    v_due_label := coalesce(v_due_label, 'N/A');
    v_related_id := p_customer_id;
  end if;

  v_params := jsonb_build_object(
    '1', v_customer.name,
    '2', to_char(v_open, 'FM999999990.00'),
    '3', v_due_label
  );

  -- Reuse pending/processing reminder for same related target (customer or sale).
  select id into v_existing
  from dental.notification_queue
  where kind = 'payment_due_reminder'
    and related_type = case when p_sale_id is null then 'customer' else 'sale' end
    and related_id = v_related_id
    and status in ('pending', 'processing')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    update dental.notification_queue
    set params = v_params,
        phone = v_customer.phone,
        scheduled_at = now()
    where id = v_existing;
    return v_existing;
  end if;

  -- Avoid duplicate same-day sent reminder for the same target.
  if exists (
    select 1 from dental.notification_queue
    where kind = 'payment_due_reminder'
      and related_type = case when p_sale_id is null then 'customer' else 'sale' end
      and related_id = v_related_id
      and status = 'sent'
      and sent_at >= date_trunc('day', now())
  ) then
    return null;
  end if;

  return dental.try_enqueue_notification(
    v_customer.branch_id,
    'payment_due_reminder',
    v_customer.phone,
    'en',
    p_customer_id,
    v_params,
    now(),
    case when p_sale_id is null then 'customer' else 'sale' end,
    v_related_id
  );
end;
$$;

revoke all on function dental.notify_ar_payment_reminder(uuid, uuid) from public;
grant execute on function dental.notify_ar_payment_reminder(uuid, uuid) to authenticated, service_role;


-- Dashboard debt rows: include sale_id + customer_id for AR WhatsApp.
create or replace function dental.dashboard_summary(p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_day_start timestamptz := date_trunc('day', now());
  v_day_end timestamptz := v_day_start + interval '1 day';
begin
  if auth.uid() is not null then
    if p_branch_id is null and not dental.is_owner() then
      raise exception 'Only the owner can view all-branch dashboard';
    end if;
    if p_branch_id is not null
      and not dental.is_owner()
      and p_branch_id not in (select dental.user_branch_ids())
    then
      raise exception 'Branch access denied';
    end if;
  end if;

  return jsonb_build_object(
    'sales_today', (
      select jsonb_build_object(
        'count', count(*)::integer,
        'total', coalesce(sum(total), 0),
        'paid', coalesce(sum(paid_total), 0)
      )
      from dental.sales
      where status <> 'void'
        and created_at >= v_day_start and created_at < v_day_end
        and (p_branch_id is null or branch_id = p_branch_id)
    ),
    'appointments_today', (
      select jsonb_build_object(
        'count', count(*)::integer,
        'scheduled', count(*) filter (where status = 'scheduled')::integer,
        'confirmed', count(*) filter (where status = 'confirmed')::integer,
        'completed', count(*) filter (where status = 'completed')::integer,
        'cancelled', count(*) filter (where status in ('cancelled', 'no_show'))::integer
      )
      from dental.appointments
      where start_at >= v_day_start and start_at < v_day_end
        and (p_branch_id is null or branch_id = p_branch_id)
    ),
    'appointments_list', coalesce((
      select jsonb_agg(row_to_json(a)::jsonb order by a.start_at)
      from (
        select
          ap.id,
          ap.start_at,
          ap.status::text as status,
          c.name as customer_name,
          s.name as service_name
        from dental.appointments ap
        join dental.customers c on c.id = ap.customer_id
        left join dental.services s on s.id = ap.service_id
        where ap.start_at >= v_day_start and ap.start_at < v_day_end
          and (p_branch_id is null or ap.branch_id = p_branch_id)
        order by ap.start_at
        limit 20
      ) a
    ), '[]'::jsonb),
    'debts', (
      select jsonb_build_object(
        'open_invoices', count(*)::integer,
        'ar_balance', coalesce(sum(total - paid_total), 0),
        'overdue', coalesce(sum(total - paid_total) filter (
          where due_date is not null and due_date < current_date
        ), 0)
      )
      from dental.sales
      where status = 'partial'
        and (p_branch_id is null or branch_id = p_branch_id)
    ),
    'debt_rows', coalesce((
      select jsonb_agg(row_to_json(d)::jsonb)
      from (
        select
          s.id as sale_id,
          s.customer_id,
          s.receipt_number,
          c.name as customer_name,
          round(s.total - s.paid_total, 2) as balance,
          s.due_date
        from dental.sales s
        left join dental.customers c on c.id = s.customer_id
        where s.status = 'partial'
          and (p_branch_id is null or s.branch_id = p_branch_id)
        order by s.due_date nulls last
        limit 8
      ) d
    ), '[]'::jsonb)
  );
end;
$$;


revoke all on function dental.dashboard_summary(uuid) from public;
grant execute on function dental.dashboard_summary(uuid) to authenticated, service_role;
