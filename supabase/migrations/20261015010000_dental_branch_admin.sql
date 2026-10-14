-- Owner branch admin: safe delete (hard if unused, else deactivate). Block removing last active branch.

create or replace function dental.delete_branch(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_active_count integer;
  v_in_use boolean;
begin
  if auth.uid() is not null and not dental.is_owner() then
    raise exception 'Only the owner can delete branches';
  end if;

  if not exists (select 1 from dental.branches where id = p_branch_id) then
    raise exception 'Branch not found';
  end if;

  select count(*)::integer into v_active_count
  from dental.branches
  where active;

  if exists (
    select 1 from dental.branches where id = p_branch_id and active
  ) and v_active_count <= 1 then
    raise exception 'Cannot remove the last active branch';
  end if;

  v_in_use := exists (select 1 from dental.customers where branch_id = p_branch_id)
    or exists (select 1 from dental.sales where branch_id = p_branch_id)
    or exists (select 1 from dental.stock_batches where branch_id = p_branch_id)
    or exists (select 1 from dental.purchase_orders where branch_id = p_branch_id)
    or exists (select 1 from dental.appointments where branch_id = p_branch_id)
    or exists (
      select 1 from dental.stock_transfers
      where from_branch_id = p_branch_id or to_branch_id = p_branch_id
    )
    or exists (select 1 from dental.user_branches where branch_id = p_branch_id);

  if v_in_use then
    update dental.branches set active = false where id = p_branch_id;
    return jsonb_build_object(
      'id', p_branch_id,
      'mode', 'deactivated',
      'message', 'Branch has data or staff assignments, so it was deactivated instead of deleted.'
    );
  end if;

  delete from dental.branches where id = p_branch_id;
  return jsonb_build_object(
    'id', p_branch_id,
    'mode', 'deleted',
    'message', 'Branch deleted.'
  );
end;
$$;

revoke all on function dental.delete_branch(uuid) from public;
grant execute on function dental.delete_branch(uuid) to authenticated, service_role;
