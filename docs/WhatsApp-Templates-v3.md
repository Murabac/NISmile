# WhatsApp templates v3: Meta submission sheet

Submit each template below in Meta Business Manager > WhatsApp Manager > Message templates. Language: **English (`en`)**.

**Footer (static, every template, max 60 characters):** `Questions? Contact +252 63 4548732`

**Button (every template):** URL button label `Contact care` → `https://iwnswhnoxbvgyqljfvel.supabase.co/functions/v1/care-whatsapp`  
That page links to the human **Customer Care** WhatsApp (`+252 63 4548732` / `wa.me/252634548732`), not the Cloud API sender. Meta does not allow `wa.me` on template buttons, so the button uses this HTTPS page. Footer text alone is not a reliable tap target for chat. App also ships `app/public/care/` for `https://nismile.m2btek.com/care` after Coolify redeploy.

**Headers:**
- Receipt and invoice: Media > **Document**. Upload a sample A4 PDF (any recent receipt/invoice PDF). At send time the app attaches the real sale PDF.
- All other templates below: Media > **Image**, upload `Brand/whatsapp-header.jpg` (1200×628). Public URL: `https://nismile.m2btek.com/whatsapp-header.jpg` (override with Edge secret `WHATSAPP_HEADER_IMAGE_URL` if needed).

**Template name rule:** names end in `_v3c` (footer + Contact care button; prior `_v3` / `_v3b` names were locked or had a blocked `wa.me` button). The app attaches the logo image to `_v3c` names that are not receipt/invoice, and attaches the PDF document to `nis_receipt_notice_v3c` / `nis_invoice_notice_v3c`.

**Do not put the long `wa.me` care URL in the body.** Contact is the Meta footer plus the tappable **Contact care** button.

## Live cutover (done when `_v3c` is Approved)

1. Migration `20261115100000_whatsapp_templates_v3c_cutover.sql` sets every DentaFlow `message_templates` Meta name to `nis_*_v3c`, status **Approved**, and bodies to match this sheet.
2. Owner can delete retired Meta names (`nis_*_en`, `_v2`, `_v3`, `_v3b`) via `send-whatsapp` `{ "cleanup_old_templates": true }`.
3. Production sends use `_v3c` only (footer + Contact care button).

Notes: the 24h reminder has 5 variables; position 2 is the time left (“tomorrow”, “in about 3 hours”). Reply *1* / *2* stays on booking/reminder/reschedule bodies. Promotions are MARKETING and include STOP. Receipt and invoice carry the PDF on the same message as the summary.

## appointment_confirmation

- Suggested name: `nis_appointment_confirmation_v3c`
- Category: UTILITY
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["patient_name","date","time","dentist_name"]`
- Example values (in order): Maryam | Friday, 13 November | 12:00 PM | Dr. Hodan Ali

Body:

```
Hello {{1}},

Your appointment at N.I SMILE is booked.

*Date:* {{2}}
*Time:* {{3}}
*Dentist:* {{4}}

Reply *1* to confirm or *2* to cancel.
```

## appointment_reminder_24h

- Suggested name: `nis_appointment_reminder_24h_v3c`
- Category: UTILITY
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["patient_name","when","date","time","dentist_name"]`
- Example values (in order): Maryam | tomorrow | Friday, 13 November | 12:00 PM | Dr. Hodan Ali

Body:

```
Hello {{1}},

Reminder: your appointment at N.I SMILE is {{2}}.

*Date:* {{3}}
*Time:* {{4}}
*Dentist:* {{5}}

Reply *1* to confirm or *2* to cancel.
```

## appointment_reminder_2h

- Suggested name: `nis_appointment_reminder_2h_v3c`
- Category: UTILITY
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["patient_name","date","time","dentist_name"]`
- Example values (in order): Maryam | Friday, 13 November | 12:00 PM | Dr. Hodan Ali

Body:

```
Hello {{1}},

Your appointment at N.I SMILE is in about 2 hours.

*Date:* {{2}}
*Time:* {{3}}
*Dentist:* {{4}}

