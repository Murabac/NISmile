-- DentaFlow steps 26–28: reports, dashboard summary, go-live checklist.
-- Branch filter: null / omitted = all branches (owner). Period: today|7d|30d|mtd|ytd.

alter table dental.clinic_settings
  add column if not exists go_live jsonb not null default '{}'::jsonb;

create or replace function dental.report_period_bounds(p_period text)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_period text := lower(trim(coalesce(p_period, 'mtd')));
  v_now timestamptz := now();
  v_start timestamptz;
begin
  if v_period = 'today' then
    v_start := date_trunc('day', v_now);
  elsif v_period = '7d' then
    v_start := v_now - interval '7 days';
  elsif v_period = '30d' then
    v_start := v_now - interval '30 days';
  elsif v_period = 'ytd' then
    v_start := date_trunc('year', v_now);
  else
    -- mtd default
    v_start := date_trunc('month', v_now);
  end if;

  return query select v_start, v_now;
end;
$$;

revoke all on function dental.report_period_bounds(text) from public;
grant execute on function dental.report_period_bounds(text) to authenticated, service_role;

create or replace function dental.can_view_reports()
returns boolean
language sql
stable
security definer
set search_path = dental
as $$
  select exists (
    select 1 from dental.profiles
    where user_id = auth.uid()
      and role in ('owner', 'branch_manager')
  );
$$;

revoke all on function dental.can_view_reports() from public;
grant execute on function dental.can_view_reports() to authenticated;

