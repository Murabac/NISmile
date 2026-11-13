# WhatsApp templates v2: Meta submission sheet

Submit each template below in Meta Business Manager > WhatsApp Manager > Message templates. Language: **English (`en`)**.

**Header (all templates except the two free-form replies):** Media > Image, upload `Brand/whatsapp-header.jpg` (1200x628). The app sends `https://nismile.m2btek.com/whatsapp-header.jpg` as the header, so redeploy the app first. Override with the Edge Function secret `WHATSAPP_HEADER_IMAGE_URL` if needed.

**Footer (static, max 60 characters):** `N.I SMILE Oral care & Teeth whitening`

**Template name rule:** names must end in `_v2`, because the app only attaches the image header to names ending `_v2`. Suggested name: `nis_<kind>_v2`.

## Switch-on steps

1. Apply migration `supabase/migrations/20261112100000_whatsapp_message_polish.sql`.
2. Deploy: `npx supabase functions deploy send-whatsapp --project-ref iwnswhnoxbvgyqljfvel`.
3. Redeploy the app (Coolify) so `/whatsapp-header.jpg` is public and Settings shows "Name shown to patients".
4. Submit the templates below. Wait for Approved.
5. In the app: WhatsApp > Templates, set each template's Meta name (`nis_*_v2`) and status Approved. Keep the old templates until the new ones are approved.
6. Settings > Users: set "Name shown to patients" for each dentist.

Notes: the 24h reminder now has 5 variables and position 2 is the time left ("tomorrow", "in about 3 hours"). The two reply acknowledgements are free-form (sent inside the 24h window), so they need no Meta approval. Receipt and invoice templates carry the summary. The app also sends the A4 PDF as a second message, with the care line in the caption. That PDF only arrives if the customer has messaged this business number in the last 24 hours, unless the Meta template itself is approved with a document header.

## appointment_confirmation

- Suggested name: `nis_appointment_confirmation_v2`
- Category: UTILITY
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

For further instructions or questions, contact us: https://wa.me/252634548732
```

## appointment_reminder_24h

- Suggested name: `nis_appointment_reminder_24h_v2`
- Category: UTILITY
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

For further instructions or questions, contact us: https://wa.me/252634548732
```

## appointment_reminder_2h

- Suggested name: `nis_appointment_reminder_2h_v2`
- Category: UTILITY
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

For further instructions or questions, contact us: https://wa.me/252634548732
```

## appointment_reschedule

- Suggested name: `nis_appointment_reschedule_v2`
- Category: UTILITY
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

For further instructions or questions, contact us: https://wa.me/252634548732
```

## appointment_cancel

- Suggested name: `nis_appointment_cancel_v2`
- Category: UTILITY
- Variables: `["patient_name","date","time"]`
- Example values (in order): Maryam | Friday, 13 November | 12:00 PM

Body:

```
Hello {{1}},

Your appointment at N.I SMILE on {{2}} at {{3}} has been cancelled. We can book a new time for you.

For further instructions or questions, contact us: https://wa.me/252634548732
```

## appointment_reply_confirmed

- Suggested name: `nis_appointment_reply_confirmed_v2`
- Category: free-form reply (no template)
- Variables: `["patient_name","date","time"]`
- Example values (in order): Maryam | Friday, 13 November | 12:00 PM

Body:

```
Thank you {{1}}! Your appointment is confirmed.

*Date:* {{2}}
*Time:* {{3}}

We look forward to seeing you at N.I SMILE.

For further instructions or questions, contact us: https://wa.me/252634548732
```

## appointment_reply_cancelled

- Suggested name: `nis_appointment_reply_cancelled_v2`
- Category: free-form reply (no template)
- Variables: `["patient_name","date","time"]`
- Example values (in order): Maryam | Friday, 13 November | 12:00 PM

Body:

```
Thank you {{1}}. Your appointment on {{2}} at {{3}} has been cancelled.

To book a new time, just message us.

For further instructions or questions, contact us: https://wa.me/252634548732
```

## receipt_notice

- Suggested name: `nis_receipt_notice_v2`
- Category: UTILITY
- Variables: `["customer_name","receipt_number","amount_total","amount_paid","open_balance","due_date"]`
- Example values (in order): Ali | 1042 | 85.00 | 85.00 | 0.00 | 13 November 2026

Body:

```
Hello {{1}},

Thank you for choosing N.I SMILE. Here is your receipt summary.

*Receipt:* #{{2}}
*Total:* ${{3}}
*Paid:* ${{4}}
*Open balance:* ${{5}}
*Due date:* {{6}}

For further instructions or questions, contact us: https://wa.me/252634548732
```

## invoice_notice

- Suggested name: `nis_invoice_notice_v2`
- Category: UTILITY
- Variables: `["customer_name","invoice_number","amount_total","amount_paid","open_balance","due_date"]`
- Example values (in order): Ali | 2031 | 340.00 | 100.00 | 240.00 | 20 November 2026

Body:

```
Hello {{1}},

Thank you for choosing N.I SMILE. Here is your invoice summary.

*Invoice:* #{{2}}
*Total:* ${{3}}
*Paid:* ${{4}}
*Open balance:* ${{5}}
*Due date:* {{6}}

For further instructions or questions, contact us: https://wa.me/252634548732
```

## payment_due_reminder

- Suggested name: `nis_payment_due_reminder_v2`
- Category: UTILITY
- Variables: `["customer_name","open_balance","due_date"]`
- Example values (in order): Ali | 240.00 | 20 November 2026

Body:

```
Hello {{1}},

This is a payment reminder from N.I SMILE.

*Open balance:* ${{2}}
*Due date:* {{3}}

Please pay it on time.

For further instructions or questions, contact us: https://wa.me/252634548732
```

## promotion_announcement

- Suggested name: `nis_promotion_announcement_v2`
- Category: MARKETING
- Variables: `["1"]`
- Example values (in order): 10% off teeth whitening until 30 November

Body:

```
Hello,

{{1}}

For further instructions or questions, contact us: https://wa.me/252634548732

Reply STOP to opt out.
```

## promotion_ending_soon

- Suggested name: `nis_promotion_ending_soon_v2`
- Category: MARKETING
- Variables: `["1"]`
- Example values (in order): 10% off teeth whitening, last day is 30 November

Body:

```
Hello,

Ending soon: {{1}}

For further instructions or questions, contact us: https://wa.me/252634548732

Reply STOP to opt out.
```
