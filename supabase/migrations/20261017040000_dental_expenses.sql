-- Branch operating expenses + expense / P&L reports.
-- Expenses are per branch. Categories are shared. Tenders match checkout.

do $$ begin
  create type dental.expense_status as enum ('posted', 'void');
exception when duplicate_object then null;
end $$;

create table if not exists dental.expense_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists dental.expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  category_id uuid not null references dental.expense_categories (id),
  expense_number text not null unique,
  expense_date date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  tender dental.payment_tender not null,
  payee text,
  reference text,
  notes text,
  status dental.expense_status not null default 'posted',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  voided_by uuid references auth.users (id),
  voided_at timestamptz
);

create index if not exists expenses_branch_date_idx
  on dental.expenses (branch_id, expense_date desc);
create index if not exists expenses_category_idx
  on dental.expenses (category_id);
create index if not exists expenses_status_idx
  on dental.expenses (status);

insert into dental.expense_categories (code, name, sort_order)
values
  ('rent', 'Rent', 10),
  ('utilities', 'Utilities', 20),
  ('salaries', 'Salaries & wages', 30),
  ('supplies', 'Clinic supplies (non-stock)', 40),
  ('marketing', 'Marketing', 50),
  ('transport', 'Transport', 60),
  ('maintenance', 'Maintenance & repairs', 70),
  ('professional', 'Professional fees', 80),
  ('bank', 'Bank & mobile money fees', 90),
  ('other', 'Other', 100)
on conflict (code) do nothing;

create or replace function dental.can_manage_expenses()
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

revoke all on function dental.can_manage_expenses() from public;
grant execute on function dental.can_manage_expenses() to authenticated;

create or replace function dental.next_expense_number()
returns text
language plpgsql
security definer
set search_path = dental
as $$
declare
  today text := to_char(timezone('utc', now()), 'YYYYMMDD');
  seq integer;
begin
  select count(*)::integer + 1
  into seq
  from dental.expenses
  where expense_number like 'EXP-' || today || '-%';

  return 'EXP-' || today || '-' || lpad(seq::text, 3, '0');
end;
$$;

revoke all on function dental.next_expense_number() from public;
grant execute on function dental.next_expense_number() to authenticated, service_role;

