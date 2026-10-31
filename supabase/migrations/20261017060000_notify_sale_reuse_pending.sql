-- Sale Send WhatsApp: if checkout already queued a pending/processing notice,
-- return that queue id so one-click send processes it instead of skipping.

create or replace function dental.notify_sale_document(p_sale_id uuid)
returns uuid
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_sale dental.sales%rowtype;
  v_customer dental.customers%rowtype;
  v_kind text;
  v_doc text;
  v_existing uuid;
begin
  select * into v_sale from dental.sales where id = p_sale_id;
  if not found or v_sale.customer_id is null then
    return null;
  end if;
  if v_sale.status = 'void' then
    return null;
  end if;

  select * into v_customer from dental.customers where id = v_sale.customer_id;
  if not found or not v_customer.whatsapp_opt_in then
    return null;
  end if;

  -- Reuse open queue row (auto-enqueued on sale insert).
  select id into v_existing
  from dental.notification_queue
  where related_type = 'sale'
    and related_id = p_sale_id
    and kind in ('receipt_notice', 'invoice_notice')
    and status in ('pending', 'processing')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  -- Already delivered — do not enqueue a duplicate.
  if exists (
    select 1 from dental.notification_queue
    where related_type = 'sale'
      and related_id = p_sale_id
      and kind in ('receipt_notice', 'invoice_notice')
      and status = 'sent'
  ) then
    return null;
  end if;

  if v_sale.price_list = 'wholesale' then
    v_kind := 'invoice_notice';
    v_doc := replace(v_sale.receipt_number, 'RCP', 'INV');
  else
    v_kind := 'receipt_notice';
    v_doc := v_sale.receipt_number;
  end if;

  return dental.try_enqueue_notification(
    v_sale.branch_id,
    v_kind,
    null,
    null,
    v_sale.customer_id,
    jsonb_build_object(
      '1', v_customer.name,
      '2', v_doc,
      '3', to_char(v_sale.total, 'FM999999990.00')
    ),
    now(),
    'sale',
    p_sale_id
  );
end;
$$;

revoke all on function dental.notify_sale_document(uuid) from public;
grant execute on function dental.notify_sale_document(uuid) to authenticated, service_role;
