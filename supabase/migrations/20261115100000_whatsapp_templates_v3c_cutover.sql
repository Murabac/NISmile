-- Cut over DentaFlow to approved Meta templates nis_*_v3c.
-- Bodies match docs/WhatsApp-Templates-v3.md (footer + Contact care button on Meta;
-- no wa.me line in the body).

update dental.message_templates t
set
  body_text = v.body_text,
  variables = v.variables::jsonb,
  whatsapp_template_id = v.meta_name,
  status = 'approved',
  updated_at = now()
from (
  values
  (
    'appointment_confirmation',
    E'Hello {{1}},\n\nYour appointment at N.I SMILE is booked.\n\n*Date:* {{2}}\n*Time:* {{3}}\n*Dentist:* {{4}}\n\nReply *1* to confirm or *2* to cancel.',
    '["patient_name","date","time","dentist_name"]',
    'nis_appointment_confirmation_v3c'
  ),
  (
    'appointment_reminder_24h',
    E'Hello {{1}},\n\nReminder: your appointment at N.I SMILE is {{2}}.\n\n*Date:* {{3}}\n*Time:* {{4}}\n*Dentist:* {{5}}\n\nReply *1* to confirm or *2* to cancel.',
    '["patient_name","when","date","time","dentist_name"]',
    'nis_appointment_reminder_24h_v3c'
  ),
  (
    'appointment_reminder_2h',
    E'Hello {{1}},\n\nYour appointment at N.I SMILE is in about 2 hours.\n\n*Date:* {{2}}\n*Time:* {{3}}\n*Dentist:* {{4}}\n\nReply *1* to confirm or *2* to cancel.',
    '["patient_name","date","time","dentist_name"]',
    'nis_appointment_reminder_2h_v3c'
  ),
  (
    'appointment_reschedule',
    E'Hello {{1}},\n\nYour appointment at N.I SMILE has been rescheduled.\n\n*New date:* {{2}}\n*New time:* {{3}}\n*Dentist:* {{4}}\n\nReply *1* to confirm or *2* to cancel.',
    '["patient_name","date","time","dentist_name"]',
    'nis_appointment_reschedule_v3c'
  ),
  (
    'appointment_cancel',
    E'Hello {{1}},\n\nYour appointment at N.I SMILE on {{2}} at {{3}} has been cancelled. We can book a new time for you.',
    '["patient_name","date","time"]',
    'nis_appointment_cancel_v3c'
  ),
  (
    'appointment_reply_confirmed',
    E'Thank you {{1}}! Your appointment is confirmed.\n\n*Date:* {{2}}\n*Time:* {{3}}\n\nWe look forward to seeing you at N.I SMILE.',
    '["patient_name","date","time"]',
    'nis_appointment_reply_confirmed_v3c'
  ),
  (
    'appointment_reply_cancelled',
    E'Thank you {{1}}. Your appointment on {{2}} at {{3}} has been cancelled.\n\nTo book a new time, just message us.',
    '["patient_name","date","time"]',
    'nis_appointment_reply_cancelled_v3c'
  ),
  (
    'receipt_notice',
    E'Hello {{1}},\n\nThank you for choosing N.I SMILE. Here is your receipt summary.\n\n*Receipt:* {{2}}\n*Total:* USD {{3}}\n*Paid:* USD {{4}}\n*Open balance:* USD {{5}}\n*Due date:* {{6}}.\n\nWe appreciate your visit.',
    '["customer_name","receipt_number","amount_total","amount_paid","open_balance","due_date"]',
    'nis_receipt_notice_v3c'
  ),
  (
    'invoice_notice',
    E'Hello {{1}},\n\nThank you for choosing N.I SMILE. Here is your invoice summary.\n\n*Invoice:* {{2}}\n*Total:* USD {{3}}\n*Paid:* USD {{4}}\n*Open balance:* USD {{5}}\n*Due date:* {{6}}.\n\nWe appreciate your business.',
    '["customer_name","invoice_number","amount_total","amount_paid","open_balance","due_date"]',
    'nis_invoice_notice_v3c'
  ),
  (
    'payment_due_reminder',
    E'Hello {{1}},\n\nThis is a payment reminder from N.I SMILE.\n\n*Open balance:* USD {{2}}\n*Due date:* {{3}}\n\nPlease pay it on time.',
    '["customer_name","open_balance","due_date"]',
    'nis_payment_due_reminder_v3c'
  ),
  (
    'promotion_announcement',
    E'Hello,\n\n{{1}}\n\nReply STOP to opt out.',
    '["1"]',
    'nis_promotion_announcement_v3c'
  ),
  (
    'promotion_ending_soon',
    E'Hello,\n\nEnding soon: {{1}}\n\nReply STOP to opt out.',
    '["1"]',
    'nis_promotion_ending_soon_v3c'
  )
) as v(kind, body_text, variables, meta_name)
where t.kind = v.kind
  and t.language = 'en';
