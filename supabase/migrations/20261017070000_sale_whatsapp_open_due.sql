-- Include this-sale remainder + customer open AR on sale WhatsApp notices.

update dental.message_templates
set
  body_text = E'Dear {{1}},\n\nThank you. Your N.I SMILE receipt #{{2}} totals ${{3}}.\nAmount still due on this sale: ${{4}}.\nYour total open balance: ${{5}}.',
  variables = '["customer_name","receipt_number","amount","sale_due","open_balance"]'::jsonb,
  updated_at = now()
where kind = 'receipt_notice' and language = 'en';

update dental.message_templates
set
  body_text = E'Dear {{1}},\n\nYour N.I SMILE invoice #{{2}} totals ${{3}}.\nAmount still due on this invoice: ${{4}}.\nYour total open balance: ${{5}}.',
  variables = '["customer_name","invoice_number","amount","sale_due","open_balance"]'::jsonb,
  updated_at = now()
where kind = 'invoice_notice' and language = 'en';

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
  v_sale_due numeric(12, 2);
  v_open_balance numeric(12, 2);
  v_params jsonb;
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

  v_sale_due := greatest(coalesce(v_sale.total, 0) - coalesce(v_sale.paid_total, 0), 0)::numeric(12, 2);
  v_open_balance := dental.customer_ar_balance(v_sale.customer_id);

  if v_sale.price_list = 'wholesale' then
    v_kind := 'invoice_notice';
    v_doc := replace(v_sale.receipt_number, 'RCP', 'INV');
  else
    v_kind := 'receipt_notice';
    v_doc := v_sale.receipt_number;
  end if;

  v_params := jsonb_build_object(
    '1', v_customer.name,
    '2', v_doc,
    '3', to_char(v_sale.total, 'FM999999990.00'),
    '4', to_char(v_sale_due, 'FM999999990.00'),
    '5', to_char(v_open_balance, 'FM999999990.00')
  );

  -- Reuse open queue row; refresh params so due/balance stay current.
  select id into v_existing
  from dental.notification_queue
  where related_type = 'sale'
    and related_id = p_sale_id
    and kind in ('receipt_notice', 'invoice_notice')
    and status in ('pending', 'processing')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    update dental.notification_queue
    set params = v_params
    where id = v_existing;
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

  return dental.try_enqueue_notification(
    v_sale.branch_id,
    v_kind,
    null,
    null,
    v_sale.customer_id,
    v_params,
    now(),
    'sale',
    p_sale_id
  );
end;
$$;

revoke all on function dental.notify_sale_document(uuid) from public;
grant execute on function dental.notify_sale_document(uuid) to authenticated, service_role;
