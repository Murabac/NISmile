-- English WhatsApp utility templates (parity with so/ar). Safe to re-run.

insert into dental.message_templates (
  kind, language, name, category, body_text, variables, status
)
values
(
  'appointment_confirmation', 'en',
  'Appointment confirmation (English)', 'utility',
  E'Dear {{1}},\n\nYour appointment at N.I SMILE Oral care & Teeth whitening is booked.\nDate: {{2}} at {{3}}.\nDentist: {{4}}.\n\nReply 1 to confirm, or 2 to cancel.',
  '["patient_name","date","time","dentist_name"]'::jsonb,
  'draft'
),
(
  'appointment_reminder_24h', 'en',
  '24h appointment reminder (English)', 'utility',
  E'Dear {{1}},\n\nReminder: your dental appointment at N.I SMILE Oral care & Teeth whitening ({{2}}).\nDate: {{3}} at {{4}}.\nDentist: {{5}}.\n\nReply 1 to confirm, or 2 to cancel.',
  '["patient_name","branch_name","date","time","dentist_name"]'::jsonb,
  'draft'
),
(
  'appointment_reminder_2h', 'en',
  '2h appointment reminder (English)', 'utility',
  E'Dear {{1}},\n\nYour N.I SMILE appointment is in about 2 hours: {{2}} at {{3}}.\nDentist: {{4}}.\n\nReply 1 to confirm / 2 to cancel.',
  '["patient_name","date","time","dentist_name"]'::jsonb,
  'draft'
),
(
  'appointment_reschedule', 'en',
  'Reschedule notice (English)', 'utility',
  E'Dear {{1}},\n\nYour appointment has been rescheduled.\nNew time: {{2}} at {{3}}.\nDentist: {{4}}.',
  '["patient_name","date","time","dentist_name"]'::jsonb,
  'draft'
),
(
  'appointment_cancel', 'en',
  'Cancel notice (English)', 'utility',
  E'Dear {{1}},\n\nYour appointment on {{2}} at {{3}} has been cancelled. Contact us to book a new one.',
  '["patient_name","date","time"]'::jsonb,
  'draft'
),
(
  'receipt_notice', 'en',
  'Receipt notice (English)', 'utility',
  E'Dear {{1}},\n\nThank you. Your N.I SMILE receipt #{{2}} totals ${{3}}. The PDF is in English.',
  '["customer_name","receipt_number","amount"]'::jsonb,
  'draft'
),
(
  'invoice_notice', 'en',
  'Invoice notice (English)', 'utility',
  E'Dear {{1}},\n\nYour N.I SMILE invoice #{{2}} totals ${{3}}. The PDF is in English.',
  '["customer_name","invoice_number","amount"]'::jsonb,
  'draft'
)
on conflict (kind, language) do nothing;