create or replace function dental.assert_report_access(p_branch_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = dental
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not dental.can_view_reports() and not dental.is_owner() then
    raise exception 'Not allowed to view reports';
  end if;
  if p_branch_id is not null
    and not dental.is_owner()
    and p_branch_id not in (select dental.user_branch_ids())
  then
    raise exception 'Branch access denied';
  end if;
  if p_branch_id is null and not dental.is_owner() then
    raise exception 'Only the owner can view all-branch reports';
  end if;
end;
$$;

revoke all on function dental.assert_report_access(uuid) from public;
grant execute on function dental.assert_report_access(uuid) to authenticated, service_role;

-- Unified report runner.
create or replace function dental.run_report(
  p_report_type text,
  p_branch_id uuid default null,
  p_period text default 'mtd'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_type text := lower(trim(coalesce(p_report_type, 'sales')));
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  perform dental.assert_report_access(p_branch_id);

  select b.starts_at, b.ends_at into v_start, v_end
  from dental.report_period_bounds(p_period) b;

  if v_type = 'sales' then
    select jsonb_build_object(
      'report', 'sales',
      'period', p_period,
      'starts_at', v_start,
      'ends_at', v_end,
      'totals', jsonb_build_object(
        'sale_count', coalesce(sum(1), 0),
        'subtotal', coalesce(sum(s.subtotal), 0),
        'discount_total', coalesce(sum(s.discount_total), 0),
        'tax_total', coalesce(sum(s.tax_total), 0),
        'total', coalesce(sum(s.total), 0),
        'paid_total', coalesce(sum(s.paid_total), 0)
      ),
      'by_branch', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb order by x.branch_name)
        from (
          select
            b.id as branch_id,
            b.name as branch_name,
            count(s2.id)::integer as sale_count,
            coalesce(sum(s2.total), 0)::numeric as total,
            coalesce(sum(s2.paid_total), 0)::numeric as paid_total,
            coalesce(sum(s2.tax_total), 0)::numeric as tax_total
          from dental.branches b
          left join dental.sales s2
            on s2.branch_id = b.id
           and s2.status <> 'void'
           and s2.created_at >= v_start and s2.created_at <= v_end
           and (p_branch_id is null or s2.branch_id = p_branch_id)
          where b.active
            and (p_branch_id is null or b.id = p_branch_id)
          group by b.id, b.name
        ) x
      ), '[]'::jsonb),
      'rows', coalesce((
        select jsonb_agg(row_to_json(r)::jsonb order by r.created_at desc)
        from (
          select
            s.id,
            s.receipt_number,
            s.branch_id,
            b.name as branch_name,
            s.status,
            s.price_list,
            s.subtotal,
            s.discount_total,
            s.tax_total,
            s.total,
            s.paid_total,
            s.created_at,
            c.name as customer_name
          from dental.sales s
          join dental.branches b on b.id = s.branch_id
          left join dental.customers c on c.id = s.customer_id
          where s.status <> 'void'
            and s.created_at >= v_start and s.created_at <= v_end
            and (p_branch_id is null or s.branch_id = p_branch_id)
          order by s.created_at desc
          limit 200
        ) r
      ), '[]'::jsonb)
    )
    into v_result
    from dental.sales s
    where s.status <> 'void'
      and s.created_at >= v_start and s.created_at <= v_end
      and (p_branch_id is null or s.branch_id = p_branch_id);

  elsif v_type = 'profit' then
    select jsonb_build_object(
      'report', 'profit',
      'period', p_period,
      'starts_at', v_start,
      'ends_at', v_end,
      'totals', jsonb_build_object(
        'revenue_ex_vat', coalesce(sum(sl.line_net), 0),
        'estimated_cogs', coalesce(sum(
          case
            when sl.line_type = 'item' then
              sl.qty * coalesce(
                (select avg(sb.unit_cost) from dental.stock_batches sb where sb.item_id = sl.item_id),
                i.cost,
                0
              )
            else 0
          end
        ), 0),
        'gross_profit', coalesce(sum(sl.line_net), 0) - coalesce(sum(
          case
            when sl.line_type = 'item' then
              sl.qty * coalesce(
                (select avg(sb.unit_cost) from dental.stock_batches sb where sb.item_id = sl.item_id),
                i.cost,
                0
              )
            else 0
          end
        ), 0)
      ),
      'note', 'COGS uses average batch unit cost (or item.cost). Service lines have no item COGS.'
    )
    into v_result
    from dental.sale_lines sl
    join dental.sales s on s.id = sl.sale_id
    left join dental.items i on i.id = sl.item_id
    where s.status <> 'void'
      and s.created_at >= v_start and s.created_at <= v_end
      and (p_branch_id is null or s.branch_id = p_branch_id);

  elsif v_type = 'valuation' then
    select jsonb_build_object(
      'report', 'valuation',
      'period', p_period,
      'totals', jsonb_build_object(
        'batch_count', count(*)::integer,
        'qty_on_hand', coalesce(sum(sb.qty_remaining), 0),
        'value_usd', coalesce(sum(sb.qty_remaining * sb.unit_cost), 0)
      ),
      'by_branch', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb order by x.branch_name)
        from (
          select
            b.id as branch_id,
            b.name as branch_name,
            coalesce(sum(sb2.qty_remaining * sb2.unit_cost), 0)::numeric as value_usd,
            coalesce(sum(sb2.qty_remaining), 0)::numeric as qty_on_hand
          from dental.branches b
          left join dental.stock_batches sb2
            on sb2.branch_id = b.id and sb2.qty_remaining > 0
           and (p_branch_id is null or sb2.branch_id = p_branch_id)
          where b.active and (p_branch_id is null or b.id = p_branch_id)
          group by b.id, b.name
        ) x
      ), '[]'::jsonb),
      'rows', coalesce((
        select jsonb_agg(row_to_json(r)::jsonb)
        from (
          select
            b.name as branch_name,
            i.sku,
            i.name as item_name,
            sb.batch_no,
            sb.expiry_date,
            sb.qty_remaining,
            sb.unit_cost,
            round(sb.qty_remaining * sb.unit_cost, 2) as value_usd
          from dental.stock_batches sb
          join dental.items i on i.id = sb.item_id
          join dental.branches b on b.id = sb.branch_id
          where sb.qty_remaining > 0
            and (p_branch_id is null or sb.branch_id = p_branch_id)
          order by (sb.qty_remaining * sb.unit_cost) desc
          limit 200
        ) r
      ), '[]'::jsonb)
    )
    into v_result
    from dental.stock_batches sb
    where sb.qty_remaining > 0
      and (p_branch_id is null or sb.branch_id = p_branch_id);

  elsif v_type = 'expiry' then
    select jsonb_build_object(
      'report', 'expiry',
      'period', p_period,
      'totals', jsonb_build_object(
        'within_30', count(*) filter (where sb.expiry_date <= current_date + 30)::integer,
        'within_60', count(*) filter (where sb.expiry_date <= current_date + 60)::integer,
        'within_90', count(*) filter (where sb.expiry_date <= current_date + 90)::integer,
        'expired', count(*) filter (where sb.expiry_date < current_date)::integer
      ),
      'rows', coalesce((
        select jsonb_agg(row_to_json(r)::jsonb)
        from (
          select
            b.name as branch_name,
            i.sku,
            i.name as item_name,
            sb.batch_no,
            sb.expiry_date,
            sb.qty_remaining,
            sb.unit_cost,
            (sb.expiry_date - current_date) as days_left,
            round(sb.qty_remaining * sb.unit_cost, 2) as value_at_risk
          from dental.stock_batches sb
          join dental.items i on i.id = sb.item_id
          join dental.branches b on b.id = sb.branch_id
          where sb.qty_remaining > 0
            and sb.expiry_date <= current_date + 90
            and (p_branch_id is null or sb.branch_id = p_branch_id)
          order by sb.expiry_date
          limit 200
        ) r
      ), '[]'::jsonb)
    )
    into v_result
    from dental.stock_batches sb
    where sb.qty_remaining > 0
      and (p_branch_id is null or sb.branch_id = p_branch_id);

  elsif v_type = 'debts' then
    select jsonb_build_object(
      'report', 'debts',
      'period', p_period,
      'totals', jsonb_build_object(
        'open_invoices', count(*)::integer,
        'ar_balance', coalesce(sum(s.total - s.paid_total), 0),
        'overdue', coalesce(sum(s.total - s.paid_total) filter (
          where s.due_date is not null and s.due_date < current_date
        ), 0)
      ),
      'rows', coalesce((
        select jsonb_agg(row_to_json(r)::jsonb)
        from (
          select
            s.id,
            s.receipt_number,
            b.name as branch_name,
            c.name as customer_name,
            c.phone,
            s.due_date,
            s.total,
            s.paid_total,
            round(s.total - s.paid_total, 2) as balance,
            s.created_at,
            case
              when s.due_date is not null and s.due_date < current_date then true
              else false
            end as overdue
          from dental.sales s
          join dental.branches b on b.id = s.branch_id
          left join dental.customers c on c.id = s.customer_id
          where s.status = 'partial'
            and (p_branch_id is null or s.branch_id = p_branch_id)
          order by s.due_date nulls last, s.created_at
          limit 200
        ) r
      ), '[]'::jsonb)
    )
    into v_result
    from dental.sales s
    where s.status = 'partial'
      and (p_branch_id is null or s.branch_id = p_branch_id);

  elsif v_type = 'vat' then
    select jsonb_build_object(
      'report', 'vat',
      'period', p_period,
      'starts_at', v_start,
      'ends_at', v_end,
      'totals', jsonb_build_object(
        'taxable_net', coalesce(sum(s.subtotal - s.discount_total), 0),
        'tax_total', coalesce(sum(s.tax_total), 0),
        'sale_count', count(*)::integer
      ),
      'note', 'VAT % stays blank in Settings until the clinic confirms it. Totals use tax stored on each sale.',
      'by_branch', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb order by x.branch_name)
        from (
          select
            b.name as branch_name,
            coalesce(sum(s2.tax_total), 0)::numeric as tax_total,
            coalesce(sum(s2.subtotal - s2.discount_total), 0)::numeric as taxable_net
          from dental.branches b
          left join dental.sales s2
            on s2.branch_id = b.id
           and s2.status <> 'void'
           and s2.created_at >= v_start and s2.created_at <= v_end
           and (p_branch_id is null or s2.branch_id = p_branch_id)
          where b.active and (p_branch_id is null or b.id = p_branch_id)
          group by b.name
        ) x
      ), '[]'::jsonb)
    )
    into v_result
    from dental.sales s
    where s.status <> 'void'
      and s.created_at >= v_start and s.created_at <= v_end
      and (p_branch_id is null or s.branch_id = p_branch_id);

  elsif v_type = 'promos' then
    select jsonb_build_object(
      'report', 'promos',
      'period', p_period,
      'starts_at', v_start,
      'ends_at', v_end,
      'totals', jsonb_build_object(
        'redemptions', count(*)::integer,
        'discount_given', coalesce(sum(pr.discount_amount), 0)
      ),
      'rows', coalesce((
        select jsonb_agg(row_to_json(r)::jsonb)
        from (
          select
            p.code,
            p.name,
            p.promo_type::text as promo_type,
            count(pr2.id)::integer as redemptions,
            coalesce(sum(pr2.discount_amount), 0)::numeric as discount_given
          from dental.promotions p
          left join dental.promotion_redemptions pr2
            on pr2.promotion_id = p.id
           and pr2.created_at >= v_start and pr2.created_at <= v_end
           and (p_branch_id is null or pr2.branch_id = p_branch_id)
          group by p.id, p.code, p.name, p.promo_type
          having count(pr2.id) > 0
          order by coalesce(sum(pr2.discount_amount), 0) desc
        ) r
      ), '[]'::jsonb)
    )
    into v_result
    from dental.promotion_redemptions pr
    where pr.created_at >= v_start and pr.created_at <= v_end
      and (p_branch_id is null or pr.branch_id = p_branch_id);

  else
    raise exception 'Unknown report type %', v_type;
  end if;

  return coalesce(v_result, jsonb_build_object('report', v_type, 'totals', '{}'::jsonb, 'rows', '[]'::jsonb));
