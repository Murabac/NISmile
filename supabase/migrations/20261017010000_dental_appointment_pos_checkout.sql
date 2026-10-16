-- Link a POS sale to an appointment and mark the visit completed.
-- Payment / cart (service + products + tenders) happens in checkout_sale;
-- this only attaches the sale after a successful POS checkout.

create or replace function dental.link_appointment_sale(
  p_appointment_id uuid,
  p_sale_id uuid
)
returns void
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_apt dental.appointments%rowtype;
  v_sale dental.sales%rowtype;
begin
  if p_appointment_id is null then
    raise exception 'Appointment is required';
  end if;
  if p_sale_id is null then
    raise exception 'Sale is required';
  end if;

  select * into v_apt from dental.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if auth.uid() is not null then
    if not dental.can_manage_appointments() and not dental.is_owner() then
      raise exception 'Not allowed to complete appointments';
    end if;
    if not dental.is_owner() and v_apt.branch_id not in (select dental.user_branch_ids()) then
      raise exception 'Branch access denied';
    end if;
  end if;

  if v_apt.status not in ('scheduled', 'confirmed') then
    raise exception 'Only scheduled or confirmed appointments can be checked out';
  end if;
  if v_apt.sale_id is not null then
    raise exception 'Appointment already has a linked sale';
  end if;

  select * into v_sale from dental.sales where id = p_sale_id;
  if not found then
    raise exception 'Sale not found';
  end if;
  if v_sale.branch_id is distinct from v_apt.branch_id then
    raise exception 'Sale branch does not match appointment';
  end if;
  if v_sale.customer_id is distinct from v_apt.customer_id then
    raise exception 'Sale customer does not match appointment';
  end if;
  if v_sale.status = 'void' then
    raise exception 'Cannot link a void sale';
  end if;

  update dental.appointments
  set
    status = 'completed',
    sale_id = p_sale_id
  where id = p_appointment_id;
end;
$$;

revoke all on function dental.link_appointment_sale(uuid, uuid) from public;
grant execute on function dental.link_appointment_sale(uuid, uuid) to authenticated, service_role;
