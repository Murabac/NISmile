-- Sample templates (so + ar) and one queued reminder for step 20.
-- Safe to re-run. Does not send via Meta.

do $$
declare
  v_branch_id uuid;
  v_customer_id uuid;
  v_tpl_id uuid;
begin
  -- Utility templates: Somali + Arabic for each kind.
  insert into dental.message_templates (
    kind, language, name, category, body_text, variables, status
  )
  values
  (
    'appointment_confirmation', 'so',
    'Appointment confirmation (Somali)', 'utility',
    E'Mudane/Marwo {{1}},\n\nBallantaada ilkaha ee N.I SMILE Oral care & Teeth whitening waa la qabtay.\nTaariikhda: {{2}} saacadda {{3}}.\nDhakhtarka: {{4}}.\n\nJawab 1 si aad u xaqiijiso, ama 2 si aad u joojiso.',
    '["patient_name","date","time","dentist_name"]'::jsonb,
    'draft'
  ),
  (
    'appointment_confirmation', 'ar',
    'Appointment confirmation (Arabic)', 'utility',
    E'عزيزي/عزيزتي {{1}}،\n\nتم حجز موعدكم لدى N.I SMILE Oral care & Teeth whitening.\nالتاريخ: {{2}}، الساعة: {{3}}.\nالطبيب: {{4}}.\n\nيرجى الرد بـ 1 للتأكيد أو 2 للإلغاء.',
    '["patient_name","date","time","dentist_name"]'::jsonb,
    'draft'
  ),
  (
    'appointment_reminder_24h', 'so',
    '24h appointment reminder (Somali)', 'utility',
    E'Mudane/Marwo {{1}},\n\nWaxaan kugu xusuusinaynaa ballantaada ilkaha ee N.I SMILE Oral care & Teeth whitening: {{2}}.\nTaariikhda: {{3}} saacadda {{4}}.\nDhakhtarka: {{5}}.\n\nJawab 1 si aad u xaqiijiso, ama 2 si aad u joojiso.',
    '["patient_name","branch_name","date","time","dentist_name"]'::jsonb,
    'draft'
  ),
  (
    'appointment_reminder_24h', 'ar',
    '24h appointment reminder (Arabic)', 'utility',
    E'عزيزي/عزيزتي {{1}}،\n\nنود تذكيركم بموعدكم الطبي لدى N.I SMILE Oral care & Teeth whitening ({{2}}).\nالتاريخ: {{3}}، الساعة: {{4}}.\nالطبيب المعالج: {{5}}.\n\nيرجى الرد بـ 1 للتأكيد أو 2 للإلغاء.',
    '["patient_name","branch_name","date","time","dentist_name"]'::jsonb,
    'draft'
  ),
  (
    'appointment_reminder_2h', 'so',
    '2h appointment reminder (Somali)', 'utility',
    E'Mudane/Marwo {{1}},\n\nBallantaada ee N.I SMILE waxay ku ag tahay 2 saacadood: {{2}} saacadda {{3}}.\nDhakhtarka: {{4}}.\n\nJawab 1 xaqiiji / 2 jooji.',
    '["patient_name","date","time","dentist_name"]'::jsonb,
    'draft'
  ),
  (
    'appointment_reminder_2h', 'ar',
    '2h appointment reminder (Arabic)', 'utility',
    E'عزيزي/عزيزتي {{1}}،\n\nموعدكم لدى N.I SMILE بعد ساعتين تقريباً: {{2}} الساعة {{3}}.\nالطبيب: {{4}}.\n\nالرد 1 للتأكيد / 2 للإلغاء.',
    '["patient_name","date","time","dentist_name"]'::jsonb,
    'draft'
  ),
  (
    'appointment_reschedule', 'so',
    'Reschedule notice (Somali)', 'utility',
    E'Mudane/Marwo {{1}},\n\nBallantaada waa la beddelay.\nWaqtiga cusub: {{2}} saacadda {{3}}.\nDhakhtarka: {{4}}.',
    '["patient_name","date","time","dentist_name"]'::jsonb,
    'draft'
  ),
  (
    'appointment_reschedule', 'ar',
    'Reschedule notice (Arabic)', 'utility',
    E'عزيزي/عزيزتي {{1}}،\n\nتم تغيير موعدكم.\nالوقت الجديد: {{2}} الساعة {{3}}.\nالطبيب: {{4}}.',
    '["patient_name","date","time","dentist_name"]'::jsonb,
    'draft'
  ),
  (
    'appointment_cancel', 'so',
    'Cancel notice (Somali)', 'utility',
    E'Mudane/Marwo {{1}},\n\nBallantaada ee {{2}} saacadda {{3}} waa la joojiyay. Nala soo xiriir si aad u qabsato mid cusub.',
    '["patient_name","date","time"]'::jsonb,
    'draft'
  ),
  (
    'appointment_cancel', 'ar',
    'Cancel notice (Arabic)', 'utility',
    E'عزيزي/عزيزتي {{1}}،\n\nتم إلغاء موعدكم بتاريخ {{2}} الساعة {{3}}. تواصلوا معنا لحجز موعد جديد.',
    '["patient_name","date","time"]'::jsonb,
    'draft'
  ),
  (
    'receipt_notice', 'so',
    'Receipt notice (Somali)', 'utility',
    E'Mudane/Marwo {{1}},\n\nMahadsanid. Rasiidkaaga N.I SMILE #{{2}} lacagtiisu waa ${{3}}. PDF-ka waa Ingiriis.',
    '["customer_name","receipt_number","amount"]'::jsonb,
    'draft'
  ),
  (
    'receipt_notice', 'ar',
    'Receipt notice (Arabic)', 'utility',
    E'عزيزي/عزيزتي {{1}}،\n\nشكراً لكم. إيصال N.I SMILE رقم {{2}} بمبلغ ${{3}}. ملف PDF بالإنجليزية.',
    '["customer_name","receipt_number","amount"]'::jsonb,
    'draft'
  ),
  (
    'invoice_notice', 'so',
    'Invoice notice (Somali)', 'utility',
    E'Mudane/Marwo {{1}},\n\nFakturaddaada N.I SMILE #{{2}} lacagtiisu waa ${{3}}. PDF-ka waa Ingiriis.',
    '["customer_name","invoice_number","amount"]'::jsonb,
    'draft'
  ),
  (
    'invoice_notice', 'ar',
    'Invoice notice (Arabic)', 'utility',
    E'عزيزي/عزيزتي {{1}}،\n\nفاتورتكم من N.I SMILE رقم {{2}} بمبلغ ${{3}}. ملف PDF بالإنجليزية.',
    '["customer_name","invoice_number","amount"]'::jsonb,
    'draft'
  )
  on conflict (kind, language) do nothing;

  if exists (
    select 1
    from dental.notification_queue
    where params->>'seed' = 'SEED-NOTIFICATION-QUEUE'
  ) then
    return;
  end if;

  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;
  if v_branch_id is null then
    raise exception 'No active branch.';
  end if;

  select id into v_customer_id
  from dental.customers
  where notes = 'SEED-APPOINTMENT-PATIENT'
  limit 1;

  if v_customer_id is null then
    select id into v_customer_id
    from dental.customers
    where customer_type = 'retail'
      and phone is not null
      and whatsapp_opt_in
    order by created_at
    limit 1;
  end if;

  if v_customer_id is null then
    -- Templates only if no patient yet.
    return;
  end if;

  perform dental.enqueue_notification(
    v_branch_id,
    'appointment_reminder_24h',
    null,
    null,
    v_customer_id,
    jsonb_build_object(
      'seed', 'SEED-NOTIFICATION-QUEUE',
      '1', 'Ayaan Abdi Mohamed',
      '2', 'N.I SMILE',
      '3', to_char(current_date + 1, 'YYYY-MM-DD'),
      '4', '10:30',
      '5', 'Demo Dentist'
    ),
    now() + interval '1 hour',
    'seed',
    null
  );
end;
$$;
