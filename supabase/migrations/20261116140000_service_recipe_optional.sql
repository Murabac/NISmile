-- Service recipes are optional. Selling a service with no materials is a no-op
-- (do not raise). Stock is only deducted when recipe lines exist.

create or replace function dental.apply_service_recipe(
  p_branch_id uuid,
  p_service_id uuid,
  p_ref_type text default null,
  p_ref_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_service dental.services%rowtype;
  v_line dental.service_recipes%rowtype;
begin
  if auth.uid() is not null then
    if exists (
      select 1 from dental.profiles where user_id = auth.uid() and role = 'owner'
    ) then
      null;
    elsif exists (select 1 from dental.profiles where user_id = auth.uid())
      and p_branch_id in (select dental.user_branch_ids()) then
      null;
    else
      raise exception 'Branch access denied';
    end if;
  end if;

  select * into v_service from dental.services where id = p_service_id;
  if v_service.id is null then
    raise exception 'Service not found';
  end if;
  if not v_service.active then
    raise exception 'Service is inactive';
  end if;

  for v_line in
    select *
    from dental.service_recipes
    where service_id = p_service_id
    order by created_at
  loop
    perform dental.deduct_stock_fefo(
      p_branch_id,
      v_line.item_id,
      v_line.qty,
      'service_usage',
      coalesce(p_ref_type, 'service'),
      coalesce(p_ref_id, p_service_id),
      'Recipe: ' || v_service.code
    );
  end loop;
  -- Empty recipe: intentional no-op (services may be fee-only with no stock use).
end;
$$;

revoke all on function dental.apply_service_recipe(uuid, uuid, text, uuid) from public;
grant execute on function dental.apply_service_recipe(uuid, uuid, text, uuid) to authenticated, service_role;