Reply *1* to confirm or *2* to cancel.
```

## appointment_reschedule

- Suggested name: `nis_appointment_reschedule_v3c`
- Category: UTILITY
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["patient_name","date","time","dentist_name"]`
- Example values (in order): Maryam | Saturday, 14 November | 10:30 AM | Dr. Hodan Ali

Body:

```
Hello {{1}},

Your appointment at N.I SMILE has been rescheduled.

*New date:* {{2}}
*New time:* {{3}}
*Dentist:* {{4}}

Reply *1* to confirm or *2* to cancel.
```

## appointment_cancel

- Suggested name: `nis_appointment_cancel_v3c`
- Category: UTILITY
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["patient_name","date","time"]`
- Example values (in order): Maryam | Friday, 13 November | 12:00 PM

Body:

```
Hello {{1}},

Your appointment at N.I SMILE on {{2}} at {{3}} has been cancelled. We can book a new time for you.
```

## appointment_reply_confirmed

- Suggested name: `nis_appointment_reply_confirmed_v3c`
- Category: UTILITY
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["patient_name","date","time"]`
- Example values (in order): Maryam | Friday, 13 November | 12:00 PM

Body:

```
Thank you {{1}}! Your appointment is confirmed.

*Date:* {{2}}
*Time:* {{3}}

We look forward to seeing you at N.I SMILE.
```

## appointment_reply_cancelled

- Suggested name: `nis_appointment_reply_cancelled_v3c`
- Category: UTILITY
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["patient_name","date","time"]`
- Example values (in order): Maryam | Friday, 13 November | 12:00 PM

Body:

```
Thank you {{1}}. Your appointment on {{2}} at {{3}} has been cancelled.

To book a new time, just message us.
```

## receipt_notice

- Suggested name: `nis_receipt_notice_v3c`
- Category: UTILITY
- Header: Document (PDF)
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["customer_name","receipt_number","amount_total","amount_paid","open_balance","due_date"]`
- Example values (in order): Ali | RCP-20261113-001 | 85.00 | 85.00 | 0.00 | 13 November 2026

Body:

```
Hello {{1}},

Thank you for choosing N.I SMILE. Here is your receipt summary.

*Receipt:* {{2}}
*Total:* USD {{3}}
*Paid:* USD {{4}}
*Open balance:* USD {{5}}
*Due date:* {{6}}.

We appreciate your visit.
```

## invoice_notice

- Suggested name: `nis_invoice_notice_v3c`
- Category: UTILITY
- Header: Document (PDF)
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["customer_name","invoice_number","amount_total","amount_paid","open_balance","due_date"]`
- Example values (in order): Ali | INV-20261113-001 | 340.00 | 100.00 | 240.00 | 20 November 2026

Body:

```
Hello {{1}},

Thank you for choosing N.I SMILE. Here is your invoice summary.

*Invoice:* {{2}}
*Total:* USD {{3}}
*Paid:* USD {{4}}
*Open balance:* USD {{5}}
*Due date:* {{6}}.

We appreciate your business.
```

## payment_due_reminder

- Suggested name: `nis_payment_due_reminder_v3c`
- Category: UTILITY
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["customer_name","open_balance","due_date"]`
- Example values (in order): Ali | 240.00 | 20 November 2026

Body:

```
Hello {{1}},

This is a payment reminder from N.I SMILE.

*Open balance:* USD {{2}}
*Due date:* {{3}}

Please pay it on time.
```

## promotion_announcement

- Suggested name: `nis_promotion_announcement_v3c`
- Category: MARKETING
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["1"]`
- Example values (in order): 10% off teeth whitening until 30 November

Body:

```
Hello,

{{1}}

Reply STOP to opt out.
```

## promotion_ending_soon

- Suggested name: `nis_promotion_ending_soon_v3c`
- Category: MARKETING
- Header: Image
- Footer: `Questions? Contact +252 63 4548732`
- Variables: `["1"]`
- Example values (in order): 10% off teeth whitening, last day is 30 November

Body:

```
Hello,

Ending soon: {{1}}

Reply STOP to opt out.
```
