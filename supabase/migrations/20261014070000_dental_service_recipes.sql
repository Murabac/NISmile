-- DentaFlow service recipes: optional materials consumed per procedure.
-- Completing a service (POS / appointments later) calls apply_service_recipe → FEFO service_usage.

create table dental.service_recipes (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references dental.services (id) on delete cascade,
  item_id uuid not null references dental.items (id),
  qty numeric(12, 2) not null check (qty > 0),
  created_at timestamptz not null default now(),
  unique (service_id, item_id)
);

create index service_recipes_service_id_idx on dental.service_recipes (service_id);
create index service_recipes_item_id_idx on dental.service_recipes (item_id);

alter table dental.service_recipes enable row level security;

create policy service_recipes_select
on dental.service_recipes
for select
to authenticated
using (true);

create policy service_recipes_write
on dental.service_recipes
for all
to authenticated
using (dental.can_manage_services())
with check (dental.can_manage_services());

grant select, insert, update, delete on dental.service_recipes to authenticated, service_role;

-- Deduct every recipe line at a branch via FEFO (movement type service_usage).
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
  v_count integer := 0;
begin
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if p_service_id is null then
    raise exception 'Service is required';
  end if;

  -- auth.uid() is null when run from SQL editor / service role seeds.
  if auth.uid() is not null then
    if dental.is_owner() then
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
    v_count := v_count + 1;
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

  if v_count = 0 then
    raise exception 'Service % has no recipe lines', v_service.code;
  end if;
end;
$$;

revoke all on function dental.apply_service_recipe(uuid, uuid, text, uuid) from public;
grant execute on function dental.apply_service_recipe(uuid, uuid, text, uuid) to authenticated, service_role;
