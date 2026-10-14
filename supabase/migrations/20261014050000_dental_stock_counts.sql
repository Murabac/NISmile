-- DentaFlow stock count sessions.
-- Draft session snapshots system qty; complete writes adjust_stock for variances.

do $$ begin
  create type dental.stock_count_status as enum (
    'draft',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists dental.stock_counts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references dental.branches (id),
  status dental.stock_count_status not null default 'draft',
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists dental.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  stock_count_id uuid not null references dental.stock_counts (id) on delete cascade,
  item_id uuid not null references dental.items (id),
  system_qty numeric(12, 2) not null check (system_qty >= 0),
  counted_qty numeric(12, 2) check (counted_qty is null or counted_qty >= 0),
  created_at timestamptz not null default now(),
  unique (stock_count_id, item_id)
);

create index if not exists stock_counts_branch_idx on dental.stock_counts (branch_id);
create index if not exists stock_count_lines_count_idx on dental.stock_count_lines (stock_count_id);

create or replace function dental.create_stock_count(
  p_branch_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_id uuid;
  v_open integer;
begin
  if auth.uid() is not null then
    if not dental.can_manage_stock() and not dental.is_owner() then
      raise exception 'Not allowed to start a stock count';
    end if;
    if not dental.is_owner() and p_branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  select count(*) into v_open
  from dental.stock_counts
  where branch_id = p_branch_id
    and status = 'draft';

  if v_open > 0 then
    raise exception 'Finish or cancel the open stock count first';
  end if;

  insert into dental.stock_counts (branch_id, status, notes, created_by)
  values (p_branch_id, 'draft', p_notes, auth.uid())
  returning id into v_id;

  -- Snapshot items that have (or had) batches at this branch.
  insert into dental.stock_count_lines (stock_count_id, item_id, system_qty)
  select
    v_id,
    b.item_id,
    coalesce(sum(b.qty_remaining), 0)
  from dental.stock_batches b
  where b.branch_id = p_branch_id
  group by b.item_id;

  if not exists (
    select 1 from dental.stock_count_lines where stock_count_id = v_id
  ) then
    delete from dental.stock_counts where id = v_id;
    raise exception 'No stocked items at this branch to count';
  end if;

  return v_id;
end;
$$;

revoke all on function dental.create_stock_count(uuid, text) from public;
grant execute on function dental.create_stock_count(uuid, text) to authenticated, service_role;

create or replace function dental.save_stock_count_lines(
  p_stock_count_id uuid,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_count dental.stock_counts%rowtype;
  v_line jsonb;
  v_line_id uuid;
  v_qty numeric(12, 2);
begin
  if auth.uid() is not null then
    if not dental.can_manage_stock() and not dental.is_owner() then
      raise exception 'Not allowed to edit stock counts';
    end if;
  end if;

  select * into v_count
  from dental.stock_counts
  where id = p_stock_count_id
  for update;

  if not found then
    raise exception 'Stock count not found';
  end if;

  if v_count.status <> 'draft' then
    raise exception 'Only draft counts can be edited';
  end if;

  if auth.uid() is not null
     and not dental.is_owner()
     and v_count.branch_id not in (select dental.user_branch_ids()) then
    raise exception 'Branch access denied';
  end if;

  if p_lines is null then
    return;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_id := (v_line->>'line_id')::uuid;
    if v_line ? 'counted_qty' and nullif(v_line->>'counted_qty', '') is null then
      v_qty := null;
    else
      v_qty := (v_line->>'counted_qty')::numeric;
    end if;

    if v_qty is not null and v_qty < 0 then
      raise exception 'Counted quantity cannot be negative';
    end if;

    update dental.stock_count_lines
    set counted_qty = v_qty
    where id = v_line_id
      and stock_count_id = v_count.id;
  end loop;
end;
$$;

revoke all on function dental.save_stock_count_lines(uuid, jsonb) from public;
grant execute on function dental.save_stock_count_lines(uuid, jsonb) to authenticated, service_role;

create or replace function dental.complete_stock_count(p_stock_count_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_count dental.stock_counts%rowtype;
  v_line dental.stock_count_lines%rowtype;
  v_delta numeric(12, 2);
  v_missing integer;
begin
  if auth.uid() is not null then
    if not dental.can_manage_stock() and not dental.is_owner() then
      raise exception 'Not allowed to complete stock counts';
    end if;
  end if;

  select * into v_count
  from dental.stock_counts
  where id = p_stock_count_id
  for update;

  if not found then
    raise exception 'Stock count not found';
  end if;

  if v_count.status <> 'draft' then
    raise exception 'Only draft counts can be completed';
  end if;

  if auth.uid() is not null
     and not dental.is_owner()
     and v_count.branch_id not in (select dental.user_branch_ids()) then
    raise exception 'Branch access denied';
  end if;

  select count(*) into v_missing
  from dental.stock_count_lines
  where stock_count_id = v_count.id
    and counted_qty is null;

  if v_missing > 0 then
    raise exception 'Enter a counted quantity for every line (% remaining)', v_missing;
  end if;

  for v_line in
    select * from dental.stock_count_lines
    where stock_count_id = v_count.id
  loop
    v_delta := v_line.counted_qty - v_line.system_qty;
    if v_delta <> 0 then
      perform dental.adjust_stock(
        v_count.branch_id,
        v_line.item_id,
        v_delta,
        'Count reconciliation',
        'Stock count ' || v_count.id::text,
        null
      );
    end if;
  end loop;

  update dental.stock_counts
  set status = 'completed', completed_at = timezone('utc', now())
  where id = v_count.id;
end;
$$;

revoke all on function dental.complete_stock_count(uuid) from public;
grant execute on function dental.complete_stock_count(uuid) to authenticated, service_role;

create or replace function dental.cancel_stock_count(p_stock_count_id uuid)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_count dental.stock_counts%rowtype;
begin
  if auth.uid() is not null then
    if not dental.can_manage_stock() and not dental.is_owner() then
      raise exception 'Not allowed to cancel stock counts';
    end if;
  end if;

  select * into v_count
  from dental.stock_counts
  where id = p_stock_count_id
  for update;

  if not found then
    raise exception 'Stock count not found';
  end if;

  if v_count.status <> 'draft' then
    raise exception 'Only draft counts can be cancelled';
  end if;

  if auth.uid() is not null
     and not dental.is_owner()
     and v_count.branch_id not in (select dental.user_branch_ids()) then
    raise exception 'Branch access denied';
  end if;

  update dental.stock_counts
  set status = 'cancelled'
  where id = v_count.id;
end;
$$;

revoke all on function dental.cancel_stock_count(uuid) from public;
grant execute on function dental.cancel_stock_count(uuid) to authenticated, service_role;

alter table dental.stock_counts enable row level security;
alter table dental.stock_count_lines enable row level security;

drop policy if exists stock_counts_select on dental.stock_counts;
drop policy if exists stock_count_lines_select on dental.stock_count_lines;

create policy stock_counts_select on dental.stock_counts
for select to authenticated
using (dental.is_owner() or branch_id in (select dental.user_branch_ids()));

create policy stock_count_lines_select on dental.stock_count_lines
for select to authenticated
using (
  exists (
    select 1 from dental.stock_counts c
    where c.id = stock_count_id
      and (dental.is_owner() or c.branch_id in (select dental.user_branch_ids()))
  )
);

grant select on dental.stock_counts to authenticated, service_role;
grant select on dental.stock_count_lines to authenticated, service_role;
grant select, insert, update, delete on dental.stock_counts to service_role;
grant select, insert, update, delete on dental.stock_count_lines to service_role;
grant usage on type dental.stock_count_status to authenticated, service_role;
