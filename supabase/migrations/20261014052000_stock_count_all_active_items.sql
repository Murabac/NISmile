-- Stock counts include every active catalog item (system qty 0 if never stocked).

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

  insert into dental.stock_count_lines (stock_count_id, item_id, system_qty)
  select
    v_id,
    i.id,
    coalesce((
      select sum(b.qty_remaining)
      from dental.stock_batches b
      where b.branch_id = p_branch_id
        and b.item_id = i.id
    ), 0)
  from dental.items i
  where i.active;

  if not exists (
    select 1 from dental.stock_count_lines where stock_count_id = v_id
  ) then
    delete from dental.stock_counts where id = v_id;
    raise exception 'No active items to count';
  end if;

  return v_id;
end;
$$;

revoke all on function dental.create_stock_count(uuid, text) from public;
grant execute on function dental.create_stock_count(uuid, text) to authenticated, service_role;