create or replace function dental.create_expense(
  p_branch_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_tender text,
  p_expense_date date default current_date,
  p_payee text default null,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_id uuid;
  v_tender dental.payment_tender;
  v_cat dental.expense_categories%rowtype;
begin
  if auth.uid() is not null then
    if not dental.can_manage_expenses() and not dental.is_owner() then
      raise exception 'Not allowed to record expenses';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_cat from dental.expense_categories where id = p_category_id and active;
  if v_cat.id is null then
    raise exception 'Expense category not found or inactive';
  end if;

  begin
    v_tender := lower(trim(p_tender))::dental.payment_tender;
  exception when others then
    raise exception 'Invalid tender %', p_tender;
  end;

  insert into dental.expenses (
    branch_id, category_id, expense_number, expense_date, amount, tender,
    payee, reference, notes, status, created_by
  )
  values (
    p_branch_id,
    p_category_id,
    dental.next_expense_number(),
    coalesce(p_expense_date, current_date),
    round(p_amount, 2),
    v_tender,
    nullif(trim(coalesce(p_payee, '')), ''),
    nullif(trim(coalesce(p_reference, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    'posted',
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function dental.create_expense(uuid, uuid, numeric, text, date, text, text, text) from public;
grant execute on function dental.create_expense(uuid, uuid, numeric, text, date, text, text, text) to authenticated, service_role;

create or replace function dental.void_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.expenses%rowtype;
begin
  if auth.uid() is not null then
    if not dental.can_manage_expenses() and not dental.is_owner() then
      raise exception 'Not allowed to void expenses';
    end if;
  end if;

  select * into v_row from dental.expenses where id = p_expense_id for update;
  if v_row.id is null then
    raise exception 'Expense not found';
  end if;
  if auth.uid() is not null
    and not dental.is_owner()
    and v_row.branch_id not in (select dental.user_branch_ids())
  then
    raise exception 'Branch access denied';
  end if;
  if v_row.status = 'void' then
    raise exception 'Expense is already void';
  end if;

  update dental.expenses
  set
    status = 'void',
    voided_by = auth.uid(),
    voided_at = now()
  where id = p_expense_id;
end;
$$;

revoke all on function dental.void_expense(uuid) from public;
grant execute on function dental.void_expense(uuid) to authenticated, service_role;

alter table dental.expense_categories enable row level security;
alter table dental.expenses enable row level security;

drop policy if exists expense_categories_select on dental.expense_categories;
create policy expense_categories_select
on dental.expense_categories for select to authenticated
using (true);

drop policy if exists expense_categories_write on dental.expense_categories;
create policy expense_categories_write
on dental.expense_categories for all to authenticated
using (dental.is_owner())
with check (dental.is_owner());

drop policy if exists expenses_select on dental.expenses;
create policy expenses_select
on dental.expenses for select to authenticated
using (dental.is_owner() or branch_id in (select dental.user_branch_ids()));

drop policy if exists expenses_insert on dental.expenses;
create policy expenses_insert
on dental.expenses for insert to authenticated
with check (
  dental.can_manage_expenses()
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

drop policy if exists expenses_update on dental.expenses;
create policy expenses_update
on dental.expenses for update to authenticated
using (
  dental.can_manage_expenses()
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
)
with check (
  dental.can_manage_expenses()
  and (dental.is_owner() or branch_id in (select dental.user_branch_ids()))
);

grant select on dental.expense_categories to authenticated, service_role;
grant select, insert, update on dental.expenses to authenticated, service_role;
grant usage on type dental.expense_status to authenticated, service_role;

-- Expenses report (period).
create or replace function dental.report_expenses(
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
begin
  perform dental.assert_report_access(p_branch_id);

  select b.starts_at, b.ends_at into v_start, v_end
  from dental.report_period_bounds(p_period) b;

  return jsonb_build_object(
    'report', 'expenses',
    'period', p_period,
    'starts_at', v_start,
    'ends_at', v_end,
    'totals', (
      select jsonb_build_object(
        'expense_count', count(*)::integer,
        'total_amount', coalesce(sum(e.amount), 0),
        'cash', coalesce(sum(e.amount) filter (where e.tender = 'cash'), 0),
        'zaad', coalesce(sum(e.amount) filter (where e.tender = 'zaad'), 0),
        'edahab', coalesce(sum(e.amount) filter (where e.tender = 'edahab'), 0),
        'mycash', coalesce(sum(e.amount) filter (where e.tender = 'mycash'), 0)
      )
      from dental.expenses e
      where e.status = 'posted'
        and e.expense_date >= (v_start at time zone 'UTC')::date
        and e.expense_date <= (v_end at time zone 'UTC')::date
        and (p_branch_id is null or e.branch_id = p_branch_id)
    ),
    'by_branch', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.branch_name)
      from (
        select
          b.name as branch_name,
          count(e.id)::integer as expense_count,
          coalesce(sum(e.amount), 0)::numeric as total_amount
        from dental.branches b
        left join dental.expenses e
          on e.branch_id = b.id
         and e.status = 'posted'
         and e.expense_date >= (v_start at time zone 'UTC')::date
         and e.expense_date <= (v_end at time zone 'UTC')::date
         and (p_branch_id is null or e.branch_id = p_branch_id)
        where b.active and (p_branch_id is null or b.id = p_branch_id)
        group by b.name
      ) x
    ), '[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(row_to_json(r)::jsonb)
      from (
        select
          c.code as category_code,
          c.name as category_name,
          count(e.id)::integer as expense_count,
          coalesce(sum(e.amount), 0)::numeric as total_amount
        from dental.expense_categories c
        left join dental.expenses e
          on e.category_id = c.id
         and e.status = 'posted'
         and e.expense_date >= (v_start at time zone 'UTC')::date
         and e.expense_date <= (v_end at time zone 'UTC')::date
         and (p_branch_id is null or e.branch_id = p_branch_id)
        where c.active or exists (
          select 1 from dental.expenses e2
          where e2.category_id = c.id
            and e2.status = 'posted'
            and e2.expense_date >= (v_start at time zone 'UTC')::date
            and e2.expense_date <= (v_end at time zone 'UTC')::date
            and (p_branch_id is null or e2.branch_id = p_branch_id)
        )
        group by c.code, c.name, c.sort_order
        having count(e.id) > 0
        order by c.sort_order, c.name
      ) r
    ), '[]'::jsonb),
    'note', 'Posted expenses only. Voided rows are excluded.'
  );
end;
$$;

revoke all on function dental.report_expenses(uuid, text) from public;
grant execute on function dental.report_expenses(uuid, text) to authenticated, service_role;

-- Profit & loss: sales revenue − est. COGS − operating expenses.
create or replace function dental.report_pnl(
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
  v_revenue numeric(12, 2) := 0;
  v_cogs numeric(12, 2) := 0;
  v_expenses numeric(12, 2) := 0;
  v_gross numeric(12, 2);
  v_operating numeric(12, 2);
begin
  perform dental.assert_report_access(p_branch_id);

  select b.starts_at, b.ends_at into v_start, v_end
  from dental.report_period_bounds(p_period) b;

  select
    coalesce(sum(sl.line_net), 0),
    coalesce(sum(
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
  into v_revenue, v_cogs
  from dental.sale_lines sl
  join dental.sales s on s.id = sl.sale_id
  left join dental.items i on i.id = sl.item_id
  where s.status <> 'void'
    and s.created_at >= v_start
    and s.created_at <= v_end
    and (p_branch_id is null or s.branch_id = p_branch_id);

  select coalesce(sum(e.amount), 0)
  into v_expenses
  from dental.expenses e
  where e.status = 'posted'
    and e.expense_date >= (v_start at time zone 'UTC')::date
    and e.expense_date <= (v_end at time zone 'UTC')::date
    and (p_branch_id is null or e.branch_id = p_branch_id);

  v_gross := round(v_revenue - v_cogs, 2);
  v_operating := round(v_gross - v_expenses, 2);

  return jsonb_build_object(
    'report', 'pnl',
    'period', p_period,
    'starts_at', v_start,
    'ends_at', v_end,
    'totals', jsonb_build_object(
      'revenue_ex_vat', v_revenue,
      'estimated_cogs', v_cogs,
      'gross_profit', v_gross,
      'operating_expenses', v_expenses,
      'operating_profit', v_operating
    ),
    'rows', jsonb_build_array(
      jsonb_build_object('section', 'Income', 'line', 'Revenue (ex-VAT)', 'amount', v_revenue),
      jsonb_build_object('section', 'Income', 'line', 'Estimated COGS', 'amount', v_cogs),
      jsonb_build_object('section', 'Income', 'line', 'Gross profit', 'amount', v_gross),
      jsonb_build_object('section', 'Expenses', 'line', 'Operating expenses', 'amount', v_expenses),
      jsonb_build_object('section', 'Result', 'line', 'Operating profit', 'amount', v_operating)
    ),
    'by_branch', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.branch_name)
      from (
        select
          b.name as branch_name,
          coalesce((
            select sum(sl.line_net)
            from dental.sale_lines sl
            join dental.sales s on s.id = sl.sale_id
            where s.branch_id = b.id
              and s.status <> 'void'
              and s.created_at >= v_start
              and s.created_at <= v_end
          ), 0)::numeric as revenue_ex_vat,
          coalesce((
            select sum(e.amount)
            from dental.expenses e
            where e.branch_id = b.id
              and e.status = 'posted'
              and e.expense_date >= (v_start at time zone 'UTC')::date
              and e.expense_date <= (v_end at time zone 'UTC')::date
          ), 0)::numeric as operating_expenses
        from dental.branches b
        where b.active and (p_branch_id is null or b.id = p_branch_id)
      ) x
    ), '[]'::jsonb),
    'note',
      'Revenue and COGS match the profit report (average batch cost). '
      || 'Operating expenses are posted branch expenses in the period. '
      || 'This is not a full statutory P&L.'
  );
end;
$$;

revoke all on function dental.report_pnl(uuid, text) from public;
grant execute on function dental.report_pnl(uuid, text) to authenticated, service_role;

-- Ensure legacy runner exists, then extend the dispatcher.
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'dental' and p.proname = 'run_report_legacy'
  ) and exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'dental'
      and p.proname = 'run_report'
      and pg_get_function_identity_arguments(p.oid) = 'p_report_type text, p_branch_id uuid, p_period text'
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
  if v_type = 'expenses' then
    return dental.report_expenses(p_branch_id, p_period);
  end if;
  if v_type in ('pnl', 'profit_loss', 'pl') then
    return dental.report_pnl(p_branch_id, p_period);
  end if;
  return dental.run_report_legacy(p_report_type, p_branch_id, p_period);
end;
$$;

revoke all on function dental.run_report(text, uuid, text) from public;
grant execute on function dental.run_report(text, uuid, text) to authenticated, service_role;