end;
$$;

revoke all on function dental.run_report(text, uuid, text) from public;
grant execute on function dental.run_report(text, uuid, text) to authenticated, service_role;

-- Dashboard summary for today (branch or all).
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

-- Go-live checklist snapshot.
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
      where category = 'utility' and status = 'draft'
    )::integer,
    'utility_approved', count(*) filter (
      where category = 'utility' and status = 'approved'
    )::integer,
    'marketing_draft', count(*) filter (
      where category = 'marketing' and status = 'draft'
    )::integer,
    'marketing_approved', count(*) filter (
      where category = 'marketing' and status = 'approved'
    )::integer,
    'by_language', jsonb_build_object(
      'so', count(*) filter (where language = 'so')::integer,
      'ar', count(*) filter (where language = 'ar')::integer,
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

revoke all on function dental.go_live_status() from public;
grant execute on function dental.go_live_status() to authenticated, service_role;

create or replace function dental.update_go_live_checklist(p_checklist jsonb)
returns dental.clinic_settings
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.clinic_settings%rowtype;
begin
  if auth.uid() is not null and not dental.is_owner() then
    raise exception 'Only the owner can update go-live checklist';
  end if;

  insert into dental.clinic_settings (id)
  select gen_random_uuid()
  where not exists (select 1 from dental.clinic_settings);

  update dental.clinic_settings
  set
    go_live = coalesce(p_checklist, '{}'::jsonb),
    updated_by = auth.uid(),
    updated_at = now()
  where id = (select id from dental.clinic_settings order by created_at limit 1)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function dental.update_go_live_checklist(jsonb) from public;
grant execute on function dental.update_go_live_checklist(jsonb) to authenticated, service_role;
