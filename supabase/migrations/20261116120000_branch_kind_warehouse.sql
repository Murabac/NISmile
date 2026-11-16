-- Clinic branches vs warehouse (N.I SMILE Wholesale).
-- Warehouse: stock / transfers / purchases / wholesale buyers + Wholesale Orders.
-- Clinic: POS, appointments, retail patients.

do $$ begin
  create type dental.branch_kind as enum ('clinic', 'warehouse');
exception
  when duplicate_object then null;
end $$;

alter table dental.branches
  add column if not exists kind dental.branch_kind not null default 'clinic';

update dental.branches
set kind = 'warehouse'
where kind = 'clinic'
  and (
    lower(name) like '%wholesale%'
    or lower(name) like '%warehouse%'
  );

-- Wholesale buyers belong on the warehouse branch.
update dental.customers c
set branch_id = b.id
from dental.branches b
where b.kind = 'warehouse'
  and b.active
  and c.customer_type = 'wholesale'
  and c.branch_id <> b.id
  and exists (
    select 1 from dental.branches cb
    where cb.id = c.branch_id and cb.kind = 'clinic'
  );

-- Block appointments on warehouse branches.
create or replace function dental.enforce_clinic_appointments()
returns trigger
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_kind dental.branch_kind;
begin
  select kind into v_kind from dental.branches where id = new.branch_id;
  if v_kind = 'warehouse' then
    raise exception 'Appointments are only on clinic branches';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_clinic_only on dental.appointments;
create trigger appointments_clinic_only
  before insert or update of branch_id on dental.appointments
  for each row
  execute function dental.enforce_clinic_appointments();
