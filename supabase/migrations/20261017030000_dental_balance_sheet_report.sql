-- Operational Balance Sheet report (point-in-time assets / liabilities).
-- No full GL: cash-on-hand and supplier AP are not tracked as ledger accounts.

create or replace function dental.report_balance_sheet(
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
  v_start timestamptz;
  v_end timestamptz;
  v_inventory numeric(12, 2) := 0;
  v_ar numeric(12, 2) := 0;
  v_vat numeric(12, 2) := 0;
  v_loyalty_pts numeric := 0;
  v_usd_per_point numeric;
  v_loyalty_liab numeric(12, 2) := 0;
  v_assets numeric(12, 2);
  v_liab numeric(12, 2);
  v_equity numeric(12, 2);
begin
  perform dental.assert_report_access(p_branch_id);

  select b.starts_at, b.ends_at into v_start, v_end
  from dental.report_period_bounds(p_period) b;

  select coalesce(sum(sb.qty_remaining * sb.unit_cost), 0)
  into v_inventory
  from dental.stock_batches sb
  where sb.qty_remaining > 0
    and (p_branch_id is null or sb.branch_id = p_branch_id);

  select coalesce(sum(s.total - s.paid_total), 0)
  into v_ar
  from dental.sales s
  where s.status = 'partial'
    and (p_branch_id is null or s.branch_id = p_branch_id);

  -- VAT collected in the selected period (remittance not tracked → shown as liability).
  select coalesce(sum(s.tax_total), 0)
  into v_vat
  from dental.sales s
  where s.status <> 'void'
    and s.created_at >= v_start
    and s.created_at <= v_end
    and (p_branch_id is null or s.branch_id = p_branch_id);

  select (dental.get_clinic_settings()).loyalty_usd_per_point
  into v_usd_per_point;

  select coalesce(sum(c.loyalty_points), 0)
  into v_loyalty_pts
  from dental.customers c
  where p_branch_id is null or c.branch_id = p_branch_id;

  if v_usd_per_point is not null and v_usd_per_point > 0 then
    v_loyalty_liab := round(v_loyalty_pts * v_usd_per_point, 2);
  else
    v_loyalty_liab := 0;
  end if;

  v_assets := round(v_inventory + v_ar, 2);
  v_liab := round(v_vat + v_loyalty_liab, 2);
  v_equity := round(v_assets - v_liab, 2);

  return jsonb_build_object(
    'report', 'balance_sheet',
    'period', p_period,
    'starts_at', v_start,
    'ends_at', v_end,
    'totals', jsonb_build_object(
      'inventory', v_inventory,
      'accounts_receivable', v_ar,
      'total_assets', v_assets,
      'vat_liability', v_vat,
      'loyalty_liability', v_loyalty_liab,
      'total_liabilities', v_liab,
      'equity_net_position', v_equity
    ),
    'note',
      'Point-in-time inventory and AR. VAT liability uses tax collected in the selected period (remittance not tracked). '
      || 'Loyalty liability uses outstanding points × Settings redeem rate when set. '
      || 'Cash-on-hand and supplier payables are not tracked as ledger accounts. '
      || 'Equity is assets minus liabilities (net position).',
    'by_branch', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.branch_name)
      from (
        select
          b.id as branch_id,
          b.name as branch_name,
          coalesce((
            select sum(sb.qty_remaining * sb.unit_cost)
            from dental.stock_batches sb
            where sb.branch_id = b.id and sb.qty_remaining > 0
          ), 0)::numeric as inventory,
          coalesce((
            select sum(s.total - s.paid_total)
            from dental.sales s
            where s.branch_id = b.id and s.status = 'partial'
          ), 0)::numeric as accounts_receivable,
          coalesce((
            select sum(s.tax_total)
            from dental.sales s
            where s.branch_id = b.id
              and s.status <> 'void'
              and s.created_at >= v_start
              and s.created_at <= v_end
          ), 0)::numeric as vat_liability
        from dental.branches b
        where b.active
          and (p_branch_id is null or b.id = p_branch_id)
      ) x
    ), '[]'::jsonb),
    'rows', jsonb_build_array(
      jsonb_build_object(
        'section', 'Assets',
        'line', 'Inventory (stock at cost)',
        'amount', v_inventory
      ),
      jsonb_build_object(
        'section', 'Assets',
        'line', 'Accounts receivable (wholesale unpaid)',
        'amount', v_ar
      ),
      jsonb_build_object(
        'section', 'Assets',
        'line', 'Total assets',
        'amount', v_assets
      ),
      jsonb_build_object(
        'section', 'Liabilities',
        'line', 'VAT collected (period)',
        'amount', v_vat
      ),
      jsonb_build_object(
        'section', 'Liabilities',
        'line', 'Loyalty points liability',
        'amount', v_loyalty_liab
      ),
      jsonb_build_object(
        'section', 'Liabilities',
        'line', 'Total liabilities',
        'amount', v_liab
      ),
      jsonb_build_object(
        'section', 'Equity',
        'line', 'Net position (assets − liabilities)',
        'amount', v_equity
      )
    )
  );
end;
$$;

revoke all on function dental.report_balance_sheet(uuid, text) from public;
grant execute on function dental.report_balance_sheet(uuid, text) to authenticated, service_role;

-- Wrap existing run_report so we do not rewrite every report branch.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'dental'
      and p.proname = 'run_report'
      and pg_get_function_identity_arguments(p.oid) = 'p_report_type text, p_branch_id uuid, p_period text'
  ) and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'dental'
      and p.proname = 'run_report_legacy'
  ) then
    alter function dental.run_report(text, uuid, text) rename to run_report_legacy;
  end if;
end $$;

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
begin
  if v_type = 'balance_sheet' then
    return dental.report_balance_sheet(p_branch_id, p_period);
  end if;
  return dental.run_report_legacy(p_report_type, p_branch_id, p_period);
end;
$$;

revoke all on function dental.run_report(text, uuid, text) from public;
grant execute on function dental.run_report(text, uuid, text) to authenticated, service_role;

revoke all on function dental.run_report_legacy(text, uuid, text) from public;
grant execute on function dental.run_report_legacy(text, uuid, text) to authenticated, service_role;
