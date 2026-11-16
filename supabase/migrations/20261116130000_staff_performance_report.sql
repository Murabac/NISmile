-- Owner-only staff performance: sales + appointments attributed by created_by.

create or replace function dental.staff_performance_report(
  p_branch_id uuid default null,
  p_period text default 'mtd',
  p_from_date date default null,
  p_to_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = dental
as $$
declare
  v_role text;
  v_period text := lower(trim(coalesce(p_period, 'mtd')));
  v_start timestamptz;
  v_end timestamptz;
  v_rows jsonb;
  v_totals jsonb;
begin
  select role::text into v_role from dental.profiles where id = auth.uid();
  if v_role is distinct from 'owner' then
    raise exception 'Staff performance is owner-only';
  end if;

  if p_from_date is not null or p_to_date is not null or v_period = 'custom' then
    if p_from_date is null or p_to_date is null then
      raise exception 'Custom range needs both from and to dates';
    end if;
    if p_to_date < p_from_date then
      raise exception 'To date must be on or after from date';
    end if;
    v_start := p_from_date::timestamp at time zone 'UTC';
    v_end := (p_to_date + 1)::timestamp at time zone 'UTC' - interval '1 microsecond';
    v_period := 'custom';
  else
    select b.starts_at, b.ends_at
    into v_start, v_end
    from dental.report_period_bounds(v_period) b;
  end if;

  with sales_base as (
    select
      s.id,
      s.created_by,
      s.total,
      s.paid_total,
      greatest(s.total - s.paid_total, 0)::numeric(12, 2) as unpaid
    from dental.sales s
    where s.status <> 'void'
      and s.created_at >= v_start
      and s.created_at <= v_end
      and (p_branch_id is null or s.branch_id = p_branch_id)
  ),
  sale_lines_agg as (
    select
      sb.created_by,
      coalesce(sum(case when sl.line_type = 'item' then sl.line_net else 0 end), 0)::numeric(12, 2)
        as items_net,
      coalesce(sum(case when sl.line_type = 'service' then sl.line_net else 0 end), 0)::numeric(12, 2)
        as services_net
    from sales_base sb
    join dental.sale_lines sl on sl.sale_id = sb.id
    group by sb.created_by
  ),
  sales_agg as (
    select
      sb.created_by,
      count(*)::int as sale_count,
      coalesce(sum(sb.total), 0)::numeric(12, 2) as revenue,
      coalesce(sum(sb.paid_total), 0)::numeric(12, 2) as paid_total,
      coalesce(sum(sb.unpaid), 0)::numeric(12, 2) as unpaid_total,
      case
        when count(*) > 0 then round(coalesce(sum(sb.total), 0) / count(*), 2)
        else 0
      end::numeric(12, 2) as avg_ticket
    from sales_base sb
    group by sb.created_by
  ),
  appt_agg as (
    select
      a.created_by,
      count(*)::int as appointments_booked,
      count(*) filter (where a.status = 'completed')::int as appointments_completed,
      count(*) filter (where a.status = 'no_show')::int as appointments_no_show,
      count(*) filter (where a.status = 'cancelled')::int as appointments_cancelled,
      count(*) filter (
        where a.status in ('scheduled', 'confirmed')
      )::int as appointments_open
    from dental.appointments a
    where a.start_at >= v_start
      and a.start_at <= v_end
      and (p_branch_id is null or a.branch_id = p_branch_id)
    group by a.created_by
  ),
  staff_ids as (
    select created_by from sales_agg
    union
    select created_by from appt_agg
  ),
  ranked as (
    select
      row_number() over (
        order by coalesce(sa.revenue, 0) desc, coalesce(aa.appointments_booked, 0) desc
      )::int as rank,
      sid.created_by as staff_id,
      case
        when sid.created_by is null then 'Unassigned'
        else coalesce(
          nullif(trim(p.display_name), ''),
          nullif(split_part(u.email, '@', 1), ''),
          sid.created_by::text
        )
      end as staff_name,
      coalesce(p.role::text, null) as staff_role,
      coalesce(u.email, null) as staff_email,
      coalesce(sa.sale_count, 0) as sale_count,
      coalesce(sa.revenue, 0) as revenue,
      coalesce(sa.paid_total, 0) as paid_total,
      coalesce(sa.unpaid_total, 0) as unpaid_total,
      coalesce(sa.avg_ticket, 0) as avg_ticket,
      coalesce(sla.items_net, 0) as items_net,
      coalesce(sla.services_net, 0) as services_net,
      coalesce(aa.appointments_booked, 0) as appointments_booked,
      coalesce(aa.appointments_completed, 0) as appointments_completed,
      coalesce(aa.appointments_no_show, 0) as appointments_no_show,
      coalesce(aa.appointments_cancelled, 0) as appointments_cancelled,
      coalesce(aa.appointments_open, 0) as appointments_open
    from staff_ids sid
    left join sales_agg sa on sa.created_by is not distinct from sid.created_by
    left join sale_lines_agg sla on sla.created_by is not distinct from sid.created_by
    left join appt_agg aa on aa.created_by is not distinct from sid.created_by
    left join dental.profiles p on p.id = sid.created_by
    left join auth.users u on u.id = sid.created_by
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rank', r.rank,
        'staff_name', r.staff_name,
        'staff_role', r.staff_role,
        'sale_count', r.sale_count,
        'revenue', r.revenue,
        'paid_total', r.paid_total,
        'unpaid_total', r.unpaid_total,
        'avg_ticket', r.avg_ticket,
        'items_net', r.items_net,
        'services_net', r.services_net,
        'appointments_booked', r.appointments_booked,
        'appointments_completed', r.appointments_completed,
        'appointments_no_show', r.appointments_no_show,
        'appointments_cancelled', r.appointments_cancelled,
        'appointments_open', r.appointments_open
      )
      order by r.rank
    ),
    '[]'::jsonb
  )
  into v_rows
  from ranked r;

  select jsonb_build_object(
    'staff_count', coalesce(jsonb_array_length(v_rows), 0),
    'sale_count', coalesce(sum((row->>'sale_count')::int), 0),
    'revenue', coalesce(sum((row->>'revenue')::numeric), 0),
    'paid_total', coalesce(sum((row->>'paid_total')::numeric), 0),
    'unpaid_total', coalesce(sum((row->>'unpaid_total')::numeric), 0),
    'avg_ticket',
      case
        when coalesce(sum((row->>'sale_count')::int), 0) > 0
        then round(
          coalesce(sum((row->>'revenue')::numeric), 0)
          / sum((row->>'sale_count')::int),
          2
        )
        else 0
      end,
    'items_net', coalesce(sum((row->>'items_net')::numeric), 0),
    'services_net', coalesce(sum((row->>'services_net')::numeric), 0),
    'appointments_booked', coalesce(sum((row->>'appointments_booked')::int), 0),
    'appointments_completed', coalesce(sum((row->>'appointments_completed')::int), 0),
    'appointments_no_show', coalesce(sum((row->>'appointments_no_show')::int), 0),
    'appointments_cancelled', coalesce(sum((row->>'appointments_cancelled')::int), 0),
    'appointments_open', coalesce(sum((row->>'appointments_open')::int), 0)
  )
  into v_totals
  from jsonb_array_elements(v_rows) as row;

  return jsonb_build_object(
    'report', 'staff_performance',
    'period', v_period,
    'starts_at', v_start,
    'ends_at', v_end,
    'totals', coalesce(v_totals, '{}'::jsonb),
    'rows', coalesce(v_rows, '[]'::jsonb),
    'note',
      'Sales attributed by checkout user (created_by). Appointments attributed by booking user; status counts use appointment start time in the selected period.'
  );
end;
$$;

revoke all on function dental.staff_performance_report(uuid, text, date, date) from public;
grant execute on function dental.staff_performance_report(uuid, text, date, date) to authenticated, service_role;
