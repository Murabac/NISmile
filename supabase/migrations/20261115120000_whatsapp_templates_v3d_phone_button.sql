-- Cut over to nis_*_v3d: Contact care is a native PHONE_NUMBER button
-- (+252 63 4548732). Footer number still offers Chat or Call when tapped.
-- Apply only after Meta shows each _v3d template as Approved.

update dental.message_templates t
set
  whatsapp_template_id = v.meta_name,
  status = 'approved',
  updated_at = now()
from (
  values
  ('appointment_confirmation', 'nis_appointment_confirmation_v3d'),
  ('appointment_reminder_24h', 'nis_appointment_reminder_24h_v3d'),
  ('appointment_reminder_2h', 'nis_appointment_reminder_2h_v3d'),
  ('appointment_reschedule', 'nis_appointment_reschedule_v3d'),
  ('appointment_cancel', 'nis_appointment_cancel_v3d'),
  ('appointment_reply_confirmed', 'nis_appointment_reply_confirmed_v3d'),
  ('appointment_reply_cancelled', 'nis_appointment_reply_cancelled_v3d'),
  ('receipt_notice', 'nis_receipt_notice_v3d'),
  ('invoice_notice', 'nis_invoice_notice_v3d'),
  ('payment_due_reminder', 'nis_payment_due_reminder_v3d'),
  ('promotion_announcement', 'nis_promotion_announcement_v3d'),
  ('promotion_ending_soon', 'nis_promotion_ending_soon_v3d')
) as v(kind, meta_name)
where t.kind = v.kind
  and t.language = 'en';
