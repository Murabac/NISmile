-- Custom date range for reports: optional p_from_date / p_to_date on run_report.
-- Nested report_period_bounds reads a transaction-local GUC so legacy report branches pick it up.

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
  v_custom_start text;
  v_custom_end text;
begin
  v_custom_start := nullif(current_setting('dental.report_custom_start', true), '');
  v_custom_end := nullif(current_setting('dental.report_custom_end', true), '');

  if v_custom_start is not null and v_custom_end is not null then
    return query
    select v_custom_start::timestamptz, v_custom_end::timestamptz;
    return;
  end if;

  if v_period = 'today' then
    v_start := date_trunc('day', v_now);
  elsif v_period = '7d' then
    v_start := v_now - interval '7 days';
  elsif v_period = '30d' then
    v_start := v_now - interval '30 days';
  elsif v_period = 'ytd' then
    v_start := date_trunc('year', v_now);
  elsif v_period = 'custom' then
    raise exception 'Custom period requires from and to dates';
  else
    -- mtd default
    v_start := date_trunc('month', v_now);
  end if;

  return query select v_start, v_now;
end;
$$;

revoke all on function dental.report_period_bounds(text) from public;
grant execute on function dental.report_period_bounds(text) to authenticated, service_role;

-- Replace 3-arg runner with date-range-aware signature.
drop function if exists dental.run_report(text, uuid, text);

create or replace function dental.run_report(
  p_report_type text,
  p_branch_id uuid default null,
  p_period text default 'mtd',
  p_from_date date default null,
  p_to_date date default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = dental
as $$
declare
  v_type text := lower(trim(coalesce(p_report_type, 'sales')));
  v_period text := lower(trim(coalesce(p_period, 'mtd')));
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_from_date is not null or p_to_date is not null or v_period = 'custom' then
    if p_from_date is null or p_to_date is null then
      raise exception 'Custom range needs both from and to dates';
    end if;
    if p_to_date < p_from_date then
      raise exception 'To date must be on or after from date';
    end if;
    -- Inclusive calendar days in UTC.
    v_start := p_from_date::timestamp AT TIME ZONE 'UTC';
    v_end := (p_to_date + 1)::timestamp AT TIME ZONE 'UTC' - interval '1 microsecond';
    perform set_config('dental.report_custom_start', v_start::text, true);
    perform set_config('dental.report_custom_end', v_end::text, true);
    v_period := 'custom';
  else
    perform set_config('dental.report_custom_start', '', true);
    perform set_config('dental.report_custom_end', '', true);
  end if;

  if v_type = 'balance_sheet' then
    return dental.report_balance_sheet(p_branch_id, v_period);
  end if;
  if v_type = 'expenses' then
    return dental.report_expenses(p_branch_id, v_period);
  end if;
  if v_type in ('pnl', 'profit_loss', 'pl') then
    return dental.report_pnl(p_branch_id, v_period);
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'dental' and p.proname = 'run_report_legacy'
  ) then
    raise exception 'run_report_legacy is missing; apply reports migrations in order';
  end if;

  return dental.run_report_legacy(p_report_type, p_branch_id, v_period);
end;
$$;

revoke all on function dental.run_report(text, uuid, text, date, date) from public;
grant execute on function dental.run_report(text, uuid, text, date, date) to authenticated, service_role;
