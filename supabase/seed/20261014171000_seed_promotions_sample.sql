-- Sample promotions for step 23. Skips catalog / customers that already exist.
-- Safe to re-run (keyed by promotion codes).

do $$
declare
  v_branch_id uuid;
  v_gloves uuid;
  v_srv1 uuid;
  v_srv2 uuid;
  v_promo_ws uuid;
  v_promo_hyg uuid;
  v_promo_flat uuid;
begin
  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;
  if v_branch_id is null then
    raise exception 'No active branch.';
  end if;

  select id into v_gloves from dental.items where sku = 'CON-GLV-M100' and active;
  select id into v_srv1 from dental.services where code = 'SRV-001' and active;
  select id into v_srv2 from dental.services where code = 'SRV-002' and active;

  -- Wholesale: Buy 10 Get 1 Free on gloves
  select id into v_promo_ws from dental.promotions where code = 'WS-BOX10-FREE1';
  if v_promo_ws is null then
    insert into dental.promotions (
      code, name, description, promo_type, audience, scope,
      buy_qty, get_qty, starts_at, ends_at, status,
      notify_whatsapp, whatsapp_message_en, whatsapp_message_so, whatsapp_message_ar,
      published_at
    )
    values (
      'WS-BOX10-FREE1',
      'Wholesale: Buy 10 Boxes, Get 1 Free',
      'Automatic complimentary box on qualifying bulk glove orders.',
      'buy_x_get_y',
      'wholesale',
      'items',
      10,
      1,
      timestamptz '2026-10-01 00:00:00+03',
      timestamptz '2026-11-30 23:59:59+03',
      'active',
      true,
      'Wholesale Special: Buy 10 boxes of clinical consumables and receive 1 box completely FREE! Valid until Nov 30.',
      'Dalab gaar ah oo Jumlo ah: Iibso 10 sanduuq oo qalabka ilkaha ah, waxaadna helaysaa 1 sanduuq oo BILAASH ah! Ku habboon rugaha iyo farmasiyada.',
      'عرض خاص لعملاء الجملة: اشترِ 10 علب من المستلزمات الطبية واحصل على علبة واحدة مجاناً! العرض سارٍ حتى 30 نوفمبر.',
      now()
    )
    returning id into v_promo_ws;

    if v_gloves is not null then
      insert into dental.promotion_targets (promotion_id, target_kind, item_id)
      values (v_promo_ws, 'item', v_gloves);
    end if;
  end if;

  -- Retail hygiene 15% on cleaning / whitening services
  select id into v_promo_hyg from dental.promotions where code = 'RETAIL-HYG-15';
  if v_promo_hyg is null then
    insert into dental.promotions (
      code, name, description, promo_type, audience, scope,
      percent_off, starts_at, ends_at, status,
      notify_whatsapp, whatsapp_message_en, whatsapp_message_so, whatsapp_message_ar,
      published_at
    )
    values (
      'RETAIL-HYG-15',
      'Dental Hygiene Month - 15% Off Cleaning & Whitening',
      '15% discount at checkout on scaling, polishing and in-clinic whitening.',
      'percentage',
      'retail',
      'services',
      15,
      timestamptz '2026-10-05 00:00:00+03',
      timestamptz '2026-10-31 23:59:59+03',
      'active',
      true,
      'Smile brighter this month! Enjoy 15% off professional dental cleaning and laser whitening at N.I SMILE Oral care & Teeth whitening.',
      'Bisha Nadaafadda Ilkaha! Ka faa''iidayso 15% qiimo dhimis ah nadiifinta iyo caddaynta ilkaha ee N.I SMILE Oral care & Teeth whitening.',
      'شهر صحة الفم والأسنان! استمتع بخصم 15% على تنظيف وتبييض الأسنان لدى N.I SMILE Oral care & Teeth whitening.',
      now()
    )
    returning id into v_promo_hyg;

    if v_srv1 is not null then
      insert into dental.promotion_targets (promotion_id, target_kind, service_id)
      values (v_promo_hyg, 'service', v_srv1);
    end if;
    if v_srv2 is not null then
      insert into dental.promotion_targets (promotion_id, target_kind, service_id)
      values (v_promo_hyg, 'service', v_srv2);
    end if;
  end if;

  -- Fixed $7 off consultation-style services (invoice scope retail)
  select id into v_promo_flat from dental.promotions where code = 'CHECKUP-FLAT18';
  if v_promo_flat is null then
    insert into dental.promotions (
      code, name, description, promo_type, audience, scope,
      amount_off, starts_at, ends_at, status,
      notify_whatsapp, whatsapp_message_en, whatsapp_message_so, whatsapp_message_ar,
      published_at
    )
    values (
      'CHECKUP-FLAT18',
      'Student & Senior Check-up Package ($7 Off)',
      'Fixed amount off diagnostic consultation services at checkout.',
      'fixed_amount',
      'retail',
      'services',
      7,
      timestamptz '2026-09-15 00:00:00+03',
      timestamptz '2026-12-31 23:59:59+03',
      'active',
      false,
      'Special consultation discount now available at N.I SMILE Oral care & Teeth whitening.',
      'Qiimo dhimis baaritaan ilko ah ee N.I SMILE Oral care & Teeth whitening.',
      'خصم خاص على الاستشارة لدى N.I SMILE Oral care & Teeth whitening.',
      now()
    )
    returning id into v_promo_flat;

    if v_srv1 is not null then
      insert into dental.promotion_targets (promotion_id, target_kind, service_id)
      values (v_promo_flat, 'service', v_srv1);
    end if;

    -- Limit to main branch only (owner picks branches)
    insert into dental.promotion_branches (promotion_id, branch_id)
    values (v_promo_flat, v_branch_id);
  end if;
end $$;
